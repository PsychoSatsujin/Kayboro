@echo off
rem Installs a LOCAL TEST build of the Kayboro Virtual Screen Driver on this PC. Run as administrator.
rem   1. creates (once) a self-signed code-signing certificate "Kayboro Driver Test" in your user store
rem   2. trusts it on this PC (Trusted Root + Trusted Publishers): a security change you are making on purpose
rem   3. builds the driver, signs it with that certificate and installs it with kbvdd-setup
rem Undo everything with scripts\dev-uninstall.cmd. Players never need this: release builds are signed in CI.
setlocal EnableExtensions EnableDelayedExpansion
net session >nul 2>&1 || (echo Run this from an administrator command prompt ^(right-click, Run as administrator^). & pause & exit /b 1)

set "ROOT=%~dp0.."
set "SDKBIN=%ROOT%\packages\Microsoft.Windows.SDK.CPP.10.0.28000.2526\c\bin\10.0.28000.0\x64"
set "CERTDIR=%ROOT%\signing"
set "CER=%CERTDIR%\kayboro-driver-test.cer"
set "CN=Kayboro Driver Test"
if not exist "%CERTDIR%" mkdir "%CERTDIR%"
if not exist "%SDKBIN%\MakeCert.exe" (echo Run build.cmd once first so the Windows kits are downloaded. & pause & exit /b 1)

call :thumb
if not defined THUMB (
  echo Creating the "%CN%" certificate...
  "%SDKBIN%\MakeCert.exe" -r -pe -ss My -sr CurrentUser -n "CN=%CN%" -eku 1.3.6.1.5.5.7.3.3 -a sha256 -len 2048 -e 12/31/2030 "%CER%" || (pause & exit /b 1)
  call :thumb
)
if not defined THUMB (echo Could not find the certificate after creating it. & pause & exit /b 1)
if not exist "%CER%" certutil -user -store My %THUMB% "%CER%" >nul || (pause & exit /b 1)
echo Certificate %THUMB%

echo Trusting it on this PC...
certutil -f -addstore Root "%CER%" >nul || (pause & exit /b 1)
certutil -f -addstore TrustedPublisher "%CER%" >nul || (pause & exit /b 1)

set "KBVDD_SIGN_THUMB=%THUMB%"
call "%ROOT%\build.cmd" Release || (pause & exit /b 1)

echo.
echo Installing the driver...
"%ROOT%\build\Release\package\kbvdd-setup.exe" install "%ROOT%\build\Release\package\KayboroVdd.inf"
set "RC=%ERRORLEVEL%"
"%ROOT%\build\Release\package\kbvdd-setup.exe" status
echo.
if "%RC%"=="4" echo Restart Windows to finish, then run: kbvdd-setup.exe test
if "%RC%"=="0" echo Done. Try it: "%ROOT%\build\Release\package\kbvdd-setup.exe" test
pause
exit /b %RC%

:thumb
set "THUMB="
for /f "tokens=2 delims=:" %%t in ('certutil -user -store My "%CN%" 2^>nul ^| findstr /c:"Cert Hash(sha1)"') do set "THUMB=%%t"
if defined THUMB set "THUMB=!THUMB: =!"
exit /b 0
