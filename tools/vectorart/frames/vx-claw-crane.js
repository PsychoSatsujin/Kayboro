'use strict';
// Claw crane prize machine: mint cabinet with pink + chrome trims, a bulb-lit marquee with a plush
// mascot on the roof, a gantry rail and claw hanging just above the prize window (the opening), a heap
// of original plushies in the pit behind a glass ledge, and a control deck with joystick, dome GO
// button, coin slot and prize door. Marquee bulbs chase (steps timing); the claw sways a little.
const L = require('../lib');
const { rr, path, g, lg, rg, circle, ellipse, sparkle, star, heart, tf, lip, P } = L;

const W = 1300, H = 1750, hole = { x: 290, y: 650, w: 720, h: 540 }, radius = 18;
const INK = '#3a2d4f';
const CX = 650;
const MARQ = { x: 90, y: 150, w: 1120, h: 240 };
const CASE = { x: 160, y: 420, w: 980, h: 980 };
const CLAW_X = 470, RAIL_Y = 448;
const DECK_T = 1400, DECK_F = 1444, LOW = 1522, LEDGE = 1334;

const ink = (w = 5) => ({ stroke: INK, strokeWidth: w, strokeLinejoin: 'round' });
const shine = (x, y, rx, ry, rot = -25, a = 0.75) => path(ellipse(x, y, rx, ry), { fill: '#fff', fillOpacity: a, transform: `rotate(${rot} ${x} ${y})` });

/** Points spaced evenly along a rounded rect (r = [tl, tr, br, bl]). */
function ringPoints(x, y, w, h, r, step) {
  const [a, b, c, d] = r, segs = [];
  const line = (x1, y1, x2, y2) => segs.push({ len: Math.hypot(x2 - x1, y2 - y1), at: (t) => [x1 + (x2 - x1) * t, y1 + (y2 - y1) * t] });
  const arc = (cx, cy, rad, a0) => rad && segs.push({ len: (Math.PI / 2) * rad, at: (t) => { const ang = ((a0 + 90 * t) * Math.PI) / 180; return [cx + rad * Math.cos(ang), cy + rad * Math.sin(ang)]; } });
  line(x + a, y, x + w - b, y); arc(x + w - b, y + b, b, -90);
  line(x + w, y + b, x + w, y + h - c); arc(x + w - c, y + h - c, c, 0);
  line(x + w - c, y + h, x + d, y + h); arc(x + d, y + h - d, d, 90);
  line(x, y + h - d, x, y + a); arc(x + a, y + a, a, 180);
  const total = segs.reduce((s, q) => s + q.len, 0), count = Math.max(3, Math.round(total / step / 3) * 3), out = [];
  for (let i = 0; i < count; i++) {
    let dist = (i * total) / count;
    for (const s of segs) { if (dist <= s.len) { out.push(s.at(dist / s.len)); break; } dist -= s.len; }
  }
  return out;
}

// ---------- plushies (local coords, head ~ r50) ----------
const eyes = (dx, y, r = 5.5) => path(circle(-dx, y, r) + circle(dx, y, r), { fill: INK })
  + path(circle(-dx - 1.6, y - 2, r * 0.36) + circle(dx - 1.6, y - 2, r * 0.36), { fill: '#fff' });
const blush = (dx, y, rx = 9, ry = 5.5) => path(ellipse(-dx, y, rx, ry) + ellipse(dx, y, rx, ry), { fill: '#ff7fae', fillOpacity: 0.55 });
const smile = (y, w = 7) => path(`M${-w} ${y}Q0 ${y + w * 0.9} ${w} ${y}`, { fill: 'none', stroke: INK, strokeWidth: 4, strokeLinecap: 'round' });
const wMouth = (y) => path(`M-9 ${y}Q-4.5 ${y + 6} 0 ${y}Q4.5 ${y + 6} 9 ${y}`, { fill: 'none', stroke: INK, strokeWidth: 3.5, strokeLinecap: 'round', strokeLinejoin: 'round' });

function bear(x, y, s, rot = 0) {
  return g({ transform: tf(x, y, rot, s) },
    path(circle(-36, -38, 19) + circle(36, -38, 19), { fill: 'url(#ccBear)', ...ink() }),
    path(circle(-36, -38, 9) + circle(36, -38, 9), { fill: '#f7a9bd' }),
    path(circle(0, 0, 50), { fill: 'url(#ccBear)', ...ink() }),
    path(ellipse(0, 17, 22, 16), { fill: '#fbe6cf' }),
    path(ellipse(0, 10, 7, 5), { fill: INK }),
    path('M0 14V19M-7 21Q0 27 7 21', { fill: 'none', stroke: INK, strokeWidth: 3, strokeLinecap: 'round' }),
    eyes(19, -5), blush(31, 10),
    path('M0 -50V-30', { stroke: '#9c6a45', strokeWidth: 2.5, strokeDasharray: '4 4' }),
    shine(-22, -28, 12, 6));
}

function blob(x, y, s, rot = 0) {
  const d = 'M-60 32C-64 -22 -30 -58 0 -58C34 -58 64 -22 60 32C58 52 -58 52 -60 32Z';
  return g({ transform: tf(x, y, rot, s) },
    path(d, { fill: 'url(#ccBlob)', ...ink() }),
    path('M-14 -58Q-6 -76 6 -70', { fill: 'none', stroke: INK, strokeWidth: 4, strokeLinecap: 'round' }),
    eyes(20, -6, 6), blush(34, 10), smile(6, 9),
    shine(-28, -30, 14, 7));
}

