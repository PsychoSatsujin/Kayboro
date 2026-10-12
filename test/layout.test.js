// Unit tests for src/renderer/layout.js (pure geometry) and the built-in frame catalogue.
const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { fileURLToPath } = require('node:url');

let L, F;
before(async () => {
  L = await import('../src/renderer/layout.js');
  F = await import('../src/renderer/frames/frames.js');
});

const near = (a, b, msg = '') => {
  for (const k of Object.keys(b)) assert.ok(Math.abs(a[k] - b[k]) < 1e-9, `${msg} ${k}: got ${a[k]}, want ${b[k]}`);
};
const R = (x, y, w, h) => ({ x, y, w, h });

test('parseAspect: presets, decimals, numbers', () => {
  const p = L.parseAspect;
  assert.equal(p('16:9'), 16 / 9); assert.equal(p('4:3'), 4 / 3); assert.equal(p('21:9'), 21 / 9);
  assert.equal(p('1:1'), 1); assert.equal(p('32:9'), 32 / 9); assert.equal(p('3:2'), 1.5);
  assert.equal(p('1.6'), 1.6); assert.equal(p(' 16 : 10 '), 1.6); assert.equal(p('5x4'), 1.25); assert.equal(p('2.39:1'), 2.39);
  assert.equal(p(2), 2); assert.equal(p(0.5), 0.5);
});

test('parseAspect: free / invalid -> null', () => {
  for (const bad of ['free', 'source', '', '  ', '16:0', '0:9', '-4:3', 'abc', '1:2:3', '0', 0, -1, NaN, Infinity, null, undefined, {}, []])
    assert.equal(L.parseAspect(bad), null, String(bad));
});

test('fitRect: contain letterboxes / pillarboxes', () => {
  near(L.fitRect(2, R(0, 0, 100, 100), 'contain'), R(0, 25, 100, 50));
  near(L.fitRect(0.5, R(0, 0, 100, 100), 'contain'), R(25, 0, 50, 100));
  near(L.fitRect(4 / 3, R(10, 20, 160, 90)), R(30, 20, 120, 90), 'default mode');
  near(L.fitRect(16 / 9, R(0, 0, 160, 90), 'contain'), R(0, 0, 160, 90), 'same aspect');
});

test('fitRect: cover crops, stretch and bad input return the box', () => {
  near(L.fitRect(2, R(0, 0, 100, 100), 'cover'), R(-50, 0, 200, 100));
  near(L.fitRect(0.5, R(0, 0, 100, 100), 'cover'), R(0, -50, 100, 200));
  const box = R(1, 2, 3, 4);
  for (const [a, m] of [[2, 'stretch'], [null, 'contain'], [0, 'cover'], [NaN, 'contain']]) {
    const r = L.fitRect(a, box, m);
    assert.deepEqual(r, box); assert.notEqual(r, box);
  }
  near(L.fitRect(2, R(0, 0, 0, 100), 'contain'), R(0, 0, 0, 100), 'zero-size box');
});

test('resizeRect: free edges and corners anchor the opposite side', () => {
  const r = R(100, 100, 200, 100);
  near(L.resizeRect(r, 'e', 20, 5), R(100, 100, 220, 100));
  near(L.resizeRect(r, 'w', 20, 5), R(120, 100, 180, 100));
  near(L.resizeRect(r, 'n', 5, -10), R(100, 90, 200, 110));
  near(L.resizeRect(r, 's', 5, 30), R(100, 100, 200, 130));
  near(L.resizeRect(r, 'se', 10, 20), R(100, 100, 210, 120));
  near(L.resizeRect(r, 'nw', 10, 10), R(110, 110, 190, 90));
  near(L.resizeRect(r, 'ne', 10, 10), R(100, 110, 210, 90));
  near(L.resizeRect(r, 'sw', 10, 10), R(110, 100, 190, 110));
  assert.deepEqual(r, R(100, 100, 200, 100), 'input not mutated');
});

