'use strict';
// CosmoNotes voice to text (1.3.1): the engine window's only way out (main/stt-engine.js): messages to and from main.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('engineBridge', {
  send: (m) => ipcRenderer.send('engine:msg', m),
  onMessage: (cb) => { ipcRenderer.on('engine:msg', (e, m) => cb(m)); },
});
