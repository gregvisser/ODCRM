import { useEffect, useState, useRef, type ReactNode } from 'react'
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
  NumberInputStepper,
  NumberIncrementStepper,
  NumberDecrementStepper,
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
} from '@chakra-ui/react'
import { ExternalLinkIcon, SearchIcon, AttachmentIcon, DeleteIcon, EditIcon, CheckIcon, CloseIcon, RepeatIcon } from '@chakra-ui/icons'
import { MdCalendarToday, MdEvent, MdChevronLeft, MdChevronRight } from 'react-icons/md'
import { emit, on } from '../platform/events'
import { OdcrmStorageKeys } from '../platform/keys'
import { getItem, getJson, isStorageAvailable, setItem, setJson } from '../platform/storage'

type Contact = {
  name: string
  title?: string
  account: string
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
  account: string
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
}

type AgreementFile = {
  id: string
  name: string
  url: string
  uploadedAt: string
}

export type Account = {
  name: string
  website: string
  aboutSections: AboutSections
  sector: string
  socialMedia: SocialProfile[]
  status: 'Active' | 'Inactive' | 'On Hold'
  targetLocation: string[]
  targetTitle: string
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
const STORAGE_KEY_ABOUT_SECTIONS = OdcrmStorageKeys.aboutSections
const STORAGE_KEY_SECTORS = OdcrmStorageKeys.sectors
const STORAGE_KEY_TARGET_LOCATIONS = OdcrmStorageKeys.targetLocations
const STORAGE_KEY_MARKETING_LEADS = OdcrmStorageKeys.marketingLeads
const STORAGE_KEY_DELETED_ACCOUNTS = OdcrmStorageKeys.deletedAccounts

// Lead type for marketing leads
type Lead = {
  [key: string]: string
  accountName: string
}

// Load leads from storage
function loadLeadsFromStorage(): Lead[] {
  const parsed = getJson<Lead[]>(STORAGE_KEY_MARKETING_LEADS)
  return parsed && Array.isArray(parsed) ? parsed : []
}

function loadContactsFromStorage(): StoredContact[] {
  const parsed = getJson<StoredContact[]>(OdcrmStorageKeys.contacts)
  return parsed && Array.isArray(parsed) ? parsed : []
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
      account: canonicalAccount('OCS'),
      name: 'Chris Piper',
      email: 'Chris.piper@ocs.com',
      phone: '7484171055',
      title: '',
      tier: 'Decision maker',
      status: 'Active',
    },
    {
      id: 'seed-beauparc-graeme-knight',
      account: canonicalAccount('Beauparc'),
      name: 'Graeme Knight',
      email: 'Graeme.Knight@beauparc.co.uk',
      phone: '7966520354',
      title: '',
      tier: 'Decision maker',
      status: 'Active',
    },
    {
      id: 'seed-octavian-sanjay-patel',
      account: canonicalAccount('Octavian'),
      name: 'Sanjay Patel',
      email: 's.patel@octaviangr.com',
      phone: '7432809977',
      title: '',
      tier: 'Decision maker',
      status: 'Active',
    },
    {
      id: 'seed-legionella-steve-morris',
      account: canonicalAccount('Legionella & Fire Safe'),
      name: 'Steve Morris',
      email: 'Steve.Morris@legionellaandfiresafe.co.uk',
      phone: '7970010055',
      title: '',
      tier: 'Decision maker',
      status: 'Active',
    },
    {
      id: 'seed-morson-adam-simms',
      account: canonicalAccount('Morson'),
      name: 'Adam Simms',
      email: 'adam.sims@morsonfm.co.uk',
      phone: '7977124757',
      title: '',
      tier: 'Decision maker',
      status: 'Active',
    },
    {
      id: 'seed-verve-raphael-barreto',
      account: canonicalAccount('Verve Connect'),
      name: 'Rephael Barreto',
      email: 'raphael.barreto@verveconnect.co.uk',
      phone: '7508241884',
      title: '',
      tier: 'Decision maker',
      status: 'Active',
    },
    {
      id: 'seed-shield-dan-stewart',
      account: canonicalAccount('Shield'),
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
      account: canonicalAccount('Protech'),
      name: 'David Mclean',
      title: 'MD',
      email: 'David.mclean@protechroofing.co.uk',
      phone: '07977497239',
      tier: 'Decision maker',
      status: 'Active',
    },
    {
      id: 'seed-greentheuk-francesca-tidd',
      account: canonicalAccount('green the UK'),
      name: 'Francesca Tidd',
      title: 'Senior Consultant',
      email: 'francesca@greentheuk.co.uk',
      phone: '07463689541',
      tier: 'Decision maker',
      status: 'Active',
    },
    {
      id: 'seed-greentheuk-sam',
      account: canonicalAccount('green the UK'),
      name: 'Sam',
      title: 'Senior Consultant',
      email: 'samuel@greentheuk.co.uk',
      phone: '07463654639',
      tier: 'Decision maker',
      status: 'Active',
    },
    {
      id: 'seed-greentheuk-xanthe-caldecoott',
      account: canonicalAccount('green the UK'),
      name: 'Xanthe Caldecott',
      title: 'Founder & MD',
      email: 'xanthe@greentheuk.com',
      phone: '07787433925',
      tier: 'Decision maker',
      status: 'Active',
    },
    {
      id: 'seed-renewable-andrew-grant',
      account: canonicalAccount('Renewable'),
      name: 'Andrew Grant',
      title: 'Founder & MD',
      email: 'andrew@rtp-ltd.co.uk',
      phone: '07947492105',
      tier: 'Decision maker',
      status: 'Active',
    },
    {
      id: 'seed-maxspace-bilal-khalid',
      account: canonicalAccount('Maxspace'),
      name: 'Bilal Khalid',
      title: 'MD',
      email: 'bilal@maxspaceprojects.co.uk',
      phone: '07533143997',
      tier: 'Decision maker',
      status: 'Active',
    },
    {
      id: 'seed-maxspace-carlos',
      account: canonicalAccount('Maxspace'),
      name: 'Carlos',
      title: '',
      email: 'carlos@maxspaceprojects.co.uk',
      phone: '02038242334',
      tier: 'Decision maker',
      status: 'Active',
    },
    {
      id: 'seed-vendease-dave-berman',
      account: canonicalAccount('Vendease'),
      name: 'Dave Berman',
      title: 'Co-Founder',
      email: 'dave.berman@vendease.co.uk',
      phone: '07801062593',
      tier: 'Decision maker',
      status: 'Active',
    },
    {
      id: 'seed-vendease-jonny-holmes',
      account: canonicalAccount('Vendease'),
      name: 'Jonny Holmes',
      title: 'Co-Founder',
      email: 'jonny.holmes@vendease.co.uk',
      phone: '02072237533',
      tier: 'Decision maker',
      status: 'Active',
    },
    {
      id: 'seed-papaya-nick-edwards',
      account: canonicalAccount('Papaya'),
      name: 'Nick Edwards',
      title: 'MD',
      email: 'nickedwards@papayauk.com',
      phone: '07917479279',
      tier: 'Decision maker',
      status: 'Active',
    },
    {
      id: 'seed-papaya-georgie-dronfield',
      account: canonicalAccount('Papaya'),
      name: 'Georgie Dronfield',
      title: 'Head of Operations',
      email: 'georgie.dronfield@papayauk.com',
      phone: '07384813193',
      tier: 'Decision maker',
      status: 'Active',
    },
    {
      id: 'seed-thomasfranks-tara-coots-williams',
      account: canonicalAccount('Thomas Franks'),
      name: 'Tara Coots-Williams',
      title: 'Business Development Co-ordinator',
      email: 'tara@thomasfranks.com',
      phone: '07496353179',
      tier: 'Decision maker',
      status: 'Active',
    },
    {
      id: 'seed-thomasfranks-claire-long',
      account: canonicalAccount('Thomas Franks'),
      name: 'Claire Long',
      title: 'Group Business Development Director',
      email: 'claire.long@thomasfranks.com',
      phone: '07562669134',
      tier: 'Decision maker',
      status: 'Active',
    },
    {
      id: 'seed-thomasfranks-james-pate',
      account: canonicalAccount('Thomas Franks'),
      name: 'James Pate',
      title: 'Sales Director',
      email: 'james.pate@thomasfranks.com',
      phone: '07534677844',
      tier: 'Decision maker',
      status: 'Active',
    },
    {
      id: 'seed-besafe-oliver-eginton',
      account: canonicalAccount('Be Safe Technologies'),
      name: 'Oliver Eginton',
      title: 'Sales Director',
      email: 'ollie@be-safetech.com',
      phone: '03338008150',
      tier: 'Decision maker',
      status: 'Active',
    },
    {
      id: 'seed-besafe-ross-sampson',
      account: canonicalAccount('Be Safe Technologies'),
      name: 'Ross Sampson',
      title: 'CMO',
      email: 'ross@be-safetech.com',
      phone: '31 0 648266368',
      tier: 'Decision maker',
      status: 'Active',
    },
    {
      id: 'seed-besafe-graham',
      account: canonicalAccount('Be Safe Technologies'),
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
  
  // Try DD.MM.YY or DD.MM.YYYY format (from the Google Sheet)
  const ddmmyy = dateStr.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})$/)
  if (ddmmyy) {
    const day = parseInt(ddmmyy[1], 10)
    const month = parseInt(ddmmyy[2], 10) - 1
    const year = parseInt(ddmmyy[3], 10) < 100 ? 2000 + parseInt(ddmmyy[3], 10) : parseInt(ddmmyy[3], 10)
    return new Date(year, month, day)
  }
  
  // Try standard date parsing
  const parsed = new Date(dateStr)
  return isNaN(parsed.getTime()) ? null : parsed
}

