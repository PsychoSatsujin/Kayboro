// Tube Lab Scope: a 1950s laboratory oscilloscope / analog computer console in the Blue Cel style.
// Blue-grey hammertone case under a dithered cobalt-to-cyan gradient with hard cel shadow bands, rack
// carry handles, a round-cornered phosphor tube with a graticule bezel ring, twin needle meters, toggles,
// a patch bay with dangling cables, chicken-head bakelite knobs with engraved labels, and a vented cage of
// vacuum tubes on top whose amber glow is the set's one warm accent (it flickers; the needles sway).
import { Canvas, bayer, rng } from '../pixel.mjs';
import { INK, inset, sparkle, sticker, SHAPES } from '../kit.mjs';

const W = 264, H = 232, HOLE = [37, 49, 140, 112], HR = 8; // 5:4
// navy -> cobalt -> azure -> cyan -> ice (shared with px-cel-crt / px-cel-pet)
const B = ['#0a1140', '#111d68', '#18308f', '#2149bb', '#2d6ade', '#4790f2', '#6cb8fd', '#a3dfff', '#e0f6ff'];
const K = ['#04263a', '#0a4560', '#1fb2dc', '#7eefff', '#e6feff']; // cyan patch cable
const O = ['#4a1606', '#9a3a0c', '#e0701a', '#ffa93a', '#ffd98a', '#fff6d6']; // the one warm accent: tube glow
const WHITE = '#ffffff';

/** Cel-shade a volume: dithered gradient, a hard flat core-shadow band lower-right, lit top-left edge, ink. */
function cel(cv, m, grad, { shadow, k = 3, hi, rim, drop = true, ink = true, soft = 0.6 } = {}) {
  if (drop) cv.cast(m.dilate(1), 1, 1, -1);
  if (grad.length > 1) cv.grad(m, grad, { soft }); else cv.fill(m, grad[0]);
  const core = m.sub(m.shift(-k, -k));
  if (shadow) cv.fill(core, shadow);
  if (rim) cv.fill(m.sub(m.shift(-1, 0)).and(core).sub(m.sub(m.shift(0, -1))), rim);
  if (hi) cv.fill(m.sub(m.shift(1, 1)).sub(core), hi);
  if (ink) cv.outline(INK, m, { all: true });
  return core;
}

/** Pixel arc (degrees, 0 = right, 90 = down). */
function arc(cv, cx, cy, rx, ry, a0, a1, c, clip) {
  for (let a = a0; a <= a1; a += 0.5) {
    const t = (a * Math.PI) / 180, x = Math.round(cx + rx * Math.cos(t)), y = Math.round(cy + ry * Math.sin(t));
    if (!clip || clip.has(x, y)) cv.set(x, y, c);
  }
}
const pol = (cx, cy, r, a) => [Math.round(cx + r * Math.cos((a * Math.PI) / 180)), Math.round(cy + r * Math.sin((a * Math.PI) / 180))];

/** Engraved 3px label: dark groove with a lit lower lip. */
function engrave(cv, str, cx, y, dark = B[1], lip = B[7]) {
  const x = cx - (cv.textWidth(str) >> 1);
  cv.text(str, x, y + 1, lip).text(str, x, y, dark);
}

/** Cubic bezier cable (3px thick, cel-shaded with its own ramp R = [ink-ish, shadow, base, light, glint]). */
function cable(cv, pts, R) {
  const [p0, p1, p2, p3] = pts;
  let m = cv.mask();
  let prev = null;
  for (let i = 0; i <= 40; i++) {
    const t = i / 40, u = 1 - t;
    const x = u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0];
    const y = u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1];
    const q = [Math.round(x), Math.round(y)];
    if (prev) m = m.or(cv.mask().capsule(prev[0], prev[1], q[0], q[1], 1.1));
    prev = q;
  }
  cv.cast(m.dilate(1), 1, 1, -1);
  cv.fill(m, R[2]);
  cv.fill(m.sub(m.shift(-1, -1)), R[1]);
  cv.fill(m.sub(m.shift(1, 1)).sub(m.sub(m.shift(-1, -1))), R[3]);
  cv.outline(INK, m, { all: true });
  return m;
}

