'use strict';
// Alien virtual-pet egg: see-through green-to-violet shell with glitter, chrome porthole screen,
// bopper antennae, planet buttons, an alien sticker and a tiny UFO beaming the egg up.
const L = require('../lib');
const { rr, path, g, lg, rg, circle, ellipse, sparkle, star, tf, rng, lip, n } = L;

const W = 1000, H = 1250, hole = { x: 280, y: 440, w: 440, h: 440 }, radius = 28;
const EGG = 'M500 190C770 190 910 500 910 780C910 1010 730 1170 500 1170C270 1170 90 1010 90 780C90 500 230 190 500 190Z';
const INK = '#2f1a5c';

function bopper(s) {
  const x0 = 500 + s * 120, d = `M${x0} 236C${x0 + s * 10} 170 ${x0 + s * 60} 130 ${x0 + s * 120} 112`;
  return path(d, { fill: 'none', stroke: INK, strokeWidth: 18, strokeLinecap: 'round' })
    + path(d, { fill: 'none', stroke: '#9b7bff', strokeWidth: 9, strokeLinecap: 'round' })
    + path(circle(x0 + s * 128, 104, 44), { fill: 'url(#boppGlow)' })
    + path(circle(x0 + s * 128, 104, 28), { fill: 'url(#bopp)', stroke: INK, strokeWidth: 6 })
    + path(ellipse(x0 + s * 128 - 9, 94, 9, 6), { fill: '#fff', fillOpacity: 0.85 });
}

function ufo() {
  const lights = [-78, -40, 0, 40, 78].map((dx, i) => path(circle(500 + dx, 74 + Math.abs(dx) * 0.12, 7), { fill: i % 2 ? '#ffd166' : '#7af0ff', stroke: INK, strokeWidth: 2.5 })).join('');
  return g({ transform: 'translate(0 16)' },
    path('M462 96L398 196H602L538 96Z', { fill: 'url(#beam)' }),
    path(ellipse(500, 46, 50, 40), { fill: 'url(#dome)', stroke: INK, strokeWidth: 5 }),
    path(circle(500, 50, 16), { fill: '#7dff9e', stroke: INK, strokeWidth: 3 }),
    path('M493 48h0.1M507 48h0.1', { stroke: INK, strokeWidth: 7, strokeLinecap: 'round' }),
    path(ellipse(484, 30, 14, 8), { fill: '#fff', fillOpacity: 0.8, transform: 'rotate(-25 484 30)' }),
    path(ellipse(500, 74, 112, 30), { fill: 'url(#saucer)', stroke: INK, strokeWidth: 6 }),
    path('M404 70Q500 54 596 70', { fill: 'none', stroke: '#fff', strokeOpacity: 0.7, strokeWidth: 4, strokeLinecap: 'round' }),
    lights,
    path(ellipse(500, 98, 40, 9), { fill: '#d6ff7a', stroke: INK, strokeWidth: 3 }));
}

function planetButton(cx, cy, kind) {
  const base = path(circle(cx + 3, cy + 10, 50), { fill: INK, fillOpacity: 0.45 })
    + path(circle(cx, cy, 50), { fill: `url(#btn-${kind})`, stroke: INK, strokeWidth: 6 });
  const shine = path(ellipse(cx - 16, cy - 20, 16, 9), { fill: '#fff', fillOpacity: 0.75, transform: `rotate(-30 ${cx - 16} ${cy - 20})` });
  if (kind === 'saturn') return base
    + path(`M${cx - 74} ${cy + 18}C${cx - 90} ${cy + 36} ${cx + 30} ${cy + 10} ${cx + 74} ${cy - 18}`, { fill: 'none', stroke: INK, strokeWidth: 14, strokeLinecap: 'round' })
    + path(`M${cx - 74} ${cy + 18}C${cx - 90} ${cy + 36} ${cx + 30} ${cy + 10} ${cx + 74} ${cy - 18}`, { fill: 'none', stroke: '#ffd166', strokeWidth: 7, strokeLinecap: 'round' }) + shine;
  if (kind === 'moon') return base + path(circle(cx + 14, cy + 10, 9), { fill: '#000', fillOpacity: 0.15 }) + path(circle(cx - 12, cy + 18, 6), { fill: '#000', fillOpacity: 0.15 }) + shine;
  return base + path(star(cx, cy + 2, 24, 10), { fill: '#fff', fillOpacity: 0.95 }) + shine;
}

