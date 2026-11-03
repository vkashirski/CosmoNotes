'use strict';
const { BrowserWindow, Menu, shell } = require('electron');
const { BAR_FRAMES, inkBarOptions } = require('./ink-geometry');

function hardenContents(wc, { inkBarFor = null } = {}) {
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
    if (tpl.length) Menu.buildFromTemplate(tpl).popup({ window: BrowserWindow.fromWebContents(wc) });
  });
}

function openExternal(url) {
  try {
    const u = new URL(url);
    if (['http:', 'https:', 'mailto:'].includes(u.protocol)) shell.openExternal(u.toString());
  } catch { /* not a url */ }
}
module.exports = { hardenContents, openExternal };
