# CosmoNotes – context for AI assistants and developers

**Last updated: 30 October 2026 · App version 1.1.23**

Start with `CLAUDE.md` (rules, commands, pitfalls, release checklist). This file is the map: what the app is,
how the folder is laid out, and which `ai-context/` file to open for the job in hand. Open only the files your
task needs. Keep the "Last updated" line above current on every update.

> ## ⭐ Versioning rule (the owner's instruction)
> **Every update raises the version number**, unless the owner says not to.
> - Always raise the **third digit** (1.0.2 → 1.0.3 → 1.0.4 …).
> - The **first or second digit** only goes up when the owner says so.
> - Each version gets an entry, with its date and what changed, in **`src/about.js` → `VERSIONS`** (shown in the
>   app under Settings → About CosmoNotes → Version history), in **`CHANGELOG.md`**, and in the "Last updated"
>   line above. The full checklist is in `CLAUDE.md`.

---

## What this is

CosmoNotes is a Windows desktop sticky-notes app (Electron), a cuter and more trustworthy replacement
for Microsoft Sticky Notes. It was called **Sticky Pins** in 1.0.0.

**The owner's priorities, in order:**
1. **Never lose a note.** This is the reason the app exists: Microsoft's app lost their notes through
   cloud sync. Everything is local, saved instantly, crash-safe and backed up daily. Never add cloud
   sync, accounts or anything that could overwrite or delete data without an explicit user action.
2. **Notes stay put.** Pinned notes stay on top and won't minimise. Notes reopen in the same spots
   after a restart.
3. **Cute, like real paper sticky notes:** pastel paper colours, a handwritten font option, little
   touches (tilted cards, pins, clips). Keep this design language.
4. **Simple surface, power behind one button.** Basic formatting is always visible; complex things
   (photos, voice, drawing…) live behind **+ Add**.

**The owner** is not a programmer. They build the installer by double-clicking `build.bat` and install
`dist/CosmoNotes Setup <version>.exe` on their laptops. Explain things in plain language. The project is a git
repo (public on GitHub: `vkashirski/CosmoNotes`); on the owner's PC it's at `C:\Workspaces\CosmoNotes` (it used
to be `C:\Users\User\Desktop\Sticky Pins\Sticky Pins`). They want edits made **in that folder, in place**, not
as new copies. Keep each file's existing line endings (they are mixed: see CLAUDE.md).

---

## Project layout

```
main.js            Electron main process: windows, tray, IPC, lock/password, groups, migration, spelling
store.js           All disk storage (notes, groups, settings, attachments, backups). No Electron imports.
preload.js         Safe bridge: exposes window.sticky.* to both windows (contextIsolation + sandbox)
src/note.html/.css/.js   One sticky-note window (the editor)
src/list.html/.css/.js   The "All notes" window: Notes / Bin / Settings tabs, groups, sorting
src/about.js       In-app feature list + version history (window.COSMO_ABOUT) + LAST_UPDATED date
src/fx.js          Note effects + mouse followers (window.COSMO_FX), used by both windows (see effects.md)
assets/            icon.ico/png (windows), tray.ico/png
build/             icon.ico/png for the installer/shortcuts; afterPack.js is an unused stub (see build-and-release.md, Smart App Control)
build.bat          One-click: (private Node if needed) + npm install + electron-builder → dist/CosmoNotes Setup <ver>.exe
HOW TO INSTALL.txt Plain-language guide for the owner (install, data folder, forgot password, tips)
test-run.bat       Runs CosmoNotes from this folder with Electron's original exe (no build needed)
build/installer.nsh  Installer addition: shortcuts get the CosmoNotes icon (exe stays untouched, see build-and-release.md)
CHANGELOG.md       Version history, the two newest versions (mirror of src/about.js VERSIONS)
CHANGELOG-archive.md  Older versions (1.1.21 back to 1.0.0); nothing reads it
tests/             npm test – Node tests using tests/fake-electron (no Electron/Windows needed)
CLAUDE.md         Short rules every AI session reads first (rules, commands, pitfalls, release checklist)
ai-context/        Docs for AI assistants: this map + one file per topic (table below)
tools/node/        Private Node.js 22 that build.bat downloads when the computer's Node is missing/too old (git-ignored)
```

Fonts come from npm (`@fontsource/caveat` = handwritten, `@fontsource/nunito` = rounded/UI) and are
referenced from HTML as `../node_modules/@fontsource/...`, so they work offline and are packaged.

---

## Which file to open

| You are… | Open |
|---|---|
| Changing `main.js`, `preload.js`, IPC, windows, the tray, security, or anything about locks / hidden notes | `ai-context/architecture.md` |
| Adding or changing a note field, a setting, backups, the Bin, groups or ink data | `ai-context/data-model.md` |
| Looking for where a feature lives (function, element id, CSS) | `ai-context/feature-map.md` |
| Working on the note editor, toolbars, pop-ups, drawing, the notes list or its cards | `ai-context/ui-gotchas.md` |
| Touching effects or mouse followers (`src/fx.js`) | `ai-context/effects.md` |
| Building or packaging: `build.bat`, Node / Electron version, Smart App Control, build errors, saving files into the owner's folder | `ai-context/build-and-release.md` |
| Writing or running tests, or checking the UI | `ai-context/testing.md` |

---

## Ideas mentioned or likely next

- Per-note passwords (the owner said "one password for all notes **for now**").
- Maybe: drag to reorder notes by hand (currently only sorting), and custom group icons/stickers.
- Reminders/alarms on notes, a global "new note" shortcut, and export/import to a single file (offered in 1.0.0, not chosen yet).
- **Not wanted (for now):** a "Check for updates" button (GitHub Releases + electron-updater) was discussed after
  1.1.5; the owner decided against it. If it comes back: the repo is public, the installer is unsigned (Smart App
  Control may treat a downloaded copy differently), and checking would be the app's only other network use.
