'use strict';
// Starter "Pocket Brick": a chunky portrait pocket console with a domed "tombstone" top and two
// chamfered bottom corners, moulded in sea-glass jade plastic. The screen sits in an arched plum
// plate that echoes the dome, with an amber power LED, a battery gauge and a column of embossed moon
// phases. Below it a cream jog dial (a ridged disc with an off-centre thumb dimple) faces a crescent
// of three apricot gem keys; two little slider switches, a knurled rotary knob, a sunrise fan of
// speaker slots, a scroll wheel on the right edge, a toggle lever on the dome, a sleepy-moon sticker
// and a star charm on a cord. Top-left key light, cool mint rim light, anime corner glare and round
// glints. Original artwork, no marks, logos or text.
const L = require('../lib');
const { rr, path, g, lg, rg, circle, ellipse, sparkle, star, n, P } = L;

const W = 1000, H = 1600, CX = 500;
const INK = '#1d3638';
const hole = { x: 240, y: 256, w: 520, h: 468 }, radius = 8; // 10:9

// Body: sides x 70..930, a shallow dome (circle centred at DOME, radius 532 => top at y 64), bottom
// y 1510 with chamfered corners. The screen plate is a concentric dome of radius 480.
const DOME = [500, 596];
const BODY = { xl: 70, xr: 930, R: 532, yb: 1510, c: 112 };
const PLATE = { xl: 140, xr: 860, R: 480, yb: 812, r: 46 };
const DIAL = [270, 1040], ARC_R = 432, GEMS = [-20, 0, 20], SLIDERS = [[414, 1300, 0], [586, 1300, 1]], KNOB = [814, 1318];
const SUN = [500, 1470];

const rad = (a) => (a * Math.PI) / 180;
const domeY = (R, x) => DOME[1] - Math.sqrt(R * R - (x - DOME[0]) ** 2);
const onArc = (c, R, a) => [c[0] + R * Math.cos(rad(a)), c[1] + R * Math.sin(rad(a))];

/** Body outline inset by i: dome top with soft shoulders, straight sides, chamfered bottom corners. */
function bodyD(i = 0) {
  const xl = BODY.xl + i, xr = BODY.xr - i, R = BODY.R - i, yb = BODY.yb - i, c = BODY.c - i * 0.41, f = 38, t = 16, k = t * Math.SQRT1_2;
  const ys = domeY(R, xl), ya = domeY(R, xl + f);
  return `M${P(xl, ys + f)}Q${P(xl, ys, xl + f, ya)}A${P(R, R)} 0 0 1 ${P(xr - f, ya)}Q${P(xr, ys, xr, ys + f)}`
    + `V${n(yb - c - t)}Q${P(xr, yb - c, xr - k, yb - c + k)}L${P(xr - c + k, yb - k)}Q${P(xr - c, yb, xr - c - t, yb)}`
    + `H${n(xl + c + t)}Q${P(xl + c, yb, xl + c - k, yb - k)}L${P(xl + k, yb - c + k)}Q${P(xl, yb - c, xl, yb - c - t)}Z`;
}

/** Screen plate outline inset by i: concentric dome over rounded bottom corners. */
function plateD(i = 0) {
  const xl = PLATE.xl + i, xr = PLATE.xr - i, R = PLATE.R - i, yb = PLATE.yb - i, r = PLATE.r - i, f = 30;
  const ys = domeY(R, xl), ya = domeY(R, xl + f);
  return `M${P(xl, ys + f)}Q${P(xl, ys, xl + f, ya)}A${P(R, R)} 0 0 1 ${P(xr - f, ya)}Q${P(xr, ys, xr, ys + f)}`
    + `V${n(yb - r)}A${P(r, r)} 0 0 1 ${P(xr - r, yb)}H${n(xl + r)}A${P(r, r)} 0 0 1 ${P(xl, yb - r)}Z`;
}

/** Tapered band hugging a circle of radius R (centre c) from angle a0 to a1: outer edge at R, swelling to t. */
function arcBand(c, R, a0, a1, t, pow = 1, steps = 40) {
  const outer = [], inner = [];
  for (let s = 0; s <= steps; s++) {
    const u = s / steps, a = a0 + (a1 - a0) * u, w = t * Math.pow(Math.sin(Math.PI * u), pow);
    outer.push(onArc(c, R, a)); inner.push(onArc(c, R - w, a));
  }
  return `M${outer.map((p) => P(...p)).join('L')}L${inner.reverse().map((p) => P(...p)).join('L')}Z`;
}

