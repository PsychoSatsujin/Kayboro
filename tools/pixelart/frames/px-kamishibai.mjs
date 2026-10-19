// Kamishibai theater: a Showa-era paper-theater stage box with its lid and two little doors swung open
// (the stage window is the screen), indigo door panels in asanoha and seigaiha, a vermilion lacquer
// moulding and brass corner fittings, a dagashi drawer box with one drawer pulled out, all riding on
// the rear rack of an old black bicycle seen from behind: fender reflector, edge-on wheel and the
// double kick stand. Wooden hyoshigi clappers hang from the handlebar, a glass candy jar and a crate of
// sweets sit on the ground.
import { Canvas, bayer, rng, ramp } from '../pixel.mjs';
import { INK, inset, part, sprite, sparkle } from '../kit.mjs';

const W = 256, H = 304, HOLE = [56, 46, 144, 108], HR = 0; // 4:3
const BX = 40, BY = 28, BW = 176, BH = 144; // stage box face
const Wd = ramp('#a8703c', 7, { step: 0.1, hue: 7, sat: 0.09 }); // hinoki-ish wood, warm
const Dk = ramp('#6a3f2a', 6, { step: 0.08, hue: 6, sat: 0.04, mid: 2 }); // dark lacquered wood (drawer box)
const In = ramp('#33508f', 6, { step: 0.11, hue: 6, sat: 0.05, mid: 3 }); // indigo (ai-zome)
const Vm = ramp('#d24a2c', 5, { step: 0.11, hue: 6, sat: 0.05 }); // vermilion lacquer
const Oc = ramp('#d8a040', 5, { step: 0.11, hue: 6, sat: 0.06 }); // brass / ochre
const Bk = ramp('#2c2a3e', 6, { step: 0.08, hue: 6, sat: 0.02, mid: 2 }); // black bicycle enamel
const Gl = ramp('#8cc0c0', 5, { step: 0.1, hue: 6, sat: 0.04 }); // glass
const Ch = ['#4b485d', '#696880', '#8a8ca4', '#afaec8', '#d7d4eb']; // chrome
const Pp = ['#af8b73', '#c3a589', '#d8c19f', '#ecdcb8', '#fff5d1']; // paper / cream
const SH = '#120c1c'; // floor shadow
const CANDY = ['#ee6f3e', '#f4ca57', '#ff9cc2', '#8fe0b0', '#fff5d1', '#7aa8e8', '#d24a2c'];

// Seigaiha (blue ocean waves): stacked rows of concentric half circles; returns the distance to the
// visible circle's center, or -1.
function seigaiha(x, y, r, ox = 0, oy = 0) {
  const s = r / 2, px = x + 0.5 - ox, py = y + 0.5 - oy;
  for (let j = Math.floor((py + r) / s); j >= Math.floor(py / s) - 1; j--) {
    const cy = j * s, off = (j & 1) ? r : 0;
    const i = Math.round((px - off) / (2 * r)), cx = i * 2 * r + off;
    for (const c of [cx, cx - 2 * r, cx + 2 * r]) {
      const d = Math.hypot(px - c, py - cy);
      if (d <= r && cy >= py - 0.5) return d;
    }
  }
  return -1;
}

// Asanoha (hemp leaf): triangular lattice plus the medians of every triangle, as a 1px line mask.
function asanoha(cv, a, h, ox, oy, x0, y0, x1, y1) {
  const m = cv.mask(), L = (p, q) => m.line(Math.round(p[0]), Math.round(p[1]), Math.round(q[0]), Math.round(q[1]));
  for (let j = Math.floor((y0 - oy) / h) - 1; j * h + oy < y1 + h; j++) {
    const row = (k) => { const pts = [], off = (k & 1) ? a / 2 : 0; for (let i = Math.floor((x0 - ox) / a) - 2; i * a + ox < x1 + 2 * a; i++) pts.push([ox + i * a + off, oy + k * h]); return pts; };
    const pts = [...row(j), ...row(j + 1)].sort((p, q) => p[0] - q[0]);
    for (let k = 0; k + 2 < pts.length; k++) {
      const T = [pts[k], pts[k + 1], pts[k + 2]], c = [(T[0][0] + T[1][0] + T[2][0]) / 3, (T[0][1] + T[1][1] + T[2][1]) / 3];
      L(T[0], T[1]); L(T[1], T[2]); L(T[0], T[2]);
      for (const p of T) L(c, p);
    }
  }
  return m;
}

