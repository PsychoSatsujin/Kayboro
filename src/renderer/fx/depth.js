// Shell depth. Shells stay flat images on screen, but each one gets a height map grown from its own
// silhouette, so it is lit like a moulded 3D part:
//   height   distance to the shell's edge (outer outline and the screen opening) shaped by a cubic Bezier
//            bevel (a rounded lip that flattens into the face), a soft dome over the whole body and a
//            little relief from the art itself (buttons, grilles and seams stand out a touch)
//   light    shading overlay for solid shells: bevels facing the light (top left) catch it and glint,
//            the ones facing away fall into shade, flat faces stay as drawn
//   glass    the overlay for see-through shells: bright Fresnel rims, a caustic band where light
//            focuses inside the far edge, and plastic that looks thicker toward its edges
//   refract  displacement map (R = x, G = y, 128 = none) for the shell fill behind clear plastic: near
//            the edges it samples from further in, so the fill bends as if held in a curved shell
//   refractEdge  the same from the bevel alone (no dome or relief): edges bend, the flat body does not
//   edge     mask that keeps a band along every edge (and everything off the shell) and lets the body go,
//            so "fill clarity" can clear the shell's face over the fill without touching its rims
// Pixel shells are computed on their own pixel grid with stepped light, so they stay pixel art.
// depthMaps() is pure (unit-tested); shellDepth() renders it from a frame URL into cached object URLs.

const ALPHA_IN = 102; // alpha (0..255) that counts as shell; soft shadows and glows below it stay flat
const LIGHT = norm([-0.55, -0.75, 0.95]);
const HALF = norm([LIGHT[0], LIGHT[1], LIGHT[2] + 1]); // Blinn half vector for a viewer straight ahead

function norm(v) { const l = Math.hypot(...v) || 1; return v.map(c => c / l); }
const clamp01 = v => (v < 0 ? 0 : v > 1 ? 1 : v);
// The bevel profile: the cubic Bezier from (0,0) through control points (0,.9) and (.35,1) to (1,1),
// approximated by its y(x) (an ease-out that leaves the edge steeply and lands flat on the face).
const bevel = t => { const u = 1 - clamp01(t); return 1 - u * u * u; };
// Drop shadows under a shell are dark and see-through; translucent plastic is coloured. Shadows stay flat
// (and the body's edge above them keeps its bevel).
export const isShadow = (a, luma) => a < 0.72 && luma < 0.16;

// Squared Euclidean distance transform, one dimension (Felzenszwalb & Huttenlocher).
function dt1(f, n, d, v, z) {
  let k = 0;
  v[0] = 0; z[0] = -Infinity; z[1] = Infinity;
  for (let q = 1; q < n; q++) {
    let s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
    while (s <= z[k]) { k--; s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]); }
    k++; v[k] = q; z[k] = s; z[k + 1] = Infinity;
  }
  k = 0;
  for (let q = 0; q < n; q++) { while (z[k + 1] < q) k++; const r = q - v[k]; d[q] = r * r + f[v[k]]; }
}

/** Distance (px) from every inside pixel to the nearest outside one; the image border counts as outside. */
export function distanceField(inside, W, H) {
  const PW = W + 2, PH = H + 2, BIG = 1e12, g = new Float64Array(PW * PH);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (inside[y * W + x]) g[(y + 1) * PW + x + 1] = BIG;
  const n = Math.max(PW, PH), f = new Float64Array(n), d = new Float64Array(n), v = new Int32Array(n), z = new Float64Array(n + 1);
  for (let x = 0; x < PW; x++) {
    for (let y = 0; y < PH; y++) f[y] = g[y * PW + x];
    dt1(f, PH, d, v, z);
    for (let y = 0; y < PH; y++) g[y * PW + x] = d[y];
  }
  for (let y = 0; y < PH; y++) {
    const o = y * PW;
    for (let x = 0; x < PW; x++) f[x] = g[o + x];
    dt1(f, PW, d, v, z);
    for (let x = 0; x < PW; x++) g[o + x] = d[x];
  }
  const out = new Float32Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) out[y * W + x] = Math.sqrt(g[(y + 1) * PW + x + 1]);
  return out;
}

