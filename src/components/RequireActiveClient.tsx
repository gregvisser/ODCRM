import React from 'react'
import { useEffectiveCustomerId } from '../hooks/useCustomerScope'
import NoActiveClientEmptyState from './NoActiveClientEmptyState'

/**
 * Wraps tenant-scoped UI. When no active client is selected, shows NoActiveClientEmptyState.
 * Otherwise renders children. No behavior change from previous per-screen guards.
 */
export default function RequireActiveClient({ children }: { children: React.ReactNode }) {
  const customerId = useEffectiveCustomerId()
  if (!customerId) {
    return <NoActiveClientEmptyState />
  }
  return <>{children}</>
}
