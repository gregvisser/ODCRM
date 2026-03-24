# Non-Microsoft outreach mailbox support (audit)

**Date:** 2026-03-24  
**Scope:** Outbound sending identities (not ODCRM login, not inbox sync unless noted).

## Summary

| Question | Answer |
|----------|--------|
| Can ODCRM send outreach via SMTP for Gmail / Google Workspace? | **Yes**, when an `EmailIdentity` has `provider: 'smtp'` and valid SMTP fields, outbound sends use **nodemailer** (`server/src/services/smtpMailer.ts`) from the same `sendEmail` path as Microsoft Graph (`server/src/services/outlookEmailService.ts`). Operators must supply Gmail-compatible SMTP settings (typically `smtp.gmail.com:587`, STARTTLS, and often an **app password** if 2FA is on). |
| Can ODCRM send via generic custom SMTP? | **Yes** — any provider that offers authenticated SMTP is supported the same way; the UI labels this as “SMTP / Gmail / custom”. |
| Was UI misleading? | Previously the Marketing and onboarding Email Accounts surfaces emphasized **Connect Outlook** and did **not** expose an “Add SMTP” button (the SMTP modal existed but was unreachable). Copy now states that non-Microsoft mailboxes use SMTP credentials for outbound sending only. |
| Is IMAP required for outbound outreach? | **No** — outbound campaigns and sequences only need a working send transport (Microsoft Graph for Outlook, **SMTP** for other providers). |
| Is native Google OAuth / Gmail API integrated for mail? | **No** — `googleapis` in the repo is used for **Google Sheets** and similar, not for Gmail OAuth. There is no Gmail API send or inbox sync pipeline. |
| If native Gmail OAuth were desired later | Would require: Google Cloud OAuth client, Gmail API scopes (`gmail.send`, optionally `gmail.readonly` for inbox), token storage on `EmailIdentity` (or separate table), send path using Gmail API instead of SMTP, and optional sync jobs for replies. That is intentionally **out of scope** for the SMTP-only outbound fix. |

## Inbox / reply sync (Outlook vs SMTP)

- **Outlook:** `fetchRecentInboxMessages` and reply flows in `server/src/services/outlookEmailService.ts` / `server/src/routes/inbox.ts` use **Microsoft Graph**. They are **not** available for `provider: 'smtp'` identities (reply may fall back to a plain `sendEmail` for some paths; Graph-specific reply threading is Outlook-only).
- **SMTP:** No inbound polling or IMAP sync is implemented for generic SMTP identities. If reply detection or unified inbox for Gmail is required, that is a **separate** project (IMAP, Gmail API, or provider webhooks).

## Code references

- Model: `EmailIdentity` in `server/prisma/schema.prisma` (`provider`, `smtpHost`, `smtpPort`, `smtpUsername`, `smtpPassword`, `smtpSecure`).
- Create identity: `POST /api/outlook/identities` in `server/src/routes/outlook.ts`.
- Outbound send: `sendEmail` in `server/src/services/outlookEmailService.ts` (SMTP branch + Graph branch).
- Campaign / scheduler workers call `sendEmail` from `outlookEmailService` (e.g. `server/src/workers/emailScheduler.ts`, `server/src/workers/campaignSender.ts`, `server/src/workers/sendQueueWorker.ts`).
- Test send: `POST /api/outlook/identities/:id/test-send` supports both Outlook and SMTP.

## Residual risk

- SMTP credentials are **stored secrets**; operators must rotate credentials if leaked and follow least-privilege (app passwords, not primary passwords where possible).
- Gmail and other providers may block “less secure” SMTP unless app passwords or OAuth are used; **SMTP is still subject to provider policies**.
- Without Graph, **message-id / threading** metadata for SMTP is best-effort (nodemailer `messageId`); reply detection for Gmail is not automatic.
