# Shellcade DESIGN.md

Shellcade puts your games in a shell. The UI is the toy box around the stage: dark, soft and a little bit arcade, so the shells and the game stay the brightest things on screen.

Design read: a desktop companion app for PC players who decorate their games with cosmetic shells. Cute, game-y and premium. Native CSS tokens, Nunito for the interface, a pixel face for numbers and accents.

Dials: variance 3 (a tool, so predictable layout), motion 4 (feedback, not spectacle), density 6 (a sidebar full of controls that still breathes).

## 1. Visual Theme & Atmosphere

- **Night arcade.** Deep violet-black surfaces (`--bg`, `--panel`) with one hot pink accent. Nothing in the chrome competes with the shell art or the captured game.
- **Soft toy, hard pixels.** Rounded corners, chunky pills and a friendly sans for everything you read. Pixel type only where a game would put it: the wordmark, coin and level numbers, price and level badges, the test pattern.
- **The stage is sacred.** The window is the stage. Chrome floats over it (HUD top-left, sidebar right) and disappears completely in play mode and when the panel is hidden (`H`).
- **Rewards feel earned.** Coins are gold, rarity has a colour, locked things are dimmed but always visible with the exact level or price that unlocks them.

## 2. Color Palette & Roles

All colours are CSS custom properties on `:root` in `src/renderer/styles.css`. Panels and FX modules use the variables, never raw hex.

| Token | Hex | Role |
| --- | --- | --- |
| `--bg` | `#0f0d16` | Stage default, input wells, segmented-control track |
| `--panel` | `#17141f` | Sidebar, HUD, dialogs |
| `--panel-2` | `#1f1b2b` | Buttons, tiles, list rows, chips at rest |
| `--panel-3` | `#272238` | Hover and selected-segment surface (UI only) |
| `--line` | `#2c2740` | Hairlines, borders at rest |
| `--line-2` | `#3d3657` | Borders on hover, dashed empty states (UI only) |
| `--text` | `#eee9ff` | Primary text, icons on hover |
| `--muted` | `#9a93b5` | Secondary text, icons at rest, hints (6:1 on `--panel`) |
| `--faint` | `#6f6889` | Placeholders and disabled glyphs only (UI only) |
| `--accent` | `#ff6ad5` | The one accent: Play, selection, active tab, pressed chips |
| `--accent-ink` | `#2a0b22` | Text and icons on `--accent` (never white on pink) |
| `--accent-2` | `#7af0ff` | Focus rings and "paid" badges. Never a second CTA colour |
| `--coin` | `#ffd166` | Coins and prices only |
| `--ok` | `#6ee7a8` | Success, the "Hosting" tag |
| `--danger` | `#ff6b6b` | Destructive hover, Stop |

Rarity colours tint borders and thumbnail glows, never large fills:

| Rarity | Token | Hex |
| --- | --- | --- |
| Common | `--rarity-common` | `#b8b5c8` |
| Rare | `--rarity-rare` | `#7af0ff` |
| Epic | `--rarity-epic` | `#c58cff` |
| Legendary | `--rarity-legendary` | `#ffd166` |

## 3. Typography Rules

Bundled, OFL licensed (`src/renderer/assets/fonts/OFL.txt`), with system fallbacks. No font loads from the network.

| Token | Stack | Use |
| --- | --- | --- |
| `--font-ui` | Nunito (variable 200-1000), system-ui, Segoe UI | Everything you read |
| `--font-pixel` | Pixelify Sans, Silkscreen, ui-monospace | Wordmark, numbers, badges, test pattern |

| Role | Size / weight | Notes |
| --- | --- | --- |
| Wordmark | 18 / 700 pixel | `translate="no"` |
| Section title (summary) | 13.5 / 800 | Title Case nouns, icon on the left |
| Body, buttons | 12.5-13 / 700 | Buttons always bold, never wrap |
| Field label | 12 / 800 | Sits above its control |
| Hint, meta | 11.5 / 500 `--muted` | `text-wrap: pretty` |
| Coin and level numbers | 15 / 700 pixel | `font-variant-numeric: tabular-nums` |
| Badges | 10.5 / 700 pixel | "Lv 12", prices |

