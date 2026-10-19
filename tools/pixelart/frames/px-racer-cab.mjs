// Sit-down racing cabinet seen from behind the driver's seat: chasing-bulb marquee with a waving
// checkered flag, an italic TURBO plate and a KAYBORO maker badge, red-and-white livery with speed
// stripes, a chunky steering wheel and gauges on the dash, a gear shifter, a blinking 1P button and
// a charcoal-and-red bucket seat in the foreground.
import { Canvas, bayer } from '../pixel.mjs';
import { INK, SHAPES, inset, part, sprite, spriteMask, sparkle, scallop } from '../kit.mjs';

const W = 304, H = 280, HOLE = [56, 62, 192, 108]; // 16:9
const Rd = ['#4a0b22', '#7f1430', '#b81f34', '#e8343c', '#ff6b5e', '#ffb3a0']; // red livery
const Wh = ['#4f4a68', '#8a86a3', '#c3c0d6', '#e6e4f0', '#fbfaff']; // white livery
const Ch = ['#07060c', '#100e18', '#1a1726', '#262236', '#36304a', '#4c4564']; // charcoal dash / bezel / seat
const Rb = ['#0d0b14', '#1a1724', '#2a2638', '#3d3850', '#58516e', '#7a7290']; // rubber
const Y = ['#8a3a10', '#d06a1c', '#ffa62d', '#ffd84a', '#fff4b0']; // bulbs / gold
const G = ['#2a2a3a', '#55566c', '#8a8ca4', '#bfc1d4', '#eef0fa']; // chrome
const K = ['#0b3f5a', '#1b7fa3', '#3fc6e8', '#9af0ff', '#e8fdff']; // gauge glow
const Pk = ['#5a1838', '#a83a6a', '#e86a9a', '#ffa6c4', '#ffe0ec']; // pearl-pink mascot
const SH = '#2a2140'; // floor shadow
const BULB = ['.ab.', 'abbc', 'bbcc', '.cc.'];
// Three bulb groups lit in turn (0 -> 1 -> 2 = clockwise), 0.4s per step.
const chase = (i) => `.c${i}{animation:ch 1.2s steps(1) ${['0s', '-.8s', '-.4s'][i]} infinite}`;

