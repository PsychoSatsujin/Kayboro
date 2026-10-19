<#
.SYNOPSIS
  Read-only check of this PC for Kayboro testing: Windows, displays, GPUs, Node/npm, Electron, koffi,
  Steam, Wallpaper Engine, Virtual Display Driver and free disk space.

.DESCRIPTION
  Changes nothing on the machine. Writes one report to test\local\out\environment-<timestamp>.txt and
  prints a short summary. Windows PowerShell 5.1 or PowerShell 7.

.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -File tools\local\check-environment.ps1
#>
[CmdletBinding()]
param(
  # Where the report goes (default: <repo>\test\local\out).
  [string]$OutDir
)

$ErrorActionPreference = 'Continue'
$Root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
if (-not $OutDir) { $OutDir = Join-Path $Root 'test\local\out' }
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
$Stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$Report = Join-Path $OutDir "environment-$Stamp.txt"

$lines = New-Object System.Collections.Generic.List[string]
$summary = New-Object System.Collections.Generic.List[string]
$warnings = New-Object System.Collections.Generic.List[string]
function Add-Line([string]$s = '') { $lines.Add($s) }
function Add-Section([string]$t) { $lines.Add(''); $lines.Add("== $t " + ('=' * [Math]::Max(3, 60 - $t.Length))) }
function Add-Summary([string]$k, [string]$v) { $summary.Add(('{0,-18} {1}' -f ($k + ':'), $v)) }
function Add-Warning([string]$s) { $warnings.Add($s) }
function Try-Get([scriptblock]$b) { try { & $b } catch { $null } }

