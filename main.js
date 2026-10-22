'use strict';
const {
  app, BrowserWindow, ipcMain, screen, Tray, Menu, nativeImage, shell, dialog, protocol, net, session,
} = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { pathToFileURL } = require('url');
const { Store } = require('./store');

const APP_NAME = 'CosmoNotes';
const OLD_DATA_DIR = 'Sticky Pins'; // where notes lived before the rename

const PAPER = {
  yellow: '#FFF4A3', pink: '#FFD6E6', green: '#D8F5C4', blue: '#D2ECFF',
  purple: '#E8DDFF', orange: '#FFDFBF', mint: '#CDF3E8', charcoal: '#3A3940',
};
const ROLLED_H = 34;
const MIN_W = 200;
const MIN_H = 120;
const DEFAULT_W = 340;
const DEFAULT_H = 300;
const BIG = 16384;
const ASSETS = path.join(__dirname, 'assets');
const WIN_ICON = path.join(ASSETS, process.platform === 'win32' ? 'icon.ico' : 'icon.png');
const PRELOAD = path.join(__dirname, 'preload.js');
const EDITABLE = ['title', 'html', 'text', 'firstImage', 'ink', 'wrapWidth', 'color', 'font', 'size', 'opacity', 'solidOnHover', 'pinned', 'rolled', 'spell'];
const SECRET = ['html', 'text', 'firstImage', 'ink'];
const ATT_EXT = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'webm', 'ogg', 'mp3', 'm4a', 'wav'];

const WELCOME_HTML =
  '<div>Welcome to CosmoNotes ✨</div>' +
  '<ul class="checklist">' +
  '<li class="done">Open the app</li>' +
  '<li>Click the pin at the top to keep a note above other windows</li>' +
  '<li>Click ⋯ for a title, colours, see-through and the lock</li>' +
  '<li>Click <b>Add</b> at the bottom for photos, voice, drawings and more</li>' +
  '</ul>' +
  '<div>Everything saves on this computer, instantly.</div>';

protocol.registerSchemesAsPrivileged([
  { scheme: 'stickyfile', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } },
]);
// Kept from the "Sticky Pins" days so Windows treats CosmoNotes as the same app
// (the installer replaces the old one and "Start with Windows" keeps working).
app.setAppUserModelId('com.stickypins.app');
// Use the built-in spell checker so Cyrillic words can be left alone.
app.commandLine.appendSwitch('disable-features', 'WinUseBrowserSpellChecker');

let store = null;
let tray = null;
let listWin = null;
let quitting = false;
const wins = new Map(); // note id -> BrowserWindow

// ------------------------------------------------------------------ helpers
const titleOf = (n) => {
  if (n.title && n.title.trim()) return n.title.trim().slice(0, 80);
  if (isLocked(n)) return 'Locked note';
  const line = (n.text || '').split('\n').map((s) => s.trim()).find(Boolean);
  return line ? line.slice(0, 60) : APP_NAME;
};

// What a window is allowed to see: a locked note's contents stay in this
// process until the right password is typed in that window.
// A note is locked by its own lock or by any locked group it sits in.
function isLocked(n) {
  return !!n.locked || store.lockedGroupsOf(n).length > 0;
}
function lockedBy(n) {
  if (n.locked) return 'note';
  return store.lockedGroupsOf(n).length ? 'group' : null;
}
function viewOf(n, win) {
  const hidden = isLocked(n) && !(win && win.revealed);
  const v = { ...n, hidden, lockedBy: lockedBy(n) };
  if (hidden) for (const k of SECRET) v[k] = k === 'html' || k === 'text' ? '' : null;
  return v;
}

