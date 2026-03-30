/**
 * Settings → Troubleshooting / Feedback API
 *
 * - List: admin (greg@bidlow.co.uk) sees all; others see own by createdByEmail
 * - Create: authenticated only; identity from auth context
 * - Update: admin only (status, internalNotes, resolutionNotes)
 * - Upload proof: authenticated only; image types, size-limited
 */

import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { getVerifiedActorIdentity } from '../utils/actorIdentity.js'
import {
  uploadTroubleshootingProof,
  generateTroubleshootingProofBlobName,
  getTroubleshootingProofContainerName,
} from '../utils/blobUpload.js'
import { generateBlobSasUrl } from '../utils/blobSas.js'

const router = Router()

const ADMIN_EMAIL = 'greg@bidlow.co.uk'

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase()
}

function isAdmin(email: string | null): boolean {
  return email ? normalizeEmail(email) === normalizeEmail(ADMIN_EMAIL) : false
}

/** Require authenticated user (any). */
async function requireAuth(req: Request, res: Response, next: () => void) {
  const actor = await getVerifiedActorIdentity(req)
  if (!actor.email) {
    res.status(401).json({ error: 'Unauthenticated', message: 'Sign in to submit or view reports.' })
    return
  }
  ;(req as any).actor = actor
  next()
}

/** Require admin (greg@bidlow.co.uk). */
function requireAdmin(req: Request, res: Response, next: () => void) {
  const actor = (req as any).actor
  if (!actor || !isAdmin(actor.email)) {
    res.status(403).json({ error: 'Forbidden', message: 'Admin access required.' })
    return
  }
  next()
}

const REPORT_TYPES = ['Bug', 'Issue', 'Suggestion', 'Ease of Use', 'Feature Request', 'Other'] as const
const PRIORITIES = ['Low', 'Medium', 'High', 'Critical'] as const
const STATUSES = ['Open', 'In Review', 'Planned', 'Resolved', 'Closed'] as const

const createReportSchema = z.object({
  type: z.enum(REPORT_TYPES),
  title: z.string().min(1).max(500),
  description: z.string().min(1).max(10000),
  priority: z.enum(PRIORITIES),
  appArea: z.string().max(200).optional().nullable(),
  pagePath: z.string().max(1000).optional().nullable(),
  userAgent: z.string().max(500).optional().nullable(),
  proofUrl: z.string().max(2000).optional().nullable(),
  proofFileName: z.string().max(255).optional().nullable(),
  proofMimeType: z.string().max(100).optional().nullable(),
  proofBlobName: z.string().max(500).optional().nullable(),
  proofContainerName: z.string().max(200).optional().nullable(),
})

const updateReportSchema = z.object({
  status: z.enum(STATUSES).optional(),
  internalNotes: z.string().max(5000).optional().nullable(),
  resolutionNotes: z.string().max(5000).optional().nullable(),
  priority: z.enum(PRIORITIES).optional(),
})

const ALLOWED_PROOF_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const
const MAX_PROOF_SIZE_BYTES = 5 * 1024 * 1024 // 5MB

function toReportDto(r: {
  id: string
  customerId: string | null
  createdByUserId: string | null
  createdByEmail: string
  createdByName: string | null
  type: string
  title: string
  description: string
  priority: string
  appArea: string | null
  pagePath: string | null
  userAgent: string | null
  proofUrl: string | null
  proofFileName: string | null
  proofMimeType: string | null
  proofUploadedAt: Date | null
  proofBlobName: string | null
  proofContainerName: string | null
  status: string
  internalNotes: string | null
  resolutionNotes: string | null
  archivedAt: Date | null
  createdAt: Date
  updatedAt: Date
  resolvedAt: Date | null
}) {
  return {
    id: r.id,
    customerId: r.customerId,
    createdByUserId: r.createdByUserId,
    createdByEmail: r.createdByEmail,
    createdByName: r.createdByName,
    type: r.type,
    title: r.title,
    description: r.description,
    priority: r.priority,
    appArea: r.appArea,
    pagePath: r.pagePath,
    userAgent: r.userAgent,
    proofUrl: r.proofUrl,
    proofFileName: r.proofFileName,
    proofMimeType: r.proofMimeType,
    proofUploadedAt: r.proofUploadedAt?.toISOString() ?? null,
    hasProof: !!(r.proofBlobName && r.proofContainerName),
    status: r.status,
    internalNotes: r.internalNotes,
    resolutionNotes: r.resolutionNotes,
    archivedAt: r.archivedAt?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    resolvedAt: r.resolvedAt?.toISOString() ?? null,
  }
}

