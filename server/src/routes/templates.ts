/**
 * Templates Management API
 * Ported from OpensDoorsV2 templates/actions.ts
 * Stores templates in database (not localStorage)
 */

import { randomUUID } from 'crypto';
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { applyTemplatePlaceholders, applyTemplatePlaceholdersSafe, previewTemplate } from '../services/templateRenderer.js';

const router = Router();

const getCustomerId = (req: any): string => {
  const customerId = (req.headers['x-customer-id'] as string) || (req.query.customerId as string)
  if (!customerId) {
    const err = new Error('Customer ID required') as Error & { status?: number }
    err.status = 400
    throw err
  }
  return customerId
}

const createTemplateSchema = z.object({
  name: z.string().min(1),
  subjectTemplate: z.string().min(1),
  bodyTemplateHtml: z.string().min(1),
  bodyTemplateText: z.string().optional(),
  stepNumber: z.number().int().min(1).max(10).default(1),
})

const updateTemplateSchema = z.object({
  name: z.string().min(1).optional(),
  subjectTemplate: z.string().min(1).optional(),
  bodyTemplateHtml: z.string().min(1).optional(),
  bodyTemplateText: z.string().optional(),
  stepNumber: z.number().int().min(1).max(10).optional(),
})

// GET /api/templates - Get all templates for customer
router.get('/', async (req, res, next) => {
  try {
    const customerId = getCustomerId(req)

    const templates = await prisma.emailTemplate.findMany({
      where: { customerId },
      orderBy: [{ updatedAt: 'desc' }],
    })

    console.log('[templates] GET count=' + templates.length)
    return res.json(templates)
  } catch (error) {
    next(error)
  }
})

// Create template
router.post('/', async (req, res, next) => {
  try {
    const customerId = getCustomerId(req)
    const data = createTemplateSchema.parse(req.body)

    console.log('[templates] create customerId_present=' + String(!!customerId))

    const existingCustomer = await prisma.customer.findUnique({ where: { id: customerId } })
    res.setHeader('x-odcrm-templates-customerid-present', String(!!customerId))
    res.setHeader('x-odcrm-templates-customerid-valid', String(!!existingCustomer))
    if (!existingCustomer) {
      console.error('[templates] invalid customerId on create')
      return res.status(400).json({ error: 'Invalid customer context' })
    }

    const created = await prisma.emailTemplate.create({
      data: {
        id: randomUUID(),
        customerId: customerId,
        name: data.name,
        subjectTemplate: data.subjectTemplate,
        bodyTemplateHtml: data.bodyTemplateHtml,
        bodyTemplateText: data.bodyTemplateText || null,
        stepNumber: data.stepNumber,
      },
    })
    
    console.log('[templates] create success')
    res.status(201).json(created)
  } catch (error) {
    next(error)
  }
})

// Update template
router.patch('/:id', async (req, res, next) => {
  try {
    const customerId = getCustomerId(req)
    res.setHeader('x-odcrm-templates-customerid-present', String(!!customerId))
    const data = updateTemplateSchema.parse(req.body)
    const { id } = req.params

    const existing = await prisma.emailTemplate.findUnique({ where: { id } })
    if (!existing) return res.status(404).json({ error: 'Template not found' })
    
    // Strict customer scoping: return 404 if template belongs to different customer
    if (existing.customerId !== customerId) {
      return res.status(404).json({ error: 'Template not found' })
    }

    const updated = await prisma.emailTemplate.update({
      where: { id },
      data: {
        ...data,
        // customerId is immutable - never change it after creation
      },
    })
    res.json(updated)
  } catch (error) {
    next(error)
  }
})

// Delete template
router.delete('/:id', async (req, res, next) => {
  try {
    const customerId = getCustomerId(req)
    res.setHeader('x-odcrm-templates-customerid-present', String(!!customerId))
    const { id } = req.params

    const existing = await prisma.emailTemplate.findUnique({ where: { id } })
    if (!existing) return res.status(404).json({ error: 'Template not found' })
    
    // Strict customer scoping: return 404 if template belongs to different customer
    if (existing.customerId !== customerId) {
      return res.status(404).json({ error: 'Template not found' })
    }

    await prisma.emailTemplate.delete({ where: { id } })
    res.json({ success: true })
  } catch (error) {
    next(error)
  }
})

// POST /api/templates/preview - Preview template with placeholders (variables escaped for safe HTML display)
// Manual verification: POST with body { "subject": "Hi {{firstName}}", "body": "{{firstName}}", "variables": { "firstName": "<script>alert(1)</script>" } }
// => response subject/body must contain &lt;script&gt;alert(1)&lt;/script&gt; (escaped), not raw <script>
router.post('/preview', async (req, res) => {
  try {
    const customerId =
      (req.headers['x-customer-id'] as string) || (req.query.customerId as string) || null
    console.log('templates.preview customerId_present=' + String(!!customerId))
    res.setHeader('x-odcrm-templates-customerid-present', String(!!customerId))

    const { subject, body, variables } = req.body

    const previewedSubject = variables
      ? applyTemplatePlaceholdersSafe(subject || '', variables)
      : previewTemplate(subject || '')

    const previewedBody = variables
      ? applyTemplatePlaceholdersSafe(body || '', variables)
      : previewTemplate(body || '')

    return res.json({
      subject: previewedSubject,
      body: previewedBody,
    })
  } catch (error) {
    console.error('Error previewing template:', error)
    return res.status(500).json({ error: 'Failed to preview template' })
  }
})

export default router;
