'use strict';
// Starlight Pinball: a cosmic pinball table seen from the player's end. The upright backbox holds the
// screen inside a chrome bezel with a magenta neon tube, star-bulb pilasters, a sunburst topper and
// speaker grilles; below it the playfield runs away in perspective (flippers, slingshots, pop bumpers,
// a clear magenta ramp, star rollover lanes, a spinner and a silver ball in flight), framed by side
// rails, the lockdown bar, a coin door with two slots, the launch plunger and chunky chrome legs.
const L = require('../lib');
const { rr, poly, path, g, lg, rg, circle, ellipse, star, sparkle, tf, rng, lip, glowStroke, smooth, n, P } = L;

const W = 1600, H = 1800, hole = { x: 416, y: 196, w: 768, h: 432 }, radius = 14;
const CX = W / 2;
const INK = '#0a0b2a';
const GOLD = '#ffd166', MAG = '#ff4fd8', NAVY = '#141a52';

// ---- playfield perspective ---------------------------------------------------------------------
// Cabinet top (rails included): back edge y 800, x 300..1300; front edge y 1410, x 110..1490.
const PF = { yb: 800, yf: 1410, wb: 1000, wf: 1380 };
const S0 = PF.wb / PF.wf;
const sc = (v) => 1 / (1 / S0 - (1 / S0 - 1) * v); // object scale at depth v (back 0 .. front 1)
const yAt = (v) => PF.yb + (PF.yf - PF.yb) * (sc(v) - S0) / (1 - S0);
const pt = (u, v) => [CX + (u - 0.5) * PF.wf * sc(v), yAt(v)];
const RAIL = 0.045;
const IN = (a, b) => pt(RAIL + a * (1 - 2 * RAIL), b); // inner playfield coordinates
const SQ = 0.5; // vertical squash of things lying flat on the playfield
const mpoly = (list) => poly(list.map(([a, b]) => IN(a, b)));
const mline = (list) => smooth(list.map(([a, b]) => IN(a, b)));

// ---- small parts -------------------------------------------------------------------------------
function shadowed(d, fill, extra = {}, off = [5, 8], alpha = 0.45) {
  return path(d, { fill: INK, fillOpacity: alpha, transform: `translate(${off[0]} ${off[1]})` }) + path(d, { fill, ...extra });
}

/** Star bulb with a glow halo; cls animates the lit part. */
function bulb(x, y, r, col, cls) {
  return path(circle(x + 2, y + 3, r * 1.05), { fill: INK, fillOpacity: 0.5 })
    + path(circle(x, y, r * 1.05), { fill: 'url(#socket)', stroke: INK, strokeWidth: 2.5 })
    + g({ class: cls },
      path(circle(x, y, r * 2.1), { fill: `url(#halo${col})` }),
      path(star(x, y, r * 0.9, r * 0.42), { fill: col === 'M' ? '#ff9be8' : '#ffe9a3', stroke: col === 'M' ? '#b3127f' : '#a8701c', strokeWidth: 1.5, strokeLinejoin: 'round' }),
      path(circle(x - r * 0.18, y - r * 0.2, r * 0.18), { fill: '#fff' }));
}

/** Round speaker grille: chrome ring, dark mesh, holes in a star rosette. */
function grille(cx, cy, r) {
  const holes = [];
  for (let k = 1; k <= 4; k++) {
    const cnt = k * 6, rad = (r * 0.78 * k) / 4;
    for (let i = 0; i < cnt; i++) { const a = (i / cnt) * Math.PI * 2 + k * 0.3; holes.push(circle(cx + rad * Math.cos(a), cy + rad * Math.sin(a), 2.6)); }
  }
  return path(circle(cx + 3, cy + 5, r + 9), { fill: INK, fillOpacity: 0.5 })
    + path(circle(cx, cy, r + 9), { fill: 'url(#chrome)', stroke: INK, strokeWidth: 3 })
    + path(circle(cx, cy, r), { fill: 'url(#mesh)', stroke: INK, strokeWidth: 2 })
    + path(holes.join(''), { fill: '#000', fillOpacity: 0.65 })
    + path(star(cx, cy, r * 0.26, r * 0.11), { fill: 'url(#goldR)', stroke: INK, strokeWidth: 1.5 })
    + path(`M${n(cx - r * 0.7)} ${n(cy - r * 0.35)}A${r * 0.78} ${r * 0.78} 0 0 1 ${n(cx - r * 0.1)} ${n(cy - r * 0.78)}`, { fill: 'none', stroke: '#fff', strokeOpacity: 0.35, strokeWidth: 3, strokeLinecap: 'round' });
}

/** Sunburst topper rays + arch crest + medallion. */
function topper() {
  let rays = '';
  const cx = CX, cy = 132, cnt = 17;
  for (let i = 0; i < cnt; i++) {
    const a0 = Math.PI * (1.07 + (0.86 * i) / cnt), a1 = Math.PI * (1.07 + (0.86 * (i + 0.7)) / cnt), am = (a0 + a1) / 2, k = i % 2 ? 0.8 : 1;
    rays += poly([[cx, cy], [cx + 250 * k * Math.cos(a0), cy + 96 * k * Math.sin(a0)], [cx + 330 * k * Math.cos(am), cy + 128 * k * Math.sin(am)],
      [cx + 250 * k * Math.cos(a1), cy + 96 * k * Math.sin(a1)]]);
  }
  const arch = `M520 128C600 128 650 40 800 38C950 40 1000 128 1080 128Z`;
  const orbit = 'M610 118C660 70 720 54 800 52C880 54 940 70 990 118';
  const stars = [[560, 116, 9], [640, 86, 7], [960, 86, 7], [1040, 116, 9]].map(([x, y, r]) => path(star(x, y, r, r * 0.45), { fill: GOLD, stroke: INK, strokeWidth: 1.5 })).join('');
  return g({},
    path(rays, { fill: 'url(#rays)', stroke: '#a8701c', strokeWidth: 1.5, strokeLinejoin: 'round' }),
    shadowed(arch, 'url(#bbBody)', { stroke: INK, strokeWidth: 5 }),
    path('M546 122C618 120 664 54 800 50C936 54 982 120 1054 122', { fill: 'none', stroke: 'url(#gold)', strokeWidth: 5, strokeLinecap: 'round' }),
    path(orbit, { fill: 'none', stroke: MAG, strokeOpacity: 0.7, strokeWidth: 3, strokeDasharray: '2 10', strokeLinecap: 'round' }),
    stars,
    // crescent moon + ringed planet riding on the crest
    path('M590 62A26 26 0 1 0 622 96A20 20 0 1 1 590 62Z', { fill: 'url(#goldR)', stroke: INK, strokeWidth: 3 }),
    path(circle(1000, 76, 18), { fill: 'url(#capM)', stroke: INK, strokeWidth: 3 }),
    path(ellipse(1000, 78, 34, 9), { fill: 'none', stroke: INK, strokeWidth: 7, transform: 'rotate(-18 1000 78)' }),
    path(ellipse(1000, 78, 34, 9), { fill: 'none', stroke: GOLD, strokeWidth: 3.5, transform: 'rotate(-18 1000 78)' }),
    path(`M982 72A18 18 0 0 1 1018 72`, { fill: 'url(#capM)', stroke: INK, strokeWidth: 3 }),
    // medallion
    path(circle(cx + 4, 92, 62), { fill: INK, fillOpacity: 0.5 }),
    path(circle(cx, 86, 62), { fill: 'url(#goldR)', stroke: INK, strokeWidth: 5 }),
    path(circle(cx, 86, 50), { fill: 'url(#medal)', stroke: '#7a4a0c', strokeWidth: 3 }),
    g({ class: 'sp-pulse' }, path(circle(cx, 86, 46), { fill: 'url(#haloM)' })),
    path(star(cx, 88, 36, 15), { fill: 'url(#capM)', stroke: INK, strokeWidth: 3, strokeLinejoin: 'round' }),
    path(star(cx, 88, 16, 7), { fill: '#fff', fillOpacity: 0.9 }),
    path('M760 64A46 46 0 0 1 806 40', { fill: 'none', stroke: '#fff', strokeOpacity: 0.8, strokeWidth: 4, strokeLinecap: 'round' }),
    // corner finials
    ...[290, 1310].map((x) => path(circle(x, 104, 20), { fill: 'url(#chromeR)', stroke: INK, strokeWidth: 3 })
      + path(star(x, 74, 22, 9), { fill: 'url(#goldR)', stroke: INK, strokeWidth: 3, strokeLinejoin: 'round' })
      + path(circle(x - 6, 98, 5), { fill: '#fff' })));
}

