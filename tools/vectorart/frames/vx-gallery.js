'use strict';
// Museum masterpiece frame: carved gilt molding (bead, cove, egg-and-dart ovolo, fillet), a crimson velvet
// liner and a quiet antique-gold sight edge. Rococo carving breaks the silhouette: shell cartouches with
// C-scrolls and acanthus sprays at every corner, a crowned scallop crest under a brass picture light that
// washes the top in warm light, shell medallions on the sides, a pendant apron and a brass museum plaque on
// the wall below. The busy carving sits on the outer molding and beyond; the ring around the picture is calm.
const L = require('../lib');
const { rr, path, g, lg, rg, circle, ellipse, poly, tf, n } = L;

const O = { x: 130, y: 250, w: 1552, h: 992 }; // outer edge of the molding; margins leave room for carving, lamp and plaque
const W = O.w + 2 * O.x, H = O.y + O.h + 200, hole = { x: O.x + 136, y: O.y + 136, w: 1280, h: 720 }, radius = 0;
const CX = W / 2, CY = O.y + O.h / 2;
const BROWN = '#4a2a06';

/** Mitered band between insets a and b (from the outer edge), one trapezoid per side, each with its own gradient. */
function band(id, a, b, list, dark = 0.18) {
  const x0 = O.x + a, y0 = O.y + a, x1 = O.x + O.w - a, y1 = O.y + O.h - a;
  const X0 = O.x + b, Y0 = O.y + b, X1 = O.x + O.w - b, Y1 = O.y + O.h - b;
  const sides = {
    t: [[[x0, y0], [x1, y0], [X1, Y0], [X0, Y0]], [0, y0, 0, Y0], 0],
    r: [[[x1, y0], [x1, y1], [X1, Y1], [X1, Y0]], [x1, 0, X1, 0], dark * 0.6],
    b: [[[x1, y1], [x0, y1], [X0, Y1], [X1, Y1]], [0, y1, 0, Y1], dark],
    l: [[[x0, y1], [x0, y0], [X0, Y0], [X0, Y1]], [x0, 0, X0, 0], 0],
  };
  let defs = '', body = '';
  for (const [k, [pts, c, shade]] of Object.entries(sides)) {
    defs += lg(`${id}-${k}`, c, list, true);
    body += path(poly(pts), { fill: `url(#${id}-${k})` });
    if (shade) body += path(poly(pts), { fill: '#2a1600', fillOpacity: shade });
  }
  return { defs, body };
}

const GOLD_BEAD = [[0, '#7a4b0c'], [0.25, '#ffe9a8'], [0.55, '#e0a83a'], [1, '#7a4b0c']];
const GOLD_COVE = [[0, '#5a3507'], [0.6, '#a8701c'], [1, '#f6d37a']];
const GOLD_OVOLO = [[0, '#b07a1e'], [0.3, '#ffe39a'], [0.6, '#d9a038'], [1, '#6e420a']];
const GOLD_FILLET = [[0, '#fff2c4'], [1, '#c08a2a']];
const VELVET = [[0, '#2a0510'], [0.25, '#5e1022'], [1, '#741a2e']];
const SIGHT = [[0, '#3a2406'], [0.45, '#7a5a26'], [1, '#4a3010']]; // matte antique gold: no glints next to the picture

/** Egg-and-dart strip of the given length, centred on y=0, in local coordinates. */
function eggDart(len, unit = 46) {
  const count = Math.floor(len / unit), start = -((count - 1) * unit) / 2;
  let eggs = '', cups = '', darts = '', shine = '';
  for (let i = 0; i < count; i++) {
    const x = start + i * unit;
    cups += ellipse(x, 0, 18, 21);
    eggs += ellipse(x, 1, 13, 16);
    shine += ellipse(x - 4, -6, 4, 6);
    if (i < count - 1) darts += `M${n(x + unit / 2)} -20L${n(x + unit / 2 + 4)} 4L${n(x + unit / 2)} 20L${n(x + unit / 2 - 4)} 4Z`;
  }
  return path(cups, { fill: '#5a3507', fillOpacity: 0.55 })
    + path(eggs, { fill: 'url(#egg)', stroke: BROWN, strokeWidth: 1.5 })
    + path(darts, { fill: '#ffe39a', stroke: BROWN, strokeWidth: 1.2 })
    + path(shine, { fill: '#fff8dc', fillOpacity: 0.7 });
}

