'use strict';
// Demon Crown: a baroque frame for dark royalty. Gilt filigree molding around a deep crimson velvet
// liner, sapphire cabochons in the corners and rubies in scrolled side cartouches; great glossy black
// horns with gold cuffs rise from the top corners, a spiked diadem with a heart-cut ruby crowns the top
// with pearl-hung chains swagged to the horns, sapphire pendants dangle at the sides and a white lace
// ruff (real see-through eyelets) frills out under the bottom, pinned by a ruby brooch.
const L = require('../lib');
const { rr, path, g, lg, rg, circle, ellipse, sparkle, poly, tf, rng, lip, smooth, n, P } = L;

const W = 1600, H = 1440, hole = { x: 320, y: 540, w: 960, h: 540 }, radius = 6;
const CX = W / 2;
const INK = '#1a0508';
const B = 124; // frame width
const O = { x: hole.x - B, y: hole.y - B, w: hole.w + 2 * B, h: hole.h + 2 * B }; // outer edge of the molding
const mirror = (...kids) => g({}, ...kids) + g({ transform: `translate(${W} 0) scale(-1 1)` }, ...kids);

// ---- molding -----------------------------------------------------------------------------------
/** Mitered band between insets a and b from the outer edge, each side with its own gradient. */
function band(id, a, b, list, dark = 0.2) {
  const x0 = O.x + a, y0 = O.y + a, x1 = O.x + O.w - a, y1 = O.y + O.h - a;
  const X0 = O.x + b, Y0 = O.y + b, X1 = O.x + O.w - b, Y1 = O.y + O.h - b;
  const sides = {
    t: [[[x0, y0], [x1, y0], [X1, Y0], [X0, Y0]], [0, y0, 0, Y0], 0],
    r: [[[x1, y0], [x1, y1], [X1, Y1], [X1, Y0]], [x1, 0, X1, 0], dark * 0.6],
    b: [[[x1, y1], [x0, y1], [X0, Y1], [X1, Y1]], [0, y1, 0, Y1], dark],
    l: [[[x0, y1], [x0, y0], [X0, Y0], [X0, Y1]], [x0, 0, X0, 0], 0],
  };
  let defs = '', body = '';
  for (const [k, [pts, c, shade]] of Object.entries(sides)) {
    defs += lg(`${id}-${k}`, c, list, true);
    body += path(poly(pts), { fill: `url(#${id}-${k})` });
    if (shade) body += path(poly(pts), { fill: '#2a0408', fillOpacity: shade });
  }
  return { defs, body };
}
/** Apply a strip generator (local x along the side, y across) to the four sides at inset d. */
function aroundSides(d, gen) {
  const cx = O.x + O.w / 2, cy = O.y + O.h / 2, hw = O.w / 2 - d, hh = O.h / 2 - d;
  return g({ transform: tf(cx, cy - hh) }, gen(O.w - 2 * d)) + g({ transform: `${tf(cx, cy + hh)} rotate(180)` }, gen(O.w - 2 * d))
    + g({ transform: `${tf(cx - hw, cy)} rotate(-90)` }, gen(O.h - 2 * d)) + g({ transform: `${tf(cx + hw, cy)} rotate(90)` }, gen(O.h - 2 * d));
}
/** Openwork filigree strip: interlocking S-scrolls with tiny gold beads, length len, centred on y = 0. */
function filigree(len, unit = 64, skip = 0) {
  const count = Math.floor(len / unit), start = -((count - 1) * unit) / 2;
  let d = '', beads = '';
  for (let i = 0; i < count; i++) {
    const x = start + i * unit;
    if (skip && Math.abs(x) < skip) continue;
    const s = i % 2 ? 1 : -1;
    d += `M${P(x - unit / 2, 0)}C${P(x - unit / 3, -14 * s, x - 4, -16 * s, x, -6 * s)}C${P(x + 4, 2 * s, x - 8, 8 * s, x - 10, 2 * s)}`;
    d += `M${P(x, -6 * s)}C${P(x + 6, 10 * s, x + unit / 3, 14 * s, x + unit / 2, 0)}`;
    beads += circle(x + unit / 2, 0, 3.4) + circle(x - 10, 2 * s, 2.6);
  }
  return path(d, { fill: 'none', stroke: '#3a2205', strokeWidth: 6, strokeLinecap: 'round' })
    + path(d, { fill: 'none', stroke: 'url(#goldS)', strokeWidth: 3.2, strokeLinecap: 'round' })
    + path(beads, { fill: 'url(#goldR)', stroke: '#3a2205', strokeWidth: 1 });
}
/** Gold beads all around the slip at inset d: zero-length round dashes draw the beads (tiny markup). */
function pearlRow(d, unit = 20) {
  const r = rr(O.x + d, O.y + d, O.w - 2 * d, O.h - 2 * d, 0);
  return path(r, { fill: 'none', stroke: '#3a2205', strokeWidth: 12, strokeLinecap: 'round', strokeDasharray: `0 ${unit}` })
    + path(r, { fill: 'none', stroke: '#e8b44a', strokeWidth: 9.5, strokeLinecap: 'round', strokeDasharray: `0 ${unit}` })
    + path(r, { fill: 'none', stroke: '#fff3c4', strokeWidth: 4, strokeLinecap: 'round', strokeDasharray: `0 ${unit}`, transform: 'translate(-1.6 -1.6)' });
}

