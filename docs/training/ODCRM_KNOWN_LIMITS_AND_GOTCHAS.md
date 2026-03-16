# ODCRM Known Limits and Gotchas

## Purpose
This file records real implementation limits and common operator traps found in the audited codebase. If something feels unusual in the UI, check this file first.

## The single most important mental model
ODCRM currently has more than one operational path inside the marketing workflow.

The most important split is:
- `test audience / enrollment / queue-backed test sending`
- `live recipients / campaign-backed live sending`

If a user understands that difference, many of the other tabs become easier to read.

## Highest-priority gotchas
### `Start live sequence` and `Send test batch now` are different paths
- `Start live sequence` uses linked live recipients.
- `Send test batch now` uses active test enrollments only.
- A successful test send does not prove the live-recipient path has already been exercised in the same way.

What to do when this causes confusion:
- use `Sequences` for test-audience work,
- use `Schedules` for live status after launch,
- use `Readiness` if you need a compact explanation of blockers.

### `Schedules` is campaign-backed, not a standalone scheduler object
- The schedule tab monitors running or paused sequence-linked campaign state.
- It is best understood as the live-operations surface, not a schedule builder.

What to do when this causes confusion:
- go back to `Sequences` when you need to change setup,
- stay in `Schedules` when you only need to monitor or pause/resume.

### `Templates` shows richer metadata than the backend strongly persists
Treat these as lower-confidence metadata than the core template content:
- preview text,
- tags,
- favorites,
- usage counters,
- other library-style metadata.

Most reliable backend truth:
- template name,
- subject/body content,
- placeholder rendering behavior.

### Turned-off mailboxes can disappear from the current list
- `Turn off mailbox` and `Disconnect mailbox` both make a mailbox inactive.
- The current active identities list does not keep inactive rows visible in the normal marketing list.

What to do:
- be sure before you turn a mailbox off,
- document the mailbox elsewhere if you need to restore context later.

## Queue-backed vs live-audience-backed behavior
### Queue-backed / test / staged behavior
- sequence test audiences,
- enrollments,
- send-queue items,
- safe test batch behavior,
- queue previews and queue workbench results.

### Live-audience-backed behavior
- linked lead batch/list used by `Start live sequence`,
- campaign-backed schedule state,
- live campaign prospect scheduling.

### Why this matters
A user can easily think they are one sending model. They are not. This is the biggest current operator-training risk in ODCRM.

## Send-window, cap, and mailbox constraints
### Daily cap
- Mailbox daily send limits are currently clamped to 30.
- This affects readiness, schedule health, and whether a mailbox is considered safe to use.

Operator takeaway:
- if a mailbox looks capped, treat that as a real send limiter, not a cosmetic warning.

### Mailbox mismatch for schedule test actions
- A schedule can look healthy and still block `Run safe test batch`.
- If the schedule mailbox and linked-sequence mailbox do not match, the test action is disabled.

Operator takeaway:
- check both schedule mailbox and linked-sequence mailbox before assuming test-now is broken.

### Outlook mailbox count limit
- Outlook connect currently enforces a maximum of 5 active Outlook identities per client.

## Template-specific gotchas
### Shared template edits do not auto-update saved sequence steps
Once a template is copied into a sequence step, it becomes that step's own saved content.

Operator takeaway:
- if you update a shared template later, review the relevant sequence step again.

### Preview is a rendering aid, not a send
- Preview helps catch placeholder issues.
- It does not prove the live and test send paths are identical.

### Signature and unsubscribe behavior are stronger in send paths than casual users may expect
- `{{email_signature}}` is supported.
- ODCRM enforces unsubscribe-footer behavior in send paths if the template content does not already contain it clearly.

Operator takeaway:
- still place signature and unsubscribe content intentionally in the template,
- do not rely on the system fallback as your only content strategy.

## Sequence-specific gotchas
### Diagnostics are mixed into the main tab
`Sequences` contains both:
- the recommended operator workflow,
- deeper support and operations diagnostics.

Operator takeaway:
- start with create/edit, test audience, test batch, and live start,
- move into troubleshooting panels only when something actually needs investigation.

### Test sends are intentionally conservative
Current test-send behavior is safe and limited. Do not treat it as unlimited simulation of full live throughput.

### Delete can fail if the sequence is still linked to a campaign
If the sequence is still referenced, remove or unlink that relationship first.

## Schedule-specific gotchas
### `Run safe test batch` is not the same as sending the live schedule immediately
It uses the linked sequence test-send flow.

### Draft and completed items are not the main focus here
This tab is for running or paused live state.

### Some schedule values are derived, not user-configured here
The screen shows live state such as status, next send, and mailbox relationships. It is not where users configure the whole sending model.

## Lead-source gotchas
### `Use in sequence` is a handoff, not a launch
It passes the selected batch into the sequence workflow. It does not create immediate live sending on its own.

### Source URL expectations are strict
ODCRM expects a normal Google Sheets edit URL for current source connection.

### Shared-source behavior can surprise operators
If a source is configured for all accounts, the client may inherit it instead of using a client-specific source.

What to do if counts or imports look wrong:
1. confirm the correct client,
2. refresh the source from sheet,
3. review batches,
4. review contacts,
5. only then conclude the source is unusable.

## Compliance / suppression gotchas
### `Suppression List` and `Compliance` are the same current module from the operator point of view
The nav label and page heading are not identical.

### `Connected` does not automatically mean `many rows imported`
A source can be linked but still have low or zero imported counts.

### Replace is a real import action
`Replace source` is not just a label change.

### Inbox opt-out behavior is narrower than some operators may expect
The current visible inbox button adds email suppression for the sender address. Users should not assume the same action also added domain suppression.

## Inbox gotchas
### `Recent replies` is not the full inbox
It is a focused reply-monitoring slice.

### `Needs action only` should be treated as helpful, not perfect
Unread-only behavior appears risky enough that operators should sanity-check the full conversation list too.

### Inbox is not a fresh live mailbox read on every screen load
It is based on stored metadata, refresh behavior, and reply-detection behavior.

## Onboarding gotchas
### `Client Onboarding` does not appear until a client is selected
This is expected behavior, not a broken tab.

### `Complete Onboarding` is a real status change
It changes the client to active.

### Completion is not fully checklist-gated by the backend
Operators should not assume the system blocks completion just because some checklist items are incomplete.

### Onboarding completion does not mean every downstream marketing dependency is perfect
Users still need to check mailbox readiness, lead-source readiness, suppression, templates, and sequence setup.

## Reporting gotchas
### The current visible reporting dashboard is not the only reporting code in the repo
There are older reporting routes/components still present. Use the current `Reports` tab behavior as the operator truth.

### Some metrics can still be unavailable
This is current implementation truth, not automatically user error.

### Reports should lead to action elsewhere
When you spot a problem in Reports:
- go to `Inbox` for reply-side issues,
- go to `Schedules` for live-state issues,
- go to `Email Accounts`, `Lead Sources`, or `Suppression List` for setup-side problems,
- go to `Sequences` for launch/test-path problems.

## Live verification limitation
This training pass confirmed production build parity and the public sign-in page, but did not run authenticated browser automation in this session. Any future UI drift should be checked against the ground-truth audit and the current code.
