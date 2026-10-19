'use strict';
// Capsule-toy vending machine: a clear glass globe heaped with two-tone capsules (some with tiny faces)
// around a chrome-ringed rounded-square porthole screen, on a candy-red base with a coin slot and price
// plate, a big chrome crank, marquee bulbs, a capsule exit flap (one capsule just popped out) and a
// capsule-buddy sticker. Original Kayboro artwork, CC BY 4.0.
const L = require('../lib');
const { rr, path, g, lg, rg, circle, ellipse, sparkle, star, heart, tf, rng, lip, n } = L;

const W = 1100, H = 1500, hole = { x: 290, y: 290, w: 520, h: 520 }, radius = 120;
const GX = 550, GY = 580, GR = 450; // glass globe
const INK = '#3b1430';
const BASE = 'M236 992H864Q918 992 924 1046L956 1376Q960 1424 912 1424H188Q140 1424 144 1376L176 1046Q182 992 236 992Z';
const CAPS = [ // [top half, bottom half]
  ['#ff5f9f', '#fff4ea'], ['#22cdb2', '#fff4ea'], ['#ffc21f', '#ff7a4a'], ['#3f9bff', '#fff4ea'], ['#9d6bff', '#ff8fc4'], ['#ff5f9f', '#ffd84a'], ['#22cdb2', '#3f9bff'],
];

/** One two-tone capsule. Halves rotate; the shading overlay does not, so light stays top-left. */
function capsule(cx, cy, r, rot, ci, face = 0, dim = 0) {
  const [a, b] = CAPS[ci % CAPS.length];
  const kids = [
    g({ transform: `rotate(${n(rot)})` },
      path(`M${-r} 0A${r} ${r} 0 0 1 ${r} 0Z`, { fill: a }),
      path(`M${-r} 0A${r} ${r} 0 0 0 ${r} 0Z`, { fill: b }),
      path(`M${-r} ${n(r * 0.05)}H${r}`, { stroke: INK, strokeOpacity: 0.35, strokeWidth: n(r * 0.12) }),
      path(`M${n(-r + 2)} ${n(-r * 0.06)}H${n(r - 2)}`, { stroke: '#fff', strokeOpacity: 0.55, strokeWidth: n(r * 0.05) }),
      face ? capFace(r, face) : ''),
    path(circle(0, 0, r), { fill: 'url(#capShade)' }),
    dim ? path(circle(0, 0, r), { fill: '#4b2a78', fillOpacity: dim }) : '',
    path(circle(0, 0, r), { fill: 'none', stroke: INK, strokeWidth: n(Math.max(3, r * 0.08)) }),
    dim ? '' : path(ellipse(-r * 0.4, -r * 0.46, r * 0.26, r * 0.14), { fill: '#fff', fillOpacity: 0.85, transform: `rotate(-35 ${n(-r * 0.4)} ${n(-r * 0.46)})` }),
  ];
  return g({ transform: tf(cx, cy) }, ...kids);
}

/** Tiny face in the capsule's own (rotated) frame, sitting on the lower half. */
function capFace(r, kind) {
  const ey = r * 0.34, ex = r * 0.3, s = r * 0.085;
  const cheeks = path(ellipse(-ex - s * 1.6, ey + s * 2.4, s * 1.5, s * 0.9) + ellipse(ex + s * 1.6, ey + s * 2.4, s * 1.5, s * 0.9), { fill: '#ff7eb0', fillOpacity: 0.55 });
  let eyes;
  if (kind === 1) eyes = path(circle(-ex, ey, s) + circle(ex, ey, s), { fill: INK });
  else if (kind === 2) eyes = path(`M${n(-ex - s * 1.2)} ${n(ey + s * 0.4)}Q${n(-ex)} ${n(ey - s * 1.4)} ${n(-ex + s * 1.2)} ${n(ey + s * 0.4)}M${n(ex - s * 1.2)} ${n(ey + s * 0.4)}Q${n(ex)} ${n(ey - s * 1.4)} ${n(ex + s * 1.2)} ${n(ey + s * 0.4)}`, { fill: 'none', stroke: INK, strokeWidth: n(s * 0.9), strokeLinecap: 'round' });
  else eyes = path(circle(-ex, ey, s), { fill: INK }) + path(`M${n(ex - s * 1.2)} ${n(ey)}H${n(ex + s * 1.2)}`, { stroke: INK, strokeWidth: n(s * 0.9), strokeLinecap: 'round' });
  const mouth = path(`M${n(-s * 1.2)} ${n(ey + s * 1.6)}Q0 ${n(ey + s * 3.2)} ${n(s * 1.2)} ${n(ey + s * 1.6)}`, { fill: 'none', stroke: INK, strokeWidth: n(s * 0.8), strokeLinecap: 'round' });
  return cheeks + eyes + mouth;
}

