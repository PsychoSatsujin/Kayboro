'use strict';
// Mochi Bunny: a squishy daifuku-dome virtual pet with a starch-dusted white-pink body, two long
// floppy ears (the left one drooping at the tip, the right one folded over), rosy blush and a tiny
// cat mouth under the screen, bean buttons around a matcha flower button, a matcha leaf tucked
// under one side like a leaf-wrapped mochi and a strawberry charm on a short strap.
const L = require('../lib');
const { rr, path, g, lg, rg, circle, ellipse, sparkle, heart, tf, rng, lip, n, P } = L;

const W = 1400, H = 1320, hole = { x: 340, y: 420, w: 720, h: 540 }, radius = 34;
const INK = '#5b3550';

// ---- body: a daifuku dome (round crown, falling shoulders, widest low down, squashed base) ----
const TOP = 268, BASE = 1244;
const B0 = [700, TOP];
const BSEG = [
  [[948, TOP], [1128, 318], [1206, 440]],
  [[1278, 552], [1302, 762], [1298, 962]],
  [[1294, 1186], [1238, 1240], [700, BASE]],
  [[162, 1240], [106, 1186], [102, 962]],
  [[98, 762], [122, 552], [194, 440]],
  [[272, 318], [452, TOP], B0],
];
const BODY = `M${P(...B0)}` + BSEG.map(([a, b, c]) => `C${P(...a, ...b, ...c)}`).join('') + 'Z';

/** Dense polygon of the body outline (for keeping decoration inside it). */
const BODY_PTS = (() => {
  const out = [];
  let p0 = B0;
  for (const [c1, c2, p3] of BSEG) {
    for (let k = 0; k < 40; k++) {
      const t = k / 40, u = 1 - t;
      out.push([0, 1].map((i) => u * u * u * p0[i] + 3 * u * u * t * c1[i] + 3 * u * t * t * c2[i] + t * t * t * p3[i]));
    }
    p0 = p3;
  }
  return out;
})();
function inBody(x, y, margin = 0) {
  let inside = false, best = Infinity;
  for (let i = 0, j = BODY_PTS.length - 1; i < BODY_PTS.length; j = i++) {
    const [xi, yi] = BODY_PTS[i], [xj, yj] = BODY_PTS[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    best = Math.min(best, Math.hypot(x - xi, y - yi));
  }
  return inside && best >= margin;
}
/** Point on the body outline nearest to the right edge at height y. */
function rightEdge(y) {
  let best = null;
  for (const p of BODY_PTS) if (p[0] > 700 && (!best || Math.abs(p[1] - y) < Math.abs(best[1] - y))) best = p;
  return best;
}

// ---- smooth curves + tapered ribbons (ears) ----
/** Closed / open Catmull-Rom spline through points, as cubic beziers. */
function spline(pts, closed = false) {
  const N = pts.length, at = (i) => (closed ? pts[(i + N) % N] : pts[Math.max(0, Math.min(N - 1, i))]);
  let d = `M${P(...pts[0])}`;
  for (let i = 0; i < (closed ? N : N - 1); i++) {
    const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);
    d += `C${P(p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6, p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6, ...p2)}`;
  }
  return d + (closed ? 'Z' : '');
}
function crAt(pts, t) {
  const N = pts.length, i = Math.min(N - 2, Math.floor(t)), f = t - i, at = (k) => pts[Math.max(0, Math.min(N - 1, k))];
  const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);
  return [0, 1].map((k) => 0.5 * (2 * p1[k] + (-p0[k] + p2[k]) * f + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * f * f
    + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * f * f * f));
}
/** Tapered ribbon along a centreline: returns the outline d plus its sampled sides. */
function ribbon(cl, hw, steps = 16) {
  const M = cl.length - 1, Lp = [], Rp = [], C = [], T = [], Wd = [];
  for (let k = 0; k <= steps; k++) {
    const t = (k / steps) * M, p = crAt(cl, t), a = crAt(cl, Math.max(0, t - 0.02)), b = crAt(cl, Math.min(M, t + 0.02));
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]), tx = (b[0] - a[0]) / len, ty = (b[1] - a[1]) / len;
    const i = Math.min(M - 1, Math.floor(t)), w = hw[i] + (hw[i + 1] - hw[i]) * (t - i);
    C.push(p); T.push([tx, ty]); Wd.push(w);
    Lp.push([p[0] - ty * w, p[1] + tx * w]); Rp.push([p[0] + ty * w, p[1] - tx * w]);
  }
  const cap = (c, [tx, ty], w, s) => [45, 90, 135].map((deg) => {
    const r = (deg * Math.PI) / 180, cs = Math.cos(r) * w, sn = Math.sin(r) * w * s;
    return s > 0 ? [c[0] - ty * cs + tx * sn, c[1] + tx * cs + ty * sn] : [c[0] + ty * cs + tx * sn, c[1] - tx * cs + ty * sn];
  });
  const pts = [...Lp, ...cap(C[steps], T[steps], Wd[steps], 1), ...Rp.slice().reverse(), ...cap(C[0], T[0], Wd[0], -1)];
  return { d: spline(pts, true), L: Lp, R: Rp, C };
}
const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

