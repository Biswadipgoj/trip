@echo off
echo ============================================================
echo  TripSplit - Setup Script
echo ============================================================
echo.

:: Check if Node.js is installed
where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js is NOT installed or not in PATH.
    echo.
    echo Please install Node.js first:
    echo   1. Go to: https://nodejs.org/en/download
    echo   2. Download the Windows Installer (.msi) - LTS version
    echo   3. Run the installer, keep all defaults checked
    echo   4. RESTART this terminal / VS Code after installation
    echo   5. Run this script again
    echo.
    pause
    start https://nodejs.org/en/download
    exit /b 1
)

echo [OK] Node.js found: 
node --version
echo [OK] npm version:
npm --version
echo.

echo Installing dependencies...
npm install
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] npm install failed.
    pause
    exit /b 1
)

echo.
echo ============================================================
echo  Setup complete! Starting development server...
echo  Open your browser at: http://localhost:3000
echo ============================================================
echo.
npm run dev
