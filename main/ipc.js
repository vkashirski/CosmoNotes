'use strict';
const { registerNoteIpc } = require('./ipc-notes');
const { registerInkIpc } = require('./ipc-ink');
const { registerFileIpc } = require('./ipc-files');
const { registerGroupIpc } = require('./ipc-groups');
const { registerListActionIpc } = require('./ipc-list-actions');
const { registerSettingsIpc } = require('./ipc-settings');
const { registerCryptIpc } = require('./ipc-crypt');
const { registerSttIpc } = require('./ipc-stt');

function registerIpc() {
  registerNoteIpc();
  registerInkIpc();
  registerFileIpc();
  registerGroupIpc();
  registerListActionIpc();
  registerSettingsIpc();
  registerCryptIpc();
  registerSttIpc(); // 1.3.1: voice to text
}

module.exports = { registerIpc };
