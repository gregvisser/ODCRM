/**
 * useDatabaseFirst - Enforces database-first architecture
 * 
 * This hook ensures components ALWAYS fetch fresh data from the API
 * and only use localStorage as an emergency cache when the API fails.
 * 
 * Features:
 * - Fetches immediately on mount
 * - Auto-refreshes periodically (default 30s)
 * - Falls back to cache only when API fails
 * - Optimistic updates with revert on error
 * - Event-based cross-component updates
 * 
 * @example
 * const { data, loading, error, refresh, update } = useDatabaseFirst({
 *   apiEndpoint: '/api/customers',
 *   cacheKey: 'customers',
 *   refreshInterval: 30000, // 30 seconds
 * })
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { useToast } from '@chakra-ui/react'
import { api } from '../utils/api'
import { getJson, setJson } from '../platform/storage'
import { on, emit } from '../platform/events'

export interface UseDatabaseFirstOptions<T> {
  /** API endpoint to fetch from (e.g., '/api/customers') */
  apiEndpoint: string
  
  /** localStorage key for caching (e.g., 'customers') */
  cacheKey: string
  
  /** Auto-refresh interval in milliseconds (default: 30000 = 30s) */
  refreshInterval?: number
  
  /** Event name to listen for updates (e.g., 'customersUpdated') */
  updateEvent?: string
  
  /** Whether to show loading spinner on first load (default: true) */
  showInitialLoading?: boolean
  
  /** Whether to enable auto-refresh (default: true) */
  enableAutoRefresh?: boolean
  
  /** Transform function to apply to API response data */
  transform?: (data: any) => T[]
  
  /** Whether to show toast notifications (default: false) */
  showToasts?: boolean
}

export interface UseDatabaseFirstResult<T> {
  /** Current data from API */
  data: T[]
  
  /** Loading state (true only on initial load) */
  loading: boolean
  
  /** Error message if fetch failed */
  error: string | null
  
  /** Last successful sync timestamp */
  lastSync: Date
  
  /** Manually refresh data from API */
  refresh: (showLoading?: boolean) => Promise<void>
  
  /** Update a single item (optimistic update + API sync) */
  update: (id: string, updates: Partial<T>) => Promise<void>
  
  /** Create a new item (optimistic create + API sync) */
  create: (item: Omit<T, 'id'>) => Promise<void>
  
  /** Delete an item (optimistic delete + API sync) */
  remove: (id: string) => Promise<void>
}

