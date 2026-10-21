'use strict';
// Maki-e: the lid of an urushi lacquer box. A black lacquer rim with gilt corner caps holds a deep black
// field dusted with nashiji gold that thickens toward the edges. Gold maki-e pictures fill the field: two
// cranes with mother-of-pearl bodies wheel over the upper left, a mother-of-pearl moon rises behind mist
// bands on the right, an old pine climbs the left side and flowing water runs along the bottom, scattered
// with cut-gold squares. A purple braided silk cord runs from gilt ring fittings to a knot at the top with
// two tassels. Around the picture: a plain band of black lacquer inside a single gold line.
const L = require('../lib');
const { rr, path, g, lg, rg, circle, ellipse, poly, tf, n, P, smooth, rng } = L;

const W = 1700, H = 1290;
const BOX = { x: 80, y: 160, w: 1540, h: 1020 };
const RIM = 36; // lacquer rim width
const F = { x: BOX.x + RIM, y: BOX.y + RIM, w: BOX.w - 2 * RIM, h: BOX.h - 2 * RIM }; // black field
const hole = { x: 370, y: 390, w: 960, h: 540 }, radius = 6;
const CX = W / 2;
const INK = '#0a0606';
const GOLD_LINE = '#d9ad52';

/** A feather along direction `ang` (deg) from (x0, y0): { base, tip, line } path data, the base in
 * mother-of-pearl and the tip in lacquer black, in absolute coordinates so a wing can merge its feathers. */
function feather(len, w, tipAt, x0, y0, ang) {
  const c = Math.cos((ang * Math.PI) / 180), s = Math.sin((ang * Math.PI) / 180);
  const T = (u, v) => [x0 + u * c - v * s, y0 + u * s + v * c];
  const edge = (x) => (w / 2) * Math.pow(Math.max(0, 1 - Math.pow(x / len, 2.2)), 0.7) * (x < len * 0.08 ? 0.6 + 5 * x / len : 1);
  const piece = (a, b) => {
    const up = [], lo = [];
    for (let i = 0; i <= 5; i++) { const x = a + ((b - a) * i) / 5; up.push(T(x, -edge(x))); lo.unshift(T(x, edge(x) * 0.8)); }
    return poly([...up, ...lo]);
  };
  return { base: piece(0, len * tipAt), tip: piece(len * tipAt - 1, len), line: `M${P(...T(len * 0.04, 0))}L${P(...T(len * 0.95, 0))}` };
}

/**
 * A wing seen from the side: feathers hang from a curved leading edge that leaves the shoulder at theta
 * (deg) and sweeps back toward the tip; the inner feathers point back, the primaries fan out at the tip.
 */
function wing(S, theta) {
  const k = 12, rad = (a) => (a * Math.PI) / 180;
  const lead = (t) => { const a = rad(theta - 22 * t * t); return [S * t * Math.cos(a), S * t * Math.sin(a)]; };
  const phi = (t) => theta - 100 + 82 * Math.pow(t, 1.7);
  let base = '', tip = '', line = '';
  for (let i = k - 1; i >= 0; i--) {
    const t = 0.12 + (0.88 * i) / (k - 1), [x, y] = lead(t);
    const len = S * (t > 0.72 ? 0.62 - 0.4 * (t - 0.72) : 0.42 + 0.26 * t);
    const f = feather(len, S * 0.15, t > 0.72 ? 0.66 : 0.5, x, y, phi(t));
    base += f.base; tip += f.tip; line += f.line;
  }
  // coverts along the leading edge, with two rows of scalloped gold lines
  const up = [], lo = [], row1 = [], row2 = [];
  for (let i = 0; i <= 12; i++) {
    const t = (i / 12) * 0.92, [x, y] = lead(t), a = rad(phi(t)), cw = S * 0.26 * (1 - 0.75 * t) + S * 0.03;
    up.push([x, y]); lo.unshift([x + cw * Math.cos(a), y + cw * Math.sin(a)]);
    row1.push([x + cw * 0.42 * Math.cos(a), y + cw * 0.42 * Math.sin(a)]);
    row2.push([x + cw * 0.78 * Math.cos(a), y + cw * 0.78 * Math.sin(a)]);
  }
  const scallop = (pts) => { let d = `M${P(...pts[0])}`; for (let i = 1; i < pts.length; i++) { const [a, b] = pts[i - 1], [c, e] = pts[i]; d += `Q${P((a + c) / 2 + (e - b) * 0.5, (b + e) / 2 - (c - a) * 0.5)} ${P(c, e)}`; } return d; };
  return path(base, { fill: 'url(#mkPearl)', stroke: '#b8892e', strokeWidth: 1.4, strokeLinejoin: 'round' })
    + path(tip, { fill: '#0b0909', stroke: '#e3b65c', strokeWidth: 1.6, strokeLinejoin: 'round' })
    + path(line, { stroke: '#c99a40', strokeOpacity: 0.8, strokeWidth: 1.1 })
    + path(poly([...up, ...lo]), { fill: 'url(#mkPearl)', stroke: '#e3b65c', strokeWidth: 1.6, strokeLinejoin: 'round' })
    + path(scallop(row1) + scallop(row2), { fill: 'none', stroke: '#c99a40', strokeWidth: 1.2 })
    + path(smooth(up), { fill: 'none', stroke: '#f6dc90', strokeWidth: 2.4, strokeLinecap: 'round' });
}

