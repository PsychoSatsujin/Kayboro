# Weekly bundles

Every week the Shop's **Weekly** tab sells one bundle: 2 to 8 shells and looks (finishes, colors, fills)
at a discount. Buying it unlocks every item in it the player doesn't own yet, and the price only counts
those.

## Curating a week

1. Run Kayboro from source (`npm start`). The **Bundle Studio** appears under the bundle in Shop > Weekly
   (players on the packaged app never see it; `KAYBORO_DEV=1` also turns it on).
2. Name the bundle, set its week (`YYYY-Www`, ISO weeks starting on Monday; it defaults to next week),
   pick a discount and 2 to 8 items, and add a one-line description.
3. Click **Save Bundle File…**. The file looks like:

   ```json
   { "week": "2026-W44", "name": "Midnight Masterpieces", "desc": "...", "items": ["vx-ink-dragon", "gloss"], "discount": 0.3, "author": "Kayboro" }
   ```

4. Publish it (or hand the file over to be published):

   ```
   node tools/bundles/publish.mjs path/to/kayboro-bundle-2026-W44.json
   ```

   This checks every item against the catalog and writes it into `src/catalog/bundles.json`. A newer file
   for the same week replaces the old one. `--list` shows the curated weeks and `--remove 2026-W44` puts a
   week back on automatic.

Starters, Steam DLC and fan art can't go in a bundle.

## Weeks nobody curates

A week without a curated bundle gets an automatic one, built from the week number so every player sees the
same bundle: three shells from one collection (or theme), plus a finish, a color and a fill, at 30% off.
The logic is in `src/main/economy/bundles.js` and is covered by `test/bundles.test.js`.
