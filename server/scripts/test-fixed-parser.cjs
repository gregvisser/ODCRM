// Test the fixed CSV parser with OCS data
require('dotenv').config()

// Copy of the FIXED parser
function parseCsv(csvText, chunkSize = 500) {
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
    } else if (char === '\r' && !inQuotes) {
      // Handle carriage return - skip if followed by \n (CRLF), otherwise treat as line break
      if (nextChar === '\n') {
        // CRLF - skip the \r, the \n will be handled next iteration
        continue
      } else {
        // Standalone \r - treat as line break (old Mac style)
        currentLine.push(currentField.trim())
        currentField = ''
        if (currentLine.length > 0) {
          lines.push(currentLine)
          currentLine = []
        }
      }
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

async function testParser() {
  const sheetId = '1QlTUdtzqGR2_lHbP2DalTUG9vpg8_K5G40ns4L5CMzw'
  const gid = '440825813'
  const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`

  console.log('🔍 TESTING FIXED CSV PARSER\n')

  try {
    const response = await fetch(csvUrl)
    const csvText = await response.text()

    console.log(`CSV size: ${csvText.length} bytes`)
    
    // Parse with fixed parser
    const rows = parseCsv(csvText)
    console.log(`\n📊 Parsed ${rows.length} rows (including header)\n`)

    // Check header
    const headers = rows[0]
    console.log(`Headers (${headers.length} columns):`)
    console.log(headers.slice(0, 10).join(' | '))

    // Look for February leads
    let febCount = 0
    let febLeads = []
    
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i]
      
      // Create object from headers
      const leadData = {}
      headers.forEach((header, idx) => {
        leadData[header] = row[idx] || ''
      })

      // Check for February 2026 dates
      const dateFields = [
        leadData['Date'],
        leadData['date'],
        leadData['Created At'],
        leadData['createdAt'],
        leadData['First Meeting Date']
      ]

      const dateStr = dateFields.find(d => d && d.trim()) || ''
      
      if (dateStr.includes('02.26') || dateStr.includes('.02.26') ||
          dateStr.includes('/02/26') || dateStr.includes('2026-02') ||
          dateStr.includes('02/2026')) {
        febCount++
        febLeads.push({
          rowNum: i + 1,
          date: dateStr,
          lead: leadData['Lead'] || leadData['Name'] || leadData['name'] || '(no name)',
          company: leadData['Company'] || leadData['company'] || '(no company)'
        })
      }
    }

    console.log(`\n🎯 FEBRUARY 2026 LEADS FOUND: ${febCount}\n`)
    
    if (febCount > 0) {
      febLeads.forEach(lead => {
        console.log(`Row ${lead.rowNum}: ${lead.date} - ${lead.lead} at ${lead.company}`)
      })
      
      // Show FULL data for row 1027 to see exact structure
      console.log('\n📋 FULL DATA FOR ROW 1027 (04.02.26 lead):\n')
      const row1027 = rows[1026] // 0-indexed, so row 1027 is index 1026
      const lead1027 = {}
      headers.forEach((header, idx) => {
        if (row1027[idx]) {
          lead1027[header] = row1027[idx]
        }
      })
      console.log(JSON.stringify(lead1027, null, 2))
      
      console.log('\n✅ SUCCESS! Fixed parser now captures February leads!')
    } else {
      console.log('❌ Still no February leads found - checking last 10 rows...\n')
      
      for (let i = Math.max(1, rows.length - 10); i < rows.length; i++) {
        const row = rows[i]
        const leadData = {}
        headers.forEach((header, idx) => {
          leadData[header] = row[idx] || ''
        })
        
        console.log(`\nRow ${i + 1}:`)
        console.log(`  Date: ${leadData['Date'] || leadData['date'] || '(none)'}`)
        console.log(`  Lead: ${leadData['Lead'] || leadData['Name'] || '(none)'}`)
        console.log(`  Company: ${leadData['Company'] || '(none)'}`)
      }
    }

  } catch (error) {
    console.error('Error:', error.message)
  }
}

testParser().catch(console.error)
