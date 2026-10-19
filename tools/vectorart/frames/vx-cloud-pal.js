'use strict';
// Cloud Pal: a keychain virtual pet whose whole body is a puffy cumulus cloud of clear sky-blue
// plastic with glitter. Pearl screen bezel ringed with tiny care icons, three raindrop buttons,
// a blinking raindrop LED, a rainbow lanyard loop and a sunny charm on a ball chain.
const L = require('../lib');
const { rr, path, g, lg, rg, circle, ellipse, sparkle, star, heart, tf, rng, lip, smooth, n, P } = L;

const W = 1000, H = 1180, hole = { x: 280, y: 380, w: 440, h: 440 }, radius = 34;
const INK = '#2b3a7a';
const BZ = 66; // pearl bezel width around the opening

// Cloud outline: an inner polygon whose every edge bulges outward as a circular puff.
// [x, y, k] where k scales the puff radius (1 = half-dome, larger = flatter).
const PTS = [
  [222, 1045, 1.12], [138, 890, 1.12], [136, 670, 1.04], [165, 455, 1.0], [290, 315, 1.0],
  [560, 298, 1.0], [785, 345, 1.02], [864, 550, 1.12], [864, 790, 1.08], [804, 995, 1.4],
  [600, 1075, 1.7], [400, 1075, 1.4],
];

/** Puff geometry for each edge: endpoints, radius and circle centre. */
function puffs() {
  return PTS.map(([x0, y0, k], i) => {
    const [x1, y1] = PTS[(i + 1) % PTS.length];
    const dx = x1 - x0, dy = y1 - y0, c = Math.hypot(dx, dy), r = (c / 2) * k;
    const off = Math.sqrt(Math.max(0, r * r - (c / 2) ** 2));
    const cx = (x0 + x1) / 2 + (-dy / c) * off, cy = (y0 + y1) / 2 + (dx / c) * off; // inward side
    return { x0, y0, x1, y1, r, cx, cy };
  });
}

function cloudPath(list) {
  return `M${P(list[0].x0, list[0].y0)}` + list.map((p) => `A${P(p.r, p.r)} 0 0 1 ${P(p.x1, p.y1)}`).join('') + 'Z';
}

/** Arc on a circle between two angles (degrees, clockwise in screen space). */
function arcD(cx, cy, r, a0, a1) {
  const pt = (a) => [cx + r * Math.cos((a * Math.PI) / 180), cy + r * Math.sin((a * Math.PI) / 180)];
  const [sx, sy] = pt(a0), [ex, ey] = pt(a1);
  return `M${P(sx, sy)}A${P(r, r)} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${P(ex, ey)}`;
}

/** Raindrop pointing up, round end centred on (cx, cy). */
function drop(cx, cy, r, tip = 1.7) {
  return `M${P(cx, cy - r * tip)}C${P(cx + r * 0.25, cy - r * 1.2, cx + r, cy - r * 0.7, cx + r, cy)}`
    + `A${P(r, r)} 0 0 1 ${P(cx - r, cy)}C${P(cx - r, cy - r * 0.7, cx - r * 0.25, cy - r * 1.2, cx, cy - r * tip)}Z`;
}

// ---- rainbow lanyard ----------------------------------------------------------------------------
const RAINBOW = ['#ff8f9a', '#ffbe72', '#ffe372', '#8fe3a6', '#7cc6ff', '#b7a0ff'];

/** Teardrop strap loop (centre line) hanging from the clasp at (ax, ay), tilted by rot degrees. */
function loopPts(ax, ay, A, B, rot, count = 72) {
  const out = [], c = Math.cos((rot * Math.PI) / 180), s = Math.sin((rot * Math.PI) / 180);
  for (let i = 0; i <= count; i++) {
    const t = 0.32 + (i / count) * (2 * Math.PI - 0.64);
    const x = -A * Math.sin(t) * Math.pow(Math.sin(t / 2), 0.8), y = -B * (1 - Math.cos(t)) / 2;
    out.push([ax + x * c - y * s, ay + x * s + y * c]);
  }
  return out;
}

function offsetPts(pts, o) {
  return pts.map(([x, y], i) => {
    const [ax, ay] = pts[Math.max(0, i - 1)], [bx, by] = pts[Math.min(pts.length - 1, i + 1)];
    const dx = bx - ax, dy = by - ay, l = Math.hypot(dx, dy) || 1;
    return [x - (dy / l) * o, y + (dx / l) * o];
  });
}

