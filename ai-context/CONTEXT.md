# CosmoNotes – context for AI assistants and developers

**Last updated: 23 October 2026 · App version 1.1.11**

Read this before changing anything. Keep it up to date: when you add or change a feature, update the
relevant section here, `src/about.js` (the in-app feature list and version history) and `CHANGELOG.md`.

> ## ⭐ Versioning rule (the owner's instruction)
> **Every update raises the version number**, unless the owner says not to.
> - Always raise the **third digit** (1.0.2 → 1.0.3 → 1.0.4 …).
> - The **first or second digit** only goes up when the owner says so.
> - Each version gets an entry, with its date and what changed, in **`src/about.js` → `VERSIONS`** (shown in the
>   app under Settings → About CosmoNotes → Version history), in **`CHANGELOG.md`**, and in the "Last updated"
>   line above. See §8 for the full checklist.

---

## 1. What this is

CosmoNotes is a Windows desktop sticky-notes app (Electron), a cuter and more trustworthy replacement
for Microsoft Sticky Notes. It was called **Sticky Pins** in 1.0.0.

**The owner's priorities, in order:**
1. **Never lose a note.** This is the reason the app exists: Microsoft's app lost their notes through
   cloud sync. Everything is local, saved instantly, crash-safe and backed up daily. Never add cloud
   sync, accounts or anything that could overwrite or delete data without an explicit user action.
2. **Notes stay put.** Pinned notes stay on top and won't minimise. Notes reopen in the same spots
   after a restart.
3. **Cute, like real paper sticky notes:** pastel paper colours, a handwritten font option, little
   touches (tilted cards, pins, clips). Keep this design language.
4. **Simple surface, power behind one button.** Basic formatting is always visible; complex things
   (photos, voice, drawing…) live behind **+ Add**.

**The owner** is not a programmer. They build the installer by double-clicking `build.bat` and install
`dist/CosmoNotes Setup <version>.exe` on their laptops. Explain things in plain language. The project is a git
repo (public on GitHub: `vkashirski/CosmoNotes`); on the owner's PC it's at `C:\Workspaces\CosmoNotes` (it used
to be `C:\Users\User\Desktop\Sticky Pins\Sticky Pins`). They want edits made **in that folder, in place**, not
as new copies. Files use Windows line endings (CRLF).

---

## 2. Project layout

```
main.js            Electron main process: windows, tray, IPC, lock/password, groups, migration, spelling
store.js           All disk storage (notes, groups, settings, attachments, backups). No Electron imports.
preload.js         Safe bridge: exposes window.sticky.* to both windows (contextIsolation + sandbox)
src/note.html/.css/.js   One sticky-note window (the editor)
src/list.html/.css/.js   The "All notes" window: Notes / Bin / Settings tabs, groups, sorting
src/about.js       In-app feature list + version history (window.COSMO_ABOUT) + LAST_UPDATED date
assets/            icon.ico/png (windows), tray.ico/png
build/             icon.ico/png for the installer/shortcuts; afterPack.js is an unused stub (see §6 Smart App Control)
build.bat          One-click: (private Node if needed) + npm install + electron-builder → dist/CosmoNotes Setup <ver>.exe
HOW TO INSTALL.txt Plain-language guide for the owner (install, data folder, forgot password, tips)
test-run.bat       Runs CosmoNotes from this folder with Electron's original exe (no build needed)
build/installer.nsh  Installer addition: shortcuts get the CosmoNotes icon (exe stays untouched, see §6)
CHANGELOG.md       Version history (mirror of src/about.js VERSIONS)
tests/             npm test – Node tests using tests/fake-electron (no Electron/Windows needed)
ai-context/        This file
tools/node/        Private Node.js 22 that build.bat downloads when the computer's Node is missing/too old (git-ignored)
```

Fonts come from npm (`@fontsource/caveat` = handwritten, `@fontsource/nunito` = rounded/UI) and are
referenced from HTML as `../node_modules/@fontsource/...`, so they work offline and are packaged.

