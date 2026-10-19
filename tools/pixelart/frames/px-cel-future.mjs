// Hardlight Slate: an ultra-thin floating display held between two hovering emitter pylons by beams of
// hard light, an anti-gravity ring glowing beneath it and a dithered light cone pooling on a hexagonal
// floor plate. Blue Cel set: dithered cobalt-to-cyan gradients, one hard core-shadow band per volume,
// bold ink outlines, ice specular slivers; the only warm accent is a soft amber status-light family.
import { Canvas, bayer } from '../pixel.mjs';
import { INK, inset, led, sparkle } from '../kit.mjs';

const W = 320, H = 176, HOLE = [76, 24, 168, 72], HR = 4; // 21:9
const CX = 160;
// navy -> cobalt -> azure -> cyan -> ice (shared with px-cel-crt)
const B = ['#0a1140', '#111d68', '#18308f', '#2149bb', '#2d6ade', '#4790f2', '#6cb8fd', '#a3dfff', '#e0f6ff'];
const K = ['#04263a', '#0a4560', '#1fb2dc', '#7eefff', '#e6feff']; // hard-light cyan
const Y = ['#7a4a10', '#c7861d', '#ffc23d', '#ffe38a', '#fff7d6']; // the one warm accent: amber status lights
const WHITE = '#ffffff';

/** Cel-shade a volume: dithered gradient, one hard flat core-shadow band lower-right, lit top-left edge, ink. */
function cel(cv, m, grad, { shadow, k = 3, hi, rim, drop = true, ink = true, soft = 0.6, dir = 'v' } = {}) {
  if (drop) cv.cast(m.dilate(1), 1, 1, -1);
  if (grad.length > 1) cv.grad(m, grad, { soft, dir }); else cv.fill(m, grad[0]);
  const core = m.sub(m.shift(-k, -k));
  if (shadow) cv.fill(core, shadow);
  if (rim) cv.fill(m.sub(m.shift(-1, 0)).and(core).sub(m.sub(m.shift(0, -1))), rim);
  if (hi) cv.fill(m.sub(m.shift(1, 1)).sub(core), hi);
  if (ink) cv.outline(INK, m, { all: true });
  return core;
}

/** Pixel arc (degrees, 0 = right, 90 = down) for specular slivers. */
function arc(cv, cx, cy, rx, ry, a0, a1, c, clip) {
  for (let a = a0; a <= a1; a += 0.5) {
    const t = (a * Math.PI) / 180, x = Math.round(cx + rx * Math.cos(t)), y = Math.round(cy + ry * Math.sin(t));
    if (!clip || clip.has(x, y)) cv.set(x, y, c);
  }
}

/** Flat-top honeycomb: id of the hex cell containing pixel (x, y); s = cell radius, sy squashes rows. */
function hexId(x, y, s, ox = 0, oy = 0, sy = 1) {
  const px = x + 0.5 - ox, py = (y + 0.5 - oy) * sy;
  const q = ((2 / 3) * px) / s, r = ((-1 / 3) * px + (Math.sqrt(3) / 3) * py) / s, c = -q - r;
  let rq = Math.round(q), rr = Math.round(r); const rc = Math.round(c);
  const dq = Math.abs(rq - q), dr = Math.abs(rr - r), dc = Math.abs(rc - c);
  if (dq > dr && dq > dc) rq = -rr - rc; else if (dr > dc) rr = -rq - rc;
  return [rq, rr];
}
/** Mesh lines of a honeycomb over a mask (pixels whose right/lower neighbour is in another cell). */
function hexMesh(cv, m, s, ox, oy, sy = 1) {
  const out = cv.mask(), k = (x, y) => hexId(x, y, s, ox, oy, sy).join();
  m.each((x, y) => { const a = k(x, y); if (a !== k(x + 1, y) || a !== k(x, y + 1)) out.put(x, y); });
  return out;
}

