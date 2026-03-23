# Cognism Operator Flow Hardening (2026-03-23)

## Issues found
- Cognism could appear "ready" even when provider mode was not native API.
- Import success toast did not clearly distinguish empty-result imports.
- Contacts review empty/loading copy was not explicit enough for operators.
- "Use in sequence" could be clicked without a clear guardrail when count was zero.

## Hardening shipped
- Added explicit Cognism mode truth check before showing ready status.
- Added clear empty-result import message when Cognism returns zero contacts.
- Added last-import summary details on source cards (time + returned/new counts).
- Tightened contacts review loading and empty messaging around imported contacts.
- Added zero-count guardrail toast before sending a batch into sequence flow.

## Deferred intentionally
- No architecture changes to import/materialize backend flow.
- No provider expansion beyond Cognism.
- No schema or migration changes.
