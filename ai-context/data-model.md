# Data on disk – `%APPDATA%\CosmoNotes`

Open this when adding or changing a note field, a setting, backups, the Bin, groups or ink data.

```
notes/<uuid>.json      one note per file (+ .bak = previous version, .tmp during a write; a locked note is sealed: `enc`)
attachments/<name>     photos (png/jpg/gif/webp/bmp), drawings (png), voice (webm) (a locked note's are sealed: they start
                       with CNSEAL2, or CNSEAL1, the first format, still read)
attachments/<name>.part + <stem>.rec.json   a voice recording being made (pieces appended every 250 ms) and whose it is
                       ({ noteId, file, startedAt, endedAt }); see "Voice recordings" below
backups/YYYY-MM-DD[_HH-MM-SS]/   <uuid>.json…, groups.json, meta.json {created,count} (copies of locked notes sealed)
models/<id>/           the downloaded voice-to-text model (whisper-small-en, the only one): its files as in
                       main/stt-models.js, then ready.json { run: 'gpu'|'cpu', at } written last (no ready.json = not
                       complete). Not in backups; the uninstaller leaves it. A .part left by a quit mid-download is
                       removed at the next start.
groups.json            { groups: [{ id, name, createdAt, parentId, style, color, titleFont, locked, favorite, tags, icon }] }
                       titleFont: the name's font on the card's label and in the group's bar: hand | round | medieval
                       (default hand). icon (1.4.33): one of src/tab-icons.js's 40 ids, or null (none: its tab shows only
                       its name); on its tab and its bar in the list, not on its card
settings.json          see below
```

**Saving is atomic** (`writeFileSafe` in store.js): write a .tmp file → fsync → copy the current file to .bak → rename. On
load, a damaged main file falls back to .tmp, then .bak, and is repaired. Note windows save 350 ms after typing stops, on
blur, and synchronously on unload. Main flushes pending saves on quit.

## Note fields

`normalize()` in store.js is the schema; it always fills defaults. "Not an edit" = changing it leaves `updatedAt` alone
(only `html` / `title` / `ink` count as edits). **Secret** = a secret field (`CLAUDE.md` → "Rules for every code change").

- `id`, `createdAt`, `updatedAt`, `deletedAt` (null, or when it went into the Bin), `restoredFrom` (see Backups).
- `title`, `html`, `text` (plain text for the list and search), `firstImage`: secret.
- `color`: yellow | pink | green | blue | purple | orange | mint | charcoal, and the list themes' colours cream | rose | sage
  | mist | lavender | night | midnight | forest | plum. Dark ones = `DARK_COLORS`: charcoal, night, midnight, forest, plum.
- `font`: hand | round | medieval (`FONTS` in store.js; unknown → hand). `titleFont`: the top-bar title's own font, hand |
  round | medieval, null / unknown = the note's font; not secret.
- `size` (s | m | l): no button any more, kept for old notes.
- `ink`: draw-over, see below. Secret; an edit.
- `wrapWidth` (px or null: the text layout lock), `nowrap` / `wrapFixed` (which kind of word wrap off): see below.
- `opacity` (0.25–1), `solidOnHover`, `pinned`.
- `clickThrough`: only with `pinned` (feature-map.md); not copied by Duplicate.
- `pinApps`: `[{ app, part }]`, the apps it is on top over; part null = any window of that app; empty = on top of
  everything. Only while pinned (unpinning forgets them), a whole app drops its parts, at most 40 (store.js
  `cleanPinApps`). Not an edit; a hidden locked note may change it.
- `open` (the window is open → it reopens at start), `rolled`, `bounds` {x, y, width, height} (unrolled height).
- `zoom` (0.5–3, Ctrl + wheel in the note), `favorite` (starred in the list), `fxPaused` (effects paused on this note):
  none is an edit.
