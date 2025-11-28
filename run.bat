@echo off
echo.
echo ================================
echo   Web Game - Setup & Run
echo   Developer: dennie-softs
echo ================================
echo.

REM Check if Node.js is installed
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Node.js is not installed!
    echo Please download and install Node.js from: https://nodejs.org/
    pause
    exit /b 1
)

echo [✓] Node.js is installed
echo.

REM Change to project directory
cd /d "%~dp0"

REM Check if node_modules exists
if not exist "node_modules" (
    echo [!] Installing dependencies...
    echo This may take a minute on first run...
    echo.
    call npm install
    echo.
    echo [✓] Dependencies installed successfully!
) else (
    echo [✓] Dependencies already installed
)

echo.
echo ================================
echo   Starting Web Game Server
echo ================================
echo.
echo The server will run on: http://localhost:3000
echo.
echo IMPORTANT:
echo - Open your browser and go to http://localhost:3000
echo - Press Ctrl+C in this window to stop the server
echo.
echo ================================
echo.

REM Start the server
call npm start

pause
