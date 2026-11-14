'use strict';
// .github/workflows/release.yml: this version's CHANGELOG.md entry becomes the release's notes (build/release-notes.md).
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const v = require('../package.json').version;
const lines = fs.readFileSync(path.join(ROOT, 'CHANGELOG.md'), 'utf8').split('\n');
const start = lines.findIndex((l) => l.startsWith(`## ${v} `));
if (start < 0) { console.error(`No CHANGELOG.md entry for ${v}`); process.exit(1); }
let end = lines.findIndex((l, i) => i > start && l.startsWith('## '));
if (end < 0) end = lines.length;
fs.writeFileSync(path.join(ROOT, 'build', 'release-notes.md'), `${lines.slice(start + 1, end).join('\n').trim()}\n`);
console.log(`Release notes for ${v}: ${end - start - 1} lines`);
