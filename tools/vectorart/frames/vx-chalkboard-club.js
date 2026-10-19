'use strict';
// Chalkboard Club: a cheerful after-school classroom corner. The screen is the chalkboard, inside a
// honey-wood frame on a pastel sunshine wall with sweeping arcs. A pink ribbon is tied around the
// top-left corner, a sailor-uniform scarf bow sits at the top of a pastel pennant garland, puffy star
// stickers and crayon-pastel doodles (stars, hearts, swirls, notes, a little rainbow) dot the wall, and
// the chalk tray holds pastel chalk, a felt eraser and a lavender twin-bell desk clock.
const L = require('../lib');
const { rr, path, g, lg, rg, circle, ellipse, star, sparkle, heart, tf, rng, lip, smooth, n, P } = L;

const W = 1600, H = 1100, hole = { x: 328, y: 262, w: 944, h: 531 }, radius = 12;
const INK = '#4a2a3a';
const BOARD = { x: hole.x - 22, y: hole.y - 22, w: hole.w + 44, h: hole.h + 44 };
const FR = { x: hole.x - 82, y: hole.y - 82, w: hole.w + 164, h: hole.h + 164 };
const WALL = { x: 60, y: 96, w: 1480, h: 920, r: 56 };
const TRAY = { x0: 196, x1: 1500, y: FR.y + FR.h - 12 };
const PASTEL = ['#ff9fc2', '#b9a5f0', '#8fc8ff', '#9fe8c8', '#ffe27a', '#ffb38a'];
const CRAYON = ['#ff6fa3', '#9a82ea', '#4fa6f2', '#3fc495', '#ffb020', '#ff8a5c'];

// ---- doodles: crayon-pastel strokes with a chalky grain ---------------------------------------
function chalk(d, col, w = 7, fill = false) {
  return (fill ? path(d, { fill: '#fff', fillOpacity: 0.55 }) + path(d, { fill: col, fillOpacity: 0.22 }) : '')
    + path(d, { fill: 'none', stroke: col, strokeOpacity: 0.9, strokeWidth: w, strokeLinecap: 'round', strokeLinejoin: 'round' })
    + path(d, { fill: 'none', stroke: '#fff', strokeOpacity: 0.55, strokeWidth: w * 0.4, strokeLinecap: 'round', strokeDasharray: '1.5 7' });
}
const doodle = {
  star: (x, y, s, rot = 0) => star(x, y, s, s * 0.45, 5, -90 + rot),
  heart: (x, y, s) => heart(x, y, s),
  spiral: (x, y, s) => { const pts = []; for (let i = 0; i <= 40; i++) { const a = i * 0.42, r = s * (i / 40); pts.push([x + r * Math.cos(a), y + r * Math.sin(a)]); } return smooth(pts); },
  note: (x, y, s) => `M${P(x, y)}V${n(y - s * 2.2)}L${P(x + s * 1.6, y - s * 2.6)}V${n(y - s * 0.4)}${circle(x - s * 0.42, y, s * 0.45)}${circle(x + s * 1.18, y - s * 0.4, s * 0.45)}`,
  cloud: (x, y, s) => `M${P(x - s, y)}A${P(s * 0.45, s * 0.45)} 0 0 1 ${P(x - s * 0.4, y - s * 0.55)}A${P(s * 0.55, s * 0.55)} 0 0 1 ${P(x + s * 0.5, y - s * 0.5)}A${P(s * 0.48, s * 0.48)} 0 0 1 ${P(x + s, y)}Z`,
  zig: (x, y, s) => { let d = `M${P(x, y)}`; for (let i = 1; i <= 6; i++) d += `L${P(x + i * s * 0.34, y + (i % 2 ? -s * 0.3 : 0))}`; return d; },
  flower: (x, y, s) => { let d = ''; for (let i = 0; i < 5; i++) { const a = (i * 72 - 90) * Math.PI / 180; d += circle(x + Math.cos(a) * s * 0.55, y + Math.sin(a) * s * 0.55, s * 0.36); } return d + circle(x, y, s * 0.2); },
  rainbow: (x, y, s) => `M${P(x - s, y)}A${P(s, s)} 0 0 1 ${P(x + s, y)}`,
};

