'use strict';
// Château Gilt: a Louis-style gilded salon frame. Carved gold moulding (bead, twisted gadroons, a frieze of
// running acanthus scrolls, bead-and-reel) around a royal blue velvet liner edged with white lace and a
// polished slip. A crowned cartouche with a lily on blue enamel crowns the top over a scallop shell, wrapped
// in acanthus sweeps and blue silk ribbons; scallop-shell corners hold sapphire rosettes, lily medallions
// sit on the sides, and a ribbon bow with a sapphire pendant hangs at the foot between pearl swags.
const L = require('../lib');
const { rr, g, lg, rg, sparkle } = L;
// one-decimal coordinates keep the file small (the hole cut itself comes from lib.frameSvg at full precision)
const n = (v) => Math.round(v * 10) / 10;

/** Compact number list: no leading zeros, no separator before a minus sign or a second decimal point. */
function nums(list) {
  let s = '';
  for (const v of list) {
    const t = String(n(v)).replace(/^(-?)0\./, '$1.');
    s += !s || t[0] === '-' || (t[0] === '.' && /\.\d*$/.test(s) && !/[a-z]$/i.test(s)) ? t : ` ${t}`;
  }
  return s;
}
/** Rewrite absolute path data (M L H V C Q A Z) as compact relative commands; rounding never accumulates. */
function toRel(d) {
  if (/[mlhvcqaz]/.test(d)) return d;
  let out = '', cx = 0, cy = 0, sx = 0, sy = 0;
  for (const [, c, args] of d.matchAll(/([MLHVCQAZ])([^MLHVCQAZ]*)/g)) {
    const v = (args.match(/-?\d*\.?\d+(?:e-?\d+)?/g) || []).map(Number);
    const step = (x, y) => { const dx = n(x - cx), dy = n(y - cy); cx = n(cx + dx); cy = n(cy + dy); return [dx, dy]; };
    const rel = (x, y) => [n(x - cx), n(y - cy)];
    if (c === 'Z') { out += 'z'; cx = sx; cy = sy; continue; }
    if (c === 'M') {
      for (let i = 0; i < v.length; i += 2) {
        if (!out) { cx = n(v[i]); cy = n(v[i + 1]); out += `M${nums([cx, cy])}`; } else out += (i ? 'l' : 'm') + nums(step(v[i], v[i + 1]));
        if (!i) { sx = cx; sy = cy; }
      }
    } else if (c === 'L') { const o = []; for (let i = 0; i < v.length; i += 2) o.push(...step(v[i], v[i + 1])); out += `l${nums(o)}`; }
    else if (c === 'H') { const o = v.map((x) => { const dx = n(x - cx); cx = n(cx + dx); return dx; }); out += `h${nums(o)}`; }
    else if (c === 'V') { const o = v.map((y) => { const dy = n(y - cy); cy = n(cy + dy); return dy; }); out += `v${nums(o)}`; }
    else if (c === 'C') { const o = []; for (let i = 0; i < v.length; i += 6) o.push(...rel(v[i], v[i + 1]), ...rel(v[i + 2], v[i + 3]), ...step(v[i + 4], v[i + 5])); out += `c${nums(o)}`; }
    else if (c === 'Q') { const o = []; for (let i = 0; i < v.length; i += 4) o.push(...rel(v[i], v[i + 1]), ...step(v[i + 2], v[i + 3])); out += `q${nums(o)}`; }
    else if (c === 'A') { const o = []; for (let i = 0; i < v.length; i += 7) o.push(v[i], v[i + 1], v[i + 2], v[i + 3], v[i + 4], ...step(v[i + 5], v[i + 6])); out += `a${nums(o)}`; }
  }
  return out;
}
const path = (d, a = {}) => L.path(toRel(d), a);
const P = (...a) => a.map(n).join(' ');
const poly = (pts, close = true) => `M${pts.map((p) => P(...p)).join('L')}${close ? 'Z' : ''}`;
const circle = (cx, cy, r) => `M${P(cx - r, cy)}A${P(r, r)} 0 1 0 ${P(cx + r, cy)}A${P(r, r)} 0 1 0 ${P(cx - r, cy)}Z`;
const ellipse = (cx, cy, rx, ry) => `M${P(cx - rx, cy)}A${P(rx, ry)} 0 1 0 ${P(cx + rx, cy)}A${P(rx, ry)} 0 1 0 ${P(cx - rx, cy)}Z`;
function smooth(pts) {
  let d = `M${P(...pts[0])}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const [x, y] = pts[i], [x2, y2] = pts[i + 1], last = i === pts.length - 2;
    d += `Q${P(x, y)} ${P(last ? x2 : (x + x2) / 2, last ? y2 : (y + y2) / 2)}`;
  }
  return d;
}

const O = { x: 70, y: 250, w: 1580, h: 1020 }; // outer edge of the moulding
const W = O.w + 2 * O.x, H = 1372, hole = { x: O.x + 150, y: O.y + 150, w: 1280, h: 720 }, radius = 0;
const CX = W / 2, CY = O.y + O.h / 2;
const INK = '#3d2304';
const LIGHT = '#fff8dc';
// moulding profile, insets from the outer edge
const PR = { astr: [0, 9], torus: [9, 43], fil: [43, 48], frieze: [48, 82], bead: [82, 90], velvet: [90, 138], slip: [138, 150] };

// ---- gradients that follow mirroring: id-pp (as drawn), id-np (mirrored in x), id-pn (in y), id-nn (both)
const FLIP = { pp: [0, 0, 1, 1], np: [1, 0, 0, 1], pn: [0, 1, 1, 0], nn: [1, 1, 0, 0] };
const key = (sx, sy) => `${sx > 0 ? 'p' : 'n'}${sy > 0 ? 'p' : 'n'}`;
const lg4 = (id, list) => Object.entries(FLIP).map(([k, v]) => lg(`${id}-${k}`, v, list)).join('');
const rg4 = (id, [cx, cy, r], list) => Object.keys(FLIP).map((k) => rg(`${id}-${k}`, [k[0] === 'p' ? cx : 1 - cx, k[1] === 'p' ? cy : 1 - cy, r], list)).join('');

/** Mirror absolute path data across x = 0 (M L H V C Q A Z). */
function mx(d) {
  const out = [];
  for (const [, c, args] of d.matchAll(/([MLHVCQAZ])([^MLHVCQAZ]*)/g)) {
    const v = (args.match(/-?\d*\.?\d+(?:e-?\d+)?/g) || []).map(Number);
    if (c === 'H') out.push(`H${v.map((x) => n(-x)).join(' ')}`);
    else if (c === 'V' || c === 'Z') out.push(c + v.join(' '));
    else if (c === 'A') { const r = []; for (let i = 0; i < v.length; i += 7) r.push(v[i], v[i + 1], v[i + 2], v[i + 3], 1 - v[i + 4], n(-v[i + 5]), v[i + 6]); out.push(`A${r.join(' ')}`); }
    else out.push(c + v.map((x, i) => (i % 2 ? x : n(-x))).join(' '));
  }
  return out.join('');
}
/** Shift absolute path data by dx in x. */
const shiftX = (d, dx) => d.replace(/([MLHCQA])([^MLHVCQAZ]*)/g, (all, c, args) => {
  const v = (args.match(/-?\d*\.?\d+(?:e-?\d+)?/g) || []).map(Number);
  if (c === 'H') return `H${v.map((x) => n(x + dx)).join(' ')}`;
  if (c === 'A') { const r = []; for (let i = 0; i < v.length; i += 7) r.push(v[i], v[i + 1], v[i + 2], v[i + 3], v[i + 4], n(v[i + 5] + dx), v[i + 6]); return `A${r.join(' ')}`; }
  return c + v.map((x, i) => (i % 2 ? x : n(x + dx))).join(' ');
});
/** Mirror absolute path data across the vertical line x = x0. */
const mxAt = (d, x0) => shiftX(mx(shiftX(d, -x0)), x0);
const mirrorAt = (x0, ...kids) => g({ transform: `translate(${n(2 * x0)} 0) scale(-1 1)` }, ...kids);

// ---- the moulding ------------------------------------------------------------------------------------
/** The four mitered trapezoids between insets a and b: { t, r, b, l } point lists. */
function trapezoids(a, b) {
  const x0 = O.x + a, y0 = O.y + a, x1 = O.x + O.w - a, y1 = O.y + O.h - a;
  const X0 = O.x + b, Y0 = O.y + b, X1 = O.x + O.w - b, Y1 = O.y + O.h - b;
  return { t: [[x0, y0], [x1, y0], [X1, Y0], [X0, Y0]], r: [[x1, y0], [x1, y1], [X1, Y1], [X1, Y0]], b: [[x1, y1], [x0, y1], [X0, Y1], [X1, Y1]], l: [[x0, y1], [x0, y0], [X0, Y0], [X0, Y1]] };
}

/** Mitered band, one trapezoid per side, each with its own gradient across the band. */
function band(id, [a, b], list, dark = 0.16) {
  const tz = trapezoids(a, b), x0 = O.x + a, y0 = O.y + a, x1 = O.x + O.w - a, y1 = O.y + O.h - a;
  const X0 = O.x + b, Y0 = O.y + b, X1 = O.x + O.w - b, Y1 = O.y + O.h - b;
  const sides = { t: [[0, y0, 0, Y0], 0], r: [[x1, 0, X1, 0], dark * 0.6], b: [[0, y1, 0, Y1], dark], l: [[x0, 0, X0, 0], 0] };
  let defs = '', body = '';
  for (const [k, [c, shade]] of Object.entries(sides)) {
    defs += lg(`${id}-${k}`, c, list, true);
    body += path(poly(tz[k]), { fill: `url(#${id}-${k})` });
    if (shade) body += path(poly(tz[k]), { fill: '#2a1600', fillOpacity: shade });
  }
  return { defs, body };
}

