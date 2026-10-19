'use strict';
// Bot Buddy: a chibi helper robot in glossy white and blue armour hugging a big tablet to its chest. The
// screen is the tablet's display (blue case, white face, dark glass lip); its round head peeks over the
// top with a glossy blue helmet, a dark visor with huge purple LED eyes, a tiny LED smile and blush,
// cylinder ear pods and a heart-tipped antenna. Mitten hands grip the tablet's sides, blue shoulder caps
// peek out behind its corners and two chunky blue boots stand pigeon-toed below.
// Optional animation: eyes blink, the antenna heart pulses, sparkles twinkle.
const L = require('../lib');
const { rr, path, g, lg, rg, circle, ellipse, sparkle, heart, star, tf, lip, n } = L;

const W = 1300, H = 1450, hole = { x: 290, y: 640, w: 720, h: 405 }, radius = 20;
const CX = W / 2;
const INK = '#1a2050';
const TAB = { x: 222, y: 576, w: 856, h: 536, r: 62 };
const HELMET_D = 'M318 486C300 262 452 104 650 104C848 104 1000 262 982 486C982 524 962 546 930 546H370C338 546 318 524 318 486Z';
const FACE_D = 'M372 404C384 330 500 286 650 286C800 286 916 330 928 404L934 476C934 572 820 628 650 628C480 628 366 572 366 476Z';
const VISOR = { x: 418, y: 366, w: 464, h: 184, r: 88 };

/** Thick rounded limb segment: ink outline, fill, soft top highlight. */
function limb(d, w, fill) {
  return path(d, { fill: 'none', stroke: INK, strokeWidth: w + 10, strokeLinecap: 'round', strokeLinejoin: 'round' })
    + path(d, { fill: 'none', stroke: fill, strokeWidth: w, strokeLinecap: 'round', strokeLinejoin: 'round' })
    + path(d, { fill: 'none', stroke: '#fff', strokeOpacity: 0.6, strokeWidth: n(w * 0.22), strokeLinecap: 'round', transform: `translate(${n(-w * 0.16)} ${n(-w * 0.12)})` });
}

/** Dark ball joint with a glint. */
function joint(cx, cy, r) {
  return path(circle(cx, cy, r), { fill: 'url(#bbJoint)', stroke: INK, strokeWidth: 5 })
    + path(ellipse(cx - r * 0.32, cy - r * 0.36, r * 0.3, r * 0.18), { fill: '#fff', fillOpacity: 0.55, transform: `rotate(-30 ${n(cx - r * 0.32)} ${n(cy - r * 0.36)})` });
}

/** Glossy blue shell piece: fill, cel shadow on the lower right, anime glare on the upper left. */
function bluePiece(d, clipId, glare) {
  return path(d, { fill: 'url(#bbBlue)', stroke: INK, strokeWidth: 6, strokeLinejoin: 'round' })
    + g({ clipPath: `url(#${clipId})` }, glare)
    + path(d, { fill: 'none', stroke: INK, strokeWidth: 6, strokeLinejoin: 'round' });
}

function arm(s) {
  const m = (x) => (s < 0 ? x : W - x);
  const sh = [m(236), 640], el = [m(140), 800], wr = [m(196), 888];
  const upper = `M${sh[0]} ${sh[1]}L${el[0]} ${el[1]}`, fore = `M${el[0]} ${el[1]}L${wr[0]} ${wr[1]}`;
  const cuff = `M${n(el[0] + (wr[0] - el[0]) * 0.42)} ${n(el[1] + (wr[1] - el[1]) * 0.42)}L${wr[0]} ${wr[1]}`;
  return g({},
    // shoulder cap peeking out behind the tablet corner
    path(circle(m(250), 606, 66), { fill: 'url(#bbBlueR)', stroke: INK, strokeWidth: 6 }),
    path(`M${m(206)} 584C${m(214)} 562 ${m(232)} 552 ${m(254)} 550`, { fill: 'none', stroke: '#fff', strokeOpacity: 0.85, strokeWidth: 9, strokeLinecap: 'round' }),
    limb(upper, 50, 'url(#bbWhiteV)'),
    limb(fore, 50, 'url(#bbWhiteV)'),
    limb(cuff, 66, 'url(#bbBlueV)'),
    joint(...el, 30));
}

