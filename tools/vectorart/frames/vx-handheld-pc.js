'use strict';
// Handheld Rig: a widescreen gaming handheld PC with a faceted gunmetal-teal body and swept hexagonal
// grip pods wrapped in deep-indigo rubber, edged by cyan-to-magenta RGB strips. The left pod carries a
// round dimpled dial pad, a ribbed scroll wheel and a three-step slider; the right pod has a single
// thumbstick nested inside a crescent of three hex-gem keys and a knurled rotary knob. Chamfered
// shoulder wings, top vents, a status strip with a little bot face and a bot keychain charm.
// Original Kayboro artwork.
const L = require('../lib');
const { rr, path, g, lg, rg, circle, ellipse, sparkle, tf, lip, glowStroke, chamfer, poly, n } = L;

const W = 1800, H = 950, hole = { x: 460, y: 150, w: 880, h: 550 }, radius = 14;
const INK = '#061317', CYAN = '#3ff3ff', MAG = '#ff3fd2', VIO = '#9b6bff';
const MIRROR = 'matrix(-1 0 0 1 1800 0)';

/** Polygon (or polyline) with every corner rounded by a quadratic of size r (number or per-corner list). */
function roundPoly(pts, r, closed = true) {
  const R = (i) => (Array.isArray(r) ? r[i] : r);
  const N = pts.length, at = (a, b, d) => {
    const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy), k = Math.min(d, len / 2) / len;
    return [a[0] + dx * k, a[1] + dy * k];
  };
  let d = '';
  for (let i = 0; i < N; i++) {
    const p = pts[i];
    if (!closed && (i === 0 || i === N - 1)) { d += `${i ? 'L' : 'M'}${n(p[0])} ${n(p[1])}`; continue; }
    const a = at(p, pts[(i - 1 + N) % N], R(i)), b = at(p, pts[(i + 1) % N], R(i));
    d += `${i ? 'L' : 'M'}${n(a[0])} ${n(a[1])}Q${n(p[0])} ${n(p[1])} ${n(b[0])} ${n(b[1])}`;
  }
  return d + (closed ? 'Z' : '');
}

// Faceted outline: flat top deck, hexagonal grip pods swept down and out, a short belly under the screen.
const LEFT = [[330, 72], [176, 104], [70, 244], [46, 560], [118, 826], [248, 906], [384, 884], [468, 796]];
const RIGHT = LEFT.map(([x, y]) => [W - x, y]).reverse();
const SHELL = roundPoly([...LEFT, ...RIGHT], [40, 54, 60, 80, 70, 60, 50, 60, 60, 50, 60, 70, 80, 60, 54, 40]);
// rubber pod facing along the outer facets (mirrored for the right pod)
const SEAM_PTS = [[112, 258], [90, 560], [154, 796], [258, 862], [370, 846], [440, 784]];
const SEAM = roundPoly(SEAM_PTS, 70, false);
const RUBBER = roundPoly([...SEAM_PTS, [560, 800], [560, 1000], [0, 1000], [0, 258]], [70, 70, 70, 70, 70, 0, 0, 0, 0, 0]);
const STRIP = roundPoly([[110, 284], [90, 560], [154, 796], [258, 862], [366, 848]], 70, false);
const STRIP_FX = { transform: 'translate(-2 0)' };
const CX = 900, CY = 490, SX = 1 - 26 / 1700, SY = 1 - 26 / 830;
const inset = `translate(${CX} ${CY}) scale(${n(SX)} ${n(SY)}) translate(${-CX} ${-CY})`;

/** A recessed round well (light from the top-left: the lower-right inner wall catches light). */
function well(cx, cy, r) {
  return path(circle(cx, cy, r), { fill: '#0b1a1f', stroke: INK, strokeWidth: 4 })
    + path(circle(cx, cy, r - 4), { fill: 'none', stroke: 'url(#wellRim)', strokeWidth: 5 })
    + path(circle(cx, cy, r + 4), { fill: 'none', stroke: '#fff', strokeOpacity: 0.08, strokeWidth: 3 });
}

