# Templates Production QA — Tenant Header Verification

Verify that template create/update/delete use `x-customer-id` correctly in production. **Trace response headers** (e.g. `x-odcrm-templates-customerid-present` / `-valid`) were temporary and have been removed; verification should rely on **Request Headers** only.

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
- Click it and check **Request Headers**:
  - `x-customer-id` must be **present** and look like `cust_...` (real customer ID).
- If create succeeds (201), tenant header is correct. If you get 400 "Invalid customer context", the sent customerId is not in the DB.

### 6) If x-customer-id is missing or not cust_...

- The frontend is not sending the selected customer id (or sent an invalid one).
- **Action:** Capture a screenshot of Request Headers and stop. Report to fix frontend header/source.

### 7) Verify update and delete

- **Edit:** Open the created template, change something (e.g. name), save.
- In Network, find **PATCH** `/api/templates/:id`; confirm **Request Headers** include `x-customer-id: cust_...`.
- **Delete:** Delete the template.
- In Network, find **DELETE** `/api/templates/:id`; confirm **Request Headers** include `x-customer-id: cust_...`.

### 9) Preview safety (optional)

- If the UI has a preview action, use it.
- Backend should already escape XSS (e.g. `firstName: "<script>"` → escaped in output).

---

## What to paste back into ChatGPT

- Screenshot of **Request Headers** for **POST /api/templates** (showing `x-customer-id: cust_...`).
- Any error toast text (if something failed).

---

## Note on trace headers

Temporary response trace headers (`x-odcrm-templates-customerid-present`, `x-odcrm-templates-customerid-valid`) were removed after verification. QA should rely only on **Request Headers** (that `x-customer-id` is present and looks like `cust_...`) and on success/400 behavior.
