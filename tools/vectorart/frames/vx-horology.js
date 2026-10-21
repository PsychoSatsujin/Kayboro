'use strict';
// Horology: a skeleton chronometer seen through its sapphire crystal. A polished steel cushion case with lugs,
// a crown and two pushers holds an openwork movement in three depths: dim blued-steel wheels far below in the
// haze, rose-gold going-train wheels and frosted bridges in the middle, and the complications on top: a
// mainspring barrel with a sunburst ratchet, a planetary differential, a chronograph column wheel, a moon-phase
// disc of aventurine glimpsed through a two-humped aperture, and a tourbillon cage carrying its balance and
// blued hairspring. A warm key light from the upper left falls off into the dark lower right. Around the
// picture: a calm anthracite chapter ring with fine minute ticks and rose-gold batons.
const L = require('../lib');
const { rr, path, g, lg, rg, circle, ellipse, poly, P, rng } = L;

const W = 1800, H = 1300;
const hole = { x: 420, y: 380, w: 960, h: 540 }, radius = 8;
const CX = hole.x + hole.w / 2, CY = hole.y + hole.h / 2;
const CASE = { x: 100, y: 80, w: 1600, h: 1140, r: 230 };
const IN = { x: 152, y: 132, w: 1496, h: 1036, r: 180 }; // crystal opening
const RING = 44;
const PLATE = rr(690, 160, 420, 200, 64); // the moon plate across the top centre, meeting the chapter ring
const INK = '#0b0d11';
const TAU = Math.PI * 2;
const rad = (a) => (a * Math.PI) / 180;
const f1 = (v) => Math.round(v * 10) / 10;
const pt = (cx, cy, r, a) => `${f1(cx + r * Math.cos(a))} ${f1(cy + r * Math.sin(a))}`;
const ring = (cx, cy, r) => `M${f1(cx - r)} ${f1(cy)}A${f1(r)} ${f1(r)} 0 1 0 ${f1(cx + r)} ${f1(cy)}A${f1(r)} ${f1(r)} 0 1 0 ${f1(cx - r)} ${f1(cy)}Z`;

/** Toothed outline: k teeth of depth h on tip radius R (h < 0 makes internal teeth pointing in). */
function teeth(cx, cy, R, k, h, rot = 0) {
  const s = TAU / k, out = [];
  for (let i = 0; i < k; i++) {
    const a = rot + i * s;
    out.push(pt(cx, cy, R - h, a), pt(cx, cy, R, a + s * 0.22), pt(cx, cy, R, a + s * 0.5), pt(cx, cy, R - h, a + s * 0.72));
  }
  return `M${out.join('L')}Z`;
}

/** Spoke crossings cut out of a wheel between hub radius r0 and rim radius r1. */
function crossings(cx, cy, r0, r1, spokes, rot, sw) {
  let d = '';
  const sp = TAU / spokes;
  for (let j = 0; j < spokes; j++) {
    const a = rot + j * sp, ai = (sw * 1.5) / r0, ao = sw / r1;
    d += `M${pt(cx, cy, r1, a + ao)}A${f1(r1)} ${f1(r1)} 0 0 1 ${pt(cx, cy, r1, a + sp - ao)}L${pt(cx, cy, r0, a + sp - ai)}A${f1(r0)} ${f1(r0)} 0 0 0 ${pt(cx, cy, r0, a + ai)}Z`;
  }
  return d;
}

/** A front wheel: rose gold (or steel) with spoked crossings, a bright chamfer, a pinion and a ruby. */
function wheel(cx, cy, R, k0, { spokes = 5, rot = 0, fill = 'url(#hzRose)', hub = 0.2 } = {}) {
  const k = Math.round(k0 * 0.82);
  const h = Math.max(5, R * 0.065), Ri = R - h - R * 0.14, Rh = Math.max(14, R * hub);
  const cut = crossings(cx, cy, Rh + 5, Ri, spokes, rot, Math.max(4, R * 0.05));
  return path(ring(cx + 5, cy + 8, R - h / 2) + cut, { fill: '#000', fillOpacity: 0.45, fillRule: 'evenodd' })
    + path(teeth(cx, cy, R, k, h, rot) + cut, { fill, fillRule: 'evenodd', stroke: INK, strokeWidth: 1.2, strokeLinejoin: 'round' })
    + path(ring(cx, cy, Ri), { fill: 'none', stroke: '#fff4ec', strokeOpacity: 0.5, strokeWidth: 1.4 })
    + path(ring(cx, cy, Rh), { fill: 'url(#hzSteel)', stroke: INK, strokeWidth: 1 })
    + path(teeth(cx, cy, Rh * 0.72, 8, Rh * 0.2, rot), { fill: 'url(#hzSteelD)', stroke: INK, strokeWidth: 0.8 })
    + jewel(cx, cy, Math.max(4.5, Rh * 0.26));
}

