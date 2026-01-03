# PowerShell Setup Script for Email Campaigns Module
# Run this script to help set up the development environment

Write-Host "🚀 OpensDoors CRM - Email Campaigns Setup" -ForegroundColor Cyan
Write-Host ""

# Check if Node.js is installed
Write-Host "📦 Checking prerequisites..." -ForegroundColor Yellow
try {
    $nodeVersion = node --version
    Write-Host "✅ Node.js installed: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Node.js not found. Please install Node.js 18+ from https://nodejs.org" -ForegroundColor Red
    exit 1
}

# Check if PostgreSQL is accessible (optional check)
Write-Host ""
Write-Host "🐘 Checking PostgreSQL..." -ForegroundColor Yellow
try {
    $pgVersion = psql --version 2>&1
    if ($pgVersion -match "psql") {
        Write-Host "✅ PostgreSQL client found" -ForegroundColor Green
    }
} catch {
    Write-Host "⚠️  PostgreSQL client not found in PATH. Make sure PostgreSQL is installed." -ForegroundColor Yellow
}

# Step 1: Install dependencies
Write-Host ""
Write-Host "📦 Step 1: Installing backend dependencies..." -ForegroundColor Cyan
Set-Location server
if (Test-Path "node_modules") {
    Write-Host "✅ node_modules already exists, skipping install" -ForegroundColor Green
} else {
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Failed to install dependencies" -ForegroundColor Red
        exit 1
    }
}
Write-Host "✅ Backend dependencies installed" -ForegroundColor Green

# Step 2: Generate Prisma Client
Write-Host ""
Write-Host "🔧 Step 2: Generating Prisma Client..." -ForegroundColor Cyan
npx prisma generate
if ($LASTEXITCODE -ne 0) {
    Write-Host "⚠️  Prisma generate failed. Make sure DATABASE_URL is set in .env" -ForegroundColor Yellow
}

# Step 3: Check for .env file
Write-Host ""
Write-Host "📝 Step 3: Checking environment configuration..." -ForegroundColor Cyan
if (Test-Path ".env") {
    Write-Host "✅ .env file found" -ForegroundColor Green
    Write-Host ""
    Write-Host "⚠️  IMPORTANT: Verify these values in server/.env:" -ForegroundColor Yellow
    Write-Host "   - DATABASE_URL (PostgreSQL connection string)" -ForegroundColor Yellow
    Write-Host "   - MICROSOFT_CLIENT_ID (from Azure App Registration)" -ForegroundColor Yellow
    Write-Host "   - MICROSOFT_CLIENT_SECRET (from Azure App Registration)" -ForegroundColor Yellow
} else {
    Write-Host "⚠️  .env file not found!" -ForegroundColor Yellow
    if (Test-Path "env.example") {
        Copy-Item "env.example" ".env"
        Write-Host "✅ Created .env from env.example" -ForegroundColor Green
        Write-Host "⚠️  Please edit server/.env with your configuration values" -ForegroundColor Yellow
    } else {
        Write-Host "❌ env.example not found. Please create server/.env manually" -ForegroundColor Red
    }
}

# Step 4: Database migration instructions
Write-Host ""
Write-Host "🗄️  Step 4: Database Migration" -ForegroundColor Cyan
Write-Host "To create the database tables, run:" -ForegroundColor White
Write-Host "  npx prisma migrate dev --name init" -ForegroundColor Cyan
Write-Host ""
Write-Host "Or if you prefer to use Prisma Studio to manage data:" -ForegroundColor White
Write-Host "  npx prisma studio" -ForegroundColor Cyan

# Step 5: Frontend setup
Set-Location ..
Write-Host ""
Write-Host "📦 Step 5: Installing frontend dependencies..." -ForegroundColor Cyan
if (Test-Path "node_modules") {
    Write-Host "✅ node_modules already exists, skipping install" -ForegroundColor Green
} else {
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Failed to install frontend dependencies" -ForegroundColor Red
        exit 1
    }
}
Write-Host "✅ Frontend dependencies installed" -ForegroundColor Green

# Summary
Write-Host ""
Write-Host "═══════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "✅ Setup Complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Configure server/.env with your database and Azure credentials" -ForegroundColor White
Write-Host "2. Run database migrations: cd server && npx prisma migrate dev" -ForegroundColor White
Write-Host "3. Start both servers: npm run dev:all" -ForegroundColor White
Write-Host ""
Write-Host "📚 See SETUP_CHECKLIST.md for detailed instructions" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════" -ForegroundColor Cyan
