// Tiny pixel-art drawing API on a logical pixel grid (no deps). Shapes are built as Masks, painted
// onto a Canvas (one color string per pixel, null = transparent) and emitted as crisp, run-merged SVG.

// ---- color ---------------------------------------------------------------------------------------
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const rgb = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
export const hex = (a) => '#' + a.map((v) => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, '0')).join('');
export const mix = (a, b, t) => { const A = rgb(a), B = rgb(b); return hex(A.map((v, i) => v + (B[i] - v) * t)); };
/** '#rrggbb' + opacity -> '#rrggbbaa' (emitted as fill-opacity). */
export const alpha = (c, a) => c.slice(0, 7) + Math.round(clamp(a) * 255).toString(16).padStart(2, '0');

function hsv([r, g, b]) {
  r /= 255; g /= 255; b /= 255;
  const M = Math.max(r, g, b), m = Math.min(r, g, b), d = M - m;
  const h = !d ? 0 : M === r ? ((g - b) / d) % 6 : M === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [(h * 60 + 360) % 360, M ? d / M : 0, M];
}
function fromHsv(h, s, v) {
  const f = (n) => { const k = (n + h / 60) % 6; return v - v * s * Math.max(0, Math.min(k, 4 - k, 1)); };
  return hex([f(5), f(3), f(1)].map((x) => x * 255));
}

/** Hue-shifted ramp, dark -> light: shadows drift toward blue-violet, lights toward warm yellow. */
export function ramp(base, n = 5, { step = 0.14, hue = 10, sat = 0.07, mid = (n - 1) >> 1 } = {}) {
  const [h, s, v] = hsv(rgb(base));
  return Array.from({ length: n }, (_, i) => {
    const k = i - mid, to = k < 0 ? 250 : 55, d = ((to - h + 540) % 360) - 180;
    const hh = h + Math.sign(d) * Math.min(Math.abs(d), Math.abs(k) * hue);
    return fromHsv((hh + 360) % 360, clamp(s + (k < 0 ? sat : -sat) * Math.abs(k)), clamp(v + k * step));
  });
}

// Ordered 4x4 Bayer threshold in (0, 1); at t = .5 it is an exact checkerboard.
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
export const bayer = (x, y) => BAYER[(y & 3) * 4 + (x & 3)];

/** Seeded PRNG (mulberry32) so builds are reproducible. */
export function rng(seed = 1) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Pixel-rounded corner: cut[i] = pixels removed from row i (conservative: kept pixels lie fully inside the arc).
export const cornerCuts = (r) => Array.from({ length: r }, (_, i) => Math.ceil(r - Math.sqrt(r * r - (r - i) ** 2) - 1e-9));

