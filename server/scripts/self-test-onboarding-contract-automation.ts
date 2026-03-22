import { applyAutoTicksToAccountData } from '../src/services/progressAutoTick.js'
import { extractAgreementFields, isReadableExtractedDocumentText } from '../src/services/agreementExtraction.js'

function assert(condition: unknown, message: string): void {
  if (!condition) {
    throw new Error(message)
  }
}

const manualStartDateAutoTick = applyAutoTicksToAccountData({
  accountData: {
    accountDetails: {
      startDateAgreed: '2026-04-01',
    },
  },
  hasAgreement: false,
  hasLeadGoogleSheet: false,
  actorUserId: 'tester@example.com',
  nowIso: '2026-03-10T12:00:00.000Z',
})

assert(
  manualStartDateAutoTick.accountData?.progressTracker?.sales?.sales_start_date === true,
  'expected manual startDateAgreed to keep auto-ticking sales_start_date',
)
assert(
  manualStartDateAutoTick.accountData?.progressTracker?.sales?.sales_client_agreement !== true,
  'expected agreement items to stay off without hasAgreement',
)
assert(
  manualStartDateAutoTick.accountData?.progressTracker?.sales?.sales_contract_signed !== true,
  'expected contract-signed to stay off without hasAgreement',
)

const agreementAutoTick = applyAutoTicksToAccountData({
  accountData: {},
  hasAgreement: true,
  hasLeadGoogleSheet: false,
  actorUserId: 'tester@example.com',
  nowIso: '2026-03-10T12:00:00.000Z',
})

assert(
  agreementAutoTick.accountData?.progressTracker?.sales?.sales_client_agreement === true,
  'expected hasAgreement to auto-tick sales_client_agreement',
)
assert(
  agreementAutoTick.accountData?.progressTracker?.sales?.sales_contract_signed === true,
  'expected hasAgreement to auto-tick sales_contract_signed',
)

const paymentEvidenceAutoTick = applyAutoTicksToAccountData({
  accountData: {
    attachments: [{ id: 'att_payment', type: 'payment_confirmation', fileName: 'payment.pdf' }],
  },
  hasAgreement: false,
  hasLeadGoogleSheet: false,
  actorUserId: 'tester@example.com',
  nowIso: '2026-03-10T12:00:00.000Z',
})

assert(
  paymentEvidenceAutoTick.accountData?.progressTracker?.sales?.sales_first_payment === true,
  'expected payment_confirmation attachment to auto-tick sales_first_payment',
)

const clientLiveOutreach = applyAutoTicksToAccountData({
  accountData: {},
  hasAgreement: false,
  hasLeadGoogleSheet: false,
  linkedEmailCount: null,
  weeklyLeadTarget: null,
  templateCount: null,
  firstOutreachSentAtIso: '2026-01-15T10:00:00.000Z',
  actorUserId: 'actor@example.com',
  nowIso: '2026-03-10T12:00:00.000Z',
})

assert(
  clientLiveOutreach.accountData?.progressTracker?.am?.am_client_live === true,
  'expected first outreach signal to auto-tick am_client_live',
)
const liveMeta = (clientLiveOutreach.accountData as any)?.progressTrackerMeta?.am?.am_client_live
assert(!!liveMeta?.completedAt, 'expected am_client_live meta completedAt after auto-tick')
assert(liveMeta?.completionSource === 'AUTO', 'expected am_client_live completionSource AUTO')
assert(liveMeta?.completedByUserId === 'actor@example.com', 'expected am_client_live completedByUserId')
assert(
  liveMeta?.value?.firstOutreachSentAt === '2026-01-15T10:00:00.000Z',
  'expected firstOutreachSentAt on am_client_live meta value',
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
      'Monthly service fee £2,500 per month.',
      'This agreement is between the client and ODCRM for monthly services.',
    ].join(' ')

    const readableCheck = isReadableExtractedDocumentText(readableText)
    assert(readableCheck.ok === true, 'expected readable agreement text to pass readability guard')

    const readableExtraction = await extractAgreementFields({
      buffer: Buffer.from(readableText, 'utf8'),
      mimeType: 'application/pdf',
      customerName: 'Readable Customer',
      fileName: 'readable.pdf',
    })

    assert(readableExtraction.status === 'partial', 'expected deterministic readable extraction to stay available')
    assert(readableExtraction.fields.startDateAgreed === '2025-01-06', 'expected deterministic extraction to keep parsing w/c dates')
    assert(readableExtraction.fields.daysPerWeek === 5, 'expected deterministic extraction to keep parsing days per week')

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

    assert(rawPdfExtraction.status === 'failed', 'expected unreadable PDF syntax extraction to fail')
    assert(rawPdfExtraction.fields.agreementSummary === null, 'expected unreadable extraction not to populate agreement summary')
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

console.log('SELF_TEST_OK onboarding contract upload rollback')