// left ear: rises from behind the crown, then flops over in a wide arc so the tip hangs down outside.
// Centreline = a straight lean that flows tangentially into a circular arc (no kinks).
const EAR_CL = (() => {
  const S = [452, 196], dx = -0.287, dy = -0.958, R = 110, cx = S[0] - 0.958 * R, cy = S[1] + 0.287 * R;
  const a0 = Math.atan2(S[1] - cy, S[0] - cx), out = [];
  for (let k = 0; k < 4; k++) out.push([S[0] - dx * 220 * (1 - k / 4), S[1] - dy * 220 * (1 - k / 4)]);
  for (let k = 0; k <= 10; k++) { const a = a0 - (k / 10) * (200 * Math.PI) / 180; out.push([cx + R * Math.cos(a), cy + R * Math.sin(a)]); }
  return out;
})();
const profile = (stops, N, from = 0) => Array.from({ length: N }, (_, i) => {
  const u = (i + from) / (N + from - 1);
  for (let k = 1; k < stops.length; k++) if (u <= stops[k][0]) {
    const [u0, w0] = stops[k - 1], [u1, w1] = stops[k];
    return w0 + ((w1 - w0) * (u - u0)) / (u1 - u0);
  }
  return stops[stops.length - 1][1];
});
const EAR = ribbon(EAR_CL, profile([[0, 46], [0.25, 58], [0.45, 66], [0.7, 58], [0.88, 42], [1, 22]], EAR_CL.length), 40);
const EAR_IN = ribbon(EAR_CL.slice(2), profile([[0, 30], [0.25, 38], [0.45, 42], [0.7, 36], [0.88, 22], [1, 6]], EAR_CL.length - 2, 2), 36);

// right ear: upright base (behind the body) folded over along a diagonal crease into a broad, flat
// flap that hangs down past the shoulder, showing its furry back
const RISE = 'M898 440C902 330 910 230 926 132L1030 200C1026 290 1020 370 1016 440Z';
const RISE_IN = 'M924 420C926 330 932 250 946 184C962 176 984 184 998 198C992 270 984 350 980 420Z';
const FOLD = 'M1030 198C994 180 954 162 926 134';
const FLAP = 'M1030 198C994 180 954 162 926 134C936 92 986 64 1060 68C1160 74 1242 138 1272 238'
  + 'C1298 328 1288 420 1250 452C1216 478 1176 456 1170 414C1162 336 1132 262 1082 224C1064 210 1046 204 1030 198Z';

function standingEar() {
  const hi = spline(EAR.L.slice(14, 31).map((p, i) => lerp(p, EAR.C[i + 14], 0.3)));
  return g({},
    path(EAR.d, { fill: 'url(#earFur)', stroke: INK, strokeWidth: 8, strokeLinejoin: 'round' }),
    path(EAR_IN.d, { fill: 'url(#earPink)' }),
    path(hi, { fill: 'none', stroke: '#fff', strokeOpacity: 0.95, strokeWidth: 10, strokeLinecap: 'round' }));
}

