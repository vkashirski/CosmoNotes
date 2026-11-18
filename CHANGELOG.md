# CosmoNotes – version history

The app shows no version history (since 1.1.41): it lives only here and in [`CHANGELOG-archive.md`](CHANGELOG-archive.md).
Settings → About CosmoNotes shows the version, the date of the last update and the feature list.

This file keeps only the **two newest versions**. Older ones (1.4.16 back to 1.0.0) are in the archive. When a new
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

## 1.4.18 – 18 November 2026

The window you open or touch last is on top: a note, its toolbars and menus outside it, the notes list. Pinned notes
stay above the rest; of two pinned notes, the one touched last. A small note's » menu and the text's right-click menu are
now the app's own, in the app theme's colours, not Windows' menus.

- **The cause (window order):** Windows brings a window up only when a click gives it the focus. Most of a note's
  windows outside it (drawing and text toolbars, Effects, Checklists) never take the focus (the keyboard stays in the
  note), so a click on one left it under whatever covered it, and its note too; the order of pinned notes (`raisedAt`)
  was only stamped on a click in the note itself, so 2.5 s later `enforcePinned` could put a note whose toolbar you had
  just used back under another one. A window that already had the focus didn't come up either once another of ours had
  come up over it.
- **Now:** every window tells main when it is pressed (`win:touch`, preload `touch`): the note's page (`touch('')`,
  panels.js), each window outside a note (`touch(kind)`, `barOut`, also when one is shown) and the list (events.js).
  Main brings it up (`touchNote`, main/note-window.js: stamps `raisedAt`, `moveTop`, a peek for a note pinned over
  apps); a note's windows outside it then come up in the order they were opened or touched, the one touched on top
  (`liftBars`, main/ink-window.js, `c.liftedAt`). Nothing is saved and no window takes the focus.
- **» menu (src/note/top-bar.js):** it was main's `Menu` (Windows' look, no pictures). Now it is a menu like the
  right-click one (`#moreMenu`, `.ctx`, `--pop-*` colours), each line with its button's picture and a tick on the pin when
  it is on. It opens in a see-through window of its own just under » (a new outside kind, `'more'` / `cosmoMoreBar`,
  `barOut(...).showAt`), so it still shows whole on the smallest and on a rolled-up note (`SHOWS_ROLLED`; toolbars stay
  hidden while rolled up). Esc, a click in the note, » again, the note losing the focus, rolling up, or a wider note (no
  ») close it. `note:bar-menu` / `note:bar-act` and preload `barMenu` / `onBarAct` are gone.
- **One menu for the note (src/note/menus-voice-ink.js `showMenu`):** the » menu, the right-click menus of pictures,
  links, voice notes and tables (in the note before, cut off on a small note) and the text's Cut / Copy / Paste /
  spelling / Add ▸ (Windows' menu from main before) are now the same menu (`#ctx`) in its own window (kind `'more'`,
  made on first use with `K.barOut`). Lines can have a picture, a tick, or › for a sub-menu (Add ▸ shows its lines in the
  same menu, with a way back). The keyboard stays in the note: ↑ ↓, Enter, → / ←, Esc; any other key closes it. For the
  text's menu main still knows the spelling and does the line picked: it sends the lines by id (`note:ctx`, main/web.js)
  and runs the one that comes back (`note:ctx-act` → `runCtx`: Cut / Copy / Paste / Select all, fix a word, Add to
  dictionary, Add ▸); only an id of the last menu counts. The list and a note's windows outside it keep Windows' menu.
- Tests: windows.test.js (touch order, pinned notes, the list, the » window on a rolled-up note), safety.test.js (the
  sixth outside window), note-ui-bar.test.js (the menu in its window: lines, pictures, tick, theme colours, closing,
  rolled up; the text's menu: its lines, an off line, the keys, Add ▸ and back, picks), windows.test.js (`note:ctx`
  lines by id, Paste / a suggestion / Add ▸ done by main, an old id does nothing, Windows' menu outside the note),
  note-ui.test.js (the right-click menus are found in their window). Only a real Windows PC can confirm the order of the
  windows and the menu's window.

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
