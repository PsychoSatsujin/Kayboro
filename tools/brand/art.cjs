'use strict';
// Kayboro brand art as pure functions that return SVG strings (no deps; geometry helpers from tools/vectorart/lib.js).
//
//   Kay      the mascot: a small round pastel critter who lives inside shells (mascot(pose), poseSheet()).
//   mark     Kay peeking out of a tiny pink CRT with rabbit-ear antennas (markSvg(), vector, any size >= 48 px).
//   pixel    hand-tuned 16/24/32 px versions of the mark live in marks.cjs (crispEdges).
//   wordmark "KAYBORO" in hand-drawn pixel letters (rects only, no font files): wordmarkSvg().
//   lockup   mark + wordmark, horizontal or stacked: lockupSvg({ stacked }).
//
// Cel-shaded house style: flat fills, one hard shade and one highlight shape per part, ink outlines (#2a0b22).
// Every function is deterministic; ids are prefixed so several pieces can be inlined into one document.
const { P, rr, circle, ellipse, poly, sparkle, heart, lg, rg, path, g } = require('../vectorart/lib.js');

const PAL = {
  bg: '#0f0d16', panel: '#17141f', panel2: '#1f1b2b', line: '#2c2740', text: '#eee9ff', muted: '#9a93b5',
  ink: '#2a0b22', pink: '#ff6ad5', pinkHi: '#ffa6ea', pinkLo: '#d9459f', pinkDeep: '#9e2b80',
  cyan: '#7af0ff', cyanHi: '#d8fcff', cyanLo: '#38b9e0', coin: '#ffd166', coinLo: '#e0962f',
  kay: '#fff3fa', kayLo: '#e9cdf2', kayDeep: '#c9a6e4', blush: '#ff8fcf', violet: '#3a2560',
};

// ---- Kay ------------------------------------------------------------------------------------------
// Kay's body is one squashy circle with two round ears. All parts are drawn around (cx, cy) with radius R.

/** Face: eyes, glints, blush, mouth. expr: 'happy' | 'wink' | 'sleep' | 'wow'. */
function kayFace(cx, cy, R, expr = 'happy', p = 'k') {
  const ex = R * 0.36, ey = cy - R * 0.02, sw = R * 0.075, ink = PAL.ink;
  const eye = (x, closed) => (closed
    ? path(`M${P(x - R * 0.13, ey)}Q${P(x, ey + R * 0.12)} ${P(x + R * 0.13, ey)}`, { fill: 'none', stroke: ink, strokeWidth: sw, strokeLinecap: 'round' })
    : path(ellipse(x, ey, R * 0.1, R * 0.135), { fill: ink })
      + path(circle(x - R * 0.035, ey - R * 0.055, R * 0.04), { fill: '#fff' }));
  const mouth = expr === 'wow'
    ? path(ellipse(cx, cy + R * 0.22, R * 0.07, R * 0.085), { fill: ink })
    : path(`M${P(cx - R * 0.12, cy + R * 0.17)}Q${P(cx - R * 0.06, cy + R * 0.27)} ${P(cx, cy + R * 0.18)}Q${P(cx + R * 0.06, cy + R * 0.27)} ${P(cx + R * 0.12, cy + R * 0.17)}`,
      { fill: 'none', stroke: ink, strokeWidth: sw * 0.8, strokeLinecap: 'round', strokeLinejoin: 'round' });
  return g({ id: `${p}-face` },
    path(ellipse(cx - R * 0.58, cy + R * 0.16, R * 0.15, R * 0.09), { fill: PAL.blush, opacity: 0.85 }),
    path(ellipse(cx + R * 0.58, cy + R * 0.16, R * 0.15, R * 0.09), { fill: PAL.blush, opacity: 0.85 }),
    eye(cx - ex, expr === 'sleep'), eye(cx + ex, expr === 'sleep' || expr === 'wink'), mouth);
}