Add-Line "Kayboro environment report"
Add-Line ("Generated: {0}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss zzz'))
Add-Line "Repo:      $Root"
Add-Line "Computer:  $env:COMPUTERNAME (user names and serial numbers are not recorded)"

# ---- Windows -------------------------------------------------------------------------------------
Add-Section 'Windows'
$os = Try-Get { Get-CimInstance Win32_OperatingSystem }
$cv = Try-Get { Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion' }
$build = if ($cv) { "$($cv.CurrentBuildNumber).$($cv.UBR)" } else { [Environment]::OSVersion.Version.ToString() }
$osName = if ($os) { $os.Caption } else { 'Windows' }
$disp = if ($cv -and $cv.DisplayVersion) { $cv.DisplayVersion } else { '' }
Add-Line "OS:            $osName $disp"
Add-Line "Build:         $build"
Add-Line ("Architecture:  {0}" -f $(if ($os) { $os.OSArchitecture } else { $env:PROCESSOR_ARCHITECTURE }))
$cpu = Try-Get { (Get-CimInstance Win32_Processor | Select-Object -First 1) }
if ($cpu) { Add-Line ("CPU:           {0} ({1} cores, {2} threads)" -f $cpu.Name.Trim(), $cpu.NumberOfCores, $cpu.NumberOfLogicalProcessors) }
if ($os) { Add-Line ("RAM:           {0:N1} GB" -f ($os.TotalVisibleMemorySize / 1MB)) }
$hags = Try-Get { (Get-ItemProperty 'HKLM:\SYSTEM\CurrentControlSet\Control\GraphicsDrivers' -Name HwSchMode -ErrorAction Stop).HwSchMode }
Add-Line ("GPU scheduling: {0}" -f $(switch ($hags) { 2 { 'hardware-accelerated (on)' } 1 { 'off' } default { 'default (not set)' } }))
Add-Summary 'Windows' "$osName $disp (build $build)"

# ---- Displays ------------------------------------------------------------------------------------
Add-Section 'Displays'
$displaySrc = @'
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
public static class KbDisplays {
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left, Top, Right, Bottom; }
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
  public struct MONITORINFOEX { public int cbSize; public RECT rcMonitor; public RECT rcWork; public uint dwFlags;
    [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 32)] public string szDevice; }
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
  public struct DEVMODE {
    [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 32)] public string dmDeviceName;
    public short dmSpecVersion, dmDriverVersion, dmSize, dmDriverExtra; public int dmFields;
    public int dmPositionX, dmPositionY, dmDisplayOrientation, dmDisplayFixedOutput;
    public short dmColor, dmDuplex, dmYResolution, dmTTOption, dmCollate;
    [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 32)] public string dmFormName;
    public short dmLogPixels; public int dmBitsPerPel, dmPelsWidth, dmPelsHeight, dmDisplayFlags, dmDisplayFrequency;
    public int dmICMMethod, dmICMIntent, dmMediaType, dmDitherType, dmReserved1, dmReserved2, dmPanningWidth, dmPanningHeight; }
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
  public struct DISPLAY_DEVICE { public int cb;
    [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 32)] public string DeviceName;
    [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 128)] public string DeviceString;
    public int StateFlags;
    [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 128)] public string DeviceID;
    [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 128)] public string DeviceKey; }
  delegate bool MonitorEnumProc(IntPtr h, IntPtr hdc, ref RECT r, IntPtr data);
  [DllImport("user32.dll")] static extern bool EnumDisplayMonitors(IntPtr hdc, IntPtr clip, MonitorEnumProc cb, IntPtr data);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern bool GetMonitorInfo(IntPtr h, ref MONITORINFOEX mi);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern bool EnumDisplaySettings(string dev, int mode, ref DEVMODE dm);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern bool EnumDisplayDevices(string dev, uint i, ref DISPLAY_DEVICE dd, uint flags);
  [DllImport("shcore.dll")] static extern int GetDpiForMonitor(IntPtr h, int type, out uint x, out uint y);
  [DllImport("user32.dll")] static extern IntPtr SetThreadDpiAwarenessContext(IntPtr ctx);
  public class Info { public string Device, Adapter, Monitor; public int X, Y, Width, Height, Hz, Bits, Dpi, Orientation; public bool Primary; }
  public static List<Info> Get() {
    var list = new List<Info>();
    IntPtr old = IntPtr.Zero;
    try { old = SetThreadDpiAwarenessContext(new IntPtr(-4)); } catch { } // per-monitor v2: real pixels and DPI
    try {
      EnumDisplayMonitors(IntPtr.Zero, IntPtr.Zero, delegate (IntPtr h, IntPtr hdc, ref RECT r, IntPtr d) {
        var mi = new MONITORINFOEX(); mi.cbSize = Marshal.SizeOf(typeof(MONITORINFOEX));
        if (!GetMonitorInfo(h, ref mi)) return true;
        var dm = new DEVMODE(); dm.dmSize = (short)Marshal.SizeOf(typeof(DEVMODE));
        EnumDisplaySettings(mi.szDevice, -1, ref dm);
        uint dx = 96, dy = 96;
        try { GetDpiForMonitor(h, 0, out dx, out dy); } catch { }
        var ad = new DISPLAY_DEVICE(); ad.cb = Marshal.SizeOf(typeof(DISPLAY_DEVICE));
        string adapter = "", monitor = "";
        for (uint i = 0; EnumDisplayDevices(null, i, ref ad, 0); i++) {
          if (ad.DeviceName == mi.szDevice) {
            adapter = ad.DeviceString;
            var md = new DISPLAY_DEVICE(); md.cb = Marshal.SizeOf(typeof(DISPLAY_DEVICE));
            if (EnumDisplayDevices(ad.DeviceName, 0, ref md, 0)) monitor = md.DeviceString;
            break;
          }
          ad.cb = Marshal.SizeOf(typeof(DISPLAY_DEVICE));
        }
        list.Add(new Info { Device = mi.szDevice, Adapter = adapter, Monitor = monitor, X = mi.rcMonitor.Left, Y = mi.rcMonitor.Top,
          Width = dm.dmPelsWidth > 0 ? dm.dmPelsWidth : mi.rcMonitor.Right - mi.rcMonitor.Left,
          Height = dm.dmPelsHeight > 0 ? dm.dmPelsHeight : mi.rcMonitor.Bottom - mi.rcMonitor.Top,
          Hz = dm.dmDisplayFrequency, Bits = dm.dmBitsPerPel, Dpi = (int)dx, Orientation = dm.dmDisplayOrientation, Primary = (mi.dwFlags & 1) != 0 });
        return true;
      }, IntPtr.Zero);
    } finally { if (old != IntPtr.Zero) try { SetThreadDpiAwarenessContext(old); } catch { } }
    return list;
  }
}
'@
$monitors = @()
try {
  if (-not ('KbDisplays' -as [type])) { Add-Type -TypeDefinition $displaySrc -Language CSharp -ErrorAction Stop }
  $monitors = @([KbDisplays]::Get())
} catch { Add-Line "Display query failed: $($_.Exception.Message)" }
$friendly = @(Try-Get { Get-CimInstance -Namespace root\wmi -ClassName WmiMonitorID -ErrorAction Stop } | ForEach-Object {
  $n = ($_.UserFriendlyName | Where-Object { $_ -ne 0 } | ForEach-Object { [char]$_ }) -join ''
  if ($n) { $n }
})
$i = 0
foreach ($m in $monitors) {
  $i++
  $scale = [Math]::Round($m.Dpi / 96 * 100)
  $ratio = if ($m.Height -gt 0) { [Math]::Round($m.Width / $m.Height, 2) } else { 0 }
  $shape = if ($m.Height -gt $m.Width) { 'portrait' } elseif ($ratio -ge 3.4) { '32:9 super ultrawide' } elseif ($ratio -ge 2.2) { '21:9 ultrawide' } elseif ($ratio -ge 1.7) { '16:9' } elseif ($ratio -ge 1.55) { '16:10' } else { "${ratio}:1" }
  $tag = if ($m.Primary) { ' [primary]' } else { '' }
  Add-Line ("#{0}{1} {2}" -f $i, $tag, $m.Device)
  Add-Line ("   {0} x {1} px @ {2} Hz, {3}% scaling ({4} DPI), {5}, {6}-bit, at ({7},{8})" -f $m.Width, $m.Height, $m.Hz, $scale, $m.Dpi, $shape, $m.Bits, $m.X, $m.Y)
  Add-Line ("   Adapter: {0}; monitor: {1}" -f $m.Adapter, $m.Monitor)
  Add-Summary ("Display $i") ("{0}x{1} @{2}Hz {3}%{4}" -f $m.Width, $m.Height, $m.Hz, $scale, $(if ($m.Primary) { ' primary' } else { '' }))
}
if ($friendly.Count) { Add-Line ("Monitor names (EDID): {0}" -f ($friendly -join '; ')) }
if ($monitors.Count -gt 1) {
  $dpis = @($monitors | ForEach-Object { $_.Dpi } | Sort-Object -Unique)
  Add-Line ("Mixed DPI: {0}" -f $(if ($dpis.Count -gt 1) { 'yes (' + (($dpis | ForEach-Object { [Math]::Round($_ / 96 * 100).ToString() + '%' }) -join ', ') + ')' } else { 'no' }))
}
if (-not $monitors.Count) { Add-Warning 'No displays found (remote session or query failed).' }

