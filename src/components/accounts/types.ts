export type AssignedAccountManagerUser = {
  id: string
  userId: string
  firstName: string
  lastName: string
  email: string
  role: string
  department?: string | null
  accountStatus?: string | null
}

export type CustomerContact = {
  id: string
  customerId: string
  name: string
  email?: string | null
  phone?: string | null
  title?: string | null
  isPrimary: boolean
  notes?: string | null
  createdAt: string
  updatedAt: string
}

export type AccountNote = {
  id: string
  content: string
  user: string
  userId?: string
  userEmail?: string
  timestamp: string
}

export type CustomerDetail = {
  id: string
  name: string
  domain?: string | null
  website?: string | null
  sector?: string | null
  companySize?: string | null
  headquarters?: string | null
  foundingYear?: string | null
  whatTheyDo?: string | null
  accreditations?: string | null
  keyLeaders?: string | null
  companyProfile?: string | null
  recentNews?: string | null
  socialPresence?: Array<{ label: string; url: string }> | null
  leadsReportingUrl?: string | null
  leadsGoogleSheetLabel?: string | null
  monthlyIntakeGBP?: string | number | null
  monthlyRevenueFromCustomer?: string | number | null
  weeklyLeadTarget?: number | null
  weeklyLeadActual?: number | null
  monthlyLeadTarget?: number | null
  monthlyLeadActual?: number | null
  defcon?: number | null
  agreementFileName?: string | null
  agreementUploadedAt?: string | null
  agreementUploadedByEmail?: string | null
  agreementFileUrl?: string | null
  agreementBlobName?: string | null
  agreementContainerName?: string | null
  accountData?: Record<string, unknown> | null
  customerContacts: CustomerContact[]
  assignedAccountManagerUser?: AssignedAccountManagerUser
  createdAt: string
  updatedAt: string
}

