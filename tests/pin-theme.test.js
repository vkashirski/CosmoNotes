// 1.1.6: password or PIN, list colour themes, and the "make a group" tip that stops once a group was made.
const assert = require('assert'); const path = require('path'); const fs = require('fs');
const Module = require('module'); const orig = Module._resolveFilename;
Module._resolveFilename = function (req, ...a) { if (req === 'electron') return require.resolve(path.join(__dirname, 'fake-electron', 'index.js')); return orig.call(this, req, ...a); };
const E = require('electron');
global.Response = class { constructor(b, o) { this.status = o?.status; } };
require(path.join(__dirname, '..', 'main.js'));
const tick = (ms = 50) => new Promise((r) => setTimeout(r, ms));
const ev = (w) => ({ sender: w.webContents, returnValue: undefined });
const settingsFile = () => JSON.parse(fs.readFileSync(path.join(process.env.FAKE_DATA, 'settings.json'), 'utf8'));
(async () => {
  await tick(150);
  const H = E.__handlers;
  let s = (await H['list:get']()).settings;
  assert.equal(s.lockKind, 'password', 'no PIN yet: treated as a password');
  assert.equal(s.lockLen, 0);
  assert.equal(s.listTheme, 'cream');
  assert.equal(s.madeGroup, false);

  // ---- PIN: digits only, 4 to 12, its length is known so it can open by itself
  let r = await H['lock:set'](null, { next: '12a4', kind: 'pin' }); assert.ok(r.error, 'letters in a PIN');
  r = await H['lock:set'](null, { next: '123', kind: 'pin' }); assert.ok(r.error, 'too short');
  r = await H['lock:set'](null, { next: '1234567890123', kind: 'pin' }); assert.ok(r.error, 'too long');
  r = await H['lock:set'](null, { next: '2580', kind: 'pin' }); assert.ok(r.ok);
  s = (await H['list:get']()).settings;
  assert.equal(s.lockKind, 'pin'); assert.equal(s.lockLen, 4); assert.equal(s.hasPassword, true);
  assert.equal(s.lock, undefined, 'the hash never goes to the window');
  // the note window learns it too
  await H['list:new']();
  const w = E.__all.find((x) => x.file.endsWith('note.html') && !x.destroyed);
  let n = await H['note:get'](ev(w));
  assert.equal(n.settings.lockKind, 'pin'); assert.equal(n.settings.lockLen, 4);
  n = await H['note:set-locked'](ev(w), true);
  assert.equal(n.hidden, true);
  assert.equal(await H['note:unlock'](ev(w), '1234'), null, 'wrong PIN');
  n = await H['note:unlock'](ev(w), '2580');
  assert.equal(n.hidden, false, 'right PIN opens it');
  // changing PIN → password needs the current PIN
  r = await H['lock:set'](null, { current: '0000', next: 'kitty cat', kind: 'password' });
  assert.ok(/PIN/.test(r.error), 'says "PIN" when the current one is a PIN');
  r = await H['lock:set'](null, { current: '2580', next: 'kitty cat', kind: 'password' }); assert.ok(r.ok);
  s = (await H['list:get']()).settings;
  assert.equal(s.lockKind, 'password'); assert.equal(s.lockLen, 0);
  assert.equal(settingsFile().lockKind, 'password');

  // ---- list colour themes: only known ones are kept
  await H['settings:set'](null, { listTheme: 'night' });
  assert.equal((await H['list:get']()).settings.listTheme, 'night');
  await H['settings:set'](null, { listTheme: 'midnight' });
  assert.equal((await H['list:get']()).settings.listTheme, 'midnight', 'the new dark themes are allowed');
  await H['settings:set'](null, { listTheme: 'night' });
  await H['settings:set'](null, { listTheme: 'neon-green' });
  assert.equal((await H['list:get']()).settings.listTheme, 'night');
  assert.equal(settingsFile().listTheme, 'night', 'saved to disk');

  // ---- see-through for new notes
  assert.equal((await H['list:get']()).settings.defaultOpacity, 1);
  await H['settings:set'](null, { defaultOpacity: 0.62 });
  assert.equal((await H['list:get']()).settings.defaultOpacity, 0.6, 'rounded to 5% steps');
  await H['settings:set'](null, { defaultOpacity: 0.05 });
  assert.equal((await H['list:get']()).settings.defaultOpacity, 0.25, 'never less than 25%');
  await H['settings:set'](null, { defaultOpacity: 0.7 });
  await H['list:new']();
  const fresh = (await H['list:get']()).notes.sort((a, b) => b.createdAt - a.createdAt)[0];
  const fw = E.__all.filter((x) => x.file.endsWith('note.html') && !x.destroyed).pop();
  assert.equal((await H['note:get'](ev(fw))).opacity, 0.7, 'a new note starts see-through as set');
  assert.ok(fresh);
  await H['settings:set'](null, { defaultOpacity: 1 });

  // ---- making a group switches the tip off for good, even after the group is gone
  await H['list:new']();
  const ids = (await H['list:get']()).notes.map((x) => x.id);
  await H['groups:make'](null, ids[0], ids[1]);
  s = (await H['list:get']()).settings;
  assert.equal(s.madeGroup, true);
  const g = (await H['list:get']()).groups[0];
  await H['groups:dissolve'](null, g.id);
  assert.equal((await H['list:get']()).groups.length, 0);
  assert.equal((await H['list:get']()).settings.madeGroup, true, 'still true with no groups left');
  assert.equal(settingsFile().madeGroup, true);
  console.log('pin & theme test passed');
  process.exit(0);
})().catch((err) => { console.error(err); process.exit(1); });