---

## 3. Architecture

- **Main process (`main.js`)** owns all state through one `Store` instance. Windows never touch the disk.
- **Note windows**: one frameless `BrowserWindow` per open note (`wins: Map<noteId, BrowserWindow>`),
  `win.noteId`, `win.revealed` (true after the password was typed in *that* window).
- **List window**: a single window (`listWin`) with a hidden title bar plus overlay window buttons.
- **Tray icon**: New note, All notes, Bring notes to front (also unrolls rolled-up notes), Start with Windows,
  Quit. Closing every window keeps the app running in the tray. Single instance: launching again brings the
  notes up (without unrolling) and shows the list.
- **IPC** (see `preload.js` for the renderer side):
  - note window: `note:get`, `note:update`, `note:update-sync` (used on unload), `note:dates`,
    `note:new`, `note:duplicate`, `note:close`, `note:trash`, `note:hover`, `note:unlock`, `note:relock`,
    `note:set-locked`, `lock:set` (`{current, next, kind}`, kind = 'pin' | 'password'), `att:save`,
    `att:pick-images`, `att:open`, `open-external`, `list:show`
  - list window: `list:get`, `list:new`, `list:duplicate`, `list:open-note`, `list:close-note`, `list:trash`,
    `list:restore`, `list:destroy`, `list:empty-bin`, `list:bring-front`, `list:set-locked`,
    `groups:make`, `groups:move-up`, `groups:move-to`, `groups:ungroup` (= move-up for a note),
    `groups:dissolve`, `groups:rename`, `groups:update` (name/style/color), `groups:apply` (mass edit
    colour/font), `groups:trash`, `groups:set-locked`, `groups:reveal`, `groups:hide`, `settings:set`,
    `backups:list`, `backups:now`, `backups:restore`, `backups:open-folder`, `data:open-folder`
  - main → windows: `notes:changed` (list reloads), `settings:changed` (`{spellCheck, hasPassword, lockKind,
    lockLen}`), `note:look` (a note's colour/font/lock/rolled changed from outside), `note:lock-now` (note became
    locked from the list: the window saves, then calls `note:relock` and hides), `list:nav` (mouse back/forward
    buttons sent as Windows app-commands)
  - **No native message boxes.** The list window asks every question with its own app-styled `modal()`
    (list.js) and only then calls main (`list:destroy`, `list:empty-bin`, `backups:restore` don't ask
    themselves). The only native dialog left is the photo file picker (`att:pick-images`).
- `note:update` only accepts keys in `EDITABLE` (main.js). Changing `html` or `title` bumps `updatedAt`.
  Other changes (colour, position…) don't count as edits.
- Speed rules: `store.update` only runs `normalizeInk` when `ink` is in the patch (the stored drawing is already
  clean). `applyPatch` re-applies window state (`applyState`) only for opacity/pinned/colour; text/title only call
  `setWinTitle`. The list reuses unchanged cards: anything a card shows or its buttons use must come from the data
  that's JSON-compared in `noteEl`/`groupEl`, or the card would go stale.

### Security model
- `contextIsolation`, `sandbox`, no `nodeIntegration`, a CSP in each HTML file, and the app menu removed.
- Navigation is blocked. Links open in the real browser only for `http/https/mailto`.
- Permissions: microphone (audio only) and clipboard write. Everything else is denied.
- Pasted HTML is sanitized with an allow-list (`cleanTree` in note.js).
- Attachments are served through the custom `stickyfile://att/<name>` protocol. Names are validated by
  regex and `path.basename`. The scheme name `stickyfile` is kept from 1.0.0 because it is stored inside
  note HTML, so **don't rename it**.

---

## 4. Data on disk – `%APPDATA%\CosmoNotes`

```
notes/<uuid>.json      one note per file (+ .bak = previous version, .tmp during a write)
attachments/<name>     photos (png/jpg/gif/webp/bmp), drawings (png), voice (webm)
backups/YYYY-MM-DD[_HH-MM-SS]/   <uuid>.json…, groups.json, meta.json {created,count}
groups.json            { groups: [{ id, name, createdAt, parentId, style, color, locked }] }
settings.json          see below
```