/** A dim far wheel in blued steel, seen through the haze. */
function farWheel(cx, cy, R, k, rot = 0) {
  const h = R * 0.05, Ri = R - h - R * 0.12;
  return path(teeth(cx, cy, R, k, h, rot) + crossings(cx, cy, R * 0.2, Ri, 6, rot, R * 0.04), { fill: 'url(#hzFar)', fillRule: 'evenodd', stroke: '#06080c', strokeWidth: 1 })
    + path(ring(cx, cy, Ri - 4) + ring(cx, cy, R * 0.12), { fill: 'none', stroke: '#8aa6d0', strokeOpacity: 0.18, strokeWidth: 1.2 });
}

/** Ruby jewel in a gold chaton. */
function jewel(cx, cy, r) {
  return path(ring(cx, cy, r * 2), { fill: 'url(#hzChaton)', stroke: INK, strokeWidth: 0.8 })
    + path(ring(cx, cy, r), { fill: 'url(#hzRuby)', stroke: '#3a0010', strokeWidth: 0.7 })
    + path(ring(cx - r * 0.3, cy - r * 0.35, r * 0.28), { fill: '#fff', fillOpacity: 0.85 });
}

/** Blued screw with a slot. */
function screw(cx, cy, r, a = 30) {
  return path(ring(cx, cy, r + 2.5), { fill: 'url(#hzSink)', stroke: INK, strokeWidth: 0.8 })
    + path(ring(cx, cy, r), { fill: 'url(#hzBlue)', stroke: '#0a1440', strokeWidth: 0.8 })
    + path(`M${pt(cx, cy, r * 0.8, rad(a))}L${pt(cx, cy, r * 0.8, rad(a + 180))}`, { stroke: '#050a24', strokeWidth: r * 0.32, strokeLinecap: 'round' });
}

/** Frosted bridge made of lobes and waists, with a rose-gold anglage and Cotes de Geneve. */
function lobed(pts, waist) {
  const parts = pts.map(([x, y, r]) => ring(x, y, r));
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i], [x1, y1] = pts[i + 1], dx = x1 - x0, dy = y1 - y0, l = Math.hypot(dx, dy), nx = (-dy / l) * waist / 2, ny = (dx / l) * waist / 2;
    parts.push(poly([[x0 + nx, y0 + ny], [x1 + nx, y1 + ny], [x1 - nx, y1 - ny], [x0 - nx, y0 - ny]]));
  }
  const d = parts.join('');
  return path(d, { fill: '#000', fillOpacity: 0.5, transform: 'translate(7 11)' })
    + path(d, { fill: 'none', stroke: INK, strokeWidth: 9, strokeLinejoin: 'round' })
    + path(d, { fill: 'none', stroke: 'url(#hzRoseD)', strokeWidth: 6, strokeLinejoin: 'round' })
    + path(d, { fill: 'url(#hzBridge)' })
    + path(d, { fill: 'url(#hzCotes)' });
}

/** Mainspring barrel: toothed drum, sunburst ratchet, click spring. */
function barrel(cx, cy, R) {
  let rays = '';
  for (let i = 0; i < 64; i++) rays += `M${pt(cx, cy, 24, (i * TAU) / 64)}L${pt(cx, cy, R * 0.62, (i * TAU) / 64)}`;
  const r2 = R * 0.7;
  return g({},
    wheel(cx, cy, R, 72, { spokes: 6, rot: 0.2, hub: 0.16 }),
    path(ring(cx + 5, cy + 8, r2), { fill: '#000', fillOpacity: 0.45 }),
    path(teeth(cx, cy, r2, 48, 8, 0), { fill: 'url(#hzSteel)', stroke: INK, strokeWidth: 1.1 }),
    path(rays, { stroke: '#fff', strokeOpacity: 0.14, strokeWidth: 1.5 }),
    path(ring(cx, cy, R * 0.62), { fill: 'none', stroke: '#fff', strokeOpacity: 0.5, strokeWidth: 1.2 }),
    screw(cx, cy, 18, 20),
    path(`M${pt(cx, cy, r2 + 4, 0.55)}C${pt(cx, cy, r2 + 30, 0.25)} ${pt(cx, cy, r2 + 26, -0.15)} ${pt(cx, cy, r2 + 8, -0.3)}L${pt(cx, cy, r2 + 2, -0.2)}C${pt(cx, cy, r2 + 14, -0.05)} ${pt(cx, cy, r2 + 14, 0.25)} ${pt(cx, cy, r2 - 2, 0.45)}Z`, { fill: 'url(#hzSteel)', stroke: INK, strokeWidth: 1 }));
}

