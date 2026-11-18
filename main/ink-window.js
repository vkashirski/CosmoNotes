'use strict';
const { BAR_FRAMES, BAR_KINDS, SHOWS_ROLLED, barKind, inkSpot } = require('./ink-geometry');
const { hardenContents } = require('./web');
const { S } = require('./state');

let lifts = 0; // 1.4.18: counts opens and touches of the windows outside the notes (liftBars)

function watchInkBar(win) {
  win.webContents.on('did-create-window', (child, details) => {
    const k = BAR_FRAMES[details.frameName];
    if (!k || (win[`${k}Win`] && !win[`${k}Win`].isDestroyed())) { child.destroy(); return; }
    win[`${k}Win`] = child;
    child.liftedAt = ++lifts; // 1.4.18: the newest one opened is the newest touched (liftBars)
    hardenContents(child.webContents);
    try { child.setParentWindow(win); } catch { /* fine */ }
    const n = S.store.get(win.noteId);
    child.setAlwaysOnTop(!!(n && n.pinned) && !win.appBehind, 'screen-saver'); // (1.4.5: not while app pins put it behind)
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
  // (1.4.5: not while app pins hide the note: its moves while it fades out would bring the toolbar back)
  // (1.4.18: the » menu shows on a rolled-up note too: SHOWS_ROLLED)
  if (win[`${k}Out`] && !(n && n.rolled && !SHOWS_ROLLED.has(k)) && !win.isMinimized() && !win.appHidden && !c.isVisible()) c.showInactive();
}
// ------------------------------------------------------------------ which of a note's windows is on top (1.4.18)
// The window touched last is on top (the owner's wish). A note's windows outside it (toolbars, menus) always stay above
// their note (they are its children), but among themselves Windows never reorders them: most of them never take the
// focus (the keyboard stays in the note), and a window that doesn't take the focus doesn't come up when clicked. So each
// one keeps the time it was opened or touched last (c.liftedAt), and liftBars puts them on top in that order, the one
// touched now (kind) last, so on top. (touchNote, main/note-window.js, also brings the note itself up first.)
function liftBars(win, kind = null) {
  const k = kind && BAR_KINDS.includes(kind) ? kind : null;
  const c = k && win[`${k}Win`];
  if (c && !c.isDestroyed()) c.liftedAt = ++lifts;
  const up = BAR_KINDS.map((x) => win[`${x}Win`]).filter((w) => w && !w.isDestroyed() && w.isVisible());
  up.sort((a, b) => (a.liftedAt || 0) - (b.liftedAt || 0));
  for (const w of up) w.moveTop();
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
module.exports = { liftBars, placeInk, showInk, watchInkBar };
