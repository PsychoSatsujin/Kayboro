// Mole-bonk redemption cabinet: arched bulb marquee with a headband mole peeking over the top,
// screen in the upper cabinet, 7-segment score LEDs, a turf play deck with five holes and bobbing
// moles, a padded mallet tethered by a cord, coin slot and a ticket dispenser spitting a folded strip.
import { Canvas, rng, bayer } from '../pixel.mjs';
import { INK, inset, part, sparkle, slots, scallop, sticker, SHAPES, led, screw } from '../kit.mjs';

const W = 256, H = 312, HOLE = [48, 68, 160, 120], HR = 2; // 4:3
const Bl = ['#111845', '#1b2a72', '#2440a3', '#305ccc', '#4880e6', '#76a8f4', '#b4d4ff']; // cabinet blue
const Yw = ['#7a4210', '#c27a14', '#f2b21f', '#ffd640', '#ffeb85', '#fff8cf']; // sunny yellow
const Or = ['#7a2410', '#c4481a', '#f07a26', '#ffa64d', '#ffd08f']; // orange
const Rd = ['#5c0f2a', '#a01a3c', '#dd2f4c', '#ff5d6a', '#ff98a0', '#ffd2d4']; // coral red
const Gr = ['#123a32', '#1e5e3a', '#2f8a3e', '#4fb24a', '#86d65e', '#c4f08a']; // turf
const Mo = ['#2a1622', '#4a2a2c', '#734334', '#9a6342', '#c08c5c', '#e6c08e', '#fbe6c4']; // mole cocoa
const Pk = ['#a8336f', '#e65d93', '#ff94bb', '#ffd3e4']; // nose pink
const G = ['#2a2a3a', '#55566c', '#8a8ca4', '#bfc1d4', '#eef0fa']; // chrome
const B = ['#07060c', '#100e19', '#1a1726', '#262236', '#36304a', '#4a4462']; // glossy bezel
const LED = { bg: '#14080f', off: '#3a1220', on: '#ff4a3a', hot: '#ffc49a' };
const Tk = ['#a8481a', '#e0782a', '#ffad4a', '#ffdc9a']; // ticket stock

const SEG = { a: [[1, 0], [2, 0], [3, 0]], b: [[4, 1], [4, 2], [4, 3]], c: [[4, 5], [4, 6], [4, 7]], d: [[1, 8], [2, 8], [3, 8]],
  e: [[0, 5], [0, 6], [0, 7]], f: [[0, 1], [0, 2], [0, 3]], g: [[1, 4], [2, 4], [3, 4]] };
const DIG = ['abcdef', 'bc', 'abged', 'abgcd', 'fgbc', 'afgcd', 'afgedc', 'abc', 'abcdefg', 'abcdfg'];
const seven = (cv, x, y, n) => {
  for (const [k, pts] of Object.entries(SEG)) {
    const on = DIG[n].includes(k);
    for (const [i, j] of pts) cv.set(x + i, y + j, on ? (i === 0 || j === 0 ? LED.hot : LED.on) : LED.off);
  }
};

// Marquee arch: top edge sinks toward the sides.
const archTop = (x) => 22 + 7 * ((x + 0.5 - 128) / 112) ** 2;

// Holes on the deck: [cx, cy, inner w, inner h].
const HOLES = [[84, 230, 24, 9], [128, 230, 24, 9], [172, 230, 24, 9], [106, 248, 26, 10], [150, 248, 26, 10]];