// ---- masks ---------------------------------------------------------------------------------------
export class Mask {
  constructor(w, h, d) { this.w = w; this.h = h; this.d = d || new Uint8Array(w * h); }
  has(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h && this.d[y * this.w + x] === 1; }
  put(x, y, v = 1) { if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.d[y * this.w + x] = v; return this; }
  each(fn) { for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) if (this.d[y * this.w + x]) fn(x, y); }
  plot(fn, x0 = 0, y0 = 0, x1 = this.w, y1 = this.h) {
    for (let y = Math.max(0, Math.floor(y0)); y < Math.min(this.h, Math.ceil(y1)); y++)
      for (let x = Math.max(0, Math.floor(x0)); x < Math.min(this.w, Math.ceil(x1)); x++) if (fn(x, y)) this.d[y * this.w + x] = 1;
    return this;
  }
  rect(x, y, w, h) { return this.plot(() => true, x, y, x + w, y + h); }
  /** Rounded rect; r is a number or [tl, tr, br, bl]. */
  rrect(x, y, w, h, r) {
    const R = Array.isArray(r) ? r : [r, r, r, r], C = R.map(cornerCuts);
    for (let j = 0; j < h; j++) {
      const b = h - 1 - j;
      const a = Math.max(j < R[0] ? C[0][j] : 0, b < R[3] ? C[3][b] : 0);
      const z = Math.max(j < R[1] ? C[1][j] : 0, b < R[2] ? C[2][b] : 0);
      for (let i = x + a; i < x + w - z; i++) this.put(i, y + j);
    }
    return this;
  }
  /** Ellipse inscribed in the box (pixel centers inside); k > 1 fattens small shapes. */
  oval(x, y, w, h, k = 1) {
    const cx = x + w / 2, cy = y + h / 2, rx = w / 2, ry = h / 2;
    return this.plot((i, j) => ((i + 0.5 - cx) / rx) ** 2 + ((j + 0.5 - cy) / ry) ** 2 <= k, x, y, x + w, y + h);
  }
  circle(cx, cy, r, k = 1) { return this.oval(cx - r, cy - r, 2 * r + 1, 2 * r + 1, k); }
  /** Even-odd polygon fill; points in pixel-edge coordinates. */
  poly(pts) {
    const ys = pts.map((p) => p[1]);
    for (let y = Math.max(0, Math.floor(Math.min(...ys))); y < Math.min(this.h, Math.ceil(Math.max(...ys))); y++) {
      const yc = y + 0.5, xs = [];
      for (let i = 0; i < pts.length; i++) {
        const [ax, ay] = pts[i], [bx, by] = pts[(i + 1) % pts.length];
        if ((ay <= yc) !== (by <= yc)) xs.push(ax + ((yc - ay) / (by - ay)) * (bx - ax));
      }
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2) for (let x = Math.ceil(xs[k] - 0.5); x + 0.5 < xs[k + 1]; x++) this.put(x, y);
    }
    return this;
  }
  /** Pixels whose centers lie within r of the segment between two pixel centers. */
  capsule(x0, y0, x1, y1, r) {
    const dx = x1 - x0, dy = y1 - y0, L = dx * dx + dy * dy || 1;
    return this.plot((x, y) => {
      const t = clamp(((x - x0) * dx + (y - y0) * dy) / L);
      return (x - x0 - t * dx) ** 2 + (y - y0 - t * dy) ** 2 <= r * r;
    }, Math.min(x0, x1) - r - 1, Math.min(y0, y1) - r - 1, Math.max(x0, x1) + r + 2, Math.max(y0, y1) + r + 2);
  }
  /** 1px Bresenham line between pixel centers. */
  line(x0, y0, x1, y1) {
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let e = dx + dy;
    for (;;) {
      this.put(x0, y0);
      if (x0 === x1 && y0 === y1) return this;
      const e2 = 2 * e;
      if (e2 >= dy) { e += dy; x0 += sx; }
      if (e2 <= dx) { e += dx; y0 += sy; }
    }
  }
  pts(list) { for (const [x, y] of list) this.put(x, y); return this; }
  clone() { return new Mask(this.w, this.h, this.d.slice()); }
  op(m, f) { const o = this.clone(); for (let i = 0; i < o.d.length; i++) o.d[i] = f(this.d[i], m.d[i]) ? 1 : 0; return o; }
  or(m) { return this.op(m, (a, b) => a || b); }
  and(m) { return this.op(m, (a, b) => a && b); }
  sub(m) { return this.op(m, (a, b) => a && !b); }
  not() { const o = this.clone(); for (let i = 0; i < o.d.length; i++) o.d[i] ^= 1; return o; }
  clip(x, y, w, h) { return this.and(new Mask(this.w, this.h).rect(x, y, w, h)); }
  shift(dx, dy) { const o = new Mask(this.w, this.h); this.each((x, y) => o.put(x + dx, y + dy)); return o; }
  /** Union with the horizontal mirror image about x = (axis - 1) / 2 (default: the canvas center). */
  mirror(axis = this.w) { const o = this.clone(); this.each((x, y) => o.put(axis - 1 - x, y)); return o; }
  erode(n = 1, diag = false) {
    let m = this;
    for (let k = 0; k < n; k++) {
      const s = m, o = new Mask(this.w, this.h);
      s.each((x, y) => {
        if (s.has(x - 1, y) && s.has(x + 1, y) && s.has(x, y - 1) && s.has(x, y + 1) &&
          (!diag || (s.has(x - 1, y - 1) && s.has(x + 1, y - 1) && s.has(x - 1, y + 1) && s.has(x + 1, y + 1)))) o.put(x, y);
      });
      m = o;
    }
    return m;
  }
  dilate(n = 1, diag = false) {
    let m = this;
    for (let k = 0; k < n; k++) {
      const s = m, o = s.clone();
      s.each((x, y) => {
        for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) if (diag || !i || !j) o.put(x + i, y + j);
      });
      m = o;
    }
    return m;
  }
  edge(diag = false) { return this.sub(this.erode(1, diag)); }
  ring(diag = false) { return this.dilate(1, diag).sub(this); }
  bbox() {
    let x0 = Infinity, y0 = Infinity, x1 = -1, y1 = -1;
    this.each((x, y) => { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); });
    return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
  }
}

