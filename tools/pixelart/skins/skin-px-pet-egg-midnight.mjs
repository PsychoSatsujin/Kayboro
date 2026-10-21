// Midnight skin for Lottie's Bubble Tank: the tank turns to see-through midnight-indigo plastic full of
// stars, Lottie gets moonlit silver hair, glowing violet gills and golden night eyes, the seaweed
// glows like bioluminescent kelp, and golden moon pearls clip her hair under a crescent moon.
import base, { PALETTES } from '../frames/px-pet-egg.mjs';
import { INK, sparkle } from '../kit.mjs';
import { withPalette, repunch, recolor, remapIn } from '../skinkit.mjs';

const NIGHT = ['#0b0a2c', '#18154e', '#282574', '#3b399a', '#5856c0', '#8a90e2', '#d2d8ff']; // midnight plastic
const SILVER = ['#241c58', '#4a3e92', '#7a6cc4', '#b8aef0', '#ece8ff']; // moonlit hair
const VIOLET = ['#4a1a7a', '#8a3ccc', '#c070ff', '#e4a8ff', '#f8e0ff']; // glowing gills, pearl buttons
const GOLD_EYES = ['#1a1030', '#3a2a6e', '#b8781a', '#f2c040', '#fff2a8'];
const GLOWKELP = ['#0c3646', '#127078', '#2cc4c0', '#9af8ea'];
const MOON = ['#7a5a12', '#c89a24', '#ffd84a', '#fff2a0', '#fffbe0'];

export default {
  id: 'skin-px-pet-egg-midnight', frame: 'px-pet-egg', name: 'Midnight', rarity: 'epic',
  desc: 'Lottie stays up past bedtime in a starry midnight tank, with moonlit hair, glowing gills and golden night eyes.',
  tags: ['night', 'stars', 'moon', 'axolotl', 'clear-plastic', 'animated', 'pixel'],
  css: base.css,
  draw() {
    const cv = withPalette(PALETTES, { E: NIGHT, Hr: SILVER, Gl: VIOLET, Ey: GOLD_EYES, Sw: GLOWKELP }, () => base.draw());
    cv.use(NIGHT, SILVER, VIOLET, MOON);
    // The opaque glare highlights go from mint to a cool moonlight tint.
    recolor(cv, { '#d8fff6': '#dcdcff' });

    // Stars scattered through the plastic (kept off the screen lip), a few on the twinkle layers.
    const tw = cv.layers.find((l) => l.cls === 'tw').cv, tw2 = cv.layers.find((l) => l.cls === 'tw2').cv;
    const STARS = [[30, 120, 2], [16, 160, 1], [34, 196, 1], [22, 246, 2], [62, 252, 1], [100, 268, 1], [128, 250, 1], [160, 262, 2],
      [190, 246, 1], [206, 200, 2], [192, 168, 1], [206, 132, 1], [24, 108, 1], [190, 108, 1]];
    STARS.forEach(([x, y, n], i) => {
      if (!cv.get(x, y)) return;
      sparkle(i % 4 === 1 ? tw : i % 4 === 3 ? tw2 : cv, x, y, n, n > 1 ? '#b8c0ff' : '#e0e4ff', '#ffffff');
    });

    // The bubble hair clip becomes a pair of golden moon pearls.
    remapIn(cv, cv.mask().rect(139, 30, 12, 12), NIGHT, ['#7a5a12', '#a87a18', '#c89a24', '#f0c040', '#ffd84a', '#fff2a0', '#fffbe0']);
    // A little moon and stars hanging in the night sky above her.
    const moon = cv.mask().circle(208, 16, 9).sub(cv.mask().circle(213, 12, 8));
    tw2.fill(moon.dilate(3), null); // the base's twinkle there would sit on the moon
    cv.outline(INK, moon, { all: true });
    cv.shade(moon, MOON, { top: [4], left: [3], bottom: [1], right: [2], fill: 3 });
    cv.px([[203, 18], [204, 22], [206, 19]], MOON[2]);
    sparkle(cv, 186, 8, 2, '#b8c0ff', '#ffffff');
    sparkle(tw, 214, 62, 1, '#e0e4ff', '#ffffff');
    sparkle(tw2, 10, 40, 2, '#b8c0ff', '#ffffff');
    sparkle(cv, 40, 22, 1, '#e0e4ff', '#ffffff');
    return repunch(cv);
  },
};
