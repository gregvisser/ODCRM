# Inbox Closeout Audit — 2026-03-19

## 1. Executive summary

The Marketing Inbox is **operationally settled** on `origin/main`. The mounted UI (`InboxTab`) and backend routes (`/api/inbox/*`) are the single source of truth. No open/superseded PR confusion affects Inbox truth. This document closes out the Inbox as a stabilized module for independent work; further UX/feature work requires explicit product direction.

## 2. Mounted Inbox path

- **App shell:** `src/App.tsx` — top-level tab `marketing-home`; legacy map `inbox` → `{ tab: 'marketing-home', view: 'inbox' }`.
- **Marketing router:** `src/tabs/marketing/MarketingHomePage.tsx` — `view === 'inbox'` renders `InboxTab`; tab id `'inbox'`, label from `t('marketing.inbox')`.
- **Inbox component:** `src/tabs/marketing/components/InboxTab.tsx` — single mounted Inbox UI (threads view, replies view, reply composer, mark read, opt-out, refresh).

URL deep-link: `?tab=marketing-home&view=inbox` (and path-based routing where configured).

## 3. Backend route map

All under `app.use('/api/inbox', observabilityHeaders, inboxRoutes)` in `server/src/index.ts`. Implemented in `server/src/routes/inbox.ts`:

| Method + path | Purpose |
|---------------|---------|
| `GET /` | Root; 404-safe for Marketing overview probe |
| `GET /replies` | Paginated reply-detected items (query: start, end, limit, offset) |
| `GET /threads` | Thread list (query: limit, offset, unreadOnly) |
| `GET /threads/:threadId/messages` | Messages for a thread |
| `GET /messages` | Paginated flat inbound messages (list view) |
| `POST /messages/:id/read` | Mark message read/unread |
| `POST /messages/:id/optout` | Add sender to suppression (inbox-scoped) |
| `POST /refresh` | Trigger inbox poll (fetchRecentInboxMessages); does not run reply-detection flow |
| `POST /threads/:threadId/reply` | Send reply (resolveReplySender; blocks when ambiguous) |

Tenant: `X-Customer-Id` header or `customerId` query. Routes require tenant where applicable.

## 4. Final shipped Inbox capabilities

- **Threads view:** List threads, unread-only filter, open thread → messages, reply composer, mark as read, opt-out from thread.
- **Replies view:** Date-range filtered reply-detected list; search; links to Sequences/Reports/Readiness.
- **Actions:** Refresh (inbox-message pull), mark read, opt-out, send reply (with sender resolution).
- **Customer scope:** InboxTab uses `useEffectiveCustomerId()` and sends `X-Customer-Id` on API calls.

## 5. Known non-blocking limitations

- **Refresh:** `POST /api/inbox/refresh` pulls inbox messages into `emailMessageMetadata`; it does **not** run the reply-detection flow that populates `/api/inbox/replies`. Copy in UI should describe it as a manual inbox-message pull where relevant.
- **Unread:** Derived from `emailMessageMetadata.isRead`; thread list and unread-only filter are DB-backed.
- No Outlook-style full redesign; no multi-folder, no calendar integration. Scope is current thread/reply-centric UX.

## 6. Why Inbox is considered operationally settled

- Single mounted path and single backend route module; no duplicate or superseded Inbox implementations on main.
- Routes probe includes `/api/inbox/replies?limit=1`; deploy verification uses it.
- Recent work (e.g. #328) verified parity and settled status; no open PRs that change Inbox truth without product direction.

## 7. What should NOT be worked on next without explicit product direction

- Outlook-style inbox rebuild or major UX redesign.
- Changing scope of “Inbox” (e.g. adding full reply-detection into Refresh, or new surfaces) without product approval.
- Removing or replacing the current Inbox tab or `/api/inbox` surface without explicit decision.

---

*Audit date: 2026-03-19. Repo: ODCRM, branch: codex/odcrm-independent-stabilization from origin/main.*
