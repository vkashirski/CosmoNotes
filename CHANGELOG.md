# CosmoNotes – version history

The app shows no version history (since 1.1.41): it lives only here and in [`CHANGELOG-archive.md`](CHANGELOG-archive.md).
Settings → About CosmoNotes shows the version, the date of the last update and the feature list.

This file keeps only the **two newest versions**. Older ones (1.3.36 back to 1.0.0) are in the archive. When a new
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

## 1.3.38 – 12 November 2026

Only a checklist box itself ticks its line (the owner's wish): a click under the box, beside a long line's other rows,
or in the gap between the box and the words now just puts the caret there.

- Cause: `boxAt` (checklists.js) took any press left of the words (the line's whole `padding-left` strip, all the way
  down a wrapped line) as a press on the box. Now it hit-tests the box's own rectangle: the line's `::before` as
  `alignChecks` placed and sized it (`getComputedStyle(li, '::before')` left / top / width / height, in the note's px:
  `zoomOf`). The old check for lines nested in it is gone: their space is never inside the box.
- Dragging a box to move its line starts the same way, so it also needs a press on the box itself.

## 1.3.37 – 12 November 2026

The search rows (Notes, Bin, Settings) stay at the top while you scroll, and are now solid (the owner's report): what
scrolls under them no longer shows in a thin strip above the search box, at its corners or between its buttons.

- Cause: `.searchrow` (list-base.css) is `position: sticky` with no background, so its 2px top padding, the box's
  rounded corners and the gaps between the buttons were see-through. Fix: it gets the window's colour and dots
  (lined up with the view's at the top: `-12px -88px`) and a solid 8px edge below the box (`padding-bottom: 8px`;
  `margin-bottom` 12px → 4px, and Settings' `-8px` with its 12px gap, so the spacing at the top is unchanged).
- Once the view scrolls, a soft shadow appears under the row (`searchShade`: a scroll-driven animation,
  `animation-timeline: scroll(nearest)`, no JS; `--searchShade` is darker in dark themes).

