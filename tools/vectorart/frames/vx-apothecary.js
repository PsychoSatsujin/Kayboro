'use strict';
// Apothecary: an old herbal medicine cabinet. The screen sits in a lacquered niche set into a wall of
// small wooden drawers (brass ring pulls, paper labels with little herb sketches, one drawer pulled
// out with dried flowers), under a stepped cornice holding paper-wrapped herb packets and a potted
// herb. A dried bundle hangs from a peg on the side. On the counter below: a glowing paper lantern,
// glazed ceramic jars, a cast-iron hobnail teapot on a green runner, a peeled mandarin and a woven
// basket heaped with mandarins.
const L = require('../lib');
const { rr, path, g, lg, rg, circle, ellipse, sparkle, tf, rng, lip, attrs, n, P } = L;
const rect = (x, y, w, h, r, a = {}) => `<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" rx="${r}"${attrs(a)}/>`;

// The scene is drawn in its own coordinates and shifted down by OY (headroom for the cornice clutter).
const OY = 70, W = 1700, H = 1440 + OY, hole = { x: 450, y: 300, w: 800, h: 450 }, radius = 10;
const INK = '#2b160c';
const HF = { x: hole.x - 46, y: hole.y - 46, w: hole.w + 92, h: hole.h + 92 };
const CAB = { x: 180, y: 140, w: 1340, h: 1010 };
const IN = { x0: 200, y0: 160, x1: 1500, y1: 1140 };
const TOP = 1138; // counter top surface

// ---- drawers -----------------------------------------------------------------------------------
function grid(x0, y0, x1, y1, cols, rows, gap = 8) {
  const out = [], cw = (x1 - x0 - gap * (cols - 1)) / cols, ch = (y1 - y0 - gap * (rows - 1)) / rows;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) out.push({ x: x0 + c * (cw + gap), y: y0 + r * (ch + gap), w: cw, h: ch, r, c });
  return out;
}

// Little coloured herb pictograms for the drawer labels (drawn in a ~24 x 18 box around 0,0).
const ICONS = [
  // leaf
  () => path('M-9 6C-9 -4 0 -9 10 -8C9 2 2 8 -9 6Z', { fill: '#6fae4a', stroke: '#2f5a1e', strokeWidth: 1.4, strokeLinejoin: 'round' })
    + path('M-9 6L5 -4', { stroke: '#2f5a1e', strokeWidth: 1.2, strokeLinecap: 'round' }),
  // flower
  () => path('M0 -8A3.6 3.6 0 1 0 0.01 -8ZM7 -2.5A3.6 3.6 0 1 0 7.01 -2.5ZM4.4 6A3.6 3.6 0 1 0 4.41 6ZM-4.4 6A3.6 3.6 0 1 0 -4.39 6ZM-7 -2.5A3.6 3.6 0 1 0 -6.99 -2.5Z', { fill: '#c99be8', stroke: '#6a3f8a', strokeWidth: 1.1 })
    + path(circle(0, 0, 2.6), { fill: '#ffd34d' }),
  // seeds
  () => path('M-6 3A3.4 4.4 0 1 0 -5.99 3ZM2 -3A3.4 4.4 0 1 0 2.01 -3ZM7 5A3.4 4.4 0 1 0 7.01 5Z', { fill: '#b07a3e', stroke: '#5a3a1a', strokeWidth: 1.2 }),
  // mushroom
  () => path('M-3 0V7H3V0Z', { fill: '#f3e3c4', stroke: '#6a4a2a', strokeWidth: 1.2 })
    + path('M-10 1C-10 -9 10 -9 10 1Z', { fill: '#e2553f', stroke: '#7a2a1a', strokeWidth: 1.2, strokeLinejoin: 'round' })
    + path('M-4 -3.5A1.5 1.5 0 1 0 -3.99 -3.5ZM3 -4.5A1.5 1.5 0 1 0 3.01 -4.5Z', { fill: '#fff' }),
  // berries
  () => path('M-1 -6Q4 -11 9 -8Q5 -4 -1 -6Z', { fill: '#6fae4a', stroke: '#2f5a1e', strokeWidth: 1.1 })
    + path('M-4 2A4 4 0 1 0 -3.99 2ZM4 3A4 4 0 1 0 4.01 3ZM0 -3A3.6 3.6 0 1 0 0.01 -3Z', { fill: '#d8344a', stroke: '#6e1424', strokeWidth: 1.1 }),
];

function drawers(list, seed) {
  const rnd = rng(seed), faces = [], hi = [], sh = [], grain = [], pulls = [], rings = [], labels = [], icons = [];
  for (const d of list) {
    if (d.skip) continue;
    const v = Math.floor(rnd() * 3);
    faces.push(rect(d.x, d.y, d.w, d.h, 5, { fill: `url(#apDr${v})` }));
    hi.push(`M${P(d.x + 6, d.y + d.h - 8)}V${n(d.y + 6)}H${n(d.x + d.w - 8)}`);
    sh.push(`M${P(d.x + d.w - 5, d.y + 8)}V${n(d.y + d.h - 5)}H${n(d.x + 8)}`);
    for (let k = 0; k < 2; k++) {
      const gy = d.y + 12 + rnd() * (d.h - 24), gx0 = d.x + 8 + rnd() * d.w * 0.3, gx1 = d.x + d.w - 8 - rnd() * d.w * 0.3;
      grain.push(`M${P(gx0, gy)}Q${P((gx0 + gx1) / 2, gy + (rnd() - 0.5) * 6, gx1, gy + (rnd() - 0.5) * 3)}`);
    }
    const cx = d.x + d.w / 2, label = !d.noLabel && rnd() < 0.62, py = d.y + d.h * (label ? 0.66 : 0.5);
    if (label) {
      const lw = Math.min(56, d.w * 0.56), lh = Math.min(26, d.h * 0.27), ly = d.y + d.h * 0.16;
      labels.push(rect(cx - lw / 2, ly, lw, lh, 3));
      icons.push(g({ transform: tf(cx, ly + lh / 2, 0, (lh / 24) * 0.95) }, ICONS[Math.floor(rnd() * ICONS.length)]()));
    }
    pulls.push(`<circle cx="${n(cx)}" cy="${n(py)}" r="9"/>`);
    rings.push(`M${P(cx - 9, py + 4)}A${P(10, 11)} 0 0 0 ${P(cx + 9, py + 4)}`);
  }
  return g({},
    g({ stroke: INK, strokeWidth: 3 }, faces),
    path(grain.join(''), { fill: 'none', stroke: '#3a1d0f', strokeOpacity: 0.22, strokeWidth: 2, strokeLinecap: 'round' }),
    path(hi.join(''), { fill: 'none', stroke: '#ffd9a8', strokeOpacity: 0.35, strokeWidth: 3, strokeLinecap: 'round', strokeLinejoin: 'round' }),
    path(sh.join(''), { fill: 'none', stroke: '#2b160c', strokeOpacity: 0.3, strokeWidth: 3, strokeLinecap: 'round', strokeLinejoin: 'round' }),
    g({ fill: 'url(#apPaper)', stroke: INK, strokeOpacity: 0.7, strokeWidth: 2 }, labels),
    icons.join(''),
    path(rings.join(''), { fill: 'none', stroke: INK, strokeWidth: 7, strokeLinecap: 'round' }),
    path(rings.join(''), { fill: 'none', stroke: '#e9b54c', strokeWidth: 3.5, strokeLinecap: 'round' }),
    g({ fill: 'url(#apBrassR)', stroke: INK, strokeWidth: 2.5 }, pulls));
}