/** The four sides as maps from (u along the side from its first corner, v inward from the outer edge). */
const SIDES = (() => {
  const x0 = O.x, y0 = O.y, x1 = O.x + O.w, y1 = O.y + O.h;
  return [
    { len: O.w, map: (u, v) => [x0 + u, y0 + v] },
    { len: O.h, map: (u, v) => [x1 - v, y0 + u] },
    { len: O.w, map: (u, v) => [x1 - u, y1 - v] },
    { len: O.h, map: (u, v) => [x0 + v, y1 - u] },
  ];
})();
const insetRect = (a) => rr(O.x + a, O.y + a, O.w - 2 * a, O.h - 2 * a, 0);

/**
 * Tiled carving for a band: a horizontal tile (top/bottom rails) and its transpose (sides), each placed at the
 * band's start so it lines up. `tile(tr)` draws one tile with coordinates passed through tr ([x, y] or [y, x]).
 */
function tiled(id, [a, b], period, tile) {
  const h = b - a, H_ = (x, y) => [x, y], V_ = (x, y) => [y, x], p = period;
  // tiles are centred on the frame's middle so every rail is symmetric
  const phase = (c, o) => o + ((((c - p / 2 - o) % p) + p) % p) - p;
  const pat = (pid, tw, th, tx, ty, tr) => `<pattern id="${pid}" width="${tw}" height="${th}" patternUnits="userSpaceOnUse" patternTransform="translate(${n(tx)} ${n(ty)})">${tile(tr, p)}</pattern>`;
  const defs = pat(`${id}H`, p, h, phase(CX, O.x), O.y + a, H_) + pat(`${id}V`, h, p, O.x + a, phase(CY, O.y), V_);
  // the far rails reuse the same tiles: drawn shifted back by dy (dx) inside a group shifted forward, so the
  // pattern origin lands on their own band start
  const tz = trapezoids(a, b), dy = O.h - a - b, dx = O.w - a - b;
  const body = path(poly(tz.t), { fill: `url(#${id}H)` }) + path(poly(tz.l), { fill: `url(#${id}V)` })
    + g({ transform: `translate(0 ${dy})` }, path(poly(tz.b.map(([x, y]) => [x, y - dy])), { fill: `url(#${id}H)` }))
    + g({ transform: `translate(${dx} 0)` }, path(poly(tz.r.map(([x, y]) => [x - dx, y])), { fill: `url(#${id}V)` }));
  return { defs, body };
}

/** One gadroon tile (21 x 34): a curved groove, the lit flank (toward the light) and the shaded flank. */
function gadroonTile(tr) {
  const S = 21, M = (x, y) => P(...tr(x, y));
  const c = (x, y0 = 2, y1 = 32) => `M${M(x + 7, y0)}C${M(x + 7, y0 + 11)} ${M(x - 7, y1 - 11)} ${M(x - 7, y1)}`;
  let gr = '', lit = '', sh = '';
  for (const o of [-S, 0, S]) { gr += c(o); lit += c(o + 4.5, 6, 28); sh += c(o + S - 5, 5, 29); }
  return path(sh, { fill: 'none', stroke: '#5a3507', strokeOpacity: 0.38, strokeWidth: 5, strokeLinecap: 'round' })
    + path(lit, { fill: 'none', stroke: LIGHT, strokeOpacity: 0.78, strokeWidth: 3.4, strokeLinecap: 'round' })
    + path(gr, { fill: 'none', stroke: INK, strokeOpacity: 0.72, strokeWidth: 2.4, strokeLinecap: 'round' });
}

