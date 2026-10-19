'use strict';
// Synthwave monitor: a dark glossy display in a chrome rim, wrapped in a pink-to-cyan neon tube held by
// chrome clips, standing on a VCR with a rainbow-label tape half inserted. Behind it a layered sunset sun
// with scanline cuts and echo rings; two ranges of wireframe mountains, palm silhouettes and a glowing
// perspective grid floor at the sides. All the busy detail lives on the outer silhouette; the band right
// around the picture is plain dark glass.
const L = require('../lib');
const { rr, path, g, lg, rg, circle, ellipse, sparkle, poly, glowStroke, rng, lip, n, tf } = L;

const W = 1760, H = 1300, CX = W / 2, hole = { x: CX - 560, y: 280, w: 1120, h: 630 }, radius = 0;
const HORIZON = 990, VX = CX, VY = 760;
const PINK = '#ff4fd8', CYAN = '#4ff0ff', VIOLET = '#b56cff', NIGHT = '#0d0420';
const BODY = { x: CX - 604, y: 236, w: 1208, h: 724, r: 34 }; // monitor shell
const TUBE = { x: CX - 628, y: 212, w: 1256, h: 772, r: 58 }; // neon tube around it
const SUN = { cx: CX, cy: 500, r: 470 };

function sun() {
  const { cx, cy, r } = SUN, top = cy - r, bands = [];
  // Scanline cuts: thin near the top of the visible cap, thicker toward the monitor (even-odd holes, clamped to the chord).
  for (let i = 0, y = top + 92; i < 9; i++) {
    const h = 3 + i * 2.2;
    const half = (yy) => Math.sqrt(Math.max(0, r * r - (cy - yy) ** 2)) - 1;
    bands.push(poly([[cx - half(y), y], [cx + half(y), y], [cx + half(y + h), y + h], [cx - half(y + h), y + h]]));
    y += h + 15 - i * 0.6;
  }
  const rings = [[r + 46, 0.5, 3], [r + 92, 0.3, 2.5], [r + 140, 0.16, 2]]
    .map(([rad, a, w]) => path(circle(cx, cy, rad), { fill: 'none', stroke: PINK, strokeOpacity: a, strokeWidth: w })).join('');
  return path(circle(cx, cy, r + 160), { fill: 'url(#haze)' })
    + rings
    + path(circle(cx, cy, r + 30) + circle(cx, cy, r), { fill: 'url(#sunGlow)', fillRule: 'evenodd' })
    + path(circle(cx, cy, r) + bands.join(''), { fill: 'url(#sun)', fillRule: 'evenodd' })
    + path(`M${cx - 250} ${top + 46}A${r - 18} ${r - 18} 0 0 1 ${cx + 40} ${top + 20}`, { fill: 'none', stroke: '#fff', strokeOpacity: 0.4, strokeWidth: 7, strokeLinecap: 'round' });
}

/** Wireframe range at one side (s = -1 left, 1 right): back peaks with cyan wire, a darker front range with a pink ridge. */
function mountains(s) {
  const X = (d) => (s < 0 ? d : W - d);
  const back = [[0, HORIZON], [0, 700], [56, 650], [120, 706], [196, 586], [268, 676], [344, 626], [480, HORIZON]].map(([d, y]) => [X(d), y]);
  const front = [[0, HORIZON], [0, 840], [44, 806], [104, 770], [168, 846], [236, 792], [340, HORIZON]].map(([d, y]) => [X(d), y]);
  const wire = [];
  for (let i = 1; i < back.length - 1; i++) {
    const [x, y] = back[i];
    for (const k of [-1, 0.35, 1]) wire.push(`M${n(x)} ${y}L${n(x + k * (s < 0 ? 1 : -1) * (HORIZON - y) * 0.42)} ${HORIZON}`);
  }
  for (const yy of [760, 860, 940]) wire.push(`M${X(0)} ${yy}H${X(480)}`); // contour lines, clipped to the range below
  const id = `mclip${s < 0 ? 'L' : 'R'}`;
  return `<clipPath id="${id}"><path d="${poly(back)}"/></clipPath>`
    + path(poly(back), { fill: 'url(#mountBack)' })
    + g({ clipPath: `url(#${id})` }, path(wire.join(''), { fill: 'none', stroke: CYAN, strokeOpacity: 0.32, strokeWidth: 2.5 }))
    + glowStroke(poly(back.slice(1, -1), false), CYAN, 3, [[4, 0.12], [2, 0.25], [1, 0.95]])
    + path(poly(front), { fill: 'url(#mountFront)' })
    + glowStroke(poly(front.slice(1, -1), false), PINK, 2.6, [[4, 0.12], [2, 0.25], [1, 0.9]]);
}