function backbox() {
  const BB = rr(270, 110, 1060, 690, [36, 36, 6, 6]);
  const panel = rr(362, 140, 876, 546, 26);
  const rnd = rng(7), dots = [], twinkles = [];
  for (let i = 0; i < 120; i++) {
    const x = 366 + rnd() * 868, y = 144 + rnd() * 538;
    if (x > hole.x - 50 && x < hole.x + hole.w + 50 && y > hole.y - 50 && y < hole.y + hole.h + 50) continue;
    if (i % 9 === 0) twinkles.push(sparkle(x, y, 6 + rnd() * 5)); else dots.push(circle(x, y, 1 + rnd() * 1.8));
  }
  const bulbs = [];
  for (let i = 0; i < 7; i++) {
    const y = 196 + i * 70, cls = `sp-c${i % 2}`;
    bulbs.push(bulb(317, y, 16, i % 2 ? 'M' : 'G', cls), bulb(1283, y, 16, i % 2 ? 'G' : 'M', cls));
  }
  const H0 = rr(hole.x, hole.y, hole.w, hole.h, radius);
  const neon = rr(hole.x - 48, hole.y - 48, hole.w + 96, hole.h + 96, 44);
  // gold filigree swirls in the backglass corners (outside the bezel)
  const swirl = (sx, sy) => {
    const x0 = sx > 0 ? 376 : 1224, y0 = sy > 0 ? 154 : 672;
    const d = `M${x0} ${y0 + sy * 70}C${x0} ${y0 + sy * 20} ${x0 + sx * 10} ${y0} ${x0 + sx * 60} ${y0}`;
    return path(d, { fill: 'none', stroke: GOLD, strokeOpacity: 0.85, strokeWidth: 3, strokeLinecap: 'round' })
      + path(circle(x0 + sx * 60, y0, 4), { fill: GOLD })
      + path(circle(x0, y0 + sy * 70, 4), { fill: GOLD })
      + path(sparkle(x0 + sx * 16, y0 + sy * 16, 11), { fill: '#fff6d6' });
  };
  return g({},
    path(rr(282, 124, 1060, 690, [36, 36, 6, 6]), { fill: INK, fillOpacity: 0.45 }),
    path(BB, { fill: 'url(#bbBody)', stroke: INK, strokeWidth: 6 }),
    path(rr(281, 121, 1038, 668, [28, 28, 4, 4]), { fill: 'none', stroke: 'url(#gold)', strokeWidth: 6 }),
    path('M300 128H1300', { stroke: '#fff', strokeOpacity: 0.35, strokeWidth: 4, strokeLinecap: 'round' }),
    // pilasters
    ...[286, 1252].map((x) => path(rr(x, 150, 62, 530, 22), { fill: 'url(#pilaster)', stroke: INK, strokeWidth: 3 })
      + path(`M${x + 10} 170V660`, { stroke: '#fff', strokeOpacity: 0.18, strokeWidth: 3, strokeLinecap: 'round' })),
    bulbs.join(''),
    // backglass art
    path(panel, { fill: 'url(#glassArt)', stroke: 'url(#gold)', strokeWidth: 5 }),
    g({ clipPath: 'url(#bgClip)' },
      path(ellipse(420, 640, 260, 170), { fill: 'url(#nebM)' }),
      path(ellipse(1190, 190, 260, 160), { fill: 'url(#nebV)' }),
      path(dots.join(''), { fill: '#fff', fillOpacity: 0.75 }),
      path(twinkles.join(''), { fill: '#ffe9a3' }),
      swirl(1, 1), swirl(-1, 1), swirl(1, -1), swirl(-1, -1)),
    // neon tube + chrome bezel
    glowStroke(neon, MAG, 5, [[7, 0.07], [4, 0.14], [2.2, 0.3], [1, 1]]),
    path(neon, { fill: 'none', stroke: '#ffe1f8', strokeWidth: 2 }),
    path(rr(hole.x - 34, hole.y - 30, hole.w + 68, hole.h + 68, 30), { fill: INK, fillOpacity: 0.5 }),
    path(rr(hole.x - 34, hole.y - 34, hole.w + 68, hole.h + 68, 30), { fill: 'url(#chromeD)', stroke: INK, strokeWidth: 4 }),
    path(rr(hole.x - 24, hole.y - 24, hole.w + 48, hole.h + 48, 24), { fill: 'none', stroke: '#fff', strokeOpacity: 0.55, strokeWidth: 2 }),
    path(rr(hole.x - 16, hole.y - 16, hole.w + 32, hole.h + 32, 20), { fill: '#06071a', stroke: '#2b3070', strokeWidth: 2 }),
    lip(H0, '#000', [[6, 0.3], [2.5, 0.6]]),
    path(`M${hole.x - 26} ${hole.y + 90}V${hole.y + 2}Q${hole.x - 26} ${hole.y - 26} ${hole.x + 2} ${hole.y - 26}H${hole.x + 160}`, { fill: 'none', stroke: '#fff', strokeOpacity: 0.9, strokeWidth: 4, strokeLinecap: 'round' }),
    // bezel star rivets
    ...[[hole.x - 25, hole.y - 25], [hole.x + hole.w + 25, hole.y - 25], [hole.x - 25, hole.y + hole.h + 25], [hole.x + hole.w + 25, hole.y + hole.h + 25]]
      .map(([x, y]) => path(star(x, y, 9, 4), { fill: 'url(#goldR)', stroke: INK, strokeWidth: 1.5 })),
    // speaker panel
    path(rr(300, 696, 1000, 92, 16), { fill: 'url(#speaker)', stroke: INK, strokeWidth: 4 }),
    path('M316 700H1284', { stroke: '#fff', strokeOpacity: 0.2, strokeWidth: 2 }),
    grille(456, 742, 34), grille(1144, 742, 34),
    path(rr(620, 712, 360, 60, 30), { fill: 'url(#gold)', stroke: INK, strokeWidth: 3 }),
    path(rr(632, 722, 336, 40, 20), { fill: '#0b0e33', stroke: '#7a4a0c', strokeWidth: 2 }),
    // shooting star emblem in the plaque
    path('M690 750L800 734L700 744Z', { fill: GOLD, fillOpacity: 0.55 }),
    path('M676 742C720 744 760 738 790 742', { fill: 'none', stroke: MAG, strokeOpacity: 0.8, strokeWidth: 3, strokeLinecap: 'round' }),
    path(star(800, 742, 16, 7), { fill: 'url(#goldR)', stroke: INK, strokeWidth: 2 }),
    ...[0, 1, 2, 3, 4].map((i) => g({ class: `sp-l${i % 4}` }, path(circle(846 + i * 22, 742, 6), { fill: i % 2 ? MAG : GOLD, stroke: INK, strokeWidth: 1.5 }))),
    // credit dots + accent studs
    ...[536, 580, 1020, 1064].map((x) => path(circle(x, 742, 5), { fill: 'url(#chromeR)', stroke: INK, strokeWidth: 1.5 })));
}

