'use strict';
// Deco Noir: a jazz-age proscenium in black and cinnabar lacquer with gold. A great half-sun of alternating red
// and black lacquer rays rises behind a setback skyscraper whose stacked sunburst arches and needle spire are the
// focal point; stepped towers fall away on either side to fluted pylons with gold spires, and two searchlights
// cross the night sky behind. The cabinet carries a red-and-gold harlequin marquetry field and a gold-studded
// cinnabar band; inside it a stepped gold molding and a plain black mat keep the picture calm. An inverted
// half-sun hangs from the stepped plinth.
const L = require('../lib');
const { rr, path, g, lg, rg, circle, poly, tf, n, P } = L;

const W = 1760, H = 1450;
const hole = { x: 368, y: 566, w: 1024, h: 576 }, radius = 0;
const CX = W / 2, CY = hole.y + hole.h / 2;
const B = { x: 168, y: 400, w: 1424, h: 912 }; // the lacquer cabinet
const FY = B.y + 4, FR = 396; // half-sun centre line and radius
const INK = '#120a05';
const rad = (a) => (a * Math.PI) / 180;
const pol = (cx, cy, r, a) => [cx + r * Math.cos(rad(a)), cy + r * Math.sin(rad(a))];

/** Rectangle whose corners are cut by a staircase of k steps of size s (Deco notch). */
function stepRect(x, y, w, h, s, k) {
  const tl = [];
  for (let i = 0; i < k; i++) tl.push([i * s, (k - i) * s], [(i + 1) * s, (k - i) * s]);
  tl.push([k * s, 0]);
  const tr = tl.map(([a, b]) => [w - a, b]).reverse();
  const br = tl.map(([a, b]) => [w - a, h - b]);
  const bl = tl.map(([a, b]) => [a, h - b]).reverse();
  return poly([...tl, ...tr, ...br, ...bl].map(([a, b]) => [x + a, y + b]));
}
const grow = (e) => [hole.x - e, hole.y - e, hole.w + 2 * e, hole.h + 2 * e];

/** Annular wedge between radii r0..r1 and angles a0..a1 (degrees, clockwise in screen space). */
function wedge(cx, cy, r0, r1, a0, a1) {
  return `M${P(...pol(cx, cy, r0, a0))}L${P(...pol(cx, cy, r1, a0))}A${P(r1, r1)} 0 0 1 ${P(...pol(cx, cy, r1, a1))}`
    + `L${P(...pol(cx, cy, r0, a1))}${r0 > 0 ? `A${P(r0, r0)} 0 0 0 ${P(...pol(cx, cy, r0, a0))}` : ''}Z`;
}

/** A sun of alternating red and black lacquer rays between angles a0..a1, with gold rings and studs. */
function sun(cx, cy, R, a0, a1, k, { rings = true } = {}) {
  const step = (a1 - a0) / (2 * k);
  let red = '', black = '', lines = '', studs = '';
  for (let i = 0; i < 2 * k; i++) {
    const d = wedge(cx, cy, R * 0.16, R - 22, a0 + i * step, a0 + (i + 1) * step);
    if (i % 2) black += d; else red += d;
    lines += `M${P(...pol(cx, cy, R * 0.16, a0 + i * step))}L${P(...pol(cx, cy, R - 22, a0 + i * step))}`;
  }
  for (let a = a0 + step / 2; a < a1; a += step) studs += circle(...pol(cx, cy, R - 11, a), R > 200 ? 3.6 : 2.4);
  const half = (r) => `M${P(...pol(cx, cy, r, a0))}A${P(r, r)} 0 0 1 ${P(...pol(cx, cy, r, a1))}`;
  return g({},
    path(wedge(cx, cy, 0, R, a0, a1), { fill: '#070506', stroke: 'url(#dnGoldD)', strokeWidth: 10 }),
    path(red, { fill: 'url(#dnRayR)' }), path(black, { fill: 'url(#dnRayK)' }),
    path(lines, { stroke: 'url(#dnGoldD)', strokeWidth: 1.6, strokeOpacity: 0.85 }),
    rings ? path(half(R * 0.42) + half(R * 0.7), { fill: 'none', stroke: 'url(#dnGoldD)', strokeWidth: 3, strokeOpacity: 0.9 }) : '',
    rings ? path(half(R * 0.42 + 8) + half(R * 0.7 + 8), { fill: 'none', stroke: '#f4d48a', strokeWidth: 1, strokeOpacity: 0.5 }) : '',
    path(half(R - 22), { fill: 'none', stroke: 'url(#dnGoldD)', strokeWidth: 4 }),
    path(studs, { fill: 'url(#dnGoldV)' }),
    path(wedge(cx, cy, 0, R * 0.16, a0, a1), { fill: 'url(#dnGoldD)', stroke: INK, strokeWidth: 1.4 }),
    path(wedge(cx, cy, 0, R * 0.1, a0, a1), { fill: 'url(#dnRedV)', stroke: INK, strokeWidth: 1.2 }));
}

