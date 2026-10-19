'use strict';
// Starter "Handheld": a portrait pocket console in clear frost plastic that shimmers from aqua at the
// top to lilac at the base. The shell fill glows through the body; a crystal game card with a
// chamfered grip slots in at the top, and the main chip, gold traces, a flat battery and screws show
// through the plastic. Smoked-indigo screen plate, a pearl four-petal flower pad with a jewel centre,
// a tower of three sorbet jelly buttons in a capsule well, a slider switch with a heart knob between
// two pebble keys, a rosette speaker, a side scroll wheel and layered anime glare: soft sheen, sharp
// crescents, a cool rim light and round glints. Original artwork, no marks, logos or text.
const L = require('../lib');
const { rr, path, g, lg, rg, circle, ellipse, sparkle, star, heart, tf, rng, lip } = L;

const W = 1000, H = 1580, CX = 500;
const hole = { x: CX - 280, y: 198, w: 560, h: 420 }, radius = 18;
const O = [CX, 790]; // body centre
const INK = '#262463';

// ---- body: a tall squircle, a touch fuller towards the grips --------------------------------------
const SE = { a: 440, b: 712, nTop: 5.6, nBot: 3.4, k: 0.01 };
const r1 = (v) => Math.round(v * 10) / 10;
const pt = (p) => `${r1(p[0])} ${r1(p[1])}`;

function rBody(phi) {
  const c = Math.cos(phi), s = Math.sin(phi);
  let r = 500;
  for (let i = 0; i < 10; i++) {
    const a = SE.a * (1 + (SE.k * r * s) / SE.b);
    const n = s < 0 ? SE.nTop : SE.nBot;
    r = Math.pow(Math.pow(Math.abs(c / a), n) + Math.pow(Math.abs(s / SE.b), n), -1 / n);
  }
  return r;
}
/** Evenly spaced closed polyline (by arc length). */
function resample(pts, step) {
  const N = pts.length, cum = [0];
  for (let i = 0; i < N; i++) { const a = pts[i], b = pts[(i + 1) % N]; cum.push(cum[i] + Math.hypot(b[0] - a[0], b[1] - a[1])); }
  const total = cum[N], count = Math.round(total / step), out = [];
  let j = 0;
  for (let i = 0; i < count; i++) {
    const t = (i * total) / count;
    while (cum[j + 1] < t) j++;
    const a = pts[j], b = pts[(j + 1) % N], f = (t - cum[j]) / (cum[j + 1] - cum[j] || 1);
    out.push([a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]);
  }
  return out;
}
function outline(step = 14) {
  const raw = [];
  for (let i = 0; i < 2880; i++) {
    const phi = -Math.PI / 2 + (i / 2880) * Math.PI * 2, r = rBody(phi);
    raw.push([O[0] + r * Math.cos(phi), O[1] + r * Math.sin(phi)]);
  }
  return resample(raw, step);
}
const normals = (pts) => pts.map((_, i) => {
  const a = pts[(i - 1 + pts.length) % pts.length], b = pts[(i + 1) % pts.length];
  const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1;
  return [dy / l, -dx / l];
});
const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
function closed(pts) {
  let d = `M${pt(mid(pts[pts.length - 1], pts[0]))}`;
  for (let i = 0; i < pts.length; i++) d += `Q${pt(pts[i])} ${pt(mid(pts[i], pts[(i + 1) % pts.length]))}`;
  return `${d}Z`;
}
function open(pts, lead = 'M') {
  let d = `${lead}${pt(pts[0])}`;
  for (let i = 1; i < pts.length - 1; i++) d += `Q${pt(pts[i])} ${pt(mid(pts[i], pts[i + 1]))}`;
  return `${d}L${pt(pts[pts.length - 1])}`;
}
function arcIdx(pts, a0, a1, c = O) {
  const ang = (p) => { let a = (Math.atan2(p[1] - c[1], p[0] - c[0]) * 180) / Math.PI; while (a < a0) a += 360; return a; };
  return pts.map((p, i) => [ang(p), i]).filter(([a]) => a <= a1).sort((x, y) => x[0] - y[0]).map(([, i]) => i);
}
/** Crescent hugging the outline: outer edge inset by `inset`, thickness swelling to `w` (sin^pow taper, peak at `skew`). */
function crescent(pts, nrm, idx, inset, w, pow = 1, skew = 0.5) {
  const outer = [], inner = [];
  idx.forEach((i, k) => {
    const u = k / (idx.length - 1), v = u < skew ? (u / skew) * 0.5 : 0.5 + ((u - skew) / (1 - skew)) * 0.5;
    const t = w * Math.pow(Math.sin(Math.PI * v), pow), [x, y] = pts[i], [nx, ny] = nrm[i];
    outer.push([x - nx * inset, y - ny * inset]);
    inner.push([x - nx * (inset + t), y - ny * (inset + t)]);
  });
  return `${open(outer)}${open(inner.reverse(), 'L')}Z`;
}
const insetLine = (pts, nrm, idx, inset) => open(idx.map((i) => [pts[i][0] - nrm[i][0] * inset, pts[i][1] - nrm[i][1] * inset]));

