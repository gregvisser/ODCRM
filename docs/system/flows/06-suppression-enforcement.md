# Flow 06 — Suppression enforcement (DNC)

```mermaid
sequenceDiagram
  autonumber
  participant User as User
  participant FE as Frontend Screen<br/>marketing.compliance (ComplianceTab)
  participant API as API Route Group<br/>/api/suppression
  participant DB as DB Models<br/>SuppressionEntry + EmailEvent
  participant W as Worker<br/>emailScheduler.ts (startEmailScheduler)
  participant EXT as External<br/>Microsoft Graph / Outlook

  User->>FE: Adds or imports suppression (do-not-contact) entries
  FE->>FE: Validate input (email/domain format)
  FE->>API: POST/PUT /api/suppression (whitelisted fields only)
  API->>API: Validate input (schema)
  API->>API: Enforce whitelist writes
  API->>DB: Write SuppressionEntry (customer-scoped)
  API-->>FE: 200 OK
  FE->>FE: Rehydrate after save (refetch suppression summary/list)

  Note over W,DB: Enforcement happens at send-time (not at list entry time)
  W->>DB: Load SuppressionEntry set for customerId
  W->>DB: Check recipient email/domain against suppression set
  alt Suppressed
    W-->>EXT: Do NOT send the email
    W->>DB: Record EmailEvent (failed/suppressed) where applicable
  else Not suppressed
    W->>EXT: Send email via Microsoft Graph / Outlook
  end
```

## Inputs
- Suppression entries (email and/or domain), customer-scoped
- Outbound send attempts (campaign/sequence execution)

## Outputs
- Updated **`SuppressionEntry`** set
- Suppressed sends prevented (no external email)
- Optional telemetry: **`EmailEvent`** for suppressed/failed sends

## Non-negotiable rules
- **Suppression enforcement is mandatory** for all outbound sending.
- **Customer-scoped enforcement**: never leak suppression data across customers.
- **Whitelist writes only**: only allow expected suppression fields.
- **Rehydrate after save**: UI must refetch suppression state after changes.

## Failure cases
- Invalid entry format → reject with error.
- Worker disabled (`ENABLE_EMAIL_SCHEDULER!=true`) → enforcement won’t run because sending won’t run.
- Enforcement regression → highest severity; may cause compliance incidents.
