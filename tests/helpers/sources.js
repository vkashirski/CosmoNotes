'use strict';
// The app's code and styles as the windows load them, for tests that load or read it.
// Each window lists its parts in its html (<script src> / <link>); these read that list, so they follow any change.
//   src.note() / src.list() / src.fx()   the note window's / the list's / the effects' code, the parts joined in order
//   src.css('note') / src.css('list')    a window's styles, the parts joined in order
//   src.main()                           main.js and every main/*.js joined (for a line of the main process's code)
//   src.files.note / .list / .fx         the part files, e.g. ['note/base.js', …];  src.cssFiles('note') → ['css/note-base.css', …]
//   src.read('src/list.html')            any file of the app, as text
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const SRC = path.join(ROOT, 'src');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const scripts = (page, dir) => [...read(`src/${page}.html`).matchAll(/<script src="([^"]+)"><\/script>/g)].map((m) => m[1]).filter((f) => f.startsWith(dir + '/'));
const cssFiles = (page) => [...read(`src/${page}.html`).matchAll(/<link rel="stylesheet" href="(css\/[^"]+\.css)">/g)].map((m) => m[1]);
const join = (files) => files.map((f) => fs.readFileSync(path.join(SRC, f), 'utf8')).join('\n');
const files = { note: scripts('note', 'note'), list: scripts('list', 'list'), fx: scripts('note', 'fx') };
for (const [k, v] of Object.entries(files)) if (!v.length) throw new Error(`no src/${k}/ parts found in the html`);
const mainFiles = () => ['main.js', ...fs.readdirSync(path.join(ROOT, 'main')).filter((f) => f.endsWith('.js')).sort().map((f) => `main/${f}`)];

module.exports = {
  ROOT, SRC, read, files, cssFiles, mainFiles, scripts,
  note: () => join(files.note),
  list: () => join(files.list),
  fx: () => join(files.fx),
  css: (page) => cssFiles(page).map((f) => fs.readFileSync(path.join(SRC, f), 'utf8')).join(''),
  main: () => mainFiles().map(read).join('\n'),
};
