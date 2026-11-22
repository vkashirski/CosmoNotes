'use strict';
// Tags in a note window (1.4.10, src/note/tags.js). 1.4.30 (like GitHub labels): the ⋯ menu's Tags row, under See-through,
// shows every tag to press (this note's lit, the rest greyed, each in its colour); a press adds or removes it, each as its
// own change (note:tags), never with the note's words. + Add opens Manage tags (#tagPop): rename or colour a tag
// (tags:rename / tags:color), make one (it goes on this note too), delete one (tags:delete); a tag a locked note may have
// asks for the PIN first. Changes from the notes list show while the menu is open.
const assert = require('assert');

(async () => {
  const nu = await require('./helpers/note-ui')();
  const page = await nu.open({ html: '<div>milk</div>', text: 'milk', tags: ['home'], settings: { appTheme: 'cream', lockKind: 'pin' } }, 380, 640, () => {
    const base = window.sticky;
    window.__tagCalls = [];
    window.__manage = [];
    let have = ['home'];
    let all = [{ tag: 'home', count: 3, locked: false }, { tag: 'secret', count: 1, locked: true }, { tag: 'work', count: 5, locked: false }, { tag: 'workshop', count: 1, locked: false }];
    let colors = { work: 'blue' };
    let wrongOnce = true;
    const look = [];
    window.__look = (v) => look.forEach((cb) => cb(v));
    window.sticky = new Proxy({}, {
      get: (t, k) => {
        if (k === 'tags') return (c) => { window.__tagCalls.push(c); have = [...have.filter((x) => !(c.remove || []).includes(x)), ...(c.add || [])]; return Promise.resolve(have); };
        if (k === 'tagsAll') return () => Promise.resolve(JSON.parse(JSON.stringify({ tags: all, colors })));
        if (k === 'tagColor') return (tag, c) => { window.__manage.push(['color', tag, c]); colors = { ...colors, [tag]: c }; if (!all.some((x) => x.tag === tag)) all = [...all, { tag, count: 0, locked: false }]; return Promise.resolve({ ok: true }); };
        if (k === 'tagRename') return (a, b, pw) => { window.__manage.push(['rename', a, b, pw]); all = all.map((x) => (x.tag === a ? { ...x, tag: b } : x)); return Promise.resolve({ ok: true, count: 5 }); };
        if (k === 'tagDelete') return (tag, pw) => {
          window.__manage.push(['delete', tag, pw]);
          const it = all.find((x) => x.tag === tag);
          if (it && it.locked && !pw) return Promise.resolve({ ok: false, error: 'pin' });
          if (it && it.locked && wrongOnce) { wrongOnce = false; return Promise.resolve({ ok: false, error: 'wrong' }); }
          all = all.filter((x) => x.tag !== tag);
          return Promise.resolve({ ok: true, count: 1 });
        };
        if (k === 'onLook') return (cb) => { look.push(cb); return base.onLook(cb); };
        return base[k];
      },
    });
  });
  const chips = () => page.$$eval('#tagHere .tq', (x) => x.map((b) => `${b.classList.contains('on') ? '+' : '-'}${b.textContent}`));
  await nu.press(page, '#btnMenu');
  await page.waitForTimeout(80);
  assert.ok(await page.isVisible('#tagHere .tagpick'), 'the ⋯ menu has the Tags row');
  const order = await page.evaluate(() => [...document.querySelectorAll('#menu h4')].map((h) => h.textContent.trim().split(' ')[0]));
  assert.ok(order.indexOf('Tags') === order.indexOf('See-through') + 1, `Tags is right under See-through (${order})`);
  assert.deepEqual(await chips(), ['+#home', '-#secret', '-#work', '-#workshop'], 'every tag A to Z: this note’s lit, the rest greyed');
  assert.ok(Number(await page.$eval('#tagHere .tq[data-tag="work"]', (b) => getComputedStyle(b).opacity)) < 0.6, 'not on this note: greyed');
  assert.ok((await page.getAttribute('#tagHere .tq[data-tag="work"]', 'style')).includes('background'), 'a tag’s colour');
  assert.equal(await page.getAttribute('#tagHere .tq[data-tag="home"]', 'style'), '', 'none: the usual dark pill');
  assert.equal(Number(await page.$eval('#tagHere .tq[data-tag="home"]', (b) => getComputedStyle(b).opacity)), 1, 'on this note: not greyed');
  await nu.press(page, '#tagHere .tq[data-tag="work"]');
  await nu.press(page, '#tagHere .tq[data-tag="home"]');
  assert.deepEqual(await chips(), ['-#home', '-#secret', '+#work', '-#workshop'], 'a press lights it or greys it');
  assert.deepEqual(await page.evaluate(() => window.__tagCalls), [{ add: ['work'] }, { remove: ['home'] }], 'each change on its own');
  assert.equal(await page.isVisible('#menu'), true, 'the menu stays open');
  // changed from the list while the menu is open
  await page.evaluate(() => window.__look({ tags: ['secret'] }));
  await page.waitForTimeout(60);
  assert.deepEqual((await chips()).filter((r) => r.startsWith('+')), ['+#secret'], 'the list’s change shows');

  // ---- Manage tags
  await nu.press(page, '#tagHere .tqadd');
  await page.waitForTimeout(80);
  assert.ok(await page.isVisible('#tagPop .tagman'), '+ Add: Manage tags, a pop-up of its own');
  assert.ok(await page.isVisible('#menu'), 'the ⋯ menu stays as it was');
  const mrows = () => page.$$eval('#tagPop .tmrow', (x) => x.map((r) => r.dataset.tag));
  assert.deepEqual(await mrows(), ['home', 'secret', 'work', 'workshop']);
  // rename + colour
  await nu.press(page, '#tagPop .tmrow[data-tag="work"] .tmedit-b');
  assert.equal(await page.inputValue('#tagPop .tmedit .tinput'), 'work');
  await page.fill('#tagPop .tmedit .tinput', 'home');
  await page.dispatchEvent('#tagPop .tmedit .tinput', 'input');
  assert.ok((await page.textContent('#tagPop .tmmsg')).includes('joins them'), 'a name already there: it says they join');
  await page.fill('#tagPop .tmedit .tinput', 'Job');
  await page.dispatchEvent('#tagPop .tmedit .tinput', 'input');
  assert.ok((await page.textContent('#tagPop .tmmsg')).includes('5 notes'), 'how many notes it renames');
  await nu.press(page, '#tagPop .tsw[data-c="mint"]');
  await nu.press(page, '#tagPop .tmsave');
  await page.waitForTimeout(80);
  assert.deepEqual(await mrows(), ['home', 'job', 'secret', 'workshop'], 'renamed');
  // make one
  await nu.press(page, '#tagPop .tmadd');
  await page.fill('#tagPop .tmedit .tinput', 'Later');
  await page.dispatchEvent('#tagPop .tmedit .tinput', 'input');
  await page.press('#tagPop .tmedit .tinput', 'Enter');
  await page.waitForTimeout(80);
  assert.ok((await mrows()).includes('later'), 'a new tag');
  assert.ok((await chips()).includes('+#later'), 'made from this note: on it too, lit in the ⋯ menu');
  // delete: a tag no locked note has; then one that a locked note may have (the PIN, a wrong one, the right one)
  await nu.press(page, '#tagPop .tmrow[data-tag="workshop"] .tmdel-b');
  assert.ok((await page.textContent('#tagPop .tmq')).includes('1 note'));
  assert.ok(await page.isHidden('#tagPop .tmdel .tpin'), 'no PIN needed');
  await nu.press(page, '#tagPop .tmremove');
  await page.waitForTimeout(80);
  assert.ok(!(await mrows()).includes('workshop'), 'deleted');
  await nu.press(page, '#tagPop .tmrow[data-tag="secret"] .tmdel-b');
  assert.ok(await page.isVisible('#tagPop .tmdel .tpin'), 'a locked note may have it: the PIN');
  assert.ok((await page.textContent('#tagPop .tmdel .tmmsg')).includes('PIN'));
  await nu.press(page, '#tagPop .tmremove');
  await page.waitForTimeout(60);
  assert.ok((await mrows()).includes('secret'), 'not without the PIN');
  assert.ok(await page.evaluate(() => document.activeElement.classList.contains('tpin')), 'the PIN field gets the keyboard');
  await page.fill('#tagPop .tpin', '0000');
  await page.press('#tagPop .tpin', 'Enter');
  await page.waitForTimeout(60);
  assert.equal(await page.textContent('#tagPop .tmdel .tmmsg'), 'Wrong PIN.');
  await page.fill('#tagPop .tpin', '2580');
  await nu.press(page, '#tagPop .tmremove');
  await page.waitForTimeout(80);
  assert.ok(!(await mrows()).includes('secret'), 'the right PIN: deleted');
  assert.deepEqual(await page.evaluate(() => window.__manage), [
    ['rename', 'work', 'job', null], ['color', 'job', 'mint'], ['color', 'later', 'dark'],
    ['delete', 'workshop', null], ['delete', 'secret', '0000'], ['delete', 'secret', '2580'],
  ]);
  assert.ok((await chips()).includes('-#job') && !(await chips()).some((c) => c.endsWith('#workshop')), 'the ⋯ menu shows the new names');
  await nu.press(page, '#tagX');
  assert.ok(!(await page.isVisible('#tagPop')) && await page.isVisible('#menu'), 'its X closes only Manage tags');

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