// ---- playfield ---------------------------------------------------------------------------------
/** Pop bumper standing on the playfield at (a, b). */
function bumper(a, b, cap, cls) {
  const [x, y] = IN(a, b), s = sc(b), R = 46 * s, h = 32 * s;
  const body = `M${n(x - R)} ${n(y - h)}V${n(y)}A${n(R)} ${n(R * SQ)} 0 0 0 ${n(x + R)} ${n(y)}V${n(y - h)}Z`;
  return path(ellipse(x + 10 * s, y + 6 * s, R * 1.45, R * 1.45 * SQ), { fill: INK, fillOpacity: 0.5 })
    + path(ellipse(x, y, R * 1.35, R * 1.35 * SQ), { fill: 'url(#skirt)', stroke: INK, strokeWidth: 2.5 })
    + path(body, { fill: 'url(#bumperBody)', stroke: INK, strokeWidth: 2.5 })
    + path(ellipse(x, y - h, R * 1.12, R * 1.12 * SQ), { fill: '#fff', stroke: INK, strokeWidth: 2.5 })
    + g({ class: cls }, path(ellipse(x, y - h - 4, R * 2.3, R * 2.3 * SQ * 1.1), { fill: `url(#halo${cap === 'capM' ? 'M' : 'G'})` }))
    + path(ellipse(x, y - h - 4 * s, R, R * SQ), { fill: `url(#${cap})`, stroke: INK, strokeWidth: 2.5 })
    + g({ transform: `translate(${n(x)} ${n(y - h - 4 * s)}) scale(1 ${SQ})` }, path(star(0, 0, R * 0.62, R * 0.26), { fill: '#fff', fillOpacity: 0.92 }))
    + path(ellipse(x - R * 0.42, y - h - R * 0.32 * SQ - 4 * s, R * 0.26, R * 0.1), { fill: '#fff', fillOpacity: 0.8 });
}

/** Standing post with a rubber ring (lane guides). */
function post(a, b, hgt = 22) {
  const [x, y] = IN(a, b), s = sc(b), r = 7 * s, h = hgt * s;
  return path(ellipse(x + 4 * s, y + 3 * s, r * 1.6, r * 0.8), { fill: INK, fillOpacity: 0.5 })
    + path(`M${n(x - r)} ${n(y - h)}V${n(y)}A${n(r)} ${n(r * 0.5)} 0 0 0 ${n(x + r)} ${n(y)}V${n(y - h)}Z`, { fill: 'url(#chromeH)', stroke: INK, strokeWidth: 1.5 })
    + path(ellipse(x, y - h * 0.45, r * 1.5, r * 0.75), { fill: '#fff', stroke: INK, strokeWidth: 1.2 })
    + path(ellipse(x, y - h, r, r * 0.5), { fill: '#e8ecff', stroke: INK, strokeWidth: 1.2 });
}

/** Flat star insert on the playfield. */
function insertStar(a, b, R, lit, cls) {
  const [x, y] = IN(a, b), s = sc(b);
  return g({ transform: `translate(${n(x)} ${n(y)}) scale(${n(s)} ${n(s * SQ)})` },
    path(star(0, 0, R + 6, (R + 6) * 0.45), { fill: '#05061a', fillOpacity: 0.7 }),
    g({ class: cls }, path(circle(0, 0, R * 2.2), { fill: `url(#halo${lit})` }),
      path(star(0, 0, R, R * 0.45), { fill: lit === 'M' ? '#ff8fe6' : '#ffe08a', stroke: '#fff', strokeWidth: 2, strokeLinejoin: 'round' })));
}

/** Chevron arrow insert pointing "up" the playfield along direction rot (degrees). */
function arrow(a, b, rot, col, cls) {
  const [x, y] = IN(a, b), s = sc(b);
  const d = 'M0 -22L18 4L8 4L0 -8L-8 4L-18 4Z';
  return g({ transform: `translate(${n(x)} ${n(y)}) scale(${n(s)} ${n(s * SQ)}) rotate(${rot})` },
    path(d, { fill: '#05061a', fillOpacity: 0.35, transform: 'scale(1.25)' }),
    g({ class: cls }, path(d, { fill: col, stroke: '#fff', strokeWidth: 1.5, strokeLinejoin: 'round' }),
      path(d, { fill: col, transform: 'translate(0 18)', fillOpacity: 0.55 })));
}

/** Tapered flipper bat from pivot (x1,y1) to tip (x2,y2). */
function flipper(x1, y1, x2, y2, r1, r2) {
  const dx = x2 - x1, dy = y2 - y1, L0 = Math.hypot(dx, dy), nx = -dy / L0, ny = dx / L0;
  const d = `M${P(x1 + nx * r1, y1 + ny * r1)}L${P(x2 + nx * r2, y2 + ny * r2)}A${P(r2, r2)} 0 0 0 ${P(x2 - nx * r2, y2 - ny * r2)}L${P(x1 - nx * r1, y1 - ny * r1)}A${P(r1, r1)} 0 0 0 ${P(x1 + nx * r1, y1 + ny * r1)}Z`;
  return path(d, { fill: INK, fillOpacity: 0.5, transform: 'translate(6 7)' })
    + path(d, { fill: '#fff', stroke: MAG, strokeWidth: 6, strokeLinejoin: 'round' })
    + path(d, { fill: 'none', stroke: INK, strokeWidth: 2 })
    + path(`M${P(x1 + nx * r1 * 0.45, y1 + ny * r1 * 0.45 - 2)}L${P(x2 + nx * r2 * 0.3, y2 + ny * r2 * 0.3 - 2)}`, { stroke: '#dfe4ff', strokeWidth: 3, strokeLinecap: 'round' })
    + path(circle(x1, y1, r1 * 0.48), { fill: 'url(#goldR)', stroke: INK, strokeWidth: 2 });
}

