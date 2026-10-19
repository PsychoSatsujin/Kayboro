'use strict';
// Gothic Reliquary: a haunted shrine of near-black carved wood and blackened silver. The screen is its
// relic window in a calm silver bezel; above rises a steep crocketed gable holding a rose window that
// glows ghost-green, flanked by parapet pinnacles and two buttress towers with spires and glowing
// lancets. Silver sconces hold dripping candles, melted candle clusters stand on the plinth corners,
// a strand of garnet-and-bone prayer beads drapes down the right side, and a small ornamental skull
// rests in a silver quatrefoil at the base. A faint green aura and wisps hang about it.
const L = require('../lib');
const { rr, path, g, lg, rg, circle, ellipse, sparkle, poly, tf, rng, lip, smooth, n, P } = L;

const W = 1500, H = 1480, hole = { x: 302, y: 700, w: 896, h: 504 }, radius = 10;
const CX = W / 2;
const INK = '#07050a';
const BODY = { x: 228, y: 620, x1: W - 228, y1: 1282 };
const TOW = { x: 106, w: 126, y: 440, b: 1300 }; // left buttress tower (mirrored)
const GAB = { x0: 392, x1: W - 392, yb: 660, ay: 168 }; // central gable
const PLINTH = { x: 70, y: 1290, w: W - 140, h: 92 };
const mirror = (...kids) => g({}, ...kids) + g({ transform: `translate(${W} 0) scale(-1 1)` }, ...kids);

// ---- gothic helpers ----------------------------------------------------------------------------
/** Pointed (two-centred) arch outline over a span, springing at ys; e = centre offset (bigger = sharper). */
function pointed(cx, hs, ys, e, close = true) {
  const r = hs + e, h = Math.sqrt(r * r - e * e);
  return `M${P(cx - hs, ys)}A${P(r, r)} 0 0 1 ${P(cx, ys - h)}A${P(r, r)} 0 0 1 ${P(cx + hs, ys)}${close ? 'Z' : ''}`;
}
/** Lancet: pointed arch on a rectangle (x, top-of-shaft y, w, h). */
const lancet = (x, y, w, h, e = w * 0.35) => `${pointed(x + w / 2, w / 2, y, e, false)}V${n(y + h)}H${n(x)}Z`;
/** n-foil (trefoil, quatrefoil...) outline: lobes of radius lr on a ring of radius R. */
function foil(cx, cy, R, lr, k, rot = -90) {
  let d = '';
  for (let i = 0; i < k; i++) { const a = ((rot + (i * 360) / k) * Math.PI) / 180; d += L.circle(cx + R * Math.cos(a), cy + R * Math.sin(a), lr); }
  return d;
}
/** Hooked gothic crocket (local: base at origin, curling up and over toward +x). */
const crocketD = (s) => `M0 0C${P(-4 * s, -14 * s, 6 * s, -30 * s, 20 * s, -30 * s)}C${P(32 * s, -30 * s, 34 * s, -16 * s, 24 * s, -12 * s)}`
  + `C${P(18 * s, -10 * s, 14 * s, -16 * s, 20 * s, -20 * s)}C${P(12 * s, -22 * s, 8 * s, -12 * s, 12 * s, 0)}Z`;
function crockets(list, s = 1) {
  return g({ fill: 'url(#bsilver)', stroke: INK, strokeWidth: 2, strokeLinejoin: 'round' },
    list.map(([x, y, rot, k = s, flip = false]) => `<path d="${crocketD(k)}" transform="translate(${n(x)} ${n(y)})${flip ? ' scale(-1 1)' : ''} rotate(${n(rot)})"/>`).join(''));
}
/** Crockets along a rake from its foot (x0, y0) up to (x1, y1), mirrored about x = mx: they sprout outward and curl up the slope. */
function rake(x0, y0, x1, y1, count, k, mx, from = 0.08, to = 0.86) {
  const dx = x1 - x0, dy = y1 - y0, l = Math.hypot(dx, dy), rot = (Math.atan2(dy, dx) * 180) / Math.PI, nx = dy / l, ny = -dx / l;
  const out = [];
  for (let i = 0; i < count; i++) {
    const t = from + ((to - from) * i) / Math.max(1, count - 1), x = x0 + dx * t - nx * 3, y = y0 + dy * t - ny * 3;
    out.push([x, y, rot, k, false], [2 * mx - x, y, rot, k, true]);
  }
  return out;
}
/** Spiky finial: a three-lobed fleur with a glowing orb (no cross). */
function finial(x, y, s = 1) {
  const leafD = (rot) => `<path d="M0 0C${P(-14 * s, -10 * s, -16 * s, -34 * s, 0, -50 * s)}C${P(16 * s, -34 * s, 14 * s, -10 * s, 0, 0)}Z" transform="${tf(x, y, rot)}"/>`;
  return g({},
    path(circle(x, y - 18 * s, 34 * s), { fill: 'url(#ghostHalo)', class: 'gr-pulse' }),
    g({ fill: 'url(#bsilver)', stroke: INK, strokeWidth: 2.2, strokeLinejoin: 'round' }, leafD(-52) + leafD(52) + leafD(0)),
    path(circle(x, y - 6 * s, 9 * s), { fill: 'url(#ghostOrb)', stroke: INK, strokeWidth: 2 }),
    path(circle(x - 3 * s, y - 9 * s, 2.5 * s), { fill: '#eafff2' }));
}

