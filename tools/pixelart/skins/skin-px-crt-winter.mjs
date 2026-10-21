// Winter skin for the Rabbit-Ear CRT: midnight-blue plastic under a thick lumpy snow cap, icicles along
// the bottom edge, frost creeping into the bezel corners, a red knit bobble hat on the antenna dome,
// a snowflake sticker where the heart was, and flakes drifting past.
import base, { PALETTES } from '../frames/px-crt.mjs';
import { INK, part, sticker } from '../kit.mjs';
import { bayer } from '../pixel.mjs';
import { withPalette, repunch, snowCap, icicles, flake } from '../skinkit.mjs';

const BLUE = ['#11163a', '#1c2860', '#28408c', '#3a5cb0', '#5684d2', '#8cb4ec', '#d2e8ff']; // winter plastic
const FROST = ['#4e5b7c', '#7e8fb2', '#aebfdc', '#d2e0f2', '#ecf4fd', '#ffffff']; // frosted bezel + knobs
const SNOW = ['#5c6a9a', '#9fb2dc', '#d6e4f8', '#f4f9ff', '#ffffff'];
const ICE = ['#3c6aa8', '#8cc4f0', '#c8ecff', '#ffffff'];
const KNIT = ['#5a0f22', '#9a1c34', '#d8343f', '#ff6a5e']; // red wool
const WOOL = ['#8f9bb8', '#d8e2f2', '#ffffff']; // white wool

const FLAKES = [[14, 22, 5], [40, 44, 3], [70, 12, 3], [98, 34, 5], [138, 22, 3], [150, 48, 3], [214, 38, 3], [244, 54, 5], [8, 80, 3], [250, 120, 3]];

export default {
  id: 'skin-px-crt-winter', frame: 'px-crt', name: 'Winter', rarity: 'rare',
  desc: 'The rabbit-ear CRT bundled up for a snow day, with a bobble hat, icicles and frost in the corners.',
  tags: ['winter', 'snow', 'holiday', 'tv', 'crt', 'pixel'],
  css: '.sna{animation:sn 1.8s steps(1) infinite}.snb{animation:sn 1.8s steps(1) -.9s infinite}@keyframes sn{50%{opacity:0}}',
  draw() {
    const cv = withPalette(PALETTES, { R: BLUE, C: FROST }, () => base.draw());
    cv.use(BLUE, FROST, SNOW, ICE, KNIT, WOOL);

    // Frost feathering into the bezel's four corners (the strip between bezel edge and tube).
    const bezel = cv.mask().rrect(16, 72, 184, 146, 6).sub(cv.mask().rrect(22, 78, 172, 132, 10));
    for (const [cx, cy] of [[16, 72], [199, 72], [16, 217], [199, 217]]) {
      cv.fill(bezel.and(cv.mask().circle(cx, cy, 26)), (x, y, c) => {
        const t = 1 - Math.hypot(x - cx, y - cy) / 26;
        return bayer(x, y) < t * 1.25 ? (t > 0.6 ? FROST[5] : FROST[4]) : c;
      });
    }
    // Rime on the tube glass corners, just outside the picture.
    const glass = cv.mask().rrect(22, 78, 172, 132, 10).sub(cv.mask().rrect(27, 83, 162, 122, 7));
    for (const [cx, cy] of [[22, 78], [193, 78], [22, 209], [193, 209]]) {
      cv.fill(glass.and(cv.mask().circle(cx, cy, 14)), (x, y, c) => (bayer(x, y) < (1 - Math.hypot(x - cx, y - cy) / 14) * 0.7 ? '#8fa6d8' : c));
    }

    // Snowflake sticker over the heart one.
    const SF = ['.....#.....', '.#..###..#.', '..#..#..#..', '.#.#.#.#.#.', '....###....', '###########', '....###....', '.#.#.#.#.#.', '..#..#..#..', '.#..###..#.', '.....#.....'];
    sticker(cv, 176, 69, SF, ['#2a5ea8', '#4f8fd6', '#8ccaf6', '#c8ecff', '#ffffff'], { border: '#ffffff' });

    // Snow on the cabinet top and the feet, icicles under the cabinet.
    snowCap(cv, SNOW, { area: cv.mask().rect(0, 58, cv.w, cv.h), depth: 8, minRun: 6, seed: 4 });
    icicles(cv, 50, 204, 227, ICE, { seed: 2, max: 9 });
    icicles(cv, 12, 20, 227, ICE, { seed: 9, max: 5 });
    icicles(cv, 236, 244, 227, ICE, { seed: 7, max: 5 });

    // Knit bobble hat pulled over the antenna dome (the rods poke out of it).
    const hat = cv.mask().oval(166, 40, 36, 28).and(cv.mask().rect(0, 0, cv.w, 58));
    const brim = cv.mask().rrect(165, 54, 38, 7, 3);
    part(cv, hat, KNIT, { top: [3], left: [3], bottom: [0], right: [1], fill: 2, dy: 1 });
    hat.each((x, y) => { if ((x + (y >> 1)) % 4 === 0 && hat.has(x, y + 1)) cv.set(x, y, KNIT[1]); }); // rib knit
    for (const x of [172, 178, 184, 190, 196]) cv.fill(cv.mask().rect(x, 48, 3, 2).and(hat.erode(1)), WOOL[2]); // band of white stitches
    part(cv, brim, WOOL, { top: [2], left: [2], bottom: [0], right: [1], fill: 1, dy: 1 });
    for (let x = 167; x < 202; x += 3) cv.set(x, 57, WOOL[0]);
    const pom = cv.mask().circle(184, 38, 5, 1.1);
    part(cv, pom, WOOL, { top: [2], left: [2], bottom: [0], right: [0], fill: 1 });
    cv.px([[182, 35], [184, 34], [181, 37], [187, 36]], WOOL[0]);
    cv.outline(INK, hat.or(brim).or(pom), { all: false });

    // Drifting flakes: half of them on one layer, half on another a step lower, swapping.
    const a = cv.layer('sna'), b = cv.layer('snb');
    FLAKES.forEach(([x, y, s], i) => {
      flake(i % 3 === 0 ? cv : i % 3 === 1 ? a : b, x, y, s, i % 2 ? '#c8ecff' : '#ffffff', '#ffffff');
      if (i % 3) flake(i % 3 === 1 ? b : a, x + 1, y + 3, 3, '#c8ecff');
    });
    return repunch(cv);
  },
};
