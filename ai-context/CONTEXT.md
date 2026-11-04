# CosmoNotes – context for AI assistants and developers

**Last updated: 4 November 2026 · App version 1.3.1**

Start with `CLAUDE.md` (rules, commands, pitfalls, release checklist). This file is the map: what the app is,
how the folder is laid out, and which `ai-context/` file to open for the job in hand. Open only the files your
task needs. Keep the "Last updated" line above current on every update.

> ## ⭐ Versioning rule (the owner's instruction)
> **Every update raises the version number**, unless the owner says not to.
> - Always raise the **third digit** (1.0.2 → 1.0.3 → 1.0.4 …).
> - The **first or second digit** only goes up when the owner says so.
> - Each version gets an entry, with its date and what changed, in **`CHANGELOG.md`** (the app shows no version
>   history since 1.1.41), plus `LAST_UPDATED` in `src/about.js` and the "Last updated" line above.
> - Version numbers were renumbered in 1.1.41: numbers written before then (code comments, test file names, these
>   files) are the old ones. Table at the top of `CHANGELOG.md`. The full checklist is in `CLAUDE.md`.

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

**The owner** is a programmer (older notes said otherwise; fixed in 1.2.4): technical detail is fine. Texts inside the
app stay short and plain. They build the installer by double-clicking `build.bat` and install
`dist/CosmoNotes Setup <version>.exe` on their laptops. The project is a git
repo (public on GitHub: `vkashirski/CosmoNotes`); on the owner's PC it's at `C:\Workspaces\CosmoNotes` (it used
to be `C:\Users\User\Desktop\Sticky Pins\Sticky Pins`). They want edits made **in that folder, in place**, not
as new copies. Keep each file's existing line endings (they are mixed: see CLAUDE.md).

---

## Project layout

