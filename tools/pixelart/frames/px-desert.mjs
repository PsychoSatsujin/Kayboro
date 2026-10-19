// Oasis arch: a natural sandstone arch with layered red-orange strata frames the screen. A big low sun
// peeks over its shoulder, a fennec-like critter sits on top, date palms lean over a little oasis pool,
// a camel naps on the dunes beside a scorpion, a barrel cactus in bloom and a heat-haze shimmer.
import { Canvas, ramp, bayer, rng } from '../pixel.mjs';
import { INK, inset, part, sprite, sparkle } from '../kit.mjs';

const W = 304, H = 200, HOLE = [56, 40, 192, 108], HR = 3; // 16:9
const rk = (c) => ramp(c, 7, { step: 0.1, hue: 8, sat: 0.05 });
const Rr = rk('#c8552f'); // red sandstone
const Ro = rk('#e07d3e'); // orange band
const Rc = rk('#eaa86a'); // pale cream band
const Rd = rk('#a23d2c'); // deep red band
const Sd = ramp('#f0c27c', 7, { step: 0.08, hue: 8, sat: 0.05 }); // sand
const Lf = ramp('#4c9e48', 5, { step: 0.13 }); // palm fronds
const Tk = ramp('#9a6638', 5, { step: 0.12 }); // palm trunk
const Wt = ramp('#2aaabd', 6, { step: 0.11 }); // oasis water
const Cm = ramp('#c98a4e', 6, { step: 0.11 }); // camel
const Fx = ramp('#eda868', 6, { step: 0.1 }); // fennec fur
const Cr = ['#c9a27e', '#e6c9a6', '#f7e6cc', '#fff7ea']; // cream fur
const Pk = ['#b8506a', '#ee7f98', '#ffb3c4']; // pink
const Sc = ramp('#b45a2a', 5, { step: 0.13 }); // scorpion
const Cc = ramp('#4a9a6c', 5, { step: 0.12 }); // cactus
const Fl = ramp('#ff4f98', 5, { step: 0.12 }); // cactus bloom
const Ag = ramp('#6aa690', 5, { step: 0.12 }); // agave
const Su = ['#ff9a3c', '#ffc14f', '#ffe27a', '#fff3b0', '#fffbe6']; // sun

