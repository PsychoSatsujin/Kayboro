'use strict';
// Pearl Compact: an opened seashell-style pocket console in metallic lilac with a pearly sheen. The lid
// holds the screen like a compact mirror; one long pearl barrel hinge with chrome bands carries power +
// charge LEDs and dangles a moon and a pearl-drop charm. The lower half is a scallop shell with fan ribs
// and a scalloped rim: a round dimpled dial on the left, a vertical tower of three candy keys on the
// right, a drawn mini screen with a doodle pet, a slide switch, a mascot key, a dot speaker and two
// vinyl stickers (star, heart). Original Kayboro artwork.
const L = require('../lib');
const { rr, path, g, lg, rg, circle, ellipse, sparkle, star, heart, tf, rng, lip, n, poly } = L;

const W = 1300, H = 1500, hole = { x: 290, y: 150, w: 720, h: 480 }, radius = 18;
const INK = '#3a2a6b';
const LID = 'M110 210C110 116 168 62 262 58Q650 34 1038 58C1132 62 1190 116 1190 210V770Q1190 806 1154 806H146Q110 806 110 770Z';
// Scallop-shell base: straight top under the hinge, then a scalloped rim around a half-ellipse.
const SC = { cx: 650, cy: 1036, rx: 564, ry: 386, count: 9 };
const scPt = (i) => {
  const a = (i / SC.count) * Math.PI;
  return [SC.cx + SC.rx * Math.cos(a), SC.cy + SC.ry * Math.sin(a)];
};
const BASE = (() => {
  let d = `M86 ${SC.cy}V900Q86 826 160 826H1140Q1214 826 1214 900V${SC.cy}`;
  for (let i = 0; i < SC.count; i++) {
    const [x1, y1] = scPt(i), [x2, y2] = scPt(i + 1), r = Math.hypot(x2 - x1, y2 - y1) * 0.6;
    d += `L${n(x1)} ${n(y1)}A${n(r)} ${n(r)} 0 0 1 ${n(x2)} ${n(y2)}`;
  }
  return `${d}Z`;
})();

/** Drop shadow + shape + ink outline. */
function part(d, fill, sw = 7, sh = [6, 12, 0.35]) {
  return path(d, { fill: INK, fillOpacity: sh[2], transform: `translate(${sh[0]} ${sh[1]})` })
    + path(d, { fill, stroke: INK, strokeWidth: sw, strokeLinejoin: 'round' });
}

/** A charm on a little bead chain hanging from a hinge end cap. */
function charm(x0, y0, x1, y1, shape) {
  const beads = [];
  for (let i = 1; i < 6; i++) { const t = i / 6; beads.push(circle(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t + Math.sin(t * Math.PI) * 6, 4.2)); }
  return path(beads.join(''), { fill: 'url(#chromeR)', stroke: INK, strokeWidth: 2 })
    + path(circle(x1, y1, 8), { fill: 'none', stroke: INK, strokeWidth: 7 })
    + path(circle(x1, y1, 8), { fill: 'none', stroke: 'url(#chrome)', strokeWidth: 3.5 })
    + shape;
}

