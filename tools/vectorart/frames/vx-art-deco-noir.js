'use strict';
// Deco Noir: a 1920s Art Deco cabinet in black lacquer and brushed gold. A stepped ziggurat crown holds a
// gold sunburst behind a gold-leaf skyline of setback towers with an emerald moon; fluted lacquer pilasters
// with stepped capitals and spire finials stand at the sides; chevron friezes run along the top and bottom
// rails and quarter-sun fans fill the field corners. Around the picture: a stepped, notch-cornered gold
// molding and a calm band of plain lacquer, so the busy work stays at the edges.
const L = require('../lib');
const { rr, path, g, lg, rg, circle, ellipse, poly, tf, n, P } = L;

const W = 1760, H = 1450;
const hole = { x: 368, y: 566, w: 1024, h: 576 }, radius = 0;
const CX = W / 2, CY = hole.y + hole.h / 2;
const B = { x: 112, y: 396, w: 1536, h: 916 }; // the lacquer cabinet body
const INK = '#120d04';
const BASE_Y = B.y + 2; // where the crown and skyline stand

/** Rectangle whose four corners are cut by a staircase of k steps of size s (Deco notch). */
function stepRect(x, y, w, h, s, k) {
  const tl = [];
  for (let i = 0; i < k; i++) tl.push([i * s, (k - i) * s], [(i + 1) * s, (k - i) * s]);
  tl.push([k * s, 0]);
  const tr = tl.map(([a, b]) => [w - a, b]).reverse();
  const br = tl.map(([a, b]) => [w - a, h - b]);
  const bl = tl.map(([a, b]) => [a, h - b]).reverse();
  return poly([...tl, ...tr, ...br, ...bl].map(([a, b]) => [x + a, y + b]));
}
/** Hole rectangle grown by e on every side. */
const grow = (e) => [hole.x - e, hole.y - e, hole.w + 2 * e, hole.h + 2 * e];

/** Fan of k gold rays (sunburst) from (0,0) between angles a0..a1 (deg), radius r0..r1, in local coordinates. */
function fan(r0, r1, a0, a1, k, width = 0.45) {
  let d = '';
  for (let i = 0; i <= k; i++) {
    const a = ((a0 + ((a1 - a0) * i) / k) * Math.PI) / 180, w = (width * Math.PI) / 180 * (i % 2 ? 0.6 : 1);
    const p = (r, t) => [r * Math.cos(t), r * Math.sin(t)];
    d += poly([p(r0, a - w * 0.4), p(r1, a - w), p(r1, a + w), p(r0, a + w * 0.4)]);
  }
  return d;
}

/** Quarter-sun fan ornament: concentric arcs and rays, pointing toward -x -y from its origin. */
function quarterFan(R) {
  const arcs = [R, R * 0.78, R * 0.4].map((r) => `M${P(-r, 0)}A${P(r, r)} 0 0 1 ${P(0, -r)}`).join('');
  return path(`M0 0L${P(-R, 0)}A${P(R, R)} 0 0 1 ${P(0, -R)}Z`, { fill: '#0c0c0f' })
    + path(fan(R * 0.42, R * 0.76, 180, 270, 8, 3.2), { fill: 'url(#dnGoldD)' })
    + path(arcs, { fill: 'none', stroke: 'url(#dnGoldD)', strokeWidth: 3 })
    + path(`M0 0L${P(-R * 0.4, 0)}A${P(R * 0.4, R * 0.4)} 0 0 1 ${P(0, -R * 0.4)}Z`, { fill: 'url(#dnGoldD)', stroke: INK, strokeWidth: 1.2 })
    + path(circle(-R * 0.17, -R * 0.17, R * 0.1), { fill: 'url(#dnEmerald)', stroke: INK, strokeWidth: 1.2 });
}

