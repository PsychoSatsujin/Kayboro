'use strict';
// Starter shell: Thin Bezel. A sleek glossy obsidian bezel for people who want the most game: a soft
// pink-to-cyan neon edge glow, tiny HUD corner ticks, a slim chin with speaker slots, a power LED and a
// small neon Kayboro mascot tag. Top-left key light, cool rim light, anime crescent glare.
const L = require('../lib');
const { rr, path, g, lg, rg, circle, ellipse, sparkle, lip, glowStroke, n, P } = L;

const FX = 6, FY = 6, FW = 1000, FH = 620, FR = 18; // bezel body
const TW = 236, TD = 10; // little tab under the chin that carries the tag
const W = FX * 2 + FW, H = FY + FH + TD + 12;
const hole = { x: FX + 20, y: FY + 20, w: 960, h: 540 }, radius = 8;
const INK = '#0b0912';
const CHIN = hole.y + hole.h, CY = (CHIN + FY + FH) / 2, CX = W / 2;
const B = FY + FH, R = FX + FW;
/** Bezel outline: a rounded rect whose bottom edge dips into a soft tab at the centre. */
const FRAME = `M${FX + FR} ${FY}H${R - FR}A${FR} ${FR} 0 0 1 ${R} ${FY + FR}V${B - FR}A${FR} ${FR} 0 0 1 ${R - FR} ${B}`
  + `H${CX + TW / 2 + 18}C${CX + TW / 2} ${B} ${CX + TW / 2} ${B + TD} ${CX + TW / 2 - 18} ${B + TD}H${CX - TW / 2 + 18}`
  + `C${CX - TW / 2} ${B + TD} ${CX - TW / 2} ${B} ${CX - TW / 2 - 18} ${B}H${FX + FR}A${FR} ${FR} 0 0 1 ${FX} ${B - FR}V${FY + FR}A${FR} ${FR} 0 0 1 ${FX + FR} ${FY}Z`;

/** Anime glare band hugging the top-left corner of a rounded rect (x, y, corner r), inset d, thickness t. */
function cornerGlare(x, y, r, d, t, lenH, lenV) {
  const ro = r - d, ri = Math.max(2, r - d - t), ex = x + r + lenH, ey = y + r + lenV;
  return `M${P(x + d, ey)}V${n(y + r)}A${P(ro, ro)} 0 0 1 ${P(x + r, y + d)}H${n(ex)}`
    + `Q${P(x + r + lenH * 0.55, y + d + t, x + r + lenH * 0.25, y + d + t)}H${n(x + r)}`
    + `A${P(ri, ri)} 0 0 0 ${P(x + d + t, y + r)}V${n(y + r + lenV * 0.25)}`
    + `Q${P(x + d + t, y + r + lenV * 0.55, x + d, ey)}Z`;
}

/** Tiny neon Kayboro tag: a dark glass pill with a pink outline and a little TV-face mascot. */
function tag(cx, cy) {
  const pill = rr(cx - 58, cy - 14, 116, 28, 14);
  return g({},
    glowStroke(pill, '#ff6ad5', 2, [[4, 0.1], [2.2, 0.25], [1, 1]]),
    path(pill, { fill: 'url(#bzTag)' }),
    path(`M${cx - 46} ${cy - 7}H${cx - 26}`, { stroke: '#fff', strokeOpacity: 0.55, strokeWidth: 2.5, strokeLinecap: 'round' }),
    path(`M${cx - 44} ${cy + 3}H${cx - 26}M${cx + 26} ${cy + 3}H${cx + 46}M${cx + 26} ${cy - 4}H${cx + 38}`, { stroke: '#c58cff', strokeOpacity: 0.7, strokeWidth: 3, strokeLinecap: 'round' }),
    path(`M${cx - 8} ${cy - 8}L${cx - 12} ${cy - 13}M${cx + 8} ${cy - 8}L${cx + 12} ${cy - 13}`, { stroke: '#ff6ad5', strokeWidth: 2.2, strokeLinecap: 'round' }),
    path(circle(cx - 12, cy - 13.5, 2.3) + circle(cx + 12, cy - 13.5, 2.3), { fill: '#ffd166' }),
    path(rr(cx - 13, cy - 9, 26, 19, 5.5), { fill: '#ff6ad5', stroke: '#ffd2f3', strokeWidth: 1.5 }),
    path(rr(cx - 9, cy - 5.5, 18, 12, 3.5), { fill: '#fff3fa' }),
    path(circle(cx - 4.5, cy - 0.5, 2) + circle(cx + 4.5, cy - 0.5, 2), { fill: '#3fc0e6' }),
    path(`M${cx - 2.5} ${cy + 3}Q${cx} ${cy + 5.2} ${cx + 2.5} ${cy + 3}`, { fill: 'none', stroke: INK, strokeWidth: 1.4, strokeLinecap: 'round' }));
}