# ---- GPUs ----------------------------------------------------------------------------------------
Add-Section 'GPUs'
$gpus = @(Try-Get { Get-CimInstance Win32_VideoController -ErrorAction Stop })
foreach ($g in $gpus) {
  $date = if ($g.DriverDate) { ([datetime]$g.DriverDate).ToString('yyyy-MM-dd') } else { '?' }
  $vram = if ($g.AdapterRAM -gt 0) { '{0:N1} GB+' -f ($g.AdapterRAM / 1GB) } else { '?' }
  Add-Line ("{0}" -f $g.Name)
  Add-Line ("   driver {0} ({1}), status {2}, VRAM (reported, capped at 4 GB) {3}, mode {4}" -f $g.DriverVersion, $date, $g.Status, $vram, $g.VideoModeDescription)
}
$realGpus = @($gpus | Where-Object { $_.Name -notmatch 'Virtual|Idd|Basic Display|Remote|Parsec|Meta|Mirage' })
Add-Summary 'GPUs' (($gpus | ForEach-Object { "$($_.Name) [$($_.DriverVersion)]" }) -join '; ')
if ($realGpus.Count -gt 1) { Add-Line 'Hybrid or multi-GPU system: test Kayboro on each GPU (Windows Settings > System > Display > Graphics).' }
if (@($gpus | Where-Object { $_.Name -match 'Basic Display' }).Count) { Add-Warning 'Microsoft Basic Display Adapter in use: install the GPU driver before testing.' }

# ---- Node, npm, Electron, koffi ------------------------------------------------------------------
Add-Section 'Node, npm, Electron, koffi'
$node = Get-Command node -ErrorAction SilentlyContinue
$nodeV = if ($node) { (& node --version 2>$null) } else { $null }
$npmV = if (Get-Command npm -ErrorAction SilentlyContinue) { (& npm --version 2>$null) } else { $null }
Add-Line ("Node:      {0}{1}" -f $(if ($nodeV) { $nodeV } else { 'not found' }), $(if ($node) { " ($($node.Source))" } else { '' }))
Add-Line ("npm:       {0}" -f $(if ($npmV) { $npmV } else { 'not found' }))
if (-not $nodeV) { Add-Warning 'Node.js is missing: install Node 22 LTS from https://nodejs.org.' }
elseif ([int](($nodeV -replace '^v', '').Split('.')[0]) -lt 18) { Add-Warning "Node $nodeV is too old: Kayboro needs Node 18+ (CI uses 22)." }
Add-Summary 'Node / npm' ("{0} / {1}" -f $(if ($nodeV) { $nodeV } else { 'missing' }), $(if ($npmV) { $npmV } else { 'missing' }))

