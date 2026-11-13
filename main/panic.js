'use strict';
// 1.3.27 (the owner's wish): the panic button. Settings → Panic button turns it on: a button in each note's top bar, an item
// in the tray menu, and (if one is set) a shortcut that works in every app. One press:
// - closes every open note, except notes whose "Close with the panic button" is off (note.panic === false): those are left
//   exactly as they are (open, and unlocked if they were; the owner's pick);
// - locks again everything that was unlocked (coverAll: Unlock all, groups opened in the list, unlocked for now);
// - closes the notes list, so CosmoNotes is only in the tray.
// The notes it closed are kept in settings.panicClosed and come back (locked) when CosmoNotes is opened again (the owner's
// pick): the tray icon or its "Reopen notes", starting CosmoNotes again, or the next start.
const { globalShortcut } = require('electron');
const { notifyList } = require('./list-notify');
const { coverAll } = require('./list-visibility');
const { closeNoteWindow, openNoteWindow } = require('./note-window');
const { S, wins } = require('./state');

// the tray's menu changes after a panic or a reopen ("Reopen notes" comes and goes): it listens here (tray.js)
const listeners = [];
function onPanicChange(f) { listeners.push(f); }
const changed = () => { for (const f of listeners) f(); };

function panicNow() {
  if (!S.store.settings.panicOn) return 0;
  const closed = [];
  const keep = new Set();
  for (const [id, win] of [...wins]) {
    const n = S.store.get(id);
    if (!n || win.isDestroyed()) continue;
    if (n.panic === false) { keep.add(id); continue; }
    closeNoteWindow(id); // the window saves what was typed (a recording becomes a voice note, as on any close)
    closed.push(id);
  }
  coverAll(keep);
  if (S.listWin && !S.listWin.isDestroyed()) S.listWin.close(); // nothing of it stays on screen or in a window
  // pressed again before reopening: the notes closed the first time still come back too
  const before = S.store.settings.panicClosed.filter((id) => !wins.has(id) && S.store.get(id));
  S.store.settings.panicClosed = [...new Set([...before, ...closed])];
  S.store.saveSettings();
  notifyList();
  changed();
  return closed.length;
}
// opening CosmoNotes again: the notes the panic closed open again where they were (a locked one asks for the PIN again)
function reopenPanicked() {
  const ids = S.store.settings.panicClosed;
  if (!ids.length) return 0;
  let count = 0;
  for (const id of ids) {
    const n = S.store.get(id);
    if (!n || n.deletedAt || wins.has(id)) continue; // gone, binned, or already opened by hand
    n.open = true;
    S.store.save(n.id);
    openNoteWindow(n, { focus: false });
    count++;
  }
  S.store.settings.panicClosed = [];
  S.store.saveSettings();
  notifyList();
  changed();
  return count;
}

// ---- the shortcut (Electron accelerators: 'Alt+Z', 'Ctrl+Shift+H', 'F8'). A letter, digit or sign needs Ctrl, Alt or the
// Windows key with it (Shift alone would take a capital letter away from every app); F1 – F24 may be on their own.
const MODS = ['Ctrl', 'Alt', 'Shift', 'Super'];
const KEY = /^([A-Z0-9]|F([1-9]|1\d|2[0-4])|Space|Tab|Backspace|Delete|Insert|Home|End|PageUp|PageDown|Up|Down|Left|Right|Plus|[-=,./;'[\]\\`])$/;
function validKey(acc) {
  if (typeof acc !== 'string' || !acc || acc.length > 60) return false;
  const parts = acc.split('+');
  const key = acc.endsWith('++') ? 'Plus' : parts.pop(); // "Ctrl++" is never made by the list; Plus is
  const mods = parts.filter((p) => p !== '');
  if (!KEY.test(key) || new Set(mods).size !== mods.length || !mods.every((m) => MODS.includes(m))) return false;
  return /^F\d/.test(key) || mods.some((m) => m !== 'Shift');
}
let registered = ''; // the shortcut Windows gives us now
let lastError = null; // 'taken' (another app has it) | 'bad' | null
let paused = false; // while Settings waits for a new shortcut to be pressed, the old one must not fire
function syncShortcut() {
  const s = S.store.settings;
  const want = s.panicOn && !paused ? s.panicKey : '';
  if (registered === want) { lastError = null; return null; }
  if (registered) { try { globalShortcut.unregister(registered); } catch (e) { console.error(e); } registered = ''; }
  lastError = null;
  if (!want) return null;
  if (!validKey(want)) lastError = 'bad';
  else {
    let ok = false;
    try { ok = globalShortcut.register(want, () => panicNow()); } catch (e) { console.error(e); }
    if (ok) registered = want;
    else lastError = 'taken';
  }
  return lastError;
}
function pauseShortcut(on) { paused = !!on; return syncShortcut(); }
// what Settings shows under the shortcut: 'taken' | 'bad' | null (nothing wrong, or no shortcut)
const shortcutError = () => (S.store.settings.panicOn && S.store.settings.panicKey && !paused ? lastError : null);
function stopShortcut() { try { globalShortcut.unregisterAll(); } catch { /* quitting */ } registered = ''; }
module.exports = { onPanicChange, panicNow, pauseShortcut, reopenPanicked, shortcutError, stopShortcut, syncShortcut, validKey };