// ---- jewels ------------------------------------------------------------------------------------
/** Oval cabochon (gem 'ruby' | 'sapph') in a scalloped gold bezel. */
function cabochon(x, y, rx, ry, gem, rot = 0) {
  // a ring of 12 gold beads: round-capped dashes on a normalised path length
  const ring = (w, col) => `<path d="${ellipse(x, y, rx + 7, ry + 7)}" pathLength="120" fill="none" stroke="${col}" stroke-width="${w}" stroke-linecap="round" stroke-dasharray="0 10"/>`;
  return g({ transform: rot ? `rotate(${n(rot)} ${n(x)} ${n(y)})` : null },
    path(ellipse(x + 3, y + 5, rx + 12, ry + 12), { fill: INK, fillOpacity: 0.35 }),
    ring(10.5, '#3a2205'), ring(8, '#e8b44a'),
    path(ellipse(x, y, rx + 7, ry + 7), { fill: 'url(#goldD)', stroke: '#3a2205', strokeWidth: 2.5 }),
    path(ellipse(x, y, rx, ry), { fill: `url(#${gem})`, stroke: INK, strokeWidth: 2 }),
    path(ellipse(x - rx * 0.32, y - ry * 0.4, rx * 0.36, ry * 0.2), { fill: '#fff', fillOpacity: 0.8, transform: `rotate(-24 ${n(x - rx * 0.32)} ${n(y - ry * 0.4)})` }),
    path(ellipse(x + rx * 0.3, y + ry * 0.45, rx * 0.3, ry * 0.12), { fill: '#fff', fillOpacity: 0.25 }));
}
/** Pearl with a soft sheen. */
const pearl = (x, y, r) => path(circle(x, y, r), { fill: 'url(#pearl)', stroke: INK, strokeWidth: 1.4 }) + path(circle(x - r * 0.35, y - r * 0.35, r * 0.3), { fill: '#fff' });
/** Gold C-scroll ending in a curl (local coords; sweep dir 1 = clockwise). */
function cscroll(x, y, r, a0, sweep, dir = 1, width = 9) {
  const pts = [];
  for (let i = 0; i <= 12; i++) { const t = i / 12, a = a0 + dir * sweep * t, rr0 = r * (1 - 0.6 * t); pts.push([x + rr0 * Math.cos(a), y + rr0 * Math.sin(a)]); }
  const d = smooth(pts), [ex, ey] = pts[pts.length - 1];
  return path(d, { fill: 'none', stroke: '#3a2205', strokeWidth: width + 5, strokeLinecap: 'round' })
    + path(d, { fill: 'none', stroke: 'url(#goldS)', strokeWidth: width, strokeLinecap: 'round' })
    + path(d, { fill: 'none', stroke: '#fff6d0', strokeOpacity: 0.6, strokeWidth: 2, strokeLinecap: 'round', transform: 'translate(-1.5 -1.5)' })
    + path(circle(ex, ey, width * 0.7), { fill: 'url(#goldR)', stroke: '#3a2205', strokeWidth: 1.5 });
}
/** Acanthus-like gold leaf from (x, y) toward angle rot (deg), length len. */
function goldLeaf(x, y, rot, len, w) {
  const d = `M0 0C${P(w, -len * 0.2, w * 1.2, -len * 0.6, w * 0.2, -len)}C${P(w * 0.1, -len * 0.75, -w * 0.4, -len * 0.7, -w * 0.5, -len * 0.55)}`
    + `C${P(-w * 0.9, -len * 0.5, -w * 1.1, -len * 0.25, 0, 0)}Z`;
  return path(d, { fill: 'url(#goldD)', stroke: '#3a2205', strokeWidth: 2, strokeLinejoin: 'round', transform: tf(x, y, rot) })
    + path(`M0 ${n(-len * 0.1)}Q${P(w * 0.3, -len * 0.5, w * 0.2, -len * 0.85)}`, { fill: 'none', stroke: '#fff6d0', strokeOpacity: 0.7, strokeWidth: 1.8, strokeLinecap: 'round', transform: tf(x, y, rot) });
}

