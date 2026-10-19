'use strict';
// Orbital Cupola: a space-station module seen from outside. The screen is its big observation window
// (thick white-and-silver bolted frame, gold-foil shutters folded open), quilted insulation blankets,
// lattice trusses and tall solar wings, a docking port with a blinking beacon, a dish, white radiators,
// a robotic arm hugging the top-right corner and a tiny tethered astronaut waving a wrench. A planet's
// limb glows below. Optional animation: beacon blink and a slow glint sliding down the solar wings.
const L = require('../lib');
const { rr, path, g, lg, rg, circle, ellipse, sparkle, star, poly, tf, rng, lip, n } = L;

const W = 1700, H = 1100, hole = { x: 450, y: 320, w: 800, h: 450 }, radius = 22;
const INK = '#2a3254';
const BODY = { x: 280, y: 190, w: 1140, h: 715, r: 58 };
const BEZ = { x: hole.x - 54, y: hole.y - 54, w: hole.w + 108, h: hole.h + 108, r: 62 };

/** Thick rounded stroke segment (ink + colour + highlight): used for arm booms, poles and masts. */
function tube(d, w, col = 'url(#ssWhiteV)', hi = true) {
  return path(d, { fill: 'none', stroke: INK, strokeWidth: w + 8, strokeLinecap: 'round', strokeLinejoin: 'round' })
    + path(d, { fill: 'none', stroke: col, strokeWidth: w, strokeLinecap: 'round', strokeLinejoin: 'round' })
    + (hi ? path(d, { fill: 'none', stroke: '#fff', strokeOpacity: 0.55, strokeWidth: Math.max(2, w * 0.22), strokeLinecap: 'round', strokeLinejoin: 'round', transform: `translate(${n(-w * 0.18)} ${n(-w * 0.22)})` }) : '');
}

/** Ball joint. */
function joint(cx, cy, r) {
  return path(circle(cx + 3, cy + 5, r), { fill: INK, fillOpacity: 0.35 })
    + path(circle(cx, cy, r), { fill: 'url(#ssBall)', stroke: INK, strokeWidth: 5 })
    + path(ellipse(cx - r * 0.3, cy - r * 0.38, r * 0.32, r * 0.2), { fill: '#fff', fillOpacity: 0.8, transform: `rotate(-30 ${n(cx - r * 0.3)} ${n(cy - r * 0.38)})` });
}

function bolt(cx, cy, r = 7) {
  return path(circle(cx, cy, r), { fill: 'url(#ssBolt)', stroke: INK, strokeWidth: 2.5 })
    + path(`M${n(cx - r * 0.5)} ${n(cy - r * 0.5)}L${n(cx + r * 0.5)} ${n(cy + r * 0.5)}`, { stroke: INK, strokeOpacity: 0.7, strokeWidth: 2, strokeLinecap: 'round' });
}

/** Planet limb rising from the bottom edge, with atmosphere haze and soft cloud bands. */
function planet() {
  const cx = 850, cy = 1900, R = 1150;
  const dome = circle(cx, cy, R);
  const rnd = rng(7), clouds = [];
  for (let i = 0; i < 14; i++) {
    const x = 120 + rnd() * 1460, y = 790 + rnd() * 300, w = 60 + rnd() * 150;
    clouds.push(ellipse(x, y, w, 10 + rnd() * 12));
  }
  return g({},
    path(circle(cx, cy, R + 34), { fill: 'url(#ssAtmo)' }),
    path(dome, { fill: 'url(#ssPlanet)' }),
    g({ clipPath: 'url(#ssPlanetClip)' },
      path('M160 1010C260 940 420 950 520 1000C600 1040 560 1100 480 1100H140Z M900 960C1000 900 1180 920 1260 980C1330 1030 1300 1100 1200 1100H880C820 1060 840 1000 900 960Z', { fill: '#2fa89a', fillOpacity: 0.35 }),
      path(clouds.join(''), { fill: '#fff', fillOpacity: 0.32 }),
      path('M0 980C300 930 600 1010 900 960C1200 910 1500 980 1700 940V1100H0Z', { fill: '#fff', fillOpacity: 0.1 }),
      path(circle(cx, cy, R), { fill: 'url(#ssPlanetShade)' })),
    path(circle(cx, cy, R), { fill: 'none', stroke: '#dffbff', strokeOpacity: 0.9, strokeWidth: 5 }),
    path(circle(cx, cy, R), { fill: 'none', stroke: INK, strokeWidth: 3, strokeOpacity: 0.5 }));
}

