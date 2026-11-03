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
const { buildTray, syncLoginItem } = require('./main/tray');
const { registerIpc } = require('./main/ipc');
const { S } = require('./main/state');
const { attachmentBytes, clearOpenCopies, install: installCrypt, mimeOf } = require('./main/crypt');

protocol.registerSchemesAsPrivileged([
  { scheme: 'stickyfile', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } },
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

  const atLogin = process.argv.includes('--startup');
  const toOpen = S.store.all().filter((n) => n.open && !n.deletedAt);
  for (const n of toOpen) openNoteWindow(n, { focus: false });
  if (!atLogin && toOpen.length === 0) showList();

  S.store.backupIfNeeded();
  setInterval(() => S.store.backupIfNeeded(), 3 * 3600e3);
  setInterval(enforcePinned, 2500);
  screen.on('display-removed', () => setTimeout(refitAll, 800));
  screen.on('display-metrics-changed', () => setTimeout(refitAll, 800));
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!S.store) return;
    bringToFront();
    showList();
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
  app.on('will-quit', () => { if (S.store) S.store.flush(); clearOpenCopies(); }); // 1.1.31: no plain photo copies left in temp
}