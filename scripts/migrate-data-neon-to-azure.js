#!/usr/bin/env node

/**
 * Data Migration Script: Neon to Azure PostgreSQL
 * Exports data from Neon database and imports into Azure PostgreSQL
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

console.log('🚀 Starting data migration from Neon to Azure PostgreSQL...\n');

// Load environment variables
const serverEnvPath = join(serverDir, '.env');
if (!existsSync(serverEnvPath)) {
  console.error('❌ server/.env not found!');
  process.exit(1);
}

// First, let's backup the current Neon connection string
const envContent = readFileSync(serverEnvPath, 'utf8');
const neonMatch = envContent.match(/DATABASE_URL="([^"]+)"/);
if (!neonMatch) {
  console.error('❌ Could not find DATABASE_URL in server/.env');
  process.exit(1);
}

const originalNeonUrl = neonMatch[1];
console.log('📊 Found Neon database connection');

// Azure connection string (should be in the current .env)
const azureMatch = envContent.match(/DATABASE_URL="postgresql:\/\/odcrmadmin:[^@]+@odcrm-postgres\.postgres\.database\.azure\.com\/postgres\?sslmode=require"/);
if (!azureMatch) {
  console.error('❌ Azure DATABASE_URL not found in server/.env');
  console.error('   Make sure you updated server/.env with Azure connection string');
  process.exit(1);
}

console.log('✅ Azure database connection configured');

try {
  console.log('\n📤 Step 1: Exporting data from Neon...');

  // Temporarily set DATABASE_URL to Neon for export
  process.env.DATABASE_URL = originalNeonUrl;

  // Export data using Prisma's database dump capability
  // We'll use pg_dump directly since it's more reliable
  const dumpCommand = `pg_dump "${originalNeonUrl}" --no-owner --no-privileges --clean --if-exists --exclude-schema=graphql --exclude-schema=graphile_worker --exclude-table=public._prisma_migrations > neon_data.sql`;

  console.log('   Running: pg_dump from Neon...');
  execSync(dumpCommand, { stdio: 'inherit', cwd: rootDir });

  console.log('✅ Data exported from Neon');

  console.log('\n📥 Step 2: Importing data to Azure PostgreSQL...');

  // Set DATABASE_URL to Azure for import
  process.env.DATABASE_URL = azureMatch[0].replace('DATABASE_URL="', '').replace('"', '');

  // Import data using psql
  const importCommand = `psql "${process.env.DATABASE_URL}" < neon_data.sql`;

  console.log('   Running: psql import to Azure...');
  execSync(importCommand, { stdio: 'inherit', cwd: rootDir });

  console.log('✅ Data imported to Azure PostgreSQL');

  // Clean up
  console.log('\n🧹 Step 3: Cleaning up...');
  execSync('del neon_data.sql', { cwd: rootDir });

  console.log('\n🎉 Migration completed successfully!');
  console.log('\n📋 Next steps:');
  console.log('1. Verify data: npx prisma studio (in server directory)');
  console.log('2. Test your application with the new Azure database');
  console.log('3. Update any hardcoded database references if needed');

} catch (error) {
  console.error('\n❌ Migration failed!');
  console.error('Error:', error.message);

  // Clean up on failure
  try {
    execSync('del neon_data.sql', { cwd: rootDir });
  } catch {}

  console.log('\n🔧 Troubleshooting:');
  console.log('1. Check your Neon database is accessible');
  console.log('2. Verify Azure PostgreSQL firewall rules');
  console.log('3. Ensure pg_dump and psql are installed');
  console.log('4. Check database credentials are correct');

  process.exit(1);
}