'use strict';
// The drawing and text toolbars outside the note (main/ink-geometry.js): each in a small window of its own, stuck to a
// side of the note when dropped within 12 px of it (and following the note), loose further away, always on the screen,
// hidden while the note is rolled up, on top with a pinned note, and back inside when dropped on the note.
const assert = require('assert');
const app = require('./helpers/app');

(async () => {
  const { H, L, E, ev } = await app.start();
  const w = app.noteWins()[0];
  const barWin = (frameName) => {
    const child = new E.BrowserWindow(w.webContents.openHandler({ url: 'about:blank', frameName }).overrideBrowserWindowOptions);
    w.webContents.emit('did-create-window', child, { frameName });
    return child;
  };

  // ---- one drawing toolbar window per note
  const child = barWin('cosmoInkBar');
  assert.equal(w.inkWin, child); assert.equal(child.parent, w);
  const extra = barWin('cosmoInkBar');
  assert.ok(extra.destroyed, 'only one toolbar window per note');

  // ---- sticking to a side: only within 12 px of the note's edge (1.1.20 / 1.1.22), on either side of it
  w.setBounds({ x: 400, y: 300, width: 340, height: 300 });
  const size = { w: 308, h: 176, inset: { l: 6, t: 8, r: 12, b: 14 } };
  const dragAt = (gap) => { L['ink:drag'](ev(w), { x: 740 + gap - 6, y: 320 - 8, px: 800, py: 340, ...size }); return w.inkState.mode; };
  assert.equal(dragAt(11), 'dock', '11 px away: sticks');
  assert.equal(dragAt(13), 'free', '13 px away: stays loose');
  assert.equal(dragAt(-11), 'dock', 'over the edge by 11 px: sticks');
  assert.equal(dragAt(-13), 'free', 'over the edge by more: loose (no longer up to half its width)');
  L['ink:drag'](ev(w), { x: 400 + 340 + 10 - 6, y: 320 - 8, px: 800, py: 340, ...size });
  assert.equal(w.inkState.mode, 'dock'); assert.equal(w.inkState.side, 'right');
  assert.ok(child.visible, 'shown');
  assert.equal(child.bounds.x, 400 + 340 + 4 - 6, 'right next to the note (4 px gap)');
  assert.equal(child.bounds.y, 320 - 8, 'at the height it was dropped');
  // the note moves: the toolbar goes with it; the note gets shorter: it stays along its side
  w.setPosition(100, 200);
  assert.equal(child.bounds.x, 100 + 340 + 4 - 6); assert.equal(child.bounds.y, 220 - 8);
  w.setSize(340, 150);
  assert.ok(child.bounds.y + 8 >= 200, 'still level with the note');
  // the top, the left
  L['ink:drag'](ev(w), { x: 120 - 6, y: 200 - 10 - 154 - 8, px: 200, py: 150, ...size });
  assert.equal(w.inkState.side, 'top');
  assert.equal(child.bounds.y + 8 + 154, 200 - 4, 'just above the note');
  w.setPosition(600, 200);
  L['ink:drag'](ev(w), { x: 600 - 10 - 290, y: 210, px: 550, py: 230, ...size });
  assert.equal(w.inkState.side, 'left');
  assert.equal(child.bounds.x + 6 + 290, 600 - 4, 'just left of the note');
  // at the screen's left edge there's no room on the left: it comes over the note instead of off the screen
  w.setPosition(100, 200);
  assert.equal(child.bounds.x + 6, 0, 'kept on the screen');

  // ---- loose: stays where it was dropped, and on the screen
  L['ink:drag'](ev(w), { x: 1200, y: 600, px: 1300, py: 620, ...size });
  assert.equal(w.inkState.mode, 'free');
  let dropped = await H['ink:drop'](ev(w), { px: 1300, py: 620 });
  assert.deepEqual(dropped, { inside: false, state: { mode: 'free', x: 1200, y: 600 } });
  w.setPosition(150, 220);
  assert.equal(child.bounds.x, 1200, 'a loose toolbar stays put');
  L['ink:drag'](ev(w), { x: 1900, y: 1000, px: 1950, py: 1030, ...size });
  assert.ok(child.bounds.x + 6 + 290 <= 1920 && child.bounds.y + 8 + 154 <= 1040, 'always on the screen');

  // ---- rolled up: hidden; pinned: on top too; shown again at a remembered place; dropped on the note: inside again
  L['ink:drag'](ev(w), { x: 150 + 340 + 2, y: 230, px: 600, py: 250, ...size });
  dropped = await H['ink:drop'](ev(w), { px: 600, py: 250 });
  assert.equal(dropped.state.mode, 'dock'); assert.equal(dropped.state.side, 'right');
  await H['note:update'](ev(w), { rolled: true });
  assert.equal(child.visible, false, 'hidden while rolled up');
  await H['note:update'](ev(w), { rolled: false });
  assert.equal(child.visible, true, 'back when unrolled');
  await H['note:update'](ev(w), { pinned: true });
  assert.equal(child.top, true, 'a pinned note’s toolbar is on top too');
  L['ink:hide'](ev(w));
  assert.equal(child.visible, false);
  L['ink:show'](ev(w), { mode: 'dock', side: 'bottom', off: 10, ...size });
  assert.equal(child.visible, true); assert.equal(child.bounds.y + 8, w.bounds.y + w.bounds.height + 4, 'under the note');
  dropped = await H['ink:drop'](ev(w), { px: w.bounds.x + 50, py: w.bounds.y + 50 });
  assert.equal(dropped.inside, true); assert.equal(child.visible, false);
  child.close();
  assert.equal(w.inkWin, null, 'its window closing forgets it');

  // ---- the text toolbar: its own window, the same rules, the drawing toolbar untouched (1.1.16)
  await H['note:update'](ev(w), { pinned: false });
  const inkChild = barWin('cosmoInkBar');
  const textChild = barWin('cosmoTextBar');
  assert.equal(w.textWin, textChild, 'both toolbars can have a window'); assert.equal(w.inkWin, inkChild); assert.ok(!textChild.destroyed && !inkChild.destroyed);
  delete w.inkState;
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
  // stuck to a side, it slides past the note's corners (it only has to keep touching the side)
  const tc2 = barWin('cosmoTextBar');
  w.setBounds({ x: 400, y: 300, width: 340, height: 300 }); w.emit('move');
  L['ink:drag'](ev(w), { x: 400 + 340 + 4 - 12, y: 300 + 300 - 60 - 8, px: 900, py: 560, ...tsize });
  assert.equal(w.textState.side, 'right');
  assert.ok(tc2.bounds.y + 8 + 168 > 300 + 300, 'it goes past the bottom corner instead of stopping there');
  console.log('ok');
  process.exit(0);
})();
