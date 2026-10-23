# CosmoNotes – version history

The same list is shown in the app: notes list → Settings → About CosmoNotes → Version history
(source: `src/about.js`). Keep both in sync.

## 1.1.12 – 23 October 2026

- **No sideways scroll into empty space:** with word wrap off (`note.wrapWidth`), `#sheet` keeps its old width, so a note made narrower could scroll sideways into nothing (e.g. a small photo and short lines). note.js `fitSideways()` measures how far the real content reaches (`contentRight()`: text line boxes via `Range.getClientRects`, plus `img, video, canvas, svg, table, .voice` and `inkBounds()`) and sets `#scroller` to `overflow-x: hidden` (and `scrollLeft = 0`) when it all fits in the visible width; otherwise `overflow-x` goes back to auto. The layout itself is unchanged, so nothing re-wraps and drawings stay lined up. Re-checked (once per frame) on `applyLayout`, edits (MutationObserver), `ResizeObserver` on `#scroller` and `#editor`, picture `load`, `paintInk` and when fonts are ready.
- **Dividers run the whole width:** `#editor hr { width: max(100%, var(--viewW)) }`, so with word wrap off and a note made wider than `wrapWidth` the line still reaches the right side (inside list items and table cells it stays `auto`).
- **Word wrap icon:** five lines with a W cut out of them (SVG `<mask id="wrapW">` in note.html; `#btnWrap .lines`). Off: the slash as before, plus `.slashcut` in the mask cuts a gap around it so the W stays readable. `#btnWrap` now comes before `#btnSpell`. On = just the icon without the slash: `#btnWrap.on` has no `.tb.on` background (hover tint only).
- **Note menu switch:** "Turn solid when my mouse is over it" (`#solidHover`) is a sliding switch (`label.check.switch` + `<i>`, note.css; same look as Settings' `.toggle`, a bit smaller).
- **Add panel:** "Date" → "Today’s date".
- **New setting `defaultSolidOnHover`** (default true): Settings → General → For new notes, toggle `#sSolidHover` under the see-through slider. main.js `settings:set` stores it; `store.create` gives new notes `solidOnHover` from it (existing notes unchanged; each note still has its own checkbox in the ••• menu). Test in `tests/pin-theme.test.js`.
- **Caret next to photos:** a tilted photo (`transform: rotate`) is painted over the caret beside it. note.js gives photos right before/after a collapsed caret the class `.caret-near` (`imgsByCaret()` on `selectionchange`) → note.css `position: relative; z-index: -1`, so the caret shows on the photo's edge. A layered-down photo inside a `<p>`/`<div>` can't be hit-tested, so the class is dropped as soon as the mouse is over the photo (`mousemove`, `overImg()`; its left `EDGE` px don't count) and isn't added while the mouse is on it. `collect()` strips the class; the MutationObserver doesn't watch attributes, so it's not an edit.
- **Clicking beside photos and lines:** clicks in `#scroller`'s side padding used to jump to the end of the note; now `besideLine()` puts the caret before/after a picture on that line, or at the start/end of the text line (`caretRangeFromPoint`). Below the text it's still the end. A left click on the first `EDGE` (7) px of a photo puts the caret in front of it instead of selecting it (`edgeDown` skips the click/dblclick that follows).
- **Picture-only cards:** list.js `cardBody` drops the stand-in text "🖼️ Photo" / "✏️ Drawing" (`PICTURE_ONLY`, must match `collect()` in note.js) when the card shows the picture. The stored `text` is unchanged, so search still finds "photo".

## 1.1.11 – 23 October 2026

- **Undo at full strength on the note:** the bottom bar's fading moved from `#tools` to its children (`#tools > *`); `#btnUndo` follows the same rules but gets `opacity: 1` whenever the mouse is on the note (`body:hover`), also while drawing fades the rest. It is never disabled either. `#stamp` is kept clear of it (max-width −150 px).
- **Pause button** `#inkPz`: a round button stuck to the left of `#inkBar`, outside it (`movable(..., roomLeft: 40, dragBtn: #inkPz)`, so it moves with the toolbar and can drag it; a drag isn't a click): `pauseInk()` / `resumeInk()`; it shows a play icon and stays at full opacity while paused. The capture listener that resumes drawing on any toolbar click skips it. The `.iside` drag tab (1.1.10) is removed; the toolbar is dragged by any empty spot.
- **Mouse back / forward buttons** in the notes list: every change of group level is remembered (`navBack`/`navFwd`, recorded in `render()` unless `navigating`); `navigate('back'|'forward')` skips levels that are gone or locked again. Triggered by `mouseup` with button 3/4 and by the window's `app-command` (`browser-backward`/`browser-forward` → `list:nav`, preload `list.onNav`); a second trigger within 250 ms is ignored, so one click never counts twice.
- **Settings → General reordered:** Start with Windows, then the window colours, then a "For new notes" heading (`.subhead`) with Colour, Font and a new **See-through** slider (`#sOpacity`, saved on release). New setting `defaultOpacity` (0.25–1, 5 % steps, main.js `settings:set`), used by `store.create`.
- **Bring to front unrolls:** `bringToFront({ unroll: true })` from the list button (`list:bring-front`) and the tray item also unrolls rolled-up notes (`store.update` + `setRolled` + `note:look`; note.js `onLook` now takes `rolled`). Starting CosmoNotes again (`second-instance`) only brings notes up, as before.
- **Rolling up keeps the toolbars:** the roll button no longer calls `exitInk()` / `closeText()`; it finishes a stroke and saves, and `body.rolled` hides `#inkBar` and `#textPop` until the note unrolls (they're placed again on the resize).
- **Speed-ups (behaviour unchanged):**
  - Notes list: date formats are made once (`FMT`, `Intl.DateTimeFormat`) instead of a new formatter for every card — that was most of a redraw. A background refresh reuses every card whose data didn't change (`cardCache`, keyed by note/group, compared by JSON of what the card shows) and only moves/replaces what changed (`placeCards`); view changes still rebuild everything with the animation, and the cache resets at midnight ("Today"/"Yesterday"). 400 notes: a refresh went from ~280 ms to ~17 ms. A check confirmed the reused list is identical to a freshly built one after edits, opening, pinning, renaming, moving, binning, adding and locking.
  - `store.update` re-checks the drawing (`normalizeInk`) only when the drawing itself changed; otherwise it keeps the already-clean one. 50 typing saves on a note with a 60 000-number drawing: ~357 ms → ~1.3 ms in the main process.
  - `applyPatch`: a text/title save only updates the window title (`setWinTitle`, only when it really changes) instead of re-applying always-on-top, opacity and colour on every save. Note windows ignore `page-title-updated`, so the page's own `<title>` can't rename them.
  - The text toolbar's "Changes:" line is only rewritten when it changes (it ran on every cursor move).
  - Looked at and left alone on purpose: backups and attachment clean-up (rare, and they keep notes safe), drawing a long pen line (~1 ms per mouse move even at 1 500 points), the 2.5 s pinned-note check (by design).
  - Tests: `tests/speed.test.js`.
- Settings section titles (1.1.10): hover tint `color-mix(#FFE45C 16%, card)` (dark themes: `--card2`), rounded corners kept when open, room before the text, no focus ring after a mouse click (`mousedown` preventDefault on `.phead`).

## 1.1.10 – 22 October 2026

- **Settings sections fold:** list.js `foldPanels()` wraps everything below each panel's title (`h3`, or `.abouthead` for About) in `.pbody > .pinner`; the title gets `.phead` (clickable, keyboard too, chevron). Opening animates `grid-template-rows: 0fr → 1fr` plus a fade. All start closed.
- **Backups:** the list in Settings is replaced by the newest backup's line (`#backups`) and a "Restore from a backup…" button (`pickBackup`): a `modal()` with a pickable list of days (`content` option, `.bkpick`), then a result message naming the group.
- **Restored notes go into a group:** `store.restoreBackup` puts every note it brings back (new copies and notes un-binned from it) into a new top-level group "Restored Notes from <Weekday>, <d> <Mon> <yyyy>" (`backupDayName`). Nothing is overwritten, as before. Cards no longer say "Restored": they show the note's own created date (kept from the backup).
- **Toolbars:** an X (`#inkX`, `#textX`) on each; `#inkDone`, `#inkUndo`, `#tUndo` and the switch button `#inkPause` are gone. A small drag tab (`.iside`) sits where the switch button was (`movable(..., roomLeft: 16)`).
- **Independent:** `#textPop` is no longer closed by `closePops()` (other pop-ups, outside clicks, Esc, entering drawing); `openText()`/`closeText()`, `body.text-open`. Only A or its X closes it (and rolling up / locking). Drawing likewise only closes by Draw, its X or Esc.
- **Fading:** `#textPop` is at 40 % while drawing or while the editor has focus (`body:has(#editor:focus)`), 100 % on hover. Using the text toolbar while drawing switches to typing (capture listener), like the bottom bar.
- **One Undo button** `#btnUndo` in the bottom bar, outside `.tleft` so it never scrolls away: drawing → `inkUndo`, otherwise the note font (`textUndo`, cleared on any typing) or the editor's own undo (then the selection is collapsed so the panel goes back to "whole note"). Ctrl+Z does the same. Below 430 px the formatting buttons are 22 px so everything still fits on a 340 px note.
- Tests: store.test.js checks the restore group and its name.

## 1.1.9 – 22 October 2026

- **Text panel as a toolbar:** `#textPop` (class `tbar`) is 250 px wide like `#inkBar`, opens bottom-left, with a grip, a "Changes: whole note / selected text" line with an undo button (`#tScope`, `#tUndo`), the font (`#fontSeg`), colour and highlight dots, size (`#fsizeSeg`) and clear formatting (`#miClearFmt`). Every button goes through `onText()`: the selection, or the whole note when nothing is selected (select all, apply, put the caret back). Font with a selection = `fontName` (Caveat/Nunito, size-matched in note.css); without = the note's font. Undo = `textUndo` (editor undo steps + note-font changes). The note-wide 3-size buttons (`note.size`) are gone from the UI; existing notes keep their size.
- **It stays open:** the outside-click handler skips closing when `openPopId === '#textPop'`; only the A button (toggle), Esc, opening another pop-up, or rolling up closes it. Clear formatting no longer closes it. The selection it acts on is the current one (`selectionchange` → `saveSel` already tracked it).
- **Shared drag code:** `movable(el, { key, roomLeft, dragBtn })` now handles both the drawing toolbar (`inkBarPos`, 40 px room for the switch button, `dragBtn` = `#inkPause`) and the text toolbar (`textBarPos`). Drag from any non-button spot; double-click the grip to reset.
- **Cursor:** `#inkBar` no longer has `cursor: grab`; only `.igrip` shows the hand.
- **Switch badge:** `#inkPause .swap`, a small purple ⇄ circle on the button.
- **Scrollbars:** `#scroller` thumb is transparent unless `body:hover`, `:focus-within` or `.pop-open`. (Checked with scrollbars switched on in the test browser: Playwright hides them by default.)

## 1.1.8 – 22 October 2026

- **Fixed: Partial eraser made drawings "dance".** 1.1.6 thinned out the points of every leftover piece (`simplify`), and each later pass traced the smoothed curve again and smoothed it once more, so lines crept by a few px per pass (measured: up to 4.2 px after 25 passes). `simplify` is gone; leftover pieces keep their 2 px points, and a line whose points are already that close (`isDense`, cached) is split as it is, never retraced. Drift is now a one-time ≤ 0.5 px when a line is first erased, and doesn't grow. Speed stays the same (busy-drawing scrub ≈ 3.8 s, slowest step < 0.1 s).
- **Three more dark list themes:** midnight, forest, plum (`THEMES` entries with `dark: true`; list.js puts `.dark` on the body so the dark-only fixes in list.css apply to all of them; main.js `LIST_THEMES` for the window buttons).
- **Settings toggles back:** clicking the Settings tab while it's open returns to the last of Notes/Bin (`setTab`, `lastTab`).
- **Movable drawing toolbar:** a grip (`#inkGrip`) at the top of `#inkBar`; dragging sets `right`/`bottom` (kept inside the note and below the top bar, also when the note is resized: `placeInkBar`). Saved in `localStorage.inkBarPos` (distance from the bottom-right corner); double-click resets it.
- **Drawing ⇄ typing switch:** `#inkPause`, a round button stuck to the left of `#inkBar` (moves with it; `placeInkBar` keeps 40 px for it), showing a T (typing) or a pen (back to drawing). `pauseInk()` finishes the current stroke, saves the ink, hides `#inkCatch` and makes the editor editable (`body.ink-paused`); `resumeInk()` undoes that. The Draw button (highlighted while typing) also resumes. Ctrl+Z is text undo while typing. Esc/Done end drawing as usual.
- **Nothing disappears:** while drawing, the bottom bar stays at 35 % opacity (70 % on hover) and clicking any of its buttons switches to typing first (capture listener on `#tools`). While typing, the drawing toolbar stays, faded (38 %), and clicking any tool in it switches back to drawing (capture listener on `#inkBar`). The toolbar now starts just above the bottom bar (`bottom: 42px`).
- **Drag the toolbar from anywhere:** pointerdown on any non-button spot of `#inkBar` (grip, gaps, tip line), or on the switch button, moves the whole toolbar; the switch button only starts dragging after 4 px, and a drag doesn't count as a click (`draggedSwitch`). Tool buttons are never dragged.
- **Font and note text size moved** from the ⋯ menu into the A (text) pop-up (`#fontSeg`, `#sizeSeg` now in `#textPop`, labelled "whole note"; colour/highlight/size are labelled "selected text").
- **12 directions** for Shift + line/arrow (`shapeEnd` step π/6 instead of π/4).
- **"Draw" label** on `#btnInk`; `#btnText` moved right after strikethrough. Below 440 px the formatting buttons are 24 px wide with tighter gaps so everything still fits on a 340 px note; below 280 px the Draw label hides.
- `#stamp` opacity .5 → .35.

## 1.1.7 – 22 October 2026

- **Five card sizes** in the notes list and Bin: s 124×128, m 156×168, l 208×222, **xl 260×278**, **xxl 320×340** (`SIZES` in list.js; main.js accepts `listSize` s|m|l|xl|xxl). The size menu shows S/M/L/XL/XXL with a tip. A card never gets wider than the window (`min(var(--cw), 100%)`), so XXL fits a 340 px window.
- **Ctrl + mouse wheel** changes the card size one step per notch (wheel up = bigger), with a toast. Wheel deltas are added up and steps are at least 140 ms apart, so a touchpad doesn't jump straight to the end. `preventDefault` stops page zoom. Not in Settings or while a pop-up is open.
- **Undo after Done:** `enterInk` no longer clears `inkState.undo`; the list keeps the last 50 snapshots (was 100, per drawing session). `hideContent` clears it, so a locked note keeps no copies of its drawing.
- **Eraser sizes stay put:** `#inkWidths` is always shown with the eraser; for "Whole line" it gets `.off` (faded, buttons disabled) instead of `hidden`.
- **Over / Behind icons:** two overlapping squares (`.pg` = the note, `.ik` = the drawing, red); the one in front shows the layer.
- **Tool pointers:** pen = pencil, highlighter = marker, 24 px SVG data-URL cursors with the tip in the chosen colour and a white outline (`CURSOR_SVG`, `toolCursor()`, set on `#inkCatch` in `paintInkBar`). Hotspot at the tip (3, 21). Shapes keep the cross; the erasers keep theirs.

## 1.1.6 – 22 October 2026

- **List themes.** `settings.listTheme` (cream | rose | mint | sky | lilac | night), picked in Settings → General ("Colours of this window", `#sTheme`, `THEMES` in list.js). list.css now uses variables for every surface (`--card`, `--card2`, `--ink2`, `--ink3`, `--pillfg`, `--dot`, `--danger…`), and `body[data-theme]` overrides them. main.js `LIST_THEMES` / `paintListFrame()` recolours the window background and the title-bar overlay (window buttons) to match.
- **Fixed card size.** `.cards` uses `repeat(auto-fill, var(--cw))` and `.card { height: var(--ch) }` (s 124×128, m 156×168, l 208×222; Bin cards +30 px for their buttons). Resizing only changes the number of columns. Line clamps were set to fit; with a picture the text clamps to 1–2 lines (`.body:has(.thumb)`).
- **Bin search** (`#bq`, `#bqClear`, `binQuery`), same as the notes search; Esc clears it, Ctrl+F focuses the search of the open tab. The Bin text sits under the search row; "Empty bin" moved into that row.
- **Shift+click Delete** in the Bin skips the question (`destroyNote(n, skipAsk)`); the question has the tip.
- **Password or PIN.** `lock:set` takes `kind` ('pin' | 'password'); a PIN must be 4–12 digits. Stored as `settings.lockKind` and `settings.lockLen` (PIN length). `lockInfo()` sends both to the list (`list:get`) and to notes (`noteSettings`). The list `modal()` got `kindPick` (Password | PIN switch), `pin` inputs (digits only) and `pinLen` (submits by itself at that length). The note lock screen does the same (`paintUnlock`, auto-submit at `lockLen`), and the note's own "choose a password" pop-up has the switch (`#pwKind`). A wrong PIN clears the box and says "Wrong PIN"; a wrong password says "Wrong password". Old passwords (no `lockKind`) count as passwords.
- **Move up inside a group:** the `#dropOut` strip is gone (it pushed the cards down). The back button (`#btnBack`, left of the group name) glows while dragging and is the drop target; the path above still works too.
- **Group tip** ("drag a note onto another…") only shows while `settings.madeGroup` is false. store.js sets it in `createGroup` and on load if any group exists.
- **Envelope seal** is gold (`.e-seal`, `.seal` in the look picker) instead of red, so it isn't confused with the pinned-note pin.
- **Word wrap** replaces "lock text layout" in the UI (same `note.wrapWidth`): `#btnWrap.on` = word wrap on (no wrapWidth); off shows a slash like spelling. Short tooltip, toasts and question.
- **Draw-over:** "Rub out" → "Partial". Tips are one short line (`.ihint` single line, fixed height) and every toolbar row has a fixed height, so the toolbar doesn't jump between tools. Rolling up while drawing calls `exitInk()` first (`body.rolled #inkBar` hidden as well).
- **Faster Partial eraser:** `tracePieces` now works out the curves in plain JS (same maths as `smoothPath`/`strokeEl`) instead of `getPointAtLength` on a hidden SVG; bounding boxes are cached (`boxOf`); erasing runs once per animation frame (`queueRub`/`flushRub`); leftover pieces are thinned with `simplify` (0.35 px); and redraws reuse each stroke's SVG element (`elCache`, `paintInk`), with the sheet size updated when the drag ends. On a busy test drawing (250 strokes) a scrub went from 42 s to 3.6 s, slowest step 2.4 s → 0.13 s.
- **Cursor:** `#scroller` has the normal arrow (so scrollbars show it); the text cursor is on `#sheet`.
- Tests: `tests/pin-theme.test.js`.

## 1.1.5 – 22 October 2026

- **Build fix for computers with an old Node.js.** On the work laptop the global Node was 14, and the build failed (`stream/promises` missing). The installed `@electron/rebuild` 4.2.1 needs Node ≥ 22.12.0. `build.bat` now checks the version (major.minor, not just the major). If Node is missing or too old, it downloads Node 22.14.0 (win-x64 zip from nodejs.org, via PowerShell) into `tools\node` and puts it first on `PATH` for that window only. A later run reuses `tools\node`. The system Node and other apps are untouched. If the download fails, it opens nodejs.org with instructions.
- `tools` added to `.gitignore`.
- The final message reads the version from package.json (`node -p`) instead of the hard-coded “Setup 1.1.1.exe”. `HOW TO INSTALL.txt` no longer names a version.
- Kept from before: the `fc /b` Smart App Control check, the 15 s retry and the Windows Security explanation (now also mentioning that IT may have locked those settings on a work laptop).
- No app changes.

## 1.1.4 – 22 October 2026

- **Duplicate note**: list right-click (`noteMenu` → `S.list.duplicate` → `list:duplicate`) and the note's ⋯ menu (`#miDuplicate`: `saveNow()` + `saveInk()` first, then `note:duplicate`). Both call `duplicateNote(id)` in main.js → `store.duplicate(id, extra)`.
- The copy takes html, text, firstImage, ink, wrapWidth, colour, font, size, opacity, solidOnHover, spell, locked and groupId (deep-copied). A title gets " (copy)". It isn't pinned or rolled up, and it opens next to the original's window (or 30 px offset from its saved spot). New id and dates, so it sorts as just edited.
- Attachments aren't copied: both notes refer to the same files, and `sweepAttachments` only removes files no note or backup uses. Sketch edits always save a new file, so editing one note's sketch doesn't change the other's.
- Locks: a locked note's copy is locked (`locked` copied; a group lock follows from `groupId`). The copy's window starts unlocked only if the original's window was unlocked on screen, or its locked group is open in the list.
- Tests: `tests/duplicate.test.js`.

## 1.1.3 – 22 October 2026

- **Two erasers in draw-over.** With the eraser selected, `#inkColors` is replaced by `#eraseMode` ("Rub out" | "Whole line"). `inkState.eraseMode` is `'part' | 'stroke'` (default `'part'`), and `inkState.ew` (2/4/8, radius = ew × 3 px) is the rub-out size, set with the thickness buttons, which hide for "Whole line". Both are remembered in `localStorage.inkPrefs`.
- **Rub out** (`rubOut(a, b)`, called with the previous and current pointer position so fast drags leave no gaps): strokes whose bounding box is near the eraser are hit-tested (`segDist` for pen/highlighter segments). A touched stroke is traced into 2 px points along its real SVG geometry (`tracePieces`, `getPointAtLength` in a hidden `<svg>`; an arrow's head is split off as its own piece). Points within eraser radius + half the line width are dropped, and every remaining run of ≥ 2 points becomes its own `pen` (or `hl`) stroke with the same colour, width and layer. Rectangles and ellipses start their loop at an erased spot, so what's left stays in one piece. It uses the existing ink format, so store.js is unchanged. It's capped at 4000 strokes, like `normalizeInk`.
- A circle (`#inkEraser`) shows the eraser size, and the mouse pointer is hidden over the drawing (`body.rubbing-ink`). "Whole line" is the old `eraseAt` with the `cell` cursor. Undo works for both (one snapshot per drag).

## 1.1.2 – 22 October 2026

- **Fixed: pictures didn't shrink with a locked text layout.** With `note.wrapWidth` set, `#sheet` has a fixed width, so `max-width: 100%` on pictures meant the locked width, not the visible note. Pictures never shrank, and right-click → "Keep size when the note gets narrower" (`img.fixed`) changed nothing.
- Now `applyLayout` / a `ResizeObserver` on `#scroller` set `--viewW` (the visible writing width) on `#sheet`. With `#sheet.fixed:not(.inked)`, pictures without `.fixed` get `max-width: min(<normal>, var(--viewW))` (photos minus their 10px frame padding). The text still keeps the locked width.
- With a drawing (`#sheet.inked`, toggled in `applyLayout`) and a locked layout, pictures keep their size as before, so ink stays lined up. The right-click item shows "✓ Keep size (always on while this note has a drawing)" and explains how to unlock.
- Turning on "Keep size" for a picture without a `width` now stores min(natural width, text width) instead of its current, possibly squeezed, on-screen width.

## 1.1.1 – 22 October 2026

- **Smart App Control fix.** Smart App Control on the owner's PC had switched from Evaluation to On. It blocked the *first launch* of the freshly installed `CosmoNotes.exe`; the installer itself ran fine. Cause: each build produced a new, unsigned exe, because (a) our `build/afterPack.js` stamped icon and version info into it with rcedit, and (b) electron-builder embedded the asar-integrity resource (`addWinAsarIntegrity` via resedit). Running `test-run.bat` (`npx electron .`) proved that Electron's own unmodified `electron.exe` is trusted.
- Fix: removed the `afterPack` stamping (and the `rcedit` dependency), set `build.disableAsarIntegrity: true`, and kept `win.signAndEditExecutable: false`. So `dist\win-unpacked\CosmoNotes.exe` is byte-identical to `node_modules\electron\dist\electron.exe`. `build.bat` checks this with `fc /b` after every build.
- Icon: the exe now carries Electron's icon, so `build/installer.nsh` (`customInstall`) re-creates the Start menu and desktop shortcuts pointing at `resources\icon.ico` (copied by `extraResources`), with the same AppUserModelID. Windows and the tray keep their icon from main.js.
- Added `test-run.bat`: runs CosmoNotes straight from the project folder with Electron's original exe. It's handy for testing, and it uses the real notes in `%APPDATA%\CosmoNotes`.

## 1.1.0 – 22 October 2026 (big update)

- **Draw-over.** A squiggle button (`#btnInk`, left of Add) enters draw mode. The text can't be edited while drawing; a transparent catcher (`#inkCatch`) takes the mouse. The toolbar (`#inkBar`, bottom-right) has pen, highlighter, line, arrow, square, circle and eraser; 8 colours; thin/medium/thick; **Over / Behind**; undo (Ctrl+Z), clear all, and Done (Esc). Shift: straight pen/highlighter line, snapping to 45° for line/arrow, perfect square/circle. Hints in the toolbar and tooltips say so. The last-used tool, colour, size and layer are remembered.
- **Ink storage:** `note.ink = { s: [{ t, c, w, l, p }] }` in sheet coordinates (px from the text area's top-left), drawn as SVG in two layers (`#inkBelow` z0 / editor z1 / `#inkAbove` z2). Highlighter uses multiply blending. It's cleaned by `normalizeInk` (store.js), counts as an edit, is part of `SECRET` (blanked for hidden locked notes, can't be overwritten while hidden), and is saved 300 ms after a stroke and on close/blur.
- **Lock text layout** (`note.wrapWidth`, new `#btnWrap` next to spelling). `#sheet` gets a fixed width, so text and pictures never re-wrap, and `#scroller` scrolls sideways (with a thin scrollbar like the vertical one). The first stroke turns it on by itself. Unlocking while there's a drawing asks first. The sheet also grows to fit drawings (min width/height from the ink bounds).
- **Pictures:** right-click → Small / Medium / Full width (each asks first if there's a drawing), plus "Keep size when the note gets narrower" (`img.fixed`, `max-width: none`). Dragging the resize handle on a note with a drawing asks first (once per window).
- Bottom bar: the spelling button moved into the left group, with the layout-lock button next to it. Below 390 px width, Add shows as a round "+" so all buttons fit. The Add menu's "Drawing" pad is renamed "Sketch" to avoid confusion with draw-over. New notes default to 340 px wide.
- App-styled "are you sure?" pop-up in notes (`ask()` / `#askPop`).
- Tests: `tests/ink.test.js`. `main.test.js` was updated for the 340 px default.

## 1.0.4 – 22 October 2026

- Build fix: building 1.0.3 failed at the very end with `spawn UNKNOWN`. To make the uninstaller, electron-builder runs a small helper exe it just wrote to `dist\<Setup>.exe` (`NsisTarget.computeScriptAndSignUninstaller` → `WineVmManager.exec`; on Windows that's a direct run). Windows refused to start it, most likely Windows Security scanning or holding the brand-new unsigned file. `build.bat` now waits 15 s and retries once. If it fails again, it explains how to allow it (Protection history → Allow, or a folder exclusion), and asks to report a Smart App Control message, which needs a different fix.
- No app changes. 1.0.3 was never built, and 1.0.4 contains all of 1.0.3.

## 1.0.3 – 22 October 2026

- Search: a clear (×) button at the end of the box (Esc also clears). When a group is open, search only looks inside that group (and its sub-groups), and the box says "Search your notes inside this group".
- New note while a group is open creates it inside that group (`list:new(groupId)`). If the group is locked but opened in the list, the new note opens without asking for the password.
- Card size button (after sort): small / medium / large, saved as `settings.listSize` (s|m|l).
- Group settings: the paper colour and font that all notes inside share are shown as selected (this used to show nothing), with a note when they're mixed. It follows the "also groups inside" checkbox.
- Header: "New note" sits right after the CosmoNotes name, about 15% lighter.
- Settings: About moved to the end. Locked notes now has a single Set/Change password button that opens an app pop-up (no open form fields). Colour for new notes has a **random** option first (`defaultColor: 'random'` picks one of the 7 pastel papers, never charcoal), the same size as the other swatches.
- Notes list: a real title is bold (800) and slightly bigger. An untitled note's first line is semi-bold (600), between a title and normal text.

## 1.0.2 – 22 October 2026

- **Fixed:** the notes list redrew twice when changing the sort order (the list applied it, then the app told it to reload). Sort changes no longer trigger a reload, the list skips redraws when nothing changed, and cards only animate when the view changes. This also stops the flicker while typing in a note with the list open.
- **Groups inside groups** (a folder tree): drag a note onto a note inside a group to make a sub-group; drop notes or groups onto group cards; move things up with the back button, the path (crumbs) or the drop strip. A group can't go inside itself.
- **Group settings** (palette button inside a group): 4 looks (paper stack, folder, envelope, notebook), 8 group colours, and changing the paper colour or font of every note inside, optionally including sub-groups.
- **Lock groups** with the same password. A locked group asks for it when opened in the list. Notes opened from it don't ask again until the list closes or "lock again". Open note windows inside a group that gets locked save and hide themselves.
- **Right-click menus** in the list (notes, groups, Bin) to open, close, lock, unlock (asks for the password), move up, ungroup or move to the Bin, without opening the note.
- **Confirmations:** moving a note to the Bin asks first (Shift+click the bin button skips it, and the pop-up says so). Ungrouping asks first.
- **App-styled pop-ups** replace all Windows message boxes (delete forever, empty bin, restore backup, passwords). Only the photo file picker is still Windows' own.
- **Versioning rule:** every update raises the version (third digit) unless the owner says otherwise.
- Tests: `tests/groups.test.js`.

## 1.0.1 – 21 October 2026

- Renamed from **Sticky Pins** to **CosmoNotes**. On first start, notes, photos, backups and settings are copied from `%APPDATA%\Sticky Pins` to `%APPDATA%\CosmoNotes`, and the old folder is left as a safety copy. The installer replaces the old app.
- Top bar: **All notes** button (left of +), and **roll-up** moved onto the bar next to the pin.
- Optional **note titles** (set in the ⋯ menu), shown on the top bar.
- **Lock notes** with one password/PIN for all notes (⋯ menu). Contents are hidden in the note and in the list. This is a privacy screen, not encryption.
- **Spelling** on/off button on each note. Ignored by default, Cyrillic is never underlined unless turned on, and both are controllable in Settings.
- New **A** button (after Checklist) for text colour, highlight, size and clear formatting, moved out of Add.
- **Resize photos** by dragging the handle at their corner (min ~60px, max the note's width), with Small/Medium/Full-width presets on right-click.
- **Dates**: a last-edited stamp at the bottom of each note, and created/edited dates in the ⋯ menu. List cards show the created date.
- Notes list: **groups** made by dragging a note onto another, with optional **names**, opening, ungrouping and dragging notes back out.
- Notes list: **sorting** by last edited or date created, newest or oldest first, and groups first, notes first or mixed in.
- Settings: **About CosmoNotes** (everything the app can do, plus this version history), **Spelling** and **Locked notes** sections.
- Project: `ai-context/CONTEXT.md` for future development, this changelog, and `npm test`.

## 1.0.0 – 21 October 2026

First version, released as **Sticky Pins**.

- Local-only, crash-safe saving (one JSON file per note, atomic writes plus `.bak`), daily backups with 30 kept, and a Bin.
- Frameless sticky-note windows: pin on top, see-through slider (solid on hover), roll up, and reopening in the same place.
- 8 paper colours, handwritten (Caveat) or rounded (Nunito) font, and 3 text sizes.
- Bold / italic / underline / strikethrough, bullets and checklists.
- Add menu: photos, voice notes, drawings, links, tables, numbered lists, divider and date. Text colour, highlight and size.
- Notes list window with search, Bin and Settings (start with Windows, default colour/font, backups, data folder).
- Tray icon, single instance, and a Windows installer built with `build.bat`.
