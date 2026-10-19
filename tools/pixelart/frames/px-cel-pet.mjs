// Blue cel-shaded virtual pet: a wide gem-egg shell with a faceted crown and little fin ears, smooth
// dithered cobalt-to-cyan gradients under hard cel shadow bands, a pearl-blue LCD plate ringed with care
// icons, three round buttons, a speaker grille, a printed blob mascot and a ball chain with a gold star.
import { Canvas } from '../pixel.mjs';
import { INK, inset, sprite, spriteMask, sparkle } from '../kit.mjs';

const W = 184, H = 244, HOLE = [44, 78, 96, 96], HR = 4; // 1:1
const CX = 92, CY = 142;
const S = ['#0c1446', '#142673', '#1c3ca3', '#2457cc', '#2f7aea', '#45a0fb', '#69c4ff', '#a6e6ff', '#e4f9ff']; // shell navy -> ice
const P = ['#2c3d78', '#5670ae', '#8aa4da', '#b8cdf2', '#dce8fd', '#f6faff']; // pearl-blue plate
const B = ['#0f2f6e', '#1a5cb4', '#2f93e6', '#6cccff', '#c4f0ff', '#ffffff']; // buttons
const M = ['#252c52', '#4c5888', '#8693c0', '#c3cdec', '#f2f5ff']; // ball-chain metal
const Y = ['#7a4a10', '#c7861d', '#ffc23d', '#ffe38a', '#fff7d6']; // the one warm accent: star charm
const ICE = '#ffffff';

// Wide, slightly squashed gem-egg: a boxy superellipse, a touch flatter underneath.
const gem = (cv, a, bt, bb, p = 2.5, q = 2.3, d = 0) => cv.mask().plot((x, y) => {
  const u = (x + 0.5 - CX) / (a - d), dy = y + 0.5 - CY, v = dy / ((dy < 0 ? bt : bb) - d);
  return Math.abs(u) ** p + Math.abs(v) ** q <= 1;
});
// Cel shading: a hard-edged shadow crescent on the lower-right of a mask, lit crescent on the upper-left.
const celShadow = (cv, m, k, n = -1) => cv.tone(m.sub(m.shift(-k, -k)), n);
const celLight = (cv, m, k, c) => cv.fill(m.sub(m.shift(k, k)), c);
// 5-point star polygon.
const star = (cv, cx, cy, ro, ri, rot = 0) => cv.mask().poly(Array.from({ length: 10 }, (_, i) => {
  const a = rot - Math.PI / 2 + (i * Math.PI) / 5, r = i % 2 ? ri : ro;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
}));
// One chunky chain ball (4x4) with its own light.
const ball = (cv, x, y) => {
  const m = cv.mask().rrect(x, y, 4, 4, 1);
  cv.fill(m, M[2]).set(x + 1, y, M[3]).set(x, y + 1, M[3]).set(x + 1, y + 1, M[4]).set(x + 3, y + 2, M[1]).set(x + 2, y + 3, M[1]);
  return m;
};
// A bigger 5x5 bead for the charm chain.
const bead = (cv, x, y) => {
  const m = spriteMask(cv, x, y, ['.###.', '#####', '#####', '#####', '.###.']);
  cv.fill(m, M[2]).px([[x + 1, y + 1], [x + 2, y + 1], [x + 1, y + 2]], M[3]).set(x + 1, y + 1, M[4]);
  cv.px([[x + 3, y + 3], [x + 4, y + 2], [x + 2, y + 4], [x + 3, y + 4], [x + 4, y + 3]], M[1]);
  return m;
};

const ICONS = [
  ['.......', '..###.#', '.#.####', '#######', '.######', '..###.#', '.......'], // fish (food)
  ['..###..', '.#####.', '.##.##.', '.#####.', '..###..', '.......', '..###..'], // bulb (light)
  ['..###..', '.#####.', '##.#.##', '#######', '##.#.##', '.#####.', '..###..'], // ball (game)
  ['..###..', '..###..', '#######', '#######', '#######', '..###..', '..###..'], // cross (medicine)
  ['...#...', '..###..', '.#####.', '#.#####', '##.####', '#######', '.#####.'], // drop (bath)
  ['.##.##.', '#######', '#######', '#######', '.#####.', '..###..', '...#...'], // heart (love)
];

