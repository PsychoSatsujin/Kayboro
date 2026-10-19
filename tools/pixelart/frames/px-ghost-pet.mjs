// Glow-in-the-dark ghost virtual pet: clear phosphor-green shell with a dome head, wavy hem and stubby
// arms, a printed face that blinks above a night-violet screen plate, candy-corn and pumpkin buttons,
// a little bat charm hanging from the key ring and a few floating sparkles.
import { Canvas, alpha, rng } from '../pixel.mjs';
import { INK, inset, part, sprite, spriteMask, sparkle } from '../kit.mjs';

const W = 176, H = 236, HOLE = [40, 76, 96, 96], HR = 5; // 1:1
const E = ['#0d563f', '#178a5f', '#2cbd78', '#5be394', '#98f8ae', '#ccffd0', '#f2fff0']; // glow plastic
const Pv = ['#160f2c', '#251a46', '#372864', '#4c3a85', '#6853a6', '#8f7bc9']; // night plate
const O = ['#7a2a10', '#c4531b', '#ff8a3d', '#ffb56d', '#ffe0b4']; // pumpkin orange
const Y = ['#8a5a12', '#d0951f', '#ffc83d', '#ffe27a', '#fff6c4']; // candy yellow
const Wh = ['#a89a8a', '#d6ccbc', '#f3ece0', '#fffaf0', '#ffffff']; // candy white
const Bt = ['#2a1d4d', '#47347c', '#6650a8', '#8a74cc', '#b6a4ee']; // bat
const ST = ['#2c3b1c', '#4f6b2a', '#86b04a']; // pumpkin stem
const G = ['#3a3a4e', '#6a6b82', '#9a9cb2', '#c8cadb', '#f2f3fb']; // key ring
const GL = '#f6fff2'; // opaque gloss highlight
const CX = 88, CY = 94, R = 70, HEM = 217, DEEP = 11;

// Ghost body: round dome, gently flared sides, five round lobes hanging from the hem.
const ghost = (cv, inset_ = 0) => cv.mask().plot((x, y) => {
  const px = x + 0.5, py = y + 0.5, dx = Math.abs(px - CX), r = R - inset_;
  if (py < CY) return dx * dx + (py - CY) ** 2 <= r * r;
  const hw = r + (py - CY) * 0.04;
  if (dx > hw) return false;
  const hb = R + (HEM - CY) * 0.04, lw = (2 * hb) / 5, f = (((px - (CX - hb)) / lw) % 1 + 1) % 1;
  const lobe = DEEP * Math.sin(Math.PI * f) ** 0.6;
  return py <= HEM - inset_ * 1.1 + lobe * (1 - inset_ / 14);
});

// Shade a mask band by band (pixel row -> ramp), bevel indices picked from the full mask's edges.
const bands = (cv, m, rampAt) => m.each((x, y) => {
  const out = (dx, dy) => !m.has(x + dx, y + dy);
  const i = out(0, 1) ? 0 : out(0, -1) || out(-1, -1) ? 4 : out(-1, 0) ? 3 : out(1, 0) ? 1 : out(0, 2) ? 1 : 2;
  cv.set(x, y, rampAt(y)[i]);
});

const BAT = [
  '#...............#',
  '##....e...e....##',
  '###...eeeee...###',
  '####.eeeeeee.####',
  '#####eeeeeee#####',
  '.####eeeeeee####.',
  '..###.eeeee.###..',
  '...#...eee...#...',
  '........e........',
];

const ICONS = [
  ['.###.', '##..#', '#....', '##..#', '.###.'], // moon
  ['#.#.#', '.###.', '#####', '.###.', '#.#.#'], // candy
  ['..#..', '.###.', '#####', '#####', '.###.'], // drop / lantern
  ['.#.#.', '#####', '#####', '.###.', '..#..'], // love (active)
  ['..#..', '.###.', '#####', '.#.#.', '#...#'], // star
  ['.###.', '#####', '#.#.#', '#####', '#.#.#'], // boo
];