/** Sakura + matcha leaf hair clip, drawn over the body so nothing slices it. */
function hairClip() {
  return g({ transform: tf(478, 228, -18) },
    path('M-4 8C-50 -2 -70 30 -60 54C-38 46 -20 30 -4 8Z', { fill: INK, fillOpacity: 0.25, transform: 'translate(3 7)' }),
    path('M-4 8C-50 -2 -70 30 -60 54C-38 46 -20 30 -4 8Z', { fill: 'url(#leaf)', stroke: INK, strokeWidth: 5, strokeLinejoin: 'round' }),
    path('M-8 12C-26 22 -40 34 -52 46', { fill: 'none', stroke: '#e9f6c9', strokeWidth: 3, strokeLinecap: 'round' }),
    flower(0, 0, 32, 'url(#petalPink)', '#ffd96a'));
}

/** Right ear, part 1 (behind the body): the short upright base showing its pink lining. */
function earBase() {
  return path(RISE, { fill: 'url(#earFur)', stroke: INK, strokeWidth: 8, strokeLinejoin: 'round' })
    + path(RISE_IN, { fill: 'url(#earPink)' });
}

/** Right ear, part 2 (over the body): the flat flap seen from behind, creased where it folds. */
function earFlap() {
  return g({},
    g({ clipPath: 'url(#mochiClip)' }, path(FLAP, { fill: INK, fillOpacity: 0.2, transform: 'translate(10 14)' })),
    path(FLAP, { fill: 'url(#flapFur)' }),
    g({ clipPath: 'url(#flapClip)' },
      // soft edge shading on the lower-right, lit surface up-left
      path(FLAP, { fill: 'none', stroke: '#eaaec4', strokeOpacity: 0.6, strokeWidth: 34, transform: 'translate(-6 4)' }),
      path(FLAP, { fill: '#fffafc', fillOpacity: 0.85, transform: 'translate(-14 -10)' }),
      // crease shadow just past the fold
      path(FOLD, { fill: 'none', stroke: '#e48fae', strokeOpacity: 0.55, strokeWidth: 26, strokeLinecap: 'round', transform: 'translate(12 -6)' }),
      path(FOLD, { fill: 'none', stroke: '#fff', strokeWidth: 6, strokeLinecap: 'round', transform: 'translate(30 -14)' }),
      // the tip curls a touch and shows a sliver of pink lining
      path('M1282 350C1290 404 1274 446 1244 460C1260 430 1270 396 1282 350Z', { fill: 'url(#earPink)' })),
    path('M952 104C994 80 1050 76 1112 88', { fill: 'none', stroke: '#fff', strokeWidth: 9, strokeLinecap: 'round' }),
    path(FLAP, { fill: 'none', stroke: INK, strokeWidth: 8, strokeLinejoin: 'round' }),
    path('M1030 198C1050 208 1062 214 1074 222', { fill: 'none', stroke: INK, strokeWidth: 5, strokeLinecap: 'round' }));
}

/** Five rounded petals (flower button / hair clip). */
function flower(cx, cy, r, fill, centre, stroke = INK, sw = 5) {
  let d = '';
  for (let i = 0; i < 5; i++) {
    const a = ((i * 72 - 90) * Math.PI) / 180, px = cx + Math.cos(a) * r * 0.55, py = cy + Math.sin(a) * r * 0.55;
    d += circle(px, py, r * 0.5);
  }
  return path(d, { fill, stroke, strokeWidth: sw })
    + path(d, { fill })
    + path(circle(cx, cy, r * 0.28), { fill: centre, stroke, strokeWidth: sw * 0.7 });
}

function bean(cx, cy, rot) {
  const d = 'M-62 -6C-66 -40 -24 -46 0 -30C24 -46 66 -40 62 -6C58 30 20 40 0 30C-20 40 -58 30 -62 -6Z';
  return g({ transform: tf(cx, cy, rot) },
    path(d, { fill: INK, fillOpacity: 0.3, transform: 'translate(3 11)' }),
    path(d, { fill: 'url(#bean)', stroke: INK, strokeWidth: 7, strokeLinejoin: 'round' }),
    path('M-44 -20C-34 -32 -18 -32 -8 -24', { fill: 'none', stroke: '#fff', strokeOpacity: 0.9, strokeWidth: 8, strokeLinecap: 'round' }));
}

