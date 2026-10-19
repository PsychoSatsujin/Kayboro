// Food truck: a mint street-food truck seen from the side. Its serving window is the screen, under a
// striped awning and twinkling string lights, with a chalk menu of pixel snacks, a giant ice-cream cone
// on the roof, a steaming vent, condiments and a service bell on the counter and a happy bao sticker.
import { Canvas, ramp, bayer, mix } from '../pixel.mjs';
import { INK, inset, part, sprite, spriteMask } from '../kit.mjs';

const W = 304, H0 = 220, DY = 12, H = H0 + DY; // the truck is drawn at H0, then lowered DY to make room for the roof sign
const HOLE0 = [64, 75, 160, 90], HOLE = [64, 75 + DY, 160, 90], HR = 3; // 16:9
const Mt = ramp('#4fb8a0', 7, { step: 0.1, sat: 0.05 }).slice(0, 6); // mint body
const Cr = ramp('#ead9b8', 6, { step: 0.08 }); // cream trim / awning
const Rd = ramp('#e2483e', 6, { step: 0.12 }); // tomato red
const Yl = ramp('#f4c13a', 5); // mustard
const St = ramp('#9aa3bc', 6, { step: 0.12 }); // stainless
const Pk = ramp('#ff8fb8', 5); // strawberry
const Wf = ramp('#d69a52', 5, { step: 0.12 }); // waffle / dough
const Tr = ramp('#3a3448', 5, { step: 0.09 }); // tyres
const Ck = ['#1d2b2e', '#26383a', '#304748', '#3d5856']; // chalkboard
const Gl = ['#2a4d78', '#3f74a8', '#64a6d4', '#a6dcf2', '#e6f8ff']; // cab glass
const BULB = ['#ffd84a', '#ff8fb8', '#7cebad', '#ff9a4a', '#9fd8ff'];
const UP = { top: [4], left: [3], bottom: [0], right: [1], fill: 2 };

// Menu icons (12 wide at most), coloured like a printed menu on chalkboard.
const ICONS = [
  [['...bbbbbb...', '.bbwbbbbwbb.', 'bbbbbbwbbbbb', 'BBBBBBBBBBBB', 'gGgGgGgGgGgG', 'cccccccccccc', 'mmmmmmmmmmmm', 'MMMMMMMMMMMM', 'bbbbbbbbbbbb', '.BBBBBBBBBB.'],
    { b: Wf[3], B: Wf[1], w: Cr[4], g: '#6ccf5a', G: '#3f9a4a', c: Yl[3], m: '#8a4a2e', M: '#5c2e22' }], // burger
  [['..g.r..g.r..', '.grgmgrgmrg.', 'grmmmrmmmgrg', 'yyyyyyyyyyyy', 'yYyyYyyYyyYy', '.yyyyyyyyyy.', '..yYyyyyYy..', '....yyyy....'],
    { y: Yl[3], Y: Yl[2], g: '#6ccf5a', r: Rd[2], m: '#8a4a2e' }], // taco
  [['.y.Y..y.Y.', '.yYyyYyYy.', 'yYyYyyYyYy', 'rrrrrrrrrr', 'rRwwwwwwRr', '.rrrrrrrr.', '.rrrwwrrr.', '.rrrrrrrr.', '..RRRRRR..'],
    { y: Yl[3], Y: Yl[2], r: Rd[2], R: Rd[1], w: Cr[4] }], // fries
  [['...pppp...', '.ppPpsppp.', 'ppspPpppsp', 'pPpd..dpPp', 'ppd....dpp', 'dpd....dpd', 'ddDd..dDdd', '.ddDDDDdd.', '...dddd...'],
    { p: Pk[2], P: Pk[4], s: '#9fd8ff', d: Wf[3], D: Wf[2] }], // donut
  [['..wWw..wWw..', '.wwWww.wWwws', 'wwwwss.wwwss', 'tttttttttttt', 'TtTtTtTtTtTt', 'tttttttttttt', '.TTTTTTTTTT.'],
    { w: Cr[4], W: Cr[2], s: Cr[2], t: Wf[3], T: Wf[1] }], // dumplings in a steamer
  [['....s...', '....s...', '.LLLsLL.', 'LLLLLLLL', '.cccccc.', '.cCcccc.', '.cccccc.', '.cckckc.', '..ckkk..', '..cccc..'],
    { s: Pk[1], L: Cr[4], c: '#e8c39a', C: Cr[4], k: '#3b2433' }], // boba tea
];

