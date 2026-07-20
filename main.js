const { app, BrowserWindow, ipcMain, shell, dialog } = require("electron");
const path = require("path");
const fs = require("fs");
const https = require("https");
const os = require("os");
const { pathToFileURL } = require("url");
const { execFile } = require("child_process");
const Store = require("electron-store");
const { Auth } = require("msmc");
const { Client } = require("minecraft-launcher-core");
const { ensureJava } = require("./javaManager");
const { ensureFabric } = require("./fabricManager");
const { analyzeCrashLog } = require("./crashAnalyzer");

let RPC = null;
try {
  RPC = require("discord-rpc");
} catch (err) {
  RPC = null;
}

const DISCORD_CLIENT_ID = "1358090470340956422";
let discordClient = null;
let discordReady = false;
let sessionStart = Date.now();

let discordRetryCount = 0;
const DISCORD_MAX_RETRIES = 6;

function initDiscordRPC() {
  if (!RPC || discordClient) return;
  try {
    RPC.register(DISCORD_CLIENT_ID);
    discordClient = new RPC.Client({ transport: "ipc" });

    discordClient.on("ready", () => {
      discordReady = true;
      discordRetryCount = 0;
      setDiscordIdle();
    });

    discordClient.on("disconnected", () => {
      discordReady = false;
      discordClient = null;
      scheduleDiscordRetry();
    });

    discordClient.login({ clientId: DISCORD_CLIENT_ID }).catch(() => {
      discordClient = null;
      scheduleDiscordRetry();
    });
  } catch (err) {
    discordClient = null;
    scheduleDiscordRetry();
  }
}

// Discord's desktop app isn't always fully started by the time the launcher
// opens (e.g. both launching together at Windows startup), so a failed
// first attempt doesn't mean Discord isn't available — retry a few times
// with backoff before giving up for this session.
function scheduleDiscordRetry() {
  if (discordRetryCount >= DISCORD_MAX_RETRIES) return;
  discordRetryCount++;
  setTimeout(() => {
    if (store.get("discordPresence", true)) initDiscordRPC();
  }, 8000 * discordRetryCount);
}

function setDiscordActivity(details, state) {
  if (!discordClient || !discordReady) return;
  discordClient
    .setActivity({
      details,
      state,
      startTimestamp: sessionStart,
      largeImageKey: "arsenix_logo",
      largeImageText: "Arsenix Launcher",
      instance: false,
    })
    .catch(() => {});
}

function setDiscordIdle() {
  setDiscordActivity("Browsing the launcher", "Idle");
}

function setDiscordInGame(version) {
  sessionStart = Date.now();
  setDiscordActivity(`Playing Minecraft ${version}`, "In-game");
}

function teardownDiscordActivity() {
  sessionStart = Date.now();
  setDiscordIdle();
}

const store = new Store();
const launcher = new Client();
let mainWindow;
let currentLogBuffer = [];
let gameRunning = false;
let hiddenForGame = false;
let currentGameProcess = null;

