import express from 'express'
import path from 'node:path'
import cors from 'cors'
import dotenv from 'dotenv'
import { prisma } from './lib/prisma.js'
import './lib/prisma.js'
import campaignRoutes from './routes/campaigns.js'
import contactsRoutes from './routes/contacts.js'
import outlookRoutes from './routes/outlook.js'
import trackingRoutes from './routes/tracking.js'
import schedulesRoutes from './routes/schedules.js'
import reportsRoutes from './routes/reports.js'
import inboxRoutes from './routes/inbox.js'
import listsRoutes from './routes/lists.js'
import sequencesRoutes from './routes/sequences.js'
import customersRoutes from './routes/customers.js'
import leadsRoutes from './routes/leads.js'
import templatesRoutes from './routes/templates.js'
import companyDataRoutes from './routes/companyData.js'
import adminRoutes from './routes/admin.js'
import jobSectorsRoutes from './routes/jobSectors.js'
import jobRolesRoutes from './routes/jobRoles.js'
import placesRoutes from './routes/places.js'
import uploadsRoutes from './routes/uploads.js'
import suppressionRoutes from './routes/suppression.js'
import usersRoutes from './routes/users.js'
import userPreferencesRoutes from './routes/userPreferences.js'
import sheetsRoutes from './routes/sheets.js'
import diagRoutes from './routes/diag.js'
import overviewRoutes from './routes/overview.js'

dotenv.config()

// ============================================================================
// STARTUP DIAGNOSTICS - Environment Truth
// ============================================================================
const startupDiagnostics = () => {
  const timestamp = new Date().toISOString()
  const nodeEnv = process.env.NODE_ENV || 'development'
  
  // Extract and mask DATABASE_URL host
  let maskedDbHost = 'NOT_SET'
  let hasConnectionLimit = 'UNKNOWN'
  let hasPoolTimeout = 'UNKNOWN'
  if (process.env.DATABASE_URL) {
    try {
      const url = new URL(process.env.DATABASE_URL)
      maskedDbHost = url.hostname
      hasConnectionLimit = url.searchParams.has('connection_limit') ? 'YES' : 'NO'
      hasPoolTimeout = url.searchParams.has('pool_timeout') ? 'YES' : 'NO'
    } catch {
      maskedDbHost = 'INVALID_URL'
      hasConnectionLimit = 'INVALID_URL'
      hasPoolTimeout = 'INVALID_URL'
    }
  }
  
  console.log('========================================')
  console.log('🔍 STARTUP DIAGNOSTICS')
  console.log('========================================')
  console.log(`  Timestamp:    ${timestamp}`)
  console.log(`  NODE_ENV:     ${nodeEnv}`)
  console.log(`  DB Host:      ${maskedDbHost}`)
  console.log(`  DB conn limit param: ${hasConnectionLimit}`)
  console.log(`  DB pool timeout param: ${hasPoolTimeout}`)
  console.log(`  ADMIN_SECRET: ${process.env.ADMIN_SECRET ? 'SET' : 'NOT_SET'}`)
  console.log('========================================')
}
startupDiagnostics()

const app = express()

// ============================================================================
// API CACHING / ETAG DISABLE (CRITICAL)
// ----------------------------------------------------------------------------
// Production bug: Some clients/proxies were receiving 304 Not Modified responses
// for GET /api/* with NO body, causing frontend crashes when calling .json().
//
// Goal: All API endpoints must always return JSON bodies (no 304) and must not
// be cached. Disable Express ETags and set strict no-cache headers for /api/*.
// ============================================================================
app.set('etag', false)

app.use((req, res, next) => {
  if (req.path.startsWith('/api')) {
    // Disable all caching for API routes (browser + proxy/CDN)
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
    res.setHeader('Pragma', 'no-cache')
    res.setHeader('Expires', '0')
    res.setHeader('Surrogate-Control', 'no-store')

    // Ensure no ETag is present (Express ETag disabled above, but be explicit)
    res.removeHeader('ETag')
  }

  next()
})

