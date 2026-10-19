'use strict';
// Horology: the open movement of a fine mechanical watch. A dark ruthenium main plate with perlage graining
// carries bridges striped with Cotes de Geneve, rose-gold wheels with spoked crossings, a sunburst ratchet
// wheel over the mainspring barrel, ruby jewels in gold chatons and blued screws. A balance wheel with
// timing screws and a blued hairspring swings under its cock at the top right, a guilloche small-seconds
// subdial sits at the bottom right and a fluted crown juts from the right flank. Wheels peek out from under
// a calm, frosted chapter ring around the picture, marked only by fine ticks and twelve gold batons.
const L = require('../lib');
const { rr, path, g, lg, rg, circle, ellipse, poly, tf, n, P, rng } = L;

const W = 1800, H = 1300;
const PL = { x: 190, y: 170, w: 1420, h: 960 }; // main plate
const hole = { x: 420, y: 380, w: 960, h: 540 }, radius = 8;
const CX = hole.x + hole.w / 2, CY = hole.y + hole.h / 2;
const RING = 50; // chapter ring width around the picture
const INK = '#0d0f12';
const RG = '#e7a78c'; // rose gold edge colour
const rad = (a) => (a * Math.PI) / 180;
const pol = (cx, cy, r, a) => [cx + r * Math.cos(a), cy + r * Math.sin(a)];

/** Annular sector path (r0 < r1) between angles a..b (radians), clockwise. */
function sector(cx, cy, r0, r1, a, b) {
  const big = b - a > Math.PI ? 1 : 0;
  return `M${P(...pol(cx, cy, r1, a))}A${P(r1, r1)} 0 ${big} 1 ${P(...pol(cx, cy, r1, b))}L${P(...pol(cx, cy, r0, b))}A${P(r0, r0)} 0 ${big} 0 ${P(...pol(cx, cy, r0, a))}Z`;
}

/** Toothed wheel outline (involute-ish trapezoid teeth) of tip radius R, tooth depth h. saw: ratchet teeth. */
function teeth(cx, cy, R, k, h, rot = 0, saw = false) {
  const pts = [], step = (Math.PI * 2) / k;
  for (let i = 0; i < k; i++) {
    const a = rot + i * step;
    if (saw) { pts.push(pol(cx, cy, R - h, a), pol(cx, cy, R, a + step * 0.08), pol(cx, cy, R - h * 0.55, a + step * 0.85)); continue; }
    pts.push(pol(cx, cy, R - h, a), pol(cx, cy, R - h, a + step * 0.12), pol(cx, cy, R, a + step * 0.3), pol(cx, cy, R, a + step * 0.6), pol(cx, cy, R - h, a + step * 0.78));
  }
  return poly(pts);
}

/** A wheel: toothed rim with spoked crossings cut through (even-odd), a polished chamfer and a pinion. */
function wheel(cx, cy, R, k, { spokes = 5, rot = 0, fill = 'url(#hzRose)', rim = 0.16, hub = 0.22, tooth = 0 } = {}) {
  const h = tooth || Math.max(5, R * 0.07), Ri = R - h - R * rim, Rh = R * hub;
  let cut = '';
  const sp = (Math.PI * 2) / spokes, sw = Math.max(5, R * 0.055); // spoke half-width in px
  for (let j = 0; j < spokes; j++) {
    const a = rot + j * sp;
    // crossings taper: narrow at the rim, wider at the hub
    const r0 = Rh + 5, ai = sw * 1.5 / r0, ao = sw / Ri;
    cut += `M${P(...pol(cx, cy, Ri, a + ao))}A${P(Ri, Ri)} 0 0 1 ${P(...pol(cx, cy, Ri, a + sp - ao))}L${P(...pol(cx, cy, r0, a + sp - ai))}A${P(r0, r0)} 0 0 0 ${P(...pol(cx, cy, r0, a + ai))}Z`;
  }
  const d = teeth(cx, cy, R, k, h, rot) + cut;
  return path(`${circle(cx + 4, cy + 6, R - h / 2)}${cut}`, { fill: '#000', fillOpacity: 0.35, fillRule: 'evenodd' })
    + path(d, { fill, fillRule: 'evenodd', stroke: INK, strokeWidth: 1.4, strokeLinejoin: 'round' })
    + path(circle(cx, cy, Ri), { fill: 'none', stroke: '#fff3ea', strokeOpacity: 0.55, strokeWidth: 1.6 })
    + path(circle(cx, cy, R - h - 3), { fill: 'none', stroke: '#5a2a1a', strokeOpacity: 0.5, strokeWidth: 1.2 })
    + path(circle(cx, cy, Rh), { fill: 'url(#hzSteel)', stroke: INK, strokeWidth: 1.2 })
    + path(teeth(cx, cy, Rh * 0.72, 8, Rh * 0.18, rot), { fill: 'url(#hzSteelD)', stroke: INK, strokeWidth: 1 })
    + jewel(cx, cy, Math.max(5, Rh * 0.28));
}

