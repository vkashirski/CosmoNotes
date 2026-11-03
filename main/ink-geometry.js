'use strict';
const { screen } = require('electron');
const { S } = require('./state');

// ------------------------------------------------------------------ drawing toolbar outside the note (1.1.15)
// Dragged past the note's edge, the drawing toolbar moves into a small see-through window of its own (the note
// opens it with window.open('about:blank') and moves the very same toolbar into it, so every button keeps
// working: note.js "inkOut"). Here we place that window. Close to one of the note's sides it sticks to that
// side (and follows the note when it moves or changes size); further away it stays where it was dropped.
// Dropped back on the note, it goes back inside. win.inkWin = that window, win.inkOut = the toolbar is in it,
// win.inkState = { mode: 'dock', side, off } | { mode: 'free', x, y }, plus its size w, h and inset (where the
// visible toolbar starts inside its window: l, t, r, b).
// 1.1.16: the text toolbar does the same, in a window of its own: win.textWin, win.textOut, win.textState. Every
// function and message below takes the toolbar's kind, 'ink' (the default) or 'text' (messages: `bar: 'text'`).
// The ⋯ menu ('menu') and the Effects pop-up ('fx') can go outside too (1.1.16, same rules).
const BAR_FRAMES = { cosmoInkBar: 'ink', cosmoTextBar: 'text', cosmoMenuBar: 'menu', cosmoFxBar: 'fx' };
const BAR_KINDS = ['ink', 'text', 'menu', 'fx'];
const BAR_TITLES = { ink: 'Drawing', text: 'Text', menu: 'Note settings', fx: 'Effects' };
const barKind = (k) => (BAR_KINDS.includes(k) ? k : 'ink');
const INK_GAP = 4; // px between the note and a toolbar stuck to it
const INK_SNAP = 12; // px: this close to a side, it sticks (1.1.20: was 40, it grabbed toolbars and menus from too far away)
const INK_TOUCH = 16; // px: a stuck toolbar always overlaps its side by at least this much (1.1.16)
function inkBarOptions(win, kind = 'ink') {
  const n = S.store.get(win.noteId);
  return {
    width: 320, height: 200, show: false,
    frame: false, transparent: true, backgroundColor: '#00000000', hasShadow: false,
    resizable: false, minimizable: false, maximizable: false, fullscreenable: false,
    skipTaskbar: true, focusable: kind === 'menu', // clicking it never takes the focus from the note (the menu: its title field needs the keyboard)
    alwaysOnTop: !!(n && n.pinned),
    parent: win, // stays above its note, and goes with it when the note is minimised or closed
    title: BAR_TITLES[barKind(kind)],
  };
}
const clampN = (v, a, b) => Math.min(Math.max(v, a), Math.max(a, b));
function cleanInkSize(s) {
  const num = (v, d) => (Number.isFinite(Number(v)) ? Number(v) : d);
  const inset = s && s.inset ? s.inset : {};
  return {
    w: clampN(Math.round(num(s && s.w, 320)), 80, 1200), h: clampN(Math.round(num(s && s.h, 200)), 40, 1200),
    inset: { l: num(inset.l, 0), t: num(inset.t, 0), r: num(inset.r, 0), b: num(inset.b, 0) },
  };
}
// the visible toolbar's box when its window is at x, y
function inkBox(x, y, st) {
  return { x: x + st.inset.l, y: y + st.inset.t, w: st.w - st.inset.l - st.inset.r, h: st.h - st.inset.t - st.inset.b };
}
// where the toolbar's window goes now
function inkSpot(win, kind = 'ink') {
  const st = win[`${barKind(kind)}State`];
  const b = win.getBounds();
  const v = inkBox(0, 0, st);
  let vx;
  let vy;
  if (st.mode === 'dock') {
    // 1.1.16: stuck to a side, it can slide past the note's corners (it used to stop at the top/bottom or left/right
    // edge); it only has to keep touching the side by INK_TOUCH px. Dragged further, it comes loose (snapInk).
    const offY = clampN(st.off, INK_TOUCH - v.h, b.height - INK_TOUCH);
    const offX = clampN(st.off, INK_TOUCH - v.w, b.width - INK_TOUCH);
    if (st.side === 'right') { vx = b.x + b.width + INK_GAP; vy = b.y + offY; }
    else if (st.side === 'left') { vx = b.x - INK_GAP - v.w; vy = b.y + offY; }
    else if (st.side === 'top') { vx = b.x + offX; vy = b.y - INK_GAP - v.h; }
    else { vx = b.x + offX; vy = b.y + b.height + INK_GAP; }
  } else {
    vx = st.x + st.inset.l;
    vy = st.y + st.inset.t;
  }
  // always on a screen (a note maximised or at the screen's edge: the toolbar comes over the note instead)
  const a = screen.getDisplayNearestPoint({ x: Math.round(vx + v.w / 2), y: Math.round(vy + v.h / 2) }).workArea;
  vx = clampN(vx, a.x, a.x + a.width - v.w);
  vy = clampN(vy, a.y, a.y + a.height - v.h);
  return { x: Math.round(vx - st.inset.l), y: Math.round(vy - st.inset.t), width: st.w, height: st.h };
}
// while dragging: stick to a side when close to it
function snapInk(win, p) {
  const st = { ...cleanInkSize(p) };
  const b = win.getBounds();
  const x = Number(p.x) || 0;
  const y = Number(p.y) || 0;
  const px = Number(p.px);
  const py = Number(p.py);
  const overNote = px >= b.x && px <= b.x + b.width && py >= b.y && py <= b.y + b.height;
  const v = inkBox(x, y, st);
  const cands = [];
  if (!overNote) {
    const overlapY = v.y < b.y + b.height && v.y + v.h > b.y;
    const overlapX = v.x < b.x + b.width && v.x + v.w > b.x;
    const near = (d) => d > -INK_SNAP && d < INK_SNAP; // 1.1.22: only when the edges are within a few px of each other (was: could overlap the note by half its own width)
    const dR = v.x - (b.x + b.width);
    const dL = b.x - (v.x + v.w);
    const dT = b.y - (v.y + v.h);
    const dB = v.y - (b.y + b.height);
    if (overlapY && near(dR)) cands.push({ side: 'right', d: Math.abs(dR), off: v.y - b.y });
    if (overlapY && near(dL)) cands.push({ side: 'left', d: Math.abs(dL), off: v.y - b.y });
    if (overlapX && near(dT)) cands.push({ side: 'top', d: Math.abs(dT), off: v.x - b.x });
    if (overlapX && near(dB)) cands.push({ side: 'bottom', d: Math.abs(dB), off: v.x - b.x });
  }
  cands.sort((a1, a2) => a1.d - a2.d);
  if (cands.length) return { ...st, mode: 'dock', side: cands[0].side, off: Math.round(cands[0].off) };
  return { ...st, mode: 'free', x: Math.round(x), y: Math.round(y) };
}
module.exports = { BAR_FRAMES, BAR_KINDS, barKind, cleanInkSize, inkBarOptions, inkSpot, snapInk };
