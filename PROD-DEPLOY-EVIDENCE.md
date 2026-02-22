# Production deploy evidence (no sign-in / no DevTools)

**Purpose:** Prove deployed build (sha + time), detect fatal bootstrap errors, and backend route health using unauthenticated probes only.

---

## Verification commands (PowerShell)

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
<paste output of command 1>
```

### Backend: `/api/__build` content (verbatim)

```
<paste output of command 2>
```

### Backend: `/api/__routes` content (verbatim)

```
<paste output of command 3>
```

### Workflow run IDs + headSha

- **Frontend:** run ID = ______ , headSha = ______
- **Backend:** run ID = ______ , headSha = ______

### `/__diag` reachable

- Status code: ______

### Last fatal (if any)

If `lastFatal` is present on `/__diag` or from localStorage `odcrm:lastFatal`, paste here. Otherwise: *none*.

```
<paste or "none">
```

---

## Notes

- Do **not** claim "Email Accounts no longer crashes" unless `lastFatal` is empty and `/__diag` shows none after visiting marketing routes.
- Primary goal: prove deployed sha + detect fatal crash without DevTools or sign-in.
