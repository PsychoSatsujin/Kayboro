'use strict';
// Toxic Drip: a chunky deep-navy monitor wearing a pale hooded cloak. Neon-green slime has splashed over
// the peak of the hood and oozes across its brim, dripping onto the monitor's top bezel and running down
// the cloak; the monitor stands in a bubbling puddle on a vented foot, glowing toadstools sprout on one
// side and a little glass tank of goo bubbles on the other, with splatters flung all around.
// Optional animation: bubbles rise, drops fall from the drips, the vents and tank glow pulse.
const L = require('../lib');
const { rr, path, g, lg, rg, circle, ellipse, sparkle, glowStroke, rng, lip, n, P } = L;

const W = 1500, H = 1320, hole = { x: 430, y: 480, w: 640, h: 480 }, radius = 16;
const CX = W / 2;
const INK = '#060b30';
const GREEN = '#46f53a', LIME = '#b8ff5a';
const MON = { x: 320, y: 336, w: 860, h: 744, r: 64 };
const ARCH = { cx: 750, cy: 616, rx: 470, ry: 290 };
const archY = (x) => ARCH.cy - ARCH.ry * Math.sqrt(Math.max(0, 1 - ((x - ARCH.cx) / ARCH.rx) ** 2));
const HOOD_D = 'M934 24C984 70 1062 160 1124 268C1206 380 1246 506 1266 642C1294 802 1334 962 1376 1122C1244 1152 1134 1126 1012 1142'
  + 'C882 1158 620 1158 490 1142C368 1126 258 1152 124 1122C166 962 206 802 234 642C258 502 298 380 380 280C520 130 720 48 934 24Z';
const FRONT_CLIP = `M0 0H${W}V${ARCH.cy}H${ARCH.cx + ARCH.rx}A${ARCH.rx} ${ARCH.ry} 0 0 0 ${ARCH.cx - ARCH.rx} ${ARCH.cy}H0Z`;
/** The hood opening's rim, inset by off: the arch over the monitor, flaring outward like a cloak below. */
const brim = (off = 0, flare = 40) => {
  const xl = ARCH.cx - ARCH.rx + off, xr = ARCH.cx + ARCH.rx - off, y = 1100 - off * 0.5;
  return `M${xl - flare} ${y}C${n(xl - flare * 0.55)} 920 ${xl} 780 ${xl} ${ARCH.cy}A${ARCH.rx - off} ${ARCH.ry - off} 0 0 1 ${xr} ${ARCH.cy}`
    + `C${xr} 780 ${n(xr + flare * 0.55)} 920 ${xr + flare} ${y}`;
};
const BRIM_D = brim();

/**
 * Smooth closed blob through points (quadratic midpoint spline). Always wound counter-clockwise on screen,
 * like lib circles and drip(), so overlapping goo merged into one path never cancels out (nonzero fill).
 */
function blob(list) {
  const m = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  let area = 0;
  for (let i = 0; i < list.length; i++) { const [x1, y1] = list[i], [x2, y2] = list[(i + 1) % list.length]; area += x1 * y2 - x2 * y1; }
  const pts = area > 0 ? [...list].reverse() : list;
  let d = `M${P(...m(pts[pts.length - 1], pts[0]))}`;
  for (let i = 0; i < pts.length; i++) d += `Q${P(...pts[i])} ${P(...m(pts[i], pts[(i + 1) % pts.length]))}`;
  return `${d}Z`;
}

/** Irregular splat with droplet arms. */
function splat(cx, cy, R, seed, arms = 6) {
  const rnd = rng(seed), pts = [], N = arms * 3;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2 + rnd() * 0.2, arm = i % 3 === 0, r = R * (arm ? 1.15 + rnd() * 0.45 : 0.72 + rnd() * 0.22);
    pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return blob(pts);
}

