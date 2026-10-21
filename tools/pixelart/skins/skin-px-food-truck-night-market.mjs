// Night Market skin for the Food Truck: midnight-indigo paint, warm lantern-colored string lights, paper
// lanterns along the lights, a big red one on the roof where the ice-cream cone was, glossy night glass on the cab, and a
// crescent moon and stars over the street.
import base, { PALETTES } from '../frames/px-food-truck.mjs';
import { INK, part, sparkle } from '../kit.mjs';
import { withPalette, repunch, erase } from '../skinkit.mjs';

const NAVY = ['#0f1234', '#1a1f4e', '#26306c', '#34448c', '#4a5eac', '#6e84cc']; // body paint (replaces mint)
const LIGHTS = ['#ffb84a', '#ff6a4a', '#ffd86a', '#ff8a5a', '#ffe0a0'];
const GLASS = ['#141a3a', '#1e2a5a', '#2e427e', '#5068a8', '#9ab0e0'];
const LANTERN = ['#4a0a14', '#8a1420', '#c8242c', '#ee4a3a', '#ff8a5a', '#ffc890'];
const GOLD = ['#6a3c0e', '#a8701c', '#e0a83a', '#ffd166', '#fff3b0'];
const MOON = ['#7a5a12', '#c89a24', '#ffd84a', '#fff2a0', '#fffbe0'];

export default {
  id: 'skin-px-food-truck-night-market', frame: 'px-food-truck', name: 'Night Market', rarity: 'epic',
  desc: 'The food truck works the night market shift: indigo paint, lantern-warm lights and a big red paper lantern on the roof.',
  tags: ['night', 'market', 'lantern', 'food', 'truck', 'street-food', 'animated', 'pixel'],
  css: base.css,
  draw() {
    const cv = withPalette(PALETTES, { Mt: NAVY, BULB: LIGHTS, Gl: GLASS }, () => base.draw());
    cv.use(NAVY, GLASS, LANTERN, GOLD, MOON, PALETTES.St);
    const R = 40, cx = 136; // roof top, sign center

    // The ice-cream cone sign comes down; a paper lantern goes up on the same bracket.
    erase(cv, cv.mask().rect(112, 0, 50, R - 6));
    erase(cv, cv.mask().rect(128, R - 8, 18, 2));
    part(cv, cv.mask().rrect(cx - 7, R - 7, 15, 8, [2, 2, 0, 0]), PALETTES.St, { top: [4], left: [3], bottom: [0], right: [1], fill: 2 });
    part(cv, cv.mask().rect(cx - 1, R - 13, 3, 7), PALETTES.St, { top: [4], left: [4], bottom: [0], right: [1], fill: 2, shadow: false });
    const cap = (y) => part(cv, cv.mask().rrect(cx - 8, y, 17, 3, 1), GOLD, { top: [4], left: [3], bottom: [0], right: [1], fill: 2, shadow: false });
    const body = cv.mask().oval(cx - 15, 3, 31, 26);
    cv.outline(INK, body, { all: true });
    cv.shade(body, LANTERN, { top: [5], left: [4], bottom: [0], right: [1], fill: 3 });
    cv.glow(body, cx - 3, 13, 12, 1);
    for (const k of [-10, -5, 0, 5, 10]) { // paper ribs
      const rib = cv.mask().plot((x, y) => Math.abs(x + 0.5 - (cx + 0.5 + k * Math.cos(((y - 16) / 13) * 1.1))) < 0.5);
      cv.fill(rib.and(body.erode(1)), (x, y, c) => cv.step(c, -1));
    }
    cv.fill(cv.mask().rect(cx - 10, 15, 21, 2).and(body.erode(1)), GOLD[3]); // painted band
    cv.set(cx - 7, 9, LANTERN[5]).set(cx - 6, 8, LANTERN[5]);
    cap(1); cap(28);
    cv.outline(INK, cv.mask().rrect(cx - 8, 1, 17, 3, 1).or(cv.mask().rrect(cx - 8, 28, 17, 3, 1)).or(cv.mask().rect(cx - 1, R - 13, 3, 7)), { all: false });

    // Mini paper lanterns hanging from the string lights' anchors.
    const mini = ['.ggg.', 'rRrrr', 'RRrrd', 'rRrrd', '.rrd.', '.ggg.', '..y..'];
    for (const x of [6, 66, 126, 186, 238]) {
      const m = cv.mask();
      mini.forEach((row, j) => [...row].forEach((ch, i) => { if (ch !== '.') m.put(x - 2 + i, 50 + j); }));
      cv.outline(INK, m, { all: false });
      mini.forEach((row, j) => [...row].forEach((ch, i) => {
        const c = { g: GOLD[2], r: LANTERN[3], R: LANTERN[4], d: LANTERN[2], y: GOLD[3] }[ch];
        if (c) cv.set(x - 2 + i, 50 + j, c);
      }));
    }
    // Moon and stars over the street.
    const moon = cv.mask().circle(22, 14, 9).sub(cv.mask().circle(27, 10, 8));
    cv.outline(INK, moon, { all: true });
    cv.shade(moon, MOON, { top: [4], left: [3], bottom: [1], right: [2], fill: 3 });
    const tw = cv.layers.find((l) => l.cls === 'tw').cv;
    for (const [x, y, n, t] of [[52, 8, 2, 0], [84, 20, 1, 1], [100, 6, 1, 0], [176, 10, 2, 1], [196, 26, 1, 0], [234, 8, 1, 1], [262, 20, 2, 0], [290, 6, 1, 1], [8, 30, 1, 0]]) {
      sparkle(t ? tw : cv, x, y, n, '#c8d4ff', '#ffffff');
    }
    return repunch(cv);
  },
};
