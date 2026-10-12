// Cloud castle: pastel towers with pink cone roofs and pennants, a gold-trimmed window for the screen,
// a sleepy crescent moon, twinkling stars, all floating on puffy clouds.
import { Canvas, bayer, rng } from '../pixel.mjs';
import { INK, inset, part, sprite, spriteMask, sparkle, SHAPES } from '../kit.mjs';

const W = 304, H = 232, HOLE = [56, 80, 192, 108], HR = 6; // 16:9
const St = ['#3b2f6b', '#5a4c96', '#8273c0', '#a99be0', '#cdc3f5', '#ece6ff', '#ffffff']; // pastel stone
const Rf = ['#5e1a52', '#9a2a76', '#d6408f', '#ff6ab0', '#ff9ed2', '#ffd0ea']; // roof tiles
const Gd = ['#7a4a12', '#b87a1c', '#e8b030', '#ffd166', '#ffeaa0', '#fff8dc']; // gold
const Cl = ['#4a4a8a', '#7a7ac0', '#a9b2e8', '#d2dafc', '#f0f4ff', '#ffffff']; // clouds
const Wn = { a: '#ffb347', b: '#ffd98a', c: '#fff2c4', k: INK };

// Cylinder shading across a span: lit stripe left of center, falling off to the right.
const cyl = (R, x0, w, base) => (x, y) => {
  const t = (x + 0.5 - x0) / w, f = t < 0.1 ? 0 : t < 0.35 ? 1 : t < 0.62 ? 0 : t < 0.85 ? -1 : -2;
  const g = t < 0.1 ? 0.5 : t > 0.55 && t < 0.62 ? 0.5 : t > 0.82 && t < 0.85 ? 0.5 : 1; // dithered seams
  return R[base + f + (g < 1 && bayer(x, y) < g ? (t < 0.2 ? 1 : 1) : 0)];
};

function tower(cv, cx, top, bot, w, roofTip, rw) {
  const x0 = cx - (w >> 1), body = cv.mask().rect(x0, top, w, bot - top);
  cv.outline(INK, body, { all: true });
  cv.fill(body, cyl(St, x0, w, 4));
  for (let y = top + 6; y < bot; y += 7) for (let x = x0 + ((y / 7) % 2 ? 3 : 8); x < x0 + w - 4; x += 11) cv.fill(cv.mask().rect(x, y, 4, 1).and(body), (px, py, c) => cv.step(c, -1));
  for (const wy of [top + 22, top + 70]) { // arched windows with flower boxes
    const glass = cv.mask().rrect(cx - 5, wy, 11, 15, [5, 5, 0, 0]);
    cv.outline(INK, glass, { all: true });
    cv.grad(glass, [Wn.c, Wn.b, Wn.a], { soft: 0.6 });
    cv.rect(cx, wy, 1, 15, INK).rect(cx - 5, wy + 7, 11, 1, INK);
    part(cv, cv.mask().rect(cx - 7, wy + 15, 15, 4), Gd, { top: [4], left: [3], bottom: [1], right: [2], fill: 2, dy: 1 });
    sprite(cv, cx - 6, wy + 12, ['.p..q..p..q..', 'gpg.g.gpg.g.g'], { p: Rf[3], q: '#ffffff', g: '#5fbf6a' });
  }
  // Cone roof with tile scallops, gold band, finial and pennant.
  const rx0 = cx - (rw >> 1), roof = cv.mask().poly([[cx + 0.5, roofTip], [rx0 + rw, top + 4], [rx0, top + 4]]).or(cv.mask().oval(rx0, top - 2, rw, 10));
  cv.fill(roof, cyl(Rf, rx0, rw, 3));
  for (let y = roofTip + 8; y < top + 6; y += 5) for (let x = rx0; x < rx0 + rw; x += 6) {
    const s = cv.mask().oval(x + ((y / 5) % 2 ? 3 : 0), y - 2, 6, 5).sub(cv.mask().oval(x + ((y / 5) % 2 ? 3 : 0), y - 3, 6, 5)).and(roof);
    cv.fill(s, (px, py, c) => cv.step(c, -1));
  }
  cv.fill(cv.mask().oval(rx0, top + 2, rw, 6).sub(cv.mask().oval(rx0, top, rw, 6)).and(cv.mask().rect(rx0, top, rw, 8)), Gd[2]);
  cv.outline(INK, roof, { all: true });
  part(cv, cv.mask().circle(cx, roofTip - 2, 2), Gd, { top: [5], left: [4], bottom: [1], right: [2], fill: 3, shadow: false });
  cv.rect(cx, roofTip - 13, 1, 9, Gd[1]);
  return roof;
}

