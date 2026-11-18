# CosmoNotes – version history

The app shows no version history (since 1.1.41): it lives only here and in [`CHANGELOG-archive.md`](CHANGELOG-archive.md).
Settings → About CosmoNotes shows the version, the date of the last update and the feature list.

This file keeps only the **two newest versions**. Older ones (1.4.15 back to 1.0.0) are in the archive. When a new
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

## 1.4.17 – 18 November 2026

Bullets, Checklist, Tab and Shift+Tab change only the lines you're on, keep every other line's tick, and Undo always
takes them back (the owner lost 45 ticks in the To Do note: Bullets, then Checklist, wiped the whole list's ticks).

- **The cause:** Bullets in a checklist (`toggleBullets`, note/fx-format.js) made the whole list, every level, bullets and
  took every tick off; Checklist on a bullet list then made the whole list a checklist again, with empty boxes. Both
  changed classes outside Undo (no `domStep`), so Ctrl+Z did nothing. Ctrl+Shift+L / Ctrl+Shift+C (VS Code's "select all
  occurrences", the browser's copy and inspect) or a miss on the two buttons side by side was enough.
- **Now (new "list lines" section in fx-format.js):** both work on the cursor's line or the selected lines (`selLines`),
  each one Undo step with Redo. Those lines go into a list of their own (`splitOff`; the rest of the list stays as it
  was, ticks too; touching lists are still saved as one). A line has a box when any list around it is a checklist, so
  Bullets in a nested line changes its top-level line with what is nested in it (`checkLine`). A line made bullets loses
  its tick (it has no box); Undo gives it back. Checklist on lines that all have boxes is still the editor's own
  command (they leave the list); on words outside a list or a numbered line, the editor makes the list first, and a list
  that only holds those lines becomes a checklist in the same step, as before.
- **Tab / Shift+Tab** (`indentLines` / `outdentLines`): the same line moves one level in (into the list nested in the line
  above, a new one if it has none; a list's first line stays) or out (right after the line it was in; the lines after it
  at its level stay below it, nested in it). The editor's indent / outdent built a new line, so a ticked line came back
  unticked, and Tab left a list right inside a list. A top-level line with Shift+Tab still leaves the list (the editor's
  outdent).
- **Backspace at a checklist line's start:** a nested line goes one level out and keeps its tick; a top-level one leaves
  the list as before. Its tick is no longer taken off first, outside Undo (Undo brought the line back unticked).
- **Enter at the start of a ticked line:** the new, empty line above it has no tick (it took the tick along). The line a
  cut leaves empty keeps its tick on purpose: it is the same line, and taking it off would again be outside Undo.
- **A drawing cleared and Done** goes as one Undo step (`domStep`; before, Undo couldn't bring it back).
- Tests: `note-ui-lists.test.js`, new (Bullets / Checklist on the cursor's line, selected lines, a nested line, a bullet line, words
  under a list; Tab / Shift+Tab / Backspace keep ticks; Enter at a ticked line's start; Undo and Redo of each; the
  drawing). They fail on 1.4.16 at the owner's case.

## 1.4.16 – 18 November 2026

A card no longer blinks while you type in its note: it stays, and the new words write themselves onto it (Ink, the
owner's pick from five ways shown in a preview).

- **The cause of the blink:** every save of a note made the list build a new card and swap it in (`cached()` in
  `list/cards.js`). The new card started its effect over (a new canvas and `FX.Layer`), and its picture stayed hidden
  (`.wait`) until its load event, a frame or more later. Now a note that changed keeps its card: `refreshCard` moves the
  new card's parts into the card on screen, keeps the effect's canvas (the snow carries on), and keeps the classes others
  set (selected, favourite, cut…). The card's own handlers read the note as it is now (`noteById`), not the one it was
  built from. Group cards are still built again.
- **Pictures:** a picture the window already has is shown at once (fitted then, not at its load event), on every card.
- **Ink:** only the new letters write themselves in, one after the other (22 ms apart, each fading in over 0.24 s; at
  most 160 letters, half a second; a longer paste fades in after them). A line typed on writes in only its new letters; a
  line put in between leaves the lines after it alone; lines taken out, ticked boxes or a new colour write nothing in. A
  locked card that is unlocked doesn't write itself in. Off with "Reduce animations" in Windows.
- Tests: `list-ui-cards.test.js` (the edited card stays, keeps its effect's canvas, is measured again; only new letters
  ink, in order; still a favourite; its menu is the note's as it is now), `list-ui-pictures.test.js` (a picture shows at
  once on a card filled again).
