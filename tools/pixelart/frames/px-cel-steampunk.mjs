// Blue Cel steampunk capstone: a Victorian clockwork viewing cabinet in blued steel and cobalt enamel,
// cel-shaded like the rest of the Blue Cel set. A filigree crest crowned by a balance-wheel medallion,
// gear trains ticking behind arched cut-outs, two pressure gauges, copper pipes with a valve wheel, a
// steam whistle that puffs, a side crank, rivets everywhere, a brass nameplate and cabriole legs.
import { Canvas, bayer } from '../pixel.mjs';
import { INK, inset, sparkle } from '../kit.mjs';

const W = 288, H = 304, HOLE = [64, 85, 160, 120], HR = 4; // 4:3 (y 85: the hole fractions round-trip exactly)
const CX = 144; // the frame is mirror-symmetric about x = 143.5
// navy -> cobalt -> azure -> cyan -> ice (shared with the Blue Cel set)
const B = ['#0a1140', '#111d68', '#18308f', '#2149bb', '#2d6ade', '#4790f2', '#6cb8fd', '#a3dfff', '#e0f6ff'];
// the one warm accent family: copper (dark end) to polished brass (light end)
const Y = ['#3d140f', '#7a2e1a', '#b85a2a', '#e08f3c', '#f6c766', '#fff3c4'];
const WHITE = '#ffffff';
const TAU = Math.PI * 2;

/**
 * Cel-shade a volume: dithered vertical gradient, one hard flat core-shadow band on the lower right,
 * a 1px lit top-left edge, ink outline and a 1px drop shadow onto what is below.
 */
function cel(cv, m, grad, { shadow, k = 3, hi, drop = true, ink = true, soft = 0.3 } = {}) {
  if (drop) cv.cast(m.dilate(1), 1, 1, -1);
  if (grad.length > 1) cv.grad(m, grad, { soft }); else cv.fill(m, grad[0]);
  const core = m.sub(m.shift(-k, -k));
  if (shadow) cv.fill(core, shadow);
  if (hi) cv.fill(m.sub(m.shift(1, 1)).sub(core), hi);
  if (ink) cv.outline(INK, m, { all: true });
  return core;
}

/** Tapered stroke along a polyline of pixel centers (radius r0 -> r1). */
function stroke(cv, pts, r0, r1 = r0) {
  const m = cv.mask();
  pts.forEach(([x, y], i) => {
    const [px, py] = pts[Math.max(0, i - 1)], t = i / Math.max(1, pts.length - 1);
    m.capsule(px, py, x, y, r0 + (r1 - r0) * t);
  });
  return m;
}
const bez = (p0, p1, p2, p3, n = 24) => Array.from({ length: n + 1 }, (_, i) => {
  const t = i / n, u = 1 - t;
  return [0, 1].map((k) => u * u * u * p0[k] + 3 * u * u * t * p1[k] + 3 * u * t * t * p2[k] + t * t * t * p3[k]);
});
/** Spiral volute: from angle a0 (deg) turning `turns` (signed) while the radius shrinks r0 -> r1. */
const spiral = (cx, cy, r0, r1, a0, turns, n = 40) => Array.from({ length: n + 1 }, (_, i) => {
  const t = i / n, a = (a0 * Math.PI) / 180 + turns * TAU * t, r = r0 + (r1 - r0) * t;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
});
const mirrorPts = (pts) => pts.map(([x, y]) => [W - 1 - x, y]);

/** Spur gear mask: n teeth between radii ri and ro, rotated by ph teeth, bored hub. */
function gearMask(cv, cx, cy, ro, ri, n, ph) {
  return cv.mask().plot((x, y) => {
    const dx = x + 0.5 - cx, dy = y + 0.5 - cy, r = Math.hypot(dx, dy);
    const a = (Math.atan2(dy, dx) / TAU + 1) * n + ph;
    return r <= ((((a % 1) + 1) % 1) < 0.5 ? ro : ri);
  }, cx - ro - 1, cy - ro - 1, cx + ro + 2, cy + ro + 2);
}

