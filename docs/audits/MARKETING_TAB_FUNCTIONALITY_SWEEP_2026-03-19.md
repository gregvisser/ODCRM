# Marketing Tab Functionality Sweep — 2026-03-19

## 1. Executive summary

The Marketing tab is mounted at **Marketing Home** (`?tab=marketing-home` or path `/marketing` where applicable). All nine subviews are mounted and wired to backend routes. The **mounted** Inbox is `InboxTab` in `src/tabs/marketing/components/InboxTab.tsx`. The legacy unmounted `MarketingInboxTab` was **removed** from the repo on 2026-03-19 (see `docs/ops/MARKETING_INBOX_LEGACY_CLEANUP_2026-03-19.md`).

## 2. Mounted Marketing path

- **App:** `src/App.tsx` — top tab `marketing-home`; legacy map includes `inbox`, `reports`, `email-accounts`, `schedules` → Marketing views.
- **Router:** `src/tabs/marketing/MarketingHomePage.tsx` — `SubNavigation` with `activeId={activeView}`; `view` from URL `?view=...`; `coerceViewId` maps legacy `overview`/`people` to `email-accounts`.
- **Subviews (default order):** readiness, reports, lists (Lead Sources), compliance, email-accounts, templates, sequences, schedules, inbox. Each has a tab id and content component.

## 3. Subview-by-subview status

| Subview | Component | Mounted | Primary API usage | Status |
|--------|------------|--------|-------------------|--------|
| **readiness** | ReadinessTab | Yes | /api/sequences, /api/send-worker/* | Working |
| **reports** | ReportsTab | Yes | /api/reports, /api/send-worker/* | Working |
| **lists** (Lead Sources) | LeadSourcesTabNew | Yes | /api/lead-sources, leadSourcesApi | Working |
| **compliance** | ComplianceTab | Yes | /api/suppression, useCustomersFromDatabase | Working |
| **email-accounts** | EmailAccountsTab | Yes | /api/customers, email-identities | Working |
| **templates** | TemplatesTab | Yes | /api/templates, /api/company-data | Working |
| **sequences** | SequencesTab | Yes | /api/sequences, enrollments, send-queue, campaigns | Working |
| **schedules** | SchedulesTab | Yes | /api/schedules, send-worker | Working |
| **inbox** | InboxTab | Yes | /api/inbox/* (threads, replies, messages, read, optout, refresh, reply) | Working |

## 4. What is fully working

- **Navigation:** All subviews are reachable via Marketing sub-nav; deep-link `?tab=marketing-home&view=<id>` works; `coerceViewId` handles legacy views.
- **Tenant scope:** Marketing components that need it use `useEffectiveCustomerId()` / `useScopedCustomerSelection()` and pass `X-Customer-Id` (or equivalent) on API calls.
- **Inbox:** Threads list, thread detail, reply composer, mark read, opt-out, refresh (inbox-message pull), replies list with date range and search; copy correctly describes “Pull recent inbox messages” and toast explains reply-detection timing.
- **Readiness / Reports / Sequences / Schedules / Templates / Compliance / Lead Sources / Email accounts:** Each uses live backend routes; no stub or fake screens in the nav.

## 5. What is partially working

- **None** in the mounted Marketing surfaces (legacy `MarketingInboxTab` removed 2026-03-19).

## 6. What is broken or misleading

- **None** in the **mounted** Marketing surfaces. Inbox refresh copy and button label already state that the action pulls inbox messages and that reply-detected list updates when reply detection runs.

## 7. Safe fixes completed in this run

- **None** required at sweep time. Follow-up: legacy `MarketingInboxTab` was removed 2026-03-19 (see MARKETING_INBOX_LEGACY_CLEANUP doc).

## 8. Larger deferred work

- **Inbox UX:** Any Outlook-style or major Inbox redesign is out of scope; requires explicit product direction (see INBOX_CLOSEOUT_2026-03-19.md).

## 9. Recommended next Marketing priorities

1. **Product-led:** If Inbox UX is to evolve, define scope and then implement (no speculative redesign in this repo).
2. **Continue** using the current Marketing tab as the single source of truth for readiness, reports, lists, compliance, email-accounts, templates, sequences, schedules, and inbox.

---

*Sweep date: 2026-03-19. Repo: ODCRM. Branch: codex/odcrm-independent-stabilization.*
