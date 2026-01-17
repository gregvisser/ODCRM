#!/usr/bin/env node

/**
 * Update server/.env with Azure credentials
 * Usage: node scripts/update-azure-env.js <client-id> <client-secret>
 */

import { existsSync, readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');
const serverEnvPath = join(rootDir, 'server', '.env');

const clientId = process.argv[2];
const clientSecret = process.argv[3];

if (!clientId || !clientSecret) {
  console.error('❌ Usage: node scripts/update-azure-env.js <client-id> <client-secret>');
  console.error('\nExample:');
  console.error('  node scripts/update-azure-env.js "a1b2c3d4-e5f6-7890-abcd-ef1234567890" "~secret~value~"');
  process.exit(1);
}

if (!existsSync(serverEnvPath)) {
  console.error('❌ server/.env not found!');
  console.error('   Create it first (see DEPLOYMENT_ENV_SETUP.md)');
  process.exit(1);
}

// Read current .env
let envContent = readFileSync(serverEnvPath, 'utf-8');

// Update MICROSOFT_CLIENT_ID
const clientIdRegex = /MICROSOFT_CLIENT_ID=[^\n]*/;
if (clientIdRegex.test(envContent)) {
  envContent = envContent.replace(clientIdRegex, `MICROSOFT_CLIENT_ID=${clientId.trim()}`);
  console.log('✅ Updated MICROSOFT_CLIENT_ID');
} else {
  envContent += `\nMICROSOFT_CLIENT_ID=${clientId.trim()}\n`;
  console.log('✅ Added MICROSOFT_CLIENT_ID');
}

// Update MICROSOFT_CLIENT_SECRET
const clientSecretRegex = /MICROSOFT_CLIENT_SECRET=[^\n]*/;
if (clientSecretRegex.test(envContent)) {
  envContent = envContent.replace(clientSecretRegex, `MICROSOFT_CLIENT_SECRET=${clientSecret.trim()}`);
  console.log('✅ Updated MICROSOFT_CLIENT_SECRET');
} else {
  envContent += `\nMICROSOFT_CLIENT_SECRET=${clientSecret.trim()}\n`;
  console.log('✅ Added MICROSOFT_CLIENT_SECRET');
}

writeFileSync(serverEnvPath, envContent, 'utf-8');

console.log('\n✅ Azure credentials updated in server/.env');
console.log(`   Client ID: ${clientId.substring(0, 8)}...`);
console.log(`   Secret: ${'*'.repeat(clientSecret.length)}`);

console.log('\n📋 Next steps:');
console.log('   1. Update REDIRECT_URI with your production API URL (after deployment)');
console.log('   2. Update FRONTEND_URL with your production frontend URL (after deployment)');
console.log('   3. Deploy backend to Render');
