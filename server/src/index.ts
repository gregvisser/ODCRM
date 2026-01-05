import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { PrismaClient } from '@prisma/client'
import campaignRoutes from './routes/campaigns.js'
import contactsRoutes from './routes/contacts.js'
import outlookRoutes from './routes/outlook.js'
import trackingRoutes from './routes/tracking.js'
import { startEmailScheduler } from './workers/emailScheduler.js'
import { startReplyDetectionWorker } from './workers/replyDetection.js'

dotenv.config()

const app = express()
const prisma = new PrismaClient()

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}))
app.use(express.json())

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
  
  // Start background workers
  console.log('📧 Starting email scheduler...')
  startEmailScheduler(prisma)
  
  console.log('📬 Starting reply detection worker...')
  startReplyDetectionWorker(prisma)
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