function starPlush(x, y, s, rot = 0) {
  const d = star(0, 4, 62, 30);
  return g({ transform: tf(x, y, rot, s) },
    path(d, { fill: INK, stroke: INK, strokeWidth: 22, strokeLinejoin: 'round' }),
    path(d, { fill: 'url(#ccStar)', stroke: 'url(#ccStar)', strokeWidth: 12, strokeLinejoin: 'round' }),
    eyes(13, 2, 5), blush(24, 14, 7, 4.5), wMouth(12),
    shine(-16, -22, 9, 5, -35, 0.8));
}

function fish(x, y, s, rot = 0) {
  return g({ transform: tf(x, y, rot, s) },
    path('M46 0L84 -30Q74 0 84 30Z', { fill: 'url(#ccFish)', ...ink() }),
    path('M-4 -30Q12 -54 30 -34Z', { fill: '#ffb3d1', ...ink(4) }),
    path('M-64 0C-44 -40 30 -44 54 0C30 44 -44 40 -64 0Z', { fill: 'url(#ccFish)', ...ink() }),
    path('M8 -24Q20 0 8 24M24 -18Q34 0 24 18', { fill: 'none', stroke: '#3d8fc9', strokeWidth: 3.5, strokeLinecap: 'round' }),
    path(circle(-32, -6, 7), { fill: INK }), path(circle(-34, -9, 2.6), { fill: '#fff' }),
    path(ellipse(-38, 10, 7, 4), { fill: '#ff7fae', fillOpacity: 0.5 }),
    path('M-56 8Q-50 14 -44 10', { fill: 'none', stroke: INK, strokeWidth: 3, strokeLinecap: 'round' }),
    shine(-18, -22, 14, 5, -12));
}

function bunny(x, y, s, rot = 0) {
  return g({ transform: tf(x, y, rot, s) },
    path(ellipse(-20, -60, 14, 36), { fill: 'url(#ccBunny)', ...ink(), transform: 'rotate(-12 -20 -60)' }),
    path(ellipse(22, -58, 14, 36), { fill: 'url(#ccBunny)', ...ink(), transform: 'rotate(16 22 -58)' }),
    path(ellipse(-20, -58, 6, 24), { fill: '#ffb3cf', transform: 'rotate(-12 -20 -58)' }),
    path(ellipse(22, -56, 6, 24), { fill: '#ffb3cf', transform: 'rotate(16 22 -56)' }),
    path(ellipse(0, 0, 48, 42), { fill: 'url(#ccBunny)', ...ink() }),
    eyes(17, -2, 5), blush(29, 12), wMouth(10),
    shine(-22, -20, 11, 6));
}

function puff(x, y, s, rot = 0) {
  return g({ transform: tf(x, y, rot, s) },
    path('M-34 -22L-28 -54L-8 -38ZM34 -22L28 -54L8 -38Z', { fill: 'url(#ccPuff)', ...ink() }),
    path(circle(0, 0, 42), { fill: 'url(#ccPuff)', ...ink() }),
    path('M-24 -6Q-17 -13 -10 -6M10 -6Q17 -13 24 -6', { fill: 'none', stroke: INK, strokeWidth: 4, strokeLinecap: 'round' }),
    blush(24, 8, 7, 4.5), smile(6, 6),
    shine(-18, -20, 10, 5));
}

// ---------- big pieces ----------
function mascot() {
  const x = CX;
  return g({},
    path(ellipse(x, 168, 96, 9), { fill: INK, fillOpacity: 0.3 }),
    // ears (mint inside)
    path(circle(x - 64, 50, 27) + circle(x + 64, 50, 27), { fill: 'url(#ccMascot)', ...ink(6) }),
    path(circle(x - 64, 52, 13) + circle(x + 64, 52, 13), { fill: '#8fe6c8' }),
    // body
    path(`M${x - 94} 118C${x - 94} 58 ${x - 52} 34 ${x} 34C${x + 52} 34 ${x + 94} 58 ${x + 94} 118C${x + 94} 166 ${x + 56} 184 ${x} 184C${x - 56} 184 ${x - 94} 166 ${x - 94} 118Z`, { fill: 'url(#ccMascot)', ...ink(6) }),
    path(`M${x - 72} 96C${x - 66} 64 ${x - 40} 50 ${x - 10} 48`, { fill: 'none', stroke: '#fff', strokeOpacity: 0.9, strokeWidth: 7, strokeLinecap: 'round' }),
    path(ellipse(x, 146, 44, 30), { fill: '#fff4e6', fillOpacity: 0.9 }),
    // face
    path(ellipse(x - 30, 104, 9, 11) + ellipse(x + 30, 104, 9, 11), { fill: INK }),
    path(circle(x - 33, 100, 3.6) + circle(x + 27, 100, 3.6), { fill: '#fff' }),
    path(ellipse(x - 52, 122, 13, 7) + ellipse(x + 52, 122, 13, 7), { fill: '#ff7fae', fillOpacity: 0.6 }),
    path(`M${x - 10} 120Q${x - 5} 127 ${x} 120Q${x + 5} 127 ${x + 10} 120`, { fill: 'none', stroke: INK, strokeWidth: 4.5, strokeLinecap: 'round', strokeLinejoin: 'round' }),
    // a little crane-claw hair clip pinching a tuft on top of the head
    clawClip(x + 4, 18),
    // arm holding a coin
    path(circle(x + 92, 140, 24), { fill: 'url(#ccGold)', ...ink(5) }),
    path(star(x + 92, 141, 12, 5.5), { fill: '#fff6c8' }),
    path(ellipse(x + 72, 148, 18, 14), { fill: 'url(#ccMascot)', ...ink(5) }),
    path(ellipse(x - 80, 150, 18, 14), { fill: 'url(#ccMascot)', ...ink(5) }),
    // dangling feet over the marquee edge
    [-34, 34].map((dx) => path(ellipse(x + dx, 188, 24, 18), { fill: 'url(#ccMascot)', ...ink(5) })
      + path(ellipse(x + dx, 192, 10, 8), { fill: '#8fe6c8' })).join(''));
}