/** Puffy outlined star sticker. */
function sticker(x, y, s, col, rot = 0) {
  const d = star(0, 0, s, s * 0.52, 5, -90);
  return g({ transform: tf(x, y, rot) },
    path(d, { fill: INK, fillOpacity: 0.22, transform: 'translate(3 5)' }),
    path(d, { fill: '#fff', stroke: '#fff', strokeWidth: s * 0.34, strokeLinejoin: 'round' }),
    path(d, { fill: 'none', stroke: INK, strokeOpacity: 0.35, strokeWidth: s * 0.34 + 4, strokeLinejoin: 'round' }),
    path(d, { fill: '#fff', stroke: '#fff', strokeWidth: s * 0.3, strokeLinejoin: 'round' }),
    path(d, { fill: col, stroke: INK, strokeWidth: 3, strokeLinejoin: 'round' }),
    path(ellipse(-s * 0.18, -s * 0.22, s * 0.2, s * 0.1), { fill: '#fff', fillOpacity: 0.85, transform: `rotate(-30 ${n(-s * 0.18)} ${n(-s * 0.22)})` }));
}

// ---- the wall -----------------------------------------------------------------------------------
function wall() {
  const d = rr(WALL.x, WALL.y, WALL.w, WALL.h, WALL.r);
  const arcs = [
    'M60 620C300 380 700 300 1100 360C1300 390 1450 470 1540 560',
    'M60 900C400 640 900 600 1540 760',
    'M300 96C420 300 700 420 1000 440',
    'M1150 1016C1200 800 1350 680 1540 640',
  ];
  return g({},
    path(rr(WALL.x + 8, WALL.y + 14, WALL.w, WALL.h, WALL.r), { fill: INK, fillOpacity: 0.25 }),
    path(d, { fill: 'url(#cbWall)' }),
    path(d, { fill: 'url(#cbDots)' }),
    g({ clipPath: 'url(#cbWallClip)' },
      path(arcs.join(''), { fill: 'none', stroke: '#fff', strokeOpacity: 0.38, strokeWidth: 10, strokeLinecap: 'round' }),
      path(arcs.join(''), { fill: 'none', stroke: '#ff9a5a', strokeOpacity: 0.18, strokeWidth: 3, transform: 'translate(0 18)' }),
      path(d, { fill: 'url(#cbWallShade)' })),
    path(d, { fill: 'none', stroke: INK, strokeWidth: 20 }),
    path(d, { fill: 'none', stroke: '#fffaf0', strokeWidth: 11 }));
}

function doodles() {
  const C = CRAYON, items = [
    ['heart', 176, 480, 30, C[0], 0, 1], ['spiral', 140, 640, 38, C[2]], ['star', 146, 780, 32, C[4], 12, 1],
    ['note', 96, 432, 18, C[3]], ['flower', 140, 950, 28, C[1], 0, 1],
    ['cloud', 1450, 300, 62, C[2], 0, 1], ['star', 1488, 628, 24, C[1], -10, 1], ['heart', 1394, 640, 18, C[0], 0, 1],
    ['note', 1408, 210, 18, C[5]],
    ['rainbow', 430, 980, 50, C[0]], ['rainbow', 430, 980, 36, C[4]], ['rainbow', 430, 980, 22, C[2]],
    ['star', 640, 978, 24, C[3], 20, 1], ['heart', 860, 972, 22, C[5], 0, 1], ['spiral', 1060, 968, 26, C[1]], ['zig', 1180, 985, 64, C[2]],
    ['zig', 1350, 985, 54, C[0]],
  ];
  return items.map(([k, x, y, s, col, rot, fill]) => chalk(doodle[k](x, y, s, rot), col, k === 'zig' || k === 'rainbow' ? 8 : 7, !!fill)).join('')
    + path(sparkle(108, 180, 18) + sparkle(1500, 180, 14) + sparkle(1290, 950, 14) + sparkle(560, 930, 10) + sparkle(96, 720, 10), { fill: '#fff', fillOpacity: 0.95 });
}