/** One rinceau tile (86 x 34): a wave stem with a curl into each hump and a leaflet on each crest. */
function rinceauTile(tr) {
  const Pd = 86, vc = 17, A = 7, M = (x, y) => P(...tr(x, y));
  let d = '', boss = '';
  // one period, plus the crest curl and leaflet of the next tile that reach back into this one
  for (const [x, s] of [[0, 1], [Pd / 2, -1], [Pd, 1]]) {
    {
      const x0 = x, y0 = vc - s * A, y1 = vc + s * A, h = Pd / 2;
      if (x0 < Pd) d += `M${M(x0, y0)}C${M(x0 + 0.364 * h, y0)} ${M(x0 + 0.636 * h, y1)} ${M(x0 + h, y1)}`;
      const cu = x0 + 3, cv = vc + s * 7, sp = [];
      for (let j = 0; j <= 10; j++) {
        const phi = (j / 10) * 7, r = 16 * Math.exp(-0.26 * phi), th = (200 * Math.PI) / 180 + phi;
        sp.push(tr(cu + r * Math.cos(th), cv + s * r * Math.sin(th)));
      }
      d += smooth(sp);
      boss += circle(...sp[sp.length - 1], 2.6);
      d += `M${M(x0 - 10, vc - s * 4)}Q${M(x0 - 20, vc - s * 9)} ${M(x0 - 28, vc - s * 1.5)}`;
    }
  }
  return path(d, { fill: 'none', stroke: INK, strokeOpacity: 0.9, strokeWidth: 6, strokeLinecap: 'round' })
    + path(d, { fill: 'none', stroke: '#f2c862', strokeWidth: 3.6, strokeLinecap: 'round' })
    + path(d, { fill: 'none', stroke: LIGHT, strokeOpacity: 0.85, strokeWidth: 1.2, strokeLinecap: 'round', transform: 'translate(-0.8 -1)' })
    + path(boss, { fill: '#ffe9a6', stroke: INK, strokeWidth: 1.3 });
}

/** Dotted pearls along any path (dash dots), shaded with offset copies. */
function pearls(d, size = 10, gap = 13) {
  const dots = (stroke, w, t, extra = {}) => path(d, { fill: 'none', stroke, strokeWidth: n(w), strokeDasharray: `0.01 ${n(gap)}`, strokeLinecap: 'round', transform: t, ...extra });
  return dots('#1c0f02', size, 'translate(1.4 2)', { strokeOpacity: 0.35 })
    + dots('#a9a3bb', size, null)
    + dots('#f5f1ea', size * 0.8, `translate(${n(-size * 0.07)} ${n(-size * 0.07)})`)
    + dots('#ffffff', size * 0.3, `translate(${n(-size * 0.2)} ${n(-size * 0.2)})`);
}
const dot = (x, y) => `M${P(x, y)}h0.01`;

/**
 * One tile of the white lace edging laid over the velvet (p x 22): header band with pin holes, a scallop with
 * picots and three pierced holes, and its soft shadow on the velvet.
 */
function laceTile(tr, p) {
  const horiz = tr(1, 0)[0] === 1, M = (x, y, dx = 0, dy = 0) => { const [X, Y] = tr(x, y); return P(X + dx, Y + dy); };
  // transposing the tile mirrors it, which flips the arc sweep
  const sag = 8, r = (p * p / 4 + sag * sag) / (2 * sag), sw = horiz ? 1 : 0;
  const shape = (dx = 0, dy = 0, o = 0) => `M${M(o, 0, dx, dy)}L${M(o + p, 0, dx, dy)}L${M(o + p, 11, dx, dy)}A${P(r, r)} 0 0 ${sw} ${M(o, 11, dx, dy)}Z`;
  const arc = `M${M(p, 11)}A${P(r, r)} 0 0 ${sw} ${M(0, 11)}`;
  const holes = circle(...tr(p / 2, 13.5), 2.3) + circle(...tr(p / 2 - 5.5, 9.5), 1.1) + circle(...tr(p / 2 + 5.5, 9.5), 1.1);
  const pins = [0.15, 0.4, 0.65, 0.9].map((t) => circle(...tr(p * t, 5), 0.95)).join('');
  return path(shape(1.5, 2.5) + shape(1.5, 2.5, -p), { fill: '#050c2e', fillOpacity: 0.38 })
    + path(shape(), { fill: '#f4f2ed' })
    + path(arc, { fill: 'none', stroke: '#fbfaf7', strokeWidth: 2.8, strokeDasharray: '0.01 5', strokeLinecap: 'round' })
    + path(arc, { fill: 'none', stroke: '#8e97b8', strokeOpacity: 0.55, strokeWidth: 0.8 })
    + path(holes, { fill: '#112a7c' }) + path(pins, { fill: '#9aa3c4' });
}

// ---- ornaments ---------------------------------------------------------------------------------------
const FDL_R = 'M0.13 0.05C0.17 -0.22 0.36 -0.47 0.57 -0.47C0.76 -0.47 0.86 -0.27 0.77 -0.1C0.7 0.02 0.55 0.04 0.49 -0.05'
  + 'C0.59 -0.06 0.64 -0.16 0.6 -0.25C0.54 -0.35 0.4 -0.31 0.33 -0.18C0.28 -0.09 0.26 -0.01 0.25 0.05Z'
  + 'M0.12 0.17C0.15 0.3 0.28 0.39 0.45 0.36C0.36 0.31 0.28 0.25 0.26 0.17Z';
const FDL = 'M0 -1C0.17 -0.83 0.3 -0.6 0.26 -0.33C0.23 -0.15 0.15 -0.03 0.1 0.05H-0.1C-0.15 -0.03 -0.23 -0.15 -0.26 -0.33C-0.3 -0.6 -0.17 -0.83 0 -1Z'
  + FDL_R + 'M-0.4 0.04H0.4V0.17H-0.4ZM-0.09 0.17C-0.08 0.27 -0.04 0.35 0 0.44C0.04 0.35 0.08 0.27 0.09 0.17Z';
const x100 = (d) => d.replace(/-?\d*\.?\d+/g, (m) => String(Math.round(+m * 100)));
const FDL100 = x100(FDL) + mx(x100(FDL_R));
const FDL_HI = x100('M0 -0.86V-0.1M0.5 -0.39C0.66 -0.38 0.72 -0.24 0.66 -0.14M-0.5 -0.39C-0.66 -0.38 -0.72 -0.24 -0.66 -0.14');

/** Heraldic lily, tip up, height ~1.45 s, at (x, y) = the middle of its band. */
function fleur(x, y, s, rot = 0, fill = 'url(#fdlG)') {
  const k = 100 / s; // the outline is stored in hundredths, so it survives one-decimal rounding
  return g({ transform: `translate(${n(x)} ${n(y)})${rot ? ` rotate(${rot})` : ''} scale(${+(s / 100).toFixed(4)})` },
    path(FDL100, { fill: '#1c0f02', fillOpacity: 0.32, transform: `translate(${n(2 * k)} ${n(3 * k)})` }),
    path(FDL100, { fill, stroke: INK, strokeWidth: n(1.6 * k), strokeLinejoin: 'round' }),
    path(FDL_HI, { fill: 'none', stroke: LIGHT, strokeOpacity: 0.85, strokeWidth: n(1.4 * k), strokeLinecap: 'round' }));
}