/** Apply a strip generator to all four sides of a rectangle inset `d` from the outer edge. */
function aroundSides(d, gen) {
  const cx = O.x + O.w / 2, cy = O.y + O.h / 2, hw = O.w / 2 - d, hh = O.h / 2 - d, lw = O.w - 2 * d, lh = O.h - 2 * d;
  return g({ transform: tf(cx, cy - hh) }, gen(lw)) + g({ transform: `${tf(cx, cy + hh)} rotate(180)` }, gen(lw))
    + g({ transform: `${tf(cx - hw, cy)} rotate(-90)` }, gen(lh)) + g({ transform: `${tf(cx + hw, cy)} rotate(90)` }, gen(lh));
}

/** Acanthus leaf along +x from the origin with a curled scroll at the tip. */
function acanthus(len, w) {
  const lobes = 4, top = [], bot = [];
  for (let i = 0; i < lobes; i++) {
    const t0 = i / lobes, t1 = (i + 1) / lobes, x0 = len * 0.85 * t0, x1 = len * 0.85 * t1, ww = w * (1 - t0 * 0.5);
    top.push(`C${n(x0 + (x1 - x0) * 0.1)} ${n(-ww * 1.5)} ${n(x1 + (x1 - x0) * 0.2)} ${n(-ww * 1.4)} ${n(x1)} ${n(-ww * 0.45)}`);
    bot.unshift(`C${n(x1 + (x1 - x0) * 0.2)} ${n(ww * 1.3)} ${n(x0 + (x1 - x0) * 0.1)} ${n(ww * 1.4)} ${n(x0)} ${n(i ? ww * 0.4 : 0)}`);
  }
  const tx = len * 0.85, curl = `C${n(tx + w * 1.1)} ${n(-w * 0.9)} ${n(tx + w * 1.4)} ${n(w * 0.9)} ${n(tx + w * 0.3)} ${n(w * 0.75)}C${n(tx - w * 0.1)} ${n(w * 0.7)} ${n(tx)} ${n(w * 0.45)} ${n(tx)} ${n(w * 0.4)}`;
  const d = `M0 0${top.join('')}${curl}${bot.join('')}Z`;
  const veins = Array.from({ length: lobes }, (_, i) => { const x = len * 0.85 * (i + 0.6) / lobes, ww = w * (1 - i / lobes * 0.5); return `M${n(x - len * 0.08)} 0Q${n(x)} ${n(-ww * 0.4)} ${n(x + len * 0.02)} ${n(-ww * 0.95)}`; }).join('');
  return path(d, { fill: '#2a1600', fillOpacity: 0.35, transform: 'translate(3 4)' })
    + path(d, { fill: 'url(#carve)', stroke: BROWN, strokeWidth: 2.2, strokeLinejoin: 'round' })
    + path(`M${n(w * 0.3)} 0Q${n(len * 0.5)} ${n(w * 0.1)} ${n(tx + w * 0.2)} ${n(w * 0.2)}`, { fill: 'none', stroke: BROWN, strokeOpacity: 0.75, strokeWidth: 2.5, strokeLinecap: 'round' })
    + path(veins, { fill: 'none', stroke: '#fff4c8', strokeOpacity: 0.85, strokeWidth: 2.2, strokeLinecap: 'round' })
    + path(circle(tx + w * 0.55, w * 0.1, w * 0.26), { fill: 'url(#boss)', stroke: BROWN, strokeWidth: 1.5 });
}

/** C-scroll: an arc of shrinking radius around the origin ending in a boss. dir 1 = clockwise. */
function cscroll(r, a0, sweep, dir = 1, width = 11) {
  const pts = [];
  for (let i = 0; i <= 24; i++) {
    const t = i / 24, a = a0 + dir * sweep * t, rr0 = r * (1 - 0.55 * t);
    pts.push([rr0 * Math.cos(a), rr0 * Math.sin(a)]);
  }
  const d = L.smooth(pts), [ex, ey] = pts[pts.length - 1];
  return path(d, { fill: 'none', stroke: BROWN, strokeWidth: width + 5, strokeLinecap: 'round' })
    + path(d, { fill: 'none', stroke: 'url(#carve)', strokeWidth: width, strokeLinecap: 'round' })
    + path(d, { fill: 'none', stroke: '#fff4c8', strokeOpacity: 0.65, strokeWidth: 2.5, strokeLinecap: 'round', transform: 'translate(-1.5 -2)' })
    + path(circle(ex, ey, width * 0.75), { fill: 'url(#boss)', stroke: BROWN, strokeWidth: 2 });
}

