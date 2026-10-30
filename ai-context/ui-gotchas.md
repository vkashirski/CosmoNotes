# UI gotchas – note editor, toolbars, pop-ups, notes list

Open this when working in `src/note.*` or `src/list.*`. Effects have their own file: `effects.md`.

## Drawing (draw-over)

- **Draw-over is SVG** (crisp, cheap, easy to hit-test). Don't switch it to a canvas without keeping the same saved
  format. Two erasers (`inkState.eraseMode`): "Whole line" removes whole strokes (`eraseAt`, `samplePoints` distance
  test); "Partial" (`rubOut`, called "Rub out" before 1.1.6) traces touched strokes into 2 px points along the same
  curves strokeEl draws (`tracePieces`, plain maths: keep it in step with `smoothPath`/`strokeEl`), drops the points
  under the eraser circle (radius `ew`×3 + half the line width) and saves each remaining run as its own pen/hl
  stroke, so shapes that are partly erased become pen strokes. **Never thin out or re-smooth those points**: a line
  whose points are ≤ ~3 px apart (`isDense`) is split as it is. Re-tracing/simplifying made drawings drift ("dance")
  a little more on every pass (1.1.6, fixed in 1.1.8). For speed: `boxOf` caches each
  stroke's bounding box, `queueRub` erases at most once per frame, and `paintInk` reuses each stroke's SVG element
  (`elCache`); `applyLayout` runs once when the drag ends. Toolbar tips are one short line (the bar must not change size); the eraser's size buttons stay visible and are
  only greyed out (`.iwidths.off`) for "Whole line". The undo list (`inkState.undo`) survives closing drawing (X/Draw), up to 50 steps,
  and is cleared when the note gets locked (`hideContent`). Pen/highlighter pointers: `CURSOR_SVG`, `toolCursor()`.
  Both floating toolbars (`#inkBar`, `#textPop`) use `movable()`: drag by any non-button spot (grip, gaps); saved in `localStorage.inkBarPos` / `textBarPos`; each has an X (`#inkX`,
  `#textX`), and the drawing toolbar a round pause/play button `#inkPz` outside it on the left (also drags it). Drawing ⇄ typing: `#inkPz`, the bottom bar or
  the text toolbar call `pauseInk()`; clicking a drawing tool
  or Draw calls `resumeInk()` (`inkState.paused`, `body.ink-paused`). Nothing ever disappears: the bar not in use is
  faded. `#textPop` (opens bottom-left) is NOT closed by `closePops()`: only A, its X or locking close it (rolling up only hides both toolbars: `body.rolled`)
  (`openText`/`closeText`, `body.text-open`). It fades while drawing or while the editor has focus. Its buttons act on
  the selection, or (1.1.16) with nothing selected what you type next, never the whole note (`onText`, `#tScope` says which; don't move the cursor after a button, it would forget the typing style). The only Undo button (with Redo `#btnRedo` right after it since 1.1.14, same rules: `redoAny`/`inkRedo`/`redoText`) is
  `#btnUndo` in the bottom bar (outside `.tleft`, so it never scrolls away; full opacity while the mouse is on the note
  (`body:hover`), otherwise it fades like the rest; the bar fades its children `#tools > *`, never `#tools` itself): `undoAny()` = drawing undo while drawing,
  else note-font undo (`textUndo`) or the editor's own undo. `note.size` (s/m/l) has no button any more (kept for old notes).
  The note's scrollbar thumb only shows on hover/focus. Shift snaps lines/arrows to 12 directions (`shapeEnd`).
  While drawing, the editor is
  `contentEditable=false` and `#inkCatch` gets the pointer. Mouse-wheel scrolling still works because the
  catcher sits inside the scroller.

## Toolbars, menus and pop-ups

- **Pop-up colours (1.1.16):** everything on a note's pop-ups/toolbars uses `--pop-*` variables, set per app theme by
  `body[data-apptheme]` (note.css end; `appTheme` = `listTheme`, in `noteSettings()`). Don't hard-code colours there.
- **Menus don't close each other (1.1.20, the owner's wish):** `openPop` leaves the other editing menus (`EDIT_POPS`: ⋯, Effects, Add)
  open, newest / clicked on top (`toFront`); each closes alone (`closePop(id)`: its X, its button, Enter in the title);
  Esc, a click in the note, rolling up, locking, drawing… close them all (`closePops`). `#btnCloseAll` (top bar, shown
  by `syncPops` when 2+ of ⋯ / Effects / Add / text toolbar are open) closes all, text toolbar included. Dialogs
  (`DIALOGS`: password, link, questions) still replace each other. Toolbars/menus dragged outside stick to a side only
  within `INK_SNAP` = 12 px (was 40).
- `snapInk` (1.1.22) docks a toolbar/menu only when its edge is within `INK_SNAP` (12 px) of the note's edge, either side (before: overlap of up to half its width still docked).
- **Switches (1.1.20):** a sliding switch sits right after its text (grid, text column `fit-content`), and switches one
  after another are wrapped in `.switches` at start-up (`groupSwitches` in note.js and list.js; CSS subgrid) so they
  line up. A new switch needs nothing extra; keep the `<span>` text + hidden `<input>` + `<i>` structure.
- **⋯ menu and Effects pop-up outside the note (1.1.16):** like the toolbars (`barOut` kinds `menu`, `fx`), dragged only
  by their `.igrip`, placed from the top (`movable(…, { handle, top })`). The menu's window is focusable (title field).
