'use strict';
// Rose Window: a gothic facade at night, its stone in cool moonlit slate while the glass burns from within.
// The great rose is true twelve-fold tracery (spokes, pointed heads, foiled roundels) over glass cut as a
// symmetric Voronoi mosaic (d3-delaunay), coloured from a Chartres palette of cobalt and ruby with gold,
// violet and emerald accents (chroma-js), the colour of each piece chosen by seeded simplex noise. Two small
// six-fold roses sit in the spandrels and tall mosaic lancets with iron ferramenta stand in the wings under
// crocketed pinnacles. Coloured light radiates from the rose across the stone and falls in shafts toward the
// sill; around the picture, a calm panel of dark dressed stone with a plain rebate. Abstract glass only.
const L = require('../lib');
const { rr, path, g, lg, rg, circle, ellipse, poly, tf, n, P, rng } = L;
const { Delaunay } = require('d3-delaunay');
const { createNoise2D } = require('simplex-noise');
const chroma = require('chroma-js');

const W = 1800, H = 1610;
const CX = 900;
const hole = { x: 452, y: 900, w: 896, h: 504 }, radius = 0;
const SPRING = 860, ARCH_L = 300, ARCH_R = 1500, BASE = 1444; // central arch: jambs, springing line, plinth top
const D = 233.33, R0 = 833.33; // arc centre offset from CX and radius of the outer arch
const ROSE = { x: CX, y: 500, r: 272 };
const LEAD = '#0c0a0e';
const STONE_D = '#121016';
const f1 = (v) => Math.round(v * 10) / 10;
const rad = (a) => (a * Math.PI) / 180;
const at = (cx, cy, r, a) => [cx + r * Math.cos(a), cy + r * Math.sin(a)];

// Chartres palette: cobalt dominates, ruby answers, gold / violet / emerald accent.
const PAL = { blue: '#2452d6', deep: '#142a86', sky: '#3c7ae6', ruby: '#c4142c', gold: '#e6a01e', vio: '#6a3cc8', eme: '#11905e' };

const apexY = (inset) => SPRING - Math.sqrt((R0 - inset) ** 2 - D * D);
/** The pointed arch opening at a given inset from the outer edge, with vertical jambs down to y = bottom. */
function arch(inset, bottom = BASE) {
  const r = R0 - inset, xl = ARCH_L + inset, xr = ARCH_R - inset, ay = apexY(inset);
  return `M${P(xl, bottom)}V${SPRING}A${P(r, r)} 0 0 1 ${P(CX, ay)}A${P(r, r)} 0 0 1 ${P(xr, SPRING)}V${bottom}Z`;
}
/** Points along the left half of an arch curve (springing to apex), with the tangent angle, for crockets. */
function archPoints(inset, step) {
  const r = R0 - inset, out = [];
  const a0 = Math.PI, a1 = Math.PI + (Math.PI / 2 - Math.asin(D / r));
  const k = Math.floor((r * (a1 - a0)) / step);
  for (let i = 1; i < k; i++) {
    const a = a0 + ((a1 - a0) * i) / k;
    out.push([CX + D + r * Math.cos(a), SPRING + r * Math.sin(a), (a * 180) / Math.PI - 180]);
  }
  return out;
}
/** Pointed lancet: sides from (x, y1) up to the springing, pointed head at y0. */
function lancet(x, y0, w, y1) {
  const s = y0 + w * 0.86, r = w * 0.95;
  return `M${P(x, y1)}V${n(s)}A${P(r, r)} 0 0 1 ${P(x + w / 2, y0)}A${P(r, r)} 0 0 1 ${P(x + w, s)}V${n(y1)}Z`;
}

/** Voronoi cells of `pts` inside `bounds`, concatenated into one path per group key. */
function cellGroups(pts, keyOf, bounds) {
  const v = Delaunay.from(pts).voronoi(bounds), out = new Map();
  pts.forEach((_, i) => {
    const c = v.cellPolygon(i);
    if (!c) return;
    const d = `M${c.slice(0, -1).map(([x, y]) => `${f1(x)} ${f1(y)}`).join('L')}Z`;
    out.set(keyOf[i], (out.get(keyOf[i]) || '') + d);
  });
  return out;
}