```
main.js            Electron main process, entry only (1.1.27): start-up, single instance, app lifecycle. The rest is in main/:
main/              state (S.store, S.listWin, S.quitting, S.listUnlockedAll + wins) · constants (paper colours, sizes, paths) ·
                   locks (isLocked, viewOf, checkPassword) · crypt (1.1.30: encryption of locked notes, the store's sealer/opener,
                   keys, recovery key, syncSeals) · migrate (Sticky Pins folder) · settings (spelling, noteSettings, broadcastSettings) ·
                   display (fitBounds) · web (hardenContents, openExternal) · ink-geometry + ink-window (toolbars outside the note) ·
                   list-notify (notifyList) · note-state (applyState, setRolled, titles) · list-visibility (hidden-in-list rules, pushLook) ·
                   note-window (openNoteWindow, createNote, duplicateNote, bringToFront, enforcePinned) · list-window (showList, themes) ·
                   tray (buildTray, startup, pause effects) · recordings (1.2.4: voice recordings on disk while made, finished on
                   close / lock / quit, recovered after a crash) · ipc-common (senderNote, applyPatch) · ipc-notes · ipc-ink · ipc-files (+ rec:*) ·
                   ipc-groups (list:get, groups:*) · ipc-list-actions (list locks, open/close/trash/edit/apply, bin) · ipc-settings
                   (settings:set, backups) · ipc-crypt (crypt:* from Settings → Locked notes) · 1.3.1 voice to text: stt-models (the
                   model list: files, commits, sha256; where they are) · stt-engine (the hidden engine window, cosmomodel://, its
                   session) · stt-download (Best's download, Remove, .part cleanup) · ipc-stt (stt:* jobs + Settings) ·
                   ipc (registerIpc calls the eight ipc-* parts)
store.js           All disk storage (notes, groups, settings, attachments, backups). No Electron imports.
preload.js         Safe bridge: exposes window.sticky.* to both windows (contextIsolation + sandbox)
src/note.html      One sticky-note window (the editor). Its code (1.1.44): src/note/*.js, 11 parts (1.3.1) loaded in this order, sharing
                   names through window.COSMO_NOTE_KIT (K) and its V (V.note, V.settings, V.hidden, V.dirty, V.savedRange…; see
                   splitting-code.md): base (api, $, colour row, saving: collect/changed/saveNow, dates, applyLook, effects on the
                   note) · fx-format (the Effects pop-up, spelling, selection helpers: saveSel/restoreSel/insertNodes, formatting:
                   runCmd) · panels (pop-overs: openPop/closePops, header buttons, ⋯ menu, Add panel: doInsert, text panel A,
                   Undo/Redo) · content (links, picture descriptions, tables, paste/drop and cleanTree, clicks in the note) ·
                   editing (editing helpers: line joins, checklist boxes, decorate; Ctrl+F find; keyboard) · menus-voice-ink
                   (right-click menus, voice notes, drawing sketch, photo resizing) · speech (1.3.1: Speak to text, Transcribe;
                   part 7 of 11) · lock-zoom (locking, password/PIN, ask(),
                   word wrap, zoom: zoomNow/setZoom, sideways scroll) · draw-over (draw-over: inkState, renderInk, saveInk; floating
                   toolbars: movable) · ink-out (toolbars in their own little windows: barOut, inkOut/textOut; whole-stroke
                   eraser) · eraser-start (the Partial eraser, toast(), start-up: init).
                   Its styles: src/css/note-*.css, loaded by note.html in this order:
                   note-base (colours, base, top bar) · note-text (locked note, photo handle, writing area) ·
                   note-toolbars (bottom bar, pop-overs) · note-drawing (right-click menu, recording, drawing, toast, 1.1.0–1.1.10 additions) ·
                   note-effects-lock (effects, lock animation, small notes) · note-popups-find (pop-ups in the app's colours, Ctrl+F)
src/list.html      The "All notes" window: Notes / Bin / Settings tabs, groups, sorting. Its code (1.1.28): src/list/*.js, 7 parts
                   loaded in this order, sharing names through window.COSMO_LIST_KIT (K) and its V (V.tab, V.openGroup…; see
                   splitting-code.md): base (colours, themes, sizes, ICON, h(), colour row, data: load/live/groups/sorting) ·
                   cards (render, drag & drop, note/group cards, card cache, group header) · picking (favourites, Ctrl/Shift-click,
                   lock animation, the picked-cards bar) · settings-menus (Settings: new-note colours, About, backups; modal(),
                   toast(); right-click menus) · effects-design (effects on cards, Settings → Effects, Edit design) ·
                   actions-locks (Bin/delete, passwords, lock/unlock, Locked tab, group panel, folds, back/forward) ·
                   events (tabs, search, sort, sizes, settings inputs, keys, first load).
                   Its styles: src/css/list-*.css, in this order:
                   list-base (themes, title bar, tabs, search, group view, drag) · list-cards (cards, buttons, settings) ·
                   list-groups-menus (about, group looks, menus, pop-up, toast, card sizes) · list-settings-fx (window themes, folds,
                   effects, Edit design, favourites) · list-picking-edit (picked-cards bar, colour rows, Edit sheet, lock animations)
src/note.css, src/list.css  Not used since 1.1.26: only notes saying the styles moved to src/css/ (can be deleted)
src/list.js        Not used since 1.1.28: only a note saying the code moved to src/list/ (can be deleted)
src/note.js        Not used since 1.1.44: only a note saying the code moved to src/note/ (can be deleted)
src/fonts/         Augusta.ttf, the Medieval note font (1.2.1; free, by Dieter Steffmann). Binary: no line endings to keep.
src/engine/        1.3.1 voice to text: the engine page (engine.mjs, engine-core.mjs: the live session, pauses, text clean-up),
                   its preload, test-clip.wav (Test my computer), lib/ (Transformers.js + ONNX Runtime, vendored unchanged:
                   big files, never open them; README.md there says what they are). Served only through cosmomodel://
src/mic-worklet.js 1.3.1: the AudioWorklet of Speak to text (16 kHz pieces)
src/about.js       In-app feature list (window.COSMO_ABOUT.FEATURES) + LAST_UPDATED date; no version history since 1.1.41
src/fx/            Note effects + mouse followers (window.COSMO_FX), used by both windows: 8 files loaded in order (see effects.md)
src/fx.js          Not used since 1.1.24: only a note saying the code moved to src/fx/ (can be deleted)
assets/            icon.ico/png (windows), tray.ico/png
build/             icon.ico/png for the installer/shortcuts; afterPack.js is an unused stub (see build-and-release.md, Smart App Control);
                   fetch-model.js (1.3.1: build.bat gets the Standard voice model into build/models/, git-ignored, packed into resources/models/)
build.bat          One-click: (private Node if needed) + npm install + electron-builder → dist/CosmoNotes Setup <ver>.exe
HOW TO INSTALL.txt Plain-language guide for the owner (install, data folder, forgot password, tips)
test-run.bat       Runs CosmoNotes from this folder with Electron's original exe (no build needed)
build/installer.nsh  Installer addition: shortcuts get the CosmoNotes icon (exe stays untouched, see build-and-release.md)
CHANGELOG.md       Version history, the two newest versions (the only place it is kept, with the archive)
CHANGELOG-archive.md  Older versions (1.1.47 back to 1.0.0); the app doesn't read it (release.test.js does)
tests/             npm test – one *.test.js per area (notes, groups, locks, crypt, effects-…, list-ui-…; testing.md lists
                   them), run side by side; helpers/ (the real main process under fake-electron/, the list and a note in
                   Chromium, the effects in a vm); record/ records a refactor before and after (not run by npm test)
CLAUDE.md         Short rules every AI session reads first (rules, commands, pitfalls, release checklist)
ai-context/        Docs for AI assistants: this map + one file per topic (table below)
tools/node/        Private Node.js 22 that build.bat downloads when the computer's Node is missing/too old (git-ignored)
tools/stt-prototype/  The voice-to-text prototype (Step 1, git-ignored). Its code lives in the app since 1.3.1: delete it once
                   Speak to text works on the owner's PC.
tools/split/       Helper scripts for splitting big files (map, circles, CSS cuts, style compare); see splitting-code.md. Not packed.
```

