'use strict';
// A note's top bar and its right-click Add, in Chromium with a stand-in main (1.4.11; main's side: windows.test.js):
// - a small note's top bar (src/note/top-bar.js): the title gets the room it needs (up to 220 px, all but » and Close on a
//   small note); the buttons that don't fit go into one » button, the least needed first (Maximise, Minimise, +…); Close stays; the bar
//   never runs over; wider again, they come back. »'s menu (1.4.18: the app's own, in a window of its own under »:
//   ink.show with bar 'more') lists the buttons in their order, each with its picture (the pin with a tick when on, and its
//   options), in the app theme's colours; a line picked does what the button does; Esc, a click in the note, » again, a
//   wider note close it; it opens on a rolled-up note too; showing it or a press in it brings it up (touch).
// - the text's right-click menu (1.4.18: the same menu, not Windows'): main's lines (onCtx) at the mouse, an off line, the
//   keys (↑ ↓ Enter, → into Add ▸ and ← back, Esc, another key closes it), the line picked goes back (ctxAct). Add ▸ is
//   first (1.4.21), its lines with the Add panel's pictures.
// - 1.4.21: the menu's window is made once and kept (only hidden when the menu shuts), and made ahead of time while the note
//   doesn't have the focus: a right-click opens no new window (that made the menu slow).
// - a press in the note brings it up (touch '').
// - right-click in the text → Add ▸ (main/web.js): the window gives main the Add panel's items once (addItems); the one
//   main sends back (onAdd) runs as from the panel; not while the note's words are hidden.
const assert = require('assert');

