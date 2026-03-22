# Account drawer stays open after save — audit & fix

## Branch

`codex/fix-account-stays-open-after-save`

## Start SHA (origin/main at fix time)

`fe3feacb4220776f19feb8368dc17429338c039b`

## 1. Root cause

After a successful `PATCH` to `/api/customers/:id/account`, `patchCustomerAccount` in `AccountsTab.tsx` called `refetchCustomers()` with **no options**.

In `useCustomersFromDatabase`, `refetch` is implemented as `fetchCustomers`. A **foreground** call (`background` not `true`) runs `setLoading(true)` before the request.

`AccountsTabDatabase` renders a full-page “Loading customers from database…” **spinner** whenever `loading` is true, and **does not render** `AccountsTab` in that state (`if (loading) return <VStack>…</VStack>`). That **unmounts** the entire accounts workspace including drawer state (`selectedAccount`, inner tabs, etc.). When loading completes, `AccountsTab` remounts with fresh initial state — the drawer appears “closed” immediately after save.

This matches the same class of issue addressed for `customerUpdated` / `customerCreated` listeners, which already use `fetchCustomers({ background: true })` so the UI does not swap to the spinner.

## 2. Fix implemented

- On successful account PATCH, call **`await refetchCustomers?.({ background: true })`** so the customer list still refreshes but **`loading` is not set to true**, preserving `AccountsTab` mount and drawer state.
- Narrowly widened the `refetchCustomers` prop type on `AccountsTab` to `(opts?: { background?: boolean }) => Promise<void>` so it matches the hook’s `refetch` signature.

## 3. Files modified

- `src/components/AccountsTab.tsx` — background refetch after successful account save; prop type for `refetchCustomers`.

## 4. Files removed

None.

## 5. Active tab / inner state

- **Drawer open state**: Preserved because `AccountsTab` no longer unmounts on post-save refresh.
- **Inner tabs**: Not explicitly reset by this change; they live in `AccountsTab` state and survive as long as the component stays mounted. No new logic was required to re-sync tabs.

## 6. Validation results

| Gate | Exit code |
|------|-----------|
| `npm run lint` | 0 |
| `npx tsc --noEmit` | 0 |
| `npm run build` | 0 |
| `cd server && npm run build` | 0 |

## 7. Limitations / follow-ups

- Other code paths that call `refetch()` without `{ background: true }` while the accounts UI is visible could still cause the same symptom; this fix targets the **post-account-save** path only.
- The **Retry** button on the accounts load error UI in `AccountsTabDatabase` intentionally uses foreground `refetch()` so the user sees loading during recovery.
