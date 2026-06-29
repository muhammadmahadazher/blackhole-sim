@echo off
REM ============================================================
REM   Black Hole Explorer - launcher for Windows.
REM   Serves the folder on http://localhost:8765 and opens it.
REM   Uses Node.js if available, otherwise Python 3.
REM ============================================================
cd /d "%~dp0"
echo.
echo   ============================================
echo     Black Hole Explorer
echo     Opening  http://localhost:8765
echo     Press Ctrl+C in this window to stop.
echo   ============================================
echo.

start "" "http://localhost:8765"

where node >nul 2>nul && ( node serve.js 8765 & goto :eof )
where py   >nul 2>nul && ( py serve.py 8765 & goto :eof )
where python >nul 2>nul && ( python serve.py 8765 & goto :eof )
echo Please install Node.js (https://nodejs.org) or Python 3, then run this again.
pause
