import { useCallback, useEffect, useState, useRef, type ReactNode } from 'react'
import {
  Avatar,
  AvatarGroup,
  Badge,
  Box,
  Button,
  Drawer,
  DrawerBody,
  DrawerCloseButton,
  DrawerContent,
  DrawerHeader,
  DrawerOverlay,
  Heading,
  Link,
  Table,
  TableContainer,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
  SimpleGrid,
  Stack,
  Text,
  Wrap,
  WrapItem,
  Divider,
  Input,
  InputGroup,
  InputRightElement,
  Textarea,
  Tag,
  TagLabel,
  TagCloseButton,
  Select,
  NumberInput,
  NumberInputField,
  IconButton,
  useToast,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  HStack,
  Spinner,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  useDisclosure,
  FormControl,
  FormLabel,
  Icon,
  Tooltip,
} from '@chakra-ui/react'
import { ExternalLinkIcon, SearchIcon, AttachmentIcon, DeleteIcon, EditIcon, CheckIcon, CloseIcon, RepeatIcon, ChevronUpIcon, ChevronDownIcon } from '@chakra-ui/icons'
import { MdCalendarToday, MdEvent, MdChevronLeft, MdChevronRight } from 'react-icons/md'
import { emit, on } from '../platform/events'
import { OdcrmStorageKeys } from '../platform/keys'
import { fetchCompanyData, refreshCompanyData } from '../services/companyDataService'
import { getItem, getJson, isStorageAvailable, keys, setItem, setJson } from '../platform/storage'
import { api } from '../utils/api'
import { fetchLeadsFromApi, persistLeadsToStorage } from '../utils/leadsApi'
import { syncAccountLeadCountsFromLeads } from '../utils/accountsLeadsSync'
import MigrateAccountsPanel from './MigrateAccountsPanel'

type Contact = {
  name: string
  title?: string
  accounts: string[] // Changed to support multiple accounts
  account?: string // Legacy field for migration
  tier?: string
  status?: string
  email?: string
  phone?: string
  socialMedia?: SocialProfile[]
}

type StoredContact = {
  id?: string
  name: string
  title?: string
  accounts?: string[] // Changed to support multiple accounts (optional for migration)
  account?: string // Legacy field for migration
  tier?: string
  status?: string
  email?: string
  phone?: string
}

type SocialProfile = {
  label: string
  url: string
}

type AccountUser = {
  name: string
  role: string
}

type AccountNote = {
  id: string
  content: string
  user: string
  timestamp: string
}

type AboutSections = {
  whatTheyDo: string
  accreditations: string
  keyLeaders: string
  companyProfile: string
  recentNews: string
  companySize?: string
  headquarters?: string
  foundingYear?: string
}

// Connected email identity for a customer
type ConnectedEmailIdentity = {
  id: string
  emailAddress: string
  displayName?: string
  provider: string
  isActive: boolean
  dailySendLimit: number
  createdAt: string
}

type AgreementFile = {
  id: string
  name: string
  url: string
  uploadedAt: string
}

export type Accreditation = {
  id: string
  name: string
  fileUrl?: string
  fileName?: string
}

export type TargetGeographicalArea = {
  label: string
  placeId?: string
  city?: string
  county?: string
  country?: string
}

export type SocialMediaPresence = {
  facebookUrl?: string
  linkedinUrl?: string
  xUrl?: string
  instagramUrl?: string
  tiktokUrl?: string
  youtubeUrl?: string
  websiteUrl?: string
}

export type ClientProfile = {
  clientHistory: string
  accreditations: Accreditation[]
  targetGeographicalArea?: TargetGeographicalArea
  targetJobSectorIds: string[]
  targetJobRoleIds: string[]
  keyBusinessObjectives: string
  clientUSPs: string
  socialMediaPresence: SocialMediaPresence
  qualifyingQuestions: string
  caseStudiesOrTestimonials: string
  caseStudiesFileName?: string
  caseStudiesFileUrl?: string
}

export type PrimaryContact = {
  id?: string
  firstName: string
  lastName: string
  email: string
  phone: string
  roleId?: string
  roleLabel?: string
  status: 'Active' | 'Inactive'
}

type CustomerApi = {
  id: string
  name: string
  domain?: string | null
  website?: string | null
  accountData?: Record<string, unknown> | null
  leadsReportingUrl?: string | null
  sector?: string | null
  clientStatus?: string | null
  targetJobTitle?: string | null
  prospectingLocation?: string | null
  monthlyIntakeGBP?: number | string | null
  defcon?: number | null
  weeklyLeadTarget?: number | null
  weeklyLeadActual?: number | null
  monthlyLeadTarget?: number | null
  monthlyLeadActual?: number | null
  // About section fields (from DB)
  whatTheyDo?: string | null
  accreditations?: string | null
  keyLeaders?: string | null
  companyProfile?: string | null
  recentNews?: string | null
  companySize?: string | null
  headquarters?: string | null
  foundingYear?: string | null
  socialPresence?: Array<{ label: string; url: string }> | null
  lastEnrichedAt?: string | null
}

export type Account = {
  // Database ID - this is the canonical ID from the database (e.g. "cust_...")
  id?: string
  name: string
  website: string
  aboutSections: AboutSections
  sector: string
  socialMedia: SocialProfile[]
  contactPersons?: string
  contactNumber?: string
  contactEmail?: string
  primaryContact?: PrimaryContact
  contactRoleId?: string
  contactRoleLabel?: string
  contactActive?: boolean
  headOfficeAddress?: string
  headOfficePlaceId?: string
  headOfficePostcode?: string
  assignedAccountManager?: string
  assignedAccountManagerId?: string
  assignedClientDdiNumber?: string
  emailAccountsSetUp?: boolean
  emailAccounts?: string[]
  logoUrl?: string
  aboutSource?: 'opencorporates' | 'web' | 'manual' | 'web_failed'
  aboutLocked?: boolean
  status: 'Active' | 'Inactive' | 'On Hold'
  targetLocation: string[]
  targetTitle: string
  clientProfile?: ClientProfile
  monthlySpendGBP: number
  agreements: AgreementFile[]
  defcon: number
  contractStart: string
  contractEnd: string
  days: number
  contacts: number
  leads: number
  weeklyTarget: number
  weeklyActual: number
  monthlyTarget: number
  monthlyActual: number
  weeklyReport: string
  users: AccountUser[]
  clientLeadsSheetUrl?: string
  notes?: AccountNote[]
  // DEPRECATED: Use `id` instead. Kept for backward compat with localStorage
  _databaseId?: string
}

const currencyFormatter = new Intl.NumberFormat('en-GB', {
  style: 'currency',
  currency: 'GBP',
  maximumFractionDigits: 0,
})

const dateFormatter = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})

// storage keys (kept as locals to minimize churn across this large file)
const STORAGE_KEY_ACCOUNTS = OdcrmStorageKeys.accounts
const STORAGE_KEY_ACCOUNTS_LAST_UPDATED = OdcrmStorageKeys.accountsLastUpdated
const STORAGE_KEY_SECTORS = OdcrmStorageKeys.sectors
const STORAGE_KEY_TARGET_LOCATIONS = OdcrmStorageKeys.targetLocations
const STORAGE_KEY_LEADS = OdcrmStorageKeys.leads
const STORAGE_KEY_DELETED_ACCOUNTS = OdcrmStorageKeys.deletedAccounts
const STORAGE_KEY_GOOGLE_SHEETS_CLEARED = 'odcrm_accounts_google_sheets_cleared_v1'

// Lead type for marketing leads
export type Lead = {
  [key: string]: string
  accountName: string
}

// Load leads from storage
export function loadLeadsFromStorage(): Lead[] {
  const parsed = getJson<Lead[]>(STORAGE_KEY_LEADS)
  if (parsed && Array.isArray(parsed)) {
    console.log('✅ Loaded leads from storage:', parsed.length)
    return parsed
  }
  console.log('⚠️ No leads found in storage')
  return []
}

function loadMarketingLeadsLastRefresh(): Date | null {
  const stored = getItem(OdcrmStorageKeys.marketingLeadsLastRefresh)
  if (!stored) return null
  const parsed = new Date(stored)
  return isNaN(parsed.getTime()) ? null : parsed
}

function shouldRefreshMarketingLeads(leads: Lead[]): boolean {
  if (leads.length === 0) return true
  const lastRefreshTime = loadMarketingLeadsLastRefresh()
  if (!lastRefreshTime) return true

  try {
    const accountsUpdatedIso = getItem(OdcrmStorageKeys.accountsLastUpdated)
    if (accountsUpdatedIso) {
      const accountsUpdatedAt = new Date(accountsUpdatedIso)
      if (!isNaN(accountsUpdatedAt.getTime()) && accountsUpdatedAt > lastRefreshTime) {
        return true
      }
    }
  } catch {
    // ignore
  }

  const now = new Date()
  const thirtyMinutesInMs = 30 * 60 * 1000
  return now.getTime() - lastRefreshTime.getTime() >= thirtyMinutesInMs
}

// Load deleted contacts from storage
function loadDeletedContactsFromStorage(): Set<string> {
  const parsed = getJson<string[]>(OdcrmStorageKeys.deletedContacts)
  return new Set(Array.isArray(parsed) ? parsed : [])
}

function loadContactsFromStorage(): StoredContact[] {
  const parsed = getJson<StoredContact[]>(OdcrmStorageKeys.contacts)
  if (!parsed || !Array.isArray(parsed)) return []
  
  // Filter out deleted contacts
  const deletedContactsSet = loadDeletedContactsFromStorage()
  const filtered = parsed.filter(c => !deletedContactsSet.has(c.id || ''))
  
  return filtered
}

function seedContactsIfEmpty() {
  // Only seed if there are no contacts saved yet.
  const existing = getJson<unknown>(OdcrmStorageKeys.contacts)
  if (Array.isArray(existing) && existing.length > 0) return

  // Seed contacts from the screenshots the user provided.
  // Accounts are mapped to existing canonical account names in this repo.
  const canonicalAccount = (raw: string) => {
    const key = raw.trim().toLowerCase()
    const map: Record<string, string> = {
      'protech': 'Protech Roofing',
      'green the uk': 'GreenTheUK',
      'renewable': 'Renewable Temp Power',
      'maxspace': 'MaxSpace Projects',
      'octavian': 'Octavian Security',
      'morson': 'P&R Morson FM',
      'shield': 'Shield Pest Control',
      'legionella & fire safe': 'Legionella',
    }
    return map[key] || raw.trim()
  }

  const seeded: StoredContact[] = [
    // Sheet 1 (Client / Contact Name / Contact Email / Contact Number)
    {
      id: 'seed-ocs-chris-piper',
      accounts: [canonicalAccount('OCS')],
      name: 'Chris Piper',
      email: 'Chris.piper@ocs.com',
      phone: '7484171055',
      title: '',
      tier: 'Decision maker',
      status: 'Active',
    },
    {
      id: 'seed-beauparc-graeme-knight',
      accounts: [canonicalAccount('Beauparc')],
      name: 'Graeme Knight',
      email: 'Graeme.Knight@beauparc.co.uk',
      phone: '7966520354',
      title: '',
      tier: 'Decision maker',
      status: 'Active',
    },
    {
      id: 'seed-octavian-sanjay-patel',
      accounts: [canonicalAccount('Octavian')],
      name: 'Sanjay Patel',
      email: 's.patel@octaviangr.com',
      phone: '7432809977',
      title: '',
      tier: 'Decision maker',
      status: 'Active',
    },
    {
      id: 'seed-legionella-steve-morris',
      accounts: [canonicalAccount('Legionella & Fire Safe')],
      name: 'Steve Morris',
      email: 'Steve.Morris@legionellaandfiresafe.co.uk',
      phone: '7970010055',
      title: '',
      tier: 'Decision maker',
      status: 'Active',
    },
    {
      id: 'seed-morson-adam-simms',
      accounts: [canonicalAccount('Morson')],
      name: 'Adam Simms',
      email: 'adam.sims@morsonfm.co.uk',
      phone: '7977124757',
      title: '',
      tier: 'Decision maker',
      status: 'Active',
    },
    {
      id: 'seed-verve-raphael-barreto',
      accounts: [canonicalAccount('Verve Connect')],
      name: 'Rephael Barreto',
      email: 'raphael.barreto@verveconnect.co.uk',
      phone: '7508241884',
      title: '',
      tier: 'Decision maker',
      status: 'Active',
    },
    {
      id: 'seed-shield-dan-stewart',
      accounts: [canonicalAccount('Shield')],
      name: 'Dan Stewart',
      email: 'dan.steward@shieldpestcontrol.co.uk',
      phone: '7977481269',
      title: '',
      tier: 'Decision maker',
      status: 'Active',
    },

    // Sheet 2 (Account Name / Client Contact Name / Job Title / Email Address / Telephone Number / Main Office Number)
    {
      id: 'seed-protech-david-mclean',
      accounts: [canonicalAccount('Protech')],
      name: 'David Mclean',
      title: 'MD',
      email: 'David.mclean@protechroofing.co.uk',
      phone: '07977497239',
      tier: 'Decision maker',
      status: 'Active',
    },
    {
      id: 'seed-greentheuk-francesca-tidd',
      accounts: [canonicalAccount('green the UK')],
      name: 'Francesca Tidd',
      title: 'Senior Consultant',
      email: 'francesca@greentheuk.co.uk',
      phone: '07463689541',
      tier: 'Decision maker',
      status: 'Active',
    },
    {
      id: 'seed-greentheuk-sam',
      accounts: [canonicalAccount('green the UK')],
      name: 'Sam',
      title: 'Senior Consultant',
      email: 'samuel@greentheuk.co.uk',
      phone: '07463654639',
      tier: 'Decision maker',
      status: 'Active',
    },
    {
      id: 'seed-greentheuk-xanthe-caldecoott',
      accounts: [canonicalAccount('green the UK')],
      name: 'Xanthe Caldecott',
      title: 'Founder & MD',
      email: 'xanthe@greentheuk.com',
      phone: '07787433925',
      tier: 'Decision maker',
      status: 'Active',
    },
    {
      id: 'seed-renewable-andrew-grant',
      accounts: [canonicalAccount('Renewable')],
      name: 'Andrew Grant',
      title: 'Founder & MD',
      email: 'andrew@rtp-ltd.co.uk',
      phone: '07947492105',
      tier: 'Decision maker',
      status: 'Active',
    },
    {
      id: 'seed-maxspace-bilal-khalid',
      accounts: [canonicalAccount('Maxspace')],
      name: 'Bilal Khalid',
      title: 'MD',
      email: 'bilal@maxspaceprojects.co.uk',
      phone: '07533143997',
      tier: 'Decision maker',
      status: 'Active',
    },
    {
      id: 'seed-maxspace-carlos',
      accounts: [canonicalAccount('Maxspace')],
      name: 'Carlos',
      title: '',
      email: 'carlos@maxspaceprojects.co.uk',
      phone: '02038242334',
      tier: 'Decision maker',
      status: 'Active',
    },
    {
      id: 'seed-vendease-dave-berman',
      accounts: [canonicalAccount('Vendease')],
      name: 'Dave Berman',
      title: 'Co-Founder',
      email: 'dave.berman@vendease.co.uk',
      phone: '07801062593',
      tier: 'Decision maker',
      status: 'Active',
    },
    {
      id: 'seed-vendease-jonny-holmes',
      accounts: [canonicalAccount('Vendease')],
      name: 'Jonny Holmes',
      title: 'Co-Founder',
      email: 'jonny.holmes@vendease.co.uk',
      phone: '02072237533',
      tier: 'Decision maker',
      status: 'Active',
    },
    {
      id: 'seed-papaya-nick-edwards',
      accounts: [canonicalAccount('Papaya')],
      name: 'Nick Edwards',
      title: 'MD',
      email: 'nickedwards@papayauk.com',
      phone: '07917479279',
      tier: 'Decision maker',
      status: 'Active',
    },
    {
      id: 'seed-papaya-georgie-dronfield',
      accounts: [canonicalAccount('Papaya')],
      name: 'Georgie Dronfield',
      title: 'Head of Operations',
      email: 'georgie.dronfield@papayauk.com',
      phone: '07384813193',
      tier: 'Decision maker',
      status: 'Active',
    },
    {
      id: 'seed-thomasfranks-tara-coots-williams',
      accounts: [canonicalAccount('Thomas Franks')],
      name: 'Tara Coots-Williams',
      title: 'Business Development Co-ordinator',
      email: 'tara@thomasfranks.com',
      phone: '07496353179',
      tier: 'Decision maker',
      status: 'Active',
    },
    {
      id: 'seed-thomasfranks-claire-long',
      accounts: [canonicalAccount('Thomas Franks')],
      name: 'Claire Long',
      title: 'Group Business Development Director',
      email: 'claire.long@thomasfranks.com',
      phone: '07562669134',
      tier: 'Decision maker',
      status: 'Active',
    },
    {
      id: 'seed-thomasfranks-james-pate',
      accounts: [canonicalAccount('Thomas Franks')],
      name: 'James Pate',
      title: 'Sales Director',
      email: 'james.pate@thomasfranks.com',
      phone: '07534677844',
      tier: 'Decision maker',
      status: 'Active',
    },
    {
      id: 'seed-besafe-oliver-eginton',
      accounts: [canonicalAccount('Be Safe Technologies')],
      name: 'Oliver Eginton',
      title: 'Sales Director',
      email: 'ollie@be-safetech.com',
      phone: '03338008150',
      tier: 'Decision maker',
      status: 'Active',
    },
    {
      id: 'seed-besafe-ross-sampson',
      accounts: [canonicalAccount('Be Safe Technologies')],
      name: 'Ross Sampson',
      title: 'CMO',
      email: 'ross@be-safetech.com',
      phone: '31 0 648266368',
      tier: 'Decision maker',
      status: 'Active',
    },
    {
      id: 'seed-besafe-graham',
      accounts: [canonicalAccount('Be Safe Technologies')],
      name: 'Graham',
      title: 'CEO',
      email: 'graham@be-safetech.com',
      phone: '03338008150',
      tier: 'Decision maker',
      status: 'Active',
    },
  ]

  try {
    setJson(OdcrmStorageKeys.contacts, seeded)
    emit('contactsUpdated', seeded)
  } catch (error) {
    console.warn('Failed to seed contacts into localStorage:', error)
  }
}

// Helper to parse dates in various formats (same as MarketingLeadsTab)
function parseDate(dateStr: string): Date | null {
  if (!dateStr || dateStr.trim() === '') return null
  
  const trimmed = dateStr.trim()
  
  // Try DD.MM.YY or DD.MM.YYYY format (from the Google Sheet)
  const ddmmyy = trimmed.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})$/)
  if (ddmmyy) {
    const day = parseInt(ddmmyy[1], 10)
    const month = parseInt(ddmmyy[2], 10) - 1
    const year = parseInt(ddmmyy[3], 10) < 100 ? 2000 + parseInt(ddmmyy[3], 10) : parseInt(ddmmyy[3], 10)
    const date = new Date(year, month, day)
    if (!isNaN(date.getTime())) return date
  }
  
  // Try DD/MM/YY or DD/MM/YYYY format
  const ddmmyySlash = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/)
  if (ddmmyySlash) {
    const day = parseInt(ddmmyySlash[1], 10)
    const month = parseInt(ddmmyySlash[2], 10) - 1
    const year = parseInt(ddmmyySlash[3], 10) < 100 ? 2000 + parseInt(ddmmyySlash[3], 10) : parseInt(ddmmyySlash[3], 10)
    const date = new Date(year, month, day)
    if (!isNaN(date.getTime())) return date
  }
  
  // Try DD-MM-YY or DD-MM-YYYY format
  const ddmmyyDash = trimmed.match(/^(\d{1,2})-(\d{1,2})-(\d{2,4})$/)
  if (ddmmyyDash) {
    const day = parseInt(ddmmyyDash[1], 10)
    const month = parseInt(ddmmyyDash[2], 10) - 1
    const year = parseInt(ddmmyyDash[3], 10) < 100 ? 2000 + parseInt(ddmmyyDash[3], 10) : parseInt(ddmmyyDash[3], 10)
    const date = new Date(year, month, day)
    if (!isNaN(date.getTime())) return date
  }
  
  // Try YYYY-MM-DD format (ISO)
  const yyyymmdd = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (yyyymmdd) {
    const year = parseInt(yyyymmdd[1], 10)
    const month = parseInt(yyyymmdd[2], 10) - 1
    const day = parseInt(yyyymmdd[3], 10)
    const date = new Date(year, month, day)
    if (!isNaN(date.getTime())) return date
  }
  
  // Try standard date parsing (handles various formats)
  const parsed = new Date(trimmed)
  if (!isNaN(parsed.getTime())) {
    // Validate the parsed date is reasonable (not too far in past/future)
    const year = parsed.getFullYear()
    if (year >= 2000 && year <= 2100) {
      return parsed
    }
  }
  
  return null
}

// Calculate weekly and monthly actuals from leads for an account
// Uses the same logic as MarketingLeadsTab for consistency
export function calculateActualsFromLeads(accountName: string, leads: Lead[]): { weeklyActual: number; monthlyActual: number } {
  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const endOfToday = new Date(startOfToday)
  endOfToday.setDate(endOfToday.getDate() + 1) // End of today (start of tomorrow)
  
  // Current week: Monday to Sunday of the current week
  const currentWeekStart = new Date(startOfToday)
  const dayOfWeek = currentWeekStart.getDay()
  const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek // Monday = 1, Sunday = 0
  currentWeekStart.setDate(currentWeekStart.getDate() + diff)
  currentWeekStart.setHours(0, 0, 0, 0)
  
  // End of current week: Start of next Monday (exclusive, like MarketingLeadsTab)
  const currentWeekEnd = new Date(currentWeekStart)
  currentWeekEnd.setDate(currentWeekEnd.getDate() + 7) // Start of next Monday

  // Current month: first day of month to last day of month
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  monthStart.setHours(0, 0, 0, 0)
  
  // End of month: Start of next month (exclusive, like MarketingLeadsTab)
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1)

  // Filter leads for this account
  const accountLeads = leads.filter(lead => lead.accountName === accountName)

  let weeklyActual = 0
  let monthlyActual = 0
  let leadsWithoutDates = 0
  const dateFieldsFound: string[] = []

  // Debug: Log date ranges and sample leads
  if (accountLeads.length > 0) {
    console.log(`📅 Date ranges for ${accountName}:`, {
      weekStart: currentWeekStart.toISOString().split('T')[0],
      weekEnd: currentWeekEnd.toISOString().split('T')[0],
      monthStart: monthStart.toISOString().split('T')[0],
      monthEnd: monthEnd.toISOString().split('T')[0],
      totalLeads: accountLeads.length,
      currentDate: now.toISOString().split('T')[0]
    })
    
    // Log first 3 leads to see their structure
    console.log(`📋 Sample leads for ${accountName}:`, accountLeads.slice(0, 3).map(lead => {
      const allFields = Object.entries(lead).map(([k, v]) => `${k}: "${v}"`).join(', ')
      return { fields: Object.keys(lead), sample: allFields.substring(0, 200) }
    }))
  }

  // Use the same date field detection logic as MarketingLeadsTab
  // But prioritize checking ALL fields for DD.MM.YY format first (like "05.01.26")
  accountLeads.forEach((lead, index) => {
    let dateValue = ''
    let dateFieldName = ''
    
    // FIRST: Check ALL fields for DD.MM.YY format (like "05.01.26") - this is the key!
    for (const key of Object.keys(lead)) {
      const value = lead[key] || ''
      if (value && value.trim() && /^\d{1,2}\.\d{1,2}\.\d{2,4}$/.test(value.trim())) {
        dateValue = value.trim()
        dateFieldName = key
        break
      }
    }
    
    // SECOND: If no DD.MM.YY format found, check for date fields in the same order as MarketingLeadsTab
    if (!dateValue || !dateValue.trim()) {
      dateValue =
        lead['Date'] ||
        lead['date'] ||
        lead['Week'] ||
        lead['week'] ||
        lead['First Meeting Date'] ||
        ''
      
      if (dateValue) {
        dateFieldName = lead['Date'] ? 'Date' : lead['date'] ? 'date' : lead['Week'] ? 'Week' : lead['week'] ? 'week' : lead['First Meeting Date'] ? 'First Meeting Date' : 'unknown'
      }
    }

    // Track which field was used
    if (dateFieldName && !dateFieldsFound.includes(dateFieldName)) {
      dateFieldsFound.push(dateFieldName)
    }

    const parsedDate = parseDate(dateValue)
    
    if (!parsedDate) {
      leadsWithoutDates++
      if (index < 3) {
        console.log(`⚠️ Lead ${index + 1} for ${accountName}: No parseable date.`, {
          dateValue: dateValue || 'EMPTY',
          dateFieldName: dateFieldName || 'NOT FOUND',
          sampleFields: Object.entries(lead).slice(0, 8).map(([k, v]) => `${k}: "${String(v).substring(0, 30)}"`).join(', ')
        })
      }
      return
    }

    // Use parsed date directly (same as MarketingLeadsTab) - no normalization needed
    // Check if within current week (Monday to Sunday) - use exclusive end like MarketingLeadsTab
    if (parsedDate >= currentWeekStart && parsedDate < currentWeekEnd) {
      weeklyActual++
    }

    // Check if within current month (first day to last day of month) - use exclusive end like MarketingLeadsTab
    if (parsedDate >= monthStart && parsedDate < monthEnd) {
      monthlyActual++
    }
  })

  // Log debugging info
  if (accountLeads.length > 0) {
    console.log(`📊 ${accountName}: ${accountLeads.length} total leads, ${weeklyActual} this week, ${monthlyActual} this month, ${leadsWithoutDates} without dates`)
    if (dateFieldsFound.length > 0) {
      console.log(`   Date fields found: ${dateFieldsFound.join(', ')}`)
    }
  }

  return { weeklyActual, monthlyActual }
}

// Load deleted account names from storage
function loadDeletedAccountsFromStorage(): Set<string> {
  const parsed = getJson<string[]>(STORAGE_KEY_DELETED_ACCOUNTS)
  return new Set(Array.isArray(parsed) ? parsed : [])
}

// Save deleted account names to storage
function saveDeletedAccountsToStorage(deletedAccounts: Set<string>) {
  setJson(STORAGE_KEY_DELETED_ACCOUNTS, Array.from(deletedAccounts))
}

// Load accounts from storage or use default
export function loadAccountsFromStorage(): Account[] {
  const parsed = getJson<Account[]>(STORAGE_KEY_ACCOUNTS)
  if (parsed && Array.isArray(parsed)) {
    console.log('✅ Loaded accounts from storage:', parsed.length)
    return parsed
  }
  return []
}

function loadLatestAccountsBackup(): Account[] | null {
  try {
    const backupKeys = keys()
      .filter((key) => key.startsWith('odcrm_accounts_backup_'))
      .sort()
      .reverse()
    for (const key of backupKeys) {
      const raw = getItem(key)
      if (!raw) continue
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) return parsed as Account[]
    }
  } catch (e) {
    console.warn('Failed to load accounts backup:', e)
  }
  return null
}

function mergeAccountFromBackup(account: Account, backup: Account): Account {
  const updates: Partial<Account> = {}
  if (account.clientLeadsSheetUrl === undefined && backup.clientLeadsSheetUrl) {
    updates.clientLeadsSheetUrl = backup.clientLeadsSheetUrl
  }
  if (!account.sector && backup.sector) {
    updates.sector = backup.sector
  }
  if ((!account.targetTitle || !account.targetTitle.trim()) && backup.targetTitle) {
    updates.targetTitle = backup.targetTitle
  }
  if ((account.targetLocation?.length ?? 0) === 0 && (backup.targetLocation?.length ?? 0) > 0) {
    updates.targetLocation = backup.targetLocation
  }
  if ((!account.weeklyTarget || account.weeklyTarget === 0) && backup.weeklyTarget) {
    updates.weeklyTarget = backup.weeklyTarget
  }
  if ((!account.monthlyTarget || account.monthlyTarget === 0) && backup.monthlyTarget) {
    updates.monthlyTarget = backup.monthlyTarget
  }
  if ((!account.monthlySpendGBP || account.monthlySpendGBP === 0) && backup.monthlySpendGBP) {
    updates.monthlySpendGBP = backup.monthlySpendGBP
  }
  return Object.keys(updates).length ? { ...account, ...updates } : account
}