/** Planetary differential: internal ring gear, sun, three planets on a black-polished carrier. */
function planetary(cx, cy, R) {
  const ri = R * 0.8, sun = R * 0.26, pr = (ri - sun) / 2 - 3, carrier = sun + pr + 3;
  let planets = '', arms = '';
  for (let i = 0; i < 3; i++) {
    const a = 0.4 + (i * TAU) / 3, [px, py] = pt(cx, cy, carrier, a).split(' ').map(Number);
    planets += wheel(px, py, pr, 18, { spokes: 3, rot: a, fill: 'url(#hzSteel)', hub: 0.3 });
    arms += `M${f1(cx)} ${f1(cy)}L${f1(px)} ${f1(py)}`;
  }
  return g({},
    path(ring(cx + 6, cy + 9, R), { fill: '#000', fillOpacity: 0.5 }),
    path(ring(cx, cy, R) + teeth(cx, cy, ri, 48, -7, 0.1), { fill: 'url(#hzRose)', fillRule: 'evenodd', stroke: INK, strokeWidth: 1.2 }),
    path(ring(cx, cy, R - 6), { fill: 'none', stroke: '#fff4ec', strokeOpacity: 0.45, strokeWidth: 1.4 }),
    path(ring(cx, cy, ri - 8), { fill: '#05070b' }),
    planets,
    wheel(cx, cy, sun, 14, { spokes: 3, fill: 'url(#hzRose)', hub: 0.5 }),
    path(arms, { stroke: INK, strokeWidth: 22, strokeLinecap: 'round' }),
    path(arms, { stroke: 'url(#hzMirror)', strokeWidth: 18, strokeLinecap: 'round' }),
    path(arms, { stroke: '#fff', strokeOpacity: 0.25, strokeWidth: 2, strokeLinecap: 'round', transform: 'translate(-3 -4)' }),
    jewel(cx, cy, 6));
}

/** Chronograph column wheel: ratchet base with seven castellated columns and a polished cap. */
function columnWheel(cx, cy, R) {
  let cols = '';
  for (let i = 0; i < 7; i++) {
    const a = (i * TAU) / 7 + 0.2;
    cols += `M${pt(cx, cy, R * 0.42, a - 0.2)}L${pt(cx, cy, R * 0.78, a - 0.2)}A${f1(R * 0.78)} ${f1(R * 0.78)} 0 0 1 ${pt(cx, cy, R * 0.78, a + 0.2)}L${pt(cx, cy, R * 0.42, a + 0.2)}Z`;
  }
  return path(ring(cx + 5, cy + 8, R), { fill: '#000', fillOpacity: 0.5 })
    + path(teeth(cx, cy, R, 21, 7, 0), { fill: 'url(#hzSteelD)', stroke: INK, strokeWidth: 1 })
    + path(cols, { fill: 'url(#hzSteel)', stroke: INK, strokeWidth: 1 })
    + path(ring(cx, cy, R * 0.42), { fill: 'url(#hzMirror)', stroke: INK, strokeWidth: 1 })
    + screw(cx, cy, 10, 60);
}

/** Moon-phase disc of aventurine with two gold moons, behind a two-humped aperture in a frosted plate. */
function moonPhase(cx, cy, R, plate) {
  const rnd = rng(17);
  let stars = '', bright = '';
  for (let i = 0; i < 64; i++) {
    const a = rnd() * TAU, r = Math.sqrt(rnd()) * (R - 8);
    stars += ring(cx + r * Math.cos(a), cy + r * Math.sin(a), 0.6 + rnd() * 1.3);
  }
  for (let i = 0; i < 10; i++) { const a = -Math.PI * (0.15 + rnd() * 0.7), r = 120 + rnd() * 110; bright += L.sparkle(cx + r * Math.cos(a), cy + r * Math.sin(a), 4 + rnd() * 5, 0.12); }
  const moon = (a) => {
    const mx = cx + 180 * Math.cos(a), my = cy + 180 * Math.sin(a);
    return path(ring(mx, my, 54), { fill: 'url(#hzMoon)', stroke: '#6a4a14', strokeWidth: 1.2 })
      + path(ring(mx - 16, my + 10, 9) + ring(mx + 14, my - 18, 6) + ring(mx + 20, my + 16, 11), { fill: '#a07828', fillOpacity: 0.35 });
  };
  const ap = { l: cx - 164, r: cx + 164, b: cy - 110 };
  const aperture = `M${ap.l} ${ap.b}A164 136 0 0 1 ${ap.r} ${ap.b}A82 46 0 0 0 ${cx} ${ap.b}A82 46 0 0 0 ${ap.l} ${ap.b}Z`;
  return g({},
    g({ clipPath: 'url(#hzPlateClip)' }, path(ring(cx, cy, R), { fill: 'url(#hzAventurine)' }),
      path(stars, { fill: '#ffe6a0', fillOpacity: 0.75 }),
      path(bright, { fill: '#fff4d0' }),
      moon(rad(-64)), moon(rad(116))),
    path(plate + aperture, { fill: '#000', fillOpacity: 0.5, fillRule: 'evenodd', transform: 'translate(6 10)' }),
    path(plate + aperture, { fill: 'url(#hzBridge)', fillRule: 'evenodd', stroke: INK, strokeWidth: 1.4 }),
    path(plate + aperture, { fill: 'url(#hzCotes)', fillRule: 'evenodd' }),
    path(aperture, { fill: 'none', stroke: 'url(#hzRoseD)', strokeWidth: 5 }),
    path(aperture, { fill: 'none', stroke: INK, strokeWidth: 1.2 }),
    path(plate, { fill: 'none', stroke: 'url(#hzRoseD)', strokeWidth: 3, transform: 'translate(-0.8 -1)' }));
}

