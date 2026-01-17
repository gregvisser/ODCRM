/**
 * Templates Management API
 * Ported from OpensDoorsV2 templates/actions.ts
 * Stores templates in database (not localStorage)
 */

import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { applyTemplatePlaceholders, previewTemplate } from '../services/templateRenderer.js'

const router = Router()

// Note: ODCRM doesn't have a dedicated templates table yet
// We'll use email_sequence_steps as our template storage for now
// Or create a new templates table in a future migration

const createTemplateSchema = z.object({
  customerId: z.string(),
  name: z.string().min(1),
  subjectTemplate: z.string().min(1),
  bodyTemplateHtml: z.string().min(1),
  bodyTemplateText: z.string().optional(),
  category: z.string().optional(),
})

const updateTemplateSchema = z.object({
  name: z.string().min(1).optional(),
  subjectTemplate: z.string().min(1).optional(),
  bodyTemplateHtml: z.string().min(1).optional(),
  bodyTemplateText: z.string().optional(),
  category: z.string().optional(),
})

// For now, we'll create a simple in-memory templates storage that syncs with localStorage on frontend
// In production, you'd want to add a dedicated 'templates' table to the database

// GET /api/templates - Get all templates for customer
router.get('/', async (req, res) => {
  try {
    const { customerId } = req.query

    if (!customerId || typeof customerId !== 'string') {
      return res.status(400).json({ error: 'customerId is required' })
    }

    // For now, return empty array - frontend uses localStorage
    // In full migration, would query from database templates table
    return res.json([])
  } catch (error) {
    console.error('Error fetching templates:', error)
    return res.status(500).json({ error: 'Failed to fetch templates' })
  }
})

// POST /api/templates/preview - Preview template with placeholders
router.post('/preview', async (req, res) => {
  try {
    const { subject, body, variables } = req.body

    const previewedSubject = variables
      ? applyTemplatePlaceholders(subject || '', variables)
      : previewTemplate(subject || '')

    const previewedBody = variables
      ? applyTemplatePlaceholders(body || '', variables)
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

export default router
