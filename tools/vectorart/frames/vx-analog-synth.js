'use strict';
// Analog Synth: a vintage modular synthesizer. Walnut end-cheeks hold a brushed-aluminium panel: a black
// patch strip along the top bristles with jacks, and coloured patch cables loop up over the top (one
// drapes down a cheek); the screen sits in the middle as the main display in a dark screwed bezel; an
// oscillator bank of knobs with waveform glyphs on the left, a VU meter, filter knobs, LEDs and toggles on
// the right; a two-octave keyboard (one key pressed) with pitch and mod wheels runs along the bottom.
// No lettering anywhere. Original Kayboro artwork, CC BY 4.0.
const L = require('../lib');
const { rr, path, g, lg, rg, circle, ellipse, rng, lip, n, P } = L;

const W = 1700, H = 1130, hole = { x: 490, y: 290, w: 720, h: 450 }, radius = 14;
const INK = '#16171b';
const CHEEK = 110; // wood end-cheek width
const PX0 = 20 + CHEEK, PX1 = W - 20 - CHEEK; // panel between the cheeks
const PY0 = 170, PY1 = 806; // panel top and bottom
const KY0 = 830, KY1 = 1050; // keyboard
const JACKS = [];
for (let x = PX0 + 50; x < PX1 - 80; x += 88) JACKS.push(x); // the pilot lamp sits at the right end

const n1 = (v) => +(+v).toFixed(1);
const P1 = (...v) => v.map(n1).join(' ');

// ---- parts ---------------------------------------------------------------------------------------
const CAPS = { red: ['#ff8a6e', '#e2483a', '#9c2620'], yellow: ['#ffe28a', '#f2b632', '#a8701c'], blue: ['#9fdcff', '#3fa6d9', '#1d5f8a'], cream: ['#ffffff', '#ece6d6', '#a9a08a'], orange: ['#ffc28a', '#f07a2e', '#a84a14'] };

/** A knob: tick scale, black skirt with knurling, coloured cap and a pointer at angle a (degrees, 0 = up). */
function knob(cx, cy, r, a, cap = 'cream', ticks = 11) {
  const t = [];
  for (let i = 0; i < ticks; i++) {
    const an = ((-135 + (270 * i) / (ticks - 1) - 90) * Math.PI) / 180, r1 = r + 8, r2 = r + (i % 5 === 0 ? 20 : 14);
    t.push(`M${P1(cx + r1 * Math.cos(an), cy + r1 * Math.sin(an))}L${P1(cx + r2 * Math.cos(an), cy + r2 * Math.sin(an))}`);
  }
  const knurl = [];
  for (let i = 0; i < 28; i++) {
    const an = (i / 28) * Math.PI * 2;
    knurl.push(`M${P1(cx + r * 0.98 * Math.cos(an), cy + r * 0.98 * Math.sin(an))}L${P1(cx + r * 0.8 * Math.cos(an), cy + r * 0.8 * Math.sin(an))}`);
  }
  const ar = ((a - 90) * Math.PI) / 180;
  return path(t.join(''), { stroke: '#2a2c33', strokeWidth: 3, strokeLinecap: 'round' })
    + path(circle(cx + 3, cy + 7, r + 2), { fill: '#000', fillOpacity: 0.3 })
    + path(circle(cx, cy, r), { fill: 'url(#skirt)', stroke: INK, strokeWidth: 3 })
    + path(knurl.join(''), { stroke: '#000', strokeOpacity: 0.55, strokeWidth: 2 })
    + path(circle(cx, cy, r * 0.62), { fill: `url(#cap-${cap})`, stroke: INK, strokeWidth: 2.5 })
    + path(`M${P1(cx + r * 0.18 * Math.cos(ar), cy + r * 0.18 * Math.sin(ar))}L${P1(cx + r * 0.95 * Math.cos(ar), cy + r * 0.95 * Math.sin(ar))}`, { stroke: cap === 'cream' ? INK : '#fff', strokeWidth: n(Math.max(3, r * 0.1)), strokeLinecap: 'round' })
    + path(ellipse(cx - r * 0.2, cy - r * 0.26, r * 0.22, r * 0.12), { fill: '#fff', fillOpacity: 0.65, transform: `rotate(-30 ${n(cx - r * 0.2)} ${n(cy - r * 0.26)})` });
}

