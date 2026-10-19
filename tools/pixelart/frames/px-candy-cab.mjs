// Candy cab: a curvy white sit-down arcade cabinet with a domed head, smoky lavender bezel, a small
// backlit marquee window, a wide two-player control panel, coin slots with blinking COIN LEDs on a
// waisted pedestal, and a little pink stool beside it.
import { Canvas, bayer } from '../pixel.mjs';
import { INK, SHAPES, inset, part, sparkle, scallop, sprite, sticker } from '../kit.mjs';

const W = 240, H = 288, HOLE = [48, 70, 144, 108], HR = 8; // 4:3
const Wh = ['#5d5078', '#8f86ae', '#bcb6d6', '#dcd8ec', '#efedf8', '#fbfaff']; // candy white plastic
const Bz = ['#140f24', '#211a38', '#30264f', '#423668', '#584a84', '#7564a6', '#9b8cc8']; // smoky lavender glass
const Pk = ['#7a1d4f', '#b9356f', '#ef5f98', '#ff9cc2', '#ffd2e4', '#fff0f6']; // candy pink
const Mt = ['#145a55', '#23917f', '#43c9a6', '#8ff0cc', '#d4fff0']; // mint
const Ly = ['#8a5a12', '#d0951f', '#ffcf3d', '#ffe98a', '#fff8d0']; // lemon
const Ch = ['#2c2a3c', '#585a72', '#8a8da6', '#bfc2d6', '#eef0fa']; // chrome
const Li = ['#3d2f6a', '#5d4c92', '#8473ba', '#ab9cdb', '#cfc5f0', '#ece7ff']; // lilac panel plates
const MQ = ['#4a1a5c', '#7a2878', '#b23c8f', '#e8649f', '#ff9cbc', '#ffd0dc']; // marquee backlight
const SH = '#120c1c'; // floor shadow (darker than any backdrop)

const ball = (cv, x, y, R) => { // joystick: dished washer, chrome shaft, candy ball top
  cv.shade(cv.mask().oval(x - 9, y + 5, 19, 5), Bz, { top: [1], left: [1], bottom: [4], right: [3], fill: 2 });
  cv.rect(x - 1, y - 6, 3, 13, Ch[2]).rect(x - 1, y - 6, 1, 13, Ch[4]).rect(x + 1, y - 6, 1, 13, Ch[1]);
  part(cv, cv.mask().circle(x, y - 9, 5), R, { top: [4], left: [3], bottom: [0], right: [1], fill: 2, dy: 2 });
  cv.px([[x - 2, y - 12], [x - 3, y - 11], [x - 2, y - 11]], '#ffffff');
};
const btn = (cv, x, y, r, R) => { // white collar, glossy cap
  part(cv, cv.mask().circle(x, y, r + 1), Wh, { top: [5], left: [4], bottom: [1], right: [2], fill: 3, dy: 1 });
  part(cv, cv.mask().circle(x, y - 1, r - 1), R, { top: [3], left: [3], bottom: [1], right: [1], fill: 2, shadow: false });
  cv.set(x - 1, y - 3, R[R.length - 1]).set(x - 2, y - 2, R[R.length - 1]);
};

