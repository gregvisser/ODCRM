# MODE B Next Actions — Next 5 PRs (Concrete Tasks)

**Generated:** 2026-02-25  
**Rule:** Execute in order. Each PR is a concrete task. PR1 (UI rename Customer → Client) is done in this run (commit 2).

---

## PR1: Rename UI "Customer(s)" → "Client(s)" (labels only) — DONE THIS RUN

- **Scope:** Navigation tab label, headings, buttons, placeholders, toasts, modal titles, and any other user-visible text that says "Customer" or "Customers". 
- **Out of scope:** Backend routes, Prisma model names, API contracts, internal types/variable names (e.g. `customerId`, `selectedCustomerId`).
- **Files (examples):** `src/contracts/nav.ts` (tab label), `src/tabs/customers/CustomersHomePage.tsx` (title), `src/components/CustomersManagementTab.tsx` (headings, modals, toasts), Marketing sub-tabs (placeholders "Select customer" → "Select client"), Onboarding/ProgressTracker (labels), etc.
- **Verification:** `npm run lint`, `npx tsc --noEmit`; manual smoke test of Clients tab and client dropdowns.

---

## PR2: Remove silent tenant fallback(s) + add explicit empty-state UX when no active client selected

- **Goal:** No silent fallback to `prod-customer-1`. When no client is selected, show explicit empty state (e.g. "Select a client" or "No client selected") and do not send arbitrary tenant id.
- **References:** `src/utils/api.ts` L5–9, L49 (getCurrentCustomerId('prod-customer-1')); `src/platform/stores/settings.ts`.
- **Deliverable:** Remove or gate fallback; add UX when `currentCustomerId` is missing so user must choose a client before tenant-scoped actions.

---

## PR3: Backend requireTenant middleware rollout across all tenant routes

- **Goal:** Central middleware that resolves tenant from `x-customer-id` (and documented query where applicable), validates tenant exists, attaches to `req`; all tenant-scoped routes use it. No ad-hoc header reads in handlers.
- **References:** `server/src/index.ts` (mounts); `server/src/routes/*` (current per-handler customerId resolution).
- **Deliverable:** requireTenant middleware; list of routes migrated; MODE_B_GAP_MATRIX updated.

---

## PR4: Create Prospect Accounts entity + link Contacts + add activity timeline stub

- **Goal:** Dedicated Prospect Account (company) model/table; Contacts linked to Prospect Accounts; activity timeline stub (e.g. table or API stub) for future events. Additive schema only.
- **References:** `server/prisma/schema.prisma` (Customer, Contact, etc.); NAVIGATION_CONTRACT (Prospects = People + Companies + Lists + Activity).
- **Deliverable:** Migration(s); API stubs or minimal endpoints; MODE_B_REALITY_CHECK updated.

---

## PR5: Multi-channel step types (EMAIL/CALL/LINKEDIN/TASK/WAIT) design + migration plan

- **Goal:** Design step type enum (or equivalent) for sequence steps: EMAIL, CALL, LINKEDIN, TASK, WAIT. Write migration plan (additive only); no implementation in this PR.
- **References:** `server/prisma/schema.prisma` (EmailSequenceStep, etc.); MODE_B_ROADMAP Stage 4.
- **Deliverable:** Design doc + migration plan in docs/build or docs/product.
