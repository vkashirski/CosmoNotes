# CosmoNotes – version history

The same list is shown in the app: notes list → Settings → About CosmoNotes → Version history
(source: `src/about.js`). Keep both in sync.

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