/** Palm frond: a smooth arching crescent from the crown (bx, by) to a drooping tip, with two leaflet cuts. */
function frond(bx, by, ang, len, droop, w = 34) {
  const a = (ang * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a), nx = -s, ny = c;
  const ex = bx + c * len, ey = by + s * len + droop;
  const mx = bx + c * len * 0.55, my = by + s * len * 0.55 - w * 0.75;
  const flip = c < 0 ? -1 : 1; // keep the belly of every frond on its upper side
  const up = [mx - flip * nx * w, my - flip * ny * w], lo = [mx + flip * nx * w * 0.2, my + flip * ny * w * 0.2 + w * 0.65];
  // two notches cut into the lower edge, swept toward the tip
  const q = (t, k) => [bx + (ex - bx) * t + (lo[0] - (bx + ex) / 2) * 4 * t * (1 - t) * k, by + (ey - by) * t + (lo[1] - (by + ey) / 2) * 4 * t * (1 - t) * k];
  const n1 = q(0.62, 0.35), n2 = q(0.36, 0.3), b1 = q(0.8, 1.15), b2 = q(0.5, 1.1), b3 = q(0.22, 1.05);
  return `M${L.P(bx, by - w * 0.18)}Q${L.P(...up)} ${L.P(ex, ey)}Q${L.P(...b1)} ${L.P(...n1)}Q${L.P(...b2)} ${L.P(...n2)}Q${L.P(...b3)} ${L.P(bx, by + w * 0.22)}Z`;
}

function palm(x, top, s, scale = 1) {
  const tx = x + s * 70 * scale, ty = top;
  const trunk = `M${x - 16 * scale} ${HORIZON}C${x - 12 * scale} ${n(HORIZON - 160 * scale)} ${n(x + s * 28 * scale)} ${n(ty + 140 * scale)} ${n(tx - 9)} ${ty}`
    + `L${n(tx + 9)} ${ty + 5}C${n(x + s * 44 * scale)} ${n(ty + 150 * scale)} ${x + 16 * scale} ${n(HORIZON - 160 * scale)} ${x + 18 * scale} ${HORIZON}Z`;
  const fr = [[-178, 200, 120], [-156, 220, 80], [-128, 170, 34], [-100, 120, 12], [-70, 150, 22], [-36, 210, 70], [-6, 200, 118], [148, 130, 96], [34, 130, 96]]
    .map(([ang, len, d]) => frond(tx, ty, ang, len * scale, d * scale, 26 * scale));
  const rings = Array.from({ length: 11 }, (_, i) => {
    const t = (i + 0.5) / 11, y = HORIZON - (HORIZON - ty) * t, xx = x + (tx - x) * t * t;
    return `M${n(xx - 13 * scale)} ${n(y + 4)}l${n(26 * scale)} -8`;
  }).join('');
  const coco = [[-14, 14], [6, 18], [-2, 4]].map(([dx, dy]) => circle(tx + dx * scale, ty + dy * scale, 9 * scale)).join('');
  // pink rim on the silhouette only: a fat stroke underneath, then every piece filled dark on top
  const rim = { fill: PINK, stroke: PINK, strokeWidth: 5, strokeLinejoin: 'round' };
  return path(trunk + fr.join(''), rim) + path(trunk, { fill: NIGHT }) + fr.map((d) => path(d, { fill: NIGHT })).join('')
    + path(rings, { stroke: PINK, strokeOpacity: 0.4, strokeWidth: 2 })
    + path(coco, { fill: '#1d0838', stroke: PINK, strokeOpacity: 0.6, strokeWidth: 2 });
}

function grid() {
  const lines = [];
  for (let i = -14; i <= 14; i++) {
    const xb = VX + i * 150, t = (HORIZON - VY) / (H - VY), xh = VX + (xb - VX) * t;
    lines.push(`M${n(xh)} ${HORIZON}L${n(xb)} ${H}`);
  }
  for (let k = 1; k <= 9; k++) lines.push(`M0 ${n(HORIZON + (H - HORIZON) * Math.pow(k / 9, 1.8))}H${W}`);
  return path(`M0 ${HORIZON}H${W}V${H}H0Z`, { fill: 'url(#floor)' })
    + glowStroke(lines.join(''), 'url(#gridFade)', 3, [[3.2, 0.16], [1, 1]])
    + glowStroke(`M0 ${HORIZON}H${W}`, 'url(#horizonFade)', 3, [[5, 0.15], [2.2, 0.3], [1, 1]]);
}

