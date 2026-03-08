# ODCRM User Flow Map

## Scope
This flow map is grounded in current navigation and wiring in [`src/App.tsx`](../../src/App.tsx), top-tab contract in [`src/contracts/nav.ts`](../../src/contracts/nav.ts), and module home pages under `src/tabs/*`.

## Current Likely Flow After Sign-In (Observed)
1. User lands on **Dashboard** by default.
2. User sees KPI-heavy metrics and account table.
3. User manually decides whether to go to:
   - **OpenDoors Clients** (data/account/contact maintenance), or
   - **OpenDoors Marketing** (outreach operations), or
   - **Onboarding** (setup/progress tasks).
4. If no client selected, tenant-scoped modules show explicit guard state via `RequireActiveClient`.
5. Daily outreach activity is mostly concentrated in Marketing tabs, especially Readiness/Sequences/Inbox/Reports.

## Current Actual Flow Problems
- Dashboard does not consistently force a clear “start here then do this” handoff.
- Clients and Onboarding can both look like setup zones; transition to Marketing operations is not always explicit.
- New employees can misinterpret Settings as a workflow step instead of admin-only maintenance.
- Flow depends heavily on user judgment rather than guided transitions.

## Recommended First-Run Employee Flow (Day 1)
1. **Sign in -> Dashboard**
2. **Confirm active client**
3. **If client not setup:** go to **Onboarding**
   - complete client onboarding checklist/progress tasks
4. **If source/account data missing:** go to **OpenDoors Clients**
   - fix account/contact/lead source prerequisites
5. **Go to OpenDoors Marketing -> Readiness**
   - review blockers/warnings and next actions
6. **Open Sequences**
   - run preflight and launch preview
7. **Run safe execution controls** (existing guarded flows)
8. **Use Inbox + Reports**
   - verify outcomes and handle replies

## Recommended Daily-Use Flow (Repeat Operations)
1. **Sign in -> Dashboard (quick health check)**
2. **Open Marketing -> Readiness** as operational home
3. **Sequences** for launch decisions and queue remediation
4. **Inbox** for inbound handling/replies
5. **Reports** for outcome review and follow-up decisions
6. **Only when needed:**
   - **Clients** for upstream data corrections
   - **Onboarding** for setup/progress changes
   - **Settings** for admin authorization tasks

## Recommended Admin/Setup Flow
1. **OpenDoors Clients** for account/contact/source baseline.
2. **Onboarding** for checklist completion and onboarding data capture.
3. **Settings** for user authorization and permissions maintenance.
4. Hand off to **Marketing Readiness** once setup and prerequisites are complete.

## Suggested Cross-Module Handoffs

### Dashboard -> Marketing
- Trigger: execution day / pending sends / exceptions.
- Handoff target: Marketing Readiness.

### Dashboard -> Clients
- Trigger: data quality gaps or missing account/contact context.
- Handoff target: Accounts/Contacts.

### Onboarding -> Marketing
- Trigger: onboarding readiness reaches complete/usable.
- Handoff target: Readiness then Sequences.

### Clients -> Marketing
- Trigger: account/contact/source updates completed.
- Handoff target: Readiness or Sequences depending on urgency.

### Marketing -> Clients
- Trigger: exclusions, suppressions, or recipient/data anomalies requiring upstream fixes.
- Handoff target: Accounts/Contacts/Leads surfaces.

### Marketing -> Reports
- Trigger: post-run verification / trend checks / manager review.
- Handoff target: Reports tab.

## “If User Is Trying To Do X, Go Here First”

| User goal | First destination | Next destination |
| --- | --- | --- |
| Launch outreach safely today | Marketing > Readiness | Sequences |
| Investigate send issues/exceptions | Marketing > Readiness / Exception Center | Queue Workbench / Reports |
| Respond to inbound customer replies | Marketing > Inbox | Sequences/Reports for follow-up context |
| Fix bad account/contact prerequisites | OpenDoors Clients | Marketing > Readiness |
| Complete initial client setup | Onboarding | Marketing > Readiness |
| Manage who can access system features | Settings | Return to active work module |

## Recommended Default “Home” For Normal Employees
- Keep top-level default landing as **Dashboard** for broad visibility.
- Treat **Marketing > Readiness** as the practical operational home and make this explicit in guidance/cues.