function slingshot(side) {
  const m = (a) => (side < 0 ? a : 1 - a);
  const A = [m(0.155), 0.64], B = [m(0.155), 0.83], C = [m(0.305), 0.885];
  const tri = mpoly([A, B, C]);
  const [ax, ay] = IN(...A), [bx, by] = IN(...B), [cx, cy] = IN(...C);
  const mx = (ax + bx + cx) / 3, my = (ay + by + cy) / 3;
  return path(tri, { fill: INK, fillOpacity: 0.5, transform: 'translate(7 7)' })
    + path(tri, { fill: 'url(#sling)', stroke: '#fff', strokeWidth: 9, strokeLinejoin: 'round' })
    + path(tri, { fill: 'none', stroke: INK, strokeWidth: 2, strokeLinejoin: 'round' })
    + path(`M${P(ax + (cx - ax) * 0.18, ay + (cy - ay) * 0.18)}L${P(cx - (cx - ax) * 0.12, cy - (cy - ay) * 0.12)}`, { stroke: GOLD, strokeWidth: 5, strokeLinecap: 'round' })
    + g({ class: side < 0 ? 'sp-b0' : 'sp-b1' }, path(star(mx - side * 6, my + 4, 15, 6.5), { fill: '#fff', stroke: '#ffe08a', strokeWidth: 2 }))
    + [A, B, C].map(([a, b]) => post(a, b, 16)).join('');
}

/** The clear ramp: an elevated ribbon from the left entrance curling to the back-left orbit. */
function ramp() {
  const ctrl = [[0.29, 0.57], [0.24, 0.2], [0.07, 0.16]];
  const bez = (t) => [0, 1].map((k) => (1 - t) ** 2 * ctrl[0][k] + 2 * (1 - t) * t * ctrl[1][k] + t * t * ctrl[2][k]);
  const N = 16, left = [], right = [], shL = [], shR = [], posts = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N, [a, b] = bez(t), [a2, b2] = bez(Math.min(1, t + 0.01)), [a1, b1] = bez(Math.max(0, t - 0.01));
    let tx = a2 - a1, ty = (b2 - b1) * 2.1; const l = Math.hypot(tx, ty); tx /= l; ty /= l;
    const hw = 0.034, na = -ty * hw, nb = (tx * hw) / 2.1;
    const e = Math.sin(Math.min(1, t * 1.4) * Math.PI / 2) * 56 * sc(b);
    const pL = IN(a + na, b + nb), pR = IN(a - na, b - nb);
    left.push([pL[0], pL[1] - e]); right.push([pR[0], pR[1] - e]);
    shL.push([pL[0] + 14, pL[1] + 6]); shR.push([pR[0] + 14, pR[1] + 6]);
    if (i === 6 || i === 12) posts.push([pL, e], [pR, e]);
  }
  const ribbon = poly([...left, ...right.reverse()]);
  right.reverse();
  return path(poly([...shL, ...shR.reverse()]), { fill: INK, fillOpacity: 0.35 })
    + posts.map(([[x, y], e]) => path(`M${n(x)} ${n(y)}V${n(y - e)}`, { stroke: '#d6dbf2', strokeWidth: 5 }) + path(ellipse(x, y, 6, 3), { fill: INK, fillOpacity: 0.6 })).join('')
    + path(ribbon, { fill: 'url(#rampG)', stroke: INK, strokeWidth: 2.5, strokeLinejoin: 'round' })
    + path(smooth(left), { fill: 'none', stroke: 'url(#chromeH)', strokeWidth: 6, strokeLinecap: 'round' })
    + path(smooth(right), { fill: 'none', stroke: 'url(#chromeH)', strokeWidth: 6, strokeLinecap: 'round' })
    + path(smooth(left), { fill: 'none', stroke: '#fff', strokeOpacity: 0.8, strokeWidth: 2, strokeLinecap: 'round', transform: 'translate(-1 -2)' })
    + path(smooth(left.map(([x, y], i) => [x + (right[i][0] - x) * 0.35, y + (right[i][1] - y) * 0.35])), { fill: 'none', stroke: '#fff', strokeOpacity: 0.4, strokeWidth: 3, strokeLinecap: 'round' });
}

function spinner() {
  const [x1, y1] = IN(0.86, 0.34), [x2, y2] = IN(0.95, 0.34), s = sc(0.34), h = 46 * s;
  const mx = (x1 + x2) / 2, w = (x2 - x1) / 2 - 6;
  return path(ellipse(mx + 8, y1 + 4, w + 6, 6), { fill: INK, fillOpacity: 0.45 })
    + [x1, x2].map((x) => path(`M${n(x)} ${n(y1)}V${n(y1 - h)}`, { stroke: INK, strokeWidth: 7, strokeLinecap: 'round' }) + path(`M${n(x)} ${n(y1)}V${n(y1 - h)}`, { stroke: '#d6dbf2', strokeWidth: 4.5, strokeLinecap: 'round' })).join('')
    + path(`M${n(x1)} ${n(y1 - h)}H${n(x2)}`, { stroke: INK, strokeWidth: 6, strokeLinecap: 'round' })
    + path(`M${n(x1)} ${n(y1 - h)}H${n(x2)}`, { stroke: '#e8ecff', strokeWidth: 3, strokeLinecap: 'round' })
    + path(`M${n(mx - w)} ${n(y1 - h + 2)}H${n(mx + w)}L${n(mx + w - 4)} ${n(y1 - h + 30 * s)}H${n(mx - w + 4)}Z`, { fill: 'url(#chrome)', stroke: INK, strokeWidth: 2 })
    + path(star(mx, y1 - h + 15 * s, 8 * s, 3.5 * s), { fill: MAG, stroke: INK, strokeWidth: 1 });
}

function ball() {
  const [x, y] = IN(0.66, 0.5), s = sc(0.5), r = 30 * s, lift = 58 * s, by = y - lift;
  const [tx, ty] = IN(0.6, 0.74), dx = x - tx, dy = by - ty, l = Math.hypot(dx, dy), nx = -dy / l, ny = dx / l;
  const tail = `M${P(tx, ty)}L${P(x + nx * r * 0.95, by + ny * r * 0.95)}A${P(r, r)} 0 0 0 ${P(x - nx * r * 0.95, by - ny * r * 0.95)}Z`;
  const tail2 = `M${P(tx + dx * 0.3, ty + dy * 0.3)}L${P(x + nx * r * 0.5, by + ny * r * 0.5)}L${P(x - nx * r * 0.5, by - ny * r * 0.5)}Z`;
  return path(ellipse(x + 10, y + 4, r * 1.1, r * 0.5), { fill: INK, fillOpacity: 0.55 })
    + path(tail, { fill: 'url(#comet)' }) + path(tail2, { fill: 'url(#comet)' })
    + path(sparkle(x - 40, by + 56, 10), { fill: '#fff' }) + path(sparkle(x + 34, by + 40, 7), { fill: '#ffe9a3' }) + path(sparkle(x - 6, by + 110, 6), { fill: '#ff9be8' })
    + path(circle(x, by, r), { fill: 'url(#ballG)', stroke: INK, strokeWidth: 2.5 })
    + path(ellipse(x - r * 0.32, by - r * 0.36, r * 0.34, r * 0.22), { fill: '#fff', transform: `rotate(-30 ${n(x - r * 0.32)} ${n(by - r * 0.36)})` })
    + path(`M${n(x - r * 0.75)} ${n(by + r * 0.3)}Q${n(x)} ${n(by + r * 0.95)} ${n(x + r * 0.75)} ${n(by + r * 0.3)}`, { fill: 'none', stroke: MAG, strokeOpacity: 0.55, strokeWidth: 3, strokeLinecap: 'round' });
}

