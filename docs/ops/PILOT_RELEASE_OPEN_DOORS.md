# Pilot Release — OpenDoors (ODCRM)

Stability and operability doc for the Pilot Release. **No real sending.** Single smoke script proves core flows on prod.

---

## What’s included in Pilot Release

- **Onboarding** — Client onboarding and setup
- **Email Accounts** — Email identity configuration
- **Sequences** — Create and manage email sequences
- **Enrollments** — Create enrollments (from **Leads Snapshot** or manual paste), pause/resume/cancel lifecycle
- **Send Queue Preview (Dry Run)** — WAIT/SKIP/SEND reasons, tenant-scoped
- **Preview email** — Render-only preview of subject/body by queue item (no send)
- **Details** — Queue item detail (status, scheduledFor, sentAt, attemptCount, lastError) in Enrollment Queue modal
- **Retry/Skip** — Queue item actions (tenant + admin)
- **Dry-run Worker** — One admin-only endpoint processes QUEUED items into **Dry-run Audit** (decision trail: why each item would send or skip); no real emails

---

## What is explicitly NOT included

- **Real sending** — No live email delivery. All send paths are dry-run or gated (canary/env) and not enabled for Pilot.

---

## Operator steps

1. **Select client** — In the app, choose the client (tenant) from the selector. All subsequent actions are scoped to that client.
2. **Create/Edit Sequence** — Open a sequence; in **Configuration**, pick a **Leads Snapshot** (saved list of leads).
3. **Create Enrollment** — Create an enrollment for that sequence. Enrollments can be created from the selected **Leads Snapshot** (preferred) or by manual paste of emails.
4. **Send Queue Preview (Dry Run)** — Open the **Send Queue Preview (Dry Run)** panel and Refresh; view WAIT/SKIP/SEND and reasons.
5. **Preview email** — In the queue, click **Preview email** on a row to see the rendered subject/body (render-only; no sending).
6. **Details** — Click **Details** on a row for full item state (status, scheduledFor, sentAt, attemptCount, lastError).
7. **Dry-run Audit** — The **Dry-run Audit** panel shows the decision trail (why each item would send or skip), written when the dry-run worker runs. Optional: use **Retry/Skip** (admin secret) and run the **Dry-run Worker** (admin-only) to generate audit.

---

## Admin requirements

- **ADMIN_SECRET** — Must be configured in the **backend** environment (e.g. Azure App Service application settings for the API, or `server/.env` locally). Used to validate `X-Admin-Secret` on admin-only routes.
- **Who has access** — Only operators who have the value of `ADMIN_SECRET` can call admin-only endpoints (e.g. send-queue retry/skip, send-worker dry-run).
- **How to call POST /api/send-worker/dry-run safely** — From a machine that has the secret:  
  `curl -X POST -H "Content-Type: application/json" -H "X-Admin-Secret: <ADMIN_SECRET>" -d "{}" "https://odcrm-api-hkbsfbdzdvezedg8.westeurope-01.azurewebsites.net/api/send-worker/dry-run"`  
  Do not commit or log the secret. The endpoint processes up to 20 QUEUED items and writes audit rows; it does not send email.

---

## Troubleshooting

- **400 tenant required** — The request is missing or invalid **X-Customer-Id** (e.g. for send-queue preview or item detail). Select a client in the UI or send the header with a valid customer id (e.g. `cust_...`).
- **401 admin required** — The request is missing or invalid **X-Admin-Secret**. Admin-only endpoints (e.g. retry/skip, send-worker dry-run) require this header to match the backend `ADMIN_SECRET`.
- **Where to check prod parity** — Frontend: `https://odcrm.bidlow.co.uk/__build.json` (contains build SHA). Backend: `https://odcrm-api-hkbsfbdzdvezedg8.westeurope-01.azurewebsites.net/api/_build` (contains build SHA). Use `scripts/prod-check.cjs` with `EXPECT_SHA` set to the merge commit SHA to confirm FE and BE match.
