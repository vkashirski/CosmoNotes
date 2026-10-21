'use strict';
(() => {
  const api = window.sticky;
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => [...document.querySelectorAll(s)];
  const editor = $('#editor');
  const body = document.body;

  let note = null;
  let hidden = false; // locked note whose contents are not shown
  let settings = { spellCheck: false, hasPassword: false };
  let dirty = false;
  let saveTimer = null;
  let savedRange = null;

  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = (sec) => { sec = Math.max(0, Math.round(sec || 0)); return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`; };

  // ================================================================ saving
  function collect() {
    const clone = editor.cloneNode(true);
    clone.querySelectorAll('.voice').forEach((v) => {
      v.classList.remove('playing');
      v.querySelectorAll('i.on').forEach((i) => i.classList.remove('on'));
      const t = v.querySelector('.v-time');
      if (t) t.textContent = fmt(+v.dataset.dur);
    });
    clone.querySelectorAll('.sel-img').forEach((i) => i.classList.remove('sel-img'));
    clone.querySelectorAll('[class=""]').forEach((el) => el.removeAttribute('class'));
    const img = clone.querySelector('img');
    let text = editor.innerText.replace(/ /g, ' ').replace(/\n{3,}/g, '\n\n').trim();
    if (!text) {
      if (editor.querySelector('.voice')) text = '🎤 Voice note';
      else if (editor.querySelector('img.att-drawing')) text = '✏️ Drawing';
      else if (img) text = '🖼️ Photo';
    }
    return { html: clone.innerHTML, text, firstImage: img ? img.getAttribute('src') : null };
  }

  function changed() {
    if (hidden || !note) return;
    dirty = true;
    updateEmpty();
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveNow, 350);
  }

  function saveNow() {
    clearTimeout(saveTimer);
    if (!dirty || !note || hidden) return Promise.resolve();
    dirty = false;
    const data = collect();
    note.text = data.text;
    $('#title').textContent = titleText();
    return api.update(data).then(gotDates).catch(() => {});
  }

  window.addEventListener('beforeunload', () => {
    if (dirty && note && !hidden) { dirty = false; api.updateSync(collect()); }
    if (inkState.dirty && note && !hidden) { inkState.dirty = false; api.updateSync({ ink: note.ink }); }
  });
  window.addEventListener('blur', saveNow);

  // Catch every edit (typing, undo, paste, commands); ignore voice-player animation.
  const observer = new MutationObserver((records) => {
    if (records.some((r) => !(r.target.closest ? r.target : r.target.parentElement)?.closest?.('.voice'))) changed();
  });

  function isEmpty() {
    return !editor.textContent.trim() && !editor.querySelector('img,.voice,table,hr,li');
  }
  function updateEmpty() { editor.classList.toggle('empty', isEmpty()); }

  function titleText() {
    if (note && note.title && note.title.trim()) return note.title.trim();
    if (hidden) return 'Locked note';
    const line = (note && note.text ? note.text : editor.innerText).split('\n').map((s) => s.trim()).find(Boolean);
    return line || 'CosmoNotes';
  }

  // ================================================================ dates
  function when(ts) {
    const d = new Date(ts);
    const now = new Date();
    const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const day = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
    const diff = Math.round((day(now) - day(d)) / 864e5);
    if (diff === 0) return `today ${time}`;
    if (diff === 1) return `yesterday ${time}`;
    return d.toLocaleDateString([], { day: 'numeric', month: 'short', year: d.getFullYear() === now.getFullYear() ? undefined : 'numeric' }) + `, ${time}`;
  }
  function full(ts) {
    return new Date(ts).toLocaleString([], { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }
  function showDates() {
    if (!note) return;
    $('#stamp').textContent = note.updatedAt ? `Edited ${when(note.updatedAt)}` : '';
    $('#dates').innerHTML = `Created <b>${esc(full(note.createdAt))}</b><br>Last edited <b>${esc(full(note.updatedAt))}</b>`;
  }
  function gotDates(n) {
    if (n && n.updatedAt) { note.updatedAt = n.updatedAt; note.createdAt = n.createdAt || note.createdAt; showDates(); }
  }
  setInterval(showDates, 60e3);

  // ================================================================ look & settings
  function applyLook() {
    body.dataset.color = note.color;
    body.dataset.font = note.font;
    body.dataset.size = note.size;
    body.classList.toggle('rolled', !!note.rolled);
    body.classList.toggle('has-title', !!(note.title && note.title.trim()));
    body.classList.toggle('locked-hidden', hidden);
    $('#lockScreen').hidden = !hidden;
    $('#btnRelock').hidden = !(note.lockedBy && !hidden);
    $('#btnRoll').title = note.rolled ? 'Unroll note' : 'Roll up to just the top bar';
    $('#miLock').hidden = hidden;
    const byGroup = !note.locked && note.lockedBy === 'group';
    $('#miLock').disabled = byGroup;
    $('#miLockText').textContent = note.locked ? 'Remove lock' : byGroup ? 'Locked with its group' : 'Lock note';
    if (document.activeElement !== $('#titleInput')) $('#titleInput').value = note.title || '';
    applySpell();
    applyLayout();
    showDates();
    const pin = $('#btnPin');
    pin.setAttribute('aria-pressed', String(!!note.pinned));
    pin.title = note.pinned ? 'Unpin (let other windows cover it)' : 'Pin on top of other windows';
    $('#title').textContent = titleText();
    $$('#colors .sw').forEach((b) => b.classList.toggle('on', b.dataset.color === note.color));
    $$('#fontSeg button').forEach((b) => b.classList.toggle('on', b.dataset.font === note.font));
    $$('#sizeSeg button').forEach((b) => b.classList.toggle('on', b.dataset.size === note.size));
    const pct = Math.round(note.opacity * 100);
    $('#opacity').value = String(pct);
    $('#opVal').textContent = pct === 100 ? 'Solid' : `${pct}%`;
    $('#solidHover').checked = !!note.solidOnHover;
  }

  function setProp(patch) {
    Object.assign(note, patch);
    applyLook();
    return api.update(patch).then((n) => { gotDates(n); return n; });
  }

  // ================================================================ spelling
  // Spelling is ignored unless turned on (for all notes in Settings, or just
  // this note with the button). Cyrillic words are never underlined.
  function spellOn() {
    return note && note.spell !== null && note.spell !== undefined ? !!note.spell : !!settings.spellCheck;
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
    setProp({ spell: next === !!settings.spellCheck ? null : next });
    toast(next ? 'Checking spelling in this note' : 'Ignoring spelling in this note');
  });
  api.onSettings((s) => {
    settings = { ...settings, ...s };
    if (note) applySpell();
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
    if (s.rangeCount && editor.contains(s.getRangeAt(0).commonAncestorContainer)) savedRange = s.getRangeAt(0).cloneRange();
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
    if (savedRange && editor.contains(savedRange.startContainer)) {
      s.removeAllRanges();
      s.addRange(savedRange);
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
      savedRange = after.cloneRange();
      (last.nodeType === 1 ? last : last.parentElement)?.scrollIntoView({ block: 'nearest' });
    }
    changed();
  }

  document.addEventListener('selectionchange', () => {
    saveSel();
    updateToolState();
    if (resizing) return;
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

  // ================================================================ popovers
  let openPopId = null;
  function closePops() {
    if (askResolve) { const r = askResolve; askResolve = null; r(false); }
    $$('.pop').forEach((p) => { p.hidden = true; });
    body.classList.remove('pop-open');
    openPopId = null;
  }
  function openPop(id) {
    closePops();
    hideCtx();
    $(id).hidden = false;
    body.classList.add('pop-open');
    openPopId = id;
  }
  function togglePop(id) {
    if (openPopId === id) closePops();
    else { saveSel(); openPop(id); }
  }
  document.addEventListener('mousedown', (e) => {
    if (!e.target.closest('.pop, #btnMenu, #btnInsert, #btnText')) closePops();
    if (!e.target.closest('.ctx')) hideCtx();
  });
  // Buttons inside popovers should not steal the text selection.
  $$('.pop button, .ctx').forEach((b) => b.addEventListener('mousedown', (e) => e.preventDefault()));

  // ---------- header
  $('#btnNew').addEventListener('click', () => { saveNow(); api.newNote(); });
  $('#btnClose').addEventListener('click', () => { saveNow(); api.close(); });
  $('#btnPin').addEventListener('click', () => setProp({ pinned: !note.pinned }));
  $('#btnMenu').addEventListener('click', () => togglePop('#menu'));
  $('#btnList').addEventListener('click', () => { saveNow(); api.showList(); });
  $('#btnRoll').addEventListener('click', () => { closePops(); saveNow(); setProp({ rolled: !note.rolled }); });
  $('#btnRelock').addEventListener('click', relock);
  $('#btnInsert').addEventListener('mousedown', (e) => e.preventDefault());
  $('#btnInsert').addEventListener('click', () => togglePop('#insert'));
  $('#btnText').addEventListener('mousedown', (e) => e.preventDefault());
  $('#btnText').addEventListener('click', () => togglePop('#textPop'));

  // ---------- ⋯ menu
  $$('#colors .sw').forEach((b) => b.addEventListener('click', () => setProp({ color: b.dataset.color })));
  $$('#fontSeg button').forEach((b) => b.addEventListener('click', () => setProp({ font: b.dataset.font })));
  $$('#sizeSeg button').forEach((b) => b.addEventListener('click', () => setProp({ size: b.dataset.size })));
  $('#opacity').addEventListener('input', (e) => {
    const v = Number(e.target.value) / 100;
    note.opacity = v;
    $('#opVal').textContent = v >= 1 ? 'Solid' : `${Math.round(v * 100)}%`;
    api.update({ opacity: v });
  });
  $('#solidHover').addEventListener('change', (e) => setProp({ solidOnHover: e.target.checked }));
  let titleTimer = null;
  $('#titleInput').addEventListener('input', (e) => {
    note.title = e.target.value;
    body.classList.toggle('has-title', !!note.title.trim());
    $('#title').textContent = titleText();
    clearTimeout(titleTimer);
    titleTimer = setTimeout(() => api.update({ title: note.title }).then(gotDates), 300);
  });
  $('#titleInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); closePops(); } });
  $('#miLock').addEventListener('click', toggleLock);
  $('#miDuplicate').addEventListener('click', async () => {
    closePops();
    await saveNow(); // the copy gets everything typed so far
    saveInk();
    api.duplicate();
  });
  $('#miDelete').addEventListener('click', () => { closePops(); saveNow(); api.trash(); });

  // see-through notes turn solid while the mouse is over them
  document.documentElement.addEventListener('mouseenter', () => api.hover(true));
  document.documentElement.addEventListener('mouseleave', () => api.hover(false));

  // ---------- Add panel
  $$('#insert [data-act]').forEach((b) => b.addEventListener('click', () => doInsert(b.dataset.act)));

  // ---------- text style panel
  const RESET_COLOR = '#010203';
  $$('#textPop [data-fore]').forEach((b) => b.addEventListener('click', () => {
    restoreSel();
    if (b.dataset.fore === 'inherit') {
      // back to the note's normal ink colour, keeping bold/italic etc.
      document.execCommand('foreColor', false, RESET_COLOR);
      editor.querySelectorAll('font[color]').forEach((f) => {
        if (f.getAttribute('color').toLowerCase() !== RESET_COLOR) return;
        f.removeAttribute('color');
        if (!f.attributes.length) f.replaceWith(...f.childNodes);
      });
      editor.querySelectorAll('[style*="color"]').forEach((el) => {
        if (/rgb\(1, 2, 3\)/.test(el.style.color)) el.style.color = '';
        if (!el.getAttribute('style')) el.removeAttribute('style');
      });
    } else {
      document.execCommand('foreColor', false, b.dataset.fore);
    }
    changed();
  }));
  $('#miClearFmt').addEventListener('click', () => {
    restoreSel();
    document.execCommand('removeFormat');
    closePops();
    changed();
  });
  $$('#textPop [data-hilite]').forEach((b) => b.addEventListener('click', () => {
    restoreSel();
    document.execCommand('hiliteColor', false, b.dataset.hilite);
    changed();
  }));
  $$('#fsizeSeg button').forEach((b) => b.addEventListener('click', () => {
    restoreSel();
    document.execCommand('fontSize', false, b.dataset.fsize);
    changed();
  }));

  async function doInsert(act) {
    closePops();
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

  // ================================================================ links
  let editingLink = null;
  function normUrl(u) {
    u = u.trim();
    if (!u) return '';
    if (/^(https?|mailto):/i.test(u)) return u;
    if (/^[^\s@/]+@[^\s@/]+\.[^\s@/]+$/.test(u)) return 'mailto:' + u;
    return 'https://' + u.replace(/^\/+/, '');
  }
  function openLinkForm(existing = null) {
    editingLink = existing;
    saveSel();
    const sel = getSelection().toString();
    $('#linkTitle').textContent = existing ? 'Edit link' : 'Add a link';
    $('#linkText').value = existing ? existing.textContent : sel;
    $('#linkUrl').value = existing ? existing.getAttribute('href') : '';
    openPop('#linkPop');
    setTimeout(() => ($('#linkText').value ? $('#linkUrl') : $('#linkText')).focus(), 20);
  }
  $('#linkCancel').addEventListener('click', () => { closePops(); restoreSel(); });
  $('#linkPop').addEventListener('submit', (e) => {
    e.preventDefault();
    const url = normUrl($('#linkUrl').value);
    if (!url) { $('#linkUrl').focus(); return; }
    const text = $('#linkText').value.trim() || $('#linkUrl').value.trim();
    closePops();
    if (editingLink && editor.contains(editingLink)) {
      editingLink.setAttribute('href', url);
      editingLink.textContent = text;
      changed();
    } else {
      restoreSel();
      document.execCommand('insertHTML', false, `<a href="${esc(url)}">${esc(text)}</a>&nbsp;`);
      changed();
    }
    editingLink = null;
  });

  function autoLink() {
    const s = getSelection();
    if (!s.rangeCount || !s.isCollapsed) return;
    const node = s.anchorNode;
    if (!node || node.nodeType !== 3 || closestIn(node, 'a')) return;
    const off = s.anchorOffset;
    const m = node.data.slice(0, off).match(/(^|[\s( ])((?:https?:\/\/|www\.)[^\s<>" ]+)$/i);
    if (!m) return;
    const raw = m[2];
    const url = raw.replace(/[.,;:!?)\]'"]+$/, '');
    if (url.length < 6) return;
    const start = off - raw.length;
    const r = document.createRange();
    r.setStart(node, start);
    r.setEnd(node, start + url.length);
    const a = document.createElement('a');
    a.href = url.toLowerCase().startsWith('www.') ? 'https://' + url : url;
    try { r.surroundContents(a); } catch { return; }
    const after = document.createRange();
    const trailing = raw.length - url.length;
    if (trailing && a.nextSibling && a.nextSibling.nodeType === 3) after.setStart(a.nextSibling, trailing);
    else after.setStartAfter(a);
    after.collapse(true);
    s.removeAllRanges();
    s.addRange(after);
    changed();
  }

  // ================================================================ tables
  function insertTable(cols, rows) {
    let h = '<table data-new="1"><tbody>';
    for (let r = 0; r < rows; r++) h += '<tr>' + '<td><br></td>'.repeat(cols) + '</tr>';
    h += '</tbody></table><div><br></div>';
    insertHTML(h);
    const t = editor.querySelector('table[data-new]');
    if (t) {
      t.removeAttribute('data-new');
      const first = t.querySelector('td');
      if (first) placeIn(first);
    }
  }
  function placeIn(cell) {
    const r = document.createRange();
    r.selectNodeContents(cell);
    r.collapse(false);
    const s = getSelection();
    s.removeAllRanges();
    s.addRange(r);
  }
  function tableOp(cell, op) {
    const tr = cell.parentElement;
    const table = cell.closest('table');
    const idx = [...tr.children].indexOf(cell);
    const rows = [...table.rows];
    switch (op) {
      case 'rowAbove': case 'rowBelow': {
        const nr = tr.cloneNode(true);
        [...nr.children].forEach((c) => { c.innerHTML = '<br>'; });
        if (op === 'rowAbove') tr.before(nr); else tr.after(nr);
        placeIn(nr.children[Math.min(idx, nr.children.length - 1)]);
        break;
      }
      case 'colLeft': case 'colRight':
        rows.forEach((row) => {
          const ref = row.children[Math.min(idx, row.children.length - 1)];
          if (!ref) return;
          const c = document.createElement(ref.tagName);
          c.innerHTML = '<br>';
          if (op === 'colLeft') ref.before(c); else ref.after(c);
        });
        break;
      case 'delRow':
        tr.remove();
        if (!table.rows.length) table.remove();
        break;
      case 'delCol':
        rows.forEach((row) => row.children[idx] && row.children[idx].remove());
        if (!table.rows[0] || !table.rows[0].children.length) table.remove();
        break;
      case 'delTable': table.remove(); break;
      default: break;
    }
    changed();
  }
  function moveCell(cell, dir) {
    const table = cell.closest('table');
    let cells = [...table.querySelectorAll('td,th')];
    const i = cells.indexOf(cell) + dir;
    if (i < 0) return;
    if (i >= cells.length) {
      tableOp(cell, 'rowBelow');
      cells = [...table.querySelectorAll('td,th')];
    }
    placeIn(cells[i]);
  }

  // ================================================================ photos (paste / drop)
  const IMG_EXT = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif', 'image/webp': 'webp', 'image/bmp': 'bmp' };
  async function insertImageFiles(files) {
    const urls = [];
    for (const f of files) {
      const ext = IMG_EXT[f.type];
      if (!ext) continue;
      try { urls.push(await api.saveAttachment(new Uint8Array(await f.arrayBuffer()), ext)); } catch { toast('Could not add that picture'); }
    }
    if (urls.length) insertNodes(urls.map((u) => `<img class="att-img" src="${esc(u)}">`).join(''));
  }

  const ALLOWED = {
    B: [], STRONG: [], I: [], EM: [], U: [], S: [], STRIKE: [], DEL: [], MARK: [], SUB: [], SUP: [], CODE: [], PRE: [],
    A: ['href'], UL: [], OL: [], LI: [], BR: [], P: [], DIV: [], SPAN: [], IMG: ['src'], HR: [], BLOCKQUOTE: [],
    TABLE: [], TBODY: [], THEAD: [], TR: [], TD: ['colspan', 'rowspan'], TH: ['colspan', 'rowspan'], H1: [], H2: [], H3: [], H4: [],
  };
  const DROP = new Set(['SCRIPT', 'STYLE', 'META', 'LINK', 'TITLE', 'IFRAME', 'OBJECT', 'EMBED', 'SVG', 'TEMPLATE', 'NOSCRIPT', 'BUTTON', 'INPUT', 'SELECT', 'TEXTAREA', 'FORM', 'VIDEO', 'AUDIO', 'CANVAS', 'HEAD']);
  function cleanTree(el) {
    for (const ch of [...el.childNodes]) {
      if (ch.nodeType === 3) continue;
      if (ch.nodeType !== 1) { ch.remove(); continue; }
      const tag = ch.tagName;
      if (DROP.has(tag)) { ch.remove(); continue; }
      if (!(tag in ALLOWED)) { cleanTree(ch); ch.replaceWith(...ch.childNodes); continue; }
      for (const a of [...ch.attributes]) if (!ALLOWED[tag].includes(a.name)) ch.removeAttribute(a.name);
      if (tag === 'A' && !/^(https?:|mailto:)/i.test(ch.getAttribute('href') || '')) ch.removeAttribute('href');
      if (tag === 'IMG') {
        if (!/^(https?:|data:image\/|stickyfile:)/i.test(ch.getAttribute('src') || '')) { ch.remove(); continue; }
        ch.className = 'att-img';
      }
      cleanTree(ch);
    }
  }
  function sanitize(html) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    cleanTree(doc.body);
    return doc.body.innerHTML;
  }

  let plainPaste = false;
  editor.addEventListener('paste', (e) => {
    const cd = e.clipboardData;
    if (!cd) return;
    const files = [...cd.items].filter((i) => i.kind === 'file' && IMG_EXT[i.type]).map((i) => i.getAsFile()).filter(Boolean);
    if (files.length) { e.preventDefault(); saveSel(); insertImageFiles(files); return; }
    const html = cd.getData('text/html');
    const text = cd.getData('text/plain');
    e.preventDefault();
    const t = (text || '').trim();
    if (/^(https?:\/\/|www\.)\S+$/i.test(t)) {
      const href = t.toLowerCase().startsWith('www.') ? 'https://' + t : t;
      document.execCommand('insertHTML', false, `<a href="${esc(href)}">${esc(t)}</a>&nbsp;`);
    } else if (html && !plainPaste) {
      document.execCommand('insertHTML', false, sanitize(html));
    } else if (text) {
      document.execCommand('insertText', false, text);
    }
    plainPaste = false;
    changed();
  });

  editor.addEventListener('dragover', (e) => { if ([...e.dataTransfer.types].includes('Files')) e.preventDefault(); });
  editor.addEventListener('drop', (e) => {
    const files = [...(e.dataTransfer.files || [])].filter((f) => IMG_EXT[f.type]);
    if (!files.length) return;
    e.preventDefault();
    const r = document.caretRangeFromPoint(e.clientX, e.clientY);
    if (r && editor.contains(r.startContainer)) { savedRange = r; }
    insertImageFiles(files);
  });
  // Never let a dropped file replace the whole note page.
  window.addEventListener('dragover', (e) => e.preventDefault());
  window.addEventListener('drop', (e) => e.preventDefault());

  // ================================================================ clicks inside the note
  editor.addEventListener('mousedown', (e) => {
    const li = e.target.closest && e.target.closest('ul.checklist li');
    if (li && editor.contains(li)) {
      const rect = li.getBoundingClientRect();
      const pad = parseFloat(getComputedStyle(li).paddingLeft) || 24;
      if (e.clientX < rect.left + pad && e.button === 0) {
        e.preventDefault();
        li.classList.toggle('done');
        changed();
      }
    }
  });
  editor.addEventListener('click', (e) => {
    const voice = e.target.closest('.voice');
    if (voice) { e.preventDefault(); togglePlay(voice); return; }
    const img = e.target.closest('img');
    if (img) { selectImage(img); return; }
    const a = e.target.closest('a[href]');
    if (a && getSelection().isCollapsed && !e.shiftKey) {
      e.preventDefault();
      api.openExternal(a.getAttribute('href'));
    }
  });
  editor.addEventListener('dblclick', (e) => {
    const img = e.target.closest('img');
    if (!img) return;
    if (img.classList.contains('att-drawing')) openDraw(img);
    else openPhoto(img);
  });
  function openPhoto(img) {
    const src = img.getAttribute('src') || '';
    if (src.startsWith('stickyfile:')) api.openAttachment(src);
    else if (/^https?:/i.test(src)) api.openExternal(src);
  }
  // clicking empty space below the text puts the caret at the end
  $('#scroller').addEventListener('mousedown', (e) => {
    if (e.target.id === 'scroller') { e.preventDefault(); editor.focus(); caretAtEnd(); }
  });

  // ================================================================ keyboard
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
    if ((e.key === 'Backspace' || e.key === 'Delete')) {
      const sel = editor.querySelector('img.sel-img');
      if (sel) { e.preventDefault(); sel.remove(); changed(); }
    }
    const mod = e.ctrlKey || e.metaKey;
    if (!mod) return;
    const k = e.key.toLowerCase();
    if (k === 't' && !e.shiftKey) { e.preventDefault(); runCmd('strikeThrough'); }
    else if (k === 'l' && e.shiftKey) { e.preventDefault(); runCmd('bullets'); }
    else if (k === 'c' && e.shiftKey) { e.preventDefault(); runCmd('checklist'); }
    else if (k === 'k' && !e.shiftKey) { e.preventDefault(); openLinkForm(closestIn(anchor(), 'a')); }
    else if (k === 'v' && e.shiftKey) { plainPaste = true; }
  });
  editor.addEventListener('input', (e) => {
    if (e.inputType === 'insertParagraph') {
      const li = closestIn(anchor(), 'li');
      if (li && !li.textContent.trim()) li.classList.remove('done');
    }
  });
  document.addEventListener('keydown', (e) => {
    const mod = e.ctrlKey || e.metaKey;
    if (e.key === 'Escape') {
      if (inkState.on) { exitInk(); return; }
      if (!$('#draw').hidden) closeDraw();
      else if (!$('#recbar').hidden) stopRecording(false);
      closePops();
      hideCtx();
    }
    if (mod && e.key.toLowerCase() === 'n') { e.preventDefault(); saveNow(); api.newNote(); }
    if (mod && e.key.toLowerCase() === 'w') { e.preventDefault(); saveNow(); api.close(); }
    if (mod && e.key.toLowerCase() === 'z' && !$('#draw').hidden) { e.preventDefault(); drawUndo(); }
    if (mod && e.key.toLowerCase() === 'z' && inkState.on) { e.preventDefault(); inkUndo(); }
  });

  // ================================================================ right-click menus
  const ctx = $('#ctx');
  function hideCtx() { ctx.hidden = true; }
  function showCtx(x, y, items) {
    ctx.innerHTML = '';
    for (const it of items) {
      if (it === '-') { const s = document.createElement('div'); s.className = 'sep'; ctx.appendChild(s); continue; }
      const b = document.createElement('button');
      b.className = 'mi' + (it.danger ? ' danger' : '');
      b.textContent = it.label;
      b.addEventListener('mousedown', (ev) => ev.preventDefault());
      b.addEventListener('click', () => { hideCtx(); it.run(); });
      ctx.appendChild(b);
    }
    ctx.hidden = false;
    const w = ctx.offsetWidth;
    const h = ctx.offsetHeight;
    ctx.style.left = Math.max(4, Math.min(x, innerWidth - w - 4)) + 'px';
    ctx.style.top = Math.max(4, Math.min(y, innerHeight - h - 4)) + 'px';
  }
  editor.addEventListener('contextmenu', (e) => {
    const img = e.target.closest('img');
    const voice = e.target.closest('.voice');
    const a = e.target.closest('a[href]');
    const cell = e.target.closest('td,th');
    let items = null;
    if (img) {
      const drawing = img.classList.contains('att-drawing');
      const guarded = (fn) => () => (needsResizeWarning() ? resizeWarning(fn) : fn());
      const fixed = img.classList.contains('fixed');
      // A locked layout with a drawing keeps every picture at its size, so the drawing stays on
      // what it marked. The option would do nothing there, so the menu says why instead.
      const pinnedByInk = hasInk() && !!note.wrapWidth;
      const keep = pinnedByInk ? {
        label: '✓ Keep size (always on while this note has a drawing)',
        run: () => toast('Pictures keep their size so your drawing stays lined up. To let them shrink, unlock the text layout (button next to spelling).'),
      } : {
        label: (fixed ? '✓ ' : '') + 'Keep size when the note gets narrower',
        run: () => {
          if (fixed) img.classList.remove('fixed');
          else {
            // remember the size it has with the note at full width (not a squeezed size)
            if (!img.getAttribute('width')) img.setAttribute('width', String(Math.round(Math.min(img.naturalWidth || Infinity, editor.clientWidth))));
            img.classList.add('fixed');
          }
          changed();
          toast(fixed ? 'This picture now shrinks with the note' : 'This picture keeps its size; scroll sideways if the note gets narrower');
        },
      };
      items = drawing
        ? [{ label: 'Edit sketch', run: () => openDraw(img) }, '-', keep]
        : [
          { label: 'Open full size', run: () => openPhoto(img) },
          '-',
          { label: 'Small', run: guarded(() => setImgWidth(img, editor.clientWidth * 0.4)) },
          { label: 'Medium', run: guarded(() => setImgWidth(img, editor.clientWidth * 0.7)) },
          { label: 'Full width', run: guarded(() => { img.classList.remove('w-s', 'w-m', 'fixed'); img.removeAttribute('width'); changed(); placeHandle(); }) },
          '-',
          keep,
        ];
      items.push('-', { label: drawing ? 'Remove drawing' : 'Remove photo', danger: true, run: () => { img.remove(); changed(); } });
    } else if (voice) {
      items = [
        { label: playingChip === voice ? 'Pause' : 'Play', run: () => togglePlay(voice) },
        '-',
        { label: 'Remove recording', danger: true, run: () => { if (playingChip === voice) stopPlay(); voice.remove(); changed(); } },
      ];
    } else if (a) {
      items = [
        { label: 'Open link', run: () => api.openExternal(a.getAttribute('href')) },
        { label: 'Edit link', run: () => openLinkForm(a) },
        { label: 'Copy link address', run: () => navigator.clipboard.writeText(a.getAttribute('href')).catch(() => {}) },
        '-',
        { label: 'Remove link (keep text)', run: () => { a.replaceWith(...a.childNodes); changed(); } },
      ];
    } else if (cell) {
      items = [
        { label: 'Add row above', run: () => tableOp(cell, 'rowAbove') },
        { label: 'Add row below', run: () => tableOp(cell, 'rowBelow') },
        { label: 'Add column left', run: () => tableOp(cell, 'colLeft') },
        { label: 'Add column right', run: () => tableOp(cell, 'colRight') },
        '-',
        { label: 'Delete row', danger: true, run: () => tableOp(cell, 'delRow') },
        { label: 'Delete column', danger: true, run: () => tableOp(cell, 'delCol') },
        { label: 'Delete table', danger: true, run: () => tableOp(cell, 'delTable') },
      ];
    }
    if (!items) return; // regular text: the normal Cut/Copy/Paste + spelling menu
    e.preventDefault();
    closePops();
    showCtx(e.clientX, e.clientY, items);
  });

  // ================================================================ voice notes
  let player = null;
  let playingChip = null;
  function togglePlay(chip) {
    if (playingChip === chip) { stopPlay(); return; }
    stopPlay();
    const audio = new Audio(chip.dataset.src);
    player = audio;
    playingChip = chip;
    chip.classList.add('playing');
    const bars = [...chip.querySelectorAll('.v-bars i')];
    const dur = +chip.dataset.dur || 0;
    audio.ontimeupdate = () => {
      const d = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : dur;
      const k = d ? Math.round((audio.currentTime / d) * bars.length) : 0;
      bars.forEach((b, i) => b.classList.toggle('on', i < k));
      chip.querySelector('.v-time').textContent = fmt(audio.currentTime);
    };
    audio.onended = stopPlay;
    audio.onerror = () => { toast("Couldn't play this recording"); stopPlay(); };
    audio.play().catch(() => {});
  }
  function stopPlay() {
    if (player) { player.pause(); player = null; }
    if (playingChip) {
      playingChip.classList.remove('playing');
      playingChip.querySelectorAll('i.on').forEach((i) => i.classList.remove('on'));
      const t = playingChip.querySelector('.v-time');
      if (t) t.textContent = fmt(+playingChip.dataset.dur);
      playingChip = null;
    }
  }
  function voiceChip(url, dur) {
    let x = [...url].reduce((acc, c) => (acc * 31 + c.charCodeAt(0)) >>> 0, 7);
    let bars = '';
    for (let i = 0; i < 18; i++) {
      x = (Math.imul(x, 1103515245) + 12345) >>> 0;
      bars += `<i class="h${1 + ((x >>> 16) % 5)}"></i>`;
    }
    return `<span class="voice" contenteditable="false" data-src="${esc(url)}" data-dur="${dur}"><span class="v-play"></span><span class="v-bars">${bars}</span><span class="v-time">${fmt(dur)}</span></span>&nbsp;`;
  }

  const rec = { mr: null, stream: null, chunks: [], start: 0, timer: null, keep: true, ctx: null, raf: 0 };
  async function startRecording() {
    if (rec.mr) return;
    saveSel();
    try {
      rec.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    } catch {
      toast('No microphone found, or Windows blocked it (Settings → Privacy → Microphone)');
      return;
    }
    const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : 'audio/webm';
    rec.mr = new MediaRecorder(rec.stream, { mimeType: mime });
    rec.chunks = [];
    rec.keep = true;
    rec.mr.ondataavailable = (e) => { if (e.data && e.data.size) rec.chunks.push(e.data); };
    rec.mr.onstop = finishRecording;
    rec.mr.start(250);
    rec.start = Date.now();
    $('#recbar').hidden = false;
    $('#recTime').textContent = '0:00';
    rec.timer = setInterval(() => { $('#recTime').textContent = fmt((Date.now() - rec.start) / 1000); }, 250);
    startMeter();
  }
  function startMeter() {
    const meter = $('#meter');
    meter.innerHTML = '<i></i>'.repeat(40);
    const bars = [...meter.children];
    try {
      rec.ctx = new AudioContext();
      const src = rec.ctx.createMediaStreamSource(rec.stream);
      const an = rec.ctx.createAnalyser();
      an.fftSize = 512;
      src.connect(an);
      const data = new Uint8Array(an.fftSize);
      const levels = new Array(bars.length).fill(3);
      let last = 0;
      const tick = (t) => {
        rec.raf = requestAnimationFrame(tick);
        if (t - last < 70) return;
        last = t;
        an.getByteTimeDomainData(data);
        let peak = 0;
        for (const v of data) peak = Math.max(peak, Math.abs(v - 128));
        levels.shift();
        levels.push(3 + Math.min(19, peak / 2.2));
        bars.forEach((b, i) => { b.style.height = levels[i] + 'px'; });
      };
      rec.raf = requestAnimationFrame(tick);
    } catch { /* meter is just decoration */ }
  }
  function stopRecording(keep) {
    if (!rec.mr) return;
    rec.keep = keep;
    try { rec.mr.stop(); } catch { finishRecording(); }
  }
  async function finishRecording() {
    clearInterval(rec.timer);
    cancelAnimationFrame(rec.raf);
    if (rec.ctx) { rec.ctx.close().catch(() => {}); rec.ctx = null; }
    if (rec.stream) rec.stream.getTracks().forEach((t) => t.stop());
    $('#recbar').hidden = true;
    const dur = Math.max(1, Math.round((Date.now() - rec.start) / 1000));
    const chunks = rec.chunks;
    const keep = rec.keep;
    rec.mr = null;
    rec.stream = null;
    rec.chunks = [];
    if (!keep || !chunks.length) return;
    try {
      const blob = new Blob(chunks, { type: 'audio/webm' });
      const url = await api.saveAttachment(new Uint8Array(await blob.arrayBuffer()), 'webm');
      insertNodes(voiceChip(url, dur));
    } catch {
      toast('Could not save the recording');
    }
  }
  $('#recStop').addEventListener('click', () => stopRecording(true));
  $('#recCancel').addEventListener('click', () => stopRecording(false));

  // ================================================================ drawing
  const cv = $('#cv');
  const g = cv.getContext('2d');
  const draw = { strokes: [], color: '#2B2B2B', size: 4, erase: false, bg: null, target: null, cur: null, dpr: 1, w: 0, h: 0 };

  function openDraw(target) {
    closePops();
    hideCtx();
    if (!target) saveSel();
    draw.target = target;
    draw.strokes = [];
    draw.bg = null;
    draw.cur = null;
    $('#draw').hidden = false;
    sizeCanvas();
    if (target) {
      const im = new Image();
      im.onload = () => {
        const w = Number(target.getAttribute('width')) || im.naturalWidth;
        const scale = Math.min(1, draw.w / w);
        draw.bg = { img: im, w: w * scale, h: (im.naturalHeight * (w / im.naturalWidth)) * scale };
        redraw();
      };
      im.src = target.getAttribute('src');
    }
  }
  function closeDraw() {
    $('#draw').hidden = true;
    draw.cur = null;
  }
  function sizeCanvas() {
    const r = cv.getBoundingClientRect();
    draw.dpr = window.devicePixelRatio || 1;
    draw.w = r.width;
    draw.h = r.height;
    cv.width = Math.max(1, Math.round(r.width * draw.dpr));
    cv.height = Math.max(1, Math.round(r.height * draw.dpr));
    g.setTransform(draw.dpr, 0, 0, draw.dpr, 0, 0);
    redraw();
  }
  window.addEventListener('resize', () => { if (!$('#draw').hidden) sizeCanvas(); });

  function strokeWidth(s, p) { return s.erase ? s.size * 4 : s.size * (0.45 + p * 1.1); }
  function paintStroke(s) {
    const pts = s.pts;
    g.save();
    g.globalCompositeOperation = s.erase ? 'destination-out' : 'source-over';
    g.strokeStyle = s.color;
    g.fillStyle = s.color;
    g.lineCap = 'round';
    g.lineJoin = 'round';
    if (pts.length === 1) {
      g.beginPath();
      g.arc(pts[0].x, pts[0].y, strokeWidth(s, pts[0].p) / 2, 0, Math.PI * 2);
      g.fill();
    } else {
      const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
      let from = pts[0];
      for (let i = 1; i < pts.length; i++) {
        const to = i === pts.length - 1 ? pts[i] : mid(pts[i], pts[i + 1]);
        g.lineWidth = strokeWidth(s, pts[i].p);
        g.beginPath();
        g.moveTo(from.x, from.y);
        g.quadraticCurveTo(pts[i].x, pts[i].y, to.x, to.y);
        g.stroke();
        from = to;
      }
    }
    g.restore();
  }
  function redraw() {
    g.clearRect(0, 0, draw.w, draw.h);
    if (draw.bg) g.drawImage(draw.bg.img, 0, 0, draw.bg.w, draw.bg.h);
    draw.strokes.forEach(paintStroke);
    $('#dHint').hidden = draw.strokes.length > 0 || !!draw.bg;
  }
  const ptOf = (e) => ({ x: e.offsetX, y: e.offsetY, p: e.pointerType === 'pen' ? (e.pressure || 0.5) : 0.5 });
  cv.addEventListener('pointerdown', (e) => {
    cv.setPointerCapture(e.pointerId);
    draw.cur = { color: draw.color, size: draw.size, erase: draw.erase, pts: [ptOf(e)] };
    draw.strokes.push(draw.cur);
    redraw();
  });
  cv.addEventListener('pointermove', (e) => {
    if (!draw.cur) return;
    const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
    for (const ev of (evs.length ? evs : [e])) draw.cur.pts.push(ptOf(ev));
    redraw();
  });
  const endStroke = () => { draw.cur = null; };
  cv.addEventListener('pointerup', endStroke);
  cv.addEventListener('pointercancel', endStroke);

  function drawUndo() { draw.strokes.pop(); redraw(); }
  $('#dUndo').addEventListener('click', drawUndo);
  $('#dClear').addEventListener('click', () => { draw.strokes = []; draw.bg = null; redraw(); });
  $('#dCancel').addEventListener('click', closeDraw);
  $$('#pens .pen').forEach((b) => b.addEventListener('click', () => {
    draw.color = b.dataset.pen;
    draw.erase = false;
    body.classList.remove('erasing');
    $('#eraser').classList.remove('on');
    $$('#pens .pen').forEach((x) => x.classList.toggle('on', x === b));
  }));
  $$('#sizes .size').forEach((b) => b.addEventListener('click', () => {
    draw.size = Number(b.dataset.w);
    $$('#sizes .size').forEach((x) => x.classList.toggle('on', x === b));
  }));
  $('#eraser').addEventListener('click', () => {
    draw.erase = !draw.erase;
    body.classList.toggle('erasing', draw.erase);
    $('#eraser').classList.toggle('on', draw.erase);
  });

  function contentBox() {
    const { width, height } = cv;
    const px = g.getImageData(0, 0, width, height).data;
    let x0 = width; let y0 = height; let x1 = -1; let y1 = -1;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (px[(y * width + x) * 4 + 3] > 8) {
          if (x < x0) x0 = x;
          if (x > x1) x1 = x;
          if (y < y0) y0 = y;
          if (y > y1) y1 = y;
        }
      }
    }
    if (x1 < 0) return null;
    const pad = Math.round(6 * draw.dpr);
    x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad);
    x1 = Math.min(width - 1, x1 + pad); y1 = Math.min(height - 1, y1 + pad);
    return { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
  }

  $('#dDone').addEventListener('click', async () => {
    const target = draw.target;
    if (!draw.strokes.length && (target ? draw.bg : true)) { closeDraw(); return; }
    redraw();
    const box = contentBox();
    if (!box) {
      if (target) { target.remove(); changed(); }
      closeDraw();
      return;
    }
    const out = document.createElement('canvas');
    out.width = box.w;
    out.height = box.h;
    out.getContext('2d').drawImage(cv, box.x, box.y, box.w, box.h, 0, 0, box.w, box.h);
    const blob = await new Promise((res) => out.toBlob(res, 'image/png'));
    try {
      const url = await api.saveAttachment(new Uint8Array(await blob.arrayBuffer()), 'png');
      const cssW = Math.round(box.w / draw.dpr);
      closeDraw();
      if (target && editor.contains(target)) {
        target.setAttribute('src', url);
        target.setAttribute('width', String(cssW));
        changed();
      } else {
        insertNodes(`<img class="att-drawing" src="${esc(url)}" width="${cssW}">`);
      }
    } catch {
      toast('Could not save the drawing');
    }
  });

  // ================================================================ photo resizing
  const handle = $('#imgHandle');
  let resizing = false;
  const MIN_IMG = 60;
  function selectedImage() {
    const img = editor.querySelector('img.sel-img');
    return img && editor.contains(img) ? img : null;
  }
  function selectImage(img) {
    $$('#editor .sel-img').forEach((i) => i !== img && i.classList.remove('sel-img'));
    const r = document.createRange();
    r.selectNode(img);
    const s = getSelection();
    s.removeAllRanges();
    s.addRange(r);
    img.classList.add('sel-img');
    placeHandle();
  }
  function placeHandle() {
    const img = selectedImage();
    if (!img || hidden || note?.rolled) { handle.hidden = true; return; }
    const r = img.getBoundingClientRect();
    const box = $('#scroller').getBoundingClientRect();
    if (r.bottom < box.top + 4 || r.bottom > box.bottom - 2) { handle.hidden = true; return; }
    handle.hidden = false;
    handle.style.left = `${Math.min(r.right, box.right - 10)}px`;
    handle.style.top = `${r.bottom}px`;
  }
  function setImgWidth(img, w) {
    const max = editor.clientWidth;
    w = Math.round(Math.max(Math.min(MIN_IMG, max), Math.min(max, w)));
    img.classList.remove('w-s', 'w-m');
    img.setAttribute('width', String(w));
    changed();
    placeHandle();
  }
  handle.addEventListener('pointerdown', (e) => {
    const img = selectedImage();
    if (!img) return;
    e.preventDefault();
    if (needsResizeWarning()) { resizeWarning(); return; }
    handle.setPointerCapture(e.pointerId);
    resizing = true;
    body.classList.add('resizing');
    const startX = e.clientX;
    const startW = img.getBoundingClientRect().width;
    const max = editor.clientWidth;
    const min = Math.min(MIN_IMG, max);
    const move = (ev) => {
      const w = Math.round(Math.max(min, Math.min(max, startW + ev.clientX - startX)));
      img.classList.remove('w-s', 'w-m');
      img.setAttribute('width', String(w));
      placeHandle();
    };
    const up = () => {
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', up);
      handle.removeEventListener('pointercancel', up);
      resizing = false;
      body.classList.remove('resizing');
      changed();
      placeHandle();
    };
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', up);
    handle.addEventListener('pointercancel', up);
  });
  $('#scroller').addEventListener('scroll', placeHandle, { passive: true });
  window.addEventListener('resize', placeHandle);
  editor.addEventListener('load', placeHandle, true);

  // ================================================================ locking
  function showContent(n) {
    observer.disconnect();
    hidden = false;
    note = { ...note, ...n, hidden: false };
    editor.innerHTML = note.html || '';
    observer.observe(editor, { childList: true, subtree: true, characterData: true });
    dirty = false;
    applyLook();
    renderInk();
    updateEmpty();
  }
  function hideContent() {
    if (inkState.on) exitInk();
    inkState.dirty = false;
    clearTimeout(inkState.timer);
    note.ink = null;
    renderInk();
    stopPlay();
    if (!$('#draw').hidden) closeDraw();
    if (rec.mr) stopRecording(false);
    observer.disconnect();
    dirty = false;
    clearTimeout(saveTimer);
    hidden = true;
    editor.innerHTML = '';
    note.html = '';
    observer.observe(editor, { childList: true, subtree: true, characterData: true });
    $('#unlockPw').value = '';
    $('#unlockErr').textContent = '';
    closePops();
    applyLook();
    handle.hidden = true;
  }
  async function relock() {
    await saveNow();
    await api.relock();
    hideContent();
  }
  // Locked from the notes list: save what's typed, then hide.
  api.onLockNow(() => { if (!hidden) relock(); });
  // Colour/font/lock changed from the notes list.
  api.onLook((v) => {
    if (!note || !v) return;
    for (const k of ['color', 'font', 'size', 'title', 'locked', 'lockedBy', 'pinned', 'opacity']) if (k in v) note[k] = v[k];
    if (v.hidden && !hidden) { hideContent(); return; }
    applyLook();
  });
  async function toggleLock() {
    closePops();
    if (note.locked) {
      const n = await api.setLocked(false);
      if (n && !n.error) { note.locked = false; note.lockedBy = n.lockedBy; applyLook(); toast('Lock removed'); }
      return;
    }
    if (note.lockedBy === 'group') return;
    if (!settings.hasPassword) { openPwPop(); return; }
    await lockNow();
  }
  async function lockNow() {
    saveNow();
    const n = await api.setLocked(true);
    if (!n || n.error) { toast('Could not lock this note'); return; }
    note.locked = true;
    note.lockedBy = 'note';
    hideContent();
    toast('Note locked 🔒');
  }
  function openPwPop() {
    $('#pwNew').value = '';
    $('#pwAgain').value = '';
    $('#pwErr').textContent = '';
    openPop('#pwPop');
    setTimeout(() => $('#pwNew').focus(), 20);
  }
  $('#pwCancel').addEventListener('click', closePops);
  $('#pwPop').addEventListener('submit', async (e) => {
    e.preventDefault();
    const a = $('#pwNew').value;
    const b = $('#pwAgain').value;
    if (a.length < 4) { $('#pwErr').textContent = 'Use at least 4 characters or digits.'; return; }
    if (a !== b) { $('#pwErr').textContent = "The two don't match."; return; }
    const r = await api.setPassword('', a);
    if (!r || r.error) { $('#pwErr').textContent = (r && r.error) || 'Could not save it.'; return; }
    settings.hasPassword = true;
    closePops();
    await lockNow();
  });
  $('#unlockForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const pw = $('#unlockPw').value;
    if (!pw) { $('#unlockPw').focus(); return; }
    const n = await api.unlock(pw);
    if (!n || n.hidden) {
      $('#unlockErr').textContent = 'Wrong password';
      const f = $('#unlockForm');
      f.classList.remove('shake');
      void f.offsetWidth;
      f.classList.add('shake');
      $('#unlockPw').select();
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
  let askResolve = null;
  function ask(title, text, okLabel = 'OK') {
    openPop('#askPop');
    $('#askTitle').textContent = title;
    $('#askText').textContent = text;
    $('#askYes').textContent = okLabel;
    return new Promise((resolve) => { askResolve = resolve; });
  }
  const answerAsk = (v) => { const r = askResolve; askResolve = null; closePops(); if (r) r(v); };
  $('#askYes').addEventListener('click', () => answerAsk(true));
  $('#askNo').addEventListener('click', () => answerAsk(false));

  // ================================================================ text layout lock
  // When locked, the text area keeps a fixed width (note.wrapWidth) so text and pictures never
  // re-wrap; a narrower note shows a sideways scrollbar instead. Drawing turns it on by itself,
  // so circles and arrows stay on what they marked.
  const sheet = $('#sheet');
  const hasInk = () => !!(note && note.ink && note.ink.s && note.ink.s.length);
  // How wide the visible writing area is. With the layout locked, pictures without "Keep size"
  // still shrink to this (note.css: --viewW), so a narrower note doesn't cut them off.
  const scroller = $('#scroller');
  function updateViewWidth() {
    const cs = getComputedStyle(scroller);
    const w = scroller.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    sheet.style.setProperty('--viewW', `${Math.max(0, Math.floor(w))}px`);
  }
  new ResizeObserver(() => { updateViewWidth(); placeHandle(); }).observe(scroller);
  function applyLayout() {
    if (!note) return;
    sheet.style.width = note.wrapWidth ? `${note.wrapWidth}px` : '';
    sheet.classList.toggle('fixed', !!note.wrapWidth);
    sheet.classList.toggle('inked', hasInk());
    updateViewWidth();
    const b = inkBounds();
    sheet.style.minWidth = b ? `${Math.ceil(b.x2 + 6)}px` : '';
    sheet.style.minHeight = b ? `max(100%, ${Math.ceil(b.y2 + 6)}px)` : '';
    const w = $('#btnWrap');
    w.classList.toggle('on', !!note.wrapWidth);
    w.title = note.wrapWidth
      ? 'Text layout is locked: text and pictures keep their width, and a sideways scrollbar appears when the note is narrower. Click to let the text wrap with the note again.'
      : 'Text wraps with the note. Click to lock the layout, so text and pictures keep their width (drawing does this by itself).';
  }
  async function toggleWrap() {
    if (note.wrapWidth) {
      if (hasInk() && !(await ask('Unlock the text layout?', 'Your drawing stays where it is, but the text and pictures may move away from it when the note is resized.', 'Unlock'))) return;
      setProp({ wrapWidth: null });
      toast('Text wraps with the note again');
    } else {
      setProp({ wrapWidth: Math.round(editor.clientWidth) });
      toast('Text layout locked 🔒');
    }
  }
  $('#btnWrap').addEventListener('mousedown', (e) => e.preventDefault());
  $('#btnWrap').addEventListener('click', toggleWrap);

  // resizing a picture under a drawing can move things away from it: warn once per window
  let resizeOk = false;
  const needsResizeWarning = () => hasInk() && !resizeOk;
  async function resizeWarning(then) {
    const ok = await ask('Resize this picture?', 'This note has a drawing. Changing a picture’s size can move things so they no longer line up with what you drew.', 'Resize anyway');
    if (!ok) return;
    resizeOk = true;
    if (then) then(); else toast('OK, drag the corner again to resize');
  }

  // ================================================================ draw-over
  const SVGNS = 'http://www.w3.org/2000/svg';
  const INK_COLORS = ['#2B2B2B', '#E5484D', '#F08C00', '#FFC800', '#2FA35A', '#3E7BFA', '#8E4EC6', '#E64980'];
  const HINTS = {
    pen: 'Tip: hold Shift to draw a straight line.',
    hl: 'Tip: hold Shift for a straight highlight.',
    line: 'Tip: hold Shift to snap to straight angles.',
    arrow: 'Tip: hold Shift to snap to straight angles.',
    rect: 'Tip: hold Shift for a perfect square.',
    ellipse: 'Tip: hold Shift for a perfect circle.',
    eraser: 'Whole line: click or drag over a line or shape to remove all of it.',
    rub: 'Rub out: drag over a drawing to erase only what is under the circle. Pick its size on the right.',
  };
  // eraseMode: 'part' = rub out only what's under the eraser, 'stroke' = remove whole lines.
  // ew = rub-out eraser size (same 2/4/8 steps as the thickness buttons; radius = ew * 3 px).
  const inkState = { on: false, tool: 'pen', color: '#E5484D', w: 4, layer: 'a', eraseMode: 'part', ew: 4, cur: null, el: null, undo: [], dirty: false, timer: null, erasing: false, erased: false, last: null };
  const PREF_KEYS = ['tool', 'color', 'w', 'layer', 'eraseMode', 'ew'];
  try {
    const saved = JSON.parse(localStorage.getItem('inkPrefs') || '{}');
    for (const k of PREF_KEYS) if (saved[k] != null) inkState[k] = saved[k];
  } catch { /* fine */ }
  if (inkState.eraseMode !== 'stroke') inkState.eraseMode = 'part';
  if (![2, 4, 8].includes(inkState.ew)) inkState.ew = 4;
  const savePrefs = () => { try { localStorage.setItem('inkPrefs', JSON.stringify(Object.fromEntries(PREF_KEYS.map((k) => [k, inkState[k]])))); } catch { /* fine */ } };
  const rubbing = () => inkState.tool === 'eraser' && inkState.eraseMode === 'part';
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
      el.setAttribute('d', `M${x1} ${y1}L${x2} ${y2}M${h1[0]} ${h1[1]}L${x2} ${y2}L${h2[0]} ${h2[1]}`);
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
    return el;
  }
  const layerOf = (st) => (st.l === 'b' ? $('#inkBelow') : $('#inkAbove'));
  function renderInk() {
    $('#inkBelow').innerHTML = '';
    $('#inkAbove').innerHTML = '';
    if (hasInk()) for (const st of note.ink.s) layerOf(st).append(strokeEl(st));
    applyLayout();
  }
  function inkBounds() {
    if (!hasInk()) return null;
    let x2 = 0;
    let y2 = 0;
    for (const st of note.ink.s) {
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
    $('#inkWidths').hidden = erasing && !rubbing();
    $$('#eraseMode button').forEach((b) => b.classList.toggle('on', b.dataset.m === inkState.eraseMode));
    const wNow = erasing ? inkState.ew : inkState.w;
    $$('#inkWidths button').forEach((b) => {
      b.classList.toggle('on', Number(b.dataset.w) === wNow);
      b.title = erasing ? { 2: 'Small eraser', 4: 'Medium eraser', 8: 'Big eraser' }[b.dataset.w] : { 2: 'Thin', 4: 'Medium', 8: 'Thick' }[b.dataset.w];
    });
    $$('#inkLayer button').forEach((b) => b.classList.toggle('on', b.dataset.l === inkState.layer));
    $('#inkHint').textContent = (rubbing() ? HINTS.rub : HINTS[inkState.tool]) || '';
    body.classList.toggle('erasing-ink', erasing && !rubbing());
    body.classList.toggle('rubbing-ink', rubbing());
    if (!rubbing()) $('#inkEraser').hidden = true;
    $('#inkUndo').disabled = !inkState.undo.length;
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
  })();

  function enterInk() {
    if (hidden || !note) return;
    closePops();
    hideCtx();
    saveNow();
    inkState.on = true;
    inkState.undo = [];
    body.classList.add('inking');
    editor.contentEditable = 'false';
    $('#inkCatch').hidden = false;
    $('#inkBar').hidden = false;
    handle.hidden = true;
    paintInkBar();
  }
  function exitInk() {
    inkState.on = false;
    inkState.cur = null;
    body.classList.remove('inking', 'erasing-ink', 'rubbing-ink');
    $('#inkEraser').hidden = true;
    editor.contentEditable = 'true';
    $('#inkCatch').hidden = true;
    $('#inkBar').hidden = true;
    saveInk();
  }
  $('#btnInk').addEventListener('mousedown', (e) => e.preventDefault());
  $('#btnInk').addEventListener('click', () => (inkState.on ? exitInk() : enterInk()));
  $('#inkDone').addEventListener('click', exitInk);

  function scheduleInkSave() {
    inkState.dirty = true;
    clearTimeout(inkState.timer);
    inkState.timer = setTimeout(saveInk, 300);
  }
  function saveInk() {
    clearTimeout(inkState.timer);
    if (!inkState.dirty || hidden || !note) return;
    inkState.dirty = false;
    const patch = { ink: note.ink };
    // the first drawing locks the text layout so it stays lined up with what was drawn
    if (hasInk() && !note.wrapWidth) {
      note.wrapWidth = Math.round(editor.clientWidth);
      patch.wrapWidth = note.wrapWidth;
      applyLayout();
      toast('Text layout locked, so your drawing stays in place');
    }
    api.update(patch).then(gotDates).catch(() => {});
  }
  function snapshot() {
    inkState.undo.push(JSON.stringify(note.ink || null));
    if (inkState.undo.length > 100) inkState.undo.shift();
  }
  function inkUndo() {
    if (!inkState.undo.length) return;
    note.ink = JSON.parse(inkState.undo.pop());
    renderInk();
    scheduleInkSave();
    paintInkBar();
  }
  $('#inkUndo').addEventListener('click', inkUndo);
  $('#inkClear').addEventListener('click', () => {
    if (!hasInk()) return;
    snapshot();
    note.ink = null;
    renderInk();
    scheduleInkSave();
    paintInkBar();
    toast('Drawing removed (Undo brings it back)');
  });

  const catcher = $('#inkCatch');
  const inkPt = (e) => { const r = sheet.getBoundingClientRect(); return [r1(e.clientX - r.left), r1(e.clientY - r.top)]; };
  function shapeEnd(x1, y1, x, y, t, shift) {
    if (!shift) return [x, y];
    const dx = x - x1;
    const dy = y - y1;
    if (t === 'rect' || t === 'ellipse') {
      const d = Math.max(Math.abs(dx), Math.abs(dy));
      return [r1(x1 + Math.sign(dx || 1) * d), r1(y1 + Math.sign(dy || 1) * d)];
    }
    const step = Math.PI / 4;
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
    const list = note.ink.s;
    for (let i = list.length - 1; i >= 0; i--) {
      const st = list[i];
      const reach = (st.t === 'hl' ? st.w * 2 : st.w / 2) + 6;
      const pts = samplePoints(st);
      for (let k = 0; k < pts.length; k += 2) {
        if (Math.hypot(pts[k] - x, pts[k + 1] - y) <= reach) {
          list.splice(i, 1);
          if (!list.length) note.ink = null;
          inkState.erased = true;
          renderInk();
          return;
        }
      }
    }
  }

  // ---- rub-out eraser: erase only what's under the circle
  // A touched line or shape is traced into closely spaced points along what's actually drawn
  // (via the SVG geometry), the points under the eraser are dropped, and each piece that's left
  // becomes its own pen stroke (or highlighter stroke) with the same colour, thickness and layer.
  const STEP = 2;
  let measureSvg = null;
  function tracePieces(st) {
    if (!measureSvg) {
      measureSvg = document.createElementNS(SVGNS, 'svg');
      measureSvg.setAttribute('style', 'position:absolute;left:-9999px;top:0;width:1px;height:1px;visibility:hidden');
      document.body.append(measureSvg);
    }
    const el = strokeEl(st);
    measureSvg.append(el);
    const total = el.getTotalLength();
    const pieces = [];
    let cur = [];
    const n = Math.max(1, Math.ceil(total / STEP));
    let px = null;
    let py = null;
    for (let i = 0; i <= n; i++) {
      const pt = el.getPointAtLength((total * i) / n);
      // an arrow's head is a separate part of the path: a jump means a new piece
      if (px != null && Math.hypot(pt.x - px, pt.y - py) > STEP * 3) { pieces.push(cur); cur = []; }
      cur.push(r1(pt.x), r1(pt.y));
      px = pt.x;
      py = pt.y;
    }
    pieces.push(cur);
    el.remove();
    return pieces;
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
  function rubOut(a, b) {
    if (!hasInk()) return;
    const R = eraserR();
    const minX = Math.min(a[0], b[0]) - R; const maxX = Math.max(a[0], b[0]) + R;
    const minY = Math.min(a[1], b[1]) - R; const maxY = Math.max(a[1], b[1]) + R;
    const out = [];
    let changedAny = false;
    for (const st of note.ink.s) {
      const half = st.t === 'hl' ? st.w * 2 : st.w / 2;
      const reach = R + half; // the gap matches the circle, round line ends included
      const margin = reach + (st.t === 'arrow' ? 30 + st.w * 2 : 0);
      let x1 = Infinity; let y1 = Infinity; let x2 = -Infinity; let y2 = -Infinity;
      for (let i = 0; i < st.p.length; i += 2) { x1 = Math.min(x1, st.p[i]); x2 = Math.max(x2, st.p[i]); y1 = Math.min(y1, st.p[i + 1]); y2 = Math.max(y2, st.p[i + 1]); }
      if (x2 + margin < minX - R || x1 - margin > maxX + R || y2 + margin < minY - R || y1 - margin > maxY + R) { out.push(st); continue; }
      const hit = (x, y) => distToSeg(x, y, a[0], a[1], b[0], b[1]) <= reach;
      // shapes are traced first; pen lines are checked segment by segment before tracing
      const pieces = st.t === 'pen' || st.t === 'hl' ? null : tracePieces(st);
      let touched = false;
      if (pieces) touched = pieces.some((pc) => { for (let i = 0; i < pc.length; i += 2) if (hit(pc[i], pc[i + 1])) return true; return false; });
      else if (st.p.length === 2) touched = hit(st.p[0], st.p[1]);
      else for (let i = 0; i + 3 < st.p.length && !touched; i += 2) touched = segDist(a, b, st.p[i], st.p[i + 1], st.p[i + 2], st.p[i + 3]) <= reach;
      if (!touched) { out.push(st); continue; }
      const traced = pieces || (st.p.length === 2 ? [st.p.slice()] : tracePieces(st));
      const closed = st.t === 'rect' || st.t === 'ellipse';
      let any = false;
      for (let pc of traced) {
        if (closed) {
          // start the loop at an erased spot, so the piece that's left stays in one piece
          let k = -1;
          for (let i = 0; i < pc.length; i += 2) if (hit(pc[i], pc[i + 1])) { k = i; break; }
          if (k > 0) pc = pc.slice(k).concat(pc.slice(0, k));
        }
        let run = [];
        const flush = () => {
          if (run.length >= 4) out.push({ t: st.t === 'hl' ? 'hl' : 'pen', c: st.c, w: st.w, l: st.l, p: run });
          run = [];
        };
        for (let i = 0; i < pc.length; i += 2) {
          if (hit(pc[i], pc[i + 1])) { any = true; flush(); } else run.push(pc[i], pc[i + 1]);
        }
        flush();
      }
      if (!any) { out.push(st); continue; }
      changedAny = true;
    }
    if (!changedAny) return;
    note.ink = out.length ? { s: out.slice(-4000) } : null;
    inkState.erased = true;
    renderInk();
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
    inkState.cur = { t, c: inkState.color, w: inkState.w, l: inkState.layer, p: [x, y, x, y] };
    if (t === 'pen' || t === 'hl') inkState.cur.p = [x, y];
    inkState.el = strokeEl(inkState.cur);
    layerOf(inkState.cur).append(inkState.el);
  });
  catcher.addEventListener('pointermove', (e) => {
    moveEraserRing(e);
    if (inkState.erasing) {
      const pt = inkPt(e);
      if (rubbing()) rubOut(inkState.last || pt, pt); else eraseAt(pt);
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
      inkState.erasing = false;
      inkState.last = null;
      if (inkState.erased) scheduleInkSave(); else inkState.undo.pop();
      paintInkBar();
      return;
    }
    const st = inkState.cur;
    if (!st) return;
    inkState.cur = null;
    const tiny = st.t !== 'pen' && st.t !== 'hl' && Math.hypot(st.p[2] - st.p[0], st.p[3] - st.p[1]) < 3;
    if (tiny) { inkState.el.remove(); return; }
    snapshot();
    if (!note.ink) note.ink = { s: [] };
    note.ink.s.push(st);
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
    note = await api.getNote();
    if (!note) return;
    if (note.settings) settings = { ...settings, ...note.settings };
    hidden = !!note.hidden;
    editor.innerHTML = hidden ? '' : (note.html || '');
    applyLook();
    renderInk();
    updateEmpty();
    observer.observe(editor, { childList: true, subtree: true, characterData: true });
    if (hidden) {
      if (note.focusEditor) $('#unlockPw').focus();
    } else if (note.focusEditor) {
      editor.focus();
      caretAtEnd();
    }
  })();
})();
