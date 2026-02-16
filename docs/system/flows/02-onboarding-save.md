# Flow 02 — Onboarding save (single-transaction onboarding payload)

```mermaid
sequenceDiagram
  autonumber
  participant User as User
  participant FE as Frontend Screen<br/>onboarding.customer-onboarding (CustomerOnboardingTab)
  participant API as API Route Group<br/>/api/customers (PUT /:id/onboarding)
  participant DB as DB Models<br/>Customer + CustomerContact + CustomerAuditEvent
  participant W as Worker<br/>(none)
  participant EXT as External<br/>(optional) /api/company-data + /api/sheets + /api/uploads

  User->>FE: Updates onboarding details and clicks “Save”
  FE->>FE: Validate inputs (targets, sheet label when URL is set, contact completeness)
  FE->>API: PUT /api/customers/:id/onboarding + If-Match-Updated-At header
  API->>API: Validate payload (strict schema)
  API->>API: Enforce whitelist writes (only apply fields present in request)
  API->>DB: Check optimistic concurrency (If-Match-Updated-At vs Customer.updatedAt)
  alt Concurrency conflict
    API-->>FE: 409 Conflict + current updatedAt
    FE-->>User: Show conflict message and require refresh
  else OK to save
    API->>DB: Update Customer (non-destructive; no missing-key deletes)
    API->>DB: Upsert CustomerContact rows (primary + additional contacts)
    API->>DB: Write CustomerAuditEvent (best-effort)
    API-->>FE: 200 OK + updatedAt + Customer snapshot
    FE->>API: Rehydrate after save (refetch customer from /api/customers)
    FE-->>User: Show “Saved to database” confirmation
  end
```

## Inputs
- **Customer ID** (`:id`)
- **Onboarding payload**: `{ customer: ..., contacts?: ... }`
- **`If-Match-Updated-At`** header (required)

## Outputs
- Updated **`Customer`**
- Updated **`CustomerContact`** rows (primary and additional contacts)
- New **`CustomerAuditEvent`** (best-effort)
- UI refreshed from DB (rehydrated)

## Non-negotiable rules
- **Optimistic concurrency required**: onboarding saves must not overwrite silently.
- **Whitelist writes only**: only apply fields present in the request.
- **No destructive overwrites**: missing keys must not delete existing DB values.
- **Rehydrate after save**: UI must refetch the customer from API/DB.

## Failure cases
- Missing `If-Match-Updated-At` → reject save (precondition required).
- Conflict (someone else updated) → 409 + require refresh/resolve.
- Validation errors (contacts incomplete, missing sheet label when URL is set) → reject with message.
- DB error → show error; do not assume partial success.
