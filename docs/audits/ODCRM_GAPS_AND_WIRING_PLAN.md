# ODCRM Gaps And Wiring Plan

## Purpose
Identify concrete system-flow gaps and wiring fixes across top-level modules, based on current repo wiring and runtime proofed surfaces.

## Gap Severity Legend
- **P1**: blocks normal employee flow or trust.
- **P2**: materially increases confusion/friction.
- **P3**: quality improvement / optimization.

## Gap Inventory

| Gap | Severity | Evidence | Impact | Recommendation |
| --- | --- | --- | --- | --- |
| Weak system-level handoff from Dashboard into daily operations | P1 | Dashboard is data-rich but action-light (`DashboardsHomePage`) | Users unsure where to act next | Add explicit “Go to Readiness/Sequences/Clients” guidance cards with context |
| Setup vs daily-use boundaries are implicit | P1 | Onboarding/Clients/Settings all top-level peers | New employees treat admin/setup as day-to-day flow | Clarify setup-only vs daily-use in copy + nav hints |
| Onboarding completion does not strongly transition into Marketing execution | P2 | Onboarding has progress + onboarding form but weak final handoff | Teams finish setup but stall before execution | Add explicit completion CTA: “Continue in Marketing Readiness” |
| Clients module is powerful but cognitively dense | P2 | Accounts/Contacts/Leads surfaces are heavy | Non-technical staff struggle to know what to fix first | Add task-oriented framing and remediation-first cues |
| Settings prominence can imply operational relevance | P2 | Single admin-focused settings sub-tab | Distracts daily operators | Keep tab but label as admin/setup in guidance |
| Cross-module back-links are inconsistent outside Marketing | P2 | Marketing has strong internal continuity; other modules less so | Users get stranded after fixing upstream issue | Add cross-links from Clients/Onboarding to Marketing start points |
| Duplicate concepts across modules (health/readiness/progress) not always reconciled | P3 | Onboarding readiness + marketing readiness + dashboard metrics | Conflicting mental model | Standardize phrasing for “setup readiness” vs “send readiness” |

## Module Classification: Daily-Use vs Setup/Admin

| Module | Classification | Keep/Change |
| --- | --- | --- |
| Dashboard | Daily-use entry | Keep, but add action-first guidance |
| OpenDoors Marketing | Daily-use core | Keep and continue as operator center |
| OpenDoors Clients | Setup + maintenance | Keep; clarify when to use |
| Onboarding | Setup progression | Keep; tighten handoff to Marketing |
| Settings | Admin/setup only | Keep; demote in day-to-day guidance |

## Wiring Recommendations By Area

### Dashboard
- Add lightweight “next best step” routing cues.
- Distinguish monitoring (read) vs action (go to module X).

### OpenDoors Clients
- Add “after fix” handoffs:
  - data prerequisites fixed -> Marketing Readiness
  - onboarding required -> Onboarding
- Keep deep tools; improve route-out guidance.

### OpenDoors Marketing
- Preserve current control-plane and operator workflow.
- Keep as single daily execution center.

### Onboarding
- Strengthen completion bridge to Marketing.
- Explicitly state when onboarding is done enough to proceed.

### Settings
- Reframe as admin surface; avoid implying daily required steps.

## Missing Transitions (Concrete)
1. Dashboard -> Marketing Readiness recommendation based on current operational state.
2. Dashboard -> Clients for upstream data gaps.
3. Onboarding completion -> Marketing Readiness/Sequences.
4. Clients fix complete -> Marketing Readiness confirmation path.

## What Can Stay As-Is
- Tenant enforcement model.
- Marketing operational architecture and proofs.
- Top-level tab contract and path-based deep-linking.

## What Must Be Rewired Next
1. Action-first handoffs on Dashboard (P1).
2. Setup-to-operations bridge from Onboarding and Clients into Marketing (P1/P2).
3. Copy and framing that separates admin/setup from daily-use flow (P2).

## Suggested Acceptance Checks For Rewire Phase
- New user can answer “what do I do next?” from each top-level module in <= 10 seconds.
- After completing onboarding/setup tasks, users are routed or guided to Marketing Readiness.
- Daily operator can stay mostly within Dashboard + Marketing.
- Admin-only tasks are clearly labeled and not on critical daily path.
