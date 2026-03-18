/**
 * Self-test for Inbox reply sender resolution: single identity vs ambiguous (multiple identities in thread).
 * Proves resolveReplySender() and that POST /api/inbox/threads/:threadId/reply blocks when ambiguous.
 */
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { resolveReplySender, type MessageWithSender } from '../src/utils/inboxReplySender.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function buildMsg(
  createdAt: Date,
  senderIdentityId: string,
  emailAddress: string,
  displayName: string | null
): MessageWithSender {
  return {
    createdAt,
    senderIdentityId,
    senderIdentity: { id: senderIdentityId, emailAddress, displayName },
  }
}

async function verifyRouteBlocksAmbiguous() {
  const routePath = path.resolve(__dirname, '../src/routes/inbox.ts')
  const source = await readFile(routePath, 'utf8')
  assert.match(
    source,
    /resolvedSender\?\.ambiguous/,
    'POST reply must check resolvedSender.ambiguous'
  )
  assert.ok(
    source.includes('status(409)') && source.includes('REPLY_SENDER_AMBIGUOUS'),
    'POST reply must return 409 with REPLY_SENDER_AMBIGUOUS when ambiguous'
  )
  assert.match(
    source,
    /resolveReplySender\(messagesForResolution\)/,
    'POST reply must use resolveReplySender for thread messages'
  )
}

async function main() {
  await verifyRouteBlocksAmbiguous()

  const t0 = new Date('2026-03-18T10:00:00.000Z')
  const t1 = new Date('2026-03-18T10:01:00.000Z')
  const t2 = new Date('2026-03-18T10:02:00.000Z')

  // Single identity in thread -> not ambiguous
  const singleIdentity = [
    buildMsg(t0, 'id-a', 'a@example.com', 'Alice'),
    buildMsg(t1, 'id-a', 'a@example.com', 'Alice'),
    buildMsg(t2, 'id-a', 'a@example.com', 'Alice'),
  ]
  const resolvedSingle = resolveReplySender(singleIdentity)
  assert.ok(resolvedSingle, 'single-identity thread should resolve a sender')
  assert.equal(resolvedSingle!.senderIdentityId, 'id-a', 'should pick latest message identity')
  assert.equal(resolvedSingle!.emailAddress, 'a@example.com', 'email should match')
  assert.equal(resolvedSingle!.ambiguous, false, 'single identity must not be ambiguous')

  // Two identities in thread -> ambiguous
  const twoIdentities = [
    buildMsg(t0, 'id-a', 'a@example.com', 'Alice'),
    buildMsg(t1, 'id-b', 'b@example.com', 'Bob'),
    buildMsg(t2, 'id-a', 'a@example.com', 'Alice'),
  ]
  const resolvedTwo = resolveReplySender(twoIdentities)
  assert.ok(resolvedTwo, 'two-identity thread should still resolve a would-be sender (latest)')
  assert.equal(resolvedTwo!.senderIdentityId, 'id-a', 'latest message is from id-a')
  assert.equal(resolvedTwo!.ambiguous, true, 'two distinct identities must be ambiguous')

  // Empty thread -> null
  const empty = resolveReplySender([])
  assert.equal(empty, null, 'empty thread should return null')

  console.log('PASS self-test-inbox-reply-sender')
}

main().catch((err) => {
  console.error('FAIL self-test-inbox-reply-sender')
  console.error(err)
  process.exit(1)
})