/** Shift a palette colour a little in hue and lightness (the variation of hand-blown glass). */
function vary(name, dh, dl) {
  const c = chroma(PAL[name]);
  return c.set('hsl.h', (c.get('hsl.h') + dh + 360) % 360).brighten(dl);
}

/**
 * Glass for a round window with `fold`-fold mirror symmetry: `per` seeds in one half-sector are mirrored and
 * rotated, so the Voronoi mosaic itself is symmetric; each seed's copies share one colour, so the whole
 * window is `per` paths. Returns { defs, body } (body clipped by the caller).
 */
function roseGlass(id, cx, cy, R, fold, per, seed, pick) {
  const rnd = rng(seed), noise = createNoise2D(rng(seed + 1)), half = Math.PI / fold, base = [];
  for (let i = 0; i < per; i++) {
    const t = (i + 0.2 + rnd() * 0.6) / per, r = R * (0.08 + 0.94 * Math.sqrt(t));
    base.push([r, half * (0.1 + 0.8 * rnd())]);
  }
  const pts = [], key = [];
  for (let k = 0; k < fold; k++) for (let j = 0; j < per; j++) for (const s of [1, -1]) {
    pts.push(at(cx, cy, base[j][0], k * 2 * half + s * base[j][1] - Math.PI / 2)); key.push(j);
  }
  pts.push([cx, cy]); key.push('c');
  const groups = cellGroups(pts, key, [cx - R - 4, cy - R - 4, cx + R + 4, cy + R + 4]);
  let defs = '', body = '';
  for (const [j, d] of groups) {
    const t = j === 'c' ? 0 : base[j][0] / R, v = (noise(t * 3.1, j === 'c' ? 0 : base[j][1] * 4) + 1) / 2;
    const c = vary(pick(t, v), noise(t * 7, 1.3) * 10, noise(1.7, t * 9) * 0.45);
    defs += rg(`${id}${j}`, [cx, cy, R * 1.05], [[0, c.brighten(1.3).hex()], [0.5, c.brighten(0.5).hex()], [1, c.darken(0.35).hex()]], true);
    body += path(d, { fill: `url(#${id}${j})`, stroke: LEAD, strokeWidth: R > 100 ? 2.6 : 2, strokeLinejoin: 'round' });
  }
  return { defs, body };
}

/** Mosaic glass for a row of lancets sharing one seed set, each mirrored about its own axis. */
function lancetGlass(id, lancets, per, seed) {
  const rnd = rng(seed), noise = createNoise2D(rng(seed + 1)), [{ w, y0, y1 }] = lancets, base = [];
  for (let i = 0; i < per; i++) base.push([w * 0.02 + rnd() * w * 0.46, y0 + ((i + rnd()) / per) * (y1 - y0)]);
  const pts = [], key = [];
  for (const { x } of lancets) for (let j = 0; j < per; j++) for (const s of [1, -1]) { pts.push([x + w / 2 + s * base[j][0], base[j][1]]); key.push(j); }
  const xs = lancets.map((l) => l.x);
  const groups = cellGroups(pts, key, [Math.min(...xs) - 2, y0 - 2, Math.max(...xs) + w + 2, y1 + 2]);
  let defs = '', body = '';
  for (const [j, d] of groups) {
    const [dx, y] = base[j], t = (y - y0) / (y1 - y0), v = (noise(t * 5, dx * 0.05) + 1) / 2;
    const name = dx > w * 0.36 ? (v < 0.55 ? 'ruby' : 'gold') : v < 0.5 ? 'blue' : v < 0.68 ? 'deep' : v < 0.84 ? 'vio' : 'eme';
    const c = vary(name, noise(t * 9, 2) * 10, noise(3, t * 11) * 0.4);
    defs += lg(`${id}${j}`, [0, 0, 0, 1], [[0, c.brighten(0.9).hex()], [0.5, c.hex()], [1, c.darken(0.7).hex()]]);
    body += path(d, { fill: `url(#${id}${j})`, stroke: LEAD, strokeWidth: 2.4, strokeLinejoin: 'round' });
  }
  return { defs, body };
}

