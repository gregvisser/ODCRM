# QA: PR2 – Emails step auto-completes at 5 linked accounts

**Commit:** `feat(onboarding): auto-complete Emails step at 5 linked accounts`

## What changed

- **Backend:** GET /api/customers/:id returns `linkedEmailCount` (active EmailIdentity count for that customer; same definition as Marketing list).
- **Progress Tracker:** New read-only step **"Emails (5 linked)"** in the Operations checklist. Checked when `linkedEmailCount >= 5`; unchecked when &lt; 5. Updates after connect/disconnect via `customerUpdated` refetch.
- **Revalidation:** Connect (OAuth or SMTP) and disconnect emit `customerUpdated`; Progress Tracker refetches the selected customer so the Emails checkbox updates without full page refresh.

## QA steps

### 1) 0–4 identities ⇒ unchecked

- Select a customer that has 0, 1, 2, 3, or 4 linked email accounts (Marketing → Email Accounts, check count).
- Open Onboarding → Progress Tracker, select that same customer.
- In the **Operations Team** tab, find **"Emails (5 linked)"**.
- **Expected:** The checkbox is **unchecked**. The step shows as incomplete (Ops tab not fully green).

### 2) 5 identities ⇒ checked without refresh

- With the same customer selected in Progress Tracker, in another tab (or same tab): Marketing → Email Accounts (or Onboarding → Emails section), connect a 5th account (OAuth or SMTP).
- Return to Progress Tracker (or stay on it if using same tab; ensure the customer is still selected).
- **Expected:** Without manually refreshing the page, the **"Emails (5 linked)"** checkbox becomes **checked** (and Ops section can show complete if all other Ops items are done). If it does not update within a few seconds, switch away and back to the customer or trigger a refetch (e.g. toggle another checkbox and save); the step should then show checked.

### 3) Disconnect to 4 ⇒ unchecked without refresh

- With the same customer and 5 linked accounts, in Marketing → Email Accounts (or Onboarding → Emails), disconnect one account so the customer has 4 linked accounts.
- Return to Progress Tracker with that customer selected.
- **Expected:** Without full page refresh, **"Emails (5 linked)"** becomes **unchecked**. Count is derived from DB so 4 &lt; 5.

### 4) No cross-customer bleed

- Select **Customer A** in Progress Tracker (e.g. with 2 linked accounts → Emails unchecked).
- In another tab, select **Customer B** and connect 5 accounts for B.
- In Progress Tracker, ensure **Customer A** is still selected.
- **Expected:** **"Emails (5 linked)"** for Customer A remains **unchecked** (A still has 2). Only when Customer A is selected and A’s data is refetched (e.g. after changing A’s identities) should the step reflect A’s count. No Customer B data in A’s checklist.

## Verification summary

| Step | Expected |
|------|----------|
| 0–4 linked | Emails step unchecked |
| 5 linked | Emails step checked; updates after connect without full refresh |
| Disconnect to 4 | Emails step unchecked; updates after disconnect without full refresh |
| Cross-customer | Step reflects selected customer only; no bleed from other customers |