function rosette(r) {
  let petals = '';
  for (let i = 0; i < 8; i++) petals += g({ transform: `rotate(${i * 45})` }, path(`M0 0C${n(r * 0.35)} ${n(-r * 0.3)} ${n(r * 0.3)} ${n(-r * 0.95)} 0 ${-r}C${n(-r * 0.3)} ${n(-r * 0.95)} ${n(-r * 0.35)} ${n(-r * 0.3)} 0 0Z`, { fill: 'url(#carve)', stroke: BROWN, strokeWidth: 1.6 }));
  return path(circle(2, 3, r), { fill: '#2a1600', fillOpacity: 0.3 }) + petals + path(circle(0, 0, r * 0.34), { fill: 'url(#boss)', stroke: BROWN, strokeWidth: 2 })
    + path(circle(-r * 0.1, -r * 0.1, r * 0.1), { fill: '#fffbe6' });
}

/** Scallop shell with its hinge at the origin, fanning out toward -y; ribs radiate from the hinge. */
function shell(R, ribs = 11, sq = 0.92) {
  let fan = 'M0 0', lines = '';
  for (let i = 0; i <= ribs; i++) {
    const a = Math.PI + (i / ribs) * Math.PI, mid = Math.PI + ((i - 0.5) / ribs) * Math.PI;
    const x = R * Math.cos(a), y = R * Math.sin(a) * sq;
    if (i === 0) fan += `L${n(x)} ${n(y)}`;
    else fan += `Q${n((R + R * 0.2) * Math.cos(mid))} ${n((R + R * 0.2) * Math.sin(mid) * sq)} ${n(x)} ${n(y)}`;
    lines += `M0 ${n(-R * 0.08)}L${n((R - R * 0.06) * Math.cos(a))} ${n((R - R * 0.06) * Math.sin(a) * sq)}`;
  }
  fan += 'Z';
  const sw = Math.max(1.5, R / 44);
  return path(fan, { fill: '#2a1600', fillOpacity: 0.35, transform: 'translate(4 6)' })
    + path(fan, { fill: 'url(#shell)', stroke: BROWN, strokeWidth: sw, strokeLinejoin: 'round' })
    + path(lines, { stroke: BROWN, strokeOpacity: 0.55, strokeWidth: sw, strokeLinecap: 'round' })
    + path(lines, { stroke: '#fff4c8', strokeOpacity: 0.55, strokeWidth: sw * 0.5, strokeLinecap: 'round', transform: 'translate(-3 -2)' })
    + path(`M${n(-R * 0.4)} ${n(R * 0.03)}C${n(-R * 0.22)} ${n(R * 0.26)} ${n(R * 0.22)} ${n(R * 0.26)} ${n(R * 0.4)} ${n(R * 0.03)}C${n(R * 0.22)} ${n(R * 0.1)} ${n(-R * 0.22)} ${n(R * 0.1)} ${n(-R * 0.4)} ${n(R * 0.03)}Z`, { fill: 'url(#carve)', stroke: BROWN, strokeWidth: sw });
}

/** Oval cartouche body with a rosette, symmetric about x = 0 (points outward = -y). */
function cartouche(r = 30) {
  const body = 'M0 -44C30 -44 52 -16 50 12C48 40 22 62 0 70C-22 62 -48 40 -50 12C-52 -16 -30 -44 0 -44Z';
  return g({ transform: 'translate(-40 -8)' }, cscroll(40, -Math.PI * 0.35, Math.PI * 1.25, -1, 11))
    + g({ transform: 'translate(40 -8)' }, cscroll(40, -Math.PI * 0.65, Math.PI * 1.25, 1, 11))
    + path(body, { fill: '#2a1600', fillOpacity: 0.35, transform: 'translate(3 5)' })
    + path(body, { fill: 'url(#carve)', stroke: BROWN, strokeWidth: 2.5 })
    + path('M0 -34C22 -34 40 -12 38 10C36 32 18 50 0 57C-18 50 -36 32 -38 10C-40 -12 -22 -34 0 -34Z', { fill: 'none', stroke: BROWN, strokeOpacity: 0.5, strokeWidth: 2 })
    + g({ transform: 'translate(0 12)' }, rosette(r));
}