/** Stone tracery drawn as a moulded stroke: a dark shadow, the stone, a lit edge. */
function tracery(d, w) {
  return path(d, { fill: 'none', stroke: '#000', strokeOpacity: 0.5, strokeWidth: w + 3, strokeLinecap: 'round', transform: 'translate(2 3)' })
    + path(d, { fill: 'none', stroke: STONE_D, strokeWidth: w + 3, strokeLinecap: 'round', strokeLinejoin: 'round' })
    + path(d, { fill: 'none', stroke: 'url(#rwTrac)', strokeWidth: w, strokeLinecap: 'round', strokeLinejoin: 'round' })
    + path(d, { fill: 'none', stroke: '#ffd9a8', strokeOpacity: 0.3, strokeWidth: 1.2, transform: 'translate(-1 -1)' });
}

/** The great rose: glass mosaic, twelve-fold tracery, a moulded rim with billets, bloom over the glass. */
function rose(glass) {
  const { x: cx, y: cy, r: R } = ROSE;
  const sp = (Math.PI * 2) / 12, o = -Math.PI / 2;
  let thick = circle(cx, cy, 70) + circle(cx, cy, R - 4), thin = '';
  for (let k = 0; k < 12; k++) {
    const a = o + k * sp, m = a + sp / 2;
    thick += `M${P(...at(cx, cy, 70, a))}L${P(...at(cx, cy, R - 62, a))}`;
    // a pointed head spanning the sector between two spokes
    thick += `M${P(...at(cx, cy, R - 62, a))}Q${P(...at(cx, cy, R - 30, a + sp * 0.12))} ${P(...at(cx, cy, R - 22, m))}Q${P(...at(cx, cy, R - 30, a + sp * 0.88))} ${P(...at(cx, cy, R - 62, a + sp))}`;
    // a foiled roundel in each sector and a small roundel in each spandrel between heads
    const [sx, sy] = at(cx, cy, R * 0.52, m), sr = R * 0.52 * Math.sin(sp / 2) - 10;
    thin += circle(sx, sy, sr);
    for (let i = 0; i < 3; i++) thin += circle(...at(sx, sy, sr * 0.42, m + (i * Math.PI * 2) / 3), sr * 0.4);
    thin += circle(...at(cx, cy, R - 24, a), 13);
    // pointed sub-arch inside each head
    thin += `M${P(...at(cx, cy, R * 0.72, a + sp * 0.18))}L${P(...at(cx, cy, R - 70, a + sp * 0.2))}Q${P(...at(cx, cy, R - 46, a + sp * 0.3))} ${P(...at(cx, cy, R - 40, m))}Q${P(...at(cx, cy, R - 46, a + sp * 0.7))} ${P(...at(cx, cy, R - 70, a + sp * 0.8))}L${P(...at(cx, cy, R * 0.72, a + sp * 0.82))}`;
  }
  for (let i = 0; i < 6; i++) thin += circle(...at(cx, cy, 38, o + (i * Math.PI) / 3), 24);
  let rays = '';
  for (let i = 0; i < 24; i++) {
    const a = ((i + 0.5) * Math.PI) / 12, w = 0.03;
    rays += poly([at(cx, cy, R + 50, a - w), at(cx, cy, R + 520, a - w * 0.5), at(cx, cy, R + 520, a + w * 0.5), at(cx, cy, R + 50, a + w)]);
  }
  return g({},
    path(circle(cx, cy, R + 260), { fill: 'url(#rwHalo)' }),
    g({ clipPath: 'url(#rwTymp)' }, path(rays, { fill: 'url(#rwRays)' })),
    path(circle(cx + 6, cy + 10, R + 50), { fill: '#000', fillOpacity: 0.4 }),
    path(circle(cx, cy, R + 50), { fill: 'url(#rwStoneR)', stroke: STONE_D, strokeWidth: 2 }),
    path(circle(cx, cy, R + 26), { fill: 'none', stroke: 'url(#rwTrac)', strokeWidth: 12, strokeDasharray: '10 8' }),
    path(circle(cx, cy, R + 34) + circle(cx, cy, R + 18), { fill: 'none', stroke: STONE_D, strokeOpacity: 0.7, strokeWidth: 2 }),
    path(circle(cx, cy, R + 6), { fill: LEAD }),
    g({ clipPath: 'url(#rwRoseClip)' }, glass, path(circle(cx, cy, R), { fill: 'url(#rwSeedy)' }), path(circle(cx, cy, R), { fill: 'url(#rwBloom)' })),
    tracery(thick, 8), tracery(thin, 4.5),
    path(circle(cx, cy, R + 50), { fill: 'none', stroke: '#ffcf90', strokeOpacity: 0.25, strokeWidth: 2 }));
}

