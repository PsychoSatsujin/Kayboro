'use strict';
// Dwarven Gate: a mountain door hewn into a faceted cliff. Square granite masonry, two massive pillars
// with stepped capitals and bronze bands, a heavy lintel and stepped pediment, and an anvil-and-hammer
// crest in a hexagonal bronze medallion on top. Invented rune marks (abstract geometric strokes, not a
// real script) glow forge-orange in the stone; iron lanterns hang from brackets and stone steps lead up.
// The screen sits in a thick, calm bronze door frame with riveted corner plates.
const L = require('../lib');
const { rr, path, g, lg, rg, circle, ellipse, sparkle, poly, chamfer, tf, rng, lip, glowStroke, n, P } = L;

const W = 1700, H = 1320, hole = { x: 370, y: 450, w: 960, h: 540 }, radius = 6;
const CX = W / 2;
const INK = '#17110c';
const FR = { x: hole.x - 46, y: hole.y - 46, w: hole.w + 92, h: hole.h + 92 }; // bronze door frame
const WALL = { x: 150, y: 300, w: W - 300, h: 830 };
const PIL = { x: 150, w: 156, y: 318, b: 1104 }; // left pillar face (mirrored)
const mirror = (...kids) => g({}, ...kids) + g({ transform: `translate(${W} 0) scale(-1 1)` }, ...kids);

// ---- runes -------------------------------------------------------------------------------------
/**
 * One invented sigil in a cell of size s centred on (x, y). Deliberately not any real alphabet: every mark
 * is a closed geometric body (diamond, triangle, box, hourglass, double chevron) plus one or two modifiers
 * (a spine, a cross bar, a core dot, end ticks, side notches).
 */
function runeD(x, y, s, rnd) {
  const u = s / 2, v = s * 0.7, X = (a) => n(x + a * u), Y = (b) => n(y + b * v);
  const pl = (pts, close = true) => `M${pts.map(([a, b]) => `${X(a)} ${Y(b)}`).join('L')}${close ? 'Z' : ''}`;
  const bodies = [
    () => pl([[0, -1], [0.8, 0], [0, 1], [-0.8, 0]]),
    () => pl([[0, -1], [0.85, 0.75], [-0.85, 0.75]]),
    () => pl([[-0.85, -0.75], [0.85, -0.75], [0, 1]]),
    () => pl([[-0.65, -0.65], [0.65, -0.65], [0.65, 0.65], [-0.65, 0.65]]),
    () => pl([[-0.75, -1], [0.75, -1], [-0.75, 1], [0.75, 1]]),
    () => pl([[-0.8, -0.15], [0, -1], [0.8, -0.15]], false) + pl([[-0.8, 0.85], [0, 0], [0.8, 0.85]], false),
    () => pl([[0, -1], [0.8, -0.3], [0.8, 0.5], [0, 1], [-0.8, 0.5], [-0.8, -0.3]]),
  ];
  const mods = [
    () => pl([[0, -1.25], [0, 1.25]], false),
    () => pl([[-1, 0.05], [1, 0.05]], false),
    () => pl([[0, -0.2], [0.18, 0], [0, 0.2], [-0.18, 0]]),
    () => pl([[-0.45, -1.25], [0.45, -1.25]], false) + pl([[-0.45, 1.25], [0.45, 1.25]], false),
    () => pl([[0.85, -0.45], [1.2, -0.75]], false) + pl([[-0.85, 0.45], [-1.2, 0.75]], false),
  ];
  const b = Math.floor(rnd() * bodies.length), m1 = Math.floor(rnd() * mods.length);
  let d = bodies[b]() + mods[m1]();
  if (rnd() < 0.4) { const m2 = (m1 + 1 + Math.floor(rnd() * (mods.length - 1))) % mods.length; d += mods[m2](); }
  return d;
}
/** A row (dir 'h') or column ('v') of runes, carved and glowing. */
function runes(x, y, count, s, gap, dir, seed, cls = 'dg-glow') {
  const rnd = rng(seed);
  let d = '';
  for (let i = 0; i < count; i++) d += runeD(dir === 'h' ? x + i * gap : x, dir === 'h' ? y : y + i * gap, s, rnd);
  return path(d, { fill: 'none', stroke: '#0c0806', strokeOpacity: 0.7, strokeWidth: 6, strokeLinecap: 'round', strokeLinejoin: 'round', transform: 'translate(1.5 2)' })
    + g({ class: cls }, glowStroke(d, '#ff7a1a', 3.2, [[5, 0.1], [2.8, 0.2], [1.6, 0.55], [1, 1]], { strokeLinejoin: 'round' }),
      path(d, { fill: 'none', stroke: '#ffe2a6', strokeWidth: 1.4, strokeLinecap: 'round', strokeLinejoin: 'round' }));
}

