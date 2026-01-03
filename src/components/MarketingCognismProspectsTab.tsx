import { useMemo, useRef, useState } from 'react'
import {
  Badge,
  Box,
  Button,
  Checkbox,
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
import { OdcrmStorageKeys } from '../platform/keys'
import { getJson } from '../platform/storage'
import { getCognismProspects, setCognismProspects, type CognismProspect } from '../platform/stores/cognismProspects'

type ParsedProspectRow = {
  firstName: string
  lastName: string
  jobTitle?: string
  companyName: string
  email: string
  phone?: string
}

function detectDelimiter(text: string): '\t' | ',' {
  const firstLine = text.split(/\r?\n/)[0] || ''
  return firstLine.includes('\t') ? '\t' : ','
}

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/\s+/g, ' ')
}

function pick(cells: string[], headers: string[], aliases: string[]): string {
  for (const alias of aliases) {
    const idx = headers.indexOf(alias)
    if (idx >= 0) {
      const v = (cells[idx] ?? '').trim().replace(/^"|"$/g, '')
      if (v) return v
    }
  }
  return ''
}

function parseCognismExport(text: string): ParsedProspectRow[] {
  const raw = text.trim()
  if (!raw) return []
  const delimiter = detectDelimiter(raw)
  const lines = raw.split(/\r?\n/).filter((l) => l.trim() !== '')
  if (lines.length < 2) return []

  const headers = lines[0]
    .split(delimiter)
    .map((h) => normalizeHeader(h.replace(/^"|"$/g, '')))

  const rows = lines.slice(1)

  const firstNameAliases = ['first name', 'firstname', 'first']
  const lastNameAliases = ['last name', 'lastname', 'last']
  const jobTitleAliases = ['job title', 'title', 'position']
  const companyAliases = ['company', 'company name', 'account', 'organisation', 'organization']
  const emailAliases = ['email', 'email address', 'work email']
  const phoneAliases = ['mobile', 'mobile phone', 'phone', 'phone number', 'direct dial', 'direct']

  const out: ParsedProspectRow[] = []
  for (const line of rows) {
    const cells = line.split(delimiter).map((c) => c.trim())
    const email = pick(cells, headers, emailAliases).toLowerCase()
    const companyName = pick(cells, headers, companyAliases)
    const firstName = pick(cells, headers, firstNameAliases)
    const lastName = pick(cells, headers, lastNameAliases)
    const jobTitle = pick(cells, headers, jobTitleAliases) || undefined
    const phone = pick(cells, headers, phoneAliases) || undefined

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

  return out
}

export default function MarketingCognismProspectsTab() {
  const toast = useToast()
  const fileRef = useRef<HTMLInputElement>(null)

  const availableAccounts = useMemo(() => {
    const accounts = getJson<Array<{ name: string }>>(OdcrmStorageKeys.accounts) || []
    const names = accounts.map((a) => a?.name).filter(Boolean)
    return Array.from(new Set(names)).sort((a, b) => a.localeCompare(b))
  }, [])

  const [selectedCustomer, setSelectedCustomer] = useState<string>('')
  const [rawText, setRawText] = useState<string>('')
  const [search, setSearch] = useState<string>('')
  const [selectedEmails, setSelectedEmails] = useState<Set<string>>(new Set())

  const stored = useMemo(() => getCognismProspects(), [])
  const [prospects, setProspects] = useState<CognismProspect[]>(stored)

  const parsed = useMemo(() => parseCognismExport(rawText), [rawText])

  const visible = useMemo(() => {
    const scoped = selectedCustomer
      ? prospects.filter((p) => (p.accountName || '').toLowerCase() === selectedCustomer.toLowerCase())
      : prospects
    if (!search.trim()) return scoped
    const q = search.trim().toLowerCase()
    return scoped.filter((p) =>
      [p.firstName, p.lastName, p.email, p.companyName, p.jobTitle, p.phone]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(q)
    )
  }, [prospects, selectedCustomer, search])

  const persist = (next: CognismProspect[]) => {
    setProspects(next)
    setCognismProspects(next)
  }

  const importParsed = () => {
    if (!selectedCustomer) {
      toast({ title: 'Select a customer first', description: 'Pick the customer account this list belongs to.', status: 'error' })
      return
    }
    if (parsed.length === 0) {
      toast({ title: 'Nothing to import', description: 'Paste a Cognism export (with headers) first.', status: 'warning' })
      return
    }

    const now = new Date().toISOString()
    const existingKey = new Set(
      prospects.map((p) => `${(p.accountName || '').toLowerCase()}|${p.email.toLowerCase()}`)
    )

    let added = 0
    const next = [...prospects]
    for (const row of parsed) {
      const key = `${selectedCustomer.toLowerCase()}|${row.email.toLowerCase()}`
      if (existingKey.has(key)) continue
      existingKey.add(key)
      next.push({
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        firstName: row.firstName || '',
        lastName: row.lastName || '',
        jobTitle: row.jobTitle,
        companyName: row.companyName,
        email: row.email,
        phone: row.phone,
        accountName: selectedCustomer,
        source: 'cognism',
        importedAt: now,
      })
      added++
    }

    persist(next)
    setRawText('')
    setSelectedEmails(new Set())

    toast({
      title: 'Imported prospects',
      description: `Added ${added} new prospect(s) for ${selectedCustomer}.`,
      status: 'success',
      duration: 3500,
      isClosable: true,
    })
  }

  const syncSelectedToServer = async () => {
    const emails = Array.from(selectedEmails)
    if (emails.length === 0) {
      toast({ title: 'No prospects selected', status: 'info', duration: 2000 })
      return
    }
    const toSync = prospects.filter((p) => emails.includes(p.email.toLowerCase()))
    if (toSync.length === 0) return

    const { error, data } = await api.post<{ created: number; updated: number }>(`/api/contacts/bulk-upsert`, {
      contacts: toSync.map((p) => ({
        firstName: p.firstName,
        lastName: p.lastName,
        jobTitle: p.jobTitle,
        companyName: p.companyName,
        email: p.email,
        phone: p.phone,
        source: 'cognism',
      })),
    })

    if (error) {
      toast({ title: 'Sync failed', description: error, status: 'error', duration: 4000, isClosable: true })
      return
    }
    toast({
      title: 'Synced to server',
      description: `Created ${data?.created ?? 0}, updated ${data?.updated ?? 0} contacts.`,
      status: 'success',
      duration: 3000,
      isClosable: true,
    })
  }

  const toggleAllVisible = (checked: boolean) => {
    if (!checked) {
      setSelectedEmails(new Set())
      return
    }
    const next = new Set(selectedEmails)
    for (const p of visible) next.add(p.email.toLowerCase())
    setSelectedEmails(next)
  }

  const deleteCustomerList = () => {
    if (!selectedCustomer) return
    const next = prospects.filter((p) => (p.accountName || '').toLowerCase() !== selectedCustomer.toLowerCase())
    persist(next)
    setSelectedEmails(new Set())
    toast({ title: 'Deleted list', description: `Removed prospects for ${selectedCustomer}.`, status: 'success', duration: 2500 })
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
              setSelectedEmails(new Set())
            }}
            placeholder="Select customer"
          >
            {availableAccounts.map((name) => (
              <option key={name} value={name}>{name}</option>
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

        <Button colorScheme="teal" onClick={importParsed}>
          Import to Cognism Prospects
        </Button>
      </HStack>

      {availableAccounts.length === 0 && (
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
      </Box>

      <HStack justify="space-between" flexWrap="wrap">
        <HStack spacing={3}>
          <FormControl maxW="360px">
            <FormLabel fontSize="sm" mb={1}>Search</FormLabel>
            <Input value={search} onChange={(e) => setSearch(e.target.value)} size="sm" placeholder="Search name/email/company..." />
          </FormControl>
          <Checkbox
            isChecked={visible.length > 0 && visible.every((p) => selectedEmails.has(p.email.toLowerCase()))}
            onChange={(e) => toggleAllVisible(e.target.checked)}
          >
            Select visible
          </Checkbox>
          <Button size="sm" onClick={syncSelectedToServer} variant="outline">
            Sync selected to server
          </Button>
        </HStack>

        <HStack spacing={2}>
          <IconButton
            aria-label="Delete customer list"
            icon={<DeleteIcon />}
            size="sm"
            colorScheme="red"
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
              <Th>Select</Th>
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
                <Td colSpan={6}>
                  <Text py={4} color="gray.500">
                    No prospects yet{selectedCustomer ? ` for ${selectedCustomer}` : ''}.
                  </Text>
                </Td>
              </Tr>
            ) : (
              visible.slice(0, 500).map((p) => {
                const emailKey = p.email.toLowerCase()
                return (
                  <Tr key={p.id}>
                    <Td>
                      <Checkbox
                        isChecked={selectedEmails.has(emailKey)}
                        onChange={(e) => {
                          setSelectedEmails((prev) => {
                            const next = new Set(prev)
                            if (e.target.checked) next.add(emailKey)
                            else next.delete(emailKey)
                            return next
                          })
                        }}
                      />
                    </Td>
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
                      {p.accountName ? <Badge colorScheme="teal">{p.accountName}</Badge> : <Badge>Unassigned</Badge>}
                    </Td>
                  </Tr>
                )
              })
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


