# Testing Kayboro

How to test Kayboro on this PC and on real hardware. Everything here runs from the repo folder
(`F:\Virtual_Screen_Resizer_with_borders`). Each root `.bat` launcher checks for Node 18+ and runs
`npm ci` when `node_modules` is missing, so a fresh clone needs nothing but Node 22 LTS installed.

Record what you find in [test/local/PHYSICAL_TEST_LOG.md](../test/local/PHYSICAL_TEST_LOG.md).

## Quick start

| Double-click | What it does | Script behind it |
| --- | --- | --- |
| `START_KAYBORO.bat` | Runs Kayboro from source with your real profile (`npm start`). | |
| `START_SANDBOX.bat` | Runs Kayboro in the tester sandbox: separate profile, Tester tools in Profile. | `src/main/sandbox.js` |
| `RUN_TESTS.bat` | Unit tests (`npm test`). | |
| `PREVIEW_SHELLS.bat` | Renders every catalog shell and opens the contact sheet. | `tools/local/preview-shells.cjs` |
| `RUN_SMOKE_WINDOWS.bat` | The real end-to-end smoke test, like CI's Windows job. Moves windows for a minute. | `tools/local/smoke-windows.ps1` |
| `BUILD_FOR_TESTING.bat` | Builds `dist\win-unpacked\Kayboro.exe` and runs its self-test. Prints PASS or FAIL. | `tools/local/self-test.ps1` |
| `CHECK_ENVIRONMENT.bat` | Read-only report of this PC: displays, GPUs, Node, Steam, virtual displays. | `tools/local/check-environment.ps1` |
| `COLLECT_DIAGNOSTICS.bat` | Zips state files, the last smoke result and the environment report for a bug report. | `tools/local/collect-diagnostics.ps1` |