/** A mole popping out of a hole. state: 'up' | 'peek' | 'bonk' | 'none'. */
function mole(cv, [cx, cy, w, h], state) {
  if (state === 'none') return;
  const rise = state === 'peek' ? 6 : cy < 240 ? 14 : 16, top = cy - rise, bw = w - 8, x0 = cx - (bw >> 1);
  const inner = cv.mask().oval(cx - (w >> 1), cy - (h >> 1), w, h);
  const clip = cv.mask().rect(0, 0, W, cy).or(inner);
  const body = cv.mask().rrect(x0, top, bw, rise + h, [7, 7, 0, 0]).and(clip);
  cv.fill(body.ring().and(clip), INK);
  cv.shade(body, Mo, { top: [5, 4], left: [4], bottom: [1], right: [2], fill: 3 });
  cv.fill(cv.mask().oval(cx - 5, top + 9, 10, 14).and(body.erode(1)), (x, y) => (y < top + 11 ? Mo[5] : Mo[4])); // belly
  cv.fill(body.and(cv.mask().rect(0, cy - 1, W, h)), (x, y, c) => cv.step(c, -1)); // hole shadow on the body
  const ey = top + 5;
  if (state === 'bonk') {
    for (const ex of [cx - 5, cx + 2]) cv.px([[ex, ey], [ex + 2, ey], [ex + 1, ey + 1], [ex, ey + 2], [ex + 2, ey + 2]], INK);
    cv.rect(cx - 2, top, 5, 1, Rd[2]).rect(cx - 1, top - 1, 3, 1, Rd[3]).set(cx - 1, top - 1, Rd[5]).set(cx - 2, top, Rd[3]); // bump
    sparkle(cv, cx - 11, top + 5, 2, Yw[3], Yw[5]);
    sparkle(cv, cx + 11, top + 5, 2, Yw[3], Yw[5]);
    cv.set(cx + 8, top, Yw[5]); // a little star above the ear
  } else {
    for (const ex of [cx - 5, cx + 3]) cv.rect(ex, ey, 2, 3, INK).set(ex, ey, '#ffffff');
  }
  cv.fill(cv.mask().oval(cx - 2, top + 8, 5, 3, 1.4), Pk[1]).set(cx - 1, top + 8, Pk[3]); // nose
  if (state !== 'peek') {
    cv.rect(cx - 1, top + 11, 3, 2, '#ffffff').set(cx, top + 12, Mo[4]); // teeth
    cv.rect(cx - 7, top + 9, 2, 1, Pk[2]).rect(cx + 6, top + 9, 2, 1, Pk[2]); // cheeks
    for (const px of [cx - 9, cx + 4]) { // paws on the rim
      const paw = cv.mask().oval(px, cy - 2, 6, 4);
      cv.outline(INK, paw, { all: true });
      cv.fill(paw, (x, y) => (y === cy - 2 ? Mo[6] : Mo[5]));
      cv.set(px + 2, cy + 1, Mo[3]).set(px + 4, cy + 1, Mo[3]);
    }
  }
}

/** Hole with a raised yellow rubber ring. */
function hole(cv, [cx, cy, w, h]) {
  const ring = cv.mask().oval(cx - (w >> 1) - 3, cy - (h >> 1) - 2, w + 6, h + 4);
  part(cv, ring, Yw, { top: [5], left: [4], bottom: [1], right: [2], fill: 3, dy: 1 });
  const inner = cv.mask().oval(cx - (w >> 1), cy - (h >> 1), w, h);
  cv.fill(inner, (x, y) => (y < cy - 1 ? Mo[1] : y < cy + 1 ? (bayer(x, y) < 0.5 ? Mo[1] : Mo[0]) : Mo[0]));
  cv.fill(inner.edge(), Mo[0]);
}

