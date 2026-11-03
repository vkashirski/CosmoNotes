'use strict';
// CosmoNotes "All notes" window, part 2 of 7: rendering, drag & drop, note and group cards, the group header
// (src/list.js until 1.1.28; the parts load in order from list.html. How they share names: ai-context/splitting-code.md)
(() => {
  const K = window.COSMO_LIST_KIT;
  const { V, S, $, $$, GCOLORS, THEMES, SIZES, sizeNow, themeNow, ICON, cardsTabNow, navBack, sel, h, when, full,
    plural, tilt, live, groupById, childGroups, chainOf, subtreeIds, notesInTree, isInside, noteIsLocked,
    groupIsLocked, lockedOnes, favourites, sortItems } = K;
  // defined in a later part:
  const selItems = K.later('selItems'), starBtn = K.later('starBtn'), lockBtn = K.later('lockBtn'),
    pickCard = K.later('pickCard'), clearSel = K.later('clearSel'), paintCards = K.later('paintCards'),
    paintBulk = K.later('paintBulk'), bulkMenu = K.later('bulkMenu'), renderBin = K.later('renderBin'),
    renderSettings = K.later('renderSettings'), hideCtx = K.later('hideCtx'), noteMenu = K.later('noteMenu'),
    groupMenu = K.later('groupMenu'), paintFxPause = K.later('paintFxPause'), trashNote = K.later('trashNote'),
    paintLockBar = K.later('paintLockBar'), openGroupView = K.later('openGroupView'),
    closePanel = K.later('closePanel'), paintPanel = K.later('paintPanel'), newNote = K.later('newNote'),
    clearSearch = K.later('clearSearch');
  // ---------- rendering
  function render(animate = false) {
    const liveNotes = live();
    const binned = V.state.notes.filter((n) => n.deletedAt);
    if (V.openGroup && (!groupById(V.openGroup) || !groupById(V.openGroup).open || !notesInTree(V.openGroup).length)) {
      // the group went away (emptied, ungrouped or locked again): go to the nearest level that still exists
      const up = chainOf(V.openGroup).find((g) => g.id !== V.openGroup && g.open && notesInTree(g.id).length);
      V.openGroup = up ? up.id : null;
    }
    // every move between group levels (opening a group, the back button, the path, Esc…) is remembered
    // for the mouse's back and forward buttons, like in a web browser
    if (V.openGroup !== V.shownGroup) {
      if (!V.navigating) { navBack.push(V.shownGroup); if (navBack.length > 100) navBack.shift(); V.navFwd = []; }
      V.shownGroup = V.openGroup;
    }
    document.body.dataset.theme = themeNow();
    document.body.classList.toggle('dark', !!THEMES.find((t) => t.id === themeNow()).dark);
    $('#cNotes').textContent = liveNotes.length;
    $('#cBin').textContent = binned.length;
    const favNow = favourites();
    $('#cFavs').textContent = favNow.notes.length + favNow.groups.length;
    const lockNow = lockedOnes();
    $('#cLocks').textContent = lockNow.notes.length + lockNow.groups.length + lockNow.hidden;
    $$('.tab').forEach((t) => t.classList.toggle('on', t.dataset.tab === V.tab));
    if (K.FX) paintFxPause();
    $('#viewNotes').hidden = !cardsTabNow();
    $('#viewNotes').classList.toggle('favs', V.tab === 'favs' || V.tab === 'locks');
    paintLockBar();
    $('#viewBin').hidden = V.tab !== 'bin';
    $('#viewSettings').hidden = V.tab !== 'settings';
    $('#cards').classList.toggle('anim', animate);
    $('#binCards').classList.toggle('anim', animate);
    const size = sizeNow();
    for (const box of [$('#cards'), $('#binCards')]) {
      box.classList.remove(...SIZES.map((x) => `size-${x}`));
      box.classList.add(`size-${size}`);
    }
    const inGroup = V.openGroup ? groupById(V.openGroup) : null;
    $('#q').placeholder = V.tab === 'favs' ? 'Search your favourites' : V.tab === 'locks' ? 'Search your locked notes' : inGroup ? 'Search your notes inside this group' : 'Search your notes';
    $('#qClear').hidden = !V.query;
    $('#bqClear').hidden = !V.binQuery;
    $('#btnNew').title = inGroup ? `New note inside “${inGroup.name || 'this group'}”` : 'New note';
    if (cardsTabNow()) renderNotes(liveNotes, animate);
    else paintBulk();
    if (V.tab === 'bin') renderBin(binned);
    if (V.tab === 'settings') renderSettings();
  }

  const PICTURE_ONLY = ['\u{1F5BC}\uFE0F Photo', '\u270F\uFE0F Drawing']; // must match collect() in note.js
  function fitThumb(img) {
    const bw = img.clientWidth; const bh = img.clientHeight;
    if (bw && bh && (img.naturalWidth < bw || img.naturalHeight < bh)) { img.style.maxHeight = `${bh}px`; img.classList.add('small'); } // never taller than the box was
    img.classList.remove('wait');
  }
  // 1.1.46: a picture among the words is as wide as in the note, measured in letters: a picture as wide as 5 letters
  // of the note's text is 5 letters of the card's text (never wider than the card, never bigger than the picture)
  function fitPic(img, p) {
    if (!p.px && !p.pct) {
      // full width in the note: as wide as the picture itself, up to the text's width
      const w = Math.min(img.naturalWidth || p.tw, p.tw);
      img.style.setProperty('--pw', `${Math.round((w / p.fs) * 10) / 10}em`);
    }
    if (img.naturalWidth && img.clientWidth > img.naturalWidth) img.style.maxWidth = `${img.naturalWidth}px`;
    img.classList.remove('wait');
    const body = img.closest('.body');
    if (body) markMore([body]);
  }
  function cardBody(n) {
    const body = h('div', { class: 'body' });
    const title = (n.title || '').trim();
    if (n.locked) {
      body.append(h('div', { class: 'txt' }, h('span', { class: 't1' }, title || 'Locked note')));
      body.append(h('div', { class: 'lockmark', html: ICON.lockA }));
      return body;
    }
    const lines = (n.text || '').split('\n').map((s) => s.trim()).filter(Boolean);
    // 1.1.22: checklist lines get their box (ticked or not) like in the note; `checks` has one letter per line (main.js)
    const marks = typeof n.checks === 'string' ? n.checks : '';
    // 1.1.46: each line is its own row (`.ln`), so the card can tell how many fit (markMore)
    const line = (i, cls) => {
      const mk = marks[i]; const box = mk === 'o' || mk === 'x' ? h('span', { class: 'cb' + (mk === 'x' ? ' done' : ''), 'aria-hidden': 'true' }) : null;
      const txt = box ? h('span', { class: 'ck' + (mk === 'x' ? ' done' : '') }, lines[i]) : lines[i];
      return h('span', { class: 'ln' + (cls ? ` ${cls}` : '') }, box, txt);
    };
    // A note that is just a picture or drawing gets the stand-in text "🖼️ Photo" / "✏️ Drawing" (for search and
    // the window title). The card already shows the picture, so it doesn't repeat that line.
    if (n.firstImage && lines.length === 1 && PICTURE_ONLY.includes(lines[0])) lines.length = 0;
    const total = lines.length ? Math.max(lines.length, n.lines || 0) : 0; // n.lines: the whole note (text is cut at 600 letters)
    body.dataset.lines = String(total);
    if (n.firstImage && !lines.length && !title) {
      // only a picture: it fills the card as before (1.1.22: a small one keeps its own size)
      body.append(h('img', { class: 'thumb wait only', src: n.firstImage, alt: '', draggable: 'false', onerror: (e) => e.target.remove(), onload: (e) => fitThumb(e.target) }));
      return body;
    }
    if (!title && !lines.length) {
      body.append(h('div', { class: 'txt empty' }, 'Empty note'));
      return body;
    }
    const rows = [];
    if (title) rows.push(h('span', { class: 'ln t1 tt' }, title));
    lines.forEach((_, i) => rows.push(line(i, !title && i === 0 ? 't1' : '')));
    // 1.1.46: the picture sits where it is in the note, between the same lines. Further down than the words the list
    // gets (600 letters), it isn't shown at all; further down than the card shows, it is cut off like the words.
    const p = n.firstImage && n.pic && typeof n.pic === 'object' ? n.pic : n.firstImage ? { at: lines.length, fs: 23, tw: 300 } : null;
    if (p && (p.at < lines.length || (p.at === lines.length && lines.length === total))) {
      const pw = p.px ? `${Math.round((p.px / p.fs) * 10) / 10}em` : p.pct ? `${p.pct}%` : null;
      const img = h('img', {
        class: 'pic wait' + (p.d ? ' drawing' : ''), src: n.firstImage, alt: '', draggable: 'false',
        style: pw ? `--pw:${pw}` : null,
        onerror: (e) => { const b = e.target.closest('.body'); e.target.remove(); if (b) markMore([b]); },
        onload: (e) => fitPic(e.target, p),
      });
      rows.splice((title ? 1 : 0) + p.at, 0, img);
      body.dataset.pic = '1';
    } else if (n.firstImage) body.dataset.pic = '0'; // a picture the card doesn't show
    body.append(h('div', { class: 'txt' }, rows));
    return body;
  }
  // 1.1.46: when a note has more than its card shows, the bottom of the card fades out (1.1.48: no "+3 lines" any
  // more, the owner didn't like it; a stronger fade instead). Read every card first, then change them, so the window
  // lays itself out once.
  function markMore(bodies) {
    const found = [];
    for (const body of bodies) {
      const txt = body.querySelector(':scope > .txt');
      if (!txt || !body.clientHeight) continue;
      const pad = parseFloat(getComputedStyle(body).paddingBottom) || 0;
      const bottom = body.clientHeight - pad + 1;
      // a line counts as shown only when all of it fits (the title isn't counted: it isn't one of the lines)
      let shown = 0; let cut = false;
      for (const el of txt.children) {
        if (el.offsetTop + el.offsetHeight > bottom) cut = true;
        else if (el.classList.contains('ln') && !el.classList.contains('tt')) shown++;
      }
      found.push([body, cut || shown < (Number(body.dataset.lines) || 0) || body.dataset.pic === '0']);
      body.dataset.m = '1'; // measured (1.2.3: a refresh measures again only cards that are new or never were)
    }
    for (const [body, on] of found) body.classList.toggle('more', on);
  }
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => markMore(document.querySelectorAll('.card > .body, .sheet > .body')));

  // ----- drag & drop: notes onto notes make a group, notes/groups onto groups go inside
  function startDrag(e, item, card) {
    e.stopPropagation();
    V.drag = item;
    hideCtx();
    // dragging one of several selected cards moves all of them
    const key = (item.kind === 'group' ? 'g:' : 'n:') + item.id;
    if (sel.size > 1 && sel.has(key)) {
      V.drag.many = selItems().map((it) => ({ id: it.id, kind: it.kind }));
      const chip = h('div', { class: 'dragchip' }, `${V.drag.many.length} selected`);
      document.body.append(chip);
      e.dataTransfer.setDragImage(chip, 20, 16);
      setTimeout(() => chip.remove(), 0);
    }
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', item.id);
    requestAnimationFrame(() => {
      card.classList.add('dragging');
      if (V.drag && V.drag.many) $$('#cards .card.sel').forEach((c) => c.classList.add('dragging'));
      document.body.classList.add('is-dragging');
    });
  }
  function endDrag() {
    V.drag = null;
    document.body.classList.remove('is-dragging');
    $$('.dragging, .drop-on').forEach((el) => el.classList.remove('dragging', 'drop-on'));
    if (V.renderLater) { V.renderLater = false; render(); }
  }
  function dropTarget(el, canDrop, onDrop, label) {
    const ok = () => V.drag && canDrop();
    el.addEventListener('dragenter', (e) => { if (ok()) { e.preventDefault(); el.classList.add('drop-on'); if (label) el.dataset.drop = label(); } });
    el.addEventListener('dragover', (e) => { if (ok()) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; el.classList.add('drop-on'); } });
    el.addEventListener('dragleave', (e) => { if (!el.contains(e.relatedTarget)) el.classList.remove('drop-on'); });
    el.addEventListener('drop', async (e) => {
      if (!ok()) return;
      e.preventDefault();
      const d = V.drag;
      el.classList.remove('drop-on');
      await onDrop(d);
    });
  }
  // where a dragged thing currently lives
  const locationOf = (d) => (d.kind === 'group' ? (groupById(d.id)?.parentId || null) : (V.state.notes.find((n) => n.id === d.id)?.groupId || null));
  // can the dragged thing move into group `gid` (null = top level)?
  function canMoveInto(d, gid) {
    if (locationOf(d) === (gid || null)) return false;
    if (d.kind === 'group' && gid && (gid === d.id || isInside(gid, d.id))) return false;
    return true;
  }
  // the same for everything being dragged (one card, or all the selected ones)
  const dragList = (d) => d.many || [d];
  function canMove(d, gid) {
    const list = dragList(d);
    if (list.some((x) => x.kind === 'group' && gid && (gid === x.id || isInside(gid, x.id)))) return false;
    return list.some((x) => canMoveInto(x, gid));
  }
  async function moveInto(d, gid) {
    for (const x of dragList(d)) if (canMoveInto(x, gid)) await S.groups.moveTo(x.id, gid || null);
    if (d.many) clearSel();
  }

  function noteCard(n, i, { inGroup = false } = {}) {
    const acts = h('div', { class: 'acts' },
      n.open
        ? h('button', { class: 'act', title: 'Close this note (keeps it here)', html: ICON.hide, onclick: (e) => { e.stopPropagation(); S.list.closeNote(n.id); } })
        : h('button', { class: 'act', title: 'Open on desktop', html: ICON.open, onclick: (e) => { e.stopPropagation(); S.list.openNote(n.id); } }),
      inGroup ? h('button', { class: 'act', title: 'Take out of the group (up one level)', html: ICON.out, onclick: (e) => { e.stopPropagation(); S.groups.moveUp(n.id); } }) : null,
      noteIsLocked(n) ? null : h('button', { class: 'act', title: 'Move to Bin (Shift+click: no question)', html: ICON.trash, onclick: (e) => { e.stopPropagation(); trashNote(n, e.shiftKey); } }));
    const key = `n:${n.id}`;
    const foot = h('div', { class: 'foot' },
      h('span', { class: 'when', title: `Created ${full(n.createdAt)}\nLast edited ${full(n.updatedAt)}` },
        h('span', { class: 'cal', html: ICON.cal }), when(n.createdAt)),
      n.open ? h('span', { class: 'badge', title: 'Open on your desktop' }, h('i'), 'open') : null,
      n.forNow || n.openUnlocked ? h('span', { class: 'ulk', title: n.forNow ? 'Unlocked until CosmoNotes restarts' : 'Unlocked for now. It locks again when you close the note', html: ICON.unlock }) : null,
      acts);
    const card = h('div', {
      class: 'card',
      'data-color': n.color,
      'data-font': n.font,
      'data-key': key,
      draggable: 'true',
      style: `--r:${tilt(n.id)}deg; animation-delay:${Math.min(i, 12) * 18}ms`,
      title: n.open ? 'Click to bring to front · Ctrl+click to select · right-click for more' : 'Click to open · Ctrl+click to select · right-click for more',
      onclick: (e) => { if (pickCard(e, key)) return; S.list.openNote(n.id); },
      oncontextmenu: (e) => { e.preventDefault(); if (bulkMenu(e, key)) return; noteMenu(n, e); },
    }, h('div', { class: 'strip' }), n.pinned ? h('span', { class: 'pin', title: 'Pinned on top' }) : null, cardBody(n), foot, lockBtn('note', n), starBtn(key));
    card.addEventListener('dragstart', (e) => startDrag(e, { id: n.id, kind: 'note' }, card));
    card.addEventListener('dragend', endDrag);
    dropTarget(card,
      () => (V.drag.many ? !V.drag.many.some((x) => x.id === n.id) : V.drag.kind === 'note' && V.drag.id !== n.id),
      async (d) => {
        if (!d.many) return S.groups.make(d.id, n.id);
        await S.groups.makeFrom([n.id, ...d.many.map((x) => x.id)], n.groupId || null);
        clearSel();
      },
      () => {
        if (V.drag.many) return 'Make a group';
        const from = V.state.notes.find((x) => x.id === V.drag.id);
        return n.groupId && from && from.groupId !== n.groupId ? 'Add to its group' : 'Make a group';
      });
    return card;
  }

  // the little picture of a group, in its chosen look
  function groupArt(g, notes) {
    const sorted = [...notes].sort((a, b) => b.updatedAt - a.updatedAt);
    const hiddenG = !g.open;
    const paper = (n, cls) => h('div', { class: `paper ${cls}`, 'data-color': n ? n.color : 'yellow' });
    const top = sorted[0];
    const peek = [sorted[0], sorted[1], sorted[2]].filter(Boolean);
    const lockBadge = g.locked ? h('span', { class: 'glock', html: g.open ? ICON.unlock : ICON.lockA }) : null;
    const style = g.style || 'stack';
    if (style === 'folder') {
      return h('div', { class: 'art folder' },
        h('div', { class: 'f-back' }),
        ...peek.slice(0, 3).map((n, k) => paper(n, `pk pk${k + 1}`)),
        h('div', { class: 'f-front' }, h('span', { class: 'f-count' }, plural(notes.length, 'note'))),
        lockBadge);
    }
    if (style === 'envelope') {
      return h('div', { class: 'art envelope' },
        h('div', { class: 'e-back' }),
        ...peek.slice(0, 2).map((n, k) => paper(n, `pk pk${k + 1}`)),
        h('div', { class: 'e-front' }),
        h('span', { class: 'e-seal', html: '<svg viewBox="0 0 24 24"><path d="M12 3l2.4 5.6 6 .5-4.6 4 1.4 5.9L12 16l-5.2 3 1.4-5.9-4.6-4 6-.5z"/></svg>' }),
        lockBadge);
    }
    if (style === 'notebook') {
      return h('div', { class: 'art notebook' },
        h('div', { class: 'nb-pages' }),
        h('div', { class: 'nb-cover' },
          h('div', { class: 'nb-label' }, h('b', {}, g.name || 'Notebook'), h('small', {}, plural(notes.length, 'note')))),
        h('div', { class: 'nb-rings' }, ...Array.from({ length: 6 }, () => h('i'))),
        h('div', { class: 'nb-band' }),
        lockBadge);
    }
    // stack (the original look)
    const back = sorted.slice(1, 3);
    const front = hiddenG || !top ? null : cardBody(top);
    return h('div', { class: 'art sheets' },
      back[1] ? h('div', { class: 'sheet s3', 'data-color': back[1].color }) : null,
      back[0] ? h('div', { class: 'sheet s2', 'data-color': back[0].color }) : null,
      h('div', { class: 'sheet s1', 'data-color': top ? top.color : 'yellow', 'data-font': top ? top.font : 'hand' },
        front || h('div', { class: 'body' }, h('div', { class: 'lockmark', html: ICON.lockA }))),
      h('span', { class: 'clip' }),
      g.locked && g.open ? lockBadge : null);
  }

  function groupCard(g, i) {
    const notes = notesInTree(g.id);
    const subs = [...subtreeIds(g.id)].length - 1;
    const key = `g:${g.id}`;
    const card = h('div', {
      class: `card group look-${g.style || 'stack'}${g.open ? '' : ' locked'}`,
      'data-key': key,
      draggable: 'true',
      style: `--r:${tilt(g.id) * 0.5}deg; --gc:${GCOLORS[g.color] || GCOLORS.kraft}; animation-delay:${Math.min(i, 12) * 18}ms`,
      title: `${g.name || 'Group'} · ${plural(notes.length, 'note')}${subs ? ` · ${plural(subs, 'group')} inside` : ''}${g.locked ? ' · locked' : ''}\nClick to open · Ctrl+click to select · drop a note here to add it · right-click for more`,
      onclick: (e) => { if (pickCard(e, key)) return; openGroupView(g); },
      oncontextmenu: (e) => { e.preventDefault(); if (bulkMenu(e, key)) return; groupMenu(g, e); },
    }, lockBtn('group', g), starBtn(key), groupArt(g, notes),
      h('div', { class: 'gfoot' },
        g.locked ? h('span', { class: 'gl', html: g.open ? ICON.unlock : ICON.lock }) : null,
        h('span', { class: 'gname-l' + (g.name ? '' : ' unnamed') }, g.name || 'Group'),
        subs ? h('span', { class: 'gsub', title: plural(subs, 'group') + ' inside', html: ICON.folder + subs }) : null,
        h('span', { class: 'gcount' }, String(notes.length))));
    card.addEventListener('dragstart', (e) => startDrag(e, { id: g.id, kind: 'group' }, card));
    card.addEventListener('dragend', endDrag);
    dropTarget(card, () => canMove(V.drag, g.id), (d) => (d.many ? moveInto(d, g.id) : S.groups.make(d.id, g.id)), () => 'Put inside');
    return card;
  }

  function emptyState(title, text, withButton) {
    return h('div', { class: 'emptystate' },
      withButton ? h('div', { class: 'stack' }, h('i'), h('i'), h('i')) : null,
      h('h2', {}, title),
      h('p', {}, text),
      withButton ? h('button', { class: 'pill', onclick: () => newNote() }, '+ New note') : null);
  }

  function renderGroupHeader(g) {
    const chain = chainOf(g.id).reverse(); // outermost first
    const crumbs = $('#crumbs');
    crumbs.innerHTML = '';
    const crumb = (label, gid, current) => {
      const el = h(current ? 'span' : 'button', { class: 'crumb' + (current ? ' cur' : ''), onclick: current ? null : () => { V.openGroup = gid; clearSearch(); closePanel(); render(true); } }, label);
      if (!current) dropTarget(el, () => canMove(V.drag, gid), (d) => moveInto(d, gid), () => 'Move here');
      return el;
    };
    crumbs.append(crumb('All notes', null, false));
    chain.forEach((c) => crumbs.append(h('span', { class: 'sep' }, '›'), crumb(c.name || 'Group', c.id, c.id === g.id)));
    const parent = groupById(g.parentId);
    $('#backLabel').textContent = parent ? (parent.name || 'Group') : 'All notes';
    const input = $('#groupName');
    if (document.activeElement !== input) input.value = g.name || '';
    $('#gIcon').innerHTML = $(`#gStyles [data-style="${g.style || 'stack'}"] svg`).outerHTML;
    $('#groupHead').style.setProperty('--gc', GCOLORS[g.color] || GCOLORS.kraft);
    $('#btnRelockGroup').hidden = !chain.some((c) => c.locked);
    paintPanel(g);
  }

  // A background refresh (a note was edited, opened, closed…) keeps every card whose data didn't
  // change and only builds the changed ones, then puts them in order touching as little as possible.
  // A view change (tab, group, search, sort, size) builds everything again, with the drop-in animation.
  let cardCache = new Map(); // key → { sig, el }
  let cacheDay = '';
  let lastLook = ''; // card size, theme and width at the last render (1.2.3)
  function cached(key, sig, build, used) {
    const hit = cardCache.get(key);
    const el = hit && hit.sig === sig ? hit.el : build();
    used.set(key, { sig, el });
    return el;
  }
  function placeCards(box, els) {
    const keep = new Set(els);
    for (const c of [...box.children]) if (!keep.has(c)) c.remove();
    els.forEach((el, i) => { if (box.children[i] !== el) box.insertBefore(el, box.children[i] || null); });
  }
  function renderNotes(liveNotes, animate = false) {
    const box = $('#cards');
    const scroll = $('#viewNotes').scrollTop;
    const today = new Date().toDateString(); // "Today" / "Yesterday" on cards change at midnight
    if (animate || cacheDay !== today) { cardCache = new Map(); cacheDay = today; }
    const used = new Map();
    const els = [];
    const old = new Set([...cardCache.values()].map((x) => x.el));
    const done = () => {
      placeCards(box, els);
      cardCache = used;
      // 1.2.3 (speed): a card kept from last time looks exactly as before, so only the cards built now are measured
      // (markMore) and get their effect set up (paintFx). When the card size, the theme or the window's width changed,
      // the kept cards changed too: then all of them, as before.
      const look = `${sizeNow()}|${themeNow()}|${box.clientWidth}`;
      const fresh = look === lastLook ? new Set(els.filter((el) => !old.has(el))) : null;
      lastLook = look;
      paintCards(fresh);
      markMore(fresh
        ? [...new Set([...[...fresh].map((el) => el.querySelector(':scope > .body')).filter(Boolean), ...box.querySelectorAll('.card > .body:not([data-m])'), ...document.querySelectorAll('.sheet > .body')])]
        : box.querySelectorAll('.card > .body, .sheet > .body'));
    };
    const q = V.query.trim().toLowerCase();
    const g = V.tab === 'notes' && V.openGroup ? groupById(V.openGroup) : null;
    $('#groupHead').hidden = !g;
    $('#tip').textContent = '';
    if (g) renderGroupHeader(g); else closePanel();

    if (!liveNotes.length) {
      els.push(emptyState('No notes yet', 'Your first sticky note is one click away.', true));
      done();
      return;
    }

    // Favourites (1.1.13): every starred note and group, wherever it lives. Ones inside a locked group
    // that isn't open stay hidden; a line under the cards says how many.
    if (V.tab === 'favs') {
      const f = favourites();
      let items = [
        ...f.groups.map((fg) => ({ kind: 'group', group: fg, notes: notesInTree(fg.id) })),
        ...f.notes.map((n) => ({ kind: 'note', note: n })),
      ];
      if (q) items = items.filter((it) => (it.kind === 'group' ? (it.group.name || '') : `${it.note.title || ''}\n${it.note.text || ''}\n${it.note.pics || ''}`).toLowerCase().includes(q));
      if (!items.length) {
        els.push(q
          ? emptyState('Nothing found', `No favourite contains “${V.query.trim()}”.`)
          : emptyState('No favourites yet', 'Click the star on a note or group to keep it here.'));
      }
      sortItems(items).forEach((it, i) => els.push(it.kind === 'group' ? groupEl(it.group, it.notes, i, used) : noteEl(it.note, i, !!it.note.groupId, used)));
      done();
      if (f.hidden) $('#tip').textContent = `${plural(f.hidden, 'more favourite')} ${f.hidden === 1 ? 'is' : 'are'} in a locked group. Open it to see ${f.hidden === 1 ? 'it' : 'them'}.`;
      if ($('#viewNotes').scrollTop !== scroll) $('#viewNotes').scrollTop = scroll;
      return;
    }

    // Locked (1.1.15): like Favourites, for locked notes and groups. Their words only show (and can be
    // searched) after "Unlock all".
    if (V.tab === 'locks') {
      const f = lockedOnes();
      let items = [
        ...f.groups.map((fg) => ({ kind: 'group', group: fg, notes: notesInTree(fg.id) })),
        ...f.notes.map((n) => ({ kind: 'note', note: n })),
      ];
      if (q) items = items.filter((it) => (it.kind === 'group' ? (it.group.name || '') : `${it.note.title || ''}\n${it.note.text || ''}\n${it.note.pics || ''}`).toLowerCase().includes(q));
      if (!items.length) {
        els.push(q
          ? emptyState('Nothing found', V.state.settings.unlockedAll ? `No locked note contains “${V.query.trim()}”.` : `No locked note’s title has “${V.query.trim()}”. Unlock all to search their words too.`)
          : emptyState('Nothing locked', 'Lock a note or group with the lock on its card, or by right-clicking it.'));
      }
      sortItems(items).forEach((it, i) => els.push(it.kind === 'group' ? groupEl(it.group, it.notes, i, used) : noteEl(it.note, i, !!it.note.groupId, used)));
      done();
      if (f.hidden) $('#tip').textContent = f.hidden === 1 ? '1 more is in a locked group. Unlock all to see it.' : `${f.hidden} more are in a locked group. Unlock all to see them.`;
      if ($('#viewNotes').scrollTop !== scroll) $('#viewNotes').scrollTop = scroll;
      return;
    }

    // search: one flat list of every matching note (only inside the open group, when one is open)
    if (q) {
      const pool = g ? notesInTree(g.id) : liveNotes;
      const found = pool.filter((n) => `${n.title || ''}\n${n.text || ''}\n${n.pics || ''}`.toLowerCase().includes(q));
      const items = sortItems(found.map((n) => ({ kind: 'note', note: n })));
      if (!items.length) els.push(emptyState('Nothing found', `No note${g ? ' in this group' : ''} contains “${V.query.trim()}”.`));
      items.forEach((it, i) => els.push(noteEl(it.note, i, !!it.note.groupId, used)));
      done();
      return;
    }

    const here = g ? g.id : null;
    const items = [];
    for (const cg of childGroups(here)) {
      const ns = notesInTree(cg.id);
      if (ns.length) items.push({ kind: 'group', group: cg, notes: ns });
    }
    const known = new Set(V.state.groups.map((x) => x.id));
    for (const n of liveNotes) {
      const at = n.groupId && known.has(n.groupId) ? n.groupId : null;
      if (at === here) items.push({ kind: 'note', note: n });
    }
    sortItems(items).forEach((it, i) => els.push(it.kind === 'group' ? groupEl(it.group, it.notes, i, used) : noteEl(it.note, i, !!g, used)));
    done();
    if (g) $('#tip').textContent = 'To move a note up a level, drag it onto the button left of the group’s name.';
    else if (liveNotes.length >= 2 && !V.state.groups.length && !V.state.settings.madeGroup) $('#tip').textContent = 'Tip: drag a note onto another one to put them in a group.';
    if ($('#viewNotes').scrollTop !== scroll) $('#viewNotes').scrollTop = scroll;
  }
  // a card is reused when everything it shows (and its buttons use) is the same as last time
  // (the star and the selection outline are painted afterwards by paintCards, so starring doesn't rebuild a card)
  const sigOf = (x) => JSON.stringify(x, (k, v) => (k === 'favorite' ? undefined : v));
  function noteEl(n, i, inGroup, used) {
    return cached(`n:${n.id}:${inGroup ? 1 : 0}`, sigOf([n, noteIsLocked(n)]), () => noteCard(n, i, { inGroup }), used);
  }
  function groupEl(g, notes, i, used) {
    const subs = subtreeIds(g.id).size - 1;
    return cached(`g:${g.id}`, sigOf([g, notes, subs, groupIsLocked(g)]), () => groupCard(g, i), used);
  }

  Object.assign(K, { render, cardBody, markMore, dropTarget, canMove, moveInto, emptyState });
})();