/** Capsules heaped inside the globe: a dimmed back layer, then a front layer filling the gaps. */
function pile() {
  const rnd = rng(77), back = [], front = [];
  const fillLine = (x) => 296 + 26 * Math.sin(x / 70) + 18 * Math.cos(x / 41);
  const inBezel = (x, y, r) => x > 236 + r && x < 864 - r && y > 236 + r && y < 864 - r; // fully hidden
  const fits = (list, x, y, r, k) => list.every((c) => Math.hypot(c[0] - x, c[1] - y) >= (c[2] + r) * k);
  for (const [list, tries, k, others] of [[back, 5000, 0.97, null], [front, 9000, 0.98, back]]) {
    for (let i = 0; i < tries; i++) {
      const r = 40 + rnd() * 20, x = 110 + rnd() * 880, y = 170 + rnd() * 860;
      if (Math.hypot(x - GX, y - GY) + r * 0.45 > GR || y < fillLine(x) || y > 1000 || inBezel(x, y, r)) continue;
      if (!fits(list, x, y, r, k)) continue;
      if (others && !fits(others, x, y, r, 0.62)) continue;
      list.push([x, y, r, rnd() * 360 - 180, Math.floor(rnd() * CAPS.length)]);
    }
  }
  let faces = 0;
  const out = back.map(([x, y, r, rot, ci]) => capsule(x, y, r * 0.94, rot, ci, 0, 0.24));
  front.sort((p, q) => p[1] - q[1]);
  for (const [x, y, r, rot, ci] of front) {
    const visible = !(x > 236 && x < 864 && y > 236 && y < 864) && y < 930;
    const face = visible && faces < 7 && (Math.round(x + y) % 3 === 0) ? 1 + (faces++ % 3) : 0;
    out.push(capsule(x, y, r, face ? rot * 0.25 : rot, ci, face));
  }
  return out.join('');
}

function topCap() {
  return g({},
    path(ellipse(GX, 164, 116, 12), { fill: INK, fillOpacity: 0.28 }),
    path('M440 132Q446 70 550 62Q654 70 660 132Z', { fill: 'url(#red)', stroke: INK, strokeWidth: 7, strokeLinejoin: 'round' }),
    path('M470 112Q484 84 540 78', { fill: 'none', stroke: '#fff', strokeOpacity: 0.7, strokeWidth: 7, strokeLinecap: 'round' }),
    path(rr(420, 122, 260, 34, 17), { fill: 'url(#chrome)', stroke: INK, strokeWidth: 6 }),
    path('M440 132H660', { stroke: '#fff', strokeOpacity: 0.8, strokeWidth: 4, strokeLinecap: 'round' }),
    path(circle(GX, 52, 24), { fill: 'url(#knob)', stroke: INK, strokeWidth: 6 }),
    path(ellipse(GX - 8, 44, 8, 5), { fill: '#fff', fillOpacity: 0.85, transform: `rotate(-30 ${GX - 8} 44)` }));
}