/** Round dial pad: one dimpled disc that rocks in any direction (no cross), ringed by tick marks. */
function dialPad(cx, cy) {
  const ticks = [];
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2, r0 = i % 6 === 0 ? 0 : 1;
    ticks.push(`M${n(cx + (99 + r0 * 3) * Math.cos(a))} ${n(cy + (99 + r0 * 3) * Math.sin(a))}L${n(cx + 110 * Math.cos(a))} ${n(cy + 110 * Math.sin(a))}`);
  }
  const pips = [0, 1, 2, 3].map((i) => {
    const a = (i * Math.PI) / 2 - Math.PI / 2;
    return circle(cx + 62 * Math.cos(a), cy + 62 * Math.sin(a), 4.5);
  }).join('');
  return path(ticks.join(''), { stroke: '#9fc4cc', strokeOpacity: 0.55, strokeWidth: 3, strokeLinecap: 'round' })
    + well(cx, cy, 94)
    + glowStroke(circle(cx, cy, 86), CYAN, 2.5, [[4, 0.1], [2, 0.25], [1, 0.8]])
    + path(circle(cx + 5, cy + 11, 78), { fill: INK, fillOpacity: 0.6 })
    + path(circle(cx, cy, 78), { fill: 'url(#disc)', stroke: INK, strokeWidth: 5 })
    + path(circle(cx, cy, 70), { fill: 'none', stroke: '#fff', strokeOpacity: 0.12, strokeWidth: 2 })
    + path(pips, { fill: CYAN, fillOpacity: 0.85 })
    + path(circle(cx, cy, 30), { fill: 'url(#dimple)', stroke: INK, strokeOpacity: 0.7, strokeWidth: 3 })
    + path(`M${cx + 20} ${cy + 16}A26 26 0 0 1 ${cx + 4} ${cy + 26}`, { fill: 'none', stroke: '#fff', strokeOpacity: 0.3, strokeWidth: 3, strokeLinecap: 'round' })
    + path(`M${cx - 66} ${cy - 22}A70 70 0 0 1 ${cx - 24} ${cy - 66}`, { fill: 'none', stroke: '#fff', strokeOpacity: 0.55, strokeWidth: 5, strokeLinecap: 'round' });
}

/** Vertical ribbed scroll wheel in a slot (the drum's ribs bunch up towards its top and bottom). */
function scrollWheel(cx, cy) {
  const ribs = [];
  for (let i = 1; i < 16; i++) {
    const t = i / 16, y = cy - 76 * Math.cos(Math.PI * t);
    ribs.push(`M${cx - 20} ${n(y)}H${cx + 20}`);
  }
  return path(rr(cx - 36, cy - 96, 72, 192, 34), { fill: '#0b1a1f', stroke: INK, strokeWidth: 4 })
    + path(rr(cx - 32, cy - 92, 64, 184, 30), { fill: 'none', stroke: 'url(#wellRim)', strokeWidth: 4 })
    + path(rr(cx - 24, cy - 82, 48, 164, 22), { fill: 'url(#drum)', stroke: INK, strokeWidth: 4 })
    + path(ribs.join(''), { stroke: INK, strokeOpacity: 0.7, strokeWidth: 3, strokeLinecap: 'round' })
    + path(ribs.join(''), { stroke: '#fff', strokeOpacity: 0.12, strokeWidth: 1.5, strokeLinecap: 'round', transform: 'translate(0 -2.5)' })
    + path(`M${cx - 30} ${cy - 60}V${cy + 60}`, { stroke: CYAN, strokeOpacity: 0.7, strokeWidth: 2.5, strokeLinecap: 'round' })
    + path(`M${cx - 16} ${cy - 70}V${cy - 20}`, { stroke: '#fff', strokeOpacity: 0.3, strokeWidth: 4, strokeLinecap: 'round' });
}

