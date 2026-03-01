/**
 * Stage 1E: Admin send-queue tick endpoint (dry-run only).
 * POST /api/send-queue/tick — requires X-Admin-Secret; runs one dry-run pass for a customer.
 */
import { Router, Request, Response } from 'express'
import { prisma } from '../lib/prisma.js'
import { OutboundSendQueueStatus } from '@prisma/client'
import { randomUUID } from 'node:crypto'
import { validateAdminSecret } from './admin.js'
import { requeueDryRun, DRY_RUN_DEFAULT_REASON } from '../utils/sendQueue.js'

const router = Router()
const TICK_LOCK_PREFIX = 'tick_'

type TickBody = {
  customerId?: string
  limit?: number
  dryRun?: boolean
}

/**
 * POST /api/send-queue/tick
 * Body: { customerId: string, limit?: number (default 25, max 100), dryRun?: boolean (default true; must be true) }
 * Returns: { data: { customerId, limit, lockedBy, scanned, locked, processed, requeued, skipped, errors } }
 */
router.post('/tick', validateAdminSecret, async (req: Request, res: Response) => {
  const body = (req.body || {}) as TickBody
  const customerId = typeof body.customerId === 'string' ? body.customerId.trim() : ''
  if (!customerId) {
    res.status(400).json({ error: 'customerId is required in request body' })
    return
  }
  let limit = typeof body.limit === 'number' ? body.limit : 25
  if (Number.isNaN(limit) || limit < 1) limit = 25
  if (limit > 100) limit = 100
  const dryRun = body.dryRun !== false
  if (!dryRun) {
    res.status(400).json({ error: 'dryRun must be true (only dry-run tick is supported)' })
    return
  }

  const now = new Date()
  const lockedBy = `${TICK_LOCK_PREFIX}${randomUUID()}`

  let scanned = 0
  let locked = 0
  let processed = 0
  let requeued = 0
  let skipped = 0
  let errors = 0

  try {
    const candidates = await prisma.outboundSendQueueItem.findMany({
      where: {
        customerId,
        status: OutboundSendQueueStatus.QUEUED,
        OR: [
          { scheduledFor: null },
          { scheduledFor: { lte: now } },
        ],
      },
      orderBy: [{ scheduledFor: 'asc' }, { createdAt: 'asc' }],
      take: limit,
    })
    scanned = candidates.length
    if (scanned === 0) {
      res.json({
        data: {
          customerId,
          limit,
          lockedBy,
          scanned: 0,
          locked: 0,
          processed: 0,
          requeued: 0,
          skipped: 0,
          errors: 0,
        },
      })
      return
    }

    const lockedIds: string[] = []
    for (const item of candidates) {
      const updated = await prisma.outboundSendQueueItem.updateMany({
        where: { id: item.id, status: OutboundSendQueueStatus.QUEUED },
        data: {
          status: OutboundSendQueueStatus.LOCKED,
          lockedAt: now,
          lockedBy,
          attemptCount: item.attemptCount + 1,
        },
      })
      if (updated.count > 0) lockedIds.push(item.id)
    }
    locked = lockedIds.length

    const lockedItems = await prisma.outboundSendQueueItem.findMany({
      where: { id: { in: lockedIds } },
      orderBy: { createdAt: 'asc' },
    })

    for (const item of lockedItems) {
      processed += 1
      try {
        await requeueDryRun(prisma, item.id, DRY_RUN_DEFAULT_REASON)
        requeued += 1
      } catch (err) {
        errors += 1
        const msg = (err as Error)?.message?.slice(0, 500) ?? 'unknown error'
        try {
          await requeueDryRun(prisma, item.id, msg)
          requeued += 1
        } catch {
          // ensure unlocked
          await prisma.outboundSendQueueItem.update({
            where: { id: item.id },
            data: {
              status: OutboundSendQueueStatus.QUEUED,
              lockedAt: null,
              lockedBy: null,
              lastError: msg.slice(0, 500),
            },
          })
          requeued += 1
        }
      }
    }

    res.json({
      data: {
        customerId,
        limit,
        lockedBy,
        scanned,
        locked,
        processed,
        requeued,
        skipped,
        errors,
      },
    })
  } catch (err) {
    console.error('[send-queue/tick] error:', err)
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Tick failed',
    })
  }
})

export default router
