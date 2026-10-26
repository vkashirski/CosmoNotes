// 1.1.16: note effects and mouse followers: each note's own choice, the choice for all notes (Settings),
// "use on every note" (keeps each note's choice), pause per note / for all (Settings and the tray).
const assert = require('assert'); const path = require('path'); const fs = require('fs'); const vm = require('vm');
const Module = require('module'); const orig = Module._resolveFilename;
Module._resolveFilename = function (req, ...a) { if (req === 'electron') return require.resolve(path.join(__dirname, 'fake-electron', 'index.js')); return orig.call(this, req, ...a); };
const E = require('electron');
global.Response = class { constructor(b, o) { this.status = o?.status; } };
require(path.join(__dirname, '..', 'main.js'));
const { FX_EFFECTS, FX_FOLLOWERS } = require(path.join(__dirname, '..', 'store.js'));
const tick = (ms = 50) => new Promise((r) => setTimeout(r, ms));
const ev = (w) => ({ sender: w.webContents, returnValue: undefined });
const noteWins = () => E.__all.filter((x) => x.file && x.file.endsWith('note.html') && !x.destroyed);

// fx.js runs in the windows; load it here with just enough of a browser around it
const fakeCanvas = () => ({ width: 0, height: 0, getContext: () => new Proxy({}, { get: () => () => ({ addColorStop() {} }), set: () => true }) });
const sandbox = { window: {}, document: { hidden: false, createElement: fakeCanvas }, performance: { now: () => Date.now() }, requestAnimationFrame: () => 0, setTimeout, clearTimeout, Math, Object, Array, JSON };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'src', 'fx.js'), 'utf8'), sandbox);
const FX = sandbox.window.COSMO_FX;

