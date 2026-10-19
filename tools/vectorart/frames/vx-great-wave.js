'use strict';
// Great Wave: a woodblock-print seascape in a carved wooden frame. A towering Prussian-blue wave rises
// up the left side, its crest breaking into claw-like foam that reaches over the top-left of the screen;
// a row of smaller striped swells rolls along the bottom, a red mountain with a snow cap peeks out from
// behind the screen at the top right under a band of mist, with puffy rows of cloud, a few sea birds, an
// indigo top-of-sky gradation, sea spray like falling snow, paper fibres and a red artist's seal (an
// abstract wave mark, no lettering). Original Kayboro artwork in the ukiyo-e manner, CC BY 4.0.
const L = require('../lib');
const { rr, path, g, lg, rg, circle, ellipse, tf, rng, lip, n, P } = L;

const W = 1600, H = 1170, hole = { x: 500, y: 340, w: 944, h: 531 }, radius = 4;
const B = 58; // wooden frame width
const INK = '#1b2846';
const FOAM = '#f8f2e2';

// ---- curve helpers ------------------------------------------------------------------------------
/** Catmull-Rom spline through pts as cubic Beziers (absolute). */
function cr(pts, { closed = false, move = true } = {}) {
  const k = 1 / 6, p = closed ? [pts[pts.length - 1], ...pts, pts[0], pts[1]] : [pts[0], ...pts, pts[pts.length - 1]];
  let d = `${move ? 'M' : 'L'}${P(...pts[0])}`;
  for (let i = 1; i < p.length - 2; i++) {
    const [x0, y0] = p[i - 1], [x1, y1] = p[i], [x2, y2] = p[i + 1], [x3, y3] = p[i + 2];
    d += `C${P(x1 + (x2 - x0) * k, y1 + (y2 - y0) * k, x2 - (x3 - x1) * k, y2 - (y3 - y1) * k, x2, y2)}`;
  }
  return closed ? `${d}Z` : d;
}

/** Points evaluated densely along the Catmull-Rom spline, then resampled evenly by arc length (count m). */
function resample(pts, m) {
  const p = [pts[0], ...pts, pts[pts.length - 1]], dense = [];
  for (let i = 1; i < p.length - 2; i++) {
    const [a, b, c, d] = [p[i - 1], p[i], p[i + 1], p[i + 2]];
    for (let s = 0; s < 1; s += 1 / 24) {
      const s2 = s * s, s3 = s2 * s;
      dense.push([0, 1].map((j) => 0.5 * ((2 * b[j]) + (-a[j] + c[j]) * s + (2 * a[j] - 5 * b[j] + 4 * c[j] - d[j]) * s2 + (-a[j] + 3 * b[j] - 3 * c[j] + d[j]) * s3)));
    }
  }
  dense.push(pts[pts.length - 1]);
  const len = [0];
  for (let i = 1; i < dense.length; i++) len.push(len[i - 1] + Math.hypot(dense[i][0] - dense[i - 1][0], dense[i][1] - dense[i - 1][1]));
  const out = [], tot = len[len.length - 1];
  for (let k = 0, j = 0; k < m; k++) {
    const t = (tot * k) / (m - 1);
    while (j < len.length - 2 && len[j + 1] < t) j++;
    const u = (t - len[j]) / (len[j + 1] - len[j] || 1);
    out.push([dense[j][0] + (dense[j + 1][0] - dense[j][0]) * u, dense[j][1] + (dense[j + 1][1] - dense[j][1]) * u]);
  }
  return out;
}
const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
const n1 = (v) => +(+v).toFixed(1);
const P1 = (...v) => v.map(n1).join(' ');
const line = (pts) => `M${pts.map((q) => P1(...q)).join('L')}`;
/** Round dots as zero-length round-capped strokes: [[x, y, r]]. */
function dots(list, color, a = 1) {
  const by = new Map();
  for (const [x, y, r] of list) { const k = Math.max(1, Math.round(r * 2)); by.set(k, (by.get(k) || '') + `M${P1(x, y)}h0`); }
  return [...by].map(([k, d]) => path(d, { stroke: color, strokeOpacity: a, strokeWidth: k, strokeLinecap: 'round' })).join('');
}

