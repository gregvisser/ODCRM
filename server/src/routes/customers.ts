// @ts-nocheck
/**
 * Customers/Clients Management API
 * Ported from OpensDoorsV2 clients/actions.ts
 */

import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { getActorIdentity } from '../utils/auth.js'

const router = Router()

// Schema validation (matches OpensDoorsV2 ClientAccount)
const upsertCustomerSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  domain: z.string().optional(),
  accountData: z.unknown().optional().nullable(),
  website: z.string().optional().nullable(),
  whatTheyDo: z.string().optional().nullable(),
  accreditations: z.string().optional().nullable(),
  keyLeaders: z.string().optional().nullable(),
  companyProfile: z.string().optional().nullable(),
  recentNews: z.string().optional().nullable(),
  companySize: z.string().optional().nullable(),
  headquarters: z.string().optional().nullable(),
  foundingYear: z.string().optional().nullable(),
  socialPresence: z.array(z.object({
    label: z.string(),
    url: z.string().url(),
  })).optional().nullable(),
  
  // Business details
  leadsReportingUrl: z.string().url().optional().nullable(),
  leadsGoogleSheetLabel: z.string().optional().nullable(),
  sector: z.string().optional().nullable(),
  clientStatus: z.enum(['active', 'inactive', 'onboarding', 'win_back']).optional(),
  targetJobTitle: z.string().optional().nullable(),
  prospectingLocation: z.string().optional().nullable(),
  
  // Financial & performance
  monthlyIntakeGBP: z.number().optional().nullable(),
  monthlyRevenueFromCustomer: z.number().optional().nullable(),
  defcon: z.number().int().min(1).max(6).optional().nullable(),
  
  // Lead targets & actuals
  weeklyLeadTarget: z.number().int().optional().nullable(),
  weeklyLeadActual: z.number().int().optional().nullable(),
  monthlyLeadTarget: z.number().int().optional().nullable(),
  monthlyLeadActual: z.number().int().optional().nullable(),
})

const upsertCustomerContactSchema = z.object({
  id: z.string().optional(),
  customerId: z.string().min(1),
  name: z.string().min(1),
  email: z.string().email().optional().nullable(),
  phone: z.string().optional().nullable(),
  title: z.string().optional().nullable(),
  isPrimary: z.boolean().optional(),
  notes: z.string().optional().nullable(),
})

// GET /api/customers/diagnostic - Test database connection
router.get('/diagnostic', async (req, res) => {
  try {
    console.log('[DIAGNOSTIC] Testing database connection...')
    const count = await prisma.customer.count()
    console.log(`[DIAGNOSTIC] Customer count: ${count}`)
    return res.json({ success: true, customerCount: count, timestamp: new Date().toISOString() })
  } catch (error: any) {
    console.error('[DIAGNOSTIC] Error:', error.message)
    return res.status(500).json({ error: error.message })
  }
})

