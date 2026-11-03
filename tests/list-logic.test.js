'use strict';
// How the notes list decides things (its own code, run without a browser through tests/helpers/list-kit.js):
// groups inside groups, what counts as locked, the Favourites and Locked tabs, sorting, where a dragged card may go,
// password / PIN rules, card sizes and window colours, dates on cards. Plus: the list's lists match store.js and main.
const assert = require('assert'); const fs = require('fs'); const path = require('path');
const store = require('../store.js');

const T0 = Date.UTC(2026, 9, 1, 12, 0, 0);
const note = (id, o = {}) => ({ id, title: id, text: `text of ${id}`, color: 'yellow', font: 'round', groupId: null, createdAt: T0, updatedAt: T0, ...o });
const group = (id, o = {}) => ({ id, name: id, parentId: null, open: true, locked: false, createdAt: T0, ...o });

(async () => {
  const K = await require('./helpers/list-kit')();

  // ---- the same lists as the rest of the app
  assert.deepEqual(K.COLORS, store.COLORS, 'paper colours: same as store.js, same order');
  assert.deepEqual([...K.DARK_COLORS].sort(), [...store.DARK_COLORS].sort(), 'dark paper colours: same as store.js');
  for (const c of K.COLORS) assert.ok(K.COLOR_NAMES[c] && K.SWATCH[c], `${c} has a name and a swatch`);
  assert.deepEqual(Object.keys(K.GCOLORS), store.GROUP_COLORS, 'group colours: same as store.js');
  assert.deepEqual(Object.keys(K.GNAMES), store.GROUP_COLORS, 'every group colour has a name');
  require('./helpers/app'); // (the fake Electron, for main's file)
  const { LIST_THEMES } = require('../main/list-window.js');
  assert.deepEqual(K.THEMES.map((t) => t.id).sort(), Object.keys(LIST_THEMES).sort(), 'window colours: the ones main paints the frame for');
  assert.equal(new Set(K.THEMES.map((t) => t.id)).size, K.THEMES.length, 'no window colour twice');
  assert.deepEqual(K.SIZES, ['s', 'm', 'l', 'xl', 'xxl'], 'card sizes, smallest first (Ctrl + wheel steps through them)');
  assert.ok(require('./helpers/sources').main().includes(`['s', 'm', 'l', 'xl', 'xxl'].includes(patch.listSize)`), 'main saves the same sizes');
  for (const s of K.SIZES) assert.ok(K.SIZE_NAMES[s], `size ${s} has a name`);

  // ---- settings with fallbacks
  K.set({ settings: {} });
  assert.equal(K.sizeNow(), 'm', 'no size saved: Medium');
  assert.equal(K.themeNow(), 'cream', 'no colour saved: Cream');
  K.set({ settings: { listSize: 'huge', listTheme: 'neon' } });
  assert.equal(K.sizeNow(), 'm', 'unknown size: Medium');
  assert.equal(K.themeNow(), 'cream', 'unknown colour: Cream');
  K.set({ settings: { listSize: 'xl', listTheme: 'night' } });
  assert.equal(K.sizeNow(), 'xl'); assert.equal(K.themeNow(), 'night');
  assert.deepEqual(K.sortPrefs(), { by: 'updated', dir: 'desc', groups: 'mixed' }, 'sorting: newest change first, groups mixed in');

  // ---- small words
  assert.equal(K.plural(1, 'note'), '1 note'); assert.equal(K.plural(0, 'note'), '0 notes'); assert.equal(K.plural(3, 'group'), '3 groups');
  const tilts = ['a', 'b', 'note-1', '00000000-0000-4000-8000-000000000001', 'x'.repeat(200)].map(K.tilt);
  for (const t of tilts) assert.ok(t >= -1.35 && t <= 1.35, 'cards tilt at most 1.35°');
  assert.equal(K.tilt('note-1'), K.tilt('note-1'), 'a card always tilts the same way');
  // dates on cards: Today / Yesterday / weekday this week / day and month (and year if not this year)
  const now = new Date(); const at = (days, h = 9) => new Date(now.getFullYear(), now.getMonth(), now.getDate() - days, h, 5).getTime();
  const time = (ts) => new Intl.DateTimeFormat([], { hour: '2-digit', minute: '2-digit' }).format(new Date(ts));
  assert.equal(K.when(at(0)), `Today ${time(at(0))}`);
  assert.equal(K.when(at(1)), `Yesterday ${time(at(1))}`);
  assert.equal(K.when(at(3)), new Intl.DateTimeFormat([], { weekday: 'long' }).format(new Date(at(3))));
  const old = new Date(now.getFullYear() - 1, 2, 4).getTime();
  assert.equal(K.when(old), new Intl.DateTimeFormat([], { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(old)), 'last year: with the year');

  // ---- groups inside groups
  // Home > Kitchen > Shelf ; Work ; a note in each, one binned
  K.set({
    groups: [group('home'), group('kitchen', { parentId: 'home' }), group('shelf', { parentId: 'kitchen' }), group('work'), group('empty')],
    notes: [note('n1', { groupId: 'home' }), note('n2', { groupId: 'kitchen' }), note('n3', { groupId: 'shelf' }), note('n4', { groupId: 'work' }), note('n5'), note('gone', { groupId: 'home', deletedAt: T0 })],
  });
  assert.deepEqual(K.live().map((n) => n.id), ['n1', 'n2', 'n3', 'n4', 'n5'], 'binned notes are not in the list');
  assert.deepEqual(K.chainOf('shelf').map((g) => g.id), ['shelf', 'kitchen', 'home'], 'chain: innermost first');
  assert.deepEqual(K.chainOf(null), [], 'top level: no chain');
  assert.deepEqual(K.childGroups(null).map((g) => g.id), ['home', 'work', 'empty']);
  assert.deepEqual(K.childGroups('home').map((g) => g.id), ['kitchen']);
  assert.deepEqual([...K.subtreeIds('home')].sort(), ['home', 'kitchen', 'shelf']);
  assert.deepEqual(K.notesInTree('home').map((n) => n.id), ['n1', 'n2', 'n3'], 'a group counts the notes in its sub-groups (not the binned one)');
  assert.equal(K.notesInTree('empty').length, 0);
  assert.ok(K.isInside('shelf', 'home') && !K.isInside('home', 'shelf') && !K.isInside('work', 'home'));
  // broken data (a loop) must not hang the list
  K.set({ groups: [group('a', { parentId: 'b' }), group('b', { parentId: 'a' })], notes: [] });
  assert.equal(K.chainOf('a').length, 2, 'a loop of groups: the chain stops');
  assert.deepEqual([...K.subtreeIds('a')].sort(), ['a', 'b']);

  // ---- where a dragged card may go
  K.set({
    groups: [group('home'), group('kitchen', { parentId: 'home' }), group('work')],
    notes: [note('n1', { groupId: 'home' }), note('n2'), note('n3', { groupId: 'kitchen' })],
  });
  const N = (id) => ({ kind: 'note', id }); const G = (id) => ({ kind: 'group', id });
  assert.equal(K.canMove(N('n1'), 'home'), false, 'a note into the group it is in: nothing to do');
  assert.equal(K.canMove(N('n1'), 'work'), true, 'into another group');
  assert.equal(K.canMove(N('n1'), null), true, 'up to the top level');
  assert.equal(K.canMove(N('n2'), null), false, 'already at the top');
  assert.equal(K.canMove(G('home'), 'home'), false, 'a group never goes inside itself');
  assert.equal(K.canMove(G('home'), 'kitchen'), false, '…or inside its own sub-group');
  assert.equal(K.canMove(G('kitchen'), 'work'), true, 'a sub-group into another group');
  assert.equal(K.canMove(G('kitchen'), 'home'), false, 'already there');
  assert.equal(K.canMove({ ...N('n1'), many: [N('n1'), N('n2')] }, 'work'), true, 'several cards: fine if one can move');
  assert.equal(K.canMove({ ...G('home'), many: [G('home'), N('n2')] }, 'kitchen'), false, 'several cards: never a group inside itself');

  // ---- what counts as locked (locked things can't be binned or deleted)
  K.set({
    groups: [group('safe', { locked: true, open: false }), group('inner', { parentId: 'safe', open: false }), group('plain'), group('holder'), group('lockedEmpty', { locked: true })],
    notes: [note('own', { ownLock: true, locked: true }), note('inSafe', { groupId: 'inner' }), note('free'), note('p1', { groupId: 'plain' }), note('h1', { groupId: 'holder', ownLock: true })],
  });
  const byId = (id) => K.V.state.notes.find((n) => n.id === id);
  const gById = (id) => K.V.state.groups.find((g) => g.id === id);
  assert.equal(K.noteIsLocked(byId('own')), true, 'its own lock');
  assert.equal(K.noteIsLocked(byId('inSafe')), true, 'inside a locked group (two levels up)');
  assert.equal(K.noteIsLocked(byId('free')), false);
  assert.equal(K.groupIsLocked(gById('safe')), true, 'a locked group');
  assert.equal(K.groupIsLocked(gById('inner')), true, 'inside a locked group');
  assert.equal(K.groupIsLocked(gById('holder')), true, 'holds a note with its own lock');
  assert.equal(K.groupIsLocked(gById('plain')), false);
  assert.ok(/can’t be deleted/.test(K.LOCKED_NO_DELETE));
  // (main sends open: false for a locked group not opened with the password, and for every group inside one)
  // the Locked tab: notes with their own lock and locked groups that hold notes; the ones inside a closed locked group are counted, not shown
  let L = K.lockedOnes();
  assert.deepEqual(L.notes.map((n) => n.id).sort(), ['h1', 'own']);
  assert.deepEqual(L.groups.map((g) => g.id), ['safe'], 'an empty locked group is not listed');
  assert.equal(L.hidden, 0);
  K.V.state.notes.push(note('deep', { groupId: 'inner', ownLock: true }));
  L = K.lockedOnes();
  assert.ok(!L.notes.some((n) => n.id === 'deep') && L.hidden === 1, 'a locked note inside a closed locked group: hidden, counted');
  gById('inner').open = true; gById('safe').open = true; // "Unlock all": main sends them open
  assert.ok(K.lockedOnes().notes.some((n) => n.id === 'deep') && K.lockedOnes().hidden === 0, 'after Unlock all it shows');
  // ---- Favourites: the same rule
  K.set({
    groups: [group('fav', { favorite: true }), group('favEmpty', { favorite: true }), group('closed', { locked: true, open: false })],
    notes: [note('f1', { favorite: true }), note('f2', { favorite: true, groupId: 'closed' }), note('x', { groupId: 'fav' }), note('binned', { favorite: true, deletedAt: T0 })],
  });
  const F = K.favourites();
  assert.deepEqual(F.notes.map((n) => n.id), ['f1'], 'binned favourites are not shown');
  assert.deepEqual(F.groups.map((g) => g.id), ['fav'], 'a favourite group with no notes is not shown');
  assert.equal(F.hidden, 1, 'a favourite inside a closed locked group is counted, not shown');

  // ---- sorting
  const items = () => [
    { kind: 'note', note: note('a', { createdAt: 1, updatedAt: 50 }) },
    { kind: 'note', note: note('b', { createdAt: 2, updatedAt: 10 }) },
    { kind: 'group', group: group('g', { createdAt: 3 }), notes: [note('in', { updatedAt: 70 })] },
    { kind: 'group', group: group('h', { createdAt: 0 }), notes: [] },
  ];
  const ids = (list) => list.map((i) => (i.note || i.group).id);
  const sortWith = (p) => { K.set({ settings: { listSort: p } }); return ids(K.sortItems(items())); };
  assert.deepEqual(sortWith({}), ['g', 'a', 'b', 'h'], 'newest change first; a group counts its newest note');
  assert.deepEqual(sortWith({ by: 'updated', dir: 'asc' }), ['h', 'b', 'a', 'g'], 'oldest change first');
  assert.deepEqual(sortWith({ by: 'created', dir: 'desc' }), ['g', 'b', 'a', 'h'], 'newest made first');
  assert.deepEqual(sortWith({ by: 'created', dir: 'asc', groups: 'first' }), ['h', 'g', 'a', 'b'], 'groups first');
  assert.deepEqual(sortWith({ by: 'created', dir: 'asc', groups: 'last' }), ['a', 'b', 'h', 'g'], 'groups last');

  // ---- password / PIN rules (the pop-up checks before asking main)
  assert.equal(K.checkNew('abc', 'abc', 'password'), 'Use at least 4 characters.');
  assert.equal(K.checkNew('abcd', 'abce', 'password'), "The two don't match.");
  assert.equal(K.checkNew('abcd', 'abcd', 'password'), null);
  assert.equal(K.checkNew('123', '123', 'pin'), 'A PIN is 4 to 12 digits.');
  assert.equal(K.checkNew('1234567890123', '1234567890123', 'pin'), 'A PIN is 4 to 12 digits.');
  assert.equal(K.checkNew('1234', '1234', 'pin'), null);
  K.set({ settings: {} });
  assert.equal(K.savedLock({ ok: false }, 'pin'), false, 'main said no: nothing remembered');
  assert.equal(K.savedLock({ ok: true }, 'pin'), true);
  assert.deepEqual([K.V.state.settings.hasPassword, K.V.state.settings.lockKind], [true, 'pin'], 'saved: the list knows a PIN is set');

  // ---- the list asks main for its data once at the start, and listens for changes
  assert.ok(K.calls.some((c) => c[0] === 'list.get') && K.calls.some((c) => c[0] === 'list.onChanged'), 'loads and listens');
  assert.ok(!K.calls.some((c) => /^(list\.(trash|destroy|emptyBin)|groups\.trash)$/.test(c[0])), 'opening the list never bins or deletes anything');
  console.log('ok');
  process.exit(0);
})();
