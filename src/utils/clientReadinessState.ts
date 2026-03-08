export type ClientReadinessState =
  | 'setup-needed'
  | 'data-incomplete'
  | 'ready-for-outreach'
  | 'outreach-active'
  | 'needs-attention'
  | 'unknown-syncing'

export type ClientReadinessNextTarget =
  | 'onboarding'
  | 'clients'
  | 'marketing-readiness'
  | 'marketing-inbox'
  | 'marketing-reports'
  | 'marketing-sequences'

export type ClientReadinessSignal = {
  hasActiveClient: boolean
  loading: boolean
  hasLoadError: boolean
  onboardingReady: boolean | null
  checks: {
    emailIdentitiesConnected: boolean | null
    suppressionConfigured: boolean | null
    leadSourceConfigured: boolean | null
    templateAndSequenceReady: boolean | null
  }
  queue: {
    readyNow: number
    blocked: number
    failedRecently: number
    sentRecently: number
  }
}

export type ClientReadinessInterpretation = {
  state: ClientReadinessState
  label: string
  reason: string
  nextStep: {
    label: string
    target: ClientReadinessNextTarget
  }
}

export function getClientReadinessInterpretation(signal: ClientReadinessSignal): ClientReadinessInterpretation {
  if (!signal.hasActiveClient) {
    return {
      state: 'setup-needed',
      label: 'Setup needed',
      reason: 'Select an active client before continuing.',
      nextStep: { label: 'Open Onboarding', target: 'onboarding' },
    }
  }

  if (signal.loading) {
    return {
      state: 'unknown-syncing',
      label: 'Unknown / still syncing',
      reason: 'Collecting readiness signals from onboarding and outreach modules.',
      nextStep: { label: 'Refresh readiness', target: 'marketing-readiness' },
    }
  }

  if (signal.hasLoadError) {
    return {
      state: 'needs-attention',
      label: 'Needs attention',
      reason: 'Could not load one or more readiness signals.',
      nextStep: { label: 'Open Marketing Readiness', target: 'marketing-readiness' },
    }
  }

  if (signal.onboardingReady === false) {
    return {
      state: 'setup-needed',
      label: 'Setup needed',
      reason: 'Onboarding checks are not complete for this client.',
      nextStep: { label: 'Continue Onboarding', target: 'onboarding' },
    }
  }

  const hasDataGap =
    signal.checks.emailIdentitiesConnected === false ||
    signal.checks.leadSourceConfigured === false ||
    signal.checks.templateAndSequenceReady === false

  if (hasDataGap) {
    return {
      state: 'data-incomplete',
      label: 'Data incomplete',
      reason: 'Required client outreach data is still incomplete.',
      nextStep: { label: 'Fix client data in OpenDoors Clients', target: 'clients' },
    }
  }

  if (signal.queue.failedRecently > 0 || signal.queue.blocked > 0) {
    return {
      state: 'needs-attention',
      label: 'Needs attention',
      reason: 'Recent failures or blocked queue rows need review before scaling outreach.',
      nextStep: { label: 'Open Marketing Readiness', target: 'marketing-readiness' },
    }
  }

  if (signal.queue.sentRecently > 0 || signal.queue.readyNow > 0) {
    return {
      state: 'outreach-active',
      label: 'Outreach active',
      reason: 'Outreach is active or immediately send-ready for this client.',
      nextStep: { label: 'Review Reports', target: 'marketing-reports' },
    }
  }

  return {
    state: 'ready-for-outreach',
    label: 'Ready for outreach',
    reason: 'Core setup checks are healthy and no urgent queue issues are detected.',
    nextStep: { label: 'Open Marketing Readiness', target: 'marketing-readiness' },
  }
}

export function getClientReadinessColorScheme(state: ClientReadinessState): string {
  switch (state) {
    case 'ready-for-outreach':
      return 'green'
    case 'outreach-active':
      return 'blue'
    case 'setup-needed':
      return 'purple'
    case 'data-incomplete':
      return 'orange'
    case 'needs-attention':
      return 'red'
    case 'unknown-syncing':
    default:
      return 'gray'
  }
}
