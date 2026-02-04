/**
 * Custom hook to load customers from database API
 * This is the single source of truth for customer data
 * Replaces localStorage-based loading
 */

import { useState, useEffect, useCallback } from 'react'
import { api } from '../utils/api'

export type DatabaseCustomer = {
  id: string
  name: string
  domain?: string | null
  leadsReportingUrl?: string | null
  sector?: string | null
  clientStatus: string
  targetJobTitle?: string | null
  prospectingLocation?: string | null
  monthlyIntakeGBP?: string | null
  defcon?: number | null
  weeklyLeadTarget?: number | null
  weeklyLeadActual?: number | null
  monthlyLeadTarget?: number | null
  monthlyLeadActual?: number | null
  website?: string | null
  whatTheyDo?: string | null
  accreditations?: string | null
  keyLeaders?: string | null
  companyProfile?: string | null
  recentNews?: string | null
  companySize?: string | null
  headquarters?: string | null
  foundingYear?: string | null
  socialPresence?: Array<{ label: string; url: string }> | null
  accountData?: any | null
  createdAt: string
  updatedAt: string
  customerContacts: Array<{
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
  }>
}

type UseCustomersResult = {
  customers: DatabaseCustomer[]
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
  createCustomer: (data: Partial<DatabaseCustomer>) => Promise<{ id?: string; error?: string }>
  updateCustomer: (id: string, data: Partial<DatabaseCustomer>) => Promise<{ error?: string }>
  deleteCustomer: (id: string) => Promise<{ error?: string }>
}

/**
 * Hook to manage customers from the database
 * This is the SINGLE SOURCE OF TRUTH for customer data
 */
