# ODCRM Task Playbooks

## Purpose
Use these playbooks when you need exact, operational instructions. Each playbook is written to answer the same questions:
- what are you trying to do,
- what must already be true,
- what exact steps should you take,
- what result should you expect,
- how do you verify success,
- where do you go next if it worked,
- what usually goes wrong.

## Select the correct client
### Goal
Make sure every later action happens in the correct client context.

### Before you start
- You are signed in.
- You know which client you are supposed to be working on.

### Exact steps
1. Open `OpensDoors Clients` if you need to confirm the client record.
2. Review the client name and key details.
3. Open `Onboarding` or `OpensDoors Marketing`.
4. Use the visible client selector in that area.
5. Confirm the selected client matches the one you reviewed in `OpensDoors Clients`.

### Expected result
The correct client is selected before you start any setup, sending, inbox, or reporting task.

### How to verify success
- The client selector shows the right client.
- The data shown in the current tab matches the client you expect.

### What to do next
- Go to `Onboarding` if setup is incomplete.
- Go to `Readiness` if the client is already operating.

### Common failure points
- Starting in Marketing with the wrong client selected.
- Assuming the last selected client is still correct.

## Link an email account
### Goal
Connect a sending mailbox that ODCRM can use for preview, sequence sending, and live schedule activity.

### Before you start
- The correct client is selected.
- You can complete the Microsoft sign-in flow.

### Exact steps
1. Open `OpensDoors Marketing -> Email Accounts`.
2. Confirm the correct client is selected.
3. Click `Connect Outlook` or `Connect Outlook mailbox`.
4. Complete the Microsoft sign-in and consent flow.
5. Return to ODCRM.
6. Confirm the mailbox appears in the list.
7. Click `Manage mailbox`.
8. Review `Display Name`.
9. Review `Daily Send Limit`.
10. Review `Signature HTML`.
11. Review `Send Window`.
12. Click `Save Changes` if you changed anything.
13. Click `Send test email`.

### Expected result
The mailbox appears in the Email Accounts list and can be treated as a usable sender identity.

### How to verify success
- The mailbox is visible in the list.
- The mailbox does not show obvious health issues.
- `Send test email` succeeds.

### What to do next
Move to `Templates` or `Sequences`.

### Common failure points
- No client selected before connect.
- Mailbox connected but not reviewed for cap, signature, or send window.
- Assuming connect alone proves the mailbox is ready.

## Create a template
### Goal
Create reusable outreach copy that can be used in sequence steps.

### Before you start
- The correct client is selected.
- You know the subject and message you want to send.

### Exact steps
1. Open `OpensDoors Marketing -> Templates`.
2. Confirm the correct client is selected.
3. Click `Create template`.
4. Enter `Template Name`.
5. Choose `Category`.
6. Enter `Email Subject`.
7. Enter `Email Content`.
8. Insert the placeholder chips you need.
9. Add `Preview Text (optional)` only if you want it for the editor/library flow.
10. Add tags only if useful for your team, but do not treat them as the most important saved data.
11. Click `Create Template`.

### Expected result
A reusable template appears in the template library for that client.

### How to verify success
- The template card appears in the library.
- You can open `Preview render` or `Edit template` on it.

### What to do next
Use the template in [Sequences](./modules/SEQUENCES.md).

### Common failure points
- Forgetting the correct client context.
- Writing copy without checking placeholders.
- Assuming preview text or tags are as important as the core template body.

## Improve a template with AI
### Goal
Use the AI suggestion flow to improve the template wording without silently saving anything.

### Before you start
- The template is open in edit mode.
- The current subject/body draft already exists.

### Exact steps
1. Open the template editor.
2. Review the current subject and body first.
3. Click `Improve with AI`.
4. Read the suggested rewrite carefully.
5. Check that placeholders and unsubscribe content still look correct.
6. Click `Apply suggestion` only if you want the editor draft replaced.
7. Click `Restore original` if you need to undo the applied suggestion.
8. Click `Save Changes` only after you are satisfied with the result.

### Expected result
The editor gives you a suggested rewrite, and you stay in control of whether that suggestion becomes the saved draft.

### How to verify success
- The suggestion appears before save.
- The saved template changes only after you explicitly save it.

### What to do next
Use `Preview render` before moving into `Sequences`.

### Common failure points
- Treating AI output as auto-saved.
- Applying a suggestion without checking placeholders.

## Preview a template correctly
### Goal
Check whether placeholders, sender details, signature placement, and unsubscribe behavior look right before sequence use.

### Before you start
- The template already exists.
- Ideally, the client and at least one mailbox already exist.

### Exact steps
1. Open `OpensDoors Marketing -> Templates`.
2. Find the template.
3. Click `Preview render`.
4. Review the rendered subject.
5. Review the rendered body.
6. Check where `{{email_signature}}` appears.
7. Check whether unsubscribe placement looks intentional.
8. If the preview looks wrong, close the preview and return to `Edit template`.

