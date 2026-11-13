'use strict';
const { BrowserWindow, screen } = require('electron');
const path = require('path');
const { BIG, DEFAULT_H, MIN_H, MIN_W, PRELOAD, ROLLED_H, WIN_ICON } = require('./constants');
const { paperOf } = require('./evening');
const { isLocked, viewOf } = require('./locks');
const { fitBounds, visibleOnSomeDisplay } = require('./display');
const { hardenContents } = require('./web');
const { watchInkBar } = require('./ink-window');
const { notifyList } = require('./list-notify');
const { applyState, setRolled, titleOf } = require('./note-state');
const { groupOpenInList, openForNow } = require('./list-visibility');
const { closedChanged, noteClosed, takeClosed } = require('./closed-notes');
const { S, wins } = require('./state');

function openNoteWindow(n, { focus = false } = {}) {
  const existing = wins.get(n.id);
  if (existing && !existing.isDestroyed()) {
    if (existing.isMinimized()) existing.restore();
    if (focus) { existing.show(); existing.focus(); } else existing.showInactive();
    return existing;
  }

  const b = fitBounds(n.bounds);
  n.bounds = b;
  S.store.save(n.id);

  const win = new BrowserWindow({
    x: b.x,
    y: b.y,
    width: b.width,
    height: n.rolled ? ROLLED_H : b.height,
    minWidth: MIN_W,
    minHeight: n.rolled ? ROLLED_H : MIN_H,
    frame: false,
    show: false,
    title: titleOf(n),
    icon: WIN_ICON,
    backgroundColor: paperOf(n), // 1.3.27: its evening colour in the evening
    minimizable: false, // only the note's own minimise button minimises it (see 'note:minimize')
    maximizable: true, // 1.1.13: maximise button, and double-clicking the top bar
    fullscreenable: false,
    skipTaskbar: false,
    webPreferences: {
      preload: PRELOAD,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: true,
    },
  });
  // the window title is the note's title (setWinTitle); the page's own <title> must not replace it
  win.on('page-title-updated', (e) => e.preventDefault());
  if (n.rolled) win.setMaximumSize(BIG, ROLLED_H);
  win.noteId = n.id;
  win.focusOnLoad = focus;
  // true while the window may show the note's contents (unlocked note, or password typed in it)
  // 1.1.47: a locked note unlocked for now from the list opens without the password too
  win.revealed = !isLocked(n) || openForNow(n);
  wins.set(n.id, win);
  closedChanged(); // 1.3.30: opened again some other way: the tray may have nothing left to reopen
  hardenContents(win.webContents, { inkBarFor: win });
  watchInkBar(win);

  let shown = false;
  const showIt = () => {
    if (shown || win.isDestroyed()) return;
    shown = true;
    applyState(win, S.store.get(n.id) || n);
    if (focus) { win.show(); win.focus(); } else win.showInactive();
  };
  win.once('ready-to-show', showIt);
  setTimeout(showIt, 4000);

  let bt = null;
  const rememberBounds = () => {
    clearTimeout(bt);
    bt = setTimeout(() => {
      if (win.isDestroyed()) return;
      const cur = S.store.get(win.noteId);
      if (!cur) return;
      // a maximised or minimised note keeps its normal size and place for next time
      if (win.isMaximized() || win.isMinimized()) return;
      const r = win.getBounds();
      cur.bounds = { x: r.x, y: r.y, width: r.width, height: cur.rolled ? (cur.bounds?.height || DEFAULT_H) : r.height };
      S.store.save(cur.id, 300);
    }, 350);
  };
  win.on('move', rememberBounds);
  win.on('resize', rememberBounds);

  // A pinned note never minimises by itself (e.g. "Show desktop"), only with its own minimise button (win.userMin).
  win.on('minimize', () => {
    const cur = S.store.get(win.noteId);
    if (cur && cur.pinned && !win.userMin) setTimeout(() => { if (!win.isDestroyed()) win.restore(); }, 30);
  });
  win.on('restore', () => {
    if (!win.userMin) return;
    win.userMin = false;
    win.setMinimizable(false);
  });
  // 1.1.13: maximise (button or double-click on the top bar). A rolled-up note unrolls first.
  const sendWinState = () => { if (!win.isDestroyed()) win.webContents.send('note:win-state', { maximized: win.isMaximized() }); };
  win.on('maximize', () => {
    const cur = S.store.get(win.noteId);
    if (cur && cur.rolled) {
      setTimeout(() => {
        if (win.isDestroyed()) return;
        win.unmaximize();
        unrollWin(win, cur);
        win.maximize();
      }, 0);
      return;
    }
    sendWinState();
  });
  win.on('unmaximize', sendWinState);

  // Windows is shutting down / logging off: keep notes marked open so they come back.
  win.on('session-end', () => { S.quitting = true; S.store.flush(); });

  win.on('closed', () => {
    const id = win.noteId;
    if (wins.get(id) === win) wins.delete(id);
    const cur = S.store.get(id);
    // 1.3.30: closed by the owner (its X, the list's Close): Ctrl+Shift+T / the tray can bring it back. Remembered only
    // once the window is gone, so the tray's item counts it (Electron closes a window a moment after close()).
    if (win.byHand) noteClosed(id);
    if (cur && cur.open && !S.quitting) {
      // Closed some other way than the X button (e.g. Alt+F4). If the app is
      // still running a moment later it was not a shutdown, so remember it closed.
      setTimeout(() => {
        if (S.quitting || wins.has(id)) return;
        const m = S.store.get(id);
        if (m && m.open) { m.open = false; S.store.save(id); noteClosed(id); notifyList(); }
      }, 2500);
    }
    notifyList();
  });

  win.loadFile(path.join(__dirname, '..', 'src', 'note.html'));
  return win;
}

