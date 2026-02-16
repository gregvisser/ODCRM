# Flow 04 — Campaign create and send

```mermaid
sequenceDiagram
  autonumber
  participant User as User
  participant FE as Frontend Screen<br/>marketing.sequences / marketing.people / marketing.email-accounts (campaign setup)
  participant API as API Route Group<br/>/api/campaigns (+ /api/outlook, /api/templates)
  participant DB as DB Models<br/>EmailCampaign + EmailCampaignTemplate + EmailCampaignProspect + EmailCampaignProspectStep + EmailIdentity + EmailEvent + EmailMessageMetadata + SuppressionEntry
  participant W as Worker<br/>emailScheduler.ts (startEmailScheduler)
  participant EXT as External<br/>Microsoft Graph / Outlook

  User->>FE: Builds a campaign (select sender, templates, targets) and starts it
  FE->>FE: Validate required inputs (sender identity, templates, targets)
  FE->>API: Calls /api/outlook to connect sender identity (if needed)
  API->>EXT: OAuth / mailbox access via Microsoft Graph
  API->>DB: Create/Update EmailIdentity
  FE->>API: Create campaign via /api/campaigns (whitelisted fields only)
  API->>API: Validate input (schema)
  API->>API: Enforce whitelist writes
  API->>DB: Write EmailCampaign
  API->>DB: Write EmailCampaignTemplate (steps)
  API->>DB: Write EmailCampaignProspect (targets)
  API->>DB: Write EmailCampaignProspectStep (scheduled steps when applicable)
  API-->>FE: 200 OK
  FE->>FE: Rehydrate after save (refetch campaigns/status)

  Note over W,DB: Background sending loop (every minute) if ENABLE_EMAIL_SCHEDULER=true
  W->>DB: Load running EmailCampaign + templates + due prospects/steps
  W->>DB: Load SuppressionEntry set for the campaign.customerId
  alt Recipient suppressed
    W->>DB: Mark prospect suppressed and record EmailEvent (failed/suppressed)
  else Allowed
    W->>EXT: Send email via Microsoft Graph / Outlook
    W->>DB: Record EmailEvent(type=sent/failed/bounced)
    W->>DB: Record EmailMessageMetadata (thread/message ids)
    W->>DB: Update EmailCampaignProspect status and next-step scheduling
  end
```

## Inputs
- Campaign configuration (customerId, sender identity, templates, targeting list)
- Suppression list entries (customer-scoped)
- Worker enabled flag: `ENABLE_EMAIL_SCHEDULER=true`

## Outputs
- Persisted campaign data:
  - **`EmailCampaign`**
  - **`EmailCampaignTemplate`**
  - **`EmailCampaignProspect`**
  - **`EmailCampaignProspectStep`** (where used)
  - **`EmailIdentity`**
- Sending telemetry:
  - **`EmailEvent`**
  - **`EmailMessageMetadata`**
- Emails delivered via **Microsoft Graph / Outlook**

## Non-negotiable rules
- **Whitelist writes only** on `/api/campaigns` and related setup endpoints.
- **Rehydrate after save**: UI must refetch campaign state from API/DB.
- **Suppression enforcement is mandatory** at send-time (customer-scoped).
- **Idempotency/claiming**: worker must prevent double-sends in multi-instance environments.

## Failure cases
- OAuth/Outlook connection fails → cannot send; show error and retry.
- Validation fails on campaign create → do not write campaign rows.
- Worker disabled (`ENABLE_EMAIL_SCHEDULER!=true`) → campaign may exist but will not send.
- External send fails → record failure/bounce event; do not pretend it was sent.