/** Needle meter in a rounded frame; the needle sways between angles a and b on a steps() layer. */
function meter(cv, x, y, w, h, a, b, cls) {
  const fr = cv.mask().rrect(x, y, w, h, 4);
  cel(cv, fr, [B[7], B[6], B[5]], { shadow: B[4], k: 2, hi: B[8] });
  const face = cv.mask().rrect(x + 3, y + 3, w - 6, h - 7, 2);
  cv.grad(face, [WHITE, B[8], B[7]], { soft: 0.8 });
  cv.fill(face.sub(face.shift(1, 1)), B[6]); // the frame's lip shades the top-left of the face
  cv.outline(INK, face, { all: true });
  const px = x + (w >> 1), py = y + h - 6, R = h - 12;
  // Scale: arc, ticks, an amber over-range zone.
  arc(cv, px, py, R, R, -148, -32, B[4], face);
  for (let t = -145; t <= -35; t += 22) {
    const [x0, y0] = pol(px, py, R - 2, t), [x1, y1] = pol(px, py, R, t);
    cv.fill(cv.mask().line(x0, y0, x1, y1).and(face), B[2]);
  }
  arc(cv, px, py, R + 1, R + 1, -52, -32, O[2], face);
  arc(cv, px, py, R, R, -52, -32, O[2], face);
  cv.set(x + 5, y + 5, WHITE).set(x + 6, y + 5, WHITE).set(x + 5, y + 6, WHITE); // glass glint
  // Needle: base pose on the canvas, alternate pose on the layer (which also repaints the base pose away).
  const needle = (ang) => { const [ex, ey] = pol(px, py, R - 1, ang); return cv.mask().line(px, py, ex, ey).and(face); };
  const nA = needle(a), nB = needle(b), lay = cv.layer(cls);
  lay.fill(nA, (i, j) => cv.get(i, j));
  lay.fill(nB, INK);
  cv.fill(nA, INK);
  for (const c of [cv, lay]) {
    c.fill(cv.mask().rrect(px - 3, py - 1, 7, 3, 1).and(face.dilate(1)), B[2]);
    c.set(px - 1, py - 1, B[5]).set(px, py, INK);
  }
}

/** Chicken-head bakelite knob with an engraved dial of dots around it. */
function knob(cv, cx, cy, ang) {
  for (let t = 135; t <= 405; t += 45) {
    const [x, y] = pol(cx, cy, 9, t);
    cv.set(x, y + 1, B[7]).set(x, y, B[1]);
  }
  const skirt = cv.mask().circle(cx, cy, 6);
  cel(cv, skirt, [B[2], B[1], B[1]], { shadow: B[0], k: 2, hi: B[4] });
  const [tx, ty] = pol(cx, cy, 8, ang), [bx, by] = pol(cx, cy, -3, ang);
  const head = cv.mask().capsule(bx, by, tx, ty, 2).or(cv.mask().circle(cx, cy, 3));
  cel(cv, head, [B[6], B[5], B[4]], { shadow: B[3], k: 2, hi: B[8] });
  const [ix, iy] = pol(cx, cy, 6, ang);
  cv.set(ix, iy, WHITE);
  cv.set(cx - 2, cy - 2, WHITE).set(cx - 1, cy - 2, B[7]); // anime glint
}

/** Toggle switch: hex-ish nut with a lever up (lit) or down. */
function toggle(cv, cx, cy, up) {
  const nut = cv.mask().circle(cx, cy, 2);
  cel(cv, nut, [B[7], B[6]], { shadow: B[4], k: 1, hi: B[8], drop: false });
  const dy = up ? -6 : 6;
  const lev = cv.mask().capsule(cx, cy, cx, cy + dy, 0.6).or(cv.mask().rrect(cx - 1, cy + dy - (up ? 1 : 0), 3, 2, 0));
  cv.fill(lev, B[8]).fill(lev.sub(lev.shift(-1, 0)), B[5]);
  cv.outline(INK, lev.sub(nut), { all: false });
  cv.set(cx - 1, cy + dy - (up ? 1 : 0), WHITE);
}