const parseAllowedOrigins = () => {
  // Parse FRONTEND_URLS (comma-separated), FRONTEND_URL (single URL), and FRONTDOOR_URL
  const envUrls = []
  if (process.env.FRONTEND_URLS) {
    envUrls.push(...process.env.FRONTEND_URLS.split(',').map(s => s.trim()).filter(Boolean))
  }
  if (process.env.FRONTEND_URL) {
    envUrls.push(process.env.FRONTEND_URL.trim())
  }
  if (process.env.FRONTDOOR_URL) {
    envUrls.push(process.env.FRONTDOOR_URL.trim())
  }

  // In development, allow localhost by default
  const isDevelopment = process.env.NODE_ENV !== 'production'
  const devDefaults = isDevelopment ? ['http://localhost:5173', 'http://localhost:3000'] : []

  // CRITICAL: Always include production frontend URL as fallback
  // This prevents CORS issues even if environment variables aren't set in Azure
  const productionFallback = ['https://odcrm.bidlow.co.uk']

  const allOrigins = Array.from(new Set([...envUrls, ...devDefaults, ...productionFallback]))

  console.log('🔒 CORS Configuration:')
  console.log('   Environment:', process.env.NODE_ENV || 'development')
  console.log('   FRONTEND_URLS:', process.env.FRONTEND_URLS || 'NOT_SET')
  console.log('   FRONTEND_URL:', process.env.FRONTEND_URL || 'NOT_SET')
  console.log('   FRONTDOOR_URL:', process.env.FRONTDOOR_URL || 'NOT_SET')
  console.log('   Parsed from env:', envUrls.length > 0 ? envUrls.join(', ') : 'NONE')
  console.log('   Dev defaults:', devDefaults.length > 0 ? devDefaults.join(', ') : 'NONE')
  console.log('   Production fallback:', productionFallback.join(', '))
  console.log('   FINAL allowed origins:', allOrigins.join(', '))

  return allOrigins
}

const allowedOrigins = parseAllowedOrigins()

// Define CORS options for reuse
const corsOptions = {
  origin(origin, callback) {
    // Allow requests with no origin (e.g., mobile apps, Postman, curl)
    if (!origin) {
      console.log('✅ CORS: Allowed (no origin)')
      return callback(null, true)
    }

    // Normalize origin (remove trailing slash for comparison)
    const normalizedOrigin = origin.replace(/\/$/, '')

    // Check if origin is in allowed list (also check normalized versions)
    const isAllowed = allowedOrigins.some(allowed => {
      const normalizedAllowed = allowed.replace(/\/$/, '')
      return normalizedOrigin === normalizedAllowed
    })

    if (isAllowed) {
      console.log('✅ CORS: Allowed origin:', origin)
      return callback(null, true)
    }

    // Allow Vercel preview deployments
    if (origin.endsWith('.vercel.app')) {
      console.log('✅ CORS: Allowed Vercel preview:', origin)
      return callback(null, true)
    }

    // Block and log rejected origins
    console.error('❌ CORS: Blocked origin:', origin)
    console.error('   Normalized origin:', normalizedOrigin)
    console.error('   Allowed origins:', allowedOrigins)
    return callback(new Error(`CORS: Origin ${origin} not allowed`))
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  // IMPORTANT: Header casing varies between browsers/tools.
  // Also: frontend now sends Cache-Control + Pragma (to avoid cached 304 bodies),
  // which triggers a preflight. If we don't allow these headers, browser will
  // fail with "Failed to fetch" (CORS preflight rejection).
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Customer-Id',
    'x-customer-id',
    'X-Admin-Secret',
    'X-Admin-Diag-Key',
    'Cache-Control',
    'cache-control',
    'Pragma',
    'pragma',
    'If-None-Match',
    'if-none-match',
    'If-Match-Updated-At',
    'if-match-updated-at',
  ],
  optionsSuccessStatus: 204,
}

// Log CORS configuration
console.log('🔒 CORS Methods:', corsOptions.methods.join(', '))
console.log('🔒 CORS Allowed Headers:', corsOptions.allowedHeaders.join(', '))

// Middleware
app.use(cors(corsOptions))

// Handle OPTIONS preflight requests explicitly (fast path)
app.options('/api/*', cors(corsOptions))
app.options('*', cors(corsOptions))

// Increased limit for agreement uploads (base64 encoding inflates file size ~1.37x)
// 25MB JSON limit allows ~18MB original file after base64 decode
app.use(express.json({ limit: '25mb' }))
app.use(express.urlencoded({ extended: true, limit: '25mb' }))
// LEGACY: Local filesystem uploads (deprecated for new files)
// New agreement uploads use Azure Blob Storage (see blobUpload.ts)
// This route kept for backwards compatibility with old file URLs only
app.use('/uploads', express.static(path.resolve(process.cwd(), 'uploads')))

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// API health check (kept separate from customer-scoped routes)
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV || 'development',
    version: '2026-02-11-archive-fix',
    commit: process.env.WEBSITE_COMMIT_HASH || process.env.GITHUB_SHA || null,
    buildTime: process.env.BUILD_TIME || null
  })
})

// Version endpoint for deployment verification
app.get('/api/version', (req, res) => {
  res.json({ 
    gitSha: process.env.GITHUB_SHA || process.env.WEBSITE_COMMIT_HASH || 'unknown',
    buildTime: process.env.BUILD_TIME || 'unknown',
    version: '2026-02-11-archive-fix',
    deployedAt: new Date().toISOString()
  })
})