function screw(cx, cy, r = 7, rot = 30) {
  const a = (rot * Math.PI) / 180;
  return path(circle(cx, cy, r), { fill: 'url(#screw)', stroke: INK, strokeWidth: 2 })
    + path(`M${P1(cx - r * 0.6 * Math.cos(a), cy - r * 0.6 * Math.sin(a))}L${P1(cx + r * 0.6 * Math.cos(a), cy + r * 0.6 * Math.sin(a))}`, { stroke: INK, strokeOpacity: 0.7, strokeWidth: 2 });
}

/** A patch jack: nut and dark socket. */
function jack(cx, cy) {
  return path(circle(cx, cy, 15), { fill: 'url(#nut)', stroke: INK, strokeWidth: 2.5 })
    + path(circle(cx, cy, 8), { fill: '#050506' })
    + path(`M${n1(cx - 9)} ${n1(cy - 9)}A13 13 0 0 1 ${n1(cx + 6)} ${n1(cy - 12)}`, { fill: 'none', stroke: '#fff', strokeOpacity: 0.6, strokeWidth: 2.5, strokeLinecap: 'round' });
}

/** A plug seated in a jack at (cx, cy) with its cable leaving upward. */
function plug(cx, cy, col) {
  return path(rr(cx - 13, cy - 44, 26, 44, 9), { fill: `url(#plug-${col})`, stroke: INK, strokeWidth: 3 })
    + path(`M${cx - 13} ${cy - 30}H${cx + 13}M${cx - 13} ${cy - 22}H${cx + 13}M${cx - 13} ${cy - 14}H${cx + 13}`, { stroke: INK, strokeOpacity: 0.35, strokeWidth: 2 })
    + path(rr(cx - 16, cy - 8, 32, 14, 5), { fill: 'url(#nut)', stroke: INK, strokeWidth: 2.5 })
    + path(`M${cx - 7} ${cy - 40}V${cy - 16}`, { stroke: '#fff', strokeOpacity: 0.5, strokeWidth: 3, strokeLinecap: 'round' });
}

const CABLE = { red: '#e2483a', yellow: '#f2b632', blue: '#3fa6d9', green: '#4dbb6a', orange: '#f07a2e', purple: '#9a6ad8' };
function cable(d, col) {
  return path(d, { fill: 'none', stroke: INK, strokeWidth: 15, strokeLinecap: 'round' })
    + path(d, { fill: 'none', stroke: CABLE[col], strokeWidth: 9, strokeLinecap: 'round' })
    + path(d, { fill: 'none', stroke: '#fff', strokeOpacity: 0.4, strokeWidth: 2.5, strokeLinecap: 'round', transform: 'translate(-2 -2)' });
}

/** Tiny waveform glyphs (sine, saw, square, triangle) printed on the panel. */
function wave(kind, cx, cy, w = 34, h = 12) {
  const x0 = cx - w / 2;
  let d;
  if (kind === 'sine') { d = `M${P1(x0, cy)}`; for (let i = 1; i <= 16; i++) d += `L${P1(x0 + (w * i) / 16, cy - h * Math.sin((i / 16) * Math.PI * 2))}`; }
  else if (kind === 'saw') d = `M${P1(x0, cy + h)}L${P1(x0 + w / 2, cy - h)}V${n1(cy + h)}L${P1(x0 + w, cy - h)}V${n1(cy + h)}`;
  else if (kind === 'square') d = `M${P1(x0, cy + h)}V${n1(cy - h)}H${n1(x0 + w / 2)}V${n1(cy + h)}H${n1(x0 + w)}V${n1(cy - h)}`;
  else d = `M${P1(x0, cy + h)}L${P1(x0 + w / 4, cy - h)}L${P1(x0 + (3 * w) / 4, cy + h)}L${P1(x0 + w, cy - h)}`;
  return d;
}

function led(cx, cy, col, on = true) {
  return (on ? path(circle(cx, cy, 16), { fill: `url(#glow-${col})` }) : '')
    + path(circle(cx, cy, 7), { fill: on ? (col === 'red' ? '#ff5a4a' : '#7dff8a') : '#3a2a2a', stroke: INK, strokeWidth: 2.5 })
    + path(circle(cx - 2, cy - 2, 2), { fill: '#fff', fillOpacity: on ? 0.95 : 0.4 });
}

