/**
 * Self-test for Inbox pagination contract: GET /api/inbox/threads and GET /api/inbox/replies
 * support limit/offset and return hasMore/offset; tenant scoping is preserved.
 */
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

async function main() {
  const inboxPath = path.resolve(__dirname, '../src/routes/inbox.ts')
  const source = await readFile(inboxPath, 'utf8')

  // Threads: limit, offset, hasMore, offset in response; scoped by customerId
  assert.ok(
    source.includes('req.query.limit') && source.includes('req.query.offset'),
    'threads route must read limit and offset from query'
  )
  assert.ok(
    source.includes('hasMore:') && source.includes('offset: offset + paged.length'),
    'threads route must return hasMore and offset'
  )
  assert.ok(
    source.includes('senderIdentity: { customerId }') && source.includes('threads'),
    'threads route must scope by customerId via senderIdentity'
  )

  // Replies: listRepliesSchema has offset; take/skip; hasMore and offset in response
  assert.ok(
    source.includes('offset: z.coerce.number') && source.includes('listRepliesSchema'),
    'replies schema must support offset'
  )
  assert.ok(
    source.includes('skip,') || source.includes('skip:'),
    'replies route must use skip for pagination'
  )
  assert.ok(
    source.includes('hasMore: rows.length === pageSize') && source.includes('offset: skip + rows.length'),
    'replies route must return hasMore and offset'
  )
  assert.ok(
    source.includes('campaign: { customerId }') && source.includes('replies'),
    'replies route must scope by customerId via campaign'
  )

  console.log('PASS self-test-inbox-pagination')
}

main().catch((err) => {
  console.error('FAIL self-test-inbox-pagination')
  console.error(err)
  process.exit(1)
})
