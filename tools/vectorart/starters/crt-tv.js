'use strict';
// Starter shell: CRT TV. A glossy grape-soda plastic tube TV with a recessed plum screen surround,
// candy knobs on a side panel, a signal meter, a slotted speaker, rabbit ears with candy tips and a
// tiny Kayboro mascot badge. Top-left key light, cool cyan rim light, anime crescent glare.
const L = require('../lib');
const { rr, path, g, lg, rg, circle, ellipse, sparkle, star, heart, lip, rng, n, P } = L;

const W = 1040, H = 950, hole = { x: 130, y: 266, w: 640, h: 480 }, radius = 34;
const INK = '#221245';
const BX = 28, BY = 164, BW = 980, BH = 696, BR = 96; // cabinet
const SX = 90, SY = 226, SW = 720, SH = 560, SR = 66; // screen surround
const PX = 838, PY = 226, PW = 132, PH = 560; // side panel
const KX = PX + PW / 2, AX = SX + SW / 2; // panel centre, antenna/badge centre

/** Anime glare band hugging the top-left corner of a rounded rect (x, y, corner r), inset d, thickness t. */
function cornerGlare(x, y, r, d, t, lenH, lenV) {
  const ro = r - d, ri = Math.max(2, r - d - t), ex = x + r + lenH, ey = y + r + lenV;
  return `M${P(x + d, ey)}V${n(y + r)}A${P(ro, ro)} 0 0 1 ${P(x + r, y + d)}H${n(ex)}`
    + `Q${P(x + r + lenH * 0.55, y + d + t, x + r + lenH * 0.25, y + d + t)}H${n(x + r)}`
    + `A${P(ri, ri)} 0 0 0 ${P(x + d + t, y + r)}V${n(y + r + lenV * 0.25)}`
    + `Q${P(x + d + t, y + r + lenV * 0.55, x + d, ey)}Z`;
}

/** Crescent highlight inside a circle: outer arc on radius r from angle a0 to a1 (deg), t thick at the middle. */
function crescent(cx, cy, r, a0, a1, t) {
  const rad = (a) => (a * Math.PI) / 180, p = (a) => [cx + r * Math.cos(rad(a)), cy + r * Math.sin(rad(a))];
  const half = rad(a1 - a0) / 2, c = 2 * r * Math.sin(half), s1 = r - r * Math.cos(half), s2 = Math.max(0.5, s1 - t);
  const R = (c * c / 4 + s2 * s2) / (2 * s2);
  return `M${P(...p(a0))}A${P(r, r)} 0 0 1 ${P(...p(a1))}A${P(R, R)} 0 0 0 ${P(...p(a0))}Z`;
}

function knob(cx, cy, r, ang, ticks) {
  const out = [];
  if (ticks) {
    let dots = '';
    for (let i = 0; i < 11; i++) {
      const a = ((-225 + i * 27) * Math.PI) / 180, rd = r + 11;
      dots += circle(cx + rd * Math.cos(a), cy + rd * Math.sin(a), i % 5 ? 2.6 : 4);
    }
    out.push(path(dots, { fill: '#fff', fillOpacity: 0.75 }));
  }
  let ridges = '';
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    ridges += `M${P(cx + (r - 3) * Math.cos(a), cy + (r - 3) * Math.sin(a))}L${P(cx + (r * 0.8) * Math.cos(a), cy + (r * 0.8) * Math.sin(a))}`;
  }
  const a = (ang * Math.PI) / 180, cap = r * 0.7;
  out.push(
    path(circle(cx + 3, cy + 8, r + 2), { fill: INK, fillOpacity: 0.45 }),
    path(circle(cx, cy, r), { fill: 'url(#crtChrome)', stroke: INK, strokeWidth: 5 }),
    path(ridges, { stroke: INK, strokeOpacity: 0.28, strokeWidth: 2 }),
    path(circle(cx, cy, cap), { fill: 'url(#crtCandy)', stroke: INK, strokeWidth: 3.5 }),
    path(`M${P(cx + cap * 0.15 * Math.cos(a), cy + cap * 0.15 * Math.sin(a))}L${P(cx + cap * 0.72 * Math.cos(a), cy + cap * 0.72 * Math.sin(a))}`,
      { stroke: '#fff', strokeWidth: n(r * 0.13), strokeLinecap: 'round' }),
    path(crescent(cx, cy, cap * 0.84, 188, 268, cap * 0.2), { fill: '#fff', fillOpacity: 0.85 }),
    path(circle(cx + cap * 0.36, cy - cap * 0.5, cap * 0.09), { fill: '#fff' }),
    path(crescent(cx, cy, r - 2, 200, 250, 4), { fill: '#fff', fillOpacity: 0.9 }),
  );
  return out.join('');
}

