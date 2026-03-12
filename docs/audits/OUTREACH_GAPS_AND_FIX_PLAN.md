# Outreach Gaps And Fix Plan

Date: 2026-03-12
Baseline: `origin/main` `0a25edea1676a78cb7050c12b26d92d2677ac56f`

## Highest-value gaps

### 1. Operator clarity
- Problem: Sequences and Schedules still read like internal tools.
- Evidence:
  - `src/tabs/marketing/components/SequencesTab.tsx` contains advanced queue/audit/dry-run surfaces alongside the normal operator flow.
  - `src/tabs/marketing/components/SchedulesTab.tsx` still uses UI-only schedule fields layered over campaign truth.
- This PR:
  - kept diagnostics available
  - added clearer operator-facing immediate test and outcome visibility in Sequences
  - kept deeper tooling behind advanced diagnostics

### 2. Daily sending safety
- Problem: legacy defaults and UI allowed daily limits above 30/day.
- This PR:
  - enforced 30/day in backend truth
  - clamped UI controls to 30/day

### 3. Testing without waiting
- Problem: real send testing relied on admin-secret routes and scheduled windows.
- This PR:
  - added `POST /api/send-worker/sequence-test-send`
  - exposes a user-facing “Send test batch now” flow in Sequences

### 4. Outcome visibility
- Problem: operators could not easily answer “what sent, what failed, what was blocked, and which mailbox sent it?”
- This PR:
  - surfaced recent send outcomes in operator view using existing run-history truth

## Recommended next PRs

### PR 1: Schedules operator rebuild
- Remove UI-only schedule fields that are not true backend controls.
- Reframe the tab around:
  - active schedule
  - next send time
  - sending mailbox
  - per-day cap
  - sent / queued / paused state

### PR 2: Guided launch journey
- Turn Sequences into one guided operator path:
  1. choose sequence
  2. confirm audience + sender
  3. confirm readiness
  4. preview next send
  5. test now / start
  6. monitor outcomes

### PR 3: Reporting consolidation
- Make Reports and Inbox the obvious places for:
  - sent
  - replies
  - failures
  - opt-outs
  - suppression growth

### PR 4: Backend simplification
- Reduce the conceptual overlap between queue worker, scheduler, and campaign sender so the product has one clearly documented sending model.
