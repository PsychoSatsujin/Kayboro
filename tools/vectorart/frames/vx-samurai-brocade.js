'use strict';
// Samurai Brocade: a scroll-mount frame in deep green brocade. Gold scrolling clouds drift across the
// upper field and gold seigaiha waves fill the lower one, divided by a wave-crest line; a red piping and
// gold fillet edge the washi paper inner mat (fibres and a few gold-leaf flakes) around the screen.
// An iron mokko-shaped katana guard with gold rim, boar's-eye openwork and a gold washer caps each
// corner, and a braided black hanging cord rises from gold rings to a hook, tied in a red knot with
// two silk tassels.
const L = require('../lib');
const { rr, path, g, lg, rg, circle, ellipse, heart, tf, rng, lip, smooth, n, P } = L;

const W = 1600, H = 1180, hole = { x: 360, y: 372, w: 880, h: 495 }, radius = 4;
const INK = '#0b1a14';
const MAT = { x: hole.x - 66, y: hole.y - 66, w: hole.w + 132, h: hole.h + 132 };
const BRO = { x: hole.x - 216, y: hole.y - 216, w: hole.w + 432, h: hole.h + 432 };
const GOLD = '#e2b856';
const waveY = (x) => 700 + 18 * Math.sin(x / 70);
// [cx, cy, size, facing] of the gold scroll clouds over the upper field
const CLOUDS = [
  [360, 236, 40, 1], [640, 214, 34, -1], [1000, 230, 38, 1], [1236, 212, 32, -1],
  [196, 378, 24, 1], [1404, 392, 24, -1], [214, 520, 28, -1], [1386, 530, 28, 1], [190, 640, 20, 1], [1410, 646, 20, -1],
];

/** Spiral curl (for cloud lobes), turning `turns` times out from the centre. */
function curl(cx, cy, r, turns = 1.35, dir = 1, a0 = 0) {
  const pts = [], N = 26;
  for (let i = 0; i <= N; i++) { const t = i / N, a = a0 + dir * t * turns * Math.PI * 2, rad = r * (0.12 + 0.88 * t); pts.push([cx + rad * Math.cos(a), cy + rad * Math.sin(a)]); }
  return smooth(pts);
}

/** Auspicious scroll cloud: rounded lobes on a flat base with a trailing ribbon tail and curls inside. */
function cloud(cx, cy, s, flip = 1, grad = 'sbGold') {
  const lobes = [[-1.05, 0.15, 0.55], [-0.35, -0.32, 0.72], [0.48, -0.12, 0.6], [1.08, 0.22, 0.4]];
  const f = (x) => cx + flip * x * s, y = (v) => cy + v * s;
  let body = '';
  for (const [x, yy, r] of lobes) body += L.circle(f(x), y(yy), r * s);
  const base = `M${P(f(-1.5), y(0.42))}Q${P(f(-1.2), y(0.12), f(-0.6), y(0.3))}H${n(f(1.3))}Q${P(f(1.62), y(0.36), f(1.38), y(0.6))}H${n(f(-1.45))}Z`;
  const tail = `M${P(f(1.3), y(0.48))}C${P(f(1.9), y(0.5), f(2.3), y(0.2), f(2.7), y(0.36))}C${P(f(2.95), y(0.46), f(2.9), y(0.72), f(2.6), y(0.7))}C${P(f(2.3), y(0.66), f(2.0), y(0.7), f(1.3), y(0.62))}Z`;
  const curls = lobes.slice(0, 3).map(([x, yy, r], i) => curl(f(x), y(yy), r * s * 0.7, 1.3, flip * (i % 2 ? -1 : 1), i)).join('');
  return g({},
    path(tail, { fill: 'url(#sbGold)', stroke: INK, strokeWidth: 3.5, strokeLinejoin: 'round' }),
    path(body, { fill: 'none', stroke: INK, strokeWidth: 7, strokeLinejoin: 'round' }),
    path(base, { fill: 'none', stroke: INK, strokeWidth: 7, strokeLinejoin: 'round' }),
    path(base, { fill: `url(#${grad})` }),
    path(body, { fill: `url(#${grad})` }),
    path(curls, { fill: 'none', stroke: '#1a4a36', strokeWidth: 3.2, strokeLinecap: 'round' }),
    path(`M${P(f(1.5), y(0.56))}C${P(f(1.9), y(0.58), f(2.3), y(0.36), f(2.6), y(0.5))}`, { fill: 'none', stroke: '#1a4a36', strokeWidth: 2.4, strokeLinecap: 'round' }),
    path(`M${P(f(-0.8), y(-0.62))}Q${P(f(-0.4), y(-0.98), f(0.05), y(-0.8))}`, { fill: 'none', stroke: '#fff6d2', strokeOpacity: 0.8, strokeWidth: 3, strokeLinecap: 'round' }));
}

