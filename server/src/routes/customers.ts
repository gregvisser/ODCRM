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
    console.log('[DIAGNOSTIC] Prisma client type:', typeof prisma)
    console.log('[DIAGNOSTIC] Prisma customer model:', typeof prisma.customer)
    
    const count = await prisma.customer.count()
    console.log(`[DIAGNOSTIC] Customer count: ${count}`)
    return res.json({ 
      success: true, 
      customerCount: count, 
      timestamp: new Date().toISOString() 
    })
  } catch (error: any) {
    console.error('[DIAGNOSTIC] Full error:', error)
    return res.status(500).json({ 
      error: error.message,
      code: error.code,
      stack: error.stack?.substring(0, 500),
      prismaError: error.meta
    })
  }
})

// JSON-safe normalizer - handles Prisma types and nested objects
function normalizeToJsonSafe(value: any, depth = 0): any {
  // Prevent infinite recursion
  if (depth > 10) return '[MAX_DEPTH]'
  
  // Handle null/undefined
  if (value === null || value === undefined) return value
  
  // Handle primitives
  const type = typeof value
  if (type === 'string' || type === 'number' || type === 'boolean') return value
  
  // Handle BigInt
  if (type === 'bigint') return value.toString()
  
  // Handle functions/symbols - omit
  if (type === 'function' || type === 'symbol') return undefined
  
  // Handle Date
  if (value instanceof Date) {
    return value.toISOString()
  }
  
  // Handle Buffer - omit for security
  if (Buffer.isBuffer(value)) return undefined
  
  // Handle Prisma Decimal - detect by presence of toNumber/toString methods
  if (value && typeof value === 'object' && 
      (value.constructor?.name === 'Decimal' || 
       (typeof value.toNumber === 'function' && typeof value.toString === 'function' && value.d !== undefined))) {
    return value.toString()
  }
  
  // Handle Arrays
  if (Array.isArray(value)) {
    return value.map(item => normalizeToJsonSafe(item, depth + 1))
  }
  
  // Handle plain objects - recursively normalize
  if (value && typeof value === 'object') {
    const normalized: Record<string, any> = {}
    for (const [key, val] of Object.entries(value)) {
      const normalizedVal = normalizeToJsonSafe(val, depth + 1)
      if (normalizedVal !== undefined) {
        normalized[key] = normalizedVal
      }
    }
    return normalized
  }
  
  // Fallback: convert to string
  return String(value)
}

// Detect which field causes JSON serialization failure
function detectFailingField(obj: Record<string, any>): { fieldName: string; error: string } | null {
  for (const [key, value] of Object.entries(obj)) {
    try {
      // Try to stringify with a safe replacer
      JSON.stringify(value, (k, v) => {
        if (typeof v === 'bigint') return v.toString()
        if (v instanceof Date) return v.toISOString()
        return v
      })
    } catch (err: any) {
      return { fieldName: key, error: err.message }
    }
  }
  return null
}

/**
 * GET /api/customers - List all customers with their contacts
 * 
 * STABLE API CONTRACT:
 * - ALWAYS returns: { customers: DatabaseCustomer[], warnings?: Warning[] }
 * - NEVER returns: DatabaseCustomer[] (bare array)
 * - Even when empty: { customers: [] }
 * - This prevents frontend shape confusion and makes errors explicit
 */