// Save accounts to storage
function saveAccountsToStorage(accountsData: Account[]) {
  setJson(STORAGE_KEY_ACCOUNTS, accountsData)
  setItem(STORAGE_KEY_ACCOUNTS_LAST_UPDATED, new Date().toISOString())
  console.log('💾 Saved accounts to storage')
}

const DEFAULT_ABOUT_SECTIONS: AboutSections = {
  whatTheyDo: '',
  accreditations: '',
  keyLeaders: '',
  companyProfile: '',
  recentNews: '',
  companySize: '',
  headquarters: '',
  foundingYear: '',
}

const DEFAULT_CLIENT_PROFILE: ClientProfile = {
  clientHistory: '',
  accreditations: [],
  targetGeographicalArea: undefined,
  targetJobSectorIds: [],
  targetJobRoleIds: [],
  keyBusinessObjectives: '',
  clientUSPs: '',
  socialMediaPresence: {
    facebookUrl: '',
    linkedinUrl: '',
    xUrl: '',
    instagramUrl: '',
    tiktokUrl: '',
    youtubeUrl: '',
    websiteUrl: '',
  },
  qualifyingQuestions: '',
  caseStudiesOrTestimonials: '',
}

function mapClientStatusToAccountStatus(status?: string | null): Account['status'] {
  switch (status) {
    case 'inactive':
      return 'Inactive'
    case 'onboarding':
    case 'win_back':
      return 'On Hold'
    default:
      return 'Active'
  }
}

function mapAccountStatusToClientStatus(status?: Account['status']): CustomerApi['clientStatus'] {
  switch (status) {
    case 'Inactive':
      return 'inactive'
    case 'On Hold':
      return 'onboarding'
    default:
      return 'active'
  }
}

function normalizeCustomerWebsite(domain?: string | null): string {
  if (!domain) return ''
  if (domain.startsWith('http://') || domain.startsWith('https://')) return domain
  return `https://${domain}`
}

function normalizeName(value?: string | null): string {
  if (!value) return ''
  return value
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]/g, '')
}