// Well-known safe JVM tuning flags ("Aikar's flags") — widely used to
// reduce GC-related stutter and improve frame-time consistency, especially
// on lower-end machines. Only applied when the user opts in.
const PERFORMANCE_JVM_ARGS = [
  "-XX:+UseG1GC",
  "-XX:+ParallelRefProcEnabled",
  "-XX:MaxGCPauseMillis=200",
  "-XX:+UnlockExperimentalVMOptions",
  "-XX:+DisableExplicitGC",
  "-XX:+AlwaysPreTouch",
  "-XX:G1NewSizePercent=30",
  "-XX:G1MaxNewSizePercent=40",
  "-XX:G1HeapRegionSize=8M",
  "-XX:G1ReservePercent=20",
  "-XX:G1HeapWastePercent=5",
  "-XX:G1MixedGCCountTarget=4",
  "-XX:InitiatingHeapOccupancyPercent=15",
  "-XX:G1MixedGCLiveThresholdPercent=90",
  "-XX:G1RSetUpdatingPauseTimePercent=5",
  "-XX:SurvivorRatio=32",
  "-XX:+PerfDisableSharedMem",
  "-XX:MaxTenuringThreshold=1",
];

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 650,
    minWidth: 900,
    minHeight: 600,
    frame: false,
    backgroundColor: "#05050a",
    icon: path.join(__dirname, "assets", "icon.png"),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
    },
  });

  mainWindow.loadFile("index.html");

  // Windows sometimes fails to repaint the GPU-composited frame after a
  // window has been minimized/hidden for a while, leaving it solid black
  // when restored. Forcing a repaint on these transitions fixes it.
  const forceRepaint = () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.invalidate();
    }
  };
  mainWindow.on("restore", () => {
    forceRepaint();
    // Restore full responsiveness once the user is back in the launcher.
    if (!mainWindow.isDestroyed()) mainWindow.webContents.setBackgroundThrottling(false);
  });
  mainWindow.on("show", forceRepaint);
  mainWindow.on("focus", forceRepaint);

  // Smart background suspend: while the launcher is minimized/hidden
  // (including while a game is running), let Chromium throttle its CPU/RAM
  // usage since nothing needs to be visibly rendered — freeing up resources
  // for the game. This is undone the moment the window is shown again.
  mainWindow.on("minimize", () => {
    if (!mainWindow.isDestroyed()) mainWindow.webContents.setBackgroundThrottling(true);
  });
}

