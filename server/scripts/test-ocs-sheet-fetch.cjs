// Test fetching OCS sheet to see what data comes back
const fetch = require('node-fetch')

async function testFetch() {
  const sheetId = '1QlTUdtzqGR2_lHbP2DalTUG9vpg8_K5G40ns4L5CMzw'
  const gid = '440825813'
  const csvUrl = `https://docs.google.com/spreadsheets/d/$ {sheetId}/export?format=csv&gid=${gid}`

  console.log('🔍 FETCHING OCS SHEET...')
  console.log(`URL: ${csvUrl}\n`)

  try {
    const response = await fetch(csvUrl)
    const csvText = await response.text()
    
    console.log(`✅ Fetched ${csvText.length} bytes\n`)
    
    // Parse CSV manually
    const lines = csvText.split('\n')
    console.log(`Total lines: ${lines.length}\n`)
    
    // Find rows containing February dates
    console.log('🔍 SEARCHING FOR FEBRUARY 2026 DATES (02.26 or 04.02.26):\n')
    
    lines.forEach((line, i) => {
      if (line.includes('02.02.26') || line.includes('04.02.26') || line.includes('.02.26')) {
        console.log(`Row ${i}: ${line}\n`)
      }
    })
    
    // Show last 20 lines to see if Feb leads are at the end
    console.log('\n📄 LAST 20 LINES OF CSV:\n')
    const last20 = lines.slice(-20)
    last20.forEach((line, i) => {
      const lineNum = lines.length - 20 + i
      console.log(`${lineNum}: ${line}`)
    })
    
  } catch (error) {
    console.error('Error:', error)
  }
}

testFetch()
