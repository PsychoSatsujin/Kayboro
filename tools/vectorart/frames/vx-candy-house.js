'use strict';
// Sweet House: a gingerbread candy cottage. The screen is its big front window with piped royal-icing
// trim; pink cookie-shingle roof under a frosting snow cap with drips, gumdrops along the rakes, a
// marshmallow chimney puffing cotton candy, candy-cane corner pillars, a chocolate-bar door with a
// gummy bear waving from the doorstep, lollipop trees, wafer fences, peppermint bushes, sprinkles.
const L = require('../lib');
const { rr, path, g, lg, rg, circle, ellipse, sparkle, heart, tf, rng, lip, n, P } = L;

const W = 1400, H = 1350, hole = { x: 400, y: 640, w: 600, h: 450 }, radius = 20;
const INK = '#4a2320';
const WALL = { x: 170, y: 500, w: 1060, h: 700 };
const ROOF = { x0: 100, x1: 1300, yb: 510, px: 700, py: 142 };
const SLOPE = (ROOF.yb - ROOF.py) / (ROOF.px - ROOF.x0);
const ROOF_DEG = (Math.atan(SLOPE) * 180) / Math.PI;
const roofY = (x) => ROOF.py + Math.abs(x - ROOF.px) * SLOPE;
const ROOF_D = `M${P(ROOF.x0, ROOF.yb)}L${P(ROOF.px - 10, roofY(ROOF.px - 10))}Q${P(ROOF.px, ROOF.py - 2, ROOF.px + 10, roofY(ROOF.px + 10))}L${P(ROOF.x1, ROOF.yb)}Z`;
const PLATE_Y = 1196;

/** Icing slab with rounded top corners whose lower edge hangs in rounded drips (calm = [x0, x1, maxDepth]). */
function dripSlab(x0, x1, yTop, yBase, seed, short = [6, 14], long = [28, 54], calm = null) {
  const rnd = rng(seed), rc = Math.min(22, (yBase - yTop) / 2);
  let d = `M${P(x0 + rc, yTop)}H${n(x1 - rc)}A${P(rc, rc)} 0 0 1 ${P(x1, yTop + rc)}V${n(yBase)}`;
  let x = x1, k = 0;
  while (x > x0 + 18) {
    const w = Math.min(x - x0, 24 + rnd() * 30), xm = x - w / 2;
    let depth = k % 3 === 1 ? long[0] + rnd() * (long[1] - long[0]) : short[0] + rnd() * (short[1] - short[0]);
    if (calm && xm > calm[0] && xm < calm[1]) depth = Math.min(depth, calm[2]);
    d += `C${P(x, yBase + depth * 0.6, xm + w * 0.32, yBase + depth, xm, yBase + depth)}`
      + `C${P(xm - w * 0.32, yBase + depth, x - w, yBase + depth * 0.6, x - w, yBase)}`;
    x -= w; k++;
  }
  return `${d}H${n(x0)}V${n(yTop + rc)}A${P(rc, rc)} 0 0 1 ${P(x0 + rc, yTop)}Z`;
}

/** One row of cookie shingles: flat top, scalloped bottom edge at yb (scallop radius r). */
function scallopRow(x0, x1, yb, r, shift = 0) {
  let d = `M${P(x0, yb - r * 2.3)}H${n(x1)}V${n(yb - r)}`, hi = '';
  for (let x = x1 + shift; x > x0; x -= 2 * r) {
    d += `A${P(r, r)} 0 0 1 ${P(x - 2 * r, yb - r)}`;
    const cx = x - r, cy = yb - r, a0 = (200 * Math.PI) / 180, a1 = (285 * Math.PI) / 180, rh = r - 7;
    hi += `M${P(cx + rh * Math.cos(a0), cy + rh * Math.sin(a0))}A${P(rh, rh)} 0 0 1 ${P(cx + rh * Math.cos(a1), cy + rh * Math.sin(a1))}`;
  }
  return { d: `${d}H${n(x0)}Z`, hi };
}

