'use strict';
// CosmoNotes note window, part 13 of 15 (1.4.5): app pins. Right-click the pin: "Pin over" lists the apps open now, A to Z
// (main/app-pin.js reads their window titles), each with its workspaces / files under it, to tick. "Every app" is the
// normal pin (on top of everything). A ticked app covers its workspaces (they grey out); an app the note is pinned over
// that isn't open stays in the list, ticked, with "not open". Nothing ticked: not pinned. A second right-click closes it.
// A click on the pin still pins / unpins (unpinning forgets the apps, panels.js). Main shows and hides the window by the app in front.
(() => {
  const K = window.COSMO_NOTE_KIT;
  const { V, api, $, setProp, openPop, closePop } = K;
  const same = (a, b) => String(a).toLowerCase() === String(b).toLowerCase();
  const az = (a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' });
  let open = []; // what main says is open: [{ app, parts }], null = it couldn't tell
  const rules = () => (V.note.pinned && Array.isArray(V.note.pinApps) ? V.note.pinApps : []);
  const isRule = (r, app, part) => same(r.app, app) && (part ? same(r.part || '', part) : !r.part);
  const has = (app, part) => rules().some((r) => isRule(r, app, part));

  // 'all' = the normal pin, [] = not pinned
  function save(next) {
    if (next === 'all') setProp({ pinned: true, pinApps: [] });
    else if (!next.length) setProp({ pinned: false, clickThrough: false, pinApps: [] });
    else setProp({ pinned: true, pinApps: next });
    paint();
  }
  function tick(app, part, on) {
    let next = rules().filter((r) => !isRule(r, app, part));
    if (on) {
      if (!part) next = next.filter((r) => !same(r.app, app)); // the whole app covers its workspaces
      next.push({ app, part: part || null });
    }
    save(next);
  }

  function row(label, on, change, { sub = false, off = false, gone = false } = {}) {
    const l = document.createElement('label');
    l.className = 'pa' + (sub ? ' sub' : '');
    const box = document.createElement('input');
    box.type = 'checkbox';
    box.checked = on;
    box.disabled = off;
    box.addEventListener('change', () => change(box.checked));
    const name = document.createElement('span');
    name.textContent = label;
    name.title = label;
    l.append(box, document.createElement('i'), name);
    if (gone) { const em = document.createElement('em'); em.textContent = 'not open'; l.append(em); }
    return l;
  }
  function paint() {
    const list = $('#pinList');
    list.textContent = '';
    list.append(row('Every app', !!V.note.pinned && !rules().length, (on) => save(on ? 'all' : [])));
    // the open apps and the ones it is pinned over, each once
    const apps = new Map();
    const add = (app, part, isOpen) => {
      const k = app.toLowerCase();
      if (!apps.has(k)) apps.set(k, { app, open: false, parts: new Map() });
      const a = apps.get(k);
      if (isOpen) a.open = true;
      if (!part) return;
      const p = a.parts.get(part.toLowerCase()) || { part, open: false };
      if (isOpen) p.open = true;
      a.parts.set(part.toLowerCase(), p);
    };
    for (const a of open || []) { add(a.app, null, true); for (const p of a.parts) add(a.app, p, true); }
    for (const r of rules()) add(r.app, r.part, false);
    const sorted = [...apps.values()].sort((a, b) => az(a.app, b.app));
    if (!sorted.length) {
      const p = document.createElement('p');
      p.className = 'hint pa-none';
      p.textContent = open ? 'No apps open.' : 'Couldn’t list your apps.';
      list.append(p);
      return;
    }
    const line = document.createElement('div');
    line.className = 'pa-sep';
    list.append(line);
    for (const a of sorted) {
      const whole = has(a.app, null);
      list.append(row(a.app, whole, (on) => tick(a.app, null, on), { gone: !a.open }));
      for (const p of [...a.parts.values()].sort((x, y) => az(x.part, y.part))) {
        list.append(row(p.part, whole || has(a.app, p.part), (on) => tick(a.app, p.part, on), { sub: true, off: whole, gone: !p.open }));
      }
    }
  }
  async function openPinList() {
    open = await Promise.resolve(api.pinApps()).catch(() => null);
    paint();
    openPop('#pinPop');
  }
  // a right-click opens it, the next one closes it
  $('#btnPin').addEventListener('contextmenu', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if ($('#pinPop').hidden) openPinList();
    else closePop('#pinPop');
  });
  $('#pinX').addEventListener('click', () => closePop('#pinPop'));
})();
