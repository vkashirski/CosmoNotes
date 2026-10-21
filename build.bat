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

where node >nul 2>nul
if errorlevel 1 goto :nonode

echo   Step 1 of 2: downloading the building kit.
echo   The first time this takes a few minutes, please wait...
echo.
call npm install --no-audit --no-fund --loglevel=error
if errorlevel 1 goto :fail

echo.
echo   Step 2 of 2: building "CosmoNotes Setup.exe"...
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

echo.
echo   ==========================================
echo      Done! Your installer is ready.
echo   ==========================================
echo.
echo   A folder will open with "CosmoNotes Setup 1.0.4.exe".
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