/** A lined pastel notecard pinned to the wall, covered in squiggles (no words). */
function notecard(cx, cy, rot) {
  const w = 150, h = 118, lines = [], sq = [];
  for (let i = 0; i < 4; i++) lines.push(`M${P(-w / 2 + 14, -h / 2 + 40 + i * 20)}H${n(w / 2 - 14)}`);
  const rnd = rng(4);
  for (let i = 0; i < 3; i++) {
    let x = -w / 2 + 18, y = -h / 2 + 36 + i * 20, d = `M${P(x, y)}`;
    const end = w / 2 - 20 - rnd() * 40;
    while (x < end) { d += `q${P(5, -9, 10, 0)}`; x += 10; }
    sq.push(d);
  }
  return g({ transform: tf(cx, cy, rot) },
    path(rr(-w / 2 + 5, -h / 2 + 8, w, h, 6), { fill: INK, fillOpacity: 0.22 }),
    path(rr(-w / 2, -h / 2, w, h, 6), { fill: '#fff2f6', stroke: INK, strokeWidth: 4 }),
    path(rr(-w / 2, -h / 2, w, 22, [6, 6, 0, 0]), { fill: '#ffb3cf' }),
    path(rr(-w / 2, -h / 2, w, h, 6), { fill: 'none', stroke: INK, strokeWidth: 4 }),
    path(lines.join(''), { stroke: '#8fc8ff', strokeWidth: 2 }),
    path(sq.join(''), { fill: 'none', stroke: '#9a82ea', strokeWidth: 3.5, strokeLinecap: 'round', strokeLinejoin: 'round' }),
    path(heart(w / 2 - 26, h / 2 - 20, 9), { fill: '#ff6fa3', stroke: INK, strokeWidth: 2 }),
    path(circle(0, -h / 2 + 4, 12), { fill: 'url(#cbPin)', stroke: INK, strokeWidth: 3.5 }),
    path(circle(-4, -h / 2, 4), { fill: '#fff', fillOpacity: 0.85 }));
}

// ---- frame, board and tray ------------------------------------------------------------------------
function frame(holeD) {
  const outer = rr(FR.x, FR.y, FR.w, FR.h, 30), inner = rr(BOARD.x, BOARD.y, BOARD.w, BOARD.h, 14);
  const rnd = rng(12), grain = [];
  for (let i = 0; i < 26; i++) {
    const side = i % 4, t0 = 0.08 + rnd() * 0.5, t1 = t0 + 0.15 + rnd() * 0.3, o = 10 + rnd() * 42;
    if (side < 2) { const y = side ? FR.y + FR.h - o : FR.y + o; grain.push(`M${P(FR.x + FR.w * t0, y)}Q${P(FR.x + FR.w * (t0 + t1) / 2, y + (rnd() - 0.5) * 6, FR.x + FR.w * t1, y)}`); }
    else { const x = side === 3 ? FR.x + FR.w - o : FR.x + o; grain.push(`M${P(x, FR.y + FR.h * t0)}Q${P(x + (rnd() - 0.5) * 6, FR.y + FR.h * (t0 + t1) / 2, x, FR.y + FR.h * t1)}`); }
  }
  const miters = `M${P(FR.x + 12, FR.y + 12)}L${P(BOARD.x, BOARD.y)}M${P(FR.x + FR.w - 12, FR.y + 12)}L${P(BOARD.x + BOARD.w, BOARD.y)}`
    + `M${P(FR.x + 12, FR.y + FR.h - 12)}L${P(BOARD.x, BOARD.y + BOARD.h)}M${P(FR.x + FR.w - 12, FR.y + FR.h - 12)}L${P(BOARD.x + BOARD.w, BOARD.y + BOARD.h)}`;
  const smudge = [ellipse(BOARD.x + 120, BOARD.y + BOARD.h - 10, 90, 8), ellipse(BOARD.x + BOARD.w - 160, BOARD.y + 10, 120, 7)];
  return g({},
    path(outer, { fill: INK, fillOpacity: 0.3, transform: 'translate(7 12)' }),
    path(outer, { fill: 'url(#cbWood)', stroke: INK, strokeWidth: 6 }),
    g({ clipPath: 'url(#cbFrameClip)' }, path(grain.join(''), { fill: 'none', stroke: '#8a4f22', strokeOpacity: 0.3, strokeWidth: 2.5, strokeLinecap: 'round' })),
    path(miters, { stroke: INK, strokeOpacity: 0.35, strokeWidth: 3 }),
    path(rr(FR.x + 10, FR.y + 10, FR.w - 20, FR.h - 20, 22), { fill: 'none', stroke: '#fff4dc', strokeOpacity: 0.55, strokeWidth: 4 }),
    path(rr(BOARD.x - 8, BOARD.y - 8, BOARD.w + 16, BOARD.h + 16, 18), { fill: 'none', stroke: '#9a5a2a', strokeWidth: 6 }),
    // board margin (the calm ring), faint chalk dust
    path(inner, { fill: 'url(#cbBoard)', stroke: INK, strokeWidth: 4 }),
    path(smudge.join(''), { fill: '#fff', fillOpacity: 0.07 }),
    lip(holeD, '#0c1f18', [[7, 0.25], [3, 0.5]]));
}

