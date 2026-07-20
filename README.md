# Arsenix Launcher

A free, open-source, premium Minecraft launcher — built with Electron.

Sign in with your own Microsoft account, launch vanilla or Fabric-modded
Minecraft, manage mods and resource packs, and tune performance for
low-end PCs — all from one clean, dark, space-themed interface.

100% open source. No ads. No telemetry. No cracked/offline login support —
Microsoft accounts only, exactly like the official launcher.

Made by ReducedG.

---

## Why trust this?

This is a small, community project, so Windows SmartScreen may warn that
the app is from an "Unknown Publisher" the first time you run it. That's
normal for any free app that hasn't paid for a code-signing certificate —
it does not mean the app is unsafe. To verify it yourself:

- Read the source — every line of code in this repository is what
  actually ships in the .exe. Nothing is hidden.
- Check the build logs — every release is built automatically by
  GitHub Actions straight from this public code, on GitHub's own
  servers. You can read the exact build log for any release under the
  Actions tab.
- Scan it yourself — run any release .exe through VirusTotal before
  installing.

If SmartScreen blocks it: click More info, then Run anyway.

---

## Features

- Microsoft account login (via official OAuth) — multiple accounts,
  quick switching, no re-login needed
- Vanilla + Fabric — pick any release/snapshot version, or switch to
  Fabric and the launcher installs the loader automatically
- Automatic Java — detects Java already on your PC, or downloads the
  right version for you, no manual setup
- Mod manager — search and install Fabric mods (via Modrinth), enable
  or disable them, remove them — all from the UI
- Resource pack manager — same, for resource packs, applied
  automatically on launch
- Performance tuning — recommended JVM flags, a low-end FPS preset,
  automatic RAM suggestion based on your PC's actual specs, and a
  background-suspend mode so the launcher gets out of the game's way
- Crash analyzer — turns cryptic crash logs into plain-language
  explanations
- Discord Rich Presence — optional, shows your current activity
- Local music player — play your own music files while browsing
  (no bundled/copyrighted audio)
- Dark, space-themed UI — with multiple accent themes

---

## Download

Grab the latest installer from the Releases page (top right of this
repository) — Arsenix-Launcher-Setup-X.X.X.exe. Just run it and follow
the setup wizard, no other software required.

## Building from source

Requirements: Node.js (LTS).

```
git clone https://github.com/ayushextra/arsenix-launcher.git
cd arsenix-launcher
npm install
npm start
npm run build
```

Note: on Windows, antivirus real-time protection can sometimes block
`npm run build` (it uses a small tool called rcedit to set the app
icon). If the build fails with a spawn UNKNOWN error, add the project
folder to your antivirus exclusions and try again.

---

## Contributing

Issues and pull requests are welcome. If you're adding a feature, please
keep it legal (no piracy/cracked-account support of any kind — Microsoft
login only) and consistent with the existing dark space theme.

## License

GPL-3.0 — free to use and modify, but any distributed version (including
forks) must also stay open-source under GPL-3.0. See the LICENSE file.

## Community

Join the Discord server for support and updates:
https://discord.gg/CM8a87nhYA