/** Tourbillon: a recess with a fixed toothed ring, a rotating steel cage with balance and hairspring. */
function tourbillon(cx, cy, R) {
  const bR = R * 0.58;
  let tscrews = '';
  for (let i = 0; i < 12; i++) tscrews += ring(...pt(cx, cy, bR + 5, (i * TAU) / 12 + 0.1).split(' ').map(Number), 4.5);
  const sp = [];
  for (let i = 0; i <= 170; i++) { const t = i / 170; sp.push(pt(cx, cy, 10 + t * bR * 0.7, t * TAU * 11)); }
  const balArms = `M${pt(cx, cy, bR - 4, 0.5)}L${pt(cx, cy, bR - 4, 0.5 + Math.PI)}`;
  let cage = '';
  for (let i = 0; i < 3; i++) {
    const a = -Math.PI / 2 + (i * TAU) / 3, b = a + 0.35;
    cage += `M${pt(cx, cy, 16, a - 0.5)}C${pt(cx, cy, R * 0.5, a - 0.25)} ${pt(cx, cy, R * 0.7, b - 0.1)} ${pt(cx, cy, R * 0.86, b)}L${pt(cx, cy, R * 0.86, b + 0.16)}C${pt(cx, cy, R * 0.62, b + 0.12)} ${pt(cx, cy, R * 0.4, a + 0.35)} ${pt(cx, cy, 16, a + 0.5)}Z`;
  }
  const hand = `M${pt(cx, cy, 22, 2.6)}L${pt(cx, cy, R * 0.82, -0.52 - 0.012)}L${pt(cx, cy, R * 0.9, -0.52)}L${pt(cx, cy, R * 0.82, -0.52 + 0.012)}Z`;
  return g({},
    path(ring(cx, cy, R + 16), { fill: 'url(#hzRoseD)', stroke: INK, strokeWidth: 1.2 }),
    path(ring(cx, cy, R + 10), { fill: 'url(#hzWell)' }),
    path(ring(cx, cy, R) + teeth(cx, cy, R - 12, 60, -6, 0), { fill: 'url(#hzRose)', fillRule: 'evenodd', stroke: INK, strokeWidth: 1 }),
    // balance wheel and hairspring under the cage
    path(ring(cx + 4, cy + 7, bR), { fill: 'none', stroke: '#000', strokeOpacity: 0.5, strokeWidth: 10 }),
    path(balArms, { stroke: INK, strokeWidth: 10, strokeLinecap: 'round' }), path(balArms, { stroke: 'url(#hzGold)', strokeWidth: 7, strokeLinecap: 'round' }),
    path(ring(cx, cy, bR + 1) + ring(cx, cy, bR - 9), { fill: 'url(#hzGold)', fillRule: 'evenodd', stroke: INK, strokeWidth: 1 }),
    path(tscrews, { fill: 'url(#hzGold)', stroke: INK, strokeWidth: 0.8 }),
    path(`M${sp.join('L')}`, { fill: 'none', stroke: '#3a64e0', strokeWidth: 1 }),
    // escape wheel and pallet fork riding on the cage
    path(teeth(cx + R * 0.42, cy + R * 0.42, 22, 15, 6, 0.2), { fill: 'url(#hzSteel)', stroke: INK, strokeWidth: 0.8 }),
    path(`M${pt(cx, cy, 30, 0.9)}L${pt(cx, cy, R * 0.55, 0.6)}L${pt(cx, cy, R * 0.55, 0.75)}Z`, { fill: 'url(#hzSteelD)', stroke: INK, strokeWidth: 0.8 }),
    // the black-polished cage bridge
    path(cage, { fill: '#000', fillOpacity: 0.5, transform: 'translate(4 7)' }),
    path(cage, { fill: 'url(#hzMirror)', stroke: INK, strokeWidth: 1.2 }),
    path(cage, { fill: 'none', stroke: '#fff', strokeOpacity: 0.35, strokeWidth: 1, transform: 'translate(-1 -1.5)' }),
    path(ring(cx, cy, 22), { fill: 'url(#hzMirror)', stroke: INK, strokeWidth: 1 }),
    path(hand, { fill: 'url(#hzBlue)' }),
    jewel(cx, cy, 7));
}