function chalkStick(x, y, len, col, rot) {
  return g({ transform: tf(x, y, rot) },
    path(rr(-len / 2 + 3, -6, len, 22, 11), { fill: INK, fillOpacity: 0.25 }),
    path(rr(-len / 2, -11, len, 22, 11), { fill: col, stroke: INK, strokeWidth: 3.5 }),
    path(`M${P(-len / 2 + 9, -4)}H${n(len / 2 - 10)}`, { stroke: '#fff', strokeOpacity: 0.75, strokeWidth: 4, strokeLinecap: 'round' }),
    path(ellipse(len / 2 - 8, 0, 5, 9), { fill: '#fff', fillOpacity: 0.55 }));
}

function tray() {
  const { x0, x1, y } = TRAY;
  return g({},
    path(rr(x0 + 6, y + 10, x1 - x0, 44, 10), { fill: INK, fillOpacity: 0.3 }),
    // brackets
    path(`M${P(x0 + 70, y + 40)}V${n(y + 74)}Q${P(x0 + 70, y + 90, x0 + 92, y + 92)}H${n(x0 + 110)}V${n(y + 40)}Z`, { fill: 'url(#cbWoodDark)', stroke: INK, strokeWidth: 4, strokeLinejoin: 'round' }),
    path(`M${P(x1 - 70, y + 40)}V${n(y + 74)}Q${P(x1 - 70, y + 90, x1 - 92, y + 92)}H${n(x1 - 110)}V${n(y + 40)}Z`, { fill: 'url(#cbWoodDark)', stroke: INK, strokeWidth: 4, strokeLinejoin: 'round' }),
    path(rr(x0, y, x1 - x0, 18, 6), { fill: 'url(#cbTrayTop)', stroke: INK, strokeWidth: 4 }),
    path(rr(x0 - 6, y + 14, x1 - x0 + 12, 30, 8), { fill: 'url(#cbWood)', stroke: INK, strokeWidth: 5 }),
    path(`M${P(x0 + 6, y + 22)}H${n(x1 - 6)}`, { stroke: '#fff4dc', strokeOpacity: 0.6, strokeWidth: 3, strokeLinecap: 'round' }),
    path(ellipse(640, y + 8, 120, 5) + ellipse(980, y + 8, 80, 4), { fill: '#fff', fillOpacity: 0.45 }),
    // chalk and eraser
    chalkStick(540, y - 2, 96, '#ffffff', -4), chalkStick(660, y - 1, 78, '#ffb3cf', 5), chalkStick(770, y, 60, '#fff1a0', -3),
    chalkStick(880, y - 2, 86, '#b6dcff', 3), chalkStick(990, y, 50, '#cbbcf6', -7), chalkStick(1080, y, 40, '#b4f0d6', 4),
    g({ transform: tf(330, y + 6, -3) },
      path(rr(-74, -36, 148, 46, 10), { fill: INK, fillOpacity: 0.25, transform: 'translate(4 6)' }),
      path(rr(-74, -14, 148, 24, 6), { fill: '#ff9fc2', stroke: INK, strokeWidth: 4 }),
      path(rr(-70, -40, 140, 32, 10), { fill: 'url(#cbEraser)', stroke: INK, strokeWidth: 4 }),
      path('M-58 -30H30', { stroke: '#fff', strokeOpacity: 0.7, strokeWidth: 4, strokeLinecap: 'round' }),
      path('M-70 4H74', { stroke: '#fff', strokeOpacity: 0.35, strokeWidth: 6, strokeDasharray: '2 6' })));
}

