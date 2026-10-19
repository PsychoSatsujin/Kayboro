// Tung Tung Tung Sahur (fan art, owner-requested): a carved teak kentongan board hangs from a rope
// sling in front of a starry night sky and holds the screen; the tall smiling log fellow leans out
// from behind its right edge, thin arms and legs, and knocks the board's top edge with his club to
// wake you up. A chunky TUNG TUNG TUNG burst sits top-left; the club alternates raised / striking
// (with an impact flash) in a three-knock rhythm.
import { Canvas, bayer, rng, ramp } from '../pixel.mjs';
import { INK, inset, part, sprite, spriteMask, sparkle } from '../kit.mjs';

const W = 256, H = 272, HOLE = [36, 92, 144, 108], HR = 4; // 4:3
const PX = 20, PY = 72, PW = 176, PH = 168; // the board
const Sk = ['#120f36', '#1a174c', '#232060', '#2d2b74', '#383688']; // night sky, top -> horizon
const Tk = ramp('#8a5630', 7, { step: 0.09, hue: 7, sat: 0.08 }); // carved teak board
const Lg = ramp('#c48c52', 7, { step: 0.1, hue: 8, sat: 0.08 }); // the log fellow
const Bt = ramp('#d8b684', 5, { step: 0.11, hue: 6, sat: 0.06 }); // pale club wood
const Rp = ramp('#c9a04a', 5, { step: 0.12, hue: 6, sat: 0.06 }); // rope
const Bu = ['#8a2e0c', '#d85a16', '#ff8c2a', '#ffb94a', '#ffdc7a']; // burst
const Gr = ['#0f2418', '#183a26', '#245238', '#357050', '#4d9466']; // ground
const Mo = ['#3a0f14', '#6e1c22', '#b03a3c']; // mouth
const Sr = { d: '#1c4b3a', g: '#2d7556', s: '#e9d9a6' }; // sarong plaid
const FL = '#fff6d8', FY = '#ffe98a', WH = '#ffffff';

// Teak grain: wandering horizontal lines (board), or vertical ones (log) with the axes swapped.
const grain = (R, base, x, y, vertical = false) => {
  const [a, b] = vertical ? [y, x] : [x, y];
  const v = Math.sin(b * 0.62 + Math.sin(a * 0.05) * 2.3 + Math.sin(a * 0.013 + 1) * 4);
  return v > 0.88 ? R[base - 1] : v < -0.92 ? R[base + 1] : R[base];
};

// The log stands slightly leaning left (top shifted toward the board).
const LOG = { x0: 180, y0: 26, w: 38, y1: 238, lean: 8 };
const logLeft = (y) => LOG.x0 - (LOG.lean * (y - LOG.y0)) / (LOG.y1 - LOG.y0);

function logBody(cv) {
  const l0 = logLeft(LOG.y0), l1 = logLeft(LOG.y1);
  return cv.mask().poly([[l0, LOG.y0 + 5], [l0 + LOG.w, LOG.y0 + 5], [l1 + LOG.w, LOG.y1], [l1, LOG.y1]])
    .or(cv.mask().oval(Math.round(l0), LOG.y0, LOG.w, 11));
}

// Cylinder-lit log fill: lit stripe left of center, falling off to the right, plus vertical grain.
const logFill = (x, y) => {
  const t = (x + 0.5 - logLeft(y)) / LOG.w;
  const base = t < 0.1 ? 4 : t < 0.42 ? 5 : t < 0.66 ? 4 : t < 0.86 ? 3 : 2;
  const seam = (t > 0.38 && t < 0.42) || (t > 0.62 && t < 0.66) || (t > 0.82 && t < 0.86);
  return grain(Lg, seam && bayer(x, y) < 0.5 ? base - 1 : base, x, y, true);
};

// Club: capsule from the hand (hx, hy) to the tip, knob at the hand, ink outline, drop shadow.
function club(cv, hx, hy, tx, ty, { shadow = true } = {}) {
  const m = cv.mask().capsule(hx, hy, tx, ty, 3.2).or(cv.mask().circle(hx, hy, 4));
  const dx = tx - hx, dy = ty - hy, L = Math.hypot(dx, dy) || 1;
  const lit = cv.mask().capsule(Math.round(hx - dy / L * 1.5), Math.round(hy + dx / L * 1.5), Math.round(tx - dy / L * 1.5), Math.round(ty + dx / L * 1.5), 1.2);
  part(cv, m, Bt, { top: [4], left: [3], bottom: [0], right: [1], fill: 2, shadow });
  cv.fill(lit.and(m.erode(1)), (x, y, c) => (Math.abs(dx) > Math.abs(dy) ? (y < hy) : (x < hx)) ? Bt[3] : Bt[1]);
  cv.fill(cv.mask().circle(hx, hy, 2), Bt[1]);
  return m;
}

