'use strict';
const { BAR_FRAMES, BAR_KINDS, barKind, inkSpot } = require('./ink-geometry');
const { hardenContents } = require('./web');
const { S } = require('./state');

function watchInkBar(win) {
  win.webContents.on('did-create-window', (child, details) => {
    const k = BAR_FRAMES[details.frameName];
    if (!k || (win[`${k}Win`] && !win[`${k}Win`].isDestroyed())) { child.destroy(); return; }
    win[`${k}Win`] = child;
    hardenContents(child.webContents);
    try { child.setParentWindow(win); } catch { /* fine */ }
    const n = S.store.get(win.noteId);
    child.setAlwaysOnTop(!!(n && n.pinned), 'screen-saver');
    child.on('closed', () => { if (win[`${k}Win`] === child) { win[`${k}Win`] = null; win[`${k}Out`] = false; } });
    if (win[`${k}Out`]) placeInk(win, k);
    // 1.1.23: making this window could take the focus (and with it the note's text selection) from the note: give it back
    if (win.isFocused()) setTimeout(() => { if (!win.isDestroyed()) win.webContents.focus(); }, 0);
  });
  const follow = () => { for (const k of BAR_KINDS) if (win[`${k}Out`] && win[`${k}State`] && win[`${k}State`].mode === 'dock') placeInk(win, k); };
  win.on('move', follow);
  win.on('resize', follow);
}
function placeInk(win, kind = 'ink') {
  const k = barKind(kind);
  const c = win[`${k}Win`];
  if (!c || c.isDestroyed() || !win[`${k}State`] || win.isDestroyed()) return;
  c.setBounds(inkSpot(win, k));
  const n = S.store.get(win.noteId);
  if (win[`${k}Out`] && !(n && n.rolled) && !win.isMinimized() && !c.isVisible()) c.showInactive();
}
// kind left out: both toolbars
function showInk(win, on, kind = null) {
  for (const k of kind ? [barKind(kind)] : BAR_KINDS) {
    const c = win[`${k}Win`];
    if (!c || c.isDestroyed()) continue;
    if (on && win[`${k}Out`]) placeInk(win, k);
    else if (!on) c.hide();
  }
}
module.exports = { placeInk, showInk, watchInkBar };