/** Candy ball with an anime glare (antenna tips). */
function ball(cx, cy, r, grad) {
  return path(circle(cx, cy, r + 12), { fill: `url(#${grad}Glow)` })
    + path(circle(cx, cy, r), { fill: `url(#${grad})`, stroke: INK, strokeWidth: 4.5 })
    + path(crescent(cx, cy, r * 0.76, 190, 275, r * 0.24), { fill: '#fff', fillOpacity: 0.9 })
    + path(circle(cx + r * 0.32, cy + r * 0.34, r * 0.12), { fill: '#fff', fillOpacity: 0.85 });
}

function antenna() {
  const rod = (x1, y1, x2, y2) => path(`M${P(x1, y1)}L${P(x2, y2)}`, { stroke: INK, strokeWidth: 12, strokeLinecap: 'round' })
    + path(`M${P(x1, y1)}L${P(x2, y2)}`, { stroke: 'url(#crtRod)', strokeWidth: 6, strokeLinecap: 'round' })
    + path(`M${P(x1 - 1.5, y1 - 2)}L${P(x1 + (x2 - x1) * 0.55 - 1.5, y1 + (y2 - y1) * 0.55 - 2)}`, { stroke: '#fff', strokeOpacity: 0.7, strokeWidth: 2, strokeLinecap: 'round' });
  const dome = `M${AX - 60} ${BY + 6}C${AX - 60} ${BY - 54} ${AX + 60} ${BY - 54} ${AX + 60} ${BY + 6}Z`;
  return g({},
    rod(AX - 14, BY - 22, AX - 196, BY - 120), rod(AX + 14, BY - 22, AX + 206, BY - 104),
    path(dome, { fill: 'url(#crtDome)', stroke: INK, strokeWidth: 5 }),
    path(rr(AX - 36, BY - 22, 72, 11, 5.5), { fill: '#ff6ad5', stroke: INK, strokeWidth: 2.5 }),
    path(crescent(AX, BY + 6, 50, 198, 256, 9), { fill: '#fff', fillOpacity: 0.8 }),
    path(circle(AX + 28, BY - 30, 3.5), { fill: '#fff', fillOpacity: 0.8 }),
    ball(AX - 196, BY - 120, 19, 'crtPinkBall'), ball(AX + 206, BY - 104, 16, 'crtCyanBall'));
}

function foot(x) {
  const y = BY + BH - 2;
  return path(rr(x, y, 100, 56, 22), { fill: 'url(#crtFoot)', stroke: INK, strokeWidth: 5 })
    + path(`M${x + 18} ${y + 44}H${x + 82}`, { stroke: '#7af0ff', strokeOpacity: 0.4, strokeWidth: 3, strokeLinecap: 'round' })
    + path(`M${x + 20} ${y + 28}Q${x + 26} ${y + 36} ${x + 40} ${y + 38}`, { fill: 'none', stroke: '#fff', strokeOpacity: 0.45, strokeWidth: 3.5, strokeLinecap: 'round' });
}

