// Pixel-art environment fills: small living scenes drawn into a low-resolution buffer (about 150 art
// pixels across, whatever the box) and blown up with nearest-neighbour scaling, so every box from a
// tall portrait shell to a wide stage gets crisp, evenly sized pixels. Static layers are painted once
// per resize into offscreen tiles (horizontal ones are periodic, so they scroll seamlessly); a frame
// only blits those tiles at integer offsets and plots a few dozen particles, with no allocations.
// Every scene is a function of time and its seed, so a still frame (reduced motion) is just t.

const { sin, cos, min, max, sqrt, round, ceil, floor, abs, PI } = Math;
const TAU = PI * 2;
const clamp = (v, a, b) => min(b, max(a, v));
const mix = (a, b, t) => [0, 1, 2].map(i => round(a[i] + (b[i] - a[i]) * t));
const css = (c, a) => (a == null ? `rgb(${c[0]},${c[1]},${c[2]})` : `rgba(${c[0]},${c[1]},${c[2]},${a})`);
const WHITE = [255, 255, 255], BLACK = [0, 0, 0];
const rng = seed => () => { // mulberry32 (same as screensavers.js)
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const surface = (w, h) => {
  const c = typeof OffscreenCanvas === 'function' ? new OffscreenCanvas(1, 1) : document.createElement('canvas');
  c.width = max(1, ceil(w)); c.height = max(1, ceil(h));
  return c;
};
const ART = 150; // art pixels along the geometric mean of the box
const GLOW = 3; // the light buffer is this many times coarser than the art buffer
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => (v + 0.5) / 16);
const dith = (x, y) => BAYER[(y & 3) * 4 + (x & 3)];
const fract = v => v - floor(v);
const hash = (x, y, s) => fract(sin(x * 127.1 + y * 311.7 + s * 74.7) * 43758.5453);

// Pixel writer over an ImageData. wrap: x wraps around the width (for periodic tiles).
function pixels(c, wrap = false) {
  const w = c.width, h = c.height, g = c.getContext('2d'), id = g.createImageData(w, h), d = id.data;
  const set = (x, y, col, a = 255) => {
    x = floor(x); y = floor(y);
    if (wrap) x = ((x % w) + w) % w;
    if (x < 0 || y < 0 || x >= w || y >= h || !col) return;
    const o = (y * w + x) * 4;
    if (a < 255 && d[o + 3]) { const k = a / 255; d[o] += (col[0] - d[o]) * k; d[o + 1] += (col[1] - d[o + 1]) * k; d[o + 2] += (col[2] - d[o + 2]) * k; return; }
    d[o] = col[0]; d[o + 1] = col[1]; d[o + 2] = col[2]; d[o + 3] = a;
  };
  return {
    w, h, set,
    rect(x, y, rw, rh, col, a) { for (let j = 0; j < rh; j++) for (let i = 0; i < rw; i++) set(x + i, y + j, col, a); },
    alpha: (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : d[(floor(y) * w + floor(x)) * 4 + 3]),
    done() { g.putImageData(id, 0, 0); return c; },
  };
}
// Colour of a multi-stop ramp [[offset, rgb], ...] at t.
const sample = (stops, t) => {
  if (t <= stops[0][0]) return stops[0][1];
  for (let i = 1; i < stops.length; i++) if (t <= stops[i][0]) {
    const [o0, c0] = stops[i - 1], [o1, c1] = stops[i];
    return mix(c0, c1, (t - o0) / max(1e-6, o1 - o0));
  }
  return stops[stops.length - 1][1];
};
// Banded, ordered-dithered vertical gradient over rows y0..y1.
function skyBands(px, y0, y1, stops, bands = 10) {
  const cols = Array.from({ length: bands }, (_, i) => sample(stops, i / (bands - 1)));
  for (let y = y0; y < y1; y++) {
    const q = ((y - y0) / max(1, y1 - y0 - 1)) * (bands - 1), lo = floor(q), f = q - lo;
    for (let x = 0; x < px.w; x++) px.set(x, y, cols[min(bands - 1, f > dith(x, y) ? lo + 1 : lo)]);
  }
}
// Periodic 1D noise in [-1, 1]: integer cycles per period P, so a tile of width P loops seamlessly.
const waves = (r, P, spec) => {
  const ts = spec.map(([wl, a]) => [max(1, round(P / wl)), a, r() * TAU]), n = ts.reduce((s, x) => s + x[1], 0);
  return x => { let v = 0; for (const [f, a, p] of ts) v += a * sin((TAU * f * x) / P + p); return v / n; };
};
// Blit a periodic tile scrolled left by ox art pixels (whole pixels only: no smeared art).
const scroll = (b, c, ox, y = 0) => {
  const P = c.width, o = (((ox % P) + P) % P) | 0;
  b.drawImage(c, -o, y);
  if (P - o < b.canvas.width) b.drawImage(c, P - o, y);
};
const wrapX = (x, P) => ((x % P) + P) % P;
// Sprite from strings: each char maps to a colour (missing = transparent). flip mirrors it.
function sprite(rows, map, flip = false) {
  const c = surface(rows[0].length, rows.length), px = pixels(c);
  rows.forEach((row, y) => [...row].forEach((ch, x) => map[ch] && px.set(flip ? row.length - 1 - x : x, y, map[ch])));
  return px.done();
}
const disc = (px, cx, cy, r, colAt) => {
  for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) {
    const d = (x * x + y * y) / (r * r);
    if (d <= 1.02) { const c = colAt(x, y, d); if (c) px.set(cx + x, cy + y, c); }
  }
};
// Soft dithered halo (a ring of scattered pixels fading out).
const halo = (px, cx, cy, r0, r1, col, density = 0.6) => {
  for (let y = -r1; y <= r1; y++) for (let x = -r1; x <= r1; x++) {
    const d = sqrt(x * x + y * y);
    if (d > r0 && d < r1 && ((1 - (d - r0) / (r1 - r0)) ** 2) * density > dith(cx + x, cy + y)) px.set(cx + x, cy + y, col);
  }
};
// Soft light sprites for the glow buffer, made once per scene: a round dot and a bottom-up band.
const softDot = col => {
  const c = surface(32, 32), g = c.getContext('2d'), rg = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  rg.addColorStop(0, css(col, 1)); rg.addColorStop(0.3, css(col, 0.55)); rg.addColorStop(1, css(col, 0));
  g.fillStyle = rg; g.fillRect(0, 0, 32, 32);
  return c;
};
const softBand = col => {
  const c = surface(1, 32), g = c.getContext('2d'), lg = g.createLinearGradient(0, 0, 0, 32);
  lg.addColorStop(0, css(col, 0)); lg.addColorStop(0.6, css(col, 0.8)); lg.addColorStop(1, css(col, 1));
  g.fillStyle = lg; g.fillRect(0, 0, 1, 32);
  return c;
};
// Pixel pine: stacked tiers, rim pixels on the right (moon side), optional snow on the tier edges.
function pine(px, x, yb, h, col, rim, snow) {
  x = round(x); h = max(4, round(h));
  const top = yb - h, tiers = h > 26 ? 4 : 3, th = h / tiers;
  for (let i = 0; i < h - 1; i++) {
    const j = min(tiers - 1, floor(i / th)), yy = i - j * th, hw = floor(yy * 0.55 + j * 1.2 + (i ? 0.5 : 0));
    for (let k = -hw; k <= hw; k++) px.set(x + k, top + i, col);
    if (rim && hw > 0) px.set(x + hw, top + i, rim);
    if (snow && yy > th - 1.5 && hw > 1) { px.set(x - hw, top + i - 1, snow); px.set(x + hw, top + i - 1, snow); px.set(x + hw - 1, top + i - 1, snow); }
  }
  px.set(x, top - 1, snow || col);
  px.set(x, yb - 1, col); px.set(x, yb, col);
}

// Shared shell: picks the art scale, owns the art + light buffers and does the final crisp blit.
// build({ pal, rand, seed }) -> { glow (alpha, 0 = none), layout(bw, bh), frame(b, t, dt, bw, bh), light?(g, t, bw, bh), warm? }
function env(build) {
  return ({ pal, rand }) => {
    const seed = floor(rand() * 2147483647);
    const sc = build({ pal, rand, seed });
    let S = 1, bw = 0, bh = 0, buf = null, b = null, lb = null, g = null, gw = 0, gh = 0;
    return {
      warm: sc.warm || 1,
      resize(w, h, k) {
        const dw = w * k, dh = h * k;
        S = max(1, round(sqrt(dw * dh) / ART));
        bw = max(16, ceil(dw / S)); bh = max(16, ceil(dh / S));
        buf = surface(bw, bh); b = buf.getContext('2d');
        b.imageSmoothingEnabled = false;
        if (sc.glow) { gw = ceil(bw / GLOW) + 1; gh = ceil(bh / GLOW) + 1; lb = surface(gw, gh); g = lb.getContext('2d'); }
        sc.layout(bw, bh);
      },
      draw(c, t, dt) {
        sc.frame(b, t, dt, bw, bh);
        b.globalAlpha = 1; b.globalCompositeOperation = 'source-over';
        c.setTransform(1, 0, 0, 1, 0, 0);
        c.imageSmoothingEnabled = false;
        c.drawImage(buf, 0, 0, bw * S, bh * S);
        if (g) {
          g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.clearRect(0, 0, gw, gh);
          g.setTransform(1 / GLOW, 0, 0, 1 / GLOW, 0, 0);
          sc.light(g, t, bw, bh);
          g.globalAlpha = 1;
          c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'low';
          c.globalCompositeOperation = 'lighter'; c.globalAlpha = sc.glow;
          c.drawImage(lb, 0, 0, gw * GLOW * S, gh * GLOW * S);
          c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1;
        }
        c.imageSmoothingEnabled = true;
      },
    };
  };
}
const vscale = bh => clamp(bh / 100, 0.7, 1.8);