// ---- layout ------------------------------------------------------------------------------------------
const PL = { x: hole.x - 40, y: hole.y - 44, w: hole.w + 80, h: hole.h + 44 + 92, r: 58 }; // screen plate
const CHIN = hole.y + hole.h + 48;
const DPAD = [CX - 228, 930], FACE = [CX + 228, 930], MENU = 1112, SPK = [CX + 236, 1300];

function screw(x, y, rot = 20, s = 1) {
  return g({ transform: tf(x, y, rot, s) },
    path(circle(0, 0, 17), { fill: '#5f6f8f' }),
    path(circle(0, 0, 14), { fill: 'url(#hhMetal)' }),
    path('M-8 0H8M0 -8V8', { stroke: '#4a5876', strokeWidth: 3.5, strokeLinecap: 'round' }),
    path('M-9 -6A11 11 0 0 1 -2 -11', { fill: 'none', stroke: '#fff', strokeWidth: 2.2, strokeLinecap: 'round' }));
}

/** Crystal game card slotted in from the top: the chamfered grip shows above the shell, the rest through it. */
function cartridge() {
  const x = CX - 170, y = 18, w = 340, h = 262, c = 44;
  const card = L.chamfer(x, y, w, h, [c, c, 8, 8]);
  return g({},
    path(card, { fill: 'url(#hhCart)', stroke: INK, strokeWidth: 6, strokeLinejoin: 'round' }),
    // half-moon finger notch and a row of grip studs
    path(`M${CX - 34} ${y}A34 30 0 0 0 ${CX + 34} ${y}Z`, { fill: '#8a6fd8', fillOpacity: 0.55, stroke: INK, strokeWidth: 4, strokeLinejoin: 'round' }),
    path([-2, -1, 1, 2].map((k) => circle(CX + k * 52, y + 44, 6.5)).join(''), { fill: '#9a82e6', fillOpacity: 0.7 }),
    path([-2, -1, 1, 2].map((k) => circle(CX + k * 52 - 2, y + 42, 2.2)).join(''), { fill: '#fff' }),
    path(`M${x + c - 8} ${y + 16}L${x + 16} ${y + c + 8}V${y + 70}`, { fill: 'none', stroke: '#fff', strokeOpacity: 0.85, strokeWidth: 5, strokeLinecap: 'round', strokeLinejoin: 'round' }),
    // facet label (the part inside the shell, seen through the plastic)
    path(L.chamfer(x + 40, y + 78, w - 80, 160, 26), { fill: 'url(#hhLabel)', stroke: '#5a3fa8', strokeWidth: 3, strokeLinejoin: 'round' }),
    path(L.poly([[CX, y + 96], [CX + 28, y + 118], [CX, y + 146], [CX - 28, y + 118]]), { fill: '#fff6c9', stroke: '#5a3fa8', strokeWidth: 2.5, strokeLinejoin: 'round' }),
    path(`M${CX - 28} ${y + 118}H${CX + 28}M${CX} ${y + 96}V${y + 146}`, { stroke: '#e0b85a', strokeWidth: 2 }),
    path(sparkle(CX - 70, y + 112, 11) + sparkle(CX + 72, y + 122, 9) + circle(CX - 112, y + 126, 4) + circle(CX + 110, y + 104, 3.5), { fill: '#fff' }));
}