/** Pilot lamp: a faceted red jewel in a chrome bezel. */
function jewel(cx, cy) {
  let facets = '';
  for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; facets += `M${P1(cx, cy)}L${P1(cx + 12 * Math.cos(a), cy + 12 * Math.sin(a))}`; }
  return path(circle(cx, cy, 30), { fill: 'url(#glow-red)' })
    + path(circle(cx, cy, 19), { fill: 'url(#nut)', stroke: INK, strokeWidth: 3 })
    + path(circle(cx, cy, 13), { fill: 'url(#jewel)', stroke: INK, strokeWidth: 2.5 })
    + path(facets, { stroke: '#ffd0c8', strokeOpacity: 0.45, strokeWidth: 1.5 })
    + path(circle(cx - 4, cy - 5, 3.5), { fill: '#fff', fillOpacity: 0.9 });
}

function toggle(cx, cy, up = true) {
  return path(circle(cx, cy, 13), { fill: 'url(#nut)', stroke: INK, strokeWidth: 2.5 })
    + path(`M${cx} ${cy}L${cx + (up ? -6 : 6)} ${cy + (up ? -30 : 30)}`, { stroke: INK, strokeWidth: 10, strokeLinecap: 'round' })
    + path(`M${cx} ${cy}L${cx + (up ? -6 : 6)} ${cy + (up ? -30 : 30)}`, { stroke: '#e8ebf0', strokeWidth: 6, strokeLinecap: 'round' })
    + path(circle(cx + (up ? -6 : 6), cy + (up ? -30 : 30), 6), { fill: '#f4f6f9', stroke: INK, strokeWidth: 2.5 });
}

function vuMeter(x, y, w, h) {
  const cx = x + w / 2, cy = y + h - 22, R = h - 52, ticks = [], red = [];
  for (let i = 0; i <= 12; i++) {
    const a = ((-140 + (100 * i) / 12) * Math.PI) / 180, r2 = R + (i % 3 === 0 ? 16 : 9);
    (i >= 9 ? red : ticks).push(`M${P1(cx + R * Math.cos(a), cy + R * Math.sin(a))}L${P1(cx + r2 * Math.cos(a), cy + r2 * Math.sin(a))}`);
  }
  const arc = (a0, a1, r) => `M${P1(cx + r * Math.cos(a0), cy + r * Math.sin(a0))}A${r} ${r} 0 0 1 ${P1(cx + r * Math.cos(a1), cy + r * Math.sin(a1))}`;
  const na = (-74 * Math.PI) / 180;
  return g({},
    path(rr(x - 10, y - 10, w + 20, h + 20, 16), { fill: '#1d1e22', stroke: INK, strokeWidth: 4 }),
    path(rr(x, y, w, h, 10), { fill: 'url(#vuFace)', stroke: INK, strokeWidth: 3 }),
    path(arc((-140 * Math.PI) / 180, (-65 * Math.PI) / 180, R), { fill: 'none', stroke: '#2a2620', strokeWidth: 3 }),
    path(arc((-65 * Math.PI) / 180, (-40 * Math.PI) / 180, R), { fill: 'none', stroke: '#d8372a', strokeWidth: 5 }),
    path(ticks.join(''), { stroke: '#2a2620', strokeWidth: 3, strokeLinecap: 'round' }),
    path(red.join(''), { stroke: '#d8372a', strokeWidth: 3.5, strokeLinecap: 'round' }),
    path(`M${P1(cx, cy)}L${P1(cx + (R + 6) * Math.cos(na), cy + (R + 6) * Math.sin(na))}`, { stroke: INK, strokeWidth: 3.5, strokeLinecap: 'round' }),
    path(rr(cx - 40, cy - 6, 80, 30, 6), { fill: '#2a2c33', stroke: INK, strokeWidth: 2.5 }),
    path(circle(cx, cy, 8), { fill: '#2a2c33', stroke: INK, strokeWidth: 2 }),
    path(`M${x + 8} ${y + h * 0.55}L${x + w * 0.42} ${y + 6}H${x + w * 0.62}L${x + 8} ${y + h * 0.95}Z`, { fill: '#fff', fillOpacity: 0.22 }),
    path(`M${x + 14} ${y + 12}H${x + w * 0.4}`, { stroke: '#fff', strokeOpacity: 0.7, strokeWidth: 3, strokeLinecap: 'round' }));
}