/** Ruby jewel bearing in a gold chaton with a polished sink. */
function jewel(cx, cy, r) {
  return path(circle(cx, cy, r * 2.1), { fill: 'url(#hzChaton)', stroke: INK, strokeWidth: 1 })
    + path(circle(cx, cy, r * 1.45), { fill: 'url(#hzSink)' })
    + path(circle(cx, cy, r), { fill: 'url(#hzRuby)', stroke: '#3a0010', strokeWidth: 0.8 })
    + path(circle(cx - r * 0.3, cy - r * 0.35, r * 0.28), { fill: '#fff', fillOpacity: 0.85 })
    + path(circle(cx, cy, r * 0.22), { fill: '#3a0010', fillOpacity: 0.7 });
}

/** Blued screw with a slot at angle a. */
function screw(cx, cy, r, a = 30) {
  const [x0, y0] = pol(cx, cy, r * 0.82, rad(a)), [x1, y1] = pol(cx, cy, r * 0.82, rad(a + 180));
  return path(circle(cx, cy, r + 2.5), { fill: 'url(#hzSink)', stroke: INK, strokeWidth: 0.8 })
    + path(circle(cx, cy, r), { fill: 'url(#hzBlue)', stroke: '#0a1440', strokeWidth: 1 })
    + path(`M${P(x0, y0)}L${P(x1, y1)}`, { stroke: '#050a24', strokeWidth: r * 0.32, strokeLinecap: 'round' })
    + path(`M${P(x0, y0 - 1)}L${P(x1, y1 - 1)}`, { stroke: '#9ec0ff', strokeOpacity: 0.5, strokeWidth: 0.8 });
}

/** A bridge: an outline filled with Cotes de Geneve stripes, a polished rose-gold bevel and a shadow. */
/** A bridge made of overlapping parts (lobes round the jewels, a waist): outlines first, fills over them, so
 * the parts merge into one sculpted piece with a single rose-gold chamfer around its outside. */
function bridgeU(parts) {
  const d = parts.join('');
  return path(d, { fill: '#000', fillOpacity: 0.38, transform: 'translate(5 8)' })
    + path(d, { fill: 'none', stroke: INK, strokeWidth: 9, strokeLinejoin: 'round' })
    + path(d, { fill: 'none', stroke: 'url(#hzRoseD)', strokeWidth: 6.5, strokeLinejoin: 'round' })
    + parts.map((p) => path(p, { fill: 'url(#hzBridgeU)' })).join('')
    + path(d, { fill: 'url(#hzCotes)' });
}

/** Lobed bridge along a line of jewel points [[x, y, r], ...] with a waist of the given width. */
function lobed(pts, waist) {
  const parts = pts.map(([x, y, r]) => circle(x, y, r));
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i], [x1, y1] = pts[i + 1], dx = x1 - x0, dy = y1 - y0, l = Math.hypot(dx, dy), nx = (-dy / l) * waist / 2, ny = (dx / l) * waist / 2;
    parts.push(poly([[x0 + nx, y0 + ny], [x1 + nx, y1 + ny], [x1 - nx, y1 - ny], [x0 - nx, y0 - ny]]));
  }
  return bridgeU(parts);
}

