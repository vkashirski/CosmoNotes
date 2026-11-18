'use strict';
const { contextBridge, ipcRenderer } = require('electron');

const inv = (ch, ...args) => ipcRenderer.invoke(ch, ...args);

contextBridge.exposeInMainWorld('sticky', {
  // note window
  getNote: () => inv('note:get'),
  getDates: () => inv('note:dates'),
  unlock: (pw) => inv('note:unlock', pw),
  relock: () => inv('note:relock'),
  setLocked: (locked) => inv('note:set-locked', !!locked),
  setPassword: (current, next, kind) => inv('lock:set', { current, next, kind }),
  onSettings: (cb) => ipcRenderer.on('settings:changed', (e, s) => cb(s)),
  onLook: (cb) => ipcRenderer.on('note:look', (e, v) => cb(v)),
  onLockNow: (cb) => ipcRenderer.on('note:lock-now', () => cb()),
  onEvening: (cb) => ipcRenderer.on('note:evening', (e, p) => cb(p)), // 1.3.27: how far into the evening it is (0 – 1)
  panic: () => inv('panic:now'), // 1.3.27: the panic button in the top bar
  update: (patch) => inv('note:update', patch),
  tags: (change) => inv('note:tags', change), // 1.4.10: { add: [...], remove: [...] } from the ⋯ menu
  tagsKnown: () => inv('note:tags-known'), // every tag in use, for its suggestions
  updateSync: (patch) => ipcRenderer.sendSync('note:update-sync', patch),
  newNote: () => inv('note:new'),
  duplicate: () => inv('note:duplicate'),
  close: () => inv('note:close'),
  trash: () => inv('note:trash'),
  minimize: () => inv('note:minimize'),
  maximize: () => inv('note:maximize'),
  onWinState: (cb) => ipcRenderer.on('note:win-state', (e, s) => cb(s)),
  hover: (over) => ipcRenderer.send('note:hover', !!over),
  ctAwake: (on) => ipcRenderer.send('note:ct-awake', !!on), // 1.3.34: the mouse is on the click-through button
  pinApps: () => inv('pin:apps'), // 1.4.5: the pin's right-click list: the apps open now (main/app-pin.js)
  // 1.4.11: right-click in the text → Add ▸ (main/web.js): the Add panel's items, once; main sends the one picked
  addItems: (list) => ipcRenderer.send('note:add-items', list),
  onAdd: (cb) => ipcRenderer.on('note:add', (e, act) => cb(act)),
  // 1.4.18: this window was pressed (a note: part = its toolbar or menu outside it, '' = the note; the list too): main
  // brings it up, on top of the others (main/ipc-notes.js win:touch)
  touch: (part = '') => ipcRenderer.send('win:touch', String(part || '')),
  // 1.4.18: the text's right-click menu, shown by the note in the app's look (main/web.js): its lines come, the one picked goes back
  onCtx: (cb) => ipcRenderer.on('note:ctx', (e, m) => cb(m)),
  ctxAct: (id) => ipcRenderer.send('note:ctx-act', String(id)),
  saveAttachment: (bytes, ext) => inv('att:save', bytes, ext),
  // 1.2.4: a voice recording is written to disk while it is made
  recStart: () => inv('rec:start'),
  recChunk: (id, bytes) => ipcRenderer.send('rec:chunk', id, bytes),
  recEnd: (id, mode) => inv('rec:end', id, mode),
  recDone: (id) => inv('rec:done', id),
  // 1.3.1: voice to text (main/ipc-stt.js). Speak to text: start, audio (16 kHz pieces), stop / cancel; Transcribe a clip
  sttStart: () => inv('stt:start'),
  sttAudio: (id, pcm, rms) => ipcRenderer.send('stt:audio', id, pcm, rms),
  sttStop: (id) => inv('stt:stop', id),
  sttCancel: (id) => inv('stt:cancel', id),
  sttTranscribe: (url, id) => inv('stt:transcribe', url, id),
  onStt: (cb) => ipcRenderer.on('stt:event', (e, m) => cb(m)),
  pickImages: () => inv('att:pick-images'),
  openAttachment: (url) => inv('att:open', url),
  photoBytes: (url) => inv('att:image', url), // 1.4.3: Copy image (main/ipc-files.js)
  copyImage: (png) => inv('clip:image', png),
  openExternal: (url) => inv('open-external', url),
  showList: () => inv('list:show'),
  // 1.4.1: reminders (main/reminders.js): save this note's, Snooze / Done one that rings, and hear when one goes off
  remindSet: (list, msgs) => inv('remind:set', list, msgs),
  remindAct: (id, what, mins) => inv('remind:act', id, what, mins),
  onRemindRing: (cb) => ipcRenderer.on('remind:ring', (e, ids) => cb(ids)),
  // 1.1.15: the drawing toolbar in its own little window, outside the note
  ink: {
    show: (s) => ipcRenderer.send('ink:show', s),
    drag: (p) => ipcRenderer.send('ink:drag', p),
    size: (s) => ipcRenderer.send('ink:size', s),
    drop: (p) => inv('ink:drop', p),
    hide: (bar) => ipcRenderer.send('ink:hide', bar), // bar: 'text' for the text toolbar (1.1.16)
  },

  // list window
  list: {
    get: () => inv('list:get'),
    newNote: (groupId) => inv('list:new', groupId || null),
    duplicate: (id) => inv('list:duplicate', id),
    openNote: (id) => inv('list:open-note', id),
    closeNote: (id) => inv('list:close-note', id),
    clickThroughOff: (id) => inv('list:click-through-off', id), // 1.3.34
    reopenClosed: () => inv('list:reopen-closed'), // 1.3.30: Ctrl+Shift+T
    trash: (id) => inv('list:trash', id),
    restore: (id) => inv('list:restore', id),
    destroy: (id) => inv('list:destroy', id),
    emptyBin: () => inv('list:empty-bin'),
    bringToFront: () => inv('list:bring-front'),
    onChanged: (cb) => ipcRenderer.on('notes:changed', () => cb()),
    onNav: (cb) => ipcRenderer.on('list:nav', (e, dir) => cb(dir)), // mouse back / forward buttons
    onEvening: (cb) => ipcRenderer.on('list:evening', (e, p) => cb(p)), // 1.3.27: evening colours on the cards
    setLocked: (id, locked, pw) => inv('list:set-locked', id, !!locked, pw),
    favorite: (ids, on) => inv('list:favorite', ids, !!on),
    tags: (ids, change) => inv('list:tags', ids, change), // 1.4.10: { add: [...], remove: [...] } on notes and groups
    apply: (ids, patch) => inv('list:apply', ids, patch),
    edit: (id, patch) => inv('list:edit', id, patch), // 1.1.15: title / colour from the Edit sheet
    unlockAll: (pw) => inv('list:unlock-all', pw), // 1.1.15: the Locked tab
    lockAll: () => inv('list:lock-all'),
    unlockNow: (id, pw) => inv('list:unlock-now', id, pw), // 1.1.47: right-click → Unlock (until CosmoNotes quits)
    relock: (id) => inv('list:relock', id), // ... and Lock again
    remindGet: (id) => inv('list:remind-get', id), // 1.4.1: a note's reminders, with their messages
    remindSet: (id, list, msgs) => inv('list:remind-set', id, list, msgs),
  },
  groups: {
    make: (dragId, targetId) => inv('groups:make', dragId, targetId),
    ungroup: (noteId) => inv('groups:ungroup', noteId),
    dissolve: (groupId) => inv('groups:dissolve', groupId),
    rename: (groupId, name) => inv('groups:rename', groupId, name),
    update: (groupId, patch) => inv('groups:update', groupId, patch),
    apply: (groupId, patch, includeInner) => inv('groups:apply', groupId, patch, !!includeInner),
    moveUp: (id) => inv('groups:move-up', id),
    moveTo: (id, groupId) => inv('groups:move-to', id, groupId),
    trash: (groupId) => inv('groups:trash', groupId),
    setLocked: (groupId, locked, pw) => inv('groups:set-locked', groupId, !!locked, pw),
    reveal: (groupId, pw) => inv('groups:reveal', groupId, pw),
    hide: (groupId) => inv('groups:hide', groupId),
    makeFrom: (ids, parentId) => inv('groups:make-from', ids, parentId || null),
    // 1.4.9: several at once (one Undo step), the look of several groups, and Undo / Redo of moves
    moveMany: (ids, groupId, how) => inv('groups:move-many', ids, groupId || null, how),
    copyMany: (ids, groupId) => inv('groups:copy-many', ids, groupId || null),
    updateMany: (ids, patch) => inv('groups:update-many', ids, patch),
    undo: () => inv('groups:undo'),
    redo: () => inv('groups:redo'),
  },
  settings: {
    set: (patch) => inv('settings:set', patch),
    reapply: (keys) => inv('settings:reapply', keys), // 1.3.27: Use on all notes / Reset notes…
    capturePanicKey: (on) => inv('panic:capture', !!on), // 1.3.27: while a new panic shortcut is being pressed
  },
  // 1.1.30: encryption of locked notes (Settings → Locked notes)
  crypt: {
    takeKey: () => inv('crypt:take-key'),
    keySaved: () => inv('crypt:key-saved'),
    saveKey: (code) => inv('crypt:save-key', code),
    start: (pw) => inv('crypt:start', pw),
    newKey: (pw) => inv('crypt:new-key', pw),
    recover: (code, next, kind) => inv('crypt:recover', { code, next, kind }),
    setOff: (pw, off) => inv('crypt:set-off', pw, !!off),
  },
  backups: {
    list: () => inv('backups:list'),
    now: () => inv('backups:now'),
    restore: (name) => inv('backups:restore', name),
    openFolder: () => inv('backups:open-folder'),
  },
  openDataFolder: () => inv('data:open-folder'),
  // 1.3.1: Settings → Voice to text
  stt: {
    status: () => inv('stt:status'),
    when: (v) => inv('stt:when', v),
    download: (id) => inv('stt:download', id),
    cancelDownload: (id) => inv('stt:download-cancel', id),
    remove: (id) => inv('stt:remove', id),
    onChanged: (cb) => ipcRenderer.on('stt:changed', (e, s) => cb(s)),
  },
  // 1.4.0: Settings → About → updates (main/ipc-update.js). 1.4.1: `updates`, not `update`: that name is the note
  // window's save (above), and the second one in this object replaced it
  updates: {
    status: () => inv('update:status'),
    check: () => inv('update:check'),
    install: () => inv('update:install'),
    cancel: () => inv('update:cancel'),
    openPage: () => inv('update:open-page'),
    onChanged: (cb) => ipcRenderer.on('update:changed', (e, s) => cb(s)),
    onShow: (cb) => ipcRenderer.on('update:show', () => cb()),
  },
});