/** A drawer pulled out a little, with dried flowers peeking over its rim. */
function openDrawer(d) {
  const dx = -10, dy = 16, x = d.x + dx, y = d.y + dy, w = d.w + 10, h = d.h - 4;
  const sprigs = [];
  const rnd = rng(9);
  for (let i = 0; i < 6; i++) {
    const sx = x + 12 + i * (w - 24) / 5, top = y - 22 - rnd() * 26;
    sprigs.push({ sx, top });
  }
  return g({},
    // dark opening behind
    path(rr(d.x, d.y, d.w, d.h, 4), { fill: '#1c0d06' }),
    // drawer box top edge seen from above + side
    path(`M${P(d.x, d.y)}L${P(x, y)}H${n(x + w)}L${P(d.x + d.w, d.y)}Z`, { fill: 'url(#apDrSide)', stroke: INK, strokeWidth: 3, strokeLinejoin: 'round' }),
    path(sprigs.map(({ sx, top }) => `M${P(sx, y + 6)}Q${P(sx + 4, (y + top) / 2, sx + (sx > x + w / 2 ? 8 : -6), top)}`).join(''), { fill: 'none', stroke: '#6b7a3a', strokeWidth: 3, strokeLinecap: 'round' }),
    sprigs.map(({ sx, top }, i) => path(circle(sx + (sx > x + w / 2 ? 8 : -6), top, 7), { fill: i % 2 ? '#c7a0e8' : '#f4d36a', stroke: INK, strokeWidth: 2 })).join(''),
    path(rr(x, y, w, h, 5), { fill: 'url(#apDr1)', stroke: INK, strokeWidth: 3.5 }),
    path(`M${P(x + 6, y + h - 8)}V${n(y + 6)}H${n(x + w - 8)}`, { fill: 'none', stroke: '#ffd9a8', strokeOpacity: 0.4, strokeWidth: 3, strokeLinecap: 'round' }),
    path(rr(x + 6, y + h - 2, w - 6, 10, 3), { fill: INK, fillOpacity: 0.35 }),
    path(circle(x + w / 2, y + h * 0.5, 9), { fill: 'url(#apBrassR)', stroke: INK, strokeWidth: 2.5 }),
    path(`M${P(x + w / 2 - 9, y + h * 0.5 + 4)}A10 11 0 0 0 ${P(x + w / 2 + 9, y + h * 0.5 + 4)}`, { fill: 'none', stroke: INK, strokeWidth: 7, strokeLinecap: 'round' }),
    path(`M${P(x + w / 2 - 9, y + h * 0.5 + 4)}A10 11 0 0 0 ${P(x + w / 2 + 9, y + h * 0.5 + 4)}`, { fill: 'none', stroke: '#e9b54c', strokeWidth: 3.5, strokeLinecap: 'round' }));
}

// ---- cabinet -------------------------------------------------------------------------------------
function woodGrain(x0, y0, x1, y1, seed, step = 10, alpha = 0.18) {
  const rnd = rng(seed), out = [];
  for (let y = y0 + 4; y < y1 - 2; y += step * (0.6 + rnd() * 0.9)) {
    const pts = [], amp = 1 + rnd() * 3, ph = rnd() * 6;
    for (let x = x0; x <= x1 + 40; x += 80) pts.push([Math.min(x, x1), y + amp * Math.sin(x * 0.01 + ph)]);
    out.push(L.smooth(pts));
  }
  return path(out.join(''), { fill: 'none', stroke: '#2b160c', strokeOpacity: alpha, strokeWidth: 2 });
}

function cornice() {
  const layers = [
    [150, 92, 1400, 22, 'apWoodDark'],
    [162, 114, 1376, 18, 'apWood'],
    [174, 132, 1352, 14, 'apWoodDark'],
  ];
  return g({},
    path(rr(152, 98, 1400, 54, 6), { fill: INK, fillOpacity: 0.3, transform: 'translate(0 10)' }),
    layers.map(([x, y, w, h, f]) => path(rr(x, y, w, h, 5), { fill: `url(#${f})`, stroke: INK, strokeWidth: 4 })).join(''),
    path('M164 100H1536', { stroke: '#ffd9a8', strokeOpacity: 0.35, strokeWidth: 3, strokeLinecap: 'round' }),
    // small carved brackets under the cornice ends
    path('M182 146H232Q222 176 196 182Q184 170 182 146Z', { fill: 'url(#apWoodDark)', stroke: INK, strokeWidth: 3.5, strokeLinejoin: 'round' }),
    path('M1518 146H1468Q1478 176 1504 182Q1516 170 1518 146Z', { fill: 'url(#apWoodDark)', stroke: INK, strokeWidth: 3.5, strokeLinejoin: 'round' }));
}

