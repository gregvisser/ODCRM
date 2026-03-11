import express from 'express'
import { z } from 'zod'
import { randomUUID } from 'crypto'
import { prisma } from '../lib/prisma.js'
import { requireMarketingMutationAuth } from '../middleware/marketingMutationAuth.js'
import { parseSheetUrl, readSheet, validateCredentials } from '../services/googleSheetsService.js'

const router = express.Router()

const getCustomerId = (req: express.Request): string => {
  const customerId = (req.headers['x-customer-id'] as string) || (req.query.customerId as string)
  if (!customerId) {
    const err = new Error('Customer ID required') as Error & { status?: number }
    err.status = 400
    throw err
  }
  return customerId
}

const createSchema = z.object({
  type: z.enum(['domain', 'email']),
  value: z.string().min(1),
  reason: z.string().optional(),
  source: z.string().optional(),
})

const csvImportSchema = z.object({
  entries: z.array(
    z.object({
      email: z.string().optional(),
      domain: z.string().optional(),
      reason: z.string().optional(),
    })
  ),
  sourceFileName: z.string().optional(),
})

const sheetImportSchema = z.object({
  sheetUrl: z.string().url(),
  gid: z.string().optional(),
  reason: z.string().optional(),
  sourceLabel: z.string().optional(),
  mode: z.enum(['append', 'replace']).optional(),
})

const isValidDomain = (value: string) => {
  const trimmed = value.trim().toLowerCase()
  if (!trimmed || trimmed.includes('@')) return false
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return false
  return /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(trimmed)
}

type ParsedSuppressionRows = {
  values: string[]
  invalid: string[]
  totalRows: number
  headers: string[]
  sheetTitle: string
}

async function updateSuppressionSheetHealthMeta(
  customerId: string,
  type: 'email' | 'domain',
  patch: {
    sheetUrl?: string | null
    gid?: string | null
    sourceLabel?: string | null
    lastImportStatus: 'success' | 'error'
    lastImportedAt?: string | null
    mode?: 'append' | 'replace' | null
    totalRows?: number | null
    inserted?: number | null
    duplicates?: number | null
    replacedCount?: number | null
    invalidCount?: number | null
    error?: string | null
  }
) {
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: { id: true, accountData: true },
  })
  if (!customer) return

  const accountData =
    customer.accountData && typeof customer.accountData === 'object'
      ? (customer.accountData as Record<string, unknown>)
      : {}
  const existingSources =
    accountData.dncSheetSources && typeof accountData.dncSheetSources === 'object'
      ? (accountData.dncSheetSources as Record<string, unknown>)
      : {}
  const existingTypeMeta =
    existingSources[type] && typeof existingSources[type] === 'object'
      ? (existingSources[type] as Record<string, unknown>)
      : {}

  const nextTypeMeta = {
    ...existingTypeMeta,
    sheetUrl: patch.sheetUrl ?? existingTypeMeta.sheetUrl ?? null,
    gid: patch.gid ?? existingTypeMeta.gid ?? null,
    sourceLabel: patch.sourceLabel ?? existingTypeMeta.sourceLabel ?? null,
    lastImportStatus: patch.lastImportStatus,
    lastImportedAt: patch.lastImportedAt ?? new Date().toISOString(),
    mode: patch.mode ?? existingTypeMeta.mode ?? null,
    totalRows: patch.totalRows ?? existingTypeMeta.totalRows ?? null,
    inserted: patch.inserted ?? existingTypeMeta.inserted ?? null,
    duplicates: patch.duplicates ?? existingTypeMeta.duplicates ?? null,
    replacedCount: patch.replacedCount ?? existingTypeMeta.replacedCount ?? null,
    invalidCount: patch.invalidCount ?? existingTypeMeta.invalidCount ?? null,
    lastError: patch.error ?? null,
  }

  await prisma.customer.update({
    where: { id: customerId },
    data: {
      accountData: {
        ...accountData,
        dncSheetSources: {
          ...existingSources,
          [type]: nextTypeMeta,
        },
      } as any,
    },
  })
}

