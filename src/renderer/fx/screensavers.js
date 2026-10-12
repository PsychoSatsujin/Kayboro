// Shell-fill screensavers: canvas 2D scenes for the six fill ids. createScreensaver() sizes the
// canvas to its CSS box x devicePixelRatio, follows resizes, runs on the shared ticker (paused while
// the document is hidden) and draws a single still frame when the user prefers reduced motion.
import { onFrame, reducedMotion, onReducedMotionChange } from './ticker.js';

export const SCREENSAVER_IDS = ['starfield', 'bubbles', 'plasma', 'pixel-rain', 'sakura-petals', 'aurora'];
// Defaults match the fills catalogue; a 4th colour, when present, is an optional extra accent.
export const PALETTES = {
  starfield: ['#0b0a1a', '#ffffff', '#7af0ff', '#ff6ad5'],
  bubbles: ['#13324a', '#7af0ff', '#ffffff'],
  plasma: ['#ff6ad5', '#7af0ff', '#6e3bff'],
  'pixel-rain': ['#0f0d16', '#6ee7a8', '#7af0ff'],
  'sakura-petals': ['#2a1630', '#ffb7d5', '#ffe3ef'],
  aurora: ['#071522', '#6ee7a8', '#c58cff'],
};

const TAU = Math.PI * 2;
const { sin, cos, min, max, sqrt, round, ceil, floor, abs, exp, PI } = Math;
const clamp = (v, a, b) => min(b, max(a, v));
export const hexRgb = c => {
  let h = String(c).replace('#', '');
  if (h.length < 6) h = [...h].map(x => x + x).join('');
  return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16) || 0);
};
const mix = (a, b, t) => a.map((v, i) => round(v + (b[i] - v) * t));
const rgba = (c, a = 1) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
const WHITE = [255, 255, 255], BLACK = [0, 0, 0];
const rng = seed => () => { // mulberry32
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
const vgrad = (g, h, stops) => { const lg = g.createLinearGradient(0, 0, 0, h); stops.forEach(([o, c]) => lg.addColorStop(o, c)); return lg; };
const glowSprite = (col, size = 64) => {
  const c = surface(size, size), g = c.getContext('2d'), r = size / 2, rg = g.createRadialGradient(r, r, 0, r, r, r);
  rg.addColorStop(0, rgba(col, 1)); rg.addColorStop(0.2, rgba(col, 0.45)); rg.addColorStop(1, rgba(col, 0));
  g.fillStyle = rg; g.fillRect(0, 0, size, size);
  return c;
};
// 256-entry colour ramp (ABGR words for ImageData) through evenly spaced stops, smoothstepped.
const ramp = (stops, cyclic = false) => {
  const out = new Uint32Array(256), n = cyclic ? stops.length : stops.length - 1;
  for (let i = 0; i < 256; i++) {
    const p = (i / (cyclic ? 256 : 255)) * n, k = min(floor(p), n - 1), f = p - k, s = f * f * (3 - 2 * f);
    const a = stops[k], b = stops[(k + 1) % stops.length], c = mix(a, b, s);
    out[i] = (255 << 24) | (c[2] << 16) | (c[1] << 8) | c[0];
  }
  return out;
};

// Particles survive resizes (a screen being dragged bigger): positions scale, the count follows the area.
const keep = (list, n, make, sx, sy) => {
  for (const p of list) { p.x *= sx; p.y *= sy; }
  list.length = min(list.length, n);
  while (list.length < n) list.push(make());
  return list;
};

// ---- Scenes: ({ pal, rand }) -> { resize(w, h, k), draw(ctx, t, dt, w, h) } in CSS px ----------

function starfield({ pal: [bg, star, acc, acc2], rand }) {
  let stars = [], back = null, shoot = null, nextShoot = 4, ow = 0, oh = 0;
  const glow = glowSprite(star), glowAcc = glowSprite(acc);
  const flare = (() => {
    const c = surface(64, 64), g = c.getContext('2d');
    for (const [w, h] of [[64, 3], [3, 64]]) {
      const lg = w > h ? g.createLinearGradient(0, 0, 64, 0) : g.createLinearGradient(0, 0, 0, 64);
      lg.addColorStop(0, rgba(star, 0)); lg.addColorStop(0.5, rgba(star, 0.9)); lg.addColorStop(1, rgba(star, 0));
      g.fillStyle = lg; g.fillRect((64 - w) / 2, (64 - h) / 2, w, h);
    }
    return c;
  })();
  return {
    resize(w, h, k) {
      back = surface(w * k, h * k);
      const g = back.getContext('2d'), r2 = rng(5); // fixed seed: the backdrop stays put across resizes
      g.scale(k, k);
      g.fillStyle = vgrad(g, h, [[0, rgba(mix(bg, BLACK, 0.4))], [0.55, rgba(bg)], [1, rgba(mix(bg, acc, 0.12))]]);
      g.fillRect(0, 0, w, h);
      g.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 4; i++) { // nebulae: wide soft clouds of the two accents
        const x = w * (0.15 + r2() * 0.7), y = h * (0.15 + r2() * 0.7), r = max(w, h) * (0.25 + r2() * 0.3);
        const rg = g.createRadialGradient(x, y, 0, x, y, r), c = i % 2 ? acc : acc2;
        rg.addColorStop(0, rgba(mix(c, bg, 0.3), 0.2)); rg.addColorStop(0.5, rgba(mix(c, bg, 0.55), 0.07)); rg.addColorStop(1, rgba(c, 0));
        g.fillStyle = rg; g.fillRect(0, 0, w, h);
      }
      g.fillStyle = rgba(star, 0.35);
      for (let i = 0, n = (w * h) / 500; i < n; i++) g.fillRect(r2() * w, r2() * h, 0.6, 0.6); // static dust
      stars = keep(stars, clamp(round((w * h) / 1500), 60, 600), () => {
        const z = rand() ** 2;
        return { x: rand() * w, y: rand() * h, z, r: 0.45 + z * 1.4, f: 0.6 + rand() * 2.2, p: rand() * TAU, acc: rand() < 0.16 };
      }, ow ? w / ow : 1, oh ? h / oh : 1);
      ow = w; oh = h;
    },
    draw(c, t, dt, w, h) {
      c.drawImage(back, 0, 0, w, h);
      c.globalCompositeOperation = 'lighter';
      for (const s of stars) {
        s.x -= (3 + 9 * s.z) * dt; s.y += (1 + 3 * s.z) * dt;
        if (s.x < -4) s.x += w + 8; if (s.y > h + 4) s.y -= h + 8;
        const tw = 0.6 + 0.4 * sin(t * s.f + s.p);
        if (s.z > 0.55) {
          const g = s.r * 7;
          c.globalAlpha = tw * 0.5 * s.z;
          c.drawImage(s.acc ? glowAcc : glow, s.x - g, s.y - g, g * 2, g * 2);
          if (s.z > 0.86) { c.globalAlpha = tw * 0.55; c.drawImage(flare, s.x - g * 1.4, s.y - g * 1.4, g * 2.8, g * 2.8); }
        }
        c.globalAlpha = clamp(tw * (0.5 + s.z), 0, 1);
        c.fillStyle = s.acc ? rgba(mix(acc, WHITE, 0.4)) : rgba(star);
        c.fillRect(s.x - s.r, s.y - s.r, s.r * 2, s.r * 2);
      }
      if ((nextShoot -= dt) < 0) {
        nextShoot = 5 + rand() * 7;
        const a = PI * (0.12 + rand() * 0.12);
        shoot = { x: w * (0.3 + rand() * 0.7), y: h * rand() * 0.4, vx: -cos(a) * 700, vy: sin(a) * 700, life: 0 };
      }
      if (shoot && (shoot.life += dt) < 0.7) {
        const s = shoot, x = s.x + s.vx * s.life, y = s.y + s.vy * s.life, k = 0.16, fade = sin((s.life / 0.7) * PI);
        const lg = c.createLinearGradient(x, y, x - s.vx * k, y - s.vy * k);
        lg.addColorStop(0, rgba(WHITE, 0.95 * fade)); lg.addColorStop(0.3, rgba(acc, 0.4 * fade)); lg.addColorStop(1, rgba(acc, 0));
        c.globalAlpha = 1; c.strokeStyle = lg; c.lineWidth = 1.6; c.lineCap = 'round';
        c.beginPath(); c.moveTo(x, y); c.lineTo(x - s.vx * k, y - s.vy * k); c.stroke();
      }
      c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
    },
  };
}