// ---- small parts -------------------------------------------------------------------------------
function rivet(x, y, r = 6) {
  return path(circle(x + 1.5, y + 2, r), { fill: INK, fillOpacity: 0.5 })
    + path(circle(x, y, r), { fill: 'url(#rivet)', stroke: INK, strokeWidth: 2 })
    + path(circle(x - r * 0.3, y - r * 0.3, r * 0.3), { fill: '#fff4d0', fillOpacity: 0.9 });
}
/** Horizontal bronze band with rivets. */
function band(x, y, w, h, rivets = 0) {
  let out = path(rr(x, y, w, h, 3), { fill: 'url(#bronzeH)', stroke: INK, strokeWidth: 3 })
    + path(`M${x + 4} ${y + 3}H${x + w - 4}`, { stroke: '#ffe7a8', strokeOpacity: 0.8, strokeWidth: 2 })
    + path(`M${x + 4} ${y + h - 3}H${x + w - 4}`, { stroke: '#4a2a0e', strokeOpacity: 0.7, strokeWidth: 2 });
  for (let i = 0; i < rivets; i++) out += rivet(x + (w * (i + 0.5)) / rivets, y + h / 2, Math.min(6, h * 0.28));
  return out;
}

/** Faceted cliff behind the gate: an outer jagged outline with a shaded rim of facets. */
function cliff() {
  const half = [[0, 1300], [10, 1040], [44, 900], [16, 760], [52, 610], [26, 470], [64, 330], [36, 214], [104, 128], [160, 70], [214, 112], [276, 26], [344, 92], [400, 58], [462, 118], [530, 96], [596, 160], [684, 150], [770, 214], [850, 220]];
  const all = [...half, ...half.slice(0, -1).reverse().map(([x, y]) => [W - x, y])];
  const rnd = rng(17), cx0 = CX, cy0 = 760;
  const inner = all.map(([x, y]) => { const dx = cx0 - x, dy = cy0 - y, l = Math.hypot(dx, dy), k = 70 + rnd() * 60; return [x + (dx / l) * k, y + (dy / l) * k]; });
  const light = [-0.6, -0.8];
  let lit = '', mid = '', dark = '';
  for (let i = 0; i < all.length - 1; i++) {
    const a = all[i], b = all[i + 1], c = inner[i + 1], d = inner[i];
    const ex = b[0] - a[0], ey = b[1] - a[1], l = Math.hypot(ex, ey), nx = ey / l, ny = -ex / l; // outward normal (clockwise outline)
    const dot = nx * light[0] + ny * light[1];
    const q = poly([a, b, c, d]);
    if (dot > 0.35) lit += q; else if (dot > -0.35) mid += q; else dark += q;
    // split each facet once more along its diagonal for a chiselled look
  }
  const outline = poly(all);
  const cracks = [];
  for (let i = 0; i < 26; i++) {
    const side = i % 2 ? 1 : -1, x = side < 0 ? 20 + rnd() * 120 : W - 20 - rnd() * 120, y = 300 + rnd() * 900;
    cracks.push(`M${n(x)} ${n(y)}l${n(10 + rnd() * 20)} ${n(14 + rnd() * 20)}l${n(-6 - rnd() * 10)} ${n(10 + rnd() * 16)}`);
  }
  return g({},
    path(outline, { fill: '#000', fillOpacity: 0.3, transform: 'translate(10 14)' }),
    path(outline, { fill: 'url(#rock)' }),
    path(dark, { fill: '#1a1d24' }), path(mid, { fill: '#3a404c' }), path(lit, { fill: '#5d6575' }),
    path(lit + mid + dark, { fill: 'none', stroke: '#11131a', strokeWidth: 2, strokeLinejoin: 'round' }),
    path(cracks.join(''), { fill: 'none', stroke: '#0d0f14', strokeOpacity: 0.7, strokeWidth: 2.5, strokeLinecap: 'round', strokeLinejoin: 'round' }),
    path(outline, { fill: 'none', stroke: INK, strokeWidth: 4, strokeLinejoin: 'round' }));
}

/** Ashlar wall: staggered granite blocks in three tones with bevel highlights. */
function masonry() {
  const rnd = rng(9), tones = [[], [], []], hi = [], lo = [];
  const x0 = WALL.x, x1 = WALL.x + WALL.w;
  let y = WALL.y, row = 0;
  while (y < WALL.y + WALL.h) {
    const h = Math.min(WALL.y + WALL.h - y, 66 + Math.floor(rnd() * 3) * 6);
    let x = x0 - (row % 2 ? 60 : 0);
    while (x < x1) {
      const w = 130 + Math.floor(rnd() * 5) * 22, bx = Math.max(x, x0), bw = Math.min(x + w, x1) - bx;
      if (bw > 8) {
        tones[Math.floor(rnd() * 3)].push(chamfer(bx + 2, y + 2, bw - 4, h - 4, 5));
        hi.push(`M${n(bx + 6)} ${n(y + h - 8)}V${n(y + 6)}H${n(bx + bw - 8)}`);
        lo.push(`M${n(bx + bw - 4)} ${n(y + 8)}V${n(y + h - 4)}H${n(bx + 8)}`);
      }
      x += w;
    }
    y += h; row++;
  }
  return g({},
    path(rr(WALL.x, WALL.y, WALL.w, WALL.h, 0), { fill: '#241c16' }),
    path(tones[0].join(''), { fill: 'url(#granA)' }), path(tones[1].join(''), { fill: 'url(#granB)' }), path(tones[2].join(''), { fill: 'url(#granC)' }),
    path(hi.join(''), { fill: 'none', stroke: '#cfc4b4', strokeOpacity: 0.45, strokeWidth: 2 }),
    path(lo.join(''), { fill: 'none', stroke: '#1b140f', strokeOpacity: 0.5, strokeWidth: 3 }));
}

