# CosmoNotes – version history

The app shows no version history (since 1.1.41): it lives only here and in [`CHANGELOG-archive.md`](CHANGELOG-archive.md).
Settings → About CosmoNotes shows the version, the date of the last update and the feature list.

This file keeps only the **two newest versions**. Older ones (1.3.37 back to 1.0.0) are in the archive. When a new
version is added at the top, move the oldest one here to the top of the archive.

**Renumbered in 1.1.41.** Six big versions were split into smaller ones, so the numbers from 1.1.13 on moved up. Each
heading says what it was. Version numbers written before 1.1.41 (in code comments, test file names such as
`tests/v1131.test.js`, `ai-context/`, and the text of older entries) are the old ones (tests are named by area since 1.1.49):

| Old number | New number |
|---|---|
| 1.0.0 – 1.1.12 | the same |
| 1.1.13 | 1.1.13 and 1.1.14 |
| 1.1.14 | 1.1.15 |
| 1.1.15 | 1.1.16 and 1.1.17 |
| 1.1.16 | 1.1.18, 1.1.19 and 1.1.20 |
| 1.1.17 – 1.1.19 | 1.1.21 – 1.1.23 |
| 1.1.20 | 1.1.24 and 1.1.25 |
| 1.1.21 | 1.1.26 |
| 1.1.22 | 1.1.27, 1.1.28 and 1.1.29 |
| 1.1.23 | 1.1.30, 1.1.31 and 1.1.32 |
| 1.1.24 – 1.1.31 | 1.1.33 – 1.1.40 (old + 9) |

## 1.4.0 – 14 November 2026

Updates without building: CosmoNotes finds a newer version on GitHub and installs it with one click (Settings → About,
or the tray). Releases are built and published by GitHub Actions; `release.bat` sends one.

- **In the app** (`main/updater.js`, `main/ipc-update.js`): Settings → About has Updates (Check for updates; Version X
  is ready + Install; the download's progress and Cancel; Couldn't download / Couldn't start + Open the download page
  and Try again) and a "Check for updates" switch (`settings.updateCheck`, on): the installed app checks 30 s after it
  starts and once a day (an hourly tick, so a PC that slept still checks). A quiet check that fails shows nothing. A
  newer version puts a dot on the Settings tab and About's heading, and "Update to X…" in the tray menu (it opens
  Settings → About).
- **The feed**: `latest.yml` from the newest GitHub release (electron-builder writes it). Only main goes online, only to
  `github.com/vkashirski/CosmoNotes/releases`. The file name must be `CosmoNotes-Setup-<version>.exe`, with a size and
  a sha512.
- **Install** asks first, then downloads to `%TEMP%\CosmoNotes-update` as `.part`, checks size + sha512 (a wrong file
  is deleted, never started), and quits like Quit: every window saves on unload, will-quit finishes recordings and
  flushes the store, and only then the installer starts (`--updated /S --force-run`: silent, and it opens CosmoNotes
  again with the notes where they were). Not during a voice recording or voice to text ("busy"); one that starts
  during the download is waited for. If Windows refuses the installer (Smart App Control, antivirus), CosmoNotes opens
  again by itself (`--update-failed=<version>`) at Settings → About: "Couldn't start the update." Installers from
  earlier updates are deleted at start. `npm start` can check but not install.
- **Releases** (`.github/workflows/release.yml`): a pushed tag `v<version>` runs `npm test` with the browser tests on
  Linux, then builds on Windows (`npm ci`, `--publish never`), checks that `CosmoNotes.exe` is Electron's own
  `electron.exe`, and only then publishes the installer, its blockmap and `latest.yml` (`gh release create`) with this
  CHANGELOG entry as the notes (`build/release-notes.js`). `release.bat` checks you're on main with everything
  committed and the version not released yet, asks, pushes main and the tag, and opens the Actions page.
- **The installer is now `CosmoNotes-Setup-<version>.exe`** (dashes: GitHub renames spaces, which broke the name in
  `latest.yml`). `package.json` names the GitHub repo (`build.publish`); `build.bat` builds with `--publish never` and
  stays for local builds.
- **Line endings are fixed in git** (`.gitattributes`): a fresh clone, or GitHub's Windows machine, gets the CRLF / LF
  files CLAUDE.md lists. Before, git stored them all as LF and only the owner's working copy had the CRLF ones, so a
  fresh clone failed `code-structure.test.js`.
- Tests: `updates.test.js` (main's side, against a local server playing GitHub), About → updates in
  `list-ui-settings.test.js`, `release.test.js` for the 1.4 series (1.3 ends at 1.3.38).

## 1.3.38 – 12 November 2026

Only a checklist box itself ticks its line (the owner's wish): a click under the box, beside a long line's other rows,
or in the gap between the box and the words now just puts the caret there.

- Cause: `boxAt` (checklists.js) took any press left of the words (the line's whole `padding-left` strip, all the way
  down a wrapped line) as a press on the box. Now it hit-tests the box's own rectangle: the line's `::before` as
  `alignChecks` placed and sized it (`getComputedStyle(li, '::before')` left / top / width / height, in the note's px:
  `zoomOf`). The old check for lines nested in it is gone: their space is never inside the box.
- Dragging a box to move its line starts the same way, so it also needs a press on the box itself.