function panel() {
  const meter = [0, 1, 2, 3, 4].map((i) => {
    const h = 8 + i * 4, x = KX - 30 + i * 13;
    return path(rr(x, 540 - h, 8, h, 2.5), { fill: i < 4 ? '#7af0ff' : '#3c6c86', class: i < 4 ? null : 'kcrt-blink' });
  }).join('');
  const slots = Array.from({ length: 6 }, (_, i) => rr(KX - 40, 584 + i * 22, 80, 11, 5.5)).join('');
  return g({},
    path(rr(PX, PY + 5, PW, PH, 40), { fill: INK, fillOpacity: 0.3 }),
    path(rr(PX, PY, PW, PH, 40), { fill: 'url(#crtPanel)', stroke: INK, strokeWidth: 5 }),
    path(rr(PX + 6, PY + 6, PW - 12, PH - 12, 34), { fill: 'none', stroke: '#1b0f3d', strokeOpacity: 0.3, strokeWidth: 8 }),
    path(`M${PX + 26} ${PY + PH - 5}H${PX + PW - 26}`, { stroke: '#e3d9ff', strokeOpacity: 0.75, strokeWidth: 3, strokeLinecap: 'round' }),
    path(cornerGlare(PX, PY, 40, 7, 6, 30, 70), { fill: '#fff', fillOpacity: 0.35 }),
    knob(KX, 322, 42, -50, true),
    knob(KX, 438, 29, 40, false),
    // signal meter
    path(rr(KX - 40, 506, 80, 42, 12), { fill: '#0e1430', stroke: INK, strokeWidth: 4 }),
    path(rr(KX - 34, 512, 68, 30, 8), { fill: '#7af0ff', fillOpacity: 0.12 }),
    meter,
    path(`M${KX - 30} 514H${KX + 18}`, { stroke: '#fff', strokeOpacity: 0.35, strokeWidth: 2.5, strokeLinecap: 'round' }),
    // speaker
    path(slots, { fill: '#e3d9ff', fillOpacity: 0.35, transform: 'translate(0 2.5)' }),
    path(slots, { fill: '#221452' }),
    path(Array.from({ length: 6 }, (_, i) => `M${KX - 32} ${589.5 + i * 22}H${KX + 32}`).join(''), { stroke: '#5a3fb0', strokeWidth: 2, strokeLinecap: 'round' }),
    // power
    path(rr(KX - 42, 738, 54, 28, 14), { fill: 'url(#crtChrome)', stroke: INK, strokeWidth: 4 }),
    path(`M${KX - 32} 746H${KX}`, { stroke: '#fff', strokeOpacity: 0.85, strokeWidth: 3, strokeLinecap: 'round' }),
    path(circle(KX + 30, 752, 24), { fill: 'url(#crtLed)', class: 'kcrt-led' }),
    path(circle(KX + 30, 752, 8.5), { fill: '#ff6ad5', stroke: INK, strokeWidth: 3 }),
    path(circle(KX + 27.5, 749.5, 2.6), { fill: '#fff' }));
}

/** Tiny Kayboro mascot badge on a chrome trim strip: a pill with a little TV face (antenna bobbles, cyan eyes, smile). */
function badge(cx, cy) {
  return g({},
    path(`M${SX + 30} ${cy}H${cx - 80}M${cx + 80} ${cy}H${SX + SW - 30}`, { stroke: INK, strokeWidth: 9, strokeLinecap: 'round' }),
    path(`M${SX + 30} ${cy}H${cx - 80}M${cx + 80} ${cy}H${SX + SW - 30}`, { stroke: 'url(#crtTrim)', strokeWidth: 4.5, strokeLinecap: 'round' }),
    path(rr(cx - 70, cy - 17 + 4, 140, 34, 17), { fill: INK, fillOpacity: 0.4 }),
    path(rr(cx - 70, cy - 17, 140, 34, 17), { fill: 'url(#crtBadge)', stroke: INK, strokeWidth: 4 }),
    path(`M${cx - 56} ${cy - 8}H${cx - 30}`, { stroke: '#fff', strokeOpacity: 0.85, strokeWidth: 3.5, strokeLinecap: 'round' }),
    path(circle(cx - 22, cy - 8, 2.2), { fill: '#fff', fillOpacity: 0.85 }),
    path(`M${cx - 46} ${cy + 5}H${cx - 28}M${cx + 28} ${cy + 5}H${cx + 50}M${cx + 28} ${cy - 3}H${cx + 40}`, { stroke: '#7a1f63', strokeOpacity: 0.5, strokeWidth: 3.5, strokeLinecap: 'round' }),
    path(`M${cx - 10} ${cy - 11}L${cx - 15} ${cy - 18}M${cx + 10} ${cy - 11}L${cx + 15} ${cy - 18}`, { stroke: INK, strokeWidth: 2.8, strokeLinecap: 'round' }),
    path(circle(cx - 15, cy - 19, 3) + circle(cx + 15, cy - 19, 3), { fill: '#ffd166', stroke: INK, strokeWidth: 1.6 }),
    path(rr(cx - 16, cy - 12, 32, 24, 7), { fill: '#fff3fa', stroke: INK, strokeWidth: 2.8 }),
    path(circle(cx - 7, cy - 1, 3) + circle(cx + 7, cy - 1, 3), { fill: '#3fc0e6' }),
    path(`M${cx - 3.5} ${cy + 5}Q${cx} ${cy + 8.5} ${cx + 3.5} ${cy + 5}`, { fill: 'none', stroke: INK, strokeWidth: 2, strokeLinecap: 'round' }));
}