/** A massive square pillar: stepped capital and base, bronze bands, a glowing rune column. */
function pillar() {
  const { x, w, y, b } = PIL, cx = x + w / 2;
  const capital = g({},
    path(rr(x - 22, y - 50, w + 44, 28, 3), { fill: 'url(#stoneH)', stroke: INK, strokeWidth: 4 }),
    path(rr(x - 12, y - 24, w + 24, 26, 3), { fill: 'url(#stoneH)', stroke: INK, strokeWidth: 4 }),
    band(x - 4, y, w + 8, 22, 4),
    path(`M${x - 16} ${y - 44}H${x + w + 16}`, { stroke: '#e6dccb', strokeOpacity: 0.7, strokeWidth: 3 }));
  const base = g({},
    band(x - 4, b - 92, w + 8, 22, 4),
    path(rr(x - 12, b - 70, w + 24, 34, 3), { fill: 'url(#stoneH)', stroke: INK, strokeWidth: 4 }),
    path(rr(x - 24, b - 38, w + 48, 40, 3), { fill: 'url(#stoneH)', stroke: INK, strokeWidth: 4 }),
    path(`M${x - 18} ${b - 32}H${x + w + 18}`, { stroke: '#e6dccb', strokeOpacity: 0.7, strokeWidth: 3 }));
  // recessed rune panel with angular ends
  const py0 = y + 70, py1 = b - 130;
  const panel = `M${P(cx, py0 - 26)}L${P(cx + 34, py0)}V${n(py1)}L${P(cx, py1 + 26)}L${P(cx - 34, py1)}V${n(py0)}Z`;
  return g({},
    path(rr(x + 12, y, w, b - y, 0), { fill: '#000', fillOpacity: 0.32 }),
    path(rr(x, y, w, b - y, 0), { fill: 'url(#pillar)', stroke: INK, strokeWidth: 4 }),
    path(`M${x + 10} ${y + 30}V${b - 100}`, { stroke: '#e9dfcf', strokeOpacity: 0.5, strokeWidth: 3 }),
    path(`M${x + w - 10} ${y + 30}V${b - 100}`, { stroke: '#1b140f', strokeOpacity: 0.45, strokeWidth: 4 }),
    // chiselled side chamfers
    path(`M${x + 22} ${y + 30}V${b - 100}M${x + w - 22} ${y + 30}V${b - 100}`, { stroke: '#3a2f26', strokeOpacity: 0.5, strokeWidth: 2 }),
    path(panel, { fill: 'url(#recess)', stroke: INK, strokeWidth: 3 }),
    path(panel, { fill: 'none', stroke: '#c98a3e', strokeWidth: 2, transform: `translate(0 0) scale(1)` }),
    runes(cx, py0 + 30, 8, 30, (py1 - py0 - 60) / 7, 'v', 101),
    // bronze diamond studs at the panel tips
    ...[py0 - 26, py1 + 26].map((yy) => path(`M${P(cx, yy - 14)}L${P(cx + 12, yy)}L${P(cx, yy + 14)}L${P(cx - 12, yy)}Z`, { fill: 'url(#gold)', stroke: INK, strokeWidth: 2.5 })),
    capital, base);
}

