'use strict';
const { BrowserWindow, clipboard, ipcMain, nativeImage, net, shell, dialog } = require('electron');
const fs = require('fs');
const { ATT_EXT } = require('./constants');
const { attachmentBytes, mimeOf, openableCopy } = require('./crypt');
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
  // 1.4.3: right-click a photo → Copy image. The note's page (file://) can't read its own photo: stickyfile:// and web
  // pictures are other origins, so fetch() fails and a canvas they are drawn on can't be read. Main reads the picture
  // (att:image), the note turns it into a PNG (any format), and main puts that on the clipboard (clip:image; Electron's
  // clipboard needs no focus or permission). Nothing goes to a hidden locked note's window.
  ipcMain.handle('att:image', async (e, url) => {
    const { win, note } = senderNote(e);
    if (!note || (isLocked(note) && !win.revealed) || typeof url !== 'string') return null;
    const p = S.store.attachmentPathFromUrl(url);
    if (p) {
      if (!mimeOf(p).startsWith('image/') || !fs.existsSync(p)) return null;
      const sealed = attachmentBytes(p); // an encrypted photo: its plain bytes once the PIN was typed, false before
      if (sealed === false) return null;
      return sealed || fs.readFileSync(p);
    }
    if (!/^https?:\/\//i.test(url)) return null; // a picture pasted from a web page keeps its web address
    try {
      const r = await net.fetch(url);
      if (!r.ok) return null;
      const buf = Buffer.from(await r.arrayBuffer());
      return buf.length && buf.length <= PIC_MAX ? buf : null;
    } catch { return null; }
  });
  ipcMain.handle('clip:image', (e, png) => {
    if (!(png instanceof Uint8Array) || !png.length || png.length > PIC_MAX) return false;
    const img = nativeImage.createFromBuffer(Buffer.from(png));
    if (img.isEmpty()) return false;
    clipboard.writeImage(img);
    return true;
  });
}
const PIC_MAX = 200 * 1024 * 1024;

module.exports = { registerFileIpc };
