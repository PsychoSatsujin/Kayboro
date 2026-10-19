// Shell particles: a small canvas effect that drifts around a shell and never over its screen (the
// opening is clipped out every frame). Presets are data: where particles spawn, how they move and how
// they draw. Pixel shells get crisp square particles snapped to the shell's own pixel grid, vector shells
// soft ones. Runs on the shared ticker (paused while hidden); reduced motion shows nothing.
import { onFrame, reducedMotion, onReducedMotionChange } from './ticker.js';

const TAU = Math.PI * 2;
const { sin, cos, min, max, random, round, floor, hypot, abs } = Math;

export const PALETTES = {
  sparkles: ['#ffffff', '#ffd166', '#7af0ff', '#ff6ad5'],
  hearts: ['#ff6ad5', '#ff8fc7', '#ffb3d9', '#ffffff'],
  bubbles: ['#7af0ff', '#c9fbff', '#ffffff'],
  'pixel-stars': ['#ffffff', '#ffd166', '#7af0ff', '#ff6ad5'],
  petals: ['#ffb7d5', '#ffe3ef', '#ff8fc7'],
  embers: ['#ffd166', '#ff9a3d', '#ff6ad5'],
  fireflies: ['#d6ff7a', '#ffe27a', '#b8ff9a'],
  confetti: ['#ff6ad5', '#7af0ff', '#ffd166', '#6ee7a8', '#c58cff'],
  snow: ['#ffffff', '#e0f4ff', '#cfe8ff'],
  notes: ['#ff6ad5', '#7af0ff', '#ffd166', '#ffffff'],
};
export const PARTICLE_TYPES = Object.keys(PALETTES);

// Each preset: n = particles per 100k px² (clamped), spawn(p, box) -> sets x/y/vx/vy, life in s.
const edgeOrAny = (b) => (random() < 0.7 ? aroundEdge(b) : anywhere(b));
const PRESETS = {
  sparkles: { n: 9, life: [1.2, 2.6], size: [5, 11], spawn: (b) => ({ ...edgeOrAny(b), vx: 0, vy: -6 }), draw: 'twinkle' },
  'pixel-stars': { n: 8, life: [0.9, 2], size: [2, 3], spawn: (b) => ({ ...edgeOrAny(b), vx: 0, vy: 0 }), draw: 'plus' },
  hearts: { n: 5, life: [2.4, 4], size: [6, 11], spawn: (b) => ({ ...fromBottom(b), vx: 0, vy: -26 }), sway: 14, draw: 'heart' },
  bubbles: { n: 6, life: [2.6, 4.6], size: [4, 11], spawn: (b) => ({ ...fromBottom(b), vx: 0, vy: -30 }), sway: 10, draw: 'bubble' },
  petals: { n: 6, life: [3.5, 6], size: [5, 9], spawn: (b) => ({ ...fromTop(b), vx: 14, vy: 22 }), sway: 22, spin: 2, draw: 'petal' },
  embers: { n: 8, life: [1.6, 3.2], size: [1.5, 3.5], spawn: (b) => ({ ...fromBottom(b), vx: 0, vy: -38 }), sway: 9, draw: 'glow' },
  fireflies: { n: 5, life: [3, 6], size: [2, 3.5], spawn: (b) => ({ ...edgeOrAny(b), vx: 0, vy: 0 }), wander: 22, draw: 'glow' },
  confetti: { n: 7, life: [2.6, 4.4], size: [4, 8], spawn: (b) => ({ ...fromTop(b), vx: 0, vy: 40 }), sway: 18, spin: 6, draw: 'confetti' },
  snow: { n: 8, life: [4, 7], size: [1.5, 4], spawn: (b) => ({ ...fromTop(b), vx: 0, vy: 18 }), sway: 10, draw: 'dot' },
  notes: { n: 4, life: [2.4, 4], size: [7, 11], spawn: (b) => ({ ...fromBottom(b), vx: 0, vy: -24 }), sway: 16, draw: 'note' },
};

const rnd = (a, b) => a + random() * (b - a);
const pick = (list) => list[floor(random() * list.length)];
function anywhere(b) { return { x: rnd(0, b.w), y: rnd(0, b.h) }; }
// A point in the band between the hole and the box edge: on the shell or the air around it.
function aroundEdge(b) {
  for (let i = 0; i < 12; i++) { const p = anywhere(b); if (!inHole(b, p.x, p.y, 6)) return p; }
  return { x: rnd(0, b.w), y: rnd(0, b.hole ? b.hole.y : b.h * 0.2) };
}
function fromBottom(b) { return { x: rnd(0.05, 0.95) * b.w, y: b.h * rnd(0.75, 1) }; }
function fromTop(b) { return { x: rnd(0, 1) * b.w, y: -rnd(0, b.h * 0.15) }; }
const inHole = (b, x, y, m = 0) => !!b.hole && x > b.hole.x - m && y > b.hole.y - m && x < b.hole.x + b.hole.w + m && y < b.hole.y + b.hole.h + m;

