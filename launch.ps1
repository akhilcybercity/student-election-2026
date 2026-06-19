# launch.ps1 — Automated Hosting Launcher
# Right-click this file and select "Run with PowerShell" or run `powershell .\launch.ps1` in terminal

Clear-Host
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " 🗳️  Election Management System v3 — Live Hosting Helper " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Open GitHub to create a repository
Write-Host "Step 1: Creating a GitHub repository..." -ForegroundColor Yellow
Write-Host "-> Opening https://github.com/new in your browser." -ForegroundColor DarkGray
Write-Host "-> Please name it 'election-system' and click 'Create Repository'." -ForegroundColor White
Start-Process "https://github.com/new"
Start-Sleep -Seconds 2

# Step 2: Open project folder in Explorer for Drag & Drop
Write-Host ""
Write-Host "Step 2: Opening your local project folder..." -ForegroundColor Yellow
Write-Host "-> Drag and drop all files from this folder into the GitHub upload zone." -ForegroundColor White
Write-Host "⚠️  DO NOT drag 'node_modules/' or 'server/node_modules/'!" -ForegroundColor Rose
$folderPath = "C:\Users\ByteB\.gemini\antigravity-ide\scratch\election-system-v2"
Start-Process explorer.exe -ArgumentList "/select, `"$folderPath\README.md`""
Start-Sleep -Seconds 2

# Step 3: Open Render select repository page
Write-Host ""
Write-Host "Step 3: Preparing free hosting on Render..." -ForegroundColor Yellow
Write-Host "-> Opening Render dashboard in your browser." -ForegroundColor DarkGray
Write-Host "-> Sign in with GitHub and select your 'election-system' repository." -ForegroundColor White
Write-Host "-> Set Build Command to: cd server && npm install" -ForegroundColor Cyan
Write-Host "-> Set Start Command to: node server/index.js" -ForegroundColor Cyan
Start-Process "https://dashboard.render.com/select-repo?type=web"

Write-Host ""
Write-Host "==========================================================" -ForegroundColor Green
Write-Host " Done! Follow the browser pages to finish hosting. " -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Green
Write-Host ""