test('resizeRect: free min size', () => {
  const r = R(0, 0, 200, 100);
  near(L.resizeRect(r, 'e', -1000, 0), R(0, 0, 40, 100));
  near(L.resizeRect(r, 'w', 1000, 0), R(160, 0, 40, 100));
  near(L.resizeRect(r, 'n', 0, 1000), R(0, 60, 200, 40));
  near(L.resizeRect(r, 'se', -500, -500, null, 10), R(0, 0, 10, 10), 'custom minSize');
});

test('resizeRect: aspect lock on edges centres the other axis', () => {
  const r = R(0, 0, 200, 100);
  near(L.resizeRect(r, 'e', 100, 0, 2), R(0, -25, 300, 150));
  near(L.resizeRect(r, 'w', -100, 0, 2), R(-100, -25, 300, 150));
  near(L.resizeRect(r, 'n', 0, -50, 2), R(-50, -50, 300, 150));
  near(L.resizeRect(r, 's', 0, 50, 2), R(-50, 0, 300, 150));
});

test('resizeRect: aspect lock on corners follows dominant axis', () => {
  const r = R(0, 0, 200, 100);
  near(L.resizeRect(r, 'se', 100, 10, 2), R(0, 0, 300, 150), 'width dominant');
  near(L.resizeRect(r, 'se', 0, 100, 2), R(0, 0, 400, 200), 'height dominant');
  near(L.resizeRect(r, 'nw', -100, 0, 2), R(-100, -50, 300, 150), 'anchored bottom-right');
  near(L.resizeRect(r, 'ne', 100, 0, 2), R(0, -50, 300, 150), 'anchored bottom-left');
  near(L.resizeRect(r, 'sw', -100, 0, 2), R(-100, 0, 300, 150), 'anchored top-right');
  const out = L.resizeRect(r, 'se', 37, 11, 16 / 9);
  assert.ok(Math.abs(out.w / out.h - 16 / 9) < 1e-9, 'ratio preserved');
});

test('resizeRect: aspect lock respects min size and ignores bad aspect / handle', () => {
  near(L.resizeRect(R(0, 0, 200, 100), 'se', -190, -95, 2), R(0, 0, 80, 40), 'wide: height = min');
  near(L.resizeRect(R(0, 0, 50, 100), 'e', -40, 0, 0.5), R(0, 10, 40, 80), 'tall: width = min');
  near(L.resizeRect(R(0, 0, 200, 100), 'e', 10, 0, 0), R(0, 0, 210, 100), 'aspect 0 = free');
  near(L.resizeRect(R(0, 0, 200, 100), 'e', 10, 0, NaN), R(0, 0, 210, 100), 'aspect NaN = free');
  near(L.resizeRect(R(5, 6, 7, 8), 'x', 10, 10, 2), R(5, 6, 7, 8), 'unknown handle');
});

test('scaleRect: scales about the center', () => {
  near(L.scaleRect(R(0, 0, 100, 50), 2), R(-50, -25, 200, 100));
  near(L.scaleRect(R(0, 0, 100, 50), 0.5), R(25, 12.5, 50, 25));
  near(L.scaleRect(R(10, 10, 100, 100), 1.05), R(7.5, 7.5, 105, 105));
  for (const f of [1, 0, -1, NaN]) near(L.scaleRect(R(1, 2, 3, 4), f), R(1, 2, 3, 4), `factor ${f}`);
});

test('frameOuterRect: hole lands on the content rect', () => {
  near(L.frameOuterRect(R(100, 100, 200, 100), { x: 0.1, y: 0.2, w: 0.5, h: 0.5 }), R(60, 60, 400, 200));
  near(L.frameOuterRect(R(5, 5, 10, 10), { x: 0, y: 0, w: 1, h: 1 }), R(5, 5, 10, 10), 'full hole');
  near(L.frameOuterRect(R(1, 2, 3, 4), null), R(1, 2, 3, 4), 'no hole');
  near(L.frameOuterRect(R(1, 2, 3, 4), { x: 0, y: 0, w: 0, h: 1 }), R(1, 2, 3, 4), 'degenerate hole');
});

