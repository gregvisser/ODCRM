// Check why CSV parsing stops early
async function checkParsing() {
  const sheetId = '1QlTUdtzqGR2_lHbP2DalTUG9vpg8_K5G40ns4L5CMzw'
  const gid = '440825813'
  const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`

  console.log('🔍 ANALYZING CSV PARSING ISSUE\n')

  try {
    const response = await fetch(csvUrl)
    const csvText = await response.text()
    
    const lines = csvText.split('\n')
    console.log(`Total lines in CSV: ${lines.length}`)
    
    // Check lines around where we expect the Feb leads (1092-1093)
    console.log('\n📄 LINES 1090-1095 (where Feb leads should be):\n')
    for (let i = 1090; i <= 1095 && i < lines.length; i++) {
      const line = lines[i]
      const preview = line.substring(0, 200)
      const fields = line.split(',').length
      const nonEmptyFields = line.split(',').filter(f => f && f.trim()).length
      
      console.log(`Line ${i}:`)
      console.log(`  Fields: ${fields}, Non-empty: ${nonEmptyFields}`)
      console.log(`  Content: ${preview}`)
      console.log('')
    }
    
    // Check line 1074-1076 (where parser stops)
    console.log('\n📄 LINES 1073-1077 (where parser stops at 1075):\n')
    for (let i = 1073; i <= 1077 && i < lines.length; i++) {
      const line = lines[i]
      const preview = line.substring(0, 200)
      const fields = line.split(',').length
      const nonEmptyFields = line.split(',').filter(f => f && f.trim()).length
      
      console.log(`Line ${i}:`)
      console.log(`  Fields: ${fields}, Non-empty: ${nonEmptyFields}`)
      console.log(`  Content: ${preview}`)
      console.log('')
    }
    
    // Count how many non-empty lines exist after line 1075
    let nonEmptyAfter1075 = 0
    for (let i = 1076; i < lines.length; i++) {
      const fields = lines[i].split(',').filter(f => f && f.trim())
      if (fields.length >= 2) {  // Has at least 2 non-empty fields
        nonEmptyAfter1075++
      }
    }
    
    console.log(`\n⚠️ NON-EMPTY LINES AFTER ROW 1075: ${nonEmptyAfter1075}`)
    console.log(`These lines are being MISSED by the current sync!\n`)
    
  } catch (error) {
    console.error('Error:', error.message)
  }
}

checkParsing().catch(console.error)
