// Critter Crate: a honey-pine crate TV on a grassy mound with friends peeking from every side: a
// giraffe neck over the top, a waving panda, a fox napping on the roof, a bear cub hugging the side,
// a hamster in a nest cubby, a frog on the dial, a penguin and a duckling at the corners.
import { Canvas, ramp, rng } from '../pixel.mjs';
import { INK, inset, part, sprite, spriteMask, sparkle, slots } from '../kit.mjs';

const W = 256, H = 256, HOLE = [64, 76, 128, 96], HR = 4; // 4:3
const soft = { step: 0.12, hue: 9, sat: 0.06 };
const Wd = ramp('#c4844c', 6, { step: 0.12, hue: 6, sat: 0.05 }); // honey pine crate
const Mn = ramp('#6cc2a2', 6, soft); // mint painted bezel
const Gf = ramp('#f2c050', 5, soft); // giraffe
const Gs = ramp('#b8682e', 4, soft); // giraffe spots / mane
const Fx = ramp('#ec7a30', 5, soft); // fox
const Cm = ramp('#f4e6cc', 5, soft); // cream fur / muzzles
const Br = ramp('#94603e', 5, soft); // bear cocoa
const Pd = ramp('#3e3852', 5, soft); // panda black
const Pg = ramp('#3c4c7a', 5, soft); // penguin navy
const Dk = ramp('#ffd650', 5, soft); // duckling
const Fr = ramp('#7cc84c', 5, soft); // frog
const Hm = ramp('#e8aa6c', 5, soft); // hamster
const Gr = ramp('#5cae4a', 5, soft); // grass
const Bs = ramp('#e0b04c', 5, soft); // brass
const Or = ramp('#f08a2a', 4, soft); // beaks / feet
const PK = '#ff8fb0', WH = '#ffffff';

const fur = (cv, m, R, o = {}) => part(cv, m, R, { top: [4], left: [3], bottom: [1], right: [1], fill: 2, ...o });
const eyes = (cv, xs, y, h = 3) => { for (const x of xs) cv.rect(x, y, 2, h, INK).set(x, y, WH); };
const blush = (cv, xs, y) => { for (const x of xs) cv.rect(x, y, 3, 1, PK); };
const mouth = (cv, x, y) => sprite(cv, x, y, ['k.k.k', '.k.k.'], { k: INK });

function giraffe(cv) {
  const neck = cv.mask().rect(110, 24, 13, 40);
  fur(cv, neck, Gf, { shadow: false });
  for (const [x, y, w, h] of [[112, 34, 5, 4], [118, 42, 4, 5], [111, 47, 5, 4], [117, 53, 5, 4], [112, 58, 4, 4]])
    cv.fill(cv.mask().rrect(x, y, w, h, 1).and(neck.erode(1)), Gs[1]);
  cv.fill(cv.mask().rect(123, 26, 3, 38), Gs[1]).rect(125, 26, 1, 38, Gs[0]); // mane
  for (let y = 27; y < 64; y += 3) cv.set(123, y, Gs[2]);
  cv.outline(INK, cv.mask().rect(110, 24, 16, 40), { all: true });
  // Horns, ears, head and muzzle.
  for (const x of [108, 122]) {
    fur(cv, cv.mask().rect(x, 4, 3, 8), Gf, { shadow: false, top: [3], left: [3] });
    fur(cv, cv.mask().circle(x + 1, 3, 2), Gs, { shadow: false, top: [3], left: [2], bottom: [0], right: [0], fill: 1 });
  }
  fur(cv, cv.mask().oval(95, 12, 11, 6), Gf, { shadow: false });
  fur(cv, cv.mask().oval(127, 12, 11, 6), Gf, { shadow: false });
  cv.fill(cv.mask().oval(97, 14, 7, 2), PK).fill(cv.mask().oval(129, 14, 7, 2), PK);
  const head = cv.mask().oval(103, 8, 27, 21);
  fur(cv, head, Gf);
  cv.fill(cv.mask().rrect(105, 10, 4, 3, 1).and(head.erode(1)), Gs[1]).fill(cv.mask().rrect(124, 11, 3, 3, 1), Gs[1]);
  const muz = cv.mask().oval(106, 19, 21, 12);
  fur(cv, muz, Cm, { shadow: false });
  eyes(cv, [110, 121], 14);
  cv.rect(112, 23, 2, 1, Cm[0]).rect(119, 23, 2, 1, Cm[0]);
  blush(cv, [105, 125], 19);
  sprite(cv, 113, 26, ['k...k.', '.kkk..'], { k: INK });
}