// Debug routes endpoint (DEV only or DEBUG=true)
app.get('/api/routes', (req, res) => {
  const isDebug = process.env.DEBUG === 'true' || process.env.NODE_ENV !== 'production'
  if (!isDebug) {
    return res.status(403).json({ error: 'Debug endpoint not available in production' })
  }
  
  // List all mounted route prefixes
  const mountedRoutes = [
    '/api/campaigns',
    '/api/contacts',
    '/api/outlook',
    '/api/email',
    '/api/schedules',
    '/api/reports',
    '/api/inbox',
    '/api/lists',
    '/api/sequences',
    '/api/customers',
    '/api/customers/:id/email-identities',
    '/api/leads',
    '/api/templates',
    '/api/company-data',
    '/api/admin',
    '/api/job-sectors',
    '/api/job-roles',
    '/api/places',
    '/api/uploads',
    '/api/suppression',
    '/api/users',
    '/api/user-preferences',
  ]
  
  res.json({ 
    mountedRoutes,
    timestamp: new Date().toISOString()
  })
})

// API Routes
console.log('📦 Mounting API routes...')
app.use('/api/campaigns', campaignRoutes)
app.use('/api/contacts', contactsRoutes)
app.use('/api/outlook', outlookRoutes)
app.use('/api/email', trackingRoutes)
app.use('/api/schedules', schedulesRoutes)
app.use('/api/reports', reportsRoutes)
app.use('/api/inbox', inboxRoutes)
app.use('/api/lists', listsRoutes)
app.use('/api/sequences', sequencesRoutes)
app.use('/api/customers', customersRoutes)
console.log('  ✓ Mounted: /api/customers (includes /:id/email-identities)')
app.use('/api/leads', leadsRoutes)
app.use('/api/templates', templatesRoutes)
app.use('/api/company-data', companyDataRoutes)
app.use('/api/admin', adminRoutes)
app.use('/api/job-sectors', jobSectorsRoutes)
app.use('/api/job-roles', jobRolesRoutes)
app.use('/api/places', placesRoutes)
app.use('/api/uploads', uploadsRoutes)
app.use('/api/suppression', suppressionRoutes)
app.use('/api/users', usersRoutes)
app.use('/api/user-preferences', userPreferencesRoutes)
app.use('/api/sheets', sheetsRoutes)
app.use('/api/_diag', diagRoutes)
app.use('/api/overview', overviewRoutes)
app.use('/api/reports', reportsRoutes)
console.log('📦 All API routes mounted successfully')

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err)
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  })
})

const PORT = process.env.PORT || 3001

// Start server
app.listen(PORT, async () => {
  console.log(`🚀 Server running on port ${PORT}`)
  
  // ============================================================================
  // BACKGROUND WORKERS / CRON JOBS
  // ============================================================================
  // These workers run automated tasks in production
  // Control via environment variables (see env.example)
  
  // Email scheduler
  const emailSchedulerEnabled = process.env.ENABLE_EMAIL_SCHEDULER === 'true'
  if (emailSchedulerEnabled) {
    console.log('📧 Starting email scheduler...')
    const { startEmailScheduler } = await import('./workers/emailScheduler.js')
    startEmailScheduler(prisma)
  } else {
    console.log('⏸️ Email scheduler disabled (set ENABLE_EMAIL_SCHEDULER=true to enable)')
  }

  // Reply detection worker
  const replyDetectorEnabled = process.env.ENABLE_REPLY_DETECTOR === 'true'
  if (replyDetectorEnabled) {
    console.log('📬 Starting reply detection worker...')
    const { startReplyDetectionWorker } = await import('./workers/replyDetection.js')
    startReplyDetectionWorker(prisma)
  } else {
    console.log('⏸️ Reply detection disabled (set ENABLE_REPLY_DETECTOR=true to enable)')
  }

  // Leads sync worker - syncs marketing leads from Google Sheets
  const leadsSyncEnabled = process.env.ENABLE_LEADS_SYNC === 'true'
  if (leadsSyncEnabled) {
    console.log('📊 Starting leads sync worker...')
    const { startLeadsSyncWorker } = await import('./workers/leadsSync.js')
    startLeadsSyncWorker(prisma)
  } else {
    console.log('⏸️ Leads sync disabled (set ENABLE_LEADS_SYNC=true to enable)')
  }

  // Company enrichment removed (no worker)
})

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...')
  await prisma.$disconnect()
  process.exit(0)
})

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully...')
  await prisma.$disconnect()
  process.exit(0)
})
