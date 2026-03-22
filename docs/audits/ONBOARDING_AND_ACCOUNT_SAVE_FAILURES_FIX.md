# Onboarding progress-tracker and account PATCH save failures — fix

## Branch / baseline

| Field | Value |
| --- | --- |
| **Branch** | `codex/fix-onboarding-and-account-save-failures` |
| **Start SHA (`origin/main` at branch creation)** | `76d40a20c65c593f082d332856390b3a5ce742d8` |

## 1. Root cause — progress tracker (`PUT /api/customers/:id/progress-tracker`)

The route calls `await getVerifiedActorIdentity(req)`, which uses `verifyMicrosoftJwtAndExtractIdentity` for `Authorization: Bearer` tokens (App Service / no SWA principal). **`jose` `jwtVerify` throws** on expired tokens, invalid signatures, audience mismatch, issuer checks inside `verifyMicrosoftJwtAndExtractIdentity`, and similar failures. Those exceptions were **not caught**, so the route’s outer `catch` returned **500** with `error: 'Failed to update progress tracker'`.

This is **not** a validation bypass: fixing it means **failed verification yields no identity** (same as “no token”), not that unauthenticated writes are allowed.

## 2. Root cause — account patch (`PATCH /api/customers/:id/account`)

The same `await getVerifiedActorIdentity(req)` runs **before** the guarded `if (!actor.email && !actor.userId) return 401`. A **thrown** JWT error never reached that branch; it was caught by the route’s outer `catch`, producing **500** with `error: 'Failed to patch customer account'` and a `requestId`.

## 3. Shared root cause?

**Yes.** Both failures were surfaced as **generic 500** responses because **uncaught exceptions** in the Bearer JWT path of `getVerifiedActorIdentity` (`server/src/utils/actorIdentity.ts`), not because of different business logic in the two handlers.

## 4. Secondary alignment (onboarding)

`OnboardingProgressContext` called `api.put` for the progress-tracker **without** passing `X-Customer-Id` for the **same** `customerId` as the URL. The client helper otherwise sets `X-Customer-Id` from `localStorage` only. If that store was out of sync with the selected onboarding customer, `enforceTenantHeaderForCustomerRoute` could return **403** `tenant_mismatch` (a different error shape than the 500 above, but still a broken save). The fix passes **`X-Customer-Id: customerId`** explicitly on the progress-tracker PUT, matching the pattern used for `PATCH .../account` in `AccountsTab`.

## 5. Fixes implemented

1. **`getVerifiedActorIdentity`**: Wrap `verifyMicrosoftJwtAndExtractIdentity` in **try/catch**. On failure, log a warning and return an **empty** identity (`source: 'none'`), consistent with “no usable auth”. Routes that **require** an actor continue to return **401** when both email and userId are absent; `PUT .../progress-tracker` continues to use `updatedByUserId` of `'unknown'` when identity is empty (existing behavior).
2. **`OnboardingProgressContext`**: Pass `{ headers: { 'X-Customer-Id': customerId } }` on the progress-tracker `api.put` so the header matches the path customer id.

## 6. Files modified

- `server/src/utils/actorIdentity.ts`
- `src/tabs/onboarding/progress/OnboardingProgressContext.tsx`
- `docs/audits/ONBOARDING_AND_ACCOUNT_SAVE_FAILURES_FIX.md`

## 7. Files removed

- None.

## 8. Backend / state wiring

- **No** schema or Prisma changes.
- **No** route contract changes for request bodies.
- **Behavior** change: Bearer JWT verification **no longer throws**; it returns empty identity on verification failure.

## 9. Validation

| Command | Result |
| --- | --- |
| `npm run lint` | exit **0** |
| `npx tsc --noEmit` | exit **0** |
| `npm run build` | exit **0** |
| `cd server && npm run build` | exit **0** |

## 10. Regression / follow-up

- **Manual** (signed-in): tick onboarding progress; save account fields in drawer — expect **200** and no generic 500 toasts.
- If account PATCH still returns **401** after this fix, the token may be expired — **refresh / sign-in** is expected; that is distinct from the previous **500** from thrown JWT verification.

## 11. Limitations

- Does **not** add automatic token refresh; MSAL/session handling unchanged.
- Arbitrary **other** 500 causes (e.g. Prisma) would still need log correlation.