// Steam puffs [x, y, r] for the two wiggle frames (final canvas coordinates).
const STEAM = [
  [[211, 27, 2], [213, 21, 3], [210, 13, 4], [214, 5, 3]],
  [[210, 27, 2], [208, 20, 3], [212, 12, 4], [209, 4, 3]],
];

export default {
  id: 'px-food-truck', name: 'Food Truck', theme: 'food', rarity: 'common', translucent: false,
  collection: 'world-tour', license: 'CC-BY-4.0',
  desc: 'Order up! Your game is served fresh from the window of a cheerful mint food truck.',
  tags: ['food', 'truck', 'street-food', 'cute', 'animated', 'pixel'],
  css: '.sa{animation:st 1s steps(1) infinite}.sb{animation:st 1s steps(1) -.5s infinite}@keyframes st{50%{opacity:0}}' +
    '.tw{animation:tw 1.6s steps(1) infinite}@keyframes tw{0%,55%{opacity:1}56%,100%{opacity:0}}',
  draw() {
    const base = truck(), cv = new Canvas(W, H);
    cv.use(...PAL);
    return compose(base, cv);
  },
};

const PAL = [Mt, Cr, Rd, Yl, St, Pk, Wf, Tr, Gl, Ck];

function truck() {
    const cv = new Canvas(W, H0);
    cv.use(...PAL);
    const WH = [[66, 196], [270, 196]];
    const arches = WH.reduce((m, [x, y]) => m.circle(x, y, 17), cv.mask());

    // Cab: rounded nose with a sloped windshield.
    const cab = cv.mask().poly([[240, 86], [282, 86], [299, 112], [299, 190], [240, 190]]).sub(arches);
    part(cv, cab, Mt, { top: [5, 4], left: [4], bottom: [0], right: [1, 2], fill: 3, shadow: false });
    const win = cv.mask().poly([[249, 92], [279, 92], [292, 112], [249, 112]]);
    cv.outline(INK, win, { all: true });
    cv.grad(win, [Gl[3], Gl[2], Gl[1]], { soft: 0.7 });
    cv.fill(cv.mask().capsule(254, 108, 262, 94, 0.6).or(cv.mask().capsule(259, 109, 266, 97, 0.5)).and(win), Gl[4]);
    cv.fill(cv.mask().rect(246, 116, 1, 70).or(cv.mask().rect(290, 116, 1, 60)), Mt[1]);
    part(cv, cv.mask().rect(251, 118, 7, 2), St, { ...UP, top: [4], fill: 3 });
    // Mascot sticker: a happy steamed bao.
    const bao = cv.mask().oval(258, 128, 22, 17).or(cv.mask().oval(265, 124, 8, 6));
    const die = bao.dilate(1, true);
    cv.cast(die, 1, 1, -2).fill(die, '#fffaf0');
    cv.outline(INK, bao, { all: true });
    cv.shade(bao, Cr, { top: [5], left: [4], bottom: [1], right: [2], fill: 3 });
    sprite(cv, 262, 125, ['....kk....', '...k..k...'], { k: Cr[1] });
    sprite(cv, 263, 134, ['.k......k.', 'kk......kk', '..........', 'p..kkkk..p', 'pp..kk..pp'], { k: INK, p: Pk[2] });
    // Headlight, bumper, mirror.
    part(cv, cv.mask().rrect(294, 148, 5, 10, 2), Yl, { top: [4], left: [4], bottom: [1], right: [2], fill: 3, shadow: false });
    part(cv, cv.mask().rrect(286, 180, 16, 8, 2), St, { top: [4, 3], left: [3], bottom: [0], right: [1], fill: 2, shadow: false });
    part(cv, cv.mask().rect(240, 162, 59, 3), Cr, { top: [5], left: [4], bottom: [1], right: [2], fill: 3, shadow: false });

    // Box body.
    const box = cv.mask().rrect(4, 34, 238, 156, [6, 6, 0, 0]).sub(arches);
    part(cv, box, Mt, { top: [5, 4], left: [4], bottom: [0], right: [1], fill: 3, shadow: false });
    for (let x = 12; x < 240; x += 14) cv.set(x, 41, Mt[5]).set(x, 42, Mt[1]);
    // Tail light.
    part(cv, cv.mask().rrect(4, 150, 4, 10, 1), Rd, { top: [4], left: [4], bottom: [0], right: [1], fill: 2, shadow: false });

    // Roof trim, vent and the giant ice-cream cone sign.
    const roof = cv.mask().rrect(2, 28, 242, 8, [4, 4, 1, 1]);
    part(cv, roof, Cr, { top: [5], left: [4], bottom: [0], right: [1], fill: 3, shadow: false });
    cv.rect(4, 34, 238, 1, Cr[1]);
    // Menu board.
    const board = cv.mask().rrect(8, 70, 42, 78, 2);
    part(cv, board, Cr, { top: [5], left: [4], bottom: [0], right: [1], fill: 3 });
    const slate = cv.mask().rect(11, 73, 36, 72);
    cv.shade(slate, Ck, { top: [0], left: [0], bottom: [3], right: [2], fill: 1 });
    slate.each((x, y) => { if (bayer(x * 3, y) < 0.06) cv.set(x, y, Ck[2]); });
    cv.text('MENU', 29, 75, Cr[3], { font: 5, align: 'center' });
    cv.rect(16, 83, 26, 1, Ck[3]);
    const cells = [[14, 87], [33, 89], [15, 106], [33, 106], [14, 128], [35, 125]];
    ICONS.forEach(([rows, pal], i) => {
      const [x, y] = cells[i];
      cv.outline(INK, spriteMask(cv, x, y, rows), { all: true });
      sprite(cv, x, y, rows, pal);
    });

    // Window frame: stainless bezel, dark inner lip.
    const bez = cv.mask().rrect(56, 68, 176, 104, 5);
    part(cv, bez, St, { top: [4, 3], left: [3], bottom: [0], right: [1], fill: 2, dy: 1 });
    inset(cv, ...HOLE0, HR, { rim: INK, top: Tr[1], left: Tr[1], bottom: St[4], right: St[3] }, 2);

    // Awning: lit slope, scalloped valance, stripe shadow on the bezel.
    const slope = cv.mask().poly([[54, 46], [234, 46], [240, 56], [48, 56]]);
    const val = cv.mask().rect(48, 56, 192, 4);
    for (let x = 48; x < 240; x += 12) val.oval(x, 55, 12, 10);
    const awn = slope.or(val);
    cv.cast(awn.dilate(1), 0, 2, -2);
    cv.outline(INK, awn, { all: true });
    const stripe = (x, y) => Math.floor((x - 48 - (56 - y) * 0.6 * ((x - 144) / 96)) / 12) % 2 === 0;
    cv.fill(slope, (x, y) => (stripe(x, y) ? Rd : Cr)[y < 49 ? 4 : y < 53 ? 3 : 2]);
    cv.fill(val, (x, y) => {
      const R = Math.floor((x - 48) / 12) % 2 === 0 ? Rd : Cr;
      return R[y === 56 ? 1 : val.has(x, y + 1) ? 2 : 1];
    });
    cv.fill(val.and(cv.mask().rect(0, 57, W, 1)), (x) => (Math.floor((x - 48) / 12) % 2 === 0 ? Rd : Cr)[3]);
    for (const x of [52, 236]) part(cv, cv.mask().rect(x - 1, 62, 2, 8), St, { top: [3], left: [3], bottom: [0], right: [1], fill: 2 });

    // String lights swagging under the roof.
    const tw = cv.layer('tw'), anchors = [6, 66, 126, 186, 240];
    let n = 0;
    for (let a = 0; a + 1 < anchors.length; a++) {
      const x0 = anchors[a], x1 = anchors[a + 1];
      const sag = (x) => 37 + Math.round(Math.sin(((x - x0) / (x1 - x0)) * Math.PI) * 5);
      for (let x = x0; x <= x1; x++) cv.set(x, sag(x), INK);
      for (let x = x0 + 5; x < x1 - 4; x += 10, n++) {
        const y = sag(x + 1) + 1, c = BULB[n % BULB.length];
        sprite(cv, x, y, ['.kk.', 'kssk', 'kwck', 'kccd', '.kk.'], { k: INK, s: St[2], w: '#fffbe6', c, d: mixd(c) });
        if (n % 2) tw.px([[x + 1, y + 2], [x + 2, y + 2], [x + 1, y + 3], [x + 2, y + 3]], mixd(c)).set(x + 1, y + 2, c);
      }
    }

    // Counter with condiments and a service bell.
    const counter = cv.mask().rect(0, 172, 244, 6);
    part(cv, counter, St, { top: [5, 4], left: [4], bottom: [0], right: [1], fill: 2, shadow: false });
    const bottle = (x, R, cap) => {
      const m = cv.mask().rrect(x, 158, 8, 14, 2).or(cv.mask().rect(x + 2, 155, 4, 3)).or(cv.mask().rect(x + 3, 151, 2, 4));
      part(cv, m, R, { top: [4], left: [3], bottom: [0], right: [1], fill: 2 });
      cv.fill(m.and(cv.mask().rect(0, 151, W, 7)), (x2, y) => cap[y < 155 ? 3 : 2]);
      cv.rect(x + 1, 162, 6, 4, Cr[4]).rect(x + 2, 163, 4, 2, R[2]);
      cv.rect(x + 1, 159, 1, 9, R[4]);
    };
    bottle(13, Rd, Cr);
    bottle(24, Yl, Cr);
    part(cv, cv.mask().rect(35, 161, 12, 11), St, UP);
    cv.rect(37, 159, 8, 4, '#ffffff').rect(37, 162, 8, 1, Cr[2]);
    cv.outline(INK, cv.mask().rect(37, 159, 8, 3), {});
    const bell = cv.mask().oval(232, 164, 9, 8).and(cv.mask().rect(0, 0, W, 169)).or(cv.mask().rect(231, 169, 11, 2));
    part(cv, bell, Yl, { top: [4], left: [3], bottom: [0], right: [1], fill: 2 });
    cv.set(236, 163, Yl[3]).set(236, 162, INK).set(234, 165, Yl[4]);

    // Lower skirt: diner checker band.
    const band = cv.mask().rect(4, 181, 236, 4).sub(arches.dilate(1));
    cv.fill(band, (x, y) => (((x >> 1) + (y >> 1)) % 2 ? INK : Cr[4]));
    cv.fill(cv.mask().rect(4, 180, 236, 1).sub(arches.dilate(1)), Mt[4]);

    // Wheels: dark wells, tyres, chrome hubcaps.
    for (const [x, y] of WH) {
      cv.fill(cv.mask().circle(x, y, 17).and(cv.mask().rect(0, 0, W, 190)).and(box.or(cab).dilate(3)), Tr[0]);
      const tyre = cv.mask().circle(x, y, 14);
      cv.outline(INK, tyre, { all: true });
      cv.shade(tyre, Tr, { top: [3], left: [3], bottom: [0], right: [1], fill: 2 });
      cv.fill(cv.mask().circle(x, y, 12).edge(), Tr[1]);
      const hub = cv.mask().circle(x, y, 7);
      cv.outline(INK, hub, { all: true });
      cv.shade(hub, St, { top: [4], left: [4], bottom: [1], right: [1], fill: 3 });
      cv.fill(cv.mask().circle(x, y, 5).edge(), St[2]);
      part(cv, cv.mask().circle(x, y, 2), Rd, { top: [4], left: [3], bottom: [1], right: [1], fill: 2, shadow: false });
      cv.px([[x - 9, y - 9], [x - 10, y - 8], [x - 8, y - 10]], Tr[4]);
    }
    cv.fill(cv.mask().rect(83, 190, 170, 3), Tr[1]);

    cv.outline(INK);
    return cv;
}

