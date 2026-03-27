# Evidence: Accounts + Green The UK deliverability (2026-03-27)

## Mounted files audited (production code paths)

- **Health labels:** `src/constants/accountHealthDefcon.ts` (single source); consumers include `src/components/AccountsTab.tsx`, `src/components/CustomersManagementTab.tsx`, reporting/overview tabs.
- **Logos:** `src/utils/accountLogo.ts` (`accountLogoUrlForDisplay`, `isLikelyFaviconUrl`); `src/components/AccountsTab.tsx` (table Avatar `src`, company-data merge, optional “Company logo URL” patch via `server/src/utils/customerAccountPatch.ts` `logoUrl`).
- **Contacts:** `server/src/routes/customers.ts` — GET overlays `overlayPrimaryContactOntoAccountData`, onboarding/PUT primary upsert uses `buildPrimaryContactDisplayName`, POST/PUT `/customers/.../contacts` persist `phone`/`title`; `src/components/AccountsTab.tsx` contact modal save → PUT; `src/tabs/onboarding/CustomerOnboardingTab.tsx` → PUT onboarding.
- **Test send:** `src/tabs/marketing/components/EmailAccountsTab.tsx` → `POST /api/outlook/identities/:id/test-send`; `server/src/routes/outlook.ts` (`buildTestOutboundBodies`, Graph `sendMail`, SMTP `sendOutboundSmtpMail`).

## Accounts fixes verification (code-level)

1. **Health ladder:** Merged PR #379 used “Foundational…Excellent”, which did **not** match the business contract (Stable…Emergency). Follow-up commit on branch `codex/green-deliverability-audit-and-accounts-proof` restores labels and aligns badge colors + overview watchlist with **higher defcon = worse**.
2. **Logos:** Display uses persisted `logoUrl` only when not a favicon URL; otherwise Avatar initials. No Google favicon URL as primary display when filtered.
3. **Contacts:** Persistence and rehydration are implemented in server + Accounts modal; runtime E2E was not executed in this session—verify in UI after deploy.

## Deliverability audit (Junk / Green The UK)

- **ODCRM test path** builds default **HTML** body + **plain text** for SMTP, uses Graph **HTML** body, and does **not** set a conflicting Graph `from` (sends as authenticated mailbox). Prior bare plain-only Graph body was addressed in #379.
- **Conclusion:** Junk for a new M365 mailbox/domain is **primarily** Microsoft 365 authentication (SPF/DKIM/DMARC alignment), reputation, and content expectations—not a remaining obvious malformed-MIME defect in the audited path. Use `docs/ops/MAILBOX_DELIVERABILITY_CHECKLIST.md` plus the checklist in the PR/report for operators.

## Why a small code change was warranted

- Contract mismatch on health **wording** (A2) required label + dependent UI color/watchlist corrections; not “cosmetic only” if the business definition of 1–6 changed.