function gumdrop(cx, cy, w, h, col, rot = 0, shadow = true) {
  const d = `M${P(-w, 0)}C${P(-w, -h * 0.45, -w * 0.82, -h * 0.9, -w * 0.45, -h * 0.97)}Q${P(0, -h * 1.1, w * 0.45, -h * 0.97)}`
    + `C${P(w * 0.82, -h * 0.9, w, -h * 0.45, w, 0)}Z`;
  const rnd = rng(Math.round(cx * 7 + cy * 3)), dots = [];
  for (let i = 0; i < 7; i++) dots.push(circle((rnd() - 0.5) * w * 1.4, -h * (0.15 + rnd() * 0.7), 1.6 + rnd() * 1.2));
  return g({ transform: tf(cx, cy, rot) },
    shadow ? path(ellipse(3, 2, w * 1.08, 6), { fill: INK, fillOpacity: 0.3 }) : '',
    path(d, { fill: `url(#gd-${col})`, stroke: INK, strokeWidth: 4, strokeLinejoin: 'round' }),
    path(dots.join(''), { fill: '#fff', fillOpacity: 0.75 }),
    path(ellipse(-w * 0.42, -h * 0.66, w * 0.2, h * 0.17), { fill: '#fff', fillOpacity: 0.7, transform: `rotate(-32 ${n(-w * 0.42)} ${n(-h * 0.66)})` }));
}

function peppermint(cx, cy, r, col = '#ff4f6d', wedges = 8) {
  const th = (2 * Math.PI) / wedges, c1 = [r * 0.5, -r * 0.22];
  const rot = ([x, y], a) => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];
  let w = '';
  for (let k = 0; k < wedges; k++) {
    const a0 = k * th, a1 = a0 + th / 2;
    const p1 = [r * Math.cos(a0), r * Math.sin(a0)], p2 = [r * Math.cos(a1), r * Math.sin(a1)];
    w += `M0 0Q${P(...rot(c1, a0))} ${P(...p1)}A${P(r, r)} 0 0 1 ${P(...p2)}Q${P(...rot(c1, a1))} 0 0Z`;
  }
  return g({ transform: tf(cx, cy) },
    path(circle(0, 0, r), { fill: '#fff' }),
    path(w, { fill: col }),
    path(circle(0, 0, r), { fill: 'url(#candyGloss)' }),
    path(circle(0, 0, r), { fill: 'none', stroke: INK, strokeWidth: 4 }),
    path(ellipse(-r * 0.36, -r * 0.42, r * 0.26, r * 0.12), { fill: '#fff', fillOpacity: 0.8, transform: `rotate(-38 ${n(-r * 0.36)} ${n(-r * 0.42)})` }));
}

function lollipop(cx, cy, r, col, groundY, bow) {
  const pts = [], turns = 2.4, steps = 160;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps, a = t * turns * 2 * Math.PI - Math.PI / 2, rad = (r - 9) * (1 - t * 0.97);
    pts.push(`${i ? 'L' : 'M'}${P(cx + rad * Math.cos(a), cy + rad * Math.sin(a))}`);
  }
  return g({},
    path(rr(cx - 9, cy, 18, groundY - cy, 9), { fill: 'url(#stick)', stroke: INK, strokeWidth: 4 }),
    path(circle(cx + 7, cy + 9, r), { fill: INK, fillOpacity: 0.22 }),
    path(circle(cx, cy, r), { fill: '#fff' }),
    path(pts.join(''), { fill: 'none', stroke: col, strokeWidth: 17, strokeLinecap: 'round' }),
    path(circle(cx, cy, r), { fill: 'url(#candyGloss)' }),
    path(circle(cx, cy, r), { fill: 'none', stroke: INK, strokeWidth: 5 }),
    path(ellipse(cx - r * 0.38, cy - r * 0.42, r * 0.26, r * 0.11), { fill: '#fff', fillOpacity: 0.85, transform: `rotate(-38 ${n(cx - r * 0.38)} ${n(cy - r * 0.42)})` }),
    // ribbon bow at the neck
    path(`M${P(cx - 4, cy + r + 4)}C${P(cx - 34, cy + r - 16, cx - 40, cy + r + 24, cx - 4, cy + r + 12)}Z`, { fill: bow, stroke: INK, strokeWidth: 3.5, strokeLinejoin: 'round' }),
    path(`M${P(cx + 4, cy + r + 4)}C${P(cx + 34, cy + r - 16, cx + 40, cy + r + 24, cx + 4, cy + r + 12)}Z`, { fill: bow, stroke: INK, strokeWidth: 3.5, strokeLinejoin: 'round' }),
    path(circle(cx, cy + r + 8, 7), { fill: bow, stroke: INK, strokeWidth: 3.5 }));
}

