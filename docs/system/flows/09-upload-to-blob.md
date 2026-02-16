# Flow 09 — Upload to Azure Blob Storage

```mermaid
sequenceDiagram
  autonumber
  participant User as User
  participant FE as Frontend Screen<br/>customers.accounts (AccountsTabDatabase / Account Card)<br/>+ onboarding.customer-onboarding (CustomerOnboardingTab)
  participant API as API Route Group<br/>/api/uploads (and sometimes /api/customers)
  participant DB as DB Models<br/>Customer (blob references stored on customer records where applicable)
  participant W as Worker<br/>(none)
  participant EXT as External<br/>Azure Blob Storage

  User->>FE: Selects a file and clicks “Upload”
  FE->>FE: Validate file size/type before upload (basic checks)
  FE->>API: POST /api/uploads (multipart upload; whitelisted)
  API->>API: Validate file constraints (allowed mime types, max size)
  API->>API: Enforce whitelist writes (no arbitrary metadata writes)
  API->>EXT: Upload file to Azure Blob Storage
  API-->>FE: 200 OK (blob reference / download info)
  FE->>API: (If needed) PATCH/PUT /api/customers to store blob reference on Customer
  API->>DB: Update Customer with blob reference fields (whitelisted)
  API-->>FE: 200 OK
  FE->>FE: Rehydrate after save (refetch customer detail)
  FE-->>User: Shows uploaded file link/status

  Note over API,EXT: STATIC /uploads is legacy local filesystem and should not be used for new uploads
```

## Inputs
- File (name, bytes, mime type)
- Customer context (which customer the file belongs to)

## Outputs
- File stored in **Azure Blob Storage**
- Optional blob reference stored on **`Customer`**
- UI refreshed from DB (rehydrated)

## Non-negotiable rules
- **Whitelist writes only**: do not accept arbitrary file metadata or DB fields.
- **Validate constraints**: enforce allowed mime types and size limits.
- **Rehydrate after save**: after upload and any DB update, refresh from API/DB.
- **Prefer Blob storage** for new files; **STATIC /uploads** is legacy.

## Failure cases
- File too large / unsupported mime type → reject with clear error.
- Blob upload fails → no DB update; show error.
- DB update fails after upload → surface error and keep blob reference for recovery.