/** Fluted crown with a sapphire cabochon, and a chronograph pusher. */
function crown(x, y) {
  let flutes = '';
  for (let i = 0; i < 11; i++) flutes += rr(x + 34, y - 58 + i * 11, 50, 5, 2.5);
  return path(rr(x - 6, y - 14, 44, 28, 4), { fill: 'url(#hzSteelV)', stroke: INK, strokeWidth: 1.2 })
    + path(rr(x + 32, y - 60, 56, 128, 16), { fill: '#000', fillOpacity: 0.4 })
    + path(rr(x + 28, y - 64, 56, 128, 16), { fill: 'url(#hzSteelV)', stroke: INK, strokeWidth: 1.4 })
    + path(flutes, { fill: '#2a3038', fillOpacity: 0.55 })
    + path(`M${x + 38} ${y - 54}V${y + 54}`, { stroke: '#fff', strokeOpacity: 0.6, strokeWidth: 2 })
    + path(ellipse(x + 86, y, 8, 30), { fill: 'url(#hzSapphire)', stroke: '#0a1440', strokeWidth: 1 });
}
const pusher = (x, y) => path(rr(x - 6, y - 12, 40, 24, 4), { fill: 'url(#hzSteelV)', stroke: INK, strokeWidth: 1.2 })
  + path(rr(x + 30, y - 22, 26, 44, 8), { fill: 'url(#hzSteelV)', stroke: INK, strokeWidth: 1.4 });

/** Lug: a curved horn on the case at the given corner (sx = +-1, sy = +-1). */
function lug(x, sy) {
  const y0 = sy < 0 ? CASE.y + 40 : CASE.y + CASE.h - 40, y1 = sy < 0 ? 14 : H - 14;
  const d = `M${x - 70} ${y0}C${x - 70} ${(y0 + y1) / 2} ${x - 62} ${y1} ${x - 40} ${y1}H${x + 40}C${x + 62} ${y1} ${x + 70} ${(y0 + y1) / 2} ${x + 70} ${y0}Z`;
  return path(d, { fill: '#000', fillOpacity: 0.3, transform: 'translate(8 12)' })
    + path(d, { fill: 'url(#hzCaseV)', stroke: INK, strokeWidth: 1.5 })
    + path(`M${x - 58} ${y0}C${x - 58} ${(y0 + y1) / 2} ${x - 50} ${y1 - sy * 10} ${x - 34} ${y1 - sy * 10}`, { fill: 'none', stroke: '#fff', strokeOpacity: 0.6, strokeWidth: 2.5 })
    + path(ring(x, (y0 + y1) / 2 + sy * 6, 6), { fill: '#1a1e24', stroke: '#fff', strokeOpacity: 0.3 });
}

