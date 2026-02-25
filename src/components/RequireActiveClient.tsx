import React from 'react'
import { getCurrentCustomerId } from '../platform/stores/settings'
import NoActiveClientEmptyState from './NoActiveClientEmptyState'

/**
 * Wraps tenant-scoped UI. When no active client is selected, shows NoActiveClientEmptyState.
 * Otherwise renders children. No behavior change from previous per-screen guards.
 */
export default function RequireActiveClient({ children }: { children: React.ReactNode }) {
  if (!getCurrentCustomerId()) {
    return <NoActiveClientEmptyState />
  }
  return <>{children}</>
}