// ---- horns -------------------------------------------------------------------------------------
/**
 * Left horn: a faceted, glossy black body along a cubic spine (it rises from behind the top corner,
 * sweeps out and curls back in at the tip), split into lit and shaded facets per segment like cut jet,
 * with ridge seams, a blue-violet sheen, a crimson rim light and a gold cuff set with a ruby.
 */
function horn() {
  const S = [[316, 452], [178, 236], [-14, 150], [236, 14]], N = 15, w0 = 208;
  const bez = (t, k) => (1 - t) ** 3 * S[0][k] + 3 * (1 - t) ** 2 * t * S[1][k] + 3 * (1 - t) * t * t * S[2][k] + t ** 3 * S[3][k];
  const der = (t, k) => 3 * (1 - t) ** 2 * (S[1][k] - S[0][k]) + 6 * (1 - t) * t * (S[2][k] - S[1][k]) + 3 * t * t * (S[3][k] - S[2][k]);
  const at = (t) => {
    const x = bez(t, 0), y = bez(t, 1), dx = der(t, 0), dy = der(t, 1), l = Math.hypot(dx, dy), w = (w0 * Math.pow(1 - t, 1.1)) / 2 + 1;
    return { x, y, tx: dx / l, ty: dy / l, nx: dy / l, ny: -dx / l, w };
  };
  // n points to the outer side of the curl (left / up), which faces the light
  const outer = [], inner = [], mid = [];
  for (let i = 0; i <= N; i++) {
    const t = (i / N) ** 0.9, p = at(t), k = i % 2 ? 0.34 : 0.26; // the facet ridge zig-zags a little
    outer.push([p.x + p.nx * p.w, p.y + p.ny * p.w]);
    inner.push([p.x - p.nx * p.w, p.y - p.ny * p.w]);
    mid.push([p.x + p.nx * p.w * k, p.y + p.ny * p.w * k]);
  }
  const body = poly([...outer, ...inner.slice().reverse()]);
  let litA = '', litB = '', darkA = '', darkB = '', seams = '';
  for (let i = 0; i < N; i++) {
    const q1 = poly([outer[i], outer[i + 1], mid[i + 1], mid[i]]), q2 = poly([mid[i], mid[i + 1], inner[i + 1], inner[i]]);
    if (i % 2) { litA += q1; darkA += q2; } else { litB += q1; darkB += q2; }
    if (i) seams += `M${P(...outer[i])}L${P(...mid[i])}L${P(...inner[i])}`;
  }
  const spec = smooth(outer.slice(1, N - 1).map(([x, y], i) => [x + (mid[i + 1][0] - x) * 0.3, y + (mid[i + 1][1] - y) * 0.3]));
  const rim = smooth(inner.slice(2, N - 1));
  const c0 = at(0.12), c1 = at(0.2);
  const e = (p, s) => [p.x + p.nx * (p.w + 8) * s, p.y + p.ny * (p.w + 8) * s];
  const cuff = poly([e(c0, 1), e(c1, 1), e(c1, -1), e(c0, -1)]);
  const cm = at(0.16);
  return {
    horn: g({},
      path(body, { fill: '#000', fillOpacity: 0.35, transform: 'translate(10 12)' }),
      path(body, { fill: '#0c0a12' }),
      path(litB, { fill: '#4a4a72' }), path(litA, { fill: '#2e2d48' }),
      path(darkB, { fill: '#1b1726' }), path(darkA, { fill: '#09070d' }),
      path(seams, { fill: 'none', stroke: '#050307', strokeWidth: 2.5, strokeLinejoin: 'round' }),
      path(poly([...outer, ...mid.slice().reverse()]), { fill: 'url(#hornLit)' }),
      path(spec, { fill: 'none', stroke: '#c9d0ff', strokeOpacity: 0.8, strokeWidth: 4, strokeLinecap: 'round' }),
      path(rim, { fill: 'none', stroke: '#ff3a5a', strokeOpacity: 0.5, strokeWidth: 3.5, strokeLinecap: 'round' }),
      path(body, { fill: 'none', stroke: INK, strokeWidth: 4, strokeLinejoin: 'round' }),
      // gold cuff with a ruby
      path(cuff, { fill: 'url(#goldD)', stroke: '#3a2205', strokeWidth: 3, strokeLinejoin: 'round' }),
      path(`M${P(...e(c0, 0.92))}L${P(...e(c0, -0.92))}`, { stroke: '#fff6d0', strokeOpacity: 0.7, strokeWidth: 2.5, transform: `translate(${n(c0.tx * 6)} ${n(c0.ty * 6)})` }),
      path(`M${P(...e(c1, 0.92))}L${P(...e(c1, -0.92))}`, { stroke: '#3a2205', strokeOpacity: 0.6, strokeWidth: 2, transform: `translate(${n(-c1.tx * 6)} ${n(-c1.ty * 6)})` }),
      cabochon(cm.x + cm.nx * 6, cm.y + cm.ny * 6, 15, 11, 'ruby', (Math.atan2(cm.ty, cm.tx) * 180) / Math.PI + 90)),
    cuffAt: e(cm, -1),
  };
}

