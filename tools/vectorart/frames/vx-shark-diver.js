'use strict';
// Shark Diver: a cute shark-head diving helmet seen face on. The screen is the helmet's glass faceplate,
// held in a riveted brass rim inside the shark's open jaws (rounded teeth along the top and bottom on a
// coral gum). Teal skin under a net of caustic light, white countershaded chin, glossy eyes, brass side
// ports, gills, a dorsal fin and pectoral fins, a riveted collar on a teal-and-white corselet with a
// depth gauge, a ribbed air hose into a brass valve, rising bubbles and soft light shafts from above.
const L = require('../lib');
const { rr, path, g, lg, rg, circle, ellipse, sparkle, tf, rng, lip, n, P } = L;

const W = 1600, H = 1400, hole = { x: 416, y: 520, w: 768, h: 432 }, radius = 40;
const CX = W / 2;
const INK = '#0b2f3a';
const GUM = { x: hole.x - 96, y: hole.y - 118, w: hole.w + 192, h: hole.h + 232, r: 160 };
const RIM = { x: hole.x - 44, y: hole.y - 44, w: hole.w + 88, h: hole.h + 88, r: radius + 40 };

const SUIT_D = 'M340 1140C250 1150 170 1192 132 1262C100 1322 112 1384 186 1390H1414C1488 1384 1500 1322 1468 1262C1430 1192 1350 1150 1260 1140Z';
const HEAD_D =`M${CX} 150C1150 150 1420 330 1452 650C1478 905 1400 1080 1200 1132L400 1132C200 1080 122 905 148 650C180 330 450 150 ${CX} 150Z`;

/** Closed smooth blob through points (quadratic segments via midpoints). */
function closed(pts) {
  const m = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  let d = `M${P(...m(pts[pts.length - 1], pts[0]))}`;
  for (let i = 0; i < pts.length; i++) d += `Q${P(...pts[i])} ${P(...m(pts[i], pts[(i + 1) % pts.length]))}`;
  return `${d}Z`;
}
function blob(cx, cy, r, wob, k, rnd) {
  const pts = [];
  for (let i = 0; i < k; i++) {
    const a = (i / k) * Math.PI * 2 + rnd() * 0.4, rad = r * (1 - wob + rnd() * wob * 2);
    pts.push([cx + rad * Math.cos(a), cy + rad * Math.sin(a)]);
  }
  return closed(pts);
}

/** Signed distance to a rounded rect {x,y,w,h,r} (negative inside). */
function sdRR(R, px, py) {
  const qx = Math.abs(px - (R.x + R.w / 2)) - (R.w / 2 - R.r), qy = Math.abs(py - (R.y + R.h / 2)) - (R.h / 2 - R.r);
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - R.r;
}
/** Point + outward normal at arc length s on a rounded rect, starting at the left end of the top-left arc. */
function rrAt(R, s) {
  const { x, y, w, h, r } = R, q = (Math.PI * r) / 2, sw = w - 2 * r, sh = h - 2 * r;
  const arc = (cx, cy, a0, t) => { const a = a0 + t / r; return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a), nx: Math.cos(a), ny: Math.sin(a) }; };
  const segs = [
    [q, (t) => arc(x + r, y + r, Math.PI, t)],
    [sw, (t) => ({ x: x + r + t, y, nx: 0, ny: -1 })],
    [q, (t) => arc(x + w - r, y + r, -Math.PI / 2, t)],
    [sh, (t) => ({ x: x + w, y: y + r + t, nx: 1, ny: 0 })],
    [q, (t) => arc(x + w - r, y + h - r, 0, t)],
    [sw, (t) => ({ x: x + w - r - t, y: y + h, nx: 0, ny: 1 })],
    [q, (t) => arc(x + r, y + h - r, Math.PI / 2, t)],
    [sh, (t) => ({ x, y: y + h - r - t, nx: -1, ny: 0 })],
  ];
  for (const [len, f] of segs) { if (s <= len) return f(s); s -= len; }
  return segs[0][1](0);
}

