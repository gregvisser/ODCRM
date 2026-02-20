# Templates – Gaps and Fix Plan

**Date:** 2026-02-20  
**Purpose:** Ranked risks (P0/P1/P2), PR-sized incremental fix plan, verification steps, rollback strategy, and logging (no PII).

---

## 1. Risks Ranked

### P0 (tenant hole, Prisma body spread, XSS in preview)

| # | Risk | Location | Notes |
|---|------|----------|--------|
| 1 | **Preview API: no tenant + unsanitized HTML** | `POST /api/templates/preview` | No `x-customer-id`; if response body is ever rendered as HTML (e.g. in a future UI), user-controlled variables could inject script. **Mitigation:** Require or accept customerId for audit; escape variable values when rendering into HTML in preview. |
| 2 | **Merge fields advertised in UI not implemented** | CampaignWizard, CampaignSequencesTab, MarketingEmailTemplatesTab, CampaignDetail | `{{senderName}}`, `{{contactName}}`, `{{accountName}}`, `{{fullName}}` appear in UI/docs but `templateRenderer` does not replace them → literal text in sent emails. **Mitigation:** Add variables to templateRenderer and pass sender/contact/account; or remove from UI until implemented. |

**Note:** Prisma usage is already whitelisted (zod parse → spread of parsed object only). No P0 for body spread.

### P1 (data integrity, UX, Sequences-ready)

| # | Risk | Location | Notes |
|---|------|----------|--------|
| 3 | **Template storage outside DB** | CampaignWizard, CampaignSequencesTab | Use localStorage (`emailTemplatesStore`); not tenant-scoped; not backed up. **Mitigation:** Migrate to GET/POST/PATCH/DELETE templates API with `X-Customer-Id`; remove or deprecate localStorage for templates. |
| 4 | **Duplicate corrupts HTML** | TemplatesTab `handleDuplicateTemplate` | Uses `toHtmlBody(template.content)`; when `content` is `bodyTemplateHtml`, HTML is escaped and duplicated template is wrong. **Mitigation:** Use `bodyTemplateHtml` when present for duplicate payload. |
| 5 | **Favorites/category/tags not persisted** | TemplatesTab, backend schema | UI shows category, tags, isFavorite; PATCH sends them but backend ignores. **Mitigation:** Additive migration + schema fields + API contract if product needs them. |
| 6 | **emailScheduler variables incomplete** | emailScheduler.ts | Does not pass `company`, `title`, `phone`; templateRenderer fallbacks help for company/title but not phone. **Mitigation:** Pass full TemplateVariables shape (contact + optional sender) in scheduler and campaignSender. |

### P2 (consistency, observability)

| # | Risk | Location | Notes |
|---|------|----------|--------|
| 7 | **CampaignsTab templates without explicit customer** | CampaignsTab | Relies on api default `X-Customer-Id` from settingsStore; if user switches customer elsewhere, list can be stale. **Mitigation:** Pass explicit `X-Customer-Id` from tab’s selected customer when available. |
| 8 | **Preview not used in Templates tab** | TemplatesTab | Preview modal shows raw content; no merge-field substitution. **Mitigation:** Optional: call preview API with sample variables and show rendered subject/body (with safe HTML rendering). |
| 9 | **includeGlobal ignored** | MarketingEmailTemplatesTab | Requests `includeGlobal=true`; backend ignores. **Mitigation:** Either implement global templates (additive) or remove param from frontend. |
| 10 | **Structured error responses** | templates.ts | Validation/400 often goes through generic error handler. **Mitigation:** Return 400 with `{ "error": "...", "details": ... }` for zod and missing customerId. |

---

## 2. PR-Sized Incremental Fix Plan

### PR1 – P0: Preview API safety (small, safe) — IMPLEMENTED 2026-02-20

