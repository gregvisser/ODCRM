# Production deploy evidence (no sign-in / no DevTools)

**Purpose:** Prove deployed build (sha + time), detect fatal bootstrap errors, and backend route health using unauthenticated probes only.

---

## Backend evidence (PowerShell)

```text
PS C:\CodeProjects\Clients\Opensdoors\ODCRM> $api="https://odcrm-api-hkbsfbdzdvezedg8.westeurope-01.azurewebsites.net"
PS C:\CodeProjects\Clients\Opensdoors\ODCRM>
PS C:\CodeProjects\Clients\Opensdoors\ODCRM> $r = Invoke-WebRequest -UseBasicParsing "$api/api/_build"
PS C:\CodeProjects\Clients\Opensdoors\ODCRM> "__build status: $($r.StatusCode)"
__build status: 200
PS C:\CodeProjects\Clients\Opensdoors\ODCRM> "__build body: $($r.Content)"
__build body: {"sha":"fe24ad06034255bcac91a18345bce56e715f56fb","time":"2026-02-22T09:35:09Z","service":"odcrm-api"}
PS C:\CodeProjects\Clients\Opensdoors\ODCRM> ""

PS C:\CodeProjects\Clients\Opensdoors\ODCRM>
PS C:\CodeProjects\Clients\Opensdoors\ODCRM> $r = Invoke-WebRequest -UseBasicParsing "$api/api/_routes"
PS C:\CodeProjects\Clients\Opensdoors\ODCRM> "__routes status: $($r.StatusCode)"
__routes status: 200
PS C:\CodeProjects\Clients\Opensdoors\ODCRM> "__routes body: $($r.Content)"
__routes body: {"routes":[{"path":"/api/overview","status":"requiresTenant","code":400},{"path":"/api/inbox/replies?limit=1","status":"requiresTenant","code":400},{"path":"/api/customers","status":"exists","code":200}],"timestamp":"2026-02-22T10:13:39.774Z"}
PS C:\CodeProjects\Clients\Opensdoors\ODCRM> ""

PS C:\CodeProjects\Clients\Opensdoors\ODCRM>
PS C:\CodeProjects\Clients\Opensdoors\ODCRM> $r = Invoke-WebRequest -UseBasicParsing "$api/api/health"
PS C:\CodeProjects\Clients\Opensdoors\ODCRM> "health status: $($r.StatusCode)"
health status: 200
PS C:\CodeProjects\Clients\Opensdoors\ODCRM> "health body: $($r.Content)"
health body: {"status":"ok","timestamp":"2026-02-22T10:13:39.849Z","env":"production","version":"2026-02-11-archive-fix","sha":"fe24ad06034255bcac91a18345bce56e715f56fb","buildTime":"2026-02-22T09:35:09Z","commit":null,"buildTimeEnv":null}
PS C:\CodeProjects\Clients\Opensdoors\ODCRM>
```

Short interpretation:

- **Backend _build** is 200 and shows SHA/time.
- **_routes** returns expected `requiresTenant` 400 for tenant endpoints; `/api/customers` exists (200).
- **health** includes sha/buildTime (verifiable swap).

---

## Frontend evidence (no auth)

Exact PowerShell commands to run:

```powershell
(Invoke-WebRequest -UseBasicParsing "https://odcrm.bidlow.co.uk/__build.json").StatusCode
(Invoke-WebRequest -UseBasicParsing "https://odcrm.bidlow.co.uk/__build.json").Content
```

### Captured output

```text
200
{"sha":"6608d846eac65d2677b3d3eafddcec67fb372c12","time":"2026-02-22T10:04:45Z","app":"odcrm","env":"production","version":1}
```

---

## SHA comparison (frontend vs backend)

| Source | SHA |
|--------|-----|
| Frontend `/__build.json` | `6608d846eac65d2677b3d3eafddcec67fb372c12` |
| Backend `/api/_build` | `fe24ad06034255bcac91a18345bce56e715f56fb` |

**They do not match.** Frontend and backend are on different commits (frontend is newer from a frontend-only deploy; backend deploy runs only when `server/**` or the backend workflow file changes).

---

## Why frontend/backend SHAs may not match

The backend deploy workflow is **path-filtered**: it runs only when there are changes under `server/**` or to `.github/workflows/deploy-backend-azure.yml`. Docs-only or frontend-only commits do not trigger a backend redeploy, so the backend can stay on an older commit (and thus an older SHA) until the next server or workflow change.

---

## Force backend redeploy (no behavior change)

To align backend SHA with frontend without changing app behavior:

1. Make a **no-op change inside `server/**`**, e.g. create or update `server/DEPLOY_TRIGGER.txt` with a single line:
   - `trigger=<UTC_ISO_TIME> sha=<FULL_SHA>` (e.g. current UTC timestamp and `git rev-parse HEAD`).
2. Commit only that file:
   - `git add server/DEPLOY_TRIGGER.txt`
   - `git commit -m "chore(server): trigger backend deploy for SHA alignment"`
   - `git push origin main`
3. Watch the backend workflow: `gh run list --workflow "Deploy Backend to Azure App Service" --limit 3`, then `gh run watch <id> --exit-status`.
4. Verify in prod: call `/api/_build` and confirm the returned `sha` matches the commit you pushed.

This does not change runtime logic.

---

## Clean PowerShell evidence commands (copy/paste)

Run these **exact** commands to verify backend. No sign-in or DevTools required.

