# Art tools for the vector shells

The vector shells are built in Node from `tools/vectorart/frames/<id>.js`. Everything has to run at build time,
deterministically (seeded), with no network, no GPU and nothing installed on the system drive. This page lists
the tools we looked at for making richer vector art and what we chose.

## Adopted (devDependencies, build time only, nothing ships in the app)

| Package | Version | License | Used for |
| --- | --- | --- | --- |
| [d3-delaunay](https://github.com/d3/d3-delaunay) | 6.0.4 | ISC (deps: delaunator ISC, robust-predicates Unlicense) | Voronoi mosaics. `vx-stained-glass` mirrors a few seeds into a 12-fold (rose), 6-fold (spandrel roses) or bilateral (lancets) point set, so the Voronoi cells themselves are symmetric, like real cut-and-leaded glass. |
| [simplex-noise](https://github.com/jwagner/simplex-noise.js) | 4.0.3 | MIT | Seeded coherent noise (`createNoise2D(rng(seed))`) to pick each glass piece's colour and its small hue and lightness shifts, so neighbouring pieces vary smoothly instead of randomly. |
| [chroma-js](https://github.com/gka/chroma.js) | 3.2.0 | BSD-3-Clause and Apache-2.0 | Palette work: hue shifts in HSL and perceptual `brighten` / `darken` to build the light-to-dark stops of each glass colour from one base swatch. |

All three are ordinary `require()`s from the frame modules (`d3-delaunay` is ESM-only; Node 22.12+ and Electron
load it through `require(esm)`). Seeds come from `lib.rng`, so a rebuild produces byte-identical SVG.

Pattern for symmetric mosaics: put each seed's mirrored and rotated copies in the point set with the same group
key, then concatenate the cells of a group into one `<path>`. A rose of 21 seeds x 24 copies is 21 paths (one
gradient each), which keeps files small while the glass still reads as hundreds of pieces.

## Evaluated, not adopted

| Tool | License | Why not (for now) |
| --- | --- | --- |
| [StarVector](https://github.com/joanrod/star-vector) (CVPR 2025, image/text to SVG) | Apache-2.0 | Python + an 1B to 8B parameter model on a GPU. Too heavy for this pipeline, and its output is hard to keep within our hole contract and size budget. Could be useful offline for rough reference sketches. |
| [SVGDreamer](https://github.com/ximinng/SVGDreamer) (CVPR 2024, text to SVG) | see repo (research code) | Diffusion + differentiable rasterizer (diffvg), PyTorch/CUDA. Same weight problem; outputs are thousands of small paths. |
| VectorFusion (text to SVG via score distillation) | research code | Same stack as SVGDreamer, slower; no maintained official repo. |
| [vtracer](https://github.com/visioncortex/vtracer) (raster to vector) | MIT | Good tracer (Rust, has a WASM build). Only useful if we start from painted raster art; our shells are authored procedurally, and traced output is large. Worth revisiting for importing hand-painted ornaments. |
| potrace | GPL-2.0 | License is not compatible with shipping the output under CC-BY without care; skip. |
| [svgo](https://github.com/svg/svgo) | MIT | Would shave bytes, but rewrites ids and path data that `test/frames-vector.test.js` parses (the hole cut). The modules already round to 0.1 to 0.01 px. |
| [paper.js](https://github.com/paperjs/paper.js) boolean ops | MIT | Real path unions/subtractions would clean up lobed bridges, but needs a canvas/DOM shim in Node; even-odd fills and layered strokes cover our cases. |
| [rough.js](https://github.com/rough-stuff/rough) | MIT | Hand-drawn look; wrong style for these shells. Could suit a sketchbook shell. |

## How the three reworked shells use them

- `vx-stained-glass` (Rose Window): d3-delaunay + simplex-noise + chroma-js for all glass (great rose, two
  spandrel roses, two lancets).
- `vx-art-deco-noir` and `vx-horology`: pure geometry from `tools/vectorart/lib.js` (radial wedges, gear teeth,
  spirals); no extra packages needed.

## Ink Dragon and Botanical Plate (brush and engraving)

| Tool | Version | License | Used for |
| --- | --- | --- | --- |
| [perfect-freehand](https://github.com/steveruizok/perfect-freehand) | 1.2.3 | MIT | Pressure-sensitive stroke outlines (`getStroke` with `thinning: 1`, explicit per-point pressure, no simulated pressure, so output is deterministic). `vx-ink-dragon`: every brush stroke, plus dry-brush "flying white" built from 3 to 7 bristle bundles per stroke that skip where seeded noise says the brush ran dry. `vx-botanical-engraving`: swelling burin contours on leaves and tepals. |
| simplex-noise (above) | 4.0.3 | MIT | Hand tremor in brush pressure, dry-brush gaps, ridge lines of the ink-wash peaks, the sun's rough edge; hatch-reach variation on leaves. |

Techniques that needed no package (in the modules): Ramer-Douglas-Peucker simplification of stroke outlines,
relative-coordinate path writing on a coarse grid (roughly halves file size), contour hatching laid along a
leaf's own (u along midrib, v across) parameterisation so lines follow the veins, Poisson-disc stipple with a
lighting density function, and gradient-mask fades where the dragon dives into cloud. Both shells dropped their
displacement filters; each keeps one paper/silk `feTurbulence` mottle.
