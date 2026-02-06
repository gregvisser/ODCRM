/**
 * Google Sheets Lead Sources API
 * 
 * Endpoints for managing Cognism, Apollo, and Blackbook sheet integrations.
 * Uses service account authentication (no user OAuth required).
 */

import { Router, Request, Response, NextFunction } from 'express'
import { randomUUID } from 'crypto'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { SheetSource, SheetSyncStatus } from '@prisma/client'
import {
  parseSheetUrl,
  readSheet,
  findFieldMappings,
  extractContactFromRow,
  validateCredentials,
  getCredentialDiagnostics,
  hasValue,
} from '../services/googleSheetsService.js'

const router = Router()

// Helper to get customerId from request
const getCustomerId = (req: Request): string => {
  const customerId = (req.headers['x-customer-id'] as string) || (req.query.customerId as string)
  if (!customerId) {
    const err = new Error('Customer ID required') as Error & { status?: number }
    err.status = 400
    throw err
  }
  return customerId
}

// Validate source parameter
const validSources = ['cognism', 'apollo', 'blackbook'] as const
type ValidSource = typeof validSources[number]

const isValidSource = (source: string): source is ValidSource => {
  return validSources.includes(source as ValidSource)
}

// Default sheet URLs for each source
const DEFAULT_SHEET_URLS: Record<ValidSource, string> = {
  cognism: 'https://docs.google.com/spreadsheets/d/1dh8aMhjLCuXSvrcUQhi6lPxlacmdHVVMoLDfEHMUeSU/edit?gid=0#gid=0',
  apollo: 'https://docs.google.com/spreadsheets/d/1-qQGHRY5vSx1z2oFemd72AiAw2T9etbLqjsYvCJBtNg/edit?gid=0#gid=0',
  blackbook: 'https://docs.google.com/spreadsheets/d/134ylfcnrhrDVzjr-ATdss6hWgYro5U5Ws7YEif2RyI8/edit?gid=0#gid=0',
}

const SOURCE_LABELS: Record<ValidSource, string> = {
  cognism: 'Cognism',
  apollo: 'Apollo',
  blackbook: 'Blackbook',
}

const normalizeEmail = (value: string | null): string | null => {
  if (!hasValue(value)) return null
  return value.trim().toLowerCase()
}

const isValidEmail = (value: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)

const getSnapshotListName = (source: ValidSource, sheetName: string, date: Date) => {
  const dateLabel = date.toISOString().slice(0, 10)
  return `${SOURCE_LABELS[source]} — ${sheetName} — ${dateLabel}`
}

/**
 * GET /api/sheets/sources
 * Returns all 3 sources and their config for the current customer
 */
router.get('/sources', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const customerId = getCustomerId(req)

    // Get existing configs
    const configs = await prisma.sheetSourceConfig.findMany({
      where: { customerId },
    })

    // Build response with all sources (even if not configured)
    const sources = validSources.map(source => {
      const config = configs.find(c => c.source === source)
      return {
        source,
        defaultSheetUrl: DEFAULT_SHEET_URLS[source],
        connected: !!config?.sheetId,
        sheetUrl: config?.sheetUrl || DEFAULT_SHEET_URLS[source],
        sheetId: config?.sheetId || null,
        gid: config?.gid || null,
        sheetName: config?.sheetName || null,
        lastSyncAt: config?.lastSyncAt?.toISOString() || null,
        lastSyncStatus: config?.lastSyncStatus || 'pending',
        lastError: config?.lastError || null,
        rowsImported: config?.rowsImported || 0,
        rowsUpdated: config?.rowsUpdated || 0,
        rowsSkipped: config?.rowsSkipped || 0,
      }
    })

    const diagnostics = getCredentialDiagnostics()
    res.json({
      sources,
      credentialsConfigured: diagnostics.credentialsConfigured,
      authMethodUsed: diagnostics.authMethodUsed,
      serviceAccountEmail: diagnostics.serviceAccountEmail,
      lastAuthError: diagnostics.lastAuthError,
    })
  } catch (err) {
    next(err)
  }
})

