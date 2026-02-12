// @ts-nocheck
/**
 * Customers/Clients Management API
 * Ported from OpensDoorsV2 clients/actions.ts
 */

import { Router } from 'express'
import { z } from 'zod'
import multer from 'multer'
import * as XLSX from 'xlsx'
import { prisma } from '../lib/prisma.js'
import { getActorIdentity } from '../utils/auth.js'
import { safeCustomerAuditEvent, safeCustomerAuditEventBulk } from '../utils/audit.js'

const router = Router()

// Shared attachment constraints (match Agreement upload)
const ALLOWED_DOC_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]

const MAX_ATTACHMENT_FILE_SIZE_MB = 10
const MAX_ATTACHMENT_FILE_SIZE_BYTES = MAX_ATTACHMENT_FILE_SIZE_MB * 1024 * 1024

const attachmentsUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_ATTACHMENT_FILE_SIZE_BYTES },
})

// Suppression list upload constraints (DNC)
const MAX_SUPPRESSION_FILE_SIZE_MB = 15
const MAX_SUPPRESSION_FILE_SIZE_BYTES = MAX_SUPPRESSION_FILE_SIZE_MB * 1024 * 1024
const suppressionUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_SUPPRESSION_FILE_SIZE_BYTES },
})

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
 * Query params:
 * - includeArchived: "true" to include archived customers (default: false)
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
    // Check if archived customers should be included
    const includeArchived = req.query.includeArchived === 'true'
    
    console.log(`[${correlationId}] Starting customers fetch... (includeArchived: ${includeArchived})`)
    
    // Build where clause - exclude archived by default
    const whereClause = includeArchived ? {} : { isArchived: false }
    
    const customers = await prisma.customer.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        domain: true,
        website: true,
        accountData: true,
        createdAt: true,
        updatedAt: true,
        // Archive fields
        isArchived: true,
        archivedAt: true,
        archivedByEmail: true,
        // Business details
        leadsReportingUrl: true,
        leadsGoogleSheetLabel: true,
        sector: true,
        clientStatus: true,
        targetJobTitle: true,
        prospectingLocation: true,
        // Financial
        monthlyIntakeGBP: true,
        monthlyRevenueFromCustomer: true,
        defcon: true,
        // Lead targets
        weeklyLeadTarget: true,
        weeklyLeadActual: true,
        monthlyLeadTarget: true,
        monthlyLeadActual: true,
        // About section
        whatTheyDo: true,
        accreditations: true,
        keyLeaders: true,
        companyProfile: true,
        recentNews: true,
        companySize: true,
        headquarters: true,
        foundingYear: true,
        socialPresence: true,
        lastEnrichedAt: true,
        // Agreement fields (Phase 2 Item 4)
        agreementBlobName: true,
        agreementContainerName: true,
        agreementFileName: true,
        agreementFileMimeType: true,
        agreementUploadedAt: true,
        agreementUploadedByEmail: true,
        agreementFileUrl: true, // Legacy field
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
        
        // Normalize to JSON-safe primitives
        const c = customer as any
        const normalized = {
          id: c.id,
          name: c.name,
          domain: c.domain || null,
          // Archive fields
          isArchived: c.isArchived || false,
          archivedAt: c.archivedAt?.toISOString() || null,
          archivedByEmail: c.archivedByEmail || null,
          // Business details
          leadsReportingUrl: c.leadsReportingUrl || null,
          leadsGoogleSheetLabel: c.leadsGoogleSheetLabel || null,
          sector: c.sector || null,
          clientStatus: c.clientStatus || 'active',
          targetJobTitle: c.targetJobTitle || null,
          prospectingLocation: c.prospectingLocation || null,
          // Financial
          monthlyIntakeGBP: c.monthlyIntakeGBP ? String(c.monthlyIntakeGBP) : null,
          monthlyRevenueFromCustomer: c.monthlyRevenueFromCustomer ? String(c.monthlyRevenueFromCustomer) : null,
          defcon: c.defcon || null,
          // Lead targets
          weeklyLeadTarget: c.weeklyLeadTarget || null,
          weeklyLeadActual: c.weeklyLeadActual || null,
          monthlyLeadTarget: c.monthlyLeadTarget || null,
          monthlyLeadActual: c.monthlyLeadActual || null,
          // About section
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
          // Agreement
          agreementFileUrl: c.agreementFileUrl || null,
          agreementFileName: c.agreementFileName || null,
          agreementFileMimeType: c.agreementFileMimeType || null,
          agreementUploadedAt: c.agreementUploadedAt?.toISOString() || null,
          agreementUploadedByEmail: c.agreementUploadedByEmail || null,
          agreementBlobName: c.agreementBlobName || null,
          agreementContainerName: c.agreementContainerName || null,
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

    console.log(`[${correlationId}] Fetching customer: ${id}`)
    
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
        // Archive fields
        isArchived: true,
        archivedAt: true,
        archivedByEmail: true,
        // Business details
        leadsReportingUrl: true,
        leadsGoogleSheetLabel: true,
        sector: true,
        clientStatus: true,
        targetJobTitle: true,
        prospectingLocation: true,
        // Financial
        monthlyIntakeGBP: true,
        monthlyRevenueFromCustomer: true,
        defcon: true,
        // Lead targets
        weeklyLeadTarget: true,
        weeklyLeadActual: true,
        monthlyLeadTarget: true,
        monthlyLeadActual: true,
        // About section
        whatTheyDo: true,
        accreditations: true,
        keyLeaders: true,
        companyProfile: true,
        recentNews: true,
        companySize: true,
        headquarters: true,
        foundingYear: true,
        socialPresence: true,
        lastEnrichedAt: true,
        // Agreement fields (Phase 2 Item 4)
        agreementBlobName: true,
        agreementContainerName: true,
        agreementFileName: true,
        agreementFileMimeType: true,
        agreementUploadedAt: true,
        agreementUploadedByEmail: true,
        agreementFileUrl: true, // Legacy field
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

    // Normalize to JSON-safe
    const c = customer as any
    const serialized = {
      id: c.id,
      name: c.name,
      domain: c.domain || null,
      // Archive fields
      isArchived: c.isArchived || false,
      archivedAt: c.archivedAt?.toISOString() || null,
      archivedByEmail: c.archivedByEmail || null,
      // Business details
      leadsReportingUrl: c.leadsReportingUrl || null,
      leadsGoogleSheetLabel: c.leadsGoogleSheetLabel || null,
      sector: c.sector || null,
      clientStatus: c.clientStatus || 'active',
      targetJobTitle: c.targetJobTitle || null,
      prospectingLocation: c.prospectingLocation || null,
      // Financial
      monthlyIntakeGBP: c.monthlyIntakeGBP ? String(c.monthlyIntakeGBP) : null,
      monthlyRevenueFromCustomer: c.monthlyRevenueFromCustomer ? String(c.monthlyRevenueFromCustomer) : null,
      defcon: c.defcon || null,
      // Lead targets
      weeklyLeadTarget: c.weeklyLeadTarget || null,
      weeklyLeadActual: c.weeklyLeadActual || null,
      monthlyLeadTarget: c.monthlyLeadTarget || null,
      monthlyLeadActual: c.monthlyLeadActual || null,
      // About section
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
      // Agreement
      agreementFileUrl: c.agreementFileUrl || null,
      agreementFileName: c.agreementFileName || null,
      agreementFileMimeType: c.agreementFileMimeType || null,
      agreementUploadedAt: c.agreementUploadedAt?.toISOString() || null,
      agreementUploadedByEmail: c.agreementUploadedByEmail || null,
      agreementBlobName: c.agreementBlobName || null,
      agreementContainerName: c.agreementContainerName || null,
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

    // Include assigned account manager user (from User Authorization) when possible.
    // This is a computed join (no FK in schema), driven by onboarding's assignedAccountManagerId in accountData.
    try {
      const ad: any = serialized.accountData && typeof serialized.accountData === 'object' ? serialized.accountData : null
      const managerId =
        typeof ad?.accountDetails?.assignedAccountManagerId === 'string'
          ? ad.accountDetails.assignedAccountManagerId
          : typeof ad?.assignedAccountManagerId === 'string'
            ? ad.assignedAccountManagerId
            : null

      if (managerId) {
        const user = await prisma.user.findUnique({
          where: { id: managerId },
          select: {
            id: true,
            userId: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true,
            department: true,
            accountStatus: true,
          },
        })
        if (user) {
          ;(serialized as any).assignedAccountManagerUser = user
        }
      }
    } catch (err) {
      console.warn(`[${correlationId}] assignedAccountManagerUser lookup failed`, err)
    }

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
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`
  
  try {
    console.log(`[${requestId}] POST /api/customers - Creating customer`)
    console.log(`[${requestId}] Request body:`, { name: req.body.name, domain: req.body.domain, clientStatus: req.body.clientStatus })
    
    // Validate with detailed error reporting
    const validationResult = upsertCustomerSchema.safeParse(req.body)
    if (!validationResult.success) {
      const firstError = validationResult.error.errors[0]
      const errorMessage = firstError 
        ? `${firstError.path.join('.')}: ${firstError.message}`
        : 'Invalid input'
      
      console.error(`[${requestId}] Validation failed:`, validationResult.error.errors)
      console.error(`[create_customer_failed] requestId=${requestId} prismaCode=none message="${errorMessage}" meta={}`)
      
      return res.status(400).json({ 
        error: 'validation_failed',
        message: errorMessage,
        details: validationResult.error.errors,
        requestId
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

    console.log(`[${requestId}] ✅ Customer created successfully:`, { id: customer.id, name: customer.name })
    
    return res.status(201).json({
      id: customer.id,
      name: customer.name,
      requestId
    })
  } catch (error: any) {
    // CRITICAL: Log one structured line for production debugging
    console.error(`[create_customer_failed] requestId=${requestId} prismaCode=${error.code || 'none'} message="${error.message}" meta=${JSON.stringify(error.meta || {})}`)
    
    // Handle Zod validation errors
    if (error instanceof z.ZodError) {
      const firstError = error.errors[0]
      const fieldPath = firstError?.path?.join('.') || 'input'
      const fieldMessage = firstError?.message || 'Invalid'
      
      return res.status(400).json({ 
        error: 'validation_failed',
        message: `${fieldPath}: ${fieldMessage}`,
        details: error.errors,
        requestId
      })
    }
    
    // Handle Prisma unique constraint violation (P2002)
    if (error.code === 'P2002') {
      const fields = error.meta?.target || ['unknown field']
      return res.status(409).json({
        error: 'customer_exists',
        message: `Customer already exists (unique constraint on ${fields.join(', ')})`,
        details: `A customer with this ${fields.join('/')} already exists in the database`,
        prismaCode: error.code,
        meta: { conflictingFields: fields },
        requestId
      })
    }
    
    // Handle Prisma foreign key constraint (P2003)
    if (error.code === 'P2003') {
      return res.status(400).json({
        error: 'invalid_reference',
        message: 'Invalid reference: Related record does not exist',
        details: error.meta?.field_name || 'foreign key constraint failed',
        prismaCode: error.code,
        requestId
      })
    }
    
    // Handle Prisma record not found (P2025)
    if (error.code === 'P2025') {
      return res.status(404).json({
        error: 'not_found',
        message: 'Record not found',
        details: error.meta?.cause || 'Required record does not exist',
        prismaCode: error.code,
        requestId
      })
    }
    
    // Handle other Prisma errors
    if (error.code?.startsWith('P')) {
      return res.status(500).json({
        error: 'database_error',
        message: `Database error (${error.code}): ${error.message}`,
        details: error.message,
        prismaCode: error.code,
        meta: error.meta,
        requestId
      })
    }
    
    // Generic server error
    return res.status(500).json({ 
      error: 'server_error',
      message: error.message || 'Failed to create customer. Please try again or contact support.',
      details: error.stack?.substring(0, 300),
      requestId
    })
  }
})

// PUT /api/customers/:id/onboarding - Save onboarding payload (single transaction)
// Payload shape:
// {
//   customer: { ...same shape as PUT /api/customers/:id ... },
//   contacts?: [{ id?, name, email?, phone?, title?, isPrimary? }]
// }
//
// NOTE: This reuses the existing customer + customer_contacts models only (no new tables).
router.put('/:id/onboarding', async (req, res) => {
  try {
    const { id } = req.params

    const normalizeEmail = (value: unknown): string | null => {
      if (typeof value !== 'string') return null
      const trimmed = value.trim().toLowerCase()
      return trimmed ? trimmed : null
    }

    const onboardingSchema = z
      .object({
        customer: upsertCustomerSchema,
        contacts: z
          .array(
            upsertCustomerContactSchema
              .omit({ customerId: true })
              .extend({ id: z.string().optional() }),
          )
          .optional(),
      })
      .superRefine((value, ctx) => {
        const contacts = value.contacts || []
        const primaryCount = contacts.filter((c) => c.isPrimary).length
        if (primaryCount > 1) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['contacts'],
            message: 'Only one contact can be primary per customer',
          })
        }
      })

    const parsed = onboardingSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid input', details: parsed.error.errors })
    }

    const validated = parsed.data.customer
    const contacts = parsed.data.contacts || []

    // Strict-ish validation for contacts: require name, and at least one of email/phone.
    for (const contact of contacts) {
      if (!contact.name || !String(contact.name).trim()) {
        return res.status(400).json({ error: 'Invalid input', details: [{ message: 'contacts[].name is required' }] })
      }
      const normalizedEmail = normalizeEmail(contact.email)
      const phone = typeof contact.phone === 'string' ? contact.phone.trim() : ''
      if (!normalizedEmail && !phone) {
        return res.status(400).json({
          error: 'Invalid input',
          details: [{ message: 'contacts[] must include at least email or phone' }],
        })
      }
    }

    const shouldClearLeads = validated.leadsReportingUrl === null
    const updateData: any = {
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

    const saved = await prisma.$transaction(async (tx) => {
      // Lock parent row to keep primary-contact demotion atomic in high concurrency cases.
      await tx.$queryRaw`SELECT "id" FROM "customers" WHERE "id" = ${id} FOR UPDATE`

      const existing = await tx.customer.findUnique({
        where: { id },
        select: { id: true, accountData: true },
      })
      if (!existing) {
        const err: any = new Error('not_found')
        err.statusCode = 404
        throw err
      }

      // Merge accountData safely to avoid overwriting notes (append-only via /api/customers/:id/notes).
      const existingAccountData =
        existing.accountData && typeof existing.accountData === 'object' ? (existing.accountData as any) : {}
      const incomingAccountData =
        validated.accountData && typeof validated.accountData === 'object' ? (validated.accountData as any) : {}
      const mergedAccountData: any = {
        ...existingAccountData,
        ...incomingAccountData,
      }
      if (incomingAccountData.notes === undefined && existingAccountData.notes !== undefined) {
        mergedAccountData.notes = existingAccountData.notes
      }

      updateData.accountData = mergedAccountData

      const updatedCustomer = await tx.customer.update({
        where: { id },
        data: updateData,
      })

      // Persist primary contact from onboarding snapshot into customer_contacts (same canonical store the UI reads).
      const primary = mergedAccountData?.accountDetails?.primaryContact
      const primaryId = typeof primary?.id === 'string' ? primary.id : null
      const firstName = typeof primary?.firstName === 'string' ? primary.firstName : ''
      const lastName = typeof primary?.lastName === 'string' ? primary.lastName : ''
      const fullName = `${firstName} ${lastName}`.trim()

      if (primaryId && fullName) {
        await tx.customerContact.updateMany({
          where: { customerId: id, isPrimary: true, id: { not: primaryId } },
          data: { isPrimary: false },
        })

        await tx.customerContact.upsert({
          where: { id: primaryId },
          create: {
            id: primaryId,
            customerId: id,
            name: fullName,
            email: normalizeEmail(primary?.email),
            phone: typeof primary?.phone === 'string' ? primary.phone : null,
            title: typeof primary?.roleLabel === 'string' ? primary.roleLabel : null,
            isPrimary: true,
          },
          update: {
            customerId: id,
            name: fullName,
            email: normalizeEmail(primary?.email),
            phone: typeof primary?.phone === 'string' ? primary.phone : null,
            title: typeof primary?.roleLabel === 'string' ? primary.roleLabel : null,
            isPrimary: true,
          },
        })
      }

      // Optional: upsert additional contacts passed by onboarding
      for (const contact of contacts) {
        let savedContactId: string | null = null
        const normalizedEmail = normalizeEmail(contact.email)

        if (contact.id) {
          const upserted = await tx.customerContact.upsert({
            where: { id: contact.id },
            create: {
              id: contact.id,
              customerId: id,
              name: contact.name,
              email: normalizedEmail,
              phone: contact.phone ?? null,
              title: contact.title ?? null,
              isPrimary: Boolean(contact.isPrimary),
              notes: contact.notes ?? null,
            },
            update: {
              customerId: id,
              name: contact.name,
              email: normalizedEmail,
              phone: contact.phone ?? null,
              title: contact.title ?? null,
              isPrimary: Boolean(contact.isPrimary),
              notes: contact.notes ?? null,
            },
          })
          savedContactId = upserted.id
        } else {
          const created = await tx.customerContact.create({
            data: {
              customerId: id,
              name: contact.name,
              email: normalizedEmail,
              phone: contact.phone ?? null,
              title: contact.title ?? null,
              isPrimary: Boolean(contact.isPrimary),
              notes: contact.notes ?? null,
            },
          })
          savedContactId = created.id
        }

        if (contact.isPrimary && savedContactId) {
          await tx.customerContact.updateMany({
            where: { customerId: id, isPrimary: true, id: { not: savedContactId } },
            data: { isPrimary: false },
          })
        }
      }

      const hydrated = await tx.customer.findUnique({
        where: { id },
        include: { customerContacts: true },
      })

      const managerId =
        typeof mergedAccountData?.accountDetails?.assignedAccountManagerId === 'string'
          ? mergedAccountData.accountDetails.assignedAccountManagerId
          : typeof mergedAccountData?.assignedAccountManagerId === 'string'
            ? mergedAccountData.assignedAccountManagerId
            : null

      const assignedAccountManagerUser = managerId
        ? await tx.user.findUnique({
            where: { id: managerId },
            select: {
              id: true,
              userId: true,
              firstName: true,
              lastName: true,
              email: true,
              role: true,
              department: true,
              accountStatus: true,
            },
          })
        : null

      return { updatedCustomer, hydrated, assignedAccountManagerUser }
    })

    const responseCustomer: any = saved.hydrated ?? saved.updatedCustomer
    if (saved.assignedAccountManagerUser) {
      responseCustomer.assignedAccountManagerUser = saved.assignedAccountManagerUser
    }
    return res.json({ success: true, customer: responseCustomer })
  } catch (error: any) {
    console.error('Error saving onboarding payload:', error)
    if (error?.statusCode === 404 || error?.message === 'not_found') {
      return res.status(404).json({ error: 'not_found', message: 'Customer not found' })
    }
    return res.status(500).json({ error: 'Failed to save onboarding', message: error.message })
  }
})

// POST /api/customers/:id/notes - Append a note atomically without overwriting accountData
router.post('/:id/notes', async (req, res) => {
  try {
    const { id } = req.params

    const bodySchema = z.object({
      content: z.string().min(1),
      userId: z.string().min(1),
      userEmail: z.string().email().optional(),
    })
    const parsed = bodySchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid input', details: parsed.error.errors })
    }

    const content = parsed.data.content.trim()
    const userId = parsed.data.userId
    const userEmail = parsed.data.userEmail ? parsed.data.userEmail.trim().toLowerCase() : null

    const result = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "customers" WHERE "id" = ${id} FOR UPDATE`

      const customer = await tx.customer.findUnique({
        where: { id },
        select: { id: true, accountData: true },
      })
      if (!customer) {
        const err: any = new Error('not_found')
        err.statusCode = 404
        throw err
      }

      // Verify user exists (link to User Authorization)
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { id: true, firstName: true, lastName: true, email: true },
      })
      if (!user) {
        return { status: 400 as const, body: { error: 'invalid_user', message: 'User not found' } }
      }

      const accountData = customer.accountData && typeof customer.accountData === 'object' ? (customer.accountData as any) : {}
      const existingNotes = Array.isArray(accountData.notes) ? accountData.notes : []

      const note = {
        id: `note_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        content,
        user: `${user.firstName} ${user.lastName}`.trim() || user.email,
        userId: user.id,
        userEmail: userEmail || user.email,
        timestamp: new Date().toISOString(),
      }

      const notes = [note, ...existingNotes]
      const nextAccountData = { ...accountData, notes }

      await tx.customer.update({
        where: { id },
        data: { accountData: nextAccountData, updatedAt: new Date() },
      })

      return { status: 200 as const, body: { success: true, note, notes } }
    })

    return res.status(result.status).json(result.body)
  } catch (error: any) {
    if (error?.statusCode === 404 || error?.message === 'not_found') {
      return res.status(404).json({ error: 'not_found', message: 'Customer not found' })
    }
    console.error('Error appending customer note:', error)
    return res.status(500).json({ error: 'Failed to add note' })
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

      // ----------------------------------------------------------------------
      // Onboarding wiring: persist primary contact into CustomerContact table
      //
      // The onboarding UI stores primaryContact inside accountData.accountDetails.
      // Customer detail views (and reporting) expect real rows in customer_contacts.
      // Keep this best-effort and idempotent (upsert by provided primaryContact.id).
      // ----------------------------------------------------------------------
      try {
        const accountData = validated.accountData as any
        const primary = accountData?.accountDetails?.primaryContact
        const primaryId = typeof primary?.id === 'string' ? primary.id : null
        const firstName = typeof primary?.firstName === 'string' ? primary.firstName : ''
        const lastName = typeof primary?.lastName === 'string' ? primary.lastName : ''
        const fullName = `${firstName} ${lastName}`.trim()

        if (primaryId && fullName) {
          // Ensure only one primary per customer
          await tx.customerContact.updateMany({
            where: { customerId: id, isPrimary: true, id: { not: primaryId } },
            data: { isPrimary: false },
          })

          await tx.customerContact.upsert({
            where: { id: primaryId },
            create: {
              id: primaryId,
              customerId: id,
              name: fullName,
              email: typeof primary?.email === 'string' ? primary.email : null,
              phone: typeof primary?.phone === 'string' ? primary.phone : null,
              title: typeof primary?.roleLabel === 'string' ? primary.roleLabel : null,
              isPrimary: true,
            },
            update: {
              customerId: id,
              name: fullName,
              email: typeof primary?.email === 'string' ? primary.email : null,
              phone: typeof primary?.phone === 'string' ? primary.phone : null,
              title: typeof primary?.roleLabel === 'string' ? primary.roleLabel : null,
              isPrimary: true,
            },
          })
        }
      } catch (contactSyncErr: any) {
        console.warn('[PUT /api/customers/:id] Primary contact sync failed (non-fatal):', contactSyncErr?.message || contactSyncErr)
      }

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

// DELETE /api/customers/:id - Archive a customer (SOFT DELETE - preserves all data)
// CRITICAL: We NEVER hard-delete customers. This archives them instead.
// All contacts, sequences, campaigns, and analytics data remain intact.
router.delete('/:id', async (req, res) => {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`
  const { id } = req.params
  
  console.log(`[${requestId}] DELETE /api/customers/${id} - Archiving customer (soft-delete)`)
  
  try {
    // Verify customer exists and is not already archived
    // Include clientStatus for audit event (must be valid ClientStatus enum)
    const customer = await prisma.customer.findUnique({
      where: { id },
      select: { id: true, name: true, isArchived: true, clientStatus: true }
    })
    
    if (!customer) {
      return res.status(404).json({
        error: 'not_found',
        message: 'Customer not found',
        details: `No customer exists with ID: ${id}`,
        requestId
      })
    }
    
    if (customer.isArchived) {
      return res.status(409).json({
        error: 'already_archived',
        message: 'Customer is already archived',
        details: `Customer "${customer.name}" was previously archived`,
        requestId
      })
    }
    
    // Get actor identity for audit trail
    const actor = getActorIdentity(req)
    
    // Count related records for informational logging (we preserve them all)
    const [contactsCount, customerContactsCount, campaignsCount, listsCount, sequencesCount] = await Promise.all([
      prisma.contact.count({ where: { customerId: id } }),
      prisma.customerContact.count({ where: { customerId: id } }),
      prisma.emailCampaign.count({ where: { customerId: id } }),
      prisma.contactList.count({ where: { customerId: id } }),
      prisma.emailSequence.count({ where: { customerId: id } }),
    ])
    
    const totalContacts = contactsCount + customerContactsCount
    
    // SOFT DELETE: Archive the customer (preserves ALL related data)
    const archivedCustomer = await prisma.customer.update({
      where: { id },
      data: {
        isArchived: true,
        archivedAt: new Date(),
        archivedByEmail: actor.email || null,
        updatedAt: new Date()
      }
    })
    
    // Audit logging is best-effort - NEVER blocks archive success
    const auditResult = await safeCustomerAuditEvent({
      prisma,
      customerId: id,
      action: 'archive',
      actorUserId: actor.userId,
      actorEmail: actor.email,
      customerStatus: customer.clientStatus, // Will be sanitized by helper
      metadata: {
        customerName: customer.name,
        archiveAction: 'soft-delete',
        archivedAt: new Date().toISOString(),
        wasArchived: false,
        isNowArchived: true,
        preservedData: {
          contacts: totalContacts,
          campaigns: campaignsCount,
          lists: listsCount,
          sequences: sequencesCount
        },
        authSource: actor.source
      },
      requestId
    })

    console.log(`[${requestId}] ✅ Customer archived successfully: ${customer.name} (${id})`)
    console.log(`[${requestId}]    Preserved: ${totalContacts} contacts, ${campaignsCount} campaigns, ${listsCount} lists, ${sequencesCount} sequences`)
    
    return res.json({ 
      success: true, 
      archived: true,
      auditLogged: auditResult.success,
      ...(auditResult.error && { auditError: 'Audit logging failed' }), // Don't leak Prisma details
      customer: {
        id: archivedCustomer.id,
        name: archivedCustomer.name,
        isArchived: true,
        status: archivedCustomer.clientStatus,
        archivedAt: archivedCustomer.archivedAt?.toISOString(),
        archivedByEmail: archivedCustomer.archivedByEmail
      },
      preservedData: {
        contacts: totalContacts,
        campaigns: campaignsCount,
        lists: listsCount,
        sequences: sequencesCount
      },
      requestId 
    })
  } catch (error: any) {
    // CRITICAL: Log one structured line for production debugging
    console.error(`[archive_customer_failed] requestId=${requestId} customerId=${id} prismaCode=${error.code || 'none'} message="${error.message}" meta=${JSON.stringify(error.meta || {})}`)
    
    // Handle Prisma P2025 (record not found)
    if (error.code === 'P2025') {
      return res.status(404).json({
        error: 'not_found',
        message: 'Customer not found',
        details: `No customer exists with ID: ${id}`,
        prismaCode: error.code,
        requestId
      })
    }
    
    // Handle other Prisma errors
    if (error.code?.startsWith('P')) {
      return res.status(500).json({
        error: 'database_error',
        message: `Database error (${error.code}): ${error.message}`,
        details: error.message,
        prismaCode: error.code,
        meta: error.meta,
        requestId
      })
    }
    
    // Generic server error
    return res.status(500).json({ 
      error: 'server_error',
      message: error.message || 'Failed to archive customer',
      details: error.stack?.substring(0, 300),
      requestId
    })
  }
})

