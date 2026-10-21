# CosmoNotes

Windows sticky-notes app (Electron). **Before doing anything, read `ai-context/CONTEXT.md`.** It
explains what the app does, how it's built, where data lives, the rules that keep notes safe, how to
test (`npm test`), and the release checklist.

Golden rules:
- **Every update raises the version** (package.json): always the third digit (1.0.2 → 1.0.3), unless the
  owner says not to. The owner decides when the first or second digit goes up. Record each version in
  `src/about.js` (in-app version history), `CHANGELOG.md` and `ai-context/CONTEXT.md`.
- **Never modify `CosmoNotes.exe`** (no rcedit/resedit/afterPack/fuses/asar integrity). It must stay byte-identical to
  Electron's own `electron.exe`, or Windows Smart App Control blocks the app. See CONTEXT.md §6.
- Never risk losing a note: local-only, atomic saves, backups, the Bin. No cloud, no destructive changes without asking.
- Edit this folder in place. The owner is not a programmer, so explain changes in plain language.
- When something changes, update `ai-context/CONTEXT.md`, `src/about.js` (in-app features + version
  history + LAST_UPDATED) and `CHANGELOG.md` together.