function flowerButton(cx, cy) {
  return path(circle(cx + 3, cy + 10, 56), { fill: INK, fillOpacity: 0.28 })
    + path(circle(cx, cy, 56), { fill: 'url(#socket)', stroke: INK, strokeWidth: 5 })
    + flower(cx, cy - 2, 46, 'url(#matcha)', '#fff6d6', INK, 6)
    + path(ellipse(cx - 16, cy - 26, 9, 6), { fill: '#fff', fillOpacity: 0.8, transform: `rotate(-30 ${cx - 16} ${cy - 26})` });
}

/** Matcha leaf tucked under the lower-left side, like the leaf wrapped round a sakura mochi. */
function leafWrap() {
  const d = 'M0 0C-80 -76 -236 -84 -350 0C-236 84 -80 76 0 0Z';
  const veins = [-90, -160, -230, -290].map((x, i) => {
    const k = 1 - i * 0.2;
    return `M${x} 0L${n(x - 44 * k)} ${n(-46 * k)}M${x} 0L${n(x - 44 * k)} ${n(46 * k)}`;
  }).join('');
  return g({ transform: tf(326, 1200, 33) },
    path(d, { fill: INK, fillOpacity: 0.25, transform: 'translate(-2 12)' }),
    path(d, { fill: 'url(#leafBig)', stroke: INK, strokeWidth: 7, strokeLinejoin: 'round' }),
    path(veins, { fill: 'none', stroke: '#e3f3c4', strokeOpacity: 0.75, strokeWidth: 3.5, strokeLinecap: 'round' }),
    path('M0 0L-336 0', { fill: 'none', stroke: '#eef8d8', strokeWidth: 5, strokeLinecap: 'round' }),
    path('M-120 -50C-180 -62 -240 -56 -290 -30', { fill: 'none', stroke: '#fff', strokeOpacity: 0.6, strokeWidth: 6, strokeLinecap: 'round' }));
}

function strawberryCharm() {
  const [ex, ey] = rightEdge(1112);
  const lx = ex - 6, ly = ey; // eyelet lug sits on the body edge
  const sx = 1306, sy = 1222;
  const berry = `M${sx} ${sy + 52}C${sx - 30} ${sy + 40} ${sx - 50} ${sy + 4} ${sx - 46} ${sy - 18}C${sx - 42} ${sy - 38} ${sx - 18} ${sy - 40} ${sx} ${sy - 34}`
    + `C${sx + 18} ${sy - 40} ${sx + 42} ${sy - 38} ${sx + 46} ${sy - 18}C${sx + 50} ${sy + 4} ${sx + 30} ${sy + 40} ${sx} ${sy + 52}Z`;
  const seeds = [[-24, -12], [0, -14], [24, -12], [-14, 8], [14, 8], [-28, 12], [28, 12], [0, 28], [-12, 30], [12, 30]]
    .map(([x, y]) => `M${sx + x} ${sy + y - 3}Q${sx + x + 3} ${sy + y} ${sx + x} ${sy + y + 4}Q${sx + x - 3} ${sy + y} ${sx + x} ${sy + y - 3}Z`).join('');
  const leaves = [8, 50, 90, 130, 172].map((a) =>
    `<path d="M0 0C6 -7 22 -7 32 0C22 7 6 7 0 0Z" transform="translate(${sx} ${sy - 30}) rotate(${a})"/>`).join('');
  const rx = n(lx + 16), ry = n(ly + 4);
  const strap = `M${rx} ${n(ry + 10)}C${n(rx + 14)} ${n(ry + 50)} ${n(sx - 8)} ${n(sy - 90)} ${sx} ${sy - 34}`;
  return g({},
    path(ellipse(sx + 4, 1290, 46, 8), { fill: 'url(#floor)' }),
    // eyelet lug moulded onto the body edge
    path(rr(lx - 14, ly - 16, 30, 32, 13), { fill: INK, fillOpacity: 0.25, transform: 'translate(2 5)' }),
    path(rr(lx - 14, ly - 16, 30, 32, 13), { fill: 'url(#lug)', stroke: INK, strokeWidth: 5 }),
    path(circle(lx + 2, ly, 5), { fill: INK }),
    path(strap, { fill: 'none', stroke: INK, strokeWidth: 12, strokeLinecap: 'round' }),
    path(strap, { fill: 'none', stroke: '#9cc96a', strokeWidth: 6, strokeLinecap: 'round' }),
    path(ellipse(rx - 4, ry, 16, 11), { fill: 'none', stroke: INK, strokeWidth: 10, transform: `rotate(-60 ${rx - 4} ${ry})` }),
    path(ellipse(rx - 4, ry, 16, 11), { fill: 'none', stroke: 'url(#gold)', strokeWidth: 5, transform: `rotate(-60 ${rx - 4} ${ry})` }),
    path(berry, { fill: 'url(#berry)', stroke: INK, strokeWidth: 6, strokeLinejoin: 'round' }),
    path(seeds, { fill: '#ffe9a6' }),
    path(ellipse(sx - 26, sy + 4, 9, 6), { fill: '#fff', fillOpacity: 0.75, transform: `rotate(-50 ${sx - 26} ${sy + 4})` }),
    g({ fill: 'url(#leaf)', stroke: INK, strokeWidth: 3.5, strokeLinejoin: 'round' }, leaves),
    path(circle(sx, sy - 32, 7), { fill: '#7fb04a', stroke: INK, strokeWidth: 3 }));
}

