'use strict';
// CosmoNotes note window, part 3 of 12: pop-overs, the header, the ⋯ menu, the Add and text panels, Undo / Redo
// (src/note.js until 1.1.44; the parts load in order from note.html. How they share names: ai-context/splitting-code.md)
(() => {
  const K = window.COSMO_NOTE_KIT;
  const { V, api, $, $$, editor, body, esc, swatchStrip, changed, saveNow, collect, titleText, gotDates, setProp, saveSel,
    restoreSel, insertNodes, runCmd } = K;
  // defined in a later part:
  const openLinkForm = K.later('openLinkForm'), insertTable = K.later('insertTable'), hideCtx = K.later('hideCtx'),
    startRecording = K.later('startRecording'), openDraw = K.later('openDraw'), relock = K.later('relock'),
    toggleLock = K.later('toggleLock'), saveInk = K.later('saveInk'), inkUndo = K.later('inkUndo'),
    inkRedo = K.later('inkRedo'), finishStroke = K.later('finishStroke'), toast = K.later('toast'),
    speakToText = K.later('speakToText');
  // ================================================================ popovers
  // 1.1.16: the ⋯ menu and the Effects pop-up can be dragged (by their grip) and out of the note, like the
  // toolbars: id → { out: barOut(…), move: movable(…) } (filled in further down, next to the toolbars)
  const popOuts = {};
  // 1.1.20 (the owner's wish): the editing menus (⋯, Effects, Add) no longer close each other: opening one leaves
  // the others open, the newest on top (clicking one brings it to the front). Each closes with its own button (or X),
  // and the "close all" button in the top bar (shown when two or more are open, text toolbar included) or Esc
  // closes them all. The small dialogs (password, link, questions) still replace each other.
  const EDIT_POPS = ['#menu', '#fxPop', '#ckPop', '#insert']; // 1.3.21: #ckPop, this note's checklists
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
    // 1.3.22: not for "close all" either: this closed the menus inside the note first, the button then hid (fewer than
    // two left) and its click never came, so a menu dragged out of the note stayed open
    if (!e.target.closest('.pop, #btnMenu, #btnInsert, #btnText, #btnCloseAll')) closePops(true);
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
  $('#btnPin').addEventListener('click', () => setProp(V.note.pinned ? { pinned: false, clickThrough: false } : { pinned: true }));
  // 1.3.34: click-through (base.js applyClickThrough, main/note-state.js). Turning it on pins the note. While it is on, the
  // window ignores clicks, but Windows still sends the mouse's moves: on this button they wake the window (ctAwake) until
  // the mouse leaves it, so this button can be clicked and nothing else can.
  const wakeCt = (on) => {
    on = on && body.classList.contains('ct');
    if (on === V.ctAwake) return;
    V.ctAwake = on;
    api.ctAwake(on);
  };
  $('#btnCt').addEventListener('click', () => {
    const on = !V.note.clickThrough;
    if (on) { closePops(); finishStroke(); saveNow(); saveInk(); }
    setProp(on ? { clickThrough: true, pinned: true } : { clickThrough: false });
    wakeCt(true); // on: the mouse is still on the button (sent after the change, so main wakes it after starting it)
  });
  $('#btnCt').addEventListener('pointermove', () => wakeCt(true));
  $('#btnCt').addEventListener('pointerleave', () => wakeCt(false));
  document.documentElement.addEventListener('mouseleave', () => wakeCt(false));
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
  // 1.3.27: the panic button (main/panic.js closes this window too, unless this note stays open: it saves first anyway)
  $('#btnPanic').addEventListener('click', () => { closePops(); saveNow(); saveInk(); api.panic(); });
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
  // 1.3.27: set like Settings = follow Settings again (null)
  $('#eveSwitch').addEventListener('change', (e) => setProp({ evening: e.target.checked === !!V.settings.eveOn ? null : e.target.checked }));
  $('#panicSwitch').addEventListener('change', (e) => setProp({ panic: e.target.checked ? null : false }));
  let titleTimer = null;
  $('#titleInput').addEventListener('input', (e) => {
    V.note.title = e.target.value;
    body.classList.toggle('has-title', !!V.note.title.trim());
    $('#title').textContent = titleText();
    clearTimeout(titleTimer);
    titleTimer = setTimeout(() => api.update({ title: V.note.title }).then(gotDates), 300);
  });
  $('#titleInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); closePop('#menu'); } });
  // 1.3.3: the title's font (1.3.6: always the one picked; null = never picked, follows the note's font)
  $$('#titleFontSeg button').forEach((b) => b.addEventListener('click', () => setProp({ titleFont: b.dataset.tfont })));
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
  // ---- one Undo history for the text (1.3.31). The editor's own Undo only knows its own commands. Changes the note
  // makes itself (ticking and moving checklist lines, checklists part; photos, drawings and voice notes put in, insertNodes)
  // are steps of ours: ownStep({ undo(), redo(), alive() }). They keep their place among the editor's steps: a step
  // remembers how the note looked right after it (`after`, its saved form), and Undo takes it back once the note looks
  // like that again (the editor's later steps are undone), or when the editor has nothing left to undo. textRedo holds
  // ours and NATIVE (one of the editor's steps undone) in the order Undo went, so Redo goes back the same way.
  // Before, any typing wiped our steps (and a pasted photo was never one): Ctrl+Z couldn't take them back.
  const NATIVE = 'native';
  const textUndo = [];
  const textRedo = [];
  const looks = () => collect().html;
  function ownStep(st) {
    st.after = looks();
    textUndo.push(st);
    textRedo.length = 0;
    paintUndo();
  }
  // ---- a change the note makes to its own text, as one step of ours (1.3.32): domStep(fn) records what fn changes in
  // the note as it happens (a MutationObserver: elements added and removed, attributes, texts) and Undo plays it
  // backwards, putting back the same elements and texts (so the editor's own earlier steps still fit them); Redo plays
  // it forwards again. The cursor goes back to where it was. For a change spread over many events (a photo's size by
  // dragging): const rec = domRecord(keep); …; rec.end(). keep(record) leaves out changes that aren't part of it.
  // Any change to the note's DOM that isn't an editor command (execCommand) must go through one of these or ownStep.
  const OBSERVE = { subtree: true, childList: true, attributes: true, attributeOldValue: true, characterData: true, characterDataOldValue: true };
  function selNow() {
    const s = getSelection();
    if (!s.rangeCount || !editor.contains(s.getRangeAt(0).commonAncestorContainer)) return null;
    const r = s.getRangeAt(0);
    return [r.startContainer, r.startOffset, r.endContainer, r.endOffset];
  }
  function selSet(p) {
    if (!p || !editor.contains(p[0]) || !editor.contains(p[2])) return;
    try {
      const r = document.createRange();
      r.setStart(p[0], p[1]);
      r.setEnd(p[2], p[3]);
      const s = getSelection();
      s.removeAllRanges();
      s.addRange(r);
      V.savedRange = r.cloneRange();
    } catch { /* the place is gone */ }
  }
  function domRecord(keep = () => true) {
    const before = selNow();
    const got = []; // what the observer is handed between events (a drag), then what is still waiting at the end
    const mo = new MutationObserver((list) => got.push(...list));
    mo.observe(editor, OBSERVE);
    return {
      end() {
        got.push(...mo.takeRecords());
        const recs = got.filter(keep).map((r) => ({ type: r.type, target: r.target, name: r.attributeName,
          old: r.oldValue, now: null, added: [...r.addedNodes], removed: [...r.removedNodes], next: r.nextSibling }));
        mo.disconnect();
        if (!recs.length) return;
        const after = selNow();
        ownStep({
          alive: () => recs.some((r) => editor.contains(r.target)),
          undo: () => {
            for (const r of [...recs].reverse()) {
              if (r.type === 'attributes') {
                r.now = r.target.getAttribute(r.name);
                if (r.old === null) r.target.removeAttribute(r.name); else r.target.setAttribute(r.name, r.old);
              } else if (r.type === 'characterData') { r.now = r.target.data; r.target.data = r.old; }
              else {
                r.added.forEach((n) => { if (n.parentNode === r.target) n.remove(); });
                r.removed.forEach((n) => r.target.insertBefore(n, r.next && r.next.parentNode === r.target ? r.next : null));
              }
            }
            selSet(before);
            changed();
          },
          redo: () => {
            for (const r of recs) {
              if (r.type === 'attributes') { if (r.now === null) r.target.removeAttribute(r.name); else r.target.setAttribute(r.name, r.now); }
              else if (r.type === 'characterData') r.target.data = r.now;
              else {
                r.removed.forEach((n) => { if (n.parentNode === r.target) n.remove(); });
                r.added.forEach((n) => r.target.insertBefore(n, r.next && r.next.parentNode === r.target ? r.next : null));
              }
            }
            selSet(after);
            changed();
          },
        });
      },
    };
  }
  function domStep(fn, keep) {
    const rec = domRecord(keep);
    try { return fn(); } finally { rec.end(); }
  }
  const dropDead = (list) => { while (list.length && list[list.length - 1] !== NATIVE && list[list.length - 1].alive && !list[list.length - 1].alive()) list.pop(); };
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
  editor.addEventListener('input', (e) => {
    if (e.inputType === 'historyUndo') textRedo.push(NATIVE);
    else if (e.inputType === 'historyRedo') { if (textRedo[textRedo.length - 1] === NATIVE) textRedo.pop(); }
    else textRedo.length = 0; // a new edit: nothing to redo (the editor's own Redo forgets too)
    paintUndo(); // every edit, undo and redo changes what the two buttons can do
  });
  // ---- the one Undo button (bottom bar, left of Draw): drawing while drawing, otherwise the text
  function undoText() {
    dropDead(textUndo);
    const st = textUndo[textUndo.length - 1];
    if (st && (st.after === looks() || !document.queryCommandEnabled('undo'))) {
      textUndo.pop(); st.undo(); textRedo.push(st); paintUndo(); return;
    }
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
    dropDead(textRedo);
    const st = textRedo[textRedo.length - 1];
    if (!st) return; // the editor's own Redo may still hold steps from before one of ours: they no longer fit
    if (st !== NATIVE) { textRedo.pop(); st.redo(); st.after = looks(); textUndo.push(st); paintUndo(); return; }
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
  // 1.3.23: Undo and Redo are greyed out (disabled) when there is nothing to take back or put back. One place decides:
  // while drawing it is the drawing lists; otherwise our own text steps, then the editor's own history (a locked note
  // shows nothing, so nothing to undo). Call paintUndo() wherever either list changes.
  const drawingNow = () => K.inkState.on && !K.inkState.paused;
  const canUndo = () => drawingNow() ? K.inkState.undo.length > 0
    : !V.hidden && (textUndo.length > 0 || document.queryCommandEnabled('undo'));
  const canRedo = () => drawingNow() ? K.inkState.redo.length > 0
    : !V.hidden && textRedo.length > 0;
  function paintUndo() {
    const drawing = drawingNow();
    $('#btnUndo').title = drawing ? 'Undo drawing (Ctrl+Z)' : 'Undo (Ctrl+Z)';
    $('#btnRedo').title = drawing ? 'Redo drawing (Ctrl+Y)' : 'Redo (Ctrl+Y)';
    $('#btnUndo').disabled = !canUndo();
    $('#btnRedo').disabled = !canRedo();
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
      case 'speak': speakToText(); break; // 1.3.1 (src/note/speech.js)
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

  Object.assign(K, { popOuts, closePop, closePops, openPop, closeText, ownStep, domStep, domRecord, paintTextPanel, undoText,
    redoText, paintUndo, FACE });
})();