/** Rounded shark teeth from the gum line toward the brass rim, between arc lengths s0..s1 of the gum. */
function teeth(s0, s1, count) {
  const out = [], hi = [], step = (s1 - s0) / count;
  for (let i = 0; i < count; i++) {
    const p = rrAt(GUM, s0 + step * (i + 0.5));
    const corner = Math.abs(p.nx) > 0.05, vx = -p.nx * 0.55, vy = -p.ny * 0.55 + (p.ny < 0 ? 0.45 : -0.45), vl = Math.hypot(vx, vy);
    const ix = vx / vl, iy = vy / vl, bx = p.x + ix * (corner ? 12 : 6), by = p.y + iy * (corner ? 12 : 6);
    let lo = 0, hiT = 200; // distance along the inward normal to the rim
    for (let k = 0; k < 24; k++) { const m = (lo + hiT) / 2; if (sdRR(RIM, bx + ix * m, by + iy * m) > 0) lo = m; else hiT = m; }
    const Lh = lo - 4, w = step * (corner ? 0.8 : 0.94), ang = (Math.atan2(iy, ix) * 180) / Math.PI - 90;
    const d = `M${P(-w / 2, -14)}C${P(-w / 2, Lh * 0.42, -w * 0.2, Lh, 0, Lh)}C${P(w * 0.2, Lh, w / 2, Lh * 0.42, w / 2, -14)}Z`;
    out.push(path(d, { transform: tf(bx, by, ang) }));
    hi.push(path(`M${P(-w * 0.28, 4)}C${P(-w * 0.28, Lh * 0.4, -w * 0.16, Lh * 0.72, -w * 0.06, Lh * 0.84)}`, { transform: tf(bx, by, ang) }));
  }
  return g({ clipPath: 'url(#sdGumClip)' },
    g({ fill: 'url(#sdTooth)', stroke: INK, strokeWidth: 4.5, strokeLinejoin: 'round' }, out),
    g({ fill: 'none', stroke: '#fff', strokeOpacity: 0.9, strokeWidth: 5, strokeLinecap: 'round' }, hi));
}

function bubble(cx, cy, r) {
  return path(circle(cx, cy, r), { fill: 'url(#sdBubble)', stroke: '#e9fffb', strokeOpacity: 0.95, strokeWidth: n(Math.max(1.6, r * 0.11)) })
    + path(ellipse(cx - r * 0.36, cy - r * 0.38, r * 0.3, r * 0.17), { fill: '#fff', fillOpacity: 0.92, transform: `rotate(-38 ${n(cx - r * 0.36)} ${n(cy - r * 0.38)})` })
    + (r > 9 ? path(circle(cx + r * 0.42, cy + r * 0.4, r * 0.09), { fill: '#fff', fillOpacity: 0.8 }) : '');
}

function rivet(cx, cy, r = 7) {
  return path(circle(cx + 1.5, cy + 2.5, r), { fill: INK, fillOpacity: 0.35 })
    + path(circle(cx, cy, r), { fill: 'url(#sdRivet)', stroke: INK, strokeWidth: 2.5 })
    + path(circle(cx - r * 0.32, cy - r * 0.34, r * 0.3), { fill: '#fff', fillOpacity: 0.9 });
}

/** Caustic light net: a bright layer under jittered skin-coloured cells, so only the wavy gaps glow. */
function caustics(clipId, x0, y0, x1, y1, s, seed, skip) {
  const rnd = rng(seed), cells = [];
  for (let j = 0, y = y0; y < y1; j++, y += s * 0.86) {
    for (let x = x0 + (j % 2 ? s / 2 : 0); x < x1; x += s) {
      const cx = x + (rnd() - 0.5) * s * 0.36, cy = y + (rnd() - 0.5) * s * 0.36;
      if (skip && skip(cx, cy)) continue;
      cells.push(blob(cx, cy, s * 0.575, 0.1, 9, rnd));
    }
  }
  return g({ clipPath: `url(#${clipId})` }, path(cells.join(''), { fill: 'url(#sdSkinU)' }));
}

