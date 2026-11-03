# CosmoNotes – version history

The app shows no version history (since 1.1.41): it lives only here and in [`CHANGELOG-archive.md`](CHANGELOG-archive.md).
Settings → About CosmoNotes shows the version, the date of the last update and the feature list.

This file keeps only the **two newest versions**. Older ones (1.2.1 back to 1.0.0) are in the archive. When a new
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

## 1.2.3 – 3 November 2026

The notes list redraws less after a note changes: its own work on each refresh is 2–4 times faster. It looks the same.

- The owner asked whether the app redraws too much. Measured in Chromium first (60 and 200 notes, with and without
  an effect): typing in a note costs about 5 ms a key, fine. A list refresh (a note was edited) cost 3.6 ms of the
  list's code at 60 notes and 10.6 ms at 200. Now 1.5 ms and 2.8 ms.
- The list already kept every card whose note didn't change (`cards.js`, the card cache). But after each refresh it
  still measured every card (`markMore`, which forces a layout) and looked at every card's effect (`paintFx`:
  `resolve`, `resize`, `set`). Now only the cards built again get that. When the card size, the theme or the window's
  width changed, or an effect setting changed, every card is done again, as before.
- A card body is marked `data-m` once measured. A card that couldn't be measured yet is measured on the next refresh.
- `noteById` (`list/base.js`) finds a note by id from an index, instead of searching all notes once for each card
  (`itemOfKey` in `picking.js`, `paintFx`).
- What still costs the most: effects on the cards. Each card with an effect is its own small animation (24 on screen in
  a normal window). With an effect on every card, the list uses about 14 % of one processor core at rest (60 notes,
  in Chromium without a graphics card). Without effects, about 0 %. Nothing about the effects changed in this version.
- Tests: a refresh keeps the unchanged cards, builds and measures the edited one, and both keep their effect.

## 1.2.2 – 3 November 2026

The bar for several picked notes has **Edit design** instead of Colour: the same pop-up as right-click → Edit design.

- The owner's wish. It opens the Edit design pop-up for all the picked notes (and the notes in picked open groups),
  in the middle of the window. The right-click menu on a picked card has it too.
- Colour, see-through, Background and Mouse go to every note. A setting the notes don't share says **Mixed** until
  you pick one. The preview shows the first note.
- An effect change sends only that setting (`fxKeys` in main `list:edit`), so each note keeps its other effect picks.
- No title for several notes (the paper says "3 notes"). "Open note" becomes "Open notes".
- The old Colour pop-up also changed the font. So the pop-up has a **Font** row, only for several notes (one note's font
  is set in the note itself). It goes through `list:apply`, as before.
- The Colour pop-up (`#bColor`, `#bulkColors`, `bulkApply`) is gone. Its styles (`.bulkpop`, `.bsw`, `.bfonts`) are
  still in `list-picking-edit.css`, unused.
- Tests: `list-ui-picking` (Edit design for two notes: colour, see-through, font, an effect setting, titles left
  alone); `list-ui-settings` (no Font row for one note).