/** Tiny mint claw clip (the mascot's signature accessory) gripping a curl of fur. */
function clawClip(x, y) {
  const prongs = `M${x - 10} ${y + 10}C${x - 26} ${y + 14} ${x - 24} ${y + 30} ${x - 12} ${y + 34}`
    + `M${x + 10} ${y + 10}C${x + 26} ${y + 14} ${x + 24} ${y + 30} ${x + 12} ${y + 34}`;
  return g({},
    path(`M${x - 4} ${y + 26}Q${x - 2} ${y + 8} ${x + 8} ${y + 14}Q${x + 2} ${y + 18} ${x + 4} ${y + 26}Z`, { fill: 'url(#ccMascot)', ...ink(4) }),
    path(prongs, { fill: 'none', stroke: INK, strokeWidth: 10, strokeLinecap: 'round' }),
    path(prongs, { fill: 'none', stroke: '#e6e8fa', strokeWidth: 4.5, strokeLinecap: 'round' }),
    path(rr(x - 18, y, 36, 15, 7), { fill: 'url(#ccMintHi)', ...ink(4) }),
    path(`M${x - 11} ${y + 4}H${x - 2}`, { stroke: '#fff', strokeOpacity: 0.9, strokeWidth: 3, strokeLinecap: 'round' }),
    path(circle(x, y + 7.5, 3), { fill: '#ff6fae' }));
}

function marquee() {
  const { x, y, w, h } = MARQ;
  const panel = rr(x + 58, y + 58, w - 116, h - 116, [62, 62, 8, 8]);
  const rays = [];
  for (let i = 0; i < 24; i++) {
    const a0 = (i * 15 * Math.PI) / 180, a1 = ((i * 15 + 7.5) * Math.PI) / 180, R = 700, cy = y + h / 2 + 4;
    if (i % 2) rays.push(`M${CX} ${cy}L${P(CX + R * Math.cos(a0), cy + R * Math.sin(a0))}L${P(CX + R * Math.cos(a1), cy + R * Math.sin(a1))}Z`);
  }
  const bulbs = bulbSet(ringPoints(x + 29, y + 29, w - 58, h - 58, [92, 92, 8, 8], 56), 13, '#fff0d2', 3.5, 0.35, 'ccBulbGlow', 'ccBulb');
  const ey = y + h / 2 + 4;
  const emblem = g({},
    // heart prize held by a tiny claw
    path(heart(CX, ey + 12, 50), { fill: INK, transform: 'translate(3 6)', fillOpacity: 0.35 }),
    path(heart(CX, ey + 12, 50), { fill: 'url(#ccHeart)', ...ink(6) }),
    shine(CX - 26, ey - 8, 14, 8, -30, 0.85),
    path(`M${CX} ${y + 58}V${ey - 34}`, { stroke: INK, strokeWidth: 5 }),
    path(`M${CX - 30} ${ey - 34}H${CX + 30}`, { stroke: INK, strokeWidth: 12, strokeLinecap: 'round' }),
    path(`M${CX - 30} ${ey - 34}H${CX + 30}`, { stroke: '#eef0ff', strokeWidth: 6, strokeLinecap: 'round' }),
    path(`M${CX - 28} ${ey - 32}C${CX - 56} ${ey - 10} ${CX - 52} ${ey + 14} ${CX - 40} ${ey + 22}M${CX + 28} ${ey - 32}C${CX + 56} ${ey - 10} ${CX + 52} ${ey + 14} ${CX + 40} ${ey + 22}`,
      { fill: 'none', stroke: INK, strokeWidth: 12, strokeLinecap: 'round' }),
    path(`M${CX - 28} ${ey - 32}C${CX - 56} ${ey - 10} ${CX - 52} ${ey + 14} ${CX - 40} ${ey + 22}M${CX + 28} ${ey - 32}C${CX + 56} ${ey - 10} ${CX + 52} ${ey + 14} ${CX + 40} ${ey + 22}`,
      { fill: 'none', stroke: '#eef0ff', strokeWidth: 5.5, strokeLinecap: 'round' }));
  const side = (sx, s) => path(star(sx, ey + 4, 40 * s, 18 * s), { fill: 'url(#ccStarGold)', ...ink(5) })
    + shine(sx - 8 * s, ey - 8 * s, 7 * s, 4 * s, -30, 0.85);
  return g({},
    path(rr(x + 4, y + 10, w, h, [120, 120, 20, 20]), { fill: INK, fillOpacity: 0.35 }),
    path(rr(x, y, w, h, [120, 120, 20, 20]), { fill: 'url(#ccMintHi)', ...ink(7) }),
    path(`M${x + 20} ${y + 120}C${x + 20} ${y + 50} ${x + 60} ${y + 18} ${x + 130} ${y + 18}H${x + 420}`, { fill: 'none', stroke: '#fff', strokeOpacity: 0.8, strokeWidth: 7, strokeLinecap: 'round' }),
    path(panel, { fill: 'url(#ccMarq)', ...ink(5) }),
    g({ clipPath: 'url(#ccPanelClip)' },
      path(rays.join(''), { fill: '#fff', fillOpacity: 0.16 }),
      path(ellipse(CX, ey, 260, 110), { fill: 'url(#ccMarqGlow)' }),
      path(rr(x + 58, y + 58, w - 116, 30, 0), { fill: '#fff', fillOpacity: 0.12 })),
    path(panel, { fill: 'none', stroke: '#fff', strokeOpacity: 0.35, strokeWidth: 3, transform: 'translate(0 3)' }),
    side(CX - 230, 1), side(CX + 230, 1), side(CX - 380, 0.7), side(CX + 380, 0.7),
    path(sparkle(CX - 150, ey - 36, 14) + sparkle(CX + 150, ey + 40, 12) + sparkle(CX + 300, ey - 40, 10) + sparkle(CX - 300, ey + 42, 10), { fill: '#fff' }),
    emblem,
    bulbs,
    // pink trim under the marquee
    path(rr(100, y + h - 6, 1100, 34, 12), { fill: 'url(#ccPink)', ...ink(6) }),
    path(`M118 ${y + h + 2}H1182`, { stroke: '#fff', strokeOpacity: 0.6, strokeWidth: 4, strokeLinecap: 'round' }));
}

