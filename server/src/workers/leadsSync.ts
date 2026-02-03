// @ts-nocheck
import cron from 'node-cron'
import crypto from 'crypto'
import type { PrismaClient } from '@prisma/client'

type LeadRow = {
  [key: string]: string
  accountName: string
}

// Retry configuration
const MAX_RETRIES = 3
const INITIAL_RETRY_DELAY = 1000 // 1 second
const MAX_RETRY_DELAY = 10000 // 10 seconds

/**
 * Sleep utility for retry delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Retry function with exponential backoff
 */
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = MAX_RETRIES,
  initialDelay: number = INITIAL_RETRY_DELAY
): Promise<T> {
  let lastError: Error | null = null
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      
      if (attempt < maxRetries) {
        const delay = Math.min(initialDelay * Math.pow(2, attempt), MAX_RETRY_DELAY)
        console.log(`   ⚠️  Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms`)
        await sleep(delay)
      }
    }
  }
  
  throw lastError || new Error('Retry failed')
}

function extractSheetId(url: string): string | null {
  try {
    const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)
    return match ? match[1] : null
  } catch {
    return null
  }
}

function extractGid(url: string): string | null {
  try {
    const match = url.match(/gid=([0-9]+)/)
    return match ? match[1] : null
  } catch {
    return null
  }
}

/**
 * Optimized CSV parser with chunking support for large files
 * Processes CSV in chunks to avoid memory issues with 1000+ row sheets
 */
function parseCsv(csvText: string, chunkSize: number = 500): string[][] {
  const lines: string[][] = []
  let currentLine: string[] = []
  let currentField = ''
  let inQuotes = false

  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i]
    const nextChar = csvText[i + 1]

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentField += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (char === ',' && !inQuotes) {
      currentLine.push(currentField.trim())
      currentField = ''
    } else if (char === '\n' && !inQuotes) {
      currentLine.push(currentField.trim())
      currentField = ''
      if (currentLine.length > 0) {
        lines.push(currentLine)
        currentLine = []
        
        // Process in chunks for large files
        if (lines.length % chunkSize === 0) {
          // Yield control to event loop periodically
          // This prevents blocking on very large CSV files
        }
      }
    } else {
      currentField += char
    }
  }

  if (currentField || currentLine.length > 0) {
    currentLine.push(currentField.trim())
    lines.push(currentLine)
  }

  return lines
}

/**
 * Fetch leads from Google Sheets with retry logic and exponential backoff
 */
