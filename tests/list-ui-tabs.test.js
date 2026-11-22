'use strict';
// The notes list's tab bar, in a real browser (tests/helpers/list-ui.js): a group pinned as a tab (right-click → Pin as tab,
// dragging its card onto the bar, edit mode's + Group), the group tab as its own place (it opens at the group, Back / Esc
// stop there, its path starts there, a new note goes in it), moving tabs (edit mode, drag, the tab's menu), hiding Locked,
// unpinning, a hidden group never pinned, a locked pinned group asking for the password, and the order kept by main.
// 1.4.33: icons: a group's own (optional: none = only its name), on its tab and its bar; Icon / Icon + name / Name per tab;
// Favourites, Locked and the Bin keep theirs.
const assert = require('assert');

(async () => {
  let A, B, C, D, F, HOME, KITCHEN, WORK, SAFE;
  const ui = await require('./helpers/list-ui')(async (s) => {
    await s.password();
    A = await s.note({ title: 'Milk' });
    B = await s.note({ title: 'Bread' });
    C = await s.note({ title: 'Spoons' });
    D = await s.note({ title: 'Report' });
    F = await s.note({ title: 'Diary' });
    await s.note({ title: 'Loose one' });
    KITCHEN = await s.group([C], { name: 'Kitchen' });
    HOME = await s.group([A, B, KITCHEN], { name: 'Home', color: 'lilac' });
    WORK = await s.group([D], { name: 'Work' });
    SAFE = await s.group([F], { name: 'Safe' });
    await s.lock(SAFE);
  });
  const { page } = ui;
  const order = () => page.$$eval('#tabs > .tab:not([hidden])', (ts) => ts.map((t) => t.dataset.key || t.dataset.tab));
  const saved = async () => (await ui.get()).settings.listTabs.map((t) => (t.group ? `g:${t.group}` : t.id + (t.hidden ? '-' : '')));
  const on = () => page.$eval('#tabs > .tab.on', (t) => t.dataset.key || t.dataset.tab);
  const crumbs = () => page.$$eval('#crumbs .crumb', (c) => c.map((x) => x.textContent.trim()));
  const shown = async () => (await ui.keys()).map((k) => k.slice(2));

  // ---- the first order, and nothing pinned
  assert.deepEqual(await order(), ['notes', 'favs', 'locks', 'bin', 'settings'], 'the first order');
  assert.deepEqual(await saved(), ['favs', 'locks', 'bin'], 'main keeps the order of the tabs between Notes and Settings');

  // ---- right-click a group card → Pin as tab
  await ui.menu(ui.groupKey(HOME), 'Pin as tab');
  assert.deepEqual(await saved(), ['favs', 'locks', 'bin', `g:${HOME}`], 'pinned at the end');
  assert.deepEqual(await order(), ['notes', 'favs', 'locks', 'bin', `g:${HOME}`, 'settings']);
  const tab = `#tabs .gtab[data-key="g:${HOME}"]`;
  assert.equal(await ui.text(`${tab} .gtname`), 'Home', 'the tab says the group’s name');
  assert.equal(await ui.text(`${tab} .count`), '3', 'and how many notes it holds');
  await ui.rclick(ui.groupKey(HOME));
  assert.ok((await ui.menuLabels()).includes('Remove from tabs') && !(await ui.menuLabels()).includes('Pin as tab'), 'a pinned group’s menu offers to remove it');
  await ui.key('Escape');

  // ---- the group tab is its own place
  await ui.click(tab);
  assert.equal(await on(), `g:${HOME}`, 'its tab is the one open');
  assert.deepEqual((await shown()).sort(), [A, B, KITCHEN].sort(), 'it opens at the group itself');
  assert.deepEqual(await crumbs(), ['Home'], 'its path starts at the group: no All notes');
  assert.ok(await page.isHidden('#btnBack'), 'no Back at its top');
  await ui.key('Escape');
  assert.deepEqual((await shown()).sort(), [A, B, KITCHEN].sort(), 'Esc stays at its top');
  await ui.click(ui.groupKey(KITCHEN));
  assert.equal(await on(), `g:${HOME}`, 'a group inside stays in the tab');
  assert.deepEqual(await crumbs(), ['Home', 'Kitchen']);
  assert.ok(!(await page.isHidden('#btnBack')), 'Back shows inside');
  await ui.key('Escape');
  assert.deepEqual((await shown()).sort(), [A, B, KITCHEN].sort(), 'Esc goes up to the tab’s top, no further');
  const before = new Set((await ui.get()).notes.map((n) => n.id));
  await ui.click('#btnNew');
  const made = (await ui.get()).notes.find((n) => !before.has(n.id));
  assert.equal(made.groupId, HOME, 'a new note goes into the tab’s group');
  await ui.H['list:close-note']({}, made.id); await ui.settle();
  // Notes starts at the top again; Settings and back returns to the group tab
  await ui.tab('notes');
  assert.equal(await on(), 'notes');
  assert.ok((await shown()).includes(HOME) && (await shown()).includes(WORK), 'Notes: the top level');
  await ui.click(tab);
  await ui.tab('settings');
  await ui.tab('settings');
  assert.equal(await on(), `g:${HOME}`, 'clicking Settings again goes back to the group tab');

  // ---- dragging a group card onto the bar pins it
  await ui.tab('notes');
  await ui.drag(ui.groupKey(WORK), '#tabs');
  assert.deepEqual(await saved(), ['favs', 'locks', 'bin', `g:${HOME}`, `g:${WORK}`], 'dropped on the bar: pinned');

  // ---- a hidden group is never pinned, and its card's menu stays as it is
  await ui.rclick(ui.groupKey(SAFE));
  assert.ok(!(await ui.menuLabels()).includes('Pin as tab'), 'a locked group’s menu: no Pin as tab');
  await ui.key('Escape');

  // ---- edit mode: + Group, moving, hiding Locked, unpinning
  await ui.click('#btnTabsEdit');
  assert.ok(await page.$eval('#tabs', (b) => b.classList.contains('editing')), 'the bar is in edit mode');
  assert.ok(await ui.visible('#tabAddGroup'), '+ Group shows');
  await ui.click('#tabAddGroup');
  const offered = await ui.menuLabels();
  assert.deepEqual(offered, ['Home › Kitchen'], 'only groups not pinned yet, with their path; never a hidden one');
  await page.locator('#ctx button', { hasText: 'Kitchen' }).first().dispatchEvent('click'); await ui.settle();
  assert.deepEqual(await saved(), ['favs', 'locks', 'bin', `g:${HOME}`, `g:${WORK}`, `g:${KITCHEN}`]);
  // drag Work before Favourites
  await ui.drag(`#tabs [data-key="g:${WORK}"]`, '#tabs [data-key="favs"]');
  assert.deepEqual(await saved(), [`g:${WORK}`, 'favs', 'locks', 'bin', `g:${HOME}`, `g:${KITCHEN}`], 'a tab dragged before another');
  assert.equal((await order())[0], 'notes', 'Notes stays first');
  // hide Locked: still there faded while editing, gone after Done
  await ui.click('#tabs [data-key="locks"] .teye');
  assert.ok((await saved()).includes('locks-'), 'Locked hidden');
  assert.ok(await ui.visible('#tabs [data-key="locks"]'), 'while editing it still shows');
  await ui.click(`#tabs [data-key="g:${KITCHEN}"] .tx`);
  assert.ok(!(await saved()).includes(`g:${KITCHEN}`), '× unpins a group');
  await ui.click('#btnTabsEdit');
  assert.deepEqual(await order(), ['notes', `g:${WORK}`, 'favs', 'bin', `g:${HOME}`, 'settings'], 'after Done: Locked hidden');

  // ---- the tab's own menu: Move right, Remove from tabs
  await ui.menu(`#tabs [data-key="g:${WORK}"]`, 'Move right');
  assert.deepEqual((await saved()).slice(0, 2), ['favs', `g:${WORK}`], 'Move right');
  await ui.click(`#tabs [data-key="g:${WORK}"]`);
  await ui.menu(`#tabs [data-key="g:${WORK}"]`, 'Remove from tabs');
  assert.ok(!(await saved()).includes(`g:${WORK}`), 'removed');
  assert.equal(await on(), 'notes', 'the open group tab that was removed: Notes');
  assert.ok((await ui.get()).groups.some((g) => g.id === WORK), 'the group itself is untouched');

  // ---- 1.4.33: icons. A group without one: only its name (no dot)
  const htab = `#tabs [data-key="g:${HOME}"]`;
  assert.equal(await ui.count(`${htab} > svg`), 0, 'no icon yet: no icon on its tab');
  assert.equal(await ui.count(`${htab} .gdot`), 0, 'and no colour dot');
  await ui.menu(htab, 'Icon…');
  assert.ok(await ui.visible('#iconPop'), 'the icon pop-up opens');
  assert.equal(await ui.count('#iconGrid button[data-icon]:not([data-icon=""])'), 40, 'all 40 icons to pick from');
  assert.ok(await page.isHidden('#iconShow'), 'no icon: nothing to choose about how it shows');
  await ui.click('#iconGrid [data-icon="home"]');
  assert.equal((await ui.get()).groups.find((g) => g.id === HOME).icon, 'home', 'main keeps the group’s icon');
  assert.equal(await ui.count(`${htab} > svg`), 1, 'its tab wears it');
  assert.ok(await ui.visible('#iconShow'), 'now Icon / Icon + name / Name');
  await ui.click('#iconShow [data-v="icon"]');
  assert.ok(await page.$eval(htab, (t) => t.classList.contains('t-icon')), 'icon only');
  assert.ok(await page.isHidden(`${htab} .gtname`), 'no name shown');
  assert.ok((await ui.get()).settings.listTabs.some((t) => t.group === HOME && t.show === 'icon'), 'main keeps how it shows');
  await ui.key('Escape');
  assert.ok(await page.isHidden('#iconPop'), 'Esc closes it');
  await ui.click(htab);
  assert.ok(await page.$eval('#gIcon', (x) => x.classList.contains('own')), 'the group’s bar wears its icon too');
  // the Bin keeps its trash can: only how it shows changes
  await ui.menu('#tabs [data-key="bin"]', 'Show icon only');
  assert.ok(await page.$eval('#tabs [data-key="bin"]', (t) => t.classList.contains('t-icon') && !!t.querySelector('svg.tbin')), 'the Bin as its icon only');
  await ui.menu('#tabs [data-key="bin"]', 'Show…');
  assert.ok(await page.isHidden('#iconGrid'), 'a built-in tab: no icons to pick');
  await ui.click('#iconShow [data-v="name"]');
  assert.ok(await page.$eval('#tabs [data-key="bin"]', (t) => t.classList.contains('t-name')), 'the Bin as its name only');
  await ui.key('Escape');
  // No icon: back to its name only, whatever it was set to show
  await ui.menu(ui.groupKey(KITCHEN), 'Icon…');
  await ui.click('#iconGrid [data-icon="food"]');
  assert.equal((await ui.get()).groups.find((g) => g.id === KITCHEN).icon, 'food', 'a group that isn’t a tab gets one too (right-click its card)');
  assert.ok(await page.isHidden('#iconShow'), 'it has no tab: nothing to choose about one');
  await ui.key('Escape');
  await ui.menu(htab, 'Icon…');
  await ui.click('#iconGrid .noicon');
  assert.equal((await ui.get()).groups.find((g) => g.id === HOME).icon, null, 'No icon');
  assert.ok(await page.$eval(htab, (t) => t.classList.contains('t-name') && !t.querySelector(':scope > svg')), 'its name only again');
  await ui.key('Escape');
  await ui.H['groups:update']({}, HOME, { icon: 'nope' });
  assert.equal((await ui.get()).groups.find((g) => g.id === HOME).icon, null, 'main takes only one of the 40');

  // ---- main cleans what it is sent: unknown tabs, twice the same, a group that doesn't exist; the built-in ones come back
  await ui.H['settings:set']({}, { listTabs: [{ id: 'bin', show: 'icon' }, { id: 'bin' }, { id: 'nope' }, { group: 'missing' }, { group: HOME, show: 'huge' }, { id: 'favs', hidden: true }] });
  assert.deepEqual(await saved(), ['bin', `g:${HOME}`, 'favs', 'locks'], 'cleaned: only Locked can be hidden, missing ones added');
  assert.deepEqual((await ui.get()).settings.listTabs.slice(0, 2), [{ id: 'bin', show: 'icon' }, { group: HOME }], 'only icon / name / both (both is the first way: not written)');

  // ---- a pinned group locked again: its tab shows a lock and no count, and opening it asks for the password
  await ui.H['settings:set']({}, { listTabs: [{ group: SAFE }] });
  await page.evaluate(() => window.dispatchEvent(new Event('focus'))); // the list loads main's data again (as on focus)
  await ui.settle();
  assert.equal(await ui.count(`#tabs [data-key="g:${SAFE}"] .count`), 0, 'a hidden group’s tab: no count');
  assert.equal(await ui.count(`#tabs [data-key="g:${SAFE}"] .tlock`), 1, 'but a lock');
  await ui.click(`#tabs [data-key="g:${SAFE}"]`);
  assert.ok(await ui.modalOpen(), 'it asks for the password');
  await ui.modalOk(['pw1234']);
  assert.equal(await on(), `g:${SAFE}`, 'then the group tab opens');
  assert.deepEqual(await shown(), [F]);

  await ui.done();
  console.log('ok');
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