/** Kay's head/body blob with ears, cel shade and ink outline. Returns { defs, body } so callers can clip it. */
function kayBlob(cx, cy, R, p = 'k', { sw = R * 0.09, squash = 0.92 } = {}) {
  const ry = R * squash, earR = R * 0.24;
  const ears = [[-0.52, -0.82], [0.52, -0.82]].map(([u, v]) => circle(cx + R * u, cy + R * v, earR)).join('');
  const blob = ellipse(cx, cy, R, ry);
  const all = blob + ears;
  const defs = `<clipPath id="${p}-clip"><path d="${all}"/></clipPath>`;
  const body = [
    path(all, { fill: 'none', stroke: PAL.ink, strokeWidth: sw * 2, strokeLinejoin: 'round' }),
    path(all, { fill: PAL.kay }),
    g({ clipPath: `url(#${p}-clip)` },
      // hard cel shade down the right and bottom, inner ear pink, top-left rim light
      path(`M${P(cx + R * 0.62, cy - ry * 0.8)}C${P(cx + R * 0.95, cy - ry * 0.2, cx + R * 0.85, cy + ry * 0.55, cx + R * 0.3, cy + ry * 0.85)}`
        + `C${P(cx - R * 0.2, cy + ry * 1.05, cx - R * 0.7, cy + ry * 0.75, cx - R * 0.9, cy + ry * 0.45)}L${P(cx - R * 1.2, cy + ry * 1.3)}L${P(cx + R * 1.3, cy + ry * 1.3)}L${P(cx + R * 1.3, cy - ry)}Z`,
        { fill: PAL.kayLo }),
      path(circle(cx - R * 0.52, cy - R * 0.84, earR * 0.5), { fill: PAL.blush, opacity: 0.7 }),
      path(circle(cx + R * 0.52, cy - R * 0.84, earR * 0.5), { fill: PAL.blush, opacity: 0.7 }),
      path(`M${P(cx - R * 0.78, cy - ry * 0.18)}Q${P(cx - R * 0.7, cy - ry * 0.62)} ${P(cx - R * 0.3, cy - ry * 0.74)}`,
        { fill: 'none', stroke: '#fff', strokeWidth: R * 0.09, strokeLinecap: 'round', opacity: 0.9 })),
  ].join('');
  return { defs, body };
}

/** A stubby paw (oval) with outline; used for hands and feet. */
const paw = (x, y, rx, ry, sw, rot = 0) => g({ transform: `rotate(${rot} ${P(x, y)})` },
  path(ellipse(x, y, rx, ry), { fill: PAL.kay, stroke: PAL.ink, strokeWidth: sw }),
  path(ellipse(x + rx * 0.25, y + ry * 0.3, rx * 0.55, ry * 0.4), { fill: PAL.kayLo, opacity: 0.9 }));

// ---- the mark -------------------------------------------------------------------------------------
// 1024 x 1024: antennas, pink CRT shell, cyan screen, Kay peeking up with both paws on the screen lip.