/** Spiked diadem with a heart-cut ruby and pearl-tipped points. */
function diadem() {
  const by = O.y + 10, cy = by - 70;
  const spikes = [[-150, 64, 0.62], [-96, 100, 0.8], [-48, 132, 0.92], [0, 176, 1], [48, 132, 0.92], [96, 100, 0.8], [150, 64, 0.62]];
  let crown = `M${P(CX - 190, by)}`;
  for (const [dx, h] of spikes) crown += `L${P(CX + dx - 22, by - 34)}L${P(CX + dx, by - h)}L${P(CX + dx + 22, by - 34)}`;
  crown += `L${P(CX + 190, by)}Z`;
  const heart = L.heart(CX, cy + 6, 30);
  return g({ transform: `translate(${CX} ${by}) scale(1.38) translate(${-CX} ${-by})` },
    path(circle(CX, cy, 170), { fill: 'url(#crestGlow)' }),
    path(crown, { fill: INK, fillOpacity: 0.35, transform: 'translate(6 9)' }),
    path(crown, { fill: 'url(#goldD)', stroke: '#3a2205', strokeWidth: 3.5, strokeLinejoin: 'round' }),
    path(rr(CX - 196, by - 40, 392, 30, 12), { fill: 'url(#goldV)', stroke: '#3a2205', strokeWidth: 3 }),
    g({ transform: tf(0, by - 25) }, ...[-150, -110, -70, 70, 110, 150].map((dx) => pearl(CX + dx, 0, 5))),
    ...spikes.map(([dx, h, k]) => pearl(CX + dx, by - h - 6 * k, 9 * k)),
    ...[-96, 96].map((dx) => cabochon(CX + dx, by - 62, 9, 12, 'sapph')),
    ...[-48, 48].map((dx) => cabochon(CX + dx, by - 74, 7, 9, 'ruby')),
    // heart-cut ruby
    path(L.heart(CX, cy + 8, 40), { fill: 'url(#goldD)', stroke: '#3a2205', strokeWidth: 3 }),
    path(heart, { fill: 'url(#ruby)', stroke: INK, strokeWidth: 2.5 }),
    path(`M${P(CX, cy - 8)}L${P(CX - 14, cy + 2)}L${P(CX, cy + 30)}L${P(CX + 14, cy + 2)}Z`, { fill: '#ff8fa3', fillOpacity: 0.35 }),
    path(ellipse(CX - 12, cy - 6, 8, 5), { fill: '#fff', fillOpacity: 0.85, transform: `rotate(-30 ${CX - 12} ${cy - 6})` }),
    path(sparkle(CX + 26, cy - 30, 12), { fill: '#fff' }));
}