function eye(cx, cy, flip) {
  const r = 50;
  return g({},
    path(ellipse(cx, cy + 4, r + 12, r + 9), { fill: '#0d4650', fillOpacity: 0.5 }),
    path(ellipse(cx, cy, r, r * 1.06), { fill: 'url(#sdEye)', stroke: INK, strokeWidth: 5 }),
    path(ellipse(cx - 14 * flip, cy - 16, 15, 18), { fill: '#fff' }),
    path(circle(cx + 15 * flip, cy + 18, 7), { fill: '#fff', fillOpacity: 0.9 }),
    path(`M${P(cx - r * 0.7, cy + r * 0.55)}Q${P(cx, cy + r * 1.05, cx + r * 0.7, cy + r * 0.55)}`, { fill: 'none', stroke: '#7ad8e8', strokeOpacity: 0.55, strokeWidth: 4, strokeLinecap: 'round' }),
    path(ellipse(cx - 62 * flip, cy + r + 8, 30, 14), { fill: '#ff7fa8', fillOpacity: 0.62, transform: `rotate(${-20 * flip} ${n(cx - 62 * flip)} ${n(cy + r + 8)})` }));
}

/** Brass side port with a little round window. */
function port(cx, cy) {
  return g({},
    path(circle(cx + 3, cy + 6, 50), { fill: INK, fillOpacity: 0.35 }),
    path(circle(cx, cy, 50), { fill: 'url(#sdBrass)', stroke: INK, strokeWidth: 5 }),
    path(circle(cx, cy, 31), { fill: 'url(#sdPortGlass)', stroke: INK, strokeWidth: 4 }),
    path(`M${P(cx - 18, cy - 8)}A20 20 0 0 1 ${P(cx - 4, cy - 21)}`, { fill: 'none', stroke: '#fff', strokeOpacity: 0.9, strokeWidth: 5, strokeLinecap: 'round' }),
    [0, 90, 180, 270].map((a) => rivet(cx + 41 * Math.cos(((a + 45) * Math.PI) / 180), cy + 41 * Math.sin(((a + 45) * Math.PI) / 180), 5)).join(''));
}

/** Three crescent gill slits. */
function gills(x, y, side) {
  let d = '', hi = '';
  for (let i = 0; i < 3; i++) {
    const gx = x + side * i * 24, gy = y + i * 8, h = 74 - i * 8;
    d += `M${P(gx, gy)}Q${P(gx + side * 22, gy + h / 2, gx, gy + h)}Q${P(gx + side * 8, gy + h / 2, gx, gy)}Z`;
    hi += `M${P(gx + side * 13, gy + 10)}Q${P(gx + side * 26, gy + h / 2, gx + side * 13, gy + h - 10)}`;
  }
  return path(hi, { fill: 'none', stroke: '#c6fff5', strokeOpacity: 0.45, strokeWidth: 3, strokeLinecap: 'round' })
    + path(d, { fill: '#0a3f4a', stroke: INK, strokeWidth: 3, strokeLinejoin: 'round' });
}