/** Bank of three standing drop targets on the upper right. */
function dropTargets() {
  return [[0.74, 0.17], [0.785, 0.205], [0.83, 0.24]].map(([a, b], i) => {
    const [x, y] = IN(a, b), s = sc(b), w = 20 * s, h = 34 * s;
    const face = `M${n(x - w)} ${n(y - h)}H${n(x + w)}V${n(y)}H${n(x - w)}Z`;
    return path(ellipse(x + 8 * s, y + 3, w * 1.4, 6 * s), { fill: INK, fillOpacity: 0.5 })
      + path(face, { fill: i === 1 ? 'url(#capG)' : 'url(#capM)', stroke: INK, strokeWidth: 2.5, transform: `rotate(-6 ${n(x)} ${n(y)})` })
      + path(star(x, y - h * 0.5, 8 * s, 3.5 * s), { fill: '#fff', transform: `rotate(-6 ${n(x)} ${n(y)})` });
  }).join('');
}

function planetInsert() {
  const [x, y] = IN(0.5, 0.63), s = sc(0.63);
  return g({ transform: `translate(${n(x)} ${n(y)}) scale(${n(s)} ${n(s * SQ)})` },
    path(circle(0, 0, 92), { fill: 'url(#haloV)' }),
    path(ellipse(0, 0, 120, 26), { fill: 'none', stroke: '#05061a', strokeOpacity: 0.6, strokeWidth: 16, transform: 'rotate(-14)' }),
    path(circle(0, 0, 52), { fill: 'url(#planet)', stroke: '#05061a', strokeWidth: 4 }),
    path('M-46 -12C-20 -4 20 -6 48 -20M-50 12C-16 20 22 18 50 6', { fill: 'none', stroke: '#fff', strokeOpacity: 0.25, strokeWidth: 6 }),
    path('M-118 6A120 26 0 0 0 118 -6', { fill: 'none', stroke: GOLD, strokeWidth: 8, transform: 'rotate(-14)' }),
    path('M-118 6A120 26 0 0 1 -50 -18', { fill: 'none', stroke: GOLD, strokeOpacity: 0.85, strokeWidth: 8, transform: 'rotate(-14)' }),
    path('M50 -18A120 26 0 0 1 118 -6', { fill: 'none', stroke: GOLD, strokeOpacity: 0.85, strokeWidth: 8, transform: 'rotate(-14)' }));
}

function playfield() {
  const glass = mpoly([[0, 0], [1, 0], [1, 1], [0, 1]]);
  const rnd = rng(31), dots = [];
  for (let i = 0; i < 90; i++) { const [x, y] = IN(rnd(), rnd() * 0.95); dots.push(circle(x, y, 0.8 + rnd() * 1.6)); }
  const constel = [[[0.12, 0.42], [0.2, 0.36], [0.3, 0.45], [0.36, 0.55]], [[0.7, 0.62], [0.78, 0.55], [0.86, 0.6], [0.9, 0.5]]];
  const conLines = constel.map((c) => mline(c)).join('');
  const conDots = constel.flat().map(([a, b]) => { const [x, y] = IN(a, b); return circle(x, y, 4); }).join('');
  // back arch (orbit) + corner fill behind it
  const archPts = [[0.0, 0.62], [0.0, 0.2], [0.07, 0.03], [0.5, -0.01], [0.93, 0.03], [1.0, 0.2]];
  const archD = mline(archPts);
  const corners = `${mline(archPts)}L${P(...IN(1, 0))}L${P(...IN(0, 0))}L${P(...IN(0, 0.62))}Z`;
  const shooter = mline([[0.93, 1], [0.93, 0.3], [0.9, 0.16]]);
  const inlL = mline([[0.075, 0.6], [0.075, 0.84], [0.335, 0.925]]), inlR = mline([[0.925, 0.6], [0.925, 0.84], [0.665, 0.925]]);
  const [plx, ply] = IN(0.345, 0.915), [ptlx, ptly] = IN(0.455, 0.962), [prx, pry] = IN(0.655, 0.915), [ptrx, ptry] = IN(0.545, 0.962);
  const lanes = [0.37, 0.47, 0.57, 0.67].map((a, i) => insertStar(a, 0.12, 16, i % 2 ? 'M' : 'G', `sp-l${i}`)).join('');
  const lanePosts = [0.32, 0.42, 0.52, 0.62, 0.72].map((a) => post(a, 0.075, 24) + post(a, 0.17, 24)).join('');
  const laneGuides = [0.32, 0.42, 0.52, 0.62, 0.72].map((a) => mline([[a, 0.075], [a, 0.17]])).join('');
  const apron = mpoly([[0.08, 0.975], [0.4, 0.975], [0.44, 1], [0.56, 1], [0.6, 0.975], [0.92, 0.975], [0.92, 1], [0.08, 1]]);
  return g({},
    path(glass, { fill: 'url(#pfBase)' }),
    g({ clipPath: 'url(#pfClip)' },
      path(ellipse(...IN(0.25, 0.3), 330, 150), { fill: 'url(#nebM)' }),
      path(ellipse(...IN(0.8, 0.75), 320, 150), { fill: 'url(#nebV)' }),
      path(dots.join(''), { fill: '#fff', fillOpacity: 0.55 }),
      path(conLines, { fill: 'none', stroke: GOLD, strokeOpacity: 0.55, strokeWidth: 2, strokeDasharray: '6 6' }),
      path(conDots, { fill: '#ffe9a3' }),
      path(corners, { fill: 'url(#bbBody)' }),
      path(archD, { fill: 'none', stroke: INK, strokeWidth: 12, strokeLinecap: 'round' }),
      path(archD, { fill: 'none', stroke: 'url(#chromeH)', strokeWidth: 7, strokeLinecap: 'round' }),
      path(archD, { fill: 'none', stroke: MAG, strokeOpacity: 0.6, strokeWidth: 2, transform: 'translate(0 7)' }),
      planetInsert(),
      // lane area
      path(laneGuides, { fill: 'none', stroke: INK, strokeWidth: 6, strokeLinecap: 'round' }),
      path(laneGuides, { fill: 'none', stroke: '#e8ecff', strokeWidth: 3, strokeLinecap: 'round' }),
      lanes,
      // arrows toward the ramp / orbit / spinner
      arrow(0.33, 0.68, -18, MAG, 'sp-l1'), arrow(0.36, 0.74, -18, MAG, 'sp-l2'),
      arrow(0.7, 0.66, 18, GOLD, 'sp-l3'), arrow(0.73, 0.73, 18, GOLD, 'sp-l0'),
      arrow(0.88, 0.5, 0, '#c18bff', 'sp-l2'),
      insertStar(0.5, 0.86, 22, 'G', 'sp-pulse'),
      insertStar(0.5, 0.78, 10, 'M', 'sp-l1'),
      // shooter lane + inlanes
      path(shooter, { fill: 'none', stroke: INK, strokeWidth: 9, strokeLinecap: 'round' }),
      path(shooter, { fill: 'none', stroke: 'url(#chromeH)', strokeWidth: 5, strokeLinecap: 'round' }),
      path(inlL + inlR, { fill: 'none', stroke: INK, strokeWidth: 9, strokeLinecap: 'round', strokeLinejoin: 'round' }),
      path(inlL + inlR, { fill: 'none', stroke: 'url(#chromeH)', strokeWidth: 5, strokeLinecap: 'round', strokeLinejoin: 'round' }),
      lanePosts,
      slingshot(-1), slingshot(1),
      bumper(0.4, 0.3, 'capM', 'sp-b0'), bumper(0.6, 0.3, 'capM', 'sp-b1'), bumper(0.5, 0.42, 'capG', 'sp-b2'),
      ramp(),
      spinner(),
      dropTargets(),
      path(apron, { fill: 'url(#apronG)', stroke: INK, strokeWidth: 3 }),
      ...[0.18, 0.26, 0.74, 0.82].map((a) => { const [x, y] = IN(a, 0.988); return path(star(x, y, 7, 3), { fill: MAG }); }),
      flipper(plx, ply, ptlx, ptly, 15, 8), flipper(prx, pry, ptrx, ptry, 15, 8),
      ball(),
      // glass: shadow from the backbox + sheen
      path(glass, { fill: 'url(#bbShade)' }),
      path(glass, { fill: 'url(#glassG)' }),
      path(mpoly([[0.06, 0.0], [0.16, 0.0], [-0.1, 0.9], [-0.2, 0.9]]), { fill: '#fff', fillOpacity: 0.07 }),
      path(mpoly([[0.22, 0.0], [0.26, 0.0], [0.02, 0.8], [-0.02, 0.8]]), { fill: '#fff', fillOpacity: 0.06 })),
    path(glass, { fill: 'none', stroke: INK, strokeWidth: 3 }));
}