// ---- assemblies ----------------------------------------------------------------------------------
function cheek(x0) {
  const w = CHEEK, d = rr(x0, 120, w, 990, [46, 46, 14, 14]), rnd = rng(x0 + 3);
  let grain = '';
  for (let x = x0 + 6; x < x0 + w - 4; x += 5 + rnd() * 8) {
    const pts = [];
    for (let y = 110; y <= 1130; y += 170) pts.push([x + (rnd() - 0.5) * 6, y]);
    grain += `M${P1(...pts[0])}` + pts.slice(1).map((p, i) => `Q${P1(pts[i][0] + (rnd() - 0.5) * 8, pts[i][1] + 85)} ${P1(...p)}`).join('');
  }
  const knot = ellipse(x0 + w * 0.55, 640, 12, 30) + ellipse(x0 + w * 0.55, 640, 6, 16);
  return g({},
    path(rr(x0 + 6, 132, w, 990, [46, 46, 14, 14]), { fill: '#000', fillOpacity: 0.3 }),
    path(d, { fill: 'url(#walnut)', stroke: INK, strokeWidth: 5 }),
    g({ clipPath: `url(#cheekClip${x0})` },
      path(grain, { fill: 'none', stroke: '#2a1206', strokeOpacity: 0.35, strokeWidth: 2 }),
      path(knot, { fill: 'none', stroke: '#2a1206', strokeOpacity: 0.4, strokeWidth: 2 }),
      path(rr(x0, 120, 18, 990, 0), { fill: '#fff', fillOpacity: 0.1 }),
      path(rr(x0 + w - 16, 120, 16, 990, 0), { fill: '#000', fillOpacity: 0.16 })),
    path(`M${x0 + 18} 1090V200Q${x0 + 18} 140 ${x0 + 60} 136`, { fill: 'none', stroke: '#ffd6a8', strokeOpacity: 0.32, strokeWidth: 4, strokeLinecap: 'round' }),
    path(d, { fill: 'none', stroke: INK, strokeWidth: 5 }));
}

function panel() {
  const rnd = rng(9);
  let brush = '';
  for (let y = PY0 + 92; y < PY1; y += 3 + rnd() * 5) brush += `M${PX0} ${n1(y)}H${PX1}`;
  const strip = rr(PX0, PY0, PX1 - PX0, 86, 0);
  const seams = [hole.x - 50, hole.x + hole.w + 50];
  return g({},
    path(rr(PX0, PY0, PX1 - PX0, PY1 - PY0, 0), { fill: 'url(#alu)' }),
    g({ clipPath: 'url(#panelClip)' }, path(brush, { fill: 'none', stroke: '#ffffff', strokeOpacity: 0.16, strokeWidth: 1.2 }),
      path(brush.split('M').filter(Boolean).filter((_, i) => i % 3 === 1).map((s) => `M${s}`).join(''), { fill: 'none', stroke: '#5a5f6a', strokeOpacity: 0.12, strokeWidth: 1.2 })),
    // patch strip
    path(strip, { fill: 'url(#strip)' }),
    path(`M${PX0} ${PY0 + 86}H${PX1}`, { stroke: INK, strokeWidth: 4 }),
    path(`M${PX0} ${PY0 + 90}H${PX1}`, { stroke: '#fff', strokeOpacity: 0.5, strokeWidth: 2 }),
    JACKS.map((x) => jack(x, PY0 + 46)).join(''),
    // module seams and screws
    path(seams.map((x) => `M${x} ${PY0 + 92}V${PY1}`).join(''), { stroke: '#4a4f5a', strokeOpacity: 0.55, strokeWidth: 3 }),
    path(seams.map((x) => `M${x + 2} ${PY0 + 92}V${PY1}`).join(''), { stroke: '#fff', strokeOpacity: 0.45, strokeWidth: 1.5 }),
    [PX0 + 18, PX1 - 18].map((x) => screw(x, PY0 + 110)).join(''),
    [PX0 + 18, seams[0] - 18, seams[0] + 18, seams[1] - 18, seams[1] + 18, PX1 - 18].map((x) => screw(x, PY1 - 18, 7, 70)).join(''),
    jewel(PX1 - 34, PY0 + 46),
    path(rr(PX0, PY0, PX1 - PX0, PY1 - PY0, 0), { fill: 'none', stroke: INK, strokeWidth: 5 }));
}

