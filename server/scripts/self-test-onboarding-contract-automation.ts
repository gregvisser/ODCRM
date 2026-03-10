import { applyAutoTicksToAccountData } from '../src/services/progressAutoTick.js'
import {
  applyAgreementAutomation,
  type AgreementExtractionResult,
} from '../src/services/agreementExtraction.js'

function assert(condition: unknown, message: string): void {
  if (!condition) {
    throw new Error(message)
  }
}

const extraction: AgreementExtractionResult = {
  status: 'succeeded',
  extractionSource: 'deterministic-fallback',
  extractedAt: new Date().toISOString(),
  warnings: [],
  fields: {
    agreedMonthlyPrice: 2500,
    pricingText: '£2,500 per month',
    contractSignedDate: '2026-03-10',
    contractStartDate: '2026-04-01',
    serviceStartDate: null,
    billingStartDate: null,
    contractEndDate: '2027-03-31',
    renewalDate: null,
    contractTermMonths: 12,
    agreementSummary: 'Monthly retained service agreement.',
  },
  evidence: {
    agreedMonthlyPrice: '£2,500 per month',
    contractStartDate: 'Contract start date: 2026-04-01',
  },
}

const automation = applyAgreementAutomation({
  accountData: {},
  extraction,
  actorUserId: 'tester@example.com',
  nowIso: '2026-03-10T12:00:00.000Z',
})

assert(automation.topLevelUpdates.monthlyRevenueFromCustomer === 2500, 'expected monthly revenue update')
assert(automation.topLevelUpdates.monthlyIntakeGBP === 2500, 'expected monthly intake mirror update')
assert(
  automation.accountData?.accountDetails?.startDateAgreed === '2026-04-01',
  'expected extracted start date to populate accountDetails.startDateAgreed',
)
assert(
  automation.accountData?.onboardingProgress?.steps?.documents?.complete === true,
  'expected onboarding documents step to auto-complete',
)

const autoTicked = applyAutoTicksToAccountData({
  accountData: automation.accountData,
  hasAgreement: true,
  hasLeadGoogleSheet: false,
  actorUserId: 'tester@example.com',
  nowIso: '2026-03-10T12:00:00.000Z',
})

assert(autoTicked.accountData?.progressTracker?.sales?.sales_client_agreement === true, 'expected sales_client_agreement auto-tick')
assert(autoTicked.accountData?.progressTracker?.sales?.sales_contract_signed === true, 'expected sales_contract_signed auto-tick')
assert(autoTicked.accountData?.progressTracker?.sales?.sales_start_date === true, 'expected sales_start_date auto-tick')

const partialExtraction: AgreementExtractionResult = {
  status: 'partial',
  extractionSource: 'deterministic-fallback',
  extractedAt: new Date().toISOString(),
  warnings: ['Used deterministic fallback.'],
  fields: {
    agreedMonthlyPrice: null,
    pricingText: null,
    contractSignedDate: null,
    contractStartDate: null,
    serviceStartDate: '2026-05-01',
    billingStartDate: null,
    contractEndDate: null,
    renewalDate: null,
    contractTermMonths: null,
    agreementSummary: null,
  },
  evidence: {
    serviceStartDate: 'Services commencing 2026-05-01',
  },
}

const partialAutomation = applyAgreementAutomation({
  accountData: {},
  extraction: partialExtraction,
  actorUserId: 'tester@example.com',
  nowIso: '2026-03-10T12:00:00.000Z',
})

assert(
  partialAutomation.accountData?.accountDetails?.startDateAgreed === '2026-05-01',
  'expected partial extraction start date to populate accountDetails.startDateAgreed',
)
assert(
  partialAutomation.accountData?.onboardingProgress?.steps?.documents?.complete === true,
  'expected onboarding documents step to auto-complete on partial defensible extraction',
)

const failedExtraction: AgreementExtractionResult = {
  status: 'failed',
  extractionSource: 'deterministic-fallback',
  extractedAt: new Date().toISOString(),
  warnings: ['No defensible fields could be extracted.'],
  fields: {
    agreedMonthlyPrice: null,
    pricingText: null,
    contractSignedDate: null,
    contractStartDate: null,
    serviceStartDate: null,
    billingStartDate: null,
    contractEndDate: null,
    renewalDate: null,
    contractTermMonths: null,
    agreementSummary: null,
  },
  evidence: {},
}

const failedAutomation = applyAgreementAutomation({
  accountData: {},
  extraction: failedExtraction,
  actorUserId: 'tester@example.com',
  nowIso: '2026-03-10T12:00:00.000Z',
})

assert(
  failedAutomation.accountData?.onboardingProgress?.steps?.documents?.complete !== true,
  'expected onboarding documents step to remain incomplete when extraction fails',
)
assert(
  failedAutomation.accountData?.accountDetails?.startDateAgreed == null || failedAutomation.accountData?.accountDetails?.startDateAgreed === '',
  'expected failed extraction not to invent a start date',
)

console.log('SELF_TEST_OK onboarding contract automation')