// ---- candles -----------------------------------------------------------------------------------
/** Candle standing at (x, base y) with height h and width w: drips, molten top, wick and flame. */
function candle(x, y, h, w, seed) {
  const rnd = rng(seed), top = y - h, x0 = x - w / 2, x1 = x + w / 2;
  // body with a dripping lip
  let d = `M${P(x0, y)}V${n(top + 6)}`;
  const k = 4;
  for (let i = 0; i < k; i++) {
    const a = x0 + (w * i) / k, b = x0 + (w * (i + 1)) / k, dep = 8 + rnd() * (i % 2 ? 34 : 14);
    d += `C${P(a, top + dep * 0.4, a + (b - a) * 0.15, top + dep, (a + b) / 2, top + dep)}C${P(b - (b - a) * 0.15, top + dep, b, top + dep * 0.4, b, top + 4)}`;
  }
  d += `V${n(y)}Z`;
  const drips = [];
  for (let i = 0; i < 2; i++) {
    const dx = x0 + w * (0.2 + rnd() * 0.6), len = 20 + rnd() * h * 0.35;
    drips.push(`M${P(dx - 3.5, top + 10)}V${n(top + len)}A3.5 3.5 0 0 0 ${P(dx + 3.5, top + len)}V${n(top + 10)}Z`);
  }
  const fy = top - 4;
  const flame = (s) => `M${P(x, fy - 40 * s)}C${P(x + 11 * s, fy - 24 * s, x + 10 * s, fy, x, fy)}C${P(x - 10 * s, fy, x - 11 * s, fy - 24 * s, x, fy - 40 * s)}Z`;
  return g({},
    path(rr(x0, top + 4, w, h - 4, 3), { fill: 'url(#wax)', stroke: INK, strokeWidth: 2.5 }),
    path(d, { fill: 'url(#waxTop)', stroke: INK, strokeWidth: 2.5, strokeLinejoin: 'round' }),
    path(drips.join(''), { fill: 'url(#waxTop)', stroke: INK, strokeWidth: 2 }),
    path(ellipse(x, top + 4, w / 2 - 2, 4), { fill: '#fff8e6' }),
    path(`M${P(x0 + 4, top + 26)}V${n(y - 6)}`, { stroke: '#fff', strokeOpacity: 0.55, strokeWidth: 2.5, strokeLinecap: 'round' }),
    path(`M${P(x, top + 4)}V${n(fy + 2)}`, { stroke: INK, strokeWidth: 2.5, strokeLinecap: 'round' }),
    g({ class: seed % 2 ? 'gr-flick' : 'gr-flick2' },
      path(circle(x, fy - 18, 44), { fill: 'url(#flameHalo)' }),
      path(flame(1), { fill: '#ff9a2e' }), path(flame(0.72), { fill: '#ffd36a' }), path(flame(0.4), { fill: '#fff6d8' }),
      path(ellipse(x, fy - 4, 3, 5), { fill: '#7ad0ff', fillOpacity: 0.7 })));
}

/** Silver sconce projecting out from the tower face, with a candle. */
function sconce(xw, y) {
  const cx = 52, arm = `M${xw} ${y}C${xw - 20} ${y} ${cx + 24} ${y - 4} ${cx + 10} ${y + 14}`;
  return g({},
    path(rr(xw - 10, y - 30, 18, 60, 6), { fill: 'url(#bsilver)', stroke: INK, strokeWidth: 2.5 }),
    path(arm, { fill: 'none', stroke: INK, strokeWidth: 10, strokeLinecap: 'round' }),
    path(arm, { fill: 'none', stroke: 'url(#bsilver)', strokeWidth: 5.5, strokeLinecap: 'round' }),
    path(`M${xw - 4} ${y + 22}C${xw - 30} ${y + 22} ${cx + 30} ${y + 44} ${cx + 4} ${y + 22}`, { fill: 'none', stroke: INK, strokeWidth: 6, strokeLinecap: 'round' }),
    path(`M${xw - 4} ${y + 22}C${xw - 30} ${y + 22} ${cx + 30} ${y + 44} ${cx + 4} ${y + 22}`, { fill: 'none', stroke: '#6a707c', strokeWidth: 2.5, strokeLinecap: 'round' }),
    path(ellipse(cx, y + 18, 34, 9), { fill: 'url(#bsilver)', stroke: INK, strokeWidth: 2.5 }),
    path(`M${cx - 10} ${y + 26}L${cx} ${y + 46}L${cx + 10} ${y + 26}Z`, { fill: 'url(#bsilver)', stroke: INK, strokeWidth: 2.5, strokeLinejoin: 'round' }),
    candle(cx, y + 14, 150, 26, 3));
}