/** One solar wing (two cell panels on a yoke). side -1 = left, 1 = right. */
function wing(side) {
  const x = side < 0 ? 24 : 1536, w = 140, top = 150, mid = 560, bot = 960, cx = x + w / 2;
  const cells = [];
  const cols = 3, cw = (w - 16) / cols;
  const panel = (y0, y1, id) => {
    const rows = Math.round((y1 - y0 - 16) / 44), ch = (y1 - y0 - 16) / rows;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const px = x + 8 + c * cw, py = y0 + 8 + r * ch;
      cells.push(rr(px + 2, py + 2, cw - 4, ch - 4, 2));
    }
    return path(rr(x + 4, y0 + 4, w, y1 - y0, 10), { fill: INK, fillOpacity: 0.3 })
      + path(rr(x, y0, w, y1 - y0, 10), { fill: 'url(#ssCells)', stroke: INK, strokeWidth: 5 })
      + g({ clipPath: `url(#${id})` },
        g({ class: 'ss-glint' }, path(poly([[x - 60, y0 + 90], [x + w + 60, y0 - 10], [x + w + 60, y0 + 40], [x - 60, y0 + 140]]), { fill: '#fff', fillOpacity: 0.28 })));
  };
  const up = panel(top, mid - 24, `ssWing${side < 0 ? 'L' : 'R'}a`);
  const lo = panel(mid + 24, bot, `ssWing${side < 0 ? 'L' : 'R'}b`);
  const cellPaths = cells.join('');
  return g({},
    // yoke spindle running behind both panels
    tube(`M${cx} ${top + 20}V${bot - 20}`, 12, 'url(#ssSilverV)', false),
    up,
    path(cellPaths, { fill: 'url(#ssCellShine)', stroke: '#8fc2ff', strokeOpacity: 0.45, strokeWidth: 1.5 }),
    lo,
    path(rr(x + 4, top + 4, w - 8, mid - 24 - top - 8, 7), { fill: 'none', stroke: '#ffd97a', strokeOpacity: 0.7, strokeWidth: 2 }),
    path(rr(x + 4, mid + 28, w - 8, bot - mid - 32, 7), { fill: 'none', stroke: '#ffd97a', strokeOpacity: 0.7, strokeWidth: 2 }),
    // gimbal drum between the panels
    path(rr(cx - 34, mid - 30, 68, 60, 14), { fill: 'url(#ssSilverV)', stroke: INK, strokeWidth: 5 }),
    path(`M${cx - 20} ${mid - 14}H${cx + 20}M${cx - 20} ${mid}H${cx + 20}M${cx - 20} ${mid + 14}H${cx + 20}`, { stroke: INK, strokeOpacity: 0.45, strokeWidth: 3, strokeLinecap: 'round' }),
    bolt(cx, top - 2, 6), bolt(cx, bot + 2, 6));
}

/** Lattice truss beam between the wing gimbal and the body. */
function truss(side) {
  const x0 = side < 0 ? 150 : 1420, x1 = side < 0 ? 280 : 1550, y0 = 486, y1 = 634, h = y1 - y0;
  const d = rr(x0, y0, x1 - x0, h, 8);
  const bays = 3, bw = (x1 - x0) / bays;
  let struts = '';
  for (let i = 0; i < bays; i++) {
    const bx = x0 + i * bw;
    struts += `M${n(bx)} ${y0}L${n(bx + bw)} ${y1}M${n(bx + bw)} ${y0}L${n(bx)} ${y1}`;
    if (i) struts += `M${n(bx)} ${y0}V${y1}`;
  }
  return g({},
    path(d, { fill: INK, fillOpacity: 0.35, transform: 'translate(4 6)' }),
    path(d, { fill: 'url(#ssTruss)', stroke: INK, strokeWidth: 5 }),
    path(struts, { fill: 'none', stroke: INK, strokeWidth: 9, strokeLinecap: 'round' }),
    path(struts, { fill: 'none', stroke: '#e6ecff', strokeWidth: 4, strokeLinecap: 'round' }),
    path(`M${x0 + 6} ${y0 + 10}H${x1 - 6}M${x0 + 6} ${y1 - 10}H${x1 - 6}`, { fill: 'none', stroke: INK, strokeWidth: 9, strokeLinecap: 'round' }),
    path(`M${x0 + 6} ${y0 + 10}H${x1 - 6}M${x0 + 6} ${y1 - 10}H${x1 - 6}`, { fill: 'none', stroke: '#ffffff', strokeWidth: 4, strokeLinecap: 'round' }),
    // gold foil collar where the truss meets the module
    path(rr(side < 0 ? x1 - 30 : x0, y0 - 16, 30, h + 32, 8), { fill: 'url(#ssGold)', stroke: INK, strokeWidth: 5 }));
}

