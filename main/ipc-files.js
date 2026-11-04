'use strict';
const { BrowserWindow, ipcMain, shell, dialog } = require('electron');
const fs = require('fs');
const { ATT_EXT } = require('./constants');
const { openableCopy } = require('./crypt');
const { senderNote } = require('./ipc-common');
const { isLocked } = require('./locks');
const recordings = require('./recordings');
const { openExternal } = require('./web');
const { S } = require('./state');

function registerFileIpc() {
  ipcMain.handle('att:save', (e, bytes, ext) => {
    ext = String(ext || '').toLowerCase();
    if (!ATT_EXT.includes(ext)) throw new Error('Unsupported file type');
    const buf = Buffer.from(bytes);
    if (buf.length > 200 * 1024 * 1024) throw new Error('File too large');
    return S.store.saveAttachment(buf, ext);
  });
  // 1.2.4: a voice recording goes to disk while it is made (main/recordings.js)
  ipcMain.handle('rec:start', (e) => {
    const { win, note } = senderNote(e);
    if (!note || (isLocked(note) && !win.revealed)) return null;
    return recordings.start(note.id, win);
  });
  ipcMain.on('rec:chunk', (e, id, bytes) => {
    const { win } = senderNote(e);
    if (win) recordings.chunk(win, id, bytes);
  });
  ipcMain.handle('rec:end', (e, id, mode) => {
    const { win } = senderNote(e);
    return win ? recordings.end(win, id, ['save', 'discard', 'kept'].includes(mode) ? mode : 'kept') : null;
  });
  ipcMain.handle('rec:done', (e, id) => {
    const { note } = senderNote(e);
    return note ? recordings.done(note.id, id) : false;
  });
  ipcMain.handle('att:pick-images', async (e) => {
    const win = BrowserWindow.fromWebContents(e.sender);
    const r = await dialog.showOpenDialog(win, {
      title: 'Add photos',
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp'] }],
    });
    if (r.canceled) return [];
    const urls = [];
    for (const p of r.filePaths) {
      try { urls.push(S.store.importFile(p)); } catch (err) { console.error(err); }
    }
    return urls;
  });
  ipcMain.handle('att:open', (e, url) => {
    const p = S.store.attachmentPathFromUrl(url);
    if (!p || !fs.existsSync(p)) return;
    // 1.1.30: an encrypted photo or clip opens from a plain copy in a temp folder (nothing opens before the PIN)
    const q = openableCopy(p);
    if (q) shell.openPath(q);
  });
  ipcMain.handle('open-external', (e, url) => openExternal(url));
}

module.exports = { registerFileIpc };
