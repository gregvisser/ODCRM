import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Accordion,
  AccordionButton,
  AccordionIcon,
  AccordionItem,
  AccordionPanel,
  Badge,
  Box,
  Button,
  Checkbox,
  Divider,
  FormControl,
  FormErrorMessage,
  FormLabel,
  HStack,
  IconButton,
  Input,
  Link,
  Select,
  SimpleGrid,
  Spinner,
  Stack,
  Table,
  Tag,
  TagCloseButton,
  TagLabel,
  Tbody,
  Td,
  Th,
  Thead,
  Text,
  Textarea,
  Tr,
  useDisclosure,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalCloseButton,
  useToast,
  VStack,
} from '@chakra-ui/react'
import { AddIcon, AttachmentIcon, CloseIcon } from '@chakra-ui/icons'
import { api } from '../../utils/api'
import { emit } from '../../platform/events'
import EmailAccountsEnhancedTab from '../../components/EmailAccountsEnhancedTab'
import { onboardingDebug, onboardingError, onboardingWarn } from './utils/debug'
import { safeAccountDataMerge } from './utils/safeAccountDataMerge'
import { CustomerContactsSection } from './components/CustomerContactsSection'
import { useUsersFromDatabase, type DatabaseUser } from '../../hooks/useUsersFromDatabase'
import { fetchCompanyData, type CompanyData } from '../../services/companyDataService'
import { EnrichedFieldWrapper } from './components/EnrichedFieldWrapper'
import {
  ACCOUNTDATA_FIELD_ENRICHMENT_KEY,
  type FieldEnrichmentEntry,
  type FieldEnrichmentStore,
  getFieldEnrichmentEntry,
  readFieldEnrichmentStoreFromAccountData,
  upsertFieldEnrichmentEntry,
} from '../../utils/fieldEnrichment'
import type {
  Account,
  Accreditation,
  ClientProfile,
  PrimaryContact,
  SocialMediaPresence,
  TargetGeographicalArea,
} from '../../components/AccountsTab'

type OnboardingFieldKey = string