function bridge(d) {
  return path(d, { fill: '#000', fillOpacity: 0.38, transform: 'translate(5 8)' })
    + path(d, { fill: 'url(#hzBridge)', stroke: INK, strokeWidth: 1.5 })
    + path(d, { fill: 'url(#hzCotes)' })
    + path(d, { fill: 'none', stroke: RG, strokeOpacity: 0.85, strokeWidth: 3, transform: 'translate(-0.6 -0.8)' })
    + path(d, { fill: 'none', stroke: INK, strokeWidth: 1.2 });
}

/** Mainspring barrel: a large toothed drum under a sunburst-finished steel ratchet wheel with its click. */
function barrel(cx, cy) {
  let rays = '';
  for (let i = 0; i < 72; i++) { const a = (i * Math.PI) / 36; rays += `M${P(...pol(cx, cy, 22, a))}L${P(...pol(cx, cy, 104, a))}`; }
  const click = `M${P(cx + 98, cy + 92)}C${P(cx + 130, cy + 80, cx + 150, cy + 50, cx + 142, cy + 20)}L${P(cx + 126, cy + 30)}C${P(cx + 130, cy + 54, cx + 116, cy + 72, cx + 96, cy + 80)}Z`;
  return g({},
    wheel(cx, cy, 172, 96, { spokes: 6, rot: 0.2, rim: 0.12, hub: 0.18, tooth: 9 }),
    path(circle(cx, cy, 150), { fill: 'none', stroke: '#5a2a1a', strokeOpacity: 0.4, strokeWidth: 1 }),
    path(circle(cx + 4, cy + 7, 120), { fill: '#000', fillOpacity: 0.4 }),
    path(teeth(cx, cy, 120, 54, 9, 0, true), { fill: 'url(#hzSteel)', stroke: INK, strokeWidth: 1.2 }),
    path(rays, { stroke: '#fff', strokeOpacity: 0.12, strokeWidth: 1.6 }),
    path(rays, { stroke: '#000', strokeOpacity: 0.1, strokeWidth: 1.6, transform: `rotate(2.5 ${cx} ${cy})` }),
    path(circle(cx, cy, 104), { fill: 'none', stroke: '#fff', strokeOpacity: 0.5, strokeWidth: 1.4 }),
    path(circle(cx, cy, 30), { fill: 'url(#hzSteelD)', stroke: INK, strokeWidth: 1.2 }),
    screw(cx, cy, 20, 20),
    path(click, { fill: 'url(#hzSteel)', stroke: INK, strokeWidth: 1.2 }),
    screw(cx + 140, cy + 6, 9, 60));
}