// ---- foam ----------------------------------------------------------------------------------------
// One claw of foam in unit space, pointing along +x from a root spanning y -1..1: a swelling lobe that
// ends in four hooked talons curling toward +y. [outline (open at the root), closing segment]
const CLAW = [
  [[0, -1]],
  ['C', 0.34, -1.3, 0.72, -1.12, 0.92, -0.6],
  ['Q', 1.16, -0.46, 1.1, 0.02], ['Q', 0.98, -0.2, 0.84, -0.14],
  ['Q', 1.02, 0.12, 0.95, 0.46], ['Q', 0.86, 0.22, 0.73, 0.26],
  ['Q', 0.85, 0.54, 0.75, 0.82], ['Q', 0.66, 0.56, 0.55, 0.6],
  ['Q', 0.6, 0.88, 0.47, 1.04], ['Q', 0.42, 0.82, 0.33, 0.86],
  ['C', 0.22, 0.98, 0.1, 1.04, 0, 1],
];
function clawPath(len, h) {
  const X = (v) => n1(v * len), Y = (v) => n1(v * h);
  let d = `M${X(CLAW[0][0][0])} ${Y(CLAW[0][0][1])}`;
  for (const [c, ...v] of CLAW.slice(1)) d += c + v.map((q, i) => (i % 2 ? Y(q) : X(q))).join(' ');
  return d;
}
/** A foam claw at (x, y) rotated rot degrees; flip mirrors the curl. The path is left open at the root:
 *  it fills as if closed but is only stroked along its edge, so it melts into the foam it grows from.
 *  Wrap claws in clawGroup() for their paint. */
function claw(x, y, rot, len, w, flip = 1) {
  return path(clawPath(len, (w / 2) * flip), { transform: tf(x, y, rot) });
}
const clawGroup = (list) => g({ fill: 'url(#gwClaw)', stroke: INK, strokeWidth: 2.4, strokeLinejoin: 'round', strokeLinecap: 'round' }, list.join(''));

/** Foam spray: round drops with an inked rim. */
function drops(list) {
  return path(list.map(([x, y, r]) => circle(x, y, r)).join(''), { fill: '#fffdf6', stroke: '#7f9cc0', strokeWidth: 1.2 });
}

/** Scallops bulging to the right of the direction of travel along pts. */
function scallopEdge(pts, depth = 0.5) {
  let d = '';
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i], [x1, y1] = pts[i + 1], mx = (x0 + x1) / 2, my = (y0 + y1) / 2, k = depth * (0.75 + 0.45 * Math.sin(i * 1.9));
    d += `M${P(x0, y0)}Q${P(mx - (y1 - y0) * k, my + (x1 - x0) * k)} ${P(x1, y1)}Z`;
  }
  return d;
}

// ---- the big wave --------------------------------------------------------------------------------
// The back of the wave climbs the left edge and arches right over the top of the screen to the lip; the
// face (the hollow the screen sits in) runs from the lip underside back and down beside the screen.
const BACK = [[16, 1130], [18, 900], [22, 680], [30, 500], [54, 356], [104, 240], [184, 152], [292, 92], [424, 62], [566, 58], [700, 80], [818, 126], [914, 190], [976, 262]];
const TIP = [968, 312];
const FACE = [[940, 296], [890, 262], [818, 236], [730, 224], [640, 232], [560, 258], [498, 304], [458, 372], [436, 470], [428, 600], [440, 750], [482, 900], [560, 1030], [660, 1130]];