export default {
  id: 'px-candy-cab', name: 'Candy Cab', theme: 'arcade', rarity: 'common', translucent: false,
  collection: 'coin-op', license: 'CC-BY-4.0',
  desc: 'Pull up the little pink stool, drop a coin in this sweet candy cabinet and play till the LEDs stop blinking.',
  tags: ['arcade', 'cabinet', 'candy', 'pastel', 'animated', 'pixel'],
  css: '.ca{animation:co 1.2s steps(1) infinite}.cb{animation:co 1.2s steps(1) -.6s infinite}@keyframes co{50%{opacity:0}}' +
    '.ba{animation:co 1.6s steps(1) infinite}.bb{animation:co 1.6s steps(1) -.8s infinite}' +
    '.tw{animation:tw 2.6s steps(1) infinite}@keyframes tw{0%,65%{opacity:1}66%,100%{opacity:0}}',
  draw() {
    const cv = new Canvas(W, H);
    cv.use(Wh, Bz, Pk, Mt, Ly, Ch, MQ, Li);

    // Soft floor shadows (dithered edges) under the cabinet and the stool.
    const soft = (x, y, w, h) => {
      const core = cv.mask().oval(x + 4, y + 1, w - 8, h - 2), outer = cv.mask().oval(x, y, w, h);
      cv.fill(core, SH).fill(outer.sub(core), (px, py, c) => (bayer(px, py) < 0.5 ? SH : c));
    };
    soft(36, 272, 166, 14);
    soft(187, 272, 46, 12);

    // Pedestal: a waisted column with a flared, pink-trimmed foot.
    const ped = cv.mask().plot((x, y) => {
      const t = (y - 222) / 46, hw = 64 - 6 * Math.sin(Math.PI * Math.min(1, t * 1.15));
      return Math.abs(x + 0.5 - 120) <= hw;
    }, 0, 222, W, 268);
    part(cv, ped, Wh, { top: [4], left: [4, 3], bottom: [1], right: [1, 2], fill: 3, shadow: false });
    const foot = cv.mask().rrect(44, 264, 148, 14, [6, 6, 4, 4]);
    part(cv, foot, Wh, { top: [5], left: [4], bottom: [0], right: [1], fill: 3, dy: 1 });
    cv.rect(46, 270, 144, 2, Pk[2]).rect(46, 270, 144, 1, Pk[3]);

    // Coin door: two pink coin entries with slot and a COIN LED window under each.
    const door = cv.mask().rrect(88, 230, 64, 32, 4);
    part(cv, door, Li, { top: [4], left: [3], bottom: [0], right: [1], fill: 2, dy: 2 });
    const ca = cv.layer('ca'), cb = cv.layer('cb');
    for (const [x, l] of [[96, ca], [128, cb]]) {
      cv.shade(cv.mask().rrect(x, 234, 16, 16, 3), Pk, { top: [4], left: [3], bottom: [0], right: [1], fill: 2 });
      cv.rect(x + 7, 237, 2, 10, INK).rect(x + 9, 237, 1, 10, Pk[4]);
      cv.rect(x - 1, 252, 18, 7, INK).rect(x, 253, 16, 5, Bz[1]);
      cv.text('COIN', x + 1, 253, Ly[0]);
      l.fill(cv.mask().rect(x, 253, 16, 5).sub(cv.textMask('COIN', x + 1, 253)), Ly[1]); // lit: warm amber window
      l.text('COIN', x + 1, 253, Ly[4]);
    }

    // Stickers on the pedestal: the Kayboro scallop and a mint star.
    const sh = scallop(cv, 74, 258, 11, Pk, { face: true });
    cv.cast(sh.dilate(1), 1, 1, -1);
    cv.outline(INK, sh, { all: true });
    scallop(cv, 74, 258, 11, Pk, { face: true });
    sticker(cv, 162, 240, SHAPES.star, Mt);

    // Stool: cushion, white rim, chrome post, round base.
    part(cv, cv.mask().rrect(210, 249, 6, 20, 1), Ch, { top: [3], left: [4], bottom: [0], right: [1], fill: 2, shadow: false });
    cv.rect(211, 249, 1, 18, Ch[4]).rect(215, 249, 1, 18, Ch[1]);
    part(cv, cv.mask().rrect(197, 266, 32, 8, 4), Wh, { top: [5], left: [4], bottom: [0], right: [1], fill: 3, shadow: false });
    part(cv, cv.mask().rrect(196, 244, 34, 6, 3), Wh, { top: [5], left: [4], bottom: [1], right: [1], fill: 3, shadow: false });
    const seat = cv.mask().rrect(193, 234, 40, 12, 6);
    part(cv, seat, Pk, { top: [5, 4], left: [4], bottom: [1, 2, 2], right: [2], fill: 3, shadow: false });
    cv.fill(cv.mask().oval(201, 236, 14, 4).and(seat.erode(1)), Pk[4]);
    cv.px([[201, 237], [202, 236]], Pk[5]);

    // Head: a domed shell with a pink molding around it.
    const head = cv.mask().rrect(16, 6, 208, 194, [52, 52, 10, 10]);
    part(cv, head, Pk, { top: [4], left: [3], bottom: [0], right: [1], fill: 2, dy: 2 });
    const shell = head.erode(3, true).or(head.erode(3, true).shift(0, 3)).and(head);
    cv.shade(shell, Wh, { top: [5, 5], left: [4], bottom: [1], right: [2, 3], fill: 4 });
    cv.fill(shell.clip(216, 0, 10, 200), (x, y, c) => (c === Wh[4] ? Wh[3] : c)); // right side faces away from the light
    const shellIn = shell.erode(1);
    for (let t = 196; t <= 256; t += 0.5) { // gloss streak along the dome
      const a = (t * Math.PI) / 180, x = Math.round(70 + 46 * Math.cos(a)), y = Math.round(60 + 46 * Math.sin(a));
      if (shellIn.has(x, y)) cv.set(x, y, '#ffffff');
    }
    cv.fill(shell.and(cv.mask().rect(0, 9, W, 1)), Wh[5]);

    sticker(cv, 116, 11, SHAPES.heart, Pk);

    // Chaser bulbs down both side strips (dim base, two lit sets that take turns).
    const ba = cv.layer('ba'), bb = cv.layer('bb');
    for (const x of [26, 211]) for (let k = 0; k < 10; k++) {
      const y = 70 + k * 12, l = k % 2 ? ba : bb;
      cv.fill(cv.mask().circle(x + 1, y + 2, 3), Wh[1]).fill(cv.mask().circle(x + 1, y + 2, 3).sub(cv.mask().circle(x + 2, y + 3, 3)), Wh[0]);
      cv.fill(cv.mask().oval(x - 1, y, 5, 5, 1.2), Pk[1]).set(x, y + 1, Pk[2]);
      l.fill(cv.mask().oval(x - 1, y, 5, 5, 1.2), Ly[2]).fill(cv.mask().rect(x - 1, y + 3, 5, 2).and(cv.mask().oval(x - 1, y, 5, 5, 1.2)), Ly[1]).set(x, y + 1, Ly[4]).set(x - 1, y + 2, Ly[3]);
    }

    // Smoky tinted bezel with its own dome; small backlit marquee window at the top.
    const bezel = cv.mask().rrect(36, 22, 168, 170, [36, 36, 8, 8]);
    part(cv, bezel, Bz, { top: [0], left: [0], bottom: [5], right: [4], fill: 2, shadow: false, ink: Wh[0] });

    const mq = cv.mask().rrect(80, 31, 80, 26, 6);
    cv.fill(mq.dilate(1), INK);
    cv.grad(mq, MQ.slice(0, 5), { soft: 0.7 });
    cv.glow(mq, 120, 44, 40, 1);
    const logo = cv.textMask('KAYBORO', 120, 40, { font: 5, align: 'center' });
    cv.fill(logo.shift(1, 1), MQ[0]).fill(logo.shift(1, 2), INK);
    cv.grad(logo, [Ly[4], Ly[2]], { from: 40, to: 46, soft: 0.6 });
    for (const x of [87, 148]) sprite(cv, x, 46, SHAPES.heart5, { '#': MQ[5] });
    const tw = cv.layer('tw');
    sparkle(cv, 89, 37, 1, MQ[5], '#ffffff');
    sparkle(tw, 151, 37, 1, MQ[5], '#ffffff');

    // Round speaker grilles either side of the marquee.
    for (const cx of [61, 179]) {
      const sp = cv.mask().circle(cx, 44, 9);
      cv.shade(sp, Bz, { top: [0], left: [0], bottom: [4], right: [4], fill: 1 });
      SHAPES.heart5.forEach((row, j) => [...row].forEach((ch, i) => { // heart-shaped perforation
        if (ch === '#') cv.set(cx + i * 3 - 6, 43 + j * 3 - 6, Bz[0]).set(cx + i * 3 - 6, 43 + j * 3 - 5, Bz[3]);
      }));
    }

    // CRT: deep recess in the tinted glass.
    inset(cv, ...HOLE, HR, { rim: INK, top: Bz[0], left: Bz[1], bottom: Bz[5], right: Bz[4] }, 2);
    const glare = cv.mask().line(39, 124, 43, 100).or(cv.mask().line(40, 134, 43, 116));
    cv.fill(glare.and(bezel.erode(2)).sub(cv.mask().rrect(44, 66, 152, 116, 13)), Bz[6]);

    // Wide control panel: lit deck, pink-striped front lip; two players, starts in the middle.
    const deck = cv.mask().rrect(4, 190, 232, 26, [10, 10, 0, 0]);
    part(cv, deck, Wh, { top: [5, 5], left: [4], bottom: [2], right: [2], fill: 4, dy: 2 });
    const plate = cv.mask().rrect(12, 195, 216, 17, 5);
    cv.shade(plate, Li, { top: [1], left: [1], bottom: [5], right: [4], fill: 3 });
    cv.fill(plate.edge().and(cv.mask().rect(0, 195, W, 1)), Li[0]);
    const lip = cv.mask().rrect(4, 216, 232, 12, [0, 0, 6, 6]);
    part(cv, lip, Wh, { top: [3], left: [3], bottom: [0], right: [1], fill: 2, dy: 2 });
    cv.rect(5, 216, 230, 1, Wh[1]).rect(8, 220, 224, 2, Pk[2]).rect(8, 220, 224, 1, Pk[3]);
    cv.rect(8, 223, 224, 1, Mt[2]);
    // The overhanging panel casts a shadow band onto the pedestal and coin door.
    const under = cv.mask().rect(4, 229, 232, 5).and(ped.or(door));
    cv.fill(under, (x, y, c) => (c === INK ? c : cv.step(c, y < 232 || bayer(x, y) < 0.5 ? -1 : 0)));

    ball(cv, 32, 201, Pk);
    ball(cv, 208, 201, Mt);
    btn(cv, 56, 205, 5, Mt); btn(cv, 70, 200, 5, Ly); btn(cv, 84, 205, 5, Pk);
    btn(cv, 156, 205, 5, Pk); btn(cv, 170, 200, 5, Ly); btn(cv, 184, 205, 5, Mt);
    btn(cv, 112, 205, 3, Ch); btn(cv, 128, 205, 3, Ch);

    cv.outline(INK);
    return cv.punch(...HOLE, HR);
  },
};
