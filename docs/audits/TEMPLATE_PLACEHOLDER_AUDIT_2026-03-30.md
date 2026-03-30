# Template placeholder audit — 2026-03-30

## 1) UI-advertised placeholders

`src/tabs/marketing/components/TemplatesTab.tsx` lists (via `TEMPLATE_PLACEHOLDER_HELP`):  
`email_signature`, `first_name`, `last_name`, `full_name`, `company_name`, `role`, `website`, `sender_name`, `sender_email`, `unsubscribe_link`.

The editor preview call sent **sample** `variables` (first/last/full/role/unsubscribe) but **did not** send `company_name` or recipient `email`, so the server filled gaps from the **current tenant customer** for preview.

## 2) Renderer-supported placeholders

`server/src/services/templateRenderer.ts` supports canonical keys including:  
`first_name`, `last_name`, `full_name`, `company_name`, `role`, `website`, `sender_name`, `sender_email`, `unsubscribe_link`, `email_signature`, `email`, `phone`, plus camelCase aliases.  
After this fix: **`sender_company_name`** (and aliases `client_name`, `senderCompanyName`, `clientName`) for the **sending tenant / client** name.

## 3) Context builders (before fix)

| Path | Builder |
|------|---------|
| POST `/api/templates/preview` | Inline merge in `templates.ts` — **fell back `company_name` → `customer.name`** |
| `sendQueueWorker.processOne` | Inline object — **`accountName` → recipient company else `enrollment.customer.name`**; **`website` → sending customer website** |
| GET enrollment step render | Same anti-patterns as queue worker |
| GET send-queue item render | Same |
| `emailScheduler.sendCampaignEmail` | Inline — **`accountName` and `website` used sending campaign customer** when contact company empty |
| `campaignSender` | Same |
| `sequences` POST `/:id/dry-run` | Per-contact vars — **no `website`; no explicit sender tenant name placeholder** |
| `sendWorker` `buildLaunchSubjectPreview` | Minimal vars — **no `company_name` / `sender` parity with live send** |

## 4) `{{company_name}}` by path (before)

| Path | Pointed to |
|------|------------|
| Preview (missing explicit company in body) | **Sending client `Customer.name`** (bug) |
| Queue / enrollment render / send | Recipient row `company` if set, else **sending customer name** (bug) |
| Campaign scheduler / sender | Contact `companyName` if set, else **sending customer name** (bug) |

## 5) `{{first_name}}` by path (before)

| Path | Pointed to |
|------|------------|
| Preview | Requested sample or **incorrectly** `full_name` as `first_name` fallback in old merge |
| Sends | Enrollment recipient / contact `firstName`; **empty if not stored** — no email-local fallback |

## 6) Manual test recipient using client context?

**Yes** — preview and several send paths treated **tenant customer** as the default for **recipient** company and website when data was missing.

## 7) Preview vs test vs live divergence?

**Yes** — preview merged `customerName` into recipient fields; workers mixed `campaign.customer` / `enrollment.customer` into **target** `website` / `accountName`. Manual email-only recipients could see **OpenDoors** in `{{company_name}}` and blank `{{first_name}}`.

## 8) Sender vs recipient mixing?

**Yes** — `company_name`, `accountName`, `company`, and `website` were overloaded with **sending customer** data. Sender identity (`sender_name`, `email_signature`) was generally correct but there was **no explicit** “sending client organization” placeholder.

## Remediation (summary)

Single module `server/src/services/templatePlaceholderContext.ts`: **`buildTemplateVariablesForSend`** (all sends/renders) and **`resolvePreviewTemplateVariables`** (preview API). Deterministic **email-local fallback** when prospect/recipient fields are empty. **`{{sender_company_name}}`** for the tenant/client name; **`{{company_name}}`** is **only** the target company.