Rules: no uppercase micro-labels above sections; one weight jump per hierarchy level; pixel type is never used for sentences.

## 4. Component Stylings

Shape rule: **buttons and inputs 8px (`--r-sm`), tiles and toasts 12px (`--r`), floating surfaces 18px (`--r-lg`), chips, swatches, badges and Play are pills.**

- **Play** (`.play`): the single primary CTA, bottom-right in the sidebar footer. Pink pill, `--accent-ink` label, 44px tall, inner top highlight and a soft pink drop. Hover lifts 1px, active presses 1px. Turns `--danger` with a Stop glyph while playing. Shows its hotkey in a `<kbd>`.
- **Button** (`.btn`): 32px, `--panel-2` fill, 1px `--line`, bold label with an optional 16px Tabler icon in `--muted`. Hover: `--panel-3` + `--line-2`, icon goes `--text`. `.primary` is pink, `.ghost` is transparent, `.sm` is 26px.
- **Icon button** (`.icon-btn`): 32px square, always has `aria-label` and a `title`. `.danger` turns the glyph red on hover.
- **Tabs** (`[role=tab]`): icon over label, four equal columns. Selected: `--text` label, pink icon, 3px pink bar on the bottom edge. Roving tabindex; Left/Right/Home/End move selection.
- **Section** (`details > summary`): full-width row, icon, title, chevron that rotates. Body is a 10px-gap grid with 16px side padding. Hairline between sections.
- **Segmented control** (`.seg`): radio inputs inside a `--bg` well. Checked segment gets `--panel-3` and a 1px shadow. `.icons` variant stacks a 18px icon over an 11px label.
- **Chip** (`.chip`): 28px pill for aspect presets. Pressed: pink fill, `--accent-ink` text.
- **Swatch** (`.swatch`): 30px pill with a 20px gradient dot built from the item's catalog swatch colours. Pressed: pink border on a 12% pink wash. A dashed "N more" swatch links to the Shop.
- **Tile** (`.tile`): 12px card with an 8px-radius thumbnail. Source tiles are 16:9 with an icon for monitor, window or Steam game. Frame tiles (`.ftile`) are square with a rarity-tinted radial glow; locked tiles dim and desaturate the art and carry a pixel badge (`Lv 12`, a coin price, or `Soon` for paid items).
- **Input / select**: 32px, `--bg` well, 8px. Focus swaps the border to `--accent-2` with a 3px 25% ring. Native selects set explicit background and colour.
- **Switch** (`.switch`): 32x18 track, pink when on, `role="switch"`.
- **HUD** (`#hud`): frosted `--panel` pill top-left: pixel logo, wordmark, divider, then the HUD panel (coins, level, XP bar).
- **Toast**: 12px card stacked bottom-left, title + one line of body + optional action. Achievement toasts get a gold edge, level-ups a pink one.
- **Empty state**: dashed `--line-2` box, one plain sentence, one action.

## 5. Layout Principles

- **Regions**: stage (full window), HUD (fixed, 14px from top-left), sidebar (`--sidebar-w` 348px, full height, right), toasts (bottom-left). The visible stage is the window minus the sidebar; new screens and frames are fitted into it.
- **Spacing scale**: 4, 6, 8, 10, 12, 16, 20 px. Sections use 16px side padding and 10px between controls; tiles use 6-8px gaps.
- **Grids**: sources 2 columns, frames 3 columns (scrolls after about three rows), swatches wrap.
- **Order of the Stage tab**: Sources, Screens, Aspect & fit, Shell, Background, Displays, Scenes. The most frequent first; the setup-once sections start collapsed.
- **Z layers** (keep to these): stage 0 (screens use their own `z`), drawn cursor 100000, HUD/sidebar/show-panel 200000, toasts 300000, dialogs in the top layer.

## 6. Depth & Elevation