/** A gliding red-crowned crane facing +x with its wings raised in a V; S is roughly one wing's length. */
function crane(x, y, S, rot = 0, flip = 1) {
  const neck = `M${P(S * 0.3, -S * 0.04)}C${P(S * 0.55, -S * 0.06, S * 0.78, -S * 0.12, S * 1.02, -S * 0.1)}`;
  const body = `M${P(-S * 0.42, S * 0.02)}C${P(-S * 0.26, -S * 0.16, S * 0.2, -S * 0.17, S * 0.38, -S * 0.04)}C${P(S * 0.3, S * 0.1, -S * 0.1, S * 0.16, -S * 0.42, S * 0.02)}Z`;
  const tail = `M${P(-S * 0.3, -S * 0.04)}L${P(-S * 0.64, -S * 0.08)}L${P(-S * 0.52, S * 0.01)}L${P(-S * 0.68, S * 0.06)}L${P(-S * 0.3, S * 0.08)}Z`;
  const legs = `M${P(-S * 0.3, S * 0.06)}L${P(-S * 1.0, S * 0.14)}M${P(-S * 0.28, S * 0.09)}L${P(-S * 0.96, S * 0.2)}`;
  const toes = `M${P(-S * 1.0, S * 0.14)}l${n(-S * 0.07)} ${n(-S * 0.03)}M${P(-S * 1.0, S * 0.14)}l${n(-S * 0.07)} ${n(S * 0.02)}M${P(-S * 0.96, S * 0.2)}l${n(-S * 0.07)} ${n(-S * 0.01)}M${P(-S * 0.96, S * 0.2)}l${n(-S * 0.06)} ${n(S * 0.04)}`;
  return g({ transform: `${tf(x, y, rot)}${flip < 0 ? ' scale(-1 1)' : ''}` },
    // far wing, set back and a little dimmer
    g({ transform: `${tf(-S * 0.04, -S * 0.1)} scale(0.82)`, opacity: 0.85 }, wing(S, -122)),
    path(legs, { fill: 'none', stroke: '#e3b65c', strokeWidth: S * 0.035, strokeLinecap: 'round' }),
    path(legs, { fill: 'none', stroke: INK, strokeWidth: S * 0.018, strokeLinecap: 'round' }),
    path(toes, { fill: 'none', stroke: '#e3b65c', strokeWidth: S * 0.012, strokeLinecap: 'round' }),
    path(tail, { fill: INK, stroke: '#e3b65c', strokeWidth: 1.5, strokeLinejoin: 'round' }),
    path(body, { fill: 'url(#mkPearl)', stroke: '#e3b65c', strokeWidth: 2 }),
    path(`M${P(-S * 0.3, S * 0.0)}q${n(S * 0.08)} ${n(-S * 0.05)} ${n(S * 0.18)} ${n(-S * 0.04)}M${P(-S * 0.18, S * 0.07)}q${n(S * 0.1)} ${n(-S * 0.05)} ${n(S * 0.22)} ${n(-S * 0.04)}`, { fill: 'none', stroke: '#c99a40', strokeWidth: 1.2 }),
    path(neck, { fill: 'none', stroke: '#e3b65c', strokeWidth: S * 0.085, strokeLinecap: 'round' }),
    path(neck, { fill: 'none', stroke: INK, strokeWidth: S * 0.06, strokeLinecap: 'round' }),
    path(`M${P(S * 0.26, -S * 0.02)}C${P(S * 0.32, -S * 0.04, S * 0.4, -S * 0.06, S * 0.48, -S * 0.07)}`, { fill: 'none', stroke: 'url(#mkPearl)', strokeWidth: S * 0.05, strokeLinecap: 'round' }),
    path(ellipse(S * 1.06, -S * 0.11, S * 0.065, S * 0.05), { fill: INK, stroke: '#e3b65c', strokeWidth: 1.5 }),
    path(poly([[S * 1.1, -S * 0.14], [S * 1.38, -S * 0.08], [S * 1.1, -S * 0.08]]), { fill: 'url(#mkGold)', stroke: '#7a5418', strokeWidth: 1 }),
    path(ellipse(S * 1.05, -S * 0.155, S * 0.032, S * 0.018), { fill: 'url(#mkCrown)' }),
    path(circle(S * 1.08, -S * 0.115, S * 0.012), { fill: '#e3b65c' }),
    // near wing
    g({ transform: tf(S * 0.04, -S * 0.08) }, wing(S, -46)));
}

