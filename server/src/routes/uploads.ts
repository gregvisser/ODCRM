import { Router } from 'express'

const router = Router()

router.post('/', async (req, res) => {
  // This endpoint wrote files to local disk under /uploads (deprecated).
  // All uploads must be Azure Blob-backed via /api/customers/:id/attachments.
  return res.status(410).json({
    error: 'uploads_deprecated',
    message: 'This upload endpoint is deprecated. Use /api/customers/:id/attachments (Azure Blob-backed).',
  })
})

export default router
