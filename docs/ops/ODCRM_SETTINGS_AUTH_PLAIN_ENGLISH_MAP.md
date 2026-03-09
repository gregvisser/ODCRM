# ODCRM Settings/Auth Plain-English Map

Last reviewed against shipped main SHA: `197e6903e1cc75feeee0c309fd0123b04e889b18`.

## Evidence model used in this doc
- **Repo-proven**: directly visible in code/routes/config in this repo.
- **Greg-confirmed live setup**: confirmed by Greg for production tenant setup, but not fully provable from repo alone.
- **Inferred**: likely true from architecture and code flow, but not fully provable from repo alone.

## What It Does Now

### Settings area (repo-proven)
- Settings currently has one subview: **User Authorization**.
- The Settings page is mostly an admin/setup shell with tab ordering persistence per signed-in user.
- Tab order persistence is stored via `/api/user-preferences` keyed by user email.

Evidence:
- `src/tabs/settings/SettingsHomePage.tsx`
- `src/contexts/UserPreferencesContext.tsx`
- `src/hooks/useUserPreferences.ts`
- `server/src/routes/userPreferences.ts`

### User Authorization area (repo-proven)
- User Authorization is a CRUD UI over the `users` table:
  - list users
  - create user
  - edit user
  - delete user
- Fields include `userId`, name, email, username, role, department, account status, dates, profile photo.
- Account status (`Active`/`Inactive`) matters for login authorization in `/api/users/me`.

Evidence:
- `src/components/UserAuthorizationTab.tsx`
- `src/hooks/useUsersFromDatabase.ts`
- `server/src/routes/users.ts`
- `server/prisma/schema.prisma` (`model User`)

## What Is Wired To What

### Frontend login/auth wiring (repo-proven)
- App boot uses MSAL (`@azure/msal-browser`, `@azure/msal-react`).
- `AuthGate` enforces sign-in before app content is shown.
- After Microsoft sign-in, frontend calls `/api/users/me` to check whether signed-in email is authorized in ODCRM DB.
- Frontend can call API either at `VITE_API_URL` or relative `/api` fallback.

Evidence:
- `src/main.tsx`
- `src/auth/msalConfig.ts`
- `src/auth/AuthGate.tsx`
- `src/auth/LoginPage.tsx`

### Backend authz lookup wiring (repo-proven)
- `/api/users/me` resolves identity from:
  1. Azure SWA client principal header (`x-ms-client-principal`) or
  2. verified Microsoft bearer JWT (if calling separate backend directly)
- It then checks ODCRM `users` table by normalized email.
- Outcomes:
  - `authorized: true` if user exists and is `Active`
  - `403 not_registered` if missing and auto-provision is off
  - `403 inactive` if user is inactive
  - `401 unauthenticated` if identity cannot be resolved/verified
- Optional auto-provision exists behind `ALLOW_AUTO_USER_PROVISION=true`.

Evidence:
- `server/src/routes/users.ts`
- `server/src/utils/entraJwt.ts`
- `server/src/utils/auth.ts`

### Tenant routing context (repo-proven)
- Tenant context for business routes uses `X-Customer-Id` and no silent default.
- Client-mode fixed tenant uses `/api/me` + env (`ODCRM_UI_MODE`, `ODCRM_FIXED_CUSTOMER_ID`).

Evidence:
- `src/utils/api.ts`
- `src/platform/me.ts`
- `src/platform/mode.ts`
- `server/src/routes/me.ts`
- `server/src/utils/tenantId.ts`

## What ODCRM Controls (repo-proven)
- Whether a Microsoft-authenticated user can enter ODCRM app content (`/api/users/me` check).
- Whether a registered user is active/inactive (`users.accountStatus`).
- User records used by Settings > User Authorization (DB-backed CRUD).
- Per-user Settings UI preferences (`user_preferences` table).
- Tenant scoping behavior in app/backend via `X-Customer-Id` and client-mode fixed tenant.

## What Azure/Microsoft Controls

### Greg-confirmed live setup
- Users authenticate through Microsoft/Azure login.
- User enters Microsoft email.
- Verification includes Microsoft Authenticator/MFA.
- Access is controlled through Azure/domain setup plus ODCRM User Authorization records.

### Repo-proven pieces (but not full tenant policy proof)
- Frontend is wired to Microsoft Entra via MSAL (`clientId`, `tenantId`, authority/redirect config).
- Backend can verify Microsoft JWTs against Microsoft JWKS.

### Not repo-proven on its own
- Exact production tenant Conditional Access/MFA policy details in Azure (enforcement rules, exclusions, device posture rules, etc.).

## What Is Real

### Real and proven in repo/runtime behavior
- Settings currently centers on User Authorization management.
- ODCRM authorization gate is DB-backed by `users` table, not a static frontend allowlist.
- Active/inactive account status is enforced in `/api/users/me`.
- MSAL sign-in and server-side token/client-principal identity handling are implemented.

### Real because Greg confirmed live setup
- Production users are signing in through Microsoft/Azure with Authenticator/MFA in the tenant setup.

## What Is Transitional
- `/api/users/me` supports both SWA principal and bearer token verification paths, indicating compatibility for more than one deployment topology.
- Auto-provision path exists but is env-flag gated (`ALLOW_AUTO_USER_PROVISION`).
- Parts of User Authorization UI still contain migration-era/local-storage remnants in code comments/flows, even though primary read/write is DB-backed.

## What Is Legacy Or Unclear
- Some environment docs reference older hosting stacks and may not match current ODCRM production topology.
- `src/platform/mode.ts` comment says client-mode locking will be implemented later, while `/api/me`-based client-mode blocking is already in place in `App.tsx`.
- User Authorization component contains unused legacy helper paths (allowlist seed helpers/import scaffolding) that are not part of the core authorization gate.

## Safe Next Cleanup Ideas (no behavior change)
1. Remove dead/legacy helper code in `UserAuthorizationTab` that is no longer wired to DB CRUD.
2. Align wording/comments in `src/platform/mode.ts` with current `/api/me` client-mode behavior.
3. Add a short operator-facing note in Settings clarifying: Microsoft sign-in proves identity; ODCRM User Authorization controls app access.
4. Refresh stale environment docs to clearly separate historical examples vs current production hosting/auth topology.