/** Pine needle tuft: a layered fan of fine gold needles over a shaded half-disc. */
function tuft(x, y, r, rot) {
  let d = '', d2 = '';
  for (let i = 0; i <= 18; i++) { const a = ((-172 + (164 * i) / 18) * Math.PI) / 180; d += `M0 0L${P(r * Math.cos(a), r * Math.sin(a))}`; }
  for (let i = 0; i <= 10; i++) { const a = ((-160 + (140 * i) / 10) * Math.PI) / 180; d2 += `M0 0L${P(r * 0.7 * Math.cos(a), r * 0.7 * Math.sin(a))}`; }
  return g({ transform: tf(x, y, rot) },
    path(`M${-r} 0A${r} ${r} 0 0 1 ${r} 0Z`, { fill: 'url(#mkGoldDim)', fillOpacity: 0.55 }),
    path(d, { stroke: 'url(#mkGold)', strokeWidth: 1.5, strokeLinecap: 'round' }),
    path(d2, { stroke: '#7a5418', strokeOpacity: 0.7, strokeWidth: 1, strokeLinecap: 'round' }),
    path(`M${-r} 0A${r} ${r} 0 0 1 ${r} 0`, { fill: 'none', stroke: '#f6dc90', strokeWidth: 1.2, strokeOpacity: 0.8 }));
}

/** A cluster of three overlapping tufts. */
const cluster = (x, y, r, rot) => tuft(x - r * 0.55, y + r * 0.18, r * 0.78, rot - 22) + tuft(x + r * 0.55, y + r * 0.2, r * 0.74, rot + 22) + tuft(x, y, r, rot);

/** A tapered limb along spine points [[x, y, width], ...]: a closed outline plus the spine itself. */
function limb(pts) {
  const L1 = [], R1 = [];
  for (let i = 0; i < pts.length; i++) {
    const [x, y, w] = pts[i], [ax, ay] = pts[Math.max(0, i - 1)], [bx, by] = pts[Math.min(pts.length - 1, i + 1)];
    const dx = bx - ax, dy = by - ay, l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l;
    L1.push([x + nx * w / 2, y + ny * w / 2]); R1.unshift([x - nx * w / 2, y - ny * w / 2]);
  }
  return `${smooth(L1)}L${P(...R1[0])}${smooth(R1).replace(/^M[^Q]*/, '')}Z`;
}

/** The old pine: a twisting trunk with scaled bark rising up the left side, limbs with needle clusters. */
function pine() {
  const trunkPts = [[170, 1160, 64], [196, 1080, 54], [168, 990, 50], [204, 900, 46], [236, 810, 42], [210, 720, 38], [180, 640, 34], [214, 560, 28], [260, 500, 20]];
  const limbs = [
    [[200, 1040, 26], [280, 1050, 22], [380, 1036, 16], [470, 1062, 12], [560, 1048, 8]],
    [[196, 860, 20], [160, 820, 16], [140, 770, 10]],
    [[190, 660, 16], [150, 640, 12], [130, 600, 8]],
    [[230, 530, 14], [290, 490, 10], [310, 440, 6]],
  ];
  const bark = rng(17);
  let scales = '';
  for (let i = 1; i < trunkPts.length - 2; i++) {
    const [x0, y0, w0] = trunkPts[i], [x1, y1] = trunkPts[i + 1];
    for (let j = 0; j < 5; j++) {
      const t = j / 5, x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t, off = (bark() - 0.5) * w0 * 0.5, s = w0 * 0.22;
      scales += `M${P(x + off - s * 1.4, y)}q${n(s * 1.2)} ${n(-s * 0.7)} ${n(2.8 * s)} ${n(-s * 0.1)}M${P(x + off - s * 0.6, y + s * 0.5)}q${n(s * 0.6)} ${n(-s * 0.3)} ${n(1.4 * s)} 0`;
    }
  }
  const limbD = limbs.map(limb).join('');
  const clusters = [
    [560, 1036, 40, 6], [470, 1046, 34, -8], [380, 1022, 32, 4], [300, 1034, 26, -12],
    [140, 762, 34, -30], [130, 596, 30, -24], [310, 436, 38, 6], [258, 470, 34, -14], [204, 500, 28, -36],
  ];
  return g({},
    path(limbD, { fill: '#2a1c08', transform: 'translate(2 3)' }),
    path(limbD, { fill: 'url(#mkGoldDim)', stroke: '#e3b65c', strokeWidth: 1.4 }),
    path(limb(trunkPts), { fill: 'url(#mkBark)', stroke: '#e3b65c', strokeWidth: 2 }),
    path(scales, { fill: 'none', stroke: '#4a320c', strokeWidth: 2.4, strokeLinecap: 'round' }) + path(scales, { fill: 'none', stroke: '#f6dc90', strokeOpacity: 0.55, strokeWidth: 1, strokeLinecap: 'round', transform: 'translate(0.5 -2)' }),
    clusters.map(([x, y, r, a]) => cluster(x, y, r, a)).join(''));
}

