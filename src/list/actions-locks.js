'use strict';
// CosmoNotes "All notes" window, part 6 of 7: actions (Bin, delete), passwords and locks, the Locked tab, the group panel, folds, back / forward
// (src/list.js until 1.1.28; the parts load in order from list.html. How they share names: ai-context/splitting-code.md)
(() => {
  const K = window.COSMO_LIST_KIT;
  const { V, S, $, $$, COLORS, COLOR_NAMES, SWATCH, GCOLORS, GNAMES, ICON, navBack, h, plural, swatchStrip, load,
    live, groupById, chainOf, notesInTree, isInside, noteIsLocked, groupIsLocked, LOCKED_NO_DELETE, lockedOnes,
    render, modal, toast } = K;
  // defined in a later part:
  const clearSearch = K.later('clearSearch');
  // ================================================================ actions (with confirmations)
  async function trashNote(n, skipAsk) {
    if (noteIsLocked(n)) { toast(LOCKED_NO_DELETE); return; }
    if (!skipAsk) {
      const ok = await modal({
        title: 'Move this note to the Bin?',
        text: `“${(n.title || (n.locked ? 'Locked note' : (n.text || '').split('\n')[0]) || 'Empty note').slice(0, 60)}” can be restored from the Bin.`,
        tip: 'Tip: Shift+click the bin button to skip this question.',
        okLabel: 'Move to Bin',
        danger: true,
      });
      if (!ok) return;
    }
    const r = await S.list.trash(n.id);
    toast(r && r.error === 'locked' ? LOCKED_NO_DELETE : 'Moved to the Bin');
  }
  async function destroyNote(n, skipAsk) {
    if (noteIsLocked(n)) { toast(LOCKED_NO_DELETE); return; }
    if (!skipAsk) {
      const ok = await modal({
        title: 'Delete this note forever?',
        text: 'It won’t be in the Bin any more. Daily backups keep a copy for 30 days.',
        tip: 'Tip: Shift+click Delete to skip this question.',
        okLabel: 'Delete forever',
        danger: true,
      });
      if (!ok) return;
    }
    const r = await S.list.destroy(n.id);
    if (r && r.error === 'locked') toast(LOCKED_NO_DELETE);
    else if (skipAsk) toast('Deleted forever');
  }
  async function emptyBin() {
    const binned = V.state.notes.filter((n) => n.deletedAt);
    const locked = binned.filter(noteIsLocked).length;
    const count = binned.length - locked;
    if (!count) { if (locked) toast(LOCKED_NO_DELETE); return; }
    const ok = await modal({
      title: `Delete ${plural(count, 'note')} forever?`,
      text: `Daily backups keep a copy for 30 days.${locked ? ` ${plural(locked, 'locked note')} ${locked === 1 ? 'stays' : 'stay'} in the Bin.` : ''}`,
      okLabel: 'Empty bin',
      danger: true,
    });
    if (ok) await S.list.emptyBin();
  }
  async function dissolveGroup(g) {
    const ok = await modal({
      title: `Ungroup “${g.name || 'Group'}”?`,
      text: 'Everything inside moves up one level. No notes are deleted.',
      okLabel: 'Ungroup',
      icon: ICON.ungroup,
    });
    if (!ok) return;
    if (V.openGroup && (V.openGroup === g.id || isInside(V.openGroup, g.id))) V.openGroup = g.parentId || null;
    closePanel();
    await S.groups.dissolve(g.id);
    toast('Ungrouped');
  }
  async function trashGroup(g) {
    if (groupIsLocked(g)) { toast(LOCKED_NO_DELETE); return; }
    const count = notesInTree(g.id).length;
    const ok = await modal({
      title: `Move all ${plural(count, 'note')} in “${g.name || 'Group'}” to the Bin?`,
      text: 'They can be restored from the Bin, and go back into this group when you do.',
      okLabel: 'Move to Bin',
      danger: true,
    });
    if (!ok) return;
    if (V.openGroup && (V.openGroup === g.id || isInside(V.openGroup, g.id))) V.openGroup = g.parentId || null;
    closePanel();
    const r = await S.groups.trash(g.id);
    toast(r && r.error === 'locked' ? LOCKED_NO_DELETE : 'Moved to the Bin');
  }

  // ---------- passwords & locking
  // a new password or PIN: the same rules everywhere (the note window has its own copy)
  const NEW_INPUTS = [
    { kinded: { password: 'New password', pin: 'New PIN (4 to 12 digits)' } },
    { kinded: { password: 'Type it again', pin: 'Type the PIN again' } },
  ];
  function checkNew(a, b, kind) {
    if (kind === 'pin' && (a.length < 4 || a.length > 12)) return 'A PIN is 4 to 12 digits.';
    if (a.length < 4) return 'Use at least 4 characters.';
    if (a !== b) return "The two don't match.";
    return null;
  }
  function savedLock(res, kind) {
    if (!res || !res.ok) return false;
    V.state.settings.hasPassword = true;
    V.state.settings.lockKind = kind;
    return true;
  }
  async function ensurePassword() {
    if (V.state.settings.hasPassword) return true;
    const r = await modal({
      title: 'Choose a password or PIN',
      text: 'One for all your locked notes and groups. You can change it later in Settings.',
      tip: 'Locked notes are encrypted with it. A password, or a PIN of 8+ digits, is safest.',
      kindPick: 'pin',
      inputs: NEW_INPUTS,
      okLabel: 'Save',
      icon: ICON.lock,
      check: async ([a, b], kind) => {
        const bad = checkNew(a, b, kind);
        if (bad) return bad;
        const res = await S.setPassword('', a, kind);
        return savedLock(res, kind) ? null : (res && res.error) || 'Could not save it.';
      },
    });
    if (r) showKeyIfNeeded(true); // the first password: encryption was just set up, here is the recovery key
    return !!r;
  }
  // asks for the password or PIN. A PIN opens by itself as soon as all its digits are typed.
  const askPassword = (title, text, okLabel, fn) => {
    const pin = V.state.settings.lockKind === 'pin';
    return modal({
      title, text: pin ? text.replace(/password/g, 'PIN') : text, okLabel, icon: ICON.lock,
      inputs: [{ placeholder: pin ? 'PIN' : 'Password', pin }],
      pinLen: pin ? V.state.settings.lockLen || 0 : 0,
      check: async ([pw]) => {
        if (!pw) return `Type your ${pin ? 'PIN' : 'password'}.`;
        const res = await fn(pw);
        return res && res.ok ? null : `Wrong ${pin ? 'PIN' : 'password'}`;
      },
    });
  };
  // ---- Locked tab (1.1.15): uncover every locked note and group in this list, or cover them again
  function paintLockBar() {
    const bar = $('#lockBar');
    bar.hidden = V.tab !== 'locks';
    if (bar.hidden) return;
    const all = !!V.state.settings.unlockedAll;
    const pin = V.state.settings.lockKind === 'pin';
    const any = lockedOnes();
    const count = any.notes.length + any.groups.length + any.hidden;
    $('#lockBarText').textContent = all
      ? 'Unlocked until you lock them again or close the list.'
      : `Locked notes hide their words from view and search. Unlock all with your ${pin ? 'PIN' : 'password'} to see them.`;
    $('#btnUnlockAll').innerHTML = `${ICON.unlock}<span>Unlock all…</span>`;
    $('#btnLockAll').innerHTML = `${ICON.lock}<span>Lock again</span>`;
    $('#btnUnlockAll').hidden = all;
    // also covers groups opened with the password, and notes unlocked for now (1.1.47)
    $('#btnLockAll').hidden = !all && !V.state.groups.some((g) => g.locked && g.open) && !V.state.notes.some((n) => n.forNow && !n.deletedAt);
    $('#btnUnlockAll').disabled = !count || !V.state.settings.hasPassword;
  }
  $('#btnUnlockAll').addEventListener('click', async () => {
    const r = await askPassword('Unlock all?', 'Type your password to see and search every locked note. “Lock again” or closing the list hides them again.', 'Unlock all', (pw) => S.list.unlockAll(pw));
    if (r) { await load(); toast('Unlocked in this list'); }
  });
  $('#btnLockAll').addEventListener('click', async () => {
    await S.list.lockAll();
    await load();
    toast('Locked again 🔒');
  });

  async function lockNote(n) {
    if (!(await ensurePassword())) return;
    await S.list.setLocked(n.id, true);
    toast('Note locked 🔒');
  }
  async function unlockNote(n) {
    const r = await askPassword('Remove the lock?', 'Type your password to remove the lock from this note.', 'Remove lock', (pw) => S.list.setLocked(n.id, false, pw));
    if (r) toast('Lock removed');
  }
  // 1.1.47 (the owner's wish): "Unlock…" opens a locked note or group until CosmoNotes restarts. Its lock stays.
  // "Remove lock…" (above) removes it for good.
  async function unlockNoteNow(n) {
    const r = await askPassword('Unlock note?', 'Type your password. It stays unlocked until CosmoNotes restarts.', 'Unlock', (pw) => S.list.unlockNow(n.id, pw));
    if (r) toast('Unlocked until restart');
  }
  async function relockNote(n) {
    await S.list.relock(n.id);
    toast('Locked again 🔒');
  }
  async function unlockGroupNow(g) {
    const r = await askPassword('Unlock group?', `Type your password. “${g.name || 'Group'}” stays unlocked until CosmoNotes restarts.`, 'Unlock', (pw) => S.list.unlockNow(g.id, pw));
    if (r) toast('Unlocked until restart');
  }
  async function relockGroup(g) {
    await S.list.relock(g.id);
    if (V.openGroup && (V.openGroup === g.id || isInside(V.openGroup, g.id))) V.openGroup = g.parentId || null;
    closePanel();
    toast('Locked again 🔒');
  }
  async function lockGroup(g) {
    if (!(await ensurePassword())) return;
    await S.groups.setLocked(g.id, true);
    if (V.openGroup && (V.openGroup === g.id || isInside(V.openGroup, g.id))) V.openGroup = g.parentId || null;
    closePanel();
    toast('Group locked 🔒');
  }
  async function unlockGroup(g) {
    const r = await askPassword('Remove the lock?', `Type your password to remove the lock from “${g.name || 'Group'}”.`, 'Remove lock', (pw) => S.groups.setLocked(g.id, false, pw));
    if (r) toast('Lock removed');
  }
  async function openGroupView(g) {
    if (!g.open) {
      const r = await askPassword('This group is locked', `Type your password to open “${g.name || 'Group'}”.`, 'Open', (pw) => S.groups.reveal(g.id, pw));
      if (!r) return;
      await load();
    }
    if (V.tab !== 'notes') { V.tab = 'notes'; V.lastTab = 'notes'; } // from Favourites or Locked: the group opens in Notes
    V.openGroup = g.id;
    closePanel();
    V.query = '';
    $('#q').value = '';
    render(true);
    $('#viewNotes').scrollTop = 0;
  }

  // ================================================================ group settings panel
  function openPanel() { $('#groupPanel').hidden = false; $('#btnGroupSettings').classList.add('on'); }
  function closePanel() { $('#groupPanel').hidden = true; $('#btnGroupSettings').classList.remove('on'); }
  // which paper colour / font the notes in the group share (shown as selected), given the "inside too" box
  function panelScope(g) {
    return $('#gInner').checked ? notesInTree(g.id) : live().filter((n) => n.groupId === g.id);
  }
  function shared(notes, key) {
    const vals = new Set(notes.map((n) => n[key]));
    return vals.size === 1 ? [...vals][0] : null;
  }
  function paintPanel(g) {
    const scope = panelScope(g);
    const font = shared(scope, 'font');
    const color = shared(scope, 'color');
    $$('#gFont button').forEach((b) => b.classList.toggle('on', b.dataset.font === font));
    $$('#gNoteColors .sw').forEach((b) => b.classList.toggle('on', b.dataset.color === color));
    $('#gMixed').textContent = scope.length && (!font || !color) ? 'Notes inside use different ' + [!color && 'colours', !font && 'fonts'].filter(Boolean).join(' and ') + '.' : '';
    $$('#gStyles button').forEach((b) => b.classList.toggle('on', b.dataset.style === (g.style || 'stack')));
    $('#gStyles').style.setProperty('--gc', GCOLORS[g.color] || GCOLORS.kraft);
    $$('#gColors .sw').forEach((b) => b.classList.toggle('on', b.dataset.gc === (g.color || 'kraft')));
    $('#gLock').innerHTML = (g.locked ? ICON.unlock + 'Remove lock…' : ICON.lock + 'Lock group');
  }
  (function buildPanel() {
    for (const [k, v] of Object.entries(GCOLORS)) {
      $('#gColors').append(h('button', { class: 'sw', 'data-gc': k, title: GNAMES[k], style: `background:${v}`, onclick: () => S.groups.update(V.openGroup, { color: k }) }));
    }
    for (const c of COLORS) {
      $('#gNoteColors').append(h('button', { class: 'sw', 'data-color': c, title: `Make every note ${COLOR_NAMES[c]}`, style: `background:${SWATCH[c]}`, onclick: () => massEdit({ color: c }) }));
    }
    swatchStrip($('#gNoteColors'));
  })();
  async function massEdit(patch) {
    const count = await S.groups.apply(V.openGroup, patch, $('#gInner').checked);
    toast(count ? `Changed ${plural(count, 'note')}` : 'No notes to change');
  }
  $$('#gStyles button').forEach((b) => b.addEventListener('click', () => S.groups.update(V.openGroup, { style: b.dataset.style })));
  $('#gInner').addEventListener('change', () => { const g = groupById(V.openGroup); if (g) paintPanel(g); });
  $$('#gFont button').forEach((b) => b.addEventListener('click', () => massEdit({ font: b.dataset.font })));
  $('#gLock').addEventListener('click', () => { const g = groupById(V.openGroup); if (g) (g.locked ? unlockGroup(g) : lockGroup(g)); });
  $('#gUngroup').addEventListener('click', () => { const g = groupById(V.openGroup); if (g) dissolveGroup(g); });
  $('#gTrash').addEventListener('click', () => { const g = groupById(V.openGroup); if (g) trashGroup(g); });
  $('#btnGroupSettings').addEventListener('click', () => ($('#groupPanel').hidden ? openPanel() : closePanel()));
  $('#btnRelockGroup').addEventListener('click', async () => {
    const chain = chainOf(V.openGroup);
    const outer = [...chain].reverse().find((c) => c.locked);
    if (!outer) return;
    V.openGroup = outer.parentId || null;
    closePanel();
    await S.groups.hide(outer.id);
    toast('Locked again 🔒');
  });

  // ---- Settings: every section folds open and closed by clicking its title (all closed at first)
  (function foldPanels() {
    $$('#viewSettings .panel').forEach((panel) => {
      const head = panel.querySelector(':scope > h3, :scope > .abouthead');
      if (!head) return;
      const inner = h('div', { class: 'pinner' });
      [...panel.children].filter((c) => c !== head).forEach((c) => inner.append(c));
      panel.append(h('div', { class: 'pbody' }, inner));
      head.classList.add('phead');
      head.setAttribute('role', 'button');
      head.setAttribute('aria-expanded', 'false');
      head.tabIndex = 0;
      head.title = 'Click to open or close';
      const toggle = () => { const open = panel.classList.toggle('open'); head.setAttribute('aria-expanded', String(open)); };
      head.addEventListener('mousedown', (e) => e.preventDefault()); // no focus ring after a mouse click
      head.addEventListener('click', toggle);
      head.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } });
    });
  })();

  // ---- mouse back / forward buttons: back to the group level you were on before, and forward again.
  // Levels that no longer exist (ungrouped, emptied, locked again) are skipped.
  const canShow = (gid) => gid === null || (groupById(gid) && groupById(gid).open && notesInTree(gid).length > 0);
  let navAt = 0;
  function navigate(dir) {
    if (!$('#modal').hidden || V.drag) return;
    const now = Date.now();
    if (now - navAt < 250) return; // one click can arrive twice (as a mouse button and as a Windows command)
    navAt = now;
    const from = dir === 'back' ? navBack : V.navFwd;
    const to = dir === 'back' ? V.navFwd : navBack;
    let target;
    do { target = from.pop(); } while (target !== undefined && (target === V.openGroup || !canShow(target)));
    if (target === undefined) return;
    to.push(V.openGroup);
    if (V.tab !== 'notes') { V.tab = 'notes'; V.lastTab = 'notes'; }
    V.openGroup = target;
    clearSearch();
    closePanel();
    V.navigating = true;
    try { render(true); } finally { V.navigating = false; }
    $('#viewNotes').scrollTop = 0;
  }
  window.addEventListener('mouseup', (e) => {
    if (e.button === 3) { e.preventDefault(); navigate('back'); }
    if (e.button === 4) { e.preventDefault(); navigate('forward'); }
  });
  window.addEventListener('mousedown', (e) => { if (e.button === 3 || e.button === 4) e.preventDefault(); });
  if (S.list.onNav) S.list.onNav((dir) => navigate(dir === 'forward' ? 'forward' : 'back'));

  // ================================================================ encryption of locked notes (1.1.30)
  // main/crypt.js does the work. The list shows the recovery key (once), and Settings → Locked notes has the buttons.
  const cryptNow = () => (V.state.settings && V.state.settings.crypt) || {};
  const pinWord = () => (V.state.settings.lockKind === 'pin' ? 'PIN' : 'password');
  V.keyDismissed = false; // the recovery key pop-up was closed without "I have saved it": don't push it again in this list
  V.cryptErrShown = null; // 1.1.31: the setting-up error already shown (shown once each)
  V.encryptAsked = false; // 1.1.31: the "Encrypt your locked notes" PIN pop-up was shown in this list
  let keyBusy = false;
  async function showKeyIfNeeded(force) {
    if (keyBusy || V.modalDone) return;
    const c = cryptNow();
    // 1.1.31: setting up failed: say so once (the notes stay as they were; the PIN still works as before)
    if (c.error && V.cryptErrShown !== c.error) {
      V.cryptErrShown = c.error;
      keyBusy = true;
      try {
        await modal({ title: 'Locked notes could not be encrypted', text: `Nothing was changed. Your notes are safe, and your ${pinWord()} still works. The problem: ${c.error}`, tip: 'Please tell Claude this message.', icon: ICON.lock, noCancel: true, okLabel: 'OK' });
      } finally { keyBusy = false; }
      return;
    }
    // 1.1.31: notes locked before the update are encrypted once the PIN is typed: ask for it straight away
    if (c.needPin && !c.error && !V.encryptAsked && !force) {
      V.encryptAsked = true; // once per list window (Settings → Locked notes → Encrypt now does it later too)
      keyBusy = true;
      let r;
      try {
        r = await askPassword('Encrypt your locked notes', 'Locked notes are now encrypted, so nobody can read them from the files. Type your password once to encrypt the ones you have.', 'Encrypt', (pw) => S.crypt.start(pw));
      } finally { keyBusy = false; }
      if (r) { V.keyDismissed = false; await load(); showKeyIfNeeded(true); }
      return;
    }
    if (!force && (V.keyDismissed || !c.pending)) return;
    keyBusy = true;
    try {
      const code = await S.crypt.takeKey();
      if (code) await showKey(code);
    } finally { keyBusy = false; }
  }
  async function showKey(code) {
    const box = h('input', { type: 'checkbox' });
    const copyBtn = h('button', { type: 'button', class: 'pill ghost small', html: ICON.copy + 'Copy' });
    copyBtn.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(code); copyBtn.innerHTML = ICON.check + 'Copied'; } catch { copyBtn.textContent = 'Could not copy'; }
    });
    const saveBtn = h('button', { type: 'button', class: 'pill ghost small', html: ICON.folder + 'Save to a file…' });
    saveBtn.addEventListener('click', async () => { if (await S.crypt.saveKey(code)) saveBtn.innerHTML = ICON.check + 'Saved'; });
    const r = await modal({
      title: 'Your recovery key',
      text: `Your locked notes are now encrypted. If you forget your ${pinWord()}, only this key can open them. Nobody else can.`,
      tip: 'Print it or write it down. Keep it away from this computer. You only see it now.',
      icon: ICON.lock,
      noCancel: true,
      okLabel: 'Done',
      content: h('div', {}, h('div', { class: 'rkey' }, code), h('div', { class: 'rkeybtns' }, copyBtn, saveBtn),
        h('label', { class: 'rkeyok' }, box, h('span', {}, 'I have saved my recovery key'))),
      check: async () => (box.checked ? null : 'Tick the box once it’s saved.'),
    });
    if (r) { await S.crypt.keySaved(); V.keyDismissed = false; toast('Recovery key saved ✓'); }
    else V.keyDismissed = true; // Settings offers it again
    await load();
  }
  function paintCrypt() {
    const s = V.state.settings || {};
    const c = cryptNow();
    const pin = s.lockKind === 'pin';
    $('#cryptBox').hidden = !s.hasPassword;
    if (!s.hasPassword) return;
    let info;
    if (!c.setUp && c.error) info = `Locked notes could not be encrypted (${c.error}). They are only hidden in the app.`;
    else if (!c.setUp) info = `⚠️ Locked notes are NOT encrypted yet. Anyone who opens the notes folder can read them. Click “Encrypt now”.`;
    else if (!c.on) info = 'Encryption is off. Anyone who opens the notes folder can read your locked notes.';
    else info = `🔐 Locked notes are encrypted on this computer. Only your ${pinWord()} or recovery key opens them.${c.keyShown ? '' : ' Your recovery key isn’t saved yet!'}`;
    $('#cryptInfo').textContent = info;
    // the owner's choice: PINs stay allowed, with a warning while it is short
    const shortPin = pin && (Number(s.lockLen) || 0) < 8;
    $('#pinWarn').hidden = !(c.on && shortPin);
    $('#pinWarn').textContent = 'A short PIN is easy to crack for anyone who copies your notes folder. Use 8+ digits, or a password.';
    $('#cryptNow').hidden = c.setUp;
    $('#cryptKey').hidden = !c.setUp;
    $('#cryptKey').innerHTML = ICON.lock + (c.pending ? 'Show recovery key' : 'New recovery key');
    $('#cryptForgot').hidden = !c.setUp;
    $('#cryptToggle').hidden = !c.setUp;
    $('#cryptToggle').textContent = c.on ? 'Turn off encryption' : 'Turn encryption back on';
    $('#cryptToggle').className = c.on ? 'pill danger' : 'pill ghost';
  }
  $('#cryptNow').addEventListener('click', async () => {
    const r = await askPassword('Encrypt locked notes?', 'Type your password. Your locked notes get encrypted, and you get a recovery key.', 'Encrypt', (pw) => S.crypt.start(pw));
    if (r) { V.keyDismissed = false; await load(); showKeyIfNeeded(true); }
  });
  $('#cryptKey').addEventListener('click', async () => {
    if (cryptNow().pending) { V.keyDismissed = false; showKeyIfNeeded(true); return; }
    const r = await askPassword('Make a new recovery key?', 'Type your password. The old recovery key stops working.', 'Make new key', (pw) => S.crypt.newKey(pw));
    if (r) { V.keyDismissed = false; await load(); showKeyIfNeeded(true); }
  });
  $('#cryptForgot').addEventListener('click', async () => {
    let kind = null;
    const r = await modal({
      title: 'Forgot your PIN or password?',
      text: 'Type your recovery key, then pick a new PIN or password. Your notes stay locked.',
      kindPick: s0().lockKind === 'pin' ? 'pin' : 'password',
      inputs: [{ placeholder: 'Recovery key (XXXXX-XXXXX-…)', type: 'text' }, ...NEW_INPUTS],
      icon: ICON.lock,
      okLabel: 'Save',
      check: async ([code, a, b], k) => {
        if (!String(code || '').trim()) return 'Type your recovery key.';
        const bad = checkNew(a, b, k);
        if (bad) return bad;
        const res = await S.crypt.recover(code, a, k);
        if (!savedLock(res, k)) return (res && res.error) || 'Could not save it.';
        kind = k;
        return null;
      },
    });
    if (r) { toast(`New ${kind === 'pin' ? 'PIN' : 'password'} saved ✓`); await load(); }
  });
  const s0 = () => V.state.settings || {};
  $('#cryptToggle').addEventListener('click', async () => {
    const on = cryptNow().on;
    const r = on
      ? await askPassword('Turn off encryption?', 'Locked notes are then saved as plain text. Anyone who opens the notes folder can read them.', 'Turn off', (pw) => S.crypt.setOff(pw, true))
      : await askPassword('Turn encryption back on?', 'Type your password. Your locked notes get encrypted again.', 'Turn on', (pw) => S.crypt.setOff(pw, false));
    if (r) { toast(on ? 'Encryption is off' : 'Locked notes are encrypted again 🔐'); await load(); }
  });

  Object.assign(K, { trashNote, destroyNote, emptyBin, dissolveGroup, trashGroup, NEW_INPUTS, checkNew, savedLock,
    ensurePassword, paintLockBar, lockNote, unlockNote, lockGroup, unlockGroup, unlockNoteNow, relockNote, unlockGroupNow,
    relockGroup, openGroupView, openPanel, closePanel,
    paintPanel, showKeyIfNeeded, paintCrypt });
})();