function bezel() {
  const o = 56, i = 18;
  const cxm = hole.x + hole.w / 2, cym = hole.y + hole.h / 2, m = hole.w / 2 + 37, k = hole.w / 2 - radius + (radius + 37) * 0.7071;
  const bolts = [[cxm - m, cym], [cxm + m, cym], [cxm, cym - m], [cxm, cym + m], [cxm - k, cym - k], [cxm + k, cym - k], [cxm - k, cym + k], [cxm + k, cym + k]]
    .map(([cx, cy]) => path(circle(cx, cy, 8), { fill: 'url(#bolt)', stroke: INK, strokeWidth: 3 }) + path(`M${n(cx - 4)} ${n(cy - 4)}L${n(cx + 4)} ${n(cy + 4)}`, { stroke: INK, strokeOpacity: 0.6, strokeWidth: 2.5 })).join('');
  return g({},
    path(rr(hole.x - o + 6, hole.y - o + 14, hole.w + 2 * o, hole.h + 2 * o, radius + o), { fill: INK, fillOpacity: 0.4 }),
    path(rr(hole.x - o, hole.y - o, hole.w + 2 * o, hole.h + 2 * o, radius + o), { fill: 'url(#chrome)', stroke: INK, strokeWidth: 7 }),
    path(rr(hole.x - o + 10, hole.y - o + 10, hole.w + 2 * o - 20, hole.h + 2 * o - 20, radius + o - 10), { fill: 'none', stroke: '#fff', strokeOpacity: 0.55, strokeWidth: 3 }),
    path(rr(hole.x - i - 4, hole.y - i - 4, hole.w + 2 * i + 8, hole.h + 2 * i + 8, radius + i + 4), { fill: 'url(#chromeIn)' }),
    path(rr(hole.x - i, hole.y - i, hole.w + 2 * i, hole.h + 2 * i, radius + i), { fill: '#1c0f22', stroke: INK, strokeWidth: 3 }),
    lip(rr(hole.x, hole.y, hole.w, hole.h, radius), '#000', [[6, 0.3], [2.5, 0.6]]),
    bolts,
    path(`M${hole.x - 38} ${hole.y + 150}V${hole.y + radius}Q${hole.x - 38} ${hole.y - 38} ${hole.x + radius} ${hole.y - 38}H${hole.x + 220}`, { fill: 'none', stroke: '#fff', strokeOpacity: 0.9, strokeWidth: 7, strokeLinecap: 'round' }));
}

function globe(capsules) {
  const G = circle(GX, GY, GR);
  return g({ clipPath: 'url(#ggCut)' },
    path(G, { fill: 'url(#glass)' }),
    path(G, { fill: 'url(#glassRim)' }),
    g({ clipPath: 'url(#globeClip)' },
      capsules,
      path(G, { fill: 'url(#glassEdge)' }),
      path(ellipse(GX, GY, GR, GR), { fill: 'url(#glassTint)' })),
    path(G, { fill: 'none', stroke: INK, strokeWidth: 9 }),
    // reflections (top-left key light, small window bounce bottom-right)
    path(`M${n(GX + (GR - 34) * Math.cos(3.55))} ${n(GY + (GR - 34) * Math.sin(3.55))}A${GR - 34} ${GR - 34} 0 0 1 ${n(GX + (GR - 34) * Math.cos(4.45))} ${n(GY + (GR - 34) * Math.sin(4.45))}`,
      { fill: 'none', stroke: '#fff', strokeOpacity: 0.75, strokeWidth: 22, strokeLinecap: 'round' }),
    path(circle(GX + (GR - 52) * Math.cos(4.56), GY + (GR - 52) * Math.sin(4.56), 9), { fill: '#fff', fillOpacity: 0.75 }),
    path(`M${n(GX + (GR - 30) * Math.cos(0.18))} ${n(GY + (GR - 30) * Math.sin(0.18))}A${GR - 30} ${GR - 30} 0 0 1 ${n(GX + (GR - 30) * Math.cos(0.62))} ${n(GY + (GR - 30) * Math.sin(0.62))}`,
      { fill: 'none', stroke: '#fff', strokeOpacity: 0.4, strokeWidth: 10, strokeLinecap: 'round' }),
    g({ class: 'gg-tw' }, path(sparkle(646, 196, 20), { fill: '#fff', fillOpacity: 0.95 })),
    g({ class: 'gg-tw gg-tw2' }, path(sparkle(918, 452, 14), { fill: '#fff', fillOpacity: 0.9 })));
}

function coinIcon(cx, cy, r) {
  return path(circle(cx + 2, cy + 4, r), { fill: INK, fillOpacity: 0.35 })
    + path(circle(cx, cy, r), { fill: 'url(#gold)', stroke: INK, strokeWidth: 4 })
    + path(circle(cx, cy, r * 0.7), { fill: 'none', stroke: '#b9781c', strokeWidth: 2.5 })
    + path(star(cx, cy + 1, r * 0.5, r * 0.22), { fill: '#fff6c8', stroke: '#b9781c', strokeWidth: 2, strokeLinejoin: 'round' });
}

