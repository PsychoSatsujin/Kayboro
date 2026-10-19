<#
.SYNOPSIS
  Runs a built Kayboro with --self-test and prints PASS or FAIL.

.DESCRIPTION
  Contract (src/main, STEAM agent): `Kayboro.exe --self-test=<file.json>` boots normally, waits for the
  renderer, writes {ok, version, electron, platform, catalog: {frames, wallpapers}, steamworks, errors[]}
  to the file, prints "KAYBORO_SELFTEST <json>" and exits 0 (ok) or 1 within 30 s.
  The run uses the tester sandbox with its own folder (.sandbox\selftest-userData), so it never touches
  your real save and can never unlock Kayboro's own Steam achievements.
  Result file: test\local\out\selftest-<timestamp>.json. Exit code 0 on PASS, 1 on FAIL.

.PARAMETER Exe
  The app to test (default: dist\win-unpacked\Kayboro.exe). Also works with `electron .` style dev runs
  when given node_modules\electron\dist\electron.exe and -AppArgs '.'.
.PARAMETER AppArgs
  Extra arguments placed before --self-test (e.g. '.' for a dev run with electron.exe).
.PARAMETER TimeoutSeconds
  Kill the app and FAIL after this long (default 45: the contract says 30 s, plus start-up slack).

.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -File tools\local\self-test.ps1
  powershell -NoProfile -ExecutionPolicy Bypass -File tools\local\self-test.ps1 -Exe node_modules\electron\dist\electron.exe -AppArgs .
#>
[CmdletBinding()]
param(
  [string]$Exe,
  [string]$AppArgs = '',
  [int]$TimeoutSeconds = 45
)

$ErrorActionPreference = 'Stop'
$Root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
Set-Location -LiteralPath $Root
if (-not $Exe) { $Exe = Join-Path $Root 'dist\win-unpacked\Kayboro.exe' }
if (-not [IO.Path]::IsPathRooted($Exe)) { $Exe = Join-Path $Root $Exe }
$Out = Join-Path $Root 'test\local\out'
New-Item -ItemType Directory -Force -Path $Out | Out-Null
$Stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$File = Join-Path $Out "selftest-$Stamp.json"
$StdOut = Join-Path $Out "selftest-$Stamp.stdout.txt"
$StdErr = Join-Path $Out "selftest-$Stamp.stderr.txt"

function Fail([string]$why) {
  Write-Host ''
  Write-Host "SELF-TEST FAIL: $why" -ForegroundColor Red
  foreach ($f in $StdOut, $StdErr) { if ((Test-Path -LiteralPath $f) -and (Get-Item -LiteralPath $f).Length) { Write-Host "  See $f" } }
  exit 1
}

if (-not (Test-Path -LiteralPath $Exe)) { Fail "$Exe not found. Build it first (npm run dist:dir)." }

# Sandbox profile for the run: separate userData, Kayboro's own achievements off.
$env:KAYBORO_SANDBOX = '1'
$env:KAYBORO_SANDBOX_DIR = Join-Path $Root '.sandbox\selftest-userData'
Remove-Item Env:KAYBORO_TEST -ErrorAction SilentlyContinue

$argLine = (@(@($AppArgs) | Where-Object { $_ }) + @("`"--self-test=$File`"")) -join ' '
Write-Host "Running: $Exe $argLine"
$p = Start-Process -FilePath $Exe -ArgumentList $argLine -PassThru -RedirectStandardOutput $StdOut -RedirectStandardError $StdErr
$null = $p.Handle # keeps ExitCode readable after the process ends
if (-not $p.WaitForExit($TimeoutSeconds * 1000)) {
  Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue
  Fail "no result within $TimeoutSeconds s (the app was stopped)."
}
$code = $p.ExitCode

# The JSON file is the contract; the KAYBORO_SELFTEST stdout line is the fallback.
$json = $null
if (Test-Path -LiteralPath $File) { $json = Get-Content -Raw -LiteralPath $File }
elseif (Test-Path -LiteralPath $StdOut) {
  $line = Select-String -LiteralPath $StdOut -Pattern '^KAYBORO_SELFTEST (.+)$' | Select-Object -Last 1
  if ($line) { $json = $line.Matches[0].Groups[1].Value; Set-Content -LiteralPath $File -Value $json -Encoding UTF8 }
}
if (-not $json) { Fail "exit code $code and no self-test result. Does this build support --self-test yet?" }
try { $r = $json | ConvertFrom-Json } catch { Fail "the self-test result is not JSON: $json" }

Write-Host ''
Write-Host ("Kayboro {0}, Electron {1}, {2}" -f $r.version, $r.electron, $r.platform)
Write-Host ("Catalog: {0} shells, {1} wallpapers. Steamworks: {2}" -f $r.catalog.frames, $r.catalog.wallpapers, $(if ($r.steamworks) { 'loaded' } else { 'not loaded' }))
foreach ($e in @($r.errors)) { if ($e) { Write-Host "  error: $e" -ForegroundColor Yellow } }
Write-Host "Result: $File"
if ($r.ok -eq $true -and $code -eq 0) {
  Write-Host ''
  Write-Host 'SELF-TEST PASS' -ForegroundColor Green
  exit 0
}
Fail "ok=$($r.ok), exit code $code."