/** Top-left corner ornament in local coordinates (origin = outer corner, frame toward +x +y); mirrored for the others. */
function corner() {
  return [
    // acanthus sprays sweeping past the corner along both edge lines, curling away from the frame
    g({ transform: `${tf(80, 30)} rotate(176) scale(1 -1)` }, acanthus(200, 21)),
    g({ transform: `${tf(30, 80)} rotate(-86)` }, acanthus(200, 21)),
    // the shell cartouche on the diagonal
    g({ transform: `${tf(44, 44)} rotate(-45)` }, shell(104, 11, 0.9)),
    g({ transform: `${tf(64, 64)} rotate(-45)` }, cscroll(52, Math.PI * 0.05, Math.PI * 1.2, 1, 12)),
    g({ transform: `${tf(64, 64)} rotate(-45) scale(-1 1)` }, cscroll(52, Math.PI * 0.05, Math.PI * 1.2, 1, 12)),
    // acanthus running along the molding from the corner
    g({ transform: tf(112, 46) }, acanthus(190, 17)),
    g({ transform: `${tf(46, 112)} rotate(90) scale(1 -1)` }, acanthus(190, 17)),
    g({ transform: `${tf(70, 70)} rotate(-45) scale(1.05)` }, cartouche()),
  ].join('');
}

function crest() {
  const by = O.y + 66, plume = [];
  // a crown of acanthus fanning up behind the shell
  for (const [a, l, w] of [[-90, 150, 22], [-62, 140, 20], [-118, 140, 20], [-36, 120, 18], [-144, 120, 18]])
    plume.push(g({ transform: `${tf(CX, by - 70)} rotate(${a})${a < -90 ? ' scale(1 -1)' : ''}` }, acanthus(l, w)));
  return g({},
    ...plume,
    g({ transform: `${tf(CX - 90, by - 6)} rotate(180) scale(1 -1)` }, acanthus(270, 28)),
    g({ transform: tf(CX + 90, by - 6) }, acanthus(270, 28)),
    g({ transform: tf(CX - 168, by - 40) }, cscroll(40, 0, Math.PI * 1.3, -1, 11)),
    g({ transform: tf(CX + 168, by - 40) }, cscroll(40, Math.PI, Math.PI * 1.3, 1, 11)),
    g({ transform: tf(CX, by) }, shell(140, 13, 0.92)),
    path(circle(CX, by + 16, 18), { fill: 'url(#ruby)', stroke: BROWN, strokeWidth: 2.5 }),
    path(circle(CX - 6, by + 10, 5), { fill: '#fff', fillOpacity: 0.85 }));
}

/** Side medallion: a small shell pointing out of the frame, a ruby boss and acanthus up and down the molding. */
function medallion(x, dir) {
  return g({ transform: `${tf(x, CY)}${dir < 0 ? ' scale(-1 1)' : ''}` },
    g({ transform: `${tf(0, -40)} rotate(-90)` }, acanthus(150, 17)),
    g({ transform: `${tf(0, 40)} rotate(90) scale(1 -1)` }, acanthus(150, 17)),
    g({ transform: `${tf(-14, 0)} rotate(-90)` }, shell(66, 9, 0.9)),
    path(ellipse(4, 3, 30, 52), { fill: '#2a1600', fillOpacity: 0.35 }),
    path(ellipse(0, 0, 30, 52), { fill: 'url(#carve)', stroke: BROWN, strokeWidth: 2.5 }),
    path(ellipse(0, 0, 19, 36), { fill: 'none', stroke: BROWN, strokeOpacity: 0.5, strokeWidth: 2 }),
    path(ellipse(0, 0, 13, 18), { fill: 'url(#ruby)', stroke: BROWN, strokeWidth: 2.5 }),
    path(ellipse(-4, -6, 4, 6), { fill: '#fff', fillOpacity: 0.8 }));
}

/** Pendant apron under the bottom rail: an inverted shell between scrolls. */
function apron() {
  const y = O.y + O.h - 26;
  return g({},
    g({ transform: `${tf(CX - 70, y + 10)} rotate(180) scale(1 -1)` }, acanthus(200, 22)),
    g({ transform: tf(CX + 70, y + 10) }, acanthus(200, 22)),
    g({ transform: `${tf(CX, y)} scale(1 -1)` }, shell(92, 11, 0.9)),
    g({ transform: `${tf(CX, y + 4)} rotate(180)` }, cscroll(46, Math.PI * 0.05, Math.PI * 1.1, 1, 11)),
    g({ transform: `${tf(CX, y + 4)} rotate(180) scale(-1 1)` }, cscroll(46, Math.PI * 0.05, Math.PI * 1.1, 1, 11)),
    g({ transform: tf(CX, y + 6) }, rosette(24)));
}