// GET /api/customers - List all customers with their contacts
router.get('/', async (req, res) => {
  try {
    console.log('[GET /] Starting customers fetch...')
    const customers = await prisma.customer.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        customerContacts: true,
      },
    })
    console.log(`[GET /] Fetched ${customers.length} customers`)

    // Explicitly construct serialized objects to avoid Date serialization issues
    const serialized = customers.map((customer) => ({
      id: customer.id,
      name: customer.name,
      domain: customer.domain,
      leadsReportingUrl: customer.leadsReportingUrl,
      leadsGoogleSheetLabel: customer.leadsGoogleSheetLabel,
      sector: customer.sector,
      clientStatus: customer.clientStatus,
      targetJobTitle: customer.targetJobTitle,
      prospectingLocation: customer.prospectingLocation,
      monthlyIntakeGBP: customer.monthlyIntakeGBP ? customer.monthlyIntakeGBP.toString() : null,
      monthlyRevenueFromCustomer: customer.monthlyRevenueFromCustomer ? customer.monthlyRevenueFromCustomer.toString() : null,
      defcon: customer.defcon,
      weeklyLeadTarget: customer.weeklyLeadTarget,
      weeklyLeadActual: customer.weeklyLeadActual,
      monthlyLeadTarget: customer.monthlyLeadTarget,
      monthlyLeadActual: customer.monthlyLeadActual,
      website: customer.website,
      whatTheyDo: customer.whatTheyDo,
      accreditations: customer.accreditations,
      keyLeaders: customer.keyLeaders,
      companyProfile: customer.companyProfile,
      recentNews: customer.recentNews,
      companySize: customer.companySize,
      headquarters: customer.headquarters,
      foundingYear: customer.foundingYear,
      socialPresence: customer.socialPresence,
      lastEnrichedAt: customer.lastEnrichedAt?.toISOString() || null,
      agreementFileUrl: customer.agreementFileUrl,
      agreementFileName: customer.agreementFileName,
      agreementFileMimeType: customer.agreementFileMimeType,
      agreementUploadedAt: customer.agreementUploadedAt?.toISOString() || null,
      agreementUploadedByEmail: customer.agreementUploadedByEmail,
      accountData: customer.accountData,
      createdAt: customer.createdAt.toISOString(),
      updatedAt: customer.updatedAt.toISOString(),
      customerContacts: customer.customerContacts.map((contact) => ({
        id: contact.id,
        customerId: contact.customerId,
        name: contact.name,
        email: contact.email,
        phone: contact.phone,
        title: contact.title,
        isPrimary: contact.isPrimary,
        notes: contact.notes,
        createdAt: contact.createdAt.toISOString(),
        updatedAt: contact.updatedAt.toISOString(),
      })),
    }))

    return res.json(serialized)
  } catch (error) {
    console.error('Error fetching customers:', error)
    return res.status(500).json({ error: 'Failed to fetch customers' })
  }
})

// GET /api/customers/:id - Get a single customer with contacts
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params

    const customer = await prisma.customer.findUnique({
      where: { id },
      include: {
        customerContacts: true,
      },
    })

    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' })
    }

    // Explicitly construct serialized object to avoid Date serialization issues
    const serialized = {
      id: customer.id,
      name: customer.name,
      domain: customer.domain,
      leadsReportingUrl: customer.leadsReportingUrl,
      leadsGoogleSheetLabel: customer.leadsGoogleSheetLabel,
      sector: customer.sector,
      clientStatus: customer.clientStatus,
      targetJobTitle: customer.targetJobTitle,
      prospectingLocation: customer.prospectingLocation,
      monthlyIntakeGBP: customer.monthlyIntakeGBP ? customer.monthlyIntakeGBP.toString() : null,
      monthlyRevenueFromCustomer: customer.monthlyRevenueFromCustomer ? customer.monthlyRevenueFromCustomer.toString() : null,
      defcon: customer.defcon,
      weeklyLeadTarget: customer.weeklyLeadTarget,
      weeklyLeadActual: customer.weeklyLeadActual,
      monthlyLeadTarget: customer.monthlyLeadTarget,
      monthlyLeadActual: customer.monthlyLeadActual,
      website: customer.website,
      whatTheyDo: customer.whatTheyDo,
      accreditations: customer.accreditations,
      keyLeaders: customer.keyLeaders,
      companyProfile: customer.companyProfile,
      recentNews: customer.recentNews,
      companySize: customer.companySize,
      headquarters: customer.headquarters,
      foundingYear: customer.foundingYear,
      socialPresence: customer.socialPresence,
      lastEnrichedAt: customer.lastEnrichedAt?.toISOString() || null,
      agreementFileUrl: customer.agreementFileUrl,
      agreementFileName: customer.agreementFileName,
      agreementFileMimeType: customer.agreementFileMimeType,
      agreementUploadedAt: customer.agreementUploadedAt?.toISOString() || null,
      agreementUploadedByEmail: customer.agreementUploadedByEmail,
      accountData: customer.accountData,
      createdAt: customer.createdAt.toISOString(),
      updatedAt: customer.updatedAt.toISOString(),
      customerContacts: customer.customerContacts.map((contact) => ({
        id: contact.id,
        customerId: contact.customerId,
        name: contact.name,
        email: contact.email,
        phone: contact.phone,
        title: contact.title,
        isPrimary: contact.isPrimary,
        notes: contact.notes,
        createdAt: contact.createdAt.toISOString(),
        updatedAt: contact.updatedAt.toISOString(),
      })),
    }

    return res.json(serialized)
  } catch (error) {
    console.error('Error fetching customer:', error)
    return res.status(500).json({ error: 'Failed to fetch customer' })
  }
})

