'use strict';
// CosmoNotes note window, part 2 of 16: the Effects pop-up, spelling, selection helpers, formatting
// (src/note.js until 1.1.44; the parts load in order from note.html. How they share names: ai-context/splitting-code.md)
(() => {
  const K = window.COSMO_NOTE_KIT;
  const { V, api, $, $$, editor, body, changed, gotDates, applyLook, applyEvening, applyPanic, applyClickThrough, FX, fxName, applyFx } = K;
  // defined in a later part:
  const closePop = K.later('closePop'), domStep = K.later('domStep'), openPop = K.later('openPop'), paintTextPanel = K.later('paintTextPanel'),
    placeHandle = K.later('placeHandle'), paintUnlock = K.later('paintUnlock'), toast = K.later('toast'),
    applyChecks = K.later('applyChecks');
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
    if (V.note) { applySpell(); applyFx(); applyChecks(); applyEvening(); applyPanic(); applyClickThrough(); }
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
  // For photos, drawings and voice notes: put the elements in exactly as written (the browser's own insert command
  // breaks voice notes: it unwraps them or moves them onto a line of their own). That isn't the editor's own change, so
  // it is one Undo step of ours (domStep, panels part; before 1.3.31, Undo couldn't take a pasted photo back).
  // Selected words are deleted by the editor first: its own step.
  function insertNodes(html) {
    restoreSel();
    const s = getSelection();
    if (!s.rangeCount) caretAtEnd();
    if (!s.isCollapsed) document.execCommand('delete');
    const last = domStep(() => {
      const r = s.getRangeAt(0);
      const frag = r.createContextualFragment(html);
      const end = frag.lastChild;
      if (!end) return null;
      r.insertNode(frag);
      const after = document.createRange();
      after.setStartAfter(end);
      after.collapse(true);
      s.removeAllRanges();
      s.addRange(after);
      V.savedRange = after.cloneRange();
      return end;
    });
    if (!last) return;
    (last.nodeType === 1 ? last : last.parentElement)?.scrollIntoView({ block: 'nearest' });
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

  // ================================================================ list lines (1.4.17)
  // Bullets, Checklist, Tab and Shift+Tab change only the lines the cursor is on or that are selected, never a whole
  // list. They move the very same line elements (a line keeps its tick, its words' look, and the editor's earlier Undo
  // steps still fit), each as one Undo step (domStep). Before 1.4.17, Bullets in a checklist made the whole list (every
  // level) bullets and took every tick off, outside Undo, and Checklist then made the whole list a checklist again with
  // empty boxes (the owner lost 45 ticks that way). Tab / Shift+Tab were the editor's indent / outdent, which build a
  // new line: a ticked line came back unticked.
  // A line has a box when any list around it is a ul.checklist (note-text.css `ul.checklist li`), so Bullets works on
  // the lines of the outermost checklist: a line there and everything nested in it (checkLine).
  const isListEl = (x) => !!x && x.nodeType === 1 && (x.nodeName === 'UL' || x.nodeName === 'OL');
  const shows = (t) => /[^\s\u200b]/.test(t);
  function checkRoot(el) {
    let top = null;
    for (let x = el.parentElement; x && x !== editor; x = x.parentElement) if (x.matches('ul.checklist')) top = x;
    return top;
  }
  function checkLine(li) {
    const root = checkRoot(li);
    let x = li;
    while (x.parentElement !== root) x = x.parentElement;
    return x;
  }
  // the part of node n inside range r
  function partIn(n, r) {
    const p = document.createRange();
    p.selectNode(n);
    if (p.compareBoundaryPoints(Range.START_TO_START, r) < 0) p.setStart(r.startContainer, r.startOffset);
    if (p.compareBoundaryPoints(Range.END_TO_END, r) > 0) p.setEnd(r.endContainer, r.endOffset);
    return p;
  }
  // the range holds some of the line's own words or pictures (not only of a list nested in it, and not just its edge)
  function ownIn(li, r) {
    for (const c of li.childNodes) {
      if (isListEl(c) || !r.intersectsNode(c)) continue;
      const f = partIn(c, r).cloneContents();
      if (shows(f.textContent) || f.querySelector('img,br,hr,table,.voice')) return true;
    }
    return false;
  }
  // the lines the cursor is on / the selection covers, and whether it also covers words outside any list
  function selLines() {
    const s = getSelection();
    if (!s.rangeCount || !editor.contains(s.getRangeAt(0).commonAncestorContainer)) return { lines: [], loose: false };
    const r = s.getRangeAt(0);
    const one = closestIn(r.startContainer, 'li');
    if (r.collapsed) return { lines: one ? [one] : [], loose: !one };
    let lines = [...editor.querySelectorAll('li')].filter((li) => ownIn(li, r));
    if (!lines.length && one) lines = [one];
    let loose = false;
    const top = r.commonAncestorContainer.nodeType === 1 ? r.commonAncestorContainer : r.commonAncestorContainer.parentNode;
    const w = document.createTreeWalker(top, NodeFilter.SHOW_TEXT);
    for (let t = w.nextNode(); t && !loose; t = w.nextNode()) if (r.intersectsNode(t) && !closestIn(t, 'li') && shows(partIn(t, r).toString())) loose = true;
    return { lines, loose };
  }
  // the lines with nothing selected above them (a line takes the lines nested in it along)
  const outerOnes = (lines) => lines.filter((li) => !lines.some((o) => o !== li && o.contains(li)));
  // the cursor / selection stays on the same words (the elements moved, so the browser's own range was reset)
  function keepSel(fn) {
    const s = getSelection();
    const r = s.rangeCount ? s.getRangeAt(0) : null;
    const at = r && [r.startContainer, r.startOffset, r.endContainer, r.endOffset];
    const out = fn();
    if (at && editor.contains(at[0]) && editor.contains(at[2])) {
      try {
        const n = document.createRange();
        n.setStart(at[0], at[1]);
        n.setEnd(at[2], at[3]);
        s.removeAllRanges();
        s.addRange(n);
        V.savedRange = n.cloneRange();
      } catch { /* the place is gone */ }
    }
    return out;
  }
  const plainList = (l) => { l.classList.remove('checklist'); if (!l.classList.length) l.removeAttribute('class'); };
  // `units` (children of `list`) go into lists of their own, changed by make(); the other lines stay in lists as `list`
  // was. All of them changed: `list` itself is changed.
  function splitOff(list, units, make) {
    const runs = [];
    let cur = null;
    for (const c of [...list.childNodes]) {
      const on = units.has(c) || (c.nodeName !== 'LI' && !!cur && cur.on); // spaces and old stray lists go with the line before
      if (!cur || cur.on !== on) { cur = { on, nodes: [] }; runs.push(cur); }
      cur.nodes.push(c);
    }
    if (runs.every((x) => x.on)) { make(list); return; }
    const was = list.cloneNode(false);
    let at = list;
    runs.forEach((run, i) => {
      if (i === 0) { if (run.on) make(list); return; }
      const l = was.cloneNode(false);
      if (run.on) make(l);
      at.after(l);
      l.append(...run.nodes);
      at = l;
    });
  }
  // the lines (and what is nested in them) become checklist lines (toCheck) or bullets (their ticks go: Undo brings them back)
  function listStep(lines, toCheck) {
    keepSel(() => domStep(() => {
      const byList = new Map();
      for (const li of lines) {
        const unit = toCheck ? li : checkLine(li);
        if (!byList.has(unit.parentElement)) byList.set(unit.parentElement, new Set());
        byList.get(unit.parentElement).add(unit);
      }
      for (const [list, units] of byList) {
        if (!toCheck) {
          for (const u of units) {
            for (const li of [u, ...u.querySelectorAll('li')]) if (li.nodeName === 'LI' && li.classList.contains('done')) { li.classList.remove('done'); if (!li.classList.length) li.removeAttribute('class'); }
            for (const l of [u, ...u.querySelectorAll('ul.checklist')]) if (l.nodeName === 'UL' && l.classList.contains('checklist')) plainList(l);
          }
        }
        splitOff(list, units, toCheck ? (l) => l.classList.add('checklist') : plainList);
      }
    }));
  }
  function toggleChecklist() {
    const { lines, loose } = selLines();
    const plain = lines.filter((li) => !checkRoot(li));
    // every line has a box: they leave the list (the editor's own command, so its Undo)
    if (lines.length && !plain.length && !loose) { document.execCommand('insertUnorderedList'); return; }
    if (plain.length && !loose && plain.every((li) => li.parentElement.nodeName === 'UL')) { listStep(plain, true); return; }
    // words outside any list, or numbered lines: the editor makes them bullets first; a list of only these lines then
    // becomes a checklist within the editor's own step, else (it joined a list next to it) the lines become checklist lines
    document.execCommand('insertUnorderedList');
    const now = selLines().lines.filter((li) => !checkRoot(li) && li.parentElement.nodeName === 'UL');
    const lists = new Set(now.map((li) => li.parentElement));
    if ([...lists].every((l) => [...l.children].every((c) => c.nodeName !== 'LI' || now.includes(c)))) lists.forEach((l) => l.classList.add('checklist'));
    else listStep(now, true);
  }
  function toggleBullets() {
    const boxed = selLines().lines.filter((li) => checkRoot(li));
    if (boxed.length) listStep(boxed, false);
    else document.execCommand('insertUnorderedList');
  }
  // Tab: each line goes one level in, into the list nested in the line above it (a new one if it has none). The first
  // line of a list has no line above to go into: it stays.
  function indentLines(lines) {
    const todo = outerOnes(lines).filter((li) => { const p = li.previousElementSibling; return !!p && (p.nodeName === 'LI' || isListEl(p)); });
    if (!todo.length) return;
    keepSel(() => domStep(() => {
      for (const li of todo) {
        const prev = li.previousElementSibling;
        let into = isListEl(prev) ? prev : isListEl(prev.lastElementChild) ? prev.lastElementChild : null;
        if (!into) { into = document.createElement(li.parentElement.nodeName); prev.append(into); }
        into.append(li);
      }
    }));
  }
  const nested = (li) => { const up = li.parentElement.parentElement; return !!up && up !== editor && (up.nodeName === 'LI' || isListEl(up)); };
  // Shift+Tab: each line goes one level out, right after the line it was nested in; the lines after it at its level
  // stay below it, now nested in it. → false when a line is at the top level: the caller lets the editor take those out
  // of the list (outdent), as before.
  function outdentLines(lines) {
    const todo = outerOnes(lines);
    if (!todo.length || !todo.every(nested)) return false;
    keepSel(() => domStep(() => {
      for (const li of [...todo].reverse()) { // from the last: the lines after one are already where they go
        const list = li.parentElement;
        const after = list.parentElement.nodeName === 'LI' ? list.parentElement : list; // (old notes: a list right in a list)
        const rest = [];
        for (let x = li.nextSibling; x; x = x.nextSibling) rest.push(x);
        if (rest.some((x) => x.nodeType === 1)) {
          let into = isListEl(li.lastElementChild) && li.lastElementChild.nodeName === list.nodeName ? li.lastElementChild : null;
          if (!into) { into = list.cloneNode(false); li.append(into); }
          into.append(...rest);
        }
        after.after(li);
        if (!list.children.length && !shows(list.textContent)) list.remove();
      }
    }));
    return true;
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
    caretAtEnd, restoreSel, insertHTML, insertNodes, runCmd, selLines, indentLines, outdentLines });
})();
