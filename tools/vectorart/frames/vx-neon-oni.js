'use strict';
// Neon Oni: a cyberpunk shrine monitor that is also an oni's face. A black-teal lacquer housing stands
// between dark wooden shrine pillars under a sweeping upturned top beam; two tall horns of cyan light
// rise from the beam, red LED eye slits glare from the brow and two small neon fangs sit on the lower
// lip. A braided black rope with tassels and zigzag paper streamers swags across the top, bead-and-tassel
// earrings hang from the tie-beam ends, circuit traces glow in the lacquer and spirit flames drift by.
// Optional animation: horn glow breathes, eyes flicker, flames float, tassels sway.
const L = require('../lib');
const { rr, path, g, lg, rg, circle, ellipse, sparkle, poly, glowStroke, lip, n, P } = L;

// The art is drawn in local coordinates and shifted down by DY to leave headroom for the horns.
const DY = 80;
const W = 1700, H = 1380, hole = { x: 410, y: 520, w: 880, h: 495 }, radius = 14;
const CX = W / 2;
const INK = '#02080c';
const CY = '#4dfff0', RED = '#ff2a44';
const HOUSE = { x: 300, y: 340, w: 1100, h: 790, r: 56 };
const KASAGI_D = 'M96 178C300 228 600 240 850 240C1100 240 1400 228 1604 178L1592 230C1400 276 1100 292 850 292C600 292 300 276 108 230Z';

const quad = (p0, p1, p2, t) => { const u = 1 - t; return [u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0], u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1]]; };

/** Braided rope along a quadratic swag: ink, dark core, top sheen, slanted twist grooves with cyan rim. */
function rope(p0, p1, p2, w) {
  const d = `M${P(...p0)}Q${P(...p1)} ${P(...p2)}`, N = 30;
  let tw = '';
  for (let i = 1; i < N; i++) {
    const [x, y] = quad(p0, p1, p2, i / N), [xa, ya] = quad(p0, p1, p2, (i - 0.5) / N), [xb, yb] = quad(p0, p1, p2, (i + 0.5) / N);
    let tx = xb - xa, ty = yb - ya; const l = Math.hypot(tx, ty); tx /= l; ty /= l;
    const nx = -ty, ny = tx, a = 0.44 * w, s = 0.3 * w;
    tw += `M${P(x - nx * a - tx * s, y - ny * a - ty * s)}Q${P(x + tx * s * 0.6, y + ty * s * 0.6)} ${P(x + nx * a + tx * s, y + ny * a + ty * s)}`;
  }
  return path(d, { fill: 'none', stroke: INK, strokeWidth: w + 8, strokeLinecap: 'round' })
    + path(d, { fill: 'none', stroke: '#1d2c34', strokeWidth: w, strokeLinecap: 'round' })
    + path(d, { fill: 'none', stroke: '#3a5a66', strokeWidth: n(w * 0.32), strokeLinecap: 'round', transform: `translate(0 ${n(-w * 0.2)})` })
    + path(tw, { fill: 'none', stroke: INK, strokeWidth: 4, strokeLinecap: 'round' })
    + path(tw, { fill: 'none', stroke: CY, strokeOpacity: 0.55, strokeWidth: 2, strokeLinecap: 'round', transform: 'translate(-2 -2)' });
}

