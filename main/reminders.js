'use strict';
// 1.4.1 (the owner's wish): reminders, main's side. src/reminders.js has the rules (times, repeats, Snooze, Done, hiding);
// this file keeps the one clock and does what a reminder does to windows. Rules that aren't obvious from the code:
// - One timer, set for the next reminder of any note (at most a minute ahead, so a PC that slept catches up within a
//   minute; waking also checks at once). A reminder over a minute late says "Missed at …" (src/reminders.js LATE), and a
//   repeat that missed several times goes off once (ring).
// - Going off: the note's window opens (or comes up where it is) without taking the keyboard, on top of other windows
//   while it rings (note-state.js applyState), and the taskbar button flashes. A window that isn't open yet appears where
//   it was if that is on the monitor with the mouse, else in that monitor's top-right corner. The window plays the sound
//   (remind:ring, or `ring` in note:get while it was still loading) and shows Snooze / Done (src/note/remind.js).
// - The panic button's notes stay closed while it keeps them (settings.panicClosed): their reminder still rings, and shows
//   when they are opened again.
// - Hiding: a note hides (its window closes, the list leaves it out unless Settings → Reminders shows them) while one of its
//   reminders has "hide" on and none is ringing (src/reminders.js hiddenNow).
// - A locked note its lock hides: nothing of it changes (1.3.28), except Snooze and Done on a reminder that doesn't ask for
//   the PIN (`unlock` off: the owner's pick). Its messages are secret (constants.js SECRET): its window gets them only
//   once unlocked, the list only through list:remind-get, and never for a note hidden in the list.
const { ipcMain, powerMonitor, screen } = require('electron');
const REMIND = require('../src/reminders');
const { DEFAULT_H, DEFAULT_W } = require('./constants');
const { isLocked, viewOf } = require('./locks');
const { notifyList } = require('./list-notify');
const { applyState, raised } = require('./note-state');
const { senderNote } = require('./ipc-common');
const { hiddenInList, pushLook } = require('./list-visibility');
const { closeNoteWindow, openNoteWindow, unrollWin } = require('./note-window');
const { S, wins } = require('./state');

let timer = null;
const live = () => S.store.all().filter((n) => !n.deletedAt);
const panicked = (n) => (S.store.settings.panicClosed || []).includes(n.id);

// ------------------------------------------------------------------ the clock
function arm() {
  clearTimeout(timer);
  timer = null;
  let next = Infinity;
  for (const n of live()) for (const r of n.reminders) next = Math.min(next, REMIND.dueAt(r));
  if (!Number.isFinite(next)) return;
  timer = setTimeout(() => check(), Math.min(60e3, Math.max(50, next - Date.now())));
}
// everything due by `now` goes off
function check(now = Date.now()) {
  for (const n of live()) {
    const rang = [];
    const list = n.reminders.map((r) => {
      if (REMIND.dueAt(r) > now) return r;
      rang.push(r.id);
      return REMIND.ring(r, now);
    });
    if (!rang.length) continue;
    S.store.update(n.id, { reminders: list });
    popUp(S.store.get(n.id), rang);
  }
  notifyList();
  arm();
}

// ------------------------------------------------------------------ going off
// where a note that isn't open appears: where it was, if that is on the monitor with the mouse; else its top-right corner
function placeForRing(n) {
  const a = screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).workArea;
  const b = n.bounds;
  const w = Math.min(b ? b.width : DEFAULT_W, a.width - 32);
  const h = Math.min(b ? b.height : DEFAULT_H, a.height - 32);
  const cx = b ? b.x + b.width / 2 : NaN;
  const cy = b ? b.y + 17 : NaN; // its top bar
  if (cx >= a.x && cx < a.x + a.width && cy >= a.y && cy < a.y + a.height) return;
  n.bounds = { x: a.x + a.width - w - 16, y: a.y + 16, width: w, height: h };
}
// open or bring up the note's window; `ids` = the reminders that just went off (they play their sound), `quiet` = none
function popUp(n, ids = [], { quiet = false } = {}) {
  if (!n || n.deletedAt || panicked(n)) return;
  let win = wins.get(n.id);
  if (!win || win.isDestroyed()) {
    placeForRing(n);
    n.open = true;
    S.store.save(n.id);
    win = openNoteWindow(n, { focus: false });
  } else {
    if (win.isMinimized()) win.restore();
    if (n.rolled) unrollWin(win, n);
    win.showInactive();
    win.moveTop();
    raised(win); // 1.4.2: and stays above the other pinned notes
  }
  applyState(win, n); // on top while it rings
  if (typeof win.flashFrame === 'function') win.flashFrame(true);
  if (!quiet && ids.length) {
    // a window still loading asks for them in note:get (ipc-notes.js); one that is there hears it now
    if (win.ringLoaded) win.webContents.send('remind:ring', ids);
    else win.ringIds = [...(win.ringIds || []), ...ids];
  }
  pushLook(n.id);
}
// after a change: a note a reminder hides closes its window; one that stopped ringing goes back to how it was
function settle(n) {
  const win = wins.get(n.id);
  if (REMIND.hiddenNow(n.reminders)) { if (win && !win.isDestroyed()) closeNoteWindow(n.id); return; }
  if (!win || win.isDestroyed()) return;
  if (!REMIND.ringing(n.reminders).length && typeof win.flashFrame === 'function') win.flashFrame(false);
  pushLook(n.id);
}

