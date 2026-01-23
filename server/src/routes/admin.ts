import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

/**
 * POST /api/admin/migrate-websites
 * Migrates website URLs from accountData.website to the top-level website field
 */
router.post('/migrate-websites', async (req, res) => {
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
    const results: Array<{ name: string; action: string; website?: string }> = [];

    for (const customer of customers) {
      const accountDataWebsite = customer.accountData?.website;
      
      // If accountData has a website but the top-level field doesn't, migrate it
      if (accountDataWebsite && !customer.website) {
        await prisma.customer.update({
          where: { id: customer.id },
          data: { website: accountDataWebsite },
        });
        console.log(`✅ Updated ${customer.name}: ${accountDataWebsite}`);
        results.push({ name: customer.name, action: 'updated', website: accountDataWebsite });
        updated++;
      } else if (customer.website) {
        console.log(`⏭️  Skipped ${customer.name}: already has website (${customer.website})`);
        results.push({ name: customer.name, action: 'skipped_existing', website: customer.website });
        skipped++;
      } else {
        console.log(`⚠️  Skipped ${customer.name}: no website in accountData`);
        results.push({ name: customer.name, action: 'skipped_no_website' });
        skipped++;
      }
    }

    console.log('\n=== Migration Complete ===');
    console.log(`✅ Updated: ${updated} customers`);
    console.log(`⏭️  Skipped: ${skipped} customers`);

    res.json({
      success: true,
      summary: {
        total: customers.length,
        updated,
        skipped,
      },
      results,
    });
  } catch (error) {
    console.error('❌ Migration failed:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