/**
 * Acanthus leaf along +x from the origin, bent toward -y by `bend` px at the tip: fingered lobes above, smaller
 * ones below, ending in a rolled volute with a boss in its eye.
 */
function acanthus(len, w, k = 'pp', lobes = 4, bend = 0) {
  const xt = len * 0.78, x0 = len * 0.03;
  const T = (x, y) => [x, y - bend * (x / len) ** 2], TP = (x, y) => P(...T(x, y));
  const prof = (x) => { const t = Math.min(1, Math.max(0, x / xt)); return Math.sin(Math.PI * (0.18 + 0.72 * t)) * (1 - 0.3 * t) + 0.2; };
  const lobe = (a, Lb, ww, sg) => {
    const p = (fx, fy) => [a + fx * Lb, sg * fy * ww];
    return [p(0, 0.16), p(0.02, 0.92), p(0.4, 1.02), p(0.42, 0.74), p(0.5, 0.6), p(0.6, 0.96), p(0.8, 0.9), p(0.78, 0.62), p(0.84, 0.5), p(0.96, 0.78), p(1.12, 0.66), p(1.02, 0.38), p(1.0, 0.16)];
  };
  const chain = (pts) => { let d = ''; for (let i = 1; i < pts.length; i += 2) d += `Q${TP(...pts[i])} ${TP(...pts[i + 1])}`; return d; };
  const Lb = (xt - x0) / lobes;
  let up = [];
  for (let j = 0; j < lobes; j++) { const a = x0 + j * Lb, s = lobe(a, Lb, w * prof(a + Lb / 2), -1); up = up.length ? up.concat(s.slice(1)) : s; }
  const lowN = Math.max(2, lobes - 1), Lc = (xt * 0.86 - x0) / lowN;
  let lo = [];
  for (let j = 0; j < lowN; j++) { const a = x0 + j * Lc, s = lobe(a, Lc, w * 0.66 * prof(a + Lc / 2), 1); lo = lo.length ? lo.concat(s.slice(1)) : s; }
  lo = lo.reverse();
  const [, uy] = up[up.length - 1], [lx, ly] = lo[0];
  const R = w * 0.9, [ccx, ccy] = T(xt + 0.95 * w, -0.1 * w), on = (deg, r = R) => [ccx + r * Math.cos((deg * Math.PI) / 180), ccy + r * Math.sin((deg * Math.PI) / 180)];
  const [ax, ay] = on(212), [bx, by] = on(128);
  const curl = `C${TP(xt + 0.1 * w, uy - 0.5 * w)} ${P(ax - 0.25 * R, ay + 0.1 * R)} ${P(ax, ay)}A${P(R, R)} 0 1 1 ${P(bx, by)}`
    + `C${P(bx - 0.2 * R, by - 0.15 * R)} ${TP(lx + 0.35 * w, ly)} ${TP(lx, ly)}`;
  const spiral = [];
  for (let i = 0; i <= 14; i++) { const t = i / 14; spiral.push(on(128 + t * 330, R * (0.82 - 0.5 * t))); }
  const d = `M0 0Q${TP(0, -w * 0.12)} ${TP(...up[0])}${chain(up)}${curl}${chain(lo)}Q${TP(0, w * 0.1)} 0 0Z`;
  const under = `M${TP(x0, 0)}L${TP(xt, 0)}C${TP(xt + 0.2 * w, 0.3 * w)} ${TP(lx + 0.2 * w, ly)} ${TP(lx, ly)}${chain(lo)}Z`;
  let veins = '';
  for (let j = 0; j < lobes; j++) {
    const a = x0 + j * Lb, ww = w * prof(a + Lb / 2);
    veins += `M${TP(a + 0.12 * Lb, -0.06 * ww)}Q${TP(a + 0.32 * Lb, -0.3 * ww)} ${TP(a + 0.4 * Lb, -0.84 * ww)}M${TP(a + 0.5 * Lb, -0.08 * ww)}Q${TP(a + 0.7 * Lb, -0.34 * ww)} ${TP(a + 0.78 * Lb, -0.76 * ww)}`;
  }
  const rib = `M${TP(x0, 0)}L${TP(xt * 0.5, 0)}L${TP(xt, 0)}`, eye = smooth(spiral), [ex, ey] = spiral[spiral.length - 1];
  const sw = (v) => n(Math.max(1.3, w * v));
  return path(d, { fill: '#1c0f02', fillOpacity: 0.32, transform: 'translate(3 4)' })
    + path(d, { fill: `url(#carve-${k})`, stroke: INK, strokeWidth: sw(0.075), strokeLinejoin: 'round' })
    + path(under, { fill: '#5a3507', fillOpacity: 0.26 })
    + path(rib, { fill: 'none', stroke: INK, strokeOpacity: 0.6, strokeWidth: sw(0.07), strokeLinecap: 'round' })
    + path(veins, { fill: 'none', stroke: LIGHT, strokeOpacity: 0.85, strokeWidth: sw(0.06), strokeLinecap: 'round' })
    + path(eye, { fill: 'none', stroke: LIGHT, strokeOpacity: 0.7, strokeWidth: sw(0.06), strokeLinecap: 'round', transform: 'translate(-1 -1.4)' })
    + path(eye, { fill: 'none', stroke: INK, strokeOpacity: 0.75, strokeWidth: sw(0.07), strokeLinecap: 'round' })
    + path(circle(ex, ey, R * 0.3), { fill: `url(#boss-${k})`, stroke: INK, strokeWidth: 1.5 });
}

/** Sapphire cabochon in a gold bezel with four claws. */
function sapphire(x, y, rx, ry = rx) {
  const claws = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => circle(x + a * rx * 0.78, y + b * ry * 0.78, Math.max(2.4, rx * 0.16))).join('');
  return path(ellipse(x + 1.5, y + 2.5, rx + 5, ry + 5), { fill: '#1c0f02', fillOpacity: 0.35 })
    + path(ellipse(x, y, rx + 5, ry + 5), { fill: 'url(#carve-pp)', stroke: INK, strokeWidth: 1.8 })
    + path(ellipse(x, y, rx, ry), { fill: 'url(#sapph)', stroke: '#07134a', strokeWidth: 1.4 })
    + path(ellipse(x - rx * 0.32, y - ry * 0.36, rx * 0.34, ry * 0.2), { fill: '#fff', fillOpacity: 0.8, transform: `rotate(-30 ${n(x - rx * 0.32)} ${n(y - ry * 0.36)})` })
    + path(ellipse(x + rx * 0.3, y + ry * 0.42, rx * 0.28, ry * 0.12), { fill: '#8fb4ff', fillOpacity: 0.55 })
    + path(claws, { fill: 'url(#boss-pp)', stroke: INK, strokeWidth: 1.2 });
}

