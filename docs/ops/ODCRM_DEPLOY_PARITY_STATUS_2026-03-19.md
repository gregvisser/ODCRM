# Deploy / parity status — 2026-03-19

## Inbox cleanup finalization

- **main SHA (after #320 merge):** `34cf91a46a9e5f389e2cf34a944f41b44af89a7d`
- **PR #320:** feat(inbox): add minimal pagination controls — merged (squash) 2026-03-19.
- **Parity at merge:** Frontend reached 34cf91a; backend deploy for #320 was pending (run 23290607905). Run prod-check with `EXPECT_SHA=34cf91a46a9e5f389e2cf34a944f41b44af89a7d` until PARITY_OK.
- **Inbox truth:** See `docs/audits/INBOX_PRODUCTION_DEEPDIVE.md` for current mounted Inbox state (unread, date-range, pagination, opt-out, reply sender).

## Parity verification (post-cleanup)

- **Verified at:** current main = `c6314aa` (includes final Inbox merge `34cf91a` + ops doc commit).
- **Frontend live SHA:** c6314aadc2bb2ef588b6d0514078212f0258ddb1
- **Backend live SHA:** c6314aadc2bb2ef588b6d0514078212f0258ddb1
- **prod-check result:** PARITY_OK (FE == BE == c6314aa).
- **Inbox cleanup:** operationally settled.