**Saving is atomic** (`writeFileSafe` in store.js): write a .tmp file → fsync → copy the current file to
.bak → rename. On load, a damaged main file falls back to .tmp, then .bak, and is repaired. Note windows
save 350ms after typing stops, on blur, and synchronously on unload. Main flushes pending saves on quit.

**Note fields** (`normalize()` in store.js is the schema; it always fills defaults):
`id, title, html, text (plain text for list/search), firstImage, color (yellow|pink|green|blue|purple|
orange|mint|charcoal), font (hand|round), size (s|m|l), ink (draw-over, see below), wrapWidth (px or null:
locked text layout), opacity (0.25–1), solidOnHover, pinned, open
(window open → reopens at start), rolled, locked, spell (null = follow Settings | true | false),
groupId, bounds {x,y,width,height} (unrolled height), createdAt, updatedAt, deletedAt (null or in Bin),
restoredFrom`.

**Draw-over ink** (`note.ink`): `{ s: [ { t: pen|hl|line|arrow|rect|ellipse, c: '#rrggbb', w: 1–40, l: 'a'|'b',
p: [x,y,...] } ] }`. Coordinates are px relative to `#sheet` (the text area, origin top-left). pen/hl use the
whole path; shapes use `[x1,y1,x2,y2]`. `l: 'a'` = over the text (SVG `#inkAbove`, z-index 2); `'b'` = behind it
(`#inkBelow`, z-index 0, under `#editor` z-index 1, so pictures cover it). `normalizeInk` in store.js validates
and caps it (4000 strokes, 20000 numbers per stroke). Ink is in `SECRET` (main.js): blanked for hidden locked
notes, and patches can't change it while hidden. It counts as an edit for `updatedAt`.

**Text layout lock** (`note.wrapWidth`; called **"Word wrap" off** in the UI since 1.1.6): when set, `#sheet` has that fixed width (`applyLayout` in note.js), so text
and pictures never re-wrap; `#scroller` is `overflow: auto` and shows a sideways scrollbar when the note is
narrower. The first ink stroke sets it automatically (`saveInk`). Unlocking with ink present asks first.
Pictures: `img.fixed` = keep size (`max-width: none`); otherwise they shrink with the note. When the layout is
locked, `#sheet` is wider than the visible note, so note.js sets `--viewW` (visible writing width, `updateViewWidth`,
also via a `ResizeObserver` on `#scroller`) and note.css caps non-fixed pictures at it under
`#sheet.fixed:not(.inked)`. With ink (`#sheet.inked`) plus a locked layout, all pictures keep their size so the
drawing stays lined up; the right-click "Keep size" item then only explains this (fixed in 1.1.2: before, a locked
layout stopped every picture from shrinking, so "Keep size" did nothing).
Resizing a picture while the note has ink asks first (`needsResizeWarning` / `resizeWarning`).

**Settings** (changing only `listSort` deliberately does *not* send `notes:changed`, since the list already
redrew; that was the 1.0.2 double-refresh bug): `startWithWindows, defaultColor, defaultFont, firstRunDone, listBounds, spellCheck (false),
spellCyrillic (false), listSort {by: updated|created, dir: desc|asc, groups: mixed|first|last},
listSize (s|m|l|xl|xxl, card size in the list, also Ctrl + mouse wheel; like listSort it doesn't trigger a reload), defaultColor may be
"random" (store.create picks one of the 7 pastel papers),
defaultOpacity (0.25–1: see-through of new notes),
listTheme (cream|rose|mint|sky|lilac, dark: night|midnight|forest|plum: colours of the list window; doesn't trigger a reload either),
madeGroup (true once any group was ever made; hides the "drag to make a group" tip for good),
lock ("salt:hash" scrypt, or null), lockKind ('pin'|'password', null = password from before 1.1.6),
lockLen (PIN length, so a PIN can open by itself)`.

