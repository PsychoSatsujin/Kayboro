'use strict';
// Sticker photo booth: lilac facade, a ring light of soft bulbs around the camera-preview screen,
// a camera lens pod, a heart marquee on the roof, a gathered raspberry curtain tied back at the
// side, holographic die-cut stickers, a coin unit, a heart shutter button and a fresh photo strip.
const L = require('../lib');
const { rr, path, g, lg, rg, circle, ellipse, sparkle, star, heart, tf, rng, lip, poly, n } = L;

const W = 1400, H = 1500, hole = { x: 250, y: 500, w: 680, h: 510 }, radius = 24;
const CX = hole.x + hole.w / 2; // 590: facade centre
const INK = '#4a2a66';
const ROOF = 'M44 302V246Q44 214 78 212Q700 168 1322 212Q1356 214 1356 246V302Z';

/** Points evenly spaced along a rounded rect outline (starting top-centre, clockwise). */
function alongRR(x, y, w, h, r, count) {
  const segs = [], add = (len, f) => segs.push([len, f]);
  const arc = (cx, cy, a0) => (t) => [cx + r * Math.cos(a0 + t * Math.PI / 2), cy + r * Math.sin(a0 + t * Math.PI / 2)];
  add(w - 2 * r, (t) => [x + r + t * (w - 2 * r), y]); add(r * Math.PI / 2, arc(x + w - r, y + r, -Math.PI / 2));
  add(h - 2 * r, (t) => [x + w, y + r + t * (h - 2 * r)]); add(r * Math.PI / 2, arc(x + w - r, y + h - r, 0));
  add(w - 2 * r, (t) => [x + w - r - t * (w - 2 * r), y + h]); add(r * Math.PI / 2, arc(x + r, y + h - r, Math.PI / 2));
  add(h - 2 * r, (t) => [x, y + h - r - t * (h - 2 * r)]); add(r * Math.PI / 2, arc(x + r, y + r, Math.PI));
  const total = segs.reduce((s, [l]) => s + l, 0), out = [];
  for (let i = 0; i < count; i++) {
    let d = ((i / count) * total + (w - 2 * r) / 2) % total;
    for (const [len, f] of segs) { if (d <= len) { out.push(f(d / len)); break; } d -= len; }
  }
  return out;
}

/** Classic parametric heart, centred so (cx, cy) is the middle of its bounding box. */
function heartPts(cx, cy, k, count) {
  const out = [];
  for (let i = 0; i < count; i++) {
    const t = (i / count) * Math.PI * 2;
    const x = 16 * Math.sin(t) ** 3, y = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
    out.push([cx + x * k, cy + (y - 2.6) * k]);
  }
  return out;
}

/** Heart outline points evenly spaced by arc length (first one sits in the top cusp). */
function heartEven(cx, cy, k, count) {
  const dense = heartPts(cx, cy, k, 720), cum = [0];
  for (let i = 1; i <= dense.length; i++) {
    const [ax, ay] = dense[i - 1], [bx, by] = dense[i % dense.length];
    cum.push(cum[i - 1] + Math.hypot(bx - ax, by - ay));
  }
  const total = cum[cum.length - 1], out = [];
  for (let j = 0, i = 0; j < count; j++) {
    const d = (j / count) * total;
    while (cum[i + 1] < d) i++;
    out.push(dense[i]);
  }
  return out;
}

// ---------------------------------------------------------------------------------------- roof
function roof() {
  const stripes = [];
  const x0 = 56, x1 = 1344, sw = 46, top = 298, bot = 330;
  for (let i = 0, x = x0; x < x1 - 1; i++, x += sw) {
    const w = Math.min(sw, x1 - x);
    const d = `M${n(x)} ${top}H${n(x + w)}V${bot}A${n(w / 2)} ${n(w / 2 * 0.8)} 0 0 1 ${n(x)} ${bot}Z`;
    stripes.push(path(d, { fill: i % 2 ? '#fff7fb' : 'url(#pb-valPink)', stroke: INK, strokeWidth: 4, strokeLinejoin: 'round' }));
  }
  return g({},
    path(rr(60, 250, 1290, 96, 30), { fill: INK, fillOpacity: 0.3, transform: 'translate(0 10)' }),
    stripes.join(''),
    path(`M${x0 + 8} ${top + 8}H${x1 - 8}`, { stroke: '#fff', strokeOpacity: 0.5, strokeWidth: 4 }),
    path(ROOF, { fill: 'url(#pb-roof)', stroke: INK, strokeWidth: 6, strokeLinejoin: 'round' }),
    path('M70 230Q700 186 1330 230', { fill: 'none', stroke: 'url(#pb-holoH)', strokeWidth: 16, strokeLinecap: 'round' }),
    path('M70 230Q700 186 1330 230', { fill: 'none', stroke: '#fff', strokeOpacity: 0.5, strokeWidth: 4, strokeLinecap: 'round', transform: 'translate(0 -6)' }),
    path('M84 272H1316', { stroke: '#fff', strokeOpacity: 0.45, strokeWidth: 5, strokeDasharray: '0.1 28', strokeLinecap: 'round' }),
    [70, 1330].map((x) => path(circle(x + 3, 206, 22), { fill: INK, fillOpacity: 0.3 })
      + path(circle(x, 198, 22), { fill: 'url(#pb-holo)', stroke: INK, strokeWidth: 5 })
      + path(ellipse(x - 7, 190, 7, 4.5), { fill: '#fff', fillOpacity: 0.9, transform: `rotate(-30 ${x - 7} 190)` })).join(''),
    path(`M62 284V252Q62 234 84 232`, { fill: 'none', stroke: '#fff', strokeOpacity: 0.7, strokeWidth: 5, strokeLinecap: 'round' }));
}

