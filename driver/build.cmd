@echo off
rem Builds the Kayboro Virtual Screen Driver and kbvdd-setup.exe with the WDK/SDK NuGet packages (nothing
rem has to be installed system-wide besides Visual Studio's C++ tools), then packages it:
rem   build.cmd [Release^|Debug]   ->  build\<config>\package\  KayboroVdd.dll .inf .cat, kbvdd-setup.exe
rem Signing (optional): set KBVDD_SIGN_THUMB to a code-signing certificate's SHA-1 thumbprint in the current
rem user's store (KBVDD_TIMESTAMP_URL for a timestamp). Release builds for players are signed by SignPath in CI.
setlocal EnableExtensions EnableDelayedExpansion

set "CFG=%~1"
if "%CFG%"=="" set "CFG=Release"
rem "build.cmd catalog": only rebuild the catalog of build\Release\package (CI signs the binaries in between).
if /i "%CFG%"=="catalog" (
  set "ROOT=%~dp0"
  "%~dp0packages\Microsoft.Windows.WDK.x64.10.0.28000.2526\c\bin\10.0.28000.0\x86\Inf2Cat.exe" /driver:"%~dp0build\Release\package" /os:10_VB_X64,10_CO_X64,10_NI_X64 /uselocaltime
  exit /b
)
set "ROOT=%~dp0"
set "KIT=10.0.28000.2526"
set "KV=10.0.28000.0"
set "UMDF=2.25"
set "IDDCX=1.4"
set /p VERSION=<"%ROOT%VERSION"
set "PKGS=%ROOT%packages"
set "WDK=%PKGS%\Microsoft.Windows.WDK.x64.%KIT%\c"
set "SDK=%PKGS%\Microsoft.Windows.SDK.CPP.%KIT%\c"
set "SDKX=%PKGS%\Microsoft.Windows.SDK.CPP.x64.%KIT%\c"
set "OUT=%ROOT%build\%CFG%"
set "OBJ=%OUT%\obj"
set "PKG=%OUT%\package"

rem ---- WDK + SDK from NuGet (restore keeps every cache next to the packages, not in the user profile) ----
if not exist "%WDK%\Include\%KV%" (
  where nuget >nul 2>nul || (echo nuget.exe not found: install it ^(winget install Microsoft.NuGet^) or put it on PATH. & exit /b 1)
  if not defined NUGET_PACKAGES set "NUGET_PACKAGES=%ROOT%packages\.nuget"
  if not defined NUGET_HTTP_CACHE_PATH set "NUGET_HTTP_CACHE_PATH=%ROOT%packages\.http-cache"
  nuget restore "%ROOT%packages.config" -PackagesDirectory "%PKGS%" -NonInteractive || exit /b 1
)

rem ---- MSVC toolchain: the newest x64 compiler of the newest Visual Studio with C++ tools ----
rem (Set directly instead of calling vcvars64.bat, which shells out to PowerShell and can stall.)
set "VSWHERE=%ProgramFiles(x86)%\Microsoft Visual Studio\Installer\vswhere.exe"
for /f "usebackq tokens=*" %%i in (`"%VSWHERE%" -latest -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath`) do set "VS=%%i"
if not defined VS (echo Visual Studio with the C++ x64 tools was not found. & exit /b 1)
for /f "usebackq delims=" %%v in (`dir /b /ad /o-n "%VS%\VC\Tools\MSVC"`) do if not defined MSVCVER set "MSVCVER=%%v"
set "VCToolsInstallDir=%VS%\VC\Tools\MSVC\%MSVCVER%\"
if not exist "%VCToolsInstallDir%bin\Hostx64\x64\cl.exe" (echo cl.exe not found under %VCToolsInstallDir% & exit /b 1)
set "PATH=%VCToolsInstallDir%bin\Hostx64\x64;%SDK%\bin\%KV%\x64;%PATH%"
echo MSVC %MSVCVER%, WDK/SDK %KIT%

rem Use the NuGet kits, not whatever SDK vcvars found.
set "INCLUDE=%VCToolsInstallDir%include;%SDK%\Include\%KV%\ucrt;%SDK%\Include\%KV%\um;%SDK%\Include\%KV%\shared;%SDK%\Include\%KV%\winrt;%WDK%\Include\%KV%\um;%WDK%\Include\%KV%\shared;%WDK%\Include\wdf\umdf\%UMDF%;%WDK%\Include\%KV%\um\iddcx\%IDDCX%;%ROOT%include"
set "LIB=%VCToolsInstallDir%lib\x64;%SDKX%\ucrt\x64;%SDKX%\um\x64;%WDK%\Lib\wdf\umdf\x64\%UMDF%;%WDK%\Lib\%KV%\um\x64\iddcx\%IDDCX%;%WDK%\Lib\%KV%\um\x64"

if /i "%CFG%"=="Debug" (set "OPT=/Od /D_DEBUG /DKBVDD_DEBUG=1") else (set "OPT=/O2 /DNDEBUG")
set "DEFS=/D_WIN64 /D_AMD64_ /DAMD64 /DUNICODE /D_UNICODE /DWINVER=0x0A00 /D_WIN32_WINNT=0x0A00 /DNTDDI_VERSION=0x0A000008"
set "UMDEFS=/DUMDF_DRIVER /DUMDF_VERSION_MAJOR=2 /DUMDF_VERSION_MINOR=25 /DUMDF_USING_NTSTATUS /DIDDCX_VERSION_MAJOR=1 /DIDDCX_VERSION_MINOR=4 /DIDDCX_MINIMUM_VERSION_REQUIRED=4"
set "CFLAGS=/nologo /std:c++17 /EHsc /MT /W4 /GS /guard:cf /Zi /permissive- /utf-8"

if exist "%OUT%" rmdir /s /q "%OUT%"
mkdir "%OBJ%" "%PKG%" || exit /b 1

echo [1/5] driver
cl %CFLAGS% %OPT% %DEFS% %UMDEFS% /c "%ROOT%src\Driver.cpp" /Fo"%OBJ%\\" /Fd"%OBJ%\driver.pdb" || exit /b 1
link /nologo /DLL /MACHINE:X64 /SUBSYSTEM:WINDOWS /DEBUG /OPT:REF /OPT:ICF /GUARD:CF /DYNAMICBASE /NXCOMPAT ^
  /INCLUDE:FxDriverEntryUm /PDB:"%OUT%\KayboroVdd.pdb" /IMPLIB:"%OBJ%\KayboroVdd.lib" /OUT:"%PKG%\KayboroVdd.dll" ^
  "%OBJ%\Driver.obj" WdfDriverStubUm.lib IddCxStub.lib OneCoreUAP.lib avrt.lib ntdll.lib || exit /b 1

echo [2/5] kbvdd-setup.exe
cl %CFLAGS% /O2 %DEFS% "%ROOT%setup\kbvdd-setup.cpp" /Fo"%OBJ%\\" /Fd"%OBJ%\setup.pdb" /Fe"%PKG%\kbvdd-setup.exe" ^
  /link /DEBUG /INCREMENTAL:NO /PDB:"%OUT%\kbvdd-setup.pdb" setupapi.lib newdev.lib cfgmgr32.lib || exit /b 1

echo [3/5] INF %VERSION%
copy /y "%ROOT%inf\KayboroVdd.inf" "%PKG%\" >nul || exit /b 1
"%WDK%\bin\%KV%\x64\stampinf.exe" -f "%PKG%\KayboroVdd.inf" -d * -a amd64 -u 2.25.0 -v %VERSION% || exit /b 1

if defined KBVDD_SIGN_THUMB (
  echo [4/5] signing binaries
  set "TS="
  if defined KBVDD_TIMESTAMP_URL set "TS=/tr %KBVDD_TIMESTAMP_URL% /td sha256"
  "%SDK%\bin\%KV%\x64\signtool.exe" sign /fd sha256 /sha1 %KBVDD_SIGN_THUMB% !TS! "%PKG%\KayboroVdd.dll" "%PKG%\kbvdd-setup.exe" || exit /b 1
) else (
  echo [4/5] unsigned build ^(set KBVDD_SIGN_THUMB to sign^)
)

echo [5/5] catalog
"%WDK%\bin\%KV%\x86\Inf2Cat.exe" /driver:"%PKG%" /os:10_VB_X64,10_CO_X64,10_NI_X64 /uselocaltime || exit /b 1
if defined KBVDD_SIGN_THUMB (
  "%SDK%\bin\%KV%\x64\signtool.exe" sign /fd sha256 /sha1 %KBVDD_SIGN_THUMB% !TS! "%PKG%\KayboroVdd.cat" || exit /b 1
)
copy /y "%ROOT%LICENSE" "%PKG%\LICENSE.txt" >nul

echo.
echo Built %PKG%
dir /b "%PKG%"
endlocal