/** Lacquered niche around the screen: the calm ring. */
function niche(holeD) {
  return g({},
    path(rr(HF.x - 4, HF.y - 4, HF.w + 8, HF.h + 8, 14), { fill: INK }),
    path(rr(HF.x, HF.y, HF.w, HF.h, 12), { fill: 'url(#apLacquer)', stroke: INK, strokeWidth: 4 }),
    path(rr(HF.x + 8, HF.y + 8, HF.w - 16, HF.h - 16, 9), { fill: 'none', stroke: '#e0a85a', strokeOpacity: 0.35, strokeWidth: 2 }),
    path(rr(hole.x - 16, hole.y - 16, hole.w + 32, hole.h + 32, radius + 8), { fill: 'url(#apBrassV)', stroke: INK, strokeWidth: 3 }),
    path(rr(hole.x - 8, hole.y - 8, hole.w + 16, hole.h + 16, radius + 4), { fill: '#1a0c05' }),
    lip(holeD, '#000', [[7, 0.3], [3, 0.6]]),
    path(`M${HF.x + 12} ${HF.y + 140}V${HF.y + 24}Q${HF.x + 12} ${HF.y + 12} ${HF.x + 24} ${HF.y + 12}H${HF.x + 260}`, { fill: 'none', stroke: '#ffcf8a', strokeOpacity: 0.4, strokeWidth: 4, strokeLinecap: 'round' }));
}

// ---- things on and around the cabinet ------------------------------------------------------------
function lantern() {
  const x = 58, y = 806, w = 172, h = 252, cx = x + w / 2;
  const ribs = [];
  for (let yy = y + 30; yy < y + h - 10; yy += 30) ribs.push(`M${P(x + 6, yy)}Q${P(cx, yy + 8, x + w - 6, yy)}`);
  return g({},
    path(circle(cx, y + h * 0.5, 300), { fill: 'url(#apGlow)' }),
    // stand
    path(rr(cx - 70, TOP - 18, 140, 26, 8), { fill: 'url(#apWoodDark)', stroke: INK, strokeWidth: 4 }),
    path(`M${P(cx - 54, y + h - 4)}L${P(cx - 62, TOP - 16)}M${P(cx + 54, y + h - 4)}L${P(cx + 62, TOP - 16)}`, { stroke: INK, strokeWidth: 12, strokeLinecap: 'round' }),
    path(`M${P(cx - 54, y + h - 4)}L${P(cx - 62, TOP - 16)}M${P(cx + 54, y + h - 4)}L${P(cx + 62, TOP - 16)}`, { stroke: '#6a3a1c', strokeWidth: 6, strokeLinecap: 'round' }),
    // paper body
    path(rr(x, y, w, h, 34), { fill: 'url(#apPaperGlow)', stroke: INK, strokeWidth: 5 }),
    path(rr(x + 30, y + 16, w - 60, h - 32, 24), { fill: 'url(#apCore)' }),
    path(ribs.join(''), { fill: 'none', stroke: '#c9822e', strokeOpacity: 0.45, strokeWidth: 2.5 }),
    path(`M${P(cx, y + h * 0.5)}C${P(cx - 14, y + h * 0.5 + 20, cx - 12, y + h * 0.5 + 44, cx, y + h * 0.5 + 48)}C${P(cx + 12, y + h * 0.5 + 44, cx + 14, y + h * 0.5 + 20, cx, y + h * 0.5)}Z`, { fill: '#fffdf2', fillOpacity: 0.9 }),
    path(rr(cx - 10, y + h * 0.5 + 48, 20, 30, 4), { fill: '#f7e6c2', fillOpacity: 0.55 }),
    path(`M${P(x + 22, y + 34)}V${n(y + h - 40)}`, { stroke: '#fff', strokeOpacity: 0.6, strokeWidth: 6, strokeLinecap: 'round' }),
    // caps
    path(rr(x - 8, y - 14, w + 16, 26, 10), { fill: 'url(#apWoodDark)', stroke: INK, strokeWidth: 4 }),
    path(rr(x - 8, y + h - 12, w + 16, 24, 10), { fill: 'url(#apWoodDark)', stroke: INK, strokeWidth: 4 }),
    path(rr(cx - 26, y - 34, 52, 22, 8), { fill: 'url(#apWoodDark)', stroke: INK, strokeWidth: 3.5 }),
    path(`M${P(x + 4, y - 8)}H${n(x + w - 30)}`, { stroke: '#ffd9a8', strokeOpacity: 0.4, strokeWidth: 3, strokeLinecap: 'round' }));
}

function jar(cx, base, w, h, glaze, band, lidCol) {
  const sw = w / 2, neck = sw * 0.62, top = base - h;
  const body = `M${P(cx - neck, top + 22)}C${P(cx - sw * 1.08, top + 34, cx - sw, top + h * 0.45, cx - sw * 0.96, base - 26)}Q${P(cx - sw * 0.92, base, cx - sw * 0.6, base)}`
    + `H${n(cx + sw * 0.6)}Q${P(cx + sw * 0.92, base, cx + sw * 0.96, base - 26)}C${P(cx + sw, top + h * 0.45, cx + sw * 1.08, top + 34, cx + neck, top + 22)}Z`;
  const by = top + h * 0.42;
  return g({},
    path(ellipse(cx + 8, base, sw * 1.05, 10), { fill: INK, fillOpacity: 0.35 }),
    path(body, { fill: `url(#${glaze})`, stroke: INK, strokeWidth: 4.5, strokeLinejoin: 'round' }),
    g({ clipPath: `url(#apJarClip${Math.round(cx)})` },
      path(`M${P(cx - sw * 1.2, by)}Q${P(cx, by + 14, cx + sw * 1.2, by)}V${n(by + 18)}Q${P(cx, by + 32, cx - sw * 1.2, by + 18)}Z`, { fill: band }),
      path(body, { fill: 'url(#apJarShade)' })),
    path(rr(cx - sw * 0.38, by + 34, sw * 0.76, h * 0.26, 4), { fill: 'url(#apPaper)', stroke: INK, strokeOpacity: 0.7, strokeWidth: 2.5 }),
    path(rr(cx - 9, by + 34 + h * 0.13 - 9, 18, 18, 3), { fill: 'none', stroke: '#c0392b', strokeOpacity: 0.85, strokeWidth: 3 }),
    path(circle(cx, by + 34 + h * 0.13, 3.5), { fill: '#c0392b', fillOpacity: 0.85 }),
    path(`M${P(cx - sw * 0.72, top + 50)}Q${P(cx - sw * 0.86, top + h * 0.45, cx - sw * 0.74, base - 40)}`, { fill: 'none', stroke: '#fff', strokeOpacity: 0.75, strokeWidth: 6, strokeLinecap: 'round' }),
    // lid
    path(rr(cx - neck - 6, top + 6, neck * 2 + 12, 22, 9), { fill: `url(#${lidCol})`, stroke: INK, strokeWidth: 4 }),
    path(ellipse(cx, top + 4, neck * 0.5, 12), { fill: `url(#${lidCol})`, stroke: INK, strokeWidth: 4 }),
    path(ellipse(cx - 6, top, neck * 0.2, 4), { fill: '#fff', fillOpacity: 0.7 }));
}

