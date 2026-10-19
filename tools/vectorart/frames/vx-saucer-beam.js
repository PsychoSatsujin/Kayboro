'use strict';
// Saucer Beam: a chunky 1950s flying saucer (chrome hull, coral racing stripe, porthole windows, a ring
// of chasing rim lights, a glass dome with a tiny alien waving from inside) hovers over a floating patch
// of farmland. Its tractor beam pours down around the screen, which hangs in the light inside a chrome
// and navy viewscreen bezel; a startled cow and a sleepy sheep drift up the beam's edges, a crop circle
// glows where the beam lands, and atomic-age starbursts twinkle in the sky.
// Optional animation: rim-light chase, rings rising up the beam, the passengers bobbing, antenna blink.
const L = require('../lib');
const { rr, path, g, lg, rg, circle, ellipse, sparkle, tf, rng, lip, glowStroke, n, P } = L;

const W = 1500, H = 1560, hole = { x: 430, y: 600, w: 640, h: 480 }, radius = 18;
const CX = W / 2;
const INK = '#1b1f4a';
const BEAM = { y0: 500, y1: 1440, w0: 400, w1: 640 };
const beamHW = (y) => BEAM.w0 + ((y - BEAM.y0) / (BEAM.y1 - BEAM.y0)) * (BEAM.w1 - BEAM.w0);
const BEAM_D = `M${CX - BEAM.w0} ${BEAM.y0}L${CX + BEAM.w0} ${BEAM.y0}L${CX + BEAM.w1} ${BEAM.y1}A${BEAM.w1} 60 0 0 1 ${CX - BEAM.w1} ${BEAM.y1}Z`;
const ISLE = { cx: CX, cy: 1420, rx: 690, ry: 70 };
const UPPER_D = 'M120 372C250 300 500 262 750 262C1000 262 1250 300 1380 372C1200 394 1000 400 750 400C500 400 300 394 120 372Z';
const DOME_D = 'M528 272C528 130 628 58 750 58C872 58 972 130 972 272Z';
const COW_BODY = 'M-70 -44C-30 -60 40 -58 72 -40C96 -26 98 20 78 40C50 60 -40 62 -70 44C-92 30 -94 -30 -70 -44Z';

/** Atomic-age starburst: thin rays of alternating length around a dot. */
function starburst(cx, cy, R, rays = 8, col = '#fff6c8') {
  let d = '';
  for (let i = 0; i < rays; i++) {
    const a = (i / rays) * Math.PI * 2 - Math.PI / 2, r0 = R * 0.22, r1 = i % 2 ? R * 0.55 : R;
    d += `M${P(cx + r0 * Math.cos(a), cy + r0 * Math.sin(a))}L${P(cx + r1 * Math.cos(a), cy + r1 * Math.sin(a))}`;
  }
  return path(d, { fill: 'none', stroke: col, strokeWidth: n(Math.max(2, R * 0.09)), strokeLinecap: 'round' })
    + path(circle(cx, cy, R * 0.16), { fill: col });
}

/** One rim bulb: halo, lens and glint (narrower toward the saucer's sides). */
function rimLight(x, y, r, k, col, cls) {
  const rx = r * k;
  return g({ class: cls },
    path(ellipse(x, y, rx * 2.2, r * 1.9), { fill: `url(#sbHalo${col})` }),
    path(ellipse(x, y, rx, r), { fill: `url(#sbBulb${col})`, stroke: INK, strokeWidth: 3 }),
    path(ellipse(x - rx * 0.3, y - r * 0.35, rx * 0.32, r * 0.22), { fill: '#fff', fillOpacity: 0.9 }));
}

function porthole(x, y, r) {
  return path(circle(x + 2, y + 3, r + 6), { fill: INK, fillOpacity: 0.3 })
    + path(circle(x, y, r + 6), { fill: 'url(#sbChromeR)', stroke: INK, strokeWidth: 3 })
    + path(circle(x, y, r), { fill: 'url(#sbWarm)', stroke: INK, strokeWidth: 2.5 })
    + path(ellipse(x - r * 0.3, y - r * 0.35, r * 0.35, r * 0.22), { fill: '#fff', fillOpacity: 0.85 });
}

function alien() {
  const sil = '#163f5c';
  return g({ transform: 'translate(750 196)' },
    // antennae
    path('M-20 -50L-40 -92M20 -50L40 -92', { stroke: sil, strokeWidth: 7, strokeLinecap: 'round' }),
    path(circle(-41, -96, 9), { fill: sil }), path(circle(41, -96, 9), { fill: sil }),
    path(circle(-43, -98, 3), { fill: '#d9ff8a' }), path(circle(39, -98, 3), { fill: '#d9ff8a' }),
    // body + waving arm
    path('M-38 80C-38 32 -24 14 0 14C24 14 38 32 38 80Z', { fill: sil }),
    path('M26 34C46 26 60 8 64 -14', { fill: 'none', stroke: sil, strokeWidth: 13, strokeLinecap: 'round' }),
    path(circle(66, -20, 11), { fill: sil }),
    path('M-28 36C-44 46 -50 60 -50 76', { fill: 'none', stroke: sil, strokeWidth: 13, strokeLinecap: 'round' }),
    // head
    path(ellipse(0, -16, 56, 46), { fill: sil }),
    path(ellipse(-21, -14, 15, 20), { fill: '#eaffd0', transform: 'rotate(18 -21 -14)' }),
    path(ellipse(21, -14, 15, 20), { fill: '#eaffd0', transform: 'rotate(-18 21 -14)' }),
    path(ellipse(-18, -10, 8, 12), { fill: sil, transform: 'rotate(18 -18 -10)' }),
    path(ellipse(18, -10, 8, 12), { fill: sil, transform: 'rotate(-18 18 -10)' }),
    path(circle(-21, -16, 3.5), { fill: '#fff' }), path(circle(15, -16, 3.5), { fill: '#fff' }),
    path('M-8 14Q0 20 8 14', { fill: 'none', stroke: '#9fe3c8', strokeWidth: 3, strokeLinecap: 'round' }),
    path(ellipse(-38, 6, 8, 4), { fill: '#ff8fc7', fillOpacity: 0.55 }), path(ellipse(38, 6, 8, 4), { fill: '#ff8fc7', fillOpacity: 0.55 }));
}

