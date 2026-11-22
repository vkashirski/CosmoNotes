'use strict';
// CosmoNotes note window, part 14 of 16 (1.4.10): tags (src/tags.js has the rules and the parts). 1.4.30 (the owner's
// picks, like GitHub labels): the ⋯ menu's Tags row (under See-through) shows every tag to press, this note's lit and the
// rest greyed (T.picker); each press is saved at once (main note:tags), never with the note's words. Its + Add opens
// Manage tags, a pop-up of its own (#tagPop, can go out of the note like Other settings: kind 'tags'): rename, colour,
// make or delete a tag in every note (T.manager, main/ipc-tags.js; the PIN when a locked note may have it). A tag made
// there goes on this note too. The notes list filters by them.
(() => {
  const K = window.COSMO_NOTE_KIT;
  const { V, api, $, openPop, closePop } = K;
  const T = window.COSMO_TAGS;
  let quick = null; // the ⋯ menu's row
  let man = null; // Manage tags
  const pinWord = () => (V.settings && V.settings.lockKind === 'password' ? 'password' : 'PIN');
  const fetchAll = () => api.tagsAll().catch(() => null);
  const shown = (id) => { const p = $(id); return !!p && !p.hidden; };
  // made again each time the menu opens (the menu may be in its own little window: ink-out.js, so its document)
  async function paintTags() {
    const box = $('#tagHere');
    if (!T || !box || !V.note || V.hidden) return;
    const got = await fetchAll();
    if (!V.note || V.hidden || !got) return;
    quick = T.picker({
      tags: V.note.tags || [], all: got.tags, colors: got.colors, doc: box.ownerDocument,
      add: (t) => change({ add: [t] }),
      remove: (t) => change({ remove: [t] }),
      manage: openManage,
    });
    box.replaceChildren(quick.el);
  }
  async function openManage() {
    const box = $('#tagManage');
    if (!T || !box || !V.note || V.hidden) return;
    openPop('#tagPop');
    const got = await fetchAll();
    if (!V.note || V.hidden || !got) return;
    man = T.manager({
      all: got.tags, colors: got.colors, pinWord: pinWord(), doc: box.ownerDocument,
      act: {
        color: (t, c) => after(api.tagColor(t, c)),
        create: async (t, c) => { const r = await api.tagColor(t, c).catch(() => null); if (r && r.ok) await change({ add: [t] }); await refresh(); return r; },
        rename: (a, b, pw) => after(api.tagRename(a, b, pw)),
        remove: (t, pw) => after(api.tagDelete(t, pw)),
      },
    });
    box.replaceChildren(man.el);
  }
  // a change in Manage tags: both again, with the new names, counts and colours
  async function after(p) {
    const r = await p.catch(() => null);
    if (r && r.ok) await refresh();
    return r;
  }
  async function refresh() {
    if (!V.note || V.hidden || (!quick && !man)) return;
    const got = await fetchAll();
    if (!got) return;
    if (quick) quick.set(V.note.tags || [], got.tags, got.colors);
    if (man && shown('#tagPop')) man.set(got.tags, got.colors);
  }
  async function change(c) {
    const tags = await api.tags(c);
    if (Array.isArray(tags) && V.note) V.note.tags = tags;
    if (quick) quick.set(V.note.tags || []);
  }
  $('#tagX').addEventListener('click', () => closePop('#tagPop'));
  // changed from the notes list or Manage tags in another note (lock-zoom.js has already put them in V.note); a colour
  // changed: settings
  api.onLook((v) => { if (v && 'tags' in v && (quick || man)) refresh(); });
  api.onSettings((s) => { if (s && 'tagColors' in s && (quick || man)) refresh(); });

  Object.assign(K, { paintTags });
})();
