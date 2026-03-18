## Executive summary

The mounted Marketing Inbox is `src/tabs/marketing/components/InboxTab.tsx`, reached from `src/App.tsx` via `src/tabs/marketing/MarketingHomePage.tsx`.

It is not a fake screen, but it is not cleanly production-hardened either. The mounted UI does call live backend routes under `/api/inbox/*`, and those routes are mounted in `server/src/index.ts`. However, the current implementation is mixed:

- Thread/message viewing is real and DB-backed through `emailMessageMetadata`.
- Recent replies are real but come from a different data path (`emailCampaignProspect.replyDetectedAt`), not the thread list.
- Manual refresh remains a partial sync path: it pulls inbox messages into `emailMessageMetadata` but does not run the same reply-detection flow that powers `/api/inbox/replies`. The mounted Inbox copy should describe it as a manual inbox-message pull, not a full replies refresh.
- Unread counts in the thread-list route are now computed from explicit `isRead` selection in `/api/inbox/threads`, so thread summaries and unread-only filtering can reflect DB-backed unread state.
- Reply sending is real, but mailbox selection and signature handling are not surfaced in the mounted Inbox UI.
- The mounted Inbox opt-out action now routes through the inbox-specific `POST /api/inbox/messages/:id/optout` endpoint instead of bypassing it with generic suppression.
- The local `npm run build` output in this repo bakes `VITE_API_URL=http://localhost:3001` from `.env.local`, so the local build proves route emission but does not itself prove a production backend base URL.

Verdict: `partial`, not safely polished enough to call fully production-usable.

## Mounted component path

Exact mounted path from app shell to Inbox:

1. `src/App.tsx`
   - Imports `MarketingHomePage` from `src/tabs/marketing/MarketingHomePage.tsx`
   - Maps legacy `?tab=inbox` to `{ tab: 'marketing-home', view: 'inbox' }`
   - Supports `navigateToMarketing` with `view: 'inbox'`
   - Renders `MarketingHomePage` when `effectiveTab === 'marketing-home'`

2. `src/contracts/nav.ts`
   - Declares `marketing-home` with path `/marketing`

3. `src/tabs/marketing/MarketingHomePage.tsx`
   - Imports `InboxTab` from `src/tabs/marketing/components/InboxTab.tsx`
   - Includes `id: 'inbox'` in the `OpenDoorsViewId` union
   - Builds the Marketing sub-navigation item `{ id: 'inbox', content: <InboxTab /> }`
   - Uses `activeView = coerceViewId(view)` and passes that into `SubNavigation`

4. Mounted Inbox screen
   - `src/tabs/marketing/components/InboxTab.tsx`

Mounted URL shape:

- Top-level path: `/marketing`
- Deep-link state: `?tab=marketing-home&view=inbox`
- Legacy compatibility: `?tab=inbox` is coerced into Marketing Inbox by `src/App.tsx`

Nested components actually used by the mounted screen:

- `src/components/RequireActiveClient.tsx`
- Chakra layout/cards/table/form controls used inline inside `InboxTab.tsx`

Important truth:

- There is no separate mounted thread drawer/detail component.
- There is no separate mounted message detail component.
- There is no separate mounted reply composer component.
- The mounted Inbox is monolithic; thread list, thread detail, reply composer, stats, and follow-up actions all live inline in `src/tabs/marketing/components/InboxTab.tsx`.

Dead/legacy parallel Inbox UI:

- `src/components/MarketingInboxTab.tsx` exists, but it is not imported by `src/App.tsx` or `src/tabs/marketing/MarketingHomePage.tsx`.
- It is legacy/dead from the mounted path perspective.

## Frontend Inbox surface map

Mounted UI claims:

- Title: `Inbox`
- Intro copy: "Review conversations, handle replies, and keep operator follow-up moving across connected mailboxes."
- Main guidance: "Start with unread conversations, open the thread you need, then reply or record an opt-out from the conversation itself."

Mounted operator actions:

- Select customer
- Switch view between `threads` and `replies`
- Change date range `7d | 30d | 90d`
- Open a thread
- Auto-mark inbound thread messages as read when thread opens
- Send a reply to the selected thread
- Mark the conversation contact as opt-out
- Trigger a manual inbox-message pull
- Jump to `Sequences`, `Reports`, or `Readiness`

Filters/search/sorting actually present:

- Customer select: yes
- View toggle (`threads` / `replies`): yes
- Date range filter: yes, but only affects `/api/inbox/replies`
- Search box: yes, but only in replies view
- Unread-only toggle in threads view: yes in UI, backed by `/api/inbox/threads` unread counts
- Sorting: implicit only; thread list is sorted by latest message server-side, replies are sorted by `replyDetectedAt desc`
- Pagination controls: thread list has “Load more conversations” and “Showing N loaded”; replies view has no pagination.

What the mounted Inbox supports today:

