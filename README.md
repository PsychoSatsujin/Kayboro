# Shellcade

**Put your games in a shell.** Shellcade captures your game window (or a whole virtual monitor) and plays it inside a decorative shell: a pixel CRT, a virtual-pet egg, a sakura handheld, a neon synthwave monitor. Every minute you spend in Shellcade earns coins and XP. Coins and levels unlock more shells, finishes, colorways, shell fills and wallpaper presets.

Free to play. Coming to Steam.

## Features

- **Shells**: 5 built-in starters plus 16 catalog shells (8 pixel, 8 vector) from common to legendary. Or drop in your own PNG/WebP/SVG with a transparent hole.
- **Style them**: finishes (matte, gloss, holo, pearl, glitter), colorways (berry, mint, midnight, sunset, mono, gold, clear) and animated shell fills that glow through translucent shells.
- **Wallpapers, never locked**: any wallpaper works as the stage backdrop or a shell fill. Catalog wallpapers, mod wallpapers, your own Wallpaper Engine subscriptions, or any local image, GIF or video. Coins buy extra preset slots for one-click swapping.
- **Free-form screen**: resize with 8 handles, the arrow keys or `+`/`-`. Lock the aspect to the source, a preset (16:9, 4:3, 21:9, 32:9, 3:2, 1:1), a custom `W:H`, or leave it free.
- **Multiple screens**, scenes you can save and load, and **play mode** that hides the UI and passes input through to the game.
- **100-level track** with rewards at every step.
- **Indie spotlight**: listed developers get support links (Ko-fi, Patreon, itch.io, website) and a share of revenue based on play time in Shellcade. See [docs/DEVELOPERS.md](docs/DEVELOPERS.md).
- **Mods**: drop a folder into `mods/` and its shells and wallpapers appear, free. See [docs/MODDING.md](docs/MODDING.md).

## Install and run

```bash
npm install
npm start        # run the app
npm test         # unit tests
npm run smoke    # end-to-end smoke test (Linux CI: xvfb-run -a npm run smoke)
```

Requires Node 18+. `koffi` provides the Win32 calls; if it fails to load, the app still runs without them.

Shellcade is Windows-first. Capture and the UI also run on macOS and Linux, but play mode, Steam detection and window moving are Windows-only.

## How rewards work

- **Time spent**: 1 coin and 10 XP per minute while the Shellcade window is visible (not minimized) or play mode is active. Level 100 takes roughly 60 hours.
- **Level-ups** grant the coins and items listed in `src/catalog/levels.json`.
- **Hosted games** are tracked per Steam appid. That play time drives the developer revenue split.
- **Achievement rewards (beta)**: off by default. Turn it on in **Profile > Settings**. Each Steam achievement unlocked while a game runs inside Shellcade then gives +50 coins and +120 XP.
- Coins are in-app currency only. They are never bought or sold. Shellcade's own premium shells ship as Steam DLC.

Progress is saved to `state.json` in `<userData>/shellcade/`.

## Virtual display setup (recommended)

The cleanest setup runs the game on a monitor that doesn't physically exist. Shellcade then shows that monitor in whatever shape you like.

1. Install the open-source **Virtual Display Driver** (IddCx): <https://github.com/VirtualDrivers/Virtual-Display-Driver>.
2. In its settings/XML, add the custom resolution or aspect you want, for example 1600x1200 (4:3), 2560x1080 (21:9) or 1080x1920 (portrait). Then enable the virtual monitor.
3. Launch your game and set it to **borderless / windowed fullscreen** on the virtual monitor. Use **Move game to display** in the Displays panel if it opens on the wrong monitor.
4. In Shellcade, pick that **monitor** (or the game **window**) as a source, or press **Auto: latest Steam game**.
5. Make it full screen on your real monitor, pick a shell, resize it and press **Play**.

## Usage

- **Sources**: thumbnails of every window or monitor. Click one to assign it to the selected screen. **Auto** picks the most recently started game from `steamapps\common`.
- **Screens**: add or remove screens. Click to select, drag to move, drag the handles to resize. Hold **Shift** while resizing to temporarily unlock the aspect ratio.
- **Aspect / Fit**: choose a preset or type a custom `W:H`. Fit can be contain, cover or stretch. Double-click a screen to toggle fit.
- **Shell**: pick an owned shell or **Custom frame...**. The transparent hole is detected automatically; if detection fails, you enter insets yourself.
- **Wallpaper**: open the gallery (Shop > Wallpapers, or Stage > Background > Wallpaper), filter by Shellcade / Mods / Wallpaper Engine / Files, hover to preview, click to apply to the stage or the shell fill. Save favorites to preset slots.
- **Shop / Profile**: spend coins, equip finishes, colorways and fills, track your level and per-game play time.
- **Play**: hides the UI and focuses the game. It confines the mouse to the game's client area and turns the window into a click-through, always-on-top overlay, with a cursor drawn on the scaled screen.

## Hotkeys

| Key | Action |
| --- | --- |
| `Ctrl+Alt+P` | Toggle play mode (works globally, even while the game has focus) |
| `Ctrl+Alt+H` / `H` | Toggle sidebar |
| Arrows / `Shift`+Arrows | Nudge the selected screen 1 px / 10 px |
| `+` / `-` | Scale the selected screen by 5% |
| `[` / `]` | Send backward / bring forward |
| `Delete` | Remove the selected screen |
| Double-click | Toggle fit mode |
| `Ctrl+S` | Save scene |

## Docs

- [Vision and economy](docs/VISION.md)
- [Developer program](docs/DEVELOPERS.md)
- [Modding](docs/MODDING.md)
- [Content policy](docs/CONTENT-POLICY.md) and [content license](LICENSE-CONTENT.md)
- [Ideas backlog](docs/IDEAS.md)
- [Design system](DESIGN.md)

## Limitations

- **Anti-cheat**: some games block or flag window capture or overlays. Check before using it in online games.
- **Exclusive fullscreen** games usually capture as black. Use borderless or windowed mode.
- **Minimized windows can't be captured.** Keep the game open, ideally on the virtual display.
- **Double cursor / wrong clicks**: if the game sits under the overlay on the same monitor, you see both the real cursor and the drawn one. A virtual display avoids this.
- Shellcade shows the game's existing output, so scaling up does not add detail.
- Real-money purchases are not in this build. DLC shells arrive with the Steam release.
- Wallpaper Engine **scene** and **web** wallpapers are listed but not playable; video and image wallpapers work.
