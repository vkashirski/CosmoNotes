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
  update: (patch) => inv('note:update', patch),
  updateSync: (patch) => ipcRenderer.sendSync('note:update-sync', patch),
  newNote: () => inv('note:new'),
  duplicate: () => inv('note:duplicate'),
  close: () => inv('note:close'),
  trash: () => inv('note:trash'),
  hover: (over) => ipcRenderer.send('note:hover', !!over),
  saveAttachment: (bytes, ext) => inv('att:save', bytes, ext),
  pickImages: () => inv('att:pick-images'),
  openAttachment: (url) => inv('att:open', url),
  openExternal: (url) => inv('open-external', url),
  showList: () => inv('list:show'),

  // list window
  list: {
    get: () => inv('list:get'),
    newNote: (groupId) => inv('list:new', groupId || null),
    duplicate: (id) => inv('list:duplicate', id),
    openNote: (id) => inv('list:open-note', id),
    closeNote: (id) => inv('list:close-note', id),
    trash: (id) => inv('list:trash', id),
    restore: (id) => inv('list:restore', id),
    destroy: (id) => inv('list:destroy', id),
    emptyBin: () => inv('list:empty-bin'),
    bringToFront: () => inv('list:bring-front'),
    onChanged: (cb) => ipcRenderer.on('notes:changed', () => cb()),
    setLocked: (id, locked, pw) => inv('list:set-locked', id, !!locked, pw),
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
  },
  settings: { set: (patch) => inv('settings:set', patch) },
  backups: {
    list: () => inv('backups:list'),
    now: () => inv('backups:now'),
    restore: (name) => inv('backups:restore', name),
    openFolder: () => inv('backups:open-folder'),
  },
  openDataFolder: () => inv('data:open-folder'),
});
