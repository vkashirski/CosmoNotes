# Architecture, security and locks

Open this when changing `main.js`, `main/`, `preload.js`, IPC, windows, the tray, or anything about locking.

**Since 1.1.27 `main.js` is only the entry** (start-up and the app lifecycle); the main process code is in `main/` (what each
file holds: `CONTEXT.md`). Where this file says "main.js `name`", grep `main/` for the name. The four variables that were
shared by the whole old file are properties of one object, `S` in `main/state.js`: `S.store`, `S.listWin`, `S.quitting`,
`S.listUnlockedAll` (plus the `wins` map, exported next to it). **Always write `S.store` etc.; never copy one into a local
variable or destructure it** (`const { store } = S` would keep the old value forever once it changes). Files only
`require()` files below them (no circles): `code-structure.test.js` checks that, that every `main/` file is loaded, and that
no loose `store` / `listWin` / `quitting` / `listUnlockedAll` is left.

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
    `rec:start`, `rec:chunk`, `rec:end`, `rec:done` (1.2.4: a voice recording written while it is made, `main/recordings.js`;
    a hidden locked window can't start one),
    `att:pick-images`, `att:open`, `open-external`, `list:show`, `ink:show`, `ink:drag`, `ink:size`, `ink:drop`, `ink:hide`
    (1.1.15: the drawing toolbar's own window, see §6), `stt:start`, `stt:audio` (send), `stt:stop`, `stt:cancel`,
    `stt:transcribe` (1.3.1, voice to text, below)
  - list window: `list:get`, `list:new`, `list:duplicate`, `list:open-note`, `list:close-note`, `list:trash`,
    `list:restore`, `list:destroy`, `list:empty-bin`, `list:bring-front`, `list:set-locked`, `list:favorite`, `list:apply`,
    `list:edit` (1.1.15, the Edit sheet: title + colour; 1.1.20 "Edit design": also `opacity` and `fx`, neither an edit; 1.2.2: `fxKeys` changes only those effect settings), `list:unlock-all` / `list:lock-all` (1.1.15, the Locked tab),
    `groups:make`, `groups:move-up`, `groups:move-to`, `groups:ungroup` (= move-up for a note),
    `groups:make-from`, `groups:dissolve`, `groups:rename`, `groups:update` (name/style/color), `groups:apply` (mass edit
    colour/font), `groups:trash`, `groups:set-locked`, `groups:reveal`, `groups:hide`, `settings:set`,
    `backups:list`, `backups:now`, `backups:restore`, `backups:open-folder`, `data:open-folder`, `stt:status`, `stt:use`,
    `stt:download`, `stt:download-cancel`, `stt:remove`, `stt:test` (1.3.1, Settings → Voice to text)
  - main → windows: `notes:changed` (list reloads), `settings:changed` (`{spellCheck, hasPassword, lockKind,
    lockLen}`), `note:look` (a note's colour/font/lock/rolled changed from outside), `note:lock-now` (note became
    locked from the list: the window saves, then calls `note:relock` and hides), `note:win-state` (`{maximized}`), `list:nav` (mouse back/forward
    buttons sent as Windows app-commands), `stt:event` (a voice-to-text job's draft / final / status / progress / ready /
    error, to its note window only), `stt:changed` (Settings → Voice to text, to the list)
  - the voice-to-text engine window (1.3.1) talks only `engine:msg`, both ways (`src/engine/preload.js`)
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
- 1.3.1: `cosmomodel://engine/` is answered only on the voice-to-text engine's own session (see below); the note and
  list windows can't load it.
- Attachments are served through the custom `stickyfile://att/<name>` protocol. Names are validated by
  regex and `path.basename`. The scheme name `stickyfile` is kept from 1.0.0 because it is stored inside
  note HTML, so **don't rename it**.

## Locks and hidden notes

- **Encryption (1.1.30, the owner's wish; before that the lock was only a privacy screen).** `main/crypt.js` explains it at
  the top. Rules that aren't obvious from the code:
  - The **recovery key** is the recovery story: without the PIN and without it, encrypted notes are gone. Never add a
    "reset by editing settings.json" for encrypted notes, and never weaken `KDF_N_PW` (it is what makes PIN guessing slow).
  - While `settings.crypt` exists, `settings.lock` is the marker `'encrypted'` (`install` puts it back): the PIN is checked
    by opening the key (`checkPassword` is **async**: always `await` it). No quick hash may sit next to the keys.
  - The store writes every note through `S.store.sealer` (`diskForm`): writeNow **and** backups. Anything new that writes a
    note to disk must go through `diskForm` too, or locked notes leak in plain text.
  - In memory a note is sealed (`n.enc` set, secret fields empty) until the PIN is typed (`openAll`). A sealed note counts as
    locked (`isLocked`, `hiddenInList`), is written back unchanged, and must never be "saved" from its empty fields.
  - `SECRET` (constants.js) = what is hidden from windows **and** what is sealed: title, html, text, firstImage, ink. A new
    field with note contents belongs in both `SECRET` and `SECRET_FIELDS` (crypt.js).
  - Photos / drawings / voice of a locked note are sealed files; `note.encAtt` lists them so `sweepAttachments` keeps them.
    Read attachment bytes only through `attachmentBytes` / `openableCopy` (a sealed file is useless otherwise).
  - `syncSeals` (start-up and every `notifyList`) seals or opens files whose lock changed; only those are written.
  - "Turn off" keeps the keys (old encrypted backups must stay openable) and only stops sealing (`crypt.off`).
    If encryption is off and both the PIN and recovery key are lost, deleting `"crypt"` and setting `"lock": null` in
    settings.json resets it; only backups made while it was on are then lost.
  - **Backups (1.1.31, the owner's wish):** copies in `backups/` of a note that is locked now, or was locked when that
    backup was made (its own lock or a locked group in that backup's `groups.json`), are sealed where they are
    (`sealBackups`): one full pass (`crypt.backupsSealed`, again after turning encryption back on), then only a note that
    just became locked (`backupsDone` in `syncSeals`). New backups are sealed by `diskForm` anyway.
  - **Setting up tries everything first (1.1.31, `makeKeys`)**: seal + open a test note, the key locked and opened again
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
  whose open window is unlocked (`win.revealed` and not `win.lockPending`, 1.1.14, the owner's wish): it shows in the
  list too (`openUnlocked: true`) until that window is closed or locked again. A note
  locked by its group can't remove the lock from inside the note ("Locked with its group").
- **Unlocked for now (1.1.47, the owner's wish):** `unlockedForNow` (`main/list-visibility.js`) holds the note and group ids
  unlocked from the list ("Unlock…") until CosmoNotes quits. **Memory only: never save it** (a restart must lock them
  again). The lock itself (`n.locked` / `g.locked`) stays, so the note stays sealed on disk. `openForNow(n)` is the check
  for "may show" (list, opening a window, `hideNewlyLocked` leaves it open). Locking, removing a lock, "Lock again" (list,
  note, Locked tab) take ids out. "Remove lock…" is the only way to remove a lock from the list.
- When a note becomes locked from outside (list right-click, locking its group, dragging it into a locked
  group), main sends `note:lock-now`. The window first saves what was typed, then hides. Never hide it
  directly from main, or the last keystrokes would be lost.
- **Recording while a note gets locked (1.2.4):** the window puts the chip in and saves before it hides (`relock`,
  `lockNow`); when it can't (already hidden), `rec:end` with `kept` makes main add the chip. The `.part` file of a
  locked note being recorded is plain until it is finished; then the note's next save seals it (or `sealLoose` after a crash).
- The renderer of a hidden locked note must never save: `changed()`/`saveNow()` return early when
  `hidden`, and main strips `html/text/firstImage` from patches. Keep both guards.
- List cards for locked notes get `text:''` and `firstImage:null` from main, so never send content to the list.

## Voice to text (1.3.1)

Speak to text and Transcribe. Files: `main/stt-engine.js` (engine window, protocol, session), `main/ipc-stt.js` (jobs,
Settings), `main/stt-models.js` (the list), `main/stt-download.js` (Best), `src/engine/` (the page), `src/note/speech.js`
(the note window's side), `src/mic-worklet.js`. Rules that aren't obvious from the code:
- **The engine** is one hidden window owned by main, made on first use and closed after 3 idle minutes (while no job
  runs). It is sandboxed, has its own small preload and its own in-memory session `cosmonotes-stt`: no permissions,
  `will-navigate` / `will-redirect` / new windows refused, and every request that is not `cosmomodel:`/`data:`/`blob:` is
  cancelled (so the engine can never reach the internet). `cosmomodel://engine/` serves a fixed list only (`route`):
  the page, `/engine.mjs`, `/engine-core.mjs`, `/test-clip.wav`, `/lib/<LIB_FILES>` and `/models/<id>/<file>` for the
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
- **The model of a job**: the one picked in Settings if installed, else Standard (`fallback: 'missing'`, the window says
  "This model isn't downloaded yet."). While a job runs, the next one uses the model already loaded. Best that fails to
  load (a graphics card problem) falls back to Standard (`fallback: 'failed'`, Settings shows it).
- **Live or after you stop**: `settings.sttTests['<model>/<set>']` from Test my computer (the whole bundled clip) or the
  quiet 2-second check the first time. Not `live` = the engine holds every piece's text until Stop (no drafts).
- **Speak to text and the recording**: it is the 1.2.4 recorder (`rec.stt`). Normal finish = `rec:end 'discard'` (the
  clip is deleted at once). Cancel or a failure = `rec:end 'save'` (a voice note where the text was). Closing / locking =
  `stopRecordingNow` → `sttAbortNow` first (the caret goes to the marker), then the 1.2.4 `kept` path.
- **Only main goes online**, and only on Download (Best, from huggingface.co at the fixed commit). The engine window
  can't. Standard comes with the installer (build.bat downloads it once).

## Spellcheck

- `app.commandLine.appendSwitch('disable-features','WinUseBrowserSpellChecker')` forces Chromium's Hunspell
  spellchecker so that with only `en-US` loaded, Cyrillic words are skipped. When spelling is first turned
  on, Electron downloads the dictionary once from Google's CDN. That and the Best voice model's download (1.3.1, only
  when you press Download) are the only network uses, and both are optional.
