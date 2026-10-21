'use strict';
// Obsidian Throne: a throne back of faceted volcanic glass rises behind the screen to a pointed arch,
// crowned by a fan of glass shards with magma glowing at their roots. Molten veins crack through the
// glass from the outer edges, wrought-iron vines with thorns climb the twin pillars and curl along the
// arch, shard finials top the pillars and the whole seat stands on a cracked dais. Around the screen a
// band of polished, unbroken obsidian and a fine iron rim keep the eye on the game. Original Kayboro
// artwork, CC BY 4.0.
const L = require('../lib');
const { rr, path, g, lg, rg, circle, ellipse, rng, lip, poly } = L;

const W = 1600, H = 1400, hole = { x: 320, y: 560, w: 960, h: 540 }, radius = 8;
const CX = W / 2;
const IRON = '#141318';
const P0 = (...v) => v.map(Math.round).join(' ');
const n1 = (v) => +(+v).toFixed(1);
const rot = (x, y, a, r) => [x + Math.cos(a) * r, y + Math.sin(a) * r];
const mirror = (...kids) => g({}, ...kids) + g({ transform: `translate(${W} 0) scale(-1 1)` }, ...kids);
const RING = { x: hole.x - 70, y: hole.y - 70, w: hole.w + 140, h: hole.h + 140 }; // nothing busy inside this

// ---- shapes -----------------------------------------------------------------------------------------
// Throne back: straight sides and a tall pointed (ogival) arch.
const BACK = (() => {
  const x0 = 196, x1 = W - 196, yS = 470, yB = 1250;
  return `M${x0} ${yB}V${yS}C${x0} 330 ${CX - 260} 200 ${CX} 96C${CX + 260} 200 ${x1} 330 ${x1} ${yS}V${yB}Z`;
})();

/** Faceted glass: a jittered triangle mesh over a box, grouped into tone buckets, plus glinting edges. */
function facets(x0, y0, x1, y1, cell, seed, tones, edge = '#a49ac8') {
  const rnd = rng(seed), cols = Math.ceil((x1 - x0) / cell) + 1, rows = Math.ceil((y1 - y0) / cell) + 1, pt = [];
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const edgeP = i === 0 || j === 0 || i === cols - 1 || j === rows - 1;
    pt.push([x0 + i * cell + (edgeP ? 0 : (rnd() - 0.5) * cell * 0.8), y0 + j * cell + (edgeP ? 0 : (rnd() - 0.5) * cell * 0.8)]);
  }
  const buckets = tones.map(() => ''), lit = [];
  let edges = '';
  const tri = (a, b, c) => {
    // a fake facet normal: random tilt, lit from the top left
    const k = Math.min(tones.length - 1, Math.floor(rnd() ** 1.6 * tones.length));
    buckets[k] += `M${P0(...a)}L${P0(...b)}L${P0(...c)}Z`;
    if (k >= tones.length - 1 && rnd() < 0.5) lit.push(`M${P0(...a)}L${P0(...b)}`);
  };
  for (let j = 0; j < rows - 1; j++) for (let i = 0; i < cols - 1; i++) {
    const a = pt[j * cols + i], b = pt[j * cols + i + 1], c = pt[(j + 1) * cols + i], d = pt[(j + 1) * cols + i + 1];
    if ((i + j) % 2) { tri(a, b, d); tri(a, d, c); } else { tri(a, b, c); tri(b, d, c); }
    edges += `M${P0(...a)}L${P0(...b)}M${P0(...a)}L${P0(...c)}M${P0(...((i + j) % 2 ? a : b))}L${P0(...((i + j) % 2 ? d : c))}`;
  }
  return buckets.map((d, k) => path(d, { fill: tones[k] })).join('')
    + path(edges, { fill: 'none', stroke: edge, strokeOpacity: 0.1, strokeWidth: 1 })
    + path(lit.join(''), { fill: 'none', stroke: '#e8e2ff', strokeOpacity: 0.5, strokeWidth: 1.4, strokeLinecap: 'round' });
}

