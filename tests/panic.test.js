'use strict';
// The panic button (1.3.27, main/panic.js). Off by default: nothing registered, no tray item, panic:now does nothing. On:
// the shortcut is registered (only real shortcuts: a letter needs Ctrl or Alt; F keys alone), refused when another app has
// it, let go while Settings waits for a new one; the note button / tray / shortcut close every open note except those set
// to stay open (left exactly as they are, unlocked too), lock again whatever was unlocked (Unlock all, unlocked in a
// window) and close the list. The notes come back, still locked, when CosmoNotes is opened again: the tray icon, the tray's
// "Reopen notes", a second start, or the next start (a real restart). A binned note stays in the Bin.
const assert = require('assert');
const app = require('./helpers/app');

if (app.phase === 'main') app.phases(__filename, ['first', 'second']);

const trayItem = (E, label) => (E.__tray.menu.t || []).find((x) => x.label === label);
const isOpen = (id) => !!app.winOf(id);

if (app.phase === 'first') (async () => {
  const { H, E, ev } = await app.start();
  const GS = E.globalShortcut;
  const s = async () => (await app.list()).settings;
  const welcome = app.noteWins()[0].noteId;
  const a = await app.newNote({ title: 'A' });
  const b = await app.newNote({ title: 'B (stays)' });
  const c = await app.newNote({ title: 'C (locked)' });

  // ---- off: nothing
  assert.equal((await s()).panicOn, false, 'off by default');
  assert.equal((await s()).panicKey, '', 'no shortcut until one is set (the owner)');
  assert.equal(await H['panic:now'](), 0, 'the button does nothing while it is off');
  assert.ok(isOpen(a) && isOpen(b) && isOpen(c));
  assert.deepEqual(Object.keys(GS.reg), [], 'no shortcut registered');
  assert.ok(!trayItem(E, 'Panic: hide all notes'), 'no tray item');
  await H['settings:set'](null, { panicKey: 'Alt+Z' });
  assert.deepEqual(Object.keys(GS.reg), [], 'a shortcut set while it is off is not registered');

  // ---- on: the shortcut, the tray item, the note windows told
  app.winOf(a).webContents.sentArgs = [];
  await H['settings:set'](null, { panicOn: true });
  assert.ok(GS.reg['Alt+Z'], 'the shortcut is registered');
  assert.ok(trayItem(E, 'Panic: hide all notes'), 'the tray has it');
  const told = app.sent(app.winOf(a), 'settings:changed').pop();
  assert.ok(told.panicOn && told.panicKey === 'Alt+Z', 'notes are told (their button and its tooltip)');
  // only real shortcuts
  for (const bad of ['Z', 'Shift+Z', 'Alt+Alt+Z', 'Hyper+Z', 'Alt+NoSuchKey', '']) {
    if (!bad) continue;
    await H['settings:set'](null, { panicKey: bad });
    assert.equal((await s()).panicKey, 'Alt+Z', `"${bad}" is refused`);
  }
  for (const good of ['F8', 'Ctrl+Shift+H', 'Alt+Z']) {
    await H['settings:set'](null, { panicKey: good });
    assert.ok(GS.reg[good] && Object.keys(GS.reg).length === 1, `${good} is used (and only it)`);
  }
  // another app has it
  GS.taken.add('Ctrl+Alt+P');
  await H['settings:set'](null, { panicKey: 'Ctrl+Alt+P' });
  assert.equal((await s()).panicKeyError, 'taken', 'Settings says another app has it');
  assert.deepEqual(Object.keys(GS.reg), [], 'and the old one is let go');
  await H['settings:set'](null, { panicKey: 'Alt+Z' });
  assert.equal((await s()).panicKeyError, null);
  // Settings waits for a new shortcut: the old one must not fire meanwhile
  await H['panic:capture'](null, true);
  assert.ok(!GS.reg['Alt+Z'], 'let go while a new one is pressed');
  assert.equal((await s()).panicKeyError, null, 'not shown as a problem');
  await H['panic:capture'](null, false);
  assert.ok(GS.reg['Alt+Z'], 'back afterwards');

  // ---- set up: a PIN; C locked and unlocked in its window; B stays open on panic and is unlocked too; Unlock all in the list
  await H['lock:set'](null, { next: '4321', kind: 'pin' });
  await H['note:update'](ev(app.winOf(b)), { panic: false });
  for (const id of [b, c]) {
    await H['list:set-locked']({}, id, true);
    assert.ok(await H['note:unlock'](ev(app.winOf(id)), '4321'), 'unlocked in its window');
  }
  await H['list:show']();
  assert.ok((await H['list:unlock-all'](null, '4321')).ok);
  assert.equal((await s()).unlockedAll, true);
  app.winOf(b).webContents.sentArgs = [];

  // ---- the shortcut is pressed
  GS.reg['Alt+Z']();
  await app.tick(20);
  assert.ok(!isOpen(a) && !isOpen(c) && !isOpen(welcome), 'the open notes are closed');
  assert.ok(isOpen(b), 'a note set to stay open stays');
  assert.equal(app.winOf(b).revealed, true, 'and stays unlocked (left as it is)');
  assert.equal(app.sent(app.winOf(b), 'note:lock-now').length, 0, 'it is not asked to lock');
  assert.ok(!app.listWin(), 'the notes list is closed: only the tray is left');
  assert.equal((await s()).unlockedAll, false, 'Unlock all is over');
  assert.equal((await app.card(a)).open, false, 'remembered closed');
  assert.deepEqual(app.readJSON('settings.json').panicClosed.sort(), [a, c, welcome].sort(), 'the notes it closed are remembered on disk');
  assert.ok(trayItem(E, 'Reopen notes'), 'the tray offers them back');

  // ---- the tray icon: the notes come back, the locked one locked again
  E.__tray.emit('click');
  await app.tick(20);
  assert.ok(isOpen(a) && isOpen(c) && isOpen(welcome), 'back where they were');
  assert.equal(app.winOf(c).revealed, false, 'a locked note asks for the PIN again');
  assert.equal(app.winOf(a).revealed, true, 'an unlocked one just opens');
  assert.ok(app.listWin(), 'and the list');
  assert.deepEqual((await s()).panicClosed, [], 'nothing waits any more');
  assert.ok(!trayItem(E, 'Reopen notes'), 'the tray item goes');

  // ---- from a note's own button, twice (the second press keeps the first one's notes), then quit
  await H['panic:now']();
  assert.equal(await H['panic:now'](), 0, 'nothing more to close');
  assert.deepEqual(app.readJSON('settings.json').panicClosed.sort(), [a, c, welcome].sort(), 'still all three');
  app.hand({ a, b, c, welcome });
  E.app.quit();
  assert.deepEqual(Object.keys(GS.reg), [], 'quitting gives the shortcut back to Windows');
  E.__all.forEach((w) => w.close());
  await app.tick(20);
  process.exit(0);
})();

