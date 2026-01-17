#!/usr/bin/env node

/**
 * Update server/.env with Neon connection string
 * Usage: node scripts/update-neon-env.js "<connection-string>"
 */

import { existsSync, readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');
const serverEnvPath = join(rootDir, 'server', '.env');

const connectionString = process.argv[2];

if (!connectionString) {
  console.error('❌ Usage: node scripts/update-neon-env.js "<connection-string>"');
  console.error('\nExample:');
  console.error('  node scripts/update-neon-env.js "postgresql://user:pass@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require"');
  process.exit(1);
}

if (!connectionString.startsWith('postgresql://')) {
  console.error('❌ Invalid connection string format. Must start with postgresql://');
  process.exit(1);
}

if (!existsSync(serverEnvPath)) {
  console.error('❌ server/.env not found!');
  console.error('   Create it first (see DEPLOYMENT_ENV_SETUP.md)');
  process.exit(1);
}

// Read current .env
let envContent = readFileSync(serverEnvPath, 'utf-8');

// Update DATABASE_URL
const urlRegex = /DATABASE_URL="[^"]*"/;
if (urlRegex.test(envContent)) {
  envContent = envContent.replace(urlRegex, `DATABASE_URL="${connectionString}"`);
  writeFileSync(serverEnvPath, envContent, 'utf-8');
  console.log('✅ Updated server/.env with Neon connection string');
  console.log(`   Database: ${new URL(connectionString).pathname.split('/')[1]}`);
  console.log(`   Host: ${new URL(connectionString).hostname}`);
} else {
  // DATABASE_URL not found, add it
  envContent += `\n# Database\nDATABASE_URL="${connectionString}"\n`;
  writeFileSync(serverEnvPath, envContent, 'utf-8');
  console.log('✅ Added DATABASE_URL to server/.env');
}

console.log('\n📋 Next step: Run migrations with:');
console.log('   npm run deploy:migrate');
