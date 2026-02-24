import express from 'express'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
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
import liveLeadsRouter from './routes/liveLeads.js'
import leadSourcesRouter from './routes/leadSources.js'
import { generalRateLimiter } from './middleware/rateLimiter.js'

// Load server/.env (canonical). Do NOT load .env.local unless ALLOW_ENV_LOCAL=true.
// process.env.DATABASE_URL is not overridden after this block.
const serverDir = process.cwd()
const envPath = path.join(serverDir, '.env')
const envLocalPath = path.join(serverDir, '.env.local')

dotenv.config({ path: envPath })

// Load BUILD_SHA/BUILD_TIME from deployed artifact if not set (production parity without Azure app settings)
if (!process.env.BUILD_SHA || !process.env.BUILD_TIME) {
  const candidates = [
    path.join(serverDir, 'dist', 'buildInfo.generated.json'),
    path.join(serverDir, 'buildInfo.generated.json'),
  ]
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) {
        const data = JSON.parse(fs.readFileSync(p, 'utf8'))
        if (!process.env.BUILD_SHA) process.env.BUILD_SHA = data.BUILD_SHA ?? data.GIT_SHA ?? data.sha ?? ''
        if (!process.env.BUILD_TIME) process.env.BUILD_TIME = data.BUILD_TIME ?? data.time ?? ''
        break
      }
    } catch {
      /* ignore */
    }
  }
}

// Guard: production must have BUILD_SHA for verifiable deploys
if (process.env.NODE_ENV === 'production') {
  if (!process.env.BUILD_SHA) {
    console.error('FATAL: NODE_ENV=production but BUILD_SHA is not set. Set BUILD_SHA (or deploy with buildInfo.generated.json).')
    process.exit(1)
  }
} else if (!process.env.BUILD_SHA) {
  console.warn('⚠️ BUILD_SHA not set (non-production); build headers and /api/_build will show "unknown"')
}

let dbSource: string = '.env'
if (fs.existsSync(envLocalPath)) {
  if (process.env.ALLOW_ENV_LOCAL === 'true') {
    dotenv.config({ path: envLocalPath, override: true })
    dbSource = '.env.local'
  } else {
    console.warn('========================================')
    console.warn('⚠️  .env.local IGNORED (use Azure DB from .env)')
    console.warn('   Set ALLOW_ENV_LOCAL=true to load server/.env.local')
    console.warn('========================================')
  }
}

/** Parse DATABASE_URL and return hostname only (no credentials). */
function getDbHost (): string | null {
  const u = process.env.DATABASE_URL
  if (!u || typeof u !== 'string') return null
  try {
    return new URL(u).hostname
  } catch {
    return null
  }
}

// ============================================================================
// STARTUP DIAGNOSTICS - Environment Truth
// ============================================================================
const startupDiagnostics = () => {
  const timestamp = new Date().toISOString()
  const nodeEnv = process.env.NODE_ENV || 'development'
  
  // Extract and mask DATABASE_URL host (no credentials logged)
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
  console.log(`  DB Source:    ${dbSource}`)
  console.log(`  DB conn limit param: ${hasConnectionLimit}`)
  console.log(`  DB pool timeout param: ${hasPoolTimeout}`)
  console.log(`  ADMIN_SECRET: ${process.env.ADMIN_SECRET ? 'SET' : 'NOT_SET'}`)
  console.log('========================================')
}
startupDiagnostics()

const dbHost = getDbHost()
if (dbHost === 'localhost' || dbHost === '127.0.0.1') {
  console.warn('⚠️ DB Host is localhost (local dev database)')
}

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

// Build headers on every response (observational; for deploy verification)
app.use((_req, res, next) => {
  res.setHeader('x-odcrm-build-sha', process.env.BUILD_SHA || 'unknown')
  res.setHeader('x-odcrm-build-time', process.env.BUILD_TIME || 'unknown')
  res.setHeader(
    'x-odcrm-server-version',
    process.env.BUILD_SHA || process.env.GIT_SHA || process.env.WEBSITE_INSTANCE_ID || 'unknown'
  )
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
  origin(origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) {
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

// Rate limiting - protect API from abuse (Audit Fix 2026-02-24)
app.use('/api/', generalRateLimiter)
console.log('🛡️ Rate limiting enabled: 100 req/min general limit')

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

// ============================================================================
// Public build + route probes (NO auth) — registered early, no auth/tenant
// ============================================================================
function getBuildInfo(): { sha: string; time: string } {
  const envSha = process.env.BUILD_SHA || process.env.GIT_SHA || process.env.WEBSITE_COMMIT_HASH || process.env.GITHUB_SHA
  const envTime = process.env.BUILD_TIME
  if (envSha && envTime) return { sha: envSha, time: envTime }
  const cwd = process.cwd()
  const dirFromModule = path.dirname(fileURLToPath(import.meta.url))
  const candidates = [
    path.join(cwd, 'buildInfo.generated.json'),
    path.join(cwd, 'dist', 'buildInfo.generated.json'),
    path.join(dirFromModule, 'buildInfo.generated.json'),
    path.join(dirFromModule, '..', 'buildInfo.generated.json'),
  ]
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) {
        const data = JSON.parse(fs.readFileSync(p, 'utf8'))
        return { sha: data.GIT_SHA ?? data.sha ?? 'unknown', time: data.BUILD_TIME ?? data.time ?? 'unknown' }
      }
    } catch {
      // ignore
    }
  }
  return { sha: envSha || 'unknown', time: envTime || 'unknown' }
}

