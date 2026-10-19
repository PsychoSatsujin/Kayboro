// Cosmic Gateway: the screen is a window at the heart of a spiral galaxy. Dithered cobalt-to-cyan
// nebula arms swirl around an ornate cosmic-metal portal with glowing seams and star gems; a ringed
// gas giant hides in the lower-left, a comet streaks over the top, a far-off sun glows in the corner,
// and a tiny tethered astronaut waves from the right. Cel shaded like the rest of the Blue Cel set.
import { Canvas, bayer, rng } from '../pixel.mjs';
import { INK, inset, sparkle } from '../kit.mjs';

const W = 320, H = 208, HOLE = [72, 52, 176, 99], HR = 6; // 16:9
// Blue Cel ramps (shared with px-cel-crt / px-cel-pet): navy -> cobalt -> azure -> cyan -> ice
const B = ['#0a1140', '#111d68', '#18308f', '#2149bb', '#2d6ade', '#4790f2', '#6cb8fd', '#a3dfff', '#e0f6ff'];
const K = ['#04263a', '#0a4560', '#1fb2dc', '#7eefff', '#e6feff']; // gem / seam cyan
const P = ['#2c3d78', '#5670ae', '#8aa4da', '#b8cdf2', '#dce8fd', '#f6faff']; // pearl suit
const A = ['#5a1f0a', '#b24a14', '#f2771f', '#ffad3a', '#ffe08a', '#fff7dc']; // the one warm accent: comet + sun
const WHITE = '#ffffff';
const CX = 160, CY = 101, SQ = 0.64; // galaxy center; the disc is tilted (squashed vertically)

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const smooth = (t) => t * t * (3 - 2 * t);
// Deterministic value noise (hash lattice, smooth interpolation).
const hash = (i, j, s) => { const v = Math.sin(i * 127.1 + j * 311.7 + s * 74.7) * 43758.5453; return v - Math.floor(v); };
function vnoise(x, y, cell, s) {
  const fx = x / cell, fy = y / cell, i = Math.floor(fx), j = Math.floor(fy), u = smooth(fx - i), v = smooth(fy - j);
  const a = hash(i, j, s), b = hash(i + 1, j, s), c = hash(i, j + 1, s), d = hash(i + 1, j + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

/** Cel-shade a volume: dithered gradient, one hard core-shadow band lower-right, lit top-left edge, ink. */
function cel(cv, m, grad, { shadow, k = 3, hi, drop = true, ink = true, soft = 0.6, dir } = {}) {
  if (drop) cv.cast(m.dilate(1), 1, 1, -1);
  if (grad.length > 1) cv.grad(m, grad, { soft, ...(dir ? { dir } : {}) }); else cv.fill(m, grad[0]);
  const core = m.sub(m.shift(-k, -k));
  if (shadow) cv.fill(core, shadow);
  if (hi) cv.fill(m.sub(m.shift(1, 1)).sub(core), hi);
  if (ink) cv.outline(INK, m, { all: true });
  return core;
}

/** Pixel arc (degrees, 0 = right, 90 = down) for specular slivers. */
function arc(cv, cx, cy, rx, ry, a0, a1, c, clip) {
  for (let a = a0; a <= a1; a += 0.5) {
    const t = (a * Math.PI) / 180, x = Math.round(cx + rx * Math.cos(t)), y = Math.round(cy + ry * Math.sin(t));
    if (!clip || clip.has(x, y)) cv.set(x, y, c);
  }
}

// 5-point star polygon.
const star = (cv, cx, cy, ro, ri, rot = 0) => cv.mask().poly(Array.from({ length: 10 }, (_, i) => {
  const a = rot - Math.PI / 2 + (i * Math.PI) / 5, r = i % 2 ? ri : ro;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
}));

/** Faceted cyan gem (diamond) with an ink outline and a glint. */
function gem(cv, cx, cy, rw, rh) {
  const m = cv.mask().poly([[cx + 0.5, cy - rh], [cx + rw + 0.5, cy + 0.5], [cx + 0.5, cy + rh + 1], [cx - rw + 0.5, cy + 0.5]]);
  cv.cast(m.dilate(1), 1, 1, -2);
  cv.fill(m, (x, y) => (x <= cx ? (y <= cy ? K[4] : K[3]) : (y <= cy ? K[3] : K[2])));
  cv.fill(m.sub(m.shift(-2, -2)), K[1]);
  cv.outline(INK, m, { all: true });
  cv.set(cx - 1, cy - 1, WHITE);
  return m;
}

// Two logarithmic spiral arms (point-symmetric), sampled as centerlines in the tilted disc.
const ARMS = [0, Math.PI].map((rot) => Array.from({ length: 321 }, (_, i) => {
  const t = i / 320, th = (-8 * Math.PI) / 180 - t * ((212 * Math.PI) / 180) + rot, r = 100 * Math.exp(Math.log(1.62) * t);
  return [CX + r * Math.cos(th), CY + r * Math.sin(th) * SQ, t];
}));
const armW = (t) => 3 + 19 * (1 - t) ** 0.8;
/** Nearest arm sample for a pixel: [intensity 0..1 across the arm, t along it, signed side]. */
function armAt(x, y) {
  let best = [-1, 0, 0];
  for (const arm of ARMS) {
    let dm = Infinity, k = 0;
    for (let i = 0; i < arm.length; i++) { const d = (arm[i][0] - x - 0.5) ** 2 + (arm[i][1] - y - 0.5) ** 2; if (d < dm) { dm = d; k = i; } }
    const [px, py, t] = arm[k], [qx, qy] = arm[Math.min(arm.length - 1, k + 1)], [ox, oy] = arm[Math.max(0, k - 1)];
    const I = 1 - Math.sqrt(dm) / armW(t);
    const side = Math.sign((qx - ox) * (y + 0.5 - py) - (qy - oy) * (x + 0.5 - px));
    if (I > best[0]) best = [I, t, side];
  }
  return best;
}

/** Keep only 4-connected regions of at least `min` pixels. */
function blobs(m, min) {
  const out = m.clone(), seen = new Uint8Array(m.w * m.h);
  m.each((x0, y0) => {
    if (seen[y0 * m.w + x0]) return;
    const st = [[x0, y0]], comp = [];
    seen[y0 * m.w + x0] = 1;
    while (st.length) {
      const [x, y] = st.pop();
      comp.push([x, y]);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const X = x + dx, Y = y + dy;
        if (m.has(X, Y) && !seen[Y * m.w + X]) { seen[Y * m.w + X] = 1; st.push([X, Y]); }
      }
    }
    if (comp.length < min) for (const [x, y] of comp) out.put(x, y, 0);
  });
  return out;
}

export default {
  id: 'px-cel-universe', name: 'Cosmic Gateway', theme: 'universe', rarity: 'epic', translucent: false,
  collection: 'blue-cel', license: 'CC-BY-4.0',
  desc: 'Your game becomes a window at the heart of a swirling blue galaxy, with a comet overhead and a tiny astronaut waving hello.',
  tags: ['universe', 'galaxy', 'space', 'cel-shaded', 'blue', 'animated'],
  css: '.tw{animation:tw 2.6s steps(1) infinite}.tw2{animation:tw 2.6s steps(1) -1.3s infinite}' +
    '@keyframes tw{0%,58%{opacity:1}59%,100%{opacity:0}}' +
    '.sh{animation:sh .8s steps(1) infinite}@keyframes sh{50%{opacity:0}}',
  draw() {
    const cv = new Canvas(W, H);
    cv.use(B, K, P, A);
    const R = rng(42);
    const tw = cv.layer('tw'), tw2 = cv.layer('tw2'), shim = cv.layer('sh');

    // ---- galaxy: two nebula arms swirling out from behind the portal --------------------------------
    const I = new Float32Array(W * H), T = new Float32Array(W * H), S = new Int8Array(W * H);
    let neb = cv.mask();
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const [i, t, side] = armAt(x, y), n = vnoise(x, y, 9, 3) * 0.65 + vnoise(x, y, 4, 9) * 0.35, k = y * W + x;
      const u = (x + 0.5 - CX) / 112, v = (y + 0.5 - CY) / 73, rs = (Math.abs(u) ** 4 + Math.abs(v) ** 4) ** 0.25;
      const bulge = clamp((1.12 - rs) / 0.12) * 0.3; // dim galactic glow hugging the portal
      I[k] = Math.max(i, bulge) + (n - 0.5) * 0.36; T[k] = i > bulge ? t : 0.9; S[k] = side;
      if (I[k] > 0.08) neb.put(x, y);
    }
    neb = blobs(neb.erode(1).dilate(1).dilate(1).erode(1), 80); // tidy specks, pinholes and stray puffs
    const NEB = [B[1], B[2], B[3], B[4], B[5], B[6], B[7]];
    cv.fill(neb, (x, y) => {
      const k = y * W + x, lit = (-(x - CX) * 0.5 - (y - CY)) * 0.0016; // light from the top-left
      const v = clamp((I[k] - 0.08) / 0.62 * (1.1 - T[k] * 0.4) + lit) * (NEB.length - 1), i = Math.floor(v);
      const f = clamp((v - i - 0.5) / 0.55 + 0.5); // dither only around each band edge
      return NEB[Math.min(NEB.length - 1, i + (f > bayer(x, y) ? 1 : 0))];
    });
    // Dust lane hugging the inner side of each arm.
    cv.fill(neb.and(cv.mask().plot((x, y) => { const k = y * W + x; return S[k] < 0 && I[k] > 0.18 && I[k] < 0.34 && T[k] < 0.75; })), B[2]);
    // Cel: hard core-shadow band on the lower-right of every cloud, a lit rim on the upper-left.
    const nebCore = neb.sub(neb.shift(-3, -3));
    cv.fill(nebCore, (x, y, c) => (c === B[1] || c === B[2] ? B[0] : B[1]));
    cv.fill(neb.sub(neb.shift(1, 1)).sub(nebCore), B[6]);
    cv.outline(INK, neb, { all: true });

    // Star dust along the bright ridges, plus a few clusters with twinkles.
    const inner = neb.erode(2);
    for (let i = 0; i < 260; i++) {
      const x = Math.floor(R() * W), y = Math.floor(R() * H);
      if (inner.has(x, y) && I[y * W + x] > 0.35) cv.set(x, y, R() < 0.45 ? WHITE : B[8]);
    }
    const clusters = [[30, 70], [116, 14], [12, 120], [292, 132], [200, 190], [306, 84]];
    clusters.forEach(([cx, cy], k) => {
      for (let i = 0; i < 8; i++) {
        const a = R() * 6.283, d = 1.5 + R() * 5;
        const x = Math.round(cx + Math.cos(a) * d), y = Math.round(cy + Math.sin(a) * d * 0.8);
        if (inner.has(x, y)) cv.set(x, y, R() < 0.5 ? WHITE : B[8]);
      }
      if (inner.has(cx, cy)) sparkle(k % 2 ? tw : tw2, cx, cy, 1, B[8], WHITE);
    });

    // Distant pixel galaxies.
    const tiny = ['...cbb...', '.cb..wb..', 'b..bwwb.b', '..bw..bc.', '...bbc...'];
    for (const [gx, gy] of [[6, 190], [222, 196], [178, 2]]) {
      tiny.forEach((row, j) => [...row].forEach((ch, i) => {
        const c = { b: B[6], c: B[5], w: WHITE }[ch];
        if (c) cv.set(gx + i, gy + j, c);
      }));
    }

    // Far-off sun (upper-left): amber disc with a ring of rays.
    const sun = cv.mask().circle(17, 17, 5);
    cv.glow(cv.mask().circle(17, 17, 12).sub(sun), 17.5, 17.5, 13, 2);
    cel(cv, sun, [A[4], A[3], A[2]], { shadow: A[1], k: 2, hi: A[5], drop: false });
    cv.px([[15, 14], [14, 15]], WHITE);
    for (const [dx, dy] of [[0, -9], [0, 9], [-9, 0], [9, 0], [0, -8], [0, 8], [-8, 0], [8, 0]]) cv.set(17 + dx, 17 + dy, A[3]);
    for (const [dx, dy] of [[-6, -6], [6, -6], [-6, 6], [6, 6]]) cv.set(17 + dx, 17 + dy, A[2]);

    // ---- cosmic-metal portal -----------------------------------------------------------------------
    const frame = cv.mask().rrect(52, 32, 216, 139, 14);
    const crest = cv.mask().poly([[134, 33], [148, 25], [160, 18], [172, 25], [186, 33]]);
    const pend = cv.mask().poly([[138, 170], [182, 170], [172, 178], [148, 178]]);
    const mounts = cv.mask().rrect(45, 88, 12, 27, 5).or(cv.mask().rrect(263, 88, 12, 27, 5));
    const medals = [[56, 36], [263, 36], [56, 166], [263, 166]].reduce((m, [x, y]) => m.circle(x, y, 8), cv.mask());
    const body = frame.or(crest).or(pend).or(mounts).or(medals);
    cv.cast(body.dilate(1), 1, 2, -2);
    cel(cv, body, [B[7], B[6], B[5], B[4], B[3]], { shadow: B[2], k: 4, hi: B[8], drop: false, soft: 0.5 });
    // Glowing seam: a groove 4px in from the outer edge, lit cyan.
    const seam = cv.mask().rrect(56, 36, 208, 131, 10).edge();
    cv.fill(seam, (x, y) => (x + y < 230 ? K[3] : K[2]));
    cv.fill(seam.shift(1, 1).sub(seam).and(frame.erode(5)), B[2]);
    // Anime gloss: sliver on the top-left, streak along the top.
    arc(cv, 72, 52, 15, 15, 200, 250, WHITE, frame.erode(2).sub(seam));
    cv.rect(94, 34, 30, 1, WHITE).rect(127, 34, 4, 1, WHITE).rect(54, 74, 1, 12, B[8]);

    // Raised ice lip, then the deep starry well sloping down to the screen.
    const lip = cv.mask().rrect(62, 42, 196, 119, 12);
    cel(cv, lip, [B[8], B[7], B[6]], { shadow: B[4], k: 2, hi: WHITE });
    const well = cv.mask().rrect(65, 45, 190, 113, 10);
    cv.grad(well, [B[2], B[1], B[1], B[0]], { soft: 0.8 });
    cv.fill(well.sub(well.shift(2, 2)), B[0]);
    cv.fill(well.sub(well.shift(-1, -1)), B[3]);
    cv.outline(INK, well, { all: true });
    inset(cv, ...HOLE, HR, { rim: INK, top: B[0], left: B[0], bottom: B[2], right: B[2] }, 2);

    // Corner medallions: a recessed orbit ring around a star gem.
    for (const [x, y] of [[56, 36], [263, 36], [56, 166], [263, 166]]) {
      const ring = cv.mask().circle(x, y, 6).sub(cv.mask().circle(x, y, 5));
      cv.fill(ring, (px, py) => (px + py < x + y ? B[2] : B[7]));
      const g = cv.mask().circle(x, y, 3);
      cv.fill(g, K[2]).fill(g.sub(g.shift(1, 1)), K[4]).fill(g.sub(g.shift(-1, -1)), K[1]);
      cv.outline(INK, g, { all: true });
      cv.set(x - 1, y - 1, WHITE);
      cv.outline(INK, cv.mask().circle(x, y, 8), {});
    }
    // Crest star gem and side diamonds.
    const cs = star(cv, 160, 27, 6.5, 3, 0);
    cv.cast(cs.dilate(1), 1, 1, -2);
    cv.grad(cs, [K[4], K[3], K[2]], { dir: { cx: 157, cy: 23, r: 10 }, soft: 0.6 });
    cv.fill(cs.sub(cs.shift(-2, -2)), K[1]);
    cv.outline(INK, cs, { all: true });
    cv.px([[158, 24], [159, 24], [158, 25]], WHITE);
    gem(cv, 50, 101, 3, 8);
    gem(cv, 269, 101, 3, 8);
    // Crescent moon pendant.
    const moon = cv.mask().circle(160, 173, 4).sub(cv.mask().circle(162, 171, 4));
    cv.fill(moon, B[8]).fill(moon.sub(moon.shift(-1, -1)), B[6]);
    cv.outline(INK, moon, { all: true });

    // ---- ringed gas giant (lower-right) ------------------------------------------------------------
    const PX = 294, PY = 180, PR = 17, tilt = -0.26;
    const ringAt = (lo, hi) => cv.mask().plot((x, y) => {
      const u = x + 0.5 - PX, v = y + 0.5 - PY, a = u * Math.cos(tilt) + v * Math.sin(tilt), b = -u * Math.sin(tilt) + v * Math.cos(tilt);
      const d = (a / 28) ** 2 + (b / 7) ** 2;
      return d >= lo && d <= hi;
    });
    const ring = ringAt(0.55, 1), gap = ringAt(0.74, 0.82);
    const planet = cv.mask().circle(PX, PY, PR);
    const above = cv.mask().plot((x, y) => (y + 0.5 - PY) - (x + 0.5 - PX) * Math.tan(tilt) < 0);
    const backRing = ring.and(above), frontRing = ring.sub(above);
    cv.fill(backRing, (x, y) => (gap.has(x, y) ? B[3] : B[6]));
    cv.outline(INK, backRing, { all: true });
    cv.cast(planet.dilate(1), 1, 1, -1);
    cv.grad(planet, [B[8], B[7], B[6], B[5], B[4]], { dir: { cx: PX - 9, cy: PY - 11, r: 34 }, soft: 0.5 });
    cv.fill(planet, (x, y, c) => (Math.floor((y + 1.6 * Math.sin(x / 4)) / 5) % 2 ? cv.step(c, -1) : c)); // cloud bands
    cv.fill(planet.sub(planet.shift(-5, -5)), B[3]);
    cv.fill(planet.sub(planet.shift(-2, -2)), B[2]);
    cv.outline(INK, planet, { all: true });
    arc(cv, PX, PY, PR - 3, PR - 3, 196, 250, WHITE, planet.erode(1));
    cv.set(PX - 10, PY - 1, B[8]);
    cv.fill(frontRing.shift(0, 1).sub(frontRing).and(planet.erode(1)), B[2]); // ring shadow on the planet
    cv.fill(frontRing, (x, y) => (gap.has(x, y) ? B[4] : x < PX ? B[8] : B[7]));
    cv.outline(INK, frontRing, {});
    cv.fill(frontRing.ring().and(planet.erode(1)), INK);

    // ---- tethered astronaut (left), waving -----------------------------------------------------------
    const ax = 18, ay = 112;
    for (let t = 0; t <= 1; t += 0.01) { // tether sagging from the left gem to the belt
      const x = Math.round((1 - t) ** 2 * 47 + 2 * (1 - t) * t * 44 + t * t * (ax + 14));
      const y = Math.round((1 - t) ** 2 * 107 + 2 * (1 - t) * t * 134 + t * t * (ay + 13));
      cv.set(x, y + 1, INK).set(x, y, P[4]);
    }
    const helmet = cv.mask().circle(ax + 9, ay + 5, 5);
    const pack = cv.mask().rrect(ax + 4, ay + 9, 11, 6, 2);
    const suit = cv.mask().rrect(ax + 5, ay + 9, 9, 8, 3);
    const legs = cv.mask().rrect(ax + 6, ay + 15, 3, 4, 1).or(cv.mask().rrect(ax + 10, ay + 15, 3, 5, 1));
    const wave = cv.mask().capsule(ax + 5, ay + 11, ax + 1, ay + 6, 1.1).or(cv.mask().circle(ax + 1, ay + 4, 1, 1.6));
    const hang = cv.mask().capsule(ax + 13, ay + 11, ax + 15, ay + 14, 1.1);
    const astro = helmet.or(pack).or(suit).or(legs).or(wave).or(hang);
    cv.cast(astro.dilate(1), 1, 1, -1);
    cv.fill(astro, P[4]);
    cv.fill(pack.sub(suit), P[2]);
    cv.fill(astro.sub(astro.shift(-2, -2)), P[2]);
    cv.fill(astro.sub(astro.shift(1, 1)), P[5]);
    cv.outline(INK, astro, { all: true });
    const visor = cv.mask().oval(ax + 6, ay + 2, 7, 6);
    cv.fill(visor, B[1]).fill(visor.sub(visor.shift(0, -2)), B[3]);
    cv.outline(INK, visor, { all: true });
    cv.px([[ax + 7, ay + 3], [ax + 8, ay + 3]], WHITE); // visor glint
    cv.px([[ax + 8, ay + 5], [ax + 11, ay + 5]], K[3]); // happy little eyes
    cv.set(ax + 9, ay + 12, K[3]).set(ax + 10, ay + 12, B[5]); // chest light

    // ---- comet across the top ----------------------------------------------------------------------
    const hx = 274, hy = 18, ex = 98, ey = 9, L = Math.hypot(hx - ex, hy - ey), ux = (ex - hx) / L, uy = (ey - hy) / L;
    const at = (x, y) => {
      const px = x + 0.5 - hx, py = y + 0.5 - hy, s = (px * ux + py * uy) / L;
      const bow = Math.sin(s * Math.PI) * 4; // gentle arc, bowing upward
      const d = Math.abs(-px * uy + py * ux + bow), w = 5 * (1 - s) ** 0.9 + 0.7;
      return { s, c: d / w };
    };
    const tail = cv.mask().plot((x, y) => {
      const { s, c } = at(x, y);
      return s > 0 && s < 1 && c <= 1 && (c < 0.55 || bayer(x, y) < 1.4 - s * 1.2) && bayer(x, y) < 1.6 - s * 1.5;
    }, ex - 2, 0, hx + 2, hy + 9);
    cv.fill(tail, (x, y) => {
      const { s, c } = at(x, y);
      if (s < 0.08) return c < 0.5 ? A[5] : A[3];
      if (s < 0.2) return c < 0.45 ? (bayer(x, y) < (s - 0.08) / 0.12 ? WHITE : A[4]) : (bayer(x, y) < 0.5 ? A[3] : K[3]);
      return c < 0.3 ? WHITE : c < 0.65 ? K[3] : B[6];
    });
    tail.each((x, y) => { if ((x * 3 + y * 7) % 11 === 0) shim.set(x, y, at(x, y).c < 0.5 ? K[3] : WHITE); });
    const head = cv.mask().circle(hx, hy, 5);
    cv.glow(cv.mask().circle(hx, hy, 10).sub(head), hx + 0.5, hy + 0.5, 11, 2);
    cel(cv, head, [A[5], A[4], A[3], A[2]], { shadow: A[1], k: 2, drop: false, dir: { cx: hx - 3, cy: hy - 3, r: 10 } });
    cv.px([[hx - 2, hy - 3], [hx - 3, hy - 2], [hx - 2, hy - 2]], WHITE);

    // Extra twinkles in the gaps.
    sparkle(tw2, 304, 22, 2, B[7], WHITE);
    sparkle(tw, 236, 186, 1, B[7], WHITE);
    sparkle(tw2, 40, 190, 1, B[7], WHITE);

    return cv.punch(...HOLE, HR);
  },
};
