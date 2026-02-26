# Modes + Persona Contract

## Purpose
Define UI modes and persona expectations for a single ODCRM codebase:
- Agency Operator (now)
- Self-serve Client User (later)

## Definitions
### UIMode
- `agency`: multi-tenant operator UI (can see/switch clients)
- `client`: single-tenant UI (locked to one client; no switching)

**Default today:** `agency`

## Persona Contract

### Agency Operator (now)
Can:
- See client list
- Switch active client
- Use onboarding/admin/diagnostics tooling
- Configure client-level setup + global defaults (where supported)

### Self-serve Client User (later)
Can:
- Use CRM + Engagement + Inbox + Analytics for *their* tenant only
Cannot:
- See the Clients list
- Switch clients
- Access agency-only onboarding/admin tools

## Information Architecture

### Recommended top-level tabs (Agency)
- Clients (tenants you manage)
- Prospects (CRM)
- Engagement
- Analytics
- Settings

### Client mode visibility rules (later)
Hide/disable:
- Clients tab + any client switcher UI
- Agency-only onboarding/admin/diagnostic tools

Keep:
- Prospects, Engagement, Inbox, Analytics, Settings (scoped to fixed tenant)

## Naming Rules
- DB entity remains: **Customer**
- UI label for tenant: **Client**
- Prospect organizations: **Accounts/Companies**
- Prospect individuals: **People/Contacts**

## Future backend contract (later PR)
Add `/api/me` to return:
- `role`: `'agency' | 'client'` (or similar)
- `fixedCustomerId`: string | null
Frontend will use this to enforce client-mode locking.

## Rollout Plan
1) (This PR) Docs + scaffold helpers (`getUIMode`, `isAgencyUI`, `isClientUI`) with NO behavior change.
2) Follow-up PR: use mode to hide Clients tab/switcher in client mode (frontend-only).
3) Follow-up PR: backend `/api/me` + auth-driven mode + fixedCustomerId enforcement.
