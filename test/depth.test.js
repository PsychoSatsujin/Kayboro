// Unit tests for src/renderer/fx/depth.js (pure part): distance field, shading and refraction maps.
const { test, before } = require('node:test');
const assert = require('node:assert/strict');

let D;
before(async () => { D = await import('../src/renderer/fx/depth.js'); });

// A W x H RGBA image: an opaque grey rectangle [x0, x1) x [y0, y1), optionally with a transparent hole.
function shell(W, H, [x0, y0, x1, y1], hole = null) {
  const px = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const inBody = x >= x0 && x < x1 && y >= y0 && y < y1;
    const inHole = hole && x >= hole[0] && x < hole[2] && y >= hole[1] && y < hole[3];
    if (inBody && !inHole) { const p = (y * W + x) * 4; px[p] = px[p + 1] = px[p + 2] = 150; px[p + 3] = 255; }
  }
  return px;
}
const A = (map, W, x, y) => map[(y * W + x) * 4 + 3];
const C = (map, W, x, y, c) => map[(y * W + x) * 4 + c];

test('distanceField: distance to the nearest outside pixel, the image border counting as outside', () => {
  const W = 9, H = 9, inside = new Uint8Array(W * H).fill(1);
  const d = D.distanceField(inside, W, H);
  assert.equal(d[0], 1);
  assert.equal(d[4 * W + 4], 5);
  inside[4 * W + 4] = 0; // a hole in the middle
  const d2 = D.distanceField(inside, W, H);
  assert.equal(d2[4 * W + 4], 0);
  assert.equal(d2[4 * W + 5], 1);
  assert.ok(Math.abs(d2[3 * W + 3] - Math.SQRT2) < 1e-6); // Float32
});

test('light: top-left bevels lit, bottom-right shaded, the flat face left alone, nothing off the shell', () => {
  const W = 120, H = 100, m = D.depthMaps(shell(W, H, [10, 10, 110, 90]), W, H);
  const lit = (x, y) => C(m.light, W, x, y, 0) === 255 && A(m.light, W, x, y) > 0;
  const dark = (x, y) => C(m.light, W, x, y, 0) < 100 && A(m.light, W, x, y) > 0;
  assert.ok(lit(11, 50) && lit(60, 11), 'left and top edges catch the light');
  assert.ok(dark(108, 50) && dark(60, 88), 'right and bottom edges fall into shade');
  assert.ok(A(m.light, W, 60, 50) < 12, `flat middle almost untouched (alpha ${A(m.light, W, 60, 50)})`);
  assert.equal(A(m.light, W, 3, 3), 0, 'background untouched');
  assert.ok(m.bevel >= 3);
});

test('glass: brighter rims than the solid overlay, edges whiter than the middle', () => {
  const W = 120, H = 100, m = D.depthMaps(shell(W, H, [10, 10, 110, 90]), W, H);
  assert.ok(A(m.glass, W, 11, 50) > A(m.light, W, 11, 50));
  assert.ok(A(m.glass, W, 11, 50) > A(m.glass, W, 60, 50));
  assert.equal(A(m.glass, W, 3, 3), 0);
});

test('refract: samples inward on the lip, none on the flat face or off the shell', () => {
  const W = 120, H = 100, m = D.depthMaps(shell(W, H, [10, 10, 110, 90], [40, 30, 80, 70]), W, H);
  assert.ok(C(m.refract, W, 11, 50, 0) > 140, 'left lip samples to the right');
  assert.ok(C(m.refract, W, 108, 50, 0) < 116, 'right lip samples to the left');
  assert.ok(C(m.refract, W, 60, 11, 1) > 140, 'top lip samples downward');
  assert.ok(C(m.refract, W, 38, 50, 0) < 116, 'the lip around the screen opening samples away from it');
  assert.equal(C(m.refract, W, 3, 3, 0), 128);
  assert.equal(C(m.refract, W, 3, 3, 3), 255, 'opaque everywhere (displacement maps must not be premultiplied away)');
  const mid = C(m.refract, W, 25, 20, 0);
  assert.ok(Math.abs(mid - 128) < 60, `gentler away from the edge (${mid})`);
});

test('pixel shells get stepped light', () => {
  const W = 40, H = 32, m = D.depthMaps(shell(W, H, [2, 2, 38, 30]), W, H, { pixel: true });
  const alphas = new Set();
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (C(m.light, W, x, y, 0) === 255 && A(m.light, W, x, y)) alphas.add(A(m.light, W, x, y));
  assert.ok(alphas.size <= 3, `light levels: ${[...alphas]}`);
});

test('drop shadows (dark, see-through) stay flat; translucent coloured plastic does not', () => {
  const W = 60, H = 40, px = shell(W, H, [5, 5, 55, 25]);
  for (let y = 25; y < 35; y++) for (let x = 8; x < 52; x++) { const p = (y * W + x) * 4; px[p] = px[p + 1] = px[p + 2] = 10; px[p + 3] = 140; }
  const m = D.depthMaps(px, W, H);
  assert.equal(A(m.light, W, 30, 30), 0, 'shadow untouched');
  assert.ok(A(m.light, W, 30, 24) > 0, 'the body edge above the shadow is bevelled');
  const t = shell(W, H, [5, 5, 55, 35]);
  for (let i = 3; i < t.length; i += 4) if (t[i]) t[i] = 160; // 63% opaque grey plastic
  assert.ok(A(D.depthMaps(t, W, H).glass, W, 6, 20) > 0, 'translucent plastic still gets depth');
});

test('edge mask keeps the rims and everything off the shell, lets the body go', () => {
  const W = 120, H = 100, m = D.depthMaps(shell(W, H, [10, 10, 110, 90]), W, H);
  assert.equal(A(m.edge, W, 3, 3), 255, 'off the shell: kept');
  assert.equal(A(m.edge, W, 11, 50), 255, 'rim: kept');
  assert.equal(A(m.edge, W, 60, 50), 0, 'body: let go');
});

test('refractEdge bends the lip like refract but leaves the flat body alone', () => {
  const W = 120, H = 100, m = D.depthMaps(shell(W, H, [10, 10, 110, 90]), W, H);
  assert.ok(C(m.refractEdge, W, 11, 50, 0) > 140, 'left lip samples to the right');
  assert.equal(C(m.refractEdge, W, 35, 50, 0), 128, 'past the bevel: no bend');
  assert.notEqual(C(m.refract, W, 35, 50, 0), 128, 'the full map still domes the body');
});