/** Flowing water (ryusui): bundles of gold lines meandering along the bottom field, with whirls. */
function water() {
  const y0 = F.y + F.h - 108, x0 = F.x + 160, x1 = F.x + F.w - 10;
  let d = '', faint = '';
  for (let k = 0; k < 7; k++) {
    const pts = [];
    for (let x = x0 - 40; x <= x1; x += 24) {
      const t = (x - x0) / (x1 - x0);
      pts.push([x, y0 + k * 13 + 26 * Math.sin(t * 7.2 + 0.4) + 12 * Math.sin(t * 17 + 1.3) + 34 * t]);
    }
    (k % 3 === 1 ? faint : (d += '', null));
    if (k % 3 === 1) faint += smooth(pts); else d += smooth(pts);
  }
  // whirls
  const whirl = (cx, cy, r) => {
    const pts = [];
    for (let i = 0; i <= 30; i++) { const t = i / 30, a = t * Math.PI * 3.2, rad = r * (1 - t * 0.85); pts.push([cx + rad * Math.cos(a), cy + rad * Math.sin(a) * 0.7]); }
    return smooth(pts);
  };
  const wh = [[F.x + 620, y0 + 40, 30], [F.x + 1040, y0 + 66, 24], [F.x + 1300, y0 + 52, 20]].map(([x, y, r]) => whirl(x, y, r)).join('');
  // cut-gold squares (kirigane) scattered along the stream
  const squares = kirigane(x0, y0 - 30, x1 - x0, 140, 46, 5);
  return g({},
    path(d, { fill: 'none', stroke: 'url(#mkGoldH)', strokeWidth: 3, strokeLinecap: 'round' }),
    path(faint, { fill: 'none', stroke: '#c9a24c', strokeOpacity: 0.55, strokeWidth: 1.6, strokeLinecap: 'round' }),
    path(wh, { fill: 'none', stroke: '#f0cf7c', strokeWidth: 2.2, strokeLinecap: 'round' }),
    squares);
}

/** Cut-gold squares (kirigane) and a few mother-of-pearl flakes scattered over a region. */
function kirigane(x, y, w, h, count, seed) {
  const rnd = rng(seed);
  let gold = '', pearl = '';
  for (let i = 0; i < count; i++) {
    const s = 3 + rnd() * 6, cx = x + rnd() * w, cy = y + rnd() * h, a = rnd() * 1.57;
    const pts = [0, 1, 2, 3].map((k) => [cx + (s / 1.41) * Math.cos(a + k * 1.5708), cy + (s / 1.41) * Math.sin(a + k * 1.5708)]);
    if (rnd() < 0.25) pearl += poly(pts); else gold += poly(pts);
  }
  return path(gold, { fill: '#e8c56c' }) + path(pearl, { fill: 'url(#mkPearl)' });
}

/** Suyari-gasumi mist band: a long cloud bar with rounded, stepped ends, filled with dense gold dust. */
function mist(x, y, w, h, up = 0.55, down = 0.25) {
  // a long bar with a raised tab and a hanging tab; drawn as outline strokes under solid fills so the
  // three rounded bars read as one stepped cloud
  const bars = [rr(x, y, w, h, h / 2), rr(x + w * up - w * 0.18, y - h * 0.62, w * 0.36, h, h / 2), rr(x + w * down - w * 0.14, y + h * 0.62, w * 0.28, h * 0.9, h * 0.45)];
  const d = bars.join('');
  return path(d, { fill: 'none', stroke: '#d9ad52', strokeWidth: 4.5 })
    + bars.map((b) => path(b, { fill: '#140e08' })).join('')
    + path(d, { fill: 'url(#mkDust)' })
    + path(d, { fill: 'url(#mkMist)' });
}

