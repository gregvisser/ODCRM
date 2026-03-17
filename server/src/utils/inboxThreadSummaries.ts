export type InboxThreadMessageRecord = {
  threadId: string | null
  subject: string
  fromAddress: string
  toAddress: string
  direction: 'inbound' | 'outbound'
  createdAt: Date
  isRead: boolean
  senderIdentity: {
    id: string
    emailAddress: string
    displayName: string | null
  } | null
  campaignProspect: {
    id: string
    contact: {
      id: string
      firstName: string
      lastName: string
      companyName: string
      email: string
    } | null
    campaign: {
      id: string
      name: string
    } | null
  } | null
}

export type InboxThreadSummary = {
  threadId: string
  subject: string
  participantEmail: string
  participantName: string | null
  mailboxEmail: string | null
  mailboxName: string | null
  campaignId: string | undefined
  campaignName: string | undefined
  latestMessageAt: Date
  messageCount: number
  hasReplies: boolean
  unreadCount: number
}

function getParticipantName(message: InboxThreadMessageRecord): string | null {
  const contact = message.campaignProspect?.contact
  if (!contact) return null

  return (
    `${contact.firstName || ''} ${contact.lastName || ''}`.trim() ||
    contact.companyName ||
    null
  )
}

export function buildInboxThreadSummaries(messages: InboxThreadMessageRecord[]): InboxThreadSummary[] {
  const threadMap = new Map<string, InboxThreadSummary>()

  for (const message of messages) {
    if (!message.threadId) continue

    const threadId = message.threadId
    const existing = threadMap.get(threadId)
    const unreadIncrement = message.direction === 'inbound' && message.isRead === false ? 1 : 0

    if (!existing) {
      threadMap.set(threadId, {
        threadId,
        subject: message.subject,
        participantEmail: message.direction === 'inbound' ? message.fromAddress : message.toAddress,
        participantName: getParticipantName(message),
        mailboxEmail: message.senderIdentity?.emailAddress || null,
        mailboxName: message.senderIdentity?.displayName || null,
        campaignId: message.campaignProspect?.campaign?.id,
        campaignName: message.campaignProspect?.campaign?.name,
        latestMessageAt: message.createdAt,
        messageCount: 1,
        hasReplies: message.direction === 'inbound',
        unreadCount: unreadIncrement,
      })
      continue
    }

    existing.messageCount++
    existing.unreadCount += unreadIncrement

    if (message.createdAt > existing.latestMessageAt) {
      existing.subject = message.subject
      existing.participantEmail = message.direction === 'inbound' ? message.fromAddress : message.toAddress
      existing.participantName = getParticipantName(message)
      existing.mailboxEmail = message.senderIdentity?.emailAddress || null
      existing.mailboxName = message.senderIdentity?.displayName || null
      existing.campaignId = message.campaignProspect?.campaign?.id
      existing.campaignName = message.campaignProspect?.campaign?.name
      existing.latestMessageAt = message.createdAt
    }

    if (message.direction === 'inbound') {
      existing.hasReplies = true
    }
  }

  return Array.from(threadMap.values()).sort(
    (a, b) => b.latestMessageAt.getTime() - a.latestMessageAt.getTime()
  )
}
