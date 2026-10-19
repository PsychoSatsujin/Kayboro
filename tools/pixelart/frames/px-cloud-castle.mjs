// Cloud castle: a grand pastel castle floating on a thick cumulus base under a pastel moonbow. Two front
// towers, two slimmer back towers and a tall central keep, all with cone roofs and waving pennants, bunting
// between them, a sleepy crescent moon, a shooting star and twinkling stars. The screen sits in an ornate
// gate (gilded segmental arch with a heart keystone and a rose window, barley-twist columns, a gold
// threshold) but the band right around the picture is plain pale stone.
import { Canvas, bayer, rng } from '../pixel.mjs';
import { INK, inset, part, sprite, spriteMask, sparkle, SHAPES } from '../kit.mjs';

const W = 320, H = 256, HOLE = [64, 104, 192, 108], HR = 6; // 16:9
const [HX, HY, HW, HH] = HOLE, CX = HX + HW / 2;
const St = ['#3b2f6b', '#5a4c96', '#8273c0', '#a99be0', '#cdc3f5', '#ece6ff', '#ffffff']; // pastel stone
const Sb = ['#2e2860', '#463f86', '#6762ae', '#8c88d0', '#b3b0ea', '#d6d4fa', '#f2f1ff']; // back stone (cooler)
const Rf = ['#5e1a52', '#9a2a76', '#d6408f', '#ff6ab0', '#ff9ed2', '#ffd0ea']; // roof tiles
const Gd = ['#7a4a12', '#b87a1c', '#e8b030', '#ffd166', '#ffeaa0', '#fff8dc']; // gold
const Cl = ['#4a4a8a', '#7a7ac0', '#a9b2e8', '#d2dafc', '#f0f4ff', '#ffffff']; // clouds
const BOW = ['#ff9eb5', '#ffc29a', '#fff0a0', '#b8f0b0', '#a8d8ff', '#c8b0ff']; // pastel moonbow, outside in
const Wn = { a: '#ffb347', b: '#ffd98a', c: '#fff2c4', k: INK };
const FLAG = { a: ['ppp.....', 'pPPPpp..', 'pPPPPPpp', 'pPPpp...', 'pp......'], b: ['pp......', 'pPPpp...', 'pPPPPpp.', 'pPPPPPPp', 'ppp.....'] };

// Cylinder shading across a span: lit stripe left of center, falling off to the right.
const cyl = (R, x0, w, base) => (x, y) => {
  const t = (x + 0.5 - x0) / w, f = t < 0.1 ? 0 : t < 0.35 ? 1 : t < 0.62 ? 0 : t < 0.85 ? -1 : -2;
  const g = t < 0.1 ? 0.5 : t > 0.55 && t < 0.62 ? 0.5 : t > 0.82 && t < 0.85 ? 0.5 : 1; // dithered seams
  return R[base + f + (g < 1 && bayer(x, y) < g ? 1 : 0)];
};