function bubbles({ pal: [bg, acc, hi], rand }) {
  let list = [], motes = [], back = null, k = 1, ow = 0, oh = 0;
  const shaft = surface(64, 256), sg = shaft.getContext('2d'); // soft-edged light shaft, fading downward
  const hg = sg.createLinearGradient(0, 0, 64, 0);
  hg.addColorStop(0, rgba(WHITE, 0)); hg.addColorStop(0.5, rgba(WHITE, 1)); hg.addColorStop(1, rgba(WHITE, 0));
  sg.fillStyle = hg; sg.fillRect(0, 0, 64, 256);
  sg.globalCompositeOperation = 'destination-in';
  sg.fillStyle = vgrad(sg, 256, [[0, rgba(WHITE, 1)], [1, rgba(WHITE, 0)]]); sg.fillRect(0, 0, 64, 256);
  sg.globalCompositeOperation = 'source-in';
  sg.fillStyle = rgba(mix(acc, hi, 0.5)); sg.fillRect(0, 0, 64, 256);
  const S = 96, bubble = surface(S, S), g = bubble.getContext('2d'), R = S / 2 - 3;
  const film = g.createRadialGradient(S / 2, S / 2, R * 0.55, S / 2, S / 2, R);
  film.addColorStop(0, rgba(acc, 0.02)); film.addColorStop(0.85, rgba(acc, 0.16)); film.addColorStop(1, rgba(mix(acc, hi, 0.5), 0.5));
  g.fillStyle = film; g.beginPath(); g.arc(S / 2, S / 2, R, 0, TAU); g.fill();
  g.lineWidth = 2.2; g.strokeStyle = rgba(mix(acc, hi, 0.55), 0.8); g.stroke();
  g.lineCap = 'round'; g.lineWidth = 5; g.strokeStyle = rgba(hi, 0.85);
  g.beginPath(); g.arc(S / 2, S / 2, R * 0.72, PI * 1.08, PI * 1.42); g.stroke();
  g.lineWidth = 3; g.strokeStyle = rgba(hi, 0.3);
  g.beginPath(); g.arc(S / 2, S / 2, R * 0.74, PI * 0.12, PI * 0.42); g.stroke();
  g.fillStyle = rgba(hi, 0.95); g.beginPath(); g.arc(S / 2 - R * 0.18, S / 2 - R * 0.52, R * 0.08, 0, TAU); g.fill();
  const spawn = (w, h, y) => {
    const r = 2 + 13 * rand() ** 2.6;
    return { x: rand() * w, y: y ?? h + r + rand() * h * 0.3, r, v: 16 + r * 4 + rand() * 10, a: 1.5 + r * 0.5, f: 0.7 + rand() * 1.1, p: rand() * TAU };
  };
  return {
    resize(w, h, kk) {
      k = kk;
      back = surface(w * k, h * k);
      const b = back.getContext('2d');
      b.scale(k, k);
      b.fillStyle = vgrad(b, h, [[0, rgba(mix(bg, acc, 0.3))], [0.45, rgba(bg)], [1, rgba(mix(bg, BLACK, 0.5))]]);
      b.fillRect(0, 0, w, h);
      const sx = ow ? w / ow : 1, sy = oh ? h / oh : 1;
      list = keep(list, clamp(round((w * h) / 6500), 16, 150), () => spawn(w, h, rand() * h), sx, sy);
      motes = keep(motes, clamp(round((w * h) / 9000), 10, 90), () => ({ x: rand() * w, y: rand() * h, s: 0.5 + rand(), v: 3 + rand() * 6 }), sx, sy);
      ow = w; oh = h;
    },
    draw(c, t, dt, w, h) {
      c.drawImage(back, 0, 0, w, h);
      c.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 5; i++) { // light shafts from the surface, swaying
        const x = w * (0.08 + i * 0.22) + sin(t * 0.21 + i * 1.9) * w * 0.05, sw = w * (0.1 + 0.06 * (i % 2));
        c.globalAlpha = 0.16 + 0.08 * sin(t * 0.5 + i * 2.3);
        c.setTransform((k * sw) / 64, 0, (-k * 0.32 * h * 0.9) / 256, (k * h * 0.9) / 256, k * (x - sw / 2), 0);
        c.drawImage(shaft, 0, 0);
      }
      c.setTransform(k, 0, 0, k, 0, 0); c.globalAlpha = 1;
      c.globalCompositeOperation = 'source-over';
      c.fillStyle = rgba(mix(acc, hi, 0.5));
      for (const m of motes) {
        m.y -= m.v * dt; m.x += sin(t * 0.6 + m.y * 0.05) * 3 * dt;
        if (m.y < -2) { m.y = h + 2; m.x = rand() * w; }
        c.globalAlpha = 0.25; c.fillRect(m.x, m.y, m.s, m.s);
      }
      for (let i = 0; i < list.length; i++) {
        const b = list[i];
        b.y -= b.v * dt;
        if (b.y < -b.r * 2) { list[i] = spawn(w, h); continue; }
        const x = b.x + sin(t * b.f + b.p) * b.a, sq = 1 + 0.06 * sin(t * b.f * 2.3 + b.p), d = b.r * 2 * (S / (S - 6));
        c.globalAlpha = 0.55 + 0.45 * min(1, b.r / 10);
        c.drawImage(bubble, x - (d * sq) / 2, b.y - d / sq / 2, d * sq, d / sq);
      }
      c.globalAlpha = 1;
    },
  };
}