function leftModule() {
  const xs = [200, 300, 400], rows = [[356, ['sine', 'saw', 'square'], ['red', 'red', 'red'], [-60, 40, 100]], [492, [null, null, null], ['yellow', 'cream', 'yellow'], [20, -110, 70]], [626, [null, null, null], ['blue', 'blue', 'cream'], [-30, 120, 0]]];
  let out = '', glyphs = '';
  for (const [y, gl, caps, angs] of rows) {
    xs.forEach((x, i) => {
      out += knob(x, y, 34, angs[i], caps[i]);
      if (gl[i]) glyphs += wave(gl[i], x, y - 70, 28, 8);
    });
  }
  // small row of toggles and an LED pair under the bank
  out += toggle(196, 752, true) + toggle(256, 752, false) + toggle(316, 752, true) + led(392, 738, 'red') + led(428, 738, 'green', false);
  glyphs += wave('tri', 300, 424, 28, 8) + wave('sine', 200, 558, 26, 7) + wave('square', 400, 558, 26, 7);
  return path(glyphs, { fill: 'none', stroke: '#2a2c33', strokeWidth: 3, strokeLinejoin: 'round', strokeLinecap: 'round' }) + out;
}

function rightModule() {
  return vuMeter(1300, 286, 230, 150)
    + knob(1330, 530, 32, -80, 'orange') + knob(1416, 530, 32, 30, 'cream') + knob(1502, 530, 32, 110, 'orange')
    + knob(1350, 660, 44, -20, 'blue', 13) + knob(1480, 660, 28, 60, 'cream')
    + led(1300, 750, 'green') + led(1336, 750, 'red', false) + toggle(1420, 752, true) + toggle(1500, 752, false)
    + path(wave('saw', 1330, 464, 24, 7) + wave('square', 1502, 464, 24, 7), { fill: 'none', stroke: '#2a2c33', strokeWidth: 3, strokeLinejoin: 'round', strokeLinecap: 'round' });
}

function display() {
  const o = 32, b = rr(hole.x - o, hole.y - o, hole.w + 2 * o, hole.h + 2 * o, radius + o);
  return g({},
    path(rr(hole.x - o + 5, hole.y - o + 10, hole.w + 2 * o, hole.h + 2 * o, radius + o), { fill: '#000', fillOpacity: 0.35 }),
    path(b, { fill: 'url(#bezel)', stroke: INK, strokeWidth: 5 }),
    path(rr(hole.x - o + 8, hole.y - o + 8, hole.w + 2 * o - 16, hole.h + 2 * o - 16, radius + o - 8), { fill: 'none', stroke: '#fff', strokeOpacity: 0.16, strokeWidth: 2.5 }),
    path(rr(hole.x - 8, hole.y - 8, hole.w + 16, hole.h + 16, radius + 8), { fill: '#060708', stroke: '#3a3e48', strokeWidth: 2 }),
    lip(rr(hole.x, hole.y, hole.w, hole.h, radius), '#000', [[6, 0.35], [2.5, 0.6]]),
    [[hole.x - o / 2, hole.y - o / 2], [hole.x + hole.w + o / 2, hole.y - o / 2], [hole.x - o / 2, hole.y + hole.h + o / 2], [hole.x + hole.w + o / 2, hole.y + hole.h + o / 2]].map(([x, y]) => screw(x, y, 7, 45)).join(''));
}

/** The patch cables: loops from plug to plug arching over the top, plus one drooping down the left cheek. */
function cables(jx) {
  // each cable leaves its plug straight up, then sags a little to one side before diving into the other plug
  const y = PY0 + 46, top = (x0, x1, h, lean) => `M${x0} ${y - 40}C${n1(x0 + (x1 - x0) * lean)} ${n1(y - 40 - h * 1.12)} ${n1(x1 - (x1 - x0) * (0.3 - lean))} ${n1(y - 40 - h * 0.86)} ${x1} ${y - 40}`;
  const runs = [
    [jx[1], jx[6], 150, 'red', 0.04], [jx[3], jx[9], 118, 'yellow', 0.22], [jx[7], jx[12], 160, 'blue', 0.08],
    [jx[10], jx[14], 104, 'green', 0.2], [jx[5], jx[13], 70, 'orange', 0.12],
  ];
  const plugs = new Map();
  let out = '';
  for (const [a, b, h, col, lean] of runs) { out += cable(top(a, b, h, lean), col); plugs.set(a, col); plugs.set(b, col); }
  // a lazy loop off the left end, hanging down over the cheek
  out += cable(`M${jx[0]} ${y - 40}C${jx[0]} ${y - 110} ${50} ${y - 110} ${46} ${y + 40}C${42} ${y + 170} ${90} ${y + 220} ${78} ${y + 300}`, 'purple');
  plugs.set(jx[0], 'purple');
  out += path(rr(64, y + 296, 28, 50, 10), { fill: 'url(#plug-purple)', stroke: INK, strokeWidth: 3 })
    + path('M64 ' + (y + 312) + 'H92M64 ' + (y + 320) + 'H92M64 ' + (y + 328) + 'H92', { stroke: INK, strokeOpacity: 0.35, strokeWidth: 2 })
    + path(rr(72, y + 344, 12, 26, 4), { fill: 'url(#nut)', stroke: INK, strokeWidth: 2.5 });
  return out + [...plugs].map(([x, col]) => plug(x, y, col)).join('');
}

