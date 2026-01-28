/**
 * System Health Check Script
 * 
 * Performs comprehensive health checks on:
 * - Database connection and record counts
 * - Environment variables
 * - GitHub deployment status
 * - Production site availability
 * - Recent commit history
 * 
 * Usage:
 *   node scripts/system-health-check.js
 * 
 * Or from npm:
 *   npm run health-check
 */

const { PrismaClient } = require('./server/node_modules/@prisma/client');
const fs = require('fs');
const path = require('path');
const https = require('https');
const { execSync } = require('child_process');

const prisma = new PrismaClient();

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

const log = {
  success: (msg) => console.log(`${colors.green}✅ ${msg}${colors.reset}`),
  error: (msg) => console.log(`${colors.red}❌ ${msg}${colors.reset}`),
  warning: (msg) => console.log(`${colors.yellow}⚠️  ${msg}${colors.reset}`),
  info: (msg) => console.log(`${colors.cyan}ℹ️  ${msg}${colors.reset}`),
  section: (msg) => console.log(`\n${colors.blue}═══ ${msg} ═══${colors.reset}`)
};

const results = {
  checks: [],
  passed: 0,
  failed: 0,
  warnings: 0
};

function addResult(name, status, message) {
  results.checks.push({ name, status, message });
  if (status === 'pass') results.passed++;
  else if (status === 'fail') results.failed++;
  else if (status === 'warning') results.warnings++;
}

async function checkDatabase() {
  log.section('Database Health Check');
  
  try {
    // Test connection
    await prisma.$connect();
    log.success('Database connection successful');
    addResult('Database Connection', 'pass', 'Connected to Azure PostgreSQL');
    
    // Check record counts
    const counts = await Promise.all([
      prisma.customer.count(),
      prisma.customerContact.count(),
      prisma.emailCampaign.count(),
      prisma.emailTemplate.count()
    ]);
    
    const [customers, contacts, campaigns, templates] = counts;
    
    console.log(`  Customers: ${customers}`);
    console.log(`  Contacts: ${contacts}`);
    console.log(`  Campaigns: ${campaigns}`);
    console.log(`  Templates: ${templates}`);
    
    if (customers > 0) {
      log.success(`Database has ${customers} customers`);
      addResult('Customer Data', 'pass', `${customers} customers in database`);
    } else {
      log.warning('Database has ZERO customers - is this expected?');
      addResult('Customer Data', 'warning', 'No customers found');
    }
    
    // Check database schema is up to date
    try {
      execSync('cd server && npx prisma migrate status', { stdio: 'pipe' });
      log.success('Database schema is up to date');
      addResult('Database Schema', 'pass', 'All migrations applied');
    } catch (error) {
      log.warning('Database migrations might be pending');
      addResult('Database Schema', 'warning', 'Check migrations');
    }
    
  } catch (error) {
    log.error(`Database check failed: ${error.message}`);
    addResult('Database Connection', 'fail', error.message);
  }
}

function checkEnvironmentVariables() {
  log.section('Environment Variables Check');
  
  const requiredFrontend = [
    { file: '.env.local', vars: ['VITE_API_URL', 'VITE_AUTH_ALLOWED_EMAILS'] }
  ];
  
  const requiredBackend = [
    { file: 'server/.env', vars: ['DATABASE_URL', 'MICROSOFT_CLIENT_ID', 'MICROSOFT_CLIENT_SECRET', 'PORT'] }
  ];
  
  [...requiredFrontend, ...requiredBackend].forEach(({ file, vars }) => {
    const filepath = path.join(process.cwd(), file);
    
    if (!fs.existsSync(filepath)) {
      log.error(`Environment file missing: ${file}`);
      addResult(`Env File: ${file}`, 'fail', 'File not found');
      return;
    }
    
    const content = fs.readFileSync(filepath, 'utf8');
    const missing = vars.filter(v => !content.includes(v));
    
    if (missing.length === 0) {
      log.success(`${file} has all required variables`);
      addResult(`Env File: ${file}`, 'pass', 'All variables present');
    } else {
      log.error(`${file} is missing: ${missing.join(', ')}`);
      addResult(`Env File: ${file}`, 'fail', `Missing: ${missing.join(', ')}`);
    }
  });
}

function checkGitStatus() {
  log.section('Git Status Check');
  
  try {
    // Check for uncommitted changes
    const status = execSync('git status --porcelain', { encoding: 'utf8' });
    
    if (status.trim() === '') {
      log.success('Git working directory is clean');
      addResult('Git Status', 'pass', 'No uncommitted changes');
    } else {
      log.warning('There are uncommitted changes:');
      console.log(status);
      addResult('Git Status', 'warning', 'Uncommitted changes detected');
    }
    
    // Check recent commits
    const recentCommits = execSync('git log --oneline -5', { encoding: 'utf8' });
    log.info('Recent commits:');
    console.log(recentCommits);
    
    // Check for emergency/critical commits in last 24h
    try {
      const last24h = execSync('git log --since="24 hours ago" --oneline', { encoding: 'utf8' });
      if (last24h.includes('EMERGENCY') || last24h.includes('CRITICAL') || last24h.includes('URGENT')) {
        log.warning('Recent emergency commits detected - review for issues');
        addResult('Recent Activity', 'warning', 'Emergency fixes in last 24h');
      } else {
        addResult('Recent Activity', 'pass', 'No emergency commits');
      }
    } catch (e) {
      // No commits in last 24h is fine
      addResult('Recent Activity', 'pass', 'No recent commits');
    }
    
  } catch (error) {
    log.error(`Git check failed: ${error.message}`);
    addResult('Git Status', 'fail', error.message);
  }
}