// GET /api/settings/troubleshooting — list (admin: all, user: own)
router.get('/troubleshooting', requireAuth, async (req: Request, res: Response) => {
  try {
    const actor = (req as any).actor
    const email = actor.email!
    const admin = isAdmin(email)

    const { status, priority, type, mine, search, includeArchived, archivedOnly } = req.query
    const where: any = {}
    if (!admin) {
      where.createdByEmail = { equals: email, mode: 'insensitive' }
    } else if (mine === 'true' || mine === '1') {
      where.createdByEmail = { equals: email, mode: 'insensitive' }
    }
    if (status && typeof status === 'string') where.status = status
    if (priority && typeof priority === 'string') where.priority = priority
    if (type && typeof type === 'string') where.type = type
    const wantsIncludeArchived = includeArchived === '1' || includeArchived === 'true'
    const wantsArchivedOnly = archivedOnly === '1' || archivedOnly === 'true'
    if (wantsArchivedOnly) {
      where.archivedAt = { not: null }
    } else if (!wantsIncludeArchived) {
      where.archivedAt = null
    }
    if (search && typeof search === 'string' && search.trim()) {
      where.OR = [
        { title: { contains: search.trim(), mode: 'insensitive' } },
        { description: { contains: search.trim(), mode: 'insensitive' } },
        { appArea: { contains: search.trim(), mode: 'insensitive' } },
        { createdByEmail: { contains: search.trim(), mode: 'insensitive' } },
      ]
    }

    const reports = await prisma.troubleshootingReport.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    })

    let list = reports.map(toReportDto)
    if (!admin) list = list.map((r) => ({ ...r, internalNotes: null }))
    return res.json({ data: list })
  } catch (err) {
    console.error('[settings/troubleshooting] list error:', err)
    return res.status(500).json({ error: 'Failed to list reports' })
  }
})

// PATCH /api/settings/troubleshooting/:id/archive — admin only, Closed-only
router.patch('/troubleshooting/:id/archive', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const existing = await prisma.troubleshootingReport.findUnique({ where: { id } })
    if (!existing) {
      return res.status(404).json({ error: 'Report not found' })
    }
    if (existing.status !== 'Closed') {
      return res.status(400).json({ error: 'Invalid status', message: 'Only Closed reports can be archived.' })
    }
    const updated = await prisma.troubleshootingReport.update({
      where: { id },
      data: {
        archivedAt: existing.archivedAt ?? new Date(),
      },
    })
    return res.json({ data: toReportDto(updated) })
  } catch (err) {
    console.error('[settings/troubleshooting] archive error:', err)
    return res.status(500).json({ error: 'Failed to archive report' })
  }
})

// PATCH /api/settings/troubleshooting/:id/unarchive — admin only
router.patch('/troubleshooting/:id/unarchive', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const existing = await prisma.troubleshootingReport.findUnique({ where: { id } })
    if (!existing) {
      return res.status(404).json({ error: 'Report not found' })
    }
    const updated = await prisma.troubleshootingReport.update({
      where: { id },
      data: {
        archivedAt: null,
      },
    })
    return res.json({ data: toReportDto(updated) })
  } catch (err) {
    console.error('[settings/troubleshooting] unarchive error:', err)
    return res.status(500).json({ error: 'Failed to unarchive report' })
  }
})

// POST /api/settings/troubleshooting/upload — optional proof (image only)
router.post('/troubleshooting/upload', requireAuth, async (req: Request, res: Response) => {
  try {
    const { fileName, dataUrl } = req.body
    if (!fileName || !dataUrl) {
      return res.status(400).json({ error: 'Missing fileName or dataUrl' })
    }
    const mimeMatch = dataUrl.match(/^data:([^;]+);base64,/)
    if (!mimeMatch) {
      return res.status(400).json({ error: 'Invalid dataUrl format' })
    }
    const mimeType = mimeMatch[1]
    if (!ALLOWED_PROOF_MIME_TYPES.includes(mimeType as any)) {
      return res.status(400).json({
        error: 'Invalid file type',
        message: 'Only PNG, JPEG, and WebP images are allowed.',
        allowed: [...ALLOWED_PROOF_MIME_TYPES],
      })
    }
    const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/)
    if (!match) return res.status(400).json({ error: 'Invalid dataUrl format' })
    const buffer = Buffer.from(match[2], 'base64')
    if (buffer.length > MAX_PROOF_SIZE_BYTES) {
      return res.status(413).json({
        error: 'File too large',
        message: `Maximum size is ${MAX_PROOF_SIZE_BYTES / 1024 / 1024}MB`,
        maxBytes: MAX_PROOF_SIZE_BYTES,
      })
    }
    const containerName = getTroubleshootingProofContainerName()
    const blobName = generateTroubleshootingProofBlobName(`upload_${Date.now()}`, fileName)
    const result = await uploadTroubleshootingProof({ buffer, contentType: mimeType, blobName })
    const now = new Date()
    return res.status(201).json({
      proofUrl: result.url,
      proofFileName: fileName,
      proofMimeType: mimeType,
      proofBlobName: result.blobName,
      proofContainerName: containerName,
      proofUploadedAt: now.toISOString(),
    })
  } catch (err) {
    console.error('[settings/troubleshooting] upload error:', err)
    return res.status(500).json({ error: 'Failed to upload proof' })
  }
})