// ---- 1. Firefly forest: misty pine ridges under a moon, blinking fireflies, falling leaves -------
const forest = env(({ pal: [bg, leaf, fly, mist], rand, seed }) => {
  const deep = mix(bg, BLACK, 0.4);
  const cols = [mix(mix(bg, mist, 0.38), leaf, 0.1), mix(mix(bg, mist, 0.2), leaf, 0.2), mix(bg, leaf, 0.2), mix(deep, leaf, 0.08)];
  const rims = [mix(cols[0], mist, 0.25), mix(cols[1], mist, 0.3), mix(cols[2], mist, 0.3), mix(cols[3], leaf, 0.35)];
  const SPEED = [0.5, 1.3, 2.8, 5.5];
  const fC = [css(mix(fly, WHITE, 0.55)), css(fly), css(mix(fly, bg, 0.45))], dot = softDot(fly);
  const leafC = [css(mix(mix(leaf, fly, 0.4), bg, 0.35)), css(mix(mix(leaf, [235, 120, 60], 0.5), bg, 0.35)), css(mix(leaf, bg, 0.2))];
  let sky, layers, mists, flies = [], leaves = [], vs = 1, mistY = [0, 0];
  return {
    glow: 0.85,
    layout(bw, bh) {
      const r = rng(seed), P = max(bw, 96);
      vs = vscale(bh);
      sky = surface(bw, bh);
      const s = pixels(sky);
      skyBands(s, 0, bh, [[0, mix(bg, BLACK, 0.35)], [0.5, bg], [0.85, mix(bg, mist, 0.3)], [1, mix(bg, mist, 0.4)]], 12);
      for (let i = 0; i < (bw * bh) / 420; i++) { const x = r() * bw, y = r() * bh * 0.55; s.set(x, y, mix(mist, WHITE, r() * 0.6), 60 + r() * 150); }
      const mx = round(bw * 0.74), my = round(min(bh * 0.2, 30 * vs)), mr = round(clamp(min(bw, bh) * 0.07, 3, 9));
      halo(s, mx, my, mr, mr * 3.2, mix(bg, mist, 0.35), 0.5);
      halo(s, mx, my, mr, mr * 1.8, mix(bg, mist, 0.55), 0.7);
      disc(s, mx, my, mr, (x, y) => (hash(x + 3, y, seed) > 0.85 ? mix(mist, WHITE, 0.45) : mix(mist, WHITE, 0.75)));
      sky = s.done();
      const spec = [
        { base: 16, amp: 5, hMin: 9, hMax: 16, gap: 6 }, { base: 10, amp: 4, hMin: 14, hMax: 26, gap: 9 },
        { base: 5, amp: 3, hMin: 24, hMax: 42, gap: 14 },
      ];
      layers = spec.map((L, i) => {
        const c = surface(P, bh), px = pixels(c, true), ground = waves(r, P, [[P / 1.3, 1], [40, 0.5], [17, 0.2]]);
        const yb = x => round(bh - L.base * vs - L.amp * vs * ground(x));
        for (let x = 0; x < P; x++) for (let y = yb(x); y < bh; y++) px.set(x, y, cols[i]);
        for (let x = r() * L.gap; x < P; x += L.gap * (0.6 + r() * 0.8)) pine(px, x, yb(round(x) % P) + 1, (L.hMin + r() * (L.hMax - L.hMin)) * vs, cols[i], rims[i]);
        return px.done();
      });
      { // front: a few dark trunks running out of the top, ferns and grass along the ground
        const c = surface(P, bh), px = pixels(c, true), gy = x => round(bh - 2 * vs - 1.5 * sin((x / P) * TAU * 3));
        for (let x = 0; x < P; x++) for (let y = gy(x); y < bh; y++) px.set(x, y, cols[3]);
        for (let x = 0; x < P; x++) if (r() < 0.55) { const h = 1 + floor(r() * 4 * vs); for (let y = 0; y < h; y++) px.set(x, gy(x) - 1 - y, y ? cols[3] : rims[3]); }
        const n = max(1, round(P / 85)); // a few big foreground pines, close to the camera
        for (let i = 0; i < n; i++) {
          const x0 = round(((i + 0.25 + r() * 0.5) * P) / n);
          pine(px, x0, gy(x0) + 1, min(bh * 0.7, (48 + r() * 20) * vs), cols[3], rims[3]);
        }
        for (let x = r() * 5; x < P; x += 4 + r() * 9) { // fern fronds
          const h = round((2 + r() * 3) * vs), x0 = round(x);
          for (let k = 0; k < h; k++) { px.set(x0 - k, gy(x0) - h + k, cols[3]); px.set(x0 + k, gy(x0) - h + k, cols[3]); px.set(x0, gy(x0) - h + k, rims[3]); }
        }
        layers.push(px.done());
      }
      mists = [0, 1].map(i => { // drifting dithered mist bands
        const mh = round((8 + 4 * i) * vs), c = surface(P, mh), px = pixels(c, true), n = waves(r, P, [[P / 2, 1], [23, 0.6]]);
        for (let y = 0; y < mh; y++) for (let x = 0; x < P; x++) {
          const v = sin((PI * y) / mh) * (0.55 + 0.45 * n(x)) * (i ? 0.45 : 0.6);
          if (v > dith(x, y)) px.set(x, y, mix(bg, mist, 0.5 - i * 0.15));
        }
        return px.done();
      });
      mistY = [round(bh - 16 * vs - mists[0].height * 0.6), round(bh - 9 * vs - mists[1].height * 0.5)];
      const nf = clamp(round((bw * bh) / 550), 10, 54);
      flies = Array.from({ length: nf }, (_, i) => ({ x: rand() * bw, y: bh * (0.3 + 0.65 * rand()), ax: 3 + rand() * 6, ay: 2 + rand() * 4,
        fx: 0.2 + rand() * 0.4, fy: 0.3 + rand() * 0.5, p: rand() * TAU, f: 0.8 + rand() * 1.6, back: i % 2 === 0, px: 0, py: 0, a: 0 }));
      leaves = Array.from({ length: clamp(round((bw * bh) / 2400), 4, 16) }, () => ({ x: rand() * bw, y: rand() * bh, v: 5 + rand() * 6, p: rand() * TAU, c: floor(rand() * 3) }));
    },
    frame(b, t, dt, bw, bh) {
      b.drawImage(sky, 0, 0);
      scroll(b, layers[0], t * SPEED[0]);
      scroll(b, mists[0], t * 2.2, mistY[0]);
      scroll(b, layers[1], t * SPEED[1]);
      const fly = back => {
        for (const f of flies) {
          if (f.back !== back) continue;
          f.px = wrapX(f.x + sin(t * f.fx + f.p) * f.ax - t * (back ? 1.3 : 2.6), bw);
          f.py = f.y + sin(t * f.fy + f.p * 2) * f.ay;
          const s = sin(t * f.f + f.p); f.a = s > 0.15 ? s : 0;
          if (!f.a) continue;
          b.fillStyle = fC[f.a > 0.75 ? 0 : f.a > 0.4 ? 1 : 2];
          b.fillRect(f.px | 0, f.py | 0, 1, 1);
        }
      };
      fly(true);
      b.globalAlpha = 0.7; scroll(b, mists[1], t * 3.6, mistY[1]); b.globalAlpha = 1;
      scroll(b, layers[2], t * SPEED[2]);
      fly(false);
      for (const l of leaves) {
        const y = (l.y + t * l.v) % (bh + 4) - 2, x = wrapX(l.x - t * 3 + sin(t * 1.4 + l.p) * 5, bw), flat = sin(t * 3 + l.p) > 0;
        b.fillStyle = leafC[l.c];
        b.fillRect(x | 0, y | 0, flat ? 2 : 1, flat ? 1 : 2);
      }
      scroll(b, layers[3], t * SPEED[3]);
    },
    light(g, t) {
      for (const f of flies) if (f.a) { g.globalAlpha = f.a; g.drawImage(dot, f.px - 5, f.py - 5, 11, 11); }
    },
  };
});

