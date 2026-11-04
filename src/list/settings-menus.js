'use strict';
// CosmoNotes "All notes" window, part 4 of 7: Settings (new-note colours, About, backups), app-styled pop-ups, the right-click menu
// (src/list.js until 1.1.28; the parts load in order from list.html. How they share names: ai-context/splitting-code.md)
(() => {
  const K = window.COSMO_LIST_KIT;
  const { V, S, $, $$, COLORS, DARK_COLORS, COLOR_NAMES, SWATCH, THEMES, themeNow, ICON, sel, h, plural, noteIsLocked,
    groupIsLocked, render, setFav, paintCards, unlockedNow } = K;
  // defined in a later part:
  const fxSummary = K.later('fxSummary'), openEdit = K.later('openEdit'), trashNote = K.later('trashNote'),
    dissolveGroup = K.later('dissolveGroup'), trashGroup = K.later('trashGroup'), lockNote = K.later('lockNote'),
    unlockNote = K.later('unlockNote'), lockGroup = K.later('lockGroup'), unlockGroup = K.later('unlockGroup'),
    unlockNoteNow = K.later('unlockNoteNow'), relockNote = K.later('relockNote'), unlockGroupNow = K.later('unlockGroupNow'),
    relockGroup = K.later('relockGroup'),
    openGroupView = K.later('openGroupView'), openPanel = K.later('openPanel'), paintCrypt = K.later('paintCrypt');
  // ---- Settings → For new notes → Colour (1.1.15): pick one or more colours; each new note gets one of them at random
  const newColors = () => {
    const s = V.state.settings || {};
    const list = Array.isArray(s.defaultColors) ? s.defaultColors.filter((c) => COLORS.includes(c)) : [];
    if (list.length) return list;
    if (s.defaultColor === 'random') return COLORS.slice(0, 7);
    return [COLORS.includes(s.defaultColor) ? s.defaultColor : 'yellow'];
  };
  function setNewColors(list) {
    const set = new Set(list);
    const clean = COLORS.filter((c) => set.has(c));
    if (!clean.length) return;
    V.state.settings.defaultColors = clean; // paint straight away; main sends the list a refresh too
    V.state.settings.defaultColor = clean[0];
    paintNewColors();
    S.settings.set({ defaultColors: clean });
  }
  function paintNewColors() {
    const sc = $('#sColors');
    const picked = newColors();
    if (!sc.childElementCount) {
      for (const c of COLORS) {
        sc.append(h('button', {
          class: 'sw pick' + (DARK_COLORS.includes(c) ? ' darkp' : ''),
          'data-color': c,
          style: `background:${SWATCH[c]}`,
          title: COLOR_NAMES[c],
          html: '<svg class="tick" viewBox="0 0 24 24"><path d="m5.5 12.5 4.5 4.5 8.5-10"/></svg>',
          onclick: () => {
            const now = newColors();
            if (now.includes(c)) {
              if (now.length === 1) { toast('Keep at least one colour for new notes'); return; }
              setNewColors(now.filter((x) => x !== c));
            } else setNewColors([...now, c]);
          },
        }));
      }
    }
    for (const b of sc.children) {
      const on = picked.includes(b.dataset.color);
      b.classList.toggle('on', on);
      b.setAttribute('aria-pressed', String(on));
    }
    $('#sColorsCount').textContent = picked.length === 1 ? COLOR_NAMES[picked[0]] : `${picked.length} picked`;
    $('#sColorsHint').textContent = picked.length === 1
      ? 'New notes get this colour. Pick more for a random mix.'
      : 'Each new note gets one of these at random.';
  }
  $('#sPickAll').addEventListener('click', () => setNewColors(COLORS));
  $('#sPickLight').addEventListener('click', () => setNewColors(COLORS.filter((c) => !DARK_COLORS.includes(c))));
  $('#sPickDark').addEventListener('click', () => setNewColors(DARK_COLORS));
  $('#sPickOne').addEventListener('click', () => setNewColors([newColors()[0]]));

  async function renderSettings() {
    const s = V.state.settings;
    $('#sStartup').checked = !!s.startWithWindows;
    $('#sSpell').checked = !!s.spellCheck;
    $('#sCyr').checked = !!s.spellCyrillic;
    paintNewColors();
    $$('#sFont button').forEach((b) => b.classList.toggle('on', b.dataset.font === s.defaultFont));
    const op = Math.round((Number(s.defaultOpacity) || 1) * 100);
    if (document.activeElement !== $('#sOpacity')) $('#sOpacity').value = op; // not while it's being dragged
    $('#sOpVal').textContent = `${$('#sOpacity').value}%`;
    $('#sSolidHover').checked = s.defaultSolidOnHover !== false;
    $('#sNoRepeat').checked = s.newColorNoRepeat !== false;
    if (K.FX) { $('#sFxNow').textContent = fxSummary(); $('#sFxPause').checked = !!s.fxPaused; }
    const th = $('#sTheme');
    th.innerHTML = '';
    for (const t of THEMES) {
      th.append(h('button', {
        class: 'theme' + (themeNow() === t.id ? ' on' : ''),
        style: `--tb:${t.bg}; --td:${t.dot}`,
        title: t.name,
        onclick: () => {
          if (themeNow() === t.id) return;
          V.state.settings.listTheme = t.id;
          render();
          S.settings.set({ listTheme: t.id });
        },
      }, h('i'), h('span', {}, t.name)));
    }
    const pinNow = s.lockKind === 'pin';
    $('#lockInfo').textContent = s.hasPassword
      ? `Your ${pinNow ? 'PIN' : 'password'} unlocks every locked note and group. To lock one, right-click it or use its ⋯ menu.`
      : 'No password or PIN yet. Set one here, or when you first lock something.';
    $('#pwSave').innerHTML = ICON.lock + (s.hasPassword ? `Change ${pinNow ? 'PIN' : 'password'}` : 'Set password or PIN');
    paintCrypt();
    $('#dataPath').textContent = s.dataPath || '';
    $('#version').textContent = `CosmoNotes ${s.version || ''} - Made with love.`;
    renderAbout(s.version);
    paintVoice(await S.stt.status());
    renderBackups(await S.backups.list());
  }

  // ---- Settings → Voice to text (1.3.1; main/ipc-stt.js): which model, its download, Test my computer
  const VERDICT = { live: 'Live', after: 'After you stop', slow: 'Too slow', failed: "Didn't start" };
  let sttNow = null;
  function paintVoice(st) {
    if (!st || !st.models) return;
    sttNow = st;
    const use = $('#sttUse');
    use.innerHTML = '';
    for (const m of st.models) {
      use.append(h('button', {
        class: st.selected === m.id ? 'on' : '',
        'data-id': m.id,
        onclick: async () => { if (sttNow.selected !== m.id) paintVoice(await S.stt.use(m.id)); },
      }, m.name));
    }
    const box = $('#sttModels');
    box.innerHTML = '';
    for (const m of st.models) {
      const size = m.mbMax ? `${m.mb}–${m.mbMax} MB` : `${m.mb} MB`;
      const bits = [];
      let btn = null;
      if (m.state === 'ready') {
        bits.push(m.builtIn ? `Built in · ${size}` : size, 'Ready');
        if (m.test && VERDICT[m.test.verdict]) bits.push(VERDICT[m.test.verdict]);
        if (!m.builtIn) btn = h('button', { class: 'pill ghost small', onclick: () => removeModel(m) }, 'Remove');
      } else if (m.state === 'downloading') {
        bits.push(`Downloading ${m.pct || 0}%`);
        btn = h('button', { class: 'pill ghost small', onclick: async () => paintVoice(await S.stt.cancelDownload(m.id)) }, 'Cancel');
      } else if (m.state === 'failed') {
        bits.push(size, 'The download stopped');
        btn = h('button', { class: 'pill small', onclick: async () => paintVoice(await S.stt.download(m.id)) }, 'Try again');
      } else if (m.state === 'missing') {
        bits.push('Not found. build.bat adds it.');
      } else {
        bits.push(size);
        btn = h('button', { class: 'pill small', onclick: async () => paintVoice(await S.stt.download(m.id)) }, 'Download');
      }
      const err = !m.builtIn && st.startError && m.state === 'ready' ? h('small', { class: 'err' }, "Didn't start last time. Standard was used.") : null;
      box.append(h('div', { class: 'row sttm', 'data-id': m.id },
        h('span', {}, h('b', {}, m.name), h('small', {}, bits.join(' · ')), err),
        btn,
        m.state === 'downloading' ? h('div', { class: 'sttbar' }, h('i', { style: `width:${m.pct || 0}%` })) : null));
    }
    const sel = st.models.find((m) => m.id === st.selected) || st.models[0];
    $('#sttUsing').textContent = `Using: ${sel.state === 'ready' && sel.device === 'gpu' ? 'graphics card' : 'processor'}.`;
    $('#sttTest').disabled = !!st.testing;
    $('#sttTest').textContent = st.testing ? 'Testing…' : 'Test';
    $('#sttTestInfo').textContent = st.testing ? 'This takes a few seconds.' : 'Checks if words can appear while you talk.';
  }
  async function removeModel(m) {
    const ok = await modal({ title: `Remove ${m.name}?`, text: 'You can download it again later.', okLabel: 'Remove', danger: true });
    if (!ok) return;
    const st = await S.stt.remove(m.id);
    if (st && st.error === 'busy') toast('Voice to text is busy. Try again in a moment.');
    paintVoice(st);
  }
  $('#sttTest').addEventListener('click', async () => {
    if (sttNow) paintVoice({ ...sttNow, testing: true });
    const st = await S.stt.test();
    if (st && st.error === 'busy') toast('Voice to text is busy. Try again in a moment.');
    paintVoice(st);
  });
  S.stt.onChanged((st) => { if (V.tab === 'settings') paintVoice(st); });

  const niceDate = (iso) => {
    const [y, m, d] = String(iso).split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString([], { day: 'numeric', month: 'long', year: 'numeric' });
  };
  let aboutDone = false;
  function renderAbout(version) {
    const A = window.COSMO_ABOUT;
    if (!A) return;
    $('#aboutLine').textContent = `${version ? `Version ${version} · ` : ''}Last updated ${niceDate(A.LAST_UPDATED)}`;
    if (aboutDone) return;
    aboutDone = true;
    $('#features').append(...A.FEATURES.map((f) => h('div', { class: 'fgroup' },
      h('h5', {}, f.title),
      h('ul', {}, f.items.map((it) => h('li', {}, it))))));
  }

  // Backups aren't listed in Settings any more: just the newest one, and a button that opens a
  // pop-up to pick the day to restore.
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  function backupLabel(name) {
    const m = String(name).match(/^(\d{4})-(\d{2})-(\d{2})(?:_(\d{2})-(\d{2}))?/);
    if (!m) return { day: name, time: '' };
    const d = new Date(+m[1], +m[2] - 1, +m[3]);
    return { day: `${DAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`, time: m[4] ? `${m[4]}:${m[5]}` : '' };
  }
  function renderBackups(list) {
    const box = $('#backups');
    if (!list.length) { box.textContent = 'The first backup is made today.'; return; }
    const l = backupLabel(list[0].name);
    box.textContent = `Newest backup: ${l.day}${l.time ? `, ${l.time}` : ''}${list[0].count != null ? ` · ${plural(list[0].count, 'note')}` : ''}`;
  }
  async function pickBackup() {
    const list = await S.backups.list();
    if (!list.length) {
      await modal({ title: 'No backups yet', text: 'The first backup is made today. You can also press “Back up now”.', okLabel: 'OK', noCancel: true, icon: ICON.restore });
      return;
    }
    let chosen = null;
    const rows = list.map((b) => {
      const l = backupLabel(b.name);
      const row = h('button', {
        type: 'button', class: 'bkpick',
        onclick: () => { chosen = b.name; $$('.bkpick').forEach((x) => x.classList.toggle('on', x === row)); $('#mErr').textContent = ''; },
        ondblclick: () => { chosen = b.name; $('#mbox').requestSubmit(); },
      }, h('i'), h('span', {}, h('b', {}, l.day), h('small', {}, [l.time, b.count != null ? plural(b.count, 'note') : ''].filter(Boolean).join(' · '))));
      return row;
    });
    const ok = await modal({
      title: 'Restore from a backup',
      text: 'Pick a day. Its notes come back in a new group. Nothing is replaced.',
      content: h('div', { class: 'bklist' }, rows),
      okLabel: 'Restore',
      icon: ICON.restore,
      check: async () => (chosen ? null : 'Pick a day first.'),
    });
    if (!ok || !chosen) return;
    const count = await S.backups.restore(chosen);
    await modal({
      title: count ? `Brought back ${plural(count, 'note')}` : 'Nothing to bring back',
      text: count ? `They are in the group “Restored Notes from ${backupLabel(chosen).day}”.` : 'Every note in that backup matches what you already have.',
      okLabel: 'OK',
      noCancel: true,
    });
  }

  // ================================================================ app-styled pop-ups
  V.modalDone = null;
  // modal({ title, text, tip, icon, okLabel, cancelLabel, danger, inputs, check, noCancel, kindPick, pinLen })
  // inputs: [{ placeholder, pin, kinded: { password: '…', pin: '…' } }]. pin = digits only.
  // kindPick ('password' | 'pin'): shows a Password | PIN switch; inputs with `kinded` follow it.
  // pinLen: submit by itself as soon as the first input has that many digits (opening with a PIN).
  // check(values, kind) returns an error text or null.
  // → resolves with the input values (or true) when confirmed, null when cancelled.
  const digitsOnly = (el) => { const v = el.value.replace(/\D/g, ''); if (v !== el.value) el.value = v; };
  function modal(o) {
    if (V.modalDone) V.modalDone(null);
    hideCtx();
    $('#mTitle').textContent = o.title || '';
    $('#mText').textContent = o.text || '';
    $('#mText').hidden = !o.text;
    $('#mTip').textContent = o.tip || '';
    $('#mTip').hidden = !o.tip;
    $('#mErr').textContent = '';
    $('#mIcon').innerHTML = o.icon || (o.danger ? ICON.warn : ICON.info);
    $('#mIcon').className = 'micon' + (o.danger ? ' danger' : '');
    const ok = $('#mOk');
    ok.textContent = o.okLabel || 'OK';
    ok.className = 'pill' + (o.danger ? ' red' : '');
    $('#mCancel').textContent = o.cancelLabel || 'Cancel';
    $('#mCancel').hidden = !!o.noCancel;
    const inputs = $('#mInputs');
    inputs.innerHTML = '';
    let kind = o.kindPick || null;
    const els = [];
    const isPin = (inp) => inp.pin || (inp.kinded && kind === 'pin');
    const paintKind = () => {
      (o.inputs || []).forEach((inp, i) => {
        const el = els[i];
        const pin = isPin(inp);
        if (inp.kinded) el.placeholder = inp.kinded[kind] || '';
        el.inputMode = pin ? 'numeric' : 'text';
        el.maxLength = pin ? (o.pinLen && i === 0 ? o.pinLen : 12) : 200;
        if (pin) digitsOnly(el);
      });
      $$('#mKind button').forEach((b) => b.classList.toggle('on', b.dataset.k === kind));
    };
    if (kind) {
      inputs.append(h('div', { class: 'seg mkind', id: 'mKind' },
        ...[['password', 'Password'], ['pin', 'PIN (numbers)']].map(([k, label]) => h('button', {
          type: 'button', 'data-k': k,
          onclick: () => { kind = k; $('#mErr').textContent = ''; paintKind(); (els.find((x, i) => o.inputs[i].kinded) || els[0]).focus(); },
        }, label))));
    }
    if (o.content) inputs.append(o.content); // any extra content (e.g. the list of backups)
    let busy = false;
    (o.inputs || []).forEach((inp, i) => {
      const el = h('input', { type: inp.type || 'password', placeholder: inp.placeholder || '', class: 'minput' });
      el.addEventListener('input', () => {
        if (isPin(inp)) digitsOnly(el);
        if (i === 0 && o.pinLen && isPin(inp) && el.value.length === o.pinLen && !busy) $('#mbox').requestSubmit();
      });
      els.push(el);
      inputs.append(el);
    });
    paintKind();
    $('#modal').hidden = false;
    requestAnimationFrame(() => { (inputs.querySelector('input') || ok).focus(); });
    return new Promise((resolve) => {
      V.modalDone = (v) => { V.modalDone = null; $('#modal').hidden = true; resolve(v); };
      $('#mbox').onsubmit = async (e) => {
        e.preventDefault();
        if (busy) return;
        const values = els.map((x) => x.value);
        if (o.check) {
          ok.disabled = true;
          busy = true;
          const err = await o.check(values, kind);
          busy = false;
          ok.disabled = false;
          if (err) {
            $('#mErr').textContent = err;
            const box = $('#mbox');
            box.classList.remove('shake');
            void box.offsetWidth;
            box.classList.add('shake');
            const first = els[0];
            // a wrong PIN is cleared so it can simply be typed again; a password is selected
            if (first && o.pinLen && isPin((o.inputs || [])[0])) first.value = '';
            else if (first) first.select();
            return;
          }
        }
        V.modalDone(values.length ? values : true);
      };
    });
  }
  $('#mCancel').addEventListener('click', () => V.modalDone && V.modalDone(null));
  $('#modal').addEventListener('mousedown', (e) => { if (e.target.id === 'modal' && V.modalDone) V.modalDone(null); });

  let toastTimer = null;
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.hidden = true; }, 2600);
  }

  // ---------- right-click menu
  // the card that was right-clicked gets a faint outline while its menu is open (1.1.16)
  V.ctxCard = null;
  function hideCtx() { $('#ctx').hidden = true; document.querySelectorAll('.card.ctxon').forEach((c) => c.classList.remove('ctxon')); }
  function showCtx(e, items) {
    const ctx = $('#ctx');
    document.querySelectorAll('.card.ctxon').forEach((c) => c.classList.remove('ctxon'));
    const card = e.target && e.target.closest ? e.target.closest('.card') : null;
    if (card) card.classList.add('ctxon');
    V.ctxCard = card; // 1.1.22: Edit design opens next to it (the menu item runs after hideCtx)
    ctx.innerHTML = '';
    for (const it of items) {
      if (!it) continue;
      if (it === '-') { ctx.append(h('div', { class: 'sep' })); continue; }
      ctx.append(h('button', {
        class: 'mi' + (it.danger ? ' danger' : ''),
        disabled: it.disabled || null,
        onclick: () => { hideCtx(); it.run(); },
      }, h('span', { class: 'mic', html: it.icon || '' }), h('span', {}, it.label)));
    }
    ctx.hidden = false;
    const w = ctx.offsetWidth;
    const hgt = ctx.offsetHeight;
    ctx.style.left = `${Math.max(6, Math.min(e.clientX, innerWidth - w - 6))}px`;
    ctx.style.top = `${Math.max(6, Math.min(e.clientY, innerHeight - hgt - 6))}px`;
  }
  document.addEventListener('mousedown', (e) => { if (!e.target.closest('#ctx')) hideCtx(); });
  window.addEventListener('blur', hideCtx);
  $('#viewNotes').addEventListener('scroll', hideCtx, { passive: true });

  function noteMenu(n, e) {
    showCtx(e, [
      // 1.1.22 (sixth round, the owner's order): favourites first, then Edit design; "Open on desktop" / "Bring to front"
      // is gone (clicking the card opens it)
      n.favorite
        ? { label: 'Remove from favourites', icon: ICON.star, run: () => setFav([`n:${n.id}`], false) }
        : { label: 'Add to favourites', icon: ICON.star, run: () => setFav([`n:${n.id}`], true) },
      { label: 'Edit design…', icon: ICON.edit, run: () => openEdit(n) },
      n.open ? { label: 'Close note', icon: ICON.hide, run: () => S.list.closeNote(n.id) } : null,
      { label: 'Duplicate note', icon: ICON.copy, run: async () => { await S.list.duplicate(n.id); toast('Note duplicated'); } },
      { label: 'Select (Ctrl+click)', icon: ICON.check, run: () => { sel.add(`n:${n.id}`); V.selAnchor = `n:${n.id}`; paintCards(); } },
      '-',
      // 1.1.47 (the owner's wish): "Unlock…" lasts until CosmoNotes restarts; "Remove lock…" under it is for good
      !n.ownLock ? { label: 'Lock note', icon: ICON.lock, run: () => lockNote(n), disabled: false }
        : unlockedNow('note', n) ? { label: 'Lock again', icon: ICON.lock, run: () => relockNote(n) }
          : { label: 'Unlock…', icon: ICON.unlock, run: () => unlockNoteNow(n) },
      n.ownLock ? { label: 'Remove lock…', icon: ICON.unlock, run: () => unlockNote(n) } : null,
      n.groupId ? { label: 'Take out of group', icon: ICON.out, run: () => S.groups.moveUp(n.id) } : null,
      '-',
      noteIsLocked(n)
        ? { label: 'Locked: can’t be deleted', icon: ICON.trash, disabled: true, run: () => {} }
        : { label: 'Move to Bin', icon: ICON.trash, danger: true, run: () => trashNote(n, false) },
    ]);
  }
  function groupMenu(g, e) {
    showCtx(e, [
      { label: 'Open group', icon: ICON.folder, run: () => openGroupView(g) },
      g.open ? { label: 'Group settings…', icon: ICON.palette, run: async () => { await openGroupView(g); openPanel(); } } : null,
      g.favorite
        ? { label: 'Remove from favourites', icon: ICON.star, run: () => setFav([`g:${g.id}`], false) }
        : { label: 'Add to favourites', icon: ICON.star, run: () => setFav([`g:${g.id}`], true) },
      { label: 'Select (Ctrl+click)', icon: ICON.check, run: () => { sel.add(`g:${g.id}`); V.selAnchor = `g:${g.id}`; paintCards(); } },
      '-',
      !g.locked ? { label: 'Lock group', icon: ICON.lock, run: () => lockGroup(g) }
        : unlockedNow('group', g) ? { label: 'Lock again', icon: ICON.lock, run: () => relockGroup(g) }
          : { label: 'Unlock…', icon: ICON.unlock, run: () => unlockGroupNow(g) },
      g.locked ? { label: 'Remove lock…', icon: ICON.unlock, run: () => unlockGroup(g) } : null,
      g.parentId ? { label: 'Move up one level', icon: ICON.out, run: () => S.groups.moveUp(g.id) } : null,
      { label: 'Ungroup…', icon: ICON.ungroup, run: () => dissolveGroup(g) },
      '-',
      groupIsLocked(g)
        ? { label: 'Locked: can’t be deleted', icon: ICON.trash, disabled: true, run: () => {} }
        : { label: 'Move its notes to Bin…', icon: ICON.trash, danger: true, run: () => trashGroup(g) },
    ]);
  }

  Object.assign(K, { renderSettings, renderBackups, pickBackup, modal, toast, hideCtx, showCtx, noteMenu, groupMenu });
})();
