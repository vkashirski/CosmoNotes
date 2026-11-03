'use strict';
const { BrowserWindow, ipcMain, shell, dialog } = require('electron');
const fs = require('fs');
const { ATT_EXT } = require('./constants');
const { openableCopy } = require('./crypt');
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