function bigWave() {
  const body = `${cr(BACK)}L${P(...TIP)}${cr(FACE, { move: false })}Z`;
  // striations: bands between the face and the back, evenly resampled so they follow the curl
  const m = 46, back = resample(BACK, m), face = resample([...FACE].reverse(), m);
  const at = (s) => back.map((q, i) => lerp(face[i], q, s));
  const taper = (i, a, z) => Math.sin(Math.PI * Math.min(1, Math.max(0, (i - a) / (m - a - z)))) ** 0.55;
  let bands = '';
  [[0.05, 0.03], [0.13, 0.026], [0.22, 0.022], [0.32, 0.026], [0.43, 0.02], [0.55, 0.024], [0.67, 0.018], [0.78, 0.016]].forEach(([s, w], k) => {
    const mid = at(s), a = at(s - w), c = at(s + w), z = k < 3 ? 4 : 10;
    const lo = a.map((q, i) => lerp(mid[i], q, taper(i, 2 + k, z))), hi = c.map((q, i) => lerp(mid[i], q, taper(i, 2 + k, z)));
    bands += `${line(lo)}L${hi.reverse().map((q) => P1(...q)).join('L')}Z`;
  });
  const ink = [0.09, 0.175, 0.27, 0.375, 0.49, 0.61, 0.73].map((s) => line(at(s).slice(2, m - 6))).join('');

  // foam cap over the crest, scalloped along its lower edge
  const capIn = [[42, 520], [70, 400], [124, 300], [206, 222], [312, 166], [440, 136], [576, 136], [704, 160], [812, 206], [890, 262]];
  const cap = `${cr(BACK.slice(3))}L${P(...TIP)}${cr(FACE.slice(0, 2), { move: false })}${cr([...capIn].reverse(), { move: false })}Z`;
  const scallops = scallopEdge(resample(capIn, 26), 0.5);
  // a fringe of foam rolling along the underside of the lip, scalloped on its upper edge
  const under = resample(FACE.slice(0, 7), 22);
  const fringeIn = under.map(([x, y], i) => [x - 6, y - 22 + 8 * Math.sin(i * 0.9)]);
  const fringe = `${line(under)}L${[...fringeIn].reverse().map((q) => P(...q)).join('L')}Z`;

  // claws: along the crest top (reaching forward), a cluster bursting from the lip and a curtain under it
  const claws = [];
  const top = resample(BACK.slice(4), 17);
  for (let i = 0; i < top.length - 1; i++) {
    const [x, y] = top[i], [x2, y2] = top[i + 1], a = (Math.atan2(y2 - y, x2 - x) * 180) / Math.PI;
    const t = i / (top.length - 1);
    claws.push(claw(x + 4, y + 12, a - 30 + 6 * t, 40 + 48 * t, 30 + 26 * t));
  }
  for (const [x, y, a, len, w] of [[952, 226, 26, 100, 66], [962, 272, 62, 92, 60], [940, 284, 98, 74, 50]]) claws.push(claw(x, y, a, len, w));
  for (let i = 1; i < under.length - 4; i += 2) {
    const [x, y] = under[i], t = i / under.length;
    claws.push(claw(x - 4, y - 8, 104 + 30 * t, 44 - 16 * t, 34 - 10 * t));
  }

  const rnd = rng(31), specks = [], crestPts = resample(BACK.slice(4), 50);
  for (let i = 0; i < 80; i++) {
    const [x, y] = crestPts[Math.floor(rnd() * 49)];
    specks.push([x + 16 + (rnd() - 0.5) * 50, y + 18 + rnd() * 54, 1.5 + rnd() * 2.2]);
  }

  return g({},
    path(body, { fill: 'url(#gwBody)' }),
    g({ clipPath: 'url(#gwBodyClip)' },
      path(cr(FACE.slice(2)), { fill: 'none', stroke: '#0c1c3a', strokeOpacity: 0.45, strokeWidth: 70 }),
      path(bands, { fill: 'url(#gwBand)' }),
      path(ink, { fill: 'none', stroke: INK, strokeOpacity: 0.5, strokeWidth: 2.2 }),
      path(fringe, { fill: 'url(#gwFoam)', stroke: INK, strokeWidth: 3, strokeLinejoin: 'round' }),
      path(scallopEdge([...fringeIn].reverse(), 0.45), { fill: 'url(#gwFoam)', stroke: INK, strokeWidth: 2.6 })),
    path(body, { fill: 'none', stroke: INK, strokeWidth: 5, strokeLinejoin: 'round' }),
    path(cap, { fill: 'url(#gwFoam)', stroke: INK, strokeWidth: 3.5, strokeLinejoin: 'round' }),
    path(scallops, { fill: 'url(#gwFoam)', stroke: INK, strokeWidth: 3 }),
    dots(specks, '#6d97c4', 0.75),
    clawGroup(claws));
}

