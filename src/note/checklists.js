'use strict';
// CosmoNotes note window, part 6 of 16: checklists (1.3.19): click a box to tick it, drag a box to move its line,
// ticked lines to the bottom, boxes of one size. Each option is this note's own choice (⋯ → Checklists…, its own pop-up
// since 1.3.21) or Settings → Checklists.
// (the parts load in order from note.html. How they share names: ai-context/splitting-code.md)
(() => {
  const K = window.COSMO_NOTE_KIT;
  const { V, $, $$, editor, body, changed, setProp, decorate, ownStep, openPop, closePop, listGroup } = K;

  // ================================================================ the options
  // note.checklist = { drag, sink, fixed }: true / false, or null = as in Settings (checkDrag, checkSink, checkFixed).
  // A switch in the Checklists pop-up set to what Settings says goes back to null, so the note follows Settings again
  // (like spelling); "this note" marks a switch that differs, and "Use Settings" sets all three back to null.
  const OPTS = { drag: 'checkDrag', sink: 'checkSink', fixed: 'checkFixed' };
  const SWITCH = { drag: '#ckDrag', sink: '#ckSink', fixed: '#ckFixed' };
  function checkOn(k) {
    const mine = V.note && V.note.checklist ? V.note.checklist[k] : null;
    return typeof mine === 'boolean' ? mine : !!V.settings[OPTS[k]];
  }
  const own = (k) => !!V.note && !!V.note.checklist && typeof V.note.checklist[k] === 'boolean';
  let fixedWas = null;
  function applyChecks() {
    if (!V.note) return;
    for (const k of Object.keys(OPTS)) $(SWITCH[k]).checked = checkOn(k);
    $$('#ckPop .cktag').forEach((t) => { t.hidden = !own(t.dataset.k); });
    const n = Object.keys(OPTS).filter(own).length;
    $('#miChecksVal').textContent = n ? `${n} changed` : 'As in Settings';
    $('#ckFoot').textContent = n ? 'Different from Settings.' : 'Same as Settings.';
    $('#ckReset').disabled = !n;
    const fixed = checkOn('fixed');
    if (fixed !== fixedWas) { fixedWas = fixed; decorate(); } // the boxes are sized by alignChecks (editing part)
  }
  // 1.3.24 (the owner's wish): turning "ticked lines to the bottom" on here (its switch or Use Settings) tidies the note's
  // lists at once (gather, below). Settings → Checklists doesn't rearrange notes: only what is ticked from then on moves.
  function setChecks(checklist) {
    const was = checkOn('sink');
    setProp({ checklist });
    if (!was && checkOn('sink') && !V.hidden) gather();
  }
  for (const k of Object.keys(OPTS)) {
    $(SWITCH[k]).addEventListener('change', (e) => {
      const on = e.target.checked;
      setChecks({ ...(V.note.checklist || {}), [k]: on === !!V.settings[OPTS[k]] ? null : on });
    });
  }
  $('#miChecks').addEventListener('click', () => { openPop('#ckPop'); applyChecks(); });
  $('#ckX').addEventListener('click', () => closePop('#ckPop'));
  $('#ckReset').addEventListener('click', () => setChecks({ drag: null, sink: null, fixed: null }));

  // ================================================================ moving lines (one Undo step each)
  // Ticking and moving lines aren't the editor's own changes, so its undo can't take them back: each is a step of ours
  // (ownStep, panels part), in its place among the editor's own steps.
  const lines = () => editor.querySelectorAll('ul.checklist li');
  const isList = (x) => x && x.nodeType === 1 && /^(UL|OL)$/.test(x.nodeName);
  const zoomOf = (el) => { const r = el.getBoundingClientRect(); return r.width ? el.offsetWidth / r.width : 1; }; // screen px → the note's px
  // put a line before `next` in `parent` (null = at the end); a list it leaves empty goes too. → a function that puts both back
  function relocate(li, parent, next) {
    const back = { parent: li.parentNode, next: li.nextSibling };
    parent.insertBefore(li, next);
    let gone = null;
    const old = back.parent;
    if (old !== parent && isList(old) && !old.querySelector(':scope > li')) { gone = { el: old, parent: old.parentNode, next: old.nextSibling }; old.remove(); }
    return () => { if (gone) gone.parent.insertBefore(gone.el, gone.next); back.parent.insertBefore(li, back.next); };
  }
  // the lines that change place glide there (instead of jumping), unless Windows asks for less motion
  const calm = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: true };
  function glide(fn) {
    const all = calm.matches ? [] : [...lines()].slice(0, 200);
    const was = new Map(all.map((li) => [li, li.getBoundingClientRect().top]));
    const out = fn();
    let last = null;
    for (const [li, top] of was) {
      if (!li.isConnected) continue;
      const dy = (top - li.getBoundingClientRect().top) * zoomOf(li);
      if (Math.abs(dy) < 1) continue;
      last = li.animate([{ transform: `translateY(${dy.toFixed(1)}px)` }, { transform: 'none' }], { duration: 220, easing: 'cubic-bezier(.2,.7,.3,1)' });
    }
    if (last) last.finished.then(decorate, () => {}); // a ticked line's photos get their strike-through where they ended up
    return out;
  }
  // doIt() makes the change and returns how to take it back; el (a line or a list it changed) must still be in the note
  function step(el, doIt) {
    let undo = glide(doIt);
    changed();
    ownStep({
      alive: () => editor.contains(el),
      undo: () => { glide(undo); changed(); },
      redo: () => { undo = glide(doIt); changed(); },
    });
  }
  // the lines of a list and of the lists touching it (they look like one list: listGroup, content part), in order
  const groupLines = (lists) => lists.flatMap((l) => [...l.children].filter((x) => x.nodeName === 'LI'));
  const isDone = (x) => x.classList.contains('done');
  // a ticked line goes right after the last unticked line of its own list (1.3.25: lists that touch count as one):
  // ticked lines gather below. Only ticking moves a line (1.3.20, the owner's wish): unticked, it stays where it is.
  function sink(li) {
    const lists = listGroup(li.parentNode);
    const after = groupLines(lists).filter((x) => x !== li && !isDone(x)).pop();
    const parent = after ? after.parentNode : lists[0];
    const next = after ? after.nextSibling : lists[0].firstChild;
    return next === li ? null : relocate(li, parent, next);
  }
  // every list on its own (a list nested in a line too; lists that touch count as one): its ticked lines go below its
  // unticked ones, each kept in its order; a line takes the lines nested in it along. Lists with nothing out of place
  // aren't touched. One Undo step.
  function gather() {
    const seen = new Set();
    const groups = [];
    for (const ul of editor.querySelectorAll('ul.checklist, ul.checklist ul, ul.checklist ol')) {
      if (seen.has(ul)) continue;
      const lists = listGroup(ul);
      lists.forEach((l) => seen.add(l));
      const li = groupLines(lists);
      const last = li.filter((x) => !isDone(x)).pop();
      if (last && li.slice(0, li.indexOf(last)).some(isDone)) groups.push({ lists, li, last });
    }
    if (!groups.length) return;
    step(groups[0].last, () => {
      const was = groups.flatMap((g) => g.lists.map((ul) => ({ ul, parent: ul.parentNode, next: ul.nextSibling, nodes: [...ul.childNodes] })));
      for (const { li, last } of groups) {
        const at = last.nextSibling; // the ticked lines above it go here, in their order, before those already below it
        for (const x of li.slice(0, li.indexOf(last))) if (isDone(x)) last.parentNode.insertBefore(x, at);
      }
      // a list left with no lines goes (the lists that touched it stay one group)
      for (const { ul } of was) if (!ul.querySelector(':scope > li')) ul.remove();
      return () => { for (const w of was.reverse()) { if (!w.ul.isConnected) w.parent.insertBefore(w.ul, w.next); for (const n of w.nodes) w.ul.append(n); } };
    });
  }
  function tick(li) {
    const done = !li.classList.contains('done');
    step(li, () => {
      li.classList.toggle('done', done);
      const back = done && checkOn('sink') ? sink(li) : null;
      return () => { if (back) back(); li.classList.toggle('done', !done); };
    });
  }

  // ================================================================ the box: click to tick, drag to move
  // the line whose box (its ::before, note-text.css, placed and sized by alignChecks) is under the mouse, else null.
  // 1.3.38: the box itself only (the owner's wish), not the whole strip left of the words: a long line's strip goes down
  // beside all its rows, so a click under the box ticked it
  function boxAt(e) {
    const li = e.target.closest && e.target.closest('ul.checklist li');
    if (!li || !editor.contains(li) || V.hidden) return null;
    const r = li.getBoundingClientRect(); const k = zoomOf(li); const b = getComputedStyle(li, '::before');
    const x = (e.clientX - r.left) * k - (parseFloat(b.left) || 0);
    const y = (e.clientY - r.top) * k - (parseFloat(b.top) || 0);
    return x >= 0 && y >= 0 && x <= parseFloat(b.width) && y <= parseFloat(b.height) ? li : null;
  }
  // where a dragged line can go: before any checklist line, or after the last line of a list (never into itself)
  function slots(li) {
    const out = [];
    const nextLine = (r) => { let x = r.nextElementSibling; while (x && (x === li || x.nodeName !== 'LI')) x = x.nextElementSibling; return x; };
    for (const r of lines()) {
      if (r === li || li.contains(r)) continue;
      const rr = r.getBoundingClientRect();
      out.push({ parent: r.parentNode, next: r, y: rr.top, row: rr });
      if (!nextLine(r)) out.push({ parent: r.parentNode, next: r.nextSibling, y: rr.bottom, row: rr });
    }
    return out;
  }
  const noMove = (li, s) => s.parent === li.parentNode && (s.next === li || s.next === li.nextSibling);
  let press = null; // { li, x, y, dx, on, slot, list, raf }
  editor.addEventListener('mousedown', (e) => {
    if (e.button !== 0 || e.shiftKey || e.ctrlKey) return;
    const li = boxAt(e);
    if (!li) return;
    e.preventDefault();
    if (!checkOn('drag')) { tick(li); return; }
    press = { li, x: e.clientX, y: e.clientY, dx: e.clientX - li.getBoundingClientRect().left, on: false, slot: null };
  });
  function startDrag() {
    press.on = true;
    press.list = slots(press.li);
    press.li.classList.add('cb-moving');
    body.classList.add('cb-dragging');
    const loop = () => { if (!press || !press.on) return; edgeScroll(); press.raf = requestAnimationFrame(loop); };
    press.raf = requestAnimationFrame(loop);
  }
  // near the top or bottom of the note, it scrolls; scrolled (also by the wheel), the lines' places are measured again
  function edgeScroll() {
    const sc = $('#scroller'); const r = sc.getBoundingClientRect(); const EDGE = 28;
    const v = press.cy < r.top + EDGE ? -Math.ceil((r.top + EDGE - press.cy) / 4) : press.cy > r.bottom - EDGE ? Math.ceil((press.cy - r.bottom + EDGE) / 4) : 0;
    if (v) sc.scrollTop += v;
  }
  $('#scroller').addEventListener('scroll', () => { if (press && press.on) { press.list = slots(press.li); showSlot(); } }, { passive: true });
  function showSlot() {
    const { li, list } = press;
    const left = press.cx - press.dx; // where the dragged box is now
    let best = null;
    for (const s of list) { const d = Math.abs(s.y - press.cy); if (!best || d < best.d) best = { s, d }; }
    // two places at about the same height (the end of a list nested in a line, and the next line): the one whose
    // boxes line up with the dragged box
    if (best) {
      let pick = best.s; let dx = Infinity;
      for (const s of list) if (Math.abs(s.y - press.cy) <= best.d + 6) { const d = Math.abs(s.row.left - left); if (d < dx) { dx = d; pick = s; } }
      best = pick;
    }
    press.slot = best && !noMove(li, best) ? best : null;
    const sheet = $('#sheet');
    let mark = $('#cbDrop');
    if (!press.slot) { if (mark) mark.hidden = true; return; }
    if (!mark) { mark = document.createElement('div'); mark.id = 'cbDrop'; mark.setAttribute('aria-hidden', 'true'); sheet.append(mark); }
    const sr = sheet.getBoundingClientRect(); const k = zoomOf(sheet); const s = press.slot;
    mark.hidden = false;
    mark.style.cssText = `left:${((s.row.left - sr.left) * k).toFixed(1)}px;top:${((s.y - sr.top) * k - 1).toFixed(1)}px;width:${(s.row.width * k).toFixed(1)}px`;
  }
  function endDrag(drop) {
    const p = press;
    press = null;
    cancelAnimationFrame(p.raf);
    p.li.classList.remove('cb-moving');
    body.classList.remove('cb-dragging');
    const mark = $('#cbDrop');
    if (mark) mark.hidden = true;
    const s = p.slot;
    if (!drop || !s || !editor.contains(p.li) || !editor.contains(s.parent)) return;
    step(p.li, () => relocate(p.li, s.parent, s.next && s.next.parentNode === s.parent ? s.next : null));
  }
  document.addEventListener('mousemove', (e) => {
    if (!press) return;
    press.cx = e.clientX; press.cy = e.clientY;
    if (!press.on) { if (Math.hypot(e.clientX - press.x, e.clientY - press.y) < 4) return; startDrag(); }
    showSlot();
  });
  document.addEventListener('mouseup', () => {
    if (!press) return;
    if (press.on) endDrag(true);
    else { const { li } = press; press = null; if (editor.contains(li)) tick(li); }
  });
  document.addEventListener('keydown', (e) => { if (press && press.on && e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); endDrag(false); } }, true);
  window.addEventListener('blur', () => { if (press) { if (press.on) endDrag(false); else press = null; } });

  Object.assign(K, { checkOn, applyChecks });
})();