function markParts(p = 'm') {
  const ink = PAL.ink, SW = 30, S = { x: 214, y: 352, w: 596, h: 400, r: 84 };
  const shell = rr(92, 262, 840, 640, 170);
  const screen = rr(S.x, S.y, S.w, S.h, S.r);
  const defs = [
    lg(`${p}-shell`, [0, 0, 0, 1], [[0, '#ff8ee0'], [0.5, PAL.pink], [1, '#f05ac8']]),
    lg(`${p}-scr`, [0, 0, 0, 1], [[0, '#b4f8ff'], [0.55, PAL.cyan], [1, '#4fcbea']]),
    rg(`${p}-glow`, [0.5, 0.95, 0.75], [[0, '#ffffff', 0.55], [1, '#ffffff', 0]]),
    `<clipPath id="${p}-sc"><path d="${screen}"/></clipPath>`,
    `<clipPath id="${p}-sh"><path d="${shell}"/></clipPath>`,
  ];
  const ant = (x, y, c, cLo) => [
    path(`M512 268L${P(x, y)}`, { stroke: ink, strokeWidth: 52, strokeLinecap: 'round' }),
    path(`M512 268L${P(x, y)}`, { stroke: '#b9a8d6', strokeWidth: 20, strokeLinecap: 'round' }),
    path(circle(x, y, 58), { fill: c, stroke: ink, strokeWidth: SW }),
    path(`M${P(x - 30, y + 30)}A58 58 0 0 0 ${P(x + 46, y - 16)}`, { fill: 'none', stroke: cLo, strokeWidth: 22, strokeLinecap: 'round' }),
    path(circle(x - 20, y - 20, 15), { fill: '#fff' }),
  ].join('');
  const kay = kayBlob(512, 682, 218, `${p}k`, { sw: 15, squash: 0.9 });
  defs.push(kay.defs);
  const body = [
    // antennas and their dome
    ant(286, 104, PAL.cyan, PAL.cyanLo), ant(752, 84, PAL.coin, PAL.coinLo),
    path(rr(420, 214, 184, 90, [70, 70, 0, 0]), { fill: PAL.pinkLo, stroke: ink, strokeWidth: SW }),
    // feet
    path(rr(214, 860, 130, 92, 30), { fill: PAL.pinkDeep, stroke: ink, strokeWidth: SW }),
    path(rr(680, 860, 130, 92, 30), { fill: PAL.pinkDeep, stroke: ink, strokeWidth: SW }),
    // shell: outline, fill, cel shade (bottom-right), highlight (top-left)
    path(shell, { fill: `url(#${p}-shell)`, stroke: ink, strokeWidth: SW * 1.6 }),
    g({ clipPath: `url(#${p}-sh)` },
      path(shell + rr(66, 226, 840, 640, 170), { fill: PAL.pinkLo, fillRule: 'evenodd' }),
      path(`M150 520C150 380 230 310 380 304`, { fill: 'none', stroke: PAL.pinkHi, strokeWidth: 40, strokeLinecap: 'round' }),
      path(circle(176, 590, 18), { fill: PAL.pinkHi })),
    path(shell, { fill: 'none', stroke: ink, strokeWidth: SW }),
    // bezel details: heart LED and speaker slits
    path(heart(512, 832, 22), { fill: PAL.coin, stroke: ink, strokeWidth: 10 }),
    ...[0, 1, 2].map((i) => path(rr(704 + i * 34, 806, 16, 54, 8), { fill: PAL.pinkDeep })),
    ...[0, 1, 2].map((i) => path(rr(256 + i * 34, 806, 16, 54, 8), { fill: PAL.pinkDeep })),
    // screen recess
    path(rr(S.x - 34, S.y - 34, S.w + 68, S.h + 68, S.r + 34), { fill: PAL.pinkDeep, stroke: ink, strokeWidth: 14 }),
    path(screen, { fill: `url(#${p}-scr)` }),
    g({ clipPath: `url(#${p}-sc)` },
      path(rr(S.x, S.y, S.w, S.h, 0), { fill: `url(#${p}-glow)` }),
      ...[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => path(`M${S.x} ${S.y + 20 + i * 40}H${S.x + S.w}`, { stroke: '#ffffff', strokeWidth: 6, opacity: 0.16 })),
      path(sparkle(316, 440, 34), { fill: '#fff' }), path(sparkle(712, 416, 18), { fill: '#fff' }),
      kay.body, kayFace(512, 664, 218, 'happy', `${p}k`),
      path(poly([[S.x, S.y + 150], [S.x + 150, S.y], [S.x + 230, S.y], [S.x, S.y + 230]]), { fill: '#fff', opacity: 0.22 })),
    path(screen, { fill: 'none', stroke: ink, strokeWidth: SW }),
    // paws resting on the screen lip, in front of the bezel
    paw(366, 768, 64, 44, 15, -10), paw(658, 768, 64, 44, 15, 10),
  ].join('');
  return { defs: defs.join(''), body };
}

const svg = (w, h, defs, body, extra = '') =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"${extra}>\n<defs>${defs}</defs>\n${body}\n</svg>\n`;

/** The vector mark, 1024 x 1024 (transparent). */
function markSvg(p = 'm') { const { defs, body } = markParts(p); return svg(1024, 1024, defs, body); }

// ---- wordmark -------------------------------------------------------------------------------------
// Chunky 7 x 9 pixel letters with 2 px stems, drawn as rects: cel-split face (light top, pink bottom),
// a 2 px pink extrusion below and a 1 px ink outline around everything (reads on dark and light).