/** Iron lantern hanging from a wrought bracket on the pillar's outer face. */
function lantern() {
  const ax = PIL.x, ay = 440, lx = 84, ly = 530;
  const arm = `M${ax} ${ay}H${lx + 4}`;
  const brace = `M${ax} ${ay + 54}L${ax - 46} ${ay}`;
  const cage = `M${lx - 26} ${ly}H${lx + 26}L${lx + 32} ${ly + 70}H${lx - 32}Z`;
  return g({},
    g({ class: 'dg-flick' }, path(circle(lx, ly + 36, 82), { fill: 'url(#lampHalo)' })),
    path(arm + brace, { fill: 'none', stroke: INK, strokeWidth: 11, strokeLinecap: 'round' }),
    path(arm + brace, { fill: 'none', stroke: 'url(#iron)', strokeWidth: 6, strokeLinecap: 'round' }),
    path(`M${lx + 4} ${ay - 12}L${lx - 8} ${ay}L${lx + 4} ${ay + 12}L${lx + 16} ${ay}Z`, { fill: 'url(#gold)', stroke: INK, strokeWidth: 2.5, strokeLinejoin: 'round' }),
    // chain
    path(`M${lx} ${ay + 4}V${ly - 30}`, { stroke: INK, strokeWidth: 5, strokeDasharray: '10 4' }),
    path(`M${lx} ${ay + 4}V${ly - 30}`, { stroke: '#8a909c', strokeWidth: 2.5, strokeDasharray: '10 4' }),
    // cap
    path(`M${lx - 34} ${ly}L${lx - 14} ${ly - 30}H${lx + 14}L${lx + 34} ${ly}Z`, { fill: 'url(#iron)', stroke: INK, strokeWidth: 3.5, strokeLinejoin: 'round' }),
    path(rr(lx - 8, ly - 40, 16, 12, 3), { fill: 'url(#iron)', stroke: INK, strokeWidth: 3 }),
    // glowing glass + bars
    path(cage, { fill: 'url(#lampGlass)', stroke: INK, strokeWidth: 3.5, strokeLinejoin: 'round' }),
    g({ class: 'dg-flick' }, path(`M${lx} ${ly + 52}C${lx - 12} ${ly + 40} ${lx - 6} ${ly + 26} ${lx} ${ly + 14}C${lx + 6} ${ly + 26} ${lx + 12} ${ly + 40} ${lx} ${ly + 52}Z`, { fill: '#fff3c4' })),
    path(`M${lx - 9} ${ly}L${lx - 11} ${ly + 70}M${lx + 9} ${ly}L${lx + 11} ${ly + 70}M${lx - 29} ${ly + 35}H${lx + 29}`, { stroke: INK, strokeWidth: 3.5 }),
    path(`M${lx - 38} ${ly + 70}H${lx + 38}L${lx + 26} ${ly + 86}H${lx - 26}Z`, { fill: 'url(#iron)', stroke: INK, strokeWidth: 3.5, strokeLinejoin: 'round' }),
    path(`M${lx - 8} ${ly + 86}L${lx} ${ly + 104}L${lx + 8} ${ly + 86}Z`, { fill: 'url(#gold)', stroke: INK, strokeWidth: 2.5, strokeLinejoin: 'round' }),
    path(`M${lx - 22} ${ly + 6}L${lx - 26} ${ly + 30}`, { stroke: '#fff', strokeOpacity: 0.6, strokeWidth: 3, strokeLinecap: 'round' }));
}

/** Heavy lintel across the pillars: bronze bands top and bottom, a glowing rune row and angular studs. */
function lintel() {
  const x0 = 112, x1 = W - 112, y0 = 214, y1 = 268;
  return g({},
    path(rr(x0 + 8, y0 + 12, x1 - x0, y1 - y0 + 20, 0), { fill: '#000', fillOpacity: 0.32 }),
    path(chamfer(x0, y0, x1 - x0, y1 - y0 + 20, 10), { fill: 'url(#stoneH)', stroke: INK, strokeWidth: 4 }),
    band(x0 + 10, y0 - 4, x1 - x0 - 20, 18, 0),
    band(x0 + 10, y1 + 6, x1 - x0 - 20, 18, 14),
    path(chamfer(CX - 380, y0 + 18, 760, 46, 10), { fill: 'url(#recess)', stroke: INK, strokeWidth: 3 }),
    runes(CX - 350, y0 + 41, 15, 21, 50, 'h', 202),
    // angular end blocks
    ...[x0 + 30, x1 - 30].map((x) => path(`M${P(x, y0 + 16)}L${P(x + 22, y0 + 41)}L${P(x, y0 + 66)}L${P(x - 22, y0 + 41)}Z`, { fill: 'url(#gold)', stroke: INK, strokeWidth: 3 })
      + path(`M${P(x, y0 + 26)}L${P(x + 12, y0 + 41)}L${P(x, y0 + 56)}L${P(x - 12, y0 + 41)}Z`, { fill: '#7a3a0c', stroke: INK, strokeWidth: 1.5 })),
    ...[x0 + 150, x1 - 150].map((x) => path(`M${x - 84} ${y0 + 50}${[0, 1, 2, 3, 4, 5, 6].map((i) => `V${y0 + (i % 2 ? 50 : 30)}H${x - 84 + (i + 1) * 24}`).join('')}V${y0 + 50}`, { fill: 'none', stroke: INK, strokeWidth: 8, strokeLinejoin: 'miter' })
      + path(`M${x - 84} ${y0 + 50}${[0, 1, 2, 3, 4, 5, 6].map((i) => `V${y0 + (i % 2 ? 50 : 30)}H${x - 84 + (i + 1) * 24}`).join('')}V${y0 + 50}`, { fill: 'none', stroke: 'url(#gold)', strokeWidth: 4, strokeLinejoin: 'miter' })));
}

