# Templates – Contracts (API, Types, Merge Fields)

**Date:** 2026-02-20  
**Purpose:** Canonical TypeScript interfaces, endpoint contracts, error shapes, and variable/merge-field list for Sequences-ready templates.

---

## 1. Canonical TS Interfaces

### 1.1 Template (DB / API shape)

```ts
// Server: matches Prisma EmailTemplate
interface EmailTemplate {
  id: string
  customerId: string
  name: string
  subjectTemplate: string
  bodyTemplateHtml: string
  bodyTemplateText: string | null
  stepNumber: number
  createdAt: string   // ISO
  updatedAt: string   // ISO
}
```

### 1.2 Create payload (whitelisted)

```ts
interface CreateTemplateBody {
  name: string
  subjectTemplate: string
  bodyTemplateHtml: string
  bodyTemplateText?: string | null
  stepNumber?: number  // 1..10, default 1
}
```

### 1.3 Update payload (all optional; whitelisted)

```ts
interface UpdateTemplateBody {
  name?: string
  subjectTemplate?: string
  bodyTemplateHtml?: string
  bodyTemplateText?: string | null
  stepNumber?: number  // 1..10
}
```

**Note:** `category`, `tags`, `isFavorite`, `usageCount`, `previewText`, `createdBy` are **not** in the API contract. Backend ignores them. Add only via additive migration + schema change if product requires.

### 1.4 Template variables (renderer input)

```ts
// Server: server/src/services/templateRenderer.ts
interface TemplateVariables {
  firstName?: string | null
  lastName?: string | null
  company?: string | null
  companyName?: string | null
  email?: string | null
  title?: string | null
  jobTitle?: string | null
  phone?: string | null
  // Proposed for Sequences-ready:
  // senderName?: string | null
  // senderEmail?: string | null
  // fullName?: string | null
  // contactName?: string | null   // alias fullName
  // accountName?: string | null    // alias company/companyName
}
```

---

## 2. Endpoint Contracts and Error Shapes

### 2.1 GET /api/templates

- **Request:** No body. Headers: `X-Customer-Id` (or query `customerId`).
- **Success:** `200` — `EmailTemplate[]`.
- **Errors:**
  - `400` — `{ no JSON body expected }` or customer ID missing: handler throws; typically error middleware returns `500` with message "Customer ID required". Recommend: return `400 { "error": "Customer ID required" }` explicitly.

### 2.2 POST /api/templates

- **Request:** JSON body per `CreateTemplateBody`. Header `X-Customer-Id` (or query `customerId`).
- **Success:** `201` — `EmailTemplate` (created).
- **Errors:**
  - `400` — Validation (zod): `next(error)` → depends on error middleware (often 500 + message). Recommend: 400 with `{ "error": "Validation failed", "details": zod.flatten() }`.
  - `400` — Customer ID missing (same as GET).

### 2.3 PATCH /api/templates/:id

- **Request:** JSON body per `UpdateTemplateBody`. Header/query customer.
- **Success:** `200` — `EmailTemplate` (updated).
- **Errors:**
  - `404` — `{ "error": "Template not found" }` (missing id or wrong customer).
  - `400` — Validation or customer ID missing.

### 2.4 DELETE /api/templates/:id

- **Request:** No body. Header/query customer.
- **Success:** `200` — `{ "success": true }`.
- **Errors:**
  - `404` — `{ "error": "Template not found" }`.

### 2.5 POST /api/templates/preview

- **Request:** JSON body: `{ subject?: string, body?: string, variables?: TemplateVariables }`. No customer required today.
- **Success:** `200` — `{ "subject": string, "body": string }` (placeholders applied).
- **Errors:**
  - `500` — `{ "error": "Failed to preview template" }` on exception.

---

## 3. Variable / Merge Field List

### 3.1 Currently implemented (templateRenderer.ts)

| Variable       | Definition           | Source (current)     | Missing → behavior   |
|----------------|----------------------|----------------------|----------------------|
| firstName      | Recipient first name | Contact.firstName    | ''                   |
| lastName       | Recipient last name  | Contact.lastName     | ''                   |
| company        | Company name         | Contact.companyName  | '' (alias: companyName) |
| companyName    | Company name         | Contact.companyName  | '' (alias: company)  |
| email          | Recipient email      | Contact.email        | ''                   |
| title          | Job title            | Contact.jobTitle     | '' (alias: jobTitle) |
| jobTitle       | Job title            | Contact.jobTitle     | '' (alias: title)    |
| phone          | Recipient phone      | Contact.phone        | ''                   |

### 3.2 Documented in UI but not implemented

| Variable    | Definition        | Proposed source           | If missing |
|-------------|-------------------|---------------------------|------------|
| senderName  | Sender display    | EmailIdentity.displayName or email | ''         |
| senderEmail | Sender address    | EmailIdentity.emailAddress | ''         |
| fullName    | Full name         | `${Contact.firstName} ${Contact.lastName}`.trim() | '' |
| contactName | Same as fullName  | fullName                  | ''         |
| accountName | Company / account | Contact.companyName or Customer.name | ''  |

### 3.3 Canonical list (Sequences-ready proposal)

**Recipient (contact):**  
`firstName`, `lastName`, `fullName` (derived), `email`, `phone`, `jobTitle`, `title` (alias), `company`, `companyName`, `accountName` (alias company for clarity).

**Sender (email identity):**  
`senderName`, `senderEmail`.

**Account (customer):**  
`accountName` (can be Customer.name when different from contact company).

**Escaping:**

- **Subject:** Always escape variable values (HTML-escape) so subject is safe in any context.
- **HTML body:** Escape variable values when substituting into HTML; template markup itself can be trusted (admin-created). No script/link injection from variables.
- **Plain-text body:** No HTML; use raw value (or escape for consistency).

**Missing value:** Use empty string `''` (no fallback placeholder).

---

## 4. Where Values Come From (Reference)

| Source           | Fields used for variables                    |
|------------------|----------------------------------------------|
| Contact          | firstName, lastName, companyName, email, jobTitle, phone |
| EmailIdentity    | displayName → senderName, emailAddress → senderEmail |
| Customer         | name → accountName (when needed)              |
| Derived          | fullName = `${firstName} ${lastName}`.trim(); contactName = fullName; accountName = companyName or Customer.name |

This document should be updated when new variables or sources are added so Sequences and Campaigns share one contract.