/** Paint the inside of a cut-out window: dark well, ticking gears (phase ph), deep top-left shadow. */
function gearWell(t, win, gears, ph) {
  t.fill(win, B[0]);
  t.fill(win.shift(0, 0).sub(win.shift(0, -6)), B[1]); // a touch of bounce light at the bottom
  for (const g of gears) {
    const m = gearMask(t, g.x, g.y, g.ro, g.ri, g.n, ph * g.dir + g.off).and(win);
    const R = g.back ? [B[2], B[3], B[5], B[6]] : [B[4], B[5], B[7], B[8]];
    t.fill(m, R[2]);
    t.fill(m.sub(m.shift(-2, -2)), R[1]); // hard core shadow
    t.fill(m.sub(m.shift(1, 1)).sub(m.sub(m.shift(-2, -2))), R[3]);
    const web = t.mask().circle(g.x, g.y, g.ri - 2.6).and(m);
    t.fill(web, R[1]).fill(web.sub(web.shift(-1, -1)), R[3]);
    const hub = t.mask().circle(g.x, g.y, 2.2).and(win);
    t.fill(hub, R[2]).set(g.x - 1, g.y - 1, R[3]).set(g.x, g.y, INK).set(g.x + 1, g.y + 1, R[0]);
    t.fill(m.ring().and(win), INK);
  }
  t.fill(win.sub(win.shift(1, 1)), INK); // the wall over the gears casts a hard shadow
  t.tone(win.sub(win.shift(2, 3)).sub(win.sub(win.shift(1, 1))), -1);
}

/** Gauge dial face with a needle at `deg` (0 = right, clockwise). */
function dial(t, cx, cy, deg) {
  const face = t.mask().circle(cx, cy, 9);
  t.grad(face, [WHITE, B[8], B[7]], { dir: { cx: cx - 4, cy: cy - 4, r: 16 }, soft: 0.6 });
  t.fill(face.sub(face.shift(-2, -2)), B[7]);
  for (let k = 0; k <= 8; k++) { // ticks over a 270 degree sweep
    const a = ((135 + k * 33.75) * Math.PI) / 180, red = k >= 7;
    t.set(Math.round(cx + 7.6 * Math.cos(a)), Math.round(cy + 7.6 * Math.sin(a)), red ? Y[2] : B[2]);
    if (k % 2 === 0) t.set(Math.round(cx + 6.4 * Math.cos(a)), Math.round(cy + 6.4 * Math.sin(a)), red ? Y[3] : B[3]);
  }
  const a = (deg * Math.PI) / 180;
  t.fill(t.mask().line(cx, cy, Math.round(cx + 6.6 * Math.cos(a)), Math.round(cy + 6.6 * Math.sin(a))), INK);
  t.set(Math.round(cx + 6.6 * Math.cos(a)), Math.round(cy + 6.6 * Math.sin(a)), Y[2]);
  t.rect(cx, cy, 2, 2, Y[3]).set(cx, cy, Y[5]).set(cx + 1, cy + 1, Y[1]);
  t.px([[cx - 5, cy - 4], [cx - 4, cy - 5], [cx - 3, cy - 6]], WHITE); // glass glint
}