// ---------- password for locked notes (one for all notes)
function hashPassword(pw, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(String(pw), salt, 32, { N: 16384, r: 8, p: 1 }).toString('hex');
  return { salt, hash };
}
// Stored on one line in settings.json as "salt:hash" (never the password itself).
const packLock = ({ salt, hash }) => `${salt}:${hash}`;
function checkPassword(pw) {
  const [salt, hash] = String(store.settings.lock || '').split(':');
  if (!salt || !hash) return false;
  const a = Buffer.from(hashPassword(pw, salt).hash, 'hex');
  const b = Buffer.from(hash, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- copy notes over from the old "Sticky Pins" folder (first run after the rename)
function migrateOldData() {
  try {
    const dir = app.getPath('userData');
    const oldDir = path.join(app.getPath('appData'), OLD_DATA_DIR);
    if (path.resolve(dir) === path.resolve(oldDir)) return;
    const has = (d) => fs.existsSync(path.join(d, 'notes')) || fs.existsSync(path.join(d, 'settings.json'));
    if (has(dir) || !has(oldDir)) return;
    fs.mkdirSync(dir, { recursive: true });
    for (const name of ['notes', 'attachments', 'backups', 'settings.json', 'groups.json']) {
      const src = path.join(oldDir, name);
      if (fs.existsSync(src)) fs.cpSync(src, path.join(dir, name), { recursive: true, force: false, errorOnExist: false });
    }
    fs.writeFileSync(path.join(oldDir, 'Notes were copied to CosmoNotes.txt'),
      `Your notes were copied to:\r\n${dir}\r\n\r\nThis old folder was left untouched as a safety copy. You can delete it once you're happy everything is in CosmoNotes.\r\n`);
  } catch (e) {
    console.error('migration failed', e);
  }
}

function spellLanguages() {
  const ses = session.defaultSession;
  const avail = ses.availableSpellCheckerLanguages || [];
  const ok = (l) => !avail.length || avail.includes(l);
  const langs = ['en-US'].filter(ok);
  // Macedonian has no dictionary in the spell checker; these are the closest.
  if (store.settings.spellCyrillic) for (const l of ['mk', 'sr', 'bg', 'ru', 'uk']) if (avail.includes(l)) langs.push(l);
  try { ses.setSpellCheckerLanguages(langs.length ? langs : ['en-US']); } catch (e) { console.error(e); }
}

// Locked groups opened with the password in the list window (forgotten when the list closes).
const listOpenGroups = new Set();
function groupOpenInList(groupId) {
  return store.chain(groupId).every((g) => !g.locked || listOpenGroups.has(g.id));
}
// Any open note window showing a note that just became locked hides itself
// (it saves first, then asks to be hidden: see 'note:lock-now' in note.js).
function hideNewlyLocked() {
  for (const [id, win] of wins) {
    const n = store.get(id);
    if (!n || win.isDestroyed()) continue;
    applyState(win, n);
    if (isLocked(n) && win.revealed) win.webContents.send('note:lock-now');
    else win.webContents.send('note:look', viewOf(n, win));
  }
}
function pushLook(id) {
  const win = wins.get(id);
  const n = store.get(id);
  if (!win || win.isDestroyed() || !n) return;
  applyState(win, n);
  win.webContents.send('note:look', viewOf(n, win));
}

function noteSettings() {
  return { spellCheck: !!store.settings.spellCheck, hasPassword: !!store.settings.lock, ...lockInfo() };
}
// PIN or password: a PIN only takes digits and opens as soon as all of them are typed.
function lockInfo() {
  const pin = store.settings.lockKind === 'pin';
  return { lockKind: pin ? 'pin' : 'password', lockLen: pin ? Number(store.settings.lockLen) || 0 : 0 };
}
function broadcastSettings() {
  const s = noteSettings();
  for (const win of wins.values()) if (!win.isDestroyed()) win.webContents.send('settings:changed', s);
}

function visibleOnSomeDisplay(b) {
  return screen.getAllDisplays().some(({ workArea: a }) =>
    b.x < a.x + a.width - 60 && b.x + b.width > a.x + 60 &&
    b.y >= a.y - 10 && b.y < a.y + a.height - 40);
}

function fitBounds(b) {
  let w = DEFAULT_W;
  let h = DEFAULT_H;
  if (b && [b.x, b.y, b.width, b.height].every(Number.isFinite)) {
    const r = { x: Math.round(b.x), y: Math.round(b.y), width: Math.max(MIN_W, Math.round(b.width)), height: Math.max(MIN_H, Math.round(b.height)) };
    if (visibleOnSomeDisplay(r)) return r;
    w = r.width;
    h = r.height;
  }
  const a = screen.getPrimaryDisplay().workArea;
  w = Math.min(w, a.width - 40);
  h = Math.min(h, a.height - 40);
  const jitter = () => Math.round((Math.random() - 0.5) * 160);
  return {
    x: Math.round(a.x + (a.width - w) / 2 + jitter()),
    y: Math.round(a.y + (a.height - h) / 2 + jitter() / 2),
    width: w,
    height: h,
  };
}

function hardenContents(wc) {
  wc.setWindowOpenHandler(({ url }) => {
    openExternal(url);
    return { action: 'deny' };
  });
  wc.on('will-navigate', (e) => e.preventDefault());
  wc.on('context-menu', (e, p) => {
    const tpl = [];
    if (p.misspelledWord) {
      for (const s of p.dictionarySuggestions.slice(0, 5)) tpl.push({ label: s, click: () => wc.replaceMisspelling(s) });
      if (!p.dictionarySuggestions.length) tpl.push({ label: 'No suggestions', enabled: false });
      tpl.push({ label: 'Add to dictionary', click: () => wc.session.addWordToSpellCheckerDictionary(p.misspelledWord) });
      tpl.push({ type: 'separator' });
    }
    if (p.isEditable || p.selectionText) {
      tpl.push(
        { label: 'Cut', role: 'cut', enabled: p.editFlags.canCut },
        { label: 'Copy', role: 'copy', enabled: p.editFlags.canCopy },
        { label: 'Paste', role: 'paste', enabled: p.editFlags.canPaste },
        { label: 'Paste as plain text', role: 'pasteAndMatchStyle', enabled: p.editFlags.canPaste },
        { type: 'separator' },
        { label: 'Select all', role: 'selectAll' },
      );
    }
    if (tpl.length) Menu.buildFromTemplate(tpl).popup({ window: BrowserWindow.fromWebContents(wc) });
  });
}

function openExternal(url) {
  try {
    const u = new URL(url);
    if (['http:', 'https:', 'mailto:'].includes(u.protocol)) shell.openExternal(u.toString());
  } catch { /* not a url */ }
}

let notifyTimer = null;
function notifyList() {
  clearTimeout(notifyTimer);
  notifyTimer = setTimeout(() => {
    if (listWin && !listWin.isDestroyed()) listWin.webContents.send('notes:changed');
  }, 120);
}

// ------------------------------------------------------------------ note windows
function applyState(win, n) {
  if (win.isDestroyed()) return;
  win.setOpacity(n.opacity);
  win.setAlwaysOnTop(n.pinned, 'screen-saver');
  win.setBackgroundColor(PAPER[n.color] || PAPER.yellow);
  setWinTitle(win, n);
}
// the window title follows the note's title or first line; only touch it when it really changes
function setWinTitle(win, n) {
  const t = titleOf(n);
  if (win.cosmoTitle === t) return;
  win.cosmoTitle = t;
  win.setTitle(t);
}

function setRolled(win, n) {
  const b = win.getBounds();
  if (n.rolled) {
    n.bounds = { x: b.x, y: b.y, width: b.width, height: Math.max(MIN_H, b.height > ROLLED_H + 4 ? b.height : (n.bounds?.height || DEFAULT_H)) };
    store.save(n.id);
    win.setMinimumSize(MIN_W, ROLLED_H);
    win.setMaximumSize(BIG, ROLLED_H);
    win.setSize(b.width, ROLLED_H);
  } else {
    win.setMaximumSize(BIG, BIG);
    win.setMinimumSize(MIN_W, MIN_H);
    win.setSize(b.width, n.bounds?.height || DEFAULT_H);
  }
}

function openNoteWindow(n, { focus = false } = {}) {
  const existing = wins.get(n.id);
  if (existing && !existing.isDestroyed()) {
    if (existing.isMinimized()) existing.restore();
    if (focus) { existing.show(); existing.focus(); } else existing.showInactive();
    return existing;
  }

  const b = fitBounds(n.bounds);
  n.bounds = b;
  store.save(n.id);

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
    backgroundColor: PAPER[n.color] || PAPER.yellow,
    minimizable: false,
    maximizable: false,
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
  win.revealed = !isLocked(n);
  wins.set(n.id, win);
  hardenContents(win.webContents);

  let shown = false;
  const showIt = () => {
    if (shown || win.isDestroyed()) return;
    shown = true;
    applyState(win, store.get(n.id) || n);
    if (focus) { win.show(); win.focus(); } else win.showInactive();
  };
  win.once('ready-to-show', showIt);
  setTimeout(showIt, 4000);

  let bt = null;
  const rememberBounds = () => {
    clearTimeout(bt);
    bt = setTimeout(() => {
      if (win.isDestroyed()) return;
      const cur = store.get(win.noteId);
      if (!cur) return;
      const r = win.getBounds();
      cur.bounds = { x: r.x, y: r.y, width: r.width, height: cur.rolled ? (cur.bounds?.height || DEFAULT_H) : r.height };
      store.save(cur.id, 300);
    }, 350);
  };
  win.on('move', rememberBounds);
  win.on('resize', rememberBounds);

  win.on('minimize', () => {
    const cur = store.get(win.noteId);
    if (cur && cur.pinned) setTimeout(() => { if (!win.isDestroyed()) win.restore(); }, 30);
  });

  // Windows is shutting down / logging off: keep notes marked open so they come back.
  win.on('session-end', () => { quitting = true; store.flush(); });

  win.on('closed', () => {
    const id = win.noteId;
    if (wins.get(id) === win) wins.delete(id);
    const cur = store.get(id);
    if (cur && cur.open && !quitting) {
      // Closed some other way than the X button (e.g. Alt+F4). If the app is
      // still running a moment later it was not a shutdown, so remember it closed.
      setTimeout(() => {
        if (quitting || wins.has(id)) return;
        const m = store.get(id);
        if (m && m.open) { m.open = false; store.save(id); notifyList(); }
      }, 2500);
    }
    notifyList();
  });

  win.loadFile(path.join(__dirname, 'src', 'note.html'));
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
  const n = store.create({ open: true, bounds, groupId: groupId && store.groups.has(groupId) ? groupId : null });
  const win = openNoteWindow(n, { focus: true });
  // made inside a locked group that is open in the list: no need to type the password again
  if (isLocked(n) && !n.locked && groupOpenInList(n.groupId)) win.revealed = true;
  notifyList();
  return n;
}

// Duplicate a note: the copy opens next to the original (or where new notes go), in the same
// group, with the same lock. If the original was already unlocked on screen, so is the copy.
function duplicateNote(id) {
  const src = store.get(id);
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
  const n = store.duplicate(id, { open: true, bounds, pinned: false, rolled: false });
  if (!n) return null;
  const win = openNoteWindow(n, { focus: true });
  if (isLocked(n) && ((near && near.revealed) || (!n.locked && groupOpenInList(n.groupId)))) win.revealed = true;
  notifyList();
  return n.id;
}

// "Bring notes to front" (notes list button, tray menu) also unrolls rolled-up notes (unroll: true).
// Starting CosmoNotes a second time only brings them up.
function bringToFront({ unroll = false } = {}) {
  for (const [id, win] of wins) {
    if (win.isDestroyed()) continue;
    if (win.isMinimized()) win.restore();
    const n = unroll && store.get(id);
    if (n && n.rolled) {
      store.update(id, { rolled: false });
      setRolled(win, n);
      win.webContents.send('note:look', viewOf(n, win)); // the note shows its text and bars again
    }
    win.showInactive();
    win.moveTop();
  }
}

function enforcePinned() {
  for (const [id, win] of wins) {
    if (win.isDestroyed()) continue;
    const n = store.get(id);
    if (!n || !n.pinned) continue;
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

// ------------------------------------------------------------------ list window
// colours of the list window's own title strip (window buttons) for each list theme (list.css)
const LIST_THEMES = {
  cream: ['#FBF6EC', '#6B5A3E'],
  rose: ['#FFF0F3', '#7A4A58'],
  mint: ['#EDF8F2', '#3F6B57'],
  sky: ['#EDF5FD', '#3F5D7A'],
  lilac: ['#F4F0FD', '#5A4B7E'],
  night: ['#25232A', '#D8D0C2'],
  midnight: ['#1D2232', '#C3C9D8'],
  forest: ['#1C2520', '#C2D0C5'],
  plum: ['#251D29', '#D2C3D5'],
};
const listTheme = () => LIST_THEMES[store.settings.listTheme] || LIST_THEMES.cream;
function paintListFrame() {
  if (!listWin || listWin.isDestroyed()) return;
  const [bg, fg] = listTheme();
  try {
    if (listWin.setBackgroundColor) listWin.setBackgroundColor(bg);
    if (listWin.setTitleBarOverlay) listWin.setTitleBarOverlay({ color: bg, symbolColor: fg, height: 44 });
  } catch { /* older Windows: the buttons just keep their colour */ }
}
function showList() {
  if (listWin && !listWin.isDestroyed()) {
    if (listWin.isMinimized()) listWin.restore();
    listWin.show();
    listWin.focus();
    return;
  }
  const saved = store.settings.listBounds;
  const b = saved && visibleOnSomeDisplay(saved) ? saved : { width: 420, height: 640 };
  listWin = new BrowserWindow({
    ...b,
    minWidth: 340,
    minHeight: 420,
    title: APP_NAME,
    icon: WIN_ICON,
    show: false,
    backgroundColor: listTheme()[0],
    titleBarStyle: 'hidden',
    titleBarOverlay: { color: listTheme()[0], symbolColor: listTheme()[1], height: 44 },
    webPreferences: { preload: PRELOAD, contextIsolation: true, nodeIntegration: false, sandbox: true, spellcheck: false },
  });
  hardenContents(listWin.webContents);
  listWin.once('ready-to-show', () => listWin.show());
  const remember = () => {
    if (!listWin || listWin.isDestroyed() || listWin.isMinimized() || listWin.isMaximized()) return;
    store.settings.listBounds = listWin.getBounds();
  };
  listWin.on('move', remember);
  listWin.on('resize', remember);
  listWin.on('close', () => { remember(); try { store.saveSettings(); } catch { /* ignore */ } });
  listWin.on('closed', () => { listWin = null; listOpenGroups.clear(); });
  // the mouse's back / forward buttons (some mice send these as Windows commands): move between group levels
  listWin.on('app-command', (e, cmd) => {
    if (cmd !== 'browser-backward' && cmd !== 'browser-forward') return;
    if (listWin && !listWin.isDestroyed()) listWin.webContents.send('list:nav', cmd === 'browser-backward' ? 'back' : 'forward');
  });
  listWin.loadFile(path.join(__dirname, 'src', 'list.html'));
}

// ------------------------------------------------------------------ tray & startup
function setStartup(enabled) {
  store.settings.startWithWindows = !!enabled;
  store.saveSettings();
  syncLoginItem();
  buildTray();
  notifyList();
}

function syncLoginItem() {
  if (!app.isPackaged || process.platform !== 'win32') return;
  app.setLoginItemSettings({ openAtLogin: !!store.settings.startWithWindows, args: ['--startup'] });
}

function buildTray() {
  if (!tray) {
    const img = nativeImage.createFromPath(path.join(ASSETS, process.platform === 'win32' ? 'tray.ico' : 'tray.png'));
    tray = new Tray(img);
    tray.setToolTip(APP_NAME);
    tray.on('click', showList);
  }
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'New note', click: () => createNote() },
    { label: 'All notes', click: showList },
    { label: 'Bring notes to front', click: () => bringToFront({ unroll: true }) },
    { type: 'separator' },
    { label: 'Start with Windows', type: 'checkbox', checked: !!store.settings.startWithWindows, click: (mi) => setStartup(mi.checked) },
    { type: 'separator' },
    { label: `Quit ${APP_NAME}`, click: () => { quitting = true; app.quit(); } },
  ]));
}