/** Knot + flared tassel bundle hanging from (x, y). */
function tassel(x, y, len, w, cls = 'no-sway') {
  const top = y + w * 0.75, bw = w * 0.32, fw = w * 0.56;
  const bundle = `M${P(x - bw, top)}C${P(x - bw, top + len * 0.4, x - fw, top + len * 0.7, x - fw, top + len - 8)}Q${P(x, top + len + 10, x + fw, top + len - 8)}`
    + `C${P(x + fw, top + len * 0.7, x + bw, top + len * 0.4, x + bw, top)}Z`;
  let strands = '';
  for (let i = -2; i <= 2; i++) strands += `M${P(x + i * bw * 0.4, top + 14)}L${P(x + i * fw * 0.42, top + len - 4)}`;
  return g({ class: cls },
    path(bundle, { fill: 'url(#noTassel)', stroke: INK, strokeWidth: 4, strokeLinejoin: 'round' }),
    path(strands, { fill: 'none', stroke: INK, strokeOpacity: 0.7, strokeWidth: 2.5, strokeLinecap: 'round' }),
    path(`M${P(x - fw * 0.8, top + len - 12)}Q${P(x, top + len + 4, x + fw * 0.8, top + len - 12)}`, { fill: 'none', stroke: CY, strokeWidth: 3.5, strokeLinecap: 'round' }),
    path(rr(x - bw - 3, top - 4, bw * 2 + 6, 16, 6), { fill: RED, stroke: INK, strokeWidth: 3 }),
    path(circle(x, y + w * 0.3, w * 0.45), { fill: 'url(#noBead)', stroke: INK, strokeWidth: 4 }),
    path(`M${P(x - w * 0.3, y + w * 0.2)}A${P(w * 0.36, w * 0.36)} 0 0 1 ${P(x + w * 0.05, y - w * 0.08)}`, { fill: 'none', stroke: CY, strokeOpacity: 0.85, strokeWidth: 3, strokeLinecap: 'round' }));
}

/** Zigzag paper streamer (a folded ribbon) hanging from (x, y). */
function shide(x, y, h = 24, o = 13) {
  const d = `M${x} ${y}V${y + h}L${x + o} ${y + h + 7}V${y + 2 * h}L${x} ${y + 2 * h + 7}V${y + 3 * h}L${x + o} ${y + 3 * h + 7}V${y + 4 * h}`;
  return glowStroke(d, CY, 14, [[2.6, 0.05], [1.8, 0.1]], { strokeLinecap: 'butt', strokeLinejoin: 'miter' })
    + path(d, { fill: 'none', stroke: INK, strokeWidth: 22, strokeLinejoin: 'miter' })
    + path(d, { fill: 'none', stroke: 'url(#noPaper)', strokeWidth: 15, strokeLinejoin: 'miter' })
    + path(`M${x - 4} ${y + 4}V${y + h - 2}M${x + o - 4} ${y + 2 * h + 10}V${y + 3 * h - 2}`, { stroke: '#fff', strokeWidth: 3, strokeLinecap: 'round' });
}

/** Earring: hook ring, brass bar charm, three lacquer beads with red spacers and a tassel. */
function earring(x, y) {
  const bead = (cy, r) => path(circle(x, cy, r), { fill: 'url(#noBead)', stroke: INK, strokeWidth: 4 })
    + path(`M${P(x - r * 0.72, cy - r * 0.1)}A${P(r * 0.76, r * 0.76)} 0 0 1 ${P(x - r * 0.1, cy - r * 0.74)}`, { fill: 'none', stroke: CY, strokeWidth: n(Math.max(2.5, r * 0.12)), strokeLinecap: 'round' })
    + path(ellipse(x + r * 0.34, cy - r * 0.42, r * 0.16, r * 0.1), { fill: '#fff', fillOpacity: 0.8 });
  const spacer = (cy) => path(ellipse(x, cy, 11, 7), { fill: RED, stroke: INK, strokeWidth: 3 });
  return g({ class: 'no-sway2' },
    path(circle(x, y + 18, 15), { fill: 'none', stroke: INK, strokeWidth: 9 }),
    path(circle(x, y + 18, 15), { fill: 'none', stroke: 'url(#noBrass)', strokeWidth: 5 }),
    path(`M${x} ${y + 33}V${y + 70}`, { stroke: INK, strokeWidth: 7 }), path(`M${x} ${y + 33}V${y + 70}`, { stroke: '#c9a24a', strokeWidth: 3 }),
    path(circle(x, y + 82, 17), { fill: 'url(#noBrassR)', stroke: INK, strokeWidth: 3.5 }),
    path(`M${x - 17} ${y + 84}H${x + 17}`, { stroke: INK, strokeOpacity: 0.6, strokeWidth: 2.5 }),
    path(`M${x} ${y + 88}V${y + 99}`, { stroke: INK, strokeWidth: 3.5, strokeLinecap: 'round' }),
    path(circle(x - 6, y + 75, 4), { fill: '#fff', fillOpacity: 0.85 }),
    spacer(y + 106), bead(y + 132, 24), spacer(y + 164), bead(y + 206, 34), spacer(y + 248), bead(y + 280, 24),
    tassel(x, y + 300, 150, 40, null));
}

