/**
 * Self-test for isRead production fix:
 * - Migration exists and adds is_read to email_message_metadata
 * - Schema has isRead on EmailMessageMetadata
 * - GET /threads has fallback when isRead column is missing
 */
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

async function main() {
  const serverDir = path.resolve(__dirname, '..')

  const migrationPath = path.join(
    serverDir,
    'prisma/migrations/20260222120000_add_inbox_read_signature/migration.sql'
  )
  const migrationSql = await readFile(migrationPath, 'utf8')
  assert.ok(
    migrationSql.includes('is_read') && migrationSql.includes('email_message_metadata'),
    'Migration must add is_read to email_message_metadata'
  )

  const schemaPath = path.join(serverDir, 'prisma/schema.prisma')
  const schema = await readFile(schemaPath, 'utf8')
  assert.ok(
    schema.includes('isRead') && schema.includes('EmailMessageMetadata'),
    'Schema must define isRead on EmailMessageMetadata'
  )

  const inboxPath = path.join(serverDir, 'src/routes/inbox.ts')
  const inboxSource = await readFile(inboxPath, 'utf8')
  assert.ok(
    inboxSource.includes('isMissingColumnError(err, \'email_message_metadata.isRead\')'),
    'GET /threads must catch missing isRead column'
  )
  assert.ok(
    inboxSource.includes('threadSelectWithoutIsRead') && inboxSource.includes('isRead: false'),
    'GET /threads must have fallback select and default isRead: false'
  )

  console.log('PASS self-test-inbox-isread-prod-fix')
}

main().catch((err) => {
  console.error('FAIL self-test-inbox-isread-prod-fix')
  console.error(err)
  process.exit(1)
})
