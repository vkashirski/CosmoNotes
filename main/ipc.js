'use strict';
const { registerNoteIpc } = require('./ipc-notes');
const { registerInkIpc } = require('./ipc-ink');
const { registerFileIpc } = require('./ipc-files');
const { registerGroupIpc } = require('./ipc-groups');
const { registerListActionIpc } = require('./ipc-list-actions');
const { registerSettingsIpc } = require('./ipc-settings');
const { registerCryptIpc } = require('./ipc-crypt');
const { registerSttIpc } = require('./ipc-stt');
const { registerUpdateIpc } = require('./ipc-update');
const { registerRemindIpc } = require('./reminders');
const { registerTagIpc } = require('./ipc-tags');

function registerIpc() {
  registerNoteIpc();
  registerInkIpc();
  registerFileIpc();
  registerGroupIpc();
  registerListActionIpc();
  registerSettingsIpc();
  registerCryptIpc();
  registerSttIpc(); // 1.3.1: voice to text
  registerUpdateIpc(); // 1.4.0: updates
  registerRemindIpc(); // 1.4.1: reminders
  registerTagIpc(); // 1.4.30: every tag from any note
}

module.exports = { registerIpc };