/** Particle count for a box (CSS px), scaled by preset density, between 4 and 48. */
export function particleCount(type, w, h, density = 1) {
  const p = PRESETS[type];
  return p ? max(4, min(48, round((p.n * density * w * h) / 100000))) : 0;
}

/**
 * Starts an effect on `canvas` (sized to its CSS box). opts: { type, palette?, pixel? (shell px per logical
 * pixel: snaps to that grid), hole? {x, y, w, h, r} in CSS px, density? }. Returns { update(opts), dispose() }.
 */
export function createParticles(canvas, opts) {
  let o = { ...opts }, parts = [], off = null, dpr = 1, W = 0, H = 0;
  const g = canvas.getContext('2d');
  const box = () => ({ w: W, h: H, hole: o.hole || null });
  const palette = () => (Array.isArray(o.palette) && o.palette.length ? o.palette : PALETTES[o.type] || PALETTES.sparkles);

  function size() {
    const r = canvas.getBoundingClientRect();
    dpr = min(2, devicePixelRatio || 1);
    W = r.width; H = r.height;
    const cw = max(1, round(W * dpr)), ch = max(1, round(H * dpr));
    if (canvas.width !== cw || canvas.height !== ch) Object.assign(canvas, { width: cw, height: ch });
  }
  function spawn(p, fresh) {
    const pr = PRESETS[o.type], s = pr.spawn(box());
    Object.assign(p, s, { life: rnd(...pr.life), size: rnd(...pr.size), color: pick(palette()), rot: rnd(0, TAU), seed: rnd(0, TAU) });
    p.age = fresh ? rnd(0, p.life) : 0; // the first batch starts mid-life so the effect doesn't pop in
    return p;
  }
  function reset() {
    size();
    const n = particleCount(o.type, W, H, o.density ?? 1);
    parts = Array.from({ length: n }, () => spawn({}, true));
  }

  function step(dt) {
    const pr = PRESETS[o.type], s = dt / 1000;
    for (const p of parts) {
      p.age += s;
      if (p.age >= p.life || p.y < -40 || p.y > H + 40) { spawn(p, false); continue; }
      const t = p.age;
      if (pr.wander) { p.vx += rnd(-1, 1) * pr.wander * s * 4; p.vy += rnd(-1, 1) * pr.wander * s * 4; const v = hypot(p.vx, p.vy), m = pr.wander; if (v > m) { p.vx *= m / v; p.vy *= m / v; } }
      p.x += (p.vx + (pr.sway ? cos(t * 1.7 + p.seed) * pr.sway : 0)) * s;
      p.y += p.vy * s;
      if (pr.spin) p.rot += pr.spin * s;
    }
  }

  function clipHole() {
    const h = o.hole;
    if (!h) return;
    const r = min(h.r || 0, h.w / 2, h.h / 2);
    g.beginPath();
    g.rect(0, 0, W, H);
    g.roundRect ? g.roundRect(h.x, h.y, h.w, h.h, r) : g.rect(h.x, h.y, h.w, h.h);
    g.clip('evenodd');
  }

  function draw() {
    const pr = PRESETS[o.type], px = o.pixel > 1 ? o.pixel : 0;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, H);
    g.save();
    clipHole();
    for (const p of parts) {
      const k = p.age / p.life, fade = min(1, k * 5, (1 - k) * 4), x = px ? round(p.x / px) * px : p.x, y = px ? round(p.y / px) * px : p.y;
      g.globalAlpha = max(0, fade);
      g.fillStyle = g.strokeStyle = p.color;
      SHAPES[px ? PIXEL[pr.draw] || 'pixel' : pr.draw](g, x, y, px ? max(px, round(p.size / 3) * px) : p.size, p, px);
    }
    g.restore();
  }

  function start() {
    stop();
    if (reducedMotion() || !PRESETS[o.type]) { g.clearRect(0, 0, canvas.width, canvas.height); return; }
    reset();
    let resizeCheck = 0;
    off = onFrame({
      read(t) { if (t - resizeCheck > 500) { resizeCheck = t; const r = canvas.getBoundingClientRect(); if (abs(r.width - W) > 0.5 || abs(r.height - H) > 0.5) reset(); } },
      write(_t, dt) { step(dt); draw(); },
    });
  }
  function stop() { off?.(); off = null; }
  const offRM = onReducedMotionChange(start);
  start();

  return {
    update(next) {
      const before = JSON.stringify([o.type, o.palette, o.density]);
      o = { ...o, ...next };
      if (JSON.stringify([o.type, o.palette, o.density]) !== before || !off) start();
    },
    dispose() { stop(); offRM(); g.clearRect(0, 0, canvas.width, canvas.height); },
  };
}

