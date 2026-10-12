'use strict';
// Synthwave monitor: glossy black display with a pink-to-cyan neon rim in front of a striped
// sunset sun, wireframe mountains, palm silhouettes and a glowing perspective grid floor.
const L = require('../lib');
const { rr, path, lg, rg, circle, ellipse, sparkle, poly, glowStroke, rng, lip, n } = L;

const W = 1600, H = 1300, hole = { x: 240, y: 280, w: 1120, h: 630 }, radius = 0;
const HORIZON = 990, VX = 800, VY = 760;

function sun() {
  // Stripes are even-odd holes inside the disc (no mask), each band clamped to the disc's chord.
  const cx = 800, cy = 480, r = 460, top = cy - r, bands = [];
  for (const [y, h] of [[150, 4], [176, 7], [202, 10], [228, 13]]) {
    const a = Math.sqrt(r * r - (cy - y) ** 2) - 1, b = Math.sqrt(r * r - (cy - y - h) ** 2) - 1;
    bands.push(poly([[cx - a, y], [cx + a, y], [cx + b, y + h], [cx - b, y + h]]));
  }
  return path(circle(cx, cy, r + 40) + circle(cx, cy, r), { fill: 'url(#sunGlow)', fillRule: 'evenodd' })
    + path(circle(cx, cy, r) + bands.join(''), { fill: 'url(#sun)', fillRule: 'evenodd' })
    + path(`M${cx - 200} ${top + 30}A${r} ${r} 0 0 1 ${cx + 60} ${top + 4}`, { fill: 'none', stroke: '#fff', strokeOpacity: 0.35, strokeWidth: 6, strokeLinecap: 'round' });
}

function mountains(s) {
  const x = s < 0 ? 0 : W, d = -s, pts = [[x, HORIZON], [x + d * 70, 700], [x + d * 120, 740], [x + d * 200, 610], [x + d * 280, 720], [x + d * 360, 660], [x + d * 470, HORIZON]];
  const wire = [];
  for (let i = 1; i < pts.length - 1; i++) wire.push(`M${pts[i][0]} ${pts[i][1]}L${n(pts[i][0] + d * (i % 2 ? 40 : -30))} ${HORIZON}`);
  return path(poly(pts), { fill: 'url(#mount)' })
    + path(wire.join(''), { fill: 'none', stroke: '#7af0ff', strokeOpacity: 0.35, strokeWidth: 2.5 })
    + glowStroke(poly(pts.slice(1, -1), false), '#7af0ff', 3, [[4, 0.12], [2, 0.25], [1, 1]]);
}

function palm(x, s) {
  const top = [x + s * 60, 560];
  const trunk = `M${x - 14} ${HORIZON}C${x - 10} 820 ${x + s * 20} 680 ${top[0] - 8} ${top[1]}L${top[0] + 10} ${top[1] + 4}C${x + s * 34} 690 ${x + 14} 820 ${x + 16} ${HORIZON}Z`;
  const frond = (ang, len, droop) => {
    const a = (ang * Math.PI) / 180, ex = top[0] + Math.cos(a) * len, ey = top[1] + Math.sin(a) * len + droop;
    const mx = top[0] + Math.cos(a) * len * 0.55, my = top[1] + Math.sin(a) * len * 0.55 - 26;
    const nx = -Math.sin(a), ny = Math.cos(a);
    return `M${n(top[0])} ${n(top[1] - 6)}Q${n(mx - nx * 34)} ${n(my - ny * 34)} ${n(ex)} ${n(ey)}Q${n(mx + nx * 6)} ${n(my + ny * 6 + 22)} ${n(top[0])} ${n(top[1] + 8)}Z`;
  };
  const fr = [[-178, 190, 90], [-155, 200, 50], [-128, 150, 20], [-100, 110, 10], [-70, 140, 16], [-38, 200, 50], [-8, 190, 92], [150, 120, 80], [30, 120, 80]].map(([a, l, d]) => frond(a, l, d)).join('');
  return path(trunk + fr, { fill: '#14062a', stroke: '#ff4fd8', strokeWidth: 3, strokeLinejoin: 'round' })
    + path(Array.from({ length: 9 }, (_, i) => { const y = 950 - i * 42; const t = (950 - y) / 400; return `M${n(x - 12 + s * t * 50)} ${y}l24 -6`; }).join(''), { stroke: '#ff4fd8', strokeOpacity: 0.5, strokeWidth: 2 });
}

function grid() {
  const lines = [];
  for (let i = -14; i <= 14; i++) {
    const xb = VX + i * 150; // at the bottom edge
    const t = (HORIZON - VY) / (H - VY), xh = VX + (xb - VX) * t;
    lines.push(`M${n(xh)} ${HORIZON}L${n(xb)} ${H}`);
  }
  for (let k = 1; k <= 9; k++) {
    const y = HORIZON + (H - HORIZON) * Math.pow(k / 9, 1.8);
    lines.push(`M0 ${n(y)}H${W}`);
  }
  return path(`M0 ${HORIZON}H${W}V${H}H0Z`, { fill: 'url(#floor)' })
    + glowStroke(lines.join(''), 'url(#gridFade)', 3, [[3.2, 0.16], [1, 1]])
    + glowStroke(`M0 ${HORIZON}H${W}`, 'url(#horizonFade)', 3, [[5, 0.15], [2.2, 0.3], [1, 1]])
    + path(ellipse(800, 1060, 360, 40), { fill: 'url(#reflect)' });
}