/** A molten fissure: a jagged random walk with branches, glowing from a dull red halo to a hot core. */
function veinPath(x, y, dir, len, seed, depth = 0) {
  const rnd = rng(seed);
  let d = `M${P0(x, y)}`, px = x, py = y, a = dir, out = '';
  for (let s = 0; s < len;) {
    const step = 10 + rnd() * 16; a += (rnd() - 0.5) * 0.9; a += (dir - a) * 0.25;
    px += Math.cos(a) * step; py += Math.sin(a) * step; s += step; d += `L${P0(px, py)}`;
    if (depth < 2 && rnd() < 0.09) out += veinPath(px, py, a + (rnd() < 0.5 ? -1 : 1) * (0.5 + rnd() * 0.6), len * (0.3 + rnd() * 0.25), seed * 7 + s | 0, depth + 1);
  }
  return d + out;
}
function veins(d) {
  return path(d, { fill: 'none', stroke: '#ff3a0a', strokeOpacity: 0.38, strokeWidth: 16, strokeLinecap: 'round', strokeLinejoin: 'round', filter: 'url(#otGlow)' })
    + path(d, { fill: 'none', stroke: '#2a0804', strokeWidth: 5, strokeLinecap: 'round', strokeLinejoin: 'round' })
    + path(d, { fill: 'none', stroke: '#ff6a1a', strokeWidth: 2.8, strokeLinecap: 'round', strokeLinejoin: 'round' })
    + path(d, { fill: 'none', stroke: '#ffe2a0', strokeWidth: 1, strokeLinecap: 'round', strokeLinejoin: 'round' });
}

/** A glass shard rising from (x, y) toward angle a: two facets either side of a ridge, a lit edge, a hot root. */
function shard(x, y, a, len, w, lean = 0.12) {
  const tip = rot(x, y, a + lean * 0.3, len), l = rot(x, y, a - Math.PI / 2, w / 2), r = rot(x, y, a + Math.PI / 2, w / 2);
  const ridgeB = rot(x, y, a, len * 0.08), ridge = rot(x, y, a + lean, len * 0.55);
  const sh = rot(...l, a, len * 0.6), sh2 = rot(...r, a, len * 0.5);
  const left = poly([l, sh, tip, ridge, ridgeB]), right = poly([ridgeB, ridge, tip, sh2, r]);
  return path(left, { fill: 'url(#otShardL)', stroke: '#050407', strokeWidth: 2, strokeLinejoin: 'round' })
    + path(right, { fill: 'url(#otShardR)', stroke: '#050407', strokeWidth: 2, strokeLinejoin: 'round' })
    + path(`M${P0(...ridgeB)}L${P0(...ridge)}L${P0(...tip)}`, { fill: 'none', stroke: '#d8d0ff', strokeOpacity: 0.65, strokeWidth: 1.6, strokeLinejoin: 'round' })
    + path(`M${P0(...l)}L${P0(...sh)}`, { fill: 'none', stroke: '#ff7a30', strokeOpacity: 0.5, strokeWidth: 1.6 });
}

/** Wrought iron: a vine along pts with thorns on alternate sides and a scroll curl at the end. */
function ironVine(pts, w, seed, curlDir = 1) {
  const rnd = rng(seed);
  // dense samples along the polyline-ish spline
  const S = [];
  for (let i = 0; i < pts.length - 1; i++) for (let k = 0; k < 10; k++) { const t = k / 10; S.push([pts[i][0] + (pts[i + 1][0] - pts[i][0]) * t, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * t]); }
  const last = pts[pts.length - 1], prev = pts[pts.length - 2];
  let a = Math.atan2(last[1] - prev[1], last[0] - prev[0]), [cx, cy] = last;
  const curl = [];
  for (let k = 0; k < 20; k++) { a += curlDir * 0.42; const r = 22 * (1 - k / 24); cx += Math.cos(a) * r * 0.42; cy += Math.sin(a) * r * 0.42; curl.push([cx, cy]); }
  const all = [...pts, ...curl.filter((_, i) => i % 2)];
  let d = `M${P0(...all[0])}`;
  for (let i = 1; i < all.length - 1; i++) d += `Q${P0(...all[i])} ${P0((all[i][0] + all[i + 1][0]) / 2, (all[i][1] + all[i + 1][1]) / 2)}`;
  d += `L${P0(...all[all.length - 1])}`;
  let thorns = '';
  for (let i = 4; i < S.length - 2; i += 5) {
    const [x, y] = S[i], [x2, y2] = S[i + 1], t = Math.atan2(y2 - y, x2 - x), side = (i / 5) % 2 ? 1 : -1, l = 14 + rnd() * 10;
    const b0 = rot(x, y, t, -7), b1 = rot(x, y, t, 7), tip = rot(x, y, t + side * 1.0, l * 1.4);
    thorns += `M${P0(...b0)}L${P0(...tip)}L${P0(...b1)}Z`;
  }
  return path(thorns, { fill: IRON, stroke: '#050407', strokeWidth: 1 })
    + path(d, { fill: 'none', stroke: '#050407', strokeWidth: w + 3, strokeLinecap: 'round' })
    + path(d, { fill: 'none', stroke: IRON, strokeWidth: w, strokeLinecap: 'round' })
    + path(d, { fill: 'none', stroke: '#7a7590', strokeOpacity: 0.55, strokeWidth: Math.max(1, w * 0.25), strokeLinecap: 'round', transform: 'translate(-1.2 -1.2)' })
    + path(thorns, { fill: 'none', stroke: '#8a84a2', strokeOpacity: 0.35, strokeWidth: 1, transform: 'translate(-0.8 -0.8)' });
}