/** Teardrop pearl hanging from (x, y). */
function dropPearl(x, y, s = 1) {
  const d = `M${P(x, y)}C${P(x + 7 * s, y + 6 * s, x + 10 * s, y + 13 * s, x + 10 * s, y + 18 * s)}A${P(10 * s, 10 * s)} 0 0 1 ${P(x - 10 * s, y + 18 * s)}C${P(x - 10 * s, y + 13 * s, x - 7 * s, y + 6 * s, x, y)}Z`;
  return path(d, { fill: '#1c0f02', fillOpacity: 0.3, transform: 'translate(1.5 2.5)' })
    + path(d, { fill: 'url(#pearl)', stroke: '#6f6880', strokeWidth: 1 })
    + path(ellipse(x - 3.5 * s, y + 14 * s, 2.4 * s, 4 * s), { fill: '#fff', fillOpacity: 0.9 });
}

/** Little gold rosette (8 petals): the hook for swags and drops. */
function rosette(x, y, r) {
  let pet = '';
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4, c = Math.cos(a), s = Math.sin(a), q = (v, w) => P(x + v * c - w * s, y + v * s + w * c);
    pet += `M${q(0, 0)}C${q(r * 0.3, -r * 0.36)} ${q(r * 0.95, -r * 0.3)} ${q(r, 0)}C${q(r * 0.95, r * 0.3)} ${q(r * 0.3, r * 0.36)} ${q(0, 0)}Z`;
  }
  return path(circle(x + 1.5, y + 2.5, r), { fill: '#1c0f02', fillOpacity: 0.3 })
    + path(pet, { fill: 'url(#carve-pp)', stroke: INK, strokeWidth: 1.2 })
    + path(circle(x, y, r * 0.38), { fill: 'url(#boss-pp)', stroke: INK, strokeWidth: 1.2 });
}

/** Pearl swag from (x0, y0) to (x1, y1) sagging by `sag`. */
function swag(x0, y0, x1, y1, sag, size = 10) {
  return pearls(`M${P(x0, y0)}Q${P((x0 + x1) / 2, (y0 + y1) / 2 + sag * 2, x1, y1)}`, size, size + 2.4);
}

/** Blue silk ribbon along a cubic, w wide, with a half twist around t = tw and a swallowtail end. */
function ribbon(p0, p1, p2, p3, w, tw = 0.55) {
  const N = 30, C = [], T = [];
  const bz = (t, i) => (1 - t) ** 3 * p0[i] + 3 * (1 - t) ** 2 * t * p1[i] + 3 * (1 - t) * t * t * p2[i] + t ** 3 * p3[i];
  for (let j = 0; j <= N; j++) {
    const t = j / N, e = 1e-3, b = [bz(Math.min(1, t + e), 0) - bz(Math.max(0, t - e), 0), bz(Math.min(1, t + e), 1) - bz(Math.max(0, t - e), 1)], l = Math.hypot(...b);
    C.push([bz(t, 0), bz(t, 1)]); T.push([b[0] / l, b[1] / l]);
  }
  const wf = (t) => (w / 2) * Math.cos(Math.PI * Math.min(1, Math.max(0, (t - tw + 0.1) / 0.2)));
  const edge = (j, sg) => { const ww = wf(j / N) * sg; return [C[j][0] - T[j][1] * ww, C[j][1] + T[j][0] * ww]; };
  const jt = Math.round(tw * N);
  const seg = (j0, j1, tail) => {
    const left = [], right = [];
    for (let j = j0; j <= j1; j++) { left.push(edge(j, 1)); right.unshift(edge(j, -1)); }
    const notch = tail ? [[C[j1][0] - T[j1][0] * w * 0.55, C[j1][1] - T[j1][1] * w * 0.55]] : [];
    return { d: poly([...left, ...notch, ...right]), l: left, r: right };
  };
  const A = seg(0, jt, false), B = seg(jt, N, true);
  const edges = smooth(A.l) + smooth(B.l) + smooth([...A.r].reverse()) + smooth([...B.r].reverse());
  const sheen = smooth(C.slice(2, jt - 1).map(([x, y], j) => [x - T[j + 2][1] * w * 0.2, y + T[j + 2][0] * w * 0.2]));
  return path(A.d + B.d, { fill: '#050c2e', fillOpacity: 0.32, transform: 'translate(3 5)' })
    + path(A.d, { fill: 'url(#silk)', stroke: '#081650', strokeWidth: 1.6, strokeLinejoin: 'round' })
    + path(B.d, { fill: 'url(#silkBack)', stroke: '#081650', strokeWidth: 1.6, strokeLinejoin: 'round' })
    + path(edges, { fill: 'none', stroke: '#f3d27a', strokeWidth: 1.8 })
    + path(sheen, { fill: 'none', stroke: '#a9c6ff', strokeOpacity: 0.5, strokeWidth: 2.6, strokeLinecap: 'round' });
}

/** Scallop shell fan around (cx, by) from angle a0 to a1 (degrees): alternating convex ribs, scalloped rim. */
function shellFan(cx, by, R, a0, a1, ribs = 15, k = 'pp') {
  let rim = '', dark = '', lines = '';
  const pt = (deg, r) => [cx + r * Math.cos((deg * Math.PI) / 180), by + r * Math.sin((deg * Math.PI) / 180)];
  for (let i = 0; i <= ribs; i++) {
    const a = a0 + ((a1 - a0) * i) / ribs, m = a0 + ((a1 - a0) * (i - 0.5)) / ribs, [x, y] = pt(a, R);
    if (!i) rim = `M${P(cx, by)}L${P(x, y)}`;
    else rim += `Q${P(...pt(m, R + 22), x, y)}`;
    if (i < ribs && i % 2) { const b = a0 + ((a1 - a0) * (i + 1)) / ribs; dark += `M${P(cx, by)}L${P(...pt(a, R))}Q${P(...pt(a + (b - a) / 2, R + 22), ...pt(b, R))}Z`; }
    lines += `M${P(...pt(a, 22))}L${P(...pt(a, R - 4))}`;
  }
  rim += 'Z';
  return path(rim, { fill: '#1c0f02', fillOpacity: 0.32, transform: 'translate(4 6)' })
    + path(rim, { fill: `url(#shellG-${k})`, stroke: INK, strokeWidth: 2.4, strokeLinejoin: 'round' })
    + path(dark, { fill: '#7a4a0c', fillOpacity: 0.28 })
    + path(lines, { fill: 'none', stroke: INK, strokeOpacity: 0.5, strokeWidth: 2.2, strokeLinecap: 'round' })
    + path(lines, { fill: 'none', stroke: LIGHT, strokeOpacity: 0.6, strokeWidth: 1.3, strokeLinecap: 'round', transform: 'translate(-2.5 -1)' })
    + path(circle(cx, by, 20), { fill: `url(#boss-${k})`, stroke: INK, strokeWidth: 2 });
}

