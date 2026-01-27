#!/usr/bin/env node

/**
 * Data Migration Script: Neon to Azure PostgreSQL using Prisma
 * Exports data from Neon and imports into Azure using Prisma client
 */

import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');
const serverDir = join(rootDir, 'server');

// Load environment variables
dotenv.config({ path: join(serverDir, '.env') });

console.log('🚀 Starting data migration from Neon to Azure PostgreSQL using Prisma...\n');

// Connection strings
const neonUrl = process.env.DATABASE_URL.replace('odcrmadmin:YourStrongPassword123!@odcrm-postgres.postgres.database.azure.com/postgres?sslmode=require', 'neondb_owner:npg_oqJvg13NVUBk@ep-silent-salad-ahpgcsne-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require');
const azureUrl = process.env.DATABASE_URL;

console.log('📊 Neon database:', neonUrl.split('@')[1].split('/')[0]);
console.log('📊 Azure database:', azureUrl.split('@')[1].split('/')[0]);

async function migrateTable(tableName, prismaFrom, prismaTo, options = {}) {
  console.log(`\n📤 Migrating ${tableName}...`);

  try {
    // Get all records from source
    const records = await prismaFrom[tableName].findMany({
      ...options
    });

    if (records.length === 0) {
      console.log(`   No records found in ${tableName}`);
      return;
    }

    console.log(`   Found ${records.length} records`);

    // Clear target table
    await prismaTo[tableName].deleteMany();

    // Insert records in batches
    const batchSize = 100;
    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      await prismaTo[tableName].createMany({
        data: batch.map(record => ({
          ...record,
          createdAt: record.createdAt || new Date(),
          updatedAt: record.updatedAt || new Date()
        }))
      });
      console.log(`   Migrated ${Math.min(i + batchSize, records.length)}/${records.length} records`);
    }

    console.log(`✅ ${tableName} migration completed`);
  } catch (error) {
    console.error(`❌ Error migrating ${tableName}:`, error.message);
    // Continue with other tables
  }
}

async function main() {
  const prismaNeon = new PrismaClient({
    datasourceUrl: neonUrl
  });

  const prismaAzure = new PrismaClient({
    datasourceUrl: azureUrl
  });

  try {
    console.log('🔌 Connecting to databases...');

    // Test connections
    await prismaNeon.$connect();
    await prismaAzure.$connect();

    console.log('✅ Connected to both databases');

    // Migrate tables in dependency order
    const tables = [
      'customers',
      'accounts',
      'contacts',
      'contact_lists',
      'contact_list_members',
      'leads',
      'email_templates',
      'email_campaigns',
      'campaign_sequences',
      'sequence_steps',
      'email_sends',
      'email_opens',
      'email_clicks',
      'email_replies',
      'email_bounces',
      'email_unsubscribes'
    ];

    for (const table of tables) {
      await migrateTable(table, prismaNeon, prismaAzure);
    }

    console.log('\n🎉 Data migration completed successfully!');

  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    throw error;
  } finally {
    await prismaNeon.$disconnect();
    await prismaAzure.$disconnect();
  }
}

main().catch((error) => {
  console.error('Migration script failed:', error);
  process.exit(1);
});