'use strict';
// Starter shell: Arcade Cabinet. A midnight-indigo upright with hot-pink neon T-molding, a backlit
// marquee (gold Kayboro coin, sunburst, speed wings), starburst bezel art around a neon-lined screen,
// a glossy control deck (ball-top stick, candy buttons) and a coin door with glowing slots.
const L = require('../lib');
const { rr, path, g, lg, rg, circle, ellipse, sparkle, star, poly, lip, glowStroke, rng, n, P } = L;

const W = 840, H = 1080, hole = { x: 160, y: 264, w: 520, h: 390 }, radius = 18;
const INK = '#150c33';
const CX = W / 2;
const OUT = 'M84 28H756A26 26 0 0 1 782 54V206H770V690L806 760V822L780 834V1016H60V834L34 822V760L70 690V206H58V54A26 26 0 0 1 84 28Z';
const MQ = { x: 96, y: 54, w: 648, h: 132 }; // marquee window
const BZ = { x: 94, y: 232, w: 652, h: 462 }; // bezel face
const DECK = poly([[94, 694], [746, 694], [790, 760], [50, 760]]);

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

/** Sunburst wedges from (cx, cy) out to radius R. */
function rays(cx, cy, R, count, width, rot = 0) {
  let d = '';
  for (let i = 0; i < count; i++) {
    const a = ((rot + (i * 360) / count) * Math.PI) / 180, w = ((width / 2) * Math.PI) / 180;
    d += `M${P(cx, cy)}L${P(cx + R * Math.cos(a - w), cy + R * Math.sin(a - w))}L${P(cx + R * Math.cos(a + w), cy + R * Math.sin(a + w))}Z`;
  }
  return d;
}

/** Pixel heart (5x4 grid of cells of size s) centred on (cx, cy). */
function pxHeart(cx, cy, s) {
  const rows = ['.X.X.', 'XXXXX', '.XXX.', '..X..'];
  let d = '';
  rows.forEach((r, j) => [...r].forEach((c, i) => { if (c === 'X') d += `M${P(cx + (i - 2.5) * s, cy + (j - 2) * s)}h${n(s)}v${n(s)}h${n(-s)}Z`; }));
  return d;
}

function marquee() {
  const { x, y, w, h } = MQ, mx = CX, my = y + h / 2;
  const wing = (s) => [0, 1, 2].map((i) => {
    const x0 = mx + s * (70 + i * 34), x1 = x0 + s * 26;
    return path(`M${x0} ${my - 26 + i * 4}L${x1} ${my}L${x0} ${my + 26 - i * 4}`, { fill: 'none', stroke: i === 1 ? '#ff6ad5' : '#7af0ff', strokeWidth: 9, strokeLinecap: 'round', strokeLinejoin: 'round', strokeOpacity: 1 - i * 0.22 });
  }).join('');
  const speed = (s) => [[-14, 120], [0, 170], [14, 120]].map(([dy, len]) => `M${mx + s * 190} ${my + dy}H${mx + s * (190 + len)}`).join('');
  return g({},
    path(rr(x - 14, y - 14, w + 28, h + 28, 22), { fill: 'url(#arcChrome)', stroke: INK, strokeWidth: 5 }),
    path(rr(x, y, w, h, 14), { fill: 'url(#arcMarquee)', stroke: INK, strokeWidth: 4 }),
    g({ clipPath: 'url(#arcMqClip)' },
      path(rays(mx, my + 10, 420, 18, 9, -90), { fill: '#ffd166', fillOpacity: 0.16, class: 'karc-rays' }),
      path(ellipse(mx, my + 8, 170, 70), { fill: 'url(#arcMqGlow)' }),
      path(`M${x} ${y + h - 30}H${x + w}M${x} ${y + h - 18}H${x + w}M${x} ${y + h - 8}H${x + w}`, { stroke: '#ffd166', strokeOpacity: 0.35, strokeWidth: 3 }),
      path(speed(-1) + speed(1), { stroke: '#fff', strokeOpacity: 0.55, strokeWidth: 4, strokeLinecap: 'round' }),
      wing(-1), wing(1),
      path(pxHeart(x + 46, my - 6, 7), { fill: '#ff6ad5', stroke: INK, strokeWidth: 1.5 }),
      path(pxHeart(x + w - 46, my - 6, 7), { fill: '#ff6ad5', stroke: INK, strokeWidth: 1.5 }),
      path(star(x + 100, y + 30, 9, 4) + star(x + w - 104, y + 36, 7, 3) + star(x + 150, y + h - 34, 6, 2.6) + star(x + w - 160, y + h - 30, 8, 3.4), { fill: '#fff' }),
      // Kayboro coin
      path(circle(mx + 4, my + 8, 50), { fill: INK, fillOpacity: 0.4 }),
      path(circle(mx, my, 50), { fill: 'url(#arcCoin)', stroke: INK, strokeWidth: 5 }),
      path(circle(mx, my, 38), { fill: 'none', stroke: '#b9780f', strokeWidth: 4 }),
      path(star(mx, my + 2, 26, 11), { fill: '#fff6cf', stroke: '#b9780f', strokeWidth: 3, strokeLinejoin: 'round' }),
      path(crescent(mx, my, 44.5, 192, 268, 8.5), { fill: '#fff', fillOpacity: 0.95 }),
      path(circle(mx + 22, my - 28, 4), { fill: '#fff' }),
      // glass cover glare
      path(cornerGlare(x, y, 14, 6, 9, 200, 46), { fill: '#fff', fillOpacity: 0.55 }),
      path(`M${x + w - 120} ${y + 12}L${x + w - 150} ${y + h - 12}M${x + w - 92} ${y + 12}L${x + w - 108} ${y + h - 12}`, { stroke: '#fff', strokeOpacity: 0.16, strokeWidth: 14, strokeLinecap: 'round' })),
    [[x - 2, y - 2], [x + w + 2, y - 2], [x - 2, y + h + 2], [x + w + 2, y + h + 2]].map(([sx, sy]) => path(circle(sx, sy, 5.5), { fill: '#fff', stroke: INK, strokeWidth: 2 })).join(''));
}

