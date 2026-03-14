# ODCRM PR Backlog

Date: 2026-03-14
Planning base SHA: `1c268db4fc9940bd8daff13a917e1225271db74b`

## P0 = correctness / tenant safety / outreach safety

| Priority | PR name | Goal | Exact files/areas likely touched | Why it matters | Risk level | Dependencies | Validation / gates required | Expected user-visible outcome |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| P0-1 | Unify Google Sheets lead truth | Create one shared lead-row classification + normalization contract | `server/src/workers/leadsSync.ts`, `server/src/services/leadCanonicalMapping.ts`, `server/src/routes/leads.ts`, `server/src/routes/liveLeads.ts`, lead tests | Highest current truth risk | Medium | None | lead self-tests, lint, tsc, frontend build, server build | Counts and row eligibility become consistent across sheet-backed clients |
| P0-2 | Harden lead sheet sync runtime | Make stale/failing/authoritative states and upsert runtime more trustworthy | `server/src/workers/leadsSync.ts`, `server/src/routes/liveLeads.ts`, related sync helpers | Correct truth is not enough if sync health is brittle | Medium | P0-1 | sync-targeted tests, lint, tsc, builds | Operators stop seeing contradictory “correct but stale/failing” lead states |
| P0-3 | Standardize frontend customer scope | Define one frontend contract for active-client tabs vs local selectors | `src/utils/api.ts`, marketing/customer tabs, selection helpers, settings store consumers | Prevents customer header mismatch regressions | Medium | None | lint, tsc, builds, focused UX verification on scoped tabs | Client-scoped screens behave consistently and predictably |

## P1 = operator flow / truth-path cleanup

| Priority | PR name | Goal | Exact files/areas likely touched | Why it matters | Risk level | Dependencies | Validation / gates required | Expected user-visible outcome |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| P1-1 | Remove Accounts lead-count mirrors | Stop using local compatibility count state where backend/live truth already exists | `src/components/AccountsTab.tsx`, `src/utils/accountsLeadsSync.ts`, related account metric render paths | Reduces stale CRM numbers | Low | P0-3 helpful but not mandatory | lint, tsc, builds, spot-check account metrics | Accounts show one consistent lead count story |
| P1-2 | Split Sequences authoring from operations | Reduce operator overload by separating authoring, launch/test, and diagnostics | `src/tabs/marketing/components/SequencesTab.tsx`, maybe small shared components | Biggest UX debt area in active outreach flow | Medium | P0-3 | lint, tsc, builds, focused operator-flow QA | Sequence flow feels more trustworthy and easier to operate |
| P1-3 | Build one readiness/activation model | Align onboarding, readiness, and marketing next-step logic | `src/utils/clientReadinessState.ts`, `src/tabs/onboarding/*`, `src/tabs/marketing/components/ReadinessTab.tsx` | Removes conceptual overlap that confuses operators | Medium | P0-3 | lint, tsc, builds | Clearer next actions and less duplicated health language |
| P1-4 | Clarify reporting degraded states | Surface when reports are using fallback/degraded metrics | `server/src/routes/reports.ts`, `src/tabs/marketing/components/ReportsTab.tsx` | Prevents over-trusting partial reports | Low | None | lint, tsc, builds, report smoke tests | Operators can tell when report metrics are degraded |

## P2 = UX clarity / performance / maintainability

| Priority | PR name | Goal | Exact files/areas likely touched | Why it matters | Risk level | Dependencies | Validation / gates required | Expected user-visible outcome |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| P2-1 | Decompose AccountsTab | Split drawer, metrics, edits, and compatibility behavior into smaller modules | `src/components/AccountsTab.tsx` and extracted subcomponents | Reduces regression risk in core CRM surface | Medium | P1-1 | lint, tsc, builds | Accounts becomes safer to maintain with less accidental drift |
| P2-2 | Inbox scaling pass | Add better server-side filtering/windowing for threads/messages | `server/src/routes/inbox.ts`, `src/tabs/marketing/components/InboxTab.tsx` | Inbox will hit scale limits first | Medium | None | lint, tsc, builds, inbox smoke tests | Better inbox responsiveness and filterability |
| P2-3 | Mailbox health UX cleanup | Turn Email Accounts diagnostics into clearer mailbox status UX | `src/tabs/marketing/components/EmailAccountsTab.tsx`, `server/src/routes/outlook.ts` if needed for clearer state | Makes sending identity health more operator-friendly | Low | None | lint, tsc, builds | Clearer mailbox connection and reconnect states |
| P2-4 | Schedules clarity pass | Clarify what Schedules is and how it relates to actual send execution | `src/tabs/marketing/components/SchedulesTab.tsx`, maybe minimal route metadata | Reduces ambiguity in planning vs execution | Low | P1-2 helpful | lint, tsc, builds | Schedules reads like a real operator screen instead of a side projection |
| P2-5 | Lead Sources health messaging | Improve source fallback and sync-health messaging without changing truth | `src/tabs/marketing/components/LeadSourcesTabNew.tsx`, maybe additive response metadata use | Strong surface, but still requires insider knowledge | Low | P0-1, P0-2 helpful | lint, tsc, builds | Easier to understand client source vs shared fallback and source health |

## P3 = optional enhancements

| Priority | PR name | Goal | Exact files/areas likely touched | Why it matters | Risk level | Dependencies | Validation / gates required | Expected user-visible outcome |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| P3-1 | Shell navigation cleanup | Reduce custom-event/query-state coupling in app shell | `src/App.tsx`, navigation helpers | Structural cleanup, not urgent | Medium | P0-3 | lint, tsc, builds | Cleaner navigation model |
| P3-2 | Workflow/runtime naming cleanup | Remove stale naming/cognitive drag in workflows and operator labels | deploy workflows, small UI copy | Low-risk clarity improvement | Low | None | lint, builds, workflow review | Less confusing operational terminology |
| P3-3 | Template library governance pass | Improve reusable template organization without changing core truth | template UI/docs only | Nice-to-have after bigger risks are reduced | Low | None | lint, tsc, builds | Easier long-term template management |
