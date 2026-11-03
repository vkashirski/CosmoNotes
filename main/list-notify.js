'use strict';
const { syncSeals } = require('./crypt');
const { S } = require('./state');

let notifyTimer = null;
function notifyList() {
  // 1.1.30: every change the list hears about may have locked or unlocked notes (a group's lock, a drag into a locked
  // group…): their files are sealed or opened right away (main/crypt.js; only notes whose state changed are written)
  try { syncSeals(); } catch (e) { console.error(e); }
  clearTimeout(notifyTimer);
  notifyTimer = setTimeout(() => {
    if (S.listWin && !S.listWin.isDestroyed()) S.listWin.webContents.send('notes:changed');
  }, 120);
}
module.exports = { notifyList };
