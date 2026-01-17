#!/usr/bin/env node

/**
 * Production Database Migration Helper
 * Runs Prisma migrations against production database
 */

import { execSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');
const serverDir = join(rootDir, 'server');
const serverEnvPath = join(serverDir, '.env');

console.log('📦 Running production database migrations...\n');

// Load environment variables
if (existsSync(serverEnvPath)) {
  dotenv.config({ path: serverEnvPath });
  console.log('✅ Loaded server/.env');
} else {
  console.error('❌ server/.env not found!');
  console.error('   Create it first (see DEPLOYMENT_ENV_SETUP.md)');
  process.exit(1);
}

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl || databaseUrl.includes('localhost') || databaseUrl.includes('your-')) {
  console.error('❌ DATABASE_URL not configured!');
  console.error('   Update server/.env with your Neon database connection string');
  process.exit(1);
}

if (!databaseUrl.includes('sslmode=require')) {
  console.warn('⚠️  DATABASE_URL should include sslmode=require for production');
}

console.log('📊 Database URL configured (format checked)');
console.log('   Host: ' + new URL(databaseUrl).hostname + '\n');

// Change to server directory
process.chdir(serverDir);

try {
  console.log('🔧 Generating Prisma Client...');
  execSync('npx prisma generate --schema ../prisma/schema.prisma', {
    stdio: 'inherit',
    cwd: serverDir
  });
  
  console.log('\n📦 Running migrations...');
  execSync('npx prisma migrate deploy --schema ../prisma/schema.prisma', {
    stdio: 'inherit',
    cwd: serverDir
  });
  
  console.log('\n✅ Migrations complete!');
  console.log('\n📋 Next steps:');
  console.log('1. Verify tables created: npx prisma studio');
  console.log('2. Create production customer record');
  console.log('3. Continue with deployment steps');
  
} catch (error) {
  console.error('\n❌ Migration failed!');
  console.error('   Check your DATABASE_URL in server/.env');
  console.error('   Ensure database is accessible from your network');
  process.exit(1);
}
