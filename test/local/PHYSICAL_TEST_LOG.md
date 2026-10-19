# Kayboro physical test log

One row per device and scenario. Scenario ids (S1 to S25), the hardware matrix and the install paths are
in [docs/TESTING.md](../../docs/TESTING.md). Run `CHECK_ENVIRONMENT.bat` on each device first and keep
the report name in the Displays column, so a row can always be traced back to the exact setup.

Result values: `PASS`, `FAIL`, `PARTIAL` (works with a caveat, say which in Notes), `SKIP` (why in Notes).

## Devices

| Device id | Machine | OS build | GPU(s) and driver | Displays (from environment-*.txt) | Notes |
| --- | --- | --- | --- | --- | --- |
| D1 | | | | | |
| D2 | | | | | |

## Results

| Date | Device | OS | Displays | Build | Scenario | Result | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-01-01 | D1 | Windows 11 Pro 26300 | 3440x1440 240Hz 100% primary + 2560x1440 144Hz | dev `kayboro` abc1234 | S1 | PASS | example row, delete it |
| | | | | | | | |
| | | | | | | | |
| | | | | | | | |
| | | | | | | | |
| | | | | | | | |
| | | | | | | | |
| | | | | | | | |

Build: `dev <branch> <commit>`, `unpacked <version>`, `portable <version>`, `installer <version>` or
`steam <version> <appid>`. Add `sandbox` when the run used `KAYBORO_SANDBOX=1`.

## Bug report template

Copy one block per bug. Attach `COLLECT_DIAGNOSTICS.bat`'s zip and, for visual bugs, a screenshot or a
short clip.

```
Title:        <one line: what is wrong, not what you expected>
Device:       <device id from the table above>
Build:        <dev <branch> <commit> | unpacked | portable | installer | steam, plus version>
Profile:      <real | sandbox>
Scenario:     <S# or "other">
Game:         <name, API (DX11/DX12/Vulkan/OpenGL), borderless | windowed | exclusive>
Source:       <window | monitor | virtual monitor WxH>
Shell:        <id>, wallpaper: <id or file type>
Steps:
  1.
  2.
  3.
Expected:
Actual:
Every time?   <yes | sometimes (n of m) | once>
Diagnostics:  test/local/out/diagnostics-<timestamp>.zip
Screenshots:
Notes:        <workaround, first build where it appeared, anything odd on the machine>
```