/**
 * A run of chase bulbs: shadows, sockets and catchlights are merged into one path per set, and the lit
 * parts are grouped by chase phase (glow/bulb stay separate paths for their bounding-box gradients).
 * `pts` entries are [x, y] or [x, y, phase].
 */
function bulbSet(pts, r, socket, sw, shA, glowId, bulbId) {
  const k = r / 13;
  let out = path(pts.map(([x, y]) => circle(x + 1.5 * k, y + 3 * k, r)).join(''), { fill: INK, fillOpacity: shA })
    + path(pts.map(([x, y]) => circle(x, y, r)).join(''), { fill: socket, stroke: INK, strokeWidth: sw });
  for (let p = 0; p < 3; p++) {
    const on = pts.filter((q, i) => (q[2] ?? i) % 3 === p);
    out += g({ class: `cc-b cc-p${p}` },
      on.map(([x, y]) => path(circle(x, y, r * 1.85), { fill: `url(#${glowId})` }) + path(circle(x, y, r * 0.88), { fill: `url(#${bulbId})` })).join(''),
      path(on.map(([x, y]) => circle(x - 4 * k, y - 4 * k, 3.5 * k)).join(''), { fill: '#fff' }));
  }
  return out;
}

function pillarBulbs() {
  const pts = [];
  for (let y = 470, i = 0; y <= 1370; y += 60, i++) for (const x of [135, 1165]) pts.push([x, y, i]);
  return bulbSet(pts, 10, '#ffe6f1', 3, 0.3, 'ccPinkGlow', 'ccBulbPink');
}

function caseInterior() {
  const { x, y, w, h } = CASE;
  return g({},
    path(rr(x, y, w, h, 14), { fill: 'url(#ccCaseBg)' }),
    g({ clipPath: 'url(#ccCaseClip)' },
      path(rr(x, y, w, h, 0), { fill: 'url(#ccDots)' }),
      path(ellipse(CX, y, 560, 220), { fill: 'url(#ccLamp)' }),
      path(ellipse(CX, y + h, 560, 160), { fill: 'url(#ccPitGlow)' }),
      // LED strip under the roof
      path(rr(x, y, w, 12, 0), { fill: '#fff', fillOpacity: 0.5 }),
      path(rr(x, y + 12, w, 6, 0), { fill: '#ffc6e2', fillOpacity: 0.35 })));
}

function gantry() {
  const ry = RAIL_Y, X = CLAW_X;
  const chromeLine = (d, w) => path(d, { fill: 'none', stroke: INK, strokeWidth: w + 8, strokeLinecap: 'round', strokeLinejoin: 'round' })
    + path(d, { fill: 'none', stroke: 'url(#ccChromeV)', strokeWidth: w, strokeLinecap: 'round', strokeLinejoin: 'round' });
  // prong tips + stroke stay above y 600 (bezel outer edge ~603, opening at 650)
  const prong = (s) => chromeLine(`M${X + s * 22} 528C${X + s * 70} 532 ${X + s * 88} 550 ${X + s * 84} 568C${X + s * 80} 582 ${X + s * 62} 588 ${X + s * 48} 580`, 12);
  const claw = g({ class: 'cc-claw' },
    path(`M${X} ${ry + 14}V488`, { stroke: INK, strokeWidth: 9 }),
    path(`M${X} ${ry + 14}V488`, { stroke: '#e6e8fa', strokeWidth: 4 }),
    prong(-1), prong(1),
    path(`M${X} 532V578`, { stroke: INK, strokeWidth: 20, strokeLinecap: 'round' }),
    path(`M${X} 532V578`, { stroke: '#d6d9ee', strokeWidth: 12, strokeLinecap: 'round' }),
    path(`M${X - 2.5} 540V568`, { stroke: '#fff', strokeWidth: 3.5, strokeLinecap: 'round' }),
    path(`M${X - 45} 488H${X + 45}L${X + 34} 538H${X - 34}Z`, { fill: 'url(#ccPink)', ...ink(5) }),
    path(rr(X - 52, 480, 104, 16, 8), { fill: 'url(#ccChrome)', ...ink(4) }),
    path(circle(X, 514, 10), { fill: '#fff6c8', stroke: INK, strokeWidth: 3.5 }),
    path(`M${X - 30} 502L${X - 25} 528`, { stroke: '#fff', strokeOpacity: 0.85, strokeWidth: 5, strokeLinecap: 'round' }));
  return g({},
    // back rail (faint), front rail with end brackets
    path(`M${CASE.x} ${ry - 20}H${CASE.x + CASE.w}`, { stroke: '#fff', strokeOpacity: 0.12, strokeWidth: 6 }),
    path(rr(CASE.x - 4, ry - 10, CASE.w + 8, 20, 10), { fill: 'url(#ccChrome)', ...ink(5) }),
    path(`M${CASE.x + 10} ${ry - 4}H${CASE.x + CASE.w - 10}`, { stroke: '#fff', strokeOpacity: 0.9, strokeWidth: 3, strokeLinecap: 'round' }),
    path(rr(CASE.x - 2, ry - 22, 26, 44, 8) + rr(CASE.x + CASE.w - 24, ry - 22, 26, 44, 8), { fill: 'url(#ccPink)', ...ink(4) }),
    // carriage
    path(rr(X - 56, ry - 20, 112, 38, 13), { fill: INK, fillOpacity: 0.35, transform: 'translate(3 6)' }),
    path(rr(X - 56, ry - 20, 112, 38, 13), { fill: 'url(#ccMintHi)', ...ink(5) }),
    path(circle(X - 30, ry - 4, 8.5) + circle(X + 30, ry - 4, 8.5), { fill: 'url(#ccChromeV)', ...ink(3.5) }),
    path(`M${X - 44} ${ry - 12}H${X - 18}`, { stroke: '#fff', strokeOpacity: 0.85, strokeWidth: 4, strokeLinecap: 'round' }),
    path(circle(X, ry + 6, 5), { fill: '#ff6fae', stroke: INK, strokeWidth: 2.5 }),
    claw);
}

