#!/usr/bin/env node

/**
 * Deployment Prerequisites Checker
 * Checks if all prerequisites are installed and configured
 */

import { execSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

console.log('🔍 Checking deployment prerequisites...\n');

let allGood = true;

// Check Node.js
try {
  const nodeVersion = execSync('node --version', { encoding: 'utf-8' }).trim();
  const majorVersion = parseInt(nodeVersion.replace('v', '').split('.')[0]);
  if (majorVersion >= 18) {
    console.log(`✅ Node.js: ${nodeVersion} (>= 18 required)`);
  } else {
    console.log(`❌ Node.js: ${nodeVersion} (Need >= 18)`);
    allGood = false;
  }
} catch (error) {
  console.log('❌ Node.js: Not found');
  allGood = false;
}

// Check npm
try {
  const npmVersion = execSync('npm --version', { encoding: 'utf-8' }).trim();
  console.log(`✅ npm: ${npmVersion}`);
} catch (error) {
  console.log('❌ npm: Not found');
  allGood = false;
}

// Check Prisma
try {
  const prismaVersion = execSync('npx prisma --version', { encoding: 'utf-8' }).trim();
  console.log(`✅ Prisma: ${prismaVersion}`);
} catch (error) {
  console.log('⚠️  Prisma: Not installed globally (will use npx)');
}

// Check environment files
console.log('\n📁 Environment Files:');

const serverEnvPath = join(rootDir, 'server', '.env');
const rootEnvPath = join(rootDir, '.env');

if (existsSync(serverEnvPath)) {
  console.log('✅ server/.env exists');
  
  // Check if it has placeholder values
  const serverEnv = readFileSync(serverEnvPath, 'utf-8');
  if (serverEnv.includes('your-client-id-here') || serverEnv.includes('localhost')) {
    console.log('⚠️  server/.env contains placeholder values (update after setup)');
  }
} else {
  console.log('❌ server/.env missing (create from DEPLOYMENT_ENV_SETUP.md)');
  allGood = false;
}

if (existsSync(rootEnvPath)) {
  console.log('✅ .env (root) exists');
  
  const rootEnv = readFileSync(rootEnvPath, 'utf-8');
  if (rootEnv.includes('localhost')) {
    console.log('⚠️  .env contains localhost (update after deployment)');
  }
} else {
  console.log('❌ .env (root) missing (create from DEPLOYMENT_ENV_SETUP.md)');
  allGood = false;
}

// Check dependencies
console.log('\n📦 Dependencies:');

const serverPackageJson = join(rootDir, 'server', 'package.json');
const rootPackageJson = join(rootDir, 'package.json');

if (existsSync(serverPackageJson)) {
  const serverNodeModules = join(rootDir, 'server', 'node_modules');
  if (existsSync(serverNodeModules)) {
    console.log('✅ Server dependencies installed');
  } else {
    console.log('⚠️  Server dependencies not installed (run: cd server && npm install)');
  }
}

if (existsSync(rootPackageJson)) {
  const rootNodeModules = join(rootDir, 'node_modules');
  if (existsSync(rootNodeModules)) {
    console.log('✅ Frontend dependencies installed');
  } else {
    console.log('⚠️  Frontend dependencies not installed (run: npm install)');
  }
}

// Check workers are enabled
console.log('\n🔧 Code Configuration:');
const indexTs = join(rootDir, 'server', 'src', 'index.ts');
if (existsSync(indexTs)) {
  const indexContent = readFileSync(indexTs, 'utf-8');
  if (indexContent.includes('startEmailScheduler(prisma)') && 
      !indexContent.includes('// startEmailScheduler')) {
    console.log('✅ Background workers enabled');
  } else {
    console.log('❌ Background workers not enabled');
    allGood = false;
  }
}

console.log('\n' + '='.repeat(50));

if (allGood) {
  console.log('✅ All automated checks passed!');
  console.log('\n📋 Next steps:');
  console.log('1. Create/update .env files (see DEPLOYMENT_ENV_SETUP.md)');
  console.log('2. Follow PRODUCTION_DEPLOYMENT_STEPS.md for deployment');
} else {
  console.log('❌ Some prerequisites are missing');
  console.log('\n📋 Fix the issues above before deploying');
}