(async () => {
  const nu = await require('./helpers/note-ui')();
  // the stand-in main: catches the outside windows' shows / hides, touch and addItems, and keeps the callback of onAdd
  const catchMain = () => {
    const old = window.sticky;
    window.__main = []; window.__add = null;
    const ink = { show: (s) => { window.__main.push(['show', s]); }, hide: (b) => { window.__main.push(['hide', b]); }, drag() {}, size() {}, drop: () => Promise.resolve(null) };
    window.sticky = new Proxy({}, { get: (t, k) => {
      if (k === 'ink') return ink;
      if (k === 'touch') return (part) => { window.__main.push(['touch', part]); };
      if (k === 'onCtx') return (cb) => { window.__onCtx = cb; };
      if (k === 'ctxAct') return (id) => { window.__main.push(['act', id]); };
      if (k === 'addItems') return (list) => { window.__add = list; };
      if (k === 'onAdd') return (cb) => { window.__onAdd = cb; };
      if (k === 'pinApps') return () => Promise.resolve([]);
      return old[k];
    } });
  };
  const inBar = (page) => page.evaluate(() => [...document.querySelectorAll('#bar > *')].filter((x) => x.getClientRects().length).map((x) => x.id || x.className));
  const fits = (page) => page.evaluate(() => { const b = document.querySelector('#bar'); return b.scrollWidth <= b.clientWidth && document.querySelector('#btnClose').getBoundingClientRect().right <= innerWidth; });
  const titleW = (page) => page.evaluate(() => document.querySelector('#title').getBoundingClientRect().width);
  const textW = (page) => page.evaluate(() => { const r = document.createRange(); r.selectNodeContents(document.querySelector('#title')); return r.getBoundingClientRect().width; });
  const settle = (page) => page.waitForTimeout(120);
  // a note window that keeps the windows it opens (page.pops)
  const openNote = async (...a) => { const pg = await nu.open(...a); pg.pops = []; pg.on('popup', (x) => pg.pops.push(x)); return pg; };
  // 1.4.21: the menu's one window (made once, kept)
  const menuWin = async (page) => {
    for (let i = 0; i < 80; i++) {
      for (const x of page.pops) if (!x.isClosed() && await x.evaluate(() => window.name).catch(() => '') === 'cosmoMoreBar') return x;
      await new Promise((r) => setTimeout(r, 25));
    }
    throw new Error('the menu has no window');
  };
  const menuWins = async (page) => { let n = 0; for (const x of page.pops) if (!x.isClosed() && await x.evaluate(() => window.name).catch(() => '') === 'cosmoMoreBar') n++; return n; };
  // » pressed: its menu shows in its window; its lines
  const openMore = async (page) => {
    await page.evaluate(() => { window.__main = window.__main.filter(([w]) => w !== 'show'); });
    await page.click('#btnMore');
    await page.waitForFunction(() => window.__main.some(([w, s]) => w === 'show' && s.bar === 'more'));
    const pop = await menuWin(page); pop.page = page; return pop;
  };
  const lines = (pop) => pop.evaluate(() => [...document.querySelectorAll('#ctx .mi')].map((b) => ({ id: b.dataset.id, label: b.textContent, checked: b.getAttribute('aria-checked'), pic: !!b.querySelector('svg:not(.mtick)'), tick: !!b.querySelector('.mtick') })));
  const pickLine = (pop, id) => pop.evaluate((i) => document.querySelector(`#ctx .mi[data-id="${i}"]`).click(), id);
  // the menu shut: back in the note, hidden (1.4.21: its window stays, hidden by main)
  const shut = async (pop) => {
    for (let i = 0; i < 20; i++) {
      if (await pop.page.evaluate(() => { const m = document.getElementById('ctx'); return !!m && m.hidden; })) return !pop.isClosed();
      await new Promise((r) => setTimeout(r, 25));
    }
    return false;
  };
  const mainSaw = (page) => page.evaluate(() => window.__main.splice(0));
  const ALL = ['btnList', 'btnNew', 'title', 'btnPin', 'btnRoll', 'btnMenu', 'hsep', 'btnMin', 'btnMax', 'btnClose'];

  // ---- no title, wide enough: every button, no »
  let page = await openNote({ html: '<p>milk</p>' }, 360, 320, catchMain);
  await settle(page);
  assert.deepEqual(await inBar(page), ALL, 'a 360 px note: every button');
  // ---- a long title: it gets room, the least needed buttons go into »
  await page.evaluate(() => { const i = document.querySelector('#titleInput'); i.value = 'Everything for the weekend trip to the lake'; i.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.waitForTimeout(400); // the title is saved
  let now = await inBar(page);
  assert.ok(now.includes('btnMore') && !now.includes('btnMax') && !now.includes('btnMin'), `Maximise and Minimise go first (${now})`);
  assert.ok(now.includes('btnClose') && now.includes('btnPin'), 'Close stays, and the pin while there is room');
  assert.ok(!now.includes('hsep'), 'no line before Close with nothing to set apart');
  assert.ok(await titleW(page) >= 220, `a long title gets room, up to 220 px (${await titleW(page)})`);
  assert.ok(await fits(page), 'the bar never runs over');
  // ---- »'s menu: in a window of its own under », the buttons in their order, each with its picture
  await mainSaw(page);
  let pop = await openMore(page);
  let menu = await lines(pop);
  assert.deepEqual(menu.map((i) => i.id), ALL.filter((id) => id.startsWith('btn') && !now.includes(id)), 'its lines: the buttons that went, in the bar\'s order');
  assert.ok(menu.every((i) => i.pic), 'each with its button\'s picture');
  let saw = await mainSaw(page);
  const show = saw.find(([w]) => w === 'show')[1];
  const r = await page.evaluate(() => { const b = document.querySelector('#btnMore').getBoundingClientRect(); return { right: b.right, bottom: b.bottom }; });
  assert.equal(show.mode, 'free');
  assert.ok(Math.abs(show.dy + show.inset.t - (r.bottom + 3)) <= 1 && Math.abs(show.dx + show.inset.l + (show.w - show.inset.l - show.inset.r) - r.right) <= 2, `under », its right edge at »'s (${JSON.stringify(show)})`);
  assert.ok(saw.findIndex(([w, p]) => w === 'touch' && p === 'more') > saw.findIndex(([w]) => w === 'show'), 'shown, then brought up (touch)');
  await pop.evaluate(() => document.querySelector('#ctx').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })));
  assert.deepEqual(await mainSaw(page), [['touch', 'more']], 'a press in it brings it up');
  // Esc closes it (the keyboard stays in the note)
  await page.keyboard.press('Escape');
  assert.ok(await shut(pop), 'Esc: the menu shuts, its window stays (hidden)');
  assert.ok((await mainSaw(page)).some(([w, b]) => w === 'hide' && b === 'more'), 'main hides it');
  // a click in the note, or » again, closes it too
  pop = await openMore(page);
  await page.mouse.click(100, 200);
  assert.ok(await shut(pop), 'a click in the note closes it');
  assert.ok((await mainSaw(page)).some(([w, p]) => w === 'touch' && p === ''), 'a press in the note brings the note up');
  pop = await openMore(page);
  await page.click('#btnMore');
  assert.ok(await shut(pop), '» again closes it');
  assert.equal(await page.evaluate(() => document.querySelector('#ctx').hidden), true, 'back in the note, hidden');
  assert.equal(await menuWins(page), 1, 'one window for the menu all along');
  // ---- a 200 px note: the title, then », Close (and Roll up while it fits)
  await page.setViewportSize({ width: 200, height: 320 });
  await settle(page);
  now = await inBar(page);
  assert.deepEqual(now, ['title', 'btnMore', 'btnClose'], 'a small note: the title, », Close');
  assert.ok(await titleW(page) >= 194 - 2 * 26, `the title has the rest (${await titleW(page)})`);
  assert.ok(await fits(page));
  pop = await openMore(page);
  menu = await lines(pop);
  const ids = menu.map((i) => i.id);
  assert.deepEqual(ids.slice(0, 2), ['btnList', 'btnNew'], `left to right (${ids})`);
  const pin = menu.find((i) => i.id === 'btnPin');
  assert.ok(pin && pin.checked === 'false' && !pin.tick && ids[ids.indexOf('btnPin') + 1] === 'pinMenu', 'the pin can be ticked, its options after it');
  assert.ok(!menu.find((i) => i.id === 'pinMenu').pic, 'Pin options… has no picture');
  await pickLine(pop, 'btnPin');
  assert.ok(await shut(pop), 'a line picked closes the menu');
  await settle(page);
  assert.deepEqual((await page.updates()).pop(), { pinned: true }, 'picking the pin pins the note');
  pop = await openMore(page);
  assert.ok((await lines(pop)).find((i) => i.id === 'btnPin').tick, 'and it shows ticked');
  await pickLine(pop, 'pinMenu');
  await settle(page);
  assert.ok(await page.isVisible('#pinPop'), 'Pin options… opens the pin\'s right-click menu');
  await page.click('#pinX');
  // ---- wider again: the buttons come back, and an open menu closes
  pop = await openMore(page);
  await page.setViewportSize({ width: 700, height: 320 });
  await settle(page);
  assert.deepEqual(await inBar(page), ALL, 'a wide note: every button again, no »');
  assert.ok(await shut(pop), 'no », no menu');
  await page.close();

  // ---- the app theme's colours (like the right-click menu); a rolled-up note's » opens it too
  page = await openNote({ html: '<p>x</p>', title: 'A long title for a rolled up note', rolled: true, settings: { appTheme: 'night' } }, 200, 34, catchMain);
  await settle(page);
  assert.ok((await inBar(page)).includes('btnMore'), 'rolled up: » is there');
  pop = await openMore(page);
  const bg = await pop.evaluate(() => getComputedStyle(document.querySelector('#ctx')).backgroundColor);
  assert.equal(bg, await page.evaluate(() => getComputedStyle(document.querySelector('#menu')).backgroundColor), `the night theme's menu colour, as its pop-ups (${bg})`);
  assert.notEqual(bg, 'rgba(0, 0, 0, 0)');
  assert.ok((await lines(pop)).some((i) => i.id === 'btnRoll' && i.label === 'Unroll'), 'Unroll is in it');
  await pickLine(pop, 'btnRoll');
  assert.ok(await shut(pop));
  await settle(page);
  assert.deepEqual((await page.updates()).pop(), { rolled: false }, 'Unroll unrolls the note');
  await page.close();

  // ---- the smallest note without a title still fits every button it shows
  page = await openNote({ html: '<p>x</p>', settings: { appTheme: 'cream', panicOn: true } }, 200, 200, catchMain);
  await settle(page);
  assert.ok(await fits(page) && (await inBar(page)).includes('btnMore'), 'a 200 px note: » holds what doesn\'t fit');
  await page.close();
  // ---- a short title keeps its whole width
  page = await openNote({ html: '<p>x</p>', title: 'Hi' }, 260, 200, catchMain);
  await settle(page);
  assert.ok(await titleW(page) >= await textW(page), 'a short title shows whole');
  await page.close();

  // ---- 1.4.18: the text's right-click menu: main sends its lines; the note shows them in its own menu
  page = await openNote({ html: '<p>one two</p>' }, 220, 200, catchMain);
  await settle(page);
  await mainSaw(page);
  // (main/web.js: Add ▸ first, then a line; `pic` = the Add item's act)
  const LINES = { x: 30, y: 60, items: [{ id: 'sub0', label: 'Add', sub: [{ id: 'm1', label: 'Photo', pic: 'photo' }, { id: 'm2', label: 'Divider', pic: 'divider' }, { id: 'm3', label: 'Odd', pic: 'no such' }] }, '-', { id: 'm4', label: 'Cut', enabled: false }, { id: 'm5', label: 'Copy' }, { id: 'm6', label: 'Paste' }] };
  // 1.4.21: the menu's window is made ahead of time while the note doesn't have the focus (here: it never had it, or it
  // lost it), never while you type or draw in it
  await page.mouse.move(60, 60); await page.waitForTimeout(400);
  assert.equal(await menuWins(page), 0, 'not while the note has the focus');
  await page.evaluate(() => { document.hasFocus = () => false; window.dispatchEvent(new Event('blur')); });
  const warm = await menuWin(page);
  await page.evaluate(() => { delete document.hasFocus; });
  assert.equal(await page.evaluate(() => !!document.getElementById('ctx')), true, 'made ahead of time, the menu still in the note');
  const rightClick = async () => {
    await page.evaluate(() => { window.__main = window.__main.filter(([w]) => w !== 'show'); });
    await page.evaluate((m) => window.__onCtx(m), LINES);
    await page.waitForFunction(() => window.__main.some(([w, s]) => w === 'show' && s.bar === 'more'));
    const p = await menuWin(page); p.page = page; return p;
  };
  const words = (p) => p.evaluate(() => [...document.querySelectorAll('#ctx .mi')].map((b) => b.textContent + (b.disabled ? ' (off)' : '') + (b.classList.contains('hot') ? ' *' : '')));
  pop = await rightClick();
  assert.equal(pop, warm, 'shown in the window made ahead of time');
  assert.deepEqual(await words(pop), ['Add', 'Cut (off)', 'Copy', 'Paste'], 'main\'s lines, Add first, Cut off');
  saw = await mainSaw(page);
  const at = saw.find(([w]) => w === 'show')[1];
  assert.ok(at.dx + at.inset.l === 30 && at.dy + at.inset.t === 60, `at the mouse (${JSON.stringify(at)})`);
  await page.keyboard.press('ArrowDown'); await page.keyboard.press('ArrowDown'); await page.keyboard.press('ArrowDown');
  assert.deepEqual(await words(pop), ['Add', 'Cut (off)', 'Copy', 'Paste *'], '↓ ↓ ↓: on Paste (an off line is skipped)');
  await page.keyboard.press('Enter');
  assert.ok(await shut(pop), 'Enter: the menu closes');
  assert.ok((await mainSaw(page)).some(([w, id]) => w === 'act' && id === 'm6'), 'and main is asked to paste');
  pop = await rightClick();
  assert.equal(pop, warm, 'the same window again (no new one)');
  await page.keyboard.press('ArrowDown'); await page.keyboard.press('ArrowRight');
  assert.deepEqual(await words(pop), ['Add', 'Photo *', 'Divider', 'Odd'], '↓ is on Add, →: its lines, a way back first');
  const pics = await pop.evaluate(() => [...document.querySelectorAll('#ctx .mi')].slice(1).map((b) => (b.querySelector(':scope > .ic svg') ? getComputedStyle(b.querySelector(':scope > .ic')).backgroundColor : null)));
  assert.ok(pics[0] && pics[1] && pics[0] !== pics[1] && pics[2] === null, `Add ▸'s lines have the Add panel's pictures, in their colours (${pics})`);
  await page.keyboard.press('ArrowLeft');
  assert.deepEqual(await words(pop), ['Add', 'Cut (off)', 'Copy', 'Paste'], '←: back');
  await pop.evaluate(() => [...document.querySelectorAll('#ctx .mi')].find((b) => b.textContent === 'Add').click());
  await pop.evaluate(() => [...document.querySelectorAll('#ctx .mi')].find((b) => b.textContent === 'Divider').click());
  assert.ok(await shut(pop));
  assert.ok((await mainSaw(page)).some(([w, id]) => w === 'act' && id === 'm2'), 'a click in Add ▸ picks it');
  pop = await rightClick();
  await page.keyboard.press('Escape');
  assert.ok(await shut(pop), 'Esc closes it');
  pop = await rightClick();
  await page.keyboard.press('x');
  assert.ok(await shut(pop), 'another key closes it');
  assert.equal(await menuWins(page), 1, 'every right-click in the one window');
  await page.close();

  // ---- right-click → Add: the panel's items go to main once; the one main sends back runs
  page = await openNote({ html: '<p>one two</p>' }, 360, 320, catchMain);
  await settle(page);
  const add = await page.evaluate(() => window.__add);
  assert.deepEqual(add.map((a) => a.act), ['photo', 'voice', 'speak', 'drawing', 'link', 'table', 'numbers', 'divider', 'remind'], 'every Add item, in the panel\'s order (1.4.21: no Today’s date)');
  assert.deepEqual(add.find((a) => a.act === 'speak'), { act: 'speak', label: 'Voice to text' }, 'with the panel\'s names');
  await page.evaluate(() => {
    const ed = document.getElementById('editor'); ed.focus();
    const t = ed.querySelector('p').firstChild; const r = document.createRange(); r.setStart(t, 3); r.collapse(true);
    getSelection().removeAllRanges(); getSelection().addRange(r);
  });
  await page.waitForTimeout(60);
  await page.evaluate(() => window.__onAdd('divider'));
  await settle(page);
  assert.equal(await page.evaluate(() => document.querySelectorAll('#editor hr').length), 1, 'Add ▸ Divider puts a divider where the caret was');
  await page.evaluate(() => window.__onAdd('link'));
  await settle(page);
  assert.ok(await page.isVisible('#linkPop'), 'Add ▸ Link opens the link form');
  await page.click('#linkCancel');
  await page.evaluate(() => window.__onAdd('nothing'));
  await page.close();
  // a hidden locked note adds nothing
  page = await openNote({ html: '', locked: true, lockedBy: 'self', hidden: true }, 360, 320, catchMain);
  await settle(page);
  await page.evaluate(() => window.__onAdd('divider'));
  await settle(page);
  assert.equal(await page.evaluate(() => document.querySelectorAll('#editor hr').length), 0, 'hidden: nothing is added');
  await page.close();

  await nu.done();
  console.log('ok');
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
