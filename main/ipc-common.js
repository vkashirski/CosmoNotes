'use strict';
const { BrowserWindow } = require('electron');
const { EDITABLE, WHILE_HIDDEN } = require('./constants');
const { isLocked, viewOf } = require('./locks');
const { notifyList } = require('./list-notify');
const { applyState, setRolled, setWinTitle } = require('./note-state');
const { S } = require('./state');

// ------------------------------------------------------------------ IPC
function senderNote(e) {
  const win = BrowserWindow.fromWebContents(e.sender);
  if (!win || !win.noteId) return {};
  return { win, note: S.store.get(win.noteId) };
}

function applyPatch(e, patch) {
  const { win, note } = senderNote(e);
  if (!note || !patch || typeof patch !== 'object') return null;
  // A hidden locked note can't be changed from its (empty) window: unlock it first (1.3.28, the owner's wish; before
  // that only its contents and titles were refused). Only pinning and rolling up its window still work.
  const keys = isLocked(note) && !win.revealed ? WHILE_HIDDEN : EDITABLE;
  const clean = {};
  for (const k of keys) if (k in patch) clean[k] = patch[k];
  if (clean.clickThrough) clean.pinned = true; // 1.3.34: a click-through note is pinned (store.js normalize: unpinning ends it)
  const contentChanged = ('html' in clean && clean.html !== note.html) || ('title' in clean && (clean.title || '') !== note.title)
    || ('ink' in clean && JSON.stringify(clean.ink || null) !== JSON.stringify(note.ink || null));
  const rolledChanged = 'rolled' in clean && !!clean.rolled !== note.rolled;
  S.store.update(note.id, clean, { content: contentChanged });
  const n = S.store.get(note.id);
  // Typing only changes the window title; opacity/pin/colour need the rest of applyState (doing all of
  // it on every save also re-asserted "always on top" while typing).
  if ('opacity' in clean || 'pinned' in clean || 'clickThrough' in clean || 'color' in clean || 'evening' in clean) applyState(win, n); // 1.3.27: evening = its background colour
  else if ('text' in clean || 'title' in clean) setWinTitle(win, n);
  if (rolledChanged && n.rolled && win.isMaximized()) win.unmaximize(); // rolling up a maximised note
  if (rolledChanged) setRolled(win, n);
  notifyList();
  return viewOf(n, win);
}
module.exports = { applyPatch, senderNote };
