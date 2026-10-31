# Features → where they live

Open this to find the code for a feature. Names are meant to be grepped.

| Feature | Where |
|---|---|
| Pin on top (`setAlwaysOnTop(…,'screen-saver')`), un-minimise pinned notes, re-assert every 2.5s | main.js `applyState`, `enforcePinned`, `minimize` handler |
| See-through + solid on hover | main.js `applyState`, `note:hover`; note.js mouseenter/leave |
| Roll up (window height 34px; real height kept in `bounds.height`); toolbars stay open but hidden while rolled | main.js `setRolled`; note top-bar `#btnRoll`; note.css `body.rolled` |
| Reopen in place; off-screen notes pulled back onto a screen | main.js `fitBounds`, `visibleOnSomeDisplay`, `refitAll`, start() |
| Window closed via X → `open=false`. Closed by Windows shutdown → stays open | main.js `note:close`, `closed` handler with 2.5s grace |
| Title (⋯ menu `#titleInput`) → top bar `#title` + window title | note.js, main.js `titleOf` |
| Formatting, bullets, checklists (`ul.checklist`, `li.done`; click the box to tick) | note.js `runCmd`, `toggleChecklist`; uses `document.execCommand` |
| Text panel `#textPop` (the A button): font, colour, highlight, size, clear; the selection, or with nothing selected what you type next (browser typing style; `onText`, `caretIsSaved`, `paintTextPanel`); undo is the bottom-bar `#btnUndo` | note.js. "Normal colour" = apply sentinel `#010203` then strip it |
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
| Right-click menus (notes, groups, Bin) | list.js `showCtx`, `noteMenu`, `groupMenu`; the right-clicked card gets `.ctxon` (faint outline, 1.1.16) |
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
| Divider = full note width (`max(100%, --viewW)`) | note.css `#editor hr` |
| Favourites (`favorite` on notes/groups, star `.fav` on cards, Favourites tab `tab='favs'`), selecting several cards (Ctrl/Shift+click, Ctrl+A, bottom bar `#bulk`, multi-drag `drag.many`) | list.js `paintCards`, `pickCard`, `paintBulk`, `bulk*`, `favourites()`; main.js `list:favorite`, `list:apply`, `groups:make-from` |
| Zoom inside a note (Ctrl + wheel, Ctrl+0/=/-): CSS `zoom` on `#sheet`. **Anything that turns mouse/screen pixels into sizes inside the note must divide by `zoomNow()`** (`inkPt`, picture resize, `--viewW`, `contentRight`). Don't use Electron's page zoom: Chromium shares it between all windows of the same origin (every note is file://) | note.js `applyZoom`, `setZoom`, `zoomNow` |
| "Snap shut" lock/unlock animation (1.1.14; the shackle's long side never leaves the body: clip path `#lockClip`) | note.js `lockGhost`, `lockFly`, `playLockAnim`; note.html `.lockicon`; list.js `ICON.lockA`, `snapLock`, `lockCentre`, `lockPos`, `lockSeen`; list.html `#lockClip`; `lk*` keyframes in both CSS files. Stardust (`.stardust`) is only used for the favourite star now (`starDust`) |
| Minimise/maximise buttons (`win.userMin`, `maximizable: true`, `note:win-state`) and the ••• menu in the top-right corner (`#menu`, ≥ 40% of the note's width) | main.js `note:minimize`, `note:maximize`, `minimize`/`restore`/`maximize` handlers; note.css 1.1.13 blocks |
| Word wrap icon = return arrow (no box when on), placed before spelling; spelling icon = "abc" (`<text>`) + tick; both off = slash with a gap (`<g mask>` `#wrapCut`/`#spellCut`, `.slashcut` hidden when `.on`); note menu "solid on hover" = sliding switch (`.check.switch`) | note.html `#btnWrap`, `#btnSpell`; note.css 1.1.12/1.1.13 blocks |
| Caret visible next to tilted photos (`.caret-near` → z-index −1 while the caret is beside a photo and the mouse isn't on it) | note.js `imgsByCaret`, `overImg`, `selectionchange`/`mousemove`; note.css `#editor img.caret-near` |
| Click in the side margin → start/end of that line or before/after a photo; photo's left 7 px edge → caret before it | note.js `#scroller` mousedown, `besideLine`, `caretAt`, `EDGE`/`edgeDown` |
| Picture-only notes: card shows just the picture, no "🖼️ Photo"/"✏️ Drawing" line | list.js `cardBody`, `PICTURE_ONLY` (matches `collect()` in note.js) |
| Title vs untitled first line on cards | list.css `.card .t1` (600) / `.t1.tt` (800, bigger); needs `@fontsource/*/600.css` in list.html |
| Password set/change button (pop-up) | list.js `#pwSave` handler (modal with 2 or 3 inputs) |
| Draw-over (toolbar, tools, Shift, Over/Behind, eraser, pause, X, save; undo via `#btnUndo`) | note.html `#inkBar`, `#inkCatch`, `#inkAbove/#inkBelow`; note.js "draw-over" (`inkState`, `strokeEl`, `renderInk`, `eraseAt`, `rubOut`, `tracePieces`, `shapeEnd`, `saveInk`) |
| Word wrap on/off (= lock text layout), sideways scroll, turned off by the first stroke | note.js `applyLayout`, `toggleWrap`, `saveInk`; note.css `#sheet`, `#scroller`; `#btnWrap.on` = word wrap on |
| Picture keep-size / shrink option, resize warnings | note.js image context menu (`keep`, `guarded`), `needsResizeWarning`, `resizeWarning` |
| App-styled confirm inside notes | note.js `ask()`; note.html `#askPop` |
| Settings sections fold (all closed at first) | list.js `foldPanels`; list.css `.phead`, `.pbody`, `.pinner` |
| Backups: pick a day to restore, restored notes in their own group | list.js `pickBackup`, `renderBackups`; store.js `restoreBackup`, `backupDayName` |
| New notes: colours (several = random one), font, see-through, solid on hover (Settings → its own "For new notes" section, after General) | list.js `renderSettings`, `paintNewColors`, `setNewColors`, `#sColors`, `#sOpacity`, `#sSolidHover`; store.js `create`, `newNoteColor`, `cleanColors` (`defaultColors`, `defaultOpacity`, `defaultSolidOnHover`) |
| Colour rows that scroll sideways (note ⋯ menu: 8 circles visible, same size as before; group panel and selection bar 8). Settings and the Edit sheet don't scroll: every colour shows, wrapping to a second line when narrow (`.swstrip.wide`) | `swatchStrip` (the same in note.js and list.js), `.swstrip`, `.swarr` |
| Paper colours (17), shown in `COLORS` order (each colour next to its light version, dark ones last; note.html's buttons follow it too) | store.js `COLORS`/`DARK_COLORS`; main.js `PAPER`; note.css `body[data-color]` + `.sw`; list.css `.card`/`.epaper`/`.sheet`/`.paper`; list.js `COLORS`, `SWATCH`, `COLOR_NAMES`. Dark-paper rules use `:is([data-color="charcoal"],…)` with all five dark colours: add a new dark colour there too |
| Edit a note's title, colour, see-through and effects from the list (right-click → Edit design…, 1.1.20; was Edit…), synced with its open window (`note:look`), effects previewed on the paper; since 1.1.22 a small tabbed pop-up next to the card (Colour / Background / Mouse), no dimming | list.html `#editSheet`, `#editTabs`, `.epane`; list.js "Edit design" (`openEdit`, `editPlace`, `editPaint`, `editFxPreview`, `editQueue`, `editFlush`, `editRefresh`); main.js `list:edit` |
| Locked tab: all locked notes/groups; "Unlock all" uncovers them in the list (and in notes opened from it) until "Lock again" or the list closes | list.js `lockedOnes`, `paintLockBar`, `tab = 'locks'`, `cardsTabNow`; list.html `#lockBar`, `#cLocks`; main.js `listUnlockedAll` (used by `hiddenInList`, `groupOpenInList`, `list:open-note`), `list:unlock-all`, `list:lock-all` |
| Note effects + mouse followers (1.1.16): choosing rules `COSMO_FX.resolve`; one shared 30 fps loop that sleeps | src/fx/ (which file: effects.md); note.js "effects" (`applyFx`, `#fxCanvas`, `#btnFx`, `#fxPop`, `paintFxPop`); list.js "effects" (`paintFx`, `.fxc`, `#fxSheet`, `paintFxSheet`, Settings `#sFxNow`/`#sFxChoose`/`#sFxPause`, `#btnFxPause` left of Settings); pickers = `.fxlist` of `.fxi` (icons `COSMO_FX.ICONS`) + `.fxamt` Frequency Rarely/Normal/Often + `.fxop` Opacity slider (1.1.17: note `#fxEOp`/`#fxFOp`, list `#fxAllEOp`/`#fxAllFOp`; shows live while dragging, saved on release or 300 ms after it stops); note pop-up has tabs (`#fxTabs`) and switches `#fxInteract` (1.1.21) + `#fxPause` (the colour / see-through block that 1.1.20 put at the top of it was taken out again in 1.1.22: colour and see-through are in Edit design); follower order = background order (`FOLLOWER_IDS`, worked out from `EFFECT_IDS`, pencil last); list right-click → Edit design (`openEdit`, `#editSheet`, live preview `#editFxCanvas`, 1.1.20); store.js `FX_EFFECTS`/`FX_FOLLOWERS`/`cleanFx` (ids must match src/fx/); main.js `fxSettings`, `setFxPaused`, tray "Pause effects" |
| Drawing and text toolbars outside the note (stick to a side and follow the note; text toolbar 1.1.16) | note.js `barOut` (`inkOut`, `textOut`), `movable(…, { out })`, `outDocs`; note.css `body.inkbar-out`; main.js `inkBarOptions`, `watchInkBar`, `snapInk`, `inkSpot`, `placeInk`, `showInk`, `ink:*` |