const SIN = Float32Array.from({ length: 4096 }, (_, i) => sin((i / 4096) * TAU));
const fsin = x => SIN[((x * 651.8986) | 0) & 4095]; // table sine: the plasma evaluates ~7 per pixel

function plasma({ pal: [a, b, c3] }) {
  const dark = mix(c3, BLACK, 0.82), lut = ramp([dark, c3, a, mix(a, WHITE, 0.55), b, mix(b, c3, 0.5)], true);
  let buf, img, words, bw, bh, unit, vig;
  return {
    resize(w, h, k) {
      bw = clamp(round(min(w / 5, sqrt((36000 * w) / h))), 24, 260); bh = max(2, round((bw * h) / w)); unit = 8.5 / max(bw, bh);
      buf = surface(bw, bh); img = buf.getContext('2d').createImageData(bw, bh); words = new Uint32Array(img.data.buffer);
      vig = surface(w * k, h * k);
      const g = vig.getContext('2d'), rg = g.createRadialGradient(w * k / 2, h * k / 2, 0, w * k / 2, h * k / 2, max(w, h) * k * 0.75);
      rg.addColorStop(0.45, 'rgba(0,0,0,0)'); rg.addColorStop(1, 'rgba(0,0,0,.55)');
      g.fillStyle = rg; g.fillRect(0, 0, w * k, h * k);
    },
    draw(ctx, t, dt, w, h) {
      const cx = bw * unit * (0.5 + 0.35 * sin(t * 0.13)), cy = bh * unit * (0.5 + 0.35 * cos(t * 0.17)), shift = t * 26;
      for (let y = 0, i = 0; y < bh; y++) {
        const py = y * unit;
        for (let x = 0; x < bw; x++, i++) {
          const px = x * unit;
          const wx = px + 0.55 * fsin(py * 1.7 + t * 0.31), wy = py + 0.55 * fsin(px * 1.3 - t * 0.27 + 1.5708); // domain warp
          const dx = wx - cx, dy = wy - cy;
          const v = fsin(wx * 1.1 + t * 0.6) + fsin(wy * 1.25 - t * 0.43) + fsin(wx * 0.6 + wy * 0.8 + t * 0.37) + fsin(sqrt(dx * dx + dy * dy) * 1.7 - t * 0.9);
          words[i] = lut[((v + 4) * 40 + shift) & 255];
        }
      }
      buf.getContext('2d').putImageData(img, 0, 0);
      ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(buf, 0, 0, w, h);
      ctx.drawImage(vig, 0, 0, w, h);
    },
  };
}

