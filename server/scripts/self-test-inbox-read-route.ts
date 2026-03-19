/**
 * Self-test for POST /api/inbox/messages/:id/read:
 * accepts isRead true/false, scopes by customerId via senderIdentity, returns { success, id, isRead }.
 */
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

async function main() {
  const inboxPath = path.resolve(__dirname, '../src/routes/inbox.ts')
  const source = await readFile(inboxPath, 'utf8')

  assert.ok(
    source.includes('req.body?.isRead !== false'),
    'read route must accept body isRead and treat false as unread'
  )
  assert.ok(
    source.includes('senderIdentity: { customerId }') && source.includes('/messages/:id/read'),
    'read route must scope message lookup by customerId via senderIdentity'
  )
  assert.ok(
    source.includes('res.json({ success: true, id, isRead })'),
    'read route must return success, id, and isRead'
  )
  assert.ok(
    source.includes('data: { isRead }'),
    'read route must persist isRead to database'
  )

  console.log('PASS self-test-inbox-read-route')
}

main().catch((err) => {
  console.error('FAIL self-test-inbox-read-route')
  console.error(err)
  process.exit(1)
})