// POST /api/customers/:id/unarchive - Restore an archived customer
// ADMIN CONTROL: Brings customer back to active state, preserving all data
router.post('/:id/unarchive', async (req, res) => {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`
  const { id } = req.params
  
  console.log(`[${requestId}] POST /api/customers/${id}/unarchive - Restoring customer`)
  
  try {
    // Verify customer exists and is archived
    // Include clientStatus for audit event (must be valid ClientStatus enum)
    const customer = await prisma.customer.findUnique({
      where: { id },
      select: { id: true, name: true, isArchived: true, archivedAt: true, clientStatus: true }
    })
    
    if (!customer) {
      return res.status(404).json({
        error: 'not_found',
        message: 'Customer not found',
        details: `No customer exists with ID: ${id}`,
        requestId
      })
    }
    
    if (!customer.isArchived) {
      return res.status(409).json({
        error: 'not_archived',
        message: 'Customer is not archived',
        details: `Customer "${customer.name}" is already active`,
        requestId
      })
    }
    
    // Get actor identity for audit trail
    const actor = getActorIdentity(req)
    
    // Restore the customer
    const restoredCustomer = await prisma.customer.update({
      where: { id },
      data: {
        isArchived: false,
        archivedAt: null,
        archivedByEmail: null,
        updatedAt: new Date()
      }
    })
    
    // Audit logging is best-effort - NEVER blocks unarchive success
    const auditResult = await safeCustomerAuditEvent({
      prisma,
      customerId: id,
      action: 'unarchive',
      actorUserId: actor.userId,
      actorEmail: actor.email,
      customerStatus: customer.clientStatus, // Will be sanitized by helper
      metadata: {
        customerName: customer.name,
        archiveAction: 'restore',
        unarchivedAt: new Date().toISOString(),
        wasArchived: true,
        isNowArchived: false,
        previouslyArchivedAt: customer.archivedAt?.toISOString(),
        authSource: actor.source
      },
      requestId
    })

    console.log(`[${requestId}] ✅ Customer unarchived successfully: ${customer.name} (${id})`)
    
    return res.json({ 
      success: true, 
      unarchived: true,
      auditLogged: auditResult.success,
      ...(auditResult.error && { auditError: 'Audit logging failed' }), // Don't leak Prisma details
      customer: {
        id: restoredCustomer.id,
        name: restoredCustomer.name,
        isArchived: restoredCustomer.isArchived,
        status: restoredCustomer.clientStatus
      },
      requestId 
    })
  } catch (error: any) {
    console.error(`[unarchive_customer_failed] requestId=${requestId} customerId=${id} prismaCode=${error.code || 'none'} message="${error.message}"`)
    
    if (error.code === 'P2025') {
      return res.status(404).json({
        error: 'not_found',
        message: 'Customer not found',
        prismaCode: error.code,
        requestId
      })
    }
    
    return res.status(500).json({ 
      error: 'server_error',
      message: error.message || 'Failed to unarchive customer',
      requestId
    })
  }
})

// POST /api/customers/archive-all - Archive ALL customers (clean slate)
// ADMIN CONTROL: Archives all non-archived customers, preserving all data
// WARNING: This is a bulk operation - use with caution
router.post('/archive-all', async (req, res) => {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`
  
  console.log(`[${requestId}] POST /api/customers/archive-all - BULK ARCHIVE`)
  
  try {
    // Get actor identity for audit trail
    const actor = getActorIdentity(req)
    
    // Find all non-archived customers (include clientStatus for audit events)
    const customersToArchive = await prisma.customer.findMany({
      where: { isArchived: false },
      select: { id: true, name: true, clientStatus: true }
    })
    
    if (customersToArchive.length === 0) {
      return res.json({
        success: true,
        archived: 0,
        message: 'No active customers to archive',
        requestId
      })
    }
    
    console.log(`[${requestId}] Archiving ${customersToArchive.length} customers...`)
    
    // Bulk archive all customers
    const archiveResult = await prisma.customer.updateMany({
      where: { isArchived: false },
      data: {
        isArchived: true,
        archivedAt: new Date(),
        archivedByEmail: actor.email || null,
        updatedAt: new Date()
      }
    })
    
    // Audit logging is best-effort - NEVER blocks bulk archive success
    const auditResult = await safeCustomerAuditEventBulk(
      prisma,
      customersToArchive.map(customer => ({
        customerId: customer.id,
        action: 'archive_bulk',
        actorUserId: actor.userId,
        actorEmail: actor.email,
        customerStatus: customer.clientStatus, // Will be sanitized by helper
        metadata: {
          customerName: customer.name,
          archiveAction: 'bulk-archive',
          archivedAt: new Date().toISOString(),
          wasArchived: false,
          isNowArchived: true,
          bulkOperation: true,
          totalInBatch: customersToArchive.length,
          authSource: actor.source
        }
      })),
      requestId
    )

    console.log(`[${requestId}] ✅ Bulk archive complete: ${archiveResult.count} customers archived`)
    
    return res.json({ 
      success: true, 
      archived: archiveResult.count,
      auditLogged: auditResult.success,
      ...(auditResult.error && { auditError: 'Audit logging failed' }), // Don't leak Prisma details
      customers: customersToArchive.map(c => ({ id: c.id, name: c.name })),
      message: `Successfully archived ${archiveResult.count} customers. All data preserved.`,
      requestId 
    })
  } catch (error: any) {
    console.error(`[archive_all_failed] requestId=${requestId} prismaCode=${error.code || 'none'} message="${error.message}"`)
    
    return res.status(500).json({ 
      error: 'server_error',
      message: error.message || 'Failed to archive customers',
      requestId
    })
  }
})

