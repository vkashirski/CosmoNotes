'use strict';
const { APP_NAME, BIG, DEFAULT_H, MIN_H, MIN_W, PAPER, ROLLED_H } = require('./constants');
const { isLocked } = require('./locks');
const { BAR_KINDS } = require('./ink-geometry');
const { showInk } = require('./ink-window');
const { S } = require('./state');

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
function applyState(win, n) {
  if (win.isDestroyed()) return;
  win.setOpacity(n.opacity);
  win.setAlwaysOnTop(n.pinned, 'screen-saver');
  for (const k of BAR_KINDS) if (win[`${k}Win`] && !win[`${k}Win`].isDestroyed()) win[`${k}Win`].setAlwaysOnTop(n.pinned, 'screen-saver');
  win.setBackgroundColor(PAPER[n.color] || PAPER.yellow);
  setWinTitle(win, n);
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
module.exports = { applyState, setRolled, setWinTitle, titleOf };