/** Stepped pediment with angular wings and the anvil-and-hammer crest. */
function pediment() {
  const s1 = { x: 330, y: 150, w: W - 660, h: 66 }, s2 = { x: 560, y: 96, w: W - 1120, h: 56 };
  // stepped "wing" chevrons that rise toward the crest
  const wing = (s) => {
    const pts = [[CX - 120 * s, 150], [CX - 340 * s, 150], [CX - 286 * s, 104], [CX - 226 * s, 104], [CX - 180 * s, 58], [CX - 120 * s, 58]];
    return path(poly(pts), { fill: '#000', fillOpacity: 0.3, transform: 'translate(5 7)' })
      + path(poly(pts), { fill: 'url(#bronzeH)', stroke: INK, strokeWidth: 4, strokeLinejoin: 'round' })
      + path(`M${P(CX - 328 * s, 146)}L${P(CX - 284 * s, 108)}H${n(CX - 228 * s)}L${P(CX - 182 * s, 62)}H${n(CX - 124 * s)}`, { fill: 'none', stroke: '#ffe7a8', strokeOpacity: 0.75, strokeWidth: 2.5 })
      + rivet(CX - 300 * s, 128, 5) + rivet(CX - 250 * s, 128, 5) + rivet(CX - 200 * s, 82, 5);
  };
  return g({},
    path(rr(s1.x + 10, s1.y + 12, s1.w, s1.h, 0), { fill: '#000', fillOpacity: 0.3 }),
    path(chamfer(s1.x, s1.y, s1.w, s1.h, [16, 16, 0, 0]), { fill: 'url(#stoneH)', stroke: INK, strokeWidth: 4 }),
    path(`M${s1.x + 18} ${s1.y + 6}H${s1.x + s1.w - 18}`, { stroke: '#e6dccb', strokeOpacity: 0.7, strokeWidth: 3 }),
    ...[s1.x + 34, s1.x + s1.w - 230].map((x) => path(chamfer(x, s1.y + 14, 196, 42, 8), { fill: 'url(#recess)', stroke: INK, strokeWidth: 3 })),
    runes(s1.x + 60, s1.y + 34, 4, 22, 48, 'h', 303, 'dg-glow2'), runes(s1.x + s1.w - 204, s1.y + 34, 4, 22, 48, 'h', 304, 'dg-glow2'),
    path(chamfer(s2.x, s2.y, s2.w, s2.h, [14, 14, 0, 0]), { fill: 'url(#stoneH)', stroke: INK, strokeWidth: 4 }),
    path(`M${s2.x + 16} ${s2.y + 6}H${s2.x + s2.w - 16}`, { stroke: '#e6dccb', strokeOpacity: 0.7, strokeWidth: 3 }),
    wing(1), wing(-1),
    crest(CX, 124));
}

