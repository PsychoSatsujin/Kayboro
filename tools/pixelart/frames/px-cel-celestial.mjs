// Celestial Orrery: a blue-steel armillary sphere rendered like a cel-shaded anime still. The screen sits
// in a square housing at the heart of a dark star-chart globe; a meridian ring hugs it (passing in front
// of the lower corners), equator and ecliptic rings sweep around it with little planets riding their
// ends, a kawaii gold sun crowns the top and an engraved two-tier pedestal shows a row of moon phases.
import { Canvas, bayer } from '../pixel.mjs';
import { INK, inset, sparkle } from '../kit.mjs';

const W = 256, H = 272, HOLE = [72, 74, 112, 112], HR = 6; // 1:1
const CX = 128, CY = 130; // instrument center (pixel-edge coordinates)
// navy -> cobalt -> azure -> cyan -> ice (shared with the Blue Cel siblings)
const B = ['#0a1140', '#111d68', '#18308f', '#2149bb', '#2d6ade', '#4790f2', '#6cb8fd', '#a3dfff', '#e0f6ff'];
const Y = ['#7a4a10', '#c7861d', '#ffc23d', '#ffe38a', '#fff7d6']; // the one warm accent: sun + one planet
const WHITE = '#ffffff';
const D2R = Math.PI / 180;

/**
 * Cel-shade a volume: dithered vertical gradient, one hard flat core-shadow band on the lower right,
 * a 1px lit top-left edge and an ink outline. Shading is computed on `m` but only painted inside
 * `clip` (so a ring can be split into back / front halves without seams).
 */
function cel(cv, m, grad, { shadow, k = 2, hi, clip, drop = true, ink = true, soft = 0.6 } = {}) {
  const bb = m.bbox();
  const area = clip ? m.and(clip) : m;
  if (drop) cv.cast(area.dilate(1), 1, 1, -1);
  if (grad.length > 1) cv.grad(area, grad, { soft, from: bb.y, to: bb.y + bb.h - 1 }); else cv.fill(area, grad[0]);
  const core = m.sub(m.shift(-k, -k)).and(area);
  if (shadow) cv.fill(core, shadow);
  if (hi) cv.fill(m.sub(m.shift(1, 1)).and(area).sub(core), hi);
  if (ink) cv.fill(clip ? m.ring().and(clip) : m.ring(), INK);
  return core;
}

/** Rotated filled ellipse (rot in degrees, negative = tilted up to the right). */
function ell(cv, cx, cy, rx, ry, rot = 0) {
  const c = Math.cos(rot * D2R), s = Math.sin(rot * D2R);
  return cv.mask().plot((x, y) => {
    const dx = x + 0.5 - cx, dy = y + 0.5 - cy, u = dx * c + dy * s, v = -dx * s + dy * c;
    return (u / rx) ** 2 + (v / ry) ** 2 <= 1;
  });
}
/** Back half (far side, drawn first) of a rotated ellipse: local v < 0. */
function half(cv, cx, cy, rot, back) {
  const c = Math.cos(rot * D2R), s = Math.sin(rot * D2R);
  return cv.mask().plot((x, y) => { const v = -(x + 0.5 - cx) * s + (y + 0.5 - cy) * c; return back ? v < 0 : v >= 0; });
}
const disc = (cv, cx, cy, r) => cv.mask().plot((x, y) => Math.hypot(x + 0.5 - cx, y + 0.5 - cy) <= r);

/** Pixel arc (angles in degrees, 0 = right, 90 = down) for specular slivers. */
function arc(cv, cx, cy, rx, ry, a0, a1, c, clip) {
  for (let a = a0; a <= a1; a += 0.5) {
    const x = Math.floor(cx + rx * Math.cos(a * D2R)), y = Math.floor(cy + ry * Math.sin(a * D2R));
    if (!clip || clip.has(x, y)) cv.set(x, y, c);
  }
}