// ---- small swells along the bottom ---------------------------------------------------------------
function swell(cx, base, w, h, seed, tone = 'gwSwell') {
  const X = (u) => cx + u * w;
  const backP = [[X(-0.55), base + 20], [X(-0.42), base - h * 0.42], [X(-0.2), base - h * 0.86], [X(0.06), base - h], [X(0.24), base - h * 0.86], [X(0.33), base - h * 0.62]];
  const faceP = [[X(0.22), base - h * 0.6], [X(0.18), base - h * 0.42], [X(0.26), base - h * 0.16], [X(0.45), base + 20]];
  const body = `${cr(backP)}${cr(faceP, { move: false })}Z`;
  const m = 26, bk = resample(backP.slice(0, -1), m), fc = resample([...faceP].reverse(), m);
  const lines = [0.22, 0.42, 0.62, 0.8].map((s) => line(bk.map((b, i) => lerp(fc[i], b, s)).slice(2, m - 3))).join('');
  const crestIn = [[X(-0.38), base - h * 0.52], [X(-0.16), base - h * 0.72], [X(0.06), base - h * 0.78], [X(0.2), base - h * 0.64]];
  const cap = `${cr(backP.slice(1))}${cr(faceP.slice(0, 1), { move: false })}${cr([...crestIn].reverse(), { move: false })}Z`;
  const rnd = rng(seed), k = h / 200, cl = [];
  const tops = resample(backP.slice(1), 8);
  for (let i = 1; i < tops.length - 1; i++) {
    const [x, y] = tops[i], [x2, y2] = tops[i + 1], t = i / tops.length;
    cl.push(claw(x, y + 6, (Math.atan2(y2 - y, x2 - x) * 180) / Math.PI - 34, (30 + 30 * t) * k * (0.9 + rnd() * 0.2), (24 + 18 * t) * k));
  }
  const [tx, ty] = tops[tops.length - 1];
  cl.push(claw(tx - 4, ty - 6, 58, 54 * k, 40 * k), claw(tx - 10, ty + 8, 96, 40 * k, 30 * k));
  return g({},
    path(body, { fill: `url(#${tone})` }),
    path(lines, { fill: 'none', stroke: '#a6c6e4', strokeOpacity: 0.55, strokeWidth: 4, strokeLinecap: 'round' }),
    path(body, { fill: 'none', stroke: INK, strokeWidth: 4, strokeLinejoin: 'round' }),
    path(cap, { fill: 'url(#gwFoam)', stroke: INK, strokeWidth: 3, strokeLinejoin: 'round' }),
    path(scallopEdge(resample(crestIn, 9), 0.45), { fill: 'url(#gwFoam)', stroke: INK, strokeWidth: 2.4 }),
    clawGroup(cl));
}