function crest(cx, cy) {
  const hex = (r) => poly(Array.from({ length: 6 }, (_, i) => { const a = ((-90 + i * 60) * Math.PI) / 180; return [cx + r * Math.cos(a), cy + r * Math.sin(a)]; }));
  // a fan of angular bronze rays behind the medallion (upper half only)
  let rays = '';
  for (let i = 0; i <= 10; i++) {
    const a = Math.PI * (1.14 + (0.72 * i) / 10), w = 0.07, R = i % 2 ? 150 : 178;
    rays += poly([[cx + 96 * Math.cos(a - w * 1.6), cy + 96 * Math.sin(a - w * 1.6)], [cx + R * Math.cos(a), cy + R * Math.sin(a)], [cx + 96 * Math.cos(a + w * 1.6), cy + 96 * Math.sin(a + w * 1.6)]]);
  }
  // anvil silhouette (horn to the left), centred under the medallion's middle
  const ay = cy + 22, anvil = `M${P(cx - 70, ay - 22)}C${P(cx - 54, ay - 22, cx - 44, ay - 30, cx - 40, ay - 34)}H${n(cx + 52)}V${n(ay - 12)}`
    + `H${n(cx + 30)}L${P(cx + 18, ay + 8)}V${n(ay + 22)}L${P(cx + 40, ay + 40)}H${n(cx - 40)}L${P(cx - 18, ay + 22)}V${n(ay + 8)}L${P(cx - 30, ay - 12)}`
    + `C${P(cx - 46, ay - 12, cx - 60, ay - 16, cx - 70, ay - 22)}Z`;
  const ham = g({ transform: `${tf(cx + 6, cy - 32)} rotate(-38)` },
    path(rr(-7, -6, 14, 92, 6), { fill: 'url(#haft)', stroke: INK, strokeWidth: 3 }),
    path(rr(-36, -26, 72, 30, 4), { fill: 'url(#steel)', stroke: INK, strokeWidth: 3.5 }),
    path(rr(-40, -30, 12, 38, 3), { fill: 'url(#steel)', stroke: INK, strokeWidth: 3 }),
    path(rr(28, -30, 12, 38, 3), { fill: 'url(#steel)', stroke: INK, strokeWidth: 3 }),
    path('M-30 -20H30', { stroke: '#fff', strokeOpacity: 0.7, strokeWidth: 3, strokeLinecap: 'round' }),
    path(rr(-9, 72, 18, 14, 3), { fill: 'url(#gold)', stroke: INK, strokeWidth: 2.5 }));
  const sparks = [[cx - 20, ay - 50, 9], [cx + 30, ay - 58, 7], [cx - 46, ay - 62, 6], [cx + 58, ay - 44, 6]];
  return g({},
    g({ class: 'dg-glow' }, path(circle(cx, cy, 190), { fill: 'url(#crestHalo)' })),
    path(rays, { fill: 'url(#gold)', stroke: INK, strokeWidth: 3, strokeLinejoin: 'round' }),
    path(hex(118), { fill: '#000', fillOpacity: 0.35, transform: 'translate(6 9)' }),
    path(hex(118), { fill: 'url(#bronzeD)', stroke: INK, strokeWidth: 5, strokeLinejoin: 'round' }),
    path(hex(105), { fill: 'none', stroke: '#ffe7a8', strokeOpacity: 0.7, strokeWidth: 2.5, strokeLinejoin: 'round' }),
    path(hex(92), { fill: 'url(#field)', stroke: INK, strokeWidth: 3.5, strokeLinejoin: 'round' }),
    path(hex(84), { fill: 'none', stroke: '#c98a3e', strokeOpacity: 0.8, strokeWidth: 2, strokeLinejoin: 'round' }),
    ...Array.from({ length: 6 }, (_, i) => { const a = ((-90 + i * 60) * Math.PI) / 180; return rivet(cx + 111 * Math.cos(a), cy + 111 * Math.sin(a), 7); }),
    g({ class: 'dg-glow' }, path(ellipse(cx, ay - 34, 64, 18), { fill: 'url(#forge)' })),
    path(anvil, { fill: 'url(#steel)', stroke: INK, strokeWidth: 3.5, strokeLinejoin: 'round' }),
    path(`M${P(cx - 38, ay - 31)}H${n(cx + 48)}`, { stroke: '#fff', strokeOpacity: 0.8, strokeWidth: 2.5, strokeLinecap: 'round' }),
    ham,
    g({ class: 'dg-glow2' }, sparks.map(([x, y, s]) => path(sparkle(x, y, s), { fill: '#ffd27a' })).join('')));
}

/** The bronze door frame: thick and calm, with riveted corner plates and a keystone. */
function doorFrame() {
  const holeD = rr(hole.x, hole.y, hole.w, hole.h, radius);
  const corner = (sx, sy) => {
    const x = sx > 0 ? FR.x : FR.x + FR.w, y = sy > 0 ? FR.y : FR.y + FR.h;
    const pts = [[0, 0], [118, 0], [118, 22], [22, 22], [22, 118], [0, 118]].map(([a, b]) => [x + sx * (a - 10), y + sy * (b - 10)]);
    return path(poly(pts), { fill: 'url(#gold)', stroke: INK, strokeWidth: 3.5, strokeLinejoin: 'round' })
      + rivet(x + sx * 2, y + sy * 2, 6) + rivet(x + sx * 72, y + sy * 2, 5) + rivet(x + sx * 2, y + sy * 72, 5);
  };
  const ky = FR.y;
  return g({},
    path(chamfer(FR.x + 10, FR.y + 14, FR.w, FR.h, 28), { fill: '#000', fillOpacity: 0.35 }),
    path(chamfer(FR.x, FR.y, FR.w, FR.h, 28), { fill: 'url(#bronzeD)', stroke: INK, strokeWidth: 5 }),
    path(chamfer(FR.x + 12, FR.y + 12, FR.w - 24, FR.h - 24, 20), { fill: 'none', stroke: '#ffe2a0', strokeOpacity: 0.55, strokeWidth: 2.5 }),
    path(chamfer(hole.x - 18, hole.y - 18, hole.w + 36, hole.h + 36, 12), { fill: '#1c120a', stroke: '#6e4318', strokeWidth: 3 }),
    lip(holeD, '#000', [[6, 0.35], [2.5, 0.6]]),
    corner(1, 1), corner(-1, 1), corner(1, -1), corner(-1, -1),
    // keystone over the frame
    path(`M${CX - 56} ${ky - 50}H${CX + 56}L${CX + 40} ${ky + 26}H${CX - 40}Z`, { fill: '#000', fillOpacity: 0.35, transform: 'translate(6 8)' }),
    path(`M${CX - 56} ${ky - 50}H${CX + 56}L${CX + 40} ${ky + 26}H${CX - 40}Z`, { fill: 'url(#stoneH)', stroke: INK, strokeWidth: 4, strokeLinejoin: 'round' }),
    path(`M${CX - 50} ${ky - 44}H${CX + 50}`, { stroke: '#e6dccb', strokeOpacity: 0.7, strokeWidth: 3 }),
    g({ class: 'dg-glow' }, glowStroke(`M${CX} ${ky - 36}L${CX + 20} ${ky - 12}L${CX} ${ky + 12}L${CX - 20} ${ky - 12}ZM${CX} ${ky - 22}V${ky - 2}`, '#ff7a1a', 3.2, [[5, 0.1], [2.8, 0.2], [1.6, 0.55], [1, 1]], { strokeLinejoin: 'round' })),
    path(`M${CX} ${ky - 36}L${CX + 20} ${ky - 12}L${CX} ${ky + 12}L${CX - 20} ${ky - 12}ZM${CX} ${ky - 22}V${ky - 2}`, { fill: 'none', stroke: '#ffe2a6', strokeWidth: 1.4, strokeLinejoin: 'round' }));
}