// ---- architecture ------------------------------------------------------------------------------
function aura() {
  return path(ellipse(CX, 760, 760, 780), { fill: 'url(#aura)' })
    + path(ellipse(CX, 1424, 660, 44), { fill: 'url(#floor)' });
}

/** Left buttress tower: niche lancet glowing green, quatrefoil panel, gablet and crocketed spire. */
function tower() {
  const { x, w, y, b } = TOW, cx = x + w / 2;
  const spireTop = 110, sy = y - 70; // spire from sy up to spireTop
  const spire = `M${P(cx - 34, sy)}L${P(cx, spireTop)}L${P(cx + 34, sy)}Z`;
  const gab = `M${P(x - 6, y)}L${P(cx, y - 78)}L${P(x + w + 6, y)}Z`;
  const niche = lancet(cx - 30, y + 86, 60, 380, 22), glass = lancet(cx - 20, y + 96, 40, 360, 15);
  const cr = rake(cx - 34, sy, cx, spireTop, 5, 0.62, cx, 0.12, 0.78);
  return g({},
    path(rr(x + 12, y, w, b - y, 0), { fill: '#000', fillOpacity: 0.35 }),
    path(rr(x, y, w, b - y, 0), { fill: 'url(#woodV)', stroke: INK, strokeWidth: 3.5 }),
    path(`M${x + 9} ${y + 10}V${b - 10}`, { stroke: '#8a6250', strokeOpacity: 0.5, strokeWidth: 2.5 }),
    // glowing lancet niche
    path(niche, { fill: '#0d0a0e', stroke: 'url(#bsilver)', strokeWidth: 5 }),
    path(glass, { fill: 'url(#ghostGlass)', class: 'gr-pulse' }),
    path(`M${cx} ${y + 70}V${y + 456}M${cx - 20} ${y + 300}H${cx + 20}`, { stroke: 'url(#bsilver)', strokeWidth: 4 }),
    path(foil(cx, y + 150, 9, 8, 3), { fill: 'none', stroke: 'url(#bsilver)', strokeWidth: 3 }),
    // quatrefoil panel below
    path(rr(cx - 40, y + 500, 80, 80, 6), { fill: '#120c0c', stroke: 'url(#bsilver)', strokeWidth: 3 }),
    path(foil(cx, y + 540, 15, 16, 4, -45), { fill: 'none', stroke: 'url(#bsilver)', strokeWidth: 3.5 }),
    path(circle(cx, y + 540, 6), { fill: 'url(#ghostOrb)', stroke: INK, strokeWidth: 1.5 }),
    path(lancet(cx - 26, y + 620, 52, 180, 18), { fill: '#120c0c', stroke: 'url(#bsilver)', strokeWidth: 3 }),
    path(lancet(cx - 14, y + 640, 28, 150, 10), { fill: 'none', stroke: '#3a2a26', strokeWidth: 2 }),
    // string courses
    ...[y + 10, y + 480, y + 600, b - 70].map((yy) => path(rr(x - 8, yy, w + 16, 14, 3), { fill: 'url(#bsilverH)', stroke: INK, strokeWidth: 2.5 })),
    path(rr(x - 16, b - 50, w + 32, 50, 4), { fill: 'url(#woodV)', stroke: INK, strokeWidth: 3.5 }),
    // gablet + spire
    path(gab, { fill: 'url(#woodV)', stroke: INK, strokeWidth: 3.5, strokeLinejoin: 'round' }),
    path(pointed(cx, 22, y - 8, 10), { fill: 'url(#ghostGlass)', stroke: 'url(#bsilver)', strokeWidth: 3, class: 'gr-pulse' }),
    path(rr(cx - 40, sy - 6, 80, 16, 3), { fill: 'url(#bsilverH)', stroke: INK, strokeWidth: 2.5 }),
    path(spire, { fill: 'url(#spire)', stroke: INK, strokeWidth: 3, strokeLinejoin: 'round' }),
    path(`M${P(cx - 4, sy - 6)}L${P(cx, spireTop + 30)}`, { stroke: '#8a909c', strokeOpacity: 0.6, strokeWidth: 2 }),
    crockets(cr),
    finial(cx, spireTop + 4, 0.8),
    // little gablet crockets
    crockets(rake(x - 6, y, cx, y - 78, 2, 0.55, cx, 0.3, 0.7)));
}