/** Iron mokko (four-lobed) tsuba with a gold rim, boar's-eye openwork, blade slot and gold washer. */
function tsuba(cx, cy, R, rot) {
  const pts = [];
  for (let i = 0; i < 96; i++) {
    const a = (i / 96) * Math.PI * 2, r = R * (1 - 0.11 * Math.pow(Math.abs(Math.sin(2 * a)), 8));
    pts.push([r * Math.cos(a), r * Math.sin(a)]);
  }
  const outline = L.poly(pts);
  const rnd = rng(Math.round(cx + cy)), specks = [];
  for (let i = 0; i < 46; i++) { const a = rnd() * 6.283, d = R * (0.3 + rnd() * 0.6); specks.push(circle(d * Math.cos(a), d * Math.sin(a), 1.2 + rnd() * 1.4)); }
  let cuts = '';
  for (let i = 0; i < 4; i++) {
    const a = 45 + i * 90, t = (a * Math.PI) / 180, hx = Math.cos(t) * R * 0.6, hy = Math.sin(t) * R * 0.6;
    cuts += `<path d="${heart(0, 0, R * 0.17)}" transform="translate(${n(hx)} ${n(hy)}) rotate(${n(a - 90)})"/>`;
  }
  const slot = `M${P(-R * 0.1, -R * 0.34)}L${P(R * 0.1, -R * 0.34)}L${P(R * 0.06, R * 0.3)}Q0 ${n(R * 0.36)} ${P(-R * 0.06, R * 0.3)}Z`;
  const hitsu = `M${P(-R * 0.36, -R * 0.12)}A${P(R * 0.13, R * 0.13)} 0 0 0 ${P(-R * 0.36, R * 0.14)}Q${P(-R * 0.26, 0, -R * 0.36, -R * 0.12)}Z`
    + `M${P(R * 0.36, -R * 0.12)}A${P(R * 0.13, R * 0.13)} 0 0 1 ${P(R * 0.36, R * 0.14)}Q${P(R * 0.26, 0, R * 0.36, -R * 0.12)}Z`;
  return g({ transform: tf(cx, cy, rot) },
    path(outline, { fill: INK, fillOpacity: 0.38, transform: 'translate(6 10)' }),
    path(outline, { fill: 'url(#sbIron)', stroke: INK, strokeWidth: 5 }),
    path(specks.join(''), { fill: '#c7b98f', fillOpacity: 0.22 }),
    // gold rim (fukurin)
    path(outline, { fill: 'none', stroke: 'url(#sbGoldRim)', strokeWidth: 12 }),
    path(outline, { fill: 'none', stroke: INK, strokeWidth: 2, transform: 'scale(0.89)' }),
    path(outline, { fill: 'none', stroke: INK, strokeWidth: 2.5 }),
    // openwork cut-outs read as deep recesses
    g({ fill: '#0a0c0a', stroke: '#e2b856', strokeOpacity: 0.55, strokeWidth: 2 }, cuts),
    path([0, 90, 180, 270].map((a) => { const t = (a * Math.PI) / 180, r = R * 0.72;
      return circle(r * Math.cos(t), r * Math.sin(t), 6) + circle(r * Math.cos(t + 0.16), r * Math.sin(t + 0.16), 3) + circle(r * Math.cos(t - 0.16), r * Math.sin(t - 0.16), 3); }).join(''),
      { fill: 'url(#sbGold)', stroke: INK, strokeWidth: 1.5 }),
    path(circle(0, 0, R * 0.8), { fill: 'none', stroke: GOLD, strokeOpacity: 0.35, strokeWidth: 1.5, strokeDasharray: '2 6' }),
    // gold seppa washer, blade slot and side holes
    path(ellipse(0, 0, R * 0.2, R * 0.46), { fill: 'url(#sbGold)', stroke: INK, strokeWidth: 3 }),
    path(slot, { fill: '#0a0c0a', stroke: INK, strokeWidth: 2 }),
    path(hitsu, { fill: '#0a0c0a', stroke: '#e2b856', strokeOpacity: 0.5, strokeWidth: 2 }),
    path(`M${P(-R * 0.62, -R * 0.52)}A${P(R * 0.8, R * 0.8)} 0 0 1 ${P(-R * 0.1, -R * 0.82)}`, { fill: 'none', stroke: '#fff3c8', strokeOpacity: 0.7, strokeWidth: 4, strokeLinecap: 'round' }));
}