function alien(cx, cy, s) {
  return g({ transform: tf(cx, cy, -12, s) },
    path('M0 -60C44 -60 60 -26 56 4C50 44 20 64 0 64C-20 64 -50 44 -56 4C-60 -26 -44 -60 0 -60Z', { fill: '#fff', stroke: '#fff', strokeWidth: 16, strokeLinejoin: 'round' }),
    path('M0 -60C44 -60 60 -26 56 4C50 44 20 64 0 64C-20 64 -50 44 -56 4C-60 -26 -44 -60 0 -60Z', { fill: 'url(#alienSkin)', stroke: INK, strokeWidth: 5 }),
    path('M-40 -6C-40 -26 -14 -24 -10 -4C-8 12 -30 18 -40 -6Z', { fill: INK }),
    path('M40 -6C40 -26 14 -24 10 -4C8 12 30 18 40 -6Z', { fill: INK }),
    path(circle(-26, -10, 5), { fill: '#fff' }), path(circle(26, -10, 5), { fill: '#fff' }),
    path('M-10 34Q0 42 10 34', { fill: 'none', stroke: INK, strokeWidth: 5, strokeLinecap: 'round' }),
    path(ellipse(-38, 26, 9, 5), { fill: '#ff8fc7', fillOpacity: 0.7 }), path(ellipse(38, 26, 9, 5), { fill: '#ff8fc7', fillOpacity: 0.7 }));
}

