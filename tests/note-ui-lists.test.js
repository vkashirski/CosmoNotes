'use strict';
// List lines in a note window (1.4.17, src/note/fx-format.js "list lines"): Bullets / Checklist change only the cursor's
// or the selected lines (a nested line: its top-level line, with what is nested in it), never a whole list; Tab / Shift+Tab
// / Backspace move the same line one level (its tick stays); each is one Undo step, with Redo, and Undo gives the ticks
// back. Enter at a ticked line's start gives an unticked new line. A drawing cleared and Done goes as one Undo step.
// (The owner lost 45 ticks to the old Bullets → Checklist: the whole list, ticks off, no Undo.)
const assert = require('assert');

(async () => {
  const nu = await require('./helpers/note-ui')();
  // ---- Bullets / Checklist / Tab / Shift+Tab / Backspace / Enter in lists
  {
    const LIST4 = '<ul class="checklist"><li class="done">alpha one</li><li>beta two</li><li class="done">gamma three</li><li class="done">delta four</li></ul>';
    const NEST = '<ul class="checklist"><li class="done">top one<ul><li class="done">child a</li><li>child b</li></ul></li><li class="done">top two</li><li>top three</li></ul>';
    const clean = (h) => h.replace(/ style="[^"]*"| class=""/g, '');
    const html = (pg) => pg.evaluate(() => document.getElementById('editor').innerHTML).then(clean);
    const ticks = (pg) => pg.evaluate(() => [...document.querySelectorAll('#editor li')].map((l) => (l.classList.contains('done') ? 'x' : 'o')).join(''));
    // the caret in li number i (document order) at offset at ('end' = its end), or a selection from line a to line b
    const caret = (pg, i, at = 2) => pg.evaluate(([i, at]) => {
      const ed = document.getElementById('editor'); ed.focus();
      const t = document.createTreeWalker(ed.querySelectorAll('li')[i], NodeFilter.SHOW_TEXT).nextNode();
      const r = document.createRange(); r.setStart(t, at === 'end' ? t.length : at); r.collapse(true);
      getSelection().removeAllRanges(); getSelection().addRange(r);
    }, [i, at]);
    const span = (pg, a, b) => pg.evaluate(([a, b]) => {
      const ed = document.getElementById('editor'); ed.focus();
      const t = (i) => document.createTreeWalker(ed.querySelectorAll('li')[i], NodeFilter.SHOW_TEXT).nextNode();
      const r = document.createRange(); r.setStart(t(a), 2); r.setEnd(t(b), 3);
      getSelection().removeAllRanges(); getSelection().addRange(r);
    }, [a, b]);
    const key = async (pg, k) => { await pg.keyboard.press(k); await pg.waitForTimeout(60); };
    // after `act`: Undo (n times) gives the note back as it was, Redo the change again
    const undoable = async (pg, start, n = 1) => {
      const after = await html(pg);
      for (let i = 0; i < n; i++) await key(pg, 'Control+z');
      assert.equal(await html(pg), start, 'Undo gives the lines back as they were, ticks too');
      for (let i = 0; i < n; i++) await key(pg, 'Control+y');
      assert.equal(await html(pg), after, 'Redo does it again');
    };
    let pg = await nu.open({ html: LIST4 });
    let start = await html(pg);
    // the owner's case: Bullets, then Checklist on the cursor's line
    await caret(pg, 1); await key(pg, 'Control+Shift+L');
    assert.equal(await html(pg), '<ul class="checklist"><li class="done">alpha one</li></ul><ul><li>beta two</li></ul><ul class="checklist"><li class="done">gamma three</li><li class="done">delta four</li></ul>', 'Bullets: only the cursor\'s line');
    await key(pg, 'Control+Shift+C');
    assert.equal(await ticks(pg), 'xoxx', 'Checklist again: every other line keeps its tick');
    await undoable(pg, start, 2);
    await pg.waitForTimeout(500);
    const saved = (await pg.updates()).filter((u) => 'html' in u).pop().html;
    assert.equal(saved, '<ul class="checklist"><li class="done">alpha one</li><li>beta two</li><li class="done">gamma three</li><li class="done">delta four</li></ul>', 'saved as one list again (collect joins them)');
    await pg.close();
    // Bullets on a ticked line: that line's tick goes (it has no box), and Undo brings it back
    pg = await nu.open({ html: LIST4 }); start = await html(pg);
    await caret(pg, 2); await nu.press(pg, '#tools [data-cmd="bullets"]');
    assert.equal(await html(pg), '<ul class="checklist"><li class="done">alpha one</li><li>beta two</li></ul><ul><li>gamma three</li></ul><ul class="checklist"><li class="done">delta four</li></ul>');
    await undoable(pg, start);
    await key(pg, 'Control+z');
    // two selected lines
    await span(pg, 1, 2); await key(pg, 'Control+Shift+L');
    assert.equal(await html(pg), '<ul class="checklist"><li class="done">alpha one</li></ul><ul><li>beta two</li><li>gamma three</li></ul><ul class="checklist"><li class="done">delta four</li></ul>', 'Bullets: the selected lines');
    await undoable(pg, start);
    await pg.close();
    // a nested line: its top-level line goes, with what is nested in it; the rest of the checklist stays
    pg = await nu.open({ html: NEST }); start = await html(pg);
    await caret(pg, 2); await key(pg, 'Control+Shift+L');
    assert.equal(await html(pg), '<ul><li>top one<ul><li>child a</li><li>child b</li></ul></li></ul><ul class="checklist"><li class="done">top two</li><li>top three</li></ul>', 'Bullets in a nested line');
    await undoable(pg, start);
    await pg.close();
    // Checklist on one bullet line, on a numbered line, on words under a bullet list (each into its own list)
    pg = await nu.open({ html: '<ul><li>b one</li><li>b two</li><li>b three</li></ul>' }); start = await html(pg);
    await caret(pg, 1); await key(pg, 'Control+Shift+C');
    assert.equal(await html(pg), '<ul><li>b one</li></ul><ul class="checklist"><li>b two</li></ul><ul><li>b three</li></ul>', 'Checklist: one bullet line');
    await undoable(pg, start);
    await pg.close();
    pg = await nu.open({ html: '<ul><li>b one</li></ul><div>words</div>' }); start = await html(pg);
    await pg.evaluate(() => { const ed = document.getElementById('editor'); ed.focus(); const r = document.createRange(); r.setStart(ed.querySelector('div').firstChild, 2); getSelection().removeAllRanges(); getSelection().addRange(r); });
    await key(pg, 'Control+Shift+C');
    assert.equal(await html(pg), '<ul><li>b one</li></ul><ul class="checklist"><li>words</li></ul>', 'words that joined the bullet list above become a checklist line of their own');
    await undoable(pg, start, 2);
    await pg.close();
    // Tab / Shift+Tab: the same line one level in or out, tick and all
    pg = await nu.open({ html: LIST4 }); start = await html(pg);
    await caret(pg, 0); await key(pg, 'Tab');
    assert.equal(await html(pg), start, 'the first line has no line above to go into: it stays');
    await span(pg, 2, 3); await key(pg, 'Tab');
    assert.equal(await html(pg), '<ul class="checklist"><li class="done">alpha one</li><li>beta two<ul><li class="done">gamma three</li><li class="done">delta four</li></ul></li></ul>', 'Tab: into a list in the line above');
    await undoable(pg, start);
    await key(pg, 'Control+z');
    await caret(pg, 2); await key(pg, 'Tab'); await caret(pg, 2); await key(pg, 'Shift+Tab');
    assert.equal(await html(pg), start, 'Tab then Shift+Tab: the line is back, still ticked');
    await pg.close();
    pg = await nu.open({ html: NEST }); start = await html(pg);
    await caret(pg, 1); await key(pg, 'Shift+Tab');
    assert.equal(await html(pg), '<ul class="checklist"><li class="done">top one</li><li class="done">child a<ul><li>child b</li></ul></li><li class="done">top two</li><li>top three</li></ul>', 'Shift+Tab: the line after it at its level stays below it, nested in it');
    await undoable(pg, start);
    await key(pg, 'Control+z');
    // Backspace at a nested line's start: one level out, still ticked; at a top-level line's start: out of the list,
    // and Undo gives it back ticked (its tick was taken off outside Undo before)
    await caret(pg, 1, 0); await key(pg, 'Backspace');
    assert.equal(await ticks(pg), 'xxoxo', 'Backspace in a nested line: still ticked');
    await undoable(pg, start);
    await pg.close();
    pg = await nu.open({ html: LIST4 }); start = await html(pg);
    await caret(pg, 2, 0); await key(pg, 'Backspace');
    assert.equal(await ticks(pg), 'xox', 'Backspace at a top-level line\'s start: it leaves the list');
    await key(pg, 'Control+z');
    assert.equal(await html(pg), start, 'Undo: the line is back, ticked');
    // Enter at a ticked line's start: the new, empty line above has no tick
    await caret(pg, 2, 0); await key(pg, 'Enter');
    assert.equal(await ticks(pg), 'xooxx', 'the new empty line is not ticked');
    await key(pg, 'Control+z');
    assert.equal(await html(pg), start);
    await pg.close();
  }
  // ---- Clear, then Done on a drawing takes it out as one Undo step (before 1.4.17, Undo couldn't bring it back)
  {
    const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFUlEQVR42mP8z8BQz0AEYBxVSF+FAP5FDvcfRYWgAAAAAElFTkSuQmCC';
    const pg = await nu.open({ html: `<div>before</div><div><img class="att-drawing" src="${PNG}" width="80"></div><div>after</div>` });
    const n = () => pg.evaluate(() => document.querySelectorAll('#editor img').length);
    await pg.locator('#editor img.att-drawing').dblclick(); await pg.waitForTimeout(150);
    assert.ok(await pg.evaluate(() => !document.getElementById('draw').hidden), 'the drawing opens');
    await pg.locator('#dClear').click(); await pg.locator('#dDone').click(); await pg.waitForTimeout(150);
    assert.equal(await n(), 0, 'cleared: the drawing goes');
    await pg.locator('#editor div').first().click(); await pg.keyboard.press('Control+z'); await pg.waitForTimeout(100);
    assert.equal(await n(), 1, 'Undo brings it back');
    await pg.keyboard.press('Control+y'); await pg.waitForTimeout(100);
    assert.equal(await n(), 0, 'Redo takes it out again');
    await pg.close();
  }
  await nu.done(); // (fails on any error in a page)
  console.log('ok');
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
