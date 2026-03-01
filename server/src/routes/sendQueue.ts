/**
 * Stage 1E/1F: Admin send-queue tick endpoint.
 * POST /api/send-queue/tick — requires X-Admin-Secret.
 * dryRun=true (default): dry-run only. dryRun=false: live send only when ODCRM_ALLOW_LIVE_TICK and canary gates pass.
 */
import { Router, Request, Response } from 'express'
import { prisma } from '../lib/prisma.js'
import { OutboundSendQueueStatus } from '@prisma/client'
import { randomUUID } from 'node:crypto'
import { validateAdminSecret } from './admin.js'
import { requeueDryRun, requeueAfterSendFailure, DRY_RUN_DEFAULT_REASON, LIVE_SEND_CAP } from '../utils/sendQueue.js'
import { processOne } from '../workers/sendQueueWorker.js'

const router = Router()
const TICK_LOCK_PREFIX = 'tick_'

type TickBody = {
  customerId?: string
  limit?: number
  dryRun?: boolean
  ignoreWindow?: boolean
}

function liveTickAllowed(customerId: string): { allowed: boolean; reason?: string } {
  if (process.env.ODCRM_ALLOW_LIVE_TICK !== 'true') {
    return { allowed: false, reason: 'ODCRM_ALLOW_LIVE_TICK must be true for live tick' }
  }
  if (process.env.ENABLE_SEND_QUEUE_SENDING !== 'true') {
    return { allowed: false, reason: 'ENABLE_SEND_QUEUE_SENDING must be true' }
  }
  if (process.env.ENABLE_LIVE_SENDING !== 'true') {
    return { allowed: false, reason: 'ENABLE_LIVE_SENDING must be true' }
  }
  const canaryCustomer = process.env.SEND_CANARY_CUSTOMER_ID?.trim() || null
  if (canaryCustomer == null || customerId !== canaryCustomer) {
    return { allowed: false, reason: 'customerId must equal SEND_CANARY_CUSTOMER_ID for live tick' }
  }
  return { allowed: true }
}

/**
 * POST /api/send-queue/tick
 * Body: { customerId: string, limit?: number (default 25, max 100), dryRun?: boolean (default true), ignoreWindow?: boolean (Stage 1G) }
 * When dryRun=false: live send only if ODCRM_ALLOW_LIVE_TICK + canary gates pass; step 0 only; cap LIVE_SEND_CAP.
 * When ignoreWindow=true (and dryRun=false): requires ODCRM_ALLOW_LIVE_TICK_IGNORE_WINDOW=true; bypasses send-window check for one controlled send.
 * Returns: { data: { customerId, limit, lockedBy, scanned, locked, processed, requeued, sent, errors } }
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
  const ignoreWindow = body.ignoreWindow === true
  if (!dryRun) {
    const gate = liveTickAllowed(customerId)
    if (!gate.allowed) {
      res.status(400).json({ error: gate.reason ?? 'Live tick not allowed' })
      return
    }
    if (ignoreWindow && process.env.ODCRM_ALLOW_LIVE_TICK_IGNORE_WINDOW !== 'true') {
      res.status(400).json({ error: 'ODCRM_ALLOW_LIVE_TICK_IGNORE_WINDOW must be true to use ignoreWindow' })
      return
    }
  }

  const now = new Date()
  const lockedBy = `${TICK_LOCK_PREFIX}${randomUUID()}`

  let scanned = 0
  let locked = 0
  let processed = 0
  let requeued = 0
  let sent = 0
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
          sent: 0,
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
    processed = lockedItems.length

    if (dryRun) {
      for (const item of lockedItems) {
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
    } else {
      // Stage 1F: live send — step 0 only, cap LIVE_SEND_CAP
      const step0 = lockedItems.filter((i) => i.stepIndex === 0)
      const toSend = step0.slice(0, LIVE_SEND_CAP)
      const toRequeue = [
        ...lockedItems.filter((i) => i.stepIndex !== 0),
        ...step0.slice(LIVE_SEND_CAP),
      ]
      for (const item of toRequeue) {
        try {
          await requeueDryRun(
            prisma,
            item.id,
            item.stepIndex !== 0 ? 'Step 0 only (Stage 1F)' : DRY_RUN_DEFAULT_REASON
          )
          requeued += 1
        } catch (err) {
          errors += 1
          await requeueAfterSendFailure(prisma, item.id, (err as Error)?.message ?? 'unknown error')
          requeued += 1
        }
      }
      const processOptions = ignoreWindow ? { ignoreWindow: true as const } : undefined
      for (const item of toSend) {
        try {
          if (processOptions?.ignoreWindow) {
            console.log(`[sendQueueTick] live send window bypass used customerId=${item.customerId} enrollmentId=${item.enrollmentId} item=${item.id}`)
          }
          await processOne(prisma, item, now, processOptions)
          sent += 1
        } catch (err) {
          errors += 1
          await requeueAfterSendFailure(prisma, item.id, (err as Error)?.message?.slice(0, 500) ?? 'unknown error')
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
        sent,
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