const potBody = (cx, base) => `M${P(cx - 104, base - 70)}C${P(cx - 104, base - 140, cx - 60, base - 158, cx, base - 158)}C${P(cx + 60, base - 158, cx + 104, base - 140, cx + 104, base - 70)}`
  + `C${P(cx + 104, base - 22, cx + 70, base - 6, cx, base - 6)}C${P(cx - 70, base - 6, cx - 104, base - 22, cx - 104, base - 70)}Z`;
const BASKET = { tw: 300, bw: 236, h: 96 };
const basketBody = (cx, base) => { const { tw, bw, h } = BASKET, top = base - h;
  return `M${P(cx - tw / 2, top)}H${n(cx + tw / 2)}L${P(cx + bw / 2, base - 8)}Q${P(cx + bw / 2 - 4, base, cx + bw / 2 - 14, base)}H${n(cx - bw / 2 + 14)}Q${P(cx - bw / 2 + 4, base, cx - bw / 2, base - 8)}Z`; };

function teapot(cx, base) {
  const body = potBody(cx, base);
  const spout = `M${P(cx + 92, base - 92)}C${P(cx + 130, base - 96, cx + 140, base - 130, cx + 160, base - 150)}L${P(cx + 172, base - 140)}C${P(cx + 160, base - 104, cx + 140, base - 56, cx + 96, base - 50)}Z`;
  const bail = `M${P(cx - 74, base - 140)}C${P(cx - 80, base - 226, cx + 80, base - 226, cx + 74, base - 140)}`;
  return g({},
    path(ellipse(cx + 12, base, 140, 14), { fill: INK, fillOpacity: 0.4 }),
    path(bail, { fill: 'none', stroke: INK, strokeWidth: 16, strokeLinecap: 'round' }),
    path(bail, { fill: 'none', stroke: '#3a3f4a', strokeWidth: 8, strokeLinecap: 'round' }),
    path(`M${P(cx - 60, base - 186)}Q${P(cx - 20, base - 206, cx + 20, base - 204)}`, { fill: 'none', stroke: '#9aa3b4', strokeOpacity: 0.6, strokeWidth: 3, strokeLinecap: 'round' }),
    path(spout, { fill: 'url(#apIron)', stroke: INK, strokeWidth: 4.5, strokeLinejoin: 'round' }),
    path(body, { fill: 'url(#apIron)', stroke: INK, strokeWidth: 5 }),
    g({ clipPath: 'url(#apPotClip)' },
      path(rr(cx - 110, base - 152, 220, 76, 0), { fill: 'url(#apHob)' }),
      path(body, { fill: 'url(#apIronShade)' })),
    path(rr(cx - 104, base - 82, 208, 14, 6), { fill: '#1d2026', stroke: INK, strokeWidth: 3 }),
    // lid and knob
    path(ellipse(cx, base - 156, 52, 14), { fill: 'url(#apIron)', stroke: INK, strokeWidth: 4 }),
    path(ellipse(cx, base - 172, 14, 12), { fill: 'url(#apIron)', stroke: INK, strokeWidth: 3.5 }),
    path(ellipse(cx - 4, base - 176, 5, 3), { fill: '#cfd6e4', fillOpacity: 0.6 }),
    path(`M${P(cx - 74, base - 116)}Q${P(cx - 84, base - 80, cx - 66, base - 44)}`, { fill: 'none', stroke: '#c9d2e3', strokeOpacity: 0.55, strokeWidth: 6, strokeLinecap: 'round' }),
    // bail lugs
    path(circle(cx - 74, base - 140, 8), { fill: '#3a3f4a', stroke: INK, strokeWidth: 3 }),
    path(circle(cx + 74, base - 140, 8), { fill: '#3a3f4a', stroke: INK, strokeWidth: 3 }),
    // a curl of steam
    path(`M${P(cx + 170, base - 166)}C${P(cx + 150, base - 196, cx + 196, base - 214, cx + 176, base - 248)}C${P(cx + 160, base - 272, cx + 198, base - 290, cx + 186, base - 314)}`, { fill: 'none', stroke: '#fff7ea', strokeOpacity: 0.32, strokeWidth: 10, strokeLinecap: 'round', class: 'ap-steam' }));
}

function mandarin(cx, cy, r, leaf = 0) {
  const rnd = rng(Math.round(cx * 3 + cy)), dots = [];
  for (let i = 0; i < 9; i++) { const a = rnd() * 6.28, d = rnd() * r * 0.75; dots.push(circle(cx + d * Math.cos(a), cy + d * Math.sin(a), 1.4)); }
  return g({},
    path(circle(cx, cy, r), { fill: 'url(#apOrange)', stroke: INK, strokeWidth: 4 }),
    path(dots.join(''), { fill: '#c45a0a', fillOpacity: 0.4 }),
    path(ellipse(cx - r * 0.38, cy - r * 0.4, r * 0.24, r * 0.14), { fill: '#fff', fillOpacity: 0.7, transform: `rotate(-35 ${n(cx - r * 0.38)} ${n(cy - r * 0.4)})` }),
    path(L.star(cx + r * 0.1, cy - r * 0.86, 6, 2.6, 5), { fill: '#4d7a2a', stroke: INK, strokeWidth: 1.6 }),
    leaf ? path(`M${P(cx + r * 0.1, cy - r * 0.9)}C${P(cx + r * 0.5 * leaf, cy - r * 1.6, cx + r * 1.2 * leaf, cy - r * 1.4, cx + r * 1.3 * leaf, cy - r * 1.2)}C${P(cx + r * 1 * leaf, cy - r * 0.9, cx + r * 0.5 * leaf, cy - r * 0.8, cx + r * 0.1, cy - r * 0.9)}Z`, { fill: 'url(#apLeaf)', stroke: INK, strokeWidth: 3, strokeLinejoin: 'round' }) : '');
}

