import { useCallback, useEffect, useState } from 'react'
import { api } from '../utils/api'
import {
  getClientReadinessInterpretation,
  type ClientReadinessInterpretation,
  type ClientReadinessSignal,
} from '../utils/clientReadinessState'

type OnboardingReadinessResponse = {
  ready?: boolean
  checks?: {
    emailIdentitiesConnected?: boolean
    suppressionConfigured?: boolean
    leadSourceConfigured?: boolean
    templateAndSequenceReady?: boolean
  }
}

type SendWorkerConsoleResponse = {
  queue?: {
    readyNow?: number
    blocked?: number
    failedRecently?: number
    sentRecently?: number
  }
  lastUpdatedAt?: string
}

const DEFAULT_SIGNAL: ClientReadinessSignal = {
  hasActiveClient: false,
  loading: false,
  hasLoadError: false,
  onboardingReady: null,
  checks: {
    emailIdentitiesConnected: null,
    suppressionConfigured: null,
    leadSourceConfigured: null,
    templateAndSequenceReady: null,
  },
  queue: {
    readyNow: 0,
    blocked: 0,
    failedRecently: 0,
    sentRecently: 0,
  },
}

export function useClientReadinessState(customerId?: string | null): {
  signal: ClientReadinessSignal
  interpretation: ClientReadinessInterpretation
  lastUpdatedAt: string
  refresh: () => Promise<void>
} {
  const hasActiveClient = !!customerId?.startsWith('cust_')
  const [signal, setSignal] = useState<ClientReadinessSignal>({
    ...DEFAULT_SIGNAL,
    hasActiveClient,
  })
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string>('')

  useEffect(() => {
    setSignal((prev) => ({ ...prev, hasActiveClient }))
  }, [hasActiveClient])

  const refresh = useCallback(async () => {
    if (!hasActiveClient) {
      setSignal({
        ...DEFAULT_SIGNAL,
        hasActiveClient: false,
      })
      setLastUpdatedAt('')
      return
    }

    setSignal((prev) => ({ ...prev, loading: true, hasLoadError: false }))

    const onboardingRes = await api.get<OnboardingReadinessResponse | { data?: OnboardingReadinessResponse }>('/api/onboarding/readiness')
    const consoleRes = await api.get<SendWorkerConsoleResponse | { data?: SendWorkerConsoleResponse }>('/api/send-worker/console?windowHours=24')

    const hasLoadError = !!onboardingRes.error || !!consoleRes.error

    const onboardingData = (onboardingRes.data && 'data' in onboardingRes.data ? onboardingRes.data.data : onboardingRes.data) ?? {}
    const consoleData = (consoleRes.data && 'data' in consoleRes.data ? consoleRes.data.data : consoleRes.data) ?? {}

    const nextSignal: ClientReadinessSignal = {
      hasActiveClient: true,
      loading: false,
      hasLoadError,
      onboardingReady: typeof onboardingData.ready === 'boolean' ? onboardingData.ready : null,
      checks: {
        emailIdentitiesConnected: typeof onboardingData.checks?.emailIdentitiesConnected === 'boolean' ? onboardingData.checks.emailIdentitiesConnected : null,
        suppressionConfigured: typeof onboardingData.checks?.suppressionConfigured === 'boolean' ? onboardingData.checks.suppressionConfigured : null,
        leadSourceConfigured: typeof onboardingData.checks?.leadSourceConfigured === 'boolean' ? onboardingData.checks.leadSourceConfigured : null,
        templateAndSequenceReady: typeof onboardingData.checks?.templateAndSequenceReady === 'boolean' ? onboardingData.checks.templateAndSequenceReady : null,
      },
      queue: {
        readyNow: Number(consoleData.queue?.readyNow ?? 0),
        blocked: Number(consoleData.queue?.blocked ?? 0),
        failedRecently: Number(consoleData.queue?.failedRecently ?? 0),
        sentRecently: Number(consoleData.queue?.sentRecently ?? 0),
      },
    }

    setSignal(nextSignal)
    setLastUpdatedAt(consoleData.lastUpdatedAt || new Date().toISOString())
  }, [hasActiveClient])

  useEffect(() => {
    void refresh()
  }, [refresh, customerId])

  return {
    signal,
    interpretation: getClientReadinessInterpretation(signal),
    lastUpdatedAt,
    refresh,
  }
}