// ------------------------------------------------------------------ IPC
function senderNote(e) {
  const win = BrowserWindow.fromWebContents(e.sender);
  if (!win || !win.noteId) return {};
  return { win, note: store.get(win.noteId) };
}

function applyPatch(e, patch) {
  const { win, note } = senderNote(e);
  if (!note || !patch || typeof patch !== 'object') return null;
  const clean = {};
  for (const k of EDITABLE) if (k in patch) clean[k] = patch[k];
  // A hidden locked note can never be overwritten from its (empty) window.
  if (isLocked(note) && !win.revealed) for (const k of SECRET) delete clean[k];
  const contentChanged = ('html' in clean && clean.html !== note.html) || ('title' in clean && (clean.title || '') !== note.title)
    || ('ink' in clean && JSON.stringify(clean.ink || null) !== JSON.stringify(note.ink || null));
  const rolledChanged = 'rolled' in clean && !!clean.rolled !== note.rolled;
  store.update(note.id, clean, { content: contentChanged });
  const n = store.get(note.id);
  // Typing only changes the window title; opacity/pin/colour need the rest of applyState (doing all of
  // it on every save also re-asserted "always on top" while typing).
  if ('opacity' in clean || 'pinned' in clean || 'color' in clean) applyState(win, n);
  else if ('text' in clean || 'title' in clean) setWinTitle(win, n);
  if (rolledChanged) setRolled(win, n);
  notifyList();
  return viewOf(n, win);
}

