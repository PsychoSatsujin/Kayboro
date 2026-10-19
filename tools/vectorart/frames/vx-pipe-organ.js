'use strict';
// Pipe Organ: a grand gothic organ case. Silver display pipes with gilded mouths rise behind and above
// the screen in a symmetric fan (a tall centre tower, two dipping flats and two outer towers) against a
// deep crimson back, with a second rank of brass pipes behind; pointed carved canopies with crockets and
// pinnacle finials crown the towers and gilded tracery shades hang over the flats. The screen sits in the
// carved console under a gilded impost, flanked by stop jambs of ivory drawknobs, above two manuals and a
// pedalboard. Architectural ornament only (pointed arches, cusps, quatrefoils); no religious figures or
// symbols. Original Kayboro artwork, CC BY 4.0.
const L = require('../lib');
const { rr, poly, path, g, lg, rg, circle, ellipse, rng, lip, n, P } = L;

const W = 1600, H = 1760, hole = { x: 400, y: 862, w: 800, h: 450 }, radius = 10;
const CX = W / 2;
const INK = '#140a06';
const IMPOST = 780; // top of the gilded impost band under the pipes
const n1 = (v) => +(+v).toFixed(1);
const P1 = (...v) => v.map(n1).join(' ');

// ---- pipes ---------------------------------------------------------------------------------------
/** One flue pipe: open top rim, cylindrical body, gilded shield-shaped mouth and a conical foot. */
function pipe(x, top, mouth, foot, w, metal = 'silver') {
  const cx = x + w / 2, mw = w * 0.62, lipH = w * 0.9, tip = w * 0.14;
  const bodyD = `M${P1(x, top)}H${n1(x + w)}V${n1(mouth + w * 0.25)}L${P1(cx + tip, foot)}H${n1(cx - tip)}L${P1(x, mouth + w * 0.25)}Z`;
  const upper = `M${P1(cx - mw / 2, mouth)}V${n1(mouth - lipH * 0.45)}Q${P1(cx - mw / 2, mouth - lipH, cx, mouth - lipH * 1.1)}Q${P1(cx + mw / 2, mouth - lipH, cx + mw / 2, mouth - lipH * 0.45)}V${n1(mouth)}Z`;
  const slot = rr(cx - mw / 2, mouth, mw, w * 0.2, 2);
  const lower = `M${P1(cx - mw / 2, mouth + w * 0.2)}H${n1(cx + mw / 2)}Q${P1(cx + mw * 0.3, mouth + w * 0.75, cx, mouth + w * 0.95)}Q${P1(cx - mw * 0.3, mouth + w * 0.75, cx - mw / 2, mouth + w * 0.2)}Z`;
  return {
    body: bodyD, upper, slot, lower,
    rim: ellipse(cx, top, w / 2, Math.max(3, w * 0.12)),
    hole: ellipse(cx, top + 1, w * 0.36, Math.max(1.8, w * 0.07)),
    glint: `M${n1(x + w * 0.28)} ${n1(top + 10)}V${n1(mouth - lipH - 8)}`,
    metal,
  };
}

/** Draw a rank of pipe records with one gradient per metal (bodies in objectBoundingBox each). */
function rank(list, shadow = true) {
  const by = (m) => list.filter((p) => p.metal === m);
  let out = '';
  for (const m of ['brass', 'silver']) {
    const ps = by(m);
    if (!ps.length) continue;
    if (shadow) out += path(ps.map((p) => p.body).join(''), { fill: '#000', fillOpacity: 0.35, transform: 'translate(7 6)' });
    out += ps.map((p) => path(p.body, { fill: `url(#${m})`, stroke: INK, strokeWidth: 2.5, strokeLinejoin: 'round' })).join('');
    out += path(ps.map((p) => p.rim).join(''), { fill: `url(#${m}Rim)`, stroke: INK, strokeWidth: 2 });
    out += path(ps.map((p) => p.hole).join(''), { fill: '#120708' });
    out += path(ps.map((p) => p.glint).join(''), { stroke: '#fff', strokeOpacity: m === 'silver' ? 0.7 : 0.45, strokeWidth: 3, strokeLinecap: 'round' });
    out += path(ps.map((p) => p.upper).join(''), { fill: 'url(#goldLip)', stroke: INK, strokeWidth: 2 });
    out += path(ps.map((p) => p.lower).join(''), { fill: 'url(#goldLip)', stroke: INK, strokeWidth: 2 });
    out += path(ps.map((p) => p.slot).join(''), { fill: '#0b0405' });
  }
  return out;
}

