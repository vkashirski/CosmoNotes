'use strict';
// CosmoNotes note window, part 9 of 10: the toolbars outside the note (their own little windows), the eraser for whole strokes
// (src/note.js until 1.1.44; the parts load in order from note.html. How they share names: ai-context/splitting-code.md)
(() => {
  const K = window.COSMO_NOTE_KIT;
  const { V, api, outDocs, $, editor, body, saveNow, gotDates, popOuts, closePop, closePops, paintUndo, sheet,
    zoomNow, hasInk, applyLayout, inkState, r1, strokeEl, renderInk, paintInkBar, enterInk, exitInk, movable, keepForInk } = K;
  // defined in a later part:
  const finishStroke = K.later('finishStroke'), toast = K.later('toast');
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
    if (!inkState.dirty || V.hidden || !V.note) return;
    inkState.dirty = false;
    const patch = { ink: V.note.ink };
    if (inkState.layout) { Object.assign(patch, inkState.layout); inkState.layout = null; } // 1.1.45: see keepForInk
    // the first drawing turns word wrap off (locks the layout) so it stays lined up with what was drawn
    if (hasInk() && !V.note.wrapWidth) {
      V.note.wrapWidth = Math.round(editor.clientWidth);
      patch.wrapWidth = V.note.wrapWidth;
      applyLayout();
      toast('Word wrap off, so your drawing stays in place');
    }
    api.update(patch).then(gotDates).catch(() => {});
  }
  function snapshot() {
    // 1.1.45: the first drawing on a note with word wrap off (no limit): pictures keep their width from now on
    const lay = keepForInk();
    if (lay) inkState.layout = lay;
    inkState.undo.push(JSON.stringify(V.note.ink || null));
    if (inkState.undo.length > 50) inkState.undo.shift(); // remember the last 50 steps
    // something new was drawn or erased: the redo list no longer applies (kept aside in case nothing changes)
    inkState.redoKept = inkState.redo;
    inkState.redo = [];
  }
  function inkUndo() {
    if (!inkState.undo.length) return;
    inkState.redo.push(JSON.stringify(V.note.ink || null));
    V.note.ink = JSON.parse(inkState.undo.pop());
    renderInk();
    scheduleInkSave();
    paintInkBar();
  }
  function inkRedo() {
    if (!inkState.redo.length) return;
    inkState.undo.push(JSON.stringify(V.note.ink || null));
    V.note.ink = JSON.parse(inkState.redo.pop());
    renderInk();
    scheduleInkSave();
    paintInkBar();
  }

  $('#inkClear').addEventListener('click', () => {
    if (!hasInk()) return;
    snapshot();
    V.note.ink = null;
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
    const list = V.note.ink.s;
    for (let i = list.length - 1; i >= 0; i--) {
      const st = list[i];
      const reach = (st.t === 'hl' ? st.w * 2 : st.w / 2) + 6;
      const pts = samplePoints(st);
      for (let k = 0; k < pts.length; k += 2) {
        if (Math.hypot(pts[k] - x, pts[k + 1] - y) <= reach) {
          list.splice(i, 1);
          if (!list.length) V.note.ink = null;
          inkState.erased = true;
          renderInk();
          return;
        }
      }
    }
  }

  Object.assign(K, { inkOut, textOut, placeInkBar, textMove, scheduleInkSave, saveInk, snapshot, inkUndo, inkRedo,
    catcher, inkPt, shapeEnd, redrawCurrent, eraseAt });
})();