/** Crescent inside a circle: outer arc on radius r from angle a0 to a1 (deg), t thick at the middle. */
function moon(cx, cy, r, a0, a1, t) {
  const p = (a) => [cx + r * Math.cos(rad(a)), cy + r * Math.sin(rad(a))];
  const half = rad(a1 - a0) / 2, ch = 2 * r * Math.sin(half), s1 = r - r * Math.cos(half), s2 = Math.max(0.5, s1 - t);
  const R = (ch * ch / 4 + s2 * s2) / (2 * s2);
  return `M${P(...p(a0))}A${P(r, r)} 0 0 1 ${P(...p(a1))}A${P(R, R)} 0 0 0 ${P(...p(a0))}Z`;
}

const drop = (d, extra = {}, off = [4, 11], a = 0.35) => path(d, { fill: INK, fillOpacity: a, transform: `translate(${off[0]} ${off[1]})`, ...extra });

// ---- parts behind the body ---------------------------------------------------------------------------
/** Ribbed scroll wheel peeking out of the right edge. */
function scrollWheel(x, y, h) {
  const ribs = Array.from({ length: Math.floor((h - 24) / 14) }, (_, i) => `M${x + 8} ${y + 16 + i * 14}H${x + 34}`).join('');
  return g({},
    path(rr(x, y, 40, h, 16), { fill: 'url(#pbMetal)', stroke: INK, strokeWidth: 5 }),
    path(ribs, { stroke: INK, strokeOpacity: 0.4, strokeWidth: 4, strokeLinecap: 'round' }),
    path(`M${x + 30} ${y + 18}V${y + h * 0.45}`, { stroke: '#fff', strokeOpacity: 0.75, strokeWidth: 4, strokeLinecap: 'round' }));
}

/** Toggle lever standing on the dome, flicked to one side. */
function lever() {
  const x = 708, y = domeY(BODY.R, x), ang = (Math.atan2(y - DOME[1], x - DOME[0]) * 180) / Math.PI + 90;
  return g({ transform: `translate(${n(x)} ${n(y)}) rotate(${n(ang)})` },
    path(rr(-40, -26, 80, 40, 14), { fill: 'url(#pbMetal)', stroke: INK, strokeWidth: 5 }),
    g({ transform: 'rotate(22 0 -14)' },
      path(rr(-9, -84, 18, 74, 9), { fill: 'url(#pbMetal)', stroke: INK, strokeWidth: 4.5 }),
      path(circle(0, -88, 19), { fill: 'url(#pbGemB)', stroke: INK, strokeWidth: 4.5 }),
      path(circle(-6, -94, 5), { fill: '#fff', fillOpacity: 0.9 })),
    path('M-28 -16H10', { stroke: '#fff', strokeOpacity: 0.8, strokeWidth: 4, strokeLinecap: 'round' }));
}