// ---- Shapes -----------------------------------------------------------------------------------
const PIXEL = { twinkle: 'plus', plus: 'plus', heart: 'pixelHeart', glow: 'pixel', dot: 'pixel', bubble: 'pixelRing', petal: 'pixel', confetti: 'pixel', note: 'pixelNote' };
const HEART5 = ['.#.#.', '#####', '#####', '.###.', '..#..'];
const NOTE5 = ['..##', '..#.', '..#.', '###.', '##..'];
function grid(g, x, y, rows, u) { rows.forEach((r, j) => [...r].forEach((c, i) => { if (c === '#') g.fillRect(x + (i - 2) * u, y + (j - 2) * u, u, u); })); }

export const SHAPES = {
  twinkle(g, x, y, s, p) {
    const k = 0.55 + 0.45 * sin(p.age * 6 + p.seed), r = s * k, q = r * 0.22;
    g.beginPath();
    g.moveTo(x, y - r); g.quadraticCurveTo(x + q, y - q, x + r, y); g.quadraticCurveTo(x + q, y + q, x, y + r);
    g.quadraticCurveTo(x - q, y + q, x - r, y); g.quadraticCurveTo(x - q, y - q, x, y - r);
    g.fill();
    g.globalAlpha *= 0.35; g.beginPath(); g.arc(x, y, r * 0.55, 0, TAU); g.fill(); // soft core
  },
  plus(g, x, y, s, p, px) {
    const u = px || max(2, s), on = sin(p.age * 7 + p.seed) > -0.2;
    g.fillRect(x - u / 2, y - u / 2, u, u);
    if (on) { g.fillRect(x - u * 1.5, y - u / 2, u, u); g.fillRect(x + u / 2, y - u / 2, u, u); g.fillRect(x - u / 2, y - u * 1.5, u, u); g.fillRect(x - u / 2, y + u / 2, u, u); }
  },
  heart(g, x, y, s) {
    const a = g.globalAlpha;
    g.beginPath();
    g.moveTo(x, y + s * 0.9);
    g.bezierCurveTo(x - s * 1.1, y + s * 0.1, x - s * 0.9, y - s * 0.9, x, y - s * 0.35);
    g.bezierCurveTo(x + s * 0.9, y - s * 0.9, x + s * 1.1, y + s * 0.1, x, y + s * 0.9);
    g.fill();
    g.globalAlpha = a * 0.6; g.fillStyle = '#ffffff'; g.beginPath(); g.arc(x - s * 0.38, y - s * 0.2, s * 0.16, 0, TAU); g.fill();
  },
  bubble(g, x, y, s) {
    const a = g.globalAlpha;
    g.lineWidth = max(1, s * 0.14);
    g.beginPath(); g.arc(x, y, s, 0, TAU); g.stroke();
    g.globalAlpha = a * 0.18; g.fill();
    g.globalAlpha = a * 0.85; g.fillStyle = '#ffffff';
    g.beginPath(); g.ellipse(x - s * 0.4, y - s * 0.42, s * 0.28, s * 0.16, -0.7, 0, TAU); g.fill();
  },
  petal(g, x, y, s, p) {
    g.save(); g.translate(x, y); g.rotate(p.rot);
    g.beginPath(); g.ellipse(0, 0, s, s * 0.55, 0, 0, TAU); g.fill();
    g.restore();
  },
  glow(g, x, y, s, p) {
    const a = g.globalAlpha, k = 0.6 + 0.4 * sin(p.age * 5 + p.seed);
    g.globalAlpha = a * 0.35 * k; g.beginPath(); g.arc(x, y, s * 3, 0, TAU); g.fill();
    g.globalAlpha = a * k; g.beginPath(); g.arc(x, y, s, 0, TAU); g.fill();
  },
  confetti(g, x, y, s, p) {
    g.save(); g.translate(x, y); g.rotate(p.rot); g.scale(1, 0.4 + 0.6 * abs(sin(p.rot)));
    g.fillRect(-s / 2, -s / 4, s, s / 2);
    g.restore();
  },
  dot(g, x, y, s) { g.beginPath(); g.arc(x, y, s, 0, TAU); g.fill(); },
  note(g, x, y, s) {
    g.beginPath(); g.ellipse(x, y, s * 0.42, s * 0.32, -0.4, 0, TAU); g.fill();
    g.fillRect(x + s * 0.3, y - s * 1.15, max(1.5, s * 0.14), s * 1.15);
    g.fillRect(x + s * 0.3, y - s * 1.15, s * 0.5, max(1.5, s * 0.16));
  },
  pixel(g, x, y, s) { g.fillRect(x, y, s, s); },
  pixelRing(g, x, y, s, p, px) { const u = px || 2; g.fillRect(x - u, y - 2 * u, 2 * u, u); g.fillRect(x - u, y + u, 2 * u, u); g.fillRect(x - 2 * u, y - u, u, 2 * u); g.fillRect(x + u, y - u, u, 2 * u); g.fillStyle = '#ffffff'; g.fillRect(x - u, y - u, u, u); },
  pixelHeart(g, x, y, s, p, px) { grid(g, x, y, HEART5, px || 2); },
  pixelNote(g, x, y, s, p, px) { grid(g, x, y, NOTE5, px || 2); },
};
