# Architecture, security and locks

Open this when changing `main.js`, `main/`, `preload.js`, IPC, windows, the tray, or anything about locking.

**`main.js` is only the entry** (start-up and the app lifecycle); the main process code is in `main/` (what each
file holds: `CONTEXT.md`). Where this file says "main.js `name`", grep `main/` for the name. The four shared variables
are properties of one object, `S` in `main/state.js`: `S.store`, `S.listWin`, `S.quitting`,
`S.listUnlockedAll` (plus the `wins` map, exported next to it). **Always write `S.store` etc.; never copy one into a local
variable or destructure it** (`const { store } = S` would keep the old value forever once it changes). Files only
`require()` files below them (no circles): `code-structure.test.js` checks that, that every `main/` file is loaded, and that
no loose `store` / `listWin` / `quitting` / `listUnlockedAll` is left.

## Architecture

- **Main process (`main.js`)** owns all state through one `Store` instance. Windows never touch the disk.
- **Note windows**: one frameless `BrowserWindow` per open note (`wins: Map<noteId, BrowserWindow>`),
  `win.noteId`, `win.revealed` (true after the password was typed in *that* window).
- **New notes:** `createNote` (main/note-window.js) returns a promise of the note's id, settled by the
  window's `win.ready` when it shows (or closes first). `note:new` / `list:new` return it, so the + button spins a ring
  (`.busy`) until every note it asked for has shown (seconds on a slow PC). Every click makes a note (the owner's wish:
  spamming + is allowed); don't add a guard that drops clicks.
- **List window**: a single window (`listWin`) with a hidden title bar plus overlay window buttons.
- **Tray icon**: New note, All notes, Bring notes to front (also unrolls rolled-up notes), Start with Windows,
  Quit; also "Panic: hide all notes" while the panic button is on, "Reopen notes" while the panic closed some,
  "Update to X…" while a newer version is known, "Downloading / Installing the update…" while it runs.
  Closing every window keeps the app running in the tray. Single instance: launching again brings the
  notes up (without unrolling) and shows the list. Clicking the tray icon and launching again also reopen what the
  panic button closed (`comeBack`, main/tray.js).
