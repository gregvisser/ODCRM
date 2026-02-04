import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Box,
  Button,
  Divider,
  FormControl,
  FormErrorMessage,
  FormLabel,
  Heading,
  HStack,
  IconButton,
  Input,
  Link,
  Select,
  SimpleGrid,
  Spinner,
  Stack,
  Tag,
  TagCloseButton,
  TagLabel,
  Text,
  Textarea,
  useToast,
  VStack,
} from '@chakra-ui/react'
import { AddIcon, AttachmentIcon, CloseIcon } from '@chakra-ui/icons'
import { api } from '../../utils/api'
import { emit } from '../../platform/events'
import { settingsStore } from '../../platform'
import { OdcrmStorageKeys } from '../../platform/keys'
import { getJson, setJson } from '../../platform/storage'
import { useUsersFromDatabase } from '../../hooks/useUsersFromDatabase'
import EmailAccountsEnhancedTab from '../../components/EmailAccountsEnhancedTab'
import {
  buildAccountFromCustomer,
  type Account,
  type Accreditation,
  type ClientProfile,
  type PrimaryContact,
  type SocialMediaPresence,
  type TargetGeographicalArea,
} from '../../components/AccountsTab'

type CustomerContactApi = {
  id: string
  customerId: string
  name: string
  email?: string | null
  phone?: string | null
  title?: string | null
  isPrimary: boolean
}

type CustomerApi = {
  id: string
  name: string
  accountData?: Record<string, unknown> | null
  customerContacts?: CustomerContactApi[]
}

type JobTaxonomyItem = {
  id: string
  label: string
}

type ContactRoleItem = {
  id: string
  label: string
}

type AccountDetails = {
  primaryContact: PrimaryContact
  headOfficeAddress: string
  headOfficePlaceId?: string
  headOfficePostcode?: string
  assignedAccountManagerId?: string
  assignedAccountManagerName?: string
  assignedClientDdiNumber: string
  emailAccounts: string[]
  daysPerWeek: number
}

type AssignedUser = {
  id: string
  userId: string
  firstName: string
  lastName: string
  email: string
  accountStatus: 'Active' | 'Inactive'
}

type StoredContact = {
  id: string
  name: string
  title: string
  accounts: string[]
  tier: string
  status: string
  email: string
  phone: string
}

const EMPTY_SOCIAL: SocialMediaPresence = {
  facebookUrl: '',
  linkedinUrl: '',
  xUrl: '',
  instagramUrl: '',
  tiktokUrl: '',
  youtubeUrl: '',
  websiteUrl: '',
}

const EMPTY_PROFILE: ClientProfile = {
  clientHistory: '',
  accreditations: [],
  targetGeographicalArea: undefined,
  targetJobSectorIds: [],
  targetJobRoleIds: [],
  keyBusinessObjectives: '',
  clientUSPs: '',
  socialMediaPresence: EMPTY_SOCIAL,
  qualifyingQuestions: '',
  caseStudiesOrTestimonials: '',
}

const EMPTY_PRIMARY_CONTACT: PrimaryContact = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  roleId: '',
  roleLabel: '',
  status: 'Active',
}

const EMPTY_ACCOUNT_DETAILS: AccountDetails = {
  primaryContact: EMPTY_PRIMARY_CONTACT,
  headOfficeAddress: '',
  headOfficePlaceId: '',
  headOfficePostcode: '',
  assignedAccountManagerId: '',
  assignedAccountManagerName: '',
  assignedClientDdiNumber: '',
  emailAccounts: ['', '', '', '', ''],
  daysPerWeek: 1,
}

const CONTACT_ROLES_STORAGE_KEY = 'odcrm_contact_roles'

const normalizeClientProfile = (raw?: Partial<ClientProfile> | null): ClientProfile => {
  const safe = raw && typeof raw === 'object' ? raw : {}
  return {
    ...EMPTY_PROFILE,
    ...safe,
    accreditations: Array.isArray(safe.accreditations) ? safe.accreditations : [],
    targetJobSectorIds: Array.isArray(safe.targetJobSectorIds) ? safe.targetJobSectorIds : [],
    targetJobRoleIds: Array.isArray(safe.targetJobRoleIds) ? safe.targetJobRoleIds : [],
    socialMediaPresence: {
      ...EMPTY_SOCIAL,
      ...(safe.socialMediaPresence || {}),
    },
    targetGeographicalArea:
      safe.targetGeographicalArea && typeof safe.targetGeographicalArea === 'object'
        ? safe.targetGeographicalArea
        : undefined,
  }
}

const normalizeAccountDetails = (raw?: Partial<AccountDetails> | null): AccountDetails => {
  const safe = raw && typeof raw === 'object' ? raw : {}
  return {
    ...EMPTY_ACCOUNT_DETAILS,
    ...safe,
    primaryContact: {
      ...EMPTY_PRIMARY_CONTACT,
      ...(safe.primaryContact || {}),
    },
    emailAccounts: Array.isArray(safe.emailAccounts) && safe.emailAccounts.length
      ? safe.emailAccounts
      : [...EMPTY_ACCOUNT_DETAILS.emailAccounts],
    daysPerWeek: typeof safe.daysPerWeek === 'number' ? safe.daysPerWeek : 1,
  }
}

const isValidUrl = (value: string): boolean => {
  if (!value) return true
  try {
    new URL(value)
    return true
  } catch {
    return false
  }
}

