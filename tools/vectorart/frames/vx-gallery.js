'use strict';
// Ornate museum frame: carved gold molding (bead, cove, egg-and-dart ovolo, fillet), crimson velvet
// liner, pearl slip, acanthus corner cartouches, a scallop-shell crest and a brass title plaque.
const L = require('../lib');
const { rr, path, g, lg, rg, circle, ellipse, poly, tf, n } = L;

const O = { x: 44, y: 104, w: 1552, h: 992 }; // outer edge of the molding; margins leave room for the carvings
const W = O.w + 2 * O.x, H = O.y + O.h + 44, hole = { x: O.x + 136, y: O.y + 136, w: 1280, h: 720 }, radius = 0;
const CX = W / 2;
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
const VELVET = [[0, '#2a0510'], [0.25, '#6e1428'], [1, '#8f1f36']];
const GOLD_SLIP = [[0, '#6e420a'], [0.4, '#f3cf72'], [1, '#9a6514']];

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

/** Bead-and-reel pearls along a strip of the given length. */
function beads(len, unit = 22) {
  const count = Math.floor(len / unit), start = -((count - 1) * unit) / 2;
  let b = '', s = '';
  for (let i = 0; i < count; i++) { const x = start + i * unit; b += i % 2 ? ellipse(x, 0, 4, 6) : circle(x, 0, 7.5); s += i % 2 ? '' : circle(x - 2.5, -2.5, 2.4); }
  return path(b, { fill: 'url(#pearlGold)', stroke: BROWN, strokeWidth: 1 }) + path(s, { fill: '#fffbe6' });
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

/** Upright cartouche (points outward = -y), symmetric about x = 0. */
function cartouche() {
  let palm = '';
  for (const r of [-66, -44, -22, 0, 22, 44, 66]) palm += g({ transform: `translate(0 -34) rotate(${r})` },
    path('M0 0C13 -16 13 -46 0 -62C-13 -46 -13 -16 0 0Z', { fill: 'url(#carve)', stroke: BROWN, strokeWidth: 2 }),
    path('M0 -8V-50', { stroke: '#fff4c8', strokeOpacity: 0.75, strokeWidth: 2, strokeLinecap: 'round' }));
  const body = 'M0 -44C30 -44 52 -16 50 12C48 40 22 62 0 70C-22 62 -48 40 -50 12C-52 -16 -30 -44 0 -44Z';
  return palm
    + g({ transform: 'translate(-40 -8)' }, cscroll(40, -Math.PI * 0.35, Math.PI * 1.25, -1, 11))
    + g({ transform: 'translate(40 -8)' }, cscroll(40, -Math.PI * 0.65, Math.PI * 1.25, 1, 11))
    + path(body, { fill: '#2a1600', fillOpacity: 0.35, transform: 'translate(3 5)' })
    + path(body, { fill: 'url(#carve)', stroke: BROWN, strokeWidth: 2.5 })
    + g({ transform: 'translate(0 12)' }, rosette(30));
}

/** Top-left corner ornament in local coordinates (origin = outer corner); mirrored for the others. */
function corner() {
  return g({ transform: tf(104, 46) }, acanthus(150, 17))
    + g({ transform: `${tf(46, 104)} rotate(90) scale(1 -1)` }, acanthus(150, 17))
    + g({ transform: `${tf(54, 54)} rotate(-45) scale(1.2)` }, cartouche());
}

function shellCrest() {
  const cx = CX, by = O.y + 72, R = 132, ribs = 11;
  let fan = `M${cx} ${by}`, lines = '';
  for (let i = 0; i <= ribs; i++) {
    const a = Math.PI + (i / ribs) * Math.PI, mid = Math.PI + ((i - 0.5) / ribs) * Math.PI;
    const x = cx + R * Math.cos(a), y = by + R * Math.sin(a) * 0.92;
    if (i === 0) fan += `L${n(x)} ${n(y)}`;
    else fan += `Q${n(cx + (R + 26) * Math.cos(mid))} ${n(by + (R + 26) * Math.sin(mid) * 0.92)} ${n(x)} ${n(y)}`;
    lines += `M${cx} ${by - 10}L${n(cx + (R - 8) * Math.cos(a))} ${n(by + (R - 8) * Math.sin(a) * 0.92)}`;
  }
  fan += 'Z';
  return g({},
    g({ transform: `${tf(cx - 80, by - 8)} rotate(180) scale(1 -1)` }, acanthus(240, 26)),
    g({ transform: tf(cx + 80, by - 8) }, acanthus(240, 26)),
    g({ transform: tf(cx - 150, by - 36) }, cscroll(36, 0, Math.PI * 1.3, -1, 10)),
    g({ transform: tf(cx + 150, by - 36) }, cscroll(36, Math.PI, Math.PI * 1.3, 1, 10)),
    path(fan, { fill: '#2a1600', fillOpacity: 0.35, transform: 'translate(4 6)' }),
    path(fan, { fill: 'url(#shell)', stroke: BROWN, strokeWidth: 3, strokeLinejoin: 'round' }),
    path(lines, { stroke: BROWN, strokeOpacity: 0.55, strokeWidth: 3, strokeLinecap: 'round' }),
    path(lines, { stroke: '#fff4c8', strokeOpacity: 0.55, strokeWidth: 1.5, strokeLinecap: 'round', transform: 'translate(-3 -2)' }),
    path(`M${cx - 54} ${by + 4}C${cx - 30} ${by + 34} ${cx + 30} ${by + 34} ${cx + 54} ${by + 4}C${cx + 30} ${by + 14} ${cx - 30} ${by + 14} ${cx - 54} ${by + 4}Z`, { fill: 'url(#carve)', stroke: BROWN, strokeWidth: 2.5 }),
    path(circle(cx, by + 14, 16), { fill: 'url(#ruby)', stroke: BROWN, strokeWidth: 2.5 }),
    path(circle(cx - 5, by + 9, 4.5), { fill: '#fff', fillOpacity: 0.85 }));
}

function plaque() {
  const w = 240, h = 58, x = CX - w / 2, y = O.y + O.h - 76;
  return g({},
    g({ transform: tf(x - 6, y + h / 2, 0) + ' rotate(180) scale(1 -1)' }, acanthus(90, 16)),
    g({ transform: tf(x + w + 6, y + h / 2) }, acanthus(90, 16)),
    path(rr(x + 3, y + 5, w, h, 10), { fill: '#2a1600', fillOpacity: 0.4 }),
    path(rr(x, y, w, h, 10), { fill: 'url(#brass)', stroke: BROWN, strokeWidth: 2.5 }),
    path(rr(x + 8, y + 8, w - 16, h - 16, 6), { fill: 'none', stroke: BROWN, strokeOpacity: 0.55, strokeWidth: 1.5 }),
    path(`M${x + 40} ${y + 24}h160M${x + 66} ${y + 36}h108`, { stroke: '#5a3a0a', strokeOpacity: 0.75, strokeWidth: 4, strokeLinecap: 'round', strokeDasharray: '18 6 4 6' }),
    path(circle(x + 18, y + h / 2, 4), { fill: 'url(#boss)', stroke: BROWN }), path(circle(x + w - 18, y + h / 2, 4), { fill: 'url(#boss)', stroke: BROWN }));
}

function draw() {
  const bands = [
    band('bead', 0, 12, GOLD_BEAD), band('cove', 12, 28, GOLD_COVE), band('ovolo', 28, 76, GOLD_OVOLO),
    band('fillet', 76, 84, GOLD_FILLET), band('velvet', 84, 118, VELVET, 0.1), band('slip', 118, 136, GOLD_SLIP),
  ];
  const defs = [
    ...bands.map((b) => b.defs),
    lg('carve', [0, 0, 1, 1], [[0, '#fff1bf'], [0.35, '#f0c45a'], [0.7, '#c08a2a'], [1, '#7a4b0c']]),
    lg('shell', [0, 0, 0, 1], [[0, '#fff3c8'], [0.5, '#f0c45a'], [1, '#a8701c']]),
    lg('brass', [0, 0, 0, 1], [[0, '#fff0b8'], [0.45, '#dcb056'], [1, '#9c6a1c']]),
    rg('egg', [0.4, 0.3, 0.8], [[0, '#fff3c8'], [0.5, '#e8b44a'], [1, '#8a5a12']]),
    rg('pearlGold', [0.35, 0.3, 0.8], [[0, '#fffbe6'], [0.5, '#f0c45a'], [1, '#8a5a12']]),
    rg('boss', [0.35, 0.3, 0.8], [[0, '#fffbe6'], [0.5, '#f0c45a'], [1, '#7a4b0c']]),
    rg('ruby', [0.35, 0.3, 0.8], [[0, '#ffd1dc'], [0.4, '#e0204f'], [1, '#5a0018']]),
  ].join('');

  const vx0 = O.x + 84, vy0 = O.y + 84, vw = O.w - 168, vh = O.h - 168;
  const corners = [[1, 1, O.x, O.y], [-1, 1, O.x + O.w, O.y], [1, -1, O.x, O.y + O.h], [-1, -1, O.x + O.w, O.y + O.h]]
    .map(([sx, sy, x, y]) => g({ transform: `translate(${x} ${y}) scale(${sx} ${sy})` }, corner())).join('');
  const sideRosettes = [[O.x + 52, O.y + O.h / 2], [O.x + O.w - 52, O.y + O.h / 2]]
    .map(([x, y]) => g({ transform: tf(x, y) }, path(ellipse(0, 0, 30, 60), { fill: '#5a3507', fillOpacity: 0.5 }), rosette(28))).join('');

  const body = [
    // soft wall shadow
    [[18, 0.05], [12, 0.08], [6, 0.12]].map(([e, a]) => path(rr(O.x - e + 8, O.y - e + 14, O.w + 2 * e, O.h + 2 * e, e + 6), { fill: '#000', fillOpacity: a })).join(''),
    path(`${rr(O.x, O.y, O.w, O.h, 0)}`, { fill: '#a8701c' }),
    ...bands.map((b) => b.body),
    // velvet sheen + shadow cast by the molding
    path(`${rr(vx0, vy0, vw, vh, 0)}${rr(vx0 + 34, vy0 + 34, vw - 68, vh - 68, 0)}`, { fill: 'none', stroke: '#000', strokeOpacity: 0.35, strokeWidth: 10 }),
    path(`M${vx0 + 10} ${vy0 + 20}H${vx0 + vw - 10}`, { stroke: '#ff9db0', strokeOpacity: 0.12, strokeWidth: 8 }),
    aroundSides(52, (len) => eggDart(len - 420)),
    aroundSides(127, (len) => beads(len - 20)),
    path(`${rr(O.x + 0.5, O.y + 0.5, O.w - 1, O.h - 1, 0)}`, { fill: 'none', stroke: BROWN, strokeWidth: 2 }),
    path(`${rr(O.x + 76, O.y + 76, O.w - 152, O.h - 152, 0)}`, { fill: 'none', stroke: BROWN, strokeOpacity: 0.6, strokeWidth: 1.5 }),
    L.lip(rr(hole.x, hole.y, hole.w, hole.h, 0), '#1a0a00', [[5, 0.3], [2, 0.6]]),
    corners,
    sideRosettes,
    shellCrest(),
    plaque(),
    [[CX - 40, O.y - 20, 22], [O.x + 30, O.y + 30, 18], [O.x + O.w - 74, O.y + O.h - 30, 16], [O.x + O.w - 20, O.y + 250, 12]]
      .map(([x, y, r]) => path(L.sparkle(x, y, r, 0.12), { fill: '#fffbe6' })).join(''),
  ].join('\n');
  return { defs, body };
}

module.exports = {
  W, H, hole, radius, draw,
  meta: { name: 'The Gallery', theme: 'museum', rarity: 'legendary', translucent: false,
    desc: 'Hand-carved gilt frame with a scallop-shell crest and velvet liner. Your game, hung like a masterpiece.', tags: ['gold', 'museum', 'ornate', 'baroque', 'legendary'] },
};
