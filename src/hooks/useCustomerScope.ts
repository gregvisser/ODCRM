import { useCallback, useEffect, useMemo, useState } from 'react'
import { getFixedCustomerIdOrNull } from '../platform/me'
import { isAgencyUI, isClientUI } from '../platform/mode'
import {
  clearCurrentCustomerId,
  getCurrentCustomerId,
  onSettingsUpdated,
  setCurrentCustomerId,
} from '../platform/stores/settings'

function readEffectiveCustomerId(): string {
  if (isClientUI()) {
    return getFixedCustomerIdOrNull() ?? ''
  }
  return getCurrentCustomerId() ?? ''
}

function normalizeCustomerId(value: string | null | undefined): string {
  return String(value || '').trim()
}

export function useEffectiveCustomerId(): string {
  const [customerId, setCustomerId] = useState<string>(() => readEffectiveCustomerId())

  useEffect(() => {
    setCustomerId(readEffectiveCustomerId())
    if (!isAgencyUI()) return
    return onSettingsUpdated((detail) => {
      const next = normalizeCustomerId((detail as { currentCustomerId?: string | null } | null)?.currentCustomerId)
      setCustomerId(next)
    })
  }, [])

  return customerId
}

export function useScopedCustomerSelection() {
  const [customerId, setCustomerIdState] = useState<string>(() => readEffectiveCustomerId())
  const canSelectCustomer = isAgencyUI()

  useEffect(() => {
    setCustomerIdState(readEffectiveCustomerId())
    if (!canSelectCustomer) return
    return onSettingsUpdated((detail) => {
      const next = normalizeCustomerId((detail as { currentCustomerId?: string | null } | null)?.currentCustomerId)
      setCustomerIdState(next)
    })
  }, [canSelectCustomer])

  const setCustomerId = useCallback((nextCustomerId: string) => {
    const normalized = normalizeCustomerId(nextCustomerId)
    if (!canSelectCustomer) {
      setCustomerIdState(readEffectiveCustomerId())
      return
    }
    setCustomerIdState(normalized)
    if (normalized) {
      setCurrentCustomerId(normalized)
    } else {
      clearCurrentCustomerId()
    }
  }, [canSelectCustomer])

  const customerHeaders = useMemo(
    () => (customerId ? { 'X-Customer-Id': customerId } : undefined),
    [customerId],
  )

  return {
    canSelectCustomer,
    customerHeaders,
    customerId,
    setCustomerId,
  }
}