function marquee() {
  const cy = 124, k = 7.8;
  const outline = poly(heartPts(CX, cy, k, 120)), inner = poly(heartPts(CX, cy + 2, k * 0.8, 120));
  const bulbs = heartEven(CX, cy, k * 0.9, 24).slice(1).map(([x, y], i) => path(circle(x, y, 8.5), { fill: '#eadff6', stroke: INK, strokeWidth: 2.5 })
    + g({ class: i % 2 ? 'pb-tA' : 'pb-tB' },
      path(circle(x, y, 11.5), { fill: 'none', stroke: '#ffd98a', strokeOpacity: 0.6, strokeWidth: 4 }),
      path(circle(x, y, 7.3), { fill: i % 2 ? 'url(#pb-bulbPink)' : 'url(#pb-bulb)' }))
    + path(circle(x - 2.5, y - 2.5, 2.6), { fill: '#fff' })).join('');
  const cam = g({ transform: tf(CX, cy + 6, 0, 1.02) },
    path(rr(-44, -26, 88, 60, 16), { fill: '#fff', stroke: INK, strokeWidth: 4 }),
    path(rr(-22, -38, 30, 16, 6), { fill: '#fff', stroke: INK, strokeWidth: 4 }),
    path(circle(0, 4, 20), { fill: 'url(#pb-lensMini)', stroke: INK, strokeWidth: 4 }),
    path(circle(-6, -2, 5), { fill: '#fff' }),
    path(circle(31, -14, 5), { fill: '#ff6fae' }));
  return g({},
    path(outline, { fill: INK, fillOpacity: 0.3, transform: 'translate(5 10)' }),
    path(outline, { fill: 'url(#pb-pearl)', stroke: INK, strokeWidth: 6, strokeLinejoin: 'round' }),
    path(inner, { fill: 'url(#pb-heartHolo)', stroke: INK, strokeOpacity: 0.5, strokeWidth: 3, strokeLinejoin: 'round' }),
    path(`M${CX - 92} ${cy - 50}Q${CX - 86} ${cy - 80} ${CX - 56} ${cy - 84}`, { fill: 'none', stroke: '#fff', strokeOpacity: 0.85, strokeWidth: 7, strokeLinecap: 'round' }),
    bulbs, cam,
    path(sparkle(CX - 210, 92, 28), { fill: '#fff', stroke: INK, strokeWidth: 3 }),
    path(sparkle(CX + 200, 62, 20), { fill: '#fff3b8', stroke: INK, strokeWidth: 3 }),
    path(sparkle(CX + 240, 132, 13), { fill: '#bdf3ff', stroke: INK, strokeWidth: 2.5 }));
}

// ------------------------------------------------------------------------------- curtain side
// Curtain geometry: left (free) edge sweeps out to the tieback and back to the hem on the plinth.
const X0 = 1112, X1 = 1322, CT = 356, CB = 1300, tieY = 812, tieX = 1268;
const EDGE = `M${X0} ${CT}C${X0 + 6} 540 ${tieX - 60} 700 ${tieX} ${tieY}C${tieX - 70} 960 ${X0 + 30} 1140 ${X0 + 14} ${CB}`;
const CURTAIN_D = `${EDGE}L${X1} ${CB}L${X1} ${CT}Z`;