function saucer() {
  const lights = [];
  const cls = ['sb-l0', 'sb-l1', 'sb-l2'], cols = ['Y', 'R', 'C'];
  for (let i = 0; i < 13; i++) {
    const a = ((166 - i * 11.33) * Math.PI) / 180, x = CX + 640 * Math.cos(a), y = 412 + 22 * Math.sin(a), k = 0.45 + 0.55 * Math.sin(a);
    lights.push(rimLight(x, y, 14, k, cols[i % 3], cls[i % 3]));
  }
  const seams = 'M560 300C470 312 360 330 250 352M940 300C1030 312 1140 330 1250 352M650 292C600 320 560 360 540 396M850 292C900 320 940 360 960 396';
  const lowSeams = 'M330 440C380 470 420 486 470 494M1170 440C1120 470 1080 486 1030 494M560 470L580 500M940 470L920 500M750 474V502';
  const vents = [];
  for (let i = -2; i <= 2; i++) vents.push(rr(CX + i * 40 - 12, 448, 24, 10, 5));
  return g({},
    // soft shadow + lower hull
    path('M110 392C260 470 520 506 750 506C980 506 1240 470 1390 392Z', { fill: 'url(#sbHullLow)', stroke: INK, strokeWidth: 6, strokeLinejoin: 'round' }),
    path(lowSeams, { fill: 'none', stroke: INK, strokeOpacity: 0.35, strokeWidth: 3, strokeLinecap: 'round' }),
    path(vents.join(''), { fill: '#1c2150', stroke: INK, strokeWidth: 2 }),
    // emitter skirt + glowing lens
    path(ellipse(CX, 500, 452, 52), { fill: 'url(#sbEmitGlow)' }),
    path(ellipse(CX, 492, 414, 34), { fill: 'url(#sbSkirt)', stroke: INK, strokeWidth: 5 }),
    path(ellipse(CX, 500, 388, 22), { fill: 'url(#sbLens)', stroke: INK, strokeWidth: 3 }),
    path(`M${CX - 300} 494Q${CX} 482 ${CX + 300} 494`, { fill: 'none', stroke: '#fff', strokeOpacity: 0.9, strokeWidth: 4, strokeLinecap: 'round' }),
    // rim band
    path(ellipse(CX, 394, 702, 58), { fill: 'url(#sbRim)', stroke: INK, strokeWidth: 6 }),
    path('M74 410C220 438 480 448 750 448C1020 448 1280 438 1426 410', { fill: 'none', stroke: INK, strokeOpacity: 0.22, strokeWidth: 4 }),
    lights.join(''),
    // upper hull with coral stripe, seams and portholes
    path(UPPER_D, { fill: 'url(#sbHullTop)', stroke: INK, strokeWidth: 6, strokeLinejoin: 'round' }),
    g({ clipPath: 'url(#sbHullClip)' },
      path('M100 368C300 386 520 392 750 392C980 392 1200 386 1400 368', { fill: 'none', stroke: '#ff5a6e', strokeWidth: 16 }),
      path('M100 358C300 376 520 382 750 382C980 382 1200 376 1400 358', { fill: 'none', stroke: '#ffb3bd', strokeWidth: 3 }),
      path(seams, { fill: 'none', stroke: INK, strokeOpacity: 0.28, strokeWidth: 3, strokeLinecap: 'round' }),
      path('M200 344C330 300 520 276 700 272', { fill: 'none', stroke: '#fff', strokeWidth: 7, strokeLinecap: 'round' })),
    porthole(330, 340, 15), porthole(470, 314, 16), porthole(1030, 314, 16), porthole(1170, 340, 15),
    // dome
    path(DOME_D, { fill: 'url(#sbDome)', stroke: INK, strokeWidth: 6 }),
    g({ clipPath: 'url(#sbDomeClip)' },
      path(ellipse(750, 300, 260, 120), { fill: 'url(#sbDomeIn)' }),
      g({ opacity: 0.88 }, alien()),
      path(DOME_D, { fill: 'url(#sbDomeShade)' }),
      path('M572 232C566 160 606 104 676 82', { fill: 'none', stroke: '#fff', strokeOpacity: 0.85, strokeWidth: 14, strokeLinecap: 'round' }),
      path('M600 252C598 244 598 236 599 228', { fill: 'none', stroke: '#fff', strokeOpacity: 0.85, strokeWidth: 10, strokeLinecap: 'round' }),
      path(ellipse(712, 92, 16, 9), { fill: '#fff', fillOpacity: 0.9, transform: 'rotate(-18 712 92)' }),
      path('M930 160C944 196 948 226 946 262', { fill: 'none', stroke: '#fff', strokeOpacity: 0.45, strokeWidth: 5, strokeLinecap: 'round' })),
    path(DOME_D, { fill: 'none', stroke: INK, strokeWidth: 6 }),
    // dome collar
    path(ellipse(CX, 274, 246, 28), { fill: 'url(#sbCollar)', stroke: INK, strokeWidth: 5 }),
    path(`M${CX - 210} 268Q${CX} 254 ${CX + 210} 268`, { fill: 'none', stroke: '#fff', strokeOpacity: 0.9, strokeWidth: 4, strokeLinecap: 'round' }),
    ...[-180, -90, 0, 90, 180].map((dx) => path(circle(CX + dx, 281 + Math.abs(dx) * -0.02, 4.5), { fill: '#e8edff', stroke: INK, strokeWidth: 2 })),
    // antenna
    path('M750 60V26', { stroke: INK, strokeWidth: 9, strokeLinecap: 'round' }),
    path('M750 60V26', { stroke: '#dfe6f5', strokeWidth: 4, strokeLinecap: 'round' }),
    g({ class: 'sb-blink' }, path(circle(750, 18, 30), { fill: 'url(#sbHaloR)' })),
    path(circle(750, 18, 12), { fill: 'url(#sbBulbR)', stroke: INK, strokeWidth: 3 }),
    path(circle(746, 14, 3.5), { fill: '#fff' }));
}