// ---- body details ------------------------------------------------------------------------------------
function plate() {
  const holeD = rr(hole.x, hole.y, hole.w, hole.h, radius);
  const ledX = (PLATE.xl + hole.x) / 2, ledY = 400, phX = (hole.x + hole.w + PLATE.xr) / 2;
  const chinY = (hole.y + hole.h + 16 + PLATE.yb) / 2;
  const phases = [0, 1, 2, 3].map((k) => {
    const y = 360 + k * 62, c = [phX, y];
    if (k === 0) return path(circle(...c, 13), { fill: 'none', stroke: '#c79ad0', strokeWidth: 3 });
    if (k === 3) return path(circle(...c, 13), { fill: '#ffe2b0' }) + path(circle(phX - 4, y - 4, 3.5), { fill: '#fff' });
    return path(circle(...c, 13), { fill: 'none', stroke: '#c79ad0', strokeWidth: 3 })
      + path(k === 1 ? moon(phX, y, 13, -80, 80, 7) : `M${phX} ${y - 13}A13 13 0 0 1 ${phX} ${y + 13}Z`, { fill: '#ffe2b0' });
  }).join('');
  return g({},
    drop(plateD(), {}, [4, 12], 0.32),
    path(plateD(), { fill: 'url(#pbPlateEdge)', stroke: INK, strokeWidth: 6 }),
    path(plateD(9), { fill: 'url(#pbPlate)' }),
    path(plateD(9), { fill: 'url(#pbPlateSheen)' }),
    // apricot inlay following the dome
    path(plateD(24).replace(/V[^A]*A.*$/, ''), { fill: 'none', stroke: '#ffb980', strokeOpacity: 0.85, strokeWidth: 4, strokeLinecap: 'round' }),
    path(circle(CX, domeY(PLATE.R - 24, CX), 7), { fill: '#ffd9a8', stroke: '#2a1730', strokeWidth: 2.5 }),
    // screen well
    path(rr(hole.x - 16, hole.y - 16, hole.w + 32, hole.h + 32, radius + 12), { fill: '#140b18', stroke: '#9a6aa6', strokeWidth: 3 }),
    [[8, 0.28], [3.5, 0.6]].map(([w, a]) => path(holeD, { fill: 'none', stroke: '#000', strokeWidth: w * 2, strokeOpacity: a })).join(''),
    // power LED and battery gauge (left margin), moon phases (right margin)
    path(circle(ledX, ledY, 30), { fill: 'url(#pbLedGlow)', class: 'pb-led' }),
    path(circle(ledX, ledY, 12), { fill: 'url(#pbLed)', stroke: '#2a1730', strokeWidth: 3 }),
    path(circle(ledX - 3.5, ledY - 4, 3.5), { fill: '#fff' }),
    path(rr(ledX - 10, ledY + 40, 20, 40, 5), { fill: 'none', stroke: '#c79ad0', strokeWidth: 3 }),
    path(rr(ledX - 4, ledY + 34, 8, 6, 1.5), { fill: '#c79ad0' }),
    path(rr(ledX - 5, ledY + 58, 10, 8, 1.5) + rr(ledX - 5, ledY + 68, 10, 8, 1.5), { fill: '#9ff0cf' }),
    phases,
    // chin: three candy dots
    path(circle(CX - 26, chinY, 6), { fill: '#ffb980' }), path(circle(CX, chinY, 6), { fill: '#fff1d6' }), path(circle(CX + 26, chinY, 6), { fill: '#9ff0cf' }),
    // key light on the plate dome, cool bounce bottom right
    path(arcBand(DOME, PLATE.R - 14, 208, 246, 7), { fill: '#fff', fillOpacity: 0.55 }),
    path(`M${PLATE.xr - 16} ${PLATE.yb - 150}V${PLATE.yb - PLATE.r}`, { stroke: '#c8fff0', strokeOpacity: 0.5, strokeWidth: 4, strokeLinecap: 'round' }));
}

/** Round jog dial: dished bezel, apricot ring, ridged cream disc with an off-centre thumb dimple. */
function jogDial() {
  const [cx, cy] = DIAL, ticks = [];
  for (let i = 0; i < 36; i++) {
    const a = rad(i * 10), r0 = 96, r1 = 106;
    ticks.push(`M${P(cx + r0 * Math.cos(a), cy + r0 * Math.sin(a))}L${P(cx + r1 * Math.cos(a), cy + r1 * Math.sin(a))}`);
  }
  const dots = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => { const a = rad(i * 45 - 90); return circle(cx + 140 * Math.cos(a), cy + 140 * Math.sin(a), i % 2 ? 3.5 : 5); }).join('');
  const dm = [cx - 40, cy - 36];
  return g({},
    path(circle(cx, cy, 152), { fill: 'url(#pbDish)' }),
    path(moon(cx, cy, 152, 20, 160, 5), { fill: '#fff', fillOpacity: 0.55 }),
    path(dots, { fill: INK, fillOpacity: 0.35 }),
    drop(circle(cx, cy, 120), {}, [4, 12], 0.38),
    path(circle(cx, cy, 120), { fill: 'url(#pbRing)', stroke: INK, strokeWidth: 6 }),
    path(circle(cx, cy, 106), { fill: 'url(#pbDisc)', stroke: INK, strokeWidth: 4 }),
    path(ticks.join(''), { stroke: '#b98f6a', strokeOpacity: 0.7, strokeWidth: 3.5, strokeLinecap: 'round' }),
    path(circle(cx, cy, 84), { fill: 'url(#pbDiscTop)' }),
    path(circle(cx, cy, 84), { fill: 'none', stroke: '#fff', strokeOpacity: 0.6, strokeWidth: 2.5, transform: 'translate(0 2)' }),
    // thumb dimple
    path(circle(dm[0], dm[1], 24), { fill: 'url(#pbDimple)' }),
    path(moon(dm[0], dm[1], 24, 20, 160, 4), { fill: '#fff', fillOpacity: 0.9 }),
    // highlights
    path(moon(cx, cy, 116, 196, 268, 12), { fill: '#fff', fillOpacity: 0.8 }),
    path(circle(cx + 52, cy + 50, 6), { fill: '#fff', fillOpacity: 0.7 }));
}