router.get('/', async (req, res) => {
  const correlationId = `cust_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`
  
  try {
    console.log(`[${correlationId}] Starting customers fetch...`)
    
    // PRODUCTION HOTFIX: ALWAYS use minimal safe select - schema drift prevents using include
    // Many columns missing in production: monthlyRevenueFromCustomer, leadsGoogleSheetLabel, etc.
    console.warn(`[${correlationId}] Using minimal safe fields only (production schema drift)`)
    
    const customers = await prisma.customer.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        domain: true,
        website: true,
        accountData: true,
        createdAt: true,
        updatedAt: true,
        customerContacts: {
          select: {
            id: true,
            customerId: true,
            name: true,
            email: true,
            phone: true,
            title: true,
            isPrimary: true,
            notes: true,
            createdAt: true,
            updatedAt: true,
          }
        },
      },
    }) as any[]
    
    console.log(`[${correlationId}] Fetched ${customers.length} customers`)

    if (customers.length === 0) {
      console.log(`[${correlationId}] No customers, returning empty wrapped response`)
      // STABLE API CONTRACT: Always return { customers: [] } format (never bare array)
      return res.json({ customers: [] })
    }

    console.log(`[${correlationId}] Starting serialization with per-customer sandboxing...`)
    
    const successfulCustomers: any[] = []
    const warnings: any[] = []
    
    // Process each customer in isolation
    for (let index = 0; index < customers.length; index++) {
      const customer = customers[index]
      
      try {
        console.log(`[${correlationId}] Serializing customer ${index + 1}/${customers.length}: ${customer.name} (${customer.id})`)
        
        // Normalize to JSON-safe primitives - handle schema drift (missing fields)
        const c = customer as any
        const normalized = {
          id: c.id,
          name: c.name,
          domain: c.domain || null,
          leadsReportingUrl: c.leadsReportingUrl || null,
          leadsGoogleSheetLabel: c.leadsGoogleSheetLabel || null,
          sector: c.sector || null,
          clientStatus: c.clientStatus || 'active',
          targetJobTitle: c.targetJobTitle || null,
          prospectingLocation: c.prospectingLocation || null,
          monthlyIntakeGBP: c.monthlyIntakeGBP ? String(c.monthlyIntakeGBP) : null,
          monthlyRevenueFromCustomer: c.monthlyRevenueFromCustomer ? String(c.monthlyRevenueFromCustomer) : null,
          defcon: c.defcon || null,
          weeklyLeadTarget: c.weeklyLeadTarget || null,
          weeklyLeadActual: c.weeklyLeadActual || null,
          monthlyLeadTarget: c.monthlyLeadTarget || null,
          monthlyLeadActual: c.monthlyLeadActual || null,
          website: c.website || null,
          whatTheyDo: c.whatTheyDo || null,
          accreditations: c.accreditations || null,
          keyLeaders: c.keyLeaders || null,
          companyProfile: c.companyProfile || null,
          recentNews: c.recentNews || null,
          companySize: c.companySize || null,
          headquarters: c.headquarters || null,
          foundingYear: c.foundingYear || null,
          socialPresence: c.socialPresence ? normalizeToJsonSafe(c.socialPresence) : null,
          lastEnrichedAt: c.lastEnrichedAt?.toISOString() || null,
          agreementFileUrl: c.agreementFileUrl || null,
          agreementFileName: c.agreementFileName || null,
          agreementFileMimeType: c.agreementFileMimeType || null,
          agreementUploadedAt: c.agreementUploadedAt?.toISOString() || null,
          agreementUploadedByEmail: c.agreementUploadedByEmail || null,
          accountData: c.accountData ? normalizeToJsonSafe(c.accountData) : null,
          createdAt: c.createdAt.toISOString(),
          updatedAt: c.updatedAt.toISOString(),
          customerContacts: (c.customerContacts || []).map((contact: any) => ({
            id: contact.id,
            customerId: contact.customerId,
            name: contact.name,
            email: contact.email || null,
            phone: contact.phone || null,
            title: contact.title || null,
            isPrimary: contact.isPrimary || false,
            notes: contact.notes || null,
            createdAt: contact.createdAt.toISOString(),
            updatedAt: contact.updatedAt.toISOString(),
          })),
        }
        
        // Test if it can be stringified
        JSON.stringify(normalized)
        
        // Success - add to results
        successfulCustomers.push(normalized)
        
      } catch (serError: any) {
        // ISOLATION: Don't let one bad customer crash the entire response
        console.error(`[${correlationId}] ❌ SERIALIZATION FAILED for customer ${customer.id} (${customer.name})`)
        console.error(`[${correlationId}]    Error: ${serError.message}`)
        console.error(`[${correlationId}]    Stack: ${serError.stack?.substring(0, 300)}`)
        
        // Try to detect the exact failing field
        let fieldHint: string | undefined
        try {
          const failingField = detectFailingField({
            id: customer.id,
            name: customer.name,
            accountData: customer.accountData,
            socialPresence: customer.socialPresence,
            monthlyIntakeGBP: customer.monthlyIntakeGBP,
            monthlyRevenueFromCustomer: customer.monthlyRevenueFromCustomer,
          })
          
          if (failingField) {
            fieldHint = failingField.fieldName
            console.error(`[${correlationId}]    Likely failing field: ${fieldHint}`)
          }
        } catch (detectErr) {
          console.error(`[${correlationId}]    Could not detect failing field`)
        }
        
        // Add warning but continue processing
        warnings.push({
          customerId: customer.id,
          customerName: customer.name, // Include name for debugging (not sensitive)
          reason: 'serialization_failed',
          message: serError.message,
          fieldHint: fieldHint || 'unknown',
          correlationId
        })
      }
    }

    console.log(`[${correlationId}] Serialization complete: ${successfulCustomers.length} successful, ${warnings.length} failed`)
    
    // Return response
    const response: any = {
      customers: successfulCustomers
    }
    
    if (warnings.length > 0) {
      response.warnings = warnings
      console.error(`[${correlationId}] ⚠️ WARNINGS: ${warnings.length} customers failed serialization`)
    }
    
    // Return 200 if at least one customer succeeded, 500 only if ALL failed
    if (successfulCustomers.length === 0 && warnings.length > 0) {
      console.error(`[${correlationId}] ❌ ALL CUSTOMERS FAILED SERIALIZATION`)
      return res.status(500).json({
        error: 'customers_list_failed',
        correlationId,
        message: 'All customers failed serialization',
        warnings
      })
    }
    
    return res.json(response)
    
  } catch (error: any) {
    // Top-level error (database, network, etc.)
    console.error(`[${correlationId}] ❌ CRITICAL ERROR in GET /api/customers:`, error.message)
    console.error(`[${correlationId}]    Stack:`, error.stack)
    return res.status(500).json({ 
      error: 'customers_list_failed',
      correlationId,
      message: error.message,
      stack: error.stack?.substring(0, 500)
    })
  }
})