const mixd = (c) => mix(c, '#5a2a6a', 0.35);

function compose(base, cv) {
  // Lower the truck to make room for the roof sign, carrying its animation layers along.
  for (let y = 0; y < H0; y++) for (let x = 0; x < W; x++) cv.set(x, y + DY, base.get(x, y));
  for (const { cls, cv: l } of base.layers) {
    const o = cv.layer(cls);
    for (let y = 0; y < H0; y++) for (let x = 0; x < W; x++) if (l.get(x, y)) o.set(x, y + DY, l.get(x, y));
  }
  const R = 28 + DY; // roof top

  // Roof vent.
  part(cv, cv.mask().rect(206, R - 9, 9, 10), St, UP);
  part(cv, cv.mask().rrect(203, R - 12, 15, 4, 1), St, { top: [5], left: [4], bottom: [0], right: [1], fill: 3, shadow: false });
  cv.rect(208, R - 7, 1, 7, St[4]);

  // Giant ice-cream cone sign on a chrome bracket.
  const cx = 136;
  part(cv, cv.mask().rrect(cx - 7, R - 7, 15, 8, [2, 2, 0, 0]), St, UP);
  const cone = cv.mask().poly([[cx - 14, 19], [cx + 15, 19], [cx + 1.5, R], [cx - 0.5, R]]);
  cv.outline(INK, cone, { all: true });
  cv.shade(cone, Wf, { top: [3], left: [3], bottom: [1], right: [1], fill: 2 });
  for (let k = -40; k < 40; k += 5) {
    cv.fill(cv.mask().line(cx - 14 + k, 19, cx + 10 + k, 43).and(cone.erode(1)), Wf[1]);
    cv.fill(cv.mask().line(cx + 15 + k, 19, cx - 9 + k, 43).and(cone.erode(1)), Wf[1]);
  }
  const scoop = cv.mask().oval(cx - 18, 4, 37, 17).or(cv.mask().rect(cx - 18, 14, 37, 4));
  for (const [x, h] of [[cx - 14, 4], [cx - 7, 2], [cx + 2, 6], [cx + 10, 3]]) scoop.rrect(x, 16, 4, h + 2, 2);
  cv.cast(scoop.dilate(1), 1, 1, -1);
  cv.outline(INK, scoop, { all: true });
  cv.shade(scoop, Pk, { top: [4], left: [3], bottom: [1], right: [1], fill: 2 });
  cv.fill(cv.mask().oval(cx - 17, 13, 35, 6).and(scoop).sub(cv.mask().oval(cx - 17, 11, 35, 6)), Pk[1]);
  cv.px([[cx - 12, 7], [cx - 11, 6], [cx - 13, 8], [cx - 10, 6], [cx - 14, 9]], '#ffffff');
  sprite(cv, cx - 6, 9, ['kk......kk', 'kw......kw', '....kk....', 'p...kk...p'].map((r) => r), { k: INK, w: '#ffffff', p: Pk[3] });
  for (const [x, y, c] of [[cx + 7, 7, Yl[3]], [cx + 12, 11, '#7cebad'], [cx - 3, 6, '#9fd8ff'], [cx + 3, 13, Cr[4]], [cx - 15, 13, Yl[3]], [cx + 14, 8, '#9fd8ff']]) cv.set(x, y, c).set(x + 1, y, c);
  const cherry = cv.mask().circle(cx + 2, 2, 2);
  cv.outline(INK, cherry, { all: true });
  cv.shade(cherry, Rd, { top: [4], left: [3], bottom: [0], right: [1], fill: 2 });
  cv.set(cx + 1, 1, Rd[5]);

  cv.outline(INK);

  // Soft dithered floor shadow.
  cv.fill(cv.mask().oval(10, 206 + DY, 290, 10), (x, y, c) => {
    if (c) return c;
    const d = Math.hypot((x + 0.5 - 155) / 145, (y + 0.5 - 211 - DY) / 5);
    return d < 0.75 || bayer(x, y) < (1 - d) * 3 ? INK : null;
  });

  // Steam: two wiggle frames swapping above the vent.
  STEAM.forEach((puffs, i) => {
    const l = cv.layer(i ? 'sb' : 'sa'), m = puffs.reduce((a, [x, y, r]) => a.circle(x, y, r), cv.mask());
    l.fill(m, (x, y) => (m.has(x, y + 1) ? (m.has(x - 1, y - 1) ? Cr[3] : Cr[5]) : St[3]));
    l.outline(INK, m, { all: true });
  });
  return cv.punch(...HOLE, HR);
}
