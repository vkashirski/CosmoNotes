'use strict';
const { BrowserWindow, Menu, shell } = require('electron');
const { BAR_FRAMES, inkBarOptions } = require('./ink-geometry');

// addItems (a note window, 1.4.11): () => the Add panel's items [{ act, label }], or null while the note's words don't show.
// 1.4.18: a note window shows the text's right-click menu itself, in the app's look (src/note/menus-voice-ink.js
// showMenu): main sends its lines (note:ctx, ids only) and does the one picked (note:ctx-act → runCtx), since only main
// can paste and fix a misspelt word. Other windows (the list, a note's windows outside it) keep Windows' menu.
const ctxActs = new WeakMap(); // webContents -> { id: what it does } for the menu it shows now
function hardenContents(wc, { inkBarFor = null, addItems = null } = {}) {
  wc.setWindowOpenHandler(({ url, frameName }) => {
    // 1.1.15: a note may open one empty little window for its drawing toolbar (see "drawing toolbar outside")
    // 1.1.16: and one for its text toolbar
    if (inkBarFor && url === 'about:blank' && BAR_FRAMES[frameName]) {
      return { action: 'allow', overrideBrowserWindowOptions: inkBarOptions(inkBarFor, BAR_FRAMES[frameName]) };
    }
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
    // 1.4.11: in a note's text (its editor, not a box like the title's), Add ▸ the Add panel's items
    const add = addItems && p.isEditable && p.formControlType === 'none' ? addItems() : null;
    if (add && add.length) {
      if (tpl.length) tpl.push({ type: 'separator' });
      tpl.push({ label: 'Add', submenu: add.map((it) => ({ label: it.label, click: () => { if (!wc.isDestroyed()) wc.send('note:add', it.act); } })) });
    }
    if (!tpl.length) return;
    if (!addItems) { Menu.buildFromTemplate(tpl).popup({ window: BrowserWindow.fromWebContents(wc) }); return; }
    // a note: the same lines, by id, to its own menu
    const acts = {};
    let n = 0;
    const lines = (list) => list.map((it) => {
      if (it.type === 'separator') return '-';
      if (it.submenu) return { id: `sub${n++}`, label: it.label, sub: lines(it.submenu) };
      const id = `m${n++}`;
      acts[id] = it.click || (() => { if (!wc.isDestroyed() && typeof wc[it.role] === 'function') wc[it.role](); });
      return { id, label: it.label, ...(it.enabled === false ? { enabled: false } : {}) };
    });
    const items = lines(tpl);
    ctxActs.set(wc, acts);
    wc.send('note:ctx', { x: p.x, y: p.y, items });
  });
}
// 1.4.18: a line picked in a note's own right-click menu (only one of the menu it was sent last)
function runCtx(wc, id) {
  const acts = ctxActs.get(wc);
  if (!acts || typeof id !== 'string' || !Object.prototype.hasOwnProperty.call(acts, id)) return;
  ctxActs.delete(wc);
  acts[id]();
}

function openExternal(url) {
  try {
    const u = new URL(url);
    if (['http:', 'https:', 'mailto:'].includes(u.protocol)) shell.openExternal(u.toString());
  } catch { /* not a url */ }
}
module.exports = { hardenContents, openExternal, runCtx };