// ---- parts --------------------------------------------------------------------------------------------
const PIL = { x: 112, y0: 520, x1: 236, y1: 1262 };
const SHAFT = `M${PIL.x} ${PIL.y1}V${PIL.y0}L${(PIL.x + PIL.x1) / 2} ${PIL.y0 - 60}L${PIL.x1} ${PIL.y0}V${PIL.y1}Z`;
function pillar() {
  const { x, y0, x1, y1 } = PIL, shaft = SHAFT;
  return g({},
    path(shaft, { fill: '#000', fillOpacity: 0.35, transform: 'translate(8 12)' }),
    g({ clipPath: 'url(#otPil)' }, facets(x - 10, y0 - 70, x1 + 10, y1 + 10, 62, 31, ['#07060a', '#0e0c13', '#17141e', '#24202f', '#3a3450']), path(`M0 0H${W}V${H}H0Z`, { fill: 'url(#otGloss)' })),
    path(shaft, { fill: 'none', stroke: '#050407', strokeWidth: 3 }),
    // capital band and shard finial
    path(rr(x - 14, y0 - 8, x1 - x + 28, 26, 6), { fill: 'url(#otIron)', stroke: '#050407', strokeWidth: 2 }),
    path(rr(x - 14, 1040, x1 - x + 28, 22, 6), { fill: 'url(#otIron)', stroke: '#050407', strokeWidth: 2 }),
    path(ellipse((x + x1) / 2, y0 - 70, 70, 40), { fill: 'url(#otEmber)' }),
    shard((x + x1) / 2 - 30, y0 - 50, -Math.PI / 2 - 0.35, 110, 34),
    shard((x + x1) / 2 + 30, y0 - 50, -Math.PI / 2 + 0.3, 120, 36),
    shard((x + x1) / 2, y0 - 50, -Math.PI / 2, 190, 50));
}

function crown() {
  // a fan of shards from a point under the arch apex: a long dark back row and a shorter front row
  const ox = CX, oy = 380, rnd = rng(9);
  const list = [];
  for (let k = -9; k <= 9; k++) {
    const a = -Math.PI / 2 + k * 0.12 + (rnd() - 0.5) * 0.04, far = Math.abs(k);
    list.push([far + 0.5, rot(ox, oy, a, 200 - far * 3), a, (360 - far * 24) * (0.8 + rnd() * 0.3), 44 - far * 2]);
  }
  for (let k = -6; k <= 6; k++) {
    const a = -Math.PI / 2 + k * 0.17 + 0.06, far = Math.abs(k);
    list.push([far, rot(ox, oy, a, 210 - far * 2), a, (200 - far * 14) * (0.85 + rnd() * 0.3), 50 - far * 3]);
  }
  let s = '';
  list.sort((p, q) => q[0] - p[0]).forEach(([, [x, y], a, len, w]) => { s += shard(x, y, a, len, w, (a + Math.PI / 2) * 0.4); });
  return g({},
    path(ellipse(ox, 200, 320, 170), { fill: 'url(#otCrownGlow)' }),
    s);
}

/** Serrated crest of small shards along the arch edge, pointing outward, longer toward the crown. */
function archShards() {
  const P = [[196, 470], [196, 330], [CX - 260, 200], [CX, 96]], rnd = rng(13);
  const bz = (t, k) => (1 - t) ** 3 * P[0][k] + 3 * (1 - t) ** 2 * t * P[1][k] + 3 * (1 - t) * t * t * P[2][k] + t ** 3 * P[3][k];
  let out = '';
  for (let i = 1; i < 14; i++) {
    const t = i / 15, x = bz(t, 0), y = bz(t, 1), dx = bz(t + 0.01, 0) - x, dy = bz(t + 0.01, 1) - y, a = Math.atan2(dy, dx) - Math.PI / 2;
    out += shard(x, y, a - 0.25, (34 + t * 50) * (0.7 + rnd() * 0.6), 18 + t * 8, -0.2);
  }
  return mirror(out);
}

