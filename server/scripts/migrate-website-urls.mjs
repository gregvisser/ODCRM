/**
 * Migration script: Copy website URLs from accountData.website to top-level website field
 * This ensures the enrichment service can access the website URL for all customers.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function migrateWebsiteUrls() {
  try {
    console.log('Starting website URL migration...');

    // Get all customers
    const customers = await prisma.customer.findMany({
      select: {
        id: true,
        name: true,
        website: true,
        accountData: true,
      },
    });

    console.log(`Found ${customers.length} customers`);

    let updated = 0;
    let skipped = 0;

    for (const customer of customers) {
      const accountDataWebsite = customer.accountData?.website;
      
      // If accountData has a website but the top-level field doesn't, migrate it
      if (accountDataWebsite && !customer.website) {
        await prisma.customer.update({
          where: { id: customer.id },
          data: { website: accountDataWebsite },
        });
        console.log(`✅ Updated ${customer.name}: ${accountDataWebsite}`);
        updated++;
      } else if (customer.website) {
        console.log(`⏭️  Skipped ${customer.name}: already has website (${customer.website})`);
        skipped++;
      } else {
        console.log(`⚠️  Skipped ${customer.name}: no website in accountData`);
        skipped++;
      }
    }

    console.log('\n=== Migration Complete ===');
    console.log(`✅ Updated: ${updated} customers`);
    console.log(`⏭️  Skipped: ${skipped} customers`);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the migration
migrateWebsiteUrls()
  .then(() => {
    console.log('\n✅ Migration completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  });
