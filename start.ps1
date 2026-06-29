# ============================================================
#   Black Hole Explorer - launcher for Windows (PowerShell).
#   Serves the folder on http://localhost:8765 and opens it.
#   Uses Node.js if available, otherwise Python 3.
# ============================================================
Set-Location -Path $PSScriptRoot

Write-Host ""
Write-Host "  ============================================" -ForegroundColor DarkYellow
Write-Host "    Black Hole Explorer"                        -ForegroundColor Yellow
Write-Host "    Opening  http://localhost:8765"
Write-Host "    Press Ctrl+C to stop."
Write-Host "  ============================================" -ForegroundColor DarkYellow
Write-Host ""

Start-Process "http://localhost:8765"

if (Get-Command node -ErrorAction SilentlyContinue) {
    node serve.js 8765
} elseif (Get-Command py -ErrorAction SilentlyContinue) {
    py serve.py 8765
} elseif (Get-Command python -ErrorAction SilentlyContinue) {
    python serve.py 8765
} else {
    Write-Host "Please install Node.js (https://nodejs.org) or Python 3, then run again." -ForegroundColor Red
}