/** Mother-of-pearl moon: an iridescent disc laid in pieces, rimmed in gold. */
function moon(cx, cy, r) {
  const rnd = rng(9);
  let cracks = '';
  for (let i = 0; i < 14; i++) {
    const a = rnd() * Math.PI * 2, b = a + 0.5 + rnd() * 1.1;
    cracks += `M${P(cx + r * Math.cos(a), cy + r * Math.sin(a))}L${P(cx + r * 0.6 * Math.cos((a + b) / 2) + (rnd() - 0.5) * 10, cy + r * 0.6 * Math.sin((a + b) / 2) + (rnd() - 0.5) * 10)}L${P(cx + r * Math.cos(b), cy + r * Math.sin(b))}`;
  }
  return path(circle(cx, cy, r + 30), { fill: 'url(#mkMoonGlow)' })
    + path(circle(cx, cy, r + 4), { fill: 'url(#mkGold)' })
    + path(circle(cx, cy, r), { fill: 'url(#mkMoon)' })
    + path(circle(cx, cy, r), { fill: 'url(#mkSheen)' })
    + path(cracks, { fill: 'none', stroke: '#4a4060', strokeOpacity: 0.22, strokeWidth: 1 });
}

/** Gilt corner cap with nanako (fish-roe) ground and an engraved chrysanthemum; drawn for the top-left. */
function cornerCap() {
  const a = 96, t = 46, r = 34;
  const d = `M${r} 0H${a}V${t}H${t}V${a}H0V${r}A${r} ${r} 0 0 1 ${r} 0Z`;
  let petals = '';
  for (let i = 0; i < 16; i++) petals += g({ transform: `rotate(${i * 22.5})` }, path('M0 -4C3 -8 3 -14 0 -16C-3 -14 -3 -8 0 -4Z', {}));
  return path(d, { fill: '#000', fillOpacity: 0.35, transform: 'translate(3 5)' })
    + path(d, { fill: 'url(#mkGilt)', stroke: '#5a3a0c', strokeWidth: 2 })
    + path(d, { fill: 'url(#mkNanako)' })
    + path(`M${r + 4} 7H${a - 6}V${t - 6}M7 ${r + 4}V${a - 6}H${t - 6}`, { fill: 'none', stroke: '#fff2c0', strokeOpacity: 0.6, strokeWidth: 1.4 })
    + g({ transform: tf(26, 26), fill: 'url(#mkGilt)', stroke: '#5a3a0c', strokeWidth: 1 }, petals)
    + path(circle(26, 26, 5), { fill: '#fff0b8', stroke: '#5a3a0c', strokeWidth: 1 });
}

/** Braided cord along a path: a dark core, a twill of lighter strands and a sheen. */
function cord(d, w = 13) {
  return path(d, { fill: 'none', stroke: '#000', strokeOpacity: 0.3, strokeWidth: w + 4, strokeLinecap: 'round', transform: 'translate(3 5)' })
    + path(d, { fill: 'none', stroke: '#2a0f3a', strokeWidth: w + 2, strokeLinecap: 'round', strokeLinejoin: 'round' })
    + path(d, { fill: 'none', stroke: '#6a2a8a', strokeWidth: w - 2, strokeLinecap: 'round', strokeLinejoin: 'round' })
    + path(d, { fill: 'none', stroke: '#a868c8', strokeWidth: w - 4, strokeDasharray: '3 3.5', strokeLinejoin: 'round' })
    + path(d, { fill: 'none', stroke: '#f0d8ff', strokeOpacity: 0.3, strokeWidth: 2, strokeLinecap: 'round', transform: 'translate(-1 -3)' });
}

/** Silk tassel hanging from (x, y). */
function tassel(x, y, len, sway = 0) {
  let strands = '';
  for (let i = -7; i <= 7; i++) { const l = len * (0.9 + 0.1 * Math.cos(i * 1.7)); strands += `M${P(x + i * 1.2, y + 34)}C${P(x + i * 1.5, y + 34 + l * 0.3, x + i * 2.2 + sway * 0.5, y + 34 + l * 0.7, x + i * 2.6 + sway, y + 34 + l)}`; }
  const head = `M${P(x - 9, y)}C${P(x - 16, y + 10, x - 16, y + 24, x - 13, y + 32)}H${n(x + 13)}C${P(x + 16, y + 24, x + 16, y + 10, x + 9, y)}Z`;
  return path(strands, { fill: 'none', stroke: '#3a1450', strokeWidth: 2.6, strokeLinecap: 'round' })
    + path(strands, { fill: 'none', stroke: '#8a48ae', strokeWidth: 1.4, strokeLinecap: 'round' })
    + path(strands, { fill: 'none', stroke: '#d8a8f0', strokeOpacity: 0.4, strokeWidth: 0.8, strokeLinecap: 'round', transform: 'translate(-0.6 0)' })
    + path(head, { fill: 'url(#mkSilk)', stroke: '#2a0f3a', strokeWidth: 1.5 })
    + path(rr(x - 15, y + 26, 30, 9, 3), { fill: 'url(#mkGilt)', stroke: '#5a3a0c', strokeWidth: 1.2 })
    + path(rr(x - 12, y + 40, 24, 6, 2), { fill: 'url(#mkGilt)', stroke: '#5a3a0c', strokeWidth: 1 });
}

