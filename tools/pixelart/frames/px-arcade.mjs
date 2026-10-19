// Upright arcade cabinet: backlit marquee, racing-stripe sides with pink T-molding, joystick and
// buttons, coin door with a blinking INSERT COIN.
import { Canvas } from '../pixel.mjs';
import { INK, inset, part, sparkle, slots, scallop, sticker, SHAPES } from '../kit.mjs';

const W = 224, H = 320, HOLE = [32, 76, 160, 120]; // 4:3
const C = ['#120d2b', '#1f1747', '#2e2266', '#3f3085', '#5443a3', '#6f5ec2', '#9384dd']; // cabinet
const B = ['#07060c', '#100e19', '#1a1726', '#262236', '#36304a', '#4a4462']; // glossy bezel
const T = ['#7a0f4a', '#c8217a', '#ff4fa3', '#ff9ccd', '#ffd6ea']; // T-molding / pink
const O = ['#7a2a10', '#c8541c', '#ff8a3d', '#ffc08a']; // orange
const Y = ['#8a5a12', '#d0951f', '#ffd23d', '#ffe98a', '#fff8d0']; // yellow
const K = ['#0b3f5a', '#1b7fa3', '#3fc6e8', '#9af0ff', '#e8fdff']; // cyan
const Rd = ['#5a0a1a', '#a3172f', '#e0283f', '#ff6a6a', '#ffc2c2']; // ball top
const MQ = ['#2a0f4f', '#4a1676', '#7a1f8f', '#b02f96', '#e04aa0']; // marquee backlight
const G = ['#2a2a3a', '#55566c', '#8a8ca4', '#bfc1d4', '#eef0fa']; // chrome
const btn = (cv, x, y, r, R) => {
  part(cv, cv.mask().circle(x, y, r + 1), G, { top: [3], left: [3], bottom: [0], right: [1], fill: 2, dy: 1 });
  part(cv, cv.mask().circle(x, y - 1, r - 1), R, { top: [4], left: [3], bottom: [1], right: [1], fill: 2, shadow: false });
  cv.set(x - 2, y - 3, R[4]).set(x - 3, y - 2, R[4]);
};

