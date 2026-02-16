# Flow 08 — Inbox + reply detection

```mermaid
sequenceDiagram
  autonumber
  participant User as User
  participant FE as Frontend Screen<br/>marketing.inbox (InboxTab)
  participant API as API Route Group<br/>/api/inbox (+ /api/outlook)
  participant DB as DB Models<br/>EmailMessageMetadata + EmailEvent + EmailCampaignProspect + EmailIdentity
  participant W as Worker<br/>replyDetection.ts (startReplyDetectionWorker)
  participant EXT as External<br/>Microsoft Graph / Outlook

  User->>FE: Opens Inbox to see recent activity and replies
  FE->>API: GET /api/inbox (read view)
  API->>DB: Read EmailMessageMetadata + EmailEvent (customer-scoped where applicable)
  API-->>FE: 200 OK (messages + events)

  Note over W,EXT: Background reply detection runs every 5 minutes if ENABLE_REPLY_DETECTOR=true
  W->>DB: Load active EmailIdentity list
  W->>EXT: Fetch recent inbound messages for each identity (Graph/Outlook)
  W->>W: Try to match inbound message to a campaign prospect (header/thread/fallback)
  W->>DB: Create EmailMessageMetadata (inbound) if not already processed
  alt Matched to a prospect
    W->>DB: Create EmailEvent(type=replied)
    W->>DB: Update EmailCampaignProspect (replyDetectedAt, replyCount, lastStatus)
  else Not matched
    W->>DB: Store metadata only (for later troubleshooting)
  end

  FE->>FE: Rehydrate view periodically (refetch inbox data)
  FE-->>User: Shows updated inbox and reply indicators
```

## Inputs
- Connected **Email identities** (Outlook)
- Worker enabled flag: `ENABLE_REPLY_DETECTOR=true`

## Outputs
- **`EmailMessageMetadata`** rows (inbound + linkage fields when found)
- **`EmailEvent`** rows for replies
- Updated **`EmailCampaignProspect`** status when a reply is detected

## Non-negotiable rules
- **Idempotency**: do not process the same provider message twice.
- **Customer scoping**: replies and metadata must associate correctly to customer/campaign context.
- **Rehydrate after save**: Inbox UI must refresh from API/DB to show latest events.

## Failure cases
- Graph/Outlook API failures → replies not detected; must log errors and retry next interval.
- Matching fails → replies may be stored but not linked; requires troubleshooting.
- Worker disabled (`ENABLE_REPLY_DETECTOR!=true`) → inbox shows stale/missing reply detection.