/** Long pearl barrel hinge with chrome bands, pearl end caps and two dangling charms. */
function hinge() {
  const cap = (cx) => g({},
    path(circle(cx + 4, 822, 42), { fill: INK, fillOpacity: 0.35 }),
    path(circle(cx, 814, 42), { fill: 'url(#chromeR)', stroke: INK, strokeWidth: 6 }),
    path(circle(cx, 814, 26), { fill: 'url(#gemMint)', stroke: INK, strokeWidth: 4 }),
    path(ellipse(cx - 8, 805, 8, 5), { fill: '#fff', fillOpacity: 0.9, transform: `rotate(-30 ${cx - 8} 805)` }),
    path(`M${cx - 34} 800A36 36 0 0 1 ${cx - 12} 778`, { fill: 'none', stroke: '#fff', strokeOpacity: 0.85, strokeWidth: 4, strokeLinecap: 'round' }));
  const band = (x) => path(rr(x - 16, 772, 32, 84, 12), { fill: 'url(#chrome)', stroke: INK, strokeWidth: 5 })
    + path(`M${x - 6} 782V846`, { stroke: '#fff', strokeOpacity: 0.85, strokeWidth: 3, strokeLinecap: 'round' });
  const moon = g({},
    path('M50 906A33 33 0 1 0 50 972A40 40 0 0 1 50 906Z', { fill: INK, fillOpacity: 0.3, transform: 'translate(3 7)' }),
    path('M50 906A33 33 0 1 0 50 972A40 40 0 0 1 50 906Z', { fill: 'url(#starSt)', stroke: INK, strokeWidth: 4, strokeLinejoin: 'round' }),
    path('M26 926A26 26 0 0 0 30 960', { fill: 'none', stroke: '#fff', strokeOpacity: 0.85, strokeWidth: 4, strokeLinecap: 'round' }));
  const drop = g({},
    path('M1252 896C1272 922 1284 940 1284 958A32 32 0 0 1 1220 958C1220 940 1232 922 1252 896Z', { fill: INK, fillOpacity: 0.3, transform: 'translate(3 7)' }),
    path('M1252 896C1272 922 1284 940 1284 958A32 32 0 0 1 1220 958C1220 940 1232 922 1252 896Z', { fill: 'url(#pearl)', stroke: INK, strokeWidth: 4, strokeLinejoin: 'round' }),
    path('M1252 896C1272 922 1284 940 1284 958A32 32 0 0 1 1220 958C1220 940 1232 922 1252 896Z', { fill: 'url(#pearlSheen)' }),
    path(sparkle(1240, 952, 9), { fill: '#fff' }));
  return g({},
    path(rr(70, 786, 1170, 76, 38), { fill: INK, fillOpacity: 0.35 }),
    path(rr(60, 776, 1180, 76, 38), { fill: 'url(#barrel)', stroke: INK, strokeWidth: 6 }),
    path(rr(60, 776, 1180, 76, 38), { fill: 'url(#pearlSheen)', fillOpacity: 0.6 }),
    path('M96 790H1204', { stroke: '#fff', strokeWidth: 5, strokeLinecap: 'round', strokeOpacity: 0.9 }),
    path('M100 838H1200', { stroke: '#6b52b0', strokeWidth: 3, strokeLinecap: 'round', strokeOpacity: 0.45 }),
    band(250), band(480), band(820), band(1050),
    // LED window
    path(rr(572, 795, 156, 38, 19), { fill: '#1d1435', stroke: INK, strokeWidth: 4 }),
    path(circle(600, 814, 20), { fill: 'url(#ledG)' }), path(circle(600, 814, 8), { fill: '#eafff2', stroke: '#2b8a5a', strokeWidth: 2 }),
    g({ class: 'fc-blink' }, path(circle(700, 814, 20), { fill: 'url(#ledO)' }), path(circle(700, 814, 8), { fill: '#fff3d6', stroke: '#b7651c', strokeWidth: 2 })),
    // power + bolt glyphs
    path('M631 806A9 9 0 1 0 639 806M635 802V812', { fill: 'none', stroke: '#b9a9e6', strokeWidth: 3, strokeLinecap: 'round' }),
    path(poly([[667, 801], [658, 815], [664, 815], [660, 827], [671, 811], [665, 811]]), { fill: '#b9a9e6' }),
    charm(56, 846, 50, 898, moon), charm(1248, 846, 1252, 892, drop),
    cap(60), cap(1240));
}

function latch() {
  return g({},
    path(rr(566, 12, 168, 64, 28), { fill: INK, fillOpacity: 0.3, transform: 'translate(4 8)' }),
    path(rr(566, 12, 168, 64, 28), { fill: 'url(#lilacDeep)', stroke: INK, strokeWidth: 6 }),
    path('M592 23H624M676 23H708', { stroke: '#fff', strokeOpacity: 0.8, strokeWidth: 5, strokeLinecap: 'round' }),
    path(heart(650, 29, 12), { fill: 'url(#heartSt)', stroke: INK, strokeWidth: 3.5 }),
    path(ellipse(645, 24, 4, 2.5), { fill: '#fff', fillOpacity: 0.85 }));
}

