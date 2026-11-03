'use strict';
// Effects as main saves them: the choice for all notes in Settings (background, mouse follower, how much, opacity,
// "mouse can interact", use on every note, pause) with open notes told; a note's own choice (cleaned, not an edit, kept
// while "use on every note" is on); Pause effects in the tray; Edit design in the list (see-through and effects, not an
// edit, the open window follows). (Which effect a note then shows: effects-rules.test.js.)
const assert = require('assert');
const app = require('./helpers/app');

const FX0 = { e: null, f: null, ea: null, fa: null, eo: null, fo: null, mi: null };

(async () => {
  const { H, E, ev, tick } = await app.start();
  const s = async () => (await app.list()).settings;
  const id = await app.newNote();
  const w = app.winOf(id);
  const told = () => app.sent(w, 'settings:changed').pop();

  // ---- settings for all notes
  let st = await s();
  assert.equal(st.fxEffect, 'none'); assert.equal(st.fxFollower, 'none'); assert.equal(st.fxForceAll, false); assert.equal(st.fxPaused, false);
  assert.equal(st.fxEffectOpacity, 1); assert.equal(st.fxFollowerOpacity, 1);
  assert.equal((await H['note:get'](ev(w))).settings.fxInteract, true, '"mouse can interact" is on by default');
  w.webContents.sentArgs = [];
  await H['settings:set'](null, { fxEffect: 'fireworks', fxFollower: 'rainbow' });
  st = await s();
  assert.equal(st.fxEffect, 'fireworks'); assert.equal(st.fxFollower, 'rainbow');
  assert.ok(told().fxEffect === 'fireworks' && told().fxFollower === 'rainbow', 'open notes are told');
  await H['settings:set'](null, { fxEffect: 'shooting', fxFollower: 'nope' });
  st = await s();
  assert.equal(st.fxEffect, 'fireworks', 'unknown effect ignored'); assert.equal(st.fxFollower, 'rainbow');
  await H['settings:set'](null, { fxEffectAmount: 'high', fxFollowerAmount: 'low' });
  await H['settings:set'](null, { fxEffectAmount: 'tons' });
  st = await s();
  assert.equal(st.fxEffectAmount, 'high', 'unknown amount ignored'); assert.equal(st.fxFollowerAmount, 'low');
  await H['settings:set'](null, { fxEffectOpacity: 0.35, fxFollowerOpacity: 0.62 });
  st = await s();
  assert.equal(st.fxEffectOpacity, 0.35); assert.equal(st.fxFollowerOpacity, 0.6, 'rounded to 5 %');
  assert.ok(told().fxEffectOpacity === 0.35 && told().fxFollowerOpacity === 0.6, 'open notes are told');
  await H['settings:set'](null, { fxEffectOpacity: 'lots', fxFollowerOpacity: null });
  st = await s();
  assert.equal(st.fxEffectOpacity, 0.35, 'nonsense ignored'); assert.equal(st.fxFollowerOpacity, 0.6);
  await H['settings:set'](null, { fxInteract: 0 });
  assert.equal((await s()).fxInteract, false);
  assert.equal(told().fxInteract, false, 'open notes are told');
  const ng = (await H['note:get'](ev(w))).settings;
  assert.ok(ng.fxEffect === 'fireworks' && ng.fxEffectOpacity === 0.35, 'a note window gets them when it opens');

  // ---- a note's own choice: cleaned, not an edit
  const before = (await app.card(id)).updatedAt;
  await tick(5);
  await H['note:update'](ev(w), { fx: { e: 'rain', f: 'none' } });
  assert.deepEqual((await app.card(id)).fx, { ...FX0, e: 'rain', f: 'none' }, 'the list gets it (for the card)');
  assert.equal((await app.card(id)).updatedAt, before, 'choosing an effect is not an edit');
  await H['note:update'](ev(w), { fx: { e: 'lasers', f: 'hearts' } });
  assert.deepEqual((await app.card(id)).fx, { ...FX0, f: 'hearts' }, 'unknown ids become “same as all notes”');
  await H['note:update'](ev(w), { fx: { e: 'rain', f: 'none', ea: 'high', fa: 'loads' } });
  assert.deepEqual((await app.card(id)).fx, { ...FX0, e: 'rain', f: 'none', ea: 'high' }, 'how much: low / mid / high only');
  await H['note:update'](ev(w), { fx: { e: 'rain', f: null, eo: 0.45, fo: 2, mi: true } });
  let n = await app.card(id);
  assert.equal(n.fx.eo, 0.45); assert.equal(n.fx.fo, 1, 'opacity capped at 100 %'); assert.equal(n.fx.mi, true);
  assert.equal(n.updatedAt, before, 'opacity and "mouse can interact" are not edits either');
  await H['note:update'](ev(w), { fx: { e: 'rain', f: 'none', ea: 'high' }, fxPaused: true });
  assert.equal((await app.card(id)).fxPaused, true, 'paused on this note');
  // use on every note: the notes keep their own choice
  await H['settings:set'](null, { fxForceAll: true });
  assert.equal((await s()).fxForceAll, true);
  assert.deepEqual((await app.card(id)).fx, { ...FX0, e: 'rain', f: 'none', ea: 'high' }, 'own choice kept while forced');
  await H['settings:set'](null, { fxForceAll: false });
  assert.deepEqual((await app.card(id)).fx, { ...FX0, e: 'rain', f: 'none', ea: 'high' }, 'and still there after');

  // ---- Pause effects: Settings and the tray stay the same
  const trayItem = () => E.__tray.menu.t.find((x) => x.label === 'Pause effects');
  assert.ok(trayItem(), 'tray has “Pause effects”'); assert.equal(trayItem().checked, false);
  w.webContents.sentArgs = [];
  trayItem().click({ checked: true });
  assert.equal((await s()).fxPaused, true, 'paused from the tray');
  assert.equal(trayItem().checked, true, 'tray shows it');
  assert.equal(told().fxPaused, true, 'notes are told');
  await H['settings:set'](null, { fxPaused: false });
  assert.equal(trayItem().checked, false, 'Settings and tray stay the same');

  // ---- Edit design (list): see-through and the note's effects, not an edit; the open window follows (1.1.20)
  assert.ok('opacity' in (await app.card(id)), 'the list gets each note’s see-through');
  const upd = (await app.card(id)).updatedAt;
  w.webContents.sentArgs = [];
  let r = await H['list:edit']({}, id, { opacity: 0.55, fx: { e: 'ghost', f: 'fish', eo: 0.4, bogus: 1 } });
  assert.equal(r.opacity, 0.55); assert.deepEqual(r.fx, { ...FX0, e: 'ghost', f: 'fish', eo: 0.4 });
  n = await app.card(id);
  assert.equal(n.opacity, 0.55); assert.equal(n.fx.e, 'ghost'); assert.equal(n.updatedAt, upd, 'not an edit');
  assert.equal(w.opacity, 0.55, 'the open window turns see-through at once');
  const look = app.lastLook(w);
  assert.ok(look && look.fx.e === 'ghost' && look.opacity === 0.55, 'and gets the new effects');
  r = await H['list:edit']({}, id, { opacity: 3, fx: { e: 'fairy' } });
  assert.equal(r.opacity, 1, 'see-through: at most solid'); assert.equal(r.fx.e, null, 'a removed effect is not kept');
  r = await H['list:edit']({}, id, { opacity: 0.01 });
  assert.equal(r.opacity, 0.25, 'and never below 25 %');
  assert.equal(await H['list:edit']({}, id, { opacity: true }), null, 'nothing valid: nothing changes');
  console.log('ok');
  process.exit(0);
})();