function clock(cx, base) {
  const cy = base - 98, R = 70;
  const ticks = [];
  for (let i = 0; i < 12; i++) {
    const a = (i * 30 * Math.PI) / 180, r1 = i % 3 ? 50 : 44, r2 = 56;
    ticks.push(`M${P(cx + r1 * Math.sin(a), cy - r1 * Math.cos(a))}L${P(cx + r2 * Math.sin(a), cy - r2 * Math.cos(a))}`);
  }
  const bell = (side) => {
    const bx = cx + side * 52, by = cy - 62, rot = side * 32;
    return g({ transform: tf(bx, by, rot) },
      path('M-34 8C-34 -22 -18 -34 0 -34C18 -34 34 -22 34 8Z', { fill: 'url(#cbBell)', stroke: INK, strokeWidth: 4.5, strokeLinejoin: 'round' }),
      path('M-22 -6C-20 -20 -12 -26 -4 -27', { fill: 'none', stroke: '#fff', strokeOpacity: 0.8, strokeWidth: 4, strokeLinecap: 'round' }),
      path(circle(0, -38, 6), { fill: 'url(#cbBell)', stroke: INK, strokeWidth: 3 }));
  };
  return g({},
    path(ellipse(cx + 6, base, 92, 10), { fill: INK, fillOpacity: 0.3 }),
    // feet and hammer
    path(`M${P(cx - 42, cy + 56)}L${P(cx - 60, base - 2)}M${P(cx + 42, cy + 56)}L${P(cx + 60, base - 2)}`, { stroke: INK, strokeWidth: 12, strokeLinecap: 'round' }),
    path(`M${P(cx - 42, cy + 56)}L${P(cx - 60, base - 2)}M${P(cx + 42, cy + 56)}L${P(cx + 60, base - 2)}`, { stroke: '#9b86e0', strokeWidth: 6, strokeLinecap: 'round' }),
    path(`M${P(cx, cy - R)}V${n(cy - R - 22)}`, { stroke: INK, strokeWidth: 8, strokeLinecap: 'round' }),
    path(rr(cx - 22, cy - R - 30, 44, 12, 6), { fill: 'url(#cbBell)', stroke: INK, strokeWidth: 3 }),
    bell(-1), bell(1),
    path(circle(cx, cy, R), { fill: 'url(#cbClock)', stroke: INK, strokeWidth: 5 }),
    path(circle(cx, cy, R - 12), { fill: '#fffaf2', stroke: INK, strokeWidth: 3.5 }),
    path(ticks.join(''), { stroke: '#8a74cc', strokeWidth: 4, strokeLinecap: 'round' }),
    path(`M${P(cx, cy)}L${P(cx - 20, cy - 24)}M${P(cx, cy)}L${P(cx + 34, cy - 8)}`, { stroke: INK, strokeWidth: 6, strokeLinecap: 'round' }),
    path(`M${P(cx, cy + 10)}L${P(cx + 2, cy - 44)}`, { stroke: '#ff6f8a', strokeWidth: 2.5, strokeLinecap: 'round' }),
    path(circle(cx, cy, 6), { fill: '#ff6f8a', stroke: INK, strokeWidth: 2.5 }),
    path(`M${P(cx - 50, cy - 30)}A58 58 0 0 1 ${P(cx - 22, cy - 54)}`, { fill: 'none', stroke: '#fff', strokeOpacity: 0.9, strokeWidth: 6, strokeLinecap: 'round' }),
    path(heart(cx, cy + 32, 7), { fill: '#ffb3cf', stroke: INK, strokeWidth: 1.6 }));
}

// ---- ribbons --------------------------------------------------------------------------------------
/** Smooth ribbon strip of width w along centerline pts, V-notched at the far end when notch is set. */
function strip(pts, w, notch = true) {
  const nrm = pts.map((p, i) => {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1;
    return [-dy / l, dx / l];
  });
  const side = (k) => pts.map((p, i) => [p[0] + nrm[i][0] * k * w / 2, p[1] + nrm[i][1] * k * w / 2]);
  const thru = (q) => { let d = ''; for (let i = 1; i < q.length - 1; i++) d += `Q${P(...q[i])} ${P((q[i][0] + q[i + 1][0]) / 2, (q[i][1] + q[i + 1][1]) / 2)}`; return `${d}L${P(...q[q.length - 1])}`; };
  const A = side(1), B = side(-1).reverse(), e = pts[pts.length - 1], f = pts[pts.length - 2], el = Math.hypot(e[0] - f[0], e[1] - f[1]) || 1;
  const v = [e[0] - (e[0] - f[0]) / el * w * 0.55, e[1] - (e[1] - f[1]) / el * w * 0.55];
  return `M${P(...A[0])}${thru(A)}${notch ? `L${P(...v)}` : ''}L${P(...B[0])}${thru(B)}Z`;
}