function curtainBay() {
  const top = CT, bot = CB, edge = EDGE, curtain = CURTAIN_D;
  // Gathered folds: filled bands that pinch at the tieback and flare at the hem, at uneven spacing.
  const band = (t, dx, wt, wm, wb) => {
    const xt = X0 + (X1 - X0) * t + dx, xm = tieX + (X1 - tieX) * t + dx * 0.3, xb = X0 + 14 + (X1 - X0 - 14) * t + dx;
    const side = (k) => [[xt + k * wt, top + 4], [xt + 2 + k * wt * 0.9, 540], [xm - 30 + k * wm * 1.4, 700], [xm + k * wm, tieY],
      [xm - 40 + k * wm * 1.6, 960], [xb + 4 + k * wb * 0.8, 1140], [xb + k * wb, bot - 4]];
    const l = side(-1), r = side(1).reverse(), P = ([x, y]) => `${n(x)} ${n(y)}`;
    return `M${P(l[0])}C${P(l[1])} ${P(l[2])} ${P(l[3])}C${P(l[4])} ${P(l[5])} ${P(l[6])}`
      + `L${P(r[0])}C${P(r[1])} ${P(r[2])} ${P(r[3])}C${P(r[4])} ${P(r[5])} ${P(r[6])}Z`;
  };
  const ts = [0.13, 0.37, 0.6, 0.84];
  const shade = ts.map((t, i) => band(t, 0, 13 + (i % 2) * 3, 2.5, 17 + (i % 3) * 2)).join('');
  const lite = ts.map((t) => band(t, -22, 3, 0.8, 5)).join('');
  const hem = [];
  for (let x = X0 + 18; x < X1 - 14; x += 24) hem.push(circle(x + 12, bot - 4, 8));
  const rings = [1124, 1160, 1196, 1232, 1268, 1304];
  return g({},
    // interior
    path(rr(X0 - 4, 330, X1 - X0 + 8, 980, 0), { fill: 'url(#pb-interior)' }),
    path(ellipse(1150, 580, 90, 220), { fill: 'url(#pb-glowIn)' }),
    path(rr(X0 - 4, 330, 26, 980, 0), { fill: '#000', fillOpacity: 0.25 }),
    // curtain (soft contact shadow where the cloth meets the dark interior)
    path(edge, { fill: 'none', stroke: INK, strokeOpacity: 0.16, strokeWidth: 44 }),
    path(edge, { fill: 'none', stroke: INK, strokeOpacity: 0.22, strokeWidth: 20 }),
    path(curtain, { fill: 'url(#pb-curtain)' }),
    g({ clipPath: 'url(#pb-curtainClip)' },
      path(shade, { fill: '#c8417f', fillOpacity: 0.42 }),
      path(lite, { fill: '#ffd6ea', fillOpacity: 0.5 })),
    path(curtain, { fill: 'none', stroke: INK, strokeWidth: 5, strokeLinejoin: 'round' }),
    path(edge, { fill: 'none', stroke: '#ffd0e6', strokeOpacity: 0.7, strokeWidth: 4, transform: 'translate(7 0)' }),
    path(hem.join(''), { fill: '#fff4fa', stroke: INK, strokeWidth: 3 }),
    // rod + rings
    path(rr(1096, 350, 240, 14, 7), { fill: 'url(#pb-chrome)', stroke: INK, strokeWidth: 4 }),
    rings.map((x) => path(ellipse(x, 362, 9, 12), { fill: 'none', stroke: INK, strokeWidth: 4 })).join(''),
    // tieback
    path(`M${tieX - 18} ${tieY - 30}C${tieX + 30} ${tieY - 40} ${X1 + 18} ${tieY - 20} ${X1 + 10} ${tieY}C${X1 + 18} ${tieY + 24} ${tieX + 20} ${tieY + 36} ${tieX - 18} ${tieY + 26}`, { fill: 'none', stroke: INK, strokeWidth: 16, strokeLinecap: 'round' }),
    path(`M${tieX - 18} ${tieY - 30}C${tieX + 30} ${tieY - 40} ${X1 + 18} ${tieY - 20} ${X1 + 10} ${tieY}C${X1 + 18} ${tieY + 24} ${tieX + 20} ${tieY + 36} ${tieX - 18} ${tieY + 26}`, { fill: 'none', stroke: 'url(#pb-holoH)', strokeWidth: 9, strokeLinecap: 'round' }),
    path(heart(tieX - 22, tieY + 2, 26), { fill: INK, fillOpacity: 0.35, transform: 'translate(3 6)' }),
    path(heart(tieX - 22, tieY + 2, 26), { fill: 'url(#pb-candy)', stroke: INK, strokeWidth: 4 }),
    path(ellipse(tieX - 32, tieY - 6, 7, 4), { fill: '#fff', fillOpacity: 0.85, transform: `rotate(-30 ${tieX - 32} ${tieY - 6})` }),
    // pillars
    path(rr(1090, 320, 30, 1080, 6), { fill: 'url(#pb-pillar)', stroke: INK, strokeWidth: 5 }),
    path(rr(1318, 320, 30, 1080, 6), { fill: 'url(#pb-pillar)', stroke: INK, strokeWidth: 5 }));
}