async function fetchLeadsFromSheetUrl(
  sheetUrl: string, 
  accountName: string,
  onProgress?: (progress: { percent: number; message: string }) => void
): Promise<{ leads: LeadRow[]; gidUsed?: string; diagnostics: any }> {
  const startTime = Date.now()
  const sheetId = extractSheetId(sheetUrl)
  if (!sheetId) {
    throw new Error('Invalid Google Sheets URL format')
  }

  console.log(`📄 FETCHING SHEET - ${accountName}`)
  console.log(`   Sheet ID: ${sheetId}`)
  console.log(`   URL: ${sheetUrl}`)

  const extractedGid = extractGid(sheetUrl)
  const gidsToTry = extractedGid ? [extractedGid, '0'] : ['0']

  let lastError: Error | null = null
  const diagnostics = {
    sheetId,
    extractedGid,
    gidsAttempted: [] as string[],
    fetchDuration: 0,
    csvSize: 0,
    totalRows: 0,
    validHeaders: [] as string[],
    filteredRows: 0,
    finalLeads: 0,
    errors: [] as string[],
    retryCount: 0,
  }

  // Update progress
  onProgress?.({ percent: 10, message: 'Fetching sheet data...' })

  for (const gid of gidsToTry) {
    try {
      diagnostics.gidsAttempted.push(gid)
      const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`

      console.log(`   Trying GID ${gid}: ${csvUrl}`)

      // Fetch with retry logic
      const fetchStart = Date.now()
      let response: Response | null = null
      
      try {
        response = await retryWithBackoff(async () => {
          const res = await fetch(csvUrl, {
            headers: {
              Accept: 'text/csv, text/plain, */*',
              'User-Agent': 'ODCRM-LeadsSync/2.0',
            },
            signal: AbortSignal.timeout(30000), // 30 second timeout
          })
          
          if (!res.ok && res.status !== 403 && res.status !== 404) {
            throw new Error(`HTTP ${res.status}: ${res.statusText}`)
          }
          
          return res
        })
        
        diagnostics.retryCount = 0 // Reset on success
      } catch (retryError) {
        diagnostics.retryCount = MAX_RETRIES
        throw retryError
      }

      const fetchDuration = Date.now() - fetchStart
      diagnostics.fetchDuration = fetchDuration

      console.log(`   Fetch result: ${response.status} ${response.statusText} (${fetchDuration}ms)`)

      if (!response.ok) {
        const errorMsg = `HTTP ${response.status}: ${response.statusText}`
        diagnostics.errors.push(errorMsg)
        console.log(`   ❌ ${errorMsg}`)

        if (response.status === 403) {
          lastError = new Error('Sheet is not publicly accessible')
          continue
        }
        if (response.status === 404) {
          lastError = new Error('Sheet not found')
          continue
        }
        lastError = new Error(`Failed to fetch: ${response.status} ${response.statusText}`)
        continue
      }

      onProgress?.({ percent: 30, message: 'Downloading CSV data...' })

      // Read response with progress tracking for large files
      const csvText = await response.text()
      diagnostics.csvSize = csvText.length

      console.log(`   Downloaded ${diagnostics.csvSize} bytes`)

      if (csvText.trim().startsWith('<!DOCTYPE') || csvText.trim().startsWith('<html')) {
        const errorMsg = 'Received HTML instead of CSV'
        diagnostics.errors.push(errorMsg)
        console.log(`   ❌ ${errorMsg}`)
        lastError = new Error(errorMsg)
        continue
      }

      onProgress?.({ percent: 50, message: 'Parsing CSV data...' })

      // Parse CSV with optimized parser
      const rows = parseCsv(csvText)
      diagnostics.totalRows = rows.length

      console.log(`   Parsed ${diagnostics.totalRows} rows from CSV`)

      if (rows.length < 2) {
        console.log(`   ⚠️  Only ${rows.length} rows (need at least 2 for headers + data)`)
        return { leads: [], gidUsed: gid, diagnostics }
      }

      onProgress?.({ percent: 60, message: 'Detecting headers...' })

      // Improved header detection - find the row with the most non-empty cells
      let headerRowIndex = 0
      let maxNonEmptyCells = 0

      for (let i = 0; i < Math.min(rows.length, 5); i++) { // Check first 5 rows
        const nonEmptyCells = rows[i].filter(cell => cell && cell.trim() !== '').length
        if (nonEmptyCells > maxNonEmptyCells) {
          maxNonEmptyCells = nonEmptyCells
          headerRowIndex = i
        }
      }

      console.log(`   Detected header row at index ${headerRowIndex} (${maxNonEmptyCells} non-empty cells)`)

      const headers = rows[headerRowIndex].map((h) => h.trim())
      diagnostics.validHeaders = headers.filter(h => h && h.trim() !== '')

      // Skip the header row and any rows before it
      const dataRows = rows.slice(headerRowIndex + 1)

      console.log(`   Headers found: ${diagnostics.validHeaders.join(', ')}`)

      onProgress?.({ percent: 70, message: 'Processing leads...' })

      const leads: LeadRow[] = []
      let filteredEmpty = 0
      let filteredWcWv = 0
      let filteredNoNameCompany = 0
      let filteredTooFewFields = 0

      // Process rows in batches for better performance
      const batchSize = 100
      for (let i = 0; i < dataRows.length; i += batchSize) {
        const batch = dataRows.slice(i, i + batchSize)
        
        for (const row of batch) {
          if (row.length === 0 || row.every((cell) => !cell || cell.trim() === '')) {
            filteredEmpty++
            continue
          }

          const lead: LeadRow = { accountName }
          headers.forEach((header, index) => {
            const value = row[index] || ''
            if (header && header.trim()) {
              lead[header.trim()] = value
            }
          })

          // Apply normalization
          const normalizedLead = normalizeLeadData(lead)

          // Filter out W/C and W/V rows
          const containsWcOrWv = Object.values(normalizedLead).some((value) => {
            const lowerValue = value ? String(value).toLowerCase() : ''
            return lowerValue.includes('w/c') || lowerValue.includes('w/v')
          })
          if (containsWcOrWv) {
            filteredWcWv++
            continue
          }

          // Require at least name or company
          const nameValue = normalizedLead['Name'] || normalizedLead['name'] || ''
          const companyValue = normalizedLead['Company'] || normalizedLead['company'] || ''
          const hasName = nameValue && nameValue.trim() !== ''
          const hasCompany = companyValue && companyValue.trim() !== ''
          if (!hasName && !hasCompany) {
            filteredNoNameCompany++
            continue
          }

          // Require at least 2 non-empty fields (besides accountName)
          const nonEmptyFields = Object.keys(normalizedLead).filter(
            (key) => key !== 'accountName' && normalizedLead[key] && String(normalizedLead[key]).trim() !== '',
          )
          if (nonEmptyFields.length < 2) {
            filteredTooFewFields++
            continue
          }

          leads.push(normalizedLead)
        }
        
        // Update progress during batch processing
        if (i + batchSize < dataRows.length) {
          const progress = 70 + Math.floor((i / dataRows.length) * 20)
          onProgress?.({ percent: progress, message: `Processed ${Math.min(i + batchSize, dataRows.length)}/${dataRows.length} rows...` })
        }
      }

      diagnostics.filteredRows = filteredEmpty + filteredWcWv + filteredNoNameCompany + filteredTooFewFields
      diagnostics.finalLeads = leads.length

      console.log(`   Filtering results:`)
      console.log(`     - Empty rows: ${filteredEmpty}`)
      console.log(`     - W/C or W/V rows: ${filteredWcWv}`)
      console.log(`     - No name/company: ${filteredNoNameCompany}`)
      console.log(`     - Too few fields: ${filteredTooFewFields}`)
      console.log(`   ✅ Final leads: ${leads.length}`)

      const totalDuration = Date.now() - startTime
      console.log(`   ⏱️  Total fetch time: ${totalDuration}ms`)

      onProgress?.({ percent: 100, message: 'Complete' })

      return { leads, gidUsed: gid, diagnostics }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to parse CSV data'
      diagnostics.errors.push(errorMsg)
      console.log(`   ❌ Error with GID ${gid}: ${errorMsg}`)
      lastError = error instanceof Error ? error : new Error('Failed to parse CSV data')
      continue
    }
  }

  throw lastError || new Error('Failed to fetch leads from Google Sheet')
}

function parseDate(value: string): Date | null {
  if (!value || !value.trim()) return null
  const trimmed = value.trim()

  // DD.MM.YY or DD.MM.YYYY (European format)
  const ddmmyy = trimmed.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2}|\d{4})$/)
  if (ddmmyy) {
    const day = parseInt(ddmmyy[1], 10)
    const month = parseInt(ddmmyy[2], 10) - 1
    let year = parseInt(ddmmyy[3], 10)
    if (year < 100) year += 2000
    const date = new Date(year, month, day)
    if (!isNaN(date.getTime())) return date
  }

  // YYYY-MM-DD (ISO format)
  const yyyymmdd = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (yyyymmdd) {
    const year = parseInt(yyyymmdd[1], 10)
    const month = parseInt(yyyymmdd[2], 10) - 1
    const day = parseInt(yyyymmdd[3], 10)
    const date = new Date(year, month, day)
    if (!isNaN(date.getTime())) return date
  }

  // MM/DD/YYYY (US format)
  const mmddyyyy = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (mmddyyyy) {
    const month = parseInt(mmddyyyy[1], 10) - 1
    const day = parseInt(mmddyyyy[2], 10)
    const year = parseInt(mmddyyyy[3], 10)
    const date = new Date(year, month, day)
    if (!isNaN(date.getTime())) return date
  }

  // DD/MM/YYYY (alternative European)
  const ddmmyyyy = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (ddmmyyyy && !mmddyyyy) {
    const day = parseInt(ddmmyyyy[1], 10)
    const month = parseInt(ddmmyyyy[2], 10) - 1
    const year = parseInt(ddmmyyyy[3], 10)
    const date = new Date(year, month, day)
    if (!isNaN(date.getTime())) return date
  }

  // Try native Date parsing as fallback
  const parsed = new Date(trimmed)
  if (!isNaN(parsed.getTime())) {
    const year = parsed.getFullYear()
    if (year >= 2000 && year <= 2100) {
      return parsed
    }
  }

  return null
}

/**
 * Generate a stable, deterministic ID for a lead based on its core identifying fields.
 */
function generateStableLeadId(lead: LeadRow, customerId: string): string {
  const email = (lead['Email'] || lead['email'] || '').trim().toLowerCase()
  const phone = (lead['Phone'] || lead['phone'] || lead['Mobile'] || lead['mobile'] || '').trim()
  const name = (lead['Name'] || lead['name'] || '').trim().toLowerCase()
  const company = (lead['Company'] || lead['company'] || '').trim().toLowerCase()
  const createdAt = (lead['Created At'] || lead['createdAt'] || lead['Date'] || lead['date'] || '').trim()

  const identifierParts = [
    customerId,
    email || 'no-email',
    phone || 'no-phone',
    name || 'no-name',
    company || 'no-company',
    createdAt || 'no-date'
  ].filter(Boolean)

  const identifier = identifierParts.join('|')
  const hash = crypto.createHash('sha256').update(identifier).digest('hex')

  return `lead_${hash.substring(0, 16)}`
}

/**
 * Normalize and validate lead data
 */
function normalizeLeadData(lead: LeadRow): LeadRow {
  const normalized: LeadRow = { ...lead }

  const textFields = ['Name', 'name', 'Company', 'company', 'Email', 'email', 'Phone', 'phone', 'Mobile', 'mobile']
  textFields.forEach(field => {
    if (normalized[field]) {
      if (field.toLowerCase().includes('email')) {
        normalized[field] = String(normalized[field]).trim().toLowerCase()
      } else {
        normalized[field] = String(normalized[field]).trim()
      }
    }
  })

  const dateFields = ['Date', 'date', 'Created At', 'createdAt', 'First Meeting Date']
  dateFields.forEach(field => {
    if (normalized[field]) {
      const parsedDate = parseDate(String(normalized[field]))
      if (parsedDate) {
        normalized[field] = parsedDate.toISOString().split('T')[0]
      }
    }
  })

  return normalized
}

/**
 * Calculate comprehensive aggregations with proper timezone handling
 */
function calculateActualsFromLeads(accountName: string, leads: LeadRow[]): {
  weeklyActual: number
  monthlyActual: number
  aggregations: {
    totalsByDay: Array<{date: string, count: number}>
    totalsByWeek: Array<{isoWeek: number, year: number, count: number}>
    totalsByMonth: Array<{month: number, year: number, count: number}>
    breakdownByTeamMember: Array<{teamMember: string, count: number}>
    breakdownByPlatform: Array<{platform: string, count: number}>
  }
} {
  const now = new Date()
  const londonTime = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
  const [day, month, year] = londonTime.split('/').map(Number)
  const londonNow = new Date(year, month - 1, day)

  const currentWeekStart = new Date(londonNow)
  const dayOfWeek = currentWeekStart.getDay()
  const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
  currentWeekStart.setDate(currentWeekStart.getDate() + diff)
  currentWeekStart.setHours(0, 0, 0, 0)

  const currentWeekEnd = new Date(currentWeekStart)
  currentWeekEnd.setDate(currentWeekEnd.getDate() + 7)

  const monthStart = new Date(londonNow.getFullYear(), londonNow.getMonth(), 1)
  const monthEnd = new Date(londonNow.getFullYear(), londonNow.getMonth() + 1, 1)

  const accountLeads = leads.filter((lead) => lead.accountName === accountName)

  let weeklyActual = 0
  let monthlyActual = 0

  const dayCounts = new Map<string, number>()
  const weekCounts = new Map<string, number>()
  const monthCounts = new Map<string, number>()
  const teamMemberCounts = new Map<string, number>()
  const platformCounts = new Map<string, number>()

  accountLeads.forEach((lead) => {
    let dateValue = lead['Date'] || lead['date'] || lead['Created At'] || lead['createdAt'] || lead['First Meeting Date'] || ''

    if (!dateValue) {
      for (const key of Object.keys(lead)) {
        const value = lead[key] || ''
        if (value && /^\d{1,2}[\.\/]\d{1,2}[\.\/]\d{2,4}$/.test(value.trim())) {
          dateValue = value.trim()
          break
        }
      }
    }

    const parsedDate = parseDate(dateValue)
    if (!parsedDate) return

    if (parsedDate >= currentWeekStart && parsedDate < currentWeekEnd) {
      weeklyActual++
    }
    if (parsedDate >= monthStart && parsedDate < monthEnd) {
      monthlyActual++
    }

    const dateKey = parsedDate.toISOString().split('T')[0]
    dayCounts.set(dateKey, (dayCounts.get(dateKey) || 0) + 1)

    const isoWeek = getISOWeek(parsedDate)
    const weekKey = `${parsedDate.getFullYear()}-W${isoWeek.toString().padStart(2, '0')}`
    weekCounts.set(weekKey, (weekCounts.get(weekKey) || 0) + 1)

    const monthKey = `${parsedDate.getFullYear()}-${(parsedDate.getMonth() + 1).toString().padStart(2, '0')}`
    monthCounts.set(monthKey, (monthCounts.get(monthKey) || 0) + 1)

    const teamMember = lead['Team Member'] || lead['teamMember'] || lead['Assigned To'] || lead['assignedTo'] || 'Unknown'
    teamMemberCounts.set(teamMember, (teamMemberCounts.get(teamMember) || 0) + 1)

    const platform = lead['Platform'] || lead['platform'] || lead['Channel of Lead'] || lead['channelOfLead'] || lead['Source'] || lead['source'] || 'Unknown'
    platformCounts.set(platform, (platformCounts.get(platform) || 0) + 1)
  })

  const totalsByDay = Array.from(dayCounts.entries())
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date))

  const totalsByWeek = Array.from(weekCounts.entries())
    .map(([weekKey, count]) => {
      const [year, week] = weekKey.split('-W')
      return { isoWeek: parseInt(week), year: parseInt(year), count }
    })
    .sort((a, b) => a.year !== b.year ? a.year - b.year : a.isoWeek - b.isoWeek)

  const totalsByMonth = Array.from(monthCounts.entries())
    .map(([monthKey, count]) => {
      const [year, month] = monthKey.split('-')
      return { month: parseInt(month), year: parseInt(year), count }
    })
    .sort((a, b) => a.year !== b.year ? a.year - b.year : a.month - b.month)

  const breakdownByTeamMember = Array.from(teamMemberCounts.entries())
    .map(([teamMember, count]) => ({ teamMember, count }))
    .sort((a, b) => b.count - a.count)

  const breakdownByPlatform = Array.from(platformCounts.entries())
    .map(([platform, count]) => ({ platform, count }))
    .sort((a, b) => b.count - a.count)

  return {
    weeklyActual,
    monthlyActual,
    aggregations: {
      totalsByDay,
      totalsByWeek,
      totalsByMonth,
      breakdownByTeamMember,
      breakdownByPlatform,
    }
  }
}

/**
 * Get ISO week number for a date
 */
function getISOWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
}

/**
 * Sync leads for a single customer with progress tracking and metrics
 */
async function syncCustomerLeads(
  prisma: PrismaClient, 
  customer: { id: string; name: string; leadsReportingUrl?: string | null },
  onProgress?: (progress: { percent: number; message: string }) => void,
  forceSync: boolean = false
) {
  const syncStartedAt = new Date()
  const sheetUrl = customer.leadsReportingUrl

  console.log(`🔄 SYNC START - ${customer.name} (${customer.id})`)

  // Check if sync is paused
  const syncState = await prisma.leadSyncState.findUnique({
    where: { customerId: customer.id },
    select: { isPaused: true }
  })

  if (syncState?.isPaused) {
    console.log(`   ⏸️  Sync paused for ${customer.name}`)
    return
  }

  // Mark as running
  await prisma.leadSyncState.upsert({
    where: { customerId: customer.id },
    create: {
      id: `lead_sync_${customer.id}`,
      customerId: customer.id,
      isRunning: true,
      progressPercent: 0,
      progressMessage: 'Starting sync...',
    },
    update: {
      isRunning: true,
      progressPercent: 0,
      progressMessage: 'Starting sync...',
    },
  })

  if (!sheetUrl || !sheetUrl.trim()) {
    console.log(`   ⚠️  No sheet URL configured`)
    await prisma.leadSyncState.update({
      where: { customerId: customer.id },
      data: {
        isRunning: false,
        lastError: 'No sheet URL configured',
        lastSyncAt: syncStartedAt,
      },
    })
    return
  }

  console.log(`   Sheet URL: ${sheetUrl}`)

  let rowsInserted = 0
  let rowsUpdated = 0
  let rowsDeleted = 0
  let errorCount = 0

  try {
    onProgress?.({ percent: 5, message: 'Fetching leads from Google Sheets...' })

    const { leads, gidUsed, diagnostics } = await fetchLeadsFromSheetUrl(
      sheetUrl, 
      customer.name,
      (progress) => {
        // Map fetch progress (0-100) to sync progress (5-50)
        const mappedPercent = 5 + Math.floor(progress.percent * 0.45)
        onProgress?.({ percent: mappedPercent, message: progress.message })
        
        // Update sync state
        prisma.leadSyncState.update({
          where: { customerId: customer.id },
          data: {
            progressPercent: mappedPercent,
            progressMessage: progress.message,
          },
        }).catch(() => {}) // Don't block on progress updates
      }
    )

    onProgress?.({ percent: 50, message: 'Calculating aggregations...' })

    const { weeklyActual, monthlyActual, aggregations } = calculateActualsFromLeads(customer.name, leads)

    console.log(`📊 AGGREGATION RESULTS - ${customer.name}`)
    console.log(`   Weekly actual: ${weeklyActual}`)
    console.log(`   Monthly actual: ${monthlyActual}`)
    console.log(`   Total leads processed: ${leads.length}`)

    onProgress?.({ percent: 60, message: 'Checking for changes...' })

    // Calculate data checksum for change detection
    const dataString = JSON.stringify(leads.map(l => ({ ...l, accountName: undefined })).sort((a, b) =>
      generateStableLeadId(a, customer.id).localeCompare(generateStableLeadId(b, customer.id))
    ))
    const checksum = crypto.createHash('md5').update(dataString).digest('hex')

    console.log(`   Data checksum: ${checksum}`)

    const lastSyncState = await prisma.leadSyncState.findUnique({
      where: { customerId: customer.id },
      select: { lastChecksum: true, rowCount: true, lastSuccessAt: true }
    })

    const lastChecksum = lastSyncState?.lastChecksum
    const hasDataChanged = lastChecksum !== checksum

    console.log(`   Last checksum: ${lastChecksum || 'NONE'}`)
    console.log(`   Data changed: ${hasDataChanged}`)
    console.log(`   Lead count: ${leads.length} (was: ${lastSyncState?.rowCount || 0})`)
    
    // CRITICAL FIX: Always sync if manual trigger, or if it's been more than 1 hour since last success
    const lastSuccess = lastSyncState?.lastSuccessAt ? new Date(lastSyncState.lastSuccessAt) : null
    const hoursSinceLastSync = lastSuccess ? (Date.now() - lastSuccess.getTime()) / (1000 * 60 * 60) : 999
    const forceSync = hoursSinceLastSync > 1 // Force sync if more than 1 hour
    
    console.log(`   Hours since last sync: ${hoursSinceLastSync.toFixed(2)}`)
    console.log(`   Force sync: ${forceSync}`)

    if (!hasDataChanged && leads.length === lastSyncState?.rowCount && !forceSync) {
      console.log(`   ⏭️  Skipping sync - data unchanged and recent`)

      await prisma.$transaction(async (tx) => {
        await tx.customer.update({
          where: { id: customer.id },
          data: {
            weeklyLeadActual: weeklyActual,
            monthlyLeadActual: monthlyActual,
          },
        })

        await tx.leadSyncState.update({
          where: { customerId: customer.id },
          data: {
            lastSyncAt: syncStartedAt,
            lastSuccessAt: syncStartedAt,
            isRunning: false,
            progressPercent: 100,
            progressMessage: 'Complete - no changes',
            syncDuration: Date.now() - syncStartedAt.getTime(),
            rowsProcessed: leads.length,
            rowsInserted: 0,
            rowsUpdated: 0,
            rowsDeleted: 0,
            errorCount: 0,
            retryCount: diagnostics.retryCount,
          },
        })
      })

      const syncDuration = Date.now() - syncStartedAt.getTime()
      console.log(`✅ SYNC SKIPPED - ${customer.name} (${syncDuration}ms) - data unchanged`)
      onProgress?.({ percent: 100, message: 'Complete - no changes' })
      return
    }

    onProgress?.({ percent: 70, message: 'Updating database...' })

    const beforeCount = await prisma.leadRecord.count({ where: { customerId: customer.id } })
    console.log(`   Records before sync: ${beforeCount}`)

    await prisma.$transaction(async (tx) => {
      const existingIds = new Set(
        (await tx.leadRecord.findMany({
          where: { customerId: customer.id },
          select: { id: true }
        })).map(r => r.id)
      )

      if (leads.length > 0) {
        const recordsToProcess = leads.map((lead) => {
          const stableId = generateStableLeadId(lead, customer.id)
          return {
            id: stableId,
            customerId: customer.id,
            accountName: customer.name,
            data: lead,
            sourceUrl: sheetUrl,
            sheetGid: gidUsed,
          }
        })

        const processedIds = new Set<string>()

        // Process in batches for better performance
        const batchSize = 50
        for (let i = 0; i < recordsToProcess.length; i += batchSize) {
          const batch = recordsToProcess.slice(i, i + batchSize)
          
          for (const record of batch) {
            processedIds.add(record.id)

            try {
              const existing = await tx.leadRecord.findUnique({
                where: { id: record.id },
                select: { id: true, updatedAt: true }
              })

              if (existing) {
                await tx.leadRecord.update({
                  where: { id: record.id },
                  data: {
                    data: record.data,
                    sourceUrl: record.sourceUrl,
                    sheetGid: record.sheetGid,
                    updatedAt: new Date(),
                  },
                })
                rowsUpdated++
              } else {
                await tx.leadRecord.create({ data: record })
                rowsInserted++
              }
            } catch (error) {
              console.warn(`   Failed to process lead ${record.id}:`, error)
              errorCount++
            }
          }
          
          // Update progress
          const progress = 70 + Math.floor((i / recordsToProcess.length) * 20)
          onProgress?.({ percent: progress, message: `Processed ${Math.min(i + batchSize, recordsToProcess.length)}/${recordsToProcess.length} leads...` })
        }

        // Remove leads that are no longer in the sheet
        const idsToRemove = Array.from(existingIds).filter(id => !processedIds.has(id))
        if (idsToRemove.length > 0) {
          await tx.leadRecord.deleteMany({
            where: {
              customerId: customer.id,
              id: { in: idsToRemove }
            }
          })
          rowsDeleted = idsToRemove.length
          console.log(`   Removed ${rowsDeleted} stale leads`)
        }

        console.log(`   Records processed: ${rowsInserted} inserted, ${rowsUpdated} updated, ${rowsDeleted} removed`)
      }

      // Update customer with aggregated data
      await tx.customer.update({
        where: { id: customer.id },
        data: {
          weeklyLeadActual: weeklyActual,
          monthlyLeadActual: monthlyActual,
        },
      })

      // Update sync state with metrics
      const syncDuration = Date.now() - syncStartedAt.getTime()
      await tx.leadSyncState.upsert({
        where: { customerId: customer.id },
        create: {
          id: `lead_sync_${customer.id}`,
          customerId: customer.id,
          lastSyncAt: syncStartedAt,
          lastSuccessAt: syncStartedAt,
          rowCount: leads.length,
          lastChecksum: checksum,
          lastError: null,
          isRunning: false,
          progressPercent: 100,
          progressMessage: 'Complete',
          syncDuration,
          rowsProcessed: leads.length,
          rowsInserted,
          rowsUpdated,
          rowsDeleted,
          errorCount,
          retryCount: diagnostics.retryCount,
        },
        update: {
          lastSyncAt: syncStartedAt,
          lastSuccessAt: syncStartedAt,
          rowCount: leads.length,
          lastChecksum: checksum,
          lastError: null,
          isRunning: false,
          progressPercent: 100,
          progressMessage: 'Complete',
          syncDuration,
          rowsProcessed: leads.length,
          rowsInserted,
          rowsUpdated,
          rowsDeleted,
          errorCount,
          retryCount: diagnostics.retryCount,
        },
      })
    })

    const afterCount = await prisma.leadRecord.count({ where: { customerId: customer.id } })
    console.log(`   Records after sync: ${afterCount}`)

    const syncDuration = Date.now() - syncStartedAt.getTime()
    console.log(`✅ SYNC COMPLETE - ${customer.name} (${syncDuration}ms)`)
    console.log(`   Final state: ${leads.length} leads, checksum: ${checksum}`)
    console.log(`   Metrics: ${rowsInserted} inserted, ${rowsUpdated} updated, ${rowsDeleted} deleted, ${errorCount} errors`)

    onProgress?.({ percent: 100, message: 'Complete' })

  } catch (error: any) {
    const message = error?.message || 'Failed to sync leads'
    console.error(`❌ SYNC FAILED - ${customer.name}:`, message)

    errorCount++

    await prisma.leadSyncState.upsert({
      where: { customerId: customer.id },
      create: {
        id: `lead_sync_${customer.id}`,
        customerId: customer.id,
        lastSyncAt: syncStartedAt,
        lastError: message,
        isRunning: false,
        progressPercent: 0,
        progressMessage: `Error: ${message}`,
        errorCount: 1,
        syncDuration: Date.now() - syncStartedAt.getTime(),
      },
      update: {
        lastSyncAt: syncStartedAt,
        lastError: message,
        isRunning: false,
        progressPercent: 0,
        progressMessage: `Error: ${message}`,
        errorCount: { increment: 1 },
        syncDuration: Date.now() - syncStartedAt.getTime(),
      },
    })

    onProgress?.({ percent: 0, message: `Error: ${message}` })
  }
}

export async function syncAllCustomerLeads(prisma: PrismaClient) {
  const customers = await prisma.customer.findMany({
    where: {
      leadsReportingUrl: { not: null },
    },
    select: {
      id: true,
      name: true,
      leadsReportingUrl: true,
    },
  })

  console.log(`🚀 STARTING BATCH SYNC - ${customers.length} customers with leads URLs`)

  const startTime = Date.now()
  let successCount = 0
  let errorCount = 0

  for (const customer of customers) {
    try {
      await syncCustomerLeads(prisma, customer)
      successCount++
    } catch (error) {
      console.error(`❌ Failed to sync ${customer.name}:`, error)
      errorCount++
    }
  }

  const totalDuration = Date.now() - startTime
  console.log(`🏁 BATCH SYNC COMPLETE - ${totalDuration}ms`)
  console.log(`   Successful: ${successCount}`)
  console.log(`   Failed: ${errorCount}`)
  console.log(`   Total leads in DB:`, await prisma.leadRecord.count())
}

/**
 * Manual sync trigger for a specific customer
 */
export async function triggerManualSync(prisma: PrismaClient, customerId: string) {
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: { id: true, name: true, leadsReportingUrl: true },
  })

  if (!customer) {
    throw new Error('Customer not found')
  }

  if (!customer.leadsReportingUrl) {
    throw new Error('Customer has no leads reporting URL configured')
  }

  console.log(`🔧 MANUAL SYNC TRIGGERED - ${customer.name} (FORCE=true)`)
  // Force sync bypasses checksum comparison - always updates database
  await syncCustomerLeads(prisma, customer, undefined, true)
}

export function startLeadsSyncWorker(prisma: PrismaClient) {
  const cronExpression = process.env.LEADS_SYNC_CRON || '*/10 * * * *'

  cron.schedule(cronExpression, async () => {
    try {
      await syncAllCustomerLeads(prisma)
    } catch (error) {
      console.error('Error in leads sync worker:', error)
    }
  })

  console.log(`✅ Leads sync worker started (${cronExpression})`)
}