// ---- 2. Neon rain: a city at night in the rain, flickering signs, a wet street mirroring it all ----
const neonCity = env(({ pal: [bg, pink, cyan, warm], rand, seed }) => {
  const far = mix(bg, cyan, 0.13), mid = mix(bg, BLACK, 0.15), near = mix(bg, BLACK, 0.5);
  const rainC = [css(mix(cyan, WHITE, 0.45), 0.4), css(mix(cyan, bg, 0.35), 0.3)], splashC = css(mix(cyan, WHITE, 0.6), 0.8);
  const dots = [softDot(pink), softDot(cyan)];
  const winOn = css(warm), asphalt = css(mix(bg, BLACK, 0.4)), wet = css(mix(bg, pink, 0.35));
  let sky, tiles, signs = [], toggles = [], drops = [], splash = [], street = 0, P = 0, si = 0;
  return {
    glow: 0.95,
    layout(bw, bh) {
      const r = rng(seed), vs = vscale(bh);
      P = max(bw, 96); street = bh - max(7, round(bh * 0.2));
      const s = pixels(sky = surface(bw, bh));
      skyBands(s, 0, street, [[0, mix(bg, BLACK, 0.4)], [0.55, bg], [1, mix(bg, pink, 0.3)]], 12);
      for (let i = 0; i < (bw * street) / 400; i++) s.set(r() * bw, r() * street * 0.5, mix(bg, WHITE, 0.5));
      sky = s.done();
      const build = (col, hMin, hMax, wMin, wMax, winP, rim, isMid) => {
        const c = surface(P, bh), px = pixels(c, true);
        for (let x = 0; x < P;) {
          const w = min(P - x, wMin + floor(r() * (wMax - wMin))), h = round((hMin + r() * (hMax - hMin)) * vs), top = street - h;
          if (w < 3) break;
          px.rect(x, top, w, h + 1, col);
          if (rim) { for (let k = 0; k < w; k++) px.set(x + k, top, rim); if (isMid) for (let y = top; y < top + h * 0.5; y++) px.set(x, y, rim); }
          if (r() < 0.35) { const ax = x + 1 + floor(r() * (w - 2)); for (let y = 1; y < 3 + r() * 5; y++) px.set(ax, top - y, col); }
          for (let y = top + 2; y < street - 2; y += 3) for (let wx = x + 2; wx < x + w - 1; wx += 2) {
            const on = r() < winP;
            px.set(wx, y, on ? mix(col, warm, isMid ? 0.75 : 0.3) : mix(col, BLACK, 0.3));
            if (isMid && !on && r() < 0.1 && toggles.length < 40) toggles.push({ x: wx, y, f: 0.1 + r() * 0.3, p: r() * TAU });
          }
          x += w + (r() < 0.3 ? 1 + floor(r() * 3) : 0);
        }
        return px.done();
      };
      toggles = [];
      tiles = [build(far, 18, 46, 6, 14, 0.12), build(mid, 26, 62, 9, 18, 0.28, mix(mid, cyan, 0.2), true), build(near, 14, 34, 14, 26, 0.06, mix(near, pink, 0.22))];
      signs = [];
      for (let x = 3 + r() * 10; x < P - 6; x += 16 + r() * 22) { // neon signs on the near row
        const vert = r() < 0.6, sw = vert ? 3 + floor(r() * 2) : 8 + floor(r() * 7), sh = vert ? 9 + floor(r() * 9 * vs) : 3 + floor(r() * 2);
        const col = r() < 0.5 ? pink : cyan, c = surface(sw, sh), px = pixels(c);
        for (let y = 0; y < sh; y++) for (let k = 0; k < sw; k++) {
          const edge = !k || !y || k === sw - 1 || y === sh - 1;
          if (edge) px.set(k, y, col);
          else px.set(k, y, hash(k, y, x) > 0.45 ? mix(col, WHITE, 0.55) : mix(col, BLACK, 0.65));
        }
        signs.push({ c: px.done(), x: round(x), y: round(street - (12 + r() * 22) * vs), w: sw, h: sh, dot: dots[col === pink ? 0 : 1], f: 3 + r() * 6, p: r() * TAU, bad: r() < 0.3, on: 1 });
      }
      drops = Array.from({ length: clamp(round((bw * bh) / 130), 24, 220) }, () => ({ x: rand() * bw, y: rand() * bh, v: 70 + rand() * 60, l: 2 + floor(rand() * 3), z: rand() < 0.5 ? 1 : 0, end: street + rand() * (bh - street) }));
      splash = Array.from({ length: 24 }, () => ({ x: 0, y: 0, life: 1 }));
    },
    frame(b, t, dt, bw, bh) {
      const o = [t * 0.5, t * 1.1, t * 2.2];
      b.drawImage(sky, 0, 0);
      scroll(b, tiles[0], o[0]);
      scroll(b, tiles[1], o[1]);
      b.fillStyle = winOn;
      for (const w of toggles) if (sin(t * w.f + w.p) > 0.3) b.fillRect(wrapX(w.x - (o[1] | 0), P), w.y, 1, 1);
      scroll(b, tiles[2], o[2]);
      for (const s of signs) {
        s.on = s.bad && sin(t * s.f + s.p) * sin(t * 0.7 + s.p) > 0.7 ? 0.25 : 1;
        b.globalAlpha = s.on;
        const x = wrapX(s.x - (o[2] | 0), P);
        b.drawImage(s.c, x, s.y);
        if (x + s.w > P) b.drawImage(s.c, x - P, s.y);
      }
      b.globalAlpha = 1;
      // the wet street: a squashed, rippling mirror of everything above it
      b.fillStyle = asphalt; b.fillRect(0, street, bw, bh - street);
      const sh = bh - street;
      for (let y = street; y < bh; y++) {
        const d = y - street, src = street - 1 - round(d * 1.7);
        if (src < 0) break;
        b.globalAlpha = 0.55 - (0.3 * d) / sh;
        b.drawImage(b.canvas, 0, src, bw, 1, round(sin(t * 2.3 + y * 1.3) * (0.6 + d * 0.12)), y, bw, 1);
      }
      b.globalAlpha = 1; b.fillStyle = wet; b.fillRect(0, street, bw, 1);
      for (const d of drops) {
        d.y += d.v * dt; d.x -= d.v * 0.12 * dt;
        if (d.y > d.end) {
          const s = splash[si = (si + 1) % splash.length]; s.x = d.x | 0; s.y = d.end | 0; s.life = 0;
          d.y -= bh + rand() * 10; d.x = rand() * (bw + 10);
        }
        if (d.x < 0) d.x += bw;
        b.fillStyle = rainC[d.z]; b.fillRect(d.x | 0, d.y | 0, 1, d.l);
      }
      b.fillStyle = splashC;
      for (const s of splash) if ((s.life += dt) < 0.12) { b.fillRect(s.x - 1, s.y - 1, 1, 1); b.fillRect(s.x + 1, s.y - 1, 1, 1); }
    },
    light(g, t, bw) {
      const o = (t * 2.2) | 0;
      for (const s of signs) {
        const x = wrapX(s.x - o, P), gw = s.w + 14, gh = s.h + 14;
        for (const dx of x + s.w > P ? [x, x - P] : [x]) {
          g.globalAlpha = 0.9 * s.on; g.drawImage(s.dot, dx - 7, s.y - 7, gw, gh);
          g.globalAlpha = 0.45 * s.on; g.drawImage(s.dot, dx - 5, street + (street - s.y - s.h) * 0.58 - 2, s.w + 10, s.h * 0.6 + 6);
        }
      }
    },
  };
});

// ---- 3. Kelp reef: swaying kelp, coral, little fish schools, light shafts, a glowing jelly -------
const reef = env(({ pal: [bg, kelp, coral, light], rand, seed }) => {
  const M = 8; // parallax margin each side
  const fishMap = c => ({ t: c, b: c, e: mix(c, BLACK, 0.7), s: mix(c, WHITE, 0.4) });
  const fishRows = [['t.bb.', '.bbbe', 't.bb.'], ['...bb...', 't.bsbbb.', 'tbbsbbeb', 't.bsbbb.', '...bb...']];
  const jelly = [['.jjj.', 'jJjJj', 'jjjjj', 't.t.t', '.t.t.', 't.t.t'], ['.jjj.', 'jJjJj', 'jjjjj', '.t.t.', 't.t.t', '.t.t.']];
  let water, shafts, far, near, kelpC, kelpG, stalks = [], schools = [], bubbles = [], jellies = [], fishS = [], jellyS = [], ripple, fy = 0, lastK = -1;
  const bubC = css(mix(light, WHITE, 0.4)), jDot = softDot(mix(light, coral, 0.3));
  return {
    glow: 0.7,
    layout(bw, bh) {
      const r = rng(seed), vs = vscale(bh), W = bw + 2 * M;
      fy = bh - round(9 * vs);
      water = pixels(surface(bw, bh));
      skyBands(water, 0, bh, [[0, mix(bg, light, 0.42)], [0.3, mix(bg, light, 0.12)], [0.75, bg], [1, mix(bg, BLACK, 0.4)]], 14);
      water = water.done();
      { // light shafts, dithered, leaning right
        const c = surface(W, bh), px = pixels(c);
        const beams = Array.from({ length: max(2, round(W / 34)) }, () => ({ x: r() * W, w: 3 + r() * 7 }));
        for (let y = 0; y < bh; y++) for (let x = 0; x < W; x++) {
          let v = 0;
          for (const be of beams) { const d = abs(x - (be.x + y * 0.3)); if (d < be.w) v = max(v, (1 - d / be.w) * (1 - y / bh) ** 1.4); }
          if (v * 0.8 > dith(x, y)) px.set(x, y, mix(light, WHITE, 0.3));
        }
        shafts = px.done();
      }
      { // far rocks
        const c = surface(W, bh), px = pixels(c), n = waves(r, W, [[W / 1.5, 1], [24, 0.5], [9, 0.25]]), col = mix(bg, light, 0.1);
        for (let x = 0; x < W; x++) { const top = round(fy - (8 + 10 * n(x) + (hash(floor(x / 18), 1, seed) > 0.6 ? 10 : 0)) * vs); for (let y = top; y < bh; y++) px.set(x, y, y === top ? mix(col, light, 0.2) : col); }
        far = px.done();
      }
      { // near: sand floor and coral
        const c = surface(W, bh), px = pixels(c), n = waves(r, W, [[W / 2, 1], [13, 0.3]]), sand = mix(coral, [230, 210, 160], 0.6);
        const sandAt = x => round(fy + 2 * n(x));
        for (let x = 0; x < W; x++) for (let y = sandAt(x); y < bh; y++) {
          const k = (y - sandAt(x)) / (bh - fy + 2);
          px.set(x, y, hash(x, y, seed) > 0.93 ? mix(sand, WHITE, 0.4) : mix(mix(sand, bg, 0.35), bg, k * 0.5 + (dith(x, y) > 0.5 ? 0.06 : 0)));
        }
        const corals = [coral, mix(coral, [255, 90, 160], 0.5), mix(coral, light, 0.5), mix(coral, kelp, 0.35)];
        for (let x = 2 + r() * 8; x < W - 3; x += 7 + r() * 16) {
          const col = corals[floor(r() * corals.length)], base = sandAt(round(x)), kind = r();
          if (kind < 0.4) { // branching fan
            const grow = (cx, cy, a, len, d) => {
              for (let i = 0; i < len; i++) px.set(cx + cos(a) * i, cy + sin(a) * i, d ? col : mix(col, BLACK, 0.2));
              if (d < 3) { const ex = cx + cos(a) * len, ey = cy + sin(a) * len; grow(ex, ey, a - 0.5, len * 0.7, d + 1); grow(ex, ey, a + 0.5, len * 0.7, d + 1); }
              else px.set(cx + cos(a) * len, cy + sin(a) * len, mix(col, WHITE, 0.4));
            };
            grow(x, base, -PI / 2, (3 + r() * 3) * vs, 0);
          } else if (kind < 0.75) { // brain dome
            const rr = round((2 + r() * 2) * vs);
            disc(px, round(x), base, rr, (dx, dy) => (dy > 0 ? null : (dx + dy) % 2 ? col : mix(col, WHITE, 0.25)));
          } else for (let i = 0; i < 3; i++) for (let y = 0; y < (3 + r() * 5) * vs; y++) px.set(x + i * 2, base - y, y < 1 ? mix(col, WHITE, 0.5) : col); // tubes
        }
        near = px.done();
      }
      ripple = (() => { // surface glints
        const P = max(bw, 64), c = surface(P, 3), px = pixels(c, true), n = waves(r, P, [[11, 1], [5, 0.5]]);
        for (let x = 0; x < P; x++) { const v = n(x); if (v > 0.2) px.set(x, v > 0.6 ? 0 : 1, mix(light, WHITE, 0.6)); else if (v < -0.5) px.set(x, 2, mix(light, WHITE, 0.2)); }
        return px.done();
      })();
      kelpC = surface(W, bh); kelpG = kelpC.getContext('2d'); lastK = -1;
      stalks = Array.from({ length: clamp(round(W / 12), 3, 22) }, (_, i) => {
        const z = r(), h = clamp((24 + r() * 50) * vs, 10, fy - 4);
        return { x: round((i + 0.2 + r() * 0.6) * (W / clamp(round(W / 12), 3, 22))), h, p: r() * TAU, z,
          stem: css(mix(mix(kelp, bg, 0.45 - z * 0.45), BLACK, 0.1)), leaf: css(mix(kelp, light, z * 0.25)) };
      });
      fishS = [coral, mix(coral, light, 0.6), mix(coral, [255, 230, 120], 0.5)].map(c => [0, 1].map(big => [false, true].map(fl => sprite(fishRows[big], fishMap(c), fl))));
      const jm = { j: mix(light, coral, 0.35), J: mix(light, WHITE, 0.6), t: mix(light, bg, 0.3) };
      jellyS = jelly.map(rows => sprite(rows, jm));
      schools = Array.from({ length: clamp(round((bw * bh) / 7000), 1, 4) }, (_, i) => ({
        x: rand() * bw, y: bh * (0.25 + rand() * 0.5), v: 5 + rand() * 7, dir: rand() < 0.5 ? -1 : 1, kind: i % 3, big: i === 2 ? 1 : 0,
        fish: Array.from({ length: i === 2 ? 2 : 4 + floor(rand() * 4) }, () => ({ dx: rand() * 22, dy: (rand() - 0.5) * 10, p: rand() * TAU })),
      }));
      bubbles = Array.from({ length: clamp(round((bw * bh) / 1400), 6, 40) }, () => ({ x: rand() * bw, y: rand() * bh, v: 7 + rand() * 9, p: rand() * TAU, big: rand() < 0.2 }));
      jellies = Array.from({ length: bw * bh > 9000 ? 2 : 1 }, () => ({ x: rand() * bw, y: rand() * bh, p: rand() * TAU, px: 0, py: 0 }));
    },
    frame(b, t, dt, bw, bh) {
      const cam = sin(t * 0.09) * M * 0.9;
      b.drawImage(water, 0, 0);
      b.globalCompositeOperation = 'lighter'; b.globalAlpha = 0.16 + 0.07 * sin(t * 0.5);
      b.drawImage(shafts, round(-M + sin(t * 0.13) * 4), 0);
      b.globalCompositeOperation = 'source-over'; b.globalAlpha = 0.8;
      scroll(b, ripple, t * 3); b.globalAlpha = 0.5; scroll(b, ripple, -t * 2.2 + 17, 1); b.globalAlpha = 1;
      b.drawImage(far, round(-M + cam * 0.3), 0);
      for (const j of jellies) {
        j.py = ((j.y - t * 2.5) % (bh + 12) + bh + 12) % (bh + 12) - 6; j.px = wrapX(j.x + sin(t * 0.3 + j.p) * 6 + cam * 0.5, bw);
        b.globalAlpha = 0.85; b.drawImage(jellyS[sin(t * 2 + j.p) > 0 ? 0 : 1], j.px | 0, j.py | 0);
      }
      b.globalAlpha = 1;
      const kf = floor(t * 10); // kelp re-plotted at 10 fps: authentic, and cheap
      if (kf !== lastK) {
        lastK = kf;
        kelpG.clearRect(0, 0, kelpC.width, kelpC.height);
        const tk = kf / 10;
        for (const s of stalks) for (let i = 0; i < s.h; i++) {
          const y = fy + 1 - i, k = i / s.h, x = round(s.x + sin(tk * 0.9 + s.p - i * 0.09) * k * k * 6 + sin(tk * 2.1 + i * 0.3) * k * 0.8);
          kelpG.fillStyle = s.stem; kelpG.fillRect(x, y, 1, 1);
          if (i % 4 === 1 && i > 2) { kelpG.fillStyle = s.leaf; kelpG.fillRect((i % 8 === 1) ? x + 1 : x - 2, y, 2, 1); }
        }
      }
      b.drawImage(kelpC, round(-M + cam * 0.7), 0);
      for (const s of schools) {
        const span = bw + 50, hx = ((s.x + t * s.v * s.dir) % span + span) % span - 25;
        for (const f of s.fish) {
          const x = s.dir > 0 ? hx - f.dx : hx + f.dx, y = s.y + f.dy + sin(t * 1.2 + f.p) * 2;
          b.drawImage(fishS[s.kind][s.big][s.dir > 0 ? 0 : 1], (x + cam * 0.85) | 0, y | 0);
        }
      }
      b.fillStyle = bubC;
      for (const u of bubbles) {
        const y = ((u.y - t * u.v) % fy + fy) % fy, x = wrapX(u.x + sin(t * 2 + u.p + y * 0.2) * 1.2, bw);
        if (u.big) { b.fillRect(x - 1, y | 0, 1, 1); b.fillRect(x + 1, y | 0, 1, 1); b.fillRect(x, (y | 0) - 1, 1, 1); b.fillRect(x, (y | 0) + 1, 1, 1); }
        else b.fillRect(x | 0, y | 0, 1, 1);
      }
      b.drawImage(near, round(-M + cam), 0);
    },
    light(g, t) {
      for (const j of jellies) { g.globalAlpha = 0.6 + 0.25 * sin(t * 2 + j.p); g.drawImage(jDot, j.px - 6, j.py - 6, 17, 17); }
    },
  };
});

