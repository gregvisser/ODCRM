import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { deriveInboxOptOutTarget } from '../src/utils/inboxOptOut'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

async function verifyRouteScopingAndUsage() {
  const routePath = path.resolve(__dirname, '../src/routes/inbox.ts')
  const source = await readFile(routePath, 'utf8')

  assert.match(
    source,
    /where:\s*\{\s*id,\s*senderIdentity:\s*\{\s*customerId\s*\}\s*\}/,
    'opt-out route must scope the inbox message lookup by senderIdentity.customerId'
  )
  assert.match(
    source,
    /deriveInboxOptOutTarget\(message\.fromAddress\)/,
    'opt-out route must derive suppression targets from the inbox message context'
  )
  assert.match(
    source,
    /customerId_type_value/,
    'opt-out route must keep suppression upserts tenant-scoped'
  )
}

async function main() {
  await verifyRouteScopingAndUsage()

  const normalized = deriveInboxOptOutTarget(' Prospect@Example.COM ')
  assert.deepEqual(
    normalized,
    { email: 'prospect@example.com', domain: 'example.com' },
    'should normalize inbox sender email and derive its domain'
  )

  const invalidDomain = deriveInboxOptOutTarget('missing-domain')
  assert.deepEqual(
    invalidDomain,
    { email: 'missing-domain', domain: null },
    'should avoid manufacturing an invalid domain target'
  )

  console.log('PASS self-test-inbox-optout-route')
}

main().catch((error) => {
  console.error('FAIL self-test-inbox-optout-route')
  console.error(error)
  process.exit(1)
})