/** Die-cut heart sticker with a white border and its own little glare, slightly tilted. */
function sticker(cx, cy) {
  const d = heart(0, 0, 22);
  return g({ transform: `translate(${cx} ${cy}) rotate(-14)` },
    path(d, { fill: INK, fillOpacity: 0.35, transform: 'translate(2 4)', stroke: INK, strokeOpacity: 0.35, strokeWidth: 12, strokeLinejoin: 'round' }),
    path(d, { fill: '#fff', stroke: '#fff', strokeWidth: 12, strokeLinejoin: 'round' }),
    path(d, { fill: 'none', stroke: INK, strokeOpacity: 0.25, strokeWidth: 1.5 }),
    path(d, { fill: 'url(#crtBadge)', stroke: INK, strokeWidth: 2.5 }),
    path(crescent(0, -2, 15, 196, 262, 5), { fill: '#fff', fillOpacity: 0.9 }),
    path(circle(9, -9, 2.6), { fill: '#fff' }));
}

/** Pearly glitter flecks in the cabinet walls (seeded). */
function glitter() {
  const rnd = rng(31), dots = [], spark = [];
  for (let i = 0; i < 90 && dots.length + spark.length < 46; i++) {
    const x = BX + 20 + rnd() * (BW - 40), y = BY + 16 + rnd() * (BH - 32);
    if (x > SX - 8 && x < PX + PW + 8 && y > SY - 8 && y < SY + SH + 8) continue;
    if ((x < BX + 150 && y < BY + 260) || (x < BX + 90 && y > BY + BH - 110)) continue; // keep the glare corner and sticker clean
    (i % 7 ? dots : spark).push(i % 7 ? circle(x, y, 1.4 + rnd() * 1.8) : sparkle(x, y, 5 + rnd() * 4));
  }
  return path(dots.join(''), { fill: '#fff', fillOpacity: 0.45 }) + path(spark.join(''), { fill: '#fff', fillOpacity: 0.65 });
}