// POST /api/customers/:id/contacts - Add a contact to customer
router.post('/:id/contacts', async (req, res) => {
  try {
    const { id } = req.params
    const validated = upsertCustomerContactSchema.parse({ ...req.body, customerId: id })

    // Allow caller-provided IDs (useful for onboarding primaryContact wiring),
    // otherwise generate one. Use upsert to make this endpoint idempotent.
    const contactId = validated.id || `contact_${Date.now()}_${Math.random().toString(36).substring(7)}`

    const contact = await prisma.$transaction(async (tx) => {
      // Serialize primary-contact changes per customer (prevents double-primary races).
      // No schema change required: row lock on the parent customer record.
      await tx.$queryRaw`SELECT "id" FROM "customers" WHERE "id" = ${validated.customerId} FOR UPDATE`

      // Safety: if contactId already exists for a different customer, do NOT re-link it.
      const existing = await tx.customerContact.findUnique({
        where: { id: contactId },
        select: { id: true, customerId: true },
      })
      if (existing && existing.customerId !== validated.customerId) {
        // Conflict - this contact belongs to a different customer
        throw Object.assign(new Error('contact_id_conflict'), {
          statusCode: 409,
          details: `Contact id ${contactId} already exists for a different customer`,
        })
      }

      const upserted = await tx.customerContact.upsert({
        where: { id: contactId },
        create: {
          id: contactId,
          customerId: validated.customerId,
          name: validated.name,
          email: validated.email,
          phone: validated.phone,
          title: validated.title,
          isPrimary: validated.isPrimary || false,
          notes: validated.notes,
        },
        update: {
          customerId: validated.customerId,
          name: validated.name,
          email: validated.email,
          phone: validated.phone,
          title: validated.title,
          isPrimary: validated.isPrimary || false,
          notes: validated.notes,
        },
      })

      // If marking as primary, ensure all other contacts for this customer are non-primary.
      if (validated.isPrimary) {
        await tx.customerContact.updateMany({
          where: { customerId: validated.customerId, isPrimary: true, id: { not: upserted.id } },
          data: { isPrimary: false },
        })
      }

      return upserted
    })

    return res.status(201).json({
      id: contact.id,
      name: contact.name,
    })
  } catch (error) {
    // Local typed conflict (see above)
    if ((error as any)?.statusCode === 409) {
      return res.status(409).json({
        error: 'conflict',
        message: 'Contact id conflict',
        details: (error as any)?.details || 'Contact id already exists for another customer',
      })
    }
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
    const { customerId, contactId } = req.params
    const validated = upsertCustomerContactSchema.omit({ customerId: true }).parse(req.body)

    const contact = await prisma.$transaction(async (tx) => {
      // Serialize and enforce "single primary" per customer when updating.
      await tx.$queryRaw`SELECT "id" FROM "customers" WHERE "id" = ${customerId} FOR UPDATE`

      const existing = await tx.customerContact.findUnique({
        where: { id: contactId },
        select: { id: true, customerId: true },
      })

      if (!existing || existing.customerId !== customerId) {
        throw Object.assign(new Error('not_found'), { statusCode: 404 })
      }

      if (validated.isPrimary) {
        await tx.customerContact.updateMany({
          where: { customerId, isPrimary: true, id: { not: contactId } },
          data: { isPrimary: false },
        })
      }

      return await tx.customerContact.update({
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
    })

    return res.json({
      id: contact.id,
      name: contact.name,
    })
  } catch (error) {
    if ((error as any)?.statusCode === 404) {
      return res.status(404).json({ error: 'not_found', message: 'Contact not found for this customer' })
    }
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
    const { customerId, contactId } = req.params

    // Safety: ensure the contact belongs to the customer (prevents cross-customer deletion)
    const result = await prisma.customerContact.deleteMany({
      where: { id: contactId, customerId },
    })

    if (result.count === 0) {
      return res.status(404).json({ error: 'not_found', message: 'Contact not found for this customer' })
    }

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

// PUT /api/customers/:id/onboarding-progress
// Stores customer-scoped onboarding progress in accountData.onboardingProgress (no migrations).
router.put('/:id/onboarding-progress', async (req, res) => {
  try {
    const { id } = req.params

    const stepSchema = z.object({
      complete: z.boolean(),
    })

    const bodySchema = z.object({
      steps: z
        .object({
          company: stepSchema.optional(),
          ownership: stepSchema.optional(),
          leadSource: stepSchema.optional(),
          documents: stepSchema.optional(),
          contacts: stepSchema.optional(),
          notes: stepSchema.optional(),
        })
        .partial()
        .optional(),
    })

    const parsed = bodySchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid input', details: parsed.error.errors })
    }

    const incomingSteps = parsed.data.steps || {}
    const hasAnyIncoming = Object.keys(incomingSteps).length > 0
    if (!hasAnyIncoming) {
      return res.status(400).json({ error: 'Invalid input', details: [{ message: 'steps is required' }] })
    }

    const actor = getActorIdentity(req)
    const updatedByUserId = (actor?.userId || actor?.email || 'unknown') as string

    const now = new Date()
    const nowIso = now.toISOString()

    const TOTAL_STEPS = ['company', 'ownership', 'leadSource', 'documents', 'contacts', 'notes'] as const

    const result = await prisma.$transaction(async (tx) => {
      // Concurrency safety: lock row for read-modify-write on accountData JSON.
      await tx.$queryRaw`SELECT "id" FROM "customers" WHERE "id" = ${id} FOR UPDATE`

      const existing = await tx.customer.findUnique({
        where: { id },
        select: { id: true, isArchived: true, accountData: true },
      })
      if (!existing) {
        const err: any = new Error('not_found')
        err.statusCode = 404
        throw err
      }
      if (existing.isArchived) {
        const err: any = new Error('archived')
        err.statusCode = 400
        throw err
      }

      const currentAccountData =
        existing.accountData && typeof existing.accountData === 'object' ? (existing.accountData as any) : {}

      const currentProgress =
        currentAccountData.onboardingProgress && typeof currentAccountData.onboardingProgress === 'object'
          ? (currentAccountData.onboardingProgress as any)
          : {}

      const currentSteps =
        currentProgress.steps && typeof currentProgress.steps === 'object' ? (currentProgress.steps as any) : {}

      const nextSteps: any = { ...currentSteps }

      // Deep-merge only the steps provided; stamp per-step updatedAt.
      for (const stepKey of Object.keys(incomingSteps)) {
        const incoming = (incomingSteps as any)[stepKey]
        if (!incoming || typeof incoming.complete !== 'boolean') continue
        nextSteps[stepKey] = {
          ...(currentSteps[stepKey] || {}),
          complete: incoming.complete,
          updatedAt: nowIso,
        }
      }

      const completedCount = TOTAL_STEPS.filter((k) => nextSteps[k]?.complete === true).length
      const percentComplete = Math.round((completedCount / TOTAL_STEPS.length) * 100)
      const isComplete = percentComplete === 100

      const nextProgress = {
        version: 1,
        updatedAt: nowIso,
        updatedByUserId,
        steps: {
          company: { complete: Boolean(nextSteps.company?.complete), updatedAt: nextSteps.company?.updatedAt || null },
          ownership: { complete: Boolean(nextSteps.ownership?.complete), updatedAt: nextSteps.ownership?.updatedAt || null },
          leadSource: { complete: Boolean(nextSteps.leadSource?.complete), updatedAt: nextSteps.leadSource?.updatedAt || null },
          documents: { complete: Boolean(nextSteps.documents?.complete), updatedAt: nextSteps.documents?.updatedAt || null },
          contacts: { complete: Boolean(nextSteps.contacts?.complete), updatedAt: nextSteps.contacts?.updatedAt || null },
          notes: { complete: Boolean(nextSteps.notes?.complete), updatedAt: nextSteps.notes?.updatedAt || null },
        },
        percentComplete,
        isComplete,
      }

      const nextAccountData = {
        ...currentAccountData,
        onboardingProgress: nextProgress,
      }

      await tx.customer.update({
        where: { id },
        data: { accountData: nextAccountData, updatedAt: new Date() },
      })

      // Best-effort audit (never blocks success)
      try {
        await safeCustomerAuditEvent(tx as any, {
          customerId: id,
          action: 'update_onboarding_progress',
          note: `Updated onboarding progress (${percentComplete}%)`,
          meta: { percentComplete, isComplete },
        })
      } catch {
        // ignore
      }

      return nextProgress
    })

    return res.status(200).json({ success: true, onboardingProgress: result })
  } catch (error: any) {
    if (error?.message === 'not_found' || error?.statusCode === 404) {
      return res.status(404).json({ error: 'Customer not found' })
    }
    if (error?.message === 'archived' || error?.statusCode === 400) {
      return res.status(400).json({ error: 'Customer is archived' })
    }
    console.error('Error updating onboarding progress:', error)
    return res.status(500).json({
      error: 'Failed to update onboarding progress',
      details: error instanceof Error ? error.message : 'Unknown error',
    })
  }
})

// PUT /api/customers/:id/progress-tracker
// Updates ONLY accountData.progressTracker (customer-scoped checklist) with safe merge + row lock.
router.put('/:id/progress-tracker', async (req, res) => {
  try {
    const { id } = req.params

    const bodySchema = z.object({
      group: z.enum(['sales', 'ops', 'am']),
      itemKey: z.string().min(1),
      checked: z.boolean(),
    })

    const parsed = bodySchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid input', details: parsed.error.errors })
    }

    const { group, itemKey, checked } = parsed.data

    const actor = getActorIdentity(req)
    const updatedByUserId = (actor?.userId || actor?.email || 'unknown') as string

    const result = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "customers" WHERE "id" = ${id} FOR UPDATE`

      const existing = await tx.customer.findUnique({
        where: { id },
        select: { id: true, isArchived: true, accountData: true },
      })
      if (!existing) {
        const err: any = new Error('not_found')
        err.statusCode = 404
        throw err
      }
      if (existing.isArchived) {
        const err: any = new Error('archived')
        err.statusCode = 400
        throw err
      }

      const currentAccountData =
        existing.accountData && typeof existing.accountData === 'object' ? (existing.accountData as any) : {}

      const currentProgressTracker =
        currentAccountData.progressTracker && typeof currentAccountData.progressTracker === 'object'
          ? (currentAccountData.progressTracker as any)
          : { sales: {}, ops: {}, am: {} }

      const nextProgressTracker = {
        ...currentProgressTracker,
        [group]: {
          ...(currentProgressTracker[group] || {}),
          [itemKey]: checked,
        },
        // Optional metadata (non-breaking): helps debugging without affecting UI contract
        updatedAt: new Date().toISOString(),
        updatedByUserId,
      }

      const nextAccountData = {
        ...currentAccountData,
        progressTracker: nextProgressTracker,
      }

      await tx.customer.update({
        where: { id },
        data: { accountData: nextAccountData, updatedAt: new Date() },
      })

      // Best-effort audit
      try {
        await safeCustomerAuditEvent(tx as any, {
          customerId: id,
          action: 'update_progress_tracker',
          note: `Updated progress tracker: ${group}.${itemKey}=${checked}`,
          meta: { group, itemKey, checked },
        })
      } catch {
        // ignore
      }

      return nextProgressTracker
    })

    return res.status(200).json({ success: true, progressTracker: result })
  } catch (error: any) {
    if (error?.message === 'not_found' || error?.statusCode === 404) {
      return res.status(404).json({ error: 'Customer not found' })
    }
    if (error?.message === 'archived' || error?.statusCode === 400) {
      return res.status(400).json({ error: 'Customer is archived' })
    }
    console.error('Error updating progress tracker:', error)
    return res.status(500).json({
      error: 'Failed to update progress tracker',
      details: error instanceof Error ? error.message : 'Unknown error',
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

    // CRITICAL: Update customer record with agreement metadata
    console.log(`[agreement] BEFORE UPDATE: customerId=${id}`)
    console.log(`[agreement] Writing: blobName=${blobName}, container=${containerName}, fileName=${fileName}`)
    
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

    // CRITICAL: Verify update succeeded
    if (!updatedCustomer) {
      console.error(`[agreement] ❌ UPDATE FAILED: prisma.customer.update returned null for customerId=${id}`)
      return res.status(500).json({
        error: 'database_update_failed',
        message: 'Agreement blob uploaded but database update failed'
      })
    }

    if (!updatedCustomer.agreementBlobName || !updatedCustomer.agreementContainerName) {
      console.error(`[agreement] ❌ UPDATE INCOMPLETE: blobName=${updatedCustomer.agreementBlobName}, container=${updatedCustomer.agreementContainerName}`)
      return res.status(500).json({
        error: 'database_update_incomplete',
        message: 'Agreement metadata not persisted correctly'
      })
    }

    console.log(`[agreement] ✅ AFTER UPDATE: customerId=${id}`)
    console.log(`[agreement] Verified: blobName=${updatedCustomer.agreementBlobName}`)
    console.log(`[agreement] Verified: container=${updatedCustomer.agreementContainerName}`)
    console.log(`[agreement] Verified: fileName=${updatedCustomer.agreementFileName}`)
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
      const urlMatch = customer.agreementFileUrl.match(/\/([^/]+)\/([^/?]+)(?:\?|$)/)
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

// GET /api/customers/:id/agreement/download - Redirect to a short-lived SAS URL (preferred for private containers)
// IMPORTANT: Do NOT store SAS in DB. Do NOT change agreement storage fields.
router.get('/:id/agreement/download', async (req, res) => {
  try {
    const { id } = req.params

    const customer = await prisma.customer.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        agreementBlobName: true,
        agreementContainerName: true,
        agreementFileName: true,
        agreementFileMimeType: true,
        agreementFileUrl: true, // legacy
      },
    })

    if (!customer) {
      res.status(404)
      res.setHeader('Content-Type', 'text/html; charset=utf-8')
      return res.send('<h3>No such customer</h3>')
    }

    const { generateAgreementSasUrl } = await import('../utils/blobSas.js')

    // New blob-based agreement (expected)
    if (customer.agreementBlobName && customer.agreementContainerName) {
      const sas = await generateAgreementSasUrl({
        containerName: customer.agreementContainerName,
        blobName: customer.agreementBlobName,
        ttlMinutes: 5,
      })
      res.setHeader('Cache-Control', 'no-store')
      return res.redirect(sas.url)
    }

    // Legacy: Try to parse blobName from agreementFileUrl if available
    if (customer.agreementFileUrl) {
      const urlMatch = customer.agreementFileUrl.match(/\/([^/]+)\/([^/?]+)(?:\?|$)/)
      if (urlMatch) {
        const containerName = urlMatch[1]
        const blobName = decodeURIComponent(urlMatch[2])

        // Backfill blob fields for future requests
        await prisma.customer.update({
          where: { id },
          data: { agreementBlobName: blobName, agreementContainerName: containerName },
        })

        const sas = await generateAgreementSasUrl({
          containerName,
          blobName,
          ttlMinutes: 5,
        })
        res.setHeader('Cache-Control', 'no-store')
        return res.redirect(sas.url)
      }

      // Legacy local filesystem URL (/uploads/)
      if (customer.agreementFileUrl.includes('/uploads/')) {
        res.status(410)
        res.setHeader('Content-Type', 'text/html; charset=utf-8')
        return res.send(
          '<h3>Legacy agreement file unavailable</h3><p>Please re-upload the agreement file in Customer Onboarding.</p>',
        )
      }
    }

    res.status(404)
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    return res.send('<h3>No agreement uploaded for this customer</h3>')
  } catch (error) {
    console.error('Error redirecting agreement download URL:', error)
    res.status(500)
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    return res.send('<h3>Failed to open agreement</h3><p>Please try again.</p>')
  }
})

// POST /api/customers/:id/attachments - Upload a generic customer attachment (Azure Blob)
// Stores attachment metadata append-only in accountData.attachments[] (no migrations).
router.post('/:id/attachments', (req, res) => {
  attachmentsUpload.single('file')(req as any, res as any, async (err: any) => {
    try {
      const { id } = req.params as any

      if (err) {
        // Handle multer size limit
        if (err?.code === 'LIMIT_FILE_SIZE') {
          return res.status(413).json({
            error: 'attachment_too_large',
            message: `File exceeds maximum allowed size of ${MAX_ATTACHMENT_FILE_SIZE_MB}MB`,
            maxMb: MAX_ATTACHMENT_FILE_SIZE_MB,
          })
        }
        console.error('Error parsing attachment multipart:', err)
        return res.status(400).json({ error: 'Invalid multipart upload' })
      }

      const file = (req as any).file as
        | { originalname: string; mimetype: string; buffer: Buffer; size: number }
        | undefined
      const attachmentType = String(((req as any).body || {}).attachmentType || '').trim()

      if (!file || !file.buffer || !file.originalname) {
        return res.status(400).json({ error: 'Missing file' })
      }
      if (!attachmentType) {
        return res.status(400).json({ error: 'Missing attachmentType' })
      }

      const mimeType = String(file.mimetype || '').trim()
      if (!ALLOWED_DOC_MIME_TYPES.includes(mimeType)) {
        return res.status(400).json({
          error: 'Invalid file type. Only PDF, DOC, and DOCX files are allowed.',
          receivedMimeType: mimeType,
        })
      }

      // Validate customer exists + not archived
      const customer = await prisma.customer.findUnique({
        where: { id },
        select: { id: true, name: true, isArchived: true, accountData: true },
      })
      if (!customer) {
        return res.status(404).json({ error: 'Customer not found' })
      }
      if (customer.isArchived) {
        return res.status(400).json({ error: 'Customer is archived' })
      }

      // Hard cap (defense-in-depth; multer already limits)
      if (file.size > MAX_ATTACHMENT_FILE_SIZE_BYTES) {
        return res.status(413).json({
          error: 'attachment_too_large',
          message: `File exceeds maximum allowed size of ${MAX_ATTACHMENT_FILE_SIZE_MB}MB`,
          maxMb: MAX_ATTACHMENT_FILE_SIZE_MB,
        })
      }

      // Upload to Azure Blob (reuse helper used by Agreement)
      const { uploadCustomerAttachment, generateCustomerAttachmentBlobName } = await import(
        '../utils/blobUpload.js'
      )
      const blobName = generateCustomerAttachmentBlobName(id, attachmentType, file.originalname)
      const uploadResult = await uploadCustomerAttachment({
        buffer: file.buffer,
        contentType: mimeType,
        blobName,
      })

      const actorIdentity = getActorIdentity(req as any)
      const actorEmail = actorIdentity?.email || null

      const attachmentId = `att_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
      const now = new Date()

      const baseUrl =
        process.env.API_PUBLIC_BASE_URL || `${(req as any).protocol}://${(req as any).get('host')}`
      const downloadUrl = `${baseUrl}/api/customers/${id}/attachments/${attachmentId}/download`

      const attachment = {
        id: attachmentId,
        type: attachmentType,
        fileName: file.originalname,
        fileUrl: downloadUrl,
        mimeType,
        blobName: uploadResult.blobName,
        containerName: uploadResult.containerName,
        uploadedAt: now.toISOString(),
        uploadedByEmail: actorEmail,
      }

      const updatedCustomer = await prisma.$transaction(async (tx) => {
        // Prevent lost updates when multiple uploads happen close together.
        await tx.$queryRaw`SELECT "id" FROM "customers" WHERE "id" = ${id} FOR UPDATE`

        const existing = await tx.customer.findUnique({
          where: { id },
          select: { id: true, accountData: true },
        })
        if (!existing) return null

        const currentAccountData =
          existing.accountData && typeof existing.accountData === 'object' ? (existing.accountData as any) : {}
        const currentAttachments = Array.isArray(currentAccountData.attachments)
          ? currentAccountData.attachments
          : []

        const nextAccountData: any = {
          ...currentAccountData,
          attachments: [...currentAttachments, attachment],
        }

        // Optional: also wire known onboarding fields to keep UX consistent after DB rehydrate.
        // This allows existing UI fields (accreditations evidence + case studies file) to keep working,
        // while still standardizing the storage of the binary + metadata in accountData.attachments[].
        try {
          const profile = nextAccountData.clientProfile && typeof nextAccountData.clientProfile === 'object'
            ? nextAccountData.clientProfile
            : {}

          // case_studies → clientProfile.caseStudiesFile*
          if (attachmentType === 'case_studies') {
            nextAccountData.clientProfile = {
              ...profile,
              caseStudiesFileName: attachment.fileName,
              caseStudiesFileUrl: attachment.fileUrl,
            }
          }

          // accreditation_evidence:<accreditationId> → update matching clientProfile.accreditations[]
          if (attachmentType.startsWith('accreditation_evidence:')) {
            const accreditationId = attachmentType.split(':')[1] || ''
            const accs = Array.isArray(profile.accreditations) ? profile.accreditations : []
            nextAccountData.clientProfile = {
              ...profile,
              accreditations: accs.map((acc: any) => {
                if (!acc || acc.id !== accreditationId) return acc
                return {
                  ...acc,
                  fileName: attachment.fileName,
                  fileUrl: attachment.fileUrl,
                }
              }),
            }
          }
        } catch {
          // ignore profile wiring failures - attachments[] still persists
        }

        const next = await tx.customer.update({
          where: { id },
          data: {
            accountData: nextAccountData,
            updatedAt: new Date(),
          },
          select: { id: true },
        })

        // Best-effort audit
        try {
          await safeCustomerAuditEvent(tx as any, {
            customerId: id,
            action: 'upload_attachment',
            note: `Uploaded attachment (${attachmentType}): ${file.originalname}`,
            meta: {
              attachmentId,
              attachmentType,
              fileName: file.originalname,
              blobName: uploadResult.blobName,
              containerName: uploadResult.containerName,
              mimeType,
            },
          })
        } catch {
          // ignore audit failures
        }

        return next
      })

      if (!updatedCustomer) {
        return res.status(500).json({
          error: 'database_update_failed',
          message: 'Attachment blob uploaded but database update failed',
        })
      }

      console.log(
        `[attachments] ✅ customerId=${id} type=${attachmentType} file=${file.originalname} blob=${uploadResult.containerName}/${uploadResult.blobName}`
      )

      return res.status(201).json({ success: true, attachment })
    } catch (error) {
      console.error('Error uploading attachment:', error)
      return res.status(500).json({
        error: 'Failed to upload attachment',
        details: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  })
})

// GET /api/customers/:id/attachments/:attachmentId/download - Generate SAS URL for attachment download
router.get('/:id/attachments/:attachmentId/download', async (req, res) => {
  try {
    const { id, attachmentId } = req.params

    const customer = await prisma.customer.findUnique({
      where: { id },
      select: { id: true, accountData: true, isArchived: true },
    })
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' })
    }

    const accountData = customer.accountData && typeof customer.accountData === 'object' ? (customer.accountData as any) : {}
    const attachments = Array.isArray(accountData.attachments) ? accountData.attachments : []
    const attachment = attachments.find((a: any) => a && a.id === attachmentId) || null

    if (!attachment) {
      return res.status(404).json({ error: 'Attachment not found' })
    }
    if (!attachment.blobName || !attachment.containerName) {
      return res.status(410).json({
        error: 'attachment_unavailable',
        message: 'Attachment is stored in legacy format and unavailable. Please re-upload.',
      })
    }

    const { generateBlobSasUrl } = await import('../utils/blobSas.js')
    const sasResult = await generateBlobSasUrl({
      containerName: attachment.containerName,
      blobName: attachment.blobName,
      ttlMinutes: 15,
    })

    // Prefer link-friendly behavior: redirect straight to the short-lived SAS URL.
    // This makes `attachment.fileUrl` usable as a normal clickable hyperlink.
    res.setHeader('Cache-Control', 'no-store')
    return res.redirect(sasResult.url)
  } catch (error) {
    console.error('Error generating attachment download URL:', error)
    return res.status(500).json({
      error: 'Failed to generate download URL',
      details: error instanceof Error ? error.message : 'Unknown error',
    })
  }
})

// POST /api/customers/:id/suppression-import - Import customer-scoped DNC suppression list
// Accepts multipart/form-data: file (.csv|.xlsx|.txt)
// Replaces ALL existing email-type suppressions for this customer (domain suppressions preserved).
router.post('/:id/suppression-import', (req, res) => {
  suppressionUpload.single('file')(req as any, res as any, async (err: any) => {
    try {
      const { id } = req.params as any

      if (err) {
        if (err?.code === 'LIMIT_FILE_SIZE') {
          return res.status(413).json({
            error: 'suppression_file_too_large',
            message: `File exceeds maximum allowed size of ${MAX_SUPPRESSION_FILE_SIZE_MB}MB`,
            maxMb: MAX_SUPPRESSION_FILE_SIZE_MB,
          })
        }
        console.error('Error parsing suppression multipart:', err)
        return res.status(400).json({ error: 'Invalid multipart upload' })
      }

      const file = (req as any).file as
        | { originalname: string; mimetype: string; buffer: Buffer; size: number }
        | undefined

      if (!file || !file.buffer || !file.originalname) {
        return res.status(400).json({ error: 'Missing file' })
      }

      const originalName = String(file.originalname || 'suppression-upload').trim()
      const ext = (originalName.split('.').pop() || '').toLowerCase()
      if (!['csv', 'xlsx', 'txt'].includes(ext)) {
        return res.status(400).json({
          error: 'unsupported_file_type',
          message: 'Supported file types: .csv, .xlsx, .txt',
          received: ext || null,
        })
      }

      const normalizeEmail = (raw: unknown): string | null => {
        if (typeof raw !== 'string') return null
        const v = raw.trim().toLowerCase()
        if (!v) return null
        const ok = z.string().email().safeParse(v).success
        return ok ? v : null
      }

      type ParsedRow = {
        email: string
        reason?: string
        source?: string
        name?: string
        company?: string
        notes?: string
      }

      const parsedRows: ParsedRow[] = []
      let emailHeaderPresent = true

      if (ext === 'txt') {
        const text = file.buffer.toString('utf8')
        const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
        for (const line of lines) {
          const email = normalizeEmail(line)
          if (!email) continue
          parsedRows.push({ email, source: 'client_upload' })
        }
      } else {
        // Use first sheet; header matching is case-insensitive.
        const workbook =
          ext === 'csv'
            ? XLSX.read(file.buffer.toString('utf8'), { type: 'string' })
            : XLSX.read(file.buffer, { type: 'buffer' })

        const sheetName = workbook.SheetNames?.[0]
        if (!sheetName) {
          return res.status(400).json({ error: 'empty_file', message: 'No sheets found in upload' })
        }
        const sheet = workbook.Sheets[sheetName]
        const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' }) as Array<Record<string, any>>

        // Find header key for "email" case-insensitively
        const headerKeys = new Set<string>()
        for (const r of rows) {
          Object.keys(r || {}).forEach((k) => headerKeys.add(k))
        }
        const headerKeyEmail =
          Array.from(headerKeys).find((k) => String(k).trim().toLowerCase() === 'email') || null
        if (!headerKeyEmail) {
          emailHeaderPresent = false
        } else {
          for (const r of rows) {
            if (!r) continue
            const email = normalizeEmail(String((r as any)[headerKeyEmail] ?? ''))
            if (!email) continue

            const getOpt = (key: string): string | undefined => {
              const found = Object.keys(r).find((k) => String(k).trim().toLowerCase() === key)
              if (!found) return undefined
              const v = String((r as any)[found] ?? '').trim()
              return v ? v : undefined
            }

            parsedRows.push({
              email,
              reason: getOpt('reason'),
              source: getOpt('source'),
              name: getOpt('name'),
              company: getOpt('company'),
              notes: getOpt('notes'),
            })
          }
        }
      }

      if (!emailHeaderPresent) {
        return res.status(400).json({
          error: 'missing_email_header',
          message: 'Upload must contain an "email" header (case-insensitive).',
        })
      }

      // Deduplicate within file
      const seen = new Set<string>()
      const deduped: ParsedRow[] = []
      let duplicatesRemoved = 0
      for (const row of parsedRows) {
        if (!row?.email) continue
        if (seen.has(row.email)) {
          duplicatesRemoved++
          continue
        }
        seen.add(row.email)
        deduped.push(row)
      }

      // Replace existing customer-scoped email suppressions
      const actor = getActorIdentity(req)
      const now = new Date()

      const result = await prisma.$transaction(async (tx) => {
        // Lock customer row to serialize replace operations
        await tx.$queryRaw`SELECT "id" FROM "customers" WHERE "id" = ${id} FOR UPDATE`
        const customer = await tx.customer.findUnique({
          where: { id },
          select: { id: true, name: true, isArchived: true, accountData: true },
        })
        if (!customer) {
          const e: any = new Error('not_found')
          e.statusCode = 404
          throw e
        }
        if (customer.isArchived) {
          const e: any = new Error('archived')
          e.statusCode = 400
          throw e
        }

        // Delete existing email suppressions for this customer (preserve domain suppressions)
        const deleted = await tx.suppressionEntry.deleteMany({
          where: { customerId: id, type: 'email' },
        })

        const dataToInsert = deduped.map((r) => {
          // We cannot add columns without migrations; store optional fields safely in `reason` when present.
          const baseReason = String(r.reason || '').trim()
          const extraParts: string[] = []
          if (r.name) extraParts.push(`name=${r.name}`)
          if (r.company) extraParts.push(`company=${r.company}`)
          if (r.notes) extraParts.push(`notes=${r.notes}`)
          const mergedReason =
            extraParts.length > 0
              ? `${baseReason || 'client_upload'} | ${extraParts.join(' | ')}`.slice(0, 500)
              : (baseReason || null)

          return {
            customerId: id,
            type: 'email',
            value: r.email,
            emailNormalized: r.email,
            reason: mergedReason,
            source: String(r.source || 'client_upload').trim() || 'client_upload',
            sourceFileName: originalName,
          }
        })

        // Insert in batches (createMany is faster)
        const batchSize = 1000
        let created = 0
        for (let i = 0; i < dataToInsert.length; i += batchSize) {
          const batch = dataToInsert.slice(i, i + batchSize)
          const createdBatch = await tx.suppressionEntry.createMany({
            data: batch as any,
            skipDuplicates: true,
          })
          created += createdBatch.count || 0
        }

        // Save upload metadata on accountData (DB truth for UI)
        const existingAccountData =
          customer.accountData && typeof customer.accountData === 'object' ? (customer.accountData as any) : {}
        const nextAccountData = {
          ...existingAccountData,
          dncSuppression: {
            fileName: originalName,
            uploadedAt: now.toISOString(),
            uploadedByEmail: actor.email || null,
            totalParsed: parsedRows.length,
            totalImported: dataToInsert.length,
            duplicatesRemoved,
            replacedExistingEmailEntries: deleted.count,
          },
        }

        await tx.customer.update({
          where: { id },
          data: {
            accountData: nextAccountData,
            updatedAt: now,
          },
        })

        return {
          deletedEmailEntries: deleted.count,
          totalParsed: parsedRows.length,
          totalImported: dataToInsert.length,
          duplicatesRemoved,
          timestamp: now.toISOString(),
          createdCount: created,
        }
      })

      return res.json({
        totalImported: result.totalImported,
        totalSkipped: Math.max(0, result.totalParsed - result.totalImported),
        timestamp: result.timestamp,
        duplicatesRemoved: result.duplicatesRemoved,
        replacedEmailEntries: result.deletedEmailEntries,
      })
    } catch (error: any) {
      if (error?.statusCode === 404 || error?.message === 'not_found') {
        return res.status(404).json({ error: 'Customer not found' })
      }
      if (error?.statusCode === 400 || error?.message === 'archived') {
        return res.status(400).json({ error: 'Customer is archived' })
      }
      console.error('Error importing suppression list:', error)
      return res.status(500).json({
        error: 'suppression_import_failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  })
})

// GET /api/customers/:id/suppression-summary - Customer-scoped suppression count + last upload metadata
router.get('/:id/suppression-summary', async (req, res) => {
  try {
    const { id } = req.params
    const [count, customer] = await Promise.all([
      prisma.suppressionEntry.count({ where: { customerId: id, type: 'email' } }),
      prisma.customer.findUnique({ where: { id }, select: { id: true, accountData: true } }),
    ])
    if (!customer) return res.status(404).json({ error: 'Customer not found' })

    const ad = customer.accountData && typeof customer.accountData === 'object' ? (customer.accountData as any) : {}
    const meta = ad?.dncSuppression && typeof ad.dncSuppression === 'object' ? ad.dncSuppression : null

    return res.json({
      totalSuppressedEmails: count,
      lastUpload: meta
        ? {
            fileName: meta.fileName || null,
            uploadedAt: meta.uploadedAt || null,
            uploadedByEmail: meta.uploadedByEmail || null,
            totalImported: meta.totalImported ?? null,
          }
        : null,
    })
  } catch (error) {
    console.error('Error fetching suppression summary:', error)
    return res.status(500).json({ error: 'suppression_summary_failed' })
  }
})

export default router