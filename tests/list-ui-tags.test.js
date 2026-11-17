'use strict';
// Tags in the notes list, in a real browser (tests/helpers/list-ui.js), 1.4.10: the row of tags under the search box (a
// locked note's stay hidden), cards' own tags, picking one or several (All / Any, saved), a group's tags count for what is
// inside it (the group card shows, its notes too), #tag typed in the search (with words), a card's tag picks it, Escape and
// opening a group forget them, the Favourites and Locked tabs, right-click → Tags… (add, suggestions) and the selection bar's Tags
// (several: faded ones only some have).
const assert = require('assert');

(async () => {
  let MILK, REPORT, LOOSE, SPOONS, DIARY, KITCHEN;
  const ui = await require('./helpers/list-ui')(async (s) => {
    await s.password();
    MILK = await s.note({ title: 'Milk', html: '<div>buy milk</div>', tags: ['home', 'urgent'], favorite: true });
    REPORT = await s.note({ title: 'Report', html: '<div>quarterly</div>', tags: ['work', 'urgent'] });
    LOOSE = await s.note({ title: 'Loose one' });
    SPOONS = await s.note({ title: 'Spoons' });
    DIARY = await s.note({ title: 'Diary', tags: ['secret'] });
    KITCHEN = await s.group([SPOONS], { name: 'Kitchen', tags: ['home'] });
    await s.lock(DIARY);
  });
  const { page } = ui;
  const shown = async () => (await ui.keys()).map((k) => k.slice(2)).sort();
  const chips = () => page.$$eval('#tagRow .tagchip', (cs) => cs.map((c) => `${c.firstChild.textContent}${c.classList.contains('on') ? '*' : ''}`));
  const chip = (t) => `#tagRow .tagchip:has-text("#${t}")`;
  const tagsOf = async (id) => { const d = await ui.get(); return (d.notes.find((n) => n.id === id) || d.groups.find((g) => g.id === id)).tags; };

  // ---- the row and the cards
  assert.ok(await ui.visible('#tagRow'), 'the row shows once a tag is in use');
  assert.deepEqual(await chips(), ['#home', '#urgent', '#work'], 'A to Z; a locked note’s tags stay hidden');
  assert.deepEqual(await page.$$eval(`${ui.noteKey(MILK)} .ctag`, (x) => x.map((e) => e.textContent)), ['#home', '#urgent'], 'a card shows its own tags');
  assert.equal(await ui.count(`${ui.noteKey(DIARY)} .ctag`), 0, 'a locked card shows none');
  assert.deepEqual(await page.$$eval(`${ui.groupKey(KITCHEN)} .ctag`, (x) => x.map((e) => e.textContent)), ['#home'], 'a group card shows its tags');

  // ---- pick one, then two: All, then Any
  await ui.click(chip('urgent'));
  assert.deepEqual(await shown(), [MILK, REPORT].sort(), 'one tag: what has it');
  assert.deepEqual(await chips(), ['#urgent*', '#home', '#work'], 'the picked one first, lit');
  assert.ok(!(await ui.visible('#tagRow .tagmode')), 'All / Any only with two or more');
  await ui.click(chip('home'));
  assert.deepEqual(await shown(), [MILK], 'All: both tags');
  assert.ok(await ui.visible('#tagRow .tagmode'));
  await ui.click('#tagRow .tagmode button:has-text("Any")');
  assert.deepEqual(await shown(), [MILK, REPORT, KITCHEN, SPOONS].sort(), 'Any: either; the group with #home and the note inside it');
  assert.equal((await ui.get()).settings.tagAny, true, 'Any is remembered');
  await ui.click('#tagRow .tagmode button:has-text("All")');
  await ui.click(chip('urgent'));
  assert.deepEqual(await shown(), [MILK, KITCHEN, SPOONS].sort(), '#home: the group’s tag counts for its note');
  await ui.click('#tagRow .tagclear');
  assert.deepEqual(await chips(), ['#home', '#urgent', '#work'], 'the X drops them all');
  assert.ok((await shown()).includes(LOOSE) && !(await shown()).includes(SPOONS), 'back to the normal view');

  // ---- typed in the search: #tag (its start), with words
  await ui.type('#q', '#wor');
  assert.deepEqual(await shown(), [REPORT], 'a typed #tag: what has a tag starting with it');
  await ui.type('#q', '#home milk');
  assert.deepEqual(await shown(), [MILK], 'with words: both');
  await ui.type('#q', '#nothing');
  assert.match(await ui.text('#cards'), /No note matches “#nothing”/);
  await ui.click('#qClear');

  // ---- a card's tag picks it; Escape forgets it; opening a group forgets it
  await ui.click(`${ui.noteKey(REPORT)} .ctag:has-text("#work")`);
  assert.deepEqual(await shown(), [REPORT], 'a click on a card’s tag filters by it');
  assert.equal(await page.evaluate(() => document.activeElement && document.activeElement.closest('.card') ? 'card' : 'no'), 'no', 'and doesn’t open the note');
  await ui.key('Escape');
  assert.deepEqual(await chips(), ['#home', '#urgent', '#work'], 'Escape forgets the picked tags');
  await ui.click(chip('home'));
  await ui.click(ui.groupKey(KITCHEN));
  assert.ok(await ui.visible('#groupHead'), 'the group opens');
  assert.deepEqual(await shown(), [SPOONS], 'inside it, the normal view');
  await ui.click('#btnBack');

  // ---- the Favourites tab filters too
  await ui.tab('favs');
  await ui.click(chip('work'));
  assert.match(await ui.text('#cards'), /No favourite matches “#work”/);
  await ui.click(chip('work'));
  await ui.click(chip('home'));
  assert.deepEqual(await shown(), [MILK], 'a favourite with the tag');
  await ui.click('#tagRow .tagclear');
  // and the Locked tab: a locked note's tags show only once it is unlocked
  await ui.tab('locks');
  await ui.click(chip('home'));
  assert.match(await ui.text('#cards'), /Nothing locked matches “#home”\. Unlock all/);
  await ui.click('#tagRow .tagclear');
  await ui.tab('notes');

  // ---- right-click → Tags…: add one (Enter), a suggestion, remove one
  await ui.menu(ui.noteKey(LOOSE), 'Tags…');
  assert.ok(await ui.visible('#tagSheet'), 'the Tags pop-up');
  assert.match(await ui.text('#tagTitle'), /Loose one/);
  await page.fill('#tagHere .tinput', '#Later');
  await page.press('#tagHere .tinput', 'Enter');
  await ui.settle();
  assert.deepEqual(await tagsOf(LOOSE), ['later'], 'saved at once, cleaned');
  await page.fill('#tagHere .tinput', 'one, two thr');
  await ui.settle();
  assert.deepEqual(await tagsOf(LOOSE), ['later', 'one', 'two'], 'pasted with commas or spaces: one tag each');
  assert.equal(await page.inputValue('#tagHere .tinput'), 'thr', 'the last one stays to finish');
  await page.fill('#tagHere .tinput', '');
  await ui.click('#tagHere .tchip:has-text("#one") .tx');
  await ui.click('#tagHere .tchip:has-text("#two") .tx');
  await page.fill('#tagHere .tinput', 'wo');
  await page.dispatchEvent('#tagHere .tinput', 'input');
  assert.deepEqual(await page.$$eval('#tagHere .tsg', (x) => x.map((e) => e.textContent)), ['#work'], 'suggestions: tags in use starting with what is typed');
  await ui.click('#tagHere .tsg');
  assert.deepEqual(await tagsOf(LOOSE), ['later', 'work']);
  await ui.click('#tagHere .tchip:has-text("#later") .tx');
  assert.deepEqual(await tagsOf(LOOSE), ['work'], 'the × removes it');
  await ui.click('#tagClose');
  assert.ok(!(await ui.visible('#tagSheet')));
  assert.deepEqual(await page.$$eval(`${ui.noteKey(LOOSE)} .ctag`, (x) => x.map((e) => e.textContent)), ['#work'], 'the card shows it');
  // a group's own: right-click → Tags… says its tags count for what is inside
  await ui.menu(ui.groupKey(KITCHEN), 'Tags…');
  assert.match(await ui.text('#tagTip'), /inside a group/);
  await ui.key('Escape');
  assert.ok(!(await ui.visible('#tagSheet')), 'Escape closes it');
  // a locked card: no Tags… (it can't be changed until it is unlocked)
  await ui.rclick(ui.noteKey(DIARY));
  assert.ok(!(await ui.menuLabels()).includes('Tags…'), 'no Tags… on a locked card');
  await ui.key('Escape');

  // ---- several: the selection bar
  await ui.click(ui.noteKey(MILK), { ctrlKey: true });
  await ui.click(ui.noteKey(REPORT), { ctrlKey: true });
  assert.ok(await ui.visible('#bTags'), 'the bar has Tags');
  await ui.click('#bTags');
  const sheet = await page.$$eval('#tagHere .tchip', (x) => x.map((e) => `${e.querySelector('.tname').textContent}${e.classList.contains('part') ? '~' : ''}`));
  assert.deepEqual(sheet, ['#urgent', '#home~', '#work~'], 'tags both have, then faded ones only some have');
  await ui.click('#tagHere .tchip.part .tname:has-text("#home")');
  assert.deepEqual(await tagsOf(REPORT), ['work', 'urgent', 'home'], 'a faded one clicked: all of them get it');
  await ui.click('#tagHere .tchip:has-text("#urgent") .tx');
  assert.deepEqual([await tagsOf(MILK), await tagsOf(REPORT)], [['home'], ['work', 'home']], 'its ×: off all of them');
  await ui.click('#tagClose');
  await ui.done();
  console.log('ok');
  process.exit(0);
})();