function draw() {
  const holeD = rr(hole.x, hole.y, hole.w, hole.h, radius);
  const defs = [
    lg('sun', [0, 0, 0, 1], [[0, '#fff27a'], [0.1, '#ffc34d'], [0.18, '#ff8a3d'], [0.26, '#ff2e88'], [1, '#b0137a']]),
    rg('sunGlow', [0.5, 0.5, 0.5], [[0.92, '#ff6ad5', 0.55], [1, '#ff6ad5', 0]]),
    lg('mount', [0, 0, 0, 1], [[0, '#3a0f6b'], [1, '#12052a']]),
    // elliptical fades centred under the monitor so the floor dissolves at the sides and the bottom
    ...[['floor', '#1d0838', [[0, 1], [0.72, 0.95], [1, 0]]], ['gridFade', '#ff4fd8', [[0, 1], [0.68, 1], [1, 0]]]].map(([id, c, st]) =>
      `<radialGradient id="${id}" cx="800" cy="${HORIZON}" r="840" gradientUnits="userSpaceOnUse" gradientTransform="translate(800 ${HORIZON}) scale(1 0.4) translate(-800 ${-HORIZON})">${L.stops(st.map(([o, a]) => [o, c, a]))}</radialGradient>`),
    lg('horizonFade', [0, 0, W, 0], [[0, '#ffd0f4', 0], [0.12, '#ffd0f4'], [0.88, '#ffd0f4'], [1, '#ffd0f4', 0]], true),
    rg('reflect', [0.5, 0.5, 0.5], [[0, '#7af0ff', 0.35], [1, '#7af0ff', 0]]),
    lg('bezel', [0, 0, 0, 1], [[0, '#2a2438'], [0.06, '#14111d'], [1, '#07060b']]),
    lg('chrome', [0, 0, 0, 1], [[0, '#ffffff'], [0.48, '#c7c3dc'], [0.5, '#5b4f86'], [0.75, '#ff9ae6'], [1, '#ffe2fb']]),
    lg('neon', [0, 0, 1, 1], [[0, '#ff4fd8'], [0.5, '#b56cff'], [1, '#4ff0ff']]),
    lg('neck', [0, 0, 1, 0], [[0, '#2a2438'], [0.4, '#6e6690'], [0.6, '#3a3352'], [1, '#14111d']]),
  ].join('');

  const rnd = rng(3), stars = [];
  for (let i = 0; i < 46; i++) {
    const x = rnd() * W, y = 10 + rnd() * 600;
    if (x > 180 && x < 1420 && y > 220) continue;
    if (Math.hypot(x - 800, y - 480) < 470) continue;
    stars.push(i % 6 ? circle(x, y, 1.5 + rnd() * 2) : sparkle(x, y, 8 + rnd() * 8));
  }
  const bez = rr(200, 240, 1200, 716, 30);

  const body = [
    path(stars.join(''), { fill: '#fff', fillOpacity: 0.85 }),
    sun(),
    mountains(-1), mountains(1),
    grid(),
    palm(110, 1), palm(1490, -1),
    // stand
    path('M720 950L690 1046H910L880 950Z', { fill: 'url(#neck)', stroke: '#000', strokeWidth: 3 }),
    path(ellipse(800, 1050, 200, 22), { fill: 'url(#chrome)', stroke: '#2a2438', strokeWidth: 3 }),
    glowStroke('M612 1052Q800 1084 988 1052', '#4ff0ff', 2.5, [[4, 0.15], [2, 0.3], [1, 1]]),
    // monitor
    path(rr(206, 252, 1200, 716, 30), { fill: '#000', fillOpacity: 0.5 }),
    glowStroke(bez, 'url(#neon)', 6, [[7, 0.06], [4, 0.1], [2.2, 0.25]]),
    path(bez, { fill: 'url(#bezel)' }),
    path(bez, { fill: 'none', stroke: 'url(#neon)', strokeWidth: 6 }),
    path(rr(212, 252, 1176, 692, 22), { fill: 'none', stroke: '#fff', strokeOpacity: 0.08, strokeWidth: 2 }),
    path(rr(hole.x - 10, hole.y - 10, hole.w + 20, hole.h + 20, 6), { fill: '#000', stroke: '#2f2745', strokeWidth: 2 }),
    lip(holeD, '#000', [[6, 0.3], [2, 0.6]]),
    path('M230 520V300Q230 262 268 262H620', { fill: 'none', stroke: '#fff', strokeOpacity: 0.12, strokeWidth: 4, strokeLinecap: 'round' }),
    // chin details
    path('M776 942L800 920L824 942Z', { fill: 'url(#chrome)', stroke: '#000', strokeWidth: 2 }),
    path(circle(1330, 932, 6), { fill: '#4ff0ff' }), path(circle(1330, 932, 14), { fill: '#4ff0ff', fillOpacity: 0.25 }),
    path('M262 932h60M338 932h24', { stroke: '#ff4fd8', strokeOpacity: 0.7, strokeWidth: 4, strokeLinecap: 'round' }),
  ].join('\n');
  return { defs, body };
}

module.exports = {
  W, H, hole, radius, draw,
  meta: { name: 'Synthwave', theme: 'synthwave', rarity: 'epic', translucent: false,
    desc: 'A neon-rimmed display at the edge of an endless 1986 sunset grid.', tags: ['monitor', 'neon', 'retro', '80s', 'synthwave'] },
};
