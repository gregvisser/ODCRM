# MODE B Next Actions — Next 5 PRs (Concrete, Small, Sequential)

**Generated:** 2026-02-25  
**Rule:** Execute in order. Each PR is one concrete task; docs-only or code as specified.

---

## PR1 (docs): MODE B Stage 0 reality check and navigation contract — THIS PR

- **Scope:** Create/update docs only: `docs/product/NAVIGATION_CONTRACT.md`, `docs/build/MODE_B_REALITY_CHECK.md`, `docs/build/MODE_B_GAP_MATRIX.md`, `docs/build/MODE_B_ROADMAP.md`, `docs/build/MODE_B_NEXT_ACTIONS.md`.
- **Goal:** Repo-truth docs; shared contract for Cursor work; stop drift.
- **Verification:** Lint, tsc, server build (gates); no code changes.

---

## PR2: Rename remaining UI "Customer" → "Client" (labels only)

- **Scope:** User-visible text only: headings, placeholders, toasts, modal titles, buttons that say "Customer" or "Customers". Not backend, API, or internal types/vars (e.g. customerId).
- **Refs:** MODE_B_REALITY_CHECK §E (top 10 files); CustomerSelector, AccountsTab, ContactsTab, MarketingEmailTemplatesTab, ComplianceTab, EmailAccountsTab, CampaignsEnhancedTab, etc.
- **Verification:** Lint, tsc; manual smoke of Clients tab and client dropdowns.

---

## PR3: Backend requireTenant middleware rollout

- **Goal:** Central middleware: resolve tenant from x-customer-id (and documented query where applicable), validate tenant exists, attach to req; migrate tenant-scoped routes to use it.
- **Refs:** `server/src/index.ts` (mounts); `server/src/routes/*` (current per-handler customerId).
- **Deliverable:** requireTenant middleware; list of routes migrated; MODE_B_GAP_MATRIX updated.

---

## PR4: Resolve migration drift (Gate 0)

- **Goal:** Written plan + apply or document. `prisma migrate status` clean or documented.
- **Refs:** MODE_B_REALITY_CHECK §D; MODE_B_ROADMAP Gate 0.
- **Deliverable:** Plan in docs; migrate status output; MODE_B_REALITY_CHECK updated.

---

## PR5: Prospect Accounts entity + Contacts link + activity timeline stub

- **Goal:** Dedicated Prospect Account (company) model/table; Contacts linked to Prospect Accounts; activity timeline stub (table or API stub). Additive schema only.
- **Refs:** `server/prisma/schema.prisma`; NAVIGATION_CONTRACT; MODE_B_ROADMAP Stage 1.
- **Deliverable:** Migration(s); API stubs or minimal endpoints; docs updated.