/** Three-step vertical slider switch with LED pips. */
function slider(cx, cy) {
  return path(rr(cx - 17, cy - 84, 34, 168, 17), { fill: '#0b1a1f', stroke: INK, strokeWidth: 4 })
    + path(rr(cx - 13, cy - 80, 26, 160, 13), { fill: 'none', stroke: 'url(#wellRim)', strokeWidth: 3 })
    + [-54, 0, 54].map((dy, i) => path(circle(cx + 32, cy + dy, 5.5), { fill: i === 0 ? CYAN : '#1d343b', stroke: INK, strokeWidth: 2 })).join('')
    + path(circle(cx + 32, cy - 54, 12), { fill: 'url(#led)' })
    + path(rr(cx - 26 + 3, cy - 78 + 7, 52, 48, 14), { fill: INK, fillOpacity: 0.6 })
    + path(rr(cx - 26, cy - 78, 52, 48, 14), { fill: 'url(#thumb)', stroke: INK, strokeWidth: 4 })
    + path(`M${cx - 13} ${cy - 62}H${cx + 13}M${cx - 13} ${cy - 54}H${cx + 13}M${cx - 13} ${cy - 46}H${cx + 13}`, { stroke: INK, strokeOpacity: 0.55, strokeWidth: 2.5, strokeLinecap: 'round' })
    + path(`M${cx - 16} ${cy - 72}H${cx + 8}`, { stroke: '#fff', strokeOpacity: 0.4, strokeWidth: 3, strokeLinecap: 'round' });
}

function stick(cx, cy, accent) {
  const bumps = [];
  for (let i = 0; i < 30; i++) {
    const a = (i / 30) * Math.PI * 2;
    bumps.push(circle(cx + 59 * Math.cos(a), cy + 59 * Math.sin(a), 3.6));
  }
  return well(cx, cy, 94)
    + glowStroke(circle(cx, cy, 84), accent, 3, [[4, 0.12], [2, 0.3], [1, 0.95]])
    + path(circle(cx + 6, cy + 12, 70), { fill: INK, fillOpacity: 0.6 })
    + path(circle(cx, cy, 70), { fill: 'url(#cap)', stroke: INK, strokeWidth: 5 })
    + path(bumps.join(''), { fill: '#5d7f88', stroke: INK, strokeOpacity: 0.5, strokeWidth: 1 })
    + path(circle(cx, cy, 48), { fill: 'url(#concave)', stroke: INK, strokeOpacity: 0.7, strokeWidth: 3 })
    + path(circle(cx, cy, 10), { fill: accent, fillOpacity: 0.5 })
    + path(`M${cx - 58} ${cy - 24}A63 63 0 0 1 ${cx - 22} ${cy - 59}`, { fill: 'none', stroke: '#fff', strokeOpacity: 0.45, strokeWidth: 5, strokeLinecap: 'round' })
    + path(`M${cx + 30} ${cy + 26}A40 40 0 0 1 ${cx + 8} ${cy + 39}`, { fill: 'none', stroke: '#fff', strokeOpacity: 0.18, strokeWidth: 4, strokeLinecap: 'round' });
}

/** Flat-topped hexagonal gem key with a cut facet and a glint. */
function hexKey(cx, cy, col) {
  const hex = (r, dx = 0, dy = 0) => poly([0, 1, 2, 3, 4, 5].map((i) => {
    const a = (i * Math.PI) / 3;
    return [cx + dx + r * Math.cos(a), cy + dy + r * Math.sin(a)];
  }));
  return path(hex(36, 4, 9), { fill: INK, fillOpacity: 0.7 })
    + path(hex(36), { fill: `url(#gem-${col})`, stroke: INK, strokeWidth: 5, strokeLinejoin: 'round' })
    + path(hex(20), { fill: '#fff', fillOpacity: 0.16, stroke: '#fff', strokeOpacity: 0.35, strokeWidth: 2 })
    + path(poly([[cx - 18, cy - 31], [cx + 18, cy - 31], [cx + 10, cy - 17], [cx - 10, cy - 17]]), { fill: '#fff', fillOpacity: 0.45 })
    + path(sparkle(cx - 14, cy - 8, 7), { fill: '#fff', fillOpacity: 0.9 });
}