/** A mandarin with its peel opened into a star around the fruit, seen a little from above. */
function peeled(cx, base) {
  const cy = base - 22, petals = [], pith = [];
  for (let i = 0; i < 5; i++) {
    const a = ((i * 72 - 90) * Math.PI) / 180, sq = 0.36;
    const tip = [cx + Math.cos(a) * 78, cy + Math.sin(a) * 78 * sq];
    const l = [cx + Math.cos(a - 0.6) * 26, cy + Math.sin(a - 0.6) * 26 * sq], r = [cx + Math.cos(a + 0.6) * 26, cy + Math.sin(a + 0.6) * 26 * sq];
    const cl = [cx + Math.cos(a - 0.34) * 70, cy + Math.sin(a - 0.34) * 70 * sq], cr = [cx + Math.cos(a + 0.34) * 70, cy + Math.sin(a + 0.34) * 70 * sq];
    petals.push(`M${P(...l)}Q${P(...cl)} ${P(...tip)}Q${P(...cr)} ${P(...r)}Z`);
    const k = 0.72, tipI = [cx + Math.cos(a) * 78 * k, cy + Math.sin(a) * 78 * sq * k];
    pith.push(`M${P(...l)}Q${P(cx + Math.cos(a - 0.3) * 54, cy + Math.sin(a - 0.3) * 54 * sq)} ${P(...tipI)}Q${P(cx + Math.cos(a + 0.3) * 54, cy + Math.sin(a + 0.3) * 54 * sq)} ${P(...r)}Z`);
  }
  const fy = cy - 14, segs = [];
  for (let i = 0; i < 6; i++) { const a = (i * 60 * Math.PI) / 180; segs.push(`M${P(cx, fy - 2)}L${P(cx + Math.cos(a) * 24, fy - 2 + Math.sin(a) * 15)}`); }
  return g({},
    path(ellipse(cx + 6, base - 4, 82, 14), { fill: INK, fillOpacity: 0.3 }),
    path(petals.join(''), { fill: 'url(#apOrange)', stroke: INK, strokeWidth: 3.5, strokeLinejoin: 'round' }),
    path(pith.join(''), { fill: 'url(#apPith)' }),
    path(ellipse(cx + 3, fy + 12, 32, 12), { fill: INK, fillOpacity: 0.3 }),
    path(ellipse(cx, fy, 31, 24), { fill: 'url(#apFlesh)', stroke: INK, strokeWidth: 4 }),
    path(segs.join(''), { fill: 'none', stroke: '#e0862a', strokeOpacity: 0.75, strokeWidth: 2.2, strokeLinecap: 'round' }),
    path(ellipse(cx - 11, fy - 9, 9, 5), { fill: '#fff', fillOpacity: 0.65, transform: `rotate(-24 ${n(cx - 11)} ${n(fy - 9)})` }));
}

function basket(cx, base) {
  const { tw, bw, h } = BASKET, top = base - h;
  const body = basketBody(cx, base);
  const fruit = [[-100, -12, 40], [-26, -22, 42], [52, -16, 40], [118, -6, 34], [-64, -64, 40, -1], [16, -70, 42, 1], [86, -52, 36], [-20, -112, 38, 1]];
  return g({},
    path(ellipse(cx + 12, base, tw * 0.55, 14), { fill: INK, fillOpacity: 0.4 }),
    fruit.map(([dx, dy, r, lf]) => mandarin(cx + dx, top + dy, r, lf || 0)).join(''),
    path(body, { fill: 'url(#apBamboo)', stroke: INK, strokeWidth: 4.5, strokeLinejoin: 'round' }),
    g({ clipPath: 'url(#apBasketClip)' },
      path(body, { fill: 'url(#apWeave)' }),
      path(body, { fill: 'url(#apBasketShade)' })),
    path(rr(cx - tw / 2 - 8, top - 10, tw + 16, 20, 10), { fill: 'url(#apBamboo)', stroke: INK, strokeWidth: 4 }),
    path(`M${P(cx - tw / 2 + 6, top - 4)}H${n(cx + tw / 2 - 20)}`, { stroke: '#fff3d0', strokeOpacity: 0.6, strokeWidth: 3, strokeLinecap: 'round', strokeDasharray: '18 10' }));
}

/** Green cloth runner under the teapot, hanging over the counter edge. */
function runner(x0, x1) {
  const d = `M${P(x0, TOP + 2)}H${n(x1)}L${P(x1 + 6, 1300)}H${n(x0 - 6)}Z`;
  const fringe = [];
  for (let x = x0 - 2; x <= x1 + 2; x += 10) fringe.push(`M${P(x, 1300)}v16`);
  const dots = [];
  for (let y = 1190; y < 1290; y += 26) for (let x = x0 + 22; x < x1 - 10; x += 26) dots.push(L.chamfer(x - 4 + ((y / 26) % 2) * 13, y - 4, 8, 8, 3));
  return g({},
    path(d, { fill: INK, fillOpacity: 0.3, transform: 'translate(5 8)' }),
    path(d, { fill: 'url(#apCloth)', stroke: INK, strokeWidth: 4, strokeLinejoin: 'round' }),
    path(dots.join(''), { fill: '#d9c98a', fillOpacity: 0.55 }),
    path(`M${P(x0 + 4, 1278)}H${n(x1 - 4)}M${P(x0 + 4, 1286)}H${n(x1 - 4)}`, { stroke: '#d9c98a', strokeOpacity: 0.8, strokeWidth: 3 }),
    path(fringe.join(''), { stroke: INK, strokeWidth: 5, strokeLinecap: 'round' }),
    path(fringe.join(''), { stroke: '#3f8a63', strokeWidth: 2.5, strokeLinecap: 'round' }),
    path(`M${P(x0 + 2, TOP + 4)}H${n(x1 - 2)}V${n(TOP + 30)}H${n(x0 + 2)}Z`, { fill: '#1f5a40', fillOpacity: 0.45 }));
}