export default {
  id: 'px-cel-pet', name: 'Blue Cel Pet', theme: 'virtual-pet', rarity: 'rare', translucent: false,
  collection: 'blue-cel', license: 'CC-BY-4.0',
  desc: 'A cel-shaded blue pocket pet with fin ears, a gold star charm and a little heart that blinks while you play.',
  tags: ['virtual-pet', 'cel-shaded', 'blue', 'gradient', 'keychain', 'animated'],
  css: '.blink{animation:bl 1.6s steps(1) infinite}@keyframes bl{50%{opacity:0}}' +
    '.tw{animation:tw 2.4s steps(1) infinite}@keyframes tw{0%,62%{opacity:1}63%,100%{opacity:0}}',
  draw() {
    const cv = new Canvas(W, H);
    cv.use(S, P, B, M, Y);
    const light = { cx: 30, cy: 40, r: 230 }; // radial gradients fall away from the top-left

    // Fin ears, behind the shell.
    const finL = cv.mask().poly([[24, 100], [14, 90], [7, 76], [3, 60], [2, 46], [4, 42], [9, 45], [18, 51], [29, 56], [44, 60]]);
    const fins = finL.or(finL.mirror());
    cv.grad(fins, [S[6], S[5], S[4], S[3]], { dir: light, soft: 0.5 });
    celShadow(cv, fins, 4);
    celLight(cv, fins, 2, S[8]);
    for (const [x0, y0, x1, y1] of [[30, 76, 6, 50], [32, 70, 14, 53], [28, 84, 8, 66]]) { // fin rays
      cv.fill(cv.mask().line(x0, y0, x1, y1).and(finL.erode(2)), S[3]);
      cv.fill(cv.mask().line(W - 1 - x0, y0, W - 1 - x1, y1).and(finL.mirror().sub(finL).erode(2)), S[2]);
    }
    cv.outline(INK, fins, { all: true });

    // Shell: dithered radial gradient, then hard cel shadow bands and a lit rim.
    const body = gem(cv, 88, 100, 98);
    cv.outline(INK, body, { all: true });
    cv.grad(body, [S[7], S[6], S[5], S[4], S[3]], { dir: light, soft: 0.5 });
    celShadow(cv, body, 12);
    celShadow(cv, body, 4);
    celLight(cv, body, 3, S[7]);
    celLight(cv, body, 1, S[8]);
    // Anime specular: a sharp curved streak and glints on the upper-left shoulder.
    const streak = gem(cv, 88, 100, 98, 2.5, 2.3, 5).sub(gem(cv, 88, 100, 98, 2.5, 2.3, 9))
      .and(cv.mask().plot((x, y) => { const a = Math.atan2(y + 0.5 - CY, x + 0.5 - CX) * 180 / Math.PI; return a > -158 && a < -108; }));
    cv.fill(streak, ICE);
    cv.fill(streak.edge(), S[8]);
    sparkle(cv, 26, 92, 1, S[8], ICE);
    cv.set(34, 72, ICE).set(31, 80, ICE);

    // Faceted crown ridge with the loop nub.
    const crown = cv.mask().poly([[68, 55], [75, 44], [84, 37], [100, 37], [109, 44], [116, 55]]);
    cv.cast(crown.dilate(1), 1, 2, -2);
    cv.fill(crown, (x, y) => {
      const lx = 84 - (y - 44) * 0.4, rx = 100 + (y - 44) * 0.4;
      if (y < 44) return x < 84 ? S[8] : x > 100 ? S[4] : S[7];
      return x < lx ? S[6] : x > rx ? S[3] : S[5];
    });
    cv.fill(cv.mask().rect(70, 44, 44, 1).and(crown), S[2]);
    cv.fill(cv.mask().line(84, 45, 80, 54).or(cv.mask().line(100, 45, 104, 54)).and(crown), S[2]);
    cv.px([[87, 39], [88, 39], [87, 40]], ICE);
    cv.outline(INK, crown, { all: true });
    const nub = cv.mask().rrect(86, 28, 13, 9, [4, 4, 0, 0]);
    cv.shade(nub, S, { top: [8], left: [7], bottom: [3], right: [3], fill: 5 });
    cv.outline(INK, nub, { all: true });
    cv.rect(91, 30, 3, 3, INK);

    // Ball chain up to a chunky key ring.
    const ring = cv.mask().circle(92, 11, 9).sub(cv.mask().circle(92, 11, 5));
    cv.shade(ring, M, { top: [4], left: [3], bottom: [0], right: [1], fill: 2 });
    cv.fill(ring.and(cv.mask().rect(83, 15, 19, 6)), (x, y, c) => cv.step(c, -1));
    cv.set(86, 5, M[4]).set(87, 4, M[4]);
    cv.outline(INK, ring, { all: true });
    let chain = cv.mask();
    for (const [x, y] of [[91, 21], [91, 25]]) chain = chain.or(ball(cv, x, y));
    // Charm chain sagging under gravity from the ring down to the gold star resting on the shoulder.
    const C0 = [102, 17], C1 = [122, 26], NB = 6, links = [];
    const bc = Array.from({ length: NB }, (_, i) => {
      const t = i / (NB - 1);
      return [Math.round(C0[0] + (C1[0] - C0[0]) * t), Math.round(C0[1] + (C1[1] - C0[1]) * t + 3.2 * Math.sin(Math.PI * t))];
    });
    bc.forEach(([x, y], i) => {
      if (i) links.push([(x + bc[i - 1][0] + 1) >> 1, (y + bc[i - 1][1] + 1) >> 1]);
    });
    const linkM = cv.mask();
    for (const [x, y] of links) linkM.rect(x - 1, y - 1, 2, 2);
    cv.fill(linkM, M[1]);
    chain = chain.or(linkM);
    for (const [x, y] of bc) chain = chain.or(bead(cv, x - 2, y - 2));
    cv.outline(INK, chain);
    const SC = [123, 37], SROT = 0.12;
    const st = star(cv, SC[0], SC[1], 9.5, 4.4, SROT);
    cv.cast(st.dilate(1), 1, 2, -2);
    // Flat cel facets: each arm split along its centre line, the half facing the top-left light is lit.
    cv.fill(st, (x, y) => {
      const ph = Math.atan2(y + 0.5 - SC[1], x + 0.5 - SC[0]);
      let best = 0, bd = 9;
      for (let k = 0; k < 5; k++) {
        const a = SROT - Math.PI / 2 + (k * 2 * Math.PI) / 5;
        const d = Math.atan2(Math.sin(ph - a), Math.cos(ph - a));
        if (Math.abs(d) < Math.abs(bd)) { bd = d; best = a; }
      }
      const na = best + Math.sign(bd || 1) * Math.PI / 2;
      return -Math.cos(na) - Math.sin(na) > 0.15 ? Y[3] : Y[2];
    });
    celShadow(cv, st, 2);
    cv.outline(INK, st, { all: true });
    cv.px([[120, 33], [121, 33], [120, 34], [123, 30]], ICE);

    // Pearl-blue LCD plate, bevelled, with a recessed window and care icons above and below.
    const plate = cv.mask().rrect(30, 62, 124, 132, 14);
    cv.cast(plate.dilate(1), 1, 2, -2);
    cv.fill(plate, P[4]);
    celShadow(cv, plate, 4);
    celLight(cv, plate, 2, P[5]);
    cv.outline(INK, plate, { all: true });
    const bev = cv.mask().rrect(HOLE[0] - 5, HOLE[1] - 5, HOLE[2] + 10, HOLE[3] + 10, HR + 5);
    cv.fill(bev.edge(), (x, y) => (x + y < HOLE[0] + HOLE[1] + HOLE[2] ? P[1] : P[5]));
    inset(cv, ...HOLE, HR, { rim: INK, top: P[0], left: P[1], bottom: P[4], right: P[3] }, 3);
    ICONS.forEach((ic, i) => {
      const x = CX - 3 + ((i % 3) - 1) * 32, y = i < 3 ? 64 : 181;
      if (i === 5) {
        sprite(cv, x, y, ic, { '#': P[2] });
        const bl = cv.layer('blink');
        sprite(bl, x, y, ic, { '#': B[2] });
        bl.set(x + 1, y + 1, B[4]);
      } else sprite(cv, x, y, ic, { '#': P[1] });
    });

    // Speaker grille (lower-left): dot rings in a shallow recessed disc.
    const disc = cv.mask().circle(45, 207, 9);
    cv.shade(disc, S, { top: [1], left: [2], bottom: [6], right: [5], fill: 3 });
    for (const [dx, dy] of [[0, 0], [-4, -3], [0, -5], [4, -3], [4, 3], [0, 5], [-4, 3], [-7, 0], [7, 0]]) {
      cv.rect(44 + dx, 206 + dy, 2, 2, INK).set(45 + dx, 207 + dy, S[0]);
    }

    // Three round cel buttons on a smile, the middle one a little lower.
    for (const [x, y] of [[70, 207], [92, 212], [114, 207]]) {
      const sock = cv.mask().circle(x, y, 9);
      cv.fill(sock, (px, py) => (px + py < x + y ? S[1] : S[2]));
      cv.fill(sock.edge(), (px, py) => (px + py < x + y - 4 ? S[0] : px + py > x + y + 4 ? S[7] : S[1]));
      const b = cv.mask().circle(x, y - 1, 7);
      cv.cast(b.dilate(1), 1, 2, -2);
      cv.grad(b, [B[4], B[3], B[2], B[1]], { dir: { cx: x - 4, cy: y - 5, r: 13 }, soft: 0.4 });
      celShadow(cv, b, 3);
      cv.outline(INK, b, { all: true });
      cv.px([[x - 2, y - 6], [x - 3, y - 6], [x - 4, y - 5], [x - 5, y - 4], [x - 5, y - 3], [x - 4, y - 4]], ICE);
      cv.set(x - 1, y - 6, B[4]).set(x - 5, y - 2, B[4]);
      cv.set(x + 3, y + 2, B[4]);
    }

    // Printed mascot (lower-right): a round puff with a curly tuft, stubby arms up and two little feet.
    const mx = 133, my = 194;
    const puff = cv.mask().oval(mx + 1, my + 4, 18, 15);
    const arms = cv.mask().capsule(mx + 1, my + 9, mx - 1, my + 6, 1.2).or(cv.mask().capsule(mx + 18, my + 9, mx + 20, my + 6, 1.2));
    const feet = cv.mask().rect(mx + 4, my + 18, 4, 2).or(cv.mask().rect(mx + 12, my + 18, 4, 2));
    const blob = puff.or(arms).or(feet);
    cv.cast(blob.dilate(1), 1, 1, -1);
    cv.outline(INK, blob, { all: true });
    cv.fill(blob, S[8]);
    cv.fill(blob.sub(blob.shift(-3, -3)), S[7]);
    cv.px([[mx + 10, my + 3], [mx + 10, my + 2], [mx + 11, my + 1], [mx + 12, my + 1], [mx + 13, my + 2], [mx + 12, my + 3]], INK); // tuft curl
    sprite(cv, mx + 3, my + 9, ['..o.......o..', '..o.......o..', '.....u.u.....', 'cc....u....cc'], { o: INK, u: INK, c: S[6] });
    cv.set(mx + 5, my + 9, ICE).set(mx + 13, my + 9, ICE);
    cv.set(mx + 5, my + 7, ICE).set(mx + 6, my + 6, ICE);

    // Embossed brand under the buttons.
    const bx = CX - (cv.textWidth('KAYBORO') >> 1);
    cv.text('KAYBORO', bx, 229, S[1]).text('KAYBORO', bx, 228, S[6]);

    // Glints that twinkle on the star and the shell.
    const tw = cv.layer('tw');
    sparkle(tw, 134, 28, 2, Y[4], ICE);
    sparkle(tw, 160, 96, 1, S[8], ICE);

    return cv.punch(...HOLE, HR);
  },
};
