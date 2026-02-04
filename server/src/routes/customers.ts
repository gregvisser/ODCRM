// @ts-nocheck
/**
 * Customers/Clients Management API
 * Ported from OpensDoorsV2 clients/actions.ts
 */

import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'

const router = Router()

// Helper: accept URL string or empty/whitespace (coerce to null)
const optionalUrl = z
  .string()
  .optional()
  .nullable()
  .transform((v) => (v && v.trim() && v.startsWith('http') ? v.trim() : null))

// Helper: accept number or string (coerce to number; NaN -> null)
const optionalNumber = z
  .union([z.number(), z.string()])
  .optional()
  .nullable()
  .transform((v) => {
    if (v === undefined || v === null || v === '') return null
    const n = typeof v === 'number' ? v : parseFloat(String(v))
    return Number.isFinite(n) ? n : null
  })

// Schema validation (matches OpensDoorsV2 ClientAccount). Lenient so frontend payloads don't 400.
const upsertCustomerSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  domain: z.string().optional().nullable(),
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
  socialPresence: z
    .array(
      z.object({
        label: z.string().optional().default(''),
        url: z.string().optional().transform((u) => (u && u.trim().startsWith('http') ? u.trim() : '')),
      })
    )
    .optional()
    .nullable()
    .transform((arr) => (arr && arr.length ? arr.filter((i) => i.url) : null)),
  leadsReportingUrl: optionalUrl,
  sector: z.string().optional().nullable(),
  clientStatus: z
    .string()
    .optional()
    .transform((v) => {
      const lower = (v || 'active').toString().toLowerCase()
      return ['active', 'inactive', 'onboarding', 'win_back'].includes(lower) ? lower : 'active'
    }),
  targetJobTitle: z.string().optional().nullable(),
  prospectingLocation: z.string().optional().nullable(),
  monthlyIntakeGBP: optionalNumber,
  defcon: z
    .union([z.number(), z.string()])
    .optional()
    .nullable()
    .transform((v) => {
      if (v === undefined || v === null || v === '') return null
      const n = typeof v === 'number' ? v : parseInt(String(v), 10)
      if (!Number.isFinite(n) || n < 1 || n > 6) return null
      return n
    }),
  weeklyLeadTarget: optionalNumber,
  weeklyLeadActual: optionalNumber,
  monthlyLeadTarget: optionalNumber,
  monthlyLeadActual: optionalNumber,
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

// GET /api/customers - List all customers with their contacts
router.get('/', async (req, res) => {
  try {
    const customers = await prisma.customer.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        customerContacts: true,
      },
    })

    const serialized = customers.map((customer) => ({
      ...customer,
      monthlyIntakeGBP: customer.monthlyIntakeGBP
        ? customer.monthlyIntakeGBP.toString()
        : null,
      createdAt: customer.createdAt.toISOString(),
      updatedAt: customer.updatedAt.toISOString(),
      customerContacts: customer.customerContacts.map((contact) => ({
        ...contact,
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

    const serialized = {
      ...customer,
      monthlyIntakeGBP: customer.monthlyIntakeGBP
        ? customer.monthlyIntakeGBP.toString()
        : null,
      createdAt: customer.createdAt.toISOString(),
      updatedAt: customer.updatedAt.toISOString(),
      customerContacts: customer.customerContacts.map((contact) => ({
        ...contact,
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

// POST /api/customers - Create a new customer
router.post('/', async (req, res) => {
  try {
    console.log('📝 POST /api/customers - Creating customer:', { name: req.body.name })
    const validated = upsertCustomerSchema.parse(req.body)

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
        sector: validated.sector,
        clientStatus: validated.clientStatus || 'active',
        targetJobTitle: validated.targetJobTitle,
        prospectingLocation: validated.prospectingLocation,
        monthlyIntakeGBP: validated.monthlyIntakeGBP,
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
      console.error('❌ POST /api/customers - Validation error:', error.errors)
      return res.status(400).json({ error: 'Invalid input', details: error.errors })
    }
    console.error('❌ POST /api/customers - Error creating customer:', error)
    console.error('Stack trace:', error instanceof Error ? error.stack : 'N/A')
    return res.status(500).json({ 
      error: 'Failed to create customer',
      message: error instanceof Error ? error.message : 'Unknown error'
    })
  }
})

// PUT /api/customers/:id - Update a customer
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params
    const validated = upsertCustomerSchema.parse(req.body)
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
      sector: validated.sector,
      clientStatus: validated.clientStatus,
      targetJobTitle: validated.targetJobTitle,
      prospectingLocation: validated.prospectingLocation,
      monthlyIntakeGBP: validated.monthlyIntakeGBP,
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

    console.log('✅ PUT /api/customers/:id - Updated customer:', { id: customer.id, name: customer.name })
    return res.json({
      id: customer.id,
      name: customer.name,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('❌ PUT /api/customers/:id - Validation error:', error.errors)
      return res.status(400).json({ error: 'Invalid input', details: error.errors })
    }
    console.error('❌ PUT /api/customers/:id - Error updating customer:', error)
    console.error('Stack trace:', error instanceof Error ? error.stack : 'N/A')
    return res.status(500).json({ 
      error: 'Failed to update customer',
      message: error instanceof Error ? error.message : 'Unknown error'
    })
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

export default router