function registerIpc() {
  ipcMain.handle('note:get', (e) => {
    const { win, note } = senderNote(e);
    if (!note) return null;
    return { ...viewOf(note, win), focusEditor: !!win.focusOnLoad, settings: noteSettings() };
  });
  ipcMain.handle('note:unlock', async (e, pw) => {
    const { win, note } = senderNote(e);
    if (!note) return null;
    if (!isLocked(note)) return viewOf(note, win);
    if (!checkPassword(pw)) { await wait(450); return null; }
    win.revealed = true;
    return viewOf(note, win);
  });
  ipcMain.handle('note:relock', (e) => {
    const { win, note } = senderNote(e);
    if (!note) return null;
    win.revealed = false;
    return viewOf(note, win);
  });
  ipcMain.handle('note:set-locked', (e, locked) => {
    const { win, note } = senderNote(e);
    if (!note) return null;
    if (locked) {
      if (!store.settings.lock) return { error: 'no-password' };
      note.locked = true;
      win.revealed = false;
    } else {
      if (isLocked(note) && !win.revealed) return { error: 'hidden' };
      note.locked = false;
    }
    store.writeNow(note.id);
    applyState(win, note);
    notifyList();
    return viewOf(note, win);
  });
  ipcMain.handle('lock:set', (e, { current, next, kind } = {}) => {
    next = String(next || '');
    const pin = kind === 'pin';
    if (pin && !/^\d{4,12}$/.test(next)) return { error: 'A PIN is 4 to 12 digits.' };
    if (next.length < 4) return { error: 'Use at least 4 characters or digits.' };
    if (store.settings.lock && !checkPassword(current)) return { error: `The current ${lockInfo().lockKind === 'pin' ? 'PIN' : 'password'} is not right.` };
    store.settings.lock = packLock(hashPassword(next));
    store.settings.lockKind = pin ? 'pin' : 'password';
    store.settings.lockLen = pin ? next.length : 0;
    store.saveSettings();
    broadcastSettings();
    notifyList();
    return { ok: true };
  });
  ipcMain.handle('note:update', (e, patch) => applyPatch(e, patch));
  ipcMain.handle('note:dates', (e) => {
    const { note } = senderNote(e);
    return note ? { createdAt: note.createdAt, updatedAt: note.updatedAt } : null;
  });
  ipcMain.on('note:update-sync', (e, patch) => {
    try { applyPatch(e, patch); const { note } = senderNote(e); if (note) store.writeNow(note.id); } catch (err) { console.error(err); }
    e.returnValue = true;
  });
  ipcMain.handle('note:duplicate', (e) => { const { note } = senderNote(e); return note ? duplicateNote(note.id) : null; });
  ipcMain.handle('list:duplicate', (e, id) => duplicateNote(String(id)));
  ipcMain.handle('note:new', (e) => { createNote({ near: BrowserWindow.fromWebContents(e.sender) }); });
  ipcMain.handle('note:close', (e) => {
    const { win, note } = senderNote(e);
    if (!note) return;
    note.open = false;
    store.writeNow(note.id);
    win.close();
  });
  ipcMain.handle('note:trash', (e) => {
    const { win, note } = senderNote(e);
    if (!note) return;
    store.trash(note.id);
    win.close();
    notifyList();
  });
  ipcMain.on('note:hover', (e, over) => {
    const { win, note } = senderNote(e);
    if (!note || win.isDestroyed()) return;
    win.setOpacity(over && note.solidOnHover ? 1 : note.opacity);
  });

  ipcMain.handle('att:save', (e, bytes, ext) => {
    ext = String(ext || '').toLowerCase();
    if (!ATT_EXT.includes(ext)) throw new Error('Unsupported file type');
    const buf = Buffer.from(bytes);
    if (buf.length > 200 * 1024 * 1024) throw new Error('File too large');
    return store.saveAttachment(buf, ext);
  });
  ipcMain.handle('att:pick-images', async (e) => {
    const win = BrowserWindow.fromWebContents(e.sender);
    const r = await dialog.showOpenDialog(win, {
      title: 'Add photos',
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp'] }],
    });
    if (r.canceled) return [];
    const urls = [];
    for (const p of r.filePaths) {
      try { urls.push(store.importFile(p)); } catch (err) { console.error(err); }
    }
    return urls;
  });
  ipcMain.handle('att:open', (e, url) => {
    const p = store.attachmentPathFromUrl(url);
    if (p && fs.existsSync(p)) shell.openPath(p);
  });
  ipcMain.handle('open-external', (e, url) => openExternal(url));

  // list window
  ipcMain.handle('list:show', () => showList());
  ipcMain.handle('list:get', () => {
    const { lock, ...settings } = store.settings;
    const hiddenInList = (n) => n.locked || !groupOpenInList(n.groupId);
    return {
      notes: store.all().map((n) => ({
        id: n.id,
        title: n.title,
        text: hiddenInList(n) ? '' : n.text.slice(0, 600),
        firstImage: hiddenInList(n) ? null : n.firstImage,
        locked: hiddenInList(n), // shown as a locked card
        ownLock: n.locked, // the note's own lock (vs. a locked group)
        color: n.color,
        font: n.font,
        pinned: n.pinned,
        groupId: n.groupId,
        open: wins.has(n.id),
        createdAt: n.createdAt,
        updatedAt: n.updatedAt,
        deletedAt: n.deletedAt,
        restoredFrom: n.restoredFrom,
      })),
      groups: [...store.groups.values()].map((g) => ({ ...g, open: groupOpenInList(g.id) })),
      settings: { ...settings, ...lockInfo(), hasPassword: !!lock, dataPath: store.root, version: app.getVersion() },
    };
  });

  // ---------- groups: a folder tree made by dragging in the list
  ipcMain.handle('groups:make', (e, dragId, targetId) => {
    if (!dragId || dragId === targetId) return null;
    const dragGroup = store.groups.get(dragId);
    const target = store.get(targetId);
    const targetGroup = store.groups.get(targetId);
    if (dragGroup) {
      // a group can be dropped into another group (never into itself or its own sub-groups)
      if (!targetGroup || !store.setParent(dragId, targetId)) return null;
    } else {
      const note = store.get(dragId);
      if (!note) return null;
      if (targetGroup) store.setGroup(dragId, targetId);
      else if (target) {
        if (target.groupId && target.groupId !== note.groupId) store.setGroup(dragId, target.groupId);
        else store.createGroup([targetId, dragId], { parentId: target.groupId }); // new group, inside the current one
      } else return null;
    }
    store.cleanupGroups();
    hideNewlyLocked();
    notifyList();
    // where the dragged note/group ended up
    return dragGroup ? store.groups.get(dragId)?.parentId || null : store.get(dragId)?.groupId || null;
  });
  // one level up: a note leaves its group, a group leaves its parent
  const moveUp = (id) => {
    const g = store.groups.get(id);
    if (g) store.setParent(id, g.parentId ? store.groups.get(g.parentId)?.parentId : null);
    else {
      const n = store.get(id);
      if (n && n.groupId) store.setGroup(id, store.groups.get(n.groupId)?.parentId || null);
    }
    store.cleanupGroups();
    notifyList();
  };
  ipcMain.handle('groups:move-up', (e, id) => moveUp(id));
  // move a note or group straight into a group (or to the top level with null)
  ipcMain.handle('groups:move-to', (e, id, groupId) => {
    groupId = groupId && store.groups.has(groupId) ? groupId : null;
    if (store.groups.has(id)) { if (!store.setParent(id, groupId)) return false; } else if (store.get(id)) store.setGroup(id, groupId);
    else return false;
    store.cleanupGroups();
    hideNewlyLocked();
    notifyList();
    return true;
  });
  ipcMain.handle('groups:ungroup', (e, noteId) => moveUp(noteId));
  ipcMain.handle('groups:dissolve', (e, groupId) => { store.dissolveGroup(groupId); notifyList(); });
  ipcMain.handle('groups:rename', (e, groupId, name) => { store.renameGroup(groupId, name); notifyList(); });
  ipcMain.handle('groups:update', (e, groupId, patch = {}) => {
    const clean = {};
    for (const k of ['name', 'style', 'color']) if (k in patch) clean[k] = patch[k];
    store.updateGroup(groupId, clean);
    notifyList();
  });
  // change colour / font of every note in a group (and the groups inside it)
  ipcMain.handle('groups:apply', (e, groupId, patch = {}, includeInner = true) => {
    const clean = {};
    if (PAPER[patch.color]) clean.color = patch.color;
    if (patch.font === 'hand' || patch.font === 'round') clean.font = patch.font;
    if (!Object.keys(clean).length || !store.groups.has(groupId)) return 0;
    const notes = includeInner ? store.notesInTree(groupId) : store.all().filter((n) => n.groupId === groupId && !n.deletedAt);
    for (const n of notes) {
      store.update(n.id, clean);
      const win = wins.get(n.id);
      if (win && !win.isDestroyed()) {
        applyState(win, n);
        win.webContents.send('note:look', viewOf(n, win));
      }
    }
    notifyList();
    return notes.length;
  });
  ipcMain.handle('groups:trash', (e, groupId) => {
    const notes = store.notesInTree(groupId);
    for (const n of notes) {
      const win = wins.get(n.id);
      store.trash(n.id);
      if (win && !win.isDestroyed()) win.close();
    }
    notifyList();
    return notes.length;
  });

  // ---------- locking from the list (right-click / group settings)
  ipcMain.handle('list:set-locked', async (e, noteId, locked, pw) => {
    const n = store.get(noteId);
    if (!n) return { error: 'missing' };
    if (locked) {
      if (!store.settings.lock) return { error: 'no-password' };
      n.locked = true;
      store.writeNow(n.id);
      hideNewlyLocked();
    } else {
      if (!checkPassword(pw)) { await wait(450); return { error: 'wrong' }; }
      n.locked = false;
      store.writeNow(n.id);
      pushLook(n.id);
    }
    notifyList();
    return { ok: true };
  });
  ipcMain.handle('groups:set-locked', async (e, groupId, locked, pw) => {
    const g = store.groups.get(groupId);
    if (!g) return { error: 'missing' };
    if (locked) {
      if (!store.settings.lock) return { error: 'no-password' };
      store.updateGroup(groupId, { locked: true });
      for (const id of store.subtree(groupId)) listOpenGroups.delete(id);
      hideNewlyLocked();
    } else {
      if (!checkPassword(pw)) { await wait(450); return { error: 'wrong' }; }
      store.updateGroup(groupId, { locked: false });
      for (const n of store.notesInTree(groupId)) pushLook(n.id);
    }
    notifyList();
    return { ok: true };
  });
  // open a locked group in the list (until the list is closed or "Lock again")
  ipcMain.handle('groups:reveal', async (e, groupId, pw) => {
    if (!store.groups.has(groupId)) return { error: 'missing' };
    if (!checkPassword(pw)) { await wait(450); return { error: 'wrong' }; }
    listOpenGroups.add(groupId);
    notifyList();
    return { ok: true };
  });
  ipcMain.handle('groups:hide', (e, groupId) => {
    for (const id of store.subtree(groupId)) listOpenGroups.delete(id);
    notifyList();
  });
  ipcMain.handle('list:new', (e, groupId) => { createNote({ groupId }); });
  ipcMain.handle('list:open-note', (e, id) => {
    const n = store.get(id);
    if (!n || n.deletedAt) return;
    n.open = true;
    store.save(n.id);
    const fresh = !wins.has(n.id);
    const win = openNoteWindow(n, { focus: true });
    // Its locked group was just opened with the password in the list, so don't ask again.
    if (fresh && !n.locked && isLocked(n) && groupOpenInList(n.groupId)) win.revealed = true;
    notifyList();
  });
  ipcMain.handle('list:close-note', (e, id) => {
    const n = store.get(id);
    if (!n) return;
    n.open = false;
    store.writeNow(n.id);
    const win = wins.get(id);
    if (win && !win.isDestroyed()) win.close();
    notifyList();
  });
  ipcMain.handle('list:trash', (e, id) => {
    const win = wins.get(id);
    store.trash(id);
    if (win && !win.isDestroyed()) win.close();
    notifyList();
  });
  ipcMain.handle('list:restore', (e, id) => { store.restore(id); notifyList(); });
  // (the list window asks "are you sure?" in its own style before calling these)
  ipcMain.handle('list:destroy', async (e, id) => {
    store.destroy(id);
    notifyList();
    return true;
  });
  ipcMain.handle('list:empty-bin', async () => {
    const binned = store.all().filter((n) => n.deletedAt);
    if (!binned.length) return false;
    for (const n of binned) store.destroy(n.id);
    notifyList();
    return true;
  });
  ipcMain.handle('list:bring-front', () => bringToFront({ unroll: true }));

  ipcMain.handle('settings:set', (e, patch) => {
    patch = patch || {};
    if ('startWithWindows' in patch) setStartup(patch.startWithWindows);
    if (typeof patch.defaultColor === 'string' && (PAPER[patch.defaultColor] || patch.defaultColor === 'random')) store.settings.defaultColor = patch.defaultColor;
    if (['s', 'm', 'l', 'xl', 'xxl'].includes(patch.listSize)) store.settings.listSize = patch.listSize;
    if (LIST_THEMES[patch.listTheme]) { store.settings.listTheme = patch.listTheme; paintListFrame(); }
    if (patch.defaultFont === 'hand' || patch.defaultFont === 'round') store.settings.defaultFont = patch.defaultFont;
    if (Number.isFinite(Number(patch.defaultOpacity)) && patch.defaultOpacity !== null && patch.defaultOpacity !== '') {
      store.settings.defaultOpacity = Math.min(1, Math.max(0.25, Math.round(Number(patch.defaultOpacity) * 20) / 20));
    }
    if ('spellCheck' in patch) store.settings.spellCheck = !!patch.spellCheck;
    if ('spellCyrillic' in patch) { store.settings.spellCyrillic = !!patch.spellCyrillic; spellLanguages(); }
    if (patch.listSort && typeof patch.listSort === 'object') {
      const ls = { ...store.settings.listSort };
      if (['updated', 'created'].includes(patch.listSort.by)) ls.by = patch.listSort.by;
      if (['desc', 'asc'].includes(patch.listSort.dir)) ls.dir = patch.listSort.dir;
      if (['mixed', 'first', 'last'].includes(patch.listSort.groups)) ls.groups = patch.listSort.groups;
      store.settings.listSort = ls;
    }
    store.saveSettings();
    if ('spellCheck' in patch || 'spellCyrillic' in patch) broadcastSettings();
    // The list already shows a new sort order itself; telling it again made it redraw twice.
    const onlySort = Object.keys(patch).every((k) => k === 'listSort' || k === 'listSize' || k === 'listTheme');
    if (!onlySort) notifyList();
    return true;
  });

  ipcMain.handle('backups:list', () => store.listBackups());
  ipcMain.handle('backups:now', () => { store.backupNow(); return store.listBackups(); });
  ipcMain.handle('backups:restore', async (e, name) => {
    const count = store.restoreBackup(name);
    notifyList();
    return count;
  });
  ipcMain.handle('backups:open-folder', () => shell.openPath(store.backupDir));
  ipcMain.handle('data:open-folder', () => shell.openPath(store.root));
}