function fins() {
  const dorsal = 'M676 212C690 130 790 46 1004 10C966 66 944 140 952 214Z';
  const finL = 'M226 900C136 950 64 1060 22 1196C130 1176 236 1124 318 1052Z';
  const finR = 'M1374 900C1464 950 1536 1060 1578 1196C1470 1176 1364 1124 1282 1052Z';
  const shade = (d) => path(d, { fill: INK, fillOpacity: 0.3, transform: 'translate(6 9)' });
  return g({},
    shade(dorsal), shade(finL), shade(finR),
    path(dorsal, { fill: 'url(#sdFin)', stroke: INK, strokeWidth: 7, strokeLinejoin: 'round' }),
    caustics('sdDorsalClip', 690, 20, 1000, 220, 52, 17),
    path('M720 170C760 110 840 64 930 38', { fill: 'none', stroke: '#c6fff5', strokeOpacity: 0.7, strokeWidth: 6, strokeLinecap: 'round' }),
    path(dorsal, { fill: 'none', stroke: INK, strokeWidth: 7, strokeLinejoin: 'round' }),
    path(finL, { fill: 'url(#sdFin)', stroke: INK, strokeWidth: 7, strokeLinejoin: 'round' }),
    path(finR, { fill: 'url(#sdFin)', stroke: INK, strokeWidth: 7, strokeLinejoin: 'round' }),
    path('M200 960C140 1010 100 1080 74 1150', { fill: 'none', stroke: '#c6fff5', strokeOpacity: 0.6, strokeWidth: 5, strokeLinecap: 'round' }),
    path('M1300 1040C1380 1050 1470 1110 1520 1170', { fill: 'none', stroke: INK, strokeOpacity: 0.25, strokeWidth: 5, strokeLinecap: 'round' }));
}

/** Teal-and-white corselet under a riveted brass collar, with a depth gauge. */
function corselet() {
  const d = SUIT_D;
  const band = 'M110 1318C300 1350 520 1362 800 1362C1080 1362 1300 1350 1490 1318';
  // white wetsuit panels with wavy, marbled edges
  const panL = 'M318 1150C236 1170 170 1222 140 1300L214 1312C238 1250 290 1206 372 1180Z';
  const panR = 'M1282 1150C1364 1170 1430 1222 1460 1300L1386 1312C1362 1250 1310 1206 1228 1180Z';
  const panC = 'M630 1150H970C944 1222 880 1270 800 1300C720 1270 656 1222 630 1150Z';
  const stitch = 'M676 1182C720 1232 760 1262 800 1284C840 1262 880 1232 924 1182';
  const rivets = [], bolts = [];
  for (let x = 380; x <= 1220; x += 60) rivets.push(rivet(x, 1142, 6.5));
  for (let i = 0; i <= 10; i++) { const t = i / 10, x = 170 + t * 1260, y = 1340 + Math.sin(t * Math.PI) * 18; bolts.push(rivet(x, y, 9)); }
  const gx = 470, gy = 1250;
  return g({},
    path(d, { fill: INK, fillOpacity: 0.3, transform: 'translate(6 10)' }),
    path(d, { fill: 'url(#sdSuit)', stroke: INK, strokeWidth: 7, strokeLinejoin: 'round' }),
    g({ clipPath: 'url(#sdSuitClip)' },
      path(panL + panR + panC, { fill: 'url(#sdBelly)', stroke: INK, strokeOpacity: 0.5, strokeWidth: 4 }),
      path(stitch, { fill: 'none', stroke: '#2a8f98', strokeWidth: 3, strokeDasharray: '10 8', strokeLinecap: 'round' }),
      path(band, { fill: 'none', stroke: INK, strokeWidth: 62 }),
      path(band, { fill: 'none', stroke: 'url(#sdBrassV2)', strokeWidth: 54 })),
    path('M196 1220C250 1176 320 1156 400 1150', { fill: 'none', stroke: '#c6fff5', strokeOpacity: 0.7, strokeWidth: 5, strokeLinecap: 'round' }),
    bolts.join(''),
    // collar ring
    path(rr(336, 1102, 928, 80, 40), { fill: INK, fillOpacity: 0.3, transform: 'translate(4 8)' }),
    path(rr(336, 1102, 928, 80, 40), { fill: 'url(#sdBrassV)', stroke: INK, strokeWidth: 6 }),
    path('M370 1116H1230', { stroke: '#fff7d6', strokeOpacity: 0.75, strokeWidth: 5, strokeLinecap: 'round' }),
    rivets.join(''),
    // depth gauge
    path(circle(gx + 4, gy + 7, 52), { fill: INK, fillOpacity: 0.3 }),
    path(circle(gx, gy, 52), { fill: 'url(#sdBrass)', stroke: INK, strokeWidth: 5 }),
    path(circle(gx, gy, 40), { fill: '#d8f25a', stroke: INK, strokeWidth: 4 }),
    path(circle(gx, gy, 30), { fill: 'url(#sdGauge)', stroke: INK, strokeWidth: 3 }),
    path([-120, -60, 0, 60, 120].map((a) => { const r1 = 22, r2 = 28, t = ((a - 90) * Math.PI) / 180; return `M${P(gx + r1 * Math.cos(t), gy + r1 * Math.sin(t))}L${P(gx + r2 * Math.cos(t), gy + r2 * Math.sin(t))}`; }).join(''), { stroke: '#cfeff0', strokeWidth: 3, strokeLinecap: 'round' }),
    path(`M${gx} ${gy}L${gx + 15} ${gy - 15}`, { stroke: '#ff6b6b', strokeWidth: 4.5, strokeLinecap: 'round' }),
    path(circle(gx, gy, 5), { fill: INK }),
    path(`M${P(gx - 26, gy - 14)}A30 30 0 0 1 ${P(gx - 8, gy - 28)}`, { fill: 'none', stroke: '#fff', strokeOpacity: 0.8, strokeWidth: 4, strokeLinecap: 'round' }));
}

