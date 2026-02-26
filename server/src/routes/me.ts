/**
 * GET /api/me — UI mode and fixed tenant for client mode.
 * Does not require auth; frontend uses this to know if client mode is configured.
 */
import { Router, Request, Response } from 'express'

const router = Router()
const UI_MODE = (process.env.ODCRM_UI_MODE || 'agency').trim().toLowerCase()
const FIXED_CUSTOMER_ID = process.env.ODCRM_FIXED_CUSTOMER_ID?.trim() || null
const IS_CLIENT = UI_MODE === 'client'

router.get('/', (req: Request, res: Response) => {
  if (IS_CLIENT) {
    res.setHeader('x-odcrm-client-mode', 'true')
  }
  const uiMode = IS_CLIENT ? 'client' : 'agency'
  const role = uiMode
  res.json({
    uiMode,
    role,
    fixedCustomerId: IS_CLIENT ? (FIXED_CUSTOMER_ID || null) : null,
  })
})

export default router