/** Cinnabar cabochon in a stepped gold bezel. */
function cabochon(x, y, r) {
  return path(circle(x + 2, y + 3, r + 7), { fill: '#000', fillOpacity: 0.35 })
    + path(stepRect(x - r - 8, y - r - 8, 2 * r + 16, 2 * r + 16, (r + 8) * 0.28, 2), { fill: 'url(#dnGoldD)', stroke: INK, strokeWidth: 1.4 })
    + path(circle(x, y, r), { fill: 'url(#dnRuby)', stroke: '#2a0004', strokeWidth: 1.5 })
    + path(L.ellipse(x - r * 0.3, y - r * 0.38, r * 0.36, r * 0.2), { fill: '#fff0e4', fillOpacity: 0.7 });
}

/** The skyscraper: three setback tiers, then five stacked sunburst arches and a needle spire. */
function skyscraper() {
  const tiers = [[204, 104], [160, 92], [118, 80]];
  let y = FY, out = '', bands = '', wins = '', gars = '';
  for (const [w, h] of tiers) {
    const x0 = CX - w / 2;
    out += path(rr(x0 + 8, y - h + 6, w, h, 0), { fill: '#000', fillOpacity: 0.35 })
      + path(rr(x0, y - h, w, h, 0), { fill: 'url(#dnTower)', stroke: 'url(#dnGoldD)', strokeWidth: 3 });
    bands += rr(x0 - 4, y - h - 6, w + 8, 10, 0);
    for (let x = x0 + 16; x < x0 + w - 18; x += 18) wins += rr(x, y - h + 14, 7, h - 24, 1);
    // gold gargoyles jutting from the setback corners
    gars += poly([[x0 - 4, y - h - 1], [x0 - 26, y - h + 10], [x0 - 4, y - h + 12]]) + poly([[x0 + w + 4, y - h - 1], [x0 + w + 26, y - h + 10], [x0 + w + 4, y - h + 12]]);
    y -= h;
  }
  const top = y;
  let arches = '';
  const R = [56, 46, 36, 26, 16];
  for (let i = 0; i < R.length; i++) {
    const cy = top - i * 22, r = R[i];
    let tri = '';
    for (let a = 198; a <= 342; a += 18) tri += poly([pol(CX, cy, r - 4, a), pol(CX, cy, r - 16, a - 5), pol(CX, cy, r - 16, a + 5)]);
    arches += path(wedge(CX, cy, 0, r, 180, 360), { fill: '#0a0708', stroke: 'url(#dnGoldV)', strokeWidth: 4 })
      + path(tri, { fill: 'url(#dnRedV)', stroke: '#f4d48a', strokeWidth: 0.8, strokeOpacity: 0.7 });
  }
  const tipY = top - 4 * 22 - 16;
  return g({},
    out,
    path(wins, { fill: 'url(#dnWin)' }),
    path(bands, { fill: 'url(#dnGoldV)', stroke: INK, strokeWidth: 1.2 }),
    path(gars, { fill: 'url(#dnGoldD)', stroke: INK, strokeWidth: 1 }),
    arches,
    path(poly([[CX - 7, tipY + 4], [CX, 16], [CX + 7, tipY + 4]]), { fill: 'url(#dnGoldV)', stroke: INK, strokeWidth: 1.2 }),
    path(`M${CX - 1.5} ${tipY}L${CX} 22`, { stroke: '#fff6d8', strokeWidth: 1.2, strokeOpacity: 0.8 }),
    path(L.sparkle(CX, 18, 16, 0.08), { fill: '#fff4cc', fillOpacity: 0.9 }));
}