function draw() {
  const holeD = rr(hole.x, hole.y, hole.w, hole.h, radius);
  const defs = [
    lg('shell', [0, 0, 1, 1], [[0, '#b9ffd8', 0.5], [0.45, '#7be8c0', 0.42], [1, '#7a4be0', 0.62]]),
    rg('shellRim', [0.5, 0.5, 0.5], [[0.75, '#fff', 0], [1, '#5c2fb0', 0.45]]),
    lg('gloss', [0, 0, 0, 1], [[0, '#fff', 0.75], [1, '#fff', 0]]),
    lg('bezel', [0, 0, 1, 1], [[0, '#f4efff'], [0.4, '#b6a6ee'], [0.75, '#6e5bb8'], [1, '#c7bbff']]),
    lg('bezelIn', [0, 0, 0, 1], [[0, '#1c1033'], [1, '#2d1a52']]),
    rg('bopp', [0.4, 0.35, 0.7], [[0, '#f3ffc4'], [0.5, '#a8ff5a'], [1, '#3fbf2a']]),
    rg('boppGlow', [0.5, 0.5, 0.5], [[0, '#d6ff7a', 0.7], [1, '#d6ff7a', 0]]),
    lg('beam', [0, 0, 0, 1], [[0, '#e9ff9a', 0.75], [1, '#e9ff9a', 0.05]]),
    rg('dome', [0.4, 0.3, 0.8], [[0, '#ffffff', 0.9], [0.6, '#bff6ff', 0.65], [1, '#6fd3ff', 0.8]]),
    lg('saucer', [0, 0, 0, 1], [[0, '#f2f0ff'], [0.5, '#b9b3d9'], [1, '#6c6699']]),
    rg('btn-saturn', [0.4, 0.35, 0.75], [[0, '#ffe2f2'], [1, '#ff5fa8']]),
    rg('btn-moon', [0.4, 0.35, 0.75], [[0, '#fffbe6'], [1, '#d8c36a']]),
    rg('btn-star', [0.4, 0.35, 0.75], [[0, '#d9fbff'], [1, '#2fa8d8']]),
    lg('alienSkin', [0, 0, 0, 1], [[0, '#b6ff8a'], [1, '#4fcf5a']]),
    rg('nebula', [0.5, 0.5, 0.5], [[0, '#ff8fe0', 0.45], [1, '#ff8fe0', 0]]),
    rg('nebula2', [0.5, 0.5, 0.5], [[0, '#7af0ff', 0.4], [1, '#7af0ff', 0]]),
    rg('floor', [0.5, 0.5, 0.5], [[0, '#2f1a5c', 0.4], [1, '#2f1a5c', 0]]),
    `<clipPath id="eggClip"><path d="${EGG}"/></clipPath>`,
  ].join('');

  const rnd = rng(23), glitter = [], spots = [];
  for (let i = 0; i < 70; i++) {
    const x = 100 + rnd() * 800, y = 200 + rnd() * 960;
    if (x > 230 && x < 770 && y > 390 && y < 930) continue;
    glitter.push(i % 5 ? circle(x, y, 1.5 + rnd() * 2.5) : sparkle(x, y, 6 + rnd() * 6));
  }
  for (const [x, y, r] of [[200, 520, 26], [810, 600, 20], [160, 900, 18], [840, 920, 28], [700, 1080, 16], [330, 300, 14]]) spots.push(circle(x, y, r));

  const rivets = [[hole.x - 24, hole.y - 24], [hole.x + hole.w + 24, hole.y - 24], [hole.x - 24, hole.y + hole.h + 24], [hole.x + hole.w + 24, hole.y + hole.h + 24],
    [500, hole.y - 30], [500, hole.y + hole.h + 30], [hole.x - 30, hole.y + hole.h / 2], [hole.x + hole.w + 30, hole.y + hole.h / 2]]
    .map(([x, y]) => path(circle(x, y, 7), { fill: '#efeaff', stroke: '#4b3a8a', strokeWidth: 2.5 })).join('');

  const body = [
    path(ellipse(500, 1212, 330, 22), { fill: 'url(#floor)' }),
    bopper(-1), bopper(1),
    ufo(),
    // translucent egg shell
    path(EGG, { fill: 'url(#shell)' }),
    g({ clipPath: 'url(#eggClip)' },
      path(ellipse(260, 1000, 220, 160), { fill: 'url(#nebula)' }),
      path(ellipse(780, 360, 200, 160), { fill: 'url(#nebula2)' }),
      path(spots.join(''), { fill: '#3a1f8a', fillOpacity: 0.22 }),
      path(glitter.join(''), { fill: '#fff', fillOpacity: 0.8 }),
      path(EGG, { fill: 'url(#shellRim)' }),
      path('M200 520C220 360 330 236 470 222C330 270 250 380 232 540Z', { fill: 'url(#gloss)' })),
    path(EGG, { fill: 'none', stroke: INK, strokeWidth: 9 }),
    path('M118 800C118 1000 270 1146 500 1146', { fill: 'none', stroke: '#fff', strokeOpacity: 0.3, strokeWidth: 6, strokeLinecap: 'round' }),
    // porthole screen
    path(rr(hole.x - 52, hole.y - 44, hole.w + 104, hole.h + 104, radius + 50), { fill: INK, fillOpacity: 0.45 }),
    path(rr(hole.x - 52, hole.y - 52, hole.w + 104, hole.h + 104, radius + 50), { fill: 'url(#bezel)', stroke: INK, strokeWidth: 6 }),
    path(rr(hole.x - 16, hole.y - 16, hole.w + 32, hole.h + 32, radius + 14), { fill: 'url(#bezelIn)', stroke: '#4b3a8a', strokeWidth: 3 }),
    lip(holeD, '#000', [[6, 0.3], [2.5, 0.6]]),
    rivets,
    path(`M${hole.x - 36} ${hole.y + 80}V${hole.y + 10}Q${hole.x - 36} ${hole.y - 36} ${hole.x + 10} ${hole.y - 36}H${hole.x + 120}`, { fill: 'none', stroke: '#fff', strokeOpacity: 0.85, strokeWidth: 6, strokeLinecap: 'round' }),
    // buttons + speaker
    planetButton(340, 1000, 'saturn'), planetButton(500, 1040, 'moon'), planetButton(660, 1000, 'star'),
    path([[470, 1118], [500, 1118], [530, 1118], [485, 1136], [515, 1136]].map(([x, y]) => circle(x, y, 6)).join(''), { fill: INK, fillOpacity: 0.6 }),
    alien(190, 660, 0.95),
    path(star(820, 520, 28, 12), { fill: '#ffd166', stroke: '#fff', strokeWidth: 6, strokeLinejoin: 'round', paintOrder: 'stroke' }),
    path(star(820, 520, 28, 12), { fill: 'none', stroke: INK, strokeWidth: 3, strokeLinejoin: 'round' }),
    path(sparkle(86, 330, 26), { fill: '#d6ff7a', stroke: INK, strokeWidth: 3 }),
    path(sparkle(930, 260, 20), { fill: '#7af0ff', stroke: INK, strokeWidth: 3 }),
    path(sparkle(948, 1060, 24), { fill: '#ff8fe0', stroke: INK, strokeWidth: 3 }),
    path(star(64, 1100, 16, 7), { fill: '#ffd166', stroke: INK, strokeWidth: 3 }),
  ].join('\n');
  return { defs, body };
}

module.exports = {
  W, H, hole, radius, draw,
  meta: { name: 'UFO Pet', theme: 'space', rarity: 'rare', translucent: true,
    desc: 'A see-through alien pet egg with a porthole screen, planet buttons and its own tiny UFO escort.', tags: ['virtual-pet', 'alien', 'space', 'clear', 'cute'] },
};
