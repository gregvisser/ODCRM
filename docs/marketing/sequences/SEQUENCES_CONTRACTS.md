# Sequences API — request/response contracts

Required headers and body/response shapes for key endpoints. All mutation endpoints must receive a valid tenant context (X-Customer-Id or query customerId).

---

## Required headers

| Header | Required | Notes |
|--------|----------|--------|
| **X-Customer-Id** | Yes (for all tenant-scoped endpoints) | Must be a real customer id (e.g. `cust_…`) that exists in `customers` table. Backend should return 400 if missing or invalid. |
| Content-Type | For POST/PUT/PATCH with body | `application/json`. |

Backend reads customerId as: `(req.headers['x-customer-id']) || (req.query.customerId)`.

---

## GET /api/sequences

- **Request:** No body. Headers: `X-Customer-Id: <customerId>` (or query `?customerId=`).
- **Response:** `200`  
  - Body: array of `{ id, customerId, senderIdentityId, senderIdentity?, name, description?, stepCount, createdAt, updatedAt }`.
- **Errors:** `400` if customerId missing; `500` on server error.

---

## GET /api/sequences/:id

- **Request:** No body. Headers: `X-Customer-Id: <customerId>`.
- **Response:** `200`  
  - Body: `{ id, customerId, senderIdentityId, senderIdentity?, name, description?, createdAt, updatedAt, steps: [{ id, stepOrder, delayDaysFromPrevious, subjectTemplate, bodyTemplateHtml, bodyTemplateText?, createdAt, updatedAt }] }`.
- **Errors:** `400` if customerId missing; `404` if sequence not found or not belonging to customer; `500` on server error.

---

## POST /api/sequences

- **Request:**  
  - Headers: `X-Customer-Id: <customerId>`, `Content-Type: application/json`.  
  - Body (JSON):  
    - `senderIdentityId` (string, required)  
    - `name` (string, required)  
    - `description` (string, optional)  
    - `steps` (array, optional): each `{ stepOrder, delayDaysFromPrevious?, subjectTemplate, bodyTemplateHtml, bodyTemplateText? }`.
- **Response:** `201`  
  - Body: created sequence with `id`, `customerId`, `senderIdentityId`, `senderIdentity?`, `name`, `description`, `stepCount`, `createdAt`, `updatedAt`, `steps[]`.
- **Errors:** `400` if customerId missing/invalid, validation error, or senderIdentityId not belonging to customer; `500` on server error.

---

## PUT /api/sequences/:id

- **Request:**  
  - Headers: `X-Customer-Id: <customerId>`, `Content-Type: application/json`.  
  - Body (JSON): `{ name?, description? }` (metadata only).
- **Response:** `200`  
  - Body: `{ id, customerId, name, description, stepCount, createdAt, updatedAt }`.
- **Errors:** `400` validation; `404` if sequence not found or not belonging to customer; `500` on server error.  
- **Contract note:** Backend must scope by customerId (sequence must belong to requesting customer).

---

## DELETE /api/sequences/:id

- **Request:** Headers: `X-Customer-Id: <customerId>`.
- **Response:** `200` with body `{ success: true }` or `204` no content.
- **Errors:** `400` if sequence is used by campaigns; `404` if sequence not found or not belonging to customer; `500` on server error.  
- **Contract note:** Backend must scope by customerId before delete.

---

## POST /api/sequences/:id/steps

- **Request:**  
  - Headers: `X-Customer-Id: <customerId>`, `Content-Type: application/json`.  
  - Body: `{ stepOrder, delayDaysFromPrevious?, subjectTemplate, bodyTemplateHtml, bodyTemplateText? }`.
- **Response:** `201` with created step object.
- **Errors:** `400` validation or step limit; `404` if sequence not found or not belonging to customer; `500` on server error.  
- **Contract note:** Backend must verify sequence belongs to customer before creating step.

---

## PUT /api/sequences/:id/steps/:stepId

- **Request:**  
  - Headers: `X-Customer-Id: <customerId>`, `Content-Type: application/json`.  
  - Body: partial step fields (e.g. stepOrder, delayDaysFromPrevious, subjectTemplate, bodyTemplateHtml, bodyTemplateText).
- **Response:** `200` with updated step object.
- **Errors:** `400` validation; `404` if sequence/step not found or sequence not belonging to customer; `500` on server error.

---

## DELETE /api/sequences/:id/steps/:stepId

- **Request:** Headers: `X-Customer-Id: <customerId>`.
- **Response:** `200` with `{ success: true }` or `204`.
- **Errors:** `404` if sequence/step not found or sequence not belonging to customer; `500` on server error.

---

## POST /api/sequences/:id/enroll

- **Request:**  
  - Headers: `X-Customer-Id: <customerId>`, `Content-Type: application/json`.  
  - Body: `{ contactIds: string[] }`.
- **Response:** `200` or `201` with enrollment result.
- **Errors:** `400` if contactIds missing/invalid; `404` if sequence not found or not belonging to customer; `500` on server error.

---

## GET /api/campaigns (as used by Sequences tab)

- **Request:** Headers: `X-Customer-Id: <customerId>` (or query `?customerId=`). Campaigns route scopes by customerId.
- **Response:** `200` with array of campaigns. SequencesTab filters to those with `sequenceId` set.
- **Contract note:** Frontend should always send X-Customer-Id so list is tenant-scoped.
