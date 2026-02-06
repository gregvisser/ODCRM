/**
 * Google Sheets Lead Sources API
 * 
 * Endpoints for managing Cognism, Apollo, and Blackbook sheet integrations.
 * Uses service account authentication (no user OAuth required).
 */

import { Router, Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { SheetSource, SheetSyncStatus } from '@prisma/client'
import {
  parseSheetUrl,
  readSheet,
  findFieldMappings,
  extractContactFromRow,
  validateCredentials,
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

    res.json({ sources, credentialsConfigured: validateCredentials().valid })
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
      const preview: any[] = []

      // Ensure system list exists for this source
      const listName = source.charAt(0).toUpperCase() + source.slice(1) // Capitalize
      let systemList = await prisma.contactList.findFirst({
        where: { customerId, name: listName },
      })
      if (!systemList) {
        systemList = await prisma.contactList.create({
          data: {
            id: `list_${source}_${customerId}_${Date.now()}`,
            customerId,
            name: listName,
            description: `Auto-created list for ${listName} leads`,
          },
        })
      }

      for (let i = 0; i < sheetData.rows.length; i++) {
        const row = sheetData.rows[i]
        const contact = extractContactFromRow(row, mappings)

        // Skip rows without email
        if (!contact.email) {
          skipped++
          errors.push(`Row ${i + 2}: Missing email`)
          continue
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!emailRegex.test(contact.email)) {
          skipped++
          errors.push(`Row ${i + 2}: Invalid email format: ${contact.email}`)
          continue
        }

        try {
          // Upsert contact
          const existing = await prisma.contact.findFirst({
            where: { customerId, email: contact.email.toLowerCase() },
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

            // Ensure list membership
            await prisma.contactListMember.upsert({
              where: {
                listId_contactId: { listId: systemList.id, contactId: existing.id },
              },
              create: {
                id: `member_${Date.now()}_${Math.random().toString(36).substring(7)}`,
                listId: systemList.id,
                contactId: existing.id,
              },
              update: {},
            })
          } else {
            // CREATE new contact:
            // Apply defaults for required fields (firstName, companyName) if not in sheet.
            const newContact = await prisma.contact.create({
              data: {
                id: `contact_${Date.now()}_${Math.random().toString(36).substring(7)}`,
                customerId,
                email: contact.email.toLowerCase(),
                firstName: hasValue(contact.firstName) ? contact.firstName : 'Unknown',
                lastName: hasValue(contact.lastName) ? contact.lastName : '',
                companyName: hasValue(contact.companyName) ? contact.companyName : 'Unknown',
                jobTitle: contact.jobTitle,
                phone: contact.phone,
                source: source,
              },
            })
            imported++

            // Add to system list
            await prisma.contactListMember.create({
              data: {
                id: `member_${Date.now()}_${Math.random().toString(36).substring(7)}`,
                listId: systemList.id,
                contactId: newContact.id,
              },
            })
          }

          // Add to preview (first 20 rows)
          if (preview.length < 20) {
            preview.push(contact)
          }
        } catch (err: any) {
          skipped++
          errors.push(`Row ${i + 2}: ${err.message}`)
        }
      }

      // Update config with results
      await prisma.sheetSourceConfig.update({
        where: { id: config.id },
        data: {
          lastSyncAt: new Date(),
          lastSyncStatus: 'success',
          lastError: errors.length > 0 ? errors.slice(0, 10).join('; ') : null,
          rowsImported: imported,
          rowsUpdated: updated,
          rowsSkipped: skipped,
          sheetName: sheetData.sheetTitle,
        },
      })

      res.json({
        success: true,
        source,
        sheetTitle: sheetData.sheetTitle,
        totalRows: sheetData.rows.length,
        imported,
        updated,
        skipped,
        errors: errors.slice(0, 10),
        lastSyncAt: new Date().toISOString(),
        mappings,
        preview,
        listId: systemList.id,
        listName: systemList.name,
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

    if (!config) {
      return res.json({
        source,
        connected: false,
        preview: [],
        totalContacts: 0,
      })
    }

    // Get contacts from this source
    const contacts = await prisma.contact.findMany({
      where: { customerId, source },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        companyName: true,
        jobTitle: true,
        phone: true,
        createdAt: true,
      },
    })

    const totalContacts = await prisma.contact.count({
      where: { customerId, source },
    })

    res.json({
      source,
      connected: true,
      sheetUrl: config.sheetUrl,
      sheetName: config.sheetName,
      lastSyncAt: config.lastSyncAt?.toISOString(),
      lastSyncStatus: config.lastSyncStatus,
      lastError: config.lastError,
      rowsImported: config.rowsImported,
      rowsUpdated: config.rowsUpdated,
      rowsSkipped: config.rowsSkipped,
      preview: contacts,
      totalContacts,
    })
  } catch (err) {
    next(err)
  }
})

export default router
