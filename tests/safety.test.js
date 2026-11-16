'use strict';
// What a window may and may not do (main process): saving attachments (images only) and reading them back through
// stickyfile:// (no path tricks) and for Copy image, opening links (web pages only), permissions (the microphone only), and which extra
// windows a note may open (its toolbars and pop-ups; the list none).
const assert = require('assert');
const app = require('./helpers/app');

(async () => {
  const { H, E, ev } = await app.start();
  const w = app.noteWins()[0];

  // ---- attachments
  const url = await H['att:save'](ev(w), new Uint8Array([1, 2, 3]), 'png');
  assert.ok(url.startsWith('stickyfile://att/'));
  const resp = await E.__proto({ url });
  assert.ok(resp.url && resp.url.startsWith('file://'), 'attachment served');
  assert.equal((await E.__proto({ url: 'stickyfile://att/..%2F..%2Fsettings.json' })).status, 404, 'no path tricks');
  await assert.rejects(async () => H['att:save'](ev(w), new Uint8Array([1]), 'exe'), 'only pictures and sound can be saved');
  // Copy image (1.4.3): main reads the note's picture for it (the note's file:// page can't) and writes the clipboard
  assert.deepEqual([...await H['att:image'](ev(w), url)], [1, 2, 3], 'a saved photo is read for Copy image');
  assert.equal(await H['att:image'](ev(w), 'stickyfile://att/..%2F..%2Fsettings.json'), null, 'no path tricks there either');
  const clip = await H['att:save'](ev(w), new Uint8Array([4]), 'webm');
  assert.equal(await H['att:image'](ev(w), clip), null, 'only pictures');
  assert.equal(await H['att:image'](ev(w), 'file:///C:/Windows/win.ini'), null, 'no other files');
  assert.equal(await H['att:image']({ sender: {} }, url), null, 'only for a note window');
  const fetchWas = E.net.fetch;
  E.net.fetch = async (u) => ({ ok: true, arrayBuffer: async () => new Uint8Array([9, u.length]).buffer });
  assert.deepEqual([...await H['att:image'](ev(w), 'https://example.com/a.png')], [9, 25], 'a picture from a web page: main fetches it');
  E.net.fetch = fetchWas;
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 13, 10]);
  assert.equal(await H['clip:image'](ev(w), png), true); assert.deepEqual(E.__clip.bytes, [...png], 'the PNG is on the clipboard');
  assert.equal(await H['clip:image'](ev(w), new Uint8Array([1, 2, 3, 4, 5])), false, 'not a picture: nothing copied');
  assert.equal(await H['clip:image'](ev(w), 'x'), false);

  // ---- links
  await H['open-external'](ev(w), 'javascript:alert(1)'); assert.equal(E.__opened, undefined, 'no javascript: links');
  await H['open-external'](ev(w), 'https://example.com'); assert.equal(E.__opened, 'https://example.com/');

  // ---- permissions: the microphone (for voice notes), nothing else
  let perm;
  E.__perm(null, 'media', (v) => { perm = v; }, { mediaTypes: ['audio'] }); assert.equal(perm, true);
  E.__perm(null, 'media', (v) => { perm = v; }, { mediaTypes: ['video'] }); assert.equal(perm, false, 'no camera');
  E.__perm(null, 'geolocation', (v) => { perm = v; }, {}); assert.equal(perm, false);

  // ---- extra windows: a note may open its five toolbar / pop-up windows, nothing else
  const open = w.webContents.openHandler;
  assert.equal(open({ url: 'https://example.com', frameName: '' }).action, 'deny', 'other windows stay blocked');
  assert.equal(open({ url: 'about:blank', frameName: 'other' }).action, 'deny');
  const bars = { cosmoInkBar: { focusable: false }, cosmoTextBar: { focusable: false, title: 'Text' }, cosmoMenuBar: { focusable: true, title: 'Note settings' }, cosmoFxBar: { focusable: false }, cosmoCkBar: { focusable: false, title: 'Checklists' } };
  for (const [frameName, want] of Object.entries(bars)) {
    const r = open({ url: 'about:blank', frameName });
    assert.equal(r.action, 'allow', `${frameName} may open`);
    const o = r.overrideBrowserWindowOptions;
    assert.equal(o.parent, w, `${frameName} belongs to its note`);
    assert.equal(o.focusable, want.focusable, frameName === 'cosmoMenuBar' ? 'the ⋯ menu can take the keyboard' : `${frameName} never takes the focus`);
    if (want.title) assert.equal(o.title, want.title);
  }
  assert.equal(open({ url: 'about:blank', frameName: 'cosmoInkBar' }).overrideBrowserWindowOptions.transparent, true);
  await H['list:show']();
  assert.equal(app.listWin().webContents.openHandler({ url: 'about:blank', frameName: 'cosmoInkBar' }).action, 'deny', 'the list window can’t open one');
  console.log('ok');
  process.exit(0);
})();