/** Tall horn of cyan light rising from behind the top beam. s = -1 left, 1 right. */
function horn(s) {
  const m = (x) => n(CX + s * (x - CX));
  const outer = [[508, 262], [492, 160], [452, 64], [372, -24]], inner = [[652, 262], [604, 140], [500, 40], [372, -24]];
  const bez = (c, t) => { const u = 1 - t; return [0, 1].map((k) => u * u * u * c[0][k] + 3 * u * u * t * c[1][k] + 3 * u * t * t * c[2][k] + t * t * t * c[3][k]); };
  const d = `M${m(508)} 262C${m(492)} 160 ${m(452)} 64 ${m(372)} -24C${m(500)} 40 ${m(604)} 140 ${m(652)} 262Z`;
  const spine = `M${m(580)} 252C${m(560)} 170 ${m(508)} 80 ${m(386)} -12`;
  let rings = '';
  for (const t of [0.16, 0.32, 0.48, 0.63, 0.77]) {
    const [x1, y1] = bez(outer, t), [x2, y2] = bez(inner, t), w = 1 - t * 0.8;
    rings += `M${m(x1)} ${n(y1)}Q${m((x1 + x2) / 2)} ${n((y1 + y2) / 2 + 16 * w)} ${m(x2)} ${n(y2)}`;
  }
  return g({},
    g({ class: 'no-breathe' }, glowStroke(spine, CY, 40, [[2.6, 0.05], [2, 0.08], [1.5, 0.12]])),
    path(d, { fill: 'url(#noHorn)', stroke: INK, strokeWidth: 6, strokeLinejoin: 'round' }),
    path(rings, { fill: 'none', stroke: '#0b6f72', strokeOpacity: 0.5, strokeWidth: 5, strokeLinecap: 'round' }),
    path(`M${m(528)} 240C${m(518)} 170 ${m(488)} 96 ${m(414)} 18`, { fill: 'none', stroke: '#fff', strokeOpacity: 0.85, strokeWidth: 8, strokeLinecap: 'round' }),
    path(`M${m(612)} 210C${m(590)} 150 ${m(560)} 110 ${m(520)} 76`, { fill: 'none', stroke: '#0b6f72', strokeOpacity: 0.35, strokeWidth: 10, strokeLinecap: 'round' }),
    path(d, { fill: 'none', stroke: '#c9fffb', strokeOpacity: 0.6, strokeWidth: 2 }));
}

function pillar(x) {
  const w = 90, y0 = 292, y1 = 1236;
  const grain = [];
  for (const k of [0.25, 0.5, 0.72]) grain.push(`M${n(x + w * k)} ${y0 + 20}C${n(x + w * k - 6)} ${y0 + 300} ${n(x + w * k + 6)} ${y0 + 600} ${n(x + w * k)} ${y1 - 40}`);
  const band = (y) => path(rr(x - 6, y, w + 12, 30, 6), { fill: 'url(#noIron)', stroke: INK, strokeWidth: 3 })
    + path(`${circle(x + 12, y + 15, 4)}${circle(x + w - 12, y + 15, 4)}`, { fill: CY, stroke: INK, strokeWidth: 1.5 });
  return g({},
    path(rr(x, y0, w, y1 - y0, 8), { fill: 'url(#noWood)', stroke: INK, strokeWidth: 5 }),
    path(grain.join(''), { fill: 'none', stroke: '#3c5560', strokeOpacity: 0.55, strokeWidth: 2.5 }),
    path(`M${x + 8} ${y0 + 10}V${y1 - 10}`, { stroke: CY, strokeOpacity: 0.75, strokeWidth: 3, strokeLinecap: 'round' }),
    band(470), band(1040),
    // pillar foot cap
    path(rr(x - 16, y1 - 50, w + 32, 64, 10), { fill: 'url(#noIron)', stroke: INK, strokeWidth: 4 }),
    path(`M${x - 8} ${y1 - 40}H${x + w + 8}`, { stroke: CY, strokeOpacity: 0.6, strokeWidth: 2.5, strokeLinecap: 'round' }));
}

