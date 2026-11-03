'use strict';
// CosmoNotes "All notes" window, part 5 of 7: effects on the cards, Settings → Effects, Edit design
// (src/list.js until 1.1.28; the parts load in order from list.html. How they share names: ai-context/splitting-code.md)
(() => {
  const K = window.COSMO_LIST_KIT;
  const { V, S, $, $$, COLORS, DARK_COLORS, COLOR_NAMES, SWATCH, h, toast, hideCtx, noteIsLocked, noteById } = K;
  // ================================================================ effects (1.1.16)
  // A note's effect plays on its card too, behind the card's writing (a canvas .fxc as the card's first child,
  // z-index -1), and its mouse follower trails the pointer over the card. Same rules as the note window
  // (COSMO_FX.resolve in fx.js). Only cards on screen draw (fxIO), all in fx.js's one shared loop.
  const FX = window.COSMO_FX;
  const fxLayers = new Map(); // card element → its layer
  const fxIO = FX ? new IntersectionObserver((list) => {
    for (const en of list) { const L = fxLayers.get(en.target.parentElement); if (L) L.setVisible(en.isIntersecting); }
  }) : null;
  const fxName = (kind, id) => (!id || id === 'none' ? 'none' : ((kind === 'effect' ? FX.EFFECTS : FX.FOLLOWERS)[id] || {}).name || 'none');
  // 1.2.3 (speed): a background refresh (a note was edited…) passes `fresh`, the cards it had to build again. A card it
  // kept shows the same note data as before (cards.js only keeps a card whose data didn't change), so its effect is
  // left alone too, unless an effect setting changed since last time. Everything else (a setting, a pause…) passes
  // nothing and every card is looked at, as before.
  let fxSeen = null;
  function paintFx(fresh = null) {
    if (!FX) return;
    const s = V.state.settings || {};
    const seen = JSON.stringify(Object.keys(s).filter((x) => x.startsWith('fx')).sort().map((x) => [x, s[x]]));
    const only = fresh && seen === fxSeen ? fresh : null;
    fxSeen = seen;
    const keep = new Set();
    for (const card of $('#cards').children) {
      const k = card.dataset.key;
      if (!k || k[0] !== 'n') continue;
      if (only && !only.has(card)) { if (fxLayers.has(card)) keep.add(card); continue; }
      const n = noteById(k.slice(2));
      if (!n) continue;
      const r = FX.resolve(n.fx, V.state.settings, n.fxPaused, n.fxPlay);
      let L = fxLayers.get(card);
      if (r.effect === 'none' && r.follower === 'none') {
        if (L) { L.destroy(); fxLayers.delete(card); const cv = card.querySelector(':scope > .fxc'); if (cv) { fxIO.unobserve(cv); cv.remove(); } }
        continue;
      }
      if (!L) {
        const cv = h('canvas', { class: 'fxc', 'aria-hidden': 'true' });
        card.prepend(cv);
        L = FX.Layer(cv);
        fxLayers.set(card, L);
        fxIO.observe(cv);
        card.addEventListener('pointermove', (e) => { const rr = cv.getBoundingClientRect(); L.move(e.clientX - rr.left, e.clientY - rr.top); });
        card.addEventListener('pointerleave', () => L.leave());
      }
      keep.add(card);
      L.resize();
      L.set({ paper: n.color, effect: r.effect, follower: r.follower, effectAmount: r.effectAmount, followerAmount: r.followerAmount, effectOpacity: r.effectOpacity, followerOpacity: r.followerOpacity, interact: r.interact, dark: DARK_COLORS.includes(n.color) });
      L.setPaused(r.paused);
    }
    for (const [card, L] of fxLayers) if (!keep.has(card)) { L.destroy(); fxLayers.delete(card); }
  }
  if (FX) new ResizeObserver(() => { for (const L of fxLayers.values()) L.resize(); }).observe($('#cards'));

  // ---- Settings → Effects, and its pop-up (Choose…)
  function fxSummary() {
    const s = V.state.settings;
    // e.g. "Snow (more, 60%)": the frequency unless normal, the opacity unless 100 %
    const more = (a, o) => {
      const p = [];
      if (a === 'low') p.push('less'); else if (a === 'high') p.push('more');
      const op = FX.opacityOf(o) ?? 1; if (op < 1) p.push(`${Math.round(op * 100)}%`);
      return p.length ? ` (${p.join(', ')})` : '';
    };
    const e = fxName('effect', s.fxEffect) + (s.fxEffect && s.fxEffect !== 'none' ? more(s.fxEffectAmount, s.fxEffectOpacity) : '');
    const f = fxName('follower', s.fxFollower) + (s.fxFollower && s.fxFollower !== 'none' ? more(s.fxFollowerAmount, s.fxFollowerOpacity) : '');
    return `Background: ${e} · Mouse: ${f}${s.fxForceAll ? ' · used on every note' : ''}`;
  }
  const CHECK = '<svg class="ok" viewBox="0 0 24 24"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>';
  const fxIcon = ([col, inner]) => `<span class="ic"${col ? ` style="--ic:${col}"` : ''}><svg viewBox="0 0 24 24">${inner}</svg></span>`;
  function fxAllList(box, kind) {
    const ids = kind === 'effect' ? FX.EFFECT_IDS : FX.FOLLOWER_IDS;
    const key = kind === 'effect' ? 'fxEffect' : 'fxFollower';
    for (const id of ['none', ...ids]) {
      const b = h('button', { type: 'button', class: 'fxi', 'data-v': id, html: `${fxIcon(id === 'none' ? FX.ICONS.none : FX.ICONS[kind][id])}<span class="nm"></span>${CHECK}` });
      b.querySelector('.nm').textContent = id === 'none' ? 'None' : fxName(kind, id);
      b.addEventListener('click', () => { V.state.settings[key] = id; paintFxSheet(); S.settings.set({ [key]: id }); });
      box.append(b);
    }
  }
  if (FX) { fxAllList($('#fxAllEffects'), 'effect'); fxAllList($('#fxAllFollowers'), 'follower'); }
  function paintFxSheet() {
    const s = V.state.settings;
    for (const [box, cur] of [[$('#fxAllEffects'), s.fxEffect || 'none'], [$('#fxAllFollowers'), s.fxFollower || 'none']]) {
      for (const b of box.children) { const on = b.dataset.v === cur; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); }
    }
    for (const [id, cur, kindOn] of [['#fxAllEAmt', s.fxEffectAmount || 'mid', (s.fxEffect || 'none') !== 'none'], ['#fxAllFAmt', s.fxFollowerAmount || 'mid', (s.fxFollower || 'none') !== 'none']]) {
      $(id).classList.toggle('off', !kindOn); // 1.1.22: greyed out with None, not hidden
      $$(`${id} button`).forEach((b) => { b.classList.toggle('on', b.dataset.a === cur); b.disabled = !kindOn; });
    }
    for (const [id, o, kindOn] of [['#fxAllEOp', s.fxEffectOpacity, (s.fxEffect || 'none') !== 'none'], ['#fxAllFOp', s.fxFollowerOpacity, (s.fxFollower || 'none') !== 'none']]) {
      const pct = Math.round((FX.opacityOf(o) ?? 1) * 100);
      $(id).classList.toggle('off', !kindOn);
      $(`${id} input`).value = String(pct); $(`${id} input`).disabled = !kindOn;
      $(`${id} em`).textContent = `${pct}%`;
    }
    $('#fxForceAll').checked = !!s.fxForceAll;
    $('#fxInteractAll').checked = s.fxInteract !== false; // 1.1.21
    $('#sFxNow').textContent = fxSummary();
  }
  for (const [id, key] of [['#fxAllEAmt', 'fxEffectAmount'], ['#fxAllFAmt', 'fxFollowerAmount']]) {
    $$(`${id} button`).forEach((b) => b.addEventListener('click', () => { V.state.settings[key] = b.dataset.a; paintFxSheet(); S.settings.set({ [key]: b.dataset.a }); }));
  }
  // 1.1.17: opacity for all notes. Dragging shows it on the cards at once; it's saved (and sent to the open
  // notes) when the slider is let go, or 300 ms after it stops moving
  for (const [id, key] of [['#fxAllEOp', 'fxEffectOpacity'], ['#fxAllFOp', 'fxFollowerOpacity']]) {
    const range = $(`${id} input`);
    let timer = null;
    const save = () => { clearTimeout(timer); timer = null; S.settings.set({ [key]: V.state.settings[key] }); };
    range.addEventListener('input', () => {
      V.state.settings[key] = Number(range.value) / 100;
      $(`${id} em`).textContent = `${range.value}%`;
      $('#sFxNow').textContent = fxSummary();
      paintFx();
      clearTimeout(timer); timer = setTimeout(save, 300);
    });
    range.addEventListener('change', save);
  }
  function openFxSheet() { $('#fxSheet').hidden = false; requestAnimationFrame(paintFxSheet); }
  const closeFxSheet = () => { $('#fxSheet').hidden = true; };
  $('#sFxChoose').addEventListener('click', openFxSheet);
  $('#fxSheetX').addEventListener('click', closeFxSheet);
  $('#fxBox').addEventListener('submit', (e) => { e.preventDefault(); closeFxSheet(); });
  $('#fxSheet').addEventListener('mousedown', (e) => { if (e.target === $('#fxSheet')) closeFxSheet(); });
  $('#fxForceAll').addEventListener('change', (e) => { V.state.settings.fxForceAll = e.target.checked; paintFxSheet(); S.settings.set({ fxForceAll: e.target.checked }); });
  $('#fxInteractAll').addEventListener('change', (e) => { V.state.settings.fxInteract = e.target.checked; paintFxSheet(); paintFx(); S.settings.set({ fxInteract: e.target.checked }); });
  $('#sFxPause').addEventListener('change', (e) => S.settings.set({ fxPaused: e.target.checked }));
  // the pause button left of Settings (1.1.16): pause / play every effect
  function paintFxPause() {
    const b = $('#btnFxPause');
    const p = !!V.state.settings.fxPaused;
    b.classList.toggle('paused', p);
    b.setAttribute('aria-pressed', String(p));
    b.title = p ? 'Effects are paused: click to play them again' : 'Pause all effects';
  }
  $('#btnFxPause').addEventListener('click', async () => {
    const p = !V.state.settings.fxPaused;
    V.state.settings.fxPaused = p;
    paintFxPause();
    paintFx();
    await S.settings.set({ fxPaused: p });
    toast(p ? 'Effects paused' : 'Effects playing again');
  });

  // 1.1.20: switches one after another are grouped, so each sits right after its text and they still line up
  function groupSwitches(root, sel) {
    const seen = new Set();
    for (const el of root.querySelectorAll(sel)) {
      if (seen.has(el)) continue;
      const run = [el];
      for (let n = el.nextElementSibling; n && n.matches(sel); n = n.nextElementSibling) run.push(n);
      run.forEach((x) => seen.add(x));
      if (run.length < 2 || el.parentElement.classList.contains('switches')) continue;
      const box = document.createElement('div');
      box.className = 'switches';
      el.before(box);
      box.append(...run);
    }
  }
  groupSwitches(document, '.row.toggle');

  // ================================================================ Edit design (1.1.15 "Edit…", 1.1.20 "Edit design")
  // Right-click a note → Edit design…: its title, colour, see-through and (1.1.20) its own effects, right here in the
  // list. The paper at the top previews the colour and the effects live (move the mouse over it to see the
  // follower). The title saves as you type (350 ms after you stop), the rest at once (sliders: 120 ms after they
  // stop moving), and an open window of the note changes along with it (main.js 'list:edit'). A change made in the
  // note's own window shows here too (editRefresh).
  // 1.2.2: several notes at once (the selection bar's Edit design): ed.ids holds them all, ed.id is the first one (the
  // preview shows its look). No title then. A change goes to every note; a setting the notes don't share shows
  // "Mixed" (ed.mixed) until it is picked. Effect changes send only the changed setting (fxKeys, main 'list:edit').
  const ed = { id: null, ids: [], mixed: new Set(), saving: 0, color: 'yellow', font: 'hand', title: '', opacity: 1, fx: null, timer: null, pending: null, tab: 'look', anchor: null };
  const many = () => ed.ids.length > 1;
  for (const c of COLORS) {
    $('#editColors').append(h('button', {
      type: 'button', class: 'sw', 'data-color': c, title: COLOR_NAMES[c], style: `background:${SWATCH[c]}`,
      onclick: () => editSet({ color: c }),
    }));
  }
  const edFxLayer = FX ? FX.Layer($('#editFxCanvas')) : null;
  const blankFx = () => ({ e: null, f: null, ea: null, fa: null, eo: null, fo: null, mi: null });
  function editFxList(box, kind) {
    const key = kind === 'effect' ? 'e' : 'f';
    const ids = kind === 'effect' ? FX.EFFECT_IDS : FX.FOLLOWER_IDS;
    const add = (v, label, icon) => {
      const b = h('button', { type: 'button', class: 'fxi', 'data-v': v === null ? '' : v, html: `${fxIcon(icon)}<span class="nm"><span class="nt"></span></span>${CHECK}` });
      b.querySelector('.nt').textContent = label;
      if (v === null) { b.querySelector('.nm').append(h('small', { class: 'allname' })); b.title = 'Same as all notes (Settings → Effects)'; }
      b.addEventListener('click', () => editFx(key, v));
      box.append(b);
    };
    add(null, 'Same as all', FX.ICONS.all); // 1.1.22: shorter, so every choice is the same height
    add('none', 'None', FX.ICONS.none);
    for (const id of ids) add(id, FX[kind === 'effect' ? 'EFFECTS' : 'FOLLOWERS'][id].name, FX.ICONS[kind][id]);
  }
  if (FX) { editFxList($('#editFxEffects'), 'effect'); editFxList($('#editFxFollowers'), 'follower'); }
  // 1.1.22 (fifth round): three tabs, Colour / Background / Mouse (was one long sheet with Background / Mouse inside it)
  function editTab(t) {
    if (!['look', 'e', 'f'].includes(t)) t = 'look';
    ed.tab = t;
    for (const b of $$('#editTabs button')) { const on = b.dataset.tab === t; b.classList.toggle('on', on); b.setAttribute('aria-selected', String(on)); }
    for (const sec of $$('#editSheet .epane')) sec.hidden = sec.dataset.tab !== t;
  }
  $$('#editTabs button').forEach((b) => b.addEventListener('click', () => editTab(b.dataset.tab)));
  // next to the note that was right-clicked (right of it if there's room, else left, else over the list's middle),
  // always fully inside the window; the list behind stays as it is
  function editPlace() {
    const box = $('#editBox'); const M = 10; const W = innerWidth; const H = innerHeight;
    box.style.left = '0px'; box.style.top = '0px';
    const bw = box.offsetWidth; const bh = box.offsetHeight;
    const a = ed.anchor && ed.anchor.isConnected ? ed.anchor.getBoundingClientRect() : null;
    let x; let y;
    if (a && a.right + 12 + bw <= W - M) x = a.right + 12;
    else if (a && a.left - 12 - bw >= M) x = a.left - 12 - bw;
    else x = (W - bw) / 2;
    y = a ? a.top - 8 : (H - bh) / 2;
    box.style.left = `${Math.round(Math.max(M, Math.min(x, W - bw - M)))}px`;
    box.style.top = `${Math.round(Math.max(M, Math.min(y, H - bh - M)))}px`;
  }
  window.addEventListener('resize', () => { if (ed.id) editPlace(); });
  function editFxPreview() {
    if (!edFxLayer || !ed.id) return;
    const n = V.state.notes.find((x) => x.id === ed.id) || {};
    const r = FX.resolve(ed.fx, V.state.settings, n.fxPaused, n.fxPlay);
    edFxLayer.resize();
    edFxLayer.set({ paper: ed.color, effect: r.effect, follower: r.follower, effectAmount: r.effectAmount, followerAmount: r.followerAmount, effectOpacity: r.effectOpacity, followerOpacity: r.followerOpacity, interact: r.interact, dark: DARK_COLORS.includes(ed.color) });
    edFxLayer.setPaused(!!V.state.settings.fxPaused && !n.fxPlay);
    return r;
  }
  function editPaint() {
    $('#editPaper').dataset.color = ed.color;
    const mix = (k) => ed.mixed.has(k);
    for (const b of $('#editColors').children) b.classList.toggle('on', !mix('color') && b.dataset.color === ed.color);
    $('#editColorName').textContent = mix('color') ? 'Mixed' : COLOR_NAMES[ed.color] || '';
    const pct = Math.round(ed.opacity * 100);
    if (document.activeElement !== $('#editOpacity')) $('#editOpacity').value = String(pct);
    $('#editOpVal').textContent = mix('opacity') ? 'Mixed' : pct >= 100 ? 'Solid' : `${pct}%`;
    $('#editFontRow').hidden = !many();
    for (const b of $$('#editFonts button')) b.classList.toggle('on', !mix('font') && b.dataset.font === ed.font);
    $('#editFontName').textContent = mix('font') ? 'Mixed' : '';
    if (!FX) return;
    const s = V.state.settings; const mine = ed.fx || blankFx();
    for (const [box, kind, key, all] of [[$('#editFxEffects'), 'effect', 'e', s.fxEffect], [$('#editFxFollowers'), 'follower', 'f', s.fxFollower]]) {
      for (const b of box.children) {
        const v = b.dataset.v === '' ? null : b.dataset.v;
        const on = !mix(key) && (mine[key] ?? null) === v;
        b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on));
        if (v === null) b.querySelector('.allname').textContent = all && all !== 'none' ? fxName(kind, all) : 'None';
      }
    }
    const r = editFxPreview() || FX.resolve(ed.fx, s);
    // with several notes and different effects, the settings under them stay usable
    const eOn = r.effect !== 'none' || mix('e'); const fOn = r.follower !== 'none' || mix('f');
    for (const [id, cur, kindOn, k] of [['#editFxEAmt', r.effectAmount, eOn, 'ea'], ['#editFxFAmt', r.followerAmount, fOn, 'fa']]) {
      $(id).classList.toggle('off', !kindOn); // 1.1.22: greyed out with None, not hidden
      $$(`${id} button`).forEach((b) => { b.classList.toggle('on', !mix(k) && b.dataset.a === cur); b.disabled = !kindOn; });
    }
    for (const [id, op, kindOn, k] of [['#editFxEOp', r.effectOpacity, eOn, 'eo'], ['#editFxFOp', r.followerOpacity, fOn, 'fo']]) {
      const pct2 = Math.round(op * 100); const range = $(`${id} input`);
      $(id).classList.toggle('off', !kindOn);
      if (document.activeElement !== range) range.value = String(pct2);
      range.disabled = !kindOn || !!s.fxForceAll;
      $(`${id} em`).textContent = mix(k) ? 'Mixed' : `${pct2}%`;
    }
    for (const el of $$('#editSheet .editFxForce')) el.hidden = !s.fxForceAll;
    $('#editFxInteractRow').classList.toggle('off', !eOn);
    $('#editFxInteract').checked = r.interact;
    $('#editFxInteract').indeterminate = mix('mi');
    $('#editFxInteract').disabled = !eOn || !!s.fxForceAll;
  }
  function openEdit(n) {
    const anchor = V.ctxCard && V.ctxCard.isConnected ? V.ctxCard : null; // the card that was right-clicked
    hideCtx();
    if (ed.id) closeEdit();
    ed.id = n.id;
    ed.ids = [n.id];
    ed.mixed = new Set();
    ed.pending = null;
    ed.color = n.color;
    ed.title = n.title || '';
    ed.opacity = Number(n.opacity) || 1;
    ed.fx = { ...blankFx(), ...(n.fx || {}) };
    $('#editTitle').value = ed.title;
    paintCover(n);
    editShow(anchor);
  }
  // 1.2.2: the selection bar's Edit design: the same sheet for all the picked notes (no title, no anchor card)
  function openEditMany(notes) {
    notes = notes.filter((n) => n && !n.deletedAt);
    if (!notes.length) return;
    if (notes.length === 1) { V.ctxCard = null; openEdit(notes[0]); return; }
    hideCtx();
    if (ed.id) closeEdit();
    ed.ids = notes.map((n) => n.id);
    ed.id = ed.ids[0];
    ed.pending = null;
    editLoadMany(notes);
    $('#editTitle').value = `${notes.length} notes`;
    $('#editCoverRow').hidden = true;
    editShow(null);
  }
  // the look of several notes: the first one's, and which settings they don't share
  function editLoadMany(notes, keepOpacity = false) {
    const fxOf = (n) => ({ ...blankFx(), ...(n.fx || {}) });
    const lead = notes[0];
    const differs = (get) => notes.some((n) => get(n) !== get(lead));
    ed.mixed = new Set();
    ed.color = lead.color;
    if (differs((n) => n.color)) ed.mixed.add('color');
    ed.font = lead.font || 'hand';
    if (differs((n) => n.font || 'hand')) ed.mixed.add('font');
    if (!keepOpacity) ed.opacity = Number(lead.opacity) || 1;
    if (differs((n) => Number(n.opacity) || 1)) ed.mixed.add('opacity');
    ed.fx = fxOf(lead);
    for (const k of Object.keys(blankFx())) if (differs((n) => fxOf(n)[k] ?? null)) ed.mixed.add(k);
  }
  function editShow(anchor) {
    const several = many();
    $('#editBox h3').textContent = several ? `Edit design · ${ed.ids.length} notes` : 'Edit design';
    $('#editTitle').readOnly = several;
    $('#editTitle').tabIndex = several ? -1 : 0;
    $('#editOpen').textContent = several ? 'Open notes' : 'Open note';
    $('#editSheet').hidden = false;
    ed.anchor = anchor; if (anchor) anchor.classList.add('editing');
    editTab(ed.tab);
    editPaint();
    editPlace();
    requestAnimationFrame(() => {
      editFxPreview();
      if (several) return; // nothing to type; a focused swatch would look picked
      const t = $('#editTitle');
      t.focus();
      t.setSelectionRange(t.value.length, t.value.length);
    });
  }
  function editQueue(patch, now = false, wait = 350) {
    if (!ed.id) return;
    ed.pending = { ...(ed.pending || {}), ...patch };
    clearTimeout(ed.timer);
    if (now) editFlush(); else ed.timer = setTimeout(editFlush, wait);
  }
  async function editFlush() {
    clearTimeout(ed.timer);
    if (!ed.id || !ed.pending) return;
    const ids = ed.ids.slice();
    const patch = ed.pending;
    ed.pending = null;
    ed.saving++;
    try {
      const { font, ...rest } = patch; // the font goes the way the old Colour pop-up sent it ('list:apply')
      if (font) await S.list.apply(ids, { font });
      if (Object.keys(rest).length) for (const id of ids) await S.list.edit(id, rest);
    } finally { ed.saving--; }
  }
  function editSet(patch) {
    if (!ed.id) return;
    Object.assign(ed, patch);
    for (const k of Object.keys(patch)) ed.mixed.delete(k);
    editPaint();
    editQueue(patch, true);
  }
  // one effect setting (e, f, ea, fa, eo, fo, mi). Several notes: only that setting is sent, so each note keeps its
  // other effect picks
  function fxPatch(key, v) {
    return many() ? { fxKeys: { ...((ed.pending || {}).fxKeys || {}), [key]: v } } : { fx: ed.fx };
  }
  function editFx(key, v) {
    if (!ed.id) return;
    ed.fx = { ...ed.fx, [key]: v };
    ed.mixed.delete(key);
    editPaint();
    editQueue(fxPatch(key, v), true);
  }
  function closeEdit() {
    if (!ed.id) return;
    editFlush();
    ed.id = null;
    ed.ids = [];
    ed.mixed = new Set();
    $('#editTitle').readOnly = false;
    $('#editSheet').hidden = true;
    document.querySelectorAll('.card.editing').forEach((c) => c.classList.remove('editing')); ed.anchor = null;
    if (edFxLayer) edFxLayer.set({}); // nothing plays while the sheet is closed
  }
  // the note changed somewhere else (its window, the selection bar…) while the sheet is open
  function editRefresh() {
    if (!ed.id) return;
    if (many()) return editRefreshMany();
    const n = V.state.notes.find((x) => x.id === ed.id);
    if (!n || n.deletedAt) { ed.pending = null; closeEdit(); return; }
    if (ed.pending) return; // our own change is on its way
    let changed = false;
    if (n.color !== ed.color) { ed.color = n.color; changed = true; }
    if (Number.isFinite(Number(n.opacity)) && Number(n.opacity) !== ed.opacity && document.activeElement !== $('#editOpacity')) { ed.opacity = Number(n.opacity); changed = true; }
    if (n.fx && JSON.stringify({ ...blankFx(), ...n.fx }) !== JSON.stringify(ed.fx)) { ed.fx = { ...blankFx(), ...n.fx }; changed = true; }
    editPaint(); // also when only Settings changed ("Same as all notes" shows its name)
    const typingHere = document.hasFocus() && document.activeElement === $('#editTitle');
    if ((n.title || '') !== ed.title && !typingHere) { ed.title = n.title || ''; $('#editTitle').value = ed.title; }
    paintCover(n);
    return changed;
  }
  function editRefreshMany() {
    const notes = ed.ids.map((id) => V.state.notes.find((x) => x.id === id)).filter((n) => n && !n.deletedAt);
    if (!notes.length) { ed.pending = null; closeEdit(); return; }
    if (notes.length !== ed.ids.length) { // some went to the Bin
      ed.ids = notes.map((n) => n.id); ed.id = ed.ids[0];
      $('#editBox h3').textContent = `Edit design · ${ed.ids.length} notes`;
      $('#editTitle').value = `${ed.ids.length} notes`;
    }
    if (!ed.pending && !ed.saving) editLoadMany(notes, document.activeElement === $('#editOpacity'));
    editPaint();
  }
  // 1.1.30: a locked card's title field is its "title while locked" (main sends that as its title, cover: true); a locked
  // note that is unlocked right now shows its real title there and the cover title in its own field
  function paintCover(n) {
    $('#editTitle').placeholder = n.cover ? 'Title while locked (optional)' : 'Title (optional)';
    $('#editCoverRow').hidden = !!n.cover || !noteIsLocked(n);
    if (document.activeElement !== $('#editCover')) $('#editCover').value = n.coverTitle || '';
  }
  $('#editCover').addEventListener('input', () => editQueue({ coverTitle: $('#editCover').value }));
  $('#editCover').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); closeEdit(); } });
  $('#editTitle').addEventListener('input', () => { if (many()) return; ed.title = $('#editTitle').value; editQueue({ title: ed.title }); });
  $('#editTitle').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); closeEdit(); } });
  // see-through: the open note window follows while dragging (saved 120 ms after the slider stops)
  $('#editOpacity').addEventListener('input', (e) => {
    ed.opacity = Number(e.target.value) / 100;
    ed.mixed.delete('opacity');
    $('#editOpVal').textContent = ed.opacity >= 1 ? 'Solid' : `${e.target.value}%`;
    editQueue({ opacity: ed.opacity }, false, 120);
  });
  $('#editOpacity').addEventListener('change', () => editFlush());
  for (const [id, key] of [['#editFxEAmt', 'ea'], ['#editFxFAmt', 'fa']]) {
    $$(`${id} button`).forEach((b) => b.addEventListener('click', () => editFx(key, b.dataset.a)));
  }
  for (const [id, key] of [['#editFxEOp', 'eo'], ['#editFxFOp', 'fo']]) {
    const range = $(`${id} input`);
    range.addEventListener('input', () => {
      const v = Number(range.value) / 100;
      ed.fx = { ...ed.fx, [key]: v };
      ed.mixed.delete(key);
      $(`${id} em`).textContent = `${range.value}%`;
      editFxPreview();
      editQueue(fxPatch(key, v), false, 120);
    });
    range.addEventListener('change', () => editFlush());
  }
  $$('#editFonts button').forEach((b) => b.addEventListener('click', () => editSet({ font: b.dataset.font })));
  $('#editFxInteract').addEventListener('change', (e) => editFx('mi', e.target.checked));
  // the follower plays when the mouse moves over the paper
  $('#editPaper').addEventListener('pointermove', (e) => { if (!edFxLayer) return; const r = $('#editFxCanvas').getBoundingClientRect(); edFxLayer.move(e.clientX - r.left, e.clientY - r.top); });
  $('#editPaper').addEventListener('pointerleave', () => { if (edFxLayer) edFxLayer.leave(); });
  if (FX && window.ResizeObserver) new ResizeObserver(() => { if (ed.id) edFxLayer.resize(); }).observe($('#editPaper'));
  $('#editBox').addEventListener('submit', (e) => { e.preventDefault(); closeEdit(); });
  $('#editX').addEventListener('click', () => closeEdit());
  $('#editSheet').addEventListener('mousedown', (e) => { if (e.target === $('#editSheet')) closeEdit(); });
  $('#editOpen').addEventListener('click', async () => {
    const ids = ed.ids.slice(); closeEdit();
    for (const id of ids) await S.list.openNote(id);
  });

  Object.assign(K, { FX, paintFx, fxSummary, closeFxSheet, paintFxPause, openEdit, openEditMany, closeEdit, editRefresh });
})();
