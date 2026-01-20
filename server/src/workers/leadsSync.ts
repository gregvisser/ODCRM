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

async function fetchLeadsFromSheetUrl(sheetUrl: string, accountName: string): Promise<{ leads: LeadRow[]; gidUsed?: string }> {
  const sheetId = extractSheetId(sheetUrl)
  if (!sheetId) {
    throw new Error('Invalid Google Sheets URL format')
  }

  const extractedGid = extractGid(sheetUrl)
  const gidsToTry = extractedGid ? [extractedGid, '0'] : ['0']

  let lastError: Error | null = null

  for (const gid of gidsToTry) {
    try {
      const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`
      const response = await fetch(csvUrl, {
        headers: {
          Accept: 'text/csv, text/plain, */*',
        },
      })

      if (!response.ok) {
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
      if (csvText.trim().startsWith('<!DOCTYPE') || csvText.trim().startsWith('<html')) {
        lastError = new Error('Received HTML instead of CSV')
        continue
      }

      const rows = parseCsv(csvText)
      if (rows.length < 2) {
        return { leads: [], gidUsed: gid }
      }

      const headers = rows[0].map((h) => h.trim())
      const leads: LeadRow[] = []

      for (let i = 1; i < rows.length; i++) {
        const row = rows[i]
        if (row.length === 0 || row.every((cell) => !cell || cell.trim() === '')) {
          continue
        }

        const lead: LeadRow = { accountName }
        headers.forEach((header, index) => {
          const value = row[index] || ''
          if (header) {
            lead[header] = value
          }
        })

        const containsWcOrWv = Object.values(lead).some((value) => {
          const lowerValue = value ? String(value).toLowerCase() : ''
          return lowerValue.includes('w/c') || lowerValue.includes('w/v')
        })
        if (containsWcOrWv) {
          continue
        }

        const nameValue = lead['Name'] || lead['name'] || ''
        const companyValue = lead['Company'] || lead['company'] || ''
        const hasName = nameValue && nameValue.trim() !== ''
        const hasCompany = companyValue && companyValue.trim() !== ''
        if (!hasName && !hasCompany) {
          continue
        }

        const nonEmptyFields = Object.keys(lead).filter(
          (key) => key !== 'accountName' && lead[key] && lead[key].trim() !== '',
        )
        if (nonEmptyFields.length >= 2) {
          leads.push(lead)
        }
      }

      return { leads, gidUsed: gid }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Failed to parse CSV data')
      continue
    }
  }

  throw lastError || new Error('Failed to fetch leads from Google Sheet')
}

function parseDate(value: string): Date | null {
  if (!value || !value.trim()) return null
  const trimmed = value.trim()

  const ddmmyy = trimmed.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2}|\d{4})$/)
  if (ddmmyy) {
    const day = parseInt(ddmmyy[1], 10)
    const month = parseInt(ddmmyy[2], 10) - 1
    let year = parseInt(ddmmyy[3], 10)
    if (year < 100) year += 2000
    const date = new Date(year, month, day)
    if (!isNaN(date.getTime())) return date
  }

  const yyyymmdd = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (yyyymmdd) {
    const year = parseInt(yyyymmdd[1], 10)
    const month = parseInt(yyyymmdd[2], 10) - 1
    const day = parseInt(yyyymmdd[3], 10)
    const date = new Date(year, month, day)
    if (!isNaN(date.getTime())) return date
  }

  const parsed = new Date(trimmed)
  if (!isNaN(parsed.getTime())) {
    const year = parsed.getFullYear()
    if (year >= 2000 && year <= 2100) {
      return parsed
    }
  }

  return null
}

function calculateActualsFromLeads(accountName: string, leads: LeadRow[]): { weeklyActual: number; monthlyActual: number } {
  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  const currentWeekStart = new Date(startOfToday)
  const dayOfWeek = currentWeekStart.getDay()
  const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
  currentWeekStart.setDate(currentWeekStart.getDate() + diff)
  currentWeekStart.setHours(0, 0, 0, 0)

  const currentWeekEnd = new Date(currentWeekStart)
  currentWeekEnd.setDate(currentWeekEnd.getDate() + 7)

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  monthStart.setHours(0, 0, 0, 0)
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1)

  const accountLeads = leads.filter((lead) => lead.accountName === accountName)
  let weeklyActual = 0
  let monthlyActual = 0

  accountLeads.forEach((lead) => {
    let dateValue = ''

    for (const key of Object.keys(lead)) {
      const value = lead[key] || ''
      if (value && value.trim() && /^\d{1,2}\.\d{1,2}\.\d{2,4}$/.test(value.trim())) {
        dateValue = value.trim()
        break
      }
    }

    if (!dateValue) {
      dateValue =
        lead['Date'] ||
        lead['date'] ||
        lead['Week'] ||
        lead['week'] ||
        lead['First Meeting Date'] ||
        ''
    }

    const parsedDate = parseDate(dateValue)
    if (!parsedDate) return

    if (parsedDate >= currentWeekStart && parsedDate < currentWeekEnd) {
      weeklyActual++
    }

    if (parsedDate >= monthStart && parsedDate < monthEnd) {
      monthlyActual++
    }
  })

  return { weeklyActual, monthlyActual }
}

async function syncCustomerLeads(prisma: PrismaClient, customer: { id: string; name: string; leadsReportingUrl?: string | null }) {
  const syncStartedAt = new Date()
  const sheetUrl = customer.leadsReportingUrl

  if (!sheetUrl || !sheetUrl.trim()) {
    return
  }

  try {
    const { leads, gidUsed } = await fetchLeadsFromSheetUrl(sheetUrl, customer.name)
    const { weeklyActual, monthlyActual } = calculateActualsFromLeads(customer.name, leads)

    await prisma.$transaction(async (tx) => {
      await tx.leadRecord.deleteMany({ where: { customerId: customer.id } })

      if (leads.length > 0) {
        await tx.leadRecord.createMany({
          data: leads.map((lead) => ({
            id: `lead_${crypto.randomUUID()}`,
            customerId: customer.id,
            accountName: customer.name,
            data: lead,
            sourceUrl: sheetUrl,
            sheetGid: gidUsed,
          })),
        })
      }

      await tx.customer.update({
        where: { id: customer.id },
        data: {
          weeklyLeadActual: weeklyActual,
          monthlyLeadActual: monthlyActual,
        },
      })

      await tx.leadSyncState.upsert({
        where: { customerId: customer.id },
        create: {
          id: `lead_sync_${customer.id}`,
          customerId: customer.id,
          lastSyncAt: syncStartedAt,
          lastSuccessAt: syncStartedAt,
          rowCount: leads.length,
          lastError: null,
        },
        update: {
          lastSyncAt: syncStartedAt,
          lastSuccessAt: syncStartedAt,
          rowCount: leads.length,
          lastError: null,
        },
      })
    })
  } catch (error: any) {
    const message = error?.message || 'Failed to sync leads'
    console.error(`Error syncing leads for ${customer.name}:`, message)
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

  for (const customer of customers) {
    await syncCustomerLeads(prisma, customer)
  }
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