/** Pipes laid side by side from x0 with tops given by topAt(i) (left half), mirrored to the right. */
function group(x0, count, w, gap, topAt, mouthAt, foot, metal, mirrorIt = true) {
  const out = [];
  for (let i = 0; i < count; i++) {
    const x = x0 + i * (w + gap), t = topAt(i), m = mouthAt(i);
    out.push(pipe(x, t, m, foot, w, typeof metal === 'function' ? metal(i) : metal));
    if (mirrorIt) out.push(pipe(W - x - w, t, m, foot, w, typeof metal === 'function' ? metal(i) : metal));
  }
  return out;
}

// ---- carving -------------------------------------------------------------------------------------
/** Pointed (two-centred) arch opening from (x0, yb) to (x1, yb) rising to apex height h. */
function pointed(x0, x1, yb, h) {
  const cx = (x0 + x1) / 2;
  return `M${P1(x0, yb)}C${P1(x0, yb - h * 0.62, cx - (x1 - x0) * 0.18, yb - h * 0.9, cx, yb - h)}C${P1(cx + (x1 - x0) * 0.18, yb - h * 0.9, x1, yb - h * 0.62, x1, yb)}`;
}

/** A quatrefoil centred at (cx, cy). */
function quatrefoil(cx, cy, r) {
  const k = r * 0.48;
  return `M${P1(cx, cy - r)}A${P1(k, k)} 0 1 1 ${P1(cx + r, cy)}A${P1(k, k)} 0 1 1 ${P1(cx, cy + r)}A${P1(k, k)} 0 1 1 ${P1(cx - r, cy)}A${P1(k, k)} 0 1 1 ${P1(cx, cy - r)}Z`;
}

/** Point on the quadratic rake from (x0, yb) through control c to apex a, at t. */
const quadAt = (p0, c, p2, t) => [0, 1].map((j) => (1 - t) ** 2 * p0[j] + 2 * (1 - t) * t * c[j] + t * t * p2[j]);

/** Gothic gable canopy: steep slightly concave rakes with crockets, a cusped lancet and an oculus with a
 *  quatrefoil, spirelets at the eaves and a pinnacle finial at the apex. */
