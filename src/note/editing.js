'use strict';
// CosmoNotes note window, part 5 of 10: editing helpers (checklists, strike-through…), Ctrl+F find, the keyboard
// (src/note.js until 1.1.44; the parts load in order from note.html. How they share names: ai-context/splitting-code.md)
(() => {
  const K = window.COSMO_NOTE_KIT;
  const { V, api, $, editor, body, changed, saveNow, anchor, closestIn, runCmd, closePops, textUndo, textRedo,
    undoText, redoText, openLinkForm, autoLink, moveCell } = K;
  // defined in a later part:
  const hideCtx = K.later('hideCtx'), stopRecording = K.later('stopRecording'), closeDraw = K.later('closeDraw'),
    drawUndo = K.later('drawUndo'), zoomNow = K.later('zoomNow'), setZoom = K.later('setZoom'),
    exitInk = K.later('exitInk'), inkUndo = K.later('inkUndo'), inkRedo = K.later('inkRedo'), toast = K.later('toast');
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
    const round = body.dataset.font !== 'hand'; // Rounded and Medieval: ordinary-sized letters (Caveat's are small)
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
    if (V.hidden || !V.note || V.note.rolled) return;
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
    else if (k === 'v' && e.shiftKey) { V.plainPaste = true; }
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
      if (K.inkState.on) { exitInk(); return; }
      if (!$('#draw').hidden) closeDraw();
      else if (!$('#recbar').hidden) stopRecording(false);
      closePops();
      hideCtx();
    }
    if (mod && e.key.toLowerCase() === 'n') { e.preventDefault(); saveNow(); api.newNote(); }
    // 1.1.23: Ctrl+S just reassures (everything already saves by itself)
    if (mod && !e.shiftKey && e.key.toLowerCase() === 's') { e.preventDefault(); saveNow(); toast('Already saved. Notes save as you type.'); return; }
    if (mod && e.key === '0') { e.preventDefault(); setZoom(1); }
    if (mod && (e.key === '=' || e.key === '+')) { e.preventDefault(); setZoom(zoomNow() + 0.1); }
    if (mod && e.key === '-') { e.preventDefault(); setZoom(zoomNow() - 0.1); }
    if (mod && e.key.toLowerCase() === 'w') { e.preventDefault(); saveNow(); api.close(); }
    if (mod && e.key.toLowerCase() === 'z' && !$('#draw').hidden) { e.preventDefault(); drawUndo(); }
    if (mod && !e.shiftKey && e.key.toLowerCase() === 'z' && $('#draw').hidden) {
      if (K.inkState.on && !K.inkState.paused) { e.preventDefault(); inkUndo(); }
      else if (textUndo.length) { e.preventDefault(); undoText(); } // a font change; text undo is the editor's own
    }
    // Redo: Ctrl+Y or Ctrl+Shift+Z (text redo is the editor's own, except a font change)
    const redoKey = mod && (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z'));
    if (redoKey && $('#draw').hidden) {
      if (K.inkState.on && !K.inkState.paused) { e.preventDefault(); inkRedo(); }
      else if (textRedo.length) { e.preventDefault(); redoText(); }
    }
  });

  Object.assign(K, { CB_VARS, decorate, find, runFind, closeFind });
})();
