# Pilot Release — Operator Cheat Sheet (One Page)

**Pilot = dry-run only. No real email sending.**

---

## Mental model

- **Sequence** = message plan (steps + delays).
- **Template** = the email content for a step.
- **Leads Snapshot** = saved list of leads (e.g. Cognism batch).
- **Enrollment** = a batch run of a sequence against a specific recipient set.
- **Enrollment Recipient** = a person/email enrolled (from snapshot or manual paste).
- **Queue item** = one “to-be-sent” step for one recipient (dry-run or live gated).
- **Preview email** = render-only preview of subject/body for a queue item (no send).
- **Details** = metadata/status for a queue item (read-only).
- **Dry-run Audit** = “why this would send/skip” decision log (created by Dry-run worker).

---

## What you can do today

- **Onboarding & setup** — Client onboarding, email accounts (identities)
- **Sequences** — Create and manage email sequences
- **Enrollments** — Create enrollments (from **Leads Snapshot** or manual paste), **Pause / Resume / Cancel** lifecycle
- **Send Queue Preview (Dry Run)** — See WAIT/SKIP/SEND and reasons (tenant-scoped)
- **Send Queue drawer** — Open via **View queue** for an enrollment; **Preview email** and **Details** (status, scheduledFor, sentAt, attemptCount, lastError) on each row
- **Retry / Skip** queue items — Admin-only; requires admin secret in the modal
- **Dry-run worker** — Admin-only endpoint processes QUEUED items into audit rows; **no real send**

---

## What you cannot do

- **Real sending** — No live email delivery. All send paths are dry-run or gated; not enabled for Pilot.

---

## How to run Pilot (operator steps)

1. **Pick Client** — Select the client (tenant) in the app. Confirm client id shows `cust_...`.
2. **Create/Edit Sequence** — Marketing → Sequences; open a sequence. In **Configuration**, pick a **Leads Snapshot** (saved list of leads).
3. **Create Enrollment** — Create an enrollment for that sequence.
   - **Recommended:** “Use Leads Snapshot” — pulls recipients from the selected snapshot.
   - **Advanced:** manual paste of emails.
4. **Send Queue Preview (Dry Run)** — Open the **Send Queue Preview (Dry Run)** panel and **Refresh**. Confirm WAIT/SKIP/SEND and reasons.
5. **Preview email and Details** — Open **Send Queue** (drawer) for an enrollment via **View queue**. In the drawer table, click **Details** on a row to view status, scheduledFor, sentAt, attemptCount, lastError; use **Preview email** on a row for render-only preview.
6. **Optional (admin)** — Enter admin secret in the modal; use **Retry/Skip** if needed. Run **Dry-run Worker** (admin-only) to generate **Dry-run Audit** (decision log for why items would/wouldn’t send).

**Explicit:** Pilot does **NOT** send email. All of the above is dry-run / preview / audit-only unless Azure live-send flags are enabled — and we are **NOT** enabling them for Pilot.

---

## Common errors

| Error | Cause | Fix |
|-------|--------|-----|
| **400 tenant required** | Missing or invalid **X-Customer-Id** | Select a client in the UI (client id must be sent as `X-Customer-Id`). |
| **401 admin required** | Missing or invalid **X-Admin-Secret** | Enter the admin secret in the Enrollment Queue modal, or send `X-Admin-Secret` header matching backend `ADMIN_SECRET`. |

---

## Admin secret notes

- **Where to enter** — In the **Enrollment Queue** modal (Marketing → Sequences → open sequence → open enrollment → Enrollment Queue). There is a field “Admin secret” (or similar); enter the value that matches the backend `ADMIN_SECRET`.
- **Session storage** — The value is stored in **sessionStorage** under the key **`odcrm_admin_secret`** (session-only; cleared when the tab is closed). Used for Retry/Skip and can be used when calling the dry-run endpoint from a script if you pass the same value as `X-Admin-Secret`.
- **Backend** — `ADMIN_SECRET` must be set in the API environment (e.g. Azure App Service application settings or `server/.env` locally). Never commit or log the secret.

---

## Links (build / parity)

- **Frontend build SHA:** https://odcrm.bidlow.co.uk/__build.json  
- **Backend build SHA:** https://odcrm-api-hkbsfbdzdvezedg8.westeurope-01.azurewebsites.net/api/_build  

Use `scripts/prod-check.cjs` with `EXPECT_SHA=<merge SHA>` to confirm FE SHA == BE SHA == expected.

Runtime smoke check (requires tenant id):
`$env:CUSTOMER_ID="cust_xxx"; npm run -s test:marketing-runtime-smoke`
Optional dry-run endpoint check (admin-only):
`$env:ADMIN_SECRET="***"; $env:CUSTOMER_ID="cust_xxx"; npm run -s test:marketing-runtime-smoke`
If `ADMIN_SECRET` is not set, the dry-run check is reported as **SKIP** (not a failure).
Marketing runtime smoke now covers all Marketing tab GET paths (Templates, Email Accounts, Compliance, Schedules, Inbox, Reports, Lead Sources) using tenant-scoped checks.
It validates read-only Marketing endpoints for the selected tenant; if a tenant has no sequences/enrollments yet, queue/enrollment checks are reported as **SKIP** (expected for new tenants).
