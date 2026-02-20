# Templates Production QA — Tenant Header Verification

Verify that template create/update/delete use `x-customer-id` correctly in production and that response trace headers confirm tenant presence and validity.

---

## Prerequisites

- Production deployed (after push to `main`).
- Browser: Chrome or Edge (DevTools).

---

## Steps

### 1) Open production UI

Open:

**https://odcrm.bidlow.co.uk/marketing?tab=marketing-home&view=templates**

### 2) Open DevTools → Network

- Press F12 (or right‑click → Inspect).
- Go to the **Network** tab.
- Enable **Preserve log** (so navigation doesn’t clear requests).

### 3) Select a real customer

- In the Templates view, use the customer dropdown.
- Select a **real customer** (must not be blank).
- Ensure the list loads for that customer.

### 4) Create template

- Click **New Template** (or equivalent).
- Fill:
  - **Name:** `QA Header Test`
  - **Subject:** `Hi {{firstName}}`
  - **Body:** `Hello {{companyName}}`
- Click **Create** (or Save).

### 5) Check POST /api/templates

- In Network, find the **POST** request to **/api/templates**.
- Click it and check:

**Request Headers**

- `x-customer-id` must be **present** and look like `cust_...` (real customer ID).

**Response Headers**

- `x-odcrm-templates-customerid-present`: **true**
- `x-odcrm-templates-customerid-valid`: **true**

### 6) If present=true but valid=false

- The dropdown is sending a `customerId` that does **not** exist in the DB (e.g. stale mapping).
- **Action:** Capture a screenshot and stop. Report to fix dropdown/API mapping.

### 7) If present=false

- The frontend is **not** sending `x-customer-id` for Templates create.
- **Action:** Capture a screenshot and stop. Report to fix frontend header.

### 8) Verify update and delete

- **Edit:** Open the created template, change something (e.g. name), save.
- In Network, find **PATCH** `/api/templates/:id`.
- **Response headers:** `x-odcrm-templates-customerid-present`: **true**.

- **Delete:** Delete the template.
- In Network, find **DELETE** `/api/templates/:id`.
- **Response headers:** `x-odcrm-templates-customerid-present`: **true**.

### 9) Preview safety (optional)

- If the UI has a preview action, use it.
- Backend should already escape XSS (e.g. `firstName: "<script>"` → escaped in output).

---

## What to paste back into ChatGPT

- Screenshot of **Request Headers** for **POST /api/templates** (showing `x-customer-id`).
- Screenshot of **Response Headers** for the same request (showing `x-odcrm-templates-customerid-present` and `x-odcrm-templates-customerid-valid`).
- Any error toast text (if something failed).

---

## Cleanup / rollback plan (after verification)

1. **Remove trace headers**  
   In `server/src/routes/templates.ts`, remove:
   - `res.setHeader('x-odcrm-templates-customerid-present', ...)`
   - `res.setHeader('x-odcrm-templates-customerid-valid', ...)`  
   from POST, PATCH, DELETE, and preview. Commit as e.g. `chore(templates): remove observability trace headers` and push.

2. **If production is broken**  
   Revert the observability commit (or the whole templates route file) and push to restore previous behavior; then fix forward.

3. **No DB or schema changes**  
   This QA only adds response headers and logs; no rollback of data is needed.