function bezel() {
  const holeD = rr(hole.x, hole.y, hole.w, hole.h, radius);
  const rnd = rng(5), stars = [];
  for (let i = 0; i < 40; i++) {
    const x = BZ.x + 8 + rnd() * (BZ.w - 16), y = BZ.y + 8 + rnd() * (BZ.h - 16);
    if (x > hole.x - 26 && x < hole.x + hole.w + 26 && y > hole.y - 26 && y < hole.y + hole.h + 26) continue;
    stars.push(i % 6 ? circle(x, y, 1.3 + rnd() * 1.6) : sparkle(x, y, 6 + rnd() * 5));
  }
  const frame = rr(hole.x - 12, hole.y - 12, hole.w + 24, hole.h + 24, radius + 10);
  return g({},
    path(rr(BZ.x, BZ.y, BZ.w, BZ.h, 10), { fill: 'url(#arcBezel)', stroke: INK, strokeWidth: 5 }),
    g({ clipPath: 'url(#arcBzClip)' },
      path(rays(CX, hole.y + hole.h / 2, 520, 24, 6, 0), { fill: '#ff6ad5', fillOpacity: 0.1 }),
      path(stars.join(''), { fill: '#fff', fillOpacity: 0.6 }),
      // diagonal speed stripes in the corners
      [[BZ.x, BZ.y + 120, 1], [BZ.x + BZ.w, BZ.y + BZ.h - 120, -1]].map(([sx, sy, s]) => [0, 1, 2].map((i) =>
        path(`M${sx - s * 20} ${sy + s * (i * 26)}L${sx + s * (150 - i * 30)} ${sy - s * (150 - i * 30) + s * i * 26}`, { stroke: ['#ff6ad5', '#c58cff', '#7af0ff'][i], strokeOpacity: 0.55, strokeWidth: 9, strokeLinecap: 'round' })).join('')).join(''),
      path(cornerGlare(BZ.x, BZ.y, 10, 4, 6, 170, 110), { fill: '#fff', fillOpacity: 0.3 })),
    // neon screen surround
    path(frame, { fill: '#05030b' }),
    glowStroke(rr(hole.x - 16, hole.y - 16, hole.w + 32, hole.h + 32, radius + 14), '#ff6ad5', 3.5, [[5, 0.08], [3, 0.16], [1.8, 0.35], [1, 1]]),
    path(rr(hole.x - 16, hole.y - 16, hole.w + 32, hole.h + 32, radius + 14), { fill: 'none', stroke: '#ffd2f3', strokeWidth: 1.2 }),
    path(frame, { fill: '#05030b' }),
    lip(holeD, '#000', [[8, 0.3], [3.5, 0.55], [1.5, 0.8]]),
    // corner screws
    [[BZ.x + 18, BZ.y + 18], [BZ.x + BZ.w - 18, BZ.y + 18], [BZ.x + 18, BZ.y + BZ.h - 18], [BZ.x + BZ.w - 18, BZ.y + BZ.h - 18]]
      .map(([sx, sy]) => path(circle(sx, sy, 6), { fill: 'url(#arcChrome)', stroke: INK, strokeWidth: 2 }) + path(`M${sx - 3.5} ${sy + 3.5}L${sx + 3.5} ${sy - 3.5}`, { stroke: INK, strokeWidth: 1.6 })).join(''));
}

