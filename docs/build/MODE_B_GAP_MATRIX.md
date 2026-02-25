# MODE B Gap Matrix — Best Practice vs Current vs Next

**Generated:** 2026-02-25  
**Purpose:** Repo-verified mapping for Navigation Contract. Columns: Best Practice | Current ODCRM (with references) | Gap | Stage (0–5) | Risk | Next Action.

---

| Best Practice | Current ODCRM (references) | Gap | Stage | Risk | Next Action |
|---------------|----------------------------|-----|-------|------|-------------|
| UI uses "Client(s)" for tenant; "Account/Company" for prospect companies only. Backend may keep "Customer". | Nav label "OpenDoors Customers" (`src/contracts/nav.ts`); many UIs say "Customer" / "Select customer". | Labels say Customer not Client; contract says Client. | 0 | Low | PR1: Rename UI Customer → Client (labels only). |
| Exactly one source of active client; API carries x-customer-id; no silent fallbacks (e.g. prod-customer-1). | **After PR2:** getCurrentCustomerId() returns `string \| null`; no default id written. api.ts only sets X-Customer-Id when getActiveClientId() is non-null. NoActiveClientEmptyState shown when no client selected. Regression: `npm run test:no-tenant-fallback` (scripts/self-test-no-tenant-fallback.mjs). | None for this invariant. | 0 | — | PR2 done. Keep test:no-tenant-fallback in CI. |
| Tenant-scoped endpoints resolve tenant from x-customer-id (primary) or documented query/body; validate tenant exists; row-level scoping. | Routes use header/query in handlers; no central requireTenant middleware; per-route patterns vary (`server/src/routes/*`). | No requireTenant middleware rollout; audit incomplete. | 0–1 | Medium | PR3: Backend requireTenant middleware rollout across all tenant routes. |
| CRM has Prospect Accounts (companies) + Contacts (people) + activity timeline. | Accounts/Contacts exist but model is mixed (prospect vs client); no dedicated Prospect Account entity; no activity timeline stub. | Prospect Accounts entity missing; timeline stub missing. | 1 | Medium | PR4: Create Prospect Accounts entity + link Contacts + add activity timeline stub. |
| Sequence steps support multi-channel (EMAIL, CALL, LINKEDIN, TASK, WAIT). | Steps are email-focused; no step type enum for multi-channel. | Multi-channel step types not designed. | 4 | Low | PR5: Multi-channel step types (EMAIL/CALL/LINKEDIN/TASK/WAIT) design + migration plan. |
| No ...req.body spread into Prisma writes; explicit whitelists. | customers.ts L2078: spread into Zod parse only; Prisma uses validated fields. | None. | 0 | — | Keep rule; reject new body spread into Prisma. |
| Mutation routes protected; admin/diag header auth only. | requireAuthForMutations on /api; admin/diag bypass; CORS allows X-Admin-Secret, X-Admin-Diag-Key. | None. | 0 | — | Optional: audit admin/diag routes for header checks. |
| All migrations applied; no destructive migrations without plan + backup. | Two migrations not applied (add_lead_source_applies_to, add_inbox_read_signature). `prisma migrate status` exit 1. | Migration drift. | 0 | High | Resolve migration drift (Gate 0) before schema work. |

---

## Stage mapping

- **Stage 0:** Foundations & guardrails — labels (Client), tenant fallback/empty-state, requireTenant rollout, migration drift, auth/tenant audit.
- **Stage 1:** CRM core (Prospects) — Prospect Accounts, Contacts, activity timeline.
- **Stage 2:** Outreach MVP — templates, sequences, enrollment, sending, replies (correctness + tenant scoping).
- **Stage 3:** Compliance & deliverability.
- **Stage 4:** Multi-channel step types.
- **Stage 5:** Packaging & billing.