function normalizeDomain(value?: string | null): string {
  if (!value) return ''
  try {
    const withScheme = value.startsWith('http') ? value : `https://${value}`
    const host = new URL(withScheme).hostname
    return host.replace(/^www\./, '').toLowerCase()
  } catch {
    return value.replace(/^https?:\/\//, '').replace(/^www\./, '').toLowerCase()
  }
}

type AccountSnapshot = Omit<Account, 'leads' | 'weeklyActual' | 'monthlyActual' | 'contacts'> & {
  leads?: number
  weeklyActual?: number
  monthlyActual?: number
  contacts?: number
}

function sanitizeAccountForStorage(account: Account): AccountSnapshot {
  const sanitized: AccountSnapshot = { ...account }
  delete sanitized.leads
  delete sanitized.weeklyActual
  delete sanitized.monthlyActual
  delete sanitized.contacts
  return sanitized
}

function coerceAccountData(value: unknown): Partial<Account> | null {
  if (!value || typeof value !== 'object') return null
  return value as Partial<Account>
}

function normalizeClientProfile(raw?: Partial<ClientProfile> | null): ClientProfile {
  const safe = raw && typeof raw === 'object' ? raw : {}
  return {
    ...DEFAULT_CLIENT_PROFILE,
    ...safe,
    accreditations: Array.isArray(safe.accreditations) ? safe.accreditations : [],
    targetJobSectorIds: Array.isArray(safe.targetJobSectorIds) ? safe.targetJobSectorIds : [],
    targetJobRoleIds: Array.isArray(safe.targetJobRoleIds) ? safe.targetJobRoleIds : [],
    socialMediaPresence: {
      ...DEFAULT_CLIENT_PROFILE.socialMediaPresence,
      ...(safe.socialMediaPresence || {}),
    },
    targetGeographicalArea:
      safe.targetGeographicalArea && typeof safe.targetGeographicalArea === 'object'
        ? safe.targetGeographicalArea
        : undefined,
  }
}

function computeAccountsSyncHash(accountsData: Account[]): string {
  const normalized = accountsData
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((account) => ({
      name: account.name,
      website: account.website,
      snapshot: sanitizeAccountForStorage(account),
    }))
  return JSON.stringify(normalized)
}

type CustomerPayload = {
  name: string
  domain?: string
  website?: string
  accountData?: Record<string, unknown> | null
  leadsReportingUrl?: string | null
  sector?: string | null
  clientStatus?: string | null
  targetJobTitle?: string | null
  prospectingLocation?: string | null
  monthlyIntakeGBP?: number | null
  defcon?: number | null
  weeklyLeadTarget?: number | null
  weeklyLeadActual?: number | null
  monthlyLeadTarget?: number | null
  monthlyLeadActual?: number | null
  whatTheyDo?: string | null
  accreditations?: string | null
  keyLeaders?: string | null
  companyProfile?: string | null
  recentNews?: string | null
  companySize?: string | null
  headquarters?: string | null
  foundingYear?: string | null
  socialPresence?: Array<{ label: string; url: string }> | null
}

function buildCustomerPayloadFromAccount(account: Account): CustomerPayload {
  const payload: CustomerPayload = {
    name: account.name,
  }
  payload.accountData = sanitizeAccountForStorage(account) as unknown as Record<string, unknown>

  const domain = normalizeDomain(account.website)
  if (domain) payload.domain = domain
  if (account.website) payload.website = account.website
  const trimmedLeadsUrl = account.clientLeadsSheetUrl?.trim()
  if (trimmedLeadsUrl) {
    payload.leadsReportingUrl = trimmedLeadsUrl
  } else if (account.clientLeadsSheetUrl === '') {
    payload.leadsReportingUrl = null
  }
  if (account.sector) payload.sector = account.sector
  if (account.status) payload.clientStatus = mapAccountStatusToClientStatus(account.status) || 'active'
  if (account.targetTitle) payload.targetJobTitle = account.targetTitle
  if (account.targetLocation?.length) payload.prospectingLocation = account.targetLocation[0]

  if (account.monthlySpendGBP && account.monthlySpendGBP > 0) {
    payload.monthlyIntakeGBP = Number(account.monthlySpendGBP)
  }
  if (account.defcon && account.defcon > 0) payload.defcon = account.defcon
  if (account.weeklyTarget && account.weeklyTarget > 0) payload.weeklyLeadTarget = account.weeklyTarget
  if (account.monthlyTarget && account.monthlyTarget > 0) payload.monthlyLeadTarget = account.monthlyTarget

  if (account.aboutSections.whatTheyDo) payload.whatTheyDo = account.aboutSections.whatTheyDo
  if (account.aboutSections.accreditations) payload.accreditations = account.aboutSections.accreditations
  if (account.aboutSections.keyLeaders) payload.keyLeaders = account.aboutSections.keyLeaders
  if (account.aboutSections.companyProfile) payload.companyProfile = account.aboutSections.companyProfile
  if (account.aboutSections.recentNews) payload.recentNews = account.aboutSections.recentNews
  if (account.aboutSections.companySize) payload.companySize = account.aboutSections.companySize
  if (account.aboutSections.headquarters) payload.headquarters = account.aboutSections.headquarters
  if (account.aboutSections.foundingYear) payload.foundingYear = account.aboutSections.foundingYear
  if (account.socialMedia.length > 0) payload.socialPresence = account.socialMedia

  return payload
}

function hasSyncableCustomerFields(payload: ReturnType<typeof buildCustomerPayloadFromAccount>): boolean {
  return Object.entries(payload).some(
    ([key, value]) => key !== 'name' && value !== undefined && value !== null && value !== '',
  )
}

function diffCustomerPayload(
  customer: CustomerApi,
  payload: ReturnType<typeof buildCustomerPayloadFromAccount>,
): Record<string, string | number | null | Record<string, unknown> | Array<{ label: string; url: string }>> {
  const updates: Record<string, string | number | null | Record<string, unknown> | Array<{ label: string; url: string }>> = {}
  const normalizeValue = (value: unknown) => String(value ?? '').trim().toLowerCase()
  const normalizeNumber = (value: unknown) => {
    if (value === null || value === undefined || value === '') return null
    const parsed = Number(value)
    return Number.isNaN(parsed) ? null : parsed
  }
  const normalizeJson = (value: unknown) => {
    try {
      return JSON.stringify(value ?? null)
    } catch {
      return ''
    }
  }

  if (payload.name && normalizeValue(payload.name) !== normalizeValue(customer.name)) {
    updates.name = payload.name
  }
  if (payload.domain && normalizeValue(payload.domain) !== normalizeValue(customer.domain)) {
    updates.domain = payload.domain
  }
  if (payload.website && normalizeValue(payload.website) !== normalizeValue(customer.website)) {
    updates.website = payload.website
  }
  if (payload.leadsReportingUrl !== undefined) {
    const normalizedPayload =
      payload.leadsReportingUrl === null ? null : normalizeValue(payload.leadsReportingUrl)
    const normalizedCustomer = customer.leadsReportingUrl
      ? normalizeValue(customer.leadsReportingUrl)
      : null
    if (normalizedPayload !== normalizedCustomer) {
      updates.leadsReportingUrl = payload.leadsReportingUrl
    }
  }
  if (payload.sector && normalizeValue(payload.sector) !== normalizeValue(customer.sector)) {
    updates.sector = payload.sector
  }
  if (payload.clientStatus && normalizeValue(payload.clientStatus) !== normalizeValue(customer.clientStatus)) {
    updates.clientStatus = payload.clientStatus
  }
  if (
    payload.targetJobTitle &&
    normalizeValue(payload.targetJobTitle) !== normalizeValue(customer.targetJobTitle)
  ) {
    updates.targetJobTitle = payload.targetJobTitle
  }
  if (
    payload.prospectingLocation &&
    normalizeValue(payload.prospectingLocation) !== normalizeValue(customer.prospectingLocation)
  ) {
    updates.prospectingLocation = payload.prospectingLocation
  }
  if (
    payload.accountData &&
    normalizeJson(payload.accountData) !== normalizeJson(customer.accountData)
  ) {
    updates.accountData = payload.accountData
  }

  if (payload.whatTheyDo && normalizeValue(payload.whatTheyDo) !== normalizeValue(customer.whatTheyDo)) {
    updates.whatTheyDo = payload.whatTheyDo
  }
  if (
    payload.accreditations &&
    normalizeValue(payload.accreditations) !== normalizeValue(customer.accreditations)
  ) {
    updates.accreditations = payload.accreditations
  }
  if (payload.keyLeaders && normalizeValue(payload.keyLeaders) !== normalizeValue(customer.keyLeaders)) {
    updates.keyLeaders = payload.keyLeaders
  }
  if (
    payload.companyProfile &&
    normalizeValue(payload.companyProfile) !== normalizeValue(customer.companyProfile)
  ) {
    updates.companyProfile = payload.companyProfile
  }
  if (payload.recentNews && normalizeValue(payload.recentNews) !== normalizeValue(customer.recentNews)) {
    updates.recentNews = payload.recentNews
  }
  if (payload.companySize && normalizeValue(payload.companySize) !== normalizeValue(customer.companySize)) {
    updates.companySize = payload.companySize
  }
  if (
    payload.headquarters &&
    normalizeValue(payload.headquarters) !== normalizeValue(customer.headquarters)
  ) {
    updates.headquarters = payload.headquarters
  }
  if (
    payload.foundingYear &&
    normalizeValue(payload.foundingYear) !== normalizeValue(customer.foundingYear)
  ) {
    updates.foundingYear = payload.foundingYear
  }
  if (
    payload.socialPresence &&
    normalizeJson(payload.socialPresence) !== normalizeJson(customer.socialPresence)
  ) {
    updates.socialPresence = payload.socialPresence
  }

  const monthlyIntake = normalizeNumber(payload.monthlyIntakeGBP)
  if (monthlyIntake !== null && monthlyIntake !== normalizeNumber(customer.monthlyIntakeGBP)) {
    updates.monthlyIntakeGBP = monthlyIntake
  }
  if (payload.defcon && payload.defcon !== customer.defcon) updates.defcon = payload.defcon
  if (
    payload.weeklyLeadTarget &&
    payload.weeklyLeadTarget !== normalizeNumber(customer.weeklyLeadTarget)
  ) {
    updates.weeklyLeadTarget = payload.weeklyLeadTarget
  }
  if (
    payload.weeklyLeadActual &&
    payload.weeklyLeadActual !== normalizeNumber(customer.weeklyLeadActual)
  ) {
    updates.weeklyLeadActual = payload.weeklyLeadActual
  }
  if (
    payload.monthlyLeadTarget &&
    payload.monthlyLeadTarget !== normalizeNumber(customer.monthlyLeadTarget)
  ) {
    updates.monthlyLeadTarget = payload.monthlyLeadTarget
  }
  if (
    payload.monthlyLeadActual &&
    payload.monthlyLeadActual !== normalizeNumber(customer.monthlyLeadActual)
  ) {
    updates.monthlyLeadActual = payload.monthlyLeadActual
  }

  return updates
}

function findCustomerForAccount(account: Account, customers: CustomerApi[]): CustomerApi | undefined {
  const accountKey = normalizeName(account.name)
  const accountDomain = normalizeDomain(account.website)

  return customers.find((customer) => {
    const customerKey = normalizeName(customer.name)
    const customerDomain = normalizeDomain(customer.domain ?? '')
    if (accountKey && customerKey && accountKey === customerKey) return true
    if (accountDomain && customerDomain && accountDomain === customerDomain) return true
    return false
  })
}

function normalizeAccountDefaults(raw: Partial<Account>): Account {
  return {
    name: raw.name || '',
    website: raw.website || '',
    aboutSections: { ...DEFAULT_ABOUT_SECTIONS, ...(raw.aboutSections || {}) },
    sector: raw.sector || '',
    socialMedia: Array.isArray(raw.socialMedia) ? raw.socialMedia : [],
    contactPersons: raw.contactPersons || '',
    contactNumber: raw.contactNumber || '',
    contactEmail: raw.contactEmail || '',
    primaryContact: raw.primaryContact,
    contactRoleId: raw.contactRoleId || '',
    contactRoleLabel: raw.contactRoleLabel || '',
    contactActive: typeof raw.contactActive === 'boolean' ? raw.contactActive : true,
    headOfficeAddress: raw.headOfficeAddress || '',
    headOfficePlaceId: raw.headOfficePlaceId || '',
    headOfficePostcode: raw.headOfficePostcode || '',
    assignedAccountManager: raw.assignedAccountManager || '',
    assignedAccountManagerId: raw.assignedAccountManagerId || '',
    assignedClientDdiNumber: raw.assignedClientDdiNumber || '',
    emailAccountsSetUp: typeof raw.emailAccountsSetUp === 'boolean' ? raw.emailAccountsSetUp : false,
    emailAccounts: Array.isArray(raw.emailAccounts) ? raw.emailAccounts : [],
    status: raw.status || 'Active',
    targetLocation: Array.isArray(raw.targetLocation) ? raw.targetLocation : [],
    targetTitle: raw.targetTitle || '',
    clientProfile: normalizeClientProfile(raw.clientProfile),
    monthlySpendGBP: Number(raw.monthlySpendGBP || 0),
    agreements: Array.isArray(raw.agreements) ? raw.agreements : [],
    defcon: typeof raw.defcon === 'number' ? raw.defcon : 3,
    contractStart: raw.contractStart || '',
    contractEnd: raw.contractEnd || '',
    days: typeof raw.days === 'number' ? raw.days : 0,
    contacts: typeof raw.contacts === 'number' ? raw.contacts : 0,
    leads: typeof raw.leads === 'number' ? raw.leads : 0,
    weeklyTarget: typeof raw.weeklyTarget === 'number' ? raw.weeklyTarget : 0,
    weeklyActual: typeof raw.weeklyActual === 'number' ? raw.weeklyActual : 0,
    monthlyTarget: typeof raw.monthlyTarget === 'number' ? raw.monthlyTarget : 0,
    monthlyActual: typeof raw.monthlyActual === 'number' ? raw.monthlyActual : 0,
    weeklyReport: raw.weeklyReport || '',
    users: Array.isArray(raw.users) ? raw.users : [],
    clientLeadsSheetUrl: raw.clientLeadsSheetUrl ?? undefined,
    notes: Array.isArray(raw.notes) ? raw.notes : undefined,
  }
}

function applyCustomerFieldsToAccount(account: Account, customer: CustomerApi): Account {
  const updated: Account = { ...account }
  if (customer.name) updated.name = customer.name
  // Prioritize website from DB field
  if (customer.website) updated.website = customer.website
  else if (customer.domain) updated.website = normalizeCustomerWebsite(customer.domain)
  if (customer.sector) updated.sector = customer.sector
  if (customer.clientStatus) updated.status = mapClientStatusToAccountStatus(customer.clientStatus)
  if (customer.prospectingLocation) updated.targetLocation = [customer.prospectingLocation]
  if (customer.targetJobTitle) updated.targetTitle = customer.targetJobTitle
  if (customer.monthlyIntakeGBP) updated.monthlySpendGBP = Number(customer.monthlyIntakeGBP || 0)
  if (typeof customer.defcon === 'number') updated.defcon = customer.defcon
  if (typeof customer.weeklyLeadTarget === 'number') updated.weeklyTarget = customer.weeklyLeadTarget
  if (typeof customer.weeklyLeadActual === 'number') updated.weeklyActual = customer.weeklyLeadActual
  if (typeof customer.monthlyLeadTarget === 'number') updated.monthlyTarget = customer.monthlyLeadTarget
  if (typeof customer.monthlyLeadActual === 'number') updated.monthlyActual = customer.monthlyLeadActual
  if (customer.leadsReportingUrl) updated.clientLeadsSheetUrl = customer.leadsReportingUrl
  if (customer.leadsReportingUrl === null) updated.clientLeadsSheetUrl = ''
  // Update About sections from DB fields if available
  if (
    customer.whatTheyDo ||
    customer.accreditations ||
    customer.keyLeaders ||
    customer.companyProfile ||
    customer.recentNews ||
    customer.companySize ||
    customer.headquarters ||
    customer.foundingYear
  ) {
    updated.aboutSections = {
      ...updated.aboutSections,
      whatTheyDo: customer.whatTheyDo || updated.aboutSections.whatTheyDo,
      accreditations: customer.accreditations || updated.aboutSections.accreditations,
      keyLeaders: customer.keyLeaders || updated.aboutSections.keyLeaders,
      companyProfile: customer.companyProfile || updated.aboutSections.companyProfile,
      recentNews: customer.recentNews || updated.aboutSections.recentNews,
      companySize: customer.companySize || updated.aboutSections.companySize,
      headquarters: customer.headquarters || updated.aboutSections.headquarters,
      foundingYear: customer.foundingYear || updated.aboutSections.foundingYear,
    }
  }
  // Update social media from DB
  if (customer.socialPresence && Array.isArray(customer.socialPresence)) {
    updated.socialMedia = customer.socialPresence
  }
  return updated
}

function buildAccountFromCustomer(customer: CustomerApi): Account {
  // Prioritize website from DB field, fallback to domain
  const website = customer.website || normalizeCustomerWebsite(customer.domain)
  
  // Build About sections from DB fields if available
  const aboutSectionsFromDb = customer.whatTheyDo ||
    customer.accreditations ||
    customer.keyLeaders ||
    customer.companyProfile ||
    customer.recentNews ||
    customer.companySize ||
    customer.headquarters ||
    customer.foundingYear
    ? {
        whatTheyDo: customer.whatTheyDo || '',
        accreditations: customer.accreditations || '',
        keyLeaders: customer.keyLeaders || '',
        companyProfile: customer.companyProfile || '',
        recentNews: customer.recentNews || '',
        companySize: customer.companySize || '',
        headquarters: customer.headquarters || '',
        foundingYear: customer.foundingYear || '',
      }
    : undefined

  const fallback = normalizeAccountDefaults({
    name: customer.name,
    website,
    sector: customer.sector || '',
    status: mapClientStatusToAccountStatus(customer.clientStatus),
    targetLocation: customer.prospectingLocation ? [customer.prospectingLocation] : [],
    targetTitle: customer.targetJobTitle || '',
    monthlySpendGBP: Number(customer.monthlyIntakeGBP || 0),
    defcon: customer.defcon ?? 3,
    weeklyTarget: customer.weeklyLeadTarget ?? 0,
    weeklyActual: customer.weeklyLeadActual ?? 0,
    monthlyTarget: customer.monthlyLeadTarget ?? 0,
    monthlyActual: customer.monthlyLeadActual ?? 0,
    clientLeadsSheetUrl: customer.leadsReportingUrl || '',
    aboutSections: aboutSectionsFromDb,
    socialMedia: customer.socialPresence && Array.isArray(customer.socialPresence) ? customer.socialPresence : [],
  })
  const accountData = coerceAccountData(customer.accountData)
  const base = accountData ? normalizeAccountDefaults({ ...fallback, ...accountData }) : fallback
  
  // If DB has About data, merge it (DB takes precedence)
  if (aboutSectionsFromDb) {
    base.aboutSections = {
      ...base.aboutSections,
      ...aboutSectionsFromDb,
    }
  }
  
  return applyCustomerFieldsToAccount(base, customer)
}

function mergeAccountFromCustomer(account: Account, customer: CustomerApi): Account {
  if (customer.accountData) {
    return buildAccountFromCustomer(customer)
  }
  const updates: Partial<Account> = {}
  if (customer.leadsReportingUrl === null && account.clientLeadsSheetUrl) {
    updates.clientLeadsSheetUrl = ''
  }
  if (account.clientLeadsSheetUrl === undefined && customer.leadsReportingUrl) {
    updates.clientLeadsSheetUrl = customer.leadsReportingUrl
  }
  if (!account.sector && customer.sector) {
    updates.sector = customer.sector
  }
  if ((!account.targetTitle || !account.targetTitle.trim()) && customer.targetJobTitle) {
    updates.targetTitle = customer.targetJobTitle
  }
  if ((account.targetLocation?.length ?? 0) === 0 && customer.prospectingLocation) {
    updates.targetLocation = [customer.prospectingLocation]
  }
  if ((!account.defcon || account.defcon === 0) && customer.defcon) {
    updates.defcon = customer.defcon
  }
  if ((!account.weeklyTarget || account.weeklyTarget === 0) && customer.weeklyLeadTarget) {
    updates.weeklyTarget = customer.weeklyLeadTarget
  }
  if ((!account.weeklyActual || account.weeklyActual === 0) && customer.weeklyLeadActual) {
    updates.weeklyActual = customer.weeklyLeadActual
  }
  if ((!account.monthlyTarget || account.monthlyTarget === 0) && customer.monthlyLeadTarget) {
    updates.monthlyTarget = customer.monthlyLeadTarget
  }
  if ((!account.monthlyActual || account.monthlyActual === 0) && customer.monthlyLeadActual) {
    updates.monthlyActual = customer.monthlyLeadActual
  }
  if ((!account.monthlySpendGBP || account.monthlySpendGBP === 0) && customer.monthlyIntakeGBP) {
    updates.monthlySpendGBP = Number(customer.monthlyIntakeGBP || 0)
  }
  if (!account.website && customer.domain) {
    updates.website = normalizeCustomerWebsite(customer.domain)
  }
  return Object.keys(updates).length ? { ...account, ...updates } : account
}

// Helper function to populate account with company data from service
async function populateAccountData(account: Account): Promise<Account> {
  const companyData = await fetchCompanyData(account.name, account.website)
  if (!companyData) {
    return {
      ...account,
      aboutSource: account.aboutSource ?? 'web_failed',
    }
  }
  
  // Build company profile from available data
  const companyProfileParts: string[] = []
  if (companyData.headquarters) companyProfileParts.push(`Headquarters: ${companyData.headquarters}`)
  if (companyData.foundingYear) companyProfileParts.push(`Founded: ${companyData.foundingYear}`)
  if (companyData.companySize) companyProfileParts.push(`Company Size: ${companyData.companySize}`)
  const companyProfile = companyProfileParts.length > 0 ? companyProfileParts.join('. ') + '.' : ''
  
  // Use company data, prioritizing it over existing account data
  return {
    ...account,
    sector: companyData.sector || account.sector,
    aboutSections: {
      whatTheyDo: companyData.whatTheyDo || '',
      accreditations: companyData.accreditations || '',
      keyLeaders: companyData.keyLeaders || '',
      companyProfile: companyProfile || '',
      recentNews: companyData.recentNews || '',
      companySize: companyData.companySize || '',
      headquarters: companyData.headquarters || '',
      foundingYear: companyData.foundingYear || '',
    },
    socialMedia: companyData.socialMedia && companyData.socialMedia.length > 0 ? companyData.socialMedia : [],
    logoUrl: companyData.logoUrl || account.logoUrl,
    aboutSource: companyData.source || 'web',
    aboutLocked: true,
  }
}

// Load sectors from storage
function loadSectorsFromStorage(): Record<string, string> {
  const parsed = getJson<Record<string, string>>(STORAGE_KEY_SECTORS)
  return parsed && typeof parsed === 'object' ? parsed : {}
}

// Save sectors to storage
function saveSectorsToStorage(sectors: Record<string, string>) {
  setJson(STORAGE_KEY_SECTORS, sectors)
}

// Load target locations from storage
function loadTargetLocationsFromStorage(): Record<string, string[]> {
  const parsed = getJson<Record<string, string[]>>(STORAGE_KEY_TARGET_LOCATIONS)
  return parsed && typeof parsed === 'object' ? parsed : {}
}

// Save target locations to storage
function saveTargetLocationsToStorage(locations: Record<string, string[]>) {
  setJson(STORAGE_KEY_TARGET_LOCATIONS, locations)
}

const seededAccounts: Account[] = [
  {
    name: 'OCS',
    website: 'https://ocs.com/',
    aboutSections: {
      whatTheyDo: 'OCS Group is one of the UK\'s leading facilities management companies, providing cleaning, security, catering, and support services to businesses across various sectors including healthcare, education, retail, and corporate offices.',
      accreditations: 'ISO 9001, ISO 14001, ISO 45001, CHAS, SafeContractor, Achilles, Constructionline',
      keyLeaders: 'Daniel Dickson (CEO), Chris Piper (Key Contact)',
      companyProfile: 'Headquarters: London, United Kingdom. Founded: 1900. Company Size: 50,000+ employees.',
      recentNews: 'OCS continues to expand its facilities management services across the UK, with recent contracts in healthcare and education sectors. The company focuses on sustainable cleaning solutions and digital innovation.',
      companySize: '50,000+ employees',
      headquarters: 'London, United Kingdom',
      foundingYear: '1900',
    },
    sector: 'Facilities Management & Cleaning Services',
    socialMedia: [
      { label: 'LinkedIn', url: 'https://www.linkedin.com/company/ocs-group' },
      { label: 'Twitter', url: 'https://twitter.com/OCSGroupUK' },
      { label: 'Facebook', url: 'https://www.facebook.com/OCSGroupUK' }
    ],
    status: 'Active',
    targetLocation: [],
    targetTitle: '',
    monthlySpendGBP: 5000,
    agreements: [],
    defcon: 3,
    contractStart: '',
    contractEnd: '',
    days: 1,
    contacts: 0,
    leads: 0,
    weeklyTarget: 0,
    weeklyActual: 0,
    monthlyTarget: 0,
    monthlyActual: 0,
    weeklyReport: '',
    users: [],
  },
  {
    name: 'Beauparc',
    website: 'https://beauparc.ie/',
    aboutSections: {
      whatTheyDo: 'Beauparc Utilities is Ireland\'s leading waste management and recycling company, providing comprehensive waste collection, recycling, and environmental services to residential, commercial, and industrial customers across Ireland.',
      accreditations: 'ISO 14001, ISO 9001, OHSAS 18001, EPA Licensed',
      keyLeaders: 'Graeme Knight (Key Contact), Senior Management Team',
      companyProfile: 'Headquarters: Dublin, Ireland. Founded: 2015. Company Size: 1,000+ employees.',
      recentNews: 'Beauparc has been expanding its recycling infrastructure and investing in new waste-to-energy facilities. The company is focused on achieving circular economy goals and reducing landfill dependency.',
      companySize: '1,000+ employees',
      headquarters: 'Dublin, Ireland',
      foundingYear: '2015',
    },
    sector: 'Waste Management & Recycling',
    socialMedia: [
      { label: 'LinkedIn', url: 'https://www.linkedin.com/company/beauparc-utilities' },
      { label: 'Website', url: 'https://beauparc.ie/' }
    ],
    status: 'Active',
    targetLocation: [],
    targetTitle: '',
    monthlySpendGBP: 4700,
    agreements: [],
    defcon: 3,
    contractStart: '',
    contractEnd: '',
    days: 1,
    contacts: 0,
    leads: 0,
    weeklyTarget: 0,
    weeklyActual: 0,
    monthlyTarget: 0,
    monthlyActual: 0,
    weeklyReport: '',
    users: [],
  },
  {
    name: 'Thomas Franks',
    website: 'https://thomasfranks.com/',
    aboutSections: {
      whatTheyDo: 'Thomas Franks is a premium catering and hospitality services provider, specializing in corporate catering, event management, and hospitality services for businesses, schools, and institutions across the UK.',
      accreditations: 'ISO 9001, ISO 14001, OHSAS 18001, Food Safety Management, Investors in People',
      keyLeaders: 'Frank Bothwell (Founder & CEO), Senior Management Team',
      companyProfile: 'Headquarters: London, United Kingdom. Founded: 2004. Company Size: 500-1,000 employees.',
      recentNews: 'Thomas Franks continues to grow its corporate catering portfolio and has been recognized for excellence in sustainable catering practices and employee development programs.',
      companySize: '500-1,000 employees',
      headquarters: 'London, United Kingdom',
      foundingYear: '2004',
    },
    sector: 'Catering & Hospitality Services',
    socialMedia: [
      { label: 'LinkedIn', url: 'https://www.linkedin.com/company/thomas-franks' },
      { label: 'Twitter', url: 'https://twitter.com/thomasfranks' }
    ],
    status: 'Active',
    targetLocation: [],
    targetTitle: '',
    monthlySpendGBP: 4500,
    agreements: [],
    defcon: 3,
    contractStart: '',
    contractEnd: '',
    days: 1,
    contacts: 0,
    leads: 0,
    weeklyTarget: 0,
    weeklyActual: 0,
    monthlyTarget: 0,
    monthlyActual: 0,
    weeklyReport: '',
    users: [],
  },
  {
    name: 'Be Safe Technologies',
    website: 'https://be-safetech.com/',
    aboutSections: {
      whatTheyDo: 'Be Safe Technologies provides innovative health and safety technology solutions, including safety management software, compliance tracking systems, and digital safety tools for businesses across various industries.',
      accreditations: 'ISO 9001, ISO 27001, Cyber Essentials',
      keyLeaders: 'Management Team',
      companyProfile: 'Headquarters: United Kingdom. Founded: 2010s. Company Size: 50-200 employees.',
      recentNews: 'Be Safe Technologies continues to develop digital safety solutions and expand its client base in the construction and manufacturing sectors.',
      companySize: '50-200 employees',
      headquarters: 'United Kingdom',
      foundingYear: '2010s',
    },
    sector: 'Health & Safety Technology',
    socialMedia: [
      { label: 'LinkedIn', url: 'https://www.linkedin.com/company/be-safe-technologies' },
      { label: 'Website', url: 'https://be-safetech.com/' }
    ],
    status: 'Active',
    targetLocation: [],
    targetTitle: '',
    monthlySpendGBP: 3200,
    agreements: [],
    defcon: 3,
    contractStart: '',
    contractEnd: '',
    days: 1,
    contacts: 0,
    leads: 0,
    weeklyTarget: 0,
    weeklyActual: 0,
    monthlyTarget: 0,
    monthlyActual: 0,
    weeklyReport: '',
    users: [],
  },
  {
    name: 'Shield Pest Control',
    website: 'https://shieldpestcontrol.co.uk',
    aboutSections: {
      whatTheyDo: 'Shield Pest Control provides comprehensive pest control and prevention services for residential and commercial properties across the UK, specializing in rodent control, insect management, and bird proofing solutions.',
      accreditations: 'BPCA (British Pest Control Association) Certified, NPTA (National Pest Technicians Association), SafeContractor',
      keyLeaders: 'Dan Stewart (Key Contact), Management Team',
      companyProfile: 'Headquarters: United Kingdom. Founded: 2000s. Company Size: 50-200 employees.',
      recentNews: 'Shield Pest Control continues to expand its service coverage and invest in eco-friendly pest control solutions and training programs for technicians.',
      companySize: '50-200 employees',
      headquarters: 'United Kingdom',
      foundingYear: '2000s',
    },
    sector: 'Pest Control Services',
    socialMedia: [
      { label: 'LinkedIn', url: 'https://www.linkedin.com/company/shield-pest-control' },
      { label: 'Website', url: 'https://shieldpestcontrol.co.uk' }
    ],
    status: 'Active',
    targetLocation: [],
    targetTitle: '',
    monthlySpendGBP: 3200,
    agreements: [],
    defcon: 3,
    contractStart: '',
    contractEnd: '',
    days: 1,
    contacts: 0,
    leads: 0,
    weeklyTarget: 0,
    weeklyActual: 0,
    monthlyTarget: 0,
    monthlyActual: 0,
    weeklyReport: '',
    users: [],
  },
  {
    name: 'My Purchasing Partner',
    website: 'https://www.mypurchasingpartner.co.uk/',
    aboutSections: {
      whatTheyDo: 'My Purchasing Partner is a procurement consultancy and managed services provider, helping businesses optimize their purchasing processes, reduce costs, and improve supply chain efficiency across various categories.',
      accreditations: 'CIPS (Chartered Institute of Procurement & Supply) Affiliated, ISO 9001',
      keyLeaders: 'Management Team',
      companyProfile: 'Headquarters: United Kingdom. Founded: 2010s. Company Size: 20-50 employees.',
      recentNews: 'My Purchasing Partner continues to help businesses navigate supply chain challenges and optimize procurement strategies in the post-pandemic economy.',
      companySize: '20-50 employees',
      headquarters: 'United Kingdom',
      foundingYear: '2010s',
    },
    sector: 'Procurement & Supply Chain Services',
    socialMedia: [
      { label: 'LinkedIn', url: 'https://www.linkedin.com/company/my-purchasing-partner' },
      { label: 'Website', url: 'https://www.mypurchasingpartner.co.uk/' }
    ],
    status: 'Active',
    targetLocation: [],
    targetTitle: '',
    monthlySpendGBP: 3000,
    agreements: [],
    defcon: 3,
    contractStart: '',
    contractEnd: '',
    days: 1,
    contacts: 0,
    leads: 0,
    weeklyTarget: 0,
    weeklyActual: 0,
    monthlyTarget: 0,
    monthlyActual: 0,
    weeklyReport: '',
    users: [],
  },
  {
    name: 'Legionella',
    website: 'https://legionellacontrol.com/',
    aboutSections: {
      whatTheyDo: 'Legionella Control Services (Legionella & Fire Safe) provides comprehensive water safety, legionella risk assessment, and fire safety services to businesses, healthcare facilities, and property management companies across the UK.',
      accreditations: 'UKAS Accredited, ISO 9001, ISO 14001, OHSAS 18001, SafeContractor, CHAS',
      keyLeaders: 'Steve Morris (Key Contact), Management Team',
      companyProfile: 'Headquarters: United Kingdom. Founded: 2000s. Company Size: 50-200 employees.',
      recentNews: 'The company continues to expand its water safety services and has been involved in major healthcare and commercial projects, ensuring compliance with HSE guidelines.',
      companySize: '50-200 employees',
      headquarters: 'United Kingdom',
      foundingYear: '2000s',
    },
    sector: 'Water Safety & Legionella Control Services',
    socialMedia: [
      { label: 'LinkedIn', url: 'https://www.linkedin.com/company/legionella-control-services' },
      { label: 'Website', url: 'https://legionellacontrol.com/' }
    ],
    status: 'Active',
    targetLocation: [],
    targetTitle: '',
    monthlySpendGBP: 3000,
    agreements: [],
    defcon: 3,
    contractStart: '',
    contractEnd: '',
    days: 1,
    contacts: 0,
    leads: 0,
    weeklyTarget: 0,
    weeklyActual: 0,
    monthlyTarget: 0,
    monthlyActual: 0,
    weeklyReport: '',
    users: [],
  },
  {
    name: 'Renewable Temp Power',
    website: 'https://renewabletemporarypower.co.uk/',
    aboutSections: {
      whatTheyDo: 'Renewable Temp Power provides temporary and permanent power solutions, including renewable energy systems, generator rentals, and sustainable power infrastructure for events, construction sites, and businesses.',
      accreditations: 'ISO 9001, ISO 14001, Constructionline, SafeContractor',
      keyLeaders: 'Management Team',
      companyProfile: 'Headquarters: United Kingdom. Founded: 2010s. Company Size: 20-50 employees.',
      recentNews: 'Renewable Temp Power is expanding its renewable energy offerings and has been involved in sustainable power projects for major events and construction sites.',
      companySize: '20-50 employees',
      headquarters: 'United Kingdom',
      foundingYear: '2010s',
    },
    sector: 'Temporary Power Solutions & Renewable Energy',
    socialMedia: [
      { label: 'LinkedIn', url: 'https://www.linkedin.com/company/renewable-temp-power' },
      { label: 'Website', url: 'https://renewabletemporarypower.co.uk/' }
    ],
    status: 'Active',
    targetLocation: [],
    targetTitle: '',
    monthlySpendGBP: 3000,
    agreements: [],
    defcon: 3,
    contractStart: '',
    contractEnd: '',
    days: 1,
    contacts: 0,
    leads: 0,
    weeklyTarget: 0,
    weeklyActual: 0,
    monthlyTarget: 0,
    monthlyActual: 0,
    weeklyReport: '',
    users: [],
  },
  {
    name: 'Octavian Security',
    website: 'https://www.octaviansecurity.com/',
    aboutSections: {
      whatTheyDo: 'Octavian Security provides comprehensive security services including manned guarding, mobile patrols, CCTV monitoring, and security consultancy for commercial, retail, and residential properties across the UK.',
      accreditations: 'SIA (Security Industry Authority) Licensed, ISO 9001, SafeContractor, CHAS',
      keyLeaders: 'Sanjay Patel (Key Contact), Management Team',
      companyProfile: 'Headquarters: United Kingdom. Founded: 2000s. Company Size: 500-1,000 employees.',
      recentNews: 'Octavian Security continues to expand its security services portfolio and invest in technology solutions including AI-powered surveillance and access control systems.',
      companySize: '500-1,000 employees',
      headquarters: 'United Kingdom',
      foundingYear: '2000s',
    },
    sector: 'Security Services',
    socialMedia: [
      { label: 'LinkedIn', url: 'https://www.linkedin.com/company/octavian-security' },
      { label: 'Website', url: 'https://www.octaviansecurity.com/' }
    ],
    status: 'Active',
    targetLocation: [],
    targetTitle: '',
    monthlySpendGBP: 1600,
    agreements: [],
    defcon: 3,
    contractStart: '',
    contractEnd: '',
    days: 1,
    contacts: 0,
    leads: 0,
    weeklyTarget: 0,
    weeklyActual: 0,
    monthlyTarget: 0,
    monthlyActual: 0,
    weeklyReport: '',
    users: [],
  },
  {
    name: 'Octavian IT Services',
    website: 'https://www.octaviansecurity.com/',
    aboutSections: {
      whatTheyDo: 'Octavian IT Services provides IT support, managed services, cloud solutions, and technology consulting to businesses, helping them optimize their IT infrastructure and digital operations.',
      accreditations: 'ISO 9001, ISO 27001, Cyber Essentials Plus',
      keyLeaders: 'Sanjay Patel (Key Contact), IT Management Team',
      companyProfile: 'Headquarters: United Kingdom. Founded: 2000s. Company Size: 50-200 employees.',
      recentNews: 'Octavian IT Services continues to expand its cloud services and cybersecurity offerings, helping businesses modernize their IT infrastructure.',
      companySize: '50-200 employees',
      headquarters: 'United Kingdom',
      foundingYear: '2000s',
    },
    sector: 'IT Services & Technology Solutions',
    socialMedia: [
      { label: 'LinkedIn', url: 'https://www.linkedin.com/company/octavian-it-services' },
      { label: 'Website', url: 'https://www.octaviansecurity.com/' }
    ],
    status: 'Active',
    targetLocation: [],
    targetTitle: '',
    monthlySpendGBP: 800,
    agreements: [],
    defcon: 3,
    contractStart: '',
    contractEnd: '',
    days: 1,
    contacts: 0,
    leads: 0,
    weeklyTarget: 0,
    weeklyActual: 0,
    monthlyTarget: 0,
    monthlyActual: 0,
    weeklyReport: '',
    users: [],
  },
  {
    name: 'P&R Morson FM',
    website: 'https://www.morsonfm.co.uk/',
    aboutSections: {
      whatTheyDo: 'P&R Morson Facilities Management provides comprehensive facilities management services including maintenance, cleaning, security, and property management for commercial and public sector clients.',
      accreditations: 'ISO 9001, ISO 14001, OHSAS 18001, SafeContractor, CHAS',
      keyLeaders: 'Adam Simms (Key Contact), Management Team',
      companyProfile: 'Headquarters: United Kingdom. Founded: 2000s. Company Size: 200-500 employees.',
      recentNews: 'P&R Morson FM continues to secure new facilities management contracts and invest in technology to improve service delivery and client satisfaction.',
      companySize: '200-500 employees',
      headquarters: 'United Kingdom',
      foundingYear: '2000s',
    },
    sector: 'Facilities Management',
    socialMedia: [
      { label: 'LinkedIn', url: 'https://www.linkedin.com/company/morson-fm' },
      { label: 'Website', url: 'https://www.morsonfm.co.uk/' }
    ],
    status: 'Active',
    targetLocation: [],
    targetTitle: '',
    monthlySpendGBP: 2000,
    agreements: [],
    defcon: 3,
    contractStart: '',
    contractEnd: '',
    days: 1,
    contacts: 0,
    leads: 0,
    weeklyTarget: 0,
    weeklyActual: 0,
    monthlyTarget: 0,
    monthlyActual: 0,
    weeklyReport: '',
    users: [],
  },
  {
    name: 'GreenTheUK',
    website: 'https://greentheuk.com/',
    aboutSections: {
      whatTheyDo: 'GreenTheUK provides environmental consulting, sustainability solutions, and green technology services to help businesses reduce their carbon footprint and achieve environmental compliance.',
      accreditations: 'ISO 14001, Environmental Management Certified',
      keyLeaders: 'Management Team',
      companyProfile: 'Headquarters: United Kingdom. Founded: 2010s. Company Size: 20-50 employees.',
      recentNews: 'GreenTheUK is expanding its sustainability consulting services and helping businesses navigate net-zero targets and environmental regulations.',
      companySize: '20-50 employees',
      headquarters: 'United Kingdom',
      foundingYear: '2010s',
    },
    sector: 'Environmental Services & Sustainability',
    socialMedia: [
      { label: 'LinkedIn', url: 'https://www.linkedin.com/company/greentheuk' },
      { label: 'Website', url: 'https://greentheuk.com/' }
    ],
    status: 'Active',
    targetLocation: [],
    targetTitle: '',
    monthlySpendGBP: 2000,
    agreements: [],
    defcon: 3,
    contractStart: '',
    contractEnd: '',
    days: 1,
    contacts: 0,
    leads: 0,
    weeklyTarget: 0,
    weeklyActual: 0,
    monthlyTarget: 0,
    monthlyActual: 0,
    weeklyReport: '',
    users: [],
  },
  {
    name: 'Protech Roofing',
    website: 'https://protechroofing.co.uk/',
    aboutSections: {
      whatTheyDo: 'Protech Roofing provides professional roofing services including roof repairs, installations, maintenance, and waterproofing solutions for commercial and residential properties across the UK.',
      accreditations: 'NFRC (National Federation of Roofing Contractors) Member, CHAS, SafeContractor, Constructionline',
      keyLeaders: 'Management Team',
      companyProfile: 'Headquarters: United Kingdom. Founded: 2000s. Company Size: 50-200 employees.',
      recentNews: 'Protech Roofing continues to expand its service coverage and invest in sustainable roofing solutions and training programs for roofing professionals.',
      companySize: '50-200 employees',
      headquarters: 'United Kingdom',
      foundingYear: '2000s',
    },
    sector: 'Roofing & Construction Services',
    socialMedia: [
      { label: 'LinkedIn', url: 'https://www.linkedin.com/company/protech-roofing' },
      { label: 'Website', url: 'https://protechroofing.co.uk/' }
    ],
    status: 'Active',
    targetLocation: [],
    targetTitle: '',
    monthlySpendGBP: 2000,
    agreements: [],
    defcon: 3,
    contractStart: '',
    contractEnd: '',
    days: 1,
    contacts: 0,
    leads: 0,
    weeklyTarget: 0,
    weeklyActual: 0,
    monthlyTarget: 0,
    monthlyActual: 0,
    weeklyReport: '',
    users: [],
  },
  {
    name: 'MaxSpace Projects',
    website: 'https://maxspaceprojects.co.uk/',
    aboutSections: {
      whatTheyDo: 'MaxSpace Projects provides construction project management, design, and build services for commercial and residential developments, specializing in space optimization and efficient project delivery.',
      accreditations: 'ISO 9001, CHAS, SafeContractor, Constructionline',
      keyLeaders: 'Management Team',
      companyProfile: 'Headquarters: United Kingdom. Founded: 2010s. Company Size: 20-50 employees.',
      recentNews: 'MaxSpace Projects continues to deliver construction projects and expand its portfolio of commercial and residential developments.',
      companySize: '20-50 employees',
      headquarters: 'United Kingdom',
      foundingYear: '2010s',
    },
    sector: 'Construction & Project Management',
    socialMedia: [
      { label: 'LinkedIn', url: 'https://www.linkedin.com/company/maxspace-projects' },
      { label: 'Website', url: 'https://maxspaceprojects.co.uk/' }
    ],
    status: 'Active',
    targetLocation: [],
    targetTitle: '',
    monthlySpendGBP: 1500,
    agreements: [],
    defcon: 3,
    contractStart: '',
    contractEnd: '',
    days: 1,
    contacts: 0,
    leads: 0,
    weeklyTarget: 0,
    weeklyActual: 0,
    monthlyTarget: 0,
    monthlyActual: 0,
    weeklyReport: '',
    users: [],
  },
]

export const accounts: Account[] = seededAccounts.map((account) => ({
  ...account,
  aboutSections: { ...DEFAULT_ABOUT_SECTIONS },
  sector: '',
  socialMedia: [],
  logoUrl: account.logoUrl,
  aboutSource: undefined,
  aboutLocked: false,
}))

// UK Areas for Target Location
const UK_AREAS = [
  'United Kingdom',
  'London', 'Birmingham', 'Manchester', 'Glasgow', 'Liverpool', 'Leeds', 'Edinburgh', 'Bristol',
  'Cardiff', 'Belfast', 'Newcastle', 'Sheffield', 'Leicester', 'Coventry', 'Nottingham', 'Southampton',
  'Portsmouth', 'Brighton', 'Reading', 'Northampton', 'Luton', 'Bolton', 'Bournemouth', 'Norwich',
  'Swindon', 'Southend-on-Sea', 'Middlesbrough', 'Peterborough', 'Cambridge', 'Oxford', 'Ipswich',
  'Slough', 'Blackpool', 'Milton Keynes', 'York', 'Huddersfield', 'Telford', 'Derby', 'Plymouth',
  'Wolverhampton', 'Stoke-on-Trent', 'Swansea', 'Salford', 'Aberdeen', 'Westminster', 'Westminster',
  'Croydon', 'Wandsworth', 'Ealing', 'Hillingdon', 'Hounslow', 'Richmond upon Thames', 'Kingston upon Thames',
  'Merton', 'Sutton', 'Bromley', 'Lewisham', 'Greenwich', 'Bexley', 'Havering', 'Barking and Dagenham',
  'Redbridge', 'Newham', 'Tower Hamlets', 'Hackney', 'Islington', 'Camden', 'Westminster', 'Kensington and Chelsea',
  'Hammersmith and Fulham', 'Wandsworth', 'Lambeth', 'Southwark', 'Birmingham', 'Coventry', 'Dudley',
  'Sandwell', 'Solihull', 'Walsall', 'Wolverhampton', 'Bradford', 'Calderdale', 'Kirklees', 'Leeds',
  'Wakefield', 'Gateshead', 'Newcastle upon Tyne', 'North Tyneside', 'South Tyneside', 'Sunderland',
  'Liverpool', 'Knowsley', 'Sefton', 'St Helens', 'Wirral', 'Bolton', 'Bury', 'Manchester', 'Oldham',
  'Rochdale', 'Salford', 'Stockport', 'Tameside', 'Trafford', 'Wigan', 'Blackburn with Darwen', 'Blackpool',
  'Burnley', 'Chorley', 'Fylde', 'Hyndburn', 'Lancaster', 'Pendle', 'Preston', 'Ribble Valley', 'Rossendale',
  'South Ribble', 'West Lancashire', 'Wyre', 'Barnsley', 'Doncaster', 'Rotherham', 'Sheffield', 'Bath and North East Somerset',
  'Bristol', 'North Somerset', 'South Gloucestershire', 'Isle of Wight', 'Portsmouth', 'Southampton',
  'Brighton and Hove', 'Milton Keynes', 'Reading', 'Slough', 'Windsor and Maidenhead', 'Wokingham',
  'Cambridge', 'East Cambridgeshire', 'Fenland', 'Huntingdonshire', 'Peterborough', 'South Cambridgeshire',
  'Basildon', 'Braintree', 'Brentwood', 'Castle Point', 'Chelmsford', 'Colchester', 'Epping Forest',
  'Harlow', 'Maldon', 'Rochford', 'Southend-on-Sea', 'Tendring', 'Thurrock', 'Uttlesford', 'Norwich',
  'Great Yarmouth', 'King\'s Lynn and West Norfolk', 'North Norfolk', 'South Norfolk', 'Breckland',
  'Broadland', 'Ipswich', 'Babergh', 'East Suffolk', 'Mid Suffolk', 'West Suffolk',
].sort()

const sectionsToPlainText = (sections: AboutSections) =>
  [
    `What they do: ${sections.whatTheyDo}`,
    `Company size: ${sections.companySize}`,
    `Headquarters: ${sections.headquarters}`,
    `Founded: ${sections.foundingYear}`,
    `Accreditations: ${sections.accreditations}`,
    `Key leaders: ${sections.keyLeaders}`,
    `Company profile: ${sections.companyProfile}`,
    `Recent news: ${sections.recentNews}`,
  ].join(' ')

const truncateText = (text: string, maxLength = 240) =>
  text.length > maxLength ? `${text.slice(0, maxLength).trimEnd()}…` : text

const hasExtendedAbout = (sections: AboutSections) =>
  sectionsToPlainText(sections).length > 480

const socialPresenceBlock = (socialMedia: SocialProfile[]) => {
  if (!socialMedia || socialMedia.length === 0) return null
  return (
    <Stack spacing={2}>
      <Text fontSize="sm" fontWeight="semibold" color="gray.600">
        Social presence
      </Text>
      <Wrap spacing={2}>
        {socialMedia.map((profile) => (
          <WrapItem key={profile.label}>
            <Link 
              href={profile.url} 
              isExternal 
              color="text.muted" 
              fontWeight="medium"
              _hover={{ color: 'teal.700', textDecoration: 'underline' }}
              target="_blank"
              rel="noopener noreferrer"
            >
              {profile.label}
              <ExternalLinkIcon ml={1} />
            </Link>
          </WrapItem>
        ))}
      </Wrap>
    </Stack>
  )
}

const detailedSections = (sections: AboutSections) => {
  const sectionsList: Array<{ heading: string; value: string }> = [
    { heading: 'What they do', value: sections.whatTheyDo },
  ]

  if (sections.companySize) {
    sectionsList.push({ heading: 'Company size', value: sections.companySize })
  }
  if (sections.headquarters) {
    sectionsList.push({ heading: 'Headquarters', value: sections.headquarters })
  }
  if (sections.foundingYear) {
    sectionsList.push({ heading: 'Founded', value: sections.foundingYear })
  }
  if (!sections.companySize && !sections.headquarters && !sections.foundingYear && sections.companyProfile) {
    sectionsList.push({ heading: 'Company profile', value: sections.companyProfile })
  }
  
  if (sections.accreditations) {
    sectionsList.push({ heading: 'Accreditations', value: sections.accreditations })
  }
  if (sections.keyLeaders) {
    sectionsList.push({ heading: 'Key leaders', value: sections.keyLeaders })
  }
  if (sections.companyProfile && (sections.companySize || sections.headquarters || sections.foundingYear)) {
    sectionsList.push({ heading: 'Company profile', value: sections.companyProfile })
  }
  if (sections.recentNews) {
    sectionsList.push({ heading: 'Recent news', value: sections.recentNews })
  }
  
  return sectionsList
}

// Helper to format stored JSON strings into readable text and extract structured data
const formatStoredValue = (value: string): { text: string; newsItems?: Array<{ date: string; headline: string; url?: string }> } => {
  if (!value || typeof value !== 'string') return { text: value || '' }
  
  // Check if it's a JSON string
  const trimmed = value.trim()
  if ((trimmed.startsWith('{') || trimmed.startsWith('[')) && (trimmed.endsWith('}') || trimmed.endsWith(']'))) {
    try {
      const parsed = JSON.parse(trimmed)
      const newsItems: Array<{ date: string; headline: string; url?: string }> = []
      
      // Handle arrays
      if (Array.isArray(parsed)) {
        const formatted = parsed.map(item => {
          if (typeof item === 'string') return item
          if (typeof item === 'object' && item !== null) {
            if (item.name && item.title) return `${item.name} (${item.title})`
            if (item.date && item.headline) {
              // Store news item for link rendering
              newsItems.push({
                date: item.date,
                headline: item.headline,
                url: item.url || item.link
              })
              return `${item.date}: ${item.headline}`
            }
            if (item.city && item.country) return `${item.city}, ${item.country}`
            // Extract values without keys
            const values = Object.entries(item)
              .filter(([k]) => !['id', 'url', 'link'].includes(k.toLowerCase()))
              .map(([, val]) => {
                if (typeof val === 'string' && val) return val
                if (Array.isArray(val) && val.length > 0) return val.join(', ')
                return null
              })
              .filter(Boolean)
              .join(' • ')
            return values || JSON.stringify(item)
          }
          return String(item)
        }).filter(Boolean).join('\n')
        return { text: formatted, newsItems: newsItems.length > 0 ? newsItems : undefined }
      }
      
      // Handle objects
      if (typeof parsed === 'object' && parsed !== null) {
        if (parsed.name && parsed.title) return { text: `${parsed.name} (${parsed.title})` }
        if (parsed.date && parsed.headline) {
          newsItems.push({
            date: parsed.date,
            headline: parsed.headline,
            url: parsed.url || parsed.link
          })
          return { text: `${parsed.date}: ${parsed.headline}`, newsItems }
        }
        if (parsed.companySize || parsed.headquarters || parsed.foundingYear) {
          const parts: string[] = []
          if (parsed.companySize) parts.push(parsed.companySize)
          if (parsed.headquarters) {
            const hq = typeof parsed.headquarters === 'object' 
              ? `${parsed.headquarters.city || ''}, ${parsed.headquarters.country || ''}`.trim().replace(/^,|,$/g, '')
              : String(parsed.headquarters)
            if (hq) parts.push(hq)
          }
          if (parsed.foundingYear) parts.push(String(parsed.foundingYear))
          if (parsed.regionalOffices && Array.isArray(parsed.regionalOffices)) {
            const offices = parsed.regionalOffices.map((office: any) => 
              typeof office === 'object' && office.city && office.country
                ? `${office.city}, ${office.country}`
                : String(office)
            ).join('; ')
            if (offices) parts.push(offices)
          }
          return { text: parts.join(' • ') }
        }
        // Extract values without keys
        const values = Object.entries(parsed)
          .filter(([k]) => !['id', 'url', 'link'].includes(k.toLowerCase()))
          .map(([, val]) => {
            if (typeof val === 'string' && val) return val
            if (Array.isArray(val) && val.length > 0) return val.join(', ')
            return null
          })
          .filter(Boolean)
          .join(' • ')
        return { text: values || value }
      }
    } catch {
      // Not valid JSON, return as is
      return { text: value }
    }
  }
  
  return { text: value }
}

const renderAboutField = (
  sections: AboutSections,
  expanded: boolean | undefined,
  onToggle: () => void,
  socialMedia: SocialProfile[],
  headquarters?: string,
  website?: string,
  onWebsiteSave?: (value: string) => Promise<void>,
  isEditingWebsite?: boolean,
  onEditWebsite?: () => void,
  onCancelWebsite?: () => void,
) => {
  const sectionItems = detailedSections(sections).map(item => {
    const formatted = formatStoredValue(item.value)
    return {
      ...item,
      value: formatted.text,
      newsItems: formatted.newsItems
    }
  })
  const visibleSections = sectionItems.filter((item) => {
    if (item.heading === 'Recent news') {
      return item.newsItems && item.newsItems.length > 0
    }
    return Boolean(item.value && item.value.trim())
  })
  const shouldShowToggle = hasExtendedAbout(sections)

  if (!expanded && shouldShowToggle) {
    const whatTheyDoFormatted = formatStoredValue(sections.whatTheyDo)
    return (
      <Stack spacing={3}>
        {/* Website Link */}
        {website && (
          <Box mb={2}>
            <Link
              href={website}
              isExternal
              color="teal.600"
              fontSize="sm"
              fontWeight="medium"
              textDecoration="underline"
            >
              {website}
            </Link>
          </Box>
        )}
        <Text fontSize="sm" fontWeight="semibold" color="gray.600">
          What they do
        </Text>
        <Text fontSize="sm" color="gray.700">
          {truncateText(whatTheyDoFormatted.text, 320)}
        </Text>
        <Button size="sm" variant="link" alignSelf="flex-start" onClick={onToggle}>
          Show full profile
        </Button>
      </Stack>
    )
  }

  return (
    <Stack spacing={5}>
      {/* Website Link - always at top */}
      {website && (
        <Box>
          {isEditingWebsite ? (
            <Input
              defaultValue={website}
              autoFocus
              size="sm"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && onWebsiteSave) {
                  onWebsiteSave(e.currentTarget.value)
                }
                if (e.key === 'Escape' && onCancelWebsite) {
                  onCancelWebsite()
                }
              }}
              onBlur={(e) => {
                if (onWebsiteSave) {
                  onWebsiteSave(e.currentTarget.value)
                }
              }}
            />
          ) : (
            <HStack spacing={2} align="center">
              <Link
                href={website}
                isExternal
                color="teal.600"
                fontSize="sm"
                fontWeight="medium"
                textDecoration="underline"
              >
                {website}
              </Link>
              {onEditWebsite && (
                <IconButton
                  aria-label="Edit website"
                  icon={<EditIcon />}
                  size="xs"
                  variant="ghost"
                  onClick={onEditWebsite}
                />
              )}
            </HStack>
          )}
        </Box>
      )}
      {visibleSections.map((item) => {
        // Special handling for Recent news section with links
        if (item.heading === 'Recent news' && item.newsItems && item.newsItems.length > 0) {
          return (
            <Stack key={item.heading} spacing={1}>
              <Text fontSize="sm" fontWeight="semibold" color="gray.600">
                {item.heading}
              </Text>
              <Stack spacing={2}>
                {item.newsItems.map((news, index) => (
                  <Box key={index}>
                    {news.url ? (
                      <Link href={news.url} isExternal color="text.muted" fontSize="sm">
                        {news.date ? `${news.date}: ` : ''}{news.headline}
                      </Link>
                    ) : (
                      <Text fontSize="sm" color="gray.700">
                        {news.date ? `${news.date}: ` : ''}{news.headline}
                      </Text>
                    )}
                  </Box>
                ))}
              </Stack>
            </Stack>
          )
        }
        
        // Special handling for Headquarters section with Google Maps
        if (item.heading === 'Headquarters' && item.value) {
          const address = item.value
          const encodedAddress = encodeURIComponent(address)
          const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodedAddress}`
          
          return (
            <Stack key={item.heading} spacing={2}>
              <Text fontSize="sm" fontWeight="semibold" color="gray.600">
                {item.heading}
              </Text>
              <Text fontSize="sm" color="gray.700" whiteSpace="pre-line">
                {item.value}
              </Text>
              <Link
                href={googleMapsUrl}
                isExternal
                color="teal.600"
                fontSize="sm"
                fontWeight="medium"
                display="inline-flex"
                alignItems="center"
                gap={1}
              >
                View on Google Maps
                <ExternalLinkIcon />
              </Link>
              <Box
                as="iframe"
                src={`https://www.google.com/maps?q=${encodedAddress}&output=embed`}
                width="100%"
                height="200px"
                borderRadius="md"
                border="1px solid"
                borderColor="gray.200"
                loading="lazy"
              />
            </Stack>
          )
        }
        
        return (
          <Stack key={item.heading} spacing={1}>
            <Text fontSize="sm" fontWeight="semibold" color="gray.600">
              {item.heading}
            </Text>
            <Text fontSize="sm" color="gray.700" whiteSpace="pre-line">
              {item.value}
            </Text>
          </Stack>
        )
      })}
      {socialPresenceBlock(socialMedia)}
      {shouldShowToggle && (
        <Button size="sm" variant="link" alignSelf="flex-start" onClick={onToggle}>
          {expanded ? 'Show less' : 'Show full profile'}
        </Button>
      )}
    </Stack>
  )
}