/** Arcade button in light perspective: a cylinder under a domed top. */
function button(cx, cy, rx, col) {
  const ry = rx * 0.6, hgt = rx * 0.42;
  return path(ellipse(cx + 3, cy + hgt + 6, rx + 8, ry + 6), { fill: INK, fillOpacity: 0.5 })
    + path(ellipse(cx, cy + hgt, rx + 7, ry + 5), { fill: 'url(#arcChrome)', stroke: INK, strokeWidth: 3.5 })
    + path(`M${cx - rx} ${cy}V${cy + hgt}A${rx} ${ry} 0 0 0 ${cx + rx} ${cy + hgt}V${cy}Z`, { fill: `url(#arcBtnSide-${col})`, stroke: INK, strokeWidth: 3.5 })
    + path(ellipse(cx, cy, rx, ry), { fill: `url(#arcBtn-${col})`, stroke: INK, strokeWidth: 3.5 })
    + g({ transform: `translate(${cx} ${cy}) scale(1 ${n(ry / rx)})` }, path(crescent(0, 0, rx * 0.8, 180, 268, rx * 0.22), { fill: '#fff', fillOpacity: 0.95 }))
    + path(circle(cx + rx * 0.42, cy - ry * 0.32, rx * 0.11), { fill: '#fff' })
    + path(circle(cx + rx * 0.62, cy - ry * 0.05, rx * 0.06), { fill: '#fff', fillOpacity: 0.85 });
}

function joystick(cx, cy) {
  const by = cy - 46;
  return path(ellipse(cx + 4, cy + 8, 44, 16), { fill: INK, fillOpacity: 0.5 })
    + path(ellipse(cx, cy, 40, 15), { fill: 'url(#arcChrome)', stroke: INK, strokeWidth: 3.5 })
    + path(ellipse(cx, cy - 2, 18, 7), { fill: '#2a1d55', stroke: INK, strokeWidth: 2.5 })
    + path(`M${cx - 6} ${cy - 2}L${cx - 5} ${by + 10}H${cx + 5}L${cx + 6} ${cy - 2}Z`, { fill: 'url(#arcShaft)', stroke: INK, strokeWidth: 3 })
    + path(circle(cx + 3, by + 6, 26), { fill: INK, fillOpacity: 0.25 })
    + path(circle(cx, by, 26), { fill: 'url(#arcBall)', stroke: INK, strokeWidth: 4.5 })
    + path(crescent(cx, by, 20, 190, 272, 6.5), { fill: '#fff', fillOpacity: 0.92 })
    + path(circle(cx + 9, by + 10, 3.2), { fill: '#fff', fillOpacity: 0.85 });
}