/** Small pinnacle on the parapet between the gable and a tower. */
function pinnacle(cx, yb) {
  const top = yb - 220;
  return g({},
    path(rr(cx - 22, yb - 70, 44, 70, 0), { fill: 'url(#woodV)', stroke: INK, strokeWidth: 3 }),
    path(lancet(cx - 8, yb - 56, 16, 46, 6), { fill: 'url(#ghostGlass)', stroke: 'url(#bsilver)', strokeWidth: 2.5, class: 'gr-pulse' }),
    path(rr(cx - 28, yb - 80, 56, 12, 3), { fill: 'url(#bsilverH)', stroke: INK, strokeWidth: 2.5 }),
    path(`M${P(cx - 22, yb - 80)}L${P(cx, top)}L${P(cx + 22, yb - 80)}Z`, { fill: 'url(#spire)', stroke: INK, strokeWidth: 3, strokeLinejoin: 'round' }),
    crockets(rake(cx - 22, yb - 80, cx, top, 3, 0.48, cx, 0.15, 0.7)),
    finial(cx, top + 4, 0.6));
}

/** Steep central gable with crockets, inner tracery and the ghost-green rose window. */
function gable() {
  const { x0, x1, yb, ay } = GAB;
  const outer = poly([[x0, yb], [CX, ay], [x1, yb]]);
  const inset = 34, k = (CX - x0) / (yb - ay);
  const inner = poly([[x0 + inset / Math.cos(Math.atan(k)) + 6, yb], [CX, ay + inset / Math.sin(Math.atan(1 / k))], [x1 - inset / Math.cos(Math.atan(k)) - 6, yb]]);
  const RC = { x: CX, y: 452, r: 124 };
  // hexafoil tracery: six lobes around a small centre, spokes to the ring
  let spokes = '';
  for (let i = 0; i < 6; i++) { const a = ((-90 + i * 60 + 30) * Math.PI) / 180; spokes += `M${P(RC.x + 30 * Math.cos(a), RC.y + 30 * Math.sin(a))}L${P(RC.x + RC.r * Math.cos(a), RC.y + RC.r * Math.sin(a))}`; }
  const lobes = foil(RC.x, RC.y, 66, 40, 6);
  // crockets climbing both rakes
  const cr = rake(x0, yb, CX, ay, 8, 1, CX, 0.1, 0.84);
  // blind arcade along the gable base
  const arc = [];
  for (let i = 0; i < 6; i++) arc.push(lancet(CX - 222 + i * 76, yb - 92, 40, 70, 14));
  return g({},
    path(outer, { fill: '#000', fillOpacity: 0.35, transform: 'translate(10 12)' }),
    path(outer, { fill: 'url(#wood)', stroke: INK, strokeWidth: 4, strokeLinejoin: 'round' }),
    path(inner, { fill: 'url(#woodIn)', stroke: 'url(#bsilver)', strokeWidth: 5, strokeLinejoin: 'round' }),
    path(arc.join(''), { fill: '#110b0b', stroke: 'url(#bsilver)', strokeWidth: 2.5 }),
    // rose window
    path(circle(RC.x, RC.y, RC.r + 22), { fill: 'url(#bsilver)', stroke: INK, strokeWidth: 3 }),
    path(circle(RC.x, RC.y, RC.r), { fill: 'url(#ghostRose)' }),
    g({ class: 'gr-pulse' }, path(circle(RC.x, RC.y, RC.r), { fill: 'url(#ghostCore)' })),
    path(lobes, { fill: 'none', stroke: INK, strokeWidth: 12 }),
    path(lobes, { fill: 'none', stroke: 'url(#bsilver)', strokeWidth: 7 }),
    path(spokes, { stroke: INK, strokeWidth: 10, strokeLinecap: 'round' }),
    path(spokes, { stroke: 'url(#bsilver)', strokeWidth: 5, strokeLinecap: 'round' }),
    path(circle(RC.x, RC.y, 26), { fill: 'url(#bsilver)', stroke: INK, strokeWidth: 3 }),
    path(foil(RC.x, RC.y, 8, 8, 4, -45), { fill: 'none', stroke: INK, strokeWidth: 3 }), path(foil(RC.x, RC.y, 8, 8, 4, -45), { fill: 'url(#ghostOrb)' }),
    path(circle(RC.x, RC.y, RC.r), { fill: 'none', stroke: INK, strokeWidth: 4 }),
    path(`M${RC.x - RC.r - 12} ${RC.y - 30}A${RC.r + 12} ${RC.r + 12} 0 0 1 ${RC.x - 40} ${RC.y - RC.r - 6}`, { fill: 'none', stroke: '#d9dee8', strokeOpacity: 0.6, strokeWidth: 3, strokeLinecap: 'round' }),
    // small trefoils in the spandrels
    ...[[CX - 190, yb - 130], [CX + 190, yb - 130], [CX, ay + 120]].map(([x, y]) => path(foil(x, y, 9, 9, 3), { fill: '#110b0b', stroke: 'url(#bsilver)', strokeWidth: 2.5 })),
    path(outer, { fill: 'none', stroke: 'url(#bsilver)', strokeWidth: 6, strokeLinejoin: 'round', transform: 'translate(0 0)' }),
    path(outer, { fill: 'none', stroke: INK, strokeWidth: 2, strokeLinejoin: 'round' }),
    crockets(cr, 0.9),
    finial(CX, ay - 2, 1.2));
}

