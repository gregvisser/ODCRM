import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'

const router = Router()

// Audit P0-1 (2026-02-22): All /:id operations now verify list.customerId matches the
// resolved tenant. This prevents IDOR where any authenticated user could read, update,
// or delete a contact list belonging to a different customer.
const getCustomerId = (req: { headers: Record<string, string | string[] | undefined>; query: Record<string, string | string[] | undefined> }): string => {
  const customerId = (req.headers['x-customer-id'] as string) || (req.query.customerId as string)
  if (!customerId) {
    const err = new Error('Customer ID required') as Error & { status?: number }
    err.status = 400
    throw err
  }
  return customerId
}

// Schema validation
const createListSchema = z.object({
  customerId: z.string(),
  name: z.string().min(1),
  description: z.string().optional(),
})

const updateListSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
})

const addContactsSchema = z.object({
  contactIds: z.array(z.string()),
})

// GET /api/lists - Get all lists for a customer
router.get('/', async (req, res) => {
  try {
    const { customerId } = req.query

    if (!customerId || typeof customerId !== 'string') {
      return res.status(400).json({ error: 'customerId is required' })
    }

    const lists = await prisma.contactList.findMany({
      where: { customerId },
      include: {
        _count: {
          select: { contactListMembers: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    // Transform to include contactCount
    const listsWithCount = lists.map((list) => ({
      id: list.id,
      customerId: list.customerId,
      name: list.name,
      description: list.description,
      contactCount: list._count.contactListMembers,
      createdAt: list.createdAt.toISOString(),
      updatedAt: list.updatedAt.toISOString(),
    }))

    return res.json(listsWithCount)
  } catch (error) {
    console.error('Error fetching lists:', error)
    return res.status(500).json({ error: 'Failed to fetch lists' })
  }
})

// GET /api/lists/:id - Get a single list with contacts
// Audit P0-1: uses findFirst({ where: { id, customerId } }) to enforce tenant ownership.
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params
    const customerId = getCustomerId(req as any)

    const list = await prisma.contactList.findFirst({
      where: { id, customerId },
      include: {
        contactListMembers: {
          include: {
            contact: true,
          },
        },
      },
    })

    if (!list) {
      return res.status(404).json({ error: 'List not found' })
    }

    return res.json({
      id: list.id,
      customerId: list.customerId,
      name: list.name,
      description: list.description,
      createdAt: list.createdAt.toISOString(),
      updatedAt: list.updatedAt.toISOString(),
      contacts: list.contactListMembers.map((member) => ({
        id: member.contact.id,
        firstName: member.contact.firstName,
        lastName: member.contact.lastName,
        email: member.contact.email,
        companyName: member.contact.companyName,
        jobTitle: member.contact.jobTitle,
        phone: member.contact.phone,
        status: member.contact.status,
        addedAt: member.createdAt.toISOString(),
      })),
    })
  } catch (error: any) {
    if (error.status === 400) return res.status(400).json({ error: error.message })
    console.error('Error fetching list:', error)
    return res.status(500).json({ error: 'Failed to fetch list' })
  }
})

// POST /api/lists - Create a new list
router.post('/', async (req, res) => {
  try {
    const validated = createListSchema.parse(req.body)

    const list = await prisma.contactList.create({ data: {
        id: `list_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        customerId: validated.customerId,
        name: validated.name,
        description: validated.description,
        updatedAt: new Date(),
      },
    })

    return res.status(201).json({
      id: list.id,
      customerId: list.customerId,
      name: list.name,
      description: list.description,
      contactCount: 0,
      createdAt: list.createdAt.toISOString(),
      updatedAt: list.updatedAt.toISOString(),
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors })
    }
    console.error('Error creating list:', error)
    return res.status(500).json({ error: 'Failed to create list' })
  }
})

// PUT /api/lists/:id - Update a list
// Audit P0-1: verifies ownership before update; returns 404 if not found for tenant.
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params
    const customerId = getCustomerId(req as any)
    const validated = updateListSchema.parse(req.body)

    const existing = await prisma.contactList.findFirst({ where: { id, customerId }, select: { id: true } })
    if (!existing) {
      return res.status(404).json({ error: 'List not found' })
    }

    const list = await prisma.contactList.update({
      where: { id },
      data: {
        ...validated,
        updatedAt: new Date(),
      },
      include: {
        _count: {
          select: { contactListMembers: true },
        },
      },
    })

    return res.json({
      id: list.id,
      customerId: list.customerId,
      name: list.name,
      description: list.description,
      contactCount: list._count.contactListMembers,
      createdAt: list.createdAt.toISOString(),
      updatedAt: list.updatedAt.toISOString(),
    })
  } catch (error: any) {
    if (error.status === 400) return res.status(400).json({ error: error.message })
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors })
    }
    console.error('Error updating list:', error)
    return res.status(500).json({ error: 'Failed to update list' })
  }
})

// DELETE /api/lists/:id - Delete a list
// Audit P0-1: verifies ownership before delete; returns 404 if not found for tenant.
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params
    const customerId = getCustomerId(req as any)

    const existing = await prisma.contactList.findFirst({ where: { id, customerId }, select: { id: true } })
    if (!existing) {
      return res.status(404).json({ error: 'List not found' })
    }

    await prisma.contactList.delete({
      where: { id },
    })

    return res.json({ success: true })
  } catch (error: any) {
    if (error.status === 400) return res.status(400).json({ error: error.message })
    console.error('Error deleting list:', error)
    return res.status(500).json({ error: 'Failed to delete list' })
  }
})

// POST /api/lists/:id/contacts - Add contacts to a list
// Audit P0-1: verifies list ownership AND that each contactId belongs to the same tenant.
router.post('/:id/contacts', async (req, res) => {
  try {
    const { id } = req.params
    const customerId = getCustomerId(req as any)
    const validated = addContactsSchema.parse(req.body)

    // Verify list belongs to this tenant
    const list = await prisma.contactList.findFirst({ where: { id, customerId }, select: { id: true } })
    if (!list) {
      return res.status(404).json({ error: 'List not found' })
    }

    // Verify all contactIds belong to the same tenant (prevents cross-tenant member insertion)
    if (validated.contactIds.length > 0) {
      const ownedContacts = await prisma.contact.findMany({
        where: { id: { in: validated.contactIds }, customerId },
        select: { id: true },
      })
      const ownedIds = new Set(ownedContacts.map((c) => c.id))
      const foreignIds = validated.contactIds.filter((cid) => !ownedIds.has(cid))
      if (foreignIds.length > 0) {
        return res.status(400).json({ error: 'One or more contacts do not belong to this customer' })
      }
    }

    // Create list members (skip duplicates)
    const createPromises = validated.contactIds.map((contactId) =>
      prisma.contactListMember.upsert({
        where: {
          listId_contactId: {
            listId: id,
            contactId,
          },
        },
        create: {
          id: `member_${Date.now()}_${Math.random().toString(36).substring(7)}`,
          listId: id,
          contactId,
        },
        update: {}, // Do nothing if already exists
      })
    )

    await Promise.all(createPromises)

    // Update list's updatedAt
    await prisma.contactList.update({
      where: { id },
      data: { updatedAt: new Date() },
    })

    return res.json({ success: true, added: validated.contactIds.length })
  } catch (error: any) {
    if (error.status === 400) return res.status(400).json({ error: error.message })
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors })
    }
    console.error('Error adding contacts to list:', error)
    return res.status(500).json({ error: 'Failed to add contacts to list' })
  }
})

// DELETE /api/lists/:id/contacts/:contactId - Remove a contact from a list
// Audit P0-1: verifies list ownership before removing member.
router.delete('/:id/contacts/:contactId', async (req, res) => {
  try {
    const { id, contactId } = req.params
    const customerId = getCustomerId(req as any)

    // Verify list belongs to this tenant before touching its members
    const list = await prisma.contactList.findFirst({ where: { id, customerId }, select: { id: true } })
    if (!list) {
      return res.status(404).json({ error: 'List not found' })
    }

    await prisma.contactListMember.deleteMany({
      where: {
        listId: id,
        contactId,
      },
    })

    // Update list's updatedAt
    await prisma.contactList.update({
      where: { id },
      data: { updatedAt: new Date() },
    })

    return res.json({ success: true })
  } catch (error: any) {
    if (error.status === 400) return res.status(400).json({ error: error.message })
    console.error('Error removing contact from list:', error)
    return res.status(500).json({ error: 'Failed to remove contact from list' })
  }
})

export default router