function candyCane(id, cx, y0, y1, w = 40) {
  const d = rr(cx - w / 2, y0, w, y1 - y0, w / 2), stripes = [];
  for (let y = y0 - 20; y < y1 + 40; y += 56) stripes.push(`M${P(cx - w, y)}L${P(cx + w, y - 44)}L${P(cx + w, y - 22)}L${P(cx - w, y + 22)}Z`);
  return g({},
    path(d, { fill: 'url(#cane)' }),
    g({ clipPath: `url(#${id})` }, path(stripes.join(''), { fill: '#ff5569' }), path(stripes.join(''), { fill: 'url(#caneShade)' })),
    path(d, { fill: 'url(#caneShade)' }),
    path(`M${P(cx - w * 0.28, y0 + 24)}V${n(y1 - 24)}`, { stroke: '#fff', strokeOpacity: 0.55, strokeWidth: 5, strokeLinecap: 'round' }),
    path(d, { fill: 'none', stroke: INK, strokeWidth: 5 }));
}

function door() {
  const x = 230, w = 90, yb = 1192, ya = 1026, d = `M${P(x, yb)}V${n(ya)}A${P(w / 2, w / 2)} 0 0 1 ${P(x + w, ya)}V${n(yb)}Z`;
  const segs = [];
  for (let r = 0; r < 4; r++) for (let c = 0; c < 2; c++) segs.push(rr(x + 8 + c * 40, 990 + r * 50, 34, 42, 6));
  return g({},
    path(d, { fill: 'none', stroke: INK, strokeWidth: 30, strokeLinejoin: 'round' }),
    path(d, { fill: 'none', stroke: 'url(#icing)', strokeWidth: 20, strokeLinejoin: 'round' }),
    path(d, { fill: 'url(#choc)', stroke: INK, strokeWidth: 5 }),
    g({ clipPath: 'url(#doorClip)' },
      path(segs.join(''), { fill: 'url(#chocSeg)', stroke: '#2e150e', strokeWidth: 3 }),
      path(segs.map((s) => s).join(''), { fill: 'none', stroke: '#fff', strokeOpacity: 0.18, strokeWidth: 2, transform: 'translate(-2 -2)' })),
    path(circle(x + w - 16, 1108, 8), { fill: 'url(#gd-yellow)', stroke: INK, strokeWidth: 3 }),
    path(circle(x + w - 18, 1105, 2.5), { fill: '#fff', fillOpacity: 0.9 }),
    // doorstep cookie
    path(rr(x - 14, yb - 6, w + 28, 20, 7), { fill: 'url(#cookie)', stroke: INK, strokeWidth: 4 }));
}

