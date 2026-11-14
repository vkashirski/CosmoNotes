'use strict';
const { ipcMain, shell } = require('electron');
const { FONTS, CHECK_OPTS, OVERRIDE_KEYS, cleanColors, FX_EFFECTS, FX_FOLLOWERS, FX_AMOUNTS, cleanFxOpacity, resetPatch } = require('../store');
const EVENING = require('../src/evening');
const { PAPER } = require('./constants');
const { broadcastSettings, spellLanguages } = require('./settings');
const { notifyList } = require('./list-notify');
const { LIST_THEMES, paintListFrame } = require('./list-window');
const { buildTray, setStartup } = require('./tray');
const { pushLook } = require('./list-visibility');
const { applyClickThroughAll } = require('./note-state');
const { pushEvening } = require('./evening');
const { panicNow, pauseShortcut, syncShortcut, validKey } = require('./panic');
const { S } = require('./state');

function registerSettingsIpc() {
  ipcMain.handle('settings:set', (e, patch) => {
    patch = patch || {};
    if ('startWithWindows' in patch) setStartup(patch.startWithWindows);
    // 1.1.15: new notes pick at random from a list of colours. The old single colour (or "random") still works.
    let colors = null;
    if (Array.isArray(patch.defaultColors)) colors = patch.defaultColors;
    else if (patch.defaultColor === 'random') colors = ['yellow', 'pink', 'green', 'blue', 'purple', 'orange', 'mint'];
    else if (typeof patch.defaultColor === 'string' && PAPER[patch.defaultColor]) colors = [patch.defaultColor];
    if (colors) {
      S.store.settings.defaultColors = cleanColors(colors.filter((c) => PAPER[c]), S.store.settings.defaultColors?.[0]);
      S.store.settings.defaultColor = S.store.settings.defaultColors[0];
    }
    if (['s', 'm', 'l', 'xl', 'xxl'].includes(patch.listSize)) S.store.settings.listSize = patch.listSize;
    if (LIST_THEMES[patch.listTheme]) { S.store.settings.listTheme = patch.listTheme; paintListFrame(); }
    if (FONTS.includes(patch.defaultFont)) S.store.settings.defaultFont = patch.defaultFont;
    if (Number.isFinite(Number(patch.defaultOpacity)) && patch.defaultOpacity !== null && patch.defaultOpacity !== '') {
      S.store.settings.defaultOpacity = Math.min(1, Math.max(0.25, Math.round(Number(patch.defaultOpacity) * 20) / 20));
    }
    if ('defaultSolidOnHover' in patch) S.store.settings.defaultSolidOnHover = !!patch.defaultSolidOnHover;
    if ('newColorNoRepeat' in patch) S.store.settings.newColorNoRepeat = !!patch.newColorNoRepeat;
    // 1.1.16: effects for all notes
    let fxChanged = false;
    if (patch.fxEffect === 'none' || FX_EFFECTS.includes(patch.fxEffect)) { S.store.settings.fxEffect = patch.fxEffect; fxChanged = true; }
    if (patch.fxFollower === 'none' || FX_FOLLOWERS.includes(patch.fxFollower)) { S.store.settings.fxFollower = patch.fxFollower; fxChanged = true; }
    if (FX_AMOUNTS.includes(patch.fxEffectAmount)) { S.store.settings.fxEffectAmount = patch.fxEffectAmount; fxChanged = true; }
    if (FX_AMOUNTS.includes(patch.fxFollowerAmount)) { S.store.settings.fxFollowerAmount = patch.fxFollowerAmount; fxChanged = true; }
    // 1.1.17: opacity of the background / the mouse follower (10 % – 100 %)
    for (const k of ['fxEffectOpacity', 'fxFollowerOpacity']) {
      const v = cleanFxOpacity(patch[k]);
      if (v !== null) { S.store.settings[k] = v; fxChanged = true; }
    }
    if ('fxForceAll' in patch) { S.store.settings.fxForceAll = !!patch.fxForceAll; fxChanged = true; }
    if ('fxInteract' in patch) { S.store.settings.fxInteract = !!patch.fxInteract; fxChanged = true; } // 1.1.21
    if ('fxPaused' in patch) { S.store.settings.fxPaused = !!patch.fxPaused; fxChanged = true; buildTray(); }
    if ('spellCheck' in patch) S.store.settings.spellCheck = !!patch.spellCheck;
    if ('spellCyrillic' in patch) { S.store.settings.spellCyrillic = !!patch.spellCyrillic; spellLanguages(); }
    // 1.3.19: Settings → Checklists
    const checkKeys = Object.values(CHECK_OPTS).filter((k) => k in patch);
    for (const k of checkKeys) S.store.settings[k] = !!patch[k];
    // 1.3.27: evening colours (src/evening.js) and the panic button (main/panic.js)
    let eveChanged = false;
    if ('eveOn' in patch) { S.store.settings.eveOn = !!patch.eveOn; eveChanged = true; }
    for (const k of ['eveFrom', 'eveTo']) {
      const v = EVENING.cleanTime(patch[k], null);
      if (v !== null) { S.store.settings[k] = v; eveChanged = true; }
    }
    let panicChanged = false;
    if ('panicOn' in patch) { S.store.settings.panicOn = !!patch.panicOn; panicChanged = true; }
    if (typeof patch.panicKey === 'string' && (patch.panicKey === '' || validKey(patch.panicKey))) { S.store.settings.panicKey = patch.panicKey; panicChanged = true; }
    // 1.3.34: the click-through button (off: every click-through note takes the mouse again; each keeps its choice)
    const ctChanged = 'clickThroughOn' in patch;
    if (ctChanged) S.store.settings.clickThroughOn = !!patch.clickThroughOn;
    if ('updateCheck' in patch) S.store.settings.updateCheck = !!patch.updateCheck; // 1.4.0: main/ipc-update.js
    if (patch.listSort && typeof patch.listSort === 'object') {
      const ls = { ...S.store.settings.listSort };
      if (['updated', 'created'].includes(patch.listSort.by)) ls.by = patch.listSort.by;
      if (['desc', 'asc'].includes(patch.listSort.dir)) ls.dir = patch.listSort.dir;
      if (['mixed', 'first', 'last'].includes(patch.listSort.groups)) ls.groups = patch.listSort.groups;
      S.store.settings.listSort = ls;
    }
    S.store.saveSettings();
    if (panicChanged) { syncShortcut(); buildTray(); }
    if (eveChanged) pushEvening(true);
    if (ctChanged) applyClickThroughAll();
    if ('spellCheck' in patch || 'spellCyrillic' in patch || 'listTheme' in patch || fxChanged || checkKeys.length || eveChanged || panicChanged || ctChanged) broadcastSettings();
    // The list already shows a new sort order itself; telling it again made it redraw twice.
    const onlySort = Object.keys(patch).every((k) => k === 'listSort' || k === 'listSize' || k === 'listTheme');
    if (!onlySort) notifyList();
    return true;
  });

  // 1.3.27: Settings → "Use on all notes" (one setting) or "Reset notes…" (several): every note (not in the Bin) with its own
  // value of these gets the one in Settings (store.js OVERRIDES says what that means for each). Open windows change at once.
  ipcMain.handle('settings:reapply', (e, keys = []) => {
    keys = [].concat(keys).filter((k) => OVERRIDE_KEYS.includes(k));
    let count = 0;
    for (const n of S.store.all()) {
      if (n.deletedAt) continue;
      const patch = resetPatch(n, S.store.settings, keys);
      if (!Object.keys(patch).length) continue;
      S.store.update(n.id, patch); // not an edit: "last edited" stays the same
      pushLook(n.id);
      count++;
    }
    if (count) notifyList();
    return count;
  });
  // 1.3.27: the panic button (a note's top bar), and Settings waiting for a new shortcut (the old one must not fire meanwhile)
  ipcMain.handle('panic:now', () => panicNow());
  ipcMain.handle('panic:capture', (e, on) => { pauseShortcut(on); notifyList(); });

  ipcMain.handle('backups:list', () => S.store.listBackups());
  ipcMain.handle('backups:now', () => { S.store.backupNow(); return S.store.listBackups(); });
  ipcMain.handle('backups:restore', async (e, name) => {
    const count = S.store.restoreBackup(name);
    notifyList();
    return count;
  });
  ipcMain.handle('backups:open-folder', () => shell.openPath(S.store.backupDir));
  ipcMain.handle('data:open-folder', () => shell.openPath(S.store.root));
}

module.exports = { registerSettingsIpc };
