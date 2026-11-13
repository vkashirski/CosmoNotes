'use strict';
// 1.3.30 (the owner's wish): "Reopen closed note", like a browser's closed tabs. Ctrl+Shift+T in the notes list and the
// tray's "Reopen closed note" bring back the note closed last, then the one before, and so on.
// Only notes the owner closed count: the note's X, Alt+F4, the list's Close (card button, right-click, picked-cards bar).
// Not the panic button (it has its own "Reopen notes"), the Bin, locking or quitting.
// Kept only while CosmoNotes runs: after a restart every closed note is still in the list.
// The reopening itself is reopenClosed in note-window.js (this file is below it: it only keeps the ids).
const { S, wins } = require('./state');

const MAX = 25;
const closed = []; // note ids, newest last
const listeners = []; // the tray greys its item out when there is nothing to reopen
function onClosedChange(f) { listeners.push(f); }
const changed = () => { for (const f of listeners) f(); };

// a note that can come back: still there, not in the Bin, not open already
function canReopen(id) {
  const n = S.store.get(id);
  return !!n && !n.deletedAt && !wins.has(id);
}
function noteClosed(id) {
  const at = closed.indexOf(id);
  if (at >= 0) closed.splice(at, 1); // closed again: it moves to the top
  closed.push(id);
  if (closed.length > MAX) closed.splice(0, closed.length - MAX);
  changed();
}
// the newest one that can come back; the ones above it that can't (binned, deleted, opened by hand) are dropped
function takeClosed() {
  let id = null;
  while (closed.length && !id) {
    const c = closed.pop();
    if (canReopen(c)) id = c;
  }
  changed();
  return id;
}
const hasClosed = () => closed.some(canReopen);
// a window opened: if it was one of these, the tray's item may have to grey out
function closedChanged() { if (closed.length) changed(); }
module.exports = { closedChanged, hasClosed, noteClosed, onClosedChange, takeClosed };