function dais() {
  const steps = [[60, 1240, W - 120, 52], [24, 1286, W - 48, 58], [0, 1338, W, 52]];
  let out = '';
  steps.forEach(([x, y, w, h], i) => {
    const d = rr(x, y, w, h, 6);
    out += path(d, { fill: '#000', fillOpacity: 0.3, transform: 'translate(0 8)' })
      + `<clipPath id="otStep${i}"><path d="${d}"/></clipPath>`
      + g({ clipPath: `url(#otStep${i})` }, facets(x, y - 4, x + w, y + h + 4, 54, 40 + i, ['#08070b', '#100e15', '#1a1722', '#2c2840']),
        path(`M${x} ${y + 2}H${x + w}`, { stroke: '#cfc6f2', strokeOpacity: 0.35, strokeWidth: 2 }))
      + g({ clipPath: `url(#otStep${i})` }, veins([0, 1, 2, 3].map((k) => veinPath(x + w * (0.12 + k * 0.25) + i * 40, y + h, -Math.PI / 2 + (k % 2 ? 0.4 : -0.4), h * 1.4, 500 + i * 10 + k)).join('')))
      + path(d, { fill: 'none', stroke: '#050407', strokeWidth: 2.5 });
  });
  return out;
}

function bezel() {
  const b = 46, outer = rr(hole.x - b, hole.y - b, hole.w + 2 * b, hole.h + 2 * b, 18);
  const holeD = rr(hole.x, hole.y, hole.w, hole.h, radius);
  return g({},
    path(rr(hole.x - b - 14, hole.y - b - 14, hole.w + 2 * b + 28, hole.h + 2 * b + 28, 24), { fill: 'none', stroke: '#ff5a1a', strokeOpacity: 0.18, strokeWidth: 10 }),
    path(outer, { fill: 'url(#otPolish)', stroke: '#050407', strokeWidth: 3 }),
    path(rr(hole.x - b - 7, hole.y - b - 7, hole.w + 2 * b + 14, hole.h + 2 * b + 14, 22), { fill: 'none', stroke: 'url(#otIron)', strokeWidth: 9 }),
    path(rr(hole.x - b + 6, hole.y - b + 6, hole.w + 2 * b - 12, hole.h + 2 * b - 12, 14), { fill: 'none', stroke: '#d8d0ff', strokeOpacity: 0.16, strokeWidth: 2 }),
    // a long reflection across the polished top edge
    path(`M${hole.x - 20} ${hole.y - b + 12}H${hole.x + hole.w * 0.55}`, { stroke: '#ffffff', strokeOpacity: 0.22, strokeWidth: 3, strokeLinecap: 'round' }),
    path(rr(hole.x - 8, hole.y - 8, hole.w + 16, hole.h + 16, radius + 6), { fill: 'none', stroke: '#2a1208', strokeWidth: 10 }),
    path(rr(hole.x - 12, hole.y - 12, hole.w + 24, hole.h + 24, radius + 8), { fill: 'none', stroke: '#ff7a2a', strokeOpacity: 0.55, strokeWidth: 1.6 }),
    lip(holeD, '#000', [[7, 0.3], [3, 0.55]]));
}