/** Brass museum plaque on the wall below the frame, with engraved strokes in place of a title. */
function plaque() {
  const w = 320, h = 70, x = CX - w / 2, y = O.y + O.h + 112;
  return g({},
    path(rr(x + 4, y + 7, w, h, 6), { fill: '#000', fillOpacity: 0.4 }),
    path(rr(x, y, w, h, 6), { fill: 'url(#brass)', stroke: BROWN, strokeWidth: 2.5 }),
    path(rr(x + 9, y + 9, w - 18, h - 18, 3), { fill: 'none', stroke: BROWN, strokeOpacity: 0.5, strokeWidth: 1.5 }),
    path(`M${x + 54} ${y + 27}h170M${x + 54} ${y + 40}h122M${x + 54} ${y + 51}h88`, { stroke: '#5a3a0a', strokeOpacity: 0.7, strokeWidth: 3.5, strokeLinecap: 'round', strokeDasharray: '20 7 5 7' }),
    path(`M${x + w - 70} ${y + 22}h40v26h-40Z`, { fill: 'none', stroke: '#5a3a0a', strokeOpacity: 0.5, strokeWidth: 2 }),
    [[x + 16, y + 16], [x + w - 16, y + 16], [x + 16, y + h - 16], [x + w - 16, y + h - 16]]
      .map(([sx, sy]) => path(circle(sx, sy, 4.5), { fill: 'url(#boss)', stroke: BROWN }) + path(`M${sx - 3} ${sy}h6`, { stroke: BROWN, strokeWidth: 1.2 })).join(''));
}

/** Brass picture light above the crest; its warm wash is drawn separately, over the frame. */
function lamp() {
  const y = 34, w = 380;
  return g({},
    path(rr(CX - 8, y + 30, 16, 120, 6), { fill: 'url(#brassV)', stroke: BROWN, strokeWidth: 2.5 }),
    path(rr(CX - w / 2 + 4, y + 6, w, 42, 21), { fill: '#000', fillOpacity: 0.35 }),
    path(rr(CX - w / 2, y, w, 42, 21), { fill: 'url(#hood)', stroke: BROWN, strokeWidth: 2.5 }),
    path(`M${CX - w / 2 + 24} ${y + 10}H${CX + w / 2 - 24}`, { stroke: '#fff6d8', strokeOpacity: 0.7, strokeWidth: 3, strokeLinecap: 'round' }),
    path(rr(CX - w / 2 + 16, y + 36, w - 32, 8, 4), { fill: '#fff3c4' }),
    path(ellipse(CX - w / 2 + 8, y + 21, 10, 21) + ellipse(CX + w / 2 - 8, y + 21, 10, 21), { fill: 'url(#brass)', stroke: BROWN, strokeWidth: 2 }));
}