**Backups**: made at most once per day (on start and every 3 hours). The newest 30 are kept. Restoring a
backup **never overwrites**: notes that differ come back as extra closed notes marked `restoredFrom`, all of them
(plus notes un-binned by it) in a new group "Restored Notes from Thursday, 22 Oct 2026" (`backupDayName`). The list
shows their own dates, not "Restored". Settings shows only the newest backup; days are picked in a pop-up (`pickBackup`).
Settings sections fold (`foldPanels`, all closed at first).
Attachments are only deleted when no note *and no backup* references them, and only once they're over 2
days old (`sweepAttachments`).

**Bin**: `list:trash` sets `deletedAt`, and only "Delete forever" / "Empty bin" removes the file.

**Groups** form a folder tree: a note has `groupId` (its direct group), and a group has `parentId` (null = top
level). `style` is one of stack|folder|envelope|notebook, `color` one of
kraft|sun|rose|coral|lilac|sky|mint|graphite, and `locked` is a boolean. store.js helpers: `chain` (group and its
ancestors), `subtree`, `notesInTree`, `isInside`, `setParent` (refuses loops), `lockedGroupsOf`. A group
is removed automatically once nothing in its subtree (including notes in the Bin) is left. A group with
one note stays. **Ungroup** (`dissolveGroup`) moves the notes and sub-groups up one level, never deletes.
Notes restored from the Bin go back into their group if it still exists (backup restores go into their own new
group, see Backups). Broken parent links on load are reset to top level.

**Drag rules** (`groups:make(dragId, targetId)`): note→note in the same place makes a new group *inside*
the current one; note→note in another group joins that group; note→group or group→group puts it inside
(not into itself or its own sub-groups); group→note does nothing. `groups:move-to(id, groupId|null)` moves
anything anywhere, used by the back button (left of the group name, the drop target for "up a level") and the
crumbs. (The separate drop strip was removed in 1.1.6: it pushed the cards down while dragging.)

---

## 5. Features → where they live

