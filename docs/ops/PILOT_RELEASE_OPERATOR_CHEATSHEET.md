# Pilot Release — Operator Cheat Sheet (One Page)

**Pilot = dry-run only. No real email sending.**

---

## What you can do today

- **Onboarding & setup** — Client onboarding, email accounts (identities)
- **Sequences** — Create and manage email sequences
- **Enrollments** — Create enrollments, **Pause / Resume / Cancel** lifecycle
- **Send Queue Preview** — See WAIT/SKIP/SEND and reasons (tenant-scoped)
- **Enrollment Queue modal** — Render email (subject + body), **Details** (status, scheduledFor, sentAt, attemptCount, lastError)
- **Retry / Skip** queue items — Admin-only; requires admin secret in the modal
- **Dry-run worker** — Admin-only endpoint processes QUEUED items into audit rows; **no real send**

---

## What you cannot do

- **Real sending** — No live email delivery. All send paths are dry-run or gated; not enabled for Pilot.

---

## Step-by-step clicks (5–10 steps)

1. **Select client** — Choose the client (tenant) in the app. Confirm client id shows `cust_...`.
2. **Marketing → Sequences** — Open Sequences, open a sequence.
3. **Enrollments** — Create or open an enrollment; confirm Pause/Resume/Cancel work as expected.
4. **Send Queue Preview** — Open Send Queue Preview for that enrollment; confirm it renders (WAIT/SKIP/SEND).
5. **Enrollment Queue modal** — Open the Enrollment Queue modal.
6. **Render** — Click render on a row; confirm subject/body load (Stage 3G).
7. **Details** — Click Details on a row; confirm status, scheduledFor, sentAt, attemptCount, lastError (Stage 3I).
8. **Retry/Skip** — Enter admin secret in the modal field; Retry/Skip buttons enable; use only if you have the secret (Stage 3H).
9. **Dry-run worker** — Call `POST /api/send-worker/dry-run` with `X-Admin-Secret` (see Admin secret notes) to process one batch; writes audit only.

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