function lanyard() {
  const pts = loopPts(CL.x, CL.y + 8, 74, 130, -70), sw = 6.2, k = RAINBOW.length;
  const line = (p) => `M${p.map((q) => P(...q)).join('L')}`;
  let out = path(line(offsetPts(pts, 3)), { fill: 'none', stroke: INK, strokeOpacity: 0.35, strokeWidth: k * sw + 12, strokeLinejoin: 'round', transform: 'translate(3 7)' })
    + path(line(pts), { fill: 'none', stroke: INK, strokeWidth: k * sw + 9, strokeLinejoin: 'round' });
  RAINBOW.forEach((col, i) => {
    out += path(line(offsetPts(pts, (i - (k - 1) / 2) * sw)), { fill: 'none', stroke: col, strokeWidth: sw + 0.6, strokeLinejoin: 'round' });
  });
  // woven stitch + gloss
  out += path(line(offsetPts(pts, -(k / 2) * sw + 4)), { fill: 'none', stroke: '#fff', strokeOpacity: 0.7, strokeWidth: 2.5, strokeDasharray: '7 7' });
  out += path(line(offsetPts(pts, (k / 2) * sw - 4)), { fill: 'none', stroke: '#fff', strokeOpacity: 0.35, strokeWidth: 2.5, strokeDasharray: '7 7' });
  return out;
}

// clasp centre (top of the strap) and the jump ring linking it to the tab on the cloud's top puff
const CL = { x: 432, y: 112 }, RING = { x: 432, y: 166 };

function clasp() {
  const { x, y } = CL;
  return g({},
    path(`M${x} ${y + 18}V${RING.y - 10}`, { stroke: INK, strokeWidth: 12, strokeLinecap: 'round' }),
    path(`M${x} ${y + 18}V${RING.y - 10}`, { stroke: 'url(#metal)', strokeWidth: 5, strokeLinecap: 'round' }),
    path(rr(x - 22, y - 20, 44, 46, 13), { fill: INK, fillOpacity: 0.35, transform: 'translate(3 6)' }),
    path(rr(x - 22, y - 20, 44, 46, 13), { fill: 'url(#metal)', stroke: INK, strokeWidth: 5 }),
    path(`M${x - 12} ${y - 6}H${x + 12}M${x - 12} ${y + 4}H${x + 12}M${x - 12} ${y + 14}H${x + 12}`, { stroke: INK, strokeOpacity: 0.3, strokeWidth: 3, strokeLinecap: 'round' }),
    path(`M${x - 13} ${y - 10}V${y + 14}`, { stroke: '#fff', strokeOpacity: 0.9, strokeWidth: 4, strokeLinecap: 'round' }));
}

/** Pearl tab moulded on the top puff, with the jump ring threaded through its eyelet. */
function tab() {
  const { x, y } = RING, ring = (d) => path(d, { fill: 'none', stroke: INK, strokeWidth: 11, strokeLinecap: 'round' }) + path(d, { fill: 'none', stroke: 'url(#metal)', strokeWidth: 5.5, strokeLinecap: 'round' });
  const t = rr(x - 25, y + 2, 50, 50, [24, 24, 10, 10]);
  return ring(circle(x, y, 15))
    + path(t, { fill: INK, fillOpacity: 0.3, transform: 'translate(3 6)' })
    + path(t, { fill: 'url(#pearlEdge)', stroke: INK, strokeWidth: 5 })
    + path(`M${x - 14} ${y + 14}Q${x - 12} ${y + 8} ${x - 4} ${y + 7}`, { fill: 'none', stroke: '#fff', strokeWidth: 3.5, strokeLinecap: 'round' })
    + path(ellipse(x, y + 19, 8, 7), { fill: INK })
    + ring(`M${x} ${y + 15}A15 15 0 0 1 ${x - 15} ${y}`);
}