/** Parts seen through the clear plastic: gold traces, the main chip, two AA cells, screws. */
function internals() {
  const trace = (d, w = 4) => path(d, { fill: 'none', stroke: '#ffcf6e', strokeOpacity: 0.5, strokeWidth: w, strokeLinecap: 'round', strokeLinejoin: 'round' });
  const chip = [CX, 960], cs = 76;
  const pins = [];
  for (let i = 0; i < 6; i++) {
    const o = -cs / 2 + 10 + i * ((cs - 20) / 5);
    pins.push(`M${chip[0] + o} ${chip[1] - cs / 2}v-12M${chip[0] + o} ${chip[1] + cs / 2}v12M${chip[0] - cs / 2} ${chip[1] + o}h-12M${chip[0] + cs / 2} ${chip[1] + o}h12`);
  }
  const lt = `M${CX - 50} ${chip[1] - 50}V820H${CX - 150}L${CX - 190} 780H${PL.x - 10}M${CX - 50} ${chip[1] + 50}V1060L${CX - 110} 1120H${CX - 160}`
    + `M${CX - 64} ${chip[1]}H${DPAD[0] + 120}M${PL.x - 30} 300V900L${PL.x + 10} 940`;
  const mirror = (d) => d.replace(/([MLH])([\d.]+)/g, (m, c, x) => `${c}${2 * CX - x}`);
  const vias = [[PL.x - 10, 780], [CX - 160, 1120], [PL.x - 30, 300], [PL.x + 10, 940], [DPAD[0] + 120, chip[1]]]
    .flatMap(([x, y]) => [circle(x, y, 6), circle(2 * CX - x, y, 6)]).join('');
  const bp = { x: 150, y: 1196, w: 420, h: 196 };
  const pack = g({ opacity: 0.7 },
    path(rr(bp.x, bp.y, bp.w, bp.h, 26), { fill: 'url(#hhPack)', stroke: '#2a3f6e', strokeWidth: 3 }),
    path(rr(bp.x + 26, bp.y + 50, bp.w - 52, 96, 12), { fill: 'url(#hhLabel)', fillOpacity: 0.9 }),
    path(rr(bp.x + 56, bp.y + 74, 120, 48, 9), { fill: 'none', stroke: '#fff', strokeWidth: 6 }),
    path(rr(bp.x + 176, bp.y + 88, 12, 20, 3), { fill: '#fff' }),
    path(`M${bp.x + 80} ${bp.y + 86}v24M${bp.x + 102} ${bp.y + 86}v24M${bp.x + 124} ${bp.y + 86}v24`, { stroke: '#fff', strokeWidth: 10 }),
    path(`M${bp.x + 220} ${bp.y + 84}H${bp.x + 360}M${bp.x + 220} ${bp.y + 112}H${bp.x + 320}`, { stroke: '#fff', strokeOpacity: 0.8, strokeWidth: 7, strokeLinecap: 'round' }),
    path(`M${bp.x + 20} ${bp.y + 22}H${bp.x + bp.w - 60}`, { stroke: '#fff', strokeOpacity: 0.7, strokeWidth: 5, strokeLinecap: 'round' }),
    '');
  return g({ opacity: 0.8 },
    trace(lt + mirror(lt)),
    path(vias, { fill: '#ffe39a', fillOpacity: 0.7, stroke: '#c48a2a', strokeOpacity: 0.6, strokeWidth: 2 }),
    path(pins.join(''), { stroke: '#d9dde8', strokeWidth: 4 }),
    path(rr(chip[0] - cs / 2, chip[1] - cs / 2, cs, cs, 6), { fill: '#24233a', stroke: '#0f1424', strokeWidth: 3 }),
    path(circle(chip[0] - 22, chip[1] - 22, 5), { fill: '#3d3d5c' }),
    path(`M${chip[0] - 26} ${chip[1] + 6}H${chip[0] + 26}M${chip[0] - 26} ${chip[1] + 18}H${chip[0] + 10}`, { stroke: '#6a6a90', strokeWidth: 3, strokeLinecap: 'round' }),
    // flat battery pack in the back
    pack,
    screw(150, 200, 20), screw(850, 200, -30), screw(188, 1146, 40), screw(812, 1146, 10));
}

function wheel() {
  // volume wheel in a slot on the right edge
  const x = 924, y = 560, ribs = [];
  for (let i = 0; i < 8; i++) ribs.push(`M${x + 12} ${y + 14 + i * 15}H${x + 34}`);
  return g({},
    path(rr(x - 8, y - 12, 26, 154, 10), { fill: '#110b2c', fillOpacity: 0.8 }),
    path(rr(x + 3, y + 6, 40, 130, 18), { fill: INK, fillOpacity: 0.35 }),
    path(rr(x, y, 40, 130, 18), { fill: 'url(#hhWheel)', stroke: INK, strokeWidth: 5 }),
    path(ribs.join(''), { stroke: INK, strokeOpacity: 0.45, strokeWidth: 4, strokeLinecap: 'round' }),
    path(`M${x + 9} ${y + 18}V${y + 60}`, { stroke: '#fff', strokeOpacity: 0.8, strokeWidth: 4, strokeLinecap: 'round' }));
}

