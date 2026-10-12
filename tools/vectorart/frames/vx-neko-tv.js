'use strict';
// Calico cat TV: ears with a ribbon and bell, whiskers, blushing cheeks, a "w" mouth, paws over the
// edge, a striped tail curling up the side, paw-print speaker and a ball of yarn.
const L = require('../lib');
const { rr, path, g, lg, rg, circle, ellipse, sparkle, heart, n } = L;

const W = 1400, H = 1250, hole = { x: 300, y: 380, w: 800, h: 600 }, radius = 40;
const INK = '#45304a';
const BODY = rr(170, 240, 1060, 880, 170);

function ear(tip, a, b, patch, inner) {
  const [tx, ty] = tip, [ax, ay] = a, [bx, by] = b;
  const d = `M${ax} ${ay}Q${n(tx - 30)} ${n(ty + 40)} ${tx} ${ty}Q${n(tx + 30)} ${n(ty + 20)} ${bx} ${by}Z`;
  return path(d, { fill: 'url(#fur)' }) + path(d, { fill: patch }) + path(inner, { fill: 'url(#earPink)' })
    + path(d, { fill: 'none', stroke: INK, strokeWidth: 8, strokeLinejoin: 'round' });
}

function pawPrint(cx, cy, s, fill) {
  return path(ellipse(cx, cy + s * 0.35, s * 0.62, s * 0.5), { fill })
    + [[-0.62, -0.32], [-0.22, -0.66], [0.22, -0.66], [0.62, -0.32]].map(([x, y]) => path(ellipse(cx + x * s, cy + y * s, s * 0.22, s * 0.27), { fill })).join('');
}

function paw(cx, cy) {
  const d = `M${cx - 78} ${cy + 18}C${cx - 80} ${cy - 46} ${cx + 80} ${cy - 46} ${cx + 78} ${cy + 18}C${cx + 76} ${cy + 74} ${cx - 76} ${cy + 74} ${cx - 78} ${cy + 18}Z`;
  return path(ellipse(cx + 4, cy + 62, 74, 12), { fill: INK, fillOpacity: 0.25 })
    + path(d, { fill: 'url(#fur)', stroke: INK, strokeWidth: 8, strokeLinejoin: 'round' })
    + path(`M${cx - 26} ${cy + 34}Q${cx - 26} ${cy + 50} ${cx - 28} ${cy + 62}M${cx + 26} ${cy + 34}Q${cx + 26} ${cy + 50} ${cx + 28} ${cy + 62}`, { fill: 'none', stroke: INK, strokeWidth: 6, strokeLinecap: 'round' })
    + path(ellipse(cx - 34, cy - 6, 24, 10), { fill: '#fff', fillOpacity: 0.85, transform: `rotate(-12 ${cx - 34} ${cy - 6})` });
}