/** Pastel pennant garland sagging across the right of the gantry bay. */
function garland() {
  const x0 = 700, x1 = 1096, y0 = RAIL_Y + 16, sag = 52, cols = ['#ff8fc0', '#fff1a6', '#9cefd2', '#d9c6ff'];
  const at = (t) => [x0 + (x1 - x0) * t, y0 + sag * 4 * t * (1 - t)];
  let flags = '';
  for (let i = 1; i < 10; i++) {
    const t = i / 10, [x, y] = at(t), slope = (sag * 4 * (1 - 2 * t)) / (x1 - x0), a = Math.atan(slope) * 180 / Math.PI;
    flags += g({ transform: tf(x, y, a) },
      path('M-15 0H15L0 28Z', { fill: cols[i % 4], stroke: INK, strokeWidth: 3.5, strokeLinejoin: 'round' }),
      path('M-9 3H3', { stroke: '#fff', strokeOpacity: 0.7, strokeWidth: 3, strokeLinecap: 'round' }));
  }
  const d = `M${x0} ${y0}Q${(x0 + x1) / 2} ${y0 + sag * 2} ${x1} ${y0}`;
  // little hooks clipped onto the gantry rail
  const hooks = [x0, x1].map((hx) => `M${hx} ${RAIL_Y + 6}V${y0}`).join('');
  const pins = path(hooks, { fill: 'none', stroke: INK, strokeWidth: 6, strokeLinecap: 'round' })
    + path(hooks, { fill: 'none', stroke: '#e6e8fa', strokeWidth: 2.5, strokeLinecap: 'round' })
    + path(circle(x0, y0, 7) + circle(x1, y0, 7), { fill: '#ff8fc0', stroke: INK, strokeWidth: 3 });
  return path(d, { fill: 'none', stroke: INK, strokeWidth: 4 }) + flags + pins;
}

function pile() {
  // the whole heap is clipped to the glass case so nothing pokes out onto the pillars
  return g({ clipPath: 'url(#ccCaseClip)' },
    // deep layer, softly shaded, fills the gaps of the heap
    bunny(282, 1304, 0.85, -14), bear(560, 1300, 0.85, 6), blob(742, 1302, 0.9, -6), starPlush(910, 1300, 0.8, 18), bear(1050, 1250, 0.7, -8),
    path(rr(CASE.x, 1170, CASE.w, 230, 0), { fill: 'url(#ccPitShade)' }),
    // side stacks climbing up beside the window frame
    fish(212, 1060, 0.76, -36),
    bear(206, 1150, 0.98, -12),
    starPlush(1096, 1078, 0.82, 16),
    bunny(1090, 1190, 0.9, 10),
    // back row, tucked behind the window frame
    puff(330, 1250, 0.85, -8),
    blob(450, 1268, 1.0, -4),
    fish(640, 1262, 1.0, -6),
    bear(830, 1268, 0.92, 8),
    blob(980, 1262, 0.85, 10),
    // front row, behind the glass ledge
    starPlush(210, 1300, 0.86, -10),
    bunny(368, 1358, 0.9, -6),
    puff(540, 1360, 0.95, 6),
    starPlush(718, 1356, 0.78, -14),
    fish(880, 1360, 0.9, 6),
    puff(1072, 1320, 0.92, -6));
}

function bezel() {
  const o = 44, b = 32, i = 13;
  const holeD = rr(hole.x, hole.y, hole.w, hole.h, radius);
  return g({},
    path(rr(hole.x - o + 4, hole.y - o + 10, hole.w + o * 2, hole.h + o * 2, radius + o), { fill: INK, fillOpacity: 0.45 }),
    path(rr(hole.x - o, hole.y - o, hole.w + o * 2, hole.h + o * 2, radius + o), { fill: 'url(#ccChrome)', ...ink(6) }),
    path(rr(hole.x - b, hole.y - b, hole.w + b * 2, hole.h + b * 2, radius + b), { fill: 'url(#ccPinkV)', stroke: INK, strokeOpacity: 0.5, strokeWidth: 3 }),
    path(rr(hole.x - i, hole.y - i, hole.w + i * 2, hole.h + i * 2, radius + i), { fill: '#1e1830', stroke: '#5b4a7c', strokeWidth: 3 }),
    lip(holeD, '#000', [[7, 0.3], [3, 0.6]]),
    path(`M${hole.x - b + 8} ${hole.y + 120}V${hole.y - b + 40}Q${hole.x - b + 8} ${hole.y - b + 8} ${hole.x - b + 40} ${hole.y - b + 8}H${hole.x + 200}`,
      { fill: 'none', stroke: '#fff', strokeOpacity: 0.8, strokeWidth: 5, strokeLinecap: 'round' }),
    [[hole.x - b + 12, hole.y + hole.h + b - 12], [hole.x + hole.w + b - 12, hole.y - b + 12], [hole.x + hole.w + b - 12, hole.y + hole.h + b - 12]]
      .map(([x, y]) => path(circle(x, y, 5), { fill: '#fff', fillOpacity: 0.85, stroke: INK, strokeOpacity: 0.6, strokeWidth: 2 })).join(''));
}