- **Scope:** `server/src/routes/templates.ts` (preview handler) and `server/src/services/templateRenderer.ts`.
- **Changes (done):**
  1. Accept optional `x-customer-id` (or query `customerId`) for preview; log "customerId present" when set (no PII in log).
  2. Preview handler now uses `applyTemplatePlaceholdersSafe()` which escapes all variable values via `escapeForHtml()` before substitution, so preview response is safe to render as HTML.
- **Tests:** Unit test: preview with `variables` containing `<script>` → escaped in output.
- **Verification:** POST /api/templates/preview with malicious variables; assert no raw `<script>` in JSON body.

### PR2 – P0/P1: Merge fields (Sequences-ready)

- **Scope:** `server/src/services/templateRenderer.ts`; `server/src/workers/campaignSender.ts`; `server/src/workers/emailScheduler.ts`.
- **Changes:**
  1. Extend `TemplateVariables` and `PLACEHOLDER_KEYS` with: `senderName`, `senderEmail`, `fullName`, `contactName`, `accountName`.
  2. In campaignSender: build fullName from contact; pass sender displayName and email from identity; pass accountName from contact.companyName (or campaign.customer.name if needed).
  3. In emailScheduler: same variable shape; resolve sender from campaign’s senderIdentityId and contact/customer for rest.
  4. Add alias: `contactName` → fullName, `accountName` → companyName (or customer name) in renderer.
- **Tests:** Unit tests for new placeholders and aliases; integration: send one campaign step and assert subject/body contain replaced values.
- **Verification:** Create template with {{senderName}}, {{contactName}}, {{accountName}}; run sequence/campaign; check sent email.

### PR3 – P1: Duplicate template fix

- **Scope:** `src/tabs/marketing/components/TemplatesTab.tsx`.
- **Changes:** In `handleDuplicateTemplate`, set `bodyTemplateHtml` from `template.bodyTemplateHtml` when available (from API response mapping), and `bodyTemplateText` from `template.bodyTemplateText` or `template.content`; avoid passing HTML through `toHtmlBody()`.
- **Verification:** Create template with rich HTML; duplicate; edit duplicate and confirm HTML intact.

### PR4 – P1: Migrate CampaignWizard/CampaignSequencesTab to API

- **Scope:** `src/components/CampaignWizard.tsx`, `src/components/CampaignSequencesTab.tsx`, and any shared template type.
- **Changes:**
  1. Replace `getEmailTemplates()` / `emailTemplatesStore` with `api.get('/api/templates', { headers: { 'X-Customer-Id': customerId } })`. Ensure customerId is available in both flows (e.g. from context or selected customer).
  2. Create/update/delete templates via API instead of localStorage. Remove or deprecate writes to `emailTemplates` in these components.
  3. Keep `emailTemplates` store only for legacy read during migration if needed; document removal once all consumers use API.
- **Verification:** Create template in Templates tab; open CampaignWizard/SequencesTab with same customer; confirm template appears; create campaign/sequence using it; confirm no localStorage dependency for templates.

### PR5 – P1/P2: emailScheduler full variables + CampaignsTab explicit customer

- **Scope:** `server/src/workers/emailScheduler.ts`; `src/tabs/marketing/components/CampaignsTab.tsx`.
- **Changes:** Scheduler: pass `company`, `title`, `phone` in variables (and sender/account if not done in PR2). CampaignsTab: pass explicit `X-Customer-Id` from tab state when loading templates (if tab has selected customer).
- **Verification:** Template with {{phone}} in body; run scheduler; check sent email. CampaignsTab: switch customer; confirm template list matches.

### PR6 – P2: Error shapes and optional favorites/category (additive)

- **Scope:** `server/src/routes/templates.ts`; optionally Prisma schema + migration.
- **Changes:** Return 400 with structured body for missing customerId and zod validation. If product wants favorites/category/tags: additive migration, extend create/update schema and Prisma, then API.
- **Verification:** Send invalid payload; assert 400 and JSON error shape. If schema extended: create template with category; GET and assert persisted.

