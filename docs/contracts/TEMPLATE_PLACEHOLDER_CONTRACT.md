# Template placeholder contract

## Target (recipient) placeholders

Resolved from the **target person / company** (enrollment recipient, campaign contact, or derived from the **recipient email** when no row or sparse data).

| Placeholder | Meaning |
|-------------|---------|
| `{{first_name}}` | Target person first name |
| `{{last_name}}` | Target person last name |
| `{{full_name}}` | Target full name |
| `{{company_name}}` | **Target** company name (never the sending tenant’s name) |
| `{{role}}` | Target title / job title |
| `{{website}}` | Target company website, or deterministic `https://<recipient-domain>` when unknown |
| `{{email}}`, `{{phone}}` | Target email / phone when present |

## Sender / client placeholders

Resolved from the **sending identity** and **tenant customer** (mailbox / client context).

| Placeholder | Meaning |
|-------------|---------|
| `{{sender_name}}` | Sending identity display name (fallback: sender email) |
| `{{sender_email}}` | Sending identity email |
| `{{email_signature}}` | Sending identity signature HTML |
| `{{sender_company_name}}` | Sending **tenant / client organization** name (alias: `{{client_name}}`) |

## Compliance / tracking

| Placeholder | Meaning |
|-------------|---------|
| `{{unsubscribe_link}}` | Recipient-specific unsubscribe URL; behavior unchanged; tenant-scoped |

## Manual test / email-only recipient

If there is no usable contact row (or first/company empty), values are **derived from the recipient address**:

- `first_name`: from explicit fields, else parsed from the **local part** of the email (e.g. `greg@…` → `Greg`; `john.smith@…` → `John`, last name `Smith` when split safely).
- `company_name`: explicit, else a **label from the email domain** (e.g. `bidlow.co.uk` → `Bidlow`).
- `website`: explicit, else `https://<domain>` from the recipient email.

## Invariants

1. **`{{company_name}}` MUST NOT** resolve to the sending client’s `Customer.name`. Use **`{{sender_company_name}}`** for that.
2. Preview, dry-run render, queue render, and live send **use the same builder** (`templatePlaceholderContext.ts`) so placeholder values **match** for the same inputs.