function draw() {
  const bands = [
    band('bead', 0, 12, GOLD_BEAD), band('cove', 12, 28, GOLD_COVE), band('ovolo', 28, 76, GOLD_OVOLO),
    band('fillet', 76, 84, GOLD_FILLET), band('velvet', 84, 122, VELVET, 0.1), band('sight', 122, 136, SIGHT, 0.12),
  ];
  const defs = [
    ...bands.map((b) => b.defs),
    lg('carve', [0, 0, 1, 1], [[0, '#fff1bf'], [0.35, '#f0c45a'], [0.7, '#c08a2a'], [1, '#7a4b0c']]),
    lg('shell', [0, 0, 0, 1], [[0, '#fff3c8'], [0.5, '#f0c45a'], [1, '#a8701c']]),
    lg('brass', [0, 0, 0, 1], [[0, '#fff0b8'], [0.45, '#dcb056'], [1, '#9c6a1c']]),
    lg('brassV', [0, 0, 1, 0], [[0, '#9c6a1c'], [0.5, '#f6d37a'], [1, '#7a4b0c']]),
    lg('hood', [0, 0, 0, 1], [[0, '#7a4b0c'], [0.2, '#ffe9a8'], [0.5, '#c8902e'], [1, '#5a3507']]),
    rg('egg', [0.4, 0.3, 0.8], [[0, '#fff3c8'], [0.5, '#e8b44a'], [1, '#8a5a12']]),
    rg('boss', [0.35, 0.3, 0.8], [[0, '#fffbe6'], [0.5, '#f0c45a'], [1, '#7a4b0c']]),
    rg('ruby', [0.35, 0.3, 0.8], [[0, '#ffd1dc'], [0.4, '#e0204f'], [1, '#5a0018']]),
    rg('wallGlow', [0.5, 0.5, 0.5], [[0, '#ffe7b0', 0.3], [0.6, '#ffe7b0', 0.1], [1, '#ffe7b0', 0]]),
    `<radialGradient id="wash" cx="${CX}" cy="70" r="420" gradientUnits="userSpaceOnUse" gradientTransform="translate(${CX} 70) scale(2 1) translate(${-CX} -70)">${L.stops([[0, '#fff6d8', 0.24], [0.45, '#fff3c4', 0.1], [1, '#fff3c4', 0]])}</radialGradient>`,
  ].join('');

  const vx0 = O.x + 84, vy0 = O.y + 84, vw = O.w - 168, vh = O.h - 168;
  const corners = [[1, 1, O.x, O.y], [-1, 1, O.x + O.w, O.y], [1, -1, O.x, O.y + O.h], [-1, -1, O.x + O.w, O.y + O.h]]
    .map(([sx, sy, x, y]) => g({ transform: `translate(${x} ${y}) scale(${sx} ${sy})` }, corner())).join('');
  const lit = poly([[CX - 170, 76], [CX + 170, 76], [CX + 820, O.y + 140], [CX - 820, O.y + 140]]);

  const body = [
    // warm pool of light on the wall, soft wall shadow
    path(ellipse(CX, O.y + 40, 900, 320), { fill: 'url(#wallGlow)' }),
    [[18, 0.05], [12, 0.08], [6, 0.12]].map(([e, a]) => path(rr(O.x - e + 8, O.y - e + 14, O.w + 2 * e, O.h + 2 * e, e + 6), { fill: '#000', fillOpacity: a })).join(''),
    plaque(),
    lamp(),
    path(rr(O.x, O.y, O.w, O.h, 0), { fill: '#a8701c' }),
    ...bands.map((b) => b.body),
    // velvet: a soft sheen and the shadow cast by the molding
    path(`${rr(vx0, vy0, vw, vh, 0)}${rr(vx0 + 38, vy0 + 38, vw - 76, vh - 76, 0)}`, { fill: 'none', stroke: '#000', strokeOpacity: 0.35, strokeWidth: 10 }),
    path(`M${vx0 + 10} ${vy0 + 22}H${vx0 + vw - 10}`, { stroke: '#ff9db0', strokeOpacity: 0.08, strokeWidth: 8 }),
    aroundSides(52, (len) => eggDart(len - 420)),
    path(`${rr(O.x + 0.5, O.y + 0.5, O.w - 1, O.h - 1, 0)}`, { fill: 'none', stroke: BROWN, strokeWidth: 2 }),
    path(`${rr(O.x + 76, O.y + 76, O.w - 152, O.h - 152, 0)}`, { fill: 'none', stroke: BROWN, strokeOpacity: 0.6, strokeWidth: 1.5 }),
    path(`${rr(O.x + 122, O.y + 122, O.w - 244, O.h - 244, 0)}`, { fill: 'none', stroke: '#1a0a00', strokeOpacity: 0.5, strokeWidth: 1.5 }),
    L.lip(rr(hole.x, hole.y, hole.w, hole.h, 0), '#1a0a00', [[5, 0.3], [2, 0.6]]),
    apron(),
    medallion(O.x + 40, 1), medallion(O.x + O.w - 40, -1),
    corners,
    crest(),
    path(lit, { fill: 'url(#wash)' }),
    [[CX - 300, 110, 18], [O.x - 40, O.y - 30, 16], [O.x + O.w + 44, O.y + O.h + 40, 14], [O.x + O.w + 30, O.y + 300, 11]]
      .map(([x, y, r]) => path(L.sparkle(x, y, r, 0.12), { fill: '#fffbe6' })).join(''),
  ].join('\n');
  return { defs, body };
}

module.exports = {
  W, H, hole, radius, draw,
  meta: { name: 'The Gallery', theme: 'museum', rarity: 'legendary', translucent: false,
    desc: 'A hand-carved rococo gilt masterpiece frame under its own brass picture light. Your game, hung like an old master.', tags: ['gold', 'museum', 'ornate', 'baroque', 'legendary'] },
};