function pixelRain({ pal: [bg, ga, gb], rand }) {
  const luts = [ga, gb].map(col => ramp([mix(bg, col, 0.04), mix(bg, col, 0.22), mix(bg, col, 0.6), col, mix(col, WHITE, 0.75)]));
  let cell, gw, gh, heat, kind, drops, sparks, buf, img, words, grid;
  const drop = y => ({ x: floor(rand() * gw), y: y ?? -rand() * gh * 0.6, v: 9 + rand() * 18 });
  return {
    warm: 45,
    resize(w, h, k) {
      cell = clamp(round(min(w, h) / 38), 5, 12); gw = ceil(w / cell); gh = ceil(h / cell);
      heat = new Float32Array(gw * gh); kind = Uint8Array.from({ length: gw }, () => (rand() < 0.3 ? 1 : 0));
      drops = Array.from({ length: max(4, round(gw * 0.55)) }, () => drop(rand() * gh)); sparks = [];
      buf = surface(gw, gh); img = buf.getContext('2d').createImageData(gw, gh); words = new Uint32Array(img.data.buffer);
      grid = surface(w * k, h * k); // LED gaps between the chunky pixels
      const g = grid.getContext('2d'), s = cell * k, lw = max(1, round(k * cell * 0.14));
      g.fillStyle = rgba(mix(bg, BLACK, 0.4), 0.75);
      for (let x = 0; x < gw; x++) g.fillRect(round(x * s), 0, lw, h * k);
      for (let y = 0; y < gh; y++) g.fillRect(0, round(y * s), w * k, lw);
    },
    draw(c, t, dt, w, h) {
      const decay = exp(-dt * 2.6);
      for (let i = 0; i < heat.length; i++) heat[i] *= decay;
      for (let i = 0; i < drops.length; i++) {
        const d = drops[i], y0 = floor(d.y);
        d.y += d.v * dt;
        for (let y = max(0, y0); y <= min(gh - 1, floor(d.y)); y++) heat[y * gw + d.x] = 1;
        if (d.y >= gh) {
          if (sparks.length < 40 && rand() < 0.6) for (const dir of [-1, 1]) sparks.push({ x: d.x + 0.5, y: gh - 1, vx: dir * (3 + rand() * 6), vy: -(8 + rand() * 9), k: kind[d.x] });
          drops[i] = drop();
        }
      }
      sparks = sparks.filter(s => {
        s.vy += 40 * dt; s.x += s.vx * dt; s.y += s.vy * dt;
        const x = floor(s.x), y = floor(s.y);
        if (y >= gh || x < 0 || x >= gw) return false;
        if (y >= 0) heat[y * gw + x] = max(heat[y * gw + x], 0.85);
        return true;
      });
      for (let y = 0, i = 0; y < gh; y++) for (let x = 0; x < gw; x++, i++) words[i] = luts[kind[x]][(heat[i] * 255) | 0];
      buf.getContext('2d').putImageData(img, 0, 0);
      c.fillStyle = rgba(bg); c.fillRect(0, 0, w, h);
      c.imageSmoothingEnabled = false;
      c.drawImage(buf, 0, 0, gw * cell, gh * cell);
      c.drawImage(grid, 0, 0, w, h);
      c.imageSmoothingEnabled = true; // bloom: the same pixels, blurred by bilinear upscaling
      c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.45;
      c.drawImage(buf, -cell / 2, -cell / 2, gw * cell + cell, gh * cell + cell);
      c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1;
    },
  };
}