function packets(x, y) {
  const one = (px, py, w, h, col, rot) => g({ transform: tf(px, py, rot) },
    path(rr(-w / 2, -h, w, h, 6), { fill: col, stroke: INK, strokeWidth: 4 }),
    path(`M${P(-w / 2, -h * 0.55)}H${n(w / 2)}M0 ${n(-h)}V0`, { stroke: '#b03a2e', strokeWidth: 4 }),
    path(`M${P(-w / 2 + 8, -h + 8)}H${n(w / 2 - 16)}`, { stroke: '#fff', strokeOpacity: 0.6, strokeWidth: 3, strokeLinecap: 'round' }));
  const bx = x + 4, by = y - 116;
  return g({}, one(x, y, 120, 46, 'url(#apKraft)', -2), one(x - 8, y - 44, 104, 40, 'url(#apPaper)', 3), one(x + 4, y - 82, 86, 34, 'url(#apKraft)', -4),
    path(`M${P(bx, by + 4)}C${P(bx - 22, by - 14, bx - 30, by + 6, bx - 4, by + 6)}M${P(bx, by + 4)}C${P(bx + 22, by - 14, bx + 30, by + 6, bx + 4, by + 6)}M${P(bx - 2, by + 6)}L${P(bx - 12, by + 22)}M${P(bx + 2, by + 6)}L${P(bx + 14, by + 20)}`, { fill: 'none', stroke: '#b03a2e', strokeWidth: 3.5, strokeLinecap: 'round' }));
}

function pottedHerb(cx, base) {
  const leaves = [[-34, -70, -40], [-14, -96, -14], [12, -100, 12], [34, -74, 38], [0, -80, 0], [-44, -40, -64], [44, -44, 62]];
  return g({},
    leaves.map(([dx, dy, rot]) => g({ transform: tf(cx + dx * 0.4, base - 44, rot) },
      path(`M0 0C-14 ${n(dy * 0.3)} -12 ${n(dy * 0.8)} 0 ${n(dy)}C12 ${n(dy * 0.8)} 14 ${n(dy * 0.3)} 0 0Z`, { fill: 'url(#apLeaf)', stroke: INK, strokeWidth: 3, strokeLinejoin: 'round' }),
      path(`M0 -6V${n(dy * 0.85)}`, { stroke: '#2c5a1e', strokeOpacity: 0.6, strokeWidth: 2 }))).join(''),
    path(`M${P(cx - 46, base - 50)}H${n(cx + 46)}L${P(cx + 36, base)}H${n(cx - 36)}Z`, { fill: 'url(#apCeladon)', stroke: INK, strokeWidth: 4, strokeLinejoin: 'round' }),
    path(rr(cx - 52, base - 58, 104, 16, 6), { fill: 'url(#apCeladon)', stroke: INK, strokeWidth: 4 }),
    path(`M${P(cx - 34, base - 36)}L${P(cx - 28, base - 8)}`, { stroke: '#fff', strokeOpacity: 0.6, strokeWidth: 5, strokeLinecap: 'round' }));
}

/** Dried herb bundle hanging from a peg on the cabinet side. */
function hangingBundle(x, y, col = '#a98ad6', seed = 23) {
  const stems = [], heads = [];
  const rnd = rng(seed);
  for (let i = 0; i < 9; i++) {
    const a = -0.5 + i / 8, ex = x + a * 70, ey = y + 210 + rnd() * 40;
    stems.push(`M${P(x + a * 14, y + 50)}Q${P(x + a * 40, y + 130, ex, ey)}`);
    for (let k = 0; k < 4; k++) heads.push(ellipse(ex - a * k * 6, ey - k * 14, 5, 8));
  }
  return g({},
    path(`M${P(x - 6, 150)}L${P(x - 8, y + 40)}M${P(x + 6, 150)}L${P(x + 8, y + 40)}`, { stroke: INK, strokeWidth: 6, strokeLinecap: 'round' }),
    path(`M${P(x - 6, 150)}L${P(x - 8, y + 40)}M${P(x + 6, 150)}L${P(x + 8, y + 40)}`, { stroke: '#d4473a', strokeWidth: 3, strokeLinecap: 'round' }),
    path(stems.join(''), { fill: 'none', stroke: INK, strokeWidth: 6, strokeLinecap: 'round' }),
    path(stems.join(''), { fill: 'none', stroke: '#8a8a3e', strokeWidth: 3, strokeLinecap: 'round' }),
    path(heads.join(''), { fill: col, stroke: INK, strokeWidth: 2 }),
    path(rr(x - 18, y + 36, 36, 22, 6), { fill: '#b03a2e', stroke: INK, strokeWidth: 3.5 }),
    path(`M${P(x - 12, y + 42)}H${n(x + 8)}`, { stroke: '#fff', strokeOpacity: 0.5, strokeWidth: 2.5, strokeLinecap: 'round' }));
}

