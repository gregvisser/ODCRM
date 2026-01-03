# Automated Database Setup Script
Write-Host "Automated Database Setup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$dbName = "odcrm"
$dbUser = "postgres"
$dbPassword = "odcrm_dev_pass_$(Get-Random -Minimum 1000 -Maximum 9999)"
$dbPort = 5432

Write-Host "Database Configuration:" -ForegroundColor Yellow
Write-Host "  Database Name: $dbName"
Write-Host "  Username: $dbUser"
Write-Host "  Password: $dbPassword"
Write-Host "  Port: $dbPort"
Write-Host ""

# Check if PostgreSQL is already installed
Write-Host "Checking for existing PostgreSQL installation..." -ForegroundColor Cyan
$pgService = Get-Service | Where-Object { $_.Name -like "*postgres*" } | Select-Object -First 1

if ($pgService) {
    Write-Host "PostgreSQL service found: $($pgService.DisplayName)" -ForegroundColor Green
    
    if ($pgService.Status -eq "Running") {
        Write-Host "PostgreSQL is already running!" -ForegroundColor Green
    } else {
        Write-Host "PostgreSQL service is stopped. Starting..." -ForegroundColor Yellow
        Start-Service -Name $pgService.Name
        Start-Sleep -Seconds 2
        Write-Host "Service started" -ForegroundColor Green
    }
} else {
    Write-Host "PostgreSQL not found on this system." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "OPTION 1: Install PostgreSQL automatically" -ForegroundColor Cyan
    Write-Host "OPTION 2: Use cloud database (Neon, Supabase, etc.)" -ForegroundColor Cyan
    Write-Host "OPTION 3: Install PostgreSQL manually" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "For now, I'll configure .env with a template you can update." -ForegroundColor Yellow
}

# Update .env file with database URL
Write-Host ""
Write-Host "Updating .env file..." -ForegroundColor Cyan

$envContent = @"
# Database
# Update this with your PostgreSQL connection details
DATABASE_URL="postgresql://$dbUser`:$dbPassword@localhost:$dbPort/$dbName?schema=public"

# Server Configuration
PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:5173

# Microsoft Graph / Outlook OAuth
# Get these from Azure App Registration (see EMAIL_CAMPAIGNS_SETUP.md)
MICROSOFT_CLIENT_ID=your-client-id-here
MICROSOFT_CLIENT_SECRET=your-client-secret-here
MICROSOFT_TENANT_ID=common
REDIRECT_URI=http://localhost:3001/api/outlook/callback

# Email Tracking
EMAIL_TRACKING_DOMAIN=http://localhost:3001
"@

$envContent | Out-File -FilePath ".env" -Encoding UTF8
Write-Host "Done! .env file updated." -ForegroundColor Green
Write-Host ""
Write-Host "Your DATABASE_URL:" -ForegroundColor Cyan
Write-Host "postgresql://$dbUser`:$dbPassword@localhost:$dbPort/$dbName?schema=public" -ForegroundColor Green
Write-Host ""
Write-Host "Password: $dbPassword" -ForegroundColor Yellow
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Next Steps:" -ForegroundColor Yellow
Write-Host "1. Install PostgreSQL from: https://www.postgresql.org/download/windows/" -ForegroundColor White
Write-Host "2. Use the password above when installing: $dbPassword" -ForegroundColor White
Write-Host "3. After installation, create database: createdb -U postgres odcrm" -ForegroundColor White
Write-Host "4. Then run: npx prisma migrate dev --name init" -ForegroundColor White
Write-Host "========================================" -ForegroundColor Cyan