function powerSlide() {
  // power slider in a slot on the top edge, left of the cartridge
  return g({},
    path(rr(178, 78, 96, 18, 9), { fill: '#110b2c', fillOpacity: 0.8 }),
    path(rr(193, 66, 44, 28, 10), { fill: INK, fillOpacity: 0.35 }),
    path(rr(190, 60, 44, 28, 10), { fill: 'url(#hhPill)', stroke: INK, strokeWidth: 4.5 }),
    path('M200 68H220', { stroke: '#fff', strokeOpacity: 0.75, strokeWidth: 3.5, strokeLinecap: 'round' }));
}

/** Die-cut sticker on the clear shell: a sleepy smiling star. */
function sticker(cx, cy, rot) {
  const d = star(0, 4, 50, 27, 5);
  return g({ transform: tf(cx, cy, rot) },
    path(d, { fill: INK, fillOpacity: 0.3, stroke: INK, strokeOpacity: 0.3, strokeWidth: 22, strokeLinejoin: 'round', transform: 'translate(3 6)' }),
    path(d, { fill: '#fff', stroke: '#fff', strokeWidth: 20, strokeLinejoin: 'round' }),
    path(d, { fill: 'url(#hhSticker)', stroke: '#e0a12a', strokeWidth: 3, strokeLinejoin: 'round' }),
    path('M-17 2Q-12 -4 -7 2M7 2Q12 -4 17 2', { fill: 'none', stroke: '#5a3a12', strokeWidth: 3.5, strokeLinecap: 'round' }),
    path('M-6 12Q0 18 6 12', { fill: 'none', stroke: '#5a3a12', strokeWidth: 3.5, strokeLinecap: 'round' }),
    path(ellipse(-22, 13, 6, 3.5) + ellipse(22, 13, 6, 3.5), { fill: '#ff8fab', fillOpacity: 0.8 }),
    path('M-14 -26L-4 -40', { stroke: '#fff', strokeOpacity: 0.85, strokeWidth: 5, strokeLinecap: 'round' }));
}

function plate() {
  const holeD = rr(hole.x, hole.y, hole.w, hole.h, radius), { x, y, w, h, r } = PL;
  return g({},
    path(rr(x + 4, y + 14, w, h, r), { fill: INK, fillOpacity: 0.4 }),
    path(rr(x, y, w, h, r), { fill: 'url(#hhPlateEdge)', stroke: INK, strokeWidth: 6 }),
    path(rr(x + 8, y + 8, w - 16, h - 16, r - 8), { fill: 'url(#hhPlate)' }),
    path(rr(x + 8, y + 8, w - 16, h - 16, r - 8), { fill: 'url(#hhPlateSheen)' }),
    path(rr(hole.x - 14, hole.y - 14, hole.w + 28, hole.h + 28, radius + 12), { fill: '#110b2c', stroke: '#5c4cb4', strokeWidth: 3 }),
    lip(holeD, '#000', [[7, 0.3], [3, 0.6]]),
    // chin: power LED, pastel accent bar, a little star badge and a battery meter
    path(circle(x + 56, CHIN, 18), { fill: 'url(#hhLed)', class: 'hh-led' }),
    path(circle(x + 56, CHIN, 7), { fill: '#fff', class: 'hh-led' }),
    path(rr(x + 92, CHIN - 5, 150, 10, 5), { fill: 'url(#hhAccent)' }),
    path(star(CX, CHIN, 20, 9), { fill: '#ffe08a', stroke: '#110b2c', strokeWidth: 2.5, strokeLinejoin: 'round' }),
    path(rr(x + w - 242, CHIN - 5, 150, 10, 5), { fill: 'url(#hhAccent)', transform: `rotate(180 ${x + w - 167} ${CHIN})` }),
    [0, 1, 2].map((i) => path(rr(x + w - 76 + i * 16, CHIN - 10, 11, 20, 3), { fill: i < 2 ? '#7cf0c8' : '#33456e' })).join(''),
    // key light on the plate rim
    path(`M${x + 18} ${y + r + 120}V${y + r}Q${x + 18} ${y + 18} ${x + r} ${y + 18}H${x + r + 160}`, { fill: 'none', stroke: '#fff', strokeOpacity: 0.55, strokeWidth: 5, strokeLinecap: 'round' }),
    path(`M${x + w - 16} ${y + h - r - 90}V${y + h - r}`, { fill: 'none', stroke: '#9fd8ff', strokeOpacity: 0.6, strokeWidth: 4, strokeLinecap: 'round' }));
}

