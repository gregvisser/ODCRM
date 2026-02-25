# MODE B Roadmap — Staged Plan (Gated by DoD)

**Generated:** 2026-02-25  
**Rule:** No feature work past Stage 0 until migration drift and auth/tenant invariants are documented and (where applicable) fixed.

---

## Gate 0: Migration drift (STOP condition)

**Current state:** `npx prisma migrate status --schema=./prisma/schema.prisma` (in server/) exits 1. Two migrations in repo not applied; two in DB not in repo (see MODE_B_REALITY_CHECK §D).

**Definition of Done:**
- Written plan: (a) apply repo migrations in dev/prod with backup, or (b) document which envs have which migrations.
- If applying: run `prisma migrate deploy` (or `migrate dev` in dev); capture success.
- `npx prisma migrate status --schema=./prisma/schema.prisma` shows schema up to date (or documented exception).
- No destructive migrations without explicit plan + backup.

---

## Gate 0b: Auth and tenant invariants (STOP condition)

**Definition of Done:**
- Every tenant-scoped query includes customerId (or workspaceId) in Prisma `where`.
- No `...req.body` spread into Prisma create/update; explicit whitelists only.
- All mutation routes protected except admin/diag; admin/diag use header auth only.
- No silent localStorage fallback for tenant; DB source of truth for business data.
- MODE_B_GAP_MATRIX lists each invariant with status and proof; any fail has next action in MODE_B_NEXT_ACTIONS.

---

## Stage 0: Foundations & guardrails

**Definition of Done:**
- MODE_B_REALITY_CHECK.md and NAVIGATION_CONTRACT.md updated on route/nav/env changes.
- Gate 0 (migration drift) satisfied.
- Gate 0b (auth/tenant invariants) documented and verified.
- Additive-only schema from here on; destructive migrations only with written plan + backup.
- MODE_B_NEXT_ACTIONS.md updated.

---

## Stage 1: CRM core (Prospects)

**Definition of Done:**
- Prospect Accounts entity + link to Contacts + activity timeline stub.
- Accounts/people/leads model aligned with schema and APIs.
- All tenant-scoped APIs use explicit customerId in `where`.
- No localStorage as source of truth for CRM entities.
- MODE_B_GAP_MATRIX updated.

---

## Stage 2: Outreach MVP

**Definition of Done:**
- Templates → sequences → enrollment → sending → replies: data flow and tenant scoping verified.
- No silent fallbacks; errors surfaced.
- E2E path documented; tenant scoping verified per route.

---

## Stage 3: Compliance & deliverability

**Definition of Done:**
- Suppression, bounces, consent where applicable.
- Additive schema only.

---

## Stage 4: Multi-channel step types

**Definition of Done:**
- Multi-channel step types (EMAIL/CALL/LINKEDIN/TASK/WAIT) design + migration plan.
- Extend sequence/step model if needed; additive only.

---

## Stage 5: Packaging & billing

**Definition of Done:**
- Billing, limits, observability as needed.

---

## Gating summary

| Gate | Status | Blocker |
|------|--------|--------|
| Gate 0 (migration drift) | OPEN | 2 repo migrations not applied; 2 DB migrations not in repo |
| Gate 0b (auth/tenant invariants) | OPEN | Not yet fully audited and documented |
| Stage 0 | Blocked | Gates 0 and 0b |
| Stages 1–5 | Not started | Stage 0 |
