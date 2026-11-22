# CosmoNotes

Windows sticky-notes app (Electron 39, plain JavaScript, no framework or bundler). Notes are stored locally only.
The owner is a programmer: technical detail is fine in chat; texts inside the app stay short and plain.
Edit files in this folder in place. Keep each file's line endings: `.gitattributes` is the list (the CRLF files are named
there, everything else is LF); a new CRLF file needs a line there.

## Commands
- `npm test`: all tests, side by side (~30 s), under plain Node (`tests/fake-electron` stands in for Electron); prints only
  failures and a summary. `npm test -- notes` runs only the files whose name contains "notes". Run the area's file while
  working; a change is done when the full `npm test` shows 0 failed. The browser tests (`list-ui-*`, `note-ui*`) need
  Playwright: the cloud workspace has it; without it they show as skipped (say so).
- `npm start` or `test-run.bat`: run the app from this folder (Windows only). There is no linter.
- `build.bat` and `release.bat` are the owner's buttons. He double-clicks `build.bat` to build
  `dist/CosmoNotes-Setup-<version>.exe` on his PC, and `release.bat` to send a version to everyone (GitHub Actions tests,
  builds and publishes it; the apps update themselves: `build-and-release.md` → "Releasing"). Your part ends at a green
  `npm test`: you never build, run `release.bat` or push a tag.
- Only a real Windows PC can confirm the installer, always-on-top, the tray, start with Windows, the microphone, the
  graphics card (voice to text) and the spellchecker download. Name the ones your change touches as unconfirmed.

## Golden rules
1. **Never risk losing a note.** Local-only, atomic saves, backups, the Bin. No cloud, no accounts, no destructive change
   without asking.
2. **Every update raises the version** in `package.json`: always the third digit (1.1.23 → 1.1.24), unless the owner says
   not to. The owner decides when the first or second digit goes up.
3. **`CosmoNotes.exe` stays byte-identical to Electron's own `electron.exe`** (no rcedit / resedit / afterPack / fuses /
   asar integrity), or Windows Smart App Control blocks the app. Details: `build-and-release.md`.