/** A stepped side tower standing on the cabinet's top edge. */
function tower(cx, w, top, spire = 0) {
  const h = FY - top, k = 2, tierH = h / (k + 1);
  let d = '', bands = '', wins = '';
  for (let i = 0; i <= k; i++) {
    const ww = w - i * w * 0.24, x0 = cx - ww / 2, yb = FY - i * tierH;
    d += path(rr(x0, yb - tierH, ww, tierH + 1, 0), { fill: 'url(#dnTower)', stroke: 'url(#dnGoldD)', strokeWidth: 2.4 });
    bands += rr(x0 - 3, yb - tierH - 4, ww + 6, 7, 0);
    for (let x = x0 + 10; x < x0 + ww - 12; x += 14) wins += rr(x, yb - tierH + 10, 5, tierH - 18, 1);
  }
  const tw = w - k * w * 0.24;
  return g({},
    path(rr(cx - w / 2 + 8, top + 8, w, h, 0), { fill: '#000', fillOpacity: 0.3 }),
    d, path(wins, { fill: 'url(#dnWin)' }), path(bands, { fill: 'url(#dnGoldV)', stroke: INK, strokeWidth: 1 }),
    spire ? path(poly([[cx - tw * 0.3, top - 4], [cx, top - spire], [cx + tw * 0.3, top - 4]]), { fill: 'url(#dnGoldV)', stroke: INK, strokeWidth: 1.2 }) : '');
}

/** Fluted pylon with red lacquer flutes, gold capital and a stepped spire. */
function pylon(x) {
  const w = 128, y0 = 360, y1 = 1360;
  let flutes = '';
  for (let i = 0; i < 3; i++) flutes += rr(x - 46 + i * 32, y0 + 34, 28, y1 - y0 - 68, 14);
  const cap = [[w + 36, 24], [w + 18, 20], [w + 4, 18]];
  let caps = '', y = y0;
  for (const [cw, ch] of cap) { caps += rr(x - cw / 2, y - ch, cw, ch, 0); y -= ch; }
  const spire = [[104, 42], [78, 38], [52, 34], [30, 30]];
  let sp = '', wins = '', sy = y;
  for (const [sw, sh] of spire) { sp += rr(x - sw / 2, sy - sh, sw, sh, 0); wins += rr(x - 3, sy - sh + 8, 6, sh - 16, 1); sy -= sh; }
  const plinth = [[w + 40, 30], [w + 20, 24]];
  let pl = '', py = y1;
  for (const [cw, ch] of plinth) { pl += rr(x - cw / 2, py, cw, ch, 0); py += ch; }
  return g({},
    path(rr(x - w / 2 + 10, sy + 10, w, py - sy, 0), { fill: '#000', fillOpacity: 0.35 }),
    path(sp, { fill: 'url(#dnTower)', stroke: 'url(#dnGoldD)', strokeWidth: 3 }), path(wins, { fill: 'url(#dnWin)' }),
    path(poly([[x - 8, sy], [x, sy - 92], [x + 8, sy]]), { fill: 'url(#dnGoldV)', stroke: INK, strokeWidth: 1.2 }),
    g({ transform: tf(x, y) }, sun(0, 0, 40, 180, 360, 6, { rings: false })),
    path(rr(x - w / 2, y0, w, y1 - y0, 0), { fill: 'url(#dnLacquerH)', stroke: 'url(#dnGoldD)', strokeWidth: 5 }),
    path(flutes, { fill: 'url(#dnRedH)', stroke: 'url(#dnGoldD)', strokeWidth: 2 }),
    path(`M${x - 32} ${y0 + 40}V${y1 - 40}M${x} ${y0 + 40}V${y1 - 40}M${x + 32} ${y0 + 40}V${y1 - 40}`, { stroke: '#ffb0a0', strokeOpacity: 0.25, strokeWidth: 2 }),
    path(caps, { fill: 'url(#dnGoldV)', stroke: INK, strokeWidth: 1.4 }),
    path(pl, { fill: 'url(#dnGoldV)', stroke: INK, strokeWidth: 1.4 }),
    path(rr(x - w / 2 - 2, y1 - 30, w + 4, 30, 0), { fill: '#0b0809', stroke: 'url(#dnGoldD)', strokeWidth: 3 }),
    path([0, 1].map((i) => `M${x - 40} ${y1 - 24 + i * 10}L${x} ${y1 - 14 + i * 10}L${x + 40} ${y1 - 24 + i * 10}`).join(''), { fill: 'none', stroke: 'url(#dnGoldD)', strokeWidth: 2.4 }),
    cabochon(x, CY, 20));
}

