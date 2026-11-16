# CosmoNotes

Windows sticky-notes app (Electron 39, plain JavaScript, no framework or bundler). Notes are stored locally only.
The owner is a programmer: technical detail is fine (texts inside the app stay short and plain). Edit files in this folder in place.
Keep each file's existing line endings (`.gitattributes` holds them for git since 1.4.0: a new CRLF file needs a line there too): they are mixed (`main.js`, `main/*.js`, `preload.js`, `src/note.*`, `src/note/*.js`, `src/css/note-*.css`, `*.bat`, `build/installer.nsh`, `build/afterPack.js`, `.gitignore`, `CLAUDE.md`, `HOW TO INSTALL.txt` are CRLF;
`store.js`, `src/list.*`, `src/list/*.js`, `src/fx/*.js`, `src/engine/*`, `src/mic-worklet.js`, `src/about.js`, `src/evening.js`, `src/reminders.js`, `src/remind-ui.js`, `package.json`, `CHANGELOG.md` and `ai-context/*.md` are LF).

## Commands
- `npm test`: all tests, side by side (~30 s), under plain Node (`tests/fake-electron` stands in for Electron); prints only failures and a summary. `npm test -- notes` runs only the files whose name contains "notes". Run the area's file while working and everything once before saying a change is done. The browser tests (`tests/list-ui-*`, `note-ui`) need Playwright: the cloud workspace has it; without it they show as skipped.
- `npm start` or `test-run.bat`: run the app from this folder (Windows only).
- `build.bat`: the owner double-clicks it to build `dist/CosmoNotes-Setup-<version>.exe` on his PC. Don't build yourself.
- `release.bat` (1.4.0): the owner double-clicks it to send a version to everyone: GitHub Actions tests, builds and publishes it, and the apps update themselves (`ai-context/build-and-release.md` → "Releasing"). Never run it or push a tag yourself. There is no linter. No voice model comes with the app since 1.3.4 (it is a download in Settings; `build/fetch-model.js` and `build/models/` are unused).
- Only a real Windows PC can confirm the installer, always-on-top, the tray, start with Windows, the microphone, the graphics card (voice to text) and the spellchecker download. Say so; don't claim they work.