// ---- 4. Snowy village: peaks, pines, warm windows, chimney smoke and three depths of snow ---------
const village = env(({ pal: [bg, snow, win, blue], rand, seed }) => {
  const flake = [css(mix(snow, bg, 0.55)), css(mix(snow, bg, 0.2)), css(snow)], smokeC = css(mix(snow, bg, 0.45)), twinkle = css(mix(snow, WHITE, 0.6));
  const winDot = softDot(win), winG = css(mix(win, [255, 120, 40], 0.3));
  let sky, clouds, land, flakes = [], chimneys = [], windows = [], stars = [], gy = 0, vs = 1;
  return {
    glow: 0.9,
    layout(bw, bh) {
      const r = rng(seed);
      vs = vscale(bh); gy = bh - round(12 * vs);
      const s = pixels(sky = surface(bw, bh));
      skyBands(s, 0, bh, [[0, mix(bg, BLACK, 0.45)], [0.55, bg], [0.85, mix(bg, blue, 0.45)], [1, mix(bg, blue, 0.6)]], 12);
      stars = [];
      for (let i = 0; i < (bw * bh) / 140; i++) { const x = r() * bw, y = r() * bh * 0.55; s.set(x, y, mix(snow, bg, r() * 0.5)); if (stars.length < 24 && r() < 0.15) stars.push({ x: floor(x), y: floor(y), p: r() * TAU, f: 1 + r() * 2 }); }
      const mx = round(bw * 0.2), my = round(min(bh * 0.17, 24 * vs)), mr = round(clamp(min(bw, bh) * 0.06, 3, 8));
      halo(s, mx, my, mr, mr * 2.6, mix(bg, snow, 0.25), 0.55);
      disc(s, mx, my, mr, (x, y) => ((x + mr * 0.5) ** 2 + (y - 1) ** 2 < mr * mr * 0.75 ? null : mix(snow, WHITE, 0.5)));
      sky = s.done();
      const P = max(bw, 96);
      { const c = surface(P, round(10 * vs)), px = pixels(c, true), n = waves(r, P, [[P / 2, 1], [19, 0.6]]);
        for (let y = 0; y < c.height; y++) for (let x = 0; x < P; x++) if (sin((PI * y) / c.height) * (n(x) - 0.1) * 1.4 > dith(x, y)) px.set(x, y, mix(bg, snow, 0.22));
        clouds = px.done(); }
      const L = pixels(land = surface(bw, bh));
      { // mountains with snowcaps, lit from the moon side
        const body = mix(bg, blue, 0.5), bodySh = mix(body, BLACK, 0.2), cap = mix(snow, blue, 0.15), capSh = mix(snow, blue, 0.5);
        for (const far of [true, false]) { // two ranges of peaks; faces toward the moon (left) are lit
          const np = max(2, round(bw / (far ? 26 : 38))), peaks = Array.from({ length: np + 1 }, (_, i) => ({ c: ((i + 0.2 + r() * 0.6) * bw) / np - 10, h: (far ? 22 + r() * 16 : 12 + r() * 14) * vs, w: (far ? 14 + r() * 14 : 18 + r() * 16) * vs }));
          const base = gy - (far ? 8 : 3) * vs, tint = far ? 0.25 : 0;
          for (let x = 0; x < bw; x++) {
            let best = 0, pk = null;
            for (const p of peaks) { const v = p.h * (1 - abs(x - p.c) / p.w); if (v > best) { best = v; pk = p; } }
            if (!pk) continue;
            const t0 = round(base - best + (hash(x, far ? 1 : 2, seed) > 0.7 ? 1 : 0)), litFace = x < pk.c;
            for (let y = t0; y < gy; y++) {
              const capped = y < base - pk.h * 0.62 + (hash(x >> 1, 3, seed) > 0.5 ? 1 : 0) + (hash(x >> 2, 4, seed) > 0.6 ? 2 : 0);
              L.set(x, y, mix(capped ? (litFace ? cap : capSh) : litFace ? body : bodySh, bg, tint));
            }
          }
        }
        const pn = waves(r, bw, [[bw / 2, 1], [17, 0.4]]), pc = mix(bg, BLACK, 0.2), pr = mix(pc, blue, 0.4);
        for (let x = 0; x < bw; x++) for (let y = round(gy - 5 * vs + 2 * pn(x)); y < gy; y++) L.set(x, y, pc);
        for (let x = r() * 4; x < bw; x += 3 + r() * 5) pine(L, x, round(gy - 4 * vs + 2 * pn(round(x))), (7 + r() * 9) * vs, pc, pr, mix(snow, blue, 0.3));
      }
      for (let y = gy; y < bh; y++) for (let x = 0; x < bw; x++) { // snowfield
        const k = (y - gy) / (bh - gy);
        L.set(x, y, hash(x, y, seed) > 0.97 ? WHITE : k + 0.25 * sin(x * 0.11 + y * 0.4) > 0.55 + dith(x, y) * 0.3 ? mix(snow, blue, 0.15) : mix(snow, blue, 0.35));
      }
      chimneys = []; windows = [];
      const wall = mix(mix(bg, [150, 90, 60], 0.55), BLACK, 0.15), wallD = mix(wall, BLACK, 0.35), roofS = mix(snow, blue, 0.1), roofE = mix(bg, BLACK, 0.4);
      const house = (x, base, w, hh, back) => {
        const wl = back ? mix(wall, bg, 0.45) : wall, rh = ceil(w / 2) + 1;
        L.rect(x, base - hh, w, hh, wl);
        for (let y = base - hh; y < base; y += 2) L.set(x + w - 1, y, wallD);
        for (let i = 0; i < rh; i++) { // stepped roof, snow on top
          const y = base - hh - 1 - i, l = x - 1 + i, rr = x + w - i;
          if (rr < l) break;
          for (let k = l; k <= rr; k++) L.set(k, y, i === rh - 1 || k <= l + 1 || k >= rr - 1 ? roofS : back ? mix(roofE, bg, 0.3) : roofE);
        }
        for (let k = x - 1; k <= x + w; k++) L.set(k, base - hh - 1, roofS);
        const cx = x + (r() < 0.5 ? 2 : w - 4), cyTop = base - hh - round(rh * 0.7) - 2;
        L.rect(cx, cyTop, 2, round(rh * 0.6) + 1, wallD); L.set(cx, cyTop - 1, roofS); L.set(cx + 1, cyTop - 1, roofS);
        chimneys.push({ x: cx + 1, y: cyTop - 1, p: r() });
        const nw = w > 13 ? 2 : 1, wy = base - hh + 2;
        for (let i = 0; i < nw; i++) {
          const wx = x + round(((i + 0.5) * w) / nw) - 1;
          L.rect(wx, wy, 2, 2, back ? mix(win, bg, 0.3) : win);
          if (!back) { L.set(wx - 1, wy + 2, roofS); L.set(wx + 2, wy + 2, roofS); }
          windows.push({ x: wx, y: wy, p: r() * TAU, back });
        }
        if (!back) { L.rect(x + round(w / 2) - 1, base - 3, 2, 3, wallD); L.set(x + round(w / 2), base - 2, mix(win, BLACK, 0.5)); }
      };
      for (let x = r() * 10; x < bw - 8; x += 12 + r() * 16) house(round(x), gy - round(2 * vs), 8 + floor(r() * 4), 4 + floor(r() * 2), true);
      for (let x = r() * 6 - 4; x < bw - 6; x += 18 + r() * 14) house(round(x), gy + round(3 * vs), 11 + floor(r() * 7), round((6 + r() * 3) * min(vs, 1.3)), false);
      land = L.done();
      flakes = Array.from({ length: clamp(round((bw * bh) / 110), 40, 320) }, () => ({ x: rand() * bw, y: rand() * bh, z: rand(), p: rand() * TAU }));
    },
    frame(b, t, dt, bw, bh) {
      b.drawImage(sky, 0, 0);
      b.fillStyle = twinkle;
      for (const s of stars) if (sin(t * s.f + s.p) > 0.6) b.fillRect(s.x, s.y, 1, 1);
      b.globalAlpha = 0.6; scroll(b, clouds, t * 0.8, round(bh * 0.12)); b.globalAlpha = 0.4; scroll(b, clouds, t * 1.5 + 40, round(bh * 0.3)); b.globalAlpha = 1;
      const wind = 3 + 2 * sin(t * 0.2);
      const snowLayer = (z0, z1) => {
        for (const f of flakes) {
          if (f.z < z0 || f.z >= z1) continue;
          const v = 4 + f.z * 12, y = ((f.y + t * v) % (bh + 2) + bh + 2) % (bh + 2) - 1;
          const x = wrapX(f.x + t * wind * (0.4 + f.z) + sin(t * 0.9 + f.p) * (1 + 2 * f.z), bw);
          b.fillStyle = flake[f.z < 0.45 ? 0 : f.z < 0.85 ? 1 : 2];
          b.fillRect(x | 0, y | 0, f.z > 0.93 ? 2 : 1, f.z > 0.93 ? 2 : 1);
        }
      };
      snowLayer(0, 0.45);
      b.drawImage(land, 0, 0);
      b.fillStyle = smokeC;
      for (const c of chimneys) for (let i = 0; i < 7; i++) {
        const a = fract(t / 6 + i / 7 + c.p), sz = 1 + floor(a * 3);
        b.globalAlpha = (1 - a) * 0.55;
        b.fillRect(round(c.x + a * a * 12 + sin(t * 0.8 + i) * a * 2 - sz / 2), round(c.y - a * 22 * vs), sz, sz);
      }
      b.globalAlpha = 1;
      b.fillStyle = winG;
      for (const w of windows) if (!w.back && sin(t * 3.1 + w.p) * sin(t * 1.3 + w.p * 2) > 0.55) b.fillRect(w.x, w.y + 1, 2, 1);
      snowLayer(0.45, 1.01);
    },
    light(g, t) {
      for (const w of windows) { g.globalAlpha = (w.back ? 0.4 : 0.8) + 0.15 * sin(t * 2.3 + w.p); g.drawImage(winDot, w.x - 5, w.y - 5, 12, 12); }
    },
  };
});