/** Braided black cord along a path: dark core, soft braid glints and a sheen line. */
function cord(d, w = 16) {
  return path(d, { fill: 'none', stroke: INK, strokeOpacity: 0.35, strokeWidth: w + 4, strokeLinecap: 'round', transform: 'translate(4 7)' })
    + path(d, { fill: 'none', stroke: '#050605', strokeWidth: w + 4, strokeLinecap: 'round', strokeLinejoin: 'round' })
    + path(d, { fill: 'none', stroke: '#222624', strokeWidth: w - 3, strokeLinecap: 'round', strokeLinejoin: 'round' })
    + path(d, { fill: 'none', stroke: '#3c413e', strokeWidth: w - 6, strokeDasharray: '7 5', strokeLinecap: 'round' })
    + path(d, { fill: 'none', stroke: '#8d948f', strokeOpacity: 0.4, strokeWidth: 2.2, strokeDasharray: '3 8', strokeLinecap: 'round', transform: 'translate(-1.5 -3)' });
}

/** Silk tassel hanging from (x, y): gold cap, red binding, black strands flaring to a soft fringe. */
function tassel(x, y, len, sway) {
  const top = y + 20, bot = y + len, hw = 26;
  let d = `M${P(x - 9, top)}C${P(x - 12, top + len * 0.3, x - hw + sway, bot - len * 0.3, x - hw + sway, bot)}`;
  for (let i = 0; i < 6; i++) { const x0 = x + sway - hw + (i * 2 * hw) / 6, x1 = x0 + (2 * hw) / 6; d += `Q${P((x0 + x1) / 2, bot + 10, x1, bot)}`; }
  d += `C${P(x + hw + sway, bot - len * 0.3, x + 12, top + len * 0.3, x + 9, top)}Z`;
  const strands = [];
  for (let i = -4; i <= 4; i++) strands.push(`M${P(x + i * 1.8, top + 6)}C${P(x + i * 2.4, top + len * 0.35, x + i * 5 + sway * 0.8, bot - len * 0.3, x + i * 5.6 + sway, bot + 2)}`);
  return g({},
    path(d, { fill: INK, fillOpacity: 0.3, transform: 'translate(4 7)' }),
    path(d, { fill: 'url(#sbSilk)', stroke: INK, strokeWidth: 3, strokeLinejoin: 'round' }),
    path(strands.join(''), { fill: 'none', stroke: '#6d7470', strokeOpacity: 0.55, strokeWidth: 1.5 }),
    path(`M${P(x - 4, top + 10)}C${P(x - 6, top + len * 0.4, x - 12 + sway, bot - 30, x - 14 + sway, bot - 8)}`, { fill: 'none', stroke: '#b9c0bb', strokeOpacity: 0.55, strokeWidth: 3, strokeLinecap: 'round' }),
    path(rr(x - 11, y + 6, 22, 20, 5), { fill: 'url(#sbRed)', stroke: INK, strokeWidth: 3 }),
    path(`M${P(x - 11, y + 13)}H${n(x + 11)}M${P(x - 11, y + 19)}H${n(x + 11)}`, { stroke: GOLD, strokeWidth: 2 }),
    path(`M${P(x - 9, y + 8)}Q${P(x, y - 8, x + 9, y + 8)}Z`, { fill: 'url(#sbGold)', stroke: INK, strokeWidth: 2.5, strokeLinejoin: 'round' }));
}