export default {
  id: 'px-cel-future', name: 'Hardlight Slate', theme: 'future-tech', rarity: 'epic', translucent: false,
  collection: 'blue-cel', license: 'CC-BY-4.0',
  desc: 'A paper-thin screen floats between two humming pylons on beams of hard light while tiny drones keep it polished.',
  tags: ['future-tech', 'hologram', 'cel-shaded', 'blue', 'widescreen', 'animated'],
  css: '.pulse{animation:pu 1.8s steps(1) infinite}@keyframes pu{0%,49%{opacity:1}50%,100%{opacity:0}}' +
    '.blink{animation:bl 2.6s steps(1) infinite}@keyframes bl{0%,84%{opacity:1}85%,100%{opacity:0}}' +
    '.amber{animation:am 3.2s steps(1) infinite}@keyframes am{0%,59%{opacity:1}60%,100%{opacity:0}}',
  draw() {
    const cv = new Canvas(W, H);
    cv.use(B, K, Y);
    const pulse = cv.layer('pulse'), blink = cv.layer('blink'), amber = cv.layer('amber');

    // ---- floor plate: a wide flat hexagon seen from slightly above -------------------------------
    const top = cv.mask().poly([[30, 146], [290, 146], [312, 156], [290, 166], [30, 166], [8, 156]]);
    const side = cv.mask().poly([[8, 156], [30, 166], [290, 166], [312, 156], [312, 161], [290, 171], [30, 171], [8, 161]]).sub(top);
    cv.grad(top, [B[2], B[3], B[4]], { soft: 0.8 });
    cv.fill(side, (x, y) => (y >= 169 || x > 296 ? B[1] : B[2]));
    cv.fill(top.sub(top.shift(0, -1)).and(cv.mask().rect(0, 160, W, 8)), B[7]); // lit front lip
    // faint hex tiling on the deck, squashed into perspective
    cv.fill(hexMesh(cv, top.erode(1), 8, CX, 156, 2), (x, y, c) => cv.step(c, -1));
    // inner luminous seam following the hexagon
    const seam = cv.mask().poly([[40, 149], [280, 149], [296, 156], [280, 163], [40, 163], [24, 156]]);
    cv.fill(seam.edge(true).and(top.erode(1)), (x, y) => (y < 156 ? K[1] : K[2]));
    // vent dashes on the front edge
    for (let x = 40; x < 282; x += 12) cv.rect(x, 167, 6, 1, x > 140 && x < 180 ? K[3] : K[1]);
    cv.outline(INK, top.or(side), { all: true });
    // light pool from the cone
    const pool = cv.mask().oval(CX - 56, 150, 112, 12);
    cv.fill(pool.and(top), (x, y, c) => {
      const d = ((x + 0.5 - CX) / 56) ** 2 + ((y + 0.5 - 156) / 6) ** 2;
      return d < 0.22 ? K[4] : d < 0.5 ? K[3] : bayer(x, y) < 1 - d ? K[2] : c;
    });
    // hovering-object shadows on the plate
    for (const sx of [32, 290]) {
      cv.fill(cv.mask().oval(sx - 12, 153, 24, 5).and(top), (x, y, c) => {
        const d = ((x + 0.5 - sx) / 12) ** 2 + ((y + 0.5 - 155.5) / 2.5) ** 2;
        return cv.step(c, d < 0.35 ? -2 : bayer(x, y) < 1.2 - d ? -1 : 0);
      });
    }

    // ---- light cone from the anti-grav ring down to the plate (opaque dither, soft vertical rays) ----
    const cone = cv.mask().poly([[126, 133], [194, 133], [214, 147], [106, 147]]).sub(top);
    cv.fill(cone, (x, y) => {
      const t = (y - 133) / 14, e = Math.abs(x + 0.5 - CX) / (34 + t * 20);
      const ray = (Math.abs(x - CX) + 1) % 7 < 2 ? 1 : 0;
      const dens = (0.55 - t * 0.38 + ray * 0.25) * (1 - e * e * 0.7);
      if (bayer(x, y) >= dens) return undefined;
      return e > 0.82 ? K[2] : ray && t < 0.5 ? K[4] : K[3];
    });

    // ---- anti-gravity ring under the slate: lit top face, thin glowing side band, light in the throat ----
    const ringT = cv.mask().oval(CX - 46, 119, 92, 12), throat = cv.mask().oval(CX - 35, 122, 70, 6);
    const band = ringT.sub(throat), rside = ringT.shift(0, 3).sub(ringT);
    cv.fill(throat, (x, y) => (y < 124 ? K[1] : K[3]));
    cv.fill(cv.mask().oval(CX - 22, 124, 44, 4), K[4]);
    cv.grad(band, [B[8], B[7], B[6], B[5]], { soft: 0.6 });
    cv.fill(band.and(throat.shift(0, -1)).sub(throat), B[4]); // far inner wall in shadow
    cv.fill(rside, (x, y) => (y === 131 ? K[3] : B[2]));
    cv.fill(rside.sub(rside.shift(0, -1)), B[1]);
    arc(cv, CX, 125, 44, 5, 200, 236, WHITE, band);
    cv.outline(INK, ringT.or(rside), { all: true });
    cv.outline(INK, throat, { all: true });
    pulse.fill(cv.mask().oval(CX - 30, 124, 60, 4), (x, y) => (bayer(x, y) < 0.5 ? K[4] : WHITE));
    pulse.fill(rside.and(cv.mask().rect(0, 131, W, 1)), K[4]);

    // ---- emitter pylons -------------------------------------------------------------------------
    for (const [px, s] of [[30, 1], [290, -1]]) {
      // thruster ring + glow under the hovering tip
      const tr = cv.mask().oval(px - 8, 129, 17, 5).sub(cv.mask().oval(px - 5, 130, 11, 3));
      cv.fill(cv.mask().oval(px - 5, 130, 11, 3), K[2]);
      cv.fill(tr, (x, y) => (y < 131 ? B[3] : B[5]));
      cv.outline(INK, tr.or(cv.mask().oval(px - 5, 130, 11, 3)), { all: true });
      cv.fill(cv.mask().poly([[px - 4, 134], [px + 5, 134], [px + 7, 150], [px - 6, 150]]), (x, y) =>
        (bayer(x, y) < 0.5 - (y - 134) / 34 ? K[3] : undefined));

      const pyl = cv.mask().poly([[px + 0.5, 14], [px + 13, 26], [px + 13, 102], [px + 0.5, 126], [px - 12, 102], [px - 12, 26]]);
      cel(cv, pyl, [B[7], B[6], B[5], B[4], B[3]], { shadow: B[2], k: 4, hi: B[8], soft: 0.5 });
      // crystal facet: right half one step darker (left half catches the light)
      cv.fill(pyl.erode(1).and(cv.mask().rect(px + 1, 0, 12, H)), (x, y, c) => (c === B[2] || c === B[8] ? c : cv.step(c, -1)));
      cv.fill(cv.mask().line(px, 16, px, 124).and(pyl.erode(1)), B[8]);
      // specular sliver down the lit edge
      cv.fill(cv.mask().line(px - 9, 30, px - 9, 60).and(pyl.erode(2)), WHITE);
      cv.fill(cv.mask().line(px - 9, 64, px - 9, 68).and(pyl.erode(2)), WHITE);
      // amber status gem near the tip
      cv.fill(cv.mask().pts([[px, 21], [px - 1, 22], [px, 22], [px + 1, 22], [px, 23]]).dilate(1), INK);
      cv.px([[px, 21], [px - 1, 22], [px + 1, 22], [px, 23]], Y[1]).set(px, 22, Y[2]);
      amber.px([[px, 21], [px - 1, 22], [px + 1, 22], [px, 23]], Y[2]).set(px, 22, Y[4]);
      // hexagonal energy panels above and below the emitter: faceted hard-light cells
      for (const hy of [31, 81]) {
        const hx = px - 7, hexo = cv.mask().poly([[hx + 4, hy], [hx + 11, hy], [hx + 15, hy + 7], [hx + 11, hy + 14], [hx + 4, hy + 14], [hx, hy + 7]]);
        const hexi = cv.mask().poly([[hx + 5, hy + 3], [hx + 10, hy + 3], [hx + 12, hy + 7], [hx + 10, hy + 11], [hx + 5, hy + 11], [hx + 3, hy + 7]]);
        cv.fill(hexo, (x, y) => (x + y < hx + hy + 15 ? K[3] : K[1]));
        cv.fill(hexo.sub(hexo.shift(-1, -1)), K[0]);
        cv.grad(hexi, [K[4], K[3], K[2]], { soft: 0.7 });
        cv.fill(hexi.sub(hexi.shift(-1, -1)), K[1]);
        cv.set(hx + 6, hy + 4, WHITE).set(hx + 7, hy + 4, WHITE).set(hx + 5, hy + 5, WHITE);
        cv.outline(INK, hexo, { all: true });
        pulse.fill(hexi.erode(1), (x, y) => (y < hy + 7 ? WHITE : K[4]));
      }
      // seam bands around the pylon
      for (const by of [48, 79]) cv.fill(cv.mask().rect(0, by, W, 1).and(pyl.erode(1)), K[2]);
      // emitter lens on the slate-facing side
      const ex = px + 13 * s, ey = 62;
      const hous = cv.mask().circle(ex, ey, 5);
      cel(cv, hous, [B[7], B[5], B[4]], { shadow: B[2], k: 2, hi: B[8] });
      const lens = cv.mask().circle(ex, ey, 2);
      cv.fill(lens, K[3]).set(ex, ey, K[4]).set(ex - 1, ey - 1, WHITE);
      cv.outline(INK, lens, { all: true });
      pulse.fill(cv.mask().circle(ex, ey, 2), K[4]).set(ex - 1, ey - 1, WHITE);
    }

    // ---- hard-light beams from the emitters to the slate clamps --------------------------------
    for (const [x0, x1] of [[49, 55], [267, 272]]) {
      const halo = cv.mask().rect(x0, 58, x1 - x0, 9);
      cv.fill(halo, (x, y) => (Math.abs(y - 62) > 2 && bayer(x, y) < (Math.abs(y - 62) === 3 ? 0.5 : 0.25) ? K[2] : undefined));
      cv.rect(x0, 61, x1 - x0, 3, K[3]).rect(x0, 62, x1 - x0, 1, K[4]);
      pulse.rect(x0, 60, x1 - x0, 1, K[2]).rect(x0, 64, x1 - x0, 1, K[2]).rect(x0, 62, x1 - x0, 1, WHITE);
    }

    // ---- the slate ------------------------------------------------------------------------------
    const slate = cv.mask().rrect(62, 10, 196, 106, [12, 5, 12, 5]);
    // ultra-thin depth edge
    const back = slate.shift(2, 3).sub(slate);
    cv.fill(back, (x, y) => (y > 114 || x > 258 ? B[1] : B[2]));
    cv.fill(back.and(cv.mask().rect(CX - 40, 112, 80, 8)), K[1]); // uplight from the ring
    cv.outline(INK, back, { all: true });
    // side clamps that catch the beams (tucked behind the face)
    for (const [cx0, r] of [[55, [4, 0, 0, 4]], [256, [0, 4, 4, 0]]]) {
      const cl = cv.mask().rrect(cx0, 53, 11, 19, r);
      cel(cv, cl, [B[6], B[5], B[4]], { shadow: B[2], k: 2, hi: B[8], drop: false });
      cv.rect(cx0 < CX ? 55 : 266, 61, 1, 3, K[3]);
    }
    cel(cv, slate, [B[7], B[6], B[5], B[4], B[3]], { shadow: B[2], k: 4, hi: B[8], rim: B[4], soft: 0.5, drop: false });
    // anime gloss: hard crescent on the top-left corner + streaks along the top
    const gl = cv.mask().circle(76, 24, 12).sub(cv.mask().circle(78, 26, 12)).and(slate.erode(2)).clip(0, 0, 80, 40);
    cv.fill(gl, B[8]);
    cv.fill(gl.and(cv.mask().rect(60, 10, 12, 14)), WHITE);
    cv.rect(84, 12, 34, 1, WHITE).rect(122, 12, 5, 1, WHITE).rect(130, 12, 1, 1, WHITE);
    cv.rect(64, 34, 1, 26, B[8]).rect(64, 64, 1, 3, B[8]);

    // front sensor bar on the top bezel
    const sens = cv.mask().rrect(CX - 9, 13, 18, 3, 1);
    cv.fill(sens, INK).set(CX - 5, 14, K[2]).set(CX + 4, 14, B[3]);
    cv.fill(sens.sub(sens.shift(0, -1)).shift(0, 1).sub(sens), B[8]);
    // dark glass recess with an edge-lit hard-light seam, then the recessed screen rim
    const glass = cv.mask().rrect(HOLE[0] - 6, HOLE[1] - 6, HOLE[2] + 12, HOLE[3] + 12, HR + 5);
    const seamG = glass.dilate(2, true).sub(glass.dilate(1, true));
    cv.fill(seamG, (x, y) => (y < HOLE[1] || x < HOLE[0] ? K[3] : K[2]));
    cv.fill(glass, B[1]);
    cv.fill(glass.sub(glass.shift(2, 2)), B[0]);
    cv.fill(glass.sub(glass.shift(-1, -1)), B[3]);
    cv.outline(INK, glass, { all: true });
    inset(cv, ...HOLE, HR, { rim: INK, top: B[0], left: B[0], bottom: B[2], right: B[2] }, 2);
    // glass glints, well clear of the opening edge
    cv.rect(84, 19, 10, 1, B[4]).rect(97, 19, 3, 1, B[4]);
    cv.rect(71, 30, 1, 8, B[3]);

    // chin: amber status light, touch strip, embossed brand
    const lm = cv.mask().oval(80, 104, 4, 4, 1.1);
    cv.fill(lm.dilate(1), INK).fill(lm, Y[0]).set(81, 105, Y[1]);
    led(amber, 80, 104, [Y[1], Y[2], Y[3], WHITE], { d: 4 });
    const strip = cv.mask().rrect(122, 104, 76, 5, 2);
    cv.fill(strip, K[0]);
    cv.fill(strip.sub(strip.shift(0, 1)), INK);
    cv.fill(strip.sub(strip.shift(0, -1)), B[5]);
    cv.outline(INK, strip, { all: true });
    for (let x = 126; x < 195; x += 6) cv.rect(x, 106, 3, 1, x < 150 ? K[2] : K[1]);
    cv.rect(150, 105, 5, 3, K[3]).rect(151, 106, 3, 1, K[4]);
    const bx = 214;
    cv.text('KAYBORO', bx, 105, B[1]).text('KAYBORO', bx, 104, B[6]);

    // ---- maintenance drones -------------------------------------------------------------------
    const drone = (x, y, look) => {
      // rotor halo
      const rot = cv.mask().oval(x - 7, y - 10, 15, 3, 1.2);
      cv.fill(rot, (px) => (Math.abs(px - x) < 3 ? K[4] : Math.abs(px - x) < 5 ? K[3] : K[2]));
      cv.outline(INK, rot, { all: true });
      cv.rect(x, y - 7, 1, 3, INK);
      // round pod
      const body = cv.mask().oval(x - 5, y - 4, 11, 10);
      cel(cv, body, [WHITE, B[8], B[7], B[6]], { shadow: B[4], k: 2, hi: WHITE, soft: 0.8 });
      // visor face with two little eyes looking toward the slate
      cv.fill(cv.mask().rrect(x - 3 + look, y - 1, 7, 4, 1), INK);
      for (const ex of [x - 2 + look, x + 2 + look]) {
        cv.rect(ex, y, 1, 2, K[2]).set(ex, y, K[3]);
        blink.rect(ex, y, 1, 2, K[3]).set(ex, y, K[4]);
      }
      // thruster glow
      cv.rect(x - 1, y + 6, 3, 1, INK).set(x, y + 7, K[3]).set(x, y + 9, K[2]);
      // little polishing arm reaching for the slate, with a spark at the tip
      const ax = x + look * 6, tx = x + look * 9;
      cv.fill(cv.mask().line(x + look * 5, y + 2, tx, y + 3), B[6]);
      cv.outline(INK, cv.mask().line(x + look * 5, y + 2, tx, y + 3), { all: false });
      cv.set(ax, y + 2, B[8]);
      sparkle(blink, tx + look * 2, y + 3, 1, K[3], WHITE);
    };
    // orbit trails
    for (const [x, y] of [[263, 6], [258, 5], [253, 4], [248, 4]]) cv.set(x, y, B[5]);
    for (const [x, y] of [[57, 118], [61, 121], [66, 123], [71, 124]]) cv.set(x, y, B[5]);
    drone(272, 14, -1);
    drone(50, 112, 1);

    // anime sparkles in the open air
    sparkle(cv, 307, 9, 2, B[7], WHITE);
    sparkle(cv, 14, 8, 1, B[6], B[8]);
    sparkle(cv, 228, 136, 1, K[3], WHITE);

    return cv.punch(...HOLE, HR);
  },
};