function panda(cv) {
  for (const x of [50, 72]) fur(cv, cv.mask().circle(x, 31, 5), Pd, { shadow: false });
  const head = cv.mask().oval(46, 28, 32, 30);
  fur(cv, head, Cm, { shadow: false });
  for (const [x, f] of [[51, false], [66, true]]) sprite(cv, x, 37, ['..pppp.', '.pppppp', 'ppppppp', 'pppppp.', 'pppp...', '.pp....'], { p: Pd[2] }, { flip: f });
  eyes(cv, [54, 68], 38);
  cv.rect(61, 45, 3, 2, INK).set(61, 45, Pd[3]);
  sprite(cv, 60, 47, ['k.k.k', '.k.k.'], { k: INK });
  blush(cv, [50, 72], 46);
}

function pandaPaws(cv) {
  // Arm raised in a wave on the right, paw gripping the crate on the left.
  const arm = cv.mask().capsule(78, 54, 82, 43, 5);
  fur(cv, arm, Pd, { shadow: false });
  const paw = cv.mask().circle(84, 37, 6);
  fur(cv, paw, Pd, { shadow: false });
  sprite(cv, 81, 34, ['p.p.p', '.....', '.PPP.', 'PPPPP', '.PPP.'], { p: PK, P: PK });
  fur(cv, cv.mask().rrect(46, 51, 11, 8, 3), Pd, { shadow: true });
  cv.rect(48, 52, 1, 2, Pd[4]).rect(51, 52, 1, 2, Pd[4]).rect(54, 52, 1, 2, Pd[4]);
}

function fox(cv) {
  // Napping curl: body, big tail wrapped round the front, head resting on the left.
  const body = cv.mask().oval(158, 33, 40, 21);
  fur(cv, body, Fx, { dy: 1 });
  cv.fill(cv.mask().oval(166, 36, 24, 7).and(body.erode(2)), Fx[3]);
  // Fluffy tail wrapping round the rump and along the front, cream tip just under the chin.
  const arc = [], tail = cv.mask();
  for (let a = -0.7; a <= 2.95; a += 0.04) {
    const t = (a + 0.7) / 3.65, r = 3.6 + Math.sin(Math.min(1, t * 1.15) * Math.PI) * 2.8;
    const x = Math.round(183 + 16 * Math.cos(a)), y = Math.round(44 + 6 * Math.sin(a));
    arc.push([x, y, t]); tail.circle(x, y, Math.round(r));
  }
  fur(cv, tail, Fx, { top: [4, 3] });
  const tip = tail.and(cv.mask().rect(0, 0, 175, H));
  cv.fill(tip.erode(1), Cm[2]).fill(tip.erode(1).and(cv.mask().rect(0, 0, W, 46)), Cm[3]).fill(tip.erode(1).and(cv.mask().rect(0, 51, W, 4)), Cm[1]);
  for (const [x, y, t] of arc) if (t > 0.3 && t < 0.75 && Math.round(t * 60) % 6 === 0) cv.set(x, y - 2, Fx[3]).set(x - 1, y - 2, Fx[3]);
  for (const [t, a, b, k] of [[[144, 23], [140, 38], [153, 34], [[144, 28], [142, 36], [149, 34]]], [[162, 23], [154, 34], [166, 38], [[162, 28], [157, 34], [164, 36]]]]) {
    const ear = cv.mask().poly([[t[0] + 0.5, t[1]], [a[0], a[1]], [b[0], b[1]]]);
    fur(cv, ear, Fx, { shadow: false });
    cv.fill(cv.mask().poly(k.map(([x, y]) => [x + 0.5, y])), Fx[0]);
  }
  const head = cv.mask().oval(138, 32, 30, 22);
  fur(cv, head, Fx);
  const cheeks = cv.mask().oval(139, 42, 13, 12).or(cv.mask().oval(154, 42, 13, 12)).and(head.erode(1));
  cv.fill(cheeks, Cm[2]).fill(cheeks.and(cv.mask().rect(0, 51, W, 3)), Cm[1]);
  for (const x of [144, 157]) cv.px([[x, 42], [x + 1, 43], [x + 2, 43], [x + 3, 42]], INK);
  cv.rect(151, 46, 3, 2, INK).set(151, 46, Pd[3]);
  blush(cv, [142, 159], 46);
}

