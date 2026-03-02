# Send Queue Preview (Stage 3A)

Read-only dry-run preview for the send queue. **No live sending. No DB mutations.** Returns “what would happen” (action + reasons) per item.

## Endpoint

**GET /api/send-queue/preview**

- **Auth:** Tenant-scoped only. **X-Customer-Id** header required (no admin secret).
- **Query (optional):**
  - `enrollmentId` — filter to items for that enrollment
  - `limit` — default 20, max 100

## Guarantee

- **Read-only:** No locks, no status updates, no calls to Outlook/send.
- **Tenant isolation:** `customerId` is taken from **X-Customer-Id** only; no silent default. Missing header => 400.

## Response schema

```json
{
  "data": {
    "items": [
      {
        "id": "clx...",
        "enrollmentId": "clx...",
        "stepIndex": 0,
        "scheduledFor": "2026-03-01T12:00:00.000Z",
        "status": "QUEUED",
        "action": "SEND",
        "reasons": [],
        "renderPreview": null
      },
      {
        "id": "clx...",
        "enrollmentId": "clx...",
        "stepIndex": 1,
        "scheduledFor": "2026-03-05T09:00:00.000Z",
        "status": "QUEUED",
        "action": "WAIT",
        "reasons": ["not_due_yet"],
        "renderPreview": null
      }
    ]
  }
}
```

- **action:** `WAIT` | `SKIP` | `SEND` (dry-run suggestion only).
- **reasons:** Array of reason codes (see below).
- **renderPreview:** Reserved; may be `{ subject, bodyHtml }` in a future stage; Stage 3A returns `null`.

## Reason codes

| Code | Meaning |
|------|--------|
| `not_due_yet` | `scheduledFor` is in the future |
| `already_sent` | Item status is SENT |
| `locked` | Item status is LOCKED |
| `missing_identity` | Customer has no email identity (cannot send) |
| `missing_recipient_email` | Recipient email is missing/blank |
| `unknown` | Fallback (e.g. FAILED/SKIPPED) |

## Self-test

- **CI guardrail:** `npm run test:send-queue-preview-stage3a`
  - Without headers => expect 400 (X-Customer-Id required) or 401/403 (auth required).
  - With X-Customer-Id => expect 200 in local/dev or 401/403 in prod; if 200, assert `data.items` array.