function screenPlate() {
  const holeD = rr(hole.x, hole.y, hole.w, hole.h, radius);
  return g({},
    path(rr(hole.x - 62, hole.y - 56, hole.w + 124, hole.h + 124, 58), { fill: INK, fillOpacity: 0.3 }),
    path(rr(hole.x - 64, hole.y - 64, hole.w + 128, hole.h + 128, 58), { fill: 'url(#pearl)', stroke: INK, strokeWidth: 6 }),
    path(rr(hole.x - 64, hole.y - 64, hole.w + 128, hole.h + 128, 58), { fill: 'url(#pearlSheen)' }),
    path(rr(hole.x - 40, hole.y - 40, hole.w + 80, hole.h + 80, 40), { fill: 'url(#bezel)', stroke: '#5a4596', strokeWidth: 4 }),
    lip(holeD, '#000', [[10, 0.25], [5, 0.4], [2.5, 0.7]]),
    path(`M${hole.x - 46} ${hole.y + 150}V${hole.y - 10}Q${hole.x - 46} ${hole.y - 46} ${hole.x - 10} ${hole.y - 46}H${hole.x + 220}`,
      { fill: 'none', stroke: '#fff', strokeOpacity: 0.95, strokeWidth: 7, strokeLinecap: 'round' }),
    path(`M${hole.x + hole.w + 46} ${hole.y + hole.h - 120}V${hole.y + hole.h + 10}Q${hole.x + hole.w + 46} ${hole.y + hole.h + 46} ${hole.x + hole.w + 10} ${hole.y + hole.h + 46}H${hole.x + hole.w - 160}`,
      { fill: 'none', stroke: '#8a74cc', strokeOpacity: 0.7, strokeWidth: 5, strokeLinecap: 'round' }));
}

/** Small embossed mascot: a round face with two bean ears. */
function mascot(cx, cy, s, fill = 'url(#lilacDeep)') {
  return g({ transform: tf(cx, cy, 0, s) },
    path('M-26 -14C-34 -36 -18 -44 -8 -26M26 -14C34 -36 18 -44 8 -26', { fill, stroke: INK, strokeWidth: 4, strokeLinejoin: 'round' }),
    path(ellipse(0, 0, 30, 25), { fill, stroke: INK, strokeWidth: 4 }),
    path(circle(-10, -2, 4) + circle(10, -2, 4), { fill: INK }),
    path('M-5 8Q0 12 5 8', { fill: 'none', stroke: INK, strokeWidth: 3, strokeLinecap: 'round' }),
    path(ellipse(-18, 6, 5, 3) + ellipse(18, 6, 5, 3), { fill: '#ff9cc8', fillOpacity: 0.8 }));
}