const GLYPHS = {
  K: ['XX...XX', 'XX..XX.', 'XX.XX..', 'XXXX...', 'XXX....', 'XXXX...', 'XX.XX..', 'XX..XX.', 'XX...XX'],
  A: ['..XXX..', '.XXXXX.', 'XX...XX', 'XX...XX', 'XXXXXXX', 'XXXXXXX', 'XX...XX', 'XX...XX', 'XX...XX'],
  Y: ['XX...XX', 'XX...XX', 'XX...XX', '.XX.XX.', '..XXX..', '..XXX..', '..XXX..', '..XXX..', '..XXX..'],
  B: ['XXXXXX.', 'XX...XX', 'XX...XX', 'XXXXXX.', 'XXXXXX.', 'XX...XX', 'XX...XX', 'XX...XX', 'XXXXXX.'],
  O: ['.XXXXX.', 'XX...XX', 'XX...XX', 'XX...XX', 'XX...XX', 'XX...XX', 'XX...XX', 'XX...XX', '.XXXXX.'],
  R: ['XXXXXX.', 'XX...XX', 'XX...XX', 'XX...XX', 'XXXXXX.', 'XXXX...', 'XX.XX..', 'XX..XX.', 'XX...XX'],
  // digits and the few extra letters the badges use ("LV", "H")
  0: ['.XXXXX.', 'XX...XX', 'XX...XX', 'XX.X.XX', 'XX.X.XX', 'XX.X.XX', 'XX...XX', 'XX...XX', '.XXXXX.'],
  1: ['..XXX..', '.XXXX..', 'XX.XX..', '...XX..', '...XX..', '...XX..', '...XX..', '...XX..', 'XXXXXXX'],
  2: ['.XXXXX.', 'XX...XX', '.....XX', '.....XX', '...XXX.', '..XX...', '.XX....', 'XX.....', 'XXXXXXX'],
  3: ['XXXXXX.', '.....XX', '.....XX', '.....XX', '..XXXX.', '.....XX', '.....XX', '.....XX', 'XXXXXX.'],
  4: ['....XX.', '...XXX.', '..XXXX.', '.XX.XX.', 'XX..XX.', 'XXXXXXX', '....XX.', '....XX.', '....XX.'],
  5: ['XXXXXXX', 'XX.....', 'XX.....', 'XXXXXX.', '.....XX', '.....XX', '.....XX', 'XX...XX', '.XXXXX.'],
  6: ['.XXXXX.', 'XX...XX', 'XX.....', 'XXXXXX.', 'XX...XX', 'XX...XX', 'XX...XX', 'XX...XX', '.XXXXX.'],
  7: ['XXXXXXX', '.....XX', '.....XX', '....XX.', '...XX..', '..XX...', '..XX...', '..XX...', '..XX...'],
  8: ['.XXXXX.', 'XX...XX', 'XX...XX', 'XX...XX', '.XXXXX.', 'XX...XX', 'XX...XX', 'XX...XX', '.XXXXX.'],
  9: ['.XXXXX.', 'XX...XX', 'XX...XX', 'XX...XX', '.XXXXXX', '.....XX', '.....XX', 'XX...XX', '.XXXXX.'],
  L: ['XX.....', 'XX.....', 'XX.....', 'XX.....', 'XX.....', 'XX.....', 'XX.....', 'XX.....', 'XXXXXXX'],
  V: ['XX...XX', 'XX...XX', 'XX...XX', 'XX...XX', 'XX...XX', 'XX...XX', '.XX.XX.', '.XX.XX.', '..XXX..'],
  H: ['XX...XX', 'XX...XX', 'XX...XX', 'XX...XX', 'XXXXXXX', 'XX...XX', 'XX...XX', 'XX...XX', 'XX...XX'],
  ' ': ['.......', '.......', '.......', '.......', '.......', '.......', '.......', '.......', '.......'],
};
const WM = { gw: 7, gh: 9, gap: 2, depth: 2, pad: 1 };

