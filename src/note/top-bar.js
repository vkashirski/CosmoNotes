'use strict';
// CosmoNotes note window, part 15 of 16 (1.4.11): a small note's top bar. The title is what matters most: when the buttons
// leave it too little room, the least needed ones move into one button, » (#btnMore), whose menu lists them. Close, and
// the click-through button while it is on, always stay. This replaces the old one-button-at-a-time hiding rules.
// 1.4.18: »'s menu is the app's own (it was Windows' menu; the owner's wish): the note's menu (showMenu), in a small window
// of its own just under », so it shows whole on the smallest note and on a rolled-up one.
(() => {
  const K = window.COSMO_NOTE_KIT;
  const { V, $, body, showMenu, hideCtx, ctxOpen, api } = K;
  const bar = $('#bar');
  const title = $('#title');
  const more = $('#btnMore');
  const sep = bar.querySelector('.hsep');
  const fill = bar.querySelector('.barfill'); // 1.4.26: the rest of the bar (the title is as wide as its words)
  const ren = $('#btnRename');
  const edit = $('#titleEdit');
  // first to go … last to go
  const ORDER = ['btnMax', 'btnMin', 'btnNew', 'btnList', 'btnRename', 'btnFx', 'btnRelock', 'btnCloseAll', 'btnPanic', 'btnMenu', 'btnPin', 'btnRoll'];
  const TITLE_MAX = 220; // px: the most a long title asks for (it may still get more), so a wide note keeps its buttons

  const pressed = (id) => $('#' + id).getAttribute('aria-pressed') === 'true';
  // each button's line in the menu: short words instead of the tooltips, with the button's picture (checked: a tick)
  const ITEMS = {
    btnRename: () => [{ id: 'btnRename', label: ren.classList.contains('undo') ? 'Undo rename' : 'Rename…' }], // 1.4.26
    btnList: () => [{ id: 'btnList', label: 'All notes' }],
    btnNew: () => [{ id: 'btnNew', label: 'New note' }],
    btnPanic: () => [{ id: 'btnPanic', label: 'Panic' }],
    btnRelock: () => [{ id: 'btnRelock', label: 'Lock again' }],
    btnFx: () => [{ id: 'btnFx', label: pressed('btnFx') ? 'Play effects' : 'Pause effects' }],
    btnPin: () => [{ id: 'btnPin', label: 'Pin on top', checked: pressed('btnPin') }, { id: 'pinMenu', label: 'Pin options…' }],
    btnRoll: () => [{ id: 'btnRoll', label: body.classList.contains('rolled') ? 'Unroll' : 'Roll up' }],
    btnCloseAll: () => [{ id: 'btnCloseAll', label: 'Close all menus' }],
    btnMenu: () => [{ id: 'btnMenu', label: 'Title, colour and more…' }],
    btnMin: () => [{ id: 'btnMin', label: 'Minimise' }],
    btnMax: () => [{ id: 'btnMax', label: body.classList.contains('maxed') ? 'Normal size' : 'Maximise' }],
  };

  const shows = (el) => el.getClientRects().length > 0;
  const room = (el) => { const s = getComputedStyle(el); return el.getBoundingClientRect().width + parseFloat(s.marginLeft) + parseFloat(s.marginRight); };
  // the room the title asks for: its whole width, but at most TITLE_MAX and at most `most` (the bar but » and the buttons
  // that always stay: on a small note, everything else goes). None while it doesn't show (no title, not rolled up).
  function titleNeed(most) {
    if (!body.classList.contains('has-title') && !body.classList.contains('rolled')) return 0;
    const r = document.createRange();
    r.selectNodeContents(title);
    const text = r.getBoundingClientRect().width;
    if (!text) return 0;
    const s = getComputedStyle(title);
    return Math.max(0, Math.min(Math.ceil(text + parseFloat(s.paddingLeft) + parseFloat(s.paddingRight)) + 1, TITLE_MAX, most));
  }
  function fit() {
    const w = bar.clientWidth;
    if (!w || body.classList.contains('renaming')) return; // 1.4.26: while renaming, the field takes the title's room as it is
    for (const id of ORDER) $('#' + id).classList.remove('over');
    sep.classList.remove('over');
    more.hidden = true;
    const s = getComputedStyle(bar);
    const gap = parseFloat(s.columnGap) || 0;
    const inner = w - parseFloat(s.paddingLeft) - parseFloat(s.paddingRight);
    const kids = [...bar.children].filter((el) => el !== title && el !== fill && el !== edit && shows(el));
    const stay = kids.filter((el) => !ORDER.includes(el.id) && el !== sep); // Close, and click-through while it's on
    const need = titleNeed(inner - stay.reduce((sum, el) => sum + room(el) + gap, 0) - room($('#btnClose')) - gap); // (» is as wide as Close)
    let free = inner - kids.reduce((sum, el) => sum + room(el) + gap, 0);
    if (free >= need) return;
    more.hidden = false;
    free -= room(more) + gap;
    let moved = 0;
    for (const id of ORDER) {
      if (free >= need) break;
      const el = $('#' + id);
      if (!shows(el) || (el === ren && ren.classList.contains('undo'))) continue; // 1.4.26: the undo arrow stays where the rename was
      free += room(el) + gap;
      el.classList.add('over');
      moved++;
    }
    if (!moved) { more.hidden = true; return; }
    if (!shows($('#btnMin')) && !shows($('#btnMax'))) sep.classList.add('over'); // nothing left for it to set apart
  }
  // again whenever the bar's width, a button, the title or its font changes (once a frame at most)
  let queued = false;
  const watch = new MutationObserver(() => soon());
  function soon() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      fit();
      watch.takeRecords(); // fit's own changes
    });
  }
  watch.observe(bar, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['hidden'] });
  watch.observe(body, { attributes: true, attributeFilter: ['class', 'data-tfont', 'data-font'] });
  new ResizeObserver(soon).observe(bar);
  document.fonts.addEventListener('loadingdone', soon); // a title font that loads late
  soon();

  // ---- »'s menu (1.4.18): the note's own menu (menus-voice-ink.js showMenu: the app's look, in a window of its own), under
  // », its right edge at »'s (main keeps it on the screen). It is made afresh each time from the buttons in » now; rolling
  // up, or » going away (a wide note), closes it.
  // a button's picture for its line (the one it shows now: Maximise / Normal size; the pin without its little window)
  function picture(id) {
    const b = $('#' + id);
    const svg = b && b.querySelector(id === 'btnMax' ? (body.classList.contains('maxed') ? '.i-restore' : '.i-max')
      : id === 'btnRename' ? (b.classList.contains('undo') ? '.i-undo' : '.i-pen') : 'svg:not(.pinwin)');
    if (!svg) return null; // (Pin options…)
    const c = svg.cloneNode(true);
    c.removeAttribute('class');
    c.setAttribute('aria-hidden', 'true');
    if (id === 'btnRoll' && body.classList.contains('rolled')) c.style.transform = 'rotate(180deg)'; // Unroll: it points down
    return c;
  }
  // a line picked: the menu has closed; the button itself does it (so it works the same as in the bar)
  function pick(id) {
    if (id === 'pinMenu') { $('#btnPin').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true })); return; }
    const b = ORDER.includes(id) ? $('#' + id) : null;
    if (b && b.classList.contains('over') && !b.hidden) b.click();
  }
  let rolledAt = false;
  more.addEventListener('click', () => {
    if (ctxOpen() && more.getAttribute('aria-expanded') === 'true') { hideCtx(); return; }
    const items = [];
    for (const el of bar.children) if (el.classList.contains('over') && ITEMS[el.id]) items.push(...ITEMS[el.id]());
    if (!items.length) return;
    rolledAt = body.classList.contains('rolled');
    const r = more.getBoundingClientRect();
    showMenu(items.map((it) => ({ ...it, icon: picture(it.id), run: () => pick(it.id) })), (w) => ({ x: r.right - w, y: r.bottom + 3 }), { owner: more });
  });
  const mine = () => ctxOpen() && more.getAttribute('aria-expanded') === 'true';
  new MutationObserver(() => { if (mine() && body.classList.contains('rolled') !== rolledAt) hideCtx(); }).observe(body, { attributes: true, attributeFilter: ['class'] });
  new MutationObserver(() => { if (mine() && more.hidden) hideCtx(); }).observe(more, { attributes: true, attributeFilter: ['hidden'] });
  // ---- 1.4.26 (the owner's idea): rename from the bar. The title stays a drag area (dragging, double-click = maximise and
  // snapping are Windows' own, so the page never sees a double-click there); the pencil next to it opens #titleEdit in its
  // place. Enter or a click away keeps the new title, Esc puts it back. It goes through the ⋯ menu's title field (its
  // 'input' saves it), so there is one way a title is saved. After a rename the pencil is an undo arrow for UNDO_MS (it
  // is right where the rename was, and shows on a rolled-up note too). Never while the note's words are hidden.
  const UNDO_MS = 8000;
  let before = null; // the title before the rename, while the undo arrow shows
  let undoTimer = null;
  function setTitle(t) {
    if (V.hidden || !V.note) return;
    const f = $('#titleInput');
    f.value = t;
    f.dispatchEvent(new Event('input'));
  }
  function stopUndo() {
    clearTimeout(undoTimer);
    ren.classList.remove('undo');
    ren.title = ren.ariaLabel = V.note && V.note.title && V.note.title.trim() ? 'Rename' : 'Add a title';
    before = null;
    soon(); // the pencil may go into » again
  }
  function startRename() {
    if (V.hidden || !V.note || body.classList.contains('renaming')) return;
    stopUndo();
    edit.value = V.note.title || '';
    edit.dataset.was = edit.value;
    body.classList.add('renaming');
    edit.hidden = false;
    edit.focus();
    edit.select();
  }
  function endRename(keep) {
    if (!body.classList.contains('renaming')) return;
    body.classList.remove('renaming');
    edit.hidden = true;
    const was = edit.dataset.was;
    if (!keep || V.hidden || edit.value === was) { stopUndo(); return; }
    setTitle(edit.value);
    before = was;
    ren.classList.add('undo');
    ren.title = ren.ariaLabel = 'Undo rename';
    soon();
    clearTimeout(undoTimer);
    undoTimer = setTimeout(stopUndo, UNDO_MS);
  }
  ren.addEventListener('click', () => {
    if (ren.classList.contains('undo')) { const t = before; stopUndo(); setTitle(t); return; }
    startRename();
  });
  edit.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); endRename(true); }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); endRename(false); }
  });
  edit.addEventListener('blur', () => endRename(true));
  // locked (the words hidden): no pencil, and a rename under way is dropped, never saved
  const lockWatch = () => {
    const hid = body.classList.contains('locked-hidden');
    if (hid) { endRename(false); stopUndo(); }
    if (ren.hidden !== hid) ren.hidden = hid;
    else if (!ren.classList.contains('undo')) ren.title = ren.ariaLabel = V.note && V.note.title && V.note.title.trim() ? 'Rename' : 'Add a title';
  };
  new MutationObserver(lockWatch).observe(body, { attributes: true, attributeFilter: ['class'] });
  lockWatch();
  // 1.4.29: the pencil shows while the mouse is over the bar. The bar is a drag area, so the page never sees the mouse
  // there: main does (main/bar-hover.js) and tells us.
  if (api.onBarHover) api.onBarHover((on) => body.classList.toggle('bar-hover', on));
})();
