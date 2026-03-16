# ODCRM Task Playbooks

## Purpose
Use these playbooks when you need exact operator steps instead of a full module walkthrough.

## Connect an email account
1. Open `Marketing -> Email Accounts`.
2. Select the correct client.
3. Click `Connect Outlook`.
4. Complete the Microsoft sign-in flow.
5. Return to ODCRM.
6. Confirm the mailbox appears in the list.
7. Click `Manage mailbox`.
8. Review `Display Name`, `Daily Send Limit`, `Signature HTML`, and `Send Window`.
9. Click `Save Changes` if you updated anything.
10. Use `Send test email` before depending on that mailbox in Sequences.

## Create a template
1. Open `Marketing -> Templates`.
2. Select the correct client.
3. Click `Create template`.
4. Enter `Template Name`.
5. Choose `Category`.
6. Enter `Email Subject`.
7. Enter `Email Content`.
8. Insert the placeholder chips you need.
9. Optionally add preview text and tags, but treat those as secondary metadata.
10. Save the template.
11. Click `Preview render` to validate the output.

## Improve a template with AI
1. Open or create the template.
2. Make sure the current subject/body draft is loaded.
3. Choose the AI tone option if shown.
4. Click `Improve with AI`.
5. Read the suggested rewrite carefully.
6. Click `Apply suggestion` only if you want to replace the draft in the editor.
7. Click `Restore original` if you need to undo the applied suggestion.
8. Save the template normally.

## Create or operate a sequence
1. Open `Marketing -> Sequences`.
2. Select the correct client.
3. Click `New Sequence` or open an existing one.
4. Fill `Sequence Name`, `Leads Snapshot`, and `Sender`.
5. Add at least one step.
6. Choose a template for each step.
7. Review the copied subject/body.
8. Set `Delay after previous step (days)`.
9. Click `Save draft`.
10. Add a test audience before attempting a live start.

## Run a test send
1. Open the saved sequence.
2. Click `Add test audience`.
3. Choose `Use linked lead batch recipients` or `Use manual test recipients`.
4. Save the test recipients.
5. Click `Send test batch now`.
6. Click `View send results`.
7. Check what sent, failed, or was blocked.
8. Fix issues before using `Start live sequence`.

## Start a live sequence
1. Confirm the sequence is saved.
2. Confirm the live lead batch/list is linked.
3. Confirm the sender mailbox is correct.
4. Review readiness and preflight warnings.
5. Click `Start live sequence`.
6. Confirm the launch dialog.
7. Move to `Schedules` and `Readiness` to monitor the live path.

## Check schedule status
1. Open `Marketing -> Schedules`.
2. Select the correct client.
3. Review the summary cards.
4. Click `Open summary` on the relevant schedule.
5. Check `Status`, `Linked sequence`, `Mailbox`, `Daily cap`, `Send window`, and `Next send`.
6. Review `Recent outcomes` and `Upcoming sends`.
7. Use `Refresh schedules` or `Refresh follow-up detail` if needed.

## Pause or resume a schedule
1. Open the schedule summary.
2. Click `Pause schedule` to stop live activity, or `Resume schedule` to restart it.
3. Confirm the status changes.
4. Refresh the detail view if needed.

## Review outcomes or failures
1. Start in `Readiness` for a compact view.
2. Use `Open run history` or `Open preview comparison` if available.
3. Move to `Schedules` for live-status detail.
4. Move to `Inbox` if you need to inspect reply-side effects.
5. Move to `Reports` for the broader performance picture.

## Manage the DNC / suppression sheet
1. Open `Marketing -> Suppression List`.
2. Select the correct client.
3. Choose `Email suppression` or `Domain suppression`.
4. To connect a source, paste the `Google Sheet URL` and click `Connect source`.
5. To replace an existing source, click `Replace source`.
6. To refresh the existing source, click `Re-sync source`.
7. Review the protection cards and table after sync.
8. Add urgent manual entries with `Value`, optional `Reason`, and `Add protection`.

## Review inbox reply-stop behavior
1. Open `Marketing -> Inbox`.
2. Select the client.
3. Work from `Conversations` first.
4. Open the thread that needs attention.
5. If the sender should no longer be contacted, click `Mark as Opt-out`.
6. Use `Check for new messages` if you need fresher stored inbox data.
7. Review `Suppression List` if you want to confirm the resulting protected state.

## Check reports
1. Open `Marketing -> Reports`.
2. Select the client.
3. Choose the reporting window.
4. Click `Refresh`.
5. Review `Overview`, `Leads vs target`, `Leads by source`, `Outreach performance`, `Performance by mailbox`, and `Compliance & health`.
6. Use `Export CSV` where needed.

## Use onboarding where relevant
1. Open `Onboarding`.
2. Select the client, or create one with `+ Create new client...`.
3. Use `Client Onboarding` to complete account, contact, email, and profile data.
4. Use `Progress Tracker` for cross-team completion tracking.
5. Use `Review marketing readiness` when setup is nearly complete.
6. Use `Complete Onboarding` only when the client is genuinely ready to move to active status.