/** Pink satin ribbon tied around the top-left corner of the frame. */
function pinkRibbon() {
  const K = [270, 222], k = (dx, dy) => [K[0] + dx, K[1] + dy];
  const band = strip([[FR.x - 20, FR.y + 128], k(0, 0), [FR.x + 128, FR.y - 20]], 40, false);
  const loopUL = `M${P(...K)}C${P(...k(-36, -74))} ${P(...k(-156, -112))} ${P(...k(-150, -36))}C${P(...k(-146, 14))} ${P(...k(-60, 22))} ${P(...K)}Z`;
  const loopUR = `M${P(...K)}C${P(...k(-16, -84))} ${P(...k(56, -176))} ${P(...k(112, -118))}C${P(...k(156, -70))} ${P(...k(64, -20))} ${P(...K)}Z`;
  const tailA = strip([k(-4, 6), k(-40, 40), k(-62, 96), k(-112, 150)], 34);
  const tailB = strip([k(4, 8), k(-6, 70), k(10, 140), k(-12, 214)], 32);
  const rib = (d) => path(d, { fill: 'url(#cbPink)', stroke: INK, strokeWidth: 4.5, strokeLinejoin: 'round' });
  return g({},
    g({ clipPath: 'url(#cbFrameOuter)' },
      path(band, { fill: INK, fillOpacity: 0.25, transform: 'translate(4 7)' }),
      rib(band),
      path(`M${P(FR.x - 6, FR.y + 104)}L${P(FR.x + 104, FR.y - 6)}`, { stroke: '#fff', strokeOpacity: 0.6, strokeWidth: 4, strokeLinecap: 'round' })),
    path(tailA + tailB + loopUL + loopUR, { fill: INK, fillOpacity: 0.22, transform: 'translate(5 9)' }),
    rib(tailA), rib(tailB), rib(loopUL), rib(loopUR),
    // satin sheen and inner folds
    path(`M${P(...k(-134, -40))}C${P(...k(-132, -86))} ${P(...k(-60, -70))} ${P(...k(-20, -22))}M${P(...k(100, -116))}C${P(...k(70, -150))} ${P(...k(20, -90))} ${P(...k(8, -30))}`, { fill: 'none', stroke: '#fff', strokeOpacity: 0.7, strokeWidth: 5, strokeLinecap: 'round' }),
    path(`M${P(...k(-110, -20))}Q${P(...k(-60, -18))} ${P(...k(-18, -6))}M${P(...k(80, -90))}Q${P(...k(40, -50))} ${P(...k(12, -12))}`, { fill: 'none', stroke: '#d8507e', strokeOpacity: 0.45, strokeWidth: 3.5, strokeLinecap: 'round' }),
    path(`M${P(...k(-30, 40))}Q${P(...k(-50, 80))} ${P(...k(-80, 118))}M${P(...k(-4, 60))}Q${P(...k(4, 110))} ${P(...k(-2, 170))}`, { fill: 'none', stroke: '#fff', strokeOpacity: 0.55, strokeWidth: 4, strokeLinecap: 'round' }),
    path(rr(K[0] - 24, K[1] - 22, 48, 44, 16), { fill: 'url(#cbPink)', stroke: INK, strokeWidth: 4.5, transform: `rotate(-40 ${K[0]} ${K[1]})` }),
    path(ellipse(K[0] - 9, K[1] - 9, 10, 5), { fill: '#fff', fillOpacity: 0.8, transform: `rotate(-40 ${K[0] - 9} ${K[1] - 9})` }));
}