// Thin stick arm from the shoulder to the hand, with a little round hand.
function arm(cv, sx, sy, hx, hy) {
  const m = cv.mask().capsule(sx, sy, hx, hy, 1.1);
  cv.outline(INK, m, { all: true });
  cv.fill(m, Lg[1]);
  const hand = cv.mask().circle(hx, hy, 2);
  cv.outline(INK, hand, { all: true });
  cv.shade(hand, Lg, { top: [4], left: [4], bottom: [1], right: [2], fill: 3 });
  return m.or(hand).dilate(1);
}

export default {
  id: 'px-tung-sahur', name: 'Tung Tung Tung Sahur', theme: 'sahur', rarity: 'epic', translucent: false,
  collection: 'fan-favorites', license: 'fan-art',
  desc: 'Rise and shine: the friendly log fellow leans out from behind the carved kentongan board and knocks it three times until you press start.',
  tags: ['fan-art', 'meme', 'wood', 'night', 'animated', 'pixel'],
  css: '.hit{animation:hit 2s steps(1) infinite}@keyframes hit{0%{opacity:1}11%{opacity:0}20%{opacity:1}31%{opacity:0}40%{opacity:1}51%{opacity:0}100%{opacity:0}}' +
    '.tw{animation:tw 2.6s steps(1) infinite}.tw2{animation:tw 2.6s steps(1) -1.3s infinite}@keyframes tw{0%,58%{opacity:1}59%,100%{opacity:0}}',
  draw() {
    const cv = new Canvas(W, H), rnd = rng(11);
    cv.use(Sk, Tk, Lg, Bt, Rp, Bu, Gr);

    // Night sky card with a dithered horizon glow, stars (some twinkle), ground strip.
    const card = cv.mask().rrect(0, 0, W, H, 10);
    cv.grad(card, Sk, { from: 0, to: 236, soft: 0.16 });
    const tw = cv.layer('tw'), tw2 = cv.layer('tw2');
    for (let i = 0; i < 70; i++) {
      const x = 4 + Math.floor(rnd() * (W - 8)), y = 4 + Math.floor(rnd() * 230);
      if (x > PX - 4 && x < PX + PW + 4 && y > PY - 4) continue; // behind the board anyway
      const k = rnd();
      if (k < 0.75) cv.set(x, y, k < 0.3 ? Sk[4] : k < 0.55 ? '#8f8cc8' : '#c9c6ee');
      else if (k < 0.9) sparkle(cv, x, y, 1, '#b8b5e8', WH);
      else sparkle(k < 0.95 ? tw : tw2, x, y, 1, FY, WH);
    }
    for (const [x, y] of [[30, 150], [238, 60], [160, 22]]) { cv.outline(INK, cv.mask().pts([[x, y], [x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1], [x - 2, y], [x + 2, y], [x, y - 2], [x, y + 2]]), {}); sparkle(cv, x, y, 2, FY, WH); }
    const ground = card.and(cv.mask().rect(0, 246, W, 26));
    cv.grad(ground, [Gr[2], Gr[1], Gr[0]], { from: 246, to: 268, soft: 0.3 });
    cv.fill(ground.and(cv.mask().rect(0, 246, W, 1)), Gr[3]);
    for (let x = 2; x < W - 2; x += 1) {
      const n = Math.sin(x * 0.31) + Math.sin(x * 0.77 + 2) * 0.7;
      if (n > 1.2) { cv.set(x, 245, Gr[3]); cv.set(x, 244, Gr[4]); } else if (n > 0.7) cv.set(x, 245, Gr[3]);
      if (n < -1.35) cv.set(x, 250 + (x % 5), Gr[3]);
    }

    // The log fellow (behind the board): legs, floor shadow, body, cut-end cap, sarong, face, idle arm.
    const shadow = cv.mask().oval(190, 254, 46, 7);
    cv.tone(shadow.and(ground), -1, 0.6);
    for (const x of [200, 216]) {
      const leg = cv.mask().rect(x, LOG.y1 - 2, 3, 18);
      cv.outline(INK, leg, { all: true });
      cv.rect(x, LOG.y1 - 2, 1, 18, Lg[2]).rect(x + 1, LOG.y1 - 2, 2, 18, Lg[1]);
      const foot = cv.mask().oval(x - 3, 254, 10, 4);
      part(cv, foot, Lg, { top: [4], left: [3], bottom: [1], right: [1], fill: 2, shadow: false });
    }
    const body = logBody(cv);
    part(cv, body, Lg, { top: [5], left: [5], bottom: [1], right: [1], fill: logFill, shadow: false });
    body.erode(2).each((x, y) => { // bark flecks and a couple of knots
      const r = rnd();
      if (r < 0.012) cv.set(x, y, cv.step(cv.get(x, y), -1)); else if (r < 0.018) cv.set(x, y, cv.step(cv.get(x, y), 1));
    });
    for (const [kx, ky] of [[224, 118], [214, 196]]) {
      const knot = cv.mask().oval(kx - 3, ky - 2, 7, 5);
      cv.fill(knot, Lg[2]).fill(cv.mask().oval(kx - 2, ky - 1, 5, 3), Lg[1]).set(kx, ky, Lg[0]);
      cv.outline(Lg[1], knot, { all: false });
    }
    const cap = cv.mask().oval(Math.round(logLeft(LOG.y0)), LOG.y0, LOG.w, 11);
    cv.shade(cap, Lg, { top: [6], left: [6], bottom: [3], right: [4], fill: 5 });
    for (const [dx, dy] of [[3, 2], [6, 3]]) cv.fill(cap.erode(dx).edge().and(cv.mask().rect(0, LOG.y0 + 2, W, 11)), Lg[4 - (dy === 3 ? 1 : 0)]);
    cv.outline(INK, cap, { all: false });
    // Sarong: checked cloth wrapped round the lower log.
    const sarong = body.and(cv.mask().rect(0, 184, W, 54));
    cv.fill(sarong, (x, y) => {
      const t = (x + 0.5 - logLeft(y)) / LOG.w, shade = t > 0.66 ? 1 : 0;
      const px = Math.floor((x - 3) / 6) % 2, py = Math.floor((y - 184) / 6) % 2;
      const c = (px + py) % 2 ? Sr.g : Sr.d;
      if ((x - 3) % 6 === 0 || (y - 184) % 6 === 3) return shade ? Sr.d : Sr.s;
      return shade ? cv.step(c, -1) : c;
    });
    cv.fill(sarong.and(cv.mask().rect(0, 184, W, 2)), INK);
    cv.fill(sarong.and(cv.mask().rect(0, 186, W, 1)), Sr.s);
    cv.fill(body.and(cv.mask().rect(0, 236, W, 2)), Lg[1]);
    // Face: big round eyes, a wide happy mouth, blush.
    for (const [ex, ey, px] of [[188, 46, 0], [206, 46, -1]]) {
      const eye = cv.mask().circle(ex, ey, 5);
      cv.outline(INK, eye, { all: true });
      cv.shade(eye, ['#b8b0d0', '#dcd6ea', '#f4f1fb', WH, WH], { top: [4], left: [4], bottom: [0], right: [1], fill: 3 });
      cv.fill(cv.mask().circle(ex + 1 + px, ey + 1, 2), INK);
      cv.set(ex + px, ey, WH);
      cv.rect(ex - 5, ey - 7, 10, 1, Lg[1]); // brow
    }
    const mouth = cv.mask().oval(185, 56, 26, 11).and(cv.mask().rect(0, 60, W, 12));
    cv.outline(INK, mouth, { all: true });
    cv.fill(mouth, Mo[1]).fill(mouth.and(cv.mask().rect(0, 60, W, 2)), WH).fill(mouth.erode(1).and(cv.mask().rect(190, 64, 16, 8)), Mo[2]);
    cv.fill(mouth.and(cv.mask().rect(0, 60, W, 1)), WH).fill(mouth.and(cv.mask().rect(0, 62, W, 1)), Mo[0]);
    cv.px([[183, 54], [184, 55], [211, 54], [212, 55]], '#d9865f');
    // Idle arm hanging down the right side.
    arm(cv, 221, 92, 227, 146);

    // The carved teak board: grain, chamfered edge, carved groove border, corner rosettes.
    const board = cv.mask().rrect(PX, PY, PW, PH, 8);
    part(cv, board, Tk, { top: [6, 5], left: [5], bottom: [1, 2], right: [2], fill: (x, y) => grain(Tk, 3, x, y), dx: 2, dy: 2, shadow: -2 });
    cv.tone(board.erode(2).sub(board.erode(3)), 1, 0.5);
    const groove = board.erode(7).edge();
    cv.fill(groove, Tk[1]).fill(groove.shift(1, 1).sub(groove).and(board), Tk[5]);
    const rosette = ['..k..', '.khk.', 'khdhk', '.khk.', '..k..'];
    for (const [x, y] of [[PX + 9, PY + 9], [PX + PW - 14, PY + 9], [PX + 9, PY + PH - 14], [PX + PW - 14, PY + PH - 14]]) sprite(cv, x, y, rosette, { k: Tk[1], h: Tk[5], d: Tk[0] });
    // Screen bezel: a clean raised lip then the recessed rim.
    const lip = cv.mask().rrect(HOLE[0] - 6, HOLE[1] - 6, HOLE[2] + 12, HOLE[3] + 12, HR + 5);
    cv.shade(lip, Tk, { top: [6], left: [5], bottom: [1], right: [2], fill: 4 });
    inset(cv, ...HOLE, HR, { rim: INK, top: Tk[0], left: Tk[1], bottom: Tk[4], right: Tk[3] }, 2);
    // Kentongan slit under the screen, with carved chevrons either side.
    const slit = cv.mask().rrect(70, 216, 76, 7, 3);
    cv.fill(slit.dilate(1), INK).fill(slit.erode(1), '#2a1710').fill(slit.and(cv.mask().rect(0, 217, W, 1)), '#14090a');
    cv.fill(slit.dilate(1).shift(0, 1).sub(slit.dilate(1)).and(board), Tk[5]);
    const chev = ['k...k', '.k.k.', '..k..', '.k.k.', 'k...k'];
    for (const x of [44, 54, 158, 168]) { sprite(cv, x + 1, 218, chev, { k: Tk[5] }); sprite(cv, x, 217, chev, { k: Tk[1] }); }
    // Rope: twisted cord from the top edge down through a wooden lug on the board's top edge.
    const lug = cv.mask().rrect(100, 62, 16, 12, 3);
    part(cv, lug, Tk, { top: [6], left: [5], bottom: [1], right: [2], fill: 3, shadow: false });
    cv.fill(cv.mask().rrect(104, 65, 8, 6, 2), INK).fill(cv.mask().rect(105, 67, 6, 3), Tk[0]);
    const rope = cv.mask().capsule(108, -2, 108, 69, 1.6);
    cv.outline(INK, rope, { all: true });
    cv.fill(rope, (x, y) => (((x + y) >> 1) & 1 ? Rp[2] : Rp[3]));
    cv.fill(rope.and(cv.mask().plot((x, y) => x === 106 && (y + 1) % 3 !== 0)), Rp[1]);
    cv.fill(rope.and(cv.mask().plot((x, y) => x === 109 && y % 3 === 0)), Rp[4]);
    cv.fill(cv.mask().rect(105, 70, 7, 1), INK);

    // TUNG TUNG TUNG burst, top-left: jagged star, staggered chunky lettering.
    const bc = [56, 32], pts = [];
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2 - 0.3, R = i % 2 ? 1 : 0.68 + rnd() * 0.08;
      pts.push([bc[0] + Math.cos(a) * 46 * R, bc[1] + Math.sin(a) * 30 * R]);
    }
    const burst = cv.mask().poly(pts);
    part(cv, burst, Bu, { top: [4], left: [3], bottom: [0], right: [1], fill: [3, 2], soft: 0.25, dx: 2, dy: 2, shadow: -2 });
    cv.fill(burst.erode(3).edge(), Bu[4]);
    [[22, 12], [40, 25], [58, 38]].forEach(([x, y]) => {
      const t = cv.textMask('TUNG', x, y, { font: 3, scale: 2 });
      cv.fill(t.dilate(1, true), INK).fill(t.shift(0, 2).and(t), Bu[0]).fill(t.sub(t.shift(0, 2)), FL);
      cv.fill(t.and(t.shift(0, 2)), '#ffd9a0');
    });

    // Pose A (base): arm raised, club up at the top right. Snapshot first so the hit layer can
    // restore the sky and board behind it.
    const base = cv.p.slice();
    const armA = arm(cv, 181, 70, 170, 40);
    const clubA = club(cv, 170, 40, 154, 6);
    const hit = cv.layer('hit');
    hit.fill(armA.or(clubA.dilate(2)), (x, y) => base[y * W + x]);
    // Pose B (hit layer): club swung down onto the board's top edge, impact flash and lines.
    const snap = cv.p.slice();
    cv.p = base.slice();
    arm(cv, 181, 70, 170, 60);
    club(cv, 170, 60, 142, 68, { shadow: false });
    for (const [x0, y0, x1, y1] of [[132, 63, 124, 55], [128, 69, 116, 69], [137, 59, 135, 49], [148, 60, 154, 51]]) cv.fill(cv.mask().line(x0, y0, x1, y1), FY);
    sparkle(cv, 139, 71, 2, FL, WH);
    cv.px([[137, 69], [141, 69], [137, 73], [141, 73]], FY);
    const poseB = cv.mask();
    for (let i = 0; i < cv.p.length; i++) if (cv.p[i] !== base[i]) poseB.d[i] = 1;
    poseB.each((x, y) => hit.set(x, y, cv.p[y * W + x]));
    cv.p = snap;

    cv.outline(INK);
    return cv.punch(...HOLE, HR);
  },
};