/** Mitten hand gripping the tablet's side edge (thumb on the front face). */
function hand(s, y) {
  const x = s < 0 ? TAB.x : TAB.x + TAB.w;
  return g({ transform: `translate(${x} ${y}) scale(${s < 0 ? 1 : -1} 1)` },
    path(rr(-74, -44, 82, 92, 38), { fill: 'url(#bbWhite)', stroke: INK, strokeWidth: 6 }),
    path('M-62 4C-50 10 -36 12 -22 10M-60 24C-48 30 -34 32 -20 30', { fill: 'none', stroke: INK, strokeOpacity: 0.3, strokeWidth: 4, strokeLinecap: 'round' }),
    path(ellipse(4, -10, 19, 30), { fill: 'url(#bbWhite)', stroke: INK, strokeWidth: 5, transform: 'rotate(-18 4 -10)' }),
    path(ellipse(-2, -24, 6, 10), { fill: '#fff', transform: 'rotate(-18 -2 -24)' }),
    path('M-58 -26C-50 -36 -36 -40 -24 -38', { fill: 'none', stroke: '#fff', strokeWidth: 6, strokeLinecap: 'round' }));
}

function legs() {
  const boot = (cx, rot) => {
    const d = `M${cx - 48} 1270C${cx - 50} 1250 ${cx + 50} 1250 ${cx + 48} 1270L${cx + 54} 1334C${cx + 86} 1340 ${cx + 96} 1370 ${cx + 90} 1392`
      + `C${cx + 86} 1404 ${cx + 72} 1408 ${cx + 58} 1408H${cx - 58}C${cx - 72} 1408 ${cx - 86} 1404 ${cx - 90} 1392C${cx - 96} 1370 ${cx - 86} 1340 ${cx - 54} 1334Z`;
    return g({ transform: `rotate(${rot} ${cx} 1262)` },
      limb(`M${cx + (cx < CX ? 10 : -10)} 1190L${cx} 1250`, 58, 'url(#bbWhiteV)'),
      joint(cx, 1258, 26),
      path(d, { fill: 'url(#bbBlue)', stroke: INK, strokeWidth: 6, strokeLinejoin: 'round' }),
      path(ellipse(cx, 1366, 58, 26), { fill: '#8cbcff', fillOpacity: 0.45 }),
      path(rr(cx - 56, 1262, 112, 26, 13), { fill: 'url(#bbWhite)', stroke: INK, strokeWidth: 5 }),
      path(`M${cx - 40} 1300C${cx - 42} 1318 ${cx - 52} 1340 ${cx - 70} 1352`, { fill: 'none', stroke: '#fff', strokeOpacity: 0.8, strokeWidth: 8, strokeLinecap: 'round' }),
      path(rr(cx - 96, 1388, 192, 28, 14), { fill: 'url(#bbWhite)', stroke: INK, strokeWidth: 5 }),
      path(`M${cx - 78} 1398H${cx + 40}`, { stroke: '#fff', strokeWidth: 4, strokeLinecap: 'round' }));
  };
  return g({},
    path(ellipse(CX, 1414, 330, 30), { fill: 'url(#bbFloor)' }),
    boot(540, -4), boot(760, 4),
    // hip shell under the tablet
    path('M466 1098C466 1168 548 1204 650 1204C752 1204 834 1168 834 1098Z', { fill: 'url(#bbBlue)', stroke: INK, strokeWidth: 6, strokeLinejoin: 'round' }),
    path('M500 1130C540 1164 600 1176 650 1176', { fill: 'none', stroke: '#fff', strokeOpacity: 0.6, strokeWidth: 7, strokeLinecap: 'round' }),
    path(rr(620, 1150, 60, 26, 13), { fill: '#24294a', stroke: INK, strokeWidth: 3 }),
    path(`${circle(636, 1163, 4.5)}${circle(650, 1163, 4.5)}${circle(664, 1163, 4.5)}`, { fill: '#ff7ad9', class: 'bb-led' }));
}