/** Red decorative knot: four petal loops around a square core. */
function knot(cx, cy) {
  const loop = (a) => `<path d="M0 -6C-16 -16 -20 -44 0 -50C20 -44 16 -16 0 -6Z" transform="translate(${cx} ${cy}) rotate(${a})"/>`;
  return g({},
    g({ fill: 'url(#sbRed)', stroke: INK, strokeWidth: 3.5, strokeLinejoin: 'round' }, [0, 90, 270].map(loop)),
    g({ fill: 'none', stroke: '#ff9a86', strokeOpacity: 0.7, strokeWidth: 2.5, strokeLinecap: 'round' },
      [0, 90, 270].map((a) => `<path d="M-4 -14C-12 -22 -12 -38 -2 -42" transform="translate(${cx} ${cy}) rotate(${a})"/>`)),
    path(rr(cx - 16, cy - 16, 32, 32, 6), { fill: 'url(#sbRed)', stroke: INK, strokeWidth: 3.5, transform: `rotate(45 ${cx} ${cy})` }),
    path(`M${P(cx - 10, cy)}H${n(cx + 10)}M${P(cx, cy - 10)}V${n(cy + 10)}`, { stroke: '#7a1a14', strokeWidth: 2.5, transform: `rotate(45 ${cx} ${cy})` }),
    path(ellipse(cx - 5, cy - 6, 5, 3), { fill: '#fff', fillOpacity: 0.6 }));
}

function brocade() {
  const outer = rr(BRO.x, BRO.y, BRO.w, BRO.h, 12);
  // clouds across the upper field, seigaiha below the wave line
  let wave = `M${BRO.x - 10} ${n(waveY(BRO.x - 10))}`;
  for (let x = BRO.x; x <= BRO.x + BRO.w + 20; x += 20) wave += `L${P(x, waveY(x))}`;
  const lower = `${wave}V${BRO.y + BRO.h + 20}H${BRO.x - 10}Z`;
  return g({},
    path(rr(BRO.x - 12, BRO.y - 12, BRO.w + 24, BRO.h + 24, 18), { fill: INK, fillOpacity: 0.35, transform: 'translate(8 14)' }),
    path(rr(BRO.x - 12, BRO.y - 12, BRO.w + 24, BRO.h + 24, 18), { fill: 'url(#sbLacquer)', stroke: INK, strokeWidth: 5 }),
    path(rr(BRO.x - 5, BRO.y - 5, BRO.w + 10, BRO.h + 10, 14), { fill: 'none', stroke: GOLD, strokeWidth: 3 }),
    path(outer, { fill: 'url(#sbGreen)' }),
    g({ clipPath: 'url(#sbBroClip)' },
      path(outer, { fill: 'url(#sbTwill)' }),
      g({ clipPath: 'url(#sbLowerClip)' }, path(outer, { fill: 'url(#sbSeigaiha)' })),
      path(wave, { fill: 'none', stroke: INK, strokeWidth: 9 }),
      path(wave, { fill: 'none', stroke: GOLD, strokeWidth: 4 }),
      CLOUDS.map(([x, y, s, f], i) => cloud(x, y, s, f, `sbC${i}`)).join(''),
      path(outer, { fill: 'url(#sbBroShade)' })),
    path(outer, { fill: 'none', stroke: INK, strokeWidth: 3 }));
}

function mat(holeD) {
  const rnd = rng(8), fib = [], fib2 = [], leaf = [];
  for (let i = 0; i < 150; i++) {
    let x, y;
    do { x = MAT.x + rnd() * MAT.w; y = MAT.y + rnd() * MAT.h; } while (x > hole.x - 6 && x < hole.x + hole.w + 6 && y > hole.y - 6 && y < hole.y + hole.h + 6);
    const a = rnd() * 6.283, l = 8 + rnd() * 18;
    (i % 3 ? fib : fib2).push(`M${P(x, y)}Q${P(x + Math.cos(a + 0.6) * l * 0.6, y + Math.sin(a + 0.6) * l * 0.6, x + Math.cos(a) * l, y + Math.sin(a) * l)}`);
  }
  for (let i = 0; i < 22; i++) {
    const side = i % 4, t = rnd();
    const x = side < 2 ? MAT.x + 10 + t * (MAT.w - 20) : (side === 2 ? MAT.x + 6 + rnd() * 24 : MAT.x + MAT.w - 30 + rnd() * 24);
    const y = side < 2 ? (side ? MAT.y + MAT.h - 30 + rnd() * 24 : MAT.y + 6 + rnd() * 24) : MAT.y + 10 + t * (MAT.h - 20);
    const s = 3 + rnd() * 6;
    leaf.push(L.poly([[x, y], [x + s * (0.8 + rnd()), y + s * 0.2], [x + s * 0.9, y + s * (0.8 + rnd() * 0.6)], [x - s * 0.1, y + s * 0.7]]));
  }
  return g({},
    // red piping and gold fillet between the brocade and the mat
    path(rr(MAT.x - 12, MAT.y - 12, MAT.w + 24, MAT.h + 24, 8), { fill: GOLD, stroke: INK, strokeWidth: 3 }),
    path(rr(MAT.x - 6, MAT.y - 6, MAT.w + 12, MAT.h + 12, 6), { fill: 'url(#sbRed)', stroke: INK, strokeWidth: 2 }),
    path(rr(MAT.x, MAT.y, MAT.w, MAT.h, 4), { fill: 'url(#sbWashi)', stroke: INK, strokeWidth: 2.5 }),
    g({ clipPath: 'url(#sbMatClip)' },
      path(fib.join(''), { fill: 'none', stroke: '#b89a6a', strokeOpacity: 0.35, strokeWidth: 1.4, strokeLinecap: 'round' }),
      path(fib2.join(''), { fill: 'none', stroke: '#fff', strokeOpacity: 0.8, strokeWidth: 1.6, strokeLinecap: 'round' }),
      path(leaf.join(''), { fill: 'url(#sbGold)', fillOpacity: 0.85 })),
    // bevelled cut of the mat around the screen
    path(rr(hole.x - 10, hole.y - 10, hole.w + 20, hole.h + 20, radius + 6), { fill: 'url(#sbBevel)', stroke: '#9a7a3a', strokeOpacity: 0.6, strokeWidth: 1.5 }),
    path(rr(hole.x - 3, hole.y - 3, hole.w + 6, hole.h + 6, radius + 2), { fill: '#1a1410' }),
    lip(holeD, '#000', [[6, 0.25], [2.5, 0.5]]));
}

