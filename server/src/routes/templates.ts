/**
 * Templates Management API
 * Ported from OpensDoorsV2 templates/actions.ts
 * Stores templates in database (not localStorage)
 * 
 * Includes Gemini AI integration for email tweaking
 */

import { randomUUID } from 'crypto';
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { applyTemplatePlaceholders, applyTemplatePlaceholdersSafe, previewTemplate } from '../services/templateRenderer.js';
import { tweakEmailWithAI, analyzeEmailTemplate, generateEmailVariations } from '../services/aiEmailService.js';

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

    res.setHeader('x-odcrm-customer-id', customerId)
    return res.json({ data: templates })
  } catch (error) {
    next(error)
  }
})

// Create template
router.post('/', async (req, res, next) => {
  try {
    const customerId = getCustomerId(req)
    const data = createTemplateSchema.parse(req.body)

    const existingCustomer = await prisma.customer.findUnique({ where: { id: customerId } })
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
    res.status(201).json({ data: created })
  } catch (error) {
    next(error)
  }
})

// Update template
router.patch('/:id', async (req, res, next) => {
  try {
    const customerId = getCustomerId(req)
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
    res.json({ data: updated })
  } catch (error) {
    next(error)
  }
})

// Delete template
router.delete('/:id', async (req, res, next) => {
  try {
    const customerId = getCustomerId(req)
    const { id } = req.params

    const existing = await prisma.emailTemplate.findUnique({ where: { id } })
    if (!existing) return res.status(404).json({ error: 'Template not found' })
    
    // Strict customer scoping: return 404 if template belongs to different customer
    if (existing.customerId !== customerId) {
      return res.status(404).json({ error: 'Template not found' })
    }

    await prisma.emailTemplate.delete({ where: { id } })
    res.json({ data: { success: true } })
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

    const { subject, body, variables } = req.body

    const previewedSubject = variables
      ? applyTemplatePlaceholdersSafe(subject || '', variables)
      : previewTemplate(subject || '')

    const previewedBody = variables
      ? applyTemplatePlaceholdersSafe(body || '', variables)
      : previewTemplate(body || '')

    return res.json({
      data: {
        subject: previewedSubject,
        body: previewedBody,
      },
    })
  } catch (error) {
    console.error('Error previewing template:', error)
    return res.status(500).json({ error: 'Failed to preview template' })
  }
})

// ==================== AI EMAIL TWEAKING ENDPOINTS ====================

const aiTweakSchema = z.object({
  templateBody: z.string().min(1, 'Template body is required'),
  templateSubject: z.string().optional(),
  contactName: z.string().optional(),
  contactCompany: z.string().optional(),
  contactTitle: z.string().optional(),
  contactIndustry: z.string().optional(),
  tone: z.enum(['professional', 'friendly', 'casual', 'formal', 'persuasive']).default('professional'),
  instruction: z.string().optional(),
  preservePlaceholders: z.boolean().default(true),
})

/**
 * POST /api/templates/ai/tweak
 * Tweak an email template using Gemini AI
 * 
 * Body:
 * - templateBody (required): The email body to tweak
 * - templateSubject (optional): The email subject to tweak
 * - contactName (optional): Recipient's name for personalization
 * - contactCompany (optional): Recipient's company
 * - contactTitle (optional): Recipient's job title
 * - contactIndustry (optional): Recipient's industry
 * - tone (optional): professional | friendly | casual | formal | persuasive
 * - instruction (optional): Custom instructions for the AI
 * - preservePlaceholders (optional): Keep {{placeholders}} intact (default: true)
 */