function beams() {
  const nukiY = 384;
  return g({},
    // tie beam passing through the pillars, with wedges on the protruding ends
    path(rr(124, nukiY, 1452, 44, 4), { fill: 'url(#noWood)', stroke: INK, strokeWidth: 5 }),
    path(`M130 ${nukiY + 8}H1570`, { stroke: '#4a6a76', strokeOpacity: 0.6, strokeWidth: 3 }),
    path(rr(296, 280, 1108, 38, 4), { fill: 'url(#noWood)', stroke: INK, strokeWidth: 5 }),
    path('M300 290H1400', { stroke: CY, strokeOpacity: 0.45, strokeWidth: 2.5 }),
    path(KASAGI_D, { fill: 'url(#noKasagi)', stroke: INK, strokeWidth: 6, strokeLinejoin: 'round' }),
    path('M112 190C300 238 600 250 850 250C1100 250 1400 238 1588 190', { fill: 'none', stroke: CY, strokeOpacity: 0.9, strokeWidth: 4, strokeLinecap: 'round' }),
    path('M140 214C320 254 600 266 850 266C1100 266 1380 254 1560 214', { fill: 'none', stroke: RED, strokeOpacity: 0.85, strokeWidth: 3, strokeLinecap: 'round' }),
    // caps on the upturned tips
    path('M96 178L80 170L84 196L108 230Z', { fill: 'url(#noIron)', stroke: INK, strokeWidth: 4, strokeLinejoin: 'round' }),
    path('M1604 178L1620 170L1616 196L1592 230Z', { fill: 'url(#noIron)', stroke: INK, strokeWidth: 4, strokeLinejoin: 'round' }));
}

