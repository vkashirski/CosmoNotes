'use strict';
const { isLocked, viewOf } = require('./locks');
const { applyState } = require('./note-state');
const { S, wins } = require('./state');

// Locked groups opened with the password in the list window (forgotten when the list closes).
const listOpenGroups = new Set();
// 1.1.47 (the owner's wish): "Unlock" in the list unlocks a note or group only until CosmoNotes quits. Its lock stays
// (on disk it stays locked and sealed); this set lives in memory only, so after a restart it is locked again.
// "Remove lock…" is what removes a lock for good. Note ids and group ids.
const unlockedForNow = new Set();
function groupOpenInList(groupId) {
  if (S.listUnlockedAll) return true;
  return S.store.chain(groupId).every((g) => !g.locked || listOpenGroups.has(g.id) || unlockedForNow.has(g.id));
}
// a locked note whose own lock and every locked group around it are unlocked for now (or opened in the list):
// the list shows it and its window opens without the password
function openForNow(n) {
  return !n.enc && (!n.locked || unlockedForNow.has(n.id)) && groupOpenInList(n.groupId);
}
// Any open note window showing a note that just became locked hides itself
// (it saves first, then asks to be hidden: see 'note:lock-now' in note.js).
function hideNewlyLocked() {
  for (const [id, win] of wins) {
    const n = S.store.get(id);
    if (!n || win.isDestroyed()) continue;
    applyState(win, n);
    // the window saves, then hides itself; the list treats it as hidden straight away (lockPending)
    // (1.1.47: a note unlocked for now stays shown)
    if (isLocked(n) && win.revealed && !openForNow(n)) { win.lockPending = true; win.webContents.send('note:lock-now'); }
    else win.webContents.send('note:look', viewOf(n, win));
  }
}
// 1.1.14: a locked note that's unlocked in its own window shows in the list too, until that window is
// closed or locked again
function revealedNow(n) { const w = wins.get(n.id); return !!(w && !w.isDestroyed() && w.revealed && !w.lockPending); }
// the list never gets the words or pictures of these notes
function hiddenInList(n) { return !!n.enc || (!S.listUnlockedAll && !openForNow(n) && !revealedNow(n)); }
function pushLook(id) {
  const win = wins.get(id);
  const n = S.store.get(id);
  if (!win || win.isDestroyed() || !n) return;
  // its lock was removed (from the list): the open window may show the note again without a password
  if (!isLocked(n)) win.revealed = true;
  applyState(win, n);
  win.webContents.send('note:look', viewOf(n, win));
}
module.exports = { groupOpenInList, hiddenInList, hideNewlyLocked, listOpenGroups, openForNow, pushLook, revealedNow, unlockedForNow };
