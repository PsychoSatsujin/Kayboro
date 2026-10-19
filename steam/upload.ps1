<#
.SYNOPSIS
  Uploads a Kayboro build to Steam with SteamPipe (steamcmd + run_app_build).

.DESCRIPTION
  Fills steam/scripts/*.vdf.template with your app and depot ids, writes the result to steam/out/,
  checks that dist/win-unpacked (from `npm run dist:dir` or `npm run dist:steam`) exists and holds no
  steam_appid.txt, finds steamcmd.exe and runs it. steamcmd asks for your Steam password and Steam Guard
  code itself, in its own prompt: this script never receives, passes or stores a password.

.PARAMETER AppId        Your Steamworks app id (or env KAYBORO_STEAM_APPID).
.PARAMETER DepotWin     The Windows depot id (or env KAYBORO_STEAM_DEPOT_WIN). Usually AppId + 1.
.PARAMETER DepotLinux   Optional Linux depot id (or env KAYBORO_STEAM_DEPOT_LINUX); needs dist/linux-unpacked.
.PARAMETER Branch       Branch to set live after the upload, for example "beta". Empty = none ("default" must
                        be published by hand on Steamworks anyway).
.PARAMETER Desc         Build description shown in the Steamworks Builds list. Default: version + date.
.PARAMETER Preview      Dry run: steamcmd only logs what it would upload (Preview "1" in the vdf).
.PARAMETER NoUpload     Only write the filled vdf files to steam/out/ and stop.
.PARAMETER SteamCmd     Path to steamcmd.exe (or env STEAMCMD). Searched in PATH, %STEAMWORKS_SDK%\tools\ContentBuilder\builder,
                        C:\steamcmd and C:\steamworks_sdk\tools\ContentBuilder\builder when omitted.
.PARAMETER Username     Steam account name with upload rights to the app (or env KAYBORO_STEAM_USER). Asked for when missing.

.EXAMPLE
  npm run dist:steam
  powershell -File steam/upload.ps1 -AppId 1234560 -DepotWin 1234561 -Preview
  powershell -File steam/upload.ps1 -AppId 1234560 -DepotWin 1234561 -Branch beta
#>
param(
  [int]$AppId = [int]$env:KAYBORO_STEAM_APPID,
  [int]$DepotWin = [int]$env:KAYBORO_STEAM_DEPOT_WIN,
  [int]$DepotLinux = [int]$env:KAYBORO_STEAM_DEPOT_LINUX,
  [string]$Branch = '',
  [string]$Desc = '',
  [switch]$Preview,
  [switch]$NoUpload,
  [string]$SteamCmd = $env:STEAMCMD,
  [string]$Username = $env:KAYBORO_STEAM_USER
)
$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$dist = Join-Path $root 'dist'
$winRoot = Join-Path $dist 'win-unpacked'
$linuxRoot = Join-Path $dist 'linux-unpacked'
$outDir = Join-Path $PSScriptRoot 'out'
$scripts = Join-Path $PSScriptRoot 'scripts'

function Fail($msg) { Write-Host "upload: $msg" -ForegroundColor Red; exit 1 }

if ($AppId -le 0) { Fail 'missing -AppId (or set KAYBORO_STEAM_APPID). It is the number in your Steamworks app URL.' }
if ($DepotWin -le 0) { Fail 'missing -DepotWin (or set KAYBORO_STEAM_DEPOT_WIN). Steamworks > App Admin > Depots lists it.' }
if (-not (Test-Path (Join-Path $winRoot 'Kayboro.exe'))) { Fail 'dist\win-unpacked\Kayboro.exe not found. Run "npm run dist:steam" first.' }
if (Test-Path (Join-Path $winRoot 'steam_appid.txt')) { Fail 'dist\win-unpacked contains steam_appid.txt. Delete it: a shipped app id breaks the overlay and ownership checks.' }
if ($DepotLinux -gt 0 -and -not (Test-Path $linuxRoot)) { Fail '-DepotLinux given but dist\linux-unpacked is missing. Run "npm run dist:linux" first (or drop -DepotLinux).' }

$version = (Get-Content (Join-Path $root 'package.json') -Raw | ConvertFrom-Json).version
if (-not $Desc) { $Desc = "Kayboro $version ($(Get-Date -Format 'yyyy-MM-dd HH:mm'))" }
New-Item -ItemType Directory -Force (Join-Path $outDir 'logs') | Out-Null

function Fill($template, $map) {
  $text = Get-Content (Join-Path $scripts $template) -Raw
  foreach ($k in $map.Keys) { $text = $text.Replace('{{' + $k + '}}', [string]$map[$k]) }
  if ($text -match '\{\{[A-Z_]+\}\}') { Fail "unfilled placeholder $($Matches[0]) in $template" }
  return $text
}

# The Kayboro Virtual Screen Driver (dist\win-unpacked\driver, copied by `npm run dist:steam`) is installed by
# Steam's install script on first launch. Without it the depot ships no install script.
$installScript = ''
if (Test-Path (Join-Path $winRoot 'driver\kbvdd-setup.exe')) {
  Set-Content -Encoding ascii (Join-Path $winRoot 'installscript.vdf') (Fill 'installscript.vdf.template' @{ APPID = $AppId })
  $installScript = '"InstallScript" "installscript.vdf"'
  Write-Host 'upload: the Kayboro Virtual Screen Driver and its install script are in the depot.'
} else {
  Remove-Item -ErrorAction SilentlyContinue (Join-Path $winRoot 'installscript.vdf')
  Write-Host 'upload: no driver in dist\win-unpacked\driver: Hide Game Window will not work for players. Build it with driver\build.cmd (signed) first.' -ForegroundColor Yellow
}

# Depot scripts carry an absolute ContentRoot each, so the app script's ContentRoot is only a base.
$winVdf = "depot_build_$DepotWin.vdf"
Set-Content -Encoding ascii (Join-Path $outDir $winVdf) (Fill 'depot_build_win.vdf.template' @{ DEPOT_WIN = $DepotWin; CONTENT_ROOT = $winRoot; INSTALLSCRIPT = $installScript })
$depots = "`t`t`"$DepotWin`" `"$winVdf`""
if ($DepotLinux -gt 0) {
  $linuxVdf = "depot_build_$DepotLinux.vdf"
  Set-Content -Encoding ascii (Join-Path $outDir $linuxVdf) (Fill 'depot_build_linux.vdf.template' @{ DEPOT_LINUX = $DepotLinux; CONTENT_ROOT = $linuxRoot })
  $depots += "`n`t`t`"$DepotLinux`" `"$linuxVdf`""
}
$previewFlag = '0'
if ($Preview) { $previewFlag = '1' }
$appVdf = Join-Path $outDir "app_build_$AppId.vdf"
Set-Content -Encoding ascii $appVdf (Fill 'app_build.vdf.template' @{
  APPID = $AppId; DESC = $Desc.Replace('"', "'"); PREVIEW = $previewFlag; BRANCH = $Branch
  CONTENT_ROOT_PARENT = $dist; BUILD_OUTPUT = (Join-Path $outDir 'logs'); DEPOTS = $depots
})
Write-Host "upload: wrote $appVdf" -ForegroundColor Cyan
Write-Host "upload: content $winRoot" -ForegroundColor Cyan
if ($NoUpload) { Write-Host 'upload: -NoUpload given, stopping here.'; exit 0 }

# steamcmd: explicit path, env, PATH, then the usual SDK locations.
if (-not $SteamCmd) {
  $candidates = @()
  $onPath = Get-Command steamcmd.exe -ErrorAction SilentlyContinue
  if ($onPath) { $candidates += $onPath.Source }
  if ($env:STEAMWORKS_SDK) { $candidates += (Join-Path $env:STEAMWORKS_SDK 'tools\ContentBuilder\builder\steamcmd.exe') }
  $candidates += 'C:\steamcmd\steamcmd.exe', 'C:\steamworks_sdk\tools\ContentBuilder\builder\steamcmd.exe', (Join-Path $root 'steam\sdk\tools\ContentBuilder\builder\steamcmd.exe')
  $SteamCmd = $candidates | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1
}
if (-not $SteamCmd -or -not (Test-Path $SteamCmd)) {
  Write-Host 'upload: steamcmd.exe not found.' -ForegroundColor Yellow
  Write-Host '  Download the Steamworks SDK from https://partner.steamgames.com/downloads/steamworks_sdk.zip (partner login),'
  Write-Host '  unzip it, then pass -SteamCmd "<sdk>\tools\ContentBuilder\builder\steamcmd.exe" or set STEAMWORKS_SDK=<sdk>.'
  Write-Host '  Standalone: https://developer.valvesoftware.com/wiki/SteamCMD (unzip to C:\steamcmd).'
  Write-Host "  The filled scripts are ready in $outDir; you can also run steamcmd by hand:"
  Write-Host "    steamcmd +login <account> +run_app_build `"$appVdf`" +quit"
  exit 2
}
if (-not $Username) { $Username = Read-Host 'Steam account name (steamcmd asks for the password and Steam Guard code itself)' }
if (-not $Username) { Fail 'no account name given.' }

$depotList = "$DepotWin"
if ($DepotLinux -gt 0) { $depotList += " + $DepotLinux" }
Write-Host "upload: $SteamCmd  app $AppId  depot $depotList  preview=$previewFlag  branch='$Branch'" -ForegroundColor Cyan
# The password is typed into steamcmd's own prompt; it is never an argument of this script.
& $SteamCmd +login $Username +run_app_build "$appVdf" +quit
$rc = $LASTEXITCODE
if ($rc -ne 0) { Fail "steamcmd exited with $rc. Logs: $outDir\logs" }
Write-Host "upload: done. Check Steamworks > App Admin > Builds (logs in $outDir\logs)." -ForegroundColor Green
if ($Branch -eq '' -and -not $Preview) { Write-Host 'upload: the build is not live on any branch yet; set it live on the Builds page.' }
exit 0