/** Front-loading VCR under the monitor with a tape sticking out of the slot. */
function vcr() {
  const x = CX - 348, y = 1000, w = 696, h = 96, out = [];
  out.push(path(ellipse(CX, y + h + 6, 420, 26), { fill: 'url(#shadow)' }));
  out.push(path(rr(x, y, w, h, 12), { fill: 'url(#vcr)', stroke: '#000', strokeWidth: 3 }));
  out.push(path(rr(x + 3, y + 3, w - 6, 16, [10, 10, 0, 0]), { fill: 'url(#chrome)' }));
  out.push(path(`M${x + 14} ${y + 20}H${x + w - 14}`, { stroke: '#000', strokeOpacity: 0.6, strokeWidth: 2 }));
  // slot + tape spine with a rainbow label
  out.push(path(rr(x + 96, y + 34, 340, 30, 5), { fill: '#05030a', stroke: '#3a3352', strokeWidth: 2 }));
  out.push(path(rr(x + 112, y + 26, 308, 32, 4), { fill: '#141019', stroke: '#000', strokeWidth: 2 }));
  out.push(path(rr(x + 128, y + 31, 236, 22, 3), { fill: '#f4ecdc' }));
  ['#ff3b6b', '#ff8a3d', '#ffd166', '#5fe08a', '#4fb8ff'].forEach((c, i) => out.push(path(`M${x + 300 + i * 12} ${y + 31}h12v22h-12Z`, { fill: c })));
  out.push(path(`M${x + 142} ${y + 39}h120M${x + 142} ${y + 46}h76`, { stroke: '#3a3352', strokeOpacity: 0.7, strokeWidth: 3, strokeLinecap: 'round', strokeDasharray: '16 6 6 6' }));
  out.push(path(rr(x + 96, y + 64, 340, 6, 2), { fill: '#2a2438' }));
  // level meter: dim bars rising cyan to pink
  const dx = x + 474, dy = y + 32, bars = [];
  out.push(path(rr(dx, dy, 150, 38, 5), { fill: '#06121a', stroke: '#2a2438', strokeWidth: 2 }));
  [0.5, 0.8, 0.65, 0.95, 0.7, 0.45, 0.75, 0.55, 0.35, 0.6, 0.4, 0.25].forEach((v, i) => {
    const hgt = 4 + v * 24;
    bars.push(`M${dx + 10 + i * 11.2} ${n(dy + 32 - hgt)}h7v${n(hgt)}h-7Z`);
  });
  out.push(path(bars.join(''), { fill: 'url(#meter)', fillOpacity: 0.8 }));
  // buttons, power light, feet
  for (let i = 0; i < 5; i++) out.push(path(rr(x + 22 + i * 13, y + 40, 9, 22, 3), { fill: i === 0 ? '#ff4f7a' : '#3a3352', stroke: '#000', strokeWidth: 1.5 }));
  for (let i = 0; i < 4; i++) out.push(path(rr(x + 474 + i * 38, y + 76, 30, 10, 3), { fill: 'url(#chrome)', stroke: '#000', strokeWidth: 1.5 }));
  out.push(path(circle(x + w - 34, y + 50, 13), { fill: 'url(#knob)', stroke: '#000', strokeWidth: 2 }));
  out.push(path(`M${x + w - 34} ${y + 41}v8`, { stroke: '#2a2438', strokeWidth: 3, strokeLinecap: 'round' }));
  for (const fx of [x + 40, x + w - 80]) out.push(path(rr(fx, y + h, 40, 7, 2), { fill: '#05030a' }));
  return out.join('');
}