function counter() {
  const panels = [[120, 1222, 420, 150], [640, 1222, 420, 150], [1160, 1222, 420, 150]];
  return g({},
    path(rr(70, 1150, 1570, 270, 10), { fill: INK, fillOpacity: 0.3, transform: 'translate(0 10)' }),
    // front
    path(rr(80, 1180, 1540, 222, 6), { fill: 'url(#apWood)', stroke: INK, strokeWidth: 5 }),
    g({ clipPath: 'url(#apCounterClip)' }, woodGrain(80, 1180, 1620, 1402, 41, 12, 0.14)),
    panels.map(([x, y, w, h]) => {
      const cx = x + w / 2, py = y + 100;
      return path(rr(x, y, w, h, 6), { fill: 'url(#apPanel)', stroke: INK, strokeWidth: 3.5 })
        + path(`M${P(x + 6, y + h - 6)}H${n(x + w - 6)}V${n(y + 6)}`, { fill: 'none', stroke: '#ffd9a8', strokeOpacity: 0.3, strokeWidth: 3 })
        // brass bail pull: back plate, two posts and a swinging handle
        + path(rr(cx - 62, py - 16, 124, 32, 14), { fill: 'url(#apBrassV)', stroke: INK, strokeWidth: 3 })
        + path(rr(cx - 50, py - 8, 100, 16, 8), { fill: '#7a4a18', fillOpacity: 0.35 })
        + path(`M${P(cx - 46, py)}C${P(cx - 46, py + 34, cx + 46, py + 34, cx + 46, py)}`, { fill: 'none', stroke: INK, strokeWidth: 10, strokeLinecap: 'round' })
        + path(`M${P(cx - 46, py)}C${P(cx - 46, py + 34, cx + 46, py + 34, cx + 46, py)}`, { fill: 'none', stroke: '#e9b54c', strokeWidth: 5, strokeLinecap: 'round' })
        + path(circle(cx - 46, py, 7) + circle(cx + 46, py, 7), { fill: 'url(#apBrassR)', stroke: INK, strokeWidth: 2.5 });
    }).join(''),
    // feet
    path(rr(96, 1398, 60, 24, 5) + rr(1544, 1398, 60, 24, 5), { fill: 'url(#apWoodDark)', stroke: INK, strokeWidth: 4 }),
    // thick top slab: top face and front edge
    path(`M${P(60, TOP + 14)}L${P(78, TOP - 12)}H${n(1622)}L${P(1640, TOP + 14)}Z`, { fill: 'url(#apTopFace)', stroke: INK, strokeWidth: 4, strokeLinejoin: 'round' }),
    path(rr(56, TOP + 12, 1588, 42, 8), { fill: 'url(#apWood)', stroke: INK, strokeWidth: 5 }),
    path(`M${P(70, TOP + 20)}H1630`, { stroke: '#ffd9a8', strokeOpacity: 0.45, strokeWidth: 3, strokeLinecap: 'round' }),
    path(`M${P(70, TOP + 48)}H1630`, { stroke: INK, strokeOpacity: 0.3, strokeWidth: 4, strokeLinecap: 'round' }));
}

