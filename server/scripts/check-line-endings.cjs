async function checkLineEndings() {
  const sheetId = '1QlTUdtzqGR2_lHbP2DalTUG9vpg8_K5G40ns4L5CMzw'
  const gid = '440825813'
  const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`

  console.log('🔍 CHECKING LINE ENDINGS IN CSV\\n')

  try {
    const response = await fetch(csvUrl)
    const csvText = await response.text()

    // Check what line endings are used
    const hasCR = csvText.includes('\r')
    const hasLF = csvText.includes('\n')
    const hasCRLF = csvText.includes('\r\n')

    console.log('Line ending analysis:')
    console.log(`  Contains \\r (CR): ${hasCR}`)
    console.log(`  Contains \\n (LF): ${hasLF}`)
    console.log(`  Contains \\r\\n (CRLF): ${hasCRLF}`)

    // Count occurrences
    const crCount = (csvText.match(/\r/g) || []).length
    const lfCount = (csvText.match(/\n/g) || []).length

    console.log(`\\nCounts:`)
    console.log(`  \\r count: ${crCount}`)
    console.log(`  \\n count: ${lfCount}`)

    // Check sample around line 1090
    const lines = csvText.split('\n')
    console.log(`\nSplitting by \\n gives ${lines.length} lines`)

    // Now check if splitting by \r\n gives different result
    if (hasCRLF) {
      const linesCRLF = csvText.split('\r\n')
      console.log(`Splitting by \\r\\n gives ${linesCRLF.length} lines`)
    }

    // Check for actual row count by looking for the custom parser logic
    console.log('\n📊 SIMULATING CUSTOM PARSER:\n')
    
    let lineCount = 0
    let inQuotes = false
    
    for (let i = 0; i < csvText.length; i++) {
      const char = csvText[i]
      const nextChar = csvText[i + 1]
      
      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          i++ // Skip escaped quote
        } else {
          inQuotes = !inQuotes
        }
      } else if (char === '\n' && !inQuotes) {
        lineCount++
      }
    }
    
    console.log(`Parser would count ${lineCount} rows`)
    
    // Check if \r is being encountered without handling
    let lfOnlyCount = 0
    let crlfCount = 0
    
    for (let i = 0; i < csvText.length; i++) {
      if (csvText[i] === '\n') {
        if (i > 0 && csvText[i - 1] === '\r') {
          crlfCount++
        } else {
          lfOnlyCount++
        }
      }
    }
    
    console.log('\nLine ending breakdown:')
    console.log(`  LF only (\\n): ${lfOnlyCount}`)
    console.log(`  CRLF (\\r\\n): ${crlfCount}`)
    console.log(`  Total line breaks: ${lfOnlyCount + crlfCount}`)

  } catch (error) {
    console.error('Error:', error.message)
  }
}

checkLineEndings().catch(console.error)
