# Production Verification — Marketing Hardening Sprint

**Date:** 2026-02-23
**Commit:** `6c09a56cd209b529ac1f8af1354d58a1aa3286e0`
**Branch:** `marketing-hardening-real` → merged to `main`

---

## Deployment Status

| Check | Result |
|-------|--------|
| GitHub Actions — Frontend | ✅ SUCCESS (2m 1s) |
| GitHub Actions — Backend | ✅ SUCCESS (6m 33s) |
| Production SHA match | ✅ `6c09a56` matches `/__build.json` |
| Prisma migration applied | ✅ `20260222120000_add_inbox_read_signature` |
| Production URL | https://odcrm.bidlow.co.uk |

---

## Per-phase checklist

### Phase 1 — Templates delete
- [x] Backend: `findUnique + customerId check` → correct tenant scope
- [x] Frontend: error propagation fixed in previous sprint
- [x] Verification doc: `TEMPLATES_DELETE_VERIFICATION.md`

### Phase 2 — Suppression routes
- [x] `GET /api/suppression/emails` — list emails
- [x] `POST /api/suppression/emails/upload` — CSV upload
- [x] `DELETE /api/suppression/emails` — batch delete
- [x] Same for `/domains`
- [x] `sequences.ts enroll`: suppression check confirmed present (lines 575-627)
- [x] Worker: suppression enforced twice (pre-batch + per-send) — unchanged, already correct
- [x] Verification doc: `SUPPRESSION_E2E_CHECKLIST.md`

### Phase 3 — Schedules
- [x] Fixed crash: `DELETE /:id` now uses `prisma.emailCampaign` (not non-existent `emailSendSchedule`)
- [x] Removed `@ts-nocheck` — full TypeScript
- [x] Fixed status filter — removed invalid `'scheduled'` from `CampaignStatus` enum
- [x] Worker jitter confirmed present in `emailScheduler.ts` lines 262-263
- [x] Verification doc: `SCHEDULES_VERIFICATION.md`

### Phase 4 — Reports
- [x] `reports.ts` now uses Europe/London timezone via `Intl.DateTimeFormat`
- [x] "Week" = Mon-Sun (was last 7 days UTC)
- [x] `tracking.ts`: `customerId` added to EmailEvent.create (opens/clicks now queryable)
- [x] Click redirect endpoint added: `GET /api/email/click?cpid=&url=`
- [x] Verification doc: `REPORTS_VALIDATION.md`

### Phase 5 — Inbox
- [x] DB migration: `isRead` + `bodyPreview` on `email_message_metadata`
- [x] DB migration: `signatureHtml` on `email_identities`
- [x] `GET /api/inbox/messages` (paginated, unreadOnly filter)
- [x] `POST /api/inbox/messages/:id/read` (persist isRead)
- [x] `POST /api/inbox/messages/:id/optout` (add to suppression)
- [x] `POST /api/inbox/refresh` (real Outlook poll via fetchRecentInboxMessages)
- [x] `GET/PUT /api/outlook/identities/:id/signature`
- [x] Frontend: Refresh button calls backend refresh endpoint
- [x] Frontend: Thread click marks messages as read
- [x] Frontend: Unread only toggle
- [x] Verification doc: `INBOX_E2E.md`

---

## What this sprint does NOT include (deferred)

- Full signature editor UI in InboxTab (API exists; UI requires separate implementation)
- Open tracking pixel injection into outbound email HTML (API exists; email service needs updating)
- Provider webhook ingestion for delivered/bounced events (separate infrastructure work)

---

**Result: ✅ ALL PHASES COMPLETE — Production verified**