function eye(cx, cy) {
  const e = ellipse(cx, cy, 58, 66);
  const scan = [];
  for (let y = cy - 60; y < cy + 66; y += 9) scan.push(`M${cx - 60} ${y}H${cx + 60}`);
  return g({},
    path(ellipse(cx, cy, 92, 98), { fill: 'url(#bbEyeGlow)' }),
    g({ class: 'bb-eye' },
      path(e, { fill: 'url(#bbEye)', stroke: '#3a1190', strokeWidth: 5 }),
      g({ clipPath: `url(#bbEyeClip${cx < CX ? 'L' : 'R'})` },
        path(ellipse(cx, cy + 40, 58, 34), { fill: '#6a1fd0', fillOpacity: 0.45 }),
        path(scan.join(''), { stroke: '#3a1190', strokeOpacity: 0.22, strokeWidth: 2.5 })),
      path(ellipse(cx - 20, cy - 26, 20, 14), { fill: '#fff', transform: `rotate(-24 ${cx - 20} ${cy - 26})` }),
      path(circle(cx + 22, cy + 26, 8), { fill: '#fff', fillOpacity: 0.9 }),
      path(sparkle(cx + 24, cy - 30, 9), { fill: '#fff', fillOpacity: 0.9 })));
}

function head() {
  const glare = path('M398 330C404 236 470 168 560 140', { fill: 'none', stroke: '#fff', strokeWidth: 20, strokeLinecap: 'round' })
    + path('M590 132L616 128', { stroke: '#fff', strokeWidth: 14, strokeLinecap: 'round' })
    + path('M330 520C300 380 360 240 460 170C380 260 350 380 370 520Z', { fill: '#fff', fillOpacity: 0.12 })
    + path('M1010 300C1020 420 990 520 930 546H1000V300Z', { fill: '#0f2f8a', fillOpacity: 0.35 })
    + path('M780 140C900 176 966 262 980 400C944 300 880 210 780 140Z', { fill: '#0f2f8a', fillOpacity: 0.3 })
    + path(rr(812, 168, 44, 22, 11), { fill: '#fff', fillOpacity: 0.55, transform: 'rotate(28 834 179)' });
  const pod = (s) => {
    const x = s < 0 ? 246 : W - 246 - 80;
    return g({},
      path(rr(s < 0 ? x + 54 : x - 14, 396, 40, 104, 16), { fill: 'url(#bbJoint)', stroke: INK, strokeWidth: 5 }),
      path(rr(x, 362, 80, 156, 36), { fill: 'url(#bbWhite)', stroke: INK, strokeWidth: 6 }),
      path(rr(x + 14, 392, 52, 96, 24), { fill: 'url(#bbBlue)', stroke: INK, strokeWidth: 4 }),
      path(rr(x + 26, 410, 28, 60, 14), { fill: 'url(#bbWhite)', stroke: INK, strokeWidth: 3 }),
      path(`M${x + 16} 392C${x + 18} 378 ${x + 28} 372 ${x + 40} 372`, { fill: 'none', stroke: '#fff', strokeWidth: 5, strokeLinecap: 'round' }));
  };
  const v = VISOR;
  return g({ transform: 'rotate(-4 650 420)' },
    // antenna
    path('M650 108V54', { stroke: INK, strokeWidth: 14, strokeLinecap: 'round' }),
    path('M650 108V54', { stroke: '#e6edf8', strokeWidth: 6, strokeLinecap: 'round' }),
    path(circle(650, 34, 46), { fill: 'url(#bbEyeGlow)', class: 'bb-pulse' }),
    path(heart(650, 32, 28), { fill: 'url(#bbEye)', stroke: '#3a1190', strokeWidth: 4 }),
    path(ellipse(640, 24, 7, 5), { fill: '#fff', transform: 'rotate(-30 640 24)' }),
    pod(-1), pod(1),
    bluePiece(HELMET_D, 'bbHelmetClip', glare),
    path(ellipse(650, 108, 38, 13), { fill: 'url(#bbBlueV)', stroke: INK, strokeWidth: 4 }),
    path('M626 104Q650 98 674 104', { fill: 'none', stroke: '#fff', strokeOpacity: 0.8, strokeWidth: 3, strokeLinecap: 'round' }),
    // white face plate with a cool cel shadow
    path(FACE_D, { fill: 'url(#bbWhite)', stroke: INK, strokeWidth: 6, strokeLinejoin: 'round' }),
    g({ clipPath: 'url(#bbFaceClip)' },
      path('M934 400C930 520 860 600 740 630H960V400Z', { fill: '#9fb3d8', fillOpacity: 0.45 }),
      path('M392 410C410 352 480 316 560 304', { fill: 'none', stroke: '#fff', strokeWidth: 8, strokeLinecap: 'round' })),
    // visor + eyes
    path(rr(v.x, v.y + 6, v.w, v.h, v.r), { fill: INK, fillOpacity: 0.25 }),
    path(rr(v.x, v.y, v.w, v.h, v.r), { fill: 'url(#bbVisor)', stroke: INK, strokeWidth: 5 }),
    g({ clipPath: 'url(#bbVisorClip)' },
      path(`M${v.x + 40} ${v.y}L${v.x + 120} ${v.y}L${v.x + 30} ${v.y + v.h}L${v.x - 50} ${v.y + v.h}Z`, { fill: '#fff', fillOpacity: 0.07 }),
      path(rr(v.x + 6, v.y + 6, v.w - 12, v.h - 12, v.r - 6), { fill: 'none', stroke: '#7b8cff', strokeOpacity: 0.35, strokeWidth: 3 })),
    eye(548, 456), eye(752, 456),
    path('M630 524Q650 540 670 524', { fill: 'none', stroke: '#e08cff', strokeWidth: 6, strokeLinecap: 'round' }),
    path(rr(452, 514, 44, 12, 6), { fill: '#ff7ad9', fillOpacity: 0.85 }), path(rr(804, 514, 44, 12, 6), { fill: '#ff7ad9', fillOpacity: 0.85 }),
    path(`M${v.x + 34} ${v.y + 60}C${v.x + 40} ${v.y + 36} ${v.x + 60} ${v.y + 20} ${v.x + 90} ${v.y + 16}`, { fill: 'none', stroke: '#fff', strokeOpacity: 0.7, strokeWidth: 6, strokeLinecap: 'round' }));
}