// GET /api/customers/:id/email-identities - Get connected email accounts for a customer
router.get('/:id/email-identities', async (req, res) => {
  try {
    const { id } = req.params
    console.log('[email-identities] Handler hit for customerId:', id)

    // First verify customer exists
    const customer = await prisma.customer.findUnique({ where: { id } })
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' })
    }

    // Fetch email identities for this customer
    const identities = await prisma.emailIdentity.findMany({
      where: { customerId: id },
      select: {
        id: true,
        emailAddress: true,
        displayName: true,
        provider: true,
        isActive: true,
        dailySendLimit: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    })

    const serialized = identities.map((identity) => ({
      ...identity,
      createdAt: identity.createdAt.toISOString(),
    }))

    return res.json(serialized)
  } catch (error) {
    console.error('Error fetching email identities:', error)
    return res.status(500).json({ error: 'Failed to fetch email identities' })
  }
})

// POST /api/customers - Create a new customer
router.post('/', async (req, res) => {
  try {
    // Validate with detailed error reporting
    const validationResult = upsertCustomerSchema.safeParse(req.body)
    if (!validationResult.success) {
      const firstError = validationResult.error.errors[0]
      const errorMessage = firstError 
        ? `${firstError.path.join('.')}: ${firstError.message}`
        : 'Invalid input'
      console.error('Validation failed for POST /api/customers:', validationResult.error.errors)
      return res.status(400).json({ 
        error: errorMessage,
        details: validationResult.error.errors
      })
    }
    
    const validated = validationResult.data

    const customer = await prisma.customer.create({ data: {
        id: `cust_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        name: validated.name,
        domain: validated.domain,
        accountData: validated.accountData ?? null,
        website: validated.website,
        whatTheyDo: validated.whatTheyDo,
        accreditations: validated.accreditations,
        keyLeaders: validated.keyLeaders,
        companyProfile: validated.companyProfile,
        recentNews: validated.recentNews,
        companySize: validated.companySize,
        headquarters: validated.headquarters,
        foundingYear: validated.foundingYear,
        socialPresence: validated.socialPresence ?? null,
        leadsReportingUrl: validated.leadsReportingUrl,
        leadsGoogleSheetLabel: validated.leadsGoogleSheetLabel,
        sector: validated.sector,
        clientStatus: validated.clientStatus || 'active',
        targetJobTitle: validated.targetJobTitle,
        prospectingLocation: validated.prospectingLocation,
        monthlyIntakeGBP: validated.monthlyIntakeGBP,
        monthlyRevenueFromCustomer: validated.monthlyRevenueFromCustomer,
        defcon: validated.defcon,
        weeklyLeadTarget: validated.weeklyLeadTarget,
        weeklyLeadActual: validated.weeklyLeadActual,
        monthlyLeadTarget: validated.monthlyLeadTarget,
        monthlyLeadActual: validated.monthlyLeadActual,
        updatedAt: new Date(),
      },
    })

    return res.status(201).json({
      id: customer.id,
      name: customer.name,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors })
    }
    console.error('Error creating customer:', error)
    return res.status(500).json({ error: 'Failed to create customer' })
  }
})

// PUT /api/customers/:id - Update a customer
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params
    
    // Validate with detailed error reporting
    const validationResult = upsertCustomerSchema.safeParse(req.body)
    if (!validationResult.success) {
      const firstError = validationResult.error.errors[0]
      const errorMessage = firstError 
        ? `${firstError.path.join('.')}: ${firstError.message}`
        : 'Invalid input'
      console.error('Validation failed for PUT /api/customers/:id:', validationResult.error.errors)
      return res.status(400).json({ 
        error: errorMessage,
        details: validationResult.error.errors
      })
    }
    
    const validated = validationResult.data
    const shouldClearLeads = validated.leadsReportingUrl === null
    const updateData = {
      name: validated.name,
      domain: validated.domain,
      accountData: validated.accountData ?? null,
      website: validated.website,
      whatTheyDo: validated.whatTheyDo,
      accreditations: validated.accreditations,
      keyLeaders: validated.keyLeaders,
      companyProfile: validated.companyProfile,
      recentNews: validated.recentNews,
      companySize: validated.companySize,
      headquarters: validated.headquarters,
      foundingYear: validated.foundingYear,
      socialPresence: validated.socialPresence ?? undefined,
      leadsReportingUrl: validated.leadsReportingUrl,
      leadsGoogleSheetLabel: validated.leadsGoogleSheetLabel,
      sector: validated.sector,
      clientStatus: validated.clientStatus,
      targetJobTitle: validated.targetJobTitle,
      prospectingLocation: validated.prospectingLocation,
      monthlyIntakeGBP: validated.monthlyIntakeGBP,
      monthlyRevenueFromCustomer: validated.monthlyRevenueFromCustomer,
      defcon: validated.defcon,
      weeklyLeadTarget: validated.weeklyLeadTarget,
      weeklyLeadActual: validated.weeklyLeadActual,
      monthlyLeadTarget: validated.monthlyLeadTarget,
      monthlyLeadActual: validated.monthlyLeadActual,
      updatedAt: new Date(),
    }
    if (shouldClearLeads) {
      updateData.weeklyLeadActual = 0
      updateData.monthlyLeadActual = 0
    }

    const customer = await prisma.$transaction(async (tx) => {
      const updatedCustomer = await tx.customer.update({
        where: { id },
        data: updateData,
      })

      if (shouldClearLeads) {
        const clearedAt = new Date()
        await tx.leadRecord.deleteMany({ where: { customerId: id } })
        await tx.leadSyncState.upsert({
          where: { customerId: id },
          create: {
            id: `lead_sync_${id}`,
            customerId: id,
            lastSyncAt: clearedAt,
            lastSuccessAt: clearedAt,
            rowCount: 0,
            lastError: null,
          },
          update: {
            lastSyncAt: clearedAt,
            lastSuccessAt: clearedAt,
            rowCount: 0,
            lastError: null,
          },
        })
      }

      return updatedCustomer
    })

    return res.json({
      id: customer.id,
      name: customer.name,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors })
    }
    console.error('Error updating customer:', error)
    return res.status(500).json({ error: 'Failed to update customer' })
  }
})

// DELETE /api/customers/:id - Delete a customer
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params

    // Check for related records
    const [contactsCount, campaignsCount, listsCount, sequencesCount] = await Promise.all([
      prisma.contact.count({ where: { customerId: id } }),
      prisma.emailCampaign.count({ where: { customerId: id } }),
      prisma.contactList.count({ where: { customerId: id } }),
      prisma.emailSequence.count({ where: { customerId: id } }),
    ])

    if (contactsCount > 0 || campaignsCount > 0 || listsCount > 0 || sequencesCount > 0) {
      return res.status(400).json({
        error: `Cannot delete customer: it has ${contactsCount} contacts, ${campaignsCount} campaigns, ${listsCount} lists, and ${sequencesCount} sequences. Delete those first.`,
      })
    }

    await prisma.customer.delete({ where: { id } })

    return res.json({ success: true })
  } catch (error) {
    console.error('Error deleting customer:', error)
    return res.status(500).json({ error: 'Failed to delete customer' })
  }
})

// POST /api/customers/:id/contacts - Add a contact to customer
router.post('/:id/contacts', async (req, res) => {
  try {
    const { id } = req.params
    const validated = upsertCustomerContactSchema.parse({ ...req.body, customerId: id })

    const contact = await prisma.customerContact.create({ data: {
        id: `contact_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        customerId: validated.customerId,
        name: validated.name,
        email: validated.email,
        phone: validated.phone,
        title: validated.title,
        isPrimary: validated.isPrimary || false,
        notes: validated.notes,
        updatedAt: new Date(),
      },
    })

    return res.status(201).json({
      id: contact.id,
      name: contact.name,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors })
    }
    console.error('Error creating customer contacts:', error)
    return res.status(500).json({ error: 'Failed to create contact' })
  }
})

