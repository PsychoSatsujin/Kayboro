// Abyss Porthole: a riveted bathysphere resting on the deep sea floor, its big brass-collared
// observation porthole holding the screen. A curious octopus wraps a tentacle round the hull, a
// friendly anglerfish lights the lower-left corner with its lure, jellies drift past the top, kelp
// sways behind, coral, urchins, a starfish and an anemone dot the sand, god rays filter down from
// the surface and bubbles rise in three stepped phases.
import { Canvas, rng, bayer, ramp, mix } from '../pixel.mjs';
import { INK, inset, part, sprite, spriteMask, screw } from '../kit.mjs';

const W = 256, H = 256, HOLE = [64, 72, 128, 96], HR = 6; // 4:3
const CX = 128, CY = 120, R = 104; // the sphere
const Wa = ['#060d22', '#0a1a38', '#0e2c4e', '#133f60', '#185472', '#1f6a84']; // water, deep -> shallow
const Hu = ramp('#5a7288', 7, { step: 0.11, hue: 6, sat: 0.04 }); // steel hull
const Br = ramp('#b8873a', 6, { step: 0.12, hue: 6, sat: 0.05 }); // brass
const Oc = ramp('#b65aa8', 6, { step: 0.12, hue: 6, sat: 0.05 }); // octopus
const An = ramp('#6a5ab0', 6, { step: 0.12, hue: 6, sat: 0.05 }); // anglerfish
const Je = ['#8a3474', '#c452a4', '#ee84ce', '#ffb4e4', '#ffe2f4']; // jellyfish
const Co = ramp('#e05a7c', 5, { step: 0.13, hue: 5, sat: 0.05 }); // pink coral
const Co2 = ramp('#ea8a46', 5, { step: 0.13, hue: 5, sat: 0.05 }); // orange coral
const Cy = ['#0c5a70', '#1696ac', '#36d0e0', '#8ef2ff', '#e4ffff']; // cyan anemone / glow
const Ke = ['#0e3630', '#165246', '#1f705c', '#2c9076', '#45b08d', '#7dd0ac']; // kelp
const Sa = ['#2a2d4c', '#404466', '#585c80', '#72779c', '#9095b6', '#b0b4cc']; // sand
const Ur = ['#2a1240', '#4a2070', '#6e3a9a', '#9a62c4']; // urchin
const Sf = ['#7a2a30', '#b8434a', '#ec6a62', '#ff9a86', '#ffd0bc']; // starfish
const Cr = ['#8a7e66', '#c8bc9c', '#efe6cc', '#fff8e8']; // gauge dial
const GLOW = '#8ef2ff', CORE = '#ffffff', PINK = '#ff7ad8';

const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
// Coarse 2x2-block Bayer: dithering that still reads at 1x and merges into far fewer SVG rects.
const B2 = (x, y) => bayer(x >> 1, y >> 1);
// Piecewise-linear level quantised to bands; only a narrow strip at each band edge is dithered.
const level = (pts, t, x, y, soft = 0.25) => {
  let i = 0;
  while (i < pts.length - 2 && t > pts[i + 1][0]) i++;
  const [t0, v0] = pts[i], [t1, v1] = pts[i + 1], v = lerp(v0, v1, clamp((t - t0) / (t1 - t0), 0, 1));
  const k = Math.floor(v), u = clamp((v - k - 0.5) / soft + 0.5, 0, 1);
  return k + (u > B2(x, y) ? 1 : 0);
};
// Catmull-Rom through the points, ~1px steps, rounded.
function spline(P) {
  const out = [];
  for (let i = 0; i + 1 < P.length; i++) {
    const [a, b, c, d] = [P[Math.max(0, i - 1)], P[i], P[i + 1], P[Math.min(P.length - 1, i + 2)]];
    const n = Math.ceil(Math.hypot(c[0] - b[0], c[1] - b[1]));
    for (let k = 0; k < n; k++) {
      const t = k / n, t2 = t * t, t3 = t2 * t;
      out.push([0, 1].map((j) => 0.5 * (2 * b[j] + (-a[j] + c[j]) * t + (2 * a[j] - 5 * b[j] + 4 * c[j] - d[j]) * t2 + (-a[j] + 3 * b[j] - 3 * c[j] + d[j]) * t3)));
    }
  }
  return out.concat([P[P.length - 1]]);
}

