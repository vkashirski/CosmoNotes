'use strict';
// CosmoNotes note window, part 3 of 10: pop-overs, the header, the ⋯ menu, the Add and text panels, Undo / Redo
// (src/note.js until 1.1.44; the parts load in order from note.html. How they share names: ai-context/splitting-code.md)
(() => {
  const K = window.COSMO_NOTE_KIT;
  const { V, api, $, $$, editor, body, esc, swatchStrip, changed, saveNow, titleText, gotDates, setProp, saveSel,
    restoreSel, insertNodes, runCmd } = K;
  // defined in a later part:
  const openLinkForm = K.later('openLinkForm'), insertTable = K.later('insertTable'), hideCtx = K.later('hideCtx'),
    startRecording = K.later('startRecording'), openDraw = K.later('openDraw'), relock = K.later('relock'),
    toggleLock = K.later('toggleLock'), saveInk = K.later('saveInk'), inkUndo = K.later('inkUndo'),
    inkRedo = K.later('inkRedo'), finishStroke = K.later('finishStroke'), toast = K.later('toast');
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
    if (id === '#askPop' && V.askResolve) { const r = V.askResolve; V.askResolve = null; r(false); }
    p.hidden = true;
    const po = popOuts[id];
    if (po) po.out.stop();
    syncPops();
  }
  // keepOut: a click in the note leaves a pop-up that's outside the note open (it closes with its X or Esc)
  function closePops(keepOut = false) {
    if (V.askResolve) { const r = V.askResolve; V.askResolve = null; r(false); }
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
  $('#btnPin').addEventListener('click', () => setProp({ pinned: !V.note.pinned }));
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
    if (!V.note.rolled) finishStroke();
    saveNow();
    saveInk();
    setProp({ rolled: !V.note.rolled });
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
    K.textOut.start(); // its own window, ready for dragging it out (or straight outside, where it was last time; 1.1.16)
    K.textMove.place();
    paintTextPanel();
    // 1.1.23: opening it (its window) could take the selection away for a moment: put it back
    const keep = V.savedRange && !V.savedRange.collapsed ? V.savedRange.cloneRange() : null;
    if (keep) requestAnimationFrame(() => { const s = getSelection(); if (!s.rangeCount || s.isCollapsed) { editor.focus({ preventScroll: true }); s.removeAllRanges(); s.addRange(keep); } });
  }
  function closeText() {
    $('#textPop').hidden = true;
    syncPops();
    body.classList.remove('text-open');
    K.textOut.stop();
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
    V.note.opacity = v;
    $('#opVal').textContent = opText(v);
    api.update({ opacity: v });
  });
  $('#solidHover').addEventListener('change', (e) => setProp({ solidOnHover: e.target.checked }));
  let titleTimer = null;
  $('#titleInput').addEventListener('input', (e) => {
    V.note.title = e.target.value;
    body.classList.toggle('has-title', !!V.note.title.trim());
    $('#title').textContent = titleText();
    clearTimeout(titleTimer);
    titleTimer = setTimeout(() => api.update({ title: V.note.title }).then(gotDates), 300);
  });
  $('#titleInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); closePop('#menu'); } });
  let coverTimer = null;
  $('#coverInput').addEventListener('input', (e) => {
    V.note.coverTitle = e.target.value;
    clearTimeout(coverTimer);
    coverTimer = setTimeout(() => api.update({ coverTitle: V.note.coverTitle }), 300);
  });
  $('#coverInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); closePop('#menu'); } });
  $('#miLock').addEventListener('click', toggleLock);
  $('#miDuplicate').addEventListener('click', async () => {
    closePops();
    await saveNow(); // the copy gets everything typed so far
    saveInk();
    api.duplicate();
  });
  $('#miDelete').addEventListener('click', async () => {
    closePops();
    if (V.note.lockedBy) { toast('Locked notes can’t be deleted. Remove the lock first.'); return; }
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
  const FACE = { hand: 'Caveat', round: 'Nunito', medieval: 'Augusta' };
  // Before 1.1.16 the font buttons changed the note's own font (not part of the text, so the editor's undo couldn't
  // take it back): kept here for undo/redo of those (cleared as soon as the text changes again, so undo stays in order).
  const textUndo = []; // { font } = the note's font before
  const textRedo = []; // { font } = the font an undo took away (1.1.14)
  const hasTextSel = () => !!(V.savedRange && !V.savedRange.collapsed && editor.contains(V.savedRange.commonAncestorContainer));
  function paintTextPanel() {
    if (!V.note) return;
    const sel = hasTextSel();
    const scope = `Changes: <b>${sel ? 'selected text' : 'what you type next'}</b>`;
    if ($('#tScope').innerHTML !== scope) $('#tScope').innerHTML = scope; // runs on every cursor move: only touch it when it changes
    let f = V.note.font;
    if (V.savedRange && document.activeElement === editor) {
      const v = String(document.queryCommandValue('fontName') || '').toLowerCase();
      f = v.includes('caveat') ? 'hand' : v.includes('nunito') ? 'round' : v.includes('augusta') ? 'medieval' : V.note.font;
    }
    $$('#fontSeg button').forEach((b) => b.classList.toggle('on', b.dataset.font === f));
  }
  // the cursor is exactly where it was saved (then it's left alone: putting it back would forget the typing style)
  function caretIsSaved() {
    const s = getSelection();
    if (!s.rangeCount || !V.savedRange) return false;
    const r = s.getRangeAt(0);
    return r.collapsed && r.startContainer === V.savedRange.startContainer && r.startOffset === V.savedRange.startOffset;
  }
  // "Normal" colour = the sentinel colour, then taken off again (also from text typed later in that colour)
  function cleanResetColor() {
    // 1.1.45: taking the <font> off moves the text, and the browser then drops the selection: put it back after
    const at = selOffsets();
    editor.querySelectorAll(`font[color="${RESET_COLOR}"]`).forEach((f) => {
      f.removeAttribute('color');
      if (!f.attributes.length) f.replaceWith(...f.childNodes);
    });
    editor.querySelectorAll('[style*="color"]').forEach((el) => {
      if (/rgb\(1, 2, 3\)/.test(el.style.color)) el.style.color = '';
      if (!el.getAttribute('style')) el.removeAttribute('style');
    });
    editor.querySelectorAll('[style=""]').forEach((el) => el.removeAttribute('style'));
    if (at) selectOffsets(at);
  }
  // where the selection is, counted in letters of the note's text (survives text being moved to other nodes)
  function selOffsets() {
    const s = getSelection();
    if (!s.rangeCount || s.isCollapsed) return null;
    const r = s.getRangeAt(0);
    if (!editor.contains(r.commonAncestorContainer)) return null;
    const upTo = (node, off) => { const x = document.createRange(); x.setStart(editor, 0); x.setEnd(node, off); return x.toString().length; };
    return [upTo(r.startContainer, r.startOffset), upTo(r.endContainer, r.endOffset)];
  }
  function selectOffsets([a, b]) {
    const tw = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
    const r = document.createRange();
    let pos = 0; let started = false;
    for (let n = tw.nextNode(); n; n = tw.nextNode()) {
      const end = pos + n.data.length;
      if (!started && a < end) { r.setStart(n, a - pos); started = true; }
      if (started && b <= end) { r.setEnd(n, b - pos); break; }
      pos = end;
    }
    if (!started || r.collapsed) return;
    const s = getSelection();
    s.removeAllRanges();
    s.addRange(r);
    V.savedRange = r.cloneRange();
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
    document.execCommand('fontName', false, FACE[V.note.font] || 'Caveat');
  }));
  editor.addEventListener('input', (e) => { if (!/^history/.test(e.inputType || '')) { textUndo.length = 0; textRedo.length = 0; } });
  // ---- the one Undo button (bottom bar, left of Draw): drawing while drawing, otherwise the text
  function undoText() {
    if (textUndo.length) { textRedo.push({ font: V.note.font }); setProp({ font: textUndo.pop().font }); paintTextPanel(); return; }
    editor.focus({ preventScroll: true });
    document.execCommand('undo');
    // undo selects what it brought back (for a whole-note change: everything); keep just the cursor
    const sel = getSelection();
    if (sel.rangeCount && !sel.isCollapsed) sel.collapseToEnd();
    changed();
    if (!$('#textPop').hidden) paintTextPanel();
  }
  function undoAny() {
    if (K.inkState.on && !K.inkState.paused) inkUndo(); else undoText();
  }
  // ---- Redo (1.1.14, right after Undo): takes back what Undo did, for drawing and for text
  function redoText() {
    if (textRedo.length) { textUndo.push({ font: V.note.font }); setProp({ font: textRedo.pop().font }); paintTextPanel(); return; }
    editor.focus({ preventScroll: true });
    document.execCommand('redo');
    const sel = getSelection();
    if (sel.rangeCount && !sel.isCollapsed) sel.collapseToEnd();
    changed();
    if (!$('#textPop').hidden) paintTextPanel();
  }
  function redoAny() {
    if (K.inkState.on && !K.inkState.paused) inkRedo(); else redoText();
  }
  function paintUndo() {
    const drawing = K.inkState.on && !K.inkState.paused;
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

  Object.assign(K, { popOuts, closePop, closePops, openPop, closeText, textUndo, textRedo, paintTextPanel, undoText,
    redoText, paintUndo });
})();