function coinUnit() {
  const x = 210, y = 1072;
  return g({},
    path(rr(x + 4, y + 10, 160, 214, 28), { fill: INK, fillOpacity: 0.35 }),
    path(rr(x, y, 160, 214, 28), { fill: 'url(#chrome)', stroke: INK, strokeWidth: 6 }),
    path(`M${x + 16} ${y + 70}V${y + 34}Q${x + 16} ${y + 16} ${x + 34} ${y + 16}H${x + 90}`, { fill: 'none', stroke: '#fff', strokeOpacity: 0.85, strokeWidth: 5, strokeLinecap: 'round' }),
    // slot
    path(rr(x + 56, y + 30, 48, 92, 24), { fill: 'url(#chromeIn)', stroke: INK, strokeWidth: 4 }),
    path(rr(x + 73, y + 44, 14, 64, 7), { fill: '#1c0f22' }),
    path(`M${x + 66} ${y + 132}L${x + 80} ${y + 120}L${x + 94} ${y + 132}`, { fill: 'none', stroke: '#ff5a6e', strokeWidth: 5, strokeLinecap: 'round', strokeLinejoin: 'round' }),
    // price plate: coin x 1
    path(rr(x + 14, y + 144, 132, 56, 16), { fill: '#fff6ea', stroke: INK, strokeWidth: 4 }),
    coinIcon(x + 46, y + 172, 18),
    path(`M${x + 76} ${y + 164}L${x + 92} ${y + 180}M${x + 92} ${y + 164}L${x + 76} ${y + 180}`, { stroke: INK, strokeWidth: 4.5, strokeLinecap: 'round' }),
    path(`M${x + 108} ${y + 166}L${x + 118} ${y + 158}V${y + 186}`, { fill: 'none', stroke: INK, strokeWidth: 5, strokeLinecap: 'round', strokeLinejoin: 'round' }));
}

function crank(cx, cy) {
  return g({},
    path(circle(cx + 4, cy + 10, 96), { fill: INK, fillOpacity: 0.4 }),
    path(circle(cx, cy, 96), { fill: 'url(#chrome)', stroke: INK, strokeWidth: 7 }),
    path(circle(cx, cy, 80), { fill: 'url(#chromeIn)', stroke: INK, strokeOpacity: 0.5, strokeWidth: 3 }),
    path(`M${cx - 76} ${cy - 18}A78 78 0 0 1 ${cx - 18} ${cy - 76}`, { fill: 'none', stroke: '#fff', strokeOpacity: 0.85, strokeWidth: 6, strokeLinecap: 'round' }),
    g({ transform: `rotate(-28 ${cx} ${cy})` },
      path(rr(cx - 120, cy - 28 + 10, 240, 56, 28), { fill: INK, fillOpacity: 0.4 }),
      path(rr(cx - 120, cy - 28, 240, 56, 28), { fill: 'url(#chromeBar)', stroke: INK, strokeWidth: 7 }),
      path(`M${cx - 100} ${cy - 15}H${cx + 98}`, { stroke: '#fff', strokeOpacity: 0.9, strokeWidth: 6, strokeLinecap: 'round' }),
      path(rr(cx - 120, cy - 28, 50, 56, 28), { fill: 'url(#red)', stroke: INK, strokeWidth: 6 }),
      path(rr(cx + 70, cy - 28, 50, 56, 28), { fill: 'url(#red)', stroke: INK, strokeWidth: 6 }),
      path(`M${cx - 106} ${cy - 13}H${cx - 86}M${cx + 84} ${cy - 13}H${cx + 104}`, { stroke: '#fff', strokeOpacity: 0.8, strokeWidth: 5, strokeLinecap: 'round' })),
    path(circle(cx, cy, 30), { fill: 'url(#chrome)', stroke: INK, strokeWidth: 6 }),
    path(circle(cx, cy, 12), { fill: 'url(#knob)', stroke: INK, strokeWidth: 4 }),
    path(ellipse(cx - 10, cy - 12, 8, 5), { fill: '#fff', fillOpacity: 0.8, transform: `rotate(-30 ${cx - 10} ${cy - 12})` }));
}