export function useDatabaseFirst<T extends { id?: string; _databaseId?: string }>(
  options: UseDatabaseFirstOptions<T>
): UseDatabaseFirstResult<T> {
  const {
    apiEndpoint,
    cacheKey,
    refreshInterval = 30000, // 30 seconds default
    updateEvent,
    showInitialLoading = true,
    enableAutoRefresh = true,
    transform,
    showToasts = false,
  } = options
  
  const toast = showToasts ? useToast() : null
  
  // State
  const [data, setData] = useState<T[]>([])
  const [loading, setLoading] = useState(showInitialLoading)
  const [error, setError] = useState<string | null>(null)
  const [lastSync, setLastSync] = useState<Date>(new Date())
  
  // Ref to track if component is mounted (prevent state updates after unmount)
  const isMountedRef = useRef(true)
  
  // Ref to track fetch promise (prevent duplicate fetches)
  const fetchPromiseRef = useRef<Promise<void> | null>(null)
  
  /**
   * Fetch fresh data from API
   * Falls back to cache only if API fails
   */
  const refresh = useCallback(async (showLoadingSpinner = true) => {
    // If already fetching, return existing promise
    if (fetchPromiseRef.current) {
      return fetchPromiseRef.current
    }
    
    if (showLoadingSpinner) setLoading(true)
    setError(null)
    
    const fetchPromise = (async () => {
      try {
        console.log(`🔄 [${cacheKey}] Fetching from API: ${apiEndpoint}`)
        
        const response = await api.get<{ data?: T[], leads?: T[] } | T[]>(apiEndpoint)
        let freshData: T[]
        
        // Handle different API response formats
        if (response.data) {
          if (Array.isArray(response.data)) {
            freshData = response.data
          } else if ('data' in response.data && Array.isArray(response.data.data)) {
            freshData = response.data.data
          } else if ('leads' in response.data && Array.isArray(response.data.leads)) {
            freshData = response.data.leads
          } else {
            throw new Error('Unexpected API response format')
          }
        } else if (response.error) {
          throw new Error(response.error)
        } else {
          throw new Error('No data in API response')
        }
        
        // Apply transform if provided
        const transformedData = transform ? transform(freshData) : freshData
        
        if (isMountedRef.current) {
          setData(transformedData)
          setLastSync(new Date())
          
          // Cache in background (async, don't wait)
          setJson(cacheKey, transformedData)
          
          console.log(`✅ [${cacheKey}] Loaded ${transformedData.length} items from API`)
          
          if (showToasts && toast) {
            toast({
              title: 'Data refreshed',
              status: 'success',
              duration: 2000,
              isClosable: true,
            })
          }
        }
      } catch (err: any) {
        console.error(`❌ [${cacheKey}] API fetch failed:`, err)
        
        // Fallback to cache only if API fails
        const cached = getJson<T[]>(cacheKey)
        if (cached && Array.isArray(cached) && cached.length > 0) {
          if (isMountedRef.current) {
            setData(cached)
            console.warn(`⚠️ [${cacheKey}] Using cached data (${cached.length} items)`)
            
            if (showToasts && toast) {
              toast({
                title: 'Using cached data',
                description: 'Unable to fetch fresh data from server',
                status: 'warning',
                duration: 5000,
                isClosable: true,
              })
            }
          }
        } else {
          if (isMountedRef.current) {
            setError(err.message || 'Failed to fetch data')
          }
        }
      } finally {
        if (isMountedRef.current) {
          if (showLoadingSpinner) setLoading(false)
        }
        fetchPromiseRef.current = null
      }
    })()
    
    fetchPromiseRef.current = fetchPromise
    return fetchPromise
  }, [apiEndpoint, cacheKey, transform, showToasts, toast])
  
  /**
   * Update a single item (optimistic update + API sync)
   */
  const update = useCallback(async (id: string, updates: Partial<T>) => {
    const idField = data[0]?.id !== undefined ? 'id' : '_databaseId'
    const previousData = [...data]
    
    try {
      // 1. Optimistic update
      setData(prev => prev.map(item => 
        item[idField] === id ? { ...item, ...updates } as T : item
      ))
      
      // 2. Sync to API immediately
      await api.put(`${apiEndpoint}/${id}`, updates)
      
      // 3. Emit event for other components
      if (updateEvent) {
        emit(updateEvent, { id, updates })
      }
      
      console.log(`✅ [${cacheKey}] Updated item ${id}`)
      
      // 4. Refresh to get server state (includes any server-side calculations)
      await refresh(false)
      
    } catch (err: any) {
      console.error(`❌ [${cacheKey}] Update failed:`, err)
      
      // Revert optimistic update
      setData(previousData)
      
      if (showToasts && toast) {
        toast({
          title: 'Failed to save',
          description: err.message || 'Unable to update item',
          status: 'error',
          duration: 5000,
          isClosable: true,
        })
      }
      
      throw err
    }
  }, [apiEndpoint, cacheKey, data, refresh, updateEvent, showToasts, toast])
  
  /**
   * Create a new item (optimistic create + API sync)
   */
  const create = useCallback(async (item: Omit<T, 'id'>) => {
    const tempId = `temp_${Date.now()}`
    const optimisticItem = { ...item, id: tempId } as T
    
    try {
      // 1. Optimistic create
      setData(prev => [...prev, optimisticItem])
      
      // 2. Sync to API immediately
      const response = await api.post(apiEndpoint, item)
      
      // 3. Emit event for other components
      if (updateEvent) {
        emit(updateEvent, { created: response.data })
      }
      
      console.log(`✅ [${cacheKey}] Created item`)
      
      // 4. Refresh to get server state with real ID
      await refresh(false)
      
    } catch (err: any) {
      console.error(`❌ [${cacheKey}] Create failed:`, err)
      
      // Remove optimistic item
      setData(prev => prev.filter(x => x.id !== tempId))
      
      if (showToasts && toast) {
        toast({
          title: 'Failed to create',
          description: err.message || 'Unable to create item',
          status: 'error',
          duration: 5000,
          isClosable: true,
        })
      }
      
      throw err
    }
  }, [apiEndpoint, cacheKey, refresh, updateEvent, showToasts, toast])
  
  /**
   * Delete an item (optimistic delete + API sync)
   */
  const remove = useCallback(async (id: string) => {
    const idField = data[0]?.id !== undefined ? 'id' : '_databaseId'
    const previousData = [...data]
    
    try {
      // 1. Optimistic delete
      setData(prev => prev.filter(item => item[idField] !== id))
      
      // 2. Sync to API immediately
      await api.delete(`${apiEndpoint}/${id}`)
      
      // 3. Emit event for other components
      if (updateEvent) {
        emit(updateEvent, { deleted: id })
      }
      
      console.log(`✅ [${cacheKey}] Deleted item ${id}`)
      
    } catch (err: any) {
      console.error(`❌ [${cacheKey}] Delete failed:`, err)
      
      // Revert optimistic delete
      setData(previousData)
      
      if (showToasts && toast) {
        toast({
          title: 'Failed to delete',
          description: err.message || 'Unable to delete item',
          status: 'error',
          duration: 5000,
          isClosable: true,
        })
      }
      
      throw err
    }
  }, [apiEndpoint, cacheKey, data, updateEvent, showToasts, toast])
  
  // Mount effect: Fetch immediately
  useEffect(() => {
    refresh(showInitialLoading)
  }, [refresh, showInitialLoading])
  
  // Auto-refresh effect
  useEffect(() => {
    if (!enableAutoRefresh) return
    
    const interval = setInterval(() => {
      refresh(false) // Silent background refresh
    }, refreshInterval)
    
    return () => clearInterval(interval)
  }, [enableAutoRefresh, refresh, refreshInterval])
  
  // Event listener effect (on() returns unsubscribe)
  useEffect(() => {
    if (!updateEvent) return
    
    const handleUpdate = () => {
      refresh(false) // Silent refresh when event fired
    }
    
    const unsubscribe = on(updateEvent, handleUpdate)
    return unsubscribe
  }, [updateEvent, refresh])
  
  // Cleanup effect
  useEffect(() => {
    return () => {
      isMountedRef.current = false
      fetchPromiseRef.current = null
    }
  }, [])
  
  return {
    data,
    loading,
    error,
    lastSync,
    refresh,
    update,
    create,
    remove,
  }
}