// ------------------------------------------------------------------------------------ facade
function facade() {
  const rnd = rng(31), dots = [], twinkles = [];
  for (let i = 0; i < 90; i++) {
    const x = 96 + rnd() * 990, y = 350 + rnd() * 950;
    const inHousing = x > hole.x - 100 && x < hole.x + hole.w + 100 && y > hole.y - 100 && y < hole.y + hole.h + 100;
    if (inHousing || (y > 1100 && x > 150 && x < 1030)) continue;
    if (i % 4) dots.push(circle(x, y, 2 + rnd() * 2)); else twinkles.push(sparkle(x, y, 7 + rnd() * 6));
  }
  const kick = [];
  for (let x = 130; x < 1060; x += 46) kick.push(circle(x, 1356, 5));
  for (let x = 1130; x < 1320; x += 46) kick.push(circle(x, 1356, 5));
  return g({},
    path(rr(80, 320, 1020, 1080, [0, 0, 22, 22]), { fill: 'url(#pb-facade)', stroke: INK, strokeWidth: 6 }),
    path(rr(86, 330, 22, 1062, [0, 0, 0, 16]), { fill: '#fff', fillOpacity: 0.35 }),
    g({ clipPath: 'url(#pb-facadeClip)' },
      path('M80 1060L80 900L520 330L700 330Z', { fill: '#fff', fillOpacity: 0.16 }),
      path('M80 1250L80 1170L760 330L800 330Z', { fill: '#fff', fillOpacity: 0.14 })),
    path(dots.join(''), { fill: '#fff', fillOpacity: 0.55 }),
    path(twinkles.join(''), { fill: '#fff', fillOpacity: 0.7 }),
    // plinth
    path(rr(80, 1306, 1020, 94, [0, 0, 22, 22]), { fill: 'url(#pb-plinth)', stroke: INK, strokeWidth: 6 }),
    path(rr(86, 1316, 1008, 8, 4), { fill: 'url(#pb-holoH)' }),
    path(rr(1090, 1306, 258, 94, [0, 0, 18, 18]), { fill: 'url(#pb-plinth)', stroke: INK, strokeWidth: 6 }),
    path(rr(1096, 1316, 246, 8, 4), { fill: 'url(#pb-holoH)' }),
    path(kick.join(''), { fill: '#fff', fillOpacity: 0.35, transform: 'translate(1.5 2)' }),
    path(kick.join(''), { fill: INK, fillOpacity: 0.45 }),
    path('M96 1388H1084M1104 1388H1334', { stroke: INK, strokeOpacity: 0.25, strokeWidth: 4, strokeLinecap: 'round' }),
    [150, 1030, 1130, 1320].map((x) => path(rr(x - 26, 1398, 52, 18, [0, 0, 8, 8]), { fill: INK })).join(''));
}

function ringLight() {
  const holeD = rr(hole.x, hole.y, hole.w, hole.h, radius);
  const o = 84, ro = radius + o;
  const bulbs = alongRR(hole.x - 46, hole.y - 46, hole.w + 92, hole.h + 92, radius + 46, 36)
    .filter(([x, y]) => !(y < hole.y - 30 && Math.abs(x - CX) < 140))
    .map(([x, y], i) => path(circle(x + 1.5, y + 4, 18), { fill: INK, fillOpacity: 0.3 })
      + path(circle(x, y, 18), { fill: 'url(#pb-socket)', stroke: INK, strokeWidth: 3 })
      + path(circle(x, y, 12.5), { fill: '#eadff6' })
      + g({ class: i % 2 ? 'pb-tA' : 'pb-tB' },
        path(circle(x, y, 16), { fill: 'none', stroke: '#ffd98a', strokeOpacity: 0.55, strokeWidth: 5 }),
        path(circle(x, y, 12.5), { fill: i % 3 === 1 ? 'url(#pb-bulbPink)' : 'url(#pb-bulb)' }))
      + path(ellipse(x - 4, y - 4.5, 4.5, 3), { fill: '#fff', transform: `rotate(-35 ${n(x - 4)} ${n(y - 4.5)})` })).join('');
  return g({},
    path(rr(hole.x - o - 8, hole.y - o - 8, hole.w + 2 * o + 16, hole.h + 2 * o + 16, ro + 8), { fill: INK, fillOpacity: 0.35, transform: 'translate(6 12)' }),
    path(rr(hole.x - o - 8, hole.y - o - 8, hole.w + 2 * o + 16, hole.h + 2 * o + 16, ro + 8), { fill: 'url(#pb-holo)', stroke: INK, strokeWidth: 6 }),
    path(rr(hole.x - o + 4, hole.y - o + 4, hole.w + 2 * o - 8, hole.h + 2 * o - 8, ro - 4), { fill: 'url(#pb-ringBody)', stroke: INK, strokeOpacity: 0.6, strokeWidth: 3 }),
    path(`M${hole.x - o + 18} ${hole.y + 120}V${hole.y - o + ro}Q${hole.x - o + 18} ${hole.y - o + 18} ${hole.x - o + ro} ${hole.y - o + 18}H${hole.x + 60}`, { fill: 'none', stroke: '#fff', strokeOpacity: 0.9, strokeWidth: 6, strokeLinecap: 'round' }),
    path(rr(hole.x - 24, hole.y - 24, hole.w + 48, hole.h + 48, radius + 24), { fill: 'url(#pb-bezel)', stroke: INK, strokeWidth: 4 }),
    path(rr(hole.x - 14, hole.y - 14, hole.w + 28, hole.h + 28, radius + 14), { fill: 'none', stroke: '#8f72c4', strokeOpacity: 0.5, strokeWidth: 2 }),
    lip(holeD, '#000', [[7, 0.3], [3, 0.6]]),
    bulbs);
}

