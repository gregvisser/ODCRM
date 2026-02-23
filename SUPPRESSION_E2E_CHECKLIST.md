# Suppression E2E Checklist

## Backend endpoints (all tenant-scoped via x-customer-id)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/suppression/emails` | GET | List suppressed emails for customer |
| `/api/suppression/emails` | POST | Add single suppressed email |
| `/api/suppression/emails/upload` | POST | CSV upload (body: `{ rows: string[], sourceFileName? }`) |
| `/api/suppression/emails` | DELETE | Batch delete by ids (`{ ids: string[] }`) |
| `/api/suppression/domains` | GET | List suppressed domains |
| `/api/suppression/domains` | POST | Add single suppressed domain |
| `/api/suppression/domains/upload` | POST | CSV upload for domains |
| `/api/suppression/domains` | DELETE | Batch delete domains |
| `/api/suppression/check` | POST | Check which emails are suppressed |
| `/api/suppression` | GET | List all suppression entries (supports ?type=email|domain) |
| `/api/suppression/:id` | DELETE | Delete single entry by id |

## Email worker enforcement (server-side, not just UI)

`server/src/workers/emailScheduler.ts`:
- **Batch pre-filter**: `loadSuppressionSets()` called ONCE per campaign tick, builds in-memory Set<email> + Set<domain>
- **Per-email final check**: `isSuppressed()` called before EVERY send attempt
- On suppression match: marks prospect `lastStatus = 'suppressed'`, cancels future steps, logs event

## Sequence enroll endpoint enforcement

`server/src/routes/sequences.ts POST /:id/enroll`:
- Queries `suppressionEntry` for all contact emails + domains
- Builds `suppressedContacts` set
- `validContactIds = contactIds.filter(id => !suppressedContacts.has(id))`
- Returns `{ enrolled, skipped, suppressed, suppressionDetails }`

## Manual test steps

### 1. Upload suppressed emails
```
POST /api/suppression/emails/upload
X-Customer-Id: <customer-id>
{ "rows": ["test@example.com", "another@blocked.com"], "sourceFileName": "test.csv" }

Expected: { success: true, inserted: 2, duplicates: 0 }
```

### 2. Upload suppressed domain
```
POST /api/suppression/domains/upload
X-Customer-Id: <customer-id>
{ "rows": ["blocked-domain.com"], "sourceFileName": "domains.csv" }

Expected: { success: true, inserted: 1 }
```

### 3. Enroll contacts including suppressed ones
```
POST /api/sequences/<sequence-id>/enroll
X-Customer-Id: <customer-id>
{ "contactIds": ["<id-of-contact-with-suppressed-email>", "<id-of-valid-contact>"] }

Expected: { enrolled: 1, suppressed: 1, suppressionDetails: [{ email: "test@example.com", reason: ... }] }
```

### 4. Attempt send via worker (dry-run)
Set `EMAIL_WORKERS_DISABLED=false` and `ENABLE_EMAIL_SCHEDULER=true` in a test environment.
Monitor server logs for:
```
[emailScheduler] ... suppressed=N original=M final=M-N
```

### 5. Inbox opt-out
Open a thread → click "Mark as Opt-out" → verify email appears in suppression list:
```
GET /api/suppression/emails?customerId=<customer-id>
```
Should include the sender's email with `source: "inbox-optout"`.

### 6. Cross-tenant safety
Customer A uploads suppressed email. Customer B cannot see it:
```
GET /api/suppression/emails
X-Customer-Id: <customer-B-id>

Expected: does NOT include Customer A's entries
```

Status: ✅ BACKEND IMPLEMENTED AND VERIFIED VIA BUILD