function deck() {
  return g({},
    path(DECK, { fill: 'url(#arcDeck)', stroke: INK, strokeWidth: 5, strokeLinejoin: 'round' }),
    path(poly([[110, 702], [730, 702], [744, 722], [96, 722]]), { fill: '#fff', fillOpacity: 0.07 }),
    path('M64 752H776', { stroke: '#ff6ad5', strokeWidth: 4, strokeLinecap: 'round', strokeOpacity: 0.9 }),
    path('M100 700H740', { stroke: '#fff', strokeOpacity: 0.35, strokeWidth: 2.5, strokeLinecap: 'round' }),
    // deck front
    path(rr(50, 760, 740, 62, 10), { fill: 'url(#arcDeckFront)', stroke: INK, strokeWidth: 5 }),
    g({ clipPath: 'url(#arcFrontClip)' }, path(Array.from({ length: 30 }, (_, i) => `M${40 + i * 28} 824L${70 + i * 28} 758`).join(''), { stroke: '#fff', strokeOpacity: 0.06, strokeWidth: 10 })),
    glowStroke('M76 774H764', '#7af0ff', 2.5, [[4, 0.12], [2.2, 0.3], [1, 1]]),
    path('M90 808H750', { stroke: INK, strokeOpacity: 0.35, strokeWidth: 3, strokeLinecap: 'round' }),
    joystick(206, 742),
    button(352, 726, 13, 'white'), button(398, 726, 13, 'white'),
    button(510, 732, 24, 'cyan'), button(580, 720, 24, 'pink'), button(650, 732, 24, 'gold'));
}

function lowerBody() {
  const slot = (x) => g({},
    path(rr(x, 884, 52, 70, 8), { fill: '#1a1238', stroke: INK, strokeWidth: 3 }),
    path(rr(x + 8, 892, 36, 30, 5), { fill: 'url(#arcSlotLight)', stroke: INK, strokeWidth: 2.5, class: 'karc-slot' }),
    path(circle(x + 26, 907, 8), { fill: 'none', stroke: '#fff', strokeOpacity: 0.85, strokeWidth: 2.5 }),
    path(`M${x + 26} 902V912`, { stroke: '#fff', strokeOpacity: 0.85, strokeWidth: 2.5, strokeLinecap: 'round' }),
    path(rr(x + 22, 930, 8, 18, 4), { fill: '#05030b', stroke: '#8c82b8', strokeWidth: 1.5 }));
  return g({},
    path('M84 834H756V1010H84Z', { fill: 'url(#arcLower)', stroke: INK, strokeWidth: 4 }),
    g({ clipPath: 'url(#arcLowerClip)' },
      path(rays(CX, 1080, 520, 20, 7, 180), { fill: '#c58cff', fillOpacity: 0.1 }),
      [[84, 1, '#ff6ad5'], [756, -1, '#7af0ff']].map(([x0, s, c]) => [0, 1, 2].map((i) =>
        path(`M${x0 - s * 30} ${1000 - i * 34}L${x0 + s * (190 - i * 40)} ${860 - i * 34}`, { stroke: c, strokeOpacity: 0.5 - i * 0.12, strokeWidth: 14 - i * 3, strokeLinecap: 'round' })).join('')).join(''),
      path(star(150, 900, 16, 7) + star(690, 950, 13, 5.5) + star(240, 960, 9, 4) + star(610, 880, 9, 4), { fill: '#ffd166', fillOpacity: 0.85, stroke: INK, strokeWidth: 2 }),
      path(`M84 850H756`, { stroke: '#000', strokeOpacity: 0.3, strokeWidth: 16 })),
    // coin door
    path(rr(330, 862, 180, 116, 14), { fill: INK, fillOpacity: 0.45, transform: 'translate(3 5)' }),
    path(rr(330, 862, 180, 116, 14), { fill: 'url(#arcChrome)', stroke: INK, strokeWidth: 4 }),
    path(rr(338, 870, 164, 100, 9), { fill: 'none', stroke: '#fff', strokeOpacity: 0.55, strokeWidth: 2 }),
    slot(350), slot(438),
    path(cornerGlare(330, 862, 14, 4, 5, 60, 30), { fill: '#fff', fillOpacity: 0.85 }),
    // kick plate
    path(rr(84, 984, 672, 30, 6), { fill: 'url(#arcKick)', stroke: INK, strokeWidth: 4 }),
    path(Array.from({ length: 16 }, (_, i) => `M${130 + i * 38} 994V1004`).join(''), { stroke: INK, strokeOpacity: 0.5, strokeWidth: 5, strokeLinecap: 'round' }));
}

