#!/bin/bash
# Bash Setup Script for Email Campaigns Module
# Run this script to help set up the development environment

echo "🚀 OpensDoors CRM - Email Campaigns Setup"
echo ""

# Check if Node.js is installed
echo "📦 Checking prerequisites..."
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    echo "✅ Node.js installed: $NODE_VERSION"
else
    echo "❌ Node.js not found. Please install Node.js 18+ from https://nodejs.org"
    exit 1
fi

# Check if PostgreSQL is accessible (optional check)
echo ""
echo "🐘 Checking PostgreSQL..."
if command -v psql &> /dev/null; then
    echo "✅ PostgreSQL client found"
else
    echo "⚠️  PostgreSQL client not found in PATH. Make sure PostgreSQL is installed."
fi

# Step 1: Install dependencies
echo ""
echo "📦 Step 1: Installing backend dependencies..."
cd server
if [ -d "node_modules" ]; then
    echo "✅ node_modules already exists, skipping install"
else
    npm install
    if [ $? -ne 0 ]; then
        echo "❌ Failed to install dependencies"
        exit 1
    fi
fi
echo "✅ Backend dependencies installed"

# Step 2: Generate Prisma Client
echo ""
echo "🔧 Step 2: Generating Prisma Client..."
npx prisma generate
if [ $? -ne 0 ]; then
    echo "⚠️  Prisma generate failed. Make sure DATABASE_URL is set in .env"
fi

# Step 3: Check for .env file
echo ""
echo "📝 Step 3: Checking environment configuration..."
if [ -f ".env" ]; then
    echo "✅ .env file found"
    echo ""
    echo "⚠️  IMPORTANT: Verify these values in server/.env:"
    echo "   - DATABASE_URL (PostgreSQL connection string)"
    echo "   - MICROSOFT_CLIENT_ID (from Azure App Registration)"
    echo "   - MICROSOFT_CLIENT_SECRET (from Azure App Registration)"
else
    echo "⚠️  .env file not found!"
    if [ -f "env.example" ]; then
        cp env.example .env
        echo "✅ Created .env from env.example"
        echo "⚠️  Please edit server/.env with your configuration values"
    else
        echo "❌ env.example not found. Please create server/.env manually"
    fi
fi

# Step 4: Database migration instructions
echo ""
echo "🗄️  Step 4: Database Migration"
echo "To create the database tables, run:"
echo "  npx prisma migrate dev --name init"
echo ""
echo "Or if you prefer to use Prisma Studio to manage data:"
echo "  npx prisma studio"

# Step 5: Frontend setup
cd ..
echo ""
echo "📦 Step 5: Installing frontend dependencies..."
if [ -d "node_modules" ]; then
    echo "✅ node_modules already exists, skipping install"
else
    npm install
    if [ $? -ne 0 ]; then
        echo "❌ Failed to install frontend dependencies"
        exit 1
    fi
fi
echo "✅ Frontend dependencies installed"

# Summary
echo ""
echo "═══════════════════════════════════════════════════"
echo "✅ Setup Complete!"
echo ""
echo "Next steps:"
echo "1. Configure server/.env with your database and Azure credentials"
echo "2. Run database migrations: cd server && npx prisma migrate dev"
echo "3. Start both servers: npm run dev:all"
echo ""
echo "📚 See SETUP_CHECKLIST.md for detailed instructions"
echo "═══════════════════════════════════════════════════"
