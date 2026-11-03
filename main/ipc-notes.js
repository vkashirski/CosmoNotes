'use strict';
const { BrowserWindow, ipcMain } = require('electron');
const { checkPassword, hashPassword, isLocked, packLock, viewOf, wait } = require('./locks');
const crypt = require('./crypt');
const { broadcastSettings, lockInfo, noteSettings } = require('./settings');
const { notifyList } = require('./list-notify');
const { applyState, setWinTitle } = require('./note-state');
const { createNote, duplicateNote, unrollWin } = require('./note-window');
const { applyPatch, senderNote } = require('./ipc-common');
const { unlockedForNow } = require('./list-visibility');
const { S } = require('./state');

function registerNoteIpc() {
  ipcMain.handle('note:get', (e) => {
    const { win, note } = senderNote(e);
    if (!note) return null;
    return { ...viewOf(note, win), focusEditor: !!win.focusOnLoad, settings: noteSettings() };
  });
  ipcMain.handle('note:unlock', async (e, pw) => {
    const { win, note } = senderNote(e);
    if (!note) return null;
    if (!isLocked(note)) return viewOf(note, win);
    if (!(await checkPassword(pw))) { await wait(450); return null; }
    win.revealed = true;
    win.lockPending = false;
    setWinTitle(win, note);
    notifyList(); // the list shows it unlocked too, while it's open
    return viewOf(note, win);
  });
  ipcMain.handle('note:relock', (e) => {
    const { win, note } = senderNote(e);
    if (!note) return null;
    unlockedForNow.delete(note.id); // 1.1.47: "Lock again" in the note also ends "unlocked for now"
    win.revealed = false;
    win.lockPending = false;
    setWinTitle(win, note);
    notifyList();
    return viewOf(note, win);
  });
  ipcMain.handle('note:set-locked', (e, locked) => {
    const { win, note } = senderNote(e);
    if (!note) return null;
    if (locked) {
      if (!S.store.settings.lock) return { error: 'no-password' };
      note.locked = true;
      unlockedForNow.delete(note.id);
      win.revealed = false;
    } else {
      if (isLocked(note) && !win.revealed) return { error: 'hidden' };
      note.locked = false;
      unlockedForNow.delete(note.id);
    }
    S.store.writeNow(note.id);
    applyState(win, note);
    notifyList();
    return viewOf(note, win);
  });
  ipcMain.handle('lock:set', async (e, { current, next, kind } = {}) => {
    next = String(next || '');
    const pin = kind === 'pin';
    if (pin && !/^\d{4,12}$/.test(next)) return { error: 'A PIN is 4 to 12 digits.' };
    if (next.length < 4) return { error: 'Use at least 4 characters or digits.' };
    if (S.store.settings.lock && !(await checkPassword(current))) { await wait(450); return { error: `The current ${lockInfo().lockKind === 'pin' ? 'PIN' : 'password'} is not right.` }; }
    // 1.1.30: the very first PIN sets up encryption (and the list shows the recovery key); later ones re-lock the key
    if (crypt.isSetUp()) await crypt.changePw(next);
    // 1.1.31: if encryption can't be set up on this PC, the PIN still works as before (a privacy screen) and the list says why
    else if (!(await crypt.setUp(next))) S.store.settings.lock = packLock(hashPassword(next));
    S.store.settings.lockKind = pin ? 'pin' : 'password';
    S.store.settings.lockLen = pin ? next.length : 0;
    S.store.saveSettings();
    broadcastSettings();
    notifyList();
    return { ok: true };
  });
  ipcMain.handle('note:update', (e, patch) => applyPatch(e, patch));
  ipcMain.handle('note:dates', (e) => {
    const { note } = senderNote(e);
    return note ? { createdAt: note.createdAt, updatedAt: note.updatedAt } : null;
  });
  ipcMain.on('note:update-sync', (e, patch) => {
    try { applyPatch(e, patch); const { note } = senderNote(e); if (note) S.store.writeNow(note.id); } catch (err) { console.error(err); }
    e.returnValue = true;
  });
  ipcMain.handle('note:duplicate', (e) => { const { note } = senderNote(e); return note ? duplicateNote(note.id) : null; });
  ipcMain.handle('list:duplicate', (e, id) => duplicateNote(String(id)));
  ipcMain.handle('note:new', (e) => { createNote({ near: BrowserWindow.fromWebContents(e.sender) }); });
  ipcMain.handle('note:close', (e) => {
    const { win, note } = senderNote(e);
    if (!note) return;
    note.open = false;
    S.store.writeNow(note.id);
    win.close();
  });
  // 1.1.13: the note's own minimise and maximise buttons
  ipcMain.handle('note:minimize', (e) => {
    const { win } = senderNote(e);
    if (!win || win.isDestroyed()) return;
    win.userMin = true; // even a pinned note stays minimised until you bring it back
    win.setMinimizable(true);
    win.minimize();
  });
  ipcMain.handle('note:maximize', (e) => {
    const { win, note } = senderNote(e);
    if (!win || win.isDestroyed() || !note) return false;
    if (win.isMaximized()) { win.unmaximize(); return false; }
    if (note.rolled) unrollWin(win, note);
    win.maximize();
    return true;
  });
  ipcMain.handle('note:trash', (e) => {
    const { win, note } = senderNote(e);
    if (!note) return;
    if (isLocked(note)) return { error: 'locked' };
    S.store.trash(note.id);
    win.close();
    notifyList();
  });
  ipcMain.on('note:hover', (e, over) => {
    const { win, note } = senderNote(e);
    if (!note || win.isDestroyed()) return;
    win.setOpacity(over && note.solidOnHover ? 1 : note.opacity);
  });
}

module.exports = { registerNoteIpc };
