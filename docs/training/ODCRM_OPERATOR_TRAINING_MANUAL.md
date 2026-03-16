# ODCRM Operator Training Manual

## Table of Contents
- [Start Here](#start-here)
- [First-Day Quickstart](#first-day-quickstart)
- [Daily Operator Checklist](#daily-operator-checklist)
- [Core Workflow](#core-workflow)
- [Key Playbooks](#key-playbooks)
- [Module Reference](#module-reference)
- [Known Limits and Gotchas](#known-limits-and-gotchas)

## Start Here
This manual is for ODCRM operators who need one practical document they can follow while working in the product. It packages the current training docs into a single operator-facing guide.

Use this manual when you want to:
- learn the normal ODCRM workflow in the correct order,
- follow exact steps for common tasks,
- understand what each main tab is for,
- know what success looks like,
- know what to do when the UI behaves differently from what you expected.

### Who this manual is for
Primary users:
- agency-side operators running client outreach inside ODCRM,
- account managers and onboarding staff setting up a client,
- team leads guiding new operators through the system.

### Role assumptions
This manual assumes the current agency/operator-facing ODCRM mode.

What that means in practice:
- you usually select a client first,
- you then work inside `OpensDoors Marketing` or `Onboarding` for that client,
- `Settings` exists, but it is not the normal daily-work starting point.

### Main tabs at a glance
| Tab | What it is for |
|---|---|
| `OpensDoors Clients` | Confirm the correct client record and review account/contact context. |
| `OpensDoors Marketing` | Main operator workspace for setup, outreach, monitoring, inbox, and reports. |
| `Onboarding` | New-client setup, handover, and readiness preparation. |
| `Settings` | Admin/setup-only area, not the normal daily operator path. |

### How to use this manual
Use this document in this order:
1. Start with the quickstart.
2. Follow the core workflow.
3. Use the key playbooks while doing the task in ODCRM.
4. Use the module reference when you need tab-specific help.
5. Use the gotchas section when the UI behaves in a non-obvious way.

## First-Day Quickstart
Use this as the safest first-day path through ODCRM.

1. Open `OpensDoors Clients` and confirm you are working on the correct client.
2. Open `Onboarding` and make sure that same client is selected.
3. Complete the essential onboarding details.
4. Open `Email Accounts` and connect at least one sending mailbox.
5. Open `Lead Sources` and confirm a usable source is connected and reviewable.
6. Open `Suppression List` and confirm email/domain protection is configured.
7. Open `Templates` and create or review the outreach copy.
8. Open `Sequences` and build the draft sequence.
9. Add a test audience and run a test batch.
10. Open `Readiness` and confirm the client or sequence is ready to move forward.
11. Start the live sequence only after the test path and readiness checks look right.
12. Move to `Schedules`, `Inbox`, and `Reports` for day-to-day operation.

## Daily Operator Checklist
Use this when you are handling already-live work.

1. Select the correct client.
2. Open `Readiness` and read the current status first.
3. Open `Schedules` and check live status, next send, and recent outcomes.
4. Open `Inbox` and work new replies or opt-outs.
5. Open `Reports` and review whether results still look healthy.
6. Go back to `Email Accounts`, `Lead Sources`, `Suppression List`, `Templates`, or `Sequences` only if you need to change setup or fix a blocker.

## Core Workflow
ODCRM is easiest to use when you think about it in four phases.

### Phase 1: Confirm the client context
Use:
- `OpensDoors Clients`
- `Onboarding`

What you are doing:
- confirming you are working on the right client,
- checking that the account and contact context makes sense,
- making sure onboarding is scoped to the right client.

What success looks like:
- you know the correct client is selected before entering the marketing workflow.

### Phase 2: Make the client send-ready
Use:
- `Email Accounts`
- `Lead Sources`
- `Suppression List`
- `Readiness`

What you are doing:
- connecting a mailbox,
- reviewing mailbox cap, signature, and send window,
- confirming a usable lead source exists,
- confirming suppression is configured.

What success looks like:
- the client is not blocked by missing mailboxes, missing source data, or missing suppression.

### Phase 3: Build and test the outreach
Use:
- `Templates`
- `Sequences`
- `Readiness`

What you are doing:
- creating or reviewing templates,
- building the sequence,
- adding a test audience,
- running a test batch,
- checking readiness before launch.

What success looks like:
- the sequence is saved,
- test results look acceptable,
- the live-recipient path is ready for launch.

### Phase 4: Monitor and respond
Use:
- `Schedules`
- `Inbox`
- `Reports`
- `Readiness`

What you are doing:
- monitoring live sending,
- reviewing replies and opt-outs,
- checking outcome trends,
- deciding what needs attention next.

What success looks like:
- you know what is running,
- you know what the next send should be,
- you know whether replies, suppressions, or performance need follow-up.

## Key Playbooks
These are the most important operator tasks to know.

### 1. Select the correct client
Before you start:
- You are signed in.
- You know which client you are supposed to work on.

Steps:
1. Open `OpensDoors Clients` if you need to confirm the client record.
2. Review the client name and key details.
3. Open `Onboarding` or `OpensDoors Marketing`.
4. Use the visible client selector in that area.
5. Confirm the selected client matches the one you reviewed in `OpensDoors Clients`.

Success looks like:
- the client selector shows the right client,
- the data shown in the current tab matches the client you expect.

What to do next:
- go to `Onboarding` if setup is incomplete,
- go to `Readiness` if the client is already operating.

### 2. Link an email account
Before you start:
- The correct client is selected.
- You can complete the Microsoft sign-in flow.

Steps:
1. Open `OpensDoors Marketing -> Email Accounts`.
2. Click `Connect Outlook` or `Connect Outlook mailbox`.
3. Complete the Microsoft sign-in and consent flow.
4. Confirm the mailbox appears in the list.
5. Click `Manage mailbox`.
6. Review `Display Name`, `Daily Send Limit`, `Signature HTML`, and `Send Window`.
7. Click `Save Changes` if you changed anything.
8. Click `Send test email`.

Success looks like:
- the mailbox is visible in the list,
- the mailbox does not show obvious health issues,
- `Send test email` succeeds.

What to do next:
- move to `Templates` or `Sequences`.

### 3. Create a template
Before you start:
- The correct client is selected.
- You know the subject and message you want to send.

Steps:
1. Open `OpensDoors Marketing -> Templates`.
2. Click `Create template`.
3. Enter `Template Name`.
4. Choose `Category`.
5. Enter `Email Subject` and `Email Content`.
6. Insert the placeholder chips you need.
7. Optionally add `Preview Text (optional)` and `Tags`.
8. Click `Create Template`.
9. Click `Preview render`.

Success looks like:
- the template appears in the template library,
- the preview looks correct,
- the template is ready to use in a sequence step.

### 4. Improve a template with AI
Before you start:
- The template is open in edit mode.
- The current subject/body draft already exists.

Steps:
1. Open the template editor.
2. Review the current subject and body first.
3. Click `Improve with AI`.
4. Read the suggested rewrite carefully.
5. Check that placeholders and unsubscribe content still look correct.
6. Click `Apply suggestion` only if you want the editor draft replaced.
7. Click `Restore original` if you need to undo the applied suggestion.
8. Click `Save Changes` only after you are satisfied with the result.

Success looks like:
- the suggestion appears before save,
- the saved template changes only after you explicitly save it.

### 5. Preview a template correctly
Before you start:
- The template already exists.
- Ideally, the client and mailbox already exist.

Steps:
1. Open `OpensDoors Marketing -> Templates`.
2. Find the template.
3. Click `Preview render`.
4. Review the rendered subject and body.
5. Check where `{{email_signature}}` appears.
6. Check whether unsubscribe placement looks intentional.
7. Return to `Edit template` if anything looks wrong.

Success looks like:
- placeholders do not appear as broken raw text,
- the signature location looks correct,
- the body does not look broken or incomplete.

### 6. Create or prepare a sequence
Before you start:
- The correct client is selected.
- At least one mailbox exists.
- At least one template exists.
- A usable lead batch/list exists or is close to ready.

Steps:
1. Open `OpensDoors Marketing -> Sequences`.
2. Click `New Sequence`.
3. Enter `Sequence Name`.
4. Choose `Leads Snapshot`.
5. Choose `Sender`.
6. Add at least one step.
7. For each step, select a template.
8. Review the copied subject/body.
9. Set `Delay after previous step (days)`.
10. Click `Save draft`.

Success looks like:
- the sequence remains visible in the sequence list,
- you can reopen it and see its steps,
- you can use `Add test audience`.

### 7. Run a test batch
Before you start:
- The sequence is already saved.
- The correct client is selected.
- A sender identity exists.

Steps:
1. Open the saved sequence.
2. Click `Add test audience`.
3. Choose `Use linked lead batch recipients` or `Use manual test recipients`.
4. Enter or confirm the recipients.
5. Click `Save test recipients`.
6. Click `Send test batch now`.
7. Click `View send results`.
8. Review what sent, failed, or was blocked.

Success looks like:
- only test recipients are used,
- the live-recipient path is not launched,
- `View send results` shows a test-path outcome.

### 8. Start a live sequence
Before you start:
- The sequence is saved.
- The live lead batch/list is linked.
- The sender mailbox is correct.
- Test results are acceptable.
- Readiness warnings have been checked.

Steps:
1. Open the sequence.
2. Review the sender, sequence steps, and live-recipient setup.
3. Click `Review before start` if you need one more review pass.
4. Click `Start live sequence`.
5. Confirm the launch dialog.
6. Move to `Readiness` or `Schedules`.

Success looks like:
- the live campaign-backed sending path starts using the linked live recipients,
- `Schedules` shows live or paused schedule state,
- `Readiness` reflects the changed operational state.

### 9. Check schedule status
Before you start:
- A live or paused sequence-linked campaign already exists.

Steps:
1. Open `OpensDoors Marketing -> Schedules`.
2. Review the summary cards.
3. Click `Open summary` on the relevant schedule.
4. Read the operator message first.
5. Review `Status`, `Linked sequence`, `Mailbox`, `Daily cap`, `Send window`, and `Next send`.
6. Review `Upcoming sends` and `Recent outcomes`.

Success looks like:
- you understand what the live schedule is doing now,
- you know what should happen next,
- you know whether the issue belongs in `Sequences`, `Inbox`, or `Reports`.

### 10. Review inbox replies and opt-outs
Before you start:
- A client is selected.
- At least one mailbox has been receiving activity.

Steps:
1. Open `OpensDoors Marketing -> Inbox`.
2. Stay in `Conversations` for normal work.
3. Click `Needs action only` if you want a tighter review list.
4. Open a conversation.
5. Read the thread.
6. Reply with `Send Reply`, or use `Mark as Opt-out` if the sender should no longer be contacted.
7. Use `Check for new messages` if the inbox looks stale.

Success looks like:
- the reply is sent or the sender email is suppressed for future contact,
- the conversation state updates after refresh.

### 11. Check reports after sending
Before you start:
- A client is selected.
- Enough activity exists for reporting to be meaningful.

Steps:
1. Open `OpensDoors Marketing -> Reports`.
2. Choose the time window.
3. Click `Refresh`.
4. Review `Overview`.
5. Review `Leads vs target`.
6. Review source sections, outreach sections, mailbox sections, and `Compliance & health`.
7. Export CSV if needed.

Success looks like:
- you understand whether the current reporting window looks healthy, weak, or concerning,
- you know which operational tab to open next if something looks wrong.

## Module Reference
Use this section when you need a quick reminder of what each tab is for, what should already be done, and how to know whether you are finished.

### OpensDoors Clients
When to use it:
- before onboarding a new client,
- before changing marketing setup,
- when reports, inbox, or lead data look like they belong to the wrong client.

What you see:
- `Accounts`
- `Contacts`
- `Leads`

What to do:
1. Confirm the client name and key details in `Accounts`.
2. Check `Contacts` if you need people/context verification.
3. Check `Leads` only if you need client-side lead context before marketing work.

You are done when:
- you know the correct client is selected,
- the account and contact context looks correct enough to proceed.

### Onboarding
When to use it:
- when a client is being set up,
- when a client is being handed into operations,
- when you need to confirm onboarding progress before marketing work.

What to do:
1. Select or create the client.
2. Complete the `Client Onboarding` form.
3. Add contacts.
4. Connect mailboxes in the embedded email section.
5. Use `Open Suppression List` if safety setup is missing.
6. Review `Progress Tracker`.
7. Use `Review marketing readiness` before moving into live marketing work.
8. Use `Complete Onboarding` only when you intend to change client status to active.

You are done when:
- the onboarding details are saved,
- the progress tracker reflects meaningful progress,
- you know whether the next step is `Readiness`, `Email Accounts`, `Lead Sources`, `Suppression List`, `Templates`, or `Sequences`.

### Email Accounts
When to use it:
- to connect an Outlook mailbox,
- to review mailbox health,
- to update signature, send window, or send limit,
- to confirm a mailbox is actually ready for sending.

What to do:
1. Connect Outlook if no usable mailbox exists.
2. Open `Manage mailbox`.
3. Review display name, daily limit, signature, and send window.
4. Use `Send test email`.

You are done when:
- the mailbox appears in the active list,
- the mailbox does not show obvious health issues,
- the daily limit, signature, and send window are reviewed,
- `Send test email` succeeds.

### Lead Sources
When to use it:
- to connect or replace a source sheet,
- to refresh source data,
- to review batches and contacts,
- to hand the correct batch into `Sequences`.

What to do:
1. Connect or replace the relevant source.
2. Refresh from the sheet if needed.
3. Review batches.
4. Review contacts.
5. Click `Use in sequence` only after the batch looks correct.

You are done when:
- the source is connected,
- the batch and contact preview look usable,
- the correct batch has been handed into `Sequences`.

### Suppression List / Compliance
When to use it:
- to review whether email and domain protection are configured,
- to add manual protected entries,
- to connect, replace, or re-sync suppression sheets,
- to confirm the client looks safe to launch.

What to do:
1. Review email and domain protection cards.
2. Add urgent manual entries if needed.
3. Connect, replace, or refresh sheet-based protection.
4. Review both counts and actual rows.

You are done when:
- the correct client’s protection state is visible,
- counts and actual rows both look sensible for that client.

### Templates
When to use it:
- to create or edit outreach copy,
- to preview placeholders, signatures, and unsubscribe behavior,
- to use the AI rewrite helper.

What to do:
1. Create or edit the template.
2. Use placeholder chips instead of inventing token names.
3. Use `Improve with AI` only as a suggestion step.
4. Use `Preview render`.
5. Save the template.

You are done when:
- the template exists in the library,
- the rendered preview looks correct,
- the placeholders, signature, and unsubscribe behavior make sense,
- you are ready to use the template in `Sequences`.

### Sequences
When to use it:
- to build sequence drafts,
- to add test audiences,
- to run safe tests,
- to launch the live-recipient path.

What to do:
1. Create or open the sequence.
2. Set the name, live leads snapshot, and sender.
3. Add and review steps.
4. Save the draft.
5. Add a test audience.
6. Run `Send test batch now`.
7. Review results.
8. Use `Start live sequence` only when the live-recipient path is ready.

You are done when:
- the draft is saved,
- the steps are visible and correct,
- the sender and live snapshot are correct,
- test results look acceptable,
- `Schedules` reflects the live path after launch.

### Readiness
When to use it:
- after setup work,
- before live launch,
- during daily operations when you want the fastest current-state summary.

What to do:
1. Select the correct client and sequence.
2. Click `Refresh`.
3. Read `Launch Status`, `Issues to Review`, and `What to fix first`.
4. Use the most relevant next-step button.

You are done when:
- you know the current launch or operational state,
- you know what the next tab should be,
- you know whether the issue is setup, launch, inbox, or reporting related.

### Schedules
When to use it:
- after `Start live sequence`,
- when a previously launched sequence already exists,
- when you need to monitor active or paused live sending.

What to do:
1. Open the schedule summary.
2. Review `Status`, `Linked sequence`, `Mailbox`, `Daily cap`, `Send window`, `Next send`, `Upcoming sends`, and `Recent outcomes`.
3. Pause or resume only if a real operational change is required.
4. Use `Run safe test batch` only if you understand it is a linked sequence test action.

You are done when:
- you know the live schedule status,
- you know whether a pause or resume succeeded,
- you know whether the next action belongs in `Inbox`, `Reports`, or `Sequences`.

### Inbox
When to use it:
- when reply handling is the next real task,
- when you want to review stored conversations,
- when you need to record an opt-out.

What to do:
1. Stay in `Conversations` for actual reply handling.
2. Use `Needs action only` as a helper, not as your only source of truth.
3. Reply or opt out.
4. Use `Check for new messages` if the stored inbox view looks stale.

You are done when:
- the reply was sent or the opt-out was applied,
- the conversation state looks updated,
- you know whether the next step belongs in `Suppression List`, `Reports`, or `Readiness`.

### Reports
When to use it:
- after sending activity already exists,
- when you need an outcome review,
- when you need to decide which operational tab should be used next.

What to do:
1. Select the correct client and time window.
2. Click `Refresh`.
3. Read `Overview` first.
4. Review source, outreach, mailbox, and `Compliance & health` sections.
5. Use `Activity trend` last.

You are done when:
- you understand which section is healthy or weak,
- you know which operational tab should be used next,
- you are not overclaiming precision for metrics the dashboard does not fully populate yet.

## Known Limits and Gotchas
These are the most important non-obvious behaviors to remember while operating ODCRM.

### 1. `Start live sequence` and `Send test batch now` are different paths
- `Start live sequence` uses linked live recipients.
- `Send test batch now` uses active test enrollments only.
- A successful test send does not prove the live-recipient path has already been exercised in the same way.

What to do:
- use `Sequences` for test-audience work,
- use `Schedules` for live status after launch,
- use `Readiness` if you need a compact explanation of blockers.

### 2. `Schedules` is not a schedule builder
- The tab monitors running or paused sequence-linked campaign state.
- It is the live-operations surface, not the place to configure the whole sending model.

What to do:
- go back to `Sequences` when you need to change setup,
- stay in `Schedules` when you only need to monitor or pause/resume.

### 3. Turned-off mailboxes can disappear from the active list
- `Turn off mailbox` and `Disconnect mailbox` both make a mailbox inactive.
- The normal marketing list only shows active identities.

What to do:
- be sure before turning a mailbox off,
- remember that a missing mailbox may have been made inactive rather than deleted.

### 4. Mailbox daily limits are clamped
- Mailbox daily send limits are currently clamped to 30.

What to do:
- treat a capped mailbox as a real sending limiter, not a cosmetic warning.

### 5. Template preview is useful, but it is not a send
- Preview helps catch placeholder issues.
- It does not prove the live and test send paths are identical.

What to do:
- preview the template,
- then run a test batch,
- then review readiness before live start.

### 6. Shared template edits do not auto-update saved sequence steps
- Once a template is copied into a sequence step, that step has its own saved content.

What to do:
- if you update a shared template later, review the relevant sequence step again.

### 7. Some sequence diagnostics are not part of the normal operator path
- `Sequences` mixes standard workflow with deeper diagnostics.

What to do:
- start with create/edit, test audience, test batch, and live start,
- move into troubleshooting panels only when something actually needs investigation.

### 8. `Run safe test batch` is not the same as sending the live schedule immediately
- It uses the linked sequence test-send flow.
- Mailbox mismatch can disable it.

What to do:
- if the schedule mailbox and linked sequence mailbox do not match, fix the relationship in the sequence path.

### 9. `Use in sequence` is a handoff, not a launch
- It passes the selected batch into the sequence workflow.
- It does not create live sending on its own.

What to do:
- review the batch and contacts first,
- then move to `Sequences` for testing and launch.

### 10. `Suppression List` and `Compliance` are the same current module
- The sub-tab label and page heading are not identical.

What to do:
- treat them as one safety/protection area for operators.

### 11. `Connected` does not automatically mean a suppression source imported many rows
- A source can be linked but still have low or zero useful rows.

What to do:
- review both counts and actual rows, not just the connected state.

### 12. `Recent replies` is not the full inbox
- It is a focused reply-monitoring slice.
- `Needs action only` is helpful, but not perfect.

What to do:
- use `Conversations` for real reply work,
- use `Recent replies` for scanning only,
- sanity-check the broader conversation list if needed.

### 13. `Complete Onboarding` is a real status change
- It changes the client to active.
- It is not fully checklist-gated by the backend.

What to do:
- do not treat it as a harmless final button,
- still check mailbox readiness, lead sources, suppression, templates, and sequence setup before launch.

### 14. Some reporting metrics can be unavailable
- The current dashboard is the operator-facing reporting truth.
- Some metrics such as `Positive replies` or `Meetings booked` can still be unavailable.

What to do:
- use the dashboard as the current reporting truth,
- do not overclaim precision where the UI is sparse or unavailable.
