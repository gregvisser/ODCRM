# Onboarding UX flow restructure (inline completion)

## Branch / baseline

- **Branch:** `codex/restructure-onboarding-flow`
- **Start SHA (origin/main):** `b61800ddbb91928118efbdcfaade276a18429f53`

## Owner feedback (summary)

- Onboarding must be easier to follow.
- Completion/tick state must sit next to the field or action that drives it (no scrolling to a separate giant checklist).
- Connected emails, suppression, lead tracker, templates, uploads, dates, and manual confirms must feel inline and local.
- Standalone Progress Tracker tab remains removed; this is a **UX/layout** change on top of PR #346 integration.

## Previous UX problem

- `OnboardingProgressSections` rendered **all** Sales/Ops/AM checklist rows in accordions **below** the main form (agreement, emails, profile, etc.).
- Operators had to scroll the form to enter data, then scroll to the bottom to see whether linked emails, suppression, lead tracker, or uploads had completed.
- Auto-ticks and manual confirms were visually detached from the controls that drive them.

## Chosen flow structure (top to bottom)

1. **Sticky summary** — `StickyProgressSummary`: Sales/Ops/AM completion counts + anchor links (`#onb-commercial`, `#onb-team`, `#onb-emails`, `#onb-ops-docs`, `#onb-profile`, `#onb-confirmations`).
2. **Account details** — Contact grid; then **Commercial & contract** (`#onb-commercial`): monthly revenue, agreement upload with inline agreement/contract status, first payment row with upload + status.
3. **Team, targets & lead data** (`#onb-team`): web, sector; AM + inline status; start date + inline; CRM + inline; DDI + inline confirm; days/week; weekly target + inline AM weekly-target readiness; monthly targets; lead actuals.
4. **Leads Google Sheet** — URL/label with **lead tracker** hybrid status directly under the URL field.
5. **Head office** + **Suppression** — suppression button + **DNC inline** status.
6. **Contacts** — unchanged.
7. **Emails** (`#onb-emails`) — **linked mailboxes** status banner above `EmailAccountsEnhancedTab`.
8. **Operations documents** (`#onb-ops-docs`) — `OpsDocumentsInlineCard`: onboarding pack, PPT, client info, brief campaigns — each row is upload + completion badge + meta.
9. **Client profile** (`#onb-profile`) — existing fields; **TargetingReadinessStrip** after qualifying questions (AM auto keys: target list, qualifying, weekly target, templates, ICP, client live).
10. **Confirmations & sign-offs** (`#onb-confirmations`) — `RemainingProgressAccordion`: only items **not** embedded elsewhere (manual sales steps, ops process steps, AM meetings/campaigns launched, sign-offs, etc.).
11. **Save bar** — unchanged.

## Inline completion (by area)

| Area | Implementation |
|------|----------------|
| **Emails linked** | `InlineEmailsLinkedStatus` at top of email card; same rule as PR #346 (≥1 active identity; copy for “1 linked, up to 4 more”). |
| **Suppression / DNC** | `InlineSuppressionDncStatus` under “Open Suppression List” button. |
| **Lead tracker** | `InlineLeadTrackerStatus` under URL field; sheet URL ⇒ auto; else manual checkbox. |
| **Agreement** | `InlineAgreementContractStatus` beside agreement upload in commercial block; `sales_client_agreement` + `sales_contract_signed`. |
| **Payment** | `InlineFirstPaymentRow` in commercial block; upload + `sales_first_payment` badge. |
| **Start date** | `InlineStartDateStatus` beside date input; attribution lines preserved. |
| **Account manager** | `InlineAssignAmStatus` beside AM select. |
| **CRM added** | `InlineCrmAddedStatus` beside CRM checkbox. |
| **DDI** | `InlineDdiStatus` beside DDI field + manual confirm. |
| **Weekly target** | `InlineWeeklyTargetProgress` beside weekly lead target field (`am_weekly_target`). |
| **Templates / live / ICP** | `TargetingReadinessStrip` grid of AM auto keys driven by profile/saves/outreach. |
| **Manual confirmations** | Remain in `RemainingProgressAccordion` with checkbox/date + compact `renderMetaLine` metadata; `am_campaigns_launched` acknowledgements unchanged. |

## Files added

- `src/tabs/onboarding/progress/embeddedKeys.ts`
- `src/tabs/onboarding/progress/OnboardingProgressContext.tsx`
- `src/tabs/onboarding/progress/InlineProgressWidgets.tsx`
- `src/tabs/onboarding/progress/AttachmentInline.tsx`
- `src/tabs/onboarding/progress/StickyProgressSummary.tsx`
- `src/tabs/onboarding/progress/OpsDocumentsInlineCard.tsx`
- `src/tabs/onboarding/progress/TargetingReadinessStrip.tsx`
- `src/tabs/onboarding/progress/datePayload.ts`
- `src/tabs/onboarding/components/RemainingProgressAccordion.tsx`

## Files modified

- `src/tabs/onboarding/CustomerOnboardingTab.tsx` — layout restructure; `OnboardingProgressProvider` wrapper; commercial block; inline embeds; removed duplicate agreement block from profile; ops docs + remainder accordion.

## Files removed

- `src/tabs/onboarding/components/OnboardingProgressSections.tsx` — replaced by context + inline components + `RemainingProgressAccordion`.

## Backend / API wiring

- **No backend** or route contract changes. Still `PUT /api/customers/:id/progress-tracker` and existing auto-tick behavior from PR #346.
- **Frontend:** `OnboardingProgressProvider` centralizes `saveItem`, refresh, and meta display; shared with inline widgets and remainder accordion.

## Validation

| Command | Result |
|---------|--------|
| `npm run lint` | exit 0 |
| `npx tsc --noEmit` | exit 0 |
| `npm run build` | exit 0 |
| `cd server && npm run build` | exit 0 |

## Limitations / deferred polish

- Sticky summary counts are **group totals** (all keys), not “embedded vs remainder” split — acceptable as secondary navigation.
- `TargetingReadinessStrip` uses compact labels; full `AM_ITEMS` wording lives in remainder section for manual-only steps.
- No automated E2E in CI; manual smoke in browser recommended after deploy.
