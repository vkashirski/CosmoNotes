'use strict';
// Tags in a note window (1.4.10, src/note/tags.js): the ⋯ menu's Tags row shows the note's own tags, suggests the ones in
// use, adds one typed (Enter) or suggested and removes one with ×, each as its own change (note:tags), never with the
// note's words (no save carries tags), and shows tags changed from the notes list while the menu is open.
const assert = require('assert');

(async () => {
  const nu = await require('./helpers/note-ui')();
  const page = await nu.open({ html: '<div>milk</div>', text: 'milk', tags: ['home'] }, 380, 520, () => {
    const base = window.sticky;
    window.__tagCalls = [];
    let have = ['home'];
    const look = [];
    window.__look = (v) => look.forEach((cb) => cb(v));
    window.sticky = new Proxy({}, {
      get: (t, k) => {
        if (k === 'tags') return (c) => { window.__tagCalls.push(c); have = [...have.filter((x) => !(c.remove || []).includes(x)), ...(c.add || [])]; return Promise.resolve(have); };
        if (k === 'tagsKnown') return () => Promise.resolve(['home', 'work', 'workshop']);
        if (k === 'onLook') return (cb) => { look.push(cb); return base.onLook(cb); };
        return base[k];
      },
    });
  });
  const chips = () => page.$$eval('#tagHere .tchip .tname', (x) => x.map((e) => e.textContent));
  await nu.press(page, '#btnMenu');
  await page.waitForTimeout(80);
  assert.ok(await page.isVisible('#tagHere .tagedit'), 'the ⋯ menu has the Tags row');
  assert.deepEqual(await chips(), ['#home'], 'its own tags');
  assert.deepEqual(await page.$$eval('#tagHere .tsg', (x) => x.map((e) => e.textContent)), ['#work', '#workshop'], 'suggestions: the others in use');
  await page.fill('#tagHere .tinput', 'Idea');
  await page.press('#tagHere .tinput', 'Enter');
  await page.waitForTimeout(60);
  assert.deepEqual(await chips(), ['#home', '#idea']);
  await page.fill('#tagHere .tinput', 'works');
  await page.dispatchEvent('#tagHere .tinput', 'input');
  assert.deepEqual(await page.$$eval('#tagHere .tsg', (x) => x.map((e) => e.textContent)), ['#workshop'], 'what is typed narrows them');
  await nu.press(page, '#tagHere .tsg');
  await nu.press(page, '#tagHere .tchip:first-child .tx');
  assert.deepEqual(await chips(), ['#idea', '#workshop']);
  assert.deepEqual(await page.evaluate(() => window.__tagCalls), [{ add: ['idea'] }, { add: ['workshop'] }, { remove: ['home'] }], 'each change on its own');
  assert.equal(await page.isVisible('#menu'), true, 'the menu stays open');
  // changed from the list while the menu is open
  await page.evaluate(() => window.__look({ tags: ['from-list'] }));
  await page.waitForTimeout(40);
  assert.deepEqual(await chips(), ['#from-list'], 'the list’s change shows');
  // typing in the note never sends tags
  await nu.press(page, '#menuX');
  await page.focus('#editor');
  await page.keyboard.type(' and eggs');
  await page.waitForTimeout(500);
  const ups = await page.updates();
  assert.ok(ups.length && ups.every((u) => !('tags' in u)), 'saves carry the words, never the tags');
  await nu.done();
  console.log('ok');
  process.exit(0);
})();