function beam() {
  const rings = [], back = [], motes = [];
  for (let y = 520; y <= 1560; y += 110) {
    const hw = beamHW(Math.min(y, BEAM.y1)), ry = 16;
    rings.push(`M${n(CX - hw)} ${y}A${n(hw)} ${ry} 0 0 0 ${n(CX + hw)} ${y}`);
    back.push(`M${n(CX - hw)} ${y}A${n(hw)} ${ry} 0 0 1 ${n(CX + hw)} ${y}`);
  }
  const rnd = rng(11);
  for (let i = 0; i < 70; i++) {
    const y = 520 + rnd() * 900, hw = beamHW(y) - 14, x = CX + (rnd() * 2 - 1) * hw;
    if (x > hole.x - 80 && x < hole.x + hole.w + 80 && y > hole.y - 80 && y < hole.y + hole.h + 80) continue;
    motes.push(i % 6 ? circle(x, y, 2 + rnd() * 2.5) : sparkle(x, y, 9 + rnd() * 6));
  }
  return g({},
    glowStroke(`M${CX - BEAM.w0} ${BEAM.y0}L${CX - BEAM.w1} ${BEAM.y1 - 40}M${CX + BEAM.w0} ${BEAM.y0}L${CX + BEAM.w1} ${BEAM.y1 - 40}`, '#e9ff9a', 12, [[9, 0.035], [7, 0.045], [5, 0.06], [3.4, 0.08], [2.2, 0.11]]),
    path(BEAM_D, { fill: 'url(#sbBeam)' }),
    g({ clipPath: 'url(#sbBeamClip)' },
      path(BEAM_D, { fill: 'url(#sbBeamSide)' }),
      g({ class: 'sb-rings' },
        path(back.join(''), { fill: 'none', stroke: '#fff', strokeOpacity: 0.35, strokeWidth: 4 }),
        path(rings.join(''), { fill: 'none', stroke: '#fff', strokeOpacity: 0.8, strokeWidth: 6, strokeLinecap: 'round' })),
      path(motes.join(''), { fill: '#fff', fillOpacity: 0.85 })),
    path(`M${CX - BEAM.w0} ${BEAM.y0}L${CX - BEAM.w1} ${BEAM.y1}M${CX + BEAM.w0} ${BEAM.y0}L${CX + BEAM.w1} ${BEAM.y1}`, { stroke: '#fff', strokeOpacity: 0.95, strokeWidth: 5, strokeLinecap: 'round' }),
    '');
}