function tablet() {
  const holeD = rr(hole.x, hole.y, hole.w, hole.h, radius), t = TAB;
  return g({},
    path(rr(t.x + 8, t.y + 14, t.w, t.h, t.r), { fill: INK, fillOpacity: 0.3 }),
    path(rr(t.x, t.y, t.w, t.h, t.r), { fill: 'url(#bbBlue)', stroke: INK, strokeWidth: 6 }),
    path(rr(t.x + 13, t.y + 13, t.w - 26, t.h - 26, t.r - 12), { fill: 'url(#bbWhite)', stroke: INK, strokeWidth: 4 }),
    path(rr(t.x + 22, t.y + 22, t.w - 44, t.h - 44, t.r - 20), { fill: 'none', stroke: '#fff', strokeWidth: 3 }),
    path(rr(hole.x - 26, hole.y - 26, hole.w + 52, hole.h + 52, radius + 20), { fill: 'url(#bbGlass)', stroke: '#9fb3d8', strokeWidth: 3 }),
    path(rr(hole.x - 12, hole.y - 12, hole.w + 24, hole.h + 24, radius + 10), { fill: '#0e1236' }),
    lip(holeD, '#000', [[7, 0.3], [3, 0.6]]),
    // front camera + speaker pill
    path(circle(CX, t.y + 38, 7), { fill: '#24294a', stroke: INK, strokeWidth: 2 }), path(circle(CX - 2, t.y + 36, 2.2), { fill: '#7fb2ff' }),
    path(rr(CX - 40, t.y + t.h - 46, 80, 18, 9), { fill: '#24294a', stroke: INK, strokeWidth: 2.5 }),
    path(`${circle(CX - 18, t.y + t.h - 37, 4)}${circle(CX, t.y + t.h - 37, 4)}${circle(CX + 18, t.y + t.h - 37, 4)}`, { fill: '#e08cff', class: 'bb-led' }),
    // glare on the case + white face
    path(`M${t.x + 6} ${t.y + 190}V${t.y + 70}Q${t.x + 6} ${t.y + 6} ${t.x + 70} ${t.y + 6}H${t.x + 280}`, { fill: 'none', stroke: '#fff', strokeOpacity: 0.75, strokeWidth: 5, strokeLinecap: 'round' }),
    path(`M${t.x + 36} ${t.y + 150}V${t.y + 84}Q${t.x + 36} ${t.y + 36} ${t.x + 84} ${t.y + 36}H${t.x + 210}`, { fill: 'none', stroke: '#fff', strokeWidth: 7, strokeLinecap: 'round' }),
    path(`M${t.x + t.w - 36} ${t.y + t.h - 150}V${t.y + t.h - 84}Q${t.x + t.w - 36} ${t.y + t.h - 36} ${t.x + t.w - 84} ${t.y + t.h - 36}H${t.x + t.w - 190}`, { fill: 'none', stroke: '#9fb3d8', strokeWidth: 5, strokeLinecap: 'round' }),
    // stickers on the bottom corners
    path(star(t.x + 36, t.y + t.h - 36, 17, 7.5), { fill: '#ffd166', stroke: '#fff', strokeWidth: 7, strokeLinejoin: 'round', paintOrder: 'stroke' }),
    path(star(t.x + 36, t.y + t.h - 36, 17, 7.5), { fill: 'none', stroke: INK, strokeWidth: 2.5, strokeLinejoin: 'round' }),
    path(heart(t.x + t.w - 36, t.y + t.h - 38, 15), { fill: '#ff7ad9', stroke: '#fff', strokeWidth: 7, strokeLinejoin: 'round', paintOrder: 'stroke' }),
    path(heart(t.x + t.w - 36, t.y + t.h - 38, 15), { fill: 'none', stroke: INK, strokeWidth: 2.5 }));
}