if (app.phase === 'second') (async () => {
  const { H, E } = await app.start();
  const GS = E.globalShortcut;
  const s = async () => (await app.list()).settings;
  const { a, b, c, welcome } = app.hand();
  // ---- the next start brings them back (B was never closed: it opens as an open note)
  assert.ok(isOpen(a) && isOpen(b) && isOpen(c) && isOpen(welcome), 'all four open again');
  assert.equal(app.winOf(c).revealed, false, 'the locked one locked');
  assert.deepEqual((await s()).panicClosed, [], 'nothing waits');
  assert.ok(GS.reg['Alt+Z'], 'the shortcut is registered at start');

  // ---- starting CosmoNotes again (second instance)
  await H['panic:now']();
  assert.ok(!isOpen(a) && isOpen(b));
  E.app.emit('second-instance');
  await app.tick(20);
  assert.ok(isOpen(a) && isOpen(c), 'a second start brings them back');

  // ---- the tray's "Reopen notes": a note binned meanwhile stays in the Bin
  await H['panic:now']();
  await H['list:trash']({}, a);
  trayItem(E, 'Reopen notes').click();
  await app.tick(20);
  assert.ok(!isOpen(a), 'a binned note is not opened');
  assert.ok(isOpen(c) && isOpen(welcome), 'the others are');

  // ---- turned off: shortcut and tray item gone, the button does nothing
  await H['settings:set'](null, { panicOn: false });
  assert.deepEqual(Object.keys(GS.reg), [], 'shortcut let go');
  assert.ok(!trayItem(E, 'Panic: hide all notes'), 'tray item gone');
  assert.equal(await H['panic:now'](), 0);
  assert.ok(isOpen(c), 'nothing closed');
  assert.equal((await s()).panicKey, 'Alt+Z', 'the shortcut is kept for when it is turned on again');
  await app.quit();
})();