/** Decorative flat knot with three loops (top, left, right) and a crossed centre. */
function knot(x, y) {
  const loopL = `M${P(x - 14, y)}C${P(x - 60, y - 46, x - 110, y - 10, x - 84, y + 18)}C${P(x - 64, y + 38, x - 30, y + 20, x - 14, y + 6)}`;
  const loopR = `M${P(x + 14, y)}C${P(x + 60, y - 46, x + 110, y - 10, x + 84, y + 18)}C${P(x + 64, y + 38, x + 30, y + 20, x + 14, y + 6)}`;
  const loopT = `M${P(x - 10, y - 10)}C${P(x - 40, y - 60, x + 40, y - 60, x + 10, y - 10)}`;
  return g({}, cord(loopL, 12), cord(loopR, 12), cord(loopT, 12),
    path(rr(x - 20, y - 20, 40, 40, 10), { fill: '#4a1a64', stroke: '#2a0f3a', strokeWidth: 2 }),
    path(`M${x - 14} ${y - 14}L${x + 14} ${y + 14}M${x + 14} ${y - 14}L${x - 14} ${y + 14}`, { stroke: '#a868c8', strokeWidth: 5, strokeLinecap: 'round' }),
    path(`M${x - 14} ${y - 14}L${x + 14} ${y + 14}M${x + 14} ${y - 14}L${x - 14} ${y + 14}`, { stroke: '#2a0f3a', strokeWidth: 1, strokeDasharray: '3 3' }));
}

/** Gilt ring fitting on a chrysanthemum plate, on the rim. */
function fitting(x, y) {
  let petals = '';
  for (let i = 0; i < 12; i++) { const a = (i * 30 * Math.PI) / 180; petals += circle(x + 16 * Math.cos(a), y + 16 * Math.sin(a), 8); }
  return path(petals, { fill: 'url(#mkGilt)', stroke: '#5a3a0c', strokeWidth: 1.4 })
    + path(circle(x, y, 17), { fill: 'url(#mkGilt)', stroke: '#5a3a0c', strokeWidth: 1.4 })
    + path(circle(x, y, 8), { fill: '#3a240a' })
    + path(`M${P(x - 24, y - 6)}A${P(26, 26)} 0 1 1 ${P(x + 24, y - 6)}`, { fill: 'none', stroke: '#5a3a0c', strokeWidth: 9, strokeLinecap: 'round', transform: `translate(0 -24)` })
    + path(`M${P(x - 24, y - 6)}A${P(26, 26)} 0 1 1 ${P(x + 24, y - 6)}`, { fill: 'none', stroke: 'url(#mkGilt)', strokeWidth: 6, strokeLinecap: 'round', transform: `translate(0 -24)` });
}