// ---- sky -----------------------------------------------------------------------------------------
const MTN = 'M960 420L1036 344C1136 326 1222 226 1268 146Q1298 136 1328 144C1376 226 1470 312 1610 336V420Z';
function mountain() {
  // snow: a jagged line of narrow streaks, clipped to the mountain
  const rnd = rng(5), jag = [[1100, 60], [1100, 176]];
  for (let x = 1100, k = 0; x < 1500; k++) {
    const c = 1 - Math.min(1, Math.abs(x - 1298) / 170), base = 176 + (1 - c) * 18;
    if (k % 2) { const r = rnd(); jag.push([x, base + 8 + c * (r < 0.3 ? 10 + rnd() * 14 : 26 + rnd() * 58)]); x += 4 + rnd() * 6; }
    else { jag.push([x, base - 2 - rnd() * 10]); x += 8 + rnd() * 14; }
  }
  jag.push([1500, 176], [1500, 60]);
  const snow = `M${jag.map((q) => P1(...q)).join('L')}Z`;
  const ridges = 'M1282 236C1268 272 1250 300 1232 330M1316 240C1326 276 1346 304 1370 330M1196 262C1186 290 1170 312 1150 330M1408 268C1420 292 1440 312 1466 328';
  const trees = [];
  for (let i = 0; i < 60; i++) {
    const x = 1040 + rnd() * 560, y = 300 + rnd() * 30;
    const slope = x < 1298 ? 344 - (x - 1036) * 0.55 : 336 - (1610 - x) * 0.24;
    if (y > slope + 6) trees.push([x, y, 3 + rnd() * 3.5]);
  }
  return g({},
    path(MTN, { fill: 'url(#gwRed)' }),
    g({ clipPath: 'url(#gwMtn)' },
      path(ridges, { fill: 'none', stroke: '#6e1c14', strokeOpacity: 0.5, strokeWidth: 3, strokeLinecap: 'round' }),
      path(snow, { fill: FOAM, stroke: INK, strokeWidth: 2.4, strokeLinejoin: 'round' }),
      path('M1262 162Q1298 150 1334 160', { fill: 'none', stroke: '#c9d6e4', strokeWidth: 4, strokeLinecap: 'round' }),
      dots(trees, '#2c4a3a', 0.85)),
    path(MTN, { fill: 'none', stroke: INK, strokeWidth: 4, strokeLinejoin: 'round' }));
}

/** Kasumi: a long band of mist with gently lobed ends and a wavy edge. */
function mist(x, y, w, h, seed) {
  const rnd = rng(seed), top = [], bot = [];
  for (let i = 0; i <= 8; i++) {
    const u = x + h * 0.6 + ((w - h * 1.2) * i) / 8;
    top.push([u, y + (rnd() - 0.5) * h * 0.18]);
    bot.push([u, y + h + (rnd() - 0.5) * h * 0.18]);
  }
  const d = `${cr(top)}C${P(x + w + h * 0.1, y - h * 0.05, x + w + h * 0.25, y + h * 0.55, x + w - h * 0.3, y + h * 0.62)}`
    + `C${P(x + w - h * 0.05, y + h * 0.75, x + w, y + h * 1.05, bot[8][0], bot[8][1])}${cr([...bot].reverse(), { move: false })}`
    + `C${P(x - h * 0.1, y + h * 1.05, x - h * 0.3, y + h * 0.5, x + h * 0.25, y + h * 0.42)}C${P(x - h * 0.05, y + h * 0.3, x, y, top[0][0], top[0][1])}Z`;
  return path(d, { fill: 'url(#gwMist)', stroke: '#b98a5a', strokeOpacity: 0.55, strokeWidth: 2.2, strokeLinejoin: 'round' });
}

/** A bank of stylised cumulus: round puffs on a flat base, shaded underneath. */
function cloud(x, y, w, s, seed) {
  const rnd = rng(seed);
  let d = `M${P(x, y)}`, cx = x;
  while (cx < x + w - s) {
    const r = s * (0.7 + rnd() * 0.6), step = Math.min(r * 1.6, x + w - cx);
    d += `A${P(r, r)} 0 0 1 ${P(cx + step, y - (rnd() - 0.5) * s * 0.3)}`; cx += step;
  }
  d += `Q${P(cx + s * 0.7, y + s * 0.5, cx, y + s * 0.62)}H${n(x)}Q${P(x - s * 0.7, y + s * 0.5, x, y)}Z`;
  return path(d, { fill: 'url(#gwCloud)', stroke: '#3a4766', strokeWidth: 2, strokeLinejoin: 'round' });
}

function bird(x, y, s, rot = 0) {
  return path(`M${P(-s, -s * 0.2)}Q${P(-s * 0.45, -s * 0.55, 0, 0)}Q${P(s * 0.45, -s * 0.55, s, -s * 0.2)}Q${P(s * 0.4, -s * 0.2, 0, s * 0.18)}Q${P(-s * 0.4, -s * 0.2, -s, -s * 0.2)}Z`,
    { fill: INK, transform: tf(x, y, rot) });
}

