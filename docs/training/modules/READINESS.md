# Readiness

## Purpose
Use `Readiness` to answer the operator question: "What needs attention before or during outreach right now?"

This is the shortest route to:
- current blockers,
- launch risk,
- next safe action,
- links into `Sequences`, `Inbox`, and `Reports`.

## You are here in the workflow
Use this tab:
- after setup work,
- before live launch,
- during daily operations when you want the fastest current-state summary.

What should already be done before this tab is most useful:
- the correct client is selected,
- the client has at least some setup in place,
- ideally a sequence already exists.

Where users usually go next:
- `Sequences` if launch/test issues need fixing,
- `Inbox` if replies need attention,
- `Reports` if performance review is the real task.

## When a user should use this tab
Use `Readiness` when you want to:
- check whether a client is ready for outreach,
- review sequence-specific launch blockers,
- see who would send next,
- compare recent outcomes with the expected preview path,
- jump into the correct follow-up tab.

## Before you start
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

## What each area is for
| Area | What it tells the operator |
|---|---|
| `Launch Status` | The best quick summary of whether the selected sequence looks ready, blocked, or risky. |
| `Issues to Review` | How many warnings or blockers still need attention. |
| `Ready Mailboxes` | Whether usable sending identities appear to be available. |
| `Ready in First Batch` | Whether the first live batch appears to have usable recipients. |
| `What to fix first` | The most operator-useful next issue to deal with. |
| `Check before launch` | The deeper launch-preflight path. |
| `Who would send next` | Which mailbox/sender path appears most relevant next. |
| `Recent send outcomes` | What ODCRM has observed recently, not just what it predicted. |

## Main actions available
Common buttons you will see:
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

## Recommended operator path
1. Open `Readiness`.
2. Select the correct client.
3. Choose the sequence you care about.
4. Click `Refresh`.
5. Read the top summary cards first.
6. Read `What to fix first`.
7. Use the most relevant next-step button.

## Advanced or diagnostic path
Use the deeper follow-up actions only when needed:
- `Review full preflight`
- `Review full launch preview`
- `Open preview comparison`
- `Open run history`
- queue-workbench-style follow-up actions

These are useful, but they are not the first thing to teach a new operator.

## Click-by-click workflows
### Check whether a client is ready to move forward
1. Click `Readiness`.
2. Confirm the correct client is selected.
3. Use the sequence selector.
4. Click `Refresh`.
5. Read `Launch Status`.
6. Read `Issues to Review`.
7. Read `What to fix first`.
8. Use the suggested next-step action.

Expected result:
- you know whether the selected sequence is blocked, ready, or still risky.

### Check whether predicted sending matches actual results
1. Open `Readiness`.
2. Choose the sequence.
3. Click `Review full launch preview`.
4. Click `Open preview comparison`.
5. Read `Recent send outcomes`.
6. If there is a mismatch, go to `Sequences` for follow-up.

Expected result:
- you know whether live behavior matched what ODCRM expected.

### Use readiness as the daily starting point
1. Open `Readiness`.
2. Read the current status and blocker message.
3. Click `Open Inbox` if replies are the real task.
4. Click `Open Reports` if performance review is the real task.
5. Click the `Sequences`-related action if launch/test/setup work is the real task.

## What happens after each action
- `Refresh` reloads readiness, exception-center, identity-capacity, run-history, and sequence-specific launch checks.
- `Open Inbox` and `Open Reports` navigate to those tabs.
- `Review full preflight` and related actions expose deeper launch analysis rather than changing live state directly.

## How this tab connects to other tabs
- `Readiness` points back into [Onboarding](./ONBOARDING.md) when client setup still looks incomplete.
- It points indirectly to [Email Accounts](./EMAIL_ACCOUNTS.md), [Lead Sources](./LEAD_SOURCES.md), [Compliance and Suppression](./COMPLIANCE_AND_SUPPRESSION.md), and [Templates](./TEMPLATES.md) when prerequisites are weak.
- It points directly into [Sequences](./SEQUENCES.md), [Inbox](./INBOX.md), and [Reports](./REPORTS.md) for action.

## Common mistakes / failure states / confusion points
- Treating the broad client readiness badge as identical to sequence preflight.
- Assuming every button here fixes the issue directly. Many route you to the place where the fix lives.
- Skipping the sequence selector and trusting the summary anyway.

## How to verify success
You are done with this tab when:
- you know the current launch/operational state,
- you know what the next tab should be,
- you know whether the issue is setup, launch, inbox, or reporting related.

## What to do next
- Go to [Sequences](./SEQUENCES.md) if launch/test changes are needed.
- Go to [Inbox](./INBOX.md) if reply work is next.
- Go to [Reports](./REPORTS.md) if outcome review is next.

## Reality check notes
- `Readiness` combines multiple backend sources, so broad client status and sequence-specific preflight are related but not identical.
- This tab is intentionally compact. It is a decision point, not the full place where every fix happens.