function keyboard() {
  const x0 = 340, x1 = PX1 - 20, nW = 15, kw = (x1 - x0) / nW, y0 = KY0 + 14, kh = KY1 - y0 - 8, bh = kh * 0.6, bw = kw * 0.58;
  const pressed = 9;
  let whites = '', press = '', blacks = '', shine = '';
  for (let i = 0; i < nW; i++) {
    const x = x0 + i * kw;
    if (i === pressed) press = rr(x + 2, y0, kw - 4, kh - 6, [0, 0, 8, 8]);
    else whites += rr(x + 2, y0, kw - 4, kh, [0, 0, 8, 8]);
  }
  const hasBlack = [1, 1, 0, 1, 1, 1, 0]; // after C D (no E) F G A (no B)
  for (let i = 0; i < nW - 1; i++) {
    if (!hasBlack[i % 7]) continue;
    const x = x0 + (i + 1) * kw - bw / 2;
    blacks += rr(x, y0, bw, bh, [0, 0, 6, 6]);
    shine += `M${n1(x + bw * 0.3)} ${n1(y0 + 10)}V${n1(y0 + bh - 18)}`;
  }
  return g({},
    // key bed
    path(rr(PX0, KY0 - 24, PX1 - PX0, KY1 - KY0 + 48, [0, 0, 10, 10]), { fill: 'url(#keybed)', stroke: INK, strokeWidth: 5 }),
    path(`M${PX0} ${KY0 - 20}H${PX1}`, { stroke: '#fff', strokeOpacity: 0.12, strokeWidth: 3 }),
    path(rr(x0 - 4, y0 - 12, x1 - x0 + 8, 16, 3), { fill: '#a3242a', stroke: INK, strokeWidth: 2.5 }),
    path(whites, { fill: 'url(#ivory)', stroke: INK, strokeWidth: 3 }),
    path(press, { fill: 'url(#ivoryDown)', stroke: INK, strokeWidth: 3 }),
    path(blacks, { fill: 'url(#ebony)', stroke: INK, strokeWidth: 3 }),
    path(shine, { stroke: '#fff', strokeOpacity: 0.35, strokeWidth: 4, strokeLinecap: 'round' }),
    path(`M${x0} ${y0 + 2}H${x1}`, { stroke: '#000', strokeOpacity: 0.45, strokeWidth: 6 }),
    // wheels
    path(rr(PX0 + 24, y0 + 6, 170, kh - 20, 14), { fill: '#0c0d10', stroke: INK, strokeWidth: 4 }),
    ...[PX0 + 66, PX0 + 150].map((cx, i) => {
      let rib = '';
      for (let k = 0; k < 12; k++) rib += `M${n1(cx - 20)} ${n1(y0 + 40 + k * 11 + (i ? 6 : 0))}H${n1(cx + 20)}`;
      return path(rr(cx - 22, y0 + 26, 44, kh - 60, 10), { fill: 'url(#wheel)', stroke: INK, strokeWidth: 3 })
        + path(rib, { stroke: '#000', strokeOpacity: 0.4, strokeWidth: 2 })
        + path(`M${cx - 22} ${y0 + 26 + (kh - 60) / 2 + (i ? 14 : 0)}H${cx + 22}`, { stroke: '#fff', strokeWidth: 4 });
    }));
}

