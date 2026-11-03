# Testing

Open this when writing or running tests, or checking the UI.

## Running
- `npm test` runs `tests/run.js`: every `tests/*.test.js` in its own process with its own empty data folder, several at
  a time (slow ones first). It prints only failures and one summary line. `npm test -- locks groups` runs only the files
  whose name contains one of the words; `npm test -- -v` lists every file with its time. ~30 s for all on 2 cores.
- While working, run only the area's file (`npm test -- notes`), then everything once before saying a change is done.
- The browser tests (`list-ui-*`, `note-ui`) need Playwright (the cloud workspace has it). Without it they exit with 77
  and show as skipped.

## Where a check goes
Tests are grouped by **what they check**, never by version. Add a check to the file of its area (the header comment of
each file says what is in it); make a new file only for a new area, named after it. Check each thing once: before
adding, grep the tests for it. Prefer checking what the code does over reading its text; a check that only reads the
code (regex) is for rules a test can't easily click through (each such line says why it matters).

| File | What it checks |
|---|---|
| `store.test.js` | store.js alone: saving, .bak recovery, backups (daily, restore, prune), attachments, normalize / normalizeInk / checklistMarks / pictureWords / picturePlace |
| `upgrade.test.js` | Sticky Pins → CosmoNotes: copied data, notes reopen, dates and old settings kept |
| `windows.test.js` | note windows: welcome note, see-through / hover / pinned / colour / rolled, placement, moved = remembered, min / max, title, Bring to front, second start, mouse back button, X vs Alt+F4 vs quit |
| `safety.test.js` | attachments (images only, no path tricks), links (web only), permissions (microphone only), which child windows may open |
| `toolbars.test.js` | drawing / text toolbars outside the note: 12 px sticking, following, screen edges, rolled, pinned, back inside |
| `notes.test.js` | editing a note: title and what is an edit, drawing (cleaned, kept exactly while typing), dashes, zoom, word wrap off, favourites, Edit… title, the Bin |
| `colours.test.js` | paper colours, several notes / Edit… colour, new notes' colours (picked list, no repeat, old settings) |
| `duplicate.test.js` | Duplicate from the list and the note: what is copied, shared photos, locked copies, Bin |
| `groups.test.js` | groups in groups, moving, make-from, ungroup / dissolve, looks, recolour all, new note in a group, Bin, locking a group, groups.json, the tip |
| `locks.test.js` | PIN / password rules, locking a note, nothing reaches a hidden window or the card, wrong-PIN pause, can't delete locked things |
| `unlock.test.js` | unlocking: in its window, lock removed from the list, Unlock all / Lock again, Unlock… for now (with a real restart) |
| `crypt.test.js` | encryption on disk across restarts: setup, recovery key, sealed until the PIN, backups, Duplicate, sweep, forgot PIN, off / on, groups, pre-1.1.30 notes |
| `crypt-old-data.test.js` | encryption meets old data: old backups sealed, a crypto library that can't, 1.1.30's format |
| `settings.test.js` | theme (also to notes), card size, sort, new notes' see-through / solid on hover, spelling |
| `effects-settings.test.js` | effects as main saves them: settings for all, a note's own, tray pause, Edit design |
| `effects-rules.test.js` | effect lists and order (src/fx/ = store.js), removed ones, resolve, cleaning, the Layer, paper tint, speed rules |
| `effects-draw.test.js` | every background and follower drawn in many sizes / papers / pointer moves: no NaN, colours exist, followers go quiet |
| `effects-backgrounds.test.js` / `effects-followers.test.js` | how each one behaves, as the owner picked it |
| `code-structure.test.js` | the split into main/, src/note/, src/list/, src/fx/, src/css/: loading order, the shared kit, no circles, line endings, every IPC channel answered |
| `editor-code.test.js` | rules in the note window's code that no browser test clicks yet (checklists, Backspace, photos, find, focus) |
| `release.test.js` | package.json version = newest CHANGELOG heading; its date = about.js `LAST_UPDATED` = CONTEXT.md; every version once |
| `texts.test.js` | short texts and the owner's wording |
| `list-logic.test.js` | the list's rules without a browser (tests/helpers/list-kit.js) |
| `list-ui-cards` / `-pictures` / `-groups` / `-picking` / `-locks-bin` / `-unlock` / `-crypt` / `-settings` | the notes list in Chromium against the real main process |
| `note-ui.test.js` | a note window in Chromium: text toolbar keeps the selection, word wrap off |

## Helpers (`tests/helpers/`)
- `app.js`: the real main process in the test's process, under `tests/fake-electron`. `const app = require('./helpers/app')`
  installs the fake (set up old data after that), `await app.start()` starts main.js and gives `H` (handle channels), `L`
  (on channels), `E` (the fake), `ev(win)`. Also `app.newNote({ html, title, group, close })` → id, `app.card(id)` /
  `app.group(id)` (what the list gets), `app.winOf(id)`, `app.noteWins()`, `app.listWin()`, `app.sent(win, channel)`,
  `app.lastLook(win)`, `app.readJSON('settings.json')`, `app.quit()`.
  A test in parts (restarts): `if (app.phase === 'main') app.phases(__filename, ['first', 'second', { name: 'x', fresh: true }])`,
  then `if (app.phase === 'first') …`; `app.hand({ … })` passes data to the next part, `app.hand()` reads it.
  **Faster on purpose:** scrypt runs with N = 1024 (what is saved still says 2^17); the 450 ms pause after a wrong PIN
  is skipped (`app.waited` lists what was asked); timers of 100 ms or more run 10× sooner (`app.start({ realTime: true })`
  turns that off). So a `tick(800)` in a test waits 80 ms.
