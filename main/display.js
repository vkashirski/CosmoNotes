'use strict';
const { screen } = require('electron');
const { DEFAULT_H, DEFAULT_W, MIN_H, MIN_W } = require('./constants');

function visibleOnSomeDisplay(b) {
  return screen.getAllDisplays().some(({ workArea: a }) =>
    b.x < a.x + a.width - 60 && b.x + b.width > a.x + 60 &&
    b.y >= a.y - 10 && b.y < a.y + a.height - 40);
}

function fitBounds(b) {
  let w = DEFAULT_W;
  let h = DEFAULT_H;
  if (b && [b.x, b.y, b.width, b.height].every(Number.isFinite)) {
    const r = { x: Math.round(b.x), y: Math.round(b.y), width: Math.max(MIN_W, Math.round(b.width)), height: Math.max(MIN_H, Math.round(b.height)) };
    if (visibleOnSomeDisplay(r)) return r;
    w = r.width;
    h = r.height;
  }
  const a = screen.getPrimaryDisplay().workArea;
  w = Math.min(w, a.width - 40);
  h = Math.min(h, a.height - 40);
  const jitter = () => Math.round((Math.random() - 0.5) * 160);
  return {
    x: Math.round(a.x + (a.width - w) / 2 + jitter()),
    y: Math.round(a.y + (a.height - h) / 2 + jitter() / 2),
    width: w,
    height: h,
  };
}
module.exports = { fitBounds, visibleOnSomeDisplay };
