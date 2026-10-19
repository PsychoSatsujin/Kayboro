# Kayboro Vision

**Put your games in a shell.** Kayboro turns the window you play in into a collectible toy: a CRT with rabbit ears, a kitty-ear monitor, a magical-girl compact, a gold museum frame. You play the same games you always play. Kayboro makes the space around them yours, and rewards you for the time you spend there.

## Core loop

1. **Use Kayboro**: host a game, or just keep the app open.
2. **Earn**: coins and XP for every minute.
3. **Level up**: each level drops coins or an item.
4. **Collect**: spend coins on shells, finishes, colorways, fills and wallpaper presets.
5. **Show off**: a styled shell makes the next session better, so you come back.

## Principles

- **Quality over quantity.** 21 shells at launch, each one hand-made and on-theme. The 20% that delights beats 80% filler.
- **Variety by multiplication.** Finishes x colorways x fills x shells. 6 finishes, 8 colorways and 6 fills turn 21 shells into thousands of looks without thousands of assets.
- **Wallpapers are free.** Any wallpaper, from any source, at any time. Coins buy convenience (preset slots), never access.
- **Coins are earned, never bought.** Premium content is Kayboro's own original or licensed shells, sold as Steam DLC.
- **Zero friction.** No idle checks, no caps, no anti-cheat. Mods are free and load without review.

## The 100-level track

- Level 1 to 100 takes roughly **60 hours** of use (about 36,000 XP at 10 XP per minute).
- Every level gives coins. Item levels hand out shells, finishes, colorways and fills in a curve that keeps a new toy in reach.
- Milestones at 10, 25, 50, 75 and 100 give big coin bundles. Level 100 unlocks the legendary shell **The Gallery** (`vx-gallery`).
- The list lives in `src/catalog/levels.json`.

## Economy numbers

| Source / sink | Value |
| --- | --- |
| Time in Kayboro | 1 coin + 10 XP per minute |
| Steam achievement (beta toggle, off by default) | +50 coins + 120 XP |
| Level-up | coins and items from `levels.json` |
| Shop items | 150 to 1,200 coins |
| Wallpaper preset slot | 200 coins each, no maximum |
| DLC shells | Steam DLC, never coins |

At 60 coins an hour, a common shop item costs a few hours and a top-tier item an evening or two of play, on top of level rewards.

## Roadmap

1. **MVP (now)**: capture, shells, finishes, colorways, fills, wallpaper gallery and presets, time rewards, 100 levels, mods, developer form and payout sheet.
2. **Steam release**: Steam build, achievements for Kayboro itself, DLC shells (`"dlc": {"appid": N}` in the catalog), cloud saves.
3. **Workshop**: shells and wallpapers through Steam Workshop on top of the existing mod format.
4. **Developer payouts**: 70% of net revenue to listed developers, split by play time in Kayboro, paid from the exported payout sheet. See [DEVELOPERS.md](DEVELOPERS.md).