function bear(cx, groundY, s = 1) {
  const part = (d, extra = {}) => path(d, { fill: 'url(#gummy)', stroke: INK, strokeWidth: 4, ...extra });
  const el = (x, y, rx, ry, rot = 0) => path(ellipse(x, y, rx, ry), { fill: 'url(#gummy)', stroke: INK, strokeWidth: 4, transform: rot ? `rotate(${rot} ${x} ${y})` : null });
  return g({ transform: tf(cx, groundY, 0, s) },
    path(ellipse(6, 4, 62, 11), { fill: INK, fillOpacity: 0.32 }),
    el(-46, -80, 14, 26, 22),
    el(-27, -16, 22, 18), el(27, -16, 22, 18),
    part(`M-50 -70C-50 -118 -26 -128 0 -128C26 -128 50 -118 50 -70C50 -34 30 -18 0 -18C-30 -18 -50 -34 -50 -70Z`),
    path(ellipse(0, -62, 26, 30), { fill: '#fff', fillOpacity: 0.22 }),
    el(52, -118, 14, 30, 38),
    path(circle(66, -146, 13), { fill: 'url(#gummy)', stroke: INK, strokeWidth: 4 }),
    path(`M60 -150h5M66 -152v5`, { stroke: INK, strokeOpacity: 0.5, strokeWidth: 2.5, strokeLinecap: 'round' }),
    path(circle(-34, -184, 16), { fill: 'url(#gummy)', stroke: INK, strokeWidth: 4 }),
    path(circle(34, -184, 16), { fill: 'url(#gummy)', stroke: INK, strokeWidth: 4 }),
    path(circle(0, -150, 44), { fill: 'url(#gummy)', stroke: INK, strokeWidth: 4 }),
    path(circle(-34, -184, 7), { fill: '#fff', fillOpacity: 0.35 }), path(circle(34, -184, 7), { fill: '#fff', fillOpacity: 0.35 }),
    path(ellipse(0, -134, 18, 12), { fill: '#fff', fillOpacity: 0.35 }),
    path(ellipse(0, -140, 5.5, 4), { fill: INK }),
    path(circle(-15, -154, 5), { fill: INK }), path(circle(15, -154, 5), { fill: INK }),
    path(circle(-13, -156, 1.8), { fill: '#fff' }), path(circle(17, -156, 1.8), { fill: '#fff' }),
    path('M-8 -131Q0 -123 8 -131', { fill: 'none', stroke: INK, strokeWidth: 3.5, strokeLinecap: 'round' }),
    path(ellipse(-27, -138, 8, 4.5), { fill: '#ff6f8f', fillOpacity: 0.55 }), path(ellipse(27, -138, 8, 4.5), { fill: '#ff6f8f', fillOpacity: 0.55 }),
    path(ellipse(-18, -170, 13, 7), { fill: '#fff', fillOpacity: 0.7, transform: 'rotate(-32 -18 -170)' }),
    path(ellipse(-28, -96, 7, 16), { fill: '#fff', fillOpacity: 0.55, transform: 'rotate(12 -28 -96)' }));
}

function fence(x0, count, y) {
  const len = count * 36 - 8, pickets = [], grid = [];
  for (let i = 0; i < count; i++) {
    const x = x0 + i * 36;
    pickets.push(`M${P(x, y + 16)}L${P(x + 14, y)}L${P(x + 28, y + 16)}V${n(y + 100)}H${n(x)}Z`);
    for (let yy = y + 26; yy < y + 96; yy += 12) grid.push(`M${P(x + 4, yy)}H${n(x + 24)}`);
    grid.push(`M${P(x + 14, y + 20)}V${n(y + 96)}`);
  }
  const rail = (yy) => path(rr(x0 - 10, yy, len + 20, 16, 6), { fill: 'url(#wafer)', stroke: INK, strokeWidth: 4 });
  return g({},
    rail(y + 30), rail(y + 66),
    path(pickets.join(''), { fill: 'url(#wafer)', stroke: INK, strokeWidth: 4, strokeLinejoin: 'round' }),
    path(grid.join(''), { fill: 'none', stroke: '#a87a3c', strokeOpacity: 0.55, strokeWidth: 2 }));
}

function marshmallowChimney() {
  const x = 980, w = 84, out = [];
  for (let i = 0; i < 3; i++) {
    const y = 190 + i * 60;
    out.push(path(rr(x, y, w, 70, 12), { fill: 'url(#mallow)', stroke: INK, strokeWidth: 4 }));
    out.push(path(`M${P(x + 14, y + 12)}V${n(y + 54)}`, { stroke: '#fff', strokeOpacity: 0.7, strokeWidth: 4, strokeLinecap: 'round' }));
  }
  const puff = [[1046, 128, 26], [1012, 112, 32], [978, 134, 22], [1010, 150, 24]];
  return g({},
    path(puff.map(([cx, cy, r]) => circle(cx, cy, r)).join(''), { fill: '#ffc3dc', stroke: INK, strokeWidth: 4, strokeLinejoin: 'round' }),
    path(puff.map(([cx, cy, r]) => circle(cx, cy, r - 2)).join(''), { fill: '#ffc3dc' }),
    path(ellipse(1000, 100, 12, 6), { fill: '#fff', fillOpacity: 0.75, transform: 'rotate(-20 1000 100)' }),
    path(circle(1070, 90, 7), { fill: '#ffc3dc', stroke: INK, strokeWidth: 3 }),
    ...out,
    path(ellipse(x + w / 2, 190, w / 2, 14), { fill: '#fff', stroke: INK, strokeWidth: 4 }));
}