app.whenReady().then(() => {
  createWindow();
  if (store.get("discordPresence", true)) {
    initDiscordRPC();
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

// Sends an IPC message only if the window/webContents are still alive.
// Prevents "Object has been destroyed" crashes when events fire after
// the window has been hidden or closed (e.g. late minecraft-launcher-core events).
function safeSend(channel, payload) {
  if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.webContents.isDestroyed()) {
    mainWindow.webContents.send(channel, payload);
  }
}

// ---------- Window controls (custom titlebar since frame:false) ----------
ipcMain.on("window:minimize", () => mainWindow.minimize());

ipcMain.on("window:close", () => {
  // If a game session is active, hide instead of fully closing so the
  // launcher can safely reappear once the game process exits.
  if (gameRunning) {
    mainWindow.hide();
    mainWindow.webContents.setBackgroundThrottling(true);
    hiddenForGame = true;
  } else {
    mainWindow.close();
  }
});

// ---------- Helpers ----------
function accountsList() {
  return store.get("accounts", []); // [{ uuid, name, token }]
}

function saveAccountsList(list) {
  store.set("accounts", list);
}

function toPublicAccount(acc) {
  return { uuid: acc.uuid, name: acc.name };
}

async function loginToMclc(xboxManager) {
  const token = await xboxManager.getMinecraft();
  const mclc = token.mclc();
  return { mclc, savedToken: xboxManager.save() };
}

function defaultGameDir() {
  return path.join(app.getPath("appData"), "arsenix-launcher", "minecraft");
}

// Recommends a safe RAM allocation based on total system memory. Never
// suggests more than roughly half of total RAM (leaves headroom for the OS
// and other apps), and caps the top end since vanilla Minecraft sees very
// little benefit — and can even see worse GC pauses — beyond ~8-10GB.
function getRecommendedRam(totalRamGB) {
  if (totalRamGB <= 4) return Math.max(1, totalRamGB - 1);
  if (totalRamGB <= 8) return 4;
  if (totalRamGB <= 16) return 6;
  if (totalRamGB <= 32) return 8;
  return 10;
}

ipcMain.handle("system:info", () => {
  const totalRamGB = Math.max(1, Math.floor(os.totalmem() / 1024 ** 3));
  const cpuCores = os.cpus().length || 4;
  return {
    totalRamGB,
    cpuCores,
    recommendedRam: getRecommendedRam(totalRamGB),
    isLowEnd: totalRamGB <= 6 || cpuCores <= 4,
  };
});

// Nudges the spawned Java process to a slightly higher OS scheduling
// priority so the game gets first claim on CPU time over background tasks
// — a real, measurable smoothness improvement on lower-end machines.
function boostProcessPriority(pid) {
  if (process.platform === "win32") {
    execFile("powershell", [
      "-NoProfile",
      "-Command",
      `(Get-Process -Id ${pid}).PriorityClass = 'AboveNormal'`,
    ], () => {});
  } else if (process.platform !== "darwin") {
    // renice on Linux; harmless no-op if it fails without permission.
    execFile("renice", ["-n", "-5", "-p", String(pid)], () => {});
  }
}

function readOptionsMap(gameDir) {
  const optionsPath = path.join(gameDir, "options.txt");
  const map = {};
  if (fs.existsSync(optionsPath)) {
    fs.readFileSync(optionsPath, "utf8")
      .split("\n")
      .filter(Boolean)
      .forEach((line) => {
        const idx = line.indexOf(":");
        if (idx > -1) map[line.slice(0, idx)] = line.slice(idx + 1);
      });
  }
  return map;
}

function writeOptionsMap(gameDir, map) {
  fs.mkdirSync(gameDir, { recursive: true });
  const optionsPath = path.join(gameDir, "options.txt");
  const out = Object.entries(map).map(([k, v]) => `${k}:${v}`).join("\n");
  fs.writeFileSync(optionsPath, out);
}

// Writes a small set of known-good low-end-friendly values into options.txt,
// preserving any existing settings the user already has. Minecraft fills in
// everything else with defaults on first run, so a partial file is safe.
function applyLowEndPreset(gameDir) {
  const desired = {
    renderDistance: "6",
    simulationDistance: "6",
    maxFps: "260",
    graphicsMode: "0",
    ao: "0",
    particles: "2",
    enableVsync: "false",
    clouds: "0",
    entityShadows: "false",
    mipmapLevels: "0",
    biomeBlendRadius: "0",
    fboEnable: "true",
    guiScale: "2",
    fovEffectScale: "0.0",
    screenEffectScale: "0.0",
    darkMojangStudiosBackground: "false",
    entityDistanceScaling: "0.5",
  };
  const map = { ...readOptionsMap(gameDir), ...desired };
  writeOptionsMap(gameDir, map);
}

// ---------- Auth ----------
// Restores the last-used account on startup if a valid saved session exists.
ipcMain.handle("auth:check", async () => {
  const lastUuid = store.get("lastAccount");
  const accounts = accountsList();
  const acc = accounts.find((a) => a.uuid === lastUuid) || accounts[0];
  if (!acc) return null;

  try {
    const authManager = new Auth("select_account");
    const xboxManager = await authManager.refresh(acc.token);
    const { mclc, savedToken } = await loginToMclc(xboxManager);

    acc.token = savedToken;
    acc.name = mclc.name;
    saveAccountsList(accounts);
    store.set("lastAccount", acc.uuid);

    return { name: mclc.name, uuid: mclc.uuid, mclc, accounts: accounts.map(toPublicAccount) };
  } catch (err) {
    return null;
  }
});

// Opens the real Microsoft login window and completes the OAuth flow.
// Adds the account to the saved accounts list (or updates it if it already exists).
ipcMain.handle("auth:login", async () => {
  try {
    const authManager = new Auth("select_account");
    const xboxManager = await authManager.launch("electron");
    const { mclc, savedToken } = await loginToMclc(xboxManager);

    const accounts = accountsList();
    const existing = accounts.find((a) => a.uuid === mclc.uuid);
    if (existing) {
      existing.token = savedToken;
      existing.name = mclc.name;
    } else {
      accounts.push({ uuid: mclc.uuid, name: mclc.name, token: savedToken });
    }
    saveAccountsList(accounts);
    store.set("lastAccount", mclc.uuid);

    return {
      success: true,
      name: mclc.name,
      uuid: mclc.uuid,
      mclc,
      accounts: accounts.map(toPublicAccount),
    };
  } catch (err) {
    return { success: false, error: err.message || String(err) };
  }
});

// Switches the active account to an already-saved one, refreshing its token.
ipcMain.handle("auth:switch", async (event, uuid) => {
  const accounts = accountsList();
  const acc = accounts.find((a) => a.uuid === uuid);
  if (!acc) return { success: false, error: "Account not found." };

  try {
    const authManager = new Auth("select_account");
    const xboxManager = await authManager.refresh(acc.token);
    const { mclc, savedToken } = await loginToMclc(xboxManager);

    acc.token = savedToken;
    acc.name = mclc.name;
    saveAccountsList(accounts);
    store.set("lastAccount", mclc.uuid);

    return {
      success: true,
      name: mclc.name,
      uuid: mclc.uuid,
      mclc,
      accounts: accounts.map(toPublicAccount),
    };
  } catch (err) {
    return { success: false, error: "Could not refresh this account. Please sign in again." };
  }
});

ipcMain.handle("auth:remove", (event, uuid) => {
  const accounts = accountsList().filter((a) => a.uuid !== uuid);
  saveAccountsList(accounts);
  if (store.get("lastAccount") === uuid) store.delete("lastAccount");
  return accounts.map(toPublicAccount);
});

ipcMain.handle("auth:logout", async () => {
  saveAccountsList([]);
  store.delete("lastAccount");
  return true;
});

// ---------- Versions ----------
ipcMain.handle("versions:list", () => {
  return new Promise((resolve) => {
    https
      .get("https://launchermeta.mojang.com/mc/game/version_manifest.json", (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            const parsed = JSON.parse(data);
            const releases = parsed.versions.filter((v) => v.type === "release").map((v) => v.id);
            const snapshots = parsed.versions.filter((v) => v.type === "snapshot").map((v) => v.id);
            resolve({ releases, snapshots, latest: parsed.latest });
          } catch (err) {
            resolve({ releases: [], snapshots: [], latest: null });
          }
        });
      })
      .on("error", () => resolve({ releases: [], snapshots: [], latest: null }));
  });
});