const hash = (x, y) => {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

// Catmull-Rom through the points, ~1px steps.
function spline(P) {
  const out = [];
  for (let i = 0; i + 1 < P.length; i++) {
    const [a, b, c, d] = [P[Math.max(0, i - 1)], P[i], P[i + 1], P[Math.min(P.length - 1, i + 2)]];
    const n = Math.max(1, Math.ceil(Math.hypot(c[0] - b[0], c[1] - b[1])));
    for (let k = 0; k < n; k++) {
      const t = k / n, t2 = t * t, t3 = t2 * t;
      out.push([0, 1].map((j) => 0.5 * (2 * b[j] + (-a[j] + c[j]) * t + (2 * a[j] - 5 * b[j] + 4 * c[j] - d[j]) * t2 + (-a[j] + 3 * b[j] - 3 * c[j] + d[j]) * t3)));
    }
  }
  return out.concat([P[P.length - 1]]);
}

// Strata (top -> bottom): y of each band's top edge, its ramp, and whether its top edge is a soft dithered blend.
const BANDS = [[-99, Rc, 0], [14, Ro, 1], [24, Rr, 0], [33, Rd, 0], [40, Ro, 1], [52, Rr, 0], [64, Rc, 1], [72, Ro, 0],
  [84, Rr, 1], [98, Rd, 0], [106, Ro, 1], [118, Rr, 0], [132, Rc, 0], [140, Ro, 1], [152, Rr, 0], [166, Rd, 0]];
const warp = (x) => 1.6 * Math.sin(x * 0.045) + 0.9 * Math.sin(x * 0.11 + 1.3) + (x - 152) * 0.02;
const bandOf = (yy) => { let k = 0; while (k + 1 < BANDS.length && BANDS[k + 1][0] <= yy) k++; return k; };

function palm(cv, pts, fronds, { dates = true } = {}) {
  const path = spline(pts), n = path.length, trunk = cv.mask();
  path.forEach(([x, y], i) => trunk.circle(Math.round(x), Math.round(y), i < n * 0.35 ? 2 : 1, 1.6));
  part(cv, trunk, Tk, { top: [3], left: [3], bottom: [1], right: [1], fill: 2, shadow: false });
  path.forEach(([x, y], i) => { if (i % 3 === 0 && i < n - 3) cv.fill(cv.mask().rect(Math.round(x) - 2, Math.round(y), 5, 1).and(trunk), (px, py, c) => cv.step(c, -1)); });
  const [cx, cy] = pts[pts.length - 1];
  const leaves = cv.mask();
  for (const [ang, L, droop] of fronds) {
    const dx = Math.cos(ang), dy = Math.sin(ang);
    for (let s = 0; s <= L; s += 0.5) {
      const t = s / L, x = cx + dx * s, y = cy + dy * s + droop * L * t * t;
      leaves.circle(Math.round(x), Math.round(y), t < 0.5 ? 1 : 0, 1.6);
      if (Math.round(s) % 2 === 0 && t > 0.15) { // hanging leaflets
        const len = Math.round(3 * (1 - t) + 1);
        for (let k = 1; k <= len; k++) leaves.put(Math.round(x + (dx > 0 ? -1 : 1) * k * 0.4), Math.round(y) + k);
      }
    }
  }
  leaves.circle(cx, cy, 3);
  if (dates) for (const [x, y] of [[cx - 3, cy + 4], [cx + 2, cy + 4]]) {
    const d = cv.mask().oval(x - 1, y, 4, 5, 1.2);
    cv.outline(INK, d, { all: true });
    cv.fill(d, (px, py) => ((px + py) % 2 ? '#e0782a' : '#a8441e')).set(x, y + 1, '#ffb45a');
  }
  cv.cast(leaves.dilate(1), 1, 1, -1);
  cv.shade(leaves, Lf, { top: [4], left: [3], bottom: [0], right: [1], fill: 2 });
  cv.outline(INK, leaves, { all: true });
  return leaves;
}

export default {
  id: 'px-desert', name: 'Oasis Arch', theme: 'desert', rarity: 'common', translucent: false,
  collection: 'wild-pixels', license: 'CC-BY-4.0',
  desc: 'Your game glows through a sunny sandstone arch while a camel naps by the oasis and a big-eared fox keeps watch.',
  tags: ['desert', 'oasis', 'animals', 'nature', 'animated', 'pixel'],
  css: '.hz{animation:hz 1.1s steps(1) infinite}.hz2{animation:hz 1.1s steps(1) -.55s infinite}@keyframes hz{50%{opacity:0}}' +
    '.gl{animation:gl 2.6s steps(1) infinite}@keyframes gl{0%,65%{opacity:1}66%,100%{opacity:0}}',
  draw() {
    const cv = new Canvas(W, H), rnd = rng(11);
    cv.use(Rr, Ro, Rc, Rd, Sd, Lf, Tk, Wt, Cm, Fx, Sc, Cc, Fl, Ag);
    const [hx, hy, hw, hh] = HOLE;

    // Big low sun behind the left shoulder.
    const sun = cv.mask().circle(44, 24, 21);
    cv.grad(sun, Su.slice().reverse(), { dir: { cx: 38.5, cy: 18.5, r: 27 }, soft: 0.7 });
    cv.outline(INK, sun, { all: true });

    // Rock arch silhouette: a superellipse with eroded, lumpy edges.
    const rock = cv.mask().plot((x, y) => {
      const nx = Math.abs(x + 0.5 - 152) / 146, ny = Math.max(0, 112 - (y + 0.5)) / 104;
      const lump = 0.035 * Math.sin(x * 0.19) + 0.03 * Math.sin(y * 0.23 + 2) + 0.02 * Math.sin((x + y) * 0.47);
      const flare = y > 150 ? (y - 150) * 0.0012 : 0;
      return nx ** 2.4 + ny ** 2.4 <= 1 + lump + flare;
    }, 0, 0, W, 176);
    const topAt = (x) => { for (let y = 0; y < H; y++) if (rock.has(x, y)) return y; return H; };
    const clean = cv.mask().rect(hx - 7, hy - 7, hw + 14, hh + 14);
    const has = (x, y) => rock.has(x, y);
    const run = (x, y, dx, dy, k) => { for (let i = 1; i <= k; i++) if (!has(x + dx * i, y + dy * i)) return i; return 0; };
    cv.fill(rock, (x, y) => {
      const w = warp(x), yy = y - w, yd = yy + (bayer(x, y) - 0.5) * 2.4;
      let k = bandOf(yy);
      const kd = bandOf(yd);
      if (kd !== k && BANDS[Math.max(k, kd)][2]) k = kd;
      const R = BANDS[k][1];
      let i = 3;
      const up = bandOf(yy - 1), dn = bandOf(yy + 1);
      if (up !== k && !BANDS[k][2]) i += 1; // lit ledge top
      if (dn !== k && !BANDS[dn][2]) i -= 1; // overhang shadow
      // big-form light: left leg lit, right leg in shade (dithered transitions)
      if (x + (bayer(x, y) - 0.5) * 14 < 30) i += 1;
      if (x + (bayer(x, y) - 0.5) * 18 > 262) i -= 1;
      // silhouette bevel
      const t = run(x, y, 0, -1, 2), l = run(x, y, -1, 0, 1), r = run(x, y, 1, 0, 2);
      if (t === 1) i += 2; else if (t === 2) i += 1; else if (l) i += 1;
      if (r === 1) i -= 2; else if (r === 2) i -= 1;
      if (!clean.has(x, y)) { const h = hash(x, y); if (h < 0.07) i -= 1; else if (h > 0.95) i += 1; }
      return R[Math.max(0, Math.min(6, i))];
    });
    // Cross-bedding streaks and a few cracks.
    for (let n = 0; n < 70; n++) {
      const x = Math.floor(rnd() * W), y = Math.floor(rnd() * 170), len = 3 + Math.floor(rnd() * 7);
      const m = cv.mask().rect(x, y, len, 1).and(rock.erode(2)).sub(clean);
      cv.fill(m, (px, py, c) => cv.step(c, -1));
    }
    for (const [x0, y0, len] of [[22, 60, 14], [278, 66, 18], [36, 120, 10], [268, 128, 12], [118, 10, 8], [196, 14, 9]]) {
      let x = x0;
      for (let y = y0; y < y0 + len; y++) {
        if (rock.erode(1).has(x, y) && !clean.has(x, y)) { cv.set(x, y, cv.step(cv.get(x, y), -2)); if (rock.has(x + 1, y)) cv.set(x + 1, y, cv.step(cv.get(x + 1, y), 1)); }
        if (rnd() < 0.4) x += rnd() < 0.5 ? -1 : 1;
      }
    }
    // Eroded pockets (light from the top-left: shadowed top/left walls, lit lower lip).
    for (const [x, y, w, h] of [[14, 84, 9, 6], [28, 100, 5, 4], [270, 96, 8, 6], [284, 112, 5, 4], [12, 136, 6, 4], [282, 140, 7, 5], [92, 14, 6, 4], [206, 20, 7, 4]]) {
      const p = cv.mask().oval(x, y, w, h, 1.1).and(rock);
      cv.fill(p, (px, py, c) => cv.step(c, -2));
      cv.fill(p.sub(p.shift(0, -1)), (px, py, c) => cv.step(c, 3));
      cv.fill(p.and(p.shift(0, 1).not().shift(0, -1)).sub(p.shift(0, 1)), (px, py, c) => c);
    }

    // Deep reveal around the screen, then a lit lip on the sill.
    inset(cv, hx, hy, hw, hh, HR, { rim: INK, top: Rd[0], left: Rd[1], bottom: Ro[5], right: Rr[2] }, 3);
    cv.rect(hx - 1, hy + hh + 4, hw + 2, 1, Ro[6]);

    // Dunes: a darker back dune, a light front dune, with wind ripples and lit windward slopes.
    const dune = (y0, f, R, base) => {
      const prof = (x) => y0 + f(x);
      const m = cv.mask().plot((x, y) => y >= prof(x), 0, 0, W, H - 1);
      cv.fill(m, (x, y) => {
        const s = prof(x + 1) - prof(x - 1), d = y - prof(x);
        let i = base + (s < -0.15 ? 1 : s > 0.15 ? -1 : (bayer(x, y) < 0.5 ? 0 : 1));
        if (d < 1) i += 1;
        if (d > 2 && Math.round(d + 1.5 * Math.sin(x * 0.16 + y * 0.05)) % 5 === 0) i -= 1;
        return R[Math.max(0, Math.min(R.length - 1, i))];
      });
      return { m, prof };
    };
    const back = dune(158, (x) => 3 * Math.sin(x * 0.035 + 1) + 2 * Math.sin(x * 0.09) - (x < 40 || x > 262 ? 4 : 0), Sd, 2);
    cv.outline(INK, back.m, { all: true });
    const front = dune(176, (x) => 5 * Math.sin(x * 0.028 + 2.2) + 2 * Math.sin(x * 0.071 + 0.5), Sd, 4);
    cv.outline(INK, front.m.sub(front.m.shift(0, 1)).shift(0, -1).and(back.m), { all: true });

    // Oasis pool with a wet-sand rim, reeds and glints.
    const pool = cv.mask().oval(14, 178, 88, 16);
    cv.fill(pool.dilate(1).sub(pool), Sd[1]).fill(pool.dilate(2).sub(pool.dilate(1)).and(front.m), Sd[2]);
    cv.grad(pool, [Wt[4], Wt[3], Wt[2], Wt[1]], { soft: 0.8 });
    cv.fill(pool.sub(pool.shift(0, 1)), Wt[1]);
    cv.fill(pool.and(pool.shift(0, 2).not().shift(0, 0)).and(pool.shift(0, -1)).sub(pool.shift(0, -2)), Wt[0]);
    for (const [x, y, l] of [[30, 184, 10], [56, 187, 14], [78, 183, 8], [44, 190, 6]]) cv.rect(x, y, l, 1, Wt[5]);
    const gl = cv.layer('gl');
    for (const [x, y] of [[36, 183], [70, 187]]) sparkle(gl, x, y, 1, Wt[5], '#ffffff');
    for (const [x, y, h] of [[12, 186, 7], [15, 185, 9], [18, 187, 5], [100, 184, 8], [103, 186, 5], [97, 186, 6]]) {
      cv.rect(x, y - h, 1, h, Lf[2]).set(x, y - h, Lf[4]);
      if (h > 7) cv.rect(x, y - h + 1, 1, 3, '#8a5a30');
    }

    // Date palms: a tall one leaning off the left leg, a short one by the pool.
    palm(cv, [[30, 186], [28, 150], [32, 112], [38, 84]], [[-2.8, 26, 0.45], [-2.3, 20, 0.5], [-0.35, 16, 0.6], [-0.9, 14, 0.3], [-1.8, 12, 0.2], [2.9, 18, 0.2], [0.15, 12, 0.7]]);
    palm(cv, [[96, 190], [92, 178], [84, 166]], [[-2.9, 18, 0.45], [-2.3, 12, 0.35], [-0.25, 18, 0.5], [-0.8, 12, 0.3], [-1.6, 8, 0.15]], { dates: false });

    // Resting camel facing the oasis (lying down, sleepy).
    const gy = 194, camel = cv.mask();
    camel.oval(214, 172, 46, 22).oval(226, 160, 24, 18).capsule(220, 180, 207, 168, 3.6).oval(194, 161, 17, 10).oval(190, 165, 9, 7);
    camel.rrect(206, gy - 7, 18, 7, 3).rrect(240, gy - 6, 22, 6, 3).capsule(259, 178, 263, 186, 1);
    const cmCast = camel.dilate(1);
    cv.cast(cmCast, 1, 1, -1);
    cv.fill(cv.mask().oval(204, gy - 3, 64, 7).sub(camel), (x, y, c) => (c ? cv.step(c, -1) : c));
    part(cv, camel, Cm, { top: [5, 4], left: [4], bottom: [1], right: [2], fill: 3, shadow: false });
    cv.fill(cv.mask().oval(226, 160, 24, 18).sub(cv.mask().oval(224, 158, 24, 18)).and(camel.erode(1)), Cm[2]); // hump crease
    cv.fill(cv.mask().rect(206, gy - 7, 18, 1).and(camel.erode(1)), Cm[2]).fill(cv.mask().rect(240, gy - 6, 22, 1).and(camel.erode(1)), Cm[2]);
    sprite(cv, 194, 162, ['..e.....', '.e......', '........', '........', '.....bb.'], { e: Cm[1], b: Pk[1] }); // ear tuft, blush
    sprite(cv, 192, 164, ['.k.k.', '..k..'], { k: INK }); // sleepy closed eye
    cv.px([[189, 167], [190, 169], [191, 169]], INK); // nostril + smile
    cv.set(199, 158, Cm[1]).set(200, 158, Cm[1]); // ear
    // tail tuft
    cv.set(263, 187, Cm[0]).set(264, 187, Cm[0]);
    // zzz
    sprite(cv, 178, 150, ['kkk', '..k', '.k.', 'kkk'], { k: Cr[3] });
    cv.outline(INK, cv.mask().rect(178, 150, 3, 4).and(cv.mask().pts([[178, 150], [179, 150], [180, 150], [180, 151], [179, 152], [178, 153], [179, 153], [180, 153]])), {});

    // Barrel cactus in bloom, an agave rosette and tiny wildflowers.
    const barrel = cv.mask().oval(272, 170, 16, 20, 1.05);
    part(cv, barrel, Cc, { top: [4], left: [3], bottom: [0], right: [1], fill: 2 });
    for (const x of [276, 280, 284]) cv.fill(cv.mask().rect(x, 172, 1, 16).and(barrel.erode(1)), (px, py, c) => cv.step(c, -1));
    for (let y = 174; y < 188; y += 4) for (const x of [275, 279, 283]) cv.set(x, y, Cr[3]);
    const bloom = cv.mask().pts([[278, 165], [279, 164], [280, 164], [281, 165], [277, 166], [282, 166], [278, 167], [279, 167], [280, 167], [281, 167], [279, 165], [280, 165], [279, 166], [280, 166], [276, 168], [283, 168], [278, 168], [281, 168]]);
    cv.outline(INK, bloom, { all: true });
    cv.fill(bloom, Fl[3]).px([[279, 164], [278, 165], [277, 166]], Fl[4]).px([[281, 167], [283, 168]], Fl[1]).px([[279, 166], [280, 166], [279, 165]], Su[2]);
    const agave = cv.mask();
    for (const [a, L] of [[-2.7, 9], [-2.2, 11], [-1.6, 12], [-1.1, 11], [-0.5, 9], [-1.9, 7], [-1.3, 7]]) agave.capsule(292, 190, Math.round(292 + Math.cos(a) * L), Math.round(190 + Math.sin(a) * L), 0.9);
    part(cv, agave, Ag, { top: [4], left: [3], bottom: [1], right: [1], fill: 2 });
    for (const [x, y, c] of [[124, 186, Su[1]], [170, 190, Fl[3]], [252, 172, Su[1]], [118, 190, Fl[3]]]) {
      cv.set(x, y + 1, Lf[2]).set(x, y + 2, Lf[2]);
      sparkle(cv, x, y, 1, c, Su[4]);
      cv.outline(INK, cv.mask().pts([[x, y], [x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1], [x, y + 2], [x, y + 3]]), {});
    }

    // Friendly scorpion: round amber body, little claws, curled tail with a soft tip.
    const sx = 142, sy = 184, scorp = cv.mask();
    scorp.oval(sx, sy, 14, 8);
    for (const [px, py] of [[sx + 14, sy + 2], [sx + 16, sy - 1], [sx + 17, sy - 4], [sx + 16, sy - 7], [sx + 13, sy - 8]]) scorp.circle(px, py, 1, 1.6);
    scorp.oval(sx - 6, sy - 1, 6, 5).oval(sx - 6, sy + 5, 6, 4).capsule(sx - 1, sy + 2, sx - 3, sy + 1, 1).capsule(sx - 1, sy + 5, sx - 3, sy + 6, 1);
    scorp.oval(sx + 11, sy - 10, 4, 4);
    cv.fill(cv.mask().oval(sx - 6, sy + 6, 26, 4).sub(scorp), (x, y, c) => (c ? cv.step(c, -1) : c));
    part(cv, scorp, Sc, { top: [4], left: [3], bottom: [0], right: [1], fill: 2 });
    for (const x of [sx + 4, sx + 7, sx + 10]) cv.fill(cv.mask().rect(x, sy + 1, 1, 6).and(scorp.erode(1)), Sc[1]);
    for (let i = 0; i < 4; i++) cv.px([[sx + 2 + i * 3, sy + 8], [sx + 3 + i * 3, sy + 9]], INK);
    cv.px([[sx + 1, sy + 2], [sx + 1, sy + 3], [sx + 4, sy + 2], [sx + 4, sy + 3]], INK).set(sx + 1, sy + 2, '#ffffff').set(sx + 4, sy + 2, '#ffffff');
    cv.set(sx + 2, sy + 5, Pk[1]).set(sx + 6, sy + 5, Pk[1]);

    // Fennec-like critter sitting on the right shoulder of the arch.
    const fx = 268, fy = topAt(fx) + 1, fen = cv.mask();
    fen.oval(fx - 7, fy - 13, 15, 13); // body
    fen.oval(fx - 7, fy - 23, 15, 12); // head
    fen.poly([[fx - 6, fy - 19], [fx - 12, fy - 33], [fx - 1, fy - 22]]).poly([[fx + 7, fy - 19], [fx + 13, fy - 33], [fx + 2, fy - 22]]);
    const tail = cv.mask();
    spline([[fx + 6, fy - 2], [fx + 13, fy - 4], [fx + 16, fy - 10], [fx + 14, fy - 16]]).forEach(([x, y], i, a) => tail.circle(Math.round(x), Math.round(y), i > a.length * 0.6 ? 2 : 2, 1.4));
    cv.cast(fen.or(tail).dilate(1), 1, 1, -1);
    part(cv, tail, Fx, { top: [5], left: [4], bottom: [1], right: [2], fill: 3, shadow: false });
    cv.fill(tail.and(cv.mask().rect(fx + 11, fy - 19, 8, 6)), Cr[3]).fill(tail.and(cv.mask().rect(fx + 11, fy - 13, 8, 1)), Cr[2]);
    part(cv, fen, Fx, { top: [5], left: [4], bottom: [1], right: [2], fill: 3, shadow: false });
    cv.fill(cv.mask().poly([[fx - 6, fy - 21], [fx - 10, fy - 30], [fx - 3, fy - 22]]), Pk[1]);
    cv.fill(cv.mask().poly([[fx + 7, fy - 21], [fx + 11, fy - 30], [fx + 4, fy - 22]]), Pk[1]);
    cv.px([[fx - 9, fy - 28], [fx + 10, fy - 28]], Pk[2]);
    cv.fill(cv.mask().oval(fx - 4, fy - 17, 9, 6), Cr[2]).fill(cv.mask().oval(fx - 4, fy - 10, 9, 9).and(fen.erode(1)), Cr[2]);
    cv.fill(cv.mask().oval(fx - 4, fy - 10, 9, 9).and(fen.erode(1)).sub(cv.mask().oval(fx - 3, fy - 9, 9, 9)), Cr[1]);
    sprite(cv, fx - 4, fy - 19, ['kk...kk', 'kw...kw', '.........', '.b.k.b.', '..k.k..'], { k: INK, w: '#ffffff', b: Pk[1] });
    cv.px([[fx - 2, fy - 1], [fx + 2, fy - 1]], Cr[3]);

    // Heat-haze shimmer over the sand: two wavy streaks that trade places.
    const hz = cv.layer('hz'), hz2 = cv.layer('hz2');
    for (const [L, ph] of [[hz, 0], [hz2, Math.PI]]) {
      for (let x = 108; x < 186; x++) {
        const y = 167 + Math.round(Math.sin(x * 0.35 + ph) * 1);
        if ((x + (ph ? 3 : 0)) % 12 < 8 && back.m.has(x, y) && !front.m.has(x, y)) L.set(x, y, Sd[6]);
        const y2 = 172 + Math.round(Math.sin(x * 0.35 + ph + 1.5) * 1);
        if ((x + (ph ? 0 : 6)) % 14 < 6 && back.m.has(x, y2) && !front.m.has(x, y2) && x > 120 && x < 176) L.set(x, y2, Sd[6]);
      }
    }

    cv.outline(INK);
    return cv.punch(...HOLE, HR);
  },
};