// ---- 5. Dune caravan: a striped sunset sun, heat shimmer, dunes rolling by and a camel caravan ----
const dunes = env(({ pal: [bg, sun, sand, haze], rand, seed }) => {
  const camel = [
    '....o.......', '...ooo....xx', '..xxoxx...xx', '.xxxxxxx.xx.', 'xxxxxxxxxx..', 'x.xxxxxxx...',
  ];
  const legsA = ['..x..x.x..x.', '..x..x.x..x.', '..x..x.x..x.'], legsB = ['..x..x.x..x.', '...xx...xx..', '...xx...xx..'];
  const dark = mix(mix(bg, haze, 0.3), BLACK, 0.35);
  let sky, mesas, layers, crest, camelS, birds = [], grains = [], hy = 0, P = 0, sunX = 0, sunY = 0, sunR = 0;
  const grainC = css(mix(sand, WHITE, 0.4), 0.6), birdC = css(dark), sunDot = softDot(mix(sun, sand, 0.4));
  return {
    glow: 0.6,
    layout(bw, bh) {
      const r = rng(seed), vs = vscale(bh);
      P = max(bw, 96);
      hy = bh - round(min(bh * 0.42, 34 * vs));
      const s = pixels(sky = surface(bw, bh));
      skyBands(s, 0, hy + 2, [[0, mix(bg, BLACK, 0.2)], [0.35, bg], [0.65, mix(bg, haze, 0.8)], [0.88, mix(haze, sun, 0.6)], [1, mix(sun, sand, 0.55)]], 14);
      s.rect(0, hy + 2, bw, bh - hy - 2, mix(sand, haze, 0.5));
      sunR = round(clamp(min(bw, bh) * 0.17, 6, 30)); sunX = round(bw * 0.62); sunY = hy - round(sunR * 0.3);
      halo(s, sunX, sunY, sunR, round(sunR * 1.9), mix(haze, sun, 0.7), 0.5);
      disc(s, sunX, sunY, sunR, (x, y) => {
        const k = (y + sunR) / (2 * sunR);
        if (y > -sunR * 0.1) { const band = (y + sunR * 0.1) / (sunR * 1.1); if (fract(band * 5) < band * 0.75) return null; }
        return mix(mix(sand, WHITE, 0.35), sun, k);
      });
      for (let i = 0; i < 5; i++) { // thin streak clouds
        const y = round(hy * (0.25 + r() * 0.55)), x0 = r() * bw, len = 10 + r() * 30;
        for (let k = 0; k < len; k++) s.set(wrapX(x0 + k, bw), y, mix(haze, sand, 0.45));
        for (let k = 3; k < len - 4; k++) s.set(wrapX(x0 + k + 2, bw), y + 1, mix(haze, bg, 0.2));
      }
      sky = s.done();
      { const c = surface(P, bh), px = pixels(c, true), col = mix(mix(haze, bg, 0.45), sun, 0.12);
        for (let x = r() * 20; x < P;) { // distant mesas with sloped flanks
          const w = 5 + floor(r() * 12), h = round((2 + r() * 5) * vs), slope = 1 + floor(r() * 3);
          if (r() < 0.5) for (let k = -h * slope; k < w + h * slope; k++) { const dy = k < 0 ? ceil(-k / slope) : k >= w ? ceil((k - w + 1) / slope) : 0; for (let y = hy - h + dy; y < hy + 2; y++) px.set(x + k, y, col); }
          x += w + 10 + floor(r() * 30);
        }
          mesas = px.done(); }
      crest = [];
      layers = [[0.12, 7, mix(sand, haze, 0.5)], [0.5, 10, mix(sand, haze, 0.22)], [0.86, 13, mix(sand, sun, 0.22)]].map(([d, amp, col], i) => {
        const c = surface(P, bh), px = pixels(c, true), n = waves(r, P, [[P / (1 + i), 1], [P / (2.5 + i), 0.5], [31, 0.12]]);
        const base = hy + 2 + (bh - hy) * d, top = new Int16Array(P), shadow = mix(col, mix(haze, bg, 0.5), 0.5), lit = mix(col, WHITE, 0.3);
        // dune crests: broad troughs, sharp leeward peaks
        const fy = Float32Array.from({ length: P }, (_, x) => base - amp * vs * (0.5 + 0.5 * n(x)) ** 1.7);
        for (let x = 0; x < P; x++) top[x] = round(fy[x]);
        for (let x = 0; x < P; x++) {
          const sl = fy[(x + 2) % P] - fy[(x - 2 + P) % P], litSide = sl > -0.5, c0 = litSide ? col : shadow;
          for (let y = top[x]; y < bh; y++) {
            const k = (y - top[x]) / (bh - top[x] + 1), q = min(2, floor(k * 3 + (dith(x, y) - 0.5) * 0.8));
            let cc = y === top[x] ? (litSide ? lit : mix(shadow, col, 0.4)) : mix(c0, mix(shadow, BLACK, 0.15), max(0, q) * 0.3);
            if (i === 2 && sin(x * 0.5 + y * 2.2 + sin(x * 0.07) * 3) > 0.92) cc = mix(cc, shadow, 0.5); // wind ripples
            px.set(x, y, cc);
          }
        }
        crest.push(top);
        return px.done();
      });
      const cm = { x: dark, o: mix(dark, haze, 0.25) };
      camelS = [legsA, legsB].map(legs => sprite([...camel, ...legs], cm));
      birds = Array.from({ length: 3 }, (_, i) => ({ x: rand() * bw, y: hy * (0.2 + rand() * 0.4), v: 3 + rand() * 3, p: rand() * TAU, i }));
      grains = Array.from({ length: clamp(round(bw / 8), 6, 30) }, () => ({ x: rand() * bw, y: hy + rand() * (bh - hy), v: 18 + rand() * 20 }));
    },
    frame(b, t, dt, bw, bh) {
      b.drawImage(sky, 0, 0);
      scroll(b, mesas, t * 0.4);
      for (let y = max(0, hy - 7); y < hy + 2; y++) { // heat shimmer just above the horizon
        const off = round(sin(t * 5 + y * 1.9) * sin(t * 1.3 + y) * 1.2);
        if (off) b.drawImage(b.canvas, 0, y, bw, 1, off, y, bw, 1);
      }
      b.fillStyle = birdC;
      for (const bd of birds) {
        const x = wrapX(bd.x + t * bd.v, bw + 20) - 10, y = round(bd.y + sin(t * 0.7 + bd.p) * 2), up = sin(t * 6 + bd.p) > 0;
        b.fillRect(x | 0, y, 1, 1); b.fillRect((x | 0) - 1, y - (up ? 1 : 0), 1, 1); b.fillRect((x | 0) + 1, y - (up ? 1 : 0), 1, 1);
      }
      const sp = [1.2, 2.6, 5];
      scroll(b, layers[0], t * sp[0]);
      scroll(b, layers[1], t * sp[1]);
      const o = (t * sp[1]) | 0, span = bw + 70, lead = ((t * 2.2 + bw * 0.45) % span) - 20;
      for (let i = 0; i < 4; i++) { // the caravan walks along the middle dune's crest
        const x = round(lead - i * 15);
        if (x < -14 || x > bw + 2) continue;
        const y = crest[1][wrapX(x + 6 + o, P)] - camelS[0].height + 1;
        b.drawImage(camelS[(floor(t * 3) + i) & 1], x, y);
      }
      scroll(b, layers[2], t * sp[2]);
      b.fillStyle = grainC;
      for (const g of grains) b.fillRect(wrapX(g.x - t * g.v, bw) | 0, g.y | 0, 2, 1);
    },
    light(g, t) {
      g.globalAlpha = 0.5 + 0.08 * sin(t * 0.5);
      g.drawImage(sunDot, sunX - sunR * 3, sunY - sunR * 3, sunR * 6, sunR * 6);
    },
  };
});