/** Balance wheel with timing screws, a blued hairspring and the cock that holds it. */
function balance(cx, cy) {
  const R = 124;
  let screws = '';
  let slots = '';
  for (let i = 0; i < 18; i++) { const a = rad(i * 20 + 5); const [x, y] = pol(cx, cy, R + 7, a); screws += circle(x, y, 6); slots += `M${P(...pol(x, y, 4.5, a))}L${P(...pol(x, y, -4.5, a))}`; }
  let spiral = '';
  const pts = [];
  for (let i = 0; i <= 360; i++) { const t = i / 360, a = t * Math.PI * 2 * 12, r = 16 + t * 58; pts.push(pol(cx, cy, r, a)); }
  spiral = poly(pts, false);
  // the cock: a broad foot screwed to the plate, an arm sweeping over the balance to a jewelled table
  const cock = `M${P(cx + 30, cy + 196)}C${P(cx - 70, cy + 200, cx - 120, cy + 150, cx - 110, cy + 90)}C${P(cx - 100, cy + 40, cx - 60, cy + 30, cx - 34, cy + 20)}`
    + `C${P(cx - 40, cy - 30, cx + 40, cy - 30, cx + 34, cy + 20)}C${P(cx + 20, cy + 60, cx + 10, cy + 100, cx + 40, cy + 140)}C${P(cx + 70, cy + 170, cx + 80, cy + 196, cx + 30, cy + 196)}Z`;
  const arms = `M${P(...pol(cx, cy, R - 6, rad(-30)))}L${P(...pol(cx, cy, R - 6, rad(150)))}M${P(...pol(cx, cy, R - 6, rad(60)))}L${P(...pol(cx, cy, R - 6, rad(240)))}`;
  return g({},
    path(circle(cx + 5, cy + 8, R + 14), { fill: 'none', stroke: '#000', strokeOpacity: 0.35, strokeWidth: 16 }),
    path(arms, { stroke: INK, strokeWidth: 15, strokeLinecap: 'round' }),
    path(arms, { stroke: 'url(#hzRoseD)', strokeWidth: 11, strokeLinecap: 'round' }),
    path(`${circle(cx, cy, R + 2)}${circle(cx, cy, R - 12)}`, { fill: 'url(#hzRoseD)', fillRule: 'evenodd', stroke: INK, strokeWidth: 1.4 }),
    path(circle(cx, cy, R - 5), { fill: 'none', stroke: '#fff3ea', strokeOpacity: 0.6, strokeWidth: 1.4 }),
    path(screws, { fill: 'url(#hzRose)', stroke: INK, strokeWidth: 1 }),
    path(slots, { stroke: '#5a2a1a', strokeWidth: 1.4 }),
    path(spiral, { fill: 'none', stroke: '#2f4fb8', strokeWidth: 1.1 }),
    path(spiral, { fill: 'none', stroke: '#9ec0ff', strokeOpacity: 0.35, strokeWidth: 0.6, transform: 'translate(-0.5 -0.5)' }),
    bridge(cock),
    // regulator: index arm with a fine graduated sector
    path(`M${P(cx, cy)}L${P(...pol(cx, cy, 96, rad(-118)))}`, { stroke: INK, strokeWidth: 7, strokeLinecap: 'round' }),
    path(`M${P(cx, cy)}L${P(...pol(cx, cy, 96, rad(-118)))}`, { stroke: 'url(#hzSteel)', strokeWidth: 4.5, strokeLinecap: 'round' }),
    path(Array.from({ length: 11 }, (_, i) => { const a = rad(-140 + i * 4); return `M${P(...pol(cx, cy, 84, a))}L${P(...pol(cx, cy, i % 5 ? 92 : 98, a))}`; }).join(''), { stroke: '#f2d2c2', strokeWidth: 1.4 }),
    jewel(cx, cy, 8),
    path(circle(cx, cy, 24), { fill: 'none', stroke: '#c8ccd2', strokeWidth: 3 }),
    screw(cx + 30, cy + 168, 11, 40), screw(cx - 80, cy + 120, 9, 110));
}

/** Escape wheel (club teeth, steel) and the pallet fork with its two ruby pallet stones. */
function escapement(cx, cy) {
  const k = 15, R = 58, pts = [];
  for (let i = 0; i < k; i++) { const a = rad(i * 24); pts.push(pol(cx, cy, R - 16, a), pol(cx, cy, R, a + rad(6)), pol(cx, cy, R - 2, a + rad(11)), pol(cx, cy, R - 16, a + rad(9))); }
  let cut = '';
  for (let j = 0; j < 4; j++) cut += sector(cx, cy, 14, R - 24, rad(j * 90 + 12), rad(j * 90 + 78));
  const fork = `M${P(cx + 30, cy - 70)}L${P(cx + 110, cy - 4)}L${P(cx + 104, cy + 6)}L${P(cx + 24, cy - 58)}Z`;
  return path(poly(pts) + cut, { fill: 'url(#hzSteel)', fillRule: 'evenodd', stroke: INK, strokeWidth: 1.2 })
    + jewel(cx, cy, 5)
    + path(fork, { fill: 'url(#hzSteelD)', stroke: INK, strokeWidth: 1.2 })
    + path(rr(cx + 22, cy - 74, 12, 18, 2), { fill: 'url(#hzRuby)', stroke: '#3a0010', strokeWidth: 0.8, transform: `rotate(40 ${cx + 28} ${cy - 65})` })
    + jewel(cx + 64, cy - 34, 5);
}