// Box blur (radius r) of a W x H float map, two separable passes.
function blur(src, W, H, r) {
  if (r < 1) return src.slice();
  const tmp = new Float32Array(W * H), out = new Float32Array(W * H), n = 2 * r + 1;
  for (let y = 0; y < H; y++) {
    let acc = 0;
    for (let x = -r; x <= r; x++) acc += src[y * W + Math.min(W - 1, Math.max(0, x))];
    for (let x = 0; x < W; x++) {
      tmp[y * W + x] = acc / n;
      acc += src[y * W + Math.min(W - 1, x + r + 1)] - src[y * W + Math.max(0, x - r)];
    }
  }
  for (let x = 0; x < W; x++) {
    let acc = 0;
    for (let y = -r; y <= r; y++) acc += tmp[Math.min(H - 1, Math.max(0, y)) * W + x];
    for (let y = 0; y < H; y++) {
      out[y * W + x] = acc / n;
      acc += tmp[Math.min(H - 1, y + r + 1) * W + x] - tmp[Math.max(0, y - r) * W + x];
    }
  }
  return out;
}

/**
 * Depth maps for a shell. `rgba` is its RGBA pixels (W x H). Returns { light, glass, refract } as RGBA
 * Uint8ClampedArrays of the same size, plus `bevel` (px) and `height` (Float32Array, px).
 * opts.pixel: pixel-art grid (a narrower bevel, light in steps); opts.relief: art relief strength (0..1).
 */
export function depthMaps(rgba, W, H, { pixel = false, relief = 0.5 } = {}) {
  const N = W * H, inside = new Uint8Array(N), luma = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const p = i * 4;
    luma[i] = (0.2126 * rgba[p] + 0.7152 * rgba[p + 1] + 0.0722 * rgba[p + 2]) / 255;
    inside[i] = rgba[p + 3] >= ALPHA_IN && !isShadow(rgba[p + 3] / 255, luma[i]) ? 1 : 0;
  }
  const dist = distanceField(inside, W, H);
  let dmax = 0;
  for (let i = 0; i < N; i++) if (dist[i] > dmax) dmax = dist[i];
  const R = Math.max(pixel ? 2 : 3, Math.min(W, H) * (pixel ? 0.035 : 0.045), 1e-3);
  // Relief: the art's local contrast, softened, so drawn details read as slightly raised.
  const soft = blur(luma, W, H, Math.max(1, Math.round(R / 3))), fine = pixel ? luma : blur(luma, W, H, 1);
  const height = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    if (!inside[i]) continue;
    const t = dist[i] / R, dome = dmax > 0 ? Math.sqrt(Math.min(1, dist[i] / dmax)) : 0;
    height[i] = R * (0.9 * bevel(t) + 0.35 * dome) + R * 0.18 * relief * (fine[i] - soft[i]) * Math.min(1, t);
  }

  const light = new Uint8ClampedArray(N * 4), glass = new Uint8ClampedArray(N * 4), refract = new Uint8ClampedArray(N * 4);
  const refractEdge = new Uint8ClampedArray(N * 4), edge = new Uint8ClampedArray(N * 4);
  const lipAt = (j, ok) => (ok && inside[j] ? R * 0.9 * bevel(dist[j] / R) : 0); // bevel-only height
  const flatSpec = Math.pow(HALF[2], 48), STEP = 3, LIT = pixel ? 0.36 : 0.5;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x, p = i * 4;
      refract[p] = refract[p + 1] = refract[p + 2] = 128; refract[p + 3] = 255;
      refractEdge[p] = refractEdge[p + 1] = refractEdge[p + 2] = 128; refractEdge[p + 3] = 255;
      edge[p + 3] = 255; // off the shell: kept
      if (!inside[i]) continue;
      const te = dist[i] / R; // the band: the whole bevel, fading out over the next 0.8 of its width
      edge[p + 3] = 255 * (1 - clamp01((te - 1) / 0.8));
      // Height of a neighbour; outside the shell it is 0 (the drop to the background or the opening).
      const at = (j, ok) => (ok && inside[j] ? height[j] : 0);
      const gx = (at(i + 1, x < W - 1) - at(i - 1, x > 0)) / 2, gy = (at(i + W, y < H - 1) - at(i - W, y > 0)) / 2;
      const n = norm([-gx, -gy, 1]);
      const diffuse = n[0] * LIGHT[0] + n[1] * LIGHT[1] + n[2] * LIGHT[2] - LIGHT[2]; // 0 on a flat face
      const spec = Math.max(0, Math.pow(Math.max(0, n[0] * HALF[0] + n[1] * HALF[1] + n[2] * HALF[2]), 48) - flatSpec);
      const rim = (1 - n[2]) * (1 - n[2]);
      const a = rgba[p + 3] / 255, t = clamp01(dist[i] / R);

      let lv = diffuse * 1.25 + spec * 1.4;
      if (pixel) lv = Math.round(lv * STEP) / STEP;
      if (lv > 0) { light[p] = light[p + 1] = light[p + 2] = 255; light[p + 3] = 255 * a * Math.min(LIT, lv * LIT); }
      else { light[p] = 26; light[p + 1] = 18; light[p + 2] = 46; light[p + 3] = 255 * a * Math.min(0.42, -lv * 0.42); }

      // Glass: highlights and rims carry it, shade is light; a caustic glow sits just inside the edge
      // facing away from the light; the plastic thickens (whitens) toward every edge.
      const caustic = diffuse < 0 ? Math.max(0, 1 - Math.abs(t - 0.62) / 0.28) * Math.min(1, -diffuse * 3) : 0;
      let gv = Math.max(0, diffuse) * 1.1 + spec * 2.2 + rim * 0.45 + caustic * 0.35 + (1 - t) * 0.08;
      if (pixel) gv = Math.round(gv * STEP) / STEP;
      const shade = Math.max(0, -diffuse) * 0.25;
      if (gv >= shade) { glass[p] = 255; glass[p + 1] = 252; glass[p + 2] = 255; glass[p + 3] = 255 * a * Math.min(0.78, gv * 0.7); }
      else { glass[p] = 30; glass[p + 1] = 26; glass[p + 2] = 60; glass[p + 3] = 255 * a * Math.min(0.25, shade); }

      // Refraction samples inward (up the slope), strongest on the steep lip, none on flat faces.
      const k = 1 / 2.8;
      refract[p] = 128 + 127 * Math.max(-1, Math.min(1, gx * k));
      refract[p + 1] = 128 + 127 * Math.max(-1, Math.min(1, gy * k));
      const ex = (lipAt(i + 1, x < W - 1) - lipAt(i - 1, x > 0)) / 2, ey = (lipAt(i + W, y < H - 1) - lipAt(i - W, y > 0)) / 2;
      refractEdge[p] = 128 + 127 * Math.max(-1, Math.min(1, ex * k));
      refractEdge[p + 1] = 128 + 127 * Math.max(-1, Math.min(1, ey * k));
    }
  }
  return { light, glass, refract, refractEdge, edge, bevel: R, height };
}