function canopy(x0, x1, yb, h) {
  const cx = (x0 + x1) / 2, Lx = x0 - 18, Rx = x1 + 18, apex = [cx, yb - h];
  const cl = [Lx + (cx - Lx) * 0.46, yb - h * 0.36], crr = [Rx - (Rx - cx) * 0.46, yb - h * 0.36];
  const gable = `M${P1(Lx, yb)}Q${P1(...cl)} ${P1(...apex)}Q${P1(...crr)} ${P1(Rx, yb)}Z`;
  const inset = `M${P1(Lx + 22, yb - 4)}Q${P1(cl[0] + 10, cl[1] + 6)} ${P1(cx, yb - h + 26)}Q${P1(crr[0] - 10, crr[1] + 6)} ${P1(Rx - 22, yb - 4)}`;
  let crockets = '';
  for (const t of [0.2, 0.36, 0.52, 0.68, 0.83]) {
    for (const [p0, c, d] of [[[Lx, yb], cl, -1], [[Rx, yb], crr, 1]]) {
      const [x, y] = quadAt(p0, c, apex, t), k = 1.1 - t * 0.4;
      // a curled leaf: a lobe leaning up and out from the rake, its tip rolled back over
      crockets += `M${P1(x - d * 4 * k, y + 4 * k)}C${P1(x + d * 10 * k, y + 2 * k, x + d * 16 * k, y - 10 * k, x + d * 8 * k, y - 18 * k)}`
        + `C${P1(x + d * 4 * k, y - 22 * k, x - d * 2 * k, y - 16 * k, x + d * 3 * k, y - 12 * k)}C${P1(x + d * 6 * k, y - 8 * k, x, y - 4 * k, x - d * 6 * k, y - 4 * k)}Z`;
    }
  }
  const lancet = `${pointed(x0 + 34, x1 - 34, yb - 6, h * 0.46)}Z`;
  const r = Math.min(24, (x1 - x0) * 0.09), oy = yb - h * 0.62, lw = (x1 - x0 - 68) / 2;
  const lights = `${pointed(x0 + 46, x0 + 34 + lw - 8, yb - 6, h * 0.3)}Z${pointed(cx + 8, x1 - 46, yb - 6, h * 0.3)}Z`;
  const trefoil = quatrefoil(cx, yb - 6 - h * 0.36, Math.min(16, lw * 0.22));
  const pinnacle = `M${P1(cx - 14, apex[1] + 22)}L${P1(cx, apex[1] - 54)}L${P1(cx + 14, apex[1] + 22)}Z`;
  return g({},
    path(gable, { fill: '#000', fillOpacity: 0.35, transform: 'translate(6 8)' }),
    path(gable, { fill: 'url(#wood)', stroke: INK, strokeWidth: 4, strokeLinejoin: 'round' }),
    path(crockets, { fill: 'url(#gold)', stroke: INK, strokeWidth: 1.8, strokeLinejoin: 'round' }),
    path(inset, { fill: 'none', stroke: 'url(#gold)', strokeWidth: 4, strokeLinejoin: 'round' }),
    path(lancet, { fill: 'url(#woodPanel)', stroke: 'url(#gold)', strokeWidth: 4 }),
    path(lights, { fill: '#2a0a12', stroke: 'url(#gold)', strokeWidth: 3 }),
    path(trefoil, { fill: '#2a0a12', stroke: 'url(#gold)', strokeWidth: 2.5 }),
    path(circle(cx, oy, r), { fill: '#2a0a12', stroke: 'url(#gold)', strokeWidth: 3.5 }),
    path(quatrefoil(cx, oy, r * 0.72), { fill: 'none', stroke: 'url(#gold)', strokeWidth: 2.5 }),
    path(pinnacle, { fill: 'url(#gold)', stroke: INK, strokeWidth: 3, strokeLinejoin: 'round' }),
    path(circle(cx, apex[1] - 60, 10), { fill: 'url(#goldBall)', stroke: INK, strokeWidth: 3 }),
    path(circle(cx - 3.5, apex[1] - 63.5, 3), { fill: '#fff', fillOpacity: 0.85 }),
    path(rr(x0 - 28, yb - 4, x1 - x0 + 56, 22, 6), { fill: 'url(#gold)', stroke: INK, strokeWidth: 3 }));
}

/** A slim crocketed pinnacle (buttress spire) standing from y0 up to a tip at y1. */
function spire(cx, y0, y1, w = 22) {
  const shaft = rr(cx - w / 2, y1 + 70, w, y0 - y1 - 70, 3);
  const tipD = `M${P1(cx - w / 2 - 4, y1 + 74)}L${P1(cx, y1)}L${P1(cx + w / 2 + 4, y1 + 74)}Z`;
  let crock = '';
  for (let k = 1; k <= 3; k++) {
    const t = k / 4, y = y1 + 74 * t, hw = (w / 2 + 4) * t;
    crock += `M${P1(cx - hw + 2, y)}c-8 0 -14 -8 -8 -16c2 4 6 5 8 3c-2 4 0 8 0 13ZM${P1(cx + hw - 2, y)}c8 0 14 -8 8 -16c-2 4 -6 5 -8 3c2 4 0 8 0 13Z`;
  }
  return path(shaft, { fill: 'url(#woodPanel)', stroke: INK, strokeWidth: 3 })
    + path(`M${cx} ${y1 + 80}V${y0 - 6}`, { stroke: 'url(#gold)', strokeWidth: 3 })
    + path(rr(cx - w / 2 - 5, y1 + 66, w + 10, 12, 3), { fill: 'url(#gold)', stroke: INK, strokeWidth: 2 })
    + path(tipD, { fill: 'url(#wood)', stroke: INK, strokeWidth: 3, strokeLinejoin: 'round' })
    + path(crock, { fill: 'url(#gold)', stroke: INK, strokeWidth: 1.6 })
    + path(circle(cx, y1 - 6, 8), { fill: 'url(#goldBall)', stroke: INK, strokeWidth: 2.5 });
}

