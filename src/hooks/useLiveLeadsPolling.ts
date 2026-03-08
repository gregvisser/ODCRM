/**
 * Poll /api/live/leads every 30s. Refetch on visibilitychange and window focus.
 * Returns { data, loading, error, lastUpdatedAt } for leads.
 * Only runs when enabled is true (e.g. when the actual Leads tab is active).
 */
import { useCallback, useEffect, useState } from 'react'
import { getLiveLeads, getLiveLeadMetrics, type LiveLeadsResponse, type LiveLeadMetricsResponse } from '../utils/liveLeadsApi'

const POLL_MS = 30000

export type UseLiveLeadsPollingOptions = {
  /** When false, no fetch and no interval. Default true. */
  enabled?: boolean
}

export function useLiveLeadsPolling(customerId: string | null, options: UseLiveLeadsPollingOptions = {}) {
  const { enabled = true } = options
  const [data, setData] = useState<LiveLeadsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null)

  const fetchData = useCallback(async () => {
    if (!enabled || !customerId || customerId.trim() === '') {
      if (!enabled) setLoading(false)
      else if (!customerId || customerId.trim() === '') setData(null)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await getLiveLeads(customerId)
      setData(res)
      setLastUpdatedAt(new Date(res.queriedAt))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load leads')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [customerId, enabled])

  useEffect(() => {
    if (!enabled) {
      setLoading(false)
      return
    }
    fetchData()
    const interval = setInterval(fetchData, POLL_MS)
    const onVisible = () => {
      if (document.visibilityState === 'visible') fetchData()
    }
    const onFocus = () => fetchData()
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onFocus)
    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onFocus)
    }
  }, [fetchData, enabled])

  return { data, loading, error, lastUpdatedAt, refetch: fetchData }
}

/**
 * Poll /api/live/leads/metrics every 30s. Refetch on visibilitychange and window focus.
 */
export function useLiveLeadMetricsPolling(customerId: string | null) {
  const [data, setData] = useState<LiveLeadMetricsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null)

  const fetchData = useCallback(async () => {
    if (!customerId || customerId.trim() === '') {
      setLoading(false)
      setData(null)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await getLiveLeadMetrics(customerId)
      setData(res)
      setLastUpdatedAt(new Date(res.queriedAt))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load metrics')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [customerId])

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, POLL_MS)
    const onVisible = () => {
      if (document.visibilityState === 'visible') fetchData()
    }
    const onFocus = () => fetchData()
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onFocus)
    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onFocus)
    }
  }, [fetchData])

  return { data, loading, error, lastUpdatedAt, refetch: fetchData }
}
