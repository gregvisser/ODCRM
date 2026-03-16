# ODCRM User Training Master Index

## Purpose
This training set is for real ODCRM users who need to operate the product as it exists today. It is not presentation guidance and it is not product marketing copy. Each guide is grounded in the current implementation and calls out important limits where the UI can be misleading.

## Audience
Primary audience:
- Agency-side operators running client outreach inside ODCRM.
- Account managers and onboarding staff setting up a new client.
- Team leads and trainers who need a stable, implementation-based learning path.

Secondary audience:
- Admin users who need enough context to guide operators into the right tabs.

## Role assumptions
Current training assumes the normal agency/operator-facing ODCRM mode.

What that means in practice:
- You usually pick a client, then work inside Marketing or Onboarding for that client.
- Tenant isolation matters. Marketing data is scoped per client/customer.
- `Settings` exists, but it is an admin/setup area, not the main daily-work path.

## How to use this training
Read the docs in the order below the first time.
After that, use the task playbooks for day-to-day work.
If something in the app looks different from the docs, check the ground-truth audit first and then the gotchas file.

## Recommended learning order
1. [Workflow Overview](./ODCRM_USER_WORKFLOW_OVERVIEW.md)
2. [Clients](./modules/CLIENTS.md)
3. [Onboarding](./modules/ONBOARDING.md)
4. [Readiness](./modules/READINESS.md)
5. [Email Accounts](./modules/EMAIL_ACCOUNTS.md)
6. [Lead Sources](./modules/LEAD_SOURCES.md)
7. [Compliance and Suppression](./modules/COMPLIANCE_AND_SUPPRESSION.md)
8. [Templates](./modules/TEMPLATES.md)
9. [Sequences](./modules/SEQUENCES.md)
10. [Schedules](./modules/SCHEDULES.md)
11. [Inbox](./modules/INBOX.md)
12. [Reports](./modules/REPORTS.md)
13. [Task Playbooks](./ODCRM_TASK_PLAYBOOKS.md)
14. [Known Limits and Gotchas](./ODCRM_KNOWN_LIMITS_AND_GOTCHAS.md)
15. [Admin Notes for Trainers](./ODCRM_ADMIN_NOTES_FOR_TRAINERS.md)

## Start-here workflows
### If you are setting up a brand-new client
1. Read [Onboarding](./modules/ONBOARDING.md).
2. Connect mailboxes in [Email Accounts](./modules/EMAIL_ACCOUNTS.md).
3. Connect lead sheets in [Lead Sources](./modules/LEAD_SOURCES.md).
4. Connect suppression sources in [Compliance and Suppression](./modules/COMPLIANCE_AND_SUPPRESSION.md).
5. Create core copy in [Templates](./modules/TEMPLATES.md).
6. Build and test the sequence in [Sequences](./modules/SEQUENCES.md).
7. Confirm readiness in [Readiness](./modules/READINESS.md).
8. Monitor activity in [Schedules](./modules/SCHEDULES.md), [Inbox](./modules/INBOX.md), and [Reports](./modules/REPORTS.md).

### If you are operating an already-live client
1. Start in [Readiness](./modules/READINESS.md) for current blockers and next actions.
2. Use [Schedules](./modules/SCHEDULES.md) to monitor active sending.
3. Use [Inbox](./modules/INBOX.md) to work replies and opt-outs.
4. Use [Reports](./modules/REPORTS.md) to review outcomes.
5. Go back to [Templates](./modules/TEMPLATES.md), [Sequences](./modules/SEQUENCES.md), or [Lead Sources](./modules/LEAD_SOURCES.md) only when you need to change setup.

### If you only need step-by-step instructions
Start with [Task Playbooks](./ODCRM_TASK_PLAYBOOKS.md).

## Main tabs and what they are for
### OpensDoors Clients
Use this area for core client/account data, contacts, and lead records. This is where you confirm the underlying client record you are about to operate on.

### OpensDoors Marketing
This is the main outreach workspace. It contains the readiness, setup, sending, inbox, and reporting flow.

### Onboarding
Use this when a client is being set up or formally handed into operations. It contains the progress tracker and the detailed onboarding form.

### Settings
Treat this as admin/setup only. Current sub-tabs are `User Authorization` and `Troubleshooting & Feedback`. Operators should not treat this as the normal place to start daily work.

## Training document map
### Core workflow docs
- [Workflow Overview](./ODCRM_USER_WORKFLOW_OVERVIEW.md)
- [Task Playbooks](./ODCRM_TASK_PLAYBOOKS.md)
- [Known Limits and Gotchas](./ODCRM_KNOWN_LIMITS_AND_GOTCHAS.md)

### Module docs
- [Clients](./modules/CLIENTS.md)
- [Onboarding](./modules/ONBOARDING.md)
- [Readiness](./modules/READINESS.md)
- [Email Accounts](./modules/EMAIL_ACCOUNTS.md)
- [Lead Sources](./modules/LEAD_SOURCES.md)
- [Compliance and Suppression](./modules/COMPLIANCE_AND_SUPPRESSION.md)
- [Templates](./modules/TEMPLATES.md)
- [Sequences](./modules/SEQUENCES.md)
- [Schedules](./modules/SCHEDULES.md)
- [Inbox](./modules/INBOX.md)
- [Reports](./modules/REPORTS.md)

### Audit and trainer docs
- [Ground-Truth Audit](../audits/USER_TRAINING_GROUND_TRUTH_AUDIT.md)
- [Admin Notes for Trainers](./ODCRM_ADMIN_NOTES_FOR_TRAINERS.md)

## Glossary
### Client
The operator-facing word for the account you are working on. In backend code this is often stored as a `customer`.

### Customer
The backend model term for a client. Many APIs and headers use `customerId` even when the UI says `client`.

### Readiness
A combined status signal that tells you whether the current client or sequence is ready to move forward, blocked, or already active.

### Sender identity / mailbox
A connected email account used for sending. In code this is an `emailIdentity`.

### Lead source
A connected Google Sheet source such as Cognism, Apollo, Social, or Blackbook.

### Suppression / DNC
The protected list of emails or domains that must not be contacted.

### Template
Reusable subject and body copy used when building outreach steps.

### Sequence
A reusable outreach plan made of steps. In ODCRM, the saved sequence definition is not identical to the live sending path.

### Test audience
Queue-backed test recipients used for safe sending checks.

### Live recipients
The real linked lead batch or list used when you click `Start live sequence`.

### Enrollment
A test-send container created for sequence testing. It creates queue items for test sending.

### Schedule
The operator-facing view of active or paused sequence-linked sending. Backend truth is campaign-backed, not a separate schedule model.

### Reply-stop
A stopped-contact state caused by reply detection or opt-out handling so that future outreach is blocked.

### Unsubscribe footer
The footer ODCRM ensures is present in send paths, even if a user forgets to add an unsubscribe token manually.

## Reality check
These docs are based on the implementation audited on SHA `9469db8060f497a43f1bd0b8cd3a34223ce5ce1a`. When behavior is non-obvious, the docs call it out directly rather than smoothing it over.