function draw() {
  const holeD = rr(hole.x, hole.y, hole.w, hole.h, radius);
  const ox = hole.x - 50, oy = hole.y - 50, ow = hole.w + 100, oh = hole.h + 100;
  const defs = [
    rg('mochi', [0.34, 0.22, 0.9], [[0, '#fffcfd'], [0.5, '#fef3f7'], [0.8, '#fae0ea'], [1, '#f1bfd2']]),
    lg('core', [0, 0, 1, 0], [[0, '#e59ab7', 0], [0.55, '#e59ab7', 0], [1, '#e59ab7', 0.32]]),
    lg('squish', [0, 0, 0, 1], [[0, '#fff', 0], [0.74, '#f3b6c9', 0], [1, '#e48aa9', 0.42]]),
    lg('earFur', [0, 0, 1, 1], [[0, '#fffafc'], [0.55, '#fdeef3'], [1, '#f1bfd1']]),
    lg('flapFur', [1060, 120, 1260, 440], [[0, '#fffafc'], [0.5, '#fcedf3'], [1, '#f3c6d6']], true),
    lg('earPink', [0, 0, 0, 1], [[0, '#ffa8c4'], [1, '#ffd2e0']]),
    lg('bezel', [0, 0, 1, 1], [[0, '#fff7fa'], [0.5, '#ffd3e2'], [1, '#f19bba']]),
    lg('bezelIn', [0, 0, 0, 1], [[0, '#3c2235'], [1, '#2b1828']]),
    rg('blush', [0.5, 0.5, 0.5], [[0, '#ff8fb2', 0.85], [0.6, '#ff9cbd', 0.45], [1, '#ffb3cc', 0]]),
    rg('bean', [0.4, 0.3, 0.8], [[0, '#ffe2ec'], [0.6, '#ffa6c4'], [1, '#f27aa3']]),
    rg('matcha', [0.4, 0.3, 0.8], [[0, '#e6f5c4'], [0.55, '#a9d27a'], [1, '#6f9f45']]),
    lg('leaf', [0, 0, 1, 1], [[0, '#b9e08a'], [1, '#5f8f3c']]),
    lg('leafBig', [0, 0, 0, 1], [[0, '#b3da82'], [0.55, '#86b856'], [1, '#5c8a3a']]),
    rg('petalPink', [0.4, 0.3, 0.8], [[0, '#fff0f5'], [1, '#ff8fb4']]),
    rg('socket', [0.5, 0.4, 0.6], [[0, '#f9d9e4'], [1, '#eab1c6']]),
    lg('lug', [0, 0, 1, 1], [[0, '#fff4f8'], [1, '#efbdd0']]),
    rg('berry', [0.35, 0.3, 0.8], [[0, '#ff9a9a'], [0.55, '#f2445f'], [1, '#c41f45']]),
    lg('gold', [0, 0, 1, 1], [[0, '#fff2b8'], [1, '#d39b2a']]),
    rg('floor', [0.5, 0.5, 0.5], [[0, '#3a1f33', 0.42], [1, '#3a1f33', 0]]),
    rg('contact', [0.5, 0.5, 0.5], [[0, '#3a1f33', 0.5], [0.7, '#3a1f33', 0.25], [1, '#3a1f33', 0]]),
    rg('gloss', [0.5, 0.5, 0.5], [[0, '#fff', 0.95], [1, '#fff', 0]]),
    rg('ledGlow', [0.5, 0.5, 0.5], [[0, '#c9f08f', 0.9], [1, '#c9f08f', 0]]),
    rg('powder', [0.5, 0.5, 0.5], [[0, '#fff', 0.8], [0.6, '#fff', 0.45], [1, '#fff', 0]]),
    `<clipPath id="mochiClip"><path d="${BODY}"/></clipPath>`,
    `<clipPath id="flapClip"><path d="${FLAP}"/></clipPath>`,
    '<style>.mb-tw{animation:mb-tw 3.2s steps(1) infinite}.mb-tw2{animation:mb-tw 3.2s steps(1) 1.6s infinite}'
      + '@keyframes mb-tw{0%,100%{opacity:1}50%{opacity:.35}}'
      + '@media (prefers-reduced-motion:reduce){*{animation:none!important}}</style>',
  ].join('');

  // starch dusting: clustered on the crown and shoulders where the powder gathers
  const rnd = rng(41), dust = [], dustSh = [], dustPink = [], drifts = [];
  const clear = (x, y, m) => inBody(x, y, 40) && !(x > ox - m && x < ox + ow + m && y > oy - m && y < 1210);
  for (let i = 0, tries = 0; dust.length < 48 && tries < 4000; tries++) {
    const x = 120 + rnd() * 1160, y = TOP + 10 + Math.pow(rnd(), 2.4) * 560, r = 2.6 + rnd() * 4.4;
    if (!clear(x, y, 34) || (x > 830 && x < 1270 && y < 560)) continue; // keep off the folded ear's shadow
    i++;
    if (i % 4 === 0) { dustPink.push(circle(x, y, r * 0.55)); continue; }
    dust.push(circle(x, y, r)); dustSh.push(circle(x + 1, y + 1.8, r));
  }
  for (let i = 0; i < 14; i++) {
    const t = i / 13, x = 250 + t * 560 + (rnd() - 0.5) * 50, y = TOP + 34 + Math.pow(Math.abs(t - 0.6) * 1.6, 2) * 80 + rnd() * 30;
    drifts.push(path(ellipse(x, y, 30 + rnd() * 30, 10 + rnd() * 7), { fill: 'url(#powder)', transform: `rotate(${n((t - 0.6) * 26)} ${n(x)} ${n(y)})` }));
  }

  const FY = 1064; // face line, midway between the bezel and the buttons
  const face = g({ transform: `translate(700 ${FY}) scale(1.3) translate(-700 -956)` },
    path(ellipse(566, 958, 62, 30), { fill: 'url(#blush)' }),
    path(ellipse(834, 958, 62, 30), { fill: 'url(#blush)' }),
    path('M538 950L550 966M562 948L574 964M586 950L598 966', { stroke: '#f06f9d', strokeOpacity: 0.75, strokeWidth: 5, strokeLinecap: 'round' }),
    path('M802 950L814 966M826 948L838 964M850 950L862 966', { stroke: '#f06f9d', strokeOpacity: 0.75, strokeWidth: 5, strokeLinecap: 'round' }),
    path('M654 950Q667 974 690 962Q700 956 700 946Q700 956 710 962Q733 974 746 950', { fill: 'none', stroke: INK, strokeWidth: 7, strokeLinecap: 'round', strokeLinejoin: 'round' }),
    path(ellipse(700, 942, 10, 6.5), { fill: '#f06f9d', stroke: INK, strokeWidth: 3 }));

  const body = [
    path(ellipse(700, BASE + 15, 610, 34), { fill: 'url(#floor)' }),
    standingEar(), earBase(), leafWrap(),
    // mochi body
    path(BODY, { fill: 'url(#mochi)' }),
    g({ clipPath: 'url(#mochiClip)' },
      path(BODY, { fill: 'url(#core)' }),
      path(BODY, { fill: 'url(#squish)' }),
      drifts.join(''),
      path(dustSh.join(''), { fill: '#e7a3bd', fillOpacity: 0.45 }),
      path(dust.join(''), { fill: '#ffffff' }),
      path(dustPink.join(''), { fill: '#e290ae', fillOpacity: 0.5 }),
      path(ellipse(318, 412, 150, 62), { fill: 'url(#gloss)', transform: 'rotate(-28 318 412)' })),
    path(ellipse(700, BASE + 3, 470, 13), { fill: 'url(#contact)' }),
    path(BODY, { fill: 'none', stroke: INK, strokeWidth: 9 }),
    // rim light along the lit top-left edge
    path('M146 780C144 640 168 530 224 462C288 384 400 314 540 298', { fill: 'none', stroke: '#fff', strokeWidth: 12, strokeLinecap: 'round' }),
    path('M140 900C138 870 138 840 139 818', { fill: 'none', stroke: '#fff', strokeWidth: 8, strokeLinecap: 'round', strokeOpacity: 0.85 }),
    hairClip(),
    earFlap(),
    // screen bezel: soft pink cushion around a dark recessed lip
    path(rr(ox, oy + 10, ow, oh, radius + 46), { fill: '#b9577f', fillOpacity: 0.28 }),
    path(rr(ox, oy, ow, oh, radius + 46), { fill: 'url(#bezel)', stroke: INK, strokeWidth: 7 }),
    path(rr(ox + 14, oy + 12, ow - 28, oh - 26, radius + 34), { fill: 'none', stroke: '#fff', strokeOpacity: 0.7, strokeWidth: 4 }),
    path(rr(hole.x - 18, hole.y - 18, hole.w + 36, hole.h + 36, radius + 14), { fill: 'url(#bezelIn)', stroke: '#8a4a6c', strokeWidth: 3 }),
    lip(holeD, '#000', [[7, 0.3], [3, 0.6]]),
    path(`M${hole.x - 30} ${hole.y + 90}V${hole.y + 20}Q${hole.x - 30} ${hole.y - 30} ${hole.x + 20} ${hole.y - 30}H${hole.x + 130}`, { fill: 'none', stroke: '#fff', strokeOpacity: 0.95, strokeWidth: 7, strokeLinecap: 'round' }),
    // face + controls
    face,
    bean(522, 1158, -12), bean(878, 1158, 12),
    flowerButton(700, 1164),
    // power LED + speaker slots in the lower corners
    path(circle(300, 1100, 34), { fill: 'url(#ledGlow)' }), path(circle(300, 1100, 13), { fill: '#d9f7a8', stroke: INK, strokeWidth: 4 }),
    path(ellipse(296, 1096, 4, 3), { fill: '#fff' }),
    path(heart(354, 1100, 16), { fill: '#f6a9c1', stroke: INK, strokeWidth: 3 }),
    path('M1040 1080L1064 1120M1066 1076L1090 1116M1092 1072L1116 1112', { stroke: '#d98aa8', strokeWidth: 9, strokeLinecap: 'round' }),
    strawberryCharm(),
    // decor
    g({ class: 'mb-tw' },
      path(sparkle(110, 330, 26), { fill: '#fff', stroke: '#ff9cbf', strokeWidth: 3 }),
      path(sparkle(1340, 640, 20), { fill: '#e6f5c4', stroke: '#6f9f45', strokeWidth: 3 })),
    g({ class: 'mb-tw2' },
      path(sparkle(1320, 90, 18), { fill: '#fff', stroke: '#ff9cbf', strokeWidth: 3 }),
      path(sparkle(52, 880, 18), { fill: '#fff', stroke: '#ff9cbf', strokeWidth: 3 })),
    path(heart(58, 560, 16), { fill: '#ff9cbf', stroke: INK, strokeWidth: 3 }),
  ].join('\n');
  return { defs, body };
}

module.exports = {
  W, H, hole, radius, draw,
  meta: { name: 'Mochi Bunny', theme: 'mochi', rarity: 'common', translucent: false, collection: 'pocket-pals', license: 'CC-BY-4.0',
    desc: 'A squishy mochi bunny pet with floppy ears, rosy cheeks and a strawberry charm, dusted in sweet starch.',
    tags: ['virtual-pet', 'bunny', 'mochi', 'pastel', 'cute'] },
};