/** Thumbstick nested in a crescent groove carrying three hex-gem keys. */
function crescentCluster(cx, cy) {
  const R = 142, arc = (a0, a1, r) => {
    const p = (a) => [n(cx + r * Math.cos((a * Math.PI) / 180)), n(cy + r * Math.sin((a * Math.PI) / 180))];
    return `M${p(a0).join(' ')}A${r} ${r} 0 0 1 ${p(a1).join(' ')}`;
  };
  const keys = [[112, 'cyan'], [164, 'vio'], [216, 'mag']].map(([a, col]) => hexKey(n(cx + R * Math.cos((a * Math.PI) / 180)), n(cy + R * Math.sin((a * Math.PI) / 180)), col));
  return path(arc(100, 228, R), { fill: 'none', stroke: INK, strokeWidth: 92, strokeLinecap: 'round' })
    + path(arc(100, 228, R), { fill: 'none', stroke: '#0b1a1f', strokeWidth: 84, strokeLinecap: 'round' })
    + path(arc(104, 224, R + 38), { fill: 'none', stroke: '#fff', strokeOpacity: 0.12, strokeWidth: 3, strokeLinecap: 'round' })
    + glowStroke(arc(108, 220, R - 46), MAG, 2, [[3, 0.15], [1, 0.8]])
    + stick(cx, cy, MAG)
    + keys.join('');
}

/** Knurled rotary knob with a lit pointer and a tick arc. */
function knob(cx, cy) {
  const ticks = [];
  for (let i = 0; i <= 10; i++) {
    const a = ((135 + i * 27) * Math.PI) / 180;
    ticks.push(`M${n(cx + 82 * Math.cos(a))} ${n(cy + 82 * Math.sin(a))}L${n(cx + (i % 5 ? 92 : 98) * Math.cos(a))} ${n(cy + (i % 5 ? 92 : 98) * Math.sin(a))}`);
  }
  let knurl = '';
  for (let i = 0; i < 28; i++) {
    const a0 = (i / 28) * Math.PI * 2, a1 = ((i + 0.5) / 28) * Math.PI * 2, a2 = ((i + 1) / 28) * Math.PI * 2;
    knurl += `${i ? 'L' : 'M'}${n(cx + 64 * Math.cos(a0))} ${n(cy + 64 * Math.sin(a0))}L${n(cx + 70 * Math.cos(a1))} ${n(cy + 70 * Math.sin(a1))}L${n(cx + 64 * Math.cos(a2))} ${n(cy + 64 * Math.sin(a2))}`;
  }
  knurl += 'Z';
  const pa = (-60 * Math.PI) / 180;
  return path(ticks.join(''), { stroke: '#9fc4cc', strokeOpacity: 0.6, strokeWidth: 3, strokeLinecap: 'round' })
    + well(cx, cy, 78)
    + path(knurl, { fill: INK, fillOpacity: 0.6, transform: 'translate(5 10)' })
    + path(knurl, { fill: 'url(#knurl)', stroke: INK, strokeWidth: 4, strokeLinejoin: 'round' })
    + path(circle(cx, cy, 52), { fill: 'url(#cap)', stroke: INK, strokeWidth: 4 })
    + path(circle(cx, cy, 52), { fill: 'url(#dGloss)' })
    + glowStroke(`M${n(cx + 14 * Math.cos(pa))} ${n(cy + 14 * Math.sin(pa))}L${n(cx + 42 * Math.cos(pa))} ${n(cy + 42 * Math.sin(pa))}`, MAG, 4, [[3, 0.2], [1.6, 0.4], [1, 1]])
    + path(`M${cx - 42} ${cy - 18}A46 46 0 0 1 ${cx - 14} ${cy - 44}`, { fill: 'none', stroke: '#fff', strokeOpacity: 0.5, strokeWidth: 4, strokeLinecap: 'round' });
}