// PUT /api/customers/:customerId/contacts/:contactId - Update a customer contact
router.put('/:customerId/contacts/:contactId', async (req, res) => {
  try {
    const { contactId } = req.params
    const validated = upsertCustomerContactSchema.omit({ customerId: true }).parse(req.body)

    const contact = await prisma.customerContact.update({
      where: { id: contactId },
      data: {
        name: validated.name,
        email: validated.email,
        phone: validated.phone,
        title: validated.title,
        isPrimary: validated.isPrimary,
        notes: validated.notes,
        updatedAt: new Date(),
      },
    })

    return res.json({
      id: contact.id,
      name: contact.name,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors })
    }
    console.error('Error updating customer contacts:', error)
    return res.status(500).json({ error: 'Failed to update contact' })
  }
})

// DELETE /api/customers/:customerId/contacts/:contactId - Delete a customer contact
router.delete('/:customerId/contacts/:contactId', async (req, res) => {
  try {
    const { contactId } = req.params

    await prisma.customerContact.delete({
      where: { id: contactId },
    })

    return res.json({ success: true })
  } catch (error) {
    console.error('Error deleting customer contacts:', error)
    return res.status(500).json({ error: 'Failed to delete contact' })
  }
})

// POST /api/customers/:id/enrich-about - Manually trigger About section enrichment
router.post('/:id/enrich-about', async (req, res) => {
  try {
    const { id } = req.params

    const customer = await prisma.customer.findUnique({
      where: { id },
    })

    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' })
    }

    const website = customer.website || customer.domain
    if (!website) {
      return res.status(400).json({ error: 'Customer must have a website or domain to enrich' })
    }

    const { enrichCompanyAbout } = await import('../services/aboutEnrichment.js')
    const result = await enrichCompanyAbout(prisma, id, customer.name, website)

    if (!result) {
      return res.status(500).json({ error: 'Failed to enrich company data' })
    }

    return res.json({
      success: true,
      data: result,
    })
  } catch (error) {
    console.error('Error enriching customer About:', error)
    return res.status(500).json({ error: 'Failed to enrich customer About' })
  }
})