// Calculate weekly and monthly actuals from leads for an account
function calculateActualsFromLeads(accountName: string, leads: Lead[]): { weeklyActual: number; monthlyActual: number } {
  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const endOfToday = new Date(startOfToday)
  endOfToday.setDate(endOfToday.getDate() + 1)

  // Past week: 7 days ago to today
  const pastWeekStart = new Date(startOfToday)
  pastWeekStart.setDate(pastWeekStart.getDate() - 6)

  // Current month: first day of month to today
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

  // Filter leads for this account
  const accountLeads = leads.filter(lead => lead.accountName === accountName)

  let weeklyActual = 0
  let monthlyActual = 0

  accountLeads.forEach(lead => {
    // Try to find a date field
    const dateValue =
      lead['Date'] ||
      lead['date'] ||
      lead['Week'] ||
      lead['week'] ||
      lead['First Meeting Date'] ||
      lead['first meeting date'] ||
      ''

    const parsedDate = parseDate(dateValue)
    if (!parsedDate) return

    // Check if within past week
    if (parsedDate >= pastWeekStart && parsedDate < endOfToday) {
      weeklyActual++
    }

    // Check if within current month
    if (parsedDate >= monthStart && parsedDate < endOfToday) {
      monthlyActual++
    }
  })

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
function loadAccountsFromStorage(): Account[] {
  const parsed = getJson<Account[]>(STORAGE_KEY_ACCOUNTS)
  if (parsed && Array.isArray(parsed)) {
    console.log('✅ Loaded accounts from storage:', parsed.length)
    return parsed
  }
  return accounts
}

// Save accounts to storage
function saveAccountsToStorage(accountsData: Account[]) {
  setJson(STORAGE_KEY_ACCOUNTS, accountsData)
  setItem(STORAGE_KEY_ACCOUNTS_LAST_UPDATED, new Date().toISOString())
  console.log('💾 Saved accounts to storage')
}

// Load about sections from storage
function loadAboutSectionsFromStorage(): Record<string, AboutSections> {
  const parsed = getJson<Record<string, AboutSections>>(STORAGE_KEY_ABOUT_SECTIONS)
  return parsed && typeof parsed === 'object' ? parsed : {}
}

// Save about sections to storage
function saveAboutSectionsToStorage(sections: Record<string, AboutSections>) {
  setJson(STORAGE_KEY_ABOUT_SECTIONS, sections)
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

export const accounts: Account[] = [
  {
    name: 'Seven Clean Seas',
    website: 'https://sevencleanseas.com',
    aboutSections: {
      whatTheyDo:
        'Seven Clean Seas is a global ocean plastic recovery company that removes plastic waste from oceans and rivers, preventing it from entering marine ecosystems.',
      accreditations:
        'B-Corp certified, Ocean Bound Plastic certified, UN Global Compact signatory, Plastic Bank partner.',
      keyLeaders:
        'Founder & CEO Tom Peacock-Nazil, COO Raffi Schieir, Head of Impact Sarah Johnson.',
      companyProfile:
        '≈45 employees • HQ Singapore • Founded 2020 • Operations in Indonesia, Philippines, and Thailand.',
      recentNews:
        'Nov 2024: Launched new river plastic interception program in Indonesia; Sep 2024: Partnered with major FMCG brands for plastic offset programs.',
    },
    sector: 'Environmental Services',
    socialMedia: [
      { label: 'LinkedIn', url: 'https://linkedin.com/company/seven-clean-seas' },
      { label: 'Instagram', url: 'https://instagram.com/sevencleanseas' },
    ],
    status: 'Active',
    targetLocation: [],
    targetTitle: 'Sustainability Directors & ESG Managers',
    monthlySpendGBP: 15000,
    agreements: [],
    defcon: 5,
    contractStart: '2024-01-15',
    contractEnd: '2025-12-31',
    days: 3,
    contacts: 12,
    leads: 189,
    weeklyTarget: 50,
    weeklyActual: 48,
    monthlyTarget: 200,
    monthlyActual: 192,
    weeklyReport: 'https://share.opendoors/weekly/sevencleanseas',
    users: [
      { name: 'Tom Peacock-Nazil', role: 'Account lead' },
      { name: 'Raffi Schieir', role: 'Campaign ops' },
    ],
    clientLeadsSheetUrl: 'https://docs.google.com/spreadsheets/d/1o3GB09jMGYYrWOziOlheiQN-si9jnwVMFaFNV4tXhwA/edit?gid=0#gid=0',
  },
  {
    name: 'OCS',
    website: 'https://ocs.com/',
    aboutSections: {
      whatTheyDo: 'Information will be populated via AI research.',
      accreditations: 'Information will be populated via AI research.',
      keyLeaders: 'Information will be populated via AI research.',
      companyProfile: 'Information will be populated via AI research.',
      recentNews: 'Information will be populated via AI research.',
    },
    sector: 'To be determined',
    socialMedia: [],
    status: 'Active',
    targetLocation: [],
    targetTitle: '',
    monthlySpendGBP: 0,
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
      whatTheyDo: 'Information will be populated via AI research.',
      accreditations: 'Information will be populated via AI research.',
      keyLeaders: 'Information will be populated via AI research.',
      companyProfile: 'Information will be populated via AI research.',
      recentNews: 'Information will be populated via AI research.',
    },
    sector: 'To be determined',
    socialMedia: [],
    status: 'Active',
    targetLocation: [],
    targetTitle: '',
    monthlySpendGBP: 0,
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
      whatTheyDo: 'Information will be populated via AI research.',
      accreditations: 'Information will be populated via AI research.',
      keyLeaders: 'Information will be populated via AI research.',
      companyProfile: 'Information will be populated via AI research.',
      recentNews: 'Information will be populated via AI research.',
    },
    sector: 'To be determined',
    socialMedia: [],
    status: 'Active',
    targetLocation: [],
    targetTitle: '',
    monthlySpendGBP: 0,
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
      whatTheyDo: 'Information will be populated via AI research.',
      accreditations: 'Information will be populated via AI research.',
      keyLeaders: 'Information will be populated via AI research.',
      companyProfile: 'Information will be populated via AI research.',
      recentNews: 'Information will be populated via AI research.',
    },
    sector: 'To be determined',
    socialMedia: [],
    status: 'Active',
    targetLocation: [],
    targetTitle: '',
    monthlySpendGBP: 0,
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
      whatTheyDo: 'Information will be populated via AI research.',
      accreditations: 'Information will be populated via AI research.',
      keyLeaders: 'Information will be populated via AI research.',
      companyProfile: 'Information will be populated via AI research.',
      recentNews: 'Information will be populated via AI research.',
    },
    sector: 'To be determined',
    socialMedia: [],
    status: 'Active',
    targetLocation: [],
    targetTitle: '',
    monthlySpendGBP: 0,
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
    name: 'Verve Connect',
    website: 'https://verveconnect.co.uk/',
    aboutSections: {
      whatTheyDo: 'Information will be populated via AI research.',
      accreditations: 'Information will be populated via AI research.',
      keyLeaders: 'Information will be populated via AI research.',
      companyProfile: 'Information will be populated via AI research.',
      recentNews: 'Information will be populated via AI research.',
    },
    sector: 'To be determined',
    socialMedia: [],
    status: 'Active',
    targetLocation: [],
    targetTitle: '',
    monthlySpendGBP: 0,
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
      whatTheyDo: 'Information will be populated via AI research.',
      accreditations: 'Information will be populated via AI research.',
      keyLeaders: 'Information will be populated via AI research.',
      companyProfile: 'Information will be populated via AI research.',
      recentNews: 'Information will be populated via AI research.',
    },
    sector: 'To be determined',
    socialMedia: [],
    status: 'Active',
    targetLocation: [],
    targetTitle: '',
    monthlySpendGBP: 0,
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
      whatTheyDo: 'Information will be populated via AI research.',
      accreditations: 'Information will be populated via AI research.',
      keyLeaders: 'Information will be populated via AI research.',
      companyProfile: 'Information will be populated via AI research.',
      recentNews: 'Information will be populated via AI research.',
    },
    sector: 'To be determined',
    socialMedia: [],
    status: 'Active',
    targetLocation: [],
    targetTitle: '',
    monthlySpendGBP: 0,
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
    clientLeadsSheetUrl: 'https://docs.google.com/spreadsheets/d/1yat8uQsfaqSyu4C6TSbICurSqm-S3gLpvjwVufdvdt8/edit?gid=0#gid=0',
  },
  {
    name: 'Renewable Temp Power',
    website: 'https://renewabletemporarypower.co.uk/',
    aboutSections: {
      whatTheyDo: 'Information will be populated via AI research.',
      accreditations: 'Information will be populated via AI research.',
      keyLeaders: 'Information will be populated via AI research.',
      companyProfile: 'Information will be populated via AI research.',
      recentNews: 'Information will be populated via AI research.',
    },
    sector: 'To be determined',
    socialMedia: [],
    status: 'Active',
    targetLocation: [],
    targetTitle: '',
    monthlySpendGBP: 0,
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
    name: 'Papaya',
    website: 'https://www.papayaglobal.com',
    aboutSections: {
      whatTheyDo: 'Information will be populated via AI research.',
      accreditations: 'Information will be populated via AI research.',
      keyLeaders: 'Information will be populated via AI research.',
      companyProfile: 'Information will be populated via AI research.',
      recentNews: 'Information will be populated via AI research.',
    },
    sector: 'To be determined',
    socialMedia: [],
    status: 'Active',
    targetLocation: [],
    targetTitle: '',
    monthlySpendGBP: 0,
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
      whatTheyDo: 'Information will be populated via AI research.',
      accreditations: 'Information will be populated via AI research.',
      keyLeaders: 'Information will be populated via AI research.',
      companyProfile: 'Information will be populated via AI research.',
      recentNews: 'Information will be populated via AI research.',
    },
    sector: 'To be determined',
    socialMedia: [],
    status: 'Active',
    targetLocation: [],
    targetTitle: '',
    monthlySpendGBP: 0,
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
    name: 'FusionTek',
    website: 'https://fusiontek.co.uk/',
    aboutSections: {
      whatTheyDo: 'Information will be populated via AI research.',
      accreditations: 'Information will be populated via AI research.',
      keyLeaders: 'Information will be populated via AI research.',
      companyProfile: 'Information will be populated via AI research.',
      recentNews: 'Information will be populated via AI research.',
    },
    sector: 'To be determined',
    socialMedia: [],
    status: 'Active',
    targetLocation: [],
    targetTitle: '',
    monthlySpendGBP: 0,
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
      whatTheyDo: 'Information will be populated via AI research.',
      accreditations: 'Information will be populated via AI research.',
      keyLeaders: 'Information will be populated via AI research.',
      companyProfile: 'Information will be populated via AI research.',
      recentNews: 'Information will be populated via AI research.',
    },
    sector: 'To be determined',
    socialMedia: [],
    status: 'Active',
    targetLocation: [],
    targetTitle: '',
    monthlySpendGBP: 0,
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
      whatTheyDo: 'Information will be populated via AI research.',
      accreditations: 'Information will be populated via AI research.',
      keyLeaders: 'Information will be populated via AI research.',
      companyProfile: 'Information will be populated via AI research.',
      recentNews: 'Information will be populated via AI research.',
    },
    sector: 'To be determined',
    socialMedia: [],
    status: 'Active',
    targetLocation: [],
    targetTitle: '',
    monthlySpendGBP: 0,
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
      whatTheyDo: 'Information will be populated via AI research.',
      accreditations: 'Information will be populated via AI research.',
      keyLeaders: 'Information will be populated via AI research.',
      companyProfile: 'Information will be populated via AI research.',
      recentNews: 'Information will be populated via AI research.',
    },
    sector: 'To be determined',
    socialMedia: [],
    status: 'Active',
    targetLocation: [],
    targetTitle: '',
    monthlySpendGBP: 0,
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
      whatTheyDo: 'Information will be populated via AI research.',
      accreditations: 'Information will be populated via AI research.',
      keyLeaders: 'Information will be populated via AI research.',
      companyProfile: 'Information will be populated via AI research.',
      recentNews: 'Information will be populated via AI research.',
    },
    sector: 'To be determined',
    socialMedia: [],
    status: 'Active',
    targetLocation: [],
    targetTitle: '',
    monthlySpendGBP: 0,
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
    name: 'Vendease',
    website: 'https://official.vendease.com/',
    aboutSections: {
      whatTheyDo: 'Information will be populated via AI research.',
      accreditations: 'Information will be populated via AI research.',
      keyLeaders: 'Information will be populated via AI research.',
      companyProfile: 'Information will be populated via AI research.',
      recentNews: 'Information will be populated via AI research.',
    },
    sector: 'To be determined',
    socialMedia: [],
    status: 'Active',
    targetLocation: [],
    targetTitle: '',
    monthlySpendGBP: 0,
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

// Environment variable loading with debugging
const AI_ABOUT_ENDPOINT = import.meta.env?.VITE_AI_ABOUT_ENDPOINT
const AI_ABOUT_API_KEY = import.meta.env?.VITE_AI_ABOUT_API_KEY
const AI_ABOUT_MODEL = import.meta.env?.VITE_AI_ABOUT_MODEL ?? 'gpt-4o-mini'

// Backup AI configuration (fallback when primary hits limits)
const AI_BACKUP_ENDPOINT = import.meta.env?.VITE_AI_BACKUP_ENDPOINT
const AI_BACKUP_API_KEY = import.meta.env?.VITE_AI_BACKUP_API_KEY
const AI_BACKUP_MODEL = import.meta.env?.VITE_AI_BACKUP_MODEL ?? 'gpt-4o-mini'

// Clearbit Enrichment API configuration
const CLEARBIT_API_KEY = import.meta.env?.VITE_CLEARBIT_API_KEY
const CLEARBIT_ENRICHMENT_ENDPOINT = 'https://company.clearbit.com/v2/companies/find'

// Debug: Log environment variable status (only in development)
if (import.meta.env.DEV) {
  console.log('🔍 AI Configuration Status:', {
    clearbit: {
      apiKey: CLEARBIT_API_KEY ? '✅ Set (hidden)' : '❌ Missing',
      apiKeyPreview: CLEARBIT_API_KEY ? `${CLEARBIT_API_KEY.substring(0, 10)}...` : 'NOT SET',
    },
    primary: {
      endpoint: AI_ABOUT_ENDPOINT ? '✅ Set' : '❌ Missing',
      apiKey: AI_ABOUT_API_KEY ? '✅ Set (hidden)' : '❌ Missing',
      model: AI_ABOUT_MODEL,
      endpointValue: AI_ABOUT_ENDPOINT || 'NOT SET',
    },
    backup: {
      endpoint: AI_BACKUP_ENDPOINT ? '✅ Set' : '❌ Missing',
      apiKey: AI_BACKUP_API_KEY ? '✅ Set (hidden)' : '❌ Missing',
      model: AI_BACKUP_MODEL,
      endpointValue: AI_BACKUP_ENDPOINT || 'NOT SET',
      apiKeyPreview: AI_BACKUP_API_KEY ? `${AI_BACKUP_API_KEY.substring(0, 10)}...` : 'NOT SET',
    },
    allEnvVars: Object.keys(import.meta.env).filter((key) => key.startsWith('VITE_AI') || key.startsWith('VITE_CLEARBIT')),
  })
  
  // Warn if backup is configured but might have issues
  if (AI_BACKUP_ENDPOINT && AI_BACKUP_API_KEY) {
    if (!AI_BACKUP_ENDPOINT.includes('mistral') && !AI_BACKUP_ENDPOINT.includes('api.mistral')) {
      console.warn('⚠️ Backup endpoint might be incorrect. Expected Mistral endpoint: https://api.mistral.ai/v1/chat/completions')
    }
    if (!AI_BACKUP_API_KEY.startsWith('vot') && !AI_BACKUP_API_KEY.startsWith('xai-')) {
      console.warn('⚠️ Backup API key format might be incorrect. Mistral keys usually start with specific prefixes.')
    }
  }
}

// Helper function to check if AI is properly configured
const isAIConfigured = () => {
  const primaryConfigured = Boolean(AI_ABOUT_ENDPOINT && AI_ABOUT_API_KEY)
  const backupConfigured = Boolean(AI_BACKUP_ENDPOINT && AI_BACKUP_API_KEY)
  const configured = primaryConfigured || backupConfigured
  
  if (!configured && import.meta.env.DEV) {
    console.warn('⚠️ AI not configured. Check .env file and restart dev server.')
  }
  
  return configured
}

// Helper to check if error should trigger fallback (rate limits, usage limits, etc.)
const shouldFallback = (error: Error | string, statusCode?: number): boolean => {
  const errorMessage = typeof error === 'string' ? error : error.message
  const lowerMessage = errorMessage.toLowerCase()
  
  // Check for rate limits, usage limits, quota exceeded, etc.
  const shouldFallbackResult = (
    statusCode === 429 ||
    statusCode === 402 ||
    statusCode === 403 ||
    lowerMessage.includes('429') ||
    lowerMessage.includes('rate limit') ||
    lowerMessage.includes('usage limit') ||
    lowerMessage.includes('quota') ||
    lowerMessage.includes('billing') ||
    lowerMessage.includes('insufficient_quota') ||
    lowerMessage.includes('payment required') ||
    lowerMessage.includes('exceeded') ||
    lowerMessage.includes('limit exceeded') ||
    lowerMessage.includes('too many requests') ||
    lowerMessage.includes('primary service limit') || // Catch our own fallback-triggered errors
    lowerMessage.includes('service limit')
  )
  
  if (import.meta.env.DEV) {
    console.log('🔍 Fallback check:', {
      errorMessage: errorMessage.substring(0, 100),
      statusCode,
      shouldFallback: shouldFallbackResult,
    })
  }
  
  return shouldFallbackResult
}

// Retry helper for API calls with rate limit handling
async function retryApiCall<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  delay = 2000,
): Promise<T> {
  let lastError: Error | null = null
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error as Error
      const errorMessage = error instanceof Error ? error.message : String(error)
      
      // If rate limited, use exponential backoff with longer delays
      if (errorMessage.includes('429') || errorMessage.includes('Rate limit')) {
        const rateLimitDelay = delay * Math.pow(2, attempt) * 2 // Exponential backoff: 4s, 8s, 16s
        console.warn(`⏳ Rate limit hit (attempt ${attempt}/${maxRetries}). Waiting ${rateLimitDelay}ms before retry...`)
        if (attempt < maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, rateLimitDelay))
        }
      } else {
        console.warn(`API call attempt ${attempt}/${maxRetries} failed:`, error)
        if (attempt < maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, delay * attempt))
        }
      }
    }
  }
  
  throw lastError || new Error('API call failed after retries')
}

// Generic AI call function with automatic fallback to backup service
type AICallOptions = {
  model?: string
  temperature?: number
  messages: Array<{ role: string; content: string }>
}