/** A faceted gem key (rounded lozenge) pointing at the dial. */
function gem(c, ang, grad) {
  const [x, y] = c, h = 60, w = 46;
  const d = `M0 ${-h}Q${n(w * 0.32)} ${n(-h * 0.96)} ${w} ${n(-h * 0.28)}Q${n(w * 1.08)} 0 ${w} ${n(h * 0.28)}Q${n(w * 0.32)} ${n(h * 0.96)} 0 ${h}`
    + `Q${n(-w * 0.32)} ${n(h * 0.96)} ${-w} ${n(h * 0.28)}Q${n(-w * 1.08)} 0 ${-w} ${n(-h * 0.28)}Q${n(-w * 0.32)} ${n(-h * 0.96)} 0 ${-h}Z`;
  const table = `M0 ${n(-h * 0.5)}L${n(w * 0.5)} ${n(-h * 0.12)}L${n(w * 0.5)} ${n(h * 0.12)}L0 ${n(h * 0.5)}L${n(-w * 0.5)} ${n(h * 0.12)}L${n(-w * 0.5)} ${n(-h * 0.12)}Z`;
  return g({ transform: `translate(${n(x)} ${n(y)})` },
    path(d, { fill: INK, fillOpacity: 0.38, transform: `translate(4 11) rotate(${n(ang)})` }),
    g({ transform: `rotate(${n(ang)})` },
      path(d, { fill: `url(#${grad})`, stroke: INK, strokeWidth: 5.5, strokeLinejoin: 'round' }),
      path(table, { fill: '#fff', fillOpacity: 0.22, stroke: '#fff', strokeOpacity: 0.5, strokeWidth: 2, strokeLinejoin: 'round' }),
      path(`M${n(-w * 0.5)} ${n(-h * 0.12)}L${n(-w * 0.86)} ${n(-h * 0.3)}M${n(w * 0.5)} ${n(h * 0.12)}L${n(w * 0.86)} ${n(h * 0.3)}`, { stroke: '#fff', strokeOpacity: 0.35, strokeWidth: 2 })),
    path(`M${n(-w * 0.62)} ${n(-h * 0.2)}Q${n(-w * 0.5)} ${n(-h * 0.62)} ${n(-w * 0.1)} ${n(-h * 0.76)}`, { fill: 'none', stroke: '#fff', strokeOpacity: 0.95, strokeWidth: 6, strokeLinecap: 'round' }),
    path(sparkle(w * 0.36, h * 0.36, 9), { fill: '#fff', fillOpacity: 0.85 }));
}

/** Three gem keys on a crescent concentric with the jog dial. */
function crescentKeys(part) {
  // a crescent-shaped well (drawn under the plate), concentric with the dial and tapering to points
  const Ro = ARC_R + 66, well = arcBand(DIAL, Ro, -33, 33, 150, 0.5, 60);
  if (part === 'well') return g({},
    path(well, { fill: INK, fillOpacity: 0.12, stroke: INK, strokeOpacity: 0.2, strokeWidth: 3, strokeLinejoin: 'round' }),
    path(arcBand(DIAL, Ro - 10, -28, 28, 60, 0.7, 48), { fill: INK, fillOpacity: 0.08 }),
    path(arcBand(DIAL, Ro - 4, -25, 25, 5), { fill: '#fff', fillOpacity: 0.6 }));
  return g({},
    GEMS.map((a, i) => gem(onArc(DIAL, ARC_R, a), a + 90, ['pbGemA', 'pbGemB', 'pbGemC'][i])).join(''));
}