// ---- sun charm on a ball chain ------------------------------------------------------------------
const SUN = { x: 880, y: 300 };
function ballChain() {
  const c = [[RING.x + 15, RING.y], [560, 250], [760, 246], [SUN.x, SUN.y - 80]];
  const pts = [];
  for (let i = 0; i <= 34; i++) {
    const t = i / 34, u = 1 - t;
    pts.push([u * u * u * c[0][0] + 3 * u * u * t * c[1][0] + 3 * u * t * t * c[2][0] + t * t * t * c[3][0],
      u * u * u * c[0][1] + 3 * u * u * t * c[1][1] + 3 * u * t * t * c[2][1] + t * t * t * c[3][1]]);
  }
  return path(pts.map(([x, y]) => circle(x + 2, y + 5, 6)).join(''), { fill: INK, fillOpacity: 0.3 })
    + path(smooth(pts), { fill: 'none', stroke: INK, strokeWidth: 3 })
    + path(pts.map(([x, y]) => circle(x, y, 6)).join(''), { fill: 'url(#bead)', stroke: INK, strokeWidth: 2.2 })
    + path(pts.map(([x, y]) => circle(x - 2, y - 2, 1.8)).join(''), { fill: '#fff', fillOpacity: 0.9 });
}

function sunCharm(cx, cy) {
  const rays = [];
  for (let i = 0; i < 12; i++) {
    const a = ((i * 30 - 90) * Math.PI) / 180, R = i % 2 ? 56 : 66, w = 0.2;
    const tip = [cx + R * Math.cos(a), cy + R * Math.sin(a)];
    const b1 = [cx + 36 * Math.cos(a - w), cy + 36 * Math.sin(a - w)], b2 = [cx + 36 * Math.cos(a + w), cy + 36 * Math.sin(a + w)];
    rays.push(`M${P(...b1)}Q${P(cx + (R - 4) * Math.cos(a - 0.06), cy + (R - 4) * Math.sin(a - 0.06))} ${P(...tip)}Q${P(cx + (R - 4) * Math.cos(a + 0.06), cy + (R - 4) * Math.sin(a + 0.06))} ${P(...b2)}Z`);
  }
  return g({},
    // bail
    path(rr(cx - 9, cy - 84, 18, 28, 8), { fill: 'url(#metal)', stroke: INK, strokeWidth: 4 }),
    path(rays.join('') + circle(cx, cy, 42), { fill: INK, fillOpacity: 0.3, transform: 'translate(4 9)' }),
    path(rays.join(''), { fill: 'url(#ray)', stroke: INK, strokeWidth: 4.5, strokeLinejoin: 'round' }),
    path(circle(cx, cy, 42), { fill: 'url(#sun)', stroke: INK, strokeWidth: 5 }),
    path(ellipse(cx - 14, cy - 20, 13, 7), { fill: '#fff', fillOpacity: 0.85, transform: `rotate(-30 ${cx - 14} ${cy - 20})` }),
    path(`${ellipse(cx - 14, cy + 2, 4.5, 6)}${ellipse(cx + 14, cy + 2, 4.5, 6)}`, { fill: INK }),
    path(`${circle(cx - 12.5, cy - 0.5, 1.6)}${circle(cx + 15.5, cy - 0.5, 1.6)}`, { fill: '#fff' }),
    path(`M${cx - 7} ${cy + 13}Q${cx} ${cy + 20} ${cx + 7} ${cy + 13}`, { fill: 'none', stroke: INK, strokeWidth: 3.5, strokeLinecap: 'round' }),
    path(`${ellipse(cx - 25, cy + 13, 7, 4)}${ellipse(cx + 25, cy + 13, 7, 4)}`, { fill: '#ff8f9a', fillOpacity: 0.75 }));
}