/**
 * POST /api/sheets/sources/:source/connect
 * Connect a sheet URL for a source
 */
const connectSchema = z.object({
  sheetUrl: z.string().url(),
})

router.post('/sources/:source/connect', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const customerId = getCustomerId(req)
    const { source } = req.params

    if (!isValidSource(source)) {
      return res.status(400).json({ error: `Invalid source. Must be one of: ${validSources.join(', ')}` })
    }

    const { sheetUrl } = connectSchema.parse(req.body)

    // Parse URL to extract spreadsheet ID and gid
    const { sheetId, gid } = parseSheetUrl(sheetUrl)

    // Upsert the config
    const config = await prisma.sheetSourceConfig.upsert({
      where: {
        customerId_source: { customerId, source: source as SheetSource },
      },
      create: {
        customerId,
        source: source as SheetSource,
        sheetUrl,
        sheetId,
        gid,
        lastSyncStatus: 'pending',
      },
      update: {
        sheetUrl,
        sheetId,
        gid,
        lastSyncStatus: 'pending',
        lastError: null,
      },
    })

    res.json({
      success: true,
      config: {
        source: config.source,
        sheetUrl: config.sheetUrl,
        sheetId: config.sheetId,
        gid: config.gid,
        lastSyncStatus: config.lastSyncStatus,
      },
    })
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: err.errors })
    }
    if (err.message?.includes('Invalid Google Sheets URL')) {
      return res.status(400).json({ error: err.message })
    }
    next(err)
  }
})

/**
 * POST /api/sheets/sources/:source/sync
 * Trigger a sync now for a source
 */