/** Emerald baguette (step cut) centred on (0,0), long along x. */
function baguette(w, h) {
  const i = Math.min(w, h) * 0.26;
  return path(rr(-w / 2 - 4, -h / 2 - 4, w + 8, h + 8, 2), { fill: 'url(#dnGoldV)', stroke: INK, strokeWidth: 1.5 })
    + path(rr(-w / 2, -h / 2, w, h, 0), { fill: 'url(#dnEmeraldL)', stroke: '#03261a', strokeWidth: 1.2 })
    + path(rr(-w / 2 + i, -h / 2 + i, w - 2 * i, h - 2 * i, 0), { fill: '#3ee09a', fillOpacity: 0.35, stroke: '#b8ffe0', strokeOpacity: 0.55, strokeWidth: 1 })
    + path(`M${P(-w / 2, -h / 2)}L${P(-w / 2 + i, -h / 2 + i)}M${P(w / 2, -h / 2)}L${P(w / 2 - i, -h / 2 + i)}M${P(w / 2, h / 2)}L${P(w / 2 - i, h / 2 - i)}M${P(-w / 2, h / 2)}L${P(-w / 2 + i, h / 2 - i)}`, { stroke: '#b8ffe0', strokeOpacity: 0.4, strokeWidth: 1 });
}

/** Round emerald cabochon in a stepped gold bezel. */
function cabochon(x, y, r) {
  return path(circle(x + 2, y + 3, r + 7), { fill: '#000', fillOpacity: 0.3 })
    + path(circle(x, y, r + 7), { fill: 'url(#dnGoldD)', stroke: INK, strokeWidth: 1.5 })
    + path(circle(x, y, r + 3), { fill: 'none', stroke: INK, strokeOpacity: 0.5, strokeWidth: 1.2 })
    + path(circle(x, y, r), { fill: 'url(#dnEmerald)', stroke: '#03261a', strokeWidth: 1.5 })
    + path(ellipse(x - r * 0.32, y - r * 0.38, r * 0.34, r * 0.2), { fill: '#e8fff4', fillOpacity: 0.75, transform: `rotate(-30 ${n(x - r * 0.32)} ${n(y - r * 0.38)})` });
}

/** The stepped ziggurat crown: lacquer tiers edged in gold, sunburst inside, skyline in front. */
const TIERS = [[900, 70], [720, 70], [540, 66], [360, 62]]; // [width, height] bottom to top
function crown() {
  let y = BASE_Y, outline = [];
  const right = [];
  for (const [w, h] of TIERS) { right.push([CX + w / 2, y], [CX + w / 2, y - h]); y -= h; }
  const top = y;
  outline = [...right, ...right.map(([x, yy]) => [2 * CX - x, yy]).reverse()];
  const zig = poly(outline);
  // gold edge strips on each tier
  let edges = '';
  y = BASE_Y;
  for (const [w, h] of TIERS) { edges += path(rr(CX - w / 2 - 8, y - h - 8, w + 16, 12, 0), { fill: 'url(#dnGoldV)', stroke: INK, strokeWidth: 1.2 }); y -= h; }
  const rays = g({ clipPath: 'url(#dnZigClip)' },
    path(zig, { fill: 'url(#dnLacquerV)' }),
    path(circle(CX, BASE_Y, 300), { fill: 'url(#dnHalo)' }),
    g({ transform: tf(CX, BASE_Y) }, path(fan(70, 560, 180, 360, 44, 0.8), { fill: 'url(#dnRay)' })),
    // concentric gold arcs of the rising sun
    [150, 214, 292].map((r, i) => path(`M${P(CX - r, BASE_Y)}A${P(r, r)} 0 0 1 ${P(CX + r, BASE_Y)}`, { fill: 'none', stroke: 'url(#dnGoldD)', strokeWidth: 4 - i, strokeOpacity: 0.85 - i * 0.15 })).join(''),
    path(`M${CX - 300} ${BASE_Y - 2}H${CX + 300}`, { stroke: '#000', strokeOpacity: 0.3, strokeWidth: 6 }));
  return g({},
    path(zig, { fill: '#000', fillOpacity: 0.35, transform: 'translate(6 8)' }),
    path(zig, { fill: '#0a0a0c', stroke: 'url(#dnGoldD)', strokeWidth: 10, strokeLinejoin: 'miter' }),
    rays,
    path(zig, { fill: 'none', stroke: INK, strokeWidth: 1.5 }),
    edges,
    // stepped finial on the top tier: a small emerald moon above the tallest spire
    path(stepRect(CX - 70, top - 34, 140, 40, 10, 2), { fill: 'url(#dnGoldV)', stroke: INK, strokeWidth: 1.5 }),
    path(rr(CX - 46, top - 26, 92, 6, 0) + rr(CX - 46, top - 16, 92, 6, 0), { fill: INK, fillOpacity: 0.55 }),
    cabochon(CX, top - 74, 26));
}

