# Architecture, security and locks

Open this when changing `main.js`, `preload.js`, IPC, windows, the tray, or anything about locking.

## Architecture

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
    `note:set-locked`, `lock:set` (`{current, next, kind}`, kind = 'pin' | 'password'), `note:minimize`, `note:maximize`, `att:save`,
    `att:pick-images`, `att:open`, `open-external`, `list:show`, `ink:show`, `ink:drag`, `ink:size`, `ink:drop`, `ink:hide`
    (1.1.15: the drawing toolbar's own window, see §6)
  - list window: `list:get`, `list:new`, `list:duplicate`, `list:open-note`, `list:close-note`, `list:trash`,
    `list:restore`, `list:destroy`, `list:empty-bin`, `list:bring-front`, `list:set-locked`, `list:favorite`, `list:apply`,
    `list:edit` (1.1.15, the Edit sheet: title + colour; 1.1.20 "Edit design": also `opacity` and `fx`, neither an edit), `list:unlock-all` / `list:lock-all` (1.1.15, the Locked tab),
    `groups:make`, `groups:move-up`, `groups:move-to`, `groups:ungroup` (= move-up for a note),
    `groups:make-from`, `groups:dissolve`, `groups:rename`, `groups:update` (name/style/color), `groups:apply` (mass edit
    colour/font), `groups:trash`, `groups:set-locked`, `groups:reveal`, `groups:hide`, `settings:set`,
    `backups:list`, `backups:now`, `backups:restore`, `backups:open-folder`, `data:open-folder`
  - main → windows: `notes:changed` (list reloads), `settings:changed` (`{spellCheck, hasPassword, lockKind,
    lockLen}`), `note:look` (a note's colour/font/lock/rolled changed from outside), `note:lock-now` (note became
    locked from the list: the window saves, then calls `note:relock` and hides), `note:win-state` (`{maximized}`), `list:nav` (mouse back/forward
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

## Security model

- `contextIsolation`, `sandbox`, no `nodeIntegration`, a CSP in each HTML file, and the app menu removed.
- Navigation is blocked. Links open in the real browser only for `http/https/mailto`.
- Permissions: microphone (audio only) and clipboard write. Everything else is denied.
- Pasted HTML is sanitized with an allow-list (`cleanTree` in note.js).
- Attachments are served through the custom `stickyfile://att/<name>` protocol. Names are validated by
  regex and `path.basename`. The scheme name `stickyfile` is kept from 1.0.0 because it is stored inside
  note HTML, so **don't rename it**.

## Locks and hidden notes

- The lock is a **privacy screen, not encryption**, a deliberate choice so a forgotten password can't
  lose data. The reset is documented in HOW TO INSTALL.txt (set `"lock": null` in settings.json).
  If encryption is ever added, it needs a recovery story first.
- **Locks: what "locked" means.** A note is locked if `note.locked` is set or any group in its chain is
  locked (`isLocked`, `lockedBy` = 'note' | 'group' in main.js). Note windows have `win.revealed`, which is
  true while that window may show contents (set at open for unlocked notes, after the password, or when opened
  from a group already opened in the list). The list window has `listOpenGroups` (groups opened with the
  password, cleared when the list closes). `list:get` blanks the text/photo of notes that are locked or sit in
  an unopened locked group (`locked: true` = show as a locked card, `ownLock` = the note's own lock) — except a note
  whose open window is unlocked (`win.revealed` and not `win.lockPending`, 1.1.14, the owner's wish): it shows in the
  list too (`openUnlocked: true`) until that window is closed or locked again. A note
  locked by its group can't remove the lock from inside the note ("Locked with its group").
- When a note becomes locked from outside (list right-click, locking its group, dragging it into a locked
  group), main sends `note:lock-now`. The window first saves what was typed, then hides. Never hide it
  directly from main, or the last keystrokes would be lost.
- The renderer of a hidden locked note must never save: `changed()`/`saveNow()` return early when
  `hidden`, and main strips `html/text/firstImage` from patches. Keep both guards.
- List cards for locked notes get `text:''` and `firstImage:null` from main, so never send content to the list.

## Spellcheck

- `app.commandLine.appendSwitch('disable-features','WinUseBrowserSpellChecker')` forces Chromium's Hunspell
  spellchecker so that with only `en-US` loaded, Cyrillic words are skipped. When spelling is first turned
  on, Electron downloads the dictionary once from Google's CDN. That's the only network use, and it's optional.
