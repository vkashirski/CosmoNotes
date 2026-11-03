'use strict';
// Settings, in the main process (Settings in the list → settings:set): only known values are kept and saved; open notes
// are told. The list's colour theme (and the notes' pop-ups follow it), card size and sort, see-through and "solid
// while the mouse is over it" for new notes, spelling (Cyrillic off by default). Effects settings: effects-settings.test.js.
const assert = require('assert');
const app = require('./helpers/app');

(async () => {
  const { H, E, ev } = await app.start();
  const s = async () => (await app.list()).settings;
  const w = app.noteWins()[0];

  // ---- the list's colour theme: only known ones; the notes' pop-ups follow it
  assert.equal((await s()).listTheme, 'cream', 'cream to begin with');
  await H['settings:set'](null, { listTheme: 'night' });
  assert.equal((await s()).listTheme, 'night');
  await H['settings:set'](null, { listTheme: 'midnight' });
  assert.equal((await s()).listTheme, 'midnight', 'the dark themes are allowed');
  await H['settings:set'](null, { listTheme: 'night' });
  await H['settings:set'](null, { listTheme: 'neon-green' });
  assert.equal((await s()).listTheme, 'night', 'unknown themes are ignored');
  assert.equal(app.readJSON('settings.json').listTheme, 'night', 'saved to disk');
  w.webContents.sentArgs = [];
  await H['settings:set'](null, { listTheme: 'forest' });
  assert.ok(app.sent(w, 'settings:changed').some((x) => x.appTheme === 'forest'), 'notes get the theme');

  // ---- card size and sorting
  await H['settings:set'](null, { listSize: 'l' });
  assert.equal((await s()).listSize, 'l');
  await H['settings:set'](null, { listSize: 'huge' });
  assert.equal((await s()).listSize, 'l', 'unknown size ignored');
  await H['settings:set'](null, { listSort: { by: 'created', dir: 'asc', groups: 'first', junk: 1 } });
  assert.deepEqual((await s()).listSort, { by: 'created', dir: 'asc', groups: 'first' }, 'only the known parts of the sort are kept');

  // ---- see-through for new notes: 5 % steps, at least 25 %
  assert.equal((await s()).defaultOpacity, 1);
  await H['settings:set'](null, { defaultOpacity: 0.62 });
  assert.equal((await s()).defaultOpacity, 0.6, 'rounded to 5% steps');
  await H['settings:set'](null, { defaultOpacity: 0.05 });
  assert.equal((await s()).defaultOpacity, 0.25, 'never less than 25%');
  await H['settings:set'](null, { defaultOpacity: 0.7 });
  let id = await app.newNote();
  assert.equal((await H['note:get'](ev(app.winOf(id)))).opacity, 0.7, 'a new note starts see-through as set');
  await H['settings:set'](null, { defaultOpacity: 1 });

  // ---- "turn solid when my mouse is over it" for new notes (1.1.12)
  assert.equal((await s()).defaultSolidOnHover, true, 'on by default');
  await H['settings:set'](null, { defaultSolidOnHover: false });
  assert.equal((await s()).defaultSolidOnHover, false);
  id = await app.newNote();
  assert.equal((await H['note:get'](ev(app.winOf(id)))).solidOnHover, false, 'a new note follows the setting');
  await H['settings:set'](null, { defaultSolidOnHover: true });
  id = await app.newNote();
  assert.equal((await H['note:get'](ev(app.winOf(id)))).solidOnHover, true);

  // ---- spelling: English only to begin with; Cyrillic only when asked for
  assert.deepEqual(E.__langs, ['en-US'], 'Cyrillic ignored by default');
  assert.equal((await H['note:get'](ev(w))).settings.spellCheck, false);
  await H['settings:set'](null, { spellCheck: true, spellCyrillic: true });
  assert.deepEqual(E.__langs, ['en-US', 'sr', 'bg', 'ru', 'uk']);
  console.log('ok');
  process.exit(0);
})();
