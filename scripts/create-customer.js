#!/usr/bin/env node

/**
 * Create Production Customer Helper
 * Creates a customer record in the production database
 */

import { PrismaClient } from '@prisma/client';
import { existsSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';
import readline from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');
const serverDir = join(rootDir, 'server');
const serverEnvPath = join(serverDir, '.env');

// Load environment variables
if (existsSync(serverEnvPath)) {
  dotenv.config({ path: serverEnvPath });
} else {
  console.error('❌ server/.env not found!');
  process.exit(1);
}

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl || databaseUrl.includes('localhost')) {
  console.error('❌ DATABASE_URL not configured for production!');
  process.exit(1);
}

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: databaseUrl
    }
  }
});

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function main() {
  console.log('👤 Create Production Customer\n');
  
  try {
    // Check if customers already exist
    const existingCustomers = await prisma.customer.findMany();
    
    if (existingCustomers.length > 0) {
      console.log('📋 Existing customers:');
      existingCustomers.forEach(c => {
        console.log(`   - ${c.id}: ${c.name} (${c.domain || 'no domain'})`);
      });
      
      const createMore = await question('\nCreate another customer? (y/n): ');
      if (createMore.toLowerCase() !== 'y') {
        console.log('✅ Exiting');
        process.exit(0);
      }
    }
    
    // Get customer details
    const id = await question('Customer ID (e.g., prod-customer-1): ');
    if (!id || id.trim() === '') {
      console.error('❌ Customer ID is required');
      process.exit(1);
    }
    
    // Check if ID already exists
    const existing = await prisma.customer.findUnique({
      where: { id: id.trim() }
    });
    
    if (existing) {
      console.error(`❌ Customer with ID "${id}" already exists!`);
      process.exit(1);
    }
    
    const name = await question('Customer Name (e.g., OpensDoors): ') || 'OpensDoors';
    const domain = await question('Domain (e.g., yourdomain.com, optional): ') || null;
    
    // Create customer
    console.log('\n📦 Creating customer...');
    const customer = await prisma.customer.create({
      data: {
        id: id.trim(),
        name: name.trim(),
        domain: domain?.trim() || null
      }
    });
    
    console.log('\n✅ Customer created successfully!');
    console.log(`   ID: ${customer.id}`);
    console.log(`   Name: ${customer.name}`);
    console.log(`   Domain: ${customer.domain || 'none'}`);
    console.log(`   Created: ${customer.createdAt}`);
    
    console.log('\n📋 Next steps:');
    console.log(`   1. Set in browser: localStorage.setItem('currentCustomerId', '${customer.id}')`);
    console.log('   2. Refresh the page');
    console.log('   3. Continue with deployment testing');
    
  } catch (error) {
    console.error('\n❌ Error creating customer:');
    console.error(error.message);
    if (error.code === 'P2002') {
      console.error('   Customer ID already exists!');
    }
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    rl.close();
  }
}

main();
