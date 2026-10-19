// Engawa garden: a little wooden house front under a silver-grey tiled eave. The screen is the open
// doorway between cedar posts, koshi-shoji slid aside, a tatami edge at the threshold; in front, the
// engawa veranda, a pine bonsai, a stone lantern, a koi pond with circling koi, a maple branch in
// autumn red and a glass wind chime with a blank paper strip.
import { Canvas, ramp, rng, bayer } from '../pixel.mjs';
import { INK, inset, part, sprite, spriteMask } from '../kit.mjs';

const W = 256, H = 240, HOLE = [56, 52, 144, 108]; // 4:3
const Wd = ramp('#9a6a42', 7, { step: 0.11 }); // cedar posts and beams
const Ev = ramp('#a88660', 6, { step: 0.1, hue: 6 }); // weathered veranda boards
const Tl = ramp('#5d6577', 6, { step: 0.12, hue: 6, sat: 0.03 }); // ibushi roof tiles
const Pp = ramp('#e2d8bf', 5, { step: 0.06, hue: 6, sat: 0.03 }); // shoji paper
const St = ramp('#858072', 6, { step: 0.12, hue: 6, sat: 0.03 }); // granite
const Ms = ramp('#6a8a48', 5, { step: 0.11, sat: 0.05 }); // moss
const Gv = ramp('#bdb6a4', 4, { step: 0.07, sat: 0.03 }); // raked gravel
const Pn = ramp('#3d6b47', 5, { step: 0.11 }); // pine needles
const Mp = ramp('#d0432a', 6, { step: 0.11, hue: 9 }); // momiji
const Wa = ramp('#2c626c', 6, { step: 0.09, hue: 6 }); // pond water
const Tt = ramp('#a6a462', 4, { step: 0.09 }); // tatami
const Cl = ramp('#8a5240', 5, { step: 0.11 }); // clay pot
const Er = ramp('#6a4a36', 4, { step: 0.1 }); // earth
const Gl = ['#5f8e9e', '#9ccbd6', '#d6eef2', '#ffffff']; // chime glass
const HE = '#2a2f52'; // tatami heri (indigo cloth)
const KOI = { w: '#f7f1e3', W: '#d9cfbd', o: '#f0782c', r: '#d4432a', g: '#f2c446', G: '#c99a2a', k: '#2a2430' };

const LEAF = ['....#....', '....#....', '#..###..#', '.#.###.#.', '..#####..', '#########', '.#.###.#.', '....#....', '....#....'];
const LEAF5 = ['..#..', '#.#.#', '.###.', '#####', '..#..'];

// Eave line: straight with the corners swept up (sori).
const eave = (x) => 33 - Math.round(Math.max(0, Math.abs(x + 0.5 - 128) - 92) ** 1.6 * 0.022);

/** Koi as a chain of shrinking discs from the head back along `ang`, bent by `bend`, plus a tail fan. */
function koiMask(cv, hx, hy, ang, bend = 0) {
  const prof = [1.3, 1.9, 2.2, 2.3, 2.2, 2, 1.7, 1.4, 1.1, 0.8, 0.6];
  const m = cv.mask(), spine = [];
  let x = hx, y = hy, a = ang;
  for (let i = 0; i < prof.length; i++) {
    spine.push([x, y, prof[i]]);
    a += bend * 0.06;
    x -= Math.cos(a); y -= Math.sin(a);
  }
  for (const [cx, cy, r] of spine) m.plot((i, j) => Math.hypot(i + 0.5 - cx, j + 0.5 - cy) <= r, cx - 3, cy - 3, cx + 4, cy + 4);
  const [tx, ty] = spine[spine.length - 1], nx = -Math.sin(a), ny = Math.cos(a);
  const fan = cv.mask().poly([[tx + 0.5, ty + 0.5], [tx - Math.cos(a) * 4 + nx * 2.6 + 0.5, ty - Math.sin(a) * 4 + ny * 2.6 + 0.5],
    [tx - Math.cos(a) * 3 + 0.5, ty - Math.sin(a) * 3 + 0.5], [tx - Math.cos(a) * 4 - nx * 2.6 + 0.5, ty - Math.sin(a) * 4 - ny * 2.6 + 0.5]]);
  return { m: m.or(fan), spine, fan };
}