// Branching coral from a base point; returns its mask.
function coral(cv, x0, y0, ang, len, r0, depth, rnd) {
  const m = cv.mask();
  const grow = (x, y, a, l, r, d) => {
    const ex = x + Math.cos(a) * l, ey = y + Math.sin(a) * l;
    m.capsule(Math.round(x), Math.round(y), Math.round(ex), Math.round(ey), r);
    if (d > 0) {
      const n = d > 1 && rnd() < 0.35 ? 3 : 2;
      for (let i = 0; i < n; i++) grow(ex, ey, a + (i - (n - 1) / 2) * (0.6 + rnd() * 0.25) + (rnd() - 0.5) * 0.25, l * (0.66 + rnd() * 0.12), Math.max(0.7, r - 0.75), d - 1);
    }
  };
  grow(x0, y0, ang, len, r0, depth);
  return m;
}

// Swaying kelp stalk with alternating blades, from the floor (yBot) up to yTop.
function kelp(cv, x0, yTop, yBot, ph, amp) {
  const stalk = cv.mask();
  let blades = cv.mask();
  for (let y = yBot; y >= yTop; y--) {
    const x = Math.round(x0 + Math.sin(y * 0.055 + ph) * amp);
    stalk.put(x, y).put(x + 1, y);
    if ((yBot - y) % 13 === 6) {
      const side = ((yBot - y - 6) / 13) % 2 ? 1 : -1;
      const b = cv.mask().oval(side > 0 ? x + 2 : x - 9, y - 3, 9, 6);
      blades = blades.or(b.sub(cv.mask().rect(side > 0 ? x + 2 : x - 9, y + 1, 9, 1).sub(cv.mask().rect(side > 0 ? x + 3 : x - 7, y + 1, 6, 1))));
    }
  }
  const all = stalk.or(blades);
  cv.cast(all.dilate(1), 1, 1, -1);
  cv.fill(blades, Ke[3]);
  cv.fill(blades.sub(blades.shift(1, 1)), Ke[4]);
  cv.fill(blades.sub(blades.shift(-1, -1)), Ke[2]);
  cv.fill(stalk, (x, y) => (stalk.has(x - 1, y) ? Ke[2] : Ke[1]));
  cv.outline(INK, all, { all: true });
  return all;
}

// Jellyfish: pastel dome with a lit crown, spots, a cute face and wavy tentacles.
function jelly(cv, x, y, w, pulse) {
  const h = Math.round(w * 0.62) + pulse, ww = w - pulse * 2;
  const dome = cv.mask().oval(x - (ww >> 1), y - h + 2, ww, h * 2).and(cv.mask().rect(0, 0, cv.w, y + 2));
  const skirt = cv.mask().rect(x - (ww >> 1) + 1, y, ww - 2, 2);
  const body = dome.or(skirt);
  part(cv, body, Je, { top: [4], left: [3], bottom: [1], right: [2], fill: 2, dx: 1, dy: 1 });
  cv.fill(skirt.sub(skirt.shift(0, -1)), Je[1]);
  for (const [dx, dy] of [[-3, -3], [1, -5], [3, -1]]) if (body.has(x + dx, y + dy) && body.has(x + dx + 1, y + dy)) cv.set(x + dx, y + dy, Je[4]).set(x + dx + 1, y + dy, Je[3]);
  cv.set(x - 2, y - 1, INK).set(x + 2, y - 1, INK).set(x - 3, y, Je[1]).set(x + 3, y, Je[1]);
  const n = ww > 12 ? 4 : 3, m = cv.mask();
  for (let i = 0; i < n; i++) {
    const tx = x - (ww >> 1) + 2 + Math.round((i * (ww - 4)) / (n - 1)), len = 8 + ((i * 5) % 7) + pulse;
    for (let j = 1; j <= len; j++) m.put(tx + Math.round(Math.sin(j * 0.6 + i + pulse) * 1.2), y + 1 + j);
  }
  cv.fill(m, (px, py) => ((py + px) % 3 ? Je[2] : Je[3]));
  return body.or(m);
}