function housing() {
  const h = HOUSE, holeD = rr(hole.x, hole.y, hole.w, hole.h, radius);
  const traces = ['M326 660V444L364 406H520', 'M1374 660V444L1336 406H1180', 'M326 880V1062L362 1098H540', 'M1374 880V1062L1338 1098H1160',
    'M352 560V470L380 442H470', 'M1348 560V470L1320 442H1230'];
  const nodes = [[326, 660], [520, 406], [1374, 660], [1180, 406], [326, 880], [540, 1098], [1374, 880], [1160, 1098], [352, 560], [470, 442], [1348, 560], [1230, 442]];
  const eye = (s) => {
    const m = (x) => CX + s * (x - CX);
    const slit = poly([[m(622), 400], [m(798), 430], [m(792), 450], [m(632), 426]]);
    const brow = `M${m(600)} 382L${m(806)} 414L${m(800)} 398L${m(612)} 362Z`;
    const line = `M${m(636)} 412L${m(786)} 438`;
    return g({},
      path(brow, { fill: 'url(#noIron)', stroke: INK, strokeWidth: 4, strokeLinejoin: 'round' }),
      path(`M${m(612)} 364L${m(800)} 398`, { stroke: CY, strokeOpacity: 0.6, strokeWidth: 2.5, strokeLinecap: 'round' }),
      g({ class: 'no-flicker' },
        glowStroke(line, RED, 14, [[5, 0.06], [3.2, 0.12], [2, 0.2]]),
        path(slit, { fill: 'url(#noEye)', stroke: '#5a0010', strokeWidth: 3, strokeLinejoin: 'round' }),
        path(line, { stroke: '#fff2f3', strokeWidth: 4, strokeLinecap: 'round' })));
  };
  const fang = (x) => {
    const d = `M${x - 20} 1104Q${x - 14} 1072 ${x} 1050Q${x + 14} 1072 ${x + 20} 1104Z`;
    return glowStroke(`M${x} 1100L${x} 1060`, CY, 12, [[4, 0.06], [2.6, 0.12]])
      + path(d, { fill: 'url(#noFang)', stroke: INK, strokeWidth: 4, strokeLinejoin: 'round' })
      + path(`M${x - 8} 1094Q${x - 6} 1074 ${x} 1062`, { fill: 'none', stroke: '#fff', strokeWidth: 3, strokeLinecap: 'round' });
  };
  return g({},
    path(rr(h.x + 8, h.y + 14, h.w, h.h, h.r), { fill: '#000', fillOpacity: 0.35 }),
    path(rr(h.x, h.y, h.w, h.h, h.r), { fill: 'url(#noLacquer)', stroke: INK, strokeWidth: 6 }),
    path(rr(h.x + 14, h.y + 14, h.w - 28, h.h - 28, h.r - 12), { fill: 'none', stroke: RED, strokeOpacity: 0.8, strokeWidth: 3 }),
    path(traces.join(''), { fill: 'none', stroke: CY, strokeOpacity: 0.4, strokeWidth: 3, strokeLinecap: 'round', strokeLinejoin: 'round' }),
    path(nodes.map(([x, y]) => circle(x, y, 5)).join(''), { fill: '#0a1a20', stroke: CY, strokeOpacity: 0.8, strokeWidth: 2.5 }),
    path(`M${h.x + 30} ${h.y + 230}V${h.y + 96}Q${h.x + 30} ${h.y + 30} ${h.x + 96} ${h.y + 30}H${h.x + 300}`, { fill: 'none', stroke: '#bff', strokeOpacity: 0.28, strokeWidth: 8, strokeLinecap: 'round' }),
    eye(-1), eye(1),
    // calm inner bezel: black glass and one thin cyan line
    path(rr(hole.x - 30, hole.y - 30, hole.w + 60, hole.h + 60, radius + 24), { fill: '#04090c', stroke: '#1e3a44', strokeWidth: 3 }),
    path(rr(hole.x - 16, hole.y - 16, hole.w + 32, hole.h + 32, radius + 12), { fill: 'none', stroke: CY, strokeOpacity: 0.5, strokeWidth: 2 }),
    lip(holeD, '#000', [[7, 0.3], [3, 0.6]]),
    // grin + fangs on the lower lip
    glowStroke('M590 1112Q850 1134 1110 1112', RED, 4, [[5, 0.06], [3, 0.12], [1, 0.9]]),
    fang(720), fang(980));
}

/** Seigaiha wave scales clipped to a band (faint cyan lines on black lacquer). */
function waves(clipId, x0, x1, y0, y1, R = 22) {
  let out = '';
  for (let r = 0, y = y0; y <= y1 + R; r++, y += R * 0.5) {
    let fills = '', arcs = '';
    for (let x = x0 - (r % 2 ? R : 0); x <= x1 + R; x += R * 2) {
      fills += `M${n(x - R)} ${n(y)}A${R} ${R} 0 0 1 ${n(x + R)} ${n(y)}Z`;
      arcs += [1, 0.68, 0.36].map((k) => `M${n(x - R * k)} ${n(y)}A${n(R * k)} ${n(R * k)} 0 0 1 ${n(x + R * k)} ${n(y)}`).join('');
    }
    out += path(fills, { fill: '#08171d' }) + path(arcs, { fill: 'none', stroke: CY, strokeOpacity: 0.28, strokeWidth: 2 });
  }
  return g({ clipPath: `url(#${clipId})` }, out);
}