function hanger() {
  const hx = 800, hy = 34, kx = 800, ky = 112;
  const left = `M${P(620, BRO.y - 6)}C${P(640, 140, 720, 116, kx - 12, ky)}`;
  const right = `M${P(980, BRO.y - 6)}C${P(960, 140, 880, 116, kx + 12, ky)}`;
  const loopUp = `M${P(kx - 8, ky - 30)}C${P(kx - 30, 60, hx - 22, hy + 4, hx, hy + 2)}C${P(hx + 22, hy + 4, kx + 30, 60, kx + 8, ky - 30)}`;
  const ring = (x) => path(`M${P(x - 18, BRO.y - 10)}A18 18 0 0 1 ${P(x + 18, BRO.y - 10)}`, { fill: 'none', stroke: INK, strokeWidth: 12, strokeLinecap: 'round' })
    + path(`M${P(x - 18, BRO.y - 10)}A18 18 0 0 1 ${P(x + 18, BRO.y - 10)}`, { fill: 'none', stroke: 'url(#sbGoldRim)', strokeWidth: 6, strokeLinecap: 'round' })
    + path(rr(x - 24, BRO.y - 14, 48, 18, 6), { fill: 'url(#sbGold)', stroke: INK, strokeWidth: 3 })
    + path(`M${P(x - 16, BRO.y - 9)}H${n(x + 10)}`, { stroke: '#fff6d2', strokeOpacity: 0.8, strokeWidth: 2.5, strokeLinecap: 'round' });
  return g({},
    // hook
    cord(loopUp, 12), cord(left), cord(right),
    path(circle(hx + 3, hy - 4, 15), { fill: INK, fillOpacity: 0.35 }),
    path(circle(hx, hy - 8, 15), { fill: 'url(#sbGold)', stroke: INK, strokeWidth: 3.5 }),
    path(circle(hx, hy - 8, 6), { fill: 'none', stroke: '#9a6a1a', strokeWidth: 2 }),
    path(ellipse(hx - 5, hy - 13, 5, 3), { fill: '#fff', fillOpacity: 0.8 }),
    ring(620), ring(980),
    g({ class: 'sb-sway' }, tassel(kx - 18, ky + 20, 150, -8), tassel(kx + 18, ky + 20, 132, 7)),
    knot(kx, ky));
}

