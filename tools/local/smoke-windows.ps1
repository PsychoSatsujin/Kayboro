<#
.SYNOPSIS
  Runs the real end-to-end smoke test (test/e2e/smoke.js) on this PC, exactly like the Windows job in
  .github/workflows/smoke.yml: a fake "Steam game" under %TEMP%\kayboro-fake\steamapps\common\FakeGame,
  then `npx electron test/e2e/smoke.js` with FAKE_GAME_TITLE=FakeGame.

.DESCRIPTION
  For about a minute (up to 4) the smoke test drives the real app: it MOVES WINDOWS between displays,
  briefly CONFINES THE MOUSE to the fake game and shows an ALWAYS-ON-TOP overlay. Don't touch the mouse
  or keyboard while it runs. It also rewrites src/catalog/takedowns.json and src/integrity.json for a
  moment and restores them afterwards (and on the next run if this one was killed).

  The fake game is always stopped at the end, even when the smoke test fails or you press Ctrl+C.
  Output: test\e2e\out\results.json, one PNG per major step, and a console log in test\local\out.

.PARAMETER Yes
  Skip the 5 second warning countdown.
.PARAMETER Only
  Comma-separated check names to run (SMOKE_ONLY), e.g. -Only app-load,play-mode.
.PARAMETER SkipUnitTests
  Don't run `npm test` first (CI runs it before the smoke test).

.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -File tools\local\smoke-windows.ps1
  powershell -NoProfile -ExecutionPolicy Bypass -File tools\local\smoke-windows.ps1 -Yes -Only app-load
#>
[CmdletBinding()]
param(
  [switch]$Yes,
  [string]$Only,
  [switch]$SkipUnitTests
)

$ErrorActionPreference = 'Stop'
$Root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$Title = 'FakeGame'
$FakeDir = Join-Path $env:TEMP 'kayboro-fake\steamapps\common\FakeGame'
$OutDir = Join-Path $Root 'test\e2e\out'
$LogDir = Join-Path $Root 'test\local\out'
$Stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$Log = Join-Path $LogDir "smoke-$Stamp.log"

function Say([string]$s, [string]$color = 'Gray') { Write-Host $s -ForegroundColor $color }
function Stop-FakeGame([int]$GamePid) {
  if ($GamePid) { Stop-Process -Id $GamePid -Force -ErrorAction SilentlyContinue }
  # Electron's helper processes (GPU, renderer) live under the same folder: never leave one behind.
  Get-Process -Name electron -ErrorAction SilentlyContinue | Where-Object {
    try { $_.Path -and $_.Path.StartsWith($FakeDir, [StringComparison]::OrdinalIgnoreCase) } catch { $false }
  } | Stop-Process -Force -ErrorAction SilentlyContinue
}

if ($env:OS -ne 'Windows_NT') { throw 'smoke-windows.ps1 is for Windows. On Linux run: xvfb-run -a npm run smoke' }
Set-Location -LiteralPath $Root

# ---- Warning + countdown ---------------------------------------------------------------------------
Say ''
Say 'Kayboro Windows smoke test' 'Magenta'
Say 'For about a minute (up to 4) this test:' 'Yellow'
Say '  - moves windows between your displays,' 'Yellow'
Say '  - briefly confines the mouse to a magenta "FakeGame" window,' 'Yellow'
Say '  - shows an always-on-top, click-through Kayboro overlay.' 'Yellow'
Say "Save your work and don't touch the mouse or keyboard until it finishes. Press Ctrl+C now to cancel." 'Yellow'
if (-not $Yes) {
  for ($s = 5; $s -ge 1; $s--) { Write-Host -NoNewline "`rStarting in $s s... "; Start-Sleep -Seconds 1 }
  Write-Host "`rStarting now.        "
}

# ---- Prerequisites ---------------------------------------------------------------------------------
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw 'Node.js was not found. Install Node 22 LTS from https://nodejs.org and try again.' }
if (-not (Test-Path -LiteralPath (Join-Path $Root 'node_modules'))) {
  Say 'node_modules is missing: running npm ci...' 'Cyan'
  & npm ci
  if ($LASTEXITCODE -ne 0) { throw "npm ci failed ($LASTEXITCODE)" }
}
$ElectronDist = Join-Path $Root 'node_modules\electron\dist'
if (-not (Test-Path -LiteralPath (Join-Path $ElectronDist 'electron.exe'))) {
  # Electron 44 has no postinstall: fetch the binary now, as CI does.
  Say 'Downloading the Electron binary (node node_modules/electron/install.js)...' 'Cyan'
  & node node_modules/electron/install.js
  if ($LASTEXITCODE -ne 0) { throw "Electron download failed ($LASTEXITCODE)" }
}
if (-not $SkipUnitTests) {
  Say 'Running unit tests (npm test)...' 'Cyan'
  & npm test --silent
  if ($LASTEXITCODE -ne 0) { throw "Unit tests failed ($LASTEXITCODE). Fix them first, or pass -SkipUnitTests." }
}
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null