function viewscreen() {
  const holeD = rr(hole.x, hole.y, hole.w, hole.h, radius), o = 64;
  const bx = hole.x - o, by = hole.y - o, bw = hole.w + 2 * o, bh = hole.h + 2 * o;
  const leds = [];
  for (let i = 0; i < 5; i++) leds.push(path(circle(CX - 48 + i * 24, by + 18, 5), { fill: i === 2 ? '#ff5a6e' : '#d9ff8a', stroke: INK, strokeWidth: 2, class: `sb-l${i % 3}` }));
  return g({},
    path(rr(bx + 6, by + 12, bw, bh, 58), { fill: INK, fillOpacity: 0.3 }),
    path(rr(bx, by, bw, bh, 58), { fill: 'url(#sbBezel)', stroke: INK, strokeWidth: 6 }),
    path(rr(bx + 9, by + 9, bw - 18, bh - 18, 50), { fill: 'none', stroke: '#fff', strokeOpacity: 0.55, strokeWidth: 2.5 }),
    path(rr(hole.x - 36, hole.y - 36, hole.w + 72, hole.h + 72, radius + 28), { fill: 'url(#sbNavy)', stroke: INK, strokeWidth: 4 }),
    path(rr(hole.x - 22, hole.y - 22, hole.w + 44, hole.h + 44, radius + 16), { fill: 'none', stroke: '#b8ff8f', strokeOpacity: 0.5, strokeWidth: 2.5 }),
    path(rr(hole.x - 12, hole.y - 12, hole.w + 24, hole.h + 24, radius + 8), { fill: '#0b0d2c' }),
    lip(holeD, '#000', [[7, 0.3], [3, 0.6]]),
    path(`M${bx + 22} ${by + 170}V${by + 66}Q${bx + 22} ${by + 22} ${bx + 66} ${by + 22}H${bx + 230}`, { fill: 'none', stroke: '#fff', strokeOpacity: 0.95, strokeWidth: 7, strokeLinecap: 'round' }),
    path(`M${bx + bw - 22} ${by + bh - 150}V${by + bh - 66}Q${bx + bw - 22} ${by + bh - 22} ${bx + bw - 66} ${by + bh - 22}H${bx + bw - 200}`, { fill: 'none', stroke: INK, strokeOpacity: 0.22, strokeWidth: 6, strokeLinecap: 'round' }),
    // starburst rivets at the corners + status lights on the brow
    ...[[bx + 30, by + 30], [bx + bw - 30, by + 30], [bx + 30, by + bh - 30], [bx + bw - 30, by + bh - 30]].map(([x, y]) => path(circle(x, y, 9), { fill: 'url(#sbChromeR)', stroke: INK, strokeWidth: 2.5 })
      + path(`M${x - 5} ${y}H${x + 5}M${x} ${y - 5}V${y + 5}`, { stroke: INK, strokeOpacity: 0.6, strokeWidth: 2, strokeLinecap: 'round' })),
    path(rr(CX - 66, by + 8, 132, 20, 10), { fill: '#151a45', stroke: INK, strokeWidth: 3 }),
    leds.join(''));
}

function cow(cx, cy, rot) {
  const leg = (x, a) => g({ transform: `rotate(${a} ${x + 12} 30)` },
    path(rr(x, 26, 24, 58, 11), { fill: 'url(#sbCowHide)', stroke: INK, strokeWidth: 4 }),
    path(rr(x - 1, 70, 26, 18, [4, 4, 9, 9]), { fill: '#3a3550', stroke: INK, strokeWidth: 4 }));
  return g({ transform: tf(cx, cy, rot) }, g({ class: 'sb-bob' },
    path(ellipse(0, 0, 150, 110), { fill: 'url(#sbPassGlow)' }),
    path('M86 2C108 8 118 26 112 46', { fill: 'none', stroke: INK, strokeWidth: 9, strokeLinecap: 'round' }),
    path('M86 2C108 8 118 26 112 46', { fill: 'none', stroke: '#fffaf0', strokeWidth: 4, strokeLinecap: 'round' }),
    path('M112 46C104 52 106 66 116 70C124 62 122 50 112 46Z', { fill: '#3a3550', stroke: INK, strokeWidth: 3, strokeLinejoin: 'round' }),
    leg(42, -14), leg(-58, 16),
    path(COW_BODY, { fill: 'url(#sbCowHide)', stroke: INK, strokeWidth: 5 }),
    g({ clipPath: 'url(#sbCowClip)' },
      path(`${ellipse(-26, -34, 28, 18)}${ellipse(34, 12, 30, 22)}${ellipse(70, -38, 20, 15)}${ellipse(-52, 30, 18, 12)}`, { fill: '#2e2f5a' }),
      path(ellipse(-10, 40, 60, 16), { fill: INK, fillOpacity: 0.12 })),
    path('M-56 -38C-30 -50 10 -52 40 -46', { fill: 'none', stroke: '#fff', strokeWidth: 5, strokeLinecap: 'round' }),
    leg(10, -6), leg(-30, 10),
    // head
    g({ transform: 'translate(-98 -46) rotate(-12)' },
      path(ellipse(-48, -20, 20, 9), { fill: 'url(#sbCowHide)', stroke: INK, strokeWidth: 4, transform: 'rotate(-22 -48 -20)' }),
      path(ellipse(48, -20, 20, 9), { fill: 'url(#sbCowHide)', stroke: INK, strokeWidth: 4, transform: 'rotate(22 48 -20)' }),
      path(ellipse(-50, -20, 11, 4), { fill: '#ffb3c7', transform: 'rotate(-22 -50 -20)' }),
      path(ellipse(50, -20, 11, 4), { fill: '#ffb3c7', transform: 'rotate(22 50 -20)' }),
      path('M-26 -36C-30 -52 -24 -60 -16 -62C-18 -54 -18 -46 -14 -38Z', { fill: '#fff1c4', stroke: INK, strokeWidth: 3.5, strokeLinejoin: 'round' }),
      path('M26 -36C30 -52 24 -60 16 -62C18 -54 18 -46 14 -38Z', { fill: '#fff1c4', stroke: INK, strokeWidth: 3.5, strokeLinejoin: 'round' }),
      path('M-38 -6C-38 -34 -20 -44 0 -44C20 -44 38 -34 38 -6C38 20 26 40 0 40C-26 40 -38 20 -38 -6Z', { fill: 'url(#sbCowHide)', stroke: INK, strokeWidth: 5 }),
      path('M8 -42C24 -40 34 -28 34 -14C24 -18 12 -24 8 -42Z', { fill: '#2e2f5a' }),
      path(ellipse(0, 22, 32, 20), { fill: 'url(#sbMuzzle)', stroke: INK, strokeWidth: 4 }),
      path(`${ellipse(-11, 20, 4, 5.5)}${ellipse(11, 20, 4, 5.5)}`, { fill: '#a8566e' }),
      path(ellipse(0, 34, 6, 6.5), { fill: '#5a2440' }),
      path(`${circle(-15, -8, 8)}${circle(15, -8, 8)}`, { fill: INK }),
      path(`${circle(-17, -11, 3)}${circle(13, -11, 3)}`, { fill: '#fff' }),
      path('M-24 -22Q-16 -30 -8 -24M24 -22Q16 -30 8 -24', { fill: 'none', stroke: INK, strokeWidth: 3, strokeLinecap: 'round' })),
    // collar bell
    path('M-112 -6Q-96 6 -76 -2', { fill: 'none', stroke: '#ff5a6e', strokeWidth: 7, strokeLinecap: 'round' }),
    path('M-100 2C-108 2 -110 14 -108 20H-88C-86 14 -88 2 -96 2Z', { fill: 'url(#sbGold)', stroke: INK, strokeWidth: 3, strokeLinejoin: 'round' }),
    path(circle(-98, 22, 3), { fill: INK })));
}