function miniScreen() {
  const x = 470, y = 880, w = 360, h = 236;
  const lx = x + 28, ly = y + 26, lw = w - 56, lh = h - 52;
  const scan = [];
  for (let yy = ly + 6; yy < ly + lh; yy += 7) scan.push(`M${lx + 4} ${yy}H${lx + lw - 4}`);
  const pet = g({ transform: tf(650, 1012) },
    path(ellipse(0, 44, 54, 8), { fill: '#2c5a4c', fillOpacity: 0.22 }),
    // sprout ears
    path('M-14 -38C-30 -66 -50 -58 -44 -44C-38 -32 -24 -36 -14 -38Z', { fill: '#bff3dc', stroke: '#2c5a4c', strokeWidth: 4, strokeLinejoin: 'round' }),
    path('M14 -38C30 -66 50 -58 44 -44C38 -32 24 -36 14 -38Z', { fill: '#bff3dc', stroke: '#2c5a4c', strokeWidth: 4, strokeLinejoin: 'round' }),
    path('M-46 30C-52 -8 -32 -42 0 -42C32 -42 52 -8 46 30C44 42 30 44 0 44C-30 44 -44 42 -46 30Z', { fill: '#f2fff8', stroke: '#2c5a4c', strokeWidth: 4.5, strokeLinejoin: 'round' }),
    path('M-36 -14C-30 -30 -16 -36 -4 -36', { fill: 'none', stroke: '#fff', strokeWidth: 5, strokeLinecap: 'round' }),
    path(ellipse(-15, -2, 5, 7) + ellipse(15, -2, 5, 7), { fill: '#2c5a4c' }),
    path(circle(-13, -5, 2) + circle(17, -5, 2), { fill: '#fff' }),
    path('M-7 10Q0 17 7 10', { fill: 'none', stroke: '#2c5a4c', strokeWidth: 3.5, strokeLinecap: 'round' }),
    path(ellipse(-28, 10, 7, 4) + ellipse(28, 10, 7, 4), { fill: '#ff8fb8', fillOpacity: 0.8 }),
    path('M-30 44V50M30 44V50', { stroke: '#2c5a4c', strokeWidth: 6, strokeLinecap: 'round' }));
  return g({},
    path(rr(x + 4, y + 10, w, h, 34), { fill: INK, fillOpacity: 0.3 }),
    path(rr(x, y, w, h, 34), { fill: 'url(#bezelMini)', stroke: INK, strokeWidth: 6 }),
    path(rr(lx - 6, ly - 6, lw + 12, lh + 12, 18), { fill: '#0f0a1f', fillOpacity: 0.55 }),
    path(rr(lx, ly, lw, lh, 14), { fill: 'url(#lcd)' }),
    path(scan.join(''), { stroke: '#2c5a4c', strokeOpacity: 0.07, strokeWidth: 2 }),
    // status row: hearts + apple
    [0, 1, 2].map((i) => path(heart(lx + 22 + i * 24, ly + 20, 8), { fill: i < 2 ? '#ff7aa8' : 'none', stroke: '#2c5a4c', strokeWidth: 2.5 })).join(''),
    path(circle(lx + lw - 24, ly + 22, 9), { fill: '#ffb08a', stroke: '#2c5a4c', strokeWidth: 2.5 }),
    path(`M${lx + lw - 24} ${ly + 13}Q${lx + lw - 22} ${ly + 7} ${lx + lw - 16} ${ly + 6}`, { fill: 'none', stroke: '#2c5a4c', strokeWidth: 2.5, strokeLinecap: 'round' }),
    pet,
    path(heart(722, 958, 9), { fill: '#ff7aa8', stroke: '#2c5a4c', strokeWidth: 2.5, class: 'fc-tw' }),
    path(`M${lx + 18} ${ly + lh - 14}Q${lx + 60} ${ly + lh - 22} ${lx + 100} ${ly + lh - 14}T${lx + lw - 18} ${ly + lh - 14}`, { fill: 'none', stroke: '#2c5a4c', strokeOpacity: 0.35, strokeWidth: 3, strokeLinecap: 'round' }),
    path(`M${lx + lw - 70} ${ly}L${lx + lw - 20} ${ly}L${lx + lw - 110} ${ly + lh}H${lx + lw - 160}Z`, { fill: '#fff', fillOpacity: 0.16 }),
    path(`M${x + 18} ${y + 120}V${y + 40}Q${x + 18} ${y + 16} ${x + 42} ${y + 16}H${x + 150}`, { fill: 'none', stroke: '#fff', strokeOpacity: 0.5, strokeWidth: 4, strokeLinecap: 'round' }));
}

/** Round pearl dial: one dimpled disc in a recessed well, with four tiny dot marks (no cross). */
function dial(cx, cy) {
  const dots = [0, 1, 2, 3].map((i) => {
    const a = (i * Math.PI) / 2 - Math.PI / 2;
    return circle(cx + 66 * Math.cos(a), cy + 66 * Math.sin(a), 6);
  }).join('');
  return g({},
    path(circle(cx, cy, 116), { fill: 'url(#well)', stroke: INK, strokeOpacity: 0.5, strokeWidth: 4 }),
    path(`M${cx - 82} ${cy + 82}A116 116 0 0 0 ${cx + 82} ${cy + 82}`, { fill: 'none', stroke: '#fff', strokeOpacity: 0.55, strokeWidth: 5, strokeLinecap: 'round' }),
    path(circle(cx + 5, cy + 12, 92), { fill: INK, fillOpacity: 0.4 }),
    path(circle(cx, cy, 92), { fill: 'url(#pearl)', stroke: INK, strokeWidth: 6 }),
    path(circle(cx, cy, 92), { fill: 'url(#pearlSheen)' }),
    path(circle(cx, cy, 80), { fill: 'none', stroke: '#c9bce9', strokeWidth: 3 }),
    path(dots, { fill: '#a995d8' }),
    path(circle(cx, cy, 34), { fill: 'url(#dimple)', stroke: '#b9a9e6', strokeWidth: 3 }),
    path(`M${cx + 24} ${cy + 18}A30 30 0 0 1 ${cx + 6} ${cy + 30}`, { fill: 'none', stroke: '#fff', strokeWidth: 4, strokeLinecap: 'round' }),
    path(`M${cx - 74} ${cy - 30}A80 80 0 0 1 ${cx - 30} ${cy - 74}`, { fill: 'none', stroke: '#fff', strokeWidth: 7, strokeLinecap: 'round' }),
    path(sparkle(cx - 44, cy - 40, 10), { fill: '#fff' }));
}