// ---- screen bezel + care icons ------------------------------------------------------------------
function icon(kind, cx, cy, col) {
  const s = 13;
  switch (kind) {
    case 'food': // little apple
      return path(`M${cx} ${cy - s * 0.45}C${cx - s * 0.5} ${cy - s * 0.85} ${cx - s} ${cy - s * 0.45} ${cx - s} ${cy + s * 0.1}C${cx - s} ${cy + s * 0.7} ${cx - s * 0.45} ${cy + s} ${cx} ${cy + s * 0.82}`
        + `C${cx + s * 0.45} ${cy + s} ${cx + s} ${cy + s * 0.7} ${cx + s} ${cy + s * 0.1}C${cx + s} ${cy - s * 0.45} ${cx + s * 0.5} ${cy - s * 0.85} ${cx} ${cy - s * 0.45}Z`, { fill: col })
        + path(`M${cx} ${cy - s * 0.45}Q${cx + 1} ${cy - s} ${cx + 4} ${cy - s * 1.1}`, { fill: 'none', stroke: col, strokeWidth: 3, strokeLinecap: 'round' })
        + path(ellipse(cx + 8, cy - s * 0.95, 6, 3.2), { fill: col, transform: `rotate(-25 ${cx + 8} ${cy - s * 0.95})` });
    case 'moon':
      return path(`M${cx + 4} ${cy - s}A${s} ${s} 0 1 0 ${cx + 4} ${cy + s}A${s * 1.1} ${s * 1.1} 0 0 1 ${cx + 4} ${cy - s}Z`, { fill: col })
        + path(sparkle(cx + 12, cy - 9, 5, 0.2), { fill: col });
    case 'star': return path(star(cx, cy + 1, s * 1.1, s * 0.48), { fill: col, stroke: col, strokeWidth: 3, strokeLinejoin: 'round' });
    case 'wash': return path(drop(cx, cy + 5, s * 0.75, 1.75), { fill: col }) + path(ellipse(cx - 4, cy + 3, 2.4, 4), { fill: '#fff', fillOpacity: 0.7 });
    case 'heart': return path(heart(cx, cy, s * 0.95), { fill: col });
    default: return path(rr(cx - s * 0.32, cy - s, s * 0.64, s * 2, 3) + rr(cx - s, cy - s * 0.32, s * 2, s * 0.64, 3), { fill: col });
  }
}

function bezel() {
  const holeD = rr(hole.x, hole.y, hole.w, hole.h, radius);
  const ox = hole.x - BZ, oy = hole.y - BZ, ow = hole.w + 2 * BZ, oh = hole.h + 2 * BZ, orad = 100;
  const top = hole.y - BZ / 2 - 8, bot = hole.y + hole.h + BZ / 2 + 8;
  const icons = [['food', 390, top, '#ff9a8f'], ['moon', 500, top, '#f7c948'], ['star', 610, top, '#f7c948'],
    ['wash', 390, bot, '#6cc0ff'], ['heart', 500, bot, '#ff7f9c'], ['medic', 610, bot, '#5fd3a8']];
  const dots = [[445, top], [555, top], [445, bot], [555, bot]].map(([x, y]) => circle(x, y, 3)).join('');
  return g({},
    path(rr(ox + 4, oy + 12, ow, oh, orad), { fill: INK, fillOpacity: 0.35 }),
    path(rr(ox, oy, ow, oh, orad), { fill: 'url(#pearlEdge)', stroke: INK, strokeWidth: 6 }),
    path(rr(ox + 8, oy + 8, ow - 16, oh - 16, orad - 8), { fill: 'url(#pearl)' }),
    path(rr(ox + 8, oy + 8, ow - 16, oh - 16, orad - 8), { fill: 'url(#pearlSheen)' }),
    // printed care icons
    icons.map(([k, x, y, c]) => icon(k, x, y, c)).join(''),
    path(dots, { fill: '#b9c3ea' }),
    // recessed screen well
    path(rr(hole.x - 16, hole.y - 16, hole.w + 32, hole.h + 32, radius + 14), { fill: 'url(#well)', stroke: '#8f9bd0', strokeWidth: 3 }),
    path(rr(hole.x - 16, hole.y - 16, hole.w + 32, hole.h + 32, radius + 14), { fill: 'none', stroke: INK, strokeOpacity: 0.6, strokeWidth: 2, transform: 'translate(0 -2)' }),
    lip(holeD, '#000', [[7, 0.3], [3, 0.6]]),
    path(`M${ox + 18} ${oy + orad + 60}V${oy + orad}Q${ox + 18} ${oy + 18} ${ox + orad} ${oy + 18}H${ox + orad + 8}`, { fill: 'none', stroke: '#fff', strokeOpacity: 0.95, strokeWidth: 7, strokeLinecap: 'round' }));
}

function rainButton(cx, cy, col) {
  const d = drop(cx, cy, 34, 1.65);
  return path(drop(cx + 3, cy + 10, 34, 1.65), { fill: INK, fillOpacity: 0.4 })
    + path(d, { fill: `url(#btn-${col})`, stroke: INK, strokeWidth: 6, strokeLinejoin: 'round' })
    + path(ellipse(cx - 13, cy - 14, 8, 14), { fill: '#fff', fillOpacity: 0.75, transform: `rotate(18 ${cx - 13} ${cy - 14})` })
    + path(circle(cx + 15, cy + 12, 4), { fill: '#fff', fillOpacity: 0.55 });
}