async function callAIWithFallback(options: AICallOptions): Promise<{
  choices?: Array<{ message?: { content?: string } }>
  error?: { message?: string; type?: string }
}> {
  const { model, temperature = 0.2, messages } = options
  
  // Try primary AI service first
  if (AI_ABOUT_ENDPOINT && AI_ABOUT_API_KEY) {
    try {
      console.log('🔄 Attempting primary AI service...', {
        endpoint: AI_ABOUT_ENDPOINT,
        model: model || AI_ABOUT_MODEL,
        hasBackup: Boolean(AI_BACKUP_ENDPOINT && AI_BACKUP_API_KEY),
      })
      const response = await fetch(AI_ABOUT_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${AI_ABOUT_API_KEY}`,
        },
        body: JSON.stringify({
          model: model || AI_ABOUT_MODEL,
          temperature,
          messages,
        }),
      })

      const responseText = await response.text()
      let data: {
        choices?: Array<{ message?: { content?: string } }>
        error?: { message?: string; type?: string }
      }
      
      try {
        data = JSON.parse(responseText)
      } catch (parseError) {
        // If response is not ok and we can't parse JSON, it's likely an error
        if (!response.ok) {
          const statusCode = response.status
          // Preserve status code in error message for fallback detection
          if (shouldFallback(responseText, statusCode)) {
            console.warn(`⚠️ Primary AI service hit limits (${statusCode}). Falling back to backup service...`)
            throw new Error(`Primary service limit (${statusCode}): ${responseText || response.statusText}`)
          }
          throw new Error(`Primary AI error: ${responseText || response.statusText}`)
        }
        throw new Error(`Failed to parse response: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`)
      }

      // If we got an error response, check if we should fallback
      if (!response.ok || data.error) {
        const statusCode = response.status
        const errorMessage = data.error?.message || response.statusText || 'Unknown error'
        const errorType = data.error?.type || ''
        
        // Check both error message and type for usage limit indicators
        if (shouldFallback(errorMessage, statusCode) || shouldFallback(errorType, statusCode)) {
          console.warn(`⚠️ Primary AI service hit limits (${statusCode}). Falling back to backup service...`)
          // Preserve status code in error message for fallback detection
          throw new Error(`Primary service limit (${statusCode}): ${errorMessage}`)
        }
        
        // If it's not a fallback-worthy error, throw it
        throw new Error(`Primary AI error: ${errorMessage}`)
      }

      console.log('✅ Primary AI service succeeded')
      return data
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      console.error('❌ Primary AI service error:', {
        error: errorMessage,
        hasBackup: Boolean(AI_BACKUP_ENDPOINT && AI_BACKUP_API_KEY),
        backupEndpoint: AI_BACKUP_ENDPOINT || 'Not configured',
      })
      
      const shouldUseBackup = shouldFallback(errorMessage)
      console.log('🔍 Should use backup?', shouldUseBackup)
      
      // If we should fallback and backup is configured, try backup
      if (shouldUseBackup && AI_BACKUP_ENDPOINT && AI_BACKUP_API_KEY) {
        // Always use backup model for backup service (don't use primary model)
        const backupModel = AI_BACKUP_MODEL
        const backupServiceName = AI_BACKUP_ENDPOINT?.includes('openai') ? 'OpenAI' : 
                                  AI_BACKUP_ENDPOINT?.includes('mistral') ? 'Mistral' : 
                                  AI_BACKUP_ENDPOINT?.includes('anthropic') ? 'Claude' : 'Backup'
        console.log(`🔄 Switching to backup AI service (${backupServiceName})...`, {
          endpoint: AI_BACKUP_ENDPOINT,
          model: backupModel,
        })
        try {
          const backupResponse = await fetch(AI_BACKUP_ENDPOINT, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${AI_BACKUP_API_KEY}`,
            },
            body: JSON.stringify({
              model: backupModel, // Always use backup model, not the primary model
              temperature,
              messages,
            }),
          })
          
          console.log('📡 Backup response status:', backupResponse.status, backupResponse.statusText)

          const backupResponseText = await backupResponse.text()
          console.log('📝 Backup response (first 500 chars):', backupResponseText.substring(0, 500))
          
          let backupData: {
            choices?: Array<{ message?: { content?: string } }>
            error?: { message?: string; type?: string }
          }
          
          try {
            backupData = JSON.parse(backupResponseText)
            console.log('✅ Parsed backup response:', {
              hasChoices: Boolean(backupData.choices),
              hasError: Boolean(backupData.error),
              errorMessage: backupData.error?.message,
            })
          } catch (parseError) {
            console.error('❌ Failed to parse backup response:', parseError)
            console.error('Raw response:', backupResponseText.substring(0, 1000))
            if (!backupResponse.ok) {
              throw new Error(`Backup AI error: ${backupResponseText || backupResponse.statusText}`)
            }
            throw new Error(`Failed to parse backup response: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`)
          }

          if (!backupResponse.ok || backupData.error) {
            console.error('❌ Backup AI returned error:', {
              status: backupResponse.status,
              error: backupData.error,
            })
            throw new Error(`Backup AI error: ${backupData.error?.message || backupResponse.statusText}`)
          }

          console.log('✅ Backup AI service succeeded!', {
            choicesCount: backupData.choices?.length || 0,
            hasContent: Boolean(backupData.choices?.[0]?.message?.content),
          })
          return backupData
        } catch (backupError) {
          console.error('❌ Backup AI service also failed:', backupError)
          throw new Error(`Both primary and backup AI services failed. Primary: ${errorMessage}. Backup: ${backupError instanceof Error ? backupError.message : String(backupError)}`)
        }
      }
      
      // If we shouldn't fallback or backup isn't configured, throw the original error
      throw error
    }
  }
  
  // If primary isn't configured, try backup directly
  if (AI_BACKUP_ENDPOINT && AI_BACKUP_API_KEY) {
    // Always use backup model for backup service
    const backupModel = AI_BACKUP_MODEL
    console.log('🔄 Primary not configured, using backup AI service...', {
      endpoint: AI_BACKUP_ENDPOINT,
      model: backupModel,
    })
    const response = await fetch(AI_BACKUP_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${AI_BACKUP_API_KEY}`,
      },
      body: JSON.stringify({
        model: backupModel, // Always use backup model
        temperature,
        messages,
      }),
    })

    const responseText = await response.text()
    let data: {
      choices?: Array<{ message?: { content?: string } }>
      error?: { message?: string; type?: string }
    }
    
    try {
      data = JSON.parse(responseText)
    } catch (parseError) {
      if (!response.ok) {
        throw new Error(`Backup AI error: ${responseText || response.statusText}`)
      }
      throw new Error(`Failed to parse backup response: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`)
    }

    if (!response.ok || data.error) {
      throw new Error(`Backup AI error: ${data.error?.message || response.statusText}`)
    }

    return data
  }
  
  throw new Error('No AI service configured (neither primary nor backup)')
}

// Rate limiter removed - now using on-demand fetching via buttons to prevent rate limits

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

async function fetchLogoFromAI(account: Account): Promise<string | null> {
  if (!isAIConfigured()) {
    return null
  }

  try {
    return await retryApiCall(async () => {
      const data = await callAIWithFallback({
        model: AI_ABOUT_MODEL,
        temperature: 0.2,
        messages: [
          {
            role: 'system',
            content:
              'You are a logo finder assistant. Search the company website (especially the header, footer, and main page) for the official company logo. Also search the internet for the company logo. Return ONLY a valid, direct image URL (e.g., https://example.com/logo.png, https://example.com/assets/logo.svg, or https://cdn.example.com/logo.png). The URL must be publicly accessible and point directly to an image file. If you cannot find a logo, return the word "NOTFOUND".',
          },
          {
            role: 'user',
            content: `Find the official logo URL for ${account.name} by searching their website ${account.website} (check header, footer, and main page) and also search the internet. Return only the direct image URL, nothing else.`,
          },
        ],
      })

      const logoUrl = data.choices?.[0]?.message?.content?.trim()

      if (!logoUrl || logoUrl === 'NOTFOUND' || !logoUrl.startsWith('http')) {
        return null
      }

      return logoUrl
    })
  } catch (error) {
    console.warn('Failed to fetch logo from AI', { account: account.name, error })
    return null
  }
}

// Some customer logos don't resolve reliably via Clearbit/favicon (or their sites block hotlinking/fetching).
// We hard-pin the official logo assets for those customers here.
const HARDCODED_ACCOUNT_LOGOS: Record<string, string> = {
  Beauparc: 'https://beauparc.ie/wp-content/uploads/2017/12/logo.png',
  'Seven Clean Seas':
    'https://cdn.prod.website-files.com/64f7de2bc62f55fed197d14a/6763c26d6c9bf69e5e988fae_SCS-logo-white-animated.gif',
  Legionella: 'https://legionellacontrol.com/wp-content/uploads/2018/02/legionella-control-logo2x.png',
  'MaxSpace Projects':
    'https://maxspaceprojects.co.uk/wp-content/uploads/MaxSpace-Projects-Logo-Main-e1738719394741.webp',
  MaxSpace:
    'https://maxspaceprojects.co.uk/wp-content/uploads/MaxSpace-Projects-Logo-Main-e1738719394741.webp',
  'My Purchasing Partner': 'https://www.mypurchasingpartner.co.uk/wp-content/uploads/logo.svg',
  OCS: 'https://ocs.com/app/uploads/2024/09/OCS-Group-Logo-300x116.png',
  'Octavian Security':
    'https://www.octaviansecurity.com/wp-content/uploads/2020/07/octavian-logo-R-256x45-FINAL-e1593692669215.png',
  Papaya: 'https://www.papayaglobal.com/wp-content/uploads/2023/02/papaya-new-logo.svg',
  'P&R Morson FM': 'https://www.morsonfm.co.uk/wp-content/uploads/2021/12/PR-Morson-Logo.png',
  'Protech Roofing': 'https://protechroofing.co.uk/wp-content/uploads/2023/07/Protech-Roofing_Logo_Whitegold.svg',
  'Renewable Temp Power': 'https://renewabletemporarypower.co.uk/wp-content/uploads/2022/05/rtp-logo.svg',
  'Shield Pest Control':
    'https://shieldpestcontrol.co.uk/wp-content/uploads/2025/03/Updated-Shield-Company-Logo.webp',
  'Thomas Franks': 'https://thomasfranks.com/wp-content/uploads/2024/08/thomas-franks-logo.svg',
  'Be Safe Technologies': 'https://be-safetech.com/wp-content/uploads/2023/03/Besafe-logo-2.png',
  GreenTheUK: 'https://greentheuk.com/assets/images/assets/green-the-uk-logo.png',
  FusionTek: 'https://fusiontek.co.uk/wp-content/uploads/2023/01/2000-%D0%BF%D0%B8%D0%BA%D1%81%D0%B5%D0%BB%D0%B5%D0%B9.png',
  Vendease: 'https://www.google.com/s2/favicons?sz=128&domain=vendease.com',
  'Verve Connect': 'https://verveconnect.co.uk/wp-content/uploads/2018/11/verve-connect-footer-logo.svg',
}

const getAccountLogo = (
  account: Account,
  failedLogos?: Set<string>,
  aiLogos?: Record<string, string>,
) => {
  const dicebearFallback = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(account.name)}`

  // Prefer hard-pinned customer logos (unless they've failed to load).
  const hardcoded = HARDCODED_ACCOUNT_LOGOS[account.name]
  if (hardcoded && !failedLogos?.has(account.name)) {
    return hardcoded.startsWith('//') ? `https:${hardcoded}` : hardcoded
  }

  // If we have an AI-found logo, use it (unless it has failed to load).
  if (aiLogos?.[account.name] && !failedLogos?.has(account.name)) {
    const ai = aiLogos[account.name]
    return ai.startsWith('//') ? `https:${ai}` : ai
  }

  try {
    const hostname = new URL(account.website).hostname
    if (!hostname) return dicebearFallback

    // Remove 'www.' prefix if present for better Clearbit matching
    const cleanHostname = hostname.replace(/^www\./, '')
    // If Clearbit failed, fall back to Google's favicon service (usually still a recognizable logo mark).
    if (failedLogos?.has(account.name)) {
      return `https://www.google.com/s2/favicons?sz=128&domain=${encodeURIComponent(cleanHostname)}`
    }

    return `https://logo.clearbit.com/${cleanHostname}`
  } catch (error) {
    console.warn('Unable to derive logo from website', { account, error })
    return dicebearFallback
  }
}

// Helper to extract domain from website URL
function extractDomain(website: string): string | null {
  try {
    const url = new URL(website)
    return url.hostname.replace(/^www\./, '')
  } catch {
    return null
  }
}

// Fetch company data from Clearbit Enrichment API
async function fetchCompanyFromClearbit(account: Account): Promise<{
  sections: AboutSections
  socialMedia: SocialProfile[]
  sector?: string
} | null> {
  const domain = extractDomain(account.website)
  if (!domain) {
    console.warn(`Unable to extract domain from ${account.website}`)
    return null
  }

  // Always try Clearbit (even without API key - will fail gracefully)
  try {
    console.log(`🔍 Attempting Clearbit for ${account.name} (${domain})...`)
    
    const headers: HeadersInit = {}
    if (CLEARBIT_API_KEY) {
      headers.Authorization = `Bearer ${CLEARBIT_API_KEY}`
    }
    
    const response = await fetch(`${CLEARBIT_ENRICHMENT_ENDPOINT}?domain=${encodeURIComponent(domain)}`, {
      method: 'GET',
      headers,
    })

    if (response.status === 401 || response.status === 403) {
      console.log(`⚠️ Clearbit API key missing or invalid (${response.status}). Skipping Clearbit.`)
      return null
    }

    if (response.status === 404) {
      console.log(`⚠️ Company not found in Clearbit database: ${domain}`)
      return null
    }

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error')
      console.log(`⚠️ Clearbit API error (${response.status}):`, errorText.substring(0, 200))
      return null
    }

    const data = await response.json() as {
      name?: string
      description?: string
      domain?: string
      category?: {
        industry?: string
        sector?: string
        subIndustry?: string
      }
      metrics?: {
        employees?: number
        employeesRange?: string
        annualRevenue?: number
        marketCap?: number
      }
      geo?: {
        city?: string
        state?: string
        country?: string
        streetNumber?: string
        streetName?: string
        subPremise?: string
        postalCode?: string
        lat?: number
        lng?: number
      }
      foundedYear?: number
      type?: string
      tags?: string[]
      tech?: string[]
      site?: {
        phoneNumbers?: string[]
        emailAddresses?: string[]
      }
      linkedin?: {
        handle?: string
      }
      twitter?: {
        handle?: string
        id?: string
        bio?: string
        followers?: number
        following?: number
        location?: string
        site?: string
        avatar?: string
      }
      facebook?: {
        handle?: string
      }
      crunchbase?: {
        handle?: string
      }
    }

    console.log(`✅ Clearbit data received for ${account.name}`)

    // Build social media profiles
    const socialMedia: SocialProfile[] = []
    if (data.linkedin?.handle) {
      socialMedia.push({ label: 'LinkedIn', url: `https://linkedin.com/company/${data.linkedin.handle}` })
    }
    if (data.twitter?.handle) {
      socialMedia.push({ label: 'Twitter', url: `https://twitter.com/${data.twitter.handle}` })
    }
    if (data.facebook?.handle) {
      socialMedia.push({ label: 'Facebook', url: `https://facebook.com/${data.facebook.handle}` })
    }
    if (data.crunchbase?.handle) {
      socialMedia.push({ label: 'Crunchbase', url: `https://crunchbase.com/organization/${data.crunchbase.handle}` })
    }

    // Build company profile
    const locationParts: string[] = []
    if (data.geo?.city) locationParts.push(data.geo.city)
    if (data.geo?.state) locationParts.push(data.geo.state)
    if (data.geo?.country) locationParts.push(data.geo.country)
    const location = locationParts.length > 0 ? locationParts.join(', ') : 'Location not available'

    const employeeInfo = data.metrics?.employeesRange || 
                        (data.metrics?.employees ? `${data.metrics.employees} employees` : '') ||
                        'Company size not available'

    const companyProfile = `${employeeInfo}${location !== 'Location not available' ? ` • HQ ${location}` : ''}${data.foundedYear ? ` • Founded ${data.foundedYear}` : ''}`

    // Determine sector
    const sector = data.category?.sector || 
                   data.category?.industry || 
                   data.category?.subIndustry || 
                   data.tags?.[0] || 
                   ''

    // Build sections
    const sections: AboutSections = {
      whatTheyDo: data.description || 'Company description not available from Clearbit.',
      accreditations: data.tags && data.tags.length > 0 
        ? `Tags: ${data.tags.join(', ')}` 
        : 'No accreditations information available from Clearbit.',
      keyLeaders: 'Key leaders information not available from Clearbit. Use AI to fetch detailed leadership information.',
      companyProfile: companyProfile || 'Company profile information not available from Clearbit.',
      recentNews: 'Recent news information not available from Clearbit. Use AI to fetch recent news and announcements.',
    }

    return {
      sections,
      socialMedia,
      sector: sector || undefined,
    }
  } catch (error) {
    console.warn(`Failed to fetch Clearbit data for ${account.name}:`, error)
    return null
  }
}