/** Vertical tower of three candy keys in a pill-shaped well. */
function tower(cx, cy) {
  const glyphs = [star(0, 0, 17, 7.5), heart(0, 1, 14), sparkle(0, 0, 17, 0.2)];
  const cols = ['butter', 'pink', 'mint'];
  let out = path(rr(cx - 62, cy - 158, 124, 316, 62), { fill: 'url(#well)', stroke: INK, strokeOpacity: 0.5, strokeWidth: 4 })
    + path(`M${cx - 44} ${cy + 140}Q${cx} ${cy + 164} ${cx + 44} ${cy + 140}`, { fill: 'none', stroke: '#fff', strokeOpacity: 0.55, strokeWidth: 5, strokeLinecap: 'round' });
  [-1, 0, 1].forEach((k, i) => {
    const x = cx, y = cy + k * 98;
    out += path(circle(x + 4, y + 10, 42), { fill: INK, fillOpacity: 0.4 })
      + path(circle(x, y, 42), { fill: `url(#btn-${cols[i]})`, stroke: INK, strokeWidth: 6 })
      + path(ellipse(x - 13, y - 18, 17, 9), { fill: '#fff', fillOpacity: 0.8, transform: `rotate(-25 ${x - 13} ${y - 18})` })
      + path(glyphs[i], { fill: '#fff', fillOpacity: 0.95, stroke: INK, strokeOpacity: 0.25, strokeWidth: 2, transform: `translate(${x} ${y + 4})` });
  });
  return out;
}

/** Horizontal three-step slide switch with pearl thumb. */
function slideSwitch(cx, cy) {
  return path(rr(cx - 100, cy - 18, 200, 36, 18), { fill: 'url(#well)', stroke: INK, strokeOpacity: 0.55, strokeWidth: 4 })
    + path(rr(cx - 88, cy - 6, 176, 12, 6), { fill: '#2a1d4f', fillOpacity: 0.7 })
    + [-70, 0, 70].map((dx, i) => path(circle(cx + dx, cy + 34, 5), { fill: i === 0 ? '#ff7aa8' : '#2a1d4f', fillOpacity: i === 0 ? 1 : 0.4 })).join('')
    + path(rr(cx - 98 + 3, cy - 24 + 7, 64, 48, 20), { fill: INK, fillOpacity: 0.4 })
    + path(rr(cx - 98, cy - 24, 64, 48, 20), { fill: 'url(#pearl)', stroke: INK, strokeWidth: 5 })
    + path(rr(cx - 98, cy - 24, 64, 48, 20), { fill: 'url(#pearlSheen)' })
    + path(`M${cx - 74} ${cy - 10}V${cy + 10}M${cx - 66} ${cy - 10}V${cy + 10}M${cx - 58} ${cy - 10}V${cy + 10}`, { stroke: '#a995d8', strokeWidth: 3, strokeLinecap: 'round' })
    + path(`M${cx - 86} ${cy - 15}H${cx - 54}`, { stroke: '#fff', strokeWidth: 4, strokeLinecap: 'round' });
}

