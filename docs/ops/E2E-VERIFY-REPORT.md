# End-to-end verification report — TDZ fix (da43a55)

**Date:** 2026-02-22  
**Deploy evidence:** Commit `da43a55` · Frontend run **22274001464** success · headSha `da43a55eae6649584db01b557418070d0cf67803`  
**Pinned TDZ:** `src/tabs/marketing/components/EmailAccountsTab.tsx` line 130 — `getCurrentCustomerId` from `platform/stores/settings` (resolved via sourcemaps; fix: leaf imports + local helpers).

---

## Manual verification required

Production (https://odcrm.bidlow.co.uk) requires Microsoft sign-in. The following must be done **in a browser after hard refresh (Ctrl+Shift+R) and sign-in**.

---

## FINAL REPORT (fill verbatim after manual run)

### A) PROD window.__ODCRM_BUILD__ output:

**Manual step:** After opening https://odcrm.bidlow.co.uk, hard refresh (Ctrl+Shift+R), sign in, open DevTools → Console and run:

```js
window.__ODCRM_BUILD__
```

**Record the object here.** Expected for this deploy: `sha` MUST start with `da43a55` (or equal full SHA `da43a55eae6649584db01b557418070d0cf67803`). If you see `undefined`, the build stamp is not set (check Azure workflow env `VITE_BUILD_SHA`).

```
<PASTE output here>
```

---

### B) Email Accounts (prod):

- **URL:** https://odcrm.bidlow.co.uk/marketing?tab=marketing-home&view=email-accounts (or Marketing → Email Accounts in nav)
- **Loaded:** YES / NO
- If **NO:** paste first console error (message + full stack + chunk filename, e.g. `index-XXXXX.js`):

```
<If NO: first console error + full stack + chunk filename>
```

---

### C) Lead Sources (prod):

- **URL:** Marketing → Lead Sources (or equivalent URL)
- **Loaded:** YES / NO
- If errors: first console error + stack + chunk:

```
<If errors: first console error + stack + chunk>
```

---

### D) Dashboards (prod):

- **URL:** https://odcrm.bidlow.co.uk/dashboards or Dashboards in nav
- **Loaded:** YES / NO
- If errors: first console error + stack + chunk:

```
<If errors: first console error + stack + chunk>
```

---

### E) Backend/API issues observed:

- **/api/overview:** status + error text (from Network tab or Console):

```
<status + error text or "none">
```

- **/api/inbox:** status + error text:

```
<status + error text or "none">
```

- **ht.filter is not a function:** stack + chunk (first occurrence, if any):

```
<stack + chunk or "none">
```

---

## Automated checks performed

| Check | Result |
|-------|--------|
| Production reachable | YES — https://odcrm.bidlow.co.uk returns 200, sign-in page present |
| Deploy workflow | Run 22274001464 success, headSha da43a55eae6649584db01b557418070d0cf67803 |
| Build SHA in workflow | Set in workflow: `VITE_BUILD_SHA: ${{ github.sha }}` (commit da43a55) |

---

## Quick copy-paste (Console, after sign-in)

```javascript
// 1) Build SHA (must start with da43a55)
window.__ODCRM_BUILD__

// 2) If any red error on Marketing → Email Accounts / Lead Sources / Dashboards:
// Expand first error → copy message, full stack, and script URL (chunk name).
```

---

**Stop after producing/filling this report.**
