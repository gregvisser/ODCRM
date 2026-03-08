# ODCRM Lead Sync Transition Plan

## Transition Principle
Keep current sheet-backed clients operational while incrementally moving authoritative lead operations into ODCRM.

## Stage 0 (Current Stabilized Baseline)
- Enforced mode selection:
  - sheet-backed => sheet truth via backend ingestion
  - non-sheet-backed => DB truth
- Actionable failures for URL/access/format mismatch.
- Stale fallback is diagnostic-only.

## Stage 1 (Dual-Path Hardening)
- Introduce explicit per-client lead-mode metadata used consistently across UI and backend responses.
- Standardize URL normalization and fetch diagnostics for all sheet-backed clients.
- Add per-client sync heartbeat and freshness timestamps exposed in UI.

## Stage 2 (ODCRM Native Write Path)
- Add controlled lead mutations in ODCRM (status/owner/notes/lifecycle) for transition-enabled clients.
- Keep ingestion from sheets active where still configured.
- Mark field-level provenance and last-write source.

## Stage 3 (Conflict-Aware Reconciliation)
- Implement deterministic conflict rules for ODCRM edits vs incoming sheet changes.
- Store reconciliation outcomes and expose operator review for conflicts.

## Stage 4 (Sheet as Export/Integration)
- Default new clients to ODCRM-native lead truth.
- Keep optional sheet exports (manual + scheduled).
- Decommission legacy sheet-first assumptions per client only after verified parity window.

## Guardrails Through All Stages
- Tenant scoping via `X-Customer-Id`.
- No silent fallback to first client.
- No stale cache as authoritative truth.
- Backward compatibility per client until migration flag flips.
