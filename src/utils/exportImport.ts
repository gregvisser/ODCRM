import { useToast } from '@chakra-ui/react'

export interface ExportImportOptions<T> {
  data: T[]
  filename: string
  validateItem?: (item: T) => boolean
  onImport?: (items: T[]) => void
  getItemId?: (item: T) => string
  onDuplicate?: (existingItems: T[], importedItems: T[]) => T[]
  toast?: ReturnType<typeof useToast>
}

/**
 * Generic export function for JSON and CSV formats
 */
export function useExportImport<T extends Record<string, any>>(
  options: ExportImportOptions<T>
) {
  const toast = options.toast || useToast()

  const exportData = (format: 'json' | 'csv' = 'json') => {
    try {
      if (options.data.length === 0) {
        toast({
          title: 'No data to export',
          description: 'There is no data available to export.',
          status: 'warning',
          duration: 3000,
          isClosable: true,
        })
        return
      }

      if (format === 'json') {
        const dataStr = JSON.stringify(options.data, null, 2)
        const dataBlob = new Blob([dataStr], { type: 'application/json' })
        const url = URL.createObjectURL(dataBlob)
        const link = document.createElement('a')
        link.href = url
        link.download = `${options.filename}-${new Date().toISOString().split('T')[0]}.json`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(url)
      } else {
        // CSV export
        if (options.data.length === 0) return

        // Get headers from first item
        const firstItem = options.data[0]
        const headers = Object.keys(firstItem)

        const csvRows = [
          headers.join(','),
          ...options.data.map((item) =>
            headers
              .map((header) => {
                const value = item[header]
                if (value === null || value === undefined) return ''
                if (typeof value === 'object') {
                  return `"${JSON.stringify(value).replace(/"/g, '""')}"`
                }
                return `"${String(value).replace(/"/g, '""')}"`
              })
              .join(',')
          ),
        ]

        const csvContent = csvRows.join('\n')
        const dataBlob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
        const url = URL.createObjectURL(dataBlob)
        const link = document.createElement('a')
        link.href = url
        link.download = `${options.filename}-${new Date().toISOString().split('T')[0]}.csv`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(url)
      }

      toast({
        title: 'Export successful',
        description: `${options.data.length} item(s) exported as ${format.toUpperCase()}.`,
        status: 'success',
        duration: 3000,
        isClosable: true,
      })
    } catch (error) {
      toast({
        title: 'Export failed',
        description: 'Failed to export data.',
        status: 'error',
        duration: 3000,
        isClosable: true,
      })
    }
  }

  const importData = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json,.csv'
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return

      const reader = new FileReader()
      reader.onload = (event) => {
        try {
          const fileContent = event.target?.result as string
          const fileExtension = file.name.split('.').pop()?.toLowerCase()
          let importedData: T[]

          if (fileExtension === 'csv') {
            importedData = parseCSV<T>(fileContent)
          } else {
            importedData = JSON.parse(fileContent)
          }

          // Validate imported data
          if (!Array.isArray(importedData)) {
            toast({
              title: 'Import failed',
              description: 'Invalid file format. Expected an array of items.',
              status: 'error',
              duration: 3000,
              isClosable: true,
            })
            return
          }

          // Validate items if validator provided
          let validItems = importedData
          if (options.validateItem) {
            const invalidItems: string[] = []
            validItems = importedData.filter((item, index) => {
              const isValid = options.validateItem!(item)
              if (!isValid) {
                invalidItems.push(`Row ${index + 2}`)
              }
              return isValid
            })

            if (validItems.length === 0) {
              toast({
                title: 'Import failed',
                description: 'No valid items found in the file.',
                status: 'error',
                duration: 3000,
                isClosable: true,
              })
              return
            }

            if (validItems.length < importedData.length) {
              toast({
                title: 'Partial import',
                description: `${validItems.length} of ${importedData.length} items imported. Some items were invalid.`,
                status: 'warning',
                duration: 4000,
                isClosable: true,
              })
            }
          }

          // Handle duplicates if getItemId provided
          if (options.getItemId && options.data.length > 0) {
            const existingIds = new Set(options.data.map((item) => options.getItemId!(item)))
            const duplicateItems = validItems.filter((item) =>
              existingIds.has(options.getItemId!(item))
            )

            if (duplicateItems.length > 0) {
              const shouldReplace = window.confirm(
                `Found ${duplicateItems.length} item(s) with existing IDs. Do you want to replace existing items with imported data? (Click OK to replace, Cancel to skip duplicates)`
              )

              if (shouldReplace) {
                const importedIds = new Set(validItems.map((item) => options.getItemId!(item)))
                const nonDuplicateItems = options.data.filter(
                  (item) => !importedIds.has(options.getItemId!(item))
                )
                const updatedItems = [...nonDuplicateItems, ...validItems]
                options.onImport?.(updatedItems)
                toast({
                  title: 'Import successful',
                  description: `${validItems.length} item(s) imported. ${duplicateItems.length} existing item(s) replaced.`,
                  status: 'success',
                  duration: 4000,
                  isClosable: true,
                })
              } else {
                const newItems = validItems.filter(
                  (item) => !existingIds.has(options.getItemId!(item))
                )
                if (newItems.length > 0) {
                  const updatedItems = [...options.data, ...newItems]
                  options.onImport?.(updatedItems)
                  toast({
                    title: 'Import successful',
                    description: `${newItems.length} new item(s) imported. ${duplicateItems.length} duplicate(s) skipped.`,
                    status: 'success',
                    duration: 4000,
                    isClosable: true,
                  })
                } else {
                  toast({
                    title: 'Import cancelled',
                    description: 'All items in the file already exist. No new items imported.',
                    status: 'info',
                    duration: 3000,
                    isClosable: true,
                  })
                }
              }
            } else {
              const updatedItems = [...options.data, ...validItems]
              options.onImport?.(updatedItems)
              toast({
                title: 'Import successful',
                description: `${validItems.length} new item(s) imported successfully.`,
                status: 'success',
                duration: 3000,
                isClosable: true,
              })
            }
          } else {
            // No duplicate handling, just import all
            if (options.onDuplicate) {
              const updatedItems = options.onDuplicate(options.data, validItems)
              options.onImport?.(updatedItems)
            } else {
              const updatedItems = [...options.data, ...validItems]
              options.onImport?.(updatedItems)
            }
            toast({
              title: 'Import successful',
              description: `${validItems.length} item(s) imported successfully.`,
              status: 'success',
              duration: 3000,
              isClosable: true,
            })
          }
        } catch (error) {
          toast({
            title: 'Import failed',
            description: 'Failed to parse the file. Please check the file format.',
            status: 'error',
            duration: 3000,
            isClosable: true,
          })
        }
      }
      reader.readAsText(file)
    }
    input.click()
  }

  return { exportData, importData }
}

