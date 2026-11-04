'use strict';
// A real note window (src/note.html) in Chromium, with a stand-in window.sticky: it answers getNote with the note you
// give, records every save, and answers everything else with nothing. For tests of the editor itself (selection,
// toolbars, word wrap…). Main is not running here: what the window saves is in page.updates().
// Needs Playwright; without it the test exits with 77 (tests/run.js shows SKIP).
//   const nu = await require('./helpers/note-ui')();
//   const page = await nu.open({ html: '<p>Hello</p>' }, 360);   // the note (added to a plain yellow note), window width
//   await nu.press(page, '#btnText');  await page.updates()  →  every patch the window saved;  await nu.done()
//   nu.open(note, w, h, init): init = a function run in the page before it loads (after window.sticky is set up), e.g. to
//   answer some calls differently. Chromium has a fake microphone (a beep) that it may use without asking.
const path = require('path');

let playwright;
try { playwright = require('playwright'); } catch { console.log('SKIP: Playwright is not installed (these tests run in the cloud workspace)'); process.exit(77); }

const BASE = { id: 'a', color: 'yellow', font: 'hand', size: 'm', opacity: 1, zoom: 1, ink: null, wrapWidth: null, settings: { appTheme: 'cream' } };

module.exports = async function noteUi() {
  let browser;
  try { browser = await playwright.chromium.launch({ args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--autoplay-policy=no-user-gesture-required',
    // Speak to text's AudioWorklet (src/mic-worklet.js) is a module loaded from file://: Electron allows it (the prototype
    // showed it), plain Chromium only with this
    '--allow-file-access-from-files'] }); } catch (e) { console.log('SKIP: Chromium does not start here: ' + String(e.message).split('\n')[0]); process.exit(77); }
  const pages = [];
  const nu = {
    browser,
    async open(note, w = 360, h = 320, init = null) {
      const page = await browser.newPage({ viewport: { width: w, height: h } });
      pages.push(page);
      page.errors = [];
      page.on('pageerror', (e) => page.errors.push(e.message));
      await page.addInitScript((n) => {
        window.__updates = [];
        const fn = (name) => (...a) => {
          if (name === 'getNote') return Promise.resolve(JSON.parse(JSON.stringify(n)));
          if (name === 'update') { window.__updates.push(a[0]); return Promise.resolve({ ...n, ...a[0] }); }
          if (name === 'updateSync') { window.__updates.push(a[0]); return true; }
          return name.startsWith('on') ? undefined : Promise.resolve(null);
        };
        const prox = (top) => new Proxy({}, { get: (t, k) => (top && ['ink', 'list', 'groups', 'settings', 'crypt', 'backups'].includes(k) ? prox(false) : fn(String(k))) });
        window.sticky = prox(true);
      }, { ...BASE, ...note });
      if (init) await page.addInitScript(init);
      await page.goto('file://' + path.join(__dirname, '..', '..', 'src', 'note.html'));
      await page.waitForFunction(() => document.getElementById('editor') && document.getElementById('editor').innerHTML !== '' || document.readyState === 'complete');
      await page.waitForTimeout(150);
      page.updates = () => page.evaluate(() => window.__updates);
      return page;
    },
    // mouse down + click on a button, as a person does (the toolbar acts on mousedown)
    async press(page, sel) {
      const l = page.locator(sel).first();
      await l.dispatchEvent('mousedown', { bubbles: true, cancelable: true, button: 0 });
      await l.dispatchEvent('click', { bubbles: true, cancelable: true, button: 0 });
      await page.waitForTimeout(60);
    },
    async done() {
      for (const p of pages) if (p.errors.length) throw new Error('errors in a note window:\n' + p.errors.join('\n'));
      await browser.close();
    },
  };
  return nu;
};