/** Ribbed air hose from the corselet up into a brass valve on the right cheek. */
function hose() {
  const d = 'M1506 962C1506 1040 1590 1076 1582 1176C1574 1270 1490 1306 1400 1300';
  const elbow = 'M1446 906C1490 906 1506 924 1506 966';
  return g({},
    path(d, { fill: 'none', stroke: INK, strokeOpacity: 0.3, strokeWidth: 58, strokeLinecap: 'round', transform: 'translate(5 8)' }),
    path(d, { fill: 'none', stroke: INK, strokeWidth: 58, strokeLinecap: 'round' }),
    path(d, { fill: 'none', stroke: '#3c6f7a', strokeWidth: 46, strokeLinecap: 'round' }),
    path(d, { fill: 'none', stroke: '#6fb1ba', strokeWidth: 46, strokeDasharray: '9 9' }),
    path(d, { fill: 'none', stroke: '#c9f3f5', strokeOpacity: 0.55, strokeWidth: 8, strokeLinecap: 'round', transform: 'translate(-9 -7)' }),
    // brass gooseneck valve on the cheek
    path(elbow, { fill: 'none', stroke: INK, strokeWidth: 44, strokeLinecap: 'butt' }),
    path(elbow, { fill: 'none', stroke: 'url(#sdBrassE)', strokeWidth: 34, strokeLinecap: 'butt' }),
    path('M1452 896C1482 896 1494 908 1496 930', { fill: 'none', stroke: '#fff7d6', strokeOpacity: 0.8, strokeWidth: 5, strokeLinecap: 'round' }),
    path(rr(1478, 954, 56, 22, 8), { fill: 'url(#sdBrassV)', stroke: INK, strokeWidth: 4 }),
    path(circle(1438, 906, 36), { fill: INK, fillOpacity: 0.3, transform: 'translate(3 6)' }),
    path(circle(1438, 906, 36), { fill: 'url(#sdBrass)', stroke: INK, strokeWidth: 5 }),
    path(circle(1438, 906, 18), { fill: 'url(#sdBrassV)', stroke: INK, strokeWidth: 3.5 }),
    [45, 135, 225, 315].map((a) => rivet(1438 + 27 * Math.cos((a * Math.PI) / 180), 906 + 27 * Math.sin((a * Math.PI) / 180), 4.5)).join(''),
    // little purge valve on top, where the bubbles come from
    path(rr(1470, 852, 20, 40, 6), { fill: 'url(#sdBrassV)', stroke: INK, strokeWidth: 3.5 }),
    path(rr(1460, 842, 40, 14, 6), { fill: 'url(#sdBrass)', stroke: INK, strokeWidth: 3.5 }),
    // coupling where the hose meets the corselet
    path(rr(1384, 1266, 30, 68, 10), { fill: 'url(#sdBrassV)', stroke: INK, strokeWidth: 4.5 }),
    path('M1392 1278V1322', { stroke: '#fff7d6', strokeOpacity: 0.8, strokeWidth: 4, strokeLinecap: 'round' }));
}

