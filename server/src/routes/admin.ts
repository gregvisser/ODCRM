import { Router, Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// ============================================================================
// Admin Secret Middleware
// ============================================================================
const validateAdminSecret = (req: Request, res: Response, next: NextFunction) => {
  const adminSecret = process.env.ADMIN_SECRET;
  const providedSecret = req.headers['x-admin-secret'];
  
  if (!adminSecret) {
    return res.status(500).json({
      success: false,
      error: 'ADMIN_SECRET not configured on server',
    });
  }
  
  if (!providedSecret || providedSecret !== adminSecret) {
    return res.status(401).json({
      success: false,
      error: 'Invalid or missing X-Admin-Secret header',
    });
  }
  
  next();
};

// ============================================================================
// POST /api/admin/persistence-test
// Proves database persistence: create -> read -> delete a test record
// Protected by X-Admin-Secret header
// ============================================================================
router.post('/persistence-test', validateAdminSecret, async (req, res) => {
  const testId = `__PERSISTENCE_TEST_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  const timestamp = new Date().toISOString();
  
  console.log(`[${timestamp}] 🧪 Starting persistence test with testId: ${testId}`);
  
  const results: {
    step: string;
    success: boolean;
    data?: unknown;
    error?: string;
    timestamp: string;
  }[] = [];
  
  try {
    // Step 1: CREATE
    console.log(`[${timestamp}] 📝 Step 1: Creating test record...`);
    const created = await prisma.customer.create({
      data: {
        id: testId,
        name: `__PERSISTENCE_TEST_${timestamp}`,
      },
    });
    results.push({
      step: 'CREATE',
      success: true,
      data: { id: created.id, name: created.name },
      timestamp: new Date().toISOString(),
    });
    console.log(`[${timestamp}] ✅ Step 1: Created record with id: ${created.id}`);
    
    // Step 2: READ
    console.log(`[${timestamp}] 📖 Step 2: Reading test record...`);
    const read = await prisma.customer.findUnique({
      where: { id: testId },
    });
    if (!read) {
      throw new Error('READ FAILED: Record not found after CREATE');
    }
    results.push({
      step: 'READ',
      success: true,
      data: { id: read.id, name: read.name, verified: read.id === testId },
      timestamp: new Date().toISOString(),
    });
    console.log(`[${timestamp}] ✅ Step 2: Read verified, id matches: ${read.id === testId}`);
    
    // Step 3: DELETE
    console.log(`[${timestamp}] 🗑️ Step 3: Deleting test record...`);
    await prisma.customer.delete({
      where: { id: testId },
    });
    results.push({
      step: 'DELETE',
      success: true,
      timestamp: new Date().toISOString(),
    });
    console.log(`[${timestamp}] ✅ Step 3: Deleted test record`);
    
    // Step 4: VERIFY DELETE
    console.log(`[${timestamp}] 🔍 Step 4: Verifying deletion...`);
    const verifyDelete = await prisma.customer.findUnique({
      where: { id: testId },
    });
    results.push({
      step: 'VERIFY_DELETE',
      success: verifyDelete === null,
      data: { recordExists: verifyDelete !== null },
      timestamp: new Date().toISOString(),
    });
    console.log(`[${timestamp}] ✅ Step 4: Deletion verified, record gone: ${verifyDelete === null}`);
    
    // Return success
    const response = {
      success: true,
      message: 'Database persistence test PASSED',
      testId,
      environment: {
        NODE_ENV: process.env.NODE_ENV || 'development',
        dbHost: process.env.DATABASE_URL ? new URL(process.env.DATABASE_URL).hostname : 'NOT_SET',
      },
      results,
      completedAt: new Date().toISOString(),
    };
    
    console.log(`[${timestamp}] ✅ PERSISTENCE TEST PASSED`);
    res.json(response);
    
  } catch (error) {
    console.error(`[${timestamp}] ❌ PERSISTENCE TEST FAILED:`, error);
    
    // Cleanup: try to delete test record if it exists
    try {
      await prisma.customer.delete({ where: { id: testId } });
      console.log(`[${timestamp}] 🧹 Cleaned up test record after failure`);
    } catch {
      // Ignore cleanup errors
    }
    
    res.status(500).json({
      success: false,
      message: 'Database persistence test FAILED',
      testId,
      environment: {
        NODE_ENV: process.env.NODE_ENV || 'development',
        dbHost: process.env.DATABASE_URL ? (() => {
          try { return new URL(process.env.DATABASE_URL!).hostname; } catch { return 'INVALID_URL'; }
        })() : 'NOT_SET',
      },
      results,
      error: error instanceof Error ? error.message : 'Unknown error',
      failedAt: new Date().toISOString(),
    });
  }
});

const getWebsiteFromAccountData = (accountData: unknown): string | null => {
  if (!accountData || typeof accountData !== 'object') {
    return null;
  }
  const candidate = (accountData as { website?: unknown }).website;
  return typeof candidate === 'string' && candidate.trim() ? candidate : null;
};

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
      const accountDataWebsite = getWebsiteFromAccountData(customer.accountData);
      
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