/** Carved wood body around the relic window, with cresting along the parapet. */
function body() {
  const { x, y, x1, y1 } = BODY, holeD = rr(hole.x, hole.y, hole.w, hole.h, radius);
  // cresting: a row of small trefoil points along the parapet top
  let crest = '';
  for (let cx = x + 22; cx < x1 - 10; cx += 34) {
    if (cx > GAB.x0 - 10 && cx < GAB.x1 + 10) continue;
    crest += `M${P(cx - 12, y)}C${P(cx - 12, y - 12, cx - 6, y - 14, cx - 6, y - 20)}C${P(cx - 10, y - 26, cx - 4, y - 34, cx, y - 38)}C${P(cx + 4, y - 34, cx + 10, y - 26, cx + 6, y - 20)}C${P(cx + 6, y - 14, cx + 12, y - 12, cx + 12, y)}Z`;
  }
  const rosettes = [[hole.x - 50, hole.y - 50], [hole.x + hole.w + 50, hole.y - 50], [hole.x - 50, hole.y + hole.h + 50], [hole.x + hole.w + 50, hole.y + hole.h + 50]];
  return g({},
    path(rr(x + 12, y + 14, x1 - x, y1 - y, 0), { fill: '#000', fillOpacity: 0.35 }),
    path(crest, { fill: 'url(#bsilver)', stroke: INK, strokeWidth: 2, strokeLinejoin: 'round' }),
    path(rr(x, y, x1 - x, y1 - y, 0), { fill: 'url(#wood)', stroke: INK, strokeWidth: 4 }),
    path(rr(x - 10, y - 4, x1 - x + 20, 18, 3), { fill: 'url(#bsilverH)', stroke: INK, strokeWidth: 2.5 }),
    path(rr(x + 16, y + 30, x1 - x - 32, y1 - y - 46, 6), { fill: 'none', stroke: '#6e4c3e', strokeOpacity: 0.55, strokeWidth: 2 }),
    path(rr(x + 22, y + 36, x1 - x - 44, y1 - y - 58, 4), { fill: 'none', stroke: INK, strokeOpacity: 0.6, strokeWidth: 2 }),
    // calm silver bezel around the relic window
    path(rr(hole.x - 30, hole.y - 30, hole.w + 60, hole.h + 60, 18), { fill: 'url(#bsilverD)', stroke: INK, strokeWidth: 3.5 }),
    path(rr(hole.x - 22, hole.y - 22, hole.w + 44, hole.h + 44, 14), { fill: 'none', stroke: '#d9dee8', strokeOpacity: 0.45, strokeWidth: 2 }),
    path(rr(hole.x - 12, hole.y - 12, hole.w + 24, hole.h + 24, 12), { fill: '#060507', stroke: '#2f3a34', strokeWidth: 2 }),
    path(rr(hole.x - 7, hole.y - 7, hole.w + 14, hole.h + 14, 11), { fill: 'none', stroke: '#7dffb0', strokeOpacity: 0.22, strokeWidth: 3 }),
    lip(holeD, '#000', [[5, 0.4], [2, 0.65]]),
    ...rosettes.map(([rx, ry]) => path(foil(rx, ry, 9, 9, 4, -45), { fill: 'none', stroke: INK, strokeWidth: 4 }) + path(foil(rx, ry, 9, 9, 4, -45), { fill: 'url(#bsilver)' })
      + path(circle(rx, ry, 5), { fill: 'url(#garnet)', stroke: INK, strokeWidth: 1.5 })));
}

/** The plinth: moulded base, claw-ball feet, the skull cartouche and melted candle clusters. */
function plinth() {
  const { x, y, w, h } = PLINTH;
  // turned bun feet: collar ring over a squashed silver ball
  const foot = (fx) => g({},
    path(ellipse(fx, y + h + 30, 38, 22), { fill: 'url(#bsilverR)', stroke: INK, strokeWidth: 3 }),
    path(rr(fx - 30, y + h + 2, 60, 14, 5), { fill: 'url(#bsilverH)', stroke: INK, strokeWidth: 2.5 }),
    path(ellipse(fx - 14, y + h + 24, 10, 5), { fill: '#e6eaf2', fillOpacity: 0.55 }));
  return g({},
    foot(x + 70), foot(x + w - 70),
    path(rr(x + 10, y + 14, w, h, 0), { fill: '#000', fillOpacity: 0.35 }),
    path(rr(x, y, w, h, 6), { fill: 'url(#wood)', stroke: INK, strokeWidth: 4 }),
    path(rr(x - 12, y - 8, w + 24, 22, 4), { fill: 'url(#bsilverH)', stroke: INK, strokeWidth: 3 }),
    path(rr(x - 8, y + h - 14, w + 16, 18, 4), { fill: 'url(#bsilverH)', stroke: INK, strokeWidth: 3 }),
    path(`M${x + 20} ${y + 24}H${x + w - 20}`, { stroke: '#7a5444', strokeOpacity: 0.5, strokeWidth: 2 }),
    // repeating quatrefoil frieze, kept away from the cartouche
    ...Array.from({ length: 16 }, (_, i) => x + 70 + i * ((w - 140) / 15)).filter((fx) => Math.abs(fx - CX) > 160)
      .map((fx) => path(foil(fx, y + 50, 9, 9, 4, -45), { fill: '#120c0c', stroke: 'url(#bsilver)', strokeWidth: 2.5 })),
    skull(CX, y + 40));
}