(async () => {
  await tick(150);
  const H = E.__handlers;
  const get = async () => H['list:get']();
  const noteOf = async (id) => (await get()).notes.find((n) => n.id === id);

  // ---- the same ids in fx.js and store.js
  assert.deepEqual([...FX.EFFECT_IDS], FX_EFFECTS, 'effect ids match');
  assert.deepEqual([...FX.FOLLOWER_IDS], FX_FOLLOWERS, 'follower ids match');
  assert.ok(!FX.EFFECT_IDS.includes('shooting'), 'no shooting stars');
  assert.ok(FX.EFFECT_IDS.includes('matrix') && FX.FOLLOWER_IDS.includes('matrix'), 'Matrix: a background and a mouse follower');
  assert.ok(FX.ICONS.effect.matrix && FX.ICONS.follower.matrix, 'Matrix has its icons');
  assert.ok(FX.PALETTES.dark.code === '#00FF41', 'the film’s green on dark paper');
  // followers in the same order and with the same names and icons as their backgrounds
  for (const [f, e] of Object.entries(FX.PAIRS)) {
    if (!FX.EFFECTS[e]) continue; // the rainbow background comes once the owner has picked one
    assert.equal(FX.FOLLOWERS[f].name, FX.EFFECTS[e].name, `${f} is named like ${e}`);
    assert.equal(FX.ICONS.follower[f], FX.ICONS.effect[e], `${f} has ${e}'s icon`);
    assert.equal(FX.FOLLOWER_IDS.indexOf(f), FX.EFFECT_IDS.indexOf(e), `${f} sits where ${e} does`);
  }
  assert.ok(FX.FOLLOWERS.fireworks, 'a fireworks mouse follower');
  assert.ok(FX.EFFECT_AMOUNTS.high / FX.EFFECT_AMOUNTS.low > 15, 'background frequency: a big difference');
  // a note's own play wins over "pause all"; its own pause always pauses
  assert.equal(FX.resolve(null, { fxPaused: true }, false, true).paused, false, 'plays while all are paused');
  assert.equal(FX.resolve(null, { fxPaused: true }, false, false).paused, true);
  assert.equal(FX.resolve(null, { fxPaused: false }, true, false).paused, true);

  // ---- which effect a note shows
  const all = { fxEffect: 'snow', fxFollower: 'stardust', fxForceAll: false, fxPaused: false };
  let r = FX.resolve({ e: null, f: null }, all, false);
  assert.equal(r.effect, 'snow'); assert.equal(r.follower, 'stardust'); assert.equal(r.paused, false);
  r = FX.resolve({ e: 'rain', f: 'none' }, all, false);
  assert.equal(r.effect, 'rain', 'a note’s own choice wins'); assert.equal(r.follower, 'none', '“none” on a note means nothing');
  r = FX.resolve({ e: 'rain', f: 'none' }, { ...all, fxForceAll: true }, false);
  assert.equal(r.effect, 'snow', 'use on every note'); assert.equal(r.follower, 'stardust');
  r = FX.resolve({ e: 'rain', f: 'none' }, { ...all, fxForceAll: false }, false);
  assert.equal(r.effect, 'rain', 'switched off again: the note’s own choice is back');
  assert.equal(FX.resolve({}, { ...all, fxPaused: true }, false).paused, true, 'paused for all');
  assert.equal(FX.resolve({}, all, true).paused, true, 'paused on this note');
  assert.equal(FX.resolve({ e: 'bogus' }, all).effect, 'snow', 'unknown ids fall back to all notes’ choice');
  // how much (Less / Normal / More)
  r = FX.resolve({}, all);
  assert.equal(r.effectAmount, 'mid', 'normal by default'); assert.equal(r.followerAmount, 'mid');
  r = FX.resolve({ ea: 'high', fa: 'low' }, { ...all, fxEffectAmount: 'low' });
  assert.equal(r.effectAmount, 'high', 'a note’s own amount wins'); assert.equal(r.followerAmount, 'low');
  assert.equal(FX.resolve({}, { ...all, fxEffectAmount: 'low' }).effectAmount, 'low', 'all notes’ amount');
  assert.equal(FX.resolve({ ea: 'high' }, { ...all, fxEffectAmount: 'low', fxForceAll: true }).effectAmount, 'low', 'use on every note: all notes’ amount');
  assert.ok(FX.AMOUNTS.low < FX.AMOUNTS.mid && FX.AMOUNTS.mid < FX.AMOUNTS.high);
  // every effect and follower can be made and run a little, without throwing
  const fakeCtx = new Proxy({}, { get: (t, k) => (k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop() {} }) : () => {}), set: () => true });
  for (const id of FX.EFFECT_IDS) { const e = FX.EFFECTS[id].make(340, 280, FX.PALETTES.light, false, 1); for (let i = 0; i < 100; i++) e.step(.05, i * .05); e.draw(fakeCtx, 5); }
  for (const id of FX.FOLLOWER_IDS) { const f = FX.FOLLOWERS[id].make(340, 280, FX.PALETTES.dark, true, 1); for (let i = 0; i < 60; i++) { f.move(10 + i * 5, 100, 5); f.step(.033, i * .033); } f.draw(fakeCtx, 2); }

  // ---- settings for all notes
  let s = (await get()).settings;
  assert.equal(s.fxEffect, 'none'); assert.equal(s.fxFollower, 'none'); assert.equal(s.fxForceAll, false); assert.equal(s.fxPaused, false);
  await H['list:new']();
  const w = noteWins().pop();
  const id = (await H['note:get'](ev(w))).id;
  w.webContents.sentArgs = [];
  await H['settings:set'](null, { fxEffect: 'fireworks', fxFollower: 'rainbow' });
  s = (await get()).settings;
  assert.equal(s.fxEffect, 'fireworks'); assert.equal(s.fxFollower, 'rainbow');
  const sent = w.webContents.sentArgs.filter((x) => x[0] === 'settings:changed').pop();
  assert.ok(sent && sent[1].fxEffect === 'fireworks' && sent[1].fxFollower === 'rainbow', 'open notes are told');
  await H['settings:set'](null, { fxEffectAmount: 'high', fxFollowerAmount: 'low' });
  s = (await get()).settings;
  assert.equal(s.fxEffectAmount, 'high'); assert.equal(s.fxFollowerAmount, 'low');
  await H['settings:set'](null, { fxEffectAmount: 'tons' });
  assert.equal((await get()).settings.fxEffectAmount, 'high', 'unknown amount ignored');
  await H['settings:set'](null, { fxEffect: 'shooting', fxFollower: 'nope' });
  s = (await get()).settings;
  assert.equal(s.fxEffect, 'fireworks', 'unknown effect ignored'); assert.equal(s.fxFollower, 'rainbow');
  const ng = await H['note:get'](ev(w));
  assert.equal(ng.settings.fxEffect, 'fireworks', 'a note window gets them when it opens');

  // ---- a note's own choice: kept, not an edit, copied by Duplicate
  const before = (await noteOf(id)).updatedAt;
  await tick(20);
  await H['note:update'](ev(w), { fx: { e: 'rain', f: 'none' } });
  let n = await noteOf(id);
  assert.deepEqual(n.fx, { e: 'rain', f: 'none', ea: null, fa: null, eo: null, fo: null, mi: null }, 'the list gets it (for the card)');
  assert.equal(n.updatedAt, before, 'choosing an effect is not an edit');
  await H['note:update'](ev(w), { fx: { e: 'lasers', f: 'hearts' } });
  assert.deepEqual((await noteOf(id)).fx, { e: null, f: 'hearts', ea: null, fa: null, eo: null, fo: null, mi: null }, 'unknown ids become “same as all notes”');
  await H['note:update'](ev(w), { fx: { e: 'rain', f: 'none', ea: 'high', fa: 'loads' } });
  assert.deepEqual((await noteOf(id)).fx, { e: 'rain', f: 'none', ea: 'high', fa: null, eo: null, fo: null, mi: null }, 'how much: low / mid / high only');
  await H['note:update'](ev(w), { fx: { e: 'rain', f: 'none', ea: 'high' }, fxPaused: true });
  n = await noteOf(id);
  assert.equal(n.fxPaused, true, 'paused on this note');
  const copyId = await H['list:duplicate'](null, id);
  assert.deepEqual((await noteOf(copyId)).fx, { e: 'rain', f: 'none', ea: 'high', fa: null, eo: null, fo: null, mi: null }, 'a copy keeps the effect');

  // ---- use on every note: the notes keep their own choice
  await H['settings:set'](null, { fxForceAll: true });
  assert.equal((await get()).settings.fxForceAll, true);
  assert.deepEqual((await noteOf(id)).fx, { e: 'rain', f: 'none', ea: 'high', fa: null, eo: null, fo: null, mi: null }, 'own choice kept while forced');
  await H['settings:set'](null, { fxForceAll: false });
  assert.deepEqual((await noteOf(id)).fx, { e: 'rain', f: 'none', ea: 'high', fa: null, eo: null, fo: null, mi: null }, 'and still there after');

  // ---- pause all: Settings and the tray
  const trayItem = () => E.__tray.menu.t.find((x) => x.label === 'Pause effects');
  assert.ok(trayItem(), 'tray has “Pause effects”'); assert.equal(trayItem().checked, false);
  w.webContents.sentArgs = [];
  trayItem().click({ checked: true });
  assert.equal((await get()).settings.fxPaused, true, 'paused from the tray');
  assert.equal(trayItem().checked, true, 'tray shows it');
  assert.ok(w.webContents.sentArgs.some((x) => x[0] === 'settings:changed' && x[1].fxPaused === true), 'notes are told');
  await H['settings:set'](null, { fxPaused: false });
  assert.equal(trayItem().checked, false, 'Settings and tray stay the same');

  // ---- the text toolbar outside the note: its own window, like the drawing toolbar
  const L = E.__listeners;
  const okText = w.webContents.openHandler({ url: 'about:blank', frameName: 'cosmoTextBar' });
  assert.equal(okText.action, 'allow', 'a note may open its text toolbar window');
  assert.equal(okText.overrideBrowserWindowOptions.parent, w); assert.equal(okText.overrideBrowserWindowOptions.focusable, false);
  assert.equal(okText.overrideBrowserWindowOptions.title, 'Text');
  const inkChild = new E.BrowserWindow(w.webContents.openHandler({ url: 'about:blank', frameName: 'cosmoInkBar' }).overrideBrowserWindowOptions);
  w.webContents.emit('did-create-window', inkChild, { frameName: 'cosmoInkBar' });
  const textChild = new E.BrowserWindow(okText.overrideBrowserWindowOptions);
  w.webContents.emit('did-create-window', textChild, { frameName: 'cosmoTextBar' });
  assert.equal(w.textWin, textChild, 'both toolbars can have a window'); assert.equal(w.inkWin, inkChild); assert.ok(!textChild.destroyed && !inkChild.destroyed);
  w.setBounds({ x: 400, y: 300, width: 340, height: 300 });
  const tsize = { bar: 'text', w: 274, h: 190, inset: { l: 12, t: 8, r: 12, b: 14 } };
  L['ink:drag'](ev(w), { x: 400 - 4 - 250 - 12, y: 320 - 8, px: 200, py: 340, ...tsize });
  assert.equal(w.textState.mode, 'dock'); assert.equal(w.textState.side, 'left', 'the text toolbar sticks to the left side');
  assert.ok(textChild.visible); assert.ok(!inkChild.visible, 'the drawing toolbar is not touched');
  assert.equal(w.inkState, undefined);
  w.setBounds({ x: 500, y: 300, width: 340, height: 300 }); w.emit('move');
  assert.equal(textChild.bounds.x + 12 + 250 + 4, 500, 'it follows the note');
  await H['note:update'](ev(w), { rolled: true });
  assert.equal(textChild.visible, false, 'hidden while rolled up');
  await H['note:update'](ev(w), { rolled: false });
  assert.equal(textChild.visible, true);
  const tdrop = await H['ink:drop'](ev(w), { bar: 'text', px: 300, py: 340 });
  assert.equal(tdrop.inside, false); assert.deepEqual(tdrop.state, { mode: 'dock', side: 'left', off: 20 });
  L['ink:hide'](ev(w), 'text');
  assert.equal(textChild.visible, false); assert.equal(w.textOut, false);
  textChild.close();
  assert.equal(w.textWin, null); assert.equal(w.inkWin, inkChild, 'closing one leaves the other');

  // a toolbar stuck to a side slides past the note's corners (only has to keep touching the side)
  const tc2 = new E.BrowserWindow(okText.overrideBrowserWindowOptions);
  w.webContents.emit('did-create-window', tc2, { frameName: 'cosmoTextBar' });
  w.setBounds({ x: 400, y: 300, width: 340, height: 300 }); w.emit('move');
  L['ink:drag'](ev(w), { x: 400 + 340 + 4 - 12, y: 300 + 300 - 60 - 8, px: 900, py: 560, ...tsize });
  assert.equal(w.textState.side, 'right');
  const vis = tc2.bounds.y + 8;
  assert.ok(vis + 168 > 300 + 300, 'it goes past the bottom corner instead of stopping there');
  // the ⋯ menu and Effects pop-up can have windows too; the menu's can take the keyboard
  const okMenu = w.webContents.openHandler({ url: 'about:blank', frameName: 'cosmoMenuBar' });
  assert.equal(okMenu.action, 'allow'); assert.equal(okMenu.overrideBrowserWindowOptions.focusable, true); assert.equal(okMenu.overrideBrowserWindowOptions.title, 'Note settings');
  const okFx = w.webContents.openHandler({ url: 'about:blank', frameName: 'cosmoFxBar' });
  assert.equal(okFx.action, 'allow'); assert.equal(okFx.overrideBrowserWindowOptions.focusable, false);
  // the app's theme goes to the notes (for their pop-ups)
  w.webContents.sentArgs = [];
  await H['settings:set'](null, { listTheme: 'forest' });
  assert.ok(w.webContents.sentArgs.some((x) => x[0] === 'settings:changed' && x[1].appTheme === 'forest'), 'notes get the theme');

  console.log('v1116 ok');
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