async function readPublicSheetCsv(sheetId: string, gid: string | null): Promise<{ headers: string[]; rows: Record<string, string>[]; sheetTitle: string }> {
  const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv${gid ? `&gid=${encodeURIComponent(gid)}` : ''}`
  const response = await fetch(csvUrl)
  if (!response.ok) {
    throw new Error(`public_sheet_fetch_failed:${response.status}`)
  }
  const csv = await response.text()
  const lines = csv.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  if (lines.length === 0) {
    return { headers: [], rows: [], sheetTitle: 'Sheet' }
  }
  const rawHeaders = lines[0].split(',').map((h) => h.replace(/^"|"$/g, '').trim())
  const headers = rawHeaders.map(normalizeHeaderName)
  const rows = lines.slice(1).map((line) => {
    const cols = line.split(',').map((v) => v.replace(/^"|"$/g, '').trim())
    const row: Record<string, string> = {}
    headers.forEach((h, i) => {
      row[h] = cols[i] || ''
    })
    return row
  })
  return { headers, rows, sheetTitle: 'Sheet' }
}

function normalizeHeaderName(header: string): string {
  return header
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
}

function parseSheetRowsForType(
  rows: Record<string, string>[],
  headers: string[],
  expectedType: 'email' | 'domain'
): ParsedSuppressionRows {
  const normalizedHeaders = headers.map(normalizeHeaderName)
  const valueCandidates =
    expectedType === 'email'
      ? ['email', 'email_address', 'work_email', 'contact_email', 'value']
      : ['domain', 'website', 'company_domain', 'value']
  const valueHeader = normalizedHeaders.find((h) => valueCandidates.includes(h))
  const output = new Set<string>()
  const invalid: string[] = []

  for (const row of rows) {
    const raw =
      (valueHeader ? row[valueHeader] : null) ??
      (headers.length > 0 ? row[headers[0]] : null) ??
      ''
    const candidate = String(raw || '').trim().toLowerCase()
    if (!candidate) continue
    if (expectedType === 'email') {
      if (!z.string().email().safeParse(candidate).success) {
        invalid.push(candidate)
        continue
      }
    } else if (!isValidDomain(candidate)) {
      invalid.push(candidate)
      continue
    }
    output.add(candidate)
  }

  return {
    values: Array.from(output),
    invalid,
    totalRows: rows.length,
    headers,
    sheetTitle: '',
  }
}

// POST /api/suppression/check - Check how many emails from a list are suppressed
router.post('/check', async (req, res, next) => {
  try {
    const customerId = getCustomerId(req)
    const { emails } = z.object({
      emails: z.array(z.string().email())
    }).parse(req.body)

    if (emails.length === 0) {
      return res.json({ suppressedCount: 0, suppressedEmails: [] })
    }

    // Normalize emails
    const normalizedEmails = emails.map(e => e.trim().toLowerCase())
    const domains = normalizedEmails.map(e => e.split('@')[1]).filter(Boolean)

    // Find all suppression entries that match
    const suppressionEntries = await prisma.suppressionEntry.findMany({
      where: {
        customerId,
        OR: [
          { type: 'email', value: { in: normalizedEmails } },
          { type: 'domain', value: { in: domains } },
        ],
      },
      select: {
        type: true,
        value: true,
      },
    })

    // Build lookup sets
    const suppressedEmailsSet = new Set(
      suppressionEntries.filter(e => e.type === 'email').map(e => e.value)
    )
    const suppressedDomainsSet = new Set(
      suppressionEntries.filter(e => e.type === 'domain').map(e => e.value)
    )

    // Find which emails are suppressed
    const suppressedEmails = normalizedEmails.filter(email => {
      const domain = email.split('@')[1]
      return suppressedEmailsSet.has(email) || suppressedDomainsSet.has(domain)
    })

    res.json({
      suppressedCount: suppressedEmails.length,
      suppressedEmails: suppressedEmails.slice(0, 100), // Limit to first 100 for response size
      totalChecked: emails.length,
    })
  } catch (error) {
    next(error)
  }
})

router.get('/', async (req, res, next) => {
  try {
    const customerId = getCustomerId(req)
    const type = req.query.type as string | undefined
    const q = (req.query.q as string | undefined)?.trim().toLowerCase()

    const where: any = { customerId }
    if (type === 'domain' || type === 'email') {
      where.type = type
    }
    if (q) {
      where.value = { contains: q, mode: 'insensitive' }
    }

    const entries = await prisma.suppressionEntry.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    })

    res.json(entries)
  } catch (error) {
    next(error)
  }
})

router.post('/', requireMarketingMutationAuth, async (req, res, next) => {
  try {
    const customerId = getCustomerId(req)
    const data = createSchema.parse(req.body)
    const value = data.value.trim().toLowerCase()
    const emailNormalized = data.type === 'email' ? value : null

    if (data.type === 'domain' && !isValidDomain(value)) {
      return res.status(400).json({ error: 'Invalid domain format' })
    }
    if (data.type === 'email' && !z.string().email().safeParse(value).success) {
      return res.status(400).json({ error: 'Invalid email format' })
    }

    const entry = await prisma.suppressionEntry.upsert({
      where: {
        customerId_type_value: {
          customerId,
          type: data.type,
          value,
        },
      },
      update: {
        reason: data.reason || null,
        source: data.source || null,
        emailNormalized,
      },
      create: {
        id: randomUUID(),
        customerId,
        type: data.type,
        value,
        emailNormalized,
        reason: data.reason || null,
        source: data.source || 'manual',
      },
    })

    res.status(201).json(entry)
  } catch (error) {
    next(error)
  }
})

router.delete('/:id', requireMarketingMutationAuth, async (req, res, next) => {
  try {
    const customerId = getCustomerId(req)
    const { id } = req.params

    const existing = await prisma.suppressionEntry.findFirst({
      where: { id, customerId },
      select: { id: true },
    })
    if (!existing) {
      return res.status(404).json({ error: 'Suppression entry not found' })
    }

    await prisma.suppressionEntry.delete({ where: { id } })
    res.json({ success: true })
  } catch (error) {
    next(error)
  }
})

// ============================================================================
// /emails sub-routes (type-filtered convenience endpoints)
// ============================================================================

router.get('/emails', async (req, res, next) => {
  try {
    const customerId = getCustomerId(req)
    const entries = await prisma.suppressionEntry.findMany({
      where: { customerId, type: 'email' },
      orderBy: { createdAt: 'desc' },
    })
    res.json(entries)
  } catch (error) {
    next(error)
  }
})

router.post('/emails', requireMarketingMutationAuth, async (req, res, next) => {
  try {
    const customerId = getCustomerId(req)
    const { value, reason, source } = req.body as { value: string; reason?: string; source?: string }
    const normalized = (value || '').trim().toLowerCase()
    if (!z.string().email().safeParse(normalized).success) {
      return res.status(400).json({ error: 'Invalid email format' })
    }
    const entry = await prisma.suppressionEntry.upsert({
      where: { customerId_type_value: { customerId, type: 'email', value: normalized } },
      update: { reason: reason || null, source: source || null, emailNormalized: normalized },
      create: {
        id: randomUUID(), customerId, type: 'email', value: normalized,
        emailNormalized: normalized, reason: reason || null, source: source || 'manual',
      },
    })
    res.status(201).json(entry)
  } catch (error) {
    next(error)
  }
})

// POST /emails/upload — CSV file upload for suppressed emails
// Accepts JSON body: { rows: string[], sourceFileName?: string }
// rows = array of raw lines from CSV (client parses file, sends lines)
router.post('/emails/upload', requireMarketingMutationAuth, async (req, res, next) => {
  try {
    const customerId = getCustomerId(req)
    const { rows, sourceFileName } = req.body as { rows: string[]; sourceFileName?: string }
    if (!Array.isArray(rows)) return res.status(400).json({ error: 'rows must be an array of strings' })

    let inserted = 0, duplicates = 0
    const invalid: string[] = []

    for (const rawLine of rows) {
      const line = (rawLine || '').trim()
      if (!line || line.startsWith('#')) continue
      // Strip header row if present
      if (line.toLowerCase() === 'email' || line.toLowerCase() === 'email address') continue

      // Pick first comma-separated field
      const candidate = line.split(',')[0].trim().toLowerCase()
      if (!candidate) continue

      if (!z.string().email().safeParse(candidate).success) {
        invalid.push(candidate)
        continue
      }

      const result = await prisma.suppressionEntry.upsert({
        where: { customerId_type_value: { customerId, type: 'email', value: candidate } },
        update: { source: 'import', sourceFileName: sourceFileName || null, emailNormalized: candidate },
        create: {
          id: randomUUID(), customerId, type: 'email', value: candidate,
          emailNormalized: candidate, source: 'import', sourceFileName: sourceFileName || null,
        },
      })
      if (result.createdAt.getTime() === result.updatedAt.getTime()) inserted++
      else duplicates++
    }

    res.json({ success: true, inserted, duplicates, invalid: invalid.slice(0, 20), totalProcessed: rows.length })
  } catch (error) {
    next(error)
  }
})

// DELETE /emails — batch delete by ids array
router.delete('/emails', requireMarketingMutationAuth, async (req, res, next) => {
  try {
    const customerId = getCustomerId(req)
    const ids = (req.body?.ids as string[]) || []
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'ids must be a non-empty array' })
    }
    const result = await prisma.suppressionEntry.deleteMany({
      where: { id: { in: ids }, customerId, type: 'email' },
    })
    res.json({ success: true, deleted: result.count })
  } catch (error) {
    next(error)
  }
})

// ============================================================================
// /domains sub-routes
// ============================================================================

router.get('/domains', async (req, res, next) => {
  try {
    const customerId = getCustomerId(req)
    const entries = await prisma.suppressionEntry.findMany({
      where: { customerId, type: 'domain' },
      orderBy: { createdAt: 'desc' },
    })
    res.json(entries)
  } catch (error) {
    next(error)
  }
})

router.post('/domains', requireMarketingMutationAuth, async (req, res, next) => {
  try {
    const customerId = getCustomerId(req)
    const { value, reason, source } = req.body as { value: string; reason?: string; source?: string }
    const normalized = (value || '').trim().toLowerCase()
    if (!isValidDomain(normalized)) {
      return res.status(400).json({ error: 'Invalid domain format' })
    }
    const entry = await prisma.suppressionEntry.upsert({
      where: { customerId_type_value: { customerId, type: 'domain', value: normalized } },
      update: { reason: reason || null, source: source || null },
      create: {
        id: randomUUID(), customerId, type: 'domain', value: normalized,
        reason: reason || null, source: source || 'manual',
      },
    })
    res.status(201).json(entry)
  } catch (error) {
    next(error)
  }
})

// POST /domains/upload — CSV upload for suppressed domains
router.post('/domains/upload', requireMarketingMutationAuth, async (req, res, next) => {
  try {
    const customerId = getCustomerId(req)
    const { rows, sourceFileName } = req.body as { rows: string[]; sourceFileName?: string }
    if (!Array.isArray(rows)) return res.status(400).json({ error: 'rows must be an array of strings' })

    let inserted = 0, duplicates = 0
    const invalid: string[] = []

    for (const rawLine of rows) {
      const line = (rawLine || '').trim()
      if (!line || line.startsWith('#')) continue
      if (line.toLowerCase() === 'domain') continue

      const candidate = line.split(',')[0].trim().toLowerCase()
      if (!candidate) continue

      if (!isValidDomain(candidate)) {
        invalid.push(candidate)
        continue
      }

      const result = await prisma.suppressionEntry.upsert({
        where: { customerId_type_value: { customerId, type: 'domain', value: candidate } },
        update: { source: 'import', sourceFileName: sourceFileName || null },
        create: {
          id: randomUUID(), customerId, type: 'domain', value: candidate,
          source: 'import', sourceFileName: sourceFileName || null,
        },
      })
      if (result.createdAt.getTime() === result.updatedAt.getTime()) inserted++
      else duplicates++
    }

    res.json({ success: true, inserted, duplicates, invalid: invalid.slice(0, 20), totalProcessed: rows.length })
  } catch (error) {
    next(error)
  }
})

async function importSuppressionFromSheet(
  customerId: string,
  expectedType: 'email' | 'domain',
  input: z.infer<typeof sheetImportSchema>
) {
  const parsed = parseSheetUrl(input.sheetUrl)
  const gid = input.gid?.trim() || parsed.gid || null
  const credCheck = validateCredentials()
  let sheetData: { headers: string[]; rows: Record<string, string>[]; sheetTitle: string }
  try {
    if (credCheck.valid) {
      sheetData = await readSheet(parsed.sheetId, gid)
    } else {
      sheetData = await readPublicSheetCsv(parsed.sheetId, gid)
    }
  } catch {
    // Fallback for publicly shared sheets when service-account read fails.
    sheetData = await readPublicSheetCsv(parsed.sheetId, gid)
  }
  const parsedRows = parseSheetRowsForType(sheetData.rows, sheetData.headers, expectedType)
  parsedRows.sheetTitle = sheetData.sheetTitle
  const source = input.sourceLabel?.trim() || `google-sheet:${expectedType}`
  const reason = input.reason?.trim() || null
  const mode = input.mode || 'replace'
  let replacedCount = 0

  if (mode === 'replace') {
    const deleted = await prisma.suppressionEntry.deleteMany({
      where: { customerId, type: expectedType },
    })
    replacedCount = deleted.count
  }

  let inserted = 0
  let duplicates = 0
  for (const value of parsedRows.values) {
    const upserted = await prisma.suppressionEntry.upsert({
      where: { customerId_type_value: { customerId, type: expectedType, value } },
      update: {
        reason,
        source,
        sourceFileName: input.sheetUrl,
        ...(expectedType === 'email' ? { emailNormalized: value } : {}),
      },
      create: {
        id: randomUUID(),
        customerId,
        type: expectedType,
        value,
        ...(expectedType === 'email' ? { emailNormalized: value } : {}),
        reason,
        source,
        sourceFileName: input.sheetUrl,
      },
    })
    if (upserted.createdAt.getTime() === upserted.updatedAt.getTime()) inserted += 1
    else duplicates += 1
  }

  await updateSuppressionSheetHealthMeta(customerId, expectedType, {
    sheetUrl: input.sheetUrl,
    gid,
    sourceLabel: source,
    lastImportStatus: 'success',
    lastImportedAt: new Date().toISOString(),
    mode,
    totalRows: parsedRows.totalRows,
    inserted,
    duplicates,
    replacedCount,
    invalidCount: parsedRows.invalid.length,
    error: null,
  })

  return {
    success: true,
    type: expectedType,
    mode,
    sheetTitle: sheetData.sheetTitle,
    sheetUrl: input.sheetUrl,
    gid,
    totalRows: parsedRows.totalRows,
    inserted,
    duplicates,
    replacedCount,
    invalid: parsedRows.invalid.slice(0, 100),
    headers: parsedRows.headers,
  }
}

// POST /emails/import-sheet — import suppressed emails from Google Sheet URL
router.post('/emails/import-sheet', requireMarketingMutationAuth, async (req, res, next) => {
  try {
    const customerId = getCustomerId(req)
    const input = sheetImportSchema.parse(req.body)
    const result = await importSuppressionFromSheet(customerId, 'email', input)
    res.json(result)
  } catch (error) {
    try {
      const customerId = getCustomerId(req)
      const raw = req.body && typeof req.body.sheetUrl === 'string' ? req.body.sheetUrl : null
      await updateSuppressionSheetHealthMeta(customerId, 'email', {
        sheetUrl: raw,
        lastImportStatus: 'error',
        lastImportedAt: new Date().toISOString(),
        error: error instanceof Error ? error.message.slice(0, 300) : 'import_failed',
      })
    } catch {
      // ignore metadata write failures in error path
    }
    next(error)
  }
})

// POST /domains/import-sheet — import suppressed domains from Google Sheet URL
router.post('/domains/import-sheet', requireMarketingMutationAuth, async (req, res, next) => {
  try {
    const customerId = getCustomerId(req)
    const input = sheetImportSchema.parse(req.body)
    const result = await importSuppressionFromSheet(customerId, 'domain', input)
    res.json(result)
  } catch (error) {
    try {
      const customerId = getCustomerId(req)
      const raw = req.body && typeof req.body.sheetUrl === 'string' ? req.body.sheetUrl : null
      await updateSuppressionSheetHealthMeta(customerId, 'domain', {
        sheetUrl: raw,
        lastImportStatus: 'error',
        lastImportedAt: new Date().toISOString(),
        error: error instanceof Error ? error.message.slice(0, 300) : 'import_failed',
      })
    } catch {
      // ignore metadata write failures in error path
    }
    next(error)
  }
})

// GET /api/suppression/health - read-only suppression data health summary for Google Sheets-linked imports
router.get('/health', async (req, res, next) => {
  try {
    const customerId = getCustomerId(req)
    const [emailCounts, domainCounts, latestEmailImport, latestDomainImport, customer] = await Promise.all([
      prisma.suppressionEntry.count({ where: { customerId, type: 'email' } }),
      prisma.suppressionEntry.count({ where: { customerId, type: 'domain' } }),
      prisma.suppressionEntry.findFirst({
        where: { customerId, type: 'email', source: { startsWith: 'google-sheet:' } },
        orderBy: { updatedAt: 'desc' },
        select: { updatedAt: true, source: true },
      }),
      prisma.suppressionEntry.findFirst({
        where: { customerId, type: 'domain', source: { startsWith: 'google-sheet:' } },
        orderBy: { updatedAt: 'desc' },
        select: { updatedAt: true, source: true },
      }),
      prisma.customer.findUnique({ where: { id: customerId }, select: { id: true, accountData: true } }),
    ])

    if (!customer) return res.status(404).json({ error: 'Customer not found' })

    const accountData =
      customer.accountData && typeof customer.accountData === 'object'
        ? (customer.accountData as Record<string, unknown>)
        : {}
    const dncSheetSources =
      accountData.dncSheetSources && typeof accountData.dncSheetSources === 'object'
        ? (accountData.dncSheetSources as Record<string, unknown>)
        : {}
    const emailMeta = dncSheetSources.email && typeof dncSheetSources.email === 'object' ? (dncSheetSources.email as Record<string, unknown>) : {}
    const domainMeta = dncSheetSources.domain && typeof dncSheetSources.domain === 'object' ? (dncSheetSources.domain as Record<string, unknown>) : {}

    res.json({
      success: true,
      data: {
        customerId,
        suppressionSheets: {
          email: {
            configured: typeof emailMeta.sheetUrl === 'string' && emailMeta.sheetUrl.trim().length > 0,
            sheetUrl: typeof emailMeta.sheetUrl === 'string' ? emailMeta.sheetUrl : null,
            gid: typeof emailMeta.gid === 'string' ? emailMeta.gid : null,
            lastImportStatus: typeof emailMeta.lastImportStatus === 'string' ? emailMeta.lastImportStatus : null,
            lastImportedAt:
              typeof emailMeta.lastImportedAt === 'string'
                ? emailMeta.lastImportedAt
                : (latestEmailImport?.updatedAt?.toISOString() ?? null),
            lastSourceLabel: typeof emailMeta.sourceLabel === 'string' ? emailMeta.sourceLabel : (latestEmailImport?.source ?? null),
            lastError: typeof emailMeta.lastError === 'string' ? emailMeta.lastError : null,
            totalEntries: emailCounts,
          },
          domain: {
            configured: typeof domainMeta.sheetUrl === 'string' && domainMeta.sheetUrl.trim().length > 0,
            sheetUrl: typeof domainMeta.sheetUrl === 'string' ? domainMeta.sheetUrl : null,
            gid: typeof domainMeta.gid === 'string' ? domainMeta.gid : null,
            lastImportStatus: typeof domainMeta.lastImportStatus === 'string' ? domainMeta.lastImportStatus : null,
            lastImportedAt:
              typeof domainMeta.lastImportedAt === 'string'
                ? domainMeta.lastImportedAt
                : (latestDomainImport?.updatedAt?.toISOString() ?? null),
            lastSourceLabel: typeof domainMeta.sourceLabel === 'string' ? domainMeta.sourceLabel : (latestDomainImport?.source ?? null),
            lastError: typeof domainMeta.lastError === 'string' ? domainMeta.lastError : null,
            totalEntries: domainCounts,
          },
        },
      },
    })
  } catch (error) {
    next(error)
  }
})

// DELETE /domains — batch delete by ids array
router.delete('/domains', requireMarketingMutationAuth, async (req, res, next) => {
  try {
    const customerId = getCustomerId(req)
    const ids = (req.body?.ids as string[]) || []
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'ids must be a non-empty array' })
    }
    const result = await prisma.suppressionEntry.deleteMany({
      where: { id: { in: ids }, customerId, type: 'domain' },
    })
    res.json({ success: true, deleted: result.count })
  } catch (error) {
    next(error)
  }
})

// ============================================================================
// Legacy CSV Import endpoint (kept for backwards compatibility)
// ============================================================================
// CSV Import endpoint
router.post('/import-csv', requireMarketingMutationAuth, async (req, res, next) => {
  try {
    const customerId = getCustomerId(req)
    const data = csvImportSchema.parse(req.body)
    const { entries, sourceFileName } = data

    let imported = 0
    let duplicates = 0
    let errors: string[] = []

    // Process entries in batches to avoid transaction timeout
    const batchSize = 100
    for (let i = 0; i < entries.length; i += batchSize) {
      const batch = entries.slice(i, i + batchSize)

      for (const entry of batch) {
        try {
          if (entry.email) {
            // Email entry
            const normalizedEmail = entry.email.trim().toLowerCase()
            if (!z.string().email().safeParse(normalizedEmail).success) {
              errors.push(`Invalid email: ${entry.email}`)
              continue
            }

            const result = await prisma.suppressionEntry.upsert({
              where: {
                customerId_type_value: {
                  customerId,
                  type: 'email',
                  value: normalizedEmail,
                },
              },
              update: {
                reason: entry.reason || null,
                source: 'import',
                sourceFileName: sourceFileName || null,
              },
              create: {
                id: randomUUID(),
                customerId,
                type: 'email',
                value: normalizedEmail,
                emailNormalized: normalizedEmail,
                reason: entry.reason || null,
                source: 'import',
                sourceFileName: sourceFileName || null,
              },
            })

            if (result.createdAt.toISOString() === result.updatedAt.toISOString()) {
              imported++
            } else {
              duplicates++
            }
          } else if (entry.domain) {
            // Domain entry
            const normalizedDomain = entry.domain.trim().toLowerCase()
            if (!isValidDomain(normalizedDomain)) {
              errors.push(`Invalid domain: ${entry.domain}`)
              continue
            }

            const result = await prisma.suppressionEntry.upsert({
              where: {
                customerId_type_value: {
                  customerId,
                  type: 'domain',
                  value: normalizedDomain,
                },
              },
              update: {
                reason: entry.reason || null,
                source: 'import',
                sourceFileName: sourceFileName || null,
              },
              create: {
                id: randomUUID(),
                customerId,
                type: 'domain',
                value: normalizedDomain,
                reason: entry.reason || null,
                source: 'import',
                sourceFileName: sourceFileName || null,
              },
            })

            if (result.createdAt.toISOString() === result.updatedAt.toISOString()) {
              imported++
            } else {
              duplicates++
            }
          } else {
            errors.push(`Entry missing both email and domain: ${JSON.stringify(entry)}`)
          }
        } catch (entryError) {
          errors.push(`Failed to process entry: ${JSON.stringify(entry)} - ${entryError}`)
        }
      }
    }

    res.json({
      success: true,
      imported,
      duplicates,
      errors,
      totalProcessed: entries.length,
    })
  } catch (error) {
    next(error)
  }
})

export default router