async function fetchAboutSections(
  account: Account,
): Promise<{ sections: AboutSections; socialMedia: SocialProfile[] }> {
  // Always try Clearbit first (even without API key - will fail gracefully)
  const clearbitData = await fetchCompanyFromClearbit(account)
  
  if (clearbitData) {
    console.log(`✅ Using Clearbit data for ${account.name}`)
    
    // If Clearbit has basic info but missing detailed fields, we can enhance with AI
    const needsEnhancement = 
      clearbitData.sections.keyLeaders.includes('not available') ||
      clearbitData.sections.recentNews.includes('not available') ||
      clearbitData.sections.accreditations.includes('not available')
    
    if (needsEnhancement && isAIConfigured()) {
      console.log(`🔄 Clearbit data found but missing some details. Enhancing with AI for ${account.name}...`)
      try {
        // Try to enhance with AI (non-blocking - if it fails, use Clearbit data)
        const aiData = await callAIWithFallback({
          model: AI_ABOUT_MODEL,
          temperature: 0.2,
          messages: [
            {
              role: 'system',
              content:
                'You are an AI research assistant. Provide ONLY the missing information requested. Respond with strict minified JSON and no commentary.',
            },
            {
              role: 'user',
              content: `Based on Clearbit data, provide ONLY these missing details for ${account.name} (${account.website}):
- keyLeaders: List key leaders, executives, founders (names and titles)
- recentNews: Recent news, press releases, announcements from past 12-24 months with dates
- accreditations: ALL accreditations, certifications, awards, memberships, recognitions

Return JSON with only these keys.`,
            },
          ],
        })

        const rawContent = aiData.choices?.[0]?.message?.content
        if (rawContent) {
          try {
            const sanitized = rawContent.replace(/```json|```/g, '').trim()
            const aiParsed = JSON.parse(sanitized) as Partial<{
              keyLeaders?: string
              recentNews?: string
              accreditations?: string
            }>

            // Enhance Clearbit data with AI data where available
            if (aiParsed.keyLeaders && !aiParsed.keyLeaders.includes('not available')) {
              clearbitData.sections.keyLeaders = aiParsed.keyLeaders
            }
            if (aiParsed.recentNews && !aiParsed.recentNews.includes('not available')) {
              clearbitData.sections.recentNews = aiParsed.recentNews
            }
            if (aiParsed.accreditations && !aiParsed.accreditations.includes('not available')) {
              clearbitData.sections.accreditations = aiParsed.accreditations
            }
            
            console.log(`✅ Enhanced Clearbit data with AI for ${account.name}`)
          } catch (parseError) {
            console.warn(`⚠️ Failed to parse AI enhancement, using Clearbit data only`)
          }
        }
      } catch (aiError) {
        console.warn(`⚠️ AI enhancement failed, using Clearbit data only:`, aiError)
      }
    }
    
    return {
      sections: clearbitData.sections,
      socialMedia: clearbitData.socialMedia,
    }
  }

  // Fallback to AI if Clearbit doesn't have the company or API key is missing
  if (!isAIConfigured()) {
    console.warn(`AI not configured - skipping fetchAboutSections for ${account.name}`)
    return { sections: account.aboutSections, socialMedia: account.socialMedia }
  }

  console.log(`🔄 Clearbit didn't return data, using AI to fetch data for ${account.name}...`)
  return retryApiCall(async () => {
    console.log(`🔄 Making AI request for ${account.name}...`)
    
    const data = await callAIWithFallback({
      model: AI_ABOUT_MODEL,
      temperature: 0.2,
      messages: [
        {
          role: 'system',
          content:
            'You are an AI research assistant. Thoroughly search the company website and the internet for comprehensive information. Visit the company website, check About pages, press releases, news articles, and social media. Respond with strict minified JSON and no commentary.',
        },
        {
          role: 'user',
          content: `Conduct in-depth research on ${account.name} (website: ${account.website}). 

1. Visit their website and search the internet for comprehensive information.

2. Return JSON with these keys:
- whatTheyDo: Provide an in-depth overview of what the company does, their services, products, and business model. Be detailed and comprehensive.
- accreditations: List ALL accreditations, certifications, awards, memberships, and recognitions found on their website or through internet search. Include industry certifications, quality standards, professional memberships, etc.
- keyLeaders: List key leaders, executives, founders, and important personnel. Include names and titles/roles.
- companyProfile: Provide company size (number of employees), headquarters location (city and country), and founding year. Include any regional offices or locations if available.
- recentNews: List recent news, press releases, announcements, or significant events from the past 12-24 months. Include dates and URLs when available. Format as array of objects with {date, headline, url} where url is optional.
- socialProfiles: Array of objects with {label, url} for ALL social media presence found (LinkedIn, Facebook, Twitter/X, YouTube, Instagram, etc.). Include the full URLs.

Be thorough and comprehensive. Search the website extensively and use internet search to find all available information.`,
        },
      ],
    })

    console.log(`✅ AI response received for ${account.name}`, {
      hasChoices: Boolean(data.choices),
      choicesCount: data.choices?.length || 0,
    })

    const rawContent = data.choices?.[0]?.message?.content

    if (!rawContent) {
      console.warn(`⚠️ No content in AI response for ${account.name}`, data)
      throw new Error('No content in AI response')
    }

    console.log(`📝 Raw AI content for ${account.name} (first 200 chars):`, rawContent.substring(0, 200))

    try {
      const result = buildSectionsFromResponse(rawContent, account)
      console.log(`✅ Successfully parsed AI data for ${account.name}`)
      return result
    } catch (parseError) {
      console.error(`❌ Failed to parse AI response for ${account.name}:`, parseError)
      throw new Error(`Failed to parse AI response: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`)
    }
  }).catch((error) => {
    console.error(`❌ Failed to fetch AI data for ${account.name} after retries:`, error)
    throw error
  })
}