export function useCustomersFromDatabase(): UseCustomersResult {
  const [customers, setCustomers] = useState<DatabaseCustomer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchCustomers = useCallback(async () => {
    setLoading(true)
    setError(null)
    
    const { data, error: fetchError } = await api.get<DatabaseCustomer[]>('/api/customers')
    
    if (fetchError) {
      console.error('❌ Failed to fetch customers from database:', fetchError)
      setError(fetchError)
      setCustomers([])
    } else if (data) {
      console.log('✅ Loaded customers from database:', data.length)
      setCustomers(data)
    }
    
    setLoading(false)
  }, [])

  // Load on mount
  useEffect(() => {
    fetchCustomers()
  }, [fetchCustomers])

  const createCustomer = useCallback(async (data: Partial<DatabaseCustomer>) => {
    const toNum = (v: unknown): number | null => {
      if (v === undefined || v === null || v === '') return null
      const n = typeof v === 'number' ? v : parseFloat(String(v))
      return Number.isFinite(n) ? n : null
    }
    const toUrl = (v: unknown): string | null => {
      if (v === undefined || v === null || typeof v !== 'string') return null
      const s = v.trim()
      return s && (s.startsWith('http://') || s.startsWith('https://')) ? s : null
    }
    const payload = {
      name: data.name ?? '',
      domain: data.domain || null,
      leadsReportingUrl: toUrl(data.leadsReportingUrl),
      sector: data.sector || null,
      clientStatus: (data.clientStatus || 'active').toString().toLowerCase(),
      targetJobTitle: data.targetJobTitle || null,
      prospectingLocation: data.prospectingLocation || null,
      monthlyIntakeGBP: toNum(data.monthlyIntakeGBP),
      defcon: (() => {
        const n = toNum(data.defcon)
        return n != null ? Math.min(6, Math.max(1, Math.round(n))) : null
      })(),
      weeklyLeadTarget: toNum(data.weeklyLeadTarget),
      weeklyLeadActual: toNum(data.weeklyLeadActual),
      monthlyLeadTarget: toNum(data.monthlyLeadTarget),
      monthlyLeadActual: toNum(data.monthlyLeadActual),
      website: data.website || null,
      whatTheyDo: data.whatTheyDo || null,
      accreditations: data.accreditations || null,
      keyLeaders: data.keyLeaders || null,
      companyProfile: data.companyProfile || null,
      recentNews: data.recentNews || null,
      companySize: data.companySize || null,
      headquarters: data.headquarters || null,
      foundingYear: data.foundingYear || null,
      socialPresence: Array.isArray(data.socialPresence)
        ? data.socialPresence.filter((i: { url?: string }) => i && typeof i.url === 'string' && (i.url.startsWith('http://') || i.url.startsWith('https://')))
        : null,
      accountData: data.accountData || null,
    }

    const { data: result, error: createError } = await api.post<{ id: string; name: string }>('/api/customers', payload)

    if (createError) {
      console.error('❌ Failed to create customer:', createError)
      return { error: createError }
    }

    console.log('✅ Customer created:', result)
    await fetchCustomers() // Refresh list
    return { id: result?.id }
  }, [fetchCustomers])

  const updateCustomer = useCallback(async (id: string, data: Partial<DatabaseCustomer>) => {
    const toNum = (v: unknown): number | null => {
      if (v === undefined || v === null || v === '') return null
      const n = typeof v === 'number' ? v : parseFloat(String(v))
      return Number.isFinite(n) ? n : null
    }
    const toUrl = (v: unknown): string | null => {
      if (v === undefined || v === null || typeof v !== 'string') return null
      const s = v.trim()
      return s && (s.startsWith('http://') || s.startsWith('https://')) ? s : null
    }
    const payload = {
      name: data.name ?? '',
      domain: data.domain || null,
      leadsReportingUrl: toUrl(data.leadsReportingUrl),
      sector: data.sector || null,
      clientStatus: (data.clientStatus || 'active').toString().toLowerCase(),
      targetJobTitle: data.targetJobTitle || null,
      prospectingLocation: data.prospectingLocation || null,
      monthlyIntakeGBP: toNum(data.monthlyIntakeGBP),
      defcon: (() => {
        const n = toNum(data.defcon)
        return n != null ? Math.min(6, Math.max(1, Math.round(n))) : null
      })(),
      weeklyLeadTarget: toNum(data.weeklyLeadTarget),
      weeklyLeadActual: toNum(data.weeklyLeadActual),
      monthlyLeadTarget: toNum(data.monthlyLeadTarget),
      monthlyLeadActual: toNum(data.monthlyLeadActual),
      website: data.website || null,
      whatTheyDo: data.whatTheyDo || null,
      accreditations: data.accreditations || null,
      keyLeaders: data.keyLeaders || null,
      companyProfile: data.companyProfile || null,
      recentNews: data.recentNews || null,
      companySize: data.companySize || null,
      headquarters: data.headquarters || null,
      foundingYear: data.foundingYear || null,
      socialPresence: Array.isArray(data.socialPresence)
        ? data.socialPresence.filter((i: { url?: string }) => i && typeof i.url === 'string' && (i.url.startsWith('http://') || i.url.startsWith('https://')))
        : null,
      accountData: data.accountData || null,
    }

    const { error: updateError } = await api.put(`/api/customers/${id}`, payload)

    if (updateError) {
      console.error('❌ Failed to update customer:', updateError)
      return { error: updateError }
    }

    console.log('✅ Customer updated:', id)
    await fetchCustomers() // Refresh list
    return {}
  }, [fetchCustomers])

  const deleteCustomer = useCallback(async (id: string) => {
    const { error: deleteError } = await api.delete(`/api/customers/${id}`)

    if (deleteError) {
      console.error('❌ Failed to delete customer:', deleteError)
      return { error: deleteError }
    }

    console.log('✅ Customer deleted:', id)
    await fetchCustomers() // Refresh list
    return {}
  }, [fetchCustomers])

  return {
    customers,
    loading,
    error,
    refetch: fetchCustomers,
    createCustomer,
    updateCustomer,
    deleteCustomer,
  }
}
