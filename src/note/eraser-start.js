'use strict';
// CosmoNotes note window, part 11 of 11: the "Partial" eraser, the toast, start-up
// (src/note.js until 1.1.44; the parts load in order from note.html. How they share names: ai-context/splitting-code.md)
(() => {
  const K = window.COSMO_NOTE_KIT;
  const { V, api, $, editor, observer, updateEmpty, applyLook, applyTheme, caretAtEnd, decorate, find, runFind,
    closeFind, paintUnlock, hasInk, applyLayout, inkState, rubbing, eraserR, r1, strokeEl, layerOf, elCache, paintInk,
    renderInk, paintInkBar, scheduleInkSave, snapshot, catcher, inkPt, shapeEnd, redrawCurrent, eraseAt } = K;
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
    for (const st of V.note.ink.s) {
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
    V.note.ink = out.length ? { s: out.slice(-4000) } : null;
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
    if (!V.note.ink) V.note.ink = { s: [] };
    V.note.ink.s.push(st);
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
    V.note = await api.getNote();
    if (!V.note) return;
    if (V.note.settings) V.settings = { ...V.settings, ...V.note.settings };
    applyTheme();
    paintUnlock();
    V.hidden = !!V.note.hidden;
    editor.innerHTML = V.hidden ? '' : (V.note.html || '');
    if (find.on) { if (V.hidden) closeFind(false); else runFind(true); }
    decorate();
    applyLook();
    renderInk();
    updateEmpty();
    observer.observe(editor, { childList: true, subtree: true, characterData: true });
    if (V.hidden) {
      if (V.note.focusEditor) $('#unlockPw').focus();
    } else if (V.note.focusEditor) {
      editor.focus();
      caretAtEnd();
    }
  })();
  Object.assign(K, { finishStroke, toast });
})();