/** A round cel planet with radial dithered light from the top-left. */
function planet(cv, cx, cy, r, R, { k = 2 } = {}) {
  const m = disc(cv, cx, cy, r);
  cv.cast(m.dilate(1), 1, 1, -1);
  cv.grad(m, R.slice().reverse(), { dir: { cx: cx - r * 0.6, cy: cy - r * 0.6, r: r * 2 }, soft: 0.6 });
  cv.fill(m.sub(m.shift(-k, -k)), R[0]);
  cv.outline(INK, m, { all: true });
  return m;
}

/** Moon phase disc: p in [0, 1) (0 new, .5 full), lit side light, dark side shadow. */
function moon(cv, x, y, d, p, lit, dark, rim) {
  const r = d / 2, cx = x + r, cy = y + r, m = cv.mask().oval(x, y, d, d, 1.05);
  cv.fill(m, (px, py) => {
    const u = (px + 0.5 - cx) / r, v = (py + 0.5 - cy) / r, w = Math.sqrt(Math.max(0, 1 - v * v));
    const on = p <= 0.5 ? u > (1 - 4 * p) * w : u < -(4 * p - 3) * w;
    return on ? lit : dark;
  });
  if (rim) cv.fill(m.sub(m.shift(1, 1)).and(cv.mask().plot((px, py) => cv.get(px, py) === lit)), rim);
  return m;
}

// Abstract star-chart glyphs (original, not any real zodiac set).
const GLYPHS = [
  ['..#..', '.#.#.', '#.#.#', '.#.#.', '..#..'],
  ['.#.#.', '#...#', '..#..', '#...#', '.#.#.'],
  ['.##..', '#....', '#..#.', '#....', '.##..'],
  ['..#..', '..#..', '##.##', '..#..', '..#..'],
  ['.#..#', '#.##.', '.....', '.#..#', '#.##.'],
  ['#...#', '.#.#.', '.....', '.#.#.', '#...#'],
];

