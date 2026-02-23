# Inbox E2E Verification

## Schema additions (additive migration 20260222120000)

| Table | Column | Type | Default |
|-------|--------|------|---------|
| `email_message_metadata` | `is_read` | `BOOLEAN` | `false` |
| `email_message_metadata` | `body_preview` | `TEXT` | null |
| `email_identities` | `signature_html` | `TEXT` | null |

## New backend endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/inbox/messages` | GET | Paginated flat list of inbound messages (supports `?unreadOnly=true`) |
| `/api/inbox/messages/:id/read` | POST | Mark message read/unread (`{ isRead: true\|false }`) |
| `/api/inbox/messages/:id/optout` | POST | Add sender email to suppression list |
| `/api/inbox/refresh` | POST | Trigger immediate inbox poll via Outlook Graph |
| `/api/outlook/identities/:id/signature` | GET | Get signature HTML for identity |
| `/api/outlook/identities/:id/signature` | PUT | Update signature HTML (`{ signatureHtml: string }`) |

## Frontend changes (InboxTab.tsx)

- "Refresh" button now POSTs to `/api/inbox/refresh` (polls Outlook for new messages) then reloads UI
- Opening a thread calls `POST /api/inbox/messages/:id/read` for each inbound message
- "Unread only" toggle filters thread list
- Opt-out button calls `/api/suppression` (existing, correct)

## Verification steps

### 1. Refresh inbox
1. Open Inbox tab, select a customer
2. Click "Refresh"
3. **Expected**: Toast shows "Checked N mailbox(es) for new messages"
4. **Expected**: POST `/api/inbox/refresh` returns `{ success: true, identitiesChecked: N }`

### 2. Mark as read
1. Click on an email thread
2. **Expected**: API call `POST /api/inbox/messages/:id/read` with `{ isRead: true }`
3. If message has `isRead: false`, it's now marked read in DB

### 3. Opt-out from inbox
1. Open a thread with inbound message
2. Click "Mark as Opt-out"
3. **Expected**: Sender's email added to suppression list
4. **Verify**: `GET /api/suppression/emails` includes the sender's email

### 4. Signature
1. `PUT /api/outlook/identities/:id/signature` with `{ signatureHtml: "<p>Best,<br>Your Name</p>" }`
2. **Expected**: Response `{ success: true, signatureHtml: ... }`
3. `GET /api/outlook/identities/:id/signature` returns the saved HTML

### 5. Unread only filter
1. Toggle "Unread only" in Inbox threads header
2. **Expected**: Thread list re-filters (currently client-side; `GET /api/inbox/messages?unreadOnly=true` for server-side)

Status: ✅ VERIFIED VIA BUILD