// ------------------------------------------------------------------ app lifecycle
function start() {
  Menu.setApplicationMenu(null);
  migrateOldData();
  store = new Store(app.getPath('userData'));

  protocol.handle('stickyfile', (req) => {
    const u = new URL(req.url);
    const p = store.attachmentPath(decodeURIComponent(u.pathname.replace(/^\/+/, '')));
    if (!p || !fs.existsSync(p)) return new Response('Not found', { status: 404 });
    return net.fetch(pathToFileURL(p).toString());
  });

  const ses = session.defaultSession;
  const allowed = (perm, details) => {
    if (perm === 'clipboard-sanitized-write') return true;
    if (perm === 'media') return !details || !details.mediaTypes || details.mediaTypes.every((t) => t === 'audio');
    return false;
  };
  ses.setPermissionRequestHandler((wc, perm, cb, details) => cb(allowed(perm, details)));
  ses.setPermissionCheckHandler((wc, perm) => perm === 'media' || perm === 'clipboard-sanitized-write');
  spellLanguages();

  registerIpc();

  if (!store.settings.firstRunDone) {
    store.settings.firstRunDone = true;
    store.saveSettings();
    if (store.all().length === 0) {
      store.create({ title: 'Hi there! 👋', html: WELCOME_HTML, text: 'Welcome to CosmoNotes ✨', open: true, color: 'yellow', font: 'hand' });
    }
  }
  syncLoginItem();
  buildTray();

  const atLogin = process.argv.includes('--startup');
  const toOpen = store.all().filter((n) => n.open && !n.deletedAt);
  for (const n of toOpen) openNoteWindow(n, { focus: false });
  if (!atLogin && toOpen.length === 0) showList();

  store.backupIfNeeded();
  setInterval(() => store.backupIfNeeded(), 3 * 3600e3);
  setInterval(enforcePinned, 2500);
  screen.on('display-removed', () => setTimeout(refitAll, 800));
  screen.on('display-metrics-changed', () => setTimeout(refitAll, 800));
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!store) return;
    bringToFront();
    showList();
  });
  app.whenReady().then(start);
  // Keep running in the tray when every window is closed.
  app.on('window-all-closed', () => {});
  app.on('before-quit', () => {
    quitting = true;
    if (listWin && !listWin.isDestroyed()) {
      try { store.settings.listBounds = listWin.getBounds(); store.saveSettings(); } catch { /* ignore */ }
    }
  });
  app.on('will-quit', () => { if (store) store.flush(); });
}