function cameraPod() {
  const cy = 404;
  return g({},
    path(rr(470, cy - 58, 240, 116, 58), { fill: INK, fillOpacity: 0.35, transform: 'translate(4 9)' }),
    path(rr(470, cy - 58, 240, 116, 58), { fill: 'url(#pb-pearl)', stroke: INK, strokeWidth: 6 }),
    path(rr(506, cy - 50, 168, 22, 11), { fill: '#fff', fillOpacity: 0.6 }),
    path(circle(CX, cy, 50), { fill: 'url(#pb-holo)', stroke: INK, strokeWidth: 5 }),
    path(circle(CX, cy, 38), { fill: 'url(#pb-lensRing)', stroke: INK, strokeWidth: 4 }),
    path(circle(CX, cy, 26), { fill: 'url(#pb-glass)', stroke: '#1b1030', strokeWidth: 3 }),
    path(circle(CX, cy, 14), { fill: 'none', stroke: '#8fd8ff', strokeOpacity: 0.5, strokeWidth: 3 }),
    path(ellipse(CX - 9, cy - 10, 9, 5.5), { fill: '#fff', fillOpacity: 0.9, transform: `rotate(-35 ${CX - 9} ${cy - 10})` }),
    path(circle(CX + 11, cy + 10, 3.5), { fill: '#fff', fillOpacity: 0.6 }),
    // flash window + record light
    path(rr(496, cy - 22, 44, 44, 14), { fill: 'url(#pb-flash)', stroke: INK, strokeWidth: 4 }),
    path('M506 392H530M506 404H530M506 416H530', { stroke: '#fff', strokeOpacity: 0.8, strokeWidth: 2.5 }),
    path(circle(664, cy - 10, 16), { fill: 'url(#pb-glowPink)', class: 'pb-tA' }),
    path(circle(664, cy - 10, 8), { fill: '#ff4f9a', stroke: INK, strokeWidth: 3 }),
    path(circle(661.5, cy - 12.5, 2.5), { fill: '#fff' }),
    path('M652 414h24M652 426h16', { stroke: INK, strokeOpacity: 0.4, strokeWidth: 4, strokeLinecap: 'round' }));
}

// --------------------------------------------------------------------------------- stickers
/** Die-cut sticker: parts are [d, fill, extraAttrs]; gets a white backing, drop shadow and gloss. */
function sticker(x, y, rot, parts, gloss = [], s = 1) {
  const all = parts.map(([d]) => d).join('');
  return g({ transform: tf(x, y, rot, s) },
    path(all, { fill: INK, fillOpacity: 0.3, stroke: INK, strokeOpacity: 0.3, strokeWidth: 18, strokeLinejoin: 'round', transform: 'translate(3 7)' }),
    path(all, { fill: '#fff', stroke: '#fff', strokeWidth: 18, strokeLinejoin: 'round' }),
    path(all, { fill: 'none', stroke: '#d8c9f2', strokeWidth: 1.5, strokeLinejoin: 'round' }),
    parts.map(([d, fill, extra = {}]) => path(d, { fill, stroke: INK, strokeWidth: 3.5, strokeLinejoin: 'round', ...extra })).join(''),
    gloss.map((d) => path(d, { fill: '#fff', fillOpacity: 0.8 })).join(''));
}

function crown() {
  const d = 'M-46 28L-52 -24L-24 2L0 -38L24 2L52 -24L46 28Z';
  return sticker(150, 418, -14, [
    [d, 'url(#pb-gold)'],
    [rr(-48, 20, 96, 18, 6), 'url(#pb-gold)'],
    [circle(-52, -28, 8), 'url(#pb-gemPink)'], [circle(0, -42, 9), 'url(#pb-gemCyan)'], [circle(52, -28, 8), 'url(#pb-gemPink)'],
    [heart(0, 8, 11), '#ff5f9e', { strokeWidth: 2.5 }],
  ], [ellipse(-30, 0, 7, 4)]);
}

function bunnyEars() {
  const ear = (s) => `M${s * 14} 10C${s * 6} -40 ${s * 18} -96 ${s * 40} -98C${s * 62} -100 ${s * 58} -44 ${s * 38} 10Z`;
  const inner = (s) => `M${s * 22} 0C${s * 18} -40 ${s * 26} -80 ${s * 39} -82C${s * 52} -82 ${s * 48} -40 ${s * 33} 0Z`;
  return sticker(1030, 440, 4, [
    [ear(-1), '#fffafc'], [ear(1), '#fffafc'],
    [inner(-1), '#ffb3d4', { strokeWidth: 0 }], [inner(1), '#ffb3d4', { strokeWidth: 0 }],
    ['M-62 22Q0 -14 62 22L60 34Q0 0 -60 34Z', 'url(#pb-candy)'],
    [heart(0, 8, 13), '#fff', { strokeWidth: 2.5 }],
  ], [ellipse(-40, -70, 4, 9)], 0.82);
}

function holoHeart(x, y, rot, s) {
  return sticker(x, y, rot, [[heart(0, 0, s), 'url(#pb-holo)']], [ellipse(-s * 0.45, -s * 0.38, s * 0.22, s * 0.12)]);
}

function sparkleCluster(x, y, rot) {
  return sticker(x, y, rot, [
    [sparkle(0, 0, 36, 0.2), 'url(#pb-holo)'],
    [sparkle(30, 30, 16, 0.22), '#fff3b8'],
    [sparkle(-28, 28, 12, 0.22), '#bdf3ff'],
  ]);
}

function starSticker(x, y, rot) {
  return sticker(x, y, rot, [[star(0, 0, 34, 16), 'url(#pb-starFill)'],
    ['M-9 -2h0.1M9 -2h0.1', 'none', { strokeWidth: 6, strokeLinecap: 'round' }],
    ['M-5 8Q0 12 5 8', 'none', { strokeWidth: 3, strokeLinecap: 'round' }]], [ellipse(-10, -14, 5, 3)]);
}