// ---- 6. Star window: a starship viewport, stars streaming past at three speeds, planets drifting --
const starWindow = env(({ pal: [bg, neb, lamp, alert], rand, seed }) => {
  const hull = mix([62, 68, 92], neb, 0.18), hullHi = mix(hull, WHITE, 0.28), hullLo = mix(hull, BLACK, 0.45);
  const starC = [css(mix(bg, WHITE, 0.4)), css(mix(bg, WHITE, 0.75)), css(WHITE)];
  const lampC = [css(lamp), css(alert), css(mix(lamp, WHITE, 0.5))], lampD = [softDot(lamp), softDot(alert), softDot(mix(lamp, WHITE, 0.5))];
  let space, nebula, frameC, planets = [], stars = [], lamps = [], scan = null, view = null, cycle = 1;
  const planetSprite = (R, c1, c2, ring, r) => {
    const pad = ring ? round(R * 0.8) : 0, c = surface(2 * (R + pad) + 1, 2 * R + 1), px = pixels(c), cx = R + pad, cy = R;
    const ringDraw = front => { if (!ring) return; for (let a = 0; a < TAU; a += 0.01) { const x = cos(a) * (R + pad - 1), y = sin(a) * (R * 0.28); if ((y > 0) === front) px.set(cx + x, cy + y - x * 0.12, mix(c2, WHITE, 0.3)); } };
    ringDraw(false);
    const bands = waves(r, 64, [[16, 1], [8, 0.6], [5, 0.3]]);
    disc(px, cx, cy, R, (x, y) => {
      const lightK = (-x * 0.75 - y * 0.45) / R + 0.35, band = bands((y / R) * 16 + 32 + sin(x * 0.2) * 0.6);
      let col = mix(c1, c2, 0.5 + 0.5 * band);
      if (lightK < -0.35 + dith(x, y) * 0.3) col = mix(col, bg, 0.75); else if (lightK < 0.05 + dith(x, y) * 0.2) col = mix(col, bg, 0.4);
      else if (lightK > 0.85) col = mix(col, WHITE, 0.25);
      return col;
    });
    ringDraw(true);
    return px.done();
  };
  return {
    glow: 0.8,
    layout(bw, bh) {
      const r = rng(seed), vs = vscale(bh), hT = max(4, round(bh * 0.09)), hB = max(7, round(bh * 0.17));
      view = { x0: 0, y0: hT, x1: bw, y1: bh - hB };
      const s = pixels(space = surface(bw, bh));
      skyBands(s, 0, bh, [[0, mix(bg, neb, 0.1)], [0.5, bg], [1, mix(bg, alert, 0.08)]], 8);
      for (let i = 0; i < (bw * bh) / 60; i++) s.set(r() * bw, r() * bh, mix(bg, WHITE, 0.15 + r() * 0.3));
      space = s.done();
      const P = max(bw, 128), nc = surface(P, bh), np = pixels(nc, true), n1 = waves(r, P, [[P / 1.5, 1], [P / 3, 0.5]]), n2 = waves(r, P, [[P, 1], [P / 2, 0.4]]);
      const mid = (hT + bh - hB) / 2, spread = (bh - hT - hB) * 0.3;
      for (let y = 0; y < bh; y++) for (let x = 0; x < P; x++) { // a soft band of nebula, two dithered levels
        const dy = (y - mid - spread * 0.8 * n2(x)) / spread, v = Math.exp(-dy * dy * 1.6) * (0.45 + 0.55 * (0.5 + 0.5 * n1(x)));
        if (v * 0.7 > dith(x, y)) np.set(x, y, v > 0.62 ? mix(mix(bg, neb, 0.42), alert, 0.25 * (v - 0.62) / 0.38) : mix(bg, neb, 0.22));
      }
      nebula = np.done();
      const R = round(clamp(min(bw, view.y1 - view.y0) * 0.24, 8, 38));
      planets = [planetSprite(R, neb, mix(neb, alert, 0.6), false, r), planetSprite(round(R * 0.7), alert, mix(alert, lamp, 0.4), true, r), planetSprite(max(4, round(R * 0.35)), mix(neb, WHITE, 0.4), mix(neb, bg, 0.3), false, r)];
      const vh = view.y1 - view.y0;
      cycle = 0; // planet timeline: each crosses in turn with a pause between
      planets = planets.map(c => { const v = 2.2 + r() * 1.6, start = cycle; cycle += (bw + c.width) / v + 5 + r() * 6; return { c, v, start, y: view.y0 + r() * max(1, vh - c.height) }; });
      stars = Array.from({ length: clamp(round((bw * vh) / 70), 20, 260) }, () => { const z = rand(); return { x: rand() * bw, y: view.y0 + rand() * vh, z, v: z < 0.55 ? 4 : z < 0.88 ? 11 : 28 }; });
      const F = pixels(frameC = surface(bw, bh));
      const panel = (x0, y0, x1, y1, seamEvery) => {
        for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) F.set(x, y, y === y0 ? hullHi : y === y1 - 1 ? hullLo : hash(x >> 3, y >> 2, seed) > 0.9 ? mix(hull, BLACK, 0.12) : hull);
        for (let x = x0 + seamEvery; x < x1; x += seamEvery) for (let y = y0 + 1; y < y1 - 1; y++) { F.set(x, y, hullLo); F.set(x + 1, y, mix(hull, WHITE, 0.12)); }
        for (let x = x0 + 3; x < x1; x += seamEvery) { F.set(x, y0 + 2, hullHi); F.set(x, y1 - 3, hullHi); }
      };
      panel(0, 0, bw, hT, 22); panel(0, view.y1, bw, bh, 26);
      for (let x = 0; x < bw; x++) { F.set(x, hT, hullLo); F.set(x, view.y1 - 1, mix(hullLo, BLACK, 0.4)); }
      const nPanes = max(1, round(bw / (62 * min(vs, 1.2)))), sw = max(3, round(3.5 * vs));
      for (let i = 1; i < nPanes; i++) { // struts with a flared foot
        const cx = round((i * bw) / nPanes);
        for (let y = hT; y < view.y1; y++) {
          const flare = max(0, 3 - min(y - hT, view.y1 - 1 - y));
          for (let k = -floor(sw / 2) - flare; k <= floor(sw / 2) + flare; k++) F.set(cx + k, y, k === -floor(sw / 2) - flare ? hullHi : k >= floor(sw / 2) ? hullLo : hull);
          if ((y - hT) % 9 === 4) F.set(cx, y, hullHi);
        }
      }
      if (bh > bw * 1.4) { const cy = round((hT + view.y1) / 2); for (let x = 0; x < bw; x++) for (let k = -1; k <= 1; k++) F.set(x, cy + k, k < 0 ? hullHi : k > 0 ? hullLo : hull); }
      for (let i = 0; i < 2; i++) { // faint glass glare
        const x0 = bw * (0.15 + i * 0.45);
        for (let y = hT; y < view.y1; y++) for (let k = 0; k < 2 + i; k++) if (dith(y, k) < 0.5) F.set(x0 + k + (y - hT) * 0.5, y, WHITE, 18);
      }
      lamps = []; // console: screens and blinking buttons
      const cy0 = view.y1 + 2, ch = bh - cy0 - 1;
      for (let x = 4; x < bw - 6; x += 14 + floor(r() * 10)) {
        if (r() < 0.4 && ch >= 5) {
          const w = 8 + floor(r() * 6), h = min(ch - 2, 4 + floor(r() * 3));
          F.rect(x, cy0 + 1, w, h, mix(bg, lamp, 0.12));
          for (let k = 0; k < w; k++) F.set(x + k, cy0 + 1 + round(h / 2 + sin(k * 0.9 + x) * (h / 3)), mix(lamp, bg, 0.3));
          if (!scan) scan = { x, y: cy0 + 1, w, h };
          x += w;
        } else for (let k = 0; k < 3; k++) lamps.push({ x: x + k * 3, y: cy0 + 2 + (k % 2) * 2, c: floor(r() * 3), f: 0.5 + r() * 2, p: r() * TAU });
      }
      frameC = F.done();
    },
    frame(b, t, dt, bw, bh) {
      b.drawImage(space, 0, 0);
      scroll(b, nebula, t * 0.6);
      for (const s of stars) {
        const x = wrapX(s.x - t * s.v, bw);
        b.fillStyle = starC[s.v > 20 ? 2 : s.v > 5 ? 1 : 0];
        b.fillRect(x | 0, s.y | 0, s.v > 20 ? 3 : 1, 1);
      }
      const tc = (t + (bw * 0.45) / planets[0].v) % cycle; // the first planet is already in view at t = 0
      for (const p of planets) {
        const x = bw - (tc - p.start) * p.v;
        if (x > -p.c.width && x < bw) b.drawImage(p.c, x | 0, p.y | 0);
      }
      b.drawImage(frameC, 0, 0);
      for (const l of lamps) { b.fillStyle = sin(t * l.f + l.p) > -0.2 ? lampC[l.c] : css(hullLo); b.fillRect(l.x, l.y, 2, 1); }
      if (scan) { b.fillStyle = lampC[2]; b.fillRect(scan.x + (floor(t * 8) % scan.w), scan.y, 1, scan.h); }
    },
    light(g, t) {
      g.globalAlpha = 0.7;
      for (const l of lamps) if (sin(t * l.f + l.p) > -0.2) g.drawImage(lampD[l.c], l.x - 4, l.y - 4, 10, 9);
      if (scan) { g.globalAlpha = 0.45; g.drawImage(lampD[0], scan.x - 4, scan.y - 4, scan.w + 8, scan.h + 8); }
    },
  };
});