test('cursorToStage: maps normalized coords into the rect', () => {
  const r = R(10, 20, 200, 100);
  near(L.cursorToStage(0, 0, r), { x: 10, y: 20 });
  near(L.cursorToStage(1, 1, r), { x: 210, y: 120 });
  near(L.cursorToStage(0.5, 0.25, r), { x: 110, y: 45 });
  near(L.cursorToStage(-0.1, 1.5, r), { x: -10, y: 170 }, 'extrapolates outside');
});

// alpha map: opaque everywhere except listed rect(s)
const img = (W, H, holes, a = 0) => {
  const m = new Uint8Array(W * H).fill(255);
  for (const [x0, y0, x1, y1] of holes) for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) m[y * W + x] = a;
  return m;
};

test('findHole: bounding box of the center-connected transparent region', () => {
  near(L.findHole(img(10, 8, [[2, 1, 6, 5]]), 10, 8), { x: 0.2, y: 1 / 8, w: 0.5, h: 5 / 8 });
  // stray transparent pixels (corners, diagonal-only neighbour) are ignored
  near(L.findHole(img(10, 8, [[2, 1, 6, 5], [0, 0, 0, 0], [9, 7, 9, 7], [7, 6, 7, 6]]), 10, 8), { x: 0.2, y: 1 / 8, w: 0.5, h: 5 / 8 });
  near(L.findHole(img(10, 8, [[0, 2, 6, 5]]), 10, 8), { x: 0, y: 0.25, w: 0.7, h: 0.5 }, 'hole open to an edge');
  // irregular (L-shaped) region uses its bounding box
  near(L.findHole(img(10, 10, [[3, 3, 6, 6], [6, 6, 8, 8]]), 10, 10), { x: 0.3, y: 0.3, w: 0.6, h: 0.6 });
});

test('findHole: threshold and null cases', () => {
  const soft = img(10, 8, [[2, 1, 6, 5]], 10);
  near(L.findHole(soft, 10, 8), { x: 0.2, y: 1 / 8, w: 0.5, h: 5 / 8 }, 'alpha 10 < 16');
  assert.equal(L.findHole(soft, 10, 8, 5), null, 'alpha 10 >= threshold 5');
  assert.equal(L.findHole(img(10, 8, [[0, 0, 2, 2]]), 10, 8), null, 'opaque center');
  assert.equal(L.findHole(new Uint8Array(80), 10, 8), null, 'fully transparent');
  assert.equal(L.findHole(null, 10, 8), null);
  assert.equal(L.findHole(new Uint8Array(10), 10, 8), null, 'short buffer');
  assert.equal(L.findHole(new Uint8Array(0), 0, 0), null, 'empty');
  near(L.findHole(img(3, 3, [[1, 1, 1, 1]]), 3, 3), { x: 1 / 3, y: 1 / 3, w: 1 / 3, h: 1 / 3 }, 'single pixel');
});

test('frames: catalogue matches SVG files', () => {
  assert.deepEqual(F.FRAMES.map(f => f.id), ['crt-tv', 'virtual-pet', 'handheld', 'arcade', 'bezel']);
  for (const f of F.FRAMES) {
    const { x, y, w, h } = f.hole;
    assert.ok(x >= 0 && y >= 0 && w > 0 && h > 0 && x + w <= 1 && y + h <= 1, f.id);
    assert.ok(Math.abs(f.aspect - (w * f.size.w) / (h * f.size.h)) < 1e-9, `${f.id} aspect`);
    const svg = fs.readFileSync(fileURLToPath(f.url), 'utf8');
    assert.match(svg, new RegExp(`viewBox="0 0 ${f.size.w} ${f.size.h}"`), f.id);
    assert.match(svg, /fill-rule="evenodd"/, f.id);
    const outer = L.frameOuterRect(R(0, 0, 640, 480), f.hole);
    near({ x: outer.x + x * outer.w, y: outer.y + y * outer.h }, { x: 0, y: 0 }, `${f.id} round trip`);
  }
  assert.equal(F.frameById('arcade').name, 'Arcade cabinet');
  assert.equal(F.frameById('nope'), null);
});
