'use strict';
const { app } = require('electron');
const path = require('path');
const fs = require('fs');
const { OLD_DATA_DIR } = require('./constants');

// ---------- copy notes over from the old "Sticky Pins" folder (first run after the rename)
function migrateOldData() {
  try {
    const dir = app.getPath('userData');
    const oldDir = path.join(app.getPath('appData'), OLD_DATA_DIR);
    if (path.resolve(dir) === path.resolve(oldDir)) return;
    const has = (d) => fs.existsSync(path.join(d, 'notes')) || fs.existsSync(path.join(d, 'settings.json'));
    if (has(dir) || !has(oldDir)) return;
    fs.mkdirSync(dir, { recursive: true });
    for (const name of ['notes', 'attachments', 'backups', 'settings.json', 'groups.json']) {
      const src = path.join(oldDir, name);
      if (fs.existsSync(src)) fs.cpSync(src, path.join(dir, name), { recursive: true, force: false, errorOnExist: false });
    }
    fs.writeFileSync(path.join(oldDir, 'Notes were copied to CosmoNotes.txt'),
      `Your notes were copied to:\r\n${dir}\r\n\r\nThis old folder was left untouched as a safety copy. You can delete it once you're happy everything is in CosmoNotes.\r\n`);
  } catch (e) {
    console.error('migration failed', e);
  }
}
module.exports = { migrateOldData };