function createNote({ near, groupId = null } = {}) {
  let bounds = null;
  if (near && !near.isDestroyed()) {
    const r = near.getBounds();
    const area = screen.getDisplayMatching(r).workArea;
    const w = r.width;
    const h = Math.max(r.height, MIN_H);
    if (r.x + r.width + 14 + w <= area.x + area.width) bounds = { x: r.x + r.width + 14, y: r.y, width: w, height: h };
    else if (r.x - 14 - w >= area.x) bounds = { x: r.x - 14 - w, y: r.y, width: w, height: h };
    else bounds = { x: r.x + 30, y: r.y + 30, width: w, height: h };
  }
  const n = S.store.create({ open: true, bounds, groupId: groupId && S.store.groups.has(groupId) ? groupId : null });
  const win = openNoteWindow(n, { focus: true });
  // made inside a locked group that is open in the list: no need to type the password again
  if (isLocked(n) && !n.locked && groupOpenInList(n.groupId)) win.revealed = true;
  notifyList();
  return n;
}

// Duplicate a note: the copy opens next to the original (or where new notes go), in the same
// group, with the same lock. If the original was already unlocked on screen, so is the copy.
function duplicateNote(id) {
  const src = S.store.get(id);
  if (!src || src.deletedAt) return null;
  const srcWin = wins.get(id);
  const near = srcWin && !srcWin.isDestroyed() ? srcWin : null;
  let bounds = null;
  if (near) {
    const r = near.getBounds();
    const area = screen.getDisplayMatching(r).workArea;
    const h = Math.max(src.bounds?.height || r.height, MIN_H);
    if (r.x + r.width + 14 + r.width <= area.x + area.width) bounds = { x: r.x + r.width + 14, y: r.y, width: r.width, height: h };
    else if (r.x - 14 - r.width >= area.x) bounds = { x: r.x - 14 - r.width, y: r.y, width: r.width, height: h };
    else bounds = { x: r.x + 30, y: r.y + 30, width: r.width, height: h };
  } else if (src.bounds) {
    bounds = { ...src.bounds, x: src.bounds.x + 30, y: src.bounds.y + 30 };
  }
  const n = S.store.duplicate(id, { open: true, bounds, pinned: false, rolled: false });
  if (!n) return null;
  const win = openNoteWindow(n, { focus: true });
  if (isLocked(n) && ((near && near.revealed) || (!n.locked && groupOpenInList(n.groupId)))) win.revealed = true;
  notifyList();
  return n.id;
}

// close a note's window and remember it closed (the list's close button, the panic button)
// byHand (1.3.30): the owner closed it, so "Reopen closed note" can bring it back; the panic button has its own
function closeNoteWindow(id, { byHand = false } = {}) {
  const n = S.store.get(id);
  if (n) { n.open = false; S.store.writeNow(n.id); }
  const win = wins.get(id);
  if (win && !win.isDestroyed()) { if (byHand) win.byHand = true; win.close(); }
}

// 1.3.30: Ctrl+Shift+T in the list, the tray's "Reopen closed note": the note closed last opens again where it was
// (main/closed-notes.js). A locked note asks for its PIN, as when it is opened from the list.
function reopenClosed() {
  const id = takeClosed();
  const n = id && S.store.get(id);
  if (!n) return null;
  n.open = true;
  S.store.save(n.id);
  openNoteWindow(n, { focus: true });
  notifyList();
  return n.id;
}

// unroll a rolled-up note's window (the note shows its text and bars again)
function unrollWin(win, n) {
  S.store.update(n.id, { rolled: false });
  setRolled(win, n);
  win.webContents.send('note:look', viewOf(n, win));
}
// "Bring notes to front" (notes list button, tray menu) also unrolls rolled-up notes (unroll: true).
// Starting CosmoNotes a second time only brings them up.
function bringToFront({ unroll = false } = {}) {
  for (const [id, win] of wins) {
    if (win.isDestroyed()) continue;
    if (win.isMinimized()) win.restore();
    const n = unroll && S.store.get(id);
    if (n && n.rolled) unrollWin(win, n);
    win.showInactive();
    win.moveTop();
  }
}

function enforcePinned() {
  for (const [id, win] of wins) {
    if (win.isDestroyed()) continue;
    const n = S.store.get(id);
    if (!n || !n.pinned || win.userMin) continue; // minimised with its own button: leave it
    if (win.isMinimized()) win.restore();
    if (!win.isVisible()) win.showInactive();
    if (!win.isFocused()) win.setAlwaysOnTop(true, 'screen-saver');
  }
}

function refitAll() {
  for (const win of wins.values()) {
    if (win.isDestroyed()) continue;
    const r = win.getBounds();
    if (!visibleOnSomeDisplay(r)) {
      const f = fitBounds(null);
      win.setPosition(f.x, f.y);
    }
  }
}
module.exports = { bringToFront, closeNoteWindow, createNote, duplicateNote, enforcePinned, openNoteWindow, refitAll, reopenClosed, unrollWin };