## Golden rules
1. **Never risk losing a note.** Local-only, atomic saves, backups, the Bin. No cloud, no accounts, no destructive change without asking.
2. **Every update raises the version** in `package.json`: always the third digit (1.1.23 → 1.1.24), unless the owner says not to. The owner decides when the first or second digit goes up.
3. **Never modify `CosmoNotes.exe`** (no rcedit / resedit / afterPack / fuses / asar integrity). It must stay byte-identical to Electron's own `electron.exe`, or Windows Smart App Control blocks the app. Details: `ai-context/build-and-release.md`.
4. **Keep `appId` `com.stickypins.app` and the `stickyfile://` scheme.** Existing installs and saved notes depend on them.
5. **Fix the cause, not the symptom** (the owner's wish, 1.3.18): when a bug comes from a design flaw, change the design and remove the workarounds it needed, so the code doesn't pile up patches. If the proper fix would change how the owner's notes look or behave, say so and ask first.

## Pitfalls that have bitten before
- **Saves into the owner's folder can silently keep the OLD file** (seen in 1.1.23). After writing through the folder bridge (`device_commit_files`), stage the file back and compare its sha256 or size with what you meant to save. Tell the owner if a write did not land.
- **Voice recordings (1.2.4, `main/recordings.js`):** a recording is on disk while it is made (`<name>.part` + `<stem>.rec.json`). Anything that ends a recording (close, lock, quit, crash) must keep it as a 🎤 chip; only the X throws it away. The sweep keeps files with a `.rec.json`; never delete one by hand in code.
- **Hidden locked notes:** never send their `title` / `html` / `text` / `firstImage` / `ink` to a window or the list, and a hidden window must never save. Since 1.3.28 nothing else of them changes either (only select, lock options, open): a new list or note action needs the `hiddenInList` / `groupShut` check in main. See `architecture.md`.
- **Encrypted locked notes (1.1.30, `main/crypt.js`):** `checkPassword` is async (always `await` it); every note write goes through `S.store.diskForm` (backups too), or a locked note lands on disk in plain text; a note with `enc` set is still sealed: never save its empty fields. No "reset by editing settings.json" for encrypted notes: the recovery key is the only way back. Rules: `architecture.md` → "Encryption".
- **Main-process shared state:** it is `S.store`, `S.listWin`, `S.quitting`, `S.listUnlockedAll` (`main/state.js`). Always write `S.…`; never copy one into a variable or destructure it. A new file in `main/` must only `require()` files below it (no circles); `package.json` packs `main/**/*` (`code-structure.test.js` checks both).
- **Voice to text (1.3.1, `main/ipc-stt.js`, `main/stt-engine.js`, `src/note/speech.js`):** a job never outlives its note window, and nothing goes to a hidden one (`mayShow`); main never writes text into a note. The engine window's session must keep blocking every non-`cosmomodel:` request, and `cosmomodel://` must serve only its fixed list (`route`). A new library file = `LIB_FILES` + `IMPORT_MAP`; a model change = `main/stt-models.js` only (with its sha256; one model since 1.3.4, `MODEL`). The marker `.stt-pending` is never saved (`collect`). Rules: `architecture.md` → "Voice to text".
- **Reminders (1.4.1, `main/reminders.js`, `src/reminders.js`):** the rules are one file both windows, main and store.js use;
  main keeps the one clock (never a timer in a window). `note.remindMsg` is secret (in `SECRET` and crypt.js `SECRET_FIELDS`,
  one `blank()` for both sealers): never send it to the list with the cards, nor to a hidden window. A hidden locked note may
  only get Snooze / Done (and only when its reminder's `unlock` is off): any other reminder change needs the `hiddenInList` /
  revealed check in main. Rules: `architecture.md` → "Reminders".
- **App pins (1.4.5, `main/app-pin.js`):** a note pinned over some apps (`note.pinApps`) mirrors them: on top while one is in
  front, just above its app (`win.appBehind`, not on top) while it is behind another app, hidden (`win.hide`, `win.appHidden`)
  while none is open; its window stays open. Anything that shows note windows or sets on-top must leave `appHidden` /
  `appBehind` ones alone (`enforcePinned` skips them, `onTop(n, win)`) or show them as a peek (`appPin.peek`, like the list's
  open and Bring to front). A list of
  windows that can't be read shows every note: a broken check must never hide notes. Reading the list is costly (moving notes hitched): its clock
  rests while one of our windows has the focus (1.4.7, `focusMoved`); don't add checks that run while ours is in front. Rules: `architecture.md` → "App pins".
- **`preload.js` (1.4.1):** a name used twice in one object of `window.sticky` silently replaces the first: 1.4.0's `update`
  (the updates) replaced the note window's save, so notes only saved when closed. `code-structure.test.js` checks it.
- **Window parts (`src/list/`, `src/note/`):** each part is its own `(() => {…})()` block. Variables more than one part changes are `V.x` (list: `V.tab`, `V.openGroup`, `V.state`…; note: `V.note`, `V.settings`, `V.hidden`, `V.dirty`, `V.savedRange`…): always write `V.…`, never copy one into a local. A part takes earlier parts' names in its `const {…} = K;` line, calls a later part's function through `K.later('name')` (a later part's value: `K.name`), and hands names on in `Object.assign(K, {…})` at its end; a name another part needs must be in both (`code-structure.test.js` checks). A `let` only one part uses stays private there. Note parts are CRLF. The note's `eraser-start.js` (start-up) stays the last part (1.4.1, `splitting-code.md`).
- **Zoom:** anything that turns mouse or screen pixels into sizes inside a note must divide by `zoomNow()`. Don't use Electron's page zoom.
- **Effects:** a new effect or follower needs its id in both `src/fx/` (its `effects-*` / `followers-*` file and `ORDER` in `engine.js`) and `store.js`. Draw on the shared canvas loop: no `Path2D`, no per-particle DOM or CSS animation, no per-frame `createRadialGradient` / `filter`, and it must also work with `m === null`. See `effects.md`.
- **Ink:** never thin out or re-smooth saved points; drawings drift ("dance") a little more on every pass.
- **Pop-up colours:** use the `--pop-*` variables, never hard-coded colours.
- **Paper colours (1.3.27):** a note's (and a card's) colours are day `--d-*` mixed with evening `--e-*` by `--eve`; set
  `--d-*`, never `--paper` itself. Evening shades are only in `src/evening.js` (a new light paper needs one there).
- **Settings a note can change for itself (1.3.27):** one table, `OVERRIDES` in `store.js` (what "Use on all notes"
  puts back). A new one also needs `OWN` (list/settings-menus.js), a `.reapply` row (list.html) and the note's
  `onLook` keys (lock-zoom.js).
- **Font sizes (1.3.18):** a `font[face]` rule must never set its own `font-size` (it beats `size=`): sizes and fonts multiply through `--sm` / `--kf` / `--k`. Details: `ui-gotchas.md` → "Font sizes".
- **Formatting in a note shows on its card (1.3.11):** a new tag or look in the editor (`ALLOWED` / `RICH` in `src/note/content.js`) also goes into `store.js` `CARD_TAGS` / `cardLook` and `src/list/cards.js` `runCss`; `store.test.js` fails until it does.
- **Version numbers were renumbered in 1.1.41** (big versions split up; old 1.1.24 and later = old + 9). Numbers written before then, in code comments, test file names, `ai-context/` and older changelog text, are the old ones. The table is at the top of `CHANGELOG.md`.
- **Texts in the app:** short and plain, in short sentences (the owner's wish, 1.1.41). One idea per sentence; no long explanations in hints, pop-ups or the feature list.
- **Tests are by area, never by version** (1.1.49): add a check to the file for the area you changed (`ai-context/testing.md` has the list), once (grep first). `release.test.js` checks that `package.json`, the newest `CHANGELOG.md` heading, `LAST_UPDATED` and `CONTEXT.md` agree: it fails until the checklist below is done.
- Don't open `app.asar` with the Claude desktop app's file tools: it keeps the archive open and the next build fails with `EBUSY`.

## Every update (checklist)
1. Raise the version in `package.json` (third digit).
2. `src/about.js`: set `LAST_UPDATED`, and keep the in-app feature list (`FEATURES`) in step with any feature you add or change: one or two short sentences per item. The app shows no version history since 1.1.41 (the owner's wish): it is only in the changelog.
3. `CHANGELOG.md`: the entry at the top: a one-line summary, then the details. It keeps only the two newest versions: move the oldest one into `CHANGELOG-archive.md` (top of its list).
4. `ai-context/CONTEXT.md`: the "Last updated" line, plus the one `ai-context/` file whose topic changed (new feature → `feature-map.md`; new field or setting → `data-model.md`; a new rule or trap → the matching file).
5. `HOW TO INSTALL.txt` and `build.bat`, only if they mention the version or file name (neither hard-codes it since 1.1.5).
6. `npm test`. The owner then runs `build.bat` to try it, and `release.bat` to send it to everyone.
7. If files go into the owner's folder through the desktop app, verify each one on the device (see Pitfalls). If his build then stops with `EBUSY ... app.asar`, the app is still running (`build-and-release.md`).

## Saving tokens (these files are big)
- **Never read a big file whole:** `CHANGELOG-archive.md` (~140 KB). The note window's code is in `src/note/` since 1.1.44 (fourteen parts since 1.4.5, 3–30 KB; `CONTEXT.md` says which holds what; `src/note.js` is only a note). `main.js` is small since 1.1.27: the main-process code is in `main/` (`CONTEXT.md` says what is where; grep a function name there). The notes list's code is in `src/list/` since 1.1.28 (seven parts, 11–25 KB; `CONTEXT.md` says which holds what; `src/list.js` is only a note). Grep for the name first (`ai-context/feature-map.md` lists them), then read only those lines. Each file is split into sections by comment headers (`// ----…` in JS): grep them for an outline. The styles were split in 1.1.26 into `src/css/note-*.css` and `src/css/list-*.css` (5–20 KB each; `CONTEXT.md` says what is where): grep `src/css/` for a selector to find its file. The effects are split into `src/fx/*.js` (9–34 KB each): `ai-context/effects.md` says which file holds what; open only that one. Never open `src/engine/lib/` (Transformers.js and ONNX Runtime, vendored, up to 27 MB): its `README.md` says what is there.
- **Never list the folder recursively** (it walks `node_modules`): list the one folder you need.
- **Adding a version entry:** read only the top of `CHANGELOG.md` and insert the new entry there. Don't open `CHANGELOG-archive.md` unless you need old history.
- **Tests:** open only the area's test file (its first lines say what is in it), to add a check or when it fails; run only it while working (`npm test -- groups`).
- **Previews for the owner's picks:** update the existing preview page (a new version of the same artifact) instead of building a new page each round, and show only the options still being decided.

## Where to read more (open only what the task needs)
`ai-context/CONTEXT.md` is the map: what the app is, the folder layout, and which file to open for which job.
`architecture.md` (processes, IPC, security, locks) · `data-model.md` (files on disk, note fields, settings, groups) ·
`feature-map.md` (feature → code) · `ui-gotchas.md` (editor, toolbars, list) · `effects.md` (`src/fx/`) ·
`build-and-release.md` (build, Smart App Control, saving files) · `testing.md` · `splitting-code.md` (before splitting a big file).

## Keeping these docs useful
Write down what the code does not make obvious: where something lives, a rule, a trap, a decision of the owner's.
Version-by-version history belongs in `CHANGELOG.md`, not here. Don't copy long how-it-works prose into this file.