export default {
  id: 'px-ghost-pet', name: 'Boo Pal', theme: 'spooky-cute', rarity: 'rare', translucent: true,
  collection: 'pocket-pals', license: 'CC-BY-4.0',
  desc: 'A glow-in-the-dark ghost pal that blinks at you while you play, with candy-corn buttons and a tiny bat charm.',
  tags: ['virtual-pet', 'ghost', 'halloween', 'glow-in-the-dark', 'clear-plastic', 'animated'],
  css: '.eyes{animation:blink 5.2s steps(1) infinite}@keyframes blink{0%,91%{opacity:1}92%,95%{opacity:0}96%{opacity:1}}' +
    '.tw{animation:tw 2.6s steps(1) infinite}@keyframes tw{0%,60%{opacity:1}61%,100%{opacity:0}}',
  draw() {
    const cv = new Canvas(W, H), rnd = rng(31);
    cv.use(E, Pv, O, Y, Wh, Bt, G);

    // Key ring through a loop nub on the head.
    part(cv, cv.mask().rrect(81, 18, 14, 10, 4), E, { top: [6], left: [5], bottom: [1], right: [2], fill: 4, shadow: false });
    const ring = cv.mask().circle(88, 11, 7).sub(cv.mask().circle(88, 11, 3));
    cv.shade(ring, G, { top: [4], left: [3], bottom: [0], right: [1], fill: 2 });
    cv.fill(ring.and(cv.mask().rect(81, 16, 15, 4)), (x, y, c) => cv.step(c, -1));

    // Stubby arms raised in a friendly boo, then the body over their roots.
    const arm = cv.mask().capsule(24, 134, 9, 121, 6.5);
    const arms = arm.or(arm.mirror());
    cv.shade(arms, E, { top: [6, 5], left: [5], bottom: [1, 2], right: [2], fill: 4 });
    const body = ghost(cv);
    cv.cast(body.dilate(1), 1, 1, -1);
    cv.shade(body, E, { top: [6, 5], left: [5], bottom: [1, 2], right: [2], fill: 4 });
    cv.fill(body.ring().and(arms), E[1]); // moulding seam where the arms meet the body
    const face = ghost(cv, 5);
    cv.shade(face, E, { top: [2], left: [3], bottom: [5], right: [5], fill: 4 });

    // Gloss streaks on the dome and the left arm.
    for (let t = 211; t <= 250; t += 0.5) {
      const a = (t * Math.PI) / 180, x = Math.round(CX + 61 * Math.cos(a)), y = Math.round(CY + 61 * Math.sin(a));
      cv.set(x, y, t < 216 || t > 244 ? E[6] : GL).set(x + 1, y + 1, t < 218 || t > 242 ? E[5] : E[6]);
    }
    cv.px([[8, 118], [9, 117], [10, 117]], GL);
    // Glow flecks suspended in the plastic.
    for (let i = 0; i < 44; i++) {
      const x = Math.floor(20 + rnd() * 136), y = Math.floor(30 + rnd() * 190);
      if (face.erode(1).has(x, y) && !cv.mask().rrect(26, 60, 124, 132, 14).has(x, y)) cv.set(x, y, rnd() < 0.3 ? E[6] : E[5]);
    }

    // Night-violet plate with care icons and the screen.
    const plate = cv.mask().rrect(32, 64, 112, 120, 15);
    part(cv, plate, Pv, { top: [5], left: [4], bottom: [0], right: [1], fill: 2, dy: 2, ink: E[0] });
    inset(cv, ...HOLE, HR, { rim: INK, top: Pv[0], bottom: Pv[4], right: Pv[3] }, 2);
    ICONS.forEach((ic, i) => sprite(cv, 58 + (i % 3) * 28, i < 3 ? 66 : 177, ic, { '#': i === 3 ? O[2] : Pv[4] }));

    // Printed face: blush, little "o" mouth, closed lids under the blinking open eyes.
    for (const x of [47, 117]) cv.fill(cv.mask().oval(x, 51, 12, 5), (px, py) => ((px + py) % 2 ? O[3] : O[4]));
    const mouth = cv.mask().oval(84, 52, 8, 9);
    cv.fill(mouth, INK).fill(mouth.erode(1), '#5b2346').fill(cv.mask().rect(86, 57, 4, 2).and(mouth.erode(1)), '#c8457a');
    for (const x of [58, 105]) cv.rect(x + 1, 44, 11, 2, INK).set(x, 43, INK).set(x + 12, 43, INK);
    const eyes = cv.layer('eyes');
    for (const x of [58, 105]) {
      const eye = eyes.mask().oval(x, 34, 13, 17);
      eyes.fill(eye, INK);
      eyes.grad(eye.erode(1), [Pv[1], Pv[2], Pv[3], Pv[4]], { from: 37, to: 49, soft: 0.6 });
      eyes.rect(x + 3, 37, 3, 5, '#ffffff').rect(x + 2, 38, 1, 3, '#ffffff').set(x + 8, 46, '#ffffff').set(x + 9, 45, '#ffffff').set(x + 7, 47, Pv[5]);
    }

    // Buttons: candy corns either side of a pumpkin, sitting in moulded sockets on a smile.
    const corn = (cx, top) => cv.mask().plot((x, y) => {
      const t = (y + 0.5 - top) / 14, dx = Math.abs(x + 0.5 - cx);
      return t >= 0 && t <= 1 && dx <= 1.2 + t * 6.3 - (t > 0.82 ? ((t - 0.82) / 0.18) ** 2 * 2.2 : 0);
    });
    const pump = cv.mask().oval(79, 192, 18, 15);
    const btns = [corn(61, 190), corn(115, 190)];
    for (const m of [...btns, pump]) cv.shade(m.dilate(2, true), E, { top: [2], left: [2], bottom: [5], right: [5], fill: 3 });
    for (const [i, m] of btns.entries()) {
      cv.cast(m.dilate(1), 1, 2, -2);
      bands(cv, m, (y) => (y < 195 ? Wh : y < 200 ? O : Y));
      cv.outline(INK, m, { all: true });
      cv.set((i ? 115 : 61) - 1, 193, '#ffffff');
    }
    part(cv, pump, O, { top: [4], left: [3], bottom: [0], right: [1], fill: 2, dy: 2 });
    for (const x of [83, 92]) cv.fill(cv.mask().rect(x, 194, 1, 11).and(pump.erode(1)), O[1]);
    cv.fill(cv.mask().rect(84, 194, 1, 11).and(pump.erode(1)), O[3]).fill(cv.mask().rect(93, 194, 1, 11).and(pump.erode(1)), O[3]);
    cv.px([[82, 195], [81, 196], [82, 196]], O[4]);
    const stem = spriteMask(cv, 87, 188, ['..##', '.##.', '.##.']);
    cv.outline(INK, stem, { all: true }).fill(stem, ST[1]).px([[89, 188], [88, 189]], ST[2]);
    sprite(cv, 91, 188, ['ll.', '.ll'], { l: ST[2] });

    // Bat charm dangling from the ring on two little links.
    cv.px([[96, 13], [97, 14], [99, 15], [100, 16]], G[2]).px([[96, 14], [100, 15]], G[4]);
    const bat = spriteMask(cv, 96, 17, BAT);
    part(cv, bat, Bt, { top: [4], left: [3], bottom: [0], right: [1], fill: 2, dy: 1 });
    cv.fill(bat.and(cv.mask().rect(96, 17, 5, 9)).sub(bat.edge()), Bt[3]).fill(bat.and(cv.mask().rect(108, 17, 5, 9)).sub(bat.edge()), Bt[1]);
    cv.px([[102, 21], [106, 21]], '#ffffff').px([[103, 21], [107, 21]], INK).px([[103, 23], [105, 23]], '#ffffff');
    cv.px([[101, 22], [107, 22]], O[3]);

    // Printed sparkles on the hem corners.
    sparkle(cv, 28, 199, 2, E[6], '#ffffff');
    sparkle(cv, 149, 206, 1, E[6], '#ffffff');

    // See-through pass: the thick rim and arms stay denser than the flat faces.
    const shell = body.or(arms).or(cv.mask().rrect(81, 18, 14, 10, 4));
    const thick = body.edge().or(body.erode(1).edge()).or(arms.edge().sub(body)).or(cv.mask().rrect(81, 18, 14, 10, 4));
    cv.fill(shell, (x, y, c) => (E.includes(c) ? alpha(c, thick.has(x, y) ? 0.95 : 0.76) : c));

    // Floating sparkles (two of them twinkle).
    const tw = cv.layer('tw');
    for (const [x, y, n, l] of [[18, 34, 2, 0], [158, 46, 1, 1], [166, 168, 2, 0], [8, 186, 1, 1], [24, 96, 1, 0], [152, 98, 1, 0]]) {
      sparkle(l ? tw : cv, x, y, n, n > 1 ? Y[3] : E[5], '#ffffff');
    }

    cv.outline(INK);
    // Soft floating shadow under the hem.
    cv.fill(cv.mask().oval(40, 230, 96, 5).and(cv.opaque().not()), (x, y) => alpha(Pv[0], Math.abs(x + 0.5 - CX) < 30 ? 0.45 : 0.25));
    return cv.punch(...HOLE, HR);
  },
};
