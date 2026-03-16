# ODCRM Known Limits and Gotchas

## Purpose
This file records real implementation limits and common operator traps found in the audited codebase. If something feels unusual in the UI, check this file first.

## Highest-priority gotchas
### `Start live sequence` and `Send test batch now` are different paths
- `Start live sequence` uses linked live recipients.
- `Send test batch now` uses active test enrollments only.
- Do not assume a successful test send means the exact same live-recipient path has already been exercised.

### `Schedules` is campaign-backed, not a standalone scheduler object
- The schedule tab monitors running/paused live campaign state linked to a sequence.
- It is best understood as the live-operations surface, not a full scheduler builder.

### `Templates` shows richer metadata than the backend strongly persists
Treat these as less reliable than the core template record:
- preview text,
- tags,
- favorites,
- usage counters,
- similar library-style metadata.

The most reliable persisted truth is still the core subject/body template content.

### Turned-off mailboxes can disappear from the current list
- `Turn off mailbox` and `Disconnect mailbox` both make a mailbox inactive.
- The active identities list does not keep inactive rows visible in the normal marketing list.

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
A user can easily think they are all one sending model. They are not. This is the single biggest mental-model gap in current ODCRM marketing operations.

## Send-window, cap, and mailbox constraints
### Daily cap
- Mailbox daily send limits are currently clamped to 30.
- This affects readiness, schedule health, and whether a mailbox is considered safe to use.

### Mailbox mismatch for schedule test actions
- A schedule can look healthy and still block `Run safe test batch`.
- If the schedule mailbox and linked-sequence mailbox do not match, test-now behavior is disabled.

### Outlook mailbox count limit
- Outlook connect currently enforces a maximum of 5 active Outlook identities per client.

## Template-specific gotchas
### Shared template edits do not auto-update saved sequence steps
Once a template is copied into a sequence step, it becomes that step's own saved content.

### Preview is a rendering aid, not a send
- Preview helps catch placeholder issues.
- It does not prove the live and test send paths are identical.

### Signature and unsubscribe behavior are stronger in send paths than casual users may expect
- `{{email_signature}}` is supported.
- ODCRM enforces unsubscribe footer behavior in send paths if the template content does not already contain it clearly.

## Sequence-specific gotchas
### Diagnostics are mixed into the main tab
`Sequences` contains both:
- real operator workflow,
- support/operations diagnostics.

New users should start with the basic build/test/start path before touching deep diagnostics.

### Test sends are intentionally conservative
Current test-send behavior is safe and limited. Do not treat it as an unlimited simulation of live production throughput.

### Delete can fail if the sequence is still linked to a campaign
If the sequence is still referenced, remove or unlink that relationship first.

## Schedule-specific gotchas
### `Run safe test batch` is not the same as sending the live schedule immediately
It uses the linked sequence test-send flow.

### Draft and completed items are not the main focus here
This tab is for running or paused live state.

## Lead-source gotchas
### `Use in sequence` is a handoff, not a launch
It passes the selected batch into the sequence workflow. It does not create immediate live sending on its own.

### Source URL expectations are strict
ODCRM expects a normal Google Sheets edit URL for current source connection.

### Shared-source behavior can surprise operators
If a source is configured for all accounts, the client may inherit it instead of using a client-specific source.

## Compliance / suppression gotchas
### `Suppression List` and `Compliance` are the same current module from the operator point of view
The nav name and page heading are not identical.

### `Connected` does not automatically mean `many rows imported`
A source can be linked but still have low or zero imported counts.

### Replace is a real import action
`Replace source` is not just a label change.

## Inbox gotchas
### `Recent replies` is not the full inbox
It is a focused reply-monitoring slice.

### `Needs action only` should be treated as helpful, not perfect
Unread-only behavior appears risky enough that operators should sanity-check the full conversation list too.

### Current `Mark as Opt-out` behavior is email-focused
The current visible inbox button adds email suppression for the sender address.

## Onboarding gotchas
### `Client Onboarding` does not appear until a client is selected
This is expected behavior.

### `Complete Onboarding` is a real status change
It changes the client to active.

### Completion is not fully checklist-gated by the backend
Operators should not assume the system blocks completion just because some checklist items are incomplete.

## Reporting gotchas
### The current visible reporting dashboard is not the only reporting code in the repo
There are older reporting routes/components still present. Use the current `Reports` tab behavior as the operator truth.

### Some metrics can still be unavailable
This is current implementation truth, not necessarily user error.

## Live verification limitation
This training pass confirmed production build parity and the public sign-in page, but did not run authenticated browser automation in this session. Any future UI drift should be checked against the ground-truth audit and the current code.
