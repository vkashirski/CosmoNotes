'use strict';
// A note's top bar and its right-click Add, in Chromium with a stand-in main (1.4.11; main's side: windows.test.js):
// - a small note's top bar (src/note/top-bar.js): the title gets the room it needs (up to 220 px, all but » and Close on a
//   small note); the buttons that don't fit go into one » button, the least needed first (Maximise, Minimise, +…); Close stays; the bar
//   never runs over; wider again, they come back. » asks main for its menu (barMenu) with the buttons' lines in their
//   order (the pin as a tick, and its options); a line picked (onBarAct) does what the button does.
// - right-click in the text → Add ▸ (main/web.js): the window gives main the Add panel's items once (addItems); the one
//   main sends back (onAdd) runs as from the panel; not while the note's words are hidden.
const assert = require('assert');

(async () => {
  const nu = await require('./helpers/note-ui')();
  // the stand-in main: catches barMenu / addItems, and keeps the callbacks of onBarAct / onAdd to call them
  const catchMain = () => {
    const old = window.sticky;
    window.__bar = []; window.__add = null;
    window.sticky = new Proxy({}, { get: (t, k) => {
      if (k === 'barMenu') return (items, x, y) => { window.__bar.push({ items, x, y }); };
      if (k === 'onBarAct') return (cb) => { window.__barAct = cb; };
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
  // ---- » asks main for its menu, the buttons in their order
  await page.click('#btnMore');
  let menu = (await page.evaluate(() => window.__bar)).pop();
  assert.deepEqual(menu.items.map((i) => i.id), ALL.filter((id) => id.startsWith('btn') && !now.includes(id)), 'its lines: the buttons that went, in the bar\'s order');
  assert.ok(menu.y >= 20 && menu.x > 0, 'under the » button');
  // a line picked does what its button does (Minimise: main is asked; nothing is saved)
  const before = (await page.updates()).length;
  await page.evaluate(() => window.__barAct('btnRoll'));
  await settle(page);
  assert.equal((await page.updates()).length, before, 'a button still in the bar isn\'t pressed from the menu');
  // ---- a 200 px note: the title, then », Close (and Roll up while it fits)
  await page.setViewportSize({ width: 200, height: 320 });
  await settle(page);
  now = await inBar(page);
  assert.deepEqual(now, ['title', 'btnMore', 'btnClose'], 'a small note: the title, », Close');
  assert.ok(await titleW(page) >= 194 - 2 * 26, `the title has the rest (${await titleW(page)})`);
  assert.ok(await fits(page));
  await page.click('#btnMore');
  menu = (await page.evaluate(() => window.__bar)).pop();
  const ids = menu.items.map((i) => i.id);
  assert.deepEqual(ids.slice(0, 2), ['btnList', 'btnNew'], `left to right (${ids})`);
  const pin = menu.items.find((i) => i.id === 'btnPin');
  assert.ok(pin && pin.checked === false && ids[ids.indexOf('btnPin') + 1] === 'pinMenu', 'the pin as a tick, its options after it');
  await page.evaluate(() => window.__barAct('btnPin'));
  await settle(page);
  assert.deepEqual((await page.updates()).pop(), { pinned: true }, 'picking the pin pins the note');
  await page.click('#btnMore');
  assert.equal((await page.evaluate(() => window.__bar)).pop().items.find((i) => i.id === 'btnPin').checked, true, 'and it shows ticked');
  await page.evaluate(() => window.__barAct('pinMenu'));
  await settle(page);
  assert.ok(await page.isVisible('#pinPop'), 'Pin options… opens the pin\'s right-click menu');
  await page.click('#pinX');
  // ---- wider again: the buttons come back
  await page.setViewportSize({ width: 700, height: 320 });
  await settle(page);
  assert.deepEqual(await inBar(page), ALL, 'a wide note: every button again, no »');
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
