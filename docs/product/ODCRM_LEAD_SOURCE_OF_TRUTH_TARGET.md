# ODCRM Lead Source-of-Truth Target

## Target Product Direction
ODCRM should become the operational source of truth for first-class leads, with Google Sheets as import/export and transition compatibility channels.

## Target Model
- Lead ownership: per client in ODCRM.
- Lead entity: first-class ODCRM record with canonical fields currently represented across sheet headers.
- Operational actions (statusing, assignment, lifecycle changes): ODCRM-native.
- Google Sheets role:
  - transition phase: ingestion + compatibility + optional back-sync where safe
  - steady-state: manual/scheduled export targets and controlled integration inputs

## Target Truth Rules (Future)
1. Default authoritative truth for leads = ODCRM DB.
2. External sheet updates are ingested into ODCRM through explicit sync contracts.
3. External outputs are generated from ODCRM to configured sheets on defined schedules/manual triggers.
4. No surface should infer truth from stale local cache.

## Non-Goals for Near-Term Slice
- No immediate full migration of all sheet-backed flows in one cut.
- No unsafe direct frontend-to-sheet credential model.
- No breaking tenant-scoped client behavior.

## Required Capabilities Before Final Cutover
- Canonical lead schema and mapping contract.
- Deterministic merge/conflict policy.
- Observable sync status and per-client health.
- Clear operator UI messaging for freshness and conflict outcomes.
