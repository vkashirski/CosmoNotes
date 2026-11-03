'use strict';
// 1.1.30: encryption of locked notes, from the notes list's Settings (main/crypt.js does the work).
const { BrowserWindow, dialog, ipcMain } = require('electron');
const fs = require('fs');
const crypt = require('./crypt');
const { checkPassword, wait } = require('./locks');
const { broadcastSettings } = require('./settings');
const { notifyList } = require('./list-notify');
const { showList } = require('./list-window');
const { S } = require('./state');

const WRONG = { error: 'wrong' };
function registerCryptIpc() {
  // A new recovery key was made (encryption was just set up, or the owner asked for a new key): the list must show it,
  // even when the PIN was typed in a note window.
  crypt.setPendingHandler(() => { showList(); notifyList(); });
  // 1.1.31: notes locked before the update stay unencrypted until the PIN is typed once, so the list opens at start
  // and asks for it (it also shows if setting up failed)
  const t = setTimeout(() => { try { if (!S.quitting && crypt.status().needPin) showList(); } catch (e) { console.error(e); } }, 1500);
  if (t.unref) t.unref();

  // the recovery key the list still has to show (null = none)
  ipcMain.handle('crypt:take-key', () => crypt.takePending());
  // the owner ticked "I have saved it"
  ipcMain.handle('crypt:key-saved', () => { crypt.keySaved(); notifyList(); return true; });
  // "Save to a file…" in the recovery key pop-up
  ipcMain.handle('crypt:save-key', async (e, code) => {
    code = String(code || '');
    if (!code || code !== crypt.takePending()) return false; // only the key on show, never anything else
    const win = e && e.sender ? BrowserWindow.fromWebContents(e.sender) : null;
    const r = await dialog.showSaveDialog(win, {
      title: 'Save your recovery key',
      defaultPath: 'CosmoNotes recovery key.txt',
      filters: [{ name: 'Text', extensions: ['txt'] }],
    });
    if (r.canceled || !r.filePath) return false;
    const text = [
      'CosmoNotes recovery key',
      '',
      code,
      '',
      'This opens your locked notes if you forget your PIN or password:',
      'Notes list > Settings > Locked notes > "Forgot it? Use the recovery key".',
      'Keep it safe, away from this computer.',
      `Made on ${new Date().toLocaleString()}.`,
      '',
    ].join('\r\n');
    fs.writeFileSync(r.filePath, text, 'utf8');
    return true;
  });
  // "Encrypt now" (before 1.1.30 nothing was encrypted: the first right PIN sets it up, see checkPassword)
  ipcMain.handle('crypt:start', async (e, pw) => {
    if (!S.store.settings.lock) return { error: 'no-password' };
    if (!(await checkPassword(pw))) { await wait(450); return WRONG; }
    if (crypt.isSetUp() && !crypt.cryptOn()) crypt.setOff(false); // it had been turned off: on again
    notifyList();
    return { ok: true };
  });
  // a new recovery key (the old one stops working)
  ipcMain.handle('crypt:new-key', async (e, pw) => {
    if (!crypt.isSetUp()) return { error: 'not-set-up' };
    if (!(await checkPassword(pw))) { await wait(450); return WRONG; }
    await crypt.newRecovery();
    notifyList();
    return { ok: true };
  });
  // forgot the PIN: the recovery key opens everything and a new PIN / password is set
  ipcMain.handle('crypt:recover', async (e, { code, next, kind } = {}) => {
    next = String(next || '');
    const pin = kind === 'pin';
    if (!crypt.isSetUp()) return { error: 'not-set-up' };
    if (pin && !/^\d{4,12}$/.test(next)) return { error: 'A PIN is 4 to 12 digits.' };
    if (next.length < 4) return { error: 'Use at least 4 characters or digits.' };
    if (crypt.cleanCode(code).length !== 25) return { error: 'A recovery key has 25 letters and digits.' };
    if (!(await crypt.unlockWithRecovery(code))) { await wait(450); return { error: 'That recovery key is not right.' }; }
    await crypt.changePw(next);
    S.store.settings.lockKind = pin ? 'pin' : 'password';
    S.store.settings.lockLen = pin ? next.length : 0;
    S.store.saveSettings();
    broadcastSettings();
    notifyList();
    return { ok: true };
  });
  // turn encryption off (notes are written in plain text again) or back on
  ipcMain.handle('crypt:set-off', async (e, pw, off) => {
    if (!crypt.isSetUp()) return { error: 'not-set-up' };
    if (!(await checkPassword(pw))) { await wait(450); return WRONG; }
    crypt.setOff(!!off);
    notifyList();
    return { ok: true };
  });
}

module.exports = { registerCryptIpc };
