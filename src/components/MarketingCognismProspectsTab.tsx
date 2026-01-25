import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Badge,
  Box,
  Button,
  FormControl,
  FormLabel,
  Heading,
  HStack,
  Input,
  Select,
  Stack,
  Table,
  Tbody,
  Td,
  Text,
  Textarea,
  Th,
  Thead,
  Tr,
  useToast,
  Alert,
  AlertIcon,
  AlertDescription,
  IconButton,
} from '@chakra-ui/react'
import { DeleteIcon } from '@chakra-ui/icons'
import { api } from '../utils/api'
import { settingsStore } from '../platform'

type ParsedProspectRow = {
  firstName: string
  lastName: string
  jobTitle?: string
  companyName: string
  email: string
  phone?: string
}

type ParseMeta = {
  delimiter: '\t' | ','
  headers: string[]
  mapping: Record<string, string | null>
  missingRequired: string[]
}

type ParseResult = {
  rows: ParsedProspectRow[]
  meta: ParseMeta | null
}

type Customer = { id: string; name: string }

type ServerProspect = {
  id: string
  firstName: string
  lastName: string
  jobTitle?: string | null
  companyName: string
  email: string
  phone?: string | null
  source?: string | null
}

function detectDelimiter(text: string): '\t' | ',' {
  const firstLine = (text.split(/\r?\n/)[0] || '').trim()
  const commas = (firstLine.match(/,/g) || []).length
  const tabs = (firstLine.match(/\t/g) || []).length
  return tabs > commas ? '\t' : ','
}

function normalizeHeader(h: string): string {
  return h
    .trim()
    .replace(/^"|"$/g, '')
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/[()]/g, ' ')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function parseDelimitedLine(line: string, delimiter: '\t' | ','): string[] {
  // Minimal CSV/TSV parser with quote handling:
  // - Supports quoted fields with escaped quotes ("")
  // - Does not support multi-line quoted fields (rare in exports)
  const out: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
      continue
    }
    if (!inQuotes && ch === delimiter) {
      out.push(cur)
      cur = ''
      continue
    }
    cur += ch
  }
  out.push(cur)
  return out.map((c) => c.trim())
}

function findHeaderIndex(headers: string[], aliases: string[], predicate?: (h: string) => boolean): number {
  for (const alias of aliases) {
    const idx = headers.indexOf(alias)
    if (idx >= 0) return idx
  }
  if (predicate) {
    const idx = headers.findIndex(predicate)
    if (idx >= 0) return idx
  }
  return -1
}

function getCell(cells: string[], idx: number): string {
  if (idx < 0) return ''
  const v = (cells[idx] ?? '').trim().replace(/^"|"$/g, '')
  return v
}