/** Gilded tracery shade over a flat: a sloping carved valance of cusped arches between topAt and bottomAt. */
function shade(x0, x1, topAt, bottomAt, cnt = 6) {
  const w = (x1 - x0) / cnt;
  let fill = `M${P1(x0, topAt(x0))}L${P1(x1, topAt(x1))}`, arches = '', foils = '';
  for (let i = cnt - 1; i >= 0; i--) {
    const a = x0 + i * w, b = a + w, m = (a + b) / 2, ya = bottomAt(a), yb = bottomAt(b), ym = bottomAt(m);
    fill += `L${P1(b, yb)}C${P1(b - w * 0.1, yb + 8, m + w * 0.2, ym + 26, m, ym + 34)}C${P1(m - w * 0.2, ym + 26, a + w * 0.1, ya + 8, a, ya)}`;
    const ty = topAt(m);
    arches += pointed(a + 7, b - 7, ym - 2, (ym - ty) * 0.6);
    foils += quatrefoil(m, ty + (ym - ty) * 0.24, Math.min(10, w * 0.2));
  }
  fill += 'Z';
  return g({},
    path(fill, { fill: '#000', fillOpacity: 0.3, transform: 'translate(5 7)' }),
    path(fill, { fill: 'url(#wood)', stroke: INK, strokeWidth: 3.5, strokeLinejoin: 'round' }),
    path(`M${P1(x0, topAt(x0) + 6)}L${P1(x1, topAt(x1) + 6)}`, { stroke: 'url(#gold)', strokeWidth: 4 }),
    path(arches, { fill: 'none', stroke: 'url(#gold)', strokeWidth: 3.5 }),
    path(foils, { fill: 'none', stroke: 'url(#gold)', strokeWidth: 2.5 }));
}

// ---- console -------------------------------------------------------------------------------------
function drawknob(cx, cy, r, ring, out = 0) {
  return path(circle(cx + 4 + out, cy + 6 + out, r + 2), { fill: '#000', fillOpacity: 0.32 })
    + (out ? path(rr(cx - r * 0.4, cy, r * 0.8, r + out, 4), { fill: '#3a2a20', stroke: INK, strokeWidth: 2 }) : '')
    + path(circle(cx, cy, r), { fill: `url(#knob-${ring})`, stroke: INK, strokeWidth: 3 })
    + path(circle(cx, cy, r * 0.7), { fill: 'url(#ivory)', stroke: INK, strokeOpacity: 0.5, strokeWidth: 1.5 })
    + path(ellipse(cx - r * 0.25, cy - r * 0.3, r * 0.26, r * 0.14), { fill: '#fff', fillOpacity: 0.8, transform: `rotate(-30 ${n1(cx - r * 0.25)} ${n1(cy - r * 0.3)})` });
}

function jamb(x0, mirror) {
  const w = 230, y0 = hole.y - 16, h = hole.h + 32;
  const rings = ['red', 'ink', 'ivory', 'red', 'ink'];
  let knobs = '';
  for (let r = 0; r < 5; r++) for (let c = 0; c < 2; c++) {
    const x = x0 + 70 + c * 92, y = y0 + 58 + r * 84, ring = rings[(r + c * 2 + (mirror ? 1 : 0)) % 5];
    knobs += drawknob(x, y, 27, ring, (r * 3 + c + (mirror ? 2 : 0)) % 4 === 0 ? 5 : 0);
  }
  return g({},
    path(rr(x0, y0, w, h, 14), { fill: 'url(#woodPanel)', stroke: INK, strokeWidth: 4 }),
    path(rr(x0 + 10, y0 + 10, w - 20, h - 20, 8), { fill: 'none', stroke: 'url(#gold)', strokeWidth: 3 }),
    knobs);
}

