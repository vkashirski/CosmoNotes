'use strict';
// A note window in Chromium (tests/helpers/note-ui.js: the real note.html with a stand-in window.sticky):
// - the text toolbar's "Normal" colour and "No highlight" keep the text selected, so the next button still works (1.1.45);
// - the Medieval font (Augusta) loads from src/fonts/ and the text panel puts it on the selected text;
// - word wrap off = no limit: a line only ends where Enter was pressed, however wide or narrow the note (1.1.45); an
//   older note with a drawing keeps its locked width; the first drawing on a note with word wrap off moves nothing.
const assert = require('assert');

const LONG = 'This is a fairly long line of text that would wrap several times in a small sticky note window.';
const look = (page) => page.evaluate(() => {
  const sh = document.getElementById('sheet');
  return { cls: sh.className, lines: [...document.querySelectorAll('#editor p')].map((p) => Math.round(p.getBoundingClientRect().height)),
    img: Math.round((document.querySelector('#editor img') || { getBoundingClientRect: () => ({ width: 0 }) }).getBoundingClientRect().width) };
});
(async () => {
  const nu = await require('./helpers/note-ui')();
  const open = (note, w) => nu.open(note, w);
  const press = nu.press;
  // (1) Normal colour keeps the selection, so the next button still works
  let page = await open({ html: '<p>Hello brave new world</p>' });
  await page.evaluate(() => {
    const ed = document.getElementById('editor'); ed.focus();
    const t = ed.querySelector('p').firstChild; const r = document.createRange(); r.setStart(t, 6); r.setEnd(t, 15);
    getSelection().removeAllRanges(); getSelection().addRange(r);
  });
  await page.waitForTimeout(100);
  await press(page, '#btnText');
  await press(page, '#textPop [data-fore="#D93B3B"]');
  await press(page, '#textPop [data-fore="inherit"]');
  assert.equal(await page.evaluate(() => getSelection().toString()), 'brave new', 'Normal keeps the text selected');
  assert.equal(await page.evaluate(() => document.getElementById('editor').innerHTML), '<p>Hello brave new world</p>');
  await press(page, '#textPop [data-hilite="#FFE74C"]');
  assert.ok(/<span style="background-color: rgb\(255, 231, 76\);">brave new<\/span>/.test(await page.evaluate(() => document.getElementById('editor').innerHTML)), 'the next button still changes it');
  await press(page, '#textPop [data-hilite="transparent"]');
  assert.equal(await page.evaluate(() => getSelection().toString()), 'brave new', 'No highlight keeps it selected too');
  
  // (1b) the Medieval font: its file (src/fonts/Augusta.ttf) loads, and the text panel can put it on part of the text
  page = await open({ html: '<p>Hello brave new world</p>', font: 'medieval' });
  assert.ok(await page.evaluate(async () => (await document.fonts.load('18px Augusta')).length === 1), 'the Augusta font file loads');
  assert.ok(/^"?Augusta/.test(await page.evaluate(() => getComputedStyle(document.getElementById('editor')).fontFamily)), 'a Medieval note is written in it');
  page = await open({ html: '<p>Hello brave new world</p>' });
  await page.evaluate(() => {
    const ed = document.getElementById('editor'); ed.focus();
    const t = ed.querySelector('p').firstChild; const r = document.createRange(); r.setStart(t, 6); r.setEnd(t, 11);
    getSelection().removeAllRanges(); getSelection().addRange(r);
  });
  await page.waitForTimeout(100);
  await press(page, '#btnText');
  await press(page, '#fontSeg [data-font="medieval"]');
  assert.ok(/<font face="Augusta">brave<\/font>/.test(await page.evaluate(() => document.getElementById('editor').innerHTML)), 'Medieval on the selected text');
  assert.ok(await page.isVisible('#fontSeg [data-font="medieval"].on'), 'the panel shows it');

  // (2) word wrap off = no limit
  page = await open({ html: `<p>${LONG}</p><p>short</p>` });
  const on = await look(page);
  assert.ok(on.lines[0] > on.lines[1] * 2, 'word wrap on: the long line wraps');
  await press(page, '#btnWrap');
  let off = await look(page);
  assert.ok(off.cls.includes('nowrap'), 'word wrap off: no limit');
  assert.equal(off.lines[0], off.lines[1], 'the long line is one line');
  assert.deepEqual(await page.evaluate(() => window.__updates.slice(-1)[0]), { wrapWidth: 332, nowrap: true });
  await page.setViewportSize({ width: 2000, height: 320 }); await page.waitForTimeout(200);
  assert.equal((await look(page)).lines[0], off.lines[1], 'a wider note: still one line');
  await page.setViewportSize({ width: 250, height: 320 }); await page.waitForTimeout(200);
  assert.equal((await look(page)).lines[0], off.lines[1], 'a narrower note: still one line (scrolls sideways)');
  await press(page, '#btnWrap');
  assert.deepEqual(await page.evaluate(() => window.__updates.slice(-1)[0]), { wrapWidth: null, nowrap: false }, 'back on');
  assert.ok((await look(page)).lines[0] > off.lines[1] * 2, 'word wrap on again: it wraps');
  
  // an older note with word wrap off and no drawing: no limit too
  page = await open({ html: `<p>${LONG}</p><p>x</p>`, wrapWidth: 200 });
  off = await look(page);
  assert.ok(off.cls.includes('nowrap') && off.lines[0] === off.lines[1], 'older note without a drawing: no limit');
    // an older note with a drawing keeps its text at the locked width (so the drawing stays on its words)
  page = await open({ html: `<p>${LONG}</p><p>x</p>`, wrapWidth: 200, ink: { s: [{ t: 'pen', c: '#000', w: 3, p: [10, 10, 50, 50] }] } });
  off = await look(page);
  assert.ok(off.cls.includes('fixed') && !off.cls.includes('nowrap') && off.lines[0] > off.lines[1] * 2, 'older note with a drawing: locked width');
  assert.equal(await page.evaluate(() => Math.round(document.getElementById('sheet').getBoundingClientRect().width)), 200);
  
  // the first drawing on a note with word wrap off: lines and pictures stay as they are, also when the note is resized
  const IMG = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="900" height="300"><rect width="900" height="300" fill="red"/></svg>');
  page = await open({ html: `<p>${LONG}</p><img class="att-img" src="${IMG}"><p>x</p>` });
  await press(page, '#btnWrap');
  await page.setViewportSize({ width: 500, height: 320 }); await page.waitForTimeout(200);
  const before = await look(page);
  assert.ok(before.img > 400, `pictures fit the note (${before.img})`);
  await press(page, '#btnInk');
  await page.mouse.move(60, 120); await page.mouse.down(); await page.mouse.move(120, 160, { steps: 5 }); await page.mouse.up();
  await page.waitForTimeout(600);
  const after = await look(page);
  assert.ok(after.cls.includes('nowrap') && after.cls.includes('inked'), 'still no limit, with a drawing');
  assert.deepEqual([after.lines, after.img], [before.lines, before.img], 'nothing moved under the drawing');
  const saved = await page.evaluate(() => window.__updates.find((u) => u.ink));
  assert.equal(saved.nowrap, true); assert.equal(saved.wrapWidth, 472, 'pictures keep the width they had');
  await page.setViewportSize({ width: 300, height: 320 }); await page.waitForTimeout(200);
  assert.equal((await look(page)).img, before.img, 'with a drawing, pictures keep their size in a narrower note');
  await nu.done(); // (fails on any error in a page)
  console.log('ok');
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
