'use strict';
// A note's top bar and its right-click Add, in Chromium with a stand-in main (1.4.11; main's side: windows.test.js):
// - a small note's top bar (src/note/top-bar.js): the title gets the room it needs (up to 220 px, all but » and Close on a
//   small note); the buttons that don't fit go into one » button, the least needed first (Maximise, Minimise, +…); Close stays; the bar
//   never runs over; wider again, they come back. »'s menu (1.4.18: the app's own, in a window of its own under »:
//   ink.show with bar 'more') lists the buttons in their order, each with its picture (the pin with a tick when on, and its
//   options), in the app theme's colours; a line picked does what the button does; Esc, a click in the note, » again, a
//   wider note close it; it opens on a rolled-up note too; showing it or a press in it brings it up (touch).
// - the text's right-click menu (1.4.18: the same menu, not Windows'): main's lines (onCtx) at the mouse, an off line, the
//   keys (↑ ↓ Enter, → into Add ▸ and ← back, Esc, another key closes it), the line picked goes back (ctxAct).
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
  // » pressed: its menu's window opens; its lines
  const openMore = async (page) => {
    const [pop] = await Promise.all([page.waitForEvent('popup'), page.click('#btnMore')]);
    await page.waitForFunction(() => window.__main.some(([w, s]) => w === 'show' && s.bar === 'more'));
    return pop;
  };
  const lines = (pop) => pop.evaluate(() => [...document.querySelectorAll('#ctx .mi')].map((b) => ({ id: b.dataset.id, label: b.textContent, checked: b.getAttribute('aria-checked'), pic: !!b.querySelector('svg:not(.mtick)'), tick: !!b.querySelector('.mtick') })));
  const pickLine = (pop, id) => pop.evaluate((i) => document.querySelector(`#ctx .mi[data-id="${i}"]`).click(), id);
  const shut = async (pop) => { for (let i = 0; i < 20 && !pop.isClosed(); i++) await new Promise((r) => setTimeout(r, 25)); return pop.isClosed(); };
  const mainSaw = (page) => page.evaluate(() => window.__main.splice(0));
  const ALL = ['btnList', 'btnNew', 'title', 'btnPin', 'btnRoll', 'btnMenu', 'hsep', 'btnMin', 'btnMax', 'btnClose'];

  // ---- no title, wide enough: every button, no »
  let page = await nu.open({ html: '<p>milk</p>' }, 360, 320, catchMain);
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
  assert.ok(await shut(pop), 'Esc: its window closes');
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
  page = await nu.open({ html: '<p>x</p>', title: 'A long title for a rolled up note', rolled: true, settings: { appTheme: 'night' } }, 200, 34, catchMain);
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
  page = await nu.open({ html: '<p>x</p>', settings: { appTheme: 'cream', panicOn: true } }, 200, 200, catchMain);
  await settle(page);
  assert.ok(await fits(page) && (await inBar(page)).includes('btnMore'), 'a 200 px note: » holds what doesn\'t fit');
  await page.close();
  // ---- a short title keeps its whole width
  page = await nu.open({ html: '<p>x</p>', title: 'Hi' }, 260, 200, catchMain);
  await settle(page);
  assert.ok(await titleW(page) >= await textW(page), 'a short title shows whole');
  await page.close();

  // ---- 1.4.18: the text's right-click menu: main sends its lines; the note shows them in its own menu
  page = await nu.open({ html: '<p>one two</p>' }, 220, 200, catchMain);
  await settle(page);
  await mainSaw(page);
  const LINES = { x: 30, y: 60, items: [{ id: 'm0', label: 'Cut', enabled: false }, { id: 'm1', label: 'Copy' }, { id: 'm2', label: 'Paste' }, '-', { id: 'sub3', label: 'Add', sub: [{ id: 'm4', label: 'Photo' }, { id: 'm5', label: 'Today’s date' }] }] };
  const rightClick = async () => {
    const [p] = await Promise.all([page.waitForEvent('popup'), page.evaluate((m) => window.__onCtx(m), LINES)]);
    await page.waitForFunction(() => window.__main.some(([w, s]) => w === 'show' && s.bar === 'more'));
    return p;
  };
  const words = (p) => p.evaluate(() => [...document.querySelectorAll('#ctx .mi')].map((b) => b.textContent + (b.disabled ? ' (off)' : '') + (b.classList.contains('hot') ? ' *' : '')));
  pop = await rightClick();
  assert.deepEqual(await words(pop), ['Cut (off)', 'Copy', 'Paste', 'Add'], 'main\'s lines, Cut off');
  saw = await mainSaw(page);
  const at = saw.find(([w]) => w === 'show')[1];
  assert.ok(at.dx + at.inset.l === 30 && at.dy + at.inset.t === 60, `at the mouse (${JSON.stringify(at)})`);
  await page.keyboard.press('ArrowDown'); await page.keyboard.press('ArrowDown');
  assert.deepEqual(await words(pop), ['Cut (off)', 'Copy', 'Paste *', 'Add'], '↓ ↓: on Paste (an off line is skipped)');
  await page.keyboard.press('Enter');
  assert.ok(await shut(pop), 'Enter: the menu closes');
  assert.ok((await mainSaw(page)).some(([w, id]) => w === 'act' && id === 'm2'), 'and main is asked to paste');
  pop = await rightClick();
  await page.keyboard.press('ArrowUp'); await page.keyboard.press('ArrowRight');
  assert.deepEqual(await words(pop), ['Add', 'Photo *', 'Today’s date'], '↑ is on Add, →: its lines, a way back first');
  await page.keyboard.press('ArrowLeft');
  assert.deepEqual(await words(pop), ['Cut (off)', 'Copy', 'Paste', 'Add'], '←: back');
  await pop.evaluate(() => [...document.querySelectorAll('#ctx .mi')].find((b) => b.textContent === 'Add').click());
  await pop.evaluate(() => [...document.querySelectorAll('#ctx .mi')].find((b) => b.textContent === 'Today’s date').click());
  assert.ok(await shut(pop));
  assert.ok((await mainSaw(page)).some(([w, id]) => w === 'act' && id === 'm5'), 'a click in Add ▸ picks it');
  pop = await rightClick();
  await page.keyboard.press('Escape');
  assert.ok(await shut(pop), 'Esc closes it');
  pop = await rightClick();
  await page.keyboard.press('x');
  assert.ok(await shut(pop), 'another key closes it');
  await page.close();

  // ---- right-click → Add: the panel's items go to main once; the one main sends back runs
  page = await nu.open({ html: '<p>one two</p>' }, 360, 320, catchMain);
  await settle(page);
  const add = await page.evaluate(() => window.__add);
  assert.deepEqual(add.map((a) => a.act), ['photo', 'voice', 'speak', 'drawing', 'link', 'table', 'numbers', 'divider', 'remind', 'date'], 'every Add item, in the panel\'s order');
  assert.deepEqual(add.find((a) => a.act === 'date'), { act: 'date', label: 'Today’s date' }, 'with the panel\'s words');
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
  page = await nu.open({ html: '', locked: true, lockedBy: 'self', hidden: true }, 360, 320, catchMain);
  await settle(page);
  await page.evaluate(() => window.__onAdd('divider'));
  await settle(page);
  assert.equal(await page.evaluate(() => document.querySelectorAll('#editor hr').length), 0, 'hidden: nothing is added');
  await page.close();

  await nu.done();
  console.log('ok');
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
