// Pixel-art frames: src/catalog/frames-pixel.json must agree with the SVGs that
// tools/pixelart/build.mjs writes (viewBox, hole geometry, transparency of the opening).
const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const { frames } = JSON.parse(fs.readFileSync(path.join(ROOT, 'src', 'catalog', 'frames-pixel.json'), 'utf8'));
const ASPECT = {
  'px-pocket': 10 / 9, 'px-crt': 4 / 3, 'px-pet-egg': 1, 'px-arcade': 4 / 3,
  'px-dungeon': 16 / 9, 'px-cloud-castle': 16 / 9, 'px-cat-monitor': 4 / 3, 'px-space-console': 16 / 9,
};
const int = (v, msg) => { assert.ok(Math.abs(v - Math.round(v)) < 1e-9, `${msg}: ${v} is not a whole pixel`); return Math.round(v); };
const cuts = (r) => Array.from({ length: r }, (_, i) => Math.ceil(r - Math.sqrt(r * r - (r - i) ** 2) - 1e-9));

// Rasterize the SVG's rects: `any` = covered by some path, `solid` = covered by a fully opaque base path.
function raster(svg, W, H) {
  const any = new Uint8Array(W * H), solid = new Uint8Array(W * H);
  const base = svg.replace(/<g[\s\S]*?<\/g>/g, '');
  for (const [src, tgt] of [[svg, any], [base, solid]]) {
    for (const m of src.matchAll(/<path ([^>]*)\/>/g)) {
      if (tgt === solid && /fill-opacity/.test(m[1])) continue;
      const d = /d="([^"]*)"/.exec(m[1])[1];
      assert.equal(d.replace(/M\d+ \d+h\d+v\d+h-\d+z/g, ''), '', 'path data is rects only');
      for (const [, x, y, w, h] of d.matchAll(/M(\d+) (\d+)h(\d+)v(\d+)h-\d+z/g)) {
        for (let j = +y; j < +y + +h; j++) for (let i = +x; i < +x + +w; i++) {
          assert.ok(i < W && j < H, `rect inside viewBox (${i},${j})`);
          tgt[j * W + i] = 1;
        }
      }
    }
  }
  return { any, solid };
}

const COLLECTIONS = ['pocket-pals', 'coin-op', 'blue-cel', 'wild-pixels', 'world-tour', 'dreamscapes', 'fan-favorites'];
let IDS;
before(async () => { ({ IDS } = await import('../tools/pixelart/build.mjs')); });

test('pixel catalog: every built frame in build order, the eight originals first, well formed', () => {
  assert.deepEqual(frames.map((f) => f.id), IDS);
  assert.deepEqual(IDS.slice(0, 8), Object.keys(ASPECT));
  const rarity = {};
  for (const f of frames) {
    assert.equal(f.kind, 'frame');
    assert.equal(f.style, 'pixel');
    assert.equal(f.author, 'Kayboro');
    assert.equal(f.unlockLevel, null);
    assert.ok(f.price === null || (Number.isInteger(f.price.coins) && f.price.coins > 0), `${f.id}.price`);
    if (ASPECT[f.id]) assert.equal(f.price, null, `${f.id}: originals are level rewards`);
    else {
      assert.ok(COLLECTIONS.includes(f.collection), `${f.id}.collection`);
      assert.ok(['CC-BY-4.0', 'fan-art'].includes(f.license), `${f.id}.license`);
      assert.ok(typeof f.desc === 'string' && f.desc && !/—/.test(f.desc), `${f.id}.desc`);
    }
    assert.equal(f.file, `frames/pixel/${f.id}.svg`);
    assert.ok(typeof f.name === 'string' && f.name && typeof f.theme === 'string' && Array.isArray(f.tags));
    if (ASPECT[f.id]) rarity[f.rarity] = (rarity[f.rarity] || 0) + 1;
  }
  assert.deepEqual(rarity, { common: 3, rare: 3, epic: 2 });
  assert.equal(frames.find((f) => f.id === 'px-pocket').translucent, true);
  assert.equal(frames.find((f) => f.id === 'px-pet-egg').translucent, true);
});

for (const f of frames) {
  test(`${f.id}: SVG matches its JSON (viewBox, hole, transparency)`, () => {
    const svg = fs.readFileSync(path.join(ROOT, 'src', 'renderer', f.file), 'utf8');
    const { w: W, h: H } = f.size;
    assert.ok(W >= 160 && W <= 320, `logical width ${W}`);
    assert.match(svg, new RegExp(`viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"`));
    assert.match(svg, /shape-rendering="crispEdges"/);
    assert.doesNotMatch(svg.replace('xmlns="http://www.w3.org/2000/svg"', ''), /href|url\(|https?:|<script|@import/i, 'self-contained');

    const hx = int(f.hole.x * W, 'hole.x'), hy = int(f.hole.y * H, 'hole.y');
    const hw = int(f.hole.w * W, 'hole.w'), hh = int(f.hole.h * H, 'hole.h');
    assert.ok(Math.abs(f.aspect - hw / hh) < 1e-9 && (!ASPECT[f.id] || Math.abs(f.aspect - ASPECT[f.id]) < 1e-9), `aspect ${f.aspect}`);
    const r = int(f.holeRadius * hw, 'holeRadius');
    assert.ok(r >= 0 && r < Math.min(hw, hh) / 4, `radius ${r}`);
    assert.ok(hx >= 1 && hy >= 1 && hx + hw < W && hy + hh < H, 'hole is enclosed by the frame');

    const { any, solid } = raster(svg, W, H), c = cuts(r);
    for (let j = 0; j < hh; j++) {
      const b = hh - 1 - j, a = Math.max(j < r ? c[j] : 0, b < r ? c[b] : 0);
      for (let i = a; i < hw - a; i++) assert.equal(any[(hy + j) * W + hx + i], 0, `opening pixel (${hx + i},${hy + j}) is transparent`);
    }
    for (let i = hx; i < hx + hw; i++) for (const j of [hy - 1, hy + hh]) assert.equal(solid[j * W + i], 1, `rim (${i},${j}) is solid`);
    for (let j = hy; j < hy + hh; j++) for (const i of [hx - 1, hx + hw]) assert.equal(solid[j * W + i], 1, `rim (${i},${j}) is solid`);

    // The transparent region around the hole's center spans exactly the hole.
    const seen = new Uint8Array(W * H), st = [(hy + (hh >> 1)) * W + hx + (hw >> 1)];
    let x0 = W, y0 = H, x1 = -1, y1 = -1;
    while (st.length) {
      const i = st.pop(), x = i % W, y = (i - x) / W;
      if (seen[i] || any[i]) continue;
      seen[i] = 1; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
      if (x > 0) st.push(i - 1); if (x < W - 1) st.push(i + 1); if (y > 0) st.push(i - W); if (y < H - 1) st.push(i + W);
    }
    assert.deepEqual([x0, y0, x1 - x0 + 1, y1 - y0 + 1], [hx, hy, hw, hh]);

    assert.equal(/fill-opacity/.test(svg), !!f.translucent, 'see-through pixels iff translucent');
  });
}

test('pixel frames load through the shop catalog', () => {
  const cat = require('../src/main/economy/catalog.js').load();
  for (const f of frames) {
    const it = cat.frames.find((x) => x.id === f.id);
    assert.ok(it, `${f.id} in catalog`);
    assert.equal(it.file, f.file);
  }
});
