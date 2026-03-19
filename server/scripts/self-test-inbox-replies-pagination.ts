/**
 * Self-test: GET /api/inbox/replies pagination contract.
 * Asserts: schema has offset, route uses skip, response has hasMore and offset, customer scoping preserved.
 */
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

async function main() {
  const inboxPath = path.resolve(__dirname, '../src/routes/inbox.ts')
  const source = await readFile(inboxPath, 'utf8')

  assert.ok(source.includes('offset: z.coerce.number'), 'listRepliesSchema must support optional offset')
  assert.ok(
    source.includes('offset } = listRepliesSchema.parse(req.query)') || source.includes('offset } = listRepliesSchema.parse'),
    '/replies must parse offset from query'
  )
  assert.ok(source.includes('skip,') || source.includes('skip:'), 'replies route must use skip for pagination')
  assert.ok(source.includes('hasMore: rows.length === pageSize'), 'replies must return hasMore')
  assert.ok(source.includes('offset: skip + rows.length'), 'replies must return next offset')
  assert.ok(source.includes('campaign: { customerId }'), 'replies must scope by campaign.customerId')

  console.log('PASS self-test-inbox-replies-pagination')
}

main().catch((err) => {
  console.error('FAIL self-test-inbox-replies-pagination')
  console.error(err)
  process.exit(1)
})