/** Hanging drip from (x, y0): neck of half-width w, length len, rounded bulb at the bottom. */
function drip(x, y0, len, w) {
  const b = w * 1.12, yb = y0 + len - b;
  return `M${P(x - w * 0.8, y0)}C${P(x - w * 0.8, y0 + len * 0.45, x - b, yb - b * 1.2, x - b, yb)}A${P(b, b)} 0 0 0 ${P(x + b, yb)}`
    + `C${P(x + b, yb - b * 1.2, x + w * 0.8, y0 + len * 0.45, x + w * 0.8, y0)}Z`;
}

/** Slime layer: filled shapes + stroked bands, outlined as one goopy mass, with cel shade and gloss. */
function slime({ fills = [], bands = [], shade = '', gloss = '', id }) {
  const F = fills.join('');
  return g({},
    glowStroke(F, GREEN, 8, [[6, 0.04], [3.6, 0.07], [2.2, 0.1]]),
    ...bands.map(([d, w]) => path(d, { fill: 'none', stroke: INK, strokeWidth: w + 12, strokeLinecap: 'round' })),
    path(F, { fill: INK, stroke: INK, strokeWidth: 12, strokeLinejoin: 'round' }),
    ...bands.map(([d, w]) => path(d, { fill: 'none', stroke: 'url(#tdSlimeS)', strokeWidth: w, strokeLinecap: 'round' })),
    path(F, { fill: 'url(#tdSlime)' }),
    g({ clipPath: `url(#${id})` }, shade),
    gloss);
}

function hoodBack() {
  const folds = 'M380 300C320 460 270 700 230 1000M520 196C430 380 360 560 330 760M1110 268C1180 430 1240 700 1290 1010M960 150C1060 300 1150 470 1196 640';
  return g({},
    path(HOOD_D, { fill: 'url(#tdHood)', stroke: INK, strokeWidth: 7, strokeLinejoin: 'round' }),
    g({ clipPath: 'url(#tdHoodClip)' },
      path('M1060 180C1200 330 1270 560 1300 760C1330 960 1380 1100 1400 1160H1500V100Z', { fill: '#7f95ea', fillOpacity: 0.55 }),
      path('M100 1160C150 960 190 800 214 640C236 500 270 400 330 320C280 440 250 600 236 760C224 900 210 1040 214 1160Z', { fill: '#fff', fillOpacity: 0.6 }),
      path(folds, { fill: 'none', stroke: '#6f86e0', strokeOpacity: 0.55, strokeWidth: 6, strokeLinecap: 'round' }),
      path('M120 1122C258 1152 368 1126 490 1142C620 1158 882 1158 1012 1142C1134 1126 1244 1152 1380 1122', { fill: 'none', stroke: '#6f86e0', strokeOpacity: 0.6, strokeWidth: 10 })));
}

function hoodFront() {
  return g({},
    g({ clipPath: 'url(#tdFrontClip)' },
      path(HOOD_D, { fill: 'url(#tdHood)' }),
      g({ clipPath: 'url(#tdHoodClip)' },
        path('M1060 180C1200 330 1270 560 1300 760H1500V100Z', { fill: '#7f95ea', fillOpacity: 0.55 }),
        path('M640 70C560 100 470 160 410 240', { fill: 'none', stroke: '#fff', strokeWidth: 12, strokeLinecap: 'round' }),
        path('M928 34C900 70 880 110 872 150', { fill: 'none', stroke: '#6f86e0', strokeOpacity: 0.6, strokeWidth: 6, strokeLinecap: 'round' }),
        path('M380 300C330 420 300 520 280 620M960 150C1060 300 1150 470 1196 640', { fill: 'none', stroke: '#6f86e0', strokeOpacity: 0.55, strokeWidth: 6, strokeLinecap: 'round' })),
      path(HOOD_D, { fill: 'none', stroke: INK, strokeWidth: 7, strokeLinejoin: 'round' })),
    // rolled brim of the hood: ink, cloth, the green glow it catches from the screen side
    path(BRIM_D, { fill: 'none', stroke: INK, strokeWidth: 62, strokeLinejoin: 'round' }),
    path(BRIM_D, { fill: 'none', stroke: 'url(#tdBrim)', strokeWidth: 50, strokeLinejoin: 'round' }),
    path(brim(14, 34), { fill: 'none', stroke: LIME, strokeOpacity: 0.55, strokeWidth: 6 }),
    path(`M${ARCH.cx - ARCH.rx - 52} 1080C${ARCH.cx - ARCH.rx - 34} 920 ${ARCH.cx - ARCH.rx - 12} 780 ${ARCH.cx - ARCH.rx - 12} ${ARCH.cy}`
      + `A${ARCH.rx + 12} ${ARCH.ry + 12} 0 0 1 ${ARCH.cx - 120} ${ARCH.cy - ARCH.ry - 8}`, { fill: 'none', stroke: '#fff', strokeWidth: 6, strokeLinecap: 'round' }));
}

