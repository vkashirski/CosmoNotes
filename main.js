'use strict';
const { app, screen, Menu, protocol, net, session } = require('electron');
const fs = require('fs');
const { pathToFileURL } = require('url');
const { Store } = require('./store');
const { WELCOME_HTML } = require('./main/constants');
const { migrateOldData } = require('./main/migrate');
const { spellLanguages } = require('./main/settings');
const { bringToFront, enforcePinned, openNoteWindow, refitAll } = require('./main/note-window');
const { showList } = require('./main/list-window');
const { buildTray, comeBack, syncLoginItem } = require('./main/tray');
const { reopenPanicked, stopShortcut, syncShortcut } = require('./main/panic');
const { startEveningClock } = require('./main/evening');
const { registerIpc } = require('./main/ipc');
const { finishUpdate, startUpdates } = require('./main/ipc-update');
const { startReminders } = require('./main/reminders');
const { startBarHover } = require('./main/bar-hover');
const REMIND = require('./src/reminders');
const { S } = require('./main/state');
const { attachmentBytes, clearOpenCopies, install: installCrypt, mimeOf } = require('./main/crypt');
const recordings = require('./main/recordings');

protocol.registerSchemesAsPrivileged([
  { scheme: 'stickyfile', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } },
  // 1.3.1: voice to text. Only the engine window's own session answers it (main/stt-engine.js)
  { scheme: 'cosmomodel', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } },
]);
// Kept from the "Sticky Pins" days so Windows treats CosmoNotes as the same app
// (the installer replaces the old one and "Start with Windows" keeps working).
app.setAppUserModelId('com.stickypins.app');
// Use the built-in spell checker so Cyrillic words can be left alone.
app.commandLine.appendSwitch('disable-features', 'WinUseBrowserSpellChecker');

// ------------------------------------------------------------------ app lifecycle
function start() {
  Menu.setApplicationMenu(null);
  migrateOldData();
  S.store = new Store(app.getPath('userData'));
  installCrypt(); // 1.1.30: locked notes are encrypted on disk (main/crypt.js)
  recordings.recover(); // 1.2.4: voice recordings a crash left behind get their chip back (main/recordings.js)

  protocol.handle('stickyfile', (req) => {
    const u = new URL(req.url);
    const p = S.store.attachmentPath(decodeURIComponent(u.pathname.replace(/^\/+/, '')));
    if (!p || !fs.existsSync(p)) return new Response('Not found', { status: 404 });
    const sealed = attachmentBytes(p); // an encrypted photo / clip: its plain bytes once the PIN was typed
    if (sealed === false) return new Response('Locked', { status: 403 });
    if (sealed) return new Response(sealed, { headers: { 'content-type': mimeOf(p) } });
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

  if (!S.store.settings.firstRunDone) {
    S.store.settings.firstRunDone = true;
    S.store.saveSettings();
    if (S.store.all().length === 0) {
      S.store.create({ title: 'Hi there! 👋', html: WELCOME_HTML, text: 'Welcome to CosmoNotes ✨', open: true, color: 'yellow', font: 'hand' });
    }
  }
  syncLoginItem();
  buildTray();
  syncShortcut(); // 1.3.27: the panic button's shortcut (main/panic.js)
  startEveningClock(); // 1.3.27: evening colours (main/evening.js)
  startUpdates(); // 1.4.0: the update check (main/ipc-update.js)

  const atLogin = process.argv.includes('--startup');
  // 1.4.1: not a note one of its reminders hides until it goes off (main/reminders.js)
  const toOpen = S.store.all().filter((n) => n.open && !n.deletedAt && !REMIND.hiddenNow(n.reminders));
  for (const n of toOpen) openNoteWindow(n, { focus: false });
  const back = reopenPanicked(); // 1.3.27: notes the panic button closed before CosmoNotes quit
  if (!atLogin && toOpen.length === 0 && !back) showList();
  startReminders(); // 1.4.1: what went off while CosmoNotes was closed (main/reminders.js)

  S.store.backupIfNeeded();
  setInterval(() => S.store.backupIfNeeded(), 3 * 3600e3);
  setInterval(enforcePinned, 2500);
  startBarHover(); // 1.4.29: the mouse over a note's top bar (the rename pencil)
  screen.on('display-removed', () => setTimeout(refitAll, 800));
  screen.on('display-metrics-changed', () => setTimeout(refitAll, 800));
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!S.store) return;
    bringToFront();
    comeBack(); // the list, and (1.3.27) the notes the panic button closed
  });
  app.whenReady().then(start);
  // Keep running in the tray when every window is closed.
  app.on('window-all-closed', () => {});
  app.on('before-quit', () => {
    S.quitting = true;
    if (S.listWin && !S.listWin.isDestroyed()) {
      try { S.store.settings.listBounds = S.listWin.getBounds(); S.store.saveSettings(); } catch { /* ignore */ }
    }
  });
  app.on('will-quit', (e) => {
    stopShortcut(); // 1.3.27: Windows gets the panic shortcut back
    if (S.store) { recordings.finishAll(); S.store.flush(); } // 1.2.4: a recording still running is kept
    clearOpenCopies(); // 1.1.31: no plain photo copies left in temp
    finishUpdate(e); // 1.4.0: Install was pressed: the installer starts now, after everything is saved (main/updater.js)
  });
}