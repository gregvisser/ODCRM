import { useState, useEffect, useCallback } from 'react'
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

  // Load preferences from database
  useEffect(() => {
    if (!userEmail) {
      setLoading(false)
      return
    }

    const loadPreferences = async () => {
      try {
        setLoading(true)
        setError(null)
        const response = await api.get(`/api/user-preferences/${encodeURIComponent(userEmail)}`)
        
        if (response.error) {
          throw new Error(response.error)
        }

        setPreferences(response.data?.preferences || {})
      } catch (err) {
        console.error('Failed to load user preferences:', err)
        setError(err instanceof Error ? err.message : 'Failed to load preferences')
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

        // Save to database
        const response = await api.put('/api/user-preferences', {
          userEmail,
          preferences: updatedPreferences,
        })

        if (response.error) {
          throw new Error(response.error)
        }

        console.log(`✅ Saved tab order for ${section}:`, tabIds)
      } catch (err) {
        console.error('Failed to save tab order:', err)
        setError(err instanceof Error ? err.message : 'Failed to save tab order')
        // Revert optimistic update
        setPreferences(preferences)
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

      try {
        const updatedPreferences = {
          ...preferences,
          [key]: value,
        }

        // Optimistically update local state
        setPreferences(updatedPreferences)

        // Save to database
        const response = await api.put('/api/user-preferences', {
          userEmail,
          preferences: updatedPreferences,
        })

        if (response.error) {
          throw new Error(response.error)
        }
      } catch (err) {
        console.error('Failed to update preference:', err)
        setError(err instanceof Error ? err.message : 'Failed to update preference')
        // Revert optimistic update
        setPreferences(preferences)
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
