# Building, packaging and releasing

Open this when changing `build.bat` or the `build` section of `package.json`, the Electron or Node version, when a build error
appears, or when files are saved into the owner's folder. The per-update checklist is in `CLAUDE.md`.

## Packaging identity

- **Keep `appId` `com.stickypins.app` and `setAppUserModelId('com.stickypins.app')`.** They make the
  CosmoNotes installer replace the old Sticky Pins install and keep the "Start with Windows" entry.
  Changing them would leave two apps installed.
- Electron version is `^39` in package.json, installed on the owner's PC by `build.bat`.

## Node.js for building

- **Node.js for building: 22.12 or newer.** `@electron/rebuild` 4.2.1 (pulled in by electron-builder 26) requires
  `>=22.12.0`; older Node fails (on Node 14: `stream/promises` missing). `build.bat` checks major.minor; if Node is
  missing or older, it downloads Node 22.14.0 into `tools\node` and prepends it to `PATH` for that run only, never
  changing the system Node. If electron-builder ever needs a newer Node, raise the version in both the check and
  the download URL in `build.bat`.

## Smart App Control (SAC)

- **Smart App Control (SAC) – never modify CosmoNotes.exe.** The owner's PC has SAC **On**: it left
  Evaluation by itself, and switching it off is permanent on that PC until the April 2026 rollout reaches it.
  SAC blocks unknown, unsigned programs, and we have no code-signing certificate. Electron's own `electron.exe`
  *is* trusted (proved with `test-run.bat`). So the build must leave `CosmoNotes.exe` byte-identical to
  `node_modules\electron\dist\electron.exe`:
  - `build.disableAsarIntegrity: true` stops electron-builder embedding the asar hash (resedit) in the exe.
  - `win.signAndEditExecutable: false` stops it editing the icon/version (rcedit).
  - No afterPack / rcedit / resedit / fuses (`electronFuses`) or anything else that touches the exe.
  - The exe shows Electron's icon, so `build/installer.nsh` re-points the shortcuts to `resources\icon.ico`.
  - `build.bat` verifies this with `fc /b` after each build. If it ever says the files differ, fix the build.
  Changing the Electron version gives a new electron.exe. That's fine as long as it's an official release
  (also widely trusted), but check that it starts. The installer (`CosmoNotes Setup.exe`) and the uninstaller are
  NSIS exes; so far SAC has allowed them. If SAC ever blocks the installer, an alternative is copying
  `dist\win-unpacked` into `%LOCALAPPDATA%\Programs\sticky-pins` (the install folder kept its old name).

## Build errors

- **Build gotcha (`spawn UNKNOWN`)**: near the end, electron-builder runs a small helper exe it just made
  (`dist\<Setup name>.exe`) to create the uninstaller. Windows Security or SAC can refuse to start it. `build.bat`
  retries once, then explains. It happened once (1.0.3), most likely when SAC switched itself on.
- **Don't look inside `app.asar` from the Claude desktop app's file tools.** That app is Electron too, and keeps the
  archive open, which breaks the next build (`EBUSY ... app.asar`) until the Claude app is restarted.
- **Build gotcha (`EBUSY ... app.asar` from a running app)**: the same error also appears when CosmoNotes itself
  (the tray icon, a `test-run.bat` window, or an install running from `dist\win-unpacked`) or an Explorer preview /
  antivirus scan has the archive open. Quit the app fully, end any `CosmoNotes.exe` / `electron.exe` in Task Manager,
  delete `dist\win-unpacked`, then run `build.bat` again. It is not a code bug.

## Saving files to the owner's folder

- **Saving files to the owner's folder can fail silently (stale writes)**: when files are written to
  `C:\Workspaces\CosmoNotes` through the Claude desktop app's folder bridge (`device_commit_files`), the call can report
  success while the file on disk still has the OLD content (seen several times in 1.1.23: `note.js`, `note.css`,
  `list.css`, `CHANGELOG.md`). The owner then builds from stale files and the "fixed" bug is still there. Always:
  copy to the outputs folder, wait a moment, commit (use `force: true` if the mtime guard blocks it), **stage the
  file back from the device and compare its sha256 (or size) with the copy you meant to save** – never trust the
  success message alone. Do the same for every file of a round, and tell the owner honestly if a write did not land.