function buildSectionsFromResponse(
  content: string,
  account: Account,
): { sections: AboutSections; socialMedia: SocialProfile[] } {
  console.log(`🔍 Building sections from response for ${account.name}...`)
  console.log(`📄 Raw content length: ${content.length} chars`)
  console.log(`📄 First 500 chars:`, content.substring(0, 500))
  
  const sanitized = content.replace(/```json|```/g, '').trim()

  try {
    const parsed = JSON.parse(sanitized) as Partial<AboutSections & { socialProfiles?: SocialProfile[] }>

    console.log('✅ Successfully parsed JSON:', {
      hasWhatTheyDo: Boolean(parsed.whatTheyDo),
      hasAccreditations: Boolean(parsed.accreditations),
      hasKeyLeaders: Boolean(parsed.keyLeaders),
      hasCompanyProfile: Boolean(parsed.companyProfile),
      hasRecentNews: Boolean(parsed.recentNews),
      hasSocialProfiles: Boolean(parsed.socialProfiles),
    })

    // Extract social profiles
    const socialMedia: SocialProfile[] =
      parsed.socialProfiles && Array.isArray(parsed.socialProfiles)
        ? parsed.socialProfiles.filter(
            (profile): profile is SocialProfile =>
              typeof profile === 'object' &&
              profile !== null &&
              'label' in profile &&
              'url' in profile &&
              typeof profile.label === 'string' &&
              typeof profile.url === 'string',
          )
        : []

    // Helper to extract text from value (handles strings, objects, arrays)
    const extractText = (value: any): string => {
      if (!value) return ''
      if (typeof value === 'string') return value
      if (typeof value === 'object') {
        // If it's an array, format each item nicely
        if (Array.isArray(value)) {
          return value.map(item => {
            if (typeof item === 'string') return item
            if (typeof item === 'object' && item !== null) {
              // Format objects with name and title (for key leaders)
              if (item.name && item.title) {
                return `${item.name} (${item.title})`
              }
              // Format objects with date and headline (for recent news)
              if (item.date && item.headline) {
                return item.url ? `${item.date}: ${item.headline}` : `${item.date}: ${item.headline}`
              }
              // Format objects with city and country (for locations)
              if (item.city && item.country) {
                return `${item.city}, ${item.country}`
              }
              // Format company profile objects
              if (item.companySize || item.headquarters || item.foundingYear) {
                const parts: string[] = []
                if (item.companySize) parts.push(item.companySize)
                if (item.headquarters) {
                  const hq = typeof item.headquarters === 'object' 
                    ? `${item.headquarters.city || ''}, ${item.headquarters.country || ''}`.trim().replace(/^,|,$/g, '')
                    : String(item.headquarters)
                  if (hq) parts.push(hq)
                }
                if (item.foundingYear) parts.push(String(item.foundingYear))
                if (item.regionalOffices && Array.isArray(item.regionalOffices)) {
                  const offices = item.regionalOffices.map((office: any) => 
                    typeof office === 'object' && office.city && office.country
                      ? `${office.city}, ${office.country}`
                      : String(office)
                  ).join('; ')
                  if (offices) parts.push(offices)
                }
                return parts.join(' • ')
              }
              // For other objects, extract values without keys
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
        }
        // If it's a single object, try to extract meaningful text
        if (value.overview) return String(value.overview)
        if (value.description) return String(value.description)
        if (value.text) return String(value.text)
        // Format objects with common patterns
        if (value.name && value.title) {
          return `${value.name} (${value.title})`
        }
        if (value.date && value.headline) {
          return `${value.date}: ${value.headline}`
        }
        // Try to extract values without keys from the object
        const values = Object.entries(value)
          .filter(([k]) => !['id', 'url', 'link'].includes(k.toLowerCase()))
          .map(([, val]) => {
            if (typeof val === 'string' && val) return val
            if (Array.isArray(val) && val.length > 0) {
              return val.join(', ')
            }
            return null
          })
          .filter(Boolean)
          .join(' • ')
        return values || JSON.stringify(value)
      }
      return String(value)
    }

    // Build sections - only use parsed data if it's not empty and not placeholder text
    const isPlaceholder = (text: string | undefined | any) => {
      const textValue = typeof text === 'string' ? text : extractText(text)
      if (!textValue || textValue.trim() === '') return true
      const lower = textValue.toLowerCase()
      return lower.includes('information will be populated') || 
             lower.includes('not available') ||
             lower.includes('not available yet') ||
             lower.trim() === ''
    }

    // Helper to parse JSON strings if needed
    const parseIfJsonString = (value: any): any => {
      if (typeof value === 'string' && (value.trim().startsWith('{') || value.trim().startsWith('['))) {
        try {
          return JSON.parse(value)
        } catch {
          return value
        }
      }
      return value
    }

    // Extract text from parsed values (handles both strings and objects)
    // Also handle cases where values might be JSON strings
    const whatTheyDoText = extractText(parseIfJsonString(parsed.whatTheyDo))
    const accreditationsText = extractText(parseIfJsonString(parsed.accreditations))
    const keyLeadersText = extractText(parseIfJsonString(parsed.keyLeaders))
    const companyProfileText = extractText(parseIfJsonString(parsed.companyProfile))
    
    // For recentNews, preserve JSON structure if it's an array/object so URLs can be extracted later
    const recentNewsParsed = parseIfJsonString(parsed.recentNews)
    const recentNewsText = Array.isArray(recentNewsParsed) || (typeof recentNewsParsed === 'object' && recentNewsParsed !== null)
      ? JSON.stringify(recentNewsParsed) // Preserve structure for URL extraction
      : extractText(recentNewsParsed)

    const sections: AboutSections = {
      whatTheyDo: whatTheyDoText && !isPlaceholder(whatTheyDoText)
        ? whatTheyDoText.trim()
        : 'Company information not available.',
      accreditations: accreditationsText && !isPlaceholder(accreditationsText)
        ? accreditationsText.trim()
        : 'No accreditations information available.',
      keyLeaders: keyLeadersText && !isPlaceholder(keyLeadersText)
        ? keyLeadersText.trim()
        : 'Key leaders information not available.',
      companyProfile: companyProfileText && !isPlaceholder(companyProfileText)
        ? companyProfileText.trim()
        : 'Company profile information not available.',
      recentNews: recentNewsText && !isPlaceholder(recentNewsText)
        ? recentNewsText.trim()
        : 'Recent news information not available.',
    }

    // Verify we have at least one real field
    const hasRealData = !isPlaceholder(sections.whatTheyDo) || 
                        !isPlaceholder(sections.accreditations) ||
                        !isPlaceholder(sections.keyLeaders) ||
                        !isPlaceholder(sections.companyProfile) ||
                        !isPlaceholder(sections.recentNews)

    if (!hasRealData) {
      console.warn('⚠️ All parsed fields appear to be placeholders, using fallback')
      throw new Error('All parsed fields are placeholders')
    }

    console.log('✅ Built sections successfully:', {
      whatTheyDoLength: sections.whatTheyDo.length,
      accreditationsLength: sections.accreditations.length,
      socialMediaCount: socialMedia.length,
    })

    return {
      sections,
      socialMedia,
    }
  } catch (error) {
    console.error('❌ Unable to parse AI response:', error)
    console.error('Content that failed to parse:', content.substring(0, 1000))
    
    // Return error message instead of placeholder
    throw new Error(`Failed to parse AI response: ${error instanceof Error ? error.message : 'Unknown parsing error'}`)
  }
}

async function fetchSector(account: Account): Promise<string> {
  // Always try Clearbit first (even without API key - will fail gracefully)
  const clearbitData = await fetchCompanyFromClearbit(account)
  if (clearbitData?.sector) {
    console.log(`✅ Using Clearbit sector for ${account.name}: ${clearbitData.sector}`)
    return clearbitData.sector
  }

  // Fallback to AI
  if (!isAIConfigured()) {
    return account.sector
  }

  try {
    return await retryApiCall(async () => {
      const data = await callAIWithFallback({
        model: AI_ABOUT_MODEL,
        temperature: 0.2,
        messages: [
          {
            role: 'system',
            content:
              'You are a business classification assistant. Identify the primary business sector(s) for companies. Return only the sector name(s), separated by commas if multiple. Be specific (e.g., "Renewable Energy", "Healthcare", "Real Estate", "Technology").',
          },
          {
            role: 'user',
            content: `Based on the company name "${account.name}" and website "${account.website}", determine the business sector(s). Return only the sector name(s).`,
          },
        ],
      })

      const sectorText = data.choices?.[0]?.message?.content?.trim()

      if (sectorText) {
        return sectorText.replace(/```/g, '').trim()
      }
      
      return account.sector
    })
  } catch (error) {
    console.warn('Failed to fetch AI sector', { account: account.name, error })
    return account.sector
  }
}

async function fetchContactSocialMedia(contact: Contact): Promise<SocialProfile[]> {
  if (!isAIConfigured()) {
    return contact.socialMedia || []
  }

  try {
    const data = await callAIWithFallback({
      model: AI_ABOUT_MODEL,
      temperature: 0.1,
      messages: [
        {
          role: 'system',
          content:
            'You are a social media research assistant. Search the internet for social media profiles that EXACTLY match the given person. You must verify that the profile belongs to the exact person specified by matching their name, title, company, and email. Only return profiles where you are confident it is the correct person. Return strict minified JSON with no commentary.',
        },
        {
          role: 'user',
          content: `Search the internet for social media profiles for this person:
- Full Name: ${contact.name}
- Title: ${contact.title}
- Company: ${contact.account}
- Email: ${contact.email}

IMPORTANT: Only return social media profiles where you can verify with high confidence that they belong to this EXACT person. Match the name exactly, verify the title/company matches, and check if the email or other identifying information aligns.

Return JSON with this structure:
{
  "socialProfiles": [
    {"label": "LinkedIn", "url": "https://linkedin.com/in/..."},
    {"label": "Twitter", "url": "https://twitter.com/..."},
    {"label": "Facebook", "url": "https://facebook.com/..."},
    {"label": "Instagram", "url": "https://instagram.com/..."}
  ]
}

Only include profiles that you can verify belong to ${contact.name} at ${contact.account}. If you cannot find verified profiles, return an empty array.`,
        },
      ],
    })

    const rawContent = data.choices?.[0]?.message?.content

    if (!rawContent) {
      return contact.socialMedia || []
    }

    const sanitized = rawContent.replace(/```json|```/g, '').trim()

    try {
      const parsed = JSON.parse(sanitized) as { socialProfiles?: SocialProfile[] }

      if (parsed.socialProfiles && Array.isArray(parsed.socialProfiles)) {
        return parsed.socialProfiles.filter(
          (profile): profile is SocialProfile =>
            typeof profile === 'object' &&
            profile !== null &&
            'label' in profile &&
            'url' in profile &&
            typeof profile.label === 'string' &&
            typeof profile.url === 'string' &&
            profile.url.startsWith('http'),
        )
      }
    } catch (error) {
      console.warn('Unable to parse AI social media response', error)
    }

    return contact.socialMedia || []
  } catch (error) {
    console.warn('Failed to fetch contact social media', { contact, error })
    return contact.socialMedia || []
  }
}

const sectionsToPlainText = (sections: AboutSections) =>
  [
    `What they do: ${sections.whatTheyDo}`,
    `Accreditations: ${sections.accreditations}`,
    `Key leaders: ${sections.keyLeaders}`,
    `Company profile: ${sections.companyProfile}`,
    `Recent news: ${sections.recentNews}`,
  ].join(' ')

const truncateText = (text: string, maxLength = 240) =>
  text.length > maxLength ? `${text.slice(0, maxLength).trimEnd()}…` : text

const hasExtendedAbout = (sections: AboutSections) =>
  sectionsToPlainText(sections).length > 480

const socialPresenceBlock = (socialMedia: SocialProfile[]) => (
  <Stack spacing={2}>
    <Text fontSize="sm" fontWeight="semibold" color="gray.600">
      Social presence
    </Text>
    <Wrap spacing={2}>
      {socialMedia.map((profile) => (
        <WrapItem key={profile.label}>
          <Link href={profile.url} isExternal color="teal.600">
            {profile.label}
          </Link>
        </WrapItem>
      ))}
    </Wrap>
  </Stack>
)

const detailedSections = (sections: AboutSections) => [
  { heading: 'What the company does', value: sections.whatTheyDo },
  { heading: 'Accreditations', value: sections.accreditations },
  { heading: 'Key leaders', value: sections.keyLeaders },
  { heading: 'Company size, headquarters & founding year', value: sections.companyProfile },
  { heading: 'Recent news', value: sections.recentNews },
]

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
) => {
  const sectionItems = detailedSections(sections).map(item => {
    const formatted = formatStoredValue(item.value)
    return {
      ...item,
      value: formatted.text,
      newsItems: formatted.newsItems
    }
  })
  const shouldShowToggle = hasExtendedAbout(sections)

  if (!expanded && shouldShowToggle) {
    const whatTheyDoFormatted = formatStoredValue(sections.whatTheyDo)
    return (
      <Stack spacing={3}>
        <Text fontSize="sm" fontWeight="semibold" color="gray.600">
          What the company does
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
      {sectionItems.map((item) => {
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
                      <Link href={news.url} isExternal color="teal.600" fontSize="sm">
                        {news.date}: {news.headline}
                      </Link>
                    ) : (
                      <Text fontSize="sm" color="gray.700">
                        {news.date}: {news.headline}
                      </Text>
                    )}
                  </Box>
                ))}
              </Stack>
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
      const accountContacts = contactsData.filter((contact) => contact.account === account.name)
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
                key={contact.name}
                fontSize="sm"
                p={2}
                borderRadius="md"
                border="1px solid"
                borderColor="gray.200"
                cursor="pointer"
                _hover={{ bg: 'gray.50', borderColor: 'teal.300' }}
                onClick={() => onContactClick?.(contact)}
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
          color="teal.600"
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
              <Badge variant="subtle" colorScheme="teal">
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
              <Tag size="md" colorScheme="teal" borderRadius="full">
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
    <Stack spacing={1}>
      <HStack justify="space-between" align="center">
        <Text fontSize="xs" textTransform="uppercase" color="gray.500" letterSpacing="wide">
          {label}
        </Text>
        {editable && !isEditing && onEdit && (
          <IconButton
            aria-label={`Edit ${label}`}
            icon={<EditIcon />}
            size="xs"
            variant="ghost"
            colorScheme="teal"
            onClick={onEdit}
          />
        )}
      </HStack>
      <Box fontWeight="medium">{children}</Box>
    </Stack>
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
            colorScheme="teal"
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
          <Icon as={MdCalendarToday} boxSize={5} color="teal.600" />
          <Heading size="sm">Calendar</Heading>
        </HStack>
        <Badge colorScheme="teal" fontSize="xs">
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
            <Icon as={MdEvent} boxSize={4} color="teal.600" />
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
            colorScheme="teal"
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
                    colorScheme="red"
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
                      color="teal.600"
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

function AccountsTab({ focusAccountName }: { focusAccountName?: string }) {
  const toast = useToast()
  const { isOpen: isCreateModalOpen, onOpen: onCreateModalOpen, onClose: onCreateModalClose } = useDisclosure()
  const { isOpen: isDeleteModalOpen, onOpen: onDeleteModalOpen, onClose: onDeleteModalClose } = useDisclosure()
  const { isOpen: isBulkSheetsOpen, onOpen: onBulkSheetsOpen, onClose: onBulkSheetsClose } = useDisclosure()
  const [bulkSheetsInput, setBulkSheetsInput] = useState('')
  const [newAccountForm, setNewAccountForm] = useState<Partial<Account>>({
    name: '',
    website: '',
    status: 'Active',
    sector: 'To be determined',
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
    aboutSections: {
      whatTheyDo: 'Information will be populated via AI research.',
      accreditations: 'Information will be populated via AI research.',
      keyLeaders: 'Information will be populated via AI research.',
      companyProfile: 'Information will be populated via AI research.',
      recentNews: 'Information will be populated via AI research.',
    },
    socialMedia: [],
    agreements: [],
    users: [],
  })

  // Load deleted accounts to prevent re-adding them
  const [deletedAccounts, setDeletedAccounts] = useState<Set<string>>(() => loadDeletedAccountsFromStorage())

  // Seed contacts (from screenshots) only if the user has no contacts saved yet.
  useEffect(() => {
    seedContactsIfEmpty()
    setContactsData(loadContactsFromStorage())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Load initial data from localStorage or use defaults
  const [accountsData, setAccountsData] = useState<Account[]>(() => {
    const loaded = loadAccountsFromStorage()
    // Merge with default accounts to ensure new accounts are included
    // BUT exclude any accounts that have been explicitly deleted
    const loadedAccountNames = new Set(loaded.map(a => a.name))
    const deletedAccountsSet = loadDeletedAccountsFromStorage()
    
    // Add any new accounts from defaults that aren't in storage AND haven't been deleted
    const newAccounts = accounts.filter(a => 
      !loadedAccountNames.has(a.name) && !deletedAccountsSet.has(a.name)
    )
    return [...loaded, ...newAccounts]
  })
  const [targetTitlesList, setTargetTitlesList] = useState<string[]>(sharedTargetTitles)
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null)
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null)
  const [contactsData, setContactsData] = useState<StoredContact[]>(() => loadContactsFromStorage())
  const [contactSocialMediaMap, setContactSocialMediaMap] = useState<Record<string, SocialProfile[]>>({})
  const [contactSocialMediaLoading, setContactSocialMediaLoading] = useState<Record<string, boolean>>({})
  const [aboutSectionsMap, setAboutSectionsMap] = useState<Record<string, AboutSections>>(() => {
    const stored = loadAboutSectionsFromStorage()
    const loadedAccounts = loadAccountsFromStorage()
    const deletedAccountsSet = loadDeletedAccountsFromStorage()
    // Merge with account defaults, excluding deleted accounts
    const merged: Record<string, AboutSections> = {}
    const allAccounts = [...loadedAccounts, ...accounts.filter(a => 
      !loadedAccounts.some(la => la.name === a.name) && !deletedAccountsSet.has(a.name)
    )]
    allAccounts.forEach(account => {
      merged[account.name] = stored[account.name] || account.aboutSections
    })
    return merged
  })
  const [aboutLoading, setAboutLoading] = useState<Record<string, boolean>>({})
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
  const [sectorLoading, setSectorLoading] = useState<Record<string, boolean>>({})
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
  const [failedLogos, setFailedLogos] = useState<Set<string>>(new Set())
  const [aiLogos, setAiLogos] = useState<Record<string, string>>({})
  const [editingFields, setEditingFields] = useState<Record<string, string>>({}) // Track which fields are being edited: { "accountName:fieldName": "value" }
  const [accountRefreshing, setAccountRefreshing] = useState<Record<string, boolean>>({}) // Track which account is being refreshed

  // Update accounts with actuals from marketing leads
  useEffect(() => {
    const leads = loadLeadsFromStorage()
    if (leads.length === 0) return

    setAccountsData((prev) => {
      const updated = prev.map((account) => {
        const actuals = calculateActualsFromLeads(account.name, leads)
        // Only update if values have changed to avoid unnecessary re-renders
        if (account.weeklyActual !== actuals.weeklyActual || account.monthlyActual !== actuals.monthlyActual) {
          return { ...account, weeklyActual: actuals.weeklyActual, monthlyActual: actuals.monthlyActual }
        }
        return account
      })
      
      // Save to localStorage if any changes were made
      const hasChanges = updated.some((acc, idx) => 
        acc.weeklyActual !== prev[idx].weeklyActual || acc.monthlyActual !== prev[idx].monthlyActual
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
      if (leads.length === 0) return

      setAccountsData((prev) => {
        const updated = prev.map((account) => {
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

  const updateAccount = (accountName: string, updates: Partial<Account>) => {
    setAccountsData((prev) => {
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
  }

  const deleteAccount = (accountName: string) => {
    setAccountsData((prev) => {
      const updated = prev.filter((acc) => acc.name !== accountName)
      // Save to localStorage
      saveAccountsToStorage(updated)
      // Add to deleted accounts list to prevent it from being re-added
      const newDeletedAccounts = new Set(deletedAccounts)
      newDeletedAccounts.add(accountName)
      setDeletedAccounts(newDeletedAccounts)
      saveDeletedAccountsToStorage(newDeletedAccounts)
      // Dispatch event so LeadsTab can get updated accounts
      emit('accountsUpdated', updated)
      return updated
    })
    if (selectedAccount?.name === accountName) {
      setSelectedAccount(null)
    }
    toast({
      title: 'Account deleted',
      description: `${accountName} has been permanently removed`,
      status: 'success',
      duration: 3000,
      isClosable: true,
    })
  }

  // Save to localStorage whenever data changes
  useEffect(() => {
    saveAccountsToStorage(accountsData)
  }, [accountsData])

  useEffect(() => {
    saveAboutSectionsToStorage(aboutSectionsMap)
  }, [aboutSectionsMap])

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

  // Track which accounts we've attempted to auto-fetch sectors for
  const attemptedSectorFetch = useRef<Set<string>>(new Set())

  // Automatically fetch sectors for accounts with "To be determined"
  useEffect(() => {
    if (!isAIConfigured()) return

    accountsData.forEach((account) => {
      // Skip if we've already attempted to fetch for this account
      if (attemptedSectorFetch.current.has(account.name)) return

      const currentSector = sectorsMap[account.name] ?? account.sector
      const isUndetermined = currentSector === 'To be determined' || !currentSector || currentSector.trim() === ''
      const isNotLoading = !sectorLoading[account.name]

      if (isUndetermined && isNotLoading) {
        // Mark as attempted
        attemptedSectorFetch.current.add(account.name)
        
        // Set loading state
        setSectorLoading((prev) => ({ ...prev, [account.name]: true }))

        // Fetch sector asynchronously
        fetchSector(account)
          .then((sector) => {
            if (sector && sector !== 'To be determined' && sector.trim() !== '') {
              setSectorsMap((prev) => ({ ...prev, [account.name]: sector }))
              updateAccount(account.name, { sector })
            }
          })
          .catch((error) => {
            console.error(`Failed to auto-fetch sector for ${account.name}:`, error)
          })
          .finally(() => {
            setSectorLoading((prev) => ({ ...prev, [account.name]: false }))
          })
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // Sort all accounts alphabetically
  const filteredAndSortedAccounts = [...accountsData]
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))

  const isDrawerOpen = Boolean(selectedAccount)

  const handleCloseDrawer = () => setSelectedAccount(null)

  const handleCreateAccount = () => {
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

    const newAccount: Account = {
      name: newAccountForm.name.trim(),
      website: newAccountForm.website || '',
      aboutSections: newAccountForm.aboutSections || {
        whatTheyDo: 'Information will be populated via AI research.',
        accreditations: 'Information will be populated via AI research.',
        keyLeaders: 'Information will be populated via AI research.',
        companyProfile: 'Information will be populated via AI research.',
        recentNews: 'Information will be populated via AI research.',
      },
      sector: newAccountForm.sector || 'To be determined',
      socialMedia: newAccountForm.socialMedia || [],
      status: newAccountForm.status || 'Active',
      targetLocation: newAccountForm.targetLocation || [],
      targetTitle: newAccountForm.targetTitle || '',
      monthlySpendGBP: newAccountForm.monthlySpendGBP || 0,
      agreements: newAccountForm.agreements || [],
      defcon: newAccountForm.defcon || 3,
      contractStart: newAccountForm.contractStart || '',
      contractEnd: newAccountForm.contractEnd || '',
      days: newAccountForm.days || 1,
      contacts: newAccountForm.contacts || 0,
      leads: newAccountForm.leads || 0,
      weeklyTarget: newAccountForm.weeklyTarget || 0,
      weeklyActual: newAccountForm.weeklyActual || 0,
      monthlyTarget: newAccountForm.monthlyTarget || 0,
      monthlyActual: newAccountForm.monthlyActual || 0,
      weeklyReport: newAccountForm.weeklyReport || '',
      users: newAccountForm.users || [],
      clientLeadsSheetUrl: newAccountForm.clientLeadsSheetUrl || undefined,
    }

    setAccountsData((prev) => {
      const updated = [...prev, newAccount]
      saveAccountsToStorage(updated)
      // Dispatch event so LeadsTab can get updated accounts and refresh leads
      emit('accountsUpdated', updated)
      return updated
    })

    // Initialize maps for new account
    setAboutSectionsMap((prev) => ({
      ...prev,
      [newAccount.name]: newAccount.aboutSections,
    }))
    setSectorsMap((prev) => ({
      ...prev,
      [newAccount.name]: newAccount.sector,
    }))
    setTargetLocationsMap((prev) => ({
      ...prev,
      [newAccount.name]: newAccount.targetLocation,
    }))

    // Reset form
    setNewAccountForm({
      name: '',
      website: '',
      status: 'Active',
      sector: 'To be determined',
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
      aboutSections: {
        whatTheyDo: 'Information will be populated via AI research.',
        accreditations: 'Information will be populated via AI research.',
        keyLeaders: 'Information will be populated via AI research.',
        companyProfile: 'Information will be populated via AI research.',
        recentNews: 'Information will be populated via AI research.',
      },
      socialMedia: [],
      agreements: [],
      users: [],
    })

    onCreateModalClose()

    // Open the new account in the drawer
    setSelectedAccount(newAccount)

    toast({
      title: 'Account created',
      description: `Successfully created account: ${newAccount.name}`,
      status: 'success',
      duration: 3000,
      isClosable: true,
    })
  }

  const getAboutSections = (account: Account) =>
    aboutSectionsMap[account.name] ?? account.aboutSections

  useEffect(() => {
    let isCancelled = false

    // AI Configuration Check on mount
    console.log('AI Configuration Check:', {
      endpoint: AI_ABOUT_ENDPOINT ? 'Set' : 'Missing',
      apiKey: AI_ABOUT_API_KEY ? 'Set' : 'Missing',
      model: AI_ABOUT_MODEL,
    })

    if (!isAIConfigured()) {
      console.error('❌ AI endpoint or API key not configured!', {
        endpoint: AI_ABOUT_ENDPOINT || 'MISSING',
        apiKey: AI_ABOUT_API_KEY ? 'SET' : 'MISSING',
        action: 'Set VITE_AI_ABOUT_ENDPOINT and VITE_AI_ABOUT_API_KEY in .env file and restart dev server',
      })
      return
    }

    // Initial fetch: Get AI data for accounts that need it (one at a time with delays)
    const initialFetch = async () => {
      // Find accounts that need AI data (have placeholder text)
      const accountsNeedingData = accountsData.filter((account) => {
        const sections = aboutSectionsMap[account.name] ?? account.aboutSections
        return sections.whatTheyDo.includes('Information will be populated via AI research')
      })

      if (accountsNeedingData.length === 0) {
        console.log('✅ All accounts already have AI data')
        return
      }

      console.log(`🚀 Initial fetch: Processing ${accountsNeedingData.length} accounts (one at a time with 5 second delays)...`)

      // Process one account at a time with 5 second delays to avoid rate limits
      for (let i = 0; i < accountsNeedingData.length; i++) {
        if (isCancelled) break

        const account = accountsNeedingData[i]
        
        // Skip if already has real data
        const currentSections = aboutSectionsMap[account.name] ?? account.aboutSections
        if (!currentSections.whatTheyDo.includes('Information will be populated via AI research')) {
          console.log(`⏭️ Skipping ${account.name} - already has data`)
          continue
        }

        setAboutLoading((prev) => ({ ...prev, [account.name]: true }))
        
        try {
          console.log(`📡 [${i + 1}/${accountsNeedingData.length}] Fetching AI data for ${account.name}...`)
          const { sections, socialMedia } = await fetchAboutSections(account)
          
          if (isCancelled) break

          // Verify we got real data
          const hasRealData = !sections.whatTheyDo.includes('Information will be populated via AI research') &&
                              !sections.whatTheyDo.includes('Unable to fetch AI data')

          if (hasRealData) {
            setAboutSectionsMap((prev) => ({ ...prev, [account.name]: sections }))
            if (socialMedia && socialMedia.length > 0) {
              updateAccount(account.name, { socialMedia })
            }
            console.log(`✅ [${i + 1}/${accountsNeedingData.length}] Successfully fetched data for ${account.name}`)
          } else {
            console.warn(`⚠️ [${i + 1}/${accountsNeedingData.length}] ${account.name} returned placeholder data - will retry on manual refresh`)
          }
        } catch (error) {
          console.error(`❌ [${i + 1}/${accountsNeedingData.length}] Failed for ${account.name}:`, error)
          // Don't show toast for initial fetch failures to avoid spam
        } finally {
          if (!isCancelled) {
            setAboutLoading((prev) => ({ ...prev, [account.name]: false }))
          }
        }

        // Wait 5 seconds before next account (except for last one)
        if (i < accountsNeedingData.length - 1 && !isCancelled) {
          console.log(`⏳ Waiting 5 seconds before next account...`)
          await new Promise((resolve) => setTimeout(resolve, 5000))
        }
      }

      console.log(`✅ Initial fetch complete for ${accountsNeedingData.length} accounts`)
    }

    // Start initial fetch
    initialFetch()

    return () => {
      isCancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleToggleAbout = (accountName: string) => {
    setExpandedAbout((prev) => ({ ...prev, [accountName]: !prev[accountName] }))
  }

  // Refresh AI data for a single account
  const handleRefreshAccount = async (account: Account) => {
    const accountName = account.name
    
    if (accountRefreshing[accountName]) return // Prevent multiple simultaneous refreshes
    
    setAccountRefreshing((prev) => ({ ...prev, [accountName]: true }))
    setAboutLoading((prev) => ({ ...prev, [accountName]: true }))
    setSectorLoading((prev) => ({ ...prev, [accountName]: true }))
    
    try {
      console.log(`🔄 Refreshing AI data for ${accountName}...`)
      
      if (!isAIConfigured()) {
        toast({
          title: 'AI not configured',
          description: 'AI endpoint or API key not configured. Cannot refresh AI data.',
          status: 'warning',
          duration: 3000,
          isClosable: true,
        })
        return
      }
      
      // Fetch about sections (includes social media)
      try {
        const { sections, socialMedia } = await fetchAboutSections(account)
        
        // Verify we got real data
        const hasRealData = !sections.whatTheyDo.includes('Information will be populated via AI research') &&
                            !sections.whatTheyDo.includes('Unable to fetch AI data')
        
        if (hasRealData) {
          setAboutSectionsMap((prev) => ({ ...prev, [accountName]: sections }))
          if (socialMedia && socialMedia.length > 0) {
            updateAccount(accountName, { socialMedia })
          }
          console.log(`✅ Successfully refreshed about sections for ${accountName}`)
        } else {
          console.warn(`⚠️ ${accountName} returned placeholder data`)
        }
      } catch (error) {
        console.error(`❌ Failed to refresh about sections for ${accountName}:`, error)
        toast({
          title: 'Refresh error',
          description: `Failed to refresh about sections for ${accountName}`,
          status: 'error',
          duration: 3000,
          isClosable: true,
        })
      }
      
      // Fetch sector
      try {
        const sector = await fetchSector(account)
        if (sector && sector !== 'To be determined' && sector.trim() !== '') {
          setSectorsMap((prev) => ({ ...prev, [accountName]: sector }))
          updateAccount(accountName, { sector })
          console.log(`✅ Successfully refreshed sector for ${accountName}: ${sector}`)
        }
      } catch (error) {
        console.error(`❌ Failed to refresh sector for ${accountName}:`, error)
      } finally {
        setSectorLoading((prev) => ({ ...prev, [accountName]: false }))
      }
      
      // Update selected account if it's the one being refreshed
      if (selectedAccount && selectedAccount.name === accountName) {
        const updatedAccount = accountsData.find(a => a.name === accountName)
        if (updatedAccount) {
          setSelectedAccount(updatedAccount)
        }
      }
      
      toast({
        title: 'Refresh complete',
        description: `Successfully refreshed AI data for ${accountName}`,
        status: 'success',
        duration: 3000,
        isClosable: true,
      })
    } catch (error) {
      console.error(`❌ Error refreshing ${accountName}:`, error)
      toast({
        title: 'Refresh error',
        description: `An error occurred while refreshing ${accountName}`,
        status: 'error',
        duration: 5000,
        isClosable: true,
      })
    } finally {
      setAboutLoading((prev) => ({ ...prev, [accountName]: false }))
      setAccountRefreshing((prev) => ({ ...prev, [accountName]: false }))
    }
  }

  // Listen for navigation to account from contacts tab
  useEffect(() => {
    const handleNavigateToAccount = (detail: { accountName?: string } | undefined) => {
      const accountName = detail?.accountName
      if (accountName) {
        const account = accountsData.find((acc) => acc.name === accountName)
        if (account) {
          setSelectedAccount(account)
        }
      }
    }
    const off = on<{ accountName?: string }>('navigateToAccount', (detail) => handleNavigateToAccount(detail))
    return () => off()
  }, [accountsData])

  // Keep contact counts/details live (ContactsTab dispatches contactsUpdated).
  useEffect(() => {
    const off = on<StoredContact[]>('contactsUpdated', (detail) => {
      if (Array.isArray(detail)) setContactsData(detail)
      else setContactsData(loadContactsFromStorage())
    })
    return () => off()
  }, [])

  // Allow parent navigators (top-tab shell) to request focusing an account by name.
  // If it exists, open the drawer for that account.
  useEffect(() => {
    if (!focusAccountName) return
    const account = accountsData.find((acc) => acc.name === focusAccountName)
    if (account) {
      setSelectedAccount(account)
    }
  }, [focusAccountName, accountsData])

  const handleAccountClick = (accountName: string, e?: React.MouseEvent) => {
    try {
      e?.stopPropagation()
      console.log('Account clicked:', accountName)
      
      const account = accountsData.find((acc) => acc.name === accountName)
      
      if (!account) {
        console.error('Account not found:', accountName)
        return
      }

      console.log('Setting selected account:', account.name)
      setSelectedAccount(account)
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

  // Safety check - ensure we have accounts data
  if (!accountsData || accountsData.length === 0) {
    return (
      <Box p={8} textAlign="center">
        <Text>No accounts available</Text>
      </Box>
    )
  }

  console.log('AccountsTab rendering:', {
    accountsCount: accountsData.length,
    filteredCount: filteredAndSortedAccounts.length,
    selectedAccount: selectedAccount?.name,
    isDrawerOpen,
  })

  const hasStoredAccounts = (() => {
    // Preserve prior behavior: if storage is unavailable, don't show the "defaults" warning.
    if (!isStorageAvailable()) return true
    return getItem(STORAGE_KEY_ACCOUNTS) !== null
  })()

  const applyBulkSheets = () => {
    const raw = bulkSheetsInput
    const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
    if (lines.length === 0) {
      toast({ title: 'Nothing to apply', description: 'Paste account name + URL lines first.', status: 'info' })
      return
    }

    const invalidLines: string[] = []
    const requested: Array<{ name: string; url: string }> = []

    for (const line of lines) {
      const match = line.match(/^(.*?)\s*(?:,|\t|\|)\s*(https?:\/\/\S+)\s*$/)
      if (!match) {
        invalidLines.push(line)
        continue
      }
      requested.push({ name: match[1].trim(), url: match[2].trim() })
    }

    const notFound: string[] = []
    let updatedCount = 0

    setAccountsData((prev) => {
      const next = prev.map((acc) => {
        const hit = requested.find(
          (r) => r.name.toLowerCase() === acc.name.trim().toLowerCase(),
        )
        if (!hit) return acc
        updatedCount++
        return { ...acc, clientLeadsSheetUrl: hit.url }
      })

      // Track names that weren't found
      for (const r of requested) {
        const exists = prev.some((a) => a.name.trim().toLowerCase() === r.name.toLowerCase())
        if (!exists) notFound.push(r.name)
      }

      saveAccountsToStorage(next)
      emit('accountsUpdated', next)

      return next
    })

    const parts: string[] = []
    if (updatedCount > 0) parts.push(`Updated ${updatedCount} account(s).`)
    if (invalidLines.length > 0) parts.push(`${invalidLines.length} invalid line(s) skipped.`)
    if (notFound.length > 0) parts.push(`${notFound.length} account name(s) not found.`)

    toast({
      title: 'Google Sheets links applied',
      description: parts.join(' '),
      status: updatedCount > 0 ? 'success' : 'warning',
      duration: 6000,
      isClosable: true,
    })

    onBulkSheetsClose()
    setBulkSheetsInput('')
  }

  const accountNames = accountsData.map((a) => a.name).slice().sort((a, b) => a.localeCompare(b))
  const bulkTemplate = accountNames.map((n) => `${n}, `).join('\n')
  const fieldConfig = getFieldConfig(contactsData)

  const copyToClipboard = async (text: string, successMsg: string) => {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text)
      } else {
        // Fallback for older browsers: prompt copy
        window.prompt('Copy to clipboard: Ctrl+C, Enter', text)
      }
      toast({ title: successMsg, status: 'success', duration: 2000, isClosable: true })
    } catch (e: any) {
      toast({
        title: 'Copy failed',
        description: e?.message || 'Unable to copy to clipboard in this browser.',
        status: 'error',
        duration: 3000,
        isClosable: true,
      })
    }
  }

  return (
    <>
      <Box mb={6} p={4} bg="white" borderRadius="lg" border="1px solid" borderColor="gray.200">
        {!hasStoredAccounts && (
          <Alert status="info" borderRadius="md" mb={3}>
            <AlertIcon />
            <AlertDescription fontSize="sm">
              Accounts (including Google Sheets links) are saved per browser + domain/port. If you switched URLs/ports,
              you may be seeing defaults—switch back or import your accounts data.
            </AlertDescription>
          </Alert>
        )}
        <HStack justify="flex-end" align="flex-start" mb={3} flexWrap="wrap" gap={4}>
          <Button
            variant="outline"
            leftIcon={<ExternalLinkIcon />}
            onClick={onBulkSheetsOpen}
            size="sm"
          >
            Bulk Google Sheets Links
          </Button>
          <Button
            colorScheme="teal"
            leftIcon={<CheckIcon />}
            onClick={onCreateModalOpen}
            size="sm"
          >
            Create New Account
          </Button>
        </HStack>
      </Box>

      <TableContainer
        bg="white"
        borderRadius="lg"
        border="1px solid"
        borderColor="gray.200"
        overflowX="auto"
      >
        <Table size="sm" variant="simple">
          <Thead bg="gray.50">
            <Tr>
              <Th>Account</Th>
              <Th>Status</Th>
              <Th>Sector</Th>
              <Th isNumeric>Contacts</Th>
              <Th isNumeric>Leads</Th>
              <Th>Notes</Th>
            </Tr>
          </Thead>
          <Tbody>
            {filteredAndSortedAccounts.map((account) => {
              const statusColorScheme =
                account.status === 'Active' ? 'green' : account.status === 'Inactive' ? 'red' : 'orange'
              return (
                <Tr
                  key={account.name}
                  cursor="pointer"
                  _hover={{ bg: 'teal.50' }}
                  onClick={(e) => handleAccountClick(account.name, e)}
                >
                  <Td>
                    <HStack spacing={3}>
                      <Avatar
                        size="sm"
                        name={account.name}
                        src={getAccountLogo(account, failedLogos, aiLogos)}
                        bg="teal.50"
                        onError={() => {
                          // Mark Clearbit as failed so we immediately fall back to favicon.
                          setFailedLogos((prev) => new Set(prev).add(account.name))
                        }}
                      />
                      <Box>
                        <Text fontWeight="semibold" color="gray.800">
                          {account.name}
                        </Text>
                        {account.website ? (
                          <Text fontSize="xs" color="gray.500" noOfLines={1}>
                            {account.website}
                          </Text>
                        ) : null}
                      </Box>
                    </HStack>
                  </Td>
                  <Td>
                    <Badge colorScheme={statusColorScheme}>{account.status}</Badge>
                  </Td>
                  <Td>
                    <Text fontSize="sm" color="gray.600" noOfLines={1}>
                      {sectorsMap[account.name] ?? account.sector}
                    </Text>
                  </Td>
                  <Td isNumeric>
                    <Text fontSize="sm" color="gray.700">
                      {contactsData.filter((c) => c.account === account.name).length}
                    </Text>
                  </Td>
                  <Td isNumeric>
                    <Text fontSize="sm" color="gray.700">
                      {account.leads}
                    </Text>
                  </Td>
                  <Td maxW="380px">
                    <Text fontSize="sm" color="gray.600" noOfLines={2}>
                      {(() => {
                        try {
                          const sections = getAboutSections(account)
                          return truncateText(sectionsToPlainText(sections), 180)
                        } catch {
                          return ''
                        }
                      })()}
                    </Text>
                  </Td>
                </Tr>
              )
            })}

            {filteredAndSortedAccounts.length === 0 ? (
              <Tr>
                <Td colSpan={6}>
                  <Box p={6} color="gray.500" textAlign="center" fontSize="sm">
                    No accounts match the selected filters
                  </Box>
                </Td>
              </Tr>
            ) : null}
          </Tbody>
        </Table>
      </TableContainer>

      {/* Bulk Sheets Modal */}
      <Modal isOpen={isBulkSheetsOpen} onClose={onBulkSheetsClose} size="xl">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Bulk Google Sheets Links</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Stack spacing={3}>
              <Text fontSize="sm" color="gray.600">
                Paste one account per line using <Box as="span" fontWeight="semibold">comma</Box>, <Box as="span" fontWeight="semibold">tab</Box>, or <Box as="span" fontWeight="semibold">|</Box>:
              </Text>
              <Box
                border="1px solid"
                borderColor="gray.200"
                borderRadius="md"
                p={3}
                bg="gray.50"
              >
                <HStack justify="space-between" align="flex-start" spacing={3} flexWrap="wrap">
                  <Box>
                    <Text fontSize="sm" fontWeight="semibold" color="gray.700">
                      Account names (auto)
                    </Text>
                    <Text fontSize="xs" color="gray.500">
                      Use “Copy template” to get one line per account prefilled as <Box as="span" fontFamily="mono">Name,</Box>
                    </Text>
                  </Box>
                  <HStack spacing={2} flexWrap="wrap">
                    <Button
                      size="xs"
                      variant="outline"
                      onClick={() => copyToClipboard(accountNames.join('\n'), 'Copied account names')}
                    >
                      Copy names
                    </Button>
                    <Button
                      size="xs"
                      variant="outline"
                      onClick={() => copyToClipboard(bulkTemplate, 'Copied template')}
                    >
                      Copy template
                    </Button>
                    <Button
                      size="xs"
                      variant="outline"
                      onClick={() => setBulkSheetsInput(bulkTemplate)}
                    >
                      Paste template below
                    </Button>
                  </HStack>
                </HStack>
                <Box
                  mt={3}
                  maxH="180px"
                  overflowY="auto"
                  fontFamily="mono"
                  fontSize="xs"
                  whiteSpace="pre"
                  color="gray.700"
                >
                  {accountNames.join('\n')}
                </Box>
              </Box>
              <Box
                fontFamily="mono"
                fontSize="sm"
                bg="gray.50"
                border="1px solid"
                borderColor="gray.200"
                borderRadius="md"
                p={3}
              >
                OpenDoors Account Name, https://docs.google.com/spreadsheets/d/...
              </Box>
              <Textarea
                value={bulkSheetsInput}
                onChange={(e) => setBulkSheetsInput(e.target.value)}
                placeholder="Account Name, https://docs.google.com/spreadsheets/d/..."
                rows={10}
              />
              <Text fontSize="xs" color="gray.500">
                Matching is case-insensitive by account name. This updates localStorage and triggers an accounts refresh event.
              </Text>
            </Stack>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onBulkSheetsClose}>
              Cancel
            </Button>
            <Button colorScheme="teal" onClick={applyBulkSheets}>
              Apply Links
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

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

              <FormControl>
                <FormLabel>Target Title</FormLabel>
                <Input
                  placeholder="Enter target title"
                  value={newAccountForm.targetTitle || ''}
                  onChange={(e) => setNewAccountForm({ ...newAccountForm, targetTitle: e.target.value })}
                />
              </FormControl>

              <FormControl>
                <FormLabel>Target Location</FormLabel>
                <Box position="relative">
                  <TargetLocationMultiSelect
                    locations={newAccountForm.targetLocation || []}
                    onLocationsChange={(locations) => setNewAccountForm({ ...newAccountForm, targetLocation: locations })}
                  />
                </Box>
              </FormControl>

              <SimpleGrid columns={2} gap={4}>
                <FormControl>
                  <FormLabel>Contract Start</FormLabel>
                  <Input
                    type="date"
                    value={newAccountForm.contractStart || ''}
                    onChange={(e) => setNewAccountForm({ ...newAccountForm, contractStart: e.target.value })}
                  />
                </FormControl>

                <FormControl>
                  <FormLabel>Contract End</FormLabel>
                  <Input
                    type="date"
                    value={newAccountForm.contractEnd || ''}
                    onChange={(e) => setNewAccountForm({ ...newAccountForm, contractEnd: e.target.value })}
                  />
                </FormControl>
              </SimpleGrid>

              <SimpleGrid columns={2} gap={4}>
                <FormControl>
                  <FormLabel>Monthly Spend (GBP)</FormLabel>
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
                <FormLabel>Weekly Perform Report</FormLabel>
                <Input
                  placeholder="Enter weekly report URL"
                  value={newAccountForm.weeklyReport || ''}
                  onChange={(e) => setNewAccountForm({ ...newAccountForm, weeklyReport: e.target.value })}
                />
              </FormControl>

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
            <Button colorScheme="teal" onClick={handleCreateAccount}>
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
        >
          <DrawerOverlay bg="blackAlpha.600" />
          <DrawerContent maxW="75%">
            <DrawerCloseButton />
            <DrawerHeader>
              <Stack spacing={3}>
                <Stack direction="row" justify="space-between" align="center">
                  <Stack spacing={1}>
                    <Heading size="lg">{selectedAccount.name}</Heading>
                    <Text color="gray.500">
                      {sectorsMap[selectedAccount.name] ?? selectedAccount.sector}
                    </Text>
                  </Stack>
                  <HStack spacing={2}>
                    <IconButton
                      aria-label="Refresh AI-generated data for this account"
                      icon={<RepeatIcon />}
                      onClick={() => handleRefreshAccount(selectedAccount)}
                      isLoading={accountRefreshing[selectedAccount.name] || aboutLoading[selectedAccount.name] || sectorLoading[selectedAccount.name]}
                      colorScheme="teal"
                      size="sm"
                      variant="outline"
                    />
                    <Button variant="outline" onClick={handleCloseDrawer}>
                      Close
                    </Button>
                  </HStack>
                </Stack>
              </Stack>
            </DrawerHeader>
            <DrawerBody>
              <Stack spacing={8}>
                <Box textAlign="center" py={4}>
                  <Avatar
                    size="2xl"
                    name={selectedAccount?.name || 'Account'}
                    src={selectedAccount ? getAccountLogo(selectedAccount, failedLogos, aiLogos) : ''}
                    bg="teal.50"
                    border="3px solid"
                    borderColor="teal.200"
                    onError={async () => {
                      // If Clearbit failed and we haven't tried AI yet, fetch from AI
                      if (
                        selectedAccount &&
                        !failedLogos.has(selectedAccount.name) &&
                        !aiLogos[selectedAccount.name]
                      ) {
                        setFailedLogos((prev) => new Set(prev).add(selectedAccount.name))

                        // Try to get logo from AI
                        const aiLogo = await fetchLogoFromAI(selectedAccount)
                        if (aiLogo) {
                          setAiLogos((prev) => ({ ...prev, [selectedAccount.name]: aiLogo }))
                        } else {
                          // If AI also fails, mark it so we use DiceBear fallback
                          // The Avatar will automatically use initials when src fails
                        }
                      } else if (selectedAccount && aiLogos[selectedAccount.name]) {
                        // If AI logo also failed, remove it and use DiceBear
                        setAiLogos((prev) => {
                          const updated = { ...prev }
                          delete updated[selectedAccount.name]
                          return updated
                        })
                      }
                    }}
                  />
                </Box>

                  <Stack spacing={4}>
                    <SimpleGrid columns={{ base: 1, md: 2 }} gap={6}>
                      <EditableField
                        value={selectedAccount.website}
                        onSave={(value) => {
                          updateAccount(selectedAccount.name, { website: String(value) })
                          stopEditing(selectedAccount.name, 'website')
                        }}
                        onCancel={() => stopEditing(selectedAccount.name, 'website')}
                        isEditing={isFieldEditing(selectedAccount.name, 'website')}
                        onEdit={() => startEditing(selectedAccount.name, 'website')}
                        label="Website"
                        type="url"
                        placeholder="https://example.com"
                        renderDisplay={(value) => (
                          value ? (
                            <Stack spacing={2}>
                              <Link href={String(value)} color="teal.600" isExternal display="inline-flex" alignItems="center" gap={1}>
                                {String(value)}
                                <ExternalLinkIcon />
                              </Link>
                              <Link
                                href={String(value)}
                                color="teal.600"
                                isExternal
                                display="inline-flex"
                                alignItems="center"
                                gap={1}
                                fontSize="sm"
                              >
                                Open website
                                <ExternalLinkIcon />
                              </Link>
                            </Stack>
                          ) : <Text fontSize="sm" color="gray.500">Not set</Text>
                        )}
                      />
                      <FieldRow label="Status">
                        <Select
                          value={selectedAccount.status}
                          onChange={(e) => {
                            const newStatus = e.target.value as Account['status']
                            updateAccount(selectedAccount.name, { status: newStatus })
                          }}
                          size="sm"
                        >
                          <option value="Active">Active</option>
                          <option value="Inactive">Inactive</option>
                          <option value="On Hold">On Hold</option>
                        </Select>
                      </FieldRow>
                    </SimpleGrid>

                    <FieldRow label="About">
                      <Stack spacing={3} fontWeight="normal">
                        {isAIConfigured() ? (
                          <>
                            {aboutLoading[selectedAccount.name] ? (
                              <HStack spacing={2} p={3} bg="teal.50" borderRadius="md">
                                <Spinner size="sm" color="teal.500" />
                                <Text fontSize="sm" color="gray.700">
                                  Fetching AI data… This may take 10-30 seconds.
                                </Text>
                              </HStack>
                            ) : (
                              <Button
                                size="md"
                                colorScheme="teal"
                                leftIcon={<SearchIcon />}
                                width="100%"
                                onClick={async () => {
                                  setAboutLoading((prev) => ({ ...prev, [selectedAccount.name]: true }))
                                  try {
                                    console.log(`🔄 Manual refresh: Fetching AI data for ${selectedAccount.name}...`)
                                    const { sections, socialMedia } = await fetchAboutSections(selectedAccount)
                                    
                                    // Check if we got real data
                                    const isPlaceholderText = (text: string) => {
                                      const lower = text.toLowerCase()
                                      return lower.includes('information will be populated') || 
                                             lower.includes('unable to fetch') ||
                                             lower.includes('not available yet')
                                    }

                                    const hasRealData = !isPlaceholderText(sections.whatTheyDo) &&
                                                        (sections.whatTheyDo.length > 50 ||
                                                         !isPlaceholderText(sections.accreditations) ||
                                                         !isPlaceholderText(sections.keyLeaders))
                                    
                                    if (hasRealData) {
                                      setAboutSectionsMap((prev) => ({ ...prev, [selectedAccount.name]: sections }))
                                      if (socialMedia && socialMedia.length > 0) {
                                        updateAccount(selectedAccount.name, { socialMedia })
                                      }
                                      toast({
                                        title: 'AI data fetched successfully',
                                        description: `Updated information for ${selectedAccount.name}`,
                                        status: 'success',
                                        duration: 3000,
                                        isClosable: true,
                                      })
                                    } else {
                                      // If we got placeholder data, show what we received
                                      console.error('Received placeholder data:', sections)
                                      throw new Error(`AI returned placeholder data. Received: "${sections.whatTheyDo.substring(0, 100)}". Please check your API key and try again.`)
                                    }
                                  } catch (error) {
                                    console.error('❌ Failed to fetch AI data:', error)
                                    const errorMessage = error instanceof Error 
                                      ? error.message 
                                      : 'Unknown error. Check console for details.'
                                    
                                    toast({
                                      title: 'Failed to fetch AI data',
                                      description: errorMessage,
                                      status: 'error',
                                      duration: 6000,
                                      isClosable: true,
                                    })
                                  } finally {
                                    setAboutLoading((prev) => ({ ...prev, [selectedAccount.name]: false }))
                                  }
                                }}
                              >
                                Fetch AI Data
                              </Button>
                            )}
                          </>
                        ) : (
                          <Alert status="warning" size="sm" borderRadius="md">
                            <AlertIcon />
                            <Box>
                              <AlertTitle fontSize="sm">AI Not Configured</AlertTitle>
                              <AlertDescription fontSize="xs" mt={1}>
                                To enable AI features, set VITE_AI_ABOUT_ENDPOINT and VITE_AI_ABOUT_API_KEY in .env file and restart dev server.
                              </AlertDescription>
                            </Box>
                          </Alert>
                        )}
                        {renderAboutField(
                          getAboutSections(selectedAccount),
                          expandedAbout[selectedAccount.name],
                          () => handleToggleAbout(selectedAccount.name),
                          selectedAccount.socialMedia || [],
                        )}
                      </Stack>
                    </FieldRow>

                  </Stack>

                  <Divider />

                  <SimpleGrid columns={{ base: 1, md: 2 }} gap={6}>
                    <Stack spacing={4}>
                      <FieldRow label="Notes">
                        <NotesSection account={selectedAccount} updateAccount={updateAccount} toast={toast} />
                      </FieldRow>
                      <UpcomingEventsSection account={selectedAccount} />
                    </Stack>
                    <CalendarSection account={selectedAccount} />
                  </SimpleGrid>

                  <SimpleGrid columns={{ base: 1, md: 2 }} gap={6}>
                    <Stack spacing={2}>
                      {isAIConfigured() && !isFieldEditing(selectedAccount.name, 'sector') && (
                        <HStack spacing={2}>
                          {sectorLoading[selectedAccount.name] ? (
                            <HStack spacing={2}>
                              <Spinner size="sm" color="teal.500" />
                              <Text fontSize="sm" color="gray.500">
                                Detecting sector...
                              </Text>
                            </HStack>
                          ) : (
                            <Button
                              size="xs"
                              colorScheme="teal"
                              variant="outline"
                              leftIcon={<SearchIcon />}
                              onClick={async () => {
                                setSectorLoading((prev) => ({ ...prev, [selectedAccount.name]: true }))
                                try {
                                  const sector = await fetchSector(selectedAccount)
                                  if (sector && sector !== selectedAccount.sector) {
                                    setSectorsMap((prev) => ({ ...prev, [selectedAccount.name]: sector }))
                                    updateAccount(selectedAccount.name, { sector })
                                    toast({
                                      title: 'Sector detected',
                                      description: `Updated to: ${sector}`,
                                      status: 'success',
                                      duration: 2000,
                                      isClosable: true,
                                    })
                                  }
                                } catch (error) {
                                  console.error('Failed to fetch sector:', error)
                                  toast({
                                    title: 'Failed to detect sector',
                                    description: error instanceof Error ? error.message : 'Unknown error',
                                    status: 'error',
                                    duration: 3000,
                                    isClosable: true,
                                  })
                                } finally {
                                  setSectorLoading((prev) => ({ ...prev, [selectedAccount.name]: false }))
                                }
                              }}
                            >
                              Detect Sector
                            </Button>
                          )}
                        </HStack>
                      )}
                      <EditableField
                        value={sectorsMap[selectedAccount.name] ?? selectedAccount.sector}
                        onSave={(value) => {
                          const sectorValue = String(value)
                          setSectorsMap((prev) => ({ ...prev, [selectedAccount.name]: sectorValue }))
                          updateAccount(selectedAccount.name, { sector: sectorValue })
                          stopEditing(selectedAccount.name, 'sector')
                        }}
                        onCancel={() => stopEditing(selectedAccount.name, 'sector')}
                        isEditing={isFieldEditing(selectedAccount.name, 'sector')}
                        onEdit={() => startEditing(selectedAccount.name, 'sector')}
                        label="Sector"
                        placeholder="Enter sector"
                      />
                    </Stack>

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
                      <Stack spacing={2}>
                        <Box>
                          <Input
                            list="target-titles"
                            value={selectedAccount.targetTitle}
                            onChange={(e) => {
                              const value = e.target.value
                              updateAccount(selectedAccount.name, { targetTitle: value })
                              addTargetTitle(value)
                            }}
                            placeholder="Enter or select target title"
                            size="sm"
                          />
                          <datalist id="target-titles">
                            {targetTitlesList.map((title) => (
                              <option key={title} value={title} />
                            ))}
                          </datalist>
                        </Box>
                        <Text fontSize="xs" color="gray.500">
                          Saved titles are available for all accounts
                        </Text>
                      </Stack>
                    </FieldRow>

                    <FieldRow label="Monthly Spent Pounds">
                      <Stack direction="row" spacing={2} align="center">
                        <Text color="gray.500" fontSize="sm" fontWeight="medium">£</Text>
                        <NumberInput
                          value={selectedAccount.monthlySpendGBP}
                          onChange={(_, value) => {
                            updateAccount(selectedAccount.name, { monthlySpendGBP: value || 0 })
                          }}
                          min={0}
                          precision={2}
                          size="sm"
                          flex="1"
                        >
                          <NumberInputField />
                          <NumberInputStepper>
                            <NumberIncrementStepper />
                            <NumberDecrementStepper />
                          </NumberInputStepper>
                        </NumberInput>
                      </Stack>
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
                          size="sm"
                          display="none"
                          id={`agreement-upload-${selectedAccount.name}`}
                        />
                        <Button
                          as="label"
                          htmlFor={`agreement-upload-${selectedAccount.name}`}
                          leftIcon={<AttachmentIcon />}
                          size="sm"
                          variant="outline"
                          cursor="pointer"
                        >
                          Attach Agreement
                        </Button>
                        {(selectedAccount.agreements || []).length > 0 && (
                          <Stack spacing={2}>
                            {(selectedAccount.agreements || []).map((file) => (
                              <Box
                                key={file.id}
                                p={2}
                                border="1px solid"
                                borderColor="gray.200"
                                borderRadius="md"
                                display="flex"
                                justifyContent="space-between"
                                alignItems="center"
                              >
                                <Link href={file.url} isExternal color="teal.600" fontSize="sm">
                                  {file.name}
                                </Link>
                                <IconButton
                                  aria-label="Remove file"
                                  icon={<DeleteIcon />}
                                  size="xs"
                                  variant="ghost"
                                  colorScheme="red"
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

                    <EditableField
                      value={selectedAccount.clientLeadsSheetUrl || ''}
                      onSave={(value) => {
                        updateAccount(selectedAccount.name, {
                          clientLeadsSheetUrl: String(value) || undefined,
                        })
                        stopEditing(selectedAccount.name, 'clientLeadsSheetUrl')
                      }}
                      onCancel={() => stopEditing(selectedAccount.name, 'clientLeadsSheetUrl')}
                      isEditing={isFieldEditing(selectedAccount.name, 'clientLeadsSheetUrl')}
                      onEdit={() => startEditing(selectedAccount.name, 'clientLeadsSheetUrl')}
                      label="Client Leads"
                      type="url"
                      placeholder="https://docs.google.com/spreadsheets/d/..."
                      renderDisplay={(value) => (
                        value ? (
                          <Stack spacing={2}>
                            <Link
                              href={String(value)}
                              isExternal
                              color="teal.600"
                              fontSize="sm"
                              display="inline-flex"
                              alignItems="center"
                              gap={1}
                              onClick={(e) => {
                                e.preventDefault()
                                window.open(String(value), '_blank')
                                emit('navigateToLeads', { accountName: selectedAccount.name })
                              }}
                            >
                              {String(value)}
                              <ExternalLinkIcon />
                            </Link>
                            <Link
                              href={String(value)}
                              isExternal
                              color="teal.600"
                              fontSize="sm"
                              display="inline-flex"
                              alignItems="center"
                              gap={1}
                              onClick={(e) => {
                                e.preventDefault()
                                window.open(String(value), '_blank')
                                emit('navigateToLeads', { accountName: selectedAccount.name })
                              }}
                            >
                              Open in Leads Generated tab
                              <ExternalLinkIcon />
                            </Link>
                          </Stack>
                        ) : <Text fontSize="sm" color="gray.500">No Google Sheets link set</Text>
                      )}
                    />

                    <FieldRow label="DEFCON">
                      <Select
                        value={selectedAccount.defcon}
                        onChange={(e) => {
                          updateAccount(selectedAccount.name, {
                            defcon: parseInt(e.target.value, 10),
                          })
                        }}
                        size="sm"
                      >
                        <option value={1}>1 - Very Dissatisfied</option>
                        <option value={2}>2 - Dissatisfied</option>
                        <option value={3}>3 - Neutral</option>
                        <option value={4}>4 - Satisfied</option>
                        <option value={5}>5 - Very Satisfied</option>
                      </Select>
                    </FieldRow>

                    <FieldRow label="Contract Start">
                      <Input
                        type="date"
                        value={selectedAccount.contractStart}
                        onChange={(e) => {
                          updateAccount(selectedAccount.name, { contractStart: e.target.value })
                        }}
                        size="sm"
                      />
                    </FieldRow>

                    <FieldRow label="Contract End">
                      <Input
                        type="date"
                        value={selectedAccount.contractEnd}
                        onChange={(e) => {
                          updateAccount(selectedAccount.name, { contractEnd: e.target.value })
                        }}
                        size="sm"
                      />
                    </FieldRow>

                    <FieldRow label="Days (per week)">
                      <Select
                        value={selectedAccount.days}
                        onChange={(e) => {
                          updateAccount(selectedAccount.name, {
                            days: parseInt(e.target.value, 10),
                          })
                        }}
                        size="sm"
                      >
                        <option value={1}>1 day</option>
                        <option value={2}>2 days</option>
                        <option value={3}>3 days</option>
                        <option value={4}>4 days</option>
                        <option value={5}>5 days</option>
                      </Select>
                    </FieldRow>

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

                  <Divider mt={8} />

                  <Box py={4}>
                    <Button
                      colorScheme="red"
                      variant="outline"
                      leftIcon={<DeleteIcon />}
                      onClick={onDeleteModalOpen}
                      width="100%"
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
                  colorScheme="red"
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
                    <Link href={`mailto:${selectedContact.email}`} color="teal.600" isExternal>
                      {selectedContact.email}
                    </Link>
                  </FieldRow>

                  <FieldRow label="Phone Number">
                    <Link href={`tel:${selectedContact.phone}`} color="teal.600">
                      {selectedContact.phone}
                    </Link>
                  </FieldRow>

                  <FieldRow label="Account">
                    <Link
                      color="teal.600"
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
                    <Stack spacing={3}>
                      {AI_ABOUT_ENDPOINT && AI_ABOUT_API_KEY && contactSocialMediaLoading[selectedContact.name] && (
                        <Text fontSize="sm" color="gray.500">
                          Searching for social media profiles...
                        </Text>
                      )}
                      {AI_ABOUT_ENDPOINT && AI_ABOUT_API_KEY && !contactSocialMediaLoading[selectedContact.name] && (
                        <Button
                          size="sm"
                          colorScheme="teal"
                          variant="outline"
                          leftIcon={<SearchIcon />}
                          onClick={async () => {
                            setContactSocialMediaLoading((prev) => ({ ...prev, [selectedContact.name]: true }))
                            try {
                              const socialMedia = await fetchContactSocialMedia(selectedContact)
                              setContactSocialMediaMap((prev) => ({
                                ...prev,
                                [selectedContact.name]: socialMedia,
                              }))
                              toast({
                                title: socialMedia.length > 0 ? 'Social media found' : 'No social media found',
                                description:
                                  socialMedia.length > 0
                                    ? `Found ${socialMedia.length} profile(s)`
                                    : 'No verified social media profiles found for this contact.',
                                status: socialMedia.length > 0 ? 'success' : 'info',
                                duration: 3000,
                                isClosable: true,
                              })
                            } catch (error) {
                              toast({
                                title: 'Error',
                                description: 'Failed to search for social media profiles.',
                                status: 'error',
                                duration: 3000,
                                isClosable: true,
                              })
                            } finally {
                              setContactSocialMediaLoading((prev) => ({
                                ...prev,
                                [selectedContact.name]: false,
                              }))
                            }
                          }}
                        >
                          Search for Social Media
                        </Button>
                      )}
                      {(!AI_ABOUT_ENDPOINT || !AI_ABOUT_API_KEY) && (
                        <Alert status="warning" size="sm" borderRadius="md">
                          <AlertIcon />
                          <AlertDescription fontSize="xs">
                            AI not configured. Set VITE_AI_ABOUT_ENDPOINT and VITE_AI_ABOUT_API_KEY in .env file.
                          </AlertDescription>
                        </Alert>
                      )}
                      {(contactSocialMediaMap[selectedContact.name] || selectedContact.socialMedia || []).length >
                        0 && (
                        <Stack spacing={2}>
                          <Wrap spacing={2}>
                            {(contactSocialMediaMap[selectedContact.name] ||
                              selectedContact.socialMedia ||
                              []).map((profile) => (
                              <WrapItem key={profile.url}>
                                <Link
                                  href={profile.url}
                                  isExternal
                                  color="teal.600"
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
                        </Stack>
                      )}
                      {!contactSocialMediaLoading[selectedContact.name] &&
                        (contactSocialMediaMap[selectedContact.name] || selectedContact.socialMedia || []).length ===
                          0 &&
                        AI_ABOUT_ENDPOINT &&
                        AI_ABOUT_API_KEY && (
                          <Text fontSize="sm" color="gray.500">
                            No social media profiles found. Click "Search for Social Media" to search.
                          </Text>
                        )}
                    </Stack>
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
