# ODCRM Flow Catalog

These flow docs are **decision tools**: they show the authoritative path for writes, the models touched, and the non-negotiable rules (validation, whitelist writes, audit logging, rehydrate-after-save).

- **01-account-details-save.md** — Patch and save account fields to `Customer` via `/api/customers` with audit logging.
- **02-onboarding-save.md** — Save onboarding payload to `Customer` + `CustomerContact` with optimistic concurrency via `/api/customers`.
- **03-template-create.md** — Create/update an `EmailTemplate` via `/api/templates`.
- **04-campaign-create-and-send.md** — Create campaign records via `/api/campaigns` and send via `emailScheduler.ts` to Outlook with events/metadata.
- **05-sequence-activate-and-enroll.md** — Define sequences and enroll contacts via `/api/sequences`, with reply processing via `replyDetection.ts`.
- **06-suppression-enforcement.md** — Manage `SuppressionEntry` via `/api/suppression` and enforce at send-time.
- **07-leads-sync-from-sheets.md** — Configure sheet sources and sync leads into `LeadRecord` via `/api/sheets`, `/api/leads`, and `leadsSync.ts`.
- **08-inbox-reply-detection.md** — View inbox via `/api/inbox` and detect replies via `replyDetection.ts` writing events/metadata.
- **09-upload-to-blob.md** — Upload files via `/api/uploads` to Azure Blob and store references on `Customer` where applicable.

