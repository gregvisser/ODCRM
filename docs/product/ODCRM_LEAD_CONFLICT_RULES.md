# ODCRM Lead Conflict Rules (Transition)

## Conflict Dimensions
- Same client + same logical lead identity changed in two places within overlap window:
  - ODCRM mutation path
  - incoming sheet sync path

## Proposed Deterministic Rules
1. Identity precedence:
  - use strongest key available (external id/email+company/date tuple fallback only when necessary).
2. Field-level conflict handling:
  - operational fields (status, owner, lifecycle): prefer ODCRM edit when newer.
  - source metadata fields (raw source columns): prefer latest successful ingest.
3. Timestamp rule:
  - compare normalized server-side timestamps; reject client clock assumptions.
4. Unresolvable conflicts:
  - mark as `manual_review_required` and keep both values in conflict payload.

## Operator Visibility Requirements
- Show conflict count in readiness/exception surfaces.
- Provide per-lead conflict detail with proposed resolution.
- Record final resolution actor and timestamp.

## Out-of-Scope in Current Cycle
- Automatic bidirectional real-time sync with no conflict queue.
- Silent overwrite of unresolved conflicts.