function draw() {
  const holeD = rr(hole.x, hole.y, hole.w, hole.h, radius);
  const rnd = rng(3);
  let dust = '', dense = '';
  for (let i = 0; i < 52; i++) { const z = 1 + rnd() * 1.8; dust += `M${P(rnd() * 140, rnd() * 140)}h${n(z)}v${n(z * 0.8)}h${n(-z)}Z`; }
  for (let i = 0; i < 46; i++) { const z = 1.2 + rnd() * 2; dense += `M${P(rnd() * 60, rnd() * 60)}h${n(z)}v${n(z * 0.8)}h${n(-z)}Z`; }
  const fieldD = rr(F.x, F.y, F.w, F.h, 14);
  const defs = [
    lg('mkShu', [0, 0, 1, 1], [[0, '#2c2426'], [0.5, '#141012'], [1, '#060405']]),
    lg('mkShuRim', [0, 0, 0, 1], [[0, '#3a3236'], [0.5, '#1c1618'], [1, '#0a0708']]),
    lg('mkCrown', [0, 0, 1, 1], [[0, '#e8513a'], [0.5, '#c2301f'], [1, '#8a1a10']]),
    lg('mkField', [0, 0, 1, 1], [[0, '#1a1414'], [0.45, '#0a0808'], [0.55, '#110d0d'], [1, '#050404']]),
    lg('mkGold', [0, 0, 1, 1], [[0, '#fbe6a6'], [0.4, '#e2b65a'], [0.75, '#b8862e'], [1, '#e8c56c']]),
    lg('mkGoldH', [0, 0, 1, 0], [[0, '#a07a30'], [0.3, '#f0cf7c'], [0.6, '#c99a40'], [1, '#e8c56c']]),
    lg('mkGoldDim', [0, 0, 1, 1], [[0, '#c99a40'], [0.6, '#8a6420'], [1, '#5a3e10']]),
    lg('mkBark', [0, 0, 1, 0], [[0, '#7a5418'], [0.35, '#d8ac54'], [0.6, '#a87a2c'], [1, '#5a3e10']]),
    lg('mkGilt', [0, 0, 1, 1], [[0, '#fff0b8'], [0.35, '#dcb056'], [0.7, '#a8761e'], [1, '#e8c060']]),
    lg('mkPearl', [0, 0, 1, 1], [[0, '#f4f8ff'], [0.2, '#d6eef2'], [0.4, '#f2dcf2'], [0.6, '#dcf2e0'], [0.8, '#c8d8f4'], [1, '#f6eef8']]),
    rg('mkMoon', [0.42, 0.38, 0.7], [[0, '#ffffff'], [0.3, '#eaf2fa'], [0.55, '#e6dcf4'], [0.75, '#d4ece6'], [1, '#b8c8e4']]),
    lg('mkSheen', [0, 0, 1, 1], [[0, '#ffd8f0', 0.25], [0.35, '#d0f0ff', 0.05], [0.5, '#fff', 0.35], [0.65, '#c8ffe0', 0.05], [1, '#e0d0ff', 0.25]]),
    rg('mkMoonGlow', [0.5, 0.5, 0.5], [[0.6, '#f0e8c8', 0.2], [1, '#f0e8c8', 0]]),
    lg('mkMist', [0, 0, 1, 0], [[0, '#000', 0], [0.5, '#000', 0.2], [1, '#000', 0]]),
    lg('mkSilk', [0, 0, 1, 0], [[0, '#2a0f3a'], [0.4, '#8a48ae'], [1, '#3a1450']]),
    lg('mkSheenField', [0, 0, 1, 1], [[0.3, '#fff', 0], [0.42, '#fff', 0.05], [0.5, '#fff', 0], [1, '#fff', 0]]),
    `<pattern id="mkNashiji" width="140" height="140" patternUnits="userSpaceOnUse"><path d="${dust}" fill="#d9ad52" fill-opacity="0.32"/></pattern>`,
    `<pattern id="mkNashijiDense" width="60" height="60" patternUnits="userSpaceOnUse"><path d="${dense}" fill="#e2b65a" fill-opacity="0.55"/></pattern>`,
    `<pattern id="mkDust" width="60" height="60" patternUnits="userSpaceOnUse"><rect width="60" height="60" fill="#8a6420" fill-opacity="0.3"/><path d="${dense}" fill="#f0cf7c"/></pattern>`,
    '<pattern id="mkNanako" width="6" height="6" patternUnits="userSpaceOnUse"><circle cx="3" cy="3" r="1.6" fill="none" stroke="#6a4610" stroke-opacity="0.45" stroke-width="0.8"/></pattern>',
    `<clipPath id="mkFieldClip"><path d="${fieldD}"/></clipPath>`,
  ].join('');

  const corners = [[1, 1, BOX.x, BOX.y], [-1, 1, BOX.x + BOX.w, BOX.y], [1, -1, BOX.x, BOX.y + BOX.h], [-1, -1, BOX.x + BOX.w, BOX.y + BOX.h]]
    .map(([sx, sy, x, y]) => g({ transform: `translate(${x - sx * 4} ${y - sy * 4}) scale(${sx} ${sy})` }, cornerCap())).join('');
  const kx = CX, ky = 112;
  const fl = [BOX.x + 250, BOX.y + RIM / 2], fr = [BOX.x + BOX.w - 250, BOX.y + RIM / 2];
  const cordL = `M${P(fl[0], fl[1] - 46)}C${P(fl[0] + 120, fl[1] - 110, kx - 260, ky - 10, kx - 84, ky + 18)}`;
  const cordR = `M${P(fr[0], fr[1] - 46)}C${P(fr[0] - 120, fr[1] - 110, kx + 260, ky - 10, kx + 84, ky + 18)}`;
  const calm = 44;

  const body = [
    // shadow on the table
    [[18, 0.06], [10, 0.1], [4, 0.16]].map(([e, a]) => path(rr(BOX.x - e + 10, BOX.y - e + 18, BOX.w + 2 * e, BOX.h + 2 * e, 50 + e), { fill: '#000', fillOpacity: a })).join(''),
    // black lacquer rim with a raised lip and a gold line where it meets the field
    path(rr(BOX.x, BOX.y, BOX.w, BOX.h, 48), { fill: 'url(#mkShuRim)', stroke: '#000000', strokeWidth: 2 }),
    path(rr(BOX.x + 6, BOX.y + 6, BOX.w - 12, BOX.h - 12, 44), { fill: 'url(#mkShu)' }),
    path(`M${BOX.x + 60} ${BOX.y + 9}H${BOX.x + BOX.w - 60}`, { stroke: '#ffb8a0', strokeOpacity: 0.35, strokeWidth: 3, strokeLinecap: 'round' }),
    path(rr(F.x - 5, F.y - 5, F.w + 10, F.h + 10, 18), { fill: 'url(#mkGold)' }),
    path(fieldD, { fill: 'url(#mkField)' }),
    // nashiji gold dust, thicker toward the rim
    path(fieldD, { fill: 'url(#mkNashiji)' }),
    path(`${fieldD}${rr(F.x + 70, F.y + 70, F.w - 140, F.h - 140, 10)}`, { fill: 'url(#mkNashijiDense)', fillRule: 'evenodd', fillOpacity: 0.7 }),
    path(`${fieldD}${rr(F.x + 26, F.y + 26, F.w - 52, F.h - 52, 12)}`, { fill: 'url(#mkNashijiDense)', fillRule: 'evenodd' }),
    g({ clipPath: 'url(#mkFieldClip)' },
      // mist bands, moon, water and the pine
      mist(F.x + 1010, F.y + 34, 380, 30), mist(F.x + 1290, F.y + 250, 260, 28, 0.35, 0.7), mist(F.x + 1300, F.y + 590, 220, 26, 0.6, 0.3), mist(F.x - 40, F.y + 70, 220, 26, 0.6, 0.4),
      moon(F.x + 1350, F.y + 112, 78),
      mist(F.x + 1170, F.y + 150, 330, 26, 0.3, 0.75),
      water(),
      pine(),
      mist(F.x + 1330, F.y + 800, 180, 24, 0.3, 0.65), kirigane(F.x + 1280, F.y + 200, 180, 700, 26, 11), kirigane(F.x + 20, F.y + 120, 160, 300, 12, 23)),
    // the calm band of plain lacquer around the picture, one gold line at its edge
    path(rr(hole.x - calm - 8, hole.y - calm - 8, hole.w + 2 * calm + 16, hole.h + 2 * calm + 16, 18), { fill: '#000', fillOpacity: 0.25 }),
    path(rr(hole.x - calm, hole.y - calm, hole.w + 2 * calm, hole.h + 2 * calm, 14), { fill: 'url(#mkField)', stroke: GOLD_LINE, strokeWidth: 3 }),
    path(rr(hole.x - calm + 8, hole.y - calm + 8, hole.w + 2 * calm - 16, hole.h + 2 * calm - 16, 10), { fill: 'none', stroke: GOLD_LINE, strokeOpacity: 0.45, strokeWidth: 1.2 }),
    path(rr(hole.x - 10, hole.y - 10, hole.w + 20, hole.h + 20, radius + 6), { fill: 'url(#mkShu)', stroke: '#000000', strokeWidth: 1.5 }),
    path(rr(...[hole.x - 3, hole.y - 3, hole.w + 6, hole.h + 6], radius + 2), { fill: 'none', stroke: GOLD_LINE, strokeWidth: 2 }),
    L.lip(holeD, '#000', [[6, 0.25], [3, 0.5]]),
    // lacquer sheen across the field
    path(fieldD, { fill: 'url(#mkSheenField)' }),
    // cranes over the upper left and one far off on the right, heading for the moon
    g({ clipPath: 'url(#mkFieldClip)' }, crane(F.x + 250, F.y + 140, 92, -4),
      crane(F.x + 590, F.y + 118, 72, 2),
      crane(F.x + 1380, F.y + 440, 64, 24, -1)),
    corners,
    // cord: from the rim fittings to the knot, with tassels
    cord(cordL), cord(cordR),
    fitting(...fl), fitting(...fr),
    tassel(kx - 16, ky + 20, 150, -8), tassel(kx + 16, ky + 20, 160, 8),
    knot(kx, ky),
  ].join('\n');
  return { defs, body };
}

module.exports = {
  W, H, hole, radius, draw,
  meta: {
    name: 'Maki-e', theme: 'japanese lacquer', rarity: 'legendary', translucent: false, collection: 'atelier-noir', license: 'CC-BY-4.0',
    desc: 'A black urushi lacquer box lid, painted in gold with cranes, an old pine and flowing water under a mother-of-pearl moon.',
    tags: ['japanese', 'lacquer', 'gold', 'cranes', 'mother-of-pearl', 'elegant', 'black lacquer'],
  },
};
