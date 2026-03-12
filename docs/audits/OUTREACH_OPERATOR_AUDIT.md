# Outreach Operator Audit

Date: 2026-03-12
Baseline: `origin/main` `0a25edea1676a78cb7050c12b26d92d2677ac56f`

## Current operator flow
1. Client selection and readiness live in `src/tabs/marketing/MarketingHomePage.tsx` and `src/tabs/marketing/components/ReadinessTab.tsx`.
2. Sending identities are managed in `src/tabs/marketing/components/EmailAccountsTab.tsx` through `/api/outlook/identities`.
3. Templates are managed in `src/tabs/marketing/components/TemplatesTab.tsx` through `/api/templates`.
4. Sequence creation, enrollment, preview, queue inspection, and launch diagnostics are concentrated in `src/tabs/marketing/components/SequencesTab.tsx`.
5. Schedules are exposed in `src/tabs/marketing/components/SchedulesTab.tsx` through `/api/schedules`.
6. Replies and opt-outs are handled in `src/tabs/marketing/components/InboxTab.tsx` and server-side tracking/suppression routes.
7. Outcome reporting exists in `src/tabs/marketing/components/ReportsTab.tsx`, `/api/reports/outreach`, and `/api/send-worker/run-history`.

## What is already production-ready
- Tenant scoping is explicit across the active marketing routes through `X-Customer-Id`.
- Templates now have consistent placeholder, unsubscribe, and signature handling across preview and send paths.
- Suppression/DNC is client-specific and tied to current sheet-linked truth.
- Reply-stop, suppression checks, unsubscribe handling, and hard-bounce blocking already exist in queue/send workers.
- Sequence readiness, preflight, launch preview, run history, queue workbench, and audit routes already expose real backend truth.

## What is functionally correct but too confusing
- `SequencesTab.tsx` mixes operator tasks with admin/debug mechanics in one surface. The page still contains queue workbench, audits, preview-vs-outcome, raw routes, curl helpers, and admin-secret actions.
- `SchedulesTab.tsx` is only partly real. It wraps active campaigns, but the component itself still carries UI-only schedule fields. The file says: `DeliverySchedule extends CampaignSchedule with UI-only scheduling fields`.
- `EmailAccountsTab.tsx` previously encouraged unsafe daily limits with copy like `Recommended: 50-150... up to 500`.
- Outcome visibility exists, but the clearest data was buried in advanced run-history/queue tooling instead of being presented as an operator summary.

## What is incomplete or still risky
- Immediate operator testing was technically possible only through admin-secret canary routes (`/api/send-worker/live-tick`, `/api/send-queue/tick`), which is not an everyday-user workflow.
- Schedules remain a partial abstraction over campaigns instead of a clean operator journey. They need a dedicated follow-up pass.
- There are multiple send paths (`emailScheduler`, `campaignSender`, send queue worker), which makes the architecture harder to reason about even though the queue/send foundations are real.
- The current marketing area still assumes operator knowledge of “queue”, “dry-run”, “live canary”, and “audits”.

## Operator-first hardening applied in this PR
- Strict 30/day cap is now enforced in backend truth and reflected in Email Accounts and Schedules UI.
- Sequences now exposes an operator-facing immediate test action without the admin-secret workflow.
- Sequences now surfaces recent send outcomes in plain operator language in the default operator view.

## Recommended next hardening order
1. Complete a dedicated Schedules simplification pass so it stops behaving like a campaign/debug wrapper.
2. Convert the Sequences creation/start flow into a tighter guided launch journey.
3. Consolidate legacy/parallel send-worker concepts in the UI so operators see one sending model.
4. Tighten Reports and Inbox cross-links around “what sent / what replied / what opted out”.
