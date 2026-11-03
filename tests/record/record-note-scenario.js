'use strict';
// The clicks, typing, keys, drags and drawing the recorder (record-note.js) runs in note windows (the same for old and new code).
// Buttons get their events sent straight to them; typing, drawing and clicks in the text use Playwright's real mouse and
// keyboard. A step that finds nothing to click logs that as a STEP-ERROR (the same in both runs).
const kit = (page) => {
  page.setDefaultTimeout(1500);
  // a missing element throws at once (waiting for one hangs while the page's clock stands still)
  // the note's toolbars can be in a little window of their own (dragged out): look there too
  const el = async (sel) => {
    for (const pg of [page, ...page.context().pages().filter((x) => x !== page)]) { const l = pg.locator(sel).first(); if (await l.count()) return l; }
    throw new Error('nothing at ' + sel);
  };
  const click = async (sel) => { const e = await el(sel); await e.dispatchEvent('mousedown', { bubbles: true, cancelable: true, button: 0 }); await e.dispatchEvent('click', { bubbles: true, cancelable: true, button: 0 }); };
  const dbl = async (sel) => (await el(sel)).dispatchEvent('dblclick', { bubbles: true, cancelable: true });
  const check = async (sel) => (await el(sel)).evaluate((x) => x.click());
  const setVal = async (sel, v) => (await el(sel)).evaluate((x, val) => { x.value = val; x.dispatchEvent(new Event('input', { bubbles: true })); x.dispatchEvent(new Event('change', { bubbles: true })); }, v);
  const type = (t) => page.keyboard.type(t);
  const key = (k) => page.keyboard.press(k);
  const submit = async (sel) => (await el(sel)).evaluate((f) => f.requestSubmit());
  // put the caret / selection on some words of the note (in the first text node that has them)
  const select = (word, { collapse = false, end = false } = {}) => page.evaluate(([w, c, e]) => {
    const ed = document.getElementById('editor'); ed.focus();
    const tw = document.createTreeWalker(ed, NodeFilter.SHOW_TEXT);
    for (let n = tw.nextNode(); n; n = tw.nextNode()) {
      const i = n.data.indexOf(w); if (i < 0) continue;
      const r = document.createRange(); r.setStart(n, i); r.setEnd(n, i + w.length); if (c) r.collapse(!e);
      const s = getSelection(); s.removeAllRanges(); s.addRange(r); return true;
    }
    throw new Error('no text ' + w);
  }, [word, collapse, end]);
  const box = async (sel, scroll = true) => { const l = await el(sel); if (scroll) await l.evaluate((x) => x.scrollIntoView({ block: 'center' })); const b = await l.boundingBox(); if (!b) throw new Error('not shown: ' + sel); return b; };
  const rclick = async (sel, dx = 0.5, dy = 0.5) => { const b = await box(sel); await page.mouse.click(b.x + b.width * dx, b.y + b.height * dy, { button: 'right' }); };
  const ctx = async (label) => {
    const item = page.locator('#ctx:not([hidden]) button', { hasText: label });
    if (!(await item.count())) throw new Error(`no menu item ${label}`);
    await item.first().dispatchEvent('mousedown'); await item.first().dispatchEvent('click');
  };
  const stroke = async (pts, opts = {}) => {
    await page.mouse.move(pts[0][0], pts[0][1]); await page.mouse.down(opts);
    for (const [x, y] of pts.slice(1)) await page.mouse.move(x, y, { steps: 3 });
    await page.mouse.up(opts);
  };
  const wheel = (dy, mods = {}) => page.evaluate(([d, m]) => { document.getElementById('editor').dispatchEvent(new WheelEvent('wheel', { deltaY: d, bubbles: true, cancelable: true, clientX: 100, clientY: 150, ...m })); }, [dy, mods]);
  return { el, click, dbl, check, setVal, type, key, submit, select, box, rclick, ctx, stroke, wheel };
};