$nm = Join-Path $Root 'node_modules'
$ePkg = Join-Path $nm 'electron\package.json'
$eExe = Join-Path $nm 'electron\dist\electron.exe'
$eVer = if (Test-Path -LiteralPath $ePkg) { (Get-Content -Raw -LiteralPath $ePkg | ConvertFrom-Json).version } else { $null }
$eDist = if (Test-Path -LiteralPath (Join-Path $nm 'electron\dist\version')) { (Get-Content -Raw -LiteralPath (Join-Path $nm 'electron\dist\version')).Trim() } else { $null }
Add-Line ("node_modules: {0}" -f $(if (Test-Path -LiteralPath $nm) { 'present' } else { 'missing (run npm ci)' }))
Add-Line ("Electron:  package {0}; binary {1}" -f $(if ($eVer) { $eVer } else { 'missing' }), $(if (Test-Path -LiteralPath $eExe) { "present ($eDist)" } else { 'missing (downloads on first npm start, or run: node node_modules/electron/install.js)' }))
Add-Summary 'Electron' $(if (Test-Path -LiteralPath $eExe) { "$eVer (binary present)" } elseif ($eVer) { "$eVer (binary not downloaded yet)" } else { 'not installed' })
if (-not (Test-Path -LiteralPath $nm)) { Add-Warning 'node_modules is missing: run npm ci (the .bat launchers do it for you).' }

$koffi = 'not checked'
if ($nodeV -and (Test-Path -LiteralPath (Join-Path $nm 'koffi'))) {
  Push-Location $Root
  try {
    $out = & node -e "const k=require('koffi');console.log('ok '+require('koffi/package.json').version+' '+process.arch)" 2>&1
    $koffi = if ($LASTEXITCODE -eq 0) { ($out | Select-Object -Last 1) } else { 'FAILED: ' + (($out | Out-String).Trim() -split "`n" | Select-Object -First 1) }
  } finally { Pop-Location }
} elseif ($nodeV) { $koffi = 'not installed (run npm ci)' }
Add-Line "koffi:     $koffi"
Add-Summary 'koffi' $koffi
if ($koffi -like 'FAILED*') { Add-Warning 'koffi does not load: play mode, window moving and Steam detection will be off. Run npm ci again.' }

