'use strict';
// CosmoNotes "All notes" window, part 7 of 7: the buttons, search, keys and mouse of the window, and the first load
// (src/list.js until 1.1.28; the parts load in order from list.html. How they share names: ai-context/splitting-code.md)
(() => {
  const K = window.COSMO_LIST_KIT;
  const { V, S, $, $$, SIZES, SIZE_NAMES, sizeNow, ICON, cardsTabNow, sel, load, groupById, sortPrefs, render,
    dropTarget, canMove, moveInto, visibleKeys, clearSel, paintCards, bulkTrash, renderSettings, renderBackups,
    pickBackup, modal, toast, hideCtx, closeFxSheet, closeEdit, emptyBin, NEW_INPUTS, checkNew, savedLock, closePanel,
    showKeyIfNeeded } = K;
  // ================================================================ events
  // Settings is a toggle: clicking it while it's open goes back to Notes or Bin, whichever was open before
  function setTab(v) {
    if (v === 'settings' && V.tab === 'settings') v = V.lastTab;
    if (v !== 'settings') V.lastTab = v;
    V.tab = v;
    render(true);
  }
  $$('.tab').forEach((t) => t.addEventListener('click', () => setTab(t.dataset.tab)));
  // inside a group, a new note is made right there
  const newNote = () => S.list.newNote(V.tab === 'notes' ? V.openGroup || null : null);
  $('#btnNew').addEventListener('click', newNote);
  $('#btnFront').addEventListener('click', () => S.list.bringToFront());
  $('#q').addEventListener('input', (e) => { V.query = e.target.value; render(); });
  const clearSearch = () => { V.query = ''; $('#q').value = ''; };
  $('#qClear').addEventListener('click', () => { clearSearch(); render(); $('#q').focus(); });
  // the Bin has its own search, working the same way
  $('#bq').addEventListener('input', (e) => { V.binQuery = e.target.value; render(); });
  const clearBinSearch = () => { V.binQuery = ''; $('#bq').value = ''; };
  $('#bqClear').addEventListener('click', () => { clearBinSearch(); render(); $('#bq').focus(); });
  $('#btnEmpty').addEventListener('click', emptyBin);

  // inside a group: up one level / drop to move up
  const upLevel = () => (V.openGroup ? (groupById(V.openGroup)?.parentId || null) : null);
  $('#btnBack').addEventListener('click', () => { V.openGroup = upLevel(); clearSearch(); closePanel(); render(true); });
  // the back button (left of the group's name) is where to drop a note or group to move it up a level
  dropTarget($('#btnBack'), () => !!V.openGroup && canMove(V.drag, upLevel()), (d) => moveInto(d, upLevel()), () => 'Move up');
  let nameTimer = null;
  $('#groupName').addEventListener('input', (e) => {
    const id = V.openGroup;
    const name = e.target.value;
    const g = groupById(id);
    if (g) g.name = name;
    clearTimeout(nameTimer);
    nameTimer = setTimeout(() => S.groups.rename(id, name), 300);
  });
  $('#groupName').addEventListener('keydown', (e) => { if (e.key === 'Enter') e.target.blur(); });

  // card size menu
  $('#btnSize').addEventListener('click', (e) => {
    e.stopPropagation();
    const pop = $('#sizePop');
    pop.hidden = !pop.hidden;
    $('#sortPop').hidden = true; $('#btnSort').classList.remove('on');
    $('#btnSize').classList.toggle('on', !pop.hidden);
    paintSize();
  });
  function paintSize() {
    const v = sizeNow();
    $$('#sizeSeg button').forEach((b) => b.classList.toggle('on', b.dataset.v === v));
  }
  function setSize(v, animate = true) {
    if (sizeNow() === v) return;
    V.state.settings.listSize = v;
    paintSize();
    render(animate);
    S.settings.set({ listSize: v });
  }
  $$('#sizeSeg button').forEach((b) => b.addEventListener('click', () => setSize(b.dataset.v)));
  // Ctrl + mouse wheel: bigger (wheel up) or smaller (wheel down), one size per notch.
  // Touchpads send many tiny steps, so they are added up first.
  // 1.1.43: only over the title bar, the tabs, Notes and the Bin, not the whole window: a wheel listener that can stop
  // scrolling makes Chromium wait for this page before every scroll there, and Settings has no card sizes.
  // (Electron never zooms the page on Ctrl + wheel by itself, so Settings needs no listener.)
  let wheelSum = 0;
  let wheelAt = 0;
  const onSizeWheel = (e) => {
    if (!e.ctrlKey) return;
    e.preventDefault(); // no page zoom
    if (V.tab === 'settings' || !$('#modal').hidden) return;
    const now = Date.now();
    if (now - wheelAt > 400) wheelSum = 0;
    wheelSum += e.deltaY;
    if (Math.abs(wheelSum) < 60 || now - wheelAt < 140) return;
    wheelAt = now;
    const i = SIZES.indexOf(sizeNow());
    const next = SIZES[Math.max(0, Math.min(SIZES.length - 1, i + (wheelSum < 0 ? 1 : -1)))];
    wheelSum = 0;
    if (next === sizeNow()) return;
    setSize(next, false);
    toast(`Card size: ${SIZE_NAMES[next]}`);
  };
  for (const el of [$('.titlebar'), $('.tabs'), $('#viewNotes'), $('#viewBin')]) el.addEventListener('wheel', onSizeWheel, { passive: false });

  // 1.1.43: while a view scrolls it gets .scrolling (until 150 ms after the last step): what's inside then ignores the
  // mouse (list-base.css), so nothing under the mouse has to redraw its hover look on the way past.
  for (const view of $$('.view')) {
    let still = null;
    view.addEventListener('scroll', () => {
      if (!still) view.classList.add('scrolling'); else clearTimeout(still);
      still = setTimeout(() => { still = null; view.classList.remove('scrolling'); }, 150);
    }, { passive: true });
  }

  // sort menu
  $('#btnSort').addEventListener('click', (e) => {
    e.stopPropagation();
    const pop = $('#sortPop');
    pop.hidden = !pop.hidden;
    $('#sizePop').hidden = true; $('#btnSize').classList.remove('on');
    $('#btnSort').classList.toggle('on', !pop.hidden);
    paintSort();
  });
  function paintSort() {
    const p = sortPrefs();
    $$('#sortPop .seg').forEach((seg) => seg.querySelectorAll('button').forEach((b) => b.classList.toggle('on', p[seg.dataset.key] === b.dataset.v)));
  }
  $$('#sortPop .seg button').forEach((b) => b.addEventListener('click', () => {
    const key = b.parentElement.dataset.key;
    if (sortPrefs()[key] === b.dataset.v) return;
    V.state.settings.listSort = { ...sortPrefs(), [key]: b.dataset.v };
    paintSort();
    render(true);
    S.settings.set({ listSort: V.state.settings.listSort });
  }));
  document.addEventListener('mousedown', (e) => {
    if (!e.target.closest('#sortPop, #btnSort')) { $('#sortPop').hidden = true; $('#btnSort').classList.remove('on'); }
    if (!e.target.closest('#sizePop, #btnSize')) { $('#sizePop').hidden = true; $('#btnSize').classList.remove('on'); }
  });

  // settings
  $('#sStartup').addEventListener('change', (e) => S.settings.set({ startWithWindows: e.target.checked }));
  $('#sSpell').addEventListener('change', (e) => S.settings.set({ spellCheck: e.target.checked }));
  $('#sCyr').addEventListener('change', (e) => S.settings.set({ spellCyrillic: e.target.checked }));
  $$('#sFont button').forEach((b) => b.addEventListener('click', () => S.settings.set({ defaultFont: b.dataset.font })));
  // see-through for new notes: shown while dragging, saved when let go
  $('#sOpacity').addEventListener('input', (e) => { $('#sOpVal').textContent = `${e.target.value}%`; });
  $('#sOpacity').addEventListener('change', (e) => { V.state.settings.defaultOpacity = Number(e.target.value) / 100; S.settings.set({ defaultOpacity: Number(e.target.value) / 100 }); });
  $('#sSolidHover').addEventListener('change', (e) => S.settings.set({ defaultSolidOnHover: e.target.checked }));
  $('#sNoRepeat').addEventListener('change', (e) => S.settings.set({ newColorNoRepeat: e.target.checked }));
  // password or PIN: set / change in an app-styled pop-up
  $('#pwSave').addEventListener('click', async () => {
    const has = !!V.state.settings.hasPassword;
    const pinNow = V.state.settings.lockKind === 'pin';
    const inputs = has ? [{ placeholder: pinNow ? 'Current PIN' : 'Current password', pin: pinNow }, ...NEW_INPUTS] : NEW_INPUTS;
    let saved = null;
    const r = await modal({
      title: has ? `Change your ${pinNow ? 'PIN' : 'password'}` : 'Set a password or PIN',
      text: 'One for all your locked notes and groups. A PIN opens as soon as you type it.',
      tip: 'Locked notes are encrypted with it. A password, or a PIN of 8+ digits, is safest.',
      kindPick: has ? (pinNow ? 'pin' : 'password') : 'pin',
      inputs,
      icon: ICON.lock,
      okLabel: 'Save',
      check: async (v, kind) => {
        const [cur, a, b] = has ? v : ['', v[0], v[1]];
        const bad = checkNew(a, b, kind);
        if (bad) return bad;
        const res = await S.setPassword(cur, a, kind);
        if (!savedLock(res, kind)) return (res && res.error) || 'Could not save it.';
        saved = kind;
        return null;
      },
    });
    if (r) { toast(`${saved === 'pin' ? 'PIN' : 'Password'} saved ✓`); renderSettings(); showKeyIfNeeded(true); } // the first one: the recovery key
  });
  $('#btnBackupNow').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    btn.disabled = true;
    renderBackups(await S.backups.now());
    btn.textContent = 'Backed up ✓';
    setTimeout(() => { btn.textContent = 'Back up now'; btn.disabled = false; }, 1800);
  });
  $('#btnBackupFolder').addEventListener('click', () => S.backups.openFolder());
  $('#btnRestorePick').addEventListener('click', pickBackup);
  $('#btnDataFolder').addEventListener('click', () => S.openDataFolder());
  document.addEventListener('keydown', (e) => {
    if (!$('#modal').hidden) { if (e.key === 'Escape' && V.modalDone) V.modalDone(null); return; }
    if (!$('#editSheet').hidden) { if (e.key === 'Escape') { e.preventDefault(); closeEdit(); } return; }
    if (!$('#fxSheet').hidden) { if (e.key === 'Escape') { e.preventDefault(); closeFxSheet(); } return; }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n') { e.preventDefault(); newNote(); }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
      e.preventDefault();
      if (V.tab === 'settings') setTab('notes');
      $(V.tab === 'bin' ? '#bq' : '#q').focus();
    }
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName || '');
    const cardsTab = cardsTabNow();
    // Ctrl+A picks every card shown; Delete moves the picked ones to the Bin (Shift+Delete: no question)
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a' && cardsTab && !typing) {
      e.preventDefault();
      visibleKeys().forEach((k) => sel.add(k));
      paintCards();
    }
    if (e.key === 'Delete' && sel.size && cardsTab && !typing) { e.preventDefault(); bulkTrash(e.shiftKey); }
    if (e.key === 'Escape') {
      if (!$('#ctx').hidden) hideCtx();
      else if (sel.size && cardsTab) clearSel();
      else if (!$('#sortPop').hidden) { $('#sortPop').hidden = true; $('#btnSort').classList.remove('on'); }
      else if (!$('#sizePop').hidden) { $('#sizePop').hidden = true; $('#btnSize').classList.remove('on'); }
      else if (V.tab === 'bin' && V.binQuery) { clearBinSearch(); render(); }
      else if (cardsTab && V.query) { clearSearch(); render(); }
      else if (!$('#groupPanel').hidden) closePanel();
      else if (V.tab === 'notes' && V.openGroup && document.activeElement !== $('#groupName')) { V.openGroup = upLevel(); render(true); }
    }
  });
  window.addEventListener('focus', load);
  // clicking empty space between the cards forgets the picked cards
  $('#viewNotes').addEventListener('mousedown', (e) => {
    if (sel.size && e.button === 0 && !e.ctrlKey && !e.metaKey && !e.shiftKey && !e.target.closest('.card, .searchrow, .sortpop, #groupHead, #groupPanel')) clearSel();
  });

  (async () => { V.state = await S.list.get(); V.lastSig = JSON.stringify(V.state); render(true); showKeyIfNeeded(); })(); // 1.1.30: a recovery key waiting to be seen
  Object.assign(K, { newNote, clearSearch });
})();