function windowFrame() {
  const holeD = rr(hole.x, hole.y, hole.w, hole.h, radius), o = 64, R = 60;
  const fx = hole.x - o, fy = hole.y - o, fw = hole.w + 2 * o, fh = hole.h + 2 * o;
  const dots = [], pearls = [];
  for (let x = hole.x + 12; x <= hole.x + hole.w - 12; x += 32) { dots.push(circle(x, fy + 30, 9)); dots.push(circle(x, fy + fh - 30, 9)); }
  for (let y = hole.y + 12; y <= hole.y + hole.h - 12; y += 32) { dots.push(circle(fx + 30, y, 9)); dots.push(circle(fx + fw - 30, y, 9)); }
  for (const c of dots.map((d) => d.match(/M([\d.-]+) ([\d.-]+)/))) pearls.push(circle(+c[1] - 3, +c[2] - 3, 2.6));
  const corners = [[fx + 50, fy + 50], [fx + fw - 50, fy + 50], [fx + 50, fy + fh - 50], [fx + fw - 50, fy + fh - 50]];
  return g({},
    path(rr(fx + 7, fy + 11, fw, fh, R), { fill: INK, fillOpacity: 0.3 }),
    path(rr(fx, fy, fw, fh, R), { fill: 'url(#icing)', stroke: INK, strokeWidth: 6 }),
    path(rr(fx + 10, fy + 10, fw - 20, fh - 20, R - 10), { fill: 'none', stroke: '#fff', strokeOpacity: 0.6, strokeWidth: 3 }),
    path(dots.join(''), { fill: 'url(#dot)', stroke: INK, strokeWidth: 2.5 }),
    path(pearls.join(''), { fill: '#fff', fillOpacity: 0.9 }),
    corners.map(([x, y], i) => path(heart(x, y + 2, 16), { fill: `url(#gd-${i % 2 ? 'mint' : 'yellow'})`, stroke: INK, strokeWidth: 3 })
      + path(ellipse(x - 6, y - 6, 4, 2.5), { fill: '#fff', fillOpacity: 0.85, transform: `rotate(-30 ${x - 6} ${y - 6})` })).join(''),
    path(rr(hole.x - 20, hole.y - 20, hole.w + 40, hole.h + 40, radius + 16), { fill: 'url(#bezelIn)', stroke: INK, strokeWidth: 5 }),
    lip(holeD, '#000', [[7, 0.3], [3, 0.6]]));
}

