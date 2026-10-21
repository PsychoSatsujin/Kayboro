# Kayboro brand

Everything here is generated from code in `tools/brand/`. Edit the code, re-run the commands at the bottom, and every icon, capsule and sprite comes out again, byte for byte. There are no font files and no hand-exported bitmaps.

## Kay, the mascot

Kay is a small round pastel critter who lives inside shells. Every game you put on the stage is a new window for Kay to peek out of, so the mark is Kay looking out of a tiny pink CRT with two antenna bulbs (one cyan, one gold, like the Kayboro palette). Kay is quiet, curious and easily pleased: a wave, a wink, a hug for a coin, a nap when nothing is playing.

Poses in `assets/brand/kayboro-mascot-sheet.svg`: wave (default, `kayboro-mascot.svg`), cheer, coin, sleep, and peek (the mark). Draw new poses in `tools/brand/art.cjs` (`kayPose`); Kay is always the same blob (`kayBlob`) and face (`kayFace`), only the paws and props move.

## The mark

| File | What | Use it for |
| --- | --- | --- |
| `assets/brand/kayboro-mark.svg` | Vector mark, 1024 box, transparent | Anything 48 px and up: store pages, docs |
| `assets/brand/kayboro-mark-pixel.svg` | 16 px pixel mark, `crispEdges` | 16 px icon, the in-app sprite `#i-logo` |
| `assets/brand/kayboro-mark-pixel-24.svg` | 24 px pixel mark | 24 px icon, the HUD sprite `#i-logo-24` |
| `assets/brand/kayboro-mark-pixel-32.svg` | 32 px pixel mark | 32 px icon; scaled up by whole numbers for the larger app icons |

The three pixel marks are hand-tuned grids in `tools/brand/marks.cjs` (one character per pixel). Below 48 px always use them, scaled by whole numbers only (16 at 2x = 32, never 16 at 1.5x). From 48 px up use the vector mark, except the app icon, which is the pixel mark at every size. `assets/brand/sizes.png` shows all sizes on dark and light.

Cel-shaded house style, same as the shells: flat fills, one hard shade and one highlight per part, ink outlines in `#2a0b22`. The mark works on dark and light backgrounds without a plate.

## The wordmark and the lockup

`assets/brand/kayboro-wordmark.svg` is "KAYBORO" in 7 x 9 pixel letters drawn as rects (`tools/brand/art.cjs`, `GLYPHS`): a two-tone face (cream on top, pink below), a 2 px pink extrusion and a 1 px ink outline. Scale it by whole pixel units (`u`) only.

`assets/brand/kayboro-lockup.svg` (mark left, wordmark right) is the default. `kayboro-lockup-stacked.svg` (mark above, centred) is for tall formats such as the vertical capsule and the library capsule. In the app the wordmark is set in the pixel UI font next to the sprite; both are fine, the drawn wordmark is for places where no font is loaded.

Kayboro is always one word with a capital K, never translated. The wordmark is always all caps.

## Clear space and minimum sizes

- Clear space around the mark and the lockup: the height of one antenna bulb (about 12% of the mark's height) on every side. Nothing else inside it.
- Minimum sizes: mark 16 px (pixel), vector mark 48 px, wordmark 9 px letter height (u = 1), lockup 120 px wide.
- On busy art (capsules, hero) give the lockup a quiet patch of backdrop or a soft dark glow behind it; never a white box.

## Palette

From `DESIGN.md`; `tools/brand/art.cjs` `PAL` carries the same values plus the shade and highlight steps.

| Role | Hex |
| --- | --- |
| Stage background | `#0f0d16` |
| Panel | `#17141f` |
| Ink (outlines, text on pink) | `#2a0b22` |
| Accent pink (shell) | `#ff6ad5` (light `#ffa6ea`, shade `#d9459f`, deep `#9e2b80`) |
| Cyan (screen, focus) | `#7af0ff` (light `#c9fbff`, shade `#3fc0e6`) |
| Coin gold | `#ffd166` (shade `#e0962f`) |
| Kay | `#fff3fa` (shade `#e2c6f0`, blush `#ff8fcf`) |

## Do and don't

Do:
- Use the pixel marks below 48 px and scale them by whole numbers.
- Keep Kay inside a shell in the mark; outside a shell Kay is the mascot, not the logo.
- Put the lockup on the night-arcade backdrop (`steam-assets.cjs`, `backdrop()`) or on a flat `#0f0d16` / `#17141f` / light `#f3f1f7` surface.
- Keep capsules to the lockup plus shells. The name is the only text Steam allows on them.

Don't:
- Recolour the shell or the screen, rotate the mark, or drop the outlines.
- Put text on the library hero; Steam overlays `library_logo.png` on it.
- Put white text on pink, or add a tagline to the lockup.
- Stretch the wordmark or set it in another face. Mixed case "Kayboro" is for sentences, not for the wordmark.

## Files this produces

```
assets/brand/            mark, pixel marks, wordmark, lockups, mascot, pose sheet (SVG + PNG renders), sizes.png
build/icon.ico           16..256 PNG entries, all pixel marks (48 = 24 x 2, 64/128/256 = 32 x 2/4/8), electron-builder picks it up from build/
build/icon.png           1024 x 1024 pixel mark (32 x 32)
src/renderer/assets/icon.png   256 x 256 runtime window icon (pixel mark)
src/renderer/index.html  <symbol id="i-logo"> (16) and <symbol id="i-logo-24"> sprites
steam/assets/            store and library assets + MANIFEST.json (sizes, doc URLs, shells used)
steam/achievement-icons/ <apiName>.jpg + <apiName>_locked.jpg, 256 x 256, from steam/achievements.json
```

Steam sizes (checked against the Steamworks docs, see `steam/assets/MANIFEST.json`): header capsule 920 x 430, small capsule 462 x 174, main capsule 1232 x 706, vertical capsule 748 x 896, page background 1438 x 810, library capsule 600 x 900, library header 920 x 430, library hero 3840 x 1240 (no text), library logo 1280 wide transparent PNG, app icon 184 x 184 JPG, shortcut icon 256 x 256 PNG + ICO. Screenshots (five, 1920 x 1080, gameplay only) are real captures and are not generated here.

## Regenerate

```
npx electron tools/brand/build.cjs                 # assets/brand, build/icon.*, runtime icon, index.html sprites
npx electron tools/brand/steam-assets.cjs          # steam/assets (re-run after new shells land in src/catalog)
npx electron tools/brand/achievement-icons.cjs     # steam/achievement-icons from steam/achievements.json
node --test test/brand.test.js                     # pure checks: grids, wordmark, ico writer, picker, badges
```

`steam-assets.cjs` loads every shell in `src/catalog/frames-*.json` and picks subsets per asset (rarer first, pixel and vector interleaved, `PREFER` ids up front), so new shells show up on the next run. Pass `--only=main,vertical` to redo some files, `--out=DIR` to write elsewhere. `achievement-icons.cjs --fixture` previews the badge style with one achievement per motif.