/** Two little slider switches (knob left / knob right). */
function sliders() {
  return SLIDERS.map(([x, y, on]) => {
    const kx = x + (on ? 26 : -26);
    return path(rr(x - 70, y - 26, 140, 52, 26), { fill: 'url(#pbDish)' })
      + path(rr(x - 56, y - 10, 112, 20, 10), { fill: '#16282a', stroke: INK, strokeWidth: 3 })
      + path(`M${x - 46} ${y + 7}H${x + 46}`, { stroke: '#fff', strokeOpacity: 0.35, strokeWidth: 2.5, strokeLinecap: 'round' })
      + drop(rr(kx - 26, y - 22, 52, 44, 14), {}, [3, 8], 0.38)
      + path(rr(kx - 26, y - 22, 52, 44, 14), { fill: 'url(#pbKnob)', stroke: INK, strokeWidth: 5 })
      + path(`M${kx - 8} ${y - 10}V${y + 10}M${kx} ${y - 10}V${y + 10}M${kx + 8} ${y - 10}V${y + 10}`, { stroke: '#b98f6a', strokeWidth: 3, strokeLinecap: 'round' })
      + path(`M${kx - 16} ${y - 14}H${kx + 4}`, { stroke: '#fff', strokeOpacity: 0.9, strokeWidth: 4, strokeLinecap: 'round' })
      + path(circle(x + (on ? -50 : 50), y - 36, 5), { fill: on ? '#9ff0cf' : INK, fillOpacity: on ? 1 : 0.3 });
  }).join('');
}

/** Small knurled rotary knob with a pointer and a tick arc. */
function rotaryKnob() {
  const [cx, cy] = KNOB, knurl = [], ticks = [];
  for (let i = 0; i < 20; i++) { const a = rad(i * 18); knurl.push(`M${P(cx + 34 * Math.cos(a), cy + 34 * Math.sin(a))}L${P(cx + 42 * Math.cos(a), cy + 42 * Math.sin(a))}`); }
  for (let i = 0; i <= 6; i++) { const a = rad(140 + i * 43.3); ticks.push(circle(cx + 60 * Math.cos(a), cy + 60 * Math.sin(a), i === 6 ? 5 : 3)); }
  const pa = rad(-58);
  return g({},
    path(circle(cx, cy, 70), { fill: 'url(#pbDish)' }),
    path(ticks.join(''), { fill: INK, fillOpacity: 0.45 }),
    drop(circle(cx, cy, 44), {}, [3, 10], 0.38),
    path(circle(cx, cy, 44), { fill: 'url(#pbMetal)', stroke: INK, strokeWidth: 5 }),
    path(knurl.join(''), { stroke: INK, strokeOpacity: 0.35, strokeWidth: 3 }),
    path(circle(cx, cy, 30), { fill: 'url(#pbKnobTop)', stroke: INK, strokeWidth: 3 }),
    path(`M${P(cx + 8 * Math.cos(pa), cy + 8 * Math.sin(pa))}L${P(cx + 24 * Math.cos(pa), cy + 24 * Math.sin(pa))}`, { stroke: '#ff8a5c', strokeWidth: 6, strokeLinecap: 'round' }),
    path(moon(cx, cy, 28, 196, 268, 6), { fill: '#fff', fillOpacity: 0.85 }));
}

/** Sunrise fan of speaker slots at the bottom centre. */
function speaker() {
  const [cx, cy] = SUN, out = [], hi = [];
  for (let i = 0; i < 9; i++) {
    const a = 180 + 12 + i * 19.5, r0 = 58, r1 = i % 2 ? 122 : 140, ar = rad(a);
    const p0 = [cx + r0 * Math.cos(ar), cy + r0 * Math.sin(ar)], p1 = [cx + r1 * Math.cos(ar), cy + r1 * Math.sin(ar)];
    out.push(`M${P(...p0)}L${P(...p1)}`);
    hi.push(`M${P(p0[0] + 2, p0[1] + 6)}L${P(p0[0] + 2 + 10 * Math.cos(ar), p0[1] + 6 + 10 * Math.sin(ar))}`);
  }
  return g({},
    path(out.join(''), { stroke: '#132527', strokeOpacity: 0.78, strokeWidth: 18, strokeLinecap: 'round' }),
    path(hi.join(''), { stroke: '#fff', strokeOpacity: 0.3, strokeWidth: 3.5, strokeLinecap: 'round' }),
    path(`M${cx - 38} ${cy}A38 38 0 0 1 ${cx + 38} ${cy}Z`, { fill: 'url(#pbSun)', stroke: INK, strokeWidth: 4, strokeLinejoin: 'round' }),
    path(`M${cx - 24} ${cy - 12}A30 30 0 0 1 ${cx - 6} ${cy - 28}`, { fill: 'none', stroke: '#fff', strokeOpacity: 0.9, strokeWidth: 4, strokeLinecap: 'round' }));
}