/** White finned radiator hanging below the module. */
function radiator(x, y, w, h) {
  const fins = [];
  for (let i = 1; i < 7; i++) fins.push(`M${n(x + (w * i) / 7)} ${y + 10}V${y + h - 10}`);
  return g({},
    path(`M${x + 40} ${y - 14}V${y + 6}M${x + w - 40} ${y - 14}V${y + 6}`, { stroke: INK, strokeWidth: 10, strokeLinecap: 'round' }),
    path(`M${x + 40} ${y - 14}V${y + 6}M${x + w - 40} ${y - 14}V${y + 6}`, { stroke: '#c9d3ea', strokeWidth: 4, strokeLinecap: 'round' }),
    path(rr(x + 4, y + 6, w, h, 10), { fill: INK, fillOpacity: 0.35 }),
    path(rr(x, y, w, h, 10), { fill: 'url(#ssRadiator)', stroke: INK, strokeWidth: 5 }),
    path(fins.join(''), { stroke: INK, strokeOpacity: 0.35, strokeWidth: 4, strokeLinecap: 'round' }),
    path(fins.join(''), { stroke: '#fff', strokeOpacity: 0.8, strokeWidth: 2, strokeLinecap: 'round', transform: 'translate(-3 0)' }),
    path(`M${x + 14} ${y + 12}H${x + w - 14}`, { stroke: '#fff', strokeOpacity: 0.7, strokeWidth: 4, strokeLinecap: 'round' }));
}

/** Quilted insulation blanket over the body (clipped to the ring outside the window assembly). */
function quilt() {
  const s = 40, out = [], hi = [];
  for (let y = BODY.y - 8; y < BODY.y + BODY.h + 8; y += s) {
    for (let x = BODY.x - 8; x < BODY.x + BODY.w + 8; x += s) {
      if (x > 330 && x + s < 1370 && y > 206 && y + s < 892) continue;
      out.push(rr(x + 2.5, y + 2.5, s - 5, s - 5, 9));
      hi.push(ellipse(x + s * 0.36, y + s * 0.33, s * 0.15, s * 0.09));
    }
  }
  return g({ clipPath: 'url(#ssBodyClip)' },
    path(out.join(''), { fill: 'url(#ssQuilt)', stroke: INK, strokeOpacity: 0.3, strokeWidth: 1.6 }),
    path(hi.join(''), { fill: '#fff', fillOpacity: 0.75 }));
}

/** Gold foil strip with crinkle highlights. */
function foil(x, y, w, h, r = 10, seed = 3) {
  const rnd = rng(seed), lines = [], darks = [];
  for (let i = 0; i < Math.floor(w / 26); i++) {
    const lx = x + 12 + rnd() * (w - 24), ly = y + 6 + rnd() * (h - 12), len = 8 + rnd() * Math.min(28, h - 12);
    const dx = (rnd() - 0.5) * 12;
    (i % 3 ? lines : darks).push(`M${n(lx)} ${n(ly)}L${n(lx + dx)} ${n(Math.min(y + h - 5, ly + len))}`);
  }
  return path(rr(x, y, w, h, r), { fill: 'url(#ssGold)', stroke: INK, strokeWidth: 4 })
    + path(lines.join(''), { fill: 'none', stroke: '#fff6c8', strokeOpacity: 0.75, strokeWidth: 2.5, strokeLinecap: 'round' })
    + path(darks.join(''), { fill: 'none', stroke: '#9a5d14', strokeOpacity: 0.45, strokeWidth: 2, strokeLinecap: 'round' });
}