export default {
  id: 'px-cel-analog', name: 'Tube Lab Scope', theme: 'oscilloscope', rarity: 'rare', translucent: false,
  collection: 'blue-cel', license: 'CC-BY-4.0',
  desc: 'A humming 1950s lab scope in glossy cel-shaded blues, with warm glowing tubes, swaying needles and patch cables to tinker with.',
  tags: ['oscilloscope', 'retro-tech', 'cel-shaded', 'blue', 'vacuum-tube', 'animated'],
  css: '.flk{animation:fk 3.1s steps(1) infinite}@keyframes fk{0%,100%{opacity:1}41%{opacity:.35}43%{opacity:1}77%{opacity:.6}79%{opacity:1}}' +
    '.sw1{animation:s1 2.6s steps(1) infinite}@keyframes s1{0%,49%{opacity:0}50%,100%{opacity:1}}' +
    '.sw2{animation:s2 1.9s steps(1) infinite}@keyframes s2{0%,59%{opacity:1}60%,100%{opacity:0}}',
  draw() {
    const cv = new Canvas(W, H), rnd = rng(1957);
    cv.use(B, K, O);

    // Dithered floor shadow (opaque checker pixels, so the shell stays solid).
    cv.fill(cv.mask().oval(22, 211, 220, 16), (x, y) => {
      const d = ((x + 0.5 - 132) / 110) ** 2 + ((y + 0.5 - 219) / 8) ** 2;
      return d < 0.45 || bayer(x, y) < 1.15 - d ? INK : undefined;
    });

    // Rack carry handles on both sides (drawn first; the case covers their brackets).
    const hL = cv.mask().rrect(2, 62, 6, 108, 3).or(cv.mask().rrect(2, 62, 18, 9, [3, 0, 0, 0]))
      .or(cv.mask().rrect(2, 161, 18, 9, [0, 0, 0, 3]));
    for (const hm of [hL, hL.mirror()]) cel(cv, hm, [B[8], B[7], B[6], B[5]], { shadow: B[3], k: 2, hi: WHITE });
    for (const x of [3, 260]) cv.rect(x, 76, 1, 14, WHITE).set(x, 92, WHITE);

    // Stubby feet.
    for (const x of [34, 200]) cel(cv, cv.mask().rrect(x, 204, 30, 13, [0, 0, 5, 5]), [B[5], B[4], B[3]], { shadow: B[2], k: 2, hi: B[7] });

    // The instrument case: dithered cobalt-to-cyan enamel, hard core shadow, then hammertone dimples.
    const body = cv.mask().rrect(16, 28, 232, 182, 14);
    cel(cv, body, [B[7], B[6], B[5], B[4], B[3]], { shadow: B[2], k: 6, hi: B[8], rim: B[4], soft: 0.5 });
    body.erode(3).each((x, y) => {
      if (rnd() < 0.045 && (y < 175 || y > 185)) { cv.set(x, y, cv.step(cv.get(x, y), -1)); cv.set(x - 1, y - 1, cv.step(cv.get(x - 1, y - 1), 1)); }
    });
    // Gloss: a sharp sliver hugging the top-left corner, streaks along the top and left edges.
    const gl = cv.mask().circle(32, 44, 14).sub(cv.mask().circle(34, 46, 14)).and(body.erode(1)).clip(0, 0, 30, 40);
    cv.fill(gl, B[8]).fill(gl.clip(0, 0, 24, 34), WHITE);
    cv.rect(38, 30, 26, 1, WHITE).rect(67, 30, 4, 1, WHITE);
    cv.rect(18, 60, 1, 30, B[8]).rect(18, 93, 1, 3, B[8]);

    // Vented tube cage on top: glowing vacuum tubes seen between grille pillars.
    const cage = cv.mask().rrect(72, 5, 120, 28, [12, 12, 0, 0]);
    cel(cv, cage, [B[7], B[6], B[5], B[4]], { shadow: B[3], k: 3, hi: B[8] });
    const win = cv.mask().rrect(77, 10, 110, 20, [8, 8, 0, 0]);
    cv.fill(win, B[0]);
    const TUBES = [88, 110, 132, 154, 176];
    const flk = cv.layer('flk');
    for (const tx of TUBES) {
      // Warm spill on the dark interior: one hard band.
      cv.fill(win.and(cv.mask().oval(tx - 8, 12, 17, 20)), O[0]);
      const glass = cv.mask().rrect(tx - 4, 12, 9, 17, [4, 4, 0, 0]), gin = glass.erode(1);
      cv.fill(gin, O[1]); // warm glow filling the envelope
      cv.fill(gin.clip(0, 13, W, 3), B[5]).fill(gin.clip(0, 13, W, 3).sub(gin.shift(1, 1)), B[7]); // silver getter dome
      cv.fill(glass.edge(), B[6]);
      cv.fill(glass.edge().clip(tx + 2, 12, 8, 18), B[3]);
      cv.rect(tx - 2, 17, 5, 10, B[1]); // anode plate
      cv.rect(tx - 1, 18, 3, 8, O[2]); // heater glow through the plate slit
      cv.rect(tx, 19, 1, 6, O[3]);
      cv.set(tx - 3, 17, WHITE).set(tx - 3, 18, WHITE).set(tx - 3, 19, B[8]).set(tx - 2, 14, WHITE); // glass glints
      cv.rect(tx - 4, 28, 9, 2, B[1]).rect(tx - 4, 28, 9, 1, B[3]); // socket
      // Flicker layer: hotter core and a brighter halo.
      flk.rect(tx - 1, 18, 3, 8, O[3]).rect(tx, 19, 1, 6, O[5]).set(tx, 18, O[4]).set(tx, 25, O[4]);
      flk.fill(gin.sub(cv.mask().rect(tx - 2, 13, 5, 14)).clip(0, 16, W, 12).sub(cv.mask().rect(tx - 3, 17, 1, 3)), O[2]);
    }
    // Grille: pillars between the tubes.
    for (const x of [98, 120, 142, 164]) {
      const p = cv.mask().rect(x, 10, 3, 20);
      cv.fill(p, B[6]).fill(p.clip(x, 10, 1, 20), B[8]).fill(p.clip(x + 2, 10, 1, 20), B[4]);
      cv.outline(INK, p, { all: true });
    }
    // Window rim: shadowed top/left wall, lit bottom/right lip.
    cv.fill(win.sub(win.shift(1, 1)), B[1]);
    cv.outline(INK, win, { all: true });
    // Tiny vents on the cage crown.
    for (let x = 102; x <= 160; x += 6) cv.rect(x, 7, 3, 1, B[3]).rect(x + 1, 8, 2, 1, B[8]);

    // Bezel: raised ice lip, a navy graticule ring with ice ticks, then the deep tube rim.
    const lip = cv.mask().rrect(23, 35, 168, 140, 20);
    cel(cv, lip, [B[8], B[7], B[6]], { shadow: B[4], k: 2, hi: WHITE });
    const ring = cv.mask().rrect(27, 39, 160, 132, 16);
    cv.grad(ring, [B[3], B[2], B[2], B[1]], { soft: 0.8 });
    cv.fill(ring.sub(ring.shift(2, 2)), B[0]);
    cv.fill(ring.sub(ring.shift(-1, -1)), B[3]);
    cv.outline(INK, ring, { all: true });
    const [hx, hy, hw, hh] = HOLE;
    for (let i = 0; i <= 10; i++) { // 10 divisions across
      const x = hx + Math.round((i * (hw - 1)) / 10), L = i === 5 ? 4 : i % 5 === 0 ? 0 : 2;
      if (!L) continue;
      cv.rect(x, hy - 3 - L, 1, L, B[7]).rect(x, hy + hh + 3, 1, L, B[5]);
    }
    for (let j = 0; j <= 8; j++) { // 8 divisions down
      const y = hy + Math.round((j * (hh - 1)) / 8), L = j === 4 ? 4 : j % 4 === 0 ? 0 : 2;
      if (!L) continue;
      cv.rect(hx - 3 - L, y, L, 1, B[7]).rect(hx + hw + 3, y, L, 1, B[5]);
    }
    for (const [x, y] of [[31, 43], [182, 43], [31, 166], [182, 166]]) { // ring screws
      cv.rect(x, y, 2, 2, B[5]).set(x, y, B[8]).set(x + 1, y + 1, B[3]);
    }
    inset(cv, ...HOLE, HR, { rim: INK, top: B[0], left: B[0], bottom: B[2], right: B[2] }, 2);
    arc(cv, hx + 8, hy + 8, 13, 13, 200, 250, B[4], ring.erode(2).sub(cv.mask().rrect(hx - 3, hy - 3, hw + 6, hh + 6, HR + 3)));

    // Right panel: engraved brand, twin needle meters, toggles + pilot lamp, patch bay.
    const PX = 218;
    engrave(cv, 'KAYBORO', PX, 37, B[2], B[8]);
    meter(cv, 195, 46, 46, 30, -120, -76, 'sw1');
    meter(cv, 195, 79, 46, 30, -98, -62, 'sw2');
    const tstrip = cv.mask().rrect(195, 113, 46, 18, 5);
    cv.fill(tstrip, B[2]).fill(tstrip.sub(tstrip.shift(1, 1)), B[1]).fill(tstrip.sub(tstrip.shift(-1, -1)), B[4]);
    cv.outline(INK, tstrip, { all: true });
    toggle(cv, 202, 122, true);
    toggle(cv, 212, 122, false);
    toggle(cv, 222, 122, true);
    // Amber pilot jewel with a little halo.
    const jw = cv.mask().circle(234, 122, 3);
    cv.fill(jw.dilate(1, true).sub(jw), B[6]);
    cv.grad(jw, [O[5], O[4], O[3], O[2]], { soft: 0.6 });
    cv.fill(jw.sub(jw.shift(-2, -2)), O[2]);
    cv.outline(INK, jw.dilate(1, true), { all: true });
    cv.set(233, 120, WHITE).set(232, 121, O[5]);
    flk.set(234, 122, O[5]).set(235, 123, O[4]);

    const bay = cv.mask().rrect(195, 133, 46, 38, 4);
    cv.fill(bay, B[1]).fill(bay.sub(bay.shift(1, 1)), B[0]).fill(bay.sub(bay.shift(-1, -1)), B[3]);
    cv.outline(INK, bay, { all: true });
    const JX = [205, 218, 231], JY = [143, 160];
    for (const y of JY) for (const x of JX) {
      const j = cv.mask().circle(x, y, 3);
      cel(cv, j, [B[8], B[7], B[6]], { shadow: B[5], k: 1, hi: WHITE, drop: false });
      cv.rect(x - 1, y - 1, 2, 2, INK).set(x, y, B[0]);
    }
    // Plug boots seated in three jacks.
    const boot = (x, y, R) => {
      const m = cv.mask().rrect(x - 2, y - 1, 5, 7, 1);
      cel(cv, m, [R[3], R[2]], { shadow: R[1], k: 1, hi: R[4] });
    };
    // Cyan loop between the two lower outer jacks, ice lead dangling off the edge with a loose plug.
    cable(cv, [[205, 166], [203, 198], [233, 198], [231, 166]], K);
    const ICE = [B[0], B[5], B[7], B[8], WHITE];
    cable(cv, [[218, 149], [216, 190], [242, 186], [240, 214]], ICE);
    boot(205, 160, K); boot(231, 160, K); boot(218, 143, ICE);
    const loose = cv.mask().rrect(237, 213, 7, 6, 1);
    cel(cv, loose, [B[8], B[7]], { shadow: B[5], k: 1, hi: WHITE });
    const tip = cv.mask().rect(239, 219, 3, 4);
    cv.fill(tip, B[6]).fill(tip.clip(239, 219, 1, 4), WHITE);
    cv.outline(INK, tip, { all: true });

    // Bottom row: chicken-head knobs with engraved labels.
    [['VOLTS', 46, 225], ['TIME', 87, 290], ['SYNC', 128, 330], ['FOCUS', 169, 255]].forEach(([lb, x, a]) => {
      engrave(cv, lb, x, 178);
      knob(cv, x, 195, a);
    });

    // Die-cut star sticker (the Blue Cel set's calling card) in the lower-left corner.
    const st = sticker(cv, 20, 179, SHAPES.star, [B[3], K[2], K[3], K[4], WHITE], { border: WHITE });
    cv.outline(INK, st.dilate(1), { all: true });

    // Anime sparkles off the tube cage and handles.
    sparkle(cv, 56, 12, 2, B[7], WHITE);
    sparkle(cv, 210, 10, 1, B[7], WHITE);
    sparkle(cv, 254, 44, 1, B[6], B[8]);

    cv.outline(INK);
    return cv.punch(...HOLE, HR);
  },
};
