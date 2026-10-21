'use strict';
const {
  app, BrowserWindow, ipcMain, screen, Tray, Menu, nativeImage, shell, dialog, protocol, net, session,
} = require('electron');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');
const { Store } = require('./store');

const PAPER = {
  yellow: '#FFF4A3', pink: '#FFD6E6', green: '#D8F5C4', blue: '#D2ECFF',
  purple: '#E8DDFF', orange: '#FFDFBF', mint: '#CDF3E8', charcoal: '#3A3940',
};
const ROLLED_H = 34;
const MIN_W = 180;
const MIN_H = 120;
const DEFAULT_W = 300;
const DEFAULT_H = 300;
const BIG = 16384;
const ASSETS = path.join(__dirname, 'assets');
const WIN_ICON = path.join(ASSETS, process.platform === 'win32' ? 'icon.ico' : 'icon.png');
const PRELOAD = path.join(__dirname, 'preload.js');
const EDITABLE = ['html', 'text', 'firstImage', 'color', 'font', 'size', 'opacity', 'solidOnHover', 'pinned', 'rolled'];
const ATT_EXT = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'webm', 'ogg', 'mp3', 'm4a', 'wav'];

const WELCOME_HTML =
  '<div><b>Hi there! 👋</b></div>' +
  '<div>Welcome to your sticky notes.</div>' +
  '<ul class="checklist">' +
  '<li class="done">Open the app</li>' +
  '<li>Click the pin at the top to keep a note above other windows</li>' +
  '<li>Click ⋯ for colours, fonts and see-through</li>' +
  '<li>Click <b>Add</b> at the bottom for photos, voice, drawings and more</li>' +
  '</ul>' +
  '<div>Everything saves on this computer, instantly. ✨</div>';

protocol.registerSchemesAsPrivileged([
  { scheme: 'stickyfile', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } },
]);
app.setAppUserModelId('com.stickypins.app');

let store = null;
let tray = null;
let listWin = null;
let quitting = false;
const wins = new Map(); // note id -> BrowserWindow

// ------------------------------------------------------------------ helpers
const titleOf = (n) => {
  const line = (n.text || '').split('\n').map((s) => s.trim()).find(Boolean);
  return line ? line.slice(0, 60) : 'Sticky note';
};

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
  win.setTitle(titleOf(n));
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
  if (n.rolled) win.setMaximumSize(BIG, ROLLED_H);
  win.noteId = n.id;
  win.focusOnLoad = focus;
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

function createNote({ near } = {}) {
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
  const n = store.create({ open: true, bounds });
  openNoteWindow(n, { focus: true });
  notifyList();
  return n;
}

function bringToFront() {
  for (const win of wins.values()) {
    if (win.isDestroyed()) continue;
    if (win.isMinimized()) win.restore();
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
    title: 'Sticky Pins',
    icon: WIN_ICON,
    show: false,
    backgroundColor: '#FBF6EC',
    titleBarStyle: 'hidden',
    titleBarOverlay: { color: '#FBF6EC', symbolColor: '#6B5A3E', height: 44 },
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
  listWin.on('closed', () => { listWin = null; });
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
    tray.setToolTip('Sticky Pins');
    tray.on('click', showList);
  }
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'New note', click: () => createNote() },
    { label: 'All notes', click: showList },
    { label: 'Bring notes to front', click: bringToFront },
    { type: 'separator' },
    { label: 'Start with Windows', type: 'checkbox', checked: !!store.settings.startWithWindows, click: (mi) => setStartup(mi.checked) },
    { type: 'separator' },
    { label: 'Quit Sticky Pins', click: () => { quitting = true; app.quit(); } },
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
  const contentChanged = 'html' in clean && clean.html !== note.html;
  const rolledChanged = 'rolled' in clean && !!clean.rolled !== note.rolled;
  store.update(note.id, clean, { content: contentChanged });
  const n = store.get(note.id);
  if ('opacity' in clean || 'pinned' in clean || 'color' in clean || 'text' in clean) applyState(win, n);
  if (rolledChanged) setRolled(win, n);
  notifyList();
  return n;
}

