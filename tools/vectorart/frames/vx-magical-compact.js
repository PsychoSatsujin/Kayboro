'use strict';
// Magical-girl transformation compact: gold rim, pink enamel with engraved twinkles, a pearl-studded
// rounded mirror (the screen), feathered wings, a star crest, a faceted heart gem and ribbon tails.
const L = require('../lib');
const { rr, path, g, lg, rg, circle, ellipse, sparkle, star, heart, tf, rng, lip, n } = L;

const W = 1400, H = 1380, CX = 700, CY = 680, R = 480;
const hole = { x: 400, y: 380, w: 600, h: 600 }, radius = 150;
const INK = '#7a3a78';

/** Points evenly spaced along a rounded rect outline. */
function alongRR(x, y, w, h, r, count) {
  const segs = [], add = (len, f) => segs.push([len, f]);
  const arc = (cx, cy, a0) => (t) => [cx + r * Math.cos(a0 + t * Math.PI / 2), cy + r * Math.sin(a0 + t * Math.PI / 2)];
  add(w - 2 * r, (t) => [x + r + t * (w - 2 * r), y]); add(r * Math.PI / 2, arc(x + w - r, y + r, -Math.PI / 2));
  add(h - 2 * r, (t) => [x + w, y + r + t * (h - 2 * r)]); add(r * Math.PI / 2, arc(x + w - r, y + h - r, 0));
  add(w - 2 * r, (t) => [x + w - r - t * (w - 2 * r), y + h]); add(r * Math.PI / 2, arc(x + r, y + h - r, Math.PI / 2));
  add(h - 2 * r, (t) => [x, y + h - r - t * (h - 2 * r)]); add(r * Math.PI / 2, arc(x + r, y + r, Math.PI));
  const total = segs.reduce((s, [l]) => s + l, 0), out = [];
  for (let i = 0; i < count; i++) {
    let d = (i / count) * total + (w - 2 * r) / 2;
    d %= total;
    for (const [len, f] of segs) { if (d <= len) { out.push(f(d / len)); break; } d -= len; }
  }
  return out;
}

const feather = (L0, w) => `M${n(-w * 0.45)} 0C${n(-w)} ${n(-L0 * 0.5)} ${n(-w * 0.9)} ${n(-L0)} 0 ${-L0}C${n(w * 0.9)} ${n(-L0)} ${n(w)} ${n(-L0 * 0.5)} ${n(w * 0.45)} 0Z`;

function wing(s) {
  const bx = CX + s * 380, by = CY - 40, out = [];
  const rows = [
    { list: [[-18, 380], [-30, 400], [-42, 390], [-54, 365], [-66, 330], [-78, 290], [-90, 250], [-102, 210], [-114, 175], [-126, 145]], w: 40, fill: 'url(#featherTip)' },
    { list: [[-26, 280], [-40, 280], [-54, 265], [-68, 240], [-82, 210], [-96, 180], [-110, 150]], w: 44, fill: 'url(#feather)' },
    { list: [[-34, 180], [-50, 185], [-66, 175], [-82, 160], [-98, 140]], w: 48, fill: 'url(#featherTop)' },
  ];
  for (const { list, w, fill } of rows)
    for (const [a, len] of list) {
      const rot = -s * a;
      out.push(g({ transform: tf(bx, by, rot) },
        path(feather(len, w), { fill, stroke: '#a98ad8', strokeWidth: 3.5, strokeLinejoin: 'round' }),
        path(`M0 -14L0 ${-len + 30}`, { stroke: '#c9b4ef', strokeWidth: 3, strokeLinecap: 'round' })));
    }
  return out.join('');
}

function ribbonTail(s) {
  const x = CX + s * 40, y = CY + R - 60;
  const d = `M${x} ${y}C${x + s * 60} ${y + 60} ${x + s * 150} ${y + 90} ${x + s * 190} ${y + 180}L${x + s * 150} ${y + 166}L${x + s * 140} ${y + 216}C${x + s * 110} ${y + 130} ${x + s * 40} ${y + 90} ${x - s * 6} ${y + 30}Z`;
  return path(d, { fill: 'url(#ribbon)', stroke: INK, strokeWidth: 5, strokeLinejoin: 'round' });
}

