# CosmoNotes – version history

The app shows a short, plain-language version of this list: notes list → Settings → About CosmoNotes → Version history
(source: `src/about.js` → `VERSIONS`, shortened in 1.1.13 at the owner's request: only the important changes, one line each).
Keep both up to date; the details belong here.

This file keeps only the **two newest versions**. Older ones (1.1.23 back to 1.0.0) are in [`CHANGELOG-archive.md`](CHANGELOG-archive.md). When a new version is added at the top, move the oldest one here down to the top of the archive.

## 1.1.25 – 31 October 2026

- **Fixed: Ghost ripple as a mouse effect.** Switching it on threw an error: the Layer draws once before the first step,
  and the follower's dots had no brightness (`near`) yet, so `bucketDots` got NaN. The error stopped whatever came
  after: in a note, the effects setup half-way (pause and rolled-up were not applied); in the notes list, the effects of
  every card after that note. Now `near` counts as 0 until the first step (`followers-lab.js`, the `ghost` follower).
  Checked with the drawing recording from 1.1.24: only the six Ghost ripple runs changed (three more drawing calls each,
  the first drawing now finishes); the other 171 runs are identical.
- Tests: `v1125.test.js` switches on every background and every follower, on light and dark paper, and draws before
  anything has moved: none may throw or draw at NaN.
- Docs: `ai-context/splitting-code.md`, what was learned splitting `src/fx.js`, for splitting other big files later.

## 1.1.24 – 30 October 2026

Behind the scenes only: nothing in the app looks or works differently.

- **The effects code is split into smaller files.** `src/fx.js` (about 180 KB, 2,350 lines) is now eight files in `src/fx/`:
  `kit.js` (colours and shared helpers), `effects-classic.js`, `effects-lab.js`, `effects-magic.js` (the backgrounds),
  `followers-classic.js`, `followers-lab.js`, `followers-magic.js` (the mouse followers) and `engine.js` (order, choosing
  rules, the shared loop, the Layer, icons). `note.html` and `list.html` load them in that order; they share their helpers
  through `window.COSMO_FX_KIT`. Every line of code was copied unchanged; only the lines that open and close the two
  lists of effects became `Object.assign(…)`. A change to one effect now needs only its own file (9–34 KB).
- **How it was checked:** every background and mouse follower was run through the real Layer before and after, with the
  same random numbers and clock, on light and dark paper, at three frequencies and two sizes, with a moving, resting and
  leaving mouse: all 177 runs made the same 7,234,430 drawing calls. Both windows also load in Chromium with the same
  messages as before, and the effects draw.
- `src/fx.js` is now only a note that says where the code went; it is not loaded any more and can be deleted.
- Tests: `tests/fx-source.js` loads the parts the way `note.html` lists them (the effects tests use it);
  `v1124.test.js` checks that both windows load the same parts in the same order, that every part is loaded, that each
  part keeps to itself, and that together they give the same effects as `store.js`. The version check moved there.
- Docs for AI assistants: a short `CLAUDE.md` plus one file per topic in `ai-context/`; older versions of this changelog
  moved to `CHANGELOG-archive.md`.
- Found while checking (not changed): the Ghost ripple mouse follower throws an error once when it is switched on, before
  the mouse has moved (its dots have no brightness yet on the first drawing). It works normally after that.