/** Gold-leaf skyline of setback towers, mirrored about the centre, standing on the cabinet's top edge. */
const TOWERS = [ // [offset from centre, base width, height, setbacks, spire height]
  [0, 84, 214, 4, 44], [84, 62, 172, 3, 30], [-84, 62, 172, 3, 30], [150, 56, 128, 2, 0], [-150, 56, 128, 2, 0],
  [210, 58, 96, 2, 16], [-210, 58, 96, 2, 16], [264, 46, 64, 1, 0], [-264, 46, 64, 1, 0],
];
function skyline() {
  let shapes = '', spires = '', lines = '';
  const order = TOWERS.slice().sort((a, b) => a[2] - b[2]);
  const out = [];
  for (const [dx, w, h, k, sp] of order) {
    const cx = CX + dx, base = BASE_Y, tierH = h / (k + 1);
    const right = [];
    for (let i = 0; i <= k; i++) { const ww = w / 2 - i * (w * 0.13); right.push([cx + ww, base - i * tierH], [cx + ww, base - (i + 1) * tierH]); }
    const pts = [...right, ...right.map(([x, y]) => [2 * cx - x, y]).reverse()];
    const top = base - h, topW = w / 2 - k * (w * 0.13);
    const d = poly(pts);
    shapes = d;
    if (sp) spires += poly([[cx - 4, top], [cx, top - sp], [cx + 4, top]]) + rr(cx - topW * 0.5, top - 10, topW, 10, 0);
    // vertical piers on the tallest blocks
    for (let j = -1; j <= 1; j += 2) lines += `M${n(cx + j * topW * 0.4)} ${n(top + 10)}V${n(base - 6)}`;
    out.push(path(d, { fill: '#000', fillOpacity: 0.35, transform: 'translate(5 0)' })
      + path(d, { fill: 'url(#dnLeaf)', stroke: INK, strokeWidth: 1.6, strokeLinejoin: 'miter' })
      + path(d, { fill: 'url(#dnLeafTex)' })
      + path(d, { fill: 'url(#dnWindows)' })
      + path(`M${n(cx + w / 2 - 2)} ${n(base)}V${n(base - tierH)}`, { stroke: '#000', strokeOpacity: 0.3, strokeWidth: 4 }));
  }
  void shapes;
  return g({}, ...out,
    path(lines, { stroke: INK, strokeOpacity: 0.5, strokeWidth: 1.4 }),
    path(spires, { fill: 'url(#dnGoldV)', stroke: INK, strokeWidth: 1.2 }));
}

