// 90s pager pal: chunky teal beeper with a purple faceplate round the wide LCD, a spring belt clip on
// the side, a stubby bulb antenna, two oval buttons and a rocker, a Memphis-pattern sticker, a little
// pet perched on top, a chat-bubble and envelope icon strip and a blinking message LED.
import { Canvas } from '../pixel.mjs';
import { INK, inset, part, sprite, spriteMask } from '../kit.mjs';

const W = 232, H = 172, HOLE = [29, 37, 160, 90], HR = 3; // 16:9
const T = ['#0c3443', '#11535c', '#177673', '#1f9a8e', '#36bea8', '#71dfc1', '#c2f7df']; // teal case
const P = ['#1c1240', '#2c1b5d', '#40277c', '#56349c', '#6f49bb', '#9472d8', '#c4aef2']; // purple faceplate
const L = ['#08060f', '#120e1e', '#1d1730', '#2a2244', '#3a3159']; // LCD surround
const K = ['#2a2546', '#4a4470', '#6e6898', '#948fbf', '#c3bfe6']; // lilac-steel clip
const Pk = ['#6e0f4c', '#b81f78', '#ff3fa4', '#ff8fd0', '#ffd6ef']; // neon pink
const Lm = ['#3b6610', '#74b01c', '#b4ef3a', '#e0ff7a', '#f7ffd2']; // neon lime
const Cy = ['#0b3f5a', '#1b7fa3', '#3fd6f0', '#9af4ff', '#e8fdff']; // neon cyan
const Y = ['#8a5a12', '#d0951f', '#ffd23d', '#ffe98a', '#fff8d0']; // sun yellow
const Cm = ['#8f7f9e', '#c9bccf', '#ece2ea', '#fbf5f6', '#ffffff']; // sticker paper

const BODY = [6, 19, 206, 148, 24];