/** Forge brazier: iron bowl with a bronze rim on a stepped stone foot, glowing coals and flames. */
function brazier(x, y, k = 1.3) {
  // flame tongue rising from the bowl (local units, base at y = -46)
  const flame = (s, dx, lean = 0) => `M${P(dx + lean, -46 - 96 * s)}C${P(dx + 30 * s, -46 - 58 * s, dx + 30 * s, -50, dx, -40)}C${P(dx - 30 * s, -50, dx - 30 * s + lean * 0.5, -46 - 60 * s, dx + lean, -46 - 96 * s)}Z`;
  return g({ transform: tf(x, y, 0, k) },
    g({ class: 'dg-flick' }, path(circle(0, -70, 64), { fill: 'url(#lampHalo)' })),
    path(chamfer(-30, -4, 60, 22, [6, 6, 0, 0]), { fill: 'url(#stoneH)', stroke: INK, strokeWidth: 3.5 }),
    path(rr(-12, -22, 24, 20, 2), { fill: 'url(#iron)', stroke: INK, strokeWidth: 3 }),
    g({ class: 'dg-flick' },
      path(flame(0.62, -22, -8) + flame(0.62, 22, 8), { fill: '#e8541a', stroke: '#6e2406', strokeWidth: 2, strokeLinejoin: 'round' }),
      path(flame(1, 0, 3), { fill: '#ff7a1a', stroke: '#6e2406', strokeWidth: 2, strokeLinejoin: 'round' }),
      path(flame(0.68, 2, 2), { fill: '#ffb347' }),
      path(flame(0.4, 2, 1), { fill: '#fff0b8' })),
    path('M-52 -52H52L34 -20H-34Z', { fill: 'url(#iron)', stroke: INK, strokeWidth: 3.5, strokeLinejoin: 'round' }),
    path('M-40 -46H40', { stroke: '#ff9d2e', strokeOpacity: 0.7, strokeWidth: 3 }),
    path(rr(-58, -60, 116, 14, 4), { fill: 'url(#bronzeH)', stroke: INK, strokeWidth: 3 }),
    rivet(-40, -53, 4), rivet(0, -53, 4), rivet(40, -53, 4),
    path('M-44 -40L-36 -24', { stroke: '#fff', strokeOpacity: 0.45, strokeWidth: 3, strokeLinecap: 'round' }),
    g({ class: 'dg-glow2' }, path(sparkle(-26, -170, 6) + sparkle(22, -188, 5) + circle(6, -206, 2.5), { fill: '#ffd27a' })));
}

/** Broad stone steps with a sill under the door. */
function steps() {
  const s = [[100, 1110, W - 200, 50], [60, 1158, W - 120, 52], [24, 1208, W - 48, 58]];
  return g({},
    path(ellipse(CX, 1286, 820, 30), { fill: 'url(#floor)' }),
    ...s.map(([x, y, w, h]) => path(chamfer(x, y, w, h, [8, 8, 0, 0]), { fill: 'url(#stepG)', stroke: INK, strokeWidth: 4 })
      + path(`M${x + 10} ${y + 5}H${x + w - 10}`, { stroke: '#e6dccb', strokeOpacity: 0.65, strokeWidth: 3 })
      + path(Array.from({ length: Math.floor(w / 190) }, (_, i) => `M${n(x + 95 + i * 190 + (y % 3) * 30)} ${y + 8}V${y + h - 4}`).join(''), { stroke: '#2a211a', strokeOpacity: 0.55, strokeWidth: 3 })),
    band(FR.x - 20, FR.y + FR.h + 28, FR.w + 40, 18, 12),
    // bronze plate with a glowing sigil row on the middle riser
    path(chamfer(CX - 170, 1170, 340, 34, 8), { fill: 'url(#recess)', stroke: '#c98a3e', strokeWidth: 3 }),
    runes(CX - 130, 1187, 6, 15, 52, 'h', 505, 'dg-glow2'),
    mirror(brazier(92, 1160)));
}

