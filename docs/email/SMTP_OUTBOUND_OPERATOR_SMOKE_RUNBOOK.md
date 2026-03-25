# SMTP outbound — operator smoke runbook

**Scope:** Outbound sending only (campaigns + sequences). No OAuth, no IMAP, no inbox sync for SMTP identities.

## What SMTP supports (today)

- **Supported**: Outbound sends for `EmailIdentity.provider === 'smtp'` via nodemailer (`server/src/services/smtpMailer.ts`).
- **Not supported**: Inbox/reply sync, Graph-style threading, or OAuth-based mailboxes for Google-hosted accounts (Gmail API).
- **Outlook-only**: Outlook connect and inbox/reply features use Microsoft Graph.

## Safe end-to-end smoke (recommended order)

### 1) Add mailbox (verify-before-save)

In **Email Accounts**:
- Click **Add outbound mailbox**
- Choose mailbox type:
  - **Google-hosted mailbox (Gmail or Google Workspace)**: preset `smtp.gmail.com`, port `587`, implicit SSL off
  - **Other SMTP mailbox**: use host/port/security from your provider

Fill in:
- **From email**: outbound sender address (what recipients see)
- **SMTP username**: usually full email address
- **SMTP password**:
  - Google-hosted: use a **Google app password** when your account requires it (often when 2FA is enabled)
  - Other SMTP: provider SMTP password / app-specific password

Click **Add mailbox**.

**Expected success**
- UI shows “Mailbox added” and notes SMTP was verified.
- Mailbox appears in the list.

**Expected failure (mailbox NOT saved)**
- UI shows “SMTP verification failed — mailbox was not saved.” with a short operator-friendly reason.
- Common categories:
  - **Auth/login**: “Username and Password not accepted.” / “Authentication failed.”
  - **TLS/port mismatch**: implicit SSL vs 465/587 guidance
  - **Unreachable host**: DNS/timeout/connection refused

### 2) Test send (operator-level)

From the mailbox row, use **Send Test**.

**Expected success**
- Test route returns success; UI confirms send completed.

**Expected failure**
- Operator message includes a short “Provider response” line (sanitized).
- Fix host/port/SSL or credentials and re-add (verification blocks saving bad configs).

### 3) One real outbound send (safe)

Pick **one** controlled recipient you own (or a test inbox) and run exactly one step:

- **Campaign**: create a tiny campaign with **1 contact** and send step 1.
- **Sequence**: create a sequence with **1 test recipient** and send the first step.

**Expected success signals**
- Worker path uses `sendEmail()` (SMTP or Graph based on identity provider).
- Message accepted by the transport (SMTP) and recorded as sent/delivered in events where applicable.

## Quick “where to look” when something fails

- **Immediate create failure**: fix credentials/host/port/SSL and retry; mailbox is not saved on verify failure.
- **Test send failure after successful add**:
  - Provider may allow login but reject from-address or policy (rare) — confirm the provider allows that “From email”.
  - Check deliverability guardrails (daily caps, SPF/DKIM/DMARC) separately.
- **Live send not happening at all**:
  - Sending is still governed by global live-sending controls (scheduler/worker enable flags) — SMTP does not bypass guardrails.

## Engineer contract pointers

- Create (SMTP): `POST /api/outlook/identities` verifies via nodemailer `verify()` before saving.
- Test send: `POST /api/outlook/identities/:id/test-send`
- Unified outbound send: `server/src/services/outlookEmailService.ts` routes by `EmailIdentity.provider`.