/** The cupola: folded-open gold shutters, thick white/silver bolted frame, dark inner lip. */
function cupola(holeD) {
  const sh = 34, gap = 8;
  /** One shutter panel: gold foil louvers with a silver outer rail, hinged along the bezel edge. */
  const shutter = (x, y, w, h, horiz, seed) => {
    const segs = 3, out = [];
    for (let i = 0; i < segs; i++) {
      const sx = horiz ? x + (w * i) / segs : x, sy = horiz ? y : y + (h * i) / segs;
      const sw = horiz ? w / segs - 6 : w, shh = horiz ? h : h / segs - 6;
      out.push(foil(sx + (horiz ? 3 : 0), sy + (horiz ? 0 : 3), sw, shh, 7, seed + i));
    }
    const rail = horiz ? rr(x, y < BEZ.y ? y - 6 : y + h - 4, w, 10, 4) : rr(x < BEZ.x ? x - 6 : x + w - 4, y, 10, h, 4);
    return path(rr(x + 3, y + 5, w, h, 8), { fill: INK, fillOpacity: 0.25 }) + out.join('')
      + path(rail, { fill: 'url(#ssSilverV)', stroke: INK, strokeWidth: 3 });
  };
  const shutters = [
    shutter(BEZ.x + 36, BEZ.y - gap - sh, BEZ.w - 72, sh, true, 11),
    shutter(BEZ.x + 36, BEZ.y + BEZ.h + gap, BEZ.w - 72, sh, true, 21),
    shutter(BEZ.x - gap - sh, BEZ.y + 36, sh, BEZ.h - 72, false, 31),
    shutter(BEZ.x + BEZ.w + gap, BEZ.y + 36, sh, BEZ.h - 72, false, 41),
  ].join('');
  const knuckle = (x, y, w, h) => path(rr(x, y, w, h, 4), { fill: 'url(#ssSilverV)', stroke: INK, strokeWidth: 3 })
    + path(`M${n(x + 4)} ${n(y + h / 2)}H${n(x + w - 4)}`, { stroke: '#fff', strokeOpacity: 0.8, strokeWidth: 2, strokeLinecap: 'round' });
  let hinges = '';
  for (const fx of [0.2, 0.5, 0.8]) {
    const hx = BEZ.x + BEZ.w * fx, hy = BEZ.y + BEZ.h * fx;
    hinges += knuckle(hx - 22, BEZ.y - gap - 4, 44, gap + 10) + knuckle(hx - 22, BEZ.y + BEZ.h - 6, 44, gap + 10)
      + knuckle(BEZ.x - gap - 4, hy - 22, gap + 10, 44) + knuckle(BEZ.x + BEZ.w - 6, hy - 22, gap + 10, 44);
  }
  const bolts = [];
  const bx0 = hole.x - 36, bx1 = hole.x + hole.w + 36, by0 = hole.y - 36, by1 = hole.y + hole.h + 36;
  for (let i = 0; i <= 6; i++) { const x = bx0 + ((bx1 - bx0) * i) / 6; bolts.push(bolt(x, by0), bolt(x, by1)); }
  for (let i = 1; i <= 3; i++) { const y = by0 + ((by1 - by0) * i) / 4; bolts.push(bolt(bx0, y), bolt(bx1, y)); }
  return g({},
    shutters, hinges,
    path(rr(BEZ.x + 4, BEZ.y + 8, BEZ.w, BEZ.h, BEZ.r), { fill: INK, fillOpacity: 0.3 }),
    path(rr(BEZ.x, BEZ.y, BEZ.w, BEZ.h, BEZ.r), { fill: 'url(#ssBezel)', stroke: INK, strokeWidth: 6 }),
    path(rr(hole.x - 24, hole.y - 24, hole.w + 48, hole.h + 48, radius + 20), { fill: 'url(#ssBezelIn)', stroke: INK, strokeOpacity: 0.6, strokeWidth: 3 }),
    path(rr(hole.x - 12, hole.y - 12, hole.w + 24, hole.h + 24, radius + 10), { fill: '#161b33' }),
    lip(holeD, '#000', [[8, 0.3], [3, 0.6]]),
    path(`M${BEZ.x + 24} ${BEZ.y + 150}V${BEZ.y + 60}Q${BEZ.x + 24} ${BEZ.y + 22} ${BEZ.x + 64} ${BEZ.y + 22}H${BEZ.x + 220}`, { fill: 'none', stroke: '#fff', strokeOpacity: 0.9, strokeWidth: 6, strokeLinecap: 'round' }),
    path(`M${BEZ.x + BEZ.w - 24} ${BEZ.y + BEZ.h - 150}V${BEZ.y + BEZ.h - 60}Q${BEZ.x + BEZ.w - 24} ${BEZ.y + BEZ.h - 22} ${BEZ.x + BEZ.w - 64} ${BEZ.y + BEZ.h - 22}H${BEZ.x + BEZ.w - 220}`, { fill: 'none', stroke: INK, strokeOpacity: 0.25, strokeWidth: 6, strokeLinecap: 'round' }),
    bolts.join(''));
}

