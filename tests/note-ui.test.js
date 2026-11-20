'use strict';
// A note window in Chromium (tests/helpers/note-ui.js: the real note.html with a stand-in window.sticky):
// - the text toolbar's "Normal" colour and "No highlight" keep the text selected, so the next button still works (1.1.45);
// - the Medieval font (Augusta) loads from src/fonts/ and the text panel puts it on the selected text;
// - word wrap off = no limit: a line only ends where Enter was pressed, however wide or narrow the note (1.1.45); an
//   older note with a drawing keeps its locked width; the first drawing on a note with word wrap off moves nothing.
// - voice recordings (1.2.4): the pieces go to main while recording; Save, the X, Esc (saves), closing and locking
//   mid-recording (the chip is in the save that follows), and the old in-memory way when main can't write the file.
// - voice to text (1.3.1; main's side: stt.test.js): + Add → Speak to text uses the recorder (the file is the safety net)
//   and sends 16 kHz pieces; the marker (grey draft, labels) is never saved; each settled piece is one Undo step; Stop =
//   the text stays and the clip is deleted; Cancel, an error, closing, locking = the recording stays as a voice note
//   where the text was. Right-click a voice note → Transcribe: the text on the line after it, in its span, one Undo
//   step (Undo brings no marker back); again = "Replace the text from last time?"; locking = nothing added; pasting
//   strips the stt-* classes.
// - Title font (1.3.3): the ⋯ menu's Handwritten / Rounded / Medieval (1.3.6: no Same) sets the top bar's title font, saved as titleFont.
// - a locked note's titles (1.3.11): read-only in the ⋯ menu while it is locked (hidden); unlocked, they can be changed.
// - copy / cut / paste (1.3.2): a copied checklist line (even part of one) pastes as a checklist line, ticked or not, with its
//   font, colour, size, bold and highlight; the note's own font goes along into a note with another font; Ctrl+Shift+V is
//   still plain text; Cut takes the words away; anything else in the copied HTML is cleaned out; another app's list pasted
//   into a checklist line joins it, line by line (1.4.4). A pasted photo is one
//   Undo step in its place among the typing, and so is a checklist tick (1.3.31); Redo goes back the same way.
//   Every change the note makes itself (photo menu and size handle, voice note and link menus, tables, a typed web
//   address becoming a link) is one Undo step with Redo (1.3.32).
// - a link on a picture (1.4.11): right-click → Add link (no "Text to show"), its menu, a click opens it, Shift+click picks
//   it, the caret beside it stays out of the link, each change one Undo step.
// - reminders (1.4.1): the strip of one that rings (Snooze, Done, a locked note's), Add → Reminder and its panel.
// - + and Ctrl+N (1.4.6): every press asks for a note; a ring spins around + until they have all shown.
// - checklist boxes (1.3.15): one size for the same size of words, whatever their font; an empty line's box is the size its
//   words will be (also after Backspace emptied it); copying a whole line doesn't bring an empty line along, and an empty
//   line with nothing in it (no height, its box over the next one) is dropped when the note opens.
// - text size and font (1.3.17, the CSS since 1.3.18): Small / Normal / Big work on a whole line of words in another font,
//   a size and a font on one tag both count. 1.4.12: a font never changes a size: words in another font, a font picked
//   for Big words and a whole note in another font keep their size, their line height and their box.
// - checklists (1.3.19): a click on a box ticks it; dragging a box moves its line (a bar shows where; Esc: nothing moves; out of
//   a nested list, which goes when empty); only the box itself ticks (1.3.38); ticked lines to the bottom (unticking moves nothing, 1.3.20); drag off = the press ticks; boxes of one
//   size (still beside their words); a ticked line's strike in each word's own size (1.4.21), through the middle of the small letters (1.4.23); ⋯ → Checklists… and its pop-up (1.3.21: set to what Settings says = follow Settings,
//   "this note" marks, Use Settings); Undo / Redo of each. Pop-ups (1.3.22): a drag moves once a frame; "close all"
//   closes nothing on press, everything on click.
// - evening colours and the panic button (1.3.27): the paper mixes into its evening shade by the phase main sends (and back),
//   only while on for the note (Settings, or its own ⋯ switch: set like Settings = follow it again); a dark paper has no
//   switch; the panic button only while it is on, its tooltip names the shortcut, a click asks main; ⋯ → "Close with the
//   panic button" off = panic: false, with "this note".
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

  // (1c) Title font (1.3.3): the title follows the note's font until the ⋯ menu gives it its own (1.3.6: no "Same" button)
  const titleFace = (pg) => pg.evaluate(() => getComputedStyle(document.getElementById('title')).fontFamily);
  page = await open({ html: '<p>Milk</p>', title: 'Shopping', font: 'hand' });
  assert.ok(/^"?Caveat/.test(await titleFace(page)), 'no title font: the note’s font');
  await press(page, '#btnMenu');
  assert.equal(await page.$$eval('#titleFontSeg button', (x) => x.map((b) => b.dataset.tfont).join()), 'hand,round,medieval', 'three fonts, no "Same"');
  assert.deepEqual(await page.$$eval('#menu #titleInput, #menu #coverRow, #menu #titleFontSeg', (x) => x.map((e) => e.id)), ['titleInput', 'coverRow', 'titleFontSeg'], '1.3.11: Title, Title while locked, then Title font');
  assert.ok(await page.isVisible('#titleFontSeg [data-tfont="hand"].on'), 'never picked: the note’s font is lit');
  await press(page, '#titleFontSeg [data-tfont="medieval"]');
  assert.ok(/^"?Augusta/.test(await titleFace(page)), 'Medieval title');
  assert.ok(/^"?Caveat/.test(await page.evaluate(() => getComputedStyle(document.getElementById('editor')).fontFamily)), 'the text keeps the note’s font');
  assert.ok(await page.isVisible('#titleFontSeg [data-tfont="medieval"].on'), 'the menu shows it');
  // 1.3.12: picking a font moves nothing in the menu (fixed heights)
  const spots = () => page.evaluate(() => ['titleInput', 'titleFontSeg', 'colors', 'miDelete'].map((id) => document.getElementById(id).offsetTop).join());
  const atMed = await spots();
  for (const f of ['hand', 'round', 'medieval']) { await press(page, `#titleFontSeg [data-tfont="${f}"]`); assert.equal(await spots(), atMed, `nothing moves with ${f}`); }
  await press(page, '#titleFontSeg [data-tfont="hand"]');
  assert.ok(/^"?Caveat/.test(await titleFace(page)), 'Handwritten again');
  assert.deepEqual((await page.updates()).filter((u) => 'titleFont' in u).map((u) => u.titleFont), ['medieval', 'hand', 'round', 'medieval', 'hand'], 'saved: the font picked each time');
  page = await open({ html: '<p>Milk</p>', title: 'Shopping', font: 'round', titleFont: 'hand' });
  assert.ok(/^"?Caveat/.test(await titleFace(page)), 'a saved title font shows when the note opens');
  // (1d) a locked note (1.3.28, the owner's wish): while it is hidden, nothing of it can be changed: no ⋯ menu (titles, colour,
  // see-through, effects, checklists, duplicate) and no effects button; the lock screen, pin, roll up and the window's buttons stay.
  // Unlocked, both titles can be changed.
  const typeIn = (pg, sel, v) => pg.evaluate(([s, val]) => { const x = document.querySelector(s); x.value = val; x.dispatchEvent(new Event('input', { bubbles: true })); }, [sel, v]);
  page = await open({ html: '', title: '', locked: true, lockedBy: 'self', hidden: true, coverTitle: 'Bank', fx: { e: 'snow', f: null } });
  assert.ok(await page.isVisible('#lockScreen'), 'locked: the lock screen');
  assert.ok(!(await page.isVisible('#btnMenu')) && !(await page.isVisible('#btnFx')), 'no ⋯ menu, no effects button');
  assert.ok(await page.isVisible('#btnPin') && await page.isVisible('#btnRoll') && await page.isVisible('#btnClose'), 'pin, roll up and close stay');
  page = await open({ html: '<p>dear diary</p>', title: 'Diary', locked: true, lockedBy: 'self', hidden: false, coverTitle: 'Bank', fx: { e: 'snow', f: null } });
  assert.ok(await page.isVisible('#btnMenu') && await page.isVisible('#btnFx'), 'unlocked: the ⋯ menu and the effects button are back');
  await press(page, '#btnMenu');
  assert.ok(await page.isVisible('#coverRow') && await page.inputValue('#coverInput') === 'Bank', 'unlocked: the title while locked shows');
  await typeIn(page, '#coverInput', 'Bank 2'); await page.waitForTimeout(450);
  assert.ok((await page.updates()).some((u) => u.coverTitle === 'Bank 2'), 'unlocked: the title while locked is saved');

  // (2) word wrap off = no limit
  page = await open({ html: `<p>${LONG}</p><p>short</p>` });
  const on = await look(page);
  assert.ok(on.lines[0] > on.lines[1] * 2, 'word wrap on: the long line wraps');
  await press(page, '#btnWrap');
  let off = await look(page);
  assert.ok(off.cls.includes('nowrap'), 'word wrap off: no limit');
  assert.equal(off.lines[0], off.lines[1], 'the long line is one line');
  assert.deepEqual(await page.evaluate(() => window.__updates.slice(-1)[0]), { wrapWidth: 332, nowrap: true, wrapFixed: false });
  await page.setViewportSize({ width: 2000, height: 320 }); await page.waitForTimeout(200);
  assert.equal((await look(page)).lines[0], off.lines[1], 'a wider note: still one line');
  await page.setViewportSize({ width: 250, height: 320 }); await page.waitForTimeout(200);
  assert.equal((await look(page)).lines[0], off.lines[1], 'a narrower note: still one line (scrolls sideways)');
  await press(page, '#btnWrap');
  assert.deepEqual(await page.evaluate(() => window.__updates.slice(-1)[0]), { wrapWidth: null, nowrap: false, wrapFixed: false }, 'back on');
  assert.ok((await look(page)).lines[0] > off.lines[1] * 2, 'word wrap on again: it wraps');
  
  // an older note with word wrap off and no drawing: no limit too
  page = await open({ html: `<p>${LONG}</p><p>x</p>`, wrapWidth: 200 });
  off = await look(page);
  assert.ok(off.cls.includes('nowrap') && off.lines[0] === off.lines[1], 'older note without a drawing: no limit');
    // a note with a drawing keeps its text at the locked width (so the drawing stays on its words; store.js normalize
  // gives notes from before 1.3.29 their wrapFixed)
  page = await open({ html: `<p>${LONG}</p><p>x</p>`, wrapWidth: 200, wrapFixed: true, ink: { s: [{ t: 'pen', c: '#000', w: 3, p: [10, 10, 50, 50] }] } });
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

  // 1.3.29: the first drawing on a note with word wrap on locks the text's width, and erasing or undoing the drawing
  // keeps it locked (it used to turn into "no limit": every table cell and paragraph un-wrapped)
  const CELL = 'Writes down what you want and suggests what to learn first.';
  page = await open({ html: `<table><tbody><tr><td>/a</td><td>${CELL}</td></tr><tr><td>/b</td><td>${CELL}</td></tr></tbody></table><p>${LONG}</p>` }, 500, 400);
  const table = () => page.evaluate(() => {
    const t = document.querySelector('#editor table'); const c = t.rows[0].cells[1];
    return { cls: document.getElementById('sheet').className, w: Math.round(t.getBoundingClientRect().width), h: Math.round(c.getBoundingClientRect().height) };
  });
  const t0 = await table();
  await press(page, '#btnInk');
  await page.mouse.move(250, 60); await page.mouse.down(); await page.mouse.move(250, 140, { steps: 6 }); await page.mouse.up();
  await page.waitForTimeout(600);
  assert.equal((await page.evaluate(() => window.__updates.find((u) => u.ink))).wrapFixed, true, 'the first drawing locks the width');
  const t1 = await table();
  assert.ok(t1.cls.includes('fixed') && t1.w === t0.w && t1.h === t0.h, 'drawn: the table as it was');
  await press(page, '#btnUndo'); await page.waitForTimeout(300);
  const t2 = await table();
  assert.ok(t2.cls.includes('fixed') && !t2.cls.includes('nowrap') && t2.w === t0.w && t2.h === t0.h, `undone: the table as it was (${JSON.stringify(t2)})`);
  await press(page, '#btnRedo'); await page.waitForTimeout(300);
  await page.evaluate(() => { const K = window.COSMO_NOTE_KIT; K.inkState.tool = 'eraser'; K.inkState.eraseMode = 'stroke'; K.paintInkBar(); });
  await page.mouse.move(230, 100); await page.mouse.down(); await page.mouse.move(270, 100, { steps: 6 }); await page.mouse.up();
  await page.waitForTimeout(600);
  const t3 = await table();
  assert.ok(!(await page.evaluate(() => window.COSMO_NOTE_KIT.hasInk())), 'the line is erased');
  assert.ok(t3.cls.includes('fixed') && t3.w === t0.w && t3.h === t0.h, `erased: the table as it was (${JSON.stringify(t3)})`);
  assert.ok(!(await page.updates()).some((u) => u.wrapFixed === false || u.nowrap === true), 'erasing saves no layout change');

  // ---- voice recordings (1.2.4): the stand-in main records what the window asks for
  const recInit = (canWrite) => {
    const base = window.sticky;
    const R = window.__rec = { calls: [], chunks: 0, bytes: 0 };
    const own = {
      recStart: () => { R.calls.push(['start']); return Promise.resolve(canWrite ? { id: 'r1.webm', url: 'stickyfile://att/r1.webm' } : null); },
      recChunk: (id, b) => { R.chunks++; R.bytes += b.length; R.calls.push(['chunk', id]); },
      recEnd: (id, mode) => { R.calls.push(['end', id, mode]); return Promise.resolve(mode === 'discard' ? null : 'stickyfile://att/' + id); },
      recDone: (id) => { R.calls.push(['done', id]); return Promise.resolve(true); },
      saveAttachment: (b, ext) => { R.calls.push(['saveAttachment', ext, b.length]); return Promise.resolve('stickyfile://att/mem-1.webm'); },
    };
    window.sticky = new Proxy({}, { get: (t, k) => own[k] || base[k] });
  };
  const recCalls = (pg) => pg.evaluate(() => window.__rec.calls.filter((c) => c[0] !== 'chunk'));
  const startRec = async (pg) => { await pg.evaluate(() => window.COSMO_NOTE_KIT.startRecording()); await pg.waitForTimeout(1300); };
  const savedHtml = async (pg) => (await pg.updates()).map((u) => u.html || '').join('|');
  // Save: the pieces went to main as they came; then the file is finished, the chip is saved, main is told
  page = await nu.open({ html: '<p>Shopping</p>' }, 360, 320, `(${recInit})(true)`);
  await startRec(page);
  const sent = await page.evaluate(() => ({ chunks: window.__rec.chunks, bytes: window.__rec.bytes }));
  assert.ok(sent.chunks >= 3 && sent.bytes > 500, `pieces went to main while recording (${sent.chunks}, ${sent.bytes} bytes)`);
  await press(page, '#recStop'); await page.waitForTimeout(500);
  assert.deepEqual(await recCalls(page), [['start'], ['end', 'r1.webm', 'save'], ['done', 'r1.webm']], 'Save: finished, then main is told the note has it');
  assert.ok((await savedHtml(page)).includes('data-src="stickyfile://att/r1.webm"'), 'the chip is saved');
  assert.ok(await page.evaluate(() => document.getElementById('recbar').hidden));
  // the X throws it away
  page = await nu.open({ html: '<p>x</p>' }, 360, 320, `(${recInit})(true)`);
  await startRec(page); await press(page, '#recCancel'); await page.waitForTimeout(400);
  assert.deepEqual(await recCalls(page), [['start'], ['end', 'r1.webm', 'discard']]);
  assert.ok(!(await savedHtml(page)).includes('voice'), 'no chip');
  // Esc saves (only the X throws a recording away)
  page = await nu.open({ html: '<p>x</p>' }, 360, 320, `(${recInit})(true)`);
  await startRec(page);
  await page.evaluate(() => document.getElementById('editor').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
  await page.waitForTimeout(500);
  assert.deepEqual((await recCalls(page)).map((c) => c[2] || c[0]), ['start', 'save', 'done'], 'Esc = Save');
  // closing mid-recording: the chip is in the window's last (sync) save, main finishes the file
  page = await nu.open({ html: '<p>Meeting</p>' }, 360, 320, `(${recInit})(true)`);
  await startRec(page);
  await page.evaluate(() => window.dispatchEvent(new Event('beforeunload')));
  const last = (await page.updates()).pop();
  assert.ok(last && last.html.includes('stickyfile://att/r1.webm') && last.html.includes('Meeting'), `closing keeps it: the chip is in the last save (${JSON.stringify(last).slice(0, 160)})`);
  assert.deepEqual(await recCalls(page), [['start'], ['end', 'r1.webm', 'kept']]);
  await page.waitForTimeout(400);
  assert.deepEqual(await recCalls(page), [['start'], ['end', 'r1.webm', 'kept']], 'nothing is ended twice');
  // locked mid-recording (Lock again): saved with the chip before the window hides
  page = await nu.open({ html: '<p>Diary</p>' }, 360, 320, `(${recInit})(true)`);
  await startRec(page);
  await page.evaluate(() => window.COSMO_NOTE_KIT.relock());
  await page.waitForTimeout(400);
  assert.ok((await savedHtml(page)).includes('stickyfile://att/r1.webm'), 'locking keeps it');
  assert.deepEqual(await recCalls(page), [['start'], ['end', 'r1.webm', 'kept']]);
  assert.equal(await page.evaluate(() => document.getElementById('editor').innerHTML), '', 'and the note is hidden');
  // main can't write the file: kept in memory and saved at the end, as before 1.2.4
  page = await nu.open({ html: '<p>x</p>' }, 360, 320, `(${recInit})(false)`);
  await startRec(page);
  assert.equal(await page.evaluate(() => window.__rec.chunks), 0, 'no pieces sent without a file');
  await press(page, '#recStop'); await page.waitForTimeout(500);
  const fb = await recCalls(page);
  assert.equal(fb[1][0], 'saveAttachment'); assert.ok(fb[1][2] > 500, 'the whole recording, from memory');
  assert.ok((await savedHtml(page)).includes('stickyfile://att/mem-1.webm'));
  // ---- voice to text (1.3.1): a stand-in main for the recorder and the engine
  const sttInit = () => {
    const base = window.sticky;
    const R = window.__rec = { calls: [], chunks: 0, audio: 0, pcm: null };
    const own = {
      recStart: () => { R.calls.push(['start']); return Promise.resolve({ id: 'r1.webm', url: 'stickyfile://att/r1.webm' }); },
      recChunk: () => { R.chunks++; },
      recEnd: (id, mode) => { R.calls.push(['end', id, mode]); return Promise.resolve(mode === 'discard' ? null : 'stickyfile://att/' + id); },
      recDone: (id) => { R.calls.push(['done', id]); return Promise.resolve(true); },
      sttStart: () => { R.calls.push(['sttStart']); return Promise.resolve(window.__sttStart || { jobId: 'J' }); },
      sttAudio: (id, pcm) => { R.audio++; R.pcm = [id, pcm.constructor.name, pcm.length]; },
      sttStop: (id) => { R.calls.push(['sttStop', id]); return Promise.resolve(window.__stopAnswer || { ok: true }); },
      sttCancel: (id) => { R.calls.push(['sttCancel', id]); return Promise.resolve(true); },
      sttTranscribe: (url, id) => { R.calls.push(['sttTranscribe', url]); return new Promise((r) => { R.tr = { r, id }; }); },
      onStt: (cb) => { window.__stt = cb; },
    };
    window.sticky = new Proxy({}, { get: (t, k) => own[k] || base[k] });
  };
  const sttEv = (pg, e) => pg.evaluate((x) => window.__stt(x), e);
  const ed = (pg) => pg.evaluate(() => document.getElementById('editor').innerHTML);
  const caretEnd = (pg) => pg.evaluate(() => { const e = document.getElementById('editor'); e.focus(); const r = document.createRange(); r.selectNodeContents(e.lastChild); r.collapse(false); getSelection().removeAllRanges(); getSelection().addRange(r); });
  const speak = async (pg) => { await caretEnd(pg); await press(pg, '#btnInsert'); await press(pg, '#insert [data-act="speak"]'); await pg.waitForTimeout(900); };
  const toastNow = (pg) => pg.evaluate(() => document.getElementById('toast').textContent);
  // + Add → Speak to text: the bar says Listening…, the recorder runs, 16 kHz pieces go to main
  page = await nu.open({ html: '<div>Shopping:</div>' }, 380, 320, `(${sttInit})()`);
  assert.ok(await page.evaluate(() => [...document.querySelectorAll('#insert .tile')].some((t) => t.dataset.act === 'speak' && t.textContent.trim() === 'Voice to text')), 'the + Add item (the same name as in Settings)');
  await speak(page);
  assert.deepEqual(await page.evaluate(() => [document.getElementById('recbar').hidden, document.getElementById('recTime').textContent, document.getElementById('recStop').textContent.trim()]), [false, 'Listening…', 'Stop'], 'Listening… with Stop and Cancel');
  const R1 = await page.evaluate(() => window.__rec);
  assert.ok(R1.chunks >= 2 && R1.audio >= 2, `the recording goes to disk and the audio to main (${R1.chunks}, ${R1.audio})`);
  assert.deepEqual(R1.pcm, ['J', 'Float32Array', 4000], '0.25 s pieces at 16 kHz');
  await sttEv(page, { jobId: 'J', type: 'ready', mode: 'live' });
  await sttEv(page, { jobId: 'J', type: 'draft', text: 'milk and' });
  assert.ok((await ed(page)).includes('data-draft=" milk and"'), 'the grey draft is only an attribute of the marker');
  await sttEv(page, { jobId: 'J', type: 'final', text: 'Milk and eggs.' });
  await sttEv(page, { jobId: 'J', type: 'final', text: 'Bread.' });
  await sttEv(page, { jobId: 'J', type: 'draft', text: 'and' });
  await page.waitForTimeout(450);
  assert.equal((await page.updates()).pop().html, '<div>Shopping: Milk and eggs. Bread.</div>', 'saved: the settled text, never the marker or the draft');
  await press(page, '#recStop'); await page.waitForTimeout(500);
  assert.equal(await ed(page), '<div>Shopping: Milk and eggs. Bread.</div>', 'Stop: the marker goes');
  assert.deepEqual(await recCalls(page), [['sttStart'], ['start'], ['sttStop', 'J'], ['end', 'r1.webm', 'discard']], 'Stop: written down, then the clip is deleted');
  await page.evaluate(() => document.execCommand('undo'));
  assert.equal(await ed(page), '<div>Shopping: Milk and eggs.</div>', 'one Undo step per piece');
  // Cancel: the words so far stay, the recording becomes a voice note where the text was
  page = await nu.open({ html: '<div>Call</div>' }, 380, 320, `(${sttInit})()`);
  await speak(page);
  await sttEv(page, { jobId: 'J', type: 'ready', mode: 'after', auto: true });
  assert.equal(await toastNow(page), 'On this device, the words appear when you stop.', 'on the processor: said once, words at Stop');
  assert.ok((await ed(page)).includes('data-label="Writing it down when you stop"'));
  await sttEv(page, { jobId: 'J', type: 'final', text: 'mum' });
  await press(page, '#recCancel'); await page.waitForTimeout(500);
  assert.ok(/^<div>Call mum<span class="voice"[^>]*data-src="stickyfile:\/\/att\/r1\.webm"/.test(await ed(page)), `Cancel: the chip where the text was (${(await ed(page)).slice(0, 90)})`);
  assert.deepEqual(await recCalls(page), [['sttStart'], ['start'], ['sttCancel', 'J'], ['end', 'r1.webm', 'save'], ['done', 'r1.webm']]);
  assert.equal(await toastNow(page), 'Stopped. Your recording is saved as a voice note.');
  // the engine fails at Stop: the recording stays
  page = await nu.open({ html: '<div>x</div>' }, 380, 320, `(${sttInit})()`);
  await page.evaluate(() => { window.__stopAnswer = { ok: false }; });
  await speak(page);
  await press(page, '#recStop'); await page.waitForTimeout(500);
  assert.ok((await ed(page)).includes('stickyfile://att/r1.webm') && !(await ed(page)).includes('stt-pending'), 'a failure keeps the recording as a voice note');
  assert.equal(await toastNow(page), "Couldn't write it down. Your recording is saved.");
  // busy in another note: nothing is recorded
  page = await nu.open({ html: '<div>x</div>' }, 380, 320, `(${sttInit})()`);
  await page.evaluate(() => { window.__sttStart = { error: 'busy' }; });
  await speak(page);
  assert.equal(await toastNow(page), 'Voice to text is busy in another note.');
  assert.ok(await page.evaluate(() => document.getElementById('recbar').hidden) && !(await ed(page)).includes('stt-'), 'no bar, no marker');
  // not downloaded (1.3.4): the same, with its own words
  page = await nu.open({ html: '<div>x</div>' }, 380, 320, `(${sttInit})()`);
  await page.evaluate(() => { window.__sttStart = { error: 'nomodel' }; });
  await speak(page);
  assert.equal(await toastNow(page), "Voice to text isn't downloaded yet. Get it in Settings.");
  assert.ok(await page.evaluate(() => document.getElementById('recbar').hidden) && !(await ed(page)).includes('stt-'), 'not downloaded: no bar, no marker');
  // "When you stop" picked in Settings (auto: false): it waits, without the "On this PC" toast
  page = await nu.open({ html: '<div>x</div>' }, 380, 320, `(${sttInit})()`);
  await speak(page);
  await sttEv(page, { jobId: 'J', type: 'ready', mode: 'after', auto: false });
  assert.ok((await ed(page)).includes('data-label="Writing it down when you stop"') && !(await toastNow(page)).includes('On this device'), 'the person\'s pick: no toast');
  await press(page, '#recCancel'); await page.waitForTimeout(300);
  // closing or locking mid-way: no more text; the chip goes where the text was and is in the save that follows
  page = await nu.open({ html: '<div>Idea</div>' }, 380, 320, `(${sttInit})()`);
  await speak(page);
  await sttEv(page, { jobId: 'J', type: 'final', text: 'one' });
  await page.evaluate(() => window.dispatchEvent(new Event('beforeunload')));
  const lastSave = (await page.updates()).pop().html;
  assert.ok(/^<div>Idea one<span class="voice"[^>]*r1\.webm/.test(lastSave) && !lastSave.includes('stt-pending'), `closing: the chip is in the last save (${lastSave.slice(0, 80)})`);
  assert.deepEqual((await recCalls(page)).slice(-2), [['sttCancel', 'J'], ['end', 'r1.webm', 'kept']]);
  page = await nu.open({ html: '<div>Diary</div>' }, 380, 320, `(${sttInit})()`);
  await speak(page);
  await page.evaluate(() => window.COSMO_NOTE_KIT.relock());
  await page.waitForTimeout(400);
  assert.ok((await savedHtml(page)).includes('r1.webm') && !(await savedHtml(page)).includes('stt-'), 'locking: saved with the chip, without the marker');
  assert.equal(await ed(page), '', 'and hidden');
  // ---- Transcribe: right-click a voice note
  const chip = '<div><span class="voice" contenteditable="false" data-src="stickyfile://att/c1.webm" data-dur="3"><span class="v-play"></span><span class="v-bars"></span><span class="v-time">0:03</span></span>&nbsp;</div><div>after</div>';
  const trMenu = async (pg) => {
    await pg.locator('#editor .voice').dispatchEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 40, clientY: 40 });
    await pg.waitForTimeout(60);
    await pg.evaluate(() => [...window.COSMO_NOTE_KIT.$('#ctx').querySelectorAll('.mi')].find((x) => x.textContent.includes('Transcribe')).click()); // (1.4.18: the menu is in a window of its own)
    await pg.waitForTimeout(150);
  };
  page = await nu.open({ html: chip }, 380, 320, `(${sttInit})()`);
  await trMenu(page);
  const job = await page.evaluate(() => window.__rec.tr.id);
  await sttEv(page, { jobId: job, type: 'progress', pct: 40 });
  assert.ok((await ed(page)).includes('&nbsp;</div><div><span class="stt-pending" contenteditable="false" data-job="' + job + '" data-label="Writing it down… 40%"></span></div><div>after</div>'), 'the marker on the line after the chip, with its progress');
  await page.evaluate(() => window.__rec.tr.r({ text: 'Buy a new charger.' }));
  await page.waitForTimeout(450);
  const span = '<span class="stt-text" data-of="stickyfile://att/c1.webm">Buy a new charger.</span>';
  assert.ok((await ed(page)).includes(`&nbsp;</div><div>${span}</div><div>after</div>`), 'the text in its span, on the line after the chip; the chip stays');
  assert.ok((await page.updates()).pop().html.includes(span), 'saved');
  await page.evaluate(() => document.execCommand('undo'));
  assert.ok(!(await ed(page)).includes('Buy') && !(await ed(page)).includes('stt-pending'), 'one Undo step, and no marker comes back');
  await page.evaluate(() => document.execCommand('redo'));
  // again: asks first; Cancel keeps it, Replace replaces it
  await trMenu(page);
  assert.deepEqual(await page.evaluate(() => [document.getElementById('askPop').hidden, document.getElementById('askTitle').textContent, document.getElementById('askText').textContent, document.getElementById('askYes').textContent]),
    [false, 'Replace the text from last time?', 'Changes you made to it will be lost.', 'Replace'], 'the app\'s pop-up');
  await page.click('#askNo'); await page.waitForTimeout(100);
  assert.equal((await recCalls(page)).filter((c) => c[0] === 'sttTranscribe').length, 1, 'Cancel: nothing happens');
  await trMenu(page);
  await page.click('#askYes'); await page.waitForTimeout(150);
  await page.evaluate(() => window.__rec.tr.r({ text: 'Buy two chargers.' }));
  await page.waitForTimeout(300);
  assert.ok((await ed(page)).includes('<div><span class="stt-text" data-of="stickyfile://att/c1.webm">Buy two chargers.</span></div><div>after</div>') && !(await ed(page)).includes('new charger'), 'replaced');
  await page.evaluate(() => document.execCommand('undo'));
  assert.ok((await ed(page)).includes(span), 'Undo gives the old words back');
  // locking while it runs: nothing is added, the chip is unchanged
  await trMenu(page); await page.click('#askYes'); await page.waitForTimeout(150);
  await page.evaluate(() => window.COSMO_NOTE_KIT.relock());
  await page.evaluate(() => window.__rec.tr.r({ text: 'too late' }));
  await page.waitForTimeout(300);
  assert.ok(!(await savedHtml(page)).includes('too late') && !(await savedHtml(page)).includes('stt-pending'), 'locked: nothing added');
  assert.ok((await recCalls(page)).some((c) => c[0] === 'sttCancel'), 'main is told');
  // pasting: the stt-* classes (and the marker's attributes) don't come along
  page = await nu.open({ html: '<p>x</p>' }, 380, 320, `(${sttInit})()`);
  await caretEnd(page);
  await page.evaluate(() => {
    const dt = new DataTransfer();
    dt.setData('text/html', '<span class="stt-text" data-of="stickyfile://att/c1.webm">pasted</span><span class="stt-pending" data-job="J" data-label="Finishing…"></span>');
    dt.setData('text/plain', 'pasted');
    document.getElementById('editor').dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
  });
  assert.ok((await ed(page)).includes('pasted') && !/stt-|data-of|data-job/.test(await ed(page)), 'pasted text comes in plain');

  // copy / cut / paste: checklist lines and their formatting come back as they were
  const LIST = '<ul class="checklist"><li class="done"><font face="Nunito" color="#d93b3b" size="5">Buy milk</font></li>'
    + '<li><b>Call</b> <span style="background-color: rgb(255, 231, 76);">mum</span></li></ul><p>Plain line</p><p><br></p>';
  // select [from, to] (each [selector, index, letter]), Copy (or Cut), put the caret at `at` (null = the empty last line), paste
  const clip = (pg, from, to, at, how = {}) => pg.evaluate(([from, to, at, how]) => {
    const edi = document.getElementById('editor'); edi.focus();
    const spot = ([q, i, o]) => { const tw = document.createTreeWalker(edi.querySelectorAll(q)[i], NodeFilter.SHOW_TEXT); let t = tw.nextNode(); while (t && o > t.data.length) { o -= t.data.length; t = tw.nextNode(); } return [t, o]; };
    const pick = (a, b) => { const r = document.createRange(); r.setStart(...a); r.setEnd(...b); getSelection().removeAllRanges(); getSelection().addRange(r); };
    pick(spot(from), spot(to));
    const dt = new DataTransfer();
    edi.dispatchEvent(new ClipboardEvent(how.cut ? 'cut' : 'copy', { clipboardData: dt, bubbles: true, cancelable: true }));
    const copied = { plain: dt.getData('text/plain'), html: dt.getData('text/html') };
    if (how.html) dt.setData('application/x-cosmonotes', JSON.stringify({ html: how.html, font: 'hand' }));
    const c = at ? spot(at) : [[...edi.querySelectorAll('p')].pop(), 0];
    pick(c, c);
    if (how.plain) edi.dispatchEvent(new KeyboardEvent('keydown', { key: 'V', ctrlKey: true, shiftKey: true, bubbles: true }));
    if (how.into) { window.__dt = dt; return copied; }
    edi.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
    return copied;
  }, [from, to, at, how]);
  const lines = (pg) => pg.evaluate(() => document.getElementById('editor').innerHTML.replace(/ style="--cb[^"]*"/g, ''));
  page = await nu.open({ html: LIST });
  // part of one ticked line → the empty line: a ticked box with the same font, colour and size
  let got = await clip(page, ['li', 0, 0], ['li', 0, 3], null);
  assert.equal(got.plain, 'Buy');
  assert.ok((await lines(page)).endsWith('<p>Plain line</p><ul class="checklist"><li class="done"><font face="Nunito" color="#d93b3b" size="5">Buy</font></li></ul>'), 'part of a line pastes as a checklist line: ' + await lines(page));
  // two lines → bold and the highlight come too, the second box stays unticked
  page = await nu.open({ html: LIST });
  await clip(page, ['li', 0, 0], ['li', 1, 8], null);
  assert.ok((await lines(page)).endsWith('<ul class="checklist"><li class="done"><font face="Nunito" color="#d93b3b" size="5">Buy milk</font></li><li><b>Call</b> <span style="background-color: rgb(255, 231, 76)">mum</span></li></ul>'), 'two lines: ' + await lines(page));
  // onto the end of a checklist line → a new line in the same list
  page = await nu.open({ html: LIST });
  await clip(page, ['li', 0, 0], ['li', 0, 8], ['li', 1, 8]);
  assert.equal(await page.evaluate(() => document.querySelectorAll('#editor ul.checklist').length), 1, 'same list');
  assert.equal(await page.evaluate(() => [...document.querySelectorAll('#editor li')].map((l) => l.className + ':' + l.textContent).join('|')), 'done:Buy milk|:Call mum|done:Buy milk');
  // Ctrl+Shift+V: plain text, as before
  page = await nu.open({ html: LIST });
  await clip(page, ['li', 0, 0], ['li', 0, 8], null, { plain: true });
  assert.ok((await lines(page)).endsWith('<p>Plain line</p><p>Buy milk</p>'), 'Ctrl+Shift+V pastes plain text: ' + await lines(page));
  // Cut takes the words away (and pastes back the same)
  page = await nu.open({ html: LIST });
  await clip(page, ['li', 1, 0], ['li', 1, 8], null, { cut: true, into: true });
  assert.equal(await page.evaluate(() => document.querySelectorAll('#editor li')[1].textContent), '', 'Cut removes the words');
  // into a note with another font: the words keep the first note's font (Caveat), their own fonts stay as they are
  const from = await nu.open({ html: LIST, font: 'hand' });
  got = await clip(from, ['li', 0, 0], ['li', 1, 8], ['p', 0, 0], { into: true });
  const dtJson = await from.evaluate(() => window.__dt.getData('application/x-cosmonotes'));
  page = await nu.open({ html: '<p><br></p>', font: 'round' });
  await page.evaluate((j) => {
    const edi = document.getElementById('editor'); edi.focus();
    const r = document.createRange(); r.setStart(edi.querySelector('p'), 0); getSelection().removeAllRanges(); getSelection().addRange(r);
    const dt = new DataTransfer(); dt.setData('text/plain', 'x'); dt.setData('application/x-cosmonotes', j);
    edi.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
  }, dtJson);
  assert.ok((await lines(page)).includes('<font face="Nunito" color="#d93b3b" size="5">Buy milk</font>') && (await lines(page)).includes('<b><font face="Caveat">Call</font></b>'), 'note font goes along: ' + await lines(page));
  assert.ok(got.html.includes('<font face="Caveat">mum</font>'), 'other apps get the font too');
  // anything else in the copied HTML is cleaned out
  page = await nu.open({ html: LIST });
  await clip(page, ['li', 0, 0], ['li', 0, 3], null, { html: '<ul class="checklist evil" onclick="x()"><li class="done stt-pending" style="--cb-s: 9px"><font face="Evil" color="red;background:url(x)" size="9" onmouseover="x()">A</font>'
    + '<span style="background-image: url(http://x); color: #123456">B</span><img src="x" onerror="x()"><script>x()</script></li></ul>' });
  assert.ok((await lines(page)).endsWith('<ul class="checklist"><li class="done">A<span style="color: rgb(18, 52, 86)">B</span></li></ul>'), 'cleaned: ' + await lines(page));
  // another app's list pasted into a checklist line (1.4.4: a chat's list, with a paragraph and wrappers around it, went
  // inside the line as a list of its own, boxes inside a box): each line joins the checklist, at that level; one Undo
  const pasteInto = async (html, at) => {
    const pg = await nu.open({ html: '<ul class="checklist"><li>first</li><li>second</li></ul>' });
    await pg.evaluate(([h, a]) => {
      const edi = document.getElementById('editor'); edi.focus();
      const r = document.createRange(); r.setStart(edi.querySelector('li').firstChild, a); getSelection().removeAllRanges(); getSelection().addRange(r);
      const dt = new DataTransfer(); dt.setData('text/html', h); dt.setData('text/plain', 'x');
      edi.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
    }, [html, at]);
    return pg;
  };
  const items = (pg) => pg.evaluate(() => document.getElementById('editor').innerHTML.replace(/ style="[^"]*"/g, ''));
  page = await pasteInto('<meta charset="utf-8"><div class="msg"><p>Ideas:</p>\n<ol class="list-decimal">\n<li><p><strong>Reminders</strong>: soon</p><ul><li>on +Add</li></ul></li>\n<li><p>Apps</p></li></ol></div>', 5);
  assert.equal(await items(page), '<ul class="checklist"><li>first</li><li>Ideas:</li><li><strong>Reminders</strong>: soon</li><li>on +Add</li><li>Apps</li><li>second</li></ul>', 'lines of the checklist, no list inside a line');
  await page.evaluate(() => document.execCommand('undo'));
  assert.equal(await items(page), '<ul class="checklist"><li>first</li><li>second</li></ul>', 'one Undo takes it back');
  page = await pasteInto('<div><p>just <b>this</b></p></div>', 5);
  assert.equal(await items(page), '<ul class="checklist"><li>firstjust <b>this</b></li><li>second</li></ul>', 'one line pastes into the line');
  // a pasted photo is one Undo step, in its place among the typing (1.3.31: Ctrl+Z couldn't take it back), and Redo
  // goes back the same way; the text it was put into is one text again after Undo
  page = await nu.open({ html: '<p>abc def</p>' }, 360, 320, () => { const s = window.sticky; window.sticky = new Proxy(s, { get: (t, k) => (k === 'saveAttachment' ? () => Promise.resolve('stickyfile://att/p1.png') : t[k]) }); });
  await page.click('#editor p'); await page.keyboard.press('End'); await page.keyboard.type(' ghi');
  await page.evaluate(() => {
    const t = document.querySelector('#editor p').firstChild; const r = document.createRange(); r.setStart(t, 3); r.collapse(true); getSelection().removeAllRanges(); getSelection().addRange(r);
    const dt = new DataTransfer(); dt.items.add(new File([new Uint8Array([137, 80, 78, 71])], 'a.png', { type: 'image/png' }));
    document.getElementById('editor').dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
  });
  await page.waitForTimeout(100);
  const shown = async (pg) => (await lines(pg)).replace(/ class="att-img[^"]*"/, '');
  assert.equal(await shown(page), '<p>abc<img src="stickyfile://att/p1.png"> def ghi</p>', 'the photo is in');
  await page.keyboard.type('X');
  const key = async (k) => { await page.keyboard.press(k); await page.waitForTimeout(40); return shown(page); };
  assert.ok(!/X/.test(await key('Control+z')) && /img/.test(await shown(page)), 'Undo: the typing first');
  assert.equal(await key('Control+z'), '<p>abc def ghi</p>', 'Undo: then the photo');
  assert.equal(await page.evaluate(() => document.querySelector('#editor p').childNodes.length), 1, 'one text again');
  assert.equal(await key('Control+z'), '<p>abc def</p>', 'Undo: then the typing before it');
  assert.equal(await key('Control+y'), '<p>abc def ghi</p>', 'Redo in the same order');
  assert.equal(await key('Control+y'), '<p>abc<img src="stickyfile://att/p1.png"> def ghi</p>', 'Redo: the photo');
  assert.ok(/X/.test(await key('Control+y')), 'Redo: the typing after it');
  // every change the note makes itself is one Undo step, and Redo does it again (1.3.32: none of these could be undone;
  // a web address turned into a link broke the text on Undo)
  // (attributes sorted: Undo may put one back at the end, which is the same HTML)
  const plain = (pg) => pg.evaluate(() => { const c = document.getElementById('editor').cloneNode(true); for (const el of c.querySelectorAll('*')) { const at = [...el.attributes].map((x) => [x.name, x.value]).sort(); at.forEach(([k]) => el.removeAttribute(k)); at.forEach(([k, v]) => el.setAttribute(k, v)); } return c.innerHTML; }).then((h) => h.replace(/ style="[^"]*"/g, '').replace(/ ?\b(sel-img|caret-near)\b/g, '').replace(/ class=""/g, ''));
  const ctxRun = async (pg, sel, label) => {
    await pg.locator(sel).first().dispatchEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 40, clientY: 40 });
    await pg.waitForTimeout(50);
    assert.ok(await pg.evaluate((l) => { const b = [...window.COSMO_NOTE_KIT.$('#ctx').querySelectorAll('button')].find((x) => x.textContent.includes(l)); if (b) b.click(); return !!b; }, label), 'menu item ' + label);
    await pg.waitForTimeout(80);
  };
  const PIC = '<p>a<img class="att-img" src="stickyfile://att/p.png" width="200" height="100">b</p>';
  const CHIP = '<p>x<span class="voice" contenteditable="false" data-src="stickyfile://att/r.webm" data-dur="3"><span class="v-play"></span><span class="v-bars"></span><span class="v-time">0:03</span></span>&nbsp;y</p>';
  const LINK = '<p>go <a href="https://x.com">here</a> now</p>';
  const TAB = '<table><tbody><tr><td>1</td><td>2</td></tr><tr><td>3</td><td>4</td></tr></tbody></table><p>z</p>';
  const LPIC = '<p>a<a href="https://cats.com"><img class="att-img" src="stickyfile://att/p.png" width="200" height="100"></a>b</p>';
  const own = [
    ['Remove photo', PIC, (pg) => ctxRun(pg, '#editor img', 'Remove photo')],
    ['Small', PIC, (pg) => ctxRun(pg, '#editor img', 'Small')],
    ['Full width', PIC, (pg) => ctxRun(pg, '#editor img', 'Full width')],
    ['Keep size', PIC, (pg) => ctxRun(pg, '#editor img', 'Keep size')],
    ['description', PIC, async (pg) => { await ctxRun(pg, '#editor img', 'description'); await pg.fill('#descText', 'cat'); await pg.press('#descText', 'Enter'); await pg.waitForTimeout(50); }],
    ['dragging a photo\'s size', PIC, async (pg) => {
      await pg.click('#editor img'); await pg.waitForTimeout(80);
      const h = await pg.locator('#imgHandle').boundingBox();
      await pg.mouse.move(h.x + 3, h.y + 3); await pg.mouse.down(); await pg.mouse.move(h.x - 60, h.y + 3, { steps: 5 }); await pg.mouse.up(); await pg.waitForTimeout(80);
    }],
    ['Remove recording', CHIP, (pg) => ctxRun(pg, '#editor .voice', 'Remove recording')],
    ['Remove link', LINK, (pg) => ctxRun(pg, '#editor a', 'Remove link')],
    ['Edit link', LINK, async (pg) => { await ctxRun(pg, '#editor a', 'Edit link'); await pg.fill('#linkText', 'there'); await pg.press('#linkUrl', 'Enter'); await pg.waitForTimeout(50); }],
    ...['Add row below', 'Add column right', 'Delete row', 'Delete column', 'Delete table'].map((l) => [l, TAB, (pg) => ctxRun(pg, '#editor td', l)]),
    ['Tab in the last cell', TAB, async (pg) => { await pg.click('#editor td >> nth=3'); await pg.keyboard.press('End'); await pg.keyboard.press('Tab'); await pg.waitForTimeout(50); }],
    // 1.4.11: a link on a picture
    ['a picture\'s Add link', PIC, async (pg) => { await ctxRun(pg, '#editor img', 'Add link'); await pg.fill('#linkUrl', 'cats.com'); await pg.press('#linkUrl', 'Enter'); await pg.waitForTimeout(50); }],
    ['a picture\'s Edit link', LPIC, async (pg) => { await ctxRun(pg, '#editor img', 'Edit link'); await pg.fill('#linkUrl', 'dogs.com'); await pg.press('#linkUrl', 'Enter'); await pg.waitForTimeout(50); }],
    ['a picture\'s Remove link', LPIC, (pg) => ctxRun(pg, '#editor img', 'Remove link')],
    ['Remove photo with a link', LPIC, (pg) => ctxRun(pg, '#editor img', 'Remove photo')],
  ];
  for (const [name, html, act] of own) {
    page = await nu.open({ html }, 420, 360);
    await page.click('#editor');
    const before = await plain(page);
    await act(page);
    const mid = await plain(page);
    assert.notEqual(mid, before, name + ': changes the note');
    await page.keyboard.press('Control+z'); await page.waitForTimeout(80);
    assert.equal(await plain(page), before, name + ': Undo');
    await page.keyboard.press('Control+y'); await page.waitForTimeout(80);
    assert.equal(await plain(page), mid, name + ': Redo');
  }
  // ---- 1.4.11: a link on a picture: <a href><img></a>, the form without "Text to show"; a click opens it (once for a
  // double-click), Shift+click picks the picture; the caret beside it is outside the link; Remove photo takes the link too
  {
    const catchOpen = () => { const old = window.sticky; window.__opened = []; window.sticky = new Proxy({}, { get: (t, k) => (k === 'openExternal' ? (u) => { window.__opened.push(u); return Promise.resolve(); } : old[k]) }); };
    page = await nu.open({ html: PIC }, 420, 360, catchOpen);
    await ctxRun(page, '#editor img', 'Add link');
    assert.ok(await page.isVisible('#linkPop') && !(await page.isVisible('#linkText')), 'the link form, without "Text to show"');
    assert.equal(await page.textContent('#linkTitle'), 'Link this picture');
    await page.fill('#linkUrl', 'cats.com'); await page.press('#linkUrl', 'Enter'); await page.waitForTimeout(60);
    assert.equal(await plain(page), '<p>a<a href="https://cats.com"><img class="att-img" height="100" src="stickyfile://att/p.png" width="200"></a>b</p>', 'the picture is in a link');
    await page.waitForTimeout(450);
    assert.ok((await page.updates()).some((u) => typeof u.html === 'string' && u.html.includes('<a href="https://cats.com"><img')), 'saved');
    await page.locator('#editor img').dispatchEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 40, clientY: 40 });
    await page.waitForTimeout(60);
    assert.deepEqual(await page.evaluate(() => [...window.COSMO_NOTE_KIT.$('#ctx').querySelectorAll('button')].map((x) => x.textContent).filter((t) => /link/i.test(t))), ['Open link', 'Edit link…', 'Copy link address', 'Remove link'], 'its right-click menu');
    await page.keyboard.press('Escape'); await page.mouse.click(5, 300);
    await page.click('#editor img');
    await page.waitForTimeout(60);
    assert.deepEqual(await page.evaluate(() => window.__opened), ['https://cats.com'], 'a click opens the link');
    assert.ok(!(await page.evaluate(() => !!document.querySelector('#editor img.sel-img'))), 'and doesn\'t pick the picture');
    await page.dblclick('#editor img');
    await page.waitForTimeout(60);
    assert.equal((await page.evaluate(() => window.__opened)).length, 2, 'a double-click opens it once (no photo viewer)');
    await page.click('#editor img', { modifiers: ['Shift'] });
    await page.waitForTimeout(60);
    assert.ok(await page.evaluate(() => !!document.querySelector('#editor img.sel-img')), 'Shift+click picks the picture');
    // the caret beside it (a click on the picture's left edge) is before the link: typing stays out of it
    const r = await page.locator('#editor img').boundingBox();
    await page.mouse.click(r.x + 3, r.y + r.height / 2);
    await page.keyboard.type('Z'); await page.waitForTimeout(60);
    assert.match(await plain(page), /^<p>aZ<a href="https:\/\/cats\.com"><img/, 'typed before the link, not in it');
    await page.close();
  }
  // a typed web address becomes a link: Undo takes the typing after it, the link, then the address, each as it was
  page = await nu.open({ html: '<p>see</p>' });
  await page.click('#editor p'); await page.keyboard.press('End'); await page.keyboard.type(' www.example.com and'); await page.waitForTimeout(80);
  const linked = await plain(page);
  assert.equal(linked, '<p>see <a href="https://www.example.com">www.example.com</a>&nbsp;and</p>', 'the address is a link');
  const steps = [];
  for (let i = 0; i < 3; i++) { await page.keyboard.press('Control+z'); await page.waitForTimeout(60); steps.push(await plain(page)); }
  assert.deepEqual(steps, ['<p>see <a href="https://www.example.com">www.example.com</a></p>', '<p>see www.example.com</p>', '<p>see</p>'], 'Undo, step by step');
  for (let i = 0; i < 3; i++) { await page.keyboard.press('Control+y'); await page.waitForTimeout(60); }
  assert.equal(await plain(page), linked, 'Redo: all of it back');

  // checklist boxes: the same size of words gets the same box, in any font; an empty line's box is its words' size
  const boxes = (pg) => pg.evaluate(() => [...document.querySelectorAll('#editor ul.checklist li')].map((li) => ({
    w: Math.round(parseFloat(getComputedStyle(li, '::before').width) * 2) / 2, h: Math.round(li.getBoundingClientRect().height), t: getComputedStyle(li, '::before').top,
    y: Math.round((li.getBoundingClientRect().top + parseFloat(getComputedStyle(li, '::before').top)) * 10) / 10 })));
  const MIX = '<ul class="checklist"><li>own font</li><li><br></li><li><font face="Caveat">hand</font></li><li><font face="Nunito">round</font></li>'
    + '<li><font face="Augusta">medieval</font></li><li><font face="Nunito" size="5">big</font></li><li><font face="Nunito" size="5"><br></font></li></ul>';
  for (const font of ['hand', 'round', 'medieval']) {
    page = await nu.open({ html: MIX, font }, 420, 400);
    await page.waitForTimeout(120);
    const b = await boxes(page);
    assert.ok(b.slice(1, 5).every((x) => x.w === b[0].w), `${font}: one box size for every font and the empty line: ${JSON.stringify(b)}`);
    // 1.4.13 (the owner's wish): static boxes: words in any font, the same box at the same place on its line
    assert.ok(b.slice(1, 5).every((x) => x.t === b[0].t && x.h === b[0].h), `${font}: every font: the same place, the same line: ${JSON.stringify(b)}`);
    assert.equal(b[6].w, b[5].w, `${font}: an empty line's box is the size its words will be`);
    // Backspace empties the big line: its box stays the size the next words will be typed at
    await page.evaluate(() => { const t = [...document.querySelectorAll('#editor li')][5].querySelector('font').firstChild; const r = document.createRange(); r.setStart(t, 3); r.collapse(true); getSelection().removeAllRanges(); getSelection().addRange(r); document.getElementById('editor').focus(); });
    for (let i = 0; i < 3; i++) await page.keyboard.press('Backspace');
    await page.waitForTimeout(120);
    const e = (await boxes(page))[5];
    assert.ok(e.w === b[5].w && e.y === b[5].y, `${font}: emptied by Backspace, the box keeps its size and place: ${JSON.stringify([b[5], e])}`);
    await page.keyboard.type('w'); await page.waitForTimeout(120);
    assert.deepEqual((await boxes(page))[5], b[5], `${font}: the first letter doesn't move the box`);
    // Enter under it: the new line's box is where the typed one will be
    await page.keyboard.press('Enter'); await page.waitForTimeout(120);
    const n1 = (await boxes(page))[6]; await page.keyboard.type('w'); await page.waitForTimeout(120);
    assert.deepEqual((await boxes(page))[6], n1, `${font}: a new line's box doesn't move when the first letter comes`);
  }
  // copying a whole line (as a triple-click picks it: up to the start of the next line) brings no empty line along
  page = await nu.open({ html: LIST });
  got = await page.evaluate(() => {
    const edi = document.getElementById('editor'); edi.focus();
    const lis = edi.querySelectorAll('li'); const r = document.createRange(); r.setStart(lis[0].querySelector('font').firstChild, 0); r.setEnd(lis[1], 0);
    getSelection().removeAllRanges(); getSelection().addRange(r);
    const dt = new DataTransfer(); edi.dispatchEvent(new ClipboardEvent('copy', { clipboardData: dt, bubbles: true, cancelable: true }));
    const c = document.createRange(); c.setStart(lis[1].lastChild.firstChild, 3); getSelection().removeAllRanges(); getSelection().addRange(c);
    edi.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
    return dt.getData('application/x-cosmonotes');
  });
  assert.ok(!/<li><\/li>/.test(got), 'no empty line on the clipboard: ' + got);
  assert.ok((await boxes(page)).every((x) => x.h > 0), 'no line without height after the paste: ' + await lines(page));
  // a note that already has one (made by an older version): the empty line is dropped when it opens, the rest stays
  page = await nu.open({ html: '<ul class="checklist"><li>A</li><li class="done"><font face="Nunito" size="5"></font></li><li>B</li><li><br></li></ul>', font: 'medieval' });
  assert.equal(await lines(page), '<ul class="checklist"><li>A</li><li>B</li><li><br></li></ul>', 'the empty line is gone, nothing else');

  // text size and font on a whole line of words in another font: the size used to land on the font's tag and do nothing
  const pickAll = (pg) => pg.evaluate(() => { const li = document.querySelector('#editor li'); const tw = document.createTreeWalker(li, NodeFilter.SHOW_TEXT); let t, f, l; while ((t = tw.nextNode())) { f = f || t; l = t; } const r = document.createRange(); r.setStart(f, 0); r.setEnd(l, l.data.length); getSelection().removeAllRanges(); getSelection().addRange(r); document.getElementById('editor').focus(); document.dispatchEvent(new Event('selectionchange')); });
  const px = (pg) => pg.evaluate(() => parseFloat(getComputedStyle(document.createTreeWalker(document.querySelector('#editor li'), NodeFilter.SHOW_TEXT).nextNode().parentElement).fontSize));
  const tap = (pg, q) => pg.evaluate((q) => document.querySelector(q).click(), q);
  for (const font of ['hand', 'round', 'medieval']) for (const tag of ['<font face="Nunito">', '<font face="Nunito" size="5">', '<font face="Caveat">', '<font face="Augusta">']) {
    page = await nu.open({ html: `<ul class="checklist"><li>${tag}A whole line</font></li></ul>`, font }, 420, 300);
    const got = {};
    for (const s of ['3', '2', '5']) { await pickAll(page); await tap(page, `#fsizeSeg button[data-fsize="${s}"]`); got[s] = await px(page); }
    assert.ok(Math.abs(got[2] / got[3] - 0.82) < 0.02 && Math.abs(got[5] / got[3] - 1.45) < 0.02, `${font}, ${tag}: Small / Big change the size: ${JSON.stringify(got)}`);
    assert.equal(await page.evaluate(() => getSelection().toString()), 'A whole line', 'the words stay selected');
  }
  // 1.4.2: the size buttons are numbers (0.7 … 1.9); the one of the words at the cursor is lit, and a size picked for what
  // you type next stays lit until the cursor moves
  page = await nu.open({ html: '<p>Hello <font size="5">big</font> world</p>' }, 360, 340);
  const caretAt = (pg, q, i) => pg.evaluate(([q, i]) => { const t = document.querySelector(q).firstChild; const r = document.createRange(); r.setStart(t, i); r.collapse(true); getSelection().removeAllRanges(); getSelection().addRange(r); document.getElementById('editor').focus(); document.dispatchEvent(new Event('selectionchange')); }, [q, i]);
  const lit = (pg) => pg.evaluate(() => [...document.querySelectorAll('#fsizeSeg button.on')].map((b) => b.textContent).join());
  assert.equal(await page.evaluate(() => [...document.querySelectorAll('#fsizeSeg button')].map((b) => b.textContent + '=' + b.dataset.fsize).join()), '0.7=1,0.8=2,1.0=3,1.2=4,1.5=5,1.9=6');
  await caretAt(page, '#editor font', 1); await nu.press(page, '#btnText');
  assert.equal(await lit(page), '1.5', 'in the big word: 1.5');
  await caretAt(page, '#editor p', 2);
  assert.equal(await lit(page), '1.0', 'in plain words: 1.0');
  await nu.press(page, '#fsizeSeg [data-fsize="2"]');
  assert.equal(await lit(page), '0.8', 'picked for what you type next: lit');
  await page.keyboard.type('xy'); await page.waitForTimeout(60);
  assert.ok(/<font size="2">xy<\/font>/.test(await page.evaluate(() => document.getElementById('editor').innerHTML)), 'and the typing is 0.8');
  assert.equal(await lit(page), '0.8', 'still lit while typing it');
  await caretAt(page, '#editor font[size="5"]', 1);
  assert.equal(await lit(page), '1.5', 'the cursor moved: the size there');
  for (const font of ['hand', 'round', 'medieval']) {
    page = await nu.open({ html: '<ul class="checklist"><li><font size="5">Big words</font></li></ul>', font }, 420, 300);
    const big = await px(page); const box = await page.evaluate(() => getComputedStyle(document.querySelector('#editor li'), '::before').width);
    const other = { hand: 'round', round: 'medieval', medieval: 'hand' }[font];
    await pickAll(page); await tap(page, `#fontSeg button[data-font="${other}"]`); await page.waitForTimeout(60);
    assert.ok(Math.abs(await px(page) - big) < 0.05, `${font} → ${other}: Big words keep their size in the other font`);
    assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('#editor li'), '::before').width), box, 'and the box keeps its size');
  }
  // the CSS: size and font on one tag both count; no font changes a size or a line's height (1.4.12)
  const ownLook = {};
  for (const font of ['hand', 'round', 'medieval']) {
    const other = { hand: 'Nunito', round: 'Augusta', medieval: 'Caveat' }[font]; const own = { hand: 'Caveat', round: 'Nunito', medieval: 'Augusta' }[font];
    page = await nu.open({ html: `<p><font face="${other}">a</font></p><p><font face="${other}" size="5">a</font></p><p><font face="${other}"><font face="${other}">a</font></font></p>`
      + `<p><font face="${other}"><font size="5">a</font></font></p><p>a</p><p><font face="${other}"><font face="${own}">a</font></font></p>`, font }, 420, 400);
    const fs = await page.evaluate(() => [...document.querySelectorAll('#editor p')].map((p) => parseFloat(getComputedStyle(document.createTreeWalker(p, NodeFilter.SHOW_TEXT).nextNode().parentElement).fontSize)));
    assert.ok(Math.abs(fs[1] / fs[0] - 1.45) < 0.01 && Math.abs(fs[3] - fs[1]) < 0.05, `${font}: size and font on one tag = on two tags: ${fs}`);
    assert.ok(Math.abs(fs[2] - fs[0]) < 0.05, `${font}: a font inside the same font isn't resized twice: ${fs}`);
    assert.ok(Math.abs(fs[5] - fs[4]) < 0.05, `${font}: the note's font inside another is the note's size: ${fs}`);
    assert.ok(Math.abs(fs[0] - fs[4]) < 0.05, `${font}: words in another font are the note's size: ${fs}`);
    const look = await page.evaluate(() => { const p = [...document.querySelectorAll('#editor p')]; return { h: p.map((x) => x.getBoundingClientRect().height), fs: getComputedStyle(document.getElementById('editor')).fontSize }; });
    assert.ok([0, 2, 5].every((i) => Math.abs(look.h[i] - look.h[4]) < 0.05), `${font}: words in another font leave their line's height as it is: ${look.h}`);
    ownLook[font] = { fs: look.fs, h: look.h[4] };
  }
  assert.ok(Object.values(ownLook).every((x) => x.fs === ownLook.round.fs && x.h === ownLook.round.h), 'every note font: the same text size and line height (the owner, 1.4.12) ' + JSON.stringify(ownLook));
  for (const font of ['hand', 'round', 'medieval']) {
    page = await nu.open({ html: '<ul class="checklist"><li>Milk</li></ul>', font }, 420, 300);
    ownLook[font].box = await page.evaluate(() => getComputedStyle(document.querySelector('#editor li'), '::before').width);
  }
  assert.ok(Object.values(ownLook).every((x) => x.box === ownLook.round.box), 'every note font: the same box ' + JSON.stringify(ownLook));
  // pasted from a Rounded note into a Medieval one: Big Rounded words stay Big (as they were)
  page = await nu.open({ html: '<p><br></p>', font: 'medieval' });
  await page.evaluate(() => {
    const edi = document.getElementById('editor'); edi.focus(); const r = document.createRange(); r.setStart(edi.querySelector('p'), 0); getSelection().removeAllRanges(); getSelection().addRange(r);
    const dt = new DataTransfer(); dt.setData('text/plain', 'x'); dt.setData('application/x-cosmonotes', JSON.stringify({ font: 'round', html: '<p><font face="Nunito" size="5">Big</font> <font face="Nunito">plain</font></p>' }));
    edi.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
  });
  assert.ok(Math.abs(await page.evaluate(() => { const f = document.querySelectorAll('#editor p font'); return parseFloat(getComputedStyle(f[0]).fontSize) / parseFloat(getComputedStyle(f[1]).fontSize); }) - 1.45) < 0.01, 'pasted Big words stay Big: ' + await lines(page));

  // ---- checklists (1.3.19): click a box to tick it, drag a box to move its line, ticked lines to the bottom, boxes of one size;
  // each one as in Settings or the note's own (⋯ menu); ticking and moving are Undo / Redo steps
  {
    const CL = '<ul class="checklist"><li>Milk</li><li><font size="6">Big eggs</font></li><li>Bread</li><li>Tea</li></ul>';
    const items = (pg) => pg.evaluate(() => [...document.querySelectorAll('#editor li')].map((l) => (l.classList.contains('done') ? 'x ' : '') + l.firstChild.textContent).join(', '));
    const boxOf = (pg, name) => pg.evaluate((name) => { const li = [...document.querySelectorAll('#editor li')].find((l) => l.firstChild.textContent === name); const r = li.getBoundingClientRect(); return { x: r.left + 6, y: r.top + 10, top: r.top, bottom: r.bottom }; }, name);
    const drag = async (pg, from, y, opts = {}) => { await pg.mouse.move(from.x, from.y); await pg.mouse.down(); await pg.mouse.move(from.x, from.y - 6, { steps: 2 }); await pg.mouse.move(opts.x || from.x, y, { steps: 6 }); if (opts.esc) await pg.keyboard.press('Escape'); await pg.mouse.up(); await pg.waitForTimeout(300); };
    const savedHtml = async (pg) => { const u = (await pg.updates()).filter((x) => 'html' in x); return u.length ? u[u.length - 1].html : null; };
    // Settings as they come: drag on, the others off. A click ticks (on release), and the line stays where it is
    page = await nu.open({ html: CL, settings: { appTheme: 'cream', checkDrag: true, checkSink: false, checkFixed: false } });
    let bx = await boxOf(page, 'Milk');
    await page.mouse.click(bx.x, bx.y); await page.waitForTimeout(450);
    assert.equal(await items(page), 'x Milk, Big eggs, Bread, Tea', 'a click ticks it, in its place');
    assert.ok(/<li class="done">Milk<\/li>/.test(await savedHtml(page)), 'and it is saved');
    // drag Tea above Big eggs: a bar shows where it goes, the line moves there
    bx = await boxOf(page, 'Tea'); const big = await boxOf(page, 'Big eggs');
    await page.mouse.move(bx.x, bx.y); await page.mouse.down(); await page.mouse.move(bx.x, big.top + 3, { steps: 6 });
    assert.ok(await page.evaluate(() => { const m = document.getElementById('cbDrop'); return !!m && !m.hidden && document.body.classList.contains('cb-dragging'); }), 'a bar shows where it goes');
    await page.mouse.up(); await page.waitForTimeout(450);
    assert.equal(await items(page), 'x Milk, Tea, Big eggs, Bread', 'the dragged line moved');
    assert.ok(await page.evaluate(() => document.getElementById('cbDrop').hidden && !document.body.classList.contains('cb-dragging') && !document.querySelector('.cb-moving')), 'the bar and the faint line are gone');
    assert.ok(!/cb-moving/.test(await savedHtml(page)), 'saved, without the dragging look');
    // Esc while dragging: nothing moves
    bx = await boxOf(page, 'Bread');
    await drag(page, bx, (await boxOf(page, 'Milk')).top + 2, { esc: true });
    assert.equal(await items(page), 'x Milk, Tea, Big eggs, Bread', 'Esc: nothing moved');
    // Undo / Redo: the move, then the tick (the editor's own undo comes after)
    await page.keyboard.press('Control+z'); await page.waitForTimeout(300);
    assert.equal(await items(page), 'x Milk, Big eggs, Bread, Tea', 'Undo puts the line back');
    await page.keyboard.press('Control+z'); await page.waitForTimeout(300);
    assert.equal(await items(page), 'Milk, Big eggs, Bread, Tea', 'Undo again unticks');
    await page.keyboard.press('Control+y'); await page.keyboard.press('Control+y'); await page.waitForTimeout(300);
    assert.equal(await items(page), 'x Milk, Tea, Big eggs, Bread', 'Redo does both again');
    // a line nested in a line moves out of it; the list it leaves empty goes too (and comes back with Undo)
    page = await nu.open({ html: '<ul class="checklist"><li>A<ul><li>a1</li></ul></li><li>B</li></ul>', settings: { appTheme: 'cream', checkDrag: true } });
    const B = await boxOf(page, 'B');
    const a1 = await boxOf(page, 'a1');
    await page.mouse.click(B.x - 0, a1.y); await page.waitForTimeout(300); // left of a1, under A's box
    assert.equal(await items(page), 'A, a1, B', 'a click beside the nested line ticks nothing');
    await drag(page, a1, B.bottom + 2, { x: B.x });
    assert.equal(await lines(page), '<ul class="checklist"><li>A</li><li>B</li><li class="">a1</li></ul>', 'out of its line, the empty list gone');
    await page.keyboard.press('Control+z'); await page.waitForTimeout(300);
    assert.equal((await lines(page)).replace(' class=""', ''), '<ul class="checklist"><li>A<ul><li>a1</li></ul></li><li>B</li></ul>', 'Undo: back in its line');
    // only the box itself ticks (1.3.38): not the strip under it beside a long line's other rows, nor the gap before the words
    page = await nu.open({ html: '<ul class="checklist"><li>' + LONG + '</li><li>B</li></ul>', settings: { appTheme: 'cream', checkDrag: true } }, 260);
    const cb = await page.evaluate(() => { const li = document.querySelector('#editor li'); const r = li.getBoundingClientRect(); const b = getComputedStyle(li, '::before');
      return { x: r.left + parseFloat(b.left), y: r.top + parseFloat(b.top), w: parseFloat(b.width), h: parseFloat(b.height), bottom: r.bottom }; });
    assert.ok(cb.bottom - cb.y > cb.h * 3, `the line wraps: ${JSON.stringify(cb)}`);
    for (const [x, y, where] of [[cb.x + cb.w / 2, cb.y + cb.h + 6, 'under the box'], [cb.x + cb.w / 2, cb.bottom - 4, 'beside the last row'], [cb.x + cb.w + 2, cb.y + cb.h / 2, 'between the box and the words']]) {
      await page.mouse.click(x, y); await page.waitForTimeout(300);
      assert.equal((await items(page)).startsWith('x '), false, `a click ${where} ticks nothing`);
    }
    await page.mouse.click(cb.x + 1, cb.y + 1); await page.waitForTimeout(300);
    assert.ok((await items(page)).startsWith('x '), 'a click on the box\'s corner ticks it');
    // ticked lines to the bottom (Settings): a ticked line goes below the unticked ones; unticked, it stays where it is
    page = await nu.open({ html: CL, settings: { appTheme: 'cream', checkDrag: true, checkSink: true } });
    for (const n of ['Milk', 'Bread']) { bx = await boxOf(page, n); await page.mouse.click(bx.x, bx.y); await page.waitForTimeout(300); }
    assert.equal(await items(page), 'Big eggs, Tea, x Bread, x Milk', 'ticked lines go to the bottom (the newest first)');
    bx = await boxOf(page, 'Milk'); await page.mouse.click(bx.x, bx.y); await page.waitForTimeout(300);
    assert.equal(await items(page), 'Big eggs, Tea, x Bread, Milk', 'unticked, it stays where it is (only ticking moves a line)');
    await page.keyboard.press('Control+z'); await page.waitForTimeout(300);
    assert.equal(await items(page), 'Big eggs, Tea, x Bread, x Milk', 'Undo: ticked and where it was');
    // a tick stays one Undo step after typing (1.3.31: typing used to forget it): Undo takes the typing back, then the tick
    bx = await boxOf(page, 'Tea'); await page.mouse.click(bx.x, bx.y); await page.waitForTimeout(300);
    await page.evaluate(() => { document.getElementById('editor').focus(); let t = document.querySelector('#editor li'); while (t.lastChild) t = t.lastChild; const r = document.createRange(); r.setStart(t, t.length); r.collapse(true); getSelection().removeAllRanges(); getSelection().addRange(r); });
    await page.keyboard.type('!'); await page.waitForTimeout(50);
    assert.equal(await items(page), 'Big eggs!, x Tea, x Bread, x Milk', 'ticked, then typed');
    await page.keyboard.press('Control+z'); await page.waitForTimeout(300);
    assert.equal(await items(page), 'Big eggs, x Tea, x Bread, x Milk', 'Undo: the typing');
    await page.keyboard.press('Control+z'); await page.waitForTimeout(300);
    assert.equal(await items(page), 'Big eggs, Tea, x Bread, x Milk', 'Undo: then the tick');
    // turning it on in the note's Checklists pop-up (1.3.24) tidies every list on its own: a nested list, a list after
    // other text, a list with only ticked lines; one Undo step puts them back
    page = await nu.open({ html: '<ul class="checklist"><li class="done">A</li><li>B<ul><li class="done">b1</li><li>b2</li></ul></li><li class="done">C</li><li>D</li></ul><p>Other</p><ul class="checklist"><li class="done">E</li><li>F</li></ul><ul class="checklist"><li class="done">G</li></ul>', settings: { appTheme: 'cream', checkDrag: true, checkSink: false } });
    await page.click('#btnMenu'); await page.click('#miChecks');
    await page.click('label:has(#ckSink)'); await page.waitForTimeout(450);
    assert.equal(await items(page), 'B, b2, x b1, D, x A, x C, F, x E, x G', 'each list: its ticked lines below, in their order');
    assert.ok(/<li>D<\/li><li class="done">A<\/li><li class="done">C<\/li><\/ul><p>Other<\/p>/.test(await savedHtml(page)), 'saved, the lists still apart');
    await page.keyboard.press('Control+z'); await page.waitForTimeout(300);
    assert.equal(await items(page), 'x A, B, x b1, b2, x C, D, x E, F, x G', 'Undo puts them back');
    await page.click('label:has(#ckSink)'); await page.click('label:has(#ckSink)'); await page.waitForTimeout(450);
    assert.equal(await items(page), 'B, b2, x b1, D, x A, x C, F, x E, x G', 'off and on again: tidied again');
    const saves = (await page.updates()).filter((x) => 'html' in x).length;
    await page.click('label:has(#ckSink)'); await page.click('label:has(#ckSink)'); await page.waitForTimeout(450);
    assert.equal((await page.updates()).filter((x) => 'html' in x).length, saves, 'nothing out of place: the note is not changed');
    // two lists that touch (1.3.25: the empty line between them deleted) are one group: the tidy-up and ticking treat
    // them as one list, the note is saved with one list, and the editor's own Undo still brings the empty line back
    const groups = (pg) => pg.evaluate(() => [...document.getElementById('editor').children].map((c) => c.nodeName === 'UL' ? [...c.querySelectorAll('li')].map((l) => (l.classList.contains('done') ? 'x ' : '') + l.textContent).join(', ') : c.nodeName).join(' | '));
    const GAP = '<ul class="checklist"><li>A</li><li class="done">B</li></ul><p><br></p><ul class="checklist"><li>C</li><li class="done">D</li></ul>';
    const dropGap = async (pg) => { await pg.evaluate(() => { const e = document.getElementById('editor'); e.focus(); const r = document.createRange(); r.setStart(e.querySelector('p'), 0); getSelection().removeAllRanges(); getSelection().addRange(r); }); await pg.keyboard.press('Backspace'); await pg.waitForTimeout(700); };
    page = await nu.open({ html: GAP, settings: { appTheme: 'cream', checkDrag: true, checkSink: true } });
    await dropGap(page);
    assert.equal(await savedHtml(page), '<ul class="checklist"><li>A</li><li class="done">B</li><li>C</li><li class="done">D</li></ul>', 'saved as one list');
    await page.click('#btnMenu'); await page.click('#miChecks');
    await page.click('label:has(#ckSink)'); await page.click('label:has(#ckSink)'); await page.waitForTimeout(450);
    assert.equal((await groups(page)).replace(' | ', ', '), 'A, C, x B, x D', 'off and on: tidied as one list');
    await page.keyboard.press('Control+z'); await page.waitForTimeout(300);
    await page.keyboard.press('Control+z'); await page.waitForTimeout(300);
    assert.equal(await groups(page), 'A, x B | P | C, x D', 'Undo, Undo: the tidy-up, then the empty line is back');
    page = await nu.open({ html: GAP, settings: { appTheme: 'cream', checkDrag: true, checkSink: true } });
    await dropGap(page);
    bx = await boxOf(page, 'A'); await page.mouse.click(bx.x, bx.y); await page.waitForTimeout(400);
    assert.equal((await groups(page)).replace(' | ', ', '), 'x B, C, x A, x D', 'a ticked line goes right below the last unticked one of both');
    // Redo goes back in the order Undo went (1.3.25): the editor's own steps first, then ours (the tick)
    for (let i = 0; i < 2; i++) { await nu.press(page, '#btnUndo'); await page.waitForTimeout(200); }
    assert.equal(await groups(page), 'A, x B | P | C, x D', 'Undo: the tick, then the empty line');
    await nu.press(page, '#btnRedo'); await page.waitForTimeout(200);
    assert.equal(await groups(page), 'A, x B | C, x D', 'Redo: first the deleted line (it came last)');
    await nu.press(page, '#btnRedo'); await page.waitForTimeout(200);
    assert.equal((await groups(page)).replace(' | ', ', '), 'x B, C, x A, x D', 'then the tick');
    // a note saved with two lists that touch opens with one
    page = await nu.open({ html: '<ul class="checklist"><li>A</li></ul><ul class="checklist"><li>C</li></ul><ul><li>dot</li></ul>', settings: { appTheme: 'cream' } });
    assert.equal(await groups(page), 'A, C | dot', 'opens as one list (a bullet list stays apart)');
    // an empty block between them (1.3.26: a <div></div> the editor left, a 1 px line no one can see) doesn't keep them
    // apart: the note opens with one list, and while open (the block put back) they are still one group
    page = await nu.open({ html: '<ul class="checklist"><li class="done">A</li><li>B</li></ul><div></div><ul class="checklist"><li>C</li></ul><p><br></p><ul class="checklist"><li>D</li></ul>', checklist: { drag: null, sink: false, fixed: null }, settings: { appTheme: 'cream', checkDrag: true } });
    assert.equal(await groups(page), 'x A, B, C | P | D', 'opens as one list; a real empty line still keeps lists apart');
    await page.evaluate(() => { const ul = document.querySelector('#editor ul'); const d = document.createElement('div'); const u2 = document.createElement('ul'); u2.className = 'checklist'; u2.append(ul.lastElementChild); ul.after(d, u2); });
    await page.click('#btnMenu'); await page.click('#miChecks'); await page.click('label:has(#ckSink)'); await page.waitForTimeout(450);
    assert.equal(await groups(page), 'B | DIV | C, x A | P | D', 'an empty block between: tidied as one group (A goes below C, in the other list)');
    // drag off (this note): a click ticks at once, a drag moves nothing
    page = await nu.open({ html: CL, checklist: { drag: false, sink: null, fixed: null }, settings: { appTheme: 'cream', checkDrag: true } });
    bx = await boxOf(page, 'Tea'); await drag(page, bx, (await boxOf(page, 'Milk')).top + 2);
    assert.equal(await items(page), 'Milk, Big eggs, Bread, x Tea', 'drag off: the press ticks it, nothing moves');
    // 1.4.21: a ticked line is struck through by each run of its words in its own size (the highlight cn-done), not by a
    // text-decoration on the line (drawn at the line's size: near the top of big words); ticking and unticking move it
    const struck = (pg) => pg.evaluate(() => { const h = CSS.highlights.get('cn-done'); return h ? [...h].map((r) => r.toString().replace(/\s+/g, ' ')).join(' | ') : ''; });
    page = await nu.open({ html: '<ul class="checklist"><li class="done">a <font size="7">Big</font> b<ul><li class="done">inner</li></ul></li><li>Bread</li></ul>', settings: { appTheme: 'cream', checkDrag: false } });
    assert.equal(await struck(page), 'a Big binner', 'the ticked line\'s words are struck through, its lines inside with it (once)');
    assert.deepEqual(await page.evaluate(() => [...document.querySelectorAll('#editor li')].map((l) => getComputedStyle(l).textDecorationLine)), ['none', 'none', 'none'], '(never as a line\'s text-decoration)');
    // 1.4.23: through the middle of the small letters: half an ex of each run's own font above the baseline (the font's own
    // line-through was above the middle in Nunito)
    const mid = await page.evaluate(() => [...document.querySelectorAll('#editor li.done, #editor li.done font')].map((el) => {
      const h = getComputedStyle(el, '::highlight(cn-done)'); const probe = document.createElement('span'); probe.style.cssText = 'display:inline-block;width:1ex'; el.append(probe);
      const ex = probe.getBoundingClientRect().width; probe.remove();
      return [h.textDecorationLine, h.textDecorationSkipInk, Math.abs(parseFloat(h.textUnderlineOffset) + ex / 2 + 0.75) < 0.6];
    }));
    assert.ok(mid.length === 3 && mid.every(([l, skip, ok]) => l === 'underline' && skip === 'none' && ok), `the strike: in the middle of each run's small letters (${JSON.stringify(mid)})`);
    bx = await boxOf(page, 'Bread'); await page.mouse.click(bx.x, bx.y); await page.waitForTimeout(150);
    assert.equal(await struck(page), 'a Big binner | Bread', 'ticked: struck through');
    await page.evaluate(() => document.querySelector('#editor li').classList.remove('done')); await page.waitForTimeout(80);
    assert.equal(await struck(page), 'inner | Bread', 'a tick taken off any way: no strike there');
    assert.ok(!/cn-done|highlight/.test(await page.evaluate(() => document.getElementById('editor').innerHTML)), 'nothing of it in the note');
    // boxes of one size: Big words get the note's own box, still beside them; the ⋯ menu's switch shows and changes it
    const sizes = (pg) => pg.evaluate(() => [...document.querySelectorAll('#editor li')].map((l) => parseFloat(getComputedStyle(l, '::before').width)));
    page = await nu.open({ html: CL, settings: { appTheme: 'cream', checkDrag: true, checkFixed: false } });
    let sz = await sizes(page);
    assert.ok(sz[1] > sz[0] * 1.5, `Settings off: Big words get a big box (${sz})`);
    // ⋯ → Checklists… (1.3.21): one row in the menu, says whether the note follows Settings; its own pop-up has the switches
    await page.click('#btnMenu');
    assert.equal(await page.textContent('#miChecksVal'), 'As in Settings', 'the menu row: as in Settings');
    assert.equal(await page.isVisible('#ckFixed + i'), false, 'the switches are not in the menu');
    await page.click('#miChecks');
    assert.ok(await page.isVisible('#ckPop'), 'Checklists… opens its pop-up');
    assert.equal(await page.isChecked('#ckFixed'), false, 'its switch shows Settings');
    assert.ok(await page.isDisabled('#ckReset'), 'Use Settings: nothing to undo yet');
    await page.click('label:has(#ckFixed)'); await page.waitForTimeout(300);
    assert.equal(await page.textContent('#miChecksVal'), '1 changed', 'the menu row says so');
    assert.ok(await page.isVisible('.cktag[data-k="fixed"]') && !(await page.isVisible('.cktag[data-k="drag"]')), '"this note" on that switch only');
    assert.equal(await page.textContent('#ckFoot'), 'Different from Settings.');
    sz = await sizes(page);
    assert.ok(sz.every((v) => Math.abs(v - sz[0]) < 0.1), `this note: every box the same size (${sz})`);
    assert.ok(await page.evaluate(() => { const li = document.querySelectorAll('#editor li')[1]; const r = li.getBoundingClientRect(); const top = parseFloat(getComputedStyle(li, '::before').top); return top > 8 && top < r.height - 8; }), 'still beside the big words (not at the top)');
    let ck = (await page.updates()).filter((u) => 'checklist' in u).map((u) => u.checklist);
    assert.deepEqual(ck[ck.length - 1], { fixed: true }, 'saved as the note\'s own choice');
    await page.click('label:has(#ckFixed)'); await page.waitForTimeout(300);
    ck = (await page.updates()).filter((u) => 'checklist' in u).map((u) => u.checklist);
    assert.deepEqual(ck[ck.length - 1], { fixed: null }, 'back to what Settings says: follows Settings again');
    assert.ok((await sizes(page))[1] > sz[0] * 1.5, 'and the big box is back');
    // Use Settings: all three back to Settings at once
    await page.click('label:has(#ckDrag)'); await page.click('label:has(#ckSink)'); await page.waitForTimeout(300);
    assert.equal(await page.textContent('#miChecksVal'), '2 changed');
    await page.click('#ckReset'); await page.waitForTimeout(300);
    ck = (await page.updates()).filter((u) => 'checklist' in u).map((u) => u.checklist);
    assert.deepEqual(ck[ck.length - 1], { drag: null, sink: null, fixed: null }, 'Use Settings: the note follows Settings again');
    assert.equal(await page.textContent('#miChecksVal'), 'As in Settings');
    assert.ok(await page.isChecked('#ckDrag') && !(await page.isChecked('#ckSink')) && await page.isDisabled('#ckReset'), 'the switches show Settings');
    // dragging a pop-up by its grip (1.3.22): many moves in one frame move it once, to the last one
    const drag1 = await page.evaluate(() => new Promise((done) => {
      const pop = document.getElementById('ckPop'); const g = pop.querySelector('.igrip').getBoundingClientRect();
      const x = g.left + g.width / 2; const y = g.top + g.height / 2; const top0 = pop.getBoundingClientRect().top;
      const ev = (type, dy) => new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 1, button: 0, clientX: x, clientY: y + dy, screenX: x, screenY: y + dy });
      pop.querySelector('.igrip').dispatchEvent(ev('pointerdown', 0));
      for (let i = 1; i <= 30; i++) window.dispatchEvent(ev('pointermove', i));
      const sameFrame = pop.getBoundingClientRect().top - top0;
      requestAnimationFrame(() => requestAnimationFrame(() => { const after = pop.getBoundingClientRect().top - top0; window.dispatchEvent(ev('pointerup', 30)); done({ sameFrame, after }); }));
    }));
    assert.deepEqual(drag1, { sameFrame: 0, after: 30 }, 'moved once, by the last move: ' + JSON.stringify(drag1));
    // "close all" (1.3.22): pressing it no longer closes the menus inside the note first (the button then hid and its
    // click never came: a menu outside the note stayed open)
    if (!(await page.isVisible('#menu'))) await page.click('#btnMenu');
    assert.ok(await page.isVisible('#menu') && await page.isVisible('#ckPop') && await page.isVisible('#btnCloseAll'), 'two menus open: Close all shows');
    await page.dispatchEvent('#btnCloseAll', 'mousedown', { button: 0 });
    assert.ok(await page.isVisible('#menu') && await page.isVisible('#ckPop') && await page.isVisible('#btnCloseAll'), 'pressing it closes nothing yet');
    await page.click('#btnCloseAll');
    assert.ok(!(await page.isVisible('#menu')) && !(await page.isVisible('#ckPop')), 'its click closes them all');
  }
  // (last) Undo / Redo are greyed out when there is nothing to take back or put back (1.3.23): text, then drawing
  {
    const page = await open({ html: '<p>Hello</p>' });
    const st = () => page.evaluate(() => ({ u: document.getElementById('btnUndo').disabled, r: document.getElementById('btnRedo').disabled }));
    assert.deepEqual(await st(), { u: true, r: true }, 'a fresh note: nothing to undo or redo');
    await page.click('#editor p'); await page.keyboard.press('End'); await page.keyboard.type(' world');
    assert.deepEqual(await st(), { u: false, r: true }, 'after typing: Undo can, Redo cannot');
    await press(page, '#btnUndo');
    assert.deepEqual(await st(), { u: true, r: false }, 'after Undo: Redo can, Undo cannot');
    await press(page, '#btnRedo');
    assert.deepEqual(await st(), { u: false, r: true }, 'after Redo: Undo can again');
    // drawing has its own lists: a stroke makes Undo possible, undoing it makes Redo possible
    await press(page, '#btnInk');
    assert.deepEqual(await st(), { u: true, r: true }, 'drawing, nothing drawn yet: both grey');
    const box = await page.locator('#inkCatch').boundingBox();
    await page.mouse.move(box.x + 40, box.y + 60); await page.mouse.down(); await page.mouse.move(box.x + 120, box.y + 90, { steps: 6 }); await page.mouse.up();
    await page.waitForTimeout(80);
    assert.deepEqual(await st(), { u: false, r: true }, 'after a stroke: Undo can, Redo cannot');
    await press(page, '#btnUndo');
    assert.deepEqual(await st(), { u: true, r: false }, 'after undoing the stroke: Redo can');
  }
  // ---- 1.3.27: evening colours and the panic button
  {
    const catchCalls = () => {
      const old = window.sticky;
      window.__panics = 0;
      window.sticky = new Proxy({}, { get: (t, k) => (k === 'panic' ? () => { window.__panics++; return Promise.resolve(1); }
        : k === 'onEvening' ? (cb) => { window.__evening = cb; } : old[k]) });
    };
    const S = { appTheme: 'cream', eveOn: true, evePhase: 1, panicOn: true, panicKey: 'Alt+Z' };
    const page = await nu.open({ html: '<div>hello</div>', color: 'blue', settings: S }, 360, 520, catchCalls);
    const paper = () => page.evaluate(() => getComputedStyle(document.body).getPropertyValue('--paper').trim());
    // the paper as it shows: painted on a canvas and read back as rgb (the computed value is an oklab mix)
    const bg = () => page.evaluate(() => {
      const x = document.createElement('canvas').getContext('2d');
      x.fillStyle = getComputedStyle(document.body).getPropertyValue('--paper'); x.fillRect(0, 0, 1, 1);
      return `rgb(${[...x.getImageData(0, 0, 1, 1).data.slice(0, 3)].join(', ')})`;
    });
    assert.equal(await page.evaluate(() => document.body.style.getPropertyValue('--eve')), '1', 'evening: --eve is the phase');
    assert.ok(/color-mix/.test(await paper()), 'the paper is mixed (note-base.css)');
    const eveBg = await bg();
    await page.evaluate(() => window.__evening(0));
    const dayBg = await bg();
    assert.notEqual(eveBg, dayBg, 'the phase from main changes the paper');
    assert.equal(dayBg, 'rgb(210, 236, 255)', 'phase 0: the day colour (Sky)');
    await page.evaluate(() => window.__evening(0.5));
    const halfBg = await bg();
    assert.ok(halfBg !== eveBg && halfBg !== dayBg, `half way: in between (${halfBg})`);
    await page.evaluate(() => window.__evening(1));
    // the ⋯ switch: off here (its own), then on again = as in Settings (null)
    await press(page, '#btnMenu');
    assert.ok(await page.isChecked('#eveSwitch') && !(await page.isVisible('#eveTag')), 'on, as in Settings');
    await page.locator('#eveSwitch').evaluate((x) => x.click());
    assert.equal(await page.evaluate(() => document.body.style.getPropertyValue('--eve')), '0', 'off on this note: day colours');
    assert.ok(await page.isVisible('#eveTag'), '"this note"');
    await page.locator('#eveSwitch').evaluate((x) => x.click());
    const ups = await page.updates();
    assert.deepEqual(ups.filter((u) => 'evening' in u).map((u) => u.evening), [false, null], 'saved: off, then as in Settings again');
    // the panic button
    assert.ok(await page.isVisible('#btnPanic'), 'the panic button is in the top bar');
    assert.ok((await page.getAttribute('#btnPanic', 'title')).includes('(Alt+Z)'), 'its tooltip names the shortcut');
    await press(page, '#btnPanic');
    assert.equal(await page.evaluate(() => window.__panics), 1, 'a click asks main to panic');
    await press(page, '#btnMenu');
    assert.ok(await page.isVisible('#panicRow') && await page.isChecked('#panicSwitch'), 'closes with the panic button (as in Settings)');
    await page.locator('#panicSwitch').evaluate((x) => x.click());
    assert.deepEqual((await page.updates()).filter((u) => 'panic' in u).pop(), { panic: false }, 'off: this note stays open');
    assert.ok(await page.isVisible('#panicTag'), '"this note"');
    assert.ok((await page.getAttribute('#btnPanic', 'title')).includes('This note stays open'), 'the tooltip says so');
    await page.close();
    // panic off, a dark paper: no button, no switches for them
    const dark = await nu.open({ html: '<div>x</div>', color: 'charcoal', settings: { ...S, panicOn: false } }, 360, 520);
    await press(dark, '#btnMenu');
    assert.ok(!(await dark.isVisible('#btnPanic')) && !(await dark.isVisible('#panicRow')), 'panic off: no button, no switch');
    assert.ok(!(await dark.isVisible('#eveRow')), 'a dark paper: no evening switch');
    await dark.close();
  }
  // ---- 1.3.34: click-through; 1.4.11: turned on in the pin's right-click menu, and its button (left of the pin) shows only while
  // it is on, to turn it off. While it's on, nothing else in the note reacts to the mouse, and the mouse on the button tells
  // main (ctAwake). The panic button sits left of the title, away from it.
  {
    const catchAwake = () => {
      const old = window.sticky;
      window.__awake = [];
      window.sticky = new Proxy({}, { get: (t, k) => (k === 'ctAwake' ? (on) => { window.__awake.push(on); } : k === 'pinApps' ? () => Promise.resolve([]) : old[k]) });
    };
    const S = { appTheme: 'cream', panicOn: true, clickThroughOn: true };
    const page = await nu.open({ html: '<div>hello</div>', settings: S }, 360, 320, catchAwake);
    const order = () => page.evaluate(() => [...document.querySelectorAll('#bar > :not([hidden])')].map((x) => x.id || x.className));
    assert.deepEqual((await order()).slice(0, 4), ['btnList', 'btnNew', 'btnPanic', 'title'], `the panic button is left of the title (${await order()})`);
    assert.ok(!(await page.isVisible('#btnCt')), 'off: no click-through button in the top bar');
    const at = (sel) => page.evaluate((s) => { const r = document.querySelector(s).getBoundingClientRect(); const x = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return x && (x.closest('[id]') || x).id; }, sel);
    assert.equal(await at('#btnPin'), 'btnPin', 'off: the pin works');
    await page.click('#btnPin', { button: 'right' });
    await page.waitForTimeout(80);
    assert.ok(await page.isVisible('#pinCt'), 'the pin\'s right-click menu offers it');
    await page.click('#pinCt');
    await page.waitForTimeout(60);
    assert.deepEqual((await page.updates()).pop(), { clickThrough: true, pinned: true }, 'on: saved, and pinned');
    assert.ok(!(await page.isVisible('#pinPop')), 'the menu closes');
    assert.ok(await page.evaluate(() => document.body.classList.contains('ct')) && await page.getAttribute('#btnCt', 'aria-pressed') === 'true');
    const now = await order();
    assert.equal(now[now.indexOf('btnCt') + 1], 'btnPin', 'its button shows, just left of the pin');
    assert.deepEqual(await page.evaluate(() => window.__awake), [], 'the mouse isn\'t on the button: main isn\'t told');
    for (const sel of ['#btnPin', '#btnMenu', '#btnClose', '#btnPanic', '#editor']) assert.notEqual(await at(sel), sel.slice(1), `${sel} doesn't take the mouse`);
    assert.equal(await at('#btnCt'), 'btnCt', 'only its button does');
    const box = async (sel) => { const r = await page.locator(sel).boundingBox(); return [r.x + r.width / 2, r.y + r.height / 2]; };
    await page.mouse.move(...await box('#editor'));
    await page.mouse.move(...await box('#btnCt'));
    await page.mouse.move(...await box('#btnPin'));
    await page.mouse.move(...await box('#btnCt'));
    assert.deepEqual(await page.evaluate(() => window.__awake), [true, false, true], 'on the button and off it, each once');
    await page.mouse.click(...await box('#btnCt'));
    await page.waitForTimeout(60);
    assert.deepEqual((await page.updates()).pop(), { clickThrough: false }, 'off again');
    assert.ok(!(await page.evaluate(() => document.body.classList.contains('ct'))));
    assert.ok(!(await page.isVisible('#btnCt')), 'and its button goes');
    await page.close();
    // Settings → Click-through off: not in the pin's menu, and a note that chose it takes the mouse
    const off = await nu.open({ html: '<div>x</div>', pinned: true, clickThrough: true, settings: { ...S, clickThroughOn: false } }, 360, 320, catchAwake);
    assert.ok(!(await off.isVisible('#btnCt')) && !(await off.evaluate(() => document.body.classList.contains('ct'))), 'off in Settings: nothing');
    await off.click('#btnPin', { button: 'right' });
    await off.waitForTimeout(80);
    assert.ok(await off.isVisible('#pinPop') && !(await off.isVisible('#pinCt')), 'nor in the pin\'s menu');
    await off.close();
    // the smallest note still fits its top bar, its button too
    const small = await nu.open({ html: '<div>x</div>', pinned: true, clickThrough: true, settings: S }, 200, 200);
    assert.ok(await small.evaluate(() => { const b = document.querySelector('#bar'); const c = document.querySelector('#btnClose').getBoundingClientRect(); return b.scrollWidth <= b.clientWidth && c.right <= innerWidth; }), 'a 200 px note: every button fits');
    assert.ok(await small.isVisible('#btnCt'), 'the click-through button never goes into the » menu');
    await small.close();
  }
  // ---- 1.4.1: reminders (main's side: reminders.test.js). A reminder that rings shows a strip under the top bar with its
  // message ("Missed at …" when late), Snooze 10 min (the arrow: other times) and Done, and the note glows; a locked note
  // shows no message and waits for the PIN when the reminder asks for it. Add → Reminder opens the panel (1.4.19: the
  // owner's design, below); setting one sends it to main (remindSet) with its message, and the chip shows it.
  {
    const catchRemind = () => {
      const old = window.sticky;
      window.__rem = [];
      window.sticky = new Proxy({}, { get: (t, k) => {
        if (k === 'remindAct') return (...a) => { window.__rem.push(['act', ...a]); return Promise.resolve(true); };
        if (k === 'remindSet') return (list, msgs) => { window.__rem.push(['set', list, msgs]); return Promise.resolve({ reminders: list.map((r) => ({ ...r, at: r.start, firing: false, count: 0, target: 'note' })), remindMsg: msgs }); };
        return old[k];
      } });
    };
    const now = Date.now();
    const late = { id: 'late01', start: now - 2 * 3600e3, at: now - 2 * 3600e3, repeat: null, sound: null, hide: false, unlock: true, target: 'note', firing: true, firedAt: now - 2 * 3600e3, late: true, snooze: null, count: 1 };
    const S = { appTheme: 'cream', remindSound: 'none', remindVolume: 0.5 };
    let page = await nu.open({ html: '<div>buy milk</div>', reminders: [late], remindMsg: { late01: 'Call the dentist' }, settings: S }, 380, 360, catchRemind);
    assert.ok(await page.isVisible('#remBar'), 'the strip shows');
    assert.match(await page.textContent('#remWhen'), /^Missed /, 'late: "Missed …"');
    assert.equal(await page.textContent('#remMsg'), 'Call the dentist');
    assert.ok(await page.evaluate(() => document.body.classList.contains('ringing')), 'the note glows');
    await page.click('#remSnoozeMore');
    assert.ok(await page.isVisible('#remMenu'), 'the arrow: other times');
    await page.click('#remMenu [data-m="30"]');
    await page.click('#remDone');
    assert.deepEqual(await page.evaluate(() => window.__rem), [['act', 'late01', 'snooze', 30], ['act', 'late01', 'done', undefined]]);
    await page.close();
    // a locked note: no message; this reminder asks for the PIN: the buttons wait
    page = await nu.open({ html: '', hidden: true, lockedBy: 'note', locked: true, reminders: [late], remindMsg: null, settings: S }, 380, 360, catchRemind);
    assert.ok(await page.isVisible('#remBar') && !(await page.isVisible('#remMsg')), 'locked: the strip, no message');
    assert.ok(await page.isDisabled('#remDone') && await page.isVisible('#remLockHint'), 'Unlock to dismiss');
    await page.close();
    // Add → Reminder (1.4.19, the owner's design): one panel of a fixed size: In / At, a time box (hours and minutes;
    // Settings can add seconds), a message, Repeat (week days) or the day (its own calendar), a sound, hiding. Set saves it
    // with its message, the panel closes, and a chip at the bottom of the note shows it; the chip opens it again
    page = await nu.open({ html: '<div>x</div>', settings: S }, 380, 620, catchRemind);
    assert.ok(!(await page.isVisible('#remBar')), 'nothing rings: no strip');
    assert.ok(!(await page.isVisible('#remChip')), 'no reminder: no chip');
    await nu.press(page, '#btnInsert');
    await page.click('#insert [data-act="remind"]');
    await page.waitForTimeout(80);
    assert.ok(await page.isVisible('#remPop'), 'the panel opens');
    assert.equal(await page.textContent('#remPop .rm-hd b'), 'New reminder', 'straight to a new one');
    await page.click('#remPop .rm-mode [data-mode="at"]');
    assert.equal(await page.locator('#remPop .rm-frame input').count(), 2, 'hours and minutes');
    // nothing moves: In, At, Repeat, and the calendar keep the panel and its rows where they are
    const where = () => page.evaluate(() => ['.rmd', '.rm-mode', '.rm-frame', '.rm-row textarea', '.rm-save'].map((s) => {
      const e = document.querySelector('#remPop ' + s); if (!e) return null; const b = e.getBoundingClientRect(); return [b.x, b.y, b.width, b.height].map(Math.round).join(',');
    }));
    const atPlace = await where();
    await page.click('#remPop .rm-mode [data-mode="in"]');
    assert.deepEqual(await where(), atPlace, 'In: nothing moves');
    assert.ok(await page.evaluate(() => document.querySelector('#remPop .rm-repeat').classList.contains('rm-off')), 'In: Repeat and the day fade, they stay');
    await page.click('#remPop .rm-mode [data-mode="at"]');
    await page.click('#remPop .rm-repeat');
    assert.deepEqual(await where(), atPlace, 'Repeat: the week days take the day’s row');
    assert.equal(await page.locator('#remPop .rm-days button').count(), 7);
    await page.click('#remPop .rm-repeat');
    const panelSize = await page.evaluate(() => { const b = document.querySelector('#remPop').getBoundingClientRect(); return [b.y, b.height].map(Math.round).join(','); });
    assert.match(await page.textContent('#remPop .rm-day span'), /^\w{3} \d{1,2} \w{3}( \d{4})? \((Today|Tomorrow)\)$/, 'the day: its date, and how far (1.4.20)');
    assert.ok(!(await page.$('#remPop .rm-hide')), 'Settings → Hiding notes is off: no Hide the note');
    await page.click('#remPop .rm-day');
    assert.equal((await page.textContent('#remPop .rm-back')).trim(), 'Back', 'the calendar, in the same box: its header is Back');
    assert.equal(await page.evaluate(() => { const b = document.querySelector('#remPop').getBoundingClientRect(); return [b.y, b.height].map(Math.round).join(','); }), panelSize);
    assert.equal(await page.locator('#remPop .rm-grid.d button').count(), 42, 'always six weeks');
    await page.click('#remPop .rm-ttl');
    assert.equal(await page.locator('#remPop .rm-grid.m button').count(), 12, 'the month: the months');
    await page.click('#remPop .rm-ttl');
    assert.equal(await page.textContent('#remPop .rm-grid.y button.now'), String(new Date().getFullYear()), 'the year: the years, from this one');
    await page.click('#remPop .rm-back svg');
    assert.equal(await page.textContent('#remPop .rm-hd b'), 'New reminder', 'Back (its arrow too) goes back');
    // 1.4.20: a click between the digits picks the number; 7 then 5 is 07:05 (7 can't start an hour: on to the minutes)
    const hb = await page.locator('#remPop .rm-frame input[data-k="atH"]').boundingBox();
    await page.mouse.click(hb.x + hb.width / 2, hb.y + hb.height / 2);
    await page.keyboard.type('75');
    assert.deepEqual([await page.inputValue('#remPop [data-k="atH"]'), await page.inputValue('#remPop [data-k="atM"]')], ['07', '5'], 'typed over, on to the minutes');
    await page.keyboard.type('8');
    assert.equal(await page.inputValue('#remPop [data-k="atM"]'), '58', 'the minutes: two digits');
    await page.keyboard.type('3');
    assert.equal(await page.inputValue('#remPop [data-k="atM"]'), '3', 'a full box starts again (it never just stops)');
    await page.click('#remPop .rm-mode [data-mode="in"]');
    await page.fill('#remPop [data-k="inH"]', '00'); await page.fill('#remPop [data-k="inM"]', '00');
    assert.equal(await page.textContent('#remPop .rm-when'), 'Choose how long.', 'In at 0: a hint');
    assert.ok(await page.evaluate(() => document.querySelector('#remPop .rm-when').classList.contains('wait')) && await page.isDisabled('#remPop .rm-save'), 'not an error; nothing to set yet');
    await page.click('#remPop .rm-mode [data-mode="at"]');
    // 09:30 with a message: today if it's still ahead, else tomorrow
    await page.fill('#remPop .rm-frame input[data-k="atH"]', '09');
    await page.fill('#remPop .rm-frame input[data-k="atM"]', '30');
    await page.fill('#remPop .rm-row textarea', 'Water the plants');
    await page.click('#remPop .rm-save');
    await page.waitForTimeout(80);
    let sent = await page.evaluate(() => window.__rem.filter((x) => x[0] === 'set').pop());
    const d = new Date(sent[1][0].start);
    assert.ok(d.getHours() === 9 && d.getMinutes() === 30 && sent[1][0].start > Date.now() && sent[1][0].start - Date.now() < 864e5, 'the next 09:30');
    assert.equal(sent[1][0].repeat, null);
    assert.deepEqual(Object.values(sent[2]), ['Water the plants'], 'with its message');
    assert.ok(!(await page.isVisible('#remPop')), 'Set closes the panel');
    assert.match(await page.textContent('#remChip'), /(Today|Tomorrow) 09:30/, 'the chip shows it');
    // the chip opens it; a repeat on Mondays and Fridays
    await page.click('#remChip');
    assert.equal(await page.textContent('#remPop .rm-hd b'), 'Edit reminder');
    assert.equal(await page.inputValue('#remPop .rm-row textarea'), 'Water the plants');
    await page.click('#remPop .rm-repeat');
    const isOn = (x) => page.evaluate((k) => document.querySelector(`#remPop .rm-days [data-d="${k}"]`).classList.contains('on'), x);
    for (const x of [1, 5]) if (!(await isOn(x))) await page.click(`#remPop .rm-days [data-d="${x}"]`); // each click draws the row again
    for (const x of [0, 2, 3, 4, 6]) if (await isOn(x)) await page.click(`#remPop .rm-days [data-d="${x}"]`);
    const on = await page.$$eval('#remPop .rm-days button.on', (bs) => bs.map((b) => Number(b.dataset.d)));
    assert.deepEqual(on, [1, 5], 'Monday and Friday');
    await page.click('#remPop .rm-save');
    await page.waitForTimeout(80);
    sent = await page.evaluate(() => window.__rem.filter((x) => x[0] === 'set').pop());
    assert.equal(sent[1].length, 1, 'changed, not added');
    assert.deepEqual(sent[1][0].repeat, { k: 'week', days: on.sort() }, 'the week days');
    assert.ok([0, 1, 2, 3, 4, 5, 6].filter((x) => on.includes(x)).includes(new Date(sent[1][0].start).getDay()) && sent[1][0].start > Date.now(), 'it starts on its first day from now');
    await page.close();
    // several days: one reminder each, the same time and message; Settings → Show seconds: a third box
    page = await nu.open({ html: '<div>x</div>', settings: { ...S, remindSeconds: true, remindAutoNext: false, remindHide: true } }, 380, 620, catchRemind);
    await nu.press(page, '#btnInsert');
    await page.click('#insert [data-act="remind"]');
    await page.waitForTimeout(80);
    await page.click('#remPop .rm-mode [data-mode="at"]');
    assert.equal(await page.locator('#remPop .rm-frame input').count(), 3, 'seconds too');
    await page.click('#remPop [data-k="atH"]');
    await page.keyboard.type('11');
    assert.equal(await page.evaluate(() => document.activeElement.dataset.k), 'atH', 'Settings → Jump to the next box off: it stays');
    assert.ok(await page.isVisible('#remPop .rm-hide'), 'Settings → Hiding notes on: Hide the note');
    assert.equal(await page.evaluate(() => { const r = document.querySelector('#remPop .rmd'); return r.scrollHeight - r.clientHeight; }), 0, 'it fits, that row too');
    await page.click('#remPop .rm-day');
    await page.click('#remPop .rm-multi');
    await page.click('#remPop .rm-dphd .rm-ib[title="Next"]');
    await page.click('#remPop .rm-grid.d button:not(.other):not(.past) >> nth=2'); // each click draws the month again
    await page.click('#remPop .rm-grid.d button:not(.other):not(.past) >> nth=9');
    await page.click('#remPop .rm-done');
    assert.match(await page.textContent('#remPop .rm-day span'), /^2 days: /);
    await page.fill('#remPop .rm-row textarea', 'Pay the bills');
    await page.click('#remPop .rm-save');
    await page.waitForTimeout(80);
    sent = await page.evaluate(() => window.__rem.filter((x) => x[0] === 'set').pop());
    assert.equal(sent[1].length, 2, 'two reminders');
    assert.deepEqual(Object.values(sent[2]), ['Pay the bills', 'Pay the bills']);
    assert.equal(new Set(sent[1].map((r) => new Date(r.start).toTimeString().slice(0, 8))).size, 1, 'the same time');
    await page.close();
    // a repeat as it was (only its message changed) keeps its start, so main keeps it as it is; one that isn't week days
    // (every month) shows as words and stays
    const start = Date.now() - 20 * 864e5;
    const mon = { id: 'mon01', start, at: Date.now() + 5 * 864e5, repeat: { k: 'month', until: null, times: null }, sound: null, hide: false, unlock: false, target: 'note', firing: false, firedAt: null, late: false, snooze: null, count: 3 };
    page = await nu.open({ html: '<div>x</div>', lockedBy: 'note', reminders: [mon], remindMsg: {}, settings: S }, 380, 660, catchRemind);
    assert.match(await page.textContent('#remChip'), /^\D*\w/, 'the chip');
    await page.click('#remChip');
    assert.match(await page.textContent('#remPop .rm-other'), /Every month on the/, 'every month, in words');
    assert.ok(await page.isVisible('#remPop .rm-unlock'), 'a locked note: Unlock to dismiss');
    assert.equal(await page.evaluate(() => document.querySelector('#remPop').style.getPropertyValue('--rm-h')), '490px', 'one row more (1.4.20: the panel says its height)');
    assert.equal(await page.evaluate(() => { const r = document.querySelector('#remPop .rmd'); return r.scrollHeight - r.clientHeight; }), 0, 'it fits');
    await page.fill('#remPop .rm-row textarea', 'Rent');
    await page.click('#remPop .rm-save');
    await page.waitForTimeout(80);
    sent = await page.evaluate(() => window.__rem.filter((x) => x[0] === 'set').pop());
    assert.equal(sent[1][0].start, start, 'its start stays');
    assert.deepEqual(sent[1][0].repeat, mon.repeat, 'and its repeat');
    assert.deepEqual(sent[2], { mon01: 'Rent' });
    assert.deepEqual(page.errors, []);
    await page.close();
  }
  // Copy image (1.4.3): the page asks main for the photo (its own fetch() of stickyfile:// fails in the app), makes a PNG
  // of it and hands that to main for the clipboard; a picture main can't give = "Couldn’t copy this picture"
  {
    const copyPage = (bytes) => nu.open({ html: '<p>a<img class="att-img" src="stickyfile://att/p.png">b</p>' }, 360, 320, `(() => {
      const base = window.sticky; window.__cp = { asked: [], png: null, fetched: 0 };
      const f = window.fetch; window.fetch = (...a) => { window.__cp.fetched++; return f(...a); };
      window.sticky = new Proxy(base, { get: (t, k) => k === 'photoBytes' ? async (u) => { window.__cp.asked.push(u);
        if (!${bytes}) return null;
        const c = new OffscreenCanvas(3, 2); const g = c.getContext('2d'); g.fillStyle = '#f00'; g.fillRect(0, 0, 3, 2);
        return new Uint8Array(await (await c.convertToBlob({ type: 'image/webp' })).arrayBuffer()); }
        : k === 'copyImage' ? async (png) => { window.__cp.png = png; return true; } : t[k] });
    })()`);
    let pg = await copyPage(true);
    const copied = async (p) => {
      await p.locator('#editor img').dispatchEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 40, clientY: 40 });
      await p.waitForTimeout(50);
      await p.evaluate(() => [...window.COSMO_NOTE_KIT.$('#ctx').querySelectorAll('button')].find((x) => x.textContent.includes('Copy image')).click());
      await p.waitForFunction(() => /\bcop/i.test(document.getElementById('toast').textContent));
      return p.evaluate(async () => {
        const cp = window.__cp; let size = null;
        if (cp.png) { const b = await createImageBitmap(new Blob([cp.png])); size = [b.width, b.height]; }
        return { asked: cp.asked, fetched: cp.fetched, png: cp.png && [...cp.png.slice(0, 4)], size, toast: document.getElementById('toast').textContent };
      });
    };
    let r = await copied(pg);
    assert.deepEqual(r.asked, ['stickyfile://att/p.png'], 'main is asked for the photo');
    assert.equal(r.fetched, 0, 'the page doesn’t fetch it itself');
    assert.deepEqual(r.png, [0x89, 0x50, 0x4e, 0x47], 'a PNG goes to the clipboard (made from a WebP here)');
    assert.deepEqual(r.size, [3, 2], 'at its full size');
    assert.equal(r.toast, 'Picture copied');
    await pg.close();
    pg = await copyPage(false);
    r = await copied(pg);
    assert.equal(r.png, null); assert.equal(r.toast, 'Couldn’t copy this picture');
    await pg.close();
  }
  // ---- 1.4.6: + and Ctrl+N: every press asks main for a note; a ring spins around + until all of them have shown
  {
    const newInit = () => {
      const base = window.sticky;
      const N = window.__new = { asked: 0, answer: [] };
      const own = { newNote: () => { N.asked++; return new Promise((res) => N.answer.push(res)); } };
      window.sticky = new Proxy({}, { get: (t, k) => own[k] || base[k] });
    };
    const pg = await nu.open({ html: '<p>x</p>' }, 360, 320, `(${newInit})()`);
    const st = () => pg.evaluate(() => ({ asked: window.__new.asked, busy: document.getElementById('btnNew').classList.contains('busy'),
      ring: getComputedStyle(document.getElementById('btnNew'), '::after').animationName }));
    await nu.press(pg, '#btnNew'); await nu.press(pg, '#btnNew');
    await pg.focus('#editor'); await pg.keyboard.press('Control+n');
    let r = await st();
    assert.equal(r.asked, 3, 'each press asks for a note (none are dropped)');
    assert.ok(r.busy && r.ring === 'newSpin', 'the ring spins around +');
    await pg.evaluate(() => { window.__new.answer.shift()('n1'); window.__new.answer.shift()('n2'); }); await pg.waitForTimeout(30);
    assert.ok((await st()).busy, 'still spinning while one is on its way');
    await pg.evaluate(() => window.__new.answer.shift()(null)); await pg.waitForTimeout(30);
    r = await st();
    assert.ok(!r.busy && r.ring === 'none', 'all shown: the ring goes');
    await pg.close();
  }
  await nu.done(); // (fails on any error in a page)
  console.log('ok');
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
