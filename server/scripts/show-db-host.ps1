# show-db-host.ps1 - Safely display database hostname without exposing credentials
# Usage: .\scripts\show-db-host.ps1

$ErrorActionPreference = "Stop"

$DATABASE_URL = $env:DATABASE_URL

if (-not $DATABASE_URL) {
    Write-Host "❌ ERROR: DATABASE_URL environment variable is not set" -ForegroundColor Red
    Write-Host ""
    Write-Host "Set it with:" -ForegroundColor Yellow
    Write-Host "  `$env:DATABASE_URL = 'postgresql://user:pass@hostname:5432/dbname'" -ForegroundColor Yellow
    Write-Host ""
    exit 1
}

# Extract hostname (everything between @ and : or /)
if ($DATABASE_URL -match '@([^:/]+)') {
    $DB_HOST = $matches[1]
    Write-Host "✅ Database hostname: $DB_HOST" -ForegroundColor Green
} else {
    Write-Host "❌ ERROR: Could not parse hostname from DATABASE_URL" -ForegroundColor Red
    Write-Host "Format should be: postgresql://user:pass@HOSTNAME:5432/dbname" -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "To verify this matches your Azure App Service:" -ForegroundColor Cyan
Write-Host "1. Azure Portal → App Services → odcrm-api-hkbsfbdzdvezedg8" -ForegroundColor Gray
Write-Host "2. Configuration → Application settings → DATABASE_URL" -ForegroundColor Gray
Write-Host "3. Compare hostname in the connection string" -ForegroundColor Gray
