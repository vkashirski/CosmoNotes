'use strict';
const { registerNoteIpc } = require('./ipc-notes');
const { registerInkIpc } = require('./ipc-ink');
const { registerFileIpc } = require('./ipc-files');
const { registerGroupIpc } = require('./ipc-groups');
const { registerListActionIpc } = require('./ipc-list-actions');
const { registerSettingsIpc } = require('./ipc-settings');
const { registerCryptIpc } = require('./ipc-crypt');

function registerIpc() {
  registerNoteIpc();
  registerInkIpc();
  registerFileIpc();
  registerGroupIpc();
  registerListActionIpc();
  registerSettingsIpc();
  registerCryptIpc();
}

module.exports = { registerIpc };