function monitor() {
  const m = MON, holeD = rr(hole.x, hole.y, hole.w, hole.h, radius);
  const slots = [];
  for (let i = 0; i < 6; i++) slots.push(rr(930 + i * 30, 1000, 14, 44, 7));
  const screws = [[m.x + 36, m.y + m.h - 36], [m.x + m.w - 36, m.y + m.h - 36]];
  return g({},
    path(rr(m.x + 8, m.y + 14, m.w, m.h, m.r), { fill: INK, fillOpacity: 0.35 }),
    path(rr(m.x, m.y, m.w, m.h, m.r), { fill: 'url(#tdNavy)', stroke: INK, strokeWidth: 7 }),
    path(`M${m.x + 12} ${m.y + 260}V${m.y + m.h - 70}Q${m.x + 12} ${m.y + m.h - 12} ${m.x + 70} ${m.y + m.h - 12}H${m.x + 520}`, { fill: 'none', stroke: GREEN, strokeOpacity: 0.85, strokeWidth: 5, strokeLinecap: 'round' }),
    path(`M${m.x + m.w - 12} ${m.y + 300}V${m.y + m.h - 90}`, { fill: 'none', stroke: '#5f74ff', strokeOpacity: 0.5, strokeWidth: 4, strokeLinecap: 'round' }),
    // hood shadow across the top bezel
    path(rr(m.x, m.y, m.w, 170, [m.r, m.r, 0, 0]), { fill: 'url(#tdUnderHood)' }),
    // screen bezel: dark glass, one thin green line
    path(rr(hole.x - 36, hole.y - 36, hole.w + 72, hole.h + 72, radius + 28), { fill: '#05081f', stroke: '#2a3590', strokeWidth: 3 }),
    path(rr(hole.x - 20, hole.y - 20, hole.w + 40, hole.h + 40, radius + 16), { fill: 'none', stroke: GREEN, strokeOpacity: 0.45, strokeWidth: 2.5 }),
    lip(holeD, '#000', [[7, 0.3], [3, 0.6]]),
    path(`M${hole.x - 26} ${hole.y + 100}V${hole.y + 20}Q${hole.x - 26} ${hole.y - 26} ${hole.x + 20} ${hole.y - 26}H${hole.x + 120}`, { fill: 'none', stroke: '#8fa0ff', strokeOpacity: 0.35, strokeWidth: 4, strokeLinecap: 'round' }),
    // bottom bezel: power light, knobs, glowing vent slots, screws
    g({ class: 'td-pulse' }, path(circle(410, 1022, 20), { fill: 'url(#tdGlow)' })),
    path(circle(410, 1022, 9), { fill: LIME, stroke: INK, strokeWidth: 3 }),
    path(`${circle(460, 1022, 13)}${circle(500, 1022, 13)}`, { fill: 'url(#tdKnob)', stroke: INK, strokeWidth: 3 }),
    path('M460 1012V1020M500 1012V1020', { stroke: INK, strokeWidth: 3, strokeLinecap: 'round' }),
    g({ class: 'td-pulse' }, path(slots.join(''), { fill: 'url(#tdVent)' })),
    path(slots.join(''), { fill: 'none', stroke: INK, strokeWidth: 3 }),
    ...screws.map(([x, y]) => path(circle(x, y, 8), { fill: 'url(#tdKnob)', stroke: INK, strokeWidth: 2.5 }) + path(`M${x - 4} ${y - 4}L${x + 4} ${y + 4}`, { stroke: INK, strokeWidth: 2, strokeLinecap: 'round' })));
}