/** Gold chain swag with pearl drops between two points. */
function chain(a, b, sag, drops = 5) {
  const pts = [];
  for (let i = 0; i <= 24; i++) { const t = i / 24; pts.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t + sag * Math.sin(Math.PI * t)]); }
  const line = smooth(pts);
  let dr = '';
  for (let k = 1; k <= drops; k++) {
    const [x, y] = pts[Math.round((k * 24) / (drops + 1))], len = 14 + (k % 2 ? 8 : 0);
    dr += path(`M${P(x, y)}V${n(y + len)}`, { stroke: '#b8862a', strokeWidth: 2 }) + pearl(x, y + len + 5, k % 2 ? 6 : 5);
  }
  // links: dark dashes with gold dashes inside, offset half a link for the interlocking look
  return path(line, { fill: 'none', stroke: '#3a2205', strokeWidth: 7, strokeLinecap: 'round', strokeDasharray: '7 3' })
    + path(line, { fill: 'none', stroke: '#f0c45a', strokeWidth: 3.5, strokeLinecap: 'round', strokeDasharray: '5 5' })
    + path(line, { fill: 'none', stroke: '#fff3c4', strokeWidth: 1.5, strokeLinecap: 'round', strokeDasharray: '2 8', transform: 'translate(-0.8 -1)' }) + dr;
}

/** Baroque corner: sapphire in a quatrefoil gold setting with C-scrolls and leaves (top-left; mirrored). */
function corner(x, y) {
  return g({},
    goldLeaf(x + 30, y + 6, 72, 92, 20), goldLeaf(x + 6, y + 30, 198, 92, 20),
    cscroll(x + 66, y - 18, 22, Math.PI * 0.9, Math.PI * 1.2, 1, 7),
    cscroll(x - 18, y + 66, 22, Math.PI * 1.6, Math.PI * 1.2, -1, 7),
    path(L.circle(x, y, 44), { fill: INK, fillOpacity: 0.35, transform: 'translate(4 6)' }),
    ...[0, 90, 180, 270].map((r) => path(L.circle(x + 24 * Math.cos((r - 45) * Math.PI / 180), y + 24 * Math.sin((r - 45) * Math.PI / 180), 22), { fill: 'url(#goldD)', stroke: '#3a2205', strokeWidth: 2.5 })),
    cabochon(x, y, 22, 22, 'sapph'));
}

/** Side cartouche: a scrolled gold shield with a big ruby, and a sapphire pendant hanging under it. */
function sideCartouche() {
  const x = O.x + 18, y = O.y + O.h / 2;
  const shield = `M${P(x, y - 86)}C${P(x - 40, y - 70, x - 52, y - 30, x - 46, y)}C${P(x - 52, y + 30, x - 40, y + 70, x, y + 86)}C${P(x + 22, y + 60, x + 26, y + 30, x + 24, y)}C${P(x + 26, y - 30, x + 22, y - 60, x, y - 86)}Z`;
  const px = x - 54, py = y + 110;
  return g({},
    cscroll(x - 30, y - 90, 26, Math.PI * 0.2, Math.PI * 1.3, -1, 8),
    cscroll(x - 30, y + 90, 26, -Math.PI * 0.2, Math.PI * 1.3, 1, 8),
    goldLeaf(x - 40, y - 40, -70, 70, 16), goldLeaf(x - 40, y + 40, -110, 70, 16),
    path(shield, { fill: INK, fillOpacity: 0.35, transform: 'translate(5 7)' }),
    path(shield, { fill: 'url(#goldD)', stroke: '#3a2205', strokeWidth: 3 }),
    cabochon(x - 10, y, 20, 34, 'ruby'),
    // pendant: chain, gold filigree drop with a sapphire and a pearl
    path(`M${P(x - 38, y + 70)}Q${P(px - 6, py - 30, px, py)}`, { fill: 'none', stroke: '#b8862a', strokeWidth: 3, strokeDasharray: '6 3' }),
    path(`M${P(px, py)}C${P(px + 30, py + 10, px + 30, py + 60, px, py + 92)}C${P(px - 30, py + 60, px - 30, py + 10, px, py)}Z`, { fill: 'url(#goldD)', stroke: '#3a2205', strokeWidth: 2.5 }),
    cabochon(px, py + 44, 13, 18, 'sapph'),
    path(`M${P(px, py + 92)}V${n(py + 110)}`, { stroke: '#b8862a', strokeWidth: 2.5 }),
    pearl(px, py + 120, 10));
}

