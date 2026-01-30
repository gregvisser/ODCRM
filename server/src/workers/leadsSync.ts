// @ts-nocheck
import cron from 'node-cron'
import crypto from 'crypto'
import type { PrismaClient } from '@prisma/client'

type LeadRow = {
  [key: string]: string
  accountName: string
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

function parseCsv(csvText: string): string[][] {
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

async function fetchLeadsFromSheetUrl(sheetUrl: string, accountName: string): Promise<{ leads: LeadRow[]; gidUsed?: string; diagnostics: any }> {
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
  }

  for (const gid of gidsToTry) {
    try {
      diagnostics.gidsAttempted.push(gid)
      const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`

      console.log(`   Trying GID ${gid}: ${csvUrl}`)

      const fetchStart = Date.now()
      const response = await fetch(csvUrl, {
        headers: {
          Accept: 'text/csv, text/plain, */*',
          'User-Agent': 'ODCRM-LeadsSync/1.0',
        },
      })
      const fetchDuration = Date.now() - fetchStart

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

      const csvText = await response.text()
      diagnostics.csvSize = csvText.length
      diagnostics.fetchDuration = fetchDuration

      console.log(`   Downloaded ${diagnostics.csvSize} bytes`)

      if (csvText.trim().startsWith('<!DOCTYPE') || csvText.trim().startsWith('<html')) {
        const errorMsg = 'Received HTML instead of CSV'
        diagnostics.errors.push(errorMsg)
        console.log(`   ❌ ${errorMsg}`)
        lastError = new Error(errorMsg)
        continue
      }

      const rows = parseCsv(csvText)
      diagnostics.totalRows = rows.length

      console.log(`   Parsed ${diagnostics.totalRows} rows from CSV`)

      if (rows.length < 2) {
        console.log(`   ⚠️  Only ${rows.length} rows (need at least 2 for headers + data)`)
        return { leads: [], gidUsed: gid, diagnostics }
      }

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

      const leads: LeadRow[] = []
      let filteredEmpty = 0
      let filteredWcWv = 0
      let filteredNoNameCompany = 0
      let filteredTooFewFields = 0

      for (const row of dataRows) {
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

        // Filter out W/C and W/V rows (seems to be a business rule for excluding certain entries)
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

  // MM/DD/YYYY (US format) - less common but handle it
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
  if (ddmmyyyy && !mmddyyyy) { // Only if not already matched as MM/DD/YYYY
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
 * This prevents duplicates and provides consistent identification across syncs.
 */
function generateStableLeadId(lead: LeadRow, customerId: string): string {
  // Use the most stable identifying fields
  const email = (lead['Email'] || lead['email'] || '').trim().toLowerCase()
  const phone = (lead['Phone'] || lead['phone'] || lead['Mobile'] || lead['mobile'] || '').trim()
  const name = (lead['Name'] || lead['name'] || '').trim().toLowerCase()
  const company = (lead['Company'] || lead['company'] || '').trim().toLowerCase()
  const createdAt = (lead['Created At'] || lead['createdAt'] || lead['Date'] || lead['date'] || '').trim()

  // Create a deterministic identifier from available fields
  const identifierParts = [
    customerId,
    email || 'no-email',
    phone || 'no-phone',
    name || 'no-name',
    company || 'no-company',
    createdAt || 'no-date'
  ].filter(Boolean)

  const identifier = identifierParts.join('|')

  // Create hash for stable ID
  const crypto = require('crypto')
  const hash = crypto.createHash('sha256').update(identifier).digest('hex')

  return `lead_${hash.substring(0, 16)}`
}

/**
 * Normalize and validate lead data
 */
function normalizeLeadData(lead: LeadRow): LeadRow {
  const normalized: LeadRow = { ...lead }

  // Normalize text fields (trim, consistent casing for known fields)
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

  // Validate and normalize dates
  const dateFields = ['Date', 'date', 'Created At', 'createdAt', 'First Meeting Date']
  dateFields.forEach(field => {
    if (normalized[field]) {
      const parsedDate = parseDate(String(normalized[field]))
      if (parsedDate) {
        // Store as ISO string for consistency
        normalized[field] = parsedDate.toISOString().split('T')[0] // YYYY-MM-DD format
      }
    }
  })

  return normalized
}

/**
 * Calculate comprehensive aggregations with proper timezone handling
 * Uses Europe/London timezone for consistency with UK business operations
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
  // Use Europe/London timezone for all calculations
  const now = new Date()
  const londonTime = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
  const [day, month, year] = londonTime.split('/').map(Number)
  const londonNow = new Date(year, month - 1, day)

  // Calculate current week (Monday-Sunday)
  const currentWeekStart = new Date(londonNow)
  const dayOfWeek = currentWeekStart.getDay()
  const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek // Monday = 1, Sunday = 0
  currentWeekStart.setDate(currentWeekStart.getDate() + diff)
  currentWeekStart.setHours(0, 0, 0, 0)

  const currentWeekEnd = new Date(currentWeekStart)
  currentWeekEnd.setDate(currentWeekEnd.getDate() + 7)

  // Current month
  const monthStart = new Date(londonNow.getFullYear(), londonNow.getMonth(), 1)
  const monthEnd = new Date(londonNow.getFullYear(), londonNow.getMonth() + 1, 1)

  const accountLeads = leads.filter((lead) => lead.accountName === accountName)

  let weeklyActual = 0
  let monthlyActual = 0

  // Aggregation data structures
  const dayCounts = new Map<string, number>()
  const weekCounts = new Map<string, number>()
  const monthCounts = new Map<string, number>()
  const teamMemberCounts = new Map<string, number>()
  const platformCounts = new Map<string, number>()

  accountLeads.forEach((lead) => {
    // Find date value from various possible fields
    let dateValue = lead['Date'] || lead['date'] || lead['Created At'] || lead['createdAt'] || lead['First Meeting Date'] || ''

    // Also check for date-like values in other fields
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

    // Weekly/Monthly actuals (legacy compatibility)
    if (parsedDate >= currentWeekStart && parsedDate < currentWeekEnd) {
      weeklyActual++
    }
    if (parsedDate >= monthStart && parsedDate < monthEnd) {
      monthlyActual++
    }

    // Daily aggregations
    const dateKey = parsedDate.toISOString().split('T')[0] // YYYY-MM-DD
    dayCounts.set(dateKey, (dayCounts.get(dateKey) || 0) + 1)

    // Weekly aggregations (ISO week)
    const isoWeek = getISOWeek(parsedDate)
    const weekKey = `${parsedDate.getFullYear()}-W${isoWeek.toString().padStart(2, '0')}`
    weekCounts.set(weekKey, (weekCounts.get(weekKey) || 0) + 1)

    // Monthly aggregations
    const monthKey = `${parsedDate.getFullYear()}-${(parsedDate.getMonth() + 1).toString().padStart(2, '0')}`
    monthCounts.set(monthKey, (monthCounts.get(monthKey) || 0) + 1)

    // Team member aggregations
    const teamMember = lead['Team Member'] || lead['teamMember'] || lead['Assigned To'] || lead['assignedTo'] || 'Unknown'
    teamMemberCounts.set(teamMember, (teamMemberCounts.get(teamMember) || 0) + 1)

    // Platform/source aggregations
    const platform = lead['Platform'] || lead['platform'] || lead['Channel of Lead'] || lead['channelOfLead'] || lead['Source'] || lead['source'] || 'Unknown'
    platformCounts.set(platform, (platformCounts.get(platform) || 0) + 1)
  })

  // Convert maps to sorted arrays
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

async function syncCustomerLeads(prisma: PrismaClient, customer: { id: string; name: string; leadsReportingUrl?: string | null }) {
  const syncStartedAt = new Date()
  const sheetUrl = customer.leadsReportingUrl

  console.log(`🔄 SYNC START - ${customer.name} (${customer.id})`)

  if (!sheetUrl || !sheetUrl.trim()) {
    console.log(`   ⚠️  No sheet URL configured`)
    return
  }

  console.log(`   Sheet URL: ${sheetUrl}`)

  try {
    const { leads, gidUsed, diagnostics } = await fetchLeadsFromSheetUrl(sheetUrl, customer.name)
    const { weeklyActual, monthlyActual, aggregations } = calculateActualsFromLeads(customer.name, leads)

    console.log(`📊 AGGREGATION RESULTS - ${customer.name}`)
    console.log(`   Weekly actual: ${weeklyActual}`)
    console.log(`   Monthly actual: ${monthlyActual}`)
    console.log(`   Total leads processed: ${leads.length}`)

    // Calculate data checksum for change detection
    const crypto = await import('crypto')
    const dataString = JSON.stringify(leads.map(l => ({ ...l, accountName: undefined })).sort((a, b) =>
      generateStableLeadId(a, customer.id).localeCompare(generateStableLeadId(b, customer.id))
    ))
    const checksum = crypto.createHash('md5').update(dataString).digest('hex')

    console.log(`   Data checksum: ${checksum}`)

    // Check if data has actually changed since last sync
    const lastSyncState = await prisma.leadSyncState.findUnique({
      where: { customerId: customer.id },
      select: { lastChecksum: true, rowCount: true }
    })

    const lastChecksum = lastSyncState?.lastChecksum
    const hasDataChanged = lastChecksum !== checksum

    console.log(`   Last checksum: ${lastChecksum || 'NONE'}`)
    console.log(`   Data changed: ${hasDataChanged}`)

    if (!hasDataChanged && leads.length === lastSyncState?.rowCount) {
      console.log(`   ⏭️  Skipping sync - data unchanged`)

      // Still update sync timestamp and aggregations (they might have changed due to time-based calculations)
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
          },
        })
      })

      const syncDuration = Date.now() - syncStartedAt.getTime()
      console.log(`✅ SYNC SKIPPED - ${customer.name} (${syncDuration}ms) - data unchanged`)
      return
    }

    const beforeCount = await prisma.leadRecord.count({ where: { customerId: customer.id } })
    console.log(`   Records before sync: ${beforeCount}`)

    await prisma.$transaction(async (tx) => {
      // For incremental sync, we need to handle updates more carefully
      // For now, we'll do a full replace but track what changed
      const existingIds = new Set(
        (await tx.leadRecord.findMany({
          where: { customerId: customer.id },
          select: { id: true }
        })).map(r => r.id)
      )

      // Insert/update new records with stable IDs
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

        // Track changes
        let inserted = 0
        let updated = 0
        const processedIds = new Set<string>()

        for (const record of recordsToProcess) {
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
              updated++
            } else {
              await tx.leadRecord.create({ data: record })
              inserted++
            }
          } catch (error) {
            console.warn(`   Failed to process lead ${record.id}:`, error)
          }
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
          console.log(`   Removed ${idsToRemove.length} stale leads`)
        }

        console.log(`   Records processed: ${inserted} inserted, ${updated} updated, ${idsToRemove.length} removed`)
      }

      // Update customer with aggregated data
      await tx.customer.update({
        where: { id: customer.id },
        data: {
          weeklyLeadActual: weeklyActual,
          monthlyLeadActual: monthlyActual,
        },
      })

      // Update sync state with checksum for change detection
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
        },
        update: {
          lastSyncAt: syncStartedAt,
          lastSuccessAt: syncStartedAt,
          rowCount: leads.length,
          lastChecksum: checksum,
          lastError: null,
        },
      })
    })

    const afterCount = await prisma.leadRecord.count({ where: { customerId: customer.id } })
    console.log(`   Records after sync: ${afterCount}`)

    const syncDuration = Date.now() - syncStartedAt.getTime()
    console.log(`✅ SYNC COMPLETE - ${customer.name} (${syncDuration}ms)`)
    console.log(`   Final state: ${leads.length} leads, checksum: ${checksum}`)

  } catch (error: any) {
    const message = error?.message || 'Failed to sync leads'
    console.error(`❌ SYNC FAILED - ${customer.name}:`, message)

    await prisma.leadSyncState.upsert({
      where: { customerId: customer.id },
      create: {
        id: `lead_sync_${customer.id}`,
        customerId: customer.id,
        lastSyncAt: syncStartedAt,
        lastError: message,
      },
      update: {
        lastSyncAt: syncStartedAt,
        lastError: message,
      },
    })
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
