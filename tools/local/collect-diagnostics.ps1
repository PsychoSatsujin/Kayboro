<#
.SYNOPSIS
  Zips what a Kayboro bug report needs into test\local\out\diagnostics-<timestamp>.zip.

.DESCRIPTION
  Read-only on every source: files are copied to a temporary folder, zipped, and the temporary folder
  is removed. Included, when present:
    - the latest environment report (runs check-environment.ps1 first when there is none)
    - the real profile:    %APPDATA%\Kayboro\kayboro\state.json, history.jsonl, selftest.json, *.log,
                           and %APPDATA%\Kayboro\scenes.json
    - the sandbox profile: the same files under .sandbox\userData (or KAYBORO_SANDBOX_DIR)
    - the last smoke run:  test\e2e\out\results.json and the latest test\local\out\smoke-*.log
                           (its screenshots only with -IncludeScreenshots: they can show your desktop)
    - the latest self-test result (test\local\out\selftest-*.json)
  Never included: mod files (only the mod folder names are listed), developer form submissions (they hold
  email addresses), browser storage, crash dumps, or anything outside Kayboro's own data folders.

.PARAMETER IncludeScreenshots
  Also add the smoke test PNGs from test\e2e\out.

.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -File tools\local\collect-diagnostics.ps1
#>
[CmdletBinding()]
param(
  [switch]$IncludeScreenshots
)

$ErrorActionPreference = 'Stop'
$Root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$Out = Join-Path $Root 'test\local\out'
New-Item -ItemType Directory -Force -Path $Out | Out-Null
$Stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$Zip = Join-Path $Out "diagnostics-$Stamp.zip"
$Stage = Join-Path ([IO.Path]::GetTempPath()) "kayboro-diagnostics-$Stamp"
$manifest = New-Object System.Collections.Generic.List[string]

function Latest([string]$dir, [string]$filter) {
  Get-ChildItem -LiteralPath $dir -Filter $filter -File -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1
}
# Copies one file into the staging folder under $dest (relative), if it exists.
function Add-File([string]$src, [string]$dest) {
  if (-not (Test-Path -LiteralPath $src -PathType Leaf)) { return }
  $target = Join-Path $Stage $dest
  New-Item -ItemType Directory -Force -Path (Split-Path -Parent $target) | Out-Null
  Copy-Item -LiteralPath $src -Destination $target
  $manifest.Add(("{0,-40} <- {1} ({2:N0} bytes)" -f $dest, $src, (Get-Item -LiteralPath $src).Length))
}
# A profile folder (<userData>): economy state, logs and scenes. Mods are listed by name only.
function Add-Profile([string]$userData, [string]$name) {
  $data = Join-Path $userData 'kayboro'
  if (-not (Test-Path -LiteralPath $data)) { $manifest.Add("${name}: none at $userData"); return }
  foreach ($f in 'state.json', 'history.jsonl', 'selftest.json') { Add-File (Join-Path $data $f) "$name\kayboro\$f" }
  Get-ChildItem -LiteralPath $data -Filter '*.log' -File -ErrorAction SilentlyContinue | ForEach-Object { Add-File $_.FullName "$name\kayboro\$($_.Name)" }
  Add-File (Join-Path $userData 'scenes.json') "$name\scenes.json"
  $mods = Join-Path $data 'mods'
  if (Test-Path -LiteralPath $mods) {
    $names = @(Get-ChildItem -LiteralPath $mods -Directory -ErrorAction SilentlyContinue | ForEach-Object { $_.Name })
    $list = Join-Path $Stage "$name\mods-installed.txt"
    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $list) | Out-Null
    $(if ($names.Count) { $names } else { '(no mods)' }) | Set-Content -LiteralPath $list -Encoding UTF8
    $manifest.Add("$name\mods-installed.txt".PadRight(40) + " <- folder names in $mods")
  }
  $dumps = @(Get-ChildItem -LiteralPath (Join-Path $userData 'Crashpad\reports') -File -ErrorAction SilentlyContinue).Count
  if ($dumps) { $manifest.Add("${name}: $dumps crash dump(s) in $userData\Crashpad\reports (not included; attach by hand if asked)") }
}

try {
  New-Item -ItemType Directory -Force -Path $Stage | Out-Null

  # Environment report (make one when there is none yet).
  $env1 = Latest $Out 'environment-*.txt'
  if (-not $env1) {
    Write-Host 'No environment report yet: running check-environment.ps1 first...' -ForegroundColor Cyan
    & (Join-Path $PSScriptRoot 'check-environment.ps1') | Out-Host
    $env1 = Latest $Out 'environment-*.txt'
  }
  if ($env1) { Add-File $env1.FullName "environment\$($env1.Name)" }

  # Profiles.
  Add-Profile (Join-Path $env:APPDATA 'Kayboro') 'real-profile'
  $sb = if ($env:KAYBORO_SANDBOX_DIR) { $env:KAYBORO_SANDBOX_DIR } else { Join-Path $Root '.sandbox\userData' }
  Add-Profile $sb 'sandbox-profile'
  Add-Profile (Join-Path $Root '.sandbox\selftest-userData') 'selftest-profile'

  # Last smoke run and self-test.
  $e2e = Join-Path $Root 'test\e2e\out'
  Add-File (Join-Path $e2e 'results.json') 'smoke\results.json'
  $slog = Latest $Out 'smoke-*.log'
  if ($slog) { Add-File $slog.FullName "smoke\$($slog.Name)" }
  if ($IncludeScreenshots) { Get-ChildItem -LiteralPath $e2e -Filter '*.png' -File -ErrorAction SilentlyContinue | ForEach-Object { Add-File $_.FullName "smoke\$($_.Name)" } }
  $st = Latest $Out 'selftest-*.json'
  if ($st) { Add-File $st.FullName "selftest\$($st.Name)" }

  # Manifest: what is in the zip and where it came from.
  $pkg = Get-Content -Raw -LiteralPath (Join-Path $Root 'package.json') | ConvertFrom-Json
  $head = @("Kayboro diagnostics $Stamp", "Kayboro $($pkg.version) at $Root", "Windows $([Environment]::OSVersion.Version)", '', 'Files:')
  ($head + $manifest) | Set-Content -LiteralPath (Join-Path $Stage 'MANIFEST.txt') -Encoding UTF8

  Compress-Archive -Path (Join-Path $Stage '*') -DestinationPath $Zip -Force
} finally {
  Remove-Item -LiteralPath $Stage -Recurse -Force -ErrorAction SilentlyContinue
}

Write-Host ''
Write-Host 'Kayboro diagnostics' -ForegroundColor Magenta
foreach ($m in $manifest) { Write-Host "  $m" }
Write-Host ''
Write-Host "Saved: $Zip" -ForegroundColor Green
Write-Host 'Check it before you share it: state.json lists the names of games you hosted in Kayboro.'
exit 0
