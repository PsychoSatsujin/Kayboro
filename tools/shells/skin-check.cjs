'use strict';
// Checks that a skin SVG keeps its base shell's geometry exactly (no deps; used by
// tools/shells/build-skins.mjs and test/skins.test.js):
//   pixel skins  - rasterized from their rect paths: same viewBox, every pixel of the opening (with the
//                  base's pixel-rounded corners) transparent, a solid ring round it, and the transparent
//                  region around its center is exactly the opening; see-through pixels iff the base has them.
//   vector skins - same viewBox and the identical even-odd "shell-cut" clip path as the base SVG, with all
//                  artwork inside the clipped group.
// Each returns a list of problems (empty = OK).

const cuts = (r) => Array.from({ length: r }, (_, i) => Math.ceil(r - Math.sqrt(r * r - (r - i) ** 2) - 1e-9));
const near = (v) => Math.abs(v - Math.round(v)) < 1e-6;

/** Rasterize a pixel SVG: any = covered by some path, solid = covered by an opaque path outside animation groups. */
function raster(svg, W, H) {
  const any = new Uint8Array(W * H), solid = new Uint8Array(W * H), problems = [];
  const base = svg.replace(/<g[\s\S]*?<\/g>/g, '');
  for (const [src, tgt] of [[svg, any], [base, solid]]) {
    for (const m of src.matchAll(/<path ([^>]*)\/>/g)) {
      if (tgt === solid && /fill-opacity/.test(m[1])) continue;
      const d = (/d="([^"]*)"/.exec(m[1]) || [])[1] || '';
      if (d.replace(/M\d+ \d+h\d+v\d+h-\d+z/g, '')) { problems.push('path data must be rects only'); continue; }
      for (const [, x, y, w, h] of d.matchAll(/M(\d+) (\d+)h(\d+)v(\d+)h-\d+z/g)) {
        for (let j = +y; j < +y + +h; j++) for (let i = +x; i < +x + +w; i++) {
          if (i >= W || j >= H) { problems.push(`rect outside the viewBox at ${i},${j}`); continue; }
          tgt[j * W + i] = 1;
        }
      }
    }
  }
  return { any, solid, problems: [...new Set(problems)] };
}

/** Pixel geometry of a catalog frame item: { W, H, x, y, w, h, r } in logical pixels. */
function pixelGeometry(item) {
  const { w: W, h: H } = item.size, g = { W, H, x: item.hole.x * W, y: item.hole.y * H, w: item.hole.w * W, h: item.hole.h * H };
  g.r = item.holeRadius * g.w;
  for (const k of Object.keys(g)) if (!near(g[k])) throw new Error(`${item.id}: ${k} ${g[k]} is not a whole pixel`);
  for (const k of Object.keys(g)) g[k] = Math.round(g[k]);
  return g;
}

function pixelSkinProblems(svg, base) {
  const { W, H, x: hx, y: hy, w: hw, h: hh, r } = pixelGeometry(base), out = [];
  if (!new RegExp(`viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"`).test(svg)) out.push(`viewBox/size must be the base's ${W}x${H}`);
  if (!/shape-rendering="crispEdges"/.test(svg)) out.push('missing crispEdges');
  if (/href|url\(|https?:|<script|@import/i.test(svg.replace('xmlns="http://www.w3.org/2000/svg"', ''))) out.push('not self-contained');
  const { any, solid, problems } = raster(svg, W, H), c = cuts(r);
  out.push(...problems);
  let leaks = 0, rim = 0;
  for (let j = 0; j < hh; j++) {
    const b = hh - 1 - j, a = Math.max(j < r ? c[j] : 0, b < r ? c[b] : 0);
    for (let i = a; i < hw - a; i++) if (any[(hy + j) * W + hx + i]) leaks++;
  }
  for (let i = hx; i < hx + hw; i++) for (const j of [hy - 1, hy + hh]) if (!solid[j * W + i]) rim++;
  for (let j = hy; j < hy + hh; j++) for (const i of [hx - 1, hx + hw]) if (!solid[j * W + i]) rim++;
  if (leaks) out.push(`${leaks} painted px inside the opening`);
  if (rim) out.push(`${rim} rim px round the opening are not solid`);
  // The transparent region around the opening's center spans exactly the opening.
  const seen = new Uint8Array(W * H), st = [(hy + (hh >> 1)) * W + hx + (hw >> 1)];
  let x0 = W, y0 = H, x1 = -1, y1 = -1;
  while (st.length) {
    const i = st.pop(), x = i % W, y = (i - x) / W;
    if (seen[i] || any[i]) continue;
    seen[i] = 1; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
    if (x > 0) st.push(i - 1); if (x < W - 1) st.push(i + 1); if (y > 0) st.push(i - W); if (y < H - 1) st.push(i + W);
  }
  const flood = [x0, y0, x1 - x0 + 1, y1 - y0 + 1];
  if (flood.join() !== [hx, hy, hw, hh].join()) out.push(`see-through area ${flood.join(',')} is not the opening ${[hx, hy, hw, hh].join(',')}`);
  if (/fill-opacity/.test(svg) !== !!base.translucent) out.push(base.translucent ? 'base is see-through: keep translucent pixels' : 'base is opaque: no see-through pixels');
  return out;
}

const cutOf = (svg) => (/<clipPath id="shell-cut"><path clip-rule="evenodd" d="([^"]+)"\/><\/clipPath>/.exec(svg) || [])[1] || null;
const rootOf = (svg) => (/<svg\b[^>]*>/.exec(svg) || [''])[0].replace(/\sdata-frame="[^"]*"/, '');

function vectorSkinProblems(svg, baseSvg) {
  const out = [];
  if (rootOf(svg) !== rootOf(baseSvg)) out.push('root <svg> (viewBox/size) differs from the base');
  const a = cutOf(svg), b = cutOf(baseSvg);
  if (!a) out.push('no shell-cut clip path');
  else if (a !== b) out.push('shell-cut clip path differs from the base');
  // All artwork sits inside the one clipped group: <svg><defs>...</defs><g clip-path="url(#shell-cut)">...</g></svg>
  const tail = svg.slice(svg.indexOf('</defs>') + 7).trim();
  if (!tail.startsWith('<g clip-path="url(#shell-cut)">') || !/<\/g>\s*<\/svg>\s*$/.test(tail)) out.push('artwork must sit inside the clipped group');
  if (/<script|<foreignObject|<image|<text|xlink:href|href=|@import|https?:\/\/(?!www\.w3\.org\/2000\/svg)/i.test(svg)) out.push('not self-contained');
  const ids = [...svg.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]);
  const dup = ids.filter((v, i) => ids.indexOf(v) !== i);
  if (dup.length) out.push(`duplicate ids: ${[...new Set(dup)].join(', ')}`);
  for (const [, ref] of svg.matchAll(/url\(#([^)]+)\)/g)) if (!ids.includes(ref)) out.push(`url(#${ref}) is not defined`);
  return out;
}

module.exports = { raster, pixelGeometry, pixelSkinProblems, vectorSkinProblems, cutOf };
