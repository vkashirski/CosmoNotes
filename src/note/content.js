'use strict';
// CosmoNotes note window, part 4 of 15: links, picture descriptions, tables, photos (paste / drop), clicks inside the note
// (src/note.js until 1.1.44; the parts load in order from note.html. How they share names: ai-context/splitting-code.md)
(() => {
  const K = window.COSMO_NOTE_KIT;
  const { V, api, $, editor, esc, changed, closestIn, saveSel, caretAtEnd, restoreSel, insertHTML, insertNodes,
    closePop, openPop, FACE, domStep } = K;
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
      domStep(() => { editingLink.setAttribute('href', url); editingLink.textContent = text; }); // one Undo step (1.3.32)
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
      const img = descImg;
      domStep(() => { if (v) { img.setAttribute('alt', v); img.setAttribute('title', v); } else { img.removeAttribute('alt'); img.removeAttribute('title'); } });
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
    // one Undo step (1.3.32): Undo gives back the same text, so the editor's Undo of the typing still works (it broke the text)
    const done = domStep(() => {
      try { r.surroundContents(a); } catch { return false; }
      const after = document.createRange();
      const trailing = raw.length - url.length;
      if (trailing && a.nextSibling && a.nextSibling.nodeType === 3) after.setStart(a.nextSibling, trailing);
      else after.setStartAfter(a);
      after.collapse(true);
      s.removeAllRanges();
      s.addRange(after);
      return true;
    });
    if (done) changed();
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
  function tableOp(cell, op) { // one Undo step (1.3.32)
    domStep(() => tableChange(cell, op));
    changed();
  }
  function tableChange(cell, op) {
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
  // rich = text copied from a note (1.3.2, see "copy / cut" below): its formatting may come too, but only the kinds the
  // note itself makes: <font> face (the app's fonts) / colour / size, a highlight or colour style, checklist boxes.
  const COLOR = /^(#[0-9a-f]{3,8}|rgba?\([\d.,\s%]+\)|transparent)$/i;
  const RICH = { FONT: ['face', 'color', 'size'], SPAN: ['style'], UL: ['class'], LI: ['class'] };
  function richAttrs(ch, tag) {
    const face = ch.getAttribute('face');
    if (face !== null && !Object.values(FACE).includes(face)) ch.removeAttribute('face');
    if (ch.hasAttribute('color') && !COLOR.test(ch.getAttribute('color').trim())) ch.removeAttribute('color');
    if (ch.hasAttribute('size') && !/^[1-7]$/.test(ch.getAttribute('size').trim())) ch.removeAttribute('size');
    if (tag === 'SPAN' && ch.hasAttribute('style')) {
      const s = ch.style; const keep = [];
      for (const p of ['color', 'background-color']) { const v = s.getPropertyValue(p).trim(); if (v && COLOR.test(v)) keep.push(`${p}: ${v}`); }
      if (keep.length) ch.setAttribute('style', keep.join('; ')); else ch.removeAttribute('style');
    }
    if (tag === 'UL' || tag === 'LI') {
      const ok = tag === 'UL' ? 'checklist' : 'done';
      if (ch.classList.contains(ok)) ch.className = ok; else ch.removeAttribute('class');
    }
  }
  function cleanTree(el, rich) {
    for (const ch of [...el.childNodes]) {
      if (ch.nodeType === 3) continue;
      if (ch.nodeType !== 1) { ch.remove(); continue; }
      const tag = ch.tagName;
      if (DROP.has(tag)) { ch.remove(); continue; }
      const allow = rich && RICH[tag] ? [...(ALLOWED[tag] || []), ...RICH[tag]] : ALLOWED[tag];
      if (!allow) { cleanTree(ch, rich); ch.replaceWith(...ch.childNodes); continue; }
      for (const a of [...ch.attributes]) if (!allow.includes(a.name)) ch.removeAttribute(a.name);
      if (rich && RICH[tag]) richAttrs(ch, tag);
      if (tag === 'A' && !/^(https?:|mailto:)/i.test(ch.getAttribute('href') || '')) ch.removeAttribute('href');
      if (tag === 'IMG') {
        if (!/^(https?:|data:image\/|stickyfile:)/i.test(ch.getAttribute('src') || '')) { ch.remove(); continue; }
        ch.className = 'att-img';
      }
      cleanTree(ch, rich);
      if (tag === 'FONT' && !ch.attributes.length) ch.replaceWith(...ch.childNodes);
    }
  }
  function sanitize(html, rich) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    cleanTree(doc.body, rich);
    dropEmptyLines(doc.body, 'li');
    joinLists(doc.body);
    return doc.body.innerHTML;
  }
  // 1.3.15: a list line with nothing in it at all (no letters, line break, photo…) is zero lines high, so in a checklist
  // its box sat on top of the next line's box. Copying a whole line (triple-click) took the start of the next line along
  // as one. Copied and pasted HTML loses them; the note drops the checklist ones when it opens and after a paste (they
  // hold nothing). The line with the caret in it stays.
  function dropEmptyLines(root, sel) {
    const s = root === editor ? getSelection() : null;
    for (const li of [...root.querySelectorAll(sel)].reverse()) {
      if (/[^\n\r\t\u200b]/.test(li.textContent) || li.querySelector('br,img,hr,table,li,.voice,[contenteditable="false"]')) continue;
      if (s && s.rangeCount && li.contains(s.anchorNode)) continue;
      const list = li.parentElement;
      li.remove();
      if (list && /^(UL|OL)$/.test(list.nodeName) && !list.children.length && !/[^\s\u200b]/.test(list.textContent)) list.remove();
    }
  }

  // 1.3.25: two lists of the same kind that touch (the line between them deleted, or pasted next to each other) look
  // like one list, so they are one group: ticked lines to the bottom and dragging use listGroup (checklists part). The
  // note keeps them as the editor made them while it is open (the editor's own Undo / Redo remembers them that way);
  // what is saved has them joined (collect, base part), and so has a pasted piece and a note as it opens.
  const LIST_KIND = (x) => (x && x.nodeType === 1 && /^(UL|OL)$/.test(x.nodeName) ? x.nodeName + (x.classList.contains('checklist') ? '.c' : '') : null);
  // between two lists, nothing that shows: spaces, or a block with nothing in it at all (1.3.26: an empty <div> the
  // editor left behind is zero lines high, a 1 px line no one can see or click, and kept the lists apart)
  const NOTHING = /^(DIV|P|SPAN|FONT|B|I|U|S|STRIKE|EM|STRONG)$/;
  const blank = (x) => !!x && (x.nodeType === 3 ? !/[^\s\u200b]/.test(x.data)
    : x.nodeType === 1 && NOTHING.test(x.nodeName) && !/[^\s\u200b]/.test(x.textContent) && !x.querySelector('br,img,hr,table,li,video,audio,.voice,[contenteditable="false"]'));
  function touching(a, dir) { // the list right after (dir 'nextSibling') or before a, with only spaces between
    let b = a[dir];
    while (blank(b)) b = b[dir];
    return b && LIST_KIND(b) === LIST_KIND(a) ? b : null;
  }
  function listGroup(list) {
    let first = list;
    for (let p = touching(first, 'previousSibling'); p; p = touching(first, 'previousSibling')) first = p;
    const out = [first];
    for (let n = touching(first, 'nextSibling'); n; n = touching(n, 'nextSibling')) out.push(n);
    return out;
  }
  // join in place: the second list's lines go into the first (not for the note while it is open: see above)
  function joinLists(root) {
    for (const a of [...root.querySelectorAll('ul, ol')].reverse()) { // from the last: a list joined into is already whole
      const b = touching(a, 'nextSibling');
      if (!b) continue;
      while (blank(a.nextSibling)) a.nextSibling.remove();
      a.append(...b.childNodes);
      b.remove();
    }
  }


  // ================================================================ copy / cut (1.3.2)
  // The note writes the clipboard itself: the words keep their font, size, colour, highlight, bold… and a checklist line
  // stays a checklist line (ticked or not), even when only part of one line is selected. The note's own font goes with
  // the words when it isn't the pasting note's font. CLIP holds it for CosmoNotes; text/html is the same for other apps.
  const CLIP = 'application/x-cosmonotes';
  const INLINE = new Set(['B', 'STRONG', 'I', 'EM', 'U', 'S', 'STRIKE', 'DEL', 'MARK', 'SUB', 'SUP', 'CODE', 'FONT', 'SPAN', 'A']);
  function copiedHtml(r) {
    let box = document.createElement('div');
    box.append(r.cloneContents());
    const c = r.commonAncestorContainer;
    // the selection's own formatting and its list line sit above it (cloneContents only copies what is inside)
    for (let a = c.nodeType === 1 ? c : c.parentElement; a && a !== editor && editor.contains(a); a = a.parentElement) {
      const tag = a.tagName;
      if (tag === 'TD' || tag === 'TH') break;
      if (!INLINE.has(tag) && tag !== 'LI' && tag !== 'UL' && tag !== 'OL') continue;
      const w = a.cloneNode(false);
      w.append(...box.childNodes);
      box = document.createElement('div');
      box.append(w);
      if (tag === 'UL' || tag === 'OL') break; // the nearest list only
      if (tag === 'LI' && a.parentElement) { const l = a.parentElement.cloneNode(false); l.append(...box.childNodes); box.append(l); break; }
    }
    return box.innerHTML;
  }
  // every piece of text without a font of its own gets the note's font
  function withFace(html, face) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const tw = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
    const bare = [];
    for (let n = tw.nextNode(); n; n = tw.nextNode()) if (n.data.trim() && !(n.parentElement && n.parentElement.closest('font[face]'))) bare.push(n);
    for (const n of bare) { const f = doc.createElement('font'); f.setAttribute('face', face); n.replaceWith(f); f.append(n); }
    return doc.body.innerHTML;
  }
  function onCopy(e, cut) {
    const s = getSelection();
    if (!e.clipboardData || !s.rangeCount || s.isCollapsed) return;
    const r = s.getRangeAt(0);
    if (!editor.contains(r.commonAncestorContainer)) return;
    const html = sanitize(copiedHtml(r), true);
    e.preventDefault();
    e.clipboardData.setData('text/plain', s.toString());
    e.clipboardData.setData('text/html', withFace(html, FACE[V.note.font] || 'Caveat'));
    e.clipboardData.setData(CLIP, JSON.stringify({ html, font: V.note.font }));
    if (cut) { document.execCommand('delete'); changed(); }
  }
  editor.addEventListener('copy', (e) => onCopy(e, false));
  editor.addEventListener('cut', (e) => onCopy(e, true));
  function richPaste(raw) {
    let c;
    try { c = JSON.parse(raw); } catch { return null; }
    if (!c || typeof c.html !== 'string') return null;
    const html = sanitize(c.html, true);
    return c.font && c.font !== V.note.font && FACE[c.font] ? sanitize(withFace(html, FACE[c.font]), true) : html;
  }

  // 1.4.4: another app's HTML pasted into a list line (a checklist too): each of its lines becomes a line of that list, at
  // that level. Pasted as it came, a list with a paragraph or a wrapper around it (a chat, a web page) went inside the line
  // as a list of its own: boxes inside a box. Its own nesting and numbering go (the lines join the list you paste into);
  // one line pastes into the line itself. A copy from a note (CLIP) keeps its lists as they were.
  const LINE_BLOCK = /^(P|DIV|LI|UL|OL|H[1-4]|BLOCKQUOTE|PRE)$/;
  function inListLine() {
    const s = getSelection();
    const n = s.rangeCount ? s.getRangeAt(0).startContainer : null;
    const el = n && (n.nodeType === 1 ? n : n.parentElement);
    const li = el && el.closest('li');
    return !!li && editor.contains(li) && !el.closest('td,th');
  }
  function asListLines(html) {
    const box = document.createElement('div');
    box.innerHTML = html;
    const lines = [];
    let cur = null;
    const walk = (node) => {
      for (const ch of [...node.childNodes]) {
        if (ch.nodeType === 1 && LINE_BLOCK.test(ch.nodeName)) { cur = null; walk(ch); cur = null; continue; }
        if (!cur) { cur = document.createElement('li'); lines.push(cur); }
        cur.append(ch);
      }
    };
    walk(box);
    const real = lines.filter((li) => /[^\s​]/.test(li.textContent) || li.querySelector('br,img,hr,table'));
    for (const li of real) { // spaces left at either end by the blocks it came out of
      if (li.firstChild && li.firstChild.nodeType === 3) li.firstChild.data = li.firstChild.data.replace(/^\s+/, '');
      if (li.lastChild && li.lastChild.nodeType === 3) li.lastChild.data = li.lastChild.data.replace(/\s+$/, '');
    }
    if (!real.length) return html;
    if (real.length === 1) return real[0].innerHTML;
    return '<ul>' + real.map((li) => li.outerHTML).join('') + '</ul>';
  }

  V.plainPaste = false;
  editor.addEventListener('paste', (e) => {
    const cd = e.clipboardData;
    if (!cd) return;
    const files = [...cd.items].filter((i) => i.kind === 'file' && IMG_EXT[i.type]).map((i) => i.getAsFile()).filter(Boolean);
    if (files.length) { e.preventDefault(); saveSel(); insertImageFiles(files); return; }
    const html = cd.getData('text/html');
    const text = cd.getData('text/plain');
    const rich = !V.plainPaste && cd.getData(CLIP) ? richPaste(cd.getData(CLIP)) : null;
    e.preventDefault();
    const t = (text || '').trim();
    if (rich) {
      document.execCommand('insertHTML', false, rich);
    } else if (/^(https?:\/\/|www\.)\S+$/i.test(t)) {
      const href = t.toLowerCase().startsWith('www.') ? 'https://' + t : t;
      document.execCommand('insertHTML', false, `<a href="${esc(href)}">${esc(t)}</a>&nbsp;`);
    } else if (html && !V.plainPaste) {
      document.execCommand('insertHTML', false, inListLine() ? asListLines(sanitize(html)) : sanitize(html));
    } else if (text) {
      document.execCommand('insertText', false, text);
    }
    V.plainPaste = false;
    dropEmptyLines(editor, 'ul.checklist li');
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
    }
    // a checklist line's box (click to tick, drag to move): the checklists part
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
  // 1.4.3: this page may not read a saved or web photo itself (another origin: fetch() fails, the canvas is locked), so
  // main reads it and puts the PNG on the clipboard (main/ipc-files.js att:image, clip:image).
  async function copyPhoto(img) {
    const src = img.getAttribute('src') || '';
    try {
      let pic = img; // a data: picture is this page's own
      if (!/^data:image\//i.test(src)) {
        const bytes = await api.photoBytes(src);
        if (!bytes) throw new Error('no picture');
        pic = await createImageBitmap(new Blob([bytes]));
      } else await img.decode();
      const c = document.createElement('canvas'); c.width = pic.naturalWidth || pic.width; c.height = pic.naturalHeight || pic.height;
      c.getContext('2d').drawImage(pic, 0, 0);
      const blob = await new Promise((ok, no) => c.toBlob((b) => (b ? ok(b) : no(new Error('no image'))), 'image/png'));
      if (!(await api.copyImage(new Uint8Array(await blob.arrayBuffer())))) throw new Error('not copied');
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

  Object.assign(K, { openLinkForm, openDesc, autoLink, insertTable, tableOp, moveCell, copyPhoto, openPhoto, dropEmptyLines, joinLists, listGroup });
})();