/** A fluted lacquer pilaster centred on x with stepped capital, plinth and a spire finial. */
function pilaster(x) {
  const w = 132, y0 = B.y + 24, y1 = B.y + B.h - 42, base = B.y + B.h + 58;
  const flutes = [];
  for (let i = 0; i < 5; i++) {
    const fx = x - 44 + i * 22;
    flutes.push(path(rr(fx - 6, y0 + 26, 12, y1 - y0 - 52, 6), { fill: 'url(#dnFlute)', stroke: INK, strokeWidth: 1.2 }));
  }
  const capital = [[w + 40, 26], [w + 22, 22], [w + 6, 22], [w - 14, 18]];
  let caps = '', y = y0;
  for (const [cw, ch] of capital) { caps += path(rr(x - cw / 2, y - ch, cw, ch, 0), { fill: 'url(#dnGoldV)', stroke: INK, strokeWidth: 1.4 }); y -= ch; }
  // lacquer block above the capital with a gold half-sun, then the stepped spire
  const blockY = y - 70;
  const plinth = [[w + 44, 34], [w + 24, 22], [w + 8, 20]];
  let pl = '', py = base;
  for (const [cw, ch] of plinth) { pl += path(rr(x - cw / 2, py - ch, cw, ch, 0), { fill: 'url(#dnGoldV)', stroke: INK, strokeWidth: 1.4 }); py -= ch; }
  const spire = [[90, 26], [64, 26], [40, 30], [18, 34]];
  let sp = '', sy = blockY;
  for (const [sw, sh] of spire) { sp += path(rr(x - sw / 2, sy - sh, sw, sh, 0), { fill: sw > 50 ? '#0c0c0f' : 'url(#dnGoldV)', stroke: 'url(#dnGoldD)', strokeWidth: 3 }); sy -= sh; }
  sp += path(poly([[x - 6, sy], [x, sy - 46], [x + 6, sy]]), { fill: 'url(#dnGoldV)', stroke: INK, strokeWidth: 1.2 });
  return g({},
    path(rr(x - w / 2 + 8, blockY + 10, w, base - blockY, 0), { fill: '#000', fillOpacity: 0.35 }),
    sp,
    path(rr(x - w / 2, y0, w, y1 - y0, 0), { fill: 'url(#dnLacquerH)', stroke: 'url(#dnGoldD)', strokeWidth: 5 }),
    ...flutes,
    path(rr(x - w / 2 + 10, y0 + 10, w - 20, y1 - y0 - 20, 0), { fill: 'none', stroke: 'url(#dnGoldD)', strokeOpacity: 0.6, strokeWidth: 1.5 }),
    // capital, block with a sun, chevrons on the plinth
    caps,
    path(rr(x - w / 2 - 6, blockY, w + 12, 70, 0), { fill: '#0b0b0e', stroke: 'url(#dnGoldD)', strokeWidth: 4 }),
    g({ transform: tf(x, blockY + 62) }, path(fan(14, 48, 180, 360, 12, 3), { fill: 'url(#dnGoldD)' }),
      path(`M-14 0A14 14 0 0 1 14 0Z`, { fill: 'url(#dnGoldD)', stroke: INK })),
    path(rr(x - w / 2 - 4, y1, w + 8, 26, 0), { fill: 'url(#dnGoldV)', stroke: INK, strokeWidth: 1.4 }),
    path(rr(x - w / 2 + 8, y1 + 26, w - 16, py - y1 - 26, 0), { fill: '#0b0b0e', stroke: 'url(#dnGoldD)', strokeWidth: 3 }),
    path([0, 1, 2].map((i) => `M${n(x - 40)} ${n(y1 + 40 + i * 12)}L${n(x)} ${n(y1 + 52 + i * 12)}L${n(x + 40)} ${n(y1 + 40 + i * 12)}`).join(''), { fill: 'none', stroke: 'url(#dnGoldD)', strokeWidth: 3 }),
    pl,
    g({ transform: tf(x, (y0 + y1) / 2) }, baguette(26, 64)));
}

/** Bottom apron: an inverted stepped plinth with a falling sunburst and an emerald. */
function apron() {
  const y = B.y + B.h - 4;
  const steps = [[620, 30], [460, 28], [300, 26]];
  let d = '', yy = y;
  const body = [];
  for (const [w, h] of steps) { body.push(path(rr(CX - w / 2 + 6, yy + 8, w, h, 0), { fill: '#000', fillOpacity: 0.3 })); body.push(path(rr(CX - w / 2, yy, w, h, 0), { fill: '#0b0b0e', stroke: 'url(#dnGoldD)', strokeWidth: 4 })); yy += h; }
  d = g({ transform: tf(CX, y) }, path(fan(30, 80, 20, 160, 14, 2.6), { fill: 'url(#dnGoldD)', fillOpacity: 0.9 }));
  return g({}, ...body, d, cabochon(CX, y + 36, 16));
}

