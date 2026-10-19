// Blue Cel cyberpunk kiosk: a rain-slick hacked arcade terminal bolted to an alley wall, drawn like a
// cel-shaded anime still. Dithered cobalt-to-cyan armour with hard core-shadow bands and ice glints, a
// chunky navy bezel with a hot-pink neon trim, a vertical KAYBORO neon sign and a glyph strip, a
// flickering holo-ad, a satellite dish, a jury-rigged antenna, a docked drone, a card slot and keypad,
// stickers, bundled cables snaking off the edges and rain drips. One warm family: hot magenta neon.
import { Canvas, bayer } from '../pixel.mjs';
import { INK, inset, sparkle, sticker, SHAPES } from '../kit.mjs';

const W = 304, H = 224, HOLE = [56, 50, 192, 108], HR = 4; // 16:9
// navy -> cobalt -> azure -> cyan -> ice (shared with px-cel-crt)
const B = ['#0a1140', '#111d68', '#18308f', '#2149bb', '#2d6ade', '#4790f2', '#6cb8fd', '#a3dfff', '#e0f6ff'];
const K = ['#04263a', '#0a4560', '#1fb2dc', '#7eefff', '#e6feff']; // cyan holo / lcd
const N = ['#3d0a35', '#7c1260', '#c71f8a', '#ff3fae', '#ff8fd2', '#ffe0f3']; // the one warm accent: hot magenta neon
const WHITE = '#ffffff';

/**
 * Cel-shade a volume: dithered vertical gradient (top -> bottom colors), one hard flat core-shadow
 * band on the lower right, a 1px lit top-left edge, ink outline and a 1px drop shadow.
 */
function cel(cv, m, grad, { shadow, k = 3, hi, rim, drop = true, ink = true, soft = 0.6, from, to } = {}) {
  if (drop) cv.cast(m.dilate(1), 1, 1, -1);
  if (grad.length > 1) cv.grad(m, grad, { soft, from, to }); else cv.fill(m, grad[0]);
  const core = m.sub(m.shift(-k, -k));
  if (shadow) cv.fill(core, shadow);
  if (rim) cv.fill(m.sub(m.shift(-1, 0)).and(core).sub(m.sub(m.shift(0, -1))), rim);
  if (hi) cv.fill(m.sub(m.shift(1, 1)).sub(core), hi);
  if (ink) cv.outline(INK, m, { all: true });
  return core;
}
/** Chamfered rectangle (45 degree cut corners, c = cut size or [tl, tr, br, bl]). */
function chamfer(cv, x, y, w, h, c) {
  const [a, b, d, e] = Array.isArray(c) ? c : [c, c, c, c];
  return cv.mask().poly([[x + a, y], [x + w - b, y], [x + w, y + b], [x + w, y + h - d], [x + w - d, y + h], [x + e, y + h], [x, y + h - e], [x, y + a]]);
}
/** Rotated ellipse mask (angle in degrees). */
function rotOval(cv, cx, cy, a, b, deg) {
  const t = (deg * Math.PI) / 180, c = Math.cos(t), s = Math.sin(t);
  return cv.mask().plot((x, y) => {
    const dx = x + 0.5 - cx, dy = y + 0.5 - cy, u = dx * c + dy * s, v = -dx * s + dy * c;
    return (u / a) ** 2 + (v / b) ** 2 <= 1;
  });
}
/** Thick cable along a cubic bezier. */
function cableMask(cv, p0, p1, p2, p3, r) {
  let m = cv.mask(), prev = p0;
  for (let i = 1; i <= 40; i++) {
    const t = i / 40, u = 1 - t;
    const q = [0, 1].map((k) => u * u * u * p0[k] + 3 * u * u * t * p1[k] + 3 * u * t * t * p2[k] + t * t * t * p3[k]);
    m = m.or(cv.mask().capsule(Math.round(prev[0]), Math.round(prev[1]), Math.round(q[0]), Math.round(q[1]), r));
    prev = q;
  }
  return m;
}
function cable(cv, m, R) {
  cv.cast(m.dilate(1), 1, 1, -1);
  cv.fill(m, R[2]);
  cv.fill(m.sub(m.shift(-1, -1)), R[1]);
  cv.fill(m.sub(m.shift(1, 1)), R[3]);
  cv.outline(INK, m, { all: true });
}
/** Water drop (3x4) with a lit glint, ink outlined. */
function drop(cv, x, y) {
  const m = cv.mask().pts([[x + 1, y], [x + 1, y + 1], [x, y + 2], [x + 1, y + 2], [x + 2, y + 2], [x, y + 3], [x + 1, y + 3], [x + 2, y + 3]]);
  cv.outline(INK, m, { all: true });
  cv.fill(m, B[6]).set(x + 1, y, B[8]).set(x, y + 2, WHITE).set(x + 2, y + 3, B[4]).set(x + 1, y + 3, B[5]);
}

