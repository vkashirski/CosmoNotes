# CosmoNotes – context for AI assistants and developers

**Last updated: 22 October 2026 · App version 1.0.4**

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
`dist/CosmoNotes Setup <version>.exe` on their laptops. Explain things in plain language. They keep the
project in `C:\Users\User\Desktop\Sticky Pins\Sticky Pins` (a git repo) and want edits made **there, in
place**, not as new copies.

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
build/             icon.ico/png for the installer, afterPack.js (stamps icon + name on the .exe via rcedit)
build.bat          One-click: npm install + electron-builder → dist/CosmoNotes Setup <ver>.exe
HOW TO INSTALL.txt Plain-language guide for the owner (install, data folder, forgot password, tips)
CHANGELOG.md       Version history (mirror of src/about.js VERSIONS)
tests/             npm test – Node tests using tests/fake-electron (no Electron/Windows needed)
ai-context/        This file
```

Fonts come from npm (`@fontsource/caveat` = handwritten, `@fontsource/nunito` = rounded/UI) and are
referenced from HTML as `../node_modules/@fontsource/...`, so they work offline and are packaged.

---

## 3. Architecture

- **Main process (`main.js`)** owns all state through one `Store` instance. Windows never touch the disk.
- **Note windows**: one frameless `BrowserWindow` per open note (`wins: Map<noteId, BrowserWindow>`),
  `win.noteId`, `win.revealed` (true after the password was typed in *that* window).
- **List window**: a single window (`listWin`) with a hidden title bar plus overlay window buttons.
- **Tray icon**: New note, All notes, Bring notes to front, Start with Windows, Quit. Closing every
  window keeps the app running in the tray. Single instance: launching again shows the list.
- **IPC** (see `preload.js` for the renderer side):
  - note window: `note:get`, `note:update`, `note:update-sync` (used on unload), `note:dates`,
    `note:new`, `note:close`, `note:trash`, `note:hover`, `note:unlock`, `note:relock`,
    `note:set-locked`, `lock:set`, `att:save`, `att:pick-images`, `att:open`, `open-external`, `list:show`
  - list window: `list:get`, `list:new`, `list:open-note`, `list:close-note`, `list:trash`,
    `list:restore`, `list:destroy`, `list:empty-bin`, `list:bring-front`, `list:set-locked`,
    `groups:make`, `groups:move-up`, `groups:move-to`, `groups:ungroup` (= move-up for a note),
    `groups:dissolve`, `groups:rename`, `groups:update` (name/style/color), `groups:apply` (mass edit
    colour/font), `groups:trash`, `groups:set-locked`, `groups:reveal`, `groups:hide`, `settings:set`,
    `backups:list`, `backups:now`, `backups:restore`, `backups:open-folder`, `data:open-folder`
  - main → windows: `notes:changed` (list reloads), `settings:changed` (`{spellCheck, hasPassword}`),
    `note:look` (a note's colour/font/lock changed from outside), `note:lock-now` (note became locked
    from the list: the window saves, then calls `note:relock` and hides)
  - **No native message boxes.** The list window asks every question with its own app-styled `modal()`
    (list.js) and only then calls main (`list:destroy`, `list:empty-bin`, `backups:restore` don't ask
    themselves). The only native dialog left is the photo file picker (`att:pick-images`).
- `note:update` only accepts keys in `EDITABLE` (main.js). Changing `html` or `title` bumps `updatedAt`.
  Other changes (colour, position…) don't count as edits.

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
orange|mint|charcoal), font (hand|round), size (s|m|l), opacity (0.25–1), solidOnHover, pinned, open
(window open → reopens at start), rolled, locked, spell (null = follow Settings | true | false),
groupId, bounds {x,y,width,height} (unrolled height), createdAt, updatedAt, deletedAt (null or in Bin),
restoredFrom`.

**Settings** (changing only `listSort` deliberately does *not* send `notes:changed`, since the list already
redrew; that was the 1.0.2 double-refresh bug): `startWithWindows, defaultColor, defaultFont, firstRunDone, listBounds, spellCheck (false),
spellCyrillic (false), listSort {by: updated|created, dir: desc|asc, groups: mixed|first|last},
listSize (s|m|l, card size in the list; like listSort it doesn't trigger a reload), defaultColor may be
"random" (store.create picks one of the 7 pastel papers),
lock ("salt:hash" scrypt, or null)`.

**Backups**: made at most once per day (on start and every 3 hours). The newest 30 are kept. Restoring a
backup **never overwrites**: notes that differ come back as extra closed notes marked `restoredFrom`.
Attachments are only deleted when no note *and no backup* references them, and only once they're over 2
days old (`sweepAttachments`).

**Bin**: `list:trash` sets `deletedAt`, and only "Delete forever" / "Empty bin" removes the file.

