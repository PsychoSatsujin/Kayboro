# RateofReality

Put any game or app window on a virtual stage and make it whatever size or shape you want. RateofReality shows live captures of other windows or monitors ("virtual screens"). You can:

- **Resize freely** by dragging any of the 8 handles, or with the arrow keys and `+`/`-`. The aspect ratio can be locked to the source, set to a preset (16:9, 4:3, 21:9, 32:9, 3:2, 1:1) or a custom `W:H`, or left free.
- **Wrap it in a frame**: CRT TV, virtual-pet egg, handheld console, arcade cabinet, thin bezel, or your own PNG/WebP/SVG with a transparent hole.
- **Change the background** behind the screens to a solid color, an image, a GIF, or an MP4/WebM video.
- **Add more screens**, each movable and resizable on its own.
- **Save and load scenes.**

It is Windows-first. Capture and the UI also run on macOS and Linux, but play mode, Steam detection and window moving only work on Windows.

## Install

```bash
npm install
npm start
```

Requires Node 18+. `koffi` provides the Win32 calls. If it fails to load, the app still runs without those features.

## Virtual display setup (recommended)

The cleanest setup runs the game on a monitor that doesn't physically exist. RateofReality then shows that monitor in whatever shape you like.

1. Install the open-source **Virtual Display Driver** (IddCx): <https://github.com/VirtualDrivers/Virtual-Display-Driver>.
2. In its settings/XML, add the custom resolution or aspect you want, for example 1600x1200 (4:3), 2560x1080 (21:9) or 1080x1920 (portrait). Then enable the virtual monitor.
3. Launch your game and set it to **borderless / windowed fullscreen** on the virtual monitor. Use **Move game to display** in the Displays panel if it opens on the wrong monitor.
4. In RateofReality, pick that **monitor** (or the game **window**) as a source, or press **Auto: latest Steam game**.
5. Make it full screen on your real monitor, frame it, resize it and press **Play**.

## Usage

- **Sources**: thumbnails of every window or monitor. Click one to assign it to the selected screen. **Auto** picks the most recently started game from `steamapps\common`.
- **Screens**: add or remove screens. Click to select, drag to move, and drag the handles to resize. Hold **Shift** while resizing to temporarily unlock the aspect ratio.
- **Aspect / Fit**: choose a preset or type a custom `W:H`. Fit can be contain, cover or stretch. Double-click a screen to toggle fit.
- **Frame**: pick a built-in frame or **Custom frame...**. The transparent hole is detected automatically; if detection fails, you enter insets yourself.
- **Background**: color, image/GIF, or video, with fit cover/contain/stretch/tile.
- **Play**: hides the UI and focuses the game. It confines the mouse to the game's client area and turns this window into a click-through, always-on-top overlay, with a cursor drawn on the scaled screen.

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

## Limitations

- **Anti-cheat**: some games block or flag window capture or overlays. Use this at your own risk in online games.
- **Exclusive fullscreen** games usually capture as black. Use borderless or windowed mode.
- **Minimized windows can't be captured.** Keep the game open, ideally on the virtual display.
- **Double cursor / wrong clicks**: if the game sits under the overlay on the same monitor, you see both the real cursor and the drawn one. Running the game on a virtual display avoids this.
- The display shows the game's existing output, so scaling up does not add detail.
- Scenes are stored in `scenes.json` in the app's user-data folder.
