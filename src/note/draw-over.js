'use strict';
// CosmoNotes note window, part 8 of 10: draw-over, floating toolbars
// (src/note.js until 1.1.44; the parts load in order from note.html. How they share names: ai-context/splitting-code.md)
(() => {
  const K = window.COSMO_NOTE_KIT;
  const { V, $, $$, editor, body, saveNow, closePops, paintUndo, hideCtx, handle, hasInk, applyLayout, fitSideways } = K;
  // defined in a later part:
  const placeInkBar = K.later('placeInkBar'), saveInk = K.later('saveInk');
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
    if (hasInk()) for (const st of V.note.ink.s) (st.l === 'b' ? below : above).push(elFor(st));
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
    for (const st of V.note.ink.s) {
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
    if (V.hidden || !V.note) return;
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
    K.inkOut.start(); // its own window, ready for when it's dragged out (or straight outside, where it was last time)
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
    K.inkOut.stop();
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

  Object.assign(K, { inkState, rubbing, eraserR, r1, strokeEl, layerOf, elCache, paintInk, renderInk, inkBounds,
    paintInkBar, enterInk, exitInk, movable });
})();
