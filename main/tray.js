'use strict';
const { app, Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const { APP_NAME, ASSETS } = require('./constants');
const { broadcastSettings } = require('./settings');
const { notifyList } = require('./list-notify');
const { bringToFront, createNote } = require('./note-window');
const { showList } = require('./list-window');
const { S } = require('./state');

let tray = null;
function setFxPaused(on) {
  S.store.settings.fxPaused = !!on;
  S.store.saveSettings();
  broadcastSettings();
  buildTray();
  notifyList();
}

// ------------------------------------------------------------------ tray & startup
function setStartup(enabled) {
  S.store.settings.startWithWindows = !!enabled;
  S.store.saveSettings();
  syncLoginItem();
  buildTray();
  notifyList();
}

function syncLoginItem() {
  if (!app.isPackaged || process.platform !== 'win32') return;
  app.setLoginItemSettings({ openAtLogin: !!S.store.settings.startWithWindows, args: ['--startup'] });
}

function buildTray() {
  if (!tray) {
    const img = nativeImage.createFromPath(path.join(ASSETS, process.platform === 'win32' ? 'tray.ico' : 'tray.png'));
    tray = new Tray(img);
    tray.setToolTip(APP_NAME);
    tray.on('click', showList);
  }
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'New note', click: () => createNote() },
    { label: 'All notes', click: showList },
    { label: 'Bring notes to front', click: () => bringToFront({ unroll: true }) },
    { type: 'separator' },
    { label: 'Pause effects', type: 'checkbox', checked: !!S.store.settings.fxPaused, click: (mi) => setFxPaused(mi.checked) }, // 1.1.16
    { label: 'Start with Windows', type: 'checkbox', checked: !!S.store.settings.startWithWindows, click: (mi) => setStartup(mi.checked) },
    { type: 'separator' },
    { label: `Quit ${APP_NAME}`, click: () => { S.quitting = true; app.quit(); } },
  ]));
}
module.exports = { buildTray, setStartup, syncLoginItem };
