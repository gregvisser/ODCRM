import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'

const router = Router()

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

    const lists = await prisma.contact_lists.findMany({
      where: { customerId },
      include: {
        _count: {
          select: { contact_list_members: true },
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
      contactCount: list._count.contact_list_members,
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
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params

    const list = await prisma.contact_lists.findUnique({
      where: { id },
      include: {
        contact_list_members: {
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
      contacts: list.contact_list_members.map((member) => ({
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
  } catch (error) {
    console.error('Error fetching list:', error)
    return res.status(500).json({ error: 'Failed to fetch list' })
  }
})

// POST /api/lists - Create a new list
router.post('/', async (req, res) => {
  try {
    const validated = createListSchema.parse(req.body)

    const list = await prisma.contact_lists.create({
      data: {
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
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params
    const validated = updateListSchema.parse(req.body)

    const list = await prisma.contact_lists.update({
      where: { id },
      data: {
        ...validated,
        updatedAt: new Date(),
      },
      include: {
        _count: {
          select: { contact_list_members: true },
        },
      },
    })

    return res.json({
      id: list.id,
      customerId: list.customerId,
      name: list.name,
      description: list.description,
      contactCount: list._count.contact_list_members,
      createdAt: list.createdAt.toISOString(),
      updatedAt: list.updatedAt.toISOString(),
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors })
    }
    console.error('Error updating list:', error)
    return res.status(500).json({ error: 'Failed to update list' })
  }
})

// DELETE /api/lists/:id - Delete a list
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params

    await prisma.contact_lists.delete({
      where: { id },
    })

    return res.json({ success: true })
  } catch (error) {
    console.error('Error deleting list:', error)
    return res.status(500).json({ error: 'Failed to delete list' })
  }
})

// POST /api/lists/:id/contacts - Add contacts to a list
router.post('/:id/contacts', async (req, res) => {
  try {
    const { id } = req.params
    const validated = addContactsSchema.parse(req.body)

    // Verify list exists
    const list = await prisma.contact_lists.findUnique({ where: { id } })
    if (!list) {
      return res.status(404).json({ error: 'List not found' })
    }

    // Create list members (skip duplicates)
    const createPromises = validated.contactIds.map((contactId) =>
      prisma.contact_list_members.upsert({
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
    await prisma.contact_lists.update({
      where: { id },
      data: { updatedAt: new Date() },
    })

    return res.json({ success: true, added: validated.contactIds.length })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors })
    }
    console.error('Error adding contacts to list:', error)
    return res.status(500).json({ error: 'Failed to add contacts to list' })
  }
})

// DELETE /api/lists/:id/contacts/:contactId - Remove a contact from a list
router.delete('/:id/contacts/:contactId', async (req, res) => {
  try {
    const { id, contactId } = req.params

    await prisma.contact_list_members.deleteMany({
      where: {
        listId: id,
        contactId,
      },
    })

    // Update list's updatedAt
    await prisma.contact_lists.update({
      where: { id },
      data: { updatedAt: new Date() },
    })

    return res.json({ success: true })
  } catch (error) {
    console.error('Error removing contact from list:', error)
    return res.status(500).json({ error: 'Failed to remove contact from list' })
  }
})

export default router