function roof() {
  const rows = [];
  for (let i = 0; i < 10; i++) {
    const yb = 548 - i * 44, { d, hi } = scallopRow(ROOF.x0 - 60, ROOF.x1 + 60, yb, 28, i % 2 ? 28 : 0);
    rows.push(path(d, { fill: '#c23f6e', fillOpacity: 0.5, transform: 'translate(0 8)' }));
    rows.push(path(d, { fill: 'url(#shingle)', stroke: INK, strokeWidth: 4, strokeLinejoin: 'round' }));
    rows.push(path(hi, { fill: 'none', stroke: '#fff', strokeOpacity: 0.55, strokeWidth: 3, strokeLinecap: 'round' }));
  }
  const cap = dripSlab(360, 1040, 40, 272, 5, [8, 18], [34, 62]);
  const rake = [];
  const cols = ['yellow', 'mint', 'orange', 'pink'];
  [0.2, 0.37, 0.54, 0.7].forEach((t, i) => {
    const xl = ROOF.x0 + t * (ROOF.px - ROOF.x0), xr = ROOF.x1 - t * (ROOF.x1 - ROOF.px);
    rake.push(gumdrop(xl, roofY(xl) + 2, 22, 36, cols[i], -ROOF_DEG, false));
    rake.push(gumdrop(xr, roofY(xr) + 2, 22, 36, cols[(i + 2) % 4], ROOF_DEG, false));
  });
  return g({},
    g({ clipPath: 'url(#roofClip)' },
      ...rows,
      path(cap, { fill: INK, fillOpacity: 0.25, transform: 'translate(0 9)' }),
      path(cap, { fill: 'url(#icing)', stroke: INK, strokeWidth: 5, strokeLinejoin: 'round' }),
      path('M560 110C600 80 680 70 760 86', { fill: 'none', stroke: '#fff', strokeWidth: 5, strokeLinecap: 'round' })),
    path(ROOF_D, { fill: 'none', stroke: INK, strokeWidth: 7, strokeLinejoin: 'round' }),
    gumdrop(520, 400, 20, 32, 'mint', 0), gumdrop(870, 430, 22, 34, 'yellow', 0), gumdrop(640, 300, 18, 30, 'pink', 0), gumdrop(790, 330, 18, 30, 'orange', 0),
    ...rake,
    // finial gumdrop on the peak
    gumdrop(700, 154, 26, 46, 'pink', 0, false),
    path(sparkle(700, 72, 18), { fill: '#fff', stroke: '#ff9cc0', strokeWidth: 2 }));
}

function sprinkles() {
  const rnd = rng(77), cols = ['#ff6f8f', '#ffd166', '#5fd6b0', '#8fb8ff', '#ff9d5c', '#c79bff'], out = [];
  const spots = [];
  for (let i = 0; i < 26; i++) spots.push([70 + rnd() * 1260, 1206 + rnd() * 36, rnd() * 180]);
  for (let i = 0; i < 14; i++) spots.push([120 + rnd() * 1160, 488 + rnd() * 28, rnd() * 180]);
  for (let i = 0; i < 8; i++) spots.push([520 + rnd() * 360, 150 + rnd() * 110, rnd() * 180]);
  spots.forEach(([x, y, r], i) => {
    const t = `rotate(${n(r)} ${n(x)} ${n(y)})`, d = `M${P(x - 9, y)}H${n(x + 9)}`;
    out.push(path(d, { stroke: INK, strokeWidth: 10, strokeLinecap: 'round', transform: t }));
    out.push(path(d, { stroke: cols[i % cols.length], strokeWidth: 6, strokeLinecap: 'round', transform: t }));
  });
  const pearls = [[300, 1240], [1120, 1236], [760, 1212], [430, 1248], [980, 1246], [210, 508], [1180, 512], [660, 210], [740, 185]];
  for (const [x, y] of pearls) {
    out.push(path(circle(x, y, 6), { fill: 'url(#pearl)', stroke: INK, strokeWidth: 2.5 }));
    out.push(path(circle(x - 2, y - 2, 1.8), { fill: '#fff' }));
  }
  return out.join('');
}