// ---- pixel fonts (rows as bit masks, MSB = left) ------------------------------------------------
const F3 = {
  A: [2, 5, 7, 5, 5], B: [6, 5, 6, 5, 6], C: [3, 4, 4, 4, 3], D: [6, 5, 5, 5, 6], E: [7, 4, 6, 4, 7], F: [7, 4, 6, 4, 4],
  G: [3, 4, 5, 5, 3], H: [5, 5, 7, 5, 5], I: [7, 2, 2, 2, 7], J: [1, 1, 1, 5, 2], K: [5, 5, 6, 5, 5], L: [4, 4, 4, 4, 7],
  M: [5, 7, 7, 5, 5], N: [6, 5, 5, 5, 5], O: [2, 5, 5, 5, 2], P: [6, 5, 6, 4, 4], Q: [2, 5, 5, 6, 3], R: [6, 5, 6, 5, 5],
  S: [3, 4, 2, 1, 6], T: [7, 2, 2, 2, 2], U: [5, 5, 5, 5, 7], V: [5, 5, 5, 5, 2], W: [5, 5, 7, 7, 5], X: [5, 5, 2, 5, 5],
  Y: [5, 5, 2, 2, 2], Z: [7, 1, 2, 4, 7], 0: [7, 5, 5, 5, 7], 1: [2, 6, 2, 2, 7], 2: [6, 1, 2, 4, 7], 3: [6, 1, 2, 1, 6],
  4: [5, 5, 7, 1, 1], 5: [7, 4, 6, 1, 6], 6: [3, 4, 6, 5, 2], 7: [7, 1, 2, 2, 2], 8: [2, 5, 2, 5, 2], 9: [2, 5, 3, 1, 6],
  ' ': [0, 0, 0, 0, 0], '.': [0, 0, 0, 0, 2], '-': [0, 0, 7, 0, 0], '!': [2, 2, 2, 0, 2], ':': [0, 2, 0, 2, 0],
  '+': [0, 2, 7, 2, 0], '/': [1, 1, 2, 4, 4], '<': [1, 2, 4, 2, 1], '>': [4, 2, 1, 2, 4], '*': [0, 5, 2, 5, 0],
};
const F5 = {
  A: [14, 17, 17, 31, 17, 17, 17], B: [30, 17, 17, 30, 17, 17, 30], C: [14, 17, 16, 16, 16, 17, 14], D: [30, 17, 17, 17, 17, 17, 30],
  E: [31, 16, 16, 30, 16, 16, 31], F: [31, 16, 16, 30, 16, 16, 16], G: [14, 17, 16, 23, 17, 17, 15], H: [17, 17, 17, 31, 17, 17, 17],
  I: [14, 4, 4, 4, 4, 4, 14], J: [7, 2, 2, 2, 2, 18, 12], K: [17, 18, 20, 24, 20, 18, 17], L: [16, 16, 16, 16, 16, 16, 31],
  M: [17, 27, 21, 21, 17, 17, 17], N: [17, 17, 25, 21, 19, 17, 17], O: [14, 17, 17, 17, 17, 17, 14], P: [30, 17, 17, 30, 16, 16, 16],
  Q: [14, 17, 17, 17, 21, 18, 13], R: [30, 17, 17, 30, 20, 18, 17], S: [15, 16, 16, 14, 1, 1, 30], T: [31, 4, 4, 4, 4, 4, 4],
  U: [17, 17, 17, 17, 17, 17, 14], V: [17, 17, 17, 17, 17, 10, 4], W: [17, 17, 17, 21, 21, 21, 10], X: [17, 17, 10, 4, 10, 17, 17],
  Y: [17, 17, 10, 4, 4, 4, 4], Z: [31, 1, 2, 4, 8, 16, 31], 0: [14, 17, 19, 21, 25, 17, 14], 1: [4, 12, 4, 4, 4, 4, 14],
  2: [14, 17, 1, 2, 4, 8, 31], 3: [31, 2, 4, 2, 1, 17, 14], 4: [2, 6, 10, 18, 31, 2, 2], 5: [31, 16, 30, 1, 1, 17, 14],
  6: [6, 8, 16, 30, 17, 17, 14], 7: [31, 1, 2, 4, 8, 8, 8], 8: [14, 17, 17, 14, 17, 17, 14], 9: [14, 17, 17, 15, 1, 2, 12],
  ' ': [0, 0, 0, 0, 0, 0, 0], '.': [0, 0, 0, 0, 0, 0, 4], '-': [0, 0, 0, 14, 0, 0, 0], '!': [4, 4, 4, 4, 4, 0, 4],
};
export const FONTS = { 3: { w: 3, h: 5, g: F3 }, 5: { w: 5, h: 7, g: F5 } };

