'use strict';
// Tags (1.4.10): the rules of src/tags.js under Node (cleaning, the search box's #tags, All / Any, a group's tags for what
// is inside it), then main's side: list:tags on notes and groups (one or several, add and remove, not an edit, cleaned),
// the note window's note:tags and the suggestions (note:tags-known), Duplicate, the setting All / Any, a locked note (its
// tags secret: not on its card, not to its hidden window, no changes; sealed in its file and its backup) and, after a
// restart, sealed until the PIN. (The list window's side: list-ui-tags.test.js; the ⋯ menu's: note-ui.test.js.)
const assert = require('assert');
const app = require('./helpers/app');
const T = require('../src/tags');

if (app.phase === 'main') app.phases(__filename, ['first', 'second']);

// ---- the rules
if (app.phase === 'first') {
  assert.equal(T.clean('#Work'), 'work', 'lower case, no #');
  assert.equal(T.clean('  ##Купување  '), 'купување', 'Cyrillic letters stay');
  assert.equal(T.clean('to do list'), 'to-do-list', 'spaces become -');
  assert.equal(T.clean('urgent!!'), 'urgent', 'other signs go');
  assert.equal(T.clean('#'), null);
  assert.equal(T.clean('-x-'), 'x');
  assert.equal(T.clean('a'.repeat(50)).length, T.LEN, `at most ${T.LEN} letters`);
  assert.equal(T.clean(5), null);
  assert.deepEqual(T.cleanAll(['Work', 'work', '#WORK', '', null, 'home']), ['work', 'home'], 'each once');
  assert.equal(T.cleanAll(Array.from({ length: 40 }, (_, i) => `t${i}`)).length, T.MAX, `at most ${T.MAX}`);
  assert.deepEqual(T.cleanAll('work'), [], 'not a list: none');
  assert.deepEqual(T.parse('#Work milk #ho  # eggs'), { tags: ['work', 'ho'], text: 'milk eggs' }, 'the search box: #tags and the words');
  assert.deepEqual(T.parse(''), { tags: [], text: '' });
  assert.ok(T.match(['work', 'home'], ['work'], []), 'a picked tag');
  assert.ok(!T.match(['workshop'], ['work'], []), 'a picked tag is the whole tag');
  assert.ok(T.match(['workshop'], [], ['work']), 'a typed one is its start');
  assert.ok(!T.match(['work'], ['work', 'urgent'], []), 'All: every picked tag');
  assert.ok(T.match(['work'], ['work', 'urgent'], [], true), 'Any: one is enough');
  assert.ok(T.match([], [], []), 'nothing picked: everything');
}

