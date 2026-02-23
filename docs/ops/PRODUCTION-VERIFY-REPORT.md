# Production verification report (commit 99b3499)

**Date:** 2026-02-22  
**Deployed commit:** 99b3499 (frontend Actions run 22272409007 success)

---

## 1) window.__ODCRM_BUILD__ output in prod

**Manual step required.** After hard refresh (Ctrl+Shift+R) on https://odcrm.bidlow.co.uk:

1. Open DevTools (F12) → Console.
2. Run: `window.__ODCRM_BUILD__`
3. **Record output here.** Expected: `{ sha: "99b3499...", time: "..." }` (sha may be short or full).

If you see `undefined`, the build stamp may not be set in Azure (check workflow env: `VITE_BUILD_SHA`, `VITE_BUILD_TIME`).

---

## 2) Email Accounts in prod: loaded yes/no

**Manual step required.**

- Go to **Marketing → Email Accounts**.
- **Confirm:** [ ] No crash screen  [ ] Page renders
- If it still crashes, go to section 3.

---

## 3) If error: first console error + full stack + chunk filename

**Only if Marketing → Email Accounts still crashes:**

- In Console, expand the **first red error**.
- Copy:
  - **Message** (e.g. `ReferenceError: Cannot access '_' before initialization`)
  - **Full stack trace** (all frames)
  - **Chunk filename** (e.g. `index-XXXXX.js`)

Paste below for sourcemap pinning and minimal fix.

---

## 4) ripgrep (rg) and concatenated-import search

- **rg (ripgrep) CLI:** **Not installed** on this machine (`rg --version` → command not found).
- **@vscode/ripgrep:** Present as devDependency (Node module, not CLI). No standalone `rg` executable from it.
- **Reliable search without rg:**
  - **PowerShell script:** `scripts/search-concatenated-imports.ps1` (run via `npm run search:concatenated-imports`).
  - **Result:** **0 matches.** No concatenated-import corruption found in `src/`.
- **Workspace Grep tool** (ripgrep-based): Also run; **0 matches** for patterns `from ['\"][^'\"]+['\"]\s*import`, `'import\s+\{`, etc.

**Summary:** No concatenated imports found. Search is reproducible with `npm run search:concatenated-imports`.

---

## 5) If pinned: TS/TSX file + line:col + what '_' mapped to + minimal fix

**Only if crash persisted and was reproduced with sourcemaps:**

- **File path:** _N/A if no crash_
- **Line:col:** _N/A_
- **Symbol '_' mapped to:** _N/A_
- **Minimal fix description:** _N/A_

---

## 6) Deployed headSha after any new fix

- **Current deployed headSha:** `99b34999c04f5044f4358db0477a3a7ec90f385c` (run 22272409007).
- **No new fix committed** in this session; only verification and tooling (script + npm script) added.

---

## Quick prod check (copy-paste in Console)

```javascript
// 1) Build SHA
window.__ODCRM_BUILD__

// 2) After navigating to Marketing → Email Accounts, if error:
// Copy the first error's message, stack, and script URL (chunk name).
```