function parseCognismExport(text: string): ParseResult {
  const raw = text.trim()
  if (!raw) return { rows: [], meta: null }
  const delimiter = detectDelimiter(raw)
  const lines = raw.split(/\r?\n/).filter((l) => l.trim() !== '')
  if (lines.length < 2) return { rows: [], meta: null }

  const headerCells = parseDelimitedLine(lines[0], delimiter)
  const headers = headerCells.map((h) => normalizeHeader(h))

  const rows = lines.slice(1)

  const firstNameAliases = ['first name', 'firstname', 'contact first name', 'first']
  const lastNameAliases = ['last name', 'lastname', 'contact last name', 'last']
  const jobTitleAliases = ['job title', 'title', 'position', 'role']
  const companyAliases = ['company name', 'company', 'account', 'organisation', 'organization', 'organisation name', 'organization name']
  const emailAliases = ['work email', 'email address', 'email', 'business email']
  const phoneAliases = [
    'direct dial',
    'direct phone',
    'direct',
    'mobile phone',
    'mobile',
    'phone number',
    'phone',
    'telephone',
  ]

  const idxFirstName = findHeaderIndex(headers, firstNameAliases, (h) => h.includes('first') && h.includes('name'))
  const idxLastName = findHeaderIndex(headers, lastNameAliases, (h) => h.includes('last') && h.includes('name'))
  const idxJobTitle = findHeaderIndex(headers, jobTitleAliases, (h) => h.includes('job') && h.includes('title'))
  const idxCompany = findHeaderIndex(headers, companyAliases, (h) => h.includes('company') || h.includes('organisation') || h.includes('organization') || h.includes('account'))
  const idxEmail = findHeaderIndex(headers, emailAliases, (h) => h.includes('email'))
  const idxPhone = findHeaderIndex(headers, phoneAliases, (h) => h.includes('phone') || h.includes('mobile') || h.includes('dial') || h.includes('telephone'))

  const missingRequired: string[] = []
  if (idxEmail < 0) missingRequired.push('email')
  if (idxCompany < 0) missingRequired.push('company')

  const meta: ParseMeta = {
    delimiter,
    headers,
    mapping: {
      firstName: idxFirstName >= 0 ? headerCells[idxFirstName] : null,
      lastName: idxLastName >= 0 ? headerCells[idxLastName] : null,
      jobTitle: idxJobTitle >= 0 ? headerCells[idxJobTitle] : null,
      companyName: idxCompany >= 0 ? headerCells[idxCompany] : null,
      email: idxEmail >= 0 ? headerCells[idxEmail] : null,
      phone: idxPhone >= 0 ? headerCells[idxPhone] : null,
    },
    missingRequired,
  }

  const out: ParsedProspectRow[] = []
  for (const line of rows) {
    const cells = parseDelimitedLine(line, delimiter)
    const email = getCell(cells, idxEmail).toLowerCase()
    const companyName = getCell(cells, idxCompany)
    const firstName = getCell(cells, idxFirstName)
    const lastName = getCell(cells, idxLastName)
    const jobTitle = getCell(cells, idxJobTitle) || undefined
    const phone = getCell(cells, idxPhone) || undefined

    if (!email || !email.includes('@')) continue
    if (!companyName) continue

    out.push({
      firstName,
      lastName,
      jobTitle,
      companyName,
      email,
      phone,
    })
  }

  return { rows: out, meta }
}