export default {
  id: 'px-kamishibai', name: 'Kamishibai Theater', theme: 'paper-theater', rarity: 'epic', translucent: false,
  collection: 'world-tour', license: 'CC-BY-4.0',
  desc: 'The storyteller has parked the old bicycle, swung open the little wooden doors and set out the candy jar, so gather round for the next picture card.',
  tags: ['japan', 'showa', 'kamishibai', 'bicycle', 'candy', 'pixel'],
  css: '.tw{animation:tw 2.8s steps(1) infinite}.tw2{animation:tw 2.8s steps(1) -1.4s infinite}' +
    '@keyframes tw{0%,62%{opacity:1}63%,100%{opacity:0}}',
  draw() {
    const cv = new Canvas(W, H), rnd = rng(11);
    cv.use(Wd, Dk, In, Vm, Oc, Bk, Gl, Ch, Pp);
    const wood = { top: [6, 5], left: [5], bottom: [1, 2], right: [2], fill: 4 };

    // ---- ground shadow -------------------------------------------------------------------------
    const soft = (x, y, w, h) => {
      const core = cv.mask().oval(x + 5, y + 1, w - 10, h - 2), outer = cv.mask().oval(x, y, w, h);
      cv.fill(core, SH).fill(outer.sub(core), (px, py, c) => (bayer(px, py) < 0.5 ? SH : c));
    };
    soft(70, 292, 116, 11);
    soft(4, 290, 60, 12);
    soft(176, 290, 76, 12);

    // ---- bicycle, side on: both wheels under the drawer box, the handlebar out front ------------------
    const wheel = (cx, cy) => {
      // Tire lit from the top-left (normal . light), chrome rim, sixteen spokes, chrome hub.
      const tire = cv.mask().circle(cx, cy, 26).sub(cv.mask().circle(cx, cy, 22));
      cv.fill(tire, (x, y) => {
        const dx = x + 0.5 - cx - 0.5, dy = y + 0.5 - cy - 0.5, d = Math.hypot(dx, dy) || 1, l = -(dx + dy) / d / Math.SQRT2;
        const outer = d > 24.2, k = l * (outer ? 1 : -1);
        return Bk[k > 0.6 ? 4 : k > 0.15 ? 3 : k > -0.4 ? 2 : 1];
      });
      const rim = cv.mask().circle(cx, cy, 22).sub(cv.mask().circle(cx, cy, 20));
      cv.fill(rim, (x, y) => { const l = -((x - cx) + (y - cy)); return Ch[l > 8 ? 4 : l > -8 ? 3 : 1]; });
      for (let k = 0; k < 16; k++) {
        const a = (k / 16) * Math.PI * 2 + 0.1, r0 = 3;
        cv.fill(cv.mask().line(Math.round(cx + Math.cos(a) * r0), Math.round(cy + Math.sin(a) * r0), Math.round(cx + Math.cos(a + 0.35) * 20), Math.round(cy + Math.sin(a + 0.35) * 20)), Ch[2]);
      }
      part(cv, cv.mask().circle(cx, cy, 3), Ch, { top: [4], left: [3], bottom: [0], right: [1], fill: 2, shadow: false });
      cv.outline(INK, cv.mask().circle(cx, cy, 26), {});
      // Mudguard: an enamel arc hugging the top of the tire.
      const g = cv.mask().circle(cx, cy, 29).sub(cv.mask().circle(cx, cy, 27)).and(cv.mask().rect(cx - 30, cy - 30, 60, 24));
      cv.fill(g, (x, y) => (y < cy - 26 || x < cx - 16 ? Bk[4] : Bk[3]));
      cv.outline(INK, g, { all: true });
    };
    const tube = (x0, y0, x1, y1, r = 1.6) => cv.mask().capsule(x0, y0, x1, y1, r);
    const enamel = (m) => { cv.outline(INK, m, { all: true }); cv.shade(m, Bk, { top: [4], left: [4], bottom: [1], right: [2], fill: 3 }); return m; };
    const RW = [92, 266], FW = [208, 266], BB = [148, 270];
    // Frame behind the wheels: seat tube, top tube, down tube, seat stays, rack stay.
    enamel(tube(140, 222, BB[0], BB[1]).or(tube(140, 226, 198, 228)).or(tube(BB[0], BB[1], 198, 234, 2)).or(tube(140, 228, RW[0], RW[1])).or(tube(66, 222, RW[0], RW[1], 1.2)));
    wheel(...RW); wheel(...FW);
    // Fork, head tube and stem, swept-back handlebar with a grip, a bell and a bullet lamp.
    enamel(tube(198, 222, 201, 240, 2.2).or(tube(201, 240, FW[0], FW[1], 1.6)).or(tube(199, 222, 202, 198, 1.4)).or(tube(202, 198, 220, 196, 1.4)));
    part(cv, cv.mask().rrect(218, 193, 14, 7, 3), Dk, { top: [5], left: [4], bottom: [0], right: [1], fill: 3 });
    part(cv, cv.mask().oval(204, 186, 11, 9).clip(0, 186, W, 7), Ch, { top: [4], left: [4], bottom: [1], right: [1], fill: 3 });
    cv.rect(209, 193, 1, 3, Ch[1]);
    part(cv, cv.mask().rrect(203, 227, 12, 8, [3, 1, 1, 3]), Ch, { top: [4], left: [4], bottom: [1], right: [2], fill: 3 });
    cv.rect(214, 228, 2, 6, Oc[4]).set(214, 228, '#ffffff');
    // Chain case (a long enamel teardrop) over the drive side, crank and pedal.
    const cc = cv.mask().circle(BB[0], BB[1], 9).or(tube(BB[0], BB[1] - 2, RW[0] + 4, RW[1] - 1, 5)).or(cv.mask().circle(RW[0] + 4, RW[1], 5));
    enamel(cc);
    cv.fill(tube(BB[0] - 4, BB[1] - 5, RW[0] + 8, RW[1] - 4, 0.6), Bk[5]);
    part(cv, cv.mask().circle(BB[0], BB[1], 3), Ch, { top: [4], left: [3], bottom: [0], right: [1], fill: 2, shadow: false });
    enamel(tube(BB[0], BB[1], 156, 283, 1.4));
    part(cv, cv.mask().rect(151, 283, 12, 4), Bk, { top: [4], left: [4], bottom: [0], right: [1], fill: 2 });
    // Rear kick stand and a round vermilion reflector on the back of the mudguard.
    enamel(tube(RW[0] - 1, RW[1], 80, 292, 1.4));
    part(cv, cv.mask().rrect(72, 292, 14, 4, 1), Bk, { top: [4], left: [4], bottom: [0], right: [1], fill: 2 });
    part(cv, cv.mask().circle(64, 249, 3), Vm, { top: [4], left: [3], bottom: [0], right: [1], fill: 2 });
    cv.set(63, 248, '#ffd8b8');

    // Rear rack: iron rails under a wooden plank.
    part(cv, cv.mask().rect(48, 219, 160, 4), Bk, { top: [4], left: [3], bottom: [0], right: [1], fill: 2 });
    for (const x of [48, 204]) part(cv, cv.mask().rect(x, 219, 4, 7), Bk, { top: [4], left: [3], bottom: [0], right: [1], fill: 2 });
    part(cv, cv.mask().rect(54, 214, 148, 5), Wd, wood);

    // ---- dagashi drawer box ----------------------------------------------------------------------
    const cab = cv.mask().rect(60, 172, 136, 42);
    part(cv, cab, Dk, { top: [5], left: [4], bottom: [0], right: [1], fill: 2, dy: 2 });
    const drawer = (x, y, w, h, R = Wd) => {
      cv.rect(x - 1, y - 1, w + 2, h + 2, Dk[0]);
      cv.shade(cv.mask().rect(x, y, w, h), R, { top: [6], left: [5], bottom: [2], right: [3], fill: 4 });
      const cx = x + (w >> 1) - 2, cy = y + (h >> 1) - 1;
      sprite(cv, cx, cy, ['.hh.', 'h..d', 'h..d', '.dd.'], { h: Oc[4], d: Oc[1] }); // ring pull
      cv.set(cx + 1, cy - 1, Oc[2]).set(cx + 2, cy - 1, Oc[2]);
    };
    drawer(64, 178, 38, 14); drawer(154, 178, 38, 14);
    drawer(64, 196, 60, 14); drawer(132, 196, 60, 14);
    // Center drawer pulled out toward us: a peek at the sweets inside, then its front.
    cv.rect(103, 176, 50, 18, Dk[0]);
    const tray = cv.mask().rect(102, 170, 52, 9);
    cv.fill(tray, Wd[2]);
    cv.rect(102, 170, 52, 1, Wd[5]).rect(102, 170, 1, 9, Wd[4]).rect(153, 170, 1, 9, Wd[2]);
    for (const x of [119, 136]) cv.rect(x, 171, 1, 8, Wd[4]);
    for (let i = 0; i < 26; i++) { // round sweets and little wrapped candies
      const x = 104 + Math.floor(rnd() * 48), y = 172 + Math.floor(rnd() * 5), c = CANDY[Math.floor(rnd() * CANDY.length)];
      if (x === 119 || x === 136) continue;
      cv.px([[x, y], [x + 1, y], [x, y + 1], [x + 1, y + 1]], c).set(x, y, cv.step(c, 1) === c ? '#ffffff' : '#fffaf0');
    }
    const front = cv.mask().rect(100, 179, 56, 15);
    part(cv, front, Wd, { top: [6], left: [5], bottom: [1, 2], right: [2], fill: 4, dy: 2 });
    sprite(cv, 126, 183, ['.hh.', 'h..d', 'h..d', '.dd.'], { h: Oc[4], d: Oc[1] });
    cv.set(127, 182, Oc[2]).set(128, 182, Oc[2]);
    cv.outline(INK, tray, { all: false });

    // ---- the stage box -------------------------------------------------------------------------
    const panel = (m, R) => cv.shade(m, R, { top: [1], left: [1], bottom: [4], right: [3], fill: 2 });

    // Lid swung up and back: we see its indigo inner face, foreshortened, with seigaiha.
    const lid = cv.mask().poly([[34, 8], [222, 8], [216, 30], [40, 30]]);
    part(cv, lid, Wd, wood);
    const lidIn = cv.mask().poly([[39, 11], [217, 11], [212, 29], [44, 29]]);
    panel(lidIn, In);
    cv.fill(lidIn.erode(1), (x, y) => {
      const d = seigaiha(x, y, 7, 128, 12);
      if (d < 0) return In[2];
      const b = Math.floor(d / 1.75);
      return b >= 4 ? In[1] : b % 2 ? In[2] : In[4];
    });

    // Doors swung open toward us: indigo inner panels with asanoha, wood stiles, brass knobs.
    for (const s of [-1, 1]) {
      const hx = s < 0 ? BX : BX + BW, fx = s < 0 ? 4 : W - 4;
      const P = [[hx, BY + 4], [fx, BY - 4], [fx, BY + BH + 6], [hx, BY + BH - 2]];
      const door = cv.mask().poly(s < 0 ? P : [P[1], P[0], P[3], P[2]]);
      part(cv, door, Wd, s < 0 ? { top: [6, 5], left: [5, 4], bottom: [1, 2], right: [3], fill: 4 } : { top: [5, 4], left: [4], bottom: [1, 2], right: [2, 1], fill: 3 });
      const inner = door.erode(4);
      panel(inner, In);
      const lines = asanoha(cv, 14, 12, s < 0 ? 4 : 10, 6, 0, 0, W, H).and(inner.erode(1));
      cv.fill(inner.erode(1), (x, y, c) => (lines.has(x, y) ? In[4] : c));
      cv.fill(inner.erode(1).and(cv.mask().rect(0, 0, W, H)).sub(lines), (x, y, c) => (bayer(x, y) < 0.18 && (x + y) % 3 === 0 ? In[3] : c));
      // Knob near the free edge, hinges near the box.
      const kx = s < 0 ? 9 : W - 13;
      part(cv, cv.mask().circle(kx + 2, 100, 2), Oc, { top: [4], left: [3], bottom: [0], right: [1], fill: 2 });
      for (const y of [48, 142]) {
        const hm = cv.mask().rect(s < 0 ? hx - 4 : hx, y, 5, 10);
        part(cv, hm, Oc, { top: [4], left: [3], bottom: [0], right: [1], fill: 2, shadow: false });
        cv.set(s < 0 ? hx - 2 : hx + 2, y + 2, Oc[0]).set(s < 0 ? hx - 2 : hx + 2, y + 7, Oc[0]);
      }
    }

    // Box face: mitred wood frame with grain, a vermilion lacquer moulding, a deep recessed stage.
    const box = cv.mask().rect(BX, BY, BW, BH);
    part(cv, box, Wd, { ...wood, dy: 2 });
    const [hx, hy, hw, hh] = HOLE;
    const faceIn = cv.mask().rect(BX + 3, BY + 3, BW - 6, BH - 6);
    for (let i = 0; i < 70; i++) { // grain streaks, following each rail and stile
      const x = BX + 4 + Math.floor(rnd() * (BW - 8)), y = BY + 4 + Math.floor(rnd() * (BH - 8));
      const horiz = y < hy - 6 || y > hy + hh + 5, len = 4 + Math.floor(rnd() * 10);
      cv.fill((horiz ? cv.mask().rect(x, y, len, 1) : cv.mask().rect(x, y, 1, len)).and(faceIn), (px, py, c) => (c === Wd[4] ? Wd[3] : c));
    }
    for (const [x0, y0, dx, dy] of [[BX + 3, BY + 3, 1, 1], [BX + BW - 4, BY + 3, -1, 1], [BX + 3, BY + BH - 4, 1, -1], [BX + BW - 4, BY + BH - 4, -1, -1]])
      for (let k = 0; k < 9; k++) cv.set(x0 + dx * k, y0 + dy * k, Wd[2]); // mitre joints
    const mould = cv.mask().rect(hx - 8, hy - 8, hw + 16, hh + 16);
    part(cv, mould, Vm, { top: [4, 3], left: [3], bottom: [0, 1], right: [1], fill: 2 });
    cv.fill(mould.erode(2).edge(), (x, y, c) => cv.step(c, -1));
    inset(cv, hx, hy, hw, hh, HR, { rim: INK, top: Dk[0], left: Dk[1], bottom: Wd[3], right: Wd[2] }, 3);

    // Brass corner fittings with rivets.
    for (const [x, y, fx, fy] of [[BX, BY, 0, 0], [BX + BW - 10, BY, 1, 0], [BX, BY + BH - 10, 0, 1], [BX + BW - 10, BY + BH - 10, 1, 1]]) {
      const L = cv.mask().rect(x + (fx ? 0 : 0), y + (fy ? 7 : 0), 10, 3).or(cv.mask().rect(x + (fx ? 7 : 0), y, 3, 10));
      part(cv, L, Oc, { top: [4], left: [3], bottom: [0], right: [1], fill: 2, shadow: false });
      cv.set(x + (fx ? 8 : 1), y + (fy ? 8 : 1), Oc[0]);
    }

    // ---- hyoshigi clappers on the left grip --------------------------------------------------------
    cv.fill(cv.mask().line(25, 202, 21, 212).or(cv.mask().line(25, 202, 30, 212)), Vm[1]);
    for (const [x, t] of [[18, -1], [28, 1]]) {
      const stick = cv.mask().poly([[x, 212], [x + 4, 212], [x + 4 + t, 244], [x + t, 244]]);
      part(cv, stick, Wd, { top: [6], left: [5], bottom: [1], right: [2], fill: 4 });
    }
    cv.fill(cv.mask().rect(20, 211, 3, 2).or(cv.mask().rect(30, 211, 3, 2)), Vm[2]);

    // ---- glass candy jar with a vermilion cap ------------------------------------------------------
    const body = cv.mask().rrect(8, 254, 46, 40, 13);
    const neck = cv.mask().rrect(17, 247, 28, 10, 3);
    part(cv, neck.or(body), Gl, { top: [4], left: [3], bottom: [0], right: [1], fill: 2 });
    cv.fill(body.erode(2), Gl[1]);
    const fillM = body.erode(2).and(cv.mask().rect(0, 266, W, 40));
    cv.fill(fillM, Gl[0]);
    for (let i = 0; i < 40; i++) {
      const x = 11 + Math.floor(rnd() * 40), y = 265 + Math.floor(rnd() * 26), c = CANDY[Math.floor(rnd() * 6)];
      const m = cv.mask().circle(x, y, 2, 1.4).and(fillM);
      cv.fill(m, c); cv.set(x - 1, y - 1, '#fffaf0');
      cv.fill(m.shift(1, 1).sub(m).and(fillM), (px, py, cc) => (cc === Gl[0] ? Gl[0] : cv.step(cc, -1)));
    }
    cv.fill(body.erode(2).edge().and(cv.mask().rect(0, 0, W, 268)), Gl[2]);
    cv.fill(cv.mask().rect(12, 262, 2, 22).or(cv.mask().rect(14, 259, 2, 2)).and(body), Gl[4]); // glass glint
    cv.fill(cv.mask().rect(49, 270, 1, 14).and(body), Gl[3]);
    part(cv, cv.mask().rrect(14, 239, 34, 9, 3), Vm, { top: [4], left: [3], bottom: [0], right: [1], fill: 2 });
    for (let x = 17; x < 46; x += 3) cv.rect(x, 241, 1, 6, Vm[1]);

    // ---- crate of sweets and a marble soda bottle --------------------------------------------------
    const bottle = cv.mask().rrect(228, 256, 12, 36, 3).or(cv.mask().rect(231, 244, 6, 14)).or(cv.mask().rrect(230, 240, 8, 5, 2));
    part(cv, bottle, Gl, { top: [4], left: [4], bottom: [1], right: [1], fill: 3 });
    cv.fill(cv.mask().rect(231, 249, 6, 3), Gl[1]);
    part(cv, cv.mask().circle(234, 246, 2), Gl, { top: [4], left: [4], bottom: [1], right: [2], fill: 3, shadow: false });
    cv.rect(230, 260, 1, 26, Gl[4]);
    // Sweets peeking over the crate rim: stick candies and wrapped bits.
    for (const [x, c] of [[190, Vm[3]], [196, Oc[3]], [202, '#ff9cc2'], [208, '#8fe0b0'], [214, Vm[3]]]) {
      const m = cv.mask().rect(x, 262, 4, 12);
      part(cv, m, [cv.step(c, -2), cv.step(c, -1), c, cv.step(c, 1), '#fffaf0'], { top: [4], left: [3], bottom: [0], right: [1], fill: 2, shadow: false });
      cv.rect(x, 265, 4, 1, '#fffaf0').rect(x, 269, 4, 1, '#fffaf0');
    }
    const crate = cv.mask().rect(184, 272, 42, 22);
    part(cv, crate, Wd, wood);
    for (const y of [279, 286]) cv.rect(185, y, 40, 1, Wd[1]);
    for (const x of [186, 222]) cv.rect(x, 273, 1, 20, Wd[5]);

    cv.outline(INK);

    // ---- glints (twinkle) ----------------------------------------------------------------------
    const tw = cv.layer('tw'), tw2 = cv.layer('tw2');
    sparkle(tw, 14, 262, 2, Gl[4], '#ffffff');
    sparkle(tw2, 212, 189, 1, '#fffaf0', '#ffffff');
    sparkle(tw2, 42, 30, 1, Oc[4], '#ffffff');
    sparkle(tw, 214, 170, 1, Oc[4], '#ffffff');
    return cv.punch(...HOLE, HR);
  },
};
