// Blue Cel CRT: a chunky 90s portable tube TV rendered like a cel-shaded anime still. Dithered
// cobalt-to-cyan plastic with one hard core-shadow band per volume, ice specular slivers, a carry
// handle arching over the top, a deep curved bezel with glass glints and faint scanlines, side
// speaker grilles and a slim control strip with a 7-seg channel readout and a coral power LED.
import { Canvas, bayer } from '../pixel.mjs';
import { INK, inset, led, sparkle, sticker, sprite, spriteMask, SHAPES } from '../kit.mjs';

const W = 256, H = 232, HOLE = [48, 50, 160, 120], HR = 6; // 4:3
// navy -> cobalt -> azure -> cyan -> ice
const B = ['#0a1140', '#111d68', '#18308f', '#2149bb', '#2d6ade', '#4790f2', '#6cb8fd', '#a3dfff', '#e0f6ff'];
const K = ['#04263a', '#0a4560', '#1fb2dc', '#7eefff', '#e6feff']; // lcd cyan
const O = ['#5e1712', '#d0402a', '#ff7a52', '#ffd2b8']; // the one warm accent: power LED
const WHITE = '#ffffff';
const SCAN = '#0c1550'; // tube scanline row, between B[0] and B[1]

// Seven-segment glyphs: segments a b c d e f g.
const SEG = { 0: 'abcdef', 1: 'bc', 2: 'abdeg', 3: 'abcdg', 4: 'bcfg', 5: 'acdfg', 6: 'acdefg', 7: 'abc', 8: 'abcdefg', 9: 'abcdfg' };
const SEGPX = {
  a: [[1, 0], [2, 0]], b: [[3, 1], [3, 2]], c: [[3, 4], [3, 5]], d: [[1, 6], [2, 6]],
  e: [[0, 4], [0, 5]], f: [[0, 1], [0, 2]], g: [[1, 3], [2, 3]],
};
function seg7(cv, x, y, digit, on, off) {
  for (const [s, pts] of Object.entries(SEGPX)) cv.px(pts.map(([i, j]) => [x + i, y + j]), SEG[digit].includes(s) ? on : off);
}

/**
 * Cel-shade a volume: dithered vertical gradient (top -> bottom colors), one hard flat core-shadow
 * crescent on the lower right, a 1px lit top-left edge, ink outline and a 1px drop shadow.
 */
function cel(cv, m, grad, { shadow, k = 3, hi, rim, drop = true, ink = true, soft = 0.6 } = {}) {
  if (drop) cv.cast(m.dilate(1), 1, 1, -1);
  if (grad.length > 1) cv.grad(m, grad, { soft }); else cv.fill(m, grad[0]);
  const core = m.sub(m.shift(-k, -k));
  if (shadow) cv.fill(core, shadow);
  if (rim) cv.fill(m.sub(m.shift(-1, 0)).and(core).sub(m.sub(m.shift(0, -1))), rim); // reflected light on the far edge
  if (hi) cv.fill(m.sub(m.shift(1, 1)).sub(core), hi);
  if (ink) cv.outline(INK, m, { all: true });
  return core;
}

/** Pixel arc (angles in degrees, 0 = right, 90 = down) used for specular slivers. */
function arc(cv, cx, cy, rx, ry, a0, a1, c, clip) {
  for (let a = a0; a <= a1; a += 0.5) {
    const t = (a * Math.PI) / 180, x = Math.round(cx + rx * Math.cos(t)), y = Math.round(cy + ry * Math.sin(t));
    if (!clip || clip.has(x, y)) cv.set(x, y, c);
  }
}

