'use strict';
const { ipcMain, shell } = require('electron');
const { FONTS, cleanColors, FX_EFFECTS, FX_FOLLOWERS, FX_AMOUNTS, cleanFxOpacity } = require('../store');
const { PAPER } = require('./constants');
const { broadcastSettings, spellLanguages } = require('./settings');
const { notifyList } = require('./list-notify');
const { LIST_THEMES, paintListFrame } = require('./list-window');
const { buildTray, setStartup } = require('./tray');
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
    if (patch.listSort && typeof patch.listSort === 'object') {
      const ls = { ...S.store.settings.listSort };
      if (['updated', 'created'].includes(patch.listSort.by)) ls.by = patch.listSort.by;
      if (['desc', 'asc'].includes(patch.listSort.dir)) ls.dir = patch.listSort.dir;
      if (['mixed', 'first', 'last'].includes(patch.listSort.groups)) ls.groups = patch.listSort.groups;
      S.store.settings.listSort = ls;
    }
    S.store.saveSettings();
    if ('spellCheck' in patch || 'spellCyrillic' in patch || 'listTheme' in patch || fxChanged) broadcastSettings();
    // The list already shows a new sort order itself; telling it again made it redraw twice.
    const onlySort = Object.keys(patch).every((k) => k === 'listSort' || k === 'listSize' || k === 'listTheme');
    if (!onlySort) notifyList();
    return true;
  });

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