function manual(x0, x1, y0, h, nW) {
  const kw = (x1 - x0) / nW, bw = kw * 0.58, bh = h * 0.62;
  let whites = '', fronts = '', blacks = '', shine = '';
  for (let i = 0; i < nW; i++) {
    const x = x0 + i * kw;
    whites += rr(x + 1.5, y0, kw - 3, h, [0, 0, 4, 4]);
    fronts += `M${n1(x + 2)} ${n1(y0 + h - 7)}H${n1(x + kw - 2)}`;
  }
  const hasBlack = [1, 1, 0, 1, 1, 1, 0];
  for (let i = 0; i < nW - 1; i++) {
    if (!hasBlack[i % 7]) continue;
    const x = x0 + (i + 1) * kw - bw / 2;
    blacks += rr(x, y0, bw, bh, [0, 0, 4, 4]);
    shine += `M${n1(x + bw * 0.3)} ${n1(y0 + 6)}V${n1(y0 + bh - 10)}`;
  }
  return g({},
    path(rr(x0 - 30, y0 - 14, x1 - x0 + 60, h + 24, 8), { fill: '#0d0605', stroke: INK, strokeWidth: 3 }),
    path(whites, { fill: 'url(#keyIvory)', stroke: INK, strokeWidth: 2 }),
    path(fronts, { stroke: '#a8986e', strokeOpacity: 0.6, strokeWidth: 3 }),
    path(blacks, { fill: 'url(#ebony)', stroke: INK, strokeWidth: 2 }),
    path(shine, { stroke: '#fff', strokeOpacity: 0.3, strokeWidth: 3, strokeLinecap: 'round' }),
    // carved key cheeks with a gilded scroll
    ...[x0 - 40, x1 + 4].map((x) => path(rr(x, y0 - 18, 36, h + 30, 8), { fill: 'url(#wood)', stroke: INK, strokeWidth: 3 })
      + path(`M${x + 18} ${y0 + h - 4}C${x + 6} ${y0 + h - 20} ${x + 8} ${y0 + 10} ${x + 20} ${y0 + 6}A8 8 0 1 1 ${x + 22} ${y0 + 20}`, { fill: 'none', stroke: 'url(#gold)', strokeWidth: 3, strokeLinecap: 'round' })));
}

function pedals() {
  const x0 = 300, x1 = 1300, y0 = 1604, h = 96, cnt = 17, w = (x1 - x0) / cnt;
  let nat = '', sharp = '';
  for (let i = 0; i < cnt; i++) nat += rr(x0 + i * w + 4, y0, w - 8, h, [3, 3, 8, 8]);
  const hasBlack = [1, 1, 0, 1, 1, 1, 0];
  for (let i = 0; i < cnt - 1; i++) if (hasBlack[i % 7]) sharp += rr(x0 + (i + 1) * w - w * 0.32, y0 - 6, w * 0.64, h * 0.5, [3, 3, 6, 6]);
  return g({},
    path(rr(x0 - 40, y0 - 22, x1 - x0 + 80, h + 40, 12), { fill: '#0d0605', stroke: INK, strokeWidth: 4 }),
    path(nat, { fill: 'url(#pedalWood)', stroke: INK, strokeWidth: 2.5 }),
    path(sharp, { fill: 'url(#ebony)', stroke: INK, strokeWidth: 2.5 }));
}

function screenFrame() {
  const o = 34, f = rr(hole.x - o, hole.y - o, hole.w + 2 * o, hole.h + 2 * o, radius + o);
  return g({},
    path(rr(hole.x - o + 6, hole.y - o + 10, hole.w + 2 * o, hole.h + 2 * o, radius + o), { fill: '#000', fillOpacity: 0.38 }),
    path(f, { fill: 'url(#gold)', stroke: INK, strokeWidth: 4 }),
    path(rr(hole.x - o + 9, hole.y - o + 9, hole.w + 2 * o - 18, hole.h + 2 * o - 18, radius + o - 9), { fill: 'none', stroke: '#6e4610', strokeWidth: 3 }),
    path(rr(hole.x - 12, hole.y - 12, hole.w + 24, hole.h + 24, radius + 12), { fill: '#1a0b07', stroke: '#6e4610', strokeWidth: 2 }),
    lip(rr(hole.x, hole.y, hole.w, hole.h, radius), '#000', [[6, 0.35], [2.5, 0.6]]),
    path(`M${hole.x - o + 6} ${hole.y + 140}V${hole.y + radius}Q${hole.x - o + 6} ${hole.y - o + 6} ${hole.x + radius} ${hole.y - o + 6}H${hole.x + 240}`, { fill: 'none', stroke: '#fff6d0', strokeOpacity: 0.8, strokeWidth: 4, strokeLinecap: 'round' }),
    // a carved crest on the top rail of the frame (scrolls and a quatrefoil)
    path(`M${CX - 90} ${hole.y - o + 2}C${CX - 60} ${hole.y - o - 40} ${CX - 24} ${hole.y - o - 20} ${CX} ${hole.y - o - 46}C${CX + 24} ${hole.y - o - 20} ${CX + 60} ${hole.y - o - 40} ${CX + 90} ${hole.y - o + 2}Z`, { fill: 'url(#gold)', stroke: INK, strokeWidth: 3, strokeLinejoin: 'round' }),
    path(quatrefoil(CX, hole.y - o - 14, 12), { fill: '#2a0a12', stroke: INK, strokeWidth: 2 }));
}