function bear(cv, front) {
  if (!front) { // body and dangling leg behind the crate
    fur(cv, cv.mask().oval(14, 120, 40, 46), Br, { shadow: false });
    fur(cv, cv.mask().oval(18, 160, 16, 14), Br, { shadow: false });
    fur(cv, cv.mask().oval(21, 165, 10, 8), Cm, { shadow: false, ink: false });
    for (const x of [21, 25, 29]) cv.set(x, 163, PK);
    return;
  }
  for (const [x, y] of [[16, 98], [42, 97]]) {
    fur(cv, cv.mask().circle(x, y, 6), Br, { shadow: false });
    cv.fill(cv.mask().circle(x, y, 3), Br[1]).fill(cv.mask().circle(x, y + 1, 2), PK);
  }
  const head = cv.mask().oval(11, 96, 38, 32);
  fur(cv, head, Br);
  const muz = cv.mask().oval(21, 112, 18, 12);
  fur(cv, muz, Cm, { shadow: false });
  cv.rect(28, 113, 4, 2, INK).set(28, 113, Br[4]);
  sprite(cv, 27, 116, ['k.k.k', '.k.k.'], { k: INK });
  eyes(cv, [20, 37], 107);
  blush(cv, [15, 41], 115);
  // Arms wrapping onto the crate face, little toe beans.
  for (const [y, x0] of [[136, 38], [156, 34]]) {
    const arm = cv.mask().capsule(x0, y + 2, 46, y, 5).or(cv.mask().oval(43, y - 6, 10, 12));
    fur(cv, arm, Br);
    for (const dy of [-3, 0, 3]) cv.set(51, y + dy, Br[1]);
  }
}

function hamster(cv) {
  // Nest-box cubby bolted to the right side, hamster peeking out of the round door.
  const roof = cv.mask().poly([[208, 98], [228.5, 86], [249, 98], [249, 101], [208, 101]]);
  const box = cv.mask().rect(211, 98, 35, 40);
  part(cv, box, Wd, { top: [5], left: [4], bottom: [0], right: [1], fill: 3 });
  for (const y of [111, 124]) cv.rect(212, y, 33, 1, Wd[1]).rect(212, y + 1, 33, 1, Wd[4]);
  part(cv, roof, Mn, { top: [5], left: [4], bottom: [0], right: [1], fill: 3 });
  const door = cv.mask().circle(228, 118, 11);
  cv.fill(door.dilate(1), Wd[1]).fill(door, Pd[0]).fill(door.and(cv.mask().rect(0, 126, W, 5)), Pd[1]);
  const face = cv.mask().oval(214, 106, 29, 22).and(door).or(cv.mask().oval(216, 108, 25, 20).and(door.dilate(1)));
  for (const x of [219, 237]) {
    fur(cv, cv.mask().circle(x, 109, 3).and(door), Hm, { shadow: false });
    cv.set(x, 109, PK);
  }
  fur(cv, face, Hm, { shadow: false });
  cv.fill(cv.mask().oval(222, 116, 13, 8).and(face.erode(1)), Cm[3]);
  eyes(cv, [222, 233], 113, 2);
  cv.rect(227, 118, 3, 1, INK).set(228, 119, PK);
  blush(cv, [218, 236], 118);
  // Seed held in the paws (sits on the sill, clear of the door edge).
  part(cv, cv.mask().oval(225, 125, 7, 5), Cm, { top: [4], left: [3], bottom: [0], right: [1], fill: 2 });
  cv.rect(227, 126, 1, 2, Pd[2]);
  for (const x of [222, 231]) fur(cv, cv.mask().oval(x, 124, 5, 4), Hm, { shadow: false });
  cv.set(228, 92, WH);
  fur(cv, cv.mask().rect(226, 129, 5, 3), Wd, { shadow: false, top: [5], left: [4], bottom: [1], right: [2], fill: 3 }); // perch
}