/**
 * Parse CSV content into array of objects
 */
function parseCSV<T>(csvText: string): T[] {
  const lines = csvText.split(/\r?\n/).filter((line) => line.trim())
  if (lines.length < 2) {
    return []
  }

  const parseCSVLine = (line: string): string[] => {
    const values: string[] = []
    let current = ''
    let inQuotes = false

    for (let j = 0; j < line.length; j++) {
      const char = line[j]
      if (char === '"') {
        if (inQuotes && line[j + 1] === '"') {
          current += '"'
          j++
        } else {
          inQuotes = !inQuotes
        }
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim())
        current = ''
      } else {
        current += char
      }
    }
    values.push(current.trim())
    return values
  }

  const headerValues = parseCSVLine(lines[0])
  const headers = headerValues.map((h) => h.trim().replace(/^"|"$/g, ''))

  const items: T[] = []
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]
    if (!line.trim()) continue

    const values = parseCSVLine(line)
    const item: any = {}
    headers.forEach((header, index) => {
      if (values[index] !== undefined && values[index] !== null) {
        let value = values[index].trim().replace(/^"|"$/g, '')
        // Try to parse JSON if it looks like JSON
        if (value.startsWith('{') || value.startsWith('[')) {
          try {
            value = JSON.parse(value)
          } catch {
            // Keep as string if parsing fails
          }
        }
        item[header] = value
      }
    })

    if (Object.keys(item).length > 0) {
      items.push(item as T)
    }
  }

  return items
}