/** Fan ribs radiating from the hinge to every scallop valley (drawn inside the base clip). */
function ribs() {
  let d = '', hi = '';
  for (let i = 1; i < SC.count; i++) {
    const [x, y] = scPt(i), ux = x - 650, uy = y - 840, k = 0.32;
    d += `M${n(650 + ux * k)} ${n(840 + uy * k)}L${n(x)} ${n(y)}`;
    hi += `M${n(650 + ux * k + 3)} ${n(840 + uy * k + 1)}L${n(x + 3)} ${n(y + 1)}`;
  }
  return path(d, { stroke: '#6b52b0', strokeOpacity: 0.3, strokeWidth: 5, strokeLinecap: 'round' })
    + path(hi, { stroke: '#fff', strokeOpacity: 0.4, strokeWidth: 3, strokeLinecap: 'round' });
}
function speaker(cx, cy) {
  const holes = [];
  for (let q = -3; q <= 3; q++) for (let r = -3; r <= 3; r++) {
    if (Math.abs(q + r) > 3) continue;
    const x = cx + 19 * (q + r / 2), y = cy + 19 * r * 0.866;
    holes.push(circle(x, y, 5.6));
  }
  return path(circle(cx, cy, 78), { fill: 'url(#well)', stroke: INK, strokeOpacity: 0.35, strokeWidth: 3 })
    + path(holes.join(''), { fill: '#fff', fillOpacity: 0.55, transform: 'translate(1.5 2.5)' })
    + path(holes.join(''), { fill: '#2a1d4f', fillOpacity: 0.85 });
}

function sticker(cx, cy, rot, d, fill, deco = '') {
  return g({ transform: tf(cx, cy, rot) },
    path(d, { fill: INK, fillOpacity: 0.3, stroke: INK, strokeOpacity: 0.3, strokeWidth: 18, strokeLinejoin: 'round', transform: 'translate(3 6)' }),
    path(d, { fill: '#fff', stroke: '#fff', strokeWidth: 18, strokeLinejoin: 'round' }),
    path(d, { fill: 'none', stroke: '#c9bce9', strokeWidth: 20, strokeLinejoin: 'round', strokeOpacity: 0.6, transform: 'translate(1 2)' }),
    path(d, { fill: '#fff', stroke: '#fff', strokeWidth: 16, strokeLinejoin: 'round' }),
    path(d, { fill, stroke: INK, strokeWidth: 3.5, strokeLinejoin: 'round' }),
    deco);
}

