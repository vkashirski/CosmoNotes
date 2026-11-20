'use strict';
/*
 * CosmoNotes - reminders (1.4.1, the owner's wish): a note can have reminders. At their time the note pops up on the
 * monitor you're using, wobbles and glows, plays a soft sound and shows Snooze / Done. A reminder can hide its note
 * (from the desktop and the notes list) until it goes off.
 * The rules live here, once: main keeps the one clock (main/reminders.js), store.js cleans what is saved, and both windows
 * use the same words (window.COSMO_REMIND). Times are milliseconds; a repeat keeps the local clock time of `start`.
 *
 * A reminder, as saved in note.reminders (its message is note.remindMsg[id]: secret, sealed with a locked note):
 *   id      letters and digits
 *   start   the time first picked; a repeat goes off at its clock time (09:00 stays 09:00 after a clock change)
 *   at      the next time it goes off; null = a repeat that has ended (it goes when you press Done)
 *   repeat  null, or { k: 'day' | 'weekdays' | 'week' | 'month' | 'every', days: [0-6] (week: 0 = Sunday),
 *           n + u: every n 'min' | 'hour' | 'day' | 'week' (every), until: last day (ms) or null, times: how many or null }
 *   sound   null = the one in Settings, 'none', or an id of SOUNDS
 *   hide    the note hides until this goes off; unlock: a locked note must be unlocked to Snooze or Done it
 *   target  'note' (later: a checklist line)
 *   firing  it went off and waits for Snooze or Done; firedAt: the time it went off for; late: that was over a minute ago
 *           (the PC was off or asleep, or CosmoNotes was closed: "Missed at 14:00")
 *   snooze  the time a snooze ends, or null; count: how many times it went off (for `times`)
 */
