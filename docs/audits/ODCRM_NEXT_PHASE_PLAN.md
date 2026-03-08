# ODCRM Next Phase Plan

## Objective
Move ODCRM from module-complete to system-coherent for normal employee usage, while preserving current tenant safety and backend truth models.

## Planning Principles
- Preserve strict tenant handling (`X-Customer-Id`, no implicit fallback).
- Keep Marketing execution surfaces as the operational backbone.
- Prioritize flow wiring and user guidance over new large feature surfaces.
- Deliver in small, test-backed PR slices with parity checks.

## Phase 1: High-Impact Quick Wins (1-3 PRs)

### 1) Dashboard Action Routing Pass
- Add explicit “Next step” cards:
  - Continue in Marketing Readiness
  - Fix client data in OpenDoors Clients
  - Continue setup in Onboarding
- Add deterministic runtime markers for these handoffs.
- Success criteria: user can choose next action without module hunting.

### 2) Setup-To-Operations Bridge
- Add explicit completion handoffs from:
  - Onboarding -> Marketing Readiness
  - Clients data fix states -> Marketing Readiness
- Keep links contextual and tenant-safe.
- Success criteria: setup completion naturally flows into execution.

### 3) Language Harmonization Pass
- Standardize phrasing across modules:
  - “Setup readiness” vs “Send readiness”
  - “Daily operations” vs “Admin settings”
- Success criteria: lower cognitive load and fewer interpretation errors.

## Phase 2: Medium-Scope Rewire (2-4 PRs)

### 4) Role-Oriented Navigation Guidance
- Add lightweight role cues (Operator vs Setup/Admin) in module headers.
- Maintain same nav contract; improve comprehension via framing.

### 5) Clients Surface Task Framing
- Add top-level task blocks in Clients:
  - maintain accounts
  - maintain contacts
  - verify lead data for outreach
- Add explicit “after this, go to Marketing” cues.

### 6) Dashboard + Reports Coherence
- Clarify Dashboard as live snapshot and Reports as retrospective analysis.
- Ensure transitions between these are explicit and non-duplicative.

## Phase 3: Deferred / Optional (post-adoption)

### 7) IA Promotion/Demotion Changes
- Only after analytics/support feedback:
  - consider reducing prominence of setup/admin surfaces for non-admin roles.

### 8) Guided Day-1 Walkthrough
- Optional lightweight onboarding flow overlay if user confusion persists after rewires.

## Recommended PR Slicing Strategy
1. `fix(flow): add dashboard next-step routing cues`
2. `fix(flow): add onboarding and clients handoff into marketing readiness`
3. `fix(copy): harmonize setup-vs-operations guidance across top-level modules`
4. `fix(customers): add action-first framing and post-fix routing`
5. `fix(ux): align dashboard and reports purpose cues`

Each PR should include:
- targeted runtime proof update,
- mandatory gates (`tsc`, FE build, server build, lint non-regression),
- strict post-merge parity check.

## Rollout/Adoption Readiness Criteria
- First-day employee can complete setup-to-first-outreach path without supervisor intervention.
- Daily employee can stay in Dashboard + Marketing for most tasks.
- Support tickets about “where do I go next?” reduce meaningfully.

## What Should Happen Before Broader Rollout
1. Complete Phase 1 quick wins.
2. Re-run operator acceptance checklist with non-developer staff.
3. Close top confusion points in Clients/Onboarding transitions.
4. Confirm parity and runtime proof stability across two consecutive production merges.
