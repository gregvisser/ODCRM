import { applyAutoTicksToAccountData } from '../src/services/progressAutoTick.js'
import {
  applyAgreementAutomation,
  extractAgreementFields,
  isReadableExtractedDocumentText,
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
    startDateAgreed: '2026-04-01',
    daysPerWeek: 5,
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
    startDateAgreed: 'has been agreed from w/c 1st April 2026',
    daysPerWeek: "A total of 5 day's a week",
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
  automation.accountData?.accountDetails?.daysPerWeek === 5,
  'expected extracted days per week to populate accountDetails.daysPerWeek',
)
assert(
  automation.accountData?.onboardingProgress?.steps?.documents?.complete === true,
  'expected onboarding documents step to auto-complete',
)

const autoTicked = applyAutoTicksToAccountData({
  accountData: automation.accountData,
  hasAgreement: true,
  hasLeadGoogleSheet: false,
  linkedEmailCount: 1,
  actorUserId: 'tester@example.com',
  nowIso: '2026-03-10T12:00:00.000Z',
})

assert(autoTicked.accountData?.progressTracker?.sales?.sales_client_agreement === true, 'expected sales_client_agreement auto-tick')
assert(autoTicked.accountData?.progressTracker?.sales?.sales_contract_signed === true, 'expected sales_contract_signed auto-tick')
assert(autoTicked.accountData?.progressTracker?.sales?.sales_start_date === true, 'expected sales_start_date auto-tick')
assert(autoTicked.accountData?.progressTracker?.ops?.ops_emails_linked === true, 'expected ops_emails_linked auto-tick at one linked email')

