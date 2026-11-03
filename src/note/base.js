'use strict';
// CosmoNotes note window, part 1 of 10: the colour row, saving, dates, look & settings, effects on the note
// (src/note.js until 1.1.44; the parts load in order from note.html. How they share names: ai-context/splitting-code.md)
(() => {
  // K: the names the parts share. V: variables more than one part changes (V.note etc.). K.later('f'): a function a later part
  // defines, looked up when it is called.
  const K = window.COSMO_NOTE_KIT = { V: {}, later: (n) => (...a) => K[n](...a) };
  const { V } = K;
  // defined in a later part:
  const paintFxPop = K.later('paintFxPop'), setFxPlaying = K.later('setFxPlaying'),
    applySpell = K.later('applySpell'), decorate = K.later('decorate'), applyZoom = K.later('applyZoom'),
    applyLayout = K.later('applyLayout'), fitSideways = K.later('fitSideways');
  const api = window.sticky;
  // 1.1.15: while the drawing toolbar is outside the note, it lives in its own little window (inkOut below);
  // $ and $$ look there too, so the code that paints and wires up the toolbar works the same either way.
  // 1.1.16: the text toolbar too (textOut), so there can be two of those windows.
  const outDocs = new Set();
  const $ = (s) => { const el = document.querySelector(s); if (el) return el; for (const d of outDocs) { const x = d.querySelector(s); if (x) return x; } return null; };
  const $$ = (s) => { const all = [...document.querySelectorAll(s)]; for (const d of outDocs) all.push(...d.querySelectorAll(s)); return all; };
  const editor = $('#editor');
  const body = document.body;

  V.note = null;
  V.hidden = false; // locked note whose contents are not shown
  V.settings = { spellCheck: false, hasPassword: false };
  V.dirty = false;
  V.saveTimer = null;
  V.savedRange = null;

  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = (sec) => { sec = Math.max(0, Math.round(sec || 0)); return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`; };

  // ================================================================ colour row
  // A row of colour circles that scrolls sideways (1.1.15): drag it, use the mouse wheel, or the arrows that
  // show up on a side when there are more colours that way. A drag never counts as picking a colour.
  // (The same function is in list.js.)
  function swatchStrip(view) {
    const wrap = view.parentElement;
    const arrow = (side) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = `swarr ${side}`;
      b.title = 'More colours';
      b.setAttribute('aria-label', side === 'l' ? 'More colours to the left' : 'More colours to the right');
      b.innerHTML = `<svg viewBox="0 0 24 24"><path d="${side === 'l' ? 'm14.5 6-6 6 6 6' : 'm9.5 6 6 6-6 6'}"/></svg>`;
      b.addEventListener('mousedown', (e) => e.preventDefault()); // keeps the focus where it was
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        view.scrollBy({ left: (side === 'l' ? -1 : 1) * Math.max(60, Math.round(view.clientWidth * 0.75)), behavior: 'smooth' });
      });
      wrap.append(b);
      return b;
    };
    const left = arrow('l');
    const right = arrow('r');
    const paint = () => {
      const max = view.scrollWidth - view.clientWidth;
      left.hidden = view.scrollLeft <= 1;
      right.hidden = max <= 1 || view.scrollLeft >= max - 1;
    };
    view.addEventListener('scroll', paint, { passive: true });
    new ResizeObserver(paint).observe(view);
    view.addEventListener('wheel', (e) => {
      if (view.scrollWidth <= view.clientWidth + 1) return;
      const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      if (!d) return;
      e.preventDefault();
      view.scrollLeft += d;
    }, { passive: false });
    let drag = null;
    view.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      drag = { x: e.clientX, left: view.scrollLeft, moved: false, id: e.pointerId };
    });
    view.addEventListener('pointermove', (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      const dx = e.clientX - drag.x;
      if (!drag.moved && Math.abs(dx) < 4) return;
      if (!drag.moved) {
        drag.moved = true;
        view.classList.add('dragging');
        try { view.setPointerCapture(e.pointerId); } catch { /* fine */ }
      }
      view.scrollLeft = drag.left - dx;
    });
    const end = () => {
      if (!drag) return;
      const moved = drag.moved;
      drag = null;
      view.classList.remove('dragging');
      if (moved) { view.dataset.dragged = '1'; setTimeout(() => { delete view.dataset.dragged; }, 0); }
    };
    view.addEventListener('pointerup', end);
    view.addEventListener('pointercancel', end);
    view.addEventListener('click', (e) => { if (view.dataset.dragged) { e.stopPropagation(); e.preventDefault(); } }, true);
    paint();
    return {
      paint,
      // scroll so a colour (the chosen one) is in view
      reveal(el) {
        if (!el) { paint(); return; }
        const l = el.offsetLeft;
        const r = l + el.offsetWidth;
        if (l < view.scrollLeft + 6 || r > view.scrollLeft + view.clientWidth - 6) view.scrollLeft = Math.max(0, l - (view.clientWidth - el.offsetWidth) / 2);
        paint();
      },
    };
  }

  // ================================================================ saving
  function collect() {
    const clone = editor.cloneNode(true);
    clone.querySelectorAll('.voice').forEach((v) => {
      v.classList.remove('playing');
      v.querySelectorAll('i.on').forEach((i) => i.classList.remove('on'));
      const t = v.querySelector('.v-time');
      if (t) t.textContent = fmt(+v.dataset.dur);
    });
    clone.querySelectorAll('.sel-img').forEach((i) => i.classList.remove('sel-img'));
    clone.querySelectorAll('.caret-near').forEach((i) => i.classList.remove('caret-near'));
    clone.querySelectorAll('.find-hit, .find-cur').forEach((i) => i.classList.remove('find-hit', 'find-cur'));
    // 1.1.22 (sixth round): the checkbox size / place measured for the screen (alignChecks) isn't saved
    clone.querySelectorAll('[style]').forEach((el) => { for (const v of K.CB_VARS) el.style.removeProperty(v); if (!el.getAttribute('style')) el.removeAttribute('style'); });
    clone.querySelectorAll('[class=""]').forEach((el) => el.removeAttribute('class'));
    const img = clone.querySelector('img');
    let text = editor.innerText.replace(/ /g, ' ').replace(/\n{3,}/g, '\n\n').trim();
    if (!text) {
      if (editor.querySelector('.voice')) text = '🎤 Voice note';
      else if (editor.querySelector('img.att-drawing')) text = '✏️ Drawing';
      else if (img) text = '🖼️ Photo';
    }
    return { html: clone.innerHTML, text, firstImage: img ? img.getAttribute('src') : null };
  }

  function changed() {
    if (V.hidden || !V.note) return;
    V.dirty = true;
    decorate();
    updateEmpty();
    clearTimeout(V.saveTimer);
    V.saveTimer = setTimeout(saveNow, 350);
  }

  function saveNow() {
    clearTimeout(V.saveTimer);
    if (!V.dirty || !V.note || V.hidden) return Promise.resolve();
    V.dirty = false;
    const data = collect();
    V.note.text = data.text;
    $('#title').textContent = titleText();
    return api.update(data).then(gotDates).catch(() => {});
  }

  window.addEventListener('beforeunload', () => {
    if (V.dirty && V.note && !V.hidden) { V.dirty = false; api.updateSync(collect()); }
    if (K.inkState.dirty && V.note && !V.hidden) { K.inkState.dirty = false; api.updateSync({ ink: V.note.ink }); }
  });
  window.addEventListener('blur', saveNow);

  // Catch every edit (typing, undo, paste, commands); ignore voice-player animation.
  const observer = new MutationObserver((records) => {
    fitSideways();
    if (records.some((r) => !(r.target.closest ? r.target : r.target.parentElement)?.closest?.('.voice'))) changed();
  });

  function isEmpty() {
    return !editor.textContent.trim() && !editor.querySelector('img,.voice,table,hr,li');
  }
  function updateEmpty() { editor.classList.toggle('empty', isEmpty()); }

  function titleText() {
    if (V.hidden) return (V.note && V.note.coverTitle && V.note.coverTitle.trim()) || 'Locked note'; // 1.1.30: the title is hidden too
    if (V.note && V.note.title && V.note.title.trim()) return V.note.title.trim();
    const line = (V.note && V.note.text ? V.note.text : editor.innerText).split('\n').map((s) => s.trim()).find(Boolean);
    return line || 'CosmoNotes';
  }

  // ================================================================ dates
  function when(ts) {
    const d = new Date(ts);
    const now = new Date();
    const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const day = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
    const diff = Math.round((day(now) - day(d)) / 864e5);
    if (diff === 0) return `today ${time}`;
    if (diff === 1) return `yesterday ${time}`;
    return d.toLocaleDateString([], { day: 'numeric', month: 'short', year: d.getFullYear() === now.getFullYear() ? undefined : 'numeric' }) + `, ${time}`;
  }
  function full(ts) {
    return new Date(ts).toLocaleString([], { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }
  function showDates() {
    if (!V.note) return;
    $('#stamp').textContent = V.note.updatedAt ? `Edited ${when(V.note.updatedAt)}` : '';
    $('#dates').innerHTML = `Created <b>${esc(full(V.note.createdAt))}</b><br>Last edited <b>${esc(full(V.note.updatedAt))}</b>`;
  }
  function gotDates(n) {
    if (n && n.updatedAt) { V.note.updatedAt = n.updatedAt; V.note.createdAt = n.createdAt || V.note.createdAt; showDates(); }
  }
  setInterval(showDates, 60e3);

  // ================================================================ look & settings
  function applyLook() {
    body.dataset.color = V.note.color;
    body.dataset.font = V.note.font;
    body.dataset.size = V.note.size;
    body.classList.toggle('rolled', !!V.note.rolled);
    body.classList.toggle('has-title', V.hidden ? !!(V.note.coverTitle && V.note.coverTitle.trim()) : !!(V.note.title && V.note.title.trim()));
    body.classList.toggle('locked-hidden', V.hidden);
    $('#lockScreen').hidden = !V.hidden;
    $('#btnRelock').hidden = !(V.note.lockedBy && !V.hidden);
    $('#btnRoll').title = V.note.rolled ? 'Unroll note' : 'Roll up to just the top bar';
    $('#miLock').hidden = V.hidden;
    const byGroup = !V.note.locked && V.note.lockedBy === 'group';
    $('#miLock').disabled = byGroup;
    $('#miLockText').textContent = V.note.locked ? 'Remove lock' : byGroup ? 'Locked with its group' : 'Lock note';
    // 1.1.13: a locked note can't be deleted (remove the lock first)
    $('#miDelete').disabled = !!V.note.lockedBy;
    $('#miDeleteText').innerHTML = V.note.lockedBy ? 'Delete note <small>(remove the lock first)</small>' : 'Delete note <small>(goes to the bin)</small>';
    if (document.activeElement !== $('#titleInput')) $('#titleInput').value = V.note.title || '';
    $('#coverRow').hidden = !V.note.lockedBy;
    if (document.activeElement !== $('#coverInput')) $('#coverInput').value = V.note.coverTitle || '';
    applySpell();
    applyZoom();
    applyLayout();
    showDates();
    const pin = $('#btnPin');
    pin.setAttribute('aria-pressed', String(!!V.note.pinned));
    pin.title = V.note.pinned ? 'Unpin (let other windows cover it)' : 'Pin on top of other windows';
    $('#title').textContent = titleText();
    $$('#colors .sw').forEach((b) => b.classList.toggle('on', b.dataset.color === V.note.color));
    $$('#fontSeg button').forEach((b) => b.classList.toggle('on', b.dataset.font === V.note.font));
    $$('#sizeSeg button').forEach((b) => b.classList.toggle('on', b.dataset.size === V.note.size));
    const pct = Math.round(V.note.opacity * 100);
    $('#opacity').value = String(pct);
    $('#opVal').textContent = pct === 100 ? 'Solid' : `${pct}%`;
    $('#solidHover').checked = !!V.note.solidOnHover;
    applyFx();
  }

  // ================================================================ effects (1.1.16)
  // The note's effect plays behind everything (#fxCanvas, z-index -1), and its mouse follower trails the
  // pointer. What shows: Settings → Effects for all notes, unless this note chose its own (note.fx = { e, f },
  // null = same as all notes) or Settings says to use its choice on every note (fxForceAll). Paused by this
  // note's own button (note.fxPaused) or for all notes (settings.fxPaused, also in the tray menu). fx.js does
  // the drawing, in one shared loop that sleeps when nothing moves.
  const FX = window.COSMO_FX;
  const DARK_PAPERS = ['charcoal', 'night', 'midnight', 'forest', 'plum'];
  const fxLayer = FX ? FX.Layer($('#fxCanvas')) : null;
  const fxName = (kind, id) => (id === 'none' ? 'None' : ((kind === 'effect' ? FX.EFFECTS : FX.FOLLOWERS)[id] || {}).name || 'None');
  function applyFx() {
    if (!fxLayer || !V.note) return;
    const r = FX.resolve(V.note.fx, V.settings, V.note.fxPaused, V.note.fxPlay);
    fxLayer.resize();
    fxLayer.set({ paper: V.note.color, effect: r.effect, follower: r.follower, effectAmount: r.effectAmount, followerAmount: r.followerAmount, effectOpacity: r.effectOpacity, followerOpacity: r.followerOpacity, interact: r.interact, dark: DARK_PAPERS.includes(V.note.color) });
    fxLayer.setPaused(r.paused);
    fxLayer.setVisible(!V.note.rolled);
    const any = r.effect !== 'none' || r.follower !== 'none';
    const b = $('#btnFx');
    b.hidden = !any;
    b.classList.toggle('off', r.paused);
    b.setAttribute('aria-pressed', String(r.paused));
    b.title = r.paused ? (V.settings.fxPaused ? 'Play effects on this note (all others stay paused)' : 'Play effects on this note') : 'Pause effects on this note';
    const parts = [r.effect !== 'none' ? fxName('effect', r.effect) : '', r.follower !== 'none' ? fxName('follower', r.follower) : ''].filter(Boolean);
    $('#miFxVal').textContent = parts.length ? parts.join(' · ') : 'None';
    if (!$('#fxPop').hidden) paintFxPop();
  }
  window.addEventListener('resize', () => { if (fxLayer) fxLayer.resize(); });
  document.addEventListener('pointermove', (e) => { if (fxLayer) fxLayer.move(e.clientX, e.clientY); }, { passive: true });
  document.documentElement.addEventListener('mouseleave', () => { if (fxLayer) fxLayer.leave(); });
  $('#btnFx').addEventListener('click', () => {
    setFxPlaying(FX.resolve(V.note.fx, V.settings, V.note.fxPaused, V.note.fxPlay).paused);
  });
  Object.assign(K, { api, outDocs, $, $$, editor, body, esc, fmt, swatchStrip, changed, saveNow, observer,
    updateEmpty, titleText, gotDates, applyLook, FX, fxName, applyFx });
})();
