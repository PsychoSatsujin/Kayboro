// Pixel-art environment fills (src/renderer/fx/pixel-envs.js) on a recording fake canvas: every id is
// registered everywhere, renders at any aspect, is deterministic per seed, allocates nothing per frame
// and draws exactly one still frame under reduced motion.
const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

// ---- A fake 2D canvas that records every call ------------------------------------------------
let log = [], allocs = 0, nextId = 1, rafCalls = 0, reduced = false;
const arg = a => (a && a.__id ? `#${a.__id}` : typeof a === 'number' ? Math.round(a * 1000) / 1000 : a && a.data ? 'img' : typeof a === 'object' ? 'obj' : a);
function fakeCtx(canvas) {
  const state = {};
  const record = name => (...args) => {
    for (const a of args) if (typeof a === 'number' && !Number.isFinite(a)) throw new Error(`${name}: non-finite argument ${a}`);
    log.push(`${name}(${args.map(arg).join(',')})`);
  };
  const ctx = {
    canvas,
    createImageData(w, h) { allocs++; return { width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }; },
    getImageData(x, y, w, h) { return { width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }; },
    putImageData(img, x, y) { log.push(`put(${crypto.createHash('sha1').update(img.data).digest('hex').slice(0, 10)},${x},${y})`); },
    createLinearGradient() { allocs++; return { addColorStop() {} }; },
    createRadialGradient() { allocs++; return { addColorStop() {} }; },
  };
  return new Proxy(ctx, {
    get(t, k) { if (k in t) return t[k]; if (k in state) return state[k]; return typeof k === 'string' ? record(k) : undefined; },
    set(t, k, v) { state[k] = v; log.push(`${String(k)}=${arg(v)}`); return true; },
  });
}
class FakeCanvas {
  constructor(w = 1, h = 1) { allocs++; this.__id = nextId++; this.width = w; this.height = h; this.ctx = null; }
  getContext() { return (this.ctx ||= fakeCtx(this)); }
}
globalThis.OffscreenCanvas = FakeCanvas;
globalThis.requestAnimationFrame = () => ++rafCalls;
globalThis.matchMedia = () => ({ get matches() { return reduced; }, addEventListener() {}, removeEventListener() {} });

let E, S, T;
before(async () => {
  E = await import('../src/renderer/fx/pixel-envs.js');
  S = await import('../src/renderer/fx/screensavers.js');
  T = await import('../src/renderer/fx/ticker.js');
});
const IDS = () => Object.keys(E.ENV_SCENES);
const scene = (id, seed = 7) => E.ENV_SCENES[id]({ pal: E.ENV_PALETTES[id].map(S.hexRgb), rand: (s => () => ((s = (s * 16807) % 2147483647) / 2147483647))(seed) });
function run(id, { seed = 7, w = 400, h = 300, k = 1, frames = 5 } = {}) {
  log = []; nextId = 1;
  const sc = scene(id, seed), out = new FakeCanvas(w * k, h * k), ctx = out.getContext();
  sc.resize(w, h, k);
  const setup = log.length;
  for (let i = 0; i < frames; i++) sc.draw(ctx, 2 + i / 30, 1 / 30, w, h);
  return { log, setup, hash: crypto.createHash('sha1').update(log.join('\n')).digest('hex') };
}