function speakerBand() {
  const holes = (x0) => {
    let d = '';
    for (let i = 0; i < 9; i++) for (let j = 0; j < 2; j++) d += circle(x0 + i * 16 + (j ? 8 : 0), 213 + j * 12, 3.6);
    return d;
  };
  return g({},
    path('M70 206H770V232H70Z', { fill: '#120b2c', stroke: INK, strokeWidth: 4 }),
    path(holes(118) + holes(578), { fill: '#05030b' }),
    path(holes(118) + holes(578), { fill: 'none', stroke: '#6a5aa8', strokeOpacity: 0.55, strokeWidth: 1.2 }),
    path(rr(CX - 70, 212, 140, 14, 7), { fill: 'url(#arcStrip)', stroke: INK, strokeWidth: 2.5 }),
    path(`M${CX - 58} 216H${CX - 20}`, { stroke: '#fff', strokeOpacity: 0.8, strokeWidth: 2.5, strokeLinecap: 'round' }));
}

function draw() {
  const defs = [
    lg('arcSide', [0, 0, 1, 1], [[0, '#4a3aa8'], [0.3, '#2a1f6e'], [1, '#120b33']]),
    lg('arcSideRim', [0, 0, W, H], [[0, '#7af0ff', 0], [0.55, '#7af0ff', 0], [1, '#7af0ff', 0.9]], true),
    lg('arcMarquee', [0, 0, 0, 1], [[0, '#3a1580'], [0.45, '#9b2bb0'], [0.8, '#ff5fc2'], [1, '#ffa6ea']]),
    rg('arcMqGlow', [0.5, 0.5, 0.5], [[0, '#fff2b0', 0.7], [0.5, '#ffd166', 0.25], [1, '#ffd166', 0]]),
    lg('arcChrome', [0, 0, 0, 1], [[0, '#ffffff'], [0.45, '#d9d3f2'], [0.55, '#8f86b8'], [1, '#e2dcff']]),
    rg('arcCoin', [0.4, 0.36, 0.75], [[0, '#fff1b0'], [0.4, '#ffd166'], [0.85, '#f0a21e'], [1, '#c97a0c']]),
    lg('arcBezel', [0, 0, 0, 1], [[0, '#2a1d66'], [0.5, '#1c1448'], [1, '#2e1f6e']]),
    lg('arcDeck', [0, 0, 0, 1], [[0, '#5b44c8'], [0.6, '#3a2a94'], [1, '#2a1d70']]),
    lg('arcDeckFront', [0, 0, 0, 1], [[0, '#ff6ad5'], [0.5, '#c63fb0'], [1, '#7a1f8a']]),
    lg('arcLower', [0, 0, 0, 1], [[0, '#1d1450'], [1, '#2b1d6a']]),
    lg('arcKick', [0, 0, 0, 1], [[0, '#c9c1ea'], [1, '#6f669a']]),
    lg('arcStrip', [0, 0, 1, 0], [[0, '#7af0ff'], [0.5, '#ff6ad5'], [1, '#ffd166']]),
    lg('arcShaft', [0, 0, 1, 0], [[0, '#2a2240'], [0.4, '#9a92c0'], [1, '#2a2240']]),
    rg('arcBall', [0.38, 0.32, 0.8], [[0, '#ffd8f4'], [0.45, '#ff6ad5'], [1, '#a5248a']]),
    rg('arcSlotLight', [0.5, 0.5, 0.7], [[0, '#ffe0f7'], [0.5, '#ff6ad5'], [1, '#b42c94']]),
    ...[['white', '#ffffff', '#e4ddff', '#9a90c8'], ['cyan', '#eafdff', '#7af0ff', '#2a9ac4'], ['pink', '#ffe0f7', '#ff6ad5', '#b42c94'], ['gold', '#fff6cf', '#ffd166', '#c98510']]
      .map(([k, a, b, c]) => rg(`arcBtn-${k}`, [0.5, 0.45, 0.6], [[0, b], [0.6, b], [1, c]]) + lg(`arcBtnSide-${k}`, [0, 0, 1, 0], [[0, c], [0.4, b], [1, c]])).join(''),
    rg('arcFloor', [0.5, 0.5, 0.5], [[0, '#000', 0.6], [0.6, '#000', 0.25], [1, '#000', 0]]),
    rg('arcSpill', [0.5, 0.5, 0.5], [[0, '#ff6ad5', 0.35], [0.6, '#c58cff', 0.12], [1, '#c58cff', 0]]),
    rg('arcFloorGlow', [0.5, 0.5, 0.5], [[0, '#ff6ad5', 0.35], [1, '#ff6ad5', 0]]),
    `<clipPath id="arcMqClip"><path d="${rr(MQ.x, MQ.y, MQ.w, MQ.h, 14)}"/></clipPath>`,
    `<clipPath id="arcBzClip"><path d="${rr(BZ.x, BZ.y, BZ.w, BZ.h, 10)}"/></clipPath>`,
    `<clipPath id="arcFrontClip"><path d="${rr(50, 760, 740, 62, 10)}"/></clipPath>`,
    '<clipPath id="arcLowerClip"><path d="M84 834H756V1010H84Z"/></clipPath>',
    `<clipPath id="arcOutClip"><path d="${OUT}"/></clipPath>`,
    '<style>.karc-slot{animation:karc-slot 1.4s steps(1) infinite}.karc-rays{animation:karc-rays 3s ease-in-out infinite}'
      + '.karc-tw{animation:karc-tw 3.2s ease-in-out infinite;transform-box:fill-box;transform-origin:center}.karc-tw2{animation-delay:1.6s}'
      + '@keyframes karc-slot{0%,59%{opacity:1}60%,100%{opacity:.55}}@keyframes karc-rays{0%,100%{opacity:1}50%{opacity:.5}}'
      + '@keyframes karc-tw{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.45;transform:scale(.7)}}'
      + '@media (prefers-reduced-motion:reduce){*{animation:none!important}}</style>',
  ].join('');

  const body = [
    path(ellipse(CX, 1030, 400, 34), { fill: 'url(#arcFloorGlow)' }),
    path(ellipse(CX, 1024, 380, 22), { fill: 'url(#arcFloor)' }),
    path(ellipse(CX, 110, 420, 130), { fill: 'url(#arcSpill)' }),
    // cabinet sides with pink neon T-molding
    path(OUT, { fill: 'url(#arcSide)' }),
    g({ clipPath: 'url(#arcOutClip)' }, path(OUT, { fill: 'none', stroke: 'url(#arcSideRim)', strokeWidth: 16 })),
    glowStroke(OUT, '#ff6ad5', 5, [[4.5, 0.08], [2.8, 0.18], [1.7, 0.4], [1, 1]]),
    path(OUT, { fill: 'none', stroke: '#ffd2f3', strokeWidth: 1.6 }),
    path(cornerGlare(58, 28, 26, 9, 10, 150, 110), { fill: '#fff', fillOpacity: 0.7 }),
    marquee(),
    speakerBand(),
    bezel(),
    lowerBody(),
    deck(),
    // sparkles
    g({ class: 'karc-tw' }, path(sparkle(28, 120, 22), { fill: '#7af0ff', stroke: INK, strokeWidth: 3 })),
    g({ class: 'karc-tw karc-tw2' }, path(sparkle(814, 300, 20), { fill: '#ff6ad5', stroke: INK, strokeWidth: 3 })),
    path(sparkle(24, 520, 12), { fill: '#ffd166', stroke: INK, strokeWidth: 2.5 }),
    path(sparkle(816, 600, 11), { fill: '#7af0ff', stroke: INK, strokeWidth: 2.5 }),
    path(star(810, 70, 11, 5), { fill: '#ffd166', stroke: INK, strokeWidth: 2.5, strokeLinejoin: 'round' }),
    path(circle(20, 300, 3.5) + circle(824, 450, 3.5) + circle(16, 960, 4) + circle(826, 900, 3.5), { fill: '#fff', fillOpacity: 0.8 }),
  ].join('\n');
  return { defs, body };
}

module.exports = {
  W, H, hole, radius, draw,
  meta: { name: 'Arcade Cabinet', theme: 'arcade', translucent: false,
    desc: 'A midnight upright with neon trim, a glowing gold-coin marquee and candy buttons begging to be mashed.', tags: ['starter', 'arcade', 'cabinet', 'neon', 'retro'] },
};
