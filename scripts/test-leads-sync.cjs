#!/usr/bin/env node

/**
 * Development script to test leads sync functionality
 * Usage: node scripts/test-leads-sync.cjs "https://docs.google.com/spreadsheets/d/..."
 */

const https = require('https')
const crypto = require('crypto')

function extractSheetId(url) {
  try {
    const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)
    return match ? match[1] : null
  } catch {
    return null
  }
}

function extractGid(url) {
  try {
    const match = url.match(/gid=([0-9]+)/)
    return match ? match[1] : null
  } catch {
    return null
  }
}

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

async function fetchLeadsFromSheetUrl(sheetUrl, accountName = 'TestAccount') {
  const sheetId = extractSheetId(sheetUrl)
  if (!sheetId) {
    throw new Error('Invalid Google Sheets URL format')
  }

  const extractedGid = extractGid(sheetUrl)
  const gidsToTry = extractedGid ? [extractedGid, '0'] : ['0']

  for (const gid of gidsToTry) {
    try {
      const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`

      console.log(`Trying GID ${gid}: ${csvUrl}`)

      const response = await new Promise((resolve, reject) => {
        https.get(csvUrl, {
          headers: {
            'Accept': 'text/csv, text/plain, */*',
            'User-Agent': 'ODCRM-LeadsSync-Test/1.0'
          }
        }, (res) => {
          let data = ''
          res.on('data', chunk => data += chunk)
          res.on('end', () => resolve({ statusCode: res.statusCode, data }))
        }).on('error', reject)
      })

      if (response.statusCode !== 200) {
        console.log(`HTTP ${response.statusCode} for GID ${gid}`)
        continue
      }

      const csvText = response.data
      if (csvText.trim().startsWith('<!DOCTYPE') || csvText.trim().startsWith('<html')) {
        console.log(`Received HTML for GID ${gid}`)
        continue
      }

      const rows = parseCsv(csvText)
      console.log(`Parsed ${rows.length} rows`)

      if (rows.length < 2) {
        return { leads: [], diagnostics: { totalRows: rows.length, message: 'No data rows' } }
      }

      const headers = rows[0].map(h => h.trim())
      console.log(`Headers: ${headers.join(', ')}`)

      const leads = []

      for (let i = 1; i < rows.length; i++) {
        const row = rows[i]
        if (row.length === 0 || row.every(cell => !cell || cell.trim() === '')) {
          continue
        }

        const lead = { accountName }
        headers.forEach((header, index) => {
          const value = row[index] || ''
          if (header) {
            lead[header] = value
          }
        })

        // Apply same filtering as production
        const containsWcOrWv = Object.values(lead).some(value => {
          const lowerValue = value ? String(value).toLowerCase() : ''
          return lowerValue.includes('w/c') || lowerValue.includes('w/v')
        })
        if (containsWcOrWv) continue

        const nameValue = lead['Name'] || lead['name'] || ''
        const companyValue = lead['Company'] || lead['company'] || ''
        const hasName = nameValue && nameValue.trim() !== ''
        const hasCompany = companyValue && companyValue.trim() !== ''
        if (!hasName && !hasCompany) continue

        const nonEmptyFields = Object.keys(lead).filter(
          key => key !== 'accountName' && lead[key] && lead[key].trim() !== ''
        )
        if (nonEmptyFields.length >= 2) {
          leads.push(lead)
        }
      }

      return {
        leads,
        diagnostics: {
          sheetId,
          gidUsed: gid,
          totalRows: rows.length,
          headers,
          finalLeads: leads.length,
          csvSize: csvText.length
        }
      }
    } catch (error) {
      console.log(`Error with GID ${gid}: ${error.message}`)
      continue
    }
  }

  throw new Error('Failed to fetch leads from Google Sheet')
}

async function main() {
  const sheetUrl = process.argv[2]
  if (!sheetUrl) {
    console.error('Usage: node scripts/test-leads-sync.cjs "https://docs.google.com/spreadsheets/d/..."')
    process.exit(1)
  }

  try {
    console.log('🧪 Testing leads sync...')
    console.log(`Sheet URL: ${sheetUrl}`)

    const { leads, diagnostics } = await fetchLeadsFromSheetUrl(sheetUrl)

    console.log('\n📊 DIAGNOSTICS:')
    console.log(JSON.stringify(diagnostics, null, 2))

    console.log(`\n✅ Found ${leads.length} leads`)

    if (leads.length > 0) {
      console.log('\n📋 SAMPLE LEADS:')
      leads.slice(0, 3).forEach((lead, i) => {
        console.log(`\nLead ${i + 1}:`)
        console.log(JSON.stringify(lead, null, 2))
      })

      // Calculate checksum
      const dataString = JSON.stringify(leads, Object.keys(leads[0]).sort())
      const checksum = crypto.createHash('md5').update(dataString).digest('hex')
      console.log(`\n🔐 Data checksum: ${checksum}`)
    }

    // Save to file for comparison
    const fs = require('fs')
    const output = {
      timestamp: new Date().toISOString(),
      sheetUrl,
      diagnostics,
      leads
    }

    const filename = `leads-test-${Date.now()}.json`
    fs.writeFileSync(filename, JSON.stringify(output, null, 2))
    console.log(`\n💾 Saved results to ${filename}`)

  } catch (error) {
    console.error('❌ Error:', error.message)
    process.exit(1)
  }
}

main()