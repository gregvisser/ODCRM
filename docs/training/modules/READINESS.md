# Readiness

## Purpose
Use `Readiness` to answer the operator question: "What needs attention before or during outreach right now?"

This tab is a compact operational cockpit. It does not replace the setup tabs. It tells you what to check next and links you into the right place.

## When a user should use this tab
Use `Readiness` when you want to:
- check whether a client is ready for outreach,
- review sequence-specific launch blockers,
- see who would send next,
- compare recent outcomes with the preview path,
- jump into `Sequences`, `Inbox`, or `Reports` based on what the system finds.

## Prerequisites
- A client must be selected.
- A sequence is needed for sequence-specific preflight and launch-preview views.

## What the user sees on screen
Main areas:
- sequence selector,
- summary cards:
  - `Launch Status`
  - `Issues to Review`
  - `Ready Mailboxes`
  - `Ready in First Batch`
- `What to fix first`
- `Check before launch`
- `Who would send next`
- `Troubleshooting & follow-up`
- `Did actual sends match the preview?`
- `Recent send outcomes`

## Main actions available
Buttons you will commonly see:
- `Refresh`
- `Open Reports`
- `Open Inbox`
- dynamic next-step buttons such as:
  - `Open Sequences`
  - `Inspect Identity Capacity`
  - `Open Queue Workbench`
  - `Open Queue Workbench (Failed)`
  - `Open Sequence Preflight`
  - `Open Preview vs Outcome`
- `Review full preflight`
- `Review full launch preview`
- `Open preview comparison`
- `Open run history`

## Field-by-field explanation
### Sequence selector
Use this to choose which sequence you want the readiness tab to evaluate. If no usable sequence exists, the tab will tell you that no sequence is available.

### Launch Status
The overall current state for the selected sequence. This is the best quick signal, but it is not the same thing as every deeper diagnostic panel.

### Issues to Review
A count of blockers or warnings that still need operator attention.

### Ready Mailboxes
How many mailboxes appear usable for the next send path.

### Ready in First Batch
How many recipients look ready in the first send batch.

## Step-by-step common workflows
### Check whether a client is ready to move forward
1. Click `Readiness`.
2. Select the client if needed.
3. Choose the sequence you care about.
4. Click `Refresh`.
5. Read the summary cards first.
6. Open `Review full preflight` if there are blockers or warnings.
7. Use the next-step button to move into `Sequences`, `Inbox`, or `Reports`.

### Check whether the predicted next send matches reality
1. Open `Readiness`.
2. Choose the sequence.
3. Click `Review full launch preview`.
4. Click `Open preview comparison`.
5. Review `Recent send outcomes`.
6. If the preview and real results do not line up, move into `Sequences` for deeper troubleshooting.

### Use readiness as a quick starting point for daily work
1. Open `Readiness`.
2. Read the status and blocker message.
3. If you need reply work, click `Open Inbox`.
4. If you need performance review, click `Open Reports`.
5. If you need launch/test changes, click the relevant `Sequences` action.

## What happens after each action
- `Refresh` reloads readiness, exception-center, identity-capacity, run-history, and sequence-specific launch checks.
- `Review full preflight` and related actions show deeper diagnostic panels or route you into the sequence troubleshooting path.
- `Open Inbox` and `Open Reports` are navigation actions. They do not mutate data.

## How this tab connects to other tabs
- `Readiness` points back into `Onboarding` when the client is still incomplete.
- `Readiness` points into `Email Accounts`, `Lead Sources`, `Suppression List`, and `Templates` indirectly by revealing which prerequisite is still weak.
- `Readiness` points directly into `Sequences`, `Inbox`, and `Reports` for actual action.

## Common mistakes / failure states / confusion points
- Treating the page-level client readiness badge as identical to sequence preflight. They are related, but not the same calculation.
- Assuming every button here fixes the problem directly. Many of them only route you to the tab where the fix lives.
- Forgetting to select the correct sequence before trusting the summary.

## Operational tips
- Read the summary cards first. Do not start in the lower troubleshooting blocks unless the top row already tells you there is a problem.
- Use this tab as the first stop for already-live clients.

## Reality check notes
- `Readiness` combines multiple backend sources. A client can show a broad state like `Outreach active` while a specific sequence still has a `WARNING` or `NO_GO` preflight result.
- This tab is intentionally compact. It is not the place to create templates or sequences.

## Related docs / next steps
- [Email Accounts](./EMAIL_ACCOUNTS.md)
- [Sequences](./SEQUENCES.md)
- [Inbox](./INBOX.md)
- [Reports](./REPORTS.md)