// ------------------------------------------------------------------------------- control deck
function deck() {
  const top = 1124;
  const coin = g({},
    path(rr(196, top + 18, 150, 140, 28), { fill: 'url(#pb-chrome)', stroke: INK, strokeWidth: 5 }),
    path(rr(206, top + 26, 130, 16, 8), { fill: '#fff', fillOpacity: 0.55 }),
    // coin pictogram
    path(circle(232, top + 72, 18), { fill: 'url(#pb-gold)', stroke: INK, strokeWidth: 3.5 }),
    path(star(232, top + 72, 9, 4), { fill: '#fff8d6' }),
    path(poly([[258, top + 66], [268, top + 72], [258, top + 78]]), { fill: INK, fillOpacity: 0.6 }),
    // slot
    path(rr(282, top + 44, 36, 62, 12), { fill: '#e6dcfa', stroke: INK, strokeWidth: 4 }),
    path(rr(294, top + 52, 12, 46, 6), { fill: '#1d1230' }),
    path(circle(300, top + 124, 13), { fill: 'url(#pb-candyMint)', stroke: INK, strokeWidth: 3.5 }),
    path(circle(296, top + 120, 3.5), { fill: '#fff' }),
    path(rr(214, top + 112, 56, 28, 10), { fill: '#1d1230', stroke: INK, strokeWidth: 3 }),
    path('M220 1240H264', { stroke: '#fff', strokeOpacity: 0.25, strokeWidth: 3 }));
  const btn = (x, y, r, fill, glyph) => path(circle(x + 2, y + 8, r + 8), { fill: INK, fillOpacity: 0.3 })
    + path(circle(x, y, r + 8), { fill: 'url(#pb-chrome)', stroke: INK, strokeWidth: 4 })
    + path(circle(x, y, r), { fill, stroke: INK, strokeWidth: 3.5 })
    + path(glyph, { fill: '#fff', fillOpacity: 0.95 })
    + path(ellipse(x - r * 0.38, y - r * 0.45, r * 0.3, r * 0.17), { fill: '#fff', fillOpacity: 0.8, transform: `rotate(-30 ${n(x - r * 0.38)} ${n(y - r * 0.45)})` });
  const shutter = g({},
    path(rr(CX - 92, top + 26, 184, 124, 50), { fill: 'url(#pb-chrome)', stroke: INK, strokeWidth: 5 }),
    path(heart(CX + 3, top + 96, 60), { fill: INK, fillOpacity: 0.4 }),
    path(heart(CX, top + 86, 60), { fill: 'url(#pb-candy)', stroke: INK, strokeWidth: 5 }),
    path(ellipse(CX - 26, top + 66, 16, 9), { fill: '#fff', fillOpacity: 0.85, transform: `rotate(-30 ${CX - 26} ${top + 66})` }),
    path(sparkle(CX + 22, top + 64, 7), { fill: '#fff', fillOpacity: 0.8 }));
  const print = g({},
    path(rr(834, top + 18, 150, 140, 28), { fill: 'url(#pb-chrome)', stroke: INK, strokeWidth: 5 }),
    path(rr(844, top + 26, 130, 16, 8), { fill: '#fff', fillOpacity: 0.55 }),
    // photo pictogram + arrow
    path(rr(872, top + 50, 40, 32, 6), { fill: '#fff', stroke: INK, strokeWidth: 3 }),
    path(circle(892, top + 66, 8), { fill: '#ffb3d4', stroke: INK, strokeWidth: 2.5 }),
    path(poly([[930, top + 56], [952, top + 56], [941, top + 74]]), { fill: '#ff6fae', stroke: INK, strokeWidth: 3, strokeLinejoin: 'round', class: 'pb-tA' }),
    path(rr(852, top + 112, 114, 18, 9), { fill: '#1d1230', stroke: INK, strokeWidth: 3 }));
  return g({},
    path(rr(176, top + 4, 828, 176, 40), { fill: INK, fillOpacity: 0.3, transform: 'translate(4 9)' }),
    path(rr(176, top, 828, 176, 40), { fill: 'url(#pb-pearl)', stroke: INK, strokeWidth: 6 }),
    path(`M206 ${top + 14}H974`, { stroke: '#fff', strokeOpacity: 0.85, strokeWidth: 5, strokeLinecap: 'round' }),
    coin, shutter, print,
    btn(430, top + 90, 26, 'url(#pb-candyMint)', star(430, top + 90, 13, 6)),
    btn(750, top + 90, 26, 'url(#pb-candyLilac)', sparkle(750, top + 90, 14, 0.22)));
}