/** Docking port on top of the module with a blinking beacon. */
function dockingPort() {
  const cx = 850, y = 190;
  return g({},
    path(rr(cx - 96, y - 60, 192, 70, 10), { fill: 'url(#ssSilverV)', stroke: INK, strokeWidth: 5 }),
    path(`M${cx - 70} ${y - 46}H${cx + 70}`, { stroke: '#fff', strokeOpacity: 0.8, strokeWidth: 4, strokeLinecap: 'round' }),
    path(`M${cx - 60} ${y - 20}H${cx + 60}`, { stroke: INK, strokeOpacity: 0.3, strokeWidth: 4, strokeLinecap: 'round' }),
    path(ellipse(cx, y - 62, 110, 26), { fill: 'url(#ssRing)', stroke: INK, strokeWidth: 5 }),
    path(ellipse(cx, y - 62, 78, 16), { fill: '#1c2140', stroke: INK, strokeWidth: 3 }),
    path(ellipse(cx, y - 64, 52, 8), { fill: '#3a4474' }),
    path(`M${cx - 16} ${y - 64}H${cx + 16}M${cx} ${y - 69}V${y - 59}`, { stroke: '#ffd97a', strokeWidth: 3, strokeLinecap: 'round' }),
    [-1, 0, 1].map((k) => path(poly([[cx + k * 70 - 14, y - 70], [cx + k * 70 + 14, y - 70], [cx + k * 70 + 8, y - 96], [cx + k * 70 - 8, y - 96]]), { fill: 'url(#ssGold)', stroke: INK, strokeWidth: 3, strokeLinejoin: 'round' })).join(''),
    // beacon mast
    tube(`M${cx + 150} ${y - 10}V${y - 120}`, 8, 'url(#ssSilverV)', false),
    path(circle(cx + 150, y - 134, 30), { fill: 'url(#ssBeaconGlow)', class: 'ss-beacon' }),
    path(circle(cx + 150, y - 134, 12), { fill: '#ff5a6e', stroke: INK, strokeWidth: 3, class: 'ss-beacon' }),
    path(circle(cx + 150, y - 134, 12), { fill: 'none', stroke: INK, strokeWidth: 3 }),
    path(circle(cx + 146, y - 139, 4), { fill: '#fff', fillOpacity: 0.9, class: 'ss-beacon' }));
}

function dish() {
  const x = 470, y = 190;
  const d = `M${x - 70} ${y - 92}C${x - 66} ${y - 150} ${x + 6} ${y - 182} ${x + 46} ${y - 150}C${x + 8} ${y - 120} ${x - 30} ${y - 96} ${x - 70} ${y - 92}Z`;
  return g({},
    tube(`M${x} ${y - 6}V${y - 100}`, 10, 'url(#ssSilverV)', false),
    path(d, { fill: INK, fillOpacity: 0.3, transform: 'translate(4 6)' }),
    path(d, { fill: 'url(#ssDish)', stroke: INK, strokeWidth: 5, strokeLinejoin: 'round' }),
    path(`M${x - 50} ${y - 104}C${x - 30} ${y - 136} ${x} ${y - 150} ${x + 30} ${y - 148}`, { fill: 'none', stroke: '#fff', strokeOpacity: 0.7, strokeWidth: 3, strokeLinecap: 'round' }),
    path(`M${x - 12} ${y - 120}L${x + 34} ${y - 196}`, { stroke: INK, strokeWidth: 7, strokeLinecap: 'round' }),
    path(`M${x - 12} ${y - 120}L${x + 34} ${y - 196}`, { stroke: '#e9edff', strokeWidth: 3, strokeLinecap: 'round' }),
    path(circle(x + 36, y - 200, 9), { fill: 'url(#ssGold)', stroke: INK, strokeWidth: 3 }),
    joint(x, y - 102, 12));
}