/** Searchlight beam from (x0, y0) toward angle a (degrees), fading out. */
function beam(x0, y0, a, len, spread, id) {
  const p1 = pol(x0, y0, len, a - spread), p2 = pol(x0, y0, len, a + spread);
  return path(poly([[x0 - 6, y0], p1, p2, [x0 + 6, y0]]), { fill: `url(#${id})` });
}

function draw() {
  const holeD = rr(hole.x, hole.y, hole.w, hole.h, radius);
  const bodyD = stepRect(B.x, B.y, B.w, B.h, 18, 2);
  const defs = [
    lg('dnGoldV', [0, 0, 0, 1], [[0, '#fff2c4'], [0.18, '#e2b85a'], [0.34, '#f7dc92'], [0.52, '#a87a2c'], [0.7, '#e9c46e'], [0.86, '#8e621f'], [1, '#5a3c0e']]),
    lg('dnGoldD', [0, 0, 1, 1], [[0, '#fbe6a6'], [0.35, '#d4a64a'], [0.6, '#f4d68a'], [1, '#8a5e1e']]),
    lg('dnGoldT', [0, 0, 1, 0], [[0, '#a87a2c'], [0.5, '#f7dc92'], [1, '#a87a2c']]),
    lg('dnRedV', [0, 0, 0, 1], [[0, '#ff6a4a'], [0.4, '#d01e22'], [1, '#6a060c']]),
    lg('dnRedH', [0, 0, 1, 0], [[0, '#4a0408'], [0.3, '#b4121a'], [0.52, '#e0402c'], [0.7, '#b4121a'], [1, '#3a0306']]),
    lg('dnRedBand', [0, 0, 1, 1], [[0, '#e8301e'], [0.45, '#9a0c14'], [0.55, '#c8161c'], [1, '#5a050a']]),
    rg('dnRayR', [CX, FY, FR, CX, FY], [[0.1, '#ffa050'], [0.3, '#f0401e'], [0.7, '#b0101a'], [1, '#5c040a']], true),
    rg('dnRayK', [CX, FY, FR, CX, FY], [[0.1, '#2a1410'], [0.6, '#0c0809'], [1, '#050405']], true),
    rg('dnRuby', [0.38, 0.32, 0.75], [[0, '#ffd0c0'], [0.3, '#ff3a2a'], [0.7, '#9a0612'], [1, '#3a0004']]),
    lg('dnTower', [0, 0, 1, 0], [[0, '#050405'], [0.3, '#1e1618'], [0.5, '#2a2023'], [0.7, '#120d0e'], [1, '#040304']]),
    lg('dnWin', [0, 0, 0, 1], [[0, '#ffc070'], [0.25, '#e0381e'], [1, '#4a0408']]),
    lg('dnLacquerH', [0, 0, 1, 0], [[0, '#050405'], [0.35, '#1d1719'], [0.5, '#2a2124'], [0.65, '#140f10'], [1, '#040304']]),
    lg('dnBody', [0, 0, 1, 1], [[0, '#1e1517'], [0.42, '#0b0809'], [0.5, '#181113'], [0.58, '#090607'], [1, '#040303']]),
    lg('dnMat', [0, 0, 0, 1], [[0, '#120d0e'], [1, '#060405']]),
    rg('dnShade', [0.5, 0.5, 0.62], [[0.5, '#000', 0.55], [1, '#000', 0.1]]),
    rg('dnGlow', [CX, FY, 720, CX, FY], [[0, '#ff4020', 0.38], [0.45, '#c01810', 0.16], [1, '#800808', 0]], true),
    lg('dnBeam', [0, 1, 0, 0], [[0, '#ffe6b0', 0.22], [0.6, '#ffe6b0', 0.07], [1, '#ffe6b0', 0]]),
    lg('dnSheen', [0, 0, 1, 0], [[0, '#fff', 0], [0.5, '#fff', 0.05], [1, '#fff', 0]]),
    // harlequin marquetry: red lacquer diamonds outlined in gold on black, gold pins at the crossings
    '<pattern id="dnMarq" width="56" height="56" patternUnits="userSpaceOnUse" x="' + CX + '" y="' + B.y + '">'
      + '<path d="M0 0H56V56H0Z" fill="#0a0708"/>'
      + '<path d="M28 4L52 28L28 52L4 28Z" fill="#8e0c14" stroke="#d8ae58" stroke-width="1.6"/>'
      + '<path d="M28 15L41 28L28 41L15 28Z" fill="#0a0708" stroke="#d8ae58" stroke-width="1"/>'
      + '<path d="M28 23L33 28L28 33L23 28Z" fill="#e8c46c"/>'
      + '<path d="M0 0L6 0L0 6ZM56 0L50 0L56 6ZM0 56L6 56L0 50ZM56 56L50 56L56 50Z" fill="#c89a48"/>'
      + '<path d="M28 4L52 28" stroke="#ff8060" stroke-opacity="0.35" stroke-width="1"/></pattern>',
  ].join('');

  const sideTowers = [[440, 92, 196, 40], [544, 84, 262, 0], [628, 70, 318, 18]];
  const corners = [grow(124)[0], grow(124)[1], grow(124)[0] + grow(124)[2], grow(124)[1] + grow(124)[3]];
  const [bx, by, bw, bh] = grow(112);
  const body = [
    // night sky: red glow and two crossing searchlights behind the crown (kept faint outside the cabinet)
    path(circle(CX, FY, 720), { fill: 'url(#dnGlow)' }),
    beam(CX - 300, FY, -62, 900, 4, 'dnBeam'), beam(CX + 300, FY, -118, 900, 4, 'dnBeam'),
    beam(CX - 120, FY, -100, 900, 3, 'dnBeam'),
    // wall shadow
    [[16, 0.08], [9, 0.12], [4, 0.18]].map(([e, a]) => path(rr(B.x - e + 10, B.y - e + 16, B.w + 2 * e, B.h + 2 * e + 60, e), { fill: '#000', fillOpacity: a })).join(''),
    // crown: the great half-sun, the side towers, then the skyscraper in front
    sun(CX, FY, FR, 180, 360, 18),
    ...sideTowers.map(([dx, w, top, sp]) => tower(CX - dx, w, top, sp) + tower(CX + dx, w, top, sp)),
    skyscraper(),
    // stepped plinth and the inverted half-sun hanging below the cabinet
    [[1180, 28], [960, 26], [740, 26]].map(([w, h], i) => path(rr(CX - w / 2, B.y + B.h - 2 + i * 26, w, h, 0), { fill: '#0b0809', stroke: 'url(#dnGoldD)', strokeWidth: 3.5 })).join(''),
    sun(CX, B.y + B.h, 116, 0, 180, 7, { rings: false }),
    // the cabinet: marquetry field under a soft shade, gold edge
    path(bodyD, { fill: 'url(#dnMarq)', stroke: 'url(#dnGoldD)', strokeWidth: 8 }),
    path(bodyD, { fill: 'url(#dnShade)' }),
    path(stepRect(B.x + 12, B.y + 12, B.w - 24, B.h - 24, 14, 2), { fill: 'none', stroke: 'url(#dnGoldD)', strokeWidth: 2, strokeOpacity: 0.8 }),
    // cinnabar band with gold studs, stepped gold molding, then the calm black mat
    path(stepRect(...grow(132), 16, 2), { fill: '#000', fillOpacity: 0.4 }),
    path(stepRect(...grow(126), 16, 2), { fill: 'url(#dnRedBand)', stroke: 'url(#dnGoldD)', strokeWidth: 3 }),
    path(stepRect(...grow(115), 14, 2), { fill: 'none', stroke: 'url(#dnGoldV)', strokeWidth: 5, strokeDasharray: '5 23' }),
    path(stepRect(...grow(104), 14, 2), { fill: 'url(#dnGoldD)', stroke: INK, strokeWidth: 1.4 }),
    path(stepRect(...grow(96), 12, 2), { fill: 'url(#dnGoldV)', stroke: INK, strokeWidth: 1 }),
    path(stepRect(...grow(86), 12, 2), { fill: '#5a3c10', stroke: INK, strokeWidth: 1 }),
    path(stepRect(...grow(82), 12, 2), { fill: 'url(#dnGoldD)' }),
    path(rr(...grow(74), 0), { fill: INK }),
    path(rr(...grow(72), 0), { fill: 'url(#dnMat)' }),
    path(poly([[bx + 120, by + 40], [bx + 330, by + 40], [bx + 120, by + bh - 40], [bx + 40, by + bh - 40]]), { fill: 'url(#dnSheen)' }),
    path(rr(...grow(8), 0), { fill: 'none', stroke: '#c8962e', strokeOpacity: 0.9, strokeWidth: 3 }),
    path(rr(...grow(14), 0), { fill: 'none', stroke: '#b4121a', strokeOpacity: 0.7, strokeWidth: 1.4 }),
    L.lip(holeD, '#000', [[6, 0.25], [3, 0.5]]),
    // gold keystone suns centred on each side of the band, and cabochons at the band corners
    g({ transform: tf(CX, hole.y - 126) }, sun(0, 0, 40, 0, 180, 5, { rings: false })),
    g({ transform: tf(CX, hole.y + hole.h + 126) }, sun(0, 0, 40, 180, 360, 5, { rings: false })),
    [[corners[0], corners[1]], [corners[2], corners[1]], [corners[0], corners[3]], [corners[2], corners[3]]].map(([x, y]) => cabochon(x, y, 13)).join(''),
    pylon(150), pylon(W - 150),
    [[CX - 560, 120, 9], [CX + 600, 90, 7], [CX + 250, 60, 6], [CX - 300, 40, 5], [80, 1430, 7]].map(([x, y, r]) => path(L.sparkle(x, y, r, 0.1), { fill: '#fff4cc', fillOpacity: 0.85 })).join(''),
  ].join('\n');
  return { defs, body };
}

module.exports = {
  W, H, hole, radius, draw,
  meta: {
    name: 'Deco Noir', theme: 'art deco', rarity: 'legendary', translucent: false, collection: 'atelier-noir', license: 'CC-BY-4.0',
    desc: 'A jazz-age cabinet in black and cinnabar lacquer and gold: a skyscraper spire rises before a red half-sun, searchlights cross the night and fluted pylons stand guard.',
    tags: ['art deco', 'gold', 'black', 'red', 'lacquer', 'jazz age', 'skyline'],
  },
};