/** Sailor-uniform scarf bow: salmon satin with white trim stripes and V-cut tails. */
function sailorBow(cx, cy) {
  const loopL = `M${P(cx - 14, cy)}C${P(cx - 60, cy - 54, cx - 130, cy - 50, cx - 128, cy - 6)}C${P(cx - 126, cy + 34, cx - 60, cy + 40, cx - 14, cy + 6)}Z`;
  const loopR = `M${P(cx + 14, cy)}C${P(cx + 60, cy - 54, cx + 130, cy - 50, cx + 128, cy - 6)}C${P(cx + 126, cy + 34, cx + 60, cy + 40, cx + 14, cy + 6)}Z`;
  const tailL = `M${P(cx - 10, cy + 10)}L${P(cx - 70, cy + 88)}L${P(cx - 46, cy + 80)}L${P(cx - 38, cy + 104)}L${P(cx + 10, cy + 18)}Z`;
  const tailR = `M${P(cx + 10, cy + 10)}L${P(cx + 74, cy + 84)}L${P(cx + 50, cy + 80)}L${P(cx + 46, cy + 104)}L${P(cx - 8, cy + 18)}Z`;
  const trim = `M${P(cx - 118, cy - 6)}C${P(cx - 116, cy - 36, cx - 66, cy - 40, cx - 22, cy - 4)}M${P(cx + 118, cy - 6)}C${P(cx + 116, cy - 36, cx + 66, cy - 40, cx + 22, cy - 4)}`
    + `M${P(cx - 16, cy + 22)}L${P(cx - 60, cy + 80)}M${P(cx + 16, cy + 22)}L${P(cx + 64, cy + 78)}`;
  const s = (d) => path(d, { fill: 'url(#cbSalmon)', stroke: INK, strokeWidth: 4.5, strokeLinejoin: 'round' });
  return g({},
    path(loopL + loopR, { fill: INK, fillOpacity: 0.22, transform: 'translate(4 8)' }),
    s(tailL), s(tailR),
    path(trim.split('M').slice(3).map((x) => `M${x}`).join(''), { fill: 'none', stroke: '#fff', strokeWidth: 4, strokeLinecap: 'round' }),
    s(loopL), s(loopR),
    path(trim.split('M').slice(1, 3).map((x) => `M${x}`).join(''), { fill: 'none', stroke: '#fff', strokeWidth: 4, strokeLinecap: 'round' }),
    path(trim.split('M').slice(1, 3).map((x) => `M${x}`).join(''), { fill: 'none', stroke: '#fff', strokeWidth: 3, strokeLinecap: 'round', transform: 'translate(0 9)' }),
    path(rr(cx - 22, cy - 22, 44, 42, 12), { fill: 'url(#cbSalmon)', stroke: INK, strokeWidth: 4.5 }),
    path(`M${P(cx - 12, cy - 12)}Q${P(cx, cy - 18, cx + 10, cy - 12)}`, { fill: 'none', stroke: '#fff', strokeOpacity: 0.8, strokeWidth: 3.5, strokeLinecap: 'round' }));
}

/** Pennant garland from the pink ribbon to the sailor bow and on to a pushpin at the top-right corner. */
function bunting(bx, by) {
  const out = [];
  const run = (x0, y0, x1, y1, sag, count, seed) => {
    const qx = (x0 + x1) / 2, qy = (y0 + y1) / 2 + sag, at = (t) => [(1 - t) ** 2 * x0 + 2 * (1 - t) * t * qx + t * t * x1, (1 - t) ** 2 * y0 + 2 * (1 - t) * t * qy + t * t * y1];
    const flags = [], decos = [];
    for (let i = 0; i < count; i++) {
      const ta = (i + 0.12) / count, tb = (i + 0.88) / count, a = at(ta), b = at(tb), m = at((ta + tb) / 2);
      const tip = [m[0] + (m[1] - a[1]) * 0.1, m[1] + 62];
      const col = PASTEL[(i + seed) % PASTEL.length];
      flags.push(path(`M${P(...a)}L${P(...b)}L${P(...tip)}Z`, { fill: col, stroke: INK, strokeWidth: 3.5, strokeLinejoin: 'round' }));
      decos.push((i + seed) % 2 ? circle(m[0], m[1] + 18, 5) : `M${P(a[0] + 8, a[1] + 12)}L${P(b[0] - 8, b[1] + 12)}`);
    }
    out.push(path(`M${P(x0, y0)}Q${P(qx, qy, x1, y1)}`, { fill: 'none', stroke: INK, strokeWidth: 4 }), ...flags,
      path(decos.join(''), { fill: '#fff', fillOpacity: 0.8, stroke: '#fff', strokeOpacity: 0.8, strokeWidth: 4, strokeLinecap: 'round' }));
  };
  run(300, 150, bx - 30, by - 4, 46, 5, 0);
  run(bx + 30, by - 4, 1330, 150, 46, 5, 3);
  return g({}, ...out,
    path(circle(1332, 150, 13), { fill: 'url(#cbPin)', stroke: INK, strokeWidth: 3.5 }),
    path(circle(1328, 146, 4), { fill: '#fff', fillOpacity: 0.85 }));
}