function frog(cv, x, y) {
  // Sits on the dial (x, y = dial center).
  const bodyM = cv.mask().oval(x - 9, y - 13, 19, 12);
  for (const s of [-1, 1]) fur(cv, cv.mask().circle(x + s * 5, y - 14, 3), Fr, { shadow: false });
  fur(cv, bodyM, Fr);
  fur(cv, cv.mask().oval(x - 5, y - 7, 11, 5).and(bodyM), Cm, { shadow: false, ink: false });
  for (const s of [-1, 1]) cv.rect(x + s * 5 - (s < 0 ? 1 : 0), y - 15, 2, 2, INK).set(x + s * 5 - (s < 0 ? 1 : 0), y - 15, WH);
  cv.px([[x - 2, y - 10], [x - 1, y - 9], [x, y - 9], [x + 1, y - 9], [x + 2, y - 10]], INK);
  blush(cv, [x - 8, x + 6], y - 10);
  for (const s of [-1, 1]) fur(cv, cv.mask().oval(x + s * 7 - 3, y - 4, 7, 4), Fr, { shadow: false });
}

function penguin(cv, x, y) { // x, y = feet center
  const body = cv.mask().oval(x - 12, y - 34, 25, 33);
  fur(cv, body, Pg, { dy: 1 });
  const belly = cv.mask().oval(x - 8, y - 24, 17, 22).or(cv.mask().oval(x - 9, y - 29, 8, 8)).or(cv.mask().oval(x + 2, y - 29, 8, 8));
  cv.shade(belly.and(body.erode(1)), Cm, { top: [4], left: [3], bottom: [1], right: [1], fill: 2 });
  fur(cv, cv.mask().capsule(x - 13, y - 18, x - 17, y - 26, 2), Pg, { shadow: false }); // flipper up
  fur(cv, cv.mask().capsule(x + 13, y - 18, x + 15, y - 11, 2), Pg, { shadow: false });
  eyes(cv, [x - 6, x + 4], y - 27);
  part(cv, cv.mask().poly([[x - 3, y - 22], [x + 4, y - 22], [x + 0.5, y - 18]]), Or, { top: [3], left: [3], bottom: [0], right: [1], fill: 2, shadow: false });
  blush(cv, [x - 10, x + 7], y - 21);
  for (const s of [-1, 1]) part(cv, cv.mask().oval(x + s * 5 - 4, y - 2, 8, 4), Or, { top: [3], left: [2], bottom: [0], right: [1], fill: 2 });
}

function duckling(cv, x, y) { // x, y = feet center
  const body = cv.mask().oval(x - 12, y - 16, 26, 16);
  const head = cv.mask().oval(x - 9, y - 30, 19, 18);
  fur(cv, body, Dk, { dy: 1 });
  fur(cv, head, Dk);
  sprite(cv, x - 1, y - 33, ['.k.', 'kyk', '.k.'], { k: INK, y: Dk[3] }); // tuft
  fur(cv, cv.mask().oval(x + 3, y - 12, 8, 6), Dk, { shadow: false }); // wing
  eyes(cv, [x - 5, x + 3], y - 24, 2);
  part(cv, cv.mask().oval(x - 3, y - 20, 8, 4), Or, { top: [3], left: [2], bottom: [0], right: [1], fill: 2, shadow: false });
  blush(cv, [x - 8, x + 6], y - 20);
  for (const s of [-1, 1]) part(cv, cv.mask().rect(x + s * 4 - 2, y - 1, 5, 2), Or, { top: [3], left: [2], bottom: [0], right: [1], fill: 2, shadow: false });
}