function sakura({ pal: [bg, pink, pale], rand }) {
  let petals = [], back = null, k = 1, ow = 0, oh = 0;
  const deep = mix(pink, [255, 80, 150], 0.45);
  const petal = (light, dark) => { // notched cherry petal, base at the bottom
    const c = surface(64, 64), g = c.getContext('2d');
    g.translate(32, 32);
    g.beginPath(); g.moveTo(0, 26); g.bezierCurveTo(-19, 12, -18, -14, -6, -24); g.lineTo(0, -17); g.lineTo(6, -24); g.bezierCurveTo(18, -14, 19, 12, 0, 26);
    const lg = g.createLinearGradient(0, 26, 0, -24);
    lg.addColorStop(0, rgba(light)); lg.addColorStop(0.55, rgba(mix(light, dark, 0.45))); lg.addColorStop(1, rgba(dark));
    g.fillStyle = lg; g.fill();
    g.strokeStyle = rgba(WHITE, 0.35); g.lineWidth = 1.2;
    g.beginPath(); g.moveTo(0, 22); g.quadraticCurveTo(-2, 0, 0, -14); g.stroke();
    return c;
  };
  const front = petal(pale, pink), backSide = petal(mix(pale, pink, 0.5), deep);
  const spawn = (w, h, y) => {
    const z = 0.35 + rand() * 0.65;
    return { x: rand() * w * 1.2 - w * 0.2, y: y ?? -20 - rand() * h * 0.3, z, s: 6 + 10 * z, rot: rand() * TAU, spin: (rand() - 0.5) * 2.4,
      flip: rand() * TAU, fs: 1.5 + rand() * 2.5, p: rand() * TAU };
  };
  return {
    resize(w, h, kk) {
      k = kk;
      back = surface(w * k, h * k);
      const g = back.getContext('2d'), rand2 = rng(11);
      g.scale(k, k);
      g.fillStyle = vgrad(g, h, [[0, rgba(mix(bg, BLACK, 0.3))], [0.6, rgba(bg)], [1, rgba(mix(bg, pink, 0.28))]]);
      g.fillRect(0, 0, w, h);
      const mx = w * 0.78, my = h * 0.2, mr = min(w, h) * 0.09, halo = g.createRadialGradient(mx, my, mr * 0.8, mx, my, mr * 4.5);
      halo.addColorStop(0, rgba(pale, 0.22)); halo.addColorStop(1, rgba(pale, 0));
      g.fillStyle = halo; g.fillRect(0, 0, w, h);
      g.fillStyle = rgba(mix(pale, WHITE, 0.4), 0.9); g.beginPath(); g.arc(mx, my, mr, 0, TAU); g.fill();
      g.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 14; i++) { // bokeh
        const x = rand2() * w, y = rand2() * h, r = min(w, h) * (0.03 + rand2() * 0.08), rg = g.createRadialGradient(x, y, r * 0.6, x, y, r);
        rg.addColorStop(0, rgba(i % 3 ? pink : pale, 0.07 + rand2() * 0.06)); rg.addColorStop(1, rgba(pink, 0));
        g.fillStyle = rg; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
      }
      g.globalCompositeOperation = 'source-over';
      const branch = (x, y, a, len, wd, depth) => { // a little blossoming branch from the top-left corner
        const x2 = x + cos(a) * len, y2 = y + sin(a) * len;
        g.strokeStyle = rgba(mix(bg, BLACK, 0.55)); g.lineWidth = wd; g.lineCap = 'round';
        g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo((x + x2) / 2 + sin(a) * len * 0.15, (y + y2) / 2 - cos(a) * len * 0.15, x2, y2); g.stroke();
        if (depth > 0) { branch(x2, y2, a - 0.45 - rand2() * 0.3, len * 0.68, wd * 0.62, depth - 1); branch(x2, y2, a + 0.3 + rand2() * 0.3, len * 0.6, wd * 0.6, depth - 1); }
        if (depth < 2) for (let j = 0; j < 3; j++) {
          const bx = x2 + (rand2() - 0.5) * len * 0.5, by = y2 + (rand2() - 0.5) * len * 0.5, br = 2.5 + rand2() * 3;
          g.fillStyle = rgba(j % 2 ? pale : pink, 0.95);
          for (let q = 0; q < 5; q++) { g.beginPath(); g.arc(bx + cos(q * TAU / 5) * br, by + sin(q * TAU / 5) * br, br * 0.85, 0, TAU); g.fill(); }
          g.fillStyle = rgba(deep); g.beginPath(); g.arc(bx, by, br * 0.45, 0, TAU); g.fill();
        }
      };
      const L = min(w, h) * 0.32;
      branch(-L * 0.15, h * 0.05, 0.35, L, max(2, L * 0.07), 3);
      petals = keep(petals, clamp(round((w * h) / 3800), 18, 160), () => spawn(w, h, rand() * h), ow ? w / ow : 1, oh ? h / oh : 1);
      ow = w; oh = h;
    },
    draw(c, t, dt, w, h) {
      c.drawImage(back, 0, 0, w, h);
      const wind = 16 + 12 * sin(t * 0.23) + 7 * sin(t * 0.71 + 1);
      for (let i = 0; i < petals.length; i++) {
        const p = petals[i];
        p.y += (16 + 30 * p.z) * dt; p.x += (wind * (0.5 + p.z) + sin(t * 1.3 + p.p) * 14) * dt;
        p.rot += p.spin * dt; p.flip += p.fs * dt;
        if (p.y > h + 20 || p.x > w + 30) { petals[i] = spawn(w, h); continue; }
        const f = cos(p.flip), sx = (p.s / 26) * max(0.12, abs(f)), sy = p.s / 26, cr = cos(p.rot), sr = sin(p.rot);
        c.setTransform(k * cr * sx, k * sr * sx, -k * sr * sy, k * cr * sy, k * p.x, k * p.y);
        c.globalAlpha = 0.5 + 0.5 * p.z;
        c.drawImage(f >= 0 ? front : backSide, -32, -32);
      }
      c.setTransform(k, 0, 0, k, 0, 0); c.globalAlpha = 1;
    },
  };
}