/** Small ornamental skull in a blackened-silver quatrefoil with filigree scrolls. */
function skull(cx, cy) {
  const s = 1;
  const cran = `M${P(cx - 34, cy + 6)}C${P(cx - 40, cy - 30, cx - 22, cy - 50, cx, cy - 50)}C${P(cx + 22, cy - 50, cx + 40, cy - 30, cx + 34, cy + 6)}`
    + `C${P(cx + 32, cy + 16, cx + 24, cy + 18, cx + 22, cy + 28)}H${n(cx - 22)}C${P(cx - 24, cy + 18, cx - 32, cy + 16, cx - 34, cy + 6)}Z`;
  const eyes = ellipse(cx - 15, cy - 6, 11, 10) + ellipse(cx + 15, cy - 6, 11, 10);
  const nose = `M${P(cx, cy + 2)}L${P(cx - 6, cy + 14)}Q${P(cx, cy + 17, cx + 6, cy + 14)}Z`;
  const teeth = rr(cx - 19, cy + 24, 38, 16, 5);
  const scroll = (sx) => `M${P(cx + sx * 60, cy + 8)}C${P(cx + sx * 96, cy + 8, cx + sx * 110, cy - 26, cx + sx * 132, cy - 10)}C${P(cx + sx * 146, cy, cx + sx * 132, cy + 22, cx + sx * 120, cy + 10)}`
    + `M${P(cx + sx * 60, cy + 20)}C${P(cx + sx * 100, cy + 26, cx + sx * 116, cy + 44, cx + sx * 140, cy + 34)}`;
  return g({},
    path(circle(cx, cy - 4, 96), { fill: 'url(#ghostHalo)', class: 'gr-pulse' }),
    path(scroll(1) + scroll(-1), { fill: 'none', stroke: INK, strokeWidth: 8, strokeLinecap: 'round' }),
    path(scroll(1) + scroll(-1), { fill: 'none', stroke: 'url(#bsilver)', strokeWidth: 4, strokeLinecap: 'round' }),
    // merged quatrefoil: outlines first, fills on top hide the inner overlaps
    path(foil(cx, cy - 4, 34 * s, 38 * s, 4, -45), { fill: 'none', stroke: INK, strokeWidth: 6 }),
    path(foil(cx, cy - 4, 34 * s, 38 * s, 4, -45), { fill: 'url(#bsilverD)' }),
    path(foil(cx, cy - 4, 34 * s, 30 * s, 4, -45), { fill: 'none', stroke: '#5a606c', strokeWidth: 4 }),
    path(foil(cx, cy - 4, 34 * s, 30 * s, 4, -45), { fill: '#0e0a0c' }),
    path(cran, { fill: 'url(#bone)', stroke: INK, strokeWidth: 3, strokeLinejoin: 'round' }),
    path(teeth, { fill: 'url(#bone)', stroke: INK, strokeWidth: 2.5 }),
    path(`M${cx - 9} ${cy + 26}V${cy + 38}M${cx} ${cy + 26}V${cy + 39}M${cx + 9} ${cy + 26}V${cy + 38}M${cx - 18} ${cy + 32}H${cx + 18}`, { stroke: INK, strokeOpacity: 0.7, strokeWidth: 1.8 }),
    path(eyes, { fill: '#0b0709', stroke: INK, strokeWidth: 2 }),
    g({ class: 'gr-pulse' }, path(ellipse(cx - 15, cy - 5, 5, 4.5) + ellipse(cx + 15, cy - 5, 5, 4.5), { fill: '#8dffbe' })),
    path(nose, { fill: '#0b0709', stroke: INK, strokeWidth: 1.5, strokeLinejoin: 'round' }),
    path(`M${P(cx - 22, cy - 36)}C${P(cx - 12, cy - 44, cx + 4, cy - 46, cx + 12, cy - 42)}`, { fill: 'none', stroke: '#fffaf0', strokeOpacity: 0.85, strokeWidth: 3.5, strokeLinecap: 'round' }),
    // a tiny filigree diadem on the brow
    path(`M${P(cx - 24, cy - 30)}Q${P(cx, cy - 40, cx + 24, cy - 30)}`, { fill: 'none', stroke: INK, strokeWidth: 5, strokeLinecap: 'round' }),
    path(`M${P(cx - 24, cy - 30)}Q${P(cx, cy - 40, cx + 24, cy - 30)}`, { fill: 'none', stroke: 'url(#bsilver)', strokeWidth: 2.5, strokeLinecap: 'round' }),
    path(circle(cx, cy - 36, 5), { fill: 'url(#garnet)', stroke: INK, strokeWidth: 1.5 }));
}