export default {
  id: 'px-arcade', name: 'Pixel Arcade', theme: 'arcade', rarity: 'rare', translucent: false,
  tags: ['arcade', 'cabinet', 'retro', 'neon', 'animated', 'pixel'],
  css: '.blink{animation:blink 1.4s steps(1) infinite}@keyframes blink{50%{opacity:0}}' +
    '.twinkle{animation:tw 2.2s steps(1) infinite}@keyframes tw{0%,70%{opacity:1}71%,100%{opacity:0}}',
  draw() {
    const cv = new Canvas(W, H);
    cv.use(C, B, T, O, Y, K, Rd, G, MQ);

    // Cabinet shell: side strips with T-molding and racing stripes, front between them.
    const front = cv.mask().rect(16, 6, W - 32, 306);
    cv.shade(front, C, { top: [4], left: [3], bottom: [0], right: [1], fill: 2 });
    for (const [x, flip] of [[4, false], [W - 16, true]]) {
      const side = cv.mask().rrect(x, 2, 12, 314, [3, 3, 0, 0]);
      cv.shade(side, C, { top: [5], left: [4], bottom: [0], right: [1], fill: 2 });
      const tm = flip ? x + 10 : x;
      cv.shade(cv.mask().rrect(tm, 2, 2, 314, [1, 1, 0, 0]), T, { top: [4], left: [3], bottom: [0], right: [1], fill: 2 });
      [Y[2], O[2], T[2]].forEach((c, i) => cv.rect(flip ? x + 7 - i * 2 : x + 4 + i * 2, 14, 1, 290, c));
    }

    // Marquee: dithered backlight, chunky extruded logo, twinkling bulbs.
    const mq = cv.mask().rect(18, 10, W - 36, 46);
    cv.grad(mq, MQ.slice(0, 4), { soft: 0.7 });
    cv.glow(mq, 112, 34, 70, 1);
    cv.rect(16, 6, W - 32, 4, G[1]).rect(16, 6, W - 32, 1, G[3]).rect(16, 56, W - 32, 3, G[1]).rect(16, 56, W - 32, 1, G[3]);
    const logo = cv.textMask('KAYBORO', 112, 25, { font: 5, scale: 2, align: 'center' });
    for (let k = 3; k >= 1; k--) cv.fill(logo.shift(k, k), k === 3 ? INK : T[0]);
    cv.outline(INK, logo.or(logo.shift(1, 1)).or(logo.shift(2, 2)), { all: true });
    cv.grad(logo, [Y[4], Y[2], O[2]], { from: 25, to: 38, soft: 0.6 });
    cv.fill(logo.sub(logo.shift(0, 2)), Y[4]);
    const tw = cv.layer('twinkle');
    for (const [x, y, n] of [[30, 20, 2], [196, 44, 2], [192, 18, 1], [36, 46, 1], [62, 16, 1], [160, 48, 1]]) sparkle(n > 1 ? cv : tw, x, y, n, T[3], '#ffffff');

    // Speaker strip.
    cv.rect(16, 59, W - 32, 11, C[1]);
    for (const x of [26, 160]) for (let j = 0; j < 3; j++) for (let i = 0; i < 12; i++) if ((i + j) % 2 === 0) cv.set(x + i * 3, 61 + j * 3, B[0]);
    cv.text('PLAYER 1', 112 - (cv.textWidth('PLAYER 1') >> 1), 62, C[4]);

    // Glossy bezel round the screen.
    const bezel = cv.mask().rrect(18, 70, W - 36, 136, 4);
    part(cv, bezel, B, { top: [4], left: [3], bottom: [0], right: [1], fill: 2, shadow: false });
    inset(cv, ...HOLE, 0, { rim: INK, top: B[0], bottom: B[4], right: B[3] }, 2);
    cv.fill(cv.mask().capsule(20, 104, 46, 72, 0.6).or(cv.mask().capsule(20, 112, 52, 72, 0.6)).and(bezel.erode(1)), B[5]);

    // Control panel: lit top deck, darker front lip, overhanging the sides.
    const deck = cv.mask().rrect(2, 206, W - 4, 32, [3, 3, 0, 0]);
    cv.shade(deck, C, { top: [6, 5], left: [5], bottom: [2], right: [3], fill: 4 });
    cv.rect(2, 220, W - 4, 2, T[1]).rect(2, 222, W - 4, 1, O[2]);
    const lip = cv.mask().rect(2, 238, W - 4, 12);
    cv.shade(lip, C, { top: [3], left: [2], bottom: [0], right: [1], fill: 1 });
    cv.rect(2, 238, W - 4, 1, T[2]).rect(2, 239, W - 4, 1, T[1]);
    // Joystick: washer, shaft, ball.
    cv.shade(cv.mask().oval(40, 225, 26, 9), B, { top: [1], left: [1], bottom: [4], right: [3], fill: 2 });
    cv.fill(cv.mask().rect(52, 214, 3, 15), G[2]).rect(52, 214, 1, 15, G[4]).rect(54, 214, 1, 15, G[1]);
    part(cv, cv.mask().circle(53, 211, 7), Rd, { top: [4], left: [3], bottom: [0], right: [1], fill: 2, dy: 2 });
    cv.px([[50, 207], [49, 208], [50, 208]], '#ffffff');
    btn(cv, 106, 228, 6, T); btn(cv, 126, 224, 6, K); btn(cv, 146, 224, 6, Y);
    btn(cv, 178, 214, 4, G); btn(cv, 196, 214, 4, G);
    cv.text('1P', 175, 228, C[1]).text('2P', 193, 228, C[1]);

    // Lower cabinet: coin door with lit slots and a blinking prompt, kick plate.
    const door = cv.mask().rrect(80, 258, 64, 44, 3);
    part(cv, door, G, { top: [4], left: [3], bottom: [0], right: [1], fill: 2, dy: 2 });
    for (const x of [92, 120]) {
      cv.shade(cv.mask().rrect(x, 264, 12, 18, 2), O, { top: [3], left: [3], bottom: [0], right: [1], fill: 2 });
      cv.rect(x + 5, 267, 2, 12, INK).rect(x + 7, 267, 1, 12, O[3]);
      cv.text('25', x + 3, 284, G[0]);
    }
    cv.rect(84, 291, 56, 8, B[1]);
    cv.text('INSERT COIN', 112 - (cv.textWidth('INSERT COIN') >> 1), 293, O[2]); // dim base under the blink
    cv.layer('blink').text('INSERT COIN', 112 - (cv.textWidth('INSERT COIN') >> 1), 293, Y[3]);
    const shell = scallop(cv, 47, 294, 18, T);
    cv.cast(shell.dilate(1), 1, 1, -1);
    cv.outline(INK, shell, { all: true });
    scallop(cv, 47, 294, 18, T);
    sticker(cv, 136, 252, SHAPES.star, Y);
    sticker(cv, 170, 270, SHAPES.heart, K);
    sticker(cv, 180, 280, SHAPES.star, T);
    cv.fill(front.and(cv.mask().rect(16, 300, W - 32, 1)), C[1]);
    const kick = cv.mask().rect(16, 304, W - 32, 12);
    cv.shade(kick, B, { top: [4], left: [3], bottom: [0], right: [1], fill: 2 });
    slots(cv, 30, 307, W - 60, 3, 3, B[0], B[3]);

    cv.outline(INK);
    return cv.punch(...HOLE);
  },
};