export default {
  id: 'px-deep-sea', name: 'Abyss Porthole', theme: 'underwater', rarity: 'epic', translucent: false,
  collection: 'wild-pixels', license: 'CC-BY-4.0',
  desc: 'Peer out of a riveted bathysphere while an octopus hugs the hull and a friendly anglerfish lights your way through the deep.',
  tags: ['underwater', 'ocean', 'submarine', 'octopus', 'animated', 'pixel'],
  css: '.b0{animation:bb 1.2s steps(1) infinite}.b1{animation:bb 1.2s steps(1) -.8s infinite}.b2{animation:bb 1.2s steps(1) -.4s infinite}' +
    '@keyframes bb{0%,33.3%{opacity:1}33.4%,100%{opacity:0}}.jl{animation:jl 1.6s steps(1) infinite}@keyframes jl{50%{opacity:0}}' +
    '.lu{animation:lu 2.4s steps(1) infinite}@keyframes lu{0%,45%{opacity:1}46%,100%{opacity:0}}',
  draw() {
    const cv = new Canvas(W, H), rnd = rng(21);
    cv.use(Wa, Hu, Br, Oc, An, Je, Co, Co2, Cy, Ke, Sa, Ur, Sf, Cr);
    const [hx, hy, hw, hh] = HOLE;
    const all = cv.mask().rrect(0, 0, W, H, 10);

    // ---- water: shallow teal up top fading to navy, god rays slanting down from the top-left ----------
    cv.fill(all, (x, y) => Wa[clamp(level([[0, 5.3], [0.28, 3.6], [0.62, 1.4], [1, 0]], y / (H - 1), x, y), 0, 5)]);
    const rays = [[18, 22], [74, 14], [128, 26], [196, 16]];
    const ray = cv.mask().plot((x, y) => rays.some(([rx, rw]) => { const xx = x - (y >> 1); return xx >= rx && xx < rx + rw; }), 0, 0, W, 210).and(all);
    cv.fill(ray, (x, y, c) => (y < 40 || B2(x, y) < Math.max(0, 1 - y / 190) ? cv.step(c, 1) : c));
    // A little marine snow drifting in the water column.
    for (const [x, y] of [[12, 30], [40, 14], [58, 52], [92, 20], [150, 44], [206, 30], [236, 12], [8, 96], [52, 104], [244, 88], [26, 62], [184, 8]]) cv.set(x, y, cv.step(cv.get(x, y), 1));

    // ---- kelp behind everything ----------------------------------------------------------------------
    kelp(cv, 10, 66, 218, 0.4, 3);
    kelp(cv, 26, 118, 220, 2.1, 2);
    kelp(cv, 242, 34, 214, 1.3, 3);
    kelp(cv, 230, 150, 216, 3.4, 2);

    // ---- the bathysphere: radial shading, lit rim top-left, shadowed rim bottom-right -----------------
    const sph = cv.mask().circle(CX, CY, R);
    cv.cast(sph.dilate(1), 3, 3, -1);
    const lx = CX - 36, ly = CY - 38;
    cv.fill(sph, (x, y) => Hu[clamp(level([[0, 5.4], [0.28, 4.5], [0.55, 3.4], [0.8, 2.2], [1, 1.2]], Math.hypot(x + 0.5 - lx, y + 0.5 - ly) / (R * 1.5), x, y, 0.18), 0, 6)]);
    const edge1 = sph.edge(), edge2 = sph.erode(1).edge();
    const dot = (x, y) => -((x + 0.5 - CX) * 0.707 + (y + 0.5 - CY) * 0.707) / R;
    cv.fill(edge1, (x, y, c) => (dot(x, y) > 0.35 ? Hu[6] : dot(x, y) < -0.3 ? Hu[1] : c));
    cv.fill(edge2, (x, y, c) => (dot(x, y) > 0.5 ? Hu[5] : dot(x, y) < -0.5 ? Hu[2] : c));

    // Plate seams: two latitudes (straight) and two pairs of meridians (ellipses), dark groove + lit wall.
    const seamH = cv.mask().rect(0, CY - 72, W, 1).or(cv.mask().rect(0, CY + 72, W, 1)).and(sph.erode(2));
    let seamV = cv.mask();
    for (const th of [40, 70]) {
      const rx = Math.round(R * Math.sin((th * Math.PI) / 180));
      seamV = seamV.or(cv.mask().oval(CX - rx, CY - R, 2 * rx + 1, 2 * R + 1).edge());
    }
    seamV = seamV.and(sph.erode(2)).and(cv.mask().rect(0, CY - 94, W, 188));
    cv.fill(seamV, (x, y, c) => cv.step(c, -2));
    cv.fill(seamV.shift(1, 0).sub(seamV), (x, y, c) => cv.step(c, 1));
    cv.fill(seamH, (x, y, c) => cv.step(c, -2));
    cv.fill(seamH.shift(0, 1).sub(seamH).sub(seamV), (x, y, c) => cv.step(c, 1));
    const rivet = (x, y) => {
      const c = cv.get(x, y);
      if (!c || Hu.indexOf(c) < 0 || !sph.erode(3).has(x, y)) return;
      cv.set(x, y, cv.step(c, 2)).set(x + 1, y, cv.step(c, 1)).set(x, y + 1, cv.step(c, 1)).set(x + 1, y + 1, c);
      cv.set(x + 2, y + 1, cv.step(c, -1)).set(x + 1, y + 2, cv.step(c, -1)).set(x + 2, y + 2, cv.step(c, -1));
    };
    for (let x = 36; x < W - 36; x += 9) { rivet(x, CY - 76); rivet(x + 4, CY + 74); }
    for (const th of [40, 70]) {
      const rx = R * Math.sin((th * Math.PI) / 180);
      for (let y = CY - 86; y <= CY + 86; y += 11) {
        const xr = Math.sqrt(Math.max(0, 1 - ((y - CY) / R) ** 2)) * rx;
        rivet(Math.round(CX + xr) + 2, y); rivet(Math.round(CX - xr) - 3, y);
      }
    }

    // Hatch and cable on top, vent pipe upper-right.
    part(cv, cv.mask().rrect(115, 8, 26, 12, 2), Hu, { top: [6], left: [5], bottom: [1], right: [2], fill: 4, dx: 2, dy: 2 });
    cv.rect(119, 12, 18, 1, Hu[2]).rect(119, 13, 18, 1, Hu[5]);
    part(cv, cv.mask().rrect(111, 3, 34, 6, 2), Br, { top: [5], left: [4], bottom: [1], right: [2], fill: 3, dx: 2, dy: 2 });
    for (const x of [115, 122, 129, 136]) cv.set(x, 5, Br[1]).set(x + 1, 5, Br[0]).set(x, 6, Br[4]);
    cv.rect(127, 0, 2, 3, Hu[1]).rect(127, 0, 1, 3, Hu[3]);
    const vent = cv.mask().rrect(171, 24, 7, 12, 1).or(cv.mask().rrect(169, 22, 11, 4, 1));
    part(cv, vent, Hu, { top: [5], left: [4], bottom: [0], right: [1], fill: 3, dx: 2, dy: 2 });
    cv.rect(171, 23, 7, 1, INK).rect(172, 23, 5, 1, Wa[0]);

    // Pressure gauge on a short brass pipe, upper-left.
    const gx = 100, gy = 40;
    part(cv, cv.mask().rect(gx - 1, gy + 8, 3, 13), Br, { top: [4], left: [4], bottom: [1], right: [1], fill: 3, dx: 2, dy: 2 });
    part(cv, cv.mask().rect(gx - 3, gy + 12, 7, 3), Br, { top: [5], left: [4], bottom: [1], right: [2], fill: 3, shadow: false });
    part(cv, cv.mask().circle(gx, gy, 9), Br, { top: [5], left: [4], bottom: [1], right: [2], fill: 3, dx: 2, dy: 2 });
    const dial = cv.mask().circle(gx, gy, 6);
    cv.fill(dial, Cr[2]).fill(dial.edge(), Cr[1]).fill(dial.edge().and(cv.mask().rect(0, 0, W, gy - 2)), Cr[0]);
    for (let a = -160; a <= -20; a += 35) cv.set(Math.round(gx + Math.cos((a * Math.PI) / 180) * 4.4), Math.round(gy + Math.sin((a * Math.PI) / 180) * 4.4), a > -40 ? Sf[2] : Cr[0]);
    cv.fill(cv.mask().line(gx, gy, gx + 2, gy - 4), Sf[1]);
    cv.set(gx, gy, INK);

    // ---- brass porthole collar with slotted screws, then the recessed steel reveal -------------------
    const col = cv.mask().rrect(hx - 14, hy - 14, hw + 28, hh + 28, HR + 14);
    part(cv, col, Br, { top: [5, 4], left: [4], bottom: [0, 1], right: [1], fill: 3, dx: 3, dy: 3 });
    const bez = cv.mask().rrect(hx - 7, hy - 7, hw + 14, hh + 14, HR + 7);
    cv.shade(bez, Br, { top: [1], left: [1], bottom: [5], right: [4], fill: 2 });
    cv.fill(bez.sub(cv.mask().rrect(hx - 5, hy - 5, hw + 10, hh + 10, HR + 5)).sub(bez.edge()), Br[3]);
    inset(cv, ...HOLE, HR, { rim: INK, top: Hu[0], left: Hu[1], bottom: Hu[3], right: Hu[2] }, 3);
    const SC = [Br[0], Br[1], Br[3], Br[5]];
    for (let k = 0; k < 5; k++) { screw(cv, hx + 8 + k * 27, hy - 13, SC); screw(cv, hx + 8 + k * 27, hy + hh + 8, SC); }
    for (let k = 0; k < 4; k++) { screw(cv, hx - 13, hy + 10 + k * 24, SC); screw(cv, hx + hw + 8, hy + 10 + k * 24, SC); }

    // Brand plate under the porthole.
    const plate = cv.mask().rrect(110, 197, 36, 9, 1);
    part(cv, plate, Br, { top: [5], left: [4], bottom: [1], right: [2], fill: 3, dx: 2, dy: 2 });
    cv.text('KAYBORO', 128, 199, Br[0], { align: 'center' });
    cv.text('KAYBORO', 128, 198, Br[5], { align: 'center' });
    cv.text('KAYBORO', 128, 199, Br[0], { align: 'center' });

    // ---- octopus peeking from the lower-right, one tentacle wrapping up the hull ----------------------
    const head = cv.mask().circle(244, 198, 14).or(cv.mask().oval(231, 199, 31, 17));
    part(cv, head, Oc, { top: [5], left: [4], bottom: [1], right: [2], fill: 3, dx: 2, dy: 2 });
    for (const [dx, dy] of [[-5, -8], [1, -11], [7, -6], [-9, -3]]) cv.set(244 + dx, 198 + dy, Oc[4]);
    for (const ex of [235, 247]) {
      cv.fill(cv.mask().oval(ex, 193, 6, 7), '#ffffff');
      cv.rect(ex + 2, 195, 2, 3, INK).set(ex + 1, 194, '#ffffff');
    }
    cv.set(242, 204, INK).set(243, 205, INK).set(244, 205, INK).set(245, 204, INK);
    cv.rect(233, 202, 2, 1, Je[3]).rect(253, 202, 2, 1, Je[3]);
    const arm2 = cv.mask();
    spline([[250, 212], [257, 209], [263, 213]]).forEach(([x, y], i, a) => arm2.circle(Math.round(x), Math.round(y), lerp(4, 2.5, i / (a.length - 1)), 1.05));
    part(cv, arm2.sub(head), Oc, { top: [4], left: [3], bottom: [1], right: [2], fill: 2, dx: 2, dy: 2 });
    const P = spline([[232, 212], [226, 203], [224, 184], [225, 160], [228, 136], [233, 114], [229, 96], [218, 90], [210, 96], [213, 104], [220, 104]]);
    const ten = cv.mask();
    P.forEach(([x, y], i) => ten.circle(Math.round(x), Math.round(y), lerp(6.4, 1.6, i / (P.length - 1)), 1.05));
    part(cv, ten, Oc, { top: [5], left: [4], bottom: [1], right: [2], fill: 3, dx: 2, dy: 2 });
    for (let i = 3; i < P.length * 0.8; i += 6) {
      const [x, y] = P[i], [qx, qy] = P[i + 1], d = Math.hypot(qx - x, qy - y) || 1;
      let nx = -(qy - y) / d, ny = (qx - x) / d;
      if (nx > 0) { nx = -nx; ny = -ny; }
      const r = lerp(6.4, 1.6, i / (P.length - 1)), sx = Math.round(x + nx * r * 0.5), sy = Math.round(y + ny * r * 0.5);
      if (ten.erode(1).has(sx, sy) && ten.erode(1).has(sx + 1, sy + 1)) cv.rect(sx, sy, 2, 2, Oc[5]).set(sx + 1, sy + 1, Oc[1]);
    }

    // ---- sea floor: sand with a lit lip, ripples, pebbles, a soft shadow under the sphere -------------
    const top = (x) => 216 + Math.round(Math.sin(x * 0.05) * 2 + Math.sin(x * 0.13 + 1) * 1.5);
    const floor = cv.mask().plot((x, y) => y >= top(x), 0, 206, W, H).and(all);
    cv.fill(floor, (x, y) => Sa[clamp(level([[0, 3.6], [0.25, 2.8], [0.65, 1.6], [1, 0.6]], (y - 212) / 44, x, y), 0, 5)]);
    cv.fill(floor.sub(floor.shift(0, 1)), Sa[4]);
    const shadow = (x, y, w, h) => {
      cv.tone(cv.mask().oval(x, y, w, h).and(floor), -1);
    };
    shadow(CX - 84, 212, 168, 22);
    shadow(226, 208, 40, 14);
    // Sparse grains instead of random speckle.
    for (const [x, y] of [[14, 226], [38, 244], [72, 236], [96, 228], [126, 234], [146, 246], [196, 232], [226, 250], [248, 230], [10, 250], [168, 224]]) cv.set(x, y, cv.step(cv.get(x, y), 1)).set(x + 1, y + 1, cv.step(cv.get(x + 1, y + 1), -1));
    for (const [x, y, w] of [[30, 230, 6], [120, 244, 8], [182, 248, 6], [60, 250, 5], [214, 238, 7]]) cv.rect(x, y, w, 1, Sa[1]).rect(x + 1, y + 1, w - 2, 1, Sa[0]);
    for (const [x, y] of [[48, 236], [134, 238], [238, 246], [20, 248], [160, 250]]) sprite(cv, x, y, ['.ab', 'abb'], { a: Sa[5], b: Sa[2] });

    // ---- coral, urchins, starfish, anemone -----------------------------------------------------------
    for (const [x, y, a, l, r, d, Rm] of [[18, 218, -1.75, 13, 2.4, 3, Co], [202, 222, -1.62, 10, 2, 3, Co2], [82, 230, -1.6, 6, 1.4, 2, Co2]]) {
      const m = coral(cv, x, y, a, l, r, d, rnd);
      part(cv, m, Rm, { top: [4], left: [3], bottom: [1], right: [1], fill: 2, dx: 1, dy: 2 });
      m.sub(m.shift(0, 1)).each((px, py) => { if (rnd() < 0.5) cv.set(px, py, Rm[4]); });
    }
    for (const [x, y, r] of [[58, 238, 5], [100, 242, 4], [206, 244, 4]]) {
      const b = cv.mask().circle(x, y, r);
      for (let a = 0; a < 16; a++) {
        const t = (a / 16) * Math.PI * 2 + 0.2, l = r + 2 + (a % 2) * 2;
        cv.fill(cv.mask().line(Math.round(x + Math.cos(t) * (r - 1)), Math.round(y + Math.sin(t) * (r - 1)), Math.round(x + Math.cos(t) * l), Math.round(y + Math.sin(t) * l)), a < 8 && a > 2 ? Ur[3] : Ur[2]);
      }
      part(cv, b, Ur, { top: [3], left: [2], bottom: [0], right: [1], fill: 1, dx: 1, dy: 1 });
      cv.set(x - 1, y - 1, Ur[3]);
    }
    const star = ['.....a.....', '....aaa....', '....aaa....', 'aa..aaa..aa', '.aaaaaaaaa.', '..aaaaaaa..', '...aaaaa...', '..aaaaaaa..', '..aaa.aaa..', '.aaa...aaa.', 'aa.......aa'];
    const sm = spriteMask(cv, 172, 230, star);
    part(cv, sm, Sf, { top: [4], left: [3], bottom: [1], right: [1], fill: 2, dx: 1, dy: 1 });
    for (const [dx, dy] of [[5, 3], [5, 6], [3, 5], [7, 5], [2, 8], [8, 8], [5, 1]]) cv.set(172 + dx, 230 + dy, Sf[4]);
    cv.set(176, 234, INK).set(178, 234, INK).set(177, 236, Sf[0]);
    const ax = 150, ay = 230;
    part(cv, cv.mask().oval(ax - 6, ay - 3, 13, 6), Cy, { top: [2], left: [2], bottom: [0], right: [0], fill: 1, dx: 1, dy: 1 });
    for (let i = -5; i <= 5; i += 2) {
      const len = 6 + ((i + 7) % 3) * 2, m = cv.mask();
      for (let j = 1; j <= len; j++) m.put(ax + i + Math.round(Math.sin(j * 0.7 + i) * 1.2), ay - 2 - j);
      cv.fill(m, Cy[2]);
      const [tx, ty] = [ax + i + Math.round(Math.sin(len * 0.7 + i) * 1.2), ay - 2 - len];
      cv.set(tx, ty, Cy[3]).set(tx, ty - 1, Cy[4]);
    }

    // ---- anglerfish in the lower-left, lure lamp lighting the hull and floor ------------------------
    const fx = 24, fy = 160;
    const body = cv.mask().oval(fx - 14, fy - 10, 30, 20, 1.02).or(cv.mask().poly([[fx - 12, fy], [fx - 22, fy - 8], [fx - 22, fy + 8]]));
    const fin = cv.mask().poly([[fx - 2, fy - 9], [fx + 2, fy - 15], [fx + 7, fy - 9]]).or(cv.mask().poly([[fx - 2, fy + 9], [fx + 1, fy + 14], [fx + 6, fy + 9]]));
    const lureStalk = spline([[fx + 2, fy - 10], [fx + 8, fy - 17], [fx + 18, fy - 17], [fx + 22, fy - 13]]);
    part(cv, body.or(fin), An, { top: [5], left: [4], bottom: [1], right: [2], fill: 3, dx: 2, dy: 2 });
    cv.fill(fin.sub(body), (x, y) => ((x + y) % 2 ? An[2] : An[3]));
    cv.fill(cv.mask().oval(fx - 8, fy + 1, 22, 9).and(body), (x, y) => (bayer(x, y) < 0.5 ? An[4] : An[5]));
    cv.fill(cv.mask().line(fx - 4, fy + 2, fx + 13, fy + 1), INK);
    cv.set(fx + 14, fy, INK).set(fx + 2, fy + 3, '#ffffff').set(fx + 9, fy + 2, '#ffffff');
    cv.fill(cv.mask().oval(fx + 4, fy - 8, 8, 8), '#ffffff');
    cv.rect(fx + 8, fy - 6, 3, 4, INK).set(fx + 8, fy - 6, '#ffffff');
    cv.set(fx + 3, fy - 2, Je[3]).set(fx + 4, fy - 2, Je[3]);
    cv.fill(cv.mask().oval(fx - 2, fy - 4, 7, 5).and(body), An[2]);
    lureStalk.forEach(([x, y]) => cv.set(Math.round(x), Math.round(y), An[5]));
    const lux = fx + 23, luy = fy - 11;
    const lamp = (cx, cy, r, colr, k) => cv.fill(cv.mask().circle(cx, cy, r), (x, y, c) => {
      if (!c || c === INK) return c;
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy) / r;
      if (d >= 1) return c;
      const s = (1 - d) ** 1.5 * k, n = Math.floor(s), q = n + (clamp((s - n - 0.5) / 0.4 + 0.5, 0, 1) > B2(x, y) ? 1 : 0);
      return q >= 2 ? mix(cv.step(c, 1), colr, 0.4) : q ? cv.step(c, 1) : c;
    });
    lamp(lux, luy, 30, Cy[3], 2.4);
    cv.fill(cv.mask().circle(lux, luy, 3), Cy[2]).fill(cv.mask().circle(lux, luy, 2), Cy[3]).fill(cv.mask().circle(lux, luy, 1), Cy[4]).set(lux, luy, CORE);
    for (const [dx, dy] of [[0, -5], [0, 5], [-5, 0], [5, 0]]) cv.set(lux + dx, luy + dy, Cy[3]);

    // ---- jellyfish (base frame; the pulse frame lives on a layer) -----------------------------------
    const JELLY = [[218, 48, 16], [158, 12, 10]];
    const base = cv.p.slice();
    const jl = cv.layer('jl');
    for (const [x, y, w] of JELLY) {
      const a = jelly(cv, x, y, w, 0);
      const region = a.dilate(2);
      jl.fill(region, (px, py) => base[py * W + px]);
      jelly(jl, x, y, w, 1);
    }

    cv.outline(INK);

    // ---- animation layers: lure pulse, bubbles rising in three phases --------------------------------
    const lu = cv.layer('lu');
    lu.fill(cv.mask().circle(lux, luy, 3), Cy[3]).fill(cv.mask().circle(lux, luy, 1), Cy[4]).set(lux, luy, CORE);
    for (const [dx, dy] of [[0, -6], [0, 6], [-6, 0], [6, 0], [0, -5], [0, 5], [-5, 0], [5, 0]]) lu.set(lux + dx, luy + dy, Cy[4]);
    const bub = (l, x, y, big) => {
      if (big) sprite(l, x - 2, y - 2, ['.aaa.', 'a...a', 'a...a', 'a...a', '.aaa.'], { a: Cy[3] }).set(x - 1, y - 1, CORE);
      else sprite(l, x - 1, y - 1, ['.a.', 'a.a', '.a.'], { a: Cy[3] }).set(x - 1, y - 1, Cy[4]);
    };
    const B = [cv.layer('b0'), cv.layer('b1'), cv.layer('b2')];
    const column = (x0, y0, y1, wob) => {
      for (let k = 0; ; k++) {
        const y = y0 - k * 24;
        if (y < y1) break;
        B.forEach((l, j) => {
          const yy = y - j * 8;
          if (yy < y1 || yy > y0) return;
          bub(l, x0 + Math.round(Math.sin((yy + wob) * 0.35) * 2), yy, (y0 - yy) > 40 && (k + j) % 2 === 0);
        });
      }
    };
    column(175, 20, 2, 0);
    column(fx + 15, fy - 2, 24, 3);
    column(246, 180, 110, 5);

    return cv.punch(...HOLE, HR);
  },
};
