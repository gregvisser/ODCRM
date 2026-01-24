import { Router } from 'express'

const router = Router()

router.get('/', async (req, res) => {
  try {
    const query = String(req.query.query || '').trim()
    if (!query) {
      return res.status(400).json({ error: 'Missing query' })
    }

    const baseUrl = process.env.PLACES_API_BASE_URL || 'https://nominatim.openstreetmap.org/search'
    const userAgent = process.env.PLACES_API_USER_AGENT || 'ODCRM/1.0 (support@opensdoors.com)'

    const url = new URL(baseUrl)
    url.searchParams.set('format', 'jsonv2')
    url.searchParams.set('addressdetails', '1')
    url.searchParams.set('limit', '8')
    url.searchParams.set('countrycodes', 'gb')
    url.searchParams.set('q', query)

    const fetchFn = (globalThis as { fetch?: (input: string, init?: any) => Promise<any> }).fetch
    if (!fetchFn) {
      return res.status(500).json({ error: 'Fetch is not available in this runtime' })
    }

    const response = await fetchFn(url.toString(), {
      headers: {
        'User-Agent': userAgent,
        Accept: 'application/json',
      },
    })

    if (!response.ok) {
      return res.status(502).json({ error: 'Failed to fetch places' })
    }

    const data = await response.json()

    const mapped = Array.isArray(data)
      ? data.map((place: any) => {
          const address = place.address || {}
          const city = address.city || address.town || address.village || address.hamlet || undefined
          const county = address.county || address.state || undefined
          const country = address.country || undefined
          return {
            label: place.display_name,
            placeId: place.place_id ? String(place.place_id) : undefined,
            city,
            county,
            country,
          }
        })
      : []

    return res.json(mapped)
  } catch (error) {
    console.error('Error searching places:', error)
    return res.status(500).json({ error: 'Failed to search places' })
  }
})

export default router