export default {
  id: 'px-cel-celestial', name: 'Celestial Orrery', theme: 'celestial', rarity: 'epic', translucent: false,
  collection: 'blue-cel', license: 'CC-BY-4.0',
  desc: 'A cel-shaded blue orrery where tiny planets circle your game under a sleepy golden sun.',
  tags: ['celestial', 'orrery', 'planets', 'cel-shaded', 'blue', 'animated'],
  css: '.tw{animation:tw 2.2s steps(1) infinite}@keyframes tw{0%,59%{opacity:1}60%,100%{opacity:0}}' +
    '.o1{animation:o1 3.6s steps(1) infinite}@keyframes o1{0%{opacity:1}33.3%,100%{opacity:0}}' +
    '.o2{opacity:0;animation:o2 3.6s steps(1) infinite}@keyframes o2{0%{opacity:0}33.3%{opacity:1}66.6%,100%{opacity:0}}' +
    '.o3{opacity:0;animation:o3 3.6s steps(1) infinite}@keyframes o3{0%{opacity:0}66.6%,100%{opacity:1}}',
  draw() {
    const cv = new Canvas(W, H);
    cv.use(B, Y);

    // Dithered floor shadow under the pedestal (opaque pixels on a checker).
    cv.fill(cv.mask().oval(18, 258, 220, 12), (x, y) => {
      const d = ((x + 0.5 - CX) / 110) ** 2 + ((y + 0.5 - 264) / 6) ** 2;
      return d < 0.45 || bayer(x, y) < 1.15 - d ? INK : undefined;
    });

    // Equator + ecliptic rings: band masks, far halves first.
    const RINGS = [
      { cx: CX, cy: CY + 4, rx: 116, ry: 21, rot: 0, t: 6 },
      { cx: CX, cy: CY, rx: 122, ry: 22, rot: -30, t: 6 },
    ].map((r) => ({ ...r, m: ell(cv, r.cx, r.cy, r.rx, r.ry, r.rot).sub(ell(cv, r.cx, r.cy, r.rx - r.t, r.ry - r.t, r.rot)) }));
    for (const r of RINGS) {
      cel(cv, r.m, [B[5], B[4], B[3]], { shadow: B[2], clip: half(cv, r.cx, r.cy, r.rot, true), hi: B[6] });
    }

    // Dark star-chart globe behind everything at the heart.
    const globe = disc(cv, CX, CY, 86);
    cv.grad(globe, [B[2], B[1], B[0]], { dir: { cx: 70, cy: 70, r: 150 }, soft: 0.8 });
    // Constellations: little stick figures of stars in the visible segments around the housing.
    const CONST = [
      [[88, 52], [98, 47], [110, 50], [118, 45]],
      [[142, 47], [152, 52], [160, 46], [170, 51], [166, 57]],
      [[49, 98], [53, 108], [47, 118], [52, 128]],
      [[205, 112], [201, 122], [208, 131], [204, 142], [210, 150]],
      [[90, 210], [100, 214], [108, 209]],
      [[150, 213], [160, 208], [168, 214]],
    ];
    for (const pts of CONST) {
      for (let i = 1; i < pts.length; i++) cv.fill(cv.mask().line(...pts[i - 1], ...pts[i]).and(globe), B[3]);
      pts.forEach(([x, y], i) => {
        if (i % 2) cv.set(x, y, B[7]);
        else cv.px([[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]], B[5]).set(x, y, WHITE);
      });
    }
    const rnd = (() => { let s = 7; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();
    for (let i = 0; i < 70; i++) {
      const x = Math.floor(44 + rnd() * 168), y = Math.floor(46 + rnd() * 168);
      if (globe.erode(2).has(x, y) && !cv.mask().rect(58, 60, 140, 140).has(x, y) && cv.get(x, y) !== B[3]) cv.set(x, y, rnd() < 0.3 ? B[6] : B[4]);
    }
    cv.outline(INK, globe, { all: true });

    // Meridian ring with degree ticks, gloss and a lit rim.
    const ring = disc(cv, CX, CY, 92).sub(disc(cv, CX, CY, 84.5));
    const meridian = (clip) => {
      cel(cv, ring, [B[7], B[6], B[5], B[4], B[3]], { shadow: B[2], k: 2, hi: B[8], clip, drop: !clip, soft: 0.5 });
      const ticks = cv.mask();
      for (let a = 0; a < 360; a += 10) {
        const r0 = a % 30 ? 86.5 : 85.5;
        for (let r = r0; r <= 88; r += 0.5) ticks.put(Math.floor(CX + r * Math.cos(a * D2R)), Math.floor(CY + r * Math.sin(a * D2R)));
      }
      cv.tone(clip ? ticks.and(clip) : ticks, -2);
      const gl = ring.erode(1).and(clip || ring);
      arc(cv, CX, CY, 90, 90, 196, 246, B[8], gl);
      arc(cv, CX, CY, 90, 90, 206, 226, WHITE, gl);
      arc(cv, CX, CY, 90, 90, 252, 258, WHITE, gl);
    };
    meridian(null);

    // Near halves of the equator + ecliptic sweep in front of the globe and meridian.
    for (const r of RINGS) {
      const fr = half(cv, r.cx, r.cy, r.rot, false);
      cel(cv, r.m, [B[7], B[6], B[5], B[4]], { shadow: B[3], clip: fr, hi: B[8] });
    }

    // Square housing: raised ice lip, then the dark tube sloping into the glass.
    const house = cv.mask().rrect(60, 62, 136, 136, 8);
    cel(cv, house, [B[8], B[7], B[6], B[5]], { shadow: B[4], k: 2, hi: WHITE });
    const tube = cv.mask().rrect(65, 67, 126, 126, 7);
    cv.fill(tube, (x, y) => (y % 2 ? B[1] : '#0f1a5c'));
    cv.fill(tube.sub(tube.shift(2, 2)), B[0]);
    cv.fill(tube.sub(tube.shift(-1, -1)), B[3]);
    cv.outline(INK, tube, { all: true });
    inset(cv, ...HOLE, HR, { rim: INK, top: B[0], left: B[0], bottom: B[2], right: B[2] }, 2);
    // Glass glints on the tube lip, kept clear of the opening edge.
    const band = tube.erode(1).sub(cv.mask().rrect(HOLE[0] - 3, HOLE[1] - 3, HOLE[2] + 6, HOLE[3] + 6, HR + 3));
    cv.fill(band.and(cv.mask().rect(80, 68, 16, 1)), B[4]).fill(band.and(cv.mask().rect(99, 68, 4, 1)), B[4]);
    cv.fill(band.and(cv.mask().rect(66, 82, 1, 12)), B[3]);
    arc(cv, 64, 64, 2, 2, 180, 270, WHITE, house);

    // The meridian passes in front of the housing's lower corners, held by little clamps.
    const lower = cv.mask().rect(0, CY, W, H - CY).and(house.dilate(1));
    meridian(lower);
    for (const [x, y] of [[CX - 65, CY + 63], [CX + 64, CY + 63]]) {
      const cl = cv.mask().rrect(x - 3, y - 3, 7, 7, 2);
      cel(cv, cl, [B[6], B[4]], { shadow: B[2], hi: B[8] });
      cv.set(x, y, B[1]);
    }

    // Stem, collar and two-tier engraved pedestal.
    const collar = cv.mask().oval(114, 215, 28, 10);
    const stem = cv.mask().rect(121, 222, 14, 12);
    cel(cv, stem, [B[5], B[4], B[3]], { shadow: B[2], hi: B[7] });
    cv.rect(124, 224, 1, 8, B[7]);
    cel(cv, collar, [B[7], B[5], B[4]], { shadow: B[3], hi: B[8] });
    cv.rect(119, 217, 5, 1, WHITE);
    const tier1 = cv.mask().poly([[64, 231], [192, 231], [200, 245], [56, 245]]);
    cel(cv, tier1, [B[7], B[6], B[5]], { shadow: B[3], hi: B[8] });
    const tier2 = cv.mask().rrect(28, 245, 200, 20, 5);
    cel(cv, tier2, [B[6], B[5], B[4], B[3]], { shadow: B[2], k: 2, hi: B[8] });
    cv.fill(tier2.and(cv.mask().rect(0, 246, W, 3)).sub(tier2.edge()), B[7]);
    cv.fill(tier2.and(cv.mask().rect(0, 249, W, 1)), B[3]);
    cv.fill(tier2.sub(tier2.shift(0, 1)).clip(33, 0, 190, H), B[8]);
    cv.rect(57, 244, 142, 1, INK);
    // Engraved glyphs and the brand on the upper tier.
    const eng = (rows, x, y) => rows.forEach((row, j) => [...row].forEach((ch, i) => {
      if (ch === '#') { cv.set(x + i, y + j, B[2]); if (row[i + 1] !== '#' && rows[j + 1]?.[i] !== '#') cv.set(x + i + 1, y + j + 1, B[8]); }
    }));
    GLYPHS.forEach((g, i) => eng(g, i < 3 ? 66 + i * 14 : 156 + (i - 3) * 14, 235));
    const bx = CX - (cv.textWidth('KAYBORO') >> 1);
    cv.text('KAYBORO', bx + 1, 237, B[8]).text('KAYBORO', bx, 236, B[2]);
    // Moon phases along the base, each in a recessed socket.
    for (let i = 0; i < 9; i++) {
      const x = CX - 4 + (i - 4) * 20, y = 253;
      const so = cv.mask().oval(x - 2, y - 2, 12, 12);
      cv.fill(so, B[1]).fill(so.sub(so.shift(1, 1)), B[0]).fill(so.sub(so.shift(-1, -1)), B[6]);
      moon(cv, x, y, 8, i / 8 === 1 ? 0.999 : i / 8, B[8], B[3], WHITE);
    }

    // Kawaii sun crowning the top, in a little blue cup.
    const SY = 21;
    const cup = cv.mask().poly([[118, 31], [138, 31], [135, 42], [121, 42]]);
    cel(cv, cup, [B[7], B[5]], { shadow: B[3], hi: B[8] });
    cv.rect(118, 33, 20, 1, B[3]);
    let rays = cv.mask();
    for (let a = 0; a < 360; a += 45) {
      if (a === 90) continue; // hidden by the cup
      const L = a % 90 ? 18 : 21.5, t = a * D2R, n = [-Math.sin(t), Math.cos(t)], hw = a % 90 ? 3.6 : 4.6;
      rays = rays.or(cv.mask().poly([
        [CX + 10 * Math.cos(t) + n[0] * hw, SY + 10 * Math.sin(t) + n[1] * hw],
        [CX + L * Math.cos(t), SY + L * Math.sin(t)],
        [CX + 10 * Math.cos(t) - n[0] * hw, SY + 10 * Math.sin(t) - n[1] * hw],
      ]));
    }
    cel(cv, rays, [Y[3], Y[2]], { shadow: Y[1], k: 1, hi: Y[4] });
    const sun = disc(cv, CX, SY, 12);
    cv.cast(sun.dilate(1), 1, 1, -1);
    cv.grad(sun, [Y[4], Y[3], Y[2]], { dir: { cx: 120, cy: 12, r: 26 }, soft: 0.6 });
    cv.fill(sun.sub(sun.shift(-3, -3)), Y[1]);
    cv.outline(INK, sun, { all: true });
    cv.px([[120, 14], [121, 13], [122, 12], [119, 15], [119, 16]], WHITE);
    cv.rect(122, 19, 2, 3, INK).rect(132, 19, 2, 3, INK).set(122, 19, WHITE).set(132, 19, WHITE);
    cv.px([[126, 24], [127, 25], [128, 25], [129, 24]], INK);
    cv.rect(119, 23, 2, 1, Y[1]).rect(135, 23, 2, 1, Y[1]);

    // Planets riding the ring ends; the gold one is the only other warm accent.
    const gp = planet(cv, 234, 142, 7, Y);
    const gr = ell(cv, 234.5, 142.5, 13, 3.5, -18).sub(ell(cv, 234.5, 142.5, 9.5, 1.6, -18)).sub(gp.and(half(cv, 234.5, 142.5, -18, true)));
    cv.fill(gr, (x, y) => (x < 234 ? Y[4] : Y[3]));
    cv.outline(INK, gr, { all: false });
    planet(cv, 17, 134, 6, [B[2], B[4], B[6], B[7], B[8]]);
    cv.px([[16, 137], [17, 137], [20, 132]], B[5]);
    const p3 = planet(cv, 229, 73, 6, [B[1], B[3], B[5], B[6], B[7]]);
    cv.fill(p3.and(cv.mask().rect(0, 73, W, 1)), B[8]).fill(p3.and(cv.mask().rect(0, 74, W, 1)), B[3]);
    const p4 = planet(cv, 28, 188, 7, [B[3], B[5], B[6], B[7], B[8]]);
    cv.fill(p4.and(cv.mask().rect(0, 186, W, 1)).sub(p4.edge()), B[5]).fill(p4.and(cv.mask().rect(0, 190, W, 1)).sub(p4.edge()), B[5]);

    // A tiny moonlet steps along the meridian's upper-left arc.
    [214, 228, 242].forEach((a, i) => {
      const l = cv.layer(`o${i + 1}`), x = Math.floor(CX + 88 * Math.cos(a * D2R)), y = Math.floor(CY + 88 * Math.sin(a * D2R));
      const m = l.mask().oval(x - 2, y - 2, 5, 5, 1.2);
      l.fill(m.ring(), INK).fill(m, B[8]).set(x - 1, y - 1, WHITE).set(x + 1, y + 1, B[6]);
    });

    // Sparkles; the sun's twinkle glints blink.
    sparkle(cv, 16, 16, 2, B[7], WHITE);
    sparkle(cv, 238, 22, 2, B[7], WHITE);
    sparkle(cv, 34, 56, 1, B[6], B[8]);
    sparkle(cv, 222, 196, 1, B[6], B[8]);
    const tw = cv.layer('tw');
    sparkle(tw, 108, 10, 1, Y[3], WHITE);
    sparkle(tw, 150, 14, 2, Y[3], WHITE);

    cv.outline(INK);
    return cv.punch(...HOLE, HR);
  },
};
