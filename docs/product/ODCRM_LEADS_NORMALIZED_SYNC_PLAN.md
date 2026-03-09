# ODCRM Leads Normalized Sync Plan

## Current gap summary
- Sheet-backed clients still depend on raw sheet fetch behavior in some surfaces.
- Normalized lead storage exists, but canonical field contract and sync observability were incomplete for bidirectional transition readiness.
- UI column behavior could still surface empty columns when raw sheet keys are present but blank.

## Target architecture
`Google Sheets <-> Sync Layer <-> Normalized LeadRecord (ODCRM DB) <-> Dashboard / Customers Leads / Reports`

- Reads inside ODCRM come from normalized DB lead records.
- Sheet-backed clients keep Google Sheets as supported external source via inbound sync.
- Sync metadata is explicit (status, inbound/outbound timestamps, last error).
- UI receives clean display metadata (visible columns only) from backend contracts.

## Canonical field contract

### Required canonical fields
- `occurredAt`
- `source`
- `owner`

### Optional canonical fields
- `externalId`
- `firstName`
- `lastName`
- `fullName`
- `email`
- `phone`
- `company`
- `jobTitle`
- `location`
- `status`
- `notes`

### Header normalization
- Headers are normalized by trim + lowercase + punctuation removal.
- Alias matching supports common variants (for example `Channel of Lead`, `OD Team Member`, `Lead Date`, `Job Title`, `Email Address`).
- Row fingerprint is deterministic from normalized key/value pairs + customer/source context.

## Timezone and date window rules
- Metrics timezone: `LEADS_METRICS_TIMEZONE` (default `Europe/London`).
- `today`: local midnight to next local midnight in metrics timezone.
- `week`: Monday 00:00 to next Monday 00:00 in metrics timezone.
- `month`: first day 00:00 to first day of next month 00:00 in metrics timezone.
- Missing `occurredAt` falls back to record `createdAt` for counts.

## Empty-column visibility rule
- Backend computes `displayColumns` from normalized row payload.
- A column is included only if at least one visible row has non-empty (non-null, non-blank) value.
- Frontend uses backend `displayColumns` when provided; fallback local derivation remains for compatibility.

## Conflict policy proposal (transition)
- Stage 1: inbound sheet sync is authoritative for sheet-backed external updates; ODCRM stores normalized mirror.
- Stage 2: UI writes to ODCRM first, then outbound sheet sync with explicit status/error per row.
- Stage 3: deterministic conflict policy:
  - prefer most recent write timestamp when same field edited in both systems,
  - preserve losing value in audit trail,
  - mark conflict status for operator review when timestamps are too close or ambiguity exists.

## Rollout stages

### Stage 1 (this PR)
- Extend normalized lead model for canonical fields + sync metadata.
- Implement canonical mapping contract and deterministic row fingerprint.
- Inbound importer upserts normalized records for sheet-backed clients.
- Live leads/metrics read from normalized DB records.
- Add backend `displayColumns` contract with empty-column suppression.

### Stage 2
- Add/edit lead from UI writes to normalized ODCRM model.
- Outbound sync pipeline to Google Sheets for sheet-backed clients.
- Inbound/outbound error surfaces + retry controls.

### Stage 3
- Full bidirectional conflict handling + audit trail UX.
- Scheduling and reconciliation jobs with operator controls.
- Optional per-client sync policy tuning and SLA dashboards.
