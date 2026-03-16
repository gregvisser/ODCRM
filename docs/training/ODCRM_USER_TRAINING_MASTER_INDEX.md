# ODCRM User Training Master Index

## Purpose
This training set is for real ODCRM users who need to operate the product as it exists today. It is not presentation coaching, and it is not product marketing copy. The goal is simple: a user should be able to open these docs, work through the tabs in the right order, and operate ODCRM with fewer avoidable mistakes.

## Who this training is for
Primary audience:
- agency-side operators running client outreach inside ODCRM,
- account managers and onboarding staff setting up new clients,
- team leads and trainers onboarding new users into the system.

Secondary audience:
- admin users who need enough context to guide operators into the correct workflow.

## Role assumptions
This training assumes the current agency/operator-facing ODCRM mode.

What that means in practice:
- you usually select a client first,
- you then work inside `OpensDoors Marketing` or `Onboarding` for that client,
- `Settings` exists, but it is not the normal daily-work starting point.

## How to use this training set
### First time through
1. Start with [Workflow Overview](./ODCRM_USER_WORKFLOW_OVERVIEW.md).
2. Read the module docs in the recommended order below.
3. Use [Task Playbooks](./ODCRM_TASK_PLAYBOOKS.md) for real click-by-click work.
4. Keep [Known Limits and Gotchas](./ODCRM_KNOWN_LIMITS_AND_GOTCHAS.md) nearby when something feels confusing.

### Returning user
- Use the module docs for tab-specific questions.
- Use the playbooks for exact tasks.
- Use the gotchas file when the UI behaves differently from what a user might expect.

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

## Quickstarts
Quick operational quickstarts live in [Workflow Overview](./ODCRM_USER_WORKFLOW_OVERVIEW.md):
- `First day as a new ODCRM operator`
- `Daily operator checklist`

## Start-here workflows
### If you are setting up a brand-new client
Read in this order:
1. [Clients](./modules/CLIENTS.md)
2. [Onboarding](./modules/ONBOARDING.md)
3. [Email Accounts](./modules/EMAIL_ACCOUNTS.md)
4. [Lead Sources](./modules/LEAD_SOURCES.md)
5. [Compliance and Suppression](./modules/COMPLIANCE_AND_SUPPRESSION.md)
6. [Templates](./modules/TEMPLATES.md)
7. [Sequences](./modules/SEQUENCES.md)
8. [Readiness](./modules/READINESS.md)
9. [Schedules](./modules/SCHEDULES.md)
10. [Inbox](./modules/INBOX.md)
11. [Reports](./modules/REPORTS.md)

### If you are operating an already-live client
Start here:
1. [Readiness](./modules/READINESS.md)
2. [Schedules](./modules/SCHEDULES.md)
3. [Inbox](./modules/INBOX.md)
4. [Reports](./modules/REPORTS.md)

Then go back to these only if something needs changing:
- [Email Accounts](./modules/EMAIL_ACCOUNTS.md)
- [Lead Sources](./modules/LEAD_SOURCES.md)
- [Compliance and Suppression](./modules/COMPLIANCE_AND_SUPPRESSION.md)
- [Templates](./modules/TEMPLATES.md)
- [Sequences](./modules/SEQUENCES.md)

### If you only need exact task steps
Go straight to [Task Playbooks](./ODCRM_TASK_PLAYBOOKS.md).

## Main tabs and what they are for
### `OpensDoors Clients`
Use this area to confirm the correct client record, review account and contact data, and make sure you are operating in the right client context before working in marketing.

### `OpensDoors Marketing`
This is the main operator workspace. It contains the setup, sending, monitoring, inbox, and reporting flow.

### `Onboarding`
Use this when a client is being set up, handed into operations, or checked for readiness to move into marketing work.

### `Settings`
Treat this as admin/setup-only. Current sub-tabs are `User Authorization` and `Troubleshooting & Feedback`. Operators should not use this as the normal place to begin daily work.

## Training map
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
A combined status signal telling you whether a client or sequence is blocked, incomplete, ready to move forward, or already active.

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
A stopped-contact state caused by reply detection or opt-out handling so future outreach is blocked.

### Unsubscribe footer
The footer ODCRM ensures is present in send paths, even if a user forgets to add an unsubscribe token manually.

## Reality check
These docs are based on the implementation audited on SHA `9469db8060f497a43f1bd0b8cd3a34223ce5ce1a`. When behavior is non-obvious, the docs say so directly rather than smoothing it over.