// Cumulus: union of puffs, white on top, scalloped lavender undersides (each band = puffs nudged up).
function cloud(cv, puffs, floor = cv.h) {
  const U = (dy, k = 1) => puffs.reduce((m, [x, y, r]) => m.circle(x, Math.round(y - dy * r), Math.round(r * k)), cv.mask()).clip(0, 0, cv.w, floor);
  const M = U(0);
  cv.fill(M, Cl[2]).fill(M.and(U(0.3, 0.97)), Cl[3]).fill(M.and(U(0.55, 0.95)), Cl[4]);
  cv.fill(M.sub(M.shift(1, 2)).and(U(0.55, 0.95)), Cl[5]);
  return M;
}

export default {
  id: 'px-cloud-castle', name: 'Cloud Castle', theme: 'cute', rarity: 'epic', translucent: false,
  tags: ['cute', 'castle', 'clouds', 'stars', 'pastel', 'fantasy', 'animated', 'widescreen', 'pixel'],
  css: '.tw{animation:tw 2.4s steps(1) infinite}.tw2{animation:tw 2.4s steps(1) -1.2s infinite}' +
    '@keyframes tw{0%,60%{opacity:1}61%,100%{opacity:0}}.wave{animation:wv .9s steps(1) infinite}@keyframes wv{50%{opacity:0}}',
  draw() {
    const cv = new Canvas(W, H), rnd = rng(3);
    cv.use(St, Rf, Gd, Cl);

    // Wall with crenellations; center turret behind it; towers in front.
    const turret = cv.mask().rect(132, 34, 40, 30);
    cv.fill(turret, cyl(St, 132, 40, 3));
    sprite(cv, 148, 40, ['.kk.kk.', 'kaakbbk', 'kaaabbk', 'kaaaaak', '.kaaak.', '..kak..', '...k...'], { ...Wn, a: '#ffd98a', b: '#fff2c4' });
    const troof = cv.mask().poly([[152.5, 10], [176, 36], [128, 36]]).or(cv.mask().oval(128, 31, 48, 8));
    cv.fill(troof, cyl(Rf, 128, 48, 3)).outline(INK, troof, { all: true });
    cv.fill(cv.mask().oval(128, 34, 48, 5).sub(cv.mask().oval(128, 32, 48, 5)).and(cv.mask().rect(128, 32, 48, 8)), Gd[2]);
    part(cv, cv.mask().circle(152, 8, 2), Gd, { top: [5], left: [4], bottom: [1], right: [2], fill: 3, shadow: false });
    const wall = cv.mask().rect(36, 58, W - 72, 160);
    for (let x = 36; x < W - 36; x += 13) wall.rect(x, 50, 8, 8);
    cv.shade(wall, St, { top: [6], left: [5], bottom: [2], right: [3], fill: 4 });
    for (let y = 64; y < 196; y += 7) for (let x = 40 + ((y / 7) % 2 ? 0 : 6); x < W - 40; x += 12) if (rnd() < 0.55) cv.rect(x, y, 5, 1, St[3]);

    // Gold window frame with a heart jewel.
    const trim = cv.mask().rrect(48, 72, 208, 124, 12);
    part(cv, trim, Gd, { top: [5], left: [4], bottom: [1], right: [2], fill: 3, dy: 2 });
    cv.fill(cv.mask().rrect(51, 75, 202, 118, 10).edge(), Gd[2]);
    inset(cv, ...HOLE, HR, { rim: INK, top: St[1], bottom: St[3], right: St[2] }, 1);
    const heart = spriteMask(cv, 148, 69, SHAPES.heart);
    cv.outline(INK, heart, { all: true });
    cv.shade(heart, Rf, { top: [5], left: [4], bottom: [1], right: [2], fill: 3 });
    cv.set(150, 71, '#ffffff');

    tower(cv, 28, 56, 214, 44, 14, 54);
    tower(cv, W - 28, 56, 214, 44, 14, 54);
    sprite(cv, 29, 1, ['ppp.....', 'pPPPpp..', 'pPPPPPpp', 'pPPpp...', 'pp......'], { p: Rf[1], P: Rf[3] });
    sprite(cv, W - 27, 1, ['ggg.....', 'gGGGgg..', 'gGGGGGgg', 'gGGgg...', 'gg......'], { g: Gd[1], G: Gd[3] });
    const wave = cv.layer('wave'), base = cv.p.slice();
    for (const [x, c, C] of [[29, Rf[1], Rf[3]], [W - 27, Gd[1], Gd[3]]]) {
      wave.fill(cv.mask().rect(x, 1, 8, 5), (px, py) => base[py * W + px]);
      sprite(wave, x, 1, ['pp......', 'pPPpp...', 'pPPPPpp.', 'pPPPPPPp', 'ppp.....'], { p: c, P: C });
    }

    // Bunting from the towers to the turret.
    for (const [x0, x1] of [[52, 130], [174, 252]]) {
      const sag = (x) => 61 + Math.round(Math.sin(((x - x0) / (x1 - x0)) * Math.PI) * 6);
      for (let x = x0; x <= x1; x++) cv.set(x, sag(x), St[1]);
      for (let x = x0 + 5, k = 0; x < x1 - 3; x += 9, k++) {
        const c = [Rf[3], Gd[3], '#7af0ff'][k % 3], y = sag(x + 2) + 1;
        sprite(cv, x, y, ['kkkkk', 'kcccK', '.kcK.', '..k..'], { k: INK, K: INK, c });
      }
    }

    // Moon with a sleepy face; sparkles.
    const moon = cv.mask().circle(96, 22, 11).sub(cv.mask().circle(102, 17, 10));
    cv.outline(INK, moon, { all: true });
    cv.shade(moon, Gd, { top: [5], left: [5], bottom: [1], right: [2], fill: 3 });
    cv.px([[89, 24], [90, 25], [91, 25]], Gd[0]).px([[88, 28], [89, 28]], Rf[3]);
    const tw = cv.layer('tw'), tw2 = cv.layer('tw2');
    for (const [x, y, n, l] of [[66, 16, 2, cv], [222, 26, 2, cv], [118, 34, 1, tw], [200, 8, 1, tw2], [76, 40, 1, tw2], [250, 4, 1, tw], [184, 44, 1, cv]]) {
      if (n > 1) { cv.outline(INK, cv.mask().pts([[x, y], [x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1], [x - 2, y], [x + 2, y], [x, y - 2], [x, y + 2]]), {}); }
      sparkle(l, x, y, n, Gd[4], '#ffffff');
    }
    for (const [x, y] of [[110, 6], [238, 46], [58, 30], [176, 20], [264, 36]]) cv.set(x, y, Gd[4]);

    // Front clouds the castle floats on.
    const puffs = [];
    for (let x = -8; x <= W + 8; x += 17 + Math.round(rnd() * 12)) {
      const r = 10 + Math.round(rnd() * 11);
      puffs.push([x, Math.max(192 + r, 210 + Math.round(rnd() * 8)), r]);
    }
    cloud(cv, [...puffs, [22, 212, 21], [282, 210, 22], [120, 222, 14], [190, 222, 15]], H - 2);

    cv.outline(INK);
    return cv.punch(...HOLE, HR);
  },
};
