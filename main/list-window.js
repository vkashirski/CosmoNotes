'use strict';
const { BrowserWindow } = require('electron');
const path = require('path');
const { APP_NAME, PRELOAD, WIN_ICON } = require('./constants');
const { visibleOnSomeDisplay } = require('./display');
const { hardenContents } = require('./web');
const { listOpenGroups } = require('./list-visibility');
const { S } = require('./state');

// ------------------------------------------------------------------ list window
// colours of the list window's own title strip (window buttons) for each list theme (list.css)
const LIST_THEMES = {
  cream: ['#FBF6EC', '#6B5A3E'],
  rose: ['#FFF0F3', '#7A4A58'],
  mint: ['#EDF8F2', '#3F6B57'],
  sky: ['#EDF5FD', '#3F5D7A'],
  lilac: ['#F4F0FD', '#5A4B7E'],
  night: ['#25232A', '#D8D0C2'],
  midnight: ['#1D2232', '#C3C9D8'],
  forest: ['#1C2520', '#C2D0C5'],
  plum: ['#251D29', '#D2C3D5'],
};
const listTheme = () => LIST_THEMES[S.store.settings.listTheme] || LIST_THEMES.cream;
function paintListFrame() {
  if (!S.listWin || S.listWin.isDestroyed()) return;
  const [bg, fg] = listTheme();
  try {
    if (S.listWin.setBackgroundColor) S.listWin.setBackgroundColor(bg);
    if (S.listWin.setTitleBarOverlay) S.listWin.setTitleBarOverlay({ color: bg, symbolColor: fg, height: 44 });
  } catch { /* older Windows: the buttons just keep their colour */ }
}
function showList() {
  if (S.listWin && !S.listWin.isDestroyed()) {
    if (S.listWin.isMinimized()) S.listWin.restore();
    S.listWin.show();
    S.listWin.focus();
    return;
  }
  const saved = S.store.settings.listBounds;
  const b = saved && visibleOnSomeDisplay(saved) ? saved : { width: 420, height: 640 };
  S.listWin = new BrowserWindow({
    ...b,
    minWidth: 340,
    minHeight: 420,
    title: APP_NAME,
    icon: WIN_ICON,
    show: false,
    backgroundColor: listTheme()[0],
    titleBarStyle: 'hidden',
    titleBarOverlay: { color: listTheme()[0], symbolColor: listTheme()[1], height: 44 },
    webPreferences: { preload: PRELOAD, contextIsolation: true, nodeIntegration: false, sandbox: true, spellcheck: false },
  });
  hardenContents(S.listWin.webContents);
  S.listWin.once('ready-to-show', () => S.listWin.show());
  const remember = () => {
    if (!S.listWin || S.listWin.isDestroyed() || S.listWin.isMinimized() || S.listWin.isMaximized()) return;
    S.store.settings.listBounds = S.listWin.getBounds();
  };
  S.listWin.on('move', remember);
  S.listWin.on('resize', remember);
  S.listWin.on('close', () => { remember(); try { S.store.saveSettings(); } catch { /* ignore */ } });
  S.listWin.on('closed', () => { S.listWin = null; listOpenGroups.clear(); S.listUnlockedAll = false; });
  // the mouse's back / forward buttons (some mice send these as Windows commands): move between group levels
  S.listWin.on('app-command', (e, cmd) => {
    if (cmd !== 'browser-backward' && cmd !== 'browser-forward') return;
    if (S.listWin && !S.listWin.isDestroyed()) S.listWin.webContents.send('list:nav', cmd === 'browser-backward' ? 'back' : 'forward');
  });
  S.listWin.loadFile(path.join(__dirname, '..', 'src', 'list.html'));
}
module.exports = { LIST_THEMES, paintListFrame, showList };