function plinth() {
  return g({},
    path(ellipse(CX, 1268, 760, 26), { fill: 'url(#noFloor)' }),
    path(rr(176, 1176, 1348, 62, 12), { fill: 'url(#noLacquer)', stroke: INK, strokeWidth: 5 }),
    waves('noStepClip', 190, 1510, 1196, 1236),
    path(rr(176, 1176, 1348, 62, 12), { fill: 'none', stroke: INK, strokeWidth: 5 }),
    path('M194 1184H1506', { stroke: CY, strokeOpacity: 0.8, strokeWidth: 3, strokeLinecap: 'round' }),
    path(rr(250, 1124, 1200, 58, 10), { fill: 'url(#noLacquer)', stroke: INK, strokeWidth: 5 }),
    path('M268 1132H1432', { stroke: CY, strokeOpacity: 0.9, strokeWidth: 3, strokeLinecap: 'round' }),
    path('M268 1172H1432', { stroke: RED, strokeOpacity: 0.6, strokeWidth: 2.5, strokeLinecap: 'round' }),
    '');
}

/** Spirit flame (hitodama): a glowing round head with a curling tail. */
function wisp(x, y, s, cls) {
  const k = (v) => n(v * s);
  const d = `M${x - k(22)} ${y + k(4)}C${x - k(26)} ${y - k(30)} ${x - k(12)} ${y - k(58)} ${x + k(30)} ${y - k(84)}C${x + k(14)} ${y - k(50)} ${x + k(28)} ${y - k(30)} ${x + k(22)} ${y + k(4)}`
    + `A${k(22)} ${k(22)} 0 0 1 ${x - k(22)} ${y + k(4)}Z`;
  return g({ class: cls },
    path(circle(x, y - k(10), k(56)), { fill: 'url(#noWispGlow)' }),
    path(d, { fill: 'url(#noWisp)', stroke: '#0b6f72', strokeWidth: 2.5, strokeLinejoin: 'round' }),
    path(ellipse(x - k(5), y + k(2), k(9), k(10)), { fill: '#fff', fillOpacity: 0.9 }),
    path(`M${x - k(12)} ${y - k(18)}C${x - k(12)} ${y - k(36)} ${x - k(2)} ${y - k(54)} ${x + k(12)} ${y - k(68)}`, { fill: 'none', stroke: '#fff', strokeOpacity: 0.7, strokeWidth: k(3), strokeLinecap: 'round' }));
}

