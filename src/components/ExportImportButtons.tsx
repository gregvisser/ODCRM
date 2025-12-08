import { HStack, Button, useToast } from '@chakra-ui/react'
import { useExportImport, type ExportImportOptions } from '../utils/exportImport'

interface ExportImportButtonsProps<T> extends Omit<ExportImportOptions<T>, 'toast'> {
  size?: 'sm' | 'md' | 'lg'
}

/**
 * Reusable Export/Import buttons component
 * Use this in any tab that needs export/import functionality
 */
export function ExportImportButtons<T extends Record<string, any>>({
  size = 'md',
  ...options
}: ExportImportButtonsProps<T>) {
  const toast = useToast()
  const { exportData, importData } = useExportImport({ ...options, toast })

  return (
    <HStack spacing={3} flexWrap="wrap">
      <Button
        variant="outline"
        onClick={() => exportData('json')}
        isDisabled={options.data.length === 0}
        size={size}
      >
        Export JSON
      </Button>
      <Button
        variant="outline"
        onClick={() => exportData('csv')}
        isDisabled={options.data.length === 0}
        size={size}
      >
        Export CSV
      </Button>
      <Button variant="outline" onClick={importData} size={size}>
        Import Data
      </Button>
    </HStack>
  )
}