/** Four-petal flower pad: notched pearl petals pointing up/right/down/left around a jewel centre. */
function flowerPad() {
  const [cx, cy] = DPAD, Lp = 104, off = 14;
  const pet = L.petal(Lp);
  const petals = (extra) => [0, 90, 180, 270].map((a) => path(pet, { ...extra, transform: `translate(${cx} ${cy}) rotate(${a}) translate(0 ${-off})` })).join('');
  const marks = [0, 90, 180, 270].map((a) => {
    const r = (a - 90) * Math.PI / 180, d = off + Lp * 0.62;
    return circle(cx + d * Math.cos(r), cy + d * Math.sin(r), 6.5);
  }).join('');
  const hi = [0, 90, 180, 270].map((a) => path(`M-26 ${-off - 30}Q-30 ${-off - 66} -12 ${-off - 88}`, { fill: 'none', stroke: '#fff', strokeWidth: 5.5, strokeLinecap: 'round', transform: `translate(${cx} ${cy}) rotate(${a})` })).join('');
  return g({},
    path(circle(cx, cy, 136), { fill: 'url(#hhDish)', stroke: INK, strokeOpacity: 0.35, strokeWidth: 3 }),
    path(circle(cx, cy, 136), { fill: 'none', stroke: '#fff', strokeOpacity: 0.5, strokeWidth: 3, transform: 'translate(0 3)' }),
    g({ transform: 'translate(4 11)' }, petals({ fill: INK, fillOpacity: 0.4 })),
    petals({ fill: 'url(#hhPetal)', stroke: INK, strokeWidth: 5.5, strokeLinejoin: 'round' }),
    path(marks, { fill: '#c9b4ff' }),
    hi,
    // jewel centre
    path(circle(cx + 2, cy + 6, 32), { fill: INK, fillOpacity: 0.4 }),
    path(circle(cx, cy, 32), { fill: 'url(#hhJewel)', stroke: INK, strokeWidth: 5 }),
    path(L.poly([[cx, cy - 18], [cx + 18, cy], [cx, cy + 18], [cx - 18, cy]]), { fill: '#fff', fillOpacity: 0.25, stroke: '#fff', strokeOpacity: 0.6, strokeWidth: 2, strokeLinejoin: 'round' }),
    path(`M${cx - 20} ${cy - 4}A21 21 0 0 1 ${cx - 4} ${cy - 20}`, { fill: 'none', stroke: '#fff', strokeWidth: 5, strokeLinecap: 'round' }),
    path(circle(cx + 13, cy + 12, 4), { fill: '#fff', fillOpacity: 0.85 }));
}

function jelly(cx, cy, id, r = 42) {
  return path(circle(cx + 3, cy + 10, r), { fill: INK, fillOpacity: 0.4 })
    + path(circle(cx, cy, r), { fill: `url(#${id})`, stroke: INK, strokeWidth: 5.5 })
    + path(`M${cx - r * 0.62} ${cy - r * 0.05}A${r * 0.64} ${r * 0.64} 0 0 1 ${cx - r * 0.08} ${cy - r * 0.62}`, { fill: 'none', stroke: '#fff', strokeOpacity: 0.95, strokeWidth: 6.5, strokeLinecap: 'round' })
    + path(circle(cx + r * 0.42, cy + r * 0.38, 5), { fill: '#fff', fillOpacity: 0.8 });
}

/** A vertical tower of three sorbet jelly buttons in a capsule well. */
function buttonTower() {
  const [cx, cy] = FACE, s = 104;
  return g({},
    path(rr(cx - 66, cy - s - 66, 132, 2 * s + 132, 66), { fill: 'url(#hhDish)', stroke: INK, strokeOpacity: 0.35, strokeWidth: 3 }),
    path(rr(cx - 66, cy - s - 66, 132, 2 * s + 132, 66), { fill: 'none', stroke: '#fff', strokeOpacity: 0.5, strokeWidth: 3, transform: 'translate(0 3)' }),
    path(circle(cx - 84, cy - s, 5) + circle(cx - 84, cy, 5) + circle(cx - 84, cy + s, 5), { fill: '#fff', fillOpacity: 0.55 }),
    jelly(cx, cy - s, 'hhBtnP', 44), jelly(cx, cy, 'hhBtnR', 44), jelly(cx, cy + s, 'hhBtnL', 44));
}