// ---- Browser side: frame URL -> cached object URLs ---------------------------------------------

const MAX_SIDE = 640; // compute size for vector shells (the overlay is smooth, so it scales up cleanly)
const cache = new Map();

/**
 * Depth overlays for a frame: Promise<{ light, glass, refract, refractEdge, edge, bevel } | null>, URLs of PNGs at the
 * compute size (bevel in fractions of the shorter side). `grid` ({w, h}): a pixel shell's own grid.
 */
export function shellDepth(frameUrl, { grid = null } = {}) {
  const key = `${frameUrl}|${grid ? `${grid.w}x${grid.h}` : ''}`;
  if (!cache.has(key)) cache.set(key, render(frameUrl, grid).catch(() => null));
  return cache.get(key);
}

async function render(frameUrl, grid) {
  const img = new Image();
  img.decoding = 'async';
  img.src = frameUrl;
  await img.decode();
  const nw = img.naturalWidth || grid?.w, nh = img.naturalHeight || grid?.h;
  if (!nw || !nh) return null;
  const pixel = !!grid?.w, k = pixel ? 1 : Math.min(1.5, MAX_SIDE / Math.max(nw, nh));
  const W = Math.max(8, Math.round(pixel ? grid.w : nw * k)), H = Math.max(8, Math.round(pixel ? grid.h : nh * k));
  const c = document.createElement('canvas');
  Object.assign(c, { width: W, height: H });
  const g = c.getContext('2d', { willReadFrequently: true });
  g.imageSmoothingEnabled = !pixel;
  g.drawImage(img, 0, 0, W, H);
  const maps = depthMaps(g.getImageData(0, 0, W, H).data, W, H, { pixel });
  const png = async data => {
    g.putImageData(new ImageData(data, W, H), 0, 0);
    const b = await new Promise(res => c.toBlob(res));
    return b && URL.createObjectURL(b);
  };
  const urls = {};
  for (const k of ['light', 'glass', 'refract', 'refractEdge', 'edge']) if (!(urls[k] = await png(maps[k]))) return null;
  return { ...urls, bevel: maps.bevel / Math.min(W, H) };
}