const partialExtraction: AgreementExtractionResult = {
  status: 'partial',
  extractionSource: 'deterministic-fallback',
  extractedAt: new Date().toISOString(),
  warnings: ['Used deterministic fallback.'],
  fields: {
    agreedMonthlyPrice: null,
    pricingText: null,
    startDateAgreed: null,
    daysPerWeek: null,
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
    startDateAgreed: null,
    daysPerWeek: null,
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

const paymentEvidenceAutoTick = applyAutoTicksToAccountData({
  accountData: {
    attachments: [{ id: 'att_payment', type: 'payment_confirmation', fileName: 'payment.pdf' }],
    firstPaymentEvidence: {
      attachmentId: 'att_payment',
      fileName: 'payment.pdf',
      fileUrl: '/api/customers/cust_test/attachments/att_payment/download',
    },
  },
  hasAgreement: false,
  hasLeadGoogleSheet: false,
  linkedEmailCount: 0,
  actorUserId: 'tester@example.com',
  nowIso: '2026-03-10T12:00:00.000Z',
})

assert(
  paymentEvidenceAutoTick.accountData?.progressTracker?.sales?.sales_first_payment === true,
  'expected payment confirmation evidence to auto-tick sales_first_payment',
)

const replacementAutomation = applyAgreementAutomation({
  accountData: {
    accountDetails: { startDateAgreed: '2025-01-01', daysPerWeek: 2 },
    agreementExtraction: {
      status: 'partial',
      extractionSource: 'deterministic-fallback',
      extractedAt: '2026-01-01T00:00:00.000Z',
      warnings: ['old warning'],
      fields: {
        agreedMonthlyPrice: null,
        pricingText: null,
        startDateAgreed: '2025-01-01',
        daysPerWeek: 2,
        contractSignedDate: null,
        contractStartDate: null,
        serviceStartDate: null,
        billingStartDate: null,
        contractEndDate: null,
        renewalDate: null,
        contractTermMonths: null,
        agreementSummary: 'old stale summary',
      },
      evidence: { agreementSummary: 'old stale summary' },
    },
  },
  extraction,
  actorUserId: 'tester@example.com',
  nowIso: '2026-03-10T12:00:00.000Z',
})

assert(
  replacementAutomation.accountData?.agreementExtraction?.fields?.agreementSummary === 'Monthly retained service agreement.',
  'expected new agreement upload to replace stale agreementExtraction summary',
)
assert(
  replacementAutomation.accountData?.agreementExtraction?.fields?.daysPerWeek === 5,
  'expected new agreement upload to replace stale agreementExtraction daysPerWeek',
)

async function runExtractionGuardTests() {
  const originalGeminiApiKey = process.env.GEMINI_API_KEY
  const originalGoogleGeminiApiKey = process.env.GOOGLE_GEMINI_API_KEY
  const originalEmergentKey = process.env.EMERGENT_LLM_KEY

  delete process.env.GEMINI_API_KEY
  delete process.env.GOOGLE_GEMINI_API_KEY
  delete process.env.EMERGENT_LLM_KEY

  try {
    const readableText = [
      'Master Services Agreement',
      'The service has been agreed from w/c 6th January 2025.',
      "A total of 5 day's a week will be delivered.",
      'Contract start date: 2026-04-01',
      'Service start date: 2026-04-15',
      'Monthly service fee £2,500 per month.',
      'This agreement is between the client and ODCRM for monthly services.',
      'Contract term 12 months.',
    ].join(' ')
    const readableCheck = isReadableExtractedDocumentText(readableText)
    assert(readableCheck.ok === true, 'expected readable agreement text to pass readability guard')

    const readableExtraction = await extractAgreementFields({
      buffer: Buffer.from(readableText, 'utf8'),
      mimeType: 'application/pdf',
      customerName: 'Readable Customer',
      fileName: 'readable.pdf',
    })
    assert(readableExtraction.status === 'partial', 'expected deterministic readable extraction to stay partial')
    assert(readableExtraction.fields.agreementSummary !== null, 'expected readable fallback extraction to keep agreement summary')
    assert(readableExtraction.fields.agreedMonthlyPrice === 2500, 'expected readable fallback extraction to keep monthly price')
    assert(readableExtraction.fields.startDateAgreed === '2025-01-06', 'expected readable fallback extraction to parse w/c start date')
    assert(readableExtraction.fields.daysPerWeek === 5, 'expected readable fallback extraction to parse days per week')

    const rawPdfText = [
      '%PDF-1.7',
      '1 0 obj',
      '<< /Type /Catalog /Pages 2 0 R >>',
      'stream',
      'BT /F1 12 Tf 72 712 Td (Unreadable) Tj ET',
      'endstream',
      'endobj',
      'xref',
      'trailer',
      'startxref',
    ].join(' ')
    const rawPdfCheck = isReadableExtractedDocumentText(rawPdfText)
    assert(rawPdfCheck.ok === false, 'expected raw PDF syntax to fail readability guard')

    const rawPdfExtraction = await extractAgreementFields({
      buffer: Buffer.from(rawPdfText, 'utf8'),
      mimeType: 'application/pdf',
      customerName: 'Unreadable PDF Customer',
      fileName: 'raw.pdf',
    })
    assert(rawPdfExtraction.status === 'failed', 'expected raw PDF syntax extraction to fail')
    assert(rawPdfExtraction.fields.agreementSummary === null, 'expected raw PDF syntax not to populate agreement summary')
    assert(
      rawPdfExtraction.warnings.some((warning) => /unreadable|readable form/i.test(warning)),
      'expected raw PDF syntax extraction to return an unreadable warning',
    )

    const emptyExtraction = await extractAgreementFields({
      buffer: Buffer.from('', 'utf8'),
      mimeType: 'application/pdf',
      customerName: 'Empty Customer',
      fileName: 'empty.pdf',
    })
    assert(emptyExtraction.status === 'failed', 'expected empty extraction to fail')
    assert(emptyExtraction.fields.agreementSummary === null, 'expected empty extraction not to populate agreement summary')
    assert(
      emptyExtraction.warnings.some((warning) => /readable form|unreadable/i.test(warning)),
      'expected empty extraction to return a readable-form warning',
    )
  } finally {
    if (originalGeminiApiKey === undefined) delete process.env.GEMINI_API_KEY
    else process.env.GEMINI_API_KEY = originalGeminiApiKey
    if (originalGoogleGeminiApiKey === undefined) delete process.env.GOOGLE_GEMINI_API_KEY
    else process.env.GOOGLE_GEMINI_API_KEY = originalGoogleGeminiApiKey
    if (originalEmergentKey === undefined) delete process.env.EMERGENT_LLM_KEY
    else process.env.EMERGENT_LLM_KEY = originalEmergentKey
  }
}

await runExtractionGuardTests()

console.log('SELF_TEST_OK onboarding contract automation')