| Feature | Where |
|---|---|
| Pin on top (`setAlwaysOnTop(…,'screen-saver')`), un-minimise pinned notes, re-assert every 2.5s | main.js `applyState`, `enforcePinned`, `minimize` handler |
| See-through + solid on hover | main.js `applyState`, `note:hover`; note.js mouseenter/leave |
| Roll up (window height 34px; real height kept in `bounds.height`); toolbars stay open but hidden while rolled | main.js `setRolled`; note top-bar `#btnRoll`; note.css `body.rolled` |
| Reopen in place; off-screen notes pulled back onto a screen | main.js `fitBounds`, `visibleOnSomeDisplay`, `refitAll`, start() |
| Window closed via X → `open=false`. Closed by Windows shutdown → stays open | main.js `note:close`, `closed` handler with 2.5s grace |
| Title (⋯ menu `#titleInput`) → top bar `#title` + window title | note.js, main.js `titleOf` |
| Formatting, bullets, checklists (`ul.checklist`, `li.done`; click the box to tick) | note.js `runCmd`, `toggleChecklist`; uses `document.execCommand` |
| Text panel `#textPop` (the A button): font, colour, highlight, size, clear; selection or whole note (`onText`, `paintTextPanel`); undo is the bottom-bar `#btnUndo` | note.js. "Normal colour" = apply sentinel `#010203` then strip it |
| Spelling: per-note `spell`, global `spellCheck`; Cyrillic ignored | note.js `applySpell`; main.js `spellLanguages` |
| Add panel: photo, voice, drawing, link, table, numbers, divider, date | note.js `doInsert`, `insertNodes` (direct DOM insert, keeps voice chips intact) |
| Photo resize handle `#imgHandle` (60px → editor width, stored as `width` attr) | note.js "photo resizing" section |
| Voice notes: MediaRecorder webm/opus → `.voice` chip with play/pause | note.js "voice notes" |
| Drawing: canvas, 6 pens, 3 sizes, eraser, undo; cropped PNG; double-click to edit | note.js "drawing" |
| Lock: one password or PIN; hidden notes get empty html from main; can't be overwritten while hidden | main.js `viewOf`, `SECRET`, `applyPatch` guard; note.js "locking" |
| Last-edited stamp `#stamp` + dates in ⋯ menu | note.js "dates" |
| List: cards, search (title+text), Bin, Settings, About | list.js |
| Groups: HTML5 drag & drop, group card = clipped stack, group view with name/ungroup | list.js `dropTarget`, `groupCard`, `renderNotes`; main.js `groups:*` |
| Sorting | list.js `sortItems`; saved in `settings.listSort` |
| Start with Windows (`--startup` arg → don't show list) | main.js `syncLoginItem` (only when packaged) |
| Rename migration from `%APPDATA%\Sticky Pins` | main.js `migrateOldData` (copies, never moves/deletes) |
| Bring notes to front (+ unroll rolled notes; not on second launch) | main.js `bringToFront({ unroll })` |
| Mouse back/forward buttons between group levels | list.js `navBack`/`navFwd`, `navigate()`; main.js `app-command` → `list:nav` |
| Nested groups, crumbs, back button (also the "move up" drop target) | list.js `renderNotes`, `renderGroupHeader`, `canMoveInto`, `moveInto`; main.js `groups:*` |
| Group looks (stack/folder/envelope/notebook) + colours | list.js `groupArt`, `groupCard`; list.css "group looks" |
| Group settings panel (look, colour, mass edit, lock, ungroup, bin) | list.html `#groupPanel`; list.js "group settings panel"; main.js `groups:update`, `groups:apply` |
| Lock groups; open a locked group in the list | main.js `groups:set-locked`, `groups:reveal`/`hide`, `listOpenGroups`, `groupOpenInList` |
| Lock/unlock notes from the list | main.js `list:set-locked`, `hideNewlyLocked`; list.js `lockNote`/`unlockNote` |
| Right-click menus (notes, groups, Bin) | list.js `showCtx`, `noteMenu`, `groupMenu` |
| Duplicate note (list right-click, note ⋯ menu) | main.js `duplicateNote` → store.js `duplicate`; attachments are shared, not copied (safe: `sweepAttachments` keeps anything still referenced) |
| App-styled pop-ups + toasts | list.js `modal()`, `toast()`; list.html `#modal`, `#toast` |
| Bin confirmation (Shift+click skips) | list.js `trashNote(n, skipAsk)` |
| No double redraw; animate only on view change | list.js `load()` (signature check), `render(animate)`; list.css `.cards.anim` |
| Fast list refresh: unchanged cards are reused | list.js `cardCache`, `cached()`, `noteEl`/`groupEl`, `placeCards`; `FMT` date formatters (don't build `toLocale…String` per card) |
| Search (clear button; only inside the open group) | list.js `renderNotes` (pool = `notesInTree(openGroup)`), `#qClear`, `clearSearch` |
| New note inside the open group | list.js `newNote()` → `list:new(groupId)` → main.js `createNote({groupId})` |
| Card sizes s/m/l/xl/xxl (fixed: never stretch with the window; Ctrl + wheel, list.js `SIZES`, `setSize`) | list.html `#btnSize`/`#sizePop`; list.js `paintSize`; list.css `.cards` `--cw`/`--ch`, `.cards.size-*` |
| List themes | list.js `THEMES`, `themeNow`, Settings `#sTheme`; list.css `body[data-theme]` variables; main.js `LIST_THEMES`, `paintListFrame` (window buttons) |
| Bin search, Shift+click Delete | list.html `#bq`/`#bqClear`; list.js `binQuery`, `renderBin`, `destroyNote(n, skipAsk)` |
| Password or PIN (auto-open PIN) | main.js `lock:set` (kind), `lockInfo`; list.js `modal()` `kindPick`/`pin`/`pinLen`, `askPassword`, `NEW_INPUTS`; note.js `paintUnlock`, `#pwKind` |
| Group panel shows shared colour/font | list.js `panelScope`, `shared`, `paintPanel` |
| Title vs untitled first line on cards | list.css `.card .t1` (600) / `.t1.tt` (800, bigger); needs `@fontsource/*/600.css` in list.html |
| Password set/change button (pop-up) | list.js `#pwSave` handler (modal with 2 or 3 inputs) |
| Draw-over (toolbar, tools, Shift, Over/Behind, eraser, pause, X, save; undo via `#btnUndo`) | note.html `#inkBar`, `#inkCatch`, `#inkAbove/#inkBelow`; note.js "draw-over" (`inkState`, `strokeEl`, `renderInk`, `eraseAt`, `rubOut`, `tracePieces`, `shapeEnd`, `saveInk`) |
| Word wrap on/off (= lock text layout), sideways scroll, turned off by the first stroke | note.js `applyLayout`, `toggleWrap`, `saveInk`; note.css `#sheet`, `#scroller`; `#btnWrap.on` = word wrap on |
| Picture keep-size / shrink option, resize warnings | note.js image context menu (`keep`, `guarded`), `needsResizeWarning`, `resizeWarning` |
| App-styled confirm inside notes | note.js `ask()`; note.html `#askPop` |
| Settings sections fold (all closed at first) | list.js `foldPanels`; list.css `.phead`, `.pbody`, `.pinner` |
| Backups: pick a day to restore, restored notes in their own group | list.js `pickBackup`, `renderBackups`; store.js `restoreBackup`, `backupDayName` |
| New notes: colour, font, see-through (Settings → General, "For new notes") | list.js `renderSettings`, `#sOpacity`; store.js `create` (`defaultOpacity`) |

---

## 6. Things to know before changing code

- **Keep `appId` `com.stickypins.app` and `setAppUserModelId('com.stickypins.app')`.** They make the
  CosmoNotes installer replace the old Sticky Pins install and keep the "Start with Windows" entry.
  Changing them would leave two apps installed.
- `app.commandLine.appendSwitch('disable-features','WinUseBrowserSpellChecker')` forces Chromium's Hunspell
  spellchecker so that with only `en-US` loaded, Cyrillic words are skipped. When spelling is first turned
  on, Electron downloads the dictionary once from Google's CDN. That's the only network use, and it's optional.
- The lock is a **privacy screen, not encryption**, a deliberate choice so a forgotten password can't
  lose data. The reset is documented in HOW TO INSTALL.txt (set `"lock": null` in settings.json).
  If encryption is ever added, it needs a recovery story first.
- **Locks: what "locked" means.** A note is locked if `note.locked` is set or any group in its chain is
  locked (`isLocked`, `lockedBy` = 'note' | 'group' in main.js). Note windows have `win.revealed`, which is
  true while that window may show contents (set at open for unlocked notes, after the password, or when opened
  from a group already opened in the list). The list window has `listOpenGroups` (groups opened with the
  password, cleared when the list closes). `list:get` blanks the text/photo of notes that are locked or sit in
  an unopened locked group (`locked: true` = show as a locked card, `ownLock` = the note's own lock). A note
  locked by its group can't remove the lock from inside the note ("Locked with its group").
- When a note becomes locked from outside (list right-click, locking its group, dragging it into a locked
  group), main sends `note:lock-now`. The window first saves what was typed, then hides. Never hide it
  directly from main, or the last keystrokes would be lost.
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
  the selection, or the whole note when nothing is selected (`onText`, `#tScope` says which). The only Undo button is
  `#btnUndo` in the bottom bar (outside `.tleft`, so it never scrolls away; full opacity while the mouse is on the note
  (`body:hover`), otherwise it fades like the rest; the bar fades its children `#tools > *`, never `#tools` itself): `undoAny()` = drawing undo while drawing,
  else note-font undo (`textUndo`) or the editor's own undo. `note.size` (s/m/l) has no button any more (kept for old notes).
  The note's scrollbar thumb only shows on hover/focus. Shift snaps lines/arrows to 12 directions (`shapeEnd`).
  While drawing, the editor is
  `contentEditable=false` and `#inkCatch` gets the pointer. Mouse-wheel scrolling still works because the
  catcher sits inside the scroller.
- Rolling a note up keeps drawing/text toolbars open but hidden (`body.rolled`), so they never cover the top bar.
- `#scroller` has the arrow cursor (scrollbars), `#sheet` the text cursor.
- The bottom bar must fit on a 340 px note (the default width). Order: B I U S A | bullets checklist | spelling word
  wrap, then — outside the part that scrolls — Undo, Draw, Add. To fit with the "Draw" label and Undo, the `.tb`
  buttons are 24 px wide below 440 px and 22 px (tighter gaps) below 430 px; below 390 px Add becomes a round "+".
  At 340 px it fits exactly: measure with a screenshot after adding a button. Narrower notes scroll `.tleft` sideways.
- The renderer of a hidden locked note must never save: `changed()`/`saveNow()` return early when
  `hidden`, and main strips `html/text/firstImage` from patches. Keep both guards.
- `collect()` in note.js strips UI-only state (playing voice chips, `.sel-img`) before saving.
- Editor uses `contenteditable` + `execCommand` (deprecated but fully working in Chromium/Electron).
- List cards for locked notes get `text:''` and `firstImage:null` from main, so never send content to the list.
- Minimum note size 200×120, default 340×300 (`MIN_W`/`MIN_H`/`DEFAULT_W`/`DEFAULT_H` in main.js). The bottom bar's
  formatting buttons scroll sideways (`.tleft`) on narrow notes so Undo, Draw and Add always stay visible.
- Electron version is `^39` in package.json, installed on the owner's PC by `build.bat`.
- **Node.js for building: 22.12 or newer.** `@electron/rebuild` 4.2.1 (pulled in by electron-builder 26) requires
  `>=22.12.0`; older Node fails (on Node 14: `stream/promises` missing). `build.bat` checks major.minor; if Node is
  missing or older, it downloads Node 22.14.0 into `tools\node` and prepends it to `PATH` for that run only, never
  changing the system Node. If electron-builder ever needs a newer Node, raise the version in both the check and
  the download URL in `build.bat`.
- **Smart App Control (SAC) – never modify CosmoNotes.exe.** The owner's PC has SAC **On**: it left
  Evaluation by itself, and switching it off is permanent on that PC until the April 2026 rollout reaches it.
  SAC blocks unknown, unsigned programs, and we have no code-signing certificate. Electron's own `electron.exe`
  *is* trusted (proved with `test-run.bat`). So the build must leave `CosmoNotes.exe` byte-identical to
  `node_modules\electron\dist\electron.exe`:
  - `build.disableAsarIntegrity: true` stops electron-builder embedding the asar hash (resedit) in the exe.
  - `win.signAndEditExecutable: false` stops it editing the icon/version (rcedit).
  - No afterPack / rcedit / resedit / fuses (`electronFuses`) or anything else that touches the exe.
  - The exe shows Electron's icon, so `build/installer.nsh` re-points the shortcuts to `resources\icon.ico`.
  - `build.bat` verifies this with `fc /b` after each build. If it ever says the files differ, fix the build.
  Changing the Electron version gives a new electron.exe. That's fine as long as it's an official release
  (also widely trusted), but check that it starts. The installer (`CosmoNotes Setup.exe`) and the uninstaller are
  NSIS exes; so far SAC has allowed them. If SAC ever blocks the installer, an alternative is copying
  `dist\win-unpacked` into `%LOCALAPPDATA%\Programs\sticky-pins` (the install folder kept its old name).
- **Build gotcha (`spawn UNKNOWN`)**: near the end, electron-builder runs a small helper exe it just made
  (`dist\<Setup name>.exe`) to create the uninstaller. Windows Security or SAC can refuse to start it. `build.bat`
  retries once, then explains. It happened once (1.0.3), most likely when SAC switched itself on.
- **Don't look inside `app.asar` from the Claude desktop app's file tools.** That app is Electron too, and keeps the
  archive open, which breaks the next build (`EBUSY ... app.asar`) until the Claude app is restarted.
- `npm test` runs `tests/run.js`: each `*.test.js` in a separate process with its own temporary data
  folder. `tests/fake-electron` stands in for Electron (windows, ipcMain, session, dialogs…), so the real
  `main.js` and `store.js` run under plain Node.
  - `store.test.js`: saving, crash recovery from .bak, backups, once-a-day rule, restore (into a "Restored Notes
    from …" group, `backupDayName`), pruning.
  - `main.test.js`: windows, opacity/pin/roll, new note placement, attachments and the protocol, blocked
    links, permissions, close vs quit, reopening in place.
  - `upgrade.test.js`: Sticky Pins → CosmoNotes migration, titles, dates, locking and passwords,
    spelling languages, groups, sorting, backups with groups.
  - `duplicate.test.js`: copying content/look/ink/group, "(copy)" title, independence, shared photo survives
    deleting the original, locked copy stays hidden, binned notes can't be duplicated.
  - `ink.test.js`: ink cleanup, saving with wrapWidth, counting as an edit, hidden + protected while locked.
  - `speed.test.js`: typing saves keep the drawing untouched and don't re-apply always-on-top/opacity/colour; the
    window title follows the text; page title can't rename a note window; group recolour keeps drawings; "Bring
    notes to front" unrolls (second launch doesn't); mouse back/forward app-commands reach the list (`list:nav`).
  - `pin-theme.test.js`: PIN rules (digits, 4–12, length kept), PIN↔password change, list theme kept/validated,
    see-through for new notes (`defaultOpacity`, 5 % steps, ≥ 25 %), `madeGroup` stays true after the last group is gone.
  - `groups.test.js`: nested groups and drag rules, no loops, move-up/move-to, looks and colours, mass
    edit (with and without sub-groups) pushed to open windows, locking groups (windows hide, list blanks,
    reveal/hide, open-from-list), lock/unlock notes from the list, ungroup moving things up, bin a group.
- **UI checks** (done during development): load `src/note.html` / `src/list.html` in Chromium (e.g.
  Playwright) with a mock `window.sticky` object injected before load, then click through and screenshot.
  The mock must implement every `window.sticky.*` method from preload.js. Playwright hides scrollbars by default
  (launch with `ignoreDefaultArgs: ['--hide-scrollbars']` to check them). The fonts live in
  `node_modules/@fontsource/*/files` (latin woff2).
- Things only a real Windows machine can confirm: the installer, always-on-top behaviour, the tray,
  start with Windows, the microphone, and the spellchecker download.

---

## 8. Releasing a new version (do this for EVERY update – see the versioning rule at the top)

1. Bump `version` in `package.json`: third digit, unless the owner said otherwise.
2. Add the version at the top of `VERSIONS` in `src/about.js`, and set `LAST_UPDATED`.
3. Add the same entry to `CHANGELOG.md`.
4. Update this file: the "Last updated" line at the top and any sections that changed.
5. Update `HOW TO INSTALL.txt` and `build.bat` if they mention the version or file name (since 1.1.5 neither
   hard-codes it: build.bat reads it from package.json).
6. Run `npm test`. The owner runs `build.bat` → `dist/CosmoNotes Setup <version>.exe`.

---

## 9. Ideas mentioned or likely next

- Per-note passwords (the owner said "one password for all notes **for now**").
- Maybe: drag to reorder notes by hand (currently only sorting), and custom group icons/stickers.
- Reminders/alarms on notes, a global "new note" shortcut, and export/import to a single file (offered in 1.0.0, not chosen yet).
- **Not wanted (for now):** a "Check for updates" button (GitHub Releases + electron-updater) was discussed after
  1.1.5; the owner decided against it. If it comes back: the repo is public, the installer is unsigned (Smart App
  Control may treat a downloaded copy differently), and checking would be the app's only other network use.
