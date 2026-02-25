# MODE B Gap Matrix — Best Practice vs Current vs Next

**Generated:** 2026-02-25  
**Purpose:** Repo-verified mapping. Columns: Best Practice | Current ODCRM (refs) | Gap | Stage | Risk | Next Action.

---

| Best Practice | Current ODCRM (refs) | Gap | Stage | Risk | Next Action |
|---------------|----------------------|-----|-------|------|-------------|
| UI uses "Client(s)" for tenant; "Account/Company" for prospect companies only. Backend may keep "Customer". | Nav label "OpenDoors Clients" (`src/contracts/nav.ts` L19). Many UIs still say "Customer" (see MODE_B_REALITY_CHECK §E). | Labels in sub-views/placeholders still "Customer" in multiple files. | 0 | Low | PR: Rename remaining UI "Customer" → "Client" (labels only; not API/types). |
| Exactly one source of active client; API carries x-customer-id; no silent fallbacks. | getCurrentCustomerId() returns `string \| null` (`src/platform/stores/settings.ts`). api.ts sets X-Customer-Id only when getActiveClientId() non-null (`src/utils/api.ts` L76-77). NoActiveClientEmptyState when no client. | None for this invariant. | 0 | — | Keep; regression test if added. |
| Tenant-scoped endpoints resolve tenant from x-customer-id (primary) or documented query; validate tenant; row-level scoping. | Per-route patterns in `server/src/routes/*`; no central requireTenant middleware. | No requireTenant middleware; audit incomplete. | 0–1 | Medium | PR: Backend requireTenant middleware rollout. |
| CRM has Prospect Accounts + Contacts + activity timeline. | Accounts/Contacts exist; model mixed; no dedicated Prospect Account entity; no activity timeline stub. | Prospect Accounts entity missing; timeline stub missing. | 1 | Medium | PR: Prospect Accounts entity + link Contacts + activity timeline stub. |
| Sequence steps support multi-channel (EMAIL, CALL, LINKEDIN, TASK, WAIT). | Steps email-focused; no step type enum for multi-channel. | Multi-channel step types not designed. | 4 | Low | Design + migration plan only. |
| No req.body spread into Prisma writes; explicit whitelists. | customers.ts uses validated fields; no raw spread into Prisma. | None. | 0 | — | Keep rule. |
| Mutation routes protected; admin/diag header auth only. | requireAuthForMutations; admin/diag bypass; CORS allows X-Admin-Secret, X-Admin-Diag-Key. | None. | 0 | — | Optional: audit admin/diag. |
| All migrations applied; no destructive migrations without plan + backup. | Two migrations not applied (add_lead_source_applies_to, add_inbox_read_signature). DB has 2 migrations not in repo. `prisma migrate status` exit 1. | Migration drift. | 0 | High | Resolve migration drift (Gate 0) before schema work. |

---

## Stage mapping

- **Stage 0:** Foundations — labels (Client), tenant empty-state, requireTenant rollout, migration drift, auth/tenant audit.
- **Stage 1:** CRM core (Prospects) — Prospect Accounts, Contacts, activity timeline.
- **Stage 2:** Outreach MVP — templates, sequences, enrollment, sending, replies.
- **Stage 3:** Compliance & deliverability.
- **Stage 4:** Multi-channel step types.
- **Stage 5:** Packaging & billing.