/** Tiny HUD tick in a corner just outside the opening: (x, y) is the opening's corner, (sx, sy) points outwards. */
function tick(x, y, sx, sy, col) {
  const o = 8, l = 22;
  return path(`M${x + sx * o} ${y - sy * l}V${y + sy * o}H${x - sx * l}`, { fill: 'none', stroke: col, strokeWidth: 2.2, strokeLinecap: 'round', strokeLinejoin: 'round', strokeOpacity: 0.9 });
}

function draw() {
  const holeD = rr(hole.x, hole.y, hole.w, hole.h, radius);
  const defs = [
    lg('bzBody', [0, 0, 0, 1], [[0, '#4a3f6e'], [0.035, '#2c2548'], [0.5, '#1a1528'], [0.9, '#211b33'], [1, '#2e2744']]),
    lg('bzChin', [0, 0, 0, 1], [[0, '#231d36'], [0.5, '#1a1528'], [1, '#2a2340']]),
    lg('bzNeon', [0, 0, W, 0], [[0, '#ff6ad5'], [0.5, '#c58cff'], [1, '#7af0ff']], true),
    lg('bzRim', [FX, FY, FX + FW, FY + FH], [[0, '#7af0ff', 0], [0.7, '#7af0ff', 0], [1, '#7af0ff', 0.75]], true),
    lg('bzKey', [FX, FY, FX + FW, FY + FH], [[0, '#fff', 0.8], [0.35, '#fff', 0.2], [0.6, '#fff', 0]], true),
    lg('bzSheen', [0, 0, 0, 1], [[0, '#fff', 0.22], [1, '#fff', 0]]),
    lg('bzTag', [0, 0, 0, 1], [[0, '#2e2546'], [1, '#120e1c']]),
    lg('bzSlot', [0, 0, 0, 1], [[0, '#050409'], [1, '#2a2440']]),
    rg('bzLed', [0.5, 0.5, 0.5], [[0, '#6ee7a8', 0.8], [1, '#6ee7a8', 0]]),
    rg('bzFloor', [0.5, 0.5, 0.5], [[0, '#000', 0.55], [1, '#000', 0]]),
    `<clipPath id="bzClip"><path d="${FRAME}"/></clipPath>`,
    '<style>.kbz-led{animation:kbz-led 3s ease-in-out infinite}.kbz-tw{animation:kbz-tw 3.4s ease-in-out infinite;transform-box:fill-box;transform-origin:center}'
      + '@keyframes kbz-led{0%,100%{opacity:1}50%{opacity:.4}}@keyframes kbz-tw{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.4;transform:scale(.6)}}'
      + '@media (prefers-reduced-motion:reduce){*{animation:none!important}}</style>',
  ].join('');

  const slots = (x0) => path(rr(x0, CY - 3, 150, 6, 3), { fill: 'url(#bzSlot)' }) + path(`M${x0 + 4} ${CY + 3.5}H${x0 + 146}`, { stroke: '#fff', strokeOpacity: 0.08, strokeWidth: 1.2 });
  const lx = FX + 40, rx = FX + FW - 40;

  const body = [
    path(ellipse(CX, B + 6, 480, 11), { fill: 'url(#bzFloor)' }),
    path(ellipse(CX, B + TD + 2, 150, 7), { fill: 'url(#bzFloor)' }),
    // outer neon halo
    glowStroke(FRAME, 'url(#bzNeon)', 2.8, [[4.4, 0.16], [2.8, 0.3], [1.7, 0.6]]),
    // body
    path(FRAME, { fill: 'url(#bzBody)' }),
    g({ clipPath: 'url(#bzClip)' },
      path(`M${FX} ${CHIN}H${R}V${B + TD}H${FX}Z`, { fill: 'url(#bzChin)' }),
      path(`M${FX} ${FY}H${R}V${FY + 12}H${FX}Z`, { fill: 'url(#bzSheen)' }),
      path(FRAME, { fill: 'none', stroke: 'url(#bzRim)', strokeWidth: 10 }),
      path(FRAME, { fill: 'none', stroke: 'url(#bzKey)', strokeWidth: 5 }),
      // soft diagonal gloss streaks across the two top corners of the bezel
      path(`M${FX - 20} ${FY + 230}L${FX + 230} ${FY - 20}M${FX + 30} ${FY + 250}L${FX + 250} ${FY + 30}`, { stroke: '#fff', strokeOpacity: 0.07, strokeWidth: 26, strokeLinecap: 'round' }),
      path(`M${FX + FW - 140} ${FY + FH + 20}L${FX + FW + 20} ${FY + FH - 140}`, { stroke: '#7af0ff', strokeOpacity: 0.06, strokeWidth: 22, strokeLinecap: 'round' })),
    // neon edge tube
    path(FRAME, { fill: 'none', stroke: 'url(#bzNeon)', strokeWidth: 3 }),
    path(FRAME, { fill: 'none', stroke: '#fff', strokeOpacity: 0.45, strokeWidth: 0.8 }),
    // camera dot at the top centre
    path(rr(CX - 26, FY + 5.5, 52, 10, 5), { fill: '#0b0912', fillOpacity: 0.6 }),
    path(circle(CX, FY + 10.5, 3.6), { fill: '#1e2a4a', stroke: '#4a4266', strokeWidth: 1 }),
    path(circle(CX - 1.1, FY + 9.4, 1.1), { fill: '#7af0ff' }),
    path(circle(CX - 14, FY + 10.5, 1.5) + circle(CX + 14, FY + 10.5, 1.5), { fill: '#4a4266' }),
    // opening: dark inner lip and a hairline highlight
    lip(holeD, '#000', [[6, 0.35], [3, 0.55], [1.2, 0.85]]),
    path(rr(hole.x - 3.5, hole.y - 3.5, hole.w + 7, hole.h + 7, radius + 3.5), { fill: 'none', stroke: '#4a4266', strokeOpacity: 0.7, strokeWidth: 1.2 }),
    // HUD corner ticks
    tick(hole.x, hole.y, -1, -1, '#ff6ad5'), tick(hole.x + hole.w, hole.y, 1, -1, '#c58cff'),
    tick(hole.x, hole.y + hole.h, -1, 1, '#c58cff'), tick(hole.x + hole.w, hole.y + hole.h, 1, 1, '#7af0ff'),
    // chin
    slots(lx + 46), slots(rx - 196),
    path(circle(lx, CY, 3) + circle(lx + 13, CY, 3) + circle(lx + 26, CY, 3), { fill: '#7af0ff', fillOpacity: 0.85 }),
    path(circle(lx, CY, 3), { fill: '#fff' }),
    tag(CX, CY + TD / 2),
    path(circle(rx - 4, CY, 14), { fill: 'url(#bzLed)', class: 'kbz-led' }),
    path(circle(rx - 4, CY, 4.5), { fill: '#6ee7a8', stroke: INK, strokeWidth: 1.5 }),
    path(circle(rx - 5.4, CY - 1.4, 1.4), { fill: '#fff' }),
    path(rr(rx - 34, CY - 5, 18, 10, 5), { fill: '#2a2440', stroke: '#4a4266', strokeWidth: 1.2 }),
    // anime glare
    path(cornerGlare(FX, FY, FR, 3.5, 5.5, 300, 150), { fill: '#fff', fillOpacity: 0.85 }),
    path(circle(FX + FR + 318, FY + 6.5, 3.4), { fill: '#fff' }),
    path(circle(FX + FR + 330, FY + 6.5, 1.9), { fill: '#fff', fillOpacity: 0.85 }),
    path(circle(FX + 6.5, FY + FR + 166, 2.6), { fill: '#fff', fillOpacity: 0.8 }),
    path(`M${FX + FW - 5} ${FY + FH - FR - 60}V${FY + FH - FR}A${FR - 5} ${FR - 5} 0 0 1 ${FX + FW - FR} ${FY + FH - 5}H${FX + FW - FR - 90}`, { fill: 'none', stroke: '#c9fbff', strokeOpacity: 0.55, strokeWidth: 2.4, strokeLinecap: 'round' }),
    // corner sparkles
    g({ class: 'kbz-tw' }, path(sparkle(FX + FW - 14, FY + 13, 8), { fill: '#fff' })),
    path(sparkle(FX + 14, FY + FH - 13, 6), { fill: '#ff6ad5', fillOpacity: 0.9 }),
  ].join('\n');
  return { defs, body };
}

module.exports = {
  W, H, hole, radius, draw,
  meta: { name: 'Thin Bezel', theme: 'minimal', translucent: false,
    desc: 'A sleek glossy bezel with a soft neon edge glow that leaves almost the whole screen to your game.', tags: ['starter', 'bezel', 'minimal', 'neon', 'sleek'] },
};