// ---------- Launch ----------
ipcMain.handle("game:launch", async (event, { authorization, version, versionType, ram, gameDir, loader }) => {
  currentLogBuffer = [];
  gameRunning = true;
  hiddenForGame = false;
  const closeOnLaunch = store.get("closeOnLaunch", false);
  const performanceMode = store.get("performanceMode", true);
  const lowEndPreset = store.get("lowEndPreset", false);
  const resolvedGameDir = gameDir || defaultGameDir();

  const pushLog = (e) => {
    currentLogBuffer.push(String(e));
    if (currentLogBuffer.length > 2000) currentLogBuffer.shift();
    safeSend("game:log", e);

    if (closeOnLaunch && mainWindow && !mainWindow.isDestroyed() && mainWindow.isVisible() && /launching with arguments/i.test(String(e))) {
      mainWindow.hide();
      mainWindow.webContents.setBackgroundThrottling(true);
      hiddenForGame = true;
    }
  };

  try {
    pushLog("Checking for Java...");
    const javaPath = await ensureJava(version, pushLog, (pct) => safeSend("game:progress", { type: "java", task: pct, total: 1 }));

    if (store.get("discordPresence", true)) {
      setDiscordInGame(version);
    }

    let versionCustom = null;
    if (loader === "fabric") {
      versionCustom = await ensureFabric(resolvedGameDir, javaPath, version, pushLog);
    }

    if (lowEndPreset) {
      applyLowEndPreset(resolvedGameDir);
    }

    const opts = {
      authorization,
      root: resolvedGameDir,
      javaPath,
      version: {
        number: version || "1.21.1",
        type: versionType || "release",
        custom: versionCustom || undefined,
      },
      memory: {
        max: `${ram || 4}G`,
        min: "1G",
      },
      customArgs: performanceMode ? PERFORMANCE_JVM_ARGS : [],
    };

    // minecraft-launcher-core's Client instance is reused across launches, so
    // any listeners from a previous session must be cleared first — otherwise
    // logs/progress fire multiple times per line on every subsequent launch.
    ["debug", "data", "progress", "close"].forEach((evt) => launcher.removeAllListeners(evt));

    launcher.on("debug", pushLog);
    launcher.on("data", pushLog);
    launcher.on("progress", (e) => safeSend("game:progress", e));
    launcher.on("close", (code) => {
      gameRunning = false;
      currentGameProcess = null;
      if (store.get("discordPresence", true)) {
        teardownDiscordActivity();
      }

      if (mainWindow && !mainWindow.isDestroyed() && (hiddenForGame || !mainWindow.isVisible())) {
        mainWindow.show();
        mainWindow.focus();
      }
      hiddenForGame = false;

      if (code && code !== 0) {
        const logsDir = path.join(app.getPath("userData"), "crash-logs");
        fs.mkdirSync(logsDir, { recursive: true });
        const file = path.join(logsDir, `crash-${Date.now()}.log`);
        const fullLog = currentLogBuffer.join("\n");
        fs.writeFileSync(file, fullLog);
        const reason = analyzeCrashLog(fullLog);
        safeSend("game:crash", { code, file, reason });
      }
      safeSend("game:closed", code);
    });

    const launchResult = launcher.launch(opts);
    // minecraft-launcher-core's launch() resolves with the spawned child
    // process in some versions; capture it either way so a manual
    // "Force stop" can recover the UI if the process hangs (e.g. a GPU
    // driver crash spamming GL errors during shutdown instead of exiting).
    if (launchResult && typeof launchResult.then === "function") {
      launchResult.then((child) => {
        if (child && typeof child.kill === "function") {
          currentGameProcess = child;
          if (performanceMode && child.pid) boostProcessPriority(child.pid);
        }
      }).catch(() => {});
    } else if (launchResult && typeof launchResult.kill === "function") {
      currentGameProcess = launchResult;
      if (performanceMode && launchResult.pid) boostProcessPriority(launchResult.pid);
    }
  } catch (err) {
    gameRunning = false;
    safeSend("game:log", `Failed to launch: ${err.message || err}`);
    safeSend("game:crash", { code: 1, file: null, reason: err.message || String(err) });
    safeSend("game:closed", 1);
  }

  return true;
});