- **Text toolbar outside the note (1.1.16)** works exactly like the drawing toolbar below: `barOut()` makes one helper per
  toolbar (`kind` 'ink' / 'text', window name `cosmoInkBar` / `cosmoTextBar`); main keeps `win.<kind>Win/Out/State` and
  the `ink:*` messages carry `bar: 'text'`. `$`/`$$` search all outside windows (`outDocs`). Its window opens and closes
  with the text toolbar. The text buttons work from there because they use the saved selection (`savedRange`).
- **Drawing toolbar outside the note (1.1.15).** A page can't paint outside its window, so `#inkBar` *moves* (same DOM node,
  listeners and all) into a small window the note opens with `window.open('about:blank', 'cosmoInkBar')`. An about:blank
  window opened by a page is same-origin with it, so note.js can put elements into it and its code keeps running in the
  note. Rules that make this work: `$`/`$$` also search `outDocs`; anything that listens for the toolbar's pointer events
  must use `el.ownerDocument.defaultView`, not `window`; the drag captures the pointer on the page's `<html>` (an element
  that stays put), so it carries on when the toolbar changes windows; positions are screen coordinates. That window loads
  the note's stylesheets and copies `<body>`'s classes and data (`mirror`), plus `inkbar-out`. main.js allows only this
  window, only for note windows, and makes it frameless, transparent, not focusable (clicks never take the focus from the
  note, so the keyboard stays in the note) and a child (`parent`) of the note. Main places it (`inkSpot`: always fully on a
  screen; near a side = stuck, following the note's `move`/`resize`). It's made hidden when drawing starts and closed when
  drawing ends; its place is kept in `localStorage.inkBarOut`. Only the drawing toolbar does this; the text toolbar stays
  inside. Pause (`#inkPz`) and Clear all (`#inkClear`) are in the toolbar's bottom row (`.ifoot`) since 1.1.15, so nothing
  sticks out of it. Needs a check on real Windows (transparent window, focus, dragging across windows).
- **Pop-ups and toolbars in a small note** (1.1.16): a scrolling pop-up keeps its X visible (`pinX`); the text and drawing
  toolbars stay inside the note's top (`movable` → `fitIn`, `.fit-tall` scrolls). A new pop-up with an `.ix` X should get `pinX`.
- Rolling a note up keeps drawing/text toolbars open but hidden (`body.rolled`), so they never cover the top bar.

## Sizes and bars

- Minimum note size 200×120, default 340×300 (`MIN_W`/`MIN_H`/`DEFAULT_W`/`DEFAULT_H` in main.js). The bottom bar's
  formatting buttons scroll sideways (`.tleft`) on narrow notes so Undo, Draw and Add always stay visible.
- The top bar (1.1.13): All notes, New | title | (lock again) Pin, Roll, ••• | Minimise, Maximise, X. Its buttons are 24 px
  below 330 px and New hides below 250 px, so it fits the 200 px minimum.
- The bottom bar must fit on a 340 px note (the default width). Order: B I U S A | bullets checklist | word wrap
  spelling, then — outside the part that scrolls — Undo, Redo (1.1.14), Draw, Add. To fit with the "Draw" label, Undo and
  Redo, the `.tb` buttons are 24 px wide below 440 px and 20 px (tighter gaps) below 430 px; below 390 px Add becomes a round "+".
  At 340 px it fits exactly: measure with a screenshot after adding a button. Narrower notes scroll `.tleft` sideways.

## Editor, CSS and icons

- `#scroller` has the arrow cursor (scrollbars), `#sheet` the text cursor.
- `collect()` in note.js strips UI-only state (playing voice chips, `.sel-img`) before saving.
- Editor uses `contenteditable` + `execCommand` (deprecated but fully working in Chromium/Electron).
- **CSS gotcha:** a block of declarations without a selector makes the browser drop the NEXT rule too (that hid
  `#textPop.tbar` until 1.1.16). Check for orphan `}` / missing selectors when a rule seems to do nothing.
- **Padlock icons** (note lock screen, list cards): the shackle path reaches down into the body; `#lockClip` (note.html and
  list.html) only draws it above y 11, the middle of the body's top line, so no sliver of it ever shows inside the body
  (1.1.15). Keep that if the icon changes.

## Added in 1.1.22 – 1.1.23 (details also in CHANGELOG.md)

- **Ctrl+F in notes (1.1.23):** `#find`, `findHits` over the editor's text nodes → Ranges, shown with `CSS.highlights` `cn-find` / `cn-find-cur`, scrollbar marks `#findMarks`; Enter/F3 next, Shift prev, Esc closes and selects the match; nothing saved.
- **Picture descriptions (1.1.23):** right-click → Add description…, stored as the picture's `alt` / `title`; Ctrl+F finds and outlines the picture; the list's search looks in `pics` = `pictureWords(html)` from store.js, sent by `list:get`.
- **Checklist boxes (1.1.23):** sized / centred from each line's first words (`alignChecks` → `--cb-s/t/p`, stripped in `collect`; `alignChecks` measures first, then writes, so there is no layout per checklist line per key). Backspace at a checklist line's start = `outdent` (box removed). Ticked photos are struck through (`#strikes` overlay).
- **Photos (1.1.23):** Delete/Backspace next to a photo deletes it (`leafAfter` / `leafBefore`, `deleteSpan` with `execCommand` so Ctrl+Z works); the photo menu has Copy image + Open in photo viewer.
- **Notes list (1.1.22–1.1.23):** cards show checklist boxes (`checklistMarks` in store.js → `checks` in `list:get` → `.cb` in list.js / list.css); small card pictures are not enlarged (`fitThumb`); the card menu offers favourites and Edit design, and no Open on desktop. Edit design is a small tabbed pop-up next to the card (Colour / Background / Mouse, `#editTabs`, `.epane`, `editPlace()`), no dimming; picked items have a dark ring.