function exitFlap() {
  const x = 444, y = 1284, w = 212, h = 94;
  return g({},
    path(rr(x - 14, y - 14, w + 28, h + 28, [62, 62, 26, 26]), { fill: 'url(#chrome)', stroke: INK, strokeWidth: 6 }),
    path(rr(x, y, w, h, [50, 50, 16, 16]), { fill: '#24101f', stroke: INK, strokeWidth: 4 }),
    path(rr(x + 8, y + 8, w - 16, h * 0.42, [44, 44, 8, 8]), { fill: '#000', fillOpacity: 0.35 }),
    // flap swung up and inward (tinted clear plastic)
    path(`M${x + 10} ${y + 6}H${x + w - 10}L${x + w - 22} ${y + 44}H${x + 22}Z`, { fill: '#ff8fb0', fillOpacity: 0.72, stroke: INK, strokeWidth: 4, strokeLinejoin: 'round' }),
    path(`M${x + 30} ${y + 20}H${x + 120}`, { stroke: '#fff', strokeOpacity: 0.8, strokeWidth: 4, strokeLinecap: 'round' }),
    path(`M${x + 12} ${y + 6}H${x + w - 12}`, { stroke: INK, strokeWidth: 14, strokeLinecap: 'round' }),
    path(`M${x + 12} ${y + 6}H${x + w - 12}`, { stroke: '#c9cfe0', strokeWidth: 10, strokeLinecap: 'round' }),
    path(`M${x + 16} ${y + 4}H${x + w - 16}`, { stroke: '#fff', strokeOpacity: 0.9, strokeWidth: 3, strokeLinecap: 'round' }),
    path(circle(x + 12, y + 6, 7) + circle(x + w - 12, y + 6, 7), { fill: 'url(#bolt)', stroke: INK, strokeWidth: 3 }),
    // tray lip
    path(rr(x - 22, y + h - 6, w + 44, 30, 15), { fill: 'url(#chromeBar)', stroke: INK, strokeWidth: 6 }),
    path(`M${x - 6} ${y + h + 2}H${x + w - 20}`, { stroke: '#fff', strokeOpacity: 0.8, strokeWidth: 4, strokeLinecap: 'round' }),
    // the capsule that just dropped out
    path(ellipse(x + 182, y + h - 4, 40, 6), { fill: INK, fillOpacity: 0.3 }),
    capsule(x + 178, y + h - 48, 44, -24, 0, 2),
    path('M696 1326L718 1314M702 1350L728 1350M696 1374L718 1386', { stroke: '#fff', strokeOpacity: 0.85, strokeWidth: 5, strokeLinecap: 'round' }));
}

function sticker(cx, cy, rot) {
  const body = 'M0 -64C38 -64 58 -36 58 0C58 40 34 62 0 62C-34 62 -58 40 -58 0C-58 -36 -38 -64 0 -64Z';
  const half = 'M-58 0C-58 -36 -38 -64 0 -64C38 -64 58 -36 58 0Z';
  return g({ transform: tf(cx, cy, rot) },
    g({ transform: 'translate(3 7)', opacity: 0.3 },
      path(body, { fill: INK, stroke: INK, strokeWidth: 22, strokeLinejoin: 'round' }),
      path('M0 -64V-86', { stroke: INK, strokeWidth: 20, strokeLinecap: 'round' }),
      path(star(0, -92, 13, 6), { fill: INK, stroke: INK, strokeWidth: 18, strokeLinejoin: 'round' })),
    path('M0 -64V-86', { stroke: '#fff', strokeWidth: 20, strokeLinecap: 'round' }),
    path(star(0, -92, 13, 6), { fill: '#fff', stroke: '#fff', strokeWidth: 18, strokeLinejoin: 'round' }),
    path(body, { fill: '#fff', stroke: '#fff', strokeWidth: 22, strokeLinejoin: 'round' }),
    path('M-30 54L-36 76M30 54L36 76', { stroke: '#fff', strokeWidth: 24, strokeLinecap: 'round' }),
    path('M-30 54L-36 76M30 54L36 76', { stroke: INK, strokeWidth: 10, strokeLinecap: 'round' }),
    path(body, { fill: '#fff4ea' }), path(half, { fill: '#4fd8c4' }),
    path('M-58 2H58', { stroke: INK, strokeOpacity: 0.35, strokeWidth: 7 }),
    path(body, { fill: 'url(#capShade)' }),
    path(body, { fill: 'none', stroke: INK, strokeWidth: 5 }),
    path('M0 -64V-84', { stroke: INK, strokeWidth: 5, strokeLinecap: 'round' }),
    path(star(0, -92, 13, 6), { fill: '#ffc94a', stroke: INK, strokeWidth: 3.5, strokeLinejoin: 'round' }),
    path(ellipse(-20, 18, 8, 10) + ellipse(20, 18, 8, 10), { fill: INK }),
    path(circle(-17, 14, 3.2) + circle(23, 14, 3.2), { fill: '#fff' }),
    path('M-8 36Q0 44 8 36', { fill: 'none', stroke: INK, strokeWidth: 4, strokeLinecap: 'round' }),
    path(ellipse(-38, 34, 9, 5) + ellipse(38, 34, 9, 5), { fill: '#ff7eb0', fillOpacity: 0.6 }),
    path(ellipse(-26, -40, 14, 7), { fill: '#fff', fillOpacity: 0.85, transform: 'rotate(-30 -26 -40)' }));
}

