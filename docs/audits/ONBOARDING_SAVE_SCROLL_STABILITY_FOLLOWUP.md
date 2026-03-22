# Onboarding / client workspace save — scroll stability follow-up

## Branch / baseline

| Field | Value |
| --- | --- |
| **Branch** | `codex/fix-onboarding-scroll-jump-followup` |
| **Start SHA (`origin/main` at branch creation)** | `696eb62b0169ecc006cfa71ded8368eca56e4e02` |

## 1. Root cause (remaining jump-to-top)

### A. Global customer list refresh replaced the whole Clients UI

`useCustomersFromDatabase` subscribed to `customerUpdated` / `customerCreated` and called `fetchCustomers()` with **`setLoading(true)`** on every run.

Consumers that **return early** when `loading` is true:

- **`AccountsTabDatabase`**: replaces **AccountsTab** (and the accounts table + any open **Drawer**) with a full-page “Loading customers from database…” spinner.
- **`ContactsTab`**: same pattern for contacts.

Onboarding saves and progress ticks **`emit('customerUpdated')`**. That fired a **foreground** list refetch in **every** mounted `useCustomersFromDatabase` instance. While the **Onboarding** top-level view does not mount `AccountsTabDatabase`, any **Clients** workspace still mounted in the same session (or focus/parallel routes) was affected; more importantly, when operators work **Clients → account drawer** or scroll the **accounts table** (`TableContainer` with `maxH` + `overflowY: auto`), the same event caused **full unmount** of the accounts subtree → **window scroll**, **table scroll**, and **drawer body scroll** all reset.

This was **not** fixable by `window.scrollTo` alone because the scrolled surfaces included **nested overflow containers** and **remount**, not just `window.scrollY`.

### B. Onboarding background GET: restore timing

`CustomerOnboardingTab` restored `window.scrollY` in a **double `requestAnimationFrame`** after `setCustomer`. That can run **after** layout/paint or lose the race with focus/layout, so the page could still **flash** to the top. Restoring in **`useLayoutEffect`** after `customer` updates applies scroll **before paint**, matching the main document scroll surface used in `App` layout (no dedicated inner scroll root for onboarding content).

## 2. Scroll container(s) affected

| Surface | Role |
| --- | --- |
| **`window` / `document.scrollingElement`** | Primary scroll for onboarding page content in current `App` shell. |
| **`AccountsTab` `TableContainer`** | `overflowY: auto`, `maxH: calc(100vh - 300px)` — table body scroll **reset on unmount**. |
| **Chakra `DrawerBody`** | Scrollable account detail — **reset when parent `AccountsTab` unmounted** during global loading. |

## 3. Fix implemented

1. **`useCustomersFromDatabase`**: `fetchCustomers(opts?: { background?: boolean })`. Event-driven and post-mutation refreshes use **`{ background: true }`**, which **does not** call `setLoading(true)` and **does not** flip the UI to the global spinner. Initial mount still uses a **foreground** load. Background fetch errors are logged/warned without clobbering the visible error state.
2. **`CustomerOnboardingTab`**: capture scroll position before a **background** GET; set `pendingWindowScrollY`; **`useLayoutEffect`** on `[customer]` applies `window.scrollTo` **before paint** (replaces double `rAF`).

## 4. Files modified

- `src/hooks/useCustomersFromDatabase.ts`
- `src/tabs/onboarding/CustomerOnboardingTab.tsx`

## 5. Files removed

- None.

## 6. Onboarding page vs account drawer

| Area | Fixed by |
| --- | --- |
| **Onboarding** | `useLayoutEffect` window scroll restore + no unnecessary loading remount from **this** hook when other tabs use the same hook instance (primary win is **Clients** + drawer). |
| **Clients / account drawer / table** | **Background** customer list refresh — **no** full `AccountsTabDatabase` / `ContactsTab` unmount on `customerUpdated`. |

## 7. Validation

| Command | Result |
| --- | --- |
| `npm run lint` | exit **0** |
| `npx tsc --noEmit` | exit **0** |
| `npm run build` | exit **0** |
| `cd server && npm run build` | exit **0** |

**Merge (main):** `3f08a9713d3162cab7fe4ee085353478b21ffa21` (PR [#349](https://github.com/gregvisser/ODCRM/pull/349)).

**Manual:** After deploy — tick onboarding progress, save onboarding — confirm no jump to top; on **Clients**, open account drawer, scroll drawer + table, trigger an update that emits `customerUpdated` — confirm drawer and table position stay stable.

## 8. Limitations / follow-ups

- **Nested scroll only inside Chakra components** (e.g. a future inner panel with its own `overflow`) is not generically tracked; this PR targets **document scroll** + **preventing list-loading remount** (the dominant production issue).
- If a **separate** feature mounts a scrollable region that refetches on `customerUpdated` with its own loading gate, apply the same **background refresh** pattern there.