- Viewing inbox threads/messages: yes
- Recent replies list: yes
- Read/unread: partial
- Refresh/sync: partial
- Reply: yes
- Opt-out handling: partial
- Signature handling: no
- Mailbox switching / identity selection: no
- Pagination: thread list has load-more (backend limit/offset/hasMore); replies view has no pagination.
- Message detail view: yes, inline thread detail view

Evidence-based feature truth:

- Threads view calls:
  - `GET /api/inbox/threads`
  - `GET /api/inbox/threads/:threadId/messages`
  - `POST /api/inbox/threads/:threadId/reply`
  - `POST /api/inbox/messages/:id/read`
  - `POST /api/inbox/refresh`
- Replies view calls:
  - `GET /api/inbox/replies`
- Opt-out button calls the inbox opt-out route.
  - It posts to `POST /api/inbox/messages/:id/optout`

Mounted-code remnants / signals:

- Many `data-testid` hooks remain in mounted UI.
- `console.error` logging remains in mounted UI for customer-loading failures.
- No explicit TODO comments were found in the mounted file.

Misleading or unsafe frontend behavior:

- The date-range control remains visible in threads view even though threads loading does not use `dateRange`.
- The "Needs action only" toggle depends on unread counts from `/api/inbox/threads`; after the unread fix, those counts can now be derived from `emailMessageMetadata.isRead`.
- Manual refresh should still be read as a message-metadata pull, not a full replies refresh; the mounted copy now needs to stay explicit about that limit.
- Replying happens with no visible mailbox/identity chooser even though a customer may have multiple connected mailboxes.
- Replying does not surface or append any configured mailbox signature in the mounted Inbox UI.
- Threads view uses backend `hasMore`/`offset`: initial load at offset=0, then “Load more conversations” requests next page and appends; “Showing N loaded” reflects count. Replies view has no pagination.

## Backend route map

Mounted route registration:

- `server/src/index.ts` mounts:
  - `/api/inbox` -> `server/src/routes/inbox.ts`
  - `/api/outlook` -> `server/src/routes/outlook.ts`
  - `/api/suppression` -> `server/src/routes/suppression.ts`

Core Inbox routes in `server/src/routes/inbox.ts`:

- `GET /api/inbox`
  - Reads reply-detected prospects for a default date window.
  - Status: `legacy/unsurfaced`
  - Evidence: comment says "404-safe for Marketing Overview"; mounted Inbox does not call it.

- `GET /api/inbox/replies`
  - Reads reply-detected prospects from `emailCampaignProspect` where `replyDetectedAt` is set.
  - Includes contact, campaign, sender identity display fields.
  - Status: `production-real`
  - Mounted UI usage: yes, replies view.

- `GET /api/inbox/threads`
  - Reads `emailMessageMetadata`, groups by `threadId`, returns thread summaries.
  - Status: `partial`
  - Mounted UI usage: yes, threads view.
  - Current truth: route now explicitly selects `isRead`, so unread counts can be computed from DB state instead of implicit/undefined values.

- `GET /api/inbox/threads/:threadId/messages`
  - Returns thread messages from `emailMessageMetadata` scoped by sender identity customer.
  - Status: `production-real`
  - Mounted UI usage: yes.

- `GET /api/inbox/messages`
  - Returns a flat paginated list of inbound messages.
  - Status: `real but unsurfaced`
  - Mounted UI usage: no.

- `POST /api/inbox/messages/:id/read`
  - Marks a message read/unread.
  - Status: `production-real`
  - Mounted UI usage: yes, but only for mark-read on open; no unread toggle is surfaced.

- `POST /api/inbox/messages/:id/optout`
  - Adds sender email/domain to tenant-scoped suppression list.
  - Status: `production-real`
  - Mounted UI usage: yes.

- `POST /api/inbox/refresh`
  - Pulls recent inbox messages from Graph for active identities and stores them in `emailMessageMetadata`.
  - Status: `partial`
  - Mounted UI usage: yes.
  - Current truth: this route still does not run the reply-detection logic that updates `emailCampaignProspect.replyDetectedAt`, so it should be presented as a manual inbox-message pull rather than a full replies refresh.

- `POST /api/inbox/threads/:threadId/reply`
  - Sends a reply using Outlook Graph and stores outbound metadata.
  - Status: `production-real`
  - Mounted UI usage: yes.
  - Reply sender: backend uses the latest message’s sender identity in the thread; if the thread has messages from more than one identity, reply is blocked (409 REPLY_SENDER_AMBIGUOUS).
  - GET thread messages returns `replySender` and `replySenderAmbiguous` so the mounted Inbox can show “Reply will send from: X” and block send when ambiguous.
  - Signature: not appended in Inbox reply flow; UI surfaces “Signature: not appended in Inbox” and optionally that a signature is configured for the mailbox elsewhere.
  - Creates `emailEvent` with type `replied`, which overlaps with inbound reply-detection event semantics.

Related Outlook/identity routes in `server/src/routes/outlook.ts`:

- `GET /api/outlook/auth`
  - Starts Microsoft OAuth with explicit customer binding.
  - Status: `production-real`

