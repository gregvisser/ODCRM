/**
 * Resolve which sender identity would be used for an Inbox reply from thread messages.
 * Backend uses "latest message's sender identity" (orderBy createdAt desc, take first).
 * If the thread has messages from more than one identity, reply is ambiguous and must be blocked.
 */

export type MessageWithSender = {
  createdAt: Date
  senderIdentityId: string
  senderIdentity?: {
    id: string
    emailAddress: string
    displayName?: string | null
  } | null
}

export type ResolvedReplySender = {
  senderIdentityId: string
  emailAddress: string
  displayName: string | null
  ambiguous: boolean
}

/**
 * Returns the reply sender that would be used by POST /api/inbox/threads/:threadId/reply.
 * Uses latest message by createdAt; ambiguous is true when the thread has messages from more than one distinct sender identity.
 */
export function resolveReplySender(messages: MessageWithSender[]): ResolvedReplySender | null {
  if (!messages.length) return null

  const sorted = [...messages].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )
  const latest = sorted[0]
  const identity = latest.senderIdentity ?? null
  if (!identity) return null

  const distinctIds = new Set(messages.map((m) => m.senderIdentityId).filter(Boolean))
  const ambiguous = distinctIds.size > 1

  return {
    senderIdentityId: identity.id,
    emailAddress: identity.emailAddress ?? '',
    displayName: identity.displayName ?? null,
    ambiguous,
  }
}