Fonts come from npm (`@fontsource/caveat` = handwritten, `@fontsource/nunito` = rounded/UI) and are
referenced from HTML as `../node_modules/@fontsource/...`, so they work offline and are packaged.
The Medieval font (1.2.1) is a file in the app: `src/fonts/Augusta.ttf`, loaded by an `@font-face` at the top of
`src/css/note-base.css` and `list-base.css` (`--med`). The note fonts are `FONTS` in `store.js`: hand, round, medieval.

---

## Which file to open

| You are… | Open |
|---|---|
| Changing `main.js`, `main/`, `preload.js`, IPC, windows, the tray, security, or anything about locks / hidden notes | `ai-context/architecture.md` |
| Adding or changing a note field, a setting, backups, the Bin, groups or ink data | `ai-context/data-model.md` |
| Looking for where a feature lives (function, element id, CSS) | `ai-context/feature-map.md` |
| Working on the note editor, toolbars, pop-ups, drawing, the notes list or its cards | `ai-context/ui-gotchas.md` |
| Touching effects or mouse followers (`src/fx/`) | `ai-context/effects.md` |
| Building or packaging: `build.bat`, Node / Electron version, Smart App Control, build errors, saving files into the owner's folder | `ai-context/build-and-release.md` |
| Writing or running tests, or checking the UI | `ai-context/testing.md` |
| Splitting a big file (`note.js`, `list.js`, `main.js`, a CSS file) into smaller ones | `ai-context/splitting-code.md` |

---

## Ideas mentioned or likely next

- Per-note passwords (the owner said "one password for all notes **for now**").
- Maybe: drag to reorder notes by hand (currently only sorting), and custom group icons/stickers.
- Reminders/alarms on notes, a global "new note" shortcut, and export/import to a single file (offered in 1.0.0, not chosen yet).
- **Not wanted (for now):** a "Check for updates" button (GitHub Releases + electron-updater) was discussed after
  1.1.5; the owner decided against it. If it comes back: the repo is public, the installer is unsigned (Smart App
  Control may treat a downloaded copy differently), and checking would be the app's only other network use.
