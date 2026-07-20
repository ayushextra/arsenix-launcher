// Finds a usable Java on the system, or downloads a matching JRE
// automatically (via Adoptium) if none is found — so the user never has to
// install Java manually. Also fixes the "console window flashes next to the
// game" issue by preferring javaw.exe over java.exe on Windows.
const { app } = require("electron");
const path = require("path");
const fs = require("fs");
const https = require("https");
const { execFile } = require("child_process");
const extract = require("extract-zip");

function javaDir() {
  return path.join(app.getPath("userData"), "java");
}

// Rough, well-known mapping of Minecraft version -> required Java major
// version. Good enough to pick a working runtime for the vast majority of
// versions without needing a full per-version compatibility table.
function requiredJavaMajor(mcVersion) {
  const parts = String(mcVersion).split(".").map((n) => parseInt(n, 10) || 0);
  const [, minor = 0, patch = 0] = parts;
  if (minor >= 21) return 21;
  if (minor === 20 && patch >= 5) return 21;
  if (minor >= 17) return 17;
  return 8;
}

// Runs `java -version` and parses the major version number from its output,
// e.g. `openjdk version "21.0.1"` -> 21, or the legacy `1.8.0_351` -> 8.
function getJavaMajorVersion(javaExecPath) {
  return new Promise((resolve) => {
    execFile(javaExecPath, ["-version"], (err, stdout, stderr) => {
      const output = `${stdout || ""}${stderr || ""}`;
      const match = output.match(/version "(\d+)(?:\.(\d+))?/);
      if (!match) return resolve(null);
      const first = parseInt(match[1], 10);
      // Old versioning scheme: "1.8.0_xxx" means Java 8, "1.7.0" means 7, etc.
      if (first === 1 && match[2]) return resolve(parseInt(match[2], 10));
      resolve(first);
    });
  });
}

function findSystemJava() {
  return new Promise((resolve) => {
    const cmd = process.platform === "win32" ? "where" : "which";
    execFile(cmd, ["java"], (err, stdout) => {
      if (err || !stdout) return resolve(null);
      const firstPath = stdout.split(/\r?\n/)[0].trim();
      resolve(firstPath || null);
    });
  });
}

// java.exe is a console-subsystem executable, so Windows attaches a
// console window whenever it's spawned. javaw.exe is the identical
// windowless (GUI-subsystem) build — using it avoids the flashing CMD
// window entirely, with no change in behavior otherwise.
function preferWindowless(javaExecPath) {
  if (process.platform !== "win32") return javaExecPath;
  const dir = path.dirname(javaExecPath);
  const javaw = path.join(dir, "javaw.exe");
  return fs.existsSync(javaw) ? javaw : javaExecPath;
}

function platformKey() {
  const plat = process.platform === "win32" ? "windows" : process.platform === "darwin" ? "mac" : "linux";
  const arch = process.arch === "arm64" ? "aarch64" : "x64";
  return { plat, arch };
}

function bundledJavaExec(majorVersion) {
  const dir = path.join(javaDir(), String(majorVersion));
  if (!fs.existsSync(dir)) return null;
  const entries = fs.readdirSync(dir).filter((e) => fs.statSync(path.join(dir, e)).isDirectory());
  if (!entries.length) return null;
  const root = entries[0];
  const binDir = process.platform === "darwin"
    ? path.join(dir, root, "Contents", "Home", "bin")
    : path.join(dir, root, "bin");
  const exec = process.platform === "win32" ? "java.exe" : "java";
  const execPath = path.join(binDir, exec);
  return fs.existsSync(execPath) ? execPath : null;
}

function downloadFile(url, destPath, onProgress) {
  return new Promise((resolve, reject) => {
    const request = (dlUrl, redirects = 0) => {
      if (redirects > 5) return reject(new Error("Too many redirects"));
      https.get(dlUrl, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return request(res.headers.location, redirects + 1);
        }
        if (res.statusCode !== 200) {
          return reject(new Error(`Download failed with status ${res.statusCode}`));
        }
        const total = parseInt(res.headers["content-length"] || "0", 10);
        let downloaded = 0;
        const file = fs.createWriteStream(destPath);
        res.on("data", (chunk) => {
          downloaded += chunk.length;
          if (onProgress && total) onProgress(downloaded / total);
        });
        res.pipe(file);
        file.on("finish", () => file.close(() => resolve()));
        file.on("error", reject);
      }).on("error", reject);
    };
    request(url);
  });
}

async function downloadAndInstallJava(majorVersion, onProgress) {
  const { plat, arch } = platformKey();
  const url = `https://api.adoptium.net/v3/binary/latest/${majorVersion}/ga/${plat}/${arch}/jre/hotspot/normal/eclipse`;
  const destDir = path.join(javaDir(), String(majorVersion));
  fs.mkdirSync(destDir, { recursive: true });
  const archivePath = path.join(destDir, plat === "windows" ? "jre.zip" : "jre.tar.gz");

  await downloadFile(url, archivePath, onProgress);

  if (plat === "windows") {
    await extract(archivePath, { dir: destDir });
  } else {
    await new Promise((resolve, reject) => {
      execFile("tar", ["-xzf", archivePath, "-C", destDir], (err) => (err ? reject(err) : resolve()));
    });
  }
  fs.unlinkSync(archivePath);

  const execPath = bundledJavaExec(majorVersion);
  if (!execPath) throw new Error("Java installation finished but the executable could not be found.");
  return execPath;
}

// Returns a ready-to-use java executable path. Prefers whatever Java is
// already installed on the system, but only if it's actually new enough for
// the selected Minecraft version — an old Java 8 install on PATH (common,
// e.g. from other software) must not be used to launch a version that needs
// Java 17/21, or the game fails with UnsupportedClassVersionError.
async function ensureJava(mcVersion, onLog, onProgress) {
  const requiredMajor = requiredJavaMajor(mcVersion);
  const system = await findSystemJava();

  if (system) {
    const systemMajor = await getJavaMajorVersion(system);
    if (systemMajor && systemMajor >= requiredMajor) {
      onLog && onLog(`Using system Java ${systemMajor}.`);
      return preferWindowless(system);
    }
    onLog && onLog(
      systemMajor
        ? `System Java ${systemMajor} is too old for this version (needs Java ${requiredMajor}) — using a separate matching version instead.`
        : `Could not verify system Java's version — using a separate matching version instead.`
    );
  }

  const existing = bundledJavaExec(requiredMajor);
  if (existing) {
    onLog && onLog(`Using previously downloaded Java ${requiredMajor}.`);
    return preferWindowless(existing);
  }

  onLog && onLog(`Downloading Java ${requiredMajor} automatically...`);
  const execPath = await downloadAndInstallJava(requiredMajor, onProgress);
  onLog && onLog("Java installed.");
  return preferWindowless(execPath);
}

module.exports = { ensureJava, requiredJavaMajor };