/** Balance wheel seen through the crest medallion, rotated by `deg`. */
function balance(t, win, deg) {
  t.fill(win, B[0]).fill(win.sub(win.shift(0, -5)), B[1]);
  for (let i = 0; i < 70; i++) { // hairspring
    const a = i * 0.27 + (deg * Math.PI) / 180, r = 2.6 + i * 0.085;
    t.set(Math.round(CX - 0.5 + r * Math.cos(a)), Math.round(30 + r * Math.sin(a)), B[3]);
  }
  const rim = t.mask().circle(CX - 0.5, 30, 11.4).sub(t.mask().circle(CX - 0.5, 30, 9.2));
  const spokes = t.mask();
  for (let k = 0; k < 3; k++) {
    const a = ((deg + k * 120) * Math.PI) / 180;
    spokes.capsule(CX - 0.5, 30, CX - 0.5 + 9.6 * Math.cos(a), 30 + 9.6 * Math.sin(a), 0.7);
  }
  const wheel = rim.or(spokes);
  t.fill(wheel, B[6]);
  t.fill(wheel.sub(wheel.shift(-1, -1)), B[4]);
  t.fill(rim.sub(rim.shift(1, 1)), B[8]);
  for (let k = 0; k < 8; k++) { // timing screws on the rim
    const a = ((deg + 22.5 + k * 45) * Math.PI) / 180;
    t.set(Math.round(CX - 0.5 + 12.3 * Math.cos(a)), Math.round(30 + 12.3 * Math.sin(a)), Y[4]);
  }
  t.outline(INK, wheel.and(win));
  const hub = t.mask().circle(CX - 0.5, 30, 2);
  t.fill(hub, B[7]).set(143, 29, B[8]).rect(143, 30, 2, 1, Y[3]);
  t.tone(win.sub(win.shift(2, 2)), -1);
}

/** Pixel arc (degrees, 0 = right, 90 = down) for anime specular slivers. */
function arc(cv, cx, cy, rx, ry, a0, a1, c, clip) {
  for (let a = a0; a <= a1; a += 0.5) {
    const t = (a * Math.PI) / 180, x = Math.round(cx + rx * Math.cos(t)), y = Math.round(cy + ry * Math.sin(t));
    if (!clip || clip.has(x, y)) cv.set(x, y, c);
  }
}

function rivet(cv, x, y) {
  cv.px([[x, y]], B[8]).px([[x + 1, y], [x, y + 1]], B[6]).set(x + 1, y + 1, B[3]);
  cv.tone(cv.mask().pts([[x + 2, y + 1], [x + 1, y + 2], [x + 2, y + 2]]), -1);
}

/** Copper pipe along a polyline with brass flanges at the given points. */
function pipe(cv, pts, flanges = []) {
  const m = stroke(cv, pts, 1.6);
  cv.cast(m.dilate(1), 1, 1, -1);
  cv.fill(m, Y[2]);
  cv.fill(m.sub(m.shift(-1, -1)), Y[1]);
  cv.fill(m.sub(m.shift(1, 1)).sub(m.sub(m.shift(-1, -1))), Y[4]);
  cv.outline(INK, m, { all: true });
  for (const [x, y, v] of flanges) {
    const f = v ? cv.mask().rect(x - 3, y - 1, 7, 3) : cv.mask().rect(x - 1, y - 3, 3, 7);
    cv.fill(f, Y[3]).fill(f.sub(f.shift(-1, -1)), Y[1]).fill(f.sub(f.shift(1, 1)), Y[5]);
    cv.outline(INK, f, { all: true });
  }
  return m;
}