---

## 3. Verification Steps per PR

| PR | Step |
|----|------|
| PR1 | 1) Unit test preview escape. 2) Manual: POST preview with `variables: { firstName: '<script>alert(1)</script>' }` → body contains escaped string, not script. |
| PR2 | 1) Unit test new placeholders. 2) Create sequence/campaign with template using senderName/contactName/accountName; send; inspect email. |
| PR3 | 1) Create template with HTML (e.g. `<p>Hi</p>`); duplicate; open duplicate and confirm HTML. |
| PR4 | 1) Templates tab create template. 2) CampaignWizard load templates for same customer; select template; save campaign. 3) No localStorage key for templates required. |
| PR5 | 1) Scheduler: template with {{phone}}; send; check body. 2) CampaignsTab: two customers, each with templates; switch customer; list updates. |
| PR6 | 1) Invalid POST/PATCH → 400 + JSON. 2) If schema: create with category; GET; PATCH category; GET again. |

---

## 4. Rollback Strategy

- **PR1–2 (backend):** Revert deploy; templates table unchanged. No data rollback.
- **PR3 (frontend):** Revert; duplicate behavior back to current (possible HTML corruption).
- **PR4 (frontend):** Revert; CampaignWizard/SequencesTab again use localStorage; ensure no migration deleted localStorage keys (we only stop writing).
- **PR5–6:** Revert as above; scheduler and CampaignsTab back to previous behavior.

No destructive migrations in this plan; rollback is code-only.

---

## 5. Logging Plan (No PII)

- **Templates CRUD:** Already log e.g. `[templates] GET / - Customer ${customerId}: ${templates.length} templates`. Keep; no email/name/body.
- **Preview:** If customerId added, log `[templates] POST /preview - customerId present: true|false` (do not log value if PII policy forbids; or log hashed/customerId only).
- **Errors:** Log `error.message` and route name; do not log request body or template content.
- **Sending (campaignSender / emailScheduler):** Existing logs; avoid logging recipient email or template body. Log template id / step number only if needed.

---

## 6. Summary: Top 5 Risks

1. **Preview API** — No tenant scope; variable values not escaped for HTML → potential XSS if preview response is ever rendered as HTML.
2. **Advertised merge fields not implemented** — senderName, contactName, accountName, fullName shown in UI but not replaced → broken experience and literal placeholders in emails.
3. **Template data in localStorage** — CampaignWizard and CampaignSequencesTab use localStorage; not tenant-scoped, not durable, not Sequences-ready.
4. **Duplicate corrupts HTML** — Duplicate uses plain-text path and escapes HTML; duplicated template loses formatting.
5. **Incomplete variables in emailScheduler** — company/title/phone not passed; template with {{phone}} or {{company}} may render empty.

---

## 7. Exact Next PR Steps (1–3)

1. **PR1 (P0):** Harden preview: optional `x-customer-id`, escape variable values in preview response (subject + body). Add unit test. Merge first.
2. **PR2 (P0/P1):** Add senderName, senderEmail, fullName, contactName, accountName to templateRenderer and pass them in campaignSender and emailScheduler from Contact + EmailIdentity + Customer. Add tests and manual send check.
3. **PR3 (P1):** Fix duplicate in TemplatesTab: use bodyTemplateHtml when present; avoid toHtmlBody(html). Verify with HTML template.

---

## 8. What to Verify in Production

- After PR1: Call `POST /api/templates/preview` with variables containing `<script>`; confirm response body contains escaped text only.
- After PR2: Send a sequence/campaign email that uses {{senderName}} and {{contactName}}; confirm correct values in received email.
- After PR3: Duplicate a template that has HTML; open duplicate and confirm HTML is preserved.
- General: Create/edit/delete template under customer A; switch to customer B; confirm list is empty or B’s templates only. No cross-tenant visibility.
