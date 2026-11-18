'use strict';
// CosmoNotes note window, part 15 of 16 (1.4.11): a small note's top bar. The title is what matters most: when the buttons
// leave it too little room, the least needed ones move into one button, » (#btnMore), whose menu lists them. Close, and
// the click-through button while it is on, always stay. This replaces the old one-button-at-a-time hiding rules.
// 1.4.18: »'s menu is the app's own (it was Windows' menu; the owner's wish): the note's menu (showMenu), in a small window
// of its own just under », so it shows whole on the smallest note and on a rolled-up one.
(() => {
  const K = window.COSMO_NOTE_KIT;
  const { $, body, showMenu, hideCtx, ctxOpen } = K;
  const bar = $('#bar');
  const title = $('#title');
  const more = $('#btnMore');
  const sep = bar.querySelector('.hsep');
  // first to go … last to go
  const ORDER = ['btnMax', 'btnMin', 'btnNew', 'btnList', 'btnFx', 'btnRelock', 'btnCloseAll', 'btnPanic', 'btnMenu', 'btnPin', 'btnRoll'];
  const TITLE_MAX = 220; // px: the most a long title asks for (it may still get more), so a wide note keeps its buttons

  const pressed = (id) => $('#' + id).getAttribute('aria-pressed') === 'true';
  // each button's line in the menu: short words instead of the tooltips, with the button's picture (checked: a tick)
  const ITEMS = {
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
    if (!w) return;
    for (const id of ORDER) $('#' + id).classList.remove('over');
    sep.classList.remove('over');
    more.hidden = true;
    const s = getComputedStyle(bar);
    const gap = parseFloat(s.columnGap) || 0;
    const inner = w - parseFloat(s.paddingLeft) - parseFloat(s.paddingRight);
    const kids = [...bar.children].filter((el) => el !== title && shows(el));
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
      if (!shows(el)) continue;
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
    const svg = b && b.querySelector(id === 'btnMax' ? (body.classList.contains('maxed') ? '.i-restore' : '.i-max') : 'svg:not(.pinwin)');
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
})();
