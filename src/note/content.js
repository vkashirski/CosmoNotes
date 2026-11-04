'use strict';
// CosmoNotes note window, part 4 of 11: links, picture descriptions, tables, photos (paste / drop), clicks inside the note
// (src/note.js until 1.1.44; the parts load in order from note.html. How they share names: ai-context/splitting-code.md)
(() => {
  const K = window.COSMO_NOTE_KIT;
  const { V, api, $, editor, esc, changed, closestIn, saveSel, caretAtEnd, restoreSel, insertHTML, insertNodes,
    closePop, openPop } = K;
  // defined in a later part:
  const togglePlay = K.later('togglePlay'), openDraw = K.later('openDraw'), selectImage = K.later('selectImage'),
    toast = K.later('toast');
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
  $('#linkCancel').addEventListener('click', () => { closePop('#linkPop'); restoreSel(); });
  $('#linkPop').addEventListener('submit', (e) => {
    e.preventDefault();
    const url = normUrl($('#linkUrl').value);
    if (!url) { $('#linkUrl').focus(); return; }
    const text = $('#linkText').value.trim() || $('#linkUrl').value.trim();
    closePop('#linkPop');
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

  // 1.1.23: a picture's description (its alt text): never shown in the note, but Ctrl+F and the notes list's search find
  // the picture by it, and it shows as a tooltip when you point at the picture
  let descImg = null;
  function openDesc(img) {
    descImg = img;
    $('#descTitle').textContent = img.getAttribute('alt') ? 'Picture description' : 'Describe this picture';
    $('#descText').value = img.getAttribute('alt') || '';
    openPop('#descPop');
    setTimeout(() => { $('#descText').focus(); $('#descText').select(); }, 20);
  }
  $('#descCancel').addEventListener('click', () => { closePop('#descPop'); descImg = null; });
  $('#descText').addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); $('#descPop').requestSubmit(); } });
  $('#descPop').addEventListener('submit', (e) => {
    e.preventDefault();
    const v = $('#descText').value.replace(/\s+/g, ' ').trim().slice(0, 500);
    closePop('#descPop');
    if (descImg && editor.contains(descImg)) {
      const had = !!descImg.getAttribute('alt');
      if (v) { descImg.setAttribute('alt', v); descImg.setAttribute('title', v); } else { descImg.removeAttribute('alt'); descImg.removeAttribute('title'); }
      changed();
      if (v || had) toast(v ? 'Description saved' : 'Description removed');
    }
    descImg = null;
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
    A: ['href'], UL: [], OL: [], LI: [], BR: [], P: [], DIV: [], SPAN: [], IMG: ['src', 'alt', 'title'], HR: [], BLOCKQUOTE: [],
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

  V.plainPaste = false;
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
    } else if (html && !V.plainPaste) {
      document.execCommand('insertHTML', false, sanitize(html));
    } else if (text) {
      document.execCommand('insertText', false, text);
    }
    V.plainPaste = false;
    changed();
  });

  editor.addEventListener('dragover', (e) => { if ([...e.dataTransfer.types].includes('Files')) e.preventDefault(); });
  editor.addEventListener('drop', (e) => {
    const files = [...(e.dataTransfer.files || [])].filter((f) => IMG_EXT[f.type]);
    if (!files.length) return;
    e.preventDefault();
    const r = document.caretRangeFromPoint(e.clientX, e.clientY);
    if (r && editor.contains(r.startContainer)) { V.savedRange = r; }
    insertImageFiles(files);
  });
  // Never let a dropped file replace the whole note page.
  window.addEventListener('dragover', (e) => e.preventDefault());
  window.addEventListener('drop', (e) => e.preventDefault());

  // ================================================================ clicks inside the note
  // The left edge of a photo (its white frame, EDGE px) counts as "just before the photo": the caret goes
  // there instead of selecting the photo, so it's easy to type in front of it.
  const EDGE = 7;
  let edgeDown = false;
  function caretAt(node, after) {
    const r = document.createRange();
    if (after) r.setStartAfter(node); else r.setStartBefore(node);
    r.collapse(true);
    const s = getSelection();
    s.removeAllRanges();
    s.addRange(r);
  }
  editor.addEventListener('mousedown', (e) => {
    edgeDown = false;
    const pic = e.button === 0 && !e.shiftKey && ((e.target.closest && e.target.closest('img.att-img'))
      || [...editor.querySelectorAll('img.att-img.caret-near')].find((i) => { const r = i.getBoundingClientRect(); return e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom; }));
    if (pic && e.clientX < pic.getBoundingClientRect().left + EDGE) {
      e.preventDefault();
      edgeDown = true;
      editor.focus();
      caretAt(pic, false);
      return;
    }
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
    if (img && edgeDown) return; // clicked the photo's left edge: the caret is already in front of it
    if (img) { selectImage(img); return; }
    const a = e.target.closest('a[href]');
    if (a && getSelection().isCollapsed && !e.shiftKey) {
      e.preventDefault();
      api.openExternal(a.getAttribute('href'));
    }
  });
  editor.addEventListener('dblclick', (e) => {
    const img = e.target.closest('img');
    if (!img || edgeDown) return;
    if (img.classList.contains('att-drawing')) openDraw(img);
    else openPhoto(img);
  });
  // 1.1.22 (sixth round): right-click a photo → Copy image (as a PNG, so it pastes anywhere: chats, Paint, Word…)
  async function copyPhoto(img) {
    const src = img.getAttribute('src') || '';
    try {
      // a saved photo is read straight from its file (drawing the <img> itself onto a canvas isn't allowed for it)
      const pic = src.startsWith('stickyfile:') ? await createImageBitmap(await (await fetch(src)).blob()) : (await img.decode().catch(() => {}), img);
      const c = document.createElement('canvas'); c.width = pic.naturalWidth || pic.width; c.height = pic.naturalHeight || pic.height;
      c.getContext('2d').drawImage(pic, 0, 0);
      const blob = await new Promise((ok, no) => c.toBlob((b) => (b ? ok(b) : no(new Error('no image'))), 'image/png'));
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      toast('Picture copied');
    } catch { toast('Couldn’t copy this picture'); }
  }
  function openPhoto(img) {
    const src = img.getAttribute('src') || '';
    if (src.startsWith('stickyfile:')) api.openAttachment(src);
    else if (/^https?:/i.test(src)) api.openExternal(src);
  }
  // Clicking the note's margin left or right of a line puts the caret at the start / end of that line
  // (just before / after a photo). Clicking empty space below the text puts the caret at the end.
  $('#scroller').addEventListener('mousedown', (e) => {
    if (e.target.id !== 'scroller') return;
    e.preventDefault();
    editor.focus();
    const er = editor.getBoundingClientRect();
    const y = e.clientY;
    if (y >= er.top && y <= er.bottom && (e.clientX < er.left || e.clientX > er.right) && besideLine(e.clientX < er.left, y, er)) return;
    caretAtEnd();
  });
  function besideLine(left, y, er) {
    // a picture on that line: just before / after it
    let pick = null;
    for (const img of editor.querySelectorAll('img')) {
      const r = img.getBoundingClientRect();
      if (y < r.top || y > r.bottom) continue;
      if (!pick || (left ? r.left < pick.r.left : r.right > pick.r.right)) pick = { img, r };
    }
    if (pick) { caretAt(pick.img, !left); return true; }
    // text: where the line starts / ends
    const x = left ? er.left + 1 : Math.min(er.right, $('#scroller').getBoundingClientRect().right) - 1;
    const r = document.caretRangeFromPoint && document.caretRangeFromPoint(x, y);
    if (!r || !editor.contains(r.startContainer)) return false;
    const s = getSelection();
    s.removeAllRanges();
    s.addRange(r);
    return true;
  }

  // Photos are tilted a little, and a tilted photo is drawn on top of the blinking caret next to it.
  // While the caret is right before or after a photo, the photo goes one layer down (.caret-near,
  // note.css) so the caret shows on its edge. It comes back up as soon as the mouse is over it, so it
  // can still be clicked (a photo inside a paragraph can't be clicked while it's a layer down).
  let mouseX = -1;
  let mouseY = -1;
  // (the photo's left edge doesn't count: clicking there puts the caret in front of it anyway)
  const overImg = (img) => { const r = img.getBoundingClientRect(); return mouseX >= r.left + EDGE && mouseX <= r.right && mouseY >= r.top && mouseY <= r.bottom; };
  function imgsByCaret() {
    const s = getSelection();
    if (!s.rangeCount || !s.isCollapsed) return [];
    const { startContainer: n, startOffset: o } = s.getRangeAt(0);
    if (!editor.contains(n)) return [];
    const near = n.nodeType === 3
      ? [o === 0 ? n.previousSibling : null, o === n.length ? n.nextSibling : null]
      : [n.childNodes[o - 1], n.childNodes[o]];
    return near.filter((x) => x && x.nodeName === 'IMG' && !overImg(x));
  }
  document.addEventListener('selectionchange', () => {
    const near = imgsByCaret();
    editor.querySelectorAll('img.caret-near').forEach((i) => { if (!near.includes(i)) i.classList.remove('caret-near'); });
    near.forEach((i) => i.classList.add('caret-near'));
  });
  document.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
    editor.querySelectorAll('img.caret-near').forEach((i) => { if (overImg(i)) i.classList.remove('caret-near'); });
  });

  Object.assign(K, { openLinkForm, openDesc, autoLink, insertTable, tableOp, moveCell, copyPhoto, openPhoto });
})();
