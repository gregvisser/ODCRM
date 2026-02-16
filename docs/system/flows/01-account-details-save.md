# Flow 01 — Account details save (customer account patch)

```mermaid
sequenceDiagram
  autonumber
  participant User as User
  participant FE as Frontend Screen<br/>customers.accounts (AccountsTabDatabase / Account Card)
  participant API as API Route Group<br/>/api/customers (PATCH /:id/account)
  participant DB as DB Models<br/>Customer + CustomerAuditEvent
  participant W as Worker<br/>(none)
  participant EXT as External<br/>(none)

  User->>FE: Edits an account field and clicks “Save”
  FE->>FE: Validate required fields on screen (basic checks)
  FE->>API: PATCH /api/customers/:id/account (only whitelisted fields)
  API->>API: Validate input (strict schema)
  API->>API: Enforce whitelist writes (ignore anything not allowed)
  API->>DB: Read current Customer (for diff)
  API->>DB: Update Customer (merge patch, non-destructive)
  API->>DB: Append audit note (diff) into Customer.accountData.notes
  API->>DB: Write CustomerAuditEvent (best-effort)
  API-->>FE: 200 OK + updated Customer + diff summary (changes)
  FE->>FE: Rehydrate after save (refetch customer list/detail from API)
  FE-->>User: Show “Saved to database” confirmation
```

## Inputs
- **Customer ID** (`:id`)
- **Whitelisted patch fields** (e.g. selected scalar fields + selected `accountData.*` paths)
- **Authenticated actor identity** (for audit attribution)

## Outputs
- Updated **`Customer`**
- New **audit note** inside `Customer.accountData.notes` (diff text)
- New **`CustomerAuditEvent`** (best-effort)
- UI refreshed from DB (rehydrated)

## Non-negotiable rules
- **DB is the source of truth**: after save, UI must refresh from API/DB.
- **Whitelist writes only**: never accept arbitrary fields.
- **No destructive overwrites**: missing keys must not delete existing DB values.
- **Audit logging required**: capture actor + timestamp + field diff where applicable.

## Failure cases
- Validation fails (bad field / wrong shape) → show error; do not write.
- Not authenticated / actor identity missing → reject write (no unaudited saves).
- DB conflict or unexpected error → show error; UI must not assume save happened.