export default function MarketingCognismProspectsTab() {
  const toast = useToast()
  const fileRef = useRef<HTMLInputElement>(null)

  const [customers, setCustomers] = useState<Customer[]>([])
  const [selectedCustomer, setSelectedCustomer] = useState<string>('')
  const [rawText, setRawText] = useState<string>('')
  const [search, setSearch] = useState<string>('')
  const [prospects, setProspects] = useState<ServerProspect[]>([])
  const [loading, setLoading] = useState(false)

  const parsedResult = useMemo(() => parseCognismExport(rawText), [rawText])
  const parsed = parsedResult.rows

  const visible = useMemo(() => {
    if (!search.trim()) return prospects
    const q = search.trim().toLowerCase()
    return prospects.filter((p) =>
      [p.firstName, p.lastName, p.email, p.companyName, p.jobTitle, p.phone]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(q)
    )
  }, [prospects, search])

  const customerLookup = useMemo(() => {
    return Object.fromEntries(customers.map((c) => [c.id, c.name]))
  }, [customers])

  const loadCustomers = async () => {
    const { data, error } = await api.get<Customer[]>('/api/customers')
    if (error) {
      toast({ title: 'Failed to load customers', description: error, status: 'error' })
      return
    }
    const list = data || []
    setCustomers(list)
    const activeCustomerId =
      settingsStore.getCurrentCustomerId('prod-customer-1') || list[0]?.id || ''
    if (activeCustomerId) {
      setSelectedCustomer(activeCustomerId)
    }
  }

  const loadProspects = async (customerId: string) => {
    if (!customerId) return
    setLoading(true)
    const { data, error } = await api.get<ServerProspect[]>(
      `/api/contacts?customerId=${customerId}&source=cognism`,
    )
    if (error) {
      toast({ title: 'Failed to load prospects', description: error, status: 'error' })
      setLoading(false)
      return
    }
    setProspects(data || [])
    setLoading(false)
  }

  useEffect(() => {
    loadCustomers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (selectedCustomer) {
      loadProspects(selectedCustomer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCustomer])

  const importParsed = async () => {
    if (!selectedCustomer) {
      toast({ title: 'Select a customer first', description: 'Pick the customer account this list belongs to.', status: 'error' })
      return
    }
    if (parsed.length === 0) {
      toast({ title: 'Nothing to import', description: 'Paste a Cognism export (with headers) first.', status: 'warning' })
      return
    }

    const { error, data } = await api.post<{ created: number; updated: number }>(
      `/api/contacts/bulk-upsert?customerId=${selectedCustomer}`,
      {
        contacts: parsed.map((row) => ({
          firstName: row.firstName || '',
          lastName: row.lastName || '',
          jobTitle: row.jobTitle,
          companyName: row.companyName,
          email: row.email,
          phone: row.phone,
          source: 'cognism',
        })),
      },
    )
    if (error) {
      toast({ title: 'Import failed', description: error, status: 'error' })
      return
    }

    setRawText('')
    await loadProspects(selectedCustomer)

    toast({
      title: 'Imported prospects',
      description: `Created ${data?.created ?? 0}, updated ${data?.updated ?? 0} prospect(s) for ${customerLookup[selectedCustomer] || selectedCustomer}.`,
      status: 'success',
      duration: 3500,
      isClosable: true,
    })
  }

  const refreshFromServer = async () => {
    if (!selectedCustomer) return
    await loadProspects(selectedCustomer)
    toast({ title: 'Refreshed', status: 'success', duration: 1500 })
  }

  const deleteCustomerList = async () => {
    if (!selectedCustomer) return
    if (!confirm('Delete all Cognism prospects for this customer?')) return
    const { error, data } = await api.delete<{ deleted: number }>(
      `/api/contacts/by-source?customerId=${selectedCustomer}&source=cognism`,
    )
    if (error) {
      toast({ title: 'Delete failed', description: error, status: 'error' })
      return
    }
    await loadProspects(selectedCustomer)
    toast({
      title: 'Deleted list',
      description: `Removed ${data?.deleted ?? 0} prospects for ${customerLookup[selectedCustomer] || selectedCustomer}.`,
      status: 'success',
      duration: 2500,
    })
  }

  const onFilePick = async (file: File) => {
    const text = await file.text()
    setRawText(text)
  }

  return (
    <Stack spacing={6}>
      <Box>
        <Heading size="lg" mb={2}>Cognism Prospects</Heading>
        <Text color="gray.600">
          Until we have Cognism API access, paste or upload Cognism exports here. They’ll be reusable inside campaign creation.
        </Text>
      </Box>

      <HStack spacing={4} align="flex-end" flexWrap="wrap">
        <FormControl maxW="420px" isRequired>
          <FormLabel>Customer account</FormLabel>
          <Select
            value={selectedCustomer}
            onChange={(e) => {
              setSelectedCustomer(e.target.value)
            }}
            placeholder="Select customer"
          >
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>{customer.name}</option>
            ))}
          </Select>
        </FormControl>

        <Button onClick={() => fileRef.current?.click()} variant="outline">
          Upload CSV/TSV
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,.tsv,.txt"
          style={{ display: 'none' }}
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) void onFilePick(file)
            e.currentTarget.value = ''
          }}
        />

        <Button colorScheme="gray" onClick={importParsed}>
          Import to Cognism Prospects
        </Button>
      </HStack>

      {customers.length === 0 && (
        <Alert status="warning">
          <AlertIcon />
          <AlertDescription>
            No customer accounts found. Add customers in Customers → Accounts first.
          </AlertDescription>
        </Alert>
      )}

      <Box bg="white" borderRadius="lg" border="1px solid" borderColor="gray.200" p={4}>
        <FormControl>
          <FormLabel>Paste Cognism export</FormLabel>
          <Textarea
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            placeholder="Paste a Cognism CSV/TSV export here (including headers)."
            rows={8}
            fontFamily="mono"
            fontSize="sm"
          />
        </FormControl>
        <Text fontSize="sm" color="gray.600" mt={2}>
          Parsed rows: <strong>{parsed.length}</strong>
        </Text>
        {rawText.trim() !== '' && parsedResult.meta && (
          <Box mt={3}>
            {parsedResult.meta.missingRequired.length > 0 && (
              <Alert status="warning" mb={2}>
                <AlertIcon />
                <AlertDescription fontSize="sm">
                  Couldn’t find required columns: <strong>{parsedResult.meta.missingRequired.join(', ')}</strong>. If this is a Cognism export,
                  please paste the full header row.
                </AlertDescription>
              </Alert>
            )}
            <Text fontSize="xs" color="gray.500">
              Detected delimiter: <strong>{parsedResult.meta.delimiter === '\t' ? 'TSV (tab)' : 'CSV (comma)'}</strong>. Detected columns:{' '}
              <strong>
                Email={parsedResult.meta.mapping.email || '—'}, Company={parsedResult.meta.mapping.companyName || '—'}, Name={parsedResult.meta.mapping.firstName || '—'} / {parsedResult.meta.mapping.lastName || '—'}
              </strong>
            </Text>
          </Box>
        )}
      </Box>

      <HStack justify="space-between" flexWrap="wrap">
        <HStack spacing={3}>
          <FormControl maxW="360px">
            <FormLabel fontSize="sm" mb={1}>Search</FormLabel>
            <Input value={search} onChange={(e) => setSearch(e.target.value)} size="sm" placeholder="Search name/email/company..." />
          </FormControl>
          <Button size="sm" onClick={refreshFromServer} variant="outline" isDisabled={!selectedCustomer || loading}>
            Refresh
          </Button>
        </HStack>

        <HStack spacing={2}>
          <IconButton
            aria-label="Delete customer list"
            icon={<DeleteIcon />}
            size="sm"
            colorScheme="gray"
            variant="outline"
            onClick={deleteCustomerList}
            isDisabled={!selectedCustomer}
          />
        </HStack>
      </HStack>

      <Box bg="white" borderRadius="lg" border="1px solid" borderColor="gray.200" overflowX="auto">
        <Table size="sm" variant="simple">
          <Thead bg="gray.50">
            <Tr>
              <Th>Name</Th>
              <Th>Email</Th>
              <Th>Company</Th>
              <Th>Title</Th>
              <Th>Customer</Th>
            </Tr>
          </Thead>
          <Tbody>
            {visible.length === 0 ? (
              <Tr>
                <Td colSpan={5}>
                  <Text py={4} color="gray.500">
                    No prospects yet{selectedCustomer ? ` for ${customerLookup[selectedCustomer] || selectedCustomer}` : ''}.
                  </Text>
                </Td>
              </Tr>
            ) : (
              visible.slice(0, 500).map((p) => (
                  <Tr key={p.id}>
                    <Td>
                      <Text fontWeight="semibold">{`${p.firstName} ${p.lastName}`.trim() || '(No name)'}</Text>
                    </Td>
                    <Td>
                      <Text fontSize="sm">{p.email}</Text>
                    </Td>
                    <Td>
                      <Text fontSize="sm">{p.companyName}</Text>
                    </Td>
                    <Td>
                      <Text fontSize="sm" color="gray.700">{p.jobTitle || '-'}</Text>
                    </Td>
                    <Td>
                      <Badge colorScheme="gray">{p.companyName || 'Unassigned'}</Badge>
                    </Td>
                  </Tr>
              ))
            )}
          </Tbody>
        </Table>
      </Box>

      <Text fontSize="xs" color="gray.500">
        Showing up to 500 rows for performance.
      </Text>
    </Stack>
  )
}