function registerIpc() {
  ipcMain.handle('note:get', (e) => {
    const { win, note } = senderNote(e);
    if (!note) return null;
    return { ...note, focusEditor: !!win.focusOnLoad };
  });
  ipcMain.handle('note:update', (e, patch) => applyPatch(e, patch));
  ipcMain.on('note:update-sync', (e, patch) => {
    try { applyPatch(e, patch); const { note } = senderNote(e); if (note) store.writeNow(note.id); } catch (err) { console.error(err); }
    e.returnValue = true;
  });
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
  ipcMain.handle('list:get', () => ({
    notes: store.all().map((n) => ({
      id: n.id,
      text: n.text.slice(0, 600),
      firstImage: n.firstImage,
      color: n.color,
      font: n.font,
      pinned: n.pinned,
      open: wins.has(n.id),
      createdAt: n.createdAt,
      updatedAt: n.updatedAt,
      deletedAt: n.deletedAt,
      restoredFrom: n.restoredFrom,
    })),
    settings: { ...store.settings, dataPath: store.root, version: app.getVersion() },
  }));
  ipcMain.handle('list:new', () => { createNote(); });
  ipcMain.handle('list:open-note', (e, id) => {
    const n = store.get(id);
    if (!n || n.deletedAt) return;
    n.open = true;
    store.save(n.id);
    openNoteWindow(n, { focus: true });
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
  ipcMain.handle('list:destroy', async (e, id) => {
    const r = await dialog.showMessageBox(listWin, {
      type: 'warning', buttons: ['Delete forever', 'Cancel'], defaultId: 1, cancelId: 1,
      message: 'Delete this note forever?', detail: 'You won\'t be able to get it back from the bin.',
    });
    if (r.response !== 0) return false;
    store.destroy(id);
    notifyList();
    return true;
  });
  ipcMain.handle('list:empty-bin', async () => {
    const binned = store.all().filter((n) => n.deletedAt);
    if (!binned.length) return false;
    const r = await dialog.showMessageBox(listWin, {
      type: 'warning', buttons: ['Empty bin', 'Cancel'], defaultId: 1, cancelId: 1,
      message: `Delete ${binned.length} note${binned.length > 1 ? 's' : ''} forever?`,
      detail: 'Your daily backups still keep a copy for up to 30 days.',
    });
    if (r.response !== 0) return false;
    for (const n of binned) store.destroy(n.id);
    notifyList();
    return true;
  });
  ipcMain.handle('list:bring-front', () => bringToFront());

  ipcMain.handle('settings:set', (e, patch) => {
    patch = patch || {};
    if ('startWithWindows' in patch) setStartup(patch.startWithWindows);
    if (typeof patch.defaultColor === 'string' && PAPER[patch.defaultColor]) store.settings.defaultColor = patch.defaultColor;
    if (patch.defaultFont === 'hand' || patch.defaultFont === 'round') store.settings.defaultFont = patch.defaultFont;
    store.saveSettings();
    notifyList();
    return store.settings;
  });

  ipcMain.handle('backups:list', () => store.listBackups());
  ipcMain.handle('backups:now', () => { store.backupNow(); return store.listBackups(); });
  ipcMain.handle('backups:restore', async (e, name) => {
    const r = await dialog.showMessageBox(listWin, {
      type: 'question', buttons: ['Restore', 'Cancel'], defaultId: 0, cancelId: 1,
      message: 'Bring back notes from this backup?',
      detail: 'Nothing you have now is changed or removed. Notes from the backup that are different from your current ones are added to your list as extra notes.',
    });
    if (r.response !== 0) return null;
    const count = store.restoreBackup(name);
    notifyList();
    await dialog.showMessageBox(listWin, {
      type: 'info', buttons: ['OK'],
      message: count ? `Brought back ${count} note${count > 1 ? 's' : ''}.` : 'Nothing to bring back.',
      detail: count ? 'They are in your notes list, marked "restored".' : 'Every note in that backup matches what you already have.',
    });
    return count;
  });
  ipcMain.handle('backups:open-folder', () => shell.openPath(store.backupDir));
  ipcMain.handle('data:open-folder', () => shell.openPath(store.root));
}

// ------------------------------------------------------------------ app lifecycle
function start() {
  Menu.setApplicationMenu(null);
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

  registerIpc();

  if (!store.settings.firstRunDone) {
    store.settings.firstRunDone = true;
    store.saveSettings();
    if (store.all().length === 0) {
      store.create({ html: WELCOME_HTML, text: 'Hi there! 👋\nWelcome to your sticky notes.', open: true, color: 'yellow', font: 'hand' });
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