// ---- case ----------------------------------------------------------------------------------------
function caseBody() {
  const half = [[70, IMPOST + 40], [70, 366], [346, 366], [346, 418], [612, 272], [616, 306], [CX, 306]];
  const upper = `M${[...half, ...[...half].reverse().map(([x, y]) => [W - x, y])].map((q) => P1(...q)).join('L')}Z`;
  const lower = rr(110, IMPOST + 30, W - 220, 1580 - IMPOST - 30, [0, 0, 16, 16]);
  const base = rr(80, 1560, W - 160, 170, [10, 10, 20, 20]);
  const qf = [];
  for (const x of [190, 1410]) for (const y of [1420, 1500]) qf.push(quatrefoil(x, y, 22));
  return g({},
    path(ellipse(CX, H - 18, 760, 16), { fill: '#000', fillOpacity: 0.32 }),
    path(base, { fill: 'url(#wood)', stroke: INK, strokeWidth: 5 }),
    path(`M100 1590H${W - 100}`, { stroke: 'url(#gold)', strokeWidth: 5 }),
    path(lower, { fill: 'url(#wood)', stroke: INK, strokeWidth: 5 }),
    // carved pilasters at the console corners
    ...[110, W - 160].map((x) => path(rr(x, IMPOST + 40, 50, 1540 - IMPOST, 6), { fill: 'url(#woodPanel)', stroke: INK, strokeWidth: 3 })
      + path(`M${x + 14} ${IMPOST + 70}V${1540}M${x + 36} ${IMPOST + 70}V${1540}`, { stroke: 'url(#gold)', strokeWidth: 2.5 })),
    path(qf.join(''), { fill: '#2a0a12', stroke: 'url(#gold)', strokeWidth: 3 }),
    // crimson back of the pipe chamber
    path(upper, { fill: 'url(#velvet)', stroke: INK, strokeWidth: 5 }),
    path(ellipse(CX, 540, 520, 300), { fill: 'url(#warm)', clipPath: 'url(#backClip)' }));
}

function impost() {
  return g({},
    path(rr(50, IMPOST - 4, W - 100, 50, 6), { fill: '#000', fillOpacity: 0.4, transform: 'translate(0 8)' }),
    path(rr(50, IMPOST - 4, W - 100, 50, 6), { fill: 'url(#wood)', stroke: INK, strokeWidth: 4 }),
    path(rr(50, IMPOST - 4, W - 100, 14, 4), { fill: 'url(#gold)', stroke: INK, strokeWidth: 2.5 }),
    path(rr(50, IMPOST + 32, W - 100, 14, 4), { fill: 'url(#gold)', stroke: INK, strokeWidth: 2.5 }),
    path(Array.from({ length: 36 }, (_, i) => circle(78 + i * 41.5, IMPOST + 21, 6)).join(''), { fill: 'url(#goldBall)', stroke: INK, strokeWidth: 1.5 }));
}

