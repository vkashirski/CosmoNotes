'use strict';
// The effects code as the windows load it: the src/fx/*.js files named in note.html's <script> tags, in that order,
// joined into one script (1.1.24: fx.js was split into parts). Usage: vm.runInNewContext(require('./fx-source')(), sandbox)
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', 'src');
const FILES = [...fs.readFileSync(path.join(SRC, 'note.html'), 'utf8').matchAll(/<script src="(fx\/[^"]+\.js)"><\/script>/g)].map((m) => m[1]);
if (!FILES.length) throw new Error('note.html loads no src/fx/ files');
module.exports = () => FILES.map((f) => fs.readFileSync(path.join(SRC, f), 'utf8')).join('\n');
module.exports.FILES = FILES;