# ---- Steam ---------------------------------------------------------------------------------------
Add-Section 'Steam'
$steam = Try-Get { Get-ItemProperty 'HKCU:\Software\Valve\Steam' -ErrorAction Stop }
$steamPath = if ($steam -and $steam.SteamPath) { ($steam.SteamPath -replace '/', '\') } else { $null }
$libraries = @()
if ($steamPath -and (Test-Path -LiteralPath $steamPath)) {
  Add-Line "Install:   $steamPath"
  $running = Try-Get { (Get-ItemProperty 'HKCU:\Software\Valve\Steam\ActiveProcess' -ErrorAction Stop).pid }
  Add-Line ("Running:   {0}" -f $(if ($running -and $running -ne 0) { "yes (pid $running)" } else { 'no' }))
  $vdf = Join-Path $steamPath 'steamapps\libraryfolders.vdf'
  if (Test-Path -LiteralPath $vdf) {
    $libraries = @(Select-String -LiteralPath $vdf -Pattern '^\s*"path"\s*"(.+)"' | ForEach-Object { $_.Matches[0].Groups[1].Value -replace '\\\\', '\' })
  }
  if (-not $libraries.Count) { $libraries = @($steamPath) }
  foreach ($l in $libraries) {
    $apps = @(Get-ChildItem -LiteralPath (Join-Path $l 'steamapps') -Filter 'appmanifest_*.acf' -ErrorAction SilentlyContinue).Count
    Add-Line ("Library:   {0} ({1} installed apps{2})" -f $l, $apps, $(if (Test-Path -LiteralPath $l) { '' } else { ', folder missing' }))
  }
  Add-Summary 'Steam' ("{0}, {1} librar{2}" -f $steamPath, $libraries.Count, $(if ($libraries.Count -eq 1) { 'y' } else { 'ies' }))
} else {
  Add-Line 'Steam:     not installed (HKCU\Software\Valve\Steam has no SteamPath)'
  Add-Summary 'Steam' 'not installed'
}

# ---- Wallpaper Engine ----------------------------------------------------------------------------
Add-Section 'Wallpaper Engine'
$we = $null; $weItems = 0
foreach ($l in $libraries) {
  $p = Join-Path $l 'steamapps\common\wallpaper_engine'
  if (-not $we -and (Test-Path -LiteralPath $p)) { $we = $p }
  $ws = Join-Path $l 'steamapps\workshop\content\431960'
  if (Test-Path -LiteralPath $ws) { $weItems += @(Get-ChildItem -LiteralPath $ws -Directory -ErrorAction SilentlyContinue).Count }
}
Add-Line ("Installed: {0}" -f $(if ($we) { $we } else { 'no' }))
Add-Line "Workshop wallpapers (subscribed, on disk): $weItems"
Add-Summary 'Wallpaper Engine' $(if ($we) { "installed, $weItems workshop items" } else { 'not installed' })

# ---- Virtual Display Driver ----------------------------------------------------------------------
Add-Section 'Virtual Display Driver (IddCx)'
$pnp = @(Try-Get { Get-PnpDevice -Class Display -ErrorAction Stop })
foreach ($d in $pnp) { Add-Line ("{0,-8} {1}  [{2}]" -f $d.Status, $d.FriendlyName, $d.InstanceId) }
# The open-source Virtual Display Driver (README) installs as "Virtual Display Driver" (MttVDD / IddSampleDriver).
$vdd = @($pnp | Where-Object { $_.FriendlyName -match 'Virtual Display Driver|IddSample|MttVDD' -or $_.InstanceId -match 'MttVDD|IddSample' })
$virt = @($pnp | Where-Object { $vdd -notcontains $_ -and ($_.FriendlyName -match 'Virtual|Idd' -or $_.InstanceId -match '^ROOT\\DISPLAY') })
$fmtDev = { param($list) ($list | ForEach-Object { "$($_.FriendlyName) ($($_.Status))" }) -join '; ' }
if ($vdd.Count) {
  Add-Line ("Virtual Display Driver: {0}" -f (& $fmtDev $vdd))
  Add-Summary 'Virtual display' ("VDD: {0}" -f (& $fmtDev $vdd))
} else {
  Add-Line 'Virtual Display Driver: not installed. Optional, see README "Virtual display setup".'
  Add-Summary 'Virtual display' 'VDD not installed (optional)'
}
if ($virt.Count) {
  Add-Line ("Other virtual adapters: {0}" -f (& $fmtDev $virt))
  $summary[$summary.Count - 1] += ("; other: {0}" -f (& $fmtDev $virt))
}

# ---- Disk ----------------------------------------------------------------------------------------
Add-Section 'Disk'
$drive = (Split-Path -Qualifier $Root)
$disk = Try-Get { Get-CimInstance Win32_LogicalDisk -Filter "DeviceID='$drive'" -ErrorAction Stop }
if ($disk) {
  $free = $disk.FreeSpace / 1GB
  Add-Line ("{0} {1:N1} GB free of {2:N1} GB ({3})" -f $drive, $free, ($disk.Size / 1GB), $disk.FileSystem)
  Add-Summary ("Free on " + $drive.TrimEnd(':')) ('{0:N1} GB' -f $free)
  if ($free -lt 5) { Add-Warning ("Only {0:N1} GB free on {1}: packaged builds need about 1 GB, smoke runs a few hundred MB." -f $free, $drive) }
}

# ---- Kayboro data ----------------------------------------------------------------------------------
Add-Section 'Kayboro data folders'
$userData = Join-Path $env:APPDATA 'Kayboro'
$sb = if ($env:KAYBORO_SANDBOX_DIR) { $env:KAYBORO_SANDBOX_DIR } else { Join-Path $Root '.sandbox\userData' }
foreach ($p in @(@('Real profile', (Join-Path $userData 'kayboro\state.json')), @('Sandbox profile', (Join-Path $sb 'kayboro\state.json')), @('Legacy Shellcade', (Join-Path $env:APPDATA 'Shellcade\shellcade\state.json')))) {
  $e = Test-Path -LiteralPath $p[1]
  Add-Line ("{0,-17} {1} ({2})" -f ($p[0] + ':'), $p[1], $(if ($e) { 'present' } else { 'none' }))
}

# ---- Write + print ---------------------------------------------------------------------------------
Add-Section 'Warnings'
if ($warnings.Count) { foreach ($w in $warnings) { Add-Line "- $w" } } else { Add-Line 'None.' }
$lines | Set-Content -LiteralPath $Report -Encoding UTF8

Write-Host ''
Write-Host 'Kayboro environment check' -ForegroundColor Magenta
foreach ($s in $summary) { Write-Host "  $s" }
if ($warnings.Count) {
  Write-Host ''
  foreach ($w in $warnings) { Write-Host "  ! $w" -ForegroundColor Yellow }
}
Write-Host ''
Write-Host "Full report: $Report"
exit 0
