'use strict';
// CosmoNotes "All notes" window, part 2 of 7: rendering, drag & drop, note and group cards, the group header
// (src/list.js until 1.1.28; the parts load in order from list.html. How they share names: ai-context/splitting-code.md)
(() => {
  const K = window.COSMO_LIST_KIT;
  const { V, S, $, $$, GCOLORS, THEMES, SIZES, sizeNow, themeNow, ICON, cardsTabNow, navBack, sel, h, when, full,
    plural, tilt, live, groupById, childGroups, chainOf, subtreeIds, notesInTree, isInside, noteIsLocked,
    groupIsLocked, isShut, noteById, lockedOnes, favourites, sortItems, groupShown, finding, noteFits, groupFits,
    knownTags } = K;
  // defined in a later part:
  const selItems = K.later('selItems'), starBtn = K.later('starBtn'), lockBtn = K.later('lockBtn'),
    pickCard = K.later('pickCard'), clearSel = K.later('clearSel'), paintCards = K.later('paintCards'),
    paintBulk = K.later('paintBulk'), bulkMenu = K.later('bulkMenu'), renderBin = K.later('renderBin'),
    renderSettings = K.later('renderSettings'), hideCtx = K.later('hideCtx'), noteMenu = K.later('noteMenu'),
    groupMenu = K.later('groupMenu'), paintFxPause = K.later('paintFxPause'), trashNote = K.later('trashNote'),
    paintLockBar = K.later('paintLockBar'), openGroupView = K.later('openGroupView'),
    closePanel = K.later('closePanel'), paintPanel = K.later('paintPanel'), newNote = K.later('newNote'),
    clearSearch = K.later('clearSearch'), openRemindSheet = K.later('openRemindSheet');
  const R = window.COSMO_REMIND;
  // 1.3.27: evening colours (src/evening.js): each light paper's evening shade for the cards. --evp on the body says how far
  // into the evening it is (main's clock); a card whose note has them on (.eve) mixes in by it (list-cards.css)
  const EVE = window.COSMO_EVENING;
  if (EVE) document.head.append(Object.assign(document.createElement('style'), { textContent: EVE.css('.card') }));
  const paintEvening = () => document.body.style.setProperty('--evp', String(Number(V.state.settings.evePhase) || 0));
  if (S.list.onEvening) S.list.onEvening((p) => { V.state.settings.evePhase = p; paintEvening(); });

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
    paintEvening();
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
    if (cardsTabNow()) { paintTagRow(); renderNotes(liveNotes, animate); }
    else paintBulk();
    if (V.tab === 'bin') renderBin(binned);
    if (V.tab === 'settings') renderSettings();
  }

  // ---------- 1.4.10: tags. The row under the search box: every tag in use (the picked ones first, then A–Z); a click
  // picks or drops one; with two or more picked, All / Any. A card's own tags under its words: a click picks that tag.
  function setTagPick(list) {
    V.tagPick = list;
    render();
    $('#viewNotes').scrollTop = 0;
  }
  const toggleTag = (t) => setTagPick(V.tagPick.includes(t) ? V.tagPick.filter((x) => x !== t) : [...V.tagPick, t]);
  const pickTag = (t) => { if (!V.tagPick.includes(t)) setTagPick([...V.tagPick, t]); };
  function paintTagRow() {
    const row = $('#tagRow');
    const known = knownTags();
    const have = new Set(known.map((k) => k.tag));
    if (V.tagPick.some((t) => !have.has(t))) V.tagPick = V.tagPick.filter((t) => have.has(t)); // its last note went
    row.hidden = !known.length;
    if (row.hidden) return;
    const picked = known.filter((k) => V.tagPick.includes(k.tag));
    const rest = known.filter((k) => !V.tagPick.includes(k.tag));
    const chip = ({ tag, count }) => h('button', {
      class: 'tagchip' + (V.tagPick.includes(tag) ? ' on' : ''),
      title: V.tagPick.includes(tag) ? 'Click to stop filtering by it' : `Show only what has it (${count})`,
      onclick: () => toggleTag(tag),
    }, `#${tag}`, h('small', {}, String(count)));
    const any = !!V.state.settings.tagAny;
    const setAny = (v) => { if (v === any) return; V.state.settings.tagAny = v; S.settings.set({ tagAny: v }); render(); };
    row.replaceChildren(...[
      h('span', { class: 'tagico', title: 'Tags: click one to filter, or type #tag in the search', html: ICON.tag }),
      h('div', { class: 'tagchips' }, ...picked.map(chip), ...rest.map(chip)),
      V.tagPick.length >= 2 ? h('div', { class: 'seg tagmode', title: 'All: has every picked tag · Any: has one of them' },
        h('button', { class: any ? '' : 'on', onclick: () => setAny(false) }, 'All'),
        h('button', { class: any ? 'on' : '', onclick: () => setAny(true) }, 'Any')) : null,
      V.tagPick.length ? h('button', { class: 'qclear tagclear', title: 'Stop filtering by tags', html: ICON.x, onclick: () => setTagPick([]) }) : null,
    ].filter(Boolean));
  }
  function tagPills(tags) {
    if (!tags || !tags.length) return null;
    return h('div', { class: 'ctags' }, ...tags.map((t) => h('button', {
      class: 'ctag', title: `Show only what has #${t}`, draggable: 'false',
      onclick: (e) => { e.stopPropagation(); pickTag(t); },
    }, `#${t}`)));
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
  // 1.3.11: one run of words in the look the note gives it (store.js cardRuns makes the runs; CARD_RUN_KEYS there).
  // The same rules as the note's own CSS (src/css/note-text.css: code, links; the browser's own <mark>, <sub>…). The size
  // (k, 1.3.13) is worked out in store.js exactly as the note's CSS does it, nested elements and all.
  // Every value is checked again here: only the app's fonts, colours as #hex / rgb(), a size from 0.2 to 6.
  const RUN_FONT = { hand: 'var(--hand)', round: 'var(--ui)', medieval: 'var(--med)' };
  const RUN_COLOR = /^(#[0-9a-f]{3,8}|rgba?\([\d.,\s%]+\))$/i;
  const runCss = {
    f: (v) => (RUN_FONT[v] ? `font-family:${RUN_FONT[v]}` : ''),
    c: (v) => (RUN_COLOR.test(v) ? `color:${v}` : ''),
    bg: (v) => (RUN_COLOR.test(v) ? `background-color:${v}` : ''),
    k: (v) => (Number(v) > 0.2 && Number(v) < 6 ? `font-size:${Number(v)}em` : ''), // 1.3.13: the size, as the note works it out (store.js)
    b: () => 'font-weight:700',
    i: () => 'font-style:italic',
    u: () => 'text-decoration-line:underline',
    s: () => 'text-decoration-line:line-through',
    mk: () => 'background-color:Mark;color:MarkText',
    sub: () => 'vertical-align:sub',
    sup: () => 'vertical-align:super',
    code: () => 'font-family:Consolas,monospace;background-color:rgba(0,0,0,.06);border-radius:4px;padding:0 .2em',
    h: () => 'font-weight:700',
    a: () => 'color:var(--accent);text-decoration-line:underline',
  };
  // 1.4.21: done = a ticked line's run: struck through by itself, in its own size and font (a strike on the line was drawn
  // at the line's size, so not in the middle of bigger or smaller words: note-text.css cn-done)
  function runSpan(r, done = false) {
    if (!r || typeof r.t !== 'string') return '';
    if (done) r = { ...r, s: true };
    const css = [];
    for (const k of Object.keys(runCss)) if (r[k] !== undefined && r[k] !== null) css.push(runCss[k](r[k]));
    // underline and strike together: one text-decoration-line with both
    const deco = ['u', 's', 'a'].filter((k) => r[k]).length > 1 ? `text-decoration-line:${r.s ? 'line-through ' : ''}underline` : '';
    const style = css.filter(Boolean).filter((x) => !deco || !x.startsWith('text-decoration-line')).concat(deco || []).join(';');
    return style ? h('span', { class: 'run', style }, r.t) : r.t;
  }
  function cardBody(n) {
    const body = h('div', { class: 'body' });
    const title = (n.title || '').trim();
    // 1.3.3: a title with its own font (Title font in the note's ⋯ menu) shows in it here too
    const tfont = n.titleFont && n.titleFont !== n.font ? n.titleFont : null;
    if (n.locked) {
      body.append(h('div', { class: 'txt' }, h('span', { class: 't1', 'data-tfont': title ? tfont : null }, title || 'Locked note')));
      body.append(h('div', { class: 'lockmark', html: ICON.lockA }));
      return body;
    }
    const lines = (n.text || '').split('\n').map((s) => s.trim()).filter(Boolean);
    // 1.3.11: each line in the look it has in the note (store.js cardRuns; null = plain)
    const runs = Array.isArray(n.runs) && n.runs.length === lines.length ? n.runs : null;
    const words = (i, done) => (runs && Array.isArray(runs[i]) ? runs[i] : [{ t: lines[i] }]).map((r) => runSpan(r, done));
    // 1.1.22: checklist lines get their box (ticked or not) like in the note; `checks` has one letter per line (main.js)
    const marks = typeof n.checks === 'string' ? n.checks : '';
    // 1.1.46: each line is its own row (`.ln`), so the card can tell how many fit (markMore)
    const line = (i, cls) => {
      const mk = marks[i]; const box = mk === 'o' || mk === 'x' ? h('span', { class: 'cb' + (mk === 'x' ? ' done' : ''), 'aria-hidden': 'true' }) : null;
      const txt = box ? h('span', { class: 'ck' + (mk === 'x' ? ' done' : '') }, ...words(i, mk === 'x')) : words(i);
      return h('span', { class: 'ln' + (cls ? ` ${cls}` : '') }, box, ...[].concat(txt));
    };
    // A note that is just a picture or drawing gets the stand-in text "🖼️ Photo" / "✏️ Drawing" (for search and
    // the window title). The card already shows the picture, so it doesn't repeat that line.
    if (n.firstImage && lines.length === 1 && PICTURE_ONLY.includes(lines[0])) lines.length = 0;
    const total = lines.length ? Math.max(lines.length, n.lines || 0) : 0; // n.lines: the whole note (text is cut at 600 letters)
    body.dataset.lines = String(total);
    // 1.3.13: a note zoomed out (Ctrl + wheel) shows its words smaller on its card too (never bigger: the card is a preview)
    const z = Number(n.zoom); if (z > 0 && z < 1) body.style.setProperty('--nz', String(z));
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
    if (title) rows.push(h('span', { class: 'ln t1 tt', 'data-tfont': tfont }, title));
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
      // 1.3.28: shut ones (isShut) stay where they are
      V.drag.many = selItems().filter((it) => !isShut(it.kind, it.note || it.group)).map((it) => ({ id: it.id, kind: it.kind }));
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
  // can the dragged thing move into group `gid` (null = top level)? (1.3.28: never a shut one, nor into one)
  const shutDrag = (d) => isShut(d.kind, d.kind === 'group' ? groupById(d.id) : noteById(d.id));
  function canMoveInto(d, gid) {
    if (locationOf(d) === (gid || null) || shutDrag(d) || (gid && isShut('group', groupById(gid)))) return false;
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
    // 1.4.9: several cards move in one go, so one Ctrl+Z puts them all back
    if (d.many) { await S.groups.moveMany(d.many.filter((x) => canMoveInto(x, gid)).map((x) => x.id), gid || null); clearSel(); return; }
    if (canMoveInto(d, gid)) await S.groups.moveTo(d.id, gid || null);
  }

  function noteCard(n, i, { inGroup = false } = {}) {
    const shut = isShut('note', n); // 1.3.28: no buttons, no dragging; a click still opens it (its window asks for the PIN)
    const acts = shut ? null : h('div', { class: 'acts' },
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
      overTag(n),
      n.forNow || n.openUnlocked ? h('span', { class: 'ulk', title: n.forNow ? 'Unlocked until CosmoNotes restarts' : 'Unlocked for now. It locks again when you close the note', html: ICON.unlock }) : null,
      remIcon(n, shut),
      acts);
    // 1.4.16: a card stays when its note changes (refreshCard moves a new card's parts into it), so the card's own handlers
    // read the note as it is now, never the one it was built from
    const now = () => noteById(n.id) || n;
    const card = h('div', {
      class: 'card' + (n.eve ? ' eve' : '') + (n.remHidden ? ' remhid' : ''), // 1.3.27: evening colours; 1.4.1: hidden by a reminder
      'data-color': n.color,
      'data-font': n.font,
      'data-key': key,
      draggable: shut ? 'false' : 'true',
      style: `--r:${tilt(n.id)}deg; animation-delay:${Math.min(i, 12) * 18}ms`,
      title: n.open ? 'Click to bring to front · Ctrl+click to select · right-click for more' : 'Click to open · Ctrl+click to select · right-click for more',
      onclick: (e) => { if (pickCard(e, key)) return; S.list.openNote(n.id); },
      oncontextmenu: (e) => { e.preventDefault(); if (bulkMenu(e, key)) return; noteMenu(now(), e); },
    }, h('div', { class: 'strip' }), n.pinned ? h('span', { class: 'pin', title: n.appPinned ? 'Pinned over some apps' : 'Pinned on top' }) : null, cardBody(n), tagPills(n.tags), foot, lockBtn('note', n), starBtn(key));
    card.addEventListener('dragstart', (e) => startDrag(e, { id: n.id, kind: 'note' }, card));
    card.addEventListener('dragend', endDrag);
    dropTarget(card,
      () => !isShut('note', now()) && (V.drag.many ? !V.drag.many.some((x) => x.id === n.id) : V.drag.kind === 'note' && V.drag.id !== n.id && !shutDrag(V.drag)),
      async (d) => {
        if (!d.many) return S.groups.make(d.id, n.id);
        await S.groups.makeFrom([n.id, ...d.many.map((x) => x.id)], now().groupId || null);
        clearSel();
      },
      () => {
        if (V.drag.many) return 'Make a group';
        const from = V.state.notes.find((x) => x.id === V.drag.id);
        const gid = now().groupId;
        return gid && from && from.groupId !== gid ? 'Add to its group' : 'Make a group';
      });
    return card;
  }

  // 1.4.5: pinned over some apps only (main/app-pin.js): "Over Excel", "Over Excel +2"; the apps on hover. A note its lock
  // hides gets no names from main, only that it has some
  function overTag(n) {
    if (!n.appPinned) return null;
    const list = n.pinApps || [];
    const tip = list.length ? `On top only over:\n${list.map((r) => (r.part ? `${r.app}: ${r.part}` : r.app)).join('\n')}` : 'On top only over some apps';
    const text = list.length ? `Over ${list[0].app}${list.length > 1 ? ` +${list.length - 1}` : ''}` : 'Over apps';
    return h('span', { class: 'over', title: tip }, text);
  }
  // 1.4.1: the card's clock: what its reminders are (on hover), red while one rings; a click opens them (not on a shut card)
  function remIcon(n, shut) {
    if (!R || !n.reminders || !n.reminders.length) return null;
    const now = Date.now();
    const ring = n.reminders.some((r) => r.firing);
    const tip = [...n.reminders.map((r) => R.line(r, now)), n.remHidden ? 'Hidden until it goes off' : ''].filter(Boolean).join('\n');
    const cls = 'rem' + (ring ? ' ring' : '') + (n.remHidden ? ' hid' : '');
    if (shut) return h('span', { class: cls, title: tip, html: ICON.clock });
    return h('button', { class: cls, title: `${tip}\nClick to change`, html: ICON.clock, onclick: (e) => { e.stopPropagation(); openRemindSheet(n); } });
  }
  // the little picture of a group, in its chosen look. 1.4.14 (the owner's pick): every look wears the same cream label
  // in the same spot (name + number of notes), and nothing is under the card. The label is always cream, so its ink is
  // fixed (never the theme's --ink: that is light on dark themes). The name shows in the group's own font (titleFont).
  function groupArt(g, notes) {
    const sorted = [...notes].sort((a, b) => b.updatedAt - a.updatedAt);
    const hiddenG = !g.open;
    const paper = (n, cls) => h('div', { class: `paper ${cls}`, 'data-color': n ? n.color : 'yellow' });
    const top = sorted[0];
    const peek = [sorted[0], sorted[1], sorted[2]].filter(Boolean);
    const lockBadge = g.locked ? h('span', { class: 'glock', html: g.open ? ICON.unlock : ICON.lockA }) : null;
    const label = h('div', { class: 'glabel' },
      h('b', { class: g.name ? '' : 'unnamed', 'data-font': g.titleFont || 'hand' }, g.name || 'Group'),
      h('small', {}, plural(notes.length, 'note')));
    const style = g.style || 'stack';
    if (style === 'folder') {
      return h('div', { class: 'art folder' },
        h('div', { class: 'f-back' }),
        ...peek.slice(0, 3).map((n, k) => paper(n, `pk pk${k + 1}`)),
        h('div', { class: 'f-front' }, label), // on the front, so it tips with it
        lockBadge);
    }
    if (style === 'envelope') {
      return h('div', { class: 'art envelope' },
        h('div', { class: 'e-back' }),
        ...peek.slice(0, 2).map((n, k) => paper(n, `pk pk${k + 1}`)),
        h('div', { class: 'e-front' }),
        h('span', { class: 'e-seal', html: '<svg viewBox="0 0 24 24"><path d="M12 3l2.4 5.6 6 .5-4.6 4 1.4 5.9L12 16l-5.2 3 1.4-5.9-4.6-4 6-.5z"/></svg>' }),
        label, lockBadge);
    }
    if (style === 'notebook') {
      return h('div', { class: 'art notebook' },
        h('div', { class: 'nb-pages' }),
        h('div', { class: 'nb-cover' }, label), // on the cover, so it turns with it
        h('div', { class: 'nb-rings' }, ...Array.from({ length: 6 }, () => h('i'))),
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
      label,
      g.locked && g.open ? lockBadge : null);
  }

  function groupCard(g, i) {
    const notes = notesInTree(g.id);
    const subs = [...subtreeIds(g.id)].length - 1;
    const key = `g:${g.id}`;
    const card = h('div', {
      class: `card group look-${g.style || 'stack'}${g.open ? '' : ' locked'}`,
      'data-key': key,
      draggable: isShut('group', g) ? 'false' : 'true',
      style: `--r:${tilt(g.id) * 0.5}deg; --gc:${GCOLORS[g.color] || GCOLORS.kraft}; animation-delay:${Math.min(i, 12) * 18}ms`,
      title: `${g.name || 'Group'} · ${plural(notes.length, 'note')}${subs ? ` · ${plural(subs, 'group')} inside` : ''}${g.locked ? ' · locked' : ''}\nClick to open · Ctrl+click to select · drop a note here to add it · right-click for more`,
      onclick: (e) => { if (pickCard(e, key)) return; openGroupView(g); },
      oncontextmenu: (e) => { e.preventDefault(); if (bulkMenu(e, key)) return; groupMenu(g, e); },
    }, lockBtn('group', g), starBtn(key), groupArt(g, notes),
      tagPills(g.tags));
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
    input.dataset.font = g.titleFont || 'hand';
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
  const refreshed = new Set(); // 1.4.16: the cards this render kept but filled again (refreshCard)
  function cached(key, sig, build, used) {
    const hit = cardCache.get(key);
    let el;
    if (hit && hit.sig === sig) el = hit.el;
    else if (hit && key.startsWith('n:')) { el = hit.el; refreshCard(el, build()); refreshed.add(el); }
    else el = build();
    used.set(key, { sig, el });
    return el;
  }
  // 1.4.16: a note that changed keeps its card. A new card swapped in made the card blink while the owner typed (a new
  // element: its effect started again, its picture hid until it had loaded). Now the new card's parts move into the card
  // on screen (the effect's canvas stays), and only the new letters write themselves in (inkIn).
  const KEEP_CLASSES = ['sel', 'is-fav', 'cut', 'dragging', 'drop-on', 'lock-anim', 'unlock-anim']; // set by others, not by noteCard
  function refreshCard(card, fresh) {
    const before = lineTexts(card);
    const keep = KEEP_CLASSES.filter((c) => card.classList.contains(c));
    for (const a of [...card.attributes]) if (!fresh.hasAttribute(a.name) && a.name !== 'data-drop') card.removeAttribute(a.name);
    for (const a of [...fresh.attributes]) if (card.getAttribute(a.name) !== a.value) card.setAttribute(a.name, a.value);
    if (keep.length) card.classList.add(...keep);
    const fx = card.querySelector(':scope > .fxc');
    card.replaceChildren(...(fx ? [fx] : []), ...fresh.childNodes);
    inkIn(card, before);
  }
  // the words of each line of a card (null for a locked one: unlocking it shows its words without writing them in)
  const cardLines = (card) => [...card.querySelectorAll(':scope > .body > .txt > .ln')];
  const lineTexts = (card) => (card.querySelector(':scope > .body > .lockmark') ? null : cardLines(card).map((l) => l.textContent));
  // Which lines have new letters, and from where: lines that stayed the same (moved or not) don't count; a changed line
  // counts from the first letter that differs from the line it replaced
  function newLetters(a, b) {
    const n = a.length; const m = b.length;
    const L = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
    for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i][j] = a[i] === b[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
    const out = []; const loose = []; let i = 0; let j = 0;
    while (j < m) {
      if (i < n && a[i] === b[j]) { i++; j++; loose.length = 0; } else if (i < n && L[i + 1][j] >= L[i][j + 1]) loose.push(a[i++]);
      else {
        const was = loose.length ? loose.shift() : '';
        let p = 0; while (p < was.length && p < b[j].length && was[p] === b[j][p]) p++;
        if (p < b[j].length) out.push({ line: j, from: p });
        j++;
      }
    }
    return out;
  }
  // Ink (the owner's pick): the new letters appear one after the other, as if written (.ink, list-cards.css). At most
  // INK_MAX letters write themselves in (half a second in all); the rest of a long paste fades in with the last one.
  const INK_MAX = 160;
  const INK_STEP = 22; // ms between two letters
  const graphemes = typeof Intl.Segmenter === 'function' ? new Intl.Segmenter(undefined, { granularity: 'grapheme' }) : null;
  const lettersOf = (t) => (graphemes ? [...graphemes.segment(t)].map((x) => x.segment) : [...t]);
  function inkIn(card, before) {
    if (!before || matchMedia('(prefers-reduced-motion: reduce)').matches) return; // "Reduce animations" in Windows
    const lines = cardLines(card);
    const parts = newLetters(before, lines.map((l) => l.textContent));
    if (!parts.length) return;
    // every text bit after the first new letter, in reading order
    const bits = [];
    for (const { line, from } of parts) {
      let skip = from;
      const walk = document.createTreeWalker(lines[line], NodeFilter.SHOW_TEXT);
      for (let t = walk.nextNode(); t; t = walk.nextNode()) {
        if (skip >= t.data.length) { skip -= t.data.length; continue; }
        bits.push({ t, from: skip }); skip = 0;
      }
    }
    const total = bits.reduce((s, b) => s + lettersOf(b.t.data.slice(b.from)).length, 0);
    const step = Math.min(INK_STEP, 520 / Math.min(total, INK_MAX));
    let k = 0;
    for (const { t, from } of bits) {
      const keep = t.data.slice(0, from);
      const spans = [];
      let rest = '';
      for (const ch of lettersOf(t.data.slice(from))) {
        if (k >= INK_MAX) { rest += ch; continue; }
        spans.push(h('span', { class: 'ink', style: `animation-delay:${Math.round(k * step)}ms` }, ch)); k++;
      }
      if (rest) spans.push(h('span', { class: 'ink', style: `animation-delay:${Math.round((INK_MAX - 1) * step)}ms` }, rest));
      t.replaceWith(...(keep ? [keep] : []), ...spans);
    }
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
    refreshed.clear();
    const done = () => {
      placeCards(box, els);
      cardCache = used;
      // 1.4.16: a picture the window already has (this card's, a moment ago) can be shown at once. Its load event only
      // comes a frame later, and until then it is hidden (.wait): the picture blinked on every refresh
      for (const img of box.querySelectorAll('img.wait')) if (img.complete && img.naturalWidth) img.dispatchEvent(new Event('load'));
      // 1.2.3 (speed): a card kept from last time looks exactly as before, so only the cards built (1.4.16: or filled again) now are measured
      // (markMore) and get their effect set up (paintFx). When the card size, the theme or the window's width changed,
      // the kept cards changed too: then all of them, as before.
      const look = `${sizeNow()}|${themeNow()}|${box.clientWidth}`;
      const fresh = look === lastLook ? new Set(els.filter((el) => !old.has(el) || refreshed.has(el))) : null;
      lastLook = look;
      paintCards(fresh);
      markMore(fresh
        ? [...new Set([...[...fresh].map((el) => el.querySelector(':scope > .body')).filter(Boolean), ...box.querySelectorAll('.card > .body:not([data-m])'), ...document.querySelectorAll('.sheet > .body')])]
        : box.querySelectorAll('.card > .body, .sheet > .body'));
    };
    // 1.4.10: the words typed (q) and the tags: picked under the search box or typed as #tag (fd.on)
    const fd = finding();
    const q = fd.text;
    const asked = [...V.tagPick.map((t) => `#${t}`), V.query.trim()].filter(Boolean).join(' ');
    const notFound = (what, inner) => emptyState('Nothing found', fd.on ? `${inner || `No ${what}`} matches “${asked}”.` : `${inner || `No ${what}`} contains “${asked}”.`);
    const fits = (it) => (it.kind === 'group' ? groupFits(it.group, fd) : noteFits(it.note, fd));
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
      if (q || fd.on) items = items.filter(fits);
      if (!items.length) {
        els.push(q || fd.on
          ? notFound('favourite')
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
      if (q || fd.on) items = items.filter(fits);
      if (!items.length) {
        els.push(q || fd.on
          ? (V.state.settings.unlockedAll ? notFound('locked note') : emptyState('Nothing found', fd.on ? `Nothing locked matches “${asked}”. Unlock all to see their tags and words too.` : `No locked note’s title has “${asked}”. Unlock all to search their words too.`))
          : emptyState('Nothing locked', 'Lock a note or group with the lock on its card, or by right-clicking it.'));
      }
      sortItems(items).forEach((it, i) => els.push(it.kind === 'group' ? groupEl(it.group, it.notes, i, used) : noteEl(it.note, i, !!it.note.groupId, used)));
      done();
      if (f.hidden) $('#tip').textContent = f.hidden === 1 ? '1 more is in a locked group. Unlock all to see it.' : `${f.hidden} more are in a locked group. Unlock all to see them.`;
      if ($('#viewNotes').scrollTop !== scroll) $('#viewNotes').scrollTop = scroll;
      return;
    }

    // 1.4.1: the reminders filter: every note with a reminder (and the search), the ones ringing first, then the soonest
    if (V.remOnly) {
      const due = (n) => (n.reminders.some((r) => r.firing) ? -1 : (R && R.nextOf(n.reminders)) ?? Infinity);
      const found = liveNotes.filter((n) => n.reminders && n.reminders.length && noteFits(n, fd));
      found.sort((a, b) => due(a) - due(b));
      if (!found.length) els.push(q || fd.on ? notFound('', 'No note with a reminder') : emptyState('No reminders', 'Add one in a note (Add → Reminder), or right-click a note here.'));
      found.forEach((n, i) => els.push(noteEl(n, i, !!n.groupId, used)));
      done();
      if ($('#viewNotes').scrollTop !== scroll) $('#viewNotes').scrollTop = scroll;
      return;
    }

    // search: one flat list of every matching note (only inside the open group, when one is open). 1.4.10: with tags,
    // the groups that have them too (the outermost: one inside it has them as well, and its notes show anyway)
    if (q || fd.on) {
      const pool = g ? notesInTree(g.id) : liveNotes;
      const found = pool.filter((n) => noteFits(n, fd)).map((n) => ({ kind: 'note', note: n }));
      if (fd.on) {
        const inside = g ? subtreeIds(g.id) : null;
        for (const x of V.state.groups) {
          if ((inside && (!inside.has(x.id) || x.id === g.id)) || !groupShown(x) || !groupFits(x, fd)) continue;
          const up = x.parentId ? groupById(x.parentId) : null;
          if (up && (!g || up.id !== g.id) && groupFits(up, fd)) continue;
          const ns = notesInTree(x.id);
          if (ns.length) found.push({ kind: 'group', group: x, notes: ns });
        }
      }
      const items = sortItems(found);
      if (!items.length) els.push(notFound('', `No note${g ? ' in this group' : ''}`));
      items.forEach((it, i) => els.push(it.kind === 'group' ? groupEl(it.group, it.notes, i, used) : noteEl(it.note, i, !!it.note.groupId, used)));
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
