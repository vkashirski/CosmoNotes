'use strict';
// App pins in a note window (1.4.5, src/note/pin-apps.js; main's side: app-pins.test.js), in Chromium with a stand-in main:
// right-click the pin → "Pin over": Every app, then the open apps A to Z with their workspaces under them; ticking saves
// pinApps (and pins), a ticked app greys its workspaces, an app it is pinned over that isn't open shows "not open", Every
// app = the normal pin, nothing ticked = not pinned; the pin's look (a little window behind it) and tooltip; a second right-click closes the list; a click on the pin unpins and forgets the apps.
const assert = require('assert');

(async () => {
  const nu = await require('./helpers/note-ui')();
  const OPEN = [{ app: 'Visual Studio Code', parts: ['ShopWebsite', 'CosmoNotes'] }, { app: 'excel', parts: ['Budget.xlsx'] }];
  const withApps = (apps) => `(() => { const old = window.sticky; window.sticky = new Proxy({}, { get: (t, k) => (k === 'pinApps' ? () => Promise.resolve(${JSON.stringify(apps)}) : old[k]) }); })()`;
  const rows = (page) => page.$$eval('#pinList .pa', (ls) => ls.map((l) => {
    const i = l.querySelector('input');
    return `${l.classList.contains('sub') ? '  ' : ''}${l.querySelector('span').textContent}${i.checked ? ' [x]' : ''}${i.disabled ? ' (grey)' : ''}${l.querySelector('em') ? ' · not open' : ''}`;
  }));
  const tickRow = async (page, name) => {
    await page.evaluate((n) => [...document.querySelectorAll('#pinList .pa')].find((l) => l.querySelector('span').textContent === n).click(), name);
    await page.waitForTimeout(40);
  };
  const last = async (page) => (await page.updates()).pop();
  const win = (page) => page.evaluate(() => getComputedStyle(document.querySelector('#btnPin .pinwin')).display !== 'none'); // the little window behind the pin
  const rightClickPin = async (page) => { await page.click('#btnPin', { button: 'right' }); await page.waitForTimeout(80); };

  // ---- an unpinned note: the list, A to Z
  let page = await nu.open({ html: '<div>tips</div>' }, 360, 420, withApps(OPEN));
  await rightClickPin(page);
  assert.ok(await page.isVisible('#pinPop'), 'right-click on the pin opens the list');
  await rightClickPin(page);
  assert.ok(!(await page.isVisible('#pinPop')), 'a second right-click closes it');
  await rightClickPin(page);
  assert.ok(await page.isVisible('#pinPop'), 'and a third opens it again');
  assert.deepEqual(await rows(page), ['Every app', 'excel', '  Budget.xlsx', 'Visual Studio Code', '  CosmoNotes', '  ShopWebsite'], 'every app, then A to Z, workspaces under their app');
  await tickRow(page, 'Visual Studio Code');
  assert.deepEqual(await last(page), { pinned: true, pinApps: [{ app: 'Visual Studio Code', part: null }] }, 'a ticked app pins the note over it');
  assert.deepEqual((await rows(page)).slice(3), ['Visual Studio Code [x]', '  CosmoNotes [x] (grey)', '  ShopWebsite [x] (grey)'], 'its workspaces are covered');
  assert.ok(await page.evaluate(() => document.querySelector('#btnPin').classList.contains('app')), 'the pin has its app look');
  assert.match(await page.getAttribute('#btnPin', 'title'), /^Pinned over Visual Studio Code\./);
  assert.equal(await page.getAttribute('#btnPin', 'aria-pressed'), 'true');
  assert.ok(await win(page), 'a little window behind the pin');
  await tickRow(page, 'Budget.xlsx');
  assert.deepEqual((await last(page)).pinApps, [{ app: 'Visual Studio Code', part: null }, { app: 'excel', part: 'Budget.xlsx' }], 'and only one Excel file');
  await tickRow(page, 'Visual Studio Code');
  await tickRow(page, 'ShopWebsite');
  assert.deepEqual((await last(page)).pinApps, [{ app: 'excel', part: 'Budget.xlsx' }, { app: 'Visual Studio Code', part: 'ShopWebsite' }], 'VS Code unticked, one of its folders ticked');
  assert.match(await page.getAttribute('#btnPin', 'title'), /excel: Budget\.xlsx, Visual Studio Code: ShopWebsite/);
  await tickRow(page, 'Every app');
  assert.deepEqual(await last(page), { pinned: true, pinApps: [] }, 'Every app = the normal pin');
  assert.ok(!(await page.evaluate(() => document.querySelector('#btnPin').classList.contains('app'))));
  assert.ok(!(await win(page)), 'the normal pin: no window');
  await tickRow(page, 'Every app');
  assert.deepEqual(await last(page), { pinned: false, clickThrough: false, pinApps: [] }, 'nothing ticked: not pinned');
  await tickRow(page, 'excel');
  await tickRow(page, 'excel');
  assert.deepEqual(await last(page), { pinned: false, clickThrough: false, pinApps: [] }, 'the last app unticked: not pinned');
  await page.click('#pinX');
  assert.ok(!(await page.isVisible('#pinPop')), 'its X closes it');
  await page.close();

  // ---- a note pinned over an app that isn't open, and one that can't list the apps
  page = await nu.open({ html: '<div>x</div>', pinned: true, pinApps: [{ app: 'SQL Server Management Studio', part: null }, { app: 'Visual Studio Code', part: 'Old' }] }, 360, 420, withApps(OPEN));
  assert.ok(await page.evaluate(() => document.querySelector('#btnPin').classList.contains('app')), 'opens with its app look');
  await rightClickPin(page);
  assert.deepEqual(await rows(page), ['Every app', 'excel', '  Budget.xlsx', 'SQL Server Management Studio [x] · not open', 'Visual Studio Code', '  CosmoNotes', '  Old [x] · not open', '  ShopWebsite'], 'ticked ones that aren’t open stay, A to Z');
  await page.click('#btnPin');
  await page.waitForTimeout(40);
  assert.deepEqual(await last(page), { pinned: false, clickThrough: false, pinApps: [] }, 'a click on the pin unpins and forgets the apps');
  await page.close();
  page = await nu.open({ html: '<div>x</div>' }, 360, 420, withApps(null));
  await rightClickPin(page);
  assert.equal(await page.textContent('#pinList .pa-none'), 'Couldn’t list your apps.');
  await page.close();
  page = await nu.open({ html: '<div>x</div>' }, 360, 420, withApps([]));
  await rightClickPin(page);
  assert.equal(await page.textContent('#pinList .pa-none'), 'No apps open.');
  assert.deepEqual(await rows(page), ['Every app']);
  await page.close();

  await nu.done();
  console.log('ok');
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
