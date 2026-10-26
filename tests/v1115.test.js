// 1.1.15: theme colours for notes, new notes pick a random colour from a list, Edit… in the list (synced with
// an open note window), the drawing toolbar outside the note (stuck to a side, following the note).
const assert = require('assert'); const path = require('path');
const Module = require('module'); const orig = Module._resolveFilename;
Module._resolveFilename = function (req, ...a) { if (req === 'electron') return require.resolve(path.join(__dirname, 'fake-electron', 'index.js')); return orig.call(this, req, ...a); };
const E = require('electron');
global.Response = class { constructor(b, o) { this.status = o?.status; } };
require(path.join(__dirname, '..', 'main.js'));
const tick = (ms = 50) => new Promise((r) => setTimeout(r, ms));
const ev = (w) => ({ sender: w.webContents, returnValue: undefined });
const noteWins = () => E.__all.filter((x) => x.file && x.file.endsWith('note.html') && !x.destroyed);
(async () => {
  await tick(150);
  const H = E.__handlers;
  const L = E.__listeners;
  const get = async () => H['list:get']();
  const noteOf = async (id) => (await get()).notes.find((n) => n.id === id);

  // ---- new colours are real paper colours
  await H['list:new']();
  const w = noteWins().pop();
  const id = (await H['note:get'](ev(w))).id;
  for (const c of ['cream', 'rose', 'sage', 'mist', 'lavender', 'night', 'midnight', 'forest', 'plum']) {
    await H['note:update'](ev(w), { color: c });
    assert.equal((await noteOf(id)).color, c, `${c} is kept`);
  }
  assert.ok(w.bg && w.bg.startsWith('#'), 'the window gets the paper colour');
  await H['note:update'](ev(w), { color: 'neon' });
  assert.equal((await noteOf(id)).color, 'yellow', 'unknown colour falls back to yellow');
  assert.equal(await H['list:apply'](null, [id], { color: 'forest' }), 1);
  assert.equal((await noteOf(id)).color, 'forest');

  // ---- new notes: a random one of the picked colours
  await H['settings:set'](null, { defaultColors: ['midnight', 'rose', 'nope', 'sage'] });
  let s = (await get()).settings;
  assert.deepEqual(s.defaultColors, ['rose', 'sage', 'midnight'], 'unknown ones dropped, in the usual order');
  assert.equal(s.defaultColor, 'rose', 'defaultColor (for older versions) is the first one');
  const seen = new Set();
  for (let i = 0; i < 30; i++) {
    const before = new Set((await get()).notes.map((n) => n.id));
    await H['list:new'](null, null);
    seen.add((await get()).notes.find((n) => !before.has(n.id)).color);
  }
  assert.ok([...seen].every((c) => ['rose', 'sage', 'midnight'].includes(c)), 'only picked colours');
  assert.ok(seen.size >= 2, 'more than one of them comes up');
  // never the same colour twice in a row (on by default), unless only one colour is picked
  assert.equal(s.newColorNoRepeat, true, 'on by default');
  const newColour = async () => {
    const before = new Set((await get()).notes.map((x) => x.id));
    await H['list:new'](null, null);
    return (await get()).notes.find((x) => !before.has(x.id)).color;
  };
  await H['settings:set'](null, { defaultColors: ['pink', 'mint'] });
  let prev = await newColour();
  for (let i = 0; i < 20; i++) { const c = await newColour(); assert.notEqual(c, prev, 'never the same colour twice in a row'); prev = c; }
  const dupOf = (await get()).notes.find((x) => x.color === prev && !x.deletedAt);
  await H['list:duplicate'](null, dupOf.id);
  assert.notEqual(await newColour(), prev, 'a copy (same colour) doesn’t change what came last');
  await H['settings:set'](null, { newColorNoRepeat: false });
  assert.equal((await get()).settings.newColorNoRepeat, false);
  let repeats = 0;
  prev = await newColour();
  for (let i = 0; i < 30; i++) { const c = await newColour(); if (c === prev) repeats++; prev = c; }
  assert.ok(repeats > 0, 'switched off: the same colour can come twice');
  await H['settings:set'](null, { newColorNoRepeat: true, defaultColors: ['plum'] });
  assert.equal(await newColour(), 'plum'); assert.equal(await newColour(), 'plum', 'one colour picked: always that one');
  await H['settings:set'](null, { defaultColors: [] });
  assert.deepEqual((await get()).settings.defaultColors, ['plum'], 'never empty: keeps a colour');
  await H['settings:set'](null, { defaultColor: 'plum' });
  assert.deepEqual((await get()).settings.defaultColors, ['plum'], 'the old single colour still works');

  // ---- Edit… in the list: title and colour
  w.webContents.sentArgs = [];
  const n0 = await noteOf(id);
  await tick(20);
  const r = await H['list:edit'](null, id, { title: 'From the list', html: '<div>not taken</div>', text: 'not taken', font: 'round' });
  assert.ok(r.updatedAt > n0.updatedAt, 'a new title counts as an edit');
  let n = await noteOf(id);
  assert.equal(n.title, 'From the list');
  assert.notEqual(n.text, 'not taken', 'the words can’t be changed from the list');
  assert.equal(n.font, n0.font, 'nor the font');
  assert.ok(w.webContents.sentArgs.some((x) => x[0] === 'note:look' && x[1].title === 'From the list'), 'the open window gets the new title');
  assert.equal(w.title, 'From the list', 'window title follows');
  // colour only: not an edit, the window recolours
  w.webContents.sentArgs = [];
  const t1 = (await noteOf(id)).updatedAt;
  await tick(20);
  await H['list:edit'](null, id, { color: 'night' });
  n = await noteOf(id);
  assert.equal(n.color, 'night'); assert.equal(n.updatedAt, t1, 'colour is not an edit');
  assert.ok(w.webContents.sentArgs.some((x) => x[0] === 'note:look' && x[1].color === 'night'));
  assert.equal(w.bg, '#2F2D35', 'window background follows');
  assert.equal(await H['list:edit'](null, id, { color: 'neon' }), null, 'nothing valid: nothing changes');
  // typing in the note window shows in the list (it refreshes)
  await H['note:update'](ev(w), { html: '<div>typed in the note</div>', text: 'typed in the note' });
  assert.equal((await noteOf(id)).text, 'typed in the note');
  // a locked note: title and colour can still change
  await H['lock:set'](ev(w), { current: '', next: '2468', kind: 'pin' });
  await H['list:set-locked'](null, id, true);
  await H['list:edit'](null, id, { color: 'plum', title: 'Still mine' });
  n = await noteOf(id);
  assert.equal(n.color, 'plum'); assert.equal(n.title, 'Still mine');

  // ---- Locked tab: Unlock all / Lock again
  const L0 = await get();
  assert.equal((await noteOf(id)).locked, true, 'shown as locked'); assert.equal((await noteOf(id)).text, '', 'no words in the list');
  assert.equal(L0.settings.unlockedAll, false);
  assert.deepEqual(await H['list:unlock-all'](null, '0000'), { ok: false }, 'wrong PIN');
  assert.equal((await noteOf(id)).text, '');
  assert.deepEqual(await H['list:unlock-all'](null, '2468'), { ok: true });
  assert.equal((await get()).settings.unlockedAll, true);
  assert.equal((await noteOf(id)).text, 'typed in the note', 'words show (and can be searched) after Unlock all');
  assert.equal((await noteOf(id)).locked, false, 'shown unlocked'); assert.equal((await noteOf(id)).ownLock, true, 'but still locked');
  // a note inside a locked group shows too, and the group counts as open
  await H['list:new'](null, null);
  const other = (await get()).notes.find((x) => x.id !== id && !x.deletedAt && x.text === '' && !x.locked);
  const G = await H['groups:make'](null, other.id, (await get()).notes.find((x) => x.id !== id && x.id !== other.id && !x.deletedAt).id);
  await H['groups:set-locked'](null, G, true);
  assert.equal((await get()).groups.find((g) => g.id === G).open, true, 'locked group open while unlocked all');
  // the note window: unlocked all → opening from the list doesn't ask; Lock again hides it again
  w.webContents.sentArgs = [];
  await H['list:lock-all']();
  assert.equal((await get()).settings.unlockedAll, false);
  assert.equal((await noteOf(id)).text, '', 'covered again in the list');
  assert.equal((await get()).groups.find((g) => g.id === G).open, false, 'the group is covered again');
  await H['list:unlock-all'](null, '2468');
  // closing the list covers everything again
  await H['list:show']();
  const lw0 = E.__all.find((x) => x.file && x.file.endsWith('list.html') && !x.destroyed);
  lw0.close();
  assert.equal((await get()).settings.unlockedAll, false, 'closing the list locks again');
  await H['list:set-locked'](null, id, false, '2468');
  await H['groups:set-locked'](null, G, false, '2468');

  // ---- drawing toolbar outside the note
  const open = w.webContents.openHandler;
  assert.equal(open({ url: 'https://example.com', frameName: '' }).action, 'deny', 'other windows stay blocked');
  assert.equal(open({ url: 'about:blank', frameName: 'other' }).action, 'deny');
  const ok = open({ url: 'about:blank', frameName: 'cosmoInkBar' });
  assert.equal(ok.action, 'allow');
  assert.equal(ok.overrideBrowserWindowOptions.parent, w, 'it belongs to its note');
  assert.equal(ok.overrideBrowserWindowOptions.focusable, false, 'it never takes the focus');
  assert.equal(ok.overrideBrowserWindowOptions.transparent, true);
  // the list window can't open one
  await H['list:show']();
  const lw = E.__all.find((x) => x.file && x.file.endsWith('list.html'));
  assert.equal(lw.webContents.openHandler({ url: 'about:blank', frameName: 'cosmoInkBar' }).action, 'deny');
  const child = new E.BrowserWindow(ok.overrideBrowserWindowOptions);
  w.webContents.emit('did-create-window', child, { frameName: 'cosmoInkBar' });
  assert.equal(w.inkWin, child); assert.equal(child.parent, w);
  // a second one is refused
  const extra = new E.BrowserWindow(ok.overrideBrowserWindowOptions);
  w.webContents.emit('did-create-window', extra, { frameName: 'cosmoInkBar' });
  assert.ok(extra.destroyed, 'only one toolbar window per note');
  w.setBounds({ x: 400, y: 300, width: 340, height: 300 });
  const size = { w: 308, h: 176, inset: { l: 6, t: 8, r: 12, b: 14 } };
  // dragged close to the right side: sticks to it
  L['ink:drag'](ev(w), { x: 400 + 340 + 10 - 6, y: 320 - 8, px: 800, py: 340, ...size });
  assert.equal(w.inkState.mode, 'dock'); assert.equal(w.inkState.side, 'right');
  assert.ok(child.visible, 'shown');
  assert.equal(child.bounds.x, 400 + 340 + 4 - 6, 'right next to the note (4 px gap)');
  assert.equal(child.bounds.y, 320 - 8, 'at the height it was dropped');
  // the note moves: the toolbar goes with it
  w.setPosition(100, 200);
  assert.equal(child.bounds.x, 100 + 340 + 4 - 6); assert.equal(child.bounds.y, 220 - 8);
  // and when the note gets shorter, it stays along its side
  w.setSize(340, 150);
  assert.ok(child.bounds.y + 8 >= 200, 'still level with the note');
  // close to the top: sticks there
  L['ink:drag'](ev(w), { x: 120 - 6, y: 200 - 10 - 154 - 8, px: 200, py: 150, ...size }); // 1.1.20: it sticks only within 12 px
  assert.equal(w.inkState.side, 'top');
  assert.equal(child.bounds.y + 8 + 154, 200 - 4, 'just above the note');
  // left side
  w.setPosition(600, 200);
  L['ink:drag'](ev(w), { x: 600 - 10 - 290, y: 210, px: 550, py: 230, ...size });
  assert.equal(w.inkState.side, 'left');
  assert.equal(child.bounds.x + 6 + 290, 600 - 4, 'just left of the note');
  // at the screen's left edge there's no room on the left: it comes over the note instead of off the screen
  w.setPosition(100, 200);
  assert.equal(child.bounds.x + 6, 0, 'kept on the screen');
  // far away: stays where it is, and doesn't follow
  L['ink:drag'](ev(w), { x: 1200, y: 600, px: 1300, py: 620, ...size });
  assert.equal(w.inkState.mode, 'free');
  let dropped = await H['ink:drop'](ev(w), { px: 1300, py: 620 });
  assert.deepEqual(dropped, { inside: false, state: { mode: 'free', x: 1200, y: 600 } });
  w.setPosition(150, 220);
  assert.equal(child.bounds.x, 1200, 'a loose toolbar stays put');
  // off the screen: pulled back onto it
  L['ink:drag'](ev(w), { x: 1900, y: 1000, px: 1950, py: 1030, ...size });
  assert.ok(child.bounds.x + 6 + 290 <= 1920 && child.bounds.y + 8 + 154 <= 1040, 'always on the screen');
  // stuck again, then the note rolls up: hidden; unrolled: back
  L['ink:drag'](ev(w), { x: 150 + 340 + 2, y: 230, px: 600, py: 250, ...size });
  dropped = await H['ink:drop'](ev(w), { px: 600, py: 250 });
  assert.equal(dropped.state.mode, 'dock'); assert.equal(dropped.state.side, 'right');
  await H['note:update'](ev(w), { rolled: true });
  assert.equal(child.visible, false, 'hidden while rolled up');
  await H['note:update'](ev(w), { rolled: false });
  assert.equal(child.visible, true, 'back when unrolled');
  // pinned note: its toolbar is on top too
  await H['note:update'](ev(w), { pinned: true });
  assert.equal(child.top, true);
  // shown again at a remembered place
  L['ink:hide'](ev(w));
  assert.equal(child.visible, false);
  L['ink:show'](ev(w), { mode: 'dock', side: 'bottom', off: 10, ...size });
  assert.equal(child.visible, true); assert.equal(child.bounds.y + 8, w.bounds.y + w.bounds.height + 4, 'under the note');
  // dropped back on the note: inside again
  dropped = await H['ink:drop'](ev(w), { px: w.bounds.x + 50, py: w.bounds.y + 50 });
  assert.equal(dropped.inside, true); assert.equal(child.visible, false);
  // its window closing forgets it
  child.close();
  assert.equal(w.inkWin, null);

  console.log('v1115 ok');
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