// ---------- Music (local files only — no bundled/copyrighted audio) ----------
ipcMain.handle("music:pick-files", async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: "Add music",
    properties: ["openFile", "multiSelections"],
    filters: [{ name: "Audio", extensions: ["mp3", "wav", "ogg", "m4a", "flac"] }],
  });
  if (result.canceled) return [];
  return result.filePaths.map((p) => ({
    path: p,
    name: path.basename(p).replace(/\.[^/.]+$/, ""),
    url: pathToFileURL(p).href,
  }));
});

// ---------- Force stop (recovers a hung/stuck game process) ----------
ipcMain.handle("game:force-stop", () => {
  if (currentGameProcess) {
    try {
      currentGameProcess.kill();
    } catch (err) {
      // process may already be gone
    }
  }
  gameRunning = false;
  currentGameProcess = null;
  if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.isVisible()) {
    mainWindow.show();
    mainWindow.focus();
  }
  safeSend("game:closed", 0);
  return true;
});

// ---------- Resource Packs ----------
function resourcePacksDir(gameDir) {
  const dir = path.join(gameDir || defaultGameDir(), "resourcepacks");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function getEnabledPacks(gameDir) {
  const map = readOptionsMap(gameDir);
  try {
    return JSON.parse(map.resourcePacks || "[]");
  } catch (err) {
    return [];
  }
}

function setEnabledPacks(gameDir, list) {
  const map = readOptionsMap(gameDir);
  map.resourcePacks = JSON.stringify(list);
  writeOptionsMap(gameDir, map);
}

ipcMain.handle("respacks:list", (event, gameDir) => {
  const dir = resourcePacksDir(gameDir);
  const enabled = getEnabledPacks(gameDir || defaultGameDir());
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".zip"))
    .map((f) => ({
      filename: f,
      enabled: enabled.includes(`file/${f}`),
    }));
});

ipcMain.handle("respacks:install-url", async (event, { gameDir, url, filename }) => {
  const dir = resourcePacksDir(gameDir);
  const dest = path.join(dir, filename);
  await new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        if (res.statusCode !== 200) return reject(new Error(`Download failed (${res.statusCode})`));
        const file = fs.createWriteStream(dest);
        res.pipe(file);
        file.on("finish", () => file.close(() => resolve()));
      })
      .on("error", reject);
  });
  return true;
});