### Expected result
You understand whether the template is safe to use in a sequence step.

### How to verify success
- Placeholder text no longer appears as raw tokens unless you intentionally left unsupported text in place.
- The signature location looks correct.
- The body does not look broken or incomplete.

### What to do next
Move to `Sequences` and use the template in a step.

### Common failure points
- Assuming preview is the same as a live send.
- Forgetting that ODCRM also enforces unsubscribe handling in send paths.

## Create or prepare a sequence
### Goal
Build a reusable sequence draft that is ready for testing.

### Before you start
- The correct client is selected.
- At least one mailbox exists.
- At least one template exists.
- A usable lead batch/list exists or is close to ready.

### Exact steps
1. Open `OpensDoors Marketing -> Sequences`.
2. Click `New Sequence`.
3. Enter `Sequence Name`.
4. Choose `Leads Snapshot`.
5. Choose `Sender`.
6. Add at least one step.
7. For each step, select a template.
8. Review the copied subject/body in the step.
9. Set `Delay after previous step (days)`.
10. Click `Save draft`.

### Expected result
The sequence is saved and ready for test-audience work.

### How to verify success
- The sequence remains visible in the sequence list.
- You can re-open it and see its steps.
- You can use `Add test audience`.

### What to do next
Add a test audience and run a test batch.

### Common failure points
- No sender selected.
- No live leads snapshot selected.
- Confusing draft save with live launch.

## Run a test batch
### Goal
Send only to test recipients so you can validate the sequence safely before live launch.

### Before you start
- The sequence is already saved.
- The correct client is selected.
- A sender identity exists.

### Exact steps
1. Open the saved sequence.
2. Click `Add test audience`.
3. Choose `Use linked lead batch recipients` or `Use manual test recipients`.
4. If using manual recipients, enter the test emails.
5. Click `Save test recipients`.
6. Click `Send test batch now`.
7. Click `View send results`.
8. Review what sent, failed, or was blocked.

### Expected result
Only test recipients are used. The live recipient path is not launched.

### How to verify success
- The UI confirms test recipients were prepared.
- `View send results` shows a test-path outcome.
- No live launch action was triggered.

### What to do next
Fix problems, or move to `Start live sequence` if the test result is acceptable.

### Common failure points
- Assuming the test batch uses the same path as live launch.
- Forgetting to save the sequence first.

## Start a live sequence
### Goal
Launch the live recipient path for the sequence.

### Before you start
- The sequence is saved.
- The live lead batch/list is linked.
- The sender mailbox is correct.
- Test results are acceptable.
- Readiness warnings have been checked.

### Exact steps
1. Open the sequence.
2. Review the sender, sequence steps, and live-recipient setup.
3. Click `Review before start` if you need one more review pass.
4. Click `Start live sequence`.
5. Confirm the launch dialog.
6. Return to `Readiness` or move directly to `Schedules`.

### Expected result
The live campaign-backed sending path starts using the linked live recipients.

### How to verify success
- The sequence no longer looks like a draft-only item.
- `Schedules` shows live/paused schedule state for the launched path.
- `Readiness` reflects the changed operational state.

### What to do next
Open `Schedules` first, then `Inbox`, then `Reports`.

### Common failure points
- No live recipients linked.
- Confusing test audience with live recipients.
- Launching before checking mailbox or suppression readiness.

## Check schedule status and next send
### Goal
Confirm what is currently happening in the live sending path.

### Before you start
- A live or paused sequence-linked campaign already exists.

### Exact steps
1. Open `OpensDoors Marketing -> Schedules`.
2. Select the correct client.
3. Review the summary cards.
4. Click `Open summary` on the relevant schedule.
5. Read the operator message first.
6. Check `Status`.
7. Check `Linked sequence`.
8. Check `Mailbox`.
9. Check `Daily cap`.
10. Check `Send window`.
11. Check `Next send`.
12. Review `Upcoming sends`.

### Expected result
You understand what the live schedule is doing now and what should happen next.

### How to verify success
- The selected schedule summary matches the sequence you expect.
- The `Next send` and `Upcoming sends` values are visible if ODCRM has them.

### What to do next
- If something is blocked, go to `Readiness` or `Sequences`.
- If something is active, move to `Inbox` or `Reports` as needed.

### Common failure points
- Treating this tab as a scheduler builder.
- Ignoring mailbox mismatch warnings.

## Review recent send outcomes
### Goal
See whether actual sends and outcomes look healthy.

### Before you start
- A sequence has already been tested or launched.

### Exact steps
1. Start in `Readiness` for a compact summary.
2. Open `Open run history` or `Open preview comparison` if available.
3. Open `Schedules` for the live-status view.
4. Review `Recent outcomes` there.
5. Open `Reports` for longer-range context.