function draw() {
  const holeD = rr(hole.x, hole.y, hole.w, hole.h, radius);
  const BODY = rr(BX, BY, BW, BH, BR);
  const defs = [
    lg('crtBody', [0, 0, 1, 1], [[0, '#efe6ff'], [0.16, '#c9b4ff'], [0.48, '#9a79f3'], [0.8, '#6a49d6'], [1, '#4b2fae']]),
    lg('crtSide', [0, 0, 1, 1], [[0, '#4a2fae'], [1, '#2a1670']]),
    lg('crtShade', [0, 0, 0, 1], [[0, '#fff', 0.3], [0.1, '#fff', 0.05], [0.55, '#fff', 0], [0.82, '#1b0b4a', 0.1], [1, '#1b0b4a', 0.4]]),
    lg('crtRim', [BX, BY, BX + BW, BY + BH], [[0, '#7af0ff', 0], [0.6, '#7af0ff', 0], [0.85, '#7af0ff', 0.8], [1, '#c9fbff', 1]], true),
    lg('crtKey', [BX, BY, BX + BW, BY + BH], [[0, '#fff', 0.7], [0.3, '#fff', 0.25], [0.45, '#fff', 0]], true),
    lg('crtBevel', [0, 0, 1, 1], [[0, '#0d0720'], [0.5, '#2a1a5c'], [1, '#8a72e6']]),
    lg('crtSurround', [0, 0, 0, 1], [[0, '#1d1340'], [1, '#110b26']]),
    lg('crtPanel', [0, 0, 0, 1], [[0, '#5a3dc0'], [0.5, '#6c4fd6'], [1, '#8466ea']]),
    lg('crtChrome', [0, 0, 0, 1], [[0, '#ffffff'], [0.42, '#e3dcf7'], [0.58, '#9a90c0'], [1, '#e8e2ff']]),
    lg('crtTrim', [SX, 0, SX + SW, 0], [[0, '#b9a6f5'], [0.3, '#ffffff'], [0.6, '#d7ccff'], [1, '#8f7ad8']], true),
    rg('crtCandy', [0.38, 0.32, 0.8], [[0, '#ffd2f3'], [0.45, '#ff6ad5'], [1, '#b42c94']]),
    lg('crtRod', [0, 0, 1, 1], [[0, '#ffffff'], [0.5, '#c9c2e6'], [1, '#8d84b5']]),
    lg('crtDome', [0, 0, 0, 1], [[0, '#e0d6ff'], [0.6, '#8b6ef0'], [1, '#5236b8']]),
    rg('crtPinkBall', [0.4, 0.35, 0.75], [[0, '#ffe0f7'], [0.5, '#ff6ad5'], [1, '#b42c94']]),
    rg('crtPinkBallGlow', [0.5, 0.5, 0.5], [[0, '#ff6ad5', 0.55], [1, '#ff6ad5', 0]]),
    rg('crtCyanBall', [0.4, 0.35, 0.75], [[0, '#eafdff'], [0.5, '#7af0ff'], [1, '#2a9ac4']]),
    rg('crtCyanBallGlow', [0.5, 0.5, 0.5], [[0, '#7af0ff', 0.55], [1, '#7af0ff', 0]]),
    lg('crtFoot', [0, 0, 0, 1], [[0, '#5a3cc0'], [1, '#1e1052']]),
    rg('crtLed', [0.5, 0.5, 0.5], [[0, '#ff6ad5', 0.85], [1, '#ff6ad5', 0]]),
    lg('crtBadge', [0, 0, 0, 1], [[0, '#ffc8f0'], [0.5, '#ff6ad5'], [1, '#d6409f']]),
    rg('crtFloor', [0.5, 0.5, 0.5], [[0, '#000', 0.55], [0.6, '#000', 0.25], [1, '#000', 0]]),
    `<clipPath id="crtBodyClip"><path d="${BODY}"/></clipPath>`,
    '<style>.kcrt-led{animation:kcrt-led 2.8s ease-in-out infinite}.kcrt-blink{animation:kcrt-blink 1.6s steps(1) infinite}'
      + '.kcrt-tw{animation:kcrt-tw 3.2s ease-in-out infinite;transform-box:fill-box;transform-origin:center}.kcrt-tw2{animation-delay:1.6s}'
      + '@keyframes kcrt-led{0%,100%{opacity:1}50%{opacity:.35}}@keyframes kcrt-blink{0%,49%{fill:#3c6c86}50%,100%{fill:#7af0ff}}'
      + '@keyframes kcrt-tw{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.45;transform:scale(.7)}}'
      + '@media (prefers-reduced-motion:reduce){*{animation:none!important}}</style>',
  ].join('');

  const vents = Array.from({ length: 7 }, (_, i) => rr(SX + SW - 230 + i * 30, BY + 30, 18, 9, 4.5)).join('');
  const seam = rr(BX + 22, BY + 22, BW - 44, BH - 44, BR - 22);

  const body = [
    path(ellipse(W / 2, BY + BH + 56, 490, 28), { fill: 'url(#crtFloor)' }),
    foot(BX + 120), foot(BX + BW - 220),
    antenna(),
    // cabinet (with a chunky extruded side for a toy-like depth)
    path(rr(BX + 10, BY + 16, BW, BH, BR), { fill: 'url(#crtSide)', stroke: INK, strokeWidth: 8 }),
    path(BODY, { fill: 'url(#crtBody)', stroke: INK, strokeWidth: 8 }),
    g({ clipPath: 'url(#crtBodyClip)' },
      path(BODY, { fill: 'url(#crtShade)' }),
      glitter(),
      path(seam, { fill: 'none', stroke: '#fff', strokeOpacity: 0.35, strokeWidth: 2.5, transform: 'translate(1.5 2)' }),
      path(seam, { fill: 'none', stroke: '#2a1670', strokeOpacity: 0.35, strokeWidth: 2.5 }),
      path(rr(BX + 7, BY + 7, BW - 14, BH - 14, BR - 7), { fill: 'none', stroke: 'url(#crtRim)', strokeWidth: 7 }),
      path(rr(BX + 5, BY + 5, BW - 10, BH - 10, BR - 5), { fill: 'none', stroke: 'url(#crtKey)', strokeWidth: 3 })),
    path(vents, { fill: '#e3d9ff', fillOpacity: 0.45, transform: 'translate(0 2.5)' }),
    path(vents, { fill: '#2a1868', fillOpacity: 0.75 }),
    // screen surround
    path(rr(SX - 2, SY + 5, SW + 4, SH + 4, SR + 2), { fill: INK, fillOpacity: 0.35 }),
    path(rr(SX, SY, SW, SH, SR), { fill: 'url(#crtBevel)', stroke: INK, strokeWidth: 5 }),
    path(rr(SX + 14, SY + 14, SW - 28, SH - 28, SR - 12), { fill: 'url(#crtSurround)' }),
    path(rr(hole.x - 16, hole.y - 16, hole.w + 32, hole.h + 32, radius + 14), { fill: '#06040c', stroke: '#3a2a78', strokeWidth: 2 }),
    lip(holeD, '#000', [[10, 0.22], [5, 0.38], [2, 0.7]]),
    path(cornerGlare(SX + 14, SY + 14, SR - 12, 6, 7, 150, 90), { fill: '#fff', fillOpacity: 0.2 }),
    path(`M${SX + SW - 70} ${SY + SH - 9}H${SX + 90}`, { stroke: '#c9b8ff', strokeOpacity: 0.55, strokeWidth: 2.5, strokeLinecap: 'round' }),
    badge(AX, SY + SH + 37),
    panel(),
    // anime glare on the cabinet
    path(cornerGlare(BX, BY, BR, 14, 19, 270, 170), { fill: '#fff', fillOpacity: 0.95 }),
    path(circle(BX + BR + 302, BY + 23, 9), { fill: '#fff' }),
    path(circle(BX + BR + 325, BY + 23, 4.8), { fill: '#fff', fillOpacity: 0.85 }),
    path(circle(BX + 23, BY + BR + 202, 6.5), { fill: '#fff', fillOpacity: 0.9 }),
    sticker(BX + 44, BY + BH - 62),
    // sparkles
    g({ class: 'kcrt-tw' }, path(sparkle(80, 76, 26), { fill: '#ff6ad5', stroke: INK, strokeWidth: 3 })),
    g({ class: 'kcrt-tw kcrt-tw2' }, path(sparkle(966, 92, 22), { fill: '#7af0ff', stroke: INK, strokeWidth: 3 })),
    path(sparkle(1026, 520, 12), { fill: '#ffd166', stroke: INK, strokeWidth: 2.5 }),
    path(sparkle(14, 600, 12), { fill: '#7af0ff', stroke: INK, strokeWidth: 2.5 }),
    path(star(800, 40, 12, 5.5), { fill: '#ffd166', stroke: INK, strokeWidth: 2.5, strokeLinejoin: 'round' }),
    path(circle(150, 30, 4) + circle(880, 150, 3.5) + circle(1024, 820, 4) + circle(16, 860, 3.5), { fill: '#fff', fillOpacity: 0.8 }),
  ].join('\n');
  return { defs, body };
}

module.exports = {
  W, H, hole, radius, draw,
  meta: { name: 'CRT TV', theme: 'retro-home', translucent: false,
    desc: 'A glossy grape-soda tube TV with candy knobs, rabbit ears and a tiny mascot badge.', tags: ['starter', 'tv', 'crt', 'retro', 'cute'] },
};
