'use strict';
// --self-test[=<file.json>]: boot normally, wait for the renderer, write a result file and exit.
// Result: {ok, version, electron, platform, catalog: {frames, wallpapers}, steamworks, errors[]}, also
// printed as one line "KAYBORO_SELFTEST <json>" so launchers can read it without the file. Exit code
// 0 when ok, 1 otherwise, always within TIMEOUT_MS. Used by BUILD_FOR_TESTING.bat on a packaged build
// and by `npm start -- --self-test` on a dev checkout.
const fs = require('fs');
const path = require('path');

const TIMEOUT_MS = 30e3;
const RENDER_CHECK = "!!(document.getElementById('stage') && window.ror && window.shell)";

// The result file from argv, or null when the flag is absent. `--self-test` alone -> defaultFile.
function parseArgs(argv, defaultFile = null) {
  for (const a of argv || []) {
    if (a === '--self-test') return { file: defaultFile };
    const m = /^--self-test=(.*)$/.exec(a);
    if (m) return { file: m[1].trim() || defaultFile };
  }
  return null;
}

// Runs the self-test against the app's main window. `probe()` collects the counts (catalog, steamworks).
function run({ app, win, probe, file, timeoutMs = TIMEOUT_MS, out = process.stdout, exit = (code) => app.exit(code) }) {
  const errors = [];
  const t0 = Date.now();
  let done = false;
  const finish = (reason) => {
    if (done) return;
    done = true;
    clearTimeout(timer);
    if (reason) errors.push(reason);
    let extra = {};
    try {
      extra = probe() || {};
    } catch (err) {
      errors.push(`probe: ${err.message}`);
    }
    const r = { ok: errors.length === 0, version: app.getVersion(), electron: process.versions.electron, platform: `${process.platform}-${process.arch}`,
      catalog: { frames: 0, wallpapers: 0 }, steamworks: false, ...extra, ms: Date.now() - t0, errors };
    const json = JSON.stringify(r);
    try {
      if (file) {
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, json + '\n');
      }
    } catch (err) {
      r.errors.push(`write: ${err.message}`);
      r.ok = false;
    }
    out.write(`KAYBORO_SELFTEST ${JSON.stringify(r)}\n`);
    exit(r.ok ? 0 : 1);
  };
  const timer = setTimeout(() => finish(`renderer did not load within ${timeoutMs / 1000} s`), timeoutMs);
  if (!win || win.isDestroyed()) return finish('no window');
  const wc = win.webContents;
  wc.on('console-message', (ev, level, message) => {
    const lvl = ev && typeof ev === 'object' && 'level' in ev ? ev.level : level; // Electron >= 32 passes an event object
    const msg = ev && typeof ev === 'object' && 'message' in ev ? ev.message : message;
    if (lvl === 'error' || lvl === 3) errors.push(`renderer: ${String(msg).slice(0, 300)}`);
  });
  wc.on('render-process-gone', (_e, d) => finish(`renderer gone: ${d && d.reason}`));
  wc.on('did-fail-load', (_e, code, desc) => finish(`load failed: ${code} ${desc}`));
  wc.once('did-finish-load', () => {
    // Let the renderer's async boot (catalog, state, panels) settle before checking it.
    const check = (left) => wc.executeJavaScript(RENDER_CHECK, true).then((ok) => {
      if (ok) finish(null);
      else if (left > 0) setTimeout(() => check(left - 1), 250);
      else finish('renderer booted without its stage or bridges');
    }).catch((err) => finish(`renderer check: ${err.message}`));
    setTimeout(() => check(40), 500);
  });
  return null;
}

module.exports = { parseArgs, run, TIMEOUT_MS };