const buildAccreditation = (): Accreditation => ({
  id: `acc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
  name: '',
})

const loadContactRoles = (): ContactRoleItem[] => {
  const stored = getJson<ContactRoleItem[]>(CONTACT_ROLES_STORAGE_KEY)
  return Array.isArray(stored) ? stored : []
}

const saveContactRoles = (roles: ContactRoleItem[]) => {
  setJson(CONTACT_ROLES_STORAGE_KEY, roles)
}

type OnboardingHomePageProps = {
  /** When navigating from Accounts tab, focus this account by name (from URL / app state). Data is loaded from API (DB), not localStorage. */
  focusAccountName?: string
}

export default function OnboardingHomePage({ focusAccountName }: OnboardingHomePageProps) {
  const toast = useToast()
  const [customers, setCustomers] = useState<CustomerApi[]>([])
  const [selectedCustomerId, setSelectedCustomerId] = useState('')
  const [clientProfile, setClientProfile] = useState<ClientProfile>(EMPTY_PROFILE)
  const [accountDetails, setAccountDetails] = useState<AccountDetails>(EMPTY_ACCOUNT_DETAILS)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [jobSectors, setJobSectors] = useState<JobTaxonomyItem[]>([])
  const [jobRoles, setJobRoles] = useState<JobTaxonomyItem[]>([])
  const [contactRoles, setContactRoles] = useState<ContactRoleItem[]>([])
  const [jobSectorInput, setJobSectorInput] = useState('')
  const [jobRoleInput, setJobRoleInput] = useState('')
  const [contactRoleInput, setContactRoleInput] = useState('')
  const [geoQuery, setGeoQuery] = useState('')
  const [geoOptions, setGeoOptions] = useState<TargetGeographicalArea[]>([])
  const [geoLoading, setGeoLoading] = useState(false)
  const [headOfficeQuery, setHeadOfficeQuery] = useState('')
  const [headOfficeOptions, setHeadOfficeOptions] = useState<TargetGeographicalArea[]>([])
  const [headOfficeLoading, setHeadOfficeLoading] = useState(false)
  const [uploadingAccreditations, setUploadingAccreditations] = useState<Record<string, boolean>>({})
  const [uploadingCaseStudies, setUploadingCaseStudies] = useState(false)

  const { users: usersFromDb } = useUsersFromDatabase()
  const assignedUsers = useMemo<AssignedUser[]>(
    () =>
      (usersFromDb || [])
        .filter((u) => u.accountStatus === 'Active')
        .map((u) => ({
          id: u.id,
          userId: u.userId,
          firstName: u.firstName,
          lastName: u.lastName,
          email: u.email,
          accountStatus: u.accountStatus,
        })),
    [usersFromDb],
  )

  const selectedCustomer = useMemo(
    () => customers.find((c) => c.id === selectedCustomerId) || null,
    [customers, selectedCustomerId],
  )

  // Database-first: derive account snapshot from API customer, not localStorage
  const selectedAccountSnapshot = useMemo(() => {
    if (!selectedCustomer) return null
    return buildAccountFromCustomer(selectedCustomer as Parameters<typeof buildAccountFromCustomer>[0])
  }, [selectedCustomer])

  const fetchCustomers = useCallback(async () => {
    setIsLoading(true)
    setLoadError(null)
    const { data, error } = await api.get<CustomerApi[]>('/api/customers')
    if (error) {
      setLoadError(error)
      setIsLoading(false)
      return
    }
    const apiCustomers = Array.isArray(data) ? data : []
    setCustomers(apiCustomers)
    if (!selectedCustomerId || !apiCustomers.some((item) => item.id === selectedCustomerId)) {
      setSelectedCustomerId(apiCustomers[0]?.id || '')
    }
    setIsLoading(false)
  }, [selectedCustomerId])

  // When opened from Accounts tab with focus (e.g. "Open in Onboarding"), select that account. Data from API (DB).
  useEffect(() => {
    if (!focusAccountName || customers.length === 0) return
    const match = customers.find((c) => c.name === focusAccountName)
    if (match) setSelectedCustomerId(match.id)
  }, [focusAccountName, customers])

  const fetchTaxonomy = useCallback(async () => {
    const [sectorsResponse, rolesResponse] = await Promise.all([
      api.get<JobTaxonomyItem[]>('/api/job-sectors'),
      api.get<JobTaxonomyItem[]>('/api/job-roles'),
    ])
    if (sectorsResponse.error) {
      toast({
        title: 'Could not load job sectors',
        description: sectorsResponse.error,
        status: 'error',
        duration: 4000,
      })
    } else if (sectorsResponse.data) {
      setJobSectors(sectorsResponse.data)
    }
    if (rolesResponse.error) {
      toast({
        title: 'Could not load job roles',
        description: rolesResponse.error,
        status: 'error',
        duration: 4000,
      })
    } else if (rolesResponse.data) {
      setJobRoles(rolesResponse.data)
    }
  }, [toast])

  useEffect(() => {
    void fetchCustomers()
    void fetchTaxonomy()
    setContactRoles(loadContactRoles())
  }, [fetchCustomers, fetchTaxonomy])

  useEffect(() => {
    if (!selectedCustomer) return
    const rawAccountData =
      selectedCustomer.accountData && typeof selectedCustomer.accountData === 'object'
        ? selectedCustomer.accountData
        : {}
    const nextProfile = normalizeClientProfile((rawAccountData as { clientProfile?: ClientProfile }).clientProfile)
    setClientProfile(nextProfile)
    setGeoQuery(nextProfile.targetGeographicalArea?.label || '')

    const rawDetails = rawAccountData as Partial<AccountDetails> & {
      accountDetails?: Partial<AccountDetails>
    }
    const mergedDetails = normalizeAccountDetails({
      ...rawDetails,
      ...rawDetails.accountDetails,
    })
    setAccountDetails(mergedDetails)
    setHeadOfficeQuery(mergedDetails.headOfficeAddress || '')
  }, [selectedCustomer])

  useEffect(() => {
    if (selectedCustomerId) {
      settingsStore.setCurrentCustomerId(selectedCustomerId)
    }
  }, [selectedCustomerId])

  useEffect(() => {
    if (!geoQuery || geoQuery.trim().length < 2) {
      setGeoOptions([])
      return
    }
    const handle = window.setTimeout(async () => {
      setGeoLoading(true)
      const { data } = await api.get<TargetGeographicalArea[]>(
        `/api/places?query=${encodeURIComponent(geoQuery.trim())}`,
      )
      setGeoOptions(Array.isArray(data) ? data : [])
      setGeoLoading(false)
    }, 350)
    return () => window.clearTimeout(handle)
  }, [geoQuery])

  useEffect(() => {
    if (!headOfficeQuery || headOfficeQuery.trim().length < 2) {
      setHeadOfficeOptions([])
      return
    }
    const handle = window.setTimeout(async () => {
      setHeadOfficeLoading(true)
      const { data } = await api.get<TargetGeographicalArea[]>(
        `/api/places?query=${encodeURIComponent(headOfficeQuery.trim())}`,
      )
      setHeadOfficeOptions(Array.isArray(data) ? data : [])
      setHeadOfficeLoading(false)
    }, 350)
    return () => window.clearTimeout(handle)
  }, [headOfficeQuery])

  const updateProfile = useCallback((updates: Partial<ClientProfile>) => {
    setClientProfile((prev) => ({ ...prev, ...updates }))
  }, [])

  const updateAccountDetails = useCallback((updates: Partial<AccountDetails>) => {
    setAccountDetails((prev) => ({ ...prev, ...updates }))
  }, [])

  const updatePrimaryContact = useCallback((updates: Partial<PrimaryContact>) => {
    setAccountDetails((prev) => ({
      ...prev,
      primaryContact: {
        ...prev.primaryContact,
        ...updates,
      },
    }))
  }, [])

  const updateSocial = useCallback(
    (updates: Partial<SocialMediaPresence>) => {
      updateProfile({
        socialMediaPresence: {
          ...clientProfile.socialMediaPresence,
          ...updates,
        },
      })
    },
    [clientProfile.socialMediaPresence, updateProfile],
  )

  const handleAddAccreditation = () => {
    updateProfile({ accreditations: [...clientProfile.accreditations, buildAccreditation()] })
  }

  const handleRemoveAccreditation = (id: string) => {
    updateProfile({
      accreditations: clientProfile.accreditations.filter((acc) => acc.id !== id),
    })
  }

  const handleAccreditationNameChange = (id: string, name: string) => {
    updateProfile({
      accreditations: clientProfile.accreditations.map((acc) =>
        acc.id === id ? { ...acc, name } : acc,
      ),
    })
  }

  const handleAccreditationFileChange = (id: string, file: File | null) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = async () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : ''
      if (!dataUrl) return
      setUploadingAccreditations((prev) => ({ ...prev, [id]: true }))
      const { data, error } = await api.post<{ fileUrl: string; fileName: string }>(
        '/api/uploads',
        { fileName: file.name, dataUrl },
      )
      if (error || !data?.fileUrl) {
        toast({
          title: 'Upload failed',
          description: error || 'Unable to upload file',
          status: 'error',
          duration: 4000,
        })
      } else {
        updateProfile({
          accreditations: clientProfile.accreditations.map((acc) =>
            acc.id === id ? { ...acc, fileName: data.fileName, fileUrl: data.fileUrl } : acc,
          ),
        })
      }
      setUploadingAccreditations((prev) => ({ ...prev, [id]: false }))
    }
    reader.readAsDataURL(file)
  }

  const handleRemoveAccreditationFile = (id: string) => {
    updateProfile({
      accreditations: clientProfile.accreditations.map((acc) =>
        acc.id === id ? { ...acc, fileName: undefined, fileUrl: undefined } : acc,
      ),
    })
  }

  const handleCaseStudiesFileChange = (file: File | null) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = async () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : ''
      if (!dataUrl) return
      setUploadingCaseStudies(true)
      const { data, error } = await api.post<{ fileUrl: string; fileName: string }>(
        '/api/uploads',
        { fileName: file.name, dataUrl },
      )
      if (error || !data?.fileUrl) {
        toast({
          title: 'Upload failed',
          description: error || 'Unable to upload file',
          status: 'error',
          duration: 4000,
        })
      } else {
        updateProfile({
          caseStudiesFileName: data.fileName,
          caseStudiesFileUrl: data.fileUrl,
        })
      }
      setUploadingCaseStudies(false)
    }
    reader.readAsDataURL(file)
  }

  const handleRemoveCaseStudiesFile = () => {
    updateProfile({
      caseStudiesFileName: undefined,
      caseStudiesFileUrl: undefined,
    })
  }

  const resolveLabel = (items: JobTaxonomyItem[], id: string) =>
    items.find((item) => item.id === id)?.label || id

  const createJobSector = async (label: string): Promise<JobTaxonomyItem | null> => {
    const trimmed = label.trim()
    if (!trimmed) return null
    const existing = jobSectors.find((item) => item.label.toLowerCase() === trimmed.toLowerCase())
    if (existing) return existing
    const { data, error } = await api.post<JobTaxonomyItem>('/api/job-sectors', { label: trimmed })
    if (error || !data) {
      toast({
        title: 'Could not add job sector',
        description: error || 'Unknown error',
        status: 'error',
        duration: 4000,
      })
      return null
    }
    setJobSectors((prev) => [...prev, data].sort((a, b) => a.label.localeCompare(b.label)))
    return data
  }

  const createJobRole = async (label: string): Promise<JobTaxonomyItem | null> => {
    const trimmed = label.trim()
    if (!trimmed) return null
    const existing = jobRoles.find((item) => item.label.toLowerCase() === trimmed.toLowerCase())
    if (existing) return existing
    const { data, error } = await api.post<JobTaxonomyItem>('/api/job-roles', { label: trimmed })
    if (error || !data) {
      toast({
        title: 'Could not add job role',
        description: error || 'Unknown error',
        status: 'error',
        duration: 4000,
      })
      return null
    }
    setJobRoles((prev) => [...prev, data].sort((a, b) => a.label.localeCompare(b.label)))
    return data
  }

  const createContactRole = (label: string): ContactRoleItem | null => {
    const trimmed = label.trim()
    if (!trimmed) return null
    const existing = contactRoles.find((item) => item.label.toLowerCase() === trimmed.toLowerCase())
    if (existing) return existing
    const next: ContactRoleItem = {
      id: `role_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      label: trimmed,
    }
    const updated = [...contactRoles, next].sort((a, b) => a.label.localeCompare(b.label))
    setContactRoles(updated)
    saveContactRoles(updated)
    return next
  }

  const addJobSector = async (label: string) => {
    const item = await createJobSector(label)
    if (!item) return
    updateProfile({
      targetJobSectorIds: clientProfile.targetJobSectorIds.includes(item.id)
        ? clientProfile.targetJobSectorIds
        : [...clientProfile.targetJobSectorIds, item.id],
    })
    setJobSectorInput('')
  }

  const addJobRole = async (label: string) => {
    const item = await createJobRole(label)
    if (!item) return
    updateProfile({
      targetJobRoleIds: clientProfile.targetJobRoleIds.includes(item.id)
        ? clientProfile.targetJobRoleIds
        : [...clientProfile.targetJobRoleIds, item.id],
    })
    setJobRoleInput('')
  }

  const addContactRole = (label: string) => {
    const item = createContactRole(label)
    if (!item) return
    updatePrimaryContact({ roleId: item.id, roleLabel: item.label })
    setContactRoleInput('')
  }

  const removeJobSector = (id: string) => {
    updateProfile({
      targetJobSectorIds: clientProfile.targetJobSectorIds.filter((itemId) => itemId !== id),
    })
  }

  const removeJobRole = (id: string) => {
    updateProfile({
      targetJobRoleIds: clientProfile.targetJobRoleIds.filter((itemId) => itemId !== id),
    })
  }

  const upsertContactForAccount = (accountName: string, contact: PrimaryContact): string | null => {
    const fullName = `${contact.firstName} ${contact.lastName}`.trim()
    if (!fullName) return null
    const contacts = getJson<StoredContact[]>(OdcrmStorageKeys.contacts) || []
    const existingIndex = contacts.findIndex((item) => item.id === contact.id)
    const nextId =
      contact.id ||
      `contact_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    const nextContact: StoredContact = {
      id: nextId,
      name: fullName,
      title: contact.roleLabel || contact.roleId || '',
      accounts: accountName ? [accountName] : [],
      tier: 'Decision maker',
      status: contact.status,
      email: contact.email,
      phone: contact.phone,
    }
    const updated =
      existingIndex >= 0
        ? contacts.map((item, index) => (index === existingIndex ? nextContact : item))
        : [...contacts, nextContact]
    setJson(OdcrmStorageKeys.contacts, updated)
    emit('contactsUpdated', updated)
    return nextId
  }

  const handleSave = async () => {
    if (!selectedCustomer) return
    setIsSaving(true)
    const currentAccountData =
      selectedCustomer.accountData && typeof selectedCustomer.accountData === 'object'
        ? selectedCustomer.accountData
        : {}
    const nextContactId = upsertContactForAccount(
      selectedCustomer.name,
      accountDetails.primaryContact,
    )
    const nextAccountDetails = {
      ...accountDetails,
      primaryContact: {
        ...accountDetails.primaryContact,
        id: nextContactId || accountDetails.primaryContact.id,
      },
    }
    const nextAccountData = {
      ...currentAccountData,
      clientProfile,
      accountDetails: nextAccountDetails,
      contactPersons: `${accountDetails.primaryContact.firstName} ${accountDetails.primaryContact.lastName}`.trim(),
      contactEmail: accountDetails.primaryContact.email,
      contactNumber: accountDetails.primaryContact.phone,
      primaryContact: nextAccountDetails.primaryContact,
      contactRoleId: accountDetails.primaryContact.roleId,
      contactRoleLabel: accountDetails.primaryContact.roleLabel,
      contactActive: accountDetails.primaryContact.status === 'Active',
      headOfficeAddress: accountDetails.headOfficeAddress,
      headOfficePlaceId: accountDetails.headOfficePlaceId,
      headOfficePostcode: accountDetails.headOfficePostcode,
      assignedAccountManager: accountDetails.assignedAccountManagerName,
      assignedAccountManagerId: accountDetails.assignedAccountManagerId,
      assignedClientDdiNumber: accountDetails.assignedClientDdiNumber,
      emailAccounts: accountDetails.emailAccounts,
      emailAccountsSetUp: accountDetails.emailAccounts.some((value) => value.trim()),
      days: accountDetails.daysPerWeek,
    }
    const { error } = await api.put(`/api/customers/${selectedCustomer.id}`, {
      name: selectedCustomer.name,
      accountData: nextAccountData,
    })
    if (error) {
      toast({ title: 'Save failed', description: error, status: 'error', duration: 4000 })
      setIsSaving(false)
      return
    }
    const updatedCustomers = customers.map((customer) =>
      customer.id === selectedCustomer.id ? { ...customer, accountData: nextAccountData } : customer,
    )
    setCustomers(updatedCustomers)
    // Keep accounts cache in sync from API state (database is source of truth; do not read from localStorage)
    const updatedAccounts = updatedCustomers.map((c) => {
      const acc = buildAccountFromCustomer(c as Parameters<typeof buildAccountFromCustomer>[0]) as Account & { _databaseId?: string }
      acc._databaseId = c.id
      return acc
    })
    setJson(OdcrmStorageKeys.accounts, updatedAccounts)
    emit('accountsUpdated', updatedAccounts)
    setAccountDetails(nextAccountDetails)

    // Create or update primary contact in database so it appears in Customers → Contacts tab
    const fullName = `${accountDetails.primaryContact.firstName} ${accountDetails.primaryContact.lastName}`.trim()
    const primaryEmail = accountDetails.primaryContact.email?.trim() || null
    if (fullName) {
      const contacts = selectedCustomer.customerContacts ?? []
      const existingByEmail = primaryEmail
        ? contacts.find((c) => (c.email || '').toLowerCase() === primaryEmail.toLowerCase())
        : null
      const payload = {
        name: fullName,
        email: primaryEmail,
        phone: accountDetails.primaryContact.phone || null,
        title: accountDetails.primaryContact.roleLabel || null,
        isPrimary: true,
      }
      if (existingByEmail) {
        await api.put(`/api/customers/${selectedCustomer.id}/contacts/${existingByEmail.id}`, payload)
      } else {
        await api.post(`/api/customers/${selectedCustomer.id}/contacts`, payload)
      }
      // Refresh customer list so next save sees updated customerContacts (avoid duplicate creates)
      const { data: refreshed } = await api.get<CustomerApi[]>('/api/customers')
      if (refreshed) setCustomers(refreshed)
      // Contact is already in localStorage and contactsUpdated was emitted by upsertContactForAccount above
    }

    toast({ title: 'Onboarding details saved', status: 'success', duration: 2500 })
    setIsSaving(false)
  }

  return (
    <Stack spacing={6}>
      <Box>
        <Heading size="lg">Onboarding</Heading>
        <Text color="gray.600" fontSize="sm">
          Capture client onboarding details and persist them to the Opensdoors account record.
        </Text>
      </Box>

      <Box border="1px solid" borderColor="gray.200" borderRadius="xl" p={6} bg="white">
        <Stack spacing={4}>
          <FormControl>
            <FormLabel>Opensdoors Account</FormLabel>
            {isLoading ? (
              <HStack spacing={2}>
                <Spinner size="sm" />
                <Text fontSize="sm" color="gray.600">
                  Loading accounts...
                </Text>
              </HStack>
            ) : (
              <Select
                value={selectedCustomerId}
                onChange={(e) => setSelectedCustomerId(e.target.value)}
                placeholder={customers.length ? 'Select account' : 'No accounts found'}
              >
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name}
                  </option>
                ))}
              </Select>
            )}
          </FormControl>

          {loadError ? (
            <Text color="red.500" fontSize="sm">
              {loadError}
            </Text>
          ) : null}
        </Stack>
      </Box>

      {selectedCustomer ? (
        <Stack spacing={6}>
          <Box border="1px solid" borderColor="gray.200" borderRadius="xl" p={6} bg="white">
          <Stack spacing={6}>
            <Heading size="md">Account Details</Heading>

            <SimpleGrid columns={{ base: 1, md: 2 }} spacing={6}>
              <FormControl>
                <FormLabel>Contact First Name</FormLabel>
                <Input
                  value={accountDetails.primaryContact.firstName}
                  onChange={(e) => updatePrimaryContact({ firstName: e.target.value })}
                  placeholder="First name"
                />
              </FormControl>
              <FormControl>
                <FormLabel>Contact Last Name</FormLabel>
                <Input
                  value={accountDetails.primaryContact.lastName}
                  onChange={(e) => updatePrimaryContact({ lastName: e.target.value })}
                  placeholder="Last name"
                />
              </FormControl>
              <FormControl>
                <FormLabel>Contact Email</FormLabel>
                <Input
                  type="email"
                  value={accountDetails.primaryContact.email}
                  onChange={(e) => updatePrimaryContact({ email: e.target.value })}
                  placeholder="name@company.com"
                />
              </FormControl>
              <FormControl>
                <FormLabel>Contact Number</FormLabel>
                <Input
                  value={accountDetails.primaryContact.phone}
                  onChange={(e) => updatePrimaryContact({ phone: e.target.value })}
                  placeholder="Phone number"
                />
              </FormControl>
              <FormControl>
                <FormLabel>Role at Company</FormLabel>
                <Stack spacing={2}>
                  <HStack>
                    <Input
                      list="contact-role-options"
                      value={contactRoleInput}
                      onChange={(e) => setContactRoleInput(e.target.value)}
                      placeholder="Add or select a role"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          addContactRole(contactRoleInput)
                        }
                      }}
                    />
                    <IconButton
                      aria-label="Add role"
                      icon={<AddIcon />}
                      onClick={() => addContactRole(contactRoleInput)}
                    />
                  </HStack>
                  <datalist id="contact-role-options">
                    {contactRoles.map((role) => (
                      <option key={role.id} value={role.label} />
                    ))}
                  </datalist>
                  {accountDetails.primaryContact.roleLabel ? (
                    <Tag size="sm" colorScheme="blue" borderRadius="full">
                      <TagLabel>{accountDetails.primaryContact.roleLabel}</TagLabel>
                      <TagCloseButton onClick={() => updatePrimaryContact({ roleId: '', roleLabel: '' })} />
                    </Tag>
                  ) : null}
                </Stack>
              </FormControl>
              <FormControl>
                <FormLabel>Contact Status</FormLabel>
                <Select
                  value={accountDetails.primaryContact.status}
                  onChange={(e) =>
                    updatePrimaryContact({ status: e.target.value as PrimaryContact['status'] })
                  }
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </Select>
              </FormControl>
            </SimpleGrid>

            <Divider />

            <SimpleGrid columns={{ base: 1, md: 2 }} spacing={6}>
              <FormControl>
                <FormLabel>Web Address</FormLabel>
                <Input
                  value={selectedAccountSnapshot?.website || ''}
                  isReadOnly
                  placeholder="Website from account card"
                />
              </FormControl>
              <FormControl>
                <FormLabel>Assigned Account Manager</FormLabel>
                <Select
                  placeholder={assignedUsers.length ? 'Select user' : 'No users found'}
                  value={accountDetails.assignedAccountManagerId || ''}
                  onChange={(e) => {
                    const nextId = e.target.value
                    const user = assignedUsers.find((u) => u.id === nextId) || null
                    updateAccountDetails({
                      assignedAccountManagerId: nextId,
                      assignedAccountManagerName: user ? `${user.firstName} ${user.lastName}`.trim() : '',
                    })
                  }}
                >
                  {assignedUsers.map((user) => (
                    <option key={user.id} value={user.id}>
                      {`${user.firstName} ${user.lastName}`.trim()} ({user.email})
                    </option>
                  ))}
                </Select>
              </FormControl>
              <FormControl>
                <FormLabel>Assigned Client DDI & Number</FormLabel>
                <Input
                  value={accountDetails.assignedClientDdiNumber}
                  onChange={(e) => updateAccountDetails({ assignedClientDdiNumber: e.target.value })}
                  placeholder="DDI / Number"
                />
              </FormControl>
              <FormControl>
                <FormLabel>Days a Week</FormLabel>
                <Select
                  value={accountDetails.daysPerWeek}
                  onChange={(e) => updateAccountDetails({ daysPerWeek: Number(e.target.value) })}
                >
                  <option value={1}>1 day</option>
                  <option value={2}>2 days</option>
                  <option value={3}>3 days</option>
                  <option value={4}>4 days</option>
                  <option value={5}>5 days</option>
                </Select>
              </FormControl>
              <FormControl>
                <FormLabel>Weekly Lead Target</FormLabel>
                <Input
                  value={
                    typeof selectedAccountSnapshot?.weeklyTarget === 'number'
                      ? String(selectedAccountSnapshot.weeklyTarget)
                      : ''
                  }
                  isReadOnly
                  placeholder="Pulled from linked Google Sheet"
                />
              </FormControl>
            </SimpleGrid>

            <FormControl>
              <FormLabel>Head Office Address</FormLabel>
              <Stack spacing={2}>
                <Input
                  value={headOfficeQuery}
                  onChange={(e) => {
                    setHeadOfficeQuery(e.target.value)
                    updateAccountDetails({ headOfficeAddress: e.target.value })
                  }}
                  placeholder="Search by company name or postcode"
                />
                {headOfficeLoading ? (
                  <HStack spacing={2}>
                    <Spinner size="xs" />
                    <Text fontSize="xs" color="gray.500">
                      Searching addresses...
                    </Text>
                  </HStack>
                ) : null}
                {headOfficeOptions.length > 0 ? (
                  <Box border="1px solid" borderColor="gray.200" borderRadius="md" overflow="hidden">
                    <VStack align="stretch" spacing={0}>
                      {headOfficeOptions.map((option) => (
                        <Button
                          key={option.placeId || option.label}
                          variant="ghost"
                          justifyContent="flex-start"
                          fontWeight="normal"
                          onClick={() => {
                            updateAccountDetails({
                              headOfficeAddress: option.label,
                              headOfficePlaceId: option.placeId,
                            })
                            setHeadOfficeQuery(option.label)
                            setHeadOfficeOptions([])
                          }}
                        >
                          {option.label}
                        </Button>
                      ))}
                    </VStack>
                  </Box>
                ) : null}
              </Stack>
            </FormControl>
          </Stack>
        </Box>

        <Box border="1px solid" borderColor="gray.200" borderRadius="xl" p={6} bg="white">
          <EmailAccountsEnhancedTab />
        </Box>

        <Box border="1px solid" borderColor="gray.200" borderRadius="xl" p={6} bg="white">
          <Stack spacing={6}>
            <HStack justify="space-between">
              <Heading size="md">Client Profile</Heading>
              <Button colorScheme="teal" onClick={handleSave} isLoading={isSaving}>
                Save Client Profile
              </Button>
            </HStack>

            <FormControl>
              <FormLabel>Client History</FormLabel>
              <Textarea
                value={clientProfile.clientHistory}
                onChange={(e) => updateProfile({ clientHistory: e.target.value })}
                minH="120px"
                placeholder="Write a narrative history of the client..."
              />
            </FormControl>

            <FormControl>
              <FormLabel>Accreditations</FormLabel>
              <Stack spacing={4}>
                {clientProfile.accreditations.map((accreditation) => (
                  <Box
                    key={accreditation.id}
                    border="1px solid"
                    borderColor="gray.200"
                    borderRadius="lg"
                    p={4}
                  >
                    <Stack spacing={3}>
                      <HStack justify="space-between" align="flex-start">
                        <FormControl>
                          <FormLabel fontSize="sm">Accreditation name</FormLabel>
                          <Input
                            value={accreditation.name}
                            onChange={(e) => handleAccreditationNameChange(accreditation.id, e.target.value)}
                            placeholder="e.g. ISO 9001"
                          />
                        </FormControl>
                        <IconButton
                          aria-label="Remove accreditation"
                          icon={<CloseIcon />}
                          size="sm"
                          variant="ghost"
                          onClick={() => handleRemoveAccreditation(accreditation.id)}
                        />
                      </HStack>

                      <Stack spacing={2}>
                        <Input
                          type="file"
                          accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                          display="none"
                          id={`accreditation-upload-${accreditation.id}`}
                          onChange={(e) =>
                            handleAccreditationFileChange(accreditation.id, e.target.files?.[0] || null)
                          }
                        />
                        <HStack spacing={3}>
                          <Button
                            as="label"
                            htmlFor={`accreditation-upload-${accreditation.id}`}
                            leftIcon={<AttachmentIcon />}
                            variant="outline"
                            size="sm"
                            isLoading={!!uploadingAccreditations[accreditation.id]}
                            isDisabled={!!uploadingAccreditations[accreditation.id]}
                          >
                            {accreditation.fileUrl ? 'Replace evidence' : 'Upload evidence'}
                          </Button>
                          {accreditation.fileUrl ? (
                            <HStack spacing={2}>
                              <Link href={accreditation.fileUrl} isExternal fontSize="sm" color="teal.600">
                                {accreditation.fileName || 'View file'}
                              </Link>
                              <IconButton
                                aria-label="Remove file"
                                icon={<CloseIcon />}
                                size="xs"
                                variant="ghost"
                                onClick={() => handleRemoveAccreditationFile(accreditation.id)}
                              />
                            </HStack>
                          ) : (
                            <Text fontSize="sm" color="gray.500">
                              No evidence uploaded
                            </Text>
                          )}
                        </HStack>
                      </Stack>
                    </Stack>
                  </Box>
                ))}

                <Button leftIcon={<AddIcon />} variant="outline" size="sm" onClick={handleAddAccreditation}>
                  Add accreditation
                </Button>
              </Stack>
            </FormControl>

            <FormControl>
              <FormLabel>Target Geographical Area</FormLabel>
              <Stack spacing={2}>
                <Input
                  value={geoQuery}
                  onChange={(e) => setGeoQuery(e.target.value)}
                  placeholder="Start typing a UK city, county, or town..."
                />
                {geoLoading ? (
                  <HStack spacing={2}>
                    <Spinner size="xs" />
                    <Text fontSize="xs" color="gray.500">
                      Searching UK locations...
                    </Text>
                  </HStack>
                ) : null}
                {geoOptions.length > 0 ? (
                  <Box border="1px solid" borderColor="gray.200" borderRadius="md" overflow="hidden">
                    <VStack align="stretch" spacing={0}>
                      {geoOptions.map((option) => (
                        <Button
                          key={option.placeId || option.label}
                          variant="ghost"
                          justifyContent="flex-start"
                          fontWeight="normal"
                          onClick={() => {
                            updateProfile({ targetGeographicalArea: option })
                            setGeoQuery(option.label)
                            setGeoOptions([])
                          }}
                        >
                          {option.label}
                        </Button>
                      ))}
                    </VStack>
                  </Box>
                ) : null}
                {clientProfile.targetGeographicalArea ? (
                  <Text fontSize="sm" color="gray.600">
                    Selected: {clientProfile.targetGeographicalArea.label}
                  </Text>
                ) : null}
              </Stack>
            </FormControl>

            <SimpleGrid columns={{ base: 1, md: 2 }} spacing={6}>
              <FormControl>
                <FormLabel>Target Job Sector</FormLabel>
                <Stack spacing={2}>
                  <HStack>
                    <Input
                      list="job-sector-options"
                      value={jobSectorInput}
                      onChange={(e) => setJobSectorInput(e.target.value)}
                      placeholder="Add or select a sector"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          void addJobSector(jobSectorInput)
                        }
                      }}
                    />
                    <IconButton
                      aria-label="Add job sector"
                      icon={<AddIcon />}
                      onClick={() => void addJobSector(jobSectorInput)}
                    />
                  </HStack>
                  <datalist id="job-sector-options">
                    {jobSectors.map((sector) => (
                      <option key={sector.id} value={sector.label} />
                    ))}
                  </datalist>
                  <HStack spacing={2} flexWrap="wrap">
                    {clientProfile.targetJobSectorIds.map((id) => (
                      <Tag key={id} size="sm" colorScheme="teal" borderRadius="full">
                        <TagLabel>{resolveLabel(jobSectors, id)}</TagLabel>
                        <TagCloseButton onClick={() => removeJobSector(id)} />
                      </Tag>
                    ))}
                  </HStack>
                </Stack>
              </FormControl>

              <FormControl>
                <FormLabel>Target Job Roles</FormLabel>
                <Stack spacing={2}>
                  <HStack>
                    <Input
                      list="job-role-options"
                      value={jobRoleInput}
                      onChange={(e) => setJobRoleInput(e.target.value)}
                      placeholder="Add or select a role"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          void addJobRole(jobRoleInput)
                        }
                      }}
                    />
                    <IconButton
                      aria-label="Add job role"
                      icon={<AddIcon />}
                      onClick={() => void addJobRole(jobRoleInput)}
                    />
                  </HStack>
                  <datalist id="job-role-options">
                    {jobRoles.map((role) => (
                      <option key={role.id} value={role.label} />
                    ))}
                  </datalist>
                  <HStack spacing={2} flexWrap="wrap">
                    {clientProfile.targetJobRoleIds.map((id) => (
                      <Tag key={id} size="sm" colorScheme="purple" borderRadius="full">
                        <TagLabel>{resolveLabel(jobRoles, id)}</TagLabel>
                        <TagCloseButton onClick={() => removeJobRole(id)} />
                      </Tag>
                    ))}
                  </HStack>
                </Stack>
              </FormControl>
            </SimpleGrid>

            <FormControl>
              <FormLabel>Key Business Objectives</FormLabel>
              <Textarea
                value={clientProfile.keyBusinessObjectives}
                onChange={(e) => updateProfile({ keyBusinessObjectives: e.target.value })}
                minH="120px"
                placeholder="Capture the client's objectives..."
              />
            </FormControl>

            <FormControl>
              <FormLabel>Client USPs</FormLabel>
              <Textarea
                value={clientProfile.clientUSPs}
                onChange={(e) => updateProfile({ clientUSPs: e.target.value })}
                minH="120px"
                placeholder="Highlight the client's key differentiators..."
              />
            </FormControl>

            <Divider />

            <Box>
              <Heading size="sm" mb={3}>
                Social Media Presence
              </Heading>
              <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                <FormControl isInvalid={!isValidUrl(clientProfile.socialMediaPresence.facebookUrl || '')}>
                  <FormLabel>Facebook</FormLabel>
                  <Input
                    type="url"
                    value={clientProfile.socialMediaPresence.facebookUrl || ''}
                    onChange={(e) => updateSocial({ facebookUrl: e.target.value })}
                    placeholder="https://facebook.com/..."
                  />
                  <FormErrorMessage>Enter a valid URL</FormErrorMessage>
                </FormControl>
                <FormControl isInvalid={!isValidUrl(clientProfile.socialMediaPresence.linkedinUrl || '')}>
                  <FormLabel>LinkedIn</FormLabel>
                  <Input
                    type="url"
                    value={clientProfile.socialMediaPresence.linkedinUrl || ''}
                    onChange={(e) => updateSocial({ linkedinUrl: e.target.value })}
                    placeholder="https://linkedin.com/..."
                  />
                  <FormErrorMessage>Enter a valid URL</FormErrorMessage>
                </FormControl>
                <FormControl isInvalid={!isValidUrl(clientProfile.socialMediaPresence.xUrl || '')}>
                  <FormLabel>X (Twitter)</FormLabel>
                  <Input
                    type="url"
                    value={clientProfile.socialMediaPresence.xUrl || ''}
                    onChange={(e) => updateSocial({ xUrl: e.target.value })}
                    placeholder="https://x.com/..."
                  />
                  <FormErrorMessage>Enter a valid URL</FormErrorMessage>
                </FormControl>
                <FormControl isInvalid={!isValidUrl(clientProfile.socialMediaPresence.instagramUrl || '')}>
                  <FormLabel>Instagram</FormLabel>
                  <Input
                    type="url"
                    value={clientProfile.socialMediaPresence.instagramUrl || ''}
                    onChange={(e) => updateSocial({ instagramUrl: e.target.value })}
                    placeholder="https://instagram.com/..."
                  />
                  <FormErrorMessage>Enter a valid URL</FormErrorMessage>
                </FormControl>
                <FormControl isInvalid={!isValidUrl(clientProfile.socialMediaPresence.tiktokUrl || '')}>
                  <FormLabel>TikTok</FormLabel>
                  <Input
                    type="url"
                    value={clientProfile.socialMediaPresence.tiktokUrl || ''}
                    onChange={(e) => updateSocial({ tiktokUrl: e.target.value })}
                    placeholder="https://tiktok.com/..."
                  />
                  <FormErrorMessage>Enter a valid URL</FormErrorMessage>
                </FormControl>
                <FormControl isInvalid={!isValidUrl(clientProfile.socialMediaPresence.youtubeUrl || '')}>
                  <FormLabel>YouTube</FormLabel>
                  <Input
                    type="url"
                    value={clientProfile.socialMediaPresence.youtubeUrl || ''}
                    onChange={(e) => updateSocial({ youtubeUrl: e.target.value })}
                    placeholder="https://youtube.com/..."
                  />
                  <FormErrorMessage>Enter a valid URL</FormErrorMessage>
                </FormControl>
                <FormControl isInvalid={!isValidUrl(clientProfile.socialMediaPresence.websiteUrl || '')}>
                  <FormLabel>Website/Blog</FormLabel>
                  <Input
                    type="url"
                    value={clientProfile.socialMediaPresence.websiteUrl || ''}
                    onChange={(e) => updateSocial({ websiteUrl: e.target.value })}
                    placeholder="https://..."
                  />
                  <FormErrorMessage>Enter a valid URL</FormErrorMessage>
                </FormControl>
              </SimpleGrid>
            </Box>

            <FormControl>
              <FormLabel>Qualifying Questions</FormLabel>
              <Textarea
                value={clientProfile.qualifyingQuestions}
                onChange={(e) => updateProfile({ qualifyingQuestions: e.target.value })}
                minH="120px"
                placeholder="List the key qualifying questions..."
              />
            </FormControl>

            <FormControl>
              <FormLabel>Case Studies or Testimonials</FormLabel>
              <Stack spacing={3}>
                <Textarea
                  value={clientProfile.caseStudiesOrTestimonials}
                  onChange={(e) => updateProfile({ caseStudiesOrTestimonials: e.target.value })}
                  minH="120px"
                  placeholder="Capture relevant case studies or testimonials..."
                />
                <Stack spacing={2}>
                  <Input
                    type="file"
                    accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                    display="none"
                    id="case-studies-upload"
                    onChange={(e) => handleCaseStudiesFileChange(e.target.files?.[0] || null)}
                  />
                  <HStack spacing={3}>
                    <Button
                      as="label"
                      htmlFor="case-studies-upload"
                      leftIcon={<AttachmentIcon />}
                      variant="outline"
                      size="sm"
                      isLoading={uploadingCaseStudies}
                      isDisabled={uploadingCaseStudies}
                    >
                      {clientProfile.caseStudiesFileUrl ? 'Replace attachment' : 'Attach file'}
                    </Button>
                    {clientProfile.caseStudiesFileUrl ? (
                      <HStack spacing={2}>
                        <Link href={clientProfile.caseStudiesFileUrl} isExternal fontSize="sm" color="teal.600">
                          {clientProfile.caseStudiesFileName || 'View file'}
                        </Link>
                        <IconButton
                          aria-label="Remove file"
                          icon={<CloseIcon />}
                          size="xs"
                          variant="ghost"
                          onClick={handleRemoveCaseStudiesFile}
                        />
                      </HStack>
                    ) : (
                      <Text fontSize="sm" color="gray.500">
                        No file attached
                      </Text>
                    )}
                  </HStack>
                </Stack>
              </Stack>
            </FormControl>
          </Stack>
        </Box>
        </Stack>
      ) : (
        <Box border="1px dashed" borderColor="gray.300" borderRadius="xl" p={6}>
          <Text color="gray.600" fontSize="sm">
            Select an Opensdoors account to begin capturing Client Profile details.
          </Text>
        </Box>
      )}
    </Stack>
  )
}


