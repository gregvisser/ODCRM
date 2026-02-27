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

---

## PowerShell: Enrollments smoke scripts (copy/paste)

### A) Route verification

- **Router:** `server/src/routes/enrollments.ts`
- **Mount:** `server/src/index.ts` → `app.use('/api/enrollments', …, enrollmentsRoutes)`
- **Endpoints:**
  - GET /api/enrollments
  - POST /api/enrollments/:enrollmentId/pause
  - POST /api/enrollments/:enrollmentId/resume

### B) Why "POST /api/…" fails in PowerShell

PowerShell has no `POST` command. Use **Invoke-WebRequest** or **Invoke-RestMethod** with **-Method POST** and **-Uri "..."**. Use **-SkipHttpErrorCheck** so 4xx/5xx responses do not throw; you can read `StatusCode` and `Content` from the response object.

### C) Script A (list then pause/resume first if any)

```powershell
# Script A — List enrollments, then pause/resume the first one (if any)
# Only edit: $cid = "PASTE_REAL_CUSTOMER_ID"

$base = "https://odcrm-api-hkbsfbdzdvezedg8.westeurope-01.azurewebsites.net"
$cid  = "PASTE_REAL_CUSTOMER_ID"
$hdr  = @{ "x-customer-id" = $cid }

function Get-HttpStatusAndSnippet {
  param([object]$Response, [int]$MaxBody = 280)

  if (-not $Response) {
    return [PSCustomObject]@{ StatusCode = 0; Snippet = "(no response)" }
  }

  $code = [int]$Response.StatusCode
  $body = ""

  if ($null -ne $Response.Content) {
    $body = [string]$Response.Content
    if ($body.Length -gt $MaxBody) { $body = $body.Substring(0, $MaxBody) + "..." }
  }

  [PSCustomObject]@{ StatusCode = $code; Snippet = $body }
}

# 1) GET /api/enrollments
try {
  $r = Invoke-WebRequest -Uri "$base/api/enrollments" -Method GET -Headers $hdr -SkipHttpErrorCheck
} catch {
  Write-Host "GET /api/enrollments: exception — $($_.Exception.Message)"
  exit 1
}

$res = Get-HttpStatusAndSnippet -Response $r
Write-Host "GET /api/enrollments: $($res.StatusCode) — $($res.Snippet)"

if ($r.StatusCode -ne 200) { exit 1 }

$payload = $r.Content | ConvertFrom-Json
$list    = $payload.data
$count   = if ($list) { $list.Count } else { 0 }

Write-Host "Enrollments count: $count"

if ($count -eq 0) {
  Write-Host "No enrollments found; create one in UI (Marketing → Sequences → open sequence → Create enrollment), then rerun."
  exit 0
}

$enrId = $list[0].id
Write-Host "Using first enrollment id: $enrId"

# 2) POST pause
try {
  $rPause = Invoke-WebRequest -Uri "$base/api/enrollments/$enrId/pause" -Method POST -Headers $hdr -SkipHttpErrorCheck
} catch {
  Write-Host "POST pause: exception — $($_.Exception.Message)"
  exit 1
}

$resPause = Get-HttpStatusAndSnippet -Response $rPause
Write-Host "POST /api/enrollments/$enrId/pause: $($resPause.StatusCode) — $($resPause.Snippet)"

# 3) POST resume
try {
  $rResume = Invoke-WebRequest -Uri "$base/api/enrollments/$enrId/resume" -Method POST -Headers $hdr -SkipHttpErrorCheck
} catch {
  Write-Host "POST resume: exception — $($_.Exception.Message)"
  exit 1
}

$resResume = Get-HttpStatusAndSnippet -Response $rResume
Write-Host "POST /api/enrollments/$enrId/resume: $($resResume.StatusCode) — $($resResume.Snippet)"
```

### D) Script B (manual enrollment id)

```powershell
# Script B — Pause/resume a specific enrollment (manual $enrId)
# Only edit: $cid and $enrId

$base  = "https://odcrm-api-hkbsfbdzdvezedg8.westeurope-01.azurewebsites.net"
$cid   = "PASTE_REAL_CUSTOMER_ID"
$enrId = "PASTE_ENROLLMENT_ID"
$hdr   = @{ "x-customer-id" = $cid }

function Get-HttpStatusAndSnippet {
  param([object]$Response, [int]$MaxBody = 280)

  if (-not $Response) {
    return [PSCustomObject]@{ StatusCode = 0; Snippet = "(no response)" }
  }

  $code = [int]$Response.StatusCode
  $body = ""

  if ($null -ne $Response.Content) {
    $body = [string]$Response.Content
    if ($body.Length -gt $MaxBody) { $body = $body.Substring(0, $MaxBody) + "..." }
  }

  [PSCustomObject]@{ StatusCode = $code; Snippet = $body }
}

foreach ($action in @("pause", "resume")) {
  try {
    $r = Invoke-WebRequest -Uri "$base/api/enrollments/$enrId/$action" -Method POST -Headers $hdr -SkipHttpErrorCheck
  } catch {
    Write-Host "POST $action: exception — $($_.Exception.Message)"
    continue
  }

  $res = Get-HttpStatusAndSnippet -Response $r
  Write-Host "POST /api/enrollments/$enrId/$action: $($res.StatusCode) — $($res.Snippet)"
}
```
