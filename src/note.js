'use strict';
(() => {
  const api = window.sticky;
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => [...document.querySelectorAll(s)];
  const editor = $('#editor');
  const body = document.body;

  let note = null;
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
    dirty = true;
    updateEmpty();
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveNow, 350);
  }

  function saveNow() {
    clearTimeout(saveTimer);
    if (!dirty || !note) return;
    dirty = false;
    const data = collect();
    note.text = data.text;
    $('#title').textContent = titleText();
    api.update(data);
  }

  window.addEventListener('beforeunload', () => {
    if (dirty && note) { dirty = false; api.updateSync(collect()); }
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
    const line = (note && note.text ? note.text : editor.innerText).split('\n').map((s) => s.trim()).find(Boolean);
    return line || 'Sticky note';
  }

  // ================================================================ look & settings
  function applyLook() {
    body.dataset.color = note.color;
    body.dataset.font = note.font;
    body.dataset.size = note.size;
    body.classList.toggle('rolled', !!note.rolled);
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
    return api.update(patch);
  }

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
    $$('#editor .sel-img').forEach((i) => {
      const s = getSelection();
      if (!s.rangeCount || !s.getRangeAt(0).intersectsNode(i) || s.isCollapsed) i.classList.remove('sel-img');
    });
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
    if (!e.target.closest('.pop, #btnMenu, #btnInsert')) closePops();
    if (!e.target.closest('.ctx')) hideCtx();
  });
  // Buttons inside popovers should not steal the text selection.
  $$('.pop button, .ctx').forEach((b) => b.addEventListener('mousedown', (e) => e.preventDefault()));

  // ---------- header
  $('#btnNew').addEventListener('click', () => { saveNow(); api.newNote(); });
  $('#btnClose').addEventListener('click', () => { saveNow(); api.close(); });
  $('#btnPin').addEventListener('click', () => setProp({ pinned: !note.pinned }));
  $('#btnMenu').addEventListener('click', () => togglePop('#menu'));
  $('#btnUnroll').addEventListener('click', () => setProp({ rolled: false }));
  $('#btnInsert').addEventListener('mousedown', (e) => e.preventDefault());
  $('#btnInsert').addEventListener('click', () => togglePop('#insert'));

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
  $('#miRoll').addEventListener('click', () => { closePops(); saveNow(); setProp({ rolled: true }); });
  $('#miList').addEventListener('click', () => { closePops(); api.showList(); });
  $('#miDelete').addEventListener('click', () => { closePops(); saveNow(); api.trash(); });

  // see-through notes turn solid while the mouse is over them
  document.documentElement.addEventListener('mouseenter', () => api.hover(true));
  document.documentElement.addEventListener('mouseleave', () => api.hover(false));

  // ---------- Add panel
  $$('#insert [data-act]').forEach((b) => b.addEventListener('click', () => doInsert(b.dataset.act)));
  $$('#insert [data-fore]').forEach((b) => b.addEventListener('click', () => {
    restoreSel();
    if (b.dataset.fore === 'inherit') document.execCommand('removeFormat');
    else document.execCommand('foreColor', false, b.dataset.fore);
    changed();
  }));
  $$('#insert [data-hilite]').forEach((b) => b.addEventListener('click', () => {
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
    if (img) {
      const r = document.createRange();
      r.selectNode(img);
      const s = getSelection();
      s.removeAllRanges();
      s.addRange(r);
      img.classList.add('sel-img');
      return;
    }
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
      if (!$('#draw').hidden) closeDraw();
      else if (!$('#recbar').hidden) stopRecording(false);
      closePops();
      hideCtx();
    }
    if (mod && e.key.toLowerCase() === 'n') { e.preventDefault(); saveNow(); api.newNote(); }
    if (mod && e.key.toLowerCase() === 'w') { e.preventDefault(); saveNow(); api.close(); }
    if (mod && e.key.toLowerCase() === 'z' && !$('#draw').hidden) { e.preventDefault(); drawUndo(); }
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
      items = drawing
        ? [{ label: 'Edit drawing', run: () => openDraw(img) }]
        : [
          { label: 'Open full size', run: () => openPhoto(img) },
          '-',
          { label: 'Small', run: () => { img.classList.remove('w-m'); img.classList.add('w-s'); changed(); } },
          { label: 'Medium', run: () => { img.classList.remove('w-s'); img.classList.add('w-m'); changed(); } },
          { label: 'Full width', run: () => { img.classList.remove('w-s', 'w-m'); changed(); } },
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
    editor.innerHTML = note.html || '';
    applyLook();
    updateEmpty();
    observer.observe(editor, { childList: true, subtree: true, characterData: true });
    if (note.focusEditor) {
      editor.focus();
      caretAtEnd();
    }
  })();
})();