function drawKoi(cv, clip, water, hx, hy, ang, bend, kind) {
  const { m, spine, fan } = koiMask(cv, hx, hy, ang, bend);
  cv.fill(m.dilate(1).shift(1, 2).and(clip).sub(m), (x, y, c) => cv.step(c || water, -1)); // shadow on the pond floor
  const body = m.and(clip);
  const near = (x, y) => { let b = 0, d = 1e9; spine.forEach(([cx, cy], i) => { const e = Math.hypot(x + 0.5 - cx, y + 0.5 - cy); if (e < d) { d = e; b = i; } }); return b; };
  cv.fill(body, (x, y) => {
    const i = near(x, y);
    if (fan.has(x, y) && i >= spine.length - 1) return kind === 'g' ? KOI.G : KOI.W;
    if (kind === 'g') return i < 2 ? KOI.g : KOI.g;
    if (kind === 'k') return (i >= 1 && i <= 3) || (i >= 6 && i <= 7) ? KOI.r : KOI.w; // kohaku: red saddles
    return i === 0 ? KOI.w : i >= 2 && i <= 6 ? KOI.o : KOI.w; // orange back, white nose and tail
  });
  // Lit back stripe and a darker belly edge so they read as round.
  cv.fill(body.edge().and(body.shift(1, 1)).sub(body.shift(-1, -1)), (x, y, c) => cv.step(c, -1));
  cv.outline(Wa[0], body);
  const [ex, ey] = spine[1];
  cv.set(Math.round(ex - 0.5), Math.round(ey - 0.5), KOI.k);
  return m;
}