function cabinet() {
  const top = poly([pt(0, 0), pt(1, 0), pt(1, 1), pt(0, 1)]);
  const railL = poly([pt(0, 0), pt(RAIL, 0), pt(RAIL, 1), pt(0, 1)]), railR = poly([pt(1 - RAIL, 0), pt(1, 0), pt(1, 1), pt(1 - RAIL, 1)]);
  const face = 'M110 1430H1490V1640Q1490 1652 1478 1652H122Q110 1652 110 1640Z';
  const faceStars = [];
  const rnd = rng(5);
  for (let i = 0; i < 26; i++) {
    const x = 140 + rnd() * 1320, y = 1462 + rnd() * 168;
    if (x > 610 && x < 990) continue;
    if (x > 1240 && x < 1350) continue;
    faceStars.push(i % 3 ? circle(x, y, 1.6 + rnd() * 1.6) : sparkle(x, y, 7 + rnd() * 5));
  }
  const leg = (x, flip) => {
    const d = `M${x - 30} 1652H${x + 30}L${x + 18 + 4 * flip} 1758H${x - 18 + 4 * flip}Z`;
    return path(d, { fill: INK, fillOpacity: 0.5, transform: 'translate(8 2)' })
      + path(`M${x - 30} 1652H${x + 30}L${x + 18 + 4 * flip} 1758H${x - 18 + 4 * flip}Z`, { fill: 'url(#chromeH)', stroke: INK, strokeWidth: 4, strokeLinejoin: 'round' })
      + path(`M${x - 14 + 4 * flip} 1662L${x - 8 + 4 * flip} 1748`, { stroke: '#fff', strokeOpacity: 0.85, strokeWidth: 4, strokeLinecap: 'round' })
      + path(rr(x - 32 + 4 * flip, 1754, 64, 14, 6), { fill: 'url(#chrome)', stroke: INK, strokeWidth: 3 })
      + path(rr(x - 22 + 4 * flip, 1766, 44, 14, 4), { fill: '#272b52', stroke: INK, strokeWidth: 3 });
  };
  const backLeg = (x) => path(`M${x - 18} 1650H${x + 18}L${x + 12} 1712H${x - 12}Z`, { fill: 'url(#chromeH)', stroke: INK, strokeWidth: 3 })
    + path(`M${x - 18} 1650H${x + 18}L${x + 12} 1712H${x - 12}Z`, { fill: INK, fillOpacity: 0.45 })
    + path(rr(x - 16, 1708, 32, 10, 4), { fill: '#272b52', stroke: INK, strokeWidth: 2.5 });
  const flipBtn = (x, s) => path(rr(x - (s < 0 ? 34 : 0), 1470, 34, 40, 10), { fill: 'url(#chromeH)', stroke: INK, strokeWidth: 3 })
    + path(rr(s < 0 ? x - 46 : x + 22, 1466, 24, 48, 10), { fill: 'url(#capM)', stroke: INK, strokeWidth: 3 })
    + path(`M${s < 0 ? x - 38 : x + 30} 1474V1490`, { stroke: '#fff', strokeOpacity: 0.85, strokeWidth: 4, strokeLinecap: 'round' });
  const slot = (x) => g({},
    path(rr(x - 42, 1478, 84, 70, 10), { fill: 'url(#chrome)', stroke: INK, strokeWidth: 3 }),
    path(rr(x - 30, 1488, 60, 50, 8), { fill: '#3a0a33', stroke: INK, strokeWidth: 2 }),
    g({ class: 'sp-coin' }, path(rr(x - 30, 1488, 60, 50, 8), { fill: 'url(#coinLit)' })),
    path(rr(x - 4, 1494, 8, 38, 4), { fill: '#05061a', stroke: '#ffd9f4', strokeWidth: 1.5 }),
    path(rr(x - 26, 1566, 52, 22, 6), { fill: 'url(#chromeD)', stroke: INK, strokeWidth: 2.5 }),
    path(`M${x - 14} 1577H${x + 14}`, { stroke: INK, strokeWidth: 4, strokeLinecap: 'round' }));
  const [prx] = [1300];
  return g({},
    // back legs (behind the body), floor shadow
    path(ellipse(CX, 1700, 720, 70), { fill: 'url(#nebM)' }),
    path(ellipse(CX, 1772, 760, 28), { fill: 'url(#floor)' }),
    backLeg(330), backLeg(1270),
    // cabinet top: side rails + playfield
    path(top, { fill: '#0b0e33', stroke: INK, strokeWidth: 6, strokeLinejoin: 'round' }),
    path(railL, { fill: 'url(#railL)', stroke: INK, strokeWidth: 3 }),
    path(railR, { fill: 'url(#railR)', stroke: INK, strokeWidth: 3 }),
    path(smooth([pt(0.015, 0.02), pt(0.015, 0.98)]), { stroke: '#fff', strokeOpacity: 0.85, strokeWidth: 4, strokeLinecap: 'round' }),
    path(smooth([pt(0.962, 0.02), pt(0.962, 0.98)]), { stroke: '#fff', strokeOpacity: 0.45, strokeWidth: 3, strokeLinecap: 'round' }),
    playfield(),
    // backbox hinge brackets sitting on the rails
    ...[[306, 1], [1294, -1]].map(([x, s]) => path(rr(s > 0 ? x - 10 : x - 46, 786, 56, 30, 6), { fill: 'url(#chrome)', stroke: INK, strokeWidth: 3 })
      + path(circle(s > 0 ? x + 18 : x - 18, 801, 5), { fill: '#272b52' })),
    // front face
    path(face, { fill: 'url(#face)', stroke: INK, strokeWidth: 6, strokeLinejoin: 'round' }),
    path(faceStars.join(''), { fill: GOLD, fillOpacity: 0.8 }),
    path('M140 1636C360 1560 520 1600 640 1530', { fill: 'none', stroke: MAG, strokeOpacity: 0.55, strokeWidth: 5, strokeLinecap: 'round' }),
    path('M960 1530C1080 1600 1220 1570 1460 1636', { fill: 'none', stroke: MAG, strokeOpacity: 0.55, strokeWidth: 5, strokeLinecap: 'round' }),
    path('M110 1600H1490', { stroke: GOLD, strokeOpacity: 0.5, strokeWidth: 2 }),
    path('M118 1450H1482', { stroke: '#e0a83a', strokeWidth: 5 }),
    path('M122 1640H1478', { stroke: '#e0a83a', strokeWidth: 6, strokeLinecap: 'round' }),
    ...[200, 380, 470, 1130, 1220, 1400].map((x, i) => g({ class: `sp-l${i % 4}` }, path(circle(x, 1640, 9), { fill: `url(#halo${i % 2 ? 'M' : 'G'})` }), path(circle(x, 1640, 5.5), { fill: i % 2 ? '#ff9be8' : '#fff3c2', stroke: INK, strokeWidth: 1.5 }))),
    // leg plates
    ...[[124, 1], [1476, -1]].map(([x, s]) => path(rr(s > 0 ? x : x - 92, 1586, 92, 60, 8), { fill: 'url(#chrome)', stroke: INK, strokeWidth: 3 })
      + [[18, 16], [74, 16], [18, 46], [74, 46]].map(([dx, dy]) => path(circle((s > 0 ? x : x - 92) + dx, 1586 + dy, 5), { fill: '#3a3f6e', stroke: INK, strokeWidth: 1.5 })).join('')),
    // coin door
    path(rr(656, 1462, 300, 182, 14), { fill: INK, fillOpacity: 0.5 }),
    path(rr(650, 1456, 300, 182, 14), { fill: 'url(#chrome)', stroke: INK, strokeWidth: 4 }),
    path(rr(662, 1468, 276, 158, 10), { fill: 'none', stroke: '#fff', strokeOpacity: 0.6, strokeWidth: 2 }),
    slot(735), slot(865),
    path(circle(800, 1514, 12), { fill: 'url(#goldR)', stroke: INK, strokeWidth: 2.5 }),
    path(`M800 1508V1520`, { stroke: INK, strokeWidth: 3, strokeLinecap: 'round' }),
    path(star(800, 1608, 16, 7), { fill: 'url(#goldR)', stroke: INK, strokeWidth: 2 }),
    // start button + plunger
    path(circle(300, 1502, 28), { fill: 'url(#chrome)', stroke: INK, strokeWidth: 3 }),
    g({ class: 'sp-pulse' }, path(circle(300, 1502, 34), { fill: 'url(#haloG)' })),
    path(star(300, 1502, 20, 9), { fill: 'url(#goldR)', stroke: INK, strokeWidth: 2.5, strokeLinejoin: 'round' }),
    path(circle(prx, 1500, 36), { fill: INK, fillOpacity: 0.5, transform: 'translate(4 6)' }),
    path(circle(prx, 1500, 36), { fill: 'url(#chrome)', stroke: INK, strokeWidth: 3 }),
    path(circle(prx, 1500, 16), { fill: '#272b52', stroke: INK, strokeWidth: 2 }),
    path(rr(prx - 7, 1500, 14, 46, 4), { fill: 'url(#chromeH)', stroke: INK, strokeWidth: 2.5 }),
    path(`M${prx - 13} 1512H${prx + 13}M${prx - 13} 1522H${prx + 13}M${prx - 13} 1532H${prx + 13}`, { stroke: '#c3c8e6', strokeWidth: 3, strokeLinecap: 'round' }),
    path(ellipse(prx, 1552, 30, 22), { fill: INK, fillOpacity: 0.5, transform: 'translate(4 6)' }),
    path(ellipse(prx, 1552, 30, 22), { fill: 'url(#capM)', stroke: INK, strokeWidth: 3 }),
    path(ellipse(prx - 9, 1544, 9, 5), { fill: '#fff', fillOpacity: 0.85 }),
    // flipper buttons on the cabinet sides
    flipBtn(110, -1), flipBtn(1490, 1),
    // lockdown bar
    path(rr(98, 1396, 1404, 46, 20), { fill: INK, fillOpacity: 0.5, transform: 'translate(0 7)' }),
    path(rr(98, 1396, 1404, 46, 20), { fill: 'url(#chrome)', stroke: INK, strokeWidth: 4 }),
    path('M126 1406H1474', { stroke: '#fff', strokeOpacity: 0.9, strokeWidth: 4, strokeLinecap: 'round' }),
    path(rr(740, 1402, 120, 34, 12), { fill: 'url(#chromeD)', stroke: INK, strokeWidth: 3 }),
    path(star(800, 1419, 11, 5), { fill: MAG, stroke: INK, strokeWidth: 1.5 }),
    leg(166, -1), leg(1434, 1));
}