// ---- 7. Lantern lane: an old town street at night, paper lanterns swaying, petals on the wind -----
const lanternLane = env(({ pal: [bg, lantern, glowC, petal], rand, seed }) => {
  const lantS = [['..k..', '.kkk.', 'rLLLr', 'rLYLr', 'rLYLr', 'rLLLr', '.kkk.', '..t..'], ['.k.', 'rLr', 'rYr', '.r.']];
  const petalC = [css(petal), css(mix(petal, WHITE, 0.5)), css(mix(petal, bg, 0.35))];
  let sky, far, cloud, street, lanterns = [], strung = [], sprites, petals = [], P = 0, sy = 0;
  const lDot = softDot(mix(glowC, lantern, 0.45));
  return {
    glow: 1,
    layout(bw, bh) {
      const r = rng(seed), vs = vscale(bh);
      P = max(bw, 110); sy = bh - round(7 * vs);
      const s = pixels(sky = surface(bw, bh));
      skyBands(s, 0, bh, [[0, mix(bg, BLACK, 0.45)], [0.6, bg], [0.9, mix(bg, lantern, 0.22)], [1, mix(bg, glowC, 0.25)]], 12);
      for (let i = 0; i < (bw * bh) / 200; i++) s.set(r() * bw, r() * bh * 0.5, mix(bg, WHITE, 0.3 + r() * 0.4));
      const mx = round(bw * 0.28), my = round(min(bh * 0.2, 26 * vs)), mr = round(clamp(min(bw, bh) * 0.1, 4, 14));
      halo(s, mx, my, mr, mr * 2.4, mix(bg, glowC, 0.25), 0.6);
      disc(s, mx, my, mr, (x, y) => (hash(floor((x + 20) / 2), floor((y + 20) / 2), seed) > 0.8 ? mix(glowC, WHITE, 0.45) : mix(glowC, WHITE, 0.72)));
      sky = s.done();
      { const c = surface(P, round(6 * vs)), px = pixels(c, true), n = waves(r, P, [[P / 2, 1], [13, 0.5]]);
        for (let y = 0; y < c.height; y++) for (let x = 0; x < P; x++) if (sin((PI * y) / c.height) * n(x) > dith(x, y) * 0.8) px.set(x, y, mix(bg, glowC, 0.2));
        cloud = px.done(); }
      { // far: hills, a pagoda and treetops
        const c = surface(P, bh), px = pixels(c, true), n = waves(r, P, [[P / 1.3, 1], [27, 0.4]]), col = mix(bg, petal, 0.1), base = sy - round(26 * vs);
        for (let x = 0; x < P; x++) for (let y = round(base - 6 * vs * n(x)); y < bh; y++) px.set(x, y, col);
        const pg = round(P * (0.55 + r() * 0.3)), tiers = 4 + (vs > 1.1 ? 1 : 0), th = round(4 * vs);
        let y = round(base - 6 * vs * n(pg)) + 1;
        for (let i = 0; i < tiers; i++) {
          const w = round((11 - i * 1.6) * vs);
          px.rect(pg - floor(w / 2) + 2, y - th, w - 4, th, col);
          for (let k = -floor(w / 2) - 1; k <= floor(w / 2) + 1; k++) px.set(pg + k, y - th, col);
          px.set(pg - floor(w / 2) - 2, y - th - 1, col); px.set(pg + floor(w / 2) + 2, y - th - 1, col);
          px.set(pg, y - 2, mix(col, glowC, 0.5));
          y -= th + 1;
        }
        for (let k = 0; k < 5 * vs; k++) px.set(pg, y - k, col);
        for (let x = r() * 9; x < P; x += 5 + r() * 9) if (abs(x - pg) > 10 * vs) disc(px, round(x), round(base - 6 * vs * n(round(x) % P)), round((2 + r() * 3) * vs), () => col);
        far = px.done();
      }
      { // the street: wooden two-storey houses
        const c = surface(P, bh), px = pixels(c, true);
        const wood = mix(mix(bg, [120, 60, 40], 0.5), BLACK, 0.25), woodD = mix(wood, BLACK, 0.4), roof = mix(bg, BLACK, 0.5), roofHi = mix(roof, glowC, 0.15);
        const shoji = mix(glowC, WHITE, 0.15), lattice = mix(wood, glowC, 0.25);
        lanterns = []; strung = [];
        const fh = round(12 * vs), uh = round(9 * vs);
        for (let x = 0; x < P;) {
          const w = min(P - x, 18 + floor(r() * 12));
          if (w < 10) { px.rect(x, sy - fh, w, fh, woodD); break; }
          const top = sy - fh - uh - 3;
          px.rect(x, sy - fh, w, fh, wood);
          px.rect(x + 1, top + 3, w - 2, uh, mix(wood, BLACK, 0.1));
          for (let k = -2; k < w + 2; k++) { px.set(x + k, sy - fh - 1, roof); px.set(x + k, sy - fh - 2, (k & 1) ? roof : roofHi); px.set(x + k, sy - fh, woodD); }
          for (let i = 0; i < 3; i++) for (let k = i - 2; k < w + 2 - i; k++) px.set(x + k, top + 2 - i, i === 2 ? roofHi : (k + i) & 1 ? roof : roofHi);
          const ww = w - 8, wy = top + 4, wh = max(3, uh - 3); // shoji window upstairs
          for (let j = 0; j < wh; j++) for (let k = 0; k < ww; k++) px.set(x + 4 + k, wy + j, k % 3 === 0 || j % 3 === 0 ? lattice : shoji);
          const nx = x + 3, nw = w - 6, nh = round(fh * 0.45), noren = r() < 0.5 ? mix(lantern, BLACK, 0.25) : mix([40, 60, 120], bg, 0.3);
          for (let j = 0; j < fh - 1; j++) for (let k = 0; k < nw; k++) px.set(nx + k, sy - fh + 1 + j, j < nh ? (k % 4 === 3 ? woodD : noren) : k % 5 === 0 ? lattice : mix(shoji, wood, 0.25));
          for (let y = sy - fh - uh - 1; y < sy; y++) { px.set(x, y, woodD); px.set(x + w - 1, y, woodD); }
          lanterns.push({ x: x + 1, y: sy - fh + 1, big: true, p: r() * TAU });
          if (r() < 0.6) lanterns.push({ x: x + w - 6, y: sy - fh + 1, big: true, p: r() * TAU });
          x += w;
        }
        for (let x = 0; x < P; x++) for (let y = sy; y < bh; y++) { // paving
          const k = (y - sy) / (bh - sy);
          px.set(x, y, (x + (y % 2) * 3) % 6 === 0 || (y - sy) % 3 === 2 ? mix(bg, BLACK, 0.35) : mix(mix(bg, glowC, 0.12 * (1 - k)), BLACK, 0.15));
        }
        const span = round(P / max(1, round(P / 46))), yTop = round(max(6, sy - fh - uh - 18 * vs)); // a string of lanterns across the top
        for (let x = 0; x < P; x++) { const u = (x % span) / span, y = yTop + round(sin(u * PI) * 6 * vs); px.set(x, y, woodD); if (x % 7 === 3) strung.push({ x, y: y + 1, p: r() * TAU }); }
        street = px.done();
      }
      const lm = { k: mix(bg, BLACK, 0.3), r: mix(lantern, BLACK, 0.3), L: lantern, Y: mix(glowC, WHITE, 0.3), t: mix(glowC, lantern, 0.5) };
      sprites = lantS.map(rows => sprite(rows, lm));
      petals = Array.from({ length: clamp(round((bw * bh) / 380), 12, 70) }, () => ({ x: rand() * bw, y: rand() * bh, z: rand(), p: rand() * TAU, c: floor(rand() * 3) }));
    },
    frame(b, t, dt, bw, bh) {
      b.drawImage(sky, 0, 0);
      b.globalAlpha = 0.75; scroll(b, cloud, t * 1.1, round(bh * 0.16)); b.globalAlpha = 1;
      scroll(b, far, t * 0.4);
      const o = (t * 1.2) | 0;
      scroll(b, street, o);
      const lan = (l, s) => {
        const x = wrapX(l.x - o + round(sin(t * 1.1 + l.p) * 0.7), P);
        b.drawImage(s, x, l.y); if (x + s.width > P) b.drawImage(s, x - P, l.y);
      };
      for (const l of lanterns) lan(l, sprites[0]);
      for (const l of strung) lan(l, sprites[1]);
      const wind = 7 + 4 * sin(t * 0.25);
      for (const p of petals) {
        const v = 5 + p.z * 9, y = ((p.y + t * v) % (bh + 4) + bh + 4) % (bh + 4) - 2, x = wrapX(p.x + t * wind * (0.5 + p.z) + sin(t * 1.3 + p.p) * 3, bw), flip = sin(t * 2.5 + p.p) > 0;
        b.fillStyle = petalC[p.z < 0.35 ? 2 : p.c & 1];
        if (p.z > 0.7) b.fillRect(x | 0, y | 0, flip ? 2 : 1, flip ? 1 : 2); else b.fillRect(x | 0, y | 0, 1, 1);
      }
    },
    light(g, t) {
      const o = (t * 1.2) | 0;
      const blob = (l, d, a) => { const x = wrapX(l.x - o, P); g.globalAlpha = a; g.drawImage(lDot, x + 2 - d / 2, l.y + 3 - d / 2, d, d); if (x > P - 8) g.drawImage(lDot, x - P + 2 - d / 2, l.y + 3 - d / 2, d, d); };
      for (const l of lanterns) blob(l, 14, 0.55 + 0.12 * sin(t * 3 + l.p));
      for (const l of strung) blob(l, 7, 0.4 + 0.15 * sin(t * 2.4 + l.p));
    },
  };
});