function draw() {
  const defs = [
    lg('lilac', [0, 0, 0.7, 1], [[0, '#f4ecff'], [0.3, '#d9c8fa'], [0.5, '#bfa9ef'], [0.53, '#e9dffd'], [0.7, '#b39be9'], [1, '#8a6fd0']]),
    lg('lilacBase', [0, 0, 0.7, 1], [[0, '#e4d6ff'], [0.3, '#c8b4f2'], [0.5, '#ad94e3'], [0.53, '#dccdfa'], [0.7, '#a185de'], [1, '#7a5ec2']]),
    lg('lilacDeep', [0, 0, 0, 1], [[0, '#cbb6f7'], [1, '#8466cc']]),
    lg('pearlSheen', [0, 0, 1, 1], [[0, '#ffffff', 0.45], [0.22, '#ffc6e6', 0.36], [0.42, '#ffffff', 0], [0.6, '#bff7ec', 0.34], [0.8, '#c4d8ff', 0.3], [1, '#ffffff', 0]]),
    lg('pearl', [0, 0, 0.6, 1], [[0, '#ffffff'], [0.45, '#f1eaff'], [1, '#cbbbf0']]),
    lg('bezel', [0, 0, 0, 1], [[0, '#2a1d4f'], [1, '#1a1233']]),
    lg('bezelMini', [0, 0, 0.5, 1], [[0, '#5d4a9e'], [1, '#2e2158']]),
    lg('lcd', [0, 0, 0.4, 1], [[0, '#dbfbe9'], [1, '#a9e7cb']]),
    lg('chrome', [0, 0, 0, 1], [[0, '#ffffff'], [0.22, '#e9e8f7'], [0.5, '#9d9cc4'], [0.62, '#c9c8e6'], [0.85, '#f7f6ff'], [1, '#7f7da8']]),
    rg('chromeR', [0.4, 0.35, 0.75], [[0, '#ffffff'], [0.45, '#dedcf2'], [0.8, '#9896c0'], [1, '#d2d0ec']]),
    lg('barrel', [0, 0, 0, 1], [[0, '#f6f0ff'], [0.3, '#d9c8fa'], [0.62, '#a68bdf'], [0.8, '#c9b6f4'], [1, '#7a5ec2']]),
    rg('dimple', [0.62, 0.68, 0.7], [[0, '#ffffff'], [0.6, '#e6dcfb'], [1, '#bba8ea']]),
    rg('well', [0.5, 0.4, 0.7], [[0, '#a68bdf'], [1, '#c2acef']]),
    rg('gemMint', [0.35, 0.3, 0.8], [[0, '#e6fff6'], [0.5, '#7ff0d0'], [1, '#2fb592']]),
    rg('btn-butter', [0.4, 0.35, 0.75], [[0, '#fff6cf'], [1, '#ffb52e']]),
    rg('btn-pink', [0.4, 0.35, 0.75], [[0, '#ffe0ee'], [1, '#ff6fa8']]),
    rg('btn-sky', [0.4, 0.35, 0.75], [[0, '#e0f4ff'], [1, '#55b4ff']]),
    rg('btn-mint', [0.4, 0.35, 0.75], [[0, '#e0fff3'], [1, '#3fd3a2']]),
    rg('ledG', [0.5, 0.5, 0.5], [[0, '#b8ffd2'], [0.4, '#4cff94', 0.7], [1, '#4cff94', 0]]),
    rg('ledO', [0.5, 0.5, 0.5], [[0, '#ffe2a8'], [0.4, '#ffaa3b', 0.7], [1, '#ffaa3b', 0]]),
    rg('floor', [0.5, 0.5, 0.5], [[0, '#2a1d4f', 0.45], [1, '#2a1d4f', 0]]),
    rg('gloss', [0.5, 0.5, 0.5], [[0, '#ffffff', 0.4], [0.6, '#ffe6f6', 0.15], [1, '#ffffff', 0]]),
    rg('glow', [0.5, 0.5, 0.5], [[0, '#c9a8ff', 0.22], [1, '#c9a8ff', 0]]),
    lg('starSt', [0, 0, 0, 1], [[0, '#fff2a8'], [1, '#ffb83d']]),
    lg('heartSt', [0, 0, 0, 1], [[0, '#ffb3d4'], [1, '#ff5c9a']]),
    `<clipPath id="lidClip"><path d="${LID}"/></clipPath><clipPath id="baseClip"><path d="${BASE}"/></clipPath>`,
    '<style>.fc-blink{animation:fc-blink 2.4s steps(1) infinite}.fc-tw{animation:fc-tw 3s ease-in-out infinite}'
      + '@keyframes fc-blink{0%,55%{opacity:1}56%,100%{opacity:.25}}@keyframes fc-tw{0%,100%{opacity:1}50%{opacity:.35}}'
      + '@media (prefers-reduced-motion:reduce){*{animation:none!important}}</style>',
  ].join('');

  const rnd = rng(31), glit = [];
  for (let i = 0; i < 60; i++) {
    const x = 100 + rnd() * 1100, y = 50 + rnd() * 1370;
    if (x > hole.x - 80 && x < hole.x + hole.w + 80 && y > hole.y - 80 && y < hole.y + hole.h + 80) continue;
    glit.push(circle(x, y, 1.2 + rnd() * 2));
  }
  const shell = (d, clip, fill = 'url(#lilac)') => g({},
    part(d, fill),
    g({ clipPath: `url(#${clip})` },
      path(d, { fill: 'url(#pearlSheen)' }),
      path(glit.join(''), { fill: '#fff', fillOpacity: 0.6 }),
      path(ellipse(260, clip === 'lidClip' ? 150 : 900, 260, 120), { fill: 'url(#gloss)', transform: `rotate(-20 260 ${clip === 'lidClip' ? 150 : 900})` })));

  const body = [
    path(ellipse(650, 760, 640, 700), { fill: 'url(#glow)' }),
    path(ellipse(650, 1460, 560, 26), { fill: 'url(#floor)' }),
    // base half (with a visible bottom thickness)
    path(BASE, { fill: INK, fillOpacity: 0.35, transform: 'translate(6 26)' }),
    path(BASE, { fill: 'url(#lilacDeep)', stroke: INK, strokeWidth: 7, transform: 'translate(0 14)' }),
    shell(BASE, 'baseClip', 'url(#lilacBase)'),
    g({ clipPath: 'url(#baseClip)' }, ribs()),
    path('M112 1060V900Q112 852 160 852H600', { fill: 'none', stroke: '#fff', strokeOpacity: 0.75, strokeWidth: 6, strokeLinecap: 'round' }),
    path(BASE, { fill: 'none', stroke: '#8a6fd0', strokeOpacity: 0.45, strokeWidth: 3, transform: 'translate(650 1110) scale(0.95 0.93) translate(-650 -1110)' }),
    miniScreen(),
    dial(250, 1012),
    tower(1050, 1030),
    slideSwitch(650, 1182),
    path(circle(650, 1290, 40), { fill: INK, fillOpacity: 0.35, transform: 'translate(3 8)' }),
    path(circle(650, 1290, 40), { fill: 'url(#pearl)', stroke: INK, strokeWidth: 5 }),
    mascot(650, 1294, 0.82, 'url(#lilac)'),
    speaker(960, 1262),
    sticker(330, 1244, -14, heart(0, 0, 52), 'url(#heartSt)',
      path(ellipse(-20, -22, 14, 8), { fill: '#fff', fillOpacity: 0.75, transform: 'rotate(-30 -20 -22)' })
      + path(sparkle(18, 4, 12), { fill: '#fff' })),
    // lid half
    latch(),
    shell(LID, 'lidClip'),
    path('M134 400V214Q134 86 262 82Q450 70 640 66', { fill: 'none', stroke: '#fff', strokeOpacity: 0.85, strokeWidth: 7, strokeLinecap: 'round' }),
    path('M1166 300V760', { fill: 'none', stroke: '#6b52b0', strokeOpacity: 0.45, strokeWidth: 5, strokeLinecap: 'round' }),
    path('M146 790V220C146 160 168 124 206 108M1154 790V220C1154 160 1132 124 1094 108', { fill: 'none', stroke: '#8a6fd0', strokeOpacity: 0.4, strokeWidth: 3 }),
    screenPlate(),
    mascot(650, 738, 0.7),
    path('M520 738H590M710 738H780', { stroke: '#9b84d8', strokeWidth: 5, strokeLinecap: 'round', strokeDasharray: '1 14' }),
    path(circle(1068, 738, 3) + circle(1080, 738, 3) + circle(1092, 738, 3), { fill: '#2a1d4f', fillOpacity: 0.6 }),
    sticker(1110, 140, 12, star(0, 0, 50, 24), 'url(#starSt)',
      path(ellipse(-12, -18, 10, 6), { fill: '#fff', fillOpacity: 0.8, transform: 'rotate(-30 -12 -18)' })),
    hinge(),
    // twinkles off the shell
    g({ class: 'fc-tw' }, path(sparkle(52, 300, 24), { fill: '#fff', stroke: '#b9a9e6', strokeWidth: 2 })),
    path(sparkle(1252, 520, 18), { fill: '#ffd6f0', stroke: '#b9a9e6', strokeWidth: 2 }),
    path(sparkle(70, 1300, 16), { fill: '#d6fff2', stroke: '#b9a9e6', strokeWidth: 2 }),
    path(star(1236, 1300, 10, 4.5), { fill: '#ffd166', stroke: INK, strokeWidth: 2 }),
  ].join('\n');
  return { defs, body };
}

module.exports = {
  W, H, hole, radius, draw,
  meta: { name: 'Pearl Compact', theme: 'handheld', rarity: 'rare', translucent: false,
    desc: 'Open this pearly lilac seashell compact: your game shines in the mirror lid while a tiny doodle pet keeps you company in the scalloped shell below.',
    tags: ['handheld', 'clamshell', 'seashell', 'pastel', 'virtual-pet', 'chrome'], collection: 'pocket-pals', license: 'CC-BY-4.0' },
};