### Expected result
You can tell whether the recent send path looked normal, blocked, or risky.

### How to verify success
- You can point to the tab showing the issue.
- You can tell whether the problem is setup, launch logic, reply handling, or trend-level reporting.

### What to do next
- Use `Inbox` for reply-side issues.
- Use `Sequences` for launch/test issues.
- Use `Email Accounts`, `Lead Sources`, or `Suppression List` if the issue is a prerequisite problem.

### Common failure points
- Looking only in one tab and assuming that is the full truth.

## Connect or replace a suppression sheet
### Goal
Make sure ODCRM has the current DNC/protection sheet for the selected client.

### Before you start
- The correct client is selected.
- You have the Google Sheet URL.
- You know whether you are connecting for the first time or replacing an existing source.

### Exact steps
1. Open `OpensDoors Marketing -> Suppression List`.
2. Select the correct client.
3. Choose `Email suppression` or `Domain suppression`.
4. Open the source settings area.
5. Paste the `Google Sheet URL`.
6. Click `Connect source` if there is no existing source.
7. Click `Replace source` if you are intentionally replacing the existing source.
8. Wait for the import to finish.
9. Click `Refresh protection status` if needed.
10. Review the status cards and the table.

### Expected result
ODCRM links to the sheet and updates the client-scoped protection data.

### How to verify success
- The source now shows as connected.
- The count/status refreshes.
- The protection entries match what you expect more closely than before.

### What to do next
Return to `Readiness`, `Sequences`, or `Schedules`.

### Common failure points
- Using the wrong client.
- Thinking replace is only a label change.
- Assuming connected always means the sheet imported many rows.

## Review inbox replies and opt-outs
### Goal
Work real reply conversations and stop future contact when needed.

### Before you start
- A client is selected.
- At least one mailbox has been receiving activity.

### Exact steps
1. Open `OpensDoors Marketing -> Inbox`.
2. Select the correct client.
3. Stay in `Conversations` for normal work.
4. Click `Needs action only` if you want a tighter review list.
5. Open a conversation.
6. Read the thread.
7. If you need to reply, enter text in `Type your reply...` and click `Send Reply`.
8. If the sender should no longer be contacted, click `Mark as Opt-out`.
9. If the inbox looks stale, click `Check for new messages`.

### Expected result
The reply is sent, or the sender email is suppressed for future contact.

### How to verify success
- The reply appears as part of the conversation flow.
- The opt-out action completes without error.
- The conversation list reflects the latest stored state after refresh.

### What to do next
- Review `Suppression List` if you want to confirm protection state.
- Move to `Reports` if you need outcome context.

### Common failure points
- Using `Recent replies` as if it were the full inbox.
- Relying only on the unread-only filter.

## Check reports after sending
### Goal
Review whether recent outreach activity still looks healthy.

### Before you start
- A client is selected.
- Enough activity exists for reporting to be meaningful.

### Exact steps
1. Open `OpensDoors Marketing -> Reports`.
2. Select the correct client.
3. Choose the reporting window.
4. Click `Refresh`.
5. Review `Overview`.
6. Review `Leads vs target`.
7. Review `Leads by source` and `Top sourcers (by lead count)`.
8. Review `Outreach performance`.
9. Review `Performance by mailbox`.
10. Review `Compliance & health`.
11. Export CSV if needed.

### Expected result
You understand whether the current reporting window shows healthy, weak, or concerning outcomes.

### How to verify success
- The dashboard loads data for the correct client and time window.
- You can identify which section needs further investigation if something looks wrong.

### What to do next
- Go to `Inbox` for reply-side issues.
- Go to `Schedules` for live-state issues.
- Go to `Email Accounts`, `Lead Sources`, or `Suppression List` for setup-side issues.

### Common failure points
- Treating Reports like a live inbox.
- Overreading metrics that are not fully populated yet.

## Verify lead source readiness
### Goal
Make sure a source is truly usable before relying on it in a live sequence.

### Before you start
- A client is selected.
- A lead-source sheet is already connected, or ready to be connected.

### Exact steps
1. Open `OpensDoors Marketing -> Lead Sources`.
2. Select the correct client.
3. Review the source cards.
4. If needed, click `Connect source` or `Replace source`.
5. Click `Refresh from sheet` if counts look stale.
6. Click `Review batches`.
7. Choose a recent usable batch.
8. Click `Review contacts`.
9. Confirm the contacts look usable.
10. Click `Use in sequence` only after the batch looks correct.

### Expected result
You know whether the source is usable for downstream sequence work.

### How to verify success
- The source is connected.
- You can review batches.
- You can review actual contacts in the batch.

### What to do next
Move to [Sequences](./modules/SEQUENCES.md).

### Common failure points
- Assuming source connection alone means the data is ready.
- Skipping the contact-review step.


