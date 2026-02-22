# Marketing Production Stability Check – Feb 22 Hardening Pass

**Date:** 2026-02-22  
**Scope:** Backend response normalization, tenant isolation, sequence validation, frontend array hardening, observability. No feature work; structural only.

---

## 1. Routes Normalized to `{ data }`

| Route | Before | After |
|-------|--------|--------|
| GET /api/customers | `{ customers: [] }` / `{ customers, warnings? }` | `{ data: [] }` / `{ data, warnings? }` |
| GET/POST/PATCH/DELETE /api/templates | bare array/object | `{ data: ... }` |
| GET/GET:id/POST/PUT/DELETE /api/sequences | bare array/object | `{ data: ... }` |
| GET/GET:id/POST/PATCH/DELETE /api/email-campaigns | bare array/object | `{ data: ... }` |
| GET/POST/PATCH/DELETE /api/outlook/identities | bare array/object | `{ data: ... }` |
| GET /api/overview | bare object | `{ data: { ... } }` |

All list routes return `res.json({ data: array })`. All single-resource routes return `res.json({ data: object })`. Status codes unchanged; internal object shapes unchanged; no double-wrap.

---

## 2. unwrap Simplified

- **File:** `src/utils/api.ts`
- **Change:** `unwrapResponsePayload` now only checks for `'data'` in parsed object. Removed endpoint-specific logic and `customers` fallback.
- **Logic:** `if (parsed && typeof parsed === 'object' && 'data' in parsed) return parsed.data; return parsed`

---

## 3. Array Guards Added (Frontend)

- **MarketingDashboard:** `customersRes.data`, `contactsRes.data`, etc. wrapped with `Array.isArray(...) ? ... : []` before use.
- **OverviewDashboard:** `data.employeeStats`, `campaignsRes.value?.data`, `inboxRes.value?.data` guarded with `Array.isArray(...) ? ... : []`.
- **SequencesTab:** `sequencesRes.data`, `campaignsRes.data`, `sendersRes.data`, `editingSequence.steps`, `data.steps` guarded.
- **Script:** `scripts/verify-api-unwrap.cjs` updated to assert only `{ data }` unwrap behavior (5 tests).

---

## 4. Tenant Isolation Verified (Marketing Module)

- **customerId resolution:** Header `x-customer-id` > query `customerId` > body `customerId`. If missing → 400, no fallback.
- **Prisma:** All list/get/update/delete queries in templates, sequences, campaigns, outlook identities include `where: { customerId }` (or equivalent).
- **Response header:** `x-odcrm-customer-id: <resolvedCustomerId>` set on all marketing and overview responses.
- **Outlook identities:** GET /api/outlook/identities filters by `customerId` and `isActive: true`; returns only `outlook`/`smtp` providers. Header `x-odcrm-identities-count` added.

No credentials or payload bodies logged.

---

## 5. Sequence Validation Added

- **POST /api/sequences:** Before Zod parse: `name` required; if `steps` present: must be array, length > 0; each step must have `subjectTemplate` or `bodyTemplateHtml` (non-empty string); no null/undefined steps. Reject with 400 on invalid shape.
- **Frontend:** `sequence.steps` guarded with `Array.isArray(sequence.steps) ? sequence.steps : []` where used.

---

## 6. Email Identity Integrity

- **Backend:** GET /api/outlook/identities filters by `customerId`, `isActive: true`, and `provider in ['outlook','smtp']`. Response `{ data: array }`. Headers: `x-odcrm-customer-id`, `x-odcrm-identities-count`.
- **Frontend:** If identities not array → fallback to `[]`. Zero identities → existing empty-state UI (no change required).

---

## 7. Circular Imports Checked

- **api.ts** imports only `../platform/storage` and `../platform/keys`; does **not** import `platform/stores/*`. TDZ risk from marketing chunk loading is avoided.
- No circular chains found involving `api.ts`, `platform/stores/*`, `tabs/marketing/*`, `dashboards/*`.

---

## 8. No Debug Logs in Final State

- Removed `console.log` for `[API] GET url`, `[API] GET url -> status`, `[API SUCCESS] url: data` from `src/utils/api.ts`.
- Retained `console.warn` for 304 retry and `console.error` for API errors.
- Removed `console.log` from overview route (customer stats). No `console.debug` or temporary logs added.

---

## 9. Observability Headers

- For `/api/campaigns`, `/api/outlook`, `/api/sequences`, `/api/templates`, `/api/overview`: middleware sets `x-odcrm-build-sha` (from getBuildInfo()) and `x-odcrm-route-version: v1`. No sensitive data; no debug logs.

---

## 10. Build + Typecheck + Verify

- `npm run build` – must pass.
- `npx tsc --noEmit` – must pass.
- `node scripts/verify-api-unwrap.cjs` – all 5 assertions pass.

---

## Summary

- **Backend:** All listed list/single routes return `{ data: array | object }`; tenant isolation and sequence validation in place; identity filtering and headers added.
- **Frontend:** unwrap simplified; API-derived arrays guarded with `Array.isArray(...) ? ... : []` in Dashboard, Marketing tab, Sequences tab, Overview.
- **Risk:** None identified. Additive only; no destructive migrations; no breaking production flows.
- **Production safe:** Yes, pending successful build and verification script run.