function aurora({ pal: [bg, green, violet] }) {
  let back = null, fg = null, sky, img, light, glow, stars = [], aw, ah;
  // Ray colour by height (0 = the bright lower hem, 127 = the violet top), premultiplied, for additive light.
  const rays = [green, mix(green, violet, 0.35), mix(green, [120, 240, 255], 0.5)].map(col => {
    const c = surface(1, 128), g = c.getContext('2d'), lg = g.createLinearGradient(0, 128, 0, 0);
    lg.addColorStop(0, rgba(col, 0)); lg.addColorStop(0.04, rgba(mix(col, WHITE, 0.45), 1)); lg.addColorStop(0.16, rgba(col, 0.85));
    lg.addColorStop(0.55, rgba(mix(col, violet, 0.75), 0.35)); lg.addColorStop(1, rgba(violet, 0));
    g.fillStyle = lg; g.fillRect(0, 0, 1, 128);
    const d = g.getImageData(0, 0, 1, 128).data, lut = new Float32Array(128 * 3);
    for (let i = 0; i < 128; i++) for (let ch = 0; ch < 3; ch++) lut[i * 3 + ch] = (d[(127 - i) * 4 + ch] * d[(127 - i) * 4 + 3]) / 255;
    return lut;
  });
  const ridge = (g, w, h, base, amp, col, seed) => {
    const r = rng(seed), pts = [], n = 48;
    let v = 0;
    for (let i = 0; i <= n; i++) { v = v * 0.7 + (r() - 0.5) * 0.9; pts.push(base - amp * (0.5 + 0.5 * sin(i * 0.31 + seed)) - amp * 0.4 * v); }
    g.fillStyle = col; g.beginPath(); g.moveTo(0, h);
    pts.forEach((y, i) => g.lineTo((i / n) * w, y));
    g.lineTo(w, h); g.fill();
    return pts;
  };
  return {
    resize(w, h, k) {
      back = surface(w * k, h * k);
      const g = back.getContext('2d'), r2 = rng(3);
      g.scale(k, k);
      g.fillStyle = vgrad(g, h, [[0, rgba(mix(bg, BLACK, 0.5))], [0.62, rgba(bg)], [0.85, rgba(mix(bg, green, 0.14))], [1, rgba(bg)]]);
      g.fillRect(0, 0, w, h);
      g.fillStyle = rgba(WHITE, 0.55);
      for (let i = 0, n = (w * h) / 900; i < n; i++) { const s = r2() < 0.1 ? 1.2 : 0.6; g.fillRect(r2() * w, r2() * h * 0.8, s, s); }
      stars = Array.from({ length: 18 }, () => ({ x: r2() * w, y: r2() * h * 0.6, p: r2() * TAU, f: 1 + r2() * 2 }));
      aw = clamp(round(w / 2.5), 40, 240); ah = max(2, round((aw * h) / w));
      sky = surface(aw, ah); img = sky.getContext('2d').createImageData(aw, ah); light = new Float32Array(aw * ah * 3);
      glow = surface(max(2, aw / 6), max(2, ah / 6));
      fg = surface(w * k, h * k); // mountains drawn over the aurora
      const f = fg.getContext('2d');
      f.scale(k, k);
      ridge(f, w, h, h * 0.86, h * 0.1, rgba(mix(bg, BLACK, 0.35)), 3);
      const near = ridge(f, w, h, h * 0.95, h * 0.06, rgba(mix(bg, BLACK, 0.7)), 8);
      f.fillStyle = rgba(mix(bg, BLACK, 0.72));
      for (let i = 0; i < w / 14; i++) { // pines along the near ridge
        const x = r2() * w, y = near[round((x / w) * (near.length - 1))] + 2, th = h * (0.025 + r2() * 0.035);
        f.beginPath(); f.moveTo(x, y - th); f.lineTo(x + th * 0.32, y); f.lineTo(x - th * 0.32, y); f.fill();
      }
    },
    draw(c, t, dt, w, h) {
      light.fill(0);
      for (let n = 0; n < 3; n++) { // three curtains: folded vertical rays hanging from a wavy hem
        const lut = rays[n];
        for (let x = 0; x < aw; x++) {
          const u = x / aw;
          const base = ah * (0.4 + 0.07 * n) + ah * 0.09 * sin(u * 3.1 + t * 0.11 + n * 1.7) + ah * 0.035 * sin(u * 7.3 - t * 0.23 + n);
          const fold = (0.5 + 0.5 * sin(u * 26 + t * 0.8 + n * 2 + 2.2 * sin(u * 5 - t * 0.3))) ** 4;
          const env = 0.25 + 0.75 * (0.5 + 0.5 * sin(u * 2.4 + t * 0.07 + n * 2.1)) ** 2;
          const ht = ah * (0.2 + 0.2 * (0.5 + 0.5 * sin(u * 4.2 + t * 0.17 + n))) * 1.08, a = min(1, (0.1 + 0.75 * fold) * env * 0.95);
          for (let y = max(0, ceil(base - ht)), y1 = min(ah - 1, floor(base)); y <= y1; y++) {
            const li = min(127, ((base - y) / ht) * 128) | 0, o = (y * aw + x) * 3;
            light[o] += lut[li * 3] * a; light[o + 1] += lut[li * 3 + 1] * a; light[o + 2] += lut[li * 3 + 2] * a;
          }
        }
      }
      const px = img.data;
      for (let i = 0, j = 0; i < px.length; i += 4, j += 3) { px[i] = light[j]; px[i + 1] = light[j + 1]; px[i + 2] = light[j + 2]; px[i + 3] = 255; }
      sky.getContext('2d').putImageData(img, 0, 0); // opaque black + light: drawn with 'lighter' it only adds
      const gg = glow.getContext('2d');
      gg.clearRect(0, 0, glow.width, glow.height); gg.drawImage(sky, 0, 0, glow.width, glow.height);
      c.drawImage(back, 0, 0, w, h);
      c.globalCompositeOperation = 'lighter';
      c.fillStyle = rgba(WHITE);
      for (const st of stars) { c.globalAlpha = 0.35 + 0.35 * sin(t * st.f + st.p); c.fillRect(st.x, st.y, 1.3, 1.3); }
      c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high';
      c.globalAlpha = 0.9; c.drawImage(glow, 0, 0, w, h);
      c.globalAlpha = 1; c.drawImage(sky, 0, 0, w, h);
      c.globalCompositeOperation = 'source-over';
      c.drawImage(fg, 0, 0, w, h);
    },
  };
}