router.post('/sources/:source/sync', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const customerId = getCustomerId(req)
    const { source } = req.params

    if (!isValidSource(source)) {
      return res.status(400).json({ error: `Invalid source. Must be one of: ${validSources.join(', ')}` })
    }

    // Check credentials first
    const credCheck = validateCredentials()
    if (!credCheck.valid) {
      return res.status(500).json({
        error: 'Google Sheets credentials not configured',
        details: credCheck.error,
      })
    }

    // Get config
    let config = await prisma.sheetSourceConfig.findUnique({
      where: {
        customerId_source: { customerId, source: source as SheetSource },
      },
    })

    // If no config, create with default URL
    if (!config) {
      const defaultUrl = DEFAULT_SHEET_URLS[source]
      const { sheetId, gid } = parseSheetUrl(defaultUrl)
      config = await prisma.sheetSourceConfig.create({
        data: {
          customerId,
          source: source as SheetSource,
          sheetUrl: defaultUrl,
          sheetId,
          gid,
          lastSyncStatus: 'pending',
        },
      })
    }

    if (!config.sheetId) {
      return res.status(400).json({ error: 'Sheet not connected. Please connect a sheet URL first.' })
    }

    // Update status to syncing
    await prisma.sheetSourceConfig.update({
      where: { id: config.id },
      data: { lastSyncStatus: 'syncing' },
    })

    try {
      // Read sheet data
      const sheetData = await readSheet(config.sheetId, config.gid)

      // Find field mappings
      const mappings = findFieldMappings(sheetData.headers)

      if (!mappings.email) {
        throw new Error('Sheet must have an email column')
      }

      // Process rows
      let imported = 0
      let updated = 0
      let skipped = 0
      const errors: string[] = []
      const contactIdsInSheet = new Set<string>()

      const sourceKey = source as ValidSource
      const sheetName = sheetData.sheetTitle || config.sheetName || 'Sheet1'
      const snapshotName = getSnapshotListName(sourceKey, sheetName, new Date())

      let snapshotList = await prisma.contactList.findFirst({
        where: { customerId, name: snapshotName },
      })
      if (!snapshotList) {
        snapshotList = await prisma.contactList.create({
          data: {
            id: `list_${source}_${customerId}_${randomUUID()}`,
            customerId,
            name: snapshotName,
            description: `Snapshot from ${SOURCE_LABELS[sourceKey]} (${sheetName})`,
          },
        })
      }

      for (let i = 0; i < sheetData.rows.length; i++) {
        const row = sheetData.rows[i]
        const contact = extractContactFromRow(row, mappings)
        const normalizedEmail = normalizeEmail(contact.email)

        // Skip rows without email
        if (!normalizedEmail) {
          skipped++
          errors.push(`Row ${i + 2}: Missing email`)
          continue
        }

        if (!isValidEmail(normalizedEmail)) {
          skipped++
          errors.push(`Row ${i + 2}: Invalid email format: ${normalizedEmail}`)
          continue
        }

        try {
          // Upsert contact
          const existing = await prisma.contact.findFirst({
            where: { customerId, email: normalizedEmail },
          })

          if (existing) {
            // UPDATE existing contact:
            // Only include fields that have actual non-empty values from the sheet.
            // This prevents overwriting existing data with defaults or empty values.
            const updateData: Record<string, string> = { source }
            if (hasValue(contact.firstName)) updateData.firstName = contact.firstName
            if (hasValue(contact.lastName)) updateData.lastName = contact.lastName
            if (hasValue(contact.companyName)) updateData.companyName = contact.companyName
            if (hasValue(contact.jobTitle)) updateData.jobTitle = contact.jobTitle
            if (hasValue(contact.phone)) updateData.phone = contact.phone

            await prisma.contact.update({
              where: { id: existing.id },
              data: updateData,
            })
            updated++
            contactIdsInSheet.add(existing.id)
          } else {
            // CREATE new contact:
            // Apply defaults for required fields (firstName, companyName) if not in sheet.
            const newContact = await prisma.contact.create({
              data: {
                id: `contact_${randomUUID()}`,
                customerId,
                email: normalizedEmail,
                firstName: hasValue(contact.firstName) ? contact.firstName : 'Unknown',
                lastName: hasValue(contact.lastName) ? contact.lastName : '',
                companyName: hasValue(contact.companyName) ? contact.companyName : 'Unknown',
                jobTitle: contact.jobTitle,
                phone: contact.phone,
                source: source,
              },
            })
            imported++
            contactIdsInSheet.add(newContact.id)
          }
        } catch (err: any) {
          skipped++
          errors.push(`Row ${i + 2}: ${err.message}`)
        }
      }

      const existingMembers = await prisma.contactListMember.findMany({
        where: { listId: snapshotList.id },
        select: { contactId: true },
      })

      const existingMemberIds = new Set(existingMembers.map(member => member.contactId))
      const membersToAdd = Array.from(contactIdsInSheet).filter(id => !existingMemberIds.has(id))
      const membersToRemove = existingMembers.filter(member => !contactIdsInSheet.has(member.contactId))

      if (membersToAdd.length > 0) {
        await prisma.contactListMember.createMany({
          data: membersToAdd.map(contactId => ({
            id: `member_${randomUUID()}`,
            listId: snapshotList.id,
            contactId,
          })),
          skipDuplicates: true,
        })
      }

      if (membersToRemove.length > 0) {
        await prisma.contactListMember.deleteMany({
          where: {
            listId: snapshotList.id,
            contactId: { in: membersToRemove.map(member => member.contactId) },
          },
        })
      }

      const lastSyncAt = new Date()

      // Update config with results
      await prisma.sheetSourceConfig.update({
        where: { id: config.id },
        data: {
          lastSyncAt,
          lastSyncStatus: 'success',
          lastError: errors.length > 0 ? errors.slice(0, 10).join('; ') : null,
          rowsImported: imported,
          rowsUpdated: updated,
          rowsSkipped: skipped,
          sheetName,
          mappings,
        },
      })

      await prisma.contactList.update({
        where: { id: snapshotList.id },
        data: { updatedAt: lastSyncAt },
      })

      res.json({
        success: true,
        source,
        sheetName,
        totalRows: sheetData.rows.length,
        imported,
        updated,
        skipped,
        errors: errors.slice(0, 10),
        list: {
          id: snapshotList.id,
          name: snapshotList.name,
          memberCount: contactIdsInSheet.size,
        },
        lastSyncAt: lastSyncAt.toISOString(),
      })
    } catch (err: any) {
      // Update config with error
      await prisma.sheetSourceConfig.update({
        where: { id: config.id },
        data: {
          lastSyncStatus: 'error',
          lastError: err.message,
        },
      })

      return res.status(500).json({
        success: false,
        error: err.message,
        source,
      })
    }
  } catch (err) {
    next(err)
  }
})

