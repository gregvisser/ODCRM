import express from 'express'
import path from 'node:path'
import cors from 'cors'
import dotenv from 'dotenv'
import { prisma } from './lib/prisma.js'
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
import { startEmailScheduler } from './workers/emailScheduler.js'
import { startReplyDetectionWorker } from './workers/replyDetection.js'
import { startLeadsSyncWorker } from './workers/leadsSync.js'
import { startAboutEnrichmentWorker } from './workers/aboutEnrichment.js'

dotenv.config()

const app = express()

const parseAllowedOrigins = () => {
  const raw = [process.env.FRONTEND_URLS, process.env.FRONTEND_URL]
    .filter(Boolean)
    .join(',')
  const fromEnv = raw
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)

  // In development, allow localhost by default
  // In production, ONLY use environment variables (no hardcoded defaults)
  const isDevelopment = process.env.NODE_ENV !== 'production'
  const devDefaults = isDevelopment ? ['http://localhost:5173'] : []

  // Production domains should be set via FRONTEND_URL/FRONTEND_URLS env vars
  // Example: FRONTEND_URLS=https://www.bidlow.co.uk,https://bidlow.co.uk
  return Array.from(new Set([...fromEnv, ...devDefaults]))
}

const allowedOrigins = parseAllowedOrigins()

// Middleware
app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true)
      if (allowedOrigins.includes(origin)) return callback(null, true)
      if (origin.endsWith('.vercel.app')) return callback(null, true)
      return callback(new Error('Not allowed by CORS'))
    },
    credentials: true,
  }),
)
app.use(express.json())
app.use('/uploads', express.static(path.resolve(process.cwd(), 'uploads')))

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// API health check (kept separate from customer-scoped routes)
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// API Routes
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
  
  // Email scheduler and reply detection
  const emailWorkersDisabled = process.env.EMAIL_WORKERS_DISABLED === 'true'
  if (!emailWorkersDisabled) {
    console.log('📧 Starting email scheduler...')
    startEmailScheduler(prisma)
    console.log('📬 Starting reply detection worker...')
    startReplyDetectionWorker(prisma)
  } else {
    console.log('⚠️  Email workers disabled via EMAIL_WORKERS_DISABLED=true')
  }

  // Leads sync worker - syncs marketing leads from Google Sheets
  const leadsSyncDisabled = process.env.LEADS_SYNC_DISABLED === 'true'
  if (!leadsSyncDisabled) {
    console.log('📊 Starting leads sync worker...')
    startLeadsSyncWorker(prisma)
  } else {
    console.log('⚠️  Leads sync worker disabled via LEADS_SYNC_DISABLED=true')
  }

  // About/Company enrichment worker - refreshes company data quarterly
  const aboutEnrichmentDisabled = process.env.ABOUT_ENRICHMENT_DISABLED === 'true'
  if (!aboutEnrichmentDisabled) {
    console.log('🤖 Starting About enrichment worker...')
    startAboutEnrichmentWorker(prisma)
  } else {
    console.log('⚠️  About enrichment worker disabled via ABOUT_ENRICHMENT_DISABLED=true')
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