/**
 * White lace ruff under the frame: two gathered tiers of scallops, each scallop edged with picots and
 * pierced with a little eyelet flower (real see-through holes, evenodd), with soft pleat shading.
 */
function lace() {
  const y0 = O.y + O.h - 24, x0 = O.x + 30, x1 = O.x + O.w - 30;
  const tier = (depth, scR, inset, curve) => {
    const yAt = (x) => y0 + depth * (1 - ((x - CX) / ((x1 - x0) / 2)) ** 2 * curve);
    const count = Math.round((x1 - x0 - 2 * inset) / (scR * 2)), step = (x1 - x0 - 2 * inset) / count, xs = x0 + inset;
    let d = `M${P(xs, y0)}H${n(x1 - inset)}V${n(yAt(x1 - inset) - scR * 0.4)}`, edge = '', holes = '', pleats = '';
    // eyelets are tiny diamonds (they read as round holes at this size and keep the markup small)
    const hole = (x, y, r) => `M${n(x)} ${n(y - r)}l${n(r)} ${n(r)} ${n(-r)} ${n(r)} ${n(-r)} ${n(-r)}Z`;
    for (let i = count - 1; i >= 0; i--) {
      const xa = xs + step * (i + 1), xb = xs + step * i, cx = (xa + xb) / 2, ym = yAt(cx) - scR * 0.4, ry = scR * 1.05;
      const arc = `A${P(step / 2, ry)} 0 0 1 ${P(xb, ym)}`;
      d += `L${P(xa, ym)}${arc}`;
      edge += `M${P(xa, ym)}${arc}`;
      // eyelet flower: a centre hole ringed by five petals, plus two small holes above
      const fy = ym + ry * 0.3, pr = scR * 0.2;
      holes += hole(cx, fy, scR * 0.08);
      for (let p = 0; p < 5; p++) { const a = (p / 5) * Math.PI * 2 - Math.PI / 2; holes += hole(cx + Math.cos(a) * pr, fy + Math.sin(a) * pr, scR * 0.075); }
      holes += hole(cx - step * 0.3, ym - scR * 0.28, scR * 0.07) + hole(cx + step * 0.3, ym - scR * 0.28, scR * 0.07);
      pleats += `M${P(xb, y0 + 6)}L${P(xb, ym - 2)}`;
    }
    d += `L${P(xs, yAt(xs) - scR * 0.4)}Z`;
    return { d, holes, edge, pleats };
  };
  const back = tier(168, 36, 0, 0.5), front = tier(104, 28, 60, 0.42);
  // picot edge: round-capped zero-length dashes along each scallop
  const layer = (t, fill, shade, base) => g({},
    path(t.d, { fill: INK, fillOpacity: 0.28, transform: 'translate(5 9)' }),
    path(t.edge, { fill: 'none', stroke: shade, strokeWidth: 11, strokeLinecap: 'round', strokeDasharray: '0 9' }),
    path(t.edge, { fill: 'none', stroke: base, strokeWidth: 8, strokeLinecap: 'round', strokeDasharray: '0 9' }),
    path(t.d + t.holes, { fill, fillRule: 'evenodd' }),
    path(t.pleats, { fill: 'none', stroke: shade, strokeOpacity: 0.45, strokeWidth: 2, strokeLinecap: 'round' }));
  return g({},
    layer(back, 'url(#laceB)', '#8a7e96', '#ece6f0'),
    layer(front, 'url(#lace)', '#9a90a6', '#fbf9fc'),
    // velvet ribbon where the lace is gathered
    path(rr(O.x + 60, y0 - 6, O.w - 120, 22, 11), { fill: 'url(#velvetV)', stroke: INK, strokeWidth: 2.5 }),
    path(`M${O.x + 74} ${y0 + 5}H${O.x + O.w - 74}`, { stroke: '#f0c45a', strokeWidth: 1.8, strokeDasharray: '6 6' }));
}