- `GET /api/outlook/callback`
  - Saves or updates connected Outlook identity for a customer.
  - Status: `production-real`

- `GET /api/outlook/identities`
  - Lists active identities for a customer.
  - Status: `production-real`
  - Mounted Inbox usage: no
  - Surfaced elsewhere: Email Accounts UI

- `GET /api/outlook/identities/:id/signature`
  - Reads per-identity signature HTML.
  - Status: `production-real`
  - Mounted Inbox usage: no

- `PUT /api/outlook/identities/:id/signature`
  - Updates per-identity signature HTML.
  - Status: `production-real`
  - Mounted Inbox usage: no

Related suppression route in `server/src/routes/suppression.ts`:

- `POST /api/suppression`
  - Upserts a suppression entry under the active customer.
  - Status: `production-real`
  - Mounted Inbox usage: no longer the primary mounted Inbox opt-out path.

Graph integration:

- `server/src/services/outlookEmailService.ts`
  - `fetchRecentInboxMessages()`: reads recent inbox mail from Microsoft Graph
  - `sendEmail()`: sends outbound mail via Graph
  - `replyToMessage()`: replies via Graph reply endpoint

Reply-detection pipeline:

- `server/src/workers/replyDetection.ts`
  - Background worker runs every 5 minutes
  - Pulls messages via `fetchRecentInboxMessages()`
  - Stores inbound `emailMessageMetadata`
  - Links inbound messages to `campaignProspect`
  - Updates `emailCampaignProspect.replyDetectedAt`, `replyCount`, `lastReplySnippet`

Tenant/customer scoping:

- Inbox routes in `server/src/routes/inbox.ts` resolve customer from `X-Customer-Id` header or `customerId` query.
- Thread/message queries scope through:
  - `senderIdentity: { customerId }`
- Reply-detected queries scope through:
  - `campaign: { customerId }`
- Suppression writes scope through:
  - `customerId_type_value`
- Outlook identity routes scope identities by `customerId`.

Mutation auth:

- Inbox mutations use `requireMarketingMutationAuth` from `server/src/middleware/marketingMutationAuth.ts`
- Auth mode defaults to `warn` if not configured otherwise
- In `warn` mode, unauthenticated marketing mutations are still allowed with a warning
- This is not Inbox-only, but it affects Inbox mutation safety

## Production-usability assessment

Verdict: `partial`

What works end-to-end right now:

- Mounted Marketing Inbox path exists and renders from the real app shell.
- Customer-scoped threads can be loaded from `emailMessageMetadata`.
- Thread messages can be opened.
- Replies can be sent through live Graph-backed routes.
- Recent replies can be listed when `replyDetectedAt` has already been populated by the reply-detection worker.
- Opt-out can be recorded from the mounted Inbox through the inbox-specific opt-out route.

What is misleading:

- Date-range selector is visible even in threads mode, but threads do not use it.
- Manual refresh is intentionally narrower than a full replies refresh; it only ingests recent messages into metadata and does not fully refresh reply-detected state.

What is incomplete or fragile:

- No mailbox/identity selection before reply (sender is now explicit: “Reply will send from: X”; ambiguous threads block reply).
- Signature is not appended in Inbox; the UI now states that explicitly.
- Thread list: load-more present (hasMore/offset). Replies view: no pagination.
- No explicit unread toggle/reset behavior beyond auto-mark-read on open.
- Reply path writes `emailEvent.type = 'replied'`, which risks mixing operator replies with prospect replies in reporting.

Dead or legacy paths:

- Frontend: `src/components/MarketingInboxTab.tsx`
- Backend unsurfaced: `GET /api/inbox`, `GET /api/inbox/messages`

Backend routes that exist but are not surfaced cleanly:

- `/api/inbox/messages`
- `/api/outlook/identities/:id/signature`

## Gaps / risks

- Refresh contract risk: operator can pull recent inbox messages and still not see new items in replies view until the background worker catches up.
- Identity ambiguity: when a thread has messages from more than one mailbox, reply is blocked (409) and the UI shows “Reply blocked: multiple mailboxes in this thread.”
- Signature: not applied in Inbox reply flow; UI states “Signature: not appended in Inbox.”
- Reporting contamination risk: operator-sent Inbox replies emit `emailEvent.type = 'replied'`, the same event type used for inbound prospect replies.
- Auth-mode risk: mutation auth middleware defaults to `warn`, so protection depends on environment configuration.
- UX drift risk: mounted Inbox and legacy `MarketingInboxTab` both exist, increasing confusion over what the real screen is.

## Recommended next PRs in priority order

1. ~~Add explicit Inbox pagination / operator controls~~ — Thread list now has “Load more conversations” and “Showing N loaded” using backend hasMore/offset. Replies view pagination remains optional if needed.

2. Revisit refresh semantics only if a fuller replies refresh is worth the extra backend risk
   - Keep any future expansion tied to the existing reply-detection path
   - Avoid introducing a parallel refresh pipeline
