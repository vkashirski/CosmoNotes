# CosmoNotes – version history

The app shows no version history (since 1.1.41): it lives only here and in [`CHANGELOG-archive.md`](CHANGELOG-archive.md).
Settings → About CosmoNotes shows the version, the date of the last update and the feature list.

This file keeps only the **two newest versions**. Older ones (1.4.21 back to 1.0.0) are in the archive. When a new
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

## 1.4.23 – 20 November 2026

A ticked checklist line's strike goes through the middle of the small letters, and Settings → Reminders → Hiding notes
says what it does more plainly.

- **The strike** (`note-text.css` `::highlight(cn-done)`): the owner found it still a little high. A line-through sits
  where each font says (Nunito's is above the middle of its small letters) and CSS can't move it, so the strike is now an
  underline moved up: `text-underline-offset: calc(-0.5ex - 0.75px)` puts the 1.5 px line's middle half an ex above the
  baseline, the ex of each run's own font and size (the note's `font-size-adjust` included), with no gaps at the letters
  (`text-decoration-skip-ink: none`). Cards keep their runs' line-through (a run can have its own underline too).
- **Hiding notes** (`src/list.html`): the hint is now "Let a reminder hide its note until it goes off." (was "A reminder
  can hide its note until then."; the owner offered "Hide a note until a reminder goes off.": the switch only lets the
  reminder panel offer it, so it says "let").
- **Tests:** `note-ui.test.js` (the strike's offset is half of each run's ex, no skip-ink).

## 1.4.22 – 20 November 2026

The Add panel's pictures have their names under them again (the owner's wish: 1.4.21 had pictures only).

- **The Add panel** (`#insert`, `src/note.html`, `note-toolbars.css`): still a row over the bottom bar at its right by +,
  each tile now a picture with its name (`.tl`, 10.5 px) under it, 56 px wide. Nine don't fit on a 340 px note, so the
  row wraps (two rows there; one row from about 540 px). The names are the tiles' words again (`addItems`, Add ▸'s lines),
  not a `title`.
- **Tests:** `note-ui.test.js` (the tile's name is its words).