/** Pixel layers of a word: { w, h, layers: [[color, Set('x,y')]] } back to front, on an integer grid. */
function wordPixels(word = 'KAYBORO', { face = [PAL.kay, '#ffd2f2'], side = PAL.pink, ink = PAL.ink, split = 5 } = {}) {
  const { gw, gh, gap, depth, pad } = WM, letters = new Set();
  [...word].forEach((ch, i) => (GLYPHS[ch] || (() => { throw new Error(`no glyph for "${ch}"`); })()).forEach((row, y) => [...row].forEach((c, x) => {
    if (c === 'X') letters.add(`${pad + i * (gw + gap) + x},${pad + y}`);
  })));
  // Extrude only into the open air around the word (flood from the border), so counters stay clean and dark.
  const w = word.length * (gw + gap) - gap + 2 * pad, h = gh + depth + 2 * pad, air = new Set(), st = ['0,0'];
  while (st.length) {
    const k = st.pop(), [x, y] = k.split(',').map(Number);
    if (air.has(k) || letters.has(k) || x < 0 || y < 0 || x >= w || y >= h) continue;
    air.add(k); st.push(`${x - 1},${y}`, `${x + 1},${y}`, `${x},${y - 1}`, `${x},${y + 1}`);
  }
  const ext = new Set();
  for (const k of letters) {
    const [x, y] = k.split(',').map(Number);
    for (let d = 1; d <= depth; d++) { const q = `${x},${y + d}`; if (letters.has(q)) break; if (air.has(q)) ext.add(q); }
  }
  const solid = new Set([...letters, ...ext]), line = new Set();
  for (const k of solid) {
    const [x, y] = k.split(',').map(Number);
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) if (!solid.has(`${x + i},${y + j}`)) line.add(`${x + i},${y + j}`);
  }
  const top = new Set([...letters].filter((k) => +k.split(',')[1] < pad + split)), bottom = new Set([...letters].filter((k) => !top.has(k)));
  return { w, h, layers: [[ink, line], [side, ext], [face[1], bottom], [face[0], top]] };
}

/** Pixel layers -> SVG paths (each pixel run merged per row), scaled by u, offset (ox, oy). */
function pixelPaths({ layers }, u = 1, ox = 0, oy = 0) {
  return layers.map(([c, set]) => {
    const rows = new Map();
    for (const k of set) { const [x, y] = k.split(',').map(Number); if (!rows.has(y)) rows.set(y, []); rows.get(y).push(x); }
    let d = '';
    for (const [y, xs] of [...rows].sort((a, b) => a[0] - b[0])) {
      xs.sort((a, b) => a - b);
      for (let i = 0; i < xs.length;) {
        let j = i; while (j + 1 < xs.length && xs[j + 1] === xs[j] + 1) j++;
        d += `M${P(ox + xs[i] * u, oy + y * u)}h${P((xs[j] - xs[i] + 1) * u)}v${P(u)}h${P(-(xs[j] - xs[i] + 1) * u)}z`;
        i = j + 1;
      }
    }
    return d ? `<path fill="${c}" d="${d}"/>` : '';
  }).join('');
}
const wordBox = (wp, u) => ({ w: wp.w * u, h: wp.h * u });

/** "KAYBORO" wordmark; u = size of one pixel. */
function wordmarkSvg(u = 16, o = {}) {
  const wp = wordPixels('KAYBORO', o), { w, h } = wordBox(wp, u);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" shape-rendering="crispEdges">${pixelPaths(wp, u)}</svg>\n`;
}

/** Mark + wordmark. Horizontal: mark at 1.9x the wordmark height, left. Stacked: mark centred above. */
function lockupParts({ stacked = false, u = 16, p = 'l' } = {}) {
  const wp = wordPixels(), wb = wordBox(wp, u), m = markParts(p);
  const ms = stacked ? wb.w * 0.5 : wb.h * 1.9, gap = stacked ? u * 2 : u * 3;
  const W = stacked ? wb.w : ms + gap + wb.w, H = stacked ? ms + gap + wb.h : ms;
  const mx = stacked ? (W - ms) / 2 : 0, wx = stacked ? 0 : ms + gap, wy = stacked ? ms + gap : (H - wb.h) / 2 + u * 0.5;
  const body = `<g transform="translate(${P(mx, 0)}) scale(${P(ms / 1024)})">${m.body}</g>`
    + `<g transform="translate(${P(wx, wy)})" shape-rendering="crispEdges">${pixelPaths(wp, u)}</g>`;
  return { W: Math.ceil(W), H: Math.ceil(H), defs: m.defs, body };
}
function lockupSvg(o = {}) { const l = lockupParts(o); return svg(l.W, l.H, l.defs, l.body); }

