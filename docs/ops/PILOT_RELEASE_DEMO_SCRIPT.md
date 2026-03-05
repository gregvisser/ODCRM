# Pilot Release — Demo Script (5–7 Minutes)

Spoken demo flow for OpenDoors Pilot. **No real sending.** All send paths are dry-run or audit-only.

**This demo is deliberately dry-run only; real sending is gated and disabled.**

---

## 1. Intro (≈1 min)

**What it is:** ODCRM Pilot for OpenDoors: sequences, enrollments, send queue preview, queue item **Preview email** and **Details**, and admin-only Retry/Skip and dry-run worker. Everything is tenant-scoped and safe for demo.

**What it isn’t:** No live email delivery. We show the full flow up to “would send”; the worker only writes audit rows.

---

## 2. Create / view enrollment (≈1 min)

- Go to **Marketing → Sequences**, open a sequence.
- In **Configuration**, pick a **Leads Snapshot** (or use manual paste).
- Create or open an **enrollment** (batch of recipients from snapshot or paste).
- Show **Pause / Resume / Cancel** if relevant.
- “Enrollments are the unit we queue from; the send queue is per enrollment.”

---

## 3. Send Queue Preview (Dry Run) (≈1 min)

- Open **Send Queue Preview (Dry Run)** for that enrollment.
- Point out **WAIT / SKIP / SEND** and reasons.
- “This is tenant-scoped; the backend uses the selected client id.”

---

## 4. Send Queue (drawer) — Preview email + Details (≈1–2 min)

- Open **Send Queue** (drawer) for the enrollment via **View queue**.
- In the drawer table, click **Details** on a row to show status, scheduledFor, sentAt, attemptCount, lastError. “Full item state for ops.”
- **Preview email:** Pick a row, click **Preview email**; show subject and body. “Rendered from templates; we preview what would send — no actual send.”

---

## 5. Retry / Skip (admin-only) (≈30 s)

- “Retry and Skip are admin-only.” Enter the **admin secret** in the modal field (stored in sessionStorage as `odcrm_admin_secret`).
- Show **Retry** and **Skip** enabling; briefly explain: “Retry re-queues; Skip marks so the worker won’t process it.”

---

## 6. Dry-run worker (admin-only) and Dry-run Audit (≈30 s)

- “The send worker has a **dry-run** endpoint: it takes QUEUED items, makes decisions, and writes **Dry-run Audit** rows — the decision trail for why each item would send or skip. No real email.”
- “Only operators with the admin secret can call it. Use it to validate that the pipeline runs end-to-end in Pilot.”

---

## 7. Close — next milestones (≈30 s)

- “Pilot proves: enrollments (including from Leads Snapshot), queue preview, **Preview email**, **Details**, Retry/Skip, and dry-run worker with **Dry-run Audit**.”
- “Next: enable real sending behind canary/env when we’re ready.”