**Groups** form a folder tree: a note has `groupId` (its direct group), and a group has `parentId` (null = top
level). `style` is one of stack|folder|envelope|notebook, `color` one of
kraft|sun|rose|coral|lilac|sky|mint|graphite, and `locked` is a boolean. store.js helpers: `chain` (group and its
ancestors), `subtree`, `notesInTree`, `isInside`, `setParent` (refuses loops), `lockedGroupsOf`. A group
is removed automatically once nothing in its subtree (including notes in the Bin) is left. A group with
one note stays. **Ungroup** (`dissolveGroup`) moves the notes and sub-groups up one level, never deletes.
Restored notes go back into their group if it still exists. Broken parent links on load are reset to top level.

**Drag rules** (`groups:make(dragId, targetId)`): note→note in the same place makes a new group *inside*
the current one; note→note in another group joins that group; note→group or group→group puts it inside
(not into itself or its own sub-groups); group→note does nothing. `groups:move-to(id, groupId|null)` moves
anything anywhere, used by the back button, the crumbs and the drop strip.

---

## 5. Features → where they live

| Feature | Where |
|---|---|
| Pin on top (`setAlwaysOnTop(…,'screen-saver')`), un-minimise pinned notes, re-assert every 2.5s | main.js `applyState`, `enforcePinned`, `minimize` handler |
| See-through + solid on hover | main.js `applyState`, `note:hover`; note.js mouseenter/leave |
| Roll up (window height 34px; real height kept in `bounds.height`) | main.js `setRolled`; note top-bar `#btnRoll` |
| Reopen in place; off-screen notes pulled back onto a screen | main.js `fitBounds`, `visibleOnSomeDisplay`, `refitAll`, start() |
| Window closed via X → `open=false`. Closed by Windows shutdown → stays open | main.js `note:close`, `closed` handler with 2.5s grace |
| Title (⋯ menu `#titleInput`) → top bar `#title` + window title | note.js, main.js `titleOf` |
| Formatting, bullets, checklists (`ul.checklist`, `li.done`; click the box to tick) | note.js `runCmd`, `toggleChecklist`; uses `document.execCommand` |
| Text style panel (colour/highlight/size/clear) `#textPop` | note.js. "Normal colour" = apply sentinel `#010203` then strip it |
| Spelling: per-note `spell`, global `spellCheck`; Cyrillic ignored | note.js `applySpell`; main.js `spellLanguages` |
| Add panel: photo, voice, drawing, link, table, numbers, divider, date | note.js `doInsert`, `insertNodes` (direct DOM insert, keeps voice chips intact) |
| Photo resize handle `#imgHandle` (60px → editor width, stored as `width` attr) | note.js "photo resizing" section |
| Voice notes: MediaRecorder webm/opus → `.voice` chip with play/pause | note.js "voice notes" |
| Drawing: canvas, 6 pens, 3 sizes, eraser, undo; cropped PNG; double-click to edit | note.js "drawing" |
| Lock: one password; hidden notes get empty html from main; can't be overwritten while hidden | main.js `viewOf`, `SECRET`, `applyPatch` guard; note.js "locking" |
| Last-edited stamp `#stamp` + dates in ⋯ menu | note.js "dates" |
| List: cards, search (title+text), Bin, Settings, About | list.js |
| Groups: HTML5 drag & drop, group card = clipped stack, group view with name/ungroup | list.js `dropTarget`, `groupCard`, `renderNotes`; main.js `groups:*` |
| Sorting | list.js `sortItems`; saved in `settings.listSort` |
| Start with Windows (`--startup` arg → don't show list) | main.js `syncLoginItem` (only when packaged) |
| Rename migration from `%APPDATA%\Sticky Pins` | main.js `migrateOldData` (copies, never moves/deletes) |
| Nested groups, crumbs, back button, drop strip | list.js `renderNotes`, `renderGroupHeader`, `canMoveInto`, `moveInto`; main.js `groups:*` |
| Group looks (stack/folder/envelope/notebook) + colours | list.js `groupArt`, `groupCard`; list.css "group looks" |
| Group settings panel (look, colour, mass edit, lock, ungroup, bin) | list.html `#groupPanel`; list.js "group settings panel"; main.js `groups:update`, `groups:apply` |
| Lock groups; open a locked group in the list | main.js `groups:set-locked`, `groups:reveal`/`hide`, `listOpenGroups`, `groupOpenInList` |
| Lock/unlock notes from the list | main.js `list:set-locked`, `hideNewlyLocked`; list.js `lockNote`/`unlockNote` |
| Right-click menus (notes, groups, Bin) | list.js `showCtx`, `noteMenu`, `groupMenu` |
| App-styled pop-ups + toasts | list.js `modal()`, `toast()`; list.html `#modal`, `#toast` |
| Bin confirmation (Shift+click skips) | list.js `trashNote(n, skipAsk)` |
| No double redraw; animate only on view change | list.js `load()` (signature check), `render(animate)`; list.css `.cards.anim` |
| Search (clear button; only inside the open group) | list.js `renderNotes` (pool = `notesInTree(openGroup)`), `#qClear`, `clearSearch` |
| New note inside the open group | list.js `newNote()` → `list:new(groupId)` → main.js `createNote({groupId})` |
| Card sizes s/m/l | list.html `#btnSize`/`#sizePop`; list.js `paintSize`; list.css `.cards.size-*` |
| Group panel shows shared colour/font | list.js `panelScope`, `shared`, `paintPanel` |
| Title vs untitled first line on cards | list.css `.card .t1` (600) / `.t1.tt` (800, bigger); needs `@fontsource/*/600.css` in list.html |
| Password set/change button (pop-up) | list.js `#pwSave` handler (modal with 2 or 3 inputs) |

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
- The renderer of a hidden locked note must never save: `changed()`/`saveNow()` return early when
  `hidden`, and main strips `html/text/firstImage` from patches. Keep both guards.
- `collect()` in note.js strips UI-only state (playing voice chips, `.sel-img`) before saving.
- Editor uses `contenteditable` + `execCommand` (deprecated but fully working in Chromium/Electron).
- List cards for locked notes get `text:''` and `firstImage:null` from main, so never send content to the list.
- Minimum note size 200×120, default 320×300. The bottom bar's formatting buttons scroll sideways
  (`.tleft`) on narrow notes so the Add button always stays visible.
- Electron version is `^39` in package.json, installed on the owner's PC by `build.bat`.
- **Build gotcha (`spawn UNKNOWN`)**: near the end, electron-builder runs a small helper exe it just made
  (`dist\<Setup name>.exe`, ~250 KB) to create the uninstaller. Windows Security can refuse to start a brand-new
  unsigned file, which shows up as `spawn UNKNOWN` in `WineVmManager.exec`. `build.bat` retries once after 15 s,
  then explains how to allow it (Protection history → Allow, or a folder exclusion). If **Smart App Control**
  is the blocker, exclusions don't help. Options then: code-sign, or build elsewhere. It happened on 1.0.3
  (Windows build 26200).

---

## 7. Testing

- `npm test` runs `tests/run.js`: each `*.test.js` in a separate process with its own temporary data
  folder. `tests/fake-electron` stands in for Electron (windows, ipcMain, session, dialogs…), so the real
  `main.js` and `store.js` run under plain Node.
  - `store.test.js`: saving, crash recovery from .bak, backups, once-a-day rule, restore, pruning.
  - `main.test.js`: windows, opacity/pin/roll, new note placement, attachments and the protocol, blocked
    links, permissions, close vs quit, reopening in place.
  - `upgrade.test.js`: Sticky Pins → CosmoNotes migration, titles, dates, locking and passwords,
    spelling languages, groups, sorting, backups with groups.
  - `groups.test.js`: nested groups and drag rules, no loops, move-up/move-to, looks and colours, mass
    edit (with and without sub-groups) pushed to open windows, locking groups (windows hide, list blanks,
    reveal/hide, open-from-list), lock/unlock notes from the list, ungroup moving things up, bin a group.
- **UI checks** (done during development): load `src/note.html` / `src/list.html` in Chromium (e.g.
  Playwright) with a mock `window.sticky` object injected before load, then click through and screenshot.
  The mock must implement every `window.sticky.*` method from preload.js.
- Things only a real Windows machine can confirm: the installer, always-on-top behaviour, the tray,
  start with Windows, the microphone, and the spellchecker download.

---

## 8. Releasing a new version (do this for EVERY update – see the versioning rule at the top)

1. Bump `version` in `package.json`: third digit, unless the owner said otherwise.
2. Add the version at the top of `VERSIONS` in `src/about.js`, and set `LAST_UPDATED`.
3. Add the same entry to `CHANGELOG.md`.
4. Update this file: the "Last updated" line at the top and any sections that changed.
5. Update `HOW TO INSTALL.txt` and `build.bat` if they mention the version or file name.
6. Run `npm test`. The owner runs `build.bat` → `dist/CosmoNotes Setup <version>.exe`.

---

## 9. Ideas mentioned or likely next

- Per-note passwords (the owner said "one password for all notes **for now**").
- Maybe: drag to reorder notes by hand (currently only sorting), and custom group icons/stickers.
- Reminders/alarms on notes, a global "new note" shortcut, and export/import to a single file (offered in 1.0.0, not chosen yet).
