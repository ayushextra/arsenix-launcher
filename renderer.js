// ---------------- Starfield / nebula / shooting stars ----------------
const canvas = document.getElementById("stars");
const ctx = canvas.getContext("2d");
let stars = [];
let nebulae = [];
let shootingStars = [];

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  stars = Array.from({ length: 130 }, () => ({
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height,
    r: Math.random() * 1.3 + 0.2,
    speed: Math.random() * 0.15 + 0.02,
    twinkle: Math.random() * Math.PI * 2,
  }));

  nebulae = [
    { x: canvas.width * 0.15, y: canvas.height * 0.25, r: 260, color: "111,120,200", dx: 0.02, dy: 0.01 },
    { x: canvas.width * 0.85, y: canvas.height * 0.7, r: 220, color: "150,110,190", dx: -0.015, dy: 0.02 },
  ];

}
window.addEventListener("resize", resizeCanvas);
resizeCanvas();

function maybeSpawnShootingStar() {
  if (Math.random() < 0.004 && shootingStars.length < 2) {
    const startX = Math.random() * canvas.width * 0.6;
    shootingStars.push({
      x: startX,
      y: -10,
      vx: 5 + Math.random() * 3,
      vy: 3 + Math.random() * 2,
      life: 1,
    });
  }
}

function drawFrame() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#05050a";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Nebula glow blobs, slowly drifting
  for (const n of nebulae) {
    n.x += n.dx;
    n.y += n.dy;
    if (n.x < -n.r || n.x > canvas.width + n.r) n.dx *= -1;
    if (n.y < -n.r || n.y > canvas.height + n.r) n.dy *= -1;

    const grad = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.r);
    grad.addColorStop(0, `rgba(${n.color}, 0.06)`);
    grad.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Twinkling stars
  for (const s of stars) {
    s.twinkle += 0.02;
    const alpha = 0.4 + Math.sin(s.twinkle) * 0.4;
    ctx.beginPath();
    ctx.fillStyle = `rgba(245, 245, 247, ${Math.max(0.1, alpha)})`;
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fill();

    s.y += s.speed;
    if (s.y > canvas.height) {
      s.y = 0;
      s.x = Math.random() * canvas.width;
    }
  }

  // Shooting stars
  maybeSpawnShootingStar();
  shootingStars.forEach((sh) => {
    sh.x += sh.vx;
    sh.y += sh.vy;
    sh.life -= 0.02;

    const grad = ctx.createLinearGradient(sh.x, sh.y, sh.x - sh.vx * 6, sh.y - sh.vy * 6);
    grad.addColorStop(0, `rgba(255,255,255,${sh.life})`);
    grad.addColorStop(1, "rgba(255,255,255,0)");
    ctx.strokeStyle = grad;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(sh.x, sh.y);
    ctx.lineTo(sh.x - sh.vx * 6, sh.y - sh.vy * 6);
    ctx.stroke();
  });
  shootingStars = shootingStars.filter((sh) => sh.life > 0 && sh.y < canvas.height + 20);

  requestAnimationFrame(drawFrame);
}
drawFrame();

// ---------------- Mouse-follow glow ----------------
const cursorGlow = document.getElementById("cursor-glow");
let glowX = window.innerWidth / 2;
let glowY = window.innerHeight / 2;
let mouseX = glowX;
let mouseY = glowY;

document.addEventListener("mousemove", (e) => {
  mouseX = e.clientX;
  mouseY = e.clientY;
  spawnTrailDot(e.clientX, e.clientY);
});

function animateGlow() {
  glowX += (mouseX - glowX) * 0.12;
  glowY += (mouseY - glowY) * 0.12;
  cursorGlow.style.transform = `translate(${glowX}px, ${glowY}px) translate(-50%, -50%)`;
  requestAnimationFrame(animateGlow);
}
animateGlow();

// ---------------- Cursor star trail ----------------
let lastTrailTime = 0;
function spawnTrailDot(x, y) {
  const now = performance.now();
  if (now - lastTrailTime < 45) return;
  lastTrailTime = now;

  const dot = document.createElement("div");
  dot.style.position = "fixed";
  dot.style.left = `${x}px`;
  dot.style.top = `${y}px`;
  dot.style.width = "3px";
  dot.style.height = "3px";
  dot.style.borderRadius = "50%";
  dot.style.background = "var(--accent)";
  dot.style.boxShadow = "0 0 6px var(--accent)";
  dot.style.pointerEvents = "none";
  dot.style.zIndex = "3";
  dot.style.transform = "translate(-50%, -50%)";
  dot.style.transition = "opacity 0.6s ease, transform 0.6s ease";
  document.body.appendChild(dot);

  requestAnimationFrame(() => {
    dot.style.opacity = "0";
    dot.style.transform = "translate(-50%, -50%) scale(0.3)";
  });
  setTimeout(() => dot.remove(), 650);
}