function stand() {
  const slots = [];
  for (let i = 0; i < 7; i++) slots.push(rr(612 + i * 40, 1150, 18, 26, 9));
  return g({},
    path(rr(640, 1060, 220, 70, 12), { fill: 'url(#tdNavyV)', stroke: INK, strokeWidth: 6 }),
    path(rr(470, 1118, 560, 86, 40), { fill: 'url(#tdNavyV)', stroke: INK, strokeWidth: 6 }),
    path('M510 1132H990', { stroke: '#5f74ff', strokeOpacity: 0.6, strokeWidth: 4, strokeLinecap: 'round' }),
    g({ class: 'td-pulse' }, path(slots.join(''), { fill: 'url(#tdVent)' })),
    path(slots.join(''), { fill: 'none', stroke: INK, strokeWidth: 3 }));
}

function puddle() {
  const d = blob([[300, 1230], [420, 1196], [600, 1206], [760, 1192], [960, 1204], [1140, 1194], [1250, 1222], [1230, 1262], [1040, 1276], [760, 1284], [480, 1278], [320, 1262]]);
  return g({},
    path(ellipse(CX, 1250, 700, 60), { fill: 'url(#tdFloorGlow)' }),
    path(d, { fill: INK, stroke: INK, strokeWidth: 12, strokeLinejoin: 'round' }),
    path(d, { fill: 'url(#tdPuddle)' }),
    path('M380 1222C480 1208 600 1214 700 1206', { fill: 'none', stroke: '#e6ffb8', strokeWidth: 5, strokeLinecap: 'round' }),
    path(`${ellipse(560, 1254, 40, 9)}${ellipse(1040, 1250, 30, 7)}`, { fill: '#0a7a3a', fillOpacity: 0.5 }));
}

function bubbles(list, cls) {
  return g({ class: cls }, path(list.map(([x, y, r]) => circle(x, y, r)).join(''), { fill: '#e6ffb8', fillOpacity: 0.35, stroke: '#f4ffe0', strokeWidth: 2.5 }),
    path(list.map(([x, y, r]) => circle(x - r * 0.35, y - r * 0.35, r * 0.25)).join(''), { fill: '#fff' }));
}

function toadstools() {
  const one = (x, y, s, rot) => g({ transform: `translate(${x} ${y}) rotate(${rot}) scale(${s})` },
    path('M-14 0C-16 -30 -12 -56 -8 -70H8C12 -56 16 -30 14 0Z', { fill: 'url(#tdStem)', stroke: INK, strokeWidth: 5, strokeLinejoin: 'round' }),
    path(circle(0, -80, 66), { fill: 'url(#tdGlow)' }),
    path('M-62 -64C-62 -110 -30 -132 0 -132C30 -132 62 -110 62 -64C40 -72 -40 -72 -62 -64Z', { fill: 'url(#tdCap)', stroke: INK, strokeWidth: 5, strokeLinejoin: 'round' }),
    path(`${circle(-26, -100, 9)}${circle(12, -114, 7)}${circle(32, -88, 8)}${circle(-6, -84, 5)}`, { fill: '#e6ffb8' }),
    path('M-46 -84C-42 -104 -26 -118 -8 -122', { fill: 'none', stroke: '#fff', strokeOpacity: 0.8, strokeWidth: 5, strokeLinecap: 'round' }));
  return g({}, one(196, 1236, 1, -8), one(282, 1250, 0.68, 10), one(134, 1258, 0.55, -18));
}

