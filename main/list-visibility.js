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
// 1.3.28 (the owner's wish): a group the list may not change: it or a group around it is locked and not open in the list.
// Such a group (like a note hidden in the list, `hiddenInList`) can only be picked, unlocked or have its lock removed.
const groupShut = (groupId) => !!groupId && !groupOpenInList(groupId);
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
// "Lock again" for everything (the list's Locked tab; 1.3.27 the panic button): "Unlock all" and the groups opened in the
// list, what was unlocked for now (1.1.47), and every open window that was unlocked (it saves what was typed, then hides
// itself, like locking from the list). `keep`: ids of notes whose window is left as it is (the panic button's exceptions).
function coverAll(keep = new Set()) {
  S.listUnlockedAll = false;
  listOpenGroups.clear();
  for (const id of [...unlockedForNow]) if (!keep.has(id)) unlockedForNow.delete(id);
  for (const [id, win] of wins) {
    const n = S.store.get(id);
    if (!n || win.isDestroyed() || keep.has(id)) continue;
    if (isLocked(n) && win.revealed) { win.lockPending = true; win.webContents.send('note:lock-now'); }
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
// 1.4.10: every tag in use, for a note's ⋯ menu to suggest: the groups' and those of notes not in the Bin whose lock doesn't
// hide them (a hidden note's tags are secret, src/tags.js)
function knownTags() {
  const out = new Set();
  for (const g of S.store.groups.values()) for (const t of g.tags) out.add(t);
  for (const n of S.store.all()) if (!n.deletedAt && !hiddenInList(n)) for (const t of n.tags) out.add(t);
  return [...out].sort((a, b) => a.localeCompare(b));
}
module.exports = { coverAll, groupOpenInList, groupShut, hiddenInList, hideNewlyLocked, knownTags, listOpenGroups, openForNow, pushLook, revealedNow, unlockedForNow };
