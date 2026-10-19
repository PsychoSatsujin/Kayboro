// Ramen cart: a night-time yatai with a slate tile roof, short indigo noren over the screen, a red paper
// lantern, a wooden counter with a steaming bowl of ramen, a stack of bowls, stools and big cart wheels.
import { Canvas, ramp, rng, bayer } from '../pixel.mjs';
import { INK, inset, part, sprite, spriteMask } from '../kit.mjs';

const W = 288, H = 256, HOLE = [72, 60, 144, 108], HR = 3; // 4:3
const Wd = ramp('#9a6440', 7, { step: 0.09, hue: 5, sat: 0.03 }); // cart wood
const Dk = ramp('#5e3a2c', 6, { step: 0.08, hue: 6, sat: 0.04 }); // dark lacquered wood
const Tl = ramp('#58607a', 6, { step: 0.1, hue: 6, sat: 0.03 }); // slate roof tiles
const Nr = ramp('#2c3f86', 5, { hue: 6 }); // indigo noren
const Rd = ramp('#d23a2c', 6, { step: 0.12, hue: 8 }); // lantern / bowl red
const Ce = ramp('#ece4d6', 5, { step: 0.08, hue: 6, sat: 0.04 }); // ceramic
const Br = ramp('#d9a043', 5, { step: 0.12, hue: 6 }); // broth / noodles
const Ch = ramp('#c07a5a', 5, { step: 0.1, hue: 6 }); // chashu
const Fe = ['#14121a', '#262330', '#3b3748', '#565166', '#7c7790']; // iron
const Bm = ['#5a6a2a', '#8a9a3a', '#b8c25a', '#e0e490']; // bamboo rod
const Sm = ['#9c94bc', '#c9c2e2', '#eeeaff', '#ffffff']; // steam
const SH = '#120e1a'; // floor shadow

const bevel = (n) => ({ top: [n - 1], left: [n - 2], bottom: [0], right: [1], fill: n - 3 });

// Raimon (thunder meander) band, the classic ramen-bowl border: a 6px repeating square hook.
const RAIMON = ['######', '#....#', '#.##.#', '#.#..#', '#.####'];
function raimon(cv, m, x0, y0, c) {
  m.each((x, y) => {
    const r = RAIMON[y - y0];
    if (r && r[(((x - x0) % 6) + 6) % 6] === '#') cv.set(x, y, c);
  });
}

// A ramen bowl seen slightly from above: rim ellipse, tapering body with a red meander band, foot ring.
function bowl(cv, cx, top, w, { inner = null, nested = false } = {}) {
  const half = w >> 1, x0 = cx - half;
  const body = cv.mask().poly([[x0, top + 4], [x0 + w, top + 4], [x0 + w - 4, top + 15], [cx + 7, top + 18], [cx - 7, top + 18], [x0 + 4, top + 15]]);
  const well = cv.mask().oval(x0 + 2, top + 1, w - 4, 7);
  // A nested bowl only shows its front lip: the bowl stacked inside hides its well and back rim.
  const rim = nested ? cv.mask().oval(x0, top, w, 9).sub(well).clip(0, top + 4, cv.w, 9) : cv.mask().oval(x0, top, w, 9);
  const foot = cv.mask().rect(cx - 7, top + 18, 14, 3);
  const all = body.or(rim).or(foot);
  if (!nested) cv.cast(all.dilate(1), 1, 1, -1);
  cv.outline(INK, all, { all: true });
  cv.shade(body.or(foot), Ce, { top: [4], left: [3, 3], bottom: [1], right: [1, 2], fill: 2 });
  const band = body.and(cv.mask().rect(0, top + 8, cv.w, 5));
  cv.fill(band, Ce[3]);
  raimon(cv, band, x0 + 2, top + 8, Rd[2]);
  cv.fill(body.and(cv.mask().rect(0, top + 14, cv.w, 1)), Rd[1]);
  cv.fill(foot, Ce[1]).fill(foot.and(cv.mask().rect(0, top + 18, cv.w, 1)), Ce[0]);
  cv.fill(rim, Ce[4]);
  if (nested) return all;
  if (inner) inner(well);
  else {
    cv.fill(well, Ce[1]);
    cv.fill(well.and(well.shift(0, 2)), Ce[2]);
  }
  return all;
}