type FieldConfig = {
  label: string
  render: (account: Account, onContactClick?: (contact: Contact) => void) => ReactNode
}

function getFieldConfig(contactsData: StoredContact[]): FieldConfig[] {
  return [
  {
    label: 'Account',
    render: (account) => account.name,
  },
  {
    label: 'Sector',
    render: (account) => account.sector,
  },
  {
    label: 'Status',
    render: (account) => (
      <Badge
        colorScheme={
          account.status === 'Active'
            ? 'green'
            : account.status === 'Inactive'
              ? 'red'
              : 'orange'
        }
      >
        {account.status}
      </Badge>
    ),
  },
  {
    label: 'Target Location',
    render: (account) => account.targetLocation.length > 0 ? account.targetLocation.join(', ') : 'No locations selected',
  },
  {
    label: 'Target Title',
    render: (account) => account.targetTitle,
  },
  {
    label: 'Monthly Spent Pounds',
    render: (account) => currencyFormatter.format(account.monthlySpendGBP),
  },
  {
    label: 'Agreements',
    render: (account) =>
      account.agreements.length > 0
        ? `${account.agreements.length} file(s) attached`
        : 'No agreements attached',
  },
  {
    label: 'DEFCON',
    render: (account) => `${account.defcon} - ${account.defcon === 1 ? 'Very Dissatisfied' : account.defcon === 2 ? 'Dissatisfied' : account.defcon === 3 ? 'Neutral' : account.defcon === 4 ? 'Satisfied' : 'Very Satisfied'}`,
  },
  {
    label: 'Contract Start',
    render: (account) => dateFormatter.format(new Date(account.contractStart)),
  },
  {
    label: 'Contract End',
    render: (account) => dateFormatter.format(new Date(account.contractEnd)),
  },
  {
    label: 'Days',
    render: (account) => `${account.days} day${account.days !== 1 ? 's' : ''} per week`,
  },
  {
    label: 'Contacts',
    render: (account, onContactClick) => {
      // Filter out deleted contacts to ensure they don't show in the account card
      const deletedContactsSet = loadDeletedContactsFromStorage()
      const accountContacts = contactsData.filter((contact) => {
        // Check if contact has this account in their accounts array
        const hasAccount = (contact.accounts || []).some(acc => acc === account.name)
        return hasAccount && !deletedContactsSet.has(contact.id || '')
      })
      
      if (accountContacts.length === 0) {
        return <Text fontSize="sm" color="gray.500">No contacts</Text>
      }
      return (
        <Stack spacing={2}>
          <Text fontSize="sm" fontWeight="medium">
            {accountContacts.length} contact{accountContacts.length !== 1 ? 's' : ''}
          </Text>
          <Stack spacing={1}>
            {accountContacts.map((contact) => (
              <Box
                key={contact.id || contact.name}
                fontSize="sm"
                p={2}
                borderRadius="md"
                border="1px solid"
                borderColor="gray.200"
                cursor="pointer"
                _hover={{ bg: 'gray.50', borderColor: 'teal.300' }}
                onClick={() => {
                  const contactForClick: Contact = {
                    name: contact.name,
                    title: contact.title,
                    accounts: contact.accounts || [],
                    tier: contact.tier,
                    status: contact.status,
                    email: contact.email,
                    phone: contact.phone,
                  }
                  onContactClick?.(contactForClick)
                }}
              >
                <Text fontWeight="medium">{contact.name}</Text>
                <Text fontSize="xs" color="gray.500">
                  {contact.title || '—'} • {contact.email || '—'}
                </Text>
              </Box>
            ))}
          </Stack>
        </Stack>
      )
    },
  },
  {
    label: 'Weekly Target',
    render: (account) => account.weeklyTarget,
  },
  {
    label: 'Monthly Target',
    render: (account) => account.monthlyTarget,
  },
  {
    label: 'Leads Generated This Month',
    render: (account) => {
      const leads = loadLeadsFromStorage()
      const accountLeads = leads.filter(lead => lead.accountName === account.name)
      const now = new Date()
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
      const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
      
      let monthlyLeads = 0
      accountLeads.forEach(lead => {
        const dateValue =
          lead['Date'] ||
          lead['date'] ||
          lead['Week'] ||
          lead['week'] ||
          lead['First Meeting Date'] ||
          lead['first meeting date'] ||
          ''
        const parsedDate = parseDate(dateValue)
        if (parsedDate && parsedDate >= monthStart && parsedDate < endOfToday) {
          monthlyLeads++
        }
      })
      
      return (
        <Badge colorScheme={monthlyLeads > 0 ? 'teal' : 'gray'} fontSize="sm" px={2} py={1}>
          {monthlyLeads}
        </Badge>
      )
    },
  },
  {
    label: 'Client Leads',
    render: (account) => {
      if (!account.clientLeadsSheetUrl) {
        return <Text fontSize="sm" color="gray.500">No leads sheet configured</Text>
      }
      return (
        <Link
          href={account.clientLeadsSheetUrl}
          color="text.muted"
          isExternal
          display="inline-flex"
          alignItems="center"
          gap={1}
          onClick={(e) => {
            e.preventDefault()
            window.open(account.clientLeadsSheetUrl, '_blank')
            // Trigger navigation to leads tab
            emit('navigateToLeads', { accountName: account.name })
          }}
        >
          View Leads Sheet
          <ExternalLinkIcon />
        </Link>
      )
    },
  },
  {
    label: 'Users',
    render: (account) => (
      <Stack spacing={2}>
        <AvatarGroup size="sm" max={4}>
          {account.users.map((user) => (
            <Avatar key={user.name} name={user.name} />
          ))}
        </AvatarGroup>
        <Wrap spacing={2}>
          {account.users.map((user) => (
            <WrapItem key={`${user.name}-role`}>
              <Badge variant="subtle" colorScheme="gray">
                {user.name}
              </Badge>
            </WrapItem>
          ))}
        </Wrap>
      </Stack>
    ),
  },
  ]
}

type TargetLocationMultiSelectProps = {
  locations: string[]
  onLocationsChange: (locations: string[]) => void
}

function TargetLocationMultiSelect({
  locations,
  onLocationsChange,
}: TargetLocationMultiSelectProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [isOpen, setIsOpen] = useState(false)

  const filteredAreas = UK_AREAS.filter((area) =>
    area.toLowerCase().includes(searchTerm.toLowerCase()),
  ).filter((area) => !locations.includes(area))

  const handleAddLocation = (area: string) => {
    if (!locations.includes(area)) {
      onLocationsChange([...locations, area])
    }
    setSearchTerm('')
    setIsOpen(false)
  }

  const handleRemoveLocation = (area: string) => {
    onLocationsChange(locations.filter((loc) => loc !== area))
  }

  return (
    <Stack spacing={3}>
      <InputGroup>
        <Input
          placeholder="Search UK areas (e.g., London, Manchester)..."
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value)
            setIsOpen(true)
          }}
          onFocus={() => setIsOpen(true)}
        />
        <InputRightElement>
          <SearchIcon color="gray.400" />
        </InputRightElement>
      </InputGroup>

      {isOpen && searchTerm && filteredAreas.length > 0 && (
        <Box
          border="1px solid"
          borderColor="gray.200"
          borderRadius="md"
          bg="white"
          maxH="200px"
          overflowY="auto"
          boxShadow="md"
          position="absolute"
          zIndex={10}
          mt="40px"
          w="100%"
        >
          <Stack spacing={0}>
            {filteredAreas.slice(0, 10).map((area) => (
              <Box
                key={area}
                px={4}
                py={2}
                cursor="pointer"
                _hover={{ bg: 'gray.100' }}
                onClick={() => handleAddLocation(area)}
              >
                <Text fontSize="sm">{area}</Text>
              </Box>
            ))}
          </Stack>
        </Box>
      )}

      {locations.length > 0 && (
        <Wrap spacing={2}>
          {locations.map((location) => (
            <WrapItem key={location}>
              <Tag size="md" colorScheme="gray" borderRadius="full">
                <TagLabel>{location}</TagLabel>
                <TagCloseButton onClick={() => handleRemoveLocation(location)} />
              </Tag>
            </WrapItem>
          ))}
        </Wrap>
      )}

      {locations.length === 0 && (
        <Text fontSize="sm" color="gray.500">
          No target locations selected. Start typing to search UK areas.
        </Text>
      )}
    </Stack>
  )
}

type FieldRowProps = {
  label: string
  children: ReactNode
  editable?: boolean
  onEdit?: () => void
  isEditing?: boolean
}

function FieldRow({ label, children, editable, onEdit, isEditing }: FieldRowProps) {
  return (
    <Box
      p={4}
      borderRadius="lg"
      border="1px solid"
      borderColor="gray.100"
      bg="gray.50"
      _hover={{ borderColor: 'gray.200', bg: 'white' }}
      transition="all 0.2s"
    >
      <Stack spacing={3}>
      <HStack justify="space-between" align="center">
          <Text fontSize="sm" fontWeight="semibold" color="gray.700" letterSpacing="0.02em">
          {label}
        </Text>
        {editable && !isEditing && onEdit && (
          <IconButton
            aria-label={`Edit ${label}`}
            icon={<EditIcon />}
              size="sm"
            variant="ghost"
            colorScheme="gray"
            onClick={onEdit}
          />
        )}
      </HStack>
        <Box fontSize="md" color="gray.800" fontWeight="normal">
          {children}
        </Box>
    </Stack>
    </Box>
  )
}

// Editable Field Component
type EditableFieldProps = {
  value: string | number
  onSave: (value: string | number) => void
  onCancel: () => void
  isEditing: boolean
  onEdit: () => void
  label: string
  type?: 'text' | 'number' | 'textarea' | 'date' | 'url'
  placeholder?: string
  renderDisplay?: (value: string | number) => ReactNode
}

function EditableField({
  value,
  onSave,
  onCancel,
  isEditing,
  onEdit,
  label,
  type = 'text',
  placeholder,
  renderDisplay,
}: EditableFieldProps) {
  const [editValue, setEditValue] = useState<string>(String(value))

  useEffect(() => {
    setEditValue(String(value))
  }, [value, isEditing])

  const handleSave = () => {
    if (type === 'number') {
      onSave(Number(editValue) || 0)
    } else {
      onSave(editValue)
    }
  }

  const handleCancel = () => {
    setEditValue(String(value))
    onCancel()
  }

  if (!isEditing) {
    return (
      <FieldRow label={label} editable onEdit={onEdit}>
        <HStack spacing={2} align="center">
          <Box flex="1">
            {renderDisplay ? renderDisplay(value) : <Text>{value || placeholder || 'Not set'}</Text>}
          </Box>
        </HStack>
      </FieldRow>
    )
  }

  return (
    <FieldRow label={label} isEditing={isEditing}>
      <Stack spacing={2}>
        {type === 'textarea' ? (
          <Box
            as="textarea"
            value={editValue}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setEditValue(e.target.value)}
            placeholder={placeholder}
            rows={4}
            p={2}
            border="1px solid"
            borderColor="gray.300"
            borderRadius="md"
            fontSize="sm"
            resize="vertical"
          />
        ) : type === 'date' ? (
          <Input
            type="date"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            size="sm"
          />
        ) : type === 'url' ? (
          <Input
            type="url"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            placeholder={placeholder}
            size="sm"
          />
        ) : (
          <Input
            type={type}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            placeholder={placeholder}
            size="sm"
          />
        )}
        <HStack spacing={2}>
          <Button
            size="xs"
            colorScheme="gray"
            leftIcon={<CheckIcon />}
            onClick={handleSave}
          >
            Save
          </Button>
          <Button
            size="xs"
            variant="ghost"
            leftIcon={<CloseIcon />}
            onClick={handleCancel}
          >
            Cancel
          </Button>
        </HStack>
      </Stack>
    </FieldRow>
  )
}

// Shared target titles list (persists across accounts)
let sharedTargetTitles: string[] = [
  'Facilities & sustainability directors',
  'High-net-worth buyers',
  'Parents & adult aligner seekers',
  'Marketing Directors',
  'CEOs',
  'CFOs',
]

// Notes Section Component
type NotesSectionProps = {
  account: Account
  updateAccount: (accountName: string, updates: Partial<Account>) => void
  toast: ReturnType<typeof useToast>
}

type CalendarEvent = {
  id: string
  title: string
  date: string
  time: string
  account?: string
  type: 'meeting' | 'call' | 'follow-up' | 'deadline'
}

type CalendarSectionProps = {
  account: Account
}

type UpcomingEventsSectionProps = {
  account: Account
}