function sheep(cx, cy, rot) {
  const wool = [[0, 0, 44], [-38, -4, 30], [38, -6, 30], [-24, -32, 28], [12, -38, 30], [40, -28, 22], [-30, 24, 26], [6, 30, 28], [38, 22, 22]];
  const woolD = wool.map(([x, y, r]) => circle(x, y, r)).join('');
  const legs = [[-30, 2], [-8, -4], [14, 6], [32, -2]].map(([x, a]) => path(rr(x - 6, 30, 12, 40, 6), { fill: '#3a3550', stroke: INK, strokeWidth: 3, transform: `rotate(${a} ${x} 30)` })).join('');
  return g({ transform: tf(cx, cy, rot) }, g({ class: 'sb-bob2' },
    path(ellipse(0, 0, 120, 96), { fill: 'url(#sbPassGlow)' }),
    legs,
    path(woolD, { fill: '#fff', stroke: INK, strokeWidth: 10 }),
    path(woolD, { fill: 'url(#sbWool)' }),
    path(`${circle(-20, -36, 8)}${circle(10, -44, 7)}${circle(-40, -10, 6)}`, { fill: '#fff' }),
    // head
    path(ellipse(-60, 6, 9, 18), { fill: '#3a3550', stroke: INK, strokeWidth: 3, transform: 'rotate(60 -60 6)' }),
    path(ellipse(-48, -2, 22, 26), { fill: 'url(#sbSheepFace)', stroke: INK, strokeWidth: 4 }),
    path(`${circle(-56, -26, 10)}${circle(-42, -28, 10)}`, { fill: '#fff', stroke: INK, strokeWidth: 3 }),
    path(`${circle(-56, -26, 9)}${circle(-42, -28, 9)}`, { fill: '#fff' }),
    path('M-60 -4Q-55 0 -50 -4M-44 -5Q-39 -1 -34 -5', { fill: 'none', stroke: '#fff', strokeWidth: 3, strokeLinecap: 'round' }),
    path(`${ellipse(-62, 6, 4, 2.5)}${ellipse(-34, 5, 4, 2.5)}`, { fill: '#ff8fb3', fillOpacity: 0.8 }),
    path('M-50 12Q-47 15 -44 12', { fill: 'none', stroke: '#fff', strokeOpacity: 0.7, strokeWidth: 2.5, strokeLinecap: 'round' })));
}