function draw() {
  const holeD = rr(hole.x, hole.y, hole.w, hole.h, radius);
  const defs = [
    '<style>.cb-sway{animation:cbSway 3.6s ease-in-out infinite alternate;transform-origin:800px 120px}@keyframes cbSway{0%{transform:rotate(-0.6deg)}100%{transform:rotate(0.6deg)}}'
      + '@media (prefers-reduced-motion:reduce){*{animation:none!important}}</style>',
    `<pattern id="cbDots" width="56" height="56" patternUnits="userSpaceOnUse"><path d="${circle(14, 14, 5)}${circle(42, 42, 5)}" fill="#fff" fill-opacity="0.32"/></pattern>`,
    lg('cbWall', [0, 0, 1, 0.6], [[0, '#ffb876'], [0.35, '#ffd98e'], [0.7, '#fff0a8'], [1, '#fff6cc']]),
    rg('cbWallShade', [0.5, 0.45, 0.75], [[0.6, '#ff9a5a', 0], [1, '#ff8a4a', 0.22]]),
    lg('cbWood', [0, 0, 1, 1], [[0, '#f3c48a'], [0.5, '#e2a464'], [1, '#c98544']]),
    lg('cbWoodDark', [0, 0, 0, 1], [[0, '#d6955a'], [1, '#a8662f']]),
    lg('cbTrayTop', [0, 0, 0, 1], [[0, '#f7d6a6'], [1, '#e5b47a']]),
    lg('cbBoard', [0, 0, 0, 1], [[0, '#3a6e5e'], [1, '#2c5a4c']]),
    lg('cbEraser', [0, 0, 0, 1], [[0, '#d9cdfb'], [1, '#a996ec']]),
    lg('cbPink', [0, 0, 1, 1], [[0, '#ffd0e2'], [0.5, '#ff9fc2'], [1, '#f07aa6']]),
    lg('cbSalmon', [0, 0, 1, 1], [[0, '#ffb3ae'], [0.5, '#ff7d86'], [1, '#e85a6e']]),
    rg('cbClock', [0.38, 0.32, 0.8], [[0, '#e9e0ff'], [0.6, '#bfaef4'], [1, '#9580e0']]),
    rg('cbBell', [0.38, 0.32, 0.8], [[0, '#fff7cf'], [0.55, '#ffd970'], [1, '#e6a93a']]),
    rg('cbPin', [0.38, 0.32, 0.8], [[0, '#c9f6ff'], [0.55, '#7fd0ff'], [1, '#3e94d6']]),
    `<clipPath id="cbFrameOuter"><path d="${rr(FR.x, FR.y, FR.w, FR.h, 30)}"/></clipPath>`,
    `<clipPath id="cbWallClip"><path d="${rr(WALL.x, WALL.y, WALL.w, WALL.h, WALL.r)}"/></clipPath>`,
    `<clipPath id="cbFrameClip"><path clip-rule="evenodd" d="${rr(FR.x, FR.y, FR.w, FR.h, 30)}${rr(BOARD.x - 6, BOARD.y - 6, BOARD.w + 12, BOARD.h + 12, 18)}"/></clipPath>`,
  ].join('');
  const body = [
    wall(),
    doodles(),
    frame(holeD),
    notecard(1450, 470, 6),
    sticker(FR.x + 40, FR.y + FR.h - 40, 26, '#ffe27a', -12),
    sticker(FR.x + FR.w - 42, FR.y + FR.h - 44, 22, '#9fe8c8', 14),
    sticker(FR.x + FR.w - 40, FR.y + 120, 18, '#ff9fc2', 8),
    tray(),
    clock(1420, TRAY.y + 8),
    g({ class: 'cb-sway' }, bunting(800, 128), sailorBow(800, 128)),
    pinkRibbon(),
  ].join('\n');
  return { defs, body };
}

module.exports = {
  W, H, hole, radius, draw,
  meta: {
    name: 'Chalkboard Club', theme: 'school', rarity: 'rare', translucent: false, collection: 'curio-cabinet', license: 'CC-BY-4.0',
    desc: 'After-school club is in session: your game takes over the chalkboard while pastel doodles, ribbons and a tiny desk clock cheer you on.',
    tags: ['school', 'classroom', 'chalkboard', 'pastel', 'ribbon', 'kawaii', 'retro-anime'],
  },
};
