// Installs the Fabric mod loader headlessly (no GUI) using Fabric's official
// installer jar, so the launcher can offer modded play without the user
// ever touching a separate installer.
const path = require("path");
const fs = require("fs");
const https = require("https");
const { execFile } = require("child_process");

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { "User-Agent": "ArsenixLauncher" } }, (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => {
          try {
            resolve(JSON.parse(data));
          } catch (err) {
            reject(err);
          }
        });
      })
      .on("error", reject);
  });
}

function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        if (res.statusCode !== 200) return reject(new Error(`Download failed (${res.statusCode})`));
        const file = fs.createWriteStream(destPath);
        res.pipe(file);
        file.on("finish", () => file.close(() => resolve()));
      })
      .on("error", reject);
  });
}

function profileIdFor(mcVersion, loaderVersion) {
  return `fabric-loader-${loaderVersion}-${mcVersion}`;
}

function isInstalled(gameDir, mcVersion, loaderVersion) {
  const id = profileIdFor(mcVersion, loaderVersion);
  const jsonPath = path.join(gameDir, "versions", id, `${id}.json`);
  return fs.existsSync(jsonPath);
}

// Ensures a Fabric profile exists for the given Minecraft version, installing
// it via the official Fabric installer if needed. Returns the profile id to
// pass as version.custom to minecraft-launcher-core.
async function ensureFabric(gameDir, javaPath, mcVersion, onLog) {
  const loaderMeta = await fetchJson(`https://meta.fabricmc.net/v2/versions/loader/${mcVersion}`);
  if (!loaderMeta || !loaderMeta.length) {
    throw new Error(`No Fabric loader available for Minecraft ${mcVersion}.`);
  }
  const loaderVersion = loaderMeta[0].loader.version;

  if (isInstalled(gameDir, mcVersion, loaderVersion)) {
    onLog && onLog("Fabric already installed for this version.");
    return profileIdFor(mcVersion, loaderVersion);
  }

  onLog && onLog("Installing Fabric loader...");

  const installerMeta = await fetchJson("https://meta.fabricmc.net/v2/versions/installer");
  const installerVersion = installerMeta[0].version;
  const installerUrl = `https://maven.fabricmc.net/net/fabricmc/fabric-installer/${installerVersion}/fabric-installer-${installerVersion}.jar`;

  fs.mkdirSync(gameDir, { recursive: true });
  const installerPath = path.join(gameDir, "fabric-installer.jar");
  await downloadFile(installerUrl, installerPath);

  await new Promise((resolve, reject) => {
    execFile(
      javaPath,
      ["-jar", installerPath, "client", "-dir", gameDir, "-mcversion", mcVersion, "-loader", loaderVersion, "-noprofile"],
      (err, stdout, stderr) => {
        if (err) return reject(new Error(stderr || err.message));
        resolve();
      }
    );
  });

  fs.unlinkSync(installerPath);

  if (!isInstalled(gameDir, mcVersion, loaderVersion)) {
    throw new Error("Fabric installer finished but the profile was not found.");
  }

  onLog && onLog("Fabric installed.");
  return profileIdFor(mcVersion, loaderVersion);
}

module.exports = { ensureFabric };