function draw() {
  const silver = [[0, '#59616e'], [0.18, '#c9d0da'], [0.32, '#f7f9fc'], [0.5, '#c5ccd6'], [0.78, '#8a94a2'], [1, '#434a56']];
  const brass = [[0, '#5a3a10'], [0.2, '#c99a42'], [0.34, '#fbe3a0'], [0.52, '#d4a64c'], [0.8, '#8a5e1c'], [1, '#4a2e08']];
  const defs = [
    lg('silver', [0, 0, 1, 0], silver), lg('brass', [0, 0, 1, 0], brass),
    lg('silverRim', [0, 0, 1, 0], [[0, '#8a94a2'], [0.4, '#ffffff'], [1, '#6a7380']]),
    lg('brassRim', [0, 0, 1, 0], [[0, '#8a5e1c'], [0.4, '#fff0c0'], [1, '#6e4610']]),
    lg('goldLip', [0, 0, 1, 1], [[0, '#fff2b8'], [0.45, '#e8b84a'], [1, '#8a5a14']]),
    lg('gold', [0, 0, 1, 1], [[0, '#fff0b0'], [0.3, '#ecc25a'], [0.65, '#b07a22'], [1, '#e2b450']]),
    rg('goldBall', [0.38, 0.32, 0.75], [[0, '#fff6cc'], [0.5, '#e8b84a'], [1, '#7a4e10']]),
    lg('wood', [0, 0, 1, 1], [[0, '#5a3020'], [0.5, '#3b1d12'], [1, '#1e0d07']]),
    lg('woodPanel', [0, 0, 0, 1], [[0, '#4a2616'], [1, '#26110a']]),
    lg('velvet', [0, 0, 0, 1], [[0, '#2a0710'], [0.5, '#4a1020'], [1, '#2a0810']]),
    rg('warm', [0.5, 0.5, 0.5], [[0, '#ffb070', 0.3], [1, '#ffb070', 0]]),
    rg('knob-red', [0.4, 0.35, 0.75], [[0, '#ff8a7a'], [1, '#8a1a14']]),
    rg('knob-ink', [0.4, 0.35, 0.75], [[0, '#6a6a72'], [1, '#121216']]),
    rg('knob-ivory', [0.4, 0.35, 0.75], [[0, '#ffffff'], [1, '#b9ac88']]),
    rg('ivory', [0.4, 0.35, 0.8], [[0, '#fffdf4'], [1, '#e2d6b6']]),
    lg('keyIvory', [0, 0, 0, 1], [[0, '#e8dfc6'], [0.15, '#fffaee'], [1, '#efe4c8']]),
    lg('ebony', [0, 0, 0, 1], [[0, '#3a2c26'], [0.85, '#120a08'], [1, '#2c201c']]),
    lg('pedalWood', [0, 0, 0, 1], [[0, '#f0cf96'], [1, '#b98a4c']]),
    `<clipPath id="backClip"><path d="M70 0H${W - 70}V${IMPOST + 40}H70Z"/></clipPath>`,
  ].join('');

  // left flat rises toward the centre tower; a brass back rank stands a step higher behind it
  const flatTop = (i) => 460 - i * 24, flatX = 350, flatW = 32, flatGap = 6;
  const back = group(flatX + 16, 7, 28, 10, (i) => flatTop(i) - 74, (i) => 640 - i * 4, IMPOST, 'brass');
  const flats = group(flatX, 7, flatW, flatGap, flatTop, (i) => 676 - i * 6, IMPOST, 'silver');
  const outer = group(78, 5, 44, 8, (i) => 336 + Math.abs(i - 2) * 12, () => 650, IMPOST, 'silver');
  const centre = [];
  for (let i = 0; i < 7; i++) { const x = CX - (7 * 50 - 6) / 2 + i * 50; centre.push(pipe(x, 284 + Math.abs(i - 3) * 14, 624, IMPOST, 44, 'silver')); }
  const slope = (x0, x1, y0, y1) => (x) => y0 + ((x - x0) / (x1 - x0)) * (y1 - y0);
  const shTop = slope(346, 614, 322, 178), shBot = slope(346, 614, 374, 230);

  const body = [
    caseBody(),
    rank(back),
    rank(flats),
    shade(346, 614, shTop, shBot), shade(W - 614, W - 346, (x) => shTop(W - x), (x) => shBot(W - x)),
    rank(outer), rank(centre),
    spire(340, IMPOST, 236), spire(W - 340, IMPOST, 236), spire(620, IMPOST, 120), spire(W - 620, IMPOST, 120), spire(58, IMPOST, 250), spire(W - 58, IMPOST, 250),
    canopy(74, 330, 336, 196), canopy(W - 330, W - 74, 336, 196), canopy(CX - 176, CX + 176, 282, 214),
    impost(),
    jamb(150, false), jamb(W - 150 - 230, true),
    screenFrame(),
    manual(360, 1240, 1388, 70, 15), manual(320, 1280, 1484, 74, 17),
    pedals(),
  ].join('\n');
  return { defs, body };
}

module.exports = {
  W, H, hole, radius, draw,
  meta: {
    name: 'Pipe Organ', theme: 'gothic-organ', rarity: 'legendary',
    desc: 'Pull out every stop: a towering fan of silver pipes thunders above your game in a carved gothic case.',
    tags: ['organ', 'music', 'gothic', 'instrument', 'grand'],
    collection: 'wild-tuneful', license: 'CC-BY-4.0',
  },
};
