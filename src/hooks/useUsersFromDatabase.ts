/**
 * Custom hook to manage users from database API
 * Handles automatic migration from localStorage to database
 * This is the single source of truth for user data
 */

import { useState, useEffect, useCallback } from 'react'
import { api } from '../utils/api'

export type DatabaseUser = {
  id: string
  userId: string
  firstName: string
  lastName: string
  email: string
  username: string
  phoneNumber?: string | null
  role: string
  department: string
  accountStatus: 'Active' | 'Inactive'
  lastLoginDate: string | 'Never'
  createdDate: string
  profilePhoto?: string | null
  updatedAt: string
}

type UseUsersResult = {
  users: DatabaseUser[]
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
  createUser: (data: Omit<DatabaseUser, 'id' | 'updatedAt'>) => Promise<{ id?: string; error?: string }>
  updateUser: (id: string, data: Partial<DatabaseUser>) => Promise<{ error?: string }>
  deleteUser: (id: string) => Promise<{ error?: string }>
}

/**
 * Hook to manage users from the database
 * This is the SINGLE SOURCE OF TRUTH for user data
 * Automatically migrates from localStorage on first load if needed
 */
export function useUsersFromDatabase(): UseUsersResult {
  const [users, setUsers] = useState<DatabaseUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [hasMigrated, setHasMigrated] = useState(false)

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    setError(null)
    
    const { data, error: fetchError } = await api.get<DatabaseUser[]>('/api/users')
    
    if (fetchError) {
      console.error('❌ Failed to fetch users from database:', fetchError)
      setError(fetchError)
      setUsers([])
    } else if (data) {
      console.log('✅ Loaded users from database:', data.length)
      setUsers(data)
      
      // If database is empty and we haven't migrated yet, try to migrate from localStorage
      if (data.length === 0 && !hasMigrated) {
        await migrateFromLocalStorage()
      }
    }
    
    setLoading(false)
  }, [hasMigrated])

  const migrateFromLocalStorage = useCallback(async () => {
    try {
      const stored = localStorage.getItem('users')
      if (!stored) {
        console.log('ℹ️ No users in localStorage to migrate')
        setHasMigrated(true)
        return
      }

      const localUsers = JSON.parse(stored) as any[]
      if (!Array.isArray(localUsers) || localUsers.length === 0) {
        console.log('ℹ️ No users in localStorage to migrate')
        setHasMigrated(true)
        return
      }

      console.log(`🔄 Migrating ${localUsers.length} users from localStorage to database...`)
      
      let successCount = 0
      let errorCount = 0
      
      for (const user of localUsers) {
        try {
          const payload = {
            id: user.id,
            userId: user.userId || user.id,
            firstName: user.firstName || '',
            lastName: user.lastName || '',
            email: user.email || '',
            username: user.username || user.email || '',
            phoneNumber: user.phoneNumber || null,
            role: user.role || 'Operations',
            department: user.department || 'Operations',
            accountStatus: user.accountStatus || 'Active',
            lastLoginDate: user.lastLoginDate && user.lastLoginDate !== 'Never' ? user.lastLoginDate : null,
            profilePhoto: user.profilePhoto || null,
            createdDate: user.createdDate || new Date().toISOString().split('T')[0],
          }

          const { error: createError } = await api.post('/api/users', payload)
          
          if (createError) {
            console.error(`❌ Failed to migrate user ${user.email}:`, createError)
            errorCount++
          } else {
            console.log(`✅ Migrated user: ${user.email}`)
            successCount++
          }
        } catch (err) {
          console.error(`❌ Error migrating user ${user.email}:`, err)
          errorCount++
        }
      }

      console.log(`✅ Migration complete: ${successCount} succeeded, ${errorCount} failed`)
      setHasMigrated(true)
      
      // Refetch to show migrated users
      if (successCount > 0) {
        await fetchUsers()
      }

      // Keep localStorage as backup for now (can be removed in future)
      // localStorage.removeItem('users')
      
    } catch (err: any) {
      console.error('❌ Migration error:', err)
      setHasMigrated(true)
    }
  }, [fetchUsers])

  // Load on mount
  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  const createUser = useCallback(async (data: Omit<DatabaseUser, 'id' | 'updatedAt'>) => {
    const payload = {
      userId: data.userId,
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      username: data.username || data.email,
      phoneNumber: data.phoneNumber || null,
      role: data.role,
      department: data.department,
      accountStatus: data.accountStatus || 'Active',
      lastLoginDate: data.lastLoginDate && data.lastLoginDate !== 'Never' ? data.lastLoginDate : null,
      profilePhoto: data.profilePhoto || null,
      createdDate: data.createdDate || new Date().toISOString().split('T')[0],
    }

    const { data: result, error: createError } = await api.post<{ id: string }>('/api/users', payload)

    if (createError) {
      console.error('❌ Failed to create user:', createError)
      return { error: createError }
    }

    console.log('✅ User created:', result)
    await fetchUsers() // Refresh list
    return { id: result?.id }
  }, [fetchUsers])

  const updateUser = useCallback(async (id: string, data: Partial<DatabaseUser>) => {
    const payload = {
      ...(data.userId && { userId: data.userId }),
      ...(data.firstName && { firstName: data.firstName }),
      ...(data.lastName && { lastName: data.lastName }),
      ...(data.email && { email: data.email }),
      ...(data.username && { username: data.username }),
      ...(data.phoneNumber !== undefined && { phoneNumber: data.phoneNumber || null }),
      ...(data.role && { role: data.role }),
      ...(data.department && { department: data.department }),
      ...(data.accountStatus && { accountStatus: data.accountStatus }),
      ...(data.lastLoginDate !== undefined && { 
        lastLoginDate: data.lastLoginDate && data.lastLoginDate !== 'Never' ? data.lastLoginDate : null 
      }),
      ...(data.profilePhoto !== undefined && { profilePhoto: data.profilePhoto || null }),
    }

    const { error: updateError } = await api.put(`/api/users/${id}`, payload)

    if (updateError) {
      console.error('❌ Failed to update user:', updateError)
      return { error: updateError }
    }

    console.log('✅ User updated:', id)
    await fetchUsers() // Refresh list
    return {}
  }, [fetchUsers])

  const deleteUser = useCallback(async (id: string) => {
    const { error: deleteError } = await api.delete(`/api/users/${id}`)

    if (deleteError) {
      console.error('❌ Failed to delete user:', deleteError)
      return { error: deleteError }
    }

    console.log('✅ User deleted:', id)
    await fetchUsers() // Refresh list
    return {}
  }, [fetchUsers])

  return {
    users,
    loading,
    error,
    refetch: fetchUsers,
    createUser,
    updateUser,
    deleteUser,
  }
}