/** Chevron frieze tile (period 36, height 40) for the top and bottom rails. */
function chevronTile() {
  const z = (o, amp) => `M${-36} ${o}L-18 ${o + amp}L0 ${o}L18 ${o + amp}L36 ${o}L54 ${o + amp}`;
  return path(z(8, 12) + z(20, 12), { fill: 'none', stroke: 'url(#dnGoldT)', strokeWidth: 3.2, strokeLinejoin: 'miter' })
    + path(z(30, 6), { fill: 'none', stroke: 'url(#dnGoldT)', strokeOpacity: 0.55, strokeWidth: 1.6 });
}

/** Stacked vertical chevrons for the side fields between the pilaster and the molding. */
function sideFrieze(x, y0, y1) {
  let d = '';
  for (let y = y0; y <= y1; y += 26) d += `M${n(x - 14)} ${n(y)}L${n(x)} ${n(y + 12)}L${n(x + 14)} ${n(y)}`;
  return path(`M${n(x - 22)} ${n(y0 - 10)}V${n(y1 + 20)}M${n(x + 22)} ${n(y0 - 10)}V${n(y1 + 20)}`, { stroke: 'url(#dnGoldT)', strokeWidth: 1.6 }) + path(d, { fill: 'none', stroke: 'url(#dnGoldD)', strokeWidth: 3.4, strokeOpacity: 0.9 });
}