function island() {
  const { cx, cy, rx, ry } = ISLE;
  const top = ellipse(cx, cy, rx, ry);
  const soil = `M${cx - rx} ${cy}C${cx - rx + 30} ${cy + 80} ${cx - 360} ${cy + 124} ${cx} ${cy + 128}C${cx + 360} ${cy + 124} ${cx + rx - 30} ${cy + 80} ${cx + rx} ${cy}A${rx} ${ry} 0 0 1 ${cx - rx} ${cy}Z`;
  const strata = `M${cx - 600} ${cy + 74}C${cx - 300} ${cy + 104} ${cx + 300} ${cy + 104} ${cx + 600} ${cy + 74}M${cx - 420} ${cy + 104}C${cx - 200} ${cy + 118} ${cx + 200} ${cy + 118} ${cx + 420} ${cy + 104}`;
  const rnd = rng(5), pebbles = [], tufts = [], flowers = [];
  for (let i = 0; i < 16; i++) pebbles.push(ellipse(cx - 560 + rnd() * 1120, cy + 70 + rnd() * 40, 5 + rnd() * 6, 3 + rnd() * 3));
  for (let i = 0; i < 17; i++) {
    const a = Math.PI * (0.05 + 0.9 * (i / 16)), x = cx - rx * Math.cos(a) * 0.985 + (rnd() - 0.5) * 20, y = cy + ry * Math.sin(a) * 0.985 + 2, k = 0.8 + rnd() * 0.6;
    tufts.push(`M${P(x - 10 * k, y)}Q${P(x - 9 * k, y - 9 * k)} ${P(x - 12 * k, y - 15 * k)}Q${P(x - 4 * k, y - 10 * k)} ${P(x - 2 * k, y - 5 * k)}`
      + `Q${P(x - 1 * k, y - 15 * k)} ${P(x + 2 * k, y - 22 * k)}Q${P(x + 5 * k, y - 12 * k)} ${P(x + 4 * k, y - 5 * k)}`
      + `Q${P(x + 7 * k, y - 11 * k)} ${P(x + 13 * k, y - 13 * k)}Q${P(x + 9 * k, y - 7 * k)} ${P(x + 9 * k, y)}Z`);
  }
  for (const [x, y, c] of [[260, 1438, '#ffd166'], [1080, 1468, '#ff8fb3'], [420, 1472, '#fff'], [1260, 1440, '#ffd166'], [600, 1480, '#ff8fb3']])
    flowers.push(path(circle(x, y, 5), { fill: c, stroke: INK, strokeWidth: 2 }));
  const crop = [[300, 40], [205, 27], [110, 15]].map(([a, b]) => ellipse(cx, cy + 18, a, b)).join('');
  const base = g({},
    path(ellipse(cx, cy + 112, rx * 0.95, 40), { fill: 'url(#sbFloor)' }),
    path(soil, { fill: 'url(#sbSoil)', stroke: INK, strokeWidth: 6, strokeLinejoin: 'round' }),
    path(strata, { fill: 'none', stroke: '#3a2230', strokeOpacity: 0.35, strokeWidth: 4, strokeLinecap: 'round' }),
    path(pebbles.join(''), { fill: '#c99a7a', stroke: INK, strokeOpacity: 0.5, strokeWidth: 2 }),
    path(`M${cx - 200} ${cy + 124}C${cx - 196} ${cy + 140} ${cx - 210} ${cy + 150} ${cx - 220} ${cy + 156}M${cx + 160} ${cy + 126}C${cx + 168} ${cy + 140} ${cx + 160} ${cy + 148} ${cx + 172} ${cy + 158}`, { fill: 'none', stroke: '#6b4a3a', strokeWidth: 4, strokeLinecap: 'round' }),
    path(top, { fill: 'url(#sbGrass)', stroke: INK, strokeWidth: 6 }));
  // drawn over the beam's faded foot: the landing glow, the crop circle, grass and flowers
  const over = g({},
    g({ clipPath: 'url(#sbIsleClip)' },
      path(ellipse(cx, cy + 10, 600, 76), { fill: 'url(#sbPool)' }),
      path(crop, { fill: 'none', stroke: '#2a7a50', strokeOpacity: 0.55, strokeWidth: 9 }),
      path(crop, { fill: 'none', stroke: '#f2ffcf', strokeWidth: 4 }),
      path(`M${cx - 300} ${cy + 18}H${cx + 300}M${cx} ${cy - 22}V${cy + 58}`, { fill: 'none', stroke: '#f2ffcf', strokeOpacity: 0.6, strokeWidth: 3 })),
    path(`M${cx - rx} ${cy}A${rx} ${ry} 0 0 0 ${cx + rx} ${cy}`, { fill: 'none', stroke: '#2a7a50', strokeWidth: 8, transform: 'translate(0 -5)' }),
    path(tufts.join(''), { fill: '#5cc27c', stroke: INK, strokeWidth: 2.5, strokeLinejoin: 'round' }),
    flowers.join(''));
  return { base, over };
}

function haystack(x, y) {
  const d = `M${x - 70} ${y}C${x - 70} ${y - 60} ${x - 40} ${y - 96} ${x} ${y - 96}C${x + 40} ${y - 96} ${x + 70} ${y - 60} ${x + 70} ${y}Z`;
  const straws = `M${x - 46} ${y - 14}L${x - 30} ${y - 60}M${x - 18} ${y - 8}L${x - 6} ${y - 74}M${x + 12} ${y - 12}L${x + 20} ${y - 80}M${x + 40} ${y - 10}L${x + 34} ${y - 56}M${x - 60} ${y - 40}L${x - 72} ${y - 50}M${x + 58} ${y - 44}L${x + 74} ${y - 54}`;
  return path(ellipse(x + 6, y + 4, 80, 12), { fill: INK, fillOpacity: 0.3 })
    + path(d, { fill: 'url(#sbHay)', stroke: INK, strokeWidth: 5, strokeLinejoin: 'round' })
    + path(straws, { fill: 'none', stroke: '#b8862e', strokeWidth: 3, strokeLinecap: 'round' })
    + path(`M${x - 40} ${y - 70}C${x - 26} ${y - 86} ${x - 8} ${y - 90} ${x + 6} ${y - 88}`, { fill: 'none', stroke: '#fff6c8', strokeOpacity: 0.85, strokeWidth: 5, strokeLinecap: 'round' });
}