test('pixel environments: registered in the renderer, the catalog and the main process', () => {
  const ids = IDS(), catalog = require('../src/main/economy/catalog.js'), cat = catalog.load();
  assert.ok(ids.length >= 6 && ids.length <= 8, `${ids.length} environments`);
  for (const id of ids) {
    assert.match(id, /^px-env-[a-z-]+$/);
    assert.ok(S.SCREENSAVER_IDS.includes(id), `${id} in SCREENSAVER_IDS`);
    assert.deepEqual(S.PALETTES[id], E.ENV_PALETTES[id]);
    assert.ok(E.ENV_PALETTES[id].length >= 3 && E.ENV_PALETTES[id].every(c => /^#[0-9a-f]{6}$/i.test(c)), id);
    const item = cat.fills.find(f => f.id === id);
    assert.ok(item, `${id} is a catalog fill`);
    assert.deepEqual(item.colors, E.ENV_PALETTES[id].slice(0, 3), `${id}: swatch matches the default palette`);
    assert.ok(Number.isInteger(item.unlockLevel) && item.price === null, `${id}: earned by levelling`);
  }
  assert.deepEqual(catalog.SCREENSAVERS, S.SCREENSAVER_IDS, 'main process accepts exactly the renderer savers');
});

test('pixel environments: render at wide, tall, tiny, hi-dpi and stage sizes', () => {
  for (const id of IDS()) for (const [w, h, k] of [[420, 190, 1], [130, 300, 1], [24, 18, 1], [300, 200, 2], [1920, 1080, 1], [90, 900, 1]]) {
    const { log: l, setup } = run(id, { w, h, k });
    const frame = l.slice(setup);
    assert.ok(frame.some(s => s.startsWith('drawImage(')), `${id} ${w}x${h}: blits the art buffer`);
    // the last blit of the art buffer covers the whole canvas with crisp pixels
    const blit = frame.find(s => /^drawImage\(#\d+,0,0,\d+,\d+\)$/.test(s));
    const [, , , bw, bh] = blit.slice(10, -1).split(',').map(Number);
    assert.ok(bw >= w * k && bh >= h * k && bw < w * k + 40 * k && bh < h * k + 40 * k, `${id} ${w}x${h}: blit ${bw}x${bh}`);
    assert.ok(frame.includes('imageSmoothingEnabled=false'), `${id}: nearest-neighbour upscale`);
  }
});

test('pixel environments: deterministic per seed, different seeds differ', () => {
  for (const id of IDS()) {
    assert.equal(run(id).hash, run(id).hash, `${id}: same seed, same pixels`);
    assert.notEqual(run(id, { seed: 7 }).hash, run(id, { seed: 99 }).hash, `${id}: the seed matters`);
  }
});

test('pixel environments: no canvases, gradients or image buffers made per frame', () => {
  for (const id of IDS()) {
    const sc = scene(id), out = new FakeCanvas(500, 300), ctx = out.getContext();
    sc.resize(500, 300, 1);
    allocs = 0; log = [];
    for (let i = 0; i < 90; i++) sc.draw(ctx, i / 30, 1 / 30, 500, 300);
    assert.equal(allocs, 0, `${id}: allocations during frames`);
    assert.equal(log.filter(s => s.startsWith('put(')).length, 0, `${id}: no pixel uploads during frames`);
  }
});

test('pixel environments: a resize keeps the scene working (shells get dragged bigger)', () => {
  for (const id of IDS()) {
    const sc = scene(id), ctx = new FakeCanvas(10, 10).getContext();
    for (const [w, h] of [[300, 200], [120, 400], [800, 260]]) { sc.resize(w, h, 1); sc.draw(ctx, 1, 1 / 30, w, h); sc.draw(ctx, 1.1, 0.1, w, h); }
  }
});

test('createScreensaver: reduced motion draws one still frame and never starts the ticker', () => {
  const el = () => ({ clientWidth: 320, clientHeight: 200, isConnected: true, width: 0, height: 0, __id: 'main', getContext() { return (this.ctx ||= fakeCtx(this)); } });
  for (const id of IDS()) {
    reduced = true; rafCalls = 0; log = [];
    const cv = el(), s = createSaver(id, cv);
    assert.equal(rafCalls, 0, `${id}: no animation frames requested`);
    assert.equal(T.liveCount(), 0);
    // painted synchronously on creation (the warm-up frame, repainted still), then nothing more
    assert.ok(log.some(x => /^drawImage\(#\d+,0,0,/.test(x)), `${id}: a still frame was painted`);
    assert.equal([cv.width, cv.height].join('x'), '320x200');
    s.stop();
    reduced = false;
    const s2 = createSaver(id, el());
    assert.equal(T.liveCount(), 1, `${id}: animates on the shared ticker without reduced motion`);
    s2.stop();
    assert.equal(T.liveCount(), 0);
  }
  function createSaver(id, cv) { return S.createScreensaver(id, cv, { pixelRatio: 1, seed: 3 }); }
});