// ---- the mascot -----------------------------------------------------------------------------------
// Kay full body in a 1024 box. Poses: wave (default), cheer, sleep, coin, peek (= the mark).

function kayPose(pose = 'wave', p = 'kp') {
  const cx = 512, cy = 560, R = 300, sw = 20, ink = PAL.ink, out = [], defs = [];
  const k = kayBlob(cx, cy, R, p, { sw, squash: pose === 'sleep' ? 0.82 : 0.92 });
  defs.push(k.defs);
  out.push(path(ellipse(cx, 905, 250, 34), { fill: '#000', opacity: 0.28 }));
  out.push(paw(cx - 150, 868, 92, 58, sw), paw(cx + 150, 868, 92, 58, sw));
  const arm = { wave: [[-300, 640, -20], [300, 330, -35]], cheer: [[-290, 300, 30], [290, 300, -30]], sleep: [[-210, 720, 20], [210, 720, -20]],
    coin: [[-120, 700, 10], [120, 700, -10]] }[pose] || [[-300, 640, -20], [300, 640, 20]];
  out.push(k.body);
  if (pose === 'coin') { // a big gold coin hugged in front of the belly
    out.push(path(circle(cx, 690, 120), { fill: PAL.coin, stroke: ink, strokeWidth: sw }),
      path(circle(cx, 690, 82), { fill: 'none', stroke: PAL.coinLo, strokeWidth: 16 }),
      path(rr(cx - 16, 640, 32, 100, 10), { fill: PAL.coinLo }),
      path(`M${P(cx - 66, 640)}A82 82 0 0 1 ${P(cx + 20, 610)}`, { fill: 'none', stroke: '#fff3c4', strokeWidth: 16, strokeLinecap: 'round' }));
  }
  out.push(kayFace(cx, cy - 20, R, { wave: 'happy', cheer: 'wink', sleep: 'sleep', coin: 'happy' }[pose] || 'happy', p));
  for (const [dx, y, rot] of arm) out.push(paw(cx + dx, y, 70, 56, sw, rot));
  if (pose === 'wave') out.push(...[0, 1].map((i) => path(`M${P(905 + i * 40, 230 + i * 30)}Q${P(930 + i * 40, 290 + i * 30)} ${P(905 + i * 40, 350 + i * 30)}`,
    { fill: 'none', stroke: PAL.cyan, strokeWidth: 18, strokeLinecap: 'round' })));
  if (pose === 'cheer') out.push(path(sparkle(160, 170, 60), { fill: PAL.coin }), path(sparkle(880, 140, 44), { fill: PAL.cyan }), path(sparkle(900, 420, 30), { fill: PAL.pink }));
  if (pose === 'sleep') {
    const z = (x, y, s) => path(`M${P(x, y)}h${P(s)}l${P(-s, s)}h${P(s)}`, { fill: 'none', stroke: PAL.cyan, strokeWidth: s * 0.22, strokeLinecap: 'round', strokeLinejoin: 'round' });
    out.push(z(780, 210, 70), z(880, 120, 48));
  }
  return { defs: defs.join(''), body: out.join('') };
}

function mascotSvg(pose = 'wave') { const k = kayPose(pose); return svg(1024, 1024, k.defs, k.body); }

/** All poses side by side (each 1024 wide) plus the peeking mark; transparent. */
function poseSheetSvg() {
  const poses = ['wave', 'cheer', 'coin', 'sleep'];
  let defs = '', body = '';
  poses.forEach((ps, i) => { const k = kayPose(ps, `ps${i}`); defs += k.defs; body += `<g transform="translate(${i * 1024} 0)">${k.body}</g>`; });
  const m = markParts('psm'); defs += m.defs; body += `<g transform="translate(${poses.length * 1024 + 80} 80) scale(.84)">${m.body}</g>`;
  return svg((poses.length + 1) * 1024, 1024, defs, body);
}

module.exports = { PAL, GLYPHS, kayFace, kayBlob, paw, markParts, markSvg, wordPixels, pixelPaths, wordBox, wordmarkSvg, lockupParts, lockupSvg, kayPose, mascotSvg, poseSheetSvg, svg };