| Level | Surface | Treatment |
| --- | --- | --- |
| 0 | Stage | No chrome; whatever background the user picked |
| 1 | Sidebar | `--panel` at 96%, 16px backdrop blur, left hairline, long soft shadow |
| 2 | HUD, floating button, toasts | `--panel` at 82-85%, blur, `--shadow` |
| 3 | Dialog | `--panel`, `--line-2` border, `--shadow`, dimmed blurred backdrop |

`--shadow` is tinted to the background (violet-black), never pure black on light. Per screen, shell layers stack back to front: shell fill, capture (clipped to the hole radius), frame image with colorway, finish overlay, then selection handles.

## 7. Do's and Don'ts

Do:
- Use one accent. Pink means "this is the action" or "this is selected".
- Show the reason something is locked ("Unlocks at level 12", "Costs 400 coins", "Coming with the Steam release").
- Give every icon-only control an `aria-label`; keep visible focus rings (`:focus-visible`, `--accent-2`).
- Animate only `transform` and `opacity`, 150-250ms, `--ease`.
- Keep copy short, specific and in the second person.

Don't:
- Put white text on pink, or use cyan as a second CTA colour.
- Add glows, gradients or pixel type to body text.
- Hide locked items, or let a locked click silently do nothing.
- Use em dashes in UI copy; use a period, comma or colon.
- Draw over the stage in play mode (only toasts may appear).
- Load fonts, icons or scripts from the network. Steam CDN achievement icons are the only remote images (allowed in the CSP).

## 8. Responsive Behavior

- Minimum window 480x320 (set by main). The sidebar keeps its width; hide it with `H` or the panel button for small windows.
- The HUD clamps to the space left of the sidebar; the toast stack clamps the same way.
- Hit targets are at least 26px (32px for primary controls). Tiles and swatches are full buttons with no dead zones.
- `prefers-reduced-motion: reduce` collapses transitions and keyframes to near-instant; screensavers and finishes render a still frame.

## 9. Motion

| Token | Value | Use |
| --- | --- | --- |
| `--t-fast` | 150ms | Hover, press, colour changes |
| `--t` | 200ms | Chevron, switch thumb, HUD hide |
| `--t-slow` | 250ms | Sidebar slide, toast enter, XP fill |
| `--ease` | `cubic-bezier(.2, .8, .2, 1)` | Everything |

Press feedback is a 1px drop. Hover on frame tiles scales the art 5%. Loading uses shimmering skeleton tiles, not spinners (the refresh glyph spins only while a scan runs).

## 10. Voice

- Friendly and plain. "Your stage is empty." "Pick the game under Sources first."
- Buttons are Title Case verbs or nouns: "Add Screen", "Latest Steam Game", "Custom Frame…", "Use Opening".
- Errors say what to do next: "Capture failed: … Keep the window open and not minimized, then pick it again."
- Numbers are numerals, formatted with `Intl.NumberFormat`. Ellipsis is `…`, quotes are curly.
- Shellcade is always one word, capital S, never translated.

## 11. Agent Prompt Guide

- Background `#0f0d16`, panels `#17141f` / `#1f1b2b`, lines `#2c2740`, text `#eee9ff` / `#9a93b5`, accent `#ff6ad5` with ink `#2a0b22`, focus `#7af0ff`, coins `#ffd166`.
- "Build a Shellcade panel: dark `--panel` surface, 16px padding, sections separated by `--line` hairlines, 32px bold 8px-radius buttons, pill chips that turn pink when pressed, pixel-font numbers in `--coin`, rarity-tinted card borders, every icon from the inline Tabler sprite (`<svg class="i"><use href="#i-name"/></svg>`)."
- Available sprite icons: play, stop, refresh, plus, trash, x, eye, eye-off, monitor, window, steam, aspect, photo, movie, sparkles, lock, bag, user, heart, layers, chevron, maximize, minimize, save, folder, panel-close, panel-open, wallpaper, gamepad, handheld, share, droplet, check, upload, swatch, minus, coin-px (pixel coin, full colour), logo.
