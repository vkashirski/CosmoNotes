'use strict';
// CosmoNotes note window, part 2 of 11: the Effects pop-up, spelling, selection helpers, formatting
// (src/note.js until 1.1.44; the parts load in order from note.html. How they share names: ai-context/splitting-code.md)
(() => {
  const K = window.COSMO_NOTE_KIT;
  const { V, api, $, $$, editor, body, changed, gotDates, applyLook, FX, fxName, applyFx } = K;
  // defined in a later part:
  const closePop = K.later('closePop'), openPop = K.later('openPop'), paintTextPanel = K.later('paintTextPanel'),
    placeHandle = K.later('placeHandle'), paintUnlock = K.later('paintUnlock'), toast = K.later('toast');
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
      b.addEventListener('click', () => setProp({ fx: { ...(V.note.fx || { e: null, f: null }), [key]: v } }));
      box.append(b);
    };
    item(null, 'Same as all', FX.ICONS.all); // 1.1.22: shorter, so every choice is the same height (full name in its tooltip)
    item('none', 'None', FX.ICONS.none);
    for (const id of ids) item(id, fxName(kind, id), FX.ICONS[kind][id]);
  }
  if (FX) { fxList($('#fxEffects'), 'effect'); fxList($('#fxFollowers'), 'follower'); }
  for (const [id, key] of [['#fxEAmt', 'ea'], ['#fxFAmt', 'fa']]) {
    $$(`${id} button`).forEach((b) => b.addEventListener('click', () => setProp({ fx: { ...(V.note.fx || { e: null, f: null }), [key]: b.dataset.a } })));
  }
  // 1.1.17: opacity of this note's background / mouse follower (eo / fo). Dragging shows it at once; it's saved
  // when the slider is let go (and 300 ms after it stops moving, in case the release isn't seen)
  let fxOpTimer = null;
  const saveFxOp = () => { clearTimeout(fxOpTimer); fxOpTimer = null; setProp({ fx: { ...(V.note.fx || { e: null, f: null }) } }); };
  for (const [id, key] of [['#fxEOp', 'eo'], ['#fxFOp', 'fo']]) {
    const range = $(`${id} input`);
    range.addEventListener('input', () => {
      V.note.fx = { ...(V.note.fx || { e: null, f: null }), [key]: Number(range.value) / 100 };
      $(`${id} em`).textContent = `${range.value}%`;
      applyFx();
      clearTimeout(fxOpTimer); fxOpTimer = setTimeout(saveFxOp, 300);
    });
    range.addEventListener('change', saveFxOp);
  }
  function paintFxPop() {
    const mine = V.note.fx || { e: null, f: null };
    for (const [box, kind, key, all] of [[$('#fxEffects'), 'effect', 'e', V.settings.fxEffect], [$('#fxFollowers'), 'follower', 'f', V.settings.fxFollower]]) {
      for (const b of box.children) {
        const v = b.dataset.v === '' ? null : b.dataset.v;
        const on = (mine[key] ?? null) === v;
        b.classList.toggle('on', on);
        b.setAttribute('aria-pressed', String(on));
        if (v === null) b.querySelector('.allname').textContent = fxName(kind, all || 'none');
      }
    }
    // how much: what this note shows now (its own, or all notes' amount)
    const r = FX.resolve(V.note.fx, V.settings, V.note.fxPaused, V.note.fxPlay);
    // 1.1.22: with "None", frequency and opacity are greyed out (switched off), not hidden
    for (const [id, cur, kindOn] of [['#fxEAmt', r.effectAmount, r.effect !== 'none'], ['#fxFAmt', r.followerAmount, r.follower !== 'none']]) {
      $(id).classList.toggle('off', !kindOn);
      $$(`${id} button`).forEach((b) => { b.classList.toggle('on', b.dataset.a === cur); b.disabled = !kindOn; });
    }
    for (const [id, op, kindOn] of [['#fxEOp', r.effectOpacity, r.effect !== 'none'], ['#fxFOp', r.followerOpacity, r.follower !== 'none']]) {
      const pct = Math.round(op * 100);
      $(id).classList.toggle('off', !kindOn);
      $(`${id} input`).value = String(pct);
      $(`${id} input`).disabled = !kindOn || !!V.settings.fxForceAll; // Settings uses the same on every note: its opacity shows
      $(`${id} em`).textContent = `${pct}%`;
    }
    $('#fxForce').hidden = !V.settings.fxForceAll;
    // 1.1.21: the mouse plays with the background (only when there is one)
    $('#fxInteractRow').classList.toggle('off', r.effect === 'none');
    $('#fxInteract').checked = r.interact;
    $('#fxInteract').disabled = r.effect === 'none' || !!V.settings.fxForceAll;
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
  $('#fxInteract').addEventListener('change', (e) => setProp({ fx: { ...(V.note.fx || { e: null, f: null }), mi: e.target.checked } }));
  // 1.1.16: this note's own pause wins over "pause all": playing it while all effects are paused sets fxPlay
  // (it keeps playing until it's paused here again); pausing it sets fxPaused
  function setFxPlaying(play) {
    if (play) setProp({ fxPaused: false, fxPlay: !!V.settings.fxPaused });
    else setProp(V.settings.fxPaused ? { fxPlay: false } : { fxPaused: true, fxPlay: false });
  }

  function setProp(patch) {
    Object.assign(V.note, patch);
    applyLook();
    return api.update(patch).then((n) => { gotDates(n); return n; });
  }

  // ================================================================ spelling
  // Spelling is ignored unless turned on (for all notes in Settings, or just
  // this note with the button). Cyrillic words are never underlined.
  function spellOn() {
    return V.note && V.note.spell !== null && V.note.spell !== undefined ? !!V.note.spell : !!V.settings.spellCheck;
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
    setProp({ spell: next === !!V.settings.spellCheck ? null : next });
    toast(next ? 'Checking spelling in this note' : 'Ignoring spelling in this note');
  });
  // 1.1.16: pop-ups and toolbars in the app's colours (Settings → General → colours of the notes list)
  function applyTheme() { body.dataset.apptheme = V.settings.appTheme || 'cream'; }
  api.onSettings((s) => {
    V.settings = { ...V.settings, ...s };
    applyTheme();
    if (V.note) { applySpell(); applyFx(); }
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
    if (s.rangeCount && editor.contains(s.getRangeAt(0).commonAncestorContainer)) V.savedRange = s.getRangeAt(0).cloneRange();
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
    if (V.savedRange && editor.contains(V.savedRange.startContainer)) {
      s.removeAllRanges();
      s.addRange(V.savedRange);
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
      V.savedRange = after.cloneRange();
      (last.nodeType === 1 ? last : last.parentElement)?.scrollIntoView({ block: 'nearest' });
    }
    changed();
  }

  document.addEventListener('selectionchange', () => {
    saveSel();
    if (!$('#textPop').hidden) paintTextPanel();
    updateToolState();
    if (V.resizing) return;
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

  Object.assign(K, { paintFxPop, setFxPlaying, setProp, applySpell, applyTheme, anchor, closestIn, saveSel,
    caretAtEnd, restoreSel, insertHTML, insertNodes, runCmd });
})();