/** Chamfered shoulder wing with a lit stripe. */
function bumper(x, accent, flip) {
  const shape = chamfer(x, 40, 300, 84, flip ? [10, 46, 6, 6] : [46, 10, 6, 6]);
  return path(chamfer(x + 30, 24, 240, 64, flip ? [6, 30, 4, 4] : [30, 6, 4, 4]), { fill: '#1d1a3c', stroke: INK, strokeWidth: 5, strokeLinejoin: 'round' })
    + path(shape, { fill: 'url(#bumper)', stroke: INK, strokeWidth: 5, strokeLinejoin: 'round' })
    + path(`M${flip ? x + 26 : x + 56} 56H${flip ? x + 244 : x + 274}`, { stroke: '#fff', strokeOpacity: 0.32, strokeWidth: 5, strokeLinecap: 'round' })
    + glowStroke(`M${flip ? x + 150 : x + 60} 72H${flip ? x + 240 : x + 150}`, accent, 3, [[3, 0.2], [1, 0.95]]);
}

/** Lit RGB tube: wide soft glow, saturated core and a faint white-hot centre. */
function strip(id) {
  return glowStroke(STRIP, `url(#${id})`, 7, [[4, 0.14], [2.2, 0.32], [1, 1]], STRIP_FX)
    + path(STRIP, { fill: 'none', stroke: 'url(#rgbCore)', strokeWidth: 1.5, strokeOpacity: 0.6, strokeLinecap: 'round', ...STRIP_FX });
}

function grip(id, rubber) {
  return g({},
    path(RUBBER, { fill: `url(#${rubber})` }),
    path(RUBBER, { fill: 'url(#hatch)' }),
    path(SEAM, { fill: 'none', stroke: 'url(#seamInk)', strokeWidth: 9 }),
    strip(id));
}

function bot(cx, cy) {
  return path(rr(cx - 23, cy - 8, 6, 11, 3) + rr(cx + 17, cy - 8, 6, 11, 3), { fill: '#33555e', stroke: INK, strokeWidth: 2 })
    + path(rr(cx - 17, cy - 11, 34, 22, 8), { fill: '#223b42', stroke: CYAN, strokeOpacity: 0.7, strokeWidth: 2.5 })
    + path(circle(cx - 7, cy - 2, 3.4) + circle(cx + 7, cy - 2, 3.4), { fill: CYAN, class: 'hr-eye' })
    + path(`M${cx - 4.5} ${cy + 5}Q${cx} ${cy + 8.5} ${cx + 4.5} ${cy + 5}`, { fill: 'none', stroke: MAG, strokeWidth: 2.2, strokeLinecap: 'round' });
}

