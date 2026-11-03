'use strict';
// Encryption in the notes list, in a real browser (tests/helpers/list-ui.js; main's side: crypt.test.js). Two starts,
// each on fresh data:
// - new-pin (1.1.30): the first PIN shows the recovery key by itself (Done needs the tick), a locked card hides its title
//   too, the title while locked from Edit design, Settings → Locked notes, "Forgot it?" with the recovery key and a
//   short new PIN (then the warning shows);
// - old-pin (1.1.31): a PIN from before the update and a note locked with it: the list asks for the PIN straight away to
//   encrypt, then shows the recovery key.
const assert = require('assert');
const app = require('./helpers/app');

if (app.phase === 'main') app.phases(__filename, [{ name: 'new-pin', fresh: true }, { name: 'old-pin', fresh: true }]);

if (app.phase === 'new-pin') {
  // ---- the notes list window (Chromium): the recovery key pop-up, Settings, the title while locked, "Forgot it?"
  (async () => {
    let A;
    const ui = await require('./helpers/list-ui')(async (seed) => {
      await seed.H['lock:set']({}, { current: '', next: '24682468', kind: 'pin' }); // not seed.password(): that skips the pop-up
      A = await seed.note({ title: 'Bank stuff secret title', html: '<div>bank pin is 1234</div>' });
      await seed.lock(A, '24682468');
    });
    const { page } = ui;
    assert.equal(await ui.modalTitle(), 'Your recovery key', 'the list shows the recovery key by itself');
    const code = (await ui.text('.rkey')).trim();
    assert.match(code, /^([0-9A-Z]{5}-){4}[0-9A-Z]{5}$/);
    await ui.click('#mOk');
    assert.ok(await ui.modalOpen() && /Tick the box/.test(await ui.text('#mErr')), 'Done needs the tick first');
    await page.locator('.rkeyok input').evaluate((x) => x.click()); await ui.click('#mOk');
    assert.ok(!(await ui.modalOpen()) && (await ui.get()).settings.crypt.keyShown, 'ticked: closed and saved');
    assert.ok(/Locked note/.test(await ui.text(ui.noteKey(A))) && !/secret title|bank pin/.test(await page.content()), 'the card hides the title too');
    // the title while locked, from Edit design on the locked card
    await ui.menu(ui.noteKey(A), 'Edit design…');
    assert.equal(await page.getAttribute('#editTitle', 'placeholder'), 'Title while locked (optional)');
    await ui.type('#editTitle', 'Bank'); await ui.key('Escape'); await ui.settle(500);
    assert.equal((await ui.get()).notes.find((n) => n.id === A).coverTitle, 'Bank', 'saved as the title while locked');
    assert.ok(/Bank/.test(await ui.text(ui.noteKey(A))), 'the card shows it');
    // Settings → Locked notes
    await ui.tab('settings');
    assert.ok(/encrypted on this computer/.test(await ui.text('#cryptInfo')));
    assert.ok(!(await ui.visible('#pinWarn')), 'an 8-digit PIN: no warning');
    assert.ok(await ui.visible('#cryptForgot') && await ui.visible('#cryptToggle') && !(await ui.visible('#cryptNow')));
    // forgot the PIN: the recovery key sets a new (short) one, and the warning shows
    await ui.click('#cryptForgot');
    await ui.modalOk(['WRONG-KEY', '1357', '1357']);
    assert.ok(await ui.modalOpen() && /25 letters/.test(await ui.text('#mErr')));
    await ui.modalOk([code, '1357', '1357']);
    assert.ok(!(await ui.modalOpen()), 'the new PIN is saved');
    assert.equal((await ui.get()).settings.lockLen, 4);
    assert.ok(await ui.visible('#pinWarn'), 'a 4-digit PIN: the warning');
    await ui.done();
    process.exit(0);
  })();
}

if (app.phase === 'old-pin') {
  // ---- the list window (Chromium): a PIN from before the update and a note locked with it → the list asks for the PIN
  // straight away, then shows the recovery key
  (async () => {
    let A;
    const ui = await require('./helpers/list-ui')(async (seed) => {
      const { S } = require('../main/state');
      const salt = 'abcdef0123456789';
      Object.assign(S.store.settings, { lock: `${salt}:${require('crypto').scryptSync('2468', salt, 32, { N: 16384, r: 8, p: 1 }).toString('hex')}`, lockKind: 'pin', lockLen: 4 });
      A = await seed.note({ title: 'Bank stuff secret title', html: '<div>bank pin is 1234</div>' });
      S.store.get(A).locked = true; S.store.writeNow(A);
    });
    const { page } = ui;
    assert.equal(await ui.modalTitle(), 'Encrypt your locked notes', 'the list asks for the PIN by itself');
    assert.equal(await page.getAttribute('#mInputs input', 'placeholder'), 'PIN');
    await ui.modalOk(['1111']);
    assert.ok(await ui.modalOpen() && (await ui.text('#mErr')) === 'Wrong PIN');
    await ui.modalOk(['2468']); await ui.settle(400);
    assert.equal(await ui.modalTitle(), 'Your recovery key', 'then the recovery key');
    await page.locator('.rkeyok input').evaluate((x) => x.click()); await ui.click('#mOk');
    assert.ok(!(await ui.modalOpen()));
    const data = await ui.get();
    assert.ok(data.settings.crypt.setUp && !data.settings.crypt.needPin, 'encrypted now');
    await ui.tab('settings');
    assert.ok(/encrypted on this computer/.test(await ui.text('#cryptInfo')));
    assert.ok(await ui.visible('#pinWarn'), 'a 4-digit PIN: the warning');
    await ui.done();
    process.exit(0);
  })();
}