function draw() {
  const defs = [
    lg('wall', [0, 0, 1, 1], [[0, '#d9a263'], [0.5, '#bf8347'], [1, '#9c6534']]),
    lg('eaveShade', [0, 0, 0, 1], [[0, INK, 0.38], [1, INK, 0]]),
    lg('shingle', [0, 0, 0, 1], [[0, '#ffc6d9'], [0.55, '#ff9dbf'], [1, '#f27aa6']]),
    lg('icing', [0, 0, 1, 1], [[0, '#ffffff'], [0.55, '#fff6fa'], [1, '#f1d9e4']]),
    lg('bezelIn', [0, 0, 0, 1], [[0, '#2a1410'], [1, '#3d1f18']]),
    rg('dot', [0.4, 0.35, 0.75], [[0, '#ffffff'], [1, '#f4d6e2']]),
    rg('pearl', [0.4, 0.35, 0.75], [[0, '#ffffff'], [1, '#e6dbe6']]),
    lg('plate', [0, 0, 0, 1], [[0, '#ffffff'], [0.45, '#fbeef4'], [1, '#e9cfdc']]),
    lg('plateEdge', [0, 0, 0, 1], [[0, '#e9cfdc'], [1, '#cfaebf']]),
    lg('cane', [0, 0, 1, 0], [[0, '#ffffff'], [1, '#f3e3e8']]),
    lg('caneShade', [0, 0, 1, 0], [[0, '#fff', 0.25], [0.45, '#fff', 0], [1, INK, 0.28]]),
    lg('stick', [0, 0, 1, 0], [[0, '#fff8ee'], [0.5, '#f6e7d0'], [1, '#d9c1a0']]),
    lg('choc', [0, 0, 1, 1], [[0, '#7a4328'], [1, '#4a2416']]),
    lg('chocSeg', [0, 0, 1, 1], [[0, '#8f5433'], [1, '#5a2d1a']]),
    lg('cookie', [0, 0, 0, 1], [[0, '#e7b878'], [1, '#c48c4c']]),
    lg('wafer', [0, 0, 1, 1], [[0, '#fbe4b8'], [1, '#e2b97c']]),
    lg('mallow', [0, 0, 1, 0], [[0, '#ffffff'], [0.6, '#fbf3f3'], [1, '#e3d1d6']]),
    rg('gummy', [0.38, 0.32, 0.8], [[0, '#ffb3c2'], [0.5, '#ff6b86'], [1, '#d63a5c']]),
    rg('gd-yellow', [0.38, 0.3, 0.8], [[0, '#fff3bf'], [0.55, '#ffd66b'], [1, '#e5a92c']]),
    rg('gd-mint', [0.38, 0.3, 0.8], [[0, '#e3fff4'], [0.55, '#8fe8c8'], [1, '#3fbf94']]),
    rg('gd-pink', [0.38, 0.3, 0.8], [[0, '#ffdbe6'], [0.55, '#ff8fb3'], [1, '#e2548a']]),
    rg('gd-orange', [0.38, 0.3, 0.8], [[0, '#ffe6c8'], [0.55, '#ffb05c'], [1, '#e8812a']]),
    rg('candyGloss', [0.5, 0.5, 0.62, 0.36, 0.32], [[0, '#fff', 0.42], [0.45, '#fff', 0], [0.82, '#000', 0], [1, '#000', 0.2]]),
    rg('floor', [0.5, 0.5, 0.5], [[0, INK, 0.42], [1, INK, 0]]),
    `<clipPath id="roofClip"><path d="${ROOF_D}"/></clipPath>`,
    `<clipPath id="doorClip"><path d="M230 1192V1026A45 45 0 0 1 320 1026V1192Z"/></clipPath>`,
    `<clipPath id="caneL"><path d="${rr(172, 500, 40, 700, 20)}"/></clipPath>`,
    `<clipPath id="caneR"><path d="${rr(1188, 500, 40, 700, 20)}"/></clipPath>`,
  ].join('');

  // gingerbread flecks
  const rnd = rng(31), flecks = [];
  for (let i = 0; i < 140; i++) {
    const x = WALL.x + 30 + rnd() * (WALL.w - 60), y = WALL.y + 60 + rnd() * (WALL.h - 90);
    if (x > 320 && x < 1080 && y > 560 && y < 1170) continue;
    flecks.push(circle(x, y, 1.5 + rnd() * 2.2));
  }
  // base trim: a row of icing scallops along the wall foot
  let trim = `M${P(214, PLATE_Y + 2)}`;
  for (let x = 214; x < 1186; x += 28) trim += `A14 14 0 0 1 ${P(Math.min(x + 28, 1186), PLATE_Y + 2)}`;
  trim += `V${n(PLATE_Y + 14)}H214Z`;

  const body = [
    path(ellipse(700, 1276, 660, 30), { fill: 'url(#floor)' }),
    // lollipop trees behind the house
    lollipop(88, 420, 82, '#ff6f8f', PLATE_Y + 10, '#8fe8c8'),
    lollipop(1316, 640, 76, '#5fd6b0', PLATE_Y + 10, '#ffd66b'),
    marshmallowChimney(),
    // gingerbread wall
    path(rr(WALL.x, WALL.y, WALL.w, WALL.h, 6), { fill: 'url(#wall)', stroke: INK, strokeWidth: 7 }),
    path(flecks.join(''), { fill: '#6f3f1e', fillOpacity: 0.22 }),
    path(rr(WALL.x, WALL.y, WALL.w, 90, 0), { fill: 'url(#eaveShade)' }),
    path(trim, { fill: 'url(#icing)', stroke: INK, strokeWidth: 4, strokeLinejoin: 'round' }),
    // cake-board plate
    path(rr(50, PLATE_Y, 1300, 62, 31), { fill: 'url(#plate)', stroke: INK, strokeWidth: 6 }),
    path(rr(50, PLATE_Y + 32, 1300, 30, [0, 0, 31, 31]), { fill: 'url(#plateEdge)', stroke: INK, strokeWidth: 0 }),
    path(`M${P(110, PLATE_Y + 32)}H1290`, { stroke: INK, strokeOpacity: 0.35, strokeWidth: 3 }),
    path(`M${P(100, PLATE_Y + 12)}H${n(460)}`, { stroke: '#fff', strokeOpacity: 0.8, strokeWidth: 5, strokeLinecap: 'round' }),
    candyCane('caneL', 192, 500, 1200), candyCane('caneR', 1208, 500, 1200),
    windowFrame(),
    door(),
    // round peppermint window on the right wall
    path(circle(1150, 780, 66), { fill: INK, fillOpacity: 0.25, transform: 'translate(5 8)' }),
    path(circle(1150, 780, 66), { fill: 'url(#icing)', stroke: INK, strokeWidth: 5 }),
    peppermint(1150, 780, 50),
    roof(),
    // eave icing with drips over the wall top
    path(dripSlab(96, 1304, 484, 530, 9, [6, 14], [26, 52], [300, 1100, 32]), { fill: INK, fillOpacity: 0.28, transform: 'translate(0 9)' }),
    path(dripSlab(96, 1304, 484, 530, 9, [6, 14], [26, 52], [300, 1100, 32]), { fill: 'url(#icing)', stroke: INK, strokeWidth: 5, strokeLinejoin: 'round' }),
    path('M130 500H420M470 500H560', { stroke: '#fff', strokeWidth: 5, strokeLinecap: 'round' }),
    bear(276, PLATE_Y + 8, 1),
    // fences and bushes
    fence(14, 4, 1098), fence(1246, 4, 1098),
    peppermint(1112, 1150, 40), peppermint(1186, 1164, 34, '#5fd6b0'), peppermint(1150, 1186, 28),
    peppermint(150, 1176, 30, '#5fd6b0'),
    sprinkles(),
    path(sparkle(46, 290, 18), { fill: '#fff', stroke: '#ff9cc0', strokeWidth: 2 }),
    path(sparkle(1352, 330, 14), { fill: '#fff', stroke: '#ff9cc0', strokeWidth: 2 }),
    path(sparkle(1370, 980, 16), { fill: '#fff', stroke: '#5fd6b0', strokeWidth: 2 }),
    path(sparkle(30, 980, 13), { fill: '#fff', stroke: '#ffd66b', strokeWidth: 2 }),
    path(heart(1250, 1040, 12), { fill: '#ff8fb3', stroke: INK, strokeWidth: 2.5 }),
    path(heart(1360, 760, 10), { fill: '#ffd66b', stroke: INK, strokeWidth: 2.5 }),
  ].join('\n');
  return { defs, body };
}

module.exports = {
  W, H, hole, radius, draw,
  meta: {
    name: 'Sweet House', theme: 'candy', rarity: 'rare', translucent: false, collection: 'dreamscapes', license: 'CC-BY-4.0',
    desc: 'A gingerbread cottage with an icing-piped front window, a gumdrop roof and a gummy bear waving you in from the doorstep.',
    tags: ['candy', 'gingerbread', 'cottage', 'sweet', 'pastel', 'cute'],
  },
};