/** Small-seconds subdial: rose-engine guilloche, a fine track with tick marks and a blued hand. */
function subdial(cx, cy, R) {
  let rose = '';
  for (let i = 0; i < 48; i++) { const [x, y] = pol(cx, cy, R * 0.31, rad(i * 7.5)); rose += circle(x, y, R * 0.31); }
  for (let i = 0; i < 120; i++) { const a = rad(i * 3); rose += `M${P(...pol(cx, cy, R * 0.67, a))}L${P(...pol(cx, cy, R * 0.72, a))}`; }
  let ticks = '';
  for (let i = 0; i < 60; i++) { const a = rad(i * 6 - 90), big = i % 5 === 0; ticks += `M${P(...pol(cx, cy, R - 8, a))}L${P(...pol(cx, cy, R - (big ? 24 : 15), a))}`; }
  const hand = `M${P(cx - 2.5, cy + 22)}L${P(cx - 1.2, cy - R + 18)}L${P(cx, cy - R + 12)}L${P(cx + 1.2, cy - R + 18)}L${P(cx + 2.5, cy + 22)}Z`;
  return g({},
    path(circle(cx + 4, cy + 7, R + 10), { fill: '#000', fillOpacity: 0.35 }),
    path(circle(cx, cy, R + 10), { fill: 'url(#hzRose)', stroke: INK, strokeWidth: 1.5 }),
    path(circle(cx, cy, R + 4), { fill: 'none', stroke: '#fff3ea', strokeOpacity: 0.7, strokeWidth: 1.5 }),
    path(circle(cx, cy, R), { fill: 'url(#hzDial)', stroke: INK, strokeWidth: 1 }),
    path(rose, { fill: 'none', stroke: '#4a525c', strokeOpacity: 0.5, strokeWidth: 0.7 }),
    path(circle(cx, cy, R * 0.66), { fill: 'none', stroke: '#8a929c', strokeWidth: 1 }),
    path(circle(cx, cy, R - 8) + circle(cx, cy, R - 26), { fill: 'none', stroke: '#4a525c', strokeWidth: 0.8 }),
    path(ticks, { stroke: '#2a3038', strokeWidth: 1.4 }),
    path(hand, { fill: 'url(#hzBlue)', transform: `rotate(132 ${cx} ${cy})` }),
    path(`M${P(cx, cy + 8)}L${P(cx, cy + 34)}`, { stroke: '#2a4cc0', strokeWidth: 4, strokeLinecap: 'round', transform: `rotate(132 ${cx} ${cy})` }),
    path(circle(cx, cy, 7), { fill: 'url(#hzBlue)', stroke: '#0a1440' }),
    path(circle(cx, cy, 2.5), { fill: '#c8ccd2' }));
}

/** Fluted winding crown on its stem, jutting out of the plate's right flank. */
function crown(x, y) {
  let flutes = '';
  for (let i = 0; i < 13; i++) flutes += rr(x + 56, y - 74 + i * 11.6, 54, 5, 2.5);
  return g({},
    path(rr(x - 10, y - 13, 70, 26, 4), { fill: 'url(#hzSteelV)', stroke: INK, strokeWidth: 1.2 }),
    path(rr(x + 40, y - 34, 18, 68, 4), { fill: 'url(#hzRoseV)', stroke: INK, strokeWidth: 1.2 }),
    path(rr(x + 54, y - 74, 62, 156, 18), { fill: '#000', fillOpacity: 0.35 }),
    path(rr(x + 50, y - 80, 62, 160, 18), { fill: 'url(#hzRoseV)', stroke: INK, strokeWidth: 1.5 }),
    path(flutes, { fill: '#6a3424', fillOpacity: 0.55 }),
    path(`M${x + 60} ${y - 70}V${y + 70}`, { stroke: '#fff3ea', strokeOpacity: 0.6, strokeWidth: 2 }),
    path(ellipse(x + 114, y, 12, 40), { fill: 'url(#hzRoseD)', stroke: INK, strokeWidth: 1.2 }),
    path(ellipse(x + 116, y, 7, 26), { fill: 'url(#hzSapphire)', stroke: '#0a1440', strokeWidth: 1 }),
    path(ellipse(x + 114, y - 10, 2.5, 8), { fill: '#fff', fillOpacity: 0.8 }));
}

