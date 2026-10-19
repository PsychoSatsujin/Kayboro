# Modding

Mods add shells, wallpapers, fills and colorways. They are **free, owned automatically and never blocked**: no coins, no review, no signing.

## Install a mod

1. Profile > Settings > Mods > **Open folder** (`<userData>/kayboro/mods/`).
2. Drop the mod folder in.
3. Press **Reload** (or restart Kayboro).

The Mods list shows each mod with its item count. A mod with a broken `mod.json` is skipped and its errors are shown there.

## Folder layout

```
mods/
  example-shell/
    mod.json
    frames/example-shell.svg
    wallpapers/night.mp4
    wallpapers/night.jpg
```

A ready-to-copy example lives in [`examples/mods/example-shell/`](../examples/mods/example-shell/).

## mod.json

```json
{
  "id": "example-shell",
  "name": "Example Shell",
  "author": "You",
  "version": "1.0.0",
  "description": "A simple rounded shell.",
  "frames": [
    {
      "id": "example-shell",
      "name": "Example Shell",
      "kind": "frame",
      "style": "vector",
      "theme": "tv",
      "rarity": "common",
      "file": "frames/example-shell.svg",
      "size": { "w": 1600, "h": 1100 },
      "hole": { "x": 0.1, "y": 0.1, "w": 0.8, "h": 0.6545 },
      "holeRadius": 0.02,
      "aspect": 1.7778,
      "translucent": false,
      "tags": ["mod"]
    }
  ],
  "wallpapers": [
    {
      "id": "night-city",
      "kind": "wallpaper",
      "name": "Night City",
      "media": { "type": "video", "file": "wallpapers/night.mp4" },
      "preview": "wallpapers/night.jpg",
      "credit": { "artist": "You", "source": "Original", "url": "https://example.com" },
      "price": null
    }
  ],
  "fills": [],
  "colorways": []
}
```

- `id`: lowercase letters, digits and dashes. Item ids should be unique across mods.
- `file`, `media.file` and `preview` are **relative to the mod folder**. Kayboro turns them into `file://` URLs.
- `price`, `unlockLevel` and `dlc` are ignored: mod items are always free and owned.
- `media.type`: `video` (MP4/WebM), `image` (PNG/JPG/WebP) or `gif`.

## Shell art rules

- **Format**: SVG, PNG or WebP with alpha.
- **Transparent hole**: the screen opening is alpha 0. The game is drawn behind the shell, so anything opaque covers it.
- **`size`**: the art's width and height in px (the SVG `viewBox`).
- **`hole`**: the opening as **fractions of `size`**: `x`, `y`, `w`, `h` from the top-left. Example: a 1600x1100 shell with the hole at 160,110 sized 1280x720 is `{x:0.1, y:0.1, w:0.8, h:0.6545}`.
- **`aspect`**: hole width / height in px (1280/720 = 1.7778). The screen locks to it.
- **`holeRadius`**: corner radius as a fraction of the hole width (0 for square).
- **Translucent areas**: semi-transparent body parts (alpha 0.2 to 0.6) show the equipped fill or wallpaper through the shell. Set `"translucent": true`.
- **Pixel art**: draw on a small native grid (for example 256x240); Kayboro scales it with crisp pixels.

## Start from a plain shell

Three plain shells are built in and always in the **Shell > Frame** list: **Plain Bezel**, **Plain Handheld** and **Plain TV**. They are a few flat shapes with no glare or texture, so you can play with them as they are or repaint one into your own shell. Kayboro shades every shell like a moulded part from its outline (the **3D Depth** switch), so flat colours are enough.

| Shell | SVG | `viewBox` | Opening x, y, w, h | Corner radius | Aspect |
|---|---|---|---|---|---|
| Plain Bezel | `src/renderer/frames/plain-bezel.svg` | 1056 x 636 | 48, 48, 960, 540 | 12 | 16:9 |
| Plain Handheld | `src/renderer/frames/plain-handheld.svg` | 600 x 820 | 60, 60, 480, 360 | 12 | 4:3 |
| Plain TV | `src/renderer/frames/plain-tv.svg` | 884 x 600 | 60, 60, 640, 480 | 24 | 4:3 |

