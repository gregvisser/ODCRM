import { Box, Button, HStack, Text, useToast } from '@chakra-ui/react'
import { createOdcrmSnapshot, downloadOdcrmSnapshot, importOdcrmSnapshot } from '../utils/odcrmSnapshot'

export function DataPortability() {
  const toast = useToast()
  const origin = window.location.origin
  const isDevLocalhost = /^(http:\/\/localhost:|http:\/\/127\.0\.0\.1:|http:\/\/\[::1\]:)/.test(origin)
  const recommendedDevOrigin = 'http://localhost:5173'

  const accountsSummary = (() => {
    try {
      const raw = localStorage.getItem('odcrm_accounts')
      if (!raw) return { accounts: 0, withSheets: 0 }
      const parsed = JSON.parse(raw) as Array<Record<string, unknown>>
      const withSheets = parsed.filter((a) => typeof a.clientLeadsSheetUrl === 'string' && a.clientLeadsSheetUrl).length
      return { accounts: parsed.length, withSheets }
    } catch {
      return { accounts: 0, withSheets: 0 }
    }
  })()

  const accountsLastUpdated = (() => {
    try {
      return localStorage.getItem('odcrm_accounts_last_updated') || ''
    } catch {
      return ''
    }
  })()

  const handleExport = () => {
    try {
      const snapshot = createOdcrmSnapshot()
      downloadOdcrmSnapshot(snapshot)
      toast({
        title: 'Export created',
        description: 'Downloaded an ODCRM snapshot (accounts/contacts/leads + sidebar prefs).',
        status: 'success',
        duration: 3000,
        isClosable: true,
      })
    } catch (e: any) {
      toast({
        title: 'Export failed',
        description: e?.message || 'Failed to export snapshot.',
        status: 'error',
        duration: 4000,
        isClosable: true,
      })
    }
  }

  const handleImport = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = (ev) => {
      const file = (ev.target as HTMLInputElement).files?.[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = () => {
        try {
          const parsed = JSON.parse(String(reader.result || '{}'))
          const replace = window.confirm(
            'Import ODCRM snapshot: Click OK to REPLACE existing local ODCRM data, or Cancel to only fill missing keys.'
          )
          importOdcrmSnapshot(parsed, { replace })
          toast({
            title: 'Import successful',
            description: 'Snapshot imported. Reloading…',
            status: 'success',
            duration: 2500,
            isClosable: true,
          })
          window.location.reload()
        } catch (e: any) {
          toast({
            title: 'Import failed',
            description: e?.message || 'Invalid snapshot file.',
            status: 'error',
            duration: 4000,
            isClosable: true,
          })
        }
      }
      reader.readAsText(file)
    }
    input.click()
  }

  return (
    <Box>
      <Text fontSize="xs" color="gray.500" mb={2}>
        Data portability (localStorage is per domain/port)
      </Text>
      <Text fontSize="xs" color="gray.600" mb={2}>
        Current: <Box as="span" fontWeight="semibold">{origin}</Box> • Accounts: {accountsSummary.accounts} • Sheets: {accountsSummary.withSheets}
        {accountsLastUpdated ? ` • Last saved: ${accountsLastUpdated}` : ''}
      </Text>
      {isDevLocalhost && origin !== recommendedDevOrigin ? (
        <Text fontSize="xs" color="text.muted" mb={2}>
          Warning: local data is per URL/port. For consistent saved data in dev, use{' '}
          <Box as="span" fontWeight="semibold">{recommendedDevOrigin}</Box>.
        </Text>
      ) : null}
      <HStack spacing={2} flexWrap="wrap" mb={2}>
        <Button
          size="xs"
          variant="ghost"
          onClick={() => window.open('http://localhost:5173', '_blank')}
        >
          Open :5173
        </Button>
        <Button
          size="xs"
          variant="ghost"
          onClick={() => window.open('http://localhost:5174', '_blank')}
        >
          Open :5174
        </Button>
        <Button
          size="xs"
          variant="ghost"
          onClick={() => window.open('http://localhost:4173', '_blank')}
        >
          Open :4173
        </Button>
      </HStack>
      <HStack spacing={2} flexWrap="wrap">
        <Button size="sm" variant="outline" onClick={handleExport}>
          Export ODCRM Data
        </Button>
        <Button size="sm" variant="outline" onClick={handleImport}>
          Import ODCRM Data
        </Button>
      </HStack>
    </Box>
  )
}