function tank() {
  const x = 1250, y = 960, w = 132, h = 230;
  return g({},
    // feed tube into the monitor's side
    path(`M${x + w / 2} ${y}C${x + w / 2} ${y - 80} ${MON.x + MON.w + 60} ${y - 130} ${MON.x + MON.w - 4} ${y - 150}`, { fill: 'none', stroke: INK, strokeWidth: 30, strokeLinecap: 'round' }),
    path(`M${x + w / 2} ${y}C${x + w / 2} ${y - 80} ${MON.x + MON.w + 60} ${y - 130} ${MON.x + MON.w - 4} ${y - 150}`, { fill: 'none', stroke: 'url(#tdTube)', strokeWidth: 18, strokeLinecap: 'round' }),
    path(`M${x + w / 2 - 4} ${y - 10}C${x + w / 2 - 6} ${y - 70} ${MON.x + MON.w + 50} ${y - 122} ${MON.x + MON.w + 10} ${y - 140}`, { fill: 'none', stroke: '#e6ffb8', strokeOpacity: 0.8, strokeWidth: 4, strokeLinecap: 'round', strokeDasharray: '10 18' }),
    path(rr(x + 6, y + 14, w, h, 30), { fill: INK, fillOpacity: 0.35 }),
    path(rr(x, y, w, h, 30), { fill: 'url(#tdTankGlass)', stroke: INK, strokeWidth: 6 }),
    g({ class: 'td-pulse' }, path(rr(x + 14, y + 60, w - 28, h - 80, 18), { fill: 'url(#tdTankGoo)' })),
    path(`M${x + 14} ${y + 80}Q${x + w / 2} ${y + 60} ${x + w - 14} ${y + 80}`, { fill: 'none', stroke: '#e6ffb8', strokeWidth: 4, strokeLinecap: 'round' }),
    bubbles([[x + 44, y + 150, 9], [x + 80, y + 120, 6], [x + 62, y + 186, 12], [x + 96, y + 170, 5]], 'td-rise'),
    path(`M${x + 22} ${y + 40}V${y + h - 40}`, { stroke: '#fff', strokeOpacity: 0.6, strokeWidth: 8, strokeLinecap: 'round' }),
    path(rr(x - 10, y - 14, w + 20, 34, 12), { fill: 'url(#tdKnob)', stroke: INK, strokeWidth: 5 }),
    path(rr(x - 10, y + h - 20, w + 20, 34, 12), { fill: 'url(#tdKnob)', stroke: INK, strokeWidth: 5 }),
    path(`M${x + 4} ${y - 4}H${x + w - 4}`, { stroke: '#fff', strokeOpacity: 0.7, strokeWidth: 4, strokeLinecap: 'round' }),
    // warning stripes on the base band
    g({ clipPath: 'url(#tdTankBand)' }, path([0, 1, 2, 3, 4, 5].map((i) => `M${x - 10 + i * 34} ${y + h + 14}L${x + 10 + i * 34} ${y + h - 20}H${x + 26 + i * 34}L${x + 6 + i * 34} ${y + h + 14}Z`).join(''), { fill: '#ffd166' })));
}