export default {
  id: 'px-japan-engawa', name: 'Engawa Garden', theme: 'japanese', rarity: 'rare', translucent: false,
  collection: 'world-tour', license: 'CC-BY-4.0',
  desc: 'Slide the shoji open and play on the veranda while koi circle the pond and maple leaves turn red.',
  tags: ['japanese', 'garden', 'koi', 'autumn', 'animated', 'pixel'],
  css: '.k1{animation:kf 4.4s steps(1) -3.3s infinite}.k2{animation:kf 4.4s steps(1) -2.2s infinite}' +
    '.k3{animation:kf 4.4s steps(1) -1.1s infinite}@keyframes kf{0%{opacity:1}25%,100%{opacity:0}}' +
    '.fu{animation:fu 1.6s steps(1) infinite}@keyframes fu{50%{opacity:0}}' +
    '.lf{animation:lf 3s steps(1) infinite}@keyframes lf{0%,70%{opacity:1}71%,100%{opacity:0}}',
  draw() {
    const cv = new Canvas(W, H), rnd = rng(11);
    cv.use(Wd, Ev, Tl, Pp, St, Ms, Pn, Mp, Wa, Tt, Cl, Er);

    // ---- ground slab (a diorama cut of moss over earth) and the pond -------------------------------
    const ground = cv.mask().rrect(2, 184, W - 4, 54, [0, 0, 9, 9]);
    cv.fill(ground, (x, y) => (y >= 230 ? Er[y >= 234 ? 1 : 2] : (y % 3 === 0 ? Gv[1] : Gv[2])));
    cv.fill(ground.and(cv.mask().rect(0, 230, W, 1)), Er[3]);
    for (let x = 6; x < W - 6; x += 9) cv.set(x + (x % 2), 235, Er[0]);
    const pond = cv.mask().oval(98, 198, 152, 32).or(cv.mask().oval(150, 202, 98, 28)).and(cv.mask().rect(0, 0, W, 228));
    // moss banks hugging the pond and the lantern, with a ripple of rake lines around them
    const moss = cv.mask().oval(88, 194, 168, 38).or(cv.mask().oval(2, 214, 50, 20)).or(cv.mask().oval(48, 190, 52, 16)).and(ground).clip(0, 0, W, 230);
    cv.fill(moss.dilate(2).sub(moss).and(ground).clip(0, 0, W, 230), Gv[1]);
    cv.fill(moss.dilate(1).sub(moss).and(ground).clip(0, 0, W, 230), Gv[2]);
    cv.fill(moss, (x, y) => Ms[2]);
    cv.fill(moss.edge().and(moss.shift(0, 1).not().or(moss.shift(1, 0).not())), Ms[1]);
    cv.fill(moss.edge().and(moss.shift(0, -1).not()), Ms[3]);
    for (let i = 0; i < 40; i++) { const x = Math.floor(rnd() * W), y = 190 + Math.floor(rnd() * 40); if (moss.erode(1).has(x, y)) cv.set(x, y, Ms[3]).set(x + 1, y, Ms[4]); }
    cv.grad(pond, [Wa[1], Wa[2], Wa[2], Wa[3]], { soft: 0.8 });
    cv.fill(pond.and(cv.mask().rect(0, 196, W, 6)), Wa[1]);
    const water = pond.erode(1);

    // ---- roof: ridge, tile columns, swept-up eave with round tile ends ----------------------------
    const roof = cv.mask().plot((x, y) => y >= 9 + Math.max(0, Math.abs(x + 0.5 - 128) - 100) * 0.85 && y <= eave(x), 0, 0, W, 40);
    cv.fill(roof, (x, y) => {
      const t = (((x - 4) % 8) + 8) % 8, s = t < 1 ? 4 : t < 3 ? 3 : t < 5 ? 2 : 1;
      const course = (eave(x) - y) % 6 === 5;
      return Tl[Math.max(0, s - (course ? 1 : 0))];
    });
    for (const s of [-1, 1]) { // hip ridges
      const a = 128 + s * 100, b = 128 + s * 127;
      part(cv, cv.mask().capsule(a, 10, b, eave(b) - 3, 1.6), Tl, { top: [5], left: [4], bottom: [1], right: [2], fill: 3, shadow: false });
    }
    const ridge = cv.mask().rrect(24, 3, 208, 8, 2);
    part(cv, ridge, Tl, { top: [5], left: [4], bottom: [0], right: [1], fill: 3, dy: 1 });
    cv.fill(cv.mask().rect(26, 7, 204, 1), Tl[2]);
    for (const x of [18, 226]) { // plain end tiles of the ridge
      part(cv, cv.mask().rrect(x, 0, 12, 12, [5, 5, 1, 1]), Tl, { top: [5], left: [4], bottom: [1], right: [2], fill: 3, dy: 1 });
      cv.rect(x + 3, 8, 6, 1, Tl[1]);
    }
    cv.outline(INK, roof.or(ridge));
    const under = cv.mask().plot((x, y) => y > eave(x) && y < 38, 0, 0, W, 38);
    cv.fill(under, Wd[0]);
    for (let x = 2; x < W - 2; x += 8) cv.rect(x, 35, 3, 2, Wd[2]).set(x, 35, Wd[3]); // rafter ends
    for (let x = 4; x < W; x += 8) { // round eave tiles
      const c = cv.mask().circle(x, eave(x) + 1, 3);
      part(cv, c, Tl, { top: [5], left: [4], bottom: [1], right: [1], fill: 3, shadow: false });
      cv.set(x, eave(x) + 1, Tl[2]);
    }

    // ---- house front: beam, kamoi, shikii, posts, shoji slid aside --------------------------------
    const grain = (m, R, dir) => cv.fill(m, (x, y, c) => {
      const k = dir === 'v' ? Math.sin(x * 1.7 + Math.sin(y * 0.09 + x) * 2) : Math.sin(y * 2.3 + Math.sin(x * 0.07 + y) * 2);
      return k > 0.93 ? cv.step(c, -1) : c;
    });
    const beam = cv.mask().rect(2, 37, W - 4, 6);
    part(cv, beam, Wd, { top: [4], left: [4], bottom: [1], right: [2], fill: 3, dy: 1 });
    grain(beam.erode(1), Wd, 'h');

    for (const [x0, flip] of [[10, false], [214, true]]) { // koshi-shoji, kumiko lattice over paper
      const panel = cv.mask().rect(x0, 43, 32, 124);
      cv.fill(panel, Wd[4]);
      const paper = cv.mask().rect(x0 + 2, 45, 28, 100);
      cv.grad(paper, [Pp[4], Pp[3], Pp[3], Pp[2]], { soft: 0.25 });
      for (let x = x0 + 2 + 6; x < x0 + 30; x += 7) cv.rect(x, 45, 1, 100, Wd[4]);
      for (let y = 45 + 9; y < 145; y += 10) cv.rect(x0 + 2, y, 28, 1, Wd[4]);
      cv.fill(paper.and(cv.mask().rect(0, 45, W, 1)), Wd[2]);
      cv.fill(cv.mask().rect(x0 + 2, 45, 1, 100), Wd[3]);
      const kick = cv.mask().rect(x0 + 2, 147, 28, 18);
      cv.shade(kick, Wd, { top: [1], left: [2], bottom: [5], right: [4], fill: 3 });
      grain(kick.erode(1), Wd, 'v');
      cv.rect(x0, 145, 32, 2, Wd[4]).rect(x0, 145, 32, 1, Wd[5]);
      cv.rect(x0 + (flip ? 3 : 26), 102, 2, 8, Wd[2]).rect(x0 + (flip ? 3 : 26), 102, 1, 8, Wd[1]); // finger pull
    }
    const frame = cv.mask().rect(42, 43, 172, 131).or(cv.mask().rect(4, 43, 6, 131)).or(cv.mask().rect(246, 43, 6, 131))
      .or(cv.mask().rect(4, 43, W - 8, 4)).or(cv.mask().rect(4, 166, W - 8, 8));
    cv.cast(frame.dilate(1), 1, 1, -1);
    cv.shade(frame, Wd, { top: [5], left: [5], bottom: [1], right: [2], fill: 3 });
    grain(frame.erode(1), Wd, 'v');
    cv.fill(cv.mask().rect(4, 47, W - 8, 1), Wd[1]); // kamoi groove shadow
    cv.fill(cv.mask().rect(10, 166, 32, 1).or(cv.mask().rect(214, 166, 32, 1)), Wd[1]); // shikii grooves
    cv.outline(INK, frame.or(cv.mask().rect(10, 43, 32, 124)).or(cv.mask().rect(214, 43, 32, 124)), { all: false });
    for (const x of [42, 213, 9, 246]) cv.rect(x, 47, 1, 119, INK);
    cv.rect(10, 166, 32, 1, INK).rect(214, 166, 32, 1, INK);

    // Tatami edge just inside the threshold, then the recessed doorway.
    const tat = cv.mask().rect(53, 163, 150, 4);
    cv.fill(tat, (x, y) => (y === 163 ? HE : Tt[(x + (y & 1)) % 3 === 0 ? 1 : 2]));
    for (let x = 54; x < 203; x += 4) cv.set(x, 163, '#4a5078');
    cv.rect(53, 167, 150, 1, Wd[2]);
    inset(cv, ...HOLE, 0, { rim: INK, top: Wd[0], left: Wd[1], bottom: Wd[2], right: Wd[2] }, 2);

    // ---- engawa veranda ---------------------------------------------------------------------------
    const deck = cv.mask().rect(0, 174, W, 12);
    cv.fill(deck, (x, y) => Ev[(y - 174) % 3 === 2 ? 2 : (y - 174) % 3 === 0 ? 4 : 3]);
    for (let y = 174; y < 186; y += 3) { const o = Math.floor(rnd() * 60); for (let x = o; x < W; x += 58 + Math.floor(rnd() * 20)) cv.rect(x, y, 1, 2, Ev[1]); }
    cv.fill(deck.and(cv.mask().rect(0, 174, W, 1)), Ev[1]); // shadow under the sill
    const edge = cv.mask().rect(0, 186, W, 6);
    cv.shade(edge, Ev, { top: [5], left: [4], bottom: [0], right: [1], fill: 3 });
    cv.rect(0, 192, W, 2, Er[0]);
    for (const x of [14, 76, 140, 204, 244]) { // short stilts on footing stones
      cv.rect(x, 192, 5, 5, Wd[1]).rect(x, 192, 1, 5, Wd[2]);
      part(cv, cv.mask().rrect(x - 2, 196, 9, 4, 1), St, { top: [4], left: [3], bottom: [1], right: [1], fill: 2 });
    }
    cv.outline(INK, deck.or(edge));
    cv.rect(0, 174, W, 1, INK).rect(0, 173, W, 1, INK);

    // Kutsunugi-ishi under the step, stepping stones toward the lantern.
    for (const [x, y, w, h] of [[56, 193, 36, 9], [32, 206, 14, 6], [52, 214, 13, 6], [72, 222, 14, 6]]) {
      part(cv, cv.mask().rrect(x, y, w, h, 3), St, { top: [5], left: [4], bottom: [1], right: [2], fill: 3, dy: 1 });
    }

    // Pond rim stones and ripples.
    const rim = [[96, 211, 10, 8], [102, 222, 12, 7], [116, 228, 14, 6], [140, 229, 12, 5], [176, 229, 16, 6], [206, 228, 12, 6],
      [228, 222, 14, 8], [240, 210, 12, 9], [112, 199, 9, 5], [234, 201, 9, 6]];
    for (const [x, y, w, h] of rim) part(cv, cv.mask().oval(x, y, w, h), St, { top: [5], left: [4], bottom: [1], right: [2], fill: 3, dy: 1 });
    let pads = cv.mask();
    for (const [x, y, w, h, notch] of [[120, 214, 11, 6, 1], [208, 206, 9, 5, -1], [196, 217, 7, 4, 1]]) {
      const p = cv.mask().oval(x, y, w, h).sub(cv.mask().poly([[x + w / 2, y + h / 2], [x + w / 2 + notch * w, y], [x + w / 2 + notch * w, y + 1]]));
      pads = pads.or(p);
    }
    const swim = water.sub(pads);
    const base = cv.p.slice();
    const KOIS = [ // positions around a lazy loop: [hx, hy, ang, bend] per frame, per fish
      [[132, 207, 0.15, -1], [168, 209, 0.25, 1], [206, 214, 1.9, 2], [164, 222, 3.1, -1]],
      [[214, 223, 3.35, 1], [178, 220, 3.0, -1], [140, 216, 3.4, 1], [180, 206, 0.0, 1]],
      [[150, 224, -0.2, 1], [190, 210, -0.6, -1], [150, 205, 3.1, 1], [118, 220, 2.6, -1]],
    ];
    const kinds = ['k', 'o', 'g'];
    KOIS.forEach((f, n) => drawKoi(cv, swim, Wa[2], ...f[0], kinds[n]));
    const allKoi = KOIS.flatMap((f) => f.map((p) => koiMask(cv, ...p).m.dilate(2))).reduce((a, b) => a.or(b), cv.mask()).and(swim);
    for (let k = 1; k < 4; k++) {
      const l = cv.layer(`k${k}`);
      l.fill(allKoi, (x, y) => base[y * W + x]);
      KOIS.forEach((f, n) => drawKoi(l, swim, Wa[2], ...f[k], kinds[n]));
    }
    cv.fill(pads, Ms[3]);
    cv.fill(pads.edge().and(pads.shift(-1, -1).not()), Ms[1]);
    cv.fill(pads.edge().and(pads.shift(1, 1).not()), Ms[4]);
    for (const [x, y, w] of [[104, 205, 8], [180, 202, 10], [226, 214, 6], [140, 225, 8]]) cv.rect(x, y, w, 1, Wa[4]).set(x + 2, y, Wa[5]);

    // ---- stone lantern (left, standing in the moss) -----------------------------------------------
    const L = 25, lp = (m, o = {}) => part(cv, m, St, { top: [5], left: [4], bottom: [1], right: [2], fill: 3, ...o });
    cv.dither(cv.mask().oval(L - 17, 226, 36, 8), Ms[1], Ms[2], 0.5); // soft floor shadow
    lp(cv.mask().poly([[L - 12, 232], [L + 13, 232], [L + 10, 226], [L - 9, 226]]));
    lp(cv.mask().rect(L - 6, 223, 13, 3));
    lp(cv.mask().rect(L - 4, 200, 9, 23), { left: [4, 3], fill: 2 });
    cv.rect(L - 4, 211, 9, 1, St[1]);
    lp(cv.mask().poly([[L - 10, 200], [L + 11, 200], [L + 8, 194], [L - 7, 194]]));
    const box = cv.mask().rect(L - 7, 180, 15, 14);
    lp(box);
    const win = cv.mask().rect(L - 3, 183, 7, 8);
    cv.fill(win, '#2a1a14');
    cv.fill(win.erode(1), '#f2a94a').fill(cv.mask().rect(L - 2, 184, 3, 3), '#ffe0a0');
    cv.layer('lf').fill(win.erode(1), '#ffc96a').fill(cv.mask().rect(L - 1, 185, 2, 2), '#fff4c8');
    const kasa = cv.mask().poly([[L - 16, 180], [L + 17, 180], [L + 12, 174], [L + 3, 168], [L - 2, 168], [L - 11, 174]])
      .or(cv.mask().rect(L - 17, 177, 3, 3)).or(cv.mask().rect(L + 15, 177, 3, 3));
    lp(kasa, { top: [5], left: [4, 4], fill: 3 });
    cv.set(L - 17, 176, St[4]).set(L + 17, 176, St[3]); // curled-up corners
    cv.outline(INK, cv.mask().pts([[L - 17, 176], [L + 17, 176]]));
    const hoju = cv.mask().circle(L, 164, 3).or(cv.mask().rect(L - 1, 160, 3, 2)).or(cv.mask().pts([[L, 159]]));
    lp(hoju, { shadow: false });
    for (let i = 0; i < 18; i++) { const x = L - 9 + Math.floor(rnd() * 19), y = 196 + Math.floor(rnd() * 30); if (cv.get(x, y) === St[3]) cv.set(x, y, rnd() < 0.5 ? Ms[2] : St[2]); } // lichen

    // ---- bonsai pine on the veranda (right) -------------------------------------------------------
    const pot = cv.mask().poly([[211, 176], [249, 176], [246, 185], [214, 185]]);
    part(cv, pot, Cl, { top: [4], left: [3], bottom: [0], right: [1], fill: 2, dy: 1 });
    cv.rect(212, 177, 36, 1, Cl[3]);
    cv.rect(216, 185, 4, 1, INK).rect(240, 185, 4, 1, INK);
    const trunk = cv.mask();
    const T = [[232, 176], [229, 170], [233, 163], [238, 157], [234, 150], [226, 146], [220, 142]];
    T.forEach(([x, y], i) => i && trunk.capsule(T[i - 1][0], T[i - 1][1], x, y, i < 3 ? 2.2 : 1.6));
    trunk.capsule(234, 160, 244, 156, 1.2).capsule(233, 152, 240, 142, 1.1);
    part(cv, trunk, Wd, { top: [3], left: [3], bottom: [0], right: [1], fill: 2 });
    for (const [x, y] of [[231, 168], [235, 159], [230, 148]]) cv.set(x, y, Wd[0]);
    for (const [x, y, w, h] of [[204, 134, 30, 11], [228, 136, 22, 9], [236, 150, 18, 9], [214, 152, 18, 8]]) { // needle pads
      const pad = cv.mask().oval(x, y, w, h).or(cv.mask().oval(x + 3, y - 2, w - 6, h - 2));
      part(cv, pad, Pn, { top: [4], left: [3], bottom: [0], right: [1], fill: 2, dy: 1 });
      for (let tx = x + 3; tx < x + w - 3; tx += 4) cv.set(tx, y + 1 + (tx % 3 ? 0 : 1), Pn[4]).set(tx + 1, y + 1 + (tx % 3 ? 0 : 1), Pn[4]);
      for (let tx = x + 4; tx < x + w - 2; tx += 5) cv.set(tx, y + h - 3, Pn[1]).set(tx + 1, y + h - 4, Pn[1]);
    }
    cv.fill(cv.mask().oval(213, 179, 34, 3), Er[1]); // soil

    // ---- glass wind chime hanging from the beam ---------------------------------------------------
    const F = 30;
    cv.rect(F, 43, 1, 5, INK);
    const bell = cv.mask().oval(F - 5, 47, 11, 11).clip(0, 47, W, 8);
    cv.outline(INK, bell, { all: true });
    cv.shade(bell, Gl, { top: [3], left: [2], bottom: [0], right: [1], fill: 1 });
    cv.px([[F - 3, 50], [F - 3, 51], [F - 2, 49]], '#ffffff');
    cv.px([[F - 1, 52], [F, 53], [F + 1, 52], [F + 2, 53], [F - 2, 53]], Mp[2]); // painted maple sprig
    cv.rect(F, 55, 1, 5, INK).rect(F - 1, 56, 3, 1, Gl[1]);
    const strip = (c, dx) => { c.rect(F + dx, 60, 1, 1, INK); c.rect(F - 2 + dx, 61, 5, 15, INK); c.rect(F - 1 + dx, 62, 3, 13, Pp[4]); c.rect(F + 1 + dx, 62, 1, 13, Pp[3]); };
    strip(cv, 0);
    const fu = cv.layer('fu');
    // repaint the shoji behind the strip, then the strip swung one pixel right
    fu.fill(cv.mask().rect(F - 2, 60, 6, 16), (x, y) => base[y * W + x]);
    strip(fu, 1);

    // ---- maple branch over the right of the roof --------------------------------------------------
    const br = cv.mask();
    const B = [[256, 30], [240, 22], [222, 18], [204, 12], [188, 10]];
    B.forEach(([x, y], i) => i && br.capsule(B[i - 1][0], B[i - 1][1], x, y, i < 2 ? 1.8 : 1.1));
    br.capsule(232, 20, 226, 6, 0.9).capsule(212, 15, 214, 30, 0.8);
    part(cv, br, Wd, { top: [2], left: [2], bottom: [0], right: [1], fill: 1 });
    const leaves = [[184, 4], [192, 10], [198, 2], [206, 8], [214, 0], [220, 12], [228, 2], [236, 10], [244, 16], [250, 24],
      [208, 24], [216, 28], [200, 16], [240, 26], [222, 22], [232, 18], [246, 4]];
    leaves.forEach(([x, y], i) => {
      const m = spriteMask(cv, x, y, LEAF), k = [2, 3, 1, 4, 2, 3][i % 6];
      cv.cast(m.dilate(1), 1, 1, -1);
      cv.fill(m.ring(), Mp[0]);
      cv.fill(m, (px, py) => Mp[px + py < x + y + 7 ? Math.min(5, k + 1) : px + py > x + y + 10 ? k - 1 : k]);
      cv.set(x + 4, y + 4, Mp[Math.max(0, k - 1)]).set(x + 4, y + 5, Mp[Math.max(0, k - 1)]);
    });
    // fallen leaves on the deck and floating on the water
    for (const [x, y, k] of [[96, 178, 2], [150, 180, 3], [186, 209, 4], [128, 222, 2], [62, 196, 3]]) {
      const m = spriteMask(cv, x, y, LEAF5);
      cv.cast(m, 1, 1, -1).fill(m, Mp[k]).set(x + 2, y + 1, Mp[k + 1]);
    }

    cv.outline(INK);
    return cv.punch(...HOLE);
  },
};
