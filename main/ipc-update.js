'use strict';
// 1.4.0: updates, the app's side: Settings → About (update:*), the tray's "Update to …" (showUpdate), the check at start
// and once a day while settings.updateCheck is on (installed app only), and Install. The release feed, the download and
// starting the installer are main/updater.js.
// - Install waits for a voice recording or voice to text: asked while one runs, it says 'busy'; one that starts during
//   the download is waited for before the app quits.
// - Install quits like the tray's Quit (S.quitting, app.quit): windows save on unload, will-quit flushes, then
//   main.js calls finishUpdate, which starts the installer.
const { app, ipcMain, shell } = require('electron');
const updater = require('./updater');
const { showList } = require('./list-window');
const { isRecording } = require('./recordings');
const { sttBusy } = require('./ipc-stt');
const { S } = require('./state');

const FIRST = 30e3; // the check at start waits a little: the notes open first
const HOUR = 3600e3;
const DAY = 24 * HOUR;
let lastCheck = 0;
const autoOn = () => app.isPackaged && S.store.settings.updateCheck !== false;
// hourly, so a PC that slept still checks once a day
function tick() {
  if (!autoOn() || Date.now() - lastCheck < DAY - 60e3) return;
  lastCheck = Date.now();
  updater.check({ quiet: true });
}
const busy = () => isRecording() || sttBusy();

function notify(st) { if (S.listWin && !S.listWin.isDestroyed()) S.listWin.webContents.send('update:changed', st); }

// the list, at Settings → About
function showUpdate() {
  showList();
  const wc = S.listWin && !S.listWin.isDestroyed() ? S.listWin.webContents : null;
  if (!wc) return;
  if (wc.isLoading && wc.isLoading()) wc.once('did-finish-load', () => wc.send('update:show'));
  else wc.send('update:show');
}

function quitWhenFree() {
  if (busy()) { setTimeout(quitWhenFree, 2000); return; }
  S.quitting = true;
  app.quit();
}

function registerUpdateIpc() {
  ipcMain.handle('update:status', () => updater.status());
  ipcMain.handle('update:check', () => { lastCheck = Date.now(); return updater.check(); });
  ipcMain.handle('update:install', async () => {
    if (!app.isPackaged) return { ...updater.status(), error: 'notinstalled' }; // npm start: there is no install to update
    if (busy()) return { ...updater.status(), error: 'busy' };
    const st = await updater.download();
    if (st.state === 'installing') setImmediate(quitWhenFree);
    return st;
  });
  ipcMain.handle('update:cancel', () => updater.cancel());
  ipcMain.handle('update:open-page', () => shell.openExternal(updater.status().page));
}

function startUpdates() {
  updater.cleanup();
  updater.onChange(notify);
  // Windows refused to start the installer, and CosmoNotes opened again (main/updater.js finish)
  const failed = process.argv.find((a) => a.startsWith('--update-failed='));
  if (failed) { updater.startFailed(failed.slice('--update-failed='.length)); showUpdate(); }
  setTimeout(tick, FIRST);
  setInterval(tick, HOUR);
}

module.exports = { finishUpdate: updater.finish, registerUpdateIpc, showUpdate, startUpdates };