// ---------------- Ripple click effect ----------------
document.addEventListener("mousedown", (e) => {
  const target = e.target.closest("button");
  if (!target) return;
  const rect = target.getBoundingClientRect();
  const ripple = document.createElement("span");
  const size = Math.max(rect.width, rect.height);
  ripple.className = "ripple";
  ripple.style.width = ripple.style.height = `${size}px`;
  ripple.style.left = `${e.clientX - rect.left - size / 2}px`;
  ripple.style.top = `${e.clientY - rect.top - size / 2}px`;

  const prevPosition = getComputedStyle(target).position;
  if (prevPosition === "static") target.style.position = "relative";
  target.style.overflow = target.style.overflow || "hidden";

  target.appendChild(ripple);
  setTimeout(() => ripple.remove(), 650);
});

// ---------------- Click sound effects (synthesized, no asset needed) ----------------
let soundEnabled = true;
let audioCtx = null;

function playClick(freq = 660) {
  if (!soundEnabled) return;
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = "square";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.05, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.08);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.08);
  } catch (err) {
    // Web Audio unavailable — fail silently, sound is a non-critical extra.
  }
}

document.addEventListener("click", (e) => {
  if (e.target.closest("button, .nav-item, .account-row")) playClick();
});

// ---------------- Toast notifications ----------------
const toastContainer = document.getElementById("toast-container");
function showToast(message, type = "info") {
  const toast = document.createElement("div");
  toast.className = "toast" + (type === "error" ? " error" : "");
  toast.textContent = message;
  toastContainer.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

// ---------------- Custom dropdown (replaces native <select> popup styling) ----------------
function enhanceSelect(selectEl) {
  if (selectEl.dataset.enhanced) {
    refreshCustomSelect(selectEl);
    return;
  }
  selectEl.dataset.enhanced = "true";

  const wrap = document.createElement("div");
  wrap.className = "custom-select";

  const trigger = document.createElement("button");
  trigger.type = "button";
  trigger.className = "custom-select-trigger";
  trigger.innerHTML = `<span class="trigger-label"></span><span class="chevron">&#9662;</span>`;

  const panel = document.createElement("div");
  panel.className = "custom-select-panel";

  wrap.appendChild(trigger);
  wrap.appendChild(panel);
  selectEl.insertAdjacentElement("afterend", wrap);

  trigger.onclick = (e) => {
    e.stopPropagation();
    document.querySelectorAll(".custom-select.open").forEach((el) => {
      if (el !== wrap) el.classList.remove("open");
    });
    wrap.classList.toggle("open");
  };

  selectEl._customWrap = wrap;
  selectEl._customPanel = panel;
  selectEl._customTrigger = trigger;

  refreshCustomSelect(selectEl);
}

function refreshCustomSelect(selectEl) {
  const panel = selectEl._customPanel;
  const trigger = selectEl._customTrigger;
  if (!panel || !trigger) return;

  panel.innerHTML = "";
  Array.from(selectEl.options).forEach((opt) => {
    const item = document.createElement("div");
    item.className = "custom-select-option" + (opt.value === selectEl.value ? " selected" : "");
    item.textContent = opt.textContent;
    item.onclick = () => {
      selectEl.value = opt.value;
      selectEl.dispatchEvent(new Event("change"));
      panel.querySelectorAll(".custom-select-option").forEach((o) => o.classList.remove("selected"));
      item.classList.add("selected");
      trigger.querySelector(".trigger-label").textContent = opt.textContent;
      selectEl._customWrap.classList.remove("open");
    };
    panel.appendChild(item);
  });

  const selectedOption = selectEl.options[selectEl.selectedIndex];
  trigger.querySelector(".trigger-label").textContent = selectedOption ? selectedOption.textContent : "";
}

document.addEventListener("click", (e) => {
  document.querySelectorAll(".custom-select.open").forEach((el) => {
    if (!el.contains(e.target)) el.classList.remove("open");
  });
});

// ---------------- Splash sequence ----------------
const screenSplash = document.getElementById("screen-splash");
const titlebar = document.getElementById("titlebar");

function finishSplash() {
  screenSplash.classList.add("fade-out");
  titlebar.classList.remove("hidden");
  setTimeout(() => screenSplash.classList.add("hidden"), 500);
}

// ---------------- Titlebar controls ----------------
document.getElementById("btn-min").onclick = () => window.arsenix.minimize();
document.getElementById("btn-close").onclick = () => window.arsenix.close();

// ---------------- Theme ----------------
const themeSelect = document.getElementById("theme-select");
const themeOverlay = document.getElementById("theme-transition-overlay");
enhanceSelect(themeSelect);

function applyTheme(theme) {
  document.body.dataset.theme = theme;
  themeSelect.value = theme;
  refreshCustomSelect(themeSelect);
}

// Wraps a theme change in a brief fade-to-black transition so switching
// feels like a deliberate, premium moment instead of an instant snap.
function transitionTheme(applyFn) {
  themeOverlay.classList.add("active");
  setTimeout(() => {
    applyFn();
    setTimeout(() => themeOverlay.classList.remove("active"), 60);
  }, 350);
}

themeSelect.onchange = () => {
  transitionTheme(async () => {
    applyTheme(themeSelect.value);
    await window.arsenix.setSettings({ theme: themeSelect.value });
  });
};

// ---------------- Discord ----------------
document.getElementById("btn-discord").onclick = () => window.arsenix.openDiscord();

// ---------------- State ----------------
let currentAuth = null; // mclc authorization object used for launching
let knownAccounts = []; // [{ uuid, name }]

const screenLogin = document.getElementById("screen-login");
const screenHome = document.getElementById("screen-home");
const loginError = document.getElementById("login-error");
const btnLogin = document.getElementById("btn-login");

function avatarUrl(uuid) {
  return `https://mc-heads.net/avatar/${uuid}/40`;
}

function renderAccountList() {
  const list = document.getElementById("account-list");
  list.innerHTML = "";
  knownAccounts.forEach((acc) => {
    const row = document.createElement("div");
    row.className = "account-row" + (currentAuth && currentAuth.uuid === acc.uuid ? " current" : "");

    const img = document.createElement("img");
    img.src = avatarUrl(acc.uuid);
    row.appendChild(img);

    const name = document.createElement("span");
    name.textContent = acc.name;
    row.appendChild(name);

    const remove = document.createElement("button");
    remove.className = "remove-account";
    remove.textContent = "Remove";
    remove.onclick = async (e) => {
      e.stopPropagation();
      knownAccounts = await window.arsenix.removeAccount(acc.uuid);
      renderAccountList();
    };
    row.appendChild(remove);

    row.onclick = async () => {
      if (currentAuth && currentAuth.uuid === acc.uuid) return;
      const result = await window.arsenix.switchAccount(acc.uuid);
      if (result.success) {
        currentAuth = result.mclc;
        knownAccounts = result.accounts;
        showHome(result);
        document.getElementById("account-dropdown").classList.add("hidden");
        showToast(`Switched to ${result.name}`);
      } else {
        loginError.textContent = result.error || "Could not switch account.";
        showToast(result.error || "Could not switch account.", "error");
      }
    };

    list.appendChild(row);
  });
}

function showHome(profile) {
  document.getElementById("player-name").textContent = profile.name;
  document.getElementById("player-avatar").src = avatarUrl(profile.uuid);
  if (profile.accounts) knownAccounts = profile.accounts;
  renderAccountList();
  screenLogin.classList.add("hidden");
  screenHome.classList.remove("hidden");
}

// Splash -> try silent login on startup (saved session)
(async () => {
  const settings = await window.arsenix.getSettings();
  soundEnabled = settings.soundEffects;
  applyTheme(settings.theme || "void");

  const saved = await window.arsenix.checkAuth();
  finishSplash();

  if (saved) {
    currentAuth = saved.mclc;
    showHome(saved);
  } else {
    screenLogin.classList.remove("hidden");
  }

  loadVersions();
})();

btnLogin.onclick = async () => {
  loginError.textContent = "";
  btnLogin.disabled = true;
  btnLogin.querySelector(".btn-label").textContent = "Signing in...";

  const result = await window.arsenix.login();

  btnLogin.disabled = false;
  btnLogin.querySelector(".btn-label").textContent = "Sign in with Microsoft";

  if (result.success) {
    currentAuth = result.mclc;
    showHome(result);
  } else {
    loginError.textContent = result.error || "Login failed. Please try again.";
  }
};

document.getElementById("btn-add-account").onclick = async () => {
  const result = await window.arsenix.login();
  if (result.success) {
    currentAuth = result.mclc;
    showHome(result);
  }
};

document.getElementById("btn-logout").onclick = async () => {
  await window.arsenix.logout();
  currentAuth = null;
  knownAccounts = [];
  screenHome.classList.add("hidden");
  screenLogin.classList.remove("hidden");
  showToast("Signed out.");
};

// ---------------- Account dropdown toggle ----------------
document.getElementById("profile-toggle").onclick = () => {
  document.getElementById("account-dropdown").classList.toggle("hidden");
};

document.addEventListener("click", (e) => {
  const dropdown = document.getElementById("account-dropdown");
  const toggle = document.getElementById("profile-toggle");
  if (!dropdown.contains(e.target) && !toggle.contains(e.target)) {
    dropdown.classList.add("hidden");
  }
});

// ---------------- Tabs (with fade/slide transition) ----------------
document.querySelectorAll(".nav-item").forEach((btn) => {
  btn.onclick = () => {
    document.querySelectorAll(".nav-item").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");

    document.querySelectorAll(".tab").forEach((t) => {
      t.classList.remove("active", "show");
    });

    const target = document.getElementById(`tab-${btn.dataset.tab}`);
    target.classList.add("active");
    requestAnimationFrame(() => {
      requestAnimationFrame(() => target.classList.add("show"));
    });
  };
});

// ---------------- Versions ----------------
const versionSelect = document.getElementById("version-select");
const loaderSelect = document.getElementById("loader-select");
const showSnapshots = document.getElementById("show-snapshots");
let versionData = { releases: [], snapshots: [] };

enhanceSelect(loaderSelect);

async function loadVersions() {
  versionData = await window.arsenix.getVersions();
  populateVersions();
}

function populateVersions() {
  const previousValue = versionSelect.value;
  versionSelect.innerHTML = "";

  const list = showSnapshots.checked
    ? [...versionData.releases, ...versionData.snapshots]
    : versionData.releases;

  list.forEach((id) => {
    const opt = document.createElement("option");
    opt.value = id;
    opt.textContent = id;
    versionSelect.appendChild(opt);
  });

  if (list.includes(previousValue)) versionSelect.value = previousValue;
  enhanceSelect(versionSelect);
}

showSnapshots.onchange = populateVersions;

// ---------------- Settings ----------------
const ramSlider = document.getElementById("ram-slider");
const ramValue = document.getElementById("ram-value");
const gameDirField = document.getElementById("game-dir");
const closeOnLaunchBox = document.getElementById("close-on-launch");
const soundEffectsBox = document.getElementById("sound-effects");
const serverAddressInput = document.getElementById("server-address");
const performanceModeBox = document.getElementById("performance-mode");
const lowEndPresetBox = document.getElementById("low-end-preset");
const discordPresenceBox = document.getElementById("discord-presence");

const ramTotalLabel = document.getElementById("ram-total-label");

async function loadSettings() {
  const settings = await window.arsenix.getSettings();
  const sysInfo = await window.arsenix.getSystemInfo();

  // Cap the slider to what the PC actually has, so nobody can drag it
  // past their real available memory.
  ramSlider.max = Math.max(1, sysInfo.totalRamGB - 1);
  ramTotalLabel.textContent = `of ${sysInfo.totalRamGB} GB total`;

  ramSlider.value = settings.ram;
  ramValue.textContent = settings.ram;
  gameDirField.value = settings.gameDir;
  closeOnLaunchBox.checked = settings.closeOnLaunch;
  soundEffectsBox.checked = settings.soundEffects;
  serverAddressInput.value = settings.serverAddress || "";
  performanceModeBox.checked = settings.performanceMode;
  lowEndPresetBox.checked = settings.lowEndPreset;
  discordPresenceBox.checked = settings.discordPresence;
  soundEnabled = settings.soundEffects;
  applyTheme(settings.theme || "void");
  loaderSelect.value = settings.loader || "vanilla";
  refreshCustomSelect(loaderSelect);
  if (versionData.releases.length) {
    versionSelect.value = settings.version;
    refreshCustomSelect(versionSelect);
  }
}
loadSettings();

ramSlider.oninput = () => (ramValue.textContent = ramSlider.value);

document.getElementById("btn-save-settings").onclick = async () => {
  soundEnabled = soundEffectsBox.checked;
  await window.arsenix.setSettings({
    ram: Number(ramSlider.value),
    closeOnLaunch: closeOnLaunchBox.checked,
    soundEffects: soundEffectsBox.checked,
    version: versionSelect.value,
    versionType: showSnapshots.checked ? "snapshot" : "release",
    theme: themeSelect.value,
    serverAddress: serverAddressInput.value.trim(),
    loader: loaderSelect.value,
    performanceMode: performanceModeBox.checked,
    lowEndPreset: lowEndPresetBox.checked,
    discordPresence: discordPresenceBox.checked,
  });
  showToast("Settings saved.");
  refreshServerStatus();
};

// ---------------- Music player (local files only) ----------------
const audioPlayer = document.getElementById("audio-player");
const miniPlayer = document.getElementById("mini-player");
const miniPlayPause = document.getElementById("mini-play-pause");
const miniTrackName = document.getElementById("mini-track-name");
const miniProgressFill = document.getElementById("mini-progress-fill");
const miniNext = document.getElementById("mini-next");
const npTrackName = document.getElementById("np-track-name");
const npPlayPause = document.getElementById("np-play-pause");
const npPrev = document.getElementById("np-prev");
const npNext = document.getElementById("np-next");
const npVolume = document.getElementById("np-volume");
const playlistList = document.getElementById("playlist-list");

let playlist = [];
let currentTrackIndex = -1;

async function loadPlaylist() {
  const settings = await window.arsenix.getSettings();
  playlist = settings.musicPlaylist || [];
  renderPlaylist();
}

function renderPlaylist() {
  playlistList.innerHTML = "";
  if (!playlist.length) {
    playlistList.innerHTML = '<div class="mods-empty">No songs added yet.</div>';
    return;
  }
  playlist.forEach((track, i) => {
    const row = document.createElement("div");
    row.className = "mod-card playlist-row" + (i === currentTrackIndex ? " playing" : "");

    const info = document.createElement("div");
    info.className = "mod-card-info";
    info.innerHTML = `<div class="mod-card-title">${track.name}</div>`;
    info.onclick = () => playTrack(i);
    row.appendChild(info);

    const removeBtn = document.createElement("button");
    removeBtn.className = "danger";
    removeBtn.textContent = "Remove";
    removeBtn.onclick = async (e) => {
      e.stopPropagation();
      playlist.splice(i, 1);
      if (currentTrackIndex === i) stopPlayback();
      await window.arsenix.setSettings({ musicPlaylist: playlist });
      renderPlaylist();
    };
    row.appendChild(removeBtn);

    playlistList.appendChild(row);
  });
}

function playTrack(index) {
  if (index < 0 || index >= playlist.length) return;
  currentTrackIndex = index;
  audioPlayer.src = playlist[index].url;
  audioPlayer.play();
  updateNowPlayingUI();
  renderPlaylist();
}

function stopPlayback() {
  audioPlayer.pause();
  audioPlayer.src = "";
  currentTrackIndex = -1;
  updateNowPlayingUI();
}

function updateNowPlayingUI() {
  const track = playlist[currentTrackIndex];
  const name = track ? track.name : "No track";
  const isPlaying = track && !audioPlayer.paused;

  miniTrackName.textContent = name;
  npTrackName.textContent = track ? name : "Nothing playing";
  miniPlayer.classList.toggle("hidden", !track);

  const icon = isPlaying ? "&#10074;&#10074;" : "&#9658;";
  miniPlayPause.innerHTML = icon;
  npPlayPause.innerHTML = icon;
}

miniPlayPause.onclick = () => togglePlayPause();
npPlayPause.onclick = () => togglePlayPause();

function togglePlayPause() {
  if (currentTrackIndex === -1) {
    if (playlist.length) playTrack(0);
    return;
  }
  if (audioPlayer.paused) {
    audioPlayer.play();
  } else {
    audioPlayer.pause();
  }
  updateNowPlayingUI();
}

function nextTrack() {
  if (!playlist.length) return;
  playTrack((currentTrackIndex + 1) % playlist.length);
}

function prevTrack() {
  if (!playlist.length) return;
  playTrack((currentTrackIndex - 1 + playlist.length) % playlist.length);
}

miniNext.onclick = nextTrack;
npNext.onclick = nextTrack;
npPrev.onclick = prevTrack;

npVolume.oninput = () => {
  audioPlayer.volume = npVolume.value / 100;
};
audioPlayer.volume = npVolume.value / 100;

audioPlayer.addEventListener("timeupdate", () => {
  if (audioPlayer.duration) {
    const pct = (audioPlayer.currentTime / audioPlayer.duration) * 100;
    miniProgressFill.style.width = `${pct}%`;
  }
});

audioPlayer.addEventListener("ended", nextTrack);
audioPlayer.addEventListener("play", updateNowPlayingUI);
audioPlayer.addEventListener("pause", updateNowPlayingUI);

document.getElementById("btn-add-music").onclick = async () => {
  const files = await window.arsenix.pickMusicFiles();
  if (!files.length) return;
  playlist = [...playlist, ...files];
  await window.arsenix.setSettings({ musicPlaylist: playlist });
  renderPlaylist();
  showToast(`Added ${files.length} song(s).`);
};

loadPlaylist();

// ---------------- Resource Packs tab ----------------
const respackSearchInput = document.getElementById("respack-search-input");
const respackSearchResults = document.getElementById("respack-search-results");
const respackInstalledList = document.getElementById("respack-installed-list");
let respackSearchTimer = null;

async function refreshInstalledRespacks() {
  const gameDir = await currentGameDir();
  const packs = await window.arsenix.listRespacks(gameDir);

  respackInstalledList.innerHTML = "";
  if (!packs.length) {
    respackInstalledList.innerHTML = '<div class="mods-empty">No resource packs installed yet.</div>';
    return;
  }

  packs.forEach((pack) => {
    const card = document.createElement("div");
    card.className = "mod-card";

    const dot = document.createElement("span");
    dot.className = "status-dot" + (pack.enabled ? " online" : "");
    card.appendChild(dot);

    const info = document.createElement("div");
    info.className = "mod-card-info";
    info.innerHTML = `<div class="mod-card-title">${pack.filename}</div>`;
    card.appendChild(info);

    const toggleBtn = document.createElement("button");
    toggleBtn.textContent = pack.enabled ? "Disable" : "Enable";
    toggleBtn.onclick = async () => {
      await window.arsenix.toggleRespack({ gameDir, filename: pack.filename });
      refreshInstalledRespacks();
    };
    card.appendChild(toggleBtn);

    const removeBtn = document.createElement("button");
    removeBtn.className = "danger";
    removeBtn.textContent = "Remove";
    removeBtn.onclick = async () => {
      await window.arsenix.removeRespack({ gameDir, filename: pack.filename });
      showToast(`Removed ${pack.filename}`);
      refreshInstalledRespacks();
    };
    card.appendChild(removeBtn);

    respackInstalledList.appendChild(card);
  });
}

async function searchRespacks(query) {
  if (!query.trim()) {
    respackSearchResults.innerHTML = "";
    return;
  }
  respackSearchResults.innerHTML = '<div class="mods-empty">Searching...</div>';

  try {
    const res = await fetch(
      `https://api.modrinth.com/v2/search?query=${encodeURIComponent(query)}&facets=[["project_type:resourcepack"]]&limit=15`
    );
    const data = await res.json();

    respackSearchResults.innerHTML = "";
    if (!data.hits || !data.hits.length) {
      respackSearchResults.innerHTML = '<div class="mods-empty">No resource packs found.</div>';
      return;
    }

    data.hits.forEach((hit) => {
      const card = document.createElement("div");
      card.className = "mod-card";

      const img = document.createElement("img");
      img.src = hit.icon_url || "assets/logo.png";
      card.appendChild(img);

      const info = document.createElement("div");
      info.className = "mod-card-info";
      info.innerHTML = `<div class="mod-card-title">${hit.title}</div><div class="mod-card-desc">${hit.description || ""}</div>`;
      card.appendChild(info);

      const installBtn = document.createElement("button");
      installBtn.textContent = "Install";
      installBtn.onclick = async () => {
        installBtn.disabled = true;
        installBtn.textContent = "Installing...";
        try {
          const verRes = await fetch(`https://api.modrinth.com/v2/project/${hit.project_id}/version`);
          const versions = await verRes.json();
          if (!versions.length) {
            showToast(`No downloadable version found for ${hit.title}.`, "error");
            installBtn.disabled = false;
            installBtn.textContent = "Install";
            return;
          }
          const file = versions[0].files.find((f) => f.primary) || versions[0].files[0];
          const gameDir = await currentGameDir();
          await window.arsenix.installRespackUrl({ gameDir, url: file.url, filename: file.filename });
          showToast(`Installed ${hit.title}`);
          installBtn.textContent = "Installed";
          refreshInstalledRespacks();
        } catch (err) {
          showToast(`Failed to install ${hit.title}`, "error");
          installBtn.disabled = false;
          installBtn.textContent = "Install";
        }
      };
      card.appendChild(installBtn);

      respackSearchResults.appendChild(card);
    });
  } catch (err) {
    respackSearchResults.innerHTML = '<div class="mods-empty">Search failed. Check your internet connection.</div>';
  }
}

respackSearchInput.oninput = () => {
  clearTimeout(respackSearchTimer);
  respackSearchTimer = setTimeout(() => searchRespacks(respackSearchInput.value), 500);
};

document.getElementById("btn-add-local-pack").onclick = async () => {
  const gameDir = await currentGameDir();
  const added = await window.arsenix.installRespackLocal(gameDir);
  if (added.length) {
    showToast(`Added ${added.length} pack(s).`);
    refreshInstalledRespacks();
  }
};

refreshInstalledRespacks();

// ---------------- Mods tab ----------------
const modsSearchInput = document.getElementById("mods-search-input");
const modsSearchResults = document.getElementById("mods-search-results");
const modsInstalledList = document.getElementById("mods-installed-list");
let modsSearchTimer = null;

async function currentGameDir() {
  const settings = await window.arsenix.getSettings();
  return settings.gameDir;
}

async function refreshInstalledMods() {
  const gameDir = await currentGameDir();
  const mods = await window.arsenix.listMods(gameDir);

  modsInstalledList.innerHTML = "";
  if (!mods.length) {
    modsInstalledList.innerHTML = '<div class="mods-empty">No mods installed yet.</div>';
    return;
  }

  mods.forEach((mod) => {
    const card = document.createElement("div");
    card.className = "mod-card";

    const dot = document.createElement("span");
    dot.className = "status-dot" + (mod.enabled ? " online" : "");
    card.appendChild(dot);

    const info = document.createElement("div");
    info.className = "mod-card-info";
    info.innerHTML = `<div class="mod-card-title">${mod.filename}</div>`;
    card.appendChild(info);

    const toggleBtn = document.createElement("button");
    toggleBtn.textContent = mod.enabled ? "Disable" : "Enable";
    toggleBtn.onclick = async () => {
      await window.arsenix.toggleMod({ gameDir, raw: mod.raw });
      refreshInstalledMods();
    };
    card.appendChild(toggleBtn);

    const removeBtn = document.createElement("button");
    removeBtn.className = "danger";
    removeBtn.textContent = "Remove";
    removeBtn.onclick = async () => {
      await window.arsenix.removeMod({ gameDir, raw: mod.raw });
      showToast(`Removed ${mod.filename}`);
      refreshInstalledMods();
    };
    card.appendChild(removeBtn);

    modsInstalledList.appendChild(card);
  });
}

async function searchMods(query) {
  if (!query.trim()) {
    modsSearchResults.innerHTML = "";
    return;
  }
  modsSearchResults.innerHTML = '<div class="mods-empty">Searching...</div>';

  try {
    const res = await fetch(
      `https://api.modrinth.com/v2/search?query=${encodeURIComponent(query)}&facets=[["project_type:mod"],["categories:fabric"]]&limit=15`
    );
    const data = await res.json();

    modsSearchResults.innerHTML = "";
    if (!data.hits || !data.hits.length) {
      modsSearchResults.innerHTML = '<div class="mods-empty">No mods found.</div>';
      return;
    }

    data.hits.forEach((hit) => {
      const card = document.createElement("div");
      card.className = "mod-card";

      const img = document.createElement("img");
      img.src = hit.icon_url || "assets/logo.png";
      card.appendChild(img);

      const info = document.createElement("div");
      info.className = "mod-card-info";
      info.innerHTML = `<div class="mod-card-title">${hit.title}</div><div class="mod-card-desc">${hit.description || ""}</div>`;
      card.appendChild(info);

      const installBtn = document.createElement("button");
      installBtn.textContent = "Install";
      installBtn.onclick = async () => {
        installBtn.disabled = true;
        installBtn.textContent = "Installing...";
        try {
          const mcVersion = versionSelect.value;
          const verRes = await fetch(
            `https://api.modrinth.com/v2/project/${hit.project_id}/version?loaders=["fabric"]&game_versions=["${mcVersion}"]`
          );
          const versions = await verRes.json();
          if (!versions.length) {
            showToast(`No version of ${hit.title} matches ${mcVersion}.`, "error");
            installBtn.disabled = false;
            installBtn.textContent = "Install";
            return;
          }
          const file = versions[0].files.find((f) => f.primary) || versions[0].files[0];
          const gameDir = await currentGameDir();
          await window.arsenix.installMod({ gameDir, url: file.url, filename: file.filename });
          showToast(`Installed ${hit.title}`);
          installBtn.textContent = "Installed";
          refreshInstalledMods();
        } catch (err) {
          showToast(`Failed to install ${hit.title}`, "error");
          installBtn.disabled = false;
          installBtn.textContent = "Install";
        }
      };
      card.appendChild(installBtn);

      modsSearchResults.appendChild(card);
    });
  } catch (err) {
    modsSearchResults.innerHTML = '<div class="mods-empty">Search failed. Check your internet connection.</div>';
  }
}

modsSearchInput.oninput = () => {
  clearTimeout(modsSearchTimer);
  modsSearchTimer = setTimeout(() => searchMods(modsSearchInput.value), 500);
};

refreshInstalledMods();

// ---------------- Server status card ----------------
const serverStatusDot = document.getElementById("server-status-dot");
const serverStatusName = document.getElementById("server-status-name");
const serverStatusSub = document.getElementById("server-status-sub");

async function refreshServerStatus() {
  const settings = await window.arsenix.getSettings();
  const address = (settings.serverAddress || "").trim();

  if (!address) {
    serverStatusDot.className = "status-dot";
    serverStatusName.textContent = "No server configured";
    serverStatusSub.textContent = "Add an address in Settings to show live status";
    return;
  }

  serverStatusName.textContent = address;
  serverStatusSub.textContent = "Checking...";

  try {
    const res = await fetch(`https://api.mcsrvstat.us/3/${encodeURIComponent(address)}`);
    const data = await res.json();

    if (data.online) {
      serverStatusDot.className = "status-dot online";
      const players = data.players ? `${data.players.online}/${data.players.max} players online` : "Online";
      serverStatusSub.textContent = players;
    } else {
      serverStatusDot.className = "status-dot offline";
      serverStatusSub.textContent = "Server is offline";
    }
  } catch (err) {
    serverStatusDot.className = "status-dot";
    serverStatusSub.textContent = "Unable to reach server";
  }
}

refreshServerStatus();
setInterval(refreshServerStatus, 30000);

// ---------------- Launch ----------------
const btnPlay = document.getElementById("btn-play");
const playLabel = document.getElementById("play-label");
const progressWrap = document.getElementById("progress-wrap");
const progressFill = document.getElementById("progress-fill");
const progressText = document.getElementById("progress-text");
const logBox = document.getElementById("log-box");
const crashBanner = document.getElementById("crash-banner");
const rocketWrap = document.getElementById("rocket-wrap");
const btnForceStop = document.getElementById("btn-force-stop");
let lastCrashFile = null;
let lastLogLine = null;
let lastLogRepeatCount = 0;
let lastLogLineEl = null;

function spawnSmokePuffs() {
  const rect = btnPlay.getBoundingClientRect();
  const baseX = rect.left + rect.width / 2;
  const baseY = rect.top;
  for (let i = 0; i < 6; i++) {
    setTimeout(() => {
      const puff = document.createElement("div");
      puff.className = "smoke-puff";
      const size = 6 + Math.random() * 8;
      puff.style.width = `${size}px`;
      puff.style.height = `${size}px`;
      puff.style.left = `${baseX + (Math.random() - 0.5) * 24}px`;
      puff.style.top = `${baseY + (Math.random() - 0.5) * 6}px`;
      document.body.appendChild(puff);
      setTimeout(() => puff.remove(), 1000);
    }, i * 90);
  }
}

btnPlay.onclick = async () => {
  if (!currentAuth) return;

  rocketWrap.classList.remove("launch");
  void rocketWrap.offsetWidth; // restart animation
  rocketWrap.classList.add("launch");
  spawnSmokePuffs();

  crashBanner.classList.add("hidden");
  btnPlay.disabled = true;
  playLabel.textContent = "LAUNCHING...";
  progressWrap.classList.remove("hidden");
  logBox.classList.remove("hidden");
  logBox.textContent = "";
  lastLogLine = null;
  lastLogRepeatCount = 0;
  lastLogLineEl = null;
  btnForceStop.classList.remove("hidden");

  const settings = await window.arsenix.getSettings();

  await window.arsenix.launchGame({
    authorization: currentAuth,
    version: versionSelect.value,
    versionType: showSnapshots.checked ? "snapshot" : "release",
    ram: settings.ram,
    gameDir: settings.gameDir,
    loader: loaderSelect.value,
  });
  // Note: the launcher window is hidden/shown automatically by the main
  // process once the game actually starts (see "closeOnLaunch" setting),
  // so no close call is made from here.
};

btnForceStop.onclick = async () => {
  await window.arsenix.forceStop();
  showToast("Stopped the game process.");
};

window.arsenix.onProgress((data) => {
  if (data && data.total) {
    const pct = Math.min(100, Math.round((data.task / data.total) * 100));
    progressFill.style.width = `${pct}%`;
    progressText.textContent = `Downloading ${data.type || "files"}... ${pct}%`;
  }
});


const GL_SPAM_PATTERN = /opengl debug message|gl_invalid_operation|gl error/i;

window.arsenix.onLog((line) => {
  const text = String(line);

  // GPU driver debug spam (harmless but extremely noisy on some systems) —
  // keep it out of the visible log entirely rather than trying to collapse
  // it, since it can fire dozens of times per second.
  if (GL_SPAM_PATTERN.test(text)) return;

  if (text === lastLogLine && lastLogLineEl) {
    // Collapse repeated spam (e.g. GPU driver GL error floods on shutdown)
    // into a single growing counter instead of flooding the DOM forever.
    lastLogRepeatCount++;
    lastLogLineEl.textContent = `${text}  (x${lastLogRepeatCount})`;
  } else {
    lastLogLine = text;
    lastLogRepeatCount = 1;
    const lineEl = document.createElement("div");
    lineEl.textContent = text;
    logBox.appendChild(lineEl);
    lastLogLineEl = lineEl;

    // Cap total rendered lines so the log box can't grow unbounded and
    // make the UI feel sluggish/stuck during a long or spammy session.
    while (logBox.childNodes.length > 400) {
      logBox.removeChild(logBox.firstChild);
    }
  }

  logBox.scrollTop = logBox.scrollHeight;
  if (text.toLowerCase().includes("launching")) {
    playLabel.textContent = "RUNNING";
    progressText.textContent = "Minecraft is running.";
  }
});

window.arsenix.onClosed(() => {
  btnPlay.disabled = false;
  playLabel.textContent = "PLAY";
  progressWrap.classList.add("hidden");
  btnForceStop.classList.add("hidden");
});

window.arsenix.onCrash((data) => {
  lastCrashFile = data.file;
  document.getElementById("crash-reason").textContent = data.reason || "Minecraft closed unexpectedly.";
  crashBanner.classList.remove("hidden");
  showToast(data.reason || "Minecraft closed unexpectedly.", "error");
});

document.getElementById("btn-dismiss-crash").onclick = () => {
  crashBanner.classList.add("hidden");
};

document.getElementById("btn-copy-crash").onclick = async () => {
  if (!lastCrashFile) return;
  await navigator.clipboard.writeText(lastCrashFile);
  const btn = document.getElementById("btn-copy-crash");
  const original = btn.textContent;
  btn.textContent = "Path copied";
  setTimeout(() => (btn.textContent = original), 1500);
};
