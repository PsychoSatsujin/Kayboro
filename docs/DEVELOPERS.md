# Developer Program

Indie developers whose games are played inside Kayboro get a support page in the **Devs** tab and **70% of Kayboro's net revenue**, split by how much their games are played in Kayboro.

## Join

Pick one:

- **In-app**: Devs tab > **List your game**. Fill in the form and tick the 70/30 checkbox. The submission is saved to `<userData>/kayboro/dev-submissions.json`; send that entry to the Kayboro team.
- **Pull request**: add yourself to `src/catalog/developers.json`:

```json
{ "devId": "tiny-moth", "name": "Tiny Moth Games", "verified": false,
  "apps": [{ "appid": 1234560, "name": "Moth Quest" }],
  "links": { "patreon": "https://www.patreon.com/tinymoth", "kofi": "https://ko-fi.com/tinymoth",
             "itch": "https://tinymoth.itch.io", "website": "https://tinymoth.games" } }
```

## What you provide

| Field | Used for |
| --- | --- |
| Studio / developer name | Listing and payout sheet |
| Contact email | Payout contact |
| Game name(s) + Steam appid(s) | Matching play time |
| Ko-fi URL, PayPal (email or paypal.me) | Payouts |
| Patreon URL, website | Support links in the Devs tab |
| Notes | Anything else |
| 70/30 checkbox | Agreement to the split |

Support links open in the system browser. Allowed hosts: patreon.com, ko-fi.com, itch.io, store.steampowered.com, github.com and your listed website.

## The 70/30 split

- **70%** of net revenue goes to listed developers. **30%** stays with Kayboro.
- Each developer earns **points**: whole minutes their games were hosted in Kayboro (plus 10 per achievement unlocked while hosted, when achievement rewards are on).
- The 70% pool is split in proportion to points. Cents are rounded with the largest-remainder method, so the rows always add up exactly.
- The math lives in `src/main/economy/revenue.js` (`computePayouts`) and is unit-tested.

## Payout sheet

1. **One install**: `shell.exportPayoutSheet({ revenueCents })` (Devs tab > Export payout sheet) saves an Excel-ready CSV (UTF-8 with BOM). One row per developer: name, email, Ko-fi, PayPal, Patreon, appids, play minutes, points, share %, payout. Then a **Kayboro (30%)** row and totals.
2. **Many installs**: merge exported usage files (JSON or CSV) from every install into one sheet with the same 70/30 math. `--revenue` is the period's net revenue in USD (or `--revenue-cents`), `--out` the CSV to write (`-` for stdout).

```bash
node tools/payouts/merge-sheets.mjs --revenue 1234.56 --out payout-sheet.csv usage-a.json usage-b.csv usage-c.csv
```

3. Pay each row through Ko-fi or PayPal.

## Exclusive shells

Developers can commission or make a shell themed on their game. It ships in the catalog with your studio as `author`, and you can link it from your store page.

**Art spec**

- **Format**: SVG (preferred) or PNG/WebP with alpha.
- **Hole**: the screen opening is fully transparent (alpha 0). One rectangular opening, optionally with rounded corners (`holeRadius`, a fraction of the hole width).
- **Size**: pixel art on a native grid (for example 256x240, scaled with nearest-neighbour); vector art around 1600 px wide.
- **Aspect**: the hole matches a common game aspect: 16:9, 4:3, 3:2, 10:9 or 1:1.
- **Translucent areas**: semi-transparent body regions (alpha 0.2 to 0.6) let shell fills and wallpapers show through. Set `"translucent": true`.
- **Catalog entry**: `size` in px, `hole` as fractions of `size`, `aspect` = hole width / height in px. See [MODDING.md](MODDING.md) for the full FrameItem schema.
- **Originality**: your own art or art you hold the rights to.
