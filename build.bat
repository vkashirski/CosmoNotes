@echo off
setlocal
cd /d "%~dp0"
title CosmoNotes - building the installer
color F0
echo.
echo   ==========================================
echo      CosmoNotes - building your installer
echo   ==========================================
echo.

rem The builder needs Node.js 22.12 or newer. If this computer has no Node.js, or an older one,
rem we use a private copy kept in this folder (tools\node). It only affects this window:
rem the computer's own Node.js and other programs are not changed.
if exist "%~dp0tools\node\node.exe" set "PATH=%~dp0tools\node;%PATH%"
where node >nul 2>nul
if errorlevel 1 goto :getnode
node -e "var v=process.versions.node.split('.').map(Number);process.exit(v[0]>22||(v[0]===22&&v[1]>=12)?0:1)"
if not errorlevel 1 goto :nodeok

:getnode
echo   This computer has no Node.js, or one that is too old for the builder.
echo   Downloading a private copy just for CosmoNotes (about 30 MB, only the first time - it can take a few minutes).
echo   Your computer's own Node.js and other programs are not touched...
echo.
if not exist "%~dp0tools" mkdir "%~dp0tools"
powershell -NoProfile -Command "$ErrorActionPreference='Stop'; $ProgressPreference='SilentlyContinue'; [Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12; $t='%~dp0tools'; $z=Join-Path $t 'node.zip'; Invoke-WebRequest 'https://nodejs.org/dist/v22.14.0/node-v22.14.0-win-x64.zip' -OutFile $z; Expand-Archive $z $t -Force; Remove-Item $z; $n=Join-Path $t 'node'; if (Test-Path $n) { Remove-Item $n -Recurse -Force }; Rename-Item (Join-Path $t 'node-v22.14.0-win-x64') 'node'"
if errorlevel 1 goto :nodehelp
set "PATH=%~dp0tools\node;%PATH%"
node -e "var v=process.versions.node.split('.').map(Number);process.exit(v[0]>22||(v[0]===22&&v[1]>=12)?0:1)"
if errorlevel 1 goto :nodehelp
echo   Done, using the private copy.
echo.

:nodeok
echo   Step 1 of 3: downloading the building kit.
echo   The first time this takes a few minutes, please wait...
echo.
call npm install --no-audit --no-fund --loglevel=error
if errorlevel 1 goto :fail

rem 1.3.1: the voice-to-text model that comes with the app (Standard, about 64 MB) goes into build\models.
rem Only the first time; every file is checked against its sha256 (build\fetch-model.js).
echo.
echo   Step 2 of 3: getting the voice-to-text model...
echo.
node build\fetch-model.js
rem If the model cannot be downloaded (for example a work network that blocks huggingface.co), the installer is
rem still built, just without the model: the app works, only Speak to text and Transcribe need it.
if errorlevel 1 call :nomodel
if not exist "%~dp0build\models" mkdir "%~dp0build\models"

echo.
echo   Step 3 of 3: building the installer...
echo.
set CSC_IDENTITY_AUTO_DISCOVERY=false
call npx electron-builder --win nsis --x64
if not errorlevel 1 goto :done

rem The last build step runs a small helper the builder just made. Windows Security
rem sometimes blocks a brand-new file for a moment while it scans it, so try once more.
echo.
echo   Windows stopped one build step (usually Windows Security checking a brand-new file).
echo   Trying again in 15 seconds...
timeout /t 15 /nobreak >nul
call npx electron-builder --win nsis --x64
if errorlevel 1 goto :blocked

:done

rem Smart App Control trusts Electron's own program file. Make sure the build left it untouched.
fc /b "dist\win-unpacked\CosmoNotes.exe" "node_modules\electron\dist\electron.exe" >nul 2>nul
if errorlevel 1 (
  echo.
  echo   NOTE: CosmoNotes.exe is not Electron's original program file this time,
  echo   so Smart App Control may block it. Please tell Claude.
) else (
  echo.
  echo   Check passed: CosmoNotes.exe is Electron's original program file,
  echo   which Smart App Control trusts.
)

set "APPVER="
for /f "delims=" %%v in ('node -p "require('./package.json').version"') do set "APPVER=%%v"

echo.
echo   ==========================================
echo      Done! Your installer is ready.
echo   ==========================================
echo.
echo   A folder will open with "CosmoNotes Setup %APPVER%.exe".
echo   Double-click it to install. Copy that same file to your
echo   other laptops to install it there too.
echo.
start "" "%~dp0dist"
pause
exit /b 0

:nomodel
echo.
echo   ------------------------------------------------------------
echo   The voice-to-text model could not be downloaded.
echo   This network probably blocks huggingface.co ^(common on work laptops^).
echo   Building the installer WITHOUT the model. The app works as usual,
echo   but Speak to text and Transcribe will not work until the model is there.
echo   To add it later: copy the folder build\models from a computer that
echo   could download it into this folder's build folder, then run build.bat again.
echo   ------------------------------------------------------------
echo.
exit /b 0

:nodehelp
echo.
echo   The private copy of Node.js could not be downloaded
echo   (no internet, or the network blocks nodejs.org - common on work laptops).
echo.
echo   1. The Node.js website will open now.
echo   2. Download the "LTS" version and install it (just click Next).
echo      On a work laptop you may need IT to install it for you.
echo   3. Close this window and any open terminals, then double-click build.bat again.
echo.
start "" "https://nodejs.org/en/download"
pause
exit /b 1

:blocked
echo.
echo   ==========================================
echo   Windows blocked the last build step twice.
echo   ==========================================
echo.
echo   This is Windows Security being careful with a new file the builder makes
echo   (it does not mean there is a virus). To allow it:
echo.
echo   1. Open Windows Security ^> Virus ^& threat protection ^> Protection history.
echo      If you see something blocked from this folder, open it and choose "Allow".
echo   2. Or add this folder as an exclusion: Windows Security ^> Virus ^& threat
echo      protection ^> Manage settings ^> Exclusions ^> Add an exclusion ^> Folder:
echo      %~dp0
echo   3. Then double-click build.bat again.
echo.
echo   On a work laptop these settings may be locked by IT. Then ask IT to allow this folder.
echo   If a message said "Smart App Control blocked", tell Claude - that needs a different fix.
echo.
pause
exit /b 1

:fail
echo.
echo   Something went wrong (see the messages above).
echo   Check that you are connected to the internet and try again.
echo   If it keeps failing, take a screenshot of this window and send it to Claude.
echo.
pause
exit /b 1
