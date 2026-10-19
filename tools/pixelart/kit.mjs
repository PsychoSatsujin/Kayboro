// Reusable pixel details shared by the frames: hand-pixeled sprites, recessed screen rims, LEDs, screws.

export const INK = '#1b1226'; // the one outline color every frame uses

/** Draw a hand-pixeled sprite: rows of chars, pal maps char -> color ('.' and ' ' are skipped). */
export function sprite(cv, x, y, rows, pal, { flip = false } = {}) {
  rows.forEach((row, j) => [...row].forEach((ch, i) => {
    const c = pal[ch];
    if (c) cv.set(flip ? x + row.length - 1 - i : x + i, y + j, c);
  }));
  return cv;
}
export function spriteMask(cv, x, y, rows, { flip = false } = {}) {
  const m = cv.mask();
  rows.forEach((row, j) => [...row].forEach((ch, i) => { if (ch !== '.' && ch !== ' ') m.put(flip ? x + row.length - 1 - i : x + i, y + j); }));
  return m;
}

/**
 * Recessed rim around a screen opening (x, y, w, h, corner r): `depth` rings of wall colored per side
 * (light from the top-left, so the top/left walls are in shadow) plus a 1px `rim` right at the glass.
 */
export function inset(cv, x, y, w, h, r, { rim = INK, top, left = top, bottom, right = bottom }, depth = 1) {
  const hole = cv.mask().rrect(x, y, w, h, r);
  const r1 = cv.mask().rrect(x - 1, y - 1, w + 2, h + 2, r ? r + 1 : 0).sub(hole);
  const outer = cv.mask().rrect(x - 1 - depth, y - 1 - depth, w + 2 + 2 * depth, h + 2 + 2 * depth, r ? r + 1 + depth : 0).sub(hole).sub(r1);
  cv.fill(outer, (px, py) => {
    const d = { t: y - py, b: py - (y + h - 1), l: x - px, r: px - (x + w - 1) };
    const s = Object.entries(d).sort((a, b) => b[1] - a[1])[0][0];
    return { t: top, b: bottom, l: left, r: right }[s];
  });
  cv.fill(r1, rim);
  return hole;
}

/** Shade a part with a ramp, give it an ink outline and a 1px drop shadow onto whatever is under it. */
export function part(cv, m, R, o = {}) {
  if (o.shadow !== false) cv.cast(o.shadowMask || m.dilate(1), o.dx ?? 1, o.dy ?? 1, o.shadow ?? -1);
  cv.shade(m, R, o);
  if (o.ink !== false) cv.outline(o.ink || INK, m, { all: true });
  return m;
}

/** Round LED: ramp [dark, base, bright, white]; optional soft halo stepped onto the surface around it. */
export function led(cv, x, y, R, { d = 3, halo = 0 } = {}) {
  const m = cv.mask().oval(x, y, d, d, d < 4 ? 1.6 : 1.1);
  if (halo) cv.glow(cv.mask().circle(x + (d >> 1), y + (d >> 1), d + halo).sub(m), x + d / 2, y + d / 2, d / 2 + halo + 1, 1);
  cv.shade(m, R, { top: [2], left: [2], bottom: [0], right: [1], fill: 1 });
  cv.set(x + (d > 3 ? 1 : 0), y + (d > 3 ? 1 : 0), R[3]);
  return m;
}

/** 5x5 slotted screw, ramp [slot, dark, mid, light]. */
export function screw(cv, x, y, R) {
  return sprite(cv, x, y, ['.hhm.', 'hmmsd', 'hmsmd', 'msmmd', '.ddd.'], { s: R[0], d: R[1], m: R[2], h: R[3] });
}

/** 4-point sparkle: arms of length n around a bright core. */
export function sparkle(cv, x, y, n, c, core = c) {
  for (let k = 1; k <= n; k++) for (const [dx, dy] of [[k, 0], [-k, 0], [0, k], [0, -k]]) cv.set(x + dx, y + dy, c);
  cv.set(x, y, core);
  return cv;
}

/** Horizontal speaker slots: rows of dark slits with a lit lower lip. */
export function slots(cv, x, y, w, n, gap, dark, lip) {
  for (let i = 0; i < n; i++) {
    cv.rect(x, y + i * gap, w, 1, dark);
    if (lip) cv.rect(x + 1, y + i * gap + 1, w - 1, 1, lip);
  }
  return cv;
}

export const SHAPES = {
  star: ['....#....', '...###...', '...###...', '#########', '.#######.', '..#####..', '..#####..', '.###.###.', '.##...##.'],
  heart: ['.##...##.', '####.####', '#########', '#########', '.#######.', '..#####..', '...###...', '....#....'],
  heart5: ['.#.#.', '#####', '#####', '.###.', '..#..'],
};

/** Die-cut vinyl sticker: shaded shape on a pale border with a soft drop shadow. */
export function sticker(cv, x, y, rows, R, { border = '#f6f0ff' } = {}) {
  const m = spriteMask(cv, x, y, rows), die = m.dilate(1);
  cv.cast(die, 1, 1, -2).fill(die, border);
  cv.shade(m, R, { top: [R.length - 1], left: [R.length - 2], bottom: [0], right: [1], fill: R.length - 3 });
  return m;
}

/**
 * Kayboro mascot: a kawaii scallop shell (hinge at bottom center bx, by; fan radius r) with ridges
 * fanning out and a scalloped rim. R = ramp dark -> light (>= 5). Returns its mask (no outline).
 */
export function scallop(cv, bx, by, r, R, { face = true } = {}) {
  const n = 7, span = Math.PI * 0.3, cy = by - 2, m = cv.mask();
  const ang = (x, y) => Math.atan2(x + 0.5 - bx - 0.5, cy - (y + 0.5));
  m.plot((x, y) => {
    const a = ang(x, y), d = Math.hypot(x + 0.5 - bx - 0.5, y + 0.5 - cy);
    if (Math.abs(a) > span || y > cy) return false;
    const f = ((a + span) / (2 * span)) * n, bump = Math.sin((f % 1) * Math.PI);
    return d <= r - 1.2 + bump * 1.6;
  }, bx - r - 2, by - r - 3, bx + r + 3, by + 1);
  m.rect(bx - 3, cy, 7, 2).rect(bx - 2, cy + 2, 5, 1); // hinge + ears
  cv.fill(m, (x, y) => {
    const f = ((ang(x, y) + span) / (2 * span)) * n;
    return R[(Math.floor(f) % 2 ? 2 : 3) + (y < cy - r * 0.55 ? 1 : 0)];
  });
  cv.fill(m.edge().and(m.shift(0, -1).not().or(m.shift(-1, 0).not())).and(cv.mask().rect(0, cy - r - 3, cv.w, r + 2)), R[R.length - 1]);
  cv.fill(m.and(cv.mask().rect(0, cy, cv.w, 3)), R[1]);
  if (face) {
    const ey = cy - Math.round(r * 0.5), ex = Math.max(2, Math.round(r * 0.22));
    for (const x of [bx - ex, bx + ex]) cv.rect(x, ey, 2, 2, INK).set(x, ey, '#ffffff');
    cv.set(bx - ex - 1, ey + 3, R[R.length - 1]).set(bx + ex + 2, ey + 3, R[R.length - 1]);
    cv.rect(bx, ey + 2, 2, 1, INK);
  }
  return m;
}