export default {
  id: 'px-cel-cyberpunk', name: 'Neon Alley', theme: 'cyberpunk', rarity: 'epic', translucent: false,
  collection: 'blue-cel', license: 'CC-BY-4.0',
  desc: 'A hacked street-corner arcade kiosk humming with pink neon, dripping with rain and guarded by a sleepy little drone.',
  tags: ['cyberpunk', 'neon', 'cel-shaded', 'blue', 'animated', 'widescreen'],
  css: '.nf{animation:nf 3.2s steps(1) infinite}@keyframes nf{0%,84%{opacity:0}85%,87%{opacity:1}88%,90%{opacity:0}91%,93%{opacity:1}94%,100%{opacity:0}}' +
    '.hg{animation:hg 2.6s steps(1) infinite}@keyframes hg{0%,71%{opacity:0}72%,76%{opacity:1}77%,100%{opacity:0}}' +
    '.ra{animation:ra .9s steps(1) infinite}.rb{animation:ra .9s steps(1) -.45s infinite}@keyframes ra{50%{opacity:0}}' +
    '.blink{animation:bl 1.4s steps(1) infinite}@keyframes bl{50%{opacity:0}}',
  draw() {
    const cv = new Canvas(W, H);
    cv.use(B, K, N);

    // Housing silhouette (chamfered armour box).
    const body = chamfer(cv, 26, 32, 252, 168, 12);

    // Shadow cast on the wall behind, down-right (dithered, fully opaque pixels).
    const wall = body.shift(5, 6).sub(body);
    cv.fill(wall, (x, y) => (bayer(x, y) < 0.55 ? INK : undefined));

    // Cables snaking off the right and bottom edges (behind the housing), with a sign power cord.
    const CB = [B[0], B[2], B[4], B[6]], CN = [N[0], N[1], N[3], N[4]], CK = [K[0], K[1], K[2], K[3]];
    const k1 = cableMask(cv, [252, 196], [256, 204], [262, 205], [270, 205], 1.6).or(cableMask(cv, [270, 205], [280, 205], [290, 194], [306, 190], 1.6));
    const k2 = cableMask(cv, [246, 196], [246, 211], [258, 214], [270, 214], 1.8).or(cableMask(cv, [270, 214], [284, 214], [292, 222], [298, 228], 1.8));
    const k3 = cableMask(cv, [238, 196], [238, 206], [256, 209], [270, 209], 2.2).or(cableMask(cv, [270, 209], [284, 209], [294, 206], [306, 206], 2.2));
    const cables = k1.or(k2).or(k3);
    cable(cv, k3, CB); cable(cv, k1, CK); cable(cv, k2, CN);
    cable(cv, cableMask(cv, [74, 196], [70, 216], [44, 210], [34, 228], 2.4), CB);
    cable(cv, cableMask(cv, [14, 156], [12, 186], [26, 196], [16, 228], 1.2), CN);
    // Main housing: dithered cobalt-to-cyan gradient, hard core-shadow band, ice gloss.
    cel(cv, body, [B[7], B[6], B[5], B[4], B[3]], { shadow: B[2], k: 7, hi: B[8], rim: B[4], soft: 0.5 });
    // Armour plate seams + rivets.
    for (const y of [44, 186]) {
      cv.fill(body.erode(3).and(cv.mask().rect(0, y, W, 1)), B[2]);
      cv.fill(body.erode(3).and(cv.mask().rect(0, y + 1, W, 1)), B[7]);
    }
    for (const [x, y] of [[33, 38], [268, 38], [33, 191], [268, 191]]) {
      cv.rect(x, y, 3, 3, B[2]).set(x, y, B[8]).set(x + 1, y + 1, B[5]).set(x + 2, y + 2, B[1]);
    }
    // Side vents.
    for (const vx of [32, 266]) for (let j = 0; j < 6; j++) {
      cv.rect(vx, 100 + j * 4, 7, 2, B[1]).rect(vx, 100 + j * 4, 7, 1, INK).rect(vx + 1, 102 + j * 4, 6, 1, B[6]);
    }
    // Anime gloss sliver hugging the top-left chamfer + streaks.
    cv.fill(cv.mask().line(29, 46, 39, 36), WHITE).fill(cv.mask().line(30, 49, 30, 49), B[8]);
    cv.rect(44, 34, 30, 1, WHITE).rect(78, 34, 5, 1, WHITE).rect(87, 34, 1, 1, WHITE);
    cv.rect(28, 52, 1, 30, B[8]).rect(28, 86, 1, 3, B[8]);

    // Chunky navy bezel with a hot-pink neon trim, recessed into the glass.
    const bezel = chamfer(cv, HOLE[0] - 12, HOLE[1] - 10, HOLE[2] + 24, HOLE[3] + 22, 8);
    cel(cv, bezel, [B[3], B[2], B[1]], { shadow: B[0], k: 3, hi: B[5], soft: 0.8 });
    const trim = chamfer(cv, HOLE[0] - 9, HOLE[1] - 7, HOLE[2] + 18, HOLE[3] + 16, 6);
    const trimLine = trim.edge(true);
    cv.fill(trimLine, N[3]);
    cv.fill(trimLine.and(cv.mask().rect(0, 0, W, HOLE[1] - 5)).or(trimLine.and(cv.mask().rect(0, 0, HOLE[0] - 7, H))), N[4]);
    cv.fill(trim.erode(1), B[1]);
    inset(cv, ...HOLE, HR, { rim: INK, top: B[0], left: B[0], bottom: B[3], right: B[2] }, 2);
    // Ice specular slivers on the bezel's top-left chamfer.
    cv.fill(cv.mask().line(45, 48, 51, 42), WHITE).rect(53, 41, 16, 1, B[6]).rect(72, 41, 3, 1, B[6]);
    // Glass glints on the inner lip, kept clear of the opening.
    cv.rect(HOLE[0] - 5, HOLE[1] - 5, 12, 1, B[5]).rect(HOLE[0] + 10, HOLE[1] - 5, 3, 1, B[5]);
    cv.rect(HOLE[0] - 5, HOLE[1] - 2, 1, 10, B[4]);

    // Holo-ad header bolted on top.
    const hb = chamfer(cv, 100, 8, 104, 30, [6, 6, 0, 0]);
    cel(cv, hb, [B[6], B[5], B[4]], { shadow: B[3], k: 3, hi: B[8] });
    const hs = cv.mask().rect(105, 13, 94, 18);
    cv.fill(hs, (x, y) => (y % 2 ? K[0] : B[0]));
    cv.fill(hs.sub(hs.shift(1, 1)), INK);
    cv.fill(hs.sub(hs.shift(-1, -1)), B[3]);
    const heart = ['.##.##.', '#######', '#######', '.#####.', '..###..', '...#...'];
    heart.forEach((row, j) => [...row].forEach((c, i) => { if (c === '#') cv.set(109 + i, 16 + j, j < 2 && i < 3 ? N[5] : N[3]); }));
    cv.text('INSERT COIN', 119, 16, N[4]);
    cv.text('1P PUSH', 119, 23, K[3]);
    for (const [gx, gw] of [[150, 4], [156, 2], [160, 6], [168, 3]]) cv.rect(gx, 24, gw, 3, K[2]);
    for (let j = 0; j < 3; j++) cv.rect(176 + j * 6, 16 + j * 3, 18 - j * 6, 2, j === 1 ? N[3] : K[3]);
    // glitch frame: a slice jumps sideways
    const hg = cv.layer('hg');
    hg.rect(106, 22, 92, 4, K[0]);
    hg.text('1P PUSH', 123, 23, N[3]);
    hg.rect(106, 22, 2, 4, K[3]).rect(190, 22, 6, 1, K[4]);
    // emitter feet
    for (const x of [108, 190]) cel(cv, cv.mask().rect(x, 36, 6, 3), [B[3]], { shadow: B[1], k: 1, drop: false });

    // Satellite dish on a mast, top-left.
    const mast = cv.mask().rect(54, 18, 3, 16);
    cel(cv, mast, [B[5], B[3]], { shadow: B[2], k: 1, hi: B[7] });
    const base = chamfer(cv, 48, 28, 16, 6, [2, 2, 0, 0]);
    cel(cv, base, [B[5], B[4]], { shadow: B[2], k: 2, hi: B[8] });
    const back = rotOval(cv, 50, 15, 16, 6, -40);
    const face = rotOval(cv, 48.5, 13.5, 14, 4.6, -40);
    cv.cast(back.dilate(1), 1, 1, -1);
    cv.fill(back, B[3]);
    cv.fill(back.sub(back.shift(-2, -2)), B[2]);
    cv.grad(face, [B[8], B[7], B[6]], { dir: { cx: 40, cy: 8, r: 22 }, soft: 0.6 });
    cv.fill(face.sub(face.shift(-2, -2)).and(face), B[5]);
    cv.outline(INK, back.or(face), { all: true });
    const arm = cv.mask().line(47, 12, 41, 6);
    cv.outline(INK, arm, { diag: true });
    cv.fill(arm, B[2]).fill(arm.and(rotOval(cv, 48.5, 13.5, 14, 4.6, -40).not()), B[6]);
    const horn = cv.mask().rect(38, 3, 4, 4).sub(cv.mask().pts([[38, 3]]));
    cv.outline(INK, horn, { all: true });
    cv.fill(horn, N[3]).set(39, 3, N[5]).set(38, 4, N[5]).set(41, 6, N[1]);
    // tape wrap on the mast
    cv.rect(54, 24, 3, 2, N[2]).set(54, 24, N[4]);

    // Jury-rigged antenna, top-right, with taped joints and a blinking tip.
    const mastA = cv.mask().rect(262, 7, 2, 26);
    const wire1 = cv.mask().line(264, 22, 272, 14), wire2 = cv.mask().line(261, 15, 255, 9);
    cv.outline(INK, mastA.or(wire1).or(wire2), { all: true });
    cv.fill(wire1, B[6]).fill(wire2, B[6]).set(272, 14, B[8]).set(255, 9, B[8]);
    cv.fill(mastA, B[4]).rect(262, 7, 1, 26, B[7]);
    for (const y of [15, 25]) { const t = cv.mask().rect(260, y, 6, 3); cv.fill(t, N[2]); cv.rect(260, y, 6, 1, N[4]); cv.outline(INK, t, { all: true }); }
    const tip = cv.mask().circle(262, 4, 2).or(cv.mask().circle(263, 4, 2));
    cv.fill(tip, N[1]); cv.outline(INK, tip, { all: true });
    const bl = cv.layer('blink');
    bl.fill(tip, N[3]).set(261, 3, N[5]).set(262, 3, N[5]);

    // Docked drone, top-right of the holo panel.
    const dock = chamfer(cv, 214, 27, 34, 6, [2, 2, 0, 0]);
    cel(cv, dock, [B[4], B[3]], { shadow: B[2], k: 1, hi: B[7] });
    const arms = cv.mask().rect(212, 15, 38, 3);
    cel(cv, arms, [B[4]], { shadow: B[2], k: 1, hi: B[7] });
    for (const x of [208, 242]) {
      const prop = cv.mask().rect(x, 11, 12, 2);
      cv.fill(prop, B[7]); cv.set(x, 11, WHITE);
      cv.outline(INK, prop, { all: true });
      cv.rect(x + 5, 13, 2, 3, B[2]);
    }
    const dr = cv.mask().oval(219, 12, 24, 17);
    cel(cv, dr, [B[8], B[7], B[6], B[5]], { shadow: B[4], k: 3, hi: WHITE });
    const eye = cv.mask().oval(225, 17, 12, 9);
    cv.fill(eye, INK);
    const lens = cv.mask().oval(227, 18, 8, 7);
    cv.grad(lens, [K[4], K[3], K[2]], { soft: 0.6 });
    cv.rect(230, 20, 2, 3, INK).set(229, 19, WHITE);
    cv.set(221, 24, N[4]).set(240, 24, N[4]);
    cv.px([[223, 14], [224, 13], [225, 13]], WHITE);

    // Vertical KAYBORO neon sign on the left, hung on brackets.
    const sign = chamfer(cv, 4, 52, 20, 104, 3);
    for (const y of [62, 140]) cel(cv, cv.mask().rect(23, y, 5, 4), [B[4], B[3]], { shadow: B[2], k: 1, hi: B[7] });
    cel(cv, sign, [B[1]], { shadow: B[0], k: 2, hi: B[3] });
    let letters = cv.mask();
    [...'KAYBORO'].forEach((ch, i) => { letters = letters.or(cv.textMask(ch, 11, 60 + i * 13, { font: 3, scale: 2 })); });
    cv.fill(letters.dilate(2, true).and(sign.erode(1)), (x, y) => (bayer(x, y) < 0.5 ? N[0] : undefined));
    cv.fill(letters.dilate(1, true).and(sign.erode(1)), N[1]);
    cv.fill(letters, N[3]);
    cv.fill(letters.sub(letters.shift(1, 1)), N[5]);
    const nf = cv.layer('nf');
    const dim = cv.textMask('Y', 11, 86, { font: 3, scale: 2 }).or(cv.textMask('B', 11, 99, { font: 3, scale: 2 }));
    nf.fill(dim.dilate(1, true), B[0]);
    nf.fill(dim, N[1]);
    for (const y of [52, 155]) { const cap = cv.mask().rect(6, y, 16, 2); cv.fill(cap, B[5]); cv.fill(cap.and(cv.mask().rect(0, y, W, 1)), B[7]); cv.outline(INK, cap, { all: true }); }

    // Glyph strip on the right (abstract shapes in cyan neon).
    const gs = chamfer(cv, 280, 46, 18, 92, 3);
    for (const y of [56, 124]) cel(cv, cv.mask().rect(276, y, 5, 4), [B[4], B[3]], { shadow: B[2], k: 1, hi: B[7] });
    cel(cv, gs, [B[1]], { shadow: B[0], k: 2, hi: B[3] });
    const glyphs = [
      ['.###.', '#...#', '#...#', '#...#', '.###.'],
      ['..#..', '.#.#.', '#...#', '#####', '.....'],
      ['#####', '.....', '#####', '.....', '#####'],
      ['..#..', '.###.', '#####', '.###.', '..#..'],
      ['#...#', '.#.#.', '..#..', '.#.#.', '#...#'],
      ['##.##', '#...#', '.....', '#...#', '##.##'],
    ];
    glyphs.forEach((g, i) => {
      let gm = cv.mask();
      g.forEach((row, j) => [...row].forEach((c, k) => { if (c === '#') gm.put(286 + k, 54 + i * 13 + j); }));
      cv.fill(gm.dilate(1).and(gs.erode(1)).sub(gm), K[1]);
      cv.fill(gm, i === 3 ? N[3] : K[3]);
      gm.each((x, y) => { if (!gm.has(x - 1, y) && !gm.has(x, y - 1)) cv.set(x, y, i === 3 ? N[5] : K[4]); });
    });

    // Control deck under the screen: card-swipe slot, keypad, speaker, big push button.
    const deck = chamfer(cv, 50, 174, 204, 20, 4);
    cv.fill(deck, B[2]);
    cv.fill(deck.sub(deck.shift(1, 1)), B[1]);
    cv.fill(deck.sub(deck.shift(-1, -1)), B[5]);
    cv.outline(INK, deck, { all: true });
    // card reader
    const rd = chamfer(cv, 56, 177, 44, 14, 2);
    cel(cv, rd, [B[6], B[5], B[4]], { shadow: B[3], k: 2, hi: B[8], drop: false });
    cv.rect(60, 182, 36, 2, INK).rect(60, 184, 36, 1, B[7]);
    const card = cv.mask().rect(66, 172, 18, 10);
    cv.fill(card.and(cv.mask().rect(0, 0, W, 182)), (x, y) => (y < 175 ? N[4] : N[3]));
    cv.rect(66, 172, 18, 1, N[5]).rect(83, 173, 1, 9, N[2]);
    cv.rect(69, 175, 4, 3, K[3]).set(69, 175, K[4]);
    cv.outline(INK, card.and(cv.mask().rect(0, 0, W, 182)));
    cv.rect(65, 172, 1, 10, INK).rect(84, 172, 1, 10, INK).rect(66, 171, 18, 1, INK);
    cv.rect(90, 187, 3, 2, N[1]);
    led_(cv.layer('blink'), 90, 187);
    // keypad
    for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) {
      const x = 108 + c * 11, y = 177 + r * 5, key = cv.mask().rect(x, y, 9, 3);
      const pk = r === 2 && c === 3;
      cv.fill(key, pk ? N[3] : B[6]);
      cv.fill(key.and(cv.mask().rect(0, y, W, 1)), pk ? N[5] : B[8]);
      cv.rect(x, y + 3, 9, 1, pk ? N[1] : B[1]);
      cv.set(x - 1, y, INK).set(x + 9, y, INK);
    }
    // speaker slots
    for (let i = 0; i < 4; i++) cv.rect(158 + i * 6, 178, 3, 12, INK).rect(160 + i * 6, 179, 1, 11, B[4]);
    // big push button
    cv.fill(cv.mask().oval(204, 175, 44, 18).and(deck.erode(1)), B[1]);
    const pb = cv.mask().rrect(208, 176, 34, 12, 5);
    cel(cv, pb, [N[4], N[3], N[2]], { shadow: N[1], k: 2, hi: N[5] });
    cv.text('PUSH', 217, 180, N[0]);
    cv.px([[211, 178], [212, 177], [213, 177]], WHITE);

    // Grommets where the cable bundles leave the housing, and a cable tie on the right bundle.
    for (const [x, w] of [[232, 26], [66, 16]]) {
      const gm = chamfer(cv, x, 196, w, 5, [2, 2, 0, 0]);
      cel(cv, gm, [B[3], B[1]], { shadow: B[0], k: 1, hi: B[5] });
    }
    const tie = cv.mask().rect(270, 201, 3, 17).and(cables.dilate(1));
    cv.fill(tie, B[7]).fill(tie.and(cv.mask().rect(272, 0, 1, H)), B[5]).fill(tie.and(cv.mask().rect(270, 0, 1, H)), B[8]);
    cv.outline(INK, tie, { all: true });

    // Stickers bombed onto the armour.
    const st = sticker(cv, 33, 152, SHAPES.star, [B[3], K[2], K[3], K[4], WHITE], { border: WHITE });
    cv.outline(INK, st.dilate(1), { all: true });
    const ht = sticker(cv, 262, 150, SHAPES.heart, [N[0], N[1], N[2], N[3], N[4]], { border: WHITE });
    cv.outline(INK, ht.dilate(1), { all: true });
    const bolt = ['....###', '...###.', '..###..', '.######', '#######', '...###.', '..###..', '..##...', '.##....', '.#.....'];
    const bm = cv.mask();
    bolt.forEach((row, j) => [...row].forEach((c, i) => { if (c === '#') bm.put(265 + i, 56 + j); }));
    const bdie = bm.dilate(1);
    cv.cast(bdie, 1, 1, -2).fill(bdie, WHITE);
    cv.fill(bm, N[3]).fill(bm.sub(bm.shift(0, 1)), N[4]);
    cv.outline(INK, bdie, { all: true });
    const cat = ['#.....#', '##...##', '#######', '#######', '#######', '.#####.'];
    const ct = sticker(cv, 33, 128, cat, [N[1], N[2], N[3], N[4], N[5]], { border: WHITE });
    cv.outline(INK, ct.dilate(1), { all: true });
    cv.px([[35, 131], [39, 131]], INK).set(37, 132, N[1]);

    // Rain: drips running down the housing and hanging from its edges, streaks in the air.
    for (const [x, y0, l] of [[39, 50, 12], [272, 128, 10], [30, 166, 8]]) { cv.rect(x, y0, 1, l, B[8]).set(x, y0 - 1, B[7]); drop(cv, x - 1, y0 + l); }
    const occ = cv.opaque().dilate(2, true);
    const rain = (L, x, y, c) => { const m = cv.mask().line(x, y, x - 1, y + 3); if (!m.and(occ).bbox()) L.fill(m, c); };
    const ra = cv.layer('ra'), rb = cv.layer('rb');
    const pts = [[8, 8], [22, 24], [6, 40], [80, 6], [90, 22], [212, 2], [284, 14], [296, 28], [278, 2], [24, 4],
      [8, 172], [296, 150], [298, 176], [24, 206], [120, 210], [170, 214], [204, 208], [60, 214], [146, 4], [76, 32]];
    pts.forEach(([x, y], i) => {
      rain(ra, x, y, i % 3 ? B[6] : B[7]);
      rain(rb, x + 2, y + 6, i % 3 ? B[6] : B[7]);
      if (i % 4 === 0) rain(cv, x + 5, y + 2, B[3]);
    });
    sparkle(cv, 290, 6, 1, B[7], WHITE);
    sparkle(cv, 14, 36, 1, N[4], WHITE);

    cv.outline(INK);
    return cv.punch(...HOLE, HR);
  },
};

function led_(L, x, y) { L.rect(x, y, 3, 2, N[3]).set(x, y, N[5]); }