function draw() {
  const holeD = rr(hole.x, hole.y, hole.w, hole.h, radius);
  const body = rr(BODY.x, BODY.y, BODY.w, BODY.h, BODY.r), tube = rr(TUBE.x, TUBE.y, TUBE.w, TUBE.h, TUBE.r);
  const fade = (id, c, st) => `<radialGradient id="${id}" cx="${CX}" cy="${HORIZON}" r="900" gradientUnits="userSpaceOnUse" gradientTransform="translate(${CX} ${HORIZON}) scale(1 0.4) translate(${-CX} ${-HORIZON})">${L.stops(st.map(([o, a]) => [o, c, a]))}</radialGradient>`;
  const defs = [
    lg('sun', [0, SUN.cy - SUN.r, 0, SUN.cy - SUN.r + 260], [[0, '#fff27a'], [0.22, '#ffc34d'], [0.45, '#ff8a3d'], [0.72, '#ff2e88'], [1, '#c0168a']], true),
    rg('sunGlow', [0.5, 0.5, 0.5], [[0.93, '#ff6ad5', 0.6], [1, '#ff6ad5', 0]]),
    rg('haze', [0.5, 0.5, 0.5], [[0.6, '#b0137a', 0.28], [0.8, '#5a1a8a', 0.12], [1, '#2a0a50', 0]]),
    lg('mountBack', [0, 600, 0, HORIZON], [[0, '#4a1580'], [1, '#160636']], true),
    lg('mountFront', [0, 780, 0, HORIZON], [[0, '#22093f'], [1, '#0a0318']], true),
    fade('floor', '#1d0838', [[0, 1], [0.72, 0.95], [1, 0]]),
    fade('gridFade', PINK, [[0, 1], [0.68, 1], [1, 0]]),
    lg('horizonFade', [0, 0, W, 0], [[0, '#ffd0f4', 0], [0.12, '#ffd0f4'], [0.88, '#ffd0f4'], [1, '#ffd0f4', 0]], true),
    rg('shadow', [0.5, 0.5, 0.5], [[0, '#000', 0.6], [1, '#000', 0]]),
    rg('reflect', [0.5, 0.5, 0.5], [[0, CYAN, 0.3], [1, CYAN, 0]]),
    lg('bezel', [0, 0, 0, 1], [[0, '#211b2e'], [0.08, '#120f1a'], [1, '#08070c']]),
    // 80s chrome: sky, a hard horizon, dark ground, a pink kick at the bottom
    lg('chrome', [0, 0, 0, 1], [[0, '#ffffff'], [0.3, '#bfe4ff'], [0.49, '#8fa8d8'], [0.5, '#2a2050'], [0.72, '#7a5aa0'], [1, '#ffc2f0']]),
    lg('chromeRim', [0, BODY.y, 0, BODY.y + BODY.h], [[0, '#d9e6ff'], [0.04, '#8fa8d8'], [0.42, '#6d7fb0'], [0.5, '#2e2452'], [0.58, '#4f3a7a'], [0.95, '#a46cb8'], [1, '#e2a8e6']], true),
    lg('neon', [TUBE.x, 0, TUBE.x + TUBE.w, 0], [[0, PINK], [0.5, VIOLET], [1, CYAN]], true),
    lg('vcr', [0, 0, 0, 1], [[0, '#2a2438'], [0.25, '#16121f'], [1, '#09070e']]),
    rg('knob', [0.35, 0.3, 0.8], [[0, '#ffffff'], [0.5, '#a9a2c8'], [1, '#3a3352']]),
    lg('comet', [0, 0, 1, 0], [[0, '#fff', 0], [1, '#fff', 0.9]]),
    lg('meter', [0, 1032, 0, 1064], [[0, PINK], [0.5, VIOLET], [1, CYAN]], true),
  ].join('');

  const rnd = rng(3), stars = [];
  for (let i = 0; i < 70; i++) {
    const x = rnd() * W, y = 8 + rnd() * 640;
    if (x > TUBE.x - 30 && x < TUBE.x + TUBE.w + 30 && y > 190) continue;
    if (Math.hypot(x - SUN.cx, y - SUN.cy) < SUN.r + 40) continue;
    stars.push(i % 7 ? circle(x, y, 1.4 + rnd() * 2.2) : sparkle(x, y, 9 + rnd() * 8));
  }
  const comet = (x, y, len, ang) => {
    const a = (ang * Math.PI) / 180, ex = x - Math.cos(a) * len, ey = y - Math.sin(a) * len;
    return path(`M${n(ex)} ${n(ey)}L${x} ${y}`, { stroke: 'url(#comet)', strokeWidth: 4, strokeLinecap: 'round' }) + path(circle(x, y, 4), { fill: '#fff' });
  };
  const clips = [];
  for (const cx of [158, 388, 868, 1098].map((d) => TUBE.x + d)) for (const cy of [TUBE.y, TUBE.y + TUBE.h]) clips.push(rr(cx - 9, cy - 17, 18, 34, 4));
  for (const cy of [420, 780]) for (const cx of [TUBE.x, TUBE.x + TUBE.w]) clips.push(rr(cx - 17, cy - 9, 34, 18, 4));

  const art = [
    path(stars.join(''), { fill: '#fff', fillOpacity: 0.85 }),
    comet(200, 130, 160, 25), comet(W - 190, 70, 130, 155),
    sun(),
    mountains(-1), mountains(1),
    grid(),
    palm(70, 590, 1, 0.78), palm(196, 470, 1, 1.05),
    palm(W - 70, 590, -1, 0.78), palm(W - 196, 470, -1, 1.05),
    path(ellipse(CX, 1110, 380, 34), { fill: 'url(#reflect)' }),
    // monitor feet onto the VCR
    [CX - 200, CX + 160].map((x) => path(rr(x, 950, 40, 54, 6), { fill: 'url(#chrome)', stroke: '#000', strokeWidth: 3 })).join(''),
    vcr(),
    // drop shadow, neon tube glow behind the shell
    path(rr(BODY.x + 8, BODY.y + 14, BODY.w, BODY.h, BODY.r), { fill: '#000', fillOpacity: 0.45 }),
    glowStroke(tube, 'url(#neon)', 9, [[6, 0.05], [3.6, 0.1], [2.2, 0.2]]),
    // the shell: dark glass with a chrome rim
    path(body, { fill: 'url(#bezel)' }),
    path(rr(BODY.x + 7, BODY.y + 7, BODY.w - 14, BODY.h - 14, BODY.r - 6), { fill: 'none', stroke: 'url(#chromeRim)', strokeWidth: 12 }),
    path(rr(BODY.x + 1, BODY.y + 1, BODY.w - 2, BODY.h - 2, BODY.r - 1), { fill: 'none', stroke: '#000', strokeWidth: 2.5 }),
    path(rr(BODY.x + 15, BODY.y + 15, BODY.w - 30, BODY.h - 30, BODY.r - 14), { fill: 'none', stroke: '#000', strokeOpacity: 0.7, strokeWidth: 2.5 }),
    // calm inner band: plain dark glass and a soft lip
    path(rr(hole.x - 10, hole.y - 10, hole.w + 20, hole.h + 20, 6), { fill: '#06050a', stroke: '#241d34', strokeWidth: 2 }),
    lip(holeD, '#000', [[6, 0.3], [2, 0.6]]),
    path(`M${BODY.x + 30} 520V${BODY.y + 52}Q${BODY.x + 30} ${BODY.y + 26} ${BODY.x + 62} ${BODY.y + 26}H${BODY.x + 424}`, { fill: 'none', stroke: '#fff', strokeOpacity: 0.1, strokeWidth: 4, strokeLinecap: 'round' }),
    // the neon tube itself, with chrome clips
    path(tube, { fill: 'none', stroke: '#2a0f3a', strokeWidth: 15 }),
    path(tube, { fill: 'none', stroke: 'url(#neon)', strokeWidth: 9 }),
    path(tube, { fill: 'none', stroke: '#fff', strokeOpacity: 0.55, strokeWidth: 2.5 }),
    path(clips.join(''), { fill: 'url(#chrome)', stroke: '#000', strokeWidth: 2.5 }),
    // chin: a small chrome badge and a quiet power light
    path(`M${CX - 22} 948L${CX} 928L${CX + 22} 948Z`, { fill: 'url(#chrome)', stroke: '#000', strokeWidth: 2 }),
    path(circle(BODY.x + BODY.w - 66, 936, 5), { fill: CYAN, fillOpacity: 0.7 }),
    path(`M${BODY.x + 66} 936h56M${BODY.x + 136} 936h22`, { stroke: PINK, strokeOpacity: 0.4, strokeWidth: 4, strokeLinecap: 'round' }),
  ].join('\n');
  return { defs, body: art };
}

module.exports = {
  W, H, hole, radius, draw,
  meta: { name: 'Synthwave', theme: 'synthwave', rarity: 'epic', translucent: false,
    desc: 'A chrome-and-neon display on a humming VCR at the edge of an endless 1986 sunset grid.', tags: ['monitor', 'neon', 'retro', '80s', 'synthwave'] },
};