/** Ruby brooch pinning the lace at the bottom centre. */
function brooch() {
  const x = CX, y = O.y + O.h + 10;
  let rays = '';
  for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2, r = i % 2 ? 50 : 66; rays += `M${P(x, y)}L${P(x + r * Math.cos(a - 0.12), y + r * Math.sin(a - 0.12))}L${P(x + (r + 8) * Math.cos(a), y + (r + 8) * Math.sin(a))}L${P(x + r * Math.cos(a + 0.12), y + r * Math.sin(a + 0.12))}Z`; }
  return g({},
    path(circle(x + 4, y + 6, 70), { fill: INK, fillOpacity: 0.3 }),
    path(rays, { fill: 'url(#goldD)', stroke: '#3a2205', strokeWidth: 2, strokeLinejoin: 'round' }),
    ...Array.from({ length: 8 }, (_, i) => { const a = (i / 8) * Math.PI * 2 + Math.PI / 8; return pearl(x + 44 * Math.cos(a), y + 44 * Math.sin(a), 6); }),
    cabochon(x, y, 26, 32, 'ruby'),
    ...[-26, 0, 26].map((dx, i) => path(`M${P(x + dx, y + 52)}V${n(y + 78 + (i === 1 ? 14 : 0))}`, { stroke: '#b8862a', strokeWidth: 2.5 }) + pearl(x + dx, y + 84 + (i === 1 ? 14 : 0), i === 1 ? 9 : 7)));
}

