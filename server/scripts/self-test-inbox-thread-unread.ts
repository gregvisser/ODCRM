import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  buildInboxThreadSummaries,
  type InboxThreadMessageRecord,
} from '../src/utils/inboxThreadSummaries'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

async function verifyRouteScopingAndSelection() {
  const routePath = path.resolve(__dirname, '../src/routes/inbox.ts')
  const source = await readFile(routePath, 'utf8')

  assert.match(
    source,
    /senderIdentity:\s*\{\s*customerId\s*\}/,
    'threads route must stay tenant-scoped by senderIdentity.customerId'
  )
  assert.match(
    source,
    /isRead:\s*true/,
    'threads route must explicitly select isRead for unread aggregation'
  )
}

function buildMessage(
  overrides: Partial<InboxThreadMessageRecord> & Pick<InboxThreadMessageRecord, 'threadId' | 'direction' | 'createdAt' | 'isRead'>
): InboxThreadMessageRecord {
  return {
    threadId: overrides.threadId,
    subject: overrides.subject ?? 'Subject',
    fromAddress: overrides.fromAddress ?? 'prospect@example.com',
    toAddress: overrides.toAddress ?? 'agent@example.com',
    direction: overrides.direction,
    createdAt: overrides.createdAt,
    isRead: overrides.isRead,
    senderIdentity: overrides.senderIdentity ?? {
      id: 'identity-1',
      emailAddress: 'agent@example.com',
      displayName: 'Agent',
    },
    campaignProspect: overrides.campaignProspect ?? {
      id: 'prospect-1',
      contact: {
        id: 'contact-1',
        firstName: 'Pat',
        lastName: 'Prospect',
        companyName: 'Prospect Co',
        email: 'prospect@example.com',
      },
      campaign: {
        id: 'campaign-1',
        name: 'Campaign',
      },
    },
  }
}

async function main() {
  await verifyRouteScopingAndSelection()

  const baseTime = new Date('2026-03-17T10:00:00.000Z')
  const messages: InboxThreadMessageRecord[] = [
    buildMessage({
      threadId: 'thread-mixed',
      direction: 'outbound',
      createdAt: new Date(baseTime.getTime() + 1_000),
      isRead: false,
      subject: 'Initial outreach',
      toAddress: 'mixed@example.com',
    }),
    buildMessage({
      threadId: 'thread-mixed',
      direction: 'inbound',
      createdAt: new Date(baseTime.getTime() + 2_000),
      isRead: false,
      subject: 'Re: Initial outreach',
      fromAddress: 'mixed@example.com',
    }),
    buildMessage({
      threadId: 'thread-mixed',
      direction: 'inbound',
      createdAt: new Date(baseTime.getTime() + 3_000),
      isRead: true,
      subject: 'Re: Initial outreach',
      fromAddress: 'mixed@example.com',
    }),
    buildMessage({
      threadId: 'thread-read',
      direction: 'inbound',
      createdAt: new Date(baseTime.getTime() + 4_000),
      isRead: true,
      subject: 'Read thread',
      fromAddress: 'read@example.com',
      campaignProspect: {
        id: 'prospect-2',
        contact: {
          id: 'contact-2',
          firstName: 'Riley',
          lastName: 'Read',
          companyName: 'Read Co',
          email: 'read@example.com',
        },
        campaign: {
          id: 'campaign-2',
          name: 'Read Campaign',
        },
      },
    }),
    buildMessage({
      threadId: 'thread-unread',
      direction: 'inbound',
      createdAt: new Date(baseTime.getTime() + 5_000),
      isRead: false,
      subject: 'Unread thread',
      fromAddress: 'unread@example.com',
      campaignProspect: {
        id: 'prospect-3',
        contact: {
          id: 'contact-3',
          firstName: 'Uma',
          lastName: 'Unread',
          companyName: 'Unread Co',
          email: 'unread@example.com',
        },
        campaign: {
          id: 'campaign-3',
          name: 'Unread Campaign',
        },
      },
    }),
  ]

  const summaries = buildInboxThreadSummaries(messages)

  assert.equal(summaries.length, 3, 'expected three thread summaries')

  const mixed = summaries.find((thread) => thread.threadId === 'thread-mixed')
  assert.ok(mixed, 'expected mixed thread summary')
  assert.equal(mixed.unreadCount, 1, 'mixed thread should count only unread inbound messages')

  const readOnly = summaries.find((thread) => thread.threadId === 'thread-read')
  assert.ok(readOnly, 'expected read-only thread summary')
  assert.equal(readOnly.unreadCount, 0, 'read-only thread should not count as unread')

  const unreadOnly = summaries.find((thread) => thread.threadId === 'thread-unread')
  assert.ok(unreadOnly, 'expected unread-only thread summary')
  assert.equal(unreadOnly.unreadCount, 1, 'unread inbound message should count as unread')

  const unreadThreads = summaries.filter((thread) => thread.unreadCount > 0)
  assert.deepEqual(
    unreadThreads.map((thread) => thread.threadId).sort(),
    ['thread-mixed', 'thread-unread'],
    'only threads with unread inbound messages should survive unread filtering'
  )

  console.log('PASS self-test-inbox-thread-unread')
}

main().catch((error) => {
  console.error('FAIL self-test-inbox-thread-unread')
  console.error(error)
  process.exit(1)
})
