'use strict';
// Reminders (1.4.1), in the main process (the rules themselves: src/reminders.js, checked first; the panel and the strip in
// a window: note-ui.test.js, list-ui-cards.test.js): what is saved and cleaned, a reminder going off (the window opens on
// the monitor with the mouse, stays on top and flashes while it rings, plays its sound), Snooze and Done, missed ones
// (the PC was off), repeats, hiding a note until it goes off (desktop and list), Settings → Reminders, and a locked note
// (its messages are secret and sealed; Snooze / Done without the PIN only when the reminder allows it).
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const app = require('./helpers/app');
const R = require('../src/reminders');

const H0 = 3600e3;
const local = (y, m, d, h, mi = 0) => new Date(y, m - 1, d, h, mi).getTime();

// ---- the rules (no app needed)
{
  // cleaning: bad ones go, the rest keeps only what it may have
  const ok = R.cleanAll([{ id: 'abcd1', start: 1e12 }, { id: 'BAD!', start: 1e12 }, { id: 'abcd1', start: 2e12 }, { id: 'nostart' }, null,
    { id: 'abcd2', start: 1e12, repeat: { k: 'week', days: [] } }, { id: 'abcd3', start: 1e12, repeat: { k: 'every', u: 'min', n: 1 }, sound: 'rain', evil: 1, snooze: 5, firing: false }]);
  assert.deepEqual(ok.map((r) => r.id), ['abcd1', 'abcd2', 'abcd3'], 'bad ids, doubles and ones with no time go');
  assert.equal(ok[0].at, 1e12, 'at = the time picked');
  assert.equal(ok[1].repeat, null, 'a weekly repeat with no days is no repeat');
  assert.equal(ok[2].repeat.n, R.MIN_EVERY.min, 'every N minutes: at least 5');
  assert.equal(ok[2].sound, 'rain'); assert.ok(!('evil' in ok[2]));
  assert.equal(R.cleanAll(Array.from({ length: 40 }, (x, i) => ({ id: `n${1000 + i}`, start: 1e12 }))).length, R.MAX, 'at most 30 on a note');
  assert.deepEqual(R.cleanMsgs({ abcd1: '  hi  ', zzzz9: 'gone', abcd2: '   ' }, ok), { abcd1: 'hi' }, 'messages only for reminders that are there, never empty');

  // repeats keep their clock time; weekdays skip the weekend; a month with no 31st takes its last day; DST keeps 09:00
  const wd = R.cleanOne({ id: 'wday1', start: local(2026, 11, 14, 9), repeat: { k: 'weekdays' } }); // a Saturday
  assert.equal(R.firstAt(wd), local(2026, 11, 16, 9), 'weekdays picked on a Saturday: Monday first');
  const mo = R.cleanOne({ id: 'mont1', start: local(2026, 1, 31, 8), repeat: { k: 'month' } });
  assert.equal(R.ring(mo, local(2026, 1, 31, 8, 1)).at, local(2026, 2, 28, 8), 'Jan 31st → Feb 28th');
  const dst = R.cleanOne({ id: 'dst01', start: local(2026, 3, 28, 9), repeat: { k: 'day' } });
  assert.equal(new Date(R.ring(dst, local(2026, 3, 28, 9)).at).getHours(), 9, 'daily 09:00 stays 09:00 after the clock change');
  // a repeat that missed several times (the PC was off) rings once, for the latest, and goes on from the next one
  const wk = R.cleanOne({ id: 'week1', start: local(2026, 11, 16, 9), repeat: { k: 'week', days: [1, 4] } });
  const rung = R.ring(wk, local(2026, 11, 27, 12));
  assert.equal(rung.firedAt, local(2026, 11, 26, 9), 'the latest one it missed (Thursday)');
  assert.equal(rung.at, local(2026, 11, 30, 9), 'then next Monday');
  assert.ok(rung.firing && rung.late && rung.count === 4, 'ringing, late, four times so far');
  assert.equal(R.line(rung, local(2026, 11, 27, 12)), 'Missed yesterday at 09:00 · Every Mon, Thu');
  // 1.4.19: a repeat set to the second (Settings → Show seconds) keeps its seconds; the words: the day, where it is
  const sec = R.cleanOne({ id: 'secs1', start: local(2026, 11, 16, 9) + 42000, repeat: { k: 'week', days: [1] } });
  assert.equal(R.ring(sec, local(2026, 11, 16, 9, 1)).at, local(2026, 11, 23, 9) + 42000, 'next Monday 09:00:42');
  assert.equal(R.dayWord(local(2026, 11, 17, 9), local(2026, 11, 16, 20)), 'Tomorrow');
  assert.equal(R.dayWord(local(2026, 11, 20, 9), local(2026, 11, 16, 20)), 'Fri 20 Nov');
  assert.equal(R.status(rung, local(2026, 11, 27, 12)), 'Missed yesterday at 09:00', 'where it is, without the repeat');
  // every N minutes, N times; Done ends a one-off and a repeat that has ended
  let ev = R.cleanOne({ id: 'evry1', start: 1e12, repeat: { k: 'every', u: 'min', n: 20, times: 2 } });
  ev = R.ring(ev, 1e12 + 1000);
  assert.equal(ev.at, 1e12 + 20 * 60e3);
  assert.ok(!ev.late, 'a second late is on time');
  ev = R.ring(R.done(ev), ev.at);
  assert.equal(ev.at, null, 'the second of two: no more after it');
  assert.equal(R.done(ev), null, 'Done on the last one: it goes');
  assert.equal(R.done(R.ring(R.cleanOne({ id: 'once1', start: 1e12 }), 1e12)), null, 'Done on a one-off: it goes');
  // a one-off that rings doesn't ring again by itself; Snooze moves only this time
  const one = R.ring(R.cleanOne({ id: 'once2', start: 1e12 }), 1e12);
  assert.equal(R.dueAt(one), Infinity, 'it waits for Snooze or Done');
  const sn = R.snooze(one, 10, 1e12 + 5000);
  assert.equal(R.dueAt(sn), 1e12 + 5000 + 10 * 60e3); assert.ok(!sn.firing);
  assert.equal(R.snooze(one, 'tomorrow', local(2026, 11, 14, 23)).snooze, local(2026, 11, 15, 9), 'Snooze until tomorrow 09:00');
  const rsn = R.ring(R.snooze(R.ring(wk, local(2026, 11, 16, 9)), 10, local(2026, 11, 16, 9)), local(2026, 11, 16, 9, 10));
  assert.equal(rsn.at, local(2026, 11, 19, 9), 'a snoozed repeat keeps its next time');
  // hiding: a reminder with hide on, and none ringing
  assert.ok(R.hiddenNow([{ hide: true, firing: false }]));
  assert.ok(!R.hiddenNow([{ hide: true, firing: false }, { hide: false, firing: true }]), 'one rings: it shows');
}

