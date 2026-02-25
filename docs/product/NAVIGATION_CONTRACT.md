# ODCRM Navigation Contract

## Purpose
Define the correct information architecture for ODCRM as an **Agency-mode outbound CRM** that can later support **Client self-serve mode** without rebuilding.

## Definitions (critical)
- **Client (UI term):** An OpenDoors-managed tenant. Backend entity may remain named `Customer`.
- **Prospect Account (CRM term):** A target company you sell to (not a Client).
- **Prospect Person / Contact (CRM term):** An individual at a Prospect Account.
- **Active Client Context:** The currently selected tenant (agency mode) or fixed tenant (client mode). All API calls must be scoped to this.

## Modes
### Agency Mode (now)
- Users can manage multiple **Clients**.
- UI shows a **Client switcher** and a **Clients** tab.
- Onboarding/admin tools exist and are accessible only to agency roles.

### Client Self-Serve Mode (later)
- Users are locked to a single **Client**.
- UI hides **Clients** tab and hides client switcher.
- Same CRM/Engagement/Inbox/Analytics/Settings modules remain.

## Top-level navigation (Agency Mode)
1. **Clients**
   - Client list & selection
   - Client health checklist (senders linked, domains configured, suppression, lead source)
   - Onboarding status (agency-only)
2. **Prospects**
   - People (contacts/prospects)
   - Companies (prospect accounts)
   - Lists/Segments
   - Activity timeline
3. **Engagement**
   - Templates
   - Sequences (multi-step; later multi-channel)
   - Enrollments / Queue
   - Schedules (if applicable)
4. **Inbox**
   - Replies/threads
   - Dispositions
   - Auto-pause on reply rules (later)
5. **Analytics**
   - Sequence performance
   - Deliverability (bounce/opt-out)
   - Team performance (later)
6. **Settings**
   - Senders (Email accounts/identities)
   - Compliance (Suppression)
   - Tracking domain / email config
   - Integrations (Sheets etc.)
   - Users/Roles (later)
   - Billing (later)

## Visibility rules
- **Agency operator role**
  - Sees Clients tab + client switcher
  - Sees onboarding/admin tools
- **Client user role**
  - Does not see Clients tab
  - No client switcher
  - No onboarding/admin tools

## Active Client Context rules (must be true everywhere)
### Frontend
- Exactly one source of active client (store/state).
- API requests must carry `x-customer-id` header derived from active client.
- No silent fallbacks like `prod-customer-1`.

### Backend
- Tenant-scoped endpoints resolve tenant from:
  1) `x-customer-id` header (primary)
  2) explicit query/body only where documented
- Must validate tenant exists and enforce row-level scoping.
- Never accept tenant identifiers from unsafe locations (e.g., arbitrary body spread).

## Naming rules
- UI uses "Client(s)" for the tenant concept.
- UI uses "Account/Company" only for prospect companies.
- "Customer" is backend/model naming only unless later refactor.

## Stage gates
Stage 0 must produce a repo-verified mapping of:
- Current nav → Contract nav
- Current tenant context flow → Contract rules
- Current backend routes → Tenant enforcement status