export default {
  id: 'px-racer-cab', name: 'Turbo Seat', theme: 'racing', rarity: 'rare', translucent: false,
  collection: 'coin-op', license: 'CC-BY-4.0',
  desc: "Buckle into the driver's seat of a red racing cabinet where the marquee bulbs chase you to the finish line.",
  tags: ['racing', 'arcade', 'cabinet', 'checkered-flag', 'animated', 'pixel'],
  css: [0, 1, 2].map(chase).join('') + '@keyframes ch{0%{opacity:1}33.4%{opacity:0}}' +
    '.blink{animation:bl 1.6s steps(1) infinite}@keyframes bl{50%{opacity:0}}',
  draw() {
    const cv = new Canvas(W, H);
    cv.use(Rd, Wh, Ch, Rb, Y, G, K, Pk);
    const lay = [0, 1, 2].map((i) => cv.layer(`c${i}`)), blink = cv.layer('blink');

    // Soft floor shadow under the cabinet (dithered top and bottom edges).
    const floor = cv.mask().rect(0, 263, W, 11);
    cv.fill(floor, (x, y) => (y === 263 || y === 273 ? (bayer(x, y) < 0.5 ? SH : null) : SH));

    // Side fins (white, flaring toward the floor) and the red cabinet body between them.
    const finL = cv.mask().poly([[24, 50], [14, 58], [4, 236], [4, 256], [10, 264], [24, 264]]);
    const fins = finL.mirror();
    cv.shade(fins, Wh, { top: [4], left: [4, 3], bottom: [0], right: [1], fill: 3 });
    const edge = (x) => 212 - (x - 4) * 0.9; // slanted top of the red skirt
    const skirt = fins.and(cv.mask().plot((x, y) => y >= edge(x < W / 2 ? x : W - 1 - x)));
    cv.shade(skirt, Rd, { top: [4], left: [4], bottom: [0], right: [1], fill: 2 });
    cv.fill(fins.sub(skirt).and(skirt.shift(0, -2)), Y[2]);
    let stripes = cv.mask(); // tapered speed stripes
    for (const [y, n, c] of [[90, 19, Rd[3]], [96, 15, Rd[2]], [102, 11, Y[2]]]) {
      const m = cv.mask().rect(24 - n, y, n, 3).and(finL).mirror();
      cv.fill(m, c);
      stripes = stripes.or(m);
    }
    cv.fill(stripes.and(stripes.shift(0, -1)).sub(stripes.shift(0, 1)), (x, y, c) => cv.step(c, -1));
    for (const cx of [16, W - 17]) { // number roundels, centred on the fins
      const r = cv.mask().circle(cx, 146, 4);
      cv.cast(r.dilate(1), 1, 1, -1);
      cv.fill(r, Ch[2]).fill(r.edge(), Ch[0]);
      cv.text('1', cx - 1, 144, Wh[4]);
    }
    const body = cv.mask().rect(24, 46, 256, 218);
    cv.shade(body, Rd, { top: [5], left: [4], bottom: [0], right: [1], fill: 2 });
    cv.cast(body.dilate(1), -1, 0, -1);

    // Kick plate the cabinet stands on, with rubber feet.
    part(cv, cv.mask().rect(6, 262, 292, 5), Ch, { top: [4], left: [4], fill: 2, bottom: [0], right: [1], shadow: false });
    for (const x of [12, 282]) part(cv, cv.mask().rrect(x, 267, 10, 3, 1), Rb, { top: [4], left: [3], fill: 2, bottom: [0], right: [1], shadow: false });

    // Marquee housing with chasing bulbs round a waving checkered panel.
    const hood = cv.mask().rrect(14, 2, 276, 46, [5, 5, 2, 2]);
    part(cv, hood, Rd, { top: [5], left: [4], bottom: [0], right: [1], fill: 3, dy: 2 });
    const panel = cv.mask().rect(24, 11, 256, 29);
    const wave = (x) => Math.sin(x * 0.09) * 2.2;
    cv.fill(panel, (x, y) => {
      const v = y + wave(x), lightSq = (Math.floor((x - 24) / 7) + Math.floor((v - 9) / 7)) % 2 === 0;
      const fold = Math.cos(x * 0.09); // facing the light or turning away
      if (lightSq) return fold > 0.35 ? Wh[4] : fold > -0.4 ? Wh[3] : Wh[2];
      return fold > 0.35 ? Ch[4] : fold > -0.4 ? Ch[3] : Ch[2];
    });
    cv.rect(24, 11, 256, 1, Ch[0]).rect(24, 11, 1, 29, Ch[0]); // panel sits recessed
    cv.rect(24, 39, 256, 1, Rd[4]).rect(279, 12, 1, 28, Rd[4]);
    // Italic TURBO plate.
    const plate = cv.mask().poly([[98, 12], [214, 12], [208, 39], [92, 39]]);
    cv.cast(plate.dilate(1), 2, 1, -2);
    cv.shade(plate, Rd, { top: [5], left: [4], bottom: [0], right: [1], fill: 3 });
    cv.outline(INK, plate, { all: true });
    const up = cv.textMask('TURBO', 150, 15, { font: 5, scale: 3, align: 'center' });
    const slant = (m) => { const o = cv.mask(); m.each((x, y) => o.put(x + Math.floor((35 - y) / 4), y)); return o; };
    const logo = slant(up); // smooth italic: shear one pixel every 4 rows
    for (let k = 2; k >= 1; k--) cv.fill(logo.shift(k, k), k === 2 ? INK : Rd[0]);
    cv.grad(logo, [Y[4], Y[3], Y[2], Y[1]], { from: 15, to: 35, soft: 0 });
    cv.fill(slant(up.sub(up.shift(0, 1))), '#ffffff'); // top highlight from the upright glyphs
    // Maker badge tucked under the plate's left end: gold KAYBORO on charcoal.
    const badge = cv.mask().rrect(55, 28, 35, 9, 2);
    part(cv, badge, Ch, { top: [4], left: [3], bottom: [0], right: [1], fill: 1, dx: 2, dy: 1, shadow: -2 });
    cv.text('KAYBORO', 59, 30, Y[3]);
    // Bulbs clockwise round the hood.
    const ring = [];
    for (let x = 22; x <= 278; x += 8) ring.push([x, 5]);
    for (let y = 14; y <= 30; y += 8) ring.push([283, y]);
    for (let x = 278; x >= 22; x -= 8) ring.push([x, 42]);
    for (let y = 30; y >= 14; y -= 8) ring.push([17, y]);
    ring.forEach(([x, y], i) => {
      sprite(cv, x, y, BULB, { a: Y[1], b: Y[0], c: Rd[0] });
      sprite(lay[i % 3], x, y, BULB, { a: '#ffffff', b: Y[3], c: Y[2] });
    });

    // Chrome strip under the hood.
    cv.rect(24, 48, 256, 2, G[1]).rect(24, 48, 256, 1, G[3]);

    // Glossy monitor bezel; the glare streak stops short of the recessed lip.
    const bezel = cv.mask().rrect(40, 52, 224, 126, 5);
    part(cv, bezel, Ch, { top: [5], left: [4], bottom: [0], right: [1], fill: 2, dy: 2 });
    inset(cv, ...HOLE, 0, { rim: INK, top: Ch[0], bottom: Ch[4], right: Ch[3] }, 3);
    cv.fill(cv.mask().capsule(43, 92, 52, 56, 0.6).or(cv.mask().capsule(43, 100, 54, 58, 0.6))
      .and(bezel.erode(1)).sub(cv.mask().rect(51, 57, 202, 118)), Ch[5]);

    // Dashboard: carbon-weave deck with a red lip trim and a darker front face.
    const dash = cv.mask().rrect(16, 180, 272, 50, [8, 8, 0, 0]);
    part(cv, dash, Ch, { top: [5, 4], left: [4], bottom: [1], right: [2], fill: 3, dy: 2 });
    cv.fill(dash.erode(2), (x, y, c) => (c === Ch[3] && ((x >> 1) + (y >> 1)) % 2 ? Ch[2] : c));
    const face = cv.mask().rect(16, 230, 272, 12);
    cv.shade(face, Ch, { top: [2], left: [2], bottom: [0], right: [1], fill: 1 });
    cv.rect(16, 230, 272, 1, Rd[3]).rect(16, 231, 272, 1, Rd[1]);
    for (const [x, w, f] of [[26, 84, 1], [194, 84, -1]]) { // speed stripes trailing off the wheel
      cv.rect(x, 234, w, 1, Wh[3]).rect(f > 0 ? x + 14 : x, 237, w - 14, 1, Rd[3]).rect(f > 0 ? x + 30 : x, 240, w - 30, 1, Y[2]);
    }

    // Gauges either side of the wheel: speedo (cyan) and tacho (red line).
    for (const [cx, red] of [[92, false], [212, true]]) {
      const cy = 203;
      part(cv, cv.mask().circle(cx, cy, 13), G, { top: [4], left: [3], bottom: [0], right: [1], fill: 2, dy: 2 });
      const dial = cv.mask().circle(cx, cy, 10);
      cv.fill(dial, Ch[1]);
      cv.glow(dial, cx + 0.5, cy + 3.5, 10, 1.5);
      cv.fill(dial.edge(), Ch[0]);
      for (let k = 0; k <= 8; k++) {
        const a = Math.PI * (0.75 + k * 0.1875), r = k % 2 ? 7.6 : 7;
        cv.set(Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r), red && k >= 7 ? Rd[4] : k % 2 ? K[2] : K[3]);
      }
      const na = red ? Math.PI * 1.9 : Math.PI * 1.4;
      cv.fill(cv.mask().line(cx, cy, Math.round(cx + Math.cos(na) * 7), Math.round(cy + Math.sin(na) * 7)), red ? Rd[4] : Y[3]);
      cv.rect(cx, cy, 2, 2, G[3]).set(cx, cy, G[4]);
      cv.rect(cx - 3, cy + 5, 7, 2, Ch[0]).rect(cx - 2, cy + 5, red ? 2 : 4, 1, red ? Rd[4] : K[3]);
      cv.set(cx - 6, cy - 7, Wh[4]).set(cx - 7, cy - 6, Wh[4]).set(cx - 7, cy - 5, Wh[3]);
    }

    // 1P start button (blinks).
    part(cv, cv.mask().circle(46, 200, 10), G, { top: [4], left: [3], bottom: [0], right: [1], fill: 2, dy: 2 });
    part(cv, cv.mask().circle(46, 199, 7), Y, { top: [3], left: [2], bottom: [0], right: [1], fill: 1, shadow: false });
    blink.fill(cv.mask().circle(46, 199, 7), Y[3]);
    blink.fill(cv.mask().circle(46, 199, 7).edge(), Y[2]);
    blink.px([[43, 194], [42, 195], [43, 195], [42, 196]], '#ffffff');
    cv.text('1P', 44, 215, Wh[3]);
    cv.text('PUSH', 39, 222, Wh[1]);

    // Gear shifter on an H-gate plate, LO / HI marked beside the gate.
    part(cv, cv.mask().rrect(236, 208, 36, 18, 3), G, { top: [4], left: [3], bottom: [0], right: [1], fill: 2, dy: 2 });
    cv.fill(cv.mask().rect(244, 211, 1, 12).rect(263, 211, 1, 12).rect(244, 217, 20, 1), Ch[0]);
    cv.fill(cv.mask().rect(245, 212, 1, 11).rect(264, 212, 1, 11).rect(245, 218, 19, 1), G[4]);
    cv.text('LO', 239, 201, Wh[2]).text('HI', 263, 201, Wh[2]);
    cv.fill(cv.mask().oval(248, 214, 13, 6), Ch[0]);
    part(cv, cv.mask().rect(253, 194, 3, 23), G, { top: [4], left: [3], bottom: [0], right: [1], fill: 2, shadow: false });
    part(cv, cv.mask().circle(254, 191, 6), Rd, { top: [5, 4], left: [4], bottom: [0], right: [1], fill: 3, dy: 2 });
    cv.px([[251, 188], [252, 187], [251, 187]], '#ffffff');

    // Steering wheel: red rim with a white top marker, dark rubber grips, chrome spokes, white hub
    // with a gold star. It sits clear of the bezel so the dash's lit edge shows above it.
    const WX = 152, WY = 211, RO = 29, RI = 22;
    const rim = cv.mask().circle(WX, WY, RO).sub(cv.mask().circle(WX, WY, RI));
    const spokes = cv.mask().rect(WX - RI - 1, WY - 3, 2 * RI + 3, 7).rect(WX - 4, WY, 9, RI + 2);
    const hub = cv.mask().rrect(WX - 13, WY - 9, 27, 19, 6);
    const whole = rim.or(spokes).or(hub);
    cv.cast(whole.dilate(1), 2, 3, -2);
    cv.shade(spokes.sub(rim), G, { top: [4], left: [3], bottom: [0], right: [1], fill: 2 });
    cv.shade(rim, Rd, { top: [5, 4], left: [4], bottom: [0], right: [1], fill: 2 });
    const grips = rim.and(cv.mask().rect(0, WY - 9, W, 16));
    cv.shade(grips, Rb, { top: [4], left: [4], bottom: [0], right: [1], fill: 2 });
    cv.fill(grips.erode(1), (x, y, c) => ((x + y) % 3 ? c : Rb[1]));
    cv.fill(rim.and(cv.mask().rect(WX - 1, 0, 3, WY - RI)), Wh[3]);
    cv.fill(rim.and(cv.mask().rect(WX - 1, 0, 1, WY - RI)), Wh[4]);
    cv.shade(hub, Wh, { top: [4], left: [4], bottom: [0, 1], right: [1], fill: 3 });
    cv.outline(INK, whole, { all: true });
    cv.outline(INK, hub, { all: true });
    const star = spriteMask(cv, WX - 4, WY - 5, SHAPES.star);
    cv.fill(star.shift(1, 1).sub(star), Y[1]);
    cv.fill(star, Y[3]).set(WX, WY - 5, Y[4]).set(WX - 1, WY - 3, Y[4]);
    cv.outline(INK, star.or(star.shift(1, 1)), { all: true });

    // Lower cabinet: coin door with a blinking prompt (left), brand plate and mascot (right).
    part(cv, cv.mask().rrect(32, 245, 22, 16, 2), G, { top: [4], left: [3], bottom: [0], right: [1], fill: 2, dy: 1 });
    cv.shade(cv.mask().rrect(39, 247, 8, 12, 1), Y, { top: [3], left: [3], bottom: [0], right: [1], fill: 2 });
    cv.rect(42, 249, 2, 8, INK).rect(44, 249, 1, 8, Y[4]);
    const tag = cv.mask().rrect(58, 247, 50, 9, 2);
    part(cv, tag, Ch, { top: [2], left: [2], bottom: [4], right: [4], fill: 1, dy: 1 });
    cv.text('INSERT COIN', 61, 249, Y[0]);
    blink.text('INSERT COIN', 61, 249, Y[3]);
    const brand = cv.mask().rrect(196, 247, 34, 9, 2);
    part(cv, brand, Ch, { top: [2], left: [2], bottom: [4], right: [4], fill: 1, dy: 1 });
    cv.text('KAYBORO', 200, 249, Y[3]);
    const sh = scallop(cv, 254, 257, 11, Pk);
    cv.outline(INK, sh, { all: true });
    sparkle(cv, 272, 244, 1, Wh[4], '#ffffff');

    // Bucket seat in the foreground: charcoal bolsters and headrest shell, red centre panels with
    // white racing stripes, chrome posts. It is cut by the canvas edge, so it fades to dark there.
    const head = cv.mask().rrect(118, 241, 68, 18, [8, 8, 5, 5]);
    cv.cast(head.dilate(1), 3, 3, -2);
    for (const x of [141, 161]) part(cv, cv.mask().rect(x, 259, 2, 8), G, { top: [3], left: [3], bottom: [1], right: [1], fill: 3, shadow: false });
    cv.shade(head, Ch, { top: [5], left: [4], bottom: [0], right: [1], fill: 3 });
    const hpad = cv.mask().rrect(128, 244, 48, 11, 4);
    cv.shade(hpad, Rd, { top: [5, 4], left: [4], bottom: [1], right: [2], fill: 3 });
    cv.fill(hpad.and(cv.mask().rect(147, 0, 10, H)), (x, y) => (y < 246 ? Wh[4] : Wh[3]));
    cv.fill(hpad.ring().and(head), Ch[1]);
    cv.rect(124, 242, 8, 1, Wh[3]).rect(122, 243, 2, 1, Wh[3]); // piping highlight
    cv.outline(INK, head, { all: true });

    const bolL = cv.mask().rrect(80, 258, 30, 22, [9, 9, 0, 0]), bolR = cv.mask().rrect(194, 258, 30, 22, [9, 9, 0, 0]);
    const cush = cv.mask().rrect(108, 266, 88, 14, [6, 6, 0, 0]);
    part(cv, bolL.or(bolR), Ch, { top: [5, 4], left: [4], bottom: [0], right: [1], fill: 3 });
    cv.fill(bolL.or(bolR).and(cv.mask().rect(0, 270, W, 1)), (x, y, c) => ((x & 1) ? Ch[1] : c)); // stitch seam
    for (const b of [bolL, bolR]) cv.fill(b.erode(1).sub(b.erode(1).shift(0, 1)).and(cv.mask().rect(0, 0, W, 262)), Wh[3]);
    part(cv, cush, Rd, { top: [5, 4], left: [4], bottom: [0], right: [1], fill: 3 });
    cv.fill(cush.erode(1).and(cv.mask().rect(137, 0, 9, H).or(cv.mask().rect(158, 0, 9, H))), (x, y) => Wh[y < 269 ? 4 : 3]);
    cv.fill(cush.erode(1).sub(cush.erode(1).shift(0, 1)).sub(cv.mask().rect(137, 0, 30, H)), Wh[3]);
    for (let x = 114; x < 192; x += 3) if (x < 135 || (x > 147 && x < 156) || x > 168) cv.set(x, 274, Rd[2]);
    const seat = bolL.or(bolR).or(cush);
    cv.fill(seat.and(cv.mask().rect(0, 276, W, 1)), (x, y, c) => (bayer(x, y) < 0.5 ? cv.step(c, -1) : c));
    cv.fill(seat.and(cv.mask().rect(0, 277, W, 1)), (x, y, c) => cv.step(c, -1));
    cv.fill(seat.and(cv.mask().rect(0, 278, W, 1)), (x, y, c) => cv.step(c, -3));
    cv.fill(seat.and(cv.mask().rect(0, 279, W, 1)), INK);

    cv.outline(INK);
    return cv.punch(...HOLE);
  },
};
