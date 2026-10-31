# CosmoNotes

Windows sticky-notes app (Electron 39, plain JavaScript, no framework or bundler). Notes are stored locally only.
The owner is not a programmer: explain changes in plain language, and edit files in this folder in place.
Keep each file's existing line endings: they are mixed (`main.js`, `preload.js`, `src/note.*`, `build.bat` are CRLF;
`store.js`, `src/list.*`, `src/fx/*.js`, `src/about.js`, `package.json`, `CHANGELOG.md` and `ai-context/*.md` are LF).

## Commands
- `npm test`: all tests under plain Node (`tests/fake-electron` stands in for Electron). Run it before saying a change is done.
- `npm start` or `test-run.bat`: run the app from this folder (Windows only).
- `build.bat`: the owner double-clicks it to build `dist/CosmoNotes Setup <version>.exe`. Don't build yourself. There is no linter.
- Only a real Windows PC can confirm the installer, always-on-top, the tray, start with Windows, the microphone and the spellchecker download. Say so; don't claim they work.

## Golden rules
1. **Never risk losing a note.** Local-only, atomic saves, backups, the Bin. No cloud, no accounts, no destructive change without asking.
2. **Every update raises the version** in `package.json`: always the third digit (1.1.23 → 1.1.24), unless the owner says not to. The owner decides when the first or second digit goes up.
3. **Never modify `CosmoNotes.exe`** (no rcedit / resedit / afterPack / fuses / asar integrity). It must stay byte-identical to Electron's own `electron.exe`, or Windows Smart App Control blocks the app. Details: `ai-context/build-and-release.md`.
4. **Keep `appId` `com.stickypins.app` and the `stickyfile://` scheme.** Existing installs and saved notes depend on them.

## Pitfalls that have bitten before
- **Saves into the owner's folder can silently keep the OLD file** (seen in 1.1.23). After writing through the folder bridge (`device_commit_files`), stage the file back and compare its sha256 or size with what you meant to save. Tell the owner if a write did not land.
- **Hidden locked notes:** never send their `html` / `text` / `firstImage` to a window or the list, and a hidden window must never save. See `architecture.md`.
- **Zoom:** anything that turns mouse or screen pixels into sizes inside a note must divide by `zoomNow()`. Don't use Electron's page zoom.
- **Effects:** a new effect or follower needs its id in both `src/fx/` (its `effects-*` / `followers-*` file and `ORDER` in `engine.js`) and `store.js`. Draw on the shared canvas loop: no `Path2D`, no per-particle DOM or CSS animation, no per-frame `createRadialGradient` / `filter`, and it must also work with `m === null`. See `effects.md`.
- **Ink:** never thin out or re-smooth saved points; drawings drift ("dance") a little more on every pass.
- **Pop-up colours:** use the `--pop-*` variables, never hard-coded colours.
- **Tests:** only the newest `tests/v<version>.test.js` asserts the version. Move that check when you bump it (`ai-context/testing.md`).
- Don't open `app.asar` with the Claude desktop app's file tools: it keeps the archive open and the next build fails with `EBUSY`.

## Every update (checklist)
1. Raise the version in `package.json` (third digit).
2. `src/about.js`: add the version at the top of `VERSIONS` and set `LAST_UPDATED`; keep the in-app feature list there in step with any feature you add or change. Keep the version entry short (the owner's wish since 1.1.13): a few plain one-line highlights.
3. `CHANGELOG.md`: the same entry at the top, with the details. It keeps only the two newest versions: move the oldest one into `CHANGELOG-archive.md` (top of its list).
4. `ai-context/CONTEXT.md`: the "Last updated" line, plus the one `ai-context/` file whose topic changed (new feature → `feature-map.md`; new field or setting → `data-model.md`; a new rule or trap → the matching file).
5. `HOW TO INSTALL.txt` and `build.bat`, only if they mention the version or file name (neither hard-codes it since 1.1.5).
6. `npm test`. The owner then runs `build.bat`.
7. If files go into the owner's folder through the desktop app, verify each one on the device (see Pitfalls). If his build then stops with `EBUSY ... app.asar`, the app is still running (`build-and-release.md`).

## Saving tokens (these files are big)
- **Never read a big file whole:** `src/note.js` (~165 KB), `src/list.js` (~115 KB), `CHANGELOG-archive.md` (~85 KB), `src/note.css`, `src/list.css`, `main.js` (60–75 KB). Grep for the name first (`ai-context/feature-map.md` lists them), then read only those lines. Each file is split into sections by comment headers (`// ----…` in JS, `/* ---------- name ---------- */` in CSS): grep them for an outline. The effects are split into `src/fx/*.js` (9–34 KB each): `ai-context/effects.md` says which file holds what; open only that one.
- **Never list the folder recursively** (it walks `node_modules`): list the one folder you need.
- **Adding a version entry:** read only the top of `CHANGELOG.md` and the start of `VERSIONS` in `src/about.js` (around line 143), and insert the new entry there. Don't open `CHANGELOG-archive.md` unless you need old history.
- **Tests:** put a new version's tests in its own `tests/v<version>.test.js` and don't grow the old files. Open an old test only when it fails.
- **Previews for the owner's picks:** update the existing preview page (a new version of the same artifact) instead of building a new page each round, and show only the options still being decided.

## Where to read more (open only what the task needs)
`ai-context/CONTEXT.md` is the map: what the app is, the folder layout, and which file to open for which job.
`architecture.md` (processes, IPC, security, locks) · `data-model.md` (files on disk, note fields, settings, groups) ·
`feature-map.md` (feature → code) · `ui-gotchas.md` (editor, toolbars, list) · `effects.md` (`src/fx/`) ·
`build-and-release.md` (build, Smart App Control, saving files) · `testing.md` · `splitting-code.md` (before splitting a big file).

## Keeping these docs useful
Write down what the code does not make obvious: where something lives, a rule, a trap, a decision of the owner's.
Version-by-version history belongs in `CHANGELOG.md`, not here. Don't copy long how-it-works prose into this file.
