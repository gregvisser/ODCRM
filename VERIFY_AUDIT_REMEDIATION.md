# VERIFY_AUDIT_REMEDIATION.md — Local Verification Log
**Branch:** audit-remediation-p0  
**Date:** 2026-02-22

---

## Build Verification

| Check | Command | Result |
|-------|---------|--------|
| Backend build | `cd server && npm run build` | ✅ PASS — tsc exit 0, no errors |
| Frontend build | `npm run build` | ✅ PASS — 1355 modules, no errors |
| Frontend tsc | `npx tsc --noEmit` | ✅ PASS — exit 0, no errors |

---

## Commit Log (branch vs main)

| SHA | Description | Step |
|-----|-------------|------|
| `007750b` | Fix(P0): prevent IDOR in contact lists routes and contact delete | P0-1, P0-2 |
| `6e2a367` | Fix(P0): lock leads aggregations to tenant (no cross-tenant access) | P0-3, P0-4 |
| `eb1b9e3` | Chore: strengthen backend post-deploy smoke probes (_build + health + DB) | Step 5 |
| `5d85586` | Docs: migration drift report and safe reconciliation plan | Step 6 |
| `7870c51` | Fix(P1): remove prod-customer-1 fallback write-back from getCurrentCustomerId | Step 7 |
| `15c32b4` | Docs: comprehensive ODCRM audit reports (6 markdown files) | Documentation |

---

## P0 Smoke Tests (local manual verification steps)

### P0-1: lists.ts IDOR fix

Start local server: `cd server && node dist/index.js`

```powershell
# Test 1: Missing X-Customer-Id → 400
$r = Invoke-WebRequest -Uri "http://localhost:3001/api/lists/<any-list-id>" -ErrorAction SilentlyContinue
$r.StatusCode
# Expected: 400

# Test 2: Wrong tenant → 404
$r = Invoke-WebRequest -Uri "http://localhost:3001/api/lists/<known-list-id>" `
  -Headers @{"X-Customer-Id"="wrong-tenant-id"} -ErrorAction SilentlyContinue
$r.StatusCode
# Expected: 404

# Test 3: Correct tenant → 200
$r = Invoke-WebRequest -Uri "http://localhost:3001/api/lists/<known-list-id>" `
  -Headers @{"X-Customer-Id"="<correct-customer-id>"}
$r.StatusCode
# Expected: 200

# Test 4: DELETE with wrong tenant → 404
$r = Invoke-WebRequest -Method DELETE `
  -Uri "http://localhost:3001/api/lists/<known-list-id>" `
  -Headers @{"X-Customer-Id"="wrong-tenant-id"} -ErrorAction SilentlyContinue
$r.StatusCode
# Expected: 404
```

### P0-2: contacts.ts DELETE IDOR fix

```powershell
# Test 1: DELETE with wrong tenant → 404
$r = Invoke-WebRequest -Method DELETE `
  -Uri "http://localhost:3001/api/contacts/<known-contact-id>" `
  -Headers @{"X-Customer-Id"="wrong-tenant-id"} -ErrorAction SilentlyContinue
$r.StatusCode
# Expected: 404

# Test 2: DELETE without header → 400
$r = Invoke-WebRequest -Method DELETE `
  -Uri "http://localhost:3001/api/contacts/<known-contact-id>" -ErrorAction SilentlyContinue
$r.StatusCode
# Expected: 400
```

### P0-3: leads /aggregations tenant lock

```powershell
# Test 1: No customerId, no admin secret → 400
$r = Invoke-WebRequest -Uri "http://localhost:3001/api/leads/aggregations" -ErrorAction SilentlyContinue
$r.StatusCode
# Expected: 400

# Test 2: With X-Customer-Id → 200 (scoped to that customer)
$r = Invoke-WebRequest -Uri "http://localhost:3001/api/leads/aggregations" `
  -Headers @{"X-Customer-Id"="<real-customer-id>"}
$r.StatusCode
# Expected: 200

# Test 3: With X-Admin-Secret → 200 (admin all-customer view)
$r = Invoke-WebRequest -Uri "http://localhost:3001/api/leads/aggregations" `
  -Headers @{"X-Admin-Secret"="<ADMIN_SECRET-value>"}
$r.StatusCode
# Expected: 200 with all-customer data
```

### P0-4: leads /sync/status/all admin gate

```powershell
# Test 1: No admin secret → 403
$r = Invoke-WebRequest -Uri "http://localhost:3001/api/leads/sync/status/all" -ErrorAction SilentlyContinue
$r.StatusCode
# Expected: 403

# Test 2: With correct X-Admin-Secret → 200
$r = Invoke-WebRequest -Uri "http://localhost:3001/api/leads/sync/status/all" `
  -Headers @{"X-Admin-Secret"="<ADMIN_SECRET-value>"}
$r.StatusCode
# Expected: 200
```

---

## P1 Smoke Test: getCurrentCustomerId fallback removal

```javascript
// In browser console on production or local app:

// Test 1: Clear the stored customer ID
localStorage.removeItem('currentCustomerId')

// Test 2: Open Network tab, refresh — all /api/* calls should either:
//   a) NOT include X-Customer-Id header (api.ts returns '' → header not set)
//   b) Return 400 from backend (Customer ID required)
// NOT: silently return empty data for 'prod-customer-1'

// Test 3: Check localStorage after refresh
localStorage.getItem('currentCustomerId')
// Expected: null (or whatever was there before — NOT 'prod-customer-1')
```

---

## Outstanding Items (Not in This Sprint)

| Item | Reason | Next Steps |
|------|--------|-----------|
| `leads.ts // @ts-nocheck` removal | 12 TS errors, not a quick win | Fix in dedicated TypeScript cleanup sprint |
| `workspaces` table investigation | Requires prod DB query | Run `server/scripts/inspect-workspaces-table.cjs` against prod |
| Dead component deletion (20 files) | P2 cleanup | Safe to delete after build confirms no dynamic imports |
| Code splitting / React.lazy | P2 performance | Separate sprint |

---

## Production Verification (After Deploy)

After this branch is merged and deployed:

```bash
# Verify backend SHA matches commit
curl https://odcrm-api-hkbsfbdzdvezedg8.westeurope-01.azurewebsites.net/api/__build
# Expected: {"sha":"<merge-commit-sha>","time":"..."}

# Verify P0-4 gate in prod
curl https://odcrm-api-hkbsfbdzdvezedg8.westeurope-01.azurewebsites.net/api/leads/sync/status/all
# Expected: {"error":"Admin access required"} 403

# Verify P0-3 gate in prod
curl https://odcrm-api-hkbsfbdzdvezedg8.westeurope-01.azurewebsites.net/api/leads/aggregations
# Expected: {"error":"Customer ID required"} 400

# Verify P0-1 gate in prod (no tenant header)
curl https://odcrm-api-hkbsfbdzdvezedg8.westeurope-01.azurewebsites.net/api/lists/any-id
# Expected: {"error":"Customer ID required"} 400

# Verify P0-2 gate in prod (no tenant header on DELETE)
curl -X DELETE https://odcrm-api-hkbsfbdzdvezedg8.westeurope-01.azurewebsites.net/api/contacts/any-id
# Expected: {"error":"Customer ID required"} 400
```
