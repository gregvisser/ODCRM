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
import { startEmailScheduler } from './workers/emailScheduler.js'
import { startReplyDetectionWorker } from './workers/replyDetection.js'
import { startLeadsSyncWorker } from './workers/leadsSync.js'
import { startAboutEnrichmentWorker } from './workers/aboutEnrichment.js'

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

const parseAllowedOrigins = () => {
  // Parse FRONTEND_URLS (comma-separated) and FRONTEND_URL (single URL)
  const envUrls = []
  if (process.env.FRONTEND_URLS) {
    envUrls.push(...process.env.FRONTEND_URLS.split(',').map(s => s.trim()).filter(Boolean))
  }
  if (process.env.FRONTEND_URL) {
    envUrls.push(process.env.FRONTEND_URL.trim())
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
  console.log('   Parsed from env:', envUrls.length > 0 ? envUrls.join(', ') : 'NONE')
  console.log('   Dev defaults:', devDefaults.length > 0 ? devDefaults.join(', ') : 'NONE')
  console.log('   Production fallback:', productionFallback.join(', '))
  console.log('   FINAL allowed origins:', allOrigins.join(', '))

  return allOrigins
}

const allowedOrigins = parseAllowedOrigins()

// Middleware
app.use(
  cors({
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
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Customer-Id', 'X-Admin-Secret', 'X-Admin-Diag-Key'],
  }),
)

// Handle OPTIONS preflight requests explicitly
app.options('*', cors({
  origin: allowedOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Customer-Id', 'X-Admin-Secret', 'X-Admin-Diag-Key'],
}))

app.use(express.json())
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
    version: '2026-02-05-v2',
    commit: process.env.WEBSITE_COMMIT_HASH || null
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
app.listen(PORT, () => {
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
    startEmailScheduler(prisma)
  } else {
    console.log('⏸️ Email scheduler disabled (set ENABLE_EMAIL_SCHEDULER=true to enable)')
  }

  // Reply detection worker
  const replyDetectorEnabled = process.env.ENABLE_REPLY_DETECTOR === 'true'
  if (replyDetectorEnabled) {
    console.log('📬 Starting reply detection worker...')
    startReplyDetectionWorker(prisma)
  } else {
    console.log('⏸️ Reply detection disabled (set ENABLE_REPLY_DETECTOR=true to enable)')
  }

  // Leads sync worker - syncs marketing leads from Google Sheets
  const leadsSyncEnabled = process.env.ENABLE_LEADS_SYNC === 'true'
  if (leadsSyncEnabled) {
    console.log('📊 Starting leads sync worker...')
    startLeadsSyncWorker(prisma)
  } else {
    console.log('⏸️ Leads sync disabled (set ENABLE_LEADS_SYNC=true to enable)')
  }

  // About/Company enrichment worker - refreshes company data quarterly
  const aboutEnrichmentEnabled = process.env.ENABLE_ABOUT_ENRICHMENT === 'true'
  if (aboutEnrichmentEnabled) {
    console.log('🤖 Starting About enrichment worker...')
    startAboutEnrichmentWorker(prisma)
  } else {
    console.log('⏸️ About enrichment disabled (set ENABLE_ABOUT_ENRICHMENT=true to enable)')
  }
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
