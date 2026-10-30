'use strict';
(() => {
  const api = window.sticky;
  // 1.1.15: while the drawing toolbar is outside the note, it lives in its own little window (inkOut below);
  // $ and $$ look there too, so the code that paints and wires up the toolbar works the same either way.
  // 1.1.16: the text toolbar too (textOut), so there can be two of those windows.
  const outDocs = new Set();
  const $ = (s) => { const el = document.querySelector(s); if (el) return el; for (const d of outDocs) { const x = d.querySelector(s); if (x) return x; } return null; };
  const $$ = (s) => { const all = [...document.querySelectorAll(s)]; for (const d of outDocs) all.push(...d.querySelectorAll(s)); return all; };
  const editor = $('#editor');
  const body = document.body;

  let note = null;
  let hidden = false; // locked note whose contents are not shown
  let settings = { spellCheck: false, hasPassword: false };
  let dirty = false;
  let saveTimer = null;
  let savedRange = null;

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
    clone.querySelectorAll('[style]').forEach((el) => { for (const v of CB_VARS) el.style.removeProperty(v); if (!el.getAttribute('style')) el.removeAttribute('style'); });
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
    if (hidden || !note) return;
    dirty = true;
    decorate();
    updateEmpty();
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveNow, 350);
  }

  function saveNow() {
    clearTimeout(saveTimer);
    if (!dirty || !note || hidden) return Promise.resolve();
    dirty = false;
    const data = collect();
    note.text = data.text;
    $('#title').textContent = titleText();
    return api.update(data).then(gotDates).catch(() => {});
  }

  window.addEventListener('beforeunload', () => {
    if (dirty && note && !hidden) { dirty = false; api.updateSync(collect()); }
    if (inkState.dirty && note && !hidden) { inkState.dirty = false; api.updateSync({ ink: note.ink }); }
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
    if (note && note.title && note.title.trim()) return note.title.trim();
    if (hidden) return 'Locked note';
    const line = (note && note.text ? note.text : editor.innerText).split('\n').map((s) => s.trim()).find(Boolean);
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
    if (!note) return;
    $('#stamp').textContent = note.updatedAt ? `Edited ${when(note.updatedAt)}` : '';
    $('#dates').innerHTML = `Created <b>${esc(full(note.createdAt))}</b><br>Last edited <b>${esc(full(note.updatedAt))}</b>`;
  }
  function gotDates(n) {
    if (n && n.updatedAt) { note.updatedAt = n.updatedAt; note.createdAt = n.createdAt || note.createdAt; showDates(); }
  }
  setInterval(showDates, 60e3);

  // ================================================================ look & settings
  function applyLook() {
    body.dataset.color = note.color;
    body.dataset.font = note.font;
    body.dataset.size = note.size;
    body.classList.toggle('rolled', !!note.rolled);
    body.classList.toggle('has-title', !!(note.title && note.title.trim()));
    body.classList.toggle('locked-hidden', hidden);
    $('#lockScreen').hidden = !hidden;
    $('#btnRelock').hidden = !(note.lockedBy && !hidden);
    $('#btnRoll').title = note.rolled ? 'Unroll note' : 'Roll up to just the top bar';
    $('#miLock').hidden = hidden;
    const byGroup = !note.locked && note.lockedBy === 'group';
    $('#miLock').disabled = byGroup;
    $('#miLockText').textContent = note.locked ? 'Remove lock' : byGroup ? 'Locked with its group' : 'Lock note';
    // 1.1.13: a locked note can't be deleted (remove the lock first)
    $('#miDelete').disabled = !!note.lockedBy;
    $('#miDeleteText').innerHTML = note.lockedBy ? 'Delete note <small>(remove the lock first)</small>' : 'Delete note <small>(goes to the bin)</small>';
    if (document.activeElement !== $('#titleInput')) $('#titleInput').value = note.title || '';
    applySpell();
    applyZoom();
    applyLayout();
    showDates();
    const pin = $('#btnPin');
    pin.setAttribute('aria-pressed', String(!!note.pinned));
    pin.title = note.pinned ? 'Unpin (let other windows cover it)' : 'Pin on top of other windows';
    $('#title').textContent = titleText();
    $$('#colors .sw').forEach((b) => b.classList.toggle('on', b.dataset.color === note.color));
    $$('#fontSeg button').forEach((b) => b.classList.toggle('on', b.dataset.font === note.font));
    $$('#sizeSeg button').forEach((b) => b.classList.toggle('on', b.dataset.size === note.size));
    const pct = Math.round(note.opacity * 100);
    $('#opacity').value = String(pct);
    $('#opVal').textContent = pct === 100 ? 'Solid' : `${pct}%`;
    $('#solidHover').checked = !!note.solidOnHover;
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
    if (!fxLayer || !note) return;
    const r = FX.resolve(note.fx, settings, note.fxPaused, note.fxPlay);
    fxLayer.resize();
    fxLayer.set({ paper: note.color, effect: r.effect, follower: r.follower, effectAmount: r.effectAmount, followerAmount: r.followerAmount, effectOpacity: r.effectOpacity, followerOpacity: r.followerOpacity, interact: r.interact, dark: DARK_PAPERS.includes(note.color) });
    fxLayer.setPaused(r.paused);
    fxLayer.setVisible(!note.rolled);
    const any = r.effect !== 'none' || r.follower !== 'none';
    const b = $('#btnFx');
    b.hidden = !any;
    b.classList.toggle('off', r.paused);
    b.setAttribute('aria-pressed', String(r.paused));
    b.title = r.paused ? (settings.fxPaused ? 'Play effects on this note (all others stay paused)' : 'Play effects on this note') : 'Pause effects on this note';
    const parts = [r.effect !== 'none' ? fxName('effect', r.effect) : '', r.follower !== 'none' ? fxName('follower', r.follower) : ''].filter(Boolean);
    $('#miFxVal').textContent = parts.length ? parts.join(' · ') : 'None';
    if (!$('#fxPop').hidden) paintFxPop();
  }
  window.addEventListener('resize', () => { if (fxLayer) fxLayer.resize(); });
  document.addEventListener('pointermove', (e) => { if (fxLayer) fxLayer.move(e.clientX, e.clientY); }, { passive: true });
  document.documentElement.addEventListener('mouseleave', () => { if (fxLayer) fxLayer.leave(); });
  $('#btnFx').addEventListener('click', () => {
    setFxPlaying(FX.resolve(note.fx, settings, note.fxPaused, note.fxPlay).paused);
  });
  // ---- the Effects pop-up (⋯ menu → Effects…): a list of icons and names
  const CHECK = '<svg class="ok" viewBox="0 0 24 24"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>';
  const fxIcon = ([col, inner]) => `<span class="ic"${col ? ` style="--ic:${col}"` : ''}><svg viewBox="0 0 24 24">${inner}</svg></span>`;
  function fxList(box, kind) {
    const ids = kind === 'effect' ? FX.EFFECT_IDS : FX.FOLLOWER_IDS;
    const key = kind === 'effect' ? 'e' : 'f';
    const item = (v, label, icon) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'fxi';
      b.dataset.v = v === null ? '' : v;
      b.innerHTML = `${fxIcon(icon)}<span class="nm"><span class="nt"></span></span>${CHECK}`;
      b.querySelector('.nt').textContent = label;
      if (v === null) { b.querySelector('.nm').append(Object.assign(document.createElement('small'), { className: 'allname' })); b.title = 'Same as all notes (Settings → Effects)'; }
      b.addEventListener('click', () => setProp({ fx: { ...(note.fx || { e: null, f: null }), [key]: v } }));
      box.append(b);
    };
    item(null, 'Same as all', FX.ICONS.all); // 1.1.22: shorter, so every choice is the same height (full name in its tooltip)
    item('none', 'None', FX.ICONS.none);
    for (const id of ids) item(id, fxName(kind, id), FX.ICONS[kind][id]);
  }
  if (FX) { fxList($('#fxEffects'), 'effect'); fxList($('#fxFollowers'), 'follower'); }
  for (const [id, key] of [['#fxEAmt', 'ea'], ['#fxFAmt', 'fa']]) {
    $$(`${id} button`).forEach((b) => b.addEventListener('click', () => setProp({ fx: { ...(note.fx || { e: null, f: null }), [key]: b.dataset.a } })));
  }
  // 1.1.17: opacity of this note's background / mouse follower (eo / fo). Dragging shows it at once; it's saved
  // when the slider is let go (and 300 ms after it stops moving, in case the release isn't seen)
  let fxOpTimer = null;
  const saveFxOp = () => { clearTimeout(fxOpTimer); fxOpTimer = null; setProp({ fx: { ...(note.fx || { e: null, f: null }) } }); };
  for (const [id, key] of [['#fxEOp', 'eo'], ['#fxFOp', 'fo']]) {
    const range = $(`${id} input`);
    range.addEventListener('input', () => {
      note.fx = { ...(note.fx || { e: null, f: null }), [key]: Number(range.value) / 100 };
      $(`${id} em`).textContent = `${range.value}%`;
      applyFx();
      clearTimeout(fxOpTimer); fxOpTimer = setTimeout(saveFxOp, 300);
    });
    range.addEventListener('change', saveFxOp);
  }
  function paintFxPop() {
    const mine = note.fx || { e: null, f: null };
    for (const [box, kind, key, all] of [[$('#fxEffects'), 'effect', 'e', settings.fxEffect], [$('#fxFollowers'), 'follower', 'f', settings.fxFollower]]) {
      for (const b of box.children) {
        const v = b.dataset.v === '' ? null : b.dataset.v;
        const on = (mine[key] ?? null) === v;
        b.classList.toggle('on', on);
        b.setAttribute('aria-pressed', String(on));
        if (v === null) b.querySelector('.allname').textContent = fxName(kind, all || 'none');
      }
    }
    // how much: what this note shows now (its own, or all notes' amount)
    const r = FX.resolve(note.fx, settings, note.fxPaused, note.fxPlay);
    // 1.1.22: with "None", frequency and opacity are greyed out (switched off), not hidden
    for (const [id, cur, kindOn] of [['#fxEAmt', r.effectAmount, r.effect !== 'none'], ['#fxFAmt', r.followerAmount, r.follower !== 'none']]) {
      $(id).classList.toggle('off', !kindOn);
      $$(`${id} button`).forEach((b) => { b.classList.toggle('on', b.dataset.a === cur); b.disabled = !kindOn; });
    }
    for (const [id, op, kindOn] of [['#fxEOp', r.effectOpacity, r.effect !== 'none'], ['#fxFOp', r.followerOpacity, r.follower !== 'none']]) {
      const pct = Math.round(op * 100);
      $(id).classList.toggle('off', !kindOn);
      $(`${id} input`).value = String(pct);
      $(`${id} input`).disabled = !kindOn || !!settings.fxForceAll; // Settings uses the same on every note: its opacity shows
      $(`${id} em`).textContent = `${pct}%`;
    }
    $('#fxForce').hidden = !settings.fxForceAll;
    // 1.1.21: the mouse plays with the background (only when there is one)
    $('#fxInteractRow').classList.toggle('off', r.effect === 'none');
    $('#fxInteract').checked = r.interact;
    $('#fxInteract').disabled = r.effect === 'none' || !!settings.fxForceAll;
    $('#fxPause').checked = r.paused;
    $('#fxPause').disabled = false;
  }
  // 1.1.16: two tabs (Background / Mouse), so the pop-up only shows one list and stays small
  function fxTab(t) {
    $$('#fxTabs button').forEach((b) => { b.classList.toggle('on', b.dataset.t === t); b.setAttribute('aria-pressed', String(b.dataset.t === t)); });
    $$('#fxPop .fxsec').forEach((s) => { s.hidden = s.dataset.t !== t; });
  }
  $$('#fxTabs button').forEach((b) => b.addEventListener('click', () => fxTab(b.dataset.t)));
  $('#miFx').addEventListener('click', () => { openPop('#fxPop'); requestAnimationFrame(paintFxPop); });
  $('#fxX').addEventListener('click', () => closePop('#fxPop'));
  $('#fxPause').addEventListener('change', (e) => setFxPlaying(!e.target.checked));
  $('#fxInteract').addEventListener('change', (e) => setProp({ fx: { ...(note.fx || { e: null, f: null }), mi: e.target.checked } }));
  // 1.1.16: this note's own pause wins over "pause all": playing it while all effects are paused sets fxPlay
  // (it keeps playing until it's paused here again); pausing it sets fxPaused
  function setFxPlaying(play) {
    if (play) setProp({ fxPaused: false, fxPlay: !!settings.fxPaused });
    else setProp(settings.fxPaused ? { fxPlay: false } : { fxPaused: true, fxPlay: false });
  }

  function setProp(patch) {
    Object.assign(note, patch);
    applyLook();
    return api.update(patch).then((n) => { gotDates(n); return n; });
  }

  // ================================================================ spelling
  // Spelling is ignored unless turned on (for all notes in Settings, or just
  // this note with the button). Cyrillic words are never underlined.
  function spellOn() {
    return note && note.spell !== null && note.spell !== undefined ? !!note.spell : !!settings.spellCheck;
  }
  function applySpell() {
    const on = spellOn();
    if (editor.spellcheck !== on) editor.spellcheck = on;
    const b = $('#btnSpell');
    b.classList.toggle('on', on);
    b.title = on
      ? 'Spelling check is ON for this note. Click to ignore spelling.'
      : 'Spelling is ignored. Click to check spelling in this note.';
  }
  $('#btnSpell').addEventListener('mousedown', (e) => e.preventDefault());
  $('#btnSpell').addEventListener('click', () => {
    const next = !spellOn();
    // Matching the Settings choice means "just follow Settings" again.
    setProp({ spell: next === !!settings.spellCheck ? null : next });
    toast(next ? 'Checking spelling in this note' : 'Ignoring spelling in this note');
  });
  // 1.1.16: pop-ups and toolbars in the app's colours (Settings → General → colours of the notes list)
  function applyTheme() { body.dataset.apptheme = settings.appTheme || 'cream'; }
  api.onSettings((s) => {
    settings = { ...settings, ...s };
    applyTheme();
    if (note) { applySpell(); applyFx(); }
    paintUnlock();
  });

  // ================================================================ selection helpers
  function anchor() {
    const s = getSelection();
    return s.rangeCount ? s.anchorNode : null;
  }
  function closestIn(node, sel) {
    while (node && node !== editor) {
      if (node.nodeType === 1 && node.matches(sel)) return node;
      node = node.parentNode;
    }
    return null;
  }
  function saveSel() {
    const s = getSelection();
    if (s.rangeCount && editor.contains(s.getRangeAt(0).commonAncestorContainer)) savedRange = s.getRangeAt(0).cloneRange();
  }
  function caretAtEnd() {
    const r = document.createRange();
    r.selectNodeContents(editor);
    r.collapse(false);
    const s = getSelection();
    s.removeAllRanges();
    s.addRange(r);
  }
  function restoreSel() {
    editor.focus({ preventScroll: true });
    const s = getSelection();
    if (savedRange && editor.contains(savedRange.startContainer)) {
      s.removeAllRanges();
      s.addRange(savedRange);
    } else if (!s.rangeCount || !editor.contains(s.anchorNode)) {
      caretAtEnd();
    }
  }
  function insertHTML(html) {
    restoreSel();
    document.execCommand('insertHTML', false, html);
    changed();
  }
  // For photos, drawings and voice notes: put the elements in exactly as written
  // (the browser's own insert command sometimes strips the voice-note wrapper).
  function insertNodes(html) {
    restoreSel();
    const s = getSelection();
    if (!s.rangeCount) caretAtEnd();
    const r = s.getRangeAt(0);
    r.deleteContents();
    const frag = r.createContextualFragment(html);
    const last = frag.lastChild;
    r.insertNode(frag);
    if (last) {
      const after = document.createRange();
      after.setStartAfter(last);
      after.collapse(true);
      s.removeAllRanges();
      s.addRange(after);
      savedRange = after.cloneRange();
      (last.nodeType === 1 ? last : last.parentElement)?.scrollIntoView({ block: 'nearest' });
    }
    changed();
  }

  document.addEventListener('selectionchange', () => {
    saveSel();
    if (!$('#textPop').hidden) paintTextPanel();
    updateToolState();
    if (resizing) return;
    $$('#editor .sel-img').forEach((i) => {
      const s = getSelection();
      if (!s.rangeCount || !s.getRangeAt(0).intersectsNode(i) || s.isCollapsed) i.classList.remove('sel-img');
    });
    placeHandle();
  });

  // ================================================================ formatting
  function toggleChecklist() {
    const ul = closestIn(anchor(), 'ul');
    if (ul && ul.classList.contains('checklist')) {
      document.execCommand('insertUnorderedList');
    } else if (ul) {
      ul.classList.add('checklist');
    } else {
      document.execCommand('insertUnorderedList');
      const nu = closestIn(anchor(), 'ul');
      if (nu) nu.classList.add('checklist');
    }
  }
  function toggleBullets() {
    const ul = closestIn(anchor(), 'ul');
    if (ul && ul.classList.contains('checklist')) {
      let top = ul;
      let p = ul.parentElement;
      while (p && p !== editor) { if (p.matches('ul.checklist')) top = p; p = p.parentElement; }
      top.classList.remove('checklist');
      top.querySelectorAll('ul.checklist, li.done').forEach((el) => el.classList.remove('checklist', 'done'));
    } else {
      document.execCommand('insertUnorderedList');
    }
  }

  function runCmd(cmd) {
    restoreSel();
    switch (cmd) {
      case 'bold': case 'italic': case 'underline': case 'strikeThrough':
        document.execCommand(cmd);
        break;
      case 'bullets': toggleBullets(); break;
      case 'checklist': toggleChecklist(); break;
      case 'numbers': document.execCommand('insertOrderedList'); break;
      default: break;
    }
    changed();
    updateToolState();
  }

  function updateToolState() {
    if (document.activeElement !== editor) return;
    for (const c of ['bold', 'italic', 'underline', 'strikeThrough']) {
      const b = $(`#tools [data-cmd="${c}"]`);
      try { b.classList.toggle('on', document.queryCommandState(c)); } catch { /* ignore */ }
    }
    const ul = closestIn(anchor(), 'ul');
    $('#tools [data-cmd="bullets"]').classList.toggle('on', !!ul && !ul.classList.contains('checklist') && !closestIn(ul, 'ul.checklist'));
    $('#tools [data-cmd="checklist"]').classList.toggle('on', !!ul && (ul.classList.contains('checklist') || !!closestIn(ul.parentNode, 'ul.checklist')));
  }

  $$('#tools [data-cmd]').forEach((b) => {
    b.addEventListener('mousedown', (e) => e.preventDefault());
    b.addEventListener('click', () => runCmd(b.dataset.cmd));
  });

  // ================================================================ popovers
  // 1.1.16: the ⋯ menu and the Effects pop-up can be dragged (by their grip) and out of the note, like the
  // toolbars: id → { out: barOut(…), move: movable(…) } (filled in further down, next to the toolbars)
  const popOuts = {};
  // 1.1.20 (the owner's wish): the editing menus (⋯, Effects, Add) no longer close each other: opening one leaves
  // the others open, the newest on top (clicking one brings it to the front). Each closes with its own button (or X),
  // and the "close all" button in the top bar (shown when two or more are open, text toolbar included) or Esc
  // closes them all. The small dialogs (password, link, questions) still replace each other.
  const EDIT_POPS = ['#menu', '#fxPop', '#insert'];
  const DIALOGS = ['#pwPop', '#linkPop', '#askPop', '#descPop'];
  function closePop(id) {
    const p = $(id);
    if (!p) return;
    if (id === '#askPop' && askResolve) { const r = askResolve; askResolve = null; r(false); }
    p.hidden = true;
    const po = popOuts[id];
    if (po) po.out.stop();
    syncPops();
  }
  // keepOut: a click in the note leaves a pop-up that's outside the note open (it closes with its X or Esc)
  function closePops(keepOut = false) {
    if (askResolve) { const r = askResolve; askResolve = null; r(false); }
    $$('.pop:not(#textPop)').forEach((p) => { // the text toolbar only closes by A or its X (or "close all")
      const po = popOuts[`#${p.id}`];
      if (keepOut && po && po.out.isOut() && !p.hidden) return;
      p.hidden = true;
      if (po) po.out.stop();
    });
    syncPops();
  }
  function closeAllPops() { closePops(); if (!$('#textPop').hidden) closeText(); syncPops(); }
  let popTop = null;
  function toFront(el) {
    if (popTop === el) return;
    for (const id of [...EDIT_POPS, '#textPop']) { const p = $(id); if (p) p.style.zIndex = ''; }
    el.style.zIndex = '21';
    popTop = el;
  }
  function syncPops() {
    const open = EDIT_POPS.concat(DIALOGS).some((id) => $(id) && !$(id).hidden);
    body.classList.toggle('pop-open', open);
    const many = [...EDIT_POPS, '#textPop'].filter((id) => $(id) && !$(id).hidden).length;
    const b = $('#btnCloseAll');
    if (b) b.hidden = many < 2;
  }
  function openPop(id) {
    for (const d of DIALOGS) if (d !== id && !$(d).hidden) closePop(d);
    if (DIALOGS.includes(id)) for (const e of EDIT_POPS) if (!$(e).hidden && !(popOuts[e] && popOuts[e].out.isOut())) closePop(e); // a dialog needs the room
    hideCtx();
    $(id).hidden = false;
    toFront($(id));
    syncPops();
    if (popOuts[id]) { popOuts[id].out.start(); popOuts[id].move.place(); }
    if (id === '#menu') colorStrip.reveal($('#colors .sw.on'));
  }
  function togglePop(id) {
    if (!$(id).hidden) closePop(id);
    else { saveSel(); openPop(id); }
  }
  document.addEventListener('mousedown', (e) => {
    // the text panel stays open while you click around the note; the A button (or Esc) closes it
    if (!e.target.closest('.pop, #btnMenu, #btnInsert, #btnText')) closePops(true);
    if (!e.target.closest('.ctx')) hideCtx();
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
  groupSwitches(document, '.check.switch');
  // Buttons inside popovers should not steal the text selection.
  $$('.pop button, .ctx').forEach((b) => b.addEventListener('mousedown', (e) => e.preventDefault()));
  // 1.1.20: clicking a menu brings it to the front; the top bar's button closes them all
  for (const id of [...EDIT_POPS, '#textPop']) $(id).addEventListener('pointerdown', (e) => toFront(e.currentTarget), true);
  $('#btnCloseAll').addEventListener('mousedown', (e) => e.preventDefault());
  $('#btnCloseAll').addEventListener('click', closeAllPops);

  // ---------- header
  $('#btnNew').addEventListener('click', () => { saveNow(); api.newNote(); });
  $('#btnClose').addEventListener('click', () => { saveNow(); api.close(); });
  $('#btnPin').addEventListener('click', () => setProp({ pinned: !note.pinned }));
  $('#btnMenu').addEventListener('click', () => togglePop('#menu'));
  $('#menuX').addEventListener('click', () => closePop('#menu'));
  // 1.1.13: minimise and maximise (double-clicking the top bar maximises too: Windows does that for the drag area)
  $('#btnMin').addEventListener('click', () => { closePops(); saveNow(); api.minimize(); });
  $('#btnMax').addEventListener('click', () => api.maximize());
  if (api.onWinState) api.onWinState((s) => {
    body.classList.toggle('maxed', !!(s && s.maximized));
    $('#btnMax').title = s && s.maximized ? 'Back to its normal size (or double-click the top bar)' : 'Maximise (or double-click the top bar)';
  });
  $('#btnList').addEventListener('click', () => { saveNow(); api.showList(); });
  $('#btnRoll').addEventListener('click', () => {
    closePops();
    // Rolling up keeps the drawing and text toolbars as they are: they're only hidden while the note is
    // rolled up (note.css body.rolled), so they never sit on the top bar, and come back when it unrolls.
    if (!note.rolled) finishStroke();
    saveNow();
    saveInk();
    setProp({ rolled: !note.rolled });
  });
  $('#btnRelock').addEventListener('click', relock);
  $('#btnInsert').addEventListener('mousedown', (e) => e.preventDefault());
  $('#btnInsert').addEventListener('click', () => togglePop('#insert'));
  $('#btnText').addEventListener('mousedown', (e) => e.preventDefault());
  // The text toolbar (A) stays open until A or its X is clicked: clicking the note, other pop-ups,
  // Esc or the drawing toolbar don't close it (rolling the note up or locking it does).
  function openText() {
    saveSel();
    body.classList.add('text-fresh'); // full strength until you type or click in the note again (1.1.14)
    $('#textPop').hidden = false;
    toFront($('#textPop'));
    syncPops();
    body.classList.add('text-open');
    textOut.start(); // its own window, ready for dragging it out (or straight outside, where it was last time; 1.1.16)
    textMove.place();
    paintTextPanel();
    // 1.1.23: opening it (its window) could take the selection away for a moment: put it back
    const keep = savedRange && !savedRange.collapsed ? savedRange.cloneRange() : null;
    if (keep) requestAnimationFrame(() => { const s = getSelection(); if (!s.rangeCount || s.isCollapsed) { editor.focus({ preventScroll: true }); s.removeAllRanges(); s.addRange(keep); } });
  }
  function closeText() {
    $('#textPop').hidden = true;
    syncPops();
    body.classList.remove('text-open');
    textOut.stop();
  }
  $('#btnText').addEventListener('click', () => ($('#textPop').hidden ? openText() : closeText()));
  $('#textX').addEventListener('click', closeText);

  // ---------- ⋯ menu
  $$('#colors .sw').forEach((b) => b.addEventListener('click', () => setProp({ color: b.dataset.color })));
  const colorStrip = swatchStrip($('#colors'));

  // see-through, in the ⋯ menu (1.1.22: no longer also in the Effects pop-up, at the owner's request)
  const opText = (v) => (v >= 1 ? 'Solid' : `${Math.round(v * 100)}%`);
  $('#opacity').addEventListener('input', (e) => {
    const v = Number(e.target.value) / 100;
    note.opacity = v;
    $('#opVal').textContent = opText(v);
    api.update({ opacity: v });
  });
  $('#solidHover').addEventListener('change', (e) => setProp({ solidOnHover: e.target.checked }));
  let titleTimer = null;
  $('#titleInput').addEventListener('input', (e) => {
    note.title = e.target.value;
    body.classList.toggle('has-title', !!note.title.trim());
    $('#title').textContent = titleText();
    clearTimeout(titleTimer);
    titleTimer = setTimeout(() => api.update({ title: note.title }).then(gotDates), 300);
  });
  $('#titleInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); closePop('#menu'); } });
  $('#miLock').addEventListener('click', toggleLock);
  $('#miDuplicate').addEventListener('click', async () => {
    closePops();
    await saveNow(); // the copy gets everything typed so far
    saveInk();
    api.duplicate();
  });
  $('#miDelete').addEventListener('click', async () => {
    closePops();
    if (note.lockedBy) { toast('Locked notes can’t be deleted. Remove the lock first.'); return; }
    saveNow();
    const r = await api.trash();
    if (r && r.error === 'locked') toast('Locked notes can’t be deleted. Remove the lock first.');
  });

  // see-through notes turn solid while the mouse is over them
  document.documentElement.addEventListener('mouseenter', () => api.hover(true));
  document.documentElement.addEventListener('mouseleave', () => api.hover(false));

  // ---------- Add panel
  $$('#insert [data-act]').forEach((b) => b.addEventListener('click', () => doInsert(b.dataset.act)));

  // ---------- text panel (A)
  // Every button changes the selected text. With nothing selected (1.1.16), it changes what you type next, from
  // the cursor on, and the rest of the note stays as it is (the top line says which). That's the browser's
  // "typing style": it lasts until the cursor moves somewhere else, and several buttons add up (red + Big).
  // Changes go through the editor's own undo, so Undo (and Ctrl+Z) can take them back. Another font on part of
  // the text is a <font face>, sized to match in note.css.
  const RESET_COLOR = '#010203';
  const FACE = { hand: 'Caveat', round: 'Nunito' };
  // Before 1.1.16 the font buttons changed the note's own font (not part of the text, so the editor's undo couldn't
  // take it back): kept here for undo/redo of those (cleared as soon as the text changes again, so undo stays in order).
  const textUndo = []; // { font } = the note's font before
  const textRedo = []; // { font } = the font an undo took away (1.1.14)
  const hasTextSel = () => !!(savedRange && !savedRange.collapsed && editor.contains(savedRange.commonAncestorContainer));
  function paintTextPanel() {
    if (!note) return;
    const sel = hasTextSel();
    const scope = `Changes: <b>${sel ? 'selected text' : 'what you type next'}</b>`;
    if ($('#tScope').innerHTML !== scope) $('#tScope').innerHTML = scope; // runs on every cursor move: only touch it when it changes
    let f = note.font;
    if (savedRange && document.activeElement === editor) {
      const v = String(document.queryCommandValue('fontName') || '').toLowerCase();
      f = v.includes('caveat') ? 'hand' : v.includes('nunito') ? 'round' : note.font;
    }
    $$('#fontSeg button').forEach((b) => b.classList.toggle('on', b.dataset.font === f));
  }
  // the cursor is exactly where it was saved (then it's left alone: putting it back would forget the typing style)
  function caretIsSaved() {
    const s = getSelection();
    if (!s.rangeCount || !savedRange) return false;
    const r = s.getRangeAt(0);
    return r.collapsed && r.startContainer === savedRange.startContainer && r.startOffset === savedRange.startOffset;
  }
  // "Normal" colour = the sentinel colour, then taken off again (also from text typed later in that colour)
  function cleanResetColor() {
    editor.querySelectorAll(`font[color="${RESET_COLOR}"]`).forEach((f) => {
      f.removeAttribute('color');
      if (!f.attributes.length) f.replaceWith(...f.childNodes);
    });
    editor.querySelectorAll('[style*="color"]').forEach((el) => {
      if (/rgb\(1, 2, 3\)/.test(el.style.color)) el.style.color = '';
      if (!el.getAttribute('style')) el.removeAttribute('style');
    });
  }
  function onText(fn) {
    const sel = hasTextSel();
    const before = editor.innerHTML;
    if (document.activeElement !== editor) editor.focus({ preventScroll: true });
    if (sel || !caretIsSaved()) restoreSel();
    fn(sel);
    if (sel) cleanResetColor();
    if (editor.innerHTML !== before) changed();
    paintTextPanel();
  }
  editor.addEventListener('input', () => { if (editor.querySelector(`font[color="${RESET_COLOR}"], [style*="rgb(1, 2, 3)"]`)) cleanResetColor(); });
  $$('#fontSeg button').forEach((b) => b.addEventListener('click', () => onText(() => document.execCommand('fontName', false, FACE[b.dataset.font]))));
  $$('#textPop [data-fore]').forEach((b) => b.addEventListener('click', () => onText(() => {
    document.execCommand('foreColor', false, b.dataset.fore === 'inherit' ? RESET_COLOR : b.dataset.fore); // back to the note's normal ink colour, keeping bold/italic etc.
  })));
  $$('#textPop [data-hilite]').forEach((b) => b.addEventListener('click', () => onText(() => document.execCommand('hiliteColor', false, b.dataset.hilite))));
  $$('#fsizeSeg button').forEach((b) => b.addEventListener('click', () => onText(() => document.execCommand('fontSize', false, b.dataset.fsize))));
  // clear formatting: the selected text; with nothing selected, what you type next is plain again
  $('#miClearFmt').addEventListener('click', () => onText((sel) => {
    if (sel) { document.execCommand('removeFormat'); return; }
    for (const c of ['bold', 'italic', 'underline', 'strikeThrough']) if (document.queryCommandState(c)) document.execCommand(c);
    document.execCommand('foreColor', false, RESET_COLOR);
    document.execCommand('hiliteColor', false, 'transparent');
    document.execCommand('fontSize', false, '3');
    document.execCommand('fontName', false, FACE[note.font] || 'Caveat');
  }));
  editor.addEventListener('input', (e) => { if (!/^history/.test(e.inputType || '')) { textUndo.length = 0; textRedo.length = 0; } });
  // ---- the one Undo button (bottom bar, left of Draw): drawing while drawing, otherwise the text
  function undoText() {
    if (textUndo.length) { textRedo.push({ font: note.font }); setProp({ font: textUndo.pop().font }); paintTextPanel(); return; }
    editor.focus({ preventScroll: true });
    document.execCommand('undo');
    // undo selects what it brought back (for a whole-note change: everything); keep just the cursor
    const sel = getSelection();
    if (sel.rangeCount && !sel.isCollapsed) sel.collapseToEnd();
    changed();
    if (!$('#textPop').hidden) paintTextPanel();
  }
  function undoAny() {
    if (inkState.on && !inkState.paused) inkUndo(); else undoText();
  }
  // ---- Redo (1.1.14, right after Undo): takes back what Undo did, for drawing and for text
  function redoText() {
    if (textRedo.length) { textUndo.push({ font: note.font }); setProp({ font: textRedo.pop().font }); paintTextPanel(); return; }
    editor.focus({ preventScroll: true });
    document.execCommand('redo');
    const sel = getSelection();
    if (sel.rangeCount && !sel.isCollapsed) sel.collapseToEnd();
    changed();
    if (!$('#textPop').hidden) paintTextPanel();
  }
  function redoAny() {
    if (inkState.on && !inkState.paused) inkRedo(); else redoText();
  }
  function paintUndo() {
    const drawing = inkState.on && !inkState.paused;
    $('#btnUndo').title = drawing ? 'Undo drawing (Ctrl+Z)' : 'Undo (Ctrl+Z)';
    $('#btnRedo').title = drawing ? 'Redo drawing (Ctrl+Y)' : 'Redo (Ctrl+Y)';
  }
  $('#btnUndo').addEventListener('mousedown', (e) => e.preventDefault());
  $('#btnUndo').addEventListener('click', undoAny);
  $('#btnRedo').addEventListener('mousedown', (e) => e.preventDefault());
  $('#btnRedo').addEventListener('click', redoAny);

  async function doInsert(act) {
    closePop('#insert');
    switch (act) {
      case 'photo': {
        const urls = await api.pickImages();
        if (urls && urls.length) insertNodes(urls.map((u) => `<img class="att-img" src="${esc(u)}">`).join(''));
        break;
      }
      case 'voice': startRecording(); break;
      case 'drawing': openDraw(null); break;
      case 'link': openLinkForm(); break;
      case 'table': insertTable(3, 2); toast('Tip: right-click a cell to add rows or columns'); break;
      case 'numbers': runCmd('numbers'); break;
      case 'divider': restoreSel(); document.execCommand('insertHorizontalRule'); changed(); break;
      case 'date': {
        restoreSel();
        const d = new Date().toLocaleString([], { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
        document.execCommand('insertText', false, d + ' ');
        changed();
        break;
      }
      default: break;
    }
  }

  // ================================================================ links
  let editingLink = null;
  function normUrl(u) {
    u = u.trim();
    if (!u) return '';
    if (/^(https?|mailto):/i.test(u)) return u;
    if (/^[^\s@/]+@[^\s@/]+\.[^\s@/]+$/.test(u)) return 'mailto:' + u;
    return 'https://' + u.replace(/^\/+/, '');
  }
  function openLinkForm(existing = null) {
    editingLink = existing;
    saveSel();
    const sel = getSelection().toString();
    $('#linkTitle').textContent = existing ? 'Edit link' : 'Add a link';
    $('#linkText').value = existing ? existing.textContent : sel;
    $('#linkUrl').value = existing ? existing.getAttribute('href') : '';
    openPop('#linkPop');
    setTimeout(() => ($('#linkText').value ? $('#linkUrl') : $('#linkText')).focus(), 20);
  }
  $('#linkCancel').addEventListener('click', () => { closePop('#linkPop'); restoreSel(); });
  $('#linkPop').addEventListener('submit', (e) => {
    e.preventDefault();
    const url = normUrl($('#linkUrl').value);
    if (!url) { $('#linkUrl').focus(); return; }
    const text = $('#linkText').value.trim() || $('#linkUrl').value.trim();
    closePop('#linkPop');
    if (editingLink && editor.contains(editingLink)) {
      editingLink.setAttribute('href', url);
      editingLink.textContent = text;
      changed();
    } else {
      restoreSel();
      document.execCommand('insertHTML', false, `<a href="${esc(url)}">${esc(text)}</a>&nbsp;`);
      changed();
    }
    editingLink = null;
  });

  // 1.1.23: a picture's description (its alt text): never shown in the note, but Ctrl+F and the notes list's search find
  // the picture by it, and it shows as a tooltip when you point at the picture
  let descImg = null;
  function openDesc(img) {
    descImg = img;
    $('#descTitle').textContent = img.getAttribute('alt') ? 'Picture description' : 'Describe this picture';
    $('#descText').value = img.getAttribute('alt') || '';
    openPop('#descPop');
    setTimeout(() => { $('#descText').focus(); $('#descText').select(); }, 20);
  }
  $('#descCancel').addEventListener('click', () => { closePop('#descPop'); descImg = null; });
  $('#descText').addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); $('#descPop').requestSubmit(); } });
  $('#descPop').addEventListener('submit', (e) => {
    e.preventDefault();
    const v = $('#descText').value.replace(/\s+/g, ' ').trim().slice(0, 500);
    closePop('#descPop');
    if (descImg && editor.contains(descImg)) {
      const had = !!descImg.getAttribute('alt');
      if (v) { descImg.setAttribute('alt', v); descImg.setAttribute('title', v); } else { descImg.removeAttribute('alt'); descImg.removeAttribute('title'); }
      changed();
      if (v || had) toast(v ? 'Description saved' : 'Description removed');
    }
    descImg = null;
  });

  function autoLink() {
    const s = getSelection();
    if (!s.rangeCount || !s.isCollapsed) return;
    const node = s.anchorNode;
    if (!node || node.nodeType !== 3 || closestIn(node, 'a')) return;
    const off = s.anchorOffset;
    const m = node.data.slice(0, off).match(/(^|[\s( ])((?:https?:\/\/|www\.)[^\s<>" ]+)$/i);
    if (!m) return;
    const raw = m[2];
    const url = raw.replace(/[.,;:!?)\]'"]+$/, '');
    if (url.length < 6) return;
    const start = off - raw.length;
    const r = document.createRange();
    r.setStart(node, start);
    r.setEnd(node, start + url.length);
    const a = document.createElement('a');
    a.href = url.toLowerCase().startsWith('www.') ? 'https://' + url : url;
    try { r.surroundContents(a); } catch { return; }
    const after = document.createRange();
    const trailing = raw.length - url.length;
    if (trailing && a.nextSibling && a.nextSibling.nodeType === 3) after.setStart(a.nextSibling, trailing);
    else after.setStartAfter(a);
    after.collapse(true);
    s.removeAllRanges();
    s.addRange(after);
    changed();
  }

  // ================================================================ tables
  function insertTable(cols, rows) {
    let h = '<table data-new="1"><tbody>';
    for (let r = 0; r < rows; r++) h += '<tr>' + '<td><br></td>'.repeat(cols) + '</tr>';
    h += '</tbody></table><div><br></div>';
    insertHTML(h);
    const t = editor.querySelector('table[data-new]');
    if (t) {
      t.removeAttribute('data-new');
      const first = t.querySelector('td');
      if (first) placeIn(first);
    }
  }
  function placeIn(cell) {
    const r = document.createRange();
    r.selectNodeContents(cell);
    r.collapse(false);
    const s = getSelection();
    s.removeAllRanges();
    s.addRange(r);
  }
  function tableOp(cell, op) {
    const tr = cell.parentElement;
    const table = cell.closest('table');
    const idx = [...tr.children].indexOf(cell);
    const rows = [...table.rows];
    switch (op) {
      case 'rowAbove': case 'rowBelow': {
        const nr = tr.cloneNode(true);
        [...nr.children].forEach((c) => { c.innerHTML = '<br>'; });
        if (op === 'rowAbove') tr.before(nr); else tr.after(nr);
        placeIn(nr.children[Math.min(idx, nr.children.length - 1)]);
        break;
      }
      case 'colLeft': case 'colRight':
        rows.forEach((row) => {
          const ref = row.children[Math.min(idx, row.children.length - 1)];
          if (!ref) return;
          const c = document.createElement(ref.tagName);
          c.innerHTML = '<br>';
          if (op === 'colLeft') ref.before(c); else ref.after(c);
        });
        break;
      case 'delRow':
        tr.remove();
        if (!table.rows.length) table.remove();
        break;
      case 'delCol':
        rows.forEach((row) => row.children[idx] && row.children[idx].remove());
        if (!table.rows[0] || !table.rows[0].children.length) table.remove();
        break;
      case 'delTable': table.remove(); break;
      default: break;
    }
    changed();
  }
  function moveCell(cell, dir) {
    const table = cell.closest('table');
    let cells = [...table.querySelectorAll('td,th')];
    const i = cells.indexOf(cell) + dir;
    if (i < 0) return;
    if (i >= cells.length) {
      tableOp(cell, 'rowBelow');
      cells = [...table.querySelectorAll('td,th')];
    }
    placeIn(cells[i]);
  }

  // ================================================================ photos (paste / drop)
  const IMG_EXT = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif', 'image/webp': 'webp', 'image/bmp': 'bmp' };
  async function insertImageFiles(files) {
    const urls = [];
    for (const f of files) {
      const ext = IMG_EXT[f.type];
      if (!ext) continue;
      try { urls.push(await api.saveAttachment(new Uint8Array(await f.arrayBuffer()), ext)); } catch { toast('Could not add that picture'); }
    }
    if (urls.length) insertNodes(urls.map((u) => `<img class="att-img" src="${esc(u)}">`).join(''));
  }

  const ALLOWED = {
    B: [], STRONG: [], I: [], EM: [], U: [], S: [], STRIKE: [], DEL: [], MARK: [], SUB: [], SUP: [], CODE: [], PRE: [],
    A: ['href'], UL: [], OL: [], LI: [], BR: [], P: [], DIV: [], SPAN: [], IMG: ['src', 'alt', 'title'], HR: [], BLOCKQUOTE: [],
    TABLE: [], TBODY: [], THEAD: [], TR: [], TD: ['colspan', 'rowspan'], TH: ['colspan', 'rowspan'], H1: [], H2: [], H3: [], H4: [],
  };
  const DROP = new Set(['SCRIPT', 'STYLE', 'META', 'LINK', 'TITLE', 'IFRAME', 'OBJECT', 'EMBED', 'SVG', 'TEMPLATE', 'NOSCRIPT', 'BUTTON', 'INPUT', 'SELECT', 'TEXTAREA', 'FORM', 'VIDEO', 'AUDIO', 'CANVAS', 'HEAD']);
  function cleanTree(el) {
    for (const ch of [...el.childNodes]) {
      if (ch.nodeType === 3) continue;
      if (ch.nodeType !== 1) { ch.remove(); continue; }
      const tag = ch.tagName;
      if (DROP.has(tag)) { ch.remove(); continue; }
      if (!(tag in ALLOWED)) { cleanTree(ch); ch.replaceWith(...ch.childNodes); continue; }
      for (const a of [...ch.attributes]) if (!ALLOWED[tag].includes(a.name)) ch.removeAttribute(a.name);
      if (tag === 'A' && !/^(https?:|mailto:)/i.test(ch.getAttribute('href') || '')) ch.removeAttribute('href');
      if (tag === 'IMG') {
        if (!/^(https?:|data:image\/|stickyfile:)/i.test(ch.getAttribute('src') || '')) { ch.remove(); continue; }
        ch.className = 'att-img';
      }
      cleanTree(ch);
    }
  }
  function sanitize(html) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    cleanTree(doc.body);
    return doc.body.innerHTML;
  }

  let plainPaste = false;
  editor.addEventListener('paste', (e) => {
    const cd = e.clipboardData;
    if (!cd) return;
    const files = [...cd.items].filter((i) => i.kind === 'file' && IMG_EXT[i.type]).map((i) => i.getAsFile()).filter(Boolean);
    if (files.length) { e.preventDefault(); saveSel(); insertImageFiles(files); return; }
    const html = cd.getData('text/html');
    const text = cd.getData('text/plain');
    e.preventDefault();
    const t = (text || '').trim();
    if (/^(https?:\/\/|www\.)\S+$/i.test(t)) {
      const href = t.toLowerCase().startsWith('www.') ? 'https://' + t : t;
      document.execCommand('insertHTML', false, `<a href="${esc(href)}">${esc(t)}</a>&nbsp;`);
    } else if (html && !plainPaste) {
      document.execCommand('insertHTML', false, sanitize(html));
    } else if (text) {
      document.execCommand('insertText', false, text);
    }
    plainPaste = false;
    changed();
  });

  editor.addEventListener('dragover', (e) => { if ([...e.dataTransfer.types].includes('Files')) e.preventDefault(); });
  editor.addEventListener('drop', (e) => {
    const files = [...(e.dataTransfer.files || [])].filter((f) => IMG_EXT[f.type]);
    if (!files.length) return;
    e.preventDefault();
    const r = document.caretRangeFromPoint(e.clientX, e.clientY);
    if (r && editor.contains(r.startContainer)) { savedRange = r; }
    insertImageFiles(files);
  });
  // Never let a dropped file replace the whole note page.
  window.addEventListener('dragover', (e) => e.preventDefault());
  window.addEventListener('drop', (e) => e.preventDefault());

  // ================================================================ clicks inside the note
  // The left edge of a photo (its white frame, EDGE px) counts as "just before the photo": the caret goes
  // there instead of selecting the photo, so it's easy to type in front of it.
  const EDGE = 7;
  let edgeDown = false;
  function caretAt(node, after) {
    const r = document.createRange();
    if (after) r.setStartAfter(node); else r.setStartBefore(node);
    r.collapse(true);
    const s = getSelection();
    s.removeAllRanges();
    s.addRange(r);
  }
  editor.addEventListener('mousedown', (e) => {
    edgeDown = false;
    const pic = e.button === 0 && !e.shiftKey && ((e.target.closest && e.target.closest('img.att-img'))
      || [...editor.querySelectorAll('img.att-img.caret-near')].find((i) => { const r = i.getBoundingClientRect(); return e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom; }));
    if (pic && e.clientX < pic.getBoundingClientRect().left + EDGE) {
      e.preventDefault();
      edgeDown = true;
      editor.focus();
      caretAt(pic, false);
      return;
    }
    const li = e.target.closest && e.target.closest('ul.checklist li');
    if (li && editor.contains(li)) {
      const rect = li.getBoundingClientRect();
      const pad = parseFloat(getComputedStyle(li).paddingLeft) || 24;
      if (e.clientX < rect.left + pad && e.button === 0) {
        e.preventDefault();
        li.classList.toggle('done');
        changed();
      }
    }
  });
  editor.addEventListener('click', (e) => {
    const voice = e.target.closest('.voice');
    if (voice) { e.preventDefault(); togglePlay(voice); return; }
    const img = e.target.closest('img');
    if (img && edgeDown) return; // clicked the photo's left edge: the caret is already in front of it
    if (img) { selectImage(img); return; }
    const a = e.target.closest('a[href]');
    if (a && getSelection().isCollapsed && !e.shiftKey) {
      e.preventDefault();
      api.openExternal(a.getAttribute('href'));
    }
  });
  editor.addEventListener('dblclick', (e) => {
    const img = e.target.closest('img');
    if (!img || edgeDown) return;
    if (img.classList.contains('att-drawing')) openDraw(img);
    else openPhoto(img);
  });
  // 1.1.22 (sixth round): right-click a photo → Copy image (as a PNG, so it pastes anywhere: chats, Paint, Word…)
  async function copyPhoto(img) {
    const src = img.getAttribute('src') || '';
    try {
      // a saved photo is read straight from its file (drawing the <img> itself onto a canvas isn't allowed for it)
      const pic = src.startsWith('stickyfile:') ? await createImageBitmap(await (await fetch(src)).blob()) : (await img.decode().catch(() => {}), img);
      const c = document.createElement('canvas'); c.width = pic.naturalWidth || pic.width; c.height = pic.naturalHeight || pic.height;
      c.getContext('2d').drawImage(pic, 0, 0);
      const blob = await new Promise((ok, no) => c.toBlob((b) => (b ? ok(b) : no(new Error('no image'))), 'image/png'));
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      toast('Picture copied');
    } catch { toast('Couldn’t copy this picture'); }
  }
  function openPhoto(img) {
    const src = img.getAttribute('src') || '';
    if (src.startsWith('stickyfile:')) api.openAttachment(src);
    else if (/^https?:/i.test(src)) api.openExternal(src);
  }
  // Clicking the note's margin left or right of a line puts the caret at the start / end of that line
  // (just before / after a photo). Clicking empty space below the text puts the caret at the end.
  $('#scroller').addEventListener('mousedown', (e) => {
    if (e.target.id !== 'scroller') return;
    e.preventDefault();
    editor.focus();
    const er = editor.getBoundingClientRect();
    const y = e.clientY;
    if (y >= er.top && y <= er.bottom && (e.clientX < er.left || e.clientX > er.right) && besideLine(e.clientX < er.left, y, er)) return;
    caretAtEnd();
  });
  function besideLine(left, y, er) {
    // a picture on that line: just before / after it
    let pick = null;
    for (const img of editor.querySelectorAll('img')) {
      const r = img.getBoundingClientRect();
      if (y < r.top || y > r.bottom) continue;
      if (!pick || (left ? r.left < pick.r.left : r.right > pick.r.right)) pick = { img, r };
    }
    if (pick) { caretAt(pick.img, !left); return true; }
    // text: where the line starts / ends
    const x = left ? er.left + 1 : Math.min(er.right, $('#scroller').getBoundingClientRect().right) - 1;
    const r = document.caretRangeFromPoint && document.caretRangeFromPoint(x, y);
    if (!r || !editor.contains(r.startContainer)) return false;
    const s = getSelection();
    s.removeAllRanges();
    s.addRange(r);
    return true;
  }

  // Photos are tilted a little, and a tilted photo is drawn on top of the blinking caret next to it.
  // While the caret is right before or after a photo, the photo goes one layer down (.caret-near,
  // note.css) so the caret shows on its edge. It comes back up as soon as the mouse is over it, so it
  // can still be clicked (a photo inside a paragraph can't be clicked while it's a layer down).
  let mouseX = -1;
  let mouseY = -1;
  // (the photo's left edge doesn't count: clicking there puts the caret in front of it anyway)
  const overImg = (img) => { const r = img.getBoundingClientRect(); return mouseX >= r.left + EDGE && mouseX <= r.right && mouseY >= r.top && mouseY <= r.bottom; };
  function imgsByCaret() {
    const s = getSelection();
    if (!s.rangeCount || !s.isCollapsed) return [];
    const { startContainer: n, startOffset: o } = s.getRangeAt(0);
    if (!editor.contains(n)) return [];
    const near = n.nodeType === 3
      ? [o === 0 ? n.previousSibling : null, o === n.length ? n.nextSibling : null]
      : [n.childNodes[o - 1], n.childNodes[o]];
    return near.filter((x) => x && x.nodeName === 'IMG' && !overImg(x));
  }
  document.addEventListener('selectionchange', () => {
    const near = imgsByCaret();
    editor.querySelectorAll('img.caret-near').forEach((i) => { if (!near.includes(i)) i.classList.remove('caret-near'); });
    near.forEach((i) => i.classList.add('caret-near'));
  });
  document.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
    editor.querySelectorAll('img.caret-near').forEach((i) => { if (overImg(i)) i.classList.remove('caret-near'); });
  });

  // ================================================================ 1.1.22 (sixth round): editing helpers
  // the next / previous thing you can see from the caret: a text with letters in it, a photo, a line break, a voice
  // note… (empty wrappers and line ends in between are skipped, also across lines)
  const ATOM = (x) => x.nodeType === 1 && (x.nodeName === 'IMG' || x.nodeName === 'BR' || x.nodeName === 'HR' || x.nodeName === 'TABLE' || x.classList.contains('voice') || x.isContentEditable === false);
  const seen = (t) => /[^\n\r\t​]/.test(t);
  const deepFirst = (x) => { while (x.nodeType === 1 && !ATOM(x) && x.firstChild) x = x.firstChild; return x; };
  const deepLast = (x) => { while (x.nodeType === 1 && !ATOM(x) && x.lastChild) x = x.lastChild; return x; };
  const stepAfter = (x) => { while (x && x !== editor && !x.nextSibling) x = x.parentNode; return !x || x === editor ? null : deepFirst(x.nextSibling); };
  const stepBefore = (x) => { while (x && x !== editor && !x.previousSibling) x = x.parentNode; return !x || x === editor ? null : deepLast(x.previousSibling); };
  const isLeaf = (x) => (x.nodeType === 3 ? seen(x.data) : x.nodeType === 1 && ATOM(x));
  function leafAfter(n, o) {
    let x;
    if (n.nodeType === 3) { if (seen(n.data.slice(o))) return n; x = stepAfter(n); } else x = o < n.childNodes.length ? deepFirst(n.childNodes[o]) : stepAfter(n);
    while (x && !isLeaf(x)) x = (x.nodeType === 1 && !ATOM(x) && x.firstChild) ? deepFirst(x) : stepAfter(x);
    return x;
  }
  function leafBefore(n, o) {
    let x;
    if (n.nodeType === 3) { if (seen(n.data.slice(0, o))) return n; x = stepBefore(n); } else x = o > 0 ? deepLast(n.childNodes[o - 1]) : stepBefore(n);
    while (x && !isLeaf(x)) x = (x.nodeType === 1 && !ATOM(x) && x.lastChild) ? deepLast(x) : stepBefore(x);
    return x;
  }
  // the line (block) a node is in: a list item, a paragraph / div line, a heading… (null: straight in the note, or a table)
  const LINE = /^(LI|DIV|P|H1|H2|H3|H4|BLOCKQUOTE|PRE)$/;
  function lineOf(node) {
    for (let x = node && (node.nodeType === 1 ? node : node.parentNode); x && x !== editor; x = x.parentNode) { if (/^(TD|TH)$/.test(x.nodeName)) return null; if (LINE.test(x.nodeName)) return x; }
    return null;
  }
  // put line B's words at the end of line A, exactly as they were (their own size, font, bold…), and remove B. One
  // insertHTML, so Ctrl+Z undoes it in one go. `from`: the caret (Delete), else the end of A. Returns false to let the
  // browser do it (nothing to join, or lists inside the line).
  function joinLines(A, B, from) {
    if (!A || !B || A === B || A.contains(B) || B.contains(A) || B.querySelector('ul,ol,table') || !seen(A.textContent)) return false;
    const html = B.innerHTML.replace(/(<br\s*\/?>\s*)+$/i, '');
    const keep = A.textContent.length; // where the caret goes back to: the join
    const r = document.createRange();
    if (from) r.setStart(from.startContainer, from.startOffset); else { const last = A.lastChild; if (last && last.nodeName === 'BR') r.setStartBefore(last); else r.setStart(A, A.childNodes.length); }
    r.setEnd(B, B.childNodes.length);
    const s = getSelection(); s.removeAllRanges(); s.addRange(r);
    document.execCommand(html ? 'insertHTML' : 'delete', false, html);
    // the caret at the join
    let left = keep; const w = document.createTreeWalker(A, NodeFilter.SHOW_TEXT);
    for (let t = w.nextNode(); t; t = w.nextNode()) { if (left <= t.length) { const c = document.createRange(); c.setStart(t, left); c.collapse(true); s.removeAllRanges(); s.addRange(c); break; } left -= t.length; }
    changed();
    return true;
  }
  // delete from a to b (each a node or a collapsed range) with the browser's own delete, so Ctrl+Z works
  function deleteSpan(a, b) {
    const r = document.createRange();
    if (a.nodeType) r.setStartBefore(a); else r.setStart(a.startContainer, a.startOffset);
    if (b.nodeType) r.setEndAfter(b); else r.setEnd(b.startContainer, b.startOffset);
    const s = getSelection(); s.removeAllRanges(); s.addRange(r);
    document.execCommand('delete');
    changed();
  }
  // the caret is at the very start of a checklist line that has something in it → that line (else null)
  function checkLineStart(s) {
    const li = closestIn(s.anchorNode, 'li');
    if (!li || !li.closest('ul.checklist') || !editor.contains(li)) return null;
    const r = s.getRangeAt(0); const pre = document.createRange(); pre.setStart(li, 0); pre.setEnd(r.startContainer, r.startOffset);
    const f = pre.cloneContents();
    if (seen(f.textContent) || f.querySelector('img,br,hr,table,.voice')) return null;
    const own = [...li.childNodes].filter((c) => !(c.nodeType === 1 && /^(UL|OL)$/.test(c.nodeName)));
    return own.some((c) => (c.nodeType === 3 ? seen(c.data) : c.nodeName !== 'BR' && (seen(c.textContent) || (c.nodeType === 1 && c.querySelector && (c.matches('img,.voice') || c.querySelector('img,.voice')))))) ? li : null;
  }

  // Each checklist box is sized and centred on its line's first words (they may be bigger, smaller or in the other
  // font: the box used to be one size at one height, so it sat too high or low). Measured on screen, kept in
  // --cb-s / --cb-t / --cb-p on the line (not saved: collect() strips them). And a ticked line's photos get a line
  // struck through them, like its text (an overlay over the text, #strikes).
  const CB_VARS = ['--cb-s', '--cb-t', '--cb-p'];
  function firstWords(li) {
    for (let x = deepFirst(li.firstChild || li); x && li.contains(x); ) {
      if (x.nodeType === 1 && /^(UL|OL)$/.test(x.nodeName)) { x = stepAfter(x); continue; }
      if (x.nodeType === 3) { if (seen(x.data)) return x; } else if (ATOM(x)) return null;
      x = (x.nodeType === 1 && !ATOM(x) && x.firstChild) ? deepFirst(x) : stepAfter(x);
    }
    return null;
  }
  function setVar(el, k, v) { if (v === null) { if (el.style.getPropertyValue(k)) el.style.removeProperty(k); } else if (el.style.getPropertyValue(k) !== v) el.style.setProperty(k, v); if (!el.getAttribute('style')) el.removeAttribute('style'); }
  function alignChecks() {
    const lis = editor.querySelectorAll('ul.checklist li');
    if (!lis.length) return;
    const er = editor.getBoundingClientRect(); const k = er.width ? editor.offsetWidth / er.width : 1; // the note's zoom
    const round = body.dataset.font === 'round';
    // 1.1.23 (speed): measure every line first, then write: writing between two measurements made the browser lay the
    // whole note out again for each checklist line, on every key press
    const out = [];
    for (const li of lis) {
      const t = firstWords(li); let size = null; let top = null; let pad = null;
      if (t) {
        const i = t.data.search(/[^\s​]/); const r = document.createRange(); r.setStart(t, Math.max(0, i)); r.setEnd(t, Math.max(0, i) + 1);
        const rr = r.getClientRects()[0];
        if (rr && rr.height) {
          const cs = getComputedStyle(t.parentElement); const fs = parseFloat(cs.fontSize);
          const caveat = /caveat/i.test(cs.fontFamily.split(',')[0]);
          const liFs = parseFloat(getComputedStyle(li).fontSize);
          const base = round ? liFs : liFs * 0.78; // the box at the note's own size (as before)
          const sz = Math.max(10, fs * (caveat ? 0.78 : 1));
          const mid = ((rr.top + rr.bottom) / 2 - li.getBoundingClientRect().top) * k;
          size = `${sz.toFixed(1)}px`; top = `${(mid - sz / 2).toFixed(1)}px`;
          pad = sz > base + 0.5 ? `${((round ? 1.55 : 1.3) * liFs + (sz - base)).toFixed(1)}px` : null;
        }
      }
      out.push([li, size, top, pad]);
    }
    for (const [li, size, top, pad] of out) { setVar(li, '--cb-s', size); setVar(li, '--cb-t', top); setVar(li, '--cb-p', pad); }
  }
  function paintStrikes() {
    const sheet = $('#sheet'); let box = $('#strikes');
    const pics = [...editor.querySelectorAll('ul.checklist li.done img')].filter((i) => i.closest('li').classList.contains('done') && i.offsetWidth);
    if (!pics.length) { if (box) box.replaceChildren(); return; }
    if (!box) { box = document.createElement('div'); box.id = 'strikes'; box.setAttribute('aria-hidden', 'true'); sheet.append(box); }
    const sr = sheet.getBoundingClientRect(); const k = sr.width ? sheet.offsetWidth / sr.width : 1;
    box.replaceChildren(...pics.map((img) => {
      const r = img.getBoundingClientRect(); const d = document.createElement('i');
      const th = Math.max(2.5, Math.min(4, r.height * k / 40));
      d.style.cssText = `left:${((r.left - sr.left) * k - 3).toFixed(1)}px;top:${((r.top + r.height / 2 - sr.top) * k - th / 2).toFixed(1)}px;width:${(r.width * k + 6).toFixed(1)}px;height:${th.toFixed(1)}px;color:${getComputedStyle(img.closest('li')).color}`;
      return d;
    }));
  }
  let decoQueued = false;
  function decorate() {
    if (decoQueued) return; decoQueued = true;
    requestAnimationFrame(() => { decoQueued = false; try { alignChecks(); paintStrikes(); } catch {} });
  }
  editor.addEventListener('input', decorate);
  editor.addEventListener('load', decorate, true); // a photo finished loading (lines move)
  if (window.ResizeObserver) new ResizeObserver(decorate).observe(editor);
  new MutationObserver(decorate).observe(body, { attributes: true, attributeFilter: ['data-font', 'data-size'] });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(decorate);

  // ================================================================ 1.1.22 (ninth round): Ctrl+F, find in the note
  // Every match is highlighted (the browser's highlight layer, so the note's text and what's saved don't change), the one
  // you're on stronger; Enter / F3 / ↓ goes to the next, Shift+Enter / Shift+F3 / ↑ to the previous (it wraps round), and
  // the note scrolls to it. Marks beside the scrollbar show where they all are (click one to go there). Esc closes it and
  // leaves the found words selected, so you can type over them or carry on from there. Not case-sensitive.
  const find = { on: false, hits: [], cur: -1, timer: null };
  const HL = typeof Highlight === 'function' && window.CSS && CSS.highlights;
  const BLOCKS = /^(DIV|P|LI|UL|OL|H1|H2|H3|H4|PRE|BLOCKQUOTE|TABLE|TR|TD|TH|IMG|BR|HR)$/;
  const fold = (t) => t.replace(/ /g, ' ').toLowerCase();
  function findHits(q) {
    if (!q) return [];
    const parts = []; let all = '';
    const w = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, { acceptNode: (n) => (n.nodeType === 1 && (n.classList.contains('voice') || n.isContentEditable === false) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT) });
    for (let n = w.nextNode(); n; n = w.nextNode()) {
      if (n.nodeType === 1) {
        if (BLOCKS.test(n.nodeName)) all += '\n'; // lines don't run into each other
        if (n.nodeName === 'IMG' && n.getAttribute('alt')) { parts.push({ img: n, at: all.length }); all += n.getAttribute('alt') + '\n'; } // 1.1.23: its description
        continue;
      }
      parts.push({ n, at: all.length }); all += n.data;
    }
    const hay = fold(all); const needle = fold(q); const out = [];
    const where = (i) => { let lo = 0; let hi = parts.length - 1; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (parts[m].at <= i) lo = m; else hi = m - 1; } return parts[lo]; };
    for (let i = hay.indexOf(needle); i >= 0 && out.length < 2000; i = hay.indexOf(needle, i + Math.max(1, needle.length))) {
      const a = where(i); const b = where(i + needle.length - 1);
      const r = document.createRange();
      if (a.img) { if (a !== b) continue; r.selectNode(a.img); r.img = a.img; } // found in a picture's description: the picture itself
      else if (b.img) continue;
      else { r.setStart(a.n, i - a.at); r.setEnd(b.n, i + needle.length - b.at); }
      out.push(r);
    }
    return out;
  }
  function paintFind(scroll) {
    const n = find.hits.length; const q = $('#findQ').value;
    $('#findN').textContent = !q ? '' : n ? `${find.cur + 1} of ${n}${n >= 2000 ? '+' : ''}` : 'No matches';
    $('#find').classList.toggle('none', !!q && !n);
    $('#findPrev').disabled = $('#findNext').disabled = n < 2;
    editor.querySelectorAll('img.find-hit, img.find-cur').forEach((i) => i.classList.remove('find-hit', 'find-cur'));
    find.hits.forEach((r, i) => { if (r.img) r.img.classList.add(i === find.cur ? 'find-cur' : 'find-hit'); }); // a picture can't be highlighted like text: it gets an outline
    if (HL) {
      CSS.highlights.set('cn-find', new Highlight(...find.hits.filter((_, i) => i !== find.cur)));
      if (find.hits[find.cur]) CSS.highlights.set('cn-find-cur', new Highlight(find.hits[find.cur])); else CSS.highlights.delete('cn-find-cur');
    }
    const sc = $('#scroller'); const r = find.hits[find.cur] && find.hits[find.cur].getBoundingClientRect();
    if (scroll && r && r.height) {
      const sr = sc.getBoundingClientRect(); const pad = 40;
      if (r.top < sr.top + pad || r.bottom > sr.bottom - pad) sc.scrollTo({ top: sc.scrollTop + (r.top + r.height / 2) - (sr.top + sr.height / 2), behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
      if (r.left < sr.left || r.right > sr.right) sc.scrollLeft += r.left - sr.left - pad;
    }
    paintMarks();
  }
  function paintMarks() {
    const box = $('#findMarks'); const sc = $('#scroller');
    if (!find.on || !find.hits.length || !sc.offsetHeight) { box.hidden = true; return; }
    const sr = sc.getBoundingClientRect(); const H = Math.max(sc.scrollHeight, 1);
    Object.assign(box.style, { left: `${sr.right - 9}px`, top: `${sr.top + 2}px`, height: `${sr.height - 4}px` });
    const track = sr.height - 8; const seen = new Set();
    box.replaceChildren(...find.hits.map((rg, i) => {
      const r = rg.getBoundingClientRect(); const y = Math.round(((r.top - sr.top + sc.scrollTop) / H) * track);
      if (i !== find.cur && seen.has(y)) return null; seen.add(y);
      const m = document.createElement('i'); m.style.top = `${y}px`; if (i === find.cur) m.className = 'cur';
      m.addEventListener('mousedown', (e) => { e.preventDefault(); find.cur = i; paintFind(true); });
      return m;
    }).filter(Boolean));
    box.hidden = false;
  }
  // the first match from where you are looking (or from a starting point in the text)
  function nearestHit(fromRange) {
    if (!find.hits.length) return -1;
    if (fromRange) { const i = find.hits.findIndex((r) => r.compareBoundaryPoints(Range.START_TO_START, fromRange) >= 0); return i < 0 ? 0 : i; }
    const top = $('#scroller').getBoundingClientRect().top;
    const i = find.hits.findIndex((r) => r.getBoundingClientRect().bottom >= top); return i < 0 ? 0 : i;
  }
  function runFind(keepPlace) {
    const was = keepPlace && find.hits[find.cur] ? find.hits[find.cur].cloneRange() : null;
    find.hits = findHits($('#findQ').value);
    find.cur = nearestHit(was);
    paintFind(!keepPlace);
  }
  function openFind() {
    if (hidden || !note || note.rolled) return;
    const s = getSelection(); const picked = s.rangeCount && !s.isCollapsed && editor.contains(s.anchorNode) ? s.toString().trim() : '';
    const f = $('#find'); f.style.top = `${Math.round($('#bar').getBoundingClientRect().bottom + 6)}px`;
    f.hidden = false; find.on = true;
    if (picked && !picked.includes('\n') && picked.length <= 80) $('#findQ').value = picked;
    $('#findQ').focus(); $('#findQ').select();
    runFind(false);
  }
  function closeFind(toText = true) {
    if (!find.on) return;
    const hit = find.hits[find.cur];
    find.on = false; $('#find').hidden = true; $('#findMarks').hidden = true;
    if (HL) { CSS.highlights.delete('cn-find'); CSS.highlights.delete('cn-find-cur'); }
    editor.querySelectorAll('img.find-hit, img.find-cur').forEach((i) => i.classList.remove('find-hit', 'find-cur'));
    if (toText) { editor.focus(); if (hit) { const s = getSelection(); s.removeAllRanges(); s.addRange(hit); } }
    find.hits = []; find.cur = -1;
  }
  function stepFind(d) { const n = find.hits.length; if (!n) return; find.cur = (find.cur + d + n) % n; paintFind(true); }
  $('#findQ').addEventListener('input', () => runFind(false));
  $('#findQ').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === 'F3') { e.preventDefault(); stepFind(e.shiftKey ? -1 : 1); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); stepFind(1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); stepFind(-1); }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeFind(); }
  });
  $('#findPrev').addEventListener('mousedown', (e) => e.preventDefault());
  $('#findNext').addEventListener('mousedown', (e) => e.preventDefault());
  $('#findPrev').addEventListener('click', () => stepFind(-1));
  $('#findNext').addEventListener('click', () => stepFind(1));
  $('#findX').addEventListener('click', () => closeFind());
  // the text changes while it's open: find again, staying on the same match
  editor.addEventListener('input', () => { if (!find.on) return; clearTimeout(find.timer); find.timer = setTimeout(() => runFind(true), 150); });
  if (window.ResizeObserver) new ResizeObserver(() => { if (find.on) paintMarks(); }).observe($('#scroller'));

  // ================================================================ keyboard
  // the text toolbar fades again once you're back in the note (1.1.14)
  const textStale = () => body.classList.remove('text-fresh');
  $('#scroller').addEventListener('pointerdown', textStale);
  editor.addEventListener('keydown', textStale); // typing (not the toolbar's own changes)
  editor.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const cell = closestIn(anchor(), 'td,th');
      if (cell) { moveCell(cell, e.shiftKey ? -1 : 1); return; }
      if (closestIn(anchor(), 'li')) { document.execCommand(e.shiftKey ? 'outdent' : 'indent'); changed(); return; }
      if (!e.shiftKey) document.execCommand('insertText', false, ' ');
      return;
    }
    if (e.key === ' ' || e.key === 'Enter') autoLink();
    if ((e.key === 'Backspace' || e.key === 'Delete') && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const sel = editor.querySelector('img.sel-img');
      if (sel) { e.preventDefault(); deleteSpan(sel, sel); return; } // undoable now (was sel.remove())
      const s = getSelection();
      if (s.rangeCount && s.isCollapsed && editor.contains(s.anchorNode)) {
        // 1.1.22 (sixth round): Backspace at the start of a ticked-box line takes the box away and keeps the text as a
        // normal line. The browser glued the line onto the one above instead (except for a list's first line, which is
        // why it only worked sometimes).
        if (e.key === 'Backspace') { const li = checkLineStart(s); if (li) { e.preventDefault(); li.classList.remove('done'); document.execCommand('outdent'); changed(); return; } }
        // Delete right before a photo / Backspace right after one: the browser did nothing (a photo is its own block,
        // so "the next character" was an empty step); now the photo goes (Ctrl+Z brings it back)
        const r = s.getRangeAt(0);
        const leaf = e.key === 'Delete' ? leafAfter(r.startContainer, r.startOffset) : leafBefore(r.startContainer, r.startOffset);
        if (leaf && leaf.nodeName === 'IMG') { e.preventDefault(); deleteSpan(e.key === 'Delete' ? r : leaf, e.key === 'Delete' ? leaf : r); return; }
        // 1.1.23: Delete at the end of a line / Backspace at the start of one joins the two lines ourselves. The browser's
        // own join re-styled the moved words when the lines were formatted differently (it wrapped them in
        // font-size / font-family styles, so they came out smaller or in the other font, or dropped their font).
        if (leaf && leaf.nodeType === 3 && joinLines(e.key === 'Delete' ? lineOf(r.startContainer) : lineOf(leaf), e.key === 'Delete' ? lineOf(leaf) : lineOf(r.startContainer), e.key === 'Delete' ? r : null)) { e.preventDefault(); return; }
      }
    }
    const mod = e.ctrlKey || e.metaKey;
    if (!mod) return;
    const k = e.key.toLowerCase();
    if (k === 't' && !e.shiftKey) { e.preventDefault(); runCmd('strikeThrough'); }
    else if (k === 'l' && e.shiftKey) { e.preventDefault(); runCmd('bullets'); }
    else if (k === 'c' && e.shiftKey) { e.preventDefault(); runCmd('checklist'); }
    else if (k === 'k' && !e.shiftKey) { e.preventDefault(); openLinkForm(closestIn(anchor(), 'a')); }
    else if (k === 'v' && e.shiftKey) { plainPaste = true; }
  });
  editor.addEventListener('input', (e) => {
    if (e.inputType === 'insertParagraph') {
      const li = closestIn(anchor(), 'li');
      if (li && !li.textContent.trim()) li.classList.remove('done');
    }
  });
  document.addEventListener('keydown', (e) => {
    const mod = e.ctrlKey || e.metaKey;
    if (mod && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'f') { e.preventDefault(); if (find.on) { $('#findQ').focus(); $('#findQ').select(); } else openFind(); return; }
    if (e.key === 'F3' && find.on) { e.preventDefault(); stepFind(e.shiftKey ? -1 : 1); return; }
    if (e.key === 'Escape') {
      if (find.on) { closeFind(); return; }
      if (inkState.on) { exitInk(); return; }
      if (!$('#draw').hidden) closeDraw();
      else if (!$('#recbar').hidden) stopRecording(false);
      closePops();
      hideCtx();
    }
    if (mod && e.key.toLowerCase() === 'n') { e.preventDefault(); saveNow(); api.newNote(); }
    // 1.1.23: Ctrl+S just reassures (everything already saves by itself)
    if (mod && !e.shiftKey && e.key.toLowerCase() === 's') { e.preventDefault(); saveNow(); toast('Already saved. Your notes save by themselves as you type.'); return; }
    if (mod && e.key === '0') { e.preventDefault(); setZoom(1); }
    if (mod && (e.key === '=' || e.key === '+')) { e.preventDefault(); setZoom(zoomNow() + 0.1); }
    if (mod && e.key === '-') { e.preventDefault(); setZoom(zoomNow() - 0.1); }
    if (mod && e.key.toLowerCase() === 'w') { e.preventDefault(); saveNow(); api.close(); }
    if (mod && e.key.toLowerCase() === 'z' && !$('#draw').hidden) { e.preventDefault(); drawUndo(); }
    if (mod && !e.shiftKey && e.key.toLowerCase() === 'z' && $('#draw').hidden) {
      if (inkState.on && !inkState.paused) { e.preventDefault(); inkUndo(); }
      else if (textUndo.length) { e.preventDefault(); undoText(); } // a font change; text undo is the editor's own
    }
    // Redo: Ctrl+Y or Ctrl+Shift+Z (text redo is the editor's own, except a font change)
    const redoKey = mod && (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z'));
    if (redoKey && $('#draw').hidden) {
      if (inkState.on && !inkState.paused) { e.preventDefault(); inkRedo(); }
      else if (textRedo.length) { e.preventDefault(); redoText(); }
    }
  });

  // ================================================================ right-click menus
  const ctx = $('#ctx');
  function hideCtx() { ctx.hidden = true; }
  function showCtx(x, y, items) {
    ctx.innerHTML = '';
    for (const it of items) {
      if (it === '-') { const s = document.createElement('div'); s.className = 'sep'; ctx.appendChild(s); continue; }
      const b = document.createElement('button');
      b.className = 'mi' + (it.danger ? ' danger' : '');
      b.textContent = it.label;
      b.addEventListener('mousedown', (ev) => ev.preventDefault());
      b.addEventListener('click', () => { hideCtx(); it.run(); });
      ctx.appendChild(b);
    }
    ctx.hidden = false;
    const w = ctx.offsetWidth;
    const h = ctx.offsetHeight;
    ctx.style.left = Math.max(4, Math.min(x, innerWidth - w - 4)) + 'px';
    ctx.style.top = Math.max(4, Math.min(y, innerHeight - h - 4)) + 'px';
  }
  editor.addEventListener('contextmenu', (e) => {
    const img = e.target.closest('img');
    const voice = e.target.closest('.voice');
    const a = e.target.closest('a[href]');
    const cell = e.target.closest('td,th');
    let items = null;
    if (img) {
      const drawing = img.classList.contains('att-drawing');
      const guarded = (fn) => () => (needsResizeWarning() ? resizeWarning(fn) : fn());
      const fixed = img.classList.contains('fixed');
      // A locked layout with a drawing keeps every picture at its size, so the drawing stays on
      // what it marked. The option would do nothing there, so the menu says why instead.
      const pinnedByInk = hasInk() && !!note.wrapWidth;
      const keep = pinnedByInk ? {
        label: '✓ Keep size (on while there’s a drawing)',
        run: () => toast('Pictures keep their size so your drawing lines up. Turn word wrap on to let them shrink.'),
      } : {
        label: (fixed ? '✓ ' : '') + 'Keep size when the note gets narrower',
        run: () => {
          if (fixed) img.classList.remove('fixed');
          else {
            // remember the size it has with the note at full width (not a squeezed size)
            if (!img.getAttribute('width')) img.setAttribute('width', String(Math.round(Math.min(img.naturalWidth || Infinity, editor.clientWidth))));
            img.classList.add('fixed');
          }
          changed();
          toast(fixed ? 'This picture now shrinks with the note' : 'This picture keeps its size; scroll sideways if the note gets narrower');
        },
      };
      // 1.1.23: words you can find the picture by (Ctrl+F and the notes list's search); shown when you point at it
      const desc = { label: img.getAttribute('alt') ? 'Edit description…' : 'Add description…', run: () => openDesc(img) };
      items = drawing
        ? [{ label: 'Edit sketch', run: () => openDraw(img) }, desc, '-', keep]
        : [
          { label: 'Copy image', run: () => copyPhoto(img) }, // 1.1.22 (sixth round)
          { label: 'Open in photo viewer', run: () => openPhoto(img) }, // was "Open full size"
          desc,
          '-',
          { label: 'Small', run: guarded(() => setImgWidth(img, editor.clientWidth * 0.4)) },
          { label: 'Medium', run: guarded(() => setImgWidth(img, editor.clientWidth * 0.7)) },
          { label: 'Full width', run: guarded(() => { img.classList.remove('w-s', 'w-m', 'fixed'); img.removeAttribute('width'); changed(); placeHandle(); }) },
          '-',
          keep,
        ];
      items.push('-', { label: drawing ? 'Remove drawing' : 'Remove photo', danger: true, run: () => { img.remove(); changed(); } });
    } else if (voice) {
      items = [
        { label: playingChip === voice ? 'Pause' : 'Play', run: () => togglePlay(voice) },
        '-',
        { label: 'Remove recording', danger: true, run: () => { if (playingChip === voice) stopPlay(); voice.remove(); changed(); } },
      ];
    } else if (a) {
      items = [
        { label: 'Open link', run: () => api.openExternal(a.getAttribute('href')) },
        { label: 'Edit link', run: () => openLinkForm(a) },
        { label: 'Copy link address', run: () => navigator.clipboard.writeText(a.getAttribute('href')).catch(() => {}) },
        '-',
        { label: 'Remove link (keep text)', run: () => { a.replaceWith(...a.childNodes); changed(); } },
      ];
    } else if (cell) {
      items = [
        { label: 'Add row above', run: () => tableOp(cell, 'rowAbove') },
        { label: 'Add row below', run: () => tableOp(cell, 'rowBelow') },
        { label: 'Add column left', run: () => tableOp(cell, 'colLeft') },
        { label: 'Add column right', run: () => tableOp(cell, 'colRight') },
        '-',
        { label: 'Delete row', danger: true, run: () => tableOp(cell, 'delRow') },
        { label: 'Delete column', danger: true, run: () => tableOp(cell, 'delCol') },
        { label: 'Delete table', danger: true, run: () => tableOp(cell, 'delTable') },
      ];
    }
    if (!items) return; // regular text: the normal Cut/Copy/Paste + spelling menu
    e.preventDefault();
    closePops();
    showCtx(e.clientX, e.clientY, items);
  });

  // ================================================================ voice notes
  let player = null;
  let playingChip = null;
  function togglePlay(chip) {
    if (playingChip === chip) { stopPlay(); return; }
    stopPlay();
    const audio = new Audio(chip.dataset.src);
    player = audio;
    playingChip = chip;
    chip.classList.add('playing');
    const bars = [...chip.querySelectorAll('.v-bars i')];
    const dur = +chip.dataset.dur || 0;
    audio.ontimeupdate = () => {
      const d = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : dur;
      const k = d ? Math.round((audio.currentTime / d) * bars.length) : 0;
      bars.forEach((b, i) => b.classList.toggle('on', i < k));
      chip.querySelector('.v-time').textContent = fmt(audio.currentTime);
    };
    audio.onended = stopPlay;
    audio.onerror = () => { toast("Couldn't play this recording"); stopPlay(); };
    audio.play().catch(() => {});
  }
  function stopPlay() {
    if (player) { player.pause(); player = null; }
    if (playingChip) {
      playingChip.classList.remove('playing');
      playingChip.querySelectorAll('i.on').forEach((i) => i.classList.remove('on'));
      const t = playingChip.querySelector('.v-time');
      if (t) t.textContent = fmt(+playingChip.dataset.dur);
      playingChip = null;
    }
  }
  function voiceChip(url, dur) {
    let x = [...url].reduce((acc, c) => (acc * 31 + c.charCodeAt(0)) >>> 0, 7);
    let bars = '';
    for (let i = 0; i < 18; i++) {
      x = (Math.imul(x, 1103515245) + 12345) >>> 0;
      bars += `<i class="h${1 + ((x >>> 16) % 5)}"></i>`;
    }
    return `<span class="voice" contenteditable="false" data-src="${esc(url)}" data-dur="${dur}"><span class="v-play"></span><span class="v-bars">${bars}</span><span class="v-time">${fmt(dur)}</span></span>&nbsp;`;
  }

  const rec = { mr: null, stream: null, chunks: [], start: 0, timer: null, keep: true, ctx: null, raf: 0 };
  async function startRecording() {
    if (rec.mr) return;
    saveSel();
    try {
      rec.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    } catch {
      toast('No microphone found, or Windows blocked it (Settings → Privacy → Microphone)');
      return;
    }
    const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : 'audio/webm';
    rec.mr = new MediaRecorder(rec.stream, { mimeType: mime });
    rec.chunks = [];
    rec.keep = true;
    rec.mr.ondataavailable = (e) => { if (e.data && e.data.size) rec.chunks.push(e.data); };
    rec.mr.onstop = finishRecording;
    rec.mr.start(250);
    rec.start = Date.now();
    $('#recbar').hidden = false;
    $('#recTime').textContent = '0:00';
    rec.timer = setInterval(() => { $('#recTime').textContent = fmt((Date.now() - rec.start) / 1000); }, 250);
    startMeter();
  }
  function startMeter() {
    const meter = $('#meter');
    meter.innerHTML = '<i></i>'.repeat(40);
    const bars = [...meter.children];
    try {
      rec.ctx = new AudioContext();
      const src = rec.ctx.createMediaStreamSource(rec.stream);
      const an = rec.ctx.createAnalyser();
      an.fftSize = 512;
      src.connect(an);
      const data = new Uint8Array(an.fftSize);
      const levels = new Array(bars.length).fill(3);
      let last = 0;
      const tick = (t) => {
        rec.raf = requestAnimationFrame(tick);
        if (t - last < 70) return;
        last = t;
        an.getByteTimeDomainData(data);
        let peak = 0;
        for (const v of data) peak = Math.max(peak, Math.abs(v - 128));
        levels.shift();
        levels.push(3 + Math.min(19, peak / 2.2));
        bars.forEach((b, i) => { b.style.height = levels[i] + 'px'; });
      };
      rec.raf = requestAnimationFrame(tick);
    } catch { /* meter is just decoration */ }
  }
  function stopRecording(keep) {
    if (!rec.mr) return;
    rec.keep = keep;
    try { rec.mr.stop(); } catch { finishRecording(); }
  }
  async function finishRecording() {
    clearInterval(rec.timer);
    cancelAnimationFrame(rec.raf);
    if (rec.ctx) { rec.ctx.close().catch(() => {}); rec.ctx = null; }
    if (rec.stream) rec.stream.getTracks().forEach((t) => t.stop());
    $('#recbar').hidden = true;
    const dur = Math.max(1, Math.round((Date.now() - rec.start) / 1000));
    const chunks = rec.chunks;
    const keep = rec.keep;
    rec.mr = null;
    rec.stream = null;
    rec.chunks = [];
    if (!keep || !chunks.length) return;
    try {
      const blob = new Blob(chunks, { type: 'audio/webm' });
      const url = await api.saveAttachment(new Uint8Array(await blob.arrayBuffer()), 'webm');
      insertNodes(voiceChip(url, dur));
    } catch {
      toast('Could not save the recording');
    }
  }
  $('#recStop').addEventListener('click', () => stopRecording(true));
  $('#recCancel').addEventListener('click', () => stopRecording(false));

  // ================================================================ drawing
  const cv = $('#cv');
  const g = cv.getContext('2d');
  const draw = { strokes: [], color: '#2B2B2B', size: 4, erase: false, bg: null, target: null, cur: null, dpr: 1, w: 0, h: 0 };

  function openDraw(target) {
    closePops();
    hideCtx();
    if (!target) saveSel();
    draw.target = target;
    draw.strokes = [];
    draw.bg = null;
    draw.cur = null;
    $('#draw').hidden = false;
    sizeCanvas();
    if (target) {
      const im = new Image();
      im.onload = () => {
        const w = Number(target.getAttribute('width')) || im.naturalWidth;
        const scale = Math.min(1, draw.w / w);
        draw.bg = { img: im, w: w * scale, h: (im.naturalHeight * (w / im.naturalWidth)) * scale };
        redraw();
      };
      im.src = target.getAttribute('src');
    }
  }
  function closeDraw() {
    $('#draw').hidden = true;
    draw.cur = null;
  }
  function sizeCanvas() {
    const r = cv.getBoundingClientRect();
    draw.dpr = window.devicePixelRatio || 1;
    draw.w = r.width;
    draw.h = r.height;
    cv.width = Math.max(1, Math.round(r.width * draw.dpr));
    cv.height = Math.max(1, Math.round(r.height * draw.dpr));
    g.setTransform(draw.dpr, 0, 0, draw.dpr, 0, 0);
    redraw();
  }
  window.addEventListener('resize', () => { if (!$('#draw').hidden) sizeCanvas(); });

  function strokeWidth(s, p) { return s.erase ? s.size * 4 : s.size * (0.45 + p * 1.1); }
  function paintStroke(s) {
    const pts = s.pts;
    g.save();
    g.globalCompositeOperation = s.erase ? 'destination-out' : 'source-over';
    g.strokeStyle = s.color;
    g.fillStyle = s.color;
    g.lineCap = 'round';
    g.lineJoin = 'round';
    if (pts.length === 1) {
      g.beginPath();
      g.arc(pts[0].x, pts[0].y, strokeWidth(s, pts[0].p) / 2, 0, Math.PI * 2);
      g.fill();
    } else {
      const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
      let from = pts[0];
      for (let i = 1; i < pts.length; i++) {
        const to = i === pts.length - 1 ? pts[i] : mid(pts[i], pts[i + 1]);
        g.lineWidth = strokeWidth(s, pts[i].p);
        g.beginPath();
        g.moveTo(from.x, from.y);
        g.quadraticCurveTo(pts[i].x, pts[i].y, to.x, to.y);
        g.stroke();
        from = to;
      }
    }
    g.restore();
  }
  function redraw() {
    g.clearRect(0, 0, draw.w, draw.h);
    if (draw.bg) g.drawImage(draw.bg.img, 0, 0, draw.bg.w, draw.bg.h);
    draw.strokes.forEach(paintStroke);
    $('#dHint').hidden = draw.strokes.length > 0 || !!draw.bg;
  }
  const ptOf = (e) => ({ x: e.offsetX, y: e.offsetY, p: e.pointerType === 'pen' ? (e.pressure || 0.5) : 0.5 });
  cv.addEventListener('pointerdown', (e) => {
    cv.setPointerCapture(e.pointerId);
    draw.cur = { color: draw.color, size: draw.size, erase: draw.erase, pts: [ptOf(e)] };
    draw.strokes.push(draw.cur);
    redraw();
  });
  cv.addEventListener('pointermove', (e) => {
    if (!draw.cur) return;
    const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
    for (const ev of (evs.length ? evs : [e])) draw.cur.pts.push(ptOf(ev));
    redraw();
  });
  const endStroke = () => { draw.cur = null; };
  cv.addEventListener('pointerup', endStroke);
  cv.addEventListener('pointercancel', endStroke);

  function drawUndo() { draw.strokes.pop(); redraw(); }
  $('#dUndo').addEventListener('click', drawUndo);
  $('#dClear').addEventListener('click', () => { draw.strokes = []; draw.bg = null; redraw(); });
  $('#dCancel').addEventListener('click', closeDraw);
  $$('#pens .pen').forEach((b) => b.addEventListener('click', () => {
    draw.color = b.dataset.pen;
    draw.erase = false;
    body.classList.remove('erasing');
    $('#eraser').classList.remove('on');
    $$('#pens .pen').forEach((x) => x.classList.toggle('on', x === b));
  }));
  $$('#sizes .size').forEach((b) => b.addEventListener('click', () => {
    draw.size = Number(b.dataset.w);
    $$('#sizes .size').forEach((x) => x.classList.toggle('on', x === b));
  }));
  $('#eraser').addEventListener('click', () => {
    draw.erase = !draw.erase;
    body.classList.toggle('erasing', draw.erase);
    $('#eraser').classList.toggle('on', draw.erase);
  });

  function contentBox() {
    const { width, height } = cv;
    const px = g.getImageData(0, 0, width, height).data;
    let x0 = width; let y0 = height; let x1 = -1; let y1 = -1;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (px[(y * width + x) * 4 + 3] > 8) {
          if (x < x0) x0 = x;
          if (x > x1) x1 = x;
          if (y < y0) y0 = y;
          if (y > y1) y1 = y;
        }
      }
    }
    if (x1 < 0) return null;
    const pad = Math.round(6 * draw.dpr);
    x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad);
    x1 = Math.min(width - 1, x1 + pad); y1 = Math.min(height - 1, y1 + pad);
    return { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
  }

  $('#dDone').addEventListener('click', async () => {
    const target = draw.target;
    if (!draw.strokes.length && (target ? draw.bg : true)) { closeDraw(); return; }
    redraw();
    const box = contentBox();
    if (!box) {
      if (target) { target.remove(); changed(); }
      closeDraw();
      return;
    }
    const out = document.createElement('canvas');
    out.width = box.w;
    out.height = box.h;
    out.getContext('2d').drawImage(cv, box.x, box.y, box.w, box.h, 0, 0, box.w, box.h);
    const blob = await new Promise((res) => out.toBlob(res, 'image/png'));
    try {
      const url = await api.saveAttachment(new Uint8Array(await blob.arrayBuffer()), 'png');
      const cssW = Math.round(box.w / draw.dpr);
      closeDraw();
      if (target && editor.contains(target)) {
        target.setAttribute('src', url);
        target.setAttribute('width', String(cssW));
        changed();
      } else {
        insertNodes(`<img class="att-drawing" src="${esc(url)}" width="${cssW}">`);
      }
    } catch {
      toast('Could not save the drawing');
    }
  });

  // ================================================================ photo resizing
  const handle = $('#imgHandle');
  let resizing = false;
  const MIN_IMG = 60;
  function selectedImage() {
    const img = editor.querySelector('img.sel-img');
    return img && editor.contains(img) ? img : null;
  }
  function selectImage(img) {
    $$('#editor .sel-img').forEach((i) => i !== img && i.classList.remove('sel-img'));
    const r = document.createRange();
    r.selectNode(img);
    const s = getSelection();
    s.removeAllRanges();
    s.addRange(r);
    img.classList.add('sel-img');
    placeHandle();
  }
  function placeHandle() {
    const img = selectedImage();
    if (!img || hidden || note?.rolled) { handle.hidden = true; return; }
    const r = img.getBoundingClientRect();
    const box = $('#scroller').getBoundingClientRect();
    if (r.bottom < box.top + 4 || r.bottom > box.bottom - 2) { handle.hidden = true; return; }
    handle.hidden = false;
    handle.style.left = `${Math.min(r.right, box.right - 10)}px`;
    handle.style.top = `${r.bottom}px`;
  }
  function setImgWidth(img, w) {
    const max = editor.clientWidth;
    w = Math.round(Math.max(Math.min(MIN_IMG, max), Math.min(max, w)));
    img.classList.remove('w-s', 'w-m');
    img.setAttribute('width', String(w));
    changed();
    placeHandle();
  }
  handle.addEventListener('pointerdown', (e) => {
    const img = selectedImage();
    if (!img) return;
    e.preventDefault();
    if (needsResizeWarning()) { resizeWarning(); return; }
    handle.setPointerCapture(e.pointerId);
    resizing = true;
    body.classList.add('resizing');
    const startX = e.clientX;
    const startW = img.getBoundingClientRect().width;
    const max = editor.clientWidth;
    const min = Math.min(MIN_IMG, max);
    const move = (ev) => {
      const w = Math.round(Math.max(min, Math.min(max, (startW + ev.clientX - startX) / zoomNow())));
      img.classList.remove('w-s', 'w-m');
      img.setAttribute('width', String(w));
      placeHandle();
    };
    const up = () => {
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', up);
      handle.removeEventListener('pointercancel', up);
      resizing = false;
      body.classList.remove('resizing');
      changed();
      placeHandle();
    };
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', up);
    handle.addEventListener('pointercancel', up);
  });
  $('#scroller').addEventListener('scroll', placeHandle, { passive: true });
  window.addEventListener('resize', placeHandle);
  editor.addEventListener('load', placeHandle, true);

  // ================================================================ locking
  // "Snap shut" (1.1.14, replaced 1.1.13's stardust): locking blurs the note's writing away while the padlock drops in,
  // bounces, and its shackle snaps shut; unlocking pops the shackle open and the padlock floats up as the note fades
  // in. Like a real padlock, the shackle's long side never leaves the lock body (note.html: it reaches down inside
  // the body, hidden by a clip path). The fading writing is a picture-only copy (`.lockghost`, never saved or edited)
  // that is gone after half a second; the real note is emptied straight away.
  const calm = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  // a copy of the lock screen's padlock that opens and floats away while the note comes back
  function lockFly() {
    if (calm() || body.classList.contains('rolled') || $('#lockScreen').hidden) return null;
    const ic = $('.lockicon');
    const r = ic.getBoundingClientRect();
    if (!r.width) return null;
    const f = ic.cloneNode(true);
    f.classList.add('lockfly');
    f.setAttribute('aria-hidden', 'true');
    Object.assign(f.style, { left: `${r.left}px`, top: `${r.top}px` });
    return f;
  }
  function lockGhost() {
    if (calm() || body.classList.contains('rolled')) return null;
    const sc = $('#scroller');
    const r = sc.getBoundingClientRect();
    if (!r.width || !r.height) return null;
    const g = sc.cloneNode(true);
    // it keeps the same ids so it looks exactly the same; it sits last in the page, so the real elements are
    // still the ones found by id
    g.classList.add('lockghost');
    g.querySelectorAll('[contenteditable]').forEach((el) => el.removeAttribute('contenteditable'));
    g.setAttribute('aria-hidden', 'true');
    Object.assign(g.style, { left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px` });
    body.append(g);
    g.scrollTop = sc.scrollTop;
    setTimeout(() => g.remove(), 600);
    return g;
  }
  let animTimer = null;
  function playLockAnim(kind) {
    if (calm() || body.classList.contains('rolled')) return;
    clearTimeout(animTimer);
    body.classList.remove('anim-lock', 'anim-unlock');
    void body.offsetWidth;
    body.classList.add(kind === 'lock' ? 'anim-lock' : 'anim-unlock');
    animTimer = setTimeout(() => body.classList.remove('anim-lock', 'anim-unlock'), 1000);
  }
  function showContent(n) {
    const fly = lockFly();
    observer.disconnect();
    hidden = false;
    note = { ...note, ...n, hidden: false };
    editor.innerHTML = note.html || '';
    decorate();
    observer.observe(editor, { childList: true, subtree: true, characterData: true });
    dirty = false;
    applyLook();
    renderInk();
    updateEmpty();
    if (fly) { body.append(fly); setTimeout(() => fly.remove(), 800); }
    playLockAnim('unlock');
  }
  function hideContent() {
    const ghost = hidden ? null : lockGhost();
    if (inkState.on) exitInk();
    inkState.undo = []; // a locked note keeps no copies of its drawing in the undo (or redo) list
    inkState.redo = [];
    inkState.redoKept = [];
    inkState.dirty = false;
    clearTimeout(inkState.timer);
    note.ink = null;
    renderInk();
    stopPlay();
    if (!$('#draw').hidden) closeDraw();
    if (rec.mr) stopRecording(false);
    observer.disconnect();
    dirty = false;
    clearTimeout(saveTimer);
    hidden = true;
    editor.innerHTML = '';
    note.html = '';
    observer.observe(editor, { childList: true, subtree: true, characterData: true });
    $('#unlockPw').value = '';
    $('#unlockErr').textContent = '';
    closePops();
    closeText();
    applyLook();
    handle.hidden = true;
    if (ghost) playLockAnim('lock');
  }
  async function relock() {
    await saveNow();
    await api.relock();
    hideContent();
  }
  // Locked from the notes list: save what's typed, then hide.
  api.onLockNow(() => { if (!hidden) relock(); });
  // Colour/font/lock changed from the notes list.
  api.onLook((v) => {
    if (!note || !v) return;
    for (const k of ['color', 'font', 'size', 'title', 'locked', 'lockedBy', 'pinned', 'opacity', 'rolled', 'fx', 'fxPaused', 'fxPlay']) if (k in v) note[k] = v[k];
    if (v.hidden && !hidden) { hideContent(); return; }
    // the lock was removed from the notes list while this window still asked for the password/PIN:
    // show the note straight away
    if (!v.hidden && hidden) {
      $('#unlockPw').value = '';
      $('#unlockErr').textContent = '';
      showContent(v);
      toast('Lock removed');
      return;
    }
    applyLook();
  });
  async function toggleLock() {
    closePops();
    if (note.locked) {
      const n = await api.setLocked(false);
      if (n && !n.error) { note.locked = false; note.lockedBy = n.lockedBy; applyLook(); toast('Lock removed'); }
      return;
    }
    if (note.lockedBy === 'group') return;
    if (!settings.hasPassword) { openPwPop(); return; }
    await lockNow();
  }
  async function lockNow() {
    saveNow();
    const n = await api.setLocked(true);
    if (!n || n.error) { toast('Could not lock this note'); return; }
    note.locked = true;
    note.lockedBy = 'note';
    hideContent();
    toast('Note locked 🔒');
  }
  // ---- password or PIN. A PIN is digits only, and opens the note as soon as all its digits are typed.
  const isPinLock = () => settings.lockKind === 'pin';
  const digitsOnly = (el) => { const v = el.value.replace(/\D/g, ''); if (v !== el.value) el.value = v; };
  function paintUnlock() {
    const pin = isPinLock();
    const inp = $('#unlockPw');
    inp.placeholder = pin ? 'PIN' : 'Password';
    inp.inputMode = pin ? 'numeric' : 'text';
    inp.maxLength = pin ? settings.lockLen || 12 : 200;
  }
  let pwKind = 'pin';
  function paintPwKind() {
    $$('#pwKind button').forEach((b) => b.classList.toggle('on', b.dataset.k === pwKind));
    $('#pwNewLabel').textContent = pwKind === 'pin' ? 'PIN (4 to 12 digits)' : 'Password (at least 4 characters)';
    for (const id of ['#pwNew', '#pwAgain']) {
      const el = $(id);
      el.inputMode = pwKind === 'pin' ? 'numeric' : 'text';
      el.maxLength = pwKind === 'pin' ? 12 : 200;
      if (pwKind === 'pin') digitsOnly(el);
    }
  }
  $$('#pwKind button').forEach((b) => b.addEventListener('click', () => { pwKind = b.dataset.k; $('#pwErr').textContent = ''; paintPwKind(); $('#pwNew').focus(); }));
  for (const id of ['#pwNew', '#pwAgain']) $(id).addEventListener('input', (e) => { if (pwKind === 'pin') digitsOnly(e.target); });
  function openPwPop() {
    $('#pwNew').value = '';
    $('#pwAgain').value = '';
    $('#pwErr').textContent = '';
    pwKind = 'pin';
    paintPwKind();
    openPop('#pwPop');
    setTimeout(() => $('#pwNew').focus(), 20);
  }
  $('#pwCancel').addEventListener('click', closePops);
  $('#pwPop').addEventListener('submit', async (e) => {
    e.preventDefault();
    const a = $('#pwNew').value;
    const b = $('#pwAgain').value;
    if (pwKind === 'pin' && (a.length < 4 || a.length > 12)) { $('#pwErr').textContent = 'A PIN is 4 to 12 digits.'; return; }
    if (a.length < 4) { $('#pwErr').textContent = 'Use at least 4 characters.'; return; }
    if (a !== b) { $('#pwErr').textContent = "The two don't match."; return; }
    const r = await api.setPassword('', a, pwKind);
    if (!r || r.error) { $('#pwErr').textContent = (r && r.error) || 'Could not save it.'; return; }
    settings.hasPassword = true;
    settings.lockKind = pwKind;
    settings.lockLen = pwKind === 'pin' ? a.length : 0;
    paintUnlock();
    closePops();
    await lockNow();
  });
  let unlocking = false;
  $('#unlockPw').addEventListener('input', (e) => {
    if (!isPinLock()) return;
    digitsOnly(e.target);
    $('#unlockErr').textContent = '';
    // the right number of digits: try it straight away, no Enter needed
    if (settings.lockLen && e.target.value.length === settings.lockLen && !unlocking) $('#unlockForm').requestSubmit();
  });
  $('#unlockForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (unlocking) return;
    const pw = $('#unlockPw').value;
    if (!pw) { $('#unlockPw').focus(); return; }
    unlocking = true;
    const n = await api.unlock(pw).finally(() => { unlocking = false; });
    if (!n || n.hidden) {
      $('#unlockErr').textContent = isPinLock() ? 'Wrong PIN' : 'Wrong password';
      const f = $('#unlockForm');
      f.classList.remove('shake');
      void f.offsetWidth;
      f.classList.add('shake');
      if (isPinLock()) $('#unlockPw').value = ''; else $('#unlockPw').select();
      $('#unlockPw').focus();
      return;
    }
    $('#unlockPw').value = '';
    $('#unlockErr').textContent = '';
    $('#toast').hidden = true;
    showContent(n);
    editor.focus();
    caretAtEnd();
  });

  // ================================================================ "are you sure?" pop-up (app style)
  let askResolve = null;
  function ask(title, text, okLabel = 'OK') {
    openPop('#askPop');
    $('#askTitle').textContent = title;
    $('#askText').textContent = text;
    $('#askYes').textContent = okLabel;
    return new Promise((resolve) => { askResolve = resolve; });
  }
  const answerAsk = (v) => { const r = askResolve; askResolve = null; closePop('#askPop'); if (r) r(v); };
  $('#askYes').addEventListener('click', () => answerAsk(true));
  $('#askNo').addEventListener('click', () => answerAsk(false));

  // ================================================================ word wrap (text layout lock)
  // Word wrap on = normal: text wraps with the note. Word wrap off = the text area keeps a fixed
  // width (note.wrapWidth) so text and pictures never re-wrap; a narrower note shows a sideways
  // scrollbar instead. Drawing turns word wrap off by itself, so circles and arrows stay on what
  // they marked.
  const sheet = $('#sheet');

  // ---- zoom (1.1.13): Ctrl + mouse wheel makes the writing bigger or smaller (text, pictures and drawing together),
  // Ctrl + 0 goes back to 100 %, Ctrl + = / Ctrl + - work too. Each note remembers its own zoom (note.zoom, 50–300 %).
  // It's CSS `zoom` on #sheet: sizes inside the note stay in its own pixels, but mouse positions and
  // getBoundingClientRect are screen pixels, so code that turns one into the other divides by zoomNow()
  // (inkPt, picture resizing, --viewW, contentRight).
  const zoomNow = () => (note && note.zoom > 0 ? note.zoom : 1);
  function applyZoom() {
    const z = zoomNow();
    const css = z === 1 ? '' : String(z);
    if (sheet.style.zoom === css) return;
    sheet.style.zoom = css;
    updateViewWidth();
    placeHandle();
    fitSideways();
  }
  function setZoom(z) {
    z = Math.round(Math.min(3, Math.max(0.5, z)) * 10) / 10;
    if (!note || hidden || z === zoomNow()) return;
    setProp({ zoom: z });
    toast(`Zoom ${Math.round(z * 100)}%`);
  }
  let wheelSum = 0;
  window.addEventListener('wheel', (e) => {
    if (!e.ctrlKey) return;
    e.preventDefault(); // never Chromium's own page zoom
    wheelSum += e.deltaY;
    if (Math.abs(wheelSum) < 40) return; // a touchpad sends many tiny steps
    setZoom(zoomNow() + (wheelSum < 0 ? 0.1 : -0.1));
    wheelSum = 0;
  }, { passive: false });
  const hasInk = () => !!(note && note.ink && note.ink.s && note.ink.s.length);
  // How wide the visible writing area is. With the layout locked, pictures without "Keep size"
  // still shrink to this (note.css: --viewW), so a narrower note doesn't cut them off.
  const scroller = $('#scroller');
  function updateViewWidth() {
    const cs = getComputedStyle(scroller);
    const w = (scroller.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)) / zoomNow();
    sheet.style.setProperty('--viewW', `${Math.max(0, Math.floor(w))}px`);
  }
  new ResizeObserver(() => { updateViewWidth(); placeHandle(); fitSideways(); }).observe(scroller);
  function applyLayout() {
    if (!note) return;
    sheet.style.width = note.wrapWidth ? `${note.wrapWidth}px` : '';
    sheet.classList.toggle('fixed', !!note.wrapWidth);
    sheet.classList.toggle('inked', hasInk());
    updateViewWidth();
    const b = inkBounds();
    sheet.style.minWidth = b ? `${Math.ceil(b.x2 + 6)}px` : '';
    sheet.style.minHeight = b ? `max(100%, ${Math.ceil(b.y2 + 6)}px)` : '';
    const w = $('#btnWrap');
    w.classList.toggle('on', !note.wrapWidth);
    w.title = note.wrapWidth ? 'Word wrap: off (lines keep their width)' : 'Word wrap: on';
    fitSideways();
  }

  // Sideways scrolling only when something is really out of view. With word wrap off the text area
  // keeps the width it had when the note was wider, so a narrower note could scroll sideways into
  // empty space (e.g. a small photo and short lines). The layout itself is not changed (nothing
  // re-wraps, drawings stay lined up); only the empty extra room stops being scrollable.
  // Counted as content: text, pictures, voice notes, tables and the drawing.
  function contentRight() {
    const left = sheet.getBoundingClientRect().left;
    const b = inkBounds();
    let right = b ? b.x2 * zoomNow() : 0; // (screen pixels, like the rest here)
    const range = document.createRange();
    const walk = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
    for (let t = walk.nextNode(); t; t = walk.nextNode()) {
      if (!t.nodeValue.trim()) continue;
      range.selectNodeContents(t);
      for (const r of range.getClientRects()) if (r.width) right = Math.max(right, r.right - left);
    }
    for (const el of editor.querySelectorAll('img, video, canvas, svg, table, .voice')) {
      const r = el.getBoundingClientRect();
      if (r.width) right = Math.max(right, r.right - left);
    }
    return right;
  }
  let sideFrame = 0;
  function fitSideways() {
    cancelAnimationFrame(sideFrame);
    sideFrame = requestAnimationFrame(() => {
      sideFrame = 0;
      // room from the text area's left edge to the note's right edge
      const room = scroller.clientWidth - (parseFloat(getComputedStyle(scroller).paddingLeft) || 0);
      const needed = !!note && !hidden && contentRight() > room + 1;
      scroller.style.overflowX = needed ? '' : 'hidden';
      if (!needed) scroller.scrollLeft = 0;
    });
  }
  new ResizeObserver(fitSideways).observe(editor);
  editor.addEventListener('load', fitSideways, true); // a picture finished loading (load doesn't bubble)
  if (document.fonts) document.fonts.ready.then(fitSideways);
  async function toggleWrap() {
    if (note.wrapWidth) {
      if (hasInk() && !(await ask('Turn word wrap on?', 'Text may move away from your drawing.', 'Turn on'))) return;
      setProp({ wrapWidth: null });
      toast('Word wrap on');
    } else {
      setProp({ wrapWidth: Math.round(editor.clientWidth) });
      toast('Word wrap off');
    }
  }
  $('#btnWrap').addEventListener('mousedown', (e) => e.preventDefault());
  $('#btnWrap').addEventListener('click', toggleWrap);

  // resizing a picture under a drawing can move things away from it: warn once per window
  let resizeOk = false;
  const needsResizeWarning = () => hasInk() && !resizeOk;
  async function resizeWarning(then) {
    const ok = await ask('Resize this picture?', 'This note has a drawing. Changing a picture’s size can move things so they no longer line up with what you drew.', 'Resize anyway');
    if (!ok) return;
    resizeOk = true;
    if (then) then(); else toast('OK, drag the corner again to resize');
  }

  // ================================================================ draw-over
  const SVGNS = 'http://www.w3.org/2000/svg';
  const INK_COLORS = ['#2B2B2B', '#E5484D', '#F08C00', '#FFC800', '#2FA35A', '#3E7BFA', '#8E4EC6', '#E64980'];
  // one short line each, so the toolbar keeps the same size whichever tool is picked
  const HINTS = {
    pen: 'Tip: hold Shift to draw a straight line.',
    hl: 'Tip: hold Shift for a straight highlight.',
    line: 'Tip: hold Shift to snap to angles.',
    arrow: 'Tip: hold Shift to snap to angles.',
    rect: 'Tip: hold Shift for a perfect square.',
    ellipse: 'Tip: hold Shift for a perfect circle.',
    eraser: 'Tip: touch a line to remove all of it.',
    rub: 'Tip: erases only what’s under the circle.',
  };
  // eraseMode: 'part' = "Partial" eraser (only what's under the circle), 'stroke' = "Whole line".
  // ew = partial eraser size (same 2/4/8 steps as the thickness buttons; radius = ew * 3 px).
  // dash: '' = solid line, 'dash' = dashed, 'dot' = dotted (1.1.13; works with every drawing tool)
  const inkState = { on: false, tool: 'pen', color: '#E5484D', w: 4, layer: 'a', dash: '', eraseMode: 'part', ew: 4, cur: null, el: null, undo: [], redo: [], redoKept: [], dirty: false, timer: null, erasing: false, erased: false, last: null };
  const PREF_KEYS = ['tool', 'color', 'w', 'layer', 'dash', 'eraseMode', 'ew'];
  try {
    const saved = JSON.parse(localStorage.getItem('inkPrefs') || '{}');
    for (const k of PREF_KEYS) if (saved[k] != null) inkState[k] = saved[k];
  } catch { /* fine */ }
  if (inkState.eraseMode !== 'stroke') inkState.eraseMode = 'part';
  if (![2, 4, 8].includes(inkState.ew)) inkState.ew = 4;
  if (inkState.dash !== 'dash' && inkState.dash !== 'dot') inkState.dash = '';
  const savePrefs = () => { try { localStorage.setItem('inkPrefs', JSON.stringify(Object.fromEntries(PREF_KEYS.map((k) => [k, inkState[k]])))); } catch { /* fine */ } };
  const rubbing = () => inkState.tool === 'eraser' && inkState.eraseMode === 'part';
  // Mouse pointers that look like the tool: a pencil for the pen, a marker for the highlighter,
  // with the tip in the colour you picked. 24 px, the tip of the drawing is where the line starts.
  const svgCursor = (svg, x, y) => `url("data:image/svg+xml,${encodeURIComponent(svg)}") ${x} ${y}, crosshair`;
  const CURSOR_SVG = {
    pen: (c) => `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><g stroke-linejoin="round">`
      + `<path d="M2.5 21.5 4 16.2 16.3 3.9a2.3 2.3 0 0 1 3.3 0l.5.5a2.3 2.3 0 0 1 0 3.3L7.8 20z" fill="#fff" stroke="#fff" stroke-width="3"/>`
      + `<path d="M4 16.2 16.3 3.9a2.3 2.3 0 0 1 3.3 0l.5.5a2.3 2.3 0 0 1 0 3.3L7.8 20z" fill="#FFF6D6" stroke="#2B2B2B" stroke-width="1.3"/>`
      + `<path d="M14.6 5.6l3.8 3.8" stroke="#2B2B2B" stroke-width="1.1"/>`
      + `<path d="M2.5 21.5 4 16.2 7.8 20z" fill="${c}" stroke="#2B2B2B" stroke-width="1.3"/></g></svg>`,
    hl: (c) => `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><g stroke-linejoin="round">`
      + `<path d="M2 19.6 5 14.6 15 4.6l4.4 4.4-10 10-4.9 3z" fill="#fff" stroke="#fff" stroke-width="3"/>`
      + `<path d="M5 14.6 15 4.6l4.4 4.4-10 10z" fill="#fff" stroke="#2B2B2B" stroke-width="1.3"/>`
      + `<path d="M15 4.6l1.6-1.6 4.4 4.4L19.4 9z" fill="${c}" stroke="#2B2B2B" stroke-width="1.3"/>`
      + `<path d="M2 19.6 5 14.6l4.4 4.4-4.9 3z" fill="${c}" stroke="#2B2B2B" stroke-width="1.3"/></g></svg>`,
  };
  function toolCursor() {
    if (inkState.tool === 'pen') return svgCursor(CURSOR_SVG.pen(inkState.color), 3, 21);
    if (inkState.tool === 'hl') return svgCursor(CURSOR_SVG.hl(inkState.color), 3, 21);
    return ''; // shapes keep the cross; the erasers have their own (see note.css)
  }
  const eraserR = () => inkState.ew * 3;

  const r1 = (v) => Math.round(v * 10) / 10;
  function smoothPath(p) {
    if (p.length <= 4) return `M${p[0]} ${p[1]}L${p[p.length - 2]} ${p[p.length - 1]}`;
    let d = `M${p[0]} ${p[1]}`;
    for (let i = 2; i < p.length - 2; i += 2) {
      const mx = r1((p[i] + p[i + 2]) / 2);
      const my = r1((p[i + 1] + p[i + 3]) / 2);
      d += `Q${p[i]} ${p[i + 1]} ${mx} ${my}`;
    }
    return `${d}L${p[p.length - 2]} ${p[p.length - 1]}`;
  }
  function strokeEl(st) {
    const [x1, y1, x2, y2] = st.p;
    let el;
    let head = ''; // an arrow's head, kept solid when the arrow is dashed or dotted
    if (st.t === 'pen' || st.t === 'hl') {
      el = document.createElementNS(SVGNS, 'path');
      el.setAttribute('d', smoothPath(st.p));
    } else if (st.t === 'line') {
      el = document.createElementNS(SVGNS, 'path');
      el.setAttribute('d', `M${x1} ${y1}L${x2} ${y2}`);
    } else if (st.t === 'arrow') {
      el = document.createElementNS(SVGNS, 'path');
      const a = Math.atan2(y2 - y1, x2 - x1);
      const len = Math.min(18 + st.w * 1.5, Math.hypot(x2 - x1, y2 - y1) * 0.6);
      const h1 = [x2 - len * Math.cos(a - 0.5), y2 - len * Math.sin(a - 0.5)].map(r1);
      const h2 = [x2 - len * Math.cos(a + 0.5), y2 - len * Math.sin(a + 0.5)].map(r1);
      head = `M${h1[0]} ${h1[1]}L${x2} ${y2}L${h2[0]} ${h2[1]}`;
      el.setAttribute('d', `M${x1} ${y1}L${x2} ${y2}${head}`);
    } else if (st.t === 'rect') {
      el = document.createElementNS(SVGNS, 'rect');
      el.setAttribute('x', Math.min(x1, x2));
      el.setAttribute('y', Math.min(y1, y2));
      el.setAttribute('width', Math.abs(x2 - x1));
      el.setAttribute('height', Math.abs(y2 - y1));
      el.setAttribute('rx', 4);
    } else {
      el = document.createElementNS(SVGNS, 'ellipse');
      el.setAttribute('cx', (x1 + x2) / 2);
      el.setAttribute('cy', (y1 + y2) / 2);
      el.setAttribute('rx', Math.abs(x2 - x1) / 2);
      el.setAttribute('ry', Math.abs(y2 - y1) / 2);
    }
    const hl = st.t === 'hl';
    el.setAttribute('fill', 'none');
    el.setAttribute('stroke', st.c);
    el.setAttribute('stroke-width', hl ? st.w * 4 : st.w);
    el.setAttribute('stroke-linecap', 'round');
    el.setAttribute('stroke-linejoin', 'round');
    if (hl) { el.setAttribute('stroke-opacity', '0.45'); el.classList.add('hl'); }
    // dashed / dotted (1.1.13): the gaps grow with the line's thickness; dots are round line ends with no length
    const sw = hl ? st.w * 4 : st.w;
    if (st.d === 'dash') el.setAttribute('stroke-dasharray', `${r1(sw * 2.2 + 3)} ${r1(sw * 2 + 4)}`);
    else if (st.d === 'dot') el.setAttribute('stroke-dasharray', `0.01 ${r1(sw * 1.9 + 3)}`);
    // a piece left over by the partial eraser carries on the dash pattern of the line it came from (1.1.14)
    if (st.d && st.o) el.setAttribute('stroke-dashoffset', st.o);
    if (head && st.d) {
      // dashed / dotted arrow: only the shaft gets the gaps, the head stays a clean solid point
      el.setAttribute('d', `M${x1} ${y1}L${x2} ${y2}`);
      const g = document.createElementNS(SVGNS, 'g');
      const tip = document.createElementNS(SVGNS, 'path');
      tip.setAttribute('d', head);
      for (const a of ['fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin']) tip.setAttribute(a, el.getAttribute(a));
      g.append(el, tip);
      return g;
    }
    return el;
  }
  const layerOf = (st) => (st.l === 'b' ? $('#inkBelow') : $('#inkAbove'));
  // Each stroke keeps its SVG element, so redrawing after erasing only builds the new pieces.
  const elCache = new WeakMap();
  function elFor(st) {
    let el = elCache.get(st);
    if (!el) { el = strokeEl(st); elCache.set(st, el); }
    return el;
  }
  function paintInk() {
    fitSideways(); // the drawing counts as content for sideways scrolling
    const above = [];
    const below = [];
    if (hasInk()) for (const st of note.ink.s) (st.l === 'b' ? below : above).push(elFor(st));
    $('#inkBelow').replaceChildren(...below);
    $('#inkAbove').replaceChildren(...above);
  }
  function renderInk() {
    paintInk();
    applyLayout();
  }
  function inkBounds() {
    if (!hasInk()) return null;
    let x2 = 0;
    let y2 = 0;
    for (const st of note.ink.s) {
      const pad = (st.t === 'hl' ? st.w * 2 : st.w / 2) + 2;
      for (let i = 0; i < st.p.length; i += 2) { x2 = Math.max(x2, st.p[i] + pad); y2 = Math.max(y2, st.p[i + 1] + pad); }
    }
    return { x2, y2 };
  }

  function paintInkBar() {
    $$('#inkTools button').forEach((b) => b.classList.toggle('on', b.dataset.tool === inkState.tool));
    $$('#inkColors button').forEach((b) => b.classList.toggle('on', b.dataset.c === inkState.color));
    const erasing = inkState.tool === 'eraser';
    // with the eraser, the colour row becomes the choice between the two erasers, and the
    // thickness buttons set the rub-out eraser's size (not needed for "whole line")
    $('#inkColors').hidden = erasing;
    $('#eraseMode').hidden = !erasing;
    // the size buttons always stay in place (no jumping); "Whole line" just greys them out
    const noSize = erasing && !rubbing();
    $('#inkWidths').classList.toggle('off', noSize);
    $$('#inkWidths button').forEach((b) => { b.disabled = noSize; });
    $('#inkCatch').style.cursor = toolCursor();
    $$('#eraseMode button').forEach((b) => b.classList.toggle('on', b.dataset.m === inkState.eraseMode));
    const wNow = erasing ? inkState.ew : inkState.w;
    $$('#inkWidths button').forEach((b) => {
      b.classList.toggle('on', Number(b.dataset.w) === wNow);
      b.title = erasing ? { 2: 'Small eraser', 4: 'Medium eraser', 8: 'Big eraser' }[b.dataset.w] : { 2: 'Thin', 4: 'Medium', 8: 'Thick' }[b.dataset.w];
    });
    $$('#inkLayer button').forEach((b) => b.classList.toggle('on', b.dataset.l === inkState.layer));
    $$('#inkDash button').forEach((b) => b.classList.toggle('on', b.dataset.d === inkState.dash));
    $('#inkDash').classList.toggle('off', erasing);
    $$('#inkDash button').forEach((b) => { b.disabled = erasing; });
    $('#inkHint').textContent = (rubbing() ? HINTS.rub : HINTS[inkState.tool]) || '';
    body.classList.toggle('erasing-ink', erasing && !rubbing());
    body.classList.toggle('rubbing-ink', rubbing());
    if (!rubbing()) $('#inkEraser').hidden = true;
    paintUndo();
  }
  (function buildInkBar() {
    for (const c of INK_COLORS) $('#inkColors').append(Object.assign(document.createElement('button'), { title: 'Colour' }));
    $$('#inkColors button').forEach((b, i) => { b.dataset.c = INK_COLORS[i]; b.style.setProperty('--c', INK_COLORS[i]); });
    $$('#inkBar button').forEach((b) => b.addEventListener('mousedown', (e) => e.preventDefault()));
    $$('#inkTools button').forEach((b) => b.addEventListener('click', () => { inkState.tool = b.dataset.tool; savePrefs(); paintInkBar(); }));
    $$('#inkColors button').forEach((b) => b.addEventListener('click', () => { inkState.color = b.dataset.c; if (inkState.tool === 'eraser') inkState.tool = 'pen'; savePrefs(); paintInkBar(); }));
    $$('#inkWidths button').forEach((b) => b.addEventListener('click', () => {
      if (inkState.tool === 'eraser') inkState.ew = Number(b.dataset.w);
      else inkState.w = Number(b.dataset.w);
      savePrefs();
      paintInkBar();
    }));
    $$('#eraseMode button').forEach((b) => b.addEventListener('click', () => { inkState.eraseMode = b.dataset.m; savePrefs(); paintInkBar(); }));
    $$('#inkLayer button').forEach((b) => b.addEventListener('click', () => { inkState.layer = b.dataset.l; savePrefs(); paintInkBar(); }));
    $$('#inkDash button').forEach((b) => b.addEventListener('click', () => { inkState.dash = b.dataset.d; savePrefs(); paintInkBar(); }));
  })();

  function enterInk() {
    if (hidden || !note) return;
    closePops();
    hideCtx();
    saveNow();
    inkState.on = true;
    inkState.paused = false;
    body.classList.remove('ink-paused');
    // the undo list is kept after Done (last 50 steps), so a drawing can still be undone later
    body.classList.add('inking');
    editor.contentEditable = 'false';
    $('#inkCatch').hidden = false;
    $('#inkBar').hidden = false;
    handle.hidden = true;
    paintInkBar();
    inkOut.start(); // its own window, ready for when it's dragged out (or straight outside, where it was last time)
    placeInkBar();
  }
  function exitInk() {
    inkState.on = false;
    inkState.paused = false;
    inkState.cur = null;
    body.classList.remove('inking', 'erasing-ink', 'rubbing-ink', 'ink-paused');
    $('#inkPz').title = 'Pause drawing, to type for a moment';
    $('#inkEraser').hidden = true;
    editor.contentEditable = 'true';
    $('#inkCatch').hidden = true;
    $('#inkBar').hidden = true;
    inkOut.stop();
    saveInk();
    paintUndo();
  }
  // ---- floating toolbars (drawing toolbar, text panel): drag them anywhere in the note.
  // They move when dragged by any empty spot (the grip, gaps, labels), or by `dragBtn` if given. Other buttons are clicked, never dragged.
  // dragBtn only starts moving after 4 px, so a normal click on it still works. The place is kept as the
  // distance from the bottom-right corner (remembered for next time); double-click the grip
  // to put it back. It always stays inside the note and below the top bar.
  // `out` (the drawing toolbar, 1.1.15; the text toolbar too, 1.1.16): dragged past the note's edge, it moves into its own window (barOut).
  // 1.1.16: `handle` = only that part starts a drag (the pop-ups: their grip); `top` = placed from the top (the
  // pop-ups open under the top bar), so the place is kept as { r, t } instead of { r, b }.
  function movable(el, { key, roomLeft = 0, dragBtn = null, out = null, handle = null, top = false }) {
    let pos = null;
    try { const v = JSON.parse(localStorage.getItem(key) || 'null'); if (v && Number.isFinite(v.r) && Number.isFinite(top ? v.t : v.b)) pos = v; } catch { /* fine */ }
    const m = { dragged: false };
    m.setPos = (p) => {
      pos = p;
      try { if (p) localStorage.setItem(key, JSON.stringify(p)); else localStorage.removeItem(key); } catch { /* fine */ }
      m.place();
    };
    m.place = () => {
      if (el.hidden || (out && out.isOut())) return;
      if (!pos) { el.style.left = ''; el.style.right = ''; el.style.bottom = ''; el.style.top = ''; fitIn(); return; }
      el.style.left = 'auto'; // the text panel opens on the left by default; a saved spot counts from the right
      const w = el.offsetWidth; const hgt = el.offsetHeight;
      const r = Math.max(4, Math.min(pos.r, innerWidth - w - 4 - roomLeft));
      if (top) { // a pop-up: from the top, never over the top bar unless the note is too small for it
        el.style.right = `${r}px`;
        el.style.top = `${Math.max(4, Math.min(Math.max(pos.t, 34), innerHeight - hgt - 4))}px`;
        return;
      }
      const b = Math.max(4, Math.min(pos.b, innerHeight - hgt - 36)); // never over the top bar
      el.style.right = `${r}px`;
      el.style.bottom = `${b}px`;
      fitIn();
    };
    // 1.1.16: in a small note the toolbar never goes past the top (that hid its X): it moves down so its top
    // shows, and if it's still taller than the note it scrolls (its X stays put, see pinX)
    function fitIn() {
      if (top || el.hidden || (out && out.isOut())) return;
      const tall = el.scrollHeight > innerHeight - 8;
      if (el.classList.contains('fit-tall') !== tall) el.classList.toggle('fit-tall', tall);
      if (el.getBoundingClientRect().top < 4) el.style.bottom = `${Math.max(4, innerHeight - el.offsetHeight - 4)}px`;
    }
    window.addEventListener('resize', m.place);
    if (window.ResizeObserver) new ResizeObserver(() => m.place()).observe(el);
    el.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      if (handle && !e.target.closest(handle)) return;
      const btn = e.target.closest('button');
      if (btn && btn !== dragBtn) return;
      if (!btn) e.preventDefault(); // also keeps the text selection
      // the window the toolbar is in right now: the note, or its own window when it's outside
      const view = el.ownerDocument.defaultView || window;
      const rect = el.getBoundingClientRect();
      const start = { sx: e.screenX, sy: e.screenY, r: innerWidth - rect.right, b: innerHeight - rect.bottom, t: rect.top };
      let moving = false;
      let outside = !!(out && out.isOut());
      let grab = outside ? out.grab(e.clientX, e.clientY) : null; // where the pointer holds it, in its own window
      const move = (ev) => {
        if (!moving) {
          if (Math.hypot(ev.screenX - start.sx, ev.screenY - start.sy) < 4) return;
          moving = true;
          body.classList.add('moving-inkbar');
          // captured by the page itself (not the button), so the drag carries on if the toolbar changes windows
          try { view.document.documentElement.setPointerCapture(e.pointerId); } catch { /* fine */ }
        }
        if (!outside && out && (ev.clientX < -6 || ev.clientY < -6 || ev.clientX > innerWidth + 6 || ev.clientY > innerHeight + 6)) {
          const r = el.getBoundingClientRect();
          grab = out.popOut(ev.clientX - r.left, ev.clientY - r.top);
          if (grab) outside = true;
        }
        if (outside) { out.dragTo(ev.screenX - grab.x, ev.screenY - grab.y, ev.screenX, ev.screenY); return; }
        pos = { r: start.r - (ev.screenX - start.sx), b: start.b - (ev.screenY - start.sy), t: start.t + (ev.screenY - start.sy) };
        m.place();
      };
      const up = (ev) => {
        view.removeEventListener('pointermove', move);
        view.removeEventListener('pointerup', up);
        view.removeEventListener('pointercancel', up);
        if (!moving) return;
        body.classList.remove('moving-inkbar');
        if (btn) { m.dragged = true; setTimeout(() => { m.dragged = false; }, 0); } // a drag is not a click
        if (outside) { out.drop(ev.screenX, ev.screenY, grab); return; }
        const r2 = el.getBoundingClientRect();
        m.setPos({ r: Math.round(innerWidth - r2.right), b: Math.round(innerHeight - r2.bottom), t: Math.round(r2.top) });
      };
      view.addEventListener('pointermove', move);
      view.addEventListener('pointerup', up);
      view.addEventListener('pointercancel', up);
    });
    const grip = el.querySelector('.igrip');
    if (grip) grip.addEventListener('dblclick', () => {
      if (out && out.isOut()) out.comeBack(); // outside: back into the note, in the corner
      m.setPos(null);
    });
    return m;
  }

  // ---- 1.1.15: the drawing toolbar outside the note
  // A page can't draw outside its window, so when the toolbar is dragged past the note's edge it moves into a
  // small see-through window of its own (window.open('about:blank'), allowed only for this in main.js). It's
  // the very same toolbar (moved, not copied), so every button keeps working. main.js places that window:
  // close to one of the note's sides it sticks to it and follows the note around; further away it stays put.
  // Dropped back on the note, it comes back inside. The window is made (hidden) when drawing starts, so
  // dragging out is instant, and closed when drawing ends. Where it was is remembered (localStorage
  // inkBarOut: { mode: 'dock', side, off } or { mode: 'free', x, y }), so next time it opens there again.
  // 1.1.16: the text toolbar can go outside too, the same way (its own window, 'cosmoTextBar'): barOut() makes
  // one of these for each toolbar. `kind` goes with every message to main.js ('ink' or 'text').
  function barOut({ el, kind, frame, title, key, mover, onEsc = null }) {
    const PAD = { l: 12, t: 8, r: 12, b: 14 }; // room around the toolbar in its window (for its shadow)
    const INSET = PAD; // where the visible toolbar starts in its window
    let w = null; // its window
    let isOut = false;
    let saved = null;
    let sizeObs = null;
    let ready = Promise.resolve(); // the styles in its window have loaded
    try { const v = JSON.parse(localStorage.getItem(key) || 'null'); if (v && (v.mode === 'dock' || v.mode === 'free')) saved = v; } catch { /* fine */ }
    const remember = (v) => {
      saved = v;
      try { if (v) localStorage.setItem(key, JSON.stringify(v)); else localStorage.removeItem(key); } catch { /* fine */ }
    };
    const alive = () => !!(w && !w.closed && w.document && w.document.body);
    const size = () => ({ bar: kind, w: el.offsetWidth + PAD.l + PAD.r, h: el.offsetHeight + PAD.t + PAD.b, inset: INSET });
    // the toolbar's window looks like the note (same styles, same body classes: paused, rolled, colour…)
    function mirror() {
      if (!alive()) return;
      const b = w.document.body;
      b.className = `${body.className} inkbar-out`;
      for (const [k, v] of Object.entries(body.dataset)) b.dataset[k] = v;
    }
    new MutationObserver(mirror).observe(body, { attributes: true });
    function open() {
      if (alive()) return true;
      try { w = window.open('about:blank', frame, 'width=320,height=200'); } catch { w = null; }
      if (!alive()) { w = null; return false; }
      const d = w.document;
      d.title = title;
      const loads = [];
      for (const l of document.querySelectorAll('link[rel="stylesheet"]')) {
        const c = d.createElement('link');
        c.rel = 'stylesheet';
        c.href = l.href;
        loads.push(new Promise((res) => { c.onload = res; c.onerror = res; setTimeout(res, 1500); }));
        d.head.append(c);
      }
      ready = Promise.all(loads);
      for (const s of document.querySelectorAll('head style')) d.head.append(d.importNode(s, true));
      if (onEsc) d.addEventListener('keydown', (e) => { if (e.key === 'Escape') onEsc(); });
      mirror();
      // the toolbar can change size (eraser options…): its window follows
      try {
        sizeObs = new w.ResizeObserver(() => { if (isOut) api.ink.size(size()); });
        sizeObs.observe(el);
      } catch { sizeObs = null; }
      return true;
    }
    function moveOut() {
      if (!open()) return false;
      const width = el.offsetWidth;
      w.document.body.append(el);
      el.style.left = ''; // its place inside the note doesn't count in its own window
      el.style.right = '';
      el.style.bottom = '';
      el.style.top = '';
      el.style.width = `${width}px`; // its width came from the note's size (pop-ups): keep it, not its window's
      el.classList.remove('fit-tall');
      outDocs.add(w.document);
      isOut = true;
      mirror();
      return true;
    }
    function moveIn() {
      if (w && w.document) outDocs.delete(w.document);
      if (el.ownerDocument !== document) document.body.append(el);
      el.style.width = '';
      isOut = false;
    }
    return {
      isOut: () => isOut,
      // the toolbar opens: make the window now; if the toolbar was outside last time, put it there again
      start() {
        if (!open()) return;
        if (saved && moveOut()) {
          // show it once its styles have loaded, so it has its real size
          ready.then(() => requestAnimationFrame(() => { if (isOut) api.ink.show({ ...saved, ...size() }); }));
        }
      },
      // the toolbar closes: it goes back into the note (hidden), and its window closes
      stop() {
        if (isOut) { moveIn(); api.ink.hide(kind); }
        if (w && !w.closed) { try { w.close(); } catch { /* fine */ } }
        w = null;
        sizeObs = null;
      },
      // the pointer holds the toolbar at (gx, gy) of the toolbar itself → move it out; returns the hold point in its window
      popOut(gx, gy) {
        if (!moveOut()) return null;
        return { x: gx + PAD.l, y: gy + PAD.t };
      },
      // already outside: where the pointer (clientX/Y in its window) holds it
      grab: (cx, cy) => ({ x: cx, y: cy }),
      dragTo(x, y, px, py) { api.ink.drag({ x, y, px, py, ...size() }); },
      async drop(px, py, grab) {
        const r = await api.ink.drop({ bar: kind, px, py });
        if (r && r.inside) {
          // back on the note: inside it again, under the pointer
          const bw = el.offsetWidth;
          const bh = el.offsetHeight;
          moveIn();
          remember(null);
          const left = px - window.screenX - (grab.x - PAD.l);
          const top = py - window.screenY - (grab.y - PAD.t);
          mover().setPos({ r: Math.round(innerWidth - left - bw), b: Math.round(innerHeight - top - bh), t: Math.round(top) });
        } else if (r && r.state) remember(r.state);
      },
      comeBack() {
        if (!isOut) return;
        moveIn();
        remember(null);
        api.ink.hide(kind);
      },
    };
  }
  const inkOut = barOut({ el: $('#inkBar'), kind: 'ink', frame: 'cosmoInkBar', title: 'Drawing', key: 'inkBarOut', mover: () => inkMove });
  const textOut = barOut({ el: $('#textPop'), kind: 'text', frame: 'cosmoTextBar', title: 'Text', key: 'textBarOut', mover: () => textMove });
  const inkBar = $('#inkBar');
  const inkMove = movable(inkBar, { key: 'inkBarPos', dragBtn: $('#inkPz'), out: inkOut }); // the pause button can drag the toolbar too
  const placeInkBar = () => inkMove.place();
  const textMove = movable($('#textPop'), { key: 'textBarPos', out: textOut });
  // 1.1.16: the ⋯ menu (note settings) and the Effects pop-up: dragged by their grip, inside or out of the note.
  // The menu's window can take the keyboard (for its title field); Esc there closes it.
  for (const [id, kind, frame, title] of [['#menu', 'menu', 'cosmoMenuBar', 'Note settings'], ['#fxPop', 'fx', 'cosmoFxBar', 'Effects']]) {
    const el = $(id);
    const po = { out: null, move: null };
    po.out = barOut({ el, kind, frame, title, key: `${kind}PopOut`, mover: () => po.move, onEsc: () => closePop(id) });
    po.move = movable(el, { key: `${kind}PopPos`, out: po.out, handle: '.igrip', top: true });
    popOuts[id] = po;
  }
  // 1.1.16: when a pop-up or toolbar has to scroll (a small note), its X stays at the top right, always visible
  function pinX(box) {
    const x = box && box.querySelector(':scope > .ix');
    if (!x) return;
    const keep = () => {
      const y = box.scrollTop;
      x.style.transform = y > 0 ? `translateY(${y}px)` : '';
      x.classList.toggle('pinned', y > 0);
    };
    box.addEventListener('scroll', keep, { passive: true });
    if (window.ResizeObserver) new ResizeObserver(keep).observe(box); // also when it opens again (back at the top)
  }
  [$('#menu'), $('#fxPop'), $('#textPop'), inkBar].forEach(pinX);

  $('#btnInk').addEventListener('mousedown', (e) => e.preventDefault());
  // Drawing ⇄ typing: using the bottom bar or the text toolbar puts drawing on hold so you can
  // write (the drawing toolbar fades); clicking a drawing tool (or Draw) brings drawing back.
  function pauseInk() {
    if (!inkState.on || inkState.paused) return;
    finishStroke();
    inkState.paused = true;
    body.classList.add('ink-paused');
    $('#inkEraser').hidden = true;
    $('#inkCatch').hidden = true;
    editor.contentEditable = 'true';
    saveInk();
    paintUndo();
    $('#inkPz').title = 'Carry on drawing';
    editor.focus();
  }
  function resumeInk() {
    body.classList.remove('text-fresh');
    if (!inkState.on || !inkState.paused) return;
    saveNow();
    inkState.paused = false;
    body.classList.remove('ink-paused');
    editor.contentEditable = 'false';
    $('#inkCatch').hidden = false;
    $('#inkPz').title = 'Pause drawing, to type for a moment';
    closePops();
    paintInkBar();
  }
  // typing for a moment: clicking any tool in the (faded) drawing toolbar goes back to drawing
  inkBar.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (inkState.paused && b && b.id !== 'inkX' && b.id !== 'inkPz') resumeInk();
  }, true);
  // drawing: using the (faded) bottom bar switches to typing first, so the button works on the text
  $('#tools').addEventListener('click', (e) => {
    if (inkState.on && !inkState.paused && e.target.closest('button') && !e.target.closest('#btnInk, #btnUndo, #btnRedo')) pauseInk();
  }, true);
  // the Draw button in the bottom bar also brings drawing back while it's on hold
  $('#btnInk').addEventListener('click', () => (inkState.paused ? resumeInk() : inkState.on ? exitInk() : enterInk()));
  $('#inkX').addEventListener('click', exitInk);
  // pause button (top left of the drawing toolbar): drawing on hold to type, then carry on
  $('#inkPz').addEventListener('click', () => {
    if (inkMove.dragged) return; // it was used to move the toolbar, not clicked
    if (inkState.paused) resumeInk(); else pauseInk();
  });
  // drawing: using the (faded) text toolbar switches to typing too
  $('#textPop').addEventListener('click', (e) => {
    if (inkState.on && !inkState.paused && e.target.closest('button') && !e.target.closest('#textX')) pauseInk();
  }, true);

  function scheduleInkSave() {
    inkState.dirty = true;
    clearTimeout(inkState.timer);
    inkState.timer = setTimeout(saveInk, 300);
  }
  function saveInk() {
    clearTimeout(inkState.timer);
    if (!inkState.dirty || hidden || !note) return;
    inkState.dirty = false;
    const patch = { ink: note.ink };
    // the first drawing turns word wrap off (locks the layout) so it stays lined up with what was drawn
    if (hasInk() && !note.wrapWidth) {
      note.wrapWidth = Math.round(editor.clientWidth);
      patch.wrapWidth = note.wrapWidth;
      applyLayout();
      toast('Word wrap off, so your drawing stays in place');
    }
    api.update(patch).then(gotDates).catch(() => {});
  }
  function snapshot() {
    inkState.undo.push(JSON.stringify(note.ink || null));
    if (inkState.undo.length > 50) inkState.undo.shift(); // remember the last 50 steps
    // something new was drawn or erased: the redo list no longer applies (kept aside in case nothing changes)
    inkState.redoKept = inkState.redo;
    inkState.redo = [];
  }
  function inkUndo() {
    if (!inkState.undo.length) return;
    inkState.redo.push(JSON.stringify(note.ink || null));
    note.ink = JSON.parse(inkState.undo.pop());
    renderInk();
    scheduleInkSave();
    paintInkBar();
  }
  function inkRedo() {
    if (!inkState.redo.length) return;
    inkState.undo.push(JSON.stringify(note.ink || null));
    note.ink = JSON.parse(inkState.redo.pop());
    renderInk();
    scheduleInkSave();
    paintInkBar();
  }

  $('#inkClear').addEventListener('click', () => {
    if (!hasInk()) return;
    snapshot();
    note.ink = null;
    renderInk();
    scheduleInkSave();
    paintInkBar();
    toast('Drawing removed (Undo brings it back)');
  });

  const catcher = $('#inkCatch');
  const inkPt = (e) => { const r = sheet.getBoundingClientRect(); const z = zoomNow(); return [r1((e.clientX - r.left) / z), r1((e.clientY - r.top) / z)]; };
  function shapeEnd(x1, y1, x, y, t, shift) {
    if (!shift) return [x, y];
    const dx = x - x1;
    const dy = y - y1;
    if (t === 'rect' || t === 'ellipse') {
      const d = Math.max(Math.abs(dx), Math.abs(dy));
      return [r1(x1 + Math.sign(dx || 1) * d), r1(y1 + Math.sign(dy || 1) * d)];
    }
    const step = Math.PI / 6; // 12 directions, like the hours on a clock
    const a = Math.round(Math.atan2(dy, dx) / step) * step;
    const len = Math.hypot(dx, dy);
    return [r1(x1 + Math.cos(a) * len), r1(y1 + Math.sin(a) * len)];
  }
  function redrawCurrent() {
    const fresh = strokeEl(inkState.cur);
    inkState.el.replaceWith(fresh);
    inkState.el = fresh;
  }

  // eraser: remove the top-most drawing near the pointer
  function samplePoints(st) {
    const p = st.p;
    if (st.t === 'pen' || st.t === 'hl') return p;
    const [x1, y1, x2, y2] = p;
    const out = [];
    const seg = (ax, ay, bx, by) => {
      const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / 4));
      for (let i = 0; i <= n; i++) out.push(ax + ((bx - ax) * i) / n, ay + ((by - ay) * i) / n);
    };
    if (st.t === 'line' || st.t === 'arrow') seg(x1, y1, x2, y2);
    else if (st.t === 'rect') { seg(x1, y1, x2, y1); seg(x2, y1, x2, y2); seg(x2, y2, x1, y2); seg(x1, y2, x1, y1); }
    else {
      const cx = (x1 + x2) / 2; const cy = (y1 + y2) / 2; const rx = Math.abs(x2 - x1) / 2; const ry = Math.abs(y2 - y1) / 2;
      for (let i = 0; i <= 64; i++) { const a = (i / 64) * Math.PI * 2; out.push(cx + rx * Math.cos(a), cy + ry * Math.sin(a)); }
    }
    return out;
  }
  function eraseAt([x, y]) {
    if (!hasInk()) return;
    const list = note.ink.s;
    for (let i = list.length - 1; i >= 0; i--) {
      const st = list[i];
      const reach = (st.t === 'hl' ? st.w * 2 : st.w / 2) + 6;
      const pts = samplePoints(st);
      for (let k = 0; k < pts.length; k += 2) {
        if (Math.hypot(pts[k] - x, pts[k + 1] - y) <= reach) {
          list.splice(i, 1);
          if (!list.length) note.ink = null;
          inkState.erased = true;
          renderInk();
          return;
        }
      }
    }
  }

  // ---- "Partial" eraser: erase only what's under the circle
  // A touched line or shape is traced into closely spaced points along what's actually drawn
  // (the same curves strokeEl draws, worked out here in plain maths, which is much faster than
  // asking the SVG), the points under the eraser are dropped, and each piece that's left becomes
  // its own pen (or highlighter) stroke with the same colour, thickness and layer. While dragging,
  // erasing runs at most once per screen refresh, and only strokes near the eraser are looked at.
  const STEP = 2;
  const boxCache = new WeakMap();
  function boxOf(st) {
    let b = boxCache.get(st);
    if (b) return b;
    let x1 = Infinity; let y1 = Infinity; let x2 = -Infinity; let y2 = -Infinity;
    for (let i = 0; i < st.p.length; i += 2) {
      const x = st.p[i]; const y = st.p[i + 1];
      if (x < x1) x1 = x; if (x > x2) x2 = x; if (y < y1) y1 = y; if (y > y2) y2 = y;
    }
    // an arrow's head reaches past its two points
    const extra = (st.t === 'hl' ? st.w * 2 : st.w / 2) + (st.t === 'arrow' ? 30 + st.w * 2 : 0);
    b = [x1 - extra, y1 - extra, x2 + extra, y2 + extra];
    boxCache.set(st, b);
    return b;
  }
  function tracePieces(st) {
    const out = [];
    let cur = [];
    const add = (x, y) => cur.push(r1(x), r1(y));
    const line = (ax, ay, bx, by, first) => {
      const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / STEP));
      for (let i = first ? 0 : 1; i <= n; i++) add(ax + ((bx - ax) * i) / n, ay + ((by - ay) * i) / n);
    };
    const quad = (ax, ay, cx, cy, bx, by) => {
      const n = Math.max(1, Math.ceil((Math.hypot(cx - ax, cy - ay) + Math.hypot(bx - cx, by - cy)) / STEP));
      for (let i = 1; i <= n; i++) {
        const t = i / n; const u = 1 - t;
        add(u * u * ax + 2 * u * t * cx + t * t * bx, u * u * ay + 2 * u * t * cy + t * t * by);
      }
    };
    const p = st.p;
    if (st.t === 'pen' || st.t === 'hl') {
      // same shape as smoothPath(): quadratic curves through the midpoints, then a line to the end
      if (p.length <= 4) line(p[0], p[1], p[p.length - 2], p[p.length - 1], true);
      else {
        let x = p[0]; let y = p[1];
        add(x, y);
        for (let i = 2; i < p.length - 2; i += 2) {
          const mx = r1((p[i] + p[i + 2]) / 2); const my = r1((p[i + 1] + p[i + 3]) / 2);
          quad(x, y, p[i], p[i + 1], mx, my);
          x = mx; y = my;
        }
        line(x, y, p[p.length - 2], p[p.length - 1], false);
      }
    } else {
      const [x1, y1, x2, y2] = p;
      if (st.t === 'line' || st.t === 'arrow') {
        line(x1, y1, x2, y2, true);
        if (st.t === 'arrow') {
          // the head is its own piece (same maths as strokeEl)
          out.push(cur); cur = [];
          const a = Math.atan2(y2 - y1, x2 - x1);
          const len = Math.min(18 + st.w * 1.5, Math.hypot(x2 - x1, y2 - y1) * 0.6);
          const h1 = [r1(x2 - len * Math.cos(a - 0.5)), r1(y2 - len * Math.sin(a - 0.5))];
          const h2 = [r1(x2 - len * Math.cos(a + 0.5)), r1(y2 - len * Math.sin(a + 0.5))];
          line(h1[0], h1[1], x2, y2, true);
          line(x2, y2, h2[0], h2[1], false);
        }
      } else if (st.t === 'rect') {
        // exactly the browser's square: it starts just after the top-left rounded corner (rx 4) and goes clockwise
        // (1.1.14: before, the corners were traced sharp, so dashes and dots slid along after erasing)
        const l = Math.min(x1, x2); const r = Math.max(x1, x2); const t = Math.min(y1, y2); const b = Math.max(y1, y2);
        const rr = Math.min(4, (r - l) / 2, (b - t) / 2);
        const arc = (cx, cy, a0) => {
          const n = Math.max(2, Math.ceil((Math.PI * rr) / 2 / STEP));
          for (let i = 1; i <= n; i++) { const a = a0 + (i / n) * (Math.PI / 2); add(cx + rr * Math.cos(a), cy + rr * Math.sin(a)); }
        };
        line(l + rr, t, r - rr, t, true);
        if (rr) arc(r - rr, t + rr, -Math.PI / 2);
        line(r, t + rr, r, b - rr, false);
        if (rr) arc(r - rr, b - rr, 0);
        line(r - rr, b, l + rr, b, false);
        if (rr) arc(l + rr, b - rr, Math.PI / 2);
        line(l, b - rr, l, t + rr, false);
        if (rr) arc(l + rr, t + rr, Math.PI);
      } else {
        const cx = (x1 + x2) / 2; const cy = (y1 + y2) / 2; const rx = Math.abs(x2 - x1) / 2; const ry = Math.abs(y2 - y1) / 2;
        const h = ((rx - ry) / (rx + ry || 1)) ** 2;
        const per = Math.PI * (rx + ry) * (1 + (3 * h) / (10 + Math.sqrt(4 - 3 * h)));
        const n = Math.max(8, Math.ceil(per / STEP));
        for (let i = 0; i <= n; i++) { const a = (i / n) * Math.PI * 2; add(cx + rx * Math.cos(a), cy + ry * Math.sin(a)); }
      }
    }
    out.push(cur);
    return out.filter((pc) => pc.length >= 2);
  }
  // A line that has been through the eraser before is already a row of points 2 px apart. Those
  // points are split as they are, never traced (smoothed) again, so what's left can't move.
  // (1.1.6 thinned the points out to save space, and each redraw smoothed them a bit more:
  // drawings "danced" while erasing.)
  const denseCache = new WeakMap();
  function isDense(st) {
    let d = denseCache.get(st);
    if (d !== undefined) return d;
    d = true;
    for (let i = 2; i < st.p.length; i += 2) {
      if (Math.hypot(st.p[i] - st.p[i - 2], st.p[i + 1] - st.p[i - 1]) > STEP * 1.6) { d = false; break; }
    }
    denseCache.set(st, d);
    return d;
  }
  function distToSeg(x, y, ax, ay, bx, by) {
    const dx = bx - ax;
    const dy = by - ay;
    const len2 = dx * dx + dy * dy;
    const t = len2 ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / len2)) : 0;
    return Math.hypot(x - (ax + t * dx), y - (ay + t * dy));
  }
  // shortest distance between eraser movement a→b and the line piece (cx,cy)→(dx,dy)
  function segDist(a, b, cx, cy, dx, dy) {
    const cross = (ox, oy, px, py, qx, qy) => (px - ox) * (qy - oy) - (py - oy) * (qx - ox);
    const d1 = cross(a[0], a[1], b[0], b[1], cx, cy);
    const d2 = cross(a[0], a[1], b[0], b[1], dx, dy);
    const d3 = cross(cx, cy, dx, dy, a[0], a[1]);
    const d4 = cross(cx, cy, dx, dy, b[0], b[1]);
    if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) return 0;
    return Math.min(
      distToSeg(cx, cy, a[0], a[1], b[0], b[1]), distToSeg(dx, dy, a[0], a[1], b[0], b[1]),
      distToSeg(a[0], a[1], cx, cy, dx, dy), distToSeg(b[0], b[1], cx, cy, dx, dy),
    );
  }
  // length along a row of points, at each point
  function cumLengths(pc) {
    const c = [0];
    for (let i = 2; i < pc.length; i += 2) c.push(c[c.length - 1] + Math.hypot(pc[i] - pc[i - 2], pc[i + 1] - pc[i - 1]));
    return c;
  }
  function rubOut(a, b) {
    if (!hasInk()) return;
    const R = eraserR();
    const minX = Math.min(a[0], b[0]) - R; const maxX = Math.max(a[0], b[0]) + R;
    const minY = Math.min(a[1], b[1]) - R; const maxY = Math.max(a[1], b[1]) + R;
    const out = [];
    let changedAny = false;
    for (const st of note.ink.s) {
      const box = boxOf(st);
      if (box[2] < minX || box[0] > maxX || box[3] < minY || box[1] > maxY) { out.push(st); continue; }
      const half = st.t === 'hl' ? st.w * 2 : st.w / 2;
      const reach = R + half; // the gap matches the circle, round line ends included
      const lo = [minX - half, minY - half]; const hi = [maxX + half, maxY + half];
      const hit = (x, y) => x >= lo[0] && x <= hi[0] && y >= lo[1] && y <= hi[1] && distToSeg(x, y, a[0], a[1], b[0], b[1]) <= reach;
      // pen lines are checked segment by segment before tracing; shapes are traced (cheap) first
      const pieces = st.t === 'pen' || st.t === 'hl' ? null : tracePieces(st);
      let touched = false;
      if (pieces) touched = pieces.some((pc) => { for (let i = 0; i < pc.length; i += 2) if (hit(pc[i], pc[i + 1])) return true; return false; });
      else if (st.p.length === 2) touched = hit(st.p[0], st.p[1]);
      else {
        for (let i = 0; i + 3 < st.p.length && !touched; i += 2) {
          const cx = st.p[i]; const cy = st.p[i + 1]; const dx = st.p[i + 2]; const dy = st.p[i + 3];
          if (Math.max(cx, dx) < lo[0] - R || Math.min(cx, dx) > hi[0] + R || Math.max(cy, dy) < lo[1] - R || Math.min(cy, dy) > hi[1] + R) continue;
          touched = segDist(a, b, cx, cy, dx, dy) <= reach + 1.5; // + a little for the curve between points
        }
      }
      if (!touched) { out.push(st); continue; }
      const traced = pieces || (st.p.length === 2 || isDense(st) ? [st.p] : tracePieces(st));
      const closed = st.t === 'rect' || st.t === 'ellipse';
      let any = false;
      const made = [];
      traced.forEach((pc, pi) => {
        const n = pc.length / 2;
        // dashed / dotted: each piece remembers how far along the original line it starts (`o`), so its dashes
        // stay exactly where they were. An arrow's head is always solid.
        const dashed = !!st.d && !(st.t === 'arrow' && pi === 1);
        const cum = dashed ? cumLengths(pc) : null;
        // a closed shape starts at an erased spot, so the piece that's left stays in one piece
        let start = 0;
        if (closed) for (let j = 0; j < n; j++) if (hit(pc[2 * j], pc[2 * j + 1])) { start = j; break; }
        let run = [];
        let from = 0;
        const flush = () => {
          if (run.length >= 4) {
            const piece = { t: st.t === 'hl' ? 'hl' : 'pen', c: st.c, w: st.w, l: st.l, p: run };
            if (dashed) { piece.d = st.d; piece.o = r1((st.o || 0) + cum[from]); }
            made.push(piece);
          }
          run = [];
        };
        for (let m = 0; m < n; m++) {
          const j = (start + m) % n;
          // a dashed square or circle starts its dash pattern again where the browser starts drawing it,
          // so a piece going past that spot is split there
          if (dashed && closed && j === 0 && m > 0) flush();
          if (hit(pc[2 * j], pc[2 * j + 1])) { any = true; flush(); } else { if (!run.length) from = j; run.push(pc[2 * j], pc[2 * j + 1]); }
        }
        flush();
      });
      if (!any) { out.push(st); continue; }
      out.push(...made);
      changedAny = true;
    }
    if (!changedAny) return;
    note.ink = out.length ? { s: out.slice(-4000) } : null;
    inkState.erased = true;
    paintInk(); // the sheet size is updated once the drag ends
  }
  // erase at most once per screen refresh while dragging
  let rubQ = null;
  function queueRub(from, to) {
    if (rubQ) { rubQ[1] = to; return; }
    rubQ = [from, to];
    requestAnimationFrame(flushRub);
  }
  function flushRub() {
    if (!rubQ) return;
    const [from, to] = rubQ;
    rubQ = null;
    rubOut(from, to);
  }
  function moveEraserRing(e) {
    const ring = $('#inkEraser');
    if (!inkState.on || !rubbing()) { ring.hidden = true; return; }
    const [x, y] = inkPt(e);
    const d = eraserR() * 2;
    ring.style.width = `${d}px`;
    ring.style.height = `${d}px`;
    ring.style.transform = `translate(${x - d / 2}px, ${y - d / 2}px)`;
    ring.hidden = false;
  }
  catcher.addEventListener('pointerleave', () => { if (!inkState.erasing) $('#inkEraser').hidden = true; });

  catcher.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    catcher.setPointerCapture(e.pointerId);
    const [x, y] = inkPt(e);
    if (inkState.tool === 'eraser') {
      snapshot();
      inkState.erasing = true;
      inkState.erased = false;
      inkState.last = [x, y];
      if (rubbing()) { moveEraserRing(e); rubOut([x, y], [x, y]); } else eraseAt([x, y]);
      return;
    }
    const t = inkState.tool;
    inkState.cur = { t, c: inkState.color, w: inkState.w, l: inkState.layer, ...(inkState.dash ? { d: inkState.dash } : {}), p: [x, y, x, y] };
    if (t === 'pen' || t === 'hl') inkState.cur.p = [x, y];
    inkState.el = strokeEl(inkState.cur);
    layerOf(inkState.cur).append(inkState.el);
  });
  catcher.addEventListener('pointermove', (e) => {
    moveEraserRing(e);
    if (inkState.erasing) {
      const pt = inkPt(e);
      if (rubbing()) queueRub(inkState.last || pt, pt); else eraseAt(pt);
      inkState.last = pt;
      return;
    }
    const st = inkState.cur;
    if (!st) return;
    const [x, y] = inkPt(e);
    if (st.t === 'pen' || st.t === 'hl') {
      if (e.shiftKey) st.p = [st.p[0], st.p[1], x, y]; // straight line while Shift is held
      else {
        const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [];
        for (const ev of evs.length ? evs : [e]) {
          const [cx, cy] = inkPt(ev);
          const lx = st.p[st.p.length - 2];
          const ly = st.p[st.p.length - 1];
          if (Math.hypot(cx - lx, cy - ly) >= 1.5) st.p.push(cx, cy);
        }
      }
    } else {
      const [ex, ey] = shapeEnd(st.p[0], st.p[1], x, y, st.t, e.shiftKey);
      st.p[2] = ex;
      st.p[3] = ey;
    }
    redrawCurrent();
  });
  const finishStroke = () => {
    if (inkState.erasing) {
      flushRub();
      inkState.erasing = false;
      inkState.last = null;
      if (inkState.erased) { applyLayout(); scheduleInkSave(); } else { inkState.undo.pop(); inkState.redo = inkState.redoKept || []; }
      paintInkBar();
      return;
    }
    const st = inkState.cur;
    if (!st) return;
    inkState.cur = null;
    const tiny = st.t !== 'pen' && st.t !== 'hl' && Math.hypot(st.p[2] - st.p[0], st.p[3] - st.p[1]) < 3;
    if (tiny) { inkState.el.remove(); return; }
    snapshot();
    if (!note.ink) note.ink = { s: [] };
    note.ink.s.push(st);
    elCache.set(st, inkState.el);
    applyLayout();
    scheduleInkSave();
    paintInkBar();
  };
  catcher.addEventListener('pointerup', finishStroke);
  catcher.addEventListener('pointercancel', finishStroke);

  // ================================================================ toast
  let toastTimer = null;
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.hidden = true; }, 3200);
  }

  // ================================================================ start
  (async function init() {
    note = await api.getNote();
    if (!note) return;
    if (note.settings) settings = { ...settings, ...note.settings };
    applyTheme();
    paintUnlock();
    hidden = !!note.hidden;
    editor.innerHTML = hidden ? '' : (note.html || '');
    if (find.on) { if (hidden) closeFind(false); else runFind(true); }
    decorate();
    applyLook();
    renderInk();
    updateEmpty();
    observer.observe(editor, { childList: true, subtree: true, characterData: true });
    if (hidden) {
      if (note.focusEditor) $('#unlockPw').focus();
    } else if (note.focusEditor) {
      editor.focus();
      caretAtEnd();
    }
  })();
})();