function draw() {
  const holeD = rr(hole.x, hole.y, hole.w, hole.h, radius);
  const defs = [
    lg('gold', [0, 0, 0, 1], [[0, '#fff6cf'], [0.25, '#f6cf62'], [0.55, '#d99a2b'], [0.8, '#ffe39a'], [1, '#b8781c']]),
    lg('goldH', [0, 0, 1, 1], [[0, '#fff8d8'], [0.5, '#e9b448'], [1, '#a8661a']]),
    rg('enamel', [0.5, 0.42, 0.62], [[0, '#ffd3ea'], [0.55, '#ff8cc6'], [1, '#d94a96']]),
    lg('bezel', [0, 0, 1, 1], [[0, '#ffffff'], [0.45, '#ecdcff'], [1, '#b49ad8']]),
    rg('pearl', [0.35, 0.3, 0.75], [[0, '#ffffff'], [0.6, '#fbeeff'], [1, '#c8b2e6']]),
    lg('feather', [0, 1, 0, 0], [[0, '#ffffff'], [1, '#f1e8ff']]),
    lg('featherTip', [0, 1, 0, 0], [[0, '#ffffff'], [0.65, '#f3ecff'], [1, '#d9c6ff']]),
    lg('featherTop', [0, 1, 0, 0], [[0, '#fff'], [1, '#ffe6f3']]),
    rg('gemHeart', [0.4, 0.3, 0.8], [[0, '#ffe0f0'], [0.35, '#ff5fa8'], [1, '#a3125a']]),
    rg('gemCyan', [0.35, 0.3, 0.8], [[0, '#e9fdff'], [0.4, '#6fe3ff'], [1, '#1b7fb0']]),
    rg('gemLilac', [0.35, 0.3, 0.8], [[0, '#f6ecff'], [0.4, '#bb8cff'], [1, '#5c2fb0']]),
    lg('ribbon', [0, 0, 1, 1], [[0, '#ff9ccd'], [1, '#e2508f']]),
    rg('halo', [0.5, 0.5, 0.5], [[0, '#fff3b0', 0.55], [0.6, '#ffd6f0', 0.18], [1, '#ffd6f0', 0]]),
    rg('floor', [0.5, 0.5, 0.5], [[0, '#4a1a48', 0.35], [1, '#4a1a48', 0]]),
  ].join('');

  const rnd = rng(5), twinkles = [];
  while (twinkles.length < 26) {
    const a = rnd() * Math.PI * 2, r = 360 + rnd() * 70, x = CX + r * Math.cos(a), y = CY + r * Math.sin(a);
    const inMirror = Math.hypot(Math.max(Math.abs(x - CX) - 150, 0), Math.max(Math.abs(y - CY) - 150, 0)) < 225;
    if (!inMirror) twinkles.push(sparkle(x, y, 6 + rnd() * 9));
  }
  const pearls = alongRR(hole.x - 27, hole.y - 27, hole.w + 54, hole.h + 54, radius + 27, 40)
    .map(([x, y]) => path(circle(x + 1, y + 3, 11), { fill: INK, fillOpacity: 0.35 }) + path(circle(x, y, 11), { fill: 'url(#pearl)', stroke: '#9d80c9', strokeWidth: 1.5 })
      + path(circle(x - 3.5, y - 4, 3.5), { fill: '#fff' })).join('');
  const gem = (x, y, r, f) => path(circle(x + 2, y + 6, r), { fill: INK, fillOpacity: 0.3 }) + path(circle(x, y, r + 8), { fill: 'url(#goldH)', stroke: INK, strokeWidth: 3 })
    + path(circle(x, y, r), { fill: f, stroke: INK, strokeWidth: 3 }) + path(ellipse(x - r * 0.3, y - r * 0.35, r * 0.35, r * 0.2), { fill: '#fff', fillOpacity: 0.85 });
  const diag = [45, 135, 225, 315].map((a, i) => {
    const t = (a * Math.PI) / 180;
    return gem(CX + 440 * Math.cos(t), CY + 440 * Math.sin(t), 20, ['url(#gemCyan)', 'url(#gemLilac)', 'url(#gemCyan)', 'url(#gemLilac)'][i]);
  }).join('');

  const TY = CY - R - 20, rim = (deg) => [CX + (R - 14) * Math.cos(deg * Math.PI / 180), CY + (R - 14) * Math.sin(deg * Math.PI / 180)];
  const crest = g({},
    path(star(CX, TY, 120, 52, 5, -90), { fill: INK, fillOpacity: 0.3, transform: 'translate(4 10)' }),
    path(star(CX, TY, 120, 52, 5, -90), { fill: 'url(#gold)', stroke: INK, strokeWidth: 6, strokeLinejoin: 'round' }),
    path(star(CX, TY, 88, 38, 5, -90), { fill: 'none', stroke: '#fff7d6', strokeOpacity: 0.8, strokeWidth: 4, strokeLinejoin: 'round' }),
    path(heart(CX, TY + 8, 40), { fill: 'url(#gemHeart)', stroke: INK, strokeWidth: 5 }),
    path(ellipse(CX - 16, TY - 10, 12, 7), { fill: '#fff', fillOpacity: 0.85, transform: `rotate(-30 ${CX - 16} ${TY - 10})` }),
    gem(...rim(-118), 12, 'url(#gemHeart)'), gem(...rim(-62), 12, 'url(#gemHeart)'));

  const BY = CY + R - 8;
  const bottomGem = g({},
    ribbonTail(-1), ribbonTail(1),
    path(`M${CX} ${BY + 8}C${CX - 60} ${BY - 52} ${CX - 160} ${BY - 62} ${CX - 170} ${BY - 12}C${CX - 176} ${BY + 34} ${CX - 60} ${BY + 38} ${CX} ${BY + 8}Z`, { fill: 'url(#ribbon)', stroke: INK, strokeWidth: 5 }),
    path(`M${CX} ${BY + 8}C${CX + 60} ${BY - 52} ${CX + 160} ${BY - 62} ${CX + 170} ${BY - 12}C${CX + 176} ${BY + 34} ${CX + 60} ${BY + 38} ${CX} ${BY + 8}Z`, { fill: 'url(#ribbon)', stroke: INK, strokeWidth: 5 }),
    path(`M${CX - 140} ${BY - 22}Q${CX - 90} ${BY - 36} ${CX - 50} ${BY - 12}M${CX + 140} ${BY - 22}Q${CX + 90} ${BY - 36} ${CX + 50} ${BY - 12}`, { fill: 'none', stroke: '#fff', strokeOpacity: 0.6, strokeWidth: 5, strokeLinecap: 'round' }),
    path(heart(CX, BY, 78), { fill: 'url(#goldH)', stroke: INK, strokeWidth: 6 }),
    path(heart(CX, BY, 62), { fill: 'url(#gemHeart)', stroke: INK, strokeWidth: 3 }),
    path(`M${CX} ${BY - 42}L${CX - 40} ${BY - 12}L${CX} ${BY + 52}L${CX + 40} ${BY - 12}Z`, { fill: '#fff', fillOpacity: 0.18 }),
    path(`M${CX - 40} ${BY - 12}H${CX + 40}`, { stroke: '#fff', strokeOpacity: 0.35, strokeWidth: 3 }),
    path(ellipse(CX - 26, BY - 26, 18, 9), { fill: '#fff', fillOpacity: 0.9, transform: `rotate(-30 ${CX - 26} ${BY - 26})` }));

  const body = [
    path(circle(CX, CY, 600), { fill: 'url(#halo)' }),
    path(ellipse(CX, H - 30, 360, 18), { fill: 'url(#floor)' }),
    wing(-1), wing(1),
    // compact body
    path(circle(CX + 6, CY + 14, R), { fill: INK, fillOpacity: 0.35 }),
    path(circle(CX, CY, R), { fill: 'url(#gold)', stroke: INK, strokeWidth: 7 }),
    path(circle(CX, CY, R - 18), { fill: 'none', stroke: '#fff8d8', strokeOpacity: 0.7, strokeWidth: 3 }),
    path(circle(CX, CY, R - 30), { fill: 'url(#enamel)', stroke: '#b8781c', strokeWidth: 4 }),
    path(circle(CX, CY, R - 44), { fill: 'none', stroke: '#fff', strokeOpacity: 0.55, strokeWidth: 3, strokeDasharray: '2 14', strokeLinecap: 'round' }),
    path(twinkles.join(''), { fill: '#fff', fillOpacity: 0.75 }),
    path(`M${CX - 330} ${CY - 300}A450 450 0 0 1 ${CX + 130} ${CY - 430}`, { fill: 'none', stroke: '#fff', strokeOpacity: 0.55, strokeWidth: 14, strokeLinecap: 'round' }),
    diag,
    // mirror bezel
    path(rr(hole.x - 48, hole.y - 40, hole.w + 96, hole.h + 96, radius + 48), { fill: INK, fillOpacity: 0.3 }),
    path(rr(hole.x - 48, hole.y - 48, hole.w + 96, hole.h + 96, radius + 48), { fill: 'url(#goldH)', stroke: INK, strokeWidth: 5 }),
    path(rr(hole.x - 40, hole.y - 40, hole.w + 80, hole.h + 80, radius + 40), { fill: 'url(#bezel)' }),
    pearls,
    path(rr(hole.x - 12, hole.y - 12, hole.w + 24, hole.h + 24, radius + 12), { fill: '#2b1838', stroke: '#c9a24a', strokeWidth: 3 }),
    lip(holeD, '#000', [[6, 0.3], [2.5, 0.6]]),
    crest,
    bottomGem,
    path(sparkle(140, 180, 34), { fill: '#fff6c8', stroke: '#f2b94a', strokeWidth: 3 }),
    path(sparkle(1270, 240, 26), { fill: '#fff', stroke: '#c9a8ff', strokeWidth: 3 }),
    path(sparkle(1300, 1040, 30), { fill: '#fff6c8', stroke: '#f2b94a', strokeWidth: 3 }),
    path(sparkle(110, 1000, 22), { fill: '#fff', stroke: '#ff9ccd', strokeWidth: 3 }),
    path(star(1180, 120, 16, 7), { fill: '#ffd166', stroke: INK, strokeWidth: 3 }),
    path(star(230, 1180, 14, 6), { fill: '#7af0ff', stroke: INK, strokeWidth: 3 }),
  ].join('\n');
  return { defs, body };
}

module.exports = {
  W, H, hole, radius, draw,
  meta: { name: 'Magical Compact', theme: 'magical-girl', rarity: 'rare', translucent: false,
    desc: 'A winged transformation compact with a pearl-ringed mirror. Moon power not included.', tags: ['magical-girl', 'anime', 'compact', 'sparkle', 'wings'] },
};
