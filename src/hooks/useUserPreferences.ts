import { useState, useEffect, useCallback, useRef } from 'react'
import { api } from '../utils/api'

export interface TabOrderPreference {
  [section: string]: string[] // section -> array of tab IDs in order
}

export interface UserPreferences {
  tabOrders?: TabOrderPreference
  // Add other preference types here in the future
  theme?: 'light' | 'dark'
  sidebarCollapsed?: boolean
}

/**
 * Hook for managing user preferences (tab orders, UI settings, etc.)
 * Automatically syncs with the database based on user email
 */
export function useUserPreferences(userEmail: string | null) {
  const [preferences, setPreferences] = useState<UserPreferences>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Load preferences from database - ONE attempt, no retries
  const hasAttemptedLoadRef = useRef(false)
  
  useEffect(() => {
    if (!userEmail) {
      setLoading(false)
      return
    }
    
    // Prevent re-attempts - load ONCE only
    if (hasAttemptedLoadRef.current) return
    hasAttemptedLoadRef.current = true

    const loadPreferences = async () => {
      try {
        setLoading(true)
        setError(null)
        const response = await api.get<{ data: UserPreferences }>(
          `/api/user-preferences/${encodeURIComponent(userEmail)}`
        )
        
        if (response.error) {
          // API returned error (400, 500, etc.) - fall back to defaults silently
          // This is expected for new users or DB issues - app should not block
          console.warn('[UserPreferences] Load failed, using defaults:', response.error)
          setPreferences({})
          return
        }

        // Success: extract preferences from { data: {...} } response shape
        setPreferences(response.data?.data || {})
      } catch (err) {
        // Network/unexpected error - fall back to defaults silently
        console.warn('[UserPreferences] Load exception, using defaults:', err instanceof Error ? err.message : 'Unknown')
        setPreferences({})
      } finally {
        setLoading(false)
      }
    }

    loadPreferences()
  }, [userEmail])

  // Save tab order for a specific section
  const saveTabOrder = useCallback(
    async (section: string, tabIds: string[]) => {
      if (!userEmail) {
        console.warn('Cannot save tab order: no user email')
        return
      }

      const previousPreferences = { ...preferences }
      
      // Clear any stale error from previous failed attempt
      setError(null)
      
      try {
        const newTabOrders = {
          ...preferences.tabOrders,
          [section]: tabIds,
        }

        const updatedPreferences = {
          ...preferences,
          tabOrders: newTabOrders,
        }

        // Optimistically update local state
        setPreferences(updatedPreferences)

        // Save to database - response shape is { data: {...} } on success, { error: "..." } on failure
        const response = await api.put<{ data: UserPreferences }>('/api/user-preferences', {
          userEmail,
          preferences: updatedPreferences,
        })

        // CRITICAL: Check for error - 500 responses return { error: "..." }
        if (response.error) {
          throw new Error(response.error)
        }

        // Success - ensure error is cleared
        setError(null)

        if (import.meta.env.DEV) {
          console.log(`[UserPreferences] Saved tab order for ${section}`)
        }
      } catch (err) {
        // Save failed - revert optimistic update and surface error
        console.error('[UserPreferences] Save failed:', err)
        setError(err instanceof Error ? err.message : 'Failed to save tab order')
        setPreferences(previousPreferences)
      }
    },
    [userEmail, preferences]
  )

  // Get tab order for a specific section
  const getTabOrder = useCallback(
    (section: string): string[] | null => {
      return preferences.tabOrders?.[section] || null
    },
    [preferences]
  )

  // Update any preference
  const updatePreference = useCallback(
    async <K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) => {
      if (!userEmail) {
        console.warn('Cannot update preference: no user email')
        return
      }

      const previousPreferences = { ...preferences }

      // Clear any stale error from previous failed attempt
      setError(null)

      try {
        const updatedPreferences = {
          ...preferences,
          [key]: value,
        }

        // Optimistically update local state
        setPreferences(updatedPreferences)

        // Save to database - response shape is { data: {...} } on success, { error: "..." } on failure
        const response = await api.put<{ data: UserPreferences }>('/api/user-preferences', {
          userEmail,
          preferences: updatedPreferences,
        })

        // CRITICAL: Check for error - 500 responses return { error: "..." }
        if (response.error) {
          throw new Error(response.error)
        }

        // Success - ensure error is cleared
        setError(null)
      } catch (err) {
        // Save failed - revert optimistic update and surface error
        console.error('[UserPreferences] Update failed:', err)
        setError(err instanceof Error ? err.message : 'Failed to update preference')
        setPreferences(previousPreferences)
      }
    },
    [userEmail, preferences]
  )

  return {
    preferences,
    loading,
    error,
    saveTabOrder,
    getTabOrder,
    updatePreference,
  }
}