# Reply.io Study - Deliverability & Compliance

## Exploration Date
2026-01-24

## Current Status
**STEP 7: DELIVERABILITY/COMPLIANCE** - ✅ Blacklist (suppression list) settings observed.

## Blacklist / Suppression

### Purpose
- UI copy: “Add email domains to the blacklist to avoid contacting unwanted organizations.”
- Input format guidance: “domain.com (without ‘http://’ or ‘www’)”

### Actions
- **Add domains** button to create/append blacklist entries.

## Email Settings (Observed)

### Email Safety
- “Email safety” section for general safeguards (delay before first email, max emails per day).
- **Auto replies & bounces in email client**: dropdown action (default “Do nothing”).
- **Auto replies & bounces in Reply inbox**: dropdown action (default “Do not display”).
- **Delay before sending first email**: seconds input (example: 30 seconds).
- **Max daily emails per contact**: numeric input (example: 1).

### Email Notifications
- Configure daily/weekly/monthly email reports for users.

### BCC Settings
- Configure BCC for outbound emails.
- Option to BCC incoming replies to same or different address.

### Out Of Office Handling
- Toggle to automatically resume contacts after a set number of days.
- Contacts return to **Active** and continue sequence if no reply.

### Open Tracking
- Bulk enable/disable open tracking across sequences.
- Notes improved deliverability by removing tracking pixel.

### Automatic Email Validation
- Toggle for validating emails added to sequences (subject to credit balance).

### Sequence Account Assignment
- **Sequence email accounts**: set up email accounts used in sequences.
- **Sequence LinkedIn accounts**: set up LinkedIn accounts used in sequences.

## Assumptions (Explicit)
- The blacklist operates at the **domain** level (not individual email addresses) based on the guidance text.
- This likely acts as a suppression list for sequences/campaigns, but cross‑feature enforcement is not confirmed.