// ---- A: a note with everything in it
exports.full = async ({ page, step, H, advance }) => {
  const { el, click, dbl, check, setVal, type, key, submit, select, box, rclick, ctx, stroke, wheel } = kit(page);
  // text and formatting
  await step('click in the text', async () => { const b = await box('#editor'); await page.mouse.click(b.x + 40, b.y + 10); });
  await step('type', () => type(' hello there'));
  await step('select weekend', () => select('weekend'));
  for (const c of ['bold', 'italic', 'underline', 'strikeThrough']) await step(`format ${c}`, () => click(`[data-cmd="${c}"]`));
  await step('text panel open', () => click('#btnText'));
  await step('font round', () => click('#fontSeg [data-font="round"]'));
  await step('font size', () => click('#fsizeSeg button >> nth=2'));
  await step('colour red', () => click('[data-fore="#D93B3B"]'));
  await step('highlight', () => click('[data-hilite="#FFE74C"]'));
  await step('caret only (what you type next)', () => select('words', { collapse: true }));
  await step('colour green, type', async () => { await click('[data-fore="#2E9E4F"]'); await type('Z'); });
  await step('normal colour', () => click('[data-fore="inherit"]'));
  await step('font hand (whole note)', () => click('#fontSeg [data-font="hand"]'));
  await step('clear formatting', () => click('#miClearFmt'));
  await step('undo', () => click('#btnUndo'));
  await step('redo', () => click('#btnRedo'));
  await step('ctrl+z', () => key('Control+z'));
  await step('ctrl+y', () => key('Control+y'));
  await step('text panel close', () => click('#textX'));
  // lists and checklists
  await step('caret on bread', () => select('bread', { collapse: true, end: true }));
  await step('enter in checklist', () => key('Enter'));
  await step('type in checklist', () => type('jam'));
  await step('tab indents', () => key('Tab'));
  await step('shift+tab', () => key('Shift+Tab'));
  await step('tick a box', async () => { const b = await box('#editor ul.checklist li >> nth=1'); await page.mouse.click(b.x + 4, b.y + b.height / 2); });
  await step('untick', async () => { const b = await box('#editor ul.checklist li >> nth=0'); await page.mouse.click(b.x + 4, b.y + b.height / 2); });
  await step('caret on milk start', () => select('milk', { collapse: true }));
  await step('backspace at ticked line start', () => key('Backspace'));
  await step('ctrl+z', () => key('Control+z'));
  await step('select more', () => select('more'));
  await step('ctrl+t strike', () => key('Control+t'));
  await step('ctrl+shift+l bullets', () => key('Control+Shift+L'));
  await step('ctrl+shift+c checklist', () => key('Control+Shift+C'));
  await step('bullets button', () => click('[data-cmd="bullets"]'));
  await step('checklist button', () => click('[data-cmd="checklist"]'));
  await step('caret on end', () => select('list.', { collapse: true, end: true }));
  await step('delete joins lines', () => key('Delete'));
  await step('type a web address', async () => { await type(' www.example.org'); await key('Space'); });
  await step('caret at second start', () => select('second', { collapse: true }));
  await step('backspace joins', () => key('Backspace'));
  // links
  await step('select shop', () => select('shop'));
  await step('ctrl+k link form', () => key('Control+k'));
  await step('link url', () => setVal('#linkUrl', 'https://example.net/x'));
  await step('link save', () => submit('#linkPop'));
  await step('link right-click', () => rclick('#editor a'));
  await step('link: edit', () => ctx('Edit link'));
  await step('link cancel', () => click('#linkCancel'));
  await step('link right-click 2', () => rclick('#editor a'));
  await step('link: open', () => ctx('Open link'));
  await step('link right-click 3', () => rclick('#editor a'));
  await step('link: copy', () => ctx('Copy link address'));
  await step('link right-click 4', () => rclick('#editor a'));
  await step('link: remove', () => ctx('Remove link'));
  await step('ctrl+click link', async () => { const b = await box('#editor a'); await page.mouse.click(b.x + 3, b.y + 3, { modifiers: ['Control'] }); });
  // table
  await step('click in a cell', async () => { const b = await box('#editor td >> nth=0'); await page.mouse.click(b.x + 5, b.y + 5); });
  await step('tab to next cell', () => key('Tab'));
  await step('shift+tab', () => key('Shift+Tab'));
  await step('tab past the end', async () => { for (let k = 0; k < 4; k++) await key('Tab'); });
  for (const op of ['Add row above', 'Add row below', 'Add column left', 'Add column right', 'Delete row', 'Delete column']) {
    await step(`cell menu ${op}`, async () => { await rclick('#editor td >> nth=0'); await ctx(op); });
  }
  // picture
  await step('click the picture', async () => { const b = await box('#editor img'); await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2); });
  await step('drag the size handle', async () => { const b = await box('#imgHandle', false); await stroke([[b.x + b.width / 2, b.y + b.height / 2], [b.x - 20, b.y - 5], [b.x - 30, b.y - 10]]); });
  await step('resize warning: yes', () => click('#askYes'));
  await step('click the picture again', async () => { const b = await box('#editor img'); await page.mouse.click(b.x + 5, b.y + 5); });
  await step('handle double-click', () => dbl('#imgHandle'));
  for (const op of ['Small', 'Medium', 'Full width', 'Keep size', 'Copy image', 'Open in photo viewer']) {
    await step(`picture menu ${op}`, async () => { await rclick('#editor img'); await ctx(op); });
    if (op === 'Small' || op === 'Medium' || op === 'Full width') await step('ask: yes', () => click('#askYes'));
  }
  await step('picture menu description', async () => { await rclick('#editor img'); await ctx('description'); });
  await step('description text', () => setVal('#descText', 'A blue bike now'));
  await step('description save', () => submit('#descPop'));
  await step('picture menu description again', async () => { await rclick('#editor img'); await ctx('description'); });
  await step('description cancel', () => click('#descCancel'));
  await step('select the picture, Delete', async () => { const b = await box('#editor img'); await page.mouse.click(b.x + 5, b.y + 5); await key('Delete'); });
  await step('ctrl+z brings it back', () => key('Control+z'));
  // voice chip
  await step('play the recording', () => click('#editor .voice'));
  await step('pause it', () => click('#editor .voice'));
  await step('voice menu', async () => { await rclick('#editor .voice'); await ctx('Play'); });
  await step('voice menu pause', async () => { await rclick('#editor .voice'); await ctx('Pause'); });
  // find
  await step('ctrl+f', () => key('Control+f'));
  await step('find e', () => type('e'));
  await step('find er', () => type('r'));
  await step('find next', () => click('#findNext'));
  await step('find prev', () => click('#findPrev'));
  await step('F3', () => key('F3'));
  await step('shift+F3', () => key('Shift+F3'));
  await step('find bike (picture description)', () => setVal('#findQ', 'bike'));
  await step('find enter', () => key('Enter'));
  await step('find nothing', () => setVal('#findQ', 'zzz'));
  await step('ctrl+f again', () => key('Control+f'));
  await step('escape closes find', () => key('Escape'));
  // header, ⋯ menu, effects
  await step('⋯ menu', () => click('#btnMenu'));
  await step('title', async () => { await setVal('#titleInput', 'Weekend plans'); });
  await step('colour row: wheel', () => page.evaluate(() => document.getElementById('colors').dispatchEvent(new WheelEvent('wheel', { deltaY: 120, bubbles: true, cancelable: true }))));
  await step('colour row: drag', async () => { const b = await box('#colors', false); await stroke([[b.x + b.width - 20, b.y + b.height / 2], [b.x + b.width - 60, b.y + b.height / 2], [b.x + 20, b.y + b.height / 2]]); });
  await step('colour', () => click('#colors [data-color="night"]'));
  await step('colour back', () => click('#colors [data-color="mint"]'));
  await step('see-through', () => setVal('#opacity', '70'));
  await step('solid on hover', () => check('#solidHover'));
  await step('hover in', () => page.evaluate(() => document.documentElement.dispatchEvent(new MouseEvent('mouseenter'))));
  await step('hover out', () => page.evaluate(() => document.documentElement.dispatchEvent(new MouseEvent('mouseleave'))));
  await step('see-through back', () => setVal('#opacity', '100'));
  await step('effects pop-up', () => click('#miFx'));
  await step('fx tab followers', () => click('#fxTabs button >> nth=1'));
  await step('fx tab effects', () => click('#fxTabs button >> nth=0'));
  await step('fx pick 3rd', () => click('#fxEffects button >> nth=3'));
  await step('fx amount', () => click('#fxEAmt [data-a="low"]'));
  await step('fx opacity (dragging)', async () => (await el('#fxEOp input')).evaluate((x) => { x.value = '60'; x.dispatchEvent(new Event('input', { bubbles: true })); }));
  await step('fx opacity (let go)', async () => (await el('#fxEOp input')).evaluate((x) => { x.value = '55'; x.dispatchEvent(new Event('input', { bubbles: true })); x.dispatchEvent(new Event('change', { bubbles: true })); }));
  await step('fx follower 2nd', () => click('#fxFollowers button >> nth=2'));
  await step('fx follower amount', () => click('#fxFAmt [data-a="mid"]'));
  await step('fx follower opacity (no let go)', async () => (await el('#fxFOp input')).evaluate((x) => { x.value = '50'; x.dispatchEvent(new Event('input', { bubbles: true })); }));
  await step('fx opacity saves by itself', () => page.clock.runFor(400));
  await step('fx interact', () => check('#fxInteract'));
  await step('fx force all', () => check('#fxForce'));
  await step('fx pause', () => click('#fxPause'));
  await step('fx play (header)', () => click('#btnFx'));
  await step('let the effects run', () => page.clock.runFor(2000));
  await step('fx none', () => click('#fxEffects button >> nth=0'));
  await step('fx close', () => click('#fxX'));
  await step('close all (two open)', async () => { await click('#btnInsert'); await click('#btnCloseAll'); });
  await step('pin on top', () => click('#btnPin'));
  await step('pin off', () => click('#btnPin'));
  await step('roll up', () => click('#btnRoll'));
  await step('roll down', () => click('#btnRoll'));
  await step('double-click the bar', () => dbl('#bar'));
  await step('maximise', () => click('#btnMax'));
  await step('minimise', () => click('#btnMin'));
  await step('open list', () => click('#btnList'));
  await step('spelling toggle', () => click('#btnSpell'));
  await step('spelling back', () => click('#btnSpell'));
  // settings / look from main
  await step('main: dark theme', () => H['settings:set']({}, { theme: 'dark' }));
  await step('main: pause all effects', () => H['settings:set']({}, { fxPaused: true }));
  await step('main: play all effects', () => H['settings:set']({}, { fxPaused: false, theme: 'light' }));
  // zoom and word wrap
  await step('ctrl+wheel up', () => wheel(-100, { ctrlKey: true }));
  await step('ctrl+wheel up', () => wheel(-100, { ctrlKey: true }));
  await step('ctrl+= ', () => key('Control+='));
  await step('ctrl+-', () => key('Control+-'));
  await step('ctrl+0', () => key('Control+0'));
  await step('ctrl+wheel down', () => wheel(100, { ctrlKey: true }));
  await step('word wrap off', () => click('#btnWrap'));
  await step('wrap: ask yes', () => click('#askYes'));
  await step('narrow window', async () => { await page.setViewportSize({ width: 260, height: 380 }); });
  await step('wheel sideways', () => wheel(100, { shiftKey: true }));
  await step('wide window', async () => { await page.setViewportSize({ width: 420, height: 460 }); });
  await step('word wrap on', () => click('#btnWrap'));
  await step('wrap: ask yes', () => click('#askYes'));
  // draw-over
  await step('draw-over on', () => click('#btnInk'));
  await step('pen stroke', () => stroke([[60, 120], [90, 140], [130, 130], [160, 170]]));
  await step('highlighter', () => click('#inkTools [data-tool="hl"]'));
  await step('hl stroke', () => stroke([[50, 200], [180, 205]]));
  for (const t of ['line', 'arrow', 'rect', 'ellipse']) {
    await step(`tool ${t}`, () => click(`#inkTools [data-tool="${t}"]`));
    await step(`${t} stroke`, () => stroke([[70, 230], [150, 280]]));
  }
  await step('colour', () => click('#inkColors button >> nth=2'));
  await step('width', () => click('#inkWidths button >> nth=2'));
  await step('dash', () => click('#inkDash [data-d="dash"]'));
  await step('layer behind', () => click('#inkLayer [data-l="b"]'));
  await step('pen again', () => click('#inkTools [data-tool="pen"]'));
  await step('dashed pen stroke', () => stroke([[40, 300], [100, 320], [200, 310]]));
  await step('ctrl+z ink', () => key('Control+z'));
  await step('ctrl+y ink', () => key('Control+y'));
  await step('undo button ink', () => click('#btnUndo'));
  await step('redo button ink', () => click('#btnRedo'));
  await step('eraser whole stroke', () => click('#inkTools [data-tool="eraser"]'));
  await step('erase mode stroke', () => click('#eraseMode [data-m="stroke"]'));
  await step('erase move', () => stroke([[60, 120], [95, 140]]));
  await step('erase mode partial', () => click('#eraseMode [data-m="part"]'));
  await step('partial erase', () => stroke([[45, 195], [120, 210], [160, 200]]));
  await step('partial erase shape', () => stroke([[70, 230], [110, 250], [150, 280]]));
  await step('partial erase dashed', () => stroke([[100, 300], [110, 330]]));
  await step('undo partial', () => key('Control+z'));
  await step('pause drawing (text)', () => click('#inkPz'));
  await step('type while paused', async () => { await select('prices', { collapse: true, end: true }); await type(' ok'); });
  await step('resume drawing', () => click('#btnInk'));
  await step('drag the toolbar out', async () => { const b = await box('#inkGrip'); await stroke([[b.x + 4, b.y + 4], [b.x - 100, b.y - 200], [-50, -50]]); });
  await step('grip double-click', () => dbl('#inkGrip'));
  await step('clear drawing', () => click('#inkClear'));
  await step('clear: no', () => click('#askNo'));
  await step('draw-over off', () => click('#inkX'));
  await step('escape', () => key('Escape'));
  // right-click on plain text, ctrl+s, the dates
  await step('ctrl+s', () => key('Control+s'));
  await step('dates', () => click('#btnMenu'));
  await step('close menu', () => click('#menuX'));
};

