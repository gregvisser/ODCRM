// Test fetching OCS sheet - simple version using built-in fetch
async function testFetch() {
  const sheetId = '1QlTUdtzqGR2_lHbP2DalTUG9vpg8_K5G40ns4L5CMzw'
  const gid = '440825813'
  const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`

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
    console.log('🔍 SEARCHING FOR FEBRUARY 2026 DATES:\n')
    
    let febCount = 0
    lines.forEach((line, i) => {
      // Look for patterns like: 02.02.26, 04.02.26, or any .02.26
      if (line.match(/\d{1,2}\.02\.26/)) {
        console.log(`✅ FOUND FEB 2026 at line ${i}:`)
        console.log(`   ${line.substring(0, 200)}\n`)
        febCount++
      }
    })
    
    console.log(`\n📊 Total February 2026 leads found: ${febCount}`)
    
    if (febCount === 0) {
      console.log('\n⚠️ NO FEBRUARY LEADS FOUND IN CSV!')
      console.log('This means Google Sheets CSV export is not including those rows.')
      console.log('Possible reasons:')
      console.log('  1. Rows 1026-1027 are in a different sheet/tab')
      console.log('  2. Those rows are hidden or filtered out')
      console.log('  3. The GID is wrong')
      console.log('\n📄 Showing last 30 lines of CSV to verify:')
      
      const last30 = lines.slice(-30)
      last30.forEach((line, i) => {
        const lineNum = lines.length - 30 + i
        const preview = line.substring(0, 150)
        console.log(`${lineNum}: ${preview}`)
      })
    }
    
  } catch (error) {
    console.error('Error:', error.message)
  }
}

testFetch().catch(console.error)
