@echo off
setlocal
cd /d "%~dp0"
title Sticky Pins - building the installer
color F0
echo.
echo   ==========================================
echo      Sticky Pins - building your installer
echo   ==========================================
echo.

where node >nul 2>nul
if errorlevel 1 goto :nonode

echo   Step 1 of 2: downloading the building kit.
echo   The first time this takes a few minutes, please wait...
echo.
call npm install --no-audit --no-fund --loglevel=error
if errorlevel 1 goto :fail

echo.
echo   Step 2 of 2: building "Sticky Pins Setup.exe"...
echo.
set CSC_IDENTITY_AUTO_DISCOVERY=false
call npx electron-builder --win nsis --x64
if errorlevel 1 goto :fail

echo.
echo   ==========================================
echo      Done! Your installer is ready.
echo   ==========================================
echo.
echo   A folder will open with "Sticky Pins Setup 1.0.0.exe".
echo   Double-click it to install. Copy that same file to your
echo   other laptops to install it there too.
echo.
start "" "%~dp0dist"
pause
exit /b 0

:nonode
echo   Node.js is not installed yet.
echo.
echo   1. The Node.js website will open now.
echo   2. Download the "LTS" version and install it (just click Next).
echo   3. Then double-click build.bat again.
echo.
start "" "https://nodejs.org/en/download"
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
