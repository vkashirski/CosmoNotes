'use strict';
const { contextBridge, ipcRenderer } = require('electron');

const inv = (ch, ...args) => ipcRenderer.invoke(ch, ...args);

contextBridge.exposeInMainWorld('sticky', {
  // note window
  getNote: () => inv('note:get'),
  update: (patch) => inv('note:update', patch),
  updateSync: (patch) => ipcRenderer.sendSync('note:update-sync', patch),
  newNote: () => inv('note:new'),
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
    newNote: () => inv('list:new'),
    openNote: (id) => inv('list:open-note', id),
    closeNote: (id) => inv('list:close-note', id),
    trash: (id) => inv('list:trash', id),
    restore: (id) => inv('list:restore', id),
    destroy: (id) => inv('list:destroy', id),
    emptyBin: () => inv('list:empty-bin'),
    bringToFront: () => inv('list:bring-front'),
    onChanged: (cb) => ipcRenderer.on('notes:changed', () => cb()),
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