function draw() {
  const defs = [
    '<style>.no-breathe{animation:noBreathe 3.6s ease-in-out infinite}@keyframes noBreathe{0%,100%{opacity:1}50%{opacity:.45}}'
      + '.no-flicker{animation:noFlick 6s steps(1) infinite}@keyframes noFlick{0%,88%,92%,100%{opacity:1}89%,91%{opacity:.25}}'
      + '.no-sway,.no-sway2{transform-box:fill-box;transform-origin:50% 0;animation:noSway 4s ease-in-out infinite alternate}.no-sway2{animation-duration:5.2s}'
      + '@keyframes noSway{from{transform:rotate(-2.5deg)}to{transform:rotate(2.5deg)}}'
      + '.no-wisp{animation:noWisp 4.4s ease-in-out infinite alternate}.no-wisp2{animation:noWisp 5.6s ease-in-out infinite alternate-reverse}'
      + '@keyframes noWisp{from{transform:translateY(10px);opacity:.75}to{transform:translateY(-14px);opacity:1}}'
      + '@media (prefers-reduced-motion:reduce){*{animation:none!important}}</style>',
    lg('noHorn', [0, 1, 0, 0], [[0, '#0f8a8a'], [0.35, '#2fe6d8'], [0.75, '#9ffff6'], [1, '#f2fffe']]),
    lg('noLacquer', [0, 0, 0.3, 1], [[0, '#173f4c'], [0.4, '#0d2a35'], [1, '#061820']]),
    lg('noWood', [0, 0, 1, 0], [[0, '#22343c'], [0.5, '#15232a'], [1, '#0b161b']]),
    lg('noKasagi', [0, 0, 0, 1], [[0, '#2a4550'], [0.5, '#152831'], [1, '#08141a']]),
    lg('noIron', [0, 0, 0, 1], [[0, '#3c5560'], [1, '#14222a']]),
    lg('noEye', [0, 0, 0, 1], [[0, '#ff8a96'], [0.5, RED], [1, '#b0001c']]),
    lg('noFang', [0, 0, 0, 1], [[0, '#f2fffe'], [0.6, '#9ffff6'], [1, '#2fe6d8']]),
    lg('noPaper', [0, 0, 1, 0], [[0, '#ffffff'], [1, '#bff5ef']]),
    rg('noBead', [0.38, 0.32, 0.8], [[0, '#3a5560'], [0.55, '#14232a'], [1, '#03090c']]),
    lg('noBrass', [0, 0, 0, 1], [[0, '#ffe7a6'], [0.5, '#c9a24a'], [1, '#7a5a1c']]),
    rg('noBrassR', [0.38, 0.32, 0.8], [[0, '#fff3c8'], [0.5, '#d9b354'], [1, '#6e4f16']]),
    lg('noTassel', [0, 0, 0, 1], [[0, '#1d2c34'], [0.75, '#0c161b'], [1, '#0b3c40']]),
    rg('noWisp', [0.45, 0.75, 0.75], [[0, '#ffffff'], [0.4, '#9ffff6'], [1, '#22c9c0']]),
    rg('noWispGlow', [0.5, 0.5, 0.5], [[0, CY, 0.36], [1, CY, 0]]),
    rg('noAura', [0.5, 0.5, 0.5], [[0, CY, 0.22], [0.6, '#1fb5c9', 0.08], [1, '#1fb5c9', 0]]),
    rg('noFloor', [0.5, 0.5, 0.5], [[0, '#000', 0.4], [1, '#000', 0]]),
    `<clipPath id="noStepClip"><path d="${rr(179, 1186, 1342, 49, 10)}"/></clipPath>`,
  ].join('');

  const rnd = (() => { let s = 9; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();
  const motes = [];
  for (let i = 0; i < 34; i++) {
    const x = 30 + rnd() * 1640, y = 20 + rnd() * 1240;
    if (x > 100 && x < 1600 && y > 150 && y < 1250) continue;
    motes.push(i % 5 ? circle(x, y, 2 + rnd() * 2.5) : sparkle(x, y, 8 + rnd() * 6));
  }

  const body = [`<g transform="translate(0 ${DY})">`,
    path(ellipse(CX, 130, 640, 210), { fill: 'url(#noAura)' }),
    path(motes.join(''), { fill: CY, fillOpacity: 0.75 }),
    wisp(66, 600, 1.1, 'no-wisp'), wisp(1630, 560, 0.95, 'no-wisp2'), wisp(1640, 1080, 0.8, 'no-wisp'), wisp(58, 1060, 0.85, 'no-wisp2'),
    horn(-1), horn(1),
    plinth(),
    pillar(204), pillar(1406),
    beams(),
    housing(),
    // shimenawa swags, streamers and tassels across the top
    rope([248, 330], [550, 424], [850, 342], 30), rope([850, 342], [1150, 424], [1452, 330], 30),
    shide(424, 372), shide(1262, 372),
    tassel(248, 318, 120, 44), tassel(1452, 318, 120, 44), tassel(850, 330, 96, 46),
    earring(150, 412), earring(1550, 412),
  '</g>'].join('\n');
  return { defs, body };
}

module.exports = {
  W, H, hole: { ...hole, y: hole.y + DY }, radius, draw,
  meta: {
    name: 'Neon Oni', theme: 'cyberpunk', rarity: 'legendary', translucent: false, collection: 'sci-fi-signals', license: 'CC-BY-4.0',
    desc: 'A neon shrine monitor with glowing horns and red LED eyes keeps watch over your game from under its braided rope.',
    tags: ['cyberpunk', 'oni', 'shrine', 'neon', 'horror', 'japan'],
  },
};