function draw() {
  const list = puffs(), CLOUD = cloudPath(list);
  const defs = [
    lg('cloud', [0, 0, 0, 1], [[0, '#d6f1ff', 0.66], [0.45, '#8fd2ff', 0.56], [1, '#4b8fe6', 0.76]]),
    rg('cloudRim', [0.5, 0.48, 0.58], [[0.72, '#fff', 0], [1, '#3a6fd0', 0.4]]),
    lg('gloss', [0, 0, 0, 1], [[0, '#fff', 0.8], [1, '#fff', 0]]),
    rg('rosy', [0.5, 0.5, 0.5], [[0, '#ff9ab5', 0.6], [1, '#ff9ab5', 0]]),
    lg('pearlEdge', [0, 0, 1, 1], [[0, '#ffffff'], [0.5, '#c9d4f6'], [1, '#8597d6']]),
    lg('pearl', [0, 0, 1, 1], [[0, '#f7f8ff'], [0.5, '#dce3fa'], [1, '#aebcec']]),
    lg('pearlSheen', [0, 0, 1, 1], [[0.2, '#ffd9ef', 0], [0.5, '#ffd9ef', 0.35], [0.62, '#c8f1ff', 0.3], [0.85, '#c8f1ff', 0]]),
    lg('well', [0, 0, 0, 1], [[0, '#1b2350'], [1, '#2a3570']]),
    lg('metal', [0, 0, 1, 1], [[0, '#ffffff'], [0.5, '#c9d0ea'], [1, '#7f89b8']]),
    rg('bead', [0.4, 0.35, 0.7], [[0, '#ffffff'], [1, '#9aa4cf']]),
    rg('sun', [0.4, 0.35, 0.75], [[0, '#fff6c2'], [0.6, '#ffd84a'], [1, '#ffb43a']]),
    lg('ray', [0, 0, 0, 1], [[0, '#ffcf5c'], [1, '#ff9f45']]),
    rg('btn-sun', [0.4, 0.55, 0.8], [[0, '#fff6c9'], [1, '#ffc93a']]),
    rg('btn-coral', [0.4, 0.55, 0.8], [[0, '#ffe0d8'], [1, '#ff6f61']]),
    rg('btn-mint', [0.4, 0.55, 0.8], [[0, '#dcfff1'], [1, '#3fd09c']]),
    rg('led', [0.5, 0.5, 0.5], [[0, '#ffffff'], [0.35, '#7fd6ff'], [1, '#7fd6ff', 0]]),
    rg('floor', [0.5, 0.5, 0.5], [[0, INK, 0.38], [1, INK, 0]]),
    `<clipPath id="cloudClip"><path d="${CLOUD}"/></clipPath>`,
    '<style>.vcp-led{animation:vcp-blink 2.6s steps(1) infinite}@keyframes vcp-blink{0%,62%{opacity:1}70%{opacity:.25}78%{opacity:1}86%{opacity:.25}94%{opacity:1}}'
      + '@media (prefers-reduced-motion:reduce){*{animation:none!important}}</style>',
  ].join('');

  // glitter inside the clear plastic, kept off the bezel
  const rnd = rng(31), glitter = [], twinkles = [];
  for (let i = 0; i < 110; i++) {
    const x = 60 + rnd() * 880, y = 190 + rnd() * 900;
    if (x > hole.x - BZ - 14 && x < hole.x + hole.w + BZ + 14 && y > hole.y - BZ - 14 && y < hole.y + hole.h + BZ + 14) continue;
    if (i % 9 === 0) twinkles.push(sparkle(x, y, 7 + rnd() * 6)); else glitter.push(circle(x, y, 1.4 + rnd() * 2.4));
  }

  // puff shading: a bright rim on the lit (upper-left) side of every puff, a soft shade on the lower side
  const lit = [], shade = [];
  for (const p of list) {
    const a0 = (Math.atan2(p.y0 - p.cy, p.x0 - p.cx) * 180) / Math.PI;
    let a1 = (Math.atan2(p.y1 - p.cy, p.x1 - p.cx) * 180) / Math.PI;
    while (a1 < a0) a1 += 360;
    const mid = (a0 + a1) / 2, span = a1 - a0;
    const dir = ((mid % 360) + 360) % 360; // where the puff faces
    const facesLight = dir > 150 && dir < 330;
    if (facesLight) lit.push(arcD(p.cx, p.cy, p.r - 18, a0 + span * 0.2, a1 - span * 0.2));
    else shade.push(arcD(p.cx, p.cy, p.r - 14, a0 + span * 0.12, a1 - span * 0.12));
  }
  // inner "crease" lines between bottom puffs make the cumulus read as stacked lobes
  const creases = list.slice(9).map((p) => arcD(p.cx, p.cy - 26, p.r * 0.92, 205, 335));

  const body = [
    path(ellipse(500, 1140, 360, 24), { fill: 'url(#floor)' }),
    lanyard(),
    clasp(),
    // clear cloud body
    path(CLOUD, { fill: 'url(#cloud)' }),
    g({ clipPath: 'url(#cloudClip)' },
      path(ellipse(800, 1020, 260, 170), { fill: 'url(#rosy)', fillOpacity: 0.6 }),
      path(CLOUD, { fill: 'url(#cloudRim)' }),
      path(creases.join(''), { fill: 'none', stroke: '#3a6fd0', strokeOpacity: 0.18, strokeWidth: 8, strokeLinecap: 'round' }),
      path(shade.join(''), { fill: 'none', stroke: '#3a6fd0', strokeOpacity: 0.16, strokeWidth: 16, strokeLinecap: 'round' }),
      path(lit.join(''), { fill: 'none', stroke: '#fff', strokeOpacity: 0.55, strokeWidth: 10, strokeLinecap: 'round' }),
      path(glitter.join(''), { fill: '#fff', fillOpacity: 0.85 }),
      path(twinkles.join(''), { fill: '#fff6c2', fillOpacity: 0.9 }),
      path('M104 660C110 500 210 360 380 316C250 390 180 500 156 670Z', { fill: 'url(#gloss)' })),
    path(CLOUD, { fill: 'none', stroke: INK, strokeWidth: 9, strokeLinejoin: 'round' }),
    tab(),
    // cheeks
    bezel(),
    // controls: three raindrop buttons, a blinking raindrop LED and a speaker
    rainButton(380, 978, 'sun'), rainButton(500, 1004, 'coral'), rainButton(620, 978, 'mint'),
    path(circle(272, 974, 30), { fill: 'url(#led)', class: 'vcp-led' }),
    path(drop(272, 982, 13, 1.7), { fill: '#bfeaff', stroke: INK, strokeWidth: 4, class: 'vcp-led' }),
    path(ellipse(268, 980, 3, 5), { fill: '#fff', class: 'vcp-led' }),
    path([[715, 962], [741, 962], [728, 982], [702, 982], [754, 982]].map(([x, y]) => circle(x, y, 5.5)).join(''), { fill: INK, fillOpacity: 0.5 }),
    // charm
    ballChain(),
    sunCharm(SUN.x, SUN.y),
    // sparkles around
    path(sparkle(60, 290, 24), { fill: '#fff6c2', stroke: INK, strokeWidth: 3 }),
    path(sparkle(948, 1010, 20), { fill: '#b7f0ff', stroke: INK, strokeWidth: 3 }),
    path(sparkle(64, 1100, 16), { fill: '#ffc6d9', stroke: INK, strokeWidth: 3 }),
    path(star(962, 170, 15, 6.5), { fill: '#ffe372', stroke: INK, strokeWidth: 3, strokeLinejoin: 'round' }),
    path(heart(110, 200, 13), { fill: '#ff8f9a', stroke: INK, strokeWidth: 3 }),
  ].join('\n');
  return { defs, body };
}

module.exports = {
  W, H, hole, radius, draw,
  meta: { name: 'Cloud Pal', theme: 'sky', rarity: 'rare', translucent: true,
    desc: 'A puffy clear-blue cloud pet on a rainbow strap, with raindrop buttons and a sunny charm along for the ride.',
    tags: ['virtual-pet', 'cloud', 'keychain', 'pastel', 'clear'], collection: 'pocket-pals', license: 'CC-BY-4.0' },
};