function base() {
  const rivet = ([x, y]) => path(circle(x, y, 9), { fill: 'url(#bolt)', stroke: INK, strokeWidth: 3 }) + path(ellipse(x - 2.5, y - 3, 3, 2), { fill: '#fff', fillOpacity: 0.9 });
  const bulbs = [];
  for (let i = 0; i < 9; i++) {
    const x = 262 + i * 72, y = 1036;
    bulbs.push(g({},
      g({ class: i % 2 ? 'gg-bl gg-bl2' : 'gg-bl' }, path(circle(x, y, 16), { fill: 'url(#bulbGlow)' })),
      path(circle(x, y, 9), { fill: i % 3 === 0 ? '#fff3a8' : i % 3 === 1 ? '#ffd6e6' : '#c9fff4', stroke: INK, strokeWidth: 3 }),
      path(circle(x - 3, y - 3, 2.6), { fill: '#fff' })));
  }
  return g({},
    path(ellipse(GX, 1450, 470, 26), { fill: 'url(#floor)' }),
    path(rr(186, 1410, 104, 36, 14) + rr(810, 1410, 104, 36, 14), { fill: '#4a1d3e', stroke: INK, strokeWidth: 5 }),
    path('M200 1430H276M824 1430H900', { stroke: '#7a3a62', strokeOpacity: 0.6, strokeWidth: 3, strokeLinecap: 'round' }),
    path(BASE, { fill: 'url(#red)', stroke: INK, strokeWidth: 8, strokeLinejoin: 'round' }),
    path(BASE, { fill: 'url(#baseSide)' }),
    path('M190 1080Q194 1008 240 1006H880', { fill: 'none', stroke: '#fff', strokeOpacity: 0.6, strokeWidth: 7, strokeLinecap: 'round' }),
    path('M175 1380L205 1060', { fill: 'none', stroke: '#fff', strokeOpacity: 0.28, strokeWidth: 6, strokeLinecap: 'round' }),
    // marquee bulb strip
    path(rr(222, 1016, 656, 40, 20), { fill: '#8f1236', stroke: INK, strokeWidth: 5 }),
    bulbs.join(''),
    // lower trim band
    path('M166 1306H412M688 1306H934', { stroke: INK, strokeOpacity: 0.3, strokeWidth: 6 }),
    path('M166 1312H412M688 1312H934', { stroke: '#fff', strokeOpacity: 0.22, strokeWidth: 3 }),
    [[204, 1090], [896, 1090], [194, 1384], [906, 1384], [396, 1250], [704, 1250]].map(rivet).join(''));
}

function collar() {
  return g({},
    path(rr(266, 934, 568, 64, 32), { fill: INK, fillOpacity: 0.35, transform: 'translate(0 8)' }),
    path(rr(266, 934, 568, 64, 32), { fill: 'url(#chromeBar)', stroke: INK, strokeWidth: 7 }),
    path('M300 950H800', { stroke: '#fff', strokeOpacity: 0.85, strokeWidth: 5, strokeLinecap: 'round' }),
    [330, 440, 550, 660, 770].map((x) => path(circle(x, 974, 6), { fill: 'url(#bolt)', stroke: INK, strokeWidth: 2.5 })).join(''));
}