export default {
  id: 'px-animals', name: 'Critter Crate', theme: 'animals', rarity: 'rare', translucent: false,
  collection: 'wild-pixels', license: 'CC-BY-4.0',
  desc: 'A cozy crate TV where a giraffe, a panda, a sleepy fox and five more furry friends peek in to watch you play.',
  tags: ['animals', 'cute', 'wood', 'kawaii', 'animated', 'pixel'],
  css: '.tw{animation:tw 2.4s steps(1) infinite}.tw2{animation:tw 2.4s steps(1) -1.2s infinite}' +
    '@keyframes tw{0%,55%{opacity:1}56%,100%{opacity:0}}' +
    '.eye{animation:bl 3.6s steps(1) infinite}@keyframes bl{0%,92%{opacity:1}93%,100%{opacity:0}}',
  draw() {
    const cv = new Canvas(W, H);
    cv.use(Wd, Mn, Gf, Gs, Fx, Cm, Br, Pd, Pg, Dk, Fr, Hm, Gr, Bs, Or);

    // Grassy mound the whole diorama sits on.
    const mound = cv.mask().oval(4, 212, 248, 42);
    cv.shade(mound, Gr, { top: [4, 3], left: [3], bottom: [0], right: [1], fill: [2, 2, 1] });
    const shadow = cv.mask().oval(36, 206, 184, 16).and(mound);
    cv.tone(shadow, -1, 0.5).tone(shadow.erode(2), -1, 0.5).tone(cv.mask().oval(50, 208, 156, 10).and(mound), -1);
    const topY = (x) => { for (let y = 200; y < H; y++) if (mound.has(x, y)) return y; return -1; };
    for (let x = 10; x < 246; x += 3) { // grass blades along the rim
      const y = topY(x), tall = (x * 7) % 5 < 2;
      if (y > 0) cv.px(tall ? [[x, y - 1], [x, y - 2], [x + 1, y - 3]] : [[x, y - 1]], (x * 3) % 2 ? Gr[3] : Gr[2]);
    }
    for (const [x, y, c] of [[66, 240, WH], [104, 247, PK], [150, 244, WH], [190, 233, PK], [56, 226, Dk[3]], [124, 236, Dk[3]], [206, 246, WH]]) {
      cv.px([[x, y + 2], [x, y + 3]], Gr[0]);
      sprite(cv, x - 2, y - 2, ['.p.p.', 'ppcpp', '.ppp.', '..s..'], { p: c, c: c === Dk[3] ? Or[2] : Dk[2], s: Gr[1] });
      cv.outline(Gr[0], spriteMask(cv, x - 2, y - 2, ['.p.p.', 'ppppp', '.ppp.']), {});
    }
    for (const [x, y] of [[84, 230], [170, 248], [38, 242], [222, 226]]) sprite(cv, x, y, ['.l.l.', 'lLlLl', '.lll.', '..s..'], { l: Gr[3], L: Gr[4], s: Gr[1] });

    // Behind the crate: giraffe neck, panda head, bear body.
    giraffe(cv);
    panda(cv);
    bear(cv, false);

    // Crate TV: plank frame, nailed corner battens, feet.
    for (const x of [58, 182]) part(cv, cv.mask().rect(x, 204, 16, 10), Wd, { top: [3], left: [2], bottom: [0], right: [1], fill: 1, dy: 2 });
    const crate = cv.mask().rrect(44, 54, 168, 152, 4);
    part(cv, crate, Wd, { top: [5, 4], left: [4], bottom: [0, 1], right: [1], fill: 3, dy: 2 });
    // Wood grain: broken streaks along each plank (rails run across, stiles run down), a couple of knots.
    const face = crate.erode(2), rnd = rng(11);
    const grain = (x0, y0, w, h, across) => {
      const L = across ? w : h, N = across ? h : w;
      for (let k = 2; k < N - 1; k += 3) {
        let t = Math.floor(rnd() * 6);
        while (t < L) {
          const len = 4 + Math.floor(rnd() * 12), wob = Math.round(rnd() - 0.3);
          for (let i = 0; i < len && t + i < L; i++) {
            const x = across ? x0 + t + i : x0 + k + (i > len / 2 ? wob : 0), y = across ? y0 + k + (i > len / 2 ? wob : 0) : y0 + t + i;
            if (face.has(x, y) && cv.get(x, y) === Wd[3]) cv.set(x, y, Wd[2]);
          }
          t += len + 3 + Math.floor(rnd() * 8);
        }
      }
    };
    grain(46, 56, 164, 8, true); grain(46, 184, 164, 20, true); grain(46, 64, 8, 120, false); grain(202, 64, 8, 120, false);
    cv.rect(46, 194, 164, 1, Wd[1]).rect(46, 195, 164, 1, Wd[4]); // seam between the two chin planks
    for (const [x, y] of [[96, 58], [158, 199]]) sprite(cv, x, y, ['.dd.', 'dLld', '.dd.'], { d: Wd[1], L: Wd[2], l: Wd[2] });
    for (const [x, y] of [[47, 57], [204, 57], [47, 198], [204, 198]]) {
      part(cv, cv.mask().rect(x, y, 6, 6), Wd, { top: [4], left: [3], bottom: [0], right: [0], fill: 2, shadow: false });
      cv.set(x + 2, y + 2, Bs[4]).set(x + 3, y + 3, Bs[0]).set(x + 3, y + 2, Bs[2]).set(x + 2, y + 3, Bs[2]);
    }

    // Mint bezel recessed into the crate, then the screen rim.
    const bez = cv.mask().rrect(54, 64, 148, 120, 5);
    cv.outline(Wd[0], bez, { all: true });
    cv.shade(bez, Mn, { top: [1], left: [1], bottom: [5], right: [4], fill: 3 });
    cv.shade(cv.mask().rrect(57, 67, 142, 114, 4), Mn, { top: [5], left: [4], bottom: [1], right: [2], fill: 3 });
    inset(cv, ...HOLE, HR, { rim: INK, top: Pd[0], bottom: Mn[1], right: Mn[1], left: Pd[1] }, 2);

    // Chin: speaker slots, brass name plate, two dials (the frog sits on the big one).
    slots(cv, 58, 188, 34, 4, 3, Wd[0], Wd[4]);
    const plate = cv.mask().rrect(104, 188, 46, 11, 2);
    part(cv, plate, Bs, { top: [4], left: [3], bottom: [0], right: [1], fill: 2 });
    cv.text('KAYBORO', 127 - (cv.textWidth('KAYBORO') >> 1), 191, Bs[0]);
    part(cv, cv.mask().circle(198, 195, 4), Mn, { top: [5], left: [4], bottom: [0], right: [1], fill: 3, dy: 1 });
    cv.set(198, 192, INK).set(198, 193, INK);
    const dial = cv.mask().circle(174, 196, 7);
    part(cv, dial, Bs, { top: [4], left: [3], bottom: [0], right: [1], fill: 2, dy: 1 });
    for (let a = 0; a < 6.28; a += 0.524) cv.set(Math.round(174 + 6 * Math.cos(a)), Math.round(196 + 6 * Math.sin(a)), Bs[1]);

    // Front critters.
    pandaPaws(cv);
    bear(cv, true);
    fox(cv);
    hamster(cv);
    frog(cv, 174, 196);
    penguin(cv, 30, 236);
    duckling(cv, 228, 238);

    // Animated bits: blinking eyes are drawn open on a layer over closed eyes; sleepy Zs; sparkles.
    const tw = cv.layer('tw'), tw2 = cv.layer('tw2');
    tw.text('Z', 178, 28, Fx[1]);
    tw2.text('Z', 186, 20, Fx[1]).text('Z', 187, 20, Fx[1]);
    tw.px([[92, 28], [93, 29], [93, 30], [93, 31], [92, 32], [95, 26], [96, 27], [96, 28], [96, 29], [96, 30], [96, 31], [95, 32]], INK);
    sparkle(tw, 140, 14, 1, Bs[4], WH);
    sparkle(tw2, 24, 76, 1, Bs[4], WH);
    sparkle(tw, 238, 72, 2, Bs[4], WH);
    sparkle(tw2, 14, 204, 1, Bs[4], WH);

    cv.outline(INK);
    return cv.punch(...HOLE, HR);
  },
};
