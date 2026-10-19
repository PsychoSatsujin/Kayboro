# Kayboro Virtual Screen Driver (KBVDD)

An Indirect Display Driver (UMDF 2 + IddCx) that gives Kayboro **invisible screens**. A game runs on a
monitor nobody can see, at full speed and never minimized, and Kayboro shows it inside a shell. No second
copy of the game on your desktop, no stray cursor.

- Screens are created on request at the resolution Kayboro asks for (the shell's aspect), named "Kayboro"
  in Windows, with common modes in every aspect next to it.
- Kayboro places each screen so it only touches your monitors at one corner: the mouse can't wander onto it.
- **Watchdog:** when Kayboro stops talking to the driver for 3 seconds (it quit or crashed), every invisible
  screen is unplugged and Windows moves the game back onto a real monitor.
- Up to 4 screens. No admin rights needed to use it, only to install it.

Derived from Microsoft's [IddSampleDriver](https://github.com/microsoft/Windows-driver-samples/tree/main/video/IndirectDisplay)
and released under the same **Microsoft Public License** (see [LICENSE](LICENSE)).

## Layout

| Path | What |
| --- | --- |
| `include/kbvdd_ioctl.h` | The control contract (device interface GUID, IOCTLs, structs). Kayboro mirrors it in `src/main/vdd/worker.js`; `test/vdd.test.js` keeps them in sync. |
| `src/` | The driver (`KayboroVdd.dll`). |
| `inf/KayboroVdd.inf` | Root-enumerated display adapter `Root\KayboroVDD`, runs from the driver store. |
| `setup/kbvdd-setup.cpp` | `kbvdd-setup.exe`: `install`, `uninstall`, `status`, `test`. |
| `build.cmd` | Builds everything with the WDK/SDK NuGet packages (no WDK install). |
| `scripts/dev-install.cmd` | Local test install with a self-signed certificate (admin). |
| `.github/workflows/build-sign.yml` | CI build + SignPath signing for releases. |

## Build

Needs Visual Studio 2022+ with the C++ x64 tools and `nuget.exe` (`winget install Microsoft.NuGet`).

```
build.cmd Release
```

The first run restores the Windows SDK and WDK packages (about 1.5 GB) into `packages\` next to this file,
with NuGet's caches kept there too. Output: `build\Release\package\` (`KayboroVdd.dll`, `KayboroVdd.inf`,
`kayborovdd.cat`, `kbvdd-setup.exe`).

## Test on your PC (developers)

Windows only loads drivers whose signature it trusts. Until releases are signed by SignPath, test builds use a
self-signed certificate that you trust on your own PC. From an **administrator** command prompt:

```
scripts\dev-install.cmd
build\Release\package\kbvdd-setup.exe test 1600x1200
```

`dev-install` creates the "Kayboro Driver Test" certificate (once), trusts it on this PC, builds and signs the
driver, and installs it. `test` plugs in a screen for 5 seconds and checks that the watchdog unplugs it.
`scripts\dev-uninstall.cmd` removes the driver and the certificate again.

## Releases (SignPath, free for open source)

1. Publish this folder as its own public GitHub repository (it is self-contained).
2. Apply to [SignPath Foundation](https://signpath.org) with that repository.
3. Configure the secret and variables listed at the top of `.github/workflows/build-sign.yml`.
4. Push a `v*` tag: CI builds, SignPath signs the binaries and the catalog, and the signed package is the
   `KayboroVdd-signed` artifact.

## Shipping with Kayboro on Steam

`npm run dist:steam` copies the package into `dist\win-unpacked\driver\` (set `KBVDD_PACKAGE` to the signed
package's folder). `steam\upload.ps1` then adds `installscript.vdf` to the depot, and Steam runs
`driver\kbvdd-setup.exe install` elevated the first time a player starts Kayboro, and `uninstall` when they
remove it.

## Protocol

Open the device interface `{633cce24-bc1a-43cb-9ad2-5147803bced6}` and send METHOD_BUFFERED IOCTLs:

| IOCTL | In | Out |
| --- | --- | --- |
| `IOCTL_KBVDD_INFO` (0x900) | | `KBVDD_INFO` (version, max screens, active mask, ready) |
| `IOCTL_KBVDD_ADD` (0x901) | `KBVDD_ADD_IN` (width, height, refresh, flags) | `UINT32` connector index |
| `IOCTL_KBVDD_REMOVE` (0x902) | `UINT32` index, or `0xFFFFFFFF` for all | |
| `IOCTL_KBVDD_PING` (0x903) | | |

Send any request at least every second while screens should stay plugged in.