```powershell
$api="https://odcrm-api-hkbsfbdzdvezedg8.westeurope-01.azurewebsites.net"

$r = Invoke-WebRequest -UseBasicParsing "$api/api/__build"
"__build status: $($r.StatusCode)"
"__build body: $($r.Content)"

$r = Invoke-WebRequest -UseBasicParsing "$api/api/__routes"
"__routes status: $($r.StatusCode)"
"__routes body: $($r.Content)"

$r = Invoke-WebRequest -UseBasicParsing "$api/api/health"
"health status: $($r.StatusCode)"
"health body: $($r.Content)"
```

---

## Verify frontend without sign-in

1. **Frontend build probe:** Visit [https://odcrm.bidlow.co.uk/__build.json](https://odcrm.bidlow.co.uk/__build.json) — you should see JSON with `sha` and `time`.
2. **Diagnostics page:** Visit [https://odcrm.bidlow.co.uk/__diag](https://odcrm.bidlow.co.uk/__diag) — shows bundle build, frontend __build.json, backend /api/__build, and last fatal (if any).
3. **Trigger marketing route (optional):** Visit [https://odcrm.bidlow.co.uk/marketing?tab=marketing-home&view=email-accounts](https://odcrm.bidlow.co.uk/marketing?tab=marketing-home&view=email-accounts) once.
4. **Re-check diag:** Open [https://odcrm.bidlow.co.uk/__diag](https://odcrm.bidlow.co.uk/__diag) again and confirm **lastFatal** is still none (or note any crash captured).

---

## Verification commands (PowerShell) — legacy

Run after deploy. Replace `<api-base>` with the backend API URL (e.g. `https://odcrm-api-hkbsfbdzdvezedg8.westeurope-01.azurewebsites.net`).

```powershell
# 1) Frontend build probe
$r = Invoke-WebRequest -UseBasicParsing -Uri "https://odcrm.bidlow.co.uk/__build.json"; $r.StatusCode; $r.Content

# 2) Backend build probe
$r = Invoke-WebRequest -UseBasicParsing -Uri "https://odcrm-api-hkbsfbdzdvezedg8.westeurope-01.azurewebsites.net/api/__build"; $r.StatusCode; $r.Content

# 3) Backend routes probe
$r = Invoke-WebRequest -UseBasicParsing -Uri "https://odcrm-api-hkbsfbdzdvezedg8.westeurope-01.azurewebsites.net/api/__routes"; $r.StatusCode; $r.Content

# 4) Diagnostics page (HTML status)
$r = Invoke-WebRequest -UseBasicParsing -Uri "https://odcrm.bidlow.co.uk/__diag"; $r.StatusCode
```

---

## Evidence (fill after running commands)

### Frontend: `__build.json` content (verbatim)

```
StatusCode: 200
Content: {"sha":"d9be310a3ee0cba04d59ea58247c451430c38482","time":"2026-02-22T09:11:32Z","app":"odcrm","env":"production","version":1}
```

### Backend: `/api/__build` content (verbatim)

```
200
{"sha":"fe24ad06034255bcac91a18345bce56e715f56fb","time":"2026-02-22T09:35:09Z","service":"odcrm-api"}
```

### Backend: `/api/__routes` content (verbatim)

```
200
{"routes":[{"path":"/api/overview","status":"requiresTenant","code":400},{"path":"/api/inbox/replies?limit=1","status":"requiresTenant","code":400},{"path":"/api/customers","status":"exists","code":200}],"timestamp":"2026-02-22T09:40:09.352Z"}
```

### Backend: `/api/health` (after verifiable-deploy workflow fe24ad0)

```
200
{"status":"ok","timestamp":"2026-02-22T09:40:07.861Z","env":"production","version":"2026-02-11-archive-fix","sha":"6811a46c597eb3657f000b979a9ba8cb34da4758","buildTime":"2026-02-22T09:23:26Z","commit":null,"buildTimeEnv":null}
```
(Health includes sha/buildTime; may show previous deploy until all instances swap. Use /api/__build as source of truth for current deploy.)

### Backend: `/api/_build` and `/api/_routes` (backward-compat)

Canonical paths /api/__build and /api/__routes are used and working. Single-underscore compat paths optional.

### Workflow run IDs + headSha

- **Frontend:** run ID = 22274246490 , headSha = d9be310a3ee0cba04d59ea58247c451430c38482
- **Backend:** run ID = 22274577319 , headSha = fe24ad0 (fix(diag): verifiable backend deploy, smoke test, build info paths, health per-request)

### Workflow log excerpt (run 22274577319)

```
Deploying backend to: odcrm-api-hkbsfbdzdvezedg8 slot=none package=./server
Smoke test will hit: https://odcrm-api-hkbsfbdzdvezedg8.westeurope-01.azurewebsites.net
...
--- GET .../api/health ---
{"status":"ok","timestamp":"2026-02-22T09:39:28.183Z","env":"production","version":"2026-02-11-archive-fix","sha":"6811a46c597eb3657f000b979a9ba8cb34da4758","buildTime":"2026-02-22T09:23:26Z","commit":null,"buildTimeEnv":null}
Health status: 200
--- GET .../api/__build ---
{"sha":"fe24ad06034255bcac91a18345bce56e715f56fb","time":"2026-02-22T09:35:09Z","service":"odcrm-api"}
__build status: 200
Smoke complete: health=200 required, __build logged
```

### `/__diag` reachable

- Status code: 200

### Last fatal (if any)

If `lastFatal` is present on `/__diag` or from localStorage `odcrm:lastFatal`, paste here. Otherwise: *none*.

```
none (not visited marketing routes in this session; visit /marketing?tab=marketing-home&view=email-accounts and re-check /__diag to confirm no TDZ)
```

---

## Notes

- Do **not** claim "Email Accounts no longer crashes" unless `lastFatal` is empty and `/__diag` shows none after visiting marketing routes.
- Primary goal: prove deployed sha + detect fatal crash without DevTools or sign-in.