/** Die-cut sticker: a sleepy crescent moon with a tiny star. */
function sticker(cx, cy, deg) {
  const d = 'M18 -56A58 58 0 1 0 50 34A46 46 0 1 1 18 -56Z';
  return g({ transform: `translate(${cx} ${cy}) rotate(${deg})` },
    path(d, { fill: INK, fillOpacity: 0.3, stroke: INK, strokeOpacity: 0.3, strokeWidth: 22, strokeLinejoin: 'round', transform: 'translate(3 6)' }),
    path(d, { fill: '#fff', stroke: '#fff', strokeWidth: 20, strokeLinejoin: 'round' }),
    path(d, { fill: 'url(#pbMoon)', stroke: '#d98a3c', strokeWidth: 3, strokeLinejoin: 'round' }),
    path('M-36 -6Q-30 0 -24 -6M-20 8Q-14 14 -8 8', { fill: 'none', stroke: '#6b3a12', strokeWidth: 3.5, strokeLinecap: 'round' }),
    path(ellipse(-38, 10, 6, 3.5), { fill: '#ff8fab', fillOpacity: 0.8 }),
    path('M-26 -34Q-16 -44 -2 -46', { fill: 'none', stroke: '#fff', strokeOpacity: 0.9, strokeWidth: 5, strokeLinecap: 'round' }),
    path(star(36, -32, 13, 5.5), { fill: '#fff6c9', stroke: '#d98a3c', strokeWidth: 2.5, strokeLinejoin: 'round' }));
}

/** Eyelet on the bottom-left chamfer with a star charm on a short cord. */
function charm() {
  const e = [126, 1446], c = [100, 1552];
  return g({},
    path(`M${e[0]} ${e[1]}C${e[0] - 30} ${e[1] + 30} ${c[0] - 10} ${c[1] - 60} ${c[0]} ${c[1] - 20}`, { fill: 'none', stroke: INK, strokeWidth: 9, strokeLinecap: 'round' }),
    path(`M${e[0]} ${e[1]}C${e[0] - 30} ${e[1] + 30} ${c[0] - 10} ${c[1] - 60} ${c[0]} ${c[1] - 20}`, { fill: 'none', stroke: '#ffb980', strokeWidth: 4.5, strokeLinecap: 'round' }),
    path(star(c[0] + 3, c[1] + 6, 30, 13), { fill: INK, fillOpacity: 0.3 }),
    path(star(c[0], c[1], 30, 13), { fill: 'url(#pbCharm)', stroke: INK, strokeWidth: 4, strokeLinejoin: 'round' }),
    path('M-8 -14L-3 -22', { stroke: '#fff', strokeWidth: 4, strokeLinecap: 'round', transform: `translate(${c[0]} ${c[1]})` }));
}

function eyelet() {
  return path(circle(126, 1446, 13), { fill: 'url(#pbMetal)', stroke: INK, strokeWidth: 4 }) + path(circle(126, 1446, 5), { fill: '#132527' });
}