/** French-style royal crown: jewelled band, lily fleurons, pearled arches over a blue cap, lily finial. */
function crown(cx, yb) {
  const bw = 80;
  const band = `M${P(cx - bw, yb - 30)}Q${P(cx, yb - 18, cx + bw, yb - 30)}V${n(yb - 3)}Q${P(cx, yb + 9, cx - bw, yb - 3)}Z`;
  const cap = `M${P(cx - bw + 8, yb - 24)}C${P(cx - bw + 4, yb - 86, cx - 34, yb - 106, cx, yb - 106)}C${P(cx + 34, yb - 106, cx + bw - 4, yb - 86, cx + bw - 8, yb - 24)}Z`;
  const archO = `M${P(cx - bw + 9, yb - 28)}C${P(cx - bw + 5, yb - 86, cx - 36, yb - 108, cx, yb - 108)}`;
  const archI = `M${P(cx - 40, yb - 22)}C${P(cx - 42, yb - 66, cx - 22, yb - 98, cx, yb - 106)}`;
  const archOR = mxAt(archO, cx), archIR = mxAt(archI, cx);
  const allArch = archO + archOR + archI + archIR + `M${P(cx, yb - 20)}V${n(yb - 106)}`;
  const bandTop = `M${P(cx - bw, yb - 30)}Q${P(cx, yb - 18, cx + bw, yb - 30)}`, bandBot = `M${P(cx - bw + 3, yb - 4)}Q${P(cx, yb + 7, cx + bw - 3, yb - 4)}`;
  const yTop = (x) => { const t = (x - (cx - bw)) / (2 * bw); return (1 - t) ** 2 * (yb - 30) + 2 * (1 - t) * t * (yb - 18) + t * t * (yb - 30); };
  const points = [-27, 27].map((dx) => { const x = cx + dx, y = yTop(x); return `M${P(x - 9, y + 1)}L${P(x, y - 22)}L${P(x + 9, y + 1)}Z`; }).join('');
  return g({},
    path(cap, { fill: 'url(#capG)', stroke: '#081650', strokeWidth: 2 }),
    path(cap, { fill: 'url(#capSheen)' }),
    path(allArch, { fill: 'none', stroke: INK, strokeWidth: 12, strokeLinecap: 'round' }),
    path(allArch, { fill: 'none', stroke: '#e8b94e', strokeWidth: 8, strokeLinecap: 'round' }),
    path(allArch, { fill: 'none', stroke: LIGHT, strokeOpacity: 0.7, strokeWidth: 2, strokeLinecap: 'round', transform: 'translate(-1.5 -1)' }),
    pearls(archO + archOR, 6.5, 9.5), pearls(archI + archIR, 6, 9.5),
    path(circle(cx, yb - 114, 10), { fill: 'url(#boss-pp)', stroke: INK, strokeWidth: 2 }),
    fleur(cx, yb - 134, 18),
    path(points, { fill: 'url(#carve-pp)', stroke: INK, strokeWidth: 1.8, strokeLinejoin: 'round' }),
    pearls([-27, 27].map((dx) => dot(cx + dx, yTop(cx + dx) - 25)).join(''), 9, 50),
    fleur(cx, yTop(cx) - 10, 22), fleur(cx - 55, yTop(cx - 55) - 9, 17), fleur(cx + 55, yTop(cx + 55) - 9, 17),
    path(band, { fill: '#1c0f02', fillOpacity: 0.32, transform: 'translate(2 4)' }),
    path(band, { fill: 'url(#bandG)', stroke: INK, strokeWidth: 2.4, strokeLinejoin: 'round' }),
    pearls(bandTop, 5.5, 8.5), pearls(bandBot, 5.5, 8.5),
    sapphire(cx, yTop(cx) + 14, 9, 7.5), sapphire(cx - 50, yTop(cx - 50) + 14, 6.5, 6), sapphire(cx + 50, yTop(cx + 50) + 14, 6.5, 6),
    pearls([-25, 25, -72, 72].map((dx) => dot(cx + dx, yTop(cx + dx) + 14)).join(''), 8, 500));
}

/** Oval cartouche: carved gold frame, a pearl ring and a lily on engine-turned blue enamel. */
function cartouche(cx, cy, rx, ry, lily) {
  let guil = '';
  for (let i = 0; i < 20; i++) { const a = (i / 20) * 2 * Math.PI; guil += `M${P(cx + rx * 0.22 * Math.cos(a), cy + ry * 0.22 * Math.sin(a))}L${P(cx + (rx - 18) * Math.cos(a), cy + (ry - 18) * Math.sin(a))}`; }
  const ring = (k) => `M${P(cx - rx + k, cy)}A${P(rx - k, ry - k)} 0 1 1 ${P(cx + rx - k, cy)}A${P(rx - k, ry - k)} 0 1 1 ${P(cx - rx + k, cy)}`;
  return path(ellipse(cx + 3, cy + 5, rx, ry), { fill: '#1c0f02', fillOpacity: 0.35 })
    + path(ellipse(cx, cy, rx, ry), { fill: 'url(#carve-pp)', stroke: INK, strokeWidth: 2.4 })
    + path(ellipse(cx, cy, rx - 6, ry - 6), { fill: 'none', stroke: INK, strokeOpacity: 0.5, strokeWidth: 1.4 })
    + pearls(ring(11), 7, 10.2)
    + path(ellipse(cx, cy, rx - 17, ry - 17), { fill: 'url(#enamel)', stroke: INK, strokeWidth: 2 })
    + path(guil, { fill: 'none', stroke: '#6f9bff', strokeOpacity: 0.22, strokeWidth: 1.2 })
    + path(ellipse(cx - (rx - 17) * 0.35, cy - (ry - 17) * 0.55, (rx - 17) * 0.45, (ry - 17) * 0.2), { fill: '#fff', fillOpacity: 0.16 })
    + fleur(cx, cy + ry * 0.12, lily);
}