4. **Keep `appId` `com.stickypins.app` and the `stickyfile://` scheme.** Existing installs and saved notes depend on them.
5. **Fix the cause, not the symptom** (the owner's wish): when a bug comes from a design flaw, change the design and remove
   the workarounds it needed, so the code doesn't pile up patches. If the proper fix would change how the owner's notes
   look or behave, say so and ask first.

## Rules for every code change
- **Shared state is read at the point of use.** Main process: `S.store`, `S.listWin`, `S.quitting`, `S.listUnlockedAll`
  (`main/state.js`). Windows: `V.x` (list: `V.tab`, `V.openGroup`, `V.state`…; note: `V.note`, `V.settings`, `V.hidden`,
  `V.dirty`, `V.savedRange`…). Always write `S.…` / `V.…`: a local copy or a destructuring keeps a stale value.
- **How code is cut into files** (`code-structure.test.js` checks all of it): a `main/` file only `require()`s files below
  it (no circles; `package.json` packs `main/**/*`). Each window part (`src/list/`, `src/note/`) is its own `(() => {…})()`
  block: it takes earlier parts' names in its `const {…} = K;` line, calls a later part's function through
  `K.later('name')` (a later part's value: `K.name`), and hands names on in `Object.assign(K, {…})` at its end; a name
  another part needs must be in both. A `let` only one part uses stays private there. The note's `eraser-start.js` stays
  the last part.
- **`preload.js`:** each name appears once per object of `window.sticky`; a second one silently replaces the first (1.4.0's
  `update` replaced the note window's save, so notes only saved when closed).
- **Secret fields** are a note's contents: `title`, `html`, `text`, `firstImage`, `ink`, `remindMsg`, `tags`. A secret field
  is in `SECRET` (constants.js) and crypt.js `SECRET_FIELDS`, with its empty value in crypt.js `blank()` (one for the store
  and the backups) and locks.js `viewOf`. It is sealed with a locked note and goes neither to a hidden window nor to the
  list with the cards. A new field with note contents is a secret field.
- **Hidden** = a locked note `hiddenInList` or a group `groupShut`. A hidden window never saves, and nothing of a hidden
  note changes: it can only be selected, unlocked / have its lock options changed, and opened. Every new list or note
  action in main does the hidden check. `architecture.md` → "Locks and hidden notes".
- **Encrypted notes** (`main/crypt.js`): `checkPassword` is async (always `await` it); every note write goes through
  `S.store.diskForm` (backups too), or a locked note lands on disk in plain text; a note with `enc` set is sealed: its
  empty fields are never saved. The recovery key is the only way back (no "reset by editing settings.json").
- **Texts in the app:** short and plain, in short sentences, one idea per sentence; no long explanations in hints, pop-ups
  or the feature list (`texts.test.js`).
- **Tests are by area, never by version:** add a check to the area's file (`testing.md` has the list), once (grep first).
- **Version numbers written before 1.1.41 are the old ones** (code comments, test names, older docs and changelog text;
  new = old + 9 from old 1.1.24 on). The table is at the top of `CHANGELOG.md`.

## Before you change an area
These rules have bitten before. When your change touches the files in the first column, follow the rule and read the
full rules where the last column points.

| Area (files) | The rule | Full rules |
|---|---|---|
| Voice recordings (`main/recordings.js`, `rec:*`) | A recording is on disk while it is made (`<name>.part` + `<stem>.rec.json`). Anything that ends it (close, lock, quit, crash) keeps it as a 🎤 chip; only the X throws it away. The sweep keeps files with a `.rec.json`; code never deletes one by hand. | `data-model.md` → "Voice recordings"; `architecture.md` → "Recording while a note gets locked" |
| Voice to text (`main/stt-*.js`, `main/ipc-stt.js`, `src/engine/`, `src/note/speech.js`) | A job never outlives its note window, and nothing goes to a hidden one (`mayShow`); main never writes text into a note. The engine's session blocks every non-`cosmomodel:` request; `cosmomodel://` serves only `route`'s fixed list. A new library file = `LIB_FILES` + `IMPORT_MAP`; a model change = `main/stt-models.js` only (with its sha256). The `.stt-pending` marker is never saved (`collect`). | `architecture.md` → "Voice to text" |
| Reminders (`main/reminders.js`, `src/reminders.js`, `src/remind-ui.js`, `src/note/remind.js`) | `src/reminders.js` is the one rules file (both windows, main, store.js); main keeps the one clock, no timer in a window. `remindMsg` is a secret field. A hidden note gets only Snooze / Done, and only when its reminder's `unlock` is off. The panel has one fixed size: a new row needs a new height. | `architecture.md` → "Reminders"; `ui-gotchas.md` → "The reminders panel never moves" |
| Tags (`src/tags.js`, `list:tags`, `note:tags`, `main/ipc-tags.js`) | A secret field: `[]` on the card and to a hidden window. Changed only by add / remove, never in a note's save (not in `EDITABLE`). A group's tags count for everything inside it (list `tagsOfNote`). Renaming / deleting a tag everywhere reaches a hidden note or shut group only with the PIN (`pinCheck`). | `data-model.md` (note fields, groups); `architecture.md` → "Locks and hidden notes" |
| App pins (`main/app-pin.js`, `note.pinApps`, `src/note/pin-apps.js`) | Code that shows note windows or sets on-top leaves `appHidden` / `appBehind` windows as they are (`enforcePinned` skips them, `onTop(n, win)`) or shows them as a peek (`appPin.peek`). While its apps are away a note is minimised, not hidden (1.4.28: it stays in the taskbar); anything that restores it shows it until the focus leaves (`restored`). A window list that can't be read shows every note. The watch rests while one of our windows has the focus (`focusMoved`): checks run only while another app is in front. | `architecture.md` → "App pins" |
| Window order (`win:touch`, `barOut`, `main/ink-geometry.js`) | The window touched last is on top, pinned notes above the rest: every page sends `touch` on a press (main `touchNote` / `liftBars`). A new window outside a note is made with `barOut` and has its kind in `BAR_FRAMES` / `BAR_KINDS`. A note window's menus are its own `showMenu` (kind `'more'`; the text's lines come from main by id: `note:ctx`), never a native `Menu`. | `architecture.md` → "Which window is on top" |
| Top bar (`src/note/top-bar.js`) | A new button gets its place in `ORDER` and a line in `ITEMS`, or it never moves into » and a small note's bar runs over. Buttons leave the bar only through `ORDER`, never by a width rule in CSS. | `ui-gotchas.md` → "Sizes and bars" |
| List cards (`src/list/cards.js`) | A changed note keeps its card (`refreshCard`): a handler on the card element reads the note live (`noteById`), never the `n` it was built from. | `ui-gotchas.md` → "List cards stay" |
| Editor formatting (`src/note/content.js` `ALLOWED` / `RICH`) | A new tag or look also goes into store.js `CARD_TAGS` / `cardLook` and `src/list/cards.js` `runCss` (`store.test.js` fails until it does). | `feature-map.md` → "A card's words" |
| Zoom (mouse or screen px turned into sizes inside a note) | Divide by `zoomNow()`. Zoom is CSS `zoom` on `#sheet`; Electron's page zoom is shared by every note. | `feature-map.md` → "Zoom inside a note" |
| Font sizes (`font[face]`, `note-base.css`) | A font never changes a size: one text size, line height and box for every note font, letters matched by `font-size-adjust`. A `font[face]` rule sets no `font-size` and no bigger line-height. | `ui-gotchas.md` → "Font sizes" |
| Ink (`src/note/draw-over.js`, `ink-out.js`) | Saved points stay exactly as they are: thinning or re-smoothing makes drawings drift ("dance") a little more on every pass. | `ui-gotchas.md` → "Drawing" |
| Effects (`src/fx/`) | A new effect or follower has its id in its `effects-*` / `followers-*` file, `ORDER` in `engine.js` and `store.js`. It draws on the shared canvas loop and works with `m === null`; no `Path2D`, per-particle DOM or CSS animation, per-frame `createRadialGradient` / `filter`. | `effects.md` |
| Colours (pop-ups, paper) | Pop-ups use the `--pop-*` variables. A note's (and card's) paper is day `--d-*` mixed with evening `--e-*` by `--eve`: set `--d-*`, never `--paper`. Evening shades live only in `src/evening.js` (a new light paper needs one). | `ui-gotchas.md` → "Pop-up colours"; `architecture.md` → "Evening colours" |
| Per-note settings (store.js `OVERRIDES`) | One table says what a note can change for itself (and what "Use on all notes" puts back). A new one also needs `OWN` (list/settings-menus.js), a `.reapply` row (list.html) and the note's `onLook` keys (lock-zoom.js). | `feature-map.md` → "Use on all notes" |

## Where to read more
`ai-context/CONTEXT.md` is the map: what the app is, the folder layout, and which part file holds what. Then open only
the topic file the task needs:

| You are… | Open |
|---|---|
| changing `main.js`, `main/`, `preload.js`, IPC, windows, the tray, security, locks / hidden notes | `architecture.md` |
| adding or changing a note field, a setting, backups, the Bin, groups or ink data | `data-model.md` |
| looking for where a feature lives (function, element id, CSS) | `feature-map.md` |
| working on the note editor, toolbars, pop-ups, drawing, the notes list or its cards | `ui-gotchas.md` |
| touching effects or mouse followers (`src/fx/`) | `effects.md` |
| building, packaging, releasing, Node / Electron versions, Smart App Control, build errors | `build-and-release.md` |
| writing or running tests, or checking the UI by eye | `testing.md` |
| splitting a big file into parts | `splitting-code.md` |

## Saving tokens (these files are big)
- **Grep first, then read only those lines:** `feature-map.md` lists the names; every code file is cut into sections by
  comment headers (`// ----…` in JS: grep them for an outline). `CONTEXT.md` says which part of `main/`, `src/note/`,
  `src/list/` and `src/css/` holds what; `effects.md` does the same for `src/fx/`. Find a selector by grepping `src/css/`.
- **Read only for old history:** `CHANGELOG-archive.md` (~140 KB). **Never open** `src/engine/lib/` (Transformers.js and
  ONNX Runtime, vendored, up to 27 MB; its `README.md` says what is there).
- **List one folder at a time** (a recursive listing walks `node_modules`).
- **A version entry:** read only the top of `CHANGELOG.md` and insert the new entry there.
- **Tests:** open only the area's test file (its first lines say what is in it).
- **Previews for the owner's picks:** a new version of the same artifact each round, showing only the options still being
  decided.

## Saving into the owner's folder
- **A write through the folder bridge (`device_commit_files`) can report success and leave the OLD file** (seen in
  1.1.23). After every commit, stage the file back and compare its sha256 (or size) with what you meant to save
  (`force: true` if the mtime guard blocks a re-commit). Tell the owner about any write that did not land.
- Inspect `app.asar` only with shell tools: the Claude desktop app's file tools keep it open and the next build fails
  with `EBUSY`.

## Every update (checklist)
Done = every step, in order. `release.test.js` fails until steps 1–4 agree.
1. Raise the version in `package.json` (third digit).
2. `src/about.js`: set `LAST_UPDATED`, and keep the in-app feature list (`FEATURES`) in step with any feature you add or
   change: one or two short sentences per item. The app shows no version history: it is only in the changelog.
3. `CHANGELOG.md`: the new entry at the top (a one-line summary, then the details). It keeps only the two newest
   versions: move the oldest one to the top of `CHANGELOG-archive.md`'s list.
4. `ai-context/CONTEXT.md`: the "Last updated" line, plus the one `ai-context/` file whose topic changed (new feature →
   `feature-map.md`; new field or setting → `data-model.md`; a new rule or trap → the matching file).
5. `npm test`: 0 failed.
6. Every file sent to the owner's folder is verified on the device (above). Then the owner runs `build.bat` to try it and
   `release.bat` to send it. If his build stops with `EBUSY ... app.asar`, the app is still running
   (`build-and-release.md` → "Build errors").

## Keeping these docs useful
- Write down what the code does not make obvious: where something lives, a rule, a trap, a decision of the owner's. Put
  it in the one `ai-context/` file for its topic; it goes here only when it bites across areas (then as one row above).
- Write rules in the present tense. Version-by-version history belongs in `CHANGELOG.md`.
- Leave what one lookup answers to the lookup (`package.json` scripts, `.gitattributes`, a file's header comment).