function glass() {
  const { x, y, w, h } = CASE, ly = LEDGE;
  return g({},
    // glass ledge in front of the prize pit
    path(rr(x, ly, w, y + h - ly, [0, 0, 14, 14]), { fill: 'url(#ccGlass)' }),
    path(`M${x} ${ly}H${x + w}`, { stroke: INK, strokeWidth: 9 }),
    path(`M${x} ${ly}H${x + w}`, { stroke: '#eef0ff', strokeWidth: 4.5 }),
    path(`M${x + 40} ${ly + 44}L${x + 76} ${ly + 12}M${x + 70} ${ly + 50}L${x + 96} ${ly + 26}M${x + w - 170} ${ly + 50}L${x + w - 128} ${ly + 14}`,
      { stroke: '#fff', strokeOpacity: 0.55, strokeWidth: 6, strokeLinecap: 'round' }),
    // glare on the upper glass
    path(`M${x + w - 66} ${y + 164}L${x + w - 22} ${y + 120}M${x + w - 58} ${y + 186}L${x + w - 16} ${y + 144}M${x + 18} ${y + 140}L${x + 56} ${y + 98}`,
      { stroke: '#fff', strokeOpacity: 0.35, strokeWidth: 7, strokeLinecap: 'round' }),
    // case frame
    path(rr(x, y, w, h, 14), { fill: 'none', stroke: INK, strokeWidth: 16 }),
    path(rr(x, y, w, h, 14), { fill: 'none', stroke: 'url(#ccChromeV)', strokeWidth: 8 }));
}

function deck() {
  const ty = DECK_T, fy = DECK_F;
  const top = `M112 ${ty}H1188L1234 ${fy}H66Z`;
  const jx = 318, gx = 984;
  const joystick = g({},
    path(ellipse(jx, ty + 24, 58, 15), { fill: INK, fillOpacity: 0.35, transform: 'translate(4 4)' }),
    path(ellipse(jx, ty + 22, 58, 15), { fill: 'url(#ccChrome)', ...ink(5) }),
    path(ellipse(jx, ty + 20, 30, 8), { fill: '#2a2140' }),
    path(rr(jx - 7, ty - 66, 14, 88, 7), { fill: 'url(#ccChromeV)', ...ink(4) }),
    path(circle(jx, ty - 82, 36), { fill: 'url(#ccBall)', ...ink(6) }),
    shine(jx - 13, ty - 96, 13, 8, -35, 0.85));
  const go = g({},
    path(ellipse(gx + 4, ty + 26, 96, 22), { fill: INK, fillOpacity: 0.35 }),
    path(ellipse(gx, ty + 22, 96, 22), { fill: 'url(#ccPink)', ...ink(5) }),
    path(ellipse(gx, ty + 20, 80, 16), { fill: '#c9467f' }),
    path(`M${gx - 78} ${ty + 20}C${gx - 78} ${ty - 66} ${gx + 78} ${ty - 66} ${gx + 78} ${ty + 20}C${gx + 60} ${ty + 34} ${gx - 60} ${ty + 34} ${gx - 78} ${ty + 20}Z`, { fill: 'url(#ccGo)', ...ink(6) }),
    path(`M${gx - 56} ${ty - 6}C${gx - 52} ${ty - 34} ${gx - 30} ${ty - 44} ${gx - 6} ${ty - 46}`, { fill: 'none', stroke: '#fff', strokeOpacity: 0.85, strokeWidth: 8, strokeLinecap: 'round' }),
    // arrow glyph (down = drop the claw)
    path(`M${gx - 12} ${ty - 22}H${gx + 12}V${ty - 4}H${gx + 24}L${gx} ${ty + 18}L${gx - 24} ${ty - 4}H${gx - 12}Z`, { fill: '#fff', fillOpacity: 0.95, stroke: '#c96a12', strokeWidth: 3, strokeLinejoin: 'round' }));
  const leds = [0, 1, 2].map((i) => path(heart(CX - 45 + i * 45, ty + 21, 11), { fill: i < 2 ? '#ff6fae' : '#5b4a7c' })).join('');
  return g({},
    path(top, { fill: 'url(#ccDeckTop)', ...ink(6) }),
    path(`M126 ${ty + 8}H1174`, { stroke: '#fff', strokeOpacity: 0.85, strokeWidth: 4, strokeLinecap: 'round' }),
    path(rr(66, fy, 1168, 78, [0, 0, 24, 24]), { fill: 'url(#ccPinkV)', ...ink(6) }),
    path(`M80 ${fy + 12}H1220`, { stroke: '#fff', strokeOpacity: 0.55, strokeWidth: 4, strokeLinecap: 'round' }),
    path(Array.from({ length: 22 }, (_, i) => circle(104 + i * 52.5, fy + 44, 6)).join(''), { fill: '#fff', fillOpacity: 0.75 }),
    path(rr(CX - 75, ty + 8, 150, 28, 14), { fill: '#2a2140', ...ink(4) }),
    leds,
    joystick, go);
}