function draw() {
  const glassPath = poly([IN(0, 0), IN(1, 0), IN(1, 1), IN(0, 1)]);
  const defs = [
    `<style>.sp-c0,.sp-c1,.sp-b0,.sp-b1,.sp-b2,.sp-l0,.sp-l1,.sp-l2,.sp-l3,.sp-pulse,.sp-coin{animation:sp-blink 2.4s steps(1) infinite}`
      + `.sp-c1{animation-delay:-1.2s}.sp-b1{animation-delay:-.8s}.sp-b2{animation-delay:-1.6s}`
      + `.sp-l0,.sp-l1,.sp-l2,.sp-l3{animation:sp-chase 1.6s steps(1) infinite}.sp-l1{animation-delay:-1.2s}.sp-l2{animation-delay:-.8s}.sp-l3{animation-delay:-.4s}`
      + `.sp-pulse,.sp-coin{animation:sp-pulse 3s ease-in-out infinite}`
      + `@keyframes sp-blink{0%{opacity:1}50%{opacity:.35}}@keyframes sp-chase{0%{opacity:1}25%{opacity:.3}}`
      + `@keyframes sp-pulse{0%,100%{opacity:1}50%{opacity:.55}}@media (prefers-reduced-motion:reduce){*{animation:none!important}}</style>`,
    lg('bbBody', [0, 0, 0, 1], [[0, '#2c3794'], [0.5, '#18206a'], [1, '#0c1040']]),
    lg('pilaster', [0, 0, 1, 0], [[0, '#3a46a8'], [0.5, '#1a2170'], [1, '#0c1040']]),
    lg('glassArt', [0, 0, 0, 1], [[0, '#1d2470'], [1, '#0c0f3c']]),
    lg('speaker', [0, 0, 0, 1], [[0, '#232c80'], [1, '#0b0e33']]),
    lg('face', [0, 0, 0, 1], [[0, '#1d2575'], [0.6, '#131a58'], [1, '#090c30']]),
    lg('gold', [0, 0, 0, 1], [[0, '#fff3c2'], [0.35, '#ffd166'], [0.7, '#c98a1e'], [1, '#7a4a0c']]),
    rg('goldR', [0.38, 0.32, 0.75], [[0, '#fffbe6'], [0.45, '#ffd166'], [1, '#9a6514']]),
    lg('rays', [0, 0, 0, 1], [[0, '#fff3c2'], [1, '#d9a038']]),
    rg('medal', [0.4, 0.35, 0.75], [[0, '#2c3794'], [1, '#0b0e33']]),
    lg('chrome', [0, 0, 0, 1], [[0, '#ffffff'], [0.4, '#d6dbf2'], [0.55, '#8a92b8'], [0.8, '#c7cce8'], [1, '#eef1ff']]),
    lg('chromeD', [0, 0, 1, 1], [[0, '#ffffff'], [0.3, '#cfd5ee'], [0.55, '#7d84a8'], [0.75, '#c7cce8'], [1, '#6a7196']]),
    lg('chromeH', [0, 0, 1, 0], [[0, '#ffffff'], [0.35, '#d6dbf2'], [0.6, '#7d84a8'], [1, '#c7cce8']]),
    rg('chromeR', [0.38, 0.32, 0.75], [[0, '#ffffff'], [0.5, '#c7cce8'], [1, '#5d6488']]),
    lg('railL', [110, 0, 345, 0], [[0, '#ffffff'], [0.4, '#c9cfe8'], [0.7, '#7d84a8'], [1, '#d6dbf2']], true),
    lg('railR', [1255, 0, 1490, 0], [[0, '#d6dbf2'], [0.35, '#8a92b8'], [0.7, '#c9cfe8'], [1, '#7d84a8']], true),
    rg('socket', [0.5, 0.5, 0.5], [[0, '#2b3070'], [1, '#0a0b2a']]),
    rg('haloM', [0.5, 0.5, 0.5], [[0, '#ff9be8', 0.85], [0.45, MAG, 0.35], [1, MAG, 0]]),
    rg('haloG', [0.5, 0.5, 0.5], [[0, '#fff3c2', 0.9], [0.45, GOLD, 0.35], [1, GOLD, 0]]),
    rg('haloV', [0.5, 0.5, 0.5], [[0, '#b58cff', 0.5], [1, '#b58cff', 0]]),
    rg('nebM', [0.5, 0.5, 0.5], [[0, MAG, 0.4], [1, MAG, 0]]),
    rg('nebV', [0.5, 0.5, 0.5], [[0, '#7a5cff', 0.4], [1, '#7a5cff', 0]]),
    rg('mesh', [0.5, 0.5, 0.5], [[0, '#2b3070'], [1, '#090b26']]),
    rg('capM', [0.38, 0.3, 0.75], [[0, '#ffe3f8'], [0.45, MAG], [1, '#a3127e']]),
    rg('capG', [0.38, 0.3, 0.75], [[0, '#fffbe6'], [0.45, GOLD], [1, '#a8701c']]),
    lg('bumperBody', [0, 0, 1, 0], [[0, '#ffe7a3'], [0.4, '#e0a83a'], [1, '#6e420a']]),
    lg('skirt', [0, 0, 1, 1], [[0, '#ffffff'], [1, '#8a92b8']]),
    rg('ballG', [0.36, 0.3, 0.8], [[0, '#ffffff'], [0.3, '#e3e7fa'], [0.7, '#7d84a8'], [1, '#2a2f5a']]),
    lg('rampG', [0, 0, 1, 1], [[0, '#ffb3ef', 0.75], [0.5, MAG, 0.5], [1, '#8a2fd0', 0.65]]),
    lg('sling', [0, 0, 0, 1], [[0, '#ff7fe3'], [1, '#9c1aa0']]),
    lg('apronG', [0, 0, 0, 1], [[0, '#fff3c2'], [1, '#d9a038']]),
    lg('comet', [1, 1, 0, 0], [[0, '#fff', 0.55], [1, '#fff', 0]]),
    rg('planet', [0.38, 0.32, 0.8], [[0, '#ffc6f2'], [0.5, '#c04fd8'], [1, '#3a1470']]),
    rg('coinLit', [0.5, 0.5, 0.6], [[0, '#ffd9f4'], [0.5, MAG, 0.8], [1, MAG, 0.2]]),
    lg('pfBase', [0, 0, 0, 1], [[0, '#0d1140'], [1, '#1b2378']]),
    lg('bbShade', [0, 800, 0, 900], [[0, '#000', 0.55], [1, '#000', 0]], true),
    lg('glassG', [0, 0, 1, 1], [[0, '#fff', 0.12], [0.4, '#fff', 0.02], [1, '#fff', 0]]),
    rg('floor', [0.5, 0.5, 0.5], [[0, INK, 0.55], [1, INK, 0]]),
    `<clipPath id="bgClip"><path d="${rr(362, 140, 876, 546, 26)}"/></clipPath>`,
    `<clipPath id="pfClip"><path d="${glassPath}"/></clipPath>`,
  ].join('');

  const body = [cabinet(), backbox(), topper(),
    path(sparkle(150, 300, 26), { fill: '#ffe9a3' }), path(sparkle(1460, 420, 20), { fill: '#ff9be8' }),
    path(sparkle(110, 980, 16), { fill: '#fff' }), path(sparkle(1500, 1080, 18), { fill: '#ffe9a3' }),
    path(star(190, 620, 12, 5), { fill: GOLD }), path(star(1420, 220, 10, 4.5), { fill: '#fff' }),
  ].join('\n');
  return { defs, body };
}

module.exports = {
  W, H, hole, radius, draw,
  meta: {
    name: 'Starlight Pinball', theme: 'pinball', rarity: 'legendary', translucent: false, collection: 'coin-op', license: 'CC-BY-4.0',
    desc: 'Your game lights up the backbox of a cosmic pinball table, with blinking bumpers, star lanes and a silver ball in flight.',
    tags: ['pinball', 'arcade', 'coin-op', 'space', 'neon', 'legendary'],
  },
};