export default {
  id: 'px-ramen', name: 'Ramen Cart', theme: 'ramen', rarity: 'rare', translucent: false,
  desc: 'Pull up a stool at a cozy night ramen cart and slurp along while you play.',
  tags: ['ramen', 'food', 'japan', 'street-food', 'animated', 'pixel'],
  collection: 'world-tour', license: 'CC-BY-4.0',
  css: '.sa{animation:st 1.6s steps(1) infinite}.sb{animation:st 1.6s steps(1) -.8s infinite}@keyframes st{50%{opacity:0}}' +
    '.lf{animation:lf 2.8s steps(1) infinite}@keyframes lf{0%,38%{opacity:1}39%,52%{opacity:0}53%,100%{opacity:1}}',
  draw() {
    const cv = new Canvas(W, H), rnd = rng(11);
    cv.use(Wd, Dk, Tl, Nr, Rd, Ce, Br, Ch, Fe, Bm);

    // --- cart body, wheels behind the counter ------------------------------------------------------
    const body = cv.mask().rect(40, 190, 208, 44);
    cv.fill(body, (x, y) => {
      const k = Math.floor((x - 40) / 13), f = (x - 40) % 13;
      return f === 0 ? Wd[0] : f === 1 ? Wd[4] : Wd[k % 2 ? 2 : 3];
    });
    cv.fill(body.and(cv.mask().rect(0, 190, W, 3)), Wd[1]);
    for (const y of [204, 222]) cv.rect(40, y, 208, 3, Dk[2]).rect(40, y, 208, 1, Dk[4]).rect(40, y + 3, 208, 1, Dk[0]);
    for (let i = 0; i < 40; i++) { // grain flecks
      const x = 42 + Math.floor(rnd() * 204), y = 194 + Math.floor(rnd() * 38);
      if (body.has(x, y) && cv.get(x, y) !== Wd[0]) cv.rect(x, y, 1, 2 + Math.floor(rnd() * 3), Wd[1]);
    }
    cv.outline(INK, body, { all: true });

    // --- posts and back panel ----------------------------------------------------------------------
    const panel = cv.mask().rect(64, 38, 160, 140);
    cv.fill(panel, Dk[1]);
    for (const x of [52, 224]) {
      const post = cv.mask().rect(x, 38, 12, 142);
      part(cv, post, Wd, { top: [5], left: [5, 4], bottom: [1], right: [1, 2], fill: 3, shadow: false });
      for (let y = 44; y < 176; y += 9 + Math.floor(rnd() * 8)) cv.rect(x + 4 + Math.floor(rnd() * 4), y, 1, 4, Wd[2]);
    }

    // Lacquered window frame with the recessed screen.
    const frame = cv.mask().rrect(64, 51, 160, 126, 4);
    part(cv, frame, Dk, { top: [5], left: [4], bottom: [0], right: [1], fill: 3, shadow: false });
    cv.fill(cv.mask().rrect(66, 53, 156, 122, 3).edge(), Dk[2]);
    inset(cv, ...HOLE, HR, { rim: INK, top: Dk[0], left: Dk[1], bottom: Dk[4], right: Dk[3] }, 2);

    // --- roof ----------------------------------------------------------------------------------------
    const beam = cv.mask().rect(6, 33, 276, 6);
    part(cv, beam, Dk, { top: [5], left: [4], bottom: [0], right: [1], fill: 3, shadow: false });
    const roof = cv.mask().poly([[26, 8], [262, 8], [284, 31], [4, 31]]);
    const xl = (y) => 26 - ((y - 8) * 22) / 23, xr = (y) => 262 + ((y - 8) * 22) / 23, N = 26;
    cv.fill(roof, (x, y) => {
      const u = ((x + 0.5 - xl(y + 0.5)) / (xr(y + 0.5) - xl(y + 0.5))) * N, f = u - Math.floor(u);
      let i = f < 0.12 ? 0 : f < 0.22 ? 4 : f < 0.42 ? 3 : f < 0.52 ? 2 : 1;
      if ((y - 8) % 5 === 4) i = Math.max(0, i - 1);
      if ((y - 8) % 5 === 0 && i > 1) i = Math.min(5, i + 1);
      return Tl[i];
    });
    cv.outline(INK, roof, { all: true });
    // Ridge with gently flared ends.
    const ridge = cv.mask().rect(24, 4, 240, 5).or(cv.mask().poly([[13, 1], [28, 4], [28, 9], [19, 9]])).or(cv.mask().poly([[275, 1], [260, 4], [260, 9], [269, 9]]));
    part(cv, ridge, Tl, { top: [5], left: [4], bottom: [0], right: [1], fill: 2, shadow: false });
    cv.rect(28, 5, 232, 1, Tl[3]);
    // Eave tile caps under every ridge row.
    cv.rect(4, 31, 280, 3, Tl[1]);
    for (let k = 0; k < N; k++) {
      const cx = Math.round(xl(31) + ((k + 0.32) / N) * (xr(31) - xl(31)));
      const cap = cv.mask().circle(cx, 32, 2, 1.3);
      cv.outline(INK, cap, { all: true });
      cv.shade(cap, Tl, { top: [5], left: [4], bottom: [1], right: [2], fill: 3 });
      cv.set(cx, 32, Tl[1]);
    }

    // --- noren: three short indigo panels on a bamboo rod -----------------------------------------
    for (let i = 0; i < 3; i++) {
      const x = 69 + i * 51, p = cv.mask().rect(x, 41, 48, 15);
      part(cv, p, Nr, { top: [3], left: [3], bottom: [0, 1], right: [1], fill: 2, dy: 1 });
      cv.rect(x + 1, 41, 46, 3, Nr[3]).rect(x + 1, 44, 46, 1, Nr[1]);
      cv.fill(cv.mask().rect(x + 2, 45, 4, 8), (px, py) => (bayer(px, py) < 0.5 ? Nr[3] : Nr[2]));
    }
    sprite(cv, 137, 45, ['...#...#...#...', '..#...#...#....', '...#...#...#...', '...............', '###############', '.#############.', '...#########...'], { '#': Ce[3] });
    const rod = cv.mask().rect(64, 39, 160, 2);
    part(cv, rod, Bm, { top: [3], left: [3], bottom: [0], right: [0], fill: 2, shadow: false });
    for (const x of [96, 148, 200]) cv.set(x, 40, Bm[0]);

    // --- counter -------------------------------------------------------------------------------------
    const top = cv.mask().rect(2, 177, 284, 8), lip = cv.mask().rect(2, 185, 284, 7);
    part(cv, top.or(lip), Wd, { top: [6], left: [5], bottom: [1], right: [2], fill: 5, dy: 2 });
    cv.fill(top.erode(1), (x, y) => (y === 178 ? Wd[6] : Wd[5]));
    for (let i = 0; i < 26; i++) cv.rect(6 + Math.floor(rnd() * 270), 179 + Math.floor(rnd() * 5), 3 + Math.floor(rnd() * 8), 1, Wd[4]);
    cv.fill(lip.erode(1), Wd[3]);
    cv.rect(3, 185, 282, 1, Wd[2]).rect(3, 190, 282, 1, Wd[1]);

    // Chopsticks on a little ceramic rest, under the screen.
    const rest = cv.mask().rrect(158, 181, 7, 3, 1);
    cv.cast(rest.dilate(1), 1, 1, -1).outline(INK, rest, { all: true });
    cv.fill(rest, Ce[3]).rect(159, 183, 5, 1, Ce[1]);
    const sticks = cv.mask().rect(126, 180, 42, 1).rect(129, 181, 41, 1);
    cv.cast(sticks.dilate(1), 1, 1, -1).outline(INK, sticks, { all: true });
    cv.fill(sticks, (x, y) => (x > 161 ? Ce[4] : y === 180 ? Rd[2] : Rd[1]));

    // Stack of clean bowls on the left wing.
    for (let k = 2; k >= 0; k--) bowl(cv, 27, 160 - k * 6, 34, { nested: k < 2 });

    // Hero bowl on the right wing: broth, noodles, chashu, egg, nori, naruto, scallions.
    bowl(cv, 260, 160, 40, {
      inner: (well) => {
        cv.fill(well, Br[2]);
        cv.fill(well.and(well.shift(0, -2)).and(well.shift(0, 2)), Br[3]);
        sprite(cv, 244, 163, ['.xx.xx..xx.x.xx.xx..x.', 'x..x..xx..x.x..x..xx.x'], { x: Br[4] });
      },
    });
    const nori = cv.mask().poly([[268, 146], [276, 147], [274, 164], [267, 164]]);
    part(cv, nori, ['#101a16', '#1c2e24', '#2a4232', '#3d5c44'], { top: [3], left: [3], bottom: [0], right: [0], fill: 1, shadow: false });
    const chashu = cv.mask().oval(243, 154, 15, 10);
    part(cv, chashu, Ch, { top: [4], left: [3], bottom: [0], right: [1], fill: 2, dy: 1 });
    sprite(cv, 245, 156, ['..aaaa...', '.a....aa.', '.a..bb..a', '..aa....a'], { a: Ch[4], b: Ch[1] });
    const egg = cv.mask().oval(256, 156, 11, 9);
    part(cv, egg, Ce, { top: [4], left: [4], bottom: [1], right: [2], fill: 3, dy: 1 });
    cv.fill(egg.and(egg.shift(0, -1).shift(0, 2)).and(cv.mask().oval(258, 158, 7, 5)), '#e8781c');
    cv.fill(cv.mask().oval(259, 159, 5, 3), '#ffb233');
    cv.set(258, 157, '#ffffff');
    const naruto = cv.mask().oval(265, 159, 9, 7);
    part(cv, naruto, Ce, { top: [4], left: [4], bottom: [1], right: [2], fill: 3, dy: 1 });
    sprite(cv, 267, 160, ['.ppp.', 'p..p.', 'p.pp.', '.p...'], { p: '#e8638e' });
    sprite(cv, 247, 163, ['g..G....g.....G..g', '.G..g.G...G.g...G.'], { g: '#3f9a3a', G: '#9ce06a' });

    // --- red paper lantern on the left eave --------------------------------------------------------
    cv.rect(26, 39, 1, 10, INK).rect(27, 39, 1, 10, Dk[3]);
    const lant = cv.mask().plot((x, y) => { const u = (x + 0.5 - 27) / 15, v = (y + 0.5 - 73) / 23; return Math.abs(u) ** 2.4 + Math.abs(v) ** 3 <= 1; });
    cv.outline(INK, lant, { all: true });
    cv.fill(lant, (x, y) => {
      const u = (x + 0.5 - 27) / 15, v = (y + 0.5 - 73) / 23;
      const t = u * 0.85 + Math.abs(v) * 0.5 + 0.2;
      return Rd[t < -0.35 ? 4 : t < 0.05 ? 3 : t < 0.45 ? 2 : t < 0.75 ? 1 : 0];
    });
    for (let y = 54; y < 92; y += 4) cv.fill(lant.and(cv.mask().rect(0, y, W, 1)), (x, yy, c) => cv.step(c, -1));
    cv.fill(lant.and(cv.mask().rect(15, 63, 5, 18)), (x, y, c) => cv.step(c, 1));
    for (const [y, w] of [[48, 16], [94, 16]]) {
      const cap = cv.mask().rrect(27 - (w >> 1), y, w, 5, 1);
      part(cv, cap, Fe, { top: [4], left: [3], bottom: [0], right: [1], fill: 2, shadow: false });
    }
    cv.rect(26, 99, 2, 5, Rd[1]).rect(26, 99, 1, 5, Rd[3]).rect(25, 104, 4, 3, Rd[2]);
    cv.outline(INK, cv.mask().rect(26, 99, 2, 5).rect(25, 104, 4, 3), {});
    const lf = cv.layer('lf');
    lf.fill(cv.mask().oval(14, 58, 22, 30).and(lant), (x, y) => cv.step(cv.get(x, y), 1));

    // --- stools and wheels in front ------------------------------------------------------------------
    for (const cx of [100, 188]) {
      for (const [lx, ly] of [[cx - 10, 214], [cx + 8, 214], [cx - 1, 216]]) part(cv, cv.mask().rect(lx, ly, 3, 34), Wd, { top: [3], left: [4], bottom: [0], right: [1], fill: 2, shadow: false });
      part(cv, cv.mask().rect(cx - 9, 232, 19, 2), Wd, { top: [3], left: [3], bottom: [1], right: [1], fill: 2, shadow: false });
      const seat = cv.mask().oval(cx - 16, 207, 33, 9);
      part(cv, seat.or(cv.mask().rect(cx - 15, 212, 31, 3)), Wd, { top: [6], left: [5], bottom: [1], right: [2], fill: 4, dy: 2 });
      cv.fill(seat.erode(1).and(seat.shift(0, 2)), (x, y) => (bayer(x, y) < 0.25 ? Wd[4] : Wd[5]));
      cv.rect(cx - 13, 213, 27, 1, Wd[3]);
    }
    for (const cx of [44, 244]) {
      const tire = cv.mask().circle(cx, 228, 21), rimM = cv.mask().circle(cx, 228, 17);
      cv.cast(tire.dilate(1), 1, 1, -1);
      cv.outline(INK, tire, { all: true });
      cv.shade(tire.sub(rimM), Fe, { top: [4], left: [3], bottom: [0], right: [1], fill: 2 });
      cv.shade(rimM.sub(cv.mask().circle(cx, 228, 13)), Wd, { top: [1], left: [1], bottom: [5], right: [4], fill: 3 });
      cv.fill(cv.mask().circle(cx, 228, 13), Dk[0]);
      for (let a = 0; a < 8; a++) {
        const t = (a * Math.PI) / 4 + 0.2;
        cv.fill(cv.mask().capsule(cx, 228, Math.round(cx + Math.cos(t) * 13), Math.round(228 + Math.sin(t) * 13), 0.9), Wd[a < 4 ? 3 : 4]);
      }
      part(cv, cv.mask().circle(cx, 228, 4), Fe, { top: [4], left: [3], bottom: [0], right: [1], fill: 2, shadow: false });
      cv.set(cx - 1, 226, Fe[4]);
    }

    cv.outline(INK);

    // Soft floor shadow under the cart (behind everything).
    const floor = cv.mask().oval(10, 242, 268, 14).sub(cv.opaque());
    cv.fill(floor, (x, y) => (bayer(x, y) < 0.5 ? SH : INK));

    // --- steam: two alternating frames of rising wisps over the bowl -------------------------------
    const steam = (l, ph) => {
      for (const [x0, y0, len, amp, k] of [[251, 150, 52, 4, 0], [262, 146, 66, 5, 2.2], [273, 144, 44, 3.5, 4.1]]) {
        for (let s = 0; s < len; s++) {
          const t = s / len, y = y0 - s, x = Math.round(x0 + Math.sin(s / 9 - ph + k) * amp * (0.35 + t));
          if (((s + Math.round(ph * 3)) % 17) > 13) continue; // breaks between puffs
          if (t > 0.7 && bayer(x, y) < (t - 0.7) * 2.6) continue; // dithered fade at the top
          l.set(x, y, t < 0.45 ? Sm[3] : t < 0.75 ? Sm[2] : Sm[1]);
          if (t < 0.55) l.set(x + 1, y, t < 0.3 ? Sm[2] : Sm[1]);
        }
      }
    };
    steam(cv.layer('sa'), 0);
    steam(cv.layer('sb'), 2.6);

    return cv.punch(...HOLE, HR);
  },
};
