#!/bin/bash
# Prisma CLI Diagnostic Tool
# Usage: bash scripts/diagnose-prisma.sh
#
# Checks Prisma installation health on Azure App Service or local environment

echo "=== Prisma Diagnostic Tool ==="
echo ""
echo "Running diagnostics..."
echo ""

# Test 1: Prisma CLI version
echo "1. Checking Prisma CLI version..."
if npx prisma -v 2>/dev/null; then
  echo "✅ PASS: Prisma CLI is executable"
else
  echo "❌ FAIL: Prisma CLI not working"
  echo "   Fix: npm install && npm run prisma:generate"
fi
echo ""

# Test 2: Prisma package
echo "2. Checking Prisma package.json..."
if node -p "require('prisma/package.json').version" 2>/dev/null; then
  echo "✅ PASS: Prisma package found"
else
  echo "❌ FAIL: Prisma package not found"
  echo "   Fix: npm install prisma@latest"
fi
echo ""

# Test 3: Prisma binary
echo "3. Checking Prisma binary..."
if [ -f "node_modules/prisma/build/index.js" ]; then
  echo "✅ PASS: Prisma binary exists"
  ls -lh node_modules/prisma/build/index.js
else
  echo "❌ FAIL: Prisma binary missing"
  echo "   Fix: rm -rf node_modules && npm install"
fi
echo ""

# Test 4: @prisma/client
echo "4. Checking @prisma/client..."
if node -p "require('@prisma/client/package.json').version" 2>/dev/null; then
  echo "✅ PASS: @prisma/client found"
else
  echo "❌ FAIL: @prisma/client not found"
  echo "   Fix: npm install @prisma/client@latest"
fi
echo ""

# Test 5: Symlinks
echo "5. Checking node_modules/.bin symlinks..."
if [ -L "node_modules/.bin/prisma" ]; then
  echo "✅ PASS: Prisma symlink exists"
  ls -la node_modules/.bin/prisma
else
  echo "❌ FAIL: Symlink broken or missing"
  echo "   Fix: npm rebuild"
fi
echo ""

# Test 6: DATABASE_URL
echo "6. Checking DATABASE_URL environment variable..."
if [ -z "$DATABASE_URL" ]; then
  echo "❌ FAIL: DATABASE_URL not set"
  echo "   Fix: Set DATABASE_URL in .env file or environment"
else
  echo "✅ PASS: DATABASE_URL is set"
  # Don't print full URL (security)
  echo "   Value: ${DATABASE_URL:0:30}..."
fi
echo ""

# Test 7: Prisma schema
echo "7. Checking Prisma schema file..."
if [ -f "prisma/schema.prisma" ]; then
  echo "✅ PASS: Prisma schema exists"
  echo "   Location: prisma/schema.prisma"
else
  echo "❌ FAIL: Prisma schema not found"
  echo "   Location: prisma/schema.prisma should exist"
fi
echo ""

# Test 8: Migrations directory
echo "8. Checking migrations directory..."
if [ -d "prisma/migrations" ]; then
  MIGRATION_COUNT=$(find prisma/migrations -maxdepth 1 -type d | wc -l)
  echo "✅ PASS: Migrations directory exists"
  echo "   Migrations: $((MIGRATION_COUNT - 1)) found"
else
  echo "⚠️  WARN: No migrations directory"
  echo "   This is OK for new projects"
fi
echo ""

# Test 9: Can generate Prisma client
echo "9. Testing Prisma client generation..."
if npx prisma generate --schema=./prisma/schema.prisma 2>/dev/null; then
  echo "✅ PASS: Prisma client generation works"
else
  echo "❌ FAIL: Cannot generate Prisma client"
  echo "   Fix: Check schema syntax and DATABASE_URL"
fi
echo ""

# Summary
echo "=== Diagnostic Complete ==="
echo ""
echo "If any tests failed, follow the suggested fixes above."
echo "For emergency repair on Azure:"
echo "  1. SSH to Azure App Service"
echo "  2. cd /home/site/wwwroot"
echo "  3. rm -rf node_modules package-lock.json"
echo "  4. npm install"
echo "  5. npm run prisma:generate"
echo "  6. Restart app service from Azure Portal"
echo ""