function UpcomingEventsSection({ account }: UpcomingEventsSectionProps) {
  const [events, setEvents] = useState<CalendarEvent[]>([])

  // Initialize with some sample events for demo
  useEffect(() => {
    const today = new Date()
    const sampleEvents: CalendarEvent[] = [
      {
        id: '1',
        title: 'Quarterly Review Meeting',
        date: today.toISOString().split('T')[0],
        time: '10:00',
        account: account.name,
        type: 'meeting',
      },
      {
        id: '2',
        title: 'Follow-up Call',
        date: new Date(today.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        time: '14:30',
        account: account.name,
        type: 'call',
      },
      {
        id: '3',
        title: 'Contract Renewal Deadline',
        date: new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        time: '17:00',
        account: account.name,
        type: 'deadline',
      },
    ]
    setEvents(sampleEvents)
  }, [account.name])

  const getEventTypeColor = (type: CalendarEvent['type']) => {
    switch (type) {
      case 'meeting':
        return 'blue'
      case 'call':
        return 'green'
      case 'follow-up':
        return 'orange'
      case 'deadline':
        return 'red'
      default:
        return 'gray'
    }
  }

  return (
    <Box
      p={4}
      border="1px solid"
      borderColor="gray.200"
      borderRadius="lg"
      bg="white"
    >
      <Heading size="sm" mb={3}>
        Upcoming Events
      </Heading>
      {events.length === 0 ? (
        <Text fontSize="sm" color="gray.500" fontStyle="italic">
          No upcoming events. Events will sync from Outlook calendar.
        </Text>
      ) : (
        <Stack spacing={2}>
          {events
            .sort((a, b) => {
              const dateA = new Date(`${a.date}T${a.time}`)
              const dateB = new Date(`${b.date}T${b.time}`)
              return dateA.getTime() - dateB.getTime()
            })
            .map((event) => (
              <HStack
                key={event.id}
                p={2}
                border="1px solid"
                borderColor="gray.200"
                borderRadius="md"
                _hover={{ bg: 'gray.50' }}
              >
                <Box
                  w={2}
                  h={8}
                  bg={`${getEventTypeColor(event.type)}.400`}
                  borderRadius="sm"
                />
                <Stack spacing={0} flex={1}>
                  <Text fontSize="sm" fontWeight="medium">
                    {event.title}
                  </Text>
                  <Text fontSize="xs" color="gray.600">
                    {new Date(event.date).toLocaleDateString('en-GB', {
                      day: 'numeric',
                      month: 'short',
                    })}{' '}
                    at {event.time}
                  </Text>
                </Stack>
                <Badge colorScheme={getEventTypeColor(event.type)} size="sm">
                  {event.type}
                </Badge>
              </HStack>
            ))}
        </Stack>
      )}
    </Box>
  )
}

function CalendarSection({ account }: CalendarSectionProps) {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [events, setEvents] = useState<CalendarEvent[]>([])

  // Initialize with some sample events for demo
  useEffect(() => {
    const today = new Date()
    const sampleEvents: CalendarEvent[] = [
      {
        id: '1',
        title: 'Quarterly Review Meeting',
        date: today.toISOString().split('T')[0],
        time: '10:00',
        account: account.name,
        type: 'meeting',
      },
      {
        id: '2',
        title: 'Follow-up Call',
        date: new Date(today.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        time: '14:30',
        account: account.name,
        type: 'call',
      },
      {
        id: '3',
        title: 'Contract Renewal Deadline',
        date: new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        time: '17:00',
        account: account.name,
        type: 'deadline',
      },
    ]
    setEvents(sampleEvents)
  }, [account.name])

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear()
    const month = date.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const daysInMonth = lastDay.getDate()
    const startingDayOfWeek = firstDay.getDay()

    const days: (Date | null)[] = []
    
    // Add empty cells for days before the first day of the month
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null)
    }
    
    // Add all days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(year, month, day))
    }
    
    return days
  }

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentDate((prev) => {
      const newDate = new Date(prev)
      if (direction === 'prev') {
        newDate.setMonth(prev.getMonth() - 1)
      } else {
        newDate.setMonth(prev.getMonth() + 1)
      }
      return newDate
    })
  }

  const getEventsForDate = (date: Date | null): CalendarEvent[] => {
    if (!date) return []
    const dateStr = date.toISOString().split('T')[0]
    return events.filter((event) => event.date === dateStr)
  }

  const getEventTypeColor = (type: CalendarEvent['type']) => {
    switch (type) {
      case 'meeting':
        return 'blue'
      case 'call':
        return 'green'
      case 'follow-up':
        return 'orange'
      case 'deadline':
        return 'red'
      default:
        return 'gray'
    }
  }

  const isToday = (date: Date | null) => {
    if (!date) return false
    const today = new Date()
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    )
  }

  const isSelected = (date: Date | null) => {
    if (!date || !selectedDate) return false
    return (
      date.getDate() === selectedDate.getDate() &&
      date.getMonth() === selectedDate.getMonth() &&
      date.getFullYear() === selectedDate.getFullYear()
    )
  }

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ]

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const days = getDaysInMonth(currentDate)
  const selectedDateEvents = selectedDate ? getEventsForDate(selectedDate) : []

  return (
    <Stack spacing={4}>
      <HStack justify="space-between" align="center" mb={2}>
        <HStack spacing={2}>
          <Icon as={MdCalendarToday} boxSize={5} color="text.muted" />
          <Heading size="sm">Calendar</Heading>
        </HStack>
        <Badge colorScheme="gray" fontSize="xs">
          Outlook Integration Coming Soon
        </Badge>
      </HStack>

      {/* Calendar Navigation */}
      <Box
        p={4}
        border="1px solid"
        borderColor="gray.200"
        borderRadius="lg"
        bg="white"
      >
        <HStack justify="space-between" align="center" mb={4}>
          <IconButton
            aria-label="Previous month"
            icon={<MdChevronLeft />}
            size="sm"
            variant="ghost"
            onClick={() => navigateMonth('prev')}
          />
          <Heading size="md">
            {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
          </Heading>
          <IconButton
            aria-label="Next month"
            icon={<MdChevronRight />}
            size="sm"
            variant="ghost"
            onClick={() => navigateMonth('next')}
          />
        </HStack>

        {/* Calendar Grid */}
        <SimpleGrid columns={7} gap={1}>
          {/* Day headers */}
          {dayNames.map((day) => (
            <Box
              key={day}
              textAlign="center"
              py={2}
              fontWeight="semibold"
              fontSize="xs"
              color="gray.600"
            >
              {day}
            </Box>
          ))}

          {/* Calendar days */}
          {days.map((day, index) => {
            const dayEvents = getEventsForDate(day)
            const isCurrentDay = isToday(day)
            const isSelectedDay = isSelected(day)

            return (
              <Box
                key={index}
                minH="60px"
                p={1}
                border="1px solid"
                borderColor={isCurrentDay ? 'teal.400' : isSelectedDay ? 'teal.300' : 'gray.200'}
                borderRadius="md"
                bg={
                  isCurrentDay
                    ? 'teal.50'
                    : isSelectedDay
                      ? 'teal.100'
                      : day
                        ? 'white'
                        : 'gray.50'
                }
                cursor={day ? 'pointer' : 'default'}
                onClick={() => day && setSelectedDate(day)}
                _hover={day ? { bg: 'gray.50', borderColor: 'teal.200' } : {}}
                position="relative"
              >
                {day && (
                  <>
                    <Text
                      fontSize="sm"
                      fontWeight={isCurrentDay ? 'bold' : 'normal'}
                      color={isCurrentDay ? 'teal.700' : 'gray.700'}
                      mb={1}
                    >
                      {day.getDate()}
                    </Text>
                    {dayEvents.length > 0 && (
                      <Stack spacing={0.5}>
                        {dayEvents.slice(0, 2).map((event) => (
                          <Box
                            key={event.id}
                            bg={`${getEventTypeColor(event.type)}.200`}
                            borderRadius="sm"
                            px={1}
                            py={0.5}
                            fontSize="xs"
                            fontWeight="medium"
                            color={`${getEventTypeColor(event.type)}.800`}
                            title={event.title}
                            overflow="hidden"
                            textOverflow="ellipsis"
                            whiteSpace="nowrap"
                          >
                            {event.time} {event.title.substring(0, 8)}
                          </Box>
                        ))}
                        {dayEvents.length > 2 && (
                          <Text fontSize="xs" color="gray.500" fontWeight="medium">
                            +{dayEvents.length - 2} more
                          </Text>
                        )}
                      </Stack>
                    )}
                  </>
                )}
              </Box>
            )
          })}
        </SimpleGrid>
      </Box>

      {/* Selected Date Events */}
      {selectedDate && (
        <Box
          p={4}
          border="1px solid"
          borderColor="teal.200"
          borderRadius="lg"
          bg="teal.50"
        >
          <HStack spacing={2} mb={3}>
            <Icon as={MdEvent} boxSize={4} color="text.muted" />
            <Heading size="sm">
              {selectedDate.toLocaleDateString('en-GB', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </Heading>
          </HStack>

          {selectedDateEvents.length === 0 ? (
            <Text fontSize="sm" color="gray.600" fontStyle="italic">
              No events scheduled for this date
            </Text>
          ) : (
            <Stack spacing={2}>
              {selectedDateEvents.map((event) => (
                <Box
                  key={event.id}
                  p={3}
                  bg="white"
                  borderRadius="md"
                  border="1px solid"
                  borderColor="gray.200"
                >
                  <HStack justify="space-between" align="flex-start">
                    <Stack spacing={1} flex={1}>
                      <HStack spacing={2}>
                        <Badge colorScheme={getEventTypeColor(event.type)} size="sm">
                          {event.type}
                        </Badge>
                        <Text fontSize="sm" fontWeight="semibold">
                          {event.title}
                        </Text>
                      </HStack>
                      <Text fontSize="xs" color="gray.600">
                        {event.time} • {account.name}
                      </Text>
                    </Stack>
                  </HStack>
                </Box>
              ))}
            </Stack>
          )}
        </Box>
      )}
    </Stack>
  )
}

function NotesSection({ account, updateAccount, toast }: NotesSectionProps) {
  const [noteContent, setNoteContent] = useState('')
  const [noteUser, setNoteUser] = useState('')

  // Load user name from localStorage when account changes
  useEffect(() => {
    const noteUserKey = `note_user_${account.name}`
    const savedUser = getItem(noteUserKey) || ''
    setNoteUser(savedUser)
  }, [account.name])

  // Save user name to localStorage when it changes (debounced)
  useEffect(() => {
    if (noteUser) {
      const noteUserKey = `note_user_${account.name}`
      setItem(noteUserKey, noteUser)
    }
  }, [noteUser, account.name])

  const handleAddNote = () => {
    if (noteContent.trim()) {
      const newNote: AccountNote = {
        id: Date.now().toString(),
        content: noteContent.trim(),
        user: noteUser || 'Anonymous',
        timestamp: new Date().toISOString(),
      }
      
      const currentNotes = account.notes || []
      const updatedNotes = [newNote, ...currentNotes]
      
      updateAccount(account.name, { notes: updatedNotes })
      
      // Clear input
      setNoteContent('')
      
      toast({
        title: 'Note added',
        status: 'success',
        duration: 2000,
        isClosable: true,
      })
    }
  }

  return (
    <Stack spacing={4}>
      {/* Add new note form */}
      <Box
        p={4}
        border="1px solid"
        borderColor="gray.200"
        borderRadius="md"
        bg="gray.50"
      >
        <Stack spacing={3}>
          <HStack spacing={2}>
            <Input
              placeholder="Enter your name"
              size="sm"
              value={noteUser}
              onChange={(e) => setNoteUser(e.target.value)}
              maxW="200px"
            />
            <Text fontSize="xs" color="gray.500">
              (saved locally)
            </Text>
          </HStack>
          <Textarea
            placeholder="Add a note..."
            size="sm"
            rows={3}
            value={noteContent}
            onChange={(e) => setNoteContent(e.target.value)}
          />
          <Button
            size="sm"
            colorScheme="gray"
            leftIcon={<CheckIcon />}
            onClick={handleAddNote}
          >
            Add Note
          </Button>
        </Stack>
      </Box>

      {/* Display existing notes */}
      <Stack spacing={3}>
        {(account.notes || []).length === 0 ? (
          <Text fontSize="sm" color="gray.500" fontStyle="italic">
            No notes yet. Add your first note above.
          </Text>
        ) : (
          (account.notes || []).map((note) => (
            <Box
              key={note.id}
              p={3}
              border="1px solid"
              borderColor="gray.200"
              borderRadius="md"
              bg="white"
            >
              <Stack spacing={2}>
                <HStack justify="space-between" align="flex-start">
                  <Text fontSize="sm" fontWeight="medium" color="gray.700">
                    {note.content}
                  </Text>
                  <IconButton
                    aria-label="Delete note"
                    icon={<DeleteIcon />}
                    size="xs"
                    variant="ghost"
                    colorScheme="gray"
                    onClick={() => {
                      const currentNotes = account.notes || []
                      const updatedNotes = currentNotes.filter((n) => n.id !== note.id)
                      updateAccount(account.name, { notes: updatedNotes })
                      toast({
                        title: 'Note deleted',
                        status: 'success',
                        duration: 2000,
                        isClosable: true,
                      })
                    }}
                  />
                </HStack>
                <HStack spacing={2} fontSize="xs" color="gray.500">
                  {account.users.some(u => u.name === note.user) ? (
                    <Link
                      fontWeight="medium"
                      color="text.muted"
                      _hover={{ textDecoration: 'underline' }}
                      onClick={() => {
                        const user = account.users.find(u => u.name === note.user)
                        if (user) {
                          toast({
                            title: `${user.name}`,
                            description: `Role: ${user.role}`,
                            status: 'info',
                            duration: 3000,
                            isClosable: true,
                          })
                        }
                      }}
                    >
                      {note.user}
                    </Link>
                  ) : (
                    <Text fontWeight="medium">{note.user}</Text>
                  )}
                  <Text>•</Text>
                  <Text>
                    {new Date(note.timestamp).toLocaleString('en-GB', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </Text>
                </HStack>
              </Stack>
            </Box>
          ))
        )}
      </Stack>
    </Stack>
  )
}

type AccountsTabProps = {
  focusAccountName?: string
  /** When provided, these accounts are used as the source of truth (from DB) */
  dbAccounts?: Account[]
  /** Data source indicator for debug display */
  dataSource?: 'DB' | 'CACHE'
}

/**
 * Derive a canonical customerId (cust_...) for API calls like /api/customers/:customerId/email-identities
 * 
 * Priority order:
 * 1. account.customerId (explicit field if present)
 * 2. account.id only if it's a cust_... string
 * 3. account._databaseId (legacy backup field)
 * 4. dbAccounts lookup by stable identifier (_databaseId match)
 * 5. LAST RESORT: dbAccounts lookup by normalized name (with duplicate safety)
 * 
 * Returns { customerId, source } where source is used for dev logging
 */
function deriveCustomerId(
  account: Account,
  accountName: string,
  dbAccounts?: Account[]
): { customerId: string | null; source: string } {
  // 1. Explicit customerId field (highest priority)
  const explicitCustomerId = (account as { customerId?: string }).customerId
  if (explicitCustomerId && typeof explicitCustomerId === 'string' && explicitCustomerId.startsWith('cust_')) {
    return { customerId: explicitCustomerId, source: 'customerId' }
  }

  // 2. account.id only if it's a canonical cust_... id
  if (account.id && typeof account.id === 'string' && account.id.startsWith('cust_')) {
    return { customerId: account.id, source: 'id(cust_)' }
  }

  // 3. Legacy _databaseId field
  if (account._databaseId && typeof account._databaseId === 'string' && account._databaseId.startsWith('cust_')) {
    return { customerId: account._databaseId, source: '_databaseId' }
  }

  // 4 & 5. Fallback to dbAccounts lookup
  if (!dbAccounts || dbAccounts.length === 0) {
    return { customerId: null, source: 'no_dbAccounts' }
  }

  // 4. Try stable identifier match first (by _databaseId)
  if (account._databaseId) {
    const dbMatch = dbAccounts.find((db) => db._databaseId === account._databaseId || db.id === account._databaseId)
    if (dbMatch?.id && dbMatch.id.startsWith('cust_')) {
      return { customerId: dbMatch.id, source: 'dbLookupStable' }
    }
  }

  // 5. LAST RESORT: Name matching with normalization and duplicate safety
  const normalizedName = accountName.trim().toLowerCase()
  const nameMatches = dbAccounts.filter((db) => db.name.trim().toLowerCase() === normalizedName)
  
  if (nameMatches.length === 0) {
    return { customerId: null, source: 'dbLookupName_noMatch' }
  }
  
  if (nameMatches.length > 1) {
    // Multiple matches - unsafe to pick arbitrarily
    if (import.meta.env.DEV) {
      console.warn(`[deriveCustomerId] Multiple dbAccounts match name "${accountName}" (${nameMatches.length} matches) - not picking arbitrarily`)
    }
    return { customerId: null, source: 'dbLookupName_duplicates' }
  }
  
  // Exactly one match
  const match = nameMatches[0]
  if (match.id && match.id.startsWith('cust_')) {
    return { customerId: match.id, source: 'dbLookupName' }
  }
  
  return { customerId: null, source: 'dbLookupName_invalidId' }
}

function AccountsTab({ focusAccountName, dbAccounts, dataSource = 'CACHE' }: AccountsTabProps) {
  const toast = useToast()
  const { isOpen: isCreateModalOpen, onOpen: onCreateModalOpen, onClose: onCreateModalClose } = useDisclosure()
  const { isOpen: isDeleteModalOpen, onOpen: onDeleteModalOpen, onClose: onDeleteModalClose } = useDisclosure()
  const hasSyncedCustomersRef = useRef(false)
  const hasHydratedFromServerRef = useRef(false)
  const isServerSourceOfTruth = true
  const syncInFlightRef = useRef(false)
  const pendingSyncRef = useRef(false)
  const lastSyncedHashRef = useRef<string | null>(null)
  const latestAccountsRef = useRef<Account[]>([])
  const hasAutoEnrichedRef = useRef(false)
  const [newAccountForm, setNewAccountForm] = useState<Partial<Account>>({
    name: '',
    website: '',
    status: 'Active',
    sector: '',
    targetLocation: [],
    targetTitle: '',
    monthlySpendGBP: 0,
    defcon: 3,
    days: 1,
    contacts: 0,
    leads: 0,
    weeklyTarget: 0,
    weeklyActual: 0,
    monthlyTarget: 0,
    monthlyActual: 0,
    weeklyReport: '',
    clientLeadsSheetUrl: '',
    aboutSections: { ...DEFAULT_ABOUT_SECTIONS },
    socialMedia: [],
    agreements: [],
    users: [],
  })

  // Load deleted accounts to prevent re-adding them
  const [deletedAccounts, setDeletedAccounts] = useState<Set<string>>(() => loadDeletedAccountsFromStorage())
  
  // Column widths state for resizable columns
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() => {
    const stored = getItem('odcrm_accounts_column_widths')
    if (stored) {
      try {
        return JSON.parse(stored)
      } catch {
        return {}
      }
    }
    return {
      account: 250,
      status: 100,
      sector: 150,
      spend: 120,
      weeklyLeads: 100,
      monthlyLeads: 100,
      weeklyTarget: 120,
      monthlyTarget: 120,
      percentToTarget: 120,
      defcon: 100,
    }
  })
  
  // Resizing state
  const [resizingColumn, setResizingColumn] = useState<string | null>(null)
  const [resizeStartX, setResizeStartX] = useState(0)
  const [resizeStartWidth, setResizeStartWidth] = useState(0)
  
  // Inline editing state
  const [editingCell, setEditingCell] = useState<{ accountName: string; field: string } | null>(null)
  const [editValue, setEditValue] = useState<string>('')
  
  // Sorting state
  const [sortColumn, setSortColumn] = useState<string | null>('spend')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')
  
  // Leads section state - load ONCE via useState initializer, not on every render
  const [leads, setLeads] = useState<Lead[]>(() => {
    const cached = loadLeadsFromStorage()
    return cached
  })
  const [leadsLoading, setLeadsLoading] = useState(() => {
    const cached = loadLeadsFromStorage()
    return cached.length === 0
  })
  const [leadsError, setLeadsError] = useState<string | null>(null)
  const [leadsLastRefresh, setLeadsLastRefresh] = useState<Date>(() => {
    const stored = getItem(OdcrmStorageKeys.leadsLastRefresh)
    if (!stored) return new Date()
    const d = new Date(stored)
    return isNaN(d.getTime()) ? new Date() : d
  })
  const [leadsFilter, setLeadsFilter] = useState<string>('')
  
  // Save column widths to localStorage
  useEffect(() => {
    setItem('odcrm_accounts_column_widths', JSON.stringify(columnWidths))
  }, [columnWidths])
  
  // Handle column resize
  const handleResizeStart = (column: string, startX: number) => {
    setResizingColumn(column)
    setResizeStartX(startX)
    setResizeStartWidth(columnWidths[column] || 150)
  }
  
  // Add resize listeners
  useEffect(() => {
    if (!resizingColumn) return
    
    const handleMouseMove = (e: MouseEvent) => {
      if (resizingColumn) {
        const diff = e.clientX - resizeStartX
        const newWidth = Math.max(50, resizeStartWidth + diff)
        setColumnWidths(prev => ({ ...prev, [resizingColumn]: newWidth }))
      }
    }
    
    const handleMouseUp = () => {
      setResizingColumn(null)
    }
    
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [resizingColumn, resizeStartX, resizeStartWidth])
  
  // Handle inline edit
  const handleCellEdit = (accountName: string, field: string, currentValue: number | string) => {
    setEditingCell({ accountName, field })
    setEditValue(String(currentValue))
  }
  
  const handleCellCancel = () => {
    setEditingCell(null)
    setEditValue('')
  }
  
  // Seed contacts (from screenshots) only if the user has no contacts saved yet.
  useEffect(() => {
    seedContactsIfEmpty()
    setContactsData(loadContactsFromStorage())
  }, [])

  // Load initial data: prefer dbAccounts prop (from DB), fallback to localStorage
  const [accountsData, setAccountsData] = useState<Account[]>(() => {
    // If DB accounts provided, use them as source of truth
    if (dbAccounts && dbAccounts.length > 0) {
      console.log('[AccountsTab] Initializing from DB accounts:', dbAccounts.length)
      return dbAccounts
    }
    // Fallback to localStorage (legacy path)
    const loaded = loadAccountsFromStorage()
    const deletedAccountsSet = loadDeletedAccountsFromStorage()
    console.log('[AccountsTab] Initializing from localStorage:', loaded.length)
    return loaded.filter(acc => !deletedAccountsSet.has(acc.name))
  })
  
  // Sync accountsData when dbAccounts prop changes (DB refresh)
  useEffect(() => {
    if (dbAccounts && dbAccounts.length > 0) {
      console.log('[AccountsTab] DB accounts updated, syncing:', dbAccounts.length)
      setAccountsData(dbAccounts)
    }
  }, [dbAccounts])

  useEffect(() => {
    if (!isStorageAvailable()) return
    if (!accountsData || accountsData.length === 0) return
    if (getItem(STORAGE_KEY_GOOGLE_SHEETS_CLEARED)) return

    const hasSheets = accountsData.some((account) => Boolean(account.clientLeadsSheetUrl))
    setItem(STORAGE_KEY_GOOGLE_SHEETS_CLEARED, 'true')
    if (!hasSheets) return

    const cleared = accountsData.map((account) =>
      account.clientLeadsSheetUrl ? { ...account, clientLeadsSheetUrl: '' } : account,
    )
    setAccountsData(cleared)
    saveAccountsToStorage(cleared)
    emit('accountsUpdated', cleared)
  }, [accountsData])

  // DISABLED: Auto-backup and autosave effect
  // This was causing localStorage write storms and backup key proliferation.
  // Individual update functions (updateAccount, handleCreateAccount, etc.) already save.
  // DO NOT re-enable automatic backups during hydration.
  const accountsLastSavedJsonRef = useRef<string>('')

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY_ACCOUNTS && e.key !== STORAGE_KEY_ACCOUNTS_LAST_UPDATED) return
      if (!hasHydratedFromServerRef.current) return

      // CRITICAL: Only use stored data, never merge with defaults
      // This prevents old accounts from coming back
      const loaded = loadAccountsFromStorage()
      if (loaded && Array.isArray(loaded) && loaded.length > 0) {
        const deletedAccountsSet = loadDeletedAccountsFromStorage()
        setAccountsData(loaded.filter(acc => !deletedAccountsSet.has(acc.name)))
      }
    }

    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  useEffect(() => {
    latestAccountsRef.current = accountsData
  }, [accountsData])

  useEffect(() => {
    if (!hasSyncedCustomersRef.current) return
    if (!hasHydratedFromServerRef.current) return
    if (!isStorageAvailable()) return
    const syncVersion = 'v2-account-data'
    const storedVersion = getItem(OdcrmStorageKeys.accountsBackendSyncVersion)
    if (storedVersion !== syncVersion) {
      setItem(OdcrmStorageKeys.accountsBackendSyncHash, '')
      setItem(OdcrmStorageKeys.accountsBackendSyncVersion, syncVersion)
      lastSyncedHashRef.current = null
    }
    if (lastSyncedHashRef.current === null) {
      lastSyncedHashRef.current = getItem(OdcrmStorageKeys.accountsBackendSyncHash) || null
    }

    const nextHash = computeAccountsSyncHash(accountsData)
    if (nextHash === lastSyncedHashRef.current) return

    const syncAccountsToBackend = async (accountsToSync: Account[], hash: string) => {
      if (syncInFlightRef.current) {
        pendingSyncRef.current = true
        return
      }
      syncInFlightRef.current = true
      let needsLeadsRefresh = false

      try {
        const { data, error } = await api.get<CustomerApi[]>('/api/customers')
        if (error || !data) return

        for (const account of accountsToSync) {
          const payload = buildCustomerPayloadFromAccount(account)
          if (!hasSyncableCustomerFields(payload)) continue

          const customer = findCustomerForAccount(account, data)
          if (customer) {
            const updates = diffCustomerPayload(customer, payload)
            if (Object.keys(updates).length > 0) {
              if ('leadsReportingUrl' in updates) {
                needsLeadsRefresh = true
              }
              await api.put(`/api/customers/${customer.id}`, { ...updates, name: payload.name })
            }
          } else {
            if (payload.leadsReportingUrl !== undefined) {
              needsLeadsRefresh = true
            }
            await api.post('/api/customers', payload)
          }
        }

        setItem(OdcrmStorageKeys.accountsBackendSyncHash, hash)
        lastSyncedHashRef.current = hash
        if (needsLeadsRefresh) {
          emit('accountsUpdated', accountsToSync)
        }
      } catch (err) {
        console.warn('Failed to sync accounts to backend:', err)
      } finally {
        syncInFlightRef.current = false
        if (pendingSyncRef.current) {
          pendingSyncRef.current = false
          const latest = latestAccountsRef.current
          const latestHash = computeAccountsSyncHash(latest)
          if (latestHash !== lastSyncedHashRef.current) {
            void syncAccountsToBackend(latest, latestHash)
          }
        }
      }
    }

    const timer = window.setTimeout(() => {
      void syncAccountsToBackend(accountsData, nextHash)
    }, 1200)

    return () => window.clearTimeout(timer)
  }, [accountsData])

  const [targetTitlesList, setTargetTitlesList] = useState<string[]>(sharedTargetTitles)
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null)
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null)
  
  // Stable customer ID for email identity fetching (prevents render loops)
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null)
  
  // Connected email identities for the selected account
  const [connectedEmails, setConnectedEmails] = useState<ConnectedEmailIdentity[]>([])
  const [loadingEmails, setLoadingEmails] = useState(false)
  const [emailFetchError, setEmailFetchError] = useState<string | null>(null)
  const [contactsData, setContactsData] = useState<StoredContact[]>(() => loadContactsFromStorage())

  // Sync contact counts when contactsData changes (initial load and updates)
  // Note: contactsData already excludes deleted contacts since loadContactsFromStorage filters them
  useEffect(() => {
    if (contactsData.length === 0 && accountsData.length === 0) return // Wait for data to load
    
    // Double-check: filter out any deleted contacts that might have slipped through
    const deletedContactsSet = loadDeletedContactsFromStorage()
    const activeContacts = contactsData.filter(c => !deletedContactsSet.has(c.id || ''))
    
    setAccountsData((prevAccounts) => {
      const updated = prevAccounts.map((account) => {
        const contactCount = activeContacts.filter((contact) => 
          (contact.accounts || []).some((acc: string) => acc === account.name)
        ).length
        if (account.contacts !== contactCount) {
          return { ...account, contacts: contactCount }
        }
        return account
      })
      
      const hasChanges = updated.some((acc, idx) => acc.contacts !== prevAccounts[idx].contacts)
      if (hasChanges) {
        saveAccountsToStorage(updated)
        console.log('✅ Synced contact counts with accounts (excluding deleted contacts)')
        return updated
      }
      return prevAccounts
    })
  }, [accountsData.length, contactsData]) // Sync whenever contacts change
  const [expandedAbout, setExpandedAbout] = useState<Record<string, boolean>>({})
  const [sectorsMap, setSectorsMap] = useState<Record<string, string>>(() => {
    const stored = loadSectorsFromStorage()
    const loadedAccounts = loadAccountsFromStorage()
    const deletedAccountsSet = loadDeletedAccountsFromStorage()
    // Merge with account defaults, excluding deleted accounts
    const merged: Record<string, string> = {}
    const allAccounts = [...loadedAccounts, ...accounts.filter(a => 
      !loadedAccounts.some(la => la.name === a.name) && !deletedAccountsSet.has(a.name)
    )]
    allAccounts.forEach(account => {
      merged[account.name] = stored[account.name] || account.sector
    })
    return merged
  })
  const [targetLocationsMap, setTargetLocationsMap] = useState<Record<string, string[]>>(() => {
    const stored = loadTargetLocationsFromStorage()
    const loadedAccounts = loadAccountsFromStorage()
    const deletedAccountsSet = loadDeletedAccountsFromStorage()
    // Merge with account defaults, excluding deleted accounts
    const merged: Record<string, string[]> = {}
    const allAccounts = [...loadedAccounts, ...accounts.filter(a => 
      !loadedAccounts.some(la => la.name === a.name) && !deletedAccountsSet.has(a.name)
    )]
    allAccounts.forEach(account => {
      merged[account.name] = stored[account.name] || account.targetLocation
    })
    return merged
  })
  const [editingFields, setEditingFields] = useState<Record<string, string>>({}) // Track which fields are being edited: { "accountName:fieldName": "value" }

  // Update accounts with actuals from marketing leads
  useEffect(() => {
    const leads = loadLeadsFromStorage()

    setAccountsData((prev) => {
      const updated = prev.map((account) => {
        if (leads.length === 0) {
          if ((account.weeklyActual || 0) !== 0 || (account.monthlyActual || 0) !== 0 || (account.leads || 0) !== 0) {
            return { ...account, weeklyActual: 0, monthlyActual: 0, leads: 0 }
          }
          return account
        }

        const actuals = calculateActualsFromLeads(account.name, leads)
        const leadCount = leads.filter((l) => l.accountName === account.name).length
        // Only update if values have changed to avoid unnecessary re-renders
        if (
          account.weeklyActual !== actuals.weeklyActual ||
          account.monthlyActual !== actuals.monthlyActual ||
          account.leads !== leadCount
        ) {
          return {
            ...account,
            weeklyActual: actuals.weeklyActual,
            monthlyActual: actuals.monthlyActual,
            leads: leadCount,
          }
        }
        return account
      })
      
      // Save to localStorage if any changes were made
      const hasChanges = updated.some((acc, idx) => 
        acc.weeklyActual !== prev[idx].weeklyActual ||
        acc.monthlyActual !== prev[idx].monthlyActual ||
        acc.leads !== prev[idx].leads
      )
      if (hasChanges) {
        saveAccountsToStorage(updated)
      }
      
      return updated
    })
  }, []) // Run once on mount

  // Listen for leads updates
  useEffect(() => {
    const handleLeadsUpdated = () => {
      const leads = loadLeadsFromStorage()

      setAccountsData((prev) => {
        const updated = prev.map((account) => {
          if (leads.length === 0) {
            if ((account.weeklyActual || 0) !== 0 || (account.monthlyActual || 0) !== 0 || (account.leads || 0) !== 0) {
              return { ...account, weeklyActual: 0, monthlyActual: 0, leads: 0 }
            }
            return account
          }

          const actuals = calculateActualsFromLeads(account.name, leads)
          const leadCount = leads.filter((l) => l.accountName === account.name).length
          if (
            account.weeklyActual !== actuals.weeklyActual ||
            account.monthlyActual !== actuals.monthlyActual ||
            account.leads !== leadCount
          ) {
            return {
              ...account,
              weeklyActual: actuals.weeklyActual,
              monthlyActual: actuals.monthlyActual,
              leads: leadCount,
            }
          }
          return account
        })
        
        const hasChanges = updated.some((acc, idx) => 
          acc.weeklyActual !== prev[idx].weeklyActual ||
          acc.monthlyActual !== prev[idx].monthlyActual ||
          acc.leads !== prev[idx].leads
        )
        if (hasChanges) {
          saveAccountsToStorage(updated)
          emit('accountsUpdated', updated)
          // Update selected account if it's open
          if (selectedAccount) {
            const updatedAccount = updated.find(a => a.name === selectedAccount.name)
            if (updatedAccount) {
              setSelectedAccount(updatedAccount)
            }
          }
        }
        
        return updated
      })
    }

    // Listen for custom event when leads are updated
    const off = on('leadsUpdated', () => handleLeadsUpdated())
    return () => off()
  }, [selectedAccount])

  // Sync selectedCustomerId when selectedAccount becomes null (drawer closed)
  // Main selection happens in handleAccountClick - this is just cleanup
  useEffect(() => {
    if (!selectedAccount) {
      setSelectedCustomerId(null)
    }
    // Note: We don't set selectedCustomerId here when account IS selected
    // That's handled directly in handleAccountClick to avoid loops
  }, [selectedAccount])

  // Fetch email identities when selectedCustomerId changes (stable dependency)
  useEffect(() => {
    // Clear state when no customer selected
    if (!selectedCustomerId) {
      setConnectedEmails([])
      setEmailFetchError(null)
      setLoadingEmails(false)
      return
    }

    // VALIDATION: customerId must be a cust_... string - DO NOT fetch with invalid ID
    if (!selectedCustomerId.startsWith('cust_')) {
      if (import.meta.env.DEV) {
        console.warn('[EmailAccounts] INVALID customerId (not cust_ prefixed):', selectedCustomerId)
      }
      setConnectedEmails([])
      setEmailFetchError(null)
      setLoadingEmails(false)
      return
    }

    // AbortController for cleanup
    const abortController = new AbortController()
    let isCancelled = false

    const fetchEmails = async () => {
      // Debug log (dev only)
      if (import.meta.env.DEV) {
        console.log('[EmailAccounts] Fetch START:', {
          customerId: selectedCustomerId,
          endpoint: `/api/customers/${selectedCustomerId}/email-identities`,
        })
      }
      
      setLoadingEmails(true)
      setEmailFetchError(null)
      
      try {
        const { data, error } = await api.get<ConnectedEmailIdentity[]>(
          `/api/customers/${selectedCustomerId}/email-identities`
        )
        
        // Check if request was cancelled
        if (isCancelled) {
          if (import.meta.env.DEV) {
            console.log('[EmailAccounts] Fetch CANCELLED for customerId:', selectedCustomerId)
          }
          return
        }
        
        if (error) {
          console.error('[EmailAccounts] Fetch ERROR:', error)
          setEmailFetchError(error)
          setConnectedEmails([])
        } else {
          setConnectedEmails(data || [])
        }
        
        if (import.meta.env.DEV) {
          console.log('[EmailAccounts] Fetch END:', {
            customerId: selectedCustomerId,
            responseLength: data?.length || 0,
            firstIdentityKeys: data?.[0] ? Object.keys(data[0]) : [],
            firstEmail: data?.[0]?.emailAddress || null,
          })
        }
      } catch (err) {
        if (!isCancelled) {
          const errorMsg = err instanceof Error ? err.message : 'Unknown error'
          console.error('[EmailAccounts] Fetch EXCEPTION:', errorMsg)
          setEmailFetchError(errorMsg)
          setConnectedEmails([])
        }
      } finally {
        if (!isCancelled) {
          setLoadingEmails(false)
        }
      }
    }

    void fetchEmails()

    // Cleanup: cancel in-flight request when customerId changes
    return () => {
      isCancelled = true
      abortController.abort()
      if (import.meta.env.DEV) {
        console.log('[EmailAccounts] Cleanup for customerId:', selectedCustomerId)
      }
    }
  }, [selectedCustomerId]) // ONLY depends on selectedCustomerId - no other dependencies!

  // Manual refresh function for the refresh button
  const refreshConnectedEmails = useCallback(() => {
    if (!selectedCustomerId) return
    
    // VALIDATION: Don't fetch with invalid customerId
    if (!selectedCustomerId.startsWith('cust_')) {
      if (import.meta.env.DEV) {
        console.warn('[EmailAccounts] Manual refresh BLOCKED - invalid customerId:', selectedCustomerId)
      }
      return
    }
    
    if (import.meta.env.DEV) {
      console.log('[EmailAccounts] Manual refresh for customerId:', selectedCustomerId)
    }
    
    // Trigger refetch by toggling a dummy state (or we can just call the API directly)
    setLoadingEmails(true)
    setEmailFetchError(null)
    
    api.get<ConnectedEmailIdentity[]>(`/api/customers/${selectedCustomerId}/email-identities`)
      .then(({ data, error }) => {
        if (error) {
          setEmailFetchError(error)
          setConnectedEmails([])
        } else {
          setConnectedEmails(data || [])
        }
      })
      .catch((err) => {
        setEmailFetchError(err instanceof Error ? err.message : 'Unknown error')
        setConnectedEmails([])
      })
      .finally(() => {
        setLoadingEmails(false)
      })
  }, [selectedCustomerId])

  // Handle OAuth success redirect (oauth=success in URL)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const oauthStatus = params.get('oauth')
    const oauthEmail = params.get('email')
    const rawOauthCustomerId = params.get('customerId')
    
    // Validate oauthCustomerId - must be a cust_ prefixed string from server
    const oauthCustomerId = rawOauthCustomerId?.startsWith('cust_') ? rawOauthCustomerId : null
    
    if (import.meta.env.DEV && rawOauthCustomerId && !oauthCustomerId) {
      console.warn('[OAuth] Invalid customerId from redirect (not cust_ prefixed):', rawOauthCustomerId)
    }
    
    if (oauthStatus === 'success' && oauthEmail) {
      toast({
        title: 'Outlook Connected',
        description: `Successfully connected ${oauthEmail}`,
        status: 'success',
        duration: 5000,
        isClosable: true,
      })
      
      // Refresh email identities - set the customerId to trigger refetch
      if (oauthCustomerId && oauthCustomerId === selectedCustomerId) {
        // Same customer - manually refresh
        refreshConnectedEmails()
      } else if (oauthCustomerId) {
        // Different customer - set it to trigger useEffect
        setSelectedCustomerId(oauthCustomerId)
      }
      
      // Clear query params from URL
      const url = new URL(window.location.href)
      url.searchParams.delete('oauth')
      url.searchParams.delete('email')
      url.searchParams.delete('customerId')
      window.history.replaceState({}, '', url.toString())
    }
  }, [toast, selectedCustomerId, refreshConnectedEmails])

  // Connect Outlook handler - ONLY when customer with DB id is selected
  const handleConnectOutlook = useCallback(() => {
    if (!selectedAccount) {
      toast({
        title: 'Select a customer first',
        description: 'You must select a customer before connecting an Outlook account.',
        status: 'error',
        duration: 5000,
        isClosable: true,
      })
      return
    }

    if (!selectedCustomerId) {
      toast({
        title: 'Cannot connect Outlook',
        description: 'This customer is not saved in the database yet. Please save it first.',
        status: 'error',
        duration: 5000,
        isClosable: true,
      })
      return
    }
    
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001'
    window.location.href = `${apiUrl}/api/outlook/auth?customerId=${selectedCustomerId}`
  }, [selectedAccount, selectedCustomerId, toast])

  const updateAccount = useCallback((accountName: string, updates: Partial<Account>) => {
    setAccountsData((prev) => {
      // Create backup before updating (critical data protection)
      try {
        const currentAccounts = loadAccountsFromStorage()
        if (currentAccounts && currentAccounts.length > 0) {
          const backupKey = `odcrm_accounts_backup_${Date.now()}`
          setJson(backupKey, currentAccounts)
          // Keep only last 5 backups
          const backupKeys = Object.keys(localStorage).filter(k => k.startsWith('odcrm_accounts_backup_')).sort()
          if (backupKeys.length > 5) {
            backupKeys.slice(0, backupKeys.length - 5).forEach(k => localStorage.removeItem(k))
          }
        }
      } catch (e) {
        console.warn('Failed to create backup before update:', e)
      }
      
      const updated = prev.map((acc) => (acc.name === accountName ? { ...acc, ...updates } : acc))
      // Save to localStorage
      saveAccountsToStorage(updated)
      // Dispatch event so LeadsTab can get updated accounts
      emit('accountsUpdated', updated)
      return updated
    })
    if (selectedAccount?.name === accountName) {
      setSelectedAccount((prev) => (prev ? { ...prev, ...updates } : null))
    }
    toast({
      title: 'Account updated',
      status: 'success',
      duration: 2000,
      isClosable: true,
    })
  }, [selectedAccount?.name, toast])

  const updateAccountSilent = useCallback((accountName: string, updates: Partial<Account>) => {
    setAccountsData((prev) => {
      const updated = prev.map((acc) => (acc.name === accountName ? { ...acc, ...updates } : acc))
      saveAccountsToStorage(updated)
      emit('accountsUpdated', updated)
      return updated
    })
    if (selectedAccount?.name === accountName) {
      setSelectedAccount((prev) => (prev ? { ...prev, ...updates } : null))
    }
  }, [selectedAccount?.name])

  // Auto-enrich existing accounts with verified web data (no AI).
  useEffect(() => {
    if (isServerSourceOfTruth) return
    if (hasAutoEnrichedRef.current) return
    if (!accountsData || accountsData.length === 0) return
    hasAutoEnrichedRef.current = true

    const sanitized = accountsData.map((account) => {
      if (account.aboutSource === 'web') return account
      return {
        ...account,
        aboutSections: { ...DEFAULT_ABOUT_SECTIONS },
        sector: '',
        socialMedia: [],
        logoUrl: account.logoUrl,
        aboutSource: undefined,
        aboutLocked: false,
      }
    })

    setAccountsData(sanitized)
    saveAccountsToStorage(sanitized)
    emit('accountsUpdated', sanitized)

    const run = async () => {
      for (const account of sanitized) {
        if (!account.website) continue
        const populated = await populateAccountData(account)
        if (populated.aboutSource === 'web') {
          updateAccountSilent(account.name, populated)
        }
      }
    }

    void run()
  }, [accountsData, isServerSourceOfTruth, updateAccountSilent])
  
  // Handle inline edit save (defined after updateAccount)
  const handleCellSave = () => {
    if (!editingCell) return
    
    const account = accountsData.find(a => a.name === editingCell.accountName)
    if (!account) return
    
    const numValue = parseFloat(editValue)
    
    // Validate numeric input - reject NaN or invalid numbers
    if (isNaN(numValue)) {
      toast({
        title: 'Invalid value',
        description: 'Please enter a valid number',
        status: 'error',
        duration: 3000,
        isClosable: true,
      })
      return
    }
    
    const updates: Partial<Account> = {}
    
    if (editingCell.field === 'spend') {
      updates.monthlySpendGBP = numValue
    } else if (editingCell.field === 'weeklyTarget') {
      updates.weeklyTarget = numValue
    } else if (editingCell.field === 'monthlyTarget') {
      updates.monthlyTarget = numValue
    } else if (editingCell.field === 'defcon') {
      updates.defcon = Math.max(1, Math.min(5, Math.round(numValue))) // Clamp between 1 and 5
    }
    
    updateAccount(editingCell.accountName, updates)
    setEditingCell(null)
    setEditValue('')
  }

  // Refresh company data from web search
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [refreshingAccounts, setRefreshingAccounts] = useState<Set<string>>(new Set())
  
  const handleRefreshCompanyData = async (accountName?: string) => {
    const accountToRefresh = accountName 
      ? accountsData.find(acc => acc.name === accountName)
      : selectedAccount
    
    if (!accountToRefresh) return
    
    const accountNameKey = accountToRefresh.name
    setIsRefreshing(!accountName) // Only set main refreshing state if no accountName (drawer refresh)
    setRefreshingAccounts(prev => new Set(prev).add(accountNameKey))
    
    try {
      const refreshedData = await refreshCompanyData(accountToRefresh.name, accountToRefresh.website)
      if (refreshedData) {
        const updatedAccount = await populateAccountData(accountToRefresh)
        setSectorsMap((prev) => ({
          ...prev,
          [accountToRefresh.name]: updatedAccount.sector,
        }))
        updateAccount(accountToRefresh.name, updatedAccount)
        toast({
          title: 'Company data refreshed',
          description: `Company information for ${accountToRefresh.name} has been updated from web search`,
          status: 'success',
          duration: 3000,
          isClosable: true,
        })
      } else {
        toast({
          title: 'No data found',
          description: `Could not find updated company information for ${accountToRefresh.name}`,
          status: 'warning',
          duration: 3000,
          isClosable: true,
        })
      }
    } catch (error) {
      console.error('Error refreshing company data:', error)
      toast({
        title: 'Refresh failed',
        description: `An error occurred while refreshing company data for ${accountToRefresh.name}`,
        status: 'error',
        duration: 3000,
        isClosable: true,
      })
    } finally {
      setIsRefreshing(false)
      setRefreshingAccounts(prev => {
        const next = new Set(prev)
        next.delete(accountNameKey)
        return next
      })
    }
  }

  const deleteAccount = async (accountName: string) => {
    try {
      // First, fetch the customer from the database to get the ID
      const { data: customers, error } = await api.get<CustomerApi[]>('/api/customers')
      
      if (error || !customers) {
        toast({
          title: 'Delete failed',
          description: 'Could not fetch customer data',
          status: 'error',
          duration: 5000,
          isClosable: true,
        })
        return
      }

      const customer = customers.find(c => c.name === accountName)
      
      if (!customer) {
        // Account doesn't exist in database, just remove from local storage
        setAccountsData((prev) => {
          const updated = prev.filter((acc) => acc.name !== accountName)
          saveAccountsToStorage(updated)
          const newDeletedAccounts = new Set(deletedAccounts)
          newDeletedAccounts.add(accountName)
          setDeletedAccounts(newDeletedAccounts)
          saveDeletedAccountsToStorage(newDeletedAccounts)
          emit('accountsUpdated', updated)
          return updated
        })
        
        if (selectedAccount?.name === accountName) {
          setSelectedAccount(null)
        }
        
        toast({
          title: 'Account removed',
          description: `${accountName} has been removed from local storage`,
          status: 'success',
          duration: 3000,
          isClosable: true,
        })
        return
      }

      // Delete from database
      const { error: deleteError } = await api.delete(`/api/customers/${customer.id}`)
      
      if (deleteError) {
        toast({
          title: 'Delete failed',
          description: typeof deleteError === 'string' ? deleteError : 'Could not delete account from database. It may have related contacts, campaigns, lists, or sequences that need to be deleted first.',
          status: 'error',
          duration: 8000,
          isClosable: true,
        })
        return
      }

      // Successfully deleted from database, now update local state
      setAccountsData((prev) => {
        const updated = prev.filter((acc) => acc.name !== accountName)
        saveAccountsToStorage(updated)
        const newDeletedAccounts = new Set(deletedAccounts)
        newDeletedAccounts.add(accountName)
        setDeletedAccounts(newDeletedAccounts)
        saveDeletedAccountsToStorage(newDeletedAccounts)
        emit('accountsUpdated', updated)
        return updated
      })
      
      if (selectedAccount?.name === accountName) {
        setSelectedAccount(null)
      }
      
      toast({
        title: 'Account deleted',
        description: `${accountName} has been permanently deleted from the database`,
        status: 'success',
        duration: 3000,
        isClosable: true,
      })
    } catch (err: any) {
      console.error('Error deleting account:', err)
      toast({
        title: 'Delete failed',
        description: err?.message || 'An unexpected error occurred',
        status: 'error',
        duration: 5000,
        isClosable: true,
      })
    }
  }

  // REMOVED: Blanket "save on every change" effect
  // This was causing infinite write storms. Individual update functions already save.
  // DO NOT re-add this effect.

  useEffect(() => {
    saveSectorsToStorage(sectorsMap)
  }, [sectorsMap])

  useEffect(() => {
    saveTargetLocationsToStorage(targetLocationsMap)
  }, [targetLocationsMap])

  // Export function to get current accounts (for LeadsTab)
  useEffect(() => {
    // Store accounts in window for LeadsTab to access
    ;(window as any).__getAccounts = () => accountsData
    // Also dispatch initial accounts
    emit('accountsUpdated', accountsData)
  }, [accountsData])

  // Helper functions for editing fields
  const getEditingKey = (accountName: string, fieldName: string) => `${accountName}:${fieldName}`
  const isFieldEditing = (accountName: string, fieldName: string) => 
    Boolean(editingFields[getEditingKey(accountName, fieldName)])
  const startEditing = (accountName: string, fieldName: string) => {
    setEditingFields((prev) => ({ ...prev, [getEditingKey(accountName, fieldName)]: 'editing' }))
  }
  const stopEditing = (accountName: string, fieldName: string) => {
    setEditingFields((prev) => {
      const newState = { ...prev }
      delete newState[getEditingKey(accountName, fieldName)]
      return newState
    })
  }

  const addTargetTitle = (title: string) => {
    if (title && !targetTitlesList.includes(title)) {
      const updated = [...targetTitlesList, title]
      setTargetTitlesList(updated)
      sharedTargetTitles = updated
    }
  }

  // Handle column sort
  const numericSortColumns = new Set([
    'spend',
    'weeklyLeads',
    'weeklyTarget',
    'monthlyLeads',
    'monthlyTarget',
    'percentToTarget',
    'defcon',
  ])

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      // Toggle direction if same column
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      // Set new column and default to ascending
      setSortColumn(column)
      setSortDirection(numericSortColumns.has(column) ? 'desc' : 'asc')
    }
  }

  const renderSortIndicator = (column: string) => {
    if (sortColumn !== column) return <Box boxSize={4} />
    return sortDirection === 'asc' ? <ChevronUpIcon boxSize={4} /> : <ChevronDownIcon boxSize={4} />
  }

  // Sort accounts based on selected column
  const filteredAndSortedAccounts = [...accountsData].sort((a, b) => {
    const column = sortColumn || 'spend'
    const aValue = (() => {
      switch (column) {
        case 'account':
          return a.name.toLowerCase()
        case 'spend':
          return a.monthlySpendGBP || 0
        case 'weeklyLeads':
          return a.weeklyActual || 0
        case 'weeklyTarget':
          return a.weeklyTarget || 0
        case 'monthlyLeads':
          return a.monthlyActual || 0
        case 'monthlyTarget':
          return a.monthlyTarget || 0
        case 'percentToTarget':
          return a.monthlyTarget ? (a.monthlyActual || 0) / a.monthlyTarget : 0
        case 'defcon':
          return a.defcon || 0
        default:
          return a.name.toLowerCase()
      }
    })()
    const bValue = (() => {
      switch (column) {
        case 'account':
          return b.name.toLowerCase()
        case 'spend':
          return b.monthlySpendGBP || 0
        case 'weeklyLeads':
          return b.weeklyActual || 0
        case 'weeklyTarget':
          return b.weeklyTarget || 0
        case 'monthlyLeads':
          return b.monthlyActual || 0
        case 'monthlyTarget':
          return b.monthlyTarget || 0
        case 'percentToTarget':
          return b.monthlyTarget ? (b.monthlyActual || 0) / b.monthlyTarget : 0
        case 'defcon':
          return b.defcon || 0
        default:
          return b.name.toLowerCase()
      }
    })()

    if (typeof aValue === 'string' || typeof bValue === 'string') {
      const compare = String(aValue).localeCompare(String(bValue), undefined, { sensitivity: 'base' })
      return sortDirection === 'asc' ? compare : -compare
    }

    return sortDirection === 'asc' ? Number(aValue) - Number(bValue) : Number(bValue) - Number(aValue)
  })
  
  // Calculate total spend (must be after accountsData is defined)
  // Calculate totals for all numeric columns
  const totals = filteredAndSortedAccounts.reduce((acc, account) => {
    return {
      spend: acc.spend + (account.monthlySpendGBP || 0),
      weeklyLeads: acc.weeklyLeads + (account.weeklyActual || 0),
      monthlyLeads: acc.monthlyLeads + (account.monthlyActual || 0),
      weeklyTarget: acc.weeklyTarget + (account.weeklyTarget || 0),
      monthlyTarget: acc.monthlyTarget + (account.monthlyTarget || 0),
    }
  }, { spend: 0, weeklyLeads: 0, monthlyLeads: 0, weeklyTarget: 0, monthlyTarget: 0 })
  
  const totalPercentToTarget = totals.monthlyTarget > 0 
    ? (totals.monthlyLeads / totals.monthlyTarget * 100).toFixed(1)
    : '0.0'

  const isDrawerOpen = Boolean(selectedAccount)
  const clientProfileSummary = selectedAccount
    ? normalizeClientProfile(selectedAccount.clientProfile)
    : null
  const clientProfileStats = selectedAccount
    ? {
        accreditations: clientProfileSummary?.accreditations?.length ?? 0,
        sectors: clientProfileSummary?.targetJobSectorIds?.length ?? 0,
        roles: clientProfileSummary?.targetJobRoleIds?.length ?? 0,
        socialLinks: Object.values(clientProfileSummary?.socialMediaPresence || {}).filter((value) =>
          String(value || '').trim(),
        ).length,
        targetArea: clientProfileSummary?.targetGeographicalArea?.label || '',
      }
    : null

  const handleCloseDrawer = () => setSelectedAccount(null)

  const handleCreateAccount = async () => {
    if (!newAccountForm.name || !newAccountForm.name.trim()) {
      toast({
        title: 'Account name required',
        description: 'Please enter an account name',
        status: 'error',
        duration: 3000,
        isClosable: true,
      })
      return
    }

    // Check if account name already exists
    if (accountsData.some(acc => acc.name.toLowerCase() === newAccountForm.name!.toLowerCase())) {
      toast({
        title: 'Account already exists',
        description: `An account with the name "${newAccountForm.name}" already exists`,
        status: 'error',
        duration: 3000,
        isClosable: true,
      })
      return
    }

    // Set sensible defaults for fields not in the form
    const today = new Date()
    const oneYearFromNow = new Date(today)
    oneYearFromNow.setFullYear(today.getFullYear() + 1)
    
    const defaultContractStart = today.toISOString().split('T')[0] // YYYY-MM-DD format
    const defaultContractEnd = oneYearFromNow.toISOString().split('T')[0]
    
    // Auto-populate company data if available
    let initialAccount: Account = {
      name: newAccountForm.name.trim(),
      website: newAccountForm.website || '',
      aboutSections: newAccountForm.aboutSections || { ...DEFAULT_ABOUT_SECTIONS },
      sector: newAccountForm.sector || '',
      socialMedia: newAccountForm.socialMedia || [],
      logoUrl: newAccountForm.logoUrl,
      aboutSource: newAccountForm.aboutSource,
      aboutLocked: newAccountForm.aboutLocked,
      status: newAccountForm.status || 'Active',
      targetLocation: [], // Default to empty - user can add later if needed
      targetTitle: '', // Default to empty - user can add later if needed
      monthlySpendGBP: newAccountForm.monthlySpendGBP || 0,
      agreements: newAccountForm.agreements || [],
      defcon: newAccountForm.defcon || 3,
      contractStart: defaultContractStart, // Default to today
      contractEnd: defaultContractEnd, // Default to one year from today
      days: newAccountForm.days || 1,
      contacts: newAccountForm.contacts || 0,
      leads: newAccountForm.leads || 0,
      weeklyTarget: newAccountForm.weeklyTarget || 0,
      weeklyActual: newAccountForm.weeklyActual || 0,
      monthlyTarget: newAccountForm.monthlyTarget || 0,
      monthlyActual: newAccountForm.monthlyActual || 0,
      weeklyReport: '', // Default to empty - user can add later if needed
      users: newAccountForm.users || [],
      clientLeadsSheetUrl: newAccountForm.clientLeadsSheetUrl || undefined,
    }

    // Auto-populate company data if available
    let finalAccount = initialAccount
    let dataPopulated = false
    try {
      const populatedAccount = await populateAccountData(initialAccount)
      // Check if data was actually populated (not just default values)
      if (populatedAccount.sector !== initialAccount.sector || 
          populatedAccount.aboutSections.whatTheyDo !== initialAccount.aboutSections.whatTheyDo ||
          populatedAccount.socialMedia.length > 0) {
        finalAccount = populatedAccount
        dataPopulated = true
      }
    } catch (error) {
      console.warn('Could not auto-populate company data:', error)
      // Continue with initial account if population fails
    }

    // CRITICAL: Save to database FIRST via API, then update local state
    // This ensures database is the source of truth
    const payload = buildCustomerPayloadFromAccount(finalAccount)
    const { data: createdCustomer, error: createError } = await api.post<{ id: string; name: string }>('/api/customers', payload)
    
    if (createError || !createdCustomer) {
      // Show error toast - do NOT close modal, do NOT update local state
      toast({
        title: 'Failed to create account',
        description: createError || 'Unknown error occurred',
        status: 'error',
        duration: 5000,
        isClosable: true,
      })
      return // Don't proceed - let user fix the issue
    }
    
    // SUCCESS: API returned 2xx - NOW update local state
    // Add the database ID to the account for future updates
    const accountWithDbId = {
      ...finalAccount,
      id: createdCustomer.id,
      _databaseId: createdCustomer.id, // backward compat
    }
    
    setAccountsData((prev) => {
      const updated = [...prev, accountWithDbId]
      saveAccountsToStorage(updated)
      // Dispatch event so LeadsTab can get updated accounts and refresh leads
      emit('accountsUpdated', updated)
      return updated
    })
    
    // Emit customerCreated event so Onboarding can refresh its dropdown
    emit('customerCreated', { id: createdCustomer.id, name: createdCustomer.name })

    // Initialize maps for new account (ensure sector is saved)
    const updatedSectorsMap = {
      ...sectorsMap,
      [accountWithDbId.name]: accountWithDbId.sector,
    }
    setSectorsMap(updatedSectorsMap)
    saveSectorsToStorage(updatedSectorsMap)
    setTargetLocationsMap((prev) => ({
      ...prev,
      [accountWithDbId.name]: accountWithDbId.targetLocation,
    }))

    // Reset form
    setNewAccountForm({
      name: '',
      website: '',
      status: 'Active',
      sector: '',
      targetLocation: [],
      targetTitle: '',
      monthlySpendGBP: 0,
      defcon: 3,
      days: 1,
      contacts: 0,
      leads: 0,
      weeklyTarget: 0,
      weeklyActual: 0,
      monthlyTarget: 0,
      monthlyActual: 0,
      weeklyReport: '',
      clientLeadsSheetUrl: '',
      aboutSections: { ...DEFAULT_ABOUT_SECTIONS },
      socialMedia: [],
      agreements: [],
      users: [],
    })

    onCreateModalClose()

    // Open the new account in the drawer
    setSelectedAccount(accountWithDbId)
    // For newly created accounts, id should be cust_ prefixed from the DB
    const newAccountCustomerId = accountWithDbId.id?.startsWith('cust_') 
      ? accountWithDbId.id 
      : accountWithDbId._databaseId?.startsWith('cust_') 
        ? accountWithDbId._databaseId 
        : null
    setSelectedCustomerId(newAccountCustomerId)
    
    if (import.meta.env.DEV) {
      console.log('[createAccount]', { accountName: accountWithDbId.name, customerId: newAccountCustomerId })
    }

    toast({
      title: 'Account created',
      description: `Successfully created account: ${accountWithDbId.name}${dataPopulated ? ' (company data auto-populated)' : ''}`,
      status: 'success',
      duration: 3000,
      isClosable: true,
    })
  }

  const handleToggleAbout = (accountName: string) => {
    setExpandedAbout((prev) => ({ ...prev, [accountName]: !prev[accountName] }))
  }

  // Refresh verified web data for a single account
  // Listen for navigation to account from contacts tab
  useEffect(() => {
    const handleNavigateToAccount = (detail: { accountName?: string } | undefined) => {
      const accountName = detail?.accountName
      if (accountName) {
        const account = accountsData.find((acc) => acc.name === accountName)
        if (account) {
          // Use robust customerId derivation helper
          const { customerId, source } = deriveCustomerId(account, accountName, dbAccounts)
          
          if (import.meta.env.DEV) {
            console.log('[navigateToAccount]', { accountName, customerId, source })
          }
          
          setSelectedAccount(account)
          setSelectedCustomerId(customerId)
        }
      }
    }
    const off = on<{ accountName?: string }>('navigateToAccount', (detail) => handleNavigateToAccount(detail))
    return () => off()
  }, [accountsData, dbAccounts])

  // Keep contact counts/details live (ContactsTab dispatches contactsUpdated).
  useEffect(() => {
    const off = on<StoredContact[]>('contactsUpdated', (detail) => {
      // Load contacts and filter out deleted ones
      const updatedContacts = Array.isArray(detail) ? detail : loadContactsFromStorage()
      // Ensure deleted contacts are filtered out
      const deletedContactsSet = loadDeletedContactsFromStorage()
      const filteredContacts = updatedContacts.filter(c => !deletedContactsSet.has(c.id || ''))
      
      setContactsData(filteredContacts)
      
      // Update contact counts in accounts (using filtered contacts)
      setAccountsData((prevAccounts) => {
        const updated = prevAccounts.map((account) => {
          const contactCount = filteredContacts.filter((contact) => 
            (contact.accounts || []).some((acc: string) => acc === account.name)
          ).length
          // Only update if the count has changed
          if (account.contacts !== contactCount) {
            return { ...account, contacts: contactCount }
          }
          return account
        })
        
        // Only save if something changed
        const hasChanges = updated.some((acc, idx) => acc.contacts !== prevAccounts[idx].contacts)
        if (hasChanges) {
          // Save updated accounts with new contact counts
          saveAccountsToStorage(updated)
          console.log('✅ Updated contact counts in accounts (excluding deleted contacts)')
        }
        
        return updated
      })
    })
    return () => off()
  }, [])

  // Allow parent navigators (top-tab shell) to request focusing an account by name.
  // If it exists, open the drawer for that account.
  useEffect(() => {
    if (!focusAccountName) return
    const account = accountsData.find((acc) => acc.name === focusAccountName)
    if (account) {
      // Use robust customerId derivation helper
      const { customerId, source } = deriveCustomerId(account, focusAccountName, dbAccounts)
      
      if (import.meta.env.DEV) {
        console.log('[focusAccountName]', { accountName: focusAccountName, customerId, source })
      }
      
      setSelectedAccount(account)
      setSelectedCustomerId(customerId)
    }
  }, [focusAccountName, accountsData, dbAccounts])

  const handleAccountClick = (accountName: string, e?: React.MouseEvent) => {
    try {
      e?.stopPropagation()
      
      const account = accountsData.find((acc) => acc.name === accountName)
      
      if (!account) {
        console.error('Account not found:', accountName)
        return
      }

      // Use robust customerId derivation helper
      const { customerId, source } = deriveCustomerId(account, accountName, dbAccounts)
      
      // Dev-only logging for debugging
      if (import.meta.env.DEV) {
        console.log('[handleAccountClick]', {
          accountName,
          customerId,
          source,
        })
      }
      
      setSelectedAccount(account)
      setSelectedCustomerId(customerId)
    } catch (error) {
      console.error('Error in handleAccountClick:', error)
    }
  }

  // Debug: Log drawer state changes
  useEffect(() => {
    console.log('Drawer state changed:', { isDrawerOpen, selectedAccount: selectedAccount?.name })
  }, [isDrawerOpen, selectedAccount])

  // Sync selectedAccount when accountsData changes (only if drawer is open)
  useEffect(() => {
    if (selectedAccount && isDrawerOpen) {
      const updatedAccount = accountsData.find((acc) => acc.name === selectedAccount.name)
      if (updatedAccount && updatedAccount !== selectedAccount) {
        console.log('Syncing account data')
        setSelectedAccount(updatedAccount)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountsData])

  // Auto-restore accounts if empty on mount, preserving Google Sheets URLs
  useEffect(() => {
    if (isServerSourceOfTruth) return
    if ((!accountsData || accountsData.length === 0) && isStorageAvailable()) {
      const stored = getItem(STORAGE_KEY_ACCOUNTS)
      const deletedAccountsSet = loadDeletedAccountsFromStorage()
      
      // Try to parse stored accounts to preserve ALL user data
      let storedAccountsMap = new Map<string, Account>()
      try {
        if (stored && stored !== '[]' && stored !== 'null') {
          const parsed = JSON.parse(stored)
          if (Array.isArray(parsed)) {
            parsed.forEach((acc: Account) => {
              if (acc && acc.name) {
                storedAccountsMap.set(acc.name, acc)
                console.log(`📊 Found stored data for ${acc.name}`)
              }
            })
          }
        }
      } catch (e) {
        console.warn('Could not parse stored accounts for data recovery:', e)
      }
      
      // If all accounts are deleted, clear the deleted list
      if (deletedAccountsSet.size > 0 && deletedAccountsSet.size >= accounts.length) {
        console.log('⚠️ All accounts are marked as deleted, clearing deleted list')
        saveDeletedAccountsToStorage(new Set())
      }
      
      if (!stored || stored === '[]' || stored === 'null') {
        console.log('🔄 Auto-restoring default accounts...')
        // Preserve ALL user-modified data from any stored data
        const defaultAccounts = accounts.map(acc => {
          const stored = storedAccountsMap.get(acc.name)
          if (stored) {
            console.log(`✅ Recovered user data for ${acc.name}`)
            return { ...acc, ...stored }
          }
          return acc
        })
        saveAccountsToStorage(defaultAccounts)
        setAccountsData(defaultAccounts)
        emit('accountsUpdated', defaultAccounts)
      } else {
        // Storage exists but accountsData is empty - might be a deleted accounts issue
        console.log('🔄 Storage exists but accounts empty, restoring defaults...')
        // Preserve ALL user-modified data from stored data
        const defaultAccounts = accounts.map(acc => {
          const stored = storedAccountsMap.get(acc.name)
          if (stored) {
            console.log(`✅ Recovered user data for ${acc.name}`)
            return { ...acc, ...stored }
          }
          return acc
        })
        saveAccountsToStorage(defaultAccounts)
        saveDeletedAccountsToStorage(new Set()) // Clear deleted list
        setAccountsData(defaultAccounts)
        emit('accountsUpdated', defaultAccounts)
      }
    }
  }, [accountsData, isServerSourceOfTruth])

  // Restore Google Sheets + account details from latest backup (if available).
  useEffect(() => {
    if (isServerSourceOfTruth) return
    if (hasSyncedCustomersRef.current) return
    if (!isStorageAvailable()) return
    const current = loadAccountsFromStorage()
    const hasSheets = current.some((acc) => acc.clientLeadsSheetUrl)
    if (hasSheets) return

    const backup = loadLatestAccountsBackup()
    if (!backup || backup.length === 0) return

    const backupMap = new Map(backup.map((acc) => [acc.name, acc]))
    let changed = false
    const merged = current.map((acc) => {
      const fromBackup = backupMap.get(acc.name)
      if (!fromBackup) return acc
      const updated = mergeAccountFromBackup(acc, fromBackup)
      if (updated !== acc) changed = true
      return updated
    })

    if (changed) {
      saveAccountsToStorage(merged)
      setAccountsData(merged)
      emit('accountsUpdated', merged)
      toast({
        title: 'Accounts restored from backup',
        description: 'Recovered Google Sheets and account details from the latest local backup.',
        status: 'success',
        duration: 3000,
        isClosable: true,
      })
    }
  }, [accountsData, isServerSourceOfTruth, toast])

  // Rehydrate account details from backend customers (server source of truth).
  useEffect(() => {
    if (hasSyncedCustomersRef.current) return

    const syncFromCustomers = async () => {
      // First, load from localStorage as fallback
      const localAccounts = loadAccountsFromStorage()
      const deletedAccountsSet = loadDeletedAccountsFromStorage()
      const filteredLocalAccounts = localAccounts.filter(acc => !deletedAccountsSet.has(acc.name))
      
      // If we have local accounts, set them immediately so UI isn't empty
      if (filteredLocalAccounts.length > 0 && accountsData.length === 0) {
        setAccountsData(filteredLocalAccounts)
        hasHydratedFromServerRef.current = true
      }

      // Then try to load from server
      const { data, error } = await api.get<CustomerApi[]>('/api/customers')
      if (error || !data) {
        console.warn('Failed to load accounts from the customer database. Using local storage data.')
        // Don't overwrite local storage if server call fails
        if (filteredLocalAccounts.length > 0) {
          hasHydratedFromServerRef.current = true
          return
        }
        return
      }

      // Only update if server has data
      if (data.length === 0) {
        console.warn('Server returned empty accounts array. Keeping local storage data.')
        if (filteredLocalAccounts.length > 0) {
          hasHydratedFromServerRef.current = true
        }
        return
      }

      const serverAccounts = data.map(buildAccountFromCustomer)
      const nextHash = computeAccountsSyncHash(serverAccounts)
      if (isStorageAvailable()) {
        setItem(OdcrmStorageKeys.accountsBackendSyncHash, nextHash)
        setItem(OdcrmStorageKeys.accountsBackendSyncVersion, 'v2-account-data')
        saveDeletedAccountsToStorage(new Set())
        saveAccountsToStorage(serverAccounts)
      }
      lastSyncedHashRef.current = nextHash
      hasSyncedCustomersRef.current = true
      hasHydratedFromServerRef.current = true
      setAccountsData(serverAccounts)
      emit('accountsUpdated', serverAccounts)
      toast({
        title: 'Accounts updated',
        description: 'Loaded account details from the customer database.',
        status: 'success',
        duration: 3000,
        isClosable: true,
      })
    }

    void syncFromCustomers()
  }, [toast, accountsData.length])

  const hasStoredAccounts = (() => {
    // Preserve prior behavior: if storage is unavailable, don't show the "defaults" warning.
    if (!isStorageAvailable()) return true
    const accounts = getJson<Account[]>(STORAGE_KEY_ACCOUNTS)
    return accounts !== null && accounts.length > 0
  })()

  const accountNames = accountsData.map((a) => a.name).slice().sort((a, b) => a.localeCompare(b))
  const fieldConfig = getFieldConfig(contactsData)

  // Load leads data function
  const loadLeadsData = useCallback(async (forceRefresh: boolean = false) => {
    const cachedLeads = loadLeadsFromStorage()
    
    // Check if we should refresh
    if (!forceRefresh && !shouldRefreshMarketingLeads(cachedLeads)) {
      console.log('Skipping leads refresh - less than 30 minutes since last refresh')
      setLeads(cachedLeads)
      setLeadsLoading(false)
      return
    }

    setLeadsLoading(true)
    setLeadsError(null)

    try {
      const { leads: allLeads, lastSyncAt } = await fetchLeadsFromApi()
      const sheetAccounts = new Set(
        accountsData
          .filter((account) => Boolean(account.clientLeadsSheetUrl?.trim()))
          .map((account) => account.name),
      )
      const filteredLeads = sheetAccounts.size
        ? allLeads.filter((lead) => sheetAccounts.has(lead.accountName))
        : []
      const refreshTime = persistLeadsToStorage(filteredLeads, lastSyncAt)
      setLeads(filteredLeads)
      setLeadsLastRefresh(refreshTime)
      syncAccountLeadCountsFromLeads(filteredLeads)
    } catch (err) {
      setLeadsError('Failed to load leads data from the server.')
      console.error('Error loading leads:', err)
    } finally {
      setLeadsLoading(false)
    }
  }, [accountsData])

  // Load leads ONCE on mount - do NOT depend on loadLeadsData to prevent infinite loops
  const hasLoadedLeadsRef = useRef(false)
  useEffect(() => {
    if (hasLoadedLeadsRef.current) return
    hasLoadedLeadsRef.current = true
    
    const cachedLeads = loadLeadsFromStorage()
    if (!shouldRefreshMarketingLeads(cachedLeads)) {
      setLeads(cachedLeads)
      setLeadsLoading(false)
      return
    }

    void loadLeadsData(false)
  }, []) // Empty deps - run once on mount only

  // Keep a local copy of the SAME marketing leads that Marketing → Leads uses.
  return (
    <>
      <HStack justify="space-between" mb={6} flexWrap="wrap" gap={3}>
        <Box>
          <Heading size="md" color="gray.700">
            Accounts
          </Heading>
          <Text fontSize="sm" color="gray.500">
            Total monthly customer revenue: {currencyFormatter.format(totals.spend)}
          </Text>
        </Box>
        <HStack>
          <Button
            colorScheme="gray"
            leftIcon={<CheckIcon />}
            onClick={onCreateModalOpen}
            size="sm"
          >
            Create New Account
          </Button>
        </HStack>
      </HStack>

      {/* Migration Panel - show if no accounts exist */}
      {!hasStoredAccounts && <MigrateAccountsPanel />}

      {!hasStoredAccounts && (
        <Box mb={6} p={4} bg="bg.surface" borderRadius="lg" border="1px solid" borderColor="border.subtle">
          <Alert status="info" borderRadius="md">
            <AlertIcon />
            <AlertDescription fontSize="sm">
              Accounts (including Google Sheets links) are saved per browser + domain/port. If you switched URLs/ports,
              you may be seeing defaults—switch back or import your accounts data.
            </AlertDescription>
          </Alert>
        </Box>
      )}

      <TableContainer
        bg="bg.surface"
        borderRadius="lg"
        border="1px solid"
        borderColor="border.subtle"
        overflowX="auto"
        position="relative"
        maxH="calc(100vh - 300px)"
        overflowY="auto"
      >
        <Table 
          size="sm" 
          variant="simple" 
          w="100%"
          sx={{ tableLayout: 'fixed' }}
        >
          <Thead 
            bg="bg.subtle"
            position="sticky"
            top={0}
            zIndex={10}
            boxShadow="sm"
          >
            <Tr>
              <Th
                position="relative"
                style={{ width: columnWidths.account || 250, minWidth: 150 }}
                cursor="pointer"
                onClick={() => handleSort('account')}
                _hover={{ bg: 'bg.subtle' }}
              >
                <HStack spacing={1} justify="flex-start">
                  <Text>Account</Text>
                  {renderSortIndicator('account')}
                </HStack>
                <Box
                  position="absolute"
                  right={0}
                  top={0}
                  bottom={0}
                  w="4px"
                  cursor="col-resize"
                  bg="transparent"
                  _hover={{ bg: 'brand.400' }}
                  onMouseDown={(e) => {
                    e.stopPropagation()
                    handleResizeStart('account', e.clientX)
                  }}
                />
              </Th>
              <Th 
                isNumeric 
                position="relative" 
                style={{ width: columnWidths.spend || 120, minWidth: 100 }}
                cursor="pointer"
                onClick={() => handleSort('spend')}
                _hover={{ bg: 'bg.subtle' }}
              >
                <HStack spacing={1} justify="flex-end">
                  <Text>Revenue</Text>
                  {renderSortIndicator('spend')}
                </HStack>
                <Box
                  position="absolute"
                  right={0}
                  top={0}
                  bottom={0}
                  w="4px"
                  cursor="col-resize"
                  bg="transparent"
                  _hover={{ bg: 'brand.400' }}
                  onMouseDown={(e) => {
                    e.stopPropagation()
                    handleResizeStart('spend', e.clientX)
                  }}
                />
              </Th>
              <Th
                isNumeric
                position="relative"
                style={{ width: columnWidths.weeklyLeads || 100, minWidth: 80 }}
                cursor="pointer"
                onClick={() => handleSort('weeklyLeads')}
                _hover={{ bg: 'bg.subtle' }}
              >
                <HStack spacing={1} justify="flex-end">
                  <Text>Weekly Leads</Text>
                  {renderSortIndicator('weeklyLeads')}
                </HStack>
                <Box
                  position="absolute"
                  right={0}
                  top={0}
                  bottom={0}
                  w="4px"
                  cursor="col-resize"
                  bg="transparent"
                  _hover={{ bg: 'brand.400' }}
                  onMouseDown={(e) => {
                    e.stopPropagation()
                    handleResizeStart('weeklyLeads', e.clientX)
                  }}
                />
              </Th>
              <Th
                isNumeric
                position="relative"
                style={{ width: columnWidths.weeklyTarget || 120, minWidth: 100 }}
                cursor="pointer"
                onClick={() => handleSort('weeklyTarget')}
                _hover={{ bg: 'bg.subtle' }}
              >
                <HStack spacing={1} justify="flex-end">
                  <Text>Weekly Target</Text>
                  {renderSortIndicator('weeklyTarget')}
                </HStack>
                <Box
                  position="absolute"
                  right={0}
                  top={0}
                  bottom={0}
                  w="4px"
                  cursor="col-resize"
                  bg="transparent"
                  _hover={{ bg: 'brand.400' }}
                  onMouseDown={(e) => {
                    e.stopPropagation()
                    handleResizeStart('weeklyTarget', e.clientX)
                  }}
                />
              </Th>
              <Th
                isNumeric
                position="relative"
                style={{ width: columnWidths.monthlyLeads || 100, minWidth: 80 }}
                cursor="pointer"
                onClick={() => handleSort('monthlyLeads')}
                _hover={{ bg: 'bg.subtle' }}
              >
                <HStack spacing={1} justify="flex-end">
                  <Text>Monthly Leads</Text>
                  {renderSortIndicator('monthlyLeads')}
                </HStack>
                <Box
                  position="absolute"
                  right={0}
                  top={0}
                  bottom={0}
                  w="4px"
                  cursor="col-resize"
                  bg="transparent"
                  _hover={{ bg: 'brand.400' }}
                  onMouseDown={(e) => {
                    e.stopPropagation()
                    handleResizeStart('monthlyLeads', e.clientX)
                  }}
                />
              </Th>
              <Th
                isNumeric
                position="relative"
                style={{ width: columnWidths.monthlyTarget || 120, minWidth: 100 }}
                cursor="pointer"
                onClick={() => handleSort('monthlyTarget')}
                _hover={{ bg: 'bg.subtle' }}
              >
                <HStack spacing={1} justify="flex-end">
                  <Text>Monthly Target</Text>
                  {renderSortIndicator('monthlyTarget')}
                </HStack>
                <Box
                  position="absolute"
                  right={0}
                  top={0}
                  bottom={0}
                  w="4px"
                  cursor="col-resize"
                  bg="transparent"
                  _hover={{ bg: 'brand.400' }}
                  onMouseDown={(e) => {
                    e.stopPropagation()
                    handleResizeStart('monthlyTarget', e.clientX)
                  }}
                />
              </Th>
              <Th
                isNumeric
                position="relative"
                style={{ width: columnWidths.percentToTarget || 120, minWidth: 100 }}
                cursor="pointer"
                onClick={() => handleSort('percentToTarget')}
                _hover={{ bg: 'bg.subtle' }}
              >
                <HStack spacing={1} justify="flex-end">
                  <Text>% of Monthly Target</Text>
                  {renderSortIndicator('percentToTarget')}
                </HStack>
                <Box
                  position="absolute"
                  right={0}
                  top={0}
                  bottom={0}
                  w="4px"
                  cursor="col-resize"
                  bg="transparent"
                  _hover={{ bg: 'brand.400' }}
                  onMouseDown={(e) => {
                    e.stopPropagation()
                    handleResizeStart('percentToTarget', e.clientX)
                  }}
                />
              </Th>
              <Th
                isNumeric
                position="relative"
                style={{ width: columnWidths.defcon || 100, minWidth: 80 }}
                cursor="pointer"
                onClick={() => handleSort('defcon')}
                _hover={{ bg: 'bg.subtle' }}
              >
                <HStack spacing={1} justify="flex-end">
                  <Text>DEFCON</Text>
                  {renderSortIndicator('defcon')}
                </HStack>
                <Box
                  position="absolute"
                  right={0}
                  top={0}
                  bottom={0}
                  w="4px"
                  cursor="col-resize"
                  bg="transparent"
                  _hover={{ bg: 'brand.400' }}
                  onMouseDown={(e) => {
                    e.stopPropagation()
                    handleResizeStart('defcon', e.clientX)
                  }}
                />
              </Th>
            </Tr>
          </Thead>
          <Tbody>
            {filteredAndSortedAccounts.map((account) => {
              return (
                <Tr
                  key={account.name}
                  cursor="pointer"
                  _hover={{ bg: 'bg.subtle' }}
                  onClick={(e) => handleAccountClick(account.name, e)}
                >
                  <Td>
                    <Text fontWeight="semibold" color="text.primary">
                      {account.name}
                    </Text>
                  </Td>
                  <Td isNumeric onClick={(e) => e.stopPropagation()}>
                    {editingCell?.accountName === account.name && editingCell?.field === 'spend' ? (
                      <HStack spacing={1}>
                        <NumberInput
                          size="sm"
                          value={editValue}
                          onChange={setEditValue}
                          min={0}
                          precision={0}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleCellSave()
                            if (e.key === 'Escape') handleCellCancel()
                          }}
                          autoFocus
                        >
                          <NumberInputField w="80px" />
                        </NumberInput>
                        <IconButton
                          aria-label="Save"
                          icon={<CheckIcon />}
                          size="xs"
                          onClick={handleCellSave}
                        />
                        <IconButton
                          aria-label="Cancel"
                          icon={<CloseIcon />}
                          size="xs"
                          onClick={handleCellCancel}
                        />
                      </HStack>
                    ) : (
                      <Text
                        fontSize="sm"
                        color="text.primary"
                        cursor="pointer"
                        _hover={{ textDecoration: 'underline' }}
                        onClick={() => handleCellEdit(account.name, 'spend', account.monthlySpendGBP || 0)}
                      >
                        {currencyFormatter.format(account.monthlySpendGBP || 0)}
                      </Text>
                    )}
                  </Td>
                  <Td isNumeric>
                    <Text fontSize="sm" color="text.primary">
                      {account.weeklyActual || 0}
                    </Text>
                  </Td>
                  <Td isNumeric onClick={(e) => e.stopPropagation()}>
                    {editingCell?.accountName === account.name && editingCell?.field === 'weeklyTarget' ? (
                      <HStack spacing={1}>
                        <NumberInput
                          size="sm"
                          value={editValue}
                          onChange={setEditValue}
                          min={0}
                          precision={0}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleCellSave()
                            if (e.key === 'Escape') handleCellCancel()
                          }}
                          autoFocus
                        >
                          <NumberInputField w="80px" />
                        </NumberInput>
                        <IconButton
                          aria-label="Save"
                          icon={<CheckIcon />}
                          size="xs"
                          onClick={handleCellSave}
                        />
                        <IconButton
                          aria-label="Cancel"
                          icon={<CloseIcon />}
                          size="xs"
                          onClick={handleCellCancel}
                        />
                      </HStack>
                    ) : (
                      <Text
                        fontSize="sm"
                        color="text.primary"
                        cursor="pointer"
                        _hover={{ textDecoration: 'underline' }}
                        onClick={() => handleCellEdit(account.name, 'weeklyTarget', account.weeklyTarget || 0)}
                      >
                        {account.weeklyTarget || 0}
                      </Text>
                    )}
                  </Td>
                  <Td isNumeric>
                    <Text fontSize="sm" color="text.primary">
                      {account.monthlyActual || 0}
                    </Text>
                  </Td>
                  <Td isNumeric onClick={(e) => e.stopPropagation()}>
                    {editingCell?.accountName === account.name && editingCell?.field === 'monthlyTarget' ? (
                      <HStack spacing={1}>
                        <NumberInput
                          size="sm"
                          value={editValue}
                          onChange={setEditValue}
                          min={0}
                          precision={0}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleCellSave()
                            if (e.key === 'Escape') handleCellCancel()
                          }}
                          autoFocus
                        >
                          <NumberInputField w="80px" />
                        </NumberInput>
                        <IconButton
                          aria-label="Save"
                          icon={<CheckIcon />}
                          size="xs"
                          onClick={handleCellSave}
                        />
                        <IconButton
                          aria-label="Cancel"
                          icon={<CloseIcon />}
                          size="xs"
                          onClick={handleCellCancel}
                        />
                      </HStack>
                    ) : (
                      <Text
                        fontSize="sm"
                        color="text.primary"
                        cursor="pointer"
                        _hover={{ textDecoration: 'underline' }}
                        onClick={() => handleCellEdit(account.name, 'monthlyTarget', account.monthlyTarget || 0)}
                      >
                        {account.monthlyTarget || 0}
                      </Text>
                    )}
                  </Td>
                  <Td isNumeric>
                    <Text fontSize="sm" color="text.primary">
                      {account.monthlyTarget > 0 
                        ? `${((account.monthlyActual || 0) / account.monthlyTarget * 100).toFixed(1)}%`
                        : '0%'}
                    </Text>
                  </Td>
                  <Td isNumeric onClick={(e) => e.stopPropagation()}>
                    {editingCell?.accountName === account.name && editingCell?.field === 'defcon' ? (
                      <HStack spacing={1}>
                        <NumberInput
                          size="sm"
                          value={editValue}
                          onChange={setEditValue}
                          min={1}
                          max={5}
                          precision={0}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleCellSave()
                            if (e.key === 'Escape') handleCellCancel()
                          }}
                          autoFocus
                        >
                          <NumberInputField w="60px" />
                        </NumberInput>
                        <IconButton
                          aria-label="Save"
                          icon={<CheckIcon />}
                          size="xs"
                          onClick={handleCellSave}
                        />
                        <IconButton
                          aria-label="Cancel"
                          icon={<CloseIcon />}
                          size="xs"
                          onClick={handleCellCancel}
                        />
                      </HStack>
                    ) : (
                      <Badge 
                        variant="subtle" 
                        colorScheme="gray"
                        cursor="pointer"
                        _hover={{ opacity: 0.8 }}
                        onClick={() => handleCellEdit(account.name, 'defcon', account.defcon || 3)}
                      >
                        {account.defcon}
                      </Badge>
                    )}
                  </Td>
                </Tr>
              )
            })}

            {filteredAndSortedAccounts.length === 0 ? (
              <Tr>
                <Td colSpan={8}>
                  <Box p={6} color="text.muted" textAlign="center" fontSize="sm">
                    No accounts match the selected filters
                  </Box>
                </Td>
              </Tr>
            ) : null}
            {filteredAndSortedAccounts.length > 0 && (
              <Tr bg="bg.subtle" fontWeight="bold">
                <Td colSpan={1}>
                  <Text fontSize="sm" fontWeight="bold" color="text.primary">
                    Totals ({filteredAndSortedAccounts.length} accounts)
                  </Text>
                </Td>
                <Td isNumeric>
                  <Text fontSize="sm" fontWeight="bold" color="text.primary">
                    {currencyFormatter.format(totals.spend)}
                  </Text>
                </Td>
                <Td isNumeric>
                  <Text fontSize="sm" fontWeight="bold" color="text.primary">
                    {totals.weeklyLeads}
                  </Text>
                </Td>
                <Td isNumeric>
                  <Text fontSize="sm" fontWeight="bold" color="text.primary">
                    {totals.weeklyTarget}
                  </Text>
                </Td>
                <Td isNumeric>
                  <Text fontSize="sm" fontWeight="bold" color="text.primary">
                    {totals.monthlyLeads}
                  </Text>
                </Td>
                <Td isNumeric>
                  <Text fontSize="sm" fontWeight="bold" color="text.primary">
                    {totals.monthlyTarget}
                  </Text>
                </Td>
                <Td isNumeric>
                  <Text fontSize="sm" fontWeight="bold" color="text.primary">
                    {totalPercentToTarget}%
                  </Text>
                </Td>
                <Td></Td>
              </Tr>
            )}
          </Tbody>
        </Table>
      </TableContainer>

      {/* Create Account Modal */}
      <Modal isOpen={isCreateModalOpen} onClose={onCreateModalClose} size="xl">
        <ModalOverlay />
        <ModalContent maxH="90vh">
          <ModalHeader>Create New Account</ModalHeader>
          <ModalCloseButton />
          <ModalBody overflowY="auto" maxH="calc(90vh - 120px)">
            <Stack spacing={4}>
              <FormControl isRequired>
                <FormLabel>Account Name</FormLabel>
                <Input
                  placeholder="Enter account name"
                  value={newAccountForm.name || ''}
                  onChange={(e) => setNewAccountForm({ ...newAccountForm, name: e.target.value })}
                />
              </FormControl>

              <FormControl>
                <FormLabel>Website</FormLabel>
                <Input
                  type="url"
                  placeholder="https://example.com"
                  value={newAccountForm.website || ''}
                  onChange={(e) => setNewAccountForm({ ...newAccountForm, website: e.target.value })}
                />
              </FormControl>

              <SimpleGrid columns={2} gap={4}>
                <FormControl>
                  <FormLabel>Status</FormLabel>
                  <Select
                    value={newAccountForm.status || 'Active'}
                    onChange={(e) => setNewAccountForm({ ...newAccountForm, status: e.target.value as Account['status'] })}
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                    <option value="On Hold">On Hold</option>
                  </Select>
                </FormControl>

                <FormControl>
                  <FormLabel>Sector</FormLabel>
                  <Input
                    placeholder="Enter sector"
                    value={newAccountForm.sector || ''}
                    onChange={(e) => setNewAccountForm({ ...newAccountForm, sector: e.target.value })}
                  />
                </FormControl>
              </SimpleGrid>

              <SimpleGrid columns={2} gap={4}>
                <FormControl>
                  <FormLabel>Monthly Revenue (GBP)</FormLabel>
                  <NumberInput
                    value={newAccountForm.monthlySpendGBP || 0}
                    onChange={(_, value) => setNewAccountForm({ ...newAccountForm, monthlySpendGBP: value || 0 })}
                    min={0}
                  >
                    <NumberInputField />
                  </NumberInput>
                </FormControl>

                <FormControl>
                  <FormLabel>Defcon</FormLabel>
                  <NumberInput
                    value={newAccountForm.defcon || 3}
                    onChange={(_, value) => setNewAccountForm({ ...newAccountForm, defcon: value || 3 })}
                    min={1}
                    max={5}
                  >
                    <NumberInputField />
                  </NumberInput>
                </FormControl>
              </SimpleGrid>

              <SimpleGrid columns={2} gap={4}>
                <FormControl>
                  <FormLabel>Days (per week)</FormLabel>
                  <NumberInput
                    value={newAccountForm.days || 1}
                    onChange={(_, value) => setNewAccountForm({ ...newAccountForm, days: value || 1 })}
                    min={1}
                    max={7}
                  >
                    <NumberInputField />
                  </NumberInput>
                </FormControl>

                <FormControl>
                  <FormLabel>Contacts</FormLabel>
                  <NumberInput
                    value={newAccountForm.contacts || 0}
                    onChange={(_, value) => setNewAccountForm({ ...newAccountForm, contacts: value || 0 })}
                    min={0}
                  >
                    <NumberInputField />
                  </NumberInput>
                </FormControl>
              </SimpleGrid>

              <SimpleGrid columns={2} gap={4}>
                <FormControl>
                  <FormLabel>Weekly Target</FormLabel>
                  <NumberInput
                    value={newAccountForm.weeklyTarget || 0}
                    onChange={(_, value) => setNewAccountForm({ ...newAccountForm, weeklyTarget: value || 0 })}
                    min={0}
                  >
                    <NumberInputField />
                  </NumberInput>
                </FormControl>

                <FormControl>
                  <FormLabel>Monthly Target</FormLabel>
                  <NumberInput
                    value={newAccountForm.monthlyTarget || 0}
                    onChange={(_, value) => setNewAccountForm({ ...newAccountForm, monthlyTarget: value || 0 })}
                    min={0}
                  >
                    <NumberInputField />
                  </NumberInput>
                </FormControl>
              </SimpleGrid>

              <FormControl>
                <FormLabel>Client Leads Sheet URL</FormLabel>
                <Input
                  type="url"
                  placeholder="https://docs.google.com/spreadsheets/d/..."
                  value={newAccountForm.clientLeadsSheetUrl || ''}
                  onChange={(e) => setNewAccountForm({ ...newAccountForm, clientLeadsSheetUrl: e.target.value })}
                />
              </FormControl>
            </Stack>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onCreateModalClose}>
              Cancel
            </Button>
            <Button colorScheme="gray" onClick={handleCreateAccount}>
              Create Account
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {isDrawerOpen && selectedAccount && (
        <Drawer
          isOpen={true}
          placement="right"
          onClose={handleCloseDrawer}
          closeOnOverlayClick={true}
          closeOnEsc={true}
          size="xl"
        >
          <DrawerOverlay bg="blackAlpha.600" />
          <DrawerContent maxW="66.67vw">
            <DrawerCloseButton />
            <DrawerHeader
              bg="white"
              borderBottom="1px solid"
              borderColor="gray.200"
              pb={4}
            >
              <Stack spacing={4}>
                <Stack direction="row" justify="space-between" align="flex-start">
                  <HStack spacing={4} align="center" flex="1">
                    <Stack spacing={1} flex="1">
                      <Heading size="xl" color="gray.800" fontWeight="bold">
                        {selectedAccount.name}
                      </Heading>
                      <HStack spacing={3} flexWrap="wrap">
                        <Badge colorScheme="gray" variant="subtle" px={3} py={1} fontSize="sm">
                          {(sectorsMap[selectedAccount.name] ?? selectedAccount.sector) || 'No sector'}
                        </Badge>
                        <Badge
                          colorScheme={selectedAccount.status === 'Active' ? 'green' : selectedAccount.status === 'Inactive' ? 'red' : 'orange'}
                          variant="solid"
                          px={3}
                          py={1}
                          fontSize="sm"
                        >
                          {selectedAccount.status}
                        </Badge>
                        {selectedAccount.defcon && (
                          <Badge colorScheme="gray" variant="outline" px={3} py={1} fontSize="sm">
                            DEFCON {selectedAccount.defcon}
                          </Badge>
                        )}
                        {/* Debug: Show customerId in dev mode */}
                        {process.env.NODE_ENV === 'development' && (
                          <Badge colorScheme="purple" variant="outline" px={2} py={1} fontSize="xs" fontFamily="mono">
                            ID: {selectedCustomerId || 'none'}
                          </Badge>
                        )}
                      </HStack>
                    </Stack>
                  </HStack>
                  <Button variant="outline" onClick={handleCloseDrawer} size="md">
                    Close
                  </Button>
                </Stack>
              </Stack>
            </DrawerHeader>
            
            {/* DEBUG: Debug display for customer ID verification (dev only) */}
            {import.meta.env.DEV && (
              <Box bg="yellow.50" px={4} py={2} borderBottom="1px solid" borderColor="yellow.200">
                <HStack spacing={4} fontSize="xs" fontFamily="mono">
                  <Text>
                    <Text as="span" fontWeight="bold">customerId:</Text>{' '}
                    <Text as="span" color={selectedCustomerId ? 'green.600' : 'red.600'}>
                      {selectedCustomerId || 'null'}
                    </Text>
                  </Text>
                  <Text>
                    <Text as="span" fontWeight="bold">source:</Text>{' '}
                    <Text as="span" color={dataSource === 'DB' ? 'green.600' : 'orange.600'}>
                      {dataSource}
                    </Text>
                  </Text>
                  <Text>
                    <Text as="span" fontWeight="bold">account.id:</Text>{' '}
                    <Text as="span" color={selectedAccount?.id ? 'green.600' : 'red.600'}>
                      {selectedAccount?.id || 'null'}
                    </Text>
                  </Text>
                </HStack>
              </Box>
            )}
            
            <DrawerBody bg="gray.50" p={6}>
              <Stack spacing={6} w="full">
                {/* Quick Info Section */}
                <Box
                  bg="white"
                  borderRadius="xl"
                  p={6}
                  border="1px solid"
                  borderColor="gray.200"
                  boxShadow="sm"
                >
                  <Heading size="md" mb={4} color="gray.700">
                    Quick Information
                  </Heading>
                  <SimpleGrid columns={{ base: 1, md: 2 }} gap={4}>
                      <EditableField
                        value={selectedAccount.monthlySpendGBP?.toString() || '0'}
                        onSave={(value) => {
                          const numValue = parseFloat(String(value)) || 0
                          updateAccount(selectedAccount.name, { monthlySpendGBP: numValue })
                          stopEditing(selectedAccount.name, 'monthlySpendGBP')
                        }}
                        onCancel={() => stopEditing(selectedAccount.name, 'monthlySpendGBP')}
                        isEditing={isFieldEditing(selectedAccount.name, 'monthlySpendGBP')}
                        onEdit={() => startEditing(selectedAccount.name, 'monthlySpendGBP')}
                        label="Monthly Revenue"
                        type="number"
                        placeholder="0"
                        renderDisplay={(value) => (
                          <Text fontSize="lg" fontWeight="semibold" color="gray.800">
                            {currencyFormatter.format(parseFloat(String(value)) || 0)}
                          </Text>
                        )}
                      />
                      <FieldRow label="DEFCON Level">
                        <Select
                          value={selectedAccount.defcon}
                          onChange={(e) => {
                            updateAccount(selectedAccount.name, {
                              defcon: parseInt(e.target.value, 10),
                            })
                          }}
                          size="md"
                        >
                          <option value={1}>1 - Very Dissatisfied</option>
                          <option value={2}>2 - Dissatisfied</option>
                          <option value={3}>3 - Neutral</option>
                          <option value={4}>4 - Satisfied</option>
                          <option value={5}>5 - Very Satisfied</option>
                        </Select>
                      </FieldRow>
                    </SimpleGrid>
                </Box>

                {/* Connected Email Accounts */}
                <Box
                  bg="white"
                  borderRadius="xl"
                  p={6}
                  border="1px solid"
                  borderColor="gray.200"
                  boxShadow="sm"
                >
                  <HStack justify="space-between" mb={4}>
                    <HStack spacing={2}>
                      <Heading size="md" color="gray.700">
                        Connected Email Accounts
                      </Heading>
                      <Badge colorScheme={connectedEmails.length >= 5 ? 'orange' : 'gray'} variant="subtle" fontSize="xs">
                        {connectedEmails.length}/5
                      </Badge>
                      <IconButton
                        aria-label="Refresh email accounts"
                        icon={<RepeatIcon />}
                        size="xs"
                        variant="ghost"
                        colorScheme="gray"
                        isLoading={loadingEmails}
                        isDisabled={!selectedCustomerId}
                        onClick={refreshConnectedEmails}
                        title="Refresh email accounts"
                      />
                    </HStack>
                    <Tooltip
                      label={connectedEmails.length >= 5 ? 'Limit reached (5). Disconnect one to add another.' : ''}
                      isDisabled={connectedEmails.length < 5}
                    >
                      <Button
                        size="sm"
                        colorScheme="blue"
                        onClick={handleConnectOutlook}
                        isDisabled={!selectedCustomerId || connectedEmails.length >= 5}
                      >
                        Connect Outlook
                      </Button>
                    </Tooltip>
                  </HStack>
                  
                  {/* Warning: Account missing database ID - ONLY for truly unsaved accounts */}
                  {selectedAccount && !selectedAccount.id && !selectedCustomerId && (
                    <Box py={3} px={4} mb={4} bg="orange.50" borderRadius="md" border="1px solid" borderColor="orange.200">
                      <Text fontSize="sm" color="orange.700">
                        This is a new customer that hasn't been saved to the database yet. Save it first to connect email accounts.
                      </Text>
                    </Box>
                  )}
                  
                  {/* Error message */}
                  {emailFetchError && (
                    <Box py={3} px={4} mb={4} bg="red.50" borderRadius="md" border="1px solid" borderColor="red.200">
                      <Text fontSize="sm" color="red.700">
                        Failed to load email accounts: {emailFetchError}
                      </Text>
                    </Box>
                  )}
                  
                  {loadingEmails ? (
                    <HStack justify="center" py={4}>
                      <Spinner size="sm" />
                      <Text color="gray.500">Loading email accounts...</Text>
                    </HStack>
                  ) : connectedEmails.length === 0 ? (
                    <Box py={4} textAlign="center">
                      <Text color="gray.500" mb={2}>No email accounts connected yet.</Text>
                    </Box>
                  ) : (
                    <Stack spacing={3}>
                      {connectedEmails.map((email) => (
                        <Box
                          key={email.id}
                          p={3}
                          bg="gray.50"
                          borderRadius="md"
                          border="1px solid"
                          borderColor="gray.200"
                        >
                          <HStack justify="space-between" mb={2}>
                            <HStack spacing={2}>
                              <Badge colorScheme={email.provider === 'outlook' ? 'blue' : 'gray'} textTransform="capitalize">
                                {email.provider}
                              </Badge>
                              <Badge colorScheme={email.isActive ? 'green' : 'red'} variant="subtle">
                                {email.isActive ? 'Active' : 'Inactive'}
                              </Badge>
                            </HStack>
                            <Text fontSize="xs" color="gray.500">
                              {new Date(email.createdAt).toLocaleDateString('en-GB', {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric',
                              })}
                            </Text>
                          </HStack>
                          <Text fontWeight="medium" fontSize="sm">
                            {email.emailAddress}
                          </Text>
                          {email.displayName && (
                            <Text fontSize="xs" color="gray.500">
                              {email.displayName}
                            </Text>
                          )}
                        </Box>
                      ))}
                    </Stack>
                  )}
                </Box>

                {/* Client Profile Summary */}
                <Box
                  bg="white"
                  borderRadius="xl"
                  p={6}
                  border="1px solid"
                  borderColor="gray.200"
                  boxShadow="sm"
                >
                  <Heading size="md" mb={4} color="gray.700">
                    Client Profile Summary
                  </Heading>
                  <SimpleGrid columns={{ base: 1, md: 2 }} gap={4}>
                    <FieldRow label="Target Area">
                      <Text fontSize="sm" color={clientProfileStats?.targetArea ? 'gray.700' : 'gray.400'}>
                        {clientProfileStats?.targetArea || 'Not set'}
                      </Text>
                    </FieldRow>
                    <FieldRow label="Accreditations">
                      <Badge colorScheme={clientProfileStats?.accreditations ? 'teal' : 'gray'}>
                        {clientProfileStats?.accreditations || 0} uploaded
                      </Badge>
                    </FieldRow>
                    <FieldRow label="Job Sectors">
                      <Badge colorScheme={clientProfileStats?.sectors ? 'purple' : 'gray'}>
                        {clientProfileStats?.sectors || 0} selected
                      </Badge>
                    </FieldRow>
                    <FieldRow label="Job Roles">
                      <Badge colorScheme={clientProfileStats?.roles ? 'blue' : 'gray'}>
                        {clientProfileStats?.roles || 0} selected
                      </Badge>
                    </FieldRow>
                    <FieldRow label="Social Links">
                      <Badge colorScheme={clientProfileStats?.socialLinks ? 'green' : 'gray'}>
                        {clientProfileStats?.socialLinks || 0} linked
                      </Badge>
                    </FieldRow>
                  </SimpleGrid>
                </Box>

                {/* About Section */}
                <Box
                  bg="white"
                  borderRadius="xl"
                  p={6}
                  border="1px solid"
                  borderColor="gray.200"
                  boxShadow="sm"
                >
                  <Heading size="md" color="gray.700" mb={4}>
                    About
                  </Heading>
                  <Box
                    p={4}
                    borderRadius="lg"
                    border="1px solid"
                    borderColor="gray.100"
                    bg="gray.50"
                  >
                    {renderAboutField(
                      selectedAccount.aboutSections,
                      expandedAbout[selectedAccount.name],
                      () => handleToggleAbout(selectedAccount.name),
                      selectedAccount.socialMedia || [],
                      selectedAccount.aboutSections.headquarters,
                      selectedAccount.website,
                      async (newWebsite: string) => {
                        const normalized = normalizeCustomerWebsite(newWebsite)
                        updateAccount(selectedAccount.name, { website: normalized })
                        stopEditing(selectedAccount.name, 'website')
                        
                        // Auto-trigger AI enrichment when website is updated
                        if (normalized && isServerSourceOfTruth) {
                          try {
                            const customersResponse = await api.get<CustomerApi[]>('/api/customers')
                            if (!customersResponse.error && customersResponse.data) {
                              const customerApi = customersResponse.data.find((c) => c.name === selectedAccount.name)
                              if (customerApi) {
                                // Trigger enrichment in background
                                await api.post(`/api/customers/${customerApi.id}/enrich-about`, {})
                                
                                // Reload account data
                                const updatedResponse = await api.get<CustomerApi[]>('/api/customers')
                                if (!updatedResponse.error && updatedResponse.data) {
                                  const updatedCustomer = updatedResponse.data.find((c) => c.id === customerApi.id)
                                  if (updatedCustomer) {
                                    const updatedAccount = buildAccountFromCustomer(updatedCustomer)
                                    updateAccountSilent(selectedAccount.name, updatedAccount)
                                    setSelectedAccount(updatedAccount)
                                  }
                                }
                                
                                toast({
                                  title: 'Company data updated',
                                  description: 'Enriched company information from website',
                                  status: 'success',
                                  duration: 3000,
                                  isClosable: true,
                                })
                              }
                            }
                          } catch (error) {
                            // Silent fail - enrichment is optional
                            console.log('Background enrichment failed:', error)
                          }
                        } else if (normalized && !isServerSourceOfTruth) {
                          void populateAccountData({ ...selectedAccount, website: normalized }).then((populated) => {
                            if (populated.aboutSource === 'web') {
                              updateAccountSilent(selectedAccount.name, populated)
                            }
                          })
                        }
                      },
                      isFieldEditing(selectedAccount.name, 'website'),
                      () => startEditing(selectedAccount.name, 'website'),
                      () => stopEditing(selectedAccount.name, 'website'),
                    )}
                  </Box>
                </Box>

                {/* Business Details Section */}
                <Box
                  bg="white"
                  borderRadius="xl"
                  p={6}
                  border="1px solid"
                  borderColor="gray.200"
                  boxShadow="sm"
                >
                  <Heading size="md" mb={4} color="gray.700">
                    Business Details
                  </Heading>
                  <SimpleGrid columns={{ base: 1, md: 2 }} gap={4}>
                    <FieldRow label="Target Location">
                      <Box position="relative">
                        <TargetLocationMultiSelect
                          locations={targetLocationsMap[selectedAccount.name] ?? selectedAccount.targetLocation ?? []}
                          onLocationsChange={(locations) => {
                            setTargetLocationsMap((prev) => ({
                              ...prev,
                              [selectedAccount.name]: locations,
                            }))
                            updateAccount(selectedAccount.name, { targetLocation: locations })
                          }}
                        />
                      </Box>
                    </FieldRow>

                    <FieldRow label="Target Title">
                          <Input
                            list="target-titles"
                            value={selectedAccount.targetTitle}
                            onChange={(e) => {
                              const value = e.target.value
                              updateAccount(selectedAccount.name, { targetTitle: value })
                              addTargetTitle(value)
                            }}
                            placeholder="Enter or select target title"
                        size="md"
                          />
                          <datalist id="target-titles">
                            {targetTitlesList.map((title) => (
                              <option key={title} value={title} />
                            ))}
                          </datalist>
                    </FieldRow>

                    <FieldRow label="Google Sheets Link">
                      <EditableField
                        value={selectedAccount.clientLeadsSheetUrl || ''}
                        onSave={(value) => {
                          const nextValue = typeof value === 'string' ? value.trim() : ''
                          updateAccount(selectedAccount.name, {
                            clientLeadsSheetUrl: nextValue,
                          })
                          stopEditing(selectedAccount.name, 'clientLeadsSheetUrl')
                        }}
                        onCancel={() => stopEditing(selectedAccount.name, 'clientLeadsSheetUrl')}
                        isEditing={isFieldEditing(selectedAccount.name, 'clientLeadsSheetUrl')}
                        onEdit={() => startEditing(selectedAccount.name, 'clientLeadsSheetUrl')}
                        label=""
                        type="url"
                        placeholder="https://docs.google.com/spreadsheets/d/..."
                        renderDisplay={(value) => (
                          value ? (
                            <Link
                              href={String(value)}
                              isExternal
                              color="text.muted"
                              fontSize="md"
                              fontWeight="medium"
                              display="inline-flex"
                              alignItems="center"
                              gap={2}
                              onClick={(e) => {
                                e.preventDefault()
                                window.open(String(value), '_blank')
                                emit('navigateToLeads', { accountName: selectedAccount.name })
                              }}
                            >
                              Open Google Sheets
                              <ExternalLinkIcon />
                            </Link>
                          ) : <Text fontSize="md" color="gray.400">No Google Sheets link set</Text>
                        )}
                      />
                    </FieldRow>
                  </SimpleGrid>
                </Box>

                {/* Contract & Agreements Section */}
                <Box
                  bg="white"
                  borderRadius="xl"
                  p={6}
                  border="1px solid"
                  borderColor="gray.200"
                  boxShadow="sm"
                >
                  <Heading size="md" mb={4} color="gray.700">
                    Contract & Agreements
                  </Heading>
                  <SimpleGrid columns={{ base: 1, md: 2 }} gap={4}>
                    <FieldRow label="Contract Start Date">
                      <Input
                        type="date"
                        value={selectedAccount.contractStart}
                        onChange={(e) => {
                          updateAccount(selectedAccount.name, { contractStart: e.target.value })
                        }}
                        size="md"
                      />
                    </FieldRow>
                    <FieldRow label="Contract End Date">
                      <Input
                        type="date"
                        value={selectedAccount.contractEnd}
                        onChange={(e) => {
                          updateAccount(selectedAccount.name, { contractEnd: e.target.value })
                        }}
                        size="md"
                      />
                    </FieldRow>
                    <FieldRow label="Days Per Week">
                      <Select
                        value={selectedAccount.days}
                        onChange={(e) => {
                          updateAccount(selectedAccount.name, {
                            days: parseInt(e.target.value, 10),
                          })
                        }}
                        size="md"
                      >
                        <option value={1}>1 day</option>
                        <option value={2}>2 days</option>
                        <option value={3}>3 days</option>
                        <option value={4}>4 days</option>
                        <option value={5}>5 days</option>
                      </Select>
                    </FieldRow>
                    <FieldRow label="Agreements">
                      <Stack spacing={3}>
                        <Input
                          type="file"
                          accept=".pdf,.doc,.docx,.txt"
                          onChange={(e) => {
                            const file = e.target.files?.[0]
                            if (file) {
                              const newFile: AgreementFile = {
                                id: Date.now().toString(),
                                name: file.name,
                                url: URL.createObjectURL(file),
                                uploadedAt: new Date().toISOString(),
                              }
                              updateAccount(selectedAccount.name, {
                                agreements: [...(selectedAccount.agreements || []), newFile],
                              })
                            }
                          }}
                          size="md"
                          display="none"
                          id={`agreement-upload-${selectedAccount.name}`}
                        />
                        <Button
                          as="label"
                          htmlFor={`agreement-upload-${selectedAccount.name}`}
                          leftIcon={<AttachmentIcon />}
                          size="md"
                          variant="outline"
                          cursor="pointer"
                        >
                          Attach Agreement
                        </Button>
                        {(selectedAccount.agreements || []).length > 0 && (
                          <Stack spacing={2} mt={2}>
                            {(selectedAccount.agreements || []).map((file) => (
                              <Box
                                key={file.id}
                                p={3}
                                border="1px solid"
                                borderColor="gray.200"
                                borderRadius="md"
                                bg="white"
                                display="flex"
                                justifyContent="space-between"
                                alignItems="center"
                              >
                                <Link href={file.url} isExternal color="text.muted" fontSize="md" fontWeight="medium">
                                  {file.name}
                                </Link>
                                <IconButton
                                  aria-label="Remove file"
                                  icon={<DeleteIcon />}
                                  size="sm"
                                  variant="ghost"
                                  colorScheme="gray"
                                  onClick={() => {
                                    updateAccount(selectedAccount.name, {
                                      agreements: (selectedAccount.agreements || []).filter(
                                        (f) => f.id !== file.id,
                                      ),
                                    })
                                  }}
                                />
                              </Box>
                            ))}
                          </Stack>
                        )}
                      </Stack>
                    </FieldRow>
                  </SimpleGrid>
                </Box>

                {/* Performance & Metrics Section */}
                <Box
                  bg="white"
                  borderRadius="xl"
                  p={6}
                  border="1px solid"
                  borderColor="gray.200"
                  boxShadow="sm"
                >
                  <Heading size="md" mb={4} color="gray.700">
                    Performance & Metrics
                  </Heading>
                  <SimpleGrid columns={{ base: 1, md: 2, lg: 4 }} gap={4}>
                    {fieldConfig
                      .filter(
                        (field) =>
                          !['Sector', 'Target Location', 'Target Title', 'Monthly Spent Pounds', 'Agreements', 'Client Leads', 'DEFCON', 'Contract Start', 'Contract End', 'Days'].includes(
                            field.label,
                          ),
                      )
                      .map((field) => {
                        const fieldKey = field.label.toLowerCase().replace(/\s+/g, '')
                        const isEditing = isFieldEditing(selectedAccount.name, fieldKey)
                        
                        // Handle editable numeric fields (Weekly Target, Monthly Target)
                        if (['Weekly Target', 'Monthly Target'].includes(field.label)) {
                          const fieldValue = field.label === 'Weekly Target' ? selectedAccount.weeklyTarget : selectedAccount.monthlyTarget
                          
                          return (
                            <EditableField
                              key={`${selectedAccount.name}-${field.label}`}
                              value={fieldValue}
                              onSave={(value) => {
                                const updates: Partial<Account> = {}
                                if (field.label === 'Weekly Target') updates.weeklyTarget = Number(value)
                                else if (field.label === 'Monthly Target') updates.monthlyTarget = Number(value)
                                updateAccount(selectedAccount.name, updates)
                                stopEditing(selectedAccount.name, fieldKey)
                              }}
                              onCancel={() => stopEditing(selectedAccount.name, fieldKey)}
                              isEditing={isEditing}
                              onEdit={() => startEditing(selectedAccount.name, fieldKey)}
                              label={field.label}
                              type="number"
                            />
                          )
                        }
                        
                        // Default rendering for other fields
                        return (
                          <FieldRow
                            key={`${selectedAccount.name}-${field.label}`}
                            label={field.label}
                          >
                            {field.render(selectedAccount, setSelectedContact)}
                          </FieldRow>
                        )
                      })}
                  </SimpleGrid>
                </Box>

                {/* Notes & Calendar Section */}
                <SimpleGrid columns={{ base: 1, lg: 2 }} gap={6}>
                  <Box
                    bg="white"
                    borderRadius="xl"
                    p={6}
                    border="1px solid"
                    borderColor="gray.200"
                    boxShadow="sm"
                  >
                    <Heading size="md" mb={4} color="gray.700">
                      Notes
                    </Heading>
                    <Box
                      p={4}
                      borderRadius="lg"
                      border="1px solid"
                      borderColor="gray.100"
                      bg="gray.50"
                    >
                      <NotesSection account={selectedAccount} updateAccount={updateAccount} toast={toast} />
                    </Box>
                  </Box>
                  <Box
                    bg="white"
                    borderRadius="xl"
                    p={6}
                    border="1px solid"
                    borderColor="gray.200"
                    boxShadow="sm"
                  >
                    <Heading size="md" mb={4} color="gray.700">
                      Upcoming Events
                    </Heading>
                    <UpcomingEventsSection account={selectedAccount} />
                  </Box>
                </SimpleGrid>

                {/* Calendar Section */}
                <Box
                  bg="white"
                  borderRadius="xl"
                  p={6}
                  border="1px solid"
                  borderColor="gray.200"
                  boxShadow="sm"
                >
                  <Heading size="md" mb={4} color="gray.700">
                    Calendar
                  </Heading>
                  <CalendarSection account={selectedAccount} />
                </Box>

                {/* Delete Account Section */}
                <Box
                  bg="red.50"
                  borderRadius="xl"
                  p={6}
                  border="1px solid"
                  borderColor="red.200"
                >
                  <Heading size="md" mb={4} color="text.muted">
                    Danger Zone
                  </Heading>
                    <Button
                      colorScheme="gray"
                      variant="outline"
                      leftIcon={<DeleteIcon />}
                      onClick={onDeleteModalOpen}
                    size="md"
                    >
                      Delete Account
                    </Button>
                  </Box>
                </Stack>
              </DrawerBody>
            </DrawerContent>
          </Drawer>
        )}

        {/* Delete Account Confirmation Modal */}
        {selectedAccount && (
          <Modal isOpen={isDeleteModalOpen} onClose={onDeleteModalClose}>
            <ModalOverlay />
            <ModalContent>
              <ModalHeader>Delete Account</ModalHeader>
              <ModalCloseButton />
              <ModalBody>
                <Text>
                  Are you sure you want to delete <strong>{selectedAccount.name}</strong>? This action cannot be undone.
                </Text>
              </ModalBody>
              <ModalFooter>
                <Button variant="ghost" mr={3} onClick={onDeleteModalClose}>
                  Cancel
                </Button>
                <Button
                  colorScheme="gray"
                  onClick={() => {
                    if (selectedAccount) {
                      deleteAccount(selectedAccount.name)
                      onDeleteModalClose()
                      handleCloseDrawer()
                    }
                  }}
                >
                  Delete
                </Button>
              </ModalFooter>
            </ModalContent>
          </Modal>
        )}

      {selectedContact && (
        <Drawer
          isOpen={true}
          placement="right"
          size="md"
          onClose={() => setSelectedContact(null)}
          closeOnOverlayClick={true}
          closeOnEsc={true}
        >
          <DrawerOverlay bg="blackAlpha.600" />
          <DrawerContent>
            <DrawerCloseButton />
            <DrawerHeader>
              <Stack spacing={3}>
                <Stack direction="row" justify="space-between" align="center">
                  <Stack spacing={1}>
                    <Heading size="lg">{selectedContact.name}</Heading>
                    <Text color="gray.500">{selectedContact.title}</Text>
                  </Stack>
                  <Button variant="outline" onClick={() => setSelectedContact(null)}>
                    Close
                  </Button>
                </Stack>
              </Stack>
            </DrawerHeader>
            <DrawerBody>
              <Stack spacing={6}>
                <Box textAlign="center" py={4}>
                  <Avatar
                    size="2xl"
                    name={selectedContact.name}
                    bg="teal.50"
                    border="3px solid"
                    borderColor="teal.200"
                  />
                </Box>

                <Divider />

                <SimpleGrid columns={1} gap={6}>
                  <FieldRow label="Full Name">
                    <Text>{selectedContact.name}</Text>
                  </FieldRow>

                  <FieldRow label="Title">
                    <Text>{selectedContact.title}</Text>
                  </FieldRow>

                  <FieldRow label="Email Address">
                    <Link href={`mailto:${selectedContact.email}`} color="text.muted" isExternal>
                      {selectedContact.email}
                    </Link>
                  </FieldRow>

                  <FieldRow label="Phone Number">
                    <Link href={`tel:${selectedContact.phone}`} color="text.muted">
                      {selectedContact.phone}
                    </Link>
                  </FieldRow>

                  <FieldRow label="Account">
                    <Link
                      color="text.muted"
                      fontWeight="medium"
                      cursor="pointer"
                      onClick={(e) => {
                        e.preventDefault()
                        setSelectedContact(null)
                        const account = accountsData.find((acc) => acc.name === selectedContact.account)
                        if (account) {
                          setSelectedAccount(account)
                        }
                      }}
                      _hover={{ textDecoration: 'underline' }}
                    >
                      {selectedContact.account}
                    </Link>
                  </FieldRow>

                  <FieldRow label="Tier">
                    <Badge colorScheme={selectedContact.tier === 'Decision maker' ? 'purple' : 'blue'}>
                      {selectedContact.tier}
                    </Badge>
                  </FieldRow>

                  <FieldRow label="Status">
                    <Badge
                      colorScheme={
                        selectedContact.status === 'Engaged' || selectedContact.status === 'Active'
                          ? 'green'
                          : selectedContact.status === 'Nurture'
                            ? 'yellow'
                            : 'gray'
                      }
                    >
                      {selectedContact.status}
                    </Badge>
                  </FieldRow>

                  <FieldRow label="Social Media">
                    {(selectedContact.socialMedia || []).length > 0 ? (
                      <Wrap spacing={2}>
                        {(selectedContact.socialMedia || []).map((profile) => (
                          <WrapItem key={profile.url}>
                            <Link
                              href={profile.url}
                              isExternal
                              color="text.muted"
                              fontSize="sm"
                              display="inline-flex"
                              alignItems="center"
                              gap={1}
                            >
                              {profile.label}
                              <ExternalLinkIcon />
                            </Link>
                          </WrapItem>
                        ))}
                      </Wrap>
                    ) : (
                      <Text fontSize="sm" color="gray.500">
                        No social profiles stored yet.
                      </Text>
                    )}
                  </FieldRow>
                </SimpleGrid>
              </Stack>
            </DrawerBody>
          </DrawerContent>
        </Drawer>
      )}
    </>
  )
}

export default AccountsTab