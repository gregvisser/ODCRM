#!/usr/bin/env node
/**
 * Fix Duplicate Customers Script
 * 
 * This script:
 * 1. Identifies duplicate customers by name
 * 2. Keeps the oldest record (first created)
 * 3. Migrates contacts/data to the kept record
 * 4. Deletes the duplicate records
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function findDuplicates() {
  console.log('🔍 Analyzing customers for duplicates...\n');
  
  const customers = await prisma.customer.findMany({
    select: {
      id: true,
      name: true,
      createdAt: true,
      _count: {
        select: {
          customerContacts: true
        }
      }
    },
    orderBy: { name: 'asc' }
  });

  const grouped = {};
  customers.forEach(c => {
    if (!grouped[c.name]) grouped[c.name] = [];
    grouped[c.name].push(c);
  });

  const duplicates = Object.entries(grouped).filter(([name, items]) => items.length > 1);

  console.log(`Total customers: ${customers.length}`);
  console.log(`Unique names: ${Object.keys(grouped).length}`);
  console.log(`Duplicates found: ${duplicates.length}\n`);

  if (duplicates.length > 0) {
    console.log('📋 Duplicate customers:\n');
    duplicates.forEach(([name, items]) => {
      console.log(`${name}: ${items.length} copies`);
      items.forEach((item, idx) => {
        const createdDate = new Date(item.createdAt).toISOString().split('T')[0];
        const contactCount = item._count.customerContacts;
        const marker = idx === 0 ? '✓ KEEP' : '✗ DELETE';
        console.log(`  ${marker} ${item.id} (created: ${createdDate}, contacts: ${contactCount})`);
      });
      console.log('');
    });
  }

  return duplicates;
}

async function fixDuplicates(duplicates, dryRun = true) {
  if (duplicates.length === 0) {
    console.log('✅ No duplicates to fix!');
    return;
  }

  console.log(dryRun ? '\n🧪 DRY RUN - No changes will be made\n' : '\n🔧 FIXING DUPLICATES\n');

  let totalDeleted = 0;

  for (const [name, items] of duplicates) {
    // Sort by createdAt (oldest first) - we keep the first one
    items.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    
    const keep = items[0];
    const deletions = items.slice(1);

    console.log(`Processing: ${name}`);
    console.log(`  Keep: ${keep.id} (${new Date(keep.createdAt).toISOString().split('T')[0]})`);

    for (const duplicate of deletions) {
      console.log(`  Deleting: ${duplicate.id}...`);

      if (!dryRun) {
        try {
          // First, migrate any contacts from duplicate to the kept record
          const contacts = await prisma.customerContact.findMany({
            where: { customerId: duplicate.id }
          });

          if (contacts.length > 0) {
            console.log(`    Migrating ${contacts.length} contacts...`);
            for (const contact of contacts) {
              // Check if contact with same email already exists on kept record
              const existing = await prisma.customerContact.findFirst({
                where: {
                  customerId: keep.id,
                  email: contact.email
                }
              });

              if (existing) {
                // Delete duplicate contact
                await prisma.customerContact.delete({
                  where: { id: contact.id }
                });
                console.log(`      Deleted duplicate contact: ${contact.email}`);
              } else {
                // Move contact to kept record
                await prisma.customerContact.update({
                  where: { id: contact.id },
                  data: { customerId: keep.id }
                });
                console.log(`      Moved contact: ${contact.email}`);
              }
            }
          }

          // Delete the duplicate customer
          await prisma.customer.delete({
            where: { id: duplicate.id }
          });

          console.log(`    ✅ Deleted customer: ${duplicate.id}`);
          totalDeleted++;
        } catch (error) {
          console.error(`    ❌ Error deleting ${duplicate.id}:`, error.message);
        }
      } else {
        totalDeleted++;
      }
    }
    console.log('');
  }

  if (dryRun) {
    console.log(`\n🧪 DRY RUN COMPLETE: Would delete ${totalDeleted} duplicate records`);
    console.log('\n⚠️  To actually fix the duplicates, run:');
    console.log('   node scripts/fix-duplicates.js --fix\n');
  } else {
    console.log(`\n✅ FIXED: Deleted ${totalDeleted} duplicate records\n`);
  }
}

async function main() {
  const dryRun = !process.argv.includes('--fix');
  
  try {
    const duplicates = await findDuplicates();
    await fixDuplicates(duplicates, dryRun);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