// ---- B: a locked note
exports.locked = async ({ page, step, H, ids }) => {
  const { el, click, setVal, type, key, submit } = kit(page);
  await step('wrong password', async () => { await setVal('#unlockPw', 'nope'); await submit('#unlockForm'); });
  await step('right password', async () => { await setVal('#unlockPw', 'abc123'); await submit('#unlockForm'); });
  await step('type', async () => { await page.evaluate(() => document.getElementById('editor').focus()); await key('End'); await type(' more'); });
  await step('relock', () => click('#btnRelock'));
  await step('unlock again', async () => { await setVal('#unlockPw', 'abc123'); await submit('#unlockForm'); });
  await step('main: lock now', () => H['list:lock-all']({}));
  await step('unlock after lock-all', async () => { await setVal('#unlockPw', 'abc123'); await submit('#unlockForm'); });
  await step('⋯ menu', () => click('#btnMenu'));
  await step('cover title', () => setVal('#coverInput', 'Groceries'));
  await step('cover enter', async () => (await el('#coverInput')).dispatchEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
  await step('⋯ menu again', () => click('#btnMenu'));
  await step('remove lock', () => click('#miLock'));
  await step('ask: yes', () => click('#askYes'));
  await step('⋯ menu 3', () => click('#btnMenu'));
  await step('lock again', () => click('#miLock'));
  await step('change to PIN', async () => { await H['lock:set']({}, { current: 'abc123', next: '4321', kind: 'pin' }); });
  await step('PIN digits', async () => { await page.evaluate(() => document.getElementById('unlockPw').focus()); await type('43'); });
  await step('PIN wrong digits', () => type('99'));
  await step('PIN right', async () => { await setVal('#unlockPw', ''); await type('4321'); });
};

// ---- C: a new, empty note, opened with the focus in it
exports.fresh = async ({ page, step, H }) => {
  const { click, check, setVal, type, key, select, box, rclick, ctx, stroke, submit } = kit(page);
  await step('type a line', () => type('First line'));
  await step('enter, type', async () => { await key('Enter'); await type('Second line here'); });
  for (const act of ['date', 'divider', 'numbers', 'table']) await step(`insert ${act}`, async () => { await click('#btnInsert'); await click(`#insert [data-act="${act}"]`); });
  await step('insert link', async () => { await click('#btnInsert'); await click('#insert [data-act="link"]'); });
  await step('link fields', async () => { await setVal('#linkText', 'Example'); await setVal('#linkUrl', 'example.com'); });
  await step('link save', () => submit('#linkPop'));
  await step('insert photo (cancelled)', async () => { await click('#btnInsert'); await click('#insert [data-act="photo"]'); });
  await step('paste a picture', () => page.evaluate(async () => {
    const c = document.createElement('canvas'); c.width = 30; c.height = 20; const g = c.getContext('2d'); g.fillStyle = '#c33'; g.fillRect(0, 0, 30, 20);
    const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
    const dt = new DataTransfer(); dt.items.add(new File([blob], 'p.png', { type: 'image/png' }));
    document.getElementById('editor').dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
  }));
  await step('paste html', () => page.evaluate(() => {
    const dt = new DataTransfer(); dt.setData('text/html', '<p style="color:red">Pasted <b>bold</b> <script>x()</script><img src="javascript:1"> text</p>'); dt.setData('text/plain', 'Pasted bold text');
    document.getElementById('editor').dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
  }));
  await step('ctrl+shift+v plain paste', async () => { await key('Control+Shift+V'); await page.evaluate(() => { const dt = new DataTransfer(); dt.setData('text/html', '<b>plain?</b>'); dt.setData('text/plain', 'plain!'); document.getElementById('editor').dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true })); }); });
  await step('drop a picture', () => page.evaluate(async () => {
    const c = document.createElement('canvas'); c.width = 20; c.height = 20; const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
    const dt = new DataTransfer(); dt.items.add(new File([blob], 'd.png', { type: 'image/png' }));
    const o = { dataTransfer: dt, bubbles: true, cancelable: true, clientX: 50, clientY: 80 };
    const ed = document.getElementById('editor'); ed.dispatchEvent(new DragEvent('dragover', o)); ed.dispatchEvent(new DragEvent('drop', o));
  }));
  // voice recording (stand-in microphone)
  await step('record', async () => { await click('#btnInsert'); await click('#insert [data-act="voice"]'); });
  await step('recording runs', () => page.clock.runFor(1500));
  await step('stop recording', () => click('#recStop'));
  await step('record again', async () => { await click('#btnInsert'); await click('#insert [data-act="voice"]'); });
  await step('cancel recording', () => click('#recCancel'));
  await step('record, escape', async () => { await click('#btnInsert'); await click('#insert [data-act="voice"]'); await key('Escape'); });
  await step('voice: remove', async () => { await rclick('#editor .voice'); await ctx('Remove recording'); });
  // sketch
  await step('insert drawing', async () => { await click('#btnInsert'); await click('#insert [data-act="drawing"]'); });
  await step('sketch stroke', async () => { const b = await box('#cv'); await stroke([[b.x + 20, b.y + 20], [b.x + 60, b.y + 50], [b.x + 90, b.y + 30]]); });
  await step('sketch pen colour', () => click('#pens .pen >> nth=2'));
  await step('sketch size', () => click('#sizes .size >> nth=2'));
  await step('sketch stroke 2', async () => { const b = await box('#cv'); await stroke([[b.x + 30, b.y + 70], [b.x + 80, b.y + 80]]); });
  await step('sketch ctrl+z', () => key('Control+z'));
  await step('sketch undo', () => click('#dUndo'));
  await step('sketch eraser', () => click('#eraser'));
  await step('sketch erase', async () => { const b = await box('#cv'); await stroke([[b.x + 20, b.y + 20], [b.x + 50, b.y + 40]]); });
  await step('sketch clear', () => click('#dClear'));
  await step('sketch pen again', () => click('#pens .pen >> nth=1'));
  await step('sketch stroke 3', async () => { const b = await box('#cv'); await stroke([[b.x + 20, b.y + 20], [b.x + 60, b.y + 60]]); });
  await step('sketch done', () => click('#dDone'));
  await step('drawing menu: edit', async () => { await rclick('#editor img.att-drawing'); await ctx('Edit sketch'); });
  await step('sketch cancel', () => click('#dCancel'));
  await step('drawing menu: keep size', async () => { await rclick('#editor img.att-drawing'); await ctx('Keep size'); });
  await step('drawing menu: remove', async () => { await rclick('#editor img.att-drawing'); await ctx('Remove drawing'); });
  // password: set one from this note
  await step('⋯ menu', () => click('#btnMenu'));
  await step('lock (asks for a password)', () => click('#miLock'));
  await step('pin kind', () => click('#pwKind [data-k="pin"]'));
  await step('pin digits only', () => setVal('#pwNew', '12ab34'));
  await step('password kind', () => click('#pwKind [data-k="password"]'));
  await step('passwords differ', async () => { await setVal('#pwNew', 'abc123'); await setVal('#pwAgain', 'abc12'); await submit('#pwPop'); });
  await step('passwords match', async () => { await setVal('#pwAgain', 'abc123'); await submit('#pwPop'); });
  await step('unlock', async () => { await setVal('#unlockPw', 'abc123'); await submit('#unlockForm'); });
  // the rest of the menu
  await step('⋯ menu 2', () => click('#btnMenu'));
  await step('duplicate', () => click('#miDuplicate'));
  await step('ctrl+n', () => key('Control+n'));
  await step('new note button', () => click('#btnNew'));
  await step('right-click plain text', async () => { const b = await box('#editor'); await page.mouse.click(b.x + 10, b.y + 8, { button: 'right' }); });
  await step('select all, type over', async () => { await key('Control+a'); await type('x'); });
  await step('empty note', async () => { await key('Control+a'); await key('Backspace'); });
  await step('⋯ menu 3', () => click('#btnMenu'));
  await step('delete', () => click('#miDelete'));
  await step('ask yes', () => click('#askYes'));
  await step('ctrl+w', () => key('Control+w'));
};