Each SVG is a handful of commented `<rect>` and `<circle>` elements on whole numbers, so it opens cleanly in Inkscape, Figma or a text editor. They are built from `tools/vectorart/starters/plain-*.js`, which list the layout at the top. Repaint a copy, not the shipped file.

**How the opening works**

- All numbers are frame units: the SVG `viewBox` (`width` and `height` match it).
- The opening is a rounded rectangle cut by the clip path `shell-cut` at the top of the file: the whole canvas minus the opening, with `clip-rule="evenodd"`. All artwork sits inside `<g clip-path="url(#shell-cut)">`, so shapes can run under the opening and it still stays fully transparent.
- The dark lip is a rectangle 8 units larger than the opening on every side; the cut removes its middle, leaving a thin ring.
- The body's corner radius is the opening's radius plus the border (Plain Bezel: 12 + 48 = 60), so the corners are concentric.

**Use your copy**

1. **Repaint it.** Keep the opening fully transparent and closed all round by the shell. If you move or resize the opening, change `shell-cut` to match.
2. **Try it.** Select a screen, then **Shell > Custom Frame…** and pick the file (SVG, PNG or WebP). Kayboro finds the opening by flood-filling the transparent pixels (alpha below 16 of 255) that touch the centre of the image and takes their bounding box, so the opening must cover the image's centre (all three plain shells do). If it does not, Kayboro asks for the opening as percentage insets from each edge. A custom frame always shows a square-cornered picture and a solid body.
3. **Keep or share it as a mod shell.** Copy [`examples/mods/example-shell/`](../examples/mods/example-shell/), put your SVG in its `frames/` folder and give its `frames` entry its own `id` (built-in ids such as `plain-tv` are taken, and a mod item that reuses one is skipped). This also gets you a rounded picture (`holeRadius`) and see-through plastic (`translucent`). With the opening unchanged:

| Shell | `size` | `hole` | `holeRadius` | `aspect` |
|---|---|---|---|---|
| Plain Bezel | `{ "w": 1056, "h": 636 }` | `{ "x": 0.045455, "y": 0.075472, "w": 0.909091, "h": 0.849057 }` | `0.0125` | `1.777778` |
| Plain Handheld | `{ "w": 600, "h": 820 }` | `{ "x": 0.1, "y": 0.073171, "w": 0.8, "h": 0.439024 }` | `0.025` | `1.333333` |
| Plain TV | `{ "w": 884, "h": 600 }` | `{ "x": 0.067873, "y": 0.1, "w": 0.723982, "h": 0.8 }` | `0.0375` | `1.333333` |

## Wallpapers

Any wallpaper from a mod shows up in the gallery under **Mods** and can be the stage backdrop or a shell fill. Keep videos short and looping; H.264 MP4 or VP9 WebM at 1080p is plenty.

## Fills and colorways

```json
"fills": [
  { "id": "mint-bubbles", "name": "Mint Bubbles", "base": "bubbles", "colors": ["#0d3b33", "#6ee7a8", "#e8fff6"] },
  { "id": "lava-loop", "name": "Lava Loop", "media": { "type": "video", "file": "fills/lava.webm" } }
],
"colorways": [
  { "id": "lagoon", "name": "Lagoon", "swatch": ["#5fd4d0", "#2a6f97"], "filter": "hue-rotate(150deg) saturate(1.2)", "opacity": 1 }
]
```

- A **fill** recolors a built-in animation (`base`: `starfield`, `bubbles`, `plasma`, `pixel-rain`, `sakura-petals` or `aurora`; `colors` are hex) or plays your own `media`.
- A **colorway** is a CSS `filter` (no `url()`) plus an optional `opacity` (0.05 to 1). Below 1 the shell turns see-through.

## Mods and the integrity check

The startup file check only covers Kayboro's own files under `src/`. Mods live in your user-data folder and are never checked, flagged or disabled.