const buildProbeHandler = (_req: express.Request, res: express.Response) => {
  const { sha, time } = getBuildInfo()
  res.json({
    sha,
    time,
    node: process.version,
    env: process.env.NODE_ENV || 'development',
    service: 'odcrm-api',
  })
}

const routesProbeHandler = async (req: express.Request, res: express.Response) => {
  const base = `${req.protocol}://${req.get('host') || 'localhost'}`
  const paths = [
    { path: '/api/overview', name: 'overview' },
    { path: '/api/inbox/replies?limit=1', name: 'inbox' },
    { path: '/api/customers', name: 'customers' },
  ]
  const results: { path: string; status: string; code?: number; error?: string }[] = []
  for (const { path: p } of paths) {
    try {
      const r = await fetch(`${base}${p}`, { method: 'GET' })
      if (r.status === 400) results.push({ path: p, status: 'requiresTenant', code: r.status })
      else if (r.status === 401) results.push({ path: p, status: 'requiresAuth', code: r.status })
      else if (r.status === 403) results.push({ path: p, status: 'requiresAuth', code: r.status })
      else if (r.status === 404) results.push({ path: p, status: 'missing', code: r.status })
      else if (r.status >= 500) results.push({ path: p, status: 'error', code: r.status, error: r.statusText })
      else results.push({ path: p, status: 'exists', code: r.status })
    } catch (e: any) {
      results.push({ path: p, status: 'error', error: e?.message || String(e) })
    }
  }
  res.json({ routes: results, timestamp: new Date().toISOString() })
}

// ============================================================================
// Build + route probes — MUST stay before any app.use('/api/...') so they
// are never shadowed. Also register without /api prefix for proxies that strip it.
// ============================================================================
app.get('/api/__build', buildProbeHandler)
app.get('/api/__routes', routesProbeHandler)
app.get('/api/_build', buildProbeHandler)
app.get('/api/_routes', routesProbeHandler)
app.get('/__build', buildProbeHandler)
app.get('/_build', buildProbeHandler)
app.get('/__routes', routesProbeHandler)
app.get('/_routes', routesProbeHandler)

// API health check — include sha + buildTime so backend swap is verifiable (read per-request)
app.get('/api/health', (_req, res) => {
  const buildInfo = getBuildInfo()
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV || 'development',
    version: '2026-02-11-archive-fix',
    sha: buildInfo.sha,
    buildTime: buildInfo.time,
    commit: process.env.WEBSITE_COMMIT_HASH || process.env.GITHUB_SHA || null,
    buildTimeEnv: process.env.BUILD_TIME || null,
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
app.get('/api/routes', (req, res): void => {
  const isDebug = process.env.DEBUG === 'true' || process.env.NODE_ENV !== 'production'
  if (!isDebug) {
    res.status(403).json({ error: 'Debug endpoint not available in production' })
    return
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
    '/api/live',
    '/api/lead-sources',
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

// Observability headers for marketing/dashboard routes (no debug logs, no sensitive data)
const observabilityHeaders = (_req: express.Request, res: express.Response, next: express.NextFunction) => {
  const buildInfo = getBuildInfo()
  res.setHeader('x-odcrm-build-sha', buildInfo.sha)
  res.setHeader('x-odcrm-route-version', 'v1')
  next()
}

// API Routes
console.log('📦 Mounting API routes...')
app.use('/api/campaigns', observabilityHeaders, campaignRoutes)
app.use('/api/contacts', contactsRoutes)
app.use('/api/outlook', observabilityHeaders, outlookRoutes)
app.use('/api/email', trackingRoutes)
app.use('/api/schedules', schedulesRoutes)
app.use('/api/reports', reportsRoutes)
app.use('/api/inbox', observabilityHeaders, inboxRoutes)
app.use('/api/lists', listsRoutes)
app.use('/api/sequences', observabilityHeaders, sequencesRoutes)
app.use('/api/customers', customersRoutes)
console.log('  ✓ Mounted: /api/customers (includes /:id/email-identities)')
app.use('/api/leads', leadsRoutes)
app.use('/api/live', liveLeadsRouter)
app.use('/api/lead-sources', leadSourcesRouter)
app.use('/api/templates', observabilityHeaders, templatesRoutes)
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
app.use('/api/overview', observabilityHeaders, overviewRoutes)
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

// Boot marker (after env load, before listening)
console.log('========================================')
console.log('🚀 ODCRM Backend Boot')
console.log('  Build SHA:  ', process.env.BUILD_SHA || 'unknown')
console.log('  Build Time: ', process.env.BUILD_TIME || 'unknown')
console.log('  Node:       ', process.version)
console.log('========================================')

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

  // Leads sync worker - only when connected to Azure/Neon (source of truth)
  const wantLeadsSync = process.env.ENABLE_LEADS_SYNC === 'true'
  const cronValue = process.env.LEADS_SYNC_CRON || '*/10 * * * *'
  const isAzureLike = dbHost != null && (
    dbHost.includes('.postgres.database.azure.com') ||
    dbHost.includes('neon.tech')
  )
  if (wantLeadsSync && !isAzureLike) {
    console.warn('⛔ Leads sync BLOCKED: non-Azure DB host ' + (dbHost ?? 'unknown'))
  } else if (wantLeadsSync && isAzureLike) {
    console.log(`✅ Leads sync ENABLED (cron=${cronValue})`)
    const { startLeadsSyncWorker } = await import('./workers/leadsSync.js')
    startLeadsSyncWorker(prisma)
  } else {
    console.log('⏸️ Leads sync disabled')
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