/** Melted candle cluster on a plinth corner. */
function cluster(x, y) {
  return path(ellipse(x, y + 2, 60, 10), { fill: 'url(#waxTop)', stroke: INK, strokeWidth: 2.5 })
    + candle(x - 30, y + 4, 70, 24, 6) + candle(x + 28, y + 4, 52, 22, 9) + candle(x, y + 8, 110, 28, 12);
}

/** Prayer-bead strand looped over the right sconce: a swag back to a hook on the tower, and a tail with a medallion. */
function beads() {
  const sc = [W - 58, 878], hook = [W - TOW.x - 2, 990], end = [W - 46, 1150];
  const swag = [], tail = [];
  for (let i = 0; i <= 12; i++) { const t = i / 12; swag.push([sc[0] + (hook[0] - sc[0]) * t, sc[1] + (hook[1] - sc[1]) * t + 64 * Math.sin(Math.PI * t)]); }
  for (let i = 1; i <= 15; i++) { const t = i / 15; tail.push([sc[0] + (end[0] - sc[0]) * t + 9 * Math.sin(Math.PI * t), sc[1] + (end[1] - sc[1]) * t]); }
  const all = [...swag.reverse(), ...tail];
  const thread = smooth(all.map(([x, y]) => [x, y]));
  let red = '', bone = '', shine = '';
  all.forEach(([x, y], i) => {
    const r = i % 5 === 0 ? 8 : 6;
    if (i % 5 === 0) bone += `<path d="${circle(x, y, r)}"/>`; else red += `<path d="${circle(x, y, r)}"/>`;
    shine += circle(x - r * 0.35, y - r * 0.35, r * 0.3);
  });
  const [mx, my] = end;
  return g({},
    path(thread, { fill: 'none', stroke: '#5a606c', strokeWidth: 1.5 }),
    g({ fill: 'url(#garnet)', stroke: INK, strokeWidth: 1.6 }, red),
    g({ fill: 'url(#bone)', stroke: INK, strokeWidth: 1.6 }, bone),
    path(shine, { fill: '#fff', fillOpacity: 0.7 }),
    path(circle(hook[0], hook[1], 7), { fill: 'url(#bsilverR)', stroke: INK, strokeWidth: 2 }),
    // oval medallion with a quatrefoil and a little tassel
    path(ellipse(mx, my + 30, 22, 28), { fill: 'url(#bsilverD)', stroke: INK, strokeWidth: 2.5 }),
    path(foil(mx, my + 30, 7, 7, 4, -45), { fill: 'none', stroke: INK, strokeWidth: 3 }), path(foil(mx, my + 30, 7, 7, 4, -45), { fill: 'url(#ghostOrb)' }),
    path(`M${mx - 8} ${my + 58}L${mx - 12} ${my + 100}M${mx - 3} ${my + 58}L${mx - 4} ${my + 104}M${mx + 3} ${my + 58}L${mx + 4} ${my + 104}M${mx + 8} ${my + 58}L${mx + 12} ${my + 100}`, { stroke: '#7a1426', strokeWidth: 3.5, strokeLinecap: 'round' }),
    path(rr(mx - 10, my + 54, 20, 10, 3), { fill: 'url(#bsilverH)', stroke: INK, strokeWidth: 2 }));
}

/** Faint ghost wisps drifting up around the gable. */
function wisps() {
  const w = (x, y, s, flip) => `M${P(x, y)}C${P(x + 30 * s * flip, y - 40 * s, x - 30 * s * flip, y - 90 * s, x + 10 * s * flip, y - 140 * s)}C${P(x + 30 * s * flip, y - 110 * s, x + 26 * s * flip, y - 60 * s, x, y)}Z`;
  return g({ class: 'gr-drift' }, path(w(300, 420, 1.2, 1) + w(1210, 380, 1, -1) + w(560, 250, 0.8, -1) + w(950, 230, 0.9, 1), { fill: 'url(#wisp)' }));
}