function base() {
  return g({},
    path(ellipse(W / 2, H - 14, 820, 14), { fill: '#000', fillOpacity: 0.3 }),
    path(rr(PX0 - 4, KY1 + 18, PX1 - PX0 + 8, 40, [0, 0, 12, 12]), { fill: 'url(#walnut)', stroke: INK, strokeWidth: 5 }),
    path(`M${PX0 + 10} ${KY1 + 28}H${PX1 - 10}`, { stroke: '#ffd6a8', strokeOpacity: 0.3, strokeWidth: 3, strokeLinecap: 'round' }));
}

function draw() {
  const capG = Object.entries(CAPS).map(([k, [a, b, c]]) => rg(`cap-${k}`, [0.4, 0.35, 0.75], [[0, a], [0.6, b], [1, c]])).join('');
  const plugG = Object.entries(CABLE).map(([k, c]) => lg(`plug-${k}`, [0, 0, 1, 0], [[0, '#ffffff', 0.9], [0.18, c], [0.75, c], [1, '#16171b', 0.9]])).join('');
  const defs = [
    capG, plugG,
    lg('alu', [0, 0, 0, 1], [[0, '#eef0f3'], [0.45, '#d3d7dd'], [1, '#aeb3bc']]),
    lg('strip', [0, 0, 0, 1], [[0, '#34363d'], [1, '#1b1c20']]),
    lg('walnut', [0, 0, 1, 0], [[0, '#8a5530'], [0.5, '#6a3c1e'], [1, '#4a2810']]),
    rg('skirt', [0.4, 0.35, 0.75], [[0, '#4a4d56'], [0.6, '#1f2126'], [1, '#0a0b0d']]),
    rg('screw', [0.4, 0.35, 0.7], [[0, '#ffffff'], [1, '#8a909c']]),
    rg('nut', [0.4, 0.35, 0.75], [[0, '#ffffff'], [0.5, '#c4c9d2'], [1, '#6f7682']]),
    lg('bezel', [0, 0, 1, 1], [[0, '#3c3f48'], [0.5, '#24262c'], [1, '#121317']]),
    lg('vuFace', [0, 0, 0, 1], [[0, '#fff6d8'], [1, '#f0ddb0']]),
    rg('jewel', [0.4, 0.35, 0.7], [[0, '#ffb0a0'], [0.5, '#ff3a2a'], [1, '#8a120c']]),
    rg('glow-red', [0.5, 0.5, 0.5], [[0, '#ff5a4a', 0.38], [1, '#ff5a4a', 0]]),
    rg('glow-green', [0.5, 0.5, 0.5], [[0, '#7dff8a', 0.38], [1, '#7dff8a', 0]]),
    lg('keybed', [0, 0, 0, 1], [[0, '#2a2b30'], [1, '#131417']]),
    lg('ivory', [0, 0, 0, 1], [[0, '#e6e1d4'], [0.12, '#fffdf6'], [0.92, '#f6f1e4'], [1, '#d8d0bc']]),
    lg('ivoryDown', [0, 0, 0, 1], [[0, '#c9c2b0'], [0.2, '#ece6d6'], [1, '#d6cdb6']]),
    lg('ebony', [0, 0, 0, 1], [[0, '#3a3c44'], [0.85, '#121317'], [1, '#2c2e35']]),
    lg('wheel', [0, 0, 1, 0], [[0, '#1a1b1f'], [0.5, '#4a4d56'], [1, '#141518']]),
    `<clipPath id="panelClip"><path d="${rr(PX0, PY0, PX1 - PX0, PY1 - PY0, 0)}"/></clipPath>`,
    `<clipPath id="cheekClip20"><path d="${rr(20, 120, CHEEK, 990, [46, 46, 14, 14])}"/></clipPath>`,
    `<clipPath id="cheekClip${W - 20 - CHEEK}"><path d="${rr(W - 20 - CHEEK, 120, CHEEK, 990, [46, 46, 14, 14])}"/></clipPath>`,
  ].join('');

  const body = [
    base(),
    cheek(20), cheek(W - 20 - CHEEK),
    keyboard(),
    panel(),
    leftModule(), rightModule(),
    display(),
    cables(JACKS),
  ].join('\n');
  return { defs, body };
}

module.exports = {
  W, H, hole, radius, draw,
  meta: {
    name: 'Analog Synth', theme: 'modular-synth', rarity: 'rare',
    desc: 'Patch the cables, twist the knobs and watch the needle dance while your game plays on the main display.',
    tags: ['synth', 'music', 'retro', 'keyboard', 'instrument'],
    collection: 'wild-tuneful', license: 'CC-BY-4.0',
  },
};