export default {
  id: 'px-cel-crt', name: 'Blue Cel CRT', theme: 'tv', rarity: 'rare', translucent: false,
  collection: 'blue-cel', license: 'CC-BY-4.0',
  desc: 'A chunky cel-shaded tube TV in glossy blues, ready to carry your game anywhere by its little handle.',
  tags: ['tv', 'crt', 'cel-shaded', 'blue', 'animated', 'pixel'],
  css: '.blink{animation:bl 1.6s steps(1) infinite}@keyframes bl{50%{opacity:0}}' +
    '.flip{animation:fl 5s steps(1) infinite}@keyframes fl{0%,69%{opacity:0}70%,100%{opacity:1}}',
  draw() {
    const cv = new Canvas(W, H);
    cv.use(B, K, O, [B[0], SCAN, B[1]], [B[7], B[8], WHITE]);

    // Dithered floor shadow (fully opaque pixels on a checker, so the shell stays solid).
    const floor = cv.mask().oval(30, 215, 196, 8);
    cv.fill(floor, (x, y) => {
      const d = ((x + 0.5 - 128) / 98) ** 2 + ((y + 0.5 - 219) / 4) ** 2;
      return d < 0.15 || bayer(x, y) < 0.85 * (1 - d) ? INK : undefined;
    });

    // Carry handle arching over the top, with a ribbed rubber grip.
    const handle = cv.mask().oval(27, 3, 202, 72).sub(cv.mask().oval(38, 13, 180, 56)).clip(0, 0, W, 32);
    cel(cv, handle, [B[6], B[5], B[4], B[3]], { shadow: B[2], k: 2, hi: B[8], drop: false });
    const grip = handle.and(cv.mask().rect(98, 0, 60, 16));
    cv.fill(grip, (x, y) => (y < 7 ? B[2] : B[1]));
    cv.fill(grip.and(cv.mask().rect(98, 0, 60, 6)).sub(grip.shift(0, 1)), B[3]);
    for (let x = 101; x < 157; x += 4) cv.fill(grip.and(cv.mask().rect(x, 0, 1, 16)), B[0]);
    cv.rect(97, 4, 1, 9, INK).rect(158, 4, 1, 9, INK);
    arc(cv, 128, 39, 96, 31, 197, 232, B[8], handle.erode(1));
    arc(cv, 128, 39, 96, 31, 236, 246, WHITE, handle.erode(1));

    // Little feet.
    for (const x of [30, 194]) cel(cv, cv.mask().rrect(x, 198, 32, 18, [0, 0, 6, 6]), [B[5], B[4], B[3]], { shadow: B[2], k: 2, hi: B[7] });

    // Chunky body: cobalt-to-cyan dithered gradient, hard core-shadow band, ice gloss.
    const body = cv.mask().rrect(6, 26, 244, 182, 22);
    cel(cv, body, [B[7], B[6], B[5], B[4], B[3]], { shadow: B[2], k: 7, hi: B[8], rim: B[4], soft: 0.5 });
    // Anime gloss: a hard crescent sliver hugging the top-left corner, plus streaks.
    const gl = cv.mask().circle(29, 50, 19).sub(cv.mask().circle(31, 52, 19)).and(body.erode(2)).clip(0, 0, 40, 72);
    cv.fill(gl, B[8]);
    cv.fill(gl.and(cv.mask().rect(10, 34, 14, 22)), WHITE);
    cv.rect(52, 29, 26, 1, WHITE).rect(82, 29, 4, 1, WHITE).rect(88, 29, 1, 1, WHITE);
    cv.rect(9, 76, 1, 40, B[8]).rect(9, 120, 1, 4, B[8]);

    // Handle hinges bolted onto the top corners.
    for (const x of [24, 210]) {
      const hinge = cv.mask().rrect(x, 16, 22, 15, [6, 6, 2, 2]);
      cel(cv, hinge, [B[5], B[4], B[3]], { shadow: B[2], k: 2, hi: B[8] });
      const pin = cv.mask().circle(x + 10, 22, 3);
      cv.fill(pin, B[1]).fill(pin.sub(pin.shift(1, 1)), B[6]).set(x + 9, 21, B[8]).set(x + 10, 22, B[0]);
      cv.outline(INK, pin, { all: true });
    }

    // Side speaker grilles: recessed, dithered depth, staggered perforations.
    for (const gx of [12, 227]) {
      const gr = cv.mask().rrect(gx, 62, 17, 96, 7);
      cv.grad(gr, [B[0], B[1], B[2], B[2]], { soft: 0.9 });
      cv.fill(gr.sub(gr.shift(1, 2)), B[0]); // top/left wall in shadow
      cv.fill(gr.sub(gr.shift(-1, -1)), B[4]); // lit bottom/right lip
      const inner = gr.erode(2);
      for (let j = 0; j < 22; j++) for (let i = 0; i < 3; i++) {
        const x = gx + 3 + i * 4 + (j % 2 ? 2 : 0), y = 67 + j * 4;
        if (x + 1 >= gx + 15 || !inner.has(x, y) || !inner.has(x + 1, y + 1)) continue;
        cv.rect(x, y, 2, 2, INK).set(x + 1, y + 2, B[3]);
      }
      cv.outline(INK, gr, { all: true });
    }

    // Deep curved bezel: raised ice lip, then the dark tube sloping into the glass.
    const bezel = cv.mask().rrect(34, 38, 188, 144, 16);
    cel(cv, bezel, [B[8], B[7], B[6]], { shadow: B[4], k: 2, hi: WHITE, drop: true });
    const tube = cv.mask().rrect(38, 42, 180, 136, 13);
    cv.fill(tube, (x, y) => (y % 2 ? B[1] : SCAN)); // faint scanlines on the tube face
    cv.fill(tube.sub(tube.shift(2, 2)), B[0]); // recessed: top/left walls fall into shadow
    cv.fill(tube.sub(tube.shift(-1, -1)), B[3]); // bottom/right catch the light
    cv.outline(INK, tube, { all: true });
    inset(cv, ...HOLE, HR, { rim: INK, top: B[0], left: B[0], bottom: B[2], right: B[2] }, 2);
    // Glass reflections on the lip (kept clear of the opening's edge).
    const band = tube.erode(1).sub(cv.mask().rrect(HOLE[0] - 4, HOLE[1] - 4, HOLE[2] + 8, HOLE[3] + 8, HR + 4));
    arc(cv, 52, 56, 10, 10, 190, 262, B[7], band);
    arc(cv, 52, 56, 10, 10, 214, 240, WHITE, band);
    cv.fill(band.and(cv.mask().rect(70, 44, 14, 2)), B[5]).fill(band.and(cv.mask().rect(88, 44, 4, 2)), B[5]);
    cv.fill(band.and(cv.mask().rect(40, 74, 2, 10)), B[4]);

    // Die-cut stickers on the lower faces: a cyan star on the right, a TV buddy on the left.
    const st = sticker(cv, 229, 181, SHAPES.star, [B[3], K[2], K[3], K[4], WHITE], { border: WHITE });
    cv.outline(INK, st.dilate(1), { all: true });
    // Mascot sticker: a tiny smiling TV buddy (an original Kayboro doodle of this very set).
    const BUDDY = [
      '....ooooooo....',
      '...owllllldo...',
      '...oo.....oo...',
      '.ooooooooooooo.',
      'owllllllllllldo',
      'olwsssssssslmmo',
      'olssesssesslkmo',
      'olsscssscsslmmo',
      'olspssssspslkmo',
      'olssscscssslmmo',
      'olsssscsssslmmo',
      'ollllllllllllmo',
      'oddddddddddddmo',
      '.ooooooooooooo.',
      '.odo.......odo.',
      '.ooo.......ooo.',
    ];
    const bm = spriteMask(cv, 16, 178, BUDDY), bdie = bm.dilate(1);
    cv.cast(bdie, 1, 1, -2).fill(bdie, WHITE);
    sprite(cv, 16, 178, BUDDY, { o: INK, w: WHITE, e: WHITE, l: B[7], m: B[5], d: B[4], s: B[1], c: K[3], p: B[3], k: K[3] });
    cv.outline(INK, bdie, { all: true });

    // Slim control strip under the screen.
    const strip = cv.mask().rrect(54, 186, 148, 16, 5);
    cv.fill(strip, B[1]);
    cv.fill(strip.sub(strip.shift(1, 1)), B[0]);
    cv.fill(strip.sub(strip.shift(-1, -1)), B[4]);
    cv.outline(INK, strip, { all: true });
    // Power button + coral LED (the single warm accent).
    const pw = cv.mask().circle(64, 193, 4);
    cel(cv, pw, [B[5], B[3]], { shadow: B[2], k: 2, hi: B[8] });
    cv.rect(64, 190, 1, 3, B[1]).px([[62, 192], [62, 193], [62, 194], [63, 195], [64, 195], [65, 195], [66, 194], [66, 193], [66, 192]], B[1]);
    const lm = cv.mask().oval(70, 191, 4, 4, 1.1);
    cv.fill(lm, O[0]).set(71, 192, O[1]); // dim base, lit LED blinks on top
    led(cv.layer('blink'), 70, 191, [O[1], O[2], O[3], WHITE], { d: 4 });
    cv.text('KAYBORO', 78, 192, B[5]);
    // 7-seg channel readout with a digit flip.
    const lcd = cv.mask().rrect(110, 189, 21, 11, 2);
    cv.fill(lcd, K[0]).fill(lcd.sub(lcd.shift(1, 1)), INK);
    seg7(cv, 114, 191, 0, K[3], K[1]); seg7(cv, 120, 191, 3, K[3], K[1]);
    cv.set(126, 197, K[2]);
    const fl = cv.layer('flip');
    fl.fill(lcd.erode(1).sub(lcd.sub(lcd.shift(1, 1))), K[0]);
    seg7(fl, 114, 191, 0, K[3], K[1]); seg7(fl, 120, 191, 7, K[3], K[1]);
    fl.set(126, 197, K[2]);
    cv.set(111, 190, K[3]); fl.set(111, 190, K[3]); // glass glare, same on both channel frames
    // Channel rocker.
    const rock = cv.mask().rrect(136, 189, 20, 10, 4);
    cel(cv, rock, [B[6], B[4]], { shadow: B[3], k: 2, hi: B[8] });
    cv.rect(146, 189, 1, 10, B[2]);
    cv.rect(139, 193, 3, 1, B[1]).rect(149, 193, 3, 1, B[1]).rect(150, 192, 1, 3, B[1]);
    // Volume pips.
    for (let i = 0; i < 5; i++) {
      const h = 2 + i, x = 162 + i * 4;
      cv.rect(x, 198 - h, 2, h, i < 3 ? K[2] : B[2]);
      if (i < 3) cv.set(x, 198 - h, K[4]);
    }
    cv.text('VOL', 184, 192, B[5]);

    // Anime sparkles around the handle.
    sparkle(cv, 14, 14, 2, B[7], WHITE);
    sparkle(cv, 244, 8, 1, B[7], WHITE);
    sparkle(cv, 236, 22, 1, B[6], B[8]);

    cv.outline(INK);
    return cv.punch(...HOLE, HR);
  },
};
