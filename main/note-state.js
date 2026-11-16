'use strict';
const REMIND = require('../src/reminders');
const { APP_NAME, BIG, DEFAULT_H, MIN_H, MIN_W, ROLLED_H } = require('./constants');
const { paperOf } = require('./evening');
const { isLocked } = require('./locks');
const { BAR_KINDS } = require('./ink-geometry');
const { showInk } = require('./ink-window');
const { S, wins } = require('./state');

 // note id -> BrowserWindow

// ------------------------------------------------------------------ helpers
// 1.1.30: a locked note that isn't unlocked in its window shows its "title while locked" (or "Locked note"), never its title
const titleOf = (n, revealed = false) => {
  if (isLocked(n) && !revealed) return (n.coverTitle || '').trim().slice(0, 80) || 'Locked note';
  if (n.title && n.title.trim()) return n.title.trim().slice(0, 80);
  if (isLocked(n)) return 'Locked note';
  const line = (n.text || '').split('\n').map((s) => s.trim()).find(Boolean);
  return line ? line.slice(0, 60) : APP_NAME;
};

// ------------------------------------------------------------------ note windows
// 1.4.1: a note whose reminder is ringing stays on top of other windows until Snooze or Done (main/reminders.js)
// 1.4.5: a note pinned over apps whose app is open but not in front sits just above that app instead (win.appBehind,
// main/app-pin.js)
const onTop = (n, win) => (!!n.pinned && !(win && win.appBehind)) || REMIND.ringing(n.reminders).length > 0;
// 1.4.2: pinned notes over each other: the one pinned or clicked last is on top. Windows puts a window above all the
// other on-top windows each time setAlwaysOnTop(true) is called on it, so it is called here only when a note's on-top
// really changes, and enforcePinned (note-window.js) puts the pinned ones back in order: win.raisedAt, stamped when a
// note goes on top, is clicked ('focus') or is brought up (bringToFront, a reminder).
let raises = 0;
const raised = (win) => { win.raisedAt = ++raises; };
function setOnTop(w, on) {
  if (w && !w.isDestroyed() && w.isAlwaysOnTop() !== on) w.setAlwaysOnTop(on, 'screen-saver');
}
function applyState(win, n) {
  if (win.isDestroyed()) return;
  win.setOpacity(n.opacity);
  const top = onTop(n, win);
  if (top && !win.isAlwaysOnTop()) raised(win);
  setOnTop(win, top);
  for (const k of BAR_KINDS) setOnTop(win[`${k}Win`], top);
  win.setBackgroundColor(paperOf(n)); // 1.3.27: its evening colour in the evening
  applyClickThrough(win, n);
  setWinTitle(win, n);
}

// ------------------------------------------------------------------ click-through (1.3.34)
// A click-through note (note.clickThrough, only with Settings → Click-through on) lets the mouse through to the window
// under it, so it can be read over a video or a game. Windows still sends it the mouse's moves (forward), and only its
// click-through button wakes it: the note says when the mouse is on that button (note:ct-awake, win.ctAwake), and its
// window takes clicks until the mouse leaves the button. Nothing else in the note reacts meanwhile (note-base.css body.ct).
// Not Ctrl: the moves Windows forwards carry no keys, and a key held in another app never reaches this one.
const clickThroughNow = (n) => !!(S.store.settings.clickThroughOn && n && n.clickThrough);
function applyClickThrough(win, n) {
  if (win.isDestroyed()) return;
  const on = clickThroughNow(n);
  if (!on) win.ctAwake = false;
  const ignore = on && !win.ctAwake;
  if (win.ctIgnore === ignore) return;
  win.ctIgnore = ignore;
  if (ignore) win.setIgnoreMouseEvents(true, { forward: true });
  else win.setIgnoreMouseEvents(false);
}
// Settings → Click-through turned on or off: every open note follows
function applyClickThroughAll() {
  for (const [id, win] of wins) applyClickThrough(win, S.store.get(id));
}
// the window title follows the note's title or first line; only touch it when it really changes
function setWinTitle(win, n) {
  const t = titleOf(n, !!win.revealed && !win.lockPending);
  if (win.cosmoTitle === t) return;
  win.cosmoTitle = t;
  win.setTitle(t);
}

function setRolled(win, n) {
  const b = win.getBounds();
  showInk(win, !n.rolled); // a toolbar outside the note hides while it's rolled up
  if (n.rolled) {
    n.bounds = { x: b.x, y: b.y, width: b.width, height: Math.max(MIN_H, b.height > ROLLED_H + 4 ? b.height : (n.bounds?.height || DEFAULT_H)) };
    S.store.save(n.id);
    win.setMinimumSize(MIN_W, ROLLED_H);
    win.setMaximumSize(BIG, ROLLED_H);
    win.setSize(b.width, ROLLED_H);
  } else {
    win.setMaximumSize(BIG, BIG);
    win.setMinimumSize(MIN_W, MIN_H);
    win.setSize(b.width, n.bounds?.height || DEFAULT_H);
  }
}
module.exports = { applyClickThrough, applyClickThroughAll, applyState, clickThroughNow, raised, setRolled, setWinTitle, titleOf };