(async () => {
  const { H, ev } = await app.start();
  const { S } = require('../main/state');
  const card = app.card;
  const tags = (ids, change) => H['list:tags'](null, [].concat(ids), change);

  if (app.phase === 'first') {
    // ---- notes and groups, one or several
    const a = await app.newNote({ html: '<div>milk</div>', title: 'Shopping' });
    const b = await app.newNote({ html: '<div>report</div>' });
    const c = await app.newNote({ html: '<div>other</div>' });
    const G = await H['groups:make-from'](null, [b, c], null);
    const edited = (await card(a)).updatedAt;
    await app.tick(5);
    assert.equal(await tags(a, { add: ['#Home', 'urgent', 'home'] }), 1);
    assert.deepEqual((await card(a)).tags, ['home', 'urgent'], 'cleaned, each once');
    assert.equal((await card(a)).updatedAt, edited, 'tagging is not an edit');
    assert.equal(await tags([a, b, G], { add: ['work'] }), 3, 'several at once, groups too');
    assert.deepEqual((await app.group(G)).tags, ['work']);
    assert.deepEqual((await card(b)).tags, ['work']);
    await tags([a, b], { remove: ['work', 'urgent'] });
    assert.deepEqual((await card(a)).tags, ['home'], 'removed from each, the others stay');
    assert.deepEqual((await card(b)).tags, []);
    assert.deepEqual(app.readJSON('groups.json').groups.find((g) => g.id === G).tags, ['work'], 'a group’s tags are in groups.json');
    S.store.flush();
    assert.deepEqual(app.readJSON(`notes/${a}.json`).tags, ['home'], 'a note’s are in its file');
    assert.equal(await tags(['nope', 5], { add: ['x'] }), 0, 'nothing for an unknown id');
    await tags(a, { add: Array.from({ length: 30 }, (_, i) => `t${i}`) });
    assert.equal((await card(a)).tags.length, T.MAX, `at most ${T.MAX} on one note`);
    await tags(a, { remove: (await card(a)).tags.filter((t) => t !== 'home') });
    // its open window hears it (the ⋯ menu shows them)
    const wa = app.winOf(a);
    assert.deepEqual(app.lastLook(wa).tags, ['home'], 'an open window gets the new tags (note:look)');

    // ---- the note's own ⋯ menu
    assert.deepEqual(await H['note:tags'](ev(wa), { add: ['Ideas'] }), ['home', 'ideas']);
    assert.deepEqual(await H['note:tags'](ev(wa), { remove: ['home'] }), ['ideas']);
    assert.deepEqual((await card(a)).tags, ['ideas']);
    assert.equal((await card(a)).updatedAt, edited, 'still not an edit');
    await H['note:update'](ev(wa), { html: '<div>milk and eggs</div>', text: 'milk and eggs', tags: [] });
    assert.deepEqual((await card(a)).tags, ['ideas'], 'saving the words never changes the tags');
    assert.deepEqual(await H['note:tags-known'](), ['ideas', 'work'], 'the suggestions: every tag in use, A to Z');

    // ---- Duplicate copies them
    const copy = await H['list:duplicate'](null, a);
    const dupId = (typeof copy === 'string' ? copy : null) || (await app.list()).notes.find((n) => n.title === 'Shopping (copy)').id;
    assert.deepEqual((await card(dupId)).tags, ['ideas'], 'Duplicate copies the tags');

    // ---- the list's All / Any
    assert.equal((await app.list()).settings.tagAny, false, 'All at first');
    await H['settings:set'](null, { tagAny: true });
    assert.equal(app.readJSON('settings.json').tagAny, true, 'saved');

    // ---- a locked note: its tags are secret
    assert.ok((await H['lock:set'](null, { next: '2580', kind: 'pin' })).ok);
    await H['crypt:key-saved']();
    await tags(b, { add: ['bank'] });
    await H['list:close-note'](null, b);
    await H['list:set-locked'](null, b, true, '2580');
    await H['list:lock-all']();
    assert.deepEqual((await card(b)).tags, [], 'not on its card while locked');
    assert.equal(await tags(b, { add: ['more'] }), 0, 'no changes while its lock hides it');
    assert.ok(!(await H['note:tags-known']()).includes('bank'), 'not among the suggestions either');
    await H['list:open-note'](null, b);
    const wb = app.winOf(b);
    const v = await H['note:get'](ev(wb));
    assert.ok(v.hidden && Array.isArray(v.tags) && !v.tags.length, 'its hidden window gets none');
    assert.equal(await H['note:tags'](ev(wb), { add: ['sneaky'] }), null, 'and can’t change them');
    S.store.flush();
    const file = app.read(`notes/${b}.json`);
    assert.ok(JSON.parse(file).enc && !file.includes('bank'), 'sealed in its file');
    const bdir = S.store.backupNow();
    const kept = app.read(`backups/${bdir}/${b}.json`);
    assert.ok(JSON.parse(kept).enc && !kept.includes('bank'), 'and in its backup');
    assert.ok((await H['list:unlock-all'](null, '2580')).ok);
    assert.deepEqual((await card(b)).tags, ['bank'], 'unlocked: back');
    await H['list:lock-all']();
    app.hand({ a, b, G });
    await app.quit();
  }

  if (app.phase === 'second') {
    const { a, b, G } = app.hand();
    assert.deepEqual((await card(a)).tags, ['ideas'], 'kept after a restart');
    assert.deepEqual((await app.group(G)).tags, ['work']);
    assert.deepEqual(S.store.get(b).tags, [], 'a locked note’s tags are sealed until the PIN');
    assert.deepEqual((await card(b)).tags, []);
    assert.ok((await H['list:unlock-all'](null, '2580')).ok);
    assert.deepEqual(S.store.get(b).tags, ['bank'], 'the PIN opens them');
    assert.deepEqual((await card(b)).tags, ['bank']);
    await app.quit();
  }
})();