function draw() {
  const B = bodyD();
  const defs = [
    lg('pbBody', [0, 0, 1, 1], [[0, '#d9fbec'], [0.14, '#9fe3cb'], [0.5, '#62bfa6'], [0.85, '#3f9a88'], [1, '#2f7e72']]),
    lg('pbSide', [0, 0, 1, 1], [[0, '#2f7e72'], [1, '#1c514b']]),
    lg('pbSatin', [0, 0, 1, 0], [[0, '#fff', 0], [0.35, '#fff', 0.28], [1, '#fff', 0]]),
    lg('pbShade', [0, 0, 0, 1], [[0, '#fff', 0.3], [0.08, '#fff', 0.04], [0.6, '#fff', 0], [0.86, '#123c3a', 0.1], [1, '#123c3a', 0.28]]),
    lg('pbRim', [70, 64, 930, 1510], [[0, '#c8fff0', 0], [0.6, '#c8fff0', 0], [0.86, '#c8fff0', 0.75], [1, '#f0fffa', 1]], true),
    lg('pbKey', [70, 64, 930, 1510], [[0, '#fff', 0.9], [0.25, '#fff', 0.3], [0.4, '#fff', 0]], true),
    lg('pbPlateEdge', [0, 0, 1, 1], [[0, '#9a6aa6'], [0.5, '#5a3566'], [1, '#33193c']]),
    lg('pbPlate', [0, 0, 0, 1], [[0, '#5e3a69'], [1, '#3e2247']]),
    lg('pbPlateSheen', [0, 0, 1, 1], [[0.15, '#ffd2b0', 0], [0.4, '#ffd2b0', 0.14], [0.55, '#c8fff0', 0.08], [0.8, '#c8fff0', 0]]),
    rg('pbDish', [0.5, 0.62, 0.6], [[0, '#123c3a', 0.04], [0.75, '#123c3a', 0.14], [1, '#123c3a', 0.26]]),
    lg('pbRing', [0, 0, 1, 1], [[0, '#ffd6a8'], [0.5, '#ff9e66'], [1, '#d4683a']]),
    rg('pbDisc', [0.4, 0.32, 0.8], [[0, '#fffaf0'], [0.6, '#f4e6cf'], [1, '#d9c2a0']]),
    rg('pbDiscTop', [0.38, 0.3, 0.8], [[0, '#ffffff'], [0.7, '#fbf1e0'], [1, '#ead6b6']]),
    rg('pbDimple', [0.5, 0.65, 0.6], [[0, '#c9ae86'], [0.8, '#e2cba6'], [1, '#f6ead6']]),
    rg('pbGemA', [0.36, 0.3, 0.85], [[0, '#fff1dc'], [0.45, '#ffc07a'], [1, '#e07a2c']]),
    rg('pbGemB', [0.36, 0.3, 0.85], [[0, '#ffe6dc'], [0.45, '#ff8f6b'], [1, '#d24a3a']]),
    rg('pbGemC', [0.36, 0.3, 0.85], [[0, '#ffe8ef'], [0.45, '#ff8fae'], [1, '#c8486e']]),
    lg('pbKnob', [0, 0, 0, 1], [[0, '#fffaf0'], [1, '#d9c2a0']]),
    rg('pbKnobTop', [0.4, 0.32, 0.8], [[0, '#ffffff'], [1, '#d6e4e0']]),
    lg('pbMetal', [0, 0, 1, 0], [[0, '#8fb3ad'], [0.5, '#e6f4f0'], [1, '#6f948e']]),
    rg('pbLed', [0.4, 0.35, 0.7], [[0, '#fff4dc'], [0.5, '#ffb347'], [1, '#d9771f']]),
    rg('pbLedGlow', [0.5, 0.5, 0.5], [[0, '#ffb347', 0.6], [1, '#ffb347', 0]]),
    rg('pbSun', [0.5, 0.9, 0.9], [[0, '#fff1c8'], [0.6, '#ffc07a'], [1, '#ff8a5c']]),
    lg('pbMoon', [0, 0, 1, 1], [[0, '#fff3c4'], [1, '#ffc25a']]),
    rg('pbCharm', [0.4, 0.35, 0.75], [[0, '#fff6d0'], [0.6, '#ffd166'], [1, '#e8962a']]),
    rg('pbFloor', [0.5, 0.5, 0.5], [[0, INK, 0.34], [1, INK, 0]]),
    `<clipPath id="pbBodyClip"><path d="${B}"/></clipPath>`,
    '<style>.pb-led{animation:pb-led 3s ease-in-out infinite}.pb-tw{animation:pb-tw 3.4s ease-in-out infinite}.pb-tw2{animation:pb-tw 3.4s ease-in-out 1.7s infinite}'
      + '@keyframes pb-led{0%,100%{opacity:1}50%{opacity:.45}}@keyframes pb-tw{0%,100%{opacity:1}50%{opacity:.35}}'
      + '@media (prefers-reduced-motion:reduce){*{animation:none!important}}</style>',
  ].join('');

  const body = [
    path(ellipse(CX + 20, BODY.yb + 44, 400, 24), { fill: 'url(#pbFloor)' }),
    lever(),
    scrollWheel(BODY.xr - 14, 560, 160),
    // body with a chunky moulded side for toy-like depth
    path(B, { fill: 'url(#pbSide)', stroke: INK, strokeWidth: 8, strokeLinejoin: 'round', transform: 'translate(8 14)' }),
    path(B, { fill: 'url(#pbBody)', stroke: INK, strokeWidth: 8, strokeLinejoin: 'round' }),
    g({ clipPath: 'url(#pbBodyClip)' },
      path(B, { fill: 'url(#pbShade)' }),
      `<rect x="${BODY.xl + 18}" y="0" width="190" height="${H}" fill="url(#pbSatin)"/>`,
      path(bodyD(7), { fill: 'none', stroke: 'url(#pbRim)', strokeWidth: 9 }),
      path(bodyD(5), { fill: 'none', stroke: 'url(#pbKey)', strokeWidth: 4 })),
    crescentKeys('well'),
    plate(),
    jogDial(),
    crescentKeys(),
    sliders(),
    rotaryKnob(),
    speaker(),
    sticker(190, 1318, -12),
    eyelet(),
    // anime glare: a sharp band riding the dome's left shoulder, a thin echo and glints
    path(arcBand(DOME, BODY.R - 13, 222, 262, 20, 0.8), { fill: '#fff', fillOpacity: 0.95 }),
    path(arcBand(DOME, BODY.R - 44, 228, 250, 6), { fill: '#fff', fillOpacity: 0.7 }),
    path(`M${BODY.xl + 16} 360Q${BODY.xl + 13} 520 ${BODY.xl + 18} 760L${BODY.xl + 30} 740Q${BODY.xl + 28} 520 ${BODY.xl + 34} 380Z`, { fill: '#fff', fillOpacity: 0.85 }),
    path(`M${BODY.xl + 46} 820V930`, { stroke: '#fff', strokeOpacity: 0.8, strokeWidth: 7, strokeLinecap: 'round' }),
    path(circle(BODY.xl + 28, 990, 6.5), { fill: '#fff', fillOpacity: 0.9 }),
    path(circle(560, 82, 9), { fill: '#fff' }),
    path(circle(584, 84, 4.8), { fill: '#fff', fillOpacity: 0.85 }),
    path(`M${BODY.xr - 26} 1060V1300`, { stroke: '#e6fff8', strokeOpacity: 0.8, strokeWidth: 7, strokeLinecap: 'round' }),
    path(`M${BODY.xr - 40} ${BODY.yb - BODY.c + 26}L${BODY.xr - BODY.c + 26} ${BODY.yb - 40}`, { stroke: '#e6fff8', strokeOpacity: 0.85, strokeWidth: 7, strokeLinecap: 'round' }),
    charm(),
    // sparkles around
    path(sparkle(64, 170, 24), { fill: '#fff4c9', stroke: INK, strokeWidth: 3, class: 'pb-tw' }),
    path(sparkle(950, 300, 18), { fill: '#ffd9c2', stroke: INK, strokeWidth: 3, class: 'pb-tw2' }),
    path(sparkle(36, 1200, 16), { fill: '#c9fff0', stroke: INK, strokeWidth: 3 }),
    path(star(966, 1460, 15, 6.5), { fill: '#ffe372', stroke: INK, strokeWidth: 3, strokeLinejoin: 'round' }),
    path(circle(330, 70, 4) + circle(880, 120, 3.5) + circle(968, 820, 4) + circle(30, 880, 3.5), { fill: '#fff', fillOpacity: 0.8 }),
  ].join('\n');
  return { defs, body };
}

module.exports = {
  W, H, hole, radius, draw,
  meta: { name: 'Pocket Brick', theme: 'classic', translucent: false,
    desc: 'A domed jade pocket brick with a cream jog dial, a crescent of apricot gem keys and a star charm on a cord.',
    tags: ['starter', 'handheld', 'console', 'retro', 'brick'] },
};
