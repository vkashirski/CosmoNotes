# Data on disk – `%APPDATA%\CosmoNotes`

Open this when adding or changing a note field, a setting, backups, the Bin, groups or ink data.

```
notes/<uuid>.json      one note per file (+ .bak = previous version, .tmp during a write)
attachments/<name>     photos (png/jpg/gif/webp/bmp), drawings (png), voice (webm)
backups/YYYY-MM-DD[_HH-MM-SS]/   <uuid>.json…, groups.json, meta.json {created,count}
groups.json            { groups: [{ id, name, createdAt, parentId, style, color, locked, favorite }] }
settings.json          see below
```

**Saving is atomic** (`writeFileSafe` in store.js): write a .tmp file → fsync → copy the current file to
.bak → rename. On load, a damaged main file falls back to .tmp, then .bak, and is repaired. Note windows
save 350ms after typing stops, on blur, and synchronously on unload. Main flushes pending saves on quit.

**Note fields** (`normalize()` in store.js is the schema; it always fills defaults):
`id, title, html, text (plain text for list/search), firstImage, color (yellow|pink|green|blue|purple|
orange|mint|charcoal, and since 1.1.15 the list themes' colours cream|rose|sage|mist|lavender|night|midnight|forest|plum;
dark ones = `DARK_COLORS`: charcoal, night, midnight, forest, plum), font (hand|round), size (s|m|l), ink (draw-over, see below), wrapWidth (px or null:
locked text layout), opacity (0.25–1), solidOnHover, pinned, open
(window open → reopens at start), rolled, zoom (0.5–3, Ctrl + wheel in the note; not an edit), locked, favorite (starred in the list; not an edit), spell (null = follow Settings | true | false),
groupId, bounds {x,y,width,height} (unrolled height), createdAt, updatedAt, deletedAt (null or in Bin),
restoredFrom, fx ({ e, f, ea, fa, eo, fo }: the note's own effect / mouse follower, null = same as all notes, 'none' = nothing; ea /
fa = how much, low | mid | high or null; eo / fo = opacity 0.1–1 in 5 % steps or null (1.1.17, `cleanFxOpacity`); mi = the mouse plays with the background, true / false / null (1.1.21); not an edit; 1.1.16), fxPaused (effects paused on this note; not an edit)`.

**Draw-over ink** (`note.ink`): `{ s: [ { t: pen|hl|line|arrow|rect|ellipse, c: '#rrggbb', w: 1–40, l: 'a'|'b',
d: 'dash'|'dot' (optional, 1.1.13; missing = solid), o: dash offset in px (1.1.14, only on pieces left by the partial eraser, so
the pattern carries on where it was), p: [x,y,...] } ] }`. When tracing shapes for the eraser, keep `tracePieces` drawing them exactly
like the browser (square: starts after the top-left rounded corner, rx 4), or dashes slide after erasing. Coordinates are px relative to `#sheet` (the text area, origin top-left). pen/hl use the
whole path; shapes use `[x1,y1,x2,y2]`. `l: 'a'` = over the text (SVG `#inkAbove`, z-index 2); `'b'` = behind it
(`#inkBelow`, z-index 0, under `#editor` z-index 1, so pictures cover it). `normalizeInk` in store.js validates
and caps it (4000 strokes, 20000 numbers per stroke). Ink is in `SECRET` (main.js): blanked for hidden locked
notes, and patches can't change it while hidden. It counts as an edit for `updatedAt`.

**Text layout lock** (`note.wrapWidth`; called **"Word wrap" off** in the UI since 1.1.6): when set, `#sheet` has that fixed width (`applyLayout` in note.js), so text
and pictures never re-wrap; `#scroller` is `overflow: auto` and shows a sideways scrollbar when the note is
narrower, but only if real content (text, pictures, voice chips, tables, ink) reaches past the visible width:
`fitSideways()`/`contentRight()` set `overflow-x: hidden` otherwise, so there's no scrolling into empty room (1.1.12).
It never changes the layout. The first ink stroke sets it automatically (`saveInk`). Unlocking with ink present asks first.
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
listSize (s|m|l|xl|xxl, card size in the list, also Ctrl + mouse wheel; like listSort it doesn't trigger a reload),
defaultColors (1.1.15: the colours new notes pick from at random, never empty, `cleanColors`; old settings move over on load:
defaultColor "random" → the 7 original pastels), defaultColor (kept = the first of defaultColors, for older versions),
newColorNoRepeat (1.1.15, true: with several colours, never the same colour as the last new note), lastNewColor (that colour),
fxEffect / fxFollower (1.1.16: effect and mouse follower for all notes, 'none' or an id), fxEffectAmount / fxFollowerAmount (how
much: low | mid | high), fxEffectOpacity / fxFollowerOpacity (1.1.17: 0.1–1, default 1), fxInteract (1.1.21: the mouse plays with the background, default true), fxForceAll (use them on every note;
each note's own choice is kept), fxPaused (pause all effects; also the tray's "Pause effects"),
defaultOpacity (0.25–1: see-through of new notes), defaultSolidOnHover (true: new notes turn solid on hover),
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

**Bin**: `list:trash` sets `deletedAt`, and only "Delete forever" / "Empty bin" removes the file. **Locked notes (own lock
or a locked group around them) and groups with anything locked inside can't be binned or deleted** (main returns
`{error:'locked'}`; Empty bin leaves them) — the owner's rule since 1.1.13.

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