/** Slider switch with a heart knob between two pebble keys. */
function menu() {
  const pebble = (x, rot) => g({ transform: tf(x, MENU, rot) },
    path(ellipse(3, 8, 30, 20), { fill: INK, fillOpacity: 0.4 }),
    path(ellipse(0, 0, 30, 20), { fill: 'url(#hhPearl)', stroke: INK, strokeWidth: 5 }),
    path('M-18 -6Q-10 -14 4 -14', { fill: 'none', stroke: '#fff', strokeWidth: 4, strokeLinecap: 'round' }));
  const kx = CX - 34;
  return g({},
    pebble(CX - 168, -10), pebble(CX + 168, 10),
    path(rr(CX - 96, MENU - 26, 192, 52, 26), { fill: 'url(#hhDish)' }),
    path(rr(CX - 80, MENU - 9, 160, 18, 9), { fill: '#120c2e', fillOpacity: 0.85, stroke: INK, strokeWidth: 3 }),
    path(circle(CX + 48, MENU, 4) + circle(CX + 66, MENU, 4), { fill: '#7cf0c8', fillOpacity: 0.8 }),
    path(rr(kx - 30 + 3, MENU - 22 + 8, 60, 44, 16), { fill: INK, fillOpacity: 0.4 }),
    path(rr(kx - 30, MENU - 22, 60, 44, 16), { fill: 'url(#hhPearl)', stroke: INK, strokeWidth: 5 }),
    path(heart(kx, MENU + 1, 11), { fill: '#ff7f9c' }),
    path(`M${kx - 20} ${MENU - 13}H${kx - 6}`, { stroke: '#fff', strokeWidth: 4, strokeLinecap: 'round' }));
}

function speaker() {
  const [cx, cy] = SPK, holes = [];
  for (let ring = 0; ring <= 3; ring++) {
    const n = ring ? ring * 6 : 1;
    for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2 + ring * 0.3; holes.push(circle(cx + ring * 26 * Math.cos(a), cy + ring * 26 * Math.sin(a), 7.5)); }
  }
  return g({ transform: 'rotate(-8 ' + cx + ' ' + cy + ')' },
    path(holes.join(''), { fill: '#110b2c', fillOpacity: 0.75 }),
    path(holes.join(''), { fill: 'none', stroke: '#fff', strokeOpacity: 0.45, strokeWidth: 2, transform: 'translate(1.5 3)' }));
}