const SCENES = { starfield, bubbles, plasma, 'pixel-rain': pixelRain, 'sakura-petals': sakura, aurora };

// createScreensaver(id, canvas, { palette, fps = 60, pixelRatio, seed }) -> { stop(), resize() }
export function createScreensaver(id, canvas, { palette, fps = 60, pixelRatio, seed = 7 } = {}) {
  if (!SCENES[id]) { console.warn(`[fx] unknown screensaver "${id}", using starfield`); id = 'starfield'; }
  const base = PALETTES[id], pal = base.map((c, i) => hexRgb(palette?.[i] ?? c));
  const scene = SCENES[id]({ pal, rand: rng(seed) });
  const ctx = canvas.getContext('2d', { alpha: false });
  const minStep = 800 / fps;
  let w = 0, h = 0, k = 1, t = 0, acc = 0, ready = false, stopped = false, seen = false, off = null;

  const paint = dt => { ctx.setTransform(k, 0, 0, k, 0, 0); scene.draw(ctx, t, dt, w, h); };
  function resize() {
    if (stopped) return;
    const cw = canvas.clientWidth, ch = canvas.clientHeight;
    if (!cw || !ch) return;
    const nk = min(2, pixelRatio ?? (globalThis.devicePixelRatio || 1)), bw = max(1, round(cw * nk)), bh = max(1, round(ch * nk));
    if (cw === w && ch === h && bw === canvas.width && bh === canvas.height) return;
    canvas.width = bw; canvas.height = bh; w = cw; h = ch; k = bw / cw;
    scene.resize(w, h, k);
    if (!ready) { ready = true; for (let i = 0; i < (scene.warm || 1); i++) { t += 1 / 30; paint(1 / 30); } } // warm up (pixel-rain trails)
    else paint(0);
  }
  const entry = {
    write(_now, dtMs) {
      if (!canvas.isConnected) { if (seen) stop(); return; }
      seen = true;
      if (!ready) resize();
      if (!ready || (acc += dtMs) < minStep) return;
      const dt = min(acc, 50) / 1000;
      acc = 0; t += dt; paint(dt);
    },
  };
  const run = still => { off?.(); off = still ? null : onFrame(entry); if (still && ready) paint(0); };
  const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(resize) : null;
  ro?.observe(canvas);
  const offRm = onReducedMotionChange(run);
  function stop() { if (stopped) return; stopped = true; off?.(); ro?.disconnect(); offRm(); }
  resize();
  run(reducedMotion());
  return { stop, resize };
}