function draw() {
  const defs = [
    lg('fur', [0, 0, 0, 1], [[0, '#fffaf2'], [0.7, '#fbeedd'], [1, '#efd9c1']]),
    lg('orange', [0, 0, 1, 1], [[0, '#ffb867'], [1, '#f08a2e']]),
    lg('choco', [0, 0, 1, 1], [[0, '#7a5240'], [1, '#4a2f25']]),
    lg('earPink', [0, 0, 0, 1], [[0, '#ff9ec4'], [1, '#ffc9de']]),
    lg('bezel', [0, 0, 0, 1], [[0, '#4b3d5e'], [1, '#2a2136']]),
    lg('bezelEdge', [0, 0, 1, 1], [[0, '#7a6a92'], [1, '#1c1526']]),
    lg('shade', [0, 0, 0, 1], [[0, '#fff', 0], [0.75, '#c9a88a', 0], [1, '#9b6f52', 0.28]]),
    lg('ribbon', [0, 0, 0, 1], [[0, '#ff7fb6'], [1, '#e2477f']]),
    rg('bell', [0.38, 0.32, 0.7], [[0, '#fff6c2'], [0.45, '#ffcf3d'], [1, '#c58a00']]),
    rg('blush', [0.5, 0.5, 0.5], [[0, '#ff7fa8', 0.75], [1, '#ff7fa8', 0]]),
    rg('yarn', [0.35, 0.3, 0.75], [[0, '#c9f1ff'], [0.6, '#7fd3f2'], [1, '#3e9cc6']]),
    rg('floor', [0.5, 0.5, 0.5], [[0, '#000', 0.4], [1, '#000', 0]]),
    rg('gloss', [0.5, 0.5, 0.5], [[0, '#fff', 0.85], [1, '#fff', 0]]),
    `<clipPath id="bodyClip"><path d="${BODY}"/></clipPath>`,
  ].join('');

  const tailD = 'M1150 1052C1262 1072 1340 1028 1346 940C1352 870 1334 820 1286 806';
  const tail = g({},
    path(tailD, { fill: 'none', stroke: INK, strokeWidth: 82, strokeLinecap: 'round' }),
    path(tailD, { fill: 'none', stroke: 'url(#orange)', strokeWidth: 66, strokeLinecap: 'round' }),
    path(tailD, { fill: 'none', stroke: '#c9661a', strokeWidth: 66, strokeDasharray: '20 40', strokeDashoffset: -30, strokeOpacity: 0.8 }),
    path(circle(1286, 806, 33), { fill: 'url(#fur)' }),
    path('M1200 1046C1280 1054 1324 1010 1328 944', { fill: 'none', stroke: '#fff', strokeOpacity: 0.35, strokeWidth: 10, strokeLinecap: 'round' }));

  const patches = g({ clipPath: 'url(#bodyClip)' },
    path('M150 220H560C540 300 470 330 420 370C360 420 300 420 240 520C210 570 180 580 150 590Z', { fill: 'url(#orange)' }),
    path('M1250 220H900C930 280 990 300 1040 330C1110 370 1150 420 1250 430Z', { fill: 'url(#choco)' }),
    path('M1250 860C1180 880 1130 960 1150 1140H1250Z', { fill: 'url(#orange)' }),
    path(BODY, { fill: 'url(#shade)' }));

  const whiskers = [-1, 1].map((s) => {
    const x0 = s < 0 ? 196 : 1204;
    return [[-26, -18], [0, 0], [26, 20]].map(([dy, bend]) =>
      path(`M${x0} ${720 + dy}Q${x0 + s * 80} ${710 + dy + bend * 0.5} ${x0 + s * 160} ${720 + dy * 2.6 + bend}`, { fill: 'none', stroke: INK, strokeWidth: 6, strokeLinecap: 'round' })).join('');
  }).join('');

  const yarnLines = [
    'M100 1120C140 1080 210 1080 240 1130', 'M92 1160C150 1110 230 1120 254 1176', 'M110 1206C150 1150 220 1150 240 1210',
    'M120 1090C110 1140 130 1200 170 1230', 'M170 1074C150 1130 170 1200 220 1222'];
  const yarn = g({},
    path(ellipse(175, 1232, 100, 14), { fill: 'url(#floor)' }),
    path('M236 1182C300 1196 360 1170 420 1186C460 1196 476 1180 494 1160', { fill: 'none', stroke: '#3e9cc6', strokeWidth: 6, strokeLinecap: 'round' }),
    path(circle(175, 1150, 82), { fill: 'url(#yarn)', stroke: INK, strokeWidth: 7 }),
    path(yarnLines.join(''), { fill: 'none', stroke: '#2f86ad', strokeOpacity: 0.7, strokeWidth: 5, strokeLinecap: 'round' }),
    path(ellipse(146, 1112, 26, 14), { fill: '#fff', fillOpacity: 0.6, transform: 'rotate(-30 146 1112)' }));

  const bow = g({ transform: 'translate(1080 196) rotate(18)' },
    path('M0 0C-30 -50 -96 -40 -88 0C-96 40 -30 50 0 0Z', { fill: 'url(#ribbon)', stroke: INK, strokeWidth: 6, strokeLinejoin: 'round' }),
    path('M0 0C30 -50 96 -40 88 0C96 40 30 50 0 0Z', { fill: 'url(#ribbon)', stroke: INK, strokeWidth: 6, strokeLinejoin: 'round' }),
    path('M-62 -12Q-40 -24 -20 -8M62 -12Q40 -24 20 -8', { fill: 'none', stroke: '#fff', strokeOpacity: 0.6, strokeWidth: 5, strokeLinecap: 'round' }),
    path(circle(0, 30, 24), { fill: 'url(#bell)', stroke: INK, strokeWidth: 5 }),
    path('M-20 30H20M0 38V54', { stroke: INK, strokeWidth: 4, strokeLinecap: 'round' }),
    path(circle(0, 0, 18), { fill: '#ff6aa2', stroke: INK, strokeWidth: 6 }));

  const body = [
    path(ellipse(700, 1214, 520, 22), { fill: 'url(#floor)' }),
    tail,
    ear([300, 70], [196, 470], [600, 252], 'url(#orange)', 'M258 304Q276 186 306 130Q372 176 482 254Z'),
    ear([1100, 70], [800, 252], [1204, 470], 'url(#choco)', 'M918 254Q1028 176 1094 130Q1124 186 1142 304Z'),
    bow,
    path(rr(178, 256, 1060, 880, 170), { fill: INK, fillOpacity: 0.25 }),
    path(BODY, { fill: 'url(#fur)' }),
    patches,
    path(BODY, { fill: 'none', stroke: INK, strokeWidth: 9 }),
    path('M250 330Q330 262 470 252', { fill: 'none', stroke: '#fff', strokeOpacity: 0.8, strokeWidth: 12, strokeLinecap: 'round' }),
    // screen bezel
    path(rr(250, 330, 900, 700, 84), { fill: 'url(#bezelEdge)', stroke: INK, strokeWidth: 6 }),
    path(rr(262, 342, 876, 676, 76), { fill: 'url(#bezel)' }),
    path(rr(284, 364, 832, 632, 54), { fill: '#120d18' }),
    path('M300 520V440Q300 380 360 380H520', { fill: 'none', stroke: '#fff', strokeOpacity: 0.18, strokeWidth: 6, strokeLinecap: 'round' }),
    // face
    whiskers,
    path(ellipse(596, 1056, 44, 16), { fill: 'url(#blush)' }),
    path(ellipse(804, 1056, 44, 16), { fill: 'url(#blush)' }),
    path('M676 1050Q700 1040 724 1050Q724 1066 700 1074Q676 1066 676 1050Z', { fill: '#ff8fb5', stroke: INK, strokeWidth: 5, strokeLinejoin: 'round' }),
    path('M700 1074V1086M664 1080Q682 1100 700 1086Q718 1100 736 1080', { fill: 'none', stroke: INK, strokeWidth: 6, strokeLinecap: 'round', strokeLinejoin: 'round' }),
    // controls: fish knob + dial, paw-print speaker
    path(circle(350, 1074, 28), { fill: '#ffd3e5', stroke: INK, strokeWidth: 5 }),
    path('M335 1074Q349 1061 364 1074Q349 1087 335 1074ZM364 1074L374 1066V1082Z', { fill: '#ff6aa2' }),
    path(circle(424, 1074, 22), { fill: '#bdf0ff', stroke: INK, strokeWidth: 5 }),
    path('M424 1074L435 1063', { stroke: INK, strokeWidth: 5, strokeLinecap: 'round' }),
    pawPrint(960, 1076, 30, '#6d5878'),
    pawPrint(1032, 1062, 20, '#6d5878'),
    // paws over the edge
    paw(560, 1112),
    paw(840, 1112),
    yarn,
    path(sparkle(120, 300, 26), { fill: '#ffd166' }),
    path(sparkle(1300, 360, 18), { fill: '#7af0ff' }),
    path(sparkle(80, 640, 14), { fill: '#ff8fc7' }),
    path(heart(1300, 220, 18), { fill: '#ff8fc7', stroke: INK, strokeWidth: 4 }),
  ].join('\n');
  return { defs, body };
}

module.exports = {
  W, H, hole, radius, draw,
  meta: { name: 'Neko TV', theme: 'kawaii', rarity: 'common', translucent: false,
    desc: 'A calico cat TV with a ribbon bell, toe-bean paws over the edge and a tail that never stops curling.', tags: ['tv', 'cat', 'cute', 'kawaii'] },
};
