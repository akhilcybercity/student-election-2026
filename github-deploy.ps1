# github-deploy.ps1 — Automated GitHub Push Helper
$git = "C:\Users\ByteB\.gemini\antigravity-ide\scratch\mingit\cmd\git.exe"
$gh = "C:\Users\ByteB\.gemini\antigravity-ide\scratch\gh_extract\bin\gh.exe"

# Change directory to project root
cd "C:\Users\ByteB\.gemini\antigravity-ide\scratch\election-system-v2"

# 1. Initialize Git repository
if (-not (Test-Path ".git")) {
    Write-Host "🗳️ Initializing local Git repository..." -ForegroundColor Cyan
    & $git init -b main
    & $git config user.name "Election Admin"
    & $git config user.email "admin@election.local"
}

# Create a clean gitignore if missing
if (-not (Test-Path ".gitignore")) {
    Set-Content -Path ".gitignore" -Value "node_modules/`r`nserver/node_modules/`r`nserver/db.json`r`n.env`r`n*.log`r`n*.tmp`r`n"
}

# 2. Stage and commit files
Write-Host "🗳️ Staging files and creating initial commit..." -ForegroundColor Cyan
& $git add .
& $git commit -m "Initial commit for Election Management System v3"

# 3. Log in to GitHub
Write-Host ""
Write-Host "🗳️ Starting GitHub Authentication..." -ForegroundColor Yellow
Write-Host "A browser window should open. Copy the verification code from the terminal and paste it into GitHub." -ForegroundColor White
& $gh auth login --hostname github.com -w

# Wait for authentication to complete
Start-Sleep -Seconds 3

# 4. Create Repository and Push
Write-Host ""
Write-Host "🗳️ Creating repository 'student-election-2026' on your GitHub and pushing code..." -ForegroundColor Cyan
& $gh repo create "student-election-2026" --public --source=. --push -y

Write-Host ""
Write-Host "🗳️ Success! Your project is now pushed to GitHub!" -ForegroundColor Green