(async () => {
  const { H, E, ev: evOf, tick } = await app.start();
  const RM = require(path.join(app.ROOT, 'main', 'reminders.js'));
  const now = Date.now();
  const id = await app.newNote({ html: '<p>Buy milk</p>' });
  let w = app.winOf(id);
  await H['note:get'](evOf(w)); // the page loaded (it asks for its note first)

  // ---- saving from the note's window: cleaned, the message kept, not an edit
  const before = (await app.card(id)).updatedAt;
  let v = await H['remind:set'](evOf(w), [{ id: 'milk1', start: now + H0, sound: 'birds', firing: true, count: 9 }, { id: 'x' }], { milk1: 'Get milk', nope: 'x' });
  assert.equal(v.reminders.length, 1); assert.equal(v.reminders[0].at, now + H0);
  assert.ok(!v.reminders[0].firing && v.reminders[0].count === 0, 'a window can only set the time, repeat, sound, hide, unlock');
  assert.deepEqual(v.remindMsg, { milk1: 'Get milk' });
  assert.equal((await app.card(id)).updatedAt, before, 'a reminder is not an edit');
  let card = await app.card(id);
  assert.equal(card.reminders.length, 1); assert.equal(card.remindMsg, undefined, 'the list gets no messages with the cards');
  assert.deepEqual((await H['list:remind-get']({}, id)).msgs, { milk1: 'Get milk' }, '…only when it opens a note’s reminders');

  // ---- it goes off: on top, flashing, its sound; the window hears it
  assert.equal(w.top, false);
  RM.check(now + H0 + 500);
  let n = await H['note:get'](evOf(w));
  assert.ok(n.reminders[0].firing && !n.reminders[0].late, 'ringing, on time');
  assert.equal(w.top, true, 'on top while it rings'); assert.equal(w.flashing, true, 'the taskbar button flashes');
  assert.deepEqual(app.sent(w, 'remind:ring').pop(), ['milk1'], 'the window plays it');
  assert.ok(app.lastLook(w).reminders[0].firing, 'the window gets the change');
  RM.check(now + H0 + 60e3);
  assert.equal(app.sent(w, 'remind:ring').length, 1, 'a one-off that rings doesn’t ring again by itself');

  // ---- Snooze 10, then it rings again; Done: it goes, the note is back to normal
  assert.equal(await H['remind:act'](evOf(w), 'milk1', 'snooze', 10), true);
  n = await H['note:get'](evOf(w));
  assert.ok(!n.reminders[0].firing && n.reminders[0].snooze > Date.now()); assert.equal(w.top, false); assert.equal(w.flashing, false);
  RM.check(n.reminders[0].snooze + 1);
  assert.equal(app.sent(w, 'remind:ring').length, 2, 'the snooze ended: it rings again');
  assert.equal(await H['remind:act'](evOf(w), 'nope1', 'done'), false, 'an unknown one: nothing');
  assert.equal(await H['remind:act'](evOf(w), 'milk1', 'done'), true);
  n = await H['note:get'](evOf(w));
  assert.deepEqual(n.reminders, []); assert.deepEqual(n.remindMsg, {}, 'its message goes with it');
  assert.equal(w.top, false, 'not on top any more (it isn’t pinned)');

  // ---- missed: the PC was off; it rings when CosmoNotes sees it, "Missed at …"
  await H['remind:set'](evOf(w), [{ id: 'late1', start: now + 2 * H0 }], {});
  RM.check(now + 5 * H0);
  n = await H['note:get'](evOf(w));
  assert.ok(n.reminders[0].firing && n.reminders[0].late && n.reminders[0].firedAt === now + 2 * H0, 'missed');
  await H['remind:act'](evOf(w), 'late1', 'done');

  // ---- hiding: the window closes and the note leaves the list (unless Settings shows it); it comes back when it rings
  await H['note:update'](evOf(w), { pinned: true });
  v = await H['remind:set'](evOf(w), [{ id: 'hide1', start: now + 3 * H0, hide: true }], {});
  await tick(5);
  assert.ok(w.destroyed, 'its window closed');
  card = await app.card(id);
  assert.equal(card.remHidden, true); assert.equal(card.open, false);
  // where it pops up: on the monitor with the mouse. Its old place is on the other monitor: that monitor's top-right corner
  E.__displays = [{ workArea: { x: 0, y: 0, width: 1920, height: 1040 } }, { workArea: { x: 1920, y: 0, width: 1280, height: 1000 } }];
  E.__cursor = { x: 2400, y: 500 };
  RM.check(now + 3 * H0 + 10);
  await tick(5);
  w = app.winOf(id);
  assert.ok(w && !w.destroyed, 'it opened when it rang');
  assert.equal(w.bounds.x + w.bounds.width, 1920 + 1280 - 16, 'top-right corner of the mouse’s monitor'); assert.equal(w.bounds.y, 16);
  assert.equal((await app.card(id)).remHidden, false, 'ringing: it shows');
  n = await H['note:get'](evOf(w));
  assert.deepEqual(n.ring, ['hide1'], 'a window that opened for it plays it once it has loaded');
  assert.deepEqual((await H['note:get'](evOf(w))).ring, [], '…only once');
  await H['remind:act'](evOf(w), 'hide1', 'done');
  assert.ok(!w.destroyed && w.top === true, 'done: it stays open (and pinned, it is on top as before)');
  // a note on the mouse's monitor stays where it is
  w.setPosition(2100, 200);
  await tick(50); // the place is remembered
  await H['remind:set'](evOf(w), [{ id: 'hide2', start: now + 4 * H0, hide: true }], {});
  await tick(5);
  RM.check(now + 4 * H0 + 10);
  await tick(5);
  w = app.winOf(id);
  assert.deepEqual([w.bounds.x, w.bounds.y], [2100, 200], 'already on the mouse’s monitor: where it was');
  await H['remind:act'](evOf(w), 'hide2', 'done');
  E.__displays = null;

  // ---- the list: changes refused for a note its lock hides; a repeat that ended (Done) goes
  const id2 = await app.newNote({ html: '<p>Two</p>' });
  let lr = await H['list:remind-set']({}, id2, [{ id: 'wk001', start: local(2030, 1, 7, 9), repeat: { k: 'weekdays' } }], { wk001: 'Stand-up' });
  assert.equal(lr.reminders[0].at, local(2030, 1, 7, 9)); assert.deepEqual(lr.msgs, { wk001: 'Stand-up' });
  // the same time and repeat again (only the sound changed): it keeps its state
  RM.check(local(2030, 1, 7, 9, 0) + 500);
  lr = await H['list:remind-set']({}, id2, [{ ...lr.reminders[0], sound: 'bowl' }], lr.msgs);
  assert.ok(lr.reminders[0].firing && lr.reminders[0].sound === 'bowl', 'still ringing, new sound');
  lr = await H['list:remind-set']({}, id2, [{ ...lr.reminders[0], start: local(2030, 1, 8, 10) }], lr.msgs);
  assert.ok(!lr.reminders[0].firing && lr.reminders[0].at === local(2030, 1, 8, 10), 'a new time starts again');

  // ---- Settings → Reminders, cleaned, and sent to the notes
  await H['settings:set']({}, { remindSound: 'evil', remindVolume: 7, remindShowHidden: 1 });
  let s = (await app.list()).settings;
  assert.equal(s.remindSound, R.DEFAULT_SOUND); assert.equal(s.remindVolume, 1); assert.equal(s.remindShowHidden, true);
  await H['settings:set']({}, { remindSound: 'crickets', remindVolume: 0.33 });
  s = (await H['note:get'](evOf(w))).settings;
  assert.equal(s.remindSound, 'crickets'); assert.equal(s.remindVolume, 0.35, 'steps of 5 %');
  assert.equal(s.remindSeconds, false, '1.4.19: Show seconds is off at first');
  await H['settings:set']({}, { remindSeconds: 'yes' });
  assert.equal((await app.list()).settings.remindSeconds, true);
  assert.equal((await H['note:get'](evOf(w))).settings.remindSeconds, true, 'the notes get it (their panel’s time box)');
  await H['settings:set']({}, { remindSeconds: false });
  s = (await H['note:get'](evOf(w))).settings;
  assert.ok(s.remindAutoNext === true && s.remindHide === false, '1.4.20: Jump to the next box on, Hiding notes off, at first');
  await H['settings:set']({}, { remindAutoNext: 0, remindHide: 'on' });
  s = (await H['note:get'](evOf(w))).settings;
  assert.ok(s.remindAutoNext === false && s.remindHide === true, 'both cleaned, and sent to the notes');
  await H['settings:set']({}, { remindAutoNext: true, remindHide: false });

  // ---- a locked note: its messages are secret; Snooze / Done without the PIN only when the reminder allows it
  await H['remind:set'](evOf(w), [{ id: 'sec01', start: now + 6 * H0, unlock: true }, { id: 'sec02', start: now + 6 * H0 }], { sec01: 'bank pin 4321', sec02: 'call mum' });
  assert.ok((await H['lock:set'](null, { next: '2580', kind: 'pin' })).ok);
  n = await H['note:set-locked'](evOf(w), true);
  assert.equal(n.hidden, true); assert.equal(n.remindMsg, null, 'a hidden window gets no messages');
  assert.equal(n.reminders.length, 2, '…but it knows its reminders (it shows Snooze / Done)');
  await H['note:relock'](evOf(w));
  await tick(30);
  const file = app.read(`notes/${id}.json`);
  assert.ok(!file.includes('bank pin') && !file.includes('call mum') && JSON.parse(file).enc, 'the messages are sealed on disk');
  assert.equal(JSON.parse(file).reminders.length, 2, 'the times stay readable (main needs them before the PIN)');
  assert.equal(await H['list:remind-get']({}, id), null, 'the list can’t open them');
  assert.equal(await H['list:remind-set']({}, id, [], {}), null, '…nor change them');
  assert.equal((await H['remind:set'](evOf(w), [], {})).error, 'hidden', 'nor can its hidden window');
  RM.check(now + 6 * H0 + 10);
  assert.equal(await H['remind:act'](evOf(w), 'sec01', 'done'), false, 'this one asks for the PIN first');
  assert.equal(await H['remind:act'](evOf(w), 'sec02', 'done'), true, 'this one doesn’t');
  n = await H['note:unlock'](evOf(w), '2580');
  assert.deepEqual(n.remindMsg, { sec01: 'bank pin 4321' }, 'unlocked: the message is there again');
  assert.equal(await H['remind:act'](evOf(w), 'sec01', 'done'), true);

  // ---- waking up checks at once; a note in the Bin doesn't ring
  await H['remind:set'](evOf(w), [{ id: 'wake1', start: Date.now() - 1000 }], {});
  n = await H['note:get'](evOf(w));
  assert.ok(n.reminders[0].firing, 'a time that has passed rings at once');
  await H['remind:act'](evOf(w), 'wake1', 'done');
  await H['list:remind-set']({}, id2, [{ id: 'bin01', start: now + 7 * H0 }], {});
  await H['list:trash']({}, id2);
  RM.check(now + 7 * H0 + 10);
  assert.ok(!app.winOf(id2), 'in the Bin: nothing opens');
  assert.ok(typeof E.powerMonitor.listenerCount === 'function' && E.powerMonitor.listenerCount('resume') === 1, 'it listens for the PC waking up');
  assert.ok(fs.existsSync(path.join(app.DATA, 'notes', `${id2}.json`)));

  await app.quit();
})();