export default {
  id: 'px-cel-steampunk', name: 'Clockwork Kinetoscope', theme: 'steampunk', rarity: 'legendary', translucent: false,
  collection: 'blue-cel', license: 'CC-BY-4.0',
  desc: 'A blued-steel clockwork viewing cabinet that ticks, hisses and puffs steam while your game plays.',
  tags: ['steampunk', 'clockwork', 'cel-shaded', 'blue', 'victorian', 'animated'],
  css: '.ga{animation:gt 1s steps(1) infinite}@keyframes gt{50%{opacity:0}}' +
    '.bw{animation:bw .8s steps(1) infinite}@keyframes bw{50%{opacity:0}}' +
    '.nd{animation:nd 2.6s steps(1) infinite}@keyframes nd{0%,62%{opacity:0}63%,70%{opacity:1}71%,78%{opacity:0}79%,84%{opacity:1}85%,100%{opacity:0}}' +
    '.pf{animation:pf 3.2s steps(1) infinite}@keyframes pf{0%,55%{opacity:0}56%,100%{opacity:1}}',
  draw() {
    const cv = new Canvas(W, H);
    cv.use(B, Y);

    // Dithered floor shadow (opaque ink on a checker so the shell stays solid).
    cv.fill(cv.mask().oval(18, 285, 252, 12), (x, y) => {
      const d = ((x + 0.5 - CX) / 126) ** 2 + ((y + 0.5 - 291) / 6) ** 2;
      return d < 0.62 || bayer(x, y) < (1 - d) * 2.4 ? INK : undefined;
    });

    // Cabriole legs and a scalloped skirt with a little gear rosette.
    const legL = cv.mask().poly([[27, 250], [21, 256], [18, 263], [19, 270], [24, 277], [29, 281], [29, 285], [25, 288], [23, 291],
      [43, 291], [41, 286], [39, 281], [39, 275], [41, 267], [47, 259], [54, 250]]);
    const legs = legL.mirror();
    cel(cv, legs, [B[6], B[5], B[4]], { shadow: B[2], k: 3, hi: B[8] });
    for (const x of [24, W - 25 - 18]) { // feet pads
      const pad = cv.mask().rect(x, 288, 19, 3).and(legs);
      cv.fill(pad, B[2]);
    }
    const skirt = cv.mask().plot((x, y) => {
      const u = x + 0.5 - CX, f = ((((u + 8) % 16) + 16) % 16) / 8 - 1; // scallops 16px wide
      const bot = 260 + 4 * Math.sqrt(Math.max(0, 1 - f * f)) + 9 * Math.exp(-((u / 18) ** 2));
      return y + 0.5 < bot;
    }, 50, 248, W - 50, 276);
    cel(cv, skirt, [B[5], B[4]], { shadow: B[2], k: 1, hi: B[7], soft: 0.2 });
    cv.fill(skirt.sub(skirt.shift(0, -3)).sub(skirt.sub(skirt.shift(0, -1))).and(skirt.shift(0, 0)), B[3]);
    const ros = gearMask(cv, CX - 0.5, 262, 5.2, 3.6, 8, 0);
    cel(cv, ros, [B[8], B[6]], { shadow: B[4], k: 1, drop: true });
    cv.rect(143, 261, 2, 2, INK);

    // Plinth.
    const plinth = cv.mask().rrect(12, 238, 264, 13, 3);
    cel(cv, plinth, [B[7], B[6], B[5]], { shadow: B[3], k: 3, hi: B[8], soft: 0.05 });
    cv.fill(cv.mask().rect(14, 242, 260, 1).and(plinth.erode(1)), B[4]);
    for (let x = 23; x < W - 22; x += 20) rivet(cv, x, 245);

    // Cabinet body: blued steel, cobalt gradient, hard core shadow.
    const body = cv.mask().rrect(22, 62, 244, 178, 4);
    cel(cv, body, [B[5], B[4], B[3]], { shadow: B[2], k: 6, hi: B[7], soft: 0.25 });
    // Engraved panel beads around the side columns.
    for (const x of [24, W - 24 - 30]) {
      const pan = cv.mask().rrect(x, 106, 30, 128, 4);
      cv.fill(pan.edge(), B[2]);
      cv.fill(pan.edge().shift(1, 1).and(pan.erode(1)), B[6]);
    }

    // Crest: a domed pediment, filigree scrolls and the balance-wheel medallion.
    const dome = cv.mask().oval(80, 22, 128, 66).clip(0, 0, W, 54);
    cel(cv, dome, [B[6], B[5]], { shadow: B[3], k: 4, hi: B[8] });
    cv.fill(dome.erode(4).edge().clip(0, 0, W, 50), B[3]);
    const rays = cv.mask();
    for (let k = 0; k < 9; k++) { // engraved sunburst behind the medallion
      const a = ((196 + k * 18.5) * Math.PI) / 180;
      rays.line(Math.round(CX - 0.5 + 22 * Math.cos(a)), Math.round(53 + 22 * Math.sin(a)), Math.round(CX - 0.5 + 60 * Math.cos(a)), Math.round(53 + 60 * Math.sin(a)));
    }
    const rayM = rays.and(dome.erode(5));
    cv.fill(rayM, B[3]).fill(rayM.shift(1, 0).and(dome.erode(5)).sub(rayM), B[7]);
    const volute = stroke(cv, [...bez([124, 38], [112, 26], [100, 14], [86, 18]), ...spiral(88.5, 27, 9, 2.5, -103, -1.15)], 2.7, 1.3);
    const scrolls = volute.mirror();
    cv.cast(scrolls.dilate(1), 1, 1, -2);
    cv.grad(scrolls, [B[8], B[7], B[6]], { soft: 0.3 });
    cv.fill(scrolls.sub(scrolls.shift(-1, -1)), B[4]);
    cv.fill(scrolls.sub(scrolls.shift(1, 1)).sub(scrolls.sub(scrolls.shift(-1, -1))), WHITE);
    cv.outline(INK, scrolls, { all: true });
    for (const [x, y] of [[85, 17]]) { // brass beads at the scroll tips
      for (const xx of [x, W - 2 - x]) cv.rect(xx, y, 2, 2, Y[4]).set(xx + 1, y + 1, Y[2]).set(xx, y, Y[5]);
    }

    const medal = cv.mask().circle(CX - 0.5, 30, 19.4);
    cel(cv, medal, [B[8], B[7], B[6]], { shadow: B[4], k: 3, hi: WHITE });
    const brassRing = cv.mask().circle(CX - 0.5, 30, 16.4).sub(cv.mask().circle(CX - 0.5, 30, 15.4));
    cv.fill(brassRing, (x, y) => (x + y < 168 ? Y[4] : Y[2]));
    const bwin = cv.mask().circle(CX - 0.5, 30, 14.4);
    for (let k = 0; k < 8; k++) { // medallion rivets
      const a = (k * TAU) / 8 + TAU / 16;
      rivet(cv, Math.round(CX - 1.5 + 17.9 * Math.cos(a)), Math.round(29 + 17.9 * Math.sin(a)));
    }
    balance(cv, bwin, 0);
    balance(cv.layer('bw'), bwin, 60);
    cv.outline(INK, bwin, { all: true });
    // Finial on top.
    const fin = cv.mask().circle(CX - 0.5, 7, 2.6).or(cv.mask().rect(143, 0, 2, 5)).or(cv.mask().rect(141, 9, 6, 2));
    cel(cv, fin, [B[8], B[6]], { shadow: B[4], k: 1, hi: WHITE });

    // Cornice with dentils.
    const corn = cv.mask().rrect(12, 50, 264, 14, 3);
    cel(cv, corn, [B[8], B[7], B[6]], { shadow: B[4], k: 3, hi: WHITE, soft: 0.2 });
    cv.fill(cv.mask().rect(13, 56, 262, 1), B[4]);
    for (let x = 16; x < W - 16; x += 6) cv.rect(x, 59, 3, 2, B[3]).set(x, 59, B[5]);
    for (let x = 30; x < W - 30; x += 16) if (Math.abs(x + 1 - CX) > 24) rivet(cv, x, 52);
    // Iron roof cresting between the urn/whistle and the dome: spear posts on a rail.
    const crest = cv.mask().rect(48, 47, 38, 2);
    for (let i = 0; i < 7; i++) {
      const x = 49 + i * 6, top = i % 2 ? 43 : 39;
      crest.rect(x, top, 1, 48 - top).pts([[x, top - 2], [x - 1, top - 1], [x, top - 1], [x + 1, top - 1]]);
      if (i < 6) crest.pts([[x + 2, 45], [x + 3, 44], [x + 4, 45]]); // little arches between posts
    }
    const crests = crest.mirror().sub(dome);
    cv.cast(crests.dilate(1), 1, 1, -1);
    cv.fill(crests, B[8]);
    cv.fill(crests.and(cv.mask().rect(0, 48, W, 1)), B[5]);
    cv.outline(INK, crests, { all: true });
    for (let i = 0; i < 7; i += 2) for (const x of [49 + i * 6, W - 1 - (49 + i * 6)]) cv.set(x, 37, WHITE).set(x, 38, B[8]);

    // Corner finial urn (left) and the steam whistle (right).
    const urn = cv.mask().oval(30, 38, 14, 11).or(cv.mask().rect(34, 47, 6, 3)).or(cv.mask().circle(36.5, 35, 2.2)).or(cv.mask().rect(36, 29, 1, 4));
    cel(cv, urn, [B[8], B[6], B[5]], { shadow: B[3], k: 2, hi: WHITE });
    cv.rect(31, 42, 12, 1, Y[3]);
    const bell = cv.mask().rrect(244, 24, 11, 22, [5, 5, 1, 1]).or(cv.mask().rect(246, 46, 7, 4));
    cel(cv, bell, [B[8], B[7], B[6], B[5]], { shadow: B[3], k: 2, hi: WHITE });
    cv.rect(245, 31, 9, 2, INK).rect(246, 33, 7, 1, B[4]); // mouth
    cv.rect(245, 40, 9, 1, Y[3]).rect(245, 41, 9, 1, Y[1]); // brass band
    const cap = cv.mask().circle(249, 21, 2.2);
    cv.fill(cap, Y[3]).set(248, 20, Y[5]).set(250, 22, Y[1]);
    cv.outline(INK, cap, { all: true });
    const lever = cv.mask().capsule(255, 37, 262, 32, 0.6);
    cv.fill(lever, B[6]).outline(INK, lever, { all: true });
    cv.rect(261, 30, 3, 3, Y[4]).outline(INK, cv.mask().rect(261, 30, 3, 3), { all: true });

    // Pipes: right gauge up to the whistle, left gauge down into the plinth with a valve wheel.
    pipe(cv, [[262, 90], [272, 90], [276, 86], [276, 44], [272, 40], [256, 40]], [[276, 66, false], [258, 40, false]]);
    pipe(cv, [[26, 92], [15, 92], [11, 96], [11, 232], [15, 236], [18, 236]], [[11, 120, true], [11, 214, true]]);
    const wheel = cv.mask().circle(11, 168, 7.4).sub(cv.mask().circle(11, 168, 5.2));
    const wspk = cv.mask().capsule(6, 168, 16, 168, 0.5).or(cv.mask().capsule(11, 163, 11, 173, 0.5));
    const vw = wheel.or(wspk);
    cv.cast(vw.dilate(1), 1, 1, -1);
    cv.fill(vw, Y[3]).fill(vw.sub(vw.shift(-1, -1)), Y[1]).fill(wheel.sub(wheel.shift(1, 1)), Y[5]);
    cv.outline(INK, vw, { all: true });
    cv.rect(10, 167, 3, 3, Y[4]).set(12, 169, Y[1]);

    // Side crank on the right.
    const boss = cv.mask().circle(266, 160, 6.4);
    cel(cv, boss, [B[8], B[6]], { shadow: B[4], k: 2, hi: WHITE });
    const arm = cv.mask().capsule(266, 160, 279, 178, 1.8);
    cel(cv, arm, [B[7], B[6]], { shadow: B[4], k: 1, hi: WHITE });
    const knob = cv.mask().rrect(275, 177, 9, 18, 4);
    cel(cv, knob, [B[8], B[6], B[5]], { shadow: B[3], k: 2, hi: WHITE });
    cv.rect(266, 160, 2, 2, Y[3]).set(266, 160, Y[5]);
    cv.set(277, 180, WHITE).set(277, 181, WHITE).set(277, 182, B[8]);

    // Gear cut-outs in the side columns (they tick), framed in polished steel.
    const winL = cv.mask().rrect(28, 112, 22, 84, [11, 11, 3, 3]);
    const wins = winL.mirror();
    const frame = wins.dilate(2, true);
    cel(cv, frame, [B[8], B[7], B[6]], { shadow: B[5], k: 2, hi: WHITE });
    const gearsL = [
      { x: 43, y: 146, ro: 7.6, ri: 5.4, n: 7, dir: -1, off: 0.25, back: true },
      { x: 43, y: 184, ro: 8.6, ri: 6.4, n: 8, dir: -1, off: 0, back: true },
      { x: 37, y: 127, ro: 10.4, ri: 8, n: 10, dir: 1, off: 0 },
      { x: 36, y: 164, ro: 10.4, ri: 8, n: 10, dir: 1, off: 0.5 },
    ];
    const gears = [...gearsL, ...gearsL.map((g) => ({ ...g, x: W - 1 - g.x, dir: -g.dir }))];
    gearWell(cv, wins, gears, 0);
    gearWell(cv.layer('ga'), wins, gears, 0.5);
    cv.outline(INK, wins, { all: true });
    for (const x of [37, W - 39]) { rivet(cv, x, 199); }

    // Pressure gauges at the upper corners (needles twitch).
    const nd = cv.layer('nd');
    for (const [gx, a0, a1] of [[38, 200, 228], [W - 39, 300, 322]]) {
      const ring = cv.mask().circle(gx, 92, 13.4);
      cel(cv, ring, [B[8], B[7], B[6]], { shadow: B[4], k: 3, hi: WHITE });
      const br = cv.mask().circle(gx, 92, 10.4).sub(cv.mask().circle(gx, 92, 9.4));
      cv.fill(br, (x, y) => (x + y < gx + 92 ? Y[4] : Y[2]));
      for (let k = 0; k < 4; k++) {
        const a = TAU / 8 + (k * TAU) / 4;
        rivet(cv, Math.round(gx - 0.5 + 11.6 * Math.cos(a)), Math.round(91.5 + 11.6 * Math.sin(a)));
      }
      dial(cv, gx, 92, a0);
      dial(nd, gx, 92, a1);
      cv.outline(INK, cv.mask().circle(gx, 92, 9.4), { all: true });
    }

    // Ornate bezel molding around the screen: ice steel, rivets, brass corner brackets, deep recess.
    const bez0 = cv.mask().rrect(54, 73, 180, 144, 9);
    cel(cv, bez0, [B[8], B[7], B[6]], { shadow: B[5], k: 3, hi: WHITE });
    const tube = cv.mask().rrect(59, 80, 170, 130, 7);
    cv.fill(tube, B[1]);
    cv.fill(tube.sub(tube.shift(2, 2)), B[0]);
    cv.fill(tube.sub(tube.shift(-1, -1)), B[4]);
    cv.outline(INK, tube, { all: true });
    inset(cv, ...HOLE, HR, { rim: INK, top: B[0], left: B[0], bottom: B[2], right: B[2] }, 1);
    for (let x = 72; x < 220; x += 16) { rivet(cv, x, 75); rivet(cv, x, 212); }
    for (let y = 101; y < 201; y += 16) { rivet(cv, 55, y); rivet(cv, 230, y); }
    const brk = cv.mask().pts([[0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [5, 0], [6, 0], [0, 1], [1, 1], [2, 1], [3, 1], [4, 1], [0, 2], [1, 2], [2, 2],
      [0, 3], [1, 3], [0, 4], [1, 4], [0, 5], [0, 6]]);
    const brackets = [[55, 74, 1, 1], [232, 74, -1, 1], [55, 215, 1, -1], [232, 215, -1, -1]];
    let brm = cv.mask();
    for (const [x, y, sx, sy] of brackets) brk.each((i, j) => brm.put(x + i * sx, y + j * sy));
    cv.fill(brm, (x, y) => ((x < CX) === (y < 140) ? Y[4] : Y[2]));
    for (const [x, y] of brackets) cv.set(x, y, Y[5]);

    // Apron: the brass nameplate between two gear portholes.
    const plate = cv.mask().rrect(102, 220, 84, 16, 3);
    cel(cv, plate, [Y[5], Y[4], Y[3]], { shadow: Y[2], k: 2, hi: Y[5] });
    const word = cv.textMask('KAYBORO', CX, 224, { font: 5, align: 'center' });
    cv.fill(word.shift(0, 1), Y[5]).fill(word, Y[0]);
    for (const x of [106, 180]) cv.rect(x, 227, 2, 2, Y[1]).set(x, 227, Y[2]);
    const portL = cv.mask().circle(78, 229, 7.4);
    const ports = portL.mirror();
    cel(cv, ports.dilate(2), [B[8], B[7]], { shadow: B[5], k: 2, hi: WHITE });
    const pg = [{ x: 78, y: 229, ro: 6.6, ri: 4.6, n: 7, dir: 1, off: 0 }, { x: W - 1 - 78, y: 229, ro: 6.6, ri: 4.6, n: 7, dir: -1, off: 0 }];
    gearWell(cv, ports, pg, 0);
    gearWell(cv.layer('ga'), ports, pg, 0.5);
    cv.outline(INK, ports, { all: true });

    // Steam puff from the whistle (small wisp always, a big puff on the beat).
    const wisp = cv.mask().circle(252, 15, 2.6).or(cv.mask().circle(257, 12, 2));
    cv.fill(wisp, B[8]).fill(wisp.sub(wisp.shift(-1, -1)), B[7]).outline(INK, wisp, { all: true });
    const pf = cv.layer('pf');
    const puff = pf.mask().circle(259, 13, 5.4).or(pf.mask().circle(267, 9, 4.4)).or(pf.mask().circle(274, 5, 3.4)).or(pf.mask().circle(266, 15, 3.6));
    pf.fill(puff, WHITE).fill(puff.sub(puff.shift(-2, -2)), B[8]).fill(puff.sub(puff.shift(-1, -1)).sub(puff.shift(0, -1)).and(puff.shift(1, 0)), B[7]);
    pf.outline(INK, puff, { all: true });

    // Anime specular slivers and glints on the glossy top-left of each volume.
    cv.rect(23, 110, 1, 44, B[8]).rect(23, 158, 1, 6, B[8]).rect(23, 112, 1, 14, WHITE);
    cv.rect(26, 64, 22, 1, B[8]).rect(26, 64, 10, 1, WHITE).rect(51, 64, 3, 1, B[8]);
    cv.rect(16, 51, 40, 1, WHITE).rect(60, 51, 6, 1, WHITE).rect(70, 51, 2, 1, WHITE);
    arc(cv, CX - 0.5, 30, 18.2, 18.2, 196, 246, WHITE, medal);
    arc(cv, CX - 0.5, 55, 61, 31, 196, 222, B[8], dome.erode(2));
    arc(cv, CX - 0.5, 55, 61, 31, 202, 214, WHITE, dome.erode(2));
    cv.rect(58, 76, 1, 30, WHITE).rect(58, 110, 1, 4, WHITE); // bezel inner-left sliver
    cv.rect(16, 240, 24, 1, WHITE).rect(44, 240, 4, 1, WHITE);
    cv.px([[21, 259], [20, 261], [20, 262]], WHITE).px([[W - 1 - 47, 254], [W - 1 - 48, 255]], B[8]);
    cv.rect(105, 221, 14, 1, Y[5]).rect(122, 221, 3, 1, Y[5]);
    sparkle(cv, 104, 222, 1, Y[5], WHITE);
    // Anime glints.
    sparkle(cv, 14, 20, 2, B[7], WHITE);
    sparkle(cv, 210, 8, 1, B[7], WHITE);
    sparkle(cv, 280, 120, 1, B[6], B[8]);

    cv.outline(INK);
    return cv.punch(...HOLE, HR);
  },
};
