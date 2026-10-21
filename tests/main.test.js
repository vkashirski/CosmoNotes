// Main process with a fake Electron: windows, saving, attachments, permissions, reopen state.
const assert = require('assert'); const fs=require('fs'); const path=require('path');
const Module = require('module');
const orig = Module._resolveFilename;
Module._resolveFilename = function (req, ...a) { if (req === 'electron') return require.resolve(path.join(__dirname, 'fake-electron', 'index.js')); return orig.call(this, req, ...a); };
const E = require('electron');
global.Response = class { constructor(b,o){ this.status=o?.status } };
require(path.join(__dirname, '..', 'main.js'));
const tick = (ms=50) => new Promise(r=>setTimeout(r,ms));
const ev = (w) => ({ sender: w.webContents, returnValue: undefined });
(async () => {
  await tick(100);
  const H = E.__handlers, L = E.__listeners;
  let notes = E.__all.filter(w => w.file.endsWith('note.html'));
  assert.equal(notes.length, 1, 'welcome note opens on first run');
  const w = notes[0];
  const n = await H['note:get'](ev(w));
  assert.ok(n.html.includes('checklist'));
  await H['note:update'](ev(w), { html: '<b>x</b>', text: 'x', opacity: 0.5, pinned: true, color: 'mint', evil: 1 });
  assert.equal(w.opacity, 0.5); assert.equal(w.top, true); assert.equal(w.bg, '#CDF3E8');
  L['note:hover'](ev(w), true); assert.equal(w.opacity, 1); L['note:hover'](ev(w), false); assert.equal(w.opacity, 0.5);
  await H['note:update'](ev(w), { rolled: true }); assert.equal(w.bounds.height, 34);
  await H['note:update'](ev(w), { rolled: false }); assert.equal(w.bounds.height, 300);
  // move & resize get remembered
  w.setPosition(500, 400); await tick(800);
  // new note next to it
  await H['note:new'](ev(w));
  notes = E.__all.filter(x => x.file.endsWith('note.html') && !x.destroyed);
  assert.equal(notes.length, 2);
  assert.equal(notes[1].bounds.x, 500 + 340 + 14, 'new note placed beside');
  const url = await H['att:save'](ev(w), new Uint8Array([1,2,3]), 'png');
  assert.ok(url.startsWith('stickyfile://att/'));
  const resp = await E.__proto({ url });
  assert.ok(resp.url && resp.url.startsWith('file://'), 'attachment served');
  const bad = await E.__proto({ url: 'stickyfile://att/..%2F..%2Fsettings.json' });
  assert.equal(bad.status, 404, 'no path tricks');
  await assert.rejects(async () => H['att:save'](ev(w), new Uint8Array([1]), 'exe'));
  await H['open-external'](ev(w), 'javascript:alert(1)'); assert.equal(E.__opened, undefined);
  await H['open-external'](ev(w), 'https://example.com'); assert.equal(E.__opened, 'https://example.com/');
  let perm; E.__perm(null, 'media', (v)=>perm=v, { mediaTypes: ['audio'] }); assert.equal(perm, true);
  E.__perm(null, 'media', (v)=>perm=v, { mediaTypes: ['video'] }); assert.equal(perm, false);
  E.__perm(null, 'geolocation', (v)=>perm=v, {}); assert.equal(perm, false);
  // close with X -> stays in list as closed
  await H['note:close'](ev(notes[1]));
  let list = await H['list:get']();
  assert.equal(list.notes.length, 2);
  assert.equal(list.notes.filter(x => x.open).length, 1);
  // trash + restore + destroy
  const firstId = list.notes.find(x => x.open).id;
  await H['list:trash'](null, firstId);
  list = await H['list:get']();
  assert.ok(list.notes.find(x => x.id === firstId).deletedAt);
  await H['list:restore'](null, firstId);
  await H['list:open-note'](null, firstId);
  // sync save on unload
  const w3 = E.__all.filter(x => x.file.endsWith('note.html') && !x.destroyed)[0];
  const e3 = ev(w3); L['note:update-sync'](e3, { html: 'final words', text: 'final words' }); assert.equal(e3.returnValue, true);
  // quitting keeps open notes marked open
  E.app.quit(); E.__all.forEach(x => x.close()); await tick(2700);
  const files = fs.readdirSync(path.join(process.env.FAKE_DATA, 'notes')).filter(f => f.endsWith('.json'));
  const saved = files.map(f => JSON.parse(fs.readFileSync(path.join(process.env.FAKE_DATA, 'notes', f))));
  const openOne = saved.find(s => s.id === firstId);
  assert.equal(openOne.open, true, 'still marked open after quit -> reopens next launch');
  assert.equal(openOne.html, 'final words');
  assert.deepEqual([openOne.bounds.x, openOne.bounds.y], [500, 400], 'position remembered');
  assert.ok(fs.readdirSync(path.join(process.env.FAKE_DATA, 'backups')).length >= 1, 'daily backup made');
  console.log('main smoke test passed');
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
