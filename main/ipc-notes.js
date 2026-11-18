'use strict';
const { BrowserWindow, Menu, ipcMain } = require('electron');
const { checkPassword, hashPassword, isLocked, packLock, viewOf, wait } = require('./locks');
const crypt = require('./crypt');
const { broadcastSettings, lockInfo, noteSettings } = require('./settings');
const { notifyList } = require('./list-notify');
const { applyClickThrough, applyState, clickThroughNow, setWinTitle } = require('./note-state');
const { createNote, duplicateNote, unrollWin } = require('./note-window');
const { applyPatch, senderNote } = require('./ipc-common');
const { hiddenInList, knownTags, unlockedForNow } = require('./list-visibility');
const { openApps } = require('./app-pin');
const TAGS = require('../src/tags');
const { S } = require('./state');

function registerNoteIpc() {
  ipcMain.handle('note:get', (e) => {
    const { win, note } = senderNote(e);
    if (!note) return null;
    // 1.4.1: reminders that went off while this window was still loading play their sound now (main/reminders.js popUp)
    const ring = win.ringIds || [];
    win.ringIds = null;
    win.ringLoaded = true;
    return { ...viewOf(note, win), focusEditor: !!win.focusOnLoad, settings: noteSettings(), ring };
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
  // 1.4.10: the ⋯ menu's tags: added and removed one at a time (src/tags.js), like the list's (list:tags). Not from a
  // window its lock hides (its tags are secret); not an edit
  ipcMain.handle('note:tags', (e, change = {}) => {
    const { win, note } = senderNote(e);
    if (!note || (isLocked(note) && !win.revealed) || !change || typeof change !== 'object') return null;
    const add = TAGS.cleanAll([].concat(change.add || []));
    const remove = TAGS.cleanAll([].concat(change.remove || []));
    S.store.update(note.id, { tags: TAGS.cleanAll([...note.tags.filter((t) => !remove.includes(t)), ...add]) });
    notifyList();
    return S.store.get(note.id).tags;
  });
  ipcMain.handle('note:tags-known', () => knownTags());
  ipcMain.handle('note:dates', (e) => {
    const { note } = senderNote(e);
    return note ? { createdAt: note.createdAt, updatedAt: note.updatedAt } : null;
  });
  ipcMain.on('note:update-sync', (e, patch) => {
    try { applyPatch(e, patch); const { note } = senderNote(e); if (note) S.store.writeNow(note.id); } catch (err) { console.error(err); }
    e.returnValue = true;
  });
  // 1.3.28: a note its lock hides (in its window, or in the list) can't be copied: unlock it first
  ipcMain.handle('note:duplicate', (e) => { const { win, note } = senderNote(e); return note && (win.revealed || !isLocked(note)) ? duplicateNote(note.id) : null; });
  ipcMain.handle('list:duplicate', (e, id) => { const n = S.store.get(String(id)); return n && !hiddenInList(n) ? duplicateNote(n.id) : null; });
  ipcMain.handle('note:new', (e) => createNote({ near: BrowserWindow.fromWebContents(e.sender) })); // 1.4.6: settles once it shows
  ipcMain.handle('note:close', (e) => {
    const { win, note } = senderNote(e);
    if (!note) return;
    note.open = false;
    S.store.writeNow(note.id);
    win.byHand = true; // 1.3.30: Ctrl+Shift+T / the tray can bring it back (note-window.js 'closed')
    win.close();
  });
  // 1.4.5: the pin's right-click list: the apps open now, A to Z, with their workspaces / files (main/app-pin.js). Only
  // window titles, nothing of a note: a hidden locked note may ask too (pinApps is in WHILE_HIDDEN)
  ipcMain.handle('pin:apps', (e) => (senderNote(e).note ? openApps() : null));
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
    win.setOpacity(over && note.solidOnHover && !clickThroughNow(note) ? 1 : note.opacity); // 1.3.34: click-through stays see-through
  });
  // 1.3.34: the mouse is on the click-through button (true) or left it (false): its window takes clicks only meanwhile
  ipcMain.on('note:ct-awake', (e, awake) => {
    const { win, note } = senderNote(e);
    if (!note || win.isDestroyed()) return;
    win.ctAwake = !!awake;
    applyClickThrough(win, note);
  });
  // 1.4.11: right-click in the text → Add ▸: the note sends its Add panel's items once, kept on its window (main/web.js
  // shows them, only while the note's words show: noteWindow's addItems)
  ipcMain.on('note:add-items', (e, list) => {
    const { win } = senderNote(e);
    if (win && !win.isDestroyed()) win.addItems = menuItems(list, 'act');
  });
  // 1.4.11: a small note's » button (src/note/top-bar.js): the buttons that didn't fit, in a real menu (it shows outside the
  // window, so it works on the smallest and on a rolled-up note); the line picked goes back and its button does it
  ipcMain.on('note:bar-menu', (e, items, x, y) => {
    const { win, note } = senderNote(e);
    if (!note || win.isDestroyed()) return;
    const list = menuItems(items, 'id');
    if (!list.length) return;
    Menu.buildFromTemplate(list.map((it) => ({
      label: it.label,
      ...(typeof it.checked === 'boolean' ? { type: 'checkbox', checked: it.checked } : {}),
      click: () => { if (!win.isDestroyed()) win.webContents.send('note:bar-act', it.id); },
    }))).popup({ window: win, x: Math.max(0, Math.round(Number(x) || 0)), y: Math.max(0, Math.round(Number(y) || 0)) });
  });
}

// a menu's lines from a window: [{ <key>: a short name, label, checked? }], at most 20
function menuItems(list, key) {
  if (!Array.isArray(list)) return [];
  return list.slice(0, 20).filter((it) => it && /^[A-Za-z]{1,20}$/.test(it[key]) && typeof it.label === 'string' && it.label.trim())
    .map((it) => ({ [key]: it[key], label: it.label.trim().slice(0, 60), ...(typeof it.checked === 'boolean' ? { checked: it.checked } : {}) }));
}

module.exports = { registerNoteIpc };