function draw() {
  const holeD = rr(hole.x, hole.y, hole.w, hole.h, radius);
  const R = 46; // seigaiha radius
  const sg = [];
  for (const [x, y] of [[R, -R / 2], [0, 0], [2 * R, 0], [R, R / 2], [0, R], [2 * R, R], [R, 1.5 * R]]) {
    sg.push(`<path d="${circle(x, y, R - 1)}" fill="#14523b" stroke="${GOLD}" stroke-width="3"/>`);
    sg.push(`<path d="${circle(x, y, R * 0.74)}${circle(x, y, R * 0.5)}${circle(x, y, R * 0.26)}" fill="none" stroke="${GOLD}" stroke-opacity="0.75" stroke-width="2.4"/>`);
  }
  const lowerClip = (() => { let d = `M${BRO.x - 10} ${n(waveY(BRO.x - 10))}`; for (let x = BRO.x; x <= BRO.x + BRO.w + 20; x += 20) d += `L${P(x, waveY(x))}`; return `${d}V${BRO.y + BRO.h + 20}H${BRO.x - 10}Z`; })();
  const defs = [
    '<style>.sb-sway{animation:sbSway 4.2s ease-in-out infinite alternate;transform-origin:800px 136px}@keyframes sbSway{0%{transform:rotate(-2deg)}100%{transform:rotate(2deg)}}'
      + '@media (prefers-reduced-motion:reduce){*{animation:none!important}}</style>',
    `<pattern id="sbSeigaiha" x="${BRO.x}" y="${n(waveY(BRO.x))}" width="${2 * R}" height="${R}" patternUnits="userSpaceOnUse">${sg.join('')}</pattern>`,
    '<pattern id="sbTwill" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(35)"><path d="M0 0V10" stroke="#9fe0b8" stroke-opacity="0.08" stroke-width="3"/></pattern>',
    lg('sbGreen', [0, 0, 1, 1], [[0, '#1b6a4c'], [0.5, '#145a40'], [1, '#0d4231']]),
    rg('sbBroShade', [0.5, 0.5, 0.75], [[0.55, '#03140d', 0], [1, '#03140d', 0.4]]),
    lg('sbLacquer', [0, 0, 1, 1], [[0, '#2a2622'], [0.5, '#141210'], [1, '#050505']]),
    ...CLOUDS.map(([x, y, sz], i) => lg(`sbC${i}`, [x - sz, y - sz, x + sz, y + sz * 0.8], [[0, '#fff0b8'], [0.45, '#eec35c'], [1, '#c48c2a']], true)),
    lg('sbGold', [0, 0, 1, 1], [[0, '#fff0b8'], [0.4, '#eec35c'], [0.75, '#c9922e'], [1, '#e8b850']]),
    lg('sbGoldRim', [0, 0, 1, 1], [[0, '#fff3c4'], [0.3, '#e8b850'], [0.6, '#a8741c'], [1, '#f2cb6a']]),
    rg('sbIron', [0.36, 0.3, 0.85], [[0, '#5b5a4c'], [0.55, '#34352e'], [1, '#1a1b17']]),
    lg('sbRed', [0, 0, 1, 1], [[0, '#ff6a52'], [0.5, '#d8392c'], [1, '#9e2018']]),
    lg('sbSilk', [0, 0, 1, 0], [[0, '#2c302e'], [0.4, '#4a504d'], [1, '#0d0f0e']]),
    lg('sbWashi', [0, 0, 1, 1], [[0, '#fbf5e6'], [0.6, '#f3e9d2'], [1, '#e8dcc0']]),
    lg('sbBevel', [0, 0, 1, 1], [[0, '#fffaf0'], [0.5, '#efe2c4'], [1, '#d9c69c']]),
    `<clipPath id="sbBroClip"><path d="${rr(BRO.x, BRO.y, BRO.w, BRO.h, 12)}"/></clipPath>`,
    `<clipPath id="sbLowerClip"><path d="${lowerClip}"/></clipPath>`,
    `<clipPath id="sbMatClip"><path d="${rr(MAT.x, MAT.y, MAT.w, MAT.h, 4)}"/></clipPath>`,
  ].join('');
  const c = 30, TR = 104;
  const body = [
    brocade(),
    mat(holeD),
    tsuba(BRO.x + c, BRO.y + c, TR, -45), tsuba(BRO.x + BRO.w - c, BRO.y + c, TR, 45),
    tsuba(BRO.x + c, BRO.y + BRO.h - c, TR, -135), tsuba(BRO.x + BRO.w - c, BRO.y + BRO.h - c, TR, 135),
    hanger(),
  ].join('\n');
  return { defs, body };
}

module.exports = {
  W, H, hole, radius, draw,
  meta: {
    name: 'Samurai Brocade', theme: 'samurai', rarity: 'legendary', translucent: false, collection: 'curio-cabinet', license: 'CC-BY-4.0',
    desc: 'Hang your game like a treasured scroll, mounted in green and gold brocade with a sword guard standing watch at every corner.',
    tags: ['samurai', 'brocade', 'katana', 'japanese', 'gold', 'seigaiha', 'elegant'],
  },
};