function draw() {
  const defs = [
    '<style>.bb-eye{transform-box:fill-box;transform-origin:center;animation:bbBlink 5s infinite}'
      + '@keyframes bbBlink{0%,92%,100%{transform:scaleY(1)}95%{transform:scaleY(.12)}}'
      + '.bb-pulse{animation:bbPulse 2.2s ease-in-out infinite}@keyframes bbPulse{0%,100%{opacity:1}50%{opacity:.4}}'
      + '.bb-led{animation:bbLed 1.6s steps(1) infinite}@keyframes bbLed{0%{opacity:1}50%{opacity:.45}}'
      + '.bb-tw{transform-box:fill-box;transform-origin:center;animation:bbTw 2.8s ease-in-out infinite}@keyframes bbTw{0%,100%{transform:scale(1)}50%{transform:scale(.6)}}'
      + '@media (prefers-reduced-motion:reduce){*{animation:none!important}}</style>',
    lg('bbBlue', [0, 0, 0.4, 1], [[0, '#8cbcff'], [0.3, '#3d8bff'], [0.7, '#2468f0'], [1, '#1a49c4']]),
    lg('bbBlueV', [0, 0, 0, 1], [[0, '#7fb2ff'], [0.5, '#2f7bff'], [1, '#1a49c4']]),
    rg('bbBlueR', [0.38, 0.32, 0.8], [[0, '#a9cdff'], [0.45, '#3d8bff'], [1, '#1a45b8']]),
    lg('bbWhite', [0, 0, 0.5, 1], [[0, '#ffffff'], [0.55, '#eef3fb'], [1, '#c9d6ec']]),
    lg('bbWhiteV', [0, 0, 0, 1], [[0, '#ffffff'], [0.6, '#e8eef9'], [1, '#b7c6e2']]),
    rg('bbJoint', [0.38, 0.32, 0.8], [[0, '#6a7194'], [0.6, '#3a3f5e'], [1, '#22263e']]),
    lg('bbVisor', [0, 0, 0, 1], [[0, '#2a2f6e'], [0.6, '#161a48'], [1, '#0d1033']]),
    rg('bbEye', [0.45, 0.4, 0.62], [[0, '#fff0ff'], [0.3, '#f0a8ff'], [0.7, '#b65cff'], [1, '#7a2cf0']]),
    rg('bbEyeGlow', [0.5, 0.5, 0.5], [[0.4, '#c46bff', 0.38], [1, '#c46bff', 0]]),
    lg('bbGlass', [0, 0, 0, 1], [[0, '#2a3070'], [1, '#161a48']]),
    rg('bbFloor', [0.5, 0.5, 0.5], [[0, INK, 0.35], [1, INK, 0]]),
    `<clipPath id="bbHelmetClip"><path d="${HELMET_D}"/></clipPath>`,
    `<clipPath id="bbFaceClip"><path d="${FACE_D}"/></clipPath>`,
    `<clipPath id="bbVisorClip"><path d="${rr(VISOR.x, VISOR.y, VISOR.w, VISOR.h, VISOR.r)}"/></clipPath>`,
    `<clipPath id="bbEyeClipL"><path d="${ellipse(548, 456, 58, 66)}"/></clipPath>`,
    `<clipPath id="bbEyeClipR"><path d="${ellipse(752, 456, 58, 66)}"/></clipPath>`,
  ].join('');

  const deco = [
    [heart(150, 260, 26), '#ff7ad9'], [heart(1170, 200, 20), '#c46bff'], [heart(1210, 1180, 18), '#ff7ad9'], [heart(90, 1120, 16), '#7fb2ff'],
  ].map(([d, c]) => path(d, { fill: c, stroke: '#fff', strokeWidth: 7, strokeLinejoin: 'round', paintOrder: 'stroke' }) + path(d, { fill: 'none', stroke: INK, strokeWidth: 3 })).join('');
  const twinkles = [[250, 130, 22, '#c9e0ff'], [1080, 110, 18, '#f0a8ff'], [1210, 470, 16, '#ffffff'], [80, 520, 18, '#f0a8ff'], [1240, 900, 14, '#c9e0ff'], [70, 860, 14, '#ffffff'], [380, 1340, 14, '#c9e0ff'], [940, 1320, 16, '#f0a8ff']]
    .map(([x, y, s, c], i) => g({ class: i % 2 ? 'bb-tw' : null }, path(sparkle(x, y, s), { fill: c, stroke: INK, strokeWidth: 2.5 }))).join('');

  const body = [
    deco, twinkles,
    path(`${circle(1130, 330, 6)}${circle(180, 400, 5)}${circle(1180, 1040, 5)}${circle(140, 980, 6)}${circle(300, 220, 4)}${circle(1010, 230, 4)}`, { fill: '#c46bff', fillOpacity: 0.8 }),
    legs(),
    arm(-1), arm(1),
    head(),
    tablet(),
    hand(-1, 880), hand(1, 900),
  ].join('\n');
  return { defs, body };
}

module.exports = {
  W, H, hole, radius, draw,
  meta: {
    name: 'Bot Buddy', theme: 'robot', rarity: 'rare', translucent: false, collection: 'sci-fi-signals', license: 'CC-BY-4.0',
    desc: 'A little helper robot hugs your game like its favorite tablet and watches every move with big sparkly LED eyes.',
    tags: ['robot', 'cute', 'chibi', 'sci-fi', 'blue', 'kawaii'],
  },
};