/** Robotic arm hugging the top-right corner of the module. */
function arm() {
  const s = [1250, 196], e = [1440, 60], w = [1200, 48], tip = [1175, 128];
  const boom = `M${s[0]} ${s[1]}L${e[0]} ${e[1]}`, fore = `M${e[0]} ${e[1]}L${w[0]} ${w[1]}`, wrist = `M${w[0]} ${w[1]}L${tip[0]} ${tip[1]}`;
  const stripe = (d) => path(d, { fill: 'none', stroke: '#f6b73c', strokeWidth: 20, strokeDasharray: '14 150', strokeDashoffset: 46 });
  return g({},
    path(rr(s[0] - 44, s[1] - 10, 88, 28, 8), { fill: 'url(#ssSilverV)', stroke: INK, strokeWidth: 5 }),
    tube(boom, 26), stripe(boom), tube(fore, 22), stripe(fore), tube(wrist, 16),
    joint(...s, 30), joint(...e, 24), joint(...w, 18),
    // end effector: gripper + camera light
    path(rr(tip[0] - 22, tip[1] - 6, 44, 24, 6), { fill: 'url(#ssSilverV)', stroke: INK, strokeWidth: 4 }),
    path(`M${tip[0] - 18} ${tip[1] + 18}L${tip[0] - 26} ${tip[1] + 44}L${tip[0] - 10} ${tip[1] + 36}M${tip[0] + 18} ${tip[1] + 18}L${tip[0] + 26} ${tip[1] + 44}L${tip[0] + 10} ${tip[1] + 36}`, { fill: 'none', stroke: INK, strokeWidth: 9, strokeLinecap: 'round', strokeLinejoin: 'round' }),
    path(`M${tip[0] - 18} ${tip[1] + 18}L${tip[0] - 26} ${tip[1] + 44}L${tip[0] - 10} ${tip[1] + 36}M${tip[0] + 18} ${tip[1] + 18}L${tip[0] + 26} ${tip[1] + 44}L${tip[0] + 10} ${tip[1] + 36}`, { fill: 'none', stroke: '#e6ecff', strokeWidth: 4, strokeLinecap: 'round', strokeLinejoin: 'round' }),
    path(circle(tip[0] + 30, tip[1] + 6, 8), { fill: '#7af0ff', stroke: INK, strokeWidth: 3 }),
    path(circle(tip[0] + 28, tip[1] + 4, 3), { fill: '#fff' }));
}

/** Tiny astronaut on EVA, waving with a wrench, tethered to the left truss. */
function astronaut(cx, cy) {
  const suit = (d, extra = {}) => path(d, { fill: 'url(#ssSuit)', stroke: INK, strokeWidth: 5, strokeLinejoin: 'round', strokeLinecap: 'round', ...extra });
  return g({ transform: tf(cx, cy, -14) },
    // tether (curly) back to the truss
    path('M28 30C90 10 110 -80 150 -150C190 -220 80 -260 30 -330', { fill: 'none', stroke: INK, strokeWidth: 7, strokeLinecap: 'round' }),
    path('M28 30C90 10 110 -80 150 -150C190 -220 80 -260 30 -330', { fill: 'none', stroke: '#ffd97a', strokeWidth: 3, strokeLinecap: 'round', strokeDasharray: '8 6' }),
    // backpack
    path(rr(-38, -34, 76, 90, 14), { fill: 'url(#ssSilverV)', stroke: INK, strokeWidth: 5 }),
    // legs
    suit('M-22 40C-30 70 -32 90 -26 110H-6C-2 90 -4 70 -6 44Z'), suit('M6 44C2 70 4 90 8 110H28C34 90 32 70 24 40Z'),
    path(rr(-30, 104, 28, 18, 6), { fill: '#dfe5f7', stroke: INK, strokeWidth: 4 }), path(rr(6, 104, 28, 18, 6), { fill: '#dfe5f7', stroke: INK, strokeWidth: 4 }),
    // torso
    suit(rr(-34, -10, 68, 70, 20)),
    path(rr(-18, 10, 36, 26, 6), { fill: '#a9c4ff', stroke: INK, strokeWidth: 3 }),
    path('M-10 18h6M0 18h6M-10 28h16', { stroke: INK, strokeWidth: 3, strokeLinecap: 'round' }),
    path(circle(24, 0, 5), { fill: '#ff5a6e', stroke: INK, strokeWidth: 2 }),
    // wrench (handle disappears into the glove), then the arms: holding (down-left) and waving (up-right)
    g({ transform: 'translate(-56 80) rotate(206) scale(1.55)' },
      path('M-5 -18H5V26H-5Z', { fill: 'url(#ssGold)', stroke: INK, strokeWidth: 2.5, strokeLinejoin: 'round' }),
      path('M-14 -40C-16 -28 -9 -18 0 -18C9 -18 16 -28 14 -40L7 -40L5 -29H-5L-7 -40Z', { fill: 'url(#ssGold)', stroke: INK, strokeWidth: 2.5, strokeLinejoin: 'round' }),
      path('M-2 -36V-30', { stroke: '#fff6c8', strokeOpacity: 0.9, strokeWidth: 2, strokeLinecap: 'round' })),
    suit('M-28 6C-52 20 -62 44 -60 70L-42 74C-44 54 -36 40 -20 30Z'),
    suit('M26 4C48 -14 60 -40 60 -70L44 -74C40 -52 32 -34 18 -24Z'),
    path(circle(-52, 76, 13), { fill: '#fff', stroke: INK, strokeWidth: 4 }), path(circle(52, -78, 13), { fill: '#fff', stroke: INK, strokeWidth: 4 }),
    // helmet
    path(circle(0, -44, 36), { fill: 'url(#ssSuit)', stroke: INK, strokeWidth: 5 }),
    path(ellipse(2, -42, 27, 24), { fill: 'url(#ssVisor)', stroke: INK, strokeWidth: 4 }),
    path(ellipse(-9, -52, 9, 5), { fill: '#fff', fillOpacity: 0.85, transform: 'rotate(-25 -9 -52)' }),
    path('M-6 -40h0.1M12 -40h0.1', { stroke: INK, strokeWidth: 6, strokeLinecap: 'round' }),
    path('M-2 -32Q4 -27 10 -32', { fill: 'none', stroke: INK, strokeWidth: 3, strokeLinecap: 'round' }),
    path(ellipse(-10, -33, 5, 3), { fill: '#ff9cc8', fillOpacity: 0.8 }), path(ellipse(16, -33, 5, 3), { fill: '#ff9cc8', fillOpacity: 0.8 }),
    path(rr(-20, -14, 40, 12, 5), { fill: 'url(#ssSilverV)', stroke: INK, strokeWidth: 3 }));
}