export default {
  id: 'px-pager-pal', name: 'Pager Pal', theme: 'pager', rarity: 'common', translucent: false,
  collection: 'pocket-pals', license: 'CC-BY-4.0',
  desc: 'Your tiny pet beeps hello from a totally rad 90s pager, clip and all.',
  tags: ['pager', 'virtual-pet', '90s', 'memphis', 'animated', 'widescreen'],
  css: '.msg{animation:msg 1.2s steps(1) infinite}@keyframes msg{50%{opacity:0}}' +
    '.pop{animation:pop 2.4s steps(1) infinite}@keyframes pop{0%,60%{opacity:0}61%,100%{opacity:1}}',
  draw() {
    const cv = new Canvas(W, H);
    cv.use(T, P, L, K, Pk, Lm, Cy, Y, Cm);

    // Spring belt clip behind the case on the right: hinge barrel up top, a tongue with three grip
    // bumps, and a flared lip at the bottom.
    const clip = cv.mask().rrect(196, 33, 28, 92, [6, 9, 10, 4]).or(cv.mask().rrect(206, 119, 22, 8, 3));
    cv.shade(clip, K, { top: [4], left: [3], bottom: [0], right: [1], fill: 2 });
    cv.shade(cv.mask().rrect(198, 40, 27, 11, 3).and(clip), K, { top: [4], left: [4], bottom: [0], right: [1], fill: 3 }); // hinge
    cv.fill(cv.mask().rect(199, 45, 26, 1).and(clip.erode(1)), K[1]).fill(cv.mask().rect(198, 51, 27, 1).and(clip), INK);
    for (const y of [79, 89, 99]) cv.rect(213, y, 9, 3, K[3]).rect(213, y, 9, 1, K[4]).rect(213, y + 3, 9, 1, K[1]);
    cv.rect(212, 120, 14, 1, K[4]); // lip catches the light
    cv.outline(INK, clip, { all: true });

    // Stubby antenna on the top-left shoulder: thin stalk with a collar ring and a neon bulb tip.
    const ant = cv.mask().rrect(32, 11, 5, 12, [1, 1, 0, 0]);
    part(cv, ant, P, { top: [5], left: [5], bottom: [1], right: [1], fill: 3, shadow: false });
    cv.rect(33, 13, 1, 9, P[6]);
    cv.rect(32, 16, 5, 1, P[5]).rect(32, 17, 5, 1, P[1]);
    const tip = cv.mask().circle(34, 7, 4);
    cv.outline(INK, tip, { all: true });
    cv.shade(tip, Cy, { top: [4], left: [3], bottom: [1], right: [1], fill: 2 });
    cv.set(32, 5, '#ffffff').set(33, 5, Cy[4]).set(32, 6, Cy[4]);
    cv.cast(tip.dilate(1), 1, 1, -1); // bulb shades the stalk

    // Case.
    const body = cv.mask().rrect(...BODY);
    cv.cast(body.dilate(1), 1, 1, -1);
    cv.shade(body, T, { top: [6, 5], left: [5], bottom: [1, 2], right: [2], fill: 4 });
    cv.fill(body.erode(2).and(cv.mask().rect(0, 161, W, 4)), T[3]);
    cv.fill(cv.mask().capsule(14, 43, 14, 123, 0.5), T[5]); // side gloss
    cv.fill(cv.mask().capsule(46, 22, 82, 22, 0.5), T[5]); // top specular dash, tapering out
    cv.px([[85, 22], [88, 22]], T[5]);

    // Purple faceplate with the recessed LCD well.
    const plate = cv.mask().rrect(16, 25, 186, 112, 14);
    part(cv, plate, P, { top: [6, 5], left: [5], bottom: [1], right: [2], fill: 3, dy: 2, ink: INK });
    const well = cv.mask().rrect(24, 34, 170, 99, 7);
    cv.shade(well, L, { top: [0], left: [0], bottom: [4], right: [3], fill: 2 });
    inset(cv, ...HOLE, HR, { rim: INK, top: L[0], bottom: L[3], right: L[2] }, 1);
    cv.px([[26, 43], [26, 42], [27, 41], [27, 40]], L[4]); // glass glint, clear of the ink lip

    // Status strip above the screen: signal bars left, an embossed chat bubble centre, envelope + LED right.
    [1, 2, 3, 4].forEach((h, i) => cv.rect(32 + i * 3, 32 - h, 2, h, i < 3 ? Cy[2] : L[4]));
    sprite(cv, 164, 27, ['#######', '##...##', '#.#.#.#', '#..#..#', '#######'], { '#': P[6] }); // envelope
    const bub = spriteMask(cv, 103, 26, ['.#########.', '###########', '###########', '.#########.', '..##.......', '.#.........']);
    cv.fill(bub.shift(1, 1).sub(bub), P[1]).fill(bub, P[5]);
    for (const x of [105, 108, 111]) cv.rect(x, 27, 2, 2, P[2]);

    // Round message LED in an ink socket: dim base, bright blink layer with two side glints.
    const ledM = cv.mask().oval(175, 27, 5, 5);
    cv.outline(INK, ledM, { all: true });
    cv.fill(ledM, Lm[0]).set(176, 28, Lm[1]);
    const bl = cv.layer('msg');
    bl.fill(ledM, Lm[2]).fill(ledM.and(cv.mask().rect(175, 27, 3, 3)), Lm[3]).set(176, 28, Lm[4]);
    bl.px([[173, 29], [181, 29]], Lm[3]);

    // Lower deck: two oval buttons, the rocker and the Memphis sticker.
    const ovalBtn = (x, y, R) => {
      cv.shade(cv.mask().oval(x - 2, y - 2, 24, 16), T, { top: [1], left: [1], bottom: [5], right: [4], fill: 2 });
      part(cv, cv.mask().oval(x, y, 20, 12), R, { top: [4], left: [3], bottom: [0], right: [1], fill: 2, dy: 1 });
      cv.px([[x + 4, y + 2], [x + 5, y + 2], [x + 6, y + 2], [x + 3, y + 3]], R[4]);
    };
    ovalBtn(20, 144, Pk);
    ovalBtn(48, 144, Lm);

    // Rocker: purple capsule tilted on a centre pivot, left end raised into the light, right end pressed.
    cv.shade(cv.mask().capsule(84, 149, 110, 149, 7), T, { top: [1], left: [1], bottom: [5], right: [4], fill: 2 });
    const rock = cv.mask().capsule(84, 149, 110, 149, 5);
    part(cv, rock, P, { top: [5], left: [4], bottom: [0], right: [1], fill: 3, dy: 1 });
    const core = rock.erode(1);
    cv.fill(core.and(cv.mask().rect(0, 0, 96, H)), P[4]);
    cv.fill(core.and(cv.mask().rect(99, 0, W, H)), P[2]);
    cv.fill(rock.and(cv.mask().rect(99, 144, W, 1)), P[3]); // pressed end tips away from the light
    cv.fill(rock.erode(1).and(cv.mask().rect(99, 153, W, 1)), P[1]);
    cv.rect(96, 145, 2, 9, P[1]).rect(98, 145, 1, 9, P[5]); // pivot seam
    sprite(cv, 86, 147, ['..#', '.##', '###', '.##', '..#'], { '#': P[6] });
    sprite(cv, 105, 147, ['#..', '##.', '###', '##.', '#..'], { '#': P[0] });

    // Memphis sticker: cream card with squiggle, triangles, dots and confetti on a die-cut border.
    const card = cv.mask().rrect(124, 141, 66, 20, 3);
    const die = card.dilate(1);
    cv.cast(die, 1, 1, -2);
    cv.fill(die, P[1]);
    cv.shade(card, Cm, { top: [4], left: [3], bottom: [1], right: [2], fill: 2 });
    const sq = cv.mask();
    for (let x = 128; x <= 158; x++) sq.put(x, Math.round(150 + 2.6 * Math.sin((x - 128) * 0.55)));
    cv.fill(sq.or(sq.shift(0, 1)), Pk[2]);
    cv.fill(cv.mask().poly([[162, 158], [168, 146], [174, 158]]), Cy[2]);
    cv.fill(cv.mask().poly([[163, 157], [168, 148], [168, 157]]), Cy[3]);
    cv.fill(cv.mask().poly([[177, 144], [186, 144], [186, 153]]), Y[2]);
    for (const [x, y] of [[127, 143], [142, 143], [157, 157], [178, 156]]) cv.rect(x, y, 2, 2, P[1]);
    for (const [x, y, c] of [[134, 144, Lm[2]], [145, 157, Cy[2]], [151, 143, Y[2]], [182, 157, Pk[2]], [128, 157, Y[2]]]) {
      cv.fill(cv.mask().line(x, y, x + 3, y + 1), c);
    }

    // Pet perched on the top edge: a round neon puff with a sprout and stubby feet on the ledge.
    const pet = cv.mask().oval(96, 6, 26, 18);
    cv.cast(pet.dilate(1), 1, 1, -1);
    part(cv, pet, Pk, { top: [4], left: [4], bottom: [1, 2], right: [2], fill: 3, shadow: false });
    sprite(cv, 103, 12, ['wk......wk', 'kk......kk', '...k..k...', '....kk....'], { k: INK, w: '#ffffff' });
    cv.px([[101, 15], [102, 15], [113, 15], [114, 15]], Pk[2]);
    sprite(cv, 106, 4, ['LL.LL', 'LLsLL', '..s..'], { L: Lm[2], s: Lm[1] });
    cv.set(106, 4, Lm[3]).set(110, 4, Lm[3]);
    for (const x of [101, 110]) {
      const f = cv.mask().oval(x, 20, 8, 5);
      cv.outline(INK, f, { all: true });
      cv.shade(f, Pk, { top: [4], left: [3], bottom: [1], right: [2], fill: 3 });
    }
    const pop = cv.layer('pop');
    sprite(pop, 127, 6, ['.#.#.', '#####', '#####', '.###.', '..#..'], { '#': Pk[2] });
    pop.set(128, 7, Pk[4]);
    pop.outline(INK);

    cv.outline(INK);
    return cv.punch(...HOLE, HR);
  },
};