function photoStrip() {
  const x = 860, y = 1250, w = 98, fh = 60;
  const face = (cx, cy, kind) => {
    const acc = kind === 0 ? path(`M${cx - 10} ${cy - 14}Q${cx - 18} ${cy - 40} ${cx - 8} ${cy - 40}Q${cx - 2} ${cy - 30} ${cx - 2} ${cy - 16}ZM${cx + 10} ${cy - 14}Q${cx + 18} ${cy - 40} ${cx + 8} ${cy - 40}Q${cx + 2} ${cy - 30} ${cx + 2} ${cy - 16}Z`, { fill: '#fff', stroke: INK, strokeWidth: 2 })
      : kind === 1 ? path(`M${cx - 14} ${cy - 12}L${cx - 16} ${cy - 26}L${cx - 7} ${cy - 18}L${cx} ${cy - 28}L${cx + 7} ${cy - 18}L${cx + 16} ${cy - 26}L${cx + 14} ${cy - 12}Z`, { fill: '#ffd76a', stroke: INK, strokeWidth: 2 })
        : path(heart(cx + 16, cy - 14, 7), { fill: '#ff5f9e', stroke: INK, strokeWidth: 1.5 });
    return acc + path(circle(cx, cy, 15), { fill: '#ffe2cf', stroke: INK, strokeWidth: 2 })
      + path(`M${cx - 5} ${cy - 1}h0.1M${cx + 5} ${cy - 1}h0.1`, { stroke: INK, strokeWidth: 4, strokeLinecap: 'round' })
      + path(`M${cx - 3} ${cy + 6}Q${cx} ${cy + 9} ${cx + 3} ${cy + 6}`, { fill: 'none', stroke: INK, strokeWidth: 1.8, strokeLinecap: 'round' })
      + path(ellipse(cx - 9, cy + 4, 3.5, 2), { fill: '#ff8fbf' }) + path(ellipse(cx + 9, cy + 4, 3.5, 2), { fill: '#ff8fbf' });
  };
  const bgs = ['#ffd3e8', '#d4f7ec'];
  const frames = bgs.map((c, i) => {
    const fy = y + 14 + i * (fh + 8);
    return path(rr(x + 9, fy, w - 18, fh, 4), { fill: c }) + path(sparkle(x + 22, fy + 12, 5), { fill: '#fff' })
      + face(x + w / 2, fy + fh / 2 + 8, i);
  }).join('');
  const total = 14 + 2 * (fh + 8) + 6; // 156: ends just in front of the plinth, above the floor
  return g({ transform: `rotate(4 ${x + w / 2} ${y})` },
    path(rr(x + 6, y + 8, w, total, 4), { fill: INK, fillOpacity: 0.3 }),
    path(rr(x, y, w, total, 4), { fill: '#fffdfe', stroke: INK, strokeWidth: 3.5 }),
    frames,
    path(rr(x + 4, y + total - 11, w - 8, 5, 2), { fill: 'url(#pb-holoH)' }),
    // the fresh print curls forward at the tip
    path(`M${x + 1.75} ${y + total - 6}H${x + w - 1.75}V${y + total - 4}Q${x + w - 1.75} ${y + total - 1.75} ${x + w - 4} ${y + total - 1.75}H${x + 4}Q${x + 1.75} ${y + total - 1.75} ${x + 1.75} ${y + total - 4}Z`, { fill: '#ffffff' }),
    path(`M${x + 3} ${y + total - 6}H${x + w - 3}`, { stroke: INK, strokeOpacity: 0.55, strokeWidth: 2 }),
    path(`M${x + w - 8} ${y + 10}V${y + total - 16}`, { stroke: '#e6dcf5', strokeWidth: 2 }),
    path(rr(x - 10, y - 6, w + 20, 14, 7), { fill: 'url(#pb-chrome)', stroke: INK, strokeWidth: 3.5 }));
}