// ---- 8. Ember cavern: stalactites dripping lava, a slow lava river, rising embers and heat haze --
const cavern = env(({ pal: [bg, lava, hot, rock], rand, seed }) => {
  const M = 10;
  const emberC = [css(mix(hot, WHITE, 0.4)), css(hot), css(lava), css(mix(lava, bg, 0.5))];
  let wall, pillars, fg, lavaT, crust, edge, drips = [], embers = [], ly = 0, vs = 1;
  const lavaBand = softBand(lava), hotDot = softDot(hot), emberDot = softDot(mix(hot, lava, 0.4));
  return {
    glow: 0.85,
    layout(bw, bh) {
      const r = rng(seed), W = bw + 2 * M;
      drips = [];
      vs = vscale(bh); ly = bh - round(10 * vs);
      { const px = pixels(wall = surface(W, bh)), lit = mix(rock, lava, 0.35);
        for (let y = 0; y < bh; y++) for (let x = 0; x < W; x++) {
          const k = (y / bh) ** 2, n = sin(x * 0.21 + sin(y * 0.13) * 2) + sin(y * 0.33 + x * 0.05) + hash(x >> 2, y >> 2, seed);
          let c = mix(mix(bg, BLACK, 0.3), lit, k * 0.6 + (n > 1.4 ? 0.12 : 0) + (dith(x, y) - 0.5) * 0.1);
          if (abs(sin(x * 0.07 + sin(y * 0.09) * 3) - sin(y * 0.05)) < 0.012 && k > 0.2) c = mix(c, lava, 0.3 * k); // faint glowing veins low down
          px.set(x, y, c);
        }
        wall = px.done(); }
      { const px = pixels(pillars = surface(W, bh)), col = mix(bg, BLACK, 0.15), rim = mix(rock, lava, 0.55);
        for (let x = r() * 20; x < W; x += 22 + r() * 30) { // columns joining floor and ceiling
          const w0 = (4 + r() * 6) * vs, cx = x;
          for (let y = 0; y < ly + 2; y++) {
            const k = y / ly, w = round(w0 * (0.55 + 0.6 * (k - 0.5) ** 2 * 2) + sin(y * 0.4 + x) * 0.6);
            for (let i = -w; i <= w; i++) px.set(cx + i, y, i >= w - 1 && k > 0.4 ? mix(col, rim, k - 0.3) : col);
          }
        }
        pillars = px.done(); }
      { const px = pixels(fg = surface(W, bh)), col = mix(bg, BLACK, 0.55), tip = mix(rock, lava, 0.4);
        const ceil0 = waves(r, W, [[W / 2, 1], [9, 0.5]]);
        for (let x = 0; x < W; x++) { const h = round((4 + 3 * ceil0(x)) * vs); for (let y = 0; y < h; y++) px.set(x, y, col); }
        for (let x = r() * 6; x < W; x += 3 + r() * 8) { // stalactites
          const len = round((5 + r() * 16) * vs), w = 1 + floor(r() * 2.5);
          for (let y = 0; y < len; y++) { const hw = round(w * (1 - y / len)); for (let i = -hw; i <= hw; i++) px.set(x + i, y + 3 * vs, y > len - 2 ? tip : col); }
          if (len > 9 * vs && drips.length < max(2, round(W / 40))) drips.push({ x: round(x), y: round(len + 3 * vs), T: 3 + r() * 4, o: r() });
        }
        for (const side of [0, 1]) { // ledges at the bottom corners
          const lw = round(W * (0.12 + r() * 0.1)), lh = round((8 + r() * 6) * vs);
          for (let i = 0; i < lw; i++) {
            const x = side ? W - 1 - i : i, top = ly - round(lh * (1 - (i / lw) ** 2)) + round(sin(i * 0.8) * 0.8);
            for (let y = top; y < bh; y++) px.set(x, y, y === top ? mix(rock, lava, 0.6) : y < top + 2 ? mix(col, lava, 0.25) : col);
          }
        }
        fg = px.done(); }
      const P = max(bw, 96), lh = bh - ly + 1;
      { const px = pixels(lavaT = surface(P, lh), true), n1 = waves(r, P, [[P / 3, 1], [19, 0.7], [7, 0.3]]);
        const ramp = [mix(lava, BLACK, 0.45), mix(lava, BLACK, 0.15), lava, mix(lava, hot, 0.55), hot];
        for (let y = 0; y < lh; y++) for (let x = 0; x < P; x++) {
          const v = 0.5 + 0.5 * sin(n1(x) * 3 + y * 0.7 + sin(x * TAU * 4 / P) * 1.5) - (y / lh) * 0.35;
          px.set(x, y, ramp[clamp(floor(v * 4 + dith(x, y) * 0.9), 0, 4)]);
        }
        lavaT = px.done(); }
      { const px = pixels(crust = surface(P, lh), true), n = waves(r, P, [[P / 5, 1], [11, 0.6]]);
        for (let y = 0; y < lh; y++) for (let x = 0; x < P; x++) if (n(x + y * 3) > 0.45 + dith(x, y) * 0.2) px.set(x, y, mix(bg, lava, 0.25));
        crust = px.done(); }
      { const px = pixels(edge = surface(P, 3), true), n = waves(r, P, [[13, 1], [5, 0.4]]);
        for (let x = 0; x < P; x++) { const v = n(x); px.set(x, v > 0.3 ? 0 : 1, mix(hot, WHITE, 0.3)); if (v > 0.3) px.set(x, 1, hot); px.set(x, 2, hot); }
        edge = px.done(); }
      embers = Array.from({ length: clamp(round((bw * bh) / 320), 15, 90) }, () => ({ x: rand() * bw, h: (25 + rand() * 50) * vs, v: 6 + rand() * 12, p: rand() * TAU, s: rand() * 10, px: 0, py: 0, a: 0, c: 0 }));
    },
    frame(b, t, dt, bw, bh) {
      const cam = sin(t * 0.06) * M * 0.9;
      b.drawImage(wall, round(-M + cam * 0.25), 0);
      b.drawImage(pillars, round(-M + cam * 0.55), 0);
      scroll(b, lavaT, t * 4, ly);
      b.globalAlpha = 0.8; scroll(b, crust, t * 2.6, ly); b.globalAlpha = 1;
      scroll(b, edge, t * 4, ly - 1);
      for (let y = max(0, ly - 8); y < ly - 1; y++) { // heat haze above the river
        const off = round(sin(t * 4.2 + y * 1.7) * sin(t * 0.9 + y * 0.6) * 1.2);
        if (off) b.drawImage(b.canvas, 0, y, bw, 1, off, y, bw, 1);
      }
      for (const e of embers) {
        const a = fract((t * e.v) / e.h + e.s / 10), y = ly - a * e.h, x = wrapX(e.x + sin(t * 1.3 + e.p + a * 6) * 3 + a * 6, bw);
        e.px = x; e.py = y; e.a = 1 - a; e.c = a < 0.25 ? 0 : a < 0.5 ? 1 : a < 0.8 ? 2 : 3;
        if (sin(t * 9 + e.p) < -0.85) continue; // flicker
        b.fillStyle = emberC[e.c]; b.fillRect(x | 0, y | 0, 1, 1);
      }
      b.drawImage(fg, round(-M + cam), 0);
      for (const d of drips) { // a bead of lava swells on a stalactite tip, then falls
        const a = fract(t / d.T + d.o), x = round(d.x - M + cam);
        b.fillStyle = emberC[1];
        if (a < 0.75) { if (a > 0.3) b.fillRect(x, d.y, 1, 1); }
        else { const k = (a - 0.75) / 0.25; b.fillStyle = emberC[0]; b.fillRect(x, round(d.y + k * k * (ly - d.y)), 1, 2); }
      }
    },
    light(g, t, bw, bh) {
      g.globalAlpha = 0.6 + 0.12 * sin(t * 0.8) + 0.05 * sin(t * 2.3);
      g.drawImage(lavaBand, -3, ly - 22 * vs, bw + 6, bh - ly + 22 * vs + 3);
      const cam = sin(t * 0.06) * M * 0.9;
      for (const d of drips) {
        const a = fract(t / d.T + d.o), x = d.x - M + cam, y = a < 0.75 ? d.y : d.y + ((a - 0.75) / 0.25) ** 2 * (ly - d.y);
        g.globalAlpha = a < 0.3 ? 0.15 : 0.6; g.drawImage(hotDot, x - 4, y - 4, 9, 9);
      }
      for (const e of embers) if (e.c < 2) { g.globalAlpha = e.a * 0.8; g.drawImage(emberDot, e.px - 3, e.py - 3, 7, 7); }
    },
  };
});

export const ENV_SCENES = {
  'px-env-firefly-forest': forest,
  'px-env-neon-rain': neonCity,
  'px-env-kelp-reef': reef,
  'px-env-snow-village': village,
  'px-env-dune-caravan': dunes,
  'px-env-star-window': starWindow,
  'px-env-lantern-lane': lanternLane,
  'px-env-ember-cavern': cavern,
};
export const ENV_PALETTES = {
  'px-env-firefly-forest': ['#0d1b22', '#4f9a6a', '#ffe27a', '#8fd3c7'],
  'px-env-neon-rain': ['#120c2a', '#ff4fa3', '#3fe0ff', '#ffc966'],
  'px-env-kelp-reef': ['#06304a', '#3cbf8f', '#ff9f6b', '#a8f4ff'],
  'px-env-snow-village': ['#161c3c', '#e6eeff', '#ffb45c', '#6f80d6'],
  'px-env-dune-caravan': ['#2e1446', '#ff8a3d', '#ffd58a', '#d24f7e'],
  'px-env-star-window': ['#06071a', '#8a7dff', '#56f0c8', '#ff7a59'],
  'px-env-lantern-lane': ['#1d1236', '#ff5a4a', '#ffd9a0', '#ffb7d5'],
  'px-env-ember-cavern': ['#1c0c10', '#ff5a1f', '#ffd23f', '#6e3040'],
};