- `locked`, `coverTitle` ("Title while locked", shown instead of the title while locked; not secret), `enc` / `encAtt` (a
  locked note's sealed secret fields and the names of its sealed attachment files; main/crypt.js).
- `spell`: null = follow Settings | true | false.
- `checklist`: `{ drag, sink, fixed }`, each true / false or null = as in Settings (`checkDrag` / `checkSink` /
  `checkFixed`); `cleanChecklist`; not an edit; copied by Duplicate.
- `groupId`: its direct group (see Groups).
- `sizes`: 2 = its sizes are read the new way (`store.js` `dropDeadSizes` took off, once, the old sizes that showed
  nothing on font tags; see `ui-gotchas.md` → "Font sizes"); null = still sealed, done when opened.
- `fx`: `{ e, f, ea, fa, eo, fo, mi }`: the note's own effect / mouse follower (null = same as all notes, 'none' = nothing);
  `ea` / `fa` = how much, low | mid | high or null; `eo` / `fo` = opacity 0.1–1 in 5 % steps or null (`cleanFxOpacity`);
  `mi` = the mouse plays with the background, true / false / null. Not an edit.
- `evening`: evening colours on / off for this note, null = as in Settings. Not an edit; copied by Duplicate.
- `panic`: false = the panic button leaves this note open, null = it closes it. Not an edit; copied by Duplicate.
- `reminders`: up to 30 `{ id, start, at, repeat, sound, hide, unlock, target, firing, firedAt, late, snooze, count }`;
  `src/reminders.js` says what each holds and `cleanAll` is the schema. Not secret: main needs the times before the PIN.
  Not an edit; not copied by Duplicate, nor by a backup's restored copy.
- `remindMsg`: `{ reminderId: message }`, at most 500 letters each. Secret: `{}` while sealed, `null` in a hidden window,
  never on a card.
- `tags`: up to 20, `src/tags.js` `cleanAll` (lower case, letters / numbers / - / _, 30 letters). Secret: `[]` while sealed,
  in a hidden window and on its card. Changed only by `list:tags` / `note:tags` (add / remove), never by a save; not an
  edit; copied by Duplicate.

Which of these a note can have its own value of, and what Settings → "Use on all notes" puts back, is one table:
`OVERRIDES` in store.js.

## Draw-over ink

`note.ink` = `{ s: [ { t: pen|hl|line|arrow|rect|ellipse, c: '#rrggbb', w: 1–40, l: 'a'|'b', d: 'dash'|'dot' (optional;
missing = solid), o: dash offset in px (only on pieces left by the partial eraser, so the pattern carries on where it
was), p: [x,y,...] } ] }`. When tracing shapes for the eraser, keep `tracePieces` drawing them exactly like the browser
(square: starts after the top-left rounded corner, rx 4), or dashes slide after erasing. Coordinates are px relative to
`#sheet` (the text area, origin top-left). pen / hl use the whole path; shapes use `[x1,y1,x2,y2]`. `l: 'a'` = over the
text (SVG `#inkAbove`, z-index 2); `'b'` = behind it (`#inkBelow`, z-index 0, under `#editor` z-index 1, so pictures cover
it). `normalizeInk` in store.js validates and caps it (4000 strokes, 20000 numbers per stroke). Ink is secret: blanked
for hidden locked notes, and patches can't change it while hidden. It counts as an edit for `updatedAt`.

## Word wrap off

Three kinds, all called **"Word wrap" off** in the UI:

- **No limit:** with `wrapWidth` set and no drawing, or with `note.nowrap` true, `#sheet.nowrap`: lines only end at Enter,
  the sheet is `max-content` wide, pictures cap at `--picW` (the visible width; with a drawing, `wrapWidth`). `nowrap` is
  set by the toggle and by the first stroke on such a note (`keepForInk`, which also sets `wrapWidth` to the visible
  width).
- **`wrapFixed`:** word wrap off with the text kept at `wrapWidth` (`#sheet.fixed`). Set by the first stroke on a note with
  word wrap on (`saveInk`); `false` from the word wrap button. It is saved, never worked out from the drawing: when the
  kind was "locked if it has a drawing", erasing or undoing the last line turned the note into "no limit" and every
  paragraph and table cell un-wrapped. `normalize` gives a note saved before 1.3.29 the kind it showed then (locked if
  `wrapWidth`, no `nowrap`, and a drawing); a sealed one gets `null` until it is opened (`openedLayout`, called from
  crypt.js `openAll`). Without a drawing, a locked note's pictures still shrink to the visible width
  (`#sheet.fixed:not(.inked)`).
- **The text layout lock** (`note.wrapWidth`): when set, `#sheet` has that fixed width (`applyLayout`), so text and
  pictures never re-wrap; `#scroller` is `overflow: auto` and shows a sideways scrollbar when the note is narrower, but
  only if real content (text, pictures, voice chips, tables, ink) reaches past the visible width: `fitSideways()` /
  `contentRight()` set `overflow-x: hidden` otherwise, so there's no scrolling into empty room. It never changes the
  layout. The first ink stroke sets it automatically (`saveInk`). Unlocking with ink present asks first.

Pictures: `img.fixed` = keep size (`max-width: none`); otherwise they shrink with the note. When the layout is locked,
`#sheet` is wider than the visible note, so the note sets `--viewW` (visible writing width, `updateViewWidth`, also via a
`ResizeObserver` on `#scroller`) and the CSS caps non-fixed pictures at it under `#sheet.fixed:not(.inked)`. With ink
(`#sheet.inked`) plus a locked layout, all pictures keep their size so the drawing stays lined up; the right-click
"Keep size" item then only explains this. Resizing a picture while the note has ink asks first (`needsResizeWarning` /
`resizeWarning`).

## Settings

Changing only `listSort`, `listSize`, `listTheme` or `tagAny` deliberately does *not* send `notes:changed`: the list has
already redrawn (sending it caused a double refresh).

- `startWithWindows`, `firstRunDone`, `listBounds`.
- `defaultColors`: the colours new notes pick from at random, never empty (`cleanColors`). Old settings move over on load:
  `defaultColor` "random" → the 7 original pastels. `defaultColor` is kept = the first of `defaultColors`, for older
  versions. `defaultFont`.
- `newColorNoRepeat` (true: with several colours, never the same colour as the last new note), `lastNewColor` (that
  colour).
- `defaultOpacity` (0.25–1: see-through of new notes), `defaultSolidOnHover` (true: new notes turn solid on hover).
- `spellCheck` (false), `spellCyrillic` (false).
- `listSort` {by: updated | created, dir: desc | asc, groups: mixed | first | last}; `listSize` (s | m | l | xl | xxl, card
  size in the list, also Ctrl + mouse wheel); `listTheme` (cream | rose | mint | sky | lilac, dark: night | midnight | forest
  | plum: the list window's colours).
- `listTabs`: the list's tabs between Notes (always first) and Settings (always last), in order: `{ id: favs | locks | bin }`
  or `{ group: <id> }` (a group pinned as a tab); only Locked can be `{ hidden: true }`. 1.4.33: `show: icon | name` (how
  the tab shows; none = icon and name). Favourites, Locked and the Bin have fixed icons (star, lock, trash); a group with no
  `icon` shows its name whatever `show` says. Cleaned by store.js `cleanListTabs`
  on load and in `settings:set`: unknown and doubled entries dropped, missing built-in tabs added at the end, groups that
  don't exist dropped (at load only those: a group gone in this session stays in it, so an Undo that brings the group back
  brings its tab back; the list just doesn't show it meanwhile). A hidden group can't be pinned from the list.
- `madeGroup`: true once any group was ever made; hides the "drag to make a group" tip for good.
- Effects: `fxEffect` / `fxFollower` (for all notes, 'none' or an id), `fxEffectAmount` / `fxFollowerAmount` (low | mid |
  high), `fxEffectOpacity` / `fxFollowerOpacity` (0.1–1, default 1), `fxInteract` (the mouse plays with the background,
  default true), `fxForceAll` (use them on every note; each note's own choice is kept), `fxPaused` (pause all effects; also
  the tray's "Pause effects").
- Checklists: `checkDrag` (true: drag a checkbox to move its line), `checkSink` (false: a ticked line moves below the
  unticked ones; unticking moves nothing), `checkFixed` (false: every checkbox the note's own size). All three are sent to
  note windows (`noteSettings`) and changed per note by `note.checklist`.
- Evening colours: `eveOn` (false: for notes that follow Settings), `eveFrom` / `eveTo` (minutes after midnight, 1140 / 420 =
  19:00 / 07:00; anything else is put back at load).
- Panic button: `panicOn` (false), `panicKey` ('' = no shortcut; an Electron accelerator such as 'Alt+Z' or 'F8', checked by
  `validKey` in main/panic.js), `panicClosed` (ids of the notes the last panic closed; they reopen when CosmoNotes is
  opened again, then it is emptied).
- `clickThroughOn` (false: the click-through button in each note; off = no note is click-through, each keeps
  `note.clickThrough`).
- `updateCheck` (true: the installed app checks GitHub for a newer version 30 s after it starts and once a day; the button
  in Settings → About works either way).
- Reminders: `remindSound` ('drops': the sound of a reminder that has none of its own, an id of src/reminders.js `SOUNDS`
  or 'none'), `remindVolume` (0–1 in steps of 0.05, 0.6), `remindShowHidden` (false: notes a reminder hides still show in
  the list, faded), `remindSeconds` (false: the panel's time box has seconds too), `remindAutoNext` (true: two digits in the
  time box go on to the next box), `remindHide` (false: the panel offers "Hide the note until then"; a reminder that
  already hides keeps it). `remindSound`, `remindVolume`, `remindSeconds`, `remindAutoNext` and `remindHide` are sent to
  note windows (`noteSettings`). Not saved by main: `localStorage.remindLast` (src/remind-ui.js: the panel's last In / At,
  times, sound and repeat days; never a message).
- Voice to text: `sttWhen` (Settings → Voice to text → "Words appear": 'live' = while you talk, 'stop' = when you stop;
  missing = by the PC: graphics card live, processor stop), `sttWebgpu` (whether the engine found WebGPU last time; decides
  which set of the model is downloaded). The old keys `sttModel` and `sttTests` are deleted at start.
- Lock: `lock` ("salt:hash" scrypt, or null; the marker 'encrypted' while `crypt` exists), `crypt` ({ v, pub, byPw, byRec,
  keyShown, off, backupsSealed }: the encryption keys, see architecture.md; never sent to a window), `lockKind` ('pin' |
  'password', null = a password from before 1.1.6), `lockLen` (PIN length, so a PIN can open by itself).
- `tagAny` (false: the list's tag filter with several tags picked = All of them; true = Any).
- `tagColors` (1.4.30: `{ tag: colour id }`, ids of `src/tags.js` `COLORS`, cleaned by `cleanColors`; at most 500). A tag
  here exists even on no note (Manage tags → New tag). Plain text, not secret: only tags given a colour or made there.
  Sent to note windows in `noteSettings`; renaming a tag moves its colour, deleting it drops it (`main/ipc-tags.js`).

## Backups

Made at most once per day (on start and every 3 hours). The newest 30 are kept. Restoring a backup **never overwrites**:
notes that differ come back as extra closed notes marked `restoredFrom`, all of them (plus notes un-binned by it) in a new
group "Restored Notes from Thursday, 22 Oct 2026" (`backupDayName`). The list shows their own dates, not "Restored".
Settings shows only the newest backup; days are picked in a pop-up (`pickBackup`). Attachments are only deleted when no
note *and no backup* references them, and only once they're over 2 days old (`sweepAttachments`). Files with a
`<stem>.rec.json` next to them are never deleted.

## Voice recordings

`main/recordings.js`: `rec:start` makes `<name>.part` (name = `<stem>.webm`, a normal attachment name) and
`<stem>.rec.json`; `rec:chunk` appends (fsync every 8 pieces); `rec:end` with `save` renames the `.part` file (the window
then adds the chip and calls `rec:done`, which removes the `.rec.json` once the note's html has the file), `discard`
deletes both, `kept` (closed or locked mid-recording) renames it and makes sure the note has a chip. A window that closes
or crashes, and quitting (`finishAll` in `will-quit`), finish what is open. At start (`recover`), leftover pairs become a
chip at the end of their note (`settle`), or a new closed note "Recovered recording" if the note is gone. A note still
sealed waits for the PIN (`pending`, `retryPending` from `notifyList`; its clip is sealed at once by `crypt.sealLoose`).
The chip markup in `chipHtml` is the same as `voiceChip` in `src/note/menus-voice-ink.js`: keep both alike.

## Voice to text in a note's html

Transcribe's text is `<span class="stt-text" data-of="<the clip's stickyfile url>">` (no look of its own; it is how
"Replace the text from last time?" finds it; normal text otherwise). While a job runs its place is
`<span class="stt-pending" contenteditable="false" data-job data-label data-draft>` (empty; the label and the grey draft
are CSS from the attributes). `collect()` never saves it, and pasting strips both classes (`cleanTree` keeps no attributes
on a span). Speak to text's own clip is deleted once its text is in (`rec:end 'discard'`).

## Bin

`list:trash` sets `deletedAt`, and only "Delete forever" / "Empty bin" removes the file. **Locked notes (own lock or a
locked group around them) and groups with anything locked inside can't be binned or deleted** (main returns
`{error:'locked'}`; Empty bin leaves them): the owner's rule.

## Groups

Groups form a folder tree: a note has `groupId` (its direct group), and a group has `parentId` (null = top level).
`style` is one of stack | folder | envelope | notebook, `color` one of kraft | sun | rose | coral | lilac | sky | mint |
graphite, and `locked` is a boolean. `tags` (like a note's but not secret, like the name) count for everything inside the
group: its notes and its groups (the list's `tagsOfNote` / `tagsOfGroup`). store.js helpers: `chain` (group and its
ancestors), `subtree`, `notesInTree`, `isInside`, `setParent` (refuses loops), `lockedGroupsOf`. A group is removed
automatically once nothing in its subtree (including notes in the Bin) is left. A group with one note stays. **Ungroup**
(`dissolveGroup`) moves the notes and sub-groups up one level, never deletes. Notes restored from the Bin go back into
their group if it still exists (backup restores go into their own new group, see Backups). Broken parent links on load
are reset to top level.

**Drag rules** (`groups:make(dragId, targetId)`): note→note in the same place makes a new group *inside* the current one;
note→note in another group joins that group; note→group or group→group puts it inside (not into itself or its own
sub-groups); group→note does nothing. `groups:move-to(id, groupId|null)` moves anything anywhere, used by the back button
(left of the group name, the drop target for "up a level") and the crumbs. There is no separate drop strip: one pushed
the cards down while dragging.
