# Pilot Release — Monday 11am GO/NO-GO Runbook

Use this runbook for the Monday 11am Pilot GO/NO-GO decision. **Risk-minimal: roll forward only; no rollback unless catastrophic.**

---

## GO criteria (all must be true)

| # | Criterion | How to verify |
|---|-----------|----------------|
| 1 | **Prod parity** passes for current `origin/main` SHA | Run prod parity check with `EXPECT_SHA` set to `git rev-parse origin/main`. FE SHA and BE SHA must both equal that SHA. |
| 2 | **Pilot smoke** passes | `npm run test:pilot-release-smoke` exits 0 (all 6 pilot self-tests pass). |
| 3 | **Manual demo rehearsal** steps all complete | Operator completes the steps in `docs/ops/PILOT_RELEASE_DEMO_SCRIPT.md` (or equivalent quick rehearsal). |

If any criterion fails → **NO-GO**.

---

## NO-GO criteria

| Condition | Action |
|-----------|--------|
| Parity fails for **> 20 minutes** (e.g. backend not deployed to expected SHA) | NO-GO. Do not proceed with Pilot handoff until parity passes. |
| **Smoke fails** (`test:pilot-release-smoke` exits non-zero) | NO-GO. Fix or defer; do not present as ready. |
| **Any endpoint returns 500** during smoke or rehearsal | NO-GO. Investigate before proceeding. |

---

## Monday morning timeline

| Time | Activity |
|------|----------|
| **T-60** | Run parity polling + smoke. Confirm GO criteria 1 and 2. |
| **T-45** | Manual demo rehearsal (quick run-through per demo script). Confirm GO criterion 3. |
| **T-30** | Contingency window. **Roll forward only**; no rollback unless catastrophic (e.g. data loss, auth broken). |
| **T-10** | Final confirm: parity still green, smoke still pass, no 500s. |

---

## Copy/paste blocks

### 1. PowerShell parity polling

Run from repo root. Waits up to ~20 minutes (40 × 30s) for FE and BE to match `origin/main` SHA.

```powershell
cd C:\CodeProjects\Clients\Opensdoors\ODCRM
$expected = (git rev-parse origin/main)
Write-Host "EXPECT_SHA=$expected"
for ($i = 1; $i -le 40; $i++) {
  Write-Host "Poll $i..."
  $env:EXPECT_SHA = $expected
  node scripts/prod-check.cjs 2>&1
  if ($LASTEXITCODE -eq 0) { break }
  Start-Sleep -Seconds 30
}
```

### 2. Run pilot smoke

```bash
cd C:\CodeProjects\Clients\Opensdoors\ODCRM
npm run test:pilot-release-smoke
```

### 3. Single evidence command (parity + smoke summary)

If the evidence script is present:

```bash
npm run pilot:evidence
```

### 4. Where to find operator docs

| Doc | Path |
|-----|------|
| Operator cheat sheet | `docs/ops/PILOT_RELEASE_OPERATOR_CHEATSHEET.md` |
| Demo script (5–7 min) | `docs/ops/PILOT_RELEASE_DEMO_SCRIPT.md` |
| Pilot scope & troubleshooting | `docs/ops/PILOT_RELEASE_OPEN_DOORS.md` |

---

## Build / parity endpoints (reference)

- **Frontend SHA:** https://odcrm.bidlow.co.uk/__build.json  
- **Backend SHA:** https://odcrm-api-hkbsfbdzdvezedg8.westeurope-01.azurewebsites.net/api/_build  