function draw() {
  const bands = [
    band('bead', 0, 12, [[0, '#6e4a10'], [0.3, '#ffe9a0'], [0.6, '#e0a83a'], [1, '#6e4a10']]),
    band('fil', 12, 56, [[0, '#3a0610'], [0.5, '#5a0a18'], [1, '#2a0408']], 0.1),
    band('fillet', 56, 66, [[0, '#fff2c4'], [1, '#b8862a']]),
    band('velvet', 66, 104, [[0, '#2a0408'], [0.3, '#6e0c1c'], [1, '#9a1428']], 0.12),
    band('slip', 104, 116, [[0, '#6e4a10'], [0.45, '#f6d37a'], [1, '#9a6514']]),
    band('liner', 116, 124, [[0, '#2a1606'], [1, '#120804']]),
  ];
  const defs = [
    '<style>.dc-tw{animation:dc-tw 3.6s ease-in-out infinite}@keyframes dc-tw{0%,100%{opacity:1}50%{opacity:.35}}'
      + '@media (prefers-reduced-motion:reduce){*{animation:none!important}}</style>',
    ...bands.map((b) => b.defs),
    lg('goldS', [0, 0, 1, 1], [[0, '#fff3c4'], [0.4, '#f0c45a'], [1, '#a8701c']]),
    lg('goldD', [0, 0, 1, 1], [[0, '#fff1bf'], [0.35, '#f0c45a'], [0.7, '#c08a2a'], [1, '#7a4b0c']]),
    lg('goldV', [0, 0, 0, 1], [[0, '#fff3c4'], [0.45, '#e8b44a'], [1, '#8a5a12']]),
    rg('goldR', [0.35, 0.3, 0.8], [[0, '#fffbe6'], [0.5, '#f0c45a'], [1, '#7a4b0c']]),
    rg('ruby', [0.35, 0.3, 0.85], [[0, '#ffc2cc'], [0.35, '#ff2a4a'], [0.75, '#9a0820'], [1, '#4a0010']]),
    rg('sapph', [0.35, 0.3, 0.85], [[0, '#c8d8ff'], [0.35, '#3d6bff'], [0.75, '#122e9a'], [1, '#08124a']]),
    rg('pearl', [0.35, 0.3, 0.8], [[0, '#ffffff'], [0.55, '#f2ecf4'], [1, '#b4a8bc']]),
    lg('hornLit', [0, 0, 1, 0], [[0, '#5a5c8a', 0.85], [0.6, '#33304a', 0.5], [1, '#33304a', 0]]),
    lg('lace', [0, 0, 0, 1], [[0, '#ffffff'], [0.7, '#f4f0f6'], [1, '#d8d0de']]),
    lg('laceB', [0, 0, 0, 1], [[0, '#f4f0f7'], [1, '#d6cde0']]),
    lg('velvetV', [0, 0, 0, 1], [[0, '#b01a30'], [1, '#5a0612']]),
    rg('aura', [0.5, 0.5, 0.5], [[0, '#ff2a4a', 0.3], [0.5, '#a0102a', 0.12], [1, '#a0102a', 0]]),
    rg('crestGlow', [0.5, 0.5, 0.5], [[0, '#ffd27a', 0.3], [1, '#ffd27a', 0]]),
  ].join('');
  const h = horn();
  const sparkles = [[120, 980, 14], [1490, 1020, 12], [700, 120, 10], [940, 160, 12], [60, 640, 9], [1550, 600, 10]];
  const body = [
    path(ellipse(CX, 760, 820, 700), { fill: 'url(#aura)' }),
    mirror(h.horn),
    lace(),
    // molding
    path(rr(O.x, O.y, O.w, O.h, 0), { fill: '#3a0610' }),
    ...bands.map((b) => b.body),
    aroundSides(34, (len) => filigree(len - 200, 64, 0)),
    pearlRow(110),
    path(rr(O.x + 0.5, O.y + 0.5, O.w - 1, O.h - 1, 0), { fill: 'none', stroke: INK, strokeWidth: 2.5 }),
    path(rr(O.x + 12, O.y + 12, O.w - 24, O.h - 24, 0), { fill: 'none', stroke: '#3a2205', strokeWidth: 1.5 }),
    path(rr(O.x + 56, O.y + 56, O.w - 112, O.h - 112, 0), { fill: 'none', stroke: '#3a2205', strokeWidth: 1.5 }),
    // velvet sheen + shadow from the molding
    path(rr(O.x + 66, O.y + 66, O.w - 132, O.h - 132, 0), { fill: 'none', stroke: '#000', strokeOpacity: 0.35, strokeWidth: 8 }),
    path(`M${O.x + 80} ${O.y + 76}H${O.x + O.w - 80}`, { stroke: '#ff8fa3', strokeOpacity: 0.16, strokeWidth: 6 }),
    lip(rr(hole.x, hole.y, hole.w, hole.h, radius), '#0a0002', [[5, 0.35], [2, 0.6]]),
    mirror(corner(O.x + 8, O.y + 8)), g({ transform: `translate(0 ${2 * (O.y + O.h / 2)}) scale(1 -1)` }, mirror(corner(O.x + 8, O.y + 8))),
    mirror(sideCartouche()),
    mirror(chain([CX - 252, O.y - 24], h.cuffAt, 64, 6)),
    diadem(),
    brooch(),
    g({ class: 'dc-tw' }, sparkles.map(([x, y, s]) => path(sparkle(x, y, s), { fill: '#fff3c4' })).join('')),
  ].join('\n');
  return { defs, body: body.replace(/ d="[^"]*"/g, (m) => m.replace(/(\.\d)\d+/g, '$1')) };
}

module.exports = {
  W, H, hole, radius, draw,
  meta: {
    name: 'Demon Crown', theme: 'dark-royalty', rarity: 'legendary', translucent: false, collection: 'legends-dread', license: 'CC-BY-4.0',
    desc: 'Glossy black horns, a ruby diadem and a frill of white lace: your game takes the throne in crimson velvet and gold.',
    tags: ['demon', 'royal', 'baroque', 'gold', 'crimson', 'horns', 'lace', 'gems'],
  },
};
