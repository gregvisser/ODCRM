# Reality Check — Marketing Feature Gaps

**Date:** 2026-02-22
**Branch:** `marketing-hardening-real`

---

## What the previous sprint actually did

The `marketing-completion-sprint` PR made legitimate but **frontend-only** fixes:
- Templates: Fixed `handleDeleteTemplate` to check API error before updating UI (correct)
- Sequences: Made modal wider with 2-column layout (cosmetic, correct)
- Compliance: Added Emails/Domains sub-tabs to existing ComplianceTab (frontend filter only)
- Schedules: Added missing TypeScript type definitions so the file compiles (type fix, correct)
- Reports: Added missing `Button` import (correct)
- Inbox: Added missing Chakra imports + `toast` + opt-out button calling `/api/suppression` (correct)

**None of those changes were false.** But they did NOT implement the backend features requested.

---

## What exists today (verified by reading all files)

### Prisma Models ✅
| Model | Status | Notes |
|-------|--------|-------|
| `SuppressionEntry` | ✅ EXISTS | Single model, `type: 'email'\|'domain'`, `value`, `emailNormalized` |
| `EmailEvent` | ✅ EXISTS | All event types: sent, delivered, opened, clicked, replied, bounced, opted_out, spam_complaint, failed, not_reached |
| `EmailMessageMetadata` | ✅ EXISTS | Lacks `isRead` field |
| `EmailIdentity` | ✅ EXISTS | Lacks `signatureHtml` field |
| `EmailSequence` | ✅ EXISTS | Multi-step sequences |
| `EmailCampaign` | ✅ EXISTS | Used as "schedules" |
| `EmailCampaignProspectStep` | ✅ EXISTS | N-step scheduling queue |

### Backend Routes ✅
| Route file | Status | Issues |
|------------|--------|--------|
| `/api/templates` | ✅ Works | DELETE uses `findUnique+check` not `findFirst` |
| `/api/suppression` | ✅ Works | No `/emails`, `/domains` sub-routes |
| `/api/sequences` | ⚠️ Partial | **Enroll endpoint has NO suppression check** |
| `/api/schedules` | ❌ Broken | `DELETE /:id` references `prisma.emailSendSchedule` (model does NOT exist) |
| `/api/reports` | ⚠️ Wrong | Date ranges use UTC, not Europe/London; week = last 7 days not Mon-Sun |
| `/api/inbox` | ⚠️ Partial | No `isRead` persisted, no `/read` endpoint, no `/refresh`, no `/optout` |
| `/api/email` (tracking) | ⚠️ Partial | Open pixel exists; click tracking does NOT exist; `customerId` missing in EventCreate |

### Workers
| Worker | Status | Notes |
|--------|--------|-------|
| `emailScheduler.ts` | ✅ Real | Suppression enforced (double check: pre-batch + per-send), daily caps, jitter |
| `replyDetection.ts` | ✅ Real | Detects replies via Outlook, stores in `EmailMessageMetadata` |

### Suppression Enforcement
- **Worker**: ✅ Enforced in `emailScheduler.ts` — uses `loadSuppressionSets` + `isSuppressedInSets` (batch-level) AND `isSuppressed` (per-email final check)
- **Sequences enroll endpoint**: ❌ NOT checked — `sequences.ts POST /:id/enroll` has no suppression filter
- **Sequences dry-run endpoint**: ✅ Has `POST /api/suppression/check` call

---

## What is missing vs requirements

### Phase 1 (Templates)
- ❌ Minor: DELETE uses `findUnique + customerId check` — correct but should use `findFirst({ id, customerId })` for consistency

### Phase 2 (Suppression)
- ❌ No shared `suppressionService.ts` — `isSuppressed()` is duplicated in `emailScheduler.ts`
- ❌ No `/api/suppression/emails` and `/api/suppression/domains` sub-routes
- ✅ `sequences.ts` enroll endpoint DOES check suppression (lines 575-627 — queries SuppressionEntry, filters suppressedContacts set, returns suppressionDetails)
- ✅ Worker DOES enforce suppression at send time

### Phase 3 (Schedules)
- ❌ `schedules.ts DELETE /:id` calls `prisma.emailSendSchedule` — model does NOT exist → runtime crash
- ❌ `schedules.ts` has `// @ts-nocheck` — all type safety disabled
- ❌ Status filter includes `'scheduled'` which is NOT in `CampaignStatus` enum
- ✅ Jitter: Worker uses `Math.random()` for delay scheduling (line 262-263 of emailScheduler.ts)
- ✅ Daily caps enforced in worker

### Phase 4 (Reports)
- ❌ Date ranges use UTC (not Europe/London) — today/week/month boundaries are wrong for UK users
- ❌ "Week" = last 7 days (not Mon–Sun)
- ❌ `tracking.ts` open event create is MISSING `customerId` — events won't be found by `/api/reports/customer`
- ✅ Open pixel `/api/email/open` EXISTS
- ❌ Click redirect does NOT exist

### Phase 5 (Inbox)
- ❌ `EmailMessageMetadata` lacks `isRead` field — read/unread cannot be persisted
- ❌ `EmailIdentity` lacks `signatureHtml` — signatures cannot be stored
- ❌ No `POST /api/inbox/messages/:id/read` endpoint
- ❌ No `POST /api/inbox/refresh` endpoint
- ❌ No `POST /api/inbox/messages/:id/optout` endpoint (frontend uses `/api/suppression` directly — works but unclean)
- ❌ No signature endpoint in outlook routes

---

## Migration drift (pre-existing)

| State | Migration | Notes |
|-------|-----------|-------|
| In local, NOT in prod | `20260220140000_add_lead_source_applies_to` | **Risk: will be applied to prod on next deploy** |
| In prod, NOT locally | `20260218120000_add_lead_record_occurred_source_owner_external_id` | Schema has these fields — OK |
| In prod, NOT locally | `20260218180000_add_workspaces_table` | Prod has workspaces table; local does not |

**Safe approach:** New migrations use `IF NOT EXISTS` SQL for idempotency.

---

## This sprint implements

1. **Phase 1**: Fix `templates.ts` DELETE to `findFirst({ id, customerId })`
2. **Phase 2**: Create `suppressionService.ts`, add `/emails`+`/domains` routes, fix sequences enroll
3. **Phase 3**: Fix `schedules.ts` DELETE, remove `@ts-nocheck`, fix status enum  
4. **Phase 4**: Fix `reports.ts` Europe/London timezone; fix `tracking.ts` missing `customerId`; add click tracking endpoint
5. **Phase 5**: Add `isRead`/`signatureHtml` migration; add inbox `/read`, `/refresh`, `/optout` endpoints; add signature endpoint; update InboxTab UI