function draw() {
  const holeD = rr(hole.x, hole.y, hole.w, hole.h, radius);
  const defs = [
    lg('dnGoldV', [0, 0, 0, 1], [[0, '#fbedbd'], [0.16, '#d9b35c'], [0.3, '#f2d88e'], [0.48, '#b48838'], [0.66, '#e6c675'], [0.84, '#94692a'], [1, '#5c4112']]),
    lg('dnGoldD', [0, 0, 1, 1], [[0, '#f7e3a2'], [0.35, '#d0a84e'], [0.6, '#f0d48a'], [1, '#8a6224']]),
    lg('dnGoldT', [0, 0, 1, 0], [[0, '#b48838'], [0.5, '#f2d88e'], [1, '#b48838']]),
    lg('dnLeaf', [0, 0, 0, 1], [[0, '#f9e7a8'], [0.5, '#dcb862'], [1, '#a37a2e']]),
    lg('dnRay', [0, 0, 0, 1], [[0, '#e8c978', 0.95], [1, '#7a5820', 0.6]]),
    lg('dnFlute', [0, 0, 1, 0], [[0, '#4a3510'], [0.3, '#c99f48'], [0.55, '#fbe8b0'], [0.8, '#b48838'], [1, '#3a2808']]),
    lg('dnLacquerH', [0, 0, 1, 0], [[0, '#050506'], [0.35, '#1d1d24'], [0.5, '#2a2a33'], [0.65, '#14141a'], [1, '#040405']]),
    lg('dnLacquerV', [0, 0, 0, 1], [[0, '#1a1a20'], [1, '#050506']]),
    lg('dnBody', [0, 0, 1, 1], [[0, '#1c1c22'], [0.42, '#0b0b0e'], [0.5, '#16161c'], [0.58, '#09090b'], [1, '#040405']]),
    lg('dnMat', [0, 0, 0, 1], [[0, '#101014'], [1, '#060607']]),
    rg('dnEmerald', [0.38, 0.32, 0.75], [[0, '#c8ffe4'], [0.3, '#3fd492'], [0.7, '#0a7a4a'], [1, '#033a22']]),
    lg('dnEmeraldL', [0, 0, 1, 1], [[0, '#7ff0bb'], [0.45, '#13965c'], [1, '#04452a']]),
    rg('dnHalo', [0.5, 1, 0.9], [[0, '#f5d27a', 0.35], [0.5, '#f5d27a', 0.1], [1, '#f5d27a', 0]]),
    rg('dnWallGlow', [0.5, 0.4, 0.6], [[0, '#d9b45a', 0.16], [1, '#d9b45a', 0]]),
    `<clipPath id="dnZigClip"><path d="${(() => { let y = BASE_Y; const r = []; for (const [w, h] of TIERS) { r.push([CX + w / 2, y], [CX + w / 2, y - h]); y -= h; } return poly([...r, ...r.map(([x, yy]) => [2 * CX - x, yy]).reverse()]); })()}"/></clipPath>`,
    `<pattern id="dnChevH" x="${CX}" y="${B.y + 22}" width="36" height="40" patternUnits="userSpaceOnUse">${chevronTile()}</pattern>`,
    '<pattern id="dnWindows" width="7" height="13" patternUnits="userSpaceOnUse"><path d="M2.5 3h2v8h-2Z" fill="#2a1c06" fill-opacity="0.5"/></pattern>',
    '<pattern id="dnLeafTex" width="44" height="44" patternUnits="userSpaceOnUse"><path d="M0 0h22v22H0Z" fill="#fff6d0" fill-opacity="0.12"/><path d="M22 22h22v22H22Z" fill="#6a4a12" fill-opacity="0.12"/><path d="M0 0H44M0 22H44M0 0V44M22 0V44" stroke="#7a5820" stroke-opacity="0.25" stroke-width="0.8"/></pattern>',
    '<pattern id="dnBrush" width="400" height="7" patternUnits="userSpaceOnUse"><path d="M0 1.5H160M200 1.5H400M30 4.5H330" stroke="#fff" stroke-opacity="0.025" stroke-width="1"/></pattern>',
  ].join('');

  // field corners: where the molding's outer edge meets the cabinet's field
  const mo = grow(84);
  const fanAt = [[mo[0], mo[1], 1, 1], [mo[0] + mo[2], mo[1], -1, 1], [mo[0], mo[1] + mo[3], 1, -1], [mo[0] + mo[2], mo[1] + mo[3], -1, -1]];
  const topBand = { y: B.y + 22, h: 40 }, botBand = { y: B.y + B.h - 62, h: 40 };

  const body = [
    path(ellipse(CX, CY - 120, 900, 640), { fill: 'url(#dnWallGlow)' }),
    // wall shadow
    [[16, 0.08], [9, 0.12], [4, 0.18]].map(([e, a]) => path(rr(B.x - e + 10, B.y - e + 16, B.w + 2 * e, B.h + 2 * e, e), { fill: '#000', fillOpacity: a })).join(''),
    crown(),
    // cabinet body
    path(stepRect(B.x, B.y, B.w, B.h, 16, 2), { fill: 'url(#dnBody)', stroke: 'url(#dnGoldD)', strokeWidth: 8 }),
    path(stepRect(B.x, B.y, B.w, B.h, 16, 2), { fill: 'url(#dnBrush)' }),
    path(stepRect(B.x + 12, B.y + 12, B.w - 24, B.h - 24, 14, 2), { fill: 'none', stroke: 'url(#dnGoldD)', strokeWidth: 1.6, strokeOpacity: 0.7 }),
    // a long diagonal sheen across the lacquer
    path(poly([[B.x + 260, B.y + 14], [B.x + 420, B.y + 14], [B.x + 120, B.y + B.h - 14], [B.x + 20, B.y + B.h - 14]]), { fill: '#fff', fillOpacity: 0.025 }),
    // chevron friezes top and bottom, framed by pinstripes
    path(rr(B.x + 230, topBand.y, B.w - 460, topBand.h, 0), { fill: 'url(#dnChevH)' }),
    path(rr(B.x + 230, topBand.y, B.w - 460, topBand.h, 0), { fill: 'url(#dnChevH)', transform: `translate(0 ${topBand.y + botBand.y + botBand.h}) scale(1 -1)` }),
    path(`M${B.x + 230} ${topBand.y - 6}H${B.x + B.w - 230}M${B.x + 230} ${topBand.y + topBand.h + 6}H${B.x + B.w - 230}M${B.x + 230} ${botBand.y - 6}H${B.x + B.w - 230}M${B.x + 230} ${botBand.y + botBand.h + 6}H${B.x + B.w - 230}`, { stroke: 'url(#dnGoldT)', strokeWidth: 2 }),
    [[B.x + 214, topBand.y], [B.x + B.w - 246, topBand.y], [B.x + 214, botBand.y], [B.x + B.w - 246, botBand.y]].map(([x, y]) => path(stepRect(x, y - 10, 32, topBand.h + 20, 6, 1), { fill: 'url(#dnGoldV)', stroke: INK, strokeWidth: 1.4 }) + path(rr(x + 9, y + 8, 14, topBand.h - 16, 0), { fill: 'url(#dnEmeraldL)', stroke: '#03261a', strokeWidth: 1 })).join(''),
    // vertical chevrons in the side fields
    sideFrieze(B.x + 148, hole.y - 30, hole.y + hole.h + 10), sideFrieze(B.x + B.w - 148, hole.y - 30, hole.y + hole.h + 10),
    // the stepped gold molding around the picture, outer to inner
    path(stepRect(...grow(92), 14, 2), { fill: '#000', fillOpacity: 0.4 }),
    path(stepRect(...grow(84), 14, 2), { fill: 'url(#dnGoldD)', stroke: INK, strokeWidth: 1.5 }),
    path(stepRect(...grow(76), 14, 2), { fill: 'url(#dnGoldV)', stroke: INK, strokeWidth: 1 }),
    path(stepRect(...grow(66), 12, 2), { fill: '#6a4a14', stroke: INK, strokeWidth: 1 }),
    path(stepRect(...grow(62), 12, 2), { fill: 'url(#dnGoldD)' }),
    path(rr(...grow(52), 0), { fill: INK }),
    // calm lacquer mat with a single hairline of gold at the sight edge
    path(rr(...grow(50), 0), { fill: 'url(#dnMat)' }),
    path(rr(...grow(6), 0), { fill: 'none', stroke: '#b48838', strokeOpacity: 0.85, strokeWidth: 3 }),
    L.lip(holeD, '#000', [[6, 0.25], [3, 0.5]]),
    // gems at the middle of each molding side
    g({ transform: tf(CX, hole.y - 70) }, baguette(64, 18)), g({ transform: tf(CX, hole.y + hole.h + 70) }, baguette(64, 18)),
    g({ transform: `${tf(hole.x - 70, CY)} rotate(90)` }, baguette(64, 18)), g({ transform: `${tf(hole.x + hole.w + 70, CY)} rotate(90)` }, baguette(64, 18)),
    // quarter-sun fans in the field corners
    ...fanAt.map(([x, y, sx, sy]) => g({ transform: `translate(${x} ${y}) scale(${sx} ${sy})` }, quarterFan(80))),
    apron(),
    pilaster(B.x + 20), pilaster(B.x + B.w - 20),
    skyline(),
    [[CX - 540, 250, 9], [CX + 580, 200, 7], [CX + 260, 96, 6], [B.x + 30, 1410, 7]].map(([x, y, r]) => path(L.sparkle(x, y, r, 0.1), { fill: '#fff4cc', fillOpacity: 0.85 })).join(''),
  ].join('\n');
  return { defs, body };
}

module.exports = {
  W, H, hole, radius, draw,
  meta: {
    name: 'Deco Noir', theme: 'art deco', rarity: 'legendary', translucent: false, collection: 'atelier-noir', license: 'CC-BY-4.0',
    desc: 'A black lacquer and brushed gold cabinet from the jazz age, crowned by a sunburst over a gold-leaf skyline and guarded by fluted pilasters.',
    tags: ['art deco', 'gold', 'black', 'emerald', 'jazz age', 'elegant', 'skyline'],
  },
};
