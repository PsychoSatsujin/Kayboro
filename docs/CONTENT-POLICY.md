# Content Policy

## How items are unlocked

- Shells, finishes, colorways, fills and wallpaper preset slots are unlocked with **in-app coins** and level rewards. Coins are earned by using Kayboro and are never sold for money.
- The only paid content is **Kayboro's own original or licensed shells**, sold as **Steam DLC**. These carry a `"dlc"` field in the catalog and show a **DLC** badge ("Available on Steam").
- Wallpapers are never locked and never sold. Every wallpaper, from any source, is free to use as a backdrop or a shell fill.
- Mods are free, owned automatically and never blocked.

## Takedowns

Kayboro honours **DMCA / takedown requests from anyone in the chain**: the original artist, the rights holder, the person who ported the work, or their representative.

1. Email the Kayboro team (address on the Steam store page and the repository) with the item id or name, the work it uses, and your relationship to it.
2. The item is added to `src/catalog/takedowns.json`:

```json
{ "removed": [ { "id": "wp-example", "date": "2026-10-13", "reason": "DMCA request from the artist" } ] }
```

3. The next update hides it everywhere: catalog, shop, gallery and inventory. Anyone who had it equipped falls back to the default.

That is the whole policy. Content stays unless someone in its chain asks for it to come down.

## Credits

Every wallpaper and third-party item carries a credit, shown in the gallery:

```json
"credit": { "artist": "Artist Name", "source": "Where it came from", "url": "https://..." }
```

Shell art made by Kayboro uses `"author": "Kayboro"`. Developer-exclusive and mod items use the creator's name.

See also [LICENSE-CONTENT.md](../LICENSE-CONTENT.md).