- **IPC** (see `preload.js` for the renderer side):
  - note window: `note:get`, `note:update`, `note:update-sync` (used on unload), `note:dates`,
    `note:new`, `note:duplicate`, `note:close`, `note:trash`, `note:hover`, `note:unlock`, `note:relock`,
    `note:set-locked`, `lock:set` (`{current, next, kind}`, kind = 'pin' | 'password'), `note:minimize`, `note:maximize`, `att:save`,
    `rec:start`, `rec:chunk`, `rec:end`, `rec:done` (a voice recording written while it is made, `main/recordings.js`;
    a hidden locked window can't start one),
    `att:pick-images`, `att:open`, `open-external`, `list:show`, `ink:show`, `ink:drag`, `ink:size`, `ink:drop`, `ink:hide`
    (the toolbars' and menus' own windows outside the note: `ui-gotchas.md` → "Drawing toolbar outside the note"), `stt:start`, `stt:audio` (send), `stt:stop`, `stt:cancel`,
    `stt:transcribe` (voice to text, below), `remind:set`, `remind:act` (reminders, below)
  - list window: `list:get`, `list:new`, `list:duplicate`, `list:open-note`, `list:close-note`, `list:trash`,
    `list:restore`, `list:destroy`, `list:empty-bin`, `list:bring-front`, `list:set-locked`, `list:favorite`, `list:apply`,
    `list:edit` (the Edit sheet: title + colour; Edit design: also `opacity` and `fx`, neither an edit; `fxKeys` changes only those effect settings), `list:unlock-all` / `list:lock-all` (the Locked tab),
    `groups:make`, `groups:move-up`, `groups:move-to`, `groups:ungroup` (= move-up for a note),
    `groups:make-from`, `groups:dissolve`, `groups:rename`, `groups:update` (name/style/color), `groups:apply` (mass edit
    colour/font), `groups:trash`, `groups:set-locked`, `groups:reveal`, `groups:hide`, `settings:set`,
    `backups:list`, `backups:now`, `backups:restore`, `backups:open-folder`, `data:open-folder`, `stt:status`, `stt:use`,
    `stt:download`, `stt:download-cancel`, `stt:remove`, `stt:test` (Settings → Voice to text), `update:status`,
    `update:check`, `update:install`, `update:cancel`, `update:open-page` (Settings → About, below),
    `list:remind-get`, `list:remind-set` (a note's reminders, below)
  - main → windows: `notes:changed` (list reloads), `settings:changed` (`{spellCheck, hasPassword, lockKind,
    lockLen}`), `note:look` (a note's colour/font/lock/rolled changed from outside), `note:lock-now` (note became
    locked from the list: the window saves, then calls `note:relock` and hides), `note:win-state` (`{maximized}`), `list:nav` (mouse back/forward
    buttons sent as Windows app-commands), `stt:event` (a voice-to-text job's draft / final / status / progress / ready /
    error, to its note window only), `stt:changed` (Settings → Voice to text, to the list), `update:changed` (the
    update's status, to the list), `update:show` (go to Settings → About's updates: the tray's line), `remind:ring` (reminders
    that just went off, to their note window: it plays the sound)
  - the voice-to-text engine window talks only `engine:msg`, both ways (`src/engine/preload.js`)
  - `note:ctx` (main → note: the text's right-click lines, by id) / `note:ctx-act` (the one picked), `win:touch`
    (any window: pressed, comes up)
  - **No native message boxes.** The list window asks every question with its own app-styled `modal()`
    (list/settings-menus.js) and only then calls main (`list:destroy`, `list:empty-bin`, `backups:restore` don't ask
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
- Pasted HTML is sanitized with an allow-list (`cleanTree`, src/note/content.js).
- `cosmomodel://engine/` is answered only on the voice-to-text engine's own session (see below); the note and
  list windows can't load it.
- Attachments are served through the custom `stickyfile://att/<name>` protocol. Names are validated by
  regex and `path.basename`. The scheme name `stickyfile` is kept from 1.0.0 because it is stored inside
  note HTML, so **don't rename it**.

## Locks and hidden notes

- **Encryption (the owner's wish).** `main/crypt.js` explains it at
  the top. Rules that aren't obvious from the code:
  - The **recovery key** is the recovery story: without the PIN and without it, encrypted notes are gone. Never add a
    "reset by editing settings.json" for encrypted notes, and never weaken `KDF_N_PW` (it is what makes PIN guessing slow).
  - While `settings.crypt` exists, `settings.lock` is the marker `'encrypted'` (`install` puts it back): the PIN is checked
    by opening the key (`checkPassword` is **async**: always `await` it). No quick hash may sit next to the keys.
  - The store writes every note through `S.store.sealer` (`diskForm`): writeNow **and** backups. Anything new that writes a
    note to disk must go through `diskForm` too, or locked notes leak in plain text.
  - In memory a note is sealed (`n.enc` set, secret fields empty) until the PIN is typed (`openAll`). A sealed note counts as
    locked (`isLocked`, `hiddenInList`), is written back unchanged, and must never be "saved" from its empty fields.
  - `SECRET` (constants.js) = what is hidden from windows **and** what is sealed: title, html, text, firstImage, ink (and
    remindMsg, tags). A new field with note contents belongs in both `SECRET` and `SECRET_FIELDS` (crypt.js),
    with its empty value in crypt.js `blank()` and in locks.js `viewOf`.
  - Photos / drawings / voice of a locked note are sealed files; `note.encAtt` lists them so `sweepAttachments` keeps them.
    Read attachment bytes only through `attachmentBytes` / `openableCopy` (a sealed file is useless otherwise).
  - `syncSeals` (start-up and every `notifyList`) seals or opens files whose lock changed; only those are written.
  - "Turn off" keeps the keys (old encrypted backups must stay openable) and only stops sealing (`crypt.off`).
    If encryption is off and both the PIN and recovery key are lost, deleting `"crypt"` and setting `"lock": null` in
    settings.json resets it; only backups made while it was on are then lost.
  - **Backups (the owner's wish):** copies in `backups/` of a note that is locked now, or was locked when that
    backup was made (its own lock or a locked group in that backup's `groups.json`), are sealed where they are
    (`sealBackups`): one full pass (`crypt.backupsSealed`, again after turning encryption back on), then only a note that
    just became locked (`backupsDone` in `syncSeals`). New backups are sealed by `diskForm` anyway.
  - **Setting up tries everything first (`makeKeys`)**: seal + open a test note, the key locked and opened again
    with the PIN and the recovery key. If anything throws, nothing is saved, `lastError` goes to the list (`status().error`),
    and `lock:set` falls back to the old `salt:hash` so the PIN still works. Reason: the owner's PC never got encrypted in
    1.1.30, and this cloud workspace can't run Electron's own crypto library (BoringSSL) to check; only his PC can.
  - **Notes locked before 1.1.30 wait for the PIN** (the private key needs it). `status().needPin` makes main open the list
    at start (`ipc-crypt.js`) and the list ask for the PIN (`showKeyIfNeeded`).
  - Format versions: `enc.v` / file magic 2 (`CNSEAL2`) = AES key from SHA-256 (1.1.31); 1 (`CNSEAL1`, HKDF) = 1.1.30, still
    read. The temp copies for "Open" are deleted at start and on quit.
- **Locks: what "locked" means.** A note is locked if `note.locked` is set or any group in its chain is
  locked (`isLocked`, `lockedBy` = 'note' | 'group' in main.js). Note windows have `win.revealed`, which is
  true while that window may show contents (set at open for unlocked notes, after the password, or when opened
  from a group already opened in the list). The list window has `listOpenGroups` (groups opened with the
  password, cleared when the list closes). `list:get` blanks the text/photo of notes that are locked or sit in
  an unopened locked group (`locked: true` = show as a locked card, `ownLock` = the note's own lock) — except a note
  whose open window is unlocked (`win.revealed` and not `win.lockPending`, the owner's wish): it shows in the
  list too (`openUnlocked: true`) until that window is closed or locked again. A note
  locked by its group can't remove the lock from inside the note ("Locked with its group").
- **Unlocked for now (the owner's wish):** `unlockedForNow` (`main/list-visibility.js`) holds the note and group ids
  unlocked from the list ("Unlock…") until CosmoNotes quits. **Memory only: never save it** (a restart must lock them
  again). The lock itself (`n.locked` / `g.locked`) stays, so the note stays sealed on disk. `openForNow(n)` is the check
  for "may show" (list, opening a window, `hideNewlyLocked` leaves it open). Locking, removing a lock, "Lock again" (list,
  note, Locked tab) take ids out. "Remove lock…" is the only way to remove a lock from the list.
- When a note becomes locked from outside (list right-click, locking its group, dragging it into a locked
  group), main sends `note:lock-now`. The window first saves what was typed, then hides. Never hide it
  directly from main, or the last keystrokes would be lost.
- **Recording while a note gets locked:** the window puts the chip in and saves before it hides (`relock`,
  `lockNow`); when it can't (already hidden), `rec:end` with `kept` makes main add the chip. The `.part` file of a
  locked note being recorded is plain until it is finished; then the note's next save seals it (or `sealLoose` after a crash).
- The renderer of a hidden locked note must never save: `changed()`/`saveNow()` return early when
  `hidden`, and `applyPatch` takes only `WHILE_HIDDEN` (pinned, clickThrough, rolled) from a hidden window. Keep both guards.
- List cards for locked notes get `text:''` and `firstImage:null` from main, so never send content to the list.
- **Nothing of a hidden locked note or group changes until it is unlocked (the owner's wish).** While its lock hides it, it can only be picked, unlocked or have its lock removed (and opened: its
  window asks for the PIN). Main is the guard: `applyPatch` (`WHILE_HIDDEN` only), `note:duplicate`, and every list action
  that changes a note or group (`list:favorite` / `edit` / `apply` / `duplicate` / `close-note`, `groups:make` /
  `make-from` / `move-to` / `move-up` / `rename` / `update` / `apply` / `dissolve`) refuse a note `hiddenInList` or a group
  `groupShut` (locked and not open in the list, or inside one; a shut group can't be filled either). The windows only hide
  what would be refused: the list's `isShut` (list/base.js: menu = Select + lock options, no card buttons, no dragging, star
  shown only, `bulkParts(all)`, no Edit design), the note's ⋯ menu and effects button (note-text.css). A new action on a
  note or group needs the same check in main. The exceptions (the owner's picks): Snooze and Done on a reminder that
  rings, when that reminder doesn't ask for the PIN (`unlock` off; `remind:act`); and renaming or deleting a tag in every
  note (Manage tags, `main/ipc-tags.js`): when a hidden note or shut group has it (or a note is still sealed), only with
  the PIN in that same call (`pinCheck`), and then the hidden ones change too.

## Evening colours and the panic button

- **One clock, in main** (`main/evening.js`): every 30 s it works out the phase (0 = day, 1 = evening, `src/evening.js`
  `phase`) and, only when it changed (steps of 0.01), sends it to every note (`note:evening`) and the list
  (`list:evening`) and sets each note window's background (`paperOf`). Windows never keep time themselves, so a note
  and its card always agree. A setting change sends it at once (`pushEvening(true)`). The phase is sent whether or not
  Settings has evening colours on: a note can turn them on for itself.
- **The palette is one list** (`src/evening.js` `PALETTE`), the window CSS only mixes (`color-mix` in oklab of `--d-*` and
  `--e-*` by `--eve`). A new light paper colour needs an evening shade there (and `evening.test.js` checks dimmer +
  contrast ≥ 7 with its ink); a dark one needs none.
- **The panic button** (`main/panic.js`) closes windows with `closeNoteWindow` (each saves on unload, a recording becomes
  a voice note as on any close), then `coverAll(keep)` (the same "Lock again" as the Locked tab) and closes the list
  window (closing, not hiding: nothing of it is left in a window). `keep` = notes with `panic === false`: their window,
  its unlock and their own "unlocked for now" are left alone (the owner's pick).
- **The shortcut is global** (`globalShortcut`): registered only while `panicOn` and a key is set; a letter, digit or sign
  needs Ctrl, Alt or the Windows key (`validKey`, the list checks the same). Settings waiting for a new one sends
  `panic:capture` so the old one is let go meanwhile; `will-quit` lets go of everything. If Windows refuses it (another
  app has it), `list:get` says `panicKeyError: 'taken'`.
- **`settings.panicClosed`** is saved, so "open CosmoNotes again" also works after a quit: start-up reopens them after
  the notes that were open. Reopened locked notes open hidden (their window asks for the PIN).

## Voice to text

Speak to text and Transcribe. Files: `main/stt-engine.js` (engine window, protocol, session), `main/ipc-stt.js` (jobs,
Settings), `main/stt-models.js` (the list), `main/stt-download.js` (the download), `src/engine/` (the page), `src/note/speech.js`
(the note window's side), `src/mic-worklet.js`. Rules that aren't obvious from the code:
- **The engine** is one hidden window owned by main, made on first use and closed after 3 idle minutes (while no job
  runs). It is sandboxed, has its own small preload and its own in-memory session `cosmonotes-stt`: no permissions,
  `will-navigate` / `will-redirect` / new windows refused, and every request that is not `cosmomodel:`/`data:`/`blob:` is
  cancelled (so the engine can never reach the internet). `cosmomodel://engine/` serves a fixed list only (`route`):
  the page, `/engine.mjs`, `/engine-core.mjs`, `/lib/<LIB_FILES>` and `/models/<id>/<file>` for the
  files of the set that is installed; anything else (`..`, unknown names, a query string) is a 404. Every answer has
  COOP/COEP/CORP (cross-origin isolation = multi-threaded WASM). The page's CSP: `script-src 'self' 'wasm-unsafe-eval'`
  plus the import map's sha256; no `blob:` (the prototype's report-only check never saw it needed), no eval.
- **The import map is fixed** (`IMPORT_MAP` in stt-models.js): `@huggingface/transformers`, `onnxruntime-web/webgpu`,
  `onnxruntime-common` → files in `src/engine/lib/` (vendored; its README says from where). ONNX Runtime loads its
  `.wasm`/`.mjs` from `/lib/` (`wasmPaths`); Transformers.js reads models from `/models/` with remote models off and
  every cache off, and its `fetch` refuses other origins.
- **Jobs never outlive their note window**: closing it, a crash of its page, or the window being hidden (locked) ends
  them; every message to the window and every audio piece from it checks `mayShow` (the note unlocked or this window
  revealed). Main never writes the text into a note: the window inserts it (the usual guards stay: a hidden window
  gets nothing and never saves). One Speak to text at a time (another window gets `busy`); Transcribe jobs wait for each
  other; the engine runs the model one piece at a time (`asrLock`), so a Transcribe can run during a Speak to text.
- **One model** (the owner's wish): Whisper small.en (`MODEL` in stt-models.js), downloaded in Settings. There
  is no choice and no built-in model (Standard / Moonshine is gone). Not downloaded: `stt:start` / `stt:transcribe`
  answer `{ error: 'nomodel' }` before anything starts (the window says "Voice to text isn't downloaded yet. Get it in
  Settings."). While a job runs, the next one uses the model already loaded. A model that fails to load (a graphics card
  problem) = the job fails (the recording is kept); `startError` shows in Settings. No other model is tried.
- **Live or after you stop** (`modeOf`): Settings → "Words appear" (`settings.sttWhen`: `live` | `stop`).
  Not set: by the installed set (there is no "Test my computer"): the graphics card's = live, the processor's = after
  you stop; only then does the window say "On this device, the words appear when you stop." (`ready` event `auto: true`) (Whisper's live pieces are padded to 30 s: 1.2–1.6× on the owner's CPU). Not
  `live` = the engine holds every piece's text until Stop (no drafts). The engine's safety net stays: more than 5 s
  behind = no more drafts for that session.
- **Speak to text and the recording**: it is the voice-note recorder (`rec.stt`). Normal finish = `rec:end 'discard'` (the
  clip is deleted at once). Cancel or a failure = `rec:end 'save'` (a voice note where the text was). Closing / locking =
  `stopRecordingNow` → `sttAbortNow` first (the caret goes to the marker), then the recorder's `kept` path.
- **Only main goes online**, and only on Download (from huggingface.co at the fixed commit). The engine window can't.
  Nothing comes with the installer.

## Updates

- **`main/updater.js`** (the feed, the download, starting the installer) and **`main/ipc-update.js`** (IPC, when to
  check, Install, `showUpdate`). The tray (`updateLine`) and the list (`paintUpdate`) only show `updater.status()`:
  `state` = idle | checking | none | checkfailed | available | downloading | installing | failed (`failure`: 'download'
  or 'start'), `latest`, `pct`, `page` (the release's page).
- **The feed**: `https://github.com/vkashirski/CosmoNotes/releases/latest/download/latest.yml` (electron-builder's,
  published by `.github/workflows/release.yml`; drafts and pre-releases are never "latest"). `parseLatest` reads it
  without a YAML library and refuses anything but `CosmoNotes-Setup-<version>.exe` with a size and a sha512. The
  installer comes from `…/releases/download/v<version>/<file>`. A test points both at a local server (`setPlace`).
- **When**: the installed app only (`app.isPackaged`) and while `settings.updateCheck` is on: 30 s after start, then an
  hourly tick that checks once a day. These checks are quiet: a failure keeps what was shown. The button's check says
  "Couldn't check". `npm start` can check, but Install says it is for the installed app.
- **Install** (asked first in the list): refused while a recording or voice to text runs (`busy`: `isRecording`,
  `sttBusy`). Download to `%TEMP%\CosmoNotes-update\<file>.part`, size + sha512, rename; a file already there that
  matches is used again. Then `quitWhenFree` (waits for a recording that started meanwhile) → `S.quitting`, `app.quit()`:
  windows save on unload, will-quit finishes recordings and flushes the store, then `finishUpdate(e)` (last in
  will-quit) stops the default quit, starts the installer detached with `--updated /S --force-run` and `app.exit(0)`s
  once Windows says it started. If Windows refuses it (`error`: Smart App Control, antivirus): `app.relaunch` with
  `--update-failed=<version>`, and that start shows Settings → About ("Couldn't start the update", the page). No answer
  in 15 s: it leaves anyway. Never run the installer before the store is flushed.
- **At start** `cleanup` deletes `CosmoNotes-Setup-*.exe(.part)` from the temp folder (one still running stays).
- **Network**: like the model download, only main goes online, only to github.com (and the download host it redirects
  to). Nothing about notes or the PC is sent: two plain GETs.

## Reminders

- **The rules are `src/reminders.js`** (times, repeats at the local clock time of `start`, `ring` / `done` / `snooze`,
  `hiddenNow`, the words); store.js cleans with it, main and both windows use it. **`main/reminders.js`** keeps the one
  clock: one `setTimeout` for the next reminder of any note, at most 60 s ahead (so a PC that slept catches up), and
  `powerMonitor` `resume` / `unlock-screen` check at once. `check(now)` rings everything due (tests call it with a time).
- **Going off** (`popUp`): the window opens (`openNoteWindow`, not focused) or comes up (restored, unrolled, `moveTop`), with
  no move; a window that wasn't open first gets `placeForRing` (its place if its top bar is on the monitor with the mouse,
  else that monitor's top-right corner). `applyState` keeps it on top while a reminder rings (`onTop`), `flashFrame`. The
  sound is the window's: `remind:ring` to a loaded window, or `win.ringIds`, handed over once by `note:get` (`ring`) to one
  still loading (`win.ringLoaded`). What rings is in the note's data, so the strip is right after a restart; ones still
  ringing at start come back quietly (`startReminders`). The panic button's notes (`settings.panicClosed`) don't open.
- **Hiding** (`settle`): `hiddenNow` closes the window (`closeNoteWindow`: the window saves on unload); start-up doesn't open
  such a note; the list leaves it out (`remHidden`, list `live`) unless the filter or `remindShowHidden` shows it. Opening it
  from the list still works.
- **Changes**: windows send only what the panel sets (`setReminders` takes time, repeat, sound, hide, unlock); a reminder
  whose `start` and repeat are unchanged keeps its state, a new time starts again (`firstAt`); one for a time that has passed
  rings at once. Not an edit (`updatedAt` stays). So the panel sends a repeat's old `start` and repeat object when
  its time and days are as they were (`plan` → `F.keep`), and a changed repeat starts at its first time from now (`nextFrom`
  from now): never a start in the past. Repeats it can't show as week days (every month, every N, an end) stay as they are.
- **Secrets**: `note.remindMsg` is in `SECRET` and crypt.js `SECRET_FIELDS` (one `blank()` for the store's writes and the
  backups): sealed with a locked note, `{}` while sealed, `null` in a hidden window, never in `list:get` (only `list:remind-get`,
  which refuses a note `hiddenInList`). `note.reminders` stays plain: main needs the times before the PIN.

## Which window is on top

- **Rule (the owner's wish):** the window opened or touched last is on top: a note, its toolbars and menus outside it, the
  list. Pinned notes stay above the rest (Windows' on-top layer); among them, the one pinned or touched last (`raisedAt`,
  `enforcePinned` every 2.5 s). A note's windows outside it are its children: always above their note.
- **Why main has to do it:** Windows raises a window only when a click gives it the focus. Most windows outside a note are
  `focusable: false` (the keyboard stays in the note), and a window that has the focus already doesn't come up when
  another of ours came up over it without taking the focus.
- **How:** every page sends `win:touch` on `pointerdown` (capture): the note's page (`touch('')`), each outside window's
  document (`touch(kind)`, set up in `barOut`; also right after one is shown), the list. `touchNote` (note-window.js):
  `raised(win)`, `win.moveTop()`, then `liftBars(win, kind)` (ink-window.js) moves its visible outside windows up in their
  `liftedAt` order (stamped when made and when touched), the touched one last. A note pinned over apps gets a peek while
  it doesn't have the focus. Nothing is saved, nothing takes the focus, so a hidden locked note may do it too.
- A new window outside a note: a kind in `BAR_FRAMES` / `BAR_KINDS` (ink-geometry.js); made with `barOut`, it touches by
  itself. The note's menu is one (`'more'`: » and every right-click menu, `showMenu`): placed with `showAt`, shown
  on a rolled-up note too (`SHOWS_ROLLED`). The text's right-click lines come from main by id (`note:ctx`, main/web.js);
  the one picked goes back (`note:ctx-act` → `runCtx`, only ids of the last menu): no native menu in a note window.

## App pins

- **What:** right-click a note's pin → "Pin over" (`src/note/pin-apps.js`): tick apps (or one workspace / file of an app).
  `note.pinApps` = `[{ app, part }]`; a note with some **mirrors its app** (`stateOf`): one of them in front = `'top'` (on top,
  like any pinned note); open but behind another app = `{ under }` (not always-on-top, `moveAbove('window:<hwnd>:0')` its
  app's nearest window: `place`, `win.appBehind` / `win.appUnder`; `note-state.js` `onTop(n, win)` reads it, so every
  `applyState` keeps it behind); none open (closed or minimised: WebRTC's list leaves minimised windows out) = `'hide'`
  (1.4.28: the note is minimised, so it stays in the taskbar).
  Every app = the normal pin (`pinApps: []`); unpinning forgets them (store.js keeps them only while `pinned`).
- **Which app is in front** (`main/app-pin.js`): `desktopCapturer.getSources({ types: ['window'], thumbnailSize: 0×0 })`
  gives the windows with their titles, front to back (EnumWindows order). Our own windows (`BrowserWindow.getAllWindows()`,
  by `getNativeWindowHandle()` against the source id `window:<hwnd>:0`) are skipped: the notes are always on top, so they
  come first. The first one left is the app in front. Nothing native (a `.node` module or koffi would be an unsigned DLL,
  and PowerShell's `Add-Type` is blocked in Constrained Language Mode, both Smart App Control trouble). Not confirmed on
  a real PC yet: the order, the cost. Another app's always-on-top window counts as in front.
- **Titles only** (no program name): `parseTitle` takes the last part after " - " / " – " / " — " as the app and the one
  before it as its workspace / file (VS Code: `file - folder - app`, Excel: `file - app`); a rule's part matches any part of
  the title. Browsers (`BROWSERS`) get no parts. An app whose title doesn't end with its name (some games, JetBrains IDEs)
  is listed under the wrong name; ticking it still works while that title stays.
- **The watch** is on only while an open note is pinned over apps (`sync`, called by `changed()` from `applyPatch`,
  `openNoteWindow` and a window's `closed`), and its clock (every `POLL_MS`, 0.5 s) ticks only while the focus is in
  another app (`focusMoved` on the app's `browser-window-focus` / `-blur`): reading the list made every note's drag
  hitch twice a second. While one of ours has the focus, ours is the app in front and nothing else can come in front;
  when the focus leaves, a check runs at once. Turning the watch on always checks once, focus or not (`mayShow` waits for it). One check at a time (`poll`); `check()` waits for the one running
  and runs again (tests call it). A list that fails or takes over `SLOW_MS` sets `broken`: every note shows.
- **Minimised, never closed (1.4.28, the owner's wish; was `win.hide()`, which took it off the taskbar as if closed):**
  `apply` sets `win.appHidden`, `showInk(win, false)` and minimises (`minimise`: `setMinimizable(true)` + `minimize()`,
  like its own button; note-window.js's `restore` sets it back to `false`, and its `minimize` handler leaves `appHidden`
  ones minimised). "Shown" is `onScreen` (visible and not minimised: Electron's `isVisible` is false while minimised on
  Windows). Showing uses `showInactive` (restores without the focus; not confirmed on a real PC yet) only once the window
  has loaded (`win.loaded`, set in `openNoteWindow`'s `showIt`, which asks `mayShow` first: a note opening pinned over
  apps waits for the first check, minimised, instead of flashing; `place` sets `appBehind` before it shows and `shown`
  moves it above its app after). A click on it in the taskbar (or anything else that restores it: the list's open, a
  reminder) calls `restored`: on top, `appHidden` off, until the focus leaves while its apps are still away. Anything
  that restores a minimised note must not do it for an `appHidden` one unless it means to show it.
  `enforcePinned` skips `appHidden` and `appBehind`; `watchInkBar`'s toolbars aren't on top while `appBehind`.
  A window minimised with its own button (`userMin`) is left alone.
- **The animation** (`animate`, the owner's pick "Drop in"): coming = fade in while dropping `ANIM.drop` px into place
  (`ANIM.in` ms, ease-out); going = fade out rising (`ANIM.out` ms), then back to its
  place, minimised, its opacity back (1.4.28; coming from minimised: clear, `showInactive`, then the drop).
  A turn mid-way goes on from where it is (`win.appAnim.p`, `home`). While it runs `rememberBounds` saves nothing, and an
  unchanged place is never saved, so app switches don't write the note; `placeInk` doesn't bring a toolbar back while
  `appHidden`. A maximised note only fades. Tests set `ANIM.in = ANIM.out = 0` (at once).
- **On top anyway** (`stateOf` → `'top'`): its window has the focus (ticking its list), a reminder rings, `broken`, or a **peek**
  (`peek(win)`: the list's open, Bring notes to front / a second start, Reopen closed note) that lasts until another window
  comes in front than the one there when it started (`peekFrom`, a window handle).
- **Locks:** `pinApps` is in `WHILE_HIDDEN` (a kind of pin): a hidden locked note's window may change it and ask `pin:apps`
  (only window titles). `list:get` sends `appPinned` for every note but the names (`pinApps`) not for one `hiddenInList`.

## Spellcheck

- `app.commandLine.appendSwitch('disable-features','WinUseBrowserSpellChecker')` forces Chromium's Hunspell
  spellchecker so that with only `en-US` loaded, Cyrillic words are skipped. When spelling is first turned
  on, Electron downloads the dictionary once from Google's CDN. That, the voice-to-text model's download (only
  when you press Download) and the update check (GitHub; Settings → About can turn the daily one off) and Settings →
  Feedback's Submit (only when pressed, only to `RELAY`) are the only network uses.

## Ground control (Settings → Feedback)

Settings → Feedback (1.4.34; "Ground control" in the code, `gc:*`): a feature request or a bug report goes to the owner's relay,
`feedback-worker/worker.mjs` (a Cloudflare Worker), which opens an issue in the private repo `CosmoNotesFeedback`.
Setup and the relay's settings: `feedback-worker/README.md`.

- **What is sent is what the form shows:** the words, the pictures added, the app details if ticked (version, Windows,
  Electron, arch), the email if given. Nothing from a note, and the list part never reads one.
- **Only the list window** may use `gc:*` (`fromList` in `main/feedback.js`). **Only main goes online**, only on Send,
  only to `RELAY` (a test points it elsewhere with `setRelay`).
- **Pictures are made smaller in main, never refused** (`shrink`, Electron's `nativeImage`): the longest side at most
  1600 px, PNG if it is at most 600 KB, else JPEG, then smaller sides until it fits. Re-encoding drops a photo's extra
  data (place, camera). Up to 3 pictures (`LIMITS`, the same as the relay's).
- **The puzzle:** `GET /challenge` gives a signed challenge and `bits`; main hashes `challenge:nonce:sha256(words)`
  (`wordsOf`: every text field, in order) until it starts with `bits` zero bits, in steps of 5,000 so main never stalls
  (more than 24 bits is refused). The relay checks it with one hash; a challenge is good for 15 minutes and used once.
- **The relay's other guards:** `OPEN` (off switch: the app says "closed for now"), body and field limits, 5 a day per
  IP (kept as a hash) and 50 a day in all (KV), `@names` / `#numbers` tamed. A report GitHub refused isn't counted. Its
  GitHub token is a Cloudflare secret; it never is in the app.
- **Choose first:** the section opens on two choices; picking one opens its form, with no switching inside it (the
  owner's wish). ← Back by the title, or Feedback in the sidebar again (a capture listener: it runs before
  `showSection`), goes back and keeps the words; a card with a draft says "Draft". Cancel (by Submit) discards, after
  asking.
- **Drafts, one per kind** (`gc:draft(kind, d)`; main `readDrafts` / `saveDraft`; store.js `feedbackDraft` /
  `saveFeedbackDraft`): on disk half a second after typing stops and on Back, kept after a failed Send. A Send that worked
  clears only its kind's draft.
- **Send rests** after a report went out (`WAIT`, 60 s), or until the relay's limit ends (`retryAfter`). The list counts
  it down on Submit. While it sends, Submit spins and "Sending…" shows beside it (`#gcLine`).
