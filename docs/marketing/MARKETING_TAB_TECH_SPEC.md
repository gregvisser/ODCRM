# Marketing Tab — Technical Spec

**Purpose:** Smallest clean system to support the Sunday Definition of Done. Additive only; tenant-scoped everywhere.

---

## 1. Tenant Scoping Rules

- **All** Marketing-related APIs MUST scope by `customerId`.
- **Source of customerId:** `(req.headers['x-customer-id'] as string) || (req.query.customerId as string)`.
- **Rule:** Every Prisma read/write that touches tenant data MUST include `where: { ..., customerId }` (or equivalent via relation: `campaign: { customerId }`, etc.).
- Frontend: `src/utils/api.ts` sets `X-Customer-Id` from `settingsStore.getCurrentCustomerId('prod-customer-1')`. Any tab with a customer dropdown MUST sync selection to `settingsStore.setCurrentCustomerId(selectedCustomerId)` before calling APIs that use the header, OR pass `headers: { 'X-Customer-Id': selectedCustomerId }` on each request.

---

## 2. API Endpoints (Express) — Contract Summary

### 2.1 Overview

| Method | Path | Request | Response | Validation | Errors |
|--------|------|---------|----------|------------|--------|
| GET | `/api/overview` | Headers: `x-customer-id` (or query `customerId`) | `{ customerId, totalContacts, contactsBySource, activeSequences, emailsSentToday, employeeStats[], generatedAt }` | — | 400 if no customerId |

### 2.2 Reports

| Method | Path | Request | Response | Validation | Errors |
|--------|------|---------|----------|------------|--------|
| GET | `/api/reports/customers` | — | `{ customers: [{ id, name, totalEvents }] }` | — | — |
| GET | `/api/reports/customer` | Query: `customerId`, `dateRange` (today\|week\|month) | `{ customerId, dateRange, startDate, endDate, sent, delivered, opened, clicked, replied, bounced, ...rates, senders[], generatedAt }` | — | 400 if no customerId |

**Fix for Sunday:** Prefer `customerId` query over header when query is present for GET `/api/reports/customer` so dropdown selection wins.

### 2.3 People (Contacts)

| Method | Path | Request | Response | Validation | Errors |
|--------|------|---------|----------|------------|--------|
| GET | `/api/contacts` | Header or query `customerId`; optional `?source=` | `Contact[]` | — | 400 if no customerId |
| POST | `/api/contacts` | Body: `{ firstName, lastName?, jobTitle?, companyName, email, phone?, source? }` | 201 + Contact | Zod schema | 409 duplicate email |
| PUT | `/api/contacts/:id` | Body: same shape | Contact | — | 404 |
| DELETE | `/api/contacts/:id` | — | 200 | — | 404 |

All operations enforce `customerId` (header/query) and ensure contact belongs to that customer.

### 2.4 Lead Sources (Sheets)

| Method | Path | Request | Response | Validation | Errors |
|--------|------|---------|----------|------------|--------|
| GET | `/api/sheets/sources` | Header/query `customerId` | `{ sources: SheetSourceConfig[], credentialsConfigured, ... }` | — | 400 |
| POST | `/api/sheets/sources/:source/connect` | Body: `{ sheetUrl }` | 200 + config | source in cognism\|apollo\|blackbook | 400 |
| POST | `/api/sheets/sources/:source/sync` | Body: optional | Sync result | — | — |
| GET | `/api/sheets/sources/:source/lists` | — | `{ source, lists: [{ id, name, memberCount, lastSyncAt }] }` | — | — |
| GET | `/api/sheets/sources/:source/lists/:listId/rows` | — | Rows preview | — | — |
| GET | `/api/sheets/sources/:source/preview` | — | Preview result | — | — |

All scoped by `customerId` in backend.

### 2.5 Suppression (Compliance)

| Method | Path | Request | Response | Validation | Errors |
|--------|------|---------|----------|------------|--------|
| GET | `/api/suppression` | Header/query `customerId`; optional `?type=email|domain`, `?q=` | `SuppressionEntry[]` | — | 400 |
| POST | `/api/suppression` | Body: `{ type: 'email'|'domain', value, reason?, source? }` | 201 + entry | Zod | 400 invalid format |
| DELETE | `/api/suppression/:id` | Header/query `customerId` | `{ success: true }` | — | 404 if not found or wrong customer |
| POST | `/api/suppression/check` | Body: `{ emails: string[] }` | `{ suppressedCount, suppressedEmails[], totalChecked }` | — | 400 |
| POST | `/api/suppression/import-csv` | Body: `{ entries: [{ email?, domain?, reason? }], sourceFileName? }` | `{ success, imported, duplicates, errors[] }` | Zod | 400 |

### 2.6 Email Accounts (Outlook)

| Method | Path | Request | Response | Validation | Errors |
|--------|------|---------|----------|------------|--------|
| GET | `/api/outlook/identities` | Query `customerId` | Identity list | — | — |
| POST | `/api/outlook/identities` | Body per implementation | 201 + identity | — | — |
| PATCH | `/api/outlook/identities/:id` | Body: partial identity | Identity | — | 404 |
| DELETE | `/api/outlook/identities/:id` | — | 200 | — | 404 |
| POST | `/api/outlook/identities/:id/test-send` | — | 200 | — | — |

Customer from query; backend must validate identity belongs to customer.

### 2.7 Templates

| Method | Path | Request | Response | Validation | Errors |
|--------|------|---------|----------|------------|--------|
| GET | `/api/templates` | Header/query `customerId` | `EmailTemplate[]` | — | 400 |
| POST | `/api/templates` | Body: `{ name, subjectTemplate, bodyTemplateHtml, bodyTemplateText?, stepNumber? }` | 201 + template | Zod | 400 |
| PATCH | `/api/templates/:id` | Body: partial | Template | — | 404 if wrong customer |
| DELETE | `/api/templates/:id` | — | 200 | — | 404 |

### 2.8 Campaigns (used by Sequences tab)

| Method | Path | Request | Response | Validation | Errors |
|--------|------|---------|----------|------------|--------|
| GET | `/api/campaigns` | Header/query `customerId` | Campaign[] (with senderIdentity, _count, etc.) | — | 400 |
| GET | `/api/campaigns/:id` | — | Campaign detail | — | 404 |
| POST | `/api/campaigns` | Body: create schema | 201 + campaign | Zod | 400 |
| PATCH | `/api/campaigns/:id` | Body: partial | Campaign | — | 404 |
| DELETE | `/api/campaigns/:id` | — | 200 | — | 404 |
| POST | `/api/campaigns/:id/templates` | Body: step templates | — | — | 404 |
| POST | `/api/campaigns/:id/prospects` | Body: `{ contactIds: string[] }` | — | — | 404 |
| POST | `/api/campaigns/:id/start` | — | 200 | — | 400/404 |
| POST | `/api/campaigns/:id/pause` | — | 200 | — | 400/404 |

All enforce `customerId` and campaign ownership.

### 2.9 Sequences

| Method | Path | Request | Response | Validation | Errors |
|--------|------|---------|----------|------------|--------|
| GET | `/api/sequences` | Header/query `customerId` | Sequence[] with steps | — | 400 |
| GET | `/api/sequences/:id` | — | Sequence + steps | — | 404 |
| POST | `/api/sequences` | Body: name, senderIdentityId, steps[] | 201 + sequence | Zod | 400 |
| PUT | `/api/sequences/:id` | Body: metadata | Sequence | — | 404 |
| DELETE | `/api/sequences/:id` | — | 200 | — | 404 |
| POST | `/api/sequences/:id/steps` | Body: step fields | 201 + step | — | 404 |
| PUT | `/api/sequences/:id/steps/:stepId` | Body: step fields | Step | — | 404 |
| DELETE | `/api/sequences/:id/steps/:stepId` | — | 200 | — | 404 |
| POST | `/api/sequences/:id/enroll` | Body: contactIds | — | — | 404 |

### 2.10 Lists

| Method | Path | Request | Response | Validation | Errors |
|--------|------|---------|----------|------------|--------|
| GET | `/api/lists` | **Query only today:** `customerId` | List[] with contactCount | — | 400 |
| GET | `/api/lists/:id` | — | List with members | — | 404 |
| POST | `/api/lists` | Body: `{ customerId, name, description? }` | 201 + list | Zod | 400 |
| PUT | `/api/lists/:id` | Body: name, description | List | — | 404 |
| DELETE | `/api/lists/:id` | — | 200 | — | 404 |
| POST | `/api/lists/:id/contacts` | Body: `{ contactIds: string[] }` | — | — | 404 |
| DELETE | `/api/lists/:id/contacts/:contactId` | — | 200 | — | 404 |

**Fix for Sunday:** Use `getCustomerId(req)` (header or query) in lists route; validate list ownership by customerId on every mutation; do not trust `customerId` from body for tenant (derive from request context).

### 2.11 Schedules

| Method | Path | Request | Response | Validation | Errors |
|--------|------|---------|----------|------------|--------|
| GET | `/api/schedules` | Header/query `customerId` | Array of schedule-like objects (from campaigns) | — | 400 |
| GET | `/api/schedules/emails` | — | Upcoming sends | — | — |
| POST | `/api/schedules/:id/pause` | — | `{ success, campaign }` | — | 404/400 |
| POST | `/api/schedules/:id/resume` | — | `{ success, campaign }` | — | 404/400 |
| GET | `/api/schedules/:id/stats` | — | Stats object | — | 404 |