function draw() {
  const holeD = rr(hole.x, hole.y, hole.w, hole.h, radius);
  const defs = [
    '<style>.ss-beacon{animation:ssBlink 1.8s steps(1,end) infinite}@keyframes ssBlink{0%{opacity:1}45%{opacity:.12}100%{opacity:.12}}'
      + '.ss-glint{animation:ssGlint 7s ease-in-out infinite alternate}@keyframes ssGlint{0%{transform:translateY(-40px)}100%{transform:translateY(300px)}}'
      + '@media (prefers-reduced-motion:reduce){*{animation:none!important}}</style>',
    rg('ssPlanet', [0.5, 0.05, 0.9], [[0, '#8fe8e4'], [0.35, '#5fc9d8'], [0.7, '#4f8fd6'], [1, '#3f55b0']]),
    rg('ssPlanetShade', [0.5, 0.2, 0.9], [[0.55, '#1d2a66', 0], [1, '#1d2a66', 0.5]]),
    rg('ssAtmo', [0.5, 0.5, 0.5], [[0.94, '#bff6ff', 0], [0.975, '#bff6ff', 0.55], [1, '#bff6ff', 0]], false),
    rg('ssShadow', [0.5, 0.5, 0.5], [[0, '#1d2a66', 0.5], [1, '#1d2a66', 0]]),
    lg('ssBody', [0, 0, 0.6, 1], [[0, '#ffffff'], [0.5, '#eef1fb'], [1, '#c9d1e8']]),
    lg('ssQuilt', [0, 0, 1, 1], [[0, '#ffffff'], [0.6, '#eef1fb'], [1, '#cfd6ea']]),
    lg('ssGold', [0, 0, 1, 1], [[0, '#fff1b0'], [0.35, '#f7c84a'], [0.7, '#d9961f'], [1, '#f2c04e']]),
    lg('ssBezel', [0, 0, 1, 1], [[0, '#ffffff'], [0.35, '#e9edfa'], [0.7, '#b9c3df'], [1, '#e5eaf7']]),
    lg('ssBezelIn', [0, 0, 0, 1], [[0, '#59648f'], [1, '#2d3558']]),
    lg('ssSilverV', [0, 0, 0, 1], [[0, '#ffffff'], [0.45, '#d7deef'], [1, '#98a3c4']]),
    lg('ssWhiteV', [0, 0, 0, 1], [[0, '#ffffff'], [0.55, '#eaeefb'], [1, '#b7c1dc']]),
    lg('ssTruss', [0, 0, 0, 1], [[0, '#b8c2dc'], [1, '#7c88ad']]),
    lg('ssRadiator', [0, 0, 0, 1], [[0, '#ffffff'], [1, '#d4dbec']]),
    lg('ssCells', [0, 0, 1, 1], [[0, '#4d7fe0'], [0.5, '#2a52b4'], [1, '#1a337a']]),
    lg('ssCellShine', [0, 0, 1, 1], [[0, '#9cc6ff', 0.35], [0.45, '#9cc6ff', 0]]),
    rg('ssRing', [0.5, 0.4, 0.7], [[0, '#f4f6ff'], [1, '#aab4d2']]),
    rg('ssBall', [0.35, 0.3, 0.8], [[0, '#ffffff'], [0.55, '#d4dbef'], [1, '#7c88ad']]),
    rg('ssBolt', [0.35, 0.3, 0.8], [[0, '#ffffff'], [1, '#aab4d2']]),
    rg('ssBeaconGlow', [0.5, 0.5, 0.5], [[0, '#ff5a6e', 0.6], [1, '#ff5a6e', 0]]),
    lg('ssDish', [0, 0, 1, 1], [[0, '#ffffff'], [0.6, '#dde3f3'], [1, '#a3aecb']]),
    lg('ssSuit', [0, 0, 1, 1], [[0, '#ffffff'], [1, '#d3dbee']]),
    lg('ssVisor', [0, 0, 1, 1], [[0, '#ffe39a'], [0.5, '#f0a92c'], [1, '#8f5a0e']]),
    `<clipPath id="ssBodyClip"><path d="${rr(BODY.x + 3, BODY.y + 3, BODY.w - 6, BODY.h - 6, BODY.r - 3)}"/></clipPath>`,
    `<clipPath id="ssPlanetClip"><path d="${circle(850, 1900, 1150)}"/></clipPath>`,
    `<clipPath id="ssWingLa"><path d="${rr(24, 150, 140, 386, 10)}"/></clipPath>`,
    `<clipPath id="ssWingLb"><path d="${rr(24, 584, 140, 376, 10)}"/></clipPath>`,
    `<clipPath id="ssWingRa"><path d="${rr(1536, 150, 140, 386, 10)}"/></clipPath>`,
    `<clipPath id="ssWingRb"><path d="${rr(1536, 584, 140, 376, 10)}"/></clipPath>`,
  ].join('');

  const rnd = rng(42), stars = [];
  for (let i = 0; i < 26; i++) {
    const x = 20 + rnd() * 1660, y = 20 + rnd() * 760;
    if (x > 200 && x < 1500 && y > 120) continue;
    if (x < 190 && y > 130 && y < 980) continue;
    if (x > 1510 && y > 130 && y < 980) continue;
    stars.push(i % 4 ? circle(x, y, 2 + rnd() * 2.5) : sparkle(x, y, 8 + rnd() * 8));
  }

  const body = [
    planet(),
    path(stars.join(''), { fill: '#fff', fillOpacity: 0.9 }),
    path(sparkle(140, 90, 24), { fill: '#fff6c8', stroke: INK, strokeWidth: 3 }),
    path(sparkle(1600, 120, 18), { fill: '#bff6ff', stroke: INK, strokeWidth: 3 }),
    path(star(1660, 40, 14, 6), { fill: '#ffd166', stroke: INK, strokeWidth: 3 }),
    path(sparkle(60, 1040, 16), { fill: '#fff', stroke: INK, strokeWidth: 2.5 }),
    // station shadow on the planet
    path(ellipse(850, 990, 620, 44), { fill: 'url(#ssShadow)' }),
    wing(-1), wing(1),
    truss(-1), truss(1),
    radiator(560, 905, 200, 80), radiator(940, 905, 200, 80),
    dockingPort(), dish(),
    tube('M330 184V96', 6, 'url(#ssSilverV)', false), path(circle(330, 88, 8), { fill: '#7af0ff', stroke: INK, strokeWidth: 3 }),
    // module body
    path(rr(BODY.x + 6, BODY.y + 10, BODY.w, BODY.h, BODY.r), { fill: INK, fillOpacity: 0.35 }),
    path(rr(BODY.x, BODY.y, BODY.w, BODY.h, BODY.r), { fill: 'url(#ssBody)', stroke: INK, strokeWidth: 7 }),
    quilt(),
    path(`M${BODY.x + 40} ${BODY.y + 24}H${BODY.x + 48}M${BODY.x + 24} ${BODY.y + 160}V${BODY.y + 60}Q${BODY.x + 24} ${BODY.y + 26} ${BODY.x + 58} ${BODY.y + 26}`, { fill: 'none', stroke: '#fff', strokeOpacity: 0.9, strokeWidth: 5, strokeLinecap: 'round' }),
    cupola(holeD),
    arm(),
    astronaut(232, 850),
    path(sparkle(1480, 1000, 14), { fill: '#fff', stroke: INK, strokeWidth: 2.5 }),
  ].join('\n');
  return { defs, body };
}

module.exports = {
  W, H, hole, radius, draw,
  meta: { name: 'Orbital Cupola', theme: 'space-station', rarity: 'epic', translucent: false,
    desc: 'Play from the observation window of your own little space station, solar wings out and a tiny astronaut waving hello.',
    tags: ['space', 'station', 'astronaut', 'sci-fi', 'planet', 'cute'], collection: 'dreamscapes', license: 'CC-BY-4.0' },
};