// Type definitions
type CustomerApi = {
  id: string
  name: string
  domain?: string | null
  website?: string | null
  whatTheyDo?: string | null
  companyProfile?: string | null
  sector?: string | null
  accountData?: Record<string, unknown> | null
  monthlyRevenueFromCustomer?: string | null
  leadsReportingUrl?: string | null
  leadsGoogleSheetLabel?: string | null
  weeklyLeadTarget?: number | null
  weeklyLeadActual?: number | null
  monthlyLeadTarget?: number | null
  monthlyLeadActual?: number | null
  updatedAt?: string | null
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

// Constants
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

// Helper functions
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

const isPrimaryContactEmpty = (raw: PrimaryContact | null | undefined): boolean => {
  const pc = raw && typeof raw === 'object' ? (raw as any) : {}
  const fields = [
    pc.firstName,
    pc.lastName,
    pc.email,
    pc.phone,
    pc.roleId,
    pc.roleLabel,
  ]
  return fields.every((v) => !String(v || '').trim())
}

const ensurePrimaryContactId = (raw: PrimaryContact): PrimaryContact => {
  const pc: any = raw && typeof raw === 'object' ? raw : {}
  const existingId = typeof pc.id === 'string' ? pc.id.trim() : ''
  if (existingId) return raw
  // Generate a stable id for DB upsert + rehydrate matching (customer_contacts table uses this id).
  // This id is persisted into accountData.accountDetails.primaryContact.id during onboarding save.
  const nextId = `contact_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  return { ...(raw as any), id: nextId }
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

const normalizeWebAddress = (raw: unknown): string | null => {
  if (typeof raw !== 'string') return null
  const trimmed = raw.trim()
  if (!trimmed) return null

  // If user entered a URL without a scheme, default to https://
  const hasScheme = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(trimmed)
  return hasScheme ? trimmed : `https://${trimmed}`
}

// Remove undefined keys deeply so partial payloads never wipe stored DB fields.
// (null is preserved intentionally so explicit clears can be expressed as null)
const stripUndefinedDeep = (input: any): any => {
  if (Array.isArray(input)) return input.map((v) => (v === undefined ? null : stripUndefinedDeep(v)))
  if (!input || typeof input !== 'object') return input
  const out: any = {}
  for (const [k, v] of Object.entries(input)) {
    if (v === undefined) continue
    out[k] = stripUndefinedDeep(v)
  }
  return out
}

const areaKey = (area: any): string => {
  const raw = String(area?.id || area?.placeId || area?.label || '')
  return raw.toLowerCase().trim()
}

const dedupeAreas = (areas: any[]): TargetGeographicalArea[] => {
  const out: TargetGeographicalArea[] = []
  const seen = new Set<string>()
  for (const a of Array.isArray(areas) ? areas : []) {
    if (!a) continue
    const label = typeof a.label === 'string' ? a.label.trim() : ''
    const id = typeof a.placeId === 'string' ? a.placeId : typeof a.id === 'string' ? a.id : ''
    if (!label && !id) continue
    const key = areaKey({ id, label })
    if (!key || seen.has(key)) continue
    seen.add(key)
    out.push({
      label,
      placeId: id || undefined,
    })
  }
  return out
}

const buildAccreditation = (): Accreditation => ({
  id: `acc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
  name: '',
})

// Component props
interface CustomerOnboardingTabProps {
  customerId: string
}

export default function CustomerOnboardingTab({ customerId }: CustomerOnboardingTabProps) {
  const toast = useToast()
  const apiBaseUrl = import.meta.env.VITE_API_URL || ''
  // CRITICAL: Use the same DB-backed source as Settings → User Authorization
  const { users: dbUsers } = useUsersFromDatabase()
  const [isDirty, setIsDirty] = useState(false)
  const dirtyConnectDisclosure = useDisclosure()
  const pendingConnectResolver = useRef<((proceed: boolean) => void) | null>(null)
  const [dirtyPromptBody, setDirtyPromptBody] = useState<string>(
    'You have unsaved onboarding changes. This action may temporarily leave or refresh parts of this page.',
  )
  const [customer, setCustomer] = useState<CustomerApi | null>(null)
  const [customerUpdatedAt, setCustomerUpdatedAt] = useState<string | null>(null)
  const conflictDisclosure = useDisclosure()
  const [conflictCurrentUpdatedAt, setConflictCurrentUpdatedAt] = useState<string | null>(null)
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
  const [targetGeographicalAreas, setTargetGeographicalAreas] = useState<TargetGeographicalArea[]>([])
  const [headOfficeQuery, setHeadOfficeQuery] = useState('')
  const [headOfficeOptions, setHeadOfficeOptions] = useState<TargetGeographicalArea[]>([])
  const [headOfficeLoading, setHeadOfficeLoading] = useState(false)
  const [uploadingAccreditations, setUploadingAccreditations] = useState<Record<string, boolean>>({})
  const [uploadingCaseStudies, setUploadingCaseStudies] = useState(false)
  const [uploadingAgreement, setUploadingAgreement] = useState(false)
  const [agreementData, setAgreementData] = useState<{ fileName?: string; uploadedAt?: string } | null>(null)
  const [uploadingSuppression, setUploadingSuppression] = useState(false)
  const [suppressionMeta, setSuppressionMeta] = useState<{
    fileName?: string | null
    uploadedAt?: string | null
    uploadedByEmail?: string | null
    totalImported?: number | null
    totalSuppressedEmails?: number | null
  } | null>(null)
  const [assignedUsers, setAssignedUsers] = useState<AssignedUser[]>([])
  const [monthlyRevenueFromCustomer, setMonthlyRevenueFromCustomer] = useState<string>('')
  const [leadsGoogleSheetUrl, setLeadsGoogleSheetUrl] = useState<string>('')
  const [leadsGoogleSheetLabel, setLeadsGoogleSheetLabel] = useState<string>('')
  const [weeklyLeadTarget, setWeeklyLeadTarget] = useState<string>('')
  const [monthlyLeadTarget, setMonthlyLeadTarget] = useState<string>('')
  const [additionalContacts, setAdditionalContacts] = useState<any[]>([])
  const [fieldEnrichmentStore, setFieldEnrichmentStore] = useState<FieldEnrichmentStore>({ version: 1, fields: {} })

  const companyDataCacheRef = useRef<{ key: string; data: CompanyData } | null>(null)

  const fetchCompanyDataCached = useCallback(async (): Promise<CompanyData | null> => {
    const name = String(customer?.name || '').trim()
    const website = normalizeWebAddress(String(customer?.website || '').trim()) || ''
    const key = `${name}::${website}`
    if (!name || !website) return null
    if (companyDataCacheRef.current?.key === key) return companyDataCacheRef.current.data
    const data = await fetchCompanyData(name, website)
    if (data) companyDataCacheRef.current = { key, data }
    return data
  }, [customer?.name, customer?.website])

  const getEnrichment = useCallback(
    <T,>(fieldKey: OnboardingFieldKey, fallbackOriginal: T): FieldEnrichmentEntry<T> => {
      return getFieldEnrichmentEntry<T>({ store: fieldEnrichmentStore, fieldKey, fallbackOriginal })
    },
    [fieldEnrichmentStore],
  )

  const setEnrichment = useCallback(
    <T,>(fieldKey: OnboardingFieldKey, next: FieldEnrichmentEntry<T>) => {
      setFieldEnrichmentStore((prev) => upsertFieldEnrichmentEntry<T>({ store: prev, fieldKey, next }))
      setIsDirty(true)
    },
    [],
  )

  // Build account snapshot directly from database customer
  const accountSnapshot = useMemo(() => {
    if (!customer) return null
    const accountData = customer.accountData as Record<string, unknown> | null
    return {
      name: customer.name,
      website: customer.website ?? undefined,
      weeklyTarget: accountData?.weeklyTarget as number | undefined,
      _databaseId: customer.id,
    } as Partial<Account>
  }, [customer])

  // Fetch customer data by ID
  const fetchCustomer = useCallback(async () => {
    if (!customerId) {
      onboardingWarn('⚠️ CustomerOnboardingTab: No customerId, skipping fetch')
      setIsLoading(false)
      return
    }
    onboardingDebug('📥 CustomerOnboardingTab: Fetching customer data for customerId:', customerId)
    setIsLoading(true)
    setLoadError(null)
    const { data, error } = await api.get<CustomerApi>(`/api/customers/${customerId}`)
    if (error) {
      setLoadError(error)
      setIsLoading(false)
      return
    }
    if (data) {
      onboardingDebug('✅ CustomerOnboardingTab: Loaded customer from DB:', {
        customerId,
        name: data.name,
        hasAccountData: !!data.accountData,
      })
      setCustomer(data)
      setCustomerUpdatedAt(typeof (data as any).updatedAt === 'string' ? ((data as any).updatedAt as string) : null)
      // Initialize additional contacts from DB (exclude primary; primary lives in accountDetails.primaryContact)
      const rows = Array.isArray((data as any).customerContacts) ? (data as any).customerContacts : []
      setAdditionalContacts(rows.filter((c: any) => !c?.isPrimary))
      
      // Load agreement data if present (Phase 2 Item 4)
      // Check for blob-based agreement (new) or legacy URL
      const hasAgreement = (data as any).agreementBlobName || (data as any).agreementFileUrl
      if ((data as any).agreementFileName && hasAgreement) {
        setAgreementData({
          fileName: (data as any).agreementFileName,
          uploadedAt: (data as any).agreementUploadedAt,
        })
      } else {
        setAgreementData(null)
      }

      // Fresh DB hydrate: local form state is no longer dirty.
      setIsDirty(false)
    }
    setIsLoading(false)
  }, [customerId])

  // Protect against accidental refresh/close while dirty
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (!isDirty) return
      e.preventDefault()
      // Most browsers ignore the custom message, but returning a value triggers the prompt.
      e.returnValue = ''
      return ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [isDirty])

  const confirmProceedIfDirty = useCallback(
    async (promptBody: string): Promise<boolean> => {
      if (!isDirty) return true
      return await new Promise<boolean>((resolve) => {
        pendingConnectResolver.current = resolve
        setDirtyPromptBody(promptBody)
        dirtyConnectDisclosure.onOpen()
      })
    },
    [isDirty, dirtyConnectDisclosure],
  )

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
    void fetchCustomer()
    void fetchTaxonomy()
  }, [fetchCustomer, fetchTaxonomy])

  // After returning from Outlook OAuth, force DB rehydrate and clear the URL flag.
  useEffect(() => {
    try {
      const url = new URL(window.location.href)
      if (url.searchParams.get('emailConnected') !== '1') return
      const qpCustomerId = url.searchParams.get('customerId')
      if (qpCustomerId && qpCustomerId !== customerId) return

      void (async () => {
        await fetchCustomer()
        emit('customerUpdated', { id: customerId })
      })()

      url.searchParams.delete('emailConnected')
      url.searchParams.delete('connectedEmail')
      window.history.replaceState({}, document.title, url.pathname + url.search + url.hash)
    } catch {
      // ignore
    }
  }, [customerId, fetchCustomer])

  // Load suppression summary (customer-scoped DNC) for UI display
  useEffect(() => {
    let cancelled = false
    const run = async () => {
      if (!customer?.id) {
        setSuppressionMeta(null)
        return
      }
      try {
        const { data } = await api.get<{
          totalSuppressedEmails: number
          lastUpload: {
            fileName: string | null
            uploadedAt: string | null
            uploadedByEmail: string | null
            totalImported: number | null
          } | null
        }>(`/api/customers/${customer.id}/suppression-summary`)
        if (cancelled) return
        setSuppressionMeta({
          fileName: data?.lastUpload?.fileName ?? null,
          uploadedAt: data?.lastUpload?.uploadedAt ?? null,
          uploadedByEmail: data?.lastUpload?.uploadedByEmail ?? null,
          totalImported: data?.lastUpload?.totalImported ?? null,
          totalSuppressedEmails: typeof data?.totalSuppressedEmails === 'number' ? data.totalSuppressedEmails : null,
        })
      } catch {
        if (!cancelled) setSuppressionMeta(null)
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [customer?.id])

  // Keep assigned users in sync with DB users (single source of truth)
  useEffect(() => {
    const active = (Array.isArray(dbUsers) ? dbUsers : [])
      .filter((u: DatabaseUser) => u.accountStatus === 'Active')
      .map((u: DatabaseUser) => ({
        id: u.id,
        userId: u.userId,
        firstName: u.firstName,
        lastName: u.lastName,
        email: u.email,
        accountStatus: u.accountStatus,
      }))
    setAssignedUsers(active)
  }, [dbUsers])

  // Update form state when customer data loads
  useEffect(() => {
    if (!customer) return
    const rawAccountData =
      customer.accountData && typeof customer.accountData === 'object'
        ? customer.accountData
        : {}
    setFieldEnrichmentStore(readFieldEnrichmentStoreFromAccountData(rawAccountData) ?? { version: 1, fields: {} })
    const nextProfile = normalizeClientProfile((rawAccountData as { clientProfile?: ClientProfile }).clientProfile)
    setClientProfile(nextProfile)

    // Target Geographical Areas (multi-select) stored under accountData.targetGeographicalAreas (array)
    // Back-compat: if legacy single targetGeographicalArea exists, hydrate it into the array in-memory.
    const rawAreas = (rawAccountData as any)?.targetGeographicalAreas
    const fromArray = Array.isArray(rawAreas)
      ? rawAreas.map((a: any) => ({
          label: typeof a?.label === 'string' ? a.label : '',
          placeId: typeof a?.id === 'string' ? a.id : typeof a?.placeId === 'string' ? a.placeId : undefined,
        }))
      : []
    const legacySingle = nextProfile?.targetGeographicalArea ? [nextProfile.targetGeographicalArea] : []
    setTargetGeographicalAreas(dedupeAreas([...(fromArray as any), ...(legacySingle as any)]))
    setGeoQuery('')

    const rawDetails = rawAccountData as Partial<AccountDetails> & {
      accountDetails?: Partial<AccountDetails>
    }
    const mergedDetails = normalizeAccountDetails({
      ...rawDetails,
      ...rawDetails.accountDetails,
    })
    // Keep primary contact stable across save→refetch cycles:
    // - If backend payload/rehydrate is missing primaryContact, do NOT blank the UI.
    // - Preserve a stable primaryContact.id so DB upserts don't create "new" contacts every save.
    setAccountDetails((prev) => {
      const next = { ...mergedDetails }
      const prevPc = prev?.primaryContact
      const nextPc = next?.primaryContact

      if (!isPrimaryContactEmpty(prevPc) && isPrimaryContactEmpty(nextPc)) {
        next.primaryContact = prevPc
        return next
      }

      // If we got a non-empty contact but lost its id, keep the previous id.
      const prevId = typeof (prevPc as any)?.id === 'string' ? String((prevPc as any).id).trim() : ''
      const nextId = typeof (nextPc as any)?.id === 'string' ? String((nextPc as any).id).trim() : ''
      if (prevId && !nextId && !isPrimaryContactEmpty(nextPc)) {
        next.primaryContact = { ...(nextPc as any), id: prevId }
      }

      // Always ensure the contact has an id once it has any meaningful content.
      if (!isPrimaryContactEmpty(next.primaryContact)) {
        next.primaryContact = ensurePrimaryContactId(next.primaryContact)
      }

      return next
    })
    setHeadOfficeQuery(mergedDetails.headOfficeAddress || '')
    
    // Initialize monthly revenue from customer field
    const revenue = customer.monthlyRevenueFromCustomer
    setMonthlyRevenueFromCustomer(revenue ? parseFloat(revenue).toString() : '')
    
    // Initialize Google Sheet fields
    setLeadsGoogleSheetUrl(customer.leadsReportingUrl || '')
    setLeadsGoogleSheetLabel(customer.leadsGoogleSheetLabel || '')

    // Targets are manual entry and stored on Customer columns (database-first).
    setWeeklyLeadTarget(
      typeof (customer as any).weeklyLeadTarget === 'number' ? String((customer as any).weeklyLeadTarget) : ''
    )
    setMonthlyLeadTarget(
      typeof (customer as any).monthlyLeadTarget === 'number' ? String((customer as any).monthlyLeadTarget) : ''
    )
    
    // Initialize agreement data from database (fix for disappearing agreement bug)
    const cust = customer as any
    if (cust.agreementFileName && (cust.agreementBlobName || cust.agreementFileUrl)) {
      setAgreementData({
        fileName: cust.agreementFileName,
        uploadedAt: cust.agreementUploadedAt || undefined
      })
    } else {
      setAgreementData(null)
    }
  }, [customer])

  // Geographic area search
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
      // Deduplicate + never show selected areas in results
      const selectedKeys = new Set(targetGeographicalAreas.map((a) => areaKey({ id: a.placeId, label: a.label })))
      const normalized = dedupeAreas(Array.isArray(data) ? data : []).filter(
        (a) => !selectedKeys.has(areaKey({ id: a.placeId, label: a.label })),
      )
      setGeoOptions(normalized)
      setGeoLoading(false)
    }, 350)
    return () => window.clearTimeout(handle)
  }, [geoQuery, targetGeographicalAreas])

  // Head office address search
  useEffect(() => {
    // If a selection is already made (placeId set) and the query matches the saved label,
    // do not keep re-querying /api/places. This prevents the "keeps dropping / reselecting" UX.
    const selectedLabel = String(accountDetails.headOfficeAddress || '').trim()
    const query = String(headOfficeQuery || '').trim()
    const hasSelection = Boolean(String(accountDetails.headOfficePlaceId || '').trim())
    if (hasSelection && query && selectedLabel && query === selectedLabel) {
      setHeadOfficeOptions([])
      return
    }

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
  }, [headOfficeQuery, accountDetails.headOfficeAddress, accountDetails.headOfficePlaceId])

  const updateProfile = useCallback((updates: Partial<ClientProfile>) => {
    setClientProfile((prev) => ({ ...prev, ...updates }))
    setIsDirty(true)
  }, [])

  const updateAccountDetails = useCallback((updates: Partial<AccountDetails>) => {
    setAccountDetails((prev) => ({ ...prev, ...updates }))
    setIsDirty(true)
  }, [])

  const updatePrimaryContact = useCallback((updates: Partial<PrimaryContact>) => {
    setAccountDetails((prev) => ({
      ...prev,
      primaryContact: {
        ...ensurePrimaryContactId({ ...prev.primaryContact, ...updates } as any),
      },
    }))
    setIsDirty(true)
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

  const handleAccreditationFileChange = async (id: string, file: File | null) => {
    if (!file) return
    const proceed = await confirmProceedIfDirty(
      'You have unsaved onboarding changes. Uploading accreditation evidence will refresh this customer from the database.',
    )
    if (!proceed) return

    const accreditationName = clientProfile.accreditations.find((a) => a.id === id)?.name?.trim() || ''
    if (!accreditationName) {
      toast({
        title: 'Accreditation name required',
        description: 'Enter the accreditation name before uploading evidence.',
        status: 'warning',
        duration: 4000,
        isClosable: true,
      })
      return
    }

    // Blob-only uploads: ALL evidence types go through /api/customers/:id/attachments.
    // Backend wires `accreditation_evidence:<accreditationId>` back into clientProfile.accreditations[].
    setUploadingAccreditations((prev) => ({ ...prev, [id]: true }))
    void (async () => {
      try {
        const formData = new FormData()
        formData.append('file', file, file.name)
        formData.append('attachmentType', `accreditation_evidence:${id}`)

        const response = await fetch(`/api/customers/${customerId}/attachments`, {
          method: 'POST',
          body: formData,
        })

        if (!response.ok) {
          let message = `Upload failed (${response.status})`
          try {
            const errorData = await response.json()
            message = errorData?.message || errorData?.error || message
          } catch {
            // ignore
          }
          throw new Error(message)
        }

        // DB rehydration is mandatory: refresh customer to reflect new attachment metadata + wired profile fields
        await fetchCustomer()
        emit('customerUpdated', { id: customerId })
      } catch (e) {
        toast({
          title: 'Upload failed',
          description: e instanceof Error ? e.message : 'Unable to upload file',
          status: 'error',
          duration: 5000,
        })
      } finally {
        setUploadingAccreditations((prev) => ({ ...prev, [id]: false }))
      }
    })()
  }

  const handleRemoveAccreditationFile = (id: string) => {
    updateProfile({
      accreditations: clientProfile.accreditations.map((acc) =>
        acc.id === id ? { ...acc, fileName: undefined, fileUrl: undefined } : acc,
      ),
    })
  }

  const handleCaseStudiesFileChange = async (file: File | null) => {
    if (!file) return
    const proceed = await confirmProceedIfDirty(
      'You have unsaved onboarding changes. Uploading case studies will refresh this customer from the database.',
    )
    if (!proceed) return

    // Blob-only uploads: ALL case study uploads go through /api/customers/:id/attachments.
    // Backend wires `case_studies` into clientProfile.caseStudiesFile* fields.
    setUploadingCaseStudies(true)
    void (async () => {
      try {
        const formData = new FormData()
        formData.append('file', file, file.name)
        formData.append('attachmentType', 'case_studies')

        const response = await fetch(`/api/customers/${customerId}/attachments`, {
          method: 'POST',
          body: formData,
        })

        if (!response.ok) {
          let message = `Upload failed (${response.status})`
          try {
            const errorData = await response.json()
            message = errorData?.message || errorData?.error || message
          } catch {
            // ignore
          }
          throw new Error(message)
        }

        // DB rehydration is mandatory
        await fetchCustomer()
        emit('customerUpdated', { id: customerId })
      } catch (e) {
        toast({
          title: 'Upload failed',
          description: e instanceof Error ? e.message : 'Unable to upload file',
          status: 'error',
          duration: 5000,
        })
      } finally {
        setUploadingCaseStudies(false)
      }
    })()
  }

  const handleRemoveCaseStudiesFile = () => {
    updateProfile({
      caseStudiesFileName: undefined,
      caseStudiesFileUrl: undefined,
    })
  }

  // Phase 2 Item 4: Agreement upload handler
  const handleAgreementFileChange = async (file: File | null) => {
    if (!file || !customer) return
    const proceed = await confirmProceedIfDirty(
      'You have unsaved onboarding changes. Uploading an agreement will refresh this customer from the database.',
    )
    if (!proceed) return

    // Validate file type
    const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
    if (!allowedTypes.includes(file.type)) {
      toast({
        title: 'Invalid file type',
        description: 'Only PDF, DOC, and DOCX files are allowed',
        status: 'error',
        duration: 4000,
      })
      return
    }

    const reader = new FileReader()
    reader.onload = async () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : ''
      if (!dataUrl) return

      setUploadingAgreement(true)
      
      const { data, error } = await api.post<{
        success: boolean
        agreement: { fileName: string; blobName: string; uploadedAt: string }
        progressUpdated: boolean
      }>(
        `/api/customers/${customer.id}/agreement`,
        { fileName: file.name, dataUrl },
      )

      if (error || !data?.success) {
        toast({
          title: 'Upload failed',
          description: error || 'Unable to upload agreement',
          status: 'error',
          duration: 4000,
        })
      } else {
        setAgreementData({
          fileName: data.agreement.fileName,
          uploadedAt: data.agreement.uploadedAt,
        })
        toast({
          title: 'Agreement uploaded',
          description: 'Contract signed & filed checkbox has been automatically ticked',
          status: 'success',
          duration: 4000,
        })
        
        // DB rehydration is mandatory: refresh customer to reflect metadata + any progress tracker updates
        await fetchCustomer()
        emit('customerUpdated', { id: customer.id })
      }
      
      setUploadingAgreement(false)
    }
    reader.readAsDataURL(file)
  }

  const handleSuppressionFileChange = async (file: File | null) => {
    if (!file || !customer?.id) return
    const proceed = await confirmProceedIfDirty(
      'You have unsaved onboarding changes. Uploading a suppression list will refresh this customer from the database.',
    )
    if (!proceed) return
    setUploadingSuppression(true)
    try {
      const form = new FormData()
      form.append('file', file)

      const res = await fetch(`${apiBaseUrl}/api/customers/${customer.id}/suppression-import`, {
        method: 'POST',
        body: form,
      })
      if (!res.ok) {
        const text = await res.text()
        throw new Error(text || `Upload failed (${res.status})`)
      }
      const data = (await res.json()) as {
        totalImported: number
        totalSkipped: number
        timestamp: string
      }

      toast({
        title: 'Suppression list uploaded',
        description: `Imported ${data.totalImported} emails (${data.totalSkipped} skipped)`,
        status: 'success',
        duration: 5000,
        isClosable: true,
      })

      await fetchCustomer()
      emit('customerUpdated', { customerId: customer.id })
    } catch (error: any) {
      toast({
        title: 'Upload failed',
        description: error?.message || 'Unable to upload suppression list',
        status: 'error',
        duration: 7000,
        isClosable: true,
      })
    } finally {
      setUploadingSuppression(false)
    }
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
    // Keep roles in-memory only (DB remains source of truth for selected value in accountDetails.primaryContact).
    setContactRoles((prev) => (prev.some((r) => r.id === item.id) ? prev : [...prev, item]))
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

  const handleSave = async (): Promise<boolean> => {
    if (!customer) {
      onboardingWarn('⚠️ CustomerOnboardingTab: No customer, skipping save')
      return false
    }
    if (!customer.name || !customer.name.trim()) {
      toast({
        title: 'Customer name is required',
        description: 'Enter a customer name before saving onboarding.',
        status: 'error',
        duration: 4000,
        isClosable: true,
      })
      return false
    }
    onboardingDebug('💾 CustomerOnboardingTab: Saving onboarding data for customerId:', customerId)
    setIsSaving(true)

    if (!customerUpdatedAt) {
      toast({
        title: 'Cannot save yet',
        description: 'Please reload the customer data and try again (missing updatedAt).',
        status: 'error',
        duration: 5000,
        isClosable: true,
      })
      setIsSaving(false)
      return false
    }
    
    const currentAccountData =
      customer.accountData && typeof customer.accountData === 'object'
        ? customer.accountData
        : {}
    
    // Generate contact ID locally (no localStorage dependency)
    const nextPrimary = ensurePrimaryContactId(accountDetails.primaryContact)
    const nextAccountDetails = {
      ...accountDetails,
      primaryContact: {
        ...nextPrimary,
      },
    }

    // Ensure UI stays stable while save→refetch happens (prevents "blink to empty" if any rehydrate path drops fields).
    setAccountDetails(nextAccountDetails)
    
    // SAFE MERGE: Preserve other accountData fields (e.g., progressTracker)
    // Only update clientProfile and accountDetails sections
    const normalizedTargetAreas = dedupeAreas(targetGeographicalAreas).map((a) => ({
      id: String(a.placeId || a.label).trim(),
      label: String(a.label || '').trim(),
    }))

    const nextAccountData = safeAccountDataMerge(currentAccountData, {
      // Clear legacy single-select field going forward (persist multi-select array only)
      clientProfile: { ...(clientProfile as any), targetGeographicalArea: null },
      accountDetails: nextAccountDetails,
      targetGeographicalAreas: normalizedTargetAreas,
      [ACCOUNTDATA_FIELD_ENRICHMENT_KEY]: fieldEnrichmentStore,
      // Also update top-level convenience fields for backward compatibility
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
    })

    const outgoingAccountData = stripUndefinedDeep(nextAccountData)
    
    // Prepare top-level customer fields (including monthly revenue and Google Sheet)
    const revenueNumber = monthlyRevenueFromCustomer.trim() 
      ? parseFloat(monthlyRevenueFromCustomer)
      : undefined

    const parseIntOrNull = (raw: string): number | null | undefined => {
      const trimmed = String(raw || '').trim()
      if (!trimmed) return null
      const n = Number(trimmed)
      if (!Number.isFinite(n) || !Number.isInteger(n)) return undefined
      if (n < 0 || n > 1_000_000) return undefined
      return n
    }
    const weeklyTargetNumber = parseIntOrNull(weeklyLeadTarget)
    const monthlyTargetNumber = parseIntOrNull(monthlyLeadTarget)
    if (weeklyTargetNumber === undefined || monthlyTargetNumber === undefined) {
      toast({
        title: 'Invalid targets',
        description: 'Weekly/monthly targets must be whole numbers between 0 and 1,000,000.',
        status: 'error',
        duration: 6000,
        isClosable: true,
      })
      setIsSaving(false)
      return false
    }
    
    // Google Sheet URL and label (validate URL format lightly)
    const sheetUrl = leadsGoogleSheetUrl.trim() || undefined
    const sheetLabel = leadsGoogleSheetLabel.trim() || undefined

    if (sheetUrl && !sheetLabel) {
      toast({
        title: 'Google Sheet label required',
        description: 'Please enter a label for the Google Sheet (we show labels, not raw URLs).',
        status: 'error',
        duration: 6000,
        isClosable: true,
      })
      setIsSaving(false)
      return false
    }
    
    // Additional contacts are saved as part of onboarding payload.
    // IMPORTANT: Do not block saving partial progress for the rest of the form.
    // If a contact is incomplete, omit it from the payload and warn.
    const normalizedPrimaryId = nextAccountDetails.primaryContact.id
    const rawAdditional = Array.isArray(additionalContacts) ? additionalContacts : []
    const contactsToSave = rawAdditional
      .filter((c: any) => c && c.id !== normalizedPrimaryId)
      .map((c: any) => ({
        id: typeof c.id === 'string' ? c.id : undefined,
        name: String(c.name || '').trim(),
        email: typeof c.email === 'string' ? c.email.trim() : c.email ?? null,
        phone: typeof c.phone === 'string' ? c.phone.trim() : c.phone ?? null,
        title: typeof c.title === 'string' ? c.title.trim() : c.title ?? null,
        isPrimary: false,
        notes: typeof c.notes === 'string' ? c.notes : null,
      }))

    const invalidContacts = contactsToSave.filter((c) => !c.name || (!c.email && !c.phone))
    const validContacts = contactsToSave.filter((c) => c.name && (c.email || c.phone))

    if (invalidContacts.length > 0) {
      toast({
        title: 'Some contacts are incomplete',
        description: 'Incomplete additional contacts were not saved. Add email or phone to save them.',
        status: 'warning',
        duration: 6000,
        isClosable: true,
      })
    }

    // Save onboarding payload (single transaction backend route)
    const { data: saveResult, error, errorDetails } = await api.put<{
      success: boolean
      requestId: string
      updatedAt: string
      customer: CustomerApi & { customerContacts?: any[] }
    }>(
      `/api/customers/${customerId}/onboarding`,
      {
        customer: {
          name: customer.name,
          website: normalizeWebAddress(customer.website),
          whatTheyDo: customer.whatTheyDo && customer.whatTheyDo.trim() ? customer.whatTheyDo.trim() : null,
          companyProfile: customer.companyProfile && customer.companyProfile.trim() ? customer.companyProfile.trim() : null,
          sector: customer.sector && customer.sector.trim() ? customer.sector.trim() : null,
          accountData: outgoingAccountData,
          monthlyRevenueFromCustomer: revenueNumber,
          // Keep legacy/Account Card compatibility: AccountsTab currently maps "monthlySpendGBP" to monthlyIntakeGBP.
          // Until the UI is fully refactored, store the same number in monthlyIntakeGBP so it displays consistently.
          monthlyIntakeGBP: revenueNumber,
          leadsReportingUrl: sheetUrl,
          leadsGoogleSheetLabel: sheetLabel,
          weeklyLeadTarget: weeklyTargetNumber,
          monthlyLeadTarget: monthlyTargetNumber,
        },
        contacts: validContacts,
      },
      {
        headers: {
          'If-Match-Updated-At': customerUpdatedAt,
        },
      },
    )
    
    if (error) {
      if (errorDetails?.status === 409) {
        const current = (errorDetails.details as any)?.currentUpdatedAt || null
        setConflictCurrentUpdatedAt(typeof current === 'string' ? current : null)
        conflictDisclosure.onOpen()
        setIsSaving(false)
        return false
      }
      // Show error toast with detailed information
      onboardingError('❌ Customer Onboarding save failed:', {
        customerId,
        error,
        payload: { name: customer.name, accountData: nextAccountData }
      })
      toast({ 
        title: 'Save failed', 
        description: error, 
        status: 'error', 
        duration: 5000,
        isClosable: true,
      })
      setIsSaving(false)
      return false
    }
    
    onboardingDebug('✅ Customer Onboarding saved successfully:', customerId)

    // DB rehydration is mandatory: always refetch after save BEFORE showing success.
    await fetchCustomer()

    // Notify listeners (DB is source of truth; this is a signal only)
    emit('customerUpdated', { id: customerId })

    toast({
      title: 'Onboarding details saved',
      description: 'Saved to database.',
      status: 'success',
      duration: 2500,
    })

    setIsSaving(false)
    setIsDirty(false)
    return true
  }

  if (isLoading) {
    return (
      <Box p={6} textAlign="center">
        <Spinner size="lg" />
        <Text mt={4} color="gray.600">
          Loading customer data...
        </Text>
      </Box>
    )
  }

  if (loadError) {
    return (
      <Box p={6}>
        <Text color="red.500" fontSize="sm">
          Error loading customer: {loadError}
        </Text>
      </Box>
    )
  }

  if (!customer) {
    return (
      <Box border="1px dashed" borderColor="gray.300" borderRadius="xl" p={6}>
        <Text color="gray.600" fontSize="sm">
          Customer not found.
        </Text>
      </Box>
    )
  }

  return (
    <Stack spacing={6}>
      {/* Account Details Section */}
      <Box border="1px solid" borderColor="gray.200" borderRadius="xl" p={6} bg="white">
        <Stack spacing={6}>
          <Text fontSize="lg" fontWeight="semibold">Account Details</Text>

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
              {(() => {
                const fieldKey = 'customer.website'
                const current = customer.website || ''
                const entry = getEnrichment<string>(fieldKey, current)
                const originalValue = String(entry.original ?? current)
                const enhancedValue = entry.enhanced != null ? String(entry.enhanced) : null
                return (
                  <EnrichedFieldWrapper
                    originalValue={originalValue}
                    enhancedValue={enhancedValue}
                    entry={entry}
                    onChangeEntry={(next) => setEnrichment(fieldKey, next)}
                    onApplyActiveValue={(next) => {
                      setCustomer((prev) => (prev ? { ...prev, website: String(next || '') } : prev))
                      setIsDirty(true)
                    }}
                    renderInput={({ value, onChange, isReadOnly }) => (
                      <Input
                        type="url"
                        value={String(value || '')}
                        isReadOnly={isReadOnly}
                        onChange={(e) => onChange(e.target.value as any)}
                        placeholder="https://example.com"
                      />
                    )}
                  />
                )
              })()}
            </FormControl>
            <FormControl>
              <FormLabel>Sector</FormLabel>
              {(() => {
                const fieldKey = 'customer.sector'
                const current = customer.sector || ''
                const entry = getEnrichment<string>(fieldKey, current)
                const originalValue = String(entry.original ?? current)
                const enhancedValue = entry.enhanced != null ? String(entry.enhanced) : null
                return (
                  <EnrichedFieldWrapper
                    originalValue={originalValue}
                    enhancedValue={enhancedValue}
                    entry={entry}
                    onChangeEntry={(next) => setEnrichment(fieldKey, next)}
                    onApplyActiveValue={(next) => {
                      setCustomer((prev) => (prev ? { ...prev, sector: String(next || '') } : prev))
                      setIsDirty(true)
                    }}
                    onRequestEnhanced={async () => {
                      const data = await fetchCompanyDataCached()
                      const next = String(data?.sector || '').trim()
                      return next ? next : null
                    }}
                    renderInput={({ value, onChange, isReadOnly }) => (
                      <Input
                        value={String(value || '')}
                        isReadOnly={isReadOnly}
                        onChange={(e) => onChange(e.target.value as any)}
                        placeholder="e.g. Facilities Management"
                      />
                    )}
                  />
                )
              })()}
            </FormControl>
            <FormControl>
              <FormLabel>Assigned Account Manager</FormLabel>
              {(() => {
                const fieldKey = 'accountDetails.assignedAccountManager'
                const current = {
                  id: String(accountDetails.assignedAccountManagerId || ''),
                  name: String(accountDetails.assignedAccountManagerName || ''),
                }
                const entry = getEnrichment<{ id: string; name: string }>(fieldKey, current)
                const originalValue = (entry.original ?? current) as { id: string; name: string }
                const enhancedValue = (entry.enhanced ?? null) as { id: string; name: string } | null
                return (
                  <EnrichedFieldWrapper
                    originalValue={originalValue}
                    enhancedValue={enhancedValue}
                    entry={entry}
                    onChangeEntry={(next) => setEnrichment(fieldKey, next)}
                    onApplyActiveValue={(next) =>
                      updateAccountDetails({
                        assignedAccountManagerId: String((next as any)?.id || ''),
                        assignedAccountManagerName: String((next as any)?.name || ''),
                      })
                    }
                    renderEnhancedFallback={() => (
                      <Text fontSize="sm" color="gray.500">
                        No enhanced manager.
                      </Text>
                    )}
                    renderInput={({ value, onChange, isReadOnly }) => {
                      const v = value as any as { id: string; name: string }
                      return (
                        <Select
                          placeholder={assignedUsers.length ? 'Select user' : 'No users found'}
                          value={v.id || ''}
                          isDisabled={isReadOnly}
                          onChange={(e) => {
                            const nextId = e.target.value
                            const user = assignedUsers.find((u) => u.id === nextId) || null
                            onChange({ id: nextId, name: user ? `${user.firstName} ${user.lastName}`.trim() : '' } as any)
                          }}
                        >
                          {assignedUsers.map((user) => (
                            <option key={user.id} value={user.id}>
                              {`${user.firstName} ${user.lastName}`.trim()} ({user.email})
                            </option>
                          ))}
                        </Select>
                      )
                    }}
                  />
                )
              })()}
            </FormControl>
            <FormControl>
              <FormLabel>Assigned Client DDI & Number</FormLabel>
              {(() => {
                const fieldKey = 'accountDetails.assignedClientDdiNumber'
                const current = accountDetails.assignedClientDdiNumber || ''
                const entry = getEnrichment<string>(fieldKey, current)
                const originalValue = String(entry.original ?? current)
                const enhancedValue = entry.enhanced != null ? String(entry.enhanced) : null
                return (
                  <EnrichedFieldWrapper
                    originalValue={originalValue}
                    enhancedValue={enhancedValue}
                    entry={entry}
                    onChangeEntry={(next) => setEnrichment(fieldKey, next)}
                    onApplyActiveValue={(next) => updateAccountDetails({ assignedClientDdiNumber: String(next || '') })}
                    renderEnhancedFallback={() => (
                      <Text fontSize="sm" color="gray.500">
                        No enhanced number.
                      </Text>
                    )}
                    renderInput={({ value, onChange, isReadOnly }) => (
                      <Input
                        value={String(value || '')}
                        isReadOnly={isReadOnly}
                        onChange={(e) => onChange(e.target.value as any)}
                        placeholder="DDI / Number"
                      />
                    )}
                  />
                )
              })()}
            </FormControl>
            <FormControl>
              <FormLabel>Days a Week</FormLabel>
              {(() => {
                const fieldKey = 'accountDetails.daysPerWeek'
                const current = typeof accountDetails.daysPerWeek === 'number' ? accountDetails.daysPerWeek : 1
                const entry = getEnrichment<number>(fieldKey, current)
                const originalValue = typeof (entry.original ?? current) === 'number' ? (entry.original ?? current) : current
                const enhancedValue = typeof entry.enhanced === 'number' ? entry.enhanced : null
                return (
                  <EnrichedFieldWrapper
                    originalValue={originalValue as any}
                    enhancedValue={enhancedValue as any}
                    entry={entry}
                    onChangeEntry={(next) => setEnrichment(fieldKey, next)}
                    onApplyActiveValue={(next) => updateAccountDetails({ daysPerWeek: Number(next) })}
                    renderEnhancedFallback={() => (
                      <Text fontSize="sm" color="gray.500">
                        No enhanced days.
                      </Text>
                    )}
                    renderInput={({ value, onChange, isReadOnly }) => (
                      <Select
                        value={String(value)}
                        isDisabled={isReadOnly}
                        onChange={(e) => onChange(Number(e.target.value) as any)}
                      >
                        <option value={1}>1 day</option>
                        <option value={2}>2 days</option>
                        <option value={3}>3 days</option>
                        <option value={4}>4 days</option>
                        <option value={5}>5 days</option>
                      </Select>
                    )}
                  />
                )
              })()}
            </FormControl>
            <FormControl>
              <FormLabel>Monthly Revenue from Customer (£)</FormLabel>
              {(() => {
                const fieldKey = 'customer.monthlyRevenueFromCustomer'
                const current = monthlyRevenueFromCustomer || ''
                const entry = getEnrichment<string>(fieldKey, current)
                const originalValue = String(entry.original ?? current)
                const enhancedValue = entry.enhanced != null ? String(entry.enhanced) : null
                return (
                  <EnrichedFieldWrapper
                    originalValue={originalValue}
                    enhancedValue={enhancedValue}
                    entry={entry}
                    onChangeEntry={(next) => setEnrichment(fieldKey, next)}
                    onApplyActiveValue={(next) => {
                      setMonthlyRevenueFromCustomer(String(next || ''))
                      setIsDirty(true)
                    }}
                    renderEnhancedFallback={() => (
                      <Text fontSize="sm" color="gray.500">
                        No enhanced revenue.
                      </Text>
                    )}
                    renderInput={({ value, onChange, isReadOnly }) => (
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={String(value || '')}
                        isReadOnly={isReadOnly}
                        onChange={(e) => onChange(e.target.value as any)}
                        placeholder="e.g. 5000.00"
                      />
                    )}
                  />
                )
              })()}
            </FormControl>
            <FormControl>
              <FormLabel>Weekly Lead Target</FormLabel>
              {(() => {
                const fieldKey = 'customer.weeklyLeadTarget'
                const current = weeklyLeadTarget || ''
                const entry = getEnrichment<string>(fieldKey, current)
                const originalValue = String(entry.original ?? current)
                const enhancedValue = entry.enhanced != null ? String(entry.enhanced) : null
                return (
                  <EnrichedFieldWrapper
                    originalValue={originalValue}
                    enhancedValue={enhancedValue}
                    entry={entry}
                    onChangeEntry={(next) => setEnrichment(fieldKey, next)}
                    onApplyActiveValue={(next) => {
                      setWeeklyLeadTarget(String(next || ''))
                      setIsDirty(true)
                    }}
                    renderEnhancedFallback={() => (
                      <Text fontSize="sm" color="gray.500">
                        No enhanced weekly target.
                      </Text>
                    )}
                    renderInput={({ value, onChange, isReadOnly }) => (
                      <Input
                        type="number"
                        min="0"
                        step="1"
                        value={String(value || '')}
                        isReadOnly={isReadOnly}
                        onChange={(e) => onChange(e.target.value as any)}
                        placeholder="Manual weekly target (e.g. 25)"
                      />
                    )}
                  />
                )
              })()}
            </FormControl>
            <FormControl>
              <FormLabel>Monthly Lead Target</FormLabel>
              {(() => {
                const fieldKey = 'customer.monthlyLeadTarget'
                const current = monthlyLeadTarget || ''
                const entry = getEnrichment<string>(fieldKey, current)
                const originalValue = String(entry.original ?? current)
                const enhancedValue = entry.enhanced != null ? String(entry.enhanced) : null
                return (
                  <EnrichedFieldWrapper
                    originalValue={originalValue}
                    enhancedValue={enhancedValue}
                    entry={entry}
                    onChangeEntry={(next) => setEnrichment(fieldKey, next)}
                    onApplyActiveValue={(next) => {
                      setMonthlyLeadTarget(String(next || ''))
                      setIsDirty(true)
                    }}
                    renderEnhancedFallback={() => (
                      <Text fontSize="sm" color="gray.500">
                        No enhanced monthly target.
                      </Text>
                    )}
                    renderInput={({ value, onChange, isReadOnly }) => (
                      <Input
                        type="number"
                        min="0"
                        step="1"
                        value={String(value || '')}
                        isReadOnly={isReadOnly}
                        onChange={(e) => onChange(e.target.value as any)}
                        placeholder="Manual monthly target (e.g. 100)"
                      />
                    )}
                  />
                )
              })()}
            </FormControl>
            <FormControl>
              <FormLabel>Weekly Lead Actual (this week)</FormLabel>
              {(() => {
                const fieldKey = 'customer.weeklyLeadActual'
                const current =
                  typeof (customer as any)?.weeklyLeadActual === 'number' ? String((customer as any).weeklyLeadActual) : ''
                const entry = getEnrichment<string>(fieldKey, current)
                const originalValue = String(entry.original ?? current)
                const enhancedValue = entry.enhanced != null ? String(entry.enhanced) : null
                return (
                  <EnrichedFieldWrapper
                    originalValue={originalValue}
                    enhancedValue={enhancedValue}
                    entry={entry}
                    isReadOnly
                    onChangeEntry={(next) => setEnrichment(fieldKey, next)}
                    onApplyActiveValue={() => {}}
                    renderEnhancedFallback={() => (
                      <Text fontSize="sm" color="gray.500">
                        No enhanced actual (synced).
                      </Text>
                    )}
                    renderInput={({ value, isReadOnly }) => (
                      <Input
                        value={String(value || '')}
                        isReadOnly={isReadOnly}
                        placeholder="Synced from Google Sheets"
                      />
                    )}
                  />
                )
              })()}
            </FormControl>
            <FormControl>
              <FormLabel>Monthly Lead Actual (this month)</FormLabel>
              {(() => {
                const fieldKey = 'customer.monthlyLeadActual'
                const current =
                  typeof (customer as any)?.monthlyLeadActual === 'number' ? String((customer as any).monthlyLeadActual) : ''
                const entry = getEnrichment<string>(fieldKey, current)
                const originalValue = String(entry.original ?? current)
                const enhancedValue = entry.enhanced != null ? String(entry.enhanced) : null
                return (
                  <EnrichedFieldWrapper
                    originalValue={originalValue}
                    enhancedValue={enhancedValue}
                    entry={entry}
                    isReadOnly
                    onChangeEntry={(next) => setEnrichment(fieldKey, next)}
                    onApplyActiveValue={() => {}}
                    renderEnhancedFallback={() => (
                      <Text fontSize="sm" color="gray.500">
                        No enhanced actual (synced).
                      </Text>
                    )}
                    renderInput={({ value, isReadOnly }) => (
                      <Input
                        value={String(value || '')}
                        isReadOnly={isReadOnly}
                        placeholder="Synced from Google Sheets"
                      />
                    )}
                  />
                )
              })()}
            </FormControl>
          </SimpleGrid>

          <Divider my={4} />

          <SimpleGrid columns={{ base: 1, md: 2 }} spacing={6}>
            <FormControl>
              <FormLabel>Leads Google Sheet URL</FormLabel>
              {(() => {
                const fieldKey = 'customer.leadsGoogleSheetUrl'
                const current = leadsGoogleSheetUrl || ''
                const entry = getEnrichment<string>(fieldKey, current)
                const originalValue = String(entry.original ?? current)
                const enhancedValue = entry.enhanced != null ? String(entry.enhanced) : null
                return (
                  <EnrichedFieldWrapper
                    originalValue={originalValue}
                    enhancedValue={enhancedValue}
                    entry={entry}
                    onChangeEntry={(next) => setEnrichment(fieldKey, next)}
                    onApplyActiveValue={(next) => {
                      setLeadsGoogleSheetUrl(String(next || ''))
                      setIsDirty(true)
                    }}
                    renderEnhancedFallback={() => (
                      <Text fontSize="sm" color="gray.500">
                        No enhanced URL.
                      </Text>
                    )}
                    renderInput={({ value, onChange, isReadOnly }) => (
                      <Input
                        type="url"
                        value={String(value || '')}
                        isReadOnly={isReadOnly}
                        onChange={(e) => onChange(e.target.value as any)}
                        placeholder="https://docs.google.com/spreadsheets/d/..."
                      />
                    )}
                  />
                )
              })()}
            </FormControl>
            <FormControl>
              <FormLabel>Leads Google Sheet Label</FormLabel>
              {(() => {
                const fieldKey = 'customer.leadsGoogleSheetLabel'
                const current = leadsGoogleSheetLabel || ''
                const entry = getEnrichment<string>(fieldKey, current)
                const originalValue = String(entry.original ?? current)
                const enhancedValue = entry.enhanced != null ? String(entry.enhanced) : null
                return (
                  <EnrichedFieldWrapper
                    originalValue={originalValue}
                    enhancedValue={enhancedValue}
                    entry={entry}
                    onChangeEntry={(next) => setEnrichment(fieldKey, next)}
                    onApplyActiveValue={(next) => {
                      setLeadsGoogleSheetLabel(String(next || ''))
                      setIsDirty(true)
                    }}
                    renderEnhancedFallback={() => (
                      <Text fontSize="sm" color="gray.500">
                        No enhanced label.
                      </Text>
                    )}
                    renderInput={({ value, onChange, isReadOnly }) => (
                      <Input
                        value={String(value || '')}
                        isReadOnly={isReadOnly}
                        onChange={(e) => onChange(e.target.value as any)}
                        placeholder="e.g. Customer Lead Sheet"
                      />
                    )}
                  />
                )
              })()}
            </FormControl>
          </SimpleGrid>

          <FormControl>
            <FormLabel>Head Office Address</FormLabel>
            {(() => {
              const fieldKey = 'accountDetails.headOffice'
              const current = {
                address: String(accountDetails.headOfficeAddress || ''),
                placeId: String(accountDetails.headOfficePlaceId || ''),
                postcode: String(accountDetails.headOfficePostcode || ''),
              }
              const entry = getEnrichment<{ address: string; placeId: string; postcode: string }>(fieldKey, current)
              const originalValue = (entry.original ?? current) as { address: string; placeId: string; postcode: string }
              const enhancedValue = (entry.enhanced ?? null) as { address: string; placeId: string; postcode: string } | null
              return (
                <EnrichedFieldWrapper
                  originalValue={originalValue}
                  enhancedValue={enhancedValue}
                  entry={entry}
                  onChangeEntry={(next) => setEnrichment(fieldKey, next)}
                  onApplyActiveValue={(next) => {
                    const v = next as any as { address: string; placeId?: string; postcode?: string }
                    updateAccountDetails({
                      headOfficeAddress: String(v.address || ''),
                      headOfficePlaceId: String(v.placeId || ''),
                      headOfficePostcode: String(v.postcode || ''),
                    })
                    setHeadOfficeQuery(String(v.address || ''))
                    setHeadOfficeOptions([])
                  }}
                  onRequestEnhanced={async () => {
                    const data = await fetchCompanyDataCached()
                    const hq = String(data?.headquarters || '').trim()
                    return hq ? ({ address: hq, placeId: '', postcode: '' } as any) : null
                  }}
                  renderEnhancedFallback={() => (
                    <Text fontSize="sm" color="gray.500">
                      No enhanced address yet.
                    </Text>
                  )}
                  renderInput={({ value, onChange, isReadOnly }) => {
                    const v = value as any as { address: string; placeId: string; postcode: string }
                    if (isReadOnly) {
                      return <Input value={String(v?.address || '')} isReadOnly placeholder="No enhanced address" />
                    }
                    return (
                      <Stack spacing={2}>
                        <Input
                          value={headOfficeQuery}
                          onChange={(e) => {
                            const nextText = e.target.value
                            setHeadOfficeQuery(nextText)
                            const nextObj = {
                              address: nextText,
                              placeId: v.placeId && nextText.trim() !== String(v.address || '').trim() ? '' : v.placeId,
                              postcode: v.postcode,
                            }
                            onChange(nextObj as any)
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
                                    const nextObj = {
                                      address: option.label,
                                      placeId: option.placeId || '',
                                      postcode: String((option as any)?.postcode || ''),
                                    }
                                    onChange(nextObj as any)
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
                    )
                  }}
                />
              )
            })()}
          </FormControl>

          <Divider />

          {/* Customer-scoped DNC suppression list */}
          <FormControl>
            <FormLabel>Suppression List (DNC)</FormLabel>
            <Stack spacing={3}>
              <Text fontSize="sm" color="gray.600">
                Upload a customer-specific Do Not Contact list. Suppressed emails are excluded from outreach campaigns for this customer only.
              </Text>
              <Input
                type="file"
                accept=".csv,.xlsx,.txt"
                display="none"
                id="suppression-upload"
                onChange={(e) => void handleSuppressionFileChange(e.target.files?.[0] || null)}
              />
              <HStack spacing={3} align="center" flexWrap="wrap">
                <Button
                  as="label"
                  htmlFor="suppression-upload"
                  leftIcon={<AttachmentIcon />}
                  variant="outline"
                  size="sm"
                  colorScheme="purple"
                  isLoading={uploadingSuppression}
                  isDisabled={uploadingSuppression}
                >
                  {suppressionMeta?.fileName ? 'Replace Suppression List' : 'Upload Suppression List'}
                </Button>
                {suppressionMeta?.fileName ? (
                  <Stack spacing={0}>
                    <Text fontSize="sm" fontWeight="medium">
                      {suppressionMeta.fileName}
                    </Text>
                    <Text fontSize="xs" color="gray.500">
                      {typeof suppressionMeta.totalSuppressedEmails === 'number'
                        ? `${suppressionMeta.totalSuppressedEmails} suppressed emails`
                        : 'Suppression list uploaded'}
                      {suppressionMeta.uploadedAt
                        ? ` · Uploaded ${new Date(suppressionMeta.uploadedAt).toLocaleDateString()}`
                        : ''}
                    </Text>
                  </Stack>
                ) : (
                  <Text fontSize="sm" color="gray.500">
                    No suppression list uploaded
                  </Text>
                )}
              </HStack>
            </Stack>
          </FormControl>
        </Stack>
      </Box>

      {/* Customer Contacts Section */}
      <Box border="1px solid" borderColor="gray.200" borderRadius="xl" p={6} bg="white">
        <CustomerContactsSection
          contacts={additionalContacts as any}
          onChange={(next) => setAdditionalContacts(next as any)}
        />
      </Box>

      {/* Email Accounts Section */}
      <Box border="1px solid" borderColor="gray.200" borderRadius="xl" p={6} bg="white">
        <EmailAccountsEnhancedTab
          customerId={customerId}
          onBeforeConnectOutlook={async () => {
            return await confirmProceedIfDirty(
              'You have unsaved onboarding changes. Connecting an Outlook account will temporarily leave this page.',
            )
          }}
        />
      </Box>

      {/* Client Profile Section */}
      <Box border="1px solid" borderColor="gray.200" borderRadius="xl" p={6} bg="white">
        <Stack spacing={6}>
          <Text fontSize="lg" fontWeight="semibold">Client Profile</Text>

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
            <FormLabel>What they do</FormLabel>
            <Textarea
              value={customer?.whatTheyDo || ''}
              onChange={(e) => {
                setIsDirty(true)
                setCustomer((prev) => (prev ? { ...prev, whatTheyDo: e.target.value } : prev))
              }}
              minH="90px"
              placeholder="Short description of what the company does…"
            />
          </FormControl>

          <FormControl>
            <FormLabel>Company profile</FormLabel>
            <Textarea
              value={customer?.companyProfile || ''}
              onChange={(e) => {
                setIsDirty(true)
                setCustomer((prev) => (prev ? { ...prev, companyProfile: e.target.value } : prev))
              }}
              minH="140px"
              placeholder="Longer profile / overview…"
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
                          void handleAccreditationFileChange(accreditation.id, e.target.files?.[0] || null)
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
                        ) : (Array.isArray((clientProfile as any)?.accreditationsEvidence?.[accreditation.name]) &&
                            (clientProfile as any).accreditationsEvidence[accreditation.name].length > 0) ? (
                          <Stack spacing={1}>
                            {(clientProfile as any).accreditationsEvidence[accreditation.name]
                              .slice(-3)
                              .map((ev: any, idx: number) => (
                                <Link
                                  key={`${ev?.attachmentId || idx}`}
                                  href={String(ev?.fileUrl || '')}
                                  isExternal
                                  fontSize="sm"
                                  color="teal.600"
                                >
                                  {String(ev?.fileName || 'View evidence')}
                                </Link>
                              ))}
                            {(clientProfile as any).accreditationsEvidence[accreditation.name].length > 3 ? (
                              <Text fontSize="xs" color="gray.500">
                                Showing last 3 uploads
                              </Text>
                            ) : null}
                          </Stack>
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
              {targetGeographicalAreas.length > 0 ? (
                <HStack spacing={2} flexWrap="wrap">
                  {targetGeographicalAreas.map((area) => {
                    const key = area.placeId || area.label
                    return (
                      <Tag key={key} size="sm" colorScheme="blue" borderRadius="full">
                        <TagLabel>{area.label}</TagLabel>
                        <TagCloseButton
                          onClick={() => {
                            const removeKey = areaKey({ id: area.placeId, label: area.label })
                            setTargetGeographicalAreas((prev) =>
                              dedupeAreas(prev).filter((a) => areaKey({ id: a.placeId, label: a.label }) !== removeKey),
                            )
                          }}
                        />
                      </Tag>
                    )
                  })}
                </HStack>
              ) : (
                <Text fontSize="sm" color="gray.500">
                  No areas selected yet.
                </Text>
              )}
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
                          const next = dedupeAreas([...(targetGeographicalAreas as any), option as any])
                          setTargetGeographicalAreas(next)
                          setGeoQuery('')
                          setGeoOptions([])
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
            <Text fontSize="md" fontWeight="semibold" mb={3}>
              Social Media Presence
            </Text>
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
                  onChange={(e) => void handleCaseStudiesFileChange(e.target.files?.[0] || null)}
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

          <Divider />

          {/* Phase 2 Item 4: Agreement Upload */}
          <FormControl>
            <FormLabel>Customer Agreement (PDF/Word)</FormLabel>
            <Stack spacing={3}>
              <Text fontSize="sm" color="gray.600">
                Upload the signed customer agreement. This will automatically tick the "Contract Signed & Filed" checkbox in the Progress Tracker.
              </Text>
              <Stack spacing={2}>
                <Input
                  type="file"
                  accept=".pdf,.doc,.docx"
                  display="none"
                  id="agreement-upload"
                  onChange={(e) => void handleAgreementFileChange(e.target.files?.[0] || null)}
                />
                <HStack spacing={3}>
                  <Button
                    as="label"
                    htmlFor="agreement-upload"
                    leftIcon={<AttachmentIcon />}
                    variant="outline"
                    size="sm"
                    colorScheme="teal"
                    isLoading={uploadingAgreement}
                    isDisabled={uploadingAgreement}
                  >
                    {agreementData ? 'Replace Agreement' : 'Upload Agreement'}
                  </Button>
                  {agreementData ? (
                    <HStack spacing={2}>
                      <Button
                        as={Link}
                        size="sm"
                        variant="link"
                        colorScheme="teal"
                        fontWeight="medium"
                        href={`${apiBaseUrl}/api/customers/${customer.id}/agreement/download`}
                        isExternal
                        rel="noopener noreferrer"
                      >
                        {agreementData.fileName || 'View agreement'}
                      </Button>
                      {agreementData.uploadedAt && (
                        <Text fontSize="xs" color="gray.500">
                          (Uploaded {new Date(agreementData.uploadedAt).toLocaleDateString()})
                        </Text>
                      )}
                    </HStack>
                  ) : (
                    <Text fontSize="sm" color="gray.500">
                      No agreement uploaded
                    </Text>
                  )}
                </HStack>
              </Stack>
            </Stack>
          </FormControl>
        </Stack>
      </Box>

      {/* Single bottom save action (unified form) */}
      <Box pt={2} pb={2}>
        <Divider mb={4} />
        <HStack justify="flex-end">
          <Button colorScheme="teal" onClick={() => void handleSave()} isLoading={isSaving}>
            Save Onboarding
          </Button>
        </HStack>
      </Box>

      {/* Unsaved changes guard for external OAuth redirect (email connect) */}
      <Modal
        isOpen={dirtyConnectDisclosure.isOpen}
        onClose={() => {
          pendingConnectResolver.current?.(false)
          pendingConnectResolver.current = null
          dirtyConnectDisclosure.onClose()
        }}
        isCentered
      >
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Unsaved changes</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Text fontSize="sm" color="gray.700">
              {dirtyPromptBody}
            </Text>
            <Text fontSize="sm" color="gray.700" mt={2}>
              Would you like to save your onboarding changes first?
            </Text>
          </ModalBody>
          <ModalFooter>
            <HStack spacing={3}>
              <Button
                variant="ghost"
                onClick={() => {
                  pendingConnectResolver.current?.(false)
                  pendingConnectResolver.current = null
                  dirtyConnectDisclosure.onClose()
                }}
              >
                Cancel
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  pendingConnectResolver.current?.(true)
                  pendingConnectResolver.current = null
                  dirtyConnectDisclosure.onClose()
                }}
              >
                Continue without saving
              </Button>
              <Button
                colorScheme="teal"
                isLoading={isSaving}
                onClick={async () => {
                  const ok = await handleSave()
                  if (!ok) {
                    // IMPORTANT: resolve pending promise to avoid hanging connect attempt.
                    pendingConnectResolver.current?.(false)
                    pendingConnectResolver.current = null
                    dirtyConnectDisclosure.onClose()
                    return
                  }
                  pendingConnectResolver.current?.(true)
                  pendingConnectResolver.current = null
                  dirtyConnectDisclosure.onClose()
                }}
              >
                Save &amp; continue
              </Button>
            </HStack>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Optimistic concurrency conflict (multi-user safety) */}
      <Modal
        isOpen={conflictDisclosure.isOpen}
        onClose={() => {
          conflictDisclosure.onClose()
        }}
        isCentered
      >
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Someone else updated this customer</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Text fontSize="sm" color="gray.700">
              This customer was updated by another user while you were editing. To prevent data loss, your save was
              blocked.
            </Text>
            <Text fontSize="sm" color="gray.700" mt={2}>
              Click Reload to fetch the latest data from the database, then re-apply your changes.
            </Text>
            {conflictCurrentUpdatedAt ? (
              <Text fontSize="xs" color="gray.500" mt={3}>
                Current updatedAt: {conflictCurrentUpdatedAt}
              </Text>
            ) : null}
          </ModalBody>
          <ModalFooter>
            <HStack spacing={3}>
              <Button variant="ghost" onClick={conflictDisclosure.onClose}>
                Cancel
              </Button>
              <Button
                colorScheme="teal"
                onClick={() => {
                  void (async () => {
                    await fetchCustomer()
                    conflictDisclosure.onClose()
                    toast({
                      title: 'Reloaded latest data',
                      description: 'You are now viewing the latest saved data from the database.',
                      status: 'info',
                      duration: 4000,
                      isClosable: true,
                    })
                  })()
                }}
              >
                Reload
              </Button>
            </HStack>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Stack>
  )
}