function draw() {
  const holeD = rr(hole.x, hole.y, hole.w, hole.h, radius);
  // drawer layout around the niche
  const left = grid(IN.x0, IN.y0, HF.x - 8, IN.y1, 2, 10), right = grid(HF.x + HF.w + 8, IN.y0, IN.x1, IN.y1, 2, 10);
  const top = grid(HF.x, IN.y0, HF.x + HF.w, HF.y - 8, 6, 1), bottom = grid(HF.x, HF.y + HF.h + 8, HF.x + HF.w, IN.y1, 6, 3);
  const opened = right[2 * 5 + 1];
  opened.skip = true;
  const jars = [[312, 108, 186, 'apGlazeCream', '#2f4f86', 'apCeladon'], [432, 92, 140, 'apCeladon', '#2f6f58', 'apGlazeCream'], [540, 76, 112, 'apGlazeCream', '#b03a2e', 'apIron']];

  const defs = [
    '<style>.ap-flame{animation:apFlicker 2.8s ease-in-out infinite alternate}@keyframes apFlicker{0%{opacity:1}35%{opacity:.86}60%{opacity:.97}100%{opacity:.9}}'
      + '.ap-steam{animation:apSteam 4s ease-in-out infinite alternate}@keyframes apSteam{0%{opacity:.25;transform:translateY(4px)}100%{opacity:.6;transform:translateY(-6px)}}'
      + '@media (prefers-reduced-motion:reduce){*{animation:none!important}}</style>',
    lg('apDr0', [0, 0, 1, 1], [[0, '#c27b45'], [0.6, '#a3602f'], [1, '#8a4c24']]),
    lg('apDr1', [0, 0, 1, 1], [[0, '#b8703c'], [0.6, '#985628'], [1, '#7e4420']]),
    lg('apDr2', [0, 0, 1, 1], [[0, '#c8844e'], [0.6, '#aa6634'], [1, '#905126']]),
    lg('apDrSide', [0, 0, 0, 1], [[0, '#d7955c'], [1, '#a8662f']]),
    lg('apWood', [0, 0, 0, 1], [[0, '#b46d3a'], [0.5, '#9a5a2e'], [1, '#7c4422']]),
    lg('apWoodDark', [0, 0, 0, 1], [[0, '#7a4424'], [0.5, '#5e3119'], [1, '#43210f']]),
    lg('apCarcass', [0, 0, 1, 0], [[0, '#4a2412'], [0.5, '#5a2e17'], [1, '#3e1d0e']]),
    lg('apTopFace', [0, 0, 0, 1], [[0, '#d99a62'], [1, '#bb7a44']]),
    lg('apPanel', [0, 0, 0, 1], [[0, '#7e4523'], [1, '#93542c']]),
    lg('apLacquer', [0, 0, 1, 1], [[0, '#6a3218'], [0.5, '#4a200e'], [1, '#3a1709']]),
    lg('apBrassV', [0, 0, 0, 1], [[0, '#ffe7a3'], [0.45, '#d9a443'], [1, '#9c6a1e']]),
    rg('apBrassR', [0.35, 0.3, 0.8], [[0, '#fff2c2'], [0.5, '#e7b44e'], [1, '#9a6514']]),
    lg('apPaper', [0, 0, 0, 1], [[0, '#fbf3dc'], [1, '#e9d9b2']]),
    lg('apKraft', [0, 0, 0, 1], [[0, '#e3c08a'], [1, '#c79a5e']]),
    rg('apGlow', [0.5, 0.5, 0.5], [[0, '#ffc766', 0.38], [0.35, '#ffb347', 0.2], [1, '#ffb347', 0]]),
    lg('apPaperGlow', [0, 0, 1, 0], [[0, '#ffb34a'], [0.3, '#ffd884'], [0.55, '#ffe6a6'], [1, '#ffa83e']]),
    rg('apCore', [0.5, 0.55, 0.6], [[0, '#fffbe8', 0.95], [0.5, '#fff1c4', 0.55], [1, '#ffe2a0', 0]]),
    rg('apWarm', [150, 930, 1300], [[0, '#ffb347', 0.34], [0.35, '#ffa040', 0.12], [0.7, '#1a0904', 0.06], [1, '#1a0904', 0.24]], true),
    lg('apGlazeCream', [0, 0, 1, 0], [[0, '#fffaf0'], [0.55, '#f1e6cf'], [1, '#d3c3a2']]),
    lg('apCeladon', [0, 0, 1, 0], [[0, '#d6eedc'], [0.55, '#9ccbae'], [1, '#6a9f80']]),
    lg('apJarShade', [0, 0, 1, 0], [[0, '#fff', 0.15], [0.5, '#fff', 0], [1, INK, 0.25]]),
    lg('apIron', [0, 0, 1, 1], [[0, '#4a505d'], [0.5, '#2b2f37'], [1, '#15171c']]),
    rg('apIronShade', [0.35, 0.3, 0.8], [[0, '#8f9ab0', 0.22], [0.5, '#000', 0], [1, '#000', 0.35]]),
    rg('apOrange', [0.38, 0.32, 0.8], [[0, '#ffc46a'], [0.5, '#ff9a2a'], [1, '#e2700e']]),
    rg('apFlesh', [0.4, 0.35, 0.8], [[0, '#ffe2a2'], [1, '#ffb24a']]),
    rg('apPith', [0.5, 0.5, 0.6], [[0, '#fff6e2'], [0.6, '#ffe6bd'], [1, '#ffc27a']]),
    lg('apLeaf', [0, 0, 1, 1], [[0, '#8fcf6a'], [1, '#3f8a3a']]),
    lg('apBamboo', [0, 0, 0, 1], [[0, '#f0c27a'], [1, '#c48a42']]),
    `<pattern id="apHob" x="850" y="992" width="15" height="36" patternUnits="userSpaceOnUse"><path d="${circle(7.5, 9, 4.6)}${circle(0, 27, 4.6)}${circle(15, 27, 4.6)}" fill="#2a2e36" stroke="#0c0d10" stroke-width="1.6"/>`
      + `<path d="${circle(6, 7.4, 1.6)}${circle(-1.5, 25.4, 1.6)}${circle(13.5, 25.4, 1.6)}" fill="#aab3c4" fill-opacity="0.55"/></pattern>`,
    '<pattern id="apWeave" x="1170" y="1052" width="16" height="34" patternUnits="userSpaceOnUse"><path d="M0 10q8 -6 16 0M-8 27q8 -6 16 0M8 27q8 -6 16 0" fill="none" stroke="#8a5a22" stroke-opacity="0.7" stroke-width="4" stroke-linecap="round"/>'
      + '<path d="M0 8q8 -6 16 0M-8 25q8 -6 16 0M8 25q8 -6 16 0" fill="none" stroke="#ffe2a8" stroke-opacity="0.5" stroke-width="1.6" stroke-linecap="round"/></pattern>',
    lg('apBasketShade', [0, 0, 1, 0], [[0, INK, 0.2], [0.4, INK, 0], [1, INK, 0.3]]),
    lg('apCloth', [0, 0, 0, 1], [[0, '#3f8a63'], [1, '#2a6a4a']]),
    `<clipPath id="apCounterClip"><path d="${rr(80, 1180, 1540, 222, 6)}"/></clipPath>`,
    `<clipPath id="apCabClip"><path d="${rr(CAB.x, CAB.y, CAB.w, CAB.h, 4)}"/></clipPath>`,
    `<clipPath id="apPotClip"><path d="${potBody(960, TOP + 6)}"/></clipPath>`,
    `<clipPath id="apBasketClip"><path d="${basketBody(1320, TOP + 6)}"/></clipPath>`,
    ...jars.map(([cx, w, h]) => {
      const sw = w / 2, neck = sw * 0.62, b = TOP + 6, t = b - h;
      return `<clipPath id="apJarClip${cx}"><path d="M${P(cx - neck, t + 22)}C${P(cx - sw * 1.08, t + 34, cx - sw, t + h * 0.45, cx - sw * 0.96, b - 26)}Q${P(cx - sw * 0.92, b, cx - sw * 0.6, b)}H${n(cx + sw * 0.6)}Q${P(cx + sw * 0.92, b, cx + sw * 0.96, b - 26)}C${P(cx + sw, t + h * 0.45, cx + sw * 1.08, t + 34, cx + neck, t + 22)}Z"/></clipPath>`;
    }),
  ].join('');

  const body = [
    // cabinet carcass
    path(rr(CAB.x + 8, CAB.y + 12, CAB.w, CAB.h, 4), { fill: INK, fillOpacity: 0.35 }),
    path(rr(CAB.x, CAB.y, CAB.w, CAB.h, 4), { fill: 'url(#apCarcass)', stroke: INK, strokeWidth: 6 }),
    drawers(left, 3), drawers(right, 5), drawers(top, 7), drawers(bottom, 11),
    openDrawer(opened),
    // warm lantern light washing over the drawers
    g({ clipPath: 'url(#apCabClip)' }, path(rr(CAB.x, CAB.y, CAB.w, CAB.h, 4), { fill: 'url(#apWarm)' })),
    niche(holeD),
    cornice(),
    packets(1380, 92), pottedHerb(300, 92),
    hangingBundle(1540, 190), hangingBundle(160, 190, '#f2cf5b', 31),
    counter(),
    runner(820, 1100),
    g({ class: 'ap-flame' }, lantern()),
    jars.map(([cx, w, h, glz, band, lid]) => jar(cx, TOP + 6, w, h, glz, band, lid)).join(''),
    peeled(668, TOP + 8),
    teapot(960, TOP + 6),
    basket(1320, TOP + 6),
    mandarin(1560, TOP - 26, 34, 1),
    path(sparkle(1620, 760, 12), { fill: '#fff4cc', fillOpacity: 0.9 }),
    path(sparkle(110, 700, 14), { fill: '#fff4cc', fillOpacity: 0.9 }),
  ].join('\n');
  return { defs, body: g({ transform: `translate(0 ${OY})` }, body) };
}

module.exports = {
  W, H, hole: { ...hole, y: hole.y + OY }, radius, draw,
  meta: {
    name: 'Apothecary', theme: 'apothecary', rarity: 'epic', translucent: false, collection: 'curio-cabinet', license: 'CC-BY-4.0',
    desc: 'Set your game into a wall of tiny herb drawers, with a paper lantern glowing, the kettle warm and a basket of mandarins within reach.',
    tags: ['apothecary', 'herbal', 'cabinet', 'wood', 'lantern', 'cozy', 'mandarin'],
  },
};