function draw() {
  const defs = [
    '<filter id="otGlow" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="5"/></filter>',
    lg('otGloss', [0, 0, 1, 1], [[0, '#cfc6f2', 0.14], [0.3, '#cfc6f2', 0.02], [0.42, '#cfc6f2', 0.1], [0.5, '#cfc6f2', 0], [1, '#000', 0.3]]),
    rg('otAura', [0.5, 0.45, 0.55], [[0, '#ff4a12', 0.3], [0.55, '#a0200a', 0.12], [1, '#5a0a04', 0]]),
    rg('otCrownGlow', [0.5, 0.7, 0.5], [[0, '#ff7a24', 0.38], [0.6, '#ff3a0a', 0.12], [1, '#ff3a0a', 0]]),
    rg('otEmber', [0.5, 0.6, 0.5], [[0, '#ff7a24', 0.34], [1, '#ff3a0a', 0]]),
    lg('otShardL', [0, 0, 1, 1], [[0, '#5a5378'], [0.5, '#2a2638'], [1, '#110f17']]),
    lg('otShardR', [0, 0, 1, 1], [[0, '#1c1926'], [0.6, '#0b0a0f'], [1, '#3a1810']]),
    lg('otIron', [0, 0, 0, 1], [[0, '#4a4658'], [0.5, '#1c1a22'], [1, '#0a090d']]),
    lg('otPolish', [0, 0, 0.3, 1], [[0, '#2e2a3c'], [0.18, '#0d0c12'], [0.6, '#08070b'], [1, '#1a1014']]),
    `<clipPath id="otBack"><path d="${BACK}"/></clipPath>`,
    `<clipPath id="otPil"><path d="${SHAFT}"/></clipPath>`,
  ].join('');

  // fissures start at the outer edges of the throne back and run inward, stopping short of the ring
  const rnd = rng(77);
  let vd = '';
  const clipRing = (d) => d; // veins are drawn under the bezel, which hides any run-in
  for (let i = 0; i < 9; i++) vd += veinPath(200, 520 + i * 84 + rnd() * 30, (rnd() - 0.5) * 0.6, 90 + rnd() * 60, 100 + i);
  for (let i = 0; i < 9; i++) vd += veinPath(W - 200, 520 + i * 84 + rnd() * 30, Math.PI + (rnd() - 0.5) * 0.6, 90 + rnd() * 60, 200 + i);
  for (let i = 0; i < 7; i++) { const x = 330 + i * 156 + rnd() * 40; vd += veinPath(x, 1250, -Math.PI / 2 + (rnd() - 0.5) * 0.5, 60 + rnd() * 50, 300 + i); }
  for (let i = 0; i < 8; i++) { const a = Math.PI * (1.12 + i * 0.11), x = CX + Math.cos(a) * 560, y = 560 + Math.sin(a) * 380; vd += veinPath(x, y, a + Math.PI, 70 + rnd() * 60, 400 + i); }

  const art = [
    path(ellipse(CX, 640, 820, 700), { fill: 'url(#otAura)' }),
    crown(),
    archShards(),
    path(BACK, { fill: '#000', fillOpacity: 0.38, transform: 'translate(10 14)' }),
    g({ clipPath: 'url(#otBack)' },
      facets(180, 80, W - 180, 1270, 84, 11, ['#060509', '#0b0a0f', '#110f17', '#1a1723', '#262232', '#3c3652']),
      path(`M0 0H${W}V${H}H0Z`, { fill: 'url(#otGloss)' }),
      veins(clipRing(vd))),
    path(BACK, { fill: 'none', stroke: '#050407', strokeWidth: 4 }),
    path(BACK, { fill: 'none', stroke: '#cfc6f2', strokeOpacity: 0.22, strokeWidth: 2, transform: 'translate(3 4)' }),
    // iron vines along the arch and down the back edges
    mirror(ironVine([[CX - 40, 140], [CX - 200, 214], [CX - 380, 318], [CX - 520, 420], [CX - 598, 540]], 11, 1, -1),
      ironVine([[CX - 90, 250], [CX - 230, 310], [CX - 360, 400], [CX - 430, 470]], 7, 2, 1),
      ironVine([[CX - 300, 360], [CX - 330, 300], [CX - 300, 250]], 5, 5, -1)),
    mirror(pillar()),
    mirror(ironVine([[160, 1240], [138, 1120], [190, 1000], [140, 880], [196, 760], [150, 640], [176, 560]], 9, 3, 1),
      ironVine([[200, 1180], [222, 1080], [180, 980], [222, 870], [190, 790]], 6, 4, -1)),
    bezel(),
    dais(),
    // the keystone over the screen: a single cut gem of glass with a molten heart
    path(circle(CX, hole.y - 78, 34), { fill: 'url(#otEmber)' }),
    path(poly([[CX, hole.y - 124], [CX + 30, hole.y - 84], [CX, hole.y - 50], [CX - 30, hole.y - 84]]), { fill: '#120f18', stroke: '#050407', strokeWidth: 2.5 }),
    path(poly([[CX, hole.y - 116], [CX + 20, hole.y - 84], [CX, hole.y - 58], [CX - 20, hole.y - 84]]), { fill: 'url(#otCore)' }),
    path(`M${CX - 20} ${hole.y - 84}L${CX} ${hole.y - 116}`, { stroke: '#fff2c8', strokeOpacity: 0.8, strokeWidth: 1.4 }),
  ].join('\n');
  return { defs: defs + rg('otCore', [0.5, 0.55, 0.6], [[0, '#fff0b8'], [0.4, '#ff9a2a'], [1, '#8a1a06']]), body: art };
}

module.exports = {
  W, H, hole, radius, draw,
  meta: {
    name: 'Obsidian Throne', theme: 'dark-fantasy-throne', rarity: 'legendary', translucent: false,
    collection: 'midnight-atelier', license: 'CC-BY-4.0',
    desc: 'Seat your game on a throne of faceted volcanic glass, crowned in shards and split by glowing magma under wrought-iron thorns.',
    tags: ['obsidian', 'throne', 'dark-fantasy', 'magma', 'crystal', 'iron', 'thorns', 'mature'],
  },
};