router.post('/ai/tweak', async (req, res) => {
  try {
    const data = aiTweakSchema.parse(req.body)
    
    const result = await tweakEmailWithAI({
      templateBody: data.templateBody,
      templateSubject: data.templateSubject,
      contactName: data.contactName,
      contactCompany: data.contactCompany,
      contactTitle: data.contactTitle,
      contactIndustry: data.contactIndustry,
      tone: data.tone,
      instruction: data.instruction,
      preservePlaceholders: data.preservePlaceholders,
    })
    
    return res.json({
      success: true,
      data: {
        tweakedBody: result.tweakedBody,
        tweakedSubject: result.tweakedSubject,
      }
    })
  } catch (error: any) {
    console.error('[AI Tweak] Error:', error)
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        success: false, 
        error: 'Validation error', 
        details: error.errors 
      })
    }
    
    if (error.message?.includes('not configured')) {
      return res.status(503).json({ 
        success: false, 
        error: 'AI service not configured. Please set EMERGENT_LLM_KEY environment variable.' 
      })
    }
    
    return res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to tweak template' 
    })
  }
})

/**
 * POST /api/templates/ai/analyze
 * Analyze an email template and get improvement suggestions
 * 
 * Body:
 * - templateBody (required): The email body to analyze
 * - templateSubject (optional): The email subject
 */
router.post('/ai/analyze', async (req, res) => {
  try {
    const { templateBody, templateSubject } = req.body
    
    if (!templateBody) {
      return res.status(400).json({ 
        success: false, 
        error: 'templateBody is required' 
      })
    }
    
    const result = await analyzeEmailTemplate(templateBody, templateSubject)
    
    return res.json({
      success: true,
      data: result
    })
  } catch (error: any) {
    console.error('[AI Analyze] Error:', error)
    return res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to analyze template' 
    })
  }
})

/**
 * POST /api/templates/ai/variations
 * Generate multiple variations of an email template for A/B testing
 * 
 * Body:
 * - templateBody (required): The email body
 * - templateSubject (required): The email subject
 * - count (optional): Number of variations to generate (1-5, default: 3)
 */
router.post('/ai/variations', async (req, res) => {
  try {
    const { templateBody, templateSubject, count = 3 } = req.body
    
    if (!templateBody || !templateSubject) {
      return res.status(400).json({ 
        success: false, 
        error: 'templateBody and templateSubject are required' 
      })
    }
    
    const variationCount = Math.min(Math.max(1, count), 5)
    const variations = await generateEmailVariations(templateBody, templateSubject, variationCount)
    
    return res.json({
      success: true,
      data: {
        original: { subject: templateSubject, body: templateBody },
        variations
      }
    })
  } catch (error: any) {
    console.error('[AI Variations] Error:', error)
    return res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to generate variations' 
    })
  }
})

/**
 * POST /api/templates/:id/ai/tweak
 * Tweak a specific template by ID and optionally save the result
 * 
 * Body:
 * - contactName, contactCompany, etc. (optional): Context for personalization
 * - tone (optional): Desired tone
 * - instruction (optional): Custom instructions
 * - saveResult (optional): If true, update the template with tweaked content
 */
router.post('/:id/ai/tweak', async (req, res) => {
  try {
    const customerId = getCustomerId(req)
    const { id } = req.params
    const { saveResult = false, ...tweakOptions } = req.body
    
    // Fetch the template
    const template = await prisma.emailTemplate.findUnique({ where: { id } })
    
    if (!template) {
      return res.status(404).json({ success: false, error: 'Template not found' })
    }
    
    if (template.customerId !== customerId) {
      return res.status(404).json({ success: false, error: 'Template not found' })
    }
    
    // Tweak the template
    const result = await tweakEmailWithAI({
      templateBody: template.bodyTemplateHtml,
      templateSubject: template.subjectTemplate,
      ...tweakOptions
    })
    
    // Optionally save the result
    if (saveResult) {
      await prisma.emailTemplate.update({
        where: { id },
        data: {
          bodyTemplateHtml: result.tweakedBody,
          subjectTemplate: result.tweakedSubject || template.subjectTemplate,
          updatedAt: new Date()
        }
      })
    }
    
    return res.json({
      success: true,
      data: {
        templateId: id,
        original: {
          subject: template.subjectTemplate,
          body: template.bodyTemplateHtml
        },
        tweaked: {
          subject: result.tweakedSubject || template.subjectTemplate,
          body: result.tweakedBody
        },
        saved: saveResult
      }
    })
  } catch (error: any) {
    console.error('[AI Tweak Template] Error:', error)
    return res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to tweak template' 
    })
  }
})

export default router;