# The smoke test owns its environment: never run it inside the tester sandbox.
foreach ($v in 'KAYBORO_SANDBOX', 'KAYBORO_SANDBOX_DIR') { Remove-Item -LiteralPath "Env:$v" -ErrorAction SilentlyContinue }
$env:FAKE_GAME_TITLE = $Title
if ($Only) { $env:SMOKE_ONLY = $Only } else { Remove-Item Env:SMOKE_ONLY -ErrorAction SilentlyContinue }

$game = $null
$rc = 1
try {
  # ---- Fake Steam game (same as the CI step) -------------------------------------------------------
  Stop-FakeGame 0 # a leftover from a killed run would lock the files
  Add-Type -AssemblyName System.Windows.Forms
  Say "Primary screen: $([System.Windows.Forms.Screen]::PrimaryScreen.Bounds)"
  New-Item -ItemType Directory -Force -Path $FakeDir | Out-Null
  Copy-Item -Path (Join-Path $ElectronDist '*') -Destination $FakeDir -Recurse -Force
  $exe = Join-Path $FakeDir 'electron.exe'
  if (-not (Test-Path -LiteralPath $exe)) { throw "electron.exe was not copied to $FakeDir" }
  $app = Join-Path $Root 'test\e2e\fake-game'
  $game = Start-Process -FilePath $exe -ArgumentList "`"$app`"" -PassThru
  Say "Started fake game $exe (pid $($game.Id))"
  $deadline = (Get-Date).AddSeconds(90)
  while ($true) {
    $w = Get-Process -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowTitle -eq $Title } | Select-Object -First 1
    if ($w) { Say "Fake game window is up: pid $($w.Id), hwnd $($w.MainWindowHandle)" 'Green'; break }
    if ($game.HasExited) { throw "The fake game exited early with code $($game.ExitCode)" }
    if ((Get-Date) -gt $deadline) { throw 'The fake game window did not appear within 90 s' }
    Start-Sleep -Milliseconds 500
  }

  # ---- Smoke test --------------------------------------------------------------------------------
  Say 'Running npx electron test/e2e/smoke.js ...' 'Cyan'
  $ErrorActionPreference = 'Continue' # Electron writes harmless noise to stderr
  & npx electron test/e2e/smoke.js 2>&1 | ForEach-Object { "$_" } | Tee-Object -FilePath $Log
  $rc = $LASTEXITCODE
  $ErrorActionPreference = 'Stop'
} finally {
  Stop-FakeGame $(if ($game) { $game.Id } else { 0 })
  Say 'Fake game stopped.'
}

# ---- Where things are -------------------------------------------------------------------------------
$results = Join-Path $OutDir 'results.json'
Say ''
if (Test-Path -LiteralPath $results) {
  $r = Get-Content -Raw -LiteralPath $results | ConvertFrom-Json
  $n = { param($s) @($r.checks | Where-Object { $_.status -eq $s }).Count }
  $col = if ($r.ok) { 'Green' } else { 'Red' }
  Say ("Smoke {0}: {1} passed, {2} failed, {3} skipped in {4:N0} s" -f $(if ($r.ok) { 'PASSED' } else { 'FAILED' }), (& $n 'PASS'), (& $n 'FAIL'), (& $n 'SKIP'), ($r.durationMs / 1000)) $col
  foreach ($c in @($r.checks | Where-Object { $_.status -eq 'FAIL' })) { Say ("  FAIL {0}: {1}" -f $c.name, $c.detail) 'Red' }
  Say "Results:     $results"
  Say ("Screenshots: {0} ({1} PNGs)" -f $OutDir, @(Get-ChildItem -LiteralPath $OutDir -Filter '*.png' -ErrorAction SilentlyContinue).Count)
} else {
  Say "No results.json in ${OutDir}: the smoke test did not get far enough to write one." 'Red'
}
Say "Console log: $Log"
exit $rc