/** Bot keychain charm resting on the floor, tied to a strap eyelet on the right pod. */
function charm(cx, cy) {
  const ex = 1384, ey = 856, rot = -9;
  const face = g({ transform: `rotate(${rot} ${cx} ${cy})` },
    path(rr(cx - 3, cy - 52, 6, 14, 3), { fill: '#33555e', stroke: INK, strokeWidth: 3 }),
    path(circle(cx, cy - 56, 7), { fill: MAG, stroke: INK, strokeWidth: 3 }),
    path(circle(cx - 2, cy - 58, 2.4), { fill: '#fff', fillOpacity: 0.8 }),
    path(rr(cx - 46, cy - 16, 12, 24, 5) + rr(cx + 34, cy - 16, 12, 24, 5), { fill: 'url(#charmEar)', stroke: INK, strokeWidth: 4 }),
    path(rr(cx - 38, cy - 40, 76, 66, 24), { fill: 'url(#charmBody)', stroke: INK, strokeWidth: 5 }),
    path(rr(cx - 27, cy - 28, 54, 38, 14), { fill: '#10232a', stroke: INK, strokeWidth: 3 }),
    path(circle(cx - 11, cy - 10, 6) + circle(cx + 11, cy - 10, 6), { fill: CYAN, class: 'hr-eye' }),
    path(circle(cx - 13, cy - 12, 2) + circle(cx + 9, cy - 12, 2), { fill: '#fff', fillOpacity: 0.9 }),
    path(`M${cx - 7} ${cy + 1}Q${cx} ${cy + 7} ${cx + 7} ${cy + 1}`, { fill: 'none', stroke: MAG, strokeWidth: 3, strokeLinecap: 'round' }),
    path(ellipse(cx - 19, cy + 3, 4, 2.5) + ellipse(cx + 19, cy + 3, 4, 2.5), { fill: MAG, fillOpacity: 0.45 }),
    path(`M${cx - 30} ${cy - 22}Q${cx - 30} ${cy - 34} ${cx - 16} ${cy - 34}`, { fill: 'none', stroke: '#fff', strokeOpacity: 0.55, strokeWidth: 4, strokeLinecap: 'round' }));
  const a = (rot * Math.PI) / 180, rx = cx + 56 * Math.sin(a), ry = cy - 56 * Math.cos(a);
  const cord = `M${ex - 3} ${ey + 6}C${ex - 6} ${ey + 34} ${n(rx + 34)} ${n(ry + 40)} ${n(rx + 4)} ${n(ry + 6)}`;
  return path(ellipse(cx + 2, cy + 33, 42, 7), { fill: '#000', fillOpacity: 0.45 })
    + path(cord, { fill: 'none', stroke: INK, strokeWidth: 7, strokeLinecap: 'round' })
    + path(cord, { fill: 'none', stroke: VIO, strokeWidth: 3.5, strokeLinecap: 'round' })
    + face
    + path(rr(ex - 12, ey - 8, 24, 16, 7), { fill: '#33555e', stroke: INK, strokeWidth: 4 })
    + path(circle(ex, ey, 3.2), { fill: INK });
}

