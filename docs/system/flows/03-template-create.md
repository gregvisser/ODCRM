# Flow 03 — Template create

```mermaid
sequenceDiagram
  autonumber
  participant User as User
  participant FE as Frontend Screen<br/>marketing.templates (TemplatesTab)
  participant API as API Route Group<br/>/api/templates
  participant DB as DB Models<br/>EmailTemplate
  participant W as Worker<br/>(none)
  participant EXT as External<br/>(none)

  User->>FE: Creates a new email template and clicks “Save”
  FE->>FE: Validate required fields (name, subject, body)
  FE->>API: POST/PUT /api/templates (whitelisted fields only)
  API->>API: Validate input (schema)
  API->>API: Enforce whitelist writes (no extra fields)
  API->>DB: Create or update EmailTemplate
  API-->>FE: 200 OK + template id/details
  FE->>FE: Rehydrate after save (refetch templates list)
  FE-->>User: Show “Template saved” confirmation
```

## Inputs
- Template fields (name, subject, body)
- Customer context (template is customer-scoped in DB)

## Outputs
- New/updated **`EmailTemplate`**
- UI refreshed from DB (rehydrated)

## Non-negotiable rules
- **Whitelist writes only**: only allow known template fields.
- **Rehydrate after save**: refetch the templates list from API/DB.
- **No destructive overwrites**: partial updates must not wipe unrelated fields.

## Failure cases
- Validation error (missing required fields) → show error; no DB write.
- DB error → show error; do not assume it saved.