/** Round tower with a cone roof, gold band and finial; windows = list of y offsets for arched windows. */
function tower(cv, cx, top, bot, w, roofTip, rw, { S = St, windows = [], boxes = true } = {}) {
  const x0 = cx - (w >> 1), body = cv.mask().rect(x0, top, w, bot - top);
  cv.outline(INK, body, { all: true });
  cv.fill(body, cyl(S, x0, w, 4));
  for (let y = top + 6; y < bot; y += 7) for (let x = x0 + ((y / 7) % 2 ? 3 : 8); x < x0 + w - 4; x += 11) cv.fill(cv.mask().rect(x, y, 4, 1).and(body), (px, py, c) => cv.step(c, -1));
  for (const wy of windows) {
    const ww = w > 30 ? 11 : 7, gl = cv.mask().rrect(cx - (ww >> 1), top + wy, ww, ww + 4, [ww >> 1, ww >> 1, 0, 0]);
    cv.outline(INK, gl, { all: true });
    cv.grad(gl, [Wn.c, Wn.b, Wn.a], { soft: 0.6 });
    cv.rect(cx, top + wy, 1, ww + 4, INK);
    if (ww > 8) cv.rect(cx - 5, top + wy + 7, 11, 1, INK);
    if (boxes) {
      part(cv, cv.mask().rect(cx - (ww >> 1) - 2, top + wy + ww + 4, ww + 4, 4), Gd, { top: [4], left: [3], bottom: [1], right: [2], fill: 2, dy: 1 });
      if (ww > 8) sprite(cv, cx - 6, top + wy + ww + 1, ['.p..q..p..q..', 'gpg.g.gpg.g.g'], { p: Rf[3], q: '#ffffff', g: '#5fbf6a' });
    }
  }
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
  return { flag: [cx + 1, roofTip - 13] };
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
  desc: 'A grand pastel castle afloat on the clouds under a moonbow, with your game framed in its golden gate.',
  tags: ['cute', 'castle', 'clouds', 'stars', 'pastel', 'fantasy', 'animated', 'widescreen', 'pixel'],
  css: '.tw{animation:tw 2.4s steps(1) infinite}.tw2{animation:tw 2.4s steps(1) -1.2s infinite}' +
    '@keyframes tw{0%,60%{opacity:1}61%,100%{opacity:0}}.wave{animation:wv .9s steps(1) infinite}@keyframes wv{50%{opacity:0}}',
  draw() {
    const cv = new Canvas(W, H), rnd = rng(3);
    cv.use(St, Sb, Rf, Gd, Cl);

    // Moon, stars and a shooting star, far behind everything.
    const moon = cv.mask().circle(58, 22, 11).sub(cv.mask().circle(64, 17, 10));
    cv.outline(INK, moon, { all: true });
    cv.shade(moon, Gd, { top: [5], left: [5], bottom: [1], right: [2], fill: 3 });
    cv.px([[51, 24], [52, 25], [53, 25]], Gd[0]).px([[50, 28], [51, 28]], Rf[3]);
    for (let i = 0; i < 9; i++) cv.set(262 - i * 2, 12 + i, i < 3 ? Gd[5] : i < 6 ? Gd[4] : Gd[3]).set(263 - i * 2, 12 + i, i < 4 ? Gd[4] : Gd[2]);
    const tw = cv.layer('tw'), tw2 = cv.layer('tw2');
    for (const [x, y, n, l] of [[20, 12, 2, cv], [300, 40, 2, cv], [88, 8, 1, tw], [236, 6, 1, tw2], [8, 44, 1, tw2], [312, 10, 1, tw], [124, 14, 1, cv], [200, 20, 1, tw]]) {
      if (n > 1) cv.outline(INK, cv.mask().pts([[x, y], [x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1], [x - 2, y], [x + 2, y], [x, y - 2], [x, y + 2]]), {});
      sparkle(l, x, y, n, Gd[4], '#ffffff');
    }
    for (const [x, y] of [[36, 4], [104, 30], [142, 6], [184, 12], [218, 32], [282, 22], [4, 26], [316, 56], [76, 40]]) cv.set(x, y, Gd[4]);

    // Moonbow arching behind the castle.
    const bc = [CX, 172];
    BOW.forEach((c, i) => cv.fill(cv.mask().plot((x, y) => { const d = Math.hypot(x + 0.5 - bc[0], y + 0.5 - bc[1]); return d <= 150 - i * 4 && d > 146 - i * 4 && y < 120; }), c));

    // Back towers and the central keep (behind the wall).
    const flags = [];
    flags.push(tower(cv, 92, 48, 120, 26, 18, 34, { S: Sb, windows: [10] }).flag);
    flags.push(tower(cv, W - 92, 48, 120, 26, 18, 34, { S: Sb, windows: [10] }).flag);
    const keep = tower(cv, CX, 46, 120, 40, 16, 50, { S: Sb, windows: [6], boxes: false });
    flags.push(keep.flag);

    // Curtain wall with crenellations.
    const wall = cv.mask().rect(30, 84, W - 60, 156);
    for (let x = 30; x < W - 30; x += 12) wall.rect(x, 77, 7, 7);
    cv.shade(wall, St, { top: [6], left: [5], bottom: [2], right: [3], fill: 4 });
    for (let y = 90; y < 236; y += 7) for (let x = 34 + ((y / 7) % 2 ? 0 : 6); x < W - 34; x += 12) if (rnd() < 0.5) cv.rect(x, y, 5, 1, St[3]);

    // Bunting from the front towers to the back towers.
    for (const [x0, x1] of [[44, 79], [W - 79, W - 44]]) {
      const sag = (x) => 64 + Math.round(Math.sin(((x - x0) / (x1 - x0)) * Math.PI) * 5);
      for (let x = x0; x <= x1; x++) cv.set(x, sag(x), St[1]);
      for (let x = x0 + 3, k = 0; x < x1 - 3; x += 8, k++) {
        const c = [Rf[3], Gd[3], '#7af0ff'][k % 3];
        sprite(cv, x, sag(x + 2) + 1, ['kkkkk', 'kcccK', '.kcK.', '..k..'], { k: INK, K: INK, c });
      }
    }

    // The gate. Calm pale stone right around the opening (tympanum, jambs, sill)...
    const AX = 104, AY = 26, AT = 6; // segmental arch: half-width, rise, band thickness
    const inArch = (x, y, ax, ay) => ((x + 0.5 - CX) / ax) ** 2 + ((y + 0.5 - HY) / ay) ** 2 <= 1;
    const gateStone = cv.mask().plot((x, y) => y < HY && inArch(x, y, AX, AY)).rect(HX - 8, HY, HW + 16, HH + 8);
    cv.fill(gateStone, St[4]);
    for (let y = HY + 5; y < HY + HH + 6; y += 7) cv.rect(HX - 8, y, 8, 1, St[3]).rect(HX + HW, y, 8, 1, St[3]);
    // ...a rose window in the tympanum...
    const rcx = CX, rcy = HY - 12;
    cv.fill(cv.mask().circle(rcx, rcy, 8), Gd[1]);
    const rose = cv.mask().circle(rcx, rcy, 6);
    cv.fill(rose, (x, y) => { const a = Math.atan2(y + 0.5 - rcy, x + 0.5 - rcx), k = Math.floor(((a + Math.PI) / (2 * Math.PI)) * 8); return [Rf[3], '#a8d8ff', Gd[3], '#b8f0b0'][k % 4]; });
    for (let k = 0; k < 8; k++) { const a = (k * Math.PI) / 4; cv.fill(cv.mask().line(rcx, rcy, Math.round(rcx + Math.cos(a) * 6), Math.round(rcy + Math.sin(a) * 6)), Gd[1]); }
    cv.fill(cv.mask().circle(rcx, rcy, 1), Gd[4]);
    cv.outline(INK, cv.mask().circle(rcx, rcy, 8), { all: true });
    for (const dx of [-36, 36]) sprite(cv, rcx + dx - 2, rcy - 2, ['..a..', '.aba.', 'abcba', '.aba.', '..a..'], { a: St[3], b: Gd[3], c: '#ffffff' });
    // ...a gilded arch band with jewels and a heart keystone...
    const band = cv.mask().plot((x, y) => y < HY + 1 && inArch(x, y, AX + AT, AY + AT) && !inArch(x, y, AX, AY), CX - AX - AT - 1, HY - AY - AT - 1, CX + AX + AT + 1, HY + 1);
    cv.fill(band, (x, y) => { const k = Math.floor((Math.atan2(HY - y - 0.5, x + 0.5 - CX) / Math.PI) * 22); return k % 2 ? Gd[3] : Gd[2]; });
    cv.fill(band.and(band.shift(0, 1).not().or(band.shift(1, 0).not())).and(cv.mask().rect(0, 0, W, HY)), Gd[4]);
    cv.outline(INK, band, { all: true });
    for (const t of [0.18, 0.36, 0.64, 0.82]) {
      const a = Math.PI * t, x = Math.round(CX - Math.cos(a) * (AX + AT / 2)), y = Math.round(HY - Math.sin(a) * (AY + AT / 2));
      sprite(cv, x - 1, y - 1, ['.a.', 'abc', '.c.'], { a: '#ffd0ea', b: Rf[3], c: Rf[1] });
    }
    const heart = spriteMask(cv, CX - 4, HY - AY - AT - 2, SHAPES.heart);
    cv.outline(INK, heart, { all: true });
    cv.shade(heart, Rf, { top: [5], left: [4], bottom: [1], right: [2], fill: 3 });
    cv.set(CX - 2, HY - AY - AT, '#ffffff');
    // ...barley-twist columns with gold capitals and bases, and a gold threshold step.
    for (const x0 of [HX - 18, HX + HW + 8]) {
      const col = cv.mask().rect(x0, HY + 2, 10, HH + 4);
      cv.fill(col, (x, y) => ((x - x0 + y) % 8 < 4 ? Rf[4] : St[5]));
      cv.fill(col.and(cv.mask().rect(x0 + 7, 0, 3, H)), (x, y, c) => cv.step(c, -1));
      cv.rect(x0, HY + 2, 1, HH + 4, St[6]);
      cv.outline(INK, col, { all: true });
      for (const [y, h] of [[HY - 4, 6], [HY + HH + 6, 6]]) part(cv, cv.mask().rrect(x0 - 2, y, 14, h, 1), Gd, { top: [5], left: [4], bottom: [1], right: [2], fill: 3, dy: 1 });
      sprite(cv, x0 + 2, HY - 10, ['.....', '..a..', '.aba.', 'abcba'], { a: Gd[2], b: Gd[3], c: Gd[5] });
    }
    const step = cv.mask().rrect(HX - 22, HY + HH + 8, HW + 44, 6, 1);
    part(cv, step, Gd, { top: [5], left: [4], bottom: [1], right: [2], fill: 3, dy: 1 });
    for (let x = HX - 18; x < HX + HW + 20; x += 8) cv.set(x, HY + HH + 10, Gd[1]);
    inset(cv, ...HOLE, HR, { rim: INK, top: St[2], bottom: St[4], right: St[3] }, 1);

    // Front towers.
    flags.push(tower(cv, 24, 70, 236, 40, 22, 50, { windows: [24, 74] }).flag);
    flags.push(tower(cv, W - 24, 70, 236, 40, 22, 50, { windows: [24, 74] }).flag);

    // Pennants on every tower, each waving between two frames.
    const pal = [[Rf[1], Rf[3]], [Gd[1], Gd[3]], ['#3a8ad8', '#a8d8ff'], [Rf[1], Rf[3]], [Gd[1], Gd[3]]];
    flags.forEach(([x, y], i) => sprite(cv, x, y, FLAG.a, { p: pal[i][0], P: pal[i][1] }));
    const wave = cv.layer('wave'), base = cv.p.slice();
    flags.forEach(([x, y], i) => {
      wave.fill(cv.mask().rect(x, y, 8, 5), (px, py) => base[py * W + px]);
      sprite(wave, x, y, FLAG.b, { p: pal[i][0], P: pal[i][1] });
    });

    // Fluffy cloud base: a back bank, then the big front puffs the castle floats on.
    const back = [];
    for (let x = -10; x <= W + 10; x += 14 + Math.round(rnd() * 10)) back.push([x, 233 + Math.round(rnd() * 5), 9 + Math.round(rnd() * 7)]);
    cloud(cv, [...back, [8, 214, 16], [W - 8, 212, 17]], H - 2);
    const puffs = [];
    for (let x = -8; x <= W + 8; x += 16 + Math.round(rnd() * 12)) {
      const r = 10 + Math.round(rnd() * 11);
      puffs.push([x, Math.max(232 + r, 244 + Math.round(rnd() * 5)), r]);
    }
    cloud(cv, [...puffs, [22, 234, 20], [W - 22, 232, 21], [110, 250, 14], [210, 250, 15], [CX, 254, 12]], H - 2);
    cloud(cv, [[4, 150, 7], [-2, 158, 8], [12, 158, 6]], H);
    cloud(cv, [[W - 4, 130, 7], [W + 2, 138, 8], [W - 12, 138, 6]], H);

    cv.outline(INK);
    return cv.punch(...HOLE, HR);
  },
};