export default {
  id: 'px-mole-bash', name: 'Mole Bash', theme: 'mole-bonk', rarity: 'epic', translucent: false,
  collection: 'coin-op', license: 'CC-BY-4.0',
  desc: 'Bop the bobbing moles, grab your tickets and keep your game glowing in the cabinet up top.',
  tags: ['arcade', 'moles', 'cabinet', 'tickets', 'animated', 'pixel'],
  css: '.chase{animation:ch 1s steps(1) infinite}@keyframes ch{50%{opacity:0}}' +
    '.bob{animation:bob 1.1s steps(1) infinite}@keyframes bob{50%{opacity:0}}',
  draw() {
    const cv = new Canvas(W, H), rnd = rng(11);
    cv.use(Bl, Yw, Or, Rd, Gr, Mo, Pk, G, B, Tk);

    // Cabinet: side strips with yellow T-molding, front between them.
    const front = cv.mask().rect(26, 50, 204, 254);
    cv.shade(front, Bl, { top: [4], left: [4], bottom: [0], right: [1], fill: 3 });
    for (const [x, flip] of [[18, false], [230, true]]) {
      const side = cv.mask().rect(x, 50, 8, 254);
      cv.shade(side, Bl, { top: [4], left: [3], bottom: [0], right: [1], fill: 2 });
      cv.shade(cv.mask().rect(flip ? x + 6 : x, 50, 2, 254), Yw, { top: [4], left: [4], bottom: [0], right: [1], fill: 3 });
      cv.rect(flip ? x + 3 : x + 4, 56, 1, 244, Bl[1]);
    }

    // Marquee: arched box, sunburst panel, chunky title, bulbs.
    const mq = cv.mask().plot((x, y) => y >= archTop(x) && y < 58, 14, 0, 242, 58);
    cv.shade(mq, Bl, { top: [6, 5], left: [5], bottom: [1], right: [2], fill: 4 });
    const panel = mq.erode(5, true);
    cv.fill(panel, (x, y) => {
      const a = Math.atan2(x + 0.5 - 128, 64 - y), k = Math.floor((a + Math.PI) / (Math.PI / 14));
      return k % 2 ? Yw[3] : Yw[2];
    });
    cv.fill(panel.edge(), Or[1]);
    cv.fill(panel.ring().and(mq), Bl[1]);
    const title = cv.textMask('MOLE BASH', 128, 32, { font: 5, scale: 2, align: 'center' });
    const ext = title.or(title.shift(1, 1)).or(title.shift(2, 2));
    cv.cast(ext.dilate(1), 1, 1, -2);
    cv.fill(title.shift(2, 2), INK).fill(title.shift(1, 1), Rd[0]);
    cv.outline(INK, ext, { all: true });
    cv.grad(title, [Rd[3], Rd[2], Rd[1]], { from: 32, to: 45, soft: 0.6 });
    cv.fill(title.sub(title.shift(0, 1)), Rd[5]);
    cv.fill(title.sub(title.shift(1, 0)).sub(title.shift(0, 1)).and(title.shift(0, -1)), Rd[4]);

    // Mascot: a sporty mole in a coral sweatband with a star pin, peeking over the arch, paws on the rim.
    const head = cv.mask().oval(113, 4, 30, 30).and(cv.mask().plot((x, y) => y < archTop(x) + 1, 100, 0, 156, 40));
    const tuft = cv.mask().pts([[126, 3], [127, 2], [128, 3], [129, 2], [130, 3]]);
    cv.outline(INK, head.or(tuft));
    cv.fill(tuft, Mo[3]).set(127, 2, Mo[4]);
    cv.shade(head, Mo, { top: [5, 4], left: [4], bottom: [1], right: [2], fill: 3 });
    const band = head.and(cv.mask().plot((x, y) => y >= 8 + Math.round(((x + 0.5 - 128) / 15) ** 2 * 2) && y < 11 + Math.round(((x + 0.5 - 128) / 15) ** 2 * 2), 110, 0, 146, 20));
    cv.fill(band.shift(0, 1).and(head).sub(band), Mo[2]); // band shadow on the brow
    cv.shade(band, Rd, { top: [4], left: [3], bottom: [1], right: [1], fill: 2 });
    band.each((x, y) => { if (!band.has(x, y - 1) && (x & 3) === 1) cv.set(x, y + 1, Rd[3]); }); // terry ribs
    const pin = cv.mask().pts([[128, 6], [127, 7], [128, 7], [129, 7], [125, 8], [126, 8], [127, 8], [128, 8], [129, 8], [130, 8], [131, 8],
      [126, 9], [127, 9], [128, 9], [129, 9], [130, 9], [127, 10], [128, 10], [129, 10], [126, 11], [127, 11], [129, 11], [130, 11]]);
    cv.outline(INK, pin, { all: true });
    cv.shade(pin, Yw, { top: [5], left: [4], bottom: [1], right: [2], fill: 3 });
    cv.set(128, 8, '#ffffff');
    cv.fill(cv.mask().oval(121, 13, 14, 8).and(head), (x, y) => (y === 13 ? Mo[5] : Mo[4])); // muzzle
    for (const ex of [119, 135]) cv.rect(ex, 12, 2, 3, INK).set(ex, 12, '#ffffff');
    cv.fill(cv.mask().oval(126, 14, 5, 4, 1.4), Pk[1]).set(127, 14, Pk[3]).set(129, 16, Pk[0]);
    cv.rect(115, 16, 3, 1, Pk[2]).rect(138, 16, 3, 1, Pk[2]);
    cv.rect(127, 18, 3, 2, '#ffffff').set(128, 19, Mo[4]);
    for (const px of [106, 142]) {
      const paw = cv.mask().oval(px, 18, 8, 5);
      cv.outline(INK, paw, { all: true });
      cv.fill(paw, (x, y) => (y === 18 ? Mo[6] : Mo[5]));
      cv.set(px + 2, 22, Mo[3]).set(px + 4, 22, Mo[3]).set(px + 6, 21, Mo[4]);
    }

    // Bulb positions along the marquee border (lit state drawn by the animation step at the end).
    const bulbs = [];
    for (let x = 23; x <= 231; x += 13) if (Math.abs(x + 2 - 128) > 24) bulbs.push([x, Math.round(archTop(x + 2)) + 1]);
    for (const y of [35, 46]) bulbs.push([15, y], [237, y]);

    // Glossy bezel round the screen.
    const bezel = cv.mask().rrect(36, 60, 184, 138, 5);
    part(cv, bezel, B, { top: [4], left: [3], bottom: [0], right: [1], fill: 2, dy: 2 });
    // Glare: a soft 2px band with a bright core in the top-left bezel corner, kept off the screen lip.
    const lipZone = cv.mask().rect(HOLE[0] - 4, HOLE[1] - 4, HOLE[2] + 8, HOLE[3] + 8);
    const glareZone = bezel.erode(1).sub(lipZone).sub(cv.mask().rect(0, 0, 50, 66)); // keep the screw clear
    const band2 = (x0, y0, x1, y1) => cv.mask().plot((x, y) => {
      const d = ((x + 0.5 - x0) * (y1 - y0) - (y + 0.5 - y0) * (x1 - x0)) / Math.hypot(x1 - x0, y1 - y0);
      const t = ((x + 0.5 - x0) * (x1 - x0) + (y + 0.5 - y0) * (y1 - y0)) / ((x1 - x0) ** 2 + (y1 - y0) ** 2);
      return t >= 0 && t <= 1 && d > -1.1 && d <= 1.1;
    });
    for (const [x0, y0, x1, y1] of [[37, 102, 58, 60], [37, 112, 64, 60]]) {
      const gb = band2(x0, y0, x1, y1).and(glareZone);
      cv.fill(gb, B[4]);
      cv.fill(gb.and(gb.shift(1, 0)).and(gb.shift(0, 1)), B[5]);
    }
    inset(cv, ...HOLE, HR, { rim: INK, top: B[0], bottom: B[4], right: B[3] }, 2);

    for (const [x, y] of [[39, 62], [212, 62], [39, 191], [212, 191]]) screw(cv, x, y, [G[0], G[1], G[2], G[4]]);

    // Score LEDs above the deck.
    const ledp = cv.mask().rrect(44, 200, 168, 14, 2);
    part(cv, ledp, B, { top: [1], left: [1], bottom: [4], right: [3], fill: 0, shadow: false, ink: Bl[0] });
    const readout = (label, x, digits) => {
      cv.text(label, x, 205, Bl[5]);
      const bx = x + cv.textWidth(label) + 3;
      cv.rect(bx, 202, digits.length * 7 + 2, 11, LED.bg);
      digits.forEach((n, k) => seven(cv, bx + 2 + k * 7, 203, n));
    };
    readout('SCORE', 50, [0, 3, 5, 0]);
    readout('TIME', 112, [3, 0]);
    readout('TIX', 158, [0, 8]);
    cv.rect(196, 205, 11, 5, Tk[2]).rect(196, 205, 11, 1, Tk[3]).rect(196, 209, 11, 1, Tk[1]); // ticket icon, notched ends
    cv.set(196, 207, LED.bg).set(206, 207, LED.bg).rect(199, 206, 1, 3, Tk[1]).rect(201, 206, 3, 3, Rd[2]).set(201, 206, Rd[4]);

    // Play deck: lit blue plastic top, turf playfield, front lip.
    const deck = cv.mask().poly([[20, 216], [236, 216], [252, 262], [4, 262]]);
    part(cv, deck, Bl, { top: [6, 5], left: [5], bottom: [3], right: [4], fill: 5, dy: 2 });
    const turf = cv.mask().poly([[64, 218], [192, 218], [200, 259], [56, 259]]);
    cv.shade(turf, Gr, { top: [1], left: [1], bottom: [4], right: [3], fill: 3 });
    turf.erode(1).each((x, y) => {
      const r = rnd();
      if (r < 0.07) cv.set(x, y, Gr[4]); else if (r < 0.12) cv.set(x, y, Gr[2]);
      else if (r < 0.14 && turf.has(x, y - 1)) cv.set(x, y, Gr[5]).set(x, y + 1, Gr[4]);
    });
    cv.fill(turf.ring().and(deck), Bl[3]);
    HOLES.forEach((h) => hole(cv, h));
    const lip = cv.mask().rect(4, 262, 248, 12);
    cv.shade(lip, Rd, { top: [4], left: [3], bottom: [0], right: [1], fill: 2 });
    for (let x = 8; x < 250; x += 12) cv.rect(x, 264, 6, 8, Rd[1]);
    cv.rect(4, 263, 248, 1, Rd[5]);
    const brand = cv.mask().rrect(106, 263, 44, 10, 2);
    part(cv, brand, B, { top: [4], left: [3], bottom: [0], right: [1], fill: 2, shadow: -1 });
    cv.text('KAYBORO', 128, 266, Yw[3], { align: 'center' });

    // Start button on the left of the deck.
    cv.shade(cv.mask().oval(23, 233, 30, 14), Bl, { top: [3], left: [3], bottom: [6], right: [5], fill: 4 });
    part(cv, cv.mask().oval(27, 234, 22, 11), G, { top: [4], left: [3], bottom: [0], right: [1], fill: 2, dy: 1 });
    part(cv, cv.mask().oval(29, 232, 18, 9), Yw, { top: [5], left: [4], bottom: [1], right: [2], fill: 3, shadow: false });
    cv.rect(32, 233, 4, 1, Yw[5]).set(31, 234, Yw[5]);
    cv.text('PUSH', 38, 250, Bl[2], { align: 'center' });

    // Padded mallet lying on the deck, tied to the cabinet by a coiled cord.
    const hc = [226, 236], ax = [0.66, 0.75];
    const handle = cv.mask().capsule(203, 257, hc[0], hc[1], 1.6);
    part(cv, handle, Mo, { top: [5], left: [4], bottom: [1], right: [2], fill: 3, dy: 2, shadow: -2 });
    part(cv, cv.mask().capsule(203, 257, 207, 253, 2.2), B, { top: [5], left: [4], bottom: [1], right: [2], fill: 3, shadow: false });
    const headM = cv.mask().capsule(Math.round(hc[0] - 9 * ax[0]), Math.round(hc[1] - 9 * ax[1]), Math.round(hc[0] + 9 * ax[0]), Math.round(hc[1] + 9 * ax[1]), 7.2);
    part(cv, headM, Rd, { top: [5, 4], left: [4], bottom: [0, 1], right: [1], fill: 3, dy: 2, shadow: -2 });
    headM.erode(1).each((x, y) => {
      const t = (x + 0.5 - hc[0]) * ax[0] + (y + 0.5 - hc[1]) * ax[1];
      if (Math.abs(Math.abs(t) - 9) < 1.6) cv.set(x, y, cv.step(Yw[3], (x - hc[0]) * -ax[1] + (y - hc[1]) * ax[0] < 0 ? 1 : -1));
    });
    cv.glow(headM, hc[0] - 4, hc[1] - 5, 6, 1);
    let prev = null;
    for (let t = 0; t <= 1; t += 0.02) { // cord from the handle butt to an eyelet on the lip
      const x = Math.round((1 - t) ** 2 * 202 + 2 * t * (1 - t) * 214 + t * t * 238);
      const y = Math.round((1 - t) ** 2 * 259 + 2 * t * (1 - t) * 278 + t * t * 266);
      if (prev && prev[0] === x && prev[1] === y) continue;
      prev = [x, y];
      cv.set(x, y, INK).set(x, y - 1, (x & 1) ? Rd[4] : INK);
    }
    part(cv, cv.mask().circle(238, 266, 2), G, { top: [4], left: [3], bottom: [0], right: [1], fill: 2 });
    cv.set(238, 266, INK);

    // Overhang shadow under the deck lip.
    cv.fill(cv.mask().rect(18, 274, 220, 2), (x, y, c) => cv.step(c, y === 274 ? -2 : -1));

    // Lower cabinet: coin door, ticket dispenser, scallop sticker, kick plate.
    const kick = cv.mask().rect(26, 298, 204, 6);
    cv.shade(kick, B, { top: [4], left: [3], bottom: [0], right: [1], fill: 2 });
    slots(cv, 34, 300, 188, 1, 2, B[0], B[3]);
    const door = cv.mask().rrect(100, 278, 56, 20, 3);
    part(cv, door, G, { top: [4], left: [3], bottom: [0], right: [1], fill: 2, dy: 2 });
    cv.shade(cv.mask().rrect(106, 281, 9, 13, 2), Or, { top: [3], left: [3], bottom: [0], right: [1], fill: 2 });
    cv.rect(110, 283, 1, 9, INK).set(111, 283, Or[4]);
    led(cv, 119, 283, [Rd[1], Rd[2], Rd[4], '#ffffff'], { d: 4 });
    cv.text('25', 118, 289, G[0]);
    cv.rect(129, 281, 24, 13, B[1]);
    cv.text('INSERT', 141, 282, Or[2], { align: 'center' });
    cv.text('COIN', 141, 288, Or[2], { align: 'center' });
    const disp = cv.mask().rrect(170, 278, 34, 16, 2);
    part(cv, disp, B, { top: [5], left: [4], bottom: [0], right: [1], fill: 3, dy: 2 });
    cv.text('TICKETS', 187, 280, Yw[3], { align: 'center' });
    cv.rect(179, 287, 16, 3, INK).rect(180, 290, 14, 1, B[5]);
    // Ticket strip: hangs straight out of the mouth, then folds into a zigzag pile on the floor
    // (left end of the top layer joins the hanging strip; folds alternate right, left).
    const PX = 183, PW = 20, PY = [300, 303, 306];
    const strip = cv.mask().rect(183, 290, 8, 10);
    const pileM = cv.mask().rect(PX, 300, PW, 9).sub(cv.mask().pts([[PX, 303], [PX + PW - 1, 306], [PX + PW - 1, 308], [PX, 308]]));
    const all = strip.or(pileM);
    cv.cast(all.dilate(1), 1, 1, -2);
    cv.outline(INK, all, { all: true });
    for (let y = 290; y < 300; y += 7) {
      const h = Math.min(6, 300 - y);
      cv.rect(183, y, 8, h, Tk[2]).rect(183, y, 1, h, Tk[3]).rect(190, y, 1, h, Tk[1]);
      if (h === 6) cv.rect(183, y + 6, 8, 1, Tk[0]).set(185, y + 6, Tk[1]).set(188, y + 6, Tk[1]);
      cv.set(186, y + 2, Rd[2]).set(187, y + 2, Rd[2]).set(186, y + 3, Rd[3]).set(187, y + 3, Rd[3]);
    }
    cv.fill(pileM, (x, y) => ((y - 300) % 3 === 0 ? Tk[3] : (y - 300) % 3 === 2 ? Tk[1] : Tk[2]));
    cv.rect(PX + 1, 302, PW - 2, 1, Tk[0]).rect(PX + 2, 305, PW - 2, 1, Tk[0]); // creases between layers
    cv.set(PX + PW - 1, 302, Tk[3]).set(PX + PW - 1, 303, Tk[2]).set(PX, 305, Tk[3]).set(PX, 306, Tk[2]); // fold turns
    for (const y of PY) for (const x of [PX + 6, PX + 13]) cv.set(x, y + 1, Tk[0]); // perforations
    for (const [x, y] of [[PX + 9, 301], [PX + 3, 304], [PX + 16, 304], [PX + 9, 307]]) cv.set(x, y, Rd[2]);
    cv.rect(183, 299, 8, 1, Tk[2]).set(183, 299, Tk[3]); // strip runs into the top layer
    cv.rect(180, 288, 14, 2, INK);
    const shell = scallop(cv, 62, 296, 13, Rd);
    cv.cast(shell.dilate(1), 1, 1, -1);
    cv.outline(INK, shell, { all: true });
    sticker(cv, 74, 280, SHAPES.star, Yw);
    sticker(cv, 212, 282, SHAPES.heart, [Pk[0], Pk[0], Pk[1], Pk[2], Pk[3]]);

    cv.outline(INK);
    // Floor shadow, after the outline pass so it stays a soft dithered pool (only on empty pixels).
    cv.fill(cv.mask().oval(8, 303, 240, 8), (x, y, c) => c || (Math.abs(x + 0.5 - 128) < 104 || bayer(x, y) < 0.5 ? '#120c1c' : null));
    // Animation: diff layers between two states (bulbs chase, moles bob).
    const states = (draw) => {
      const base = cv.p.slice();
      draw(cv, 0); const pa = cv.p.slice();
      cv.p = base.slice(); draw(cv, 1); const pb = cv.p;
      cv.p = pa;
      return pb;
    };
    const diffLayer = (cls, pb) => {
      const l = cv.layer(cls);
      for (let i = 0; i < pb.length; i++) if (pb[i] !== cv.p[i]) l.p[i] = pb[i];
    };
    diffLayer('chase', states((c, s) => bulbs.forEach(([x, y], i) => {
      const on = (i + s) % 2 === 0;
      c.outline(INK, c.mask().oval(x, y, 4, 4, 1.1), { all: true });
      led(c, x, y, on ? [Yw[2], Yw[4], Yw[5], '#ffffff'] : [Or[0], Or[1], Or[2], Or[3]], { d: 4 });
    })));
    const A = ['up', 'peek', 'none', 'none', 'up'], Bs = ['peek', 'bonk', 'up', 'up', 'none'];
    diffLayer('bob', states((c, s) => HOLES.forEach((h, i) => mole(c, h, (s ? Bs : A)[i]))));

    return cv.punch(...HOLE, HR);
  },
};
