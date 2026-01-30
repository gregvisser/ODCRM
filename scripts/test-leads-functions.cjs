#!/usr/bin/env node

/**
 * Test script for leads sync functions
 * Tests parsing, normalization, ID generation, and aggregation
 */

const crypto = require('crypto')

// Import functions from the leadsSync module
// Since it's TypeScript, we'll need to copy the functions here for testing

function parseCsv(csvText) {
  const lines = []
  let currentLine = []
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

function parseDate(value) {
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

function generateStableLeadId(lead, customerId) {
  // First normalize the lead data
  const normalized = normalizeLeadData(lead)

  // Use the most stable identifying fields
  const email = (normalized['Email'] || normalized['email'] || '').trim().toLowerCase()
  const phone = (normalized['Phone'] || normalized['phone'] || normalized['Mobile'] || normalized['mobile'] || '').trim()
  const name = (normalized['Name'] || normalized['name'] || '').trim().toLowerCase()
  const company = (normalized['Company'] || normalized['company'] || '').trim().toLowerCase()
  const createdAt = (normalized['Created At'] || normalized['createdAt'] || normalized['Date'] || normalized['date'] || '').trim()

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
  const hash = crypto.createHash('sha256').update(identifier).digest('hex')

  return `lead_${hash.substring(0, 16)}`
}

function normalizeLeadData(lead) {
  const normalized = { ...lead }

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

function getISOWeek(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
}

function calculateActualsFromLeads(accountName, leads) {
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
  const dayCounts = new Map()
  const weekCounts = new Map()
  const monthCounts = new Map()
  const teamMemberCounts = new Map()
  const platformCounts = new Map()

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

// Test functions
function runTests() {
  console.log('🧪 Running leads function tests...\n')

  // Test 1: Date parsing
  console.log('1. Testing date parsing:')
  const testDates = [
    ['25.12.2023', 'DD.MM.YYYY'],
    ['25.12.23', 'DD.MM.YY'],
    ['2023-12-25', 'YYYY-MM-DD'],
    ['12/25/2023', 'MM/DD/YYYY'],
    ['25/12/2023', 'DD/MM/YYYY'],
    ['invalid date', 'invalid'],
  ]

  testDates.forEach(([input, expected]) => {
    const result = parseDate(input)
    const output = result ? result.toISOString().split('T')[0] : 'null'
    console.log(`   "${input}" (${expected}) → ${output}`)
  })

  // Test 2: ID generation stability
  console.log('\n2. Testing stable ID generation:')
  const testLead1 = {
    accountName: 'TestAccount',
    Name: 'John Doe',
    Email: 'john@example.com',
    Phone: '123456789',
    Date: '2023-12-25'
  }
  const testLead2 = {
    accountName: 'TestAccount',
    name: 'John Doe',
    email: 'JOHN@EXAMPLE.COM', // Different casing
    phone: '123456789',
    date: '25.12.2023' // Different format
  }

  const id1 = generateStableLeadId(testLead1, 'customer123')
  const id2 = generateStableLeadId(testLead2, 'customer123')

  console.log(`   Lead 1 ID: ${id1}`)
  console.log(`   Lead 2 ID: ${id2}`)
  console.log(`   IDs match: ${id1 === id2 ? '✅' : '❌'}`)

  // Test 3: Normalization
  console.log('\n3. Testing data normalization:')
  const rawLead = {
    accountName: 'TestAccount',
    Name: '  john doe  ',
    Email: '  JOHN@EXAMPLE.COM  ',
    Date: '25.12.2023',
    Phone: '  123-456-789  '
  }

  const normalized = normalizeLeadData(rawLead)
  console.log('   Raw:', JSON.stringify(rawLead))
  console.log('   Normalized:', JSON.stringify(normalized))

  // Test 4: CSV parsing
  console.log('\n4. Testing CSV parsing:')
  const csvData = `Name,Email,Date,Company
John Doe,john@example.com,25.12.2023,ACME Corp
Jane Smith,jane@example.com,26.12.2023,"Quoted, Company"
Bob Wilson,bob@example.com,27.12.2023,XYZ Ltd`

  const rows = parseCsv(csvData)
  console.log(`   Parsed ${rows.length} rows:`)
  rows.forEach((row, i) => {
    console.log(`     Row ${i}: ${JSON.stringify(row)}`)
  })

  // Test 5: Aggregation
  console.log('\n5. Testing aggregation:')
  // Create test leads with current dates for realistic weekly/monthly testing
  const now = new Date()
  const today = now.toISOString().split('T')[0]
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  const testLeads = [
    {
      accountName: 'TestAccount',
      Name: 'John Doe',
      Email: 'john@example.com',
      Date: today,
      'Team Member': 'Alice',
      Platform: 'LinkedIn'
    },
    {
      accountName: 'TestAccount',
      Name: 'Jane Smith',
      Email: 'jane@example.com',
      Date: yesterday,
      'Team Member': 'Alice',
      Platform: 'Email'
    },
    {
      accountName: 'TestAccount',
      Name: 'Bob Wilson',
      Email: 'bob@example.com',
      Date: lastWeek,
      'Team Member': 'Bob',
      Platform: 'LinkedIn'
    }
  ]

  const result = calculateActualsFromLeads('TestAccount', testLeads)
  console.log(`   Weekly actual: ${result.weeklyActual}`)
  console.log(`   Monthly actual: ${result.monthlyActual}`)
  console.log(`   Daily totals: ${result.aggregations.totalsByDay.length} days`)
  console.log(`   Team breakdown: ${JSON.stringify(result.aggregations.breakdownByTeamMember)}`)
  console.log(`   Platform breakdown: ${JSON.stringify(result.aggregations.breakdownByPlatform)}`)

  console.log('\n✅ All tests completed!')
}

// Run tests if called directly
if (require.main === module) {
  runTests()
}

module.exports = {
  parseCsv,
  parseDate,
  generateStableLeadId,
  normalizeLeadData,
  calculateActualsFromLeads
}