function draw() {
  // --- the slime over the hood ---------------------------------------------------------------------
  const topBlob = blob([[410, 470], [430, 360], [520, 300], [560, 210], [640, 150], [700, 186], [760, 120], [830, 136], [870, 210], [960, 236],
    [1010, 300], [1086, 360], [1096, 470], [900, 380], [750, 360], [600, 380]]);
  const bandD = `M${ARCH.cx - ARCH.rx + 12} ${n(archY(ARCH.cx - ARCH.rx + 12))}A${ARCH.rx - 4} ${ARCH.ry - 4} 0 0 1 ${ARCH.cx + ARCH.rx - 12} ${n(archY(ARCH.cx + ARCH.rx - 12))}`;
  // drips over the screen stop at least 46 units above the opening (calm ring); the outer ones run long
  const tipMax = (x) => (x > hole.x - 50 && x < hole.x + hole.w + 50 ? hole.y - 46 : 1e9);
  const topDrips = [[352, 210, 18], [432, 90, 13], [530, 999, 16], [612, 60, 11], [700, 999, 19], [792, 70, 12], [905, 999, 15], [1000, 56, 11],
    [1076, 120, 13], [1150, 230, 18]].map(([x, len, w]) => { const y0 = archY(x) + 6; return [x, y0, Math.min(len, tipMax(x) - y0), w]; });
  const drips = [...topDrips.map(([x, y0, len, w]) => drip(x, y0, len, w)), drip(ARCH.cx - ARCH.rx + 6, 556, 230, 15), drip(ARCH.cx + ARCH.rx - 6, 556, 170, 13)];
  // bumps along the band's upper edge so it reads as goo, not a pipe
  const bumps = [];
  for (const [x, r] of [[300, 30], [380, 34], [470, 30], [880, 34], [980, 30], [1060, 34], [1150, 28], [1200, 30]]) bumps.push(circle(x, archY(x) - 20, r));
  // slime streaks down the cloak
  const capeL = blob([[216, 530], [252, 490], [300, 500], [306, 548], [262, 576], [226, 572]]);
  const capeR = blob([[1196, 500], [1244, 488], [1284, 526], [1282, 570], [1244, 580], [1206, 548]]);
  const capeDrips = [drip(230, 540, 160, 13), drip(1268, 548, 104, 11), splat(206, 880, 15, 31, 6), splat(1300, 830, 13, 33, 6)];
  // drips off the monitor's lower corners into the puddle
  const yb = MON.y + MON.h;
  // goo coating the monitor's two lower corners, dripping off the rounded edge
  const corner = (() => {
    const c = [MON.x + MON.r, MON.y + MON.h - MON.r], out = [], inn = [], thick = [16, 26, 34, 30, 24, 30, 22];
    out.push([MON.x - 4, c[1] - 44]);
    for (let i = 0; i <= 6; i++) {
      const a = Math.PI - (i / 6) * (Math.PI / 2), R = MON.r + 4, r = MON.r - thick[i];
      out.push([c[0] + R * Math.cos(a), c[1] + R * Math.sin(a)]);
      inn.unshift([c[0] + r * Math.cos(a), c[1] + r * Math.sin(a)]);
    }
    out.push([c[0] + 70, yb + 4]);
    return [...out, [c[0] + 74, yb - 14], ...inn, [MON.x + 12, c[1] - 40]];
  })();
  const lowDrips = [blob(corner), drip(372, yb, 96, 13), blob(corner.map(([x, y]) => [W - x, y])), drip(W - 372, yb, 76, 12)];

  const topSlime = slime({
    id: 'tdTopClip',
    fills: [topBlob, ...bumps, ...drips],
    bands: [[bandD, 58]],
    shade: path(`M300 ${ARCH.cy}A${ARCH.rx} ${ARCH.ry + 40} 0 0 1 1200 ${ARCH.cy}V900H300Z`, { fill: '#0a8a3a', fillOpacity: 0.4 })
      + path(`${circle(690, 250, 26)}${circle(900, 300, 18)}${circle(560, 330, 14)}${circle(800, 220, 12)}${circle(980, 330, 10)}`, { fill: '#0a8a3a', fillOpacity: 0.25, stroke: '#e6ffb8', strokeOpacity: 0.7, strokeWidth: 3 })
      + path(`${circle(682, 242, 6)}${circle(894, 294, 4.5)}${circle(556, 326, 3.5)}${circle(796, 216, 3)}`, { fill: '#fff' }),
    gloss: path('M470 330C520 260 590 210 650 180', { fill: 'none', stroke: '#f4ffe0', strokeWidth: 12, strokeLinecap: 'round' })
      + path('M790 150C820 150 840 164 850 184', { fill: 'none', stroke: '#f4ffe0', strokeWidth: 8, strokeLinecap: 'round' })
      + path(`${ellipse(1040, 360, 14, 8)}${ellipse(560, 300, 10, 6)}`, { fill: '#f4ffe0' })
      + path(topDrips.map(([x, y0, len, w]) => ellipse(x - w * 0.42, y0 + len - w * 1.3, w * 0.28, w * 0.42)).join(''), { fill: '#f4ffe0', fillOpacity: 0.9 }),
  });
  const capeSlime = slime({
    id: 'tdCapeClip',
    fills: [capeL, capeR, ...capeDrips],
    gloss: path(`${ellipse(246, 650, 4, 7)}${ellipse(1240, 610, 3.5, 6)}${ellipse(260, 512, 8, 5)}${ellipse(1234, 512, 8, 5)}`, { fill: '#f4ffe0' }),
  });
  const lowSlime = slime({ id: 'tdLowClip', fills: lowDrips, gloss: path('M326 984C328 1024 344 1052 372 1066M1174 984C1172 1024 1156 1052 1128 1066', { fill: 'none', stroke: '#f4ffe0', strokeWidth: 5, strokeLinecap: 'round' })
      + path(`${ellipse(367, yb + 72, 4, 6)}${ellipse(W - 376, yb + 56, 3.5, 5)}`, { fill: '#f4ffe0' }) });

  // flung splatters + droplets around the outside
  const rnd = rng(17), specks = [];
  for (let i = 0; i < 40; i++) {
    const x = 20 + rnd() * 1460, y = 20 + rnd() * 1260;
    if (x > 120 && x < 1380 && y > 60) continue;
    specks.push(circle(x, y, 3 + rnd() * 6));
  }
  const splats = [splat(120, 300, 26, 3), splat(1390, 220, 22, 5, 5), splat(1440, 640, 18, 8, 5), splat(70, 760, 16, 11, 5), splat(980, 70, 14, 2, 5), splat(1240, 90, 10, 6, 4),
    splat(360, 110, 12, 9, 4), splat(600, 700 - 640, 8, 4, 4)];
  const hoodSpots = [splat(200, 1060, 10, 25, 6), splat(404, 330, 12, 27, 6), splat(1120, 320, 14, 29, 6), splat(1000, 112, 9, 35, 5), splat(470, 228, 7, 37, 5)];

  const defs = [
    '<style>.td-pulse{animation:tdPulse 2.6s ease-in-out infinite}@keyframes tdPulse{0%,100%{opacity:1}50%{opacity:.55}}'
      + '.td-rise{animation:tdRise 2.8s ease-in infinite}@keyframes tdRise{0%{transform:translateY(16px);opacity:0}25%{opacity:1}100%{transform:translateY(-34px);opacity:0}}'
      + '.td-drop,.td-drop2{animation:tdDrop 2.4s ease-in infinite}.td-drop2{animation-delay:-1.1s}@keyframes tdDrop{0%,40%{transform:translateY(0);opacity:0}45%{opacity:1}100%{transform:translateY(70px);opacity:0}}'
      + '@media (prefers-reduced-motion:reduce){*{animation:none!important}}</style>',
    lg('tdHood', [0, 0, 1, 1], [[0, '#ffffff'], [0.45, '#e6f4ff'], [1, '#b9c8f6']]),
    lg('tdBrim', [0, 0, 0, 1], [[0, '#ffffff'], [0.6, '#dcebff'], [1, '#aebdf0']]),
    lg('tdNavy', [0, 0, 0.3, 1], [[0, '#26318a'], [0.45, '#151d5e'], [1, '#0a0f3a']]),
    lg('tdNavyV', [0, 0, 0, 1], [[0, '#26318a'], [1, '#0c1242']]),
    lg('tdUnderHood', [0, 0, 0, 1], [[0, '#000', 0.38], [1, '#000', 0]]),
    lg('tdSlime', [0, 0, 0, 1], [[0, '#b8ff5a'], [0.35, GREEN], [1, '#18c93c']]),
    lg('tdSlimeS', [0, 0, 0, 1], [[0, '#b8ff5a'], [0.5, GREEN], [1, '#22d43c']]),
    rg('tdGlow', [0.5, 0.5, 0.5], [[0, LIME, 0.38], [1, LIME, 0]]),
    lg('tdVent', [0, 0, 0, 1], [[0, '#e6ffb8'], [0.5, GREEN], [1, '#109a3a']]),
    rg('tdKnob', [0.38, 0.32, 0.8], [[0, '#8fa0ff'], [0.6, '#3a46a8'], [1, '#141a52']]),
    lg('tdPuddle', [0, 0, 0, 1], [[0, '#b8ff5a'], [0.4, GREEN], [1, '#139a3a']]),
    rg('tdFloorGlow', [0.5, 0.5, 0.5], [[0, GREEN, 0.3], [0.6, GREEN, 0.1], [1, GREEN, 0]]),
    lg('tdStem', [0, 0, 1, 0], [[0, '#e6f4ff'], [1, '#9fb0ee']]),
    rg('tdCap', [0.4, 0.3, 0.85], [[0, '#d9ff8a'], [0.5, GREEN], [1, '#0f8a3a']]),
    lg('tdTube', [0, 0, 1, 0], [[0, '#18c93c'], [0.5, GREEN], [1, '#18c93c']]),
    lg('tdTankGlass', [0, 0, 1, 0], [[0, '#2a3590'], [0.5, '#141a52'], [1, '#0a0f3a']]),
    lg('tdTankGoo', [0, 0, 0, 1], [[0, '#b8ff5a'], [0.5, GREEN], [1, '#109a3a']]),
    `<clipPath id="tdHoodClip"><path d="${HOOD_D}"/></clipPath>`,
    `<clipPath id="tdFrontClip"><path d="${FRONT_CLIP}"/></clipPath>`,
    `<clipPath id="tdTopClip"><path d="${[topBlob, ...drips].join('')}"/></clipPath>`,
    `<clipPath id="tdCapeClip"><path d="${[capeL, capeR, ...capeDrips].join('')}"/></clipPath>`,
    `<clipPath id="tdLowClip"><path d="${lowDrips.join('')}"/></clipPath>`,
    `<clipPath id="tdTankBand"><path d="${rr(1240, 1170, 152, 34, 12)}"/></clipPath>`,
  ].join('');

  const body = [
    path(specks.join(''), { fill: GREEN }),
    slime({ id: 'tdLowClip', fills: splats }),
    puddle(),
    hoodBack(),
    stand(),
    monitor(),
    lowSlime,
    hoodFront(),
    capeSlime,
    topSlime,
    slime({ id: 'tdLowClip', fills: hoodSpots }),
    bubbles([[520, 1236, 9], [700, 1246, 6], [880, 1238, 11], [1020, 1250, 7], [400, 1250, 5]], 'td-rise'),
    g({ class: 'td-drop' }, path(ellipse(372, MON.y + MON.h + 110, 9, 12), { fill: GREEN, stroke: INK, strokeWidth: 4 })),
    g({ class: 'td-drop2' }, path(ellipse(1150, topDrips[9][1] + topDrips[9][2] + 26, 8, 11), { fill: GREEN, stroke: INK, strokeWidth: 4 })),
    g({ class: 'td-drop2' }, path(ellipse(W - 372, MON.y + MON.h + 86, 8, 11), { fill: GREEN, stroke: INK, strokeWidth: 4 })),
    toadstools(),
    tank(),
    path(sparkle(1420, 420, 16), { fill: LIME }), path(sparkle(60, 520, 14), { fill: LIME }), path(sparkle(1300, 30, 12), { fill: '#e6ffb8' }),
  ].join('\n');
  return { defs, body };
}

module.exports = {
  W, H, hole, radius, draw,
  meta: {
    name: 'Toxic Drip', theme: 'horror', rarity: 'epic', translucent: false, collection: 'sci-fi-signals', license: 'CC-BY-4.0',
    desc: 'A hooded monitor oozing neon goo from every edge, standing in a bubbling puddle that glows in the dark.',
    tags: ['horror', 'slime', 'toxic', 'cyberpunk', 'neon', 'spooky'],
  },
};
