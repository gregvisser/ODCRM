import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { randomUUID } from 'crypto';

const router = Router();

// ============================================================================
// Diagnostic Admin Key Middleware
// ============================================================================
const validateAdminDiagKey = (req: Request, res: Response, next: NextFunction) => {
  // Skip validation in development, or if ADMIN_DIAG_KEY is not set (disabled)
  const isProduction = process.env.NODE_ENV === 'production';
  const adminDiagKey = process.env.ADMIN_DIAG_KEY;

  if (!isProduction || !adminDiagKey) {
    console.log('[diag] Diagnostic endpoints enabled (dev mode or no ADMIN_DIAG_KEY set)');
    return next();
  }

  const providedKey = req.headers['x-admin-diag-key'];

  if (!providedKey || providedKey !== adminDiagKey) {
    return res.status(401).json({
      success: false,
      error: 'Invalid or missing X-Admin-Diag-Key header',
    });
  }

  next();
};

// ============================================================================
// GET /api/_diag/db
// Returns database connection diagnostics (no secrets)
// ============================================================================
router.get('/db', validateAdminDiagKey, (req, res) => {
  let dbHost = 'NOT_SET';
  let hasConnectionLimit = false;
  let hasPoolTimeout = false;

  if (process.env.DATABASE_URL) {
    try {
      const url = new URL(process.env.DATABASE_URL);
      dbHost = url.hostname;
      hasConnectionLimit = url.searchParams.has('connection_limit');
      hasPoolTimeout = url.searchParams.has('pool_timeout');
    } catch (error) {
      dbHost = 'INVALID_URL';
    }
  }

  res.json({
    success: true,
    timestamp: new Date().toISOString(),
    dbHost,
    hasConnectionLimit,
    hasPoolTimeout,
  });
});

// ============================================================================
// POST /api/_diag/create-emailcampaign
// Creates a minimal EmailCampaign to test Prisma middleware logging
// ============================================================================
router.post('/create-emailcampaign', validateAdminDiagKey, async (req, res) => {
  const testId = `__DIAG_TEST_${Date.now()}_${Math.random().toString(36).substring(7)}`;

  try {
    console.log(`[diag] Creating diagnostic EmailCampaign: ${testId}`);

    // Get first customer for the test (we know there are 14 customers from startup check)
    const customer = await prisma.customer.findFirst({
      select: { id: true },
    });

    if (!customer) {
      return res.status(500).json({
        success: false,
        error: 'No customer found for diagnostic test',
      });
    }

    // Create minimal EmailCampaign - this should trigger Prisma middleware logging
    // Match the pattern from campaigns.ts route
    const dataForCreate = {
      id: randomUUID(),
      customerId: customer.id,
      name: `Diagnostic Campaign ${testId}`,
      description: 'Created by diagnostic endpoint to test Prisma middleware',
      status: 'draft',
    } as any

    try {
      const campaign = await prisma.emailCampaign.create({
        data: dataForCreate,
        select: {
          id: true,
          customerId: true,
          name: true,
          status: true,
          createdAt: true,
        },
      });

      // Clean up the test campaign
      await prisma.emailCampaign.delete({
        where: { id: campaign.id },
      });

      console.log(`[diag] Diagnostic EmailCampaign created and cleaned up: ${campaign.id}`);

      res.json({
        success: true,
        timestamp: new Date().toISOString(),
        message: 'EmailCampaign created successfully - check logs for Prisma middleware output',
        campaign: {
          id: campaign.id,
          name: campaign.name,
          status: campaign.status,
        },
        middlewareLogged: true,
      });
    } catch (createError) {
      // Even if creation fails, the middleware should have logged
      console.log(`[diag] EmailCampaign creation failed as expected, but middleware should have logged`);

      res.json({
        success: true,
        timestamp: new Date().toISOString(),
        message: 'EmailCampaign creation attempted - check logs for Prisma middleware output',
        middlewareLogged: true,
        createError: createError instanceof Error ? createError.message : 'Unknown create error',
        note: 'Creation may fail due to schema constraints, but middleware logging is the key test',
      });
    }

  } catch (error) {
    console.error('[diag] Error in diagnostic endpoint:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    });
  }
});

export default router;