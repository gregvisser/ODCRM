# Templates – Full System Audit

**Date:** 2026-02-20  
**Scope:** Marketing → Templates tab and shared template usage in Sequences/Campaigns.  
**Goal:** Audit and harden Templates to be Sequences-ready (CRUD reliable, rendering rules defined, merge-field contract explicit and tenant-safe).  
**Rules:** DB is truth; tenant isolation via `x-customer-id`; additive-only migrations; no spreading `req.body` into Prisma (whitelist); no new template storage outside DB.

---

## 1. Feature Map

### 1.1 Marketing → Templates tab

| Area | Location | Purpose |
|------|----------|---------|
| **Route / entry** | Marketing home → subnav "Templates" (`view === 'templates'`) | `MarketingHomePage.tsx` renders `TemplatesTab` |
| **Component** | `src/tabs/marketing/components/TemplatesTab.tsx` | List, create/edit modal, preview modal, delete, duplicate, customer dropdown |
| **State** | React `useState`: templates, customers, selectedCustomerId, searchQuery, categoryFilter, loading, error, editingTemplate, previewingTemplate | No React Query; no shared template store for this tab |
| **Customer selection** | Dropdown from `/api/customers`; initial from `getCurrentCustomerId('prod-customer-1')` or first customer | All API calls send `X-Customer-Id: selectedCustomerId` |
| **List fetch** | `GET /api/templates` with header `X-Customer-Id: selectedCustomerId` | Backend filters by `customerId` |
| **Create** | Modal → `POST /api/templates` with payload (name, subjectTemplate, bodyTemplateHtml, bodyTemplateText, stepNumber) | Whitelisted; customerId from header |
| **Update** | Modal → `PATCH /api/templates/:id` (same payload shape) | Zod-validated; customer ownership checked |
| **Delete** | Menu → `DELETE /api/templates/:id` | 404 if template belongs to another customer |
| **Duplicate** | Menu → `POST /api/templates` with copied name + content | Uses `toHtmlBody(content)` — see Gaps (duplicate can corrupt HTML) |
| **Preview** | Modal shows subject + previewText + content as **plain text** (no API preview call) | No merge-field substitution in UI preview |
| **Favorites / Category / Tags** | UI-only; PATCH sends `isFavorite` but backend schema does not persist it | Favorites not persisted (zod strips unknown fields) |

### 1.2 Other template-consuming surfaces

| Surface | Location | How templates are sourced |
|---------|----------|---------------------------|
| **Sequences tab** | `src/tabs/marketing/components/SequencesTab.tsx` | `GET /api/templates` with `X-Customer-Id: selectedCustomerId`; templates used as step options |
| **Campaigns tab** | `src/tabs/marketing/components/CampaignsTab.tsx` | `GET /api/templates` (customer from `api.ts` default: `settingsStore.getCurrentCustomerId`) |
| **MarketingEmailTemplatesTab** | `src/components/MarketingEmailTemplatesTab.tsx` | `GET /api/templates?customerId=…&includeGlobal=true` (backend ignores `includeGlobal`) |
| **CampaignWizard** | `src/components/CampaignWizard.tsx` | **localStorage** via `getEmailTemplates()` from `platform/stores/emailTemplates` — not DB |
| **CampaignSequencesTab** | `src/components/CampaignSequencesTab.tsx` | **localStorage** via `emailTemplatesStore.ensureEmailTemplatesSeeded` / `setEmailTemplates` — not DB |

### 1.3 Backend rendering (sending)

| Consumer | File | Template source | Variables passed |
|----------|------|-----------------|------------------|
| **Campaign sender** | `server/src/workers/campaignSender.ts` | `EmailCampaign` → `sequence.steps[0]` (subject/body from step) | Contact: firstName, lastName, companyName, email, jobTitle, title, phone |
| **Email scheduler** | `server/src/workers/emailScheduler.ts` | `campaign.templates` (EmailCampaignTemplate) by stepNumber | Contact: firstName, lastName, companyName, email, jobTitle (no company alias, no phone) |

---

## 2. API Map

| Method | Endpoint | Auth / tenant | Request | Response |
|--------|----------|----------------|---------|----------|
| GET | `/api/templates` | `x-customer-id` or `query.customerId` required | — | `200` array of `EmailTemplate` |
| POST | `/api/templates` | Same | Body: `name`, `subjectTemplate`, `bodyTemplateHtml`, `bodyTemplateText?`, `stepNumber?` (zod) | `201` created template |
| PATCH | `/api/templates/:id` | Same; template must belong to customer | Body: same fields optional (zod); **no** isFavorite/category/tags in schema | `200` updated template or `404` |
| DELETE | `/api/templates/:id` | Same; template must belong to customer | — | `200` `{ success: true }` or `404` |
| POST | `/api/templates/preview` | **No** `x-customer-id` required | Body: `subject`, `body`, `variables?` | `200` `{ subject, body }` with placeholders applied |

**Examples**

```http
GET /api/templates
X-Customer-Id: cust_abc123
→ 200 [ { "id": "...", "customerId": "cust_abc123", "name": "...", "subjectTemplate": "...", "bodyTemplateHtml": "...", "bodyTemplateText": null, "stepNumber": 1, "createdAt": "...", "updatedAt": "..." } ]

POST /api/templates
X-Customer-Id: cust_abc123
Content-Type: application/json
{ "name": "Intro", "subjectTemplate": "Hi {{firstName}}", "bodyTemplateHtml": "<p>Hello {{firstName}}</p>", "bodyTemplateText": "Hello {{firstName}}", "stepNumber": 1 }
→ 201 { "id": "...", "customerId": "cust_abc123", ... }

PATCH /api/templates/:id
X-Customer-Id: cust_abc123
{ "name": "Intro (updated)" }
→ 200 updated template (only whitelisted fields applied; isFavorite/category/tags ignored)
```

---

## 3. Data Model Map

### 3.1 Prisma: `EmailTemplate`

| Field | Type | Notes |
|-------|------|--------|
| id | String (cuid) | PK |
| customerId | String | FK → Customer; tenant scope |
| name | String | |
| subjectTemplate | String | Merge fields: `{{firstName}}` etc. |
| bodyTemplateHtml | String | HTML allowed (no sanitization on save) |
| bodyTemplateText | String? | Plain-text variant |
| stepNumber | Int | Default 1 (organizational) |
| createdAt | DateTime | |
| updatedAt | DateTime | |

**Not in DB:** createdBy, category, tags, isFavorite, usageCount, previewText. These exist only in the frontend UI type in `TemplatesTab.tsx` and are defaulted when mapping from API.

### 3.2 Campaign/sequence steps (inline, not FK to EmailTemplate)

- **EmailCampaignTemplate** (per-campaign steps): subjectTemplate, bodyTemplateHtml, bodyTemplateText, stepNumber, delayDaysMin/Max.
- **EmailSequenceStep**: subjectTemplate, bodyTemplateHtml, bodyTemplateText, stepOrder, delayDaysFromPrevious.

Sequences and campaigns that use “template picker” in the UI may copy subject/body from an `EmailTemplate` into these step records; there is no foreign key from step → EmailTemplate.

---

## 4. Tenant Isolation Audit

| Check | Status | Notes |
|-------|--------|--------|
| GET list | ✅ | `prisma.emailTemplate.findMany({ where: { customerId } })` |
| POST create | ✅ | `customerId` from `getCustomerId(req)` only; not from body |
| PATCH update | ✅ | Load template by id; if `existing.customerId !== customerId` → 404 |
| DELETE | ✅ | Same ownership check → 404 if wrong customer |
| Preview POST | ⚠️ | No customerId required; no tenant audit trail |
| Prisma create/update | ✅ | No `...req.body`; zod schema + explicit field list / spread of parsed data only |

**Conclusion:** CRUD is tenant-safe. Preview is unauthenticated/unscoped and should be tightened for audit and safety (see Gaps).

---

## 5. Rendering / Variables Contract (Proposal)

- **Placeholder syntax:** `{{variableName}}` (single word, case-sensitive in current impl).
- **Current backend support** (`templateRenderer.ts`): `firstName`, `lastName`, `company`, `companyName`, `email`, `title`, `jobTitle`, `phone`. Aliases: company ↔ companyName, title ↔ jobTitle.
- **Missing in backend but documented in UI:** `senderName`, `senderEmail`, `fullName`, `contactName`, `accountName`. If used in templates, they appear literally in sent emails.
- **Source of values:** Contact (recipient) and, when added, EmailIdentity (sender) and Customer (account name). See TEMPLATES_CONTRACTS.md for canonical list and sources.
- **Missing value behavior:** `vars[key] ?? ''` — empty string.
- **Escaping:** No escaping in `applyTemplatePlaceholders`. Subject and body are replaced as-is; if variable value contained HTML/script, it would be injected. Recommendation: escape variable values for subject (always) and for HTML body when injecting into template (or restrict template to trusted HTML and escape only variable slots).

---

## 6. Failure-Mode Table

| Failure | Likelihood | Impact | Mitigation |
|---------|------------|--------|------------|
| Wrong customer sees templates | Low | High | Backend enforces customerId on all CRUD |
| Template list empty (wrong customer) | Medium | Medium | UI shows “select customer”; API returns [] |
| CampaignsTab loads templates for wrong customer | Low | Medium | api.ts injects global `X-Customer-Id`; ensure selected customer and global setting aligned |
| Duplicate corrupts HTML body | Medium | Medium | Duplicate uses `toHtmlBody(content)`; if content is HTML, it gets escaped → fix duplicate to use bodyTemplateHtml when present |
| Favorite/category/tags not persisted | High | Low | Backend ignores; UI shows but reload loses; add schema + migration if needed |
| Merge field not replaced (e.g. {{senderName}}) | High | Medium | Backend doesn’t support; add to templateRenderer + pass sender from identity |
| XSS in preview | Low | High | Preview API returns body with variables; if any caller renders as HTML without sanitization, risk; currently no such caller |
| localStorage template used in CampaignWizard/SequencesTab | High | High | Data not in DB; not tenant-scoped; migrate to API |

---

## 7. Definition of Done for Templates

- [ ] **CRUD:** All operations use DB only; no localStorage for business template data.
- [ ] **Tenant:** Every request that reads/writes templates has valid `x-customer-id` and server enforces it.
- [ ] **Whitelist:** No spreading `req.body` into Prisma; zod (or explicit pick) only.
- [ ] **Merge contract:** Canonical list of variables documented; backend supports all variables that UI/docs advertise; missing values and escaping rules defined.
- [ ] **Preview:** Preview endpoint (if used) requires or recommends customerId; variable values escaped when rendering into HTML context; no raw user input rendered as HTML in UI without sanitization.
- [ ] **Sequences-ready:** Sequences (and CampaignWizard) can select an `EmailTemplate` by id and use its subject/body (copy into step or reference); no refactor required when switching from inline steps to template picker.
- [ ] **Additive migrations only:** Any new columns (e.g. category, isFavorite) added via additive migration; no destructive changes.
- [ ] **Production parity:** Same routes and env in dev/prod; no feature flags that change template behavior.

---

**Next:** See `TEMPLATES_CONTRACTS.md` for interfaces and merge-field definitions, and `TEMPLATES_GAPS_AND_FIX_PLAN.md` for risks and PR-sized fixes.
