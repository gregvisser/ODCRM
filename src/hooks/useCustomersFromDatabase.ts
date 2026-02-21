/**
 * Custom hook to load customers from database API
 * This is the single source of truth for customer data
 * Replaces localStorage-based loading
 */

import { useState, useEffect, useCallback } from 'react'
import { api } from '../utils/api'
import { normalizeCustomersListResponse } from '../utils/normalizeApiResponse'
import { on } from '../platform/events'
import type { DatabaseCustomer } from '../types/customer'

export type { DatabaseCustomer }

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
    
    const { data, error: fetchError } = await api.get('/api/customers')
    
    if (fetchError) {
      console.error('❌ Failed to fetch customers from database:', fetchError)
      setError(fetchError)
      setCustomers([])
      setLoading(false)
      return
    }
    
    try {
      // Use canonical normalizer - throws on unexpected shape
      const customersArray = normalizeCustomersListResponse(data)
      console.log('✅ Loaded customers from database:', customersArray.length)
      setCustomers(customersArray)
    } catch (err: any) {
      console.error('❌ Failed to normalize customers response:', err)
      setError(err.message || 'Failed to parse customers response')
      setCustomers([])
    }
    
    setLoading(false)
  }, [])

  // Load on mount
  useEffect(() => {
    fetchCustomers()
  }, [fetchCustomers])

  // Keep customers fresh across the app when anything updates a customer in DB.
  useEffect(() => {
    const off = on('customerUpdated', () => {
      void fetchCustomers()
    })
    const offCreated = on('customerCreated', () => {
      void fetchCustomers()
    })
    return () => {
      off()
      offCreated()
    }
  }, [fetchCustomers])

  const createCustomer = useCallback(async (data: Partial<DatabaseCustomer>) => {
    const payload = {
      name: data.name,
      domain: data.domain || null,
      leadsReportingUrl: data.leadsReportingUrl || null,
      sector: data.sector || null,
      clientStatus: data.clientStatus || 'active',
      targetJobTitle: data.targetJobTitle || null,
      prospectingLocation: data.prospectingLocation || null,
      monthlyIntakeGBP: data.monthlyIntakeGBP ? parseFloat(data.monthlyIntakeGBP) : null,
      defcon: data.defcon || null,
      weeklyLeadTarget: data.weeklyLeadTarget || null,
      weeklyLeadActual: data.weeklyLeadActual || null,
      monthlyLeadTarget: data.monthlyLeadTarget || null,
      monthlyLeadActual: data.monthlyLeadActual || null,
      website: data.website || null,
      whatTheyDo: data.whatTheyDo || null,
      accreditations: data.accreditations || null,
      keyLeaders: data.keyLeaders || null,
      companyProfile: data.companyProfile || null,
      recentNews: data.recentNews || null,
      companySize: data.companySize || null,
      headquarters: data.headquarters || null,
      foundingYear: data.foundingYear || null,
      socialPresence: data.socialPresence || null,
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
    const payload = {
      name: data.name,
      domain: data.domain || null,
      leadsReportingUrl: data.leadsReportingUrl || null,
      sector: data.sector || null,
      clientStatus: data.clientStatus || 'active',
      targetJobTitle: data.targetJobTitle || null,
      prospectingLocation: data.prospectingLocation || null,
      monthlyIntakeGBP: data.monthlyIntakeGBP ? parseFloat(data.monthlyIntakeGBP) : null,
      defcon: data.defcon || null,
      weeklyLeadTarget: data.weeklyLeadTarget || null,
      weeklyLeadActual: data.weeklyLeadActual || null,
      monthlyLeadTarget: data.monthlyLeadTarget || null,
      monthlyLeadActual: data.monthlyLeadActual || null,
      website: data.website || null,
      whatTheyDo: data.whatTheyDo || null,
      accreditations: data.accreditations || null,
      keyLeaders: data.keyLeaders || null,
      companyProfile: data.companyProfile || null,
      recentNews: data.recentNews || null,
      companySize: data.companySize || null,
      headquarters: data.headquarters || null,
      foundingYear: data.foundingYear || null,
      socialPresence: data.socialPresence || null,
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