/** The frosted chapter ring around the picture: ticks every few millimetres and twelve rose-gold batons. */
function chapterRing() {
  const o = RING, x0 = hole.x - o, y0 = hole.y - o, w = hole.w + 2 * o, h = hole.h + 2 * o;
  const outer = rr(x0, y0, w, h, 24), inner = rr(hole.x - 6, hole.y - 6, hole.w + 12, hole.h + 12, radius + 4);
  // ticks along the ring at a constant step, measured around the rectangle
  let ticks = '';
  const step = 18, edge = (x, y, nx, ny, len) => `M${P(x - nx * 6, y - ny * 6)}L${P(x - nx * (6 + len), y - ny * (6 + len))}`;
  for (let x = x0 + 40; x <= x0 + w - 40; x += step) { const big = Math.abs((x - CX) % (step * 5)) < 1; ticks += edge(x, y0, 0, -1, big ? 12 : 7) + edge(x, y0 + h, 0, 1, big ? 12 : 7); }
  for (let y = y0 + 40; y <= y0 + h - 40; y += step) { const big = Math.abs((y - CY) % (step * 5)) < 1; ticks += edge(x0, y, -1, 0, big ? 12 : 7) + edge(x0 + w, y, 1, 0, big ? 12 : 7); }
  // twelve batons where the hour directions cross the ring's centre line
  const mid = (o + 6) / 2 + 4, bx = (hole.w / 2) + mid, by = (hole.h / 2) + mid;
  let batons = '';
  for (let i = 0; i < 12; i++) {
    const a = rad(i * 30 - 90), dx = Math.cos(a), dy = Math.sin(a);
    const t = Math.min(Math.abs(dx) > 1e-6 ? bx / Math.abs(dx) : Infinity, Math.abs(dy) > 1e-6 ? by / Math.abs(dy) : Infinity);
    const x = CX + dx * t, y = CY + dy * t, vert = Math.abs(dx * t) >= bx - 0.5; // on a side edge: baton lies horizontal
    const len = i % 3 === 0 ? 30 : 20, wd = i % 3 === 0 ? 9 : 6;
    const r = vert ? rr(x - len / 2, y - wd / 2, len, wd, wd / 2) : rr(x - wd / 2, y - len / 2, wd, len, wd / 2);
    batons += path(r, { fill: '#000', fillOpacity: 0.35, transform: 'translate(1.5 2.5)' }) + path(r, { fill: 'url(#hzRose)', stroke: '#5a2a1a', strokeWidth: 1 });
  }
  return g({},
    path(rr(x0 - 6, y0 - 4, w + 12, h + 16, 30), { fill: '#000', fillOpacity: 0.35 }),
    path(rr(x0 - 6, y0 - 6, w + 12, h + 12, 30), { fill: 'url(#hzSteelEdge)', stroke: INK, strokeWidth: 1.4 }),
    path(outer + inner, { fill: 'url(#hzFrost)', fillRule: 'evenodd' }),
    path(outer + inner, { fill: 'url(#hzGrain)', fillRule: 'evenodd' }),
    path(ticks, { stroke: '#d6dade', strokeOpacity: 0.55, strokeWidth: 1.1 }),
    batons,
    path(rr(hole.x - 6, hole.y - 6, hole.w + 12, hole.h + 12, radius + 4), { fill: 'url(#hzRoseD)', stroke: INK, strokeWidth: 1 }),
    path(rr(hole.x - 2, hole.y - 2, hole.w + 4, hole.h + 4, radius + 1), { fill: '#1a1210' }));
}

