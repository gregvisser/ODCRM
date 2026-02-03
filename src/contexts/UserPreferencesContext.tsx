import { createContext, useContext, type ReactNode } from 'react'
import { useMsal } from '@azure/msal-react'
import { useUserPreferences, type UserPreferences } from '../hooks/useUserPreferences'

interface UserPreferencesContextValue {
  userEmail: string | null
  preferences: UserPreferences
  loading: boolean
  error: string | null
  saveTabOrder: (section: string, tabIds: string[]) => Promise<void>
  getTabOrder: (section: string) => string[] | null
  updatePreference: <K extends keyof UserPreferences>(
    key: K,
    value: UserPreferences[K]
  ) => Promise<void>
}

const UserPreferencesContext = createContext<UserPreferencesContextValue | null>(null)

export function UserPreferencesProvider({ children }: { children: ReactNode }) {
  const { accounts } = useMsal()
  const userEmail = accounts[0]?.username?.toLowerCase() || null

  const {
    preferences,
    loading,
    error,
    saveTabOrder,
    getTabOrder,
    updatePreference,
  } = useUserPreferences(userEmail)

  return (
    <UserPreferencesContext.Provider
      value={{
        userEmail,
        preferences,
        loading,
        error,
        saveTabOrder,
        getTabOrder,
        updatePreference,
      }}
    >
      {children}
    </UserPreferencesContext.Provider>
  )
}

export function useUserPreferencesContext() {
  const context = useContext(UserPreferencesContext)
  if (!context) {
    throw new Error('useUserPreferencesContext must be used within UserPreferencesProvider')
  }
  return context
}
