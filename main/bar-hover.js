'use strict';
// 1.4.29: which note's top bar the mouse is over. Windows doesn't tell a page about the mouse over a drag area (the bar is
// one: dragging, double-click = maximise and snapping are Windows' own), so a page can't know. Main asks for the mouse
// itself, ten times a second, and tells a note's window only when it goes onto or off its bar (`note:bar-hover`). The page
// puts `bar-hover` on its body (src/note/top-bar.js); the rename pencil shows with it (note-base.css).
const { screen } = require('electron');
const { wins } = require('./state');

const BAR_H = 32; // px: `#bar` in src/css/note-base.css
const EVERY = 100; // ms

function check() {
  if (!wins.size) return;
  const p = screen.getCursorScreenPoint();
  for (const win of wins.values()) {
    if (win.isDestroyed() || win.webContents.isDestroyed()) continue;
    const b = win.getBounds();
    const on = win.isVisible() && p.x >= b.x && p.x < b.x + b.width && p.y >= b.y && p.y < b.y + BAR_H;
    if (on === !!win.barHover) continue;
    win.barHover = on;
    win.webContents.send('note:bar-hover', on);
  }
}

let timer = null;
function startBarHover() { if (!timer) timer = setInterval(check, EVERY); }

module.exports = { check, startBarHover };
