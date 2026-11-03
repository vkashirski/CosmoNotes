'use strict';
// CosmoNotes note window, part 7 of 10: locking, password or PIN, the "are you sure?" pop-up, word wrap, zoom
// (src/note.js until 1.1.44; the parts load in order from note.html. How they share names: ai-context/splitting-code.md)
(() => {
  const K = window.COSMO_NOTE_KIT;
  const { V, api, $, $$, editor, body, saveNow, observer, updateEmpty, applyLook, setProp, caretAtEnd, closePop,
    closePops, openPop, closeText, decorate, stopPlay, rec, stopRecording, closeDraw, handle, placeHandle } = K;
  // defined in a later part:
  const renderInk = K.later('renderInk'), inkBounds = K.later('inkBounds'), exitInk = K.later('exitInk'),
    toast = K.later('toast');
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
    V.hidden = false;
    V.note = { ...V.note, ...n, hidden: false };
    editor.innerHTML = V.note.html || '';
    decorate();
    observer.observe(editor, { childList: true, subtree: true, characterData: true });
    V.dirty = false;
    applyLook();
    renderInk();
    updateEmpty();
    if (fly) { body.append(fly); setTimeout(() => fly.remove(), 800); }
    playLockAnim('unlock');
  }
  function hideContent() {
    const ghost = V.hidden ? null : lockGhost();
    if (K.inkState.on) exitInk();
    K.inkState.undo = []; // a locked note keeps no copies of its drawing in the undo (or redo) list
    K.inkState.redo = [];
    K.inkState.redoKept = [];
    K.inkState.dirty = false;
    clearTimeout(K.inkState.timer);
    V.note.ink = null;
    renderInk();
    stopPlay();
    if (!$('#draw').hidden) closeDraw();
    if (rec.mr) stopRecording(false);
    observer.disconnect();
    V.dirty = false;
    clearTimeout(V.saveTimer);
    V.hidden = true;
    editor.innerHTML = '';
    V.note.html = '';
    V.note.title = ''; // 1.1.30: the title is hidden (and encrypted) while locked too
    if (document.activeElement !== $('#titleInput')) $('#titleInput').value = '';
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
  api.onLockNow(() => { if (!V.hidden) relock(); });
  // Colour/font/lock changed from the notes list.
  api.onLook((v) => {
    if (!V.note || !v) return;
    for (const k of ['color', 'font', 'size', 'title', 'coverTitle', 'locked', 'lockedBy', 'pinned', 'opacity', 'rolled', 'fx', 'fxPaused', 'fxPlay']) if (k in v) V.note[k] = v[k];
    if (v.hidden && !V.hidden) { hideContent(); return; }
    // the lock was removed from the notes list while this window still asked for the password/PIN:
    // show the note straight away (1.1.47: or it was unlocked there until CosmoNotes restarts; its lock stays)
    if (!v.hidden && V.hidden) {
      $('#unlockPw').value = '';
      $('#unlockErr').textContent = '';
      showContent(v);
      toast(v.lockedBy ? 'Unlocked' : 'Lock removed');
      return;
    }
    applyLook();
  });
  async function toggleLock() {
    closePops();
    if (V.note.locked) {
      const n = await api.setLocked(false);
      if (n && !n.error) { V.note.locked = false; V.note.lockedBy = n.lockedBy; applyLook(); toast('Lock removed'); }
      return;
    }
    if (V.note.lockedBy === 'group') return;
    if (!V.settings.hasPassword) { openPwPop(); return; }
    await lockNow();
  }
  async function lockNow() {
    saveNow();
    const n = await api.setLocked(true);
    if (!n || n.error) { toast('Could not lock this note'); return; }
    V.note.locked = true;
    V.note.lockedBy = 'note';
    hideContent();
    toast('Note locked 🔒');
  }
  // ---- password or PIN. A PIN is digits only, and opens the note as soon as all its digits are typed.
  const isPinLock = () => V.settings.lockKind === 'pin';
  const digitsOnly = (el) => { const v = el.value.replace(/\D/g, ''); if (v !== el.value) el.value = v; };
  function paintUnlock() {
    const pin = isPinLock();
    const inp = $('#unlockPw');
    inp.placeholder = pin ? 'PIN' : 'Password';
    inp.inputMode = pin ? 'numeric' : 'text';
    inp.maxLength = pin ? V.settings.lockLen || 12 : 200;
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
    V.settings.hasPassword = true;
    V.settings.lockKind = pwKind;
    V.settings.lockLen = pwKind === 'pin' ? a.length : 0;
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
    if (V.settings.lockLen && e.target.value.length === V.settings.lockLen && !unlocking) $('#unlockForm').requestSubmit();
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
  V.askResolve = null;
  function ask(title, text, okLabel = 'OK') {
    openPop('#askPop');
    $('#askTitle').textContent = title;
    $('#askText').textContent = text;
    $('#askYes').textContent = okLabel;
    return new Promise((resolve) => { V.askResolve = resolve; });
  }
  const answerAsk = (v) => { const r = V.askResolve; V.askResolve = null; closePop('#askPop'); if (r) r(v); };
  $('#askYes').addEventListener('click', () => answerAsk(true));
  $('#askNo').addEventListener('click', () => answerAsk(false));

  // ================================================================ word wrap (text layout lock)
  // Word wrap on = normal: text wraps with the note. Word wrap off (note.wrapWidth set) = no limit (1.1.45): a line
  // only ends where you pressed Enter, however wide or narrow the note is (#sheet.nowrap), and a long line
  // scrolls sideways. Pictures still fit the note; with a drawing they keep the width they had (wrapWidth), so the
  // drawing stays on them (note.nowrap marks that). An older note with a drawing and no note.nowrap (drawing on a
  // note with word wrap on turns it off like that too) keeps its text at the width wrapWidth (#sheet.fixed), so the
  // drawing stays on the words it marked.
  const sheet = $('#sheet');

  // ---- zoom (1.1.13): Ctrl + mouse wheel makes the writing bigger or smaller (text, pictures and drawing together),
  // Ctrl + 0 goes back to 100 %, Ctrl + = / Ctrl + - work too. Each note remembers its own zoom (note.zoom, 50–300 %).
  // It's CSS `zoom` on #sheet: sizes inside the note stay in its own pixels, but mouse positions and
  // getBoundingClientRect are screen pixels, so code that turns one into the other divides by zoomNow()
  // (inkPt, picture resizing, --viewW, contentRight).
  const zoomNow = () => (V.note && V.note.zoom > 0 ? V.note.zoom : 1);
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
    if (!V.note || V.hidden || z === zoomNow()) return;
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
  const hasInk = () => !!(V.note && V.note.ink && V.note.ink.s && V.note.ink.s.length);
  // How wide the visible writing area is. With the layout locked, pictures without "Keep size"
  // still shrink to this (note.css: --viewW), so a narrower note doesn't cut them off.
  const scroller = $('#scroller');
  function updateViewWidth() {
    const cs = getComputedStyle(scroller);
    const w = (scroller.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)) / zoomNow();
    sheet.style.setProperty('--viewW', `${Math.max(0, Math.floor(w))}px`);
  }
  new ResizeObserver(() => { updateViewWidth(); placeHandle(); fitSideways(); }).observe(scroller);
  // the visible width of the writing area, in the note's own pixels
  const viewWidth = () => Math.max(80, Math.floor((scroller.clientWidth - (parseFloat(getComputedStyle(scroller).paddingLeft) || 0)
    - (parseFloat(getComputedStyle(scroller).paddingRight) || 0)) / zoomNow()));
  // word wrap off with no limit (see above); otherwise off = the text keeps the width wrapWidth
  const noLimit = () => !!(V.note && V.note.wrapWidth && (V.note.nowrap || !hasInk()));
  // how wide "full width" is for pictures (Small / Medium, Keep size, resizing)
  const textWidth = () => (noLimit() ? (hasInk() ? V.note.wrapWidth : viewWidth()) : editor.clientWidth);
  // the first drawing on a note with word wrap off: pictures keep the width they have now, so the drawing stays on them
  function keepForInk() {
    if (!V.note || hasInk() || !V.note.wrapWidth || V.hidden) return null;
    const w = viewWidth();
    if (V.note.nowrap && V.note.wrapWidth === w) return null;
    V.note.nowrap = true;
    V.note.wrapWidth = w;
    return { nowrap: true, wrapWidth: V.note.wrapWidth };
  }
  function applyLayout() {
    if (!V.note) return;
    const ink = hasInk();
    const free = noLimit();
    const fixed = !!V.note.wrapWidth && !free;
    sheet.style.width = fixed ? `${V.note.wrapWidth}px` : free ? 'max-content' : '';
    sheet.classList.toggle('fixed', fixed);
    sheet.classList.toggle('nowrap', free);
    sheet.classList.toggle('inked', ink);
    updateViewWidth();
    const picW = free ? (ink ? `${V.note.wrapWidth}px` : 'var(--viewW)') : '';
    if (picW) sheet.style.setProperty('--picW', picW); else sheet.style.removeProperty('--picW');
    const b = inkBounds();
    const inkW = b ? `${Math.ceil(b.x2 + 6)}px` : '';
    sheet.style.minWidth = picW && inkW ? `max(${picW}, ${inkW})` : (picW || inkW);
    sheet.style.minHeight = b ? `max(100%, ${Math.ceil(b.y2 + 6)}px)` : '';
    const w = $('#btnWrap');
    w.classList.toggle('on', !V.note.wrapWidth);
    w.title = V.note.wrapWidth ? (free ? 'Word wrap: off (no limit)' : 'Word wrap: off (lines keep their width)') : 'Word wrap: on';
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
      const needed = !!V.note && !V.hidden && contentRight() > room + 1;
      scroller.style.overflowX = needed ? '' : 'hidden';
      if (!needed) scroller.scrollLeft = 0;
    });
  }
  new ResizeObserver(fitSideways).observe(editor);
  editor.addEventListener('load', fitSideways, true); // a picture finished loading (load doesn't bubble)
  if (document.fonts) document.fonts.ready.then(fitSideways);
  async function toggleWrap() {
    if (V.note.wrapWidth) {
      if (hasInk() && !(await ask('Turn word wrap on?', 'Text may move away from your drawing.', 'Turn on'))) return;
      setProp({ wrapWidth: null, nowrap: false });
      toast('Word wrap on');
    } else {
      if (hasInk() && !(await ask('Turn word wrap off?', 'Text may move away from your drawing.', 'Turn off'))) return;
      setProp({ wrapWidth: viewWidth(), nowrap: true });
      toast('Word wrap off');
    }
  }
  $('#btnWrap').addEventListener('mousedown', (e) => e.preventDefault());
  $('#btnWrap').addEventListener('click', toggleWrap);

  // resizing a picture under a drawing can move things away from it: warn once per window
  let resizeOk = false;
  const needsResizeWarning = () => hasInk() && !resizeOk;
  async function resizeWarning(then) {
    const ok = await ask('Resize this picture?', 'This note has a drawing. Resizing a picture can move things away from it.', 'Resize anyway');
    if (!ok) return;
    resizeOk = true;
    if (then) then(); else toast('OK, drag the corner again to resize');
  }

  Object.assign(K, { relock, toggleLock, paintUnlock, sheet, zoomNow, applyZoom, setZoom, hasInk, applyLayout,
    fitSideways, needsResizeWarning, resizeWarning, textWidth, keepForInk });
})();
