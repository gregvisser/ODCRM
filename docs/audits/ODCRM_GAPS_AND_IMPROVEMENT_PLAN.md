# ODCRM Gaps And Improvement Plan

Date: 2026-03-14
Audit base SHA: `1c268db4fc9940bd8daff13a917e1225271db74b`

## Ranked Defects And Discrepancies

| Item | Tag | Severity | Why it matters | Recommended fix |
| --- | --- | --- | --- | --- |
| Lead truth split across sync/import/live-read paths | bug | critical | Repeated real production count bugs prove this area can still drift | Unify sheet-row classification + normalization contract |
| Sheet sync runtime can degrade into stale/failing while counts remain usable | wiring mismatch | high | Operators lose trust in lead data health | Harden sync transactions and status model |
| Frontend customer scope is duplicated across tabs | wiring mismatch | high | Root cause class for header mismatch regressions | Standardize one customer-scope pattern |
| Accounts relies on local compatibility mirrors for some metrics | architectural debt | high | DB truth and browser truth can diverge | Remove local mirrors where backend/live truth exists |
| SequencesTab is too large and mixes authoring with diagnostics and admin controls | operator UX issue | high | Core send workflow feels harder than it is | Split sequence authoring from operations panels |
| AccountsTab is too large and still carries compatibility-era logic | architectural debt | medium | High regression risk in core CRM surface | Decompose around truth-path boundaries |
| Readiness and onboarding overlap conceptually | operator UX issue | medium | Operators need tribal knowledge for next actions | Create one activation/readiness contract |
| Reports can silently degrade some metrics to zero | bug | medium | Reporting can look more trustworthy than it is | Surface degraded metric state explicitly |
| Inbox backend groups a large message set in memory | architectural debt | medium | Daily ops surface will get slower/noisier | Add better server-side pagination/windowing |
| Workflow/env naming still leaks old concepts | operator UX issue | low | Adds operational confusion | Clean stale labels without changing behavior |

## Ranked Product Improvements

1. One explicit client-scoping model across the app.
2. One operator-grade readiness/health model across onboarding and marketing.
3. Cleaner distinction between CRM truth, live leads truth, and source-sheet diagnostics.
4. Better reports product model for daily operator use.
5. Cleaner send workflow separation between authoring, testing, launch, and diagnostics.

## Ranked UX Improvements

1. Simplify Sequences into authoring vs operations vs diagnostics.
2. Make readiness less diagnostic-heavy and more action-first.
3. Improve source-sheet health messaging in Lead Sources and live leads.
4. Improve inbox filtering and thread handling.
5. Remove remaining confusing compatibility-era account behaviors.

## Ranked Technical Debt Items

1. Lead truth duplication across `leadsSync`, `liveLeads`, `leads`, and sheet utilities.
2. Oversized `AccountsTab.tsx`.
3. Oversized `SequencesTab.tsx`.
4. Query-state navigation and custom events instead of a clearer app-router contract.
5. Local storage compatibility mirrors that survive beside backend truth.

## Recommended Next 10 PRs

1. Lead truth unification across sync + read paths.
2. Sheet sync runtime hardening and authoritative status cleanup.
3. Frontend customer-scoping contract cleanup.
4. Remove local storage lead-count mirrors from Accounts.
5. Decompose Accounts into drawer, metrics, and save-path modules.
6. Split Sequences into authoring and operations panels.
7. Build one shared readiness/activation model.
8. Refine Reports around operator-grade outreach KPIs and degraded-state messaging.
9. Add inbox thread/message windowing and better filters.
10. Clean stale workflow/runtime naming and other low-risk cognitive drag.