function lowerCabinet() {
  const y0 = LOW;
  const slot = 300;
  const coin = g({},
    path(rr(196, y0 + 22, 210, 112, 18), { fill: INK, fillOpacity: 0.35, transform: 'translate(3 6)' }),
    path(rr(196, y0 + 22, 210, 112, 18), { fill: 'url(#ccChrome)', ...ink(5) }),
    path(rr(slot - 10, y0 + 42, 20, 70, 10), { fill: '#1e1830', stroke: '#ffd166', strokeWidth: 4 }),
    path(circle(238, y0 + 62, 20), { fill: 'url(#ccGold)', ...ink(4) }),
    path(star(238, y0 + 63, 10, 4.5), { fill: '#fff6c8' }),
    path(`M228 ${y0 + 96}L238 ${y0 + 110}L248 ${y0 + 96}Z`, { fill: '#ff6fae', ...ink(2.5) }),
    path(circle(362, y0 + 62, 15), { fill: 'url(#ccBall)', ...ink(4) }),
    path(circle(358, y0 + 58, 4), { fill: '#fff', fillOpacity: 0.85 }),
    path(rr(346, y0 + 92, 32, 10, 5), { fill: '#2a2140' }));
  const door = g({},
    path(rr(752, y0 + 16, 330, 116, 24), { fill: '#241c38', ...ink(6) }),
    path(rr(766, y0 + 28, 302, 92, 16), { fill: 'url(#ccFlap)', ...ink(4) }),
    path(rr(766, y0 + 28, 302, 14, [16, 16, 0, 0]), { fill: 'url(#ccChromeV)', ...ink(3) }),
    path(heart(917, y0 + 80, 22), { fill: '#fff', fillOpacity: 0.85 }),
    path(`M800 ${y0 + 62}H836M998 ${y0 + 62}H1034`, { stroke: '#fff', strokeOpacity: 0.6, strokeWidth: 5, strokeLinecap: 'round' }),
    path(`M780 ${y0 + 112}H1054`, { stroke: INK, strokeOpacity: 0.25, strokeWidth: 4, strokeLinecap: 'round' }));
  const spk = [];
  for (let r = 0; r < 4; r++) for (let c = 0; c < 6 - (r % 2); c++) spk.push(circle(518 + c * 26 + (r % 2 ? 13 : 0), y0 + 44 + r * 22, 6));
  const hearts = [], boxes = [[182, 420], [495, 690], [738, 1096]]; // coin plate, grille, prize door
  for (let r = 0; r < 3; r++) for (let c = 0; c < 12; c++) { const hx = 152 + c * 92 + (r % 2 ? 46 : 0); if (hx < 1160 && !boxes.some(([a, b]) => hx > a && hx < b)) hearts.push(heart(hx, y0 + 30 + r * 44, 9)); }
  return g({}, path(hearts.join(''), { fill: '#fff', fillOpacity: 0.28 }), coin, door,
    path(spk.join(''), { fill: INK, fillOpacity: 0.5 }),
    // base kick + feet
    path(rr(176, 1686, 100, 28, 8) + rr(1024, 1686, 100, 28, 8), { fill: '#2f2541', ...ink(5) }),
    path(rr(100, 1664, 1100, 32, 12), { fill: '#4a3d63', ...ink(6) }),
    path(`M120 1674H1180`, { stroke: '#fff', strokeOpacity: 0.2, strokeWidth: 3, strokeLinecap: 'round' }));
}