/** The calm anthracite chapter ring: minute ticks and twelve rose-gold batons. */
function chapterRing() {
  const o = RING, x0 = hole.x - o, y0 = hole.y - o, w = hole.w + 2 * o, h = hole.h + 2 * o;
  const outer = rr(x0, y0, w, h, 30), inner = rr(hole.x - 4, hole.y - 4, hole.w + 8, hole.h + 8, radius + 3);
  let ticks = '';
  const step = 16, edge = (x, y, nx, ny, len) => `M${P(x - nx * 5, y - ny * 5)}L${P(x - nx * (5 + len), y - ny * (5 + len))}`;
  for (let x = x0 + 40; x <= x0 + w - 40; x += step) { const big = Math.abs((x - CX) % (step * 5)) < 1; ticks += edge(x, y0, 0, -1, big ? 10 : 6) + edge(x, y0 + h, 0, 1, big ? 10 : 6); }
  for (let y = y0 + 40; y <= y0 + h - 40; y += step) { const big = Math.abs((y - CY) % (step * 5)) < 1; ticks += edge(x0, y, -1, 0, big ? 10 : 6) + edge(x0 + w, y, 1, 0, big ? 10 : 6); }
  const mid = o / 2 + 2, bx = hole.w / 2 + mid, by = hole.h / 2 + mid;
  let batons = '';
  for (let i = 0; i < 12; i++) {
    const a = rad(i * 30 - 90), dx = Math.cos(a), dy = Math.sin(a);
    const t = Math.min(Math.abs(dx) > 1e-6 ? bx / Math.abs(dx) : Infinity, Math.abs(dy) > 1e-6 ? by / Math.abs(dy) : Infinity);
    const x = CX + dx * t, y = CY + dy * t, vert = Math.abs(dx * t) >= bx - 0.5;
    const len = i % 3 === 0 ? 28 : 18, wd = i % 3 === 0 ? 8 : 5;
    batons += vert ? rr(x - len / 2, y - wd / 2, len, wd, wd / 2) : rr(x - wd / 2, y - len / 2, wd, len, wd / 2);
  }
  return g({},
    path(rr(x0 - 8, y0 - 4, w + 16, h + 18, 34), { fill: '#000', fillOpacity: 0.5 }),
    path(rr(x0 - 6, y0 - 6, w + 12, h + 12, 34), { fill: 'url(#hzSteelEdge)', stroke: INK, strokeWidth: 1.2 }),
    path(outer + inner, { fill: 'url(#hzFrost)', fillRule: 'evenodd' }),
    path(outer + inner, { fill: 'url(#hzGrain)', fillRule: 'evenodd' }),
    path(ticks, { stroke: '#c6ccd4', strokeOpacity: 0.5, strokeWidth: 1 }),
    path(batons, { fill: '#000', fillOpacity: 0.4, transform: 'translate(1.5 2.5)' }),
    path(batons, { fill: 'url(#hzRose)', stroke: '#5a2a1a', strokeWidth: 0.8 }),
    path(rr(hole.x - 4, hole.y - 4, hole.w + 8, hole.h + 8, radius + 3), { fill: 'url(#hzRoseD)', stroke: INK, strokeWidth: 1 }),
    path(rr(hole.x - 1.5, hole.y - 1.5, hole.w + 3, hole.h + 3, radius + 1), { fill: '#120c0a' }));
}