function draw() {
  const defs = [
    `<style>.gg-tw{animation:ggTw 2.8s ease-in-out infinite;transform-box:fill-box;transform-origin:center}.gg-tw2{animation-delay:-1.4s}`
      + `.gg-bl{animation:ggBl 1.6s steps(1) infinite}.gg-bl2{animation-delay:-0.8s}`
      + `@keyframes ggTw{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.35;transform:scale(.7)}}@keyframes ggBl{0%{opacity:1}50%{opacity:.2}}`
      + `@media (prefers-reduced-motion:reduce){*{animation:none!important}}</style>`,
    rg('glass', [0.36, 0.3, 0.8], [[0, '#ffffff', 0.38], [0.55, '#d6f4ff', 0.3], [1, '#8fd0ee', 0.5]]),
    rg('glassRim', [0.5, 0.5, 0.5], [[0.7, '#ffffff', 0], [0.93, '#5aa6cc', 0.2], [1, '#2f5f86', 0.45]]),
    rg('glassEdge', [0.5, 0.5, 0.5], [[0.9, '#bfe8ff', 0], [0.98, '#bfe8ff', 0.18], [1, '#2f5f86', 0.3]]),
    lg('glassTint', [0, 0, 1, 1], [[0, '#ffffff', 0.1], [0.45, '#ffffff', 0], [1, '#3b1430', 0.08]]),
    rg('capShade', [0.4, 0.34, 0.72], [[0, '#ffffff', 0.38], [0.32, '#ffffff', 0], [0.75, '#3b1430', 0], [1, '#3b1430', 0.28]]),
    lg('chrome', [0, 0, 1, 1], [[0, '#ffffff'], [0.3, '#dfe4f2'], [0.62, '#9ea6bf'], [0.85, '#c9cfe0'], [1, '#7c84a0']]),
    lg('chromeIn', [0, 0, 1, 1], [[0, '#7c84a0'], [0.5, '#b7bdd2'], [1, '#eef1fa']]),
    lg('chromeBar', [0, 0, 0, 1], [[0, '#ffffff'], [0.45, '#d4d9e8'], [0.55, '#a4abc4'], [1, '#d9deec']]),
    rg('bolt', [0.4, 0.35, 0.7], [[0, '#ffffff'], [1, '#8f97b3']]),
    lg('red', [0, 0, 0, 1], [[0, '#ff6f78'], [0.45, '#ec3b52'], [1, '#b81e45']]),
    lg('baseSide', [0, 0, 1, 0], [[0, '#ffffff', 0.16], [0.18, '#ffffff', 0], [0.82, '#3b1430', 0], [1, '#3b1430', 0.25]]),
    rg('knob', [0.4, 0.35, 0.7], [[0, '#ffc2c8'], [0.5, '#f04a5e'], [1, '#a81a3d']]),
    lg('gold', [0, 0, 0, 1], [[0, '#fff3a8'], [0.55, '#ffc63d'], [1, '#e08a1a']]),
    rg('bulbGlow', [0.5, 0.5, 0.5], [[0, '#fff6c8', 0.9], [1, '#fff6c8', 0]]),
    rg('floor', [0.5, 0.5, 0.5], [[0, '#3b1430', 0.45], [1, '#3b1430', 0]]),
    `<clipPath id="ggCut"><rect x="0" y="0" width="1100" height="966"/></clipPath>`,
    `<clipPath id="globeClip"><path d="${circle(GX, GY, GR)}"/></clipPath>`,
  ].join('');

  const deco = [
    path(sparkle(96, 150, 24), { fill: '#ffc94a', stroke: INK, strokeWidth: 3 }),
    path(sparkle(1010, 210, 18), { fill: '#4fd8c4', stroke: INK, strokeWidth: 3 }),
    path(heart(1030, 880, 16), { fill: '#ff7eb0', stroke: INK, strokeWidth: 3 }),
    path(star(70, 820, 16, 7), { fill: '#69b4ff', stroke: INK, strokeWidth: 3, strokeLinejoin: 'round' }),
    path(sparkle(1050, 1240, 16), { fill: '#fff', stroke: INK, strokeWidth: 2.5 }),
  ].join('');

  const body = [
    base(),
    globe(pile()),
    topCap(),
    collar(),
    bezel(),
    coinUnit(),
    crank(550, 1160),
    exitFlap(),
    sticker(836, 1170, 10),
    deco,
  ].join('\n');
  return { defs, body };
}

module.exports = {
  W, H, hole, radius, draw,
  meta: {
    name: 'Gacha Globe', theme: 'capsule-toy', rarity: 'epic', translucent: true,
    desc: 'Pop in a coin, give the big crank a twirl and watch your game play inside a glass globe full of grinning capsules.',
    tags: ['gacha', 'capsule', 'arcade', 'clear', 'cute'],
    collection: 'coin-op', license: 'CC-BY-4.0',
  },
};
