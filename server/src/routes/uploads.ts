import { Router } from 'express'
import { promises as fs } from 'node:fs'
import path from 'node:path'

const router = Router()

type UploadBody = {
  fileName?: string
  dataUrl?: string
}

function decodeDataUrl(dataUrl: string): { buffer: Buffer; mime?: string } | null {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/)
  if (!match) return null
  const mime = match[1]
  const base64 = match[2]
  return { buffer: Buffer.from(base64, 'base64'), mime }
}

function sanitizeFileName(fileName: string): string {
  const safe = fileName.replace(/[^a-zA-Z0-9._-]/g, '_')
  return safe || 'upload'
}

router.post('/', async (req, res) => {
  try {
    const body = (req.body || {}) as UploadBody
    if (!body.fileName || !body.dataUrl) {
      return res.status(400).json({ error: 'Missing fileName or dataUrl' })
    }

    const decoded = decodeDataUrl(body.dataUrl)
    if (!decoded) {
      return res.status(400).json({ error: 'Invalid dataUrl format' })
    }

    const uploadsDir = path.resolve(process.cwd(), 'uploads')
    await fs.mkdir(uploadsDir, { recursive: true })

    const safeName = sanitizeFileName(body.fileName)
    const uniqueName = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${safeName}`
    const filePath = path.join(uploadsDir, uniqueName)

    await fs.writeFile(filePath, decoded.buffer)

    const baseUrl =
      process.env.API_PUBLIC_BASE_URL || `${req.protocol}://${req.get('host')}`
    const fileUrl = `${baseUrl}/uploads/${uniqueName}`

    return res.status(201).json({
      fileUrl,
      fileName: body.fileName,
      mimeType: decoded.mime,
    })
  } catch (error) {
    console.error('Error uploading file:', error)
    return res.status(500).json({ error: 'Failed to upload file' })
  }
})

export default router
