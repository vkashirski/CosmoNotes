# CosmoNotes – version history

The app shows no version history (since 1.1.41): it lives only here and in [`CHANGELOG-archive.md`](CHANGELOG-archive.md).
Settings → About CosmoNotes shows the version, the date of the last update and the feature list.

This file keeps only the **two newest versions**. Older ones (1.4.6 back to 1.0.0) are in the archive. When a new
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

## 1.4.8 – 16 November 2026

The app pin's icon is a little window with the pin stuck into it, and a second right-click on the pin closes its list.

- **Icon** (the owner's pick): the "App letter" tile of 1.4.5 is gone. A note pinned over some apps shows the earlier
  little window again, now behind the pin (the pin on top, stuck into it): `.pinwin` in `src/note.html`, an svg of its
  own under the pin's (it doesn't tilt with the pin); the pin gets an edge in the top bar's colour (`note-base.css`).
- **Fix:** right-clicking the pin while "Pin over" was open opened it again. The note's mousedown closed it first
  (`panels.js`), then the right-click opened it. Now that mousedown leaves a right-click on the pin alone, and the pin's
  right-click opens the list or closes it (`src/note/pin-apps.js`).
- Tests: `note-ui-pins.test.js` (the window behind the pin; right-click opens, the next closes, the next opens).

## 1.4.7 – 16 November 2026

Moving a note no longer hitches twice a second while a note is pinned over an app.

- **Why:** the app pins' check (1.4.5, `main/app-pin.js`) reads every open window's title every 0.5 s. That read is costly
  enough that dragging any note stuttered on each check (the owner's PC).
- **The fix:** the check only runs while the focus is in another app. While a CosmoNotes window has the focus (moving a
  note, typing in it, the list), our app is the one in front and no other app can come in front, so there is nothing to
  read. When the focus leaves, a check runs at once (`focusMoved`, on the app's `browser-window-focus` / `-blur`), so a note
  also follows its app sooner than the next tick. Turning the watch on still checks once right away.
- Tests: `app-pins.test.js` (no clock while one of ours has the focus; a check at once when it leaves).