// ---- canvas --------------------------------------------------------------------------------------
export class Canvas {
  constructor(w, h) { this.w = w; this.h = h; this.p = new Array(w * h).fill(null); this.layers = []; this.hole = null; this.ramps = []; }
  mask() { return new Mask(this.w, this.h); }
  in(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }
  get(x, y) { return this.in(x, y) ? this.p[y * this.w + x] : null; }
  set(x, y, c) { if (this.in(x, y) && c !== undefined) this.p[y * this.w + x] = c; return this; }
  /** Paint a mask with a color, or fn(x, y, current) -> color. */
  fill(m, c) { m.each((x, y) => this.set(x, y, typeof c === 'function' ? c(x, y, this.get(x, y)) : c)); return this; }
  rect(x, y, w, h, c) { return this.fill(this.mask().rect(x, y, w, h), c); }
  px(list, c) { for (const [x, y] of list) this.set(x, y, c); return this; }
  opaque() { const m = this.mask(); for (let i = 0; i < this.p.length; i++) m.d[i] = this.p[i] ? 1 : 0; return m; }

  /** Register palette ramps (dark -> light) so up()/down() can step any painted color along its ramp. */
  use(...ramps) { this.ramps.push(...ramps); return ramps[0]; }
  step(c, n) {
    if (!c) return c;
    const base = c.slice(0, 7), a = c.slice(7);
    for (const r of this.ramps) {
      const i = r.indexOf(base);
      if (i >= 0) return r[clamp(i + n, 0, r.length - 1)] + a;
    }
    return mix(base, n < 0 ? '#1a1030' : '#fff6d8', Math.min(1, Math.abs(n) * 0.18)) + a;
  }

  /**
   * Bevel-shade a mask with a ramp (dark -> light), light from the top-left. top/left/bottom/right are
   * ramp indices for the 1st, 2nd... pixel in from that edge; fill is an index, [indices] for a dithered
   * vertical gradient, or fn(x, y) -> color. Recessed areas just swap the edge lists.
   */
  shade(m, R, o = {}) {
    const n = R.length, { top = [n - 1], left = [n - 2], bottom = [0], right = [1], fill = Math.max(0, n - 3), soft = 0.5 } = o;
    const bb = m.bbox();
    if (!bb) return this;
    const inner = typeof fill === 'function' ? fill
      : Array.isArray(fill) ? (x, y) => R[gradIdx(fill, (y - bb.y) / Math.max(1, bb.h - 1), x, y, soft)] : () => R[fill];
    const dist = (x, y, dx, dy, k) => { for (let i = 1; i <= k; i++) if (!m.has(x + dx * i, y + dy * i)) return i; return k + 1; };
    m.each((x, y) => {
      const i = bottom[dist(x, y, 0, 1, bottom.length) - 1] ?? top[dist(x, y, 0, -1, top.length) - 1]
        ?? right[dist(x, y, 1, 0, right.length) - 1] ?? left[dist(x, y, -1, 0, left.length) - 1];
      this.set(x, y, i != null ? R[i] : inner(x, y));
    });
    return this;
  }

