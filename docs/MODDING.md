# Modding

Mods add shells, wallpapers, fills and colorways. They are **free, owned automatically and never blocked**: no coins, no review, no signing.

## Install a mod

1. Profile > Settings > Mods > **Open folder** (`<userData>/shellcade/mods/`).
2. Drop the mod folder in.
3. Press **Reload** (or restart Shellcade).

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
- `file`, `media.file` and `preview` are **relative to the mod folder**. Shellcade turns them into `file://` URLs.
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
- **Pixel art**: draw on a small native grid (for example 256x240); Shellcade scales it with crisp pixels.

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

The startup file check only covers Shellcade's own files under `src/`. Mods live in your user-data folder and are never checked, flagged or disabled.