/** A small six-fold rose in a moulded roundel. */
function smallRose(cx, cy, r, glass) {
  let tr = circle(cx, cy, 13);
  for (let k = 0; k < 6; k++) { const a = -Math.PI / 2 + (k * Math.PI) / 3; tr += `M${P(...at(cx, cy, 13, a))}L${P(...at(cx, cy, r - 2, a))}`; }
  return path(circle(cx + 4, cy + 7, r + 16), { fill: '#000', fillOpacity: 0.4 })
    + path(circle(cx, cy, r + 16), { fill: 'url(#rwStoneR)', stroke: STONE_D, strokeWidth: 2 })
    + path(circle(cx, cy, r + 3), { fill: LEAD })
    + glass
    + tracery(tr + circle(cx, cy, r), 5);
}

/** Crocket: a curled leaf knob pointing along +y. */
function crocket(s) {
  const d = `M${n(-s * 0.35)} 0C${P(-s * 0.6, s * 0.5, -s * 0.2, s * 1.1, s * 0.25, s * 0.9)}C${P(s * 0.6, s * 0.75, s * 0.4, s * 0.35, s * 0.1, s * 0.45)}C${P(s * 0.3, s * 0.2, s * 0.3, 0, s * 0.3, 0)}Z`;
  return path(d, { fill: 'url(#rwStoneL)', stroke: STONE_D, strokeWidth: 1.4 })
    + path(`M${P(-s * 0.1, s * 0.15)}Q${P(-s * 0.15, s * 0.6, s * 0.2, s * 0.75)}`, { fill: 'none', stroke: '#ffd9a8', strokeOpacity: 0.3, strokeWidth: 1.2 });
}

/** Leafy finial standing at (x, y). */
function finial(x, y, s) {
  const leaf = (rot) => g({ transform: `${tf(x, y - s * 0.9)} rotate(${rot})` }, path(`M0 0C${P(s * 0.3, -s * 0.2, s * 0.6, -s * 0.1, s * 0.75, s * 0.25)}C${P(s * 0.45, s * 0.15, s * 0.25, s * 0.2, 0, s * 0.18)}Z`, { fill: 'url(#rwStoneL)', stroke: STONE_D, strokeWidth: 1.4 }));
  return path(rr(x - s * 0.12, y - s * 0.95, s * 0.24, s * 0.95, 3), { fill: 'url(#rwStoneV)', stroke: STONE_D, strokeWidth: 1.4 })
    + leaf(-10) + g({ transform: `translate(${2 * x} 0) scale(-1 1)` }, leaf(-10))
    + leaf(-60) + g({ transform: `translate(${2 * x} 0) scale(-1 1)` }, leaf(-60))
    + path(ellipse(x, y - s * 1.3, s * 0.16, s * 0.28), { fill: 'url(#rwStoneL)', stroke: STONE_D, strokeWidth: 1.4 });
}

