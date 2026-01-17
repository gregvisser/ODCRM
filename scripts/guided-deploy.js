#!/usr/bin/env node

/**
 * Guided Deployment Assistant
 * Interactive guide through deployment steps
 */

import readline from 'readline';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

function printStep(stepNum, title) {
  console.log('\n' + '='.repeat(60));
  console.log(`STEP ${stepNum}: ${title}`);
  console.log('='.repeat(60) + '\n');
}

function printInstructions(instructions) {
  console.log('\n📋 Instructions:');
  instructions.forEach((inst, i) => {
    console.log(`   ${i + 1}. ${inst}`);
  });
}

async function main() {
  console.log('\n🚀 ODCRM Production Deployment Assistant\n');
  console.log('This guide will walk you through deployment step by step.');
  console.log('I\'ll help with what I can automate and guide you through manual steps.\n');
  
  // Phase 1: Database Setup
  printStep(1, 'Cloud Database Setup (Neon)');
  
  console.log('⚠️  MANUAL ACTION REQUIRED:');
  printInstructions([
    'Sign up at https://neon.tech',
    'Create new project: "ODCRM Production"',
    'Copy the connection string (includes SSL)',
    'Save the connection string - we\'ll need it next'
  ]);
  
  const hasNeon = await question('\n✅ Have you created the Neon database? (y/n): ');
  
  if (hasNeon.toLowerCase() === 'y') {
    const neonUrl = await question('📋 Paste your Neon connection string: ');
    
    if (neonUrl && neonUrl.trim().length > 0 && neonUrl.startsWith('postgresql://')) {
      // Update server/.env
      const serverEnvPath = join(rootDir, 'server', '.env');
      if (existsSync(serverEnvPath)) {
        let envContent = readFileSync(serverEnvPath, 'utf-8');
        
        // Update DATABASE_URL
        const urlRegex = /DATABASE_URL="[^"]*"/;
        if (urlRegex.test(envContent)) {
          envContent = envContent.replace(urlRegex, `DATABASE_URL="${neonUrl.trim()}"`);
          writeFileSync(serverEnvPath, envContent, 'utf-8');
          console.log('\n✅ Updated server/.env with Neon connection string');
          
          // Run migrations
          const runMigrations = await question('\n🔧 Run database migrations now? (y/n): ');
          if (runMigrations.toLowerCase() === 'y') {
            console.log('\n📦 Running migrations...');
            try {
              const { execSync } = await import('child_process');
              execSync('npm run deploy:migrate', {
                stdio: 'inherit',
                cwd: rootDir
              });
            } catch (error) {
              console.error('\n❌ Migration failed. Check your DATABASE_URL and try again.');
              console.error('   You can run manually: npm run deploy:migrate');
            }
          }
        }
      }
    } else {
      console.log('⚠️  Invalid connection string format. Update server/.env manually.');
    }
  } else {
    console.log('⏭️  Skipping database setup. Come back after creating Neon database.');
  }
  
  // Phase 2: Azure Setup
  printStep(2, 'Microsoft Azure App Registration');
  
  console.log('⚠️  MANUAL ACTION REQUIRED:');
  printInstructions([
    'Go to https://portal.azure.com',
    'Navigate to Azure Active Directory → App registrations',
    'Click "New registration"',
    'Name: "OpensDoors CRM Production"',
    'Redirect URI: https://api.yourdomain.com/api/outlook/callback',
    'Account types: "Accounts in any organizational directory and personal Microsoft accounts"',
    'Click "Register"',
    'Copy the Application (client) ID',
    'Go to Certificates & secrets → Create new secret → Copy the Value',
    'Go to API permissions → Add: Mail.Send, Mail.Read, User.Read, offline_access',
    'Grant admin consent'
  ]);
  
  const hasAzure = await question('\n✅ Have you created the Azure app? (y/n): ');
  
  if (hasAzure.toLowerCase() === 'y') {
    const clientId = await question('📋 Paste your Azure Client ID: ');
    const clientSecret = await question('📋 Paste your Azure Client Secret: ');
    
    if (clientId && clientSecret && clientId.trim().length > 0 && clientSecret.trim().length > 0) {
      const serverEnvPath = join(rootDir, 'server', '.env');
      if (existsSync(serverEnvPath)) {
        let envContent = readFileSync(serverEnvPath, 'utf-8');
        
        // Update MICROSOFT_CLIENT_ID
        const clientIdRegex = /MICROSOFT_CLIENT_ID=[^\n]*/;
        if (clientIdRegex.test(envContent)) {
          envContent = envContent.replace(clientIdRegex, `MICROSOFT_CLIENT_ID=${clientId.trim()}`);
        }
        
        // Update MICROSOFT_CLIENT_SECRET
        const clientSecretRegex = /MICROSOFT_CLIENT_SECRET=[^\n]*/;
        if (clientSecretRegex.test(envContent)) {
          envContent = envContent.replace(clientSecretRegex, `MICROSOFT_CLIENT_SECRET=${clientSecret.trim()}`);
        }
        
        writeFileSync(serverEnvPath, envContent, 'utf-8');
        console.log('\n✅ Updated server/.env with Azure credentials');
      }
    } else {
      console.log('⚠️  Missing credentials. Update server/.env manually.');
    }
  } else {
    console.log('⏭️  Skipping Azure setup. Come back after creating Azure app.');
  }
  
  // Phase 3: Domain Configuration
  printStep(3, 'Domain Configuration');
  
  const domain = await question('🌐 What is your GoDaddy domain name? (e.g., yourdomain.com): ');
  
  if (domain && domain.trim().length > 0) {
    const cleanDomain = domain.trim().replace(/^https?:\/\//, '').replace(/\/$/, '');
    const frontendUrl = `https://crm.${cleanDomain}`;
    const apiUrl = `https://api.${cleanDomain}`;
    const redirectUri = `${apiUrl}/api/outlook/callback`;
    
    console.log(`\n📋 Your URLs will be:`);
    console.log(`   Frontend: ${frontendUrl}`);
    console.log(`   API: ${apiUrl}`);
    console.log(`   OAuth Redirect: ${redirectUri}`);
    
    // Update environment files
    const serverEnvPath = join(rootDir, 'server', '.env');
    const rootEnvPath = join(rootDir, '.env');
    
    if (existsSync(serverEnvPath)) {
      let envContent = readFileSync(serverEnvPath, 'utf-8');
      
      // Update FRONTEND_URL
      const frontendUrlRegex = /FRONTEND_URL=[^\n]*/;
      if (frontendUrlRegex.test(envContent)) {
        envContent = envContent.replace(frontendUrlRegex, `FRONTEND_URL=${frontendUrl}`);
      }
      
      // Update REDIRECT_URI
      const redirectUriRegex = /REDIRECT_URI=[^\n]*/;
      if (redirectUriRegex.test(envContent)) {
        envContent = envContent.replace(redirectUriRegex, `REDIRECT_URI=${redirectUri}`);
      }
      
      // Update EMAIL_TRACKING_DOMAIN
      const trackingDomainRegex = /EMAIL_TRACKING_DOMAIN=[^\n]*/;
      if (trackingDomainRegex.test(envContent)) {
        envContent = envContent.replace(trackingDomainRegex, `EMAIL_TRACKING_DOMAIN=${apiUrl}`);
      }
      
      writeFileSync(serverEnvPath, envContent, 'utf-8');
      console.log('\n✅ Updated server/.env with domain URLs');
    }
    
    if (existsSync(rootEnvPath)) {
      let envContent = readFileSync(rootEnvPath, 'utf-8');
      
      // Update VITE_API_URL
      const apiUrlRegex = /VITE_API_URL=[^\n]*/;
      if (apiUrlRegex.test(envContent)) {
        envContent = envContent.replace(apiUrlRegex, `VITE_API_URL=${apiUrl}`);
      }
      
      writeFileSync(rootEnvPath, envContent, 'utf-8');
      console.log('\n✅ Updated .env with API URL');
    }
  } else {
    console.log('⏭️  Skipping domain configuration. Update manually later.');
  }
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📋 DEPLOYMENT SUMMARY');
  console.log('='.repeat(60) + '\n');
  
  console.log('✅ Completed Steps:');
  if (hasNeon.toLowerCase() === 'y') console.log('   ✓ Database configured');
  if (hasAzure.toLowerCase() === 'y') console.log('   ✓ Azure app configured');
  if (domain && domain.trim().length > 0) console.log('   ✓ Domain URLs configured');
  
  console.log('\n⏭️  Next Manual Steps:');
  console.log('   1. Deploy backend to Render (see PRODUCTION_DEPLOYMENT_STEPS.md Phase 3)');
  console.log('   2. Deploy frontend to Vercel (see PRODUCTION_DEPLOYMENT_STEPS.md Phase 4)');
  console.log('   3. Configure DNS in GoDaddy (see PRODUCTION_DEPLOYMENT_STEPS.md Phase 5)');
  console.log('   4. Create production customer: npm run deploy:create-customer');
  console.log('   5. Test all features (see PRODUCTION_DEPLOYMENT_STEPS.md Phase 7)');
  
  console.log('\n📚 Full deployment guide: PRODUCTION_DEPLOYMENT_STEPS.md');
  console.log('📋 Quick checklist: DEPLOYMENT_QUICK_START.md\n');
  
  rl.close();
}

main();