function seal(x, y, s) {
  const spiral = `M${P(x + s * 0.24, y + s * 0.7)}C${P(x + s * 0.2, y + s * 0.4, x + s * 0.44, y + s * 0.24, x + s * 0.64, y + s * 0.34)}`
    + `C${P(x + s * 0.8, y + s * 0.42, x + s * 0.74, y + s * 0.62, x + s * 0.58, y + s * 0.58)}C${P(x + s * 0.48, y + s * 0.55, x + s * 0.5, y + s * 0.46, x + s * 0.57, y + s * 0.46)}`;
  return g({ transform: `rotate(-3 ${x + s / 2} ${y + s / 2})` },
    path(rr(x, y, s, s, 6), { fill: '#b8322a', fillOpacity: 0.92 }),
    path(rr(x + 5, y + 5, s - 10, s - 10, 3), { fill: 'none', stroke: '#f6e3c8', strokeWidth: 2.4 }),
    path(spiral, { fill: 'none', stroke: '#f6e3c8', strokeWidth: 4, strokeLinecap: 'round' }),
    path(`M${P(x + s * 0.2, y + s * 0.8)}Q${P(x + s * 0.5, y + s * 0.7, x + s * 0.8, y + s * 0.8)}`, { fill: 'none', stroke: '#f6e3c8', strokeWidth: 3, strokeLinecap: 'round' }));
}

// ---- frame ---------------------------------------------------------------------------------------
function woodFrame() {
  const outer = rr(0, 0, W, H, 18), inner = rr(B, B, W - 2 * B, H - 2 * B, 2);
  const bars = {
    top: `M0 0H${W}L${W - B} ${B}H${B}Z`, bottom: `M0 ${H}H${W}L${W - B} ${H - B}H${B}Z`,
    left: `M0 0V${H}L${B} ${H - B}V${B}Z`, right: `M${W} 0V${H}L${W - B} ${H - B}V${B}Z`,
  };
  const rnd = rng(11);
  const grainH = (y0, y1, x0, x1) => {
    let d = '';
    for (let y = y0 + 4; y < y1 - 2; y += 5 + rnd() * 7) {
      const pts = [], amp = 1 + rnd() * 3, ph = rnd() * 6, f = 0.004 + rnd() * 0.006;
      for (let x = x0; x <= x1 + 150; x += 150) pts.push([x, y + amp * Math.sin(x * f + ph)]);
      d += cr(pts);
    }
    return d;
  };
  const grainV = (x0, x1, y0, y1) => {
    let d = '';
    for (let x = x0 + 4; x < x1 - 2; x += 5 + rnd() * 7) {
      const pts = [], amp = 1 + rnd() * 3, ph = rnd() * 6, f = 0.004 + rnd() * 0.006;
      for (let y = y0; y <= y1 + 150; y += 150) pts.push([x + amp * Math.sin(y * f + ph), y]);
      d += cr(pts);
    }
    return d;
  };
  const grainStroke = { fill: 'none', stroke: '#2e160a', strokeOpacity: 0.32, strokeWidth: 1.6 };
  return g({},
    path(`${outer}${inner}`, { fill: 'url(#gwWood)', fillRule: 'evenodd' }),
    g({ clipPath: 'url(#gwBarT)' }, path(grainH(0, B, 0, W), grainStroke)),
    g({ clipPath: 'url(#gwBarB)' }, path(grainH(H - B, H, 0, W), grainStroke)),
    g({ clipPath: 'url(#gwBarL)' }, path(grainV(0, B, 0, H), grainStroke)),
    g({ clipPath: 'url(#gwBarR)' }, path(grainV(W - B, W, 0, H), grainStroke)),
    path(bars.top, { fill: '#fff', fillOpacity: 0.08 }), path(bars.left, { fill: '#fff', fillOpacity: 0.04 }),
    path(bars.bottom, { fill: '#000', fillOpacity: 0.14 }), path(bars.right, { fill: '#000', fillOpacity: 0.08 }),
    path(`M0 0L${B} ${B}M${W} 0L${W - B} ${B}M0 ${H}L${B} ${H - B}M${W} ${H}L${W - B} ${H - B}`, { stroke: '#2a1408', strokeOpacity: 0.6, strokeWidth: 2.5 }),
    path(rr(14, 14, W - 28, H - 28, 10), { fill: 'none', stroke: '#e9b97c', strokeOpacity: 0.28, strokeWidth: 2 }),
    path(rr(B - 8, B - 8, W - 2 * B + 16, H - 2 * B + 16, 4), { fill: 'none', stroke: 'url(#gwGilt)', strokeWidth: 8 }),
    path(rr(B - 3, B - 3, W - 2 * B + 6, H - 2 * B + 6, 2), { fill: 'none', stroke: '#1d0f06', strokeWidth: 3 }),
    path(outer, { fill: 'none', stroke: '#1d0f06', strokeWidth: 4 }));
}

