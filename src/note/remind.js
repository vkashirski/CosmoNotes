'use strict';
// CosmoNotes note window, part 12 of 16 (1.4.1): reminders. Add → Reminder opens the panel on a new one (src/remind-ui.js,
// the same as the notes list's); 1.4.19: a chip at the bottom of the note shows the next one, and opens it. A reminder that goes off shows a strip under the top bar with its message (or "Missed at …") and
// Snooze / Done, the note glows until then, wobbles once and plays its sound (main sends remind:ring; one that went off
// while this window was loading comes in note:get as `ring`). What rings is read from the note (V.note.reminders), so the
// strip is right after a restart too. A locked note shows no message until it is unlocked, and Snooze / Done wait for the
// PIN when that reminder asks for it (main/reminders.js checks the same).
(() => {
  const K = window.COSMO_NOTE_KIT;
  const { V, api, $, body, saveNow, openPop, closePop } = K;
  // defined in a later part:
  const toast = K.later('toast');
  const R = window.COSMO_REMIND;
  const UI = window.COSMO_REMIND_UI;
  let panel = null;
  let shown = null; // the id of the reminder the strip shows

  // ---- the panel: Add → Reminder ('new'), the chip ('mine': the one there is, or the list of them)
  async function openRemind(start = 'new') {
    if (!R || !UI || V.hidden) return;
    await saveNow(); // a reminder that hides the note closes its window: what was typed is saved first
    panel = UI.editor({
      reminders: V.note.reminders || [],
      msgs: V.note.remindMsg || {},
      locked: !!V.note.lockedBy,
      settings: V.settings,
      start,
      close: () => closePop('#remPop'),
      done: (text) => toast(text),
      save: async (list, msgs) => {
        await saveNow();
        const n = await api.remindSet(list, msgs);
        if (!n || n.error) return null; // the panel says it couldn't
        V.note.reminders = n.reminders;
        V.note.remindMsg = n.remindMsg;
        paintRemind();
        return { reminders: n.reminders, msgs: n.remindMsg || {} };
      },
    });
    $('#remPop').style.setProperty('--rm-h', `${panel.height}px`); // 1.4.20: its rows decide its one size
    $('#remHere').replaceChildren(panel.el);
    openPop('#remPop');
  }

  // ---- 1.4.19: the chip with the next reminder (not on a hidden locked note: nothing of it shows there)
  function paintChip() {
    const chip = $('#remChip');
    const list = R && V.note && !V.hidden ? (V.note.reminders || []).filter((r) => !r.firing) : [];
    const next = list.filter((r) => Number.isFinite(R.dueAt(r))).sort((a, b) => R.dueAt(a) - R.dueAt(b))[0];
    chip.hidden = !next;
    if (!next) return;
    const t = R.dueAt(next);
    chip.innerHTML = `${next.repeat ? UI.ICON.rep : UI.ICON.bell}<span></span>${list.length > 1 ? `<span class="more">+${list.length - 1}</span>` : ''}`;
    chip.querySelector('span').textContent = next.snooze ? `Snoozed until ${R.when(t)}` : R.when(t);
    chip.title = list.map((r) => R.line(r)).join('\n');
  }
  $('#remChip').addEventListener('click', () => { if (!$('#remPop').hidden) closePop('#remPop'); else openRemind('mine'); });
  window.addEventListener('focus', paintChip); // "Tomorrow" becomes "Today" overnight (no clock in a window: main keeps the one)

  // ---- the strip, the glow
  function paintRemind() {
    const list = R && V.note ? V.note.reminders || [] : [];
    const ring = R ? R.ringing(list) : [];
    const bar = $('#remBar');
    body.classList.toggle('ringing', ring.length > 0);
    if (panel && !$('#remPop').hidden) panel.refresh({ reminders: list, msgs: V.note.remindMsg || {} });
    paintChip();
    if (!ring.length) { bar.hidden = true; shown = null; $('#remMenu').hidden = true; return; }
    const r = ring.find((x) => x.id === shown) || ring[0];
    shown = r.id;
    const msg = !V.hidden && V.note.remindMsg ? V.note.remindMsg[r.id] : '';
    $('#remWhen').textContent = r.late && r.firedAt ? R.missed(r.firedAt) : 'Reminder';
    $('#remMsg').textContent = msg || (V.hidden ? '' : R.repeatText(r.repeat, r.start));
    $('#remMsg').hidden = !$('#remMsg').textContent;
    $('#remMore').textContent = ring.length > 1 ? `+${ring.length - 1} more` : '';
    const wait = V.hidden && r.unlock; // a locked note whose reminder asks for the PIN
    for (const b of [$('#remSnooze'), $('#remSnoozeMore'), $('#remDone')]) b.disabled = wait;
    $('#remLockHint').hidden = !wait;
    bar.hidden = false;
  }
  function ringNow(ids) {
    paintRemind();
    if (!R || !UI || !ids || !ids.length) return;
    const r = (V.note.reminders || []).find((x) => ids.includes(x.id));
    if (!r) return;
    shown = r.id;
    paintRemind();
    UI.play(UI.soundOf(r, V.settings), V.settings.remindVolume ?? 0.6);
    body.classList.remove('wobble');
    void body.offsetWidth;
    body.classList.add('wobble');
    setTimeout(() => body.classList.remove('wobble'), 900);
  }
  api.onRemindRing((ids) => ringNow(ids));
  async function act(what, mins) {
    $('#remMenu').hidden = true;
    if (!shown) return;
    const ok = await api.remindAct(shown, what, mins);
    if (!ok && V.hidden) toast('Unlock the note first');
    // main sends the note's new reminders (note:look) or closes the window when a reminder hides it again
  }
  $('#remSnooze').addEventListener('click', () => act('snooze', 10));
  $('#remDone').addEventListener('click', () => act('done'));
  $('#remSnoozeMore').addEventListener('click', () => { $('#remMenu').hidden = !$('#remMenu').hidden; });
  for (const b of document.querySelectorAll('#remMenu [data-m]')) b.addEventListener('click', () => act('snooze', b.dataset.m === 'tomorrow' ? 'tomorrow' : Number(b.dataset.m)));
  document.addEventListener('mousedown', (e) => { if (!e.target.closest('#remMenu, #remSnoozeMore')) $('#remMenu').hidden = true; });

  Object.assign(K, { openRemind, paintRemind, ringNow });
})();