function draw() {
  const defs = [
    '<style>.gr-pulse{animation:gr-pulse 5s ease-in-out infinite}.gr-flick,.gr-flick2{animation:gr-flick 1.1s steps(2,end) infinite}.gr-flick2{animation-delay:-.5s}'
      + '.gr-drift{animation:gr-drift 9s ease-in-out infinite alternate}'
      + '@keyframes gr-pulse{0%,100%{opacity:1}50%{opacity:.6}}@keyframes gr-flick{0%,100%{opacity:1}50%{opacity:.82}}'
      + '@keyframes gr-drift{0%{opacity:.4;transform:translateY(10px)}100%{opacity:1;transform:translateY(-16px)}}'
      + '@media (prefers-reduced-motion:reduce){*{animation:none!important}}</style>',
    lg('wood', [0, 0, 1, 1], [[0, '#4a3128'], [0.45, '#2c1c17'], [1, '#150c0a']]),
    lg('woodV', [0, 0, 1, 0], [[0, '#2a1a15'], [0.3, '#4e352b'], [0.7, '#2a1a15'], [1, '#140b09']]),
    lg('woodIn', [0, 0, 0, 1], [[0, '#1e1311'], [1, '#2e1e19']]),
    lg('bsilver', [0, 0, 1, 1], [[0, '#b9bfcb'], [0.35, '#6a707c'], [0.65, '#2e323a'], [1, '#5a606c']]),
    lg('bsilverH', [0, 0, 0, 1], [[0, '#c4c9d4'], [0.4, '#6a707c'], [1, '#22252c']]),
    lg('bsilverD', [0, 0, 1, 1], [[0, '#a7adba'], [0.3, '#4f545e'], [0.6, '#24272e'], [1, '#6a707c']]),
    rg('bsilverR', [0.35, 0.3, 0.8], [[0, '#d9dee8'], [0.5, '#5a606c'], [1, '#1c1e24']]),
    lg('spire', [0, 0, 1, 0], [[0, '#5a606c'], [0.45, '#2e323a'], [1, '#121418']]),
    lg('wax', [0, 0, 1, 0], [[0, '#d8ccb2'], [0.3, '#f6eedc'], [1, '#b8a98a']]),
    lg('waxTop', [0, 0, 1, 0], [[0, '#efe5cf'], [0.4, '#fffaf0'], [1, '#d8ccb2']]),
    rg('flameHalo', [0.5, 0.5, 0.5], [[0, '#ffd27a', 0.38], [0.5, '#ff9a2e', 0.12], [1, '#ff9a2e', 0]]),
    rg('bone', [0.4, 0.3, 0.8], [[0, '#fffaf0'], [0.55, '#e6dac0'], [1, '#a8987a']]),
    rg('garnet', [0.35, 0.3, 0.8], [[0, '#ff8a9c'], [0.45, '#a0142e'], [1, '#3a0510']]),
    rg('ghostOrb', [0.4, 0.35, 0.8], [[0, '#eafff2'], [0.5, '#8dffbe'], [1, '#1f8a55']]),
    rg('ghostHalo', [0.5, 0.5, 0.5], [[0, '#8dffbe', 0.32], [1, '#8dffbe', 0]]),
    lg('ghostGlass', [0, 0, 0, 1], [[0, '#b8ffd6'], [0.4, '#4fd88f'], [1, '#0e3a26']]),
    rg('ghostRose', [0.5, 0.5, 0.6], [[0, '#c8ffe0'], [0.45, '#3fc983'], [1, '#0a2a1c']]),
    rg('ghostCore', [0.5, 0.5, 0.5], [[0, '#ffffff', 0.7], [0.5, '#8dffbe', 0.2], [1, '#8dffbe', 0]]),
    rg('aura', [0.5, 0.45, 0.5], [[0, '#5dffa0', 0.24], [0.35, '#3fe08a', 0.13], [0.7, '#2fd07a', 0.04], [1, '#2fd07a', 0]]),
    lg('wisp', [0, 1, 0, 0], [[0, '#8dffbe', 0], [0.5, '#b8ffd6', 0.36], [1, '#e6fff0', 0]]),
    rg('floor', [0.5, 0.5, 0.5], [[0, '#000', 0.38], [1, '#000', 0]]),
  ].join('');

  const out = [
    aura(),
    wisps(),
    mirror(tower(), sconce(TOW.x, 830)),
    body(),
    mirror(pinnacle(310, BODY.y)),
    gable(),
    plinth(),
    mirror(cluster(150, PLINTH.y - 6)),
    beads(),
    ...[[60, 300, 10], [1440, 250, 12], [40, 1220, 8], [1466, 1260, 9]].map(([x, y, s]) => path(sparkle(x, y, s), { fill: '#bfffd9', fillOpacity: 0.8 })),
  ].join('\n');
  return { defs, body: out.replace(/ d="[^"]*"/g, (m) => m.replace(/(\.\d)\d+/g, '$1')) };
}

module.exports = {
  W, H, hole, radius, draw,
  meta: {
    name: 'Gothic Reliquary', theme: 'gothic-horror', rarity: 'epic', translucent: false, collection: 'legends-dread', license: 'CC-BY-4.0',
    desc: 'A candlelit shrine of black wood and tarnished silver, where a ghost-green rose window glows and a tiny skull keeps your game company.',
    tags: ['gothic', 'horror', 'spooky', 'candles', 'skull', 'silver', 'halloween'],
  },
};
