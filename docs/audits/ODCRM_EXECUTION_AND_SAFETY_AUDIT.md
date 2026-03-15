# ODCRM Execution and Safety Audit

Actual `origin/main` SHA audited: `028ba87a5efd2e6ba0997a0cc94927682b04d009`

## Bottom Line

If ODCRM sends outreach today, the backend safety model is materially trustworthy. The biggest remaining weaknesses are not obvious safeguard bypasses. They are:

- operator-facing complexity
- reporting/readiness over-dependence on diagnostic routes
- runtime fragility around lead-sheet sync freshness and long-tail inbox/report scale

## Safety Verdict

### Daily cap
- Files:
  - `server/src/utils/emailIdentityLimits.ts`
  - `server/src/workers/sendQueueWorker.ts`
  - `server/src/routes/outlook.ts`
- Evidence:
  - cap is clamped centrally to 30
  - send worker uses the same limit logic during live processing
- Verdict: intact

### Suppression
- Files:
  - `server/src/routes/suppression.ts`
  - `server/src/workers/sendQueueWorker.ts`
  - `server/src/routes/tracking.ts`
  - `server/src/routes/inbox.ts`
- Evidence:
  - suppression is customer-scoped
  - worker checks email and domain suppression before send
  - unsubscribe tracking writes into `suppressionEntry`
  - inbox opt-out posts also land in suppression truth
- Verdict: intact and one of the cleanest contracts in the app

### Unsubscribe
- Files:
  - `server/src/routes/tracking.ts`
  - `server/src/services/templateRenderer.ts`
  - `server/src/routes/templates.ts`
- Evidence:
  - unsubscribe links render as clickable HTML in preview/send contexts
  - unsubscribe route writes suppression and cancels queued future steps
- Verdict: intact

### Reply-stop
- Files:
  - `server/src/workers/sendQueueWorker.ts`
  - `server/src/routes/inbox.ts`
- Evidence:
  - reply-stop is enforced in send worker
  - sibling queued items are also propagated to stop state
- Verdict: intact

### Bounce stop
- Files:
  - `server/src/workers/sendQueueWorker.ts`
- Evidence:
  - invalid/hard-bounce recipients are terminally classified and blocked from future send progression
- Verdict: intact

### Tenant isolation
- Files:
  - `src/utils/api.ts`
  - customer-scoped route handlers using tenant/customer helpers
- Evidence:
  - frontend injects `X-Customer-Id`
  - backend requires and scopes customer-sensitive routes by tenant id
  - template, sequence, inbox, suppression, live leads, and customers routes all rely on customer-scoped checks
- Verdict: intact

## Send Path Audit

### Real send path
- Authoring and scheduling enter through:
  - `src/tabs/marketing/components/SequencesTab.tsx`
  - `src/tabs/marketing/components/SchedulesTab.tsx`
- Backend execution flows through:
  - `server/src/routes/sequences.ts`
  - `server/src/routes/enrollments.ts`
  - `server/src/routes/sendWorker.ts`
  - `server/src/workers/sendQueueWorker.ts`
  - `server/src/utils/sendQueue.ts`
  - `server/src/utils/liveSendGate.ts`

### Trust assessment
- `dry-run`: trustworthy
- `sequence test send`: trustworthy, customer-scoped, mutation-auth-gated
- `scheduled/live queue send`: trustworthy in rules, but operationally complex
- `manual live tick`: guarded, but still an advanced operator tool

## Are there known bypass paths?

No proven safeguard bypass was found in current `origin/main`.

Important qualification:
- The absence of a proven bypass does not mean the operator UI is clean.
- The send-worker and queue surfaces still expose control-room concepts that can confuse operators even when the backend is safe.

## Remaining Execution Risks

### 1. Sequences surface overload
- Risk type: operator error / misuse
- The backend is stronger than the UI.
- Operators have access to dry runs, audits, queue workbench, preview-vs-outcome, exception center, live tick-related concepts, and start/pause flows in one place.

### 2. Reporting depends on diagnostic routes
- Risk type: interpretation risk
- `ReportsTab` and `ReadinessTab` both consume send-worker diagnostics directly.
- Safe backend truth exists, but the product layer still presents it like a workbench.

### 3. Inbox scale
- Risk type: runtime/performance
- Thread loading currently groups large message sets in application logic.
- This is not a correctness bug today, but it is a likely future operational problem.

### 4. Deploy/runtime skew
- Risk type: operational reliability
- parity tooling is strong
- rollout skew is still expected and recovered around, rather than structurally eliminated

## Is outreach trustworthy today?

### Backend safety answer
- Yes.

### Product/operator answer
- Mostly yes for controlled operator teams.
- Not yet ideal for broader scale because the primary operations surfaces are still too diagnostic-heavy and mentally expensive.

## Exact Answer Set

### If outreach is sent, will it work?
- Usually yes, assuming identity health and queue/runtime conditions are healthy.

### Is suppression per customer truly enforced?
- Yes.

### Are suppressed emails/domains blocked through outreach and inbox-related opt-out paths?
- Yes.

### Are reply-stop and bounce stop intact?
- Yes.

### Is 30/day cap really enforced?
- Yes.

### Are there any proven paths that bypass safeguards?
- None found in current main.

### What remains risky even if safeguards are correct?
- operator misinterpretation in `Sequences`, `Readiness`, and `Reports`
- inbox/runtime scale
- deploy/runtime skew windows
