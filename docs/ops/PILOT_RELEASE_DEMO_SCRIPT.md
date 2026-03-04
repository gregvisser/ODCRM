# Pilot Release — Demo Script (5–7 Minutes)

Spoken demo flow for OpenDoors Pilot. **No real sending.** All send paths are dry-run or audit-only.

---

## 1. Intro (≈1 min)

**What it is:** ODCRM Pilot for OpenDoors: sequences, enrollments, send queue preview, queue item details, render, and admin-only Retry/Skip and dry-run worker. Everything is tenant-scoped and safe for demo.

**What it isn’t:** No live email delivery. We show the full flow up to “would send”; the worker only writes audit rows.

---

## 2. Create / view enrollment (≈1 min)

- Go to **Marketing → Sequences**, open a sequence.
- Create or open an **enrollment** (batch of recipients).
- Show **Pause / Resume / Cancel** if relevant.
- “Enrollments are the unit we queue from; the send queue is per enrollment.”

---

## 3. Send Queue Preview (≈1 min)

- Open **Send Queue Preview** for that enrollment.
- Point out **WAIT / SKIP / SEND** and reasons.
- “This is tenant-scoped; the backend uses the selected client id.”

---

## 4. Enrollment Queue modal — Render + Details (≈1–2 min)

- Open the **Enrollment Queue** modal for the same enrollment.
- **Render:** Pick a row, click **Render email**; show subject and body (Stage 3G). “Rendered from templates; no send.”
- **Details:** Click **Details** on a row; show status, scheduledFor, sentAt, attemptCount, lastError (Stage 3I). “Full item state for ops.”

---

## 5. Retry / Skip (admin-only) (≈30 s)

- “Retry and Skip are admin-only.” Enter the **admin secret** in the modal field (stored in sessionStorage as `odcrm_admin_secret`).
- Show **Retry** and **Skip** enabling; briefly explain: “Retry re-queues; Skip marks so the worker won’t process it.”

---

## 6. Dry-run worker (admin-only) and audit (≈30 s)

- “The send worker has a **dry-run** endpoint: it takes QUEUED items, makes decisions, and writes **audit** rows only — no real email.”
- “Only operators with the admin secret can call it. Use it to validate that the pipeline runs end-to-end in Pilot.”

---

## 7. Close — next milestones (≈30 s)

- “Pilot proves: enrollments, queue preview, queue modal, render, details, Retry/Skip, and dry-run worker with audit.”
- “Next: enable real sending behind canary/env when we’re ready.”
