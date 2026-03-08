# ODCRM Lead Implementation Stages

## Priority-Ordered Stage Plan

## Stage A — Contract Consolidation (Next safest slice)
- Normalize one shared source-of-truth contract payload for lead/list/reporting surfaces.
- Ensure every relevant response includes:
  - `sourceOfTruth`
  - `authoritative`
  - `dataFreshness`
  - `hint/errorCode` on failure.
- Expand runtime proofs for all top lead/reporting touchpoints.

## Stage B — First-Class Lead Field Contract
- Define canonical lead field map (current sheet headers -> canonical ODCRM fields).
- Add explicit unknown/unmapped field handling and diagnostics.
- Keep current no-migration rule unless a dedicated migration slice is approved.

## Stage C — Controlled ODCRM Mutations
- Enable narrowly-scoped ODCRM lead updates under tenant-safe routes.
- Preserve sheet-backed ingestion behavior during transition.
- Expose mutation provenance for auditability.

## Stage D — Conflict Rules + Operator Review
- Apply deterministic conflict resolution policy.
- Add conflict queue/review UI for unresolved collisions.

## Stage E — Migration/Cutover Readiness
- Per-client cutover checklist:
  - data parity
  - sync health
  - operator acceptance
  - reporting equivalence
- Flip clients to ODCRM-native truth only after checklist pass.

## Suggested PR Slicing Strategy
1. Contract consolidation + proofs only.
2. Canonical field contract + diagnostics.
3. Controlled mutations + audit metadata.
4. Conflict workflow.
5. Per-client cutover tooling.
