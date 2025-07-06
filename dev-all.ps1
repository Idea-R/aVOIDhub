# Development script to launch all aVOID games and the hub simultaneously
# Run this from the aVOID root directory

Write-Host "Starting aVOID Development Environment..." -ForegroundColor Green
Write-Host "This will launch all games and the hub on the following ports:" -ForegroundColor Yellow
Write-Host "  Game Hub:    http://localhost:5173" -ForegroundColor Cyan
Write-Host "  VOIDaVOID:   http://localhost:5174" -ForegroundColor Cyan
Write-Host "  TankaVOID:   http://localhost:5175" -ForegroundColor Cyan
Write-Host "  WreckaVOID:  http://localhost:5178" -ForegroundColor Cyan
Write-Host "  WORDaVOID:   http://localhost:5177" -ForegroundColor Cyan
Write-Host ""

# Function to start a dev server
function Start-DevServer {
    param(
        [string]$Name,
        [string]$Path,
        [string]$Port
    )
    
    if (Test-Path $Path) {
        Write-Host "Starting $Name on port $Port..." -ForegroundColor Green
        Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$Path'; Write-Host '$Name Server' -ForegroundColor Magenta; npm run dev"
    } else {
        Write-Host "Path not found: $Path" -ForegroundColor Red
    }
}

# Check if we're in the right directory
if (-not (Test-Path "apps/game-hub")) {
    Write-Host "Please run this script from the aVOID root directory" -ForegroundColor Red
    exit 1
}

# Start all dev servers
Start-DevServer "Game Hub" "apps/game-hub" "5173"
Start-Sleep -Seconds 2

Start-DevServer "VOIDaVOID" "games/void-avoid" "5174"
Start-Sleep -Seconds 2

Start-DevServer "TankaVOID" "games/tanka-void" "5175"
Start-Sleep -Seconds 2

Start-DevServer "WreckaVOID" "games/wrecka-void" "5178"
Start-Sleep -Seconds 2

Start-DevServer "WORDaVOID" "games/word-avoid" "5177"

Write-Host ""
Write-Host "All servers should be starting up!" -ForegroundColor Green
Write-Host "Open http://localhost:5173 in your browser to access the Game Hub" -ForegroundColor Yellow
Write-Host ""
Write-Host "Press Ctrl+C in each terminal window to stop the servers" -ForegroundColor Gray
Write-Host "Press any key to continue..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