function rays() {
  const ray = (x0, w0, x1, w1) => `M${P(x0 - w0 / 2, -10)}L${P(x0 + w0 / 2, -10)}L${P(x1 + w1 / 2, 1100)}L${P(x1 - w1 / 2, 1100)}Z`;
  return path(ray(330, 60, 140, 180) + ray(560, 90, 470, 240) + ray(1120, 70, 1290, 220) + ray(1360, 50, 1560, 160), { fill: 'url(#sdRay)' });
}

function draw() {
  const holeD = rr(hole.x, hole.y, hole.w, hole.h, radius);
  const gumD = rr(GUM.x, GUM.y, GUM.w, GUM.h, GUM.r);
  const rimD = rr(RIM.x, RIM.y, RIM.w, RIM.h, RIM.r);
  const q = (Math.PI * GUM.r) / 4, sw = GUM.w - 2 * GUM.r, sh = GUM.h - 2 * GUM.r;
  const topS0 = q * 1.1, topS1 = 2.9 * q + sw, botS0 = 4 * q + sw + sh + q * 1.1, botS1 = botS0 + 1.8 * q + sw;
  const belly = closed([[90, 700], [200, 760], [262, 846], [330, 900], [CX, 960], [1270, 900], [1338, 846], [1400, 760], [1510, 700], [1600, 900], [1600, 1300], [0, 1300], [0, 900]]);
  const rimRivets = [];
  for (let i = 0; i < 9; i++) { const x = hole.x + 24 + (i * (hole.w - 48)) / 8; rimRivets.push(rivet(x, RIM.y + 22, 6), rivet(x, RIM.y + RIM.h - 22, 6)); }
  for (let i = 1; i < 4; i++) { const y = hole.y + (i * hole.h) / 4; rimRivets.push(rivet(RIM.x + 22, y, 6), rivet(RIM.x + RIM.w - 22, y, 6)); }

  const defs = [
    '<style>.sd-bob{animation:sdBob 3.2s ease-in-out infinite alternate}.sd-bob2{animation:sdBob 2.6s ease-in-out -1.3s infinite alternate}'
      + '@keyframes sdBob{0%{transform:translateY(0)}100%{transform:translateY(-10px)}}@media (prefers-reduced-motion:reduce){*{animation:none!important}}</style>',
    lg('sdSkinU', [0, 150, 0, 1140], [[0, '#3cc4bd'], [0.35, '#1f9aa0'], [0.7, '#137882'], [1, '#0f5d6a']], true),
    lg('sdCaustic', [0, 150, 0, 1000], [[0, '#e2fff8', 0.95], [0.35, '#bdfbf0', 0.7], [0.7, '#a6f3ea', 0.25], [1, '#a6f3ea', 0.05]], true),
    rg('sdHeadShade', [0.42, 0.3, 0.75], [[0.6, '#062a33', 0], [1, '#062a33', 0.3]]),
    lg('sdFin', [0, 0, 0.4, 1], [[0, '#3cc4bd'], [0.6, '#1d8e96'], [1, '#126d78']]),
    lg('sdBelly', [0, 0, 0, 1], [[0, '#ffffff'], [0.6, '#eefaf8'], [1, '#c4e4e3']]),
    lg('sdSuit', [0, 0, 0, 1], [[0, '#1f9aa0'], [1, '#0e5966']]),
    lg('sdGum', [0, 0, 0, 1], [[0, '#c84d6c'], [0.25, '#ff8aa0'], [0.75, '#ff9cb0'], [1, '#e8708c']]),
    lg('sdTooth', [0, 0, 1, 0], [[0, '#ffffff'], [0.6, '#fbf8f0'], [1, '#dfe9ea']]),
    lg('sdBrass', [0, 0, 1, 1], [[0, '#fff1b8'], [0.35, '#f2c55a'], [0.7, '#c98a24'], [1, '#eab64c']]),
    lg('sdBrassE', [1446, 880, 1530, 966], [[0, '#fff1b8'], [0.45, '#efbf52'], [1, '#b87a1c']], true),
    lg('sdBrassV', [0, 0, 0, 1], [[0, '#fff1b8'], [0.45, '#efbf52'], [1, '#b87a1c']]),
    lg('sdRim', [0, 0, 1, 1], [[0, '#fff3c4'], [0.3, '#f2c55a'], [0.62, '#cf9228'], [0.85, '#f0c25a'], [1, '#c58622']]),
    lg('sdInner', [0, 0, 0, 1], [[0, '#07323b'], [1, '#0d4954']]),
    rg('sdRivet', [0.35, 0.3, 0.8], [[0, '#fff6d0'], [0.55, '#e7b448'], [1, '#9a6514']]),
    rg('sdEye', [0.4, 0.3, 0.8], [[0, '#2b3f63'], [0.6, '#0f1a30'], [1, '#04070f']]),
    rg('sdPortGlass', [0.35, 0.3, 0.9], [[0, '#d6fffa'], [0.5, '#5fd2d0'], [1, '#13707c']]),
    rg('sdGauge', [0.4, 0.35, 0.8], [[0, '#1d5260'], [1, '#082a33']]),
    rg('sdBubble', [0.5, 0.5, 0.5], [[0, '#c9fff7', 0.08], [0.7, '#b9f7f0', 0.18], [1, '#e9fffb', 0.55]]),
    lg('sdRay', [0, 0, 0, 1], [[0, '#e6fffb', 0.08], [0.5, '#e6fffb', 0.03], [1, '#e6fffb', 0]]),
    `<clipPath id="sdHeadClip"><path d="${HEAD_D}"/></clipPath>`,
    `<clipPath id="sdGumClip"><path d="${gumD}"/></clipPath>`,
    '<clipPath id="sdDorsalClip"><path d="M676 212C690 130 790 46 1004 10C966 66 944 140 952 214Z"/></clipPath>',
    `<clipPath id="sdSuitClip"><path d="${SUIT_D}"/></clipPath>`,
    lg('sdBrassV2', [0, 1300, 0, 1392], [[0, '#fff1b8'], [0.4, '#efbf52'], [1, '#b87a1c']], true),
  ].join('');

  const bubblesR = [[1482, 804, 10], [1500, 748, 15], [1520, 680, 10], [1496, 630, 19], [1524, 596, 13], [1508, 540, 9], [1540, 470, 18], [1520, 396, 11], [1556, 330, 15], [1538, 262, 8], [1566, 200, 12]];
  const bubblesL = [[120, 640, 13], [96, 576, 9], [118, 512, 17], [86, 440, 11], [106, 372, 8], [74, 300, 14], [100, 236, 9], [62, 170, 12]];
  const bubblesTop = [[560, 120, 12], [600, 70, 8], [530, 36, 14], [1080, 100, 9], [1130, 56, 13], [1180, 120, 7], [250, 300, 10], [1340, 250, 9]];
  const mouthBubbles = [[300, 1090, 10], [272, 1040, 7], [1310, 1078, 9]];

  const body = [
    rays(),
    fins(),
    corselet(),
    // head
    path(HEAD_D, { fill: INK, fillOpacity: 0.32, transform: 'translate(7 11)' }),
    path(HEAD_D, { fill: 'url(#sdSkinU)' }),
    path(HEAD_D, { fill: 'url(#sdCaustic)' }),
    caustics('sdHeadClip', 120, 130, 1490, 980, 66, 5, (x, y) => sdRR(GUM, x, y) < -30),
    g({ clipPath: 'url(#sdHeadClip)' },
      path(belly, { fill: 'url(#sdBelly)', stroke: INK, strokeOpacity: 0.45, strokeWidth: 4 }),
      path(HEAD_D, { fill: 'url(#sdHeadShade)' }),
      path('M220 470C270 330 400 230 560 190', { fill: 'none', stroke: '#e6fffb', strokeOpacity: 0.75, strokeWidth: 9, strokeLinecap: 'round' }),
      path('M600 176C640 170 680 166 720 165', { fill: 'none', stroke: '#e6fffb', strokeOpacity: 0.75, strokeWidth: 9, strokeLinecap: 'round' })),
    path(HEAD_D, { fill: 'none', stroke: INK, strokeWidth: 8, strokeLinejoin: 'round' }),
    eye(438, 318, 1), eye(1162, 318, -1),
    port(222, 640), port(1378, 640),
    gills(206, 760, 1), gills(1394, 760, -1),
    // jaws
    path(gumD, { fill: 'url(#sdGum)', stroke: INK, strokeWidth: 8 }),
    g({ clipPath: 'url(#sdGumClip)' },
      path(gumD, { fill: 'none', stroke: '#7a1f3c', strokeOpacity: 0.35, strokeWidth: 40 }),
      path(rimD, { fill: 'none', stroke: '#6e1a36', strokeOpacity: 0.28, strokeWidth: 34 })),
    teeth(topS0, topS1, 11), teeth(botS0, botS1, 11),
    path(gumD, { fill: 'none', stroke: INK, strokeWidth: 8 }),
    hose(),
    // brass faceplate rim and dark glass lip (calm ring around the screen)
    path(rimD, { fill: INK, fillOpacity: 0.35, transform: 'translate(4 7)' }),
    path(rimD, { fill: 'url(#sdRim)', stroke: INK, strokeWidth: 6 }),
    path(rr(RIM.x + 9, RIM.y + 9, RIM.w - 18, RIM.h - 18, RIM.r - 9), { fill: 'none', stroke: '#fff6d0', strokeOpacity: 0.55, strokeWidth: 3 }),
    rimRivets.join(''),
    path(rr(hole.x - 14, hole.y - 14, hole.w + 28, hole.h + 28, radius + 12), { fill: 'url(#sdInner)', stroke: INK, strokeWidth: 3 }),
    lip(holeD, '#000', [[7, 0.28], [3, 0.55]]),
    path(`M${hole.x - 6} ${hole.y + 120}V${hole.y + 38}Q${hole.x - 6} ${hole.y - 6} ${hole.x + 38} ${hole.y - 6}H${hole.x + 170}`, { fill: 'none', stroke: '#bdfcf4', strokeOpacity: 0.75, strokeWidth: 4, strokeLinecap: 'round' }),
    // bubbles and light glints
    g({ class: 'sd-bob' }, bubblesR.map(([x, y, r]) => bubble(x, y, r)).join(''), mouthBubbles.map(([x, y, r]) => bubble(x, y, r)).join('')),
    g({ class: 'sd-bob2' }, bubblesL.map(([x, y, r]) => bubble(x, y, r)).join(''), bubblesTop.map(([x, y, r]) => bubble(x, y, r)).join('')),
    path(sparkle(470, 236, 16), { fill: '#fff', fillOpacity: 0.95 }),
    path(sparkle(1110, 214, 11), { fill: '#fff', fillOpacity: 0.9 }),
    path(sparkle(64, 1060, 12), { fill: '#e6fffb', fillOpacity: 0.9 }),
  ].join('\n');
  return { defs, body };
}

module.exports = {
  W, H, hole, radius, draw,
  meta: {
    name: 'Shark Diver', theme: 'underwater', rarity: 'epic', translucent: false, collection: 'curio-cabinet', license: 'CC-BY-4.0',
    desc: 'Suit up in a grinning shark-head diving helmet and watch your game through the faceplate glass between its very friendly teeth.',
    tags: ['shark', 'diving', 'underwater', 'ocean', 'bubbles', 'brass', 'cute'],
  },
};
