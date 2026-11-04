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
  assert.ok(await page.evaluate(() => [...document.querySelectorAll('#insert .tile')].some((t) => t.dataset.act === 'speak' && t.textContent.trim() === 'Speak to text')), 'the + Add item');
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
  await sttEv(page, { jobId: 'J', type: 'ready', mode: 'after' });
  assert.equal(await toastNow(page), 'This PC is slow for live text. The words appear when you stop.', 'a slow PC: said once, words at Stop');
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
    await pg.locator('#ctx .mi', { hasText: 'Transcribe' }).dispatchEvent('click');
    await pg.waitForTimeout(150);
  };
  page = await nu.open({ html: chip }, 380, 320, `(${sttInit})()`);
  await trMenu(page);
  const job = await page.evaluate(() => window.__rec.tr.id);
  await sttEv(page, { jobId: job, type: 'progress', pct: 40 });
  assert.ok((await ed(page)).includes('&nbsp;</div><div><span class="stt-pending" contenteditable="false" data-job="' + job + '" data-label="Writing it down… 40%"></span></div><div>after</div>'), 'the marker on the line after the chip, with its progress');
  await page.evaluate(() => window.__rec.tr.r({ text: 'Buy a new charger.', fallback: null }));
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
  await nu.done(); // (fails on any error in a page)
  console.log('ok');
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
