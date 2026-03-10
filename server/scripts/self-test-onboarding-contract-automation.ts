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

console.log('SELF_TEST_OK onboarding contract automation')