/** Pinnacle: shaft with a glowing slit light, a gable, a crocketed spire and a finial. */
function pinnacle(x, base, w, h) {
  const shaftTop = base - h * 0.42, tip = base - h;
  let crk = '';
  for (let i = 1; i <= 4; i++) {
    const t = i / 5, y = shaftTop - (shaftTop - tip) * t, hw = (w / 2) * (1 - t) + 3;
    crk += g({ transform: `${tf(x - hw, y)} rotate(70)` }, crocket(15)) + g({ transform: `${tf(x + hw, y)} rotate(-70) scale(-1 1)` }, crocket(15));
  }
  return g({},
    path(rr(x - w / 2 + 6, shaftTop + 8, w, base - shaftTop, 0), { fill: '#000', fillOpacity: 0.3 }),
    path(rr(x - w / 2, shaftTop, w, base - shaftTop, 0), { fill: 'url(#rwStoneV)', stroke: STONE_D, strokeWidth: 1.6 }),
    path(lancet(x - w * 0.16, shaftTop + 26, w * 0.32, base - 14), { fill: 'url(#rwSlit)', stroke: STONE_D, strokeWidth: 2 }),
    path(poly([[x - w / 2 - 6, shaftTop], [x, shaftTop - w * 0.55], [x + w / 2 + 6, shaftTop]]), { fill: 'url(#rwStoneL)', stroke: STONE_D, strokeWidth: 1.6 }),
    path(poly([[x - w / 2 + 6, shaftTop], [x, tip], [x + w / 2 - 6, shaftTop]]), { fill: 'url(#rwStoneV)', stroke: STONE_D, strokeWidth: 1.6 }),
    crk,
    finial(x, tip + 4, 34));
}

/** Coloured shaft of light from (x0, y0) toward (x1, y1), widening. */
function shaft(x0, y0, x1, y1, w0, w1, id) {
  const dx = x1 - x0, dy = y1 - y0, l = Math.hypot(dx, dy), nx = -dy / l, ny = dx / l;
  return path(poly([[x0 + nx * w0, y0 + ny * w0], [x1 + nx * w1, y1 + ny * w1], [x1 - nx * w1, y1 - ny * w1], [x0 - nx * w0, y0 - ny * w0]]), { fill: `url(#${id})` });
}

