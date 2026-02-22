# PR Checklist — audit-remediation-p0 → main

Branch: `audit-remediation-p0`  
Reviewer: complete each item before approving.

---

## Pre-merge (author)

- [x] Backend build passes — `cd server && npm run build` → 0 errors
- [x] Frontend build passes — `npm run build` → 1353 modules, 0 errors
- [x] TypeScript check passes — `npx tsc --noEmit` → 0 errors
- [x] No migration applied in this PR (zero schema/data changes)
- [x] Marketing UI tab removal NOT in PR diff (already deployed as `0150a2d`)
- [x] P0: lists endpoints enforce tenant ownership (`findFirst` with `{ id, customerId }`)
- [x] P0: contact DELETE enforces ownership before deletion
- [x] P0: leads `/aggregations` requires tenant or admin secret (400 if neither)
- [x] P0: leads `/sync/status/all` gated by admin secret (403 if absent)
- [x] P1: `getCurrentCustomerId()` no longer writes `prod-customer-1` fallback to localStorage
- [x] CI smoke tests upgraded (health + `__build` SHA + DB connectivity probe)
- [x] No junk files tracked (`_commit_msg.txt` etc.)
- [x] `.gitignore` updated with all local helper file patterns
- [x] `PR_READYNESS_REPORT.md` produced with full evidence
- [x] `PR_AUDIT_REMEDIATION_SUMMARY.md` updated with rollback plan and deferred items

---

## Reviewer checks

- [ ] Review `server/src/routes/lists.ts` — confirm `getCustomerId` helper, and `findFirst({ where: { id, customerId } })` on all `/:id` routes
- [ ] Review `server/src/routes/contacts.ts` — confirm `findFirst` ownership check before `delete`
- [ ] Review `server/src/routes/leads.ts` — confirm `ADMIN_SECRET` gate on `/aggregations` and `/sync/status/all`
- [ ] Review `.github/workflows/deploy-backend-azure.yml` — confirm new DB probe doesn't block valid deploys
- [ ] Review `src/platform/stores/settings.ts` and `src/utils/api.ts` — confirm fallback removal is safe (no boot crash)
- [ ] Confirm diff does NOT contain `MarketingHomePage.tsx` / `OverviewDashboard.tsx` / `PeopleTab.tsx`

---

## Post-merge verification (deployer)

- [ ] GitHub Actions workflow passes (green checkmark)
- [ ] `/__build.json` SHA matches the merge commit SHA
- [ ] `GET /api/leads/aggregations` (no header) → 400
- [ ] `GET /api/leads/sync/status/all` (no admin header) → 403
- [ ] `GET /api/health` → 200
- [ ] App loads without console errors at `https://odcrm.bidlow.co.uk`
- [ ] Customer selection works normally (no `prod-customer-1` ghost appearing)

---

## Rollback (if needed)

```bash
# Revert the entire merge commit
git revert -m 1 <merge-sha>
git push origin main

# Or revert individual commits (see PR_AUDIT_REMEDIATION_SUMMARY.md for SHAs)
git revert 007750b  # P0 IDOR fixes
git revert 6e2a367  # P0 leads lock
git revert eb1b9e3  # CI hardening
git revert 7870c51  # P1 fallback removal
```