/** Top crest: shell fan, acanthus sweeps, ribbons, the crowned cartouche. */
function crest() {
  const cy = 236;
  const half = (k) => g({},
    g({ transform: `translate(${CX + 64} 246) rotate(-3)` }, acanthus(380, 30, k, 4, 22)),
    g({ transform: `translate(${CX + 70} 222) rotate(-28)` }, acanthus(190, 20, k, 3, 18)),
    ribbon([CX + 48, cy - 18], [CX + 150, cy - 66], [CX + 215, cy + 84], [CX + 342, cy + 42], 24, 0.58));
  return g({},
    shellFan(CX, 270, 194, 196, 344, 15),
    half('pp'), mirrorAt(CX, half('np')),
    cartouche(CX, cy, 66, 74, 34),
    crown(CX, 170));
}

/** Corner piece in local coordinates (origin = outer corner, x along the top rail, y down the side). */
function corner(k) {
  let scal = '';
  for (let i = 0; i < 10; i++) {
    const a = (i * Math.PI) / 5, b = ((i + 1) * Math.PI) / 5, m = (a + b) / 2, R = 30;
    scal += `${i ? '' : `M${P(60 + R * Math.cos(a), 60 + R * Math.sin(a))}`}Q${P(60 + (R + 11) * Math.cos(m), 60 + (R + 11) * Math.sin(m), 60 + R * Math.cos(b), 60 + R * Math.sin(b))}`;
  }
  scal += 'Z';
  return g({},
    shellFan(60, 60, 78, 155, 295, 11, k),
    g({ transform: 'translate(98 27)' }, acanthus(200, 19, k, 3, 8)),
    g({ transform: 'translate(27 98) rotate(90) scale(1 -1)' }, acanthus(200, 19, k, 3, 8)),
    path(scal, { fill: '#1c0f02', fillOpacity: 0.35, transform: 'translate(3 4)' }),
    path(scal, { fill: `url(#carve-${k})`, stroke: INK, strokeWidth: 2, strokeLinejoin: 'round' }));
}

/** Lily medallion on a side rail, with a shell fanning outward and acanthus up and down the rail. */
function sideMedallion(x, y, dir) {
  const inner = g({},
    shellFan(x, y, 74, 180 - 62, 180 + 62, 11, dir > 0 ? 'pp' : 'np'),
    g({ transform: `translate(${x} ${y - 64}) rotate(-90)` }, acanthus(160, 17, dir > 0 ? 'np' : 'pp', 3, 0)),
    g({ transform: `translate(${x} ${y + 64}) rotate(90) scale(1 -1)` }, acanthus(160, 17, 'pp', 3, 0)));
  return (dir > 0 ? inner : mirrorAt(x, inner)) + cartouche(x, y, 40, 58, 24);
}

/** Ribbon bow with a sapphire pendant and a drop pearl, at the foot. */
function bow(cx, y) {
  const loop = `M${P(cx - 8, y - 4)}C${P(cx - 46, y - 48, cx - 116, y - 40, cx - 106, y)}C${P(cx - 98, y + 30, cx - 44, y + 22, cx - 8, y + 6)}Z`;
  const fold = `M${P(cx - 14, y - 2)}C${P(cx - 46, y - 26, cx - 88, y - 24, cx - 90, y - 2)}C${P(cx - 70, y - 12, cx - 40, y - 6, cx - 14, y + 4)}Z`;
  const tail = `M${P(cx - 10, y + 8)}C${P(cx - 26, y + 34, cx - 48, y + 52, cx - 74, y + 84)}L${P(cx - 58, y + 78)}L${P(cx - 52, y + 96)}C${P(cx - 30, y + 64, cx - 12, y + 40, cx + 4, y + 12)}Z`;
  const one = (back) => g({},
    path(tail, { fill: `url(#silk${back ? 'Back' : ''})`, stroke: '#081650', strokeWidth: 1.6, strokeLinejoin: 'round' }),
    path(tail, { fill: 'none', stroke: '#f3d27a', strokeWidth: 1.6 }),
    path(loop, { fill: 'url(#silk)', stroke: '#081650', strokeWidth: 1.6 }),
    path(fold, { fill: '#081650', fillOpacity: 0.55 }),
    path(loop, { fill: 'none', stroke: '#f3d27a', strokeWidth: 1.6 }));
  return g({},
    g({ transform: 'translate(3 5)', opacity: 0.35 }, path(loop + tail, { fill: '#050c2e' }), mirrorAt(cx, path(loop + tail, { fill: '#050c2e' }))),
    one(0), mirrorAt(cx, one(1)),
    path(`M${P(cx, y + 10)}V${n(y + 34)}`, { stroke: INK, strokeWidth: 3.2 }),
    path(`M${P(cx, y + 10)}V${n(y + 34)}`, { stroke: '#f3d27a', strokeWidth: 1.6, strokeDasharray: '3 2' }),
    path(rr(cx - 14, y - 12, 28, 26, 9), { fill: 'url(#silk)', stroke: '#081650', strokeWidth: 1.6 }),
    path(rr(cx - 14, y - 12, 28, 26, 9), { fill: 'none', stroke: '#f3d27a', strokeWidth: 1.6 }),
    path(`M${P(cx - 6, y - 6)}Q${P(cx, y - 9, cx + 6, y - 6)}`, { stroke: '#9cc0ff', strokeOpacity: 0.6, strokeWidth: 2, fill: 'none', strokeLinecap: 'round' }),
    sapphire(cx, y + 50, 12, 15),
    dropPearl(cx, y + 68, 1.1));
}

