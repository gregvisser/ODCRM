import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Box,
  Button,
  Heading,
  HStack,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalHeader,
  ModalOverlay,
  Select,
  Spinner,
  Stack,
  Text,
  useDisclosure,
} from '@chakra-ui/react'
import { api } from '../../utils/api'
import { normalizeCustomersListResponse } from '../../utils/normalizeApiResponse'
import { SectionCard } from './SectionCard'
import type { AccountNote, AssignedAccountManagerUser, CustomerContact, CustomerDetail } from './types'
import { CompanySection } from './sections/CompanySection'
import { OwnershipSection } from './sections/OwnershipSection'
import { FinancialSection } from './sections/FinancialSection'
import { LeadSourceSection } from './sections/LeadSourceSection'
import { AgreementSection } from './sections/AgreementSection'
import { ContactsSection } from './sections/ContactsSection'
import { NotesSection } from './sections/NotesSection'

function coerceObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object') return null
  if (Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function getString(obj: Record<string, unknown> | null, key: string): string | null {
  if (!obj) return null
  const v = obj[key]
  return typeof v === 'string' && v.trim() ? v : null
}

function getNumber(obj: Record<string, unknown> | null, key: string): number | null {
  if (!obj) return null
  const v = obj[key]
  if (typeof v === 'number' && Number.isFinite(v)) return v
  return null
}

function coerceNotes(accountData: Record<string, unknown> | null | undefined): AccountNote[] {
  const obj = coerceObject(accountData) || null
  const raw = obj && Array.isArray((obj as any).notes) ? ((obj as any).notes as any[]) : []
  return raw
    .filter(Boolean)
    .map((n) => ({
      id: String(n.id || ''),
      content: String(n.content || ''),
      user: String(n.user || ''),
      userId: typeof n.userId === 'string' ? n.userId : undefined,
      userEmail: typeof n.userEmail === 'string' ? n.userEmail : undefined,
      timestamp: String(n.timestamp || ''),
    }))
    .filter((n) => n.id && n.content)
}

type CustomerListItem = { id: string; name: string }

export default function AccountsOperationalPanel({
  focusAccountName,
  onNavigateToContacts,
}: {
  focusAccountName?: string
  onNavigateToContacts?: () => void
}) {
  const [listLoading, setListLoading] = useState(true)
  const [listError, setListError] = useState<string | null>(null)
  const [customers, setCustomers] = useState<CustomerListItem[]>([])

  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('')

  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)
  const [customer, setCustomer] = useState<CustomerDetail | null>(null)

  const {
    isOpen: isContactOpen,
    onOpen: onContactOpen,
    onClose: onContactClose,
  } = useDisclosure()
  const [selectedContact, setSelectedContact] = useState<CustomerContact | null>(null)

  const {
    isOpen: isManagerOpen,
    onOpen: onManagerOpen,
    onClose: onManagerClose,
  } = useDisclosure()
  const [managerUser, setManagerUser] = useState<AssignedAccountManagerUser | null>(null)

  const fetchList = useCallback(async () => {
    setListLoading(true)
    setListError(null)
    const { data, error } = await api.get('/api/customers?includeArchived=true')
    setListLoading(false)
    if (error) {
      setCustomers([])
      setListError(error)
      return
    }
    try {
      const normalized = normalizeCustomersListResponse(data)
      const items: CustomerListItem[] = normalized
        .map((c: any) => ({ id: String(c.id), name: String(c.name || '') }))
        .filter((c) => c.id && c.name)
        .sort((a, b) => a.name.localeCompare(b.name))
      setCustomers(items)
      if (!selectedCustomerId && items.length > 0) {
        setSelectedCustomerId(items[0].id)
      }
    } catch (e: any) {
      setCustomers([])
      setListError(e?.message || 'Failed to normalize customers list')
    }
  }, [selectedCustomerId])

  const fetchDetail = useCallback(
    async (id: string) => {
      if (!id) return
      setDetailLoading(true)
      setDetailError(null)
      const { data, error } = await api.get<CustomerDetail>(`/api/customers/${id}`)
      setDetailLoading(false)
      if (error) {
        setCustomer(null)
        setDetailError(error)
        return
      }
      if (!data) {
        setCustomer(null)
        setDetailError('No data returned')
        return
      }
      const contacts = Array.isArray((data as any).customerContacts) ? ((data as any).customerContacts as any[]) : []
      setCustomer({
        ...(data as any),
        customerContacts: contacts,
      })
    },
    []
  )

  // Initial list load
  useEffect(() => {
    void fetchList()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Focus selection by account name (when provided)
  useEffect(() => {
    const name = typeof focusAccountName === 'string' ? focusAccountName.trim().toLowerCase() : ''
    if (!name) return
    const match = customers.find((c) => c.name.trim().toLowerCase() === name)
    if (match && match.id && match.id !== selectedCustomerId) {
      setSelectedCustomerId(match.id)
    }
  }, [customers, focusAccountName, selectedCustomerId])

  // Fetch details on selection
  useEffect(() => {
    if (!selectedCustomerId) return
    void fetchDetail(selectedCustomerId)
  }, [fetchDetail, selectedCustomerId])

  const accountData = useMemo(() => (customer ? coerceObject(customer.accountData) : null), [customer])
  const accountDetails = useMemo(() => (accountData ? coerceObject((accountData as any).accountDetails) : null), [accountData])

  const assignedClientDdiNumber =
    getString(accountDetails, 'assignedClientDdiNumber') || getString(accountData, 'assignedClientDdiNumber')
  const daysPerWeek = getNumber(accountDetails, 'daysPerWeek') ?? getNumber(accountData, 'days')

  const headOfficeAddress = getString(accountDetails, 'headOfficeAddress') || getString(accountData, 'headOfficeAddress')

  const notes = useMemo(() => coerceNotes(customer?.accountData || null), [customer])

  const leadsGoogleSheetUrl = customer?.leadsReportingUrl || null
  const leadsGoogleSheetLabel = customer?.leadsGoogleSheetLabel || null
  const leadsReportingUrl =
    getString(accountData, 'leadsReportingUrl') ||
    getString(coerceObject((accountData as any)?.leadSourceConfiguration) || null, 'reportingUrl') ||
    null

  const openContact = (c: CustomerContact) => {
    setSelectedContact(c)
    onContactOpen()
  }

  const openManager = () => {
    const u = customer?.assignedAccountManagerUser || null
    setManagerUser(u)
    if (u) onManagerOpen()
  }

  const refreshDetail = async () => {
    if (!selectedCustomerId) return
    await fetchDetail(selectedCustomerId)
  }

  if (listLoading) {
    return (
      <Stack py={10} align="center" spacing={4}>
        <Spinner size="xl" />
        <Text color="gray.600">Loading customers from database...</Text>
      </Stack>
    )
  }

  if (listError) {
    return (
      <Box p={6}>
        <Text color="red.600" fontSize="sm">
          Failed to load customers: {listError}
        </Text>
        <Button mt={3} size="sm" onClick={() => void fetchList()}>
          Retry
        </Button>
      </Box>
    )
  }

  return (
    <Box w="full" px={{ base: 4, md: 6 }} py={{ base: 4, md: 5 }}>
      <Stack spacing={6} w="full">
        <HStack justify="space-between" align="start" flexWrap="wrap" gap={4}>
          <Box>
            <Heading size="md">Accounts</Heading>
            <Text fontSize="sm" color="gray.600">
              Operational control panel (database-backed).
            </Text>
          </Box>

          <Box minW={{ base: '260px', md: '340px' }}>
            <Text fontSize="xs" color="gray.600" mb={1} fontWeight="semibold">
              Customer
            </Text>
            <Select
              size="sm"
              value={selectedCustomerId}
              onChange={(e) => setSelectedCustomerId(e.target.value)}
            >
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Box>
        </HStack>

        {detailLoading ? (
          <Stack py={10} align="center" spacing={4}>
            <Spinner size="xl" />
            <Text color="gray.600">Loading customer details...</Text>
          </Stack>
        ) : detailError ? (
          <Box p={6} border="1px solid" borderColor="red.200" borderRadius="lg" bg="red.50">
            <Text color="red.700" fontSize="sm">
              Failed to load customer: {detailError}
            </Text>
            <Button mt={3} size="sm" onClick={() => void fetchDetail(selectedCustomerId)}>
              Retry
            </Button>
          </Box>
        ) : !customer ? (
          <Box p={6}>
            <Text fontSize="sm" color="gray.600">
              Select a customer to view account details.
            </Text>
          </Box>
        ) : (
          <Stack spacing={6}>
            <SectionCard title="Company Overview">
              <CompanySection customer={customer} headOfficeAddress={headOfficeAddress} />
            </SectionCard>

            <SectionCard title="Account Ownership">
              <OwnershipSection
                assignedAccountManagerUser={customer.assignedAccountManagerUser}
                assignedClientDdiNumber={assignedClientDdiNumber}
                daysPerWeek={daysPerWeek}
                onOpenManager={openManager}
              />
            </SectionCard>

            <SectionCard title="Financial & Targets">
              <FinancialSection
                monthlyIntakeGBP={customer.monthlyIntakeGBP}
                monthlyRevenueFromCustomer={customer.monthlyRevenueFromCustomer}
                weeklyLeadTarget={customer.weeklyLeadTarget}
                weeklyLeadActual={customer.weeklyLeadActual}
                monthlyLeadTarget={customer.monthlyLeadTarget}
                monthlyLeadActual={customer.monthlyLeadActual}
                defcon={customer.defcon}
              />
            </SectionCard>

            <SectionCard title="Lead Source Configuration">
              <LeadSourceSection
                leadsGoogleSheetUrl={leadsGoogleSheetUrl}
                leadsGoogleSheetLabel={leadsGoogleSheetLabel}
                leadsReportingUrl={leadsReportingUrl}
              />
            </SectionCard>

            <SectionCard title="Agreement & Documents">
              <AgreementSection
                customerId={customer.id}
                agreementFileName={customer.agreementFileName || null}
                uploadedAt={customer.agreementUploadedAt || null}
                uploadedBy={customer.agreementUploadedByEmail || null}
              />
            </SectionCard>

            <SectionCard
              title="Contacts"
              right={
                <Button size="sm" variant="link" onClick={onNavigateToContacts}>
                  Open Contacts tab
                </Button>
              }
            >
              <ContactsSection
                contacts={customer.customerContacts || []}
                onRowClick={openContact}
                onAddContact={onNavigateToContacts}
              />
            </SectionCard>

            <SectionCard title="Notes">
              <NotesSection customerId={customer.id} notes={notes} onAfterAdd={refreshDetail} />
            </SectionCard>
          </Stack>
        )}
      </Stack>

      {/* Contact detail modal */}
      <Modal isOpen={isContactOpen} onClose={onContactClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Contact details</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            {selectedContact ? (
              <Stack spacing={2}>
                <Text fontSize="sm">
                  <Text as="span" fontWeight="semibold">
                    Name:
                  </Text>{' '}
                  {selectedContact.name}
                </Text>
                <Text fontSize="sm">
                  <Text as="span" fontWeight="semibold">
                    Title:
                  </Text>{' '}
                  {selectedContact.title || 'Not set'}
                </Text>
                <Text fontSize="sm">
                  <Text as="span" fontWeight="semibold">
                    Email:
                  </Text>{' '}
                  {selectedContact.email || 'Not set'}
                </Text>
                <Text fontSize="sm">
                  <Text as="span" fontWeight="semibold">
                    Phone:
                  </Text>{' '}
                  {selectedContact.phone || 'Not set'}
                </Text>
                <Text fontSize="sm">
                  <Text as="span" fontWeight="semibold">
                    Status:
                  </Text>{' '}
                  {selectedContact.isPrimary ? 'Primary' : '—'}
                </Text>
                <Text fontSize="sm">
                  <Text as="span" fontWeight="semibold">
                    Notes:
                  </Text>{' '}
                  {selectedContact.notes || 'Not set'}
                </Text>
              </Stack>
            ) : (
              <Text fontSize="sm" color="gray.600">
                No contact selected.
              </Text>
            )}
          </ModalBody>
        </ModalContent>
      </Modal>

      {/* Account manager modal */}
      <Modal isOpen={isManagerOpen} onClose={onManagerClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Account manager</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            {managerUser ? (
              <Stack spacing={2}>
                <Text fontSize="sm">
                  <Text as="span" fontWeight="semibold">
                    Name:
                  </Text>{' '}
                  {`${managerUser.firstName} ${managerUser.lastName}`.trim() || 'Not set'}
                </Text>
                <Text fontSize="sm">
                  <Text as="span" fontWeight="semibold">
                    Email:
                  </Text>{' '}
                  {managerUser.email}
                </Text>
                <Text fontSize="sm">
                  <Text as="span" fontWeight="semibold">
                    Role:
                  </Text>{' '}
                  {managerUser.role || 'Not set'}
                </Text>
                <Text fontSize="sm">
                  <Text as="span" fontWeight="semibold">
                    Department:
                  </Text>{' '}
                  {managerUser.department || 'Not set'}
                </Text>
              </Stack>
            ) : (
              <Text fontSize="sm" color="gray.600">
                No account manager assigned.
              </Text>
            )}
          </ModalBody>
        </ModalContent>
      </Modal>
    </Box>
  )
}