// ---- draw --------------------------------------------------------------------------------------------
function draw() {
  const pts = outline(), nrm = normals(pts), BODY = closed(pts);
  const defs = [
    lg('hhPlastic', [0.3, 0, 0.7, 1], [[0, '#d8fff4', 0.36], [0.42, '#8fe2e8', 0.38], [0.75, '#a69af0', 0.46], [1, '#7d5fd8', 0.62]]),
    rg('hhKey', [0.18, 0.12, 0.55], [[0, '#fff', 0.42], [1, '#fff', 0]]),
    rg('hhCool', [0.9, 0.92, 0.55], [[0, '#ff9ed8', 0.36], [1, '#ff9ed8', 0]]),
    lg('hhSheen', [0, 0, 1, 0], [[0, '#fff', 0.85], [1, '#fff', 0.1]]),
    rg('hhCaustic', [0.5, 1, 0.62], [[0, '#f6ecff', 0.7], [0.45, '#dcc8ff', 0.3], [1, '#dcc8ff', 0]]),
    lg('hhPlateEdge', [0, 0, 1, 1], [[0, '#6c5cc0'], [0.5, '#2f2775'], [1, '#1a1548']]),
    lg('hhPlate', [0, 0, 0, 1], [[0, '#3a3088'], [1, '#231c5c']]),
    lg('hhPlateSheen', [0, 0, 1, 1], [[0.2, '#9ff0f0', 0], [0.45, '#9ff0f0', 0.16], [0.6, '#ffb0e0', 0.12], [0.85, '#ffb0e0', 0]]),
    lg('hhAccent', [0, 0, 1, 0], [[0, '#ff9ec4'], [0.5, '#c6a4ff'], [1, '#7fe6ff']]),
    lg('hhPearl', [0, 0, 1, 1], [[0, '#ffffff'], [0.55, '#efeafc'], [1, '#c2b6e6']]),
    rg('hhDish', [0.5, 0.6, 0.55], [[0, '#2a2470', 0.06], [0.8, '#2a2470', 0.16], [1, '#2a2470', 0.3]]),
    lg('hhPill', [0, 0, 0, 1], [[0, '#7a6cc8'], [1, '#3a2f86']]),
    lg('hhWheel', [0, 0, 1, 0], [[0, '#5a4cb0'], [0.5, '#c6bcf2'], [1, '#33297a']]),
    lg('hhMetal', [0, 0, 1, 1], [[0, '#ffffff'], [0.5, '#d2dbea'], [1, '#7f8fb0']]),
    rg('hhSticker', [0.4, 0.35, 0.75], [[0, '#fff7cf'], [0.6, '#ffd85c'], [1, '#ffb43a']]),
    lg('hhPack', [0, 0, 1, 1], [[0, '#d9e2f4'], [0.5, '#a9b8d8'], [1, '#6f80a8']]),
    lg('hhCart', [0, 0, 0, 1], [[0, '#efe9ff'], [1, '#b7a6ee']]),
    lg('hhLabel', [0, 0, 1, 1], [[0, '#ffb8d9'], [0.5, '#b49cff'], [1, '#7fd8ff']]),
    rg('hhBtnP', [0.38, 0.3, 0.8], [[0, '#fff0e0'], [0.55, '#ffc49a'], [1, '#f08a5a']]),
    rg('hhBtnL', [0.38, 0.3, 0.8], [[0, '#f3ebff'], [0.55, '#c3a8ff'], [1, '#8a62e8']]),
    rg('hhPetal', [0.5, 0.2, 0.9], [[0, '#ffffff'], [0.55, '#f6efff'], [0.85, '#e6d8fb'], [1, '#ffc6de']]),
    rg('hhJewel', [0.38, 0.3, 0.8], [[0, '#f0fffb'], [0.5, '#8ff0e0'], [1, '#6a5ad8']]),
    rg('hhBtnR', [0.38, 0.3, 0.8], [[0, '#ffe3ea'], [0.55, '#ff8fab'], [1, '#e8467a']]),
    rg('hhLed', [0.5, 0.5, 0.5], [[0, '#fff'], [0.35, '#7cf0c8'], [1, '#7cf0c8', 0]]),
    rg('hhFloor', [0.5, 0.5, 0.5], [[0, INK, 0.4], [1, INK, 0]]),
    `<clipPath id="hhBody"><path d="${BODY}"/></clipPath>`,
    '<style>.hh-tw{animation:hh-tw 3.4s ease-in-out infinite}.hh-tw2{animation:hh-tw 3.4s ease-in-out 1.7s infinite}'
      + '.hh-led{animation:hh-led 3s ease-in-out infinite}'
      + '@keyframes hh-tw{0%,100%{opacity:1}50%{opacity:.35}}@keyframes hh-led{0%,100%{opacity:1}50%{opacity:.55}}'
      + '@media (prefers-reduced-motion:reduce){*{animation:none!important}}</style>',
  ].join('');

  // glitter suspended in the plastic, kept off the screen plate
  const rnd = rng(17), dots = [], twinkles = [];
  for (let i = 0; i < 110; i++) {
    const x = 70 + rnd() * 860, y = 90 + rnd() * 1400;
    if (x > PL.x - 16 && x < PL.x + PL.w + 16 && y > PL.y - 16 && y < PL.y + PL.h + 16) continue;
    if (i % 9 === 0) twinkles.push(sparkle(x, y, 6 + rnd() * 5)); else dots.push(circle(x, y, 1.3 + rnd() * 2.2));
  }

  const cut = (idx, a, b) => idx.slice(Math.round(idx.length * a), Math.round(idx.length * b));
  const left = arcIdx(pts, 150, 262), right = arcIdx(pts, 8, 80), all = [...pts.keys()];

  const body = [
    path(ellipse(CX, H - 34, 420, 24), { fill: 'url(#hhFloor)' }),
    cartridge(),
    // clear body: internals first so the tinted plastic sits over them
    g({ clipPath: 'url(#hhBody)' }, internals()),
    path(BODY, { fill: 'url(#hhPlastic)' }),
    g({ clipPath: 'url(#hhBody)' },
      `<rect width="${W}" height="${H}" fill="url(#hhKey)"/><rect width="${W}" height="${H}" fill="url(#hhCool)"/>`,
      path(dots.join(''), { fill: '#fff', fillOpacity: 0.8 }),
      path(twinkles.join(''), { fill: '#fff4c9', fillOpacity: 0.9 }),
      // denser plastic towards the edges
      path(BODY, { fill: 'none', stroke: '#6a64d8', strokeOpacity: 0.16, strokeWidth: 100 }),
      path(BODY, { fill: 'none', stroke: '#4a40b0', strokeOpacity: 0.24, strokeWidth: 30 }),
      // wall thickness
      path(insetLine(pts, nrm, all, 22), { fill: 'none', stroke: '#fff', strokeOpacity: 0.32, strokeWidth: 3 }),
      // light gathered near the base, opposite the key light
      path(crescent(pts, nrm, arcIdx(pts, 52, 128), 16, 90, 1.2), { fill: 'url(#hhCaustic)' }),
      // cool rim light (bottom right)
      path(crescent(pts, nrm, right, 11, 15, 0.8), { fill: '#f0e8ff', fillOpacity: 0.85 }),
      // anime glare: big soft sheen, sharp crescent + a thin echo, round glints added on top
      path(crescent(pts, nrm, arcIdx(pts, 160, 260), 14, 96, 1.4, 0.72), { fill: 'url(#hhSheen)', fillOpacity: 0.5 }),
      path(crescent(pts, nrm, arcIdx(pts, 188, 257), 22, 26, 0.85, 0.66), { fill: '#fff', fillOpacity: 0.95 }),
      path(crescent(pts, nrm, arcIdx(pts, 200, 248), 58, 7, 1, 0.6), { fill: '#fff', fillOpacity: 0.8 }),
      path(crescent(pts, nrm, arcIdx(pts, 138, 184), 20, 10, 1, 0.4), { fill: '#fff', fillOpacity: 0.75 }),
      path(crescent(pts, nrm, arcIdx(pts, 112, 134), 16, 9, 1), { fill: '#fff', fillOpacity: 0.45 }),
      path(crescent(pts, nrm, arcIdx(pts, 262, 300), 14, 22, 1.2, 0.35), { fill: '#fff', fillOpacity: 0.35 }),
      path(crescent(pts, nrm, arcIdx(pts, 318, 336), 20, 9, 1), { fill: '#fff', fillOpacity: 0.8 }),
      path(crescent(pts, nrm, arcIdx(pts, 322, 333), 38, 5, 1), { fill: '#fff', fillOpacity: 0.65 })),
    path(BODY, { fill: 'none', stroke: INK, strokeWidth: 9, strokeLinejoin: 'round' }),
    powerSlide(),
    wheel(),
    sticker(292, 1424, -14),
    plate(),
    flowerPad(),
    buttonTower(),
    menu(),
    speaker(),
    // round glints on the plastic
    path(circle(122, 330, 13), { fill: '#fff', class: 'hh-tw' }),
    path(circle(150, 300, 6.5), { fill: '#fff' }),
    path(circle(880, 1330, 7), { fill: '#fff', fillOpacity: 0.9 }),
    path(sparkle(104, 400, 22, 0.16), { fill: '#fff', class: 'hh-tw2' }),
    // sparkles around
    path(sparkle(54, 130, 22), { fill: '#fff4c9', stroke: INK, strokeWidth: 3, class: 'hh-tw' }),
    path(sparkle(966, 900, 18), { fill: '#ffd0e4', stroke: INK, strokeWidth: 3, class: 'hh-tw2' }),
    path(sparkle(950, 1460, 16), { fill: '#c9f0ff', stroke: INK, strokeWidth: 3 }),
    path(star(48, 1480, 15, 6.5), { fill: '#ffe372', stroke: INK, strokeWidth: 3, strokeLinejoin: 'round' }),
  ].join('\n');
  return { defs, body };
}

module.exports = {
  W, H, hole, radius, draw,
  meta: { name: 'Handheld', theme: 'classic', translucent: true,
    desc: 'A clear frost console shimmering aqua to lilac, with a flower pad, a tower of jelly buttons and a crystal game card peeking out the top.',
    tags: ['starter', 'handheld', 'console', 'clear', 'retro'] },
};