// GET /api/customers/:id - Get a single customer with contacts
router.get('/:id', async (req, res) => {
  const correlationId = `cust_single_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`
  
  try {
    const { id } = req.params

    // PRODUCTION HOTFIX: ALWAYS use minimal safe select - schema drift prevents using include
    console.warn(`[${correlationId}] Using minimal safe fields only (production schema drift)`)
    
    const customer = await prisma.customer.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        domain: true,
        website: true,
        accountData: true,
        createdAt: true,
        updatedAt: true,
        customerContacts: {
          select: {
            id: true,
            customerId: true,
            name: true,
            email: true,
            phone: true,
            title: true,
            isPrimary: true,
            notes: true,
            createdAt: true,
            updatedAt: true,
          }
        },
      },
    }) as any

    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' })
    }

    console.log(`[${correlationId}] Serializing customer: ${customer.name} (${customer.id})`)

    // Use same normalization as list endpoint - handle schema drift
    const c = customer as any
    const serialized = {
      id: c.id,
      name: c.name,
      domain: c.domain || null,
      leadsReportingUrl: c.leadsReportingUrl || null,
      leadsGoogleSheetLabel: c.leadsGoogleSheetLabel || null,
      sector: c.sector || null,
      clientStatus: c.clientStatus || 'active',
      targetJobTitle: c.targetJobTitle || null,
      prospectingLocation: c.prospectingLocation || null,
      monthlyIntakeGBP: c.monthlyIntakeGBP ? String(c.monthlyIntakeGBP) : null,
      monthlyRevenueFromCustomer: c.monthlyRevenueFromCustomer ? String(c.monthlyRevenueFromCustomer) : null,
      defcon: c.defcon || null,
      weeklyLeadTarget: c.weeklyLeadTarget || null,
      weeklyLeadActual: c.weeklyLeadActual || null,
      monthlyLeadTarget: c.monthlyLeadTarget || null,
      monthlyLeadActual: c.monthlyLeadActual || null,
      website: c.website || null,
      whatTheyDo: c.whatTheyDo || null,
      accreditations: c.accreditations || null,
      keyLeaders: c.keyLeaders || null,
      companyProfile: c.companyProfile || null,
      recentNews: c.recentNews || null,
      companySize: c.companySize || null,
      headquarters: c.headquarters || null,
      foundingYear: c.foundingYear || null,
      socialPresence: c.socialPresence ? normalizeToJsonSafe(c.socialPresence) : null,
      lastEnrichedAt: c.lastEnrichedAt?.toISOString() || null,
      agreementFileUrl: c.agreementFileUrl || null,
      agreementFileName: c.agreementFileName || null,
      agreementFileMimeType: c.agreementFileMimeType || null,
      agreementUploadedAt: c.agreementUploadedAt?.toISOString() || null,
      agreementUploadedByEmail: c.agreementUploadedByEmail || null,
      accountData: c.accountData ? normalizeToJsonSafe(c.accountData) : null,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
      customerContacts: (c.customerContacts || []).map((contact: any) => ({
        id: contact.id,
        customerId: contact.customerId,
        name: contact.name,
        email: contact.email || null,
        phone: contact.phone || null,
        title: contact.title || null,
        isPrimary: contact.isPrimary || false,
        notes: contact.notes || null,
        createdAt: contact.createdAt.toISOString(),
        updatedAt: contact.updatedAt.toISOString(),
      })),
    }

    // Test serialization
    JSON.stringify(serialized)

    return res.json(serialized)
  } catch (error: any) {
    console.error(`[${correlationId}] Error fetching customer:`, error.message)
    console.error(`[${correlationId}] Stack:`, error.stack)
    return res.status(500).json({ 
      error: 'customer_fetch_failed',
      correlationId,
      message: error.message
    })
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
// UPDATED: Now uses Azure Blob Storage for durable file storage
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

    // Decode base64 data
    const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/)
    if (!match) {
      return res.status(400).json({ error: 'Invalid dataUrl format' })
    }

    const base64Data = match[2]
    const buffer = Buffer.from(base64Data, 'base64')

    // Validate file size (hard cap at 10MB decoded file size)
    const MAX_FILE_SIZE_MB = 10
    const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024
    const fileSizeMB = (buffer.length / 1024 / 1024).toFixed(2)
    
    if (buffer.length > MAX_FILE_SIZE_BYTES) {
      return res.status(413).json({ 
        error: 'agreement_too_large',
        message: `File size (${fileSizeMB}MB) exceeds maximum allowed size of ${MAX_FILE_SIZE_MB}MB`,
        maxMb: MAX_FILE_SIZE_MB,
        actualMb: parseFloat(fileSizeMB)
      })
    }

    // Upload to Azure Blob Storage (replaces local filesystem storage)
    const { uploadAgreement, generateAgreementBlobName } = await import('../utils/blobUpload.js')
    const blobName = generateAgreementBlobName(id, fileName)
    
    const uploadResult = await uploadAgreement({
      buffer,
      contentType: mimeType,
      blobName
    })

    // Store blob reference (not direct URL - use SAS for access)
    const containerName = process.env.AZURE_STORAGE_CONTAINER_AGREEMENTS || 'customer-agreements'

    // Log agreement upload details for verification
    console.log(`[agreement] customerId=${id} container=${containerName} blobName=${blobName} size=${buffer.length}`)

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
        // Store blob reference for SAS generation (NEW - REQUIRED)
        agreementBlobName: blobName,
        agreementContainerName: containerName,
        // Legacy URL kept for backward compatibility (not used for access)
        agreementFileUrl: null,
        // Metadata
        agreementFileName: fileName,
        agreementFileMimeType: mimeType,
        agreementUploadedAt: new Date(),
        agreementUploadedByEmail: actorEmail,
        // Progress tracker
        accountData: updatedAccountData,
        updatedAt: new Date()
      },
      select: {
        id: true,
        name: true,
        agreementBlobName: true,
        agreementContainerName: true,
        agreementFileName: true,
        agreementFileMimeType: true,
        agreementUploadedAt: true,
        agreementUploadedByEmail: true,
        accountData: true
      }
    })

    console.log(`✅ Agreement uploaded for customer ${customer.name} (${id})`)
    console.log(`   File: ${fileName}`)
    console.log(`   Blob: ${containerName}/${blobName}`)
    console.log(`   Progress tracker updated: sales_contract_signed = true`)

    return res.status(201).json({
      success: true,
      agreement: {
        fileName: updatedCustomer.agreementFileName,
        blobName: updatedCustomer.agreementBlobName,
        containerName: updatedCustomer.agreementContainerName,
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

// GET /api/customers/:id/agreement-download - Generate SAS URL for agreement download
// Returns a short-lived (15 min) SAS URL for accessing the agreement blob
router.get('/:id/agreement-download', async (req, res) => {
  try {
    const { id } = req.params

    // Validate customer exists and has agreement
    const customer = await prisma.customer.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        agreementBlobName: true,
        agreementContainerName: true,
        agreementFileName: true,
        agreementFileMimeType: true,
        agreementFileUrl: true, // Legacy field for backward compatibility
      }
    })

    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' })
    }

    // Check for blob-based agreement (new format)
    if (customer.agreementBlobName && customer.agreementContainerName) {
      // Generate SAS URL for blob access
      const { generateAgreementSasUrl } = await import('../utils/blobSas.js')
      
      const sasResult = await generateAgreementSasUrl({
        containerName: customer.agreementContainerName,
        blobName: customer.agreementBlobName,
        ttlMinutes: 15
      })

      console.log(`[agreement-download] Generated SAS for customer ${id}: ${customer.agreementFileName}`)

      return res.status(200).json({
        url: sasResult.url,
        fileName: customer.agreementFileName || 'agreement.pdf',
        mimeType: customer.agreementFileMimeType || 'application/pdf',
        expiresAt: sasResult.expiresAt.toISOString()
      })
    }

    // Legacy: Try to parse blobName from agreementFileUrl if available
    if (customer.agreementFileUrl) {
      const urlMatch = customer.agreementFileUrl.match(/\/([^\/]+)\/([^\/\?]+)(?:\?|$)/)
      if (urlMatch) {
        const containerName = urlMatch[1]
        const blobName = decodeURIComponent(urlMatch[2])

        // Backfill blob fields in database for future requests
        await prisma.customer.update({
          where: { id },
          data: {
            agreementBlobName: blobName,
            agreementContainerName: containerName
          }
        })

        console.log(`[agreement-download] Backfilled blob fields for customer ${id} from legacy URL`)

        // Generate SAS URL
        const { generateAgreementSasUrl } = await import('../utils/blobSas.js')
        const sasResult = await generateAgreementSasUrl({
          containerName,
          blobName,
          ttlMinutes: 15
        })

        return res.status(200).json({
          url: sasResult.url,
          fileName: customer.agreementFileName || 'agreement.pdf',
          mimeType: customer.agreementFileMimeType || 'application/pdf',
          expiresAt: sasResult.expiresAt.toISOString()
        })
      }

      // Legacy local filesystem URL (/uploads/)
      if (customer.agreementFileUrl.includes('/uploads/')) {
        return res.status(410).json({
          error: 'legacy_file_unavailable',
          message: 'Agreement file is stored in legacy format and unavailable. Please re-upload.'
        })
      }
    }

    // No agreement found
    return res.status(404).json({
      error: 'no_agreement',
      message: 'No agreement uploaded for this customer'
    })

  } catch (error) {
    console.error('Error generating agreement download URL:', error)
    return res.status(500).json({
      error: 'Failed to generate download URL',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
})

export default router