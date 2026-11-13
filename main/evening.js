'use strict';
// 1.3.27 (the owner's wish): evening colours, main's side. src/evening.js has the colours and the times; main keeps the one
// clock and tells the windows how far into the evening it is (0 = day, 1 = evening; it fades over 30 minutes), so the
// note windows and the list always agree. Each window mixes its own colours with it (CSS --eve).
const EVENING = require('../src/evening');
const { PAPER } = require('./constants');
const { S, wins } = require('./state');

// evening colours on for this note: its own choice (note.evening), else Settings
const eveOnFor = (n) => (typeof n.evening === 'boolean' ? n.evening : !!S.store.settings.eveOn);
// how far into the evening it is now, in steps of 0.01 (whether Settings has it on or not: a note can turn it on itself)
const evePhase = (now = new Date()) => Math.round(EVENING.phase(now, S.store.settings.eveFrom, S.store.settings.eveTo) * 100) / 100;
// the window's own background colour (seen for a moment while a note is resized), the same as its paper now
function paperOf(n) {
  const day = PAPER[n.color] || PAPER.yellow;
  const eve = EVENING.PALETTE[n.color];
  const t = eve && eveOnFor(n) ? evePhase() : 0;
  return t ? EVENING.mixHex(day, eve.paper, t) : day;
}

let last = null;
let clock = null;
// tell every window the evening's phase: on the clock only when it changed, `force` after a setting changed
function pushEvening(force = false) {
  const p = evePhase();
  if (!force && p === last) return;
  last = p;
  for (const win of wins.values()) {
    if (win.isDestroyed()) continue;
    const n = S.store.get(win.noteId);
    if (n) win.setBackgroundColor(paperOf(n));
    win.webContents.send('note:evening', p);
  }
  if (S.listWin && !S.listWin.isDestroyed()) S.listWin.webContents.send('list:evening', p);
}
// every 30 s: a fade of 30 minutes moves 0.01 about every 18 s, so each step shows within a moment
function startEveningClock() {
  if (clock) return;
  last = evePhase();
  clock = setInterval(() => pushEvening(), 30e3);
}
module.exports = { eveOnFor, evePhase, paperOf, pushEvening, startEveningClock };