// ------------------------------------------------------------------ changes
// the reminders a window's editor sends: what it may set (time, repeat, sound, hide, unlock); a reminder whose time and
// repeat are the same as before keeps its state (ringing, snoozed, how many times it went off), a new time starts again
function setReminders(n, list, msgs) {
  const old = new Map(n.reminders.map((r) => [r.id, r]));
  const out = [];
  for (const x of Array.isArray(list) ? list.slice(0, REMIND.MAX) : []) {
    const c = REMIND.cleanOne(x && { id: x.id, start: x.start, at: x.start, repeat: x.repeat, sound: x.sound, hide: x.hide, unlock: x.unlock });
    if (!c || out.some((r) => r.id === c.id)) continue;
    const was = old.get(c.id);
    if (was && was.start === c.start && JSON.stringify(was.repeat) === JSON.stringify(c.repeat)) out.push({ ...was, sound: c.sound, hide: c.hide, unlock: c.unlock });
    else out.push({ ...c, at: REMIND.firstAt(c) });
  }
  S.store.update(n.id, { reminders: out, remindMsg: REMIND.cleanMsgs(msgs, out) });
  const cur = S.store.get(n.id);
  arm();
  check(); // one picked for a time that has passed goes off now
  settle(cur);
  notifyList();
  return cur;
}
// Snooze (mins: minutes or 'tomorrow') or Done on a reminder that is ringing
function act(n, id, what, mins) {
  const r = n.reminders.find((x) => x.id === id);
  if (!r || !r.firing) return false;
  const now = Date.now();
  const next = what === 'snooze' ? REMIND.snooze(r, mins, now) : what === 'done' ? REMIND.done(r) : r;
  if (next === r) return false;
  S.store.update(n.id, { reminders: n.reminders.map((x) => (x.id === id ? next : x)).filter(Boolean) });
  const cur = S.store.get(n.id);
  arm();
  settle(cur);
  notifyList();
  return true;
}

function registerRemindIpc() {
  // the note's own window: a note its lock hides can't be changed from it
  ipcMain.handle('remind:set', (e, list, msgs) => {
    const { win, note } = senderNote(e);
    if (!note) return null;
    if (isLocked(note) && !win.revealed) return { error: 'hidden' };
    return viewOf(setReminders(note, list, msgs), win);
  });
  // Snooze / Done in the window: a hidden locked note only when that reminder doesn't ask to unlock first
  ipcMain.handle('remind:act', (e, id, what, mins) => {
    const { win, note } = senderNote(e);
    if (!note) return false;
    const r = note.reminders.find((x) => x.id === id);
    if (!r || (isLocked(note) && !win.revealed && r.unlock)) return false;
    return act(note, id, what, mins);
  });
  // the notes list's editor (right-click → Reminders…, a card's clock): never for a note its lock hides in the list
  ipcMain.handle('list:remind-get', (e, id) => {
    const n = S.store.get(String(id));
    if (!n || n.deletedAt || hiddenInList(n)) return null;
    return { reminders: n.reminders, msgs: n.remindMsg, locked: isLocked(n) };
  });
  ipcMain.handle('list:remind-set', (e, id, list, msgs) => {
    const n = S.store.get(String(id));
    if (!n || n.deletedAt || hiddenInList(n)) return null;
    const cur = setReminders(n, list, msgs);
    return { reminders: cur.reminders, msgs: cur.remindMsg, locked: isLocked(cur) };
  });
}

// at start: what went off while CosmoNotes was closed rings now; what was still ringing when it quit comes back quietly
function startReminders() {
  for (const n of live()) if (REMIND.ringing(n.reminders).length) popUp(n, [], { quiet: true });
  check();
  if (powerMonitor && typeof powerMonitor.on === 'function') {
    powerMonitor.on('resume', () => check());
    powerMonitor.on('unlock-screen', () => check());
  }
}
module.exports = { arm, check, popUp, registerRemindIpc, setReminders, startReminders };
