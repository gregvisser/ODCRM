/**
 * Deterministic checks for template placeholder contract (preview + send parity).
 * Run: npx tsx scripts/self-test-template-placeholder-contract.ts
 */
import assert from 'node:assert'
import { applyTemplatePlaceholders, applyTemplatePlaceholdersHtml } from '../server/src/services/templateRenderer.ts'
import {
  buildTemplateVariablesForSend,
  deriveRecipientFromEmailFallback,
  resolvePreviewTemplateVariables,
} from '../server/src/services/templatePlaceholderContext.ts'

function main() {
  const d = deriveRecipientFromEmailFallback('greg@bidlow.co.uk')
  assert.strictEqual(d.first_name, 'Greg', 'fallback first_name')
  assert.strictEqual(d.company_name, 'Bidlow', 'fallback company_name')
  assert.ok(d.website.includes('bidlow'), 'fallback website')

  const v1 = buildTemplateVariablesForSend({
    recipientEmail: 'greg@bidlow.co.uk',
    target: {
      firstName: null,
      lastName: null,
      companyName: null,
      jobTitle: null,
      website: null,
    },
    senderCustomer: { name: 'OpenDoors' },
    senderIdentity: {
      displayName: 'OD Bot',
      emailAddress: 'bot@opendoors.example',
      signatureHtml: '<p>Sig</p>',
    },
    unsubscribeLink: 'https://api.example/unsub',
  })
  assert.strictEqual(v1.first_name, 'Greg')
  assert.strictEqual(v1.company_name, 'Bidlow')
  assert.strictEqual(v1.sender_company_name, 'OpenDoors')
  assert.ok(!String(v1.company_name).includes('OpenDoors'), 'company_name must not be sender tenant')

  const v2 = buildTemplateVariablesForSend({
    recipientEmail: 'greg@bidlow.co.uk',
    target: {
      firstName: 'Gregory',
      companyName: 'Bidlow Ltd',
    },
    senderCustomer: { name: 'OpenDoors' },
    senderIdentity: { displayName: 'OD', emailAddress: 'a@b.com', signatureHtml: null },
    unsubscribeLink: 'u',
  })
  assert.strictEqual(v2.first_name, 'Gregory')
  assert.strictEqual(v2.company_name, 'Bidlow Ltd')
  assert.strictEqual(v2.sender_name, 'OD')
  assert.strictEqual(v2.sender_company_name, 'OpenDoors')

  const pv = resolvePreviewTemplateVariables({
    requestedVariables: { email: 'greg@bidlow.co.uk' },
    senderCustomer: { name: 'OpenDoors' },
    senderName: 'Sender',
    senderEmail: 's@opendoors.example',
    signatureHtml: null,
  })
  const subj = applyTemplatePlaceholders(
    'Hi {{first_name}} at {{company_name}} from {{sender_company_name}}',
    pv
  )
  assert.ok(subj.includes('Greg'), subj)
  assert.ok(subj.includes('Bidlow'), subj)
  assert.ok(subj.includes('OpenDoors'), subj)

  const pv2 = resolvePreviewTemplateVariables({
    requestedVariables: { email: 'greg@bidlow.co.uk' },
    senderCustomer: { name: 'OpenDoors' },
    senderName: 'Sender',
    senderEmail: 's@opendoors.example',
    signatureHtml: null,
  })
  const html = applyTemplatePlaceholdersHtml('<a href="{{unsubscribe_link}}">x</a>', {
    ...pv2,
    unsubscribe_link: 'https://track/u',
    unsubscribeLink: 'https://track/u',
  })
  assert.ok(html.includes('https://track/u'), html)

  const same = buildTemplateVariablesForSend({
    recipientEmail: 'greg@bidlow.co.uk',
    target: {},
    senderCustomer: { name: 'OpenDoors' },
    senderIdentity: { displayName: 'Sender', emailAddress: 's@opendoors.example', signatureHtml: null },
    unsubscribeLink: 'https://track/u',
  })
  const pvParity = resolvePreviewTemplateVariables({
    requestedVariables: { email: 'greg@bidlow.co.uk' },
    senderCustomer: { name: 'OpenDoors' },
    senderName: 'Sender',
    senderEmail: 's@opendoors.example',
    signatureHtml: null,
  })
  const subj2 = applyTemplatePlaceholders('{{first_name}}|{{company_name}}|{{sender_company_name}}', same)
  const subj3 = applyTemplatePlaceholders('{{first_name}}|{{company_name}}|{{sender_company_name}}', pvParity)
  assert.strictEqual(subj2, subj3, 'preview vs send parity for same logical inputs')

  console.log('self-test-template-placeholder-contract: OK')
}

main()
