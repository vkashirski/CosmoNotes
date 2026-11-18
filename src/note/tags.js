'use strict';
// CosmoNotes note window, part 14 of 16 (1.4.10): tags. The ⋯ menu's Tags row: this note's own tags (src/tags.js has the
// rules and the editor). Each one added or removed is saved at once (main note:tags), never with the note's words; the
// suggestions are every tag in use (main note:tags-known). The notes list filters by them.
(() => {
  const K = window.COSMO_NOTE_KIT;
  const { V, api, $ } = K;
  const T = window.COSMO_TAGS;
  let ed = null;
  // made again each time the menu opens (the menu may be in its own little window: ink-out.js, so its document)
  async function paintTags() {
    const box = $('#tagHere');
    if (!T || !box || !V.note || V.hidden) return;
    if (ed && ed.busy()) return;
    const known = await api.tagsKnown().catch(() => []);
    if (!V.note || V.hidden) return;
    ed = T.editor({
      tags: V.note.tags || [], known: known || [], doc: box.ownerDocument,
      add: (t) => change({ add: [t] }),
      remove: (t) => change({ remove: [t] }),
    });
    box.replaceChildren(ed.el);
  }
  async function change(c) {
    const tags = await api.tags(c);
    if (Array.isArray(tags) && V.note) V.note.tags = tags;
  }
  // changed from the notes list while the menu is open (lock-zoom.js has already put them in V.note)
  api.onLook((v) => { if (v && 'tags' in v && ed && !ed.busy() && V.note) ed.set(V.note.tags || []); });

  Object.assign(K, { paintTags });
})();
