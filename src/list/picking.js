'use strict';
// CosmoNotes "All notes" window, part 3 of 7: favourites, picking cards, the lock animation, the bar for the picked cards
// (src/list.js until 1.1.28; the parts load in order from list.html. How they share names: ai-context/splitting-code.md)
(() => {
  const K = window.COSMO_LIST_KIT;
  const { V, S, $, ICON, cardsTabNow, sel, h, when, plural, tilt, groupById,
    notesInTree, isInside, noteIsLocked, groupIsLocked, LOCKED_NO_DELETE, favourites, cardBody, markMore, emptyState,
    noteById } = K;
  // defined in a later part:
  const modal = K.later('modal'), toast = K.later('toast'), showCtx = K.later('showCtx'),
    paintFx = K.later('paintFx'), destroyNote = K.later('destroyNote'), ensurePassword = K.later('ensurePassword'),
    lockNote = K.later('lockNote'), lockGroup = K.later('lockGroup'), unlockNoteNow = K.later('unlockNoteNow'),
    relockNote = K.later('relockNote'), unlockGroupNow = K.later('unlockGroupNow'), relockGroup = K.later('relockGroup'),
    openEditMany = K.later('openEditMany');
  // ================================================================ favourites, selecting, the lock animation (1.1.13)
  function itemOfKey(k) {
    const id = k.slice(2);
    return k[0] === 'g' ? { kind: 'group', id, group: groupById(id) } : { kind: 'note', id, note: ((n) => (n && !n.deletedAt ? n : undefined))(noteById(id)) };
  }
  const thingOf = (k) => { const it = itemOfKey(k); return it.group || it.note || null; };
  const isFav = (k) => !!(thingOf(k) || {}).favorite;
  const selItems = () => [...sel].map(itemOfKey).filter((it) => it.group || it.note);

  // the star in a card's top-right corner: an outline while you point at the card, filled once it's a favourite
  function starBtn(key) {
    return h('button', {
      class: 'fav',
      html: ICON.star,
      onmousedown: (e) => e.stopPropagation(),
      onclick: (e) => { e.stopPropagation(); setFav([key], !isFav(key), e.currentTarget); },
    });
  }
  // 1.1.14: a lock / unlock button left of the star (shows while you point at the card), so locking doesn't
  // need the right-click menu. A note locked only by its group has none (its group is unlocked instead).
  // 1.1.47 (the owner's wish): on a locked one it unlocks only until CosmoNotes restarts ("Remove lock…" in the
  // right-click menu removes the lock for good); on one unlocked that way it locks it again.
  function lockBtn(kind, t) {
    if (kind === 'note' && t.locked && !t.ownLock) return null;
    const locked = kind === 'note' ? !!t.ownLock : !!t.locked;
    const what = kind === 'note' ? 'note' : 'group';
    const open = locked && unlockedNow(kind, t);
    return h('button', {
      class: 'lockb' + (locked ? ' on' : ''),
      title: !locked ? `Lock this ${what}` : open ? 'Lock again' : 'Unlock until CosmoNotes restarts…',
      html: locked && !open ? ICON.unlock : ICON.lock,
      onmousedown: (e) => e.stopPropagation(),
      onclick: (e) => {
        e.stopPropagation();
        if (!locked) (kind === 'note' ? lockNote(t) : lockGroup(t));
        else if (open) (kind === 'note' ? relockNote(t) : relockGroup(t));
        else (kind === 'note' ? unlockNoteNow(t) : unlockGroupNow(t));
      },
    });
  }
  // 1.1.47: a locked note or group that shows its contents right now (unlocked for now, in its open note window, or a
  // group opened in the list), not because of "Unlock all": its "Unlock" turns into "Lock again"
  function unlockedNow(kind, t) {
    if (kind === 'note') return !!(t.forNow || t.openUnlocked);
    return !!(t.forNow || (t.open && !V.state.settings.unlockedAll));
  }
  async function setFav(keys, on, btn) {
    const ids = [];
    for (const k of keys) { const t = thingOf(k); if (t) { t.favorite = on; ids.push(t.id); } }
    if (!ids.length) return;
    paintCards();
    const btns = btn ? [btn] : keys.map((k) => $(`#cards [data-key="${k}"] > .fav`)).filter(Boolean);
    if (on) btns.forEach((b) => {
      b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop'); setTimeout(() => b.classList.remove('pop'), 700);
      starDust(b);
    });
    if (V.tab !== 'favs' || on) $('#cFavs').textContent = favourites().notes.length + favourites().groups.length;
    await S.list.favorite(ids, on);
    if (keys.length > 1) toast(on ? `${plural(ids.length, 'favourite')} added ⭐` : 'Removed from favourites');
  }

  // Ctrl+click picks a card (again: un-picks it); Shift+click picks everything between the last pick and this one.
  // A plain click opens the card as before and forgets the picks.
  const visibleKeys = () => [...$('#cards').children].map((c) => c.dataset.key).filter(Boolean);
  function pickCard(e, key) {
    if (e.ctrlKey || e.metaKey) {
      if (sel.has(key)) sel.delete(key); else sel.add(key);
      V.selAnchor = key;
      paintCards();
      return true;
    }
    if (e.shiftKey && V.selAnchor) {
      const keys = visibleKeys();
      const a = keys.indexOf(V.selAnchor);
      const b = keys.indexOf(key);
      if (a < 0 || b < 0) sel.add(key);
      else for (let i = Math.min(a, b); i <= Math.max(a, b); i++) sel.add(keys[i]);
      paintCards();
      return true;
    }
    if (sel.size) clearSel();
    return false;
  }
  function clearSel() {
    sel.clear();
    V.selAnchor = null;
    paintCards();
  }
  // star, selection outline and lock animation for the cards on screen; forgets picks that aren't shown any more
  function lockStateOf(k) {
    const t = thingOf(k);
    if (!t) return 0;
    if (k[0] === 'g') return !t.open ? 2 : t.locked ? 1 : 0; // 2 = shut, 1 = locked but opened in the list
    return t.locked ? 2 : 0;
  }
  function paintCards(freshFx = null) { // freshFx (1.2.3): the cards a background refresh built again (see paintFx)
    const box = $('#cards');
    const shown = new Set();
    const seen = new Map();
    for (const c of box.children) {
      const k = c.dataset.key;
      if (!k) continue;
      shown.add(k);
      const fav = isFav(k);
      c.classList.toggle('is-fav', fav);
      const b = c.querySelector(':scope > .fav');
      if (b) {
        b.classList.toggle('on', fav);
        b.title = fav ? 'Remove from favourites' : 'Add to favourites';
      }
      c.classList.toggle('sel', sel.has(k));
      const ls = lockStateOf(k);
      seen.set(k, ls);
      const before = V.lockSeen.get(k);
      if (before !== undefined && before !== ls) snapLock(c, ls > before ? 'lock' : 'unlock', lockPos.get(k));
      const at = ls ? lockCentre(c) : null;
      if (at) lockPos.set(k, at); else if (!ls) lockPos.delete(k);
    }
    V.lockSeen = seen;
    for (const k of [...sel]) if (!shown.has(k)) sel.delete(k);
    paintBulk();
    paintFx(freshFx);
  }
  // "Snap shut" (1.1.14; 1.1.13 had "stardust"): locking drops the padlock in with a little bounce and its shackle
  // snaps shut; unlocking pops the shackle open and the padlock floats up as the card's contents fade in.
  const calm = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const lockPos = new Map(); // card key → where its padlock was last time { x, y, size } (for the unlock animation)
  // the middle of a card's padlock, measured in the card's own layout (so the card's little tilt doesn't matter)
  function lockCentre(card) {
    const mark = card.querySelector('.lockmark, .glock');
    const svg = mark && mark.querySelector('svg');
    if (!svg) return null;
    const cs = getComputedStyle(mark); // the padlock sits in the middle of the box without its padding
    const pt = parseFloat(cs.paddingTop) || 0;
    const pb = parseFloat(cs.paddingBottom) || 0;
    let x = mark.offsetWidth / 2;
    let y = pt + (mark.offsetHeight - pt - pb) / 2;
    for (let el = mark; el && el !== card; el = el.offsetParent) { x += el.offsetLeft; y += el.offsetTop; }
    return { x, y, size: parseFloat(getComputedStyle(svg).width) || 30 };
  }
  function snapLock(card, kind, was) {
    if (calm()) return;
    card.classList.remove('lock-anim', 'unlock-anim');
    void card.offsetWidth;
    card.classList.add(kind === 'lock' ? 'lock-anim' : 'unlock-anim');
    let fly = null;
    if (kind === 'unlock' && was) {
      // a copy of the padlock, where it was, opens and floats away
      fly = h('div', { class: 'lockfly', html: ICON.lockA, style: `left:${was.x - was.size / 2}px; top:${was.y - was.size / 2}px; width:${was.size}px; height:${was.size}px` });
      card.append(fly);
    }
    setTimeout(() => { if (fly) fly.remove(); card.classList.remove('lock-anim', 'unlock-anim'); }, 900);
  }

  // the stardust burst from a star that was just switched on (1.1.14, a little quicker than the lock's)
  function starDust(btn) {
    if (calm()) return;
    const r = btn.getBoundingClientRect();
    const dust = h('div', { class: 'stardust fixed fast', style: `left:${r.left + r.width / 2}px; top:${r.top + r.height / 2}px` }, ...Array.from({ length: 8 }, () => h('i')));
    document.body.append(dust);
    setTimeout(() => dust.remove(), 850);
  }

  // ---- the bar for the selected cards (bottom of the window)
  const bulk = h('div', { class: 'bulkbar', id: 'bulk', hidden: true });
  const bb = (id, icon, label, title, cls = '') => h('button', { class: `bb ${cls}`, id, title, html: `${icon}<span>${label}</span>` });
  bulk.append(
    h('span', { class: 'bcount', id: 'bulkCount' }),
    bb('bOpen', ICON.open, 'Open', 'Open the selected notes on the desktop'),
    bb('bClose', ICON.hide, 'Close', 'Close the selected notes (they stay here)'),
    bb('bFav', ICON.star, 'Favourite', ''),
    bb('bEdit', ICON.edit, 'Edit design', 'Colour, see-through and effects of the selected notes'),
    bb('bGroup', ICON.folder, 'Group', 'Put the selected notes and groups together in a new group'),
    bb('bLock', ICON.lock, 'Lock', 'Lock the selected notes and groups'),
    bb('bBin', ICON.trash, 'Bin', 'Move the selected notes to the Bin (Delete key)', 'danger'),
    h('button', { class: 'bb x', id: 'bX', title: 'Clear the selection (Esc)', html: ICON.x }));
  document.body.append(bulk);
  function bulkParts() {
    const items = selItems();
    const notes = items.filter((it) => it.note).map((it) => it.note);
    const groups = items.filter((it) => it.group).map((it) => it.group);
    return { items, notes, groups };
  }
  // 1.2.2: the notes Edit design changes: the picked notes and the notes in picked groups that are open
  function designNotes() {
    const { notes, groups } = bulkParts();
    const out = new Map(notes.map((n) => [n.id, n]));
    for (const g of groups) if (g.open) for (const n of notesInTree(g.id)) out.set(n.id, n);
    return [...out.values()];
  }
  const bulkEdit = () => openEditMany(designNotes());
  function paintBulk() {
    const { items, notes, groups } = bulkParts();
    const show = items.length > 0 && cardsTabNow();
    bulk.hidden = !show;
    document.body.classList.toggle('selecting', show);
    if (!show) return;
    $('#bulkCount').textContent = `${items.length} selected`;
    $('#bOpen').hidden = !notes.some((n) => !n.open);
    $('#bClose').hidden = !notes.some((n) => n.open);
    const allFav = items.every((it) => (it.note || it.group).favorite);
    $('#bFav').classList.toggle('on', allFav);
    $('#bFav').querySelector('span').textContent = allFav ? 'Unfavourite' : 'Favourite';
    $('#bFav').title = allFav ? 'Remove the selected ones from your favourites' : 'Add the selected ones to your favourites';
    $('#bEdit').hidden = !designNotes().length;
    $('#bGroup').hidden = items.length < 2;
    $('#bLock').hidden = !notes.some((n) => !n.ownLock) && !groups.some((g) => !g.locked);
    const canBin = notes.some((n) => !noteIsLocked(n)) || groups.some((g) => !groupIsLocked(g));
    $('#bBin').disabled = !canBin;
    $('#bBin').title = canBin ? 'Move the selected notes to the Bin (Delete key)' : LOCKED_NO_DELETE;
  }
  // right-click on one of several selected cards: the same actions as the bar
  function bulkMenu(e, key) {
    if (sel.size > 1 && sel.has(key)) {
      const { items, notes, groups } = bulkParts();
      const allFav = items.every((it) => (it.note || it.group).favorite);
      showCtx(e, [
        notes.some((n) => !n.open) ? { label: 'Open on desktop', icon: ICON.open, run: bulkOpen } : null,
        notes.some((n) => n.open) ? { label: 'Close notes', icon: ICON.hide, run: bulkClose } : null,
        { label: allFav ? 'Remove from favourites' : 'Add to favourites', icon: ICON.star, run: () => setFav([...sel], !allFav) },
        designNotes().length ? { label: 'Edit design…', icon: ICON.edit, run: bulkEdit } : null,
        '-',
        { label: 'Put together in a new group', icon: ICON.folder, run: bulkGroup },
        notes.some((n) => !n.ownLock) || groups.some((g) => !g.locked) ? { label: 'Lock', icon: ICON.lock, run: bulkLock } : null,
        '-',
        { label: `Move to Bin (${items.length})`, icon: ICON.trash, danger: true, run: () => bulkTrash(false), disabled: $('#bBin').disabled },
        { label: 'Clear selection', icon: ICON.x, run: clearSel },
      ]);
      return true;
    }
    if (sel.size && !sel.has(key)) clearSel();
    return false;
  }
  async function bulkOpen() { for (const n of bulkParts().notes) if (!n.open) await S.list.openNote(n.id); }
  async function bulkClose() { for (const n of bulkParts().notes) if (n.open) await S.list.closeNote(n.id); }
  async function bulkGroup() {
    const { items } = bulkParts();
    if (items.length < 2) return;
    const id = await S.groups.makeFrom(items.map((it) => it.id), V.tab === 'notes' ? V.openGroup || null : null);
    clearSel();
    toast(id ? 'Put together in a new group' : 'Could not make a group');
  }
  async function bulkLock() {
    const { notes, groups } = bulkParts();
    if (!(await ensurePassword())) return;
    for (const n of notes) if (!n.ownLock) await S.list.setLocked(n.id, true);
    for (const g of groups) if (!g.locked) await S.groups.setLocked(g.id, true);
    if (V.openGroup && groups.some((g) => V.openGroup === g.id || isInside(V.openGroup, g.id))) V.openGroup = null;
    clearSel();
    toast('Locked 🔒');
  }
  async function bulkTrash(skipAsk) {
    const { notes, groups } = bulkParts();
    const okNotes = notes.filter((n) => !noteIsLocked(n));
    const okGroups = groups.filter((g) => !groupIsLocked(g));
    const kept = notes.length + groups.length - okNotes.length - okGroups.length;
    if (!okNotes.length && !okGroups.length) { toast(LOCKED_NO_DELETE); return; }
    const inGroups = new Set();
    for (const g of okGroups) for (const n of notesInTree(g.id)) inGroups.add(n.id);
    const count = new Set([...okNotes.map((n) => n.id), ...inGroups]).size;
    if (!skipAsk) {
      const ok = await modal({
        title: `Move ${plural(count, 'note')} to the Bin?`,
        text: `They can be restored from the Bin any time.${kept ? ` ${plural(kept, 'locked one')} ${kept === 1 ? 'stays' : 'stay'} where ${kept === 1 ? 'it is' : 'they are'}.` : ''}`,
        tip: 'Tip: Shift+Delete skips this question.',
        okLabel: 'Move to Bin',
        danger: true,
      });
      if (!ok) return;
    }
    for (const g of okGroups) await S.groups.trash(g.id);
    for (const n of okNotes) if (!inGroups.has(n.id)) await S.list.trash(n.id);
    clearSel();
    toast(kept ? `Moved to the Bin · ${plural(kept, 'locked one')} kept` : 'Moved to the Bin');
  }
  $('#bOpen').addEventListener('click', bulkOpen);
  $('#bClose').addEventListener('click', bulkClose);
  $('#bFav').addEventListener('click', () => setFav([...sel], !$('#bFav').classList.contains('on')));
  $('#bEdit').addEventListener('click', bulkEdit);
  $('#bGroup').addEventListener('click', bulkGroup);
  $('#bLock').addEventListener('click', bulkLock);
  $('#bBin').addEventListener('click', (e) => bulkTrash(e.shiftKey));
  $('#bX').addEventListener('click', clearSel);


  function renderBin(binned) {
    const box = $('#binCards');
    box.innerHTML = '';
    $('#btnEmpty').disabled = !binned.length;
    if (!binned.length) {
      box.append(emptyState('The bin is empty', 'Deleted notes show up here.'));
      return;
    }
    const q = V.binQuery.trim().toLowerCase();
    const shown = q ? binned.filter((n) => `${n.title || ''}\n${n.text || ''}\n${n.pics || ''}`.toLowerCase().includes(q)) : binned;
    if (!shown.length) {
      box.append(emptyState('Nothing found', `No deleted note contains “${V.binQuery.trim()}”.`));
      return;
    }
    shown.sort((a, b) => b.deletedAt - a.deletedAt).forEach((n) => {
      const foot = h('div', { class: 'foot' },
        h('span', { class: 'when' }, 'Deleted ' + when(n.deletedAt).replace(/^(Today|Yesterday)/, (m) => m.toLowerCase())));
      const acts = h('div', { class: 'foot', style: 'padding-top:0' },
        h('button', { class: 'pill', onclick: () => S.list.restore(n.id) }, 'Restore'),
        h('button', { class: 'pill danger', disabled: noteIsLocked(n) || null, title: noteIsLocked(n) ? LOCKED_NO_DELETE : 'Delete forever (Shift+click: no question)', onclick: (e) => destroyNote(n, e.shiftKey) }, 'Delete'));
      box.append(h('div', {
        class: 'card binned', 'data-color': n.color, 'data-font': n.font, style: `--r:${tilt(n.id)}deg`,
        oncontextmenu: (e) => { e.preventDefault(); showCtx(e, [
          { label: 'Restore', icon: ICON.restore, run: () => S.list.restore(n.id) },
          '-',
          noteIsLocked(n)
            ? { label: 'Locked: can’t be deleted', icon: ICON.trash, disabled: true, run: () => {} }
            : { label: 'Delete forever…', icon: ICON.trash, danger: true, run: () => destroyNote(n) },
        ]); },
      }, h('div', { class: 'strip' }), cardBody(n), foot, acts));
    });
    markMore(box.querySelectorAll('.card > .body'));
  }

  Object.assign(K, { selItems, starBtn, lockBtn, unlockedNow, setFav, visibleKeys, pickCard, clearSel, paintCards, paintBulk,
    bulkMenu, bulkTrash, renderBin });
})();