// Bulk sync leads URLs from frontend
router.post('/sync-leads-urls', async (req, res) => {
  try {
    const { accounts } = req.body

    if (!Array.isArray(accounts)) {
      return res.status(400).json({ error: 'accounts must be an array' })
    }

    console.log(`📥 BULK SYNC LEADS URLS - ${accounts.length} accounts`)

    let updated = 0
    let skipped = 0
    const results = []

    for (const account of accounts) {
      const { name, clientLeadsSheetUrl } = account

      if (!name) {
        skipped++
        continue
      }

      const leadsUrl = clientLeadsSheetUrl?.trim()
      if (!leadsUrl) {
        skipped++
        continue
      }

      // Find customer by name
      const customer = await prisma.customer.findFirst({
        where: {
          name: { equals: name, mode: 'insensitive' }
        }
      })

      if (!customer) {
        results.push({ name, status: 'not_found' })
        skipped++
        continue
      }

      // Only update if URL is different
      if (customer.leadsReportingUrl !== leadsUrl) {
        await prisma.customer.update({
          where: { id: customer.id },
          data: { leadsReportingUrl: leadsUrl }
        })
        
        results.push({ 
          name, 
          status: 'updated',
          customerId: customer.id,
          url: leadsUrl 
        })
        updated++
        console.log(`✅ Updated ${name}: ${leadsUrl}`)
      } else {
        results.push({ name, status: 'unchanged' })
        skipped++
      }
    }

    console.log(`📊 Bulk sync complete: ${updated} updated, ${skipped} skipped`)

    res.json({
      success: true,
      updated,
      skipped,
      results
    })
  } catch (error) {
    console.error('Error in bulk sync leads URLs:', error)
    res.status(500).json({ 
      error: 'Failed to sync leads URLs',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
})

// POST /api/customers/:id/complete-onboarding - Complete onboarding workflow (IRREVERSIBLE)
router.post('/:id/complete-onboarding', async (req, res) => {
  try {
    const { id } = req.params

    // SECURITY: Derive actor identity from server-side auth context ONLY
    // NEVER trust client-supplied identity fields
    const actor = getActorIdentity(req)
    
    // Log authentication status (for debugging)
    if (actor.source === 'none') {
      console.log(`[complete-onboarding] No authenticated user - proceeding with null actor for customer ${id}`)
    } else {
      console.log(`[complete-onboarding] Authenticated via ${actor.source}: ${actor.email || actor.userId}`)
    }

    // Fetch current customer state
    const customer = await prisma.customer.findUnique({
      where: { id },
      select: { id: true, name: true, clientStatus: true }
    })

    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' })
    }

    // Check if already completed (idempotency)
    if (customer.clientStatus === 'active') {
      // Already active - log attempt but don't fail
      await prisma.customerAuditEvent.create({
        data: {
          customerId: id,
          action: 'complete_onboarding_attempt_already_active',
          actorUserId: actor.userId,
          actorEmail: actor.email,
          fromStatus: customer.clientStatus,
          toStatus: customer.clientStatus,
          metadata: {
            note: 'Attempt to complete onboarding for already-active customer',
            customerName: customer.name,
            authSource: actor.source
          }
        }
      })

      return res.status(409).json({ 
        error: 'Customer already active',
        message: 'Onboarding was already completed for this customer',
        currentStatus: customer.clientStatus
      })
    }

    // IRREVERSIBLE TRANSITION: onboarding -> active
    const previousStatus = customer.clientStatus
    
    // Update customer status
    const updatedCustomer = await prisma.customer.update({
      where: { id },
      data: { clientStatus: 'active' }
    })

    // Create audit event with server-derived actor identity
    const auditEvent = await prisma.customerAuditEvent.create({
      data: {
        customerId: id,
        action: 'complete_onboarding',
        actorUserId: actor.userId,
        actorEmail: actor.email,
        fromStatus: previousStatus,
        toStatus: 'active',
        metadata: {
          customerName: customer.name,
          completedAt: new Date().toISOString(),
          authSource: actor.source
        }
      }
    })

    console.log(`✅ Onboarding completed for customer ${customer.name} (${id}) by ${actor.email || actor.userId || 'anonymous'}`)

    res.json({
      success: true,
      customer: {
        id: updatedCustomer.id,
        name: updatedCustomer.name,
        clientStatus: updatedCustomer.clientStatus,
        previousStatus
      },
      auditEvent: {
        id: auditEvent.id,
        action: auditEvent.action,
        actorEmail: auditEvent.actorEmail,
        actorUserId: auditEvent.actorUserId,
        fromStatus: auditEvent.fromStatus,
        toStatus: auditEvent.toStatus,
        createdAt: auditEvent.createdAt.toISOString()
      }
    })
  } catch (error) {
    console.error('Error completing onboarding:', error)
    res.status(500).json({ 
      error: 'Failed to complete onboarding',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
})

// GET /api/customers/:id/audit - Get audit trail for customer
router.get('/:id/audit', async (req, res) => {
  try {
    const { id } = req.params
    const { action } = req.query

    // Verify customer exists
    const customer = await prisma.customer.findUnique({
      where: { id },
      select: { id: true, name: true }
    })

    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' })
    }

    // Build query filters
    const where: any = { customerId: id }
    if (action && typeof action === 'string') {
      where.action = action
    }

    // Fetch audit events
    const auditEvents = await prisma.customerAuditEvent.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100 // Limit to last 100 events
    })

    // Serialize dates
    const serialized = auditEvents.map(event => ({
      ...event,
      createdAt: event.createdAt.toISOString()
    }))

    res.json({
      customerId: id,
      customerName: customer.name,
      events: serialized,
      total: serialized.length
    })
  } catch (error) {
    console.error('Error fetching audit trail:', error)
    res.status(500).json({ 
      error: 'Failed to fetch audit trail',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
})

// POST /api/customers/:id/agreement - Upload customer agreement
// Phase 2 Item 4: Agreement upload with auto-tick progress tracker
router.post('/:id/agreement', async (req, res) => {
  try {
    const { id } = req.params
    const { fileName, dataUrl } = req.body

    // Validate customer exists
    const customer = await prisma.customer.findUnique({
      where: { id },
      select: { id: true, name: true, accountData: true }
    })

    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' })
    }

    // Validate input
    if (!fileName || !dataUrl) {
      return res.status(400).json({ error: 'Missing fileName or dataUrl' })
    }

    // Extract and validate mime type from dataUrl
    const mimeMatch = dataUrl.match(/^data:([^;]+);base64,/)
    if (!mimeMatch) {
      return res.status(400).json({ error: 'Invalid dataUrl format' })
    }

    const mimeType = mimeMatch[1]
    const allowedMimeTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ]

    if (!allowedMimeTypes.includes(mimeType)) {
      return res.status(400).json({ 
        error: 'Invalid file type. Only PDF, DOC, and DOCX files are allowed.',
        receivedMimeType: mimeType 
      })
    }

    // Upload file using existing infrastructure
    // Reuse the upload logic from uploads.ts
    const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/)
    if (!match) {
      return res.status(400).json({ error: 'Invalid dataUrl format' })
    }

    const base64Data = match[2]
    const buffer = Buffer.from(base64Data, 'base64')

    // Save file to uploads directory
    const fs = await import('node:fs/promises')
    const path = await import('node:path')
    
    const uploadsDir = path.resolve(process.cwd(), 'uploads')
    await fs.mkdir(uploadsDir, { recursive: true })

    const sanitizeFileName = (name: string): string => {
      const safe = name.replace(/[^a-zA-Z0-9._-]/g, '_')
      return safe || 'agreement'
    }

    const safeName = sanitizeFileName(fileName)
    const uniqueName = `agreement_${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${safeName}`
    const filePath = path.join(uploadsDir, uniqueName)

    await fs.writeFile(filePath, buffer)

    // Construct file URL
    const baseUrl = process.env.API_PUBLIC_BASE_URL || 'http://localhost:3001'
    const fileUrl = `${baseUrl}/uploads/${uniqueName}`

    // Get actor email from auth context (server-derived only)
    const actorIdentity = getActorIdentity(req)
    const actorEmail = actorIdentity?.email || null

    // Update customer record with agreement metadata
    // CRITICAL: Safely merge accountData.progressTracker.sales.sales_contract_signed = true
    const currentAccountData = customer.accountData as Record<string, any> || {}
    const currentProgressTracker = currentAccountData.progressTracker || { sales: {}, ops: {}, am: {} }
    const currentSales = currentProgressTracker.sales || {}

    const updatedAccountData = {
      ...currentAccountData,
      progressTracker: {
        ...currentProgressTracker,
        sales: {
          ...currentSales,
          sales_contract_signed: true  // Auto-tick "Contract Signed & Filed"
        }
      }
    }

    const updatedCustomer = await prisma.customer.update({
      where: { id },
      data: {
        agreementFileUrl: fileUrl,
        agreementFileName: fileName,
        agreementFileMimeType: mimeType,
        agreementUploadedAt: new Date(),
        agreementUploadedByEmail: actorEmail,
        accountData: updatedAccountData,
        updatedAt: new Date()
      },
      select: {
        id: true,
        name: true,
        agreementFileUrl: true,
        agreementFileName: true,
        agreementFileMimeType: true,
        agreementUploadedAt: true,
        agreementUploadedByEmail: true,
        accountData: true
      }
    })

    console.log(`✅ Agreement uploaded for customer ${customer.name} (${id})`)
    console.log(`   File: ${fileName}`)
    console.log(`   URL: ${fileUrl}`)
    console.log(`   Progress tracker updated: sales_contract_signed = true`)

    return res.status(201).json({
      success: true,
      agreement: {
        fileName: updatedCustomer.agreementFileName,
        fileUrl: updatedCustomer.agreementFileUrl,
        mimeType: updatedCustomer.agreementFileMimeType,
        uploadedAt: updatedCustomer.agreementUploadedAt?.toISOString(),
        uploadedByEmail: updatedCustomer.agreementUploadedByEmail
      },
      progressUpdated: true,
      progressTracker: (updatedCustomer.accountData as any)?.progressTracker?.sales
    })
  } catch (error) {
    console.error('Error uploading agreement:', error)
    return res.status(500).json({ 
      error: 'Failed to upload agreement',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
})

export default router
