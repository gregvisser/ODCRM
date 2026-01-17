/**
 * Customers/Clients Management API
 * Ported from OpensDoorsV2 clients/actions.ts
 */

import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'

const router = Router()

// Schema validation (matches OpensDoorsV2 ClientAccount)
const upsertCustomerSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  domain: z.string().optional(),
  
  // Business details
  leadsReportingUrl: z.string().url().optional().nullable(),
  sector: z.string().optional().nullable(),
  clientStatus: z.enum(['active', 'inactive', 'onboarding', 'win_back']).optional(),
  targetJobTitle: z.string().optional().nullable(),
  prospectingLocation: z.string().optional().nullable(),
  
  // Financial & performance
  monthlyIntakeGBP: z.number().optional().nullable(),
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
    const validated = upsertCustomerSchema.parse(req.body)

    const customer = await prisma.customer.create({
      data: {
        id: `cust_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        name: validated.name,
        domain: validated.domain,
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
    const validated = upsertCustomerSchema.parse(req.body)

    const customer = await prisma.customer.update({
      where: { id },
      data: {
        name: validated.name,
        domain: validated.domain,
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
      },
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

    const contact = await prisma.customerContact.create({
      data: {
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
    console.error('Error creating customer contact:', error)
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
    console.error('Error updating customer contact:', error)
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
    console.error('Error deleting customer contact:', error)
    return res.status(500).json({ error: 'Failed to delete contact' })
  }
})

export default router