Every launcher pauses at the end only when something failed or when it was double-clicked. Set
`KAYBORO_NO_PAUSE=1` to turn the pause off in scripts. Reports, logs and zips land in `test\local\out\`
(git-ignored).

## Unit tests

```bat
RUN_TESTS.bat
npm test
```

`node --test test/*.test.js`: economy rules, catalog, mods, payouts, Steam parsing, the pixel and vector
frame builders, integrity, migration and the sandbox. They run in about two seconds, need no display and
never touch your profile. Keep them green before anything else: the smoke script refuses to start when
they fail (pass `-SkipUnitTests` to override while debugging).

## Preview shells

```bat
PREVIEW_SHELLS.bat           shells listed in src\catalog\frames-*.json
PREVIEW_SHELLS.bat drafts    plus shells drawn under tools\ but not in the catalog yet
node tools/local/preview-shells.cjs --list
```

Builds each shell from its source module (`tools/vectorart/frames/<id>.js` or
`tools/pixelart/frames/<id>.mjs`) the same way the real builds do, lints it against the frame test rules,
rasterizes it and checks that the opening is really transparent and the rim really opaque. Output goes to
`.preview\all\`: `<id>.png` per shell (checkerboard, dark stage with a mock game, translucent variant) and
`sheet.png`, which opens when it is done. A `FAIL` line names the shell and the reason; `WARN` lines are
worth fixing but do not fail. The shipped catalog is never changed.

## Tester sandbox

```bat
START_SANDBOX.bat
node tools/local/start-sandbox.cjs      (any OS)
```

The sandbox is on only when the environment variable `KAYBORO_SANDBOX` is exactly `1`. There is no
setting, flag or hidden gesture that turns it on, so a normal run can never land in it by accident.
When it is on:

- userData is `.sandbox\userData` in the repo (packaged builds: `%APPDATA%\Kayboro Sandbox\userData`;
  `KAYBORO_SANDBOX_DIR` overrides both). Your real save in `%APPDATA%\Kayboro` is never read or written.
- Every window title ends in `(Sandbox)`.
- Profile shows a **Tester tools** section with Grant 1,000 / 10,000 Coins, Advance 1 / 10 Hours
  (the real activity tracker runs on a fast clock, so the window must be visible), Simulate Achievement
  (needs Achievement rewards on in Settings; uses the hosted game or Spacewar) and Reset Sandbox Profile
  (click twice within 4 seconds; removes `state.json` and `history.jsonl`, keeps mods and scenes).
- Kayboro's own Steam achievements never unlock, so you can play through level-ups and purchases freely.
- The one-time Shellcade data migration is skipped: the sandbox starts at level 1.

The sandbox profile is plain JSON under `.sandbox\userData\kayboro\`. Delete the folder to start over
completely, mods included.

## Windows smoke test

```bat
RUN_SMOKE_WINDOWS.bat
RUN_SMOKE_WINDOWS.bat -Yes -Only app-load,play-mode
```

This is the same end-to-end run as the Windows job in `.github/workflows/smoke.yml`, on your PC:

1. Warns you, then counts down 5 seconds (`-Yes` skips the countdown).
2. Runs `npm test`, downloads the Electron binary when it is missing.
3. Copies `node_modules\electron\dist` to `%TEMP%\kayboro-fake\steamapps\common\FakeGame` and starts
   `test\e2e\fake-game` from there with `FAKE_GAME_TITLE=FakeGame`, so Kayboro sees a "Steam game".
4. Runs `npx electron test/e2e/smoke.js` with the CI environment and tees the console to
   `test\local\out\smoke-<timestamp>.log`.
5. Always stops the fake game, even on failure or Ctrl+C.

For about a minute (up to four) it moves windows between your displays, briefly confines the mouse to the
magenta FakeGame window and shows an always-on-top, click-through overlay. Save your work and keep your
hands off the mouse and keyboard until it prints the result. The takedown check rewrites
`src\catalog\takedowns.json` and `src\integrity.json` for a moment and restores them (the next run also
restores them if this one was killed).

Results: `test\e2e\out\results.json` (one entry per check with PASS / FAIL / SKIP and a detail string) and
one PNG per major step in the same folder. On Linux use `xvfb-run -a npm run smoke` instead.

## Packaged build and self-test

```bat
BUILD_FOR_TESTING.bat            build, then self-test
BUILD_FOR_TESTING.bat nobuild    only the self-test of the existing dist\win-unpacked
```

`npm run dist:dir` (electron-builder, see `docs/STEAM.md`) writes the unpacked app to
`dist\win-unpacked\Kayboro.exe`. The launcher then starts it with `--self-test=<file.json>`: the app boots
normally, waits for the renderer to finish loading, writes `{ok, version, electron, platform,
catalog: {frames, wallpapers}, steamworks, errors[]}` to the file, prints one `KAYBORO_SELFTEST {...}` line
and exits 0 or 1 within 30 seconds. The self-test runs inside its own sandbox folder
(`.sandbox\selftest-userData`), so it never touches your save or your Steam achievements.

`tools\local\self-test.ps1` prints the version, catalog counts, whether steamworks loaded, every error,
then `SELF-TEST PASS` or `SELF-TEST FAIL`. Results: `test\local\out\selftest-<timestamp>.json` plus the
app's stdout and stderr next to it. It also works on a dev run:
`powershell -File tools\local\self-test.ps1 -Exe node_modules\electron\dist\electron.exe -AppArgs .`

Testers on other PCs get the `dist\` output (portable exe or installer, see the install paths below),
never the repo.

## Environment check

```bat
CHECK_ENVIRONMENT.bat
```

Read-only. Collects the Windows build, every display (resolution, refresh rate, scaling, position,
primary, adapter), GPUs and driver versions, Node, npm, the Electron binary, whether `koffi` loads, the
Steam install and library folders (from `HKCU\Software\Valve\Steam`), Wallpaper Engine, the Virtual
Display Driver and other virtual adapters (`Get-PnpDevice -Class Display`), free space on the repo drive
and whether real, sandbox or legacy profiles exist. The summary prints on screen; the full report is
`test\local\out\environment-<timestamp>.txt`. Run it on every test machine before the physical plan
below and attach the report to any bug.

## Diagnostics

```bat
COLLECT_DIAGNOSTICS.bat
COLLECT_DIAGNOSTICS.bat -IncludeScreenshots
```

Copies into `test\local\out\diagnostics-<timestamp>.zip`: the latest environment report (made first when
there is none), `state.json`, `history.jsonl`, `selftest.json`, `*.log` and `scenes.json` from the real,
sandbox and self-test profiles, the last smoke `results.json` and log, the latest self-test result, and a
`MANIFEST.txt` listing every file and where it came from. Mods are listed by folder name only; developer
form submissions, browser storage and crash dumps are never included. Nothing is changed or deleted at
the source. Look inside before sharing it: `state.json` names the games you hosted.

## Physical test plan

Use the sandbox (`START_SANDBOX.bat`, or `KAYBORO_SANDBOX=1` next to a packaged exe) for anything that
grants coins or simulates time, and the real profile for the Steam achievement checks that must unlock.
One row per device and scenario in `test/local/PHYSICAL_TEST_LOG.md`.

### Hardware matrix

Cover each row at least once; the columns on the right say what to watch.

| Setup | Why | Watch for |
| --- | --- | --- |
| 1080p, 100% scaling | Baseline, most common | Pixel shells crisp at 1x, HUD readable |
| 1440p, 100% and 125% | Default fractional scaling | Shell rim stays sharp, no half-pixel seams at the opening |
| 4K, 150% and 200% | High DPI | Sources thumbnails sharp, play-mode cursor lands where the real one is |
| Mixed-DPI multi-monitor (e.g. 4K 150% + 1080p 100%) | Per-monitor DPI | Drag Kayboro across monitors: no size jump, cursor alignment on both |
| Ultrawide 21:9 (3440x1440) | Shell aspect presets | 21:9 preset fills, 16:9 game letterboxed inside the shell |
| Super ultrawide 32:9 | Extreme aspect | Stage fits, sidebar does not overlap, sources list still usable |
| Portrait monitor | Rotation | 9:16 preset, handheld and pet shells in portrait, sources thumbnails rotated correctly |
| 120 Hz and above | Frame pacing | Video wallpaper and GIF stay smooth, no tearing in the capture |
| Laptop with hybrid GPU (iGPU + dGPU) | Capture across adapters | Capture works when the game runs on the dGPU and Kayboro on the iGPU and the other way around |
| Handheld PC (ROG Ally, Legion Go, etc.) | Small screen, 7 to 8 inch at 150% or more | Minimum window 480x320, touch opens panels, play mode without a mouse |
| Steam Deck, desktop mode | Linux and Proton | Linux build runs under Xvfb-free desktop; Windows build via Proton: capture and UI only, no play mode (Win32 only) |

### Install paths

| Path | How | Check |
| --- | --- | --- |
| Dev run | `START_KAYBORO.bat` | Title "Kayboro", integrity row says "Development build: nothing to check." |
| Sandbox dev run | `START_SANDBOX.bat` | Title "Kayboro (Sandbox)", Tester tools visible |
| Unpacked build | `BUILD_FOR_TESTING.bat` | `SELF-TEST PASS`, `App files: OK` in Profile > Settings |
| Portable exe | `dist\Kayboro-<version>-portable.exe` (see `docs/STEAM.md`) | Runs from a USB stick, data goes to `%APPDATA%\Kayboro` |
| NSIS installer | `dist\Kayboro-Setup-<version>.exe` | Installs per user without admin, Start menu entry, uninstaller removes the app but keeps the profile |
| Steam build, Spacewar (app id 480) | `steam_appid.txt` with 480 next to the exe, Steam running | Overlay works (Shift+Tab), steamworks loaded in the self-test, no achievements (Spacewar has none of ours) |
| Steam build, real app id | Upload via SteamPipe, install from the Steam library | Achievements unlock in the normal profile, never in the sandbox |

### Scenarios

Steps assume a game is already running. "Expect" is the pass condition; anything else is a bug.

| # | Scenario | Steps | Expect |
| --- | --- | --- | --- |
| S1 | Window capture | Sources > click the game window | The game shows inside the selected screen within 2 s, thumbnail matches |
| S2 | Monitor capture | Sources > click a monitor | The whole monitor shows, including the mouse cursor; switching monitors is instant |
| S3 | Virtual Display Driver | Install VDD (README "Virtual display setup"), add 1600x1200, enable, move the game there, capture that monitor | Game fills the 4:3 shell with no black bars; no double cursor on the real monitor |
| S4 | Borderless vs exclusive fullscreen | Capture the game in borderless, then switch it to exclusive fullscreen | Borderless captures; exclusive captures black or freezes (documented limitation) and Kayboro stays responsive |
| S5 | DX11 / DX12 / Vulkan / OpenGL | One game per API (e.g. DX11: Terraria; DX12: Control; Vulkan: Doom; OpenGL: Minecraft Java) | All four capture in borderless; frame rate inside Kayboro within 5 fps of the game |
| S6 | Play mode input | Press Play (or Ctrl+Alt+P) | UI hides, the game gets keyboard and mouse, clicks land where the drawn cursor is |
| S7 | Cursor confinement | In play mode, push the mouse past the shell | Cursor stays inside the game's client area; drawn cursor never leaves the screen opening |
| S8 | Alt-Tab in play mode | Alt-Tab to another app, then back | Confinement releases on focus loss and returns on focus; Kayboro never traps the cursor in another app |
| S9 | Ctrl+Alt+P escape | While the game has focus press Ctrl+Alt+P | Play mode stops at once, cursor released, UI returns |
| S10 | Every shell renders | `PREVIEW_SHELLS.bat`, then equip each shell in the app (Tester tools: Grant 10,000 Coins to buy them) | No FAIL in the sheet; in the app the opening fits the screen, rim is opaque, no stretched pixels |
| S11 | Translucent fills glow | Equip a translucent shell, pick a fill, put a bright wallpaper behind it | Fill tints the rim, the glow follows the wallpaper, 60 fps while the wallpaper moves |
| S12 | Video and GIF wallpapers | Set a 4K mp4 wallpaper, then an animated GIF, leave both for 10 minutes | GPU use stays reasonable (Task Manager), no stutter in the captured game, memory does not grow |
| S13 | One hour earns 60 coins | Note coins, keep Kayboro visible for 60 minutes (sandbox: Advance 1 Hour) | Coins +60, XP +600; minimized time does not count |
| S14 | Level-up and purchase | Sandbox: Advance 10 Hours, then buy a shell and a finish in Shop | Level-up toast with the reward, item becomes owned and equipped, coins decrease by the price |
| S15 | Mods folder | Profile > Settings > Open mods folder, drop in `examples/mods/example-shell`, Reload mods | The mod shell appears in Shop under Mods and equips; a broken `mod.json` lists a warning, not a crash |
| S16 | Takedowns | Add a shipped shell id to `src/catalog/takedowns.json` `removed`, restart | The shell is gone from Shop, gallery and inventory; a screen that had it equipped falls back to the default shell (docs/CONTENT-POLICY.md); no crash, no refund expected |
| S17 | Integrity check | In an unpacked build, edit one file under `resources\app` (or `app.asar` contents), start the app | Profile > Settings shows "1 file differs from the installed version" with the file under Show files and the Steam verify hint; dev runs say "Development build: nothing to check." |
| S18 | Sleep and resume | Capture a game, sleep the PC for 5 minutes, resume | Capture keeps running, or the screen stops with a "Capture ended." toast and picking the source again works; never a frozen last frame with no toast; the sleep time did not earn coins |
| S19 | Display hot-plug | Unplug and replug a monitor while a screen captures it | Kayboro stays up, the screen stops with "Capture ended.", Sources lists the monitor again after replug and capture works |
| S20 | Crash recovery in play mode | Start play mode, kill the renderer (Task Manager > Kayboro child process) | Cursor is released immediately (main handles the stop), window reloads or closes cleanly |
| S21 | Steam overlay | Steam build: press Shift+Tab inside the hosted game and inside Kayboro | Overlay opens over the game; Kayboro's overlay does not block it |
| S22 | Kayboro achievements, sandbox | `KAYBORO_SANDBOX=1`, reach level 10 via Advance 10 Hours | No Steam achievement unlocks, no Steam toast |
| S23 | Kayboro achievements, normal | Real profile, reach level 10 for real or by hosting a game | The Steam achievement unlocks once with its icon from `steam/achievements.json` |
| S24 | DLC ownership | Account with and without the DLC | DLC shells show "Coming with the Steam release" or owned, never purchasable twice |
| S25 | Anti-cheat caution | Do not test online anti-cheat games: EAC, BattlEye, Vanguard, FACEIT, Ricochet. Test with their offline or single-player modes only, and only after reading the game's capture policy | Capture of a blocked game shows black or a toast, never a ban risk taken by the tester |

Extra checks worth a row when you have the time: Ctrl+Alt+H hides and restores the sidebar in every
layout; scenes save and reload with the same shell, aspect and wallpaper; the app starts with Steam closed
and with no network.

### Before you report

1. `CHECK_ENVIRONMENT.bat` on the test machine.
2. Reproduce once more, note the exact steps.
3. `COLLECT_DIAGNOSTICS.bat` (add `-IncludeScreenshots` when the smoke test is involved).
4. Fill in the bug template in `test/local/PHYSICAL_TEST_LOG.md` and attach the zip.
