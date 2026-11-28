# CosmoNotes – context for AI assistants and developers

**Last updated: 28 November 2026 · App version 1.4.35**

`CLAUDE.md` comes first (rules, commands, the areas' rules, which topic file to open, the release checklist). This file
is the map: what the app is and where each piece of code lives. Keep the "Last updated" line above current on every
update (`release.test.js` checks it).

---

## What this is

CosmoNotes is a Windows desktop sticky-notes app (Electron), a cuter and more trustworthy replacement for Microsoft
Sticky Notes. It was called **Sticky Pins** in 1.0.0 (the install folder, `appId` and `stickyfile://` keep that name).

**The owner's priorities, in order:**
1. **Never lose a note.** This is the reason the app exists: Microsoft's app lost their notes through cloud sync.
   Everything is local, saved instantly, crash-safe and backed up daily. Nothing may overwrite or delete data without an
   explicit user action.
2. **Notes stay put.** Pinned notes stay on top and won't minimise. Notes reopen in the same spots after a restart.
3. **Cute, like real paper sticky notes:** pastel paper colours, a handwritten font option, little touches (tilted
   cards, pins, clips). Keep this design language.
4. **Simple surface, power behind one button.** Basic formatting is always visible; complex things (photos, voice,
   drawing…) live behind **+ Add**.

The project is a git repo (public on GitHub: `vkashirski/CosmoNotes`); on the owner's PC it is at
`C:\Workspaces\CosmoNotes`.

---

## Project layout

```
main.js            Electron main process, entry only: start-up, single instance, app lifecycle. The rest is in main/.
main/              (grep a function name here; files only require() files below them)
  state            S.store, S.listWin, S.quitting, S.listUnlockedAll + wins
  constants        paper colours, sizes, paths, SECRET
  locks            isLocked, viewOf, checkPassword
  crypt            encryption of locked notes: the store's sealer/opener, keys, recovery key, syncSeals
  migrate          the old Sticky Pins folder
  settings         spelling, noteSettings, broadcastSettings
  display · web    fitBounds · hardenContents, openExternal, the text's right-click lines (note:ctx)
  ink-geometry · ink-window   windows outside a note (toolbars, menus): places, BAR_FRAMES / BAR_KINDS, liftBars
  list-notify      notifyList
  note-state       applyState, onTop, setRolled, titles
  list-visibility  hidden-in-list rules, unlockedForNow, pushLook
  note-window      openNoteWindow, createNote, duplicateNote, bringToFront, enforcePinned, touchNote
  list-window      showList, themes
  tray             buildTray, start with Windows, pause effects
  recordings       voice recordings on disk while made, finished on close / lock / quit, recovered after a crash
  move-history     Undo / Redo of moves and pastes in the list
  evening · panic · closed-notes   evening colours' one clock · the panic button and its shortcut · "Reopen closed note"
  stt-models · stt-engine · stt-download   voice to text: the model (files, commit, sha256) · the hidden engine window,
                   cosmomodel://, its session · the download, Remove, .part cleanup
  updater          updates: GitHub's latest.yml, the installer's download + sha512, starting it on quit
  reminders        the reminders' one clock, popping a note up, hiding, remind:* / list:remind-* IPC
  app-pin          notes pinned over some apps: which app is in front (desktopCapturer titles), hide / show
  bar-hover        the mouse over a note's top bar (a drag area the page can't see): polled, sent as note:bar-hover
  feedback         Settings → Feedback (1.4.34; "Ground control" in the code): gc:* for the list only, pictures made smaller, the draft, the puzzle, Send
                   to the relay (RELAY)
  ipc + ipc-*      registerIpc calls ipc-common (senderNote, applyPatch) · ipc-notes · ipc-ink · ipc-files (+ rec:*) ·
                   ipc-groups (list:get, groups:*) · ipc-list-actions (list locks, open/close/trash/edit/apply, Bin) ·
                   ipc-settings (settings:set, backups) · ipc-crypt · ipc-stt · ipc-update · ipc-tags (tags:*: every
                   tag from any note, 1.4.30), feedback's registerFeedbackIpc, and reminders' registerRemindIpc
store.js           All disk storage (notes, groups, settings, attachments, backups). No Electron imports.
preload.js         Safe bridge: exposes window.sticky.* to both windows (contextIsolation + sandbox)

src/note.html      One sticky-note window (the editor). Its code is src/note/*.js, 16 parts loaded in this order, sharing
                   names through window.COSMO_NOTE_KIT (K) and its V (see CLAUDE.md, "Rules for every code change"):
  base             api, $, colour row, saving (collect / changed / saveNow), dates, applyLook, effects on the note
  fx-format        the Effects pop-up, spelling, selection helpers (saveSel / restoreSel / insertNodes), runCmd, list lines
  panels           pop-overs (openPop / closePops), header buttons, ⋯ menu, Add panel (doInsert), text panel A, Undo / Redo
  content          links, picture descriptions, tables, paste / drop and cleanTree, clicks in the note
  editing          line joins, checklist boxes' size and place (alignChecks, decorate), Ctrl+F, keyboard
  checklists       checklist options (checkOn / applyChecks), ticking, dragging, ticked lines to the bottom, their Undo
  menus-voice-ink  right-click menus (showMenu), voice notes, drawing sketch, photo resizing
  speech           Speak to text, Transcribe
  lock-zoom        locking, password / PIN, ask(), word wrap, zoom (zoomNow / setZoom), sideways scroll
  draw-over        inkState, renderInk, saveInk; floating toolbars (movable)
  ink-out          windows outside the note (barOut, inkOut / textOut); whole-stroke eraser
  remind           Add → Reminder's panel, the ringing strip (Snooze / Done), the glow, the sound, the chip (#remChip)
  pin-apps         the pin's right-click list, "Pin over"
  tags             the ⋯ menu's Tags row
  top-bar          a small note's top bar: buttons the title needs the room of go into »
  eraser-start     the Partial eraser, toast(), start-up (init). Always the last part (splitting-code.md).
                   Before its own code the page loads src/reminders.js, src/remind-ui.js and src/tags.js.
src/css/note-*.css The note's styles, in this order: note-base (colours, base, top bar) · note-text (locked note, photo
                   handle, writing area) · note-toolbars (bottom bar, pop-overs) · note-drawing (right-click menu,
                   recording, drawing, toast) · note-effects-lock (effects, lock animation, small notes) ·
                   note-popups-find (pop-ups in the app's colours, Ctrl+F)

src/list.html      The "All notes" window: Notes / Bin / Settings tabs, groups, sorting. Its code is src/list/*.js, 8 parts
                   in this order, sharing names through window.COSMO_LIST_KIT (K) and its V:
  base             colours, themes, sizes, ICON, h(), colour row, data (load / live / groups / sorting), isShut, tag filter
  cards            render, drag & drop, note / group cards, card cache (refreshCard), group header, tag row
  picking          favourites, Ctrl / Shift-click, lock animation, the picked-cards bar
  settings-menus   Settings: new-note colours, About, backups, OWN; modal(), toast(); right-click menus
  effects-design   effects on cards, Settings → Effects, Edit design
  actions-locks    Bin / delete, passwords, lock / unlock, Locked tab, group panel, Settings sections and search, back / forward
  ground-control   Settings → Feedback (1.4.34): the form, pictures (paste / drop / pick), Submit's spinner and countdown
  events           the tab bar (groups pinned as tabs, edit mode, »), search, sort, sizes, settings inputs, keys, first load
src/css/list-*.css The list's styles, in this order: list-base (themes, title bar, tabs, search, group view, drag) ·
                   list-cards (cards, buttons, settings) · list-groups-menus (about, group looks, menus, pop-up, toast,
                   card sizes) · list-settings-fx (window themes, Settings sidebar, effects, Edit design, favourites) ·
                   list-picking-edit (picked-cards bar, colour rows, Edit sheet, lock animations)

Shared by both windows (window.COSMO_*), and required by main and store.js where they hold rules:
src/evening.js     evening colours: each light paper's evening shade (PALETTE), the fade (phase), the styles
src/reminders.js   the reminders' rules (cleaning, repeats and their next time, Snooze, Done, missed, hiding) and words
src/remind-ui.js   the reminders panel (one fixed size, In / At, time box, its own calendar) and the 10 sounds (Web Audio)
src/tags.js        tags: the rules (clean, the search box's #tags, All / Any) and the editor (chips + a box)
src/tab-icons.js   the 40 icons of the list's tabs (window.COSMO_TAB_ICONS; store.js checks a group's icon with it)
src/fx/            note effects + mouse followers (window.COSMO_FX): 8 files loaded in order (effects.md)
src/about.js       the in-app feature list (FEATURES) + LAST_UPDATED

src/engine/        voice to text: the engine page (engine.mjs, engine-core.mjs: the live session, pauses, text clean-up),
                   its preload, lib/ (Transformers.js + ONNX Runtime, vendored: never open; its README.md says what is
                   there). Served only through cosmomodel://
src/mic-worklet.js the AudioWorklet of Speak to text (16 kHz pieces)
src/fonts/         Augusta.ttf, the Medieval note font (binary)
assets/            icon.ico/png (windows), tray.ico/png
build/             icon.ico/png for the installer / shortcuts; installer.nsh (shortcuts get the CosmoNotes icon, the exe
                   stays untouched); release-notes.js (a version's CHANGELOG entry → the GitHub release's notes)
build.bat          one click: (private Node if needed) + npm install + electron-builder → dist/CosmoNotes-Setup-<ver>.exe
release.bat        sends package.json's version to everyone: pushes main and the tag v<ver> (checks first)
.github/           workflows/release.yml: a tag v<ver> → tests on Linux, build + Smart App Control check on Windows,
                   publish to GitHub Releases
feedback-worker/   Feedback's relay (1.4.34): worker.mjs, a Cloudflare Worker that turns a report into an issue in
                   the private repo CosmoNotesFeedback; README.md (setup), wrangler.toml. Not packed, not part of the app
.gitattributes     each file's line endings (the list CLAUDE.md points to)
test-run.bat       runs CosmoNotes from this folder with Electron's original exe (no build needed)
HOW TO INSTALL.txt plain-language guide for the owner (install, data folder, forgot password, tips)
CHANGELOG.md       the two newest versions; CHANGELOG-archive.md the older ones (the app reads neither; release.test.js does)
tests/             npm test: one *.test.js per area (testing.md lists them); helpers/ (the real main process under
                   fake-electron/, the list and a note in Chromium, the effects in a vm); record/ records a refactor before
                   and after (not run by npm test)
tools/             node/ (the private Node 22 build.bat downloads; git-ignored) · split/ (helper scripts for splitting big
                   files, splitting-code.md; not packed) · stt-prototype/ (git-ignored; delete once Speak to text works on
                   the owner's PC)
Stubs, unused:     src/note.js, src/list.js, src/note.css, src/list.css, src/fx.js (each only says where its code moved),
                   build/afterPack.js, build/fetch-model.js, build/models/. All can be deleted.
```

Fonts come from npm (`@fontsource/caveat` = handwritten, `@fontsource/nunito` = rounded / UI), referenced from HTML as
`../node_modules/@fontsource/...`, so they work offline and are packaged. The Medieval font is loaded by an `@font-face` at
the top of `src/css/note-base.css` and `list-base.css` (`--med`). The note fonts are `FONTS` in `store.js`: hand, round,
medieval.

---

## Ideas the owner mentioned (not built)

- Per-note passwords (the owner said "one password for all notes **for now**").
- Maybe: drag to reorder notes by hand (currently only sorting), and custom group icons / stickers.
- A global "new note" shortcut, and export / import to a single file (offered in 1.0.0, not chosen yet).
- Reminders, next (the owner's picks): a reminder on one checklist line ("buy milk · 18:00"; `target` is ready for it),
  and maybe an email for a missed reminder. Real nature recordings could replace the made sounds (src/remind-ui.js
  `MAKE`): the owner asked for sounds from a free site; the cloud workspace couldn't download them.
- Open question about updates: whether Smart App Control lets an installer built by GitHub (not on the owner's PC)
  start. The first real update shows it (`build-and-release.md` → "Releasing").