(function (root) {
  const LATE = 60e3; // later than this = "Missed at …"
  const MAX = 30; // reminders on one note
  const MSG_MAX = 500;
  const KINDS = ['day', 'weekdays', 'week', 'month', 'every'];
  const UNITS = { min: 60e3, hour: 3600e3, day: 0, week: 0 };
  const UNIT_NAMES = { min: ['minute', 'minutes'], hour: ['hour', 'hours'], day: ['day', 'days'], week: ['week', 'weeks'] };
  const MIN_EVERY = { min: 5, hour: 1, day: 1, week: 1 };
  const SNOOZES = [5, 10, 30, 60]; // minutes; and 'tomorrow' (09:00)
  // the sounds (made by src/remind-ui.js, with no files): soft and calm, from nature
  const SOUNDS = [
    { id: 'drops', name: 'Water drops' }, { id: 'chime', name: 'Wind chime' }, { id: 'birds', name: 'Morning birds' },
    { id: 'stream', name: 'Stream' }, { id: 'rain', name: 'Soft rain' }, { id: 'waves', name: 'Waves' },
    { id: 'bowl', name: 'Singing bowl' }, { id: 'bamboo', name: 'Bamboo' }, { id: 'crickets', name: 'Crickets' },
    { id: 'breeze', name: 'Breeze' },
  ];
  const SOUND_IDS = SOUNDS.map((s) => s.id);
  const DEFAULT_SOUND = 'drops';
  const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const num = (v) => (v === null || v === undefined || v === '' ? NaN : Number(v));
  const time = (v) => { const x = num(v); return Number.isFinite(x) && x > 0 ? Math.round(x) : null; };
  const int = (v, lo, hi) => { const x = Math.round(num(v)); return Number.isFinite(x) ? Math.min(hi, Math.max(lo, x)) : null; };

  // ---------------------------------------------------------------- cleaning what is saved (store.js normalize)
  function cleanRepeat(p) {
    if (!p || typeof p !== 'object' || !KINDS.includes(p.k)) return null;
    const out = { k: p.k };
    if (p.k === 'week') {
      const days = [...new Set((Array.isArray(p.days) ? p.days : []).map((d) => int(d, 0, 6)).filter((d) => d !== null))].sort();
      if (!days.length) return null;
      out.days = days;
    }
    if (p.k === 'every') {
      if (!(p.u in UNITS)) return null;
      out.u = p.u;
      out.n = int(p.n, MIN_EVERY[p.u], 999) || MIN_EVERY[p.u];
    }
    out.until = time(p.until);
    out.times = int(p.times, 1, 9999);
    return out;
  }
  function cleanOne(r) {
    if (!r || typeof r !== 'object' || typeof r.id !== 'string' || !/^[a-z0-9]{4,24}$/.test(r.id)) return null;
    const start = time(r.start) || time(r.at);
    if (!start) return null;
    const repeat = cleanRepeat(r.repeat);
    const at = r.at === null && repeat ? null : time(r.at) || start;
    const firing = !!r.firing;
    return {
      id: r.id,
      start,
      at,
      repeat,
      sound: r.sound === 'none' || SOUND_IDS.includes(r.sound) ? r.sound : null,
      hide: !!r.hide,
      unlock: !!r.unlock,
      target: 'note',
      firing,
      firedAt: firing ? time(r.firedAt) : null,
      late: firing && !!r.late,
      snooze: firing ? null : time(r.snooze),
      count: int(r.count, 0, 1e6) || 0,
    };
  }
  function cleanAll(list) {
    const out = [];
    const seen = new Set();
    for (const r of Array.isArray(list) ? list : []) {
      const c = cleanOne(r);
      if (!c || seen.has(c.id) || out.length >= MAX) continue;
      seen.add(c.id);
      out.push(c);
    }
    return out;
  }
  // the messages: { id: text } for reminders that are there, never empty
  function cleanMsgs(m, list) {
    const out = {};
    if (!m || typeof m !== 'object') return out;
    const ids = new Set((list || []).map((r) => r.id));
    for (const [id, t] of Object.entries(m)) {
      if (!ids.has(id) || typeof t !== 'string') continue;
      const s = t.replace(/\r\n?/g, '\n').trim().slice(0, MSG_MAX);
      if (s) out[id] = s;
    }
    return out;
  }
  const newId = () => (Date.now().toString(36) + Math.random().toString(36).slice(2, 8)).slice(-14);

  // ---------------------------------------------------------------- times
  const dayOf = (t) => { const d = new Date(t); return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 864e5; };
  const daysIn = (y, m) => new Date(y, m + 1, 0).getDate();
  // does a repeat go off on the local day of c (at start's clock time)?
  function onDay(rep, start, c) {
    const d = new Date(c);
    const gap = dayOf(c) - dayOf(start);
    switch (rep.k) {
      case 'day': return true;
      case 'weekdays': return d.getDay() >= 1 && d.getDay() <= 5;
      case 'week': return rep.days.includes(d.getDay());
      case 'month': return d.getDate() === Math.min(new Date(start).getDate(), daysIn(d.getFullYear(), d.getMonth()));
      case 'every': return rep.u === 'day' ? gap % rep.n === 0 : gap % (7 * rep.n) === 0;
      default: return false;
    }
  }
  // the first time a repeat goes off at or after t (null = none: it has ended)
  function nextFrom(r, t, count = r.count) {
    const rep = r.repeat;
    if (!rep || (rep.times && count >= rep.times)) return null;
    let out = null;
    if (rep.k === 'every' && UNITS[rep.u]) {
      const step = rep.n * UNITS[rep.u];
      out = t <= r.start ? r.start : r.start + Math.ceil((t - r.start) / step) * step;
    } else {
      const s = new Date(r.start);
      const from = new Date(Math.max(t, r.start));
      for (let i = 0; i < 3700 && out === null; i++) {
        const c = new Date(from.getFullYear(), from.getMonth(), from.getDate() + i, s.getHours(), s.getMinutes(), s.getSeconds()).getTime();
        if (c >= t && c >= r.start && onDay(rep, r.start, c)) out = c;
      }
    }
    return out !== null && rep.until && out > rep.until ? null : out;
  }
  // the first time of a reminder just picked: a repeat goes off on its first day that fits (weekdays picked on a Saturday: Monday)
  const firstAt = (r) => (r.repeat ? nextFrom({ ...r, count: 0 }, r.start, 0) : r.start);
  // when it goes off next (Infinity = it doesn't: it is waiting for Snooze / Done, or has ended)
  function dueAt(r) {
    if (r.snooze) return r.snooze;
    if (r.firing && !r.repeat) return Infinity;
    return r.at === null ? Infinity : r.at;
  }
  // it goes off now. A repeat skips to its next time after now: times it missed (the PC was off) ring once, for the latest
  function ring(r, now) {
    const o = { ...r };
    if (r.snooze) {
      o.snooze = null;
      o.late = now - r.snooze > LATE;
      if (!o.firing || !o.firedAt) o.firedAt = r.snooze;
      o.firing = true;
      return o;
    }
    let occ = r.at;
    let count = (r.count || 0) + 1;
    if (r.repeat) {
      let nx = nextFrom(r, occ + 1, count);
      while (nx !== null && nx <= now) { occ = nx; count++; nx = nextFrom(r, occ + 1, count); }
      o.at = nx;
    }
    o.count = count;
    o.firing = true;
    o.firedAt = occ;
    o.late = now - occ > LATE;
    return o;
  }
  // Done: a one-off (or a repeat that has ended) goes away (null); a repeat waits for its next time
  function done(r) {
    if (!r.repeat || r.at === null) return null;
    return { ...r, firing: false, firedAt: null, late: false, snooze: null };
  }
  // Snooze: only this time moves (minutes, or 'tomorrow' = 09:00 tomorrow); a repeat keeps its next time
  function snooze(r, mins, now) {
    const d = new Date(now);
    const until = mins === 'tomorrow' ? new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, 9, 0).getTime() : now + (int(mins, 1, 1440) || 10) * 60e3;
    return { ...r, firing: false, late: false, snooze: until };
  }
  // the note hides: one of its reminders has "hide" on, and none is going off right now
  const hiddenNow = (list) => !!list && list.some((r) => r.hide) && !list.some((r) => r.firing);
  const ringing = (list) => (list || []).filter((r) => r.firing);
  // the next time any of them goes off (null = none)
  function nextOf(list) {
    const t = Math.min(...(list || []).map(dueAt));
    return Number.isFinite(t) ? t : null;
  }

  // ---------------------------------------------------------------- words (short and plain)
  const pad = (x) => String(x).padStart(2, '0');
  const clock = (t) => { const d = new Date(t); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
  // the day: "Today", "Tomorrow", "Yesterday", "Mon 17 Nov" (with the year when it isn't this one)
  function dayWord(t, now = Date.now()) {
    const gap = dayOf(t) - dayOf(now);
    if (gap === 0) return 'Today';
    if (gap === 1) return 'Tomorrow';
    if (gap === -1) return 'Yesterday';
    const d = new Date(t);
    const y = d.getFullYear() !== new Date(now).getFullYear() ? ` ${d.getFullYear()}` : '';
    return `${DAY_NAMES[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}${y}`;
  }
  // "Today 15:00", "Tomorrow 09:00", "Mon 17 Nov 09:00"
  const when = (t, now = Date.now()) => `${dayWord(t, now)} ${clock(t)}`;
  // "Missed at 14:00" (today), "Missed yesterday at 14:00", "Missed on Mon 16 Nov 14:00"
  function missed(t, now = Date.now()) {
    const w = when(t, now);
    if (w.startsWith('Today ')) return `Missed at ${w.slice(6)}`;
    if (w.startsWith('Yesterday ')) return `Missed yesterday at ${w.slice(10)}`;
    return `Missed on ${w}`;
  }
  const nth = (n) => n + (n % 10 === 1 && n !== 11 ? 'st' : n % 10 === 2 && n !== 12 ? 'nd' : n % 10 === 3 && n !== 13 ? 'rd' : 'th');
  function repeatText(rep, start) {
    if (!rep) return '';
    let s;
    switch (rep.k) {
      case 'day': s = 'Every day'; break;
      case 'weekdays': s = 'Weekdays'; break;
      case 'week': s = rep.days.length === 7 ? 'Every day' : `Every ${[1, 2, 3, 4, 5, 6, 0].filter((d) => rep.days.includes(d)).map((d) => DAY_NAMES[d]).join(', ')}`; break;
      case 'month': s = `Every month on the ${nth(new Date(start).getDate())}`; break;
      case 'every': s = rep.n === 1 ? `Every ${UNIT_NAMES[rep.u][0]}` : `Every ${rep.n} ${UNIT_NAMES[rep.u][1]}`; break;
      default: s = '';
    }
    if (rep.until) { const d = new Date(rep.until); s += ` · until ${d.getDate()} ${MONTHS[d.getMonth()]}`; }
    if (rep.times) s += ` · ${rep.times} ${rep.times === 1 ? 'time' : 'times'}`;
    return s;
  }
  // where a reminder is: "Tomorrow 09:00", "Snoozed until 14:10", "Missed at 14:00", "Now", "Ended"
  function status(r, now = Date.now()) {
    if (r.firing) return r.late && r.firedAt ? missed(r.firedAt, now) : 'Now';
    if (r.snooze) return `Snoozed until ${when(r.snooze, now)}`;
    if (r.at === null) return 'Ended';
    return when(r.at, now);
  }
  // one line about a reminder: "Tomorrow 09:00 · Every Mon"
  function line(r, now = Date.now()) {
    const rep = repeatText(r.repeat, r.start);
    return rep ? `${status(r, now)} · ${rep}` : status(r, now);
  }
  const api = { LATE, MAX, MSG_MAX, KINDS, UNITS, UNIT_NAMES, MIN_EVERY, SNOOZES, SOUNDS, SOUND_IDS, DEFAULT_SOUND, DAY_NAMES,
    cleanRepeat, cleanOne, cleanAll, cleanMsgs, newId, nextFrom, firstAt, dueAt, ring, done, snooze, hiddenNow, ringing, nextOf,
    MONTHS, clock, dayWord, when, missed, repeatText, status, line };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.COSMO_REMIND = api;
})(typeof window !== 'undefined' ? window : globalThis);