**Note:** POST `/api/schedules` and PUT `/api/schedules/:id` and PATCH and DELETE reference `prisma.emailSendSchedule`, which does **not** exist in the current schema. For Sunday: either (a) treat Schedules as “campaign schedule view” only (list + pause/resume, no create/update/delete of a separate schedule entity), or (b) add a minimal `EmailSendSchedule` model and implement create/update/delete. Recommendation: (a) to avoid schema change; document that “Create schedule” in UI can show “Not available” or create a draft campaign instead.

### 2.12 Inbox

| Method | Path | Request | Response | Validation | Errors |
|--------|------|---------|----------|------------|--------|
| GET | `/api/inbox/replies` | Query: start, end, campaignId?, limit? | `{ range, items[] }` | — | 400 |
| GET | `/api/inbox/threads` | Query: limit?, offset? | Thread list | — | 400 |
| GET | `/api/inbox/threads/:threadId/messages` | — | Message[] | — | 404 |
| POST | `/api/inbox/threads/:threadId/reply` | Body: reply content | 200 | — | 404 |

All scoped by customer via senderIdentity / campaign relation.

**Fix for Sunday:** Inbox tab: when user selects a customer from dropdown, set `settingsStore.setCurrentCustomerId(selectedCustomerId)` before fetching threads/replies so header matches selection.

---

## 3. DB Layer

### 3.1 Existing Models (no schema change for Sunday)

- **Customer** — tenant root.
- **Contact**, **EmailIdentity**, **EmailCampaign**, **EmailCampaignTemplate**, **EmailCampaignProspect**, **EmailCampaignProspectStep**, **EmailEvent**, **EmailTemplate**, **EmailSequence**, **EmailSequenceStep**, **SequenceEnrollment**, **ContactList**, **ContactListMember**, **SuppressionEntry**, **EmailMessageMetadata**, **LeadRecord**, **LeadSyncState**, **SheetSourceConfig**, **ContactSourceRow** — all have `customerId` (or belong to a campaign/sequence/list that does).

### 3.2 Relationships and Indexes

- Existing indexes on `customerId` and compound (e.g. `customerId + status`) are sufficient for list/overview/reports.
- No new tables; no destructive migrations.

### 3.3 Migration Plan

- **None** for Sunday scope (additive-only). If lists route is fixed to use `getCustomerId(req)` only, no DB change.

### 3.4 Seed / Backfill

- None required for Marketing tab correctness.

---

## 4. Frontend Wiring

### 4.1 Component Tree

- **MarketingHomePage** → **SubNavigation** with items: Overview, Reports, People, Lead Sources, Compliance, Email Accounts, Templates, Sequences, Schedules, Inbox. Each item’s `content` is the corresponding tab component. No new top-level components.

### 4.2 State Management

- **Customer context:** `settingsStore.getCurrentCustomerId(...)`; when a tab has a customer dropdown, sync selection via `settingsStore.setCurrentCustomerId(selectedCustomerId)` before API calls that rely on header, OR pass `headers: { 'X-Customer-Id': selectedCustomerId }` on every request from that tab.
- **Per-tab state:** Existing pattern (useState for list, selected id, loading, error); no global Marketing store required.

### 4.3 API Client

- `src/utils/api.ts`: already adds `X-Customer-Id` from settings. For Reports and Inbox, ensure the **selected** customer is used (sync to store or override header).
- No new API client; optional small helper e.g. `api.getWithCustomer(endpoint, customerId)` that adds header override.

### 4.4 Loading / Error / Empty States

- **Overview:** Spinner then content or error alert; empty stats show 0.
- **Reports:** Loading while fetching; error alert; empty report (all zeros) is valid.
- **People:** Loading; error; empty state “No contacts yet” + primary action.
- **Lead Sources:** Loading; error; empty sources list with connect CTA.
- **Compliance:** Loading; error; empty “No suppression entries” + add/import.
- **Email Accounts:** Loading; error; empty “No accounts connected” + connect.
- **Templates:** Loading; error; empty “No templates” + create.
- **Sequences:** Loading; error; empty “No sequences” + create.
- **Schedules:** Loading; error; empty “No scheduled campaigns” (no create if we defer schedule entity).
- **Inbox:** Loading; error; empty “No threads” / “No replies”.

### 4.5 Tables / Lists / Forms

- Existing components already use Table/Card/Modal/Form; add explicit empty-state components where missing (text + optional button).

---

## 5. Error Codes and Validation

- **400** — Missing or invalid `customerId`; invalid body (Zod).
- **404** — Resource not found or not owned by customer.
- **409** — Conflict (e.g. duplicate email in contacts).
- Use same error shape as rest of app: `{ error: string, requestId?, details? }`.

---

## 6. Environment Variables

- No new env vars for Sunday. Existing: `DATABASE_URL`, Outlook client/secret, `ENABLE_EMAIL_SCHEDULER`, etc. If later we add tracking domain or UTM, add to `env.example` and Azure config.

---

*End of MARKETING_TAB_TECH_SPEC.md*
