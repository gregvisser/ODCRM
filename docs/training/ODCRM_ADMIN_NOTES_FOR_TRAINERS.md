# ODCRM Admin Notes for Trainers

## Purpose
This note is for the internal business/admin team who will point new users at the ODCRM training docs.

## What to tell a new user to do first
For a brand-new client setup:
1. Read `ODCRM_USER_WORKFLOW_OVERVIEW.md`.
2. Read `modules/ONBOARDING.md`.
3. Read `modules/EMAIL_ACCOUNTS.md`.
4. Read `modules/LEAD_SOURCES.md`.
5. Read `modules/COMPLIANCE_AND_SUPPRESSION.md`.
6. Read `modules/TEMPLATES.md`.
7. Read `modules/SEQUENCES.md`.
8. Use `ODCRM_TASK_PLAYBOOKS.md` for the first real run-through.

For an already-live operator:
1. Start with `modules/READINESS.md`.
2. Then `modules/SCHEDULES.md`.
3. Then `modules/INBOX.md`.
4. Then `modules/REPORTS.md`.

## What prerequisites must be true before a user can succeed
The user needs:
- a real client selected,
- at least one connected mailbox,
- lead-source data or a usable batch/list,
- suppression protection configured,
- at least one usable template,
- a saved sequence before live-start actions.

## Where users usually get stuck
Most common sticking points found in the audit:
- they confuse test recipients with live recipients,
- they expect `Schedules` to be a builder instead of a monitoring surface,
- they do not realize `Client Onboarding` only appears after selecting a client,
- they assume mailbox connect is enough without checking cap, signature, and send window,
- they think `Use in sequence` launches outreach,
- they do not realize template metadata is richer in the UI than in backend truth.

## What to stress during onboarding
Tell users:
- start in `Readiness` when you are unsure what to do next,
- use `Email Accounts`, `Lead Sources`, and `Suppression List` to make a client safe and ready,
- use `Templates` and `Sequences` to build and test,
- use `Schedules`, `Inbox`, and `Reports` for day-to-day operations,
- read the gotchas file before assuming the system is wrong.

## What not to over-promise
Do not tell users that:
- test send and live start are the same path,
- schedules are standalone schedule records,
- all template-library metadata is fully reliable backend truth,
- onboarding completion is fully blocked by every unfinished checklist item,
- the inbox unread-only filter is perfect.

## Best handoff order for a trainer
1. Confirm the user understands client selection.
2. Walk them through one mailbox connection.
3. Walk them through one source-sheet review.
4. Walk them through one suppression-sheet review.
5. Have them create one template.
6. Have them build one sequence.
7. Have them create one test audience and run one test batch.
8. Show them where to monitor the live path afterward.

## Reference docs for trainers
- `ODCRM_USER_TRAINING_MASTER_INDEX.md`
- `ODCRM_USER_WORKFLOW_OVERVIEW.md`
- `ODCRM_TASK_PLAYBOOKS.md`
- `ODCRM_KNOWN_LIMITS_AND_GOTCHAS.md`
- `../audits/USER_TRAINING_GROUND_TRUTH_AUDIT.md`