function draw() {
  const holeD = rr(hole.x, hole.y, hole.w, hole.h, radius);
  const plateD = rr(PL.x, PL.y, PL.w, PL.h, 96);
  const rnd = rng(4);
  let grain = '';
  for (let i = 0; i < 90; i++) { const x = rnd() * 80, y = rnd() * 80; grain += `M${P(x, y)}h${n(1 + rnd() * 2)}`; }
  const defs = [
    lg('hzRose', [0, 0, 1, 1], [[0, '#ffe2d4'], [0.3, '#eab09a'], [0.62, '#b8705a'], [1, '#f0bea8']]),
    lg('hzRoseD', [0, 0, 1, 1], [[0, '#f6c6b0'], [0.5, '#b06a54'], [1, '#7a3e2e']]),
    lg('hzRoseV', [0, 0, 0, 1], [[0, '#ffe2d4'], [0.25, '#e8a890'], [0.55, '#9a5a46'], [0.8, '#d89880'], [1, '#6a3424']]),
    lg('hzSteel', [0, 0, 1, 1], [[0, '#f4f6f8'], [0.35, '#b8bec6'], [0.7, '#7a828c'], [1, '#d6dade']]),
    lg('hzSteelD', [0, 0, 1, 1], [[0, '#c8ccd2'], [0.5, '#6a727c'], [1, '#3a4048']]),
    lg('hzSteelV', [0, 0, 0, 1], [[0, '#f4f6f8'], [0.4, '#9aa2ac'], [1, '#4a525c']]),
    lg('hzSteelEdge', [0, 0, 1, 1], [[0, '#f4f6f8'], [0.4, '#8a929c'], [0.6, '#c8ccd2'], [1, '#4a525c']]),
    lg('hzFrost', [0, 0, 1, 1], [[0, '#3a3f46'], [0.5, '#2a2e34'], [1, '#1e2126']]),
    rg('hzDial', [0.45, 0.4, 0.75], [[0, '#e6e8ea'], [0.7, '#c4c8cc'], [1, '#9aa0a6']]),
    lg('hzPlate', [0, 0, 1, 1], [[0, '#4a4f56'], [0.5, '#30343a'], [1, '#202328']]),
    lg('hzBridge', [0, 0, 1, 1], [[0, '#eef0f2'], [0.45, '#c2c7cd'], [1, '#8a929b']]),
    rg('hzPearl', [0.42, 0.4, 0.6], [[0, '#fff', 0.1], [0.7, '#fff', 0.02], [1, '#000', 0.22]]),
    lg('hzBridgeU', [0, 0, W, H], [[0, '#f4f6f8'], [0.3, '#c6cbd1'], [0.5, '#e2e5e8'], [0.75, '#a9b0b8'], [1, '#d4d8dc']], true),
    rg('hzSapphire', [0.3, 0.3, 0.9], [[0, '#b8d0ff'], [0.35, '#2a50d0'], [1, '#0a1450']]),
    rg('hzBlue', [0.35, 0.3, 0.8], [[0, '#8ab4ff'], [0.4, '#3a64d8'], [1, '#13246a']]),
    rg('hzRuby', [0.35, 0.3, 0.8], [[0, '#ffb0c4'], [0.35, '#e8204a'], [1, '#5a0018']]),
    rg('hzChaton', [0.4, 0.35, 0.7], [[0, '#ffe8da'], [0.6, '#e2a088'], [1, '#8a4a36']]),
    rg('hzSink', [0.5, 0.5, 0.5], [[0.6, '#f4f6f8'], [1, '#6a727c']]),
    rg('hzVignette', [0.5, 0.5, 0.75], [[0.6, '#000', 0], [1, '#000', 0.3]]),
    // Cotes de Geneve: soft polished stripes, diagonal
    '<linearGradient id="hzStripe" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#000" stop-opacity="0.22"/><stop offset="0.45" stop-color="#fff" stop-opacity="0.14"/><stop offset="0.6" stop-color="#fff" stop-opacity="0.2"/><stop offset="1" stop-color="#000" stop-opacity="0.22"/></linearGradient>',
    '<pattern id="hzCotes" width="34" height="400" patternUnits="userSpaceOnUse" patternTransform="rotate(-28)"><rect width="34" height="400" fill="url(#hzStripe)"/></pattern>',
    // perlage: overlapping circular graining on the plate
    `<pattern id="hzPerlage" width="24" height="20" patternUnits="userSpaceOnUse">${[[0, 0], [24, 0], [12, 10], [0, 20], [24, 20]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="13" fill="url(#hzPearl)"/>`).join('')}</pattern>`,
    `<pattern id="hzGrain" width="80" height="80" patternUnits="userSpaceOnUse"><path d="${grain}" stroke="#fff" stroke-opacity="0.1" stroke-width="0.8"/></pattern>`,
    `<clipPath id="hzPlateClip"><path d="${plateD}"/></clipPath>`,
  ].join('');


  const body = [
    // soft shadow on the bench
    [[16, 0.06], [9, 0.1], [4, 0.16]].map(([e, a]) => path(rr(PL.x - e + 10, PL.y - e + 18, PL.w + 2 * e, PL.h + 2 * e, 96 + e), { fill: '#000', fillOpacity: a })).join(''),
    // main plate: ruthenium with perlage and a polished rose-gold chamfer at its edge
    path(plateD, { fill: 'url(#hzPlate)', stroke: INK, strokeWidth: 2 }),
    path(plateD, { fill: 'url(#hzPerlage)' }),
    path(plateD, { fill: 'url(#hzVignette)' }),
    path(rr(PL.x + 4, PL.y + 4, PL.w - 8, PL.h - 8, 92), { fill: 'none', stroke: RG, strokeOpacity: 0.85, strokeWidth: 3 }),
    path(rr(PL.x + 12, PL.y + 12, PL.w - 24, PL.h - 24, 86), { fill: 'none', stroke: '#000', strokeOpacity: 0.4, strokeWidth: 1.5 }),
    // wheels of the going train, peeking out from under the bridges and the chapter ring
    wheel(700, 250, 92, 64, { spokes: 5, rot: 0.3 }),
    wheel(1100, 246, 78, 56, { spokes: 4, rot: 0.1 }),
    wheel(900, 1066, 84, 60, { spokes: 5, rot: 0.6 }),
    wheel(290, 660, 64, 40, { spokes: 4, rot: 0.2, fill: 'url(#hzSteel)' }),
    // bridges with their jewels and blued screws
    lobed([[588, 250, 26], [700, 250, 42], [800, 249, 22], [900, 248, 40], [1000, 249, 22], [1100, 250, 42], [1212, 250, 26]], 44), jewel(700, 250, 7), jewel(900, 248, 7), jewel(1100, 250, 7), screw(588, 250, 11, 25), screw(1212, 250, 11, 160),
    lobed([[618, 1066, 26], [760, 1066, 40], [900, 1072, 30], [1040, 1066, 40], [1182, 1066, 26]], 42), jewel(760, 1066, 7), jewel(1040, 1066, 7), screw(618, 1066, 11, 70), screw(1182, 1066, 11, 130), screw(900, 1066, 9, 10),
    lobed([[276, 490, 24], [282, 560, 38], [266, 660, 24], [282, 760, 38], [276, 830, 24]], 40), jewel(282, 560, 7), jewel(282, 760, 7), screw(276, 490, 10, 45), screw(276, 830, 10, 135),
    crown(PL.x + PL.w - 8, CY),
    escapement(1340, 270),
    // the big pieces at the corners, breaking out of the plate's outline
    barrel(330, 318),
    wheel(316, 1010, 146, 84, { spokes: 5, rot: 0.5 }),
    wheel(470, 1080, 58, 36, { spokes: 4, rot: 0.1, fill: 'url(#hzSteel)' }),
    subdial(1474, 1000, 118),
    balance(1490, 296),
    chapterRing(),
    L.lip(holeD, '#000', [[5, 0.3], [2.5, 0.5]]),
    [[1690, 120, 10], [130, 1180, 8], [1110, 1160, 6]].map(([x, y, r]) => path(L.sparkle(x, y, r, 0.1), { fill: '#fff4ee', fillOpacity: 0.8 })).join(''),
  ].join('\n');
  return { defs, body };
}

module.exports = {
  W, H, hole, radius, draw,
  meta: {
    name: 'Horology', theme: 'watchmaking', rarity: 'legendary', translucent: false, collection: 'atelier-noir', license: 'CC-BY-4.0',
    desc: 'Set your game inside the open heart of a fine watch, among rose-gold wheels, ruby jewels, blued screws and a softly beating balance.',
    tags: ['watch', 'clockwork', 'gears', 'rose gold', 'steampunk', 'elegant', 'mechanical'],
  },
};
