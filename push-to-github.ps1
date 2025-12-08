# PowerShell script to push ODCRM to GitHub
Write-Host "=== Pushing ODCRM to GitHub ===" -ForegroundColor Cyan

# Navigate to project directory
Set-Location "c:\CodeProjects\Clients\Opensdoors\ODCRM"

# Find Git installation
$gitExe = $null
$gitPaths = @(
    "C:\Program Files\Git\cmd\git.exe",
    "C:\Program Files (x86)\Git\cmd\git.exe",
    "$env:LOCALAPPDATA\Programs\Git\cmd\git.exe",
    "$env:ProgramFiles\Git\cmd\git.exe"
)

foreach ($path in $gitPaths) {
    if (Test-Path $path) {
        $gitExe = $path
        $gitDir = Split-Path (Split-Path $path)
        $env:PATH = "$gitDir\cmd;$env:PATH"
        Write-Host "Found Git at: $path" -ForegroundColor Green
        break
    }
}

if (-not $gitExe) {
    Write-Host "`n❌ Git not found! Please install Git from https://git-scm.com/download/win" -ForegroundColor Red
    Write-Host "Or use GitHub Desktop: https://desktop.github.com/" -ForegroundColor Yellow
    exit 1
}

Write-Host "`n1. Checking git status..." -ForegroundColor Yellow
git status

Write-Host "`n2. Adding all files..." -ForegroundColor Yellow
git add -A

Write-Host "`n3. Committing changes..." -ForegroundColor Yellow
git commit -m "Initial commit - ODCRM with Vercel deployment config"

Write-Host "`n4. Setting remote to ODCRM..." -ForegroundColor Yellow
git remote remove origin 2>$null
git remote add origin https://github.com/gregvisser/ODCRM.git
git remote -v

Write-Host "`n5. Setting branch to main..." -ForegroundColor Yellow
git branch -M main

Write-Host "`n6. Pushing to GitHub..." -ForegroundColor Yellow
Write-Host "NOTE: You may be prompted for GitHub credentials." -ForegroundColor Magenta
Write-Host "Use your GitHub username and a Personal Access Token as password." -ForegroundColor Magenta
Write-Host ""

$result = git push -u origin main 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n✅ SUCCESS! Code pushed to GitHub!" -ForegroundColor Green
    Write-Host "Visit: https://github.com/gregvisser/ODCRM" -ForegroundColor Cyan
} else {
    Write-Host "`n❌ Push failed. Error:" -ForegroundColor Red
    Write-Host $result -ForegroundColor Red
    Write-Host "`nYou may need to:" -ForegroundColor Yellow
    Write-Host "1. Create a Personal Access Token at: https://github.com/settings/tokens" -ForegroundColor White
    Write-Host "2. Use the token as your password when prompted" -ForegroundColor White
}

Write-Host "`n=== Done ===" -ForegroundColor Cyan