ipcMain.handle("respacks:install-local", async (event, gameDir) => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: "Add resource pack",
    properties: ["openFile", "multiSelections"],
    filters: [{ name: "Resource Pack", extensions: ["zip"] }],
  });
  if (result.canceled) return [];

  const dir = resourcePacksDir(gameDir);
  const added = [];
  result.filePaths.forEach((src) => {
    const filename = path.basename(src);
    const dest = path.join(dir, filename);
    fs.copyFileSync(src, dest);
    added.push(filename);
  });
  return added;
});

ipcMain.handle("respacks:toggle", (event, { gameDir, filename }) => {
  const dir = gameDir || defaultGameDir();
  const enabled = getEnabledPacks(dir);
  const entry = `file/${filename}`;
  const next = enabled.includes(entry) ? enabled.filter((e) => e !== entry) : [entry, ...enabled];
  setEnabledPacks(dir, next);
  return true;
});

ipcMain.handle("respacks:remove", (event, { gameDir, filename }) => {
  const dir = gameDir || defaultGameDir();
  fs.unlinkSync(path.join(resourcePacksDir(dir), filename));
  const enabled = getEnabledPacks(dir).filter((e) => e !== `file/${filename}`);
  setEnabledPacks(dir, enabled);
  return true;
});

// ---------- Mods (Fabric mods folder management) ----------
function modsDir(gameDir) {
  const dir = path.join(gameDir || defaultGameDir(), "mods");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

ipcMain.handle("mods:list", (event, gameDir) => {
  const dir = modsDir(gameDir);
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".jar") || f.endsWith(".jar.disabled"))
    .map((f) => ({
      filename: f.replace(/\.disabled$/, ""),
      enabled: !f.endsWith(".disabled"),
      raw: f,
    }));
});

ipcMain.handle("mods:install", async (event, { gameDir, url, filename }) => {
  const dir = modsDir(gameDir);
  const dest = path.join(dir, filename);
  await new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        if (res.statusCode !== 200) return reject(new Error(`Download failed (${res.statusCode})`));
        const file = fs.createWriteStream(dest);
        res.pipe(file);
        file.on("finish", () => file.close(() => resolve()));
      })
      .on("error", reject);
  });
  return true;
});

ipcMain.handle("mods:toggle", (event, { gameDir, raw }) => {
  const dir = modsDir(gameDir);
  const current = path.join(dir, raw);
  const target = raw.endsWith(".disabled")
    ? path.join(dir, raw.replace(/\.disabled$/, ""))
    : path.join(dir, `${raw}.disabled`);
  fs.renameSync(current, target);
  return true;
});

ipcMain.handle("mods:remove", (event, { gameDir, raw }) => {
  const dir = modsDir(gameDir);
  fs.unlinkSync(path.join(dir, raw));
  return true;
});

// ---------- Settings ----------
ipcMain.handle("settings:get", () => {
  const totalRamGB = Math.max(1, Math.floor(os.totalmem() / 1024 ** 3));
  const cpuCores = os.cpus().length || 4;
  const isLowEnd = totalRamGB <= 6 || cpuCores <= 4;

  return {
    ram: store.get("ram", getRecommendedRam(totalRamGB)),
    totalRamGB,
    version: store.get("version", "1.21.1"),
    versionType: store.get("versionType", "release"),
    gameDir: store.get("gameDir", defaultGameDir()),
    closeOnLaunch: store.get("closeOnLaunch", false),
    soundEffects: store.get("soundEffects", true),
    theme: store.get("theme", "void"),
    serverAddress: store.get("serverAddress", ""),
    loader: store.get("loader", "vanilla"),
    performanceMode: store.get("performanceMode", true),
    lowEndPreset: store.get("lowEndPreset", isLowEnd),
    musicPlaylist: store.get("musicPlaylist", []),
    discordPresence: store.get("discordPresence", true),
  };
});

ipcMain.handle("settings:set", (event, settings) => {
  Object.entries(settings).forEach(([key, value]) => store.set(key, value));

  if ("discordPresence" in settings) {
    if (settings.discordPresence) {
      initDiscordRPC();
    } else if (discordClient) {
      discordClient.clearActivity().catch(() => {});
    }
  }

  return true;
});

// ---------- External links ----------
ipcMain.handle("shell:open-discord", () => {
  shell.openExternal("https://discord.gg/CM8a87nhYA");
});