// ------------------------------------------------------------------------------------- draw
function draw() {
  const defs = [
    '<style>.pb-tA{animation:pb-tw 2.4s steps(1) infinite}.pb-tB{animation:pb-tw 2.4s steps(1) 1.2s infinite}'
      + '@keyframes pb-tw{0%{opacity:1}50%{opacity:.25}}'
      + '@media (prefers-reduced-motion:reduce){*{animation:none!important}}</style>',
    lg('pb-holo', [0, 0, 1, 1], [[0, '#ffd1f0'], [0.2, '#d6c4ff'], [0.4, '#b4ecff'], [0.6, '#d2ffe8'], [0.8, '#fff1bf'], [1, '#ffc2e4']]),
    lg('pb-holoH', [0, 0, 1, 0], [[0, '#ffc2e4'], [0.2, '#d6c4ff'], [0.4, '#a8e8ff'], [0.6, '#c9ffe2'], [0.8, '#fff1bf'], [1, '#ffc2e4']]),
    lg('pb-facade', [0, 0, 0, 1], [[0, '#efe4ff'], [0.55, '#d8c6fb'], [1, '#bea6f0']]),
    lg('pb-plinth', [0, 0, 0, 1], [[0, '#9a7ed6'], [1, '#6c51a6']]),
    lg('pb-roof', [0, 0, 0, 1], [[0, '#ffc3df'], [0.6, '#ff8fc0'], [1, '#e8669f']]),
    lg('pb-valPink', [0, 0, 0, 1], [[0, '#ff9cc8'], [1, '#f06aa6']]),
    lg('pb-pearl', [0, 0, 1, 1], [[0, '#ffffff'], [0.5, '#f7f0ff'], [1, '#dccbf2']]),
    lg('pb-bezel', [0, 0, 0, 1], [[0, '#2a1b40'], [1, '#3a2758']]),
    lg('pb-chrome', [0, 0, 0, 1], [[0, '#fbf8ff'], [0.5, '#ddd2f3'], [1, '#b7a6dc']]),
    lg('pb-pillar', [0, 0, 1, 0], [[0, '#c8b4f2'], [0.4, '#f3ecff'], [1, '#a68ad8']]),
    lg('pb-curtain', [0, 0, 1, 0], [[0, '#ff9fcb'], [0.5, '#f977b3'], [1, '#d94d93']]),
    lg('pb-interior', [0, 0, 0, 1], [[0, '#2c1a44'], [1, '#43285f']]),
    lg('pb-gold', [0, 0, 0, 1], [[0, '#fff3b8'], [0.5, '#ffd166'], [1, '#e7a63a']]),
    lg('pb-starFill', [0, 0, 0, 1], [[0, '#fff6c4'], [1, '#ffc94d']]),
    lg('pb-flash', [0, 0, 0, 1], [[0, '#ffffff'], [1, '#e2ecff']]),
    rg('pb-bulb', [0.4, 0.35, 0.7], [[0, '#ffffff'], [0.55, '#fff6d6'], [1, '#ffd98a']]),
    rg('pb-bulbPink', [0.4, 0.35, 0.7], [[0, '#ffffff'], [0.55, '#ffe2ef'], [1, '#ffa3cc']]),
    rg('pb-socket', [0.4, 0.35, 0.75], [[0, '#ffffff'], [1, '#c4b2e8']]),
    lg('pb-ringBody', [0, 0, 1, 1], [[0, '#fff3fb'], [0.5, '#f5d9ee'], [1, '#d9bdf0']]),
    rg('pb-heartHolo', [0.4, 0.35, 0.75], [[0, '#ffe3f2'], [0.55, '#ff9ccc'], [1, '#c9a8ff']]),
    rg('pb-glowPink', [0.5, 0.5, 0.5], [[0, '#ff7fb6', 0.8], [1, '#ff7fb6', 0]]),
    rg('pb-candy', [0.38, 0.32, 0.75], [[0, '#ffe0ef'], [0.5, '#ff8fc0'], [1, '#e2508f']]),
    rg('pb-candyMint', [0.38, 0.32, 0.75], [[0, '#e4fff5'], [1, '#43cfa0']]),
    rg('pb-candyLilac', [0.38, 0.32, 0.75], [[0, '#f2e8ff'], [1, '#9b74f0']]),
    rg('pb-gemPink', [0.35, 0.3, 0.8], [[0, '#ffe8f3'], [1, '#ff4f9a']]),
    rg('pb-gemCyan', [0.35, 0.3, 0.8], [[0, '#eafcff'], [1, '#33b6e6']]),
    rg('pb-lensRing', [0.4, 0.35, 0.8], [[0, '#6a5a8c'], [1, '#22163a']]),
    rg('pb-glass', [0.35, 0.3, 0.8], [[0, '#8f9dff'], [0.5, '#3c2a9a'], [1, '#120a26']]),
    rg('pb-lensMini', [0.35, 0.3, 0.8], [[0, '#c4d0ff'], [0.5, '#6a5ae0'], [1, '#2a1858']]),
    rg('pb-glowIn', [0.5, 0.5, 0.5], [[0, '#ff9fd0', 0.28], [1, '#ff9fd0', 0]]),
    `<clipPath id="pb-curtainClip"><path d="${CURTAIN_D}"/></clipPath>`,
    `<clipPath id="pb-facadeClip"><path d="${rr(80, 320, 1020, 1080, [0, 0, 22, 22])}"/></clipPath>`,
    rg('pb-floor', [0.5, 0.5, 0.5], [[0, INK, 0.4], [1, INK, 0]]),
  ].join('');

  const body = [
    path(ellipse(700, 1420, 680, 34), { fill: 'url(#pb-floor)' }),
    curtainBay(),
    facade(),
    roof(),
    marquee(),
    ringLight(),
    cameraPod(),
    deck(),
    photoStrip(),
    crown(),
    bunnyEars(),
    holoHeart(126, 760, -12, 34),
    sparkleCluster(1050, 720, 8),
    starSticker(128, 1010, 10),
    holoHeart(1056, 990, 14, 26),
    path(sparkle(36, 470, 18), { fill: '#fff', stroke: INK, strokeWidth: 2.5 }),
    path(sparkle(1374, 560, 14), { fill: '#fff3b8', stroke: INK, strokeWidth: 2.5 }),
    path(star(40, 1200, 12, 5), { fill: '#bdf3ff', stroke: INK, strokeWidth: 2.5 }),
  ].join('\n');
  return { defs, body };
}

module.exports = {
  W, H, hole, radius, draw,
  meta: { name: 'Snap Booth', theme: 'photo-booth', rarity: 'rare', translucent: false, collection: 'coin-op', license: 'CC-BY-4.0',
    desc: 'Strike a pose in a pastel sticker booth with a glowing ring light, a holo heart marquee and a fresh photo strip.',
    tags: ['photo-booth', 'kawaii', 'y2k', 'pastel', 'holographic', 'coin-op'] },
};