function paper() {
  const rnd = rng(23), dark = [], light = [];
  for (let i = 0; i < 150; i++) {
    const x = B + rnd() * (W - 2 * B), y = B + rnd() * (H - 2 * B);
    if (x > hole.x - 20 && x < hole.x + hole.w + 20 && y > hole.y - 20 && y < hole.y + hole.h + 20) continue;
    const a = rnd() * Math.PI, l = 6 + rnd() * 14;
    (i % 3 ? light : dark).push(`M${P(x, y)}L${P(x + l * Math.cos(a), y + l * Math.sin(a))}`);
  }
  return path(dark.join(''), { stroke: '#8a6a3c', strokeOpacity: 0.22, strokeWidth: 1.4, strokeLinecap: 'round' })
    + path(light.join(''), { stroke: '#fffaf0', strokeOpacity: 0.5, strokeWidth: 1.6, strokeLinecap: 'round' });
}

function draw() {
  const body = `${cr(BACK)}L${P(...TIP)}${cr(FACE, { move: false })}Z`;
  const holeD = rr(hole.x, hole.y, hole.w, hole.h, radius);
  const defs = [
    lg('gwPaper', [0, 0, 0, 1], [[0, '#e9d3a2'], [0.4, '#f1e0b8'], [1, '#ecd7aa']]),
    lg('gwSkyTop', [0, 0, 0, 1], [[0, '#2c3a5e', 0.75], [0.55, '#4a5a7c', 0.25], [1, '#4a5a7c', 0]]),
    lg('gwBody', [0, 0, 1, 1], [[0, '#2a5f9c'], [0.45, '#1d4a85'], [1, '#14315e']]),
    lg('gwBand', [0, 0, 1, 1], [[0, '#7fb0dc'], [0.6, '#4f86c0'], [1, '#3a6aa6']]),
    lg('gwSwell', [0, 0, 0, 1], [[0, '#3c74b4'], [0.6, '#21508c'], [1, '#173c6c']]),
    lg('gwSwellBack', [0, 0, 0, 1], [[0, '#7aa6d2'], [1, '#3f6fa6']]),
    lg('gwFoam', [0, 0, 0, 1], [[0, '#fffdf6'], [1, '#e4ecf0']]),
    lg('gwClaw', [0, 0, 1, 0], [[0, '#fbf9f1'], [0.55, '#f7f6f0'], [1, '#d3e2ef']]),
    lg('gwRed', [0, 0, 0, 1], [[0, '#a3301f'], [0.45, '#c9442b'], [1, '#e0754a']]),
    lg('gwMist', [0, 0, 1, 0], [[0, '#f7d9bd'], [0.5, '#fbe9d4'], [1, '#f3cfae']]),
    lg('gwCloud', [0, 0, 0, 1], [[0, '#fffaee'], [0.6, '#f8f0de'], [1, '#c9d2dc']]),
    lg('gwWood', [0, 0, 1, 1], [[0, '#8a5530'], [0.5, '#6c3d1f'], [1, '#4f2a13']]),
    lg('gwGilt', [0, 0, 1, 1], [[0, '#f3d58a'], [0.5, '#b8862e'], [1, '#e8c26a']]),
    `<clipPath id="gwPrint"><path d="${rr(B, B, W - 2 * B, H - 2 * B, 2)}"/></clipPath>`,
    `<clipPath id="gwMtn"><path d="${MTN}"/></clipPath>`,
    `<clipPath id="gwBodyClip"><path d="${body}"/></clipPath>`,
    `<clipPath id="gwSwClip"><path d="M0 ${H - 330}H${W}V${H}H0Z"/></clipPath>`,
    `<clipPath id="gwBarT"><path d="M0 0H${W}L${W - B} ${B}H${B}Z"/></clipPath>`,
    `<clipPath id="gwBarB"><path d="M0 ${H}H${W}L${W - B} ${H - B}H${B}Z"/></clipPath>`,
    `<clipPath id="gwBarL"><path d="M0 0V${H}L${B} ${H - B}V${B}Z"/></clipPath>`,
    `<clipPath id="gwBarR"><path d="M${W} 0V${H}L${W - B} ${H - B}V${B}Z"/></clipPath>`,
  ].join('');

  const sprayR = rng(9), spray = [];
  for (let i = 0; i < 26; i++) { // flung off the lip
    const a = -1.1 + sprayR() * 1.9, r = 60 + sprayR() * 120;
    const x = 1000 + Math.cos(a) * r * 0.8, y = 250 + Math.sin(a) * r;
    if (y > hole.y - 30 || y < B + 8) continue;
    spray.push([x, y, 1.6 + sprayR() * 3.2]);
  }

  const print = g({ clipPath: 'url(#gwPrint)' },
    path(`M0 0H${W}V${H}H0Z`, { fill: 'url(#gwPaper)' }),
    path(`M0 0H${W}V300H0Z`, { fill: 'url(#gwSkyTop)' }),
    paper(),
    cloud(1150, 120, 190, 22, 1), cloud(1400, 96, 200, 20, 2), cloud(1060, 200, 120, 16, 3),
    mountain(),
    mist(1000, 292, 600, 30, 4), mist(1400, 234, 220, 18, 5),
    bird(1100, 168, 13, -8), bird(1134, 150, 9, 6), bird(1160, 176, 11, -4),
    // swells: back row (lighter), then front row
    swell(1520, 1076, 300, 176, 3, 'gwSwellBack'), swell(1200, 1090, 300, 150, 4, 'gwSwellBack'), swell(870, 1084, 320, 164, 5, 'gwSwellBack'),
    bigWave(),
    swell(60, 1150, 340, 190, 9), swell(360, 1160, 380, 236, 10),
    swell(690, 1150, 360, 204, 6), swell(1030, 1160, 390, 236, 7), swell(1390, 1150, 360, 210, 8),
    drops(spray),
    seal(1468, 640, 54),
    // the mat around the screen: a calm paper band and an inked keyline
    path(rr(hole.x - 16, hole.y - 16, hole.w + 32, hole.h + 32, 6), { fill: 'none', stroke: '#f1e1bb', strokeWidth: 26 }),
    path(rr(hole.x - 22, hole.y - 22, hole.w + 44, hole.h + 44, 8), { fill: 'none', stroke: INK, strokeWidth: 5 }),
    lip(holeD, '#2a1a08', [[6, 0.14], [2.5, 0.3]]),
    // the print is set back a touch under the frame
    path(rr(B, B, W - 2 * B, H - 2 * B, 2), { fill: 'none', stroke: '#2a1408', strokeOpacity: 0.18, strokeWidth: 24 }),
    path(rr(B, B, W - 2 * B, H - 2 * B, 2), { fill: 'none', stroke: '#2a1408', strokeOpacity: 0.25, strokeWidth: 8 }));

  return { defs, body: [print, woodFrame()].join('\n') };
}

module.exports = {
  W, H, hole, radius, draw,
  meta: {
    name: 'Great Wave', theme: 'woodblock-ocean', rarity: 'epic',
    desc: 'A towering woodblock wave curls its foamy claws over your game while a red mountain peeks out to watch.',
    tags: ['wave', 'ocean', 'woodblock', 'japan', 'art'],
    collection: 'wild-tuneful', license: 'CC-BY-4.0',
  },
};