function draw() {
  const holeD = rr(hole.x, hole.y, hole.w, hole.h, radius);
  const rnd = rng(8);
  let speck = '';
  for (let i = 0; i < 50; i++) speck += `M${P(rnd() * 90, rnd() * 90)}h${n(1 + rnd() * 2)}v${n(1 + rnd())}h${n(-1 - rnd() * 2)}Z`;

  const pickRose = (t, v) => {
    if (t < 0.3) return v < 0.5 ? 'gold' : v < 0.8 ? 'ruby' : 'eme';
    if (t < 0.66) return v < 0.5 ? 'blue' : v < 0.64 ? 'sky' : v < 0.86 ? 'ruby' : 'vio';
    return v < 0.42 ? 'blue' : v < 0.64 ? 'ruby' : v < 0.78 ? 'deep' : v < 0.9 ? 'gold' : 'eme';
  };
  const big = roseGlass('gR', ROSE.x, ROSE.y, ROSE.r, 12, 21, 21, pickRose);
  const sL = roseGlass('gS', 520, 760, 46, 6, 4, 5, (t, v) => (t < 0.4 ? 'gold' : v < 0.6 ? 'ruby' : 'blue'));
  const sR = roseGlass('gT', 1280, 760, 46, 6, 4, 5, (t, v) => (t < 0.4 ? 'gold' : v < 0.6 ? 'ruby' : 'blue'));
  const LW = 100, LY0 = 760, LY1 = 1380;
  const lan = [{ x: 154, w: LW, y0: LY0, y1: LY1 }, { x: W - 154 - LW, w: LW, y0: LY0, y1: LY1 }];
  const lg1 = lancetGlass('gL', lan, 30, 33);

  const defs = [
    big.defs, sL.defs, sR.defs, lg1.defs,
    lg('rwStone', [0, 0, 1, 1], [[0, '#6e6a7a'], [0.5, '#45414f'], [1, '#26232d']]),
    lg('rwStoneV', [0, 0, 1, 0], [[0, '#7c7889'], [0.5, '#4c4857'], [1, '#22202a']]),
    lg('rwStoneL', [0, 0, 1, 1], [[0, '#908ca0'], [0.6, '#575365'], [1, '#2a2732']]),
    rg('rwStoneR', [0.42, 0.38, 0.7], [[0, '#7e7a8e'], [0.8, '#4a4656'], [1, '#26232c']]),
    lg('rwTrac', [0, 0, 1, 1], [[0, '#a29cae'], [0.5, '#6a6478'], [1, '#3e3a48']]),
    lg('rwPanel', [0, 0, 0, 1], [[0, '#34313c'], [1, '#24222a']]),
    lg('rwTympanum', [0, 0, 0, 1], [[0, '#1c1a22'], [1, '#0e0d12']]),
    rg('rwHalo', [0.5, 0.5, 0.5], [[0.45, '#ffc070', 0.38], [0.7, '#c05080', 0.12], [1, '#4060c0', 0]]),
    rg('rwBloom', [0.5, 0.5, 0.5], [[0, '#fff6e0', 0.45], [0.3, '#fff0d0', 0.12], [0.7, '#fff', 0], [1, '#000', 0.25]]),
    rg('rwRays', [ROSE.x, ROSE.y, ROSE.r + 560], [[0.4, '#ffd8a0', 0.22], [1, '#ffd8a0', 0]], true),
    lg('rwBeamA', [0, 0, 0, 1], [[0, '#ffd890', 0.3], [1, '#ffd890', 0]]),
    lg('rwBeamR', [0, 0, 0, 1], [[0, '#ff3a5a', 0.26], [1, '#ff3a5a', 0]]),
    lg('rwBeamB', [0, 0, 0, 1], [[0, '#4a7aff', 0.28], [1, '#4a7aff', 0]]),
    lg('rwMoon', [0, 0, 1, 1], [[0, '#c8d8ff', 0.16], [1, '#c8d8ff', 0]]),
    lg('rwSlit', [0, 0, 0, 1], [[0, '#ffd890'], [0.5, '#e07a30'], [1, '#6a2a10']]),
    rg('rwPoolR', [0.5, 0.5, 0.5], [[0, '#ff4a6a', 0.35], [1, '#ff4a6a', 0]]),
    rg('rwPoolB', [0.5, 0.5, 0.5], [[0, '#4a80ff', 0.35], [1, '#4a80ff', 0]]),
    rg('rwPoolA', [0.5, 0.5, 0.5], [[0, '#ffc060', 0.3], [1, '#ffc060', 0]]),
    `<pattern id="rwSpeck" width="90" height="90" patternUnits="userSpaceOnUse"><path d="${speck}" fill="#000" fill-opacity="0.25"/></pattern>`,
    '<pattern id="rwAshlar" width="120" height="64" patternUnits="userSpaceOnUse"><path d="M0 0.5H120M0 32.5H120M0.5 0V32M60.5 32V64" fill="none" stroke="#0e0c12" stroke-opacity="0.6" stroke-width="1.5"/><path d="M0 2H120M0 34H120" stroke="#b8b4d0" stroke-opacity="0.12" stroke-width="1.5"/></pattern>',
    '<pattern id="rwSeedy" width="60" height="40" patternUnits="userSpaceOnUse" patternTransform="rotate(-20)"><path d="M0 10Q15 6 30 10T60 10M0 28Q15 32 30 28T60 28" fill="none" stroke="#fff" stroke-opacity="0.07" stroke-width="2"/></pattern>',
    `<clipPath id="rwRoseClip"><path d="${circle(ROSE.x, ROSE.y, ROSE.r + 2)}"/></clipPath>`,
    `<clipPath id="rwSmallClip"><path d="${circle(520, 760, 47)}${circle(1280, 760, 47)}"/></clipPath>`,
    `<clipPath id="rwLanClip"><path d="${lan.map((l) => lancet(l.x, l.y0, l.w, l.y1)).join('')}"/></clipPath>`,
    `<clipPath id="rwTymp"><path d="${arch(92)}"/></clipPath>`,
    `<clipPath id="rwFacade"><path d="${arch(0)}"/><path d="${rr(104, 650, 200, BASE - 650, 0)}${rr(W - 304, 650, 200, BASE - 650, 0)}${rr(70, BASE, W - 140, H - BASE - 20, 0)}"/></clipPath>`,
  ].join('');

  const wingL = { x: 104, w: 200 }, wingR = { x: W - 104 - 200, w: 200 };
  const crockets = archPoints(-2, 74).map(([x, y, deg]) => g({ transform: `${tf(x, y)} rotate(${n(deg + 90)})` }, crocket(32))
    + g({ transform: `${tf(2 * CX - x, y)} scale(-1 1) rotate(${n(deg + 90)})` }, crocket(32))).join('');
  // ferramenta: the iron bars across the lancets
  let bars = '';
  for (const l of lan) for (let y = LY0 + 150; y < LY1 - 30; y += 124) bars += `M${l.x} ${y}H${l.x + l.w}`;
  // blind arcade along the plinth
  let arcade = '';
  for (let i = 0; i < 12; i++) { const x = 300 + i * 100; arcade += lancet(x + 14, BASE + 26, 72, H - 46); }

  const body = [
    // wall shadow
    path(arch(-30, BASE + 150), { fill: '#000', fillOpacity: 0.2, transform: 'translate(10 18)' }),
    // side wings in ashlar with their mosaic lancets and pinnacles
    ...[wingL, wingR].map((wg) => g({},
      path(rr(wg.x + 8, 660, wg.w, BASE - 650, 0), { fill: '#000', fillOpacity: 0.3 }),
      path(rr(wg.x, 650, wg.w, BASE - 650, 0), { fill: 'url(#rwStoneV)', stroke: STONE_D, strokeWidth: 2 }),
      path(rr(wg.x, 650, wg.w, BASE - 650, 0), { fill: 'url(#rwAshlar)' }),
      path(rr(wg.x - 10, 638, wg.w + 20, 22, 0), { fill: 'url(#rwStoneL)', stroke: STONE_D, strokeWidth: 1.6 }),
      path(lancet(wg.x + 36, LY0 - 14, LW + 28, LY1 + 10), { fill: 'url(#rwStoneV)', stroke: STONE_D, strokeWidth: 1.6 }),
      path(lancet(wg.x + 44, LY0 - 6, LW + 12, LY1 + 4), { fill: LEAD }),
      pinnacle(wg.x + wg.w / 2, 640, 96, 420))),
    g({ clipPath: 'url(#rwLanClip)' }, lg1.body, path(rr(0, LY0, W, LY1 - LY0, 0), { fill: 'url(#rwSeedy)' })),
    path(bars, { stroke: LEAD, strokeWidth: 6 }),
    path(lan.map((l) => lancet(l.x, l.y0, l.w, l.y1)).join(''), { fill: 'none', stroke: LEAD, strokeWidth: 4 }),
    // the central arch: stepped archivolts from the outer roll inward
    path(arch(0), { fill: 'url(#rwStone)', stroke: STONE_D, strokeWidth: 2.5 }),
    path(arch(0), { fill: 'url(#rwSpeck)' }),
    path(arch(14), { fill: '#24212a' }),
    path(arch(20), { fill: 'url(#rwStoneL)' }),
    path(arch(40), { fill: '#1e1c24' }),
    path(arch(46), { fill: 'url(#rwStone)' }),
    path(arch(64), { fill: '#1a1820' }),
    path(arch(70), { fill: 'url(#rwStoneL)' }),
    path(arch(86), { fill: STONE_D }),
    path(arch(92), { fill: 'url(#rwTympanum)' }),
    // shafts of coloured light falling from the rose toward the sill
    g({ clipPath: 'url(#rwFacade)' },
      shaft(ROSE.x - 150, ROSE.y + 150, 470, 900, 34, 90, 'rwBeamR'), shaft(ROSE.x + 150, ROSE.y + 150, 1330, 900, 34, 90, 'rwBeamB'),
      shaft(ROSE.x, ROSE.y + 200, ROSE.x, 860, 50, 120, 'rwBeamA')),
    rose(big.body),
    smallRose(520, 760, 46, g({ clipPath: 'url(#rwSmallClip)' }, sL.body)),
    smallRose(1280, 760, 46, g({ clipPath: 'url(#rwSmallClip)' }, sR.body)),
    crockets,
    finial(CX, apexY(0) + 6, 64),
    // calm panel of dark dressed stone round the picture, with a plain rebate
    path(rr(ARCH_L + 92, 830, ARCH_R - ARCH_L - 184, BASE - 830, 0), { fill: 'url(#rwPanel)' }),
    path(rr(ARCH_L + 92, 830, ARCH_R - ARCH_L - 184, BASE - 830, 0), { fill: 'url(#rwSpeck)' }),
    path(`M${ARCH_L + 92} 831H${ARCH_R - 92}`, { stroke: '#ffd9a8', strokeOpacity: 0.3, strokeWidth: 2 }),
    path(rr(hole.x - 30, hole.y - 30, hole.w + 60, hole.h + 60, 0), { fill: 'url(#rwStoneL)', stroke: STONE_D, strokeWidth: 1.5 }),
    path(rr(hole.x - 14, hole.y - 14, hole.w + 28, hole.h + 28, 0), { fill: '#2a2731', stroke: STONE_D, strokeWidth: 1.2 }),
    path(rr(hole.x - 8, hole.y - 8, hole.w + 16, hole.h + 16, 0), { fill: '#0e0d12' }),
    L.lip(holeD, '#000', [[6, 0.3], [3, 0.5]]),
    // plinth with a blind arcade
    path(rr(70, BASE, W - 140, H - BASE - 20, 0), { fill: 'url(#rwStone)', stroke: STONE_D, strokeWidth: 2 }),
    path(rr(70, BASE, W - 140, H - BASE - 20, 0), { fill: 'url(#rwAshlar)' }),
    path(arcade, { fill: '#1a1820', stroke: 'url(#rwTrac)', strokeWidth: 4 }),
    path(rr(56, BASE - 6, W - 112, 20, 0), { fill: 'url(#rwStoneL)', stroke: STONE_D, strokeWidth: 1.6 }),
    // pools of coloured light on the sill
    path(ellipse(470, BASE + 4, 150, 16), { fill: 'url(#rwPoolR)' }), path(ellipse(1330, BASE + 4, 150, 16), { fill: 'url(#rwPoolB)' }),
    path(ellipse(CX, BASE + 4, 320, 14), { fill: 'url(#rwPoolA)' }),
    // cool moonlight raking from the upper left
    g({ clipPath: 'url(#rwFacade)' }, shaft(40, 20, 700, 1500, 50, 200, 'rwMoon')),
  ].join('\n');
  return { defs, body };
}

module.exports = {
  W, H, hole, radius, draw,
  meta: {
    name: 'Rose Window', theme: 'gothic cathedral', rarity: 'legendary', translucent: false, collection: 'atelier-noir', license: 'CC-BY-4.0',
    desc: 'A moonlit gothic arch around a great rose window whose mosaic of cobalt, ruby and gold glass burns from within, casting coloured light down the stone.',
    tags: ['gothic', 'stained glass', 'stone', 'cathedral', 'jewel tones', 'night', 'architecture'],
  },
};