function draw() {
  const holeD = rr(hole.x, hole.y, hole.w, hole.h, radius);
  const css = '<style>'
    + '.hr-rgb{opacity:0;animation:hrShift 8s ease-in-out infinite}'
    + '@keyframes hrShift{0%,100%{opacity:0}50%{opacity:.9}}'
    + '.hr-eye{animation:hrBlink 6s steps(1) infinite}'
    + '@keyframes hrBlink{0%,92%,100%{opacity:1}94%{opacity:.15}}'
    + '@media (prefers-reduced-motion:reduce){*{animation:none!important}}'
    + '</style>';
  const defs = [
    css,
    lg('body', [0, 0, 0.25, 1], [[0, '#4f7b86'], [0.45, '#355862'], [1, '#203a42']]),
    lg('rim', [0, 0, 0.35, 1], [[0, '#a3cbd3'], [0.35, '#5f8d98'], [1, '#1f3840']]),
    lg('gloss', [0, 0, 0, 1], [[0, '#fff', 0.18], [0.7, '#fff', 0]]),
    lg('glass', [0, 0, 0.3, 1], [[0, '#14262c'], [1, '#081013']]),
    lg('glare', [0, 0, 1, 1], [[0, '#fff', 0.16], [1, '#fff', 0]]),
    lg('bumper', [0, 0, 0, 1], [[0, '#6f9aa4'], [0.5, '#3a5f68'], [1, '#1e353c']]),
    lg('rubber', [0, 0, 1, 1], [[0, '#363068'], [1, '#1b1838']]),
    lg('rubberR', [1, 0, 0, 1], [[0, '#363068'], [1, '#1b1838']]),
    rg('charmBody', [0.36, 0.28, 0.8], [[0, '#8db3bc'], [0.6, '#46707a'], [1, '#22404a']]),
    lg('charmEar', [0, 0, 0, 1], [[0, '#6f9aa4'], [1, '#2a4a52']]),
    lg('wellRim', [0, 0, 1, 1], [[0, '#000', 0.6], [0.55, '#fff', 0], [1, '#fff', 0.22]]),
    rg('cap', [0.38, 0.32, 0.75], [[0, '#5e8892'], [0.7, '#2c4a52'], [1, '#18292e']]),
    rg('concave', [0.62, 0.68, 0.75], [[0, '#43656e'], [1, '#132228']]),
    rg('disc', [0.36, 0.3, 0.8], [[0, '#7aa6b0'], [0.55, '#3d636c'], [1, '#1b3036']]),
    rg('dimple', [0.62, 0.68, 0.75], [[0, '#4d7680'], [1, '#102026']]),
    lg('drum', [0, 0, 0, 1], [[0, '#0f1d22'], [0.3, '#4c7680'], [0.5, '#6f9ca6'], [0.7, '#3d626b'], [1, '#0f1d22']]),
    lg('thumb', [0, 0, 0, 1], [[0, '#8db3bc'], [1, '#2f525b']]),
    lg('knurl', [0, 0, 0.6, 1], [[0, '#8db3bc'], [0.5, '#46707a'], [1, '#1b3036']]),
    rg('dGloss', [0.3, 0.25, 0.7], [[0, '#fff', 0.18], [1, '#fff', 0]]),
    rg('gem-cyan', [0.38, 0.32, 0.75], [[0, '#d6fdff'], [0.55, '#3fdcf0'], [1, '#0f8aa6']]),
    rg('gem-mag', [0.38, 0.32, 0.75], [[0, '#ffd8f6'], [0.55, '#ff4fcf'], [1, '#a8128a']]),
    rg('gem-vio', [0.38, 0.32, 0.75], [[0, '#ece2ff'], [0.55, '#9b6bff'], [1, '#5530b8']]),
    lg('rgbA', [112, 284, 366, 848], [[0, CYAN, 0], [0.09, CYAN], [0.5, VIO], [0.9, MAG], [1, MAG, 0]], true),
    lg('rgbB', [112, 284, 366, 848], [[0, MAG, 0], [0.09, MAG], [0.5, VIO], [0.9, CYAN], [1, CYAN, 0]], true),
    lg('seamInk', [112, 258, 440, 784], [[0, INK, 0], [0.07, INK], [0.93, INK], [1, INK, 0]], true),
    lg('rgbCore', [112, 284, 366, 848], [[0, '#fff', 0], [0.14, '#fff'], [0.86, '#fff'], [1, '#fff', 0]], true),
    lg('hiLine', [60, 400, 1100, 92], [[0, '#fff', 0], [0.25, '#fff', 0.85], [0.6, '#fff', 0.5], [1, '#fff', 0]], true),
    rg('floor', [0.5, 0.5, 0.5], [[0, '#000', 0.55], [1, '#000', 0]]),
    rg('led', [0.5, 0.5, 0.5], [[0, '#fff', 0.9], [0.35, CYAN, 0.6], [1, CYAN, 0]]),
    '<pattern id="hatch" width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(40)"><path d="M0 0V9" stroke="#fff" stroke-opacity="0.07" stroke-width="3"/></pattern>',
    `<clipPath id="shellClip"><path d="${SHELL}"/></clipPath>`,
  ].join('');

  const vents = [];
  for (let i = 0; i < 14; i++) vents.push(chamfer(640 + i * 38, 92, 24, 12, [6, 0, 6, 0]));
  const speaker = [];
  for (let i = 0; i < 9; i++) for (const x0 of [610, 1021]) speaker.push(rr(x0 + i * 20, 758, 9, 18, 4.5));

  const body = [
    path(ellipse(900, 924, 840, 22), { fill: 'url(#floor)' }),
    bumper(150, CYAN, false), bumper(1350, MAG, true),
    // shell with bevelled rim
    path(SHELL, { fill: 'url(#rim)', stroke: INK, strokeWidth: 7 }),
    path(SHELL, { fill: 'url(#body)', transform: inset }),
    g({ clipPath: 'url(#shellClip)' },
      path('M0 70H1800V300C1300 230 500 230 0 300Z', { fill: 'url(#gloss)' }),
      grip('rgbA', 'rubber'),
      g({ transform: MIRROR }, grip('rgbB', 'rubberR')),
      g({ class: 'hr-rgb' }, strip('rgbB'), g({ transform: MIRROR }, strip('rgbA')))),
    path(SHELL, { fill: 'none', stroke: INK, strokeWidth: 7 }),
    path(roundPoly([[64, 420], [74, 252], [178, 114], [330, 84], [1100, 84]], 60, false), { fill: 'none', stroke: 'url(#hiLine)', strokeOpacity: 0.55, strokeWidth: 4, strokeLinecap: 'round' }),
    // top vents
    path(vents.join(''), { fill: '#08131a', stroke: '#fff', strokeOpacity: 0.1, strokeWidth: 1.5 }),
    // screen panel
    path(rr(434, 122, 940, 628, 34), { fill: INK, fillOpacity: 0.6 }),
    path(rr(428, 114, 944, 632, 36), { fill: 'url(#glass)', stroke: INK, strokeWidth: 5 }),
    path(rr(425, 111, 950, 638, 39), { fill: 'none', stroke: '#8fc0ca', strokeOpacity: 0.35, strokeWidth: 2 }),
    path(rr(432, 118, 936, 624, 32), { fill: 'none', stroke: '#fff', strokeOpacity: 0.1, strokeWidth: 2 }),
    path('M440 400V160Q440 126 474 126H760L440 446Z', { fill: 'url(#glare)' }),
    path(rr(hole.x - 10, hole.y - 10, hole.w + 20, hole.h + 20, radius + 8), { fill: 'none', stroke: '#5d8792', strokeWidth: 4 }),
    lip(holeD, '#000', [[8, 0.35], [3, 0.65]]),
    // panel status strip
    path(circle(500, 730, 10), { fill: 'url(#led)' }), path(circle(500, 730, 3.6), { fill: '#fff' }),
    path('M520 725h40M520 735h24', { stroke: '#4b6f78', strokeWidth: 4, strokeLinecap: 'round' }),
    bot(900, 730),
    [0, 1, 2, 3].map((i) => path(rr(1250 + i * 16, 722, 10, 16, 3), { fill: i < 3 ? CYAN : '#203a42', fillOpacity: i < 3 ? 0.85 : 1 })).join(''),
    path(rr(1314, 726, 4, 8, 2), { fill: '#203a42' }),
    // speaker grilles
    path(speaker.join(''), { fill: '#08131a', stroke: '#fff', strokeOpacity: 0.08, strokeWidth: 1.5 }),
    // left pod: dial pad, slider, scroll wheel
    dialPad(250, 300),
    slider(196, 612),
    scrollWheel(318, 618),
    // right pod: stick in a crescent of hex keys, rotary knob
    crescentCluster(1592, 300),
    knob(1532, 628),
    // anime glints
    path(sparkle(188, 150, 16), { fill: '#fff', fillOpacity: 0.9 }),
    path(sparkle(1646, 140, 11), { fill: '#fff', fillOpacity: 0.7 }),
    // strap eyelet + bot keychain charm
    charm(1288, 878),
  ].join('\n');
  return { defs, body };
}

module.exports = {
  W, H, hole, radius, draw,
  meta: { name: 'Handheld Rig', theme: 'tech', rarity: 'epic', translucent: false, collection: 'pocket-pals', license: 'CC-BY-4.0',
    desc: 'Grip the faceted teal pods of this handheld PC, spin its dial and scroll wheel, let the neon grip lights glow and bring the little bot charm along.',
    tags: ['handheld', 'pc', 'neon', 'rgb', 'tech', 'robot'] },
};