function checkDeploymentStatus() {
  log.section('Deployment Status Check');
  
  try {
    // Check last GitHub Actions run
    const ghStatus = execSync('gh run list --limit 1 --json status,conclusion,name', { encoding: 'utf8' });
    const [lastRun] = JSON.parse(ghStatus);
    
    if (lastRun.conclusion === 'success') {
      log.success(`Last deployment: ${lastRun.name} - SUCCESS`);
      addResult('Last Deployment', 'pass', 'GitHub Actions passed');
    } else if (lastRun.conclusion === 'failure') {
      log.error(`Last deployment: ${lastRun.name} - FAILED`);
      addResult('Last Deployment', 'fail', 'GitHub Actions failed');
    } else {
      log.info(`Last deployment: ${lastRun.name} - ${lastRun.status}`);
      addResult('Last Deployment', 'warning', `Status: ${lastRun.status}`);
    }
  } catch (error) {
    log.warning('Could not check GitHub Actions (gh CLI not installed or not authenticated)');
    addResult('Last Deployment', 'warning', 'Unable to verify');
  }
}

function checkProductionSite() {
  log.section('Production Site Check');
  
  return new Promise((resolve) => {
    const url = 'https://odcrm.bidlow.co.uk';
    
    https.get(url, (res) => {
      if (res.statusCode === 200) {
        log.success(`Production site is UP (${url})`);
        addResult('Production Site', 'pass', 'Site accessible');
      } else {
        log.warning(`Production site returned status ${res.statusCode}`);
        addResult('Production Site', 'warning', `HTTP ${res.statusCode}`);
      }
      resolve();
    }).on('error', (error) => {
      log.error(`Production site is DOWN: ${error.message}`);
      addResult('Production Site', 'fail', error.message);
      resolve();
    });
  });
}

function checkBuildConfiguration() {
  log.section('Build Configuration Check');
  
  const files = [
    { path: 'package.json', name: 'Frontend package.json' },
    { path: 'server/package.json', name: 'Backend package.json' },
    { path: 'vite.config.ts', name: 'Vite config' },
    { path: 'server/prisma/schema.prisma', name: 'Prisma schema' },
    { path: '.github/workflows/deploy-frontend-azure-static-web-app.yml', name: 'GitHub Actions workflow' },
    { path: 'staticwebapp.config.json', name: 'Azure Static Web App config' }
  ];
  
  files.forEach(({ path: filepath, name }) => {
    if (fs.existsSync(filepath)) {
      log.success(`${name} exists`);
      addResult(`Config: ${name}`, 'pass', 'File exists');
    } else {
      log.error(`${name} is MISSING`);
      addResult(`Config: ${name}`, 'fail', 'File not found');
    }
  });
}

function printSummary() {
  log.section('Health Check Summary');
  
  console.log(`\nTotal Checks: ${results.checks.length}`);
  log.success(`Passed: ${results.passed}`);
  if (results.warnings > 0) log.warning(`Warnings: ${results.warnings}`);
  if (results.failed > 0) log.error(`Failed: ${results.failed}`);
  
  if (results.failed > 0) {
    console.log('\n❌ CRITICAL ISSUES:');
    results.checks
      .filter(c => c.status === 'fail')
      .forEach(c => console.log(`   - ${c.name}: ${c.message}`));
  }
  
  if (results.warnings > 0) {
    console.log('\n⚠️  WARNINGS:');
    results.checks
      .filter(c => c.status === 'warning')
      .forEach(c => console.log(`   - ${c.name}: ${c.message}`));
  }
  
  console.log('\n');
  
  if (results.failed === 0) {
    log.success('SYSTEM IS HEALTHY');
    return 0;
  } else {
    log.error('SYSTEM HAS ISSUES - REVIEW ABOVE');
    return 1;
  }
}

async function runHealthCheck() {
  console.log(`${colors.cyan}╔═══════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.cyan}║   ODCRM SYSTEM HEALTH CHECK       ║${colors.reset}`);
  console.log(`${colors.cyan}╚═══════════════════════════════════╝${colors.reset}\n`);
  console.log(`Timestamp: ${new Date().toISOString()}\n`);
  
  try {
    await checkDatabase();
    checkEnvironmentVariables();
    checkGitStatus();
    checkDeploymentStatus();
    await checkProductionSite();
    checkBuildConfiguration();
    
    const exitCode = printSummary();
    
    await prisma.$disconnect();
    process.exit(exitCode);
    
  } catch (error) {
    log.error(`Health check failed: ${error.message}`);
    console.error(error.stack);
    await prisma.$disconnect();
    process.exit(1);
  }
}

// Run health check
runHealthCheck();
