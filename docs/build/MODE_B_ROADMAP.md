# MODE B Roadmap — Staged Plan (Gated by DoD)

**Generated:** 2026-02-25  
**Rule:** No feature work past Stage 0 until migration drift and auth/tenant invariants are documented and (where applicable) fixed. Do not "just fix" without writing the invariant and how it was verified.

---

## Gate 0: Migration drift (STOP condition)

**Current state:** Two migrations exist in repo but are **not applied** to the connected DB:

- `20260220140000_add_lead_source_applies_to`
- `20260222120000_add_inbox_read_signature`

**Definition of done:**

1. Written plan: either (a) apply these in dev and production with backup strategy, or (b) declare them optional and document which environments have them.
2. If applying: run `prisma migrate deploy` (or `migrate dev` in dev) and capture success output.
3. `npx prisma migrate status --schema=./prisma/schema.prisma` shows "Database schema is up to date" (or equivalent).
4. No destructive migrations without an explicit written plan + backup.

**Until Gate 0 is satisfied:** No schema-dependent feature work. Update MODE_B_REALITY_CHECK.md after any migration change.

---

## Gate 0b: Auth and tenant invariants (STOP condition)

**Invariants to enforce and document:**

1. **Tenant isolation:** Every tenant-scoped query MUST include customerId/workspaceId in the Prisma `where` clause. No cross-tenant reads/writes.
2. **No req.body spread:** No `...req.body` (or equivalent) spread into Prisma create/update. Use explicit whitelists.
3. **Mutation auth:** All mutation routes (POST/PUT/PATCH/DELETE) are protected except admin/diag; admin/diag use header-based auth only; no accidental bypass.
4. **DB as source of truth:** No "magic" localStorage fallbacks that silently select tenant/customer for business data. (UI preference for "current customer" is allowed; business data must come from DB.)

**Definition of done:**

1. MODE_B_GAP_MATRIX.md lists each invariant, current status (pass/fail/unknown), and proof (file:line or command output).
2. Any fail or unknown has a "next action" in MODE_B_NEXT_ACTIONS.md.
3. No new code that violates these invariants.

---

## Stage 0: Foundations & guardrails

- Harden drift-proofing: keep MODE_B_REALITY_CHECK.md updated on route/nav/env changes.
- Resolve migration drift (Gate 0).
- Document and verify auth + tenant invariants (Gate 0b).
- Additive-only schema from here on; destructive migrations only with written plan + backup.

**Exit criteria:** Gates 0 and 0b satisfied; MODE_B_NEXT_ACTIONS.md updated.

---

## Stage 1: CRM core (Prospects)

- Prospect Accounts entity + link Contacts + activity timeline stub.
- Accounts / people / leads canonical model aligned with schema and APIs.
- All tenant-scoped APIs use explicit customerId (or workspaceId) in `where`.
- No localStorage as source of truth for CRM entities.

**Exit criteria:** All Stage 1 APIs pass tenant-isolation audit; MODE_B_GAP_MATRIX updated.

---

## Stage 2: Outreach MVP

- Templates → sequences → enrollment → sending → replies: data flow and tenant scoping verified.
- No silent fallbacks; errors surfaced.

**Exit criteria:** E2E path documented; tenant scoping verified per route.

---

## Stage 3: Compliance & deliverability

- Suppression, bounces, consent where applicable.
- Additive schema only.

---

## Stage 4: Multi-channel step types

- Multi-channel step types (EMAIL/CALL/LINKEDIN/TASK/WAIT) design + migration.
- Extend sequence/step model if needed; additive only.

---

## Stage 5: Packaging & billing

- Billing, limits, observability as needed.

---

## Gating summary

| Gate | Status | Blocker |
|------|--------|--------|
| Gate 0 (migration drift) | OPEN | 2 migrations not applied |
| Gate 0b (auth/tenant invariants) | OPEN | Not yet audited and documented |
| Stage 0 | Blocked | Gates 0 and 0b |
| Stages 1–5 | Not started | Stage 0 |

**Next:** Complete MODE_B_GAP_MATRIX.md and MODE_B_NEXT_ACTIONS.md; then execute next actions for Gate 0 and Gate 0b.