function draw() {
  const bands = [
    band('astr', PR.astr, [[0, '#6b3f08'], [0.35, '#fff1b8'], [0.62, '#dfa63c'], [1, '#6b3f08']]),
    band('torus', PR.torus, [[0, '#7a4a0c'], [0.2, '#f6d684'], [0.4, '#fff3c8'], [0.62, '#d89c38'], [1, '#5e3606']]),
    band('fil', PR.fil, [[0, '#fff2c4'], [1, '#c08a2a']]),
    band('frieze', PR.frieze, [[0, '#8a5814'], [0.5, '#b8862e'], [1, '#93601a']], 0.12),
    band('bead', PR.bead, [[0, '#6b3f08'], [0.5, '#c99442'], [1, '#6b3f08']]),
    band('velvet', PR.velvet, [[0, '#050d36'], [0.45, '#10287a'], [1, '#1c3da6']], 0.1),
    band('slip', PR.slip, [[0, '#7a4a0c'], [0.45, '#f8da86'], [1, '#a8701c']]),
  ];
  const gad = tiled('gad', PR.torus, 21, gadroonTile), rin = tiled('rin', PR.frieze, 86, rinceauTile);
  const lace = tiled('lace', [PR.velvet[0], PR.velvet[0] + 22], 22, laceTile);
  const defs = [
    ...bands.map((b) => b.defs), gad.defs, rin.defs, lace.defs,
    lg4('carve', [[0, '#fff4c8'], [0.32, '#f8d77e'], [0.66, '#d39b3b'], [1, '#7a4a0c']]),
    lg4('shellG', [[0, '#fff3c8'], [0.45, '#efc35a'], [1, '#9c6616']]),
    rg4('boss', [0.35, 0.3, 0.8], [[0, '#fffbe6'], [0.5, '#f0c45a'], [1, '#7a4b0c']]),
    lg('fdlG', [0, 0, 0, 1], [[0, '#fff6d0'], [0.45, '#f4cc66'], [1, '#a8701c']]),
    lg('bandG', [0, 0, 0, 1], [[0, '#fff0b8'], [0.5, '#e8b94e'], [1, '#8a5a12']]),
    lg('silk', [0, 0, 0, 1], [[0, '#4a76f0'], [0.5, '#2a52cc'], [1, '#14318f']]),
    lg('silkBack', [0, 0, 0, 1], [[0, '#1d3a9c'], [1, '#0b1a56']]),
    lg('capG', [0, 0, 0, 1], [[0, '#2448b8'], [1, '#0a1a5c']]),
    rg('capSheen', [0.32, 0.3, 0.55], [[0, '#9cc0ff', 0.45], [1, '#9cc0ff', 0]]),
    rg('sapph', [0.35, 0.3, 0.85], [[0, '#d6e4ff'], [0.22, '#6a96ff'], [0.6, '#1d42c2'], [1, '#06124a']]),
    rg('enamel', [0.4, 0.35, 0.75], [[0, '#3a68ea'], [0.6, '#1a3aa8'], [1, '#0a1a5c']]),
    rg('pearl', [0.35, 0.3, 0.8], [[0, '#ffffff'], [0.55, '#efe9e2'], [1, '#aaa2bb']]),
  ].join('');

  const vx0 = O.x + PR.velvet[0], vy0 = O.y + PR.velvet[0], vw = O.w - 2 * PR.velvet[0], vh = O.h - 2 * PR.velvet[0];
  const CORNERS = [[1, 1, O.x, O.y], [-1, 1, O.x + O.w, O.y], [1, -1, O.x, O.y + O.h], [-1, -1, O.x + O.w, O.y + O.h]];
  const corners = CORNERS.map(([sx, sy, x, y]) => g({ transform: `translate(${x} ${y}) scale(${sx} ${sy})` }, corner(key(sx, sy)))
    + pearls(L.circle(x + sx * 60, y + sy * 60, 23), 6, 9) + sapphire(x + sx * 60, y + sy * 60, 13)).join('');
  const yB = O.y + O.h - 6, beadR = insetRect((PR.bead[0] + PR.bead[1]) / 2);
  const body = [
    // soft wall shadow
    [[16, 0.05], [10, 0.08], [5, 0.12]].map(([e, a]) => path(rr(O.x - e + 8, O.y - e + 14, O.w + 2 * e, O.h + 2 * e, e + 6), { fill: '#000', fillOpacity: a })).join(''),
    path(rr(O.x, O.y, O.w, O.h, 0), { fill: '#a8701c' }),
    ...bands.map((b) => b.body),
    gad.body, rin.body,
    // bead and reel
    path(beadR, { fill: 'none', stroke: '#2a1600', strokeOpacity: 0.4, strokeWidth: 7, strokeDasharray: '0.01 12', strokeLinecap: 'round', transform: 'translate(0.8 1.2)' }),
    path(beadR, { fill: 'none', stroke: '#f3cf72', strokeWidth: 6.6, strokeDasharray: '0.01 12', strokeLinecap: 'round' }),
    path(beadR, { fill: 'none', stroke: '#e0ad4c', strokeWidth: 4.2, strokeDasharray: '1.6 10.4', strokeDashoffset: -5.2 }),
    path(beadR, { fill: 'none', stroke: LIGHT, strokeWidth: 2.2, strokeDasharray: '0.01 12', strokeLinecap: 'round', transform: 'translate(-1.1 -1.1)' }),
    // velvet sheen toward the light-facing (bottom and right) sides
    path(`M${vx0 + 40} ${vy0 + vh - 22}H${vx0 + vw - 40}M${vx0 + vw - 22} ${vy0 + 40}V${vy0 + vh - 40}`, { stroke: '#7fa2ff', strokeOpacity: 0.14, strokeWidth: 14, strokeLinecap: 'round' }),
    lace.body,
    path(insetRect(PR.velvet[0] + 0.6), { fill: 'none', stroke: '#8e97b8', strokeOpacity: 0.7, strokeWidth: 1.2 }),
    path(insetRect(PR.slip[0]), { fill: 'none', stroke: INK, strokeOpacity: 0.7, strokeWidth: 1.4 }),
    path(insetRect(PR.slip[0] + 5.5), { fill: 'none', stroke: LIGHT, strokeOpacity: 0.55, strokeWidth: 1.2 }),
    path(rr(O.x + 0.6, O.y + 0.6, O.w - 1.2, O.h - 1.2, 0), { fill: 'none', stroke: INK, strokeWidth: 2 }),
    [PR.torus[0], PR.torus[1], PR.frieze[0], PR.frieze[1], PR.bead[1]].map((a) => path(insetRect(a), { fill: 'none', stroke: INK, strokeOpacity: 0.55, strokeWidth: 1.3 })).join(''),
    L.lip(rr(hole.x, hole.y, hole.w, hole.h, 0), '#0a0500', [[5, 0.3], [2, 0.6]]),
    // pearl swags under the foot rail
    swag(CX - 110, yB, CX - 380, yB, 24), swag(CX - 380, yB, CX - 640, yB, 24),
    swag(CX + 110, yB, CX + 380, yB, 24), swag(CX + 380, yB, CX + 640, yB, 24),
    [[CX - 380, yB], [CX + 380, yB]].map(([x, y]) => dropPearl(x, y + 8) + rosette(x, y, 11)).join(''),
    corners,
    sideMedallion(O.x + 30, CY, 1), sideMedallion(O.x + O.w - 30, CY, -1),
    crest(),
    bow(CX, O.y + O.h - 8),
    [[CX - 250, 120, 16], [O.x + 8, O.y + 4, 14], [O.x + O.w - 60, O.y + O.h - 20, 13], [O.x + O.w - 16, O.y + 300, 11], [CX + 120, 66, 12]]
      .map(([x, y, r]) => path(sparkle(x, y, r, 0.12), { fill: '#fffbe6' })).join(''),
  ].join('\n');
  return { defs, body };
}

module.exports = {
  W, H, hole, radius, draw,
  meta: {
    name: 'Château Gilt', theme: 'french renaissance', rarity: 'legendary', translucent: false, collection: 'old-masters', license: 'CC-BY-4.0',
    desc: 'A royal gilt frame with a crowned lily crest, pearl swags and lace-edged blue velvet that turns every game into a palace portrait.',
    tags: ['gold', 'royal', 'french', 'baroque', 'ornate', 'velvet', 'pearls'],
  },
};