function draw() {
  const holeD = rr(hole.x, hole.y, hole.w, hole.h, radius);
  const caseD = rr(CASE.x, CASE.y, CASE.w, CASE.h, CASE.r), inD = rr(IN.x, IN.y, IN.w, IN.h, IN.r);
  const rnd = rng(4);
  let grain = '';
  for (let i = 0; i < 80; i++) { const x = rnd() * 80, y = rnd() * 80; grain += `M${P(x, y)}h${(1 + rnd() * 2).toFixed(1)}`; }
  const defs = [
    lg('hzRose', [0, 0, 1, 1], [[0, '#ffe2d4'], [0.3, '#eab09a'], [0.62, '#b8705a'], [1, '#f0bea8']]),
    lg('hzRoseD', [0, 0, 1, 1], [[0, '#f6c6b0'], [0.5, '#b06a54'], [1, '#7a3e2e']]),
    lg('hzGold', [0, 0, 1, 1], [[0, '#fff0c0'], [0.45, '#d8a848'], [1, '#8a5e1e']]),
    lg('hzSteel', [0, 0, 1, 1], [[0, '#f4f6f8'], [0.35, '#b8bec6'], [0.7, '#7a828c'], [1, '#d6dade']]),
    lg('hzSteelD', [0, 0, 1, 1], [[0, '#c8ccd2'], [0.5, '#6a727c'], [1, '#3a4048']]),
    lg('hzSteelV', [0, 0, 0, 1], [[0, '#f4f6f8'], [0.4, '#9aa2ac'], [1, '#4a525c']]),
    lg('hzSteelEdge', [0, 0, 1, 1], [[0, '#e8ecf0'], [0.4, '#6a727c'], [0.6, '#a8aeb6'], [1, '#2a3038']]),
    lg('hzMirror', [0, 0, 1, 1], [[0, '#5a6270'], [0.35, '#12151a'], [0.55, '#2a3038'], [1, '#07080a']]),
    lg('hzCase', [0, 0, 1, 1], [[0, '#ffffff'], [0.18, '#c4cad2'], [0.4, '#7c848e'], [0.55, '#e4e8ec'], [0.75, '#6a727c'], [1, '#2a3038']]),
    lg('hzCaseV', [0, 0, 1, 0], [[0, '#4a525c'], [0.3, '#e8ecf0'], [0.6, '#9aa2ac'], [1, '#3a4048']]),
    lg('hzBezel', [0, 0, 0, 1], [[0, '#2a3038'], [0.5, '#5a626c'], [1, '#1a1e24']]),
    lg('hzFrost', [0, 0, 1, 1], [[0, '#353a42'], [0.5, '#272b31'], [1, '#1c1f24']]),
    lg('hzBridge', [0, 0, W, H], [[0, '#e4e8ec'], [0.3, '#a4acb6'], [0.55, '#7a828e'], [1, '#3e444e']], true),
    lg('hzFar', [0, 0, 1, 1], [[0, '#3a4a66'], [0.5, '#1c2638'], [1, '#0e1420']]),
    rg('hzAbyss', [0.35, 0.3, 0.9], [[0, '#1c2430'], [0.6, '#0b0f16'], [1, '#040508']]),
    lg('hzHaze', [0, 0, 1, 1], [[0, '#2a3a58', 0.35], [1, '#05070c', 0.55]]),
    rg('hzKey', [0.16, 0.1, 0.75], [[0, '#ffd8b0', 0.32], [0.45, '#ffd8b0', 0.08], [1, '#ffd8b0', 0]]),
    rg('hzFall', [0.25, 0.2, 1.1], [[0.45, '#000', 0], [1, '#000', 0.5]]),
    lg('hzCrystal', [0, 0, 1, 1], [[0.2, '#fff', 0], [0.32, '#fff', 0.07], [0.36, '#fff', 0.02], [0.4, '#fff', 0.06], [0.5, '#fff', 0]]),
    rg('hzAventurine', [0.5, 0.5, 0.5], [[0, '#1e3a8a'], [0.7, '#0f1f5a'], [1, '#060c2a']]),
    rg('hzMoon', [0.38, 0.35, 0.7], [[0, '#fff4c8'], [0.55, '#e8c060'], [1, '#a8781e']]),
    rg('hzWell', [0.5, 0.45, 0.6], [[0, '#0e1218'], [1, '#020304']]),
    rg('hzSapphire', [0.3, 0.3, 0.9], [[0, '#b8d0ff'], [0.35, '#2a50d0'], [1, '#0a1450']]),
    rg('hzBlue', [0.35, 0.3, 0.8], [[0, '#8ab4ff'], [0.4, '#3a64d8'], [1, '#13246a']]),
    rg('hzRuby', [0.35, 0.3, 0.8], [[0, '#ffb0c4'], [0.35, '#e8204a'], [1, '#5a0018']]),
    rg('hzChaton', [0.4, 0.35, 0.7], [[0, '#ffe8da'], [0.6, '#e2a088'], [1, '#8a4a36']]),
    rg('hzSink', [0.5, 0.5, 0.5], [[0.6, '#f4f6f8'], [1, '#6a727c']]),
    '<linearGradient id="hzStripe" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#000" stop-opacity="0.2"/><stop offset="0.5" stop-color="#fff" stop-opacity="0.18"/><stop offset="1" stop-color="#000" stop-opacity="0.2"/></linearGradient>',
    '<pattern id="hzCotes" width="30" height="400" patternUnits="userSpaceOnUse" patternTransform="rotate(-28)"><rect width="30" height="400" fill="url(#hzStripe)"/></pattern>',
    `<pattern id="hzGrain" width="80" height="80" patternUnits="userSpaceOnUse"><path d="${grain}" stroke="#fff" stroke-opacity="0.08" stroke-width="0.8"/></pattern>`,
    `<clipPath id="hzPlateClip"><path d="${PLATE}"/></clipPath>`,
    `<clipPath id="hzIn"><path d="${inD}"/></clipPath>`,
  ].join('');

  const movement = g({ clipPath: 'url(#hzIn)' },
    path(inD, { fill: 'url(#hzAbyss)' }),
    // far layer
    farWheel(620, 250, 200, 60, 0.1), farWheel(1230, 240, 180, 54, 0.3), farWheel(640, 1110, 190, 56, 0.2),
    farWheel(1190, 1090, 220, 64, 0.5), farWheel(170, 420, 110, 36, 0), farWheel(1640, 980, 120, 40, 0.2), farWheel(900, 120, 120, 40, 0),
    path(inD, { fill: 'url(#hzHaze)' }),
    // middle layer: going-train wheels
    wheel(560, 238, 72, 50, { spokes: 4, rot: 0.3, fill: 'url(#hzSteel)' }),
    wheel(1250, 236, 80, 56, { spokes: 5, rot: 0.1 }),
    wheel(262, 560, 90, 64, { spokes: 5, rot: 0.6 }),
    wheel(250, 790, 64, 44, { spokes: 4, rot: 0.2, fill: 'url(#hzSteel)' }),
    wheel(720, 1066, 86, 60, { spokes: 5, rot: 0.4 }),
    wheel(1076, 1056, 98, 70, { spokes: 6, rot: 0.2 }),
    wheel(900, 1100, 46, 32, { spokes: 4, rot: 0.1, fill: 'url(#hzSteel)' }),
    wheel(1470, 1030, 130, 72, { spokes: 6, rot: 0.15 }),
    wheel(1556, 500, 44, 30, { spokes: 4, fill: 'url(#hzSteel)' }),
    // bridges
    lobed([[350, 420, 22], [262, 560, 34], [256, 680, 18], [250, 790, 30], [262, 910, 20]], 30),
    jewel(262, 560, 6), jewel(250, 790, 6), screw(350, 420, 9, 30), screw(262, 910, 9, 120), screw(256, 680, 7, 80),
    lobed([[560, 1066, 20], [720, 1066, 30], [900, 1100, 24], [1076, 1056, 30], [1236, 1066, 20]], 30),
    jewel(720, 1066, 6), jewel(1076, 1056, 6), screw(560, 1066, 9, 50), screw(1236, 1066, 9, 140), jewel(900, 1100, 5),
    lobed([[1556, 420, 18], [1556, 500, 28], [1566, 650, 26], [1546, 800, 22], [1520, 900, 18]], 28),
    jewel(1556, 500, 6), screw(1556, 420, 8, 20), screw(1520, 900, 8, 100),
    // complications
    moonPhase(900, 420, 250, PLATE),
    screw(718, 188, 9, 30), screw(1082, 188, 9, 150), screw(714, 300, 8, 70), screw(1086, 300, 8, 110),
    barrel(350, 300, 138),
    planetary(1460, 290, 128),
    wheel(1566, 650, 62, 44, { spokes: 4, rot: 0.3, fill: 'url(#hzSteel)' }),
    columnWheel(1546, 800, 50),
    tourbillon(286, 1030, 104),
    // light: warm key from the upper left, falling off into the lower right
    path(inD, { fill: 'url(#hzKey)' }),
    path(inD, { fill: 'url(#hzFall)' }),
    chapterRing(),
    L.lip(holeD, '#000', [[5, 0.3], [2.5, 0.5]]),
    // the sapphire crystal: a soft reflection and the shadow of the bezel on the movement
    path(inD, { fill: 'url(#hzCrystal)' }),
    path(inD, { fill: 'none', stroke: '#000', strokeOpacity: 0.55, strokeWidth: 30 }),
    path(inD, { fill: 'none', stroke: '#000', strokeOpacity: 0.4, strokeWidth: 12 }));

  const body = [
    // soft bench shadow
    [[18, 0.06], [10, 0.1], [4, 0.16]].map(([e, a]) => path(rr(CASE.x - e + 12, CASE.y - e + 20, CASE.w + 2 * e, CASE.h + 2 * e, CASE.r + e), { fill: '#000', fillOpacity: a })).join(''),
    lug(330, -1), lug(1470, -1), lug(330, 1), lug(1470, 1),
    crown(CASE.x + CASE.w - 8, CY), pusher(CASE.x + CASE.w - 30, CY - 230), pusher(CASE.x + CASE.w - 30, CY + 230),
    // polished steel cushion case with a brushed bezel step
    path(caseD, { fill: 'url(#hzCase)', stroke: INK, strokeWidth: 2 }),
    path(rr(CASE.x + 6, CASE.y + 6, CASE.w - 12, CASE.h - 12, CASE.r - 6), { fill: 'none', stroke: '#fff', strokeOpacity: 0.45, strokeWidth: 2 }),
    path(rr(IN.x - 26, IN.y - 26, IN.w + 52, IN.h + 52, IN.r + 26), { fill: 'url(#hzBezel)', stroke: INK, strokeWidth: 1.4 }),
    path(rr(IN.x - 26, IN.y - 26, IN.w + 52, IN.h + 52, IN.r + 26), { fill: 'url(#hzGrain)' }),
    path(rr(IN.x - 6, IN.y - 6, IN.w + 12, IN.h + 12, IN.r + 6), { fill: 'url(#hzSteelEdge)', stroke: INK, strokeWidth: 1.2 }),
    movement,
    path(inD, { fill: 'none', stroke: INK, strokeWidth: 2 }),
    [[1700, 40, 9], [60, 1250, 7], [1140, 1270, 5]].map(([x, y, r]) => path(L.sparkle(x, y, r, 0.1), { fill: '#fff4ee', fillOpacity: 0.8 })).join(''),
  ].join('\n');
  return { defs, body };
}

module.exports = {
  W, H, hole, radius, draw,
  meta: {
    name: 'Horology', theme: 'watchmaking', rarity: 'legendary', translucent: false, collection: 'atelier-noir', license: 'CC-BY-4.0',
    desc: 'Set your game inside a skeleton chronometer: a tourbillon cage, a moon-phase sky of aventurine and layer upon layer of rose-gold wheels under sapphire crystal.',
    tags: ['watch', 'clockwork', 'gears', 'tourbillon', 'moon phase', 'elegant', 'mechanical'],
  },
};