/**
 * GET /api/sheets/sources/:source/lists
 * Returns recent snapshot lists for a source
 */
router.get('/sources/:source/lists', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const customerId = getCustomerId(req)
    const { source } = req.params

    if (!isValidSource(source)) {
      return res.status(400).json({ error: `Invalid source. Must be one of: ${validSources.join(', ')}` })
    }

    const sourceKey = source as ValidSource
    const prefix = `${SOURCE_LABELS[sourceKey]} — `

    const lists = await prisma.contactList.findMany({
      where: {
        customerId,
        name: { startsWith: prefix },
      },
      orderBy: { updatedAt: 'desc' },
      take: 10,
      include: {
        _count: { select: { contactListMembers: true } },
      },
    })

    res.json({
      source,
      lists: lists.map(list => ({
        id: list.id,
        name: list.name,
        memberCount: list._count.contactListMembers,
        lastSyncAt: list.updatedAt.toISOString(),
      })),
    })
  } catch (err) {
    next(err)
  }
})

/**
 * GET /api/sheets/sources/:source/preview
 * Returns a preview of imported contacts for a source
 */
router.get('/sources/:source/preview', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const customerId = getCustomerId(req)
    const { source } = req.params

    if (!isValidSource(source)) {
      return res.status(400).json({ error: `Invalid source. Must be one of: ${validSources.join(', ')}` })
    }

    // Get config
    const config = await prisma.sheetSourceConfig.findUnique({
      where: {
        customerId_source: { customerId, source: source as SheetSource },
      },
    })

    if (!config || !config.sheetId) {
      return res.status(400).json({
        error: 'Sheet not connected. Please connect a sheet URL first.',
      })
    }

    const sheetData = await readSheet(config.sheetId, config.gid)
    const mappings = findFieldMappings(sheetData.headers)

    if (!mappings.email) {
      return res.status(400).json({ error: 'Sheet must have an email column' })
    }

    const preview: any[] = []
    const errors: string[] = []

    for (let i = 0; i < sheetData.rows.length; i++) {
      const row = sheetData.rows[i]
      const contact = extractContactFromRow(row, mappings)
      const normalizedEmail = normalizeEmail(contact.email)

      if (!normalizedEmail) {
        errors.push(`Row ${i + 2}: Missing email`)
        continue
      }

      if (!isValidEmail(normalizedEmail)) {
        errors.push(`Row ${i + 2}: Invalid email format: ${normalizedEmail}`)
        continue
      }

      if (preview.length < 20) {
        preview.push({
          ...contact,
          email: normalizedEmail,
        })
      }
    }

    res.json({
      source,
      connected: true,
      sheetUrl: config.sheetUrl,
      sheetName: sheetData.sheetTitle,
      lastSyncAt: config.lastSyncAt?.toISOString() || null,
      lastSyncStatus: config.lastSyncStatus,
      lastError: config.lastError,
      rowsImported: config.rowsImported,
      rowsUpdated: config.rowsUpdated,
      rowsSkipped: config.rowsSkipped,
      preview,
      totalRows: sheetData.rows.length,
      errors: errors.slice(0, 10),
    })
  } catch (err) {
    next(err)
  }
})

export default router
