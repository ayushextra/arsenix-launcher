const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("arsenix", {
  // window controls
  minimize: () => ipcRenderer.send("window:minimize"),
  close: () => ipcRenderer.send("window:close"),

  // auth
  checkAuth: () => ipcRenderer.invoke("auth:check"),
  login: () => ipcRenderer.invoke("auth:login"),
  switchAccount: (uuid) => ipcRenderer.invoke("auth:switch", uuid),
  removeAccount: (uuid) => ipcRenderer.invoke("auth:remove", uuid),
  logout: () => ipcRenderer.invoke("auth:logout"),

  // versions
  getVersions: () => ipcRenderer.invoke("versions:list"),

  // game
  launchGame: (payload) => ipcRenderer.invoke("game:launch", payload),
  onLog: (cb) => ipcRenderer.on("game:log", (_e, data) => cb(data)),
  onProgress: (cb) => ipcRenderer.on("game:progress", (_e, data) => cb(data)),
  onClosed: (cb) => ipcRenderer.on("game:closed", (_e, code) => cb(code)),
  onCrash: (cb) => ipcRenderer.on("game:crash", (_e, data) => cb(data)),
  forceStop: () => ipcRenderer.invoke("game:force-stop"),

  // music
  pickMusicFiles: () => ipcRenderer.invoke("music:pick-files"),

  // mods
  listMods: (gameDir) => ipcRenderer.invoke("mods:list", gameDir),
  installMod: (payload) => ipcRenderer.invoke("mods:install", payload),
  toggleMod: (payload) => ipcRenderer.invoke("mods:toggle", payload),
  removeMod: (payload) => ipcRenderer.invoke("mods:remove", payload),

  // resource packs
  listRespacks: (gameDir) => ipcRenderer.invoke("respacks:list", gameDir),
  installRespackUrl: (payload) => ipcRenderer.invoke("respacks:install-url", payload),
  installRespackLocal: (gameDir) => ipcRenderer.invoke("respacks:install-local", gameDir),
  toggleRespack: (payload) => ipcRenderer.invoke("respacks:toggle", payload),
  removeRespack: (payload) => ipcRenderer.invoke("respacks:remove", payload),

  // settings
  getSettings: () => ipcRenderer.invoke("settings:get"),
  setSettings: (settings) => ipcRenderer.invoke("settings:set", settings),
  getSystemInfo: () => ipcRenderer.invoke("system:info"),

  // external
  openDiscord: () => ipcRenderer.invoke("shell:open-discord"),
});