  /** Dithered gradient over a mask: dir 'v' | 'h' | {cx, cy, r} (radial); soft = width of each dithered band. */
  grad(m, colors, { dir = 'v', soft = 0.5, from, to } = {}) {
    const bb = m.bbox();
    if (!bb) return this;
    const t = typeof dir === 'object' ? (x, y) => Math.hypot(x + 0.5 - dir.cx, y + 0.5 - dir.cy) / dir.r
      : dir === 'h' ? (x) => (x - (from ?? bb.x)) / Math.max(1, (to ?? bb.x + bb.w - 1) - (from ?? bb.x))
        : (x, y) => (y - (from ?? bb.y)) / Math.max(1, (to ?? bb.y + bb.h - 1) - (from ?? bb.y));
    const idx = colors.map((_, i) => i);
    return this.fill(m, (x, y) => colors[gradIdx(idx, t(x, y), x, y, soft)]);
  }
  dither(m, a, b, t = 0.5) { return this.fill(m, (x, y) => (bayer(x, y) < t ? b : a)); }
  /** Step colors under a mask along their ramps (n > 0 lighter); t < 1 dithers the change. */
  tone(m, n, t = 1) { return this.fill(m, (x, y, c) => (bayer(x, y) < t ? this.step(c, n) : c)); }
  /** Radial light/shadow: steps colors up by `n` near (cx, cy), fading out by radius r with dithering. */
  glow(m, cx, cy, r, n = 1) {
    return this.fill(m, (x, y, c) => {
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy) / r;
      if (d >= 1 || !c) return c;
      const s = (1 - d) * n, k = Math.floor(s);
      return this.step(c, k + (s - k > bayer(x, y) ? 1 : 0));
    });
  }
  /** 1px outline around a mask (default: everything painted so far), on empty pixels only unless all. */
  outline(c, m = this.opaque(), { all = false, diag = false } = {}) {
    m.ring(diag).each((x, y) => { if (all || !this.get(x, y)) this.set(x, y, c); });
    return this;
  }
  /** Drop shadow of a mask onto what is already painted (dx, dy offset, n ramp steps darker). */
  cast(m, dx = 1, dy = 1, n = -1) { return this.tone(m.shift(dx, dy).sub(m).and(this.opaque()), n); }

  textMask(str, x, y, { font = 3, scale = 1, gap = 1, align = 'left', italic = 0 } = {}) {
    const F = FONTS[font], m = this.mask(), s = String(str).toUpperCase();
    if (align === 'center') x -= Math.floor(this.textWidth(s, { font, scale, gap }) / 2);
    let cx = x;
    for (const ch of s) {
      const g = F.g[ch] || F.g[' '];
      g.forEach((row, j) => {
        const sh = Math.round(((F.h - 1 - j) * italic) / (F.h - 1)) * scale;
        for (let i = 0; i < F.w; i++) if (row & (1 << (F.w - 1 - i))) m.rect(cx + sh + i * scale, y + j * scale, scale, scale);
      });
      cx += (F.w + gap) * scale;
    }
    return m;
  }
  textWidth(str, { font = 3, scale = 1, gap = 1 } = {}) { return (String(str).length * (FONTS[font].w + gap) - gap) * scale; }
  text(str, x, y, c, o) { return this.fill(this.textMask(str, x, y, o), c); }

  /** Extra layer drawn on top inside <g class="cls"> (for CSS animation: blinking LEDs, flames...). */
  layer(cls) { const l = new Canvas(this.w, this.h); l.ramps = this.ramps; this.layers.push({ cls, cv: l }); return l; }

  /** Punch the transparent screen opening (call last). r = pixel corner radius. */
  punch(x, y, w, h, r = 0) {
    const m = this.mask().rrect(x, y, w, h, r);
    for (const c of [this, ...this.layers.map((l) => l.cv)]) c.fill(m, null);
    this.hole = { x, y, w, h, r };
    return this;
  }

  toSVG(css = '') {
    const style = css ? `<style>${css}@media (prefers-reduced-motion:reduce){*{animation:none!important}}</style>\n` : '';
    const layers = this.layers.map((l) => `<g class="${l.cls}">\n${paths(l.cv)}</g>\n`).join('');
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${this.w} ${this.h}" width="${this.w}" height="${this.h}" shape-rendering="crispEdges">\n${style}${paths(this)}${layers}</svg>\n`;
  }
}

function gradIdx(stops, t, x, y, soft) {
  const p = clamp(t) * (stops.length - 1), i = Math.min(stops.length - 2, Math.floor(p));
  if (stops.length < 2) return stops[0];
  const f = clamp((p - i - 0.5) / Math.max(soft, 1e-6) + 0.5);
  return stops[f > bayer(x, y) ? i + 1 : i];
}

// One <path> per color; each rect is "M x y h w v h h -w z" (greedy: horizontal runs grown downward).
function paths(cv) {
  const { w, h, p } = cv, used = new Uint8Array(w * h), out = new Map();
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const c = p[y * w + x];
    if (!c || used[y * w + x]) continue;
    let x1 = x;
    while (x1 < w && p[y * w + x1] === c && !used[y * w + x1]) x1++;
    let y1 = y + 1;
    grow: for (; y1 < h; y1++) for (let k = x; k < x1; k++) if (p[y1 * w + k] !== c || used[y1 * w + k]) break grow;
    for (let j = y; j < y1; j++) used.fill(1, j * w + x, j * w + x1);
    if (!out.has(c)) out.set(c, []);
    out.get(c).push(`M${x} ${y}h${x1 - x}v${y1 - y}h-${x1 - x}z`);
  }
  return [...out.keys()].sort().map((c) => {
    const op = c.length > 7 ? ` fill-opacity="${+(parseInt(c.slice(7), 16) / 255).toFixed(2)}"` : '';
    return `<path fill="${c.slice(0, 7)}"${op} d="${out.get(c).join('')}"/>\n`;
  }).join('');
}