// POST /api/settings/troubleshooting — create report
router.post('/troubleshooting', requireAuth, async (req: Request, res: Response) => {
  try {
    const actor = (req as any).actor
    const parsed = createReportSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() })
    }
    const body = parsed.data
    const customerId = (req.headers['x-customer-id'] as string)?.trim() || null
    const user = await prisma.user.findFirst({
      where: { email: { equals: actor.email!, mode: 'insensitive' } },
      select: { id: true, userId: true, firstName: true, lastName: true },
    })
    const createdByName = user
      ? [user.firstName, user.lastName].filter(Boolean).join(' ').trim() || null
      : null

    const report = await prisma.troubleshootingReport.create({
      data: {
        customerId: customerId || null,
        createdByUserId: user?.userId ?? actor.userId ?? null,
        createdByEmail: actor.email!,
        createdByName,
        type: body.type,
        title: body.title,
        description: body.description,
        priority: body.priority,
        appArea: body.appArea ?? null,
        pagePath: body.pagePath ?? null,
        userAgent: body.userAgent ?? null,
        proofUrl: body.proofUrl ?? null,
        proofFileName: body.proofFileName ?? null,
        proofMimeType: body.proofMimeType ?? null,
        proofBlobName: body.proofBlobName ?? null,
        proofContainerName: body.proofContainerName ?? null,
        proofUploadedAt: body.proofBlobName ? new Date() : null,
        status: 'Open',
      },
    })
    return res.status(201).json({ data: toReportDto(report) })
  } catch (err) {
    console.error('[settings/troubleshooting] create error:', err)
    return res.status(500).json({ error: 'Failed to create report' })
  }
})

// PATCH /api/settings/troubleshooting/:id — admin only
router.patch('/troubleshooting/:id', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const parsed = updateReportSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() })
    }
    const body = parsed.data
    const existing = await prisma.troubleshootingReport.findUnique({ where: { id } })
    if (!existing) {
      return res.status(404).json({ error: 'Report not found' })
    }
    const updateData: any = {}
    if (body.status !== undefined) updateData.status = body.status
    if (body.internalNotes !== undefined) updateData.internalNotes = body.internalNotes
    if (body.resolutionNotes !== undefined) updateData.resolutionNotes = body.resolutionNotes
    if (body.priority !== undefined) updateData.priority = body.priority
    if (body.status === 'Resolved' || body.status === 'Closed') {
      updateData.resolvedAt = existing.resolvedAt ?? new Date()
    }
    const updated = await prisma.troubleshootingReport.update({
      where: { id },
      data: updateData,
    })
    return res.json({ data: toReportDto(updated) })
  } catch (err) {
    console.error('[settings/troubleshooting] update error:', err)
    return res.status(500).json({ error: 'Failed to update report' })
  }
})

// GET /api/settings/troubleshooting/:id — single report (own or admin)
router.get('/troubleshooting/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const actor = (req as any).actor
    const report = await prisma.troubleshootingReport.findUnique({ where: { id } })
    if (!report) return res.status(404).json({ error: 'Report not found' })
    const emailMatch =
      report.createdByEmail && actor.email
        ? normalizeEmail(report.createdByEmail) === normalizeEmail(actor.email)
        : false
    if (!emailMatch && !isAdmin(actor.email)) {
      return res.status(403).json({ error: 'Forbidden', message: 'You can only view your own reports.' })
    }
    const dto = toReportDto(report)
    if (!isAdmin(actor.email)) dto.internalNotes = null
    return res.json({ data: dto })
  } catch (err) {
    console.error('[settings/troubleshooting] get error:', err)
    return res.status(500).json({ error: 'Failed to load report' })
  }
})

// GET /api/settings/troubleshooting/:id/proof-download — SAS URL for proof (own or admin)
router.get('/troubleshooting/:id/proof-download', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const actor = (req as any).actor
    const report = await prisma.troubleshootingReport.findUnique({
      where: { id },
      select: {
        proofBlobName: true,
        proofContainerName: true,
        proofFileName: true,
        createdByEmail: true,
      },
    })
    if (!report || !report.proofBlobName || !report.proofContainerName) {
      return res.status(404).json({ error: 'Proof not found' })
    }
    const emailMatch =
      report.createdByEmail && actor.email
        ? normalizeEmail(report.createdByEmail) === normalizeEmail(actor.email)
        : false
    if (!emailMatch && !isAdmin(actor.email)) {
      return res.status(403).json({ error: 'Forbidden' })
    }
    const { url, expiresAt } = await generateBlobSasUrl({
      containerName: report.proofContainerName,
      blobName: report.proofBlobName,
      ttlMinutes: 15,
    })
    return res.json({
      url,
      expiresAt: expiresAt.toISOString(),
      fileName: report.proofFileName,
    })
  } catch (err) {
    console.error('[settings/troubleshooting] proof-download error:', err)
    return res.status(500).json({ error: 'Failed to generate proof URL' })
  }
})

export default router