function draw() {
  const defs = [
    '<style>.dg-glow,.dg-glow2{animation:dg-pulse 3.2s ease-in-out infinite}.dg-glow2{animation-delay:-1.6s}'
      + '.dg-flick{animation:dg-flick 1.3s steps(2,end) infinite}'
      + '@keyframes dg-pulse{0%,100%{opacity:1}50%{opacity:.62}}@keyframes dg-flick{0%,100%{opacity:1}50%{opacity:.8}}'
      + '@media (prefers-reduced-motion:reduce){*{animation:none!important}}</style>',
    lg('rock', [0, 0, 1, 1], [[0, '#4a5160'], [0.5, '#2c313b'], [1, '#1c1f27']]),
    lg('granA', [0, 0, 1, 1], [[0, '#a39b90'], [1, '#6c655b']]),
    lg('granB', [0, 0, 1, 1], [[0, '#827b71'], [1, '#524b44']]),
    lg('granC', [0, 0, 1, 1], [[0, '#b6ad9f'], [1, '#7c7469']]),
    lg('stoneH', [0, 0, 0, 1], [[0, '#c4bbad'], [0.45, '#958c80'], [1, '#625a50']]),
    lg('stepG', [0, 0, 0, 1], [[0, '#b0a799'], [0.5, '#81796e'], [1, '#544d45']]),
    lg('pillar', [0, 0, 1, 0], [[0, '#a59d91'], [0.3, '#c2b9ab'], [0.7, '#8c8478'], [1, '#5f584f']]),
    lg('recess', [0, 0, 0, 1], [[0, '#2a201a'], [1, '#3f3128']]),
    lg('bronzeH', [0, 0, 0, 1], [[0, '#f3c77a'], [0.4, '#c98a3e'], [0.75, '#8a5424'], [1, '#5a3412']]),
    lg('bronzeD', [0, 0, 1, 1], [[0, '#f0c070'], [0.35, '#c08236'], [0.7, '#8a5424'], [1, '#c98a3e']]),
    lg('gold', [0, 0, 1, 1], [[0, '#fff0b0'], [0.4, '#ffcf5a'], [0.8, '#c08a1e'], [1, '#7a520c']]),
    rg('rivet', [0.35, 0.3, 0.8], [[0, '#fff0c0'], [0.45, '#d9a04a'], [1, '#6e4116']]),
    lg('iron', [0, 0, 1, 1], [[0, '#7a808c'], [0.5, '#454a54'], [1, '#22252c']]),
    lg('steel', [0, 0, 0, 1], [[0, '#f2f4f8'], [0.45, '#b9bfca'], [0.55, '#7c8390'], [1, '#c9ced8']]),
    lg('haft', [0, 0, 1, 0], [[0, '#a8662a'], [0.5, '#7a4318'], [1, '#4a260c']]),
    rg('field', [0.5, 0.35, 0.75], [[0, '#4a3020'], [1, '#1c120a']]),
    lg('lampGlass', [0, 0, 0, 1], [[0, '#ffe7a0'], [0.5, '#ffad3a'], [1, '#e8641a']]),
    rg('lampHalo', [0.5, 0.5, 0.5], [[0, '#ffb347', 0.38], [0.45, '#ff7a1a', 0.14], [1, '#ff7a1a', 0]]),
    rg('crestHalo', [0.5, 0.5, 0.5], [[0, '#ffb347', 0.3], [0.5, '#ff7a1a', 0.1], [1, '#ff7a1a', 0]]),
    rg('forge', [0.5, 0.5, 0.5], [[0, '#ffd27a', 0.9], [0.5, '#ff7a1a', 0.45], [1, '#ff7a1a', 0]]),
    rg('floor', [0.5, 0.5, 0.5], [[0, '#000', 0.38], [1, '#000', 0]]),
  ].join('');

  const rnd = rng(3), embers = [];
  for (let i = 0; i < 22; i++) {
    const x = rnd() < 0.5 ? 30 + rnd() * 260 : W - 30 - rnd() * 260, y = 60 + rnd() * 900;
    embers.push(i % 3 ? circle(x, y, 1.6 + rnd() * 2) : sparkle(x, y, 6 + rnd() * 4));
  }
  const body = [
    cliff(),
    masonry(),
    mirror(pillar(), lantern()),
    doorFrame(),
    lintel(),
    pediment(),
    steps(),
    path(embers.join(''), { fill: '#ffb347', fillOpacity: 0.85 }),
  ].join('\n');
  return { defs, body: body.replace(/ d="[^"]*"/g, (m) => m.replace(/(\.\d)\d+/g, '$1')) };
}

module.exports = {
  W, H, hole, radius, draw,
  meta: {
    name: 'Dwarven Gate', theme: 'dwarven', rarity: 'epic', translucent: false, collection: 'legends-dread', license: 'CC-BY-4.0',
    desc: 'A mountain door of carved granite and riveted bronze, where forge-lit runes hum and the anvil crest stands guard over your game.',
    tags: ['fantasy', 'dwarven', 'stone', 'bronze', 'runes', 'forge', 'mountain'],
  },
};
