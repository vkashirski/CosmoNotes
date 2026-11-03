'use strict';
const { ipcMain } = require('electron');
const { barKind, cleanInkSize, snapInk } = require('./ink-geometry');
const { placeInk, showInk } = require('./ink-window');
const { senderNote } = require('./ipc-common');

function registerInkIpc() {
  // 1.1.15: the drawing toolbar in its own window (see "drawing toolbar outside the note")
  // (1.1.16: also the text toolbar, with `bar: 'text'`)
  // put it at a remembered place ({ mode: 'dock', side, off } or { mode: 'free', x, y }) and show it
  ipcMain.on('ink:show', (e, s) => {
    const { win, note } = senderNote(e);
    if (!note || !s || typeof s !== 'object') return;
    const k = barKind(s.bar);
    const st = cleanInkSize(s);
    if (s.mode === 'dock' && ['left', 'right', 'top', 'bottom'].includes(s.side)) Object.assign(st, { mode: 'dock', side: s.side, off: Number(s.off) || 0 });
    else Object.assign(st, { mode: 'free', x: Number(s.x) || 0, y: Number(s.y) || 0 });
    win[`${k}State`] = st;
    win[`${k}Out`] = true;
    placeInk(win, k);
  });
  // dragging it: x, y = where its window would go, px, py = the mouse pointer (screen)
  ipcMain.on('ink:drag', (e, p) => {
    const { win, note } = senderNote(e);
    if (!note || !p || typeof p !== 'object') return;
    const k = barKind(p.bar);
    win[`${k}State`] = snapInk(win, p);
    win[`${k}Out`] = true;
    placeInk(win, k);
  });
  // its size changed (it's measured in the note)
  ipcMain.on('ink:size', (e, s) => {
    const { win, note } = senderNote(e);
    const k = barKind(s && s.bar);
    if (!note || !win[`${k}State`]) return;
    Object.assign(win[`${k}State`], cleanInkSize(s));
    if (win[`${k}Out`]) placeInk(win, k);
  });
  // let go: on the note → back inside it; anywhere else it stays (stuck to a side, or free)
  ipcMain.handle('ink:drop', (e, p = {}) => {
    const { win, note } = senderNote(e);
    if (!note) return null;
    const k = barKind(p && p.bar);
    const b = win.getBounds();
    const px = Number(p.px);
    const py = Number(p.py);
    if (px >= b.x && px <= b.x + b.width && py >= b.y && py <= b.y + b.height) {
      win[`${k}Out`] = false;
      showInk(win, false, k);
      return { inside: true, x: b.x, y: b.y };
    }
    const st = win[`${k}State`];
    if (!st) return null;
    return { inside: false, state: st.mode === 'dock' ? { mode: 'dock', side: st.side, off: st.off } : { mode: 'free', x: st.x, y: st.y } };
  });
  ipcMain.on('ink:hide', (e, bar) => {
    const { win, note } = senderNote(e);
    if (!note) return;
    const k = barKind(bar);
    win[`${k}Out`] = false;
    showInk(win, false, k);
  });
}

module.exports = { registerInkIpc };