function fence() {
  const posts = [[1206, 1450], [1276, 1438], [1346, 1424], [1410, 1408]];
  const rail = (dy) => `M${posts[0][0] - 20} ${posts[0][1] + dy + 6}L${posts[3][0] + 18} ${posts[3][1] + dy - 6}`;
  return g({},
    path(rail(-44) + rail(-20), { stroke: INK, strokeWidth: 15, strokeLinecap: 'round' }),
    path(rail(-44) + rail(-20), { stroke: 'url(#sbWood)', strokeWidth: 9, strokeLinecap: 'round' }),
    ...posts.map(([x, y]) => path(`M${x - 9} ${y}V${y - 70}L${x} ${y - 80}L${x + 9} ${y - 70}V${y}Z`, { fill: 'url(#sbWood)', stroke: INK, strokeWidth: 4, strokeLinejoin: 'round' })
      + path(`M${x - 4} ${y - 66}V${y - 8}`, { stroke: '#fff', strokeOpacity: 0.4, strokeWidth: 3, strokeLinecap: 'round' })));
}

function draw() {
  const defs = [
    '<style>.sb-l0,.sb-l1,.sb-l2{animation:sbChase 1.5s steps(1) infinite}.sb-l1{animation-delay:-.5s}.sb-l2{animation-delay:-1s}'
      + '@keyframes sbChase{0%{opacity:1}33%{opacity:.35}}'
      + '.sb-rings{animation:sbRise 2.6s linear infinite}@keyframes sbRise{from{transform:translateY(0)}to{transform:translateY(-110px)}}'
      + '.sb-bob,.sb-bob2{transform-box:fill-box;transform-origin:center;animation:sbBob 3.4s ease-in-out infinite alternate}.sb-bob2{animation-duration:4.1s;animation-delay:-1.5s}'
      + '@keyframes sbBob{from{transform:translateY(8px) rotate(-3deg)}to{transform:translateY(-10px) rotate(3deg)}}'
      + '.sb-blink{animation:sbBlink 1.8s steps(1,end) infinite}@keyframes sbBlink{0%{opacity:1}50%{opacity:.15}}'
      + '@media (prefers-reduced-motion:reduce){*{animation:none!important}}</style>',
    lg('sbHullTop', [0, 0, 0, 1], [[0, '#ffffff'], [0.5, '#e3e9f7'], [1, '#a9b3d3']]),
    lg('sbRim', [0, 0, 0, 1], [[0, '#c5cde8'], [0.4, '#ffffff'], [0.62, '#9aa4c8'], [1, '#5b6492']]),
    lg('sbHullLow', [0, 0, 0, 1], [[0, '#9aa4c8'], [0.5, '#6b75a3'], [1, '#3c4373']]),
    lg('sbSkirt', [0, 0, 0, 1], [[0, '#d6dcf0'], [0.5, '#8a94bb'], [1, '#4a5283']]),
    rg('sbLens', [0.5, 0.3, 0.7], [[0, '#ffffff'], [0.5, '#f2ffcf'], [1, '#b8ff8f']]),
    rg('sbEmitGlow', [0.5, 0.5, 0.5], [[0.5, '#e9ff9a', 0.38], [1, '#e9ff9a', 0]]),
    lg('sbCollar', [0, 0, 0, 1], [[0, '#ffffff'], [0.45, '#cfd6ee'], [1, '#7c86b0']]),
    lg('sbDome', [0, 0, 1, 1], [[0, '#e6fdff'], [0.45, '#9de6f4'], [1, '#4aa9d0']]),
    rg('sbDomeIn', [0.5, 0.5, 0.5], [[0, '#c9ffe8', 0.6], [1, '#c9ffe8', 0]]),
    lg('sbDomeShade', [0, 0, 1, 0], [[0, '#fff', 0.1], [0.6, '#fff', 0], [1, '#1b4f7a', 0.3]]),
    rg('sbChromeR', [0.38, 0.32, 0.8], [[0, '#ffffff'], [0.5, '#cfd6ee'], [1, '#6b75a3']]),
    rg('sbWarm', [0.4, 0.35, 0.75], [[0, '#fffbe0'], [0.5, '#ffd166'], [1, '#e08a2a']]),
    rg('sbBulbY', [0.4, 0.35, 0.75], [[0, '#fffbe0'], [0.5, '#ffd166'], [1, '#d08a1a']]),
    rg('sbBulbR', [0.4, 0.35, 0.75], [[0, '#ffe0e4'], [0.5, '#ff5a6e'], [1, '#b8243a']]),
    rg('sbBulbC', [0.4, 0.35, 0.75], [[0, '#e9feff'], [0.5, '#7af0ff'], [1, '#2a9fc8']]),
    rg('sbHaloY', [0.5, 0.5, 0.5], [[0, '#ffd166', 0.38], [1, '#ffd166', 0]]),
    rg('sbHaloR', [0.5, 0.5, 0.5], [[0, '#ff5a6e', 0.38], [1, '#ff5a6e', 0]]),
    rg('sbHaloC', [0.5, 0.5, 0.5], [[0, '#7af0ff', 0.38], [1, '#7af0ff', 0]]),
    lg('sbBeam', [0, BEAM.y0, 0, BEAM.y1 + 60], [[0, '#f4ffcf'], [0.3, '#cdff9a'], [0.68, '#93f2c0'], [0.86, '#86eec6'], [0.945, '#86eec6', 0.22], [1, '#86eec6', 0.12]], true),
    lg('sbBeamSide', [0, 0, 1, 0], [[0, '#fff', 0.6], [0.14, '#fff', 0], [0.5, '#fff', 0.18], [0.86, '#fff', 0], [1, '#fff', 0.6]]),
    lg('sbBezel', [0, 0, 1, 1], [[0, '#ffffff'], [0.35, '#e6ebf8'], [0.7, '#a8b2d4'], [1, '#d9dff2']]),
    lg('sbNavy', [0, 0, 0, 1], [[0, '#2a3070'], [1, '#161a48']]),
    lg('sbFin', [0, 0, 0, 1], [[0, '#ff8a98'], [0.5, '#ff5a6e'], [1, '#c2334c']]),
    rg('sbPassGlow', [0.5, 0.5, 0.5], [[0, '#ffffff', 0.38], [1, '#ffffff', 0]]),
    lg('sbCowHide', [0, 0, 1, 1], [[0, '#ffffff'], [0.6, '#fff6ea'], [1, '#e6d9cc']]),
    lg('sbMuzzle', [0, 0, 0, 1], [[0, '#ffd0dc'], [1, '#f39ab3']]),
    rg('sbGold', [0.4, 0.35, 0.75], [[0, '#fffbe0'], [0.5, '#ffd166'], [1, '#b8781a']]),
    rg('sbWool', [0.4, 0.3, 0.8], [[0, '#ffffff'], [0.7, '#f7f3ea'], [1, '#ddd3c4']]),
    lg('sbSheepFace', [0, 0, 1, 1], [[0, '#5a5578'], [1, '#2e2a46']]),
    lg('sbGrass', [0, 0, 0, 1], [[0, '#4fb070'], [0.6, '#358a5a'], [1, '#246a4a']]),
    lg('sbSoil', [0, 0, 0, 1], [[0, '#9a6a52'], [0.6, '#7a4d3e'], [1, '#55333a']]),
    rg('sbPool', [0.5, 0.5, 0.5], [[0, '#f2ffcf', 0.75], [0.6, '#b8ff8f', 0.4], [1, '#b8ff8f', 0]]),
    rg('sbFloor', [0.5, 0.5, 0.5], [[0, INK, 0.35], [1, INK, 0]]),
    lg('sbHay', [0, 0, 0, 1], [[0, '#ffe7a0'], [0.6, '#f2c45a'], [1, '#c98f2a']]),
    lg('sbWood', [0, 0, 1, 0], [[0, '#c9925e'], [1, '#8a5a3a']]),
    `<clipPath id="sbBeamClip"><path d="${BEAM_D}"/></clipPath>`,
    `<clipPath id="sbHullClip"><path d="${UPPER_D}"/></clipPath>`,
    `<clipPath id="sbDomeClip"><path d="${DOME_D}"/></clipPath>`,
    `<clipPath id="sbCowClip"><path d="${COW_BODY}"/></clipPath>`,
    `<clipPath id="sbIsleClip"><path d="${ellipse(ISLE.cx, ISLE.cy, ISLE.rx - 3, ISLE.ry - 3)}"/></clipPath>`,
  ].join('');

  // night sky: dots, sparkles and atomic starbursts kept to the outer corners
  const rnd = rng(42), dots = [];
  for (let i = 0; i < 60; i++) {
    const x = 20 + rnd() * 1460, y = 20 + rnd() * 1300;
    if (y > 230 && y < 520) continue; // saucer band
    if (Math.abs(x - CX) < beamHW(Math.max(y, BEAM.y0)) + 40 && y > 440) continue; // beam
    if (y < 240 && Math.abs(x - CX) < 260) continue; // dome
    dots.push(circle(x, y, 1.6 + rnd() * 2.4));
  }

  const isle = island();
  const body = [
    path(dots.join(''), { fill: '#fff', fillOpacity: 0.85 }),
    // crescent moon
    path('M172 92A62 62 0 1 0 236 186A48 48 0 1 1 172 92Z', { fill: 'url(#sbHay)', stroke: INK, strokeWidth: 4 }),
    path('M148 120C134 140 132 164 142 184', { fill: 'none', stroke: '#fff', strokeOpacity: 0.7, strokeWidth: 4, strokeLinecap: 'round' }),
    starburst(1360, 120, 34), starburst(1290, 230, 18, 8, '#7af0ff'), starburst(80, 300, 22, 8, '#d9ff8a'),
    starburst(110, 760, 26), starburst(1400, 690, 30, 8, '#d9ff8a'), starburst(1440, 1040, 18, 8, '#7af0ff'), starburst(60, 1080, 18, 8, '#ffb3bd'),
    path(sparkle(400, 120, 18), { fill: '#fff6c8' }), path(sparkle(1120, 90, 14), { fill: '#bff6ff' }), path(sparkle(1240, 560, 14), { fill: '#fff' }), path(sparkle(230, 600, 16), { fill: '#fff6c8' }),
    isle.base,
    beam(),
    isle.over,
    haystack(176, 1424), fence(),
    saucer(),
    viewscreen(),
    cow(300, 1236, -14),
    sheep(1226, 1218, 12),
  ].join('\n');
  return { defs, body };
}

module.exports = {
  W, H, hole, radius, draw,
  meta: {
    name: 'Saucer Beam', theme: 'ufo', rarity: 'epic', translucent: false, collection: 'sci-fi-signals', license: 'CC-BY-4.0',
    desc: 'A chrome flying saucer beams your game down to a tiny farm, while a startled cow and a sleepy sheep float up for the ride.',
    tags: ['ufo', 'alien', 'retro', 'sci-fi', 'farm', 'cute'],
  },
};