function draw() {
  const defs = [
    `<style>.cc-b{animation:ccChase 1.2s steps(1,end) infinite}.cc-p1{animation-delay:-.4s}.cc-p2{animation-delay:-.8s}`
      + `@keyframes ccChase{0%{opacity:.2}33.3%{opacity:1}100%{opacity:1}}`
      + `.cc-claw{transform-origin:${CLAW_X}px ${RAIL_Y}px;animation:ccSway 2.4s steps(1,end) infinite}`
      + `@keyframes ccSway{0%{transform:rotate(-2deg)}25%{transform:rotate(0deg)}50%{transform:rotate(2deg)}75%{transform:rotate(0deg)}}`
      + `@media (prefers-reduced-motion:reduce){*{animation:none!important}}</style>`,
    lg('ccMint', [0, 0, 1, 0], [[0, '#c8fbe8'], [0.18, '#9cefd2'], [0.8, '#77dcbc'], [1, '#55bf9f']]),
    lg('ccMintHi', [0, 0, 0, 1], [[0, '#d6fdef'], [0.6, '#9cefd2'], [1, '#6fd4b4']]),
    lg('ccPink', [0, 0, 0, 1], [[0, '#ffc6e0'], [0.55, '#ff8cc0'], [1, '#ec5f9c']]),
    lg('ccPinkV', [0, 0, 1, 1], [[0, '#ffd1e6'], [0.5, '#ff9cc9'], [1, '#e9619d']]),
    lg('ccChrome', [0, 0, 0, 1], [[0, '#ffffff'], [0.35, '#e3e5f5'], [0.55, '#a9aecb'], [0.8, '#d3d6ea'], [1, '#f4f5ff']]),
    lg('ccChromeV', [0, 0, 1, 1], [[0, '#ffffff'], [0.45, '#d6d9ee'], [0.7, '#9ea3c2'], [1, '#e6e8fa']]),
    lg('ccCaseBg', [0, 0, 0, 1], [[0, '#4a3a6e'], [0.45, '#33294f'], [1, '#2a2242']]),
    rg('ccLamp', [0.5, 0.5, 0.5], [[0, '#ffd1ea', 0.5], [1, '#ffd1ea', 0]]),
    rg('ccPitGlow', [0.5, 0.5, 0.5], [[0, '#8ff0d0', 0.28], [1, '#8ff0d0', 0]]),
    lg('ccMarq', [0, 0, 0, 1], [[0, '#ff9fcf'], [0.55, '#ff6fae'], [1, '#d94b8c']]),
    rg('ccMarqGlow', [0.5, 0.5, 0.5], [[0, '#fff3c4', 0.75], [1, '#fff3c4', 0]]),
    rg('ccBulb', [0.4, 0.35, 0.7], [[0, '#ffffff'], [0.45, '#fff1a6'], [1, '#ffbf3d']]),
    rg('ccBulbGlow', [0.5, 0.5, 0.5], [[0, '#fff2a8', 0.75], [1, '#fff2a8', 0]]),
    rg('ccBulbPink', [0.4, 0.35, 0.7], [[0, '#ffffff'], [0.45, '#ffc2de'], [1, '#ff5fa2']]),
    rg('ccPinkGlow', [0.5, 0.5, 0.5], [[0, '#ff9fcf', 0.7], [1, '#ff9fcf', 0]]),
    rg('ccHeart', [0.38, 0.3, 0.75], [[0, '#ffffff'], [0.35, '#ffe0ee'], [1, '#ffa6cd']]),
    rg('ccStarGold', [0.4, 0.35, 0.75], [[0, '#fff8d0'], [0.5, '#ffe066'], [1, '#ffb52e']]),
    rg('ccGold', [0.38, 0.32, 0.75], [[0, '#fff6c8'], [0.5, '#ffd34d'], [1, '#d99a14']]),
    rg('ccMascot', [0.38, 0.3, 0.8], [[0, '#fff6ec'], [0.5, '#ffd7b8'], [1, '#f2a983']]),
    rg('ccBear', [0.38, 0.3, 0.8], [[0, '#f2c99c'], [0.6, '#d79a66'], [1, '#b67646']]),
    rg('ccBlob', [0.38, 0.3, 0.8], [[0, '#f1e8ff'], [0.55, '#c9b2ff'], [1, '#9c7ef0']]),
    rg('ccStar', [0.4, 0.35, 0.75], [[0, '#fffbe0'], [0.5, '#ffe36e'], [1, '#ffbd3a']]),
    rg('ccFish', [0.38, 0.3, 0.8], [[0, '#e3f6ff'], [0.55, '#8fd3ff'], [1, '#4aa6e6']]),
    rg('ccBunny', [0.38, 0.3, 0.8], [[0, '#ffffff'], [0.6, '#fff0f6'], [1, '#f2cfe0']]),
    rg('ccPuff', [0.38, 0.3, 0.8], [[0, '#fff1e2'], [0.55, '#ffc79a'], [1, '#f39a5c']]),
    rg('ccBall', [0.38, 0.3, 0.75], [[0, '#ffe0ee'], [0.45, '#ff6fae'], [1, '#c8326f']]),
    rg('ccGo', [0.4, 0.25, 0.85], [[0, '#fffbe0'], [0.4, '#ffd94d'], [1, '#f39a1d']]),
    lg('ccDeckTop', [0, 0, 0, 1], [[0, '#fff8fc'], [1, '#f0d9e8']]),
    lg('ccFlap', [0, 0, 0, 1], [[0, '#ffb3d6'], [1, '#ff7fb6']]),
    lg('ccGlass', [0, 0, 0, 1], [[0, '#ffffff', 0.34], [0.25, '#e8fff7', 0.1], [1, '#d8fff2', 0.18]]),
    lg('ccPitShade', [0, 0, 0, 1], [[0, INK, 0], [0.3, INK, 0.28], [1, INK, 0.38]]),
    rg('ccFloor', [0.5, 0.5, 0.5], [[0, '#000', 0.45], [1, '#000', 0]]),
    `<pattern id="ccDots" width="38" height="76" patternUnits="userSpaceOnUse"><path d="${circle(19, 19, 3)}${circle(0, 57, 3)}${circle(38, 57, 3)}" fill="#fff" fill-opacity="0.06"/></pattern>`,
    `<clipPath id="ccPanelClip"><path d="${rr(MARQ.x + 58, MARQ.y + 58, MARQ.w - 116, MARQ.h - 116, [62, 62, 8, 8])}"/></clipPath>`,
    `<clipPath id="ccCaseClip"><path d="${rr(CASE.x, CASE.y, CASE.w, CASE.h, 14)}"/></clipPath>`,
  ].join('');

  const BODY = rr(110, 380, 1080, 1294, [24, 24, 30, 30]);
  const body = [
    path(ellipse(CX, 1718, 640, 24), { fill: 'url(#ccFloor)' }),
    // cabinet body
    path(BODY, { fill: INK, fillOpacity: 0.3, transform: 'translate(6 10)' }),
    path(BODY, { fill: 'url(#ccMint)', ...ink(7) }),
    path('M130 420V1390', { stroke: '#fff', strokeOpacity: 0.7, strokeWidth: 6, strokeLinecap: 'round' }),
    path('M1172 420V1390', { stroke: INK, strokeOpacity: 0.18, strokeWidth: 8, strokeLinecap: 'round' }),
    pillarBulbs(),
    caseInterior(),
    garland(),
    gantry(),
    pile(),
    bezel(),
    glass(),
    marquee(),
    g({ transform: 'translate(0 4)' }, mascot()),
    lowerCabinet(),
    deck(),
    // sparkles around
    path(sparkle(48, 320, 22), { fill: '#fff6c8', stroke: INK, strokeWidth: 3 }),
    path(sparkle(1252, 260, 18), { fill: '#bff6e6', stroke: INK, strokeWidth: 3 }),
    path(sparkle(1256, 980, 20), { fill: '#ffc6e0', stroke: INK, strokeWidth: 3 }),
    path(sparkle(44, 1080, 16), { fill: '#bff6e6', stroke: INK, strokeWidth: 3 }),
    path(heart(1250, 640, 16), { fill: '#ff8fc0', stroke: INK, strokeWidth: 3 }),
    path(star(56, 720, 18, 8), { fill: '#ffe066', stroke: INK, strokeWidth: 3, strokeLinejoin: 'round' }),
  ].join('\n');
  return { defs, body };
}

module.exports = {
  W, H, hole, radius, draw,
  meta: { name: 'Claw Crane', theme: 'arcade', rarity: 'epic', translucent: false,
    desc: 'Line up the claw, smash the big drop button and try to win a plushie from this pastel prize machine.',
    tags: ['arcade', 'claw-machine', 'plush', 'pastel', 'coin-op'], collection: 'coin-op', license: 'CC-BY-4.0' },
};