- `list-ui.js`: the real list window in Chromium, backed by the real main (through the real preload.js). Write one like
  this: `const ui = await require('./helpers/list-ui')(async (seed) => { await seed.password(); const a = await seed.note({ title,
  html, color, favorite }); const g = await seed.group([a], { name }); await seed.lock(a); await seed.bin(id); })`, then
  `ui.click(sel, { ctrlKey })`, `ui.type`, `ui.key`, `ui.check`, `ui.down`, `ui.rclick`, `ui.menu(sel, 'Label')`,
  `ui.modalOk([values])` / `ui.modalCancel()`, `ui.drag(from, to)`, `ui.tab('bin')`; read with `ui.keys()` (cards shown),
  `ui.text`, `ui.visible`, `ui.count`, `ui.menuLabels()`, `ui.modalTitle()`, and `await ui.get()` (main's data); end with
  `await ui.done()` (fails on any page error). Every action waits until the window is idle: no call to main still
  answering, no short timer (≤ 400 ms) pending in the page or in main/ (main's run 10× sooner here), and still so one
  frame later. `ui.settle(ms)` also waits ms (pictures loading). Real time otherwise: a 250 ms guard in the page needs a
  real wait. Traps: events go straight to elements (cards wobble, Playwright's mouse would wait forever); clicking Settings
  while in Settings goes back to the tab before; a PIN of the saved length submits by itself (`modalOk` handles it);
  pressing the hidden pop-up's OK would reload the page (`modalOk` refuses). A first start has a welcome note too.
- `note-ui.js`: a note window in Chromium with a stand-in `window.sticky` (main is not running): `const nu = await
  require('./helpers/note-ui')(); const page = await nu.open({ html }, width)`, `nu.press(page, sel)` (mousedown + click),
  `await page.updates()` (what the window saved), `await nu.done()`.
- `fx.js`: the effects (src/fx/ parts in note.html's order) in a vm: `FX`, `recorder()` (a 2D context that logs calls and
  any NaN), `canvas(w, h)`, `clock.t` (performance.now), `seeded(n)`, `ptr()`, `PAL(dark)`, `SIZES`, `allBad()`.
- `sources.js`: the code as the windows load it: `src.note()`, `src.list()`, `src.fx()`, `src.css('note')`, `src.main()`,
  `src.files.note` …, `src.read(file)`. It reads the parts from the html, so it follows any change.
- `list-kit.js`: the seven `src/list/` parts in a vm with a stand-in DOM: `await require('./helpers/list-kit')({ notes, groups,
  settings })` → the kit `K` (`K.sortItems`, `K.canMove`, `K.noteIsLocked`…; `K.set(data)` swaps the data). For rules;
  anything about real elements needs the browser.
- `tests/fake-electron/index.js` stays where it is: the recorders load it from each code tree they compare.

## Recording a refactor (not part of `npm test`)
- **The main process:** `tests/record/record-main.js` drives every IPC handler, window event, tray item and permission under the fake Electron with the clock, timers, random numbers and ids replaced, and writes everything that happened (window calls, messages, answers, files written) to a log. Run it on the code before and after a refactor of `main.js` / `main/` and compare the logs (see its header and `splitting-code.md`).
- **The notes list** (needs Playwright): `node tests/record/record-list.js <tree with src/list.html> <tree with main.js> <out.log> [coverage.json]` runs the real `main.js` under the fake Electron with a fixed clock, seeded random numbers and counted ids, and opens the list window in Chromium with Playwright's fake clock; the page's `window.sticky` forwards every call through the real `preload.js` to it. The clicks are in `tests/record/record-list-scenario.js` (285 steps: tabs, search, sort, sizes, groups, panel, picking and the bar, menus, Edit design, Settings, Effects, passwords, Locked tab, drag & drop, Bin, keys). After each step it logs the DOM, every call with its answer, and page errors. Record the old code twice first (the logs must match), then the new (with the old `src/about.js`, or a changed feature list shows up), and compare with `node tests/record/record-list.js compare a.log b.log` (it ignores the page's own `<script>` tags, which differ by design). Then plant a few small mistakes in the new code: each must change the log. ~5 min a run; runs can go side by side.
- **A note window** (1.1.44, same idea; needs Playwright): `node tests/record/record-note.js <tree with src/note.html> <tree with main.js> <out.log> [coverage.json]`, steps in `tests/record/record-note-scenario.js` (284 steps in three windows: a new note, a full note, a locked note), compare with `node tests/record/record-note.js compare a.log b.log`. ~4 min a run. `ONLY=A` (or `C`, `CA`…) runs only those windows, `SCENARIO=<file>` another scenario, `DBG=1` prints each step. What it can't see and why: `splitting-code.md` → "note.js".

## Checking by eye
- **UI checks** (done during development): load `src/note.html` / `src/list.html` in Chromium (e.g.
  Playwright) with a mock `window.sticky` object injected before load, then click through and screenshot
  (`tests/helpers/note-ui.js` has one for a note). Playwright hides scrollbars by default
  (launch with `ignoreDefaultArgs: ['--hide-scrollbars']` to check them). The fonts live in
  `node_modules/@fontsource/*/files` (latin woff2).
- Things only a real Windows machine can confirm: the installer, always-on-top behaviour, the tray,
  start with Windows, the microphone, and the spellchecker download.
