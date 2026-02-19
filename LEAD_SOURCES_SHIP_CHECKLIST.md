# Lead Sources — Ship Checklist

## Compile checks (run before ship)

- **Server:** `cd server` then `npx prisma validate`, `npx prisma generate`, `npm run build` (on Windows PowerShell use `;` between commands).
- **Frontend:** From repo root: `npm run build`.
- Fix any TS errors, unused imports, or broken types before deploying.

---

## Preconditions

### Environment variables

- **Backend (`server/.env`):**
  - `DATABASE_URL` — PostgreSQL (local or Azure).
  - No extra env vars required for lead-sources (no Google API key if using public CSV export URLs; if you add server-side Google auth later, add those here).

- **Frontend (`.env.local` or build env):**
  - `VITE_API_URL` — backend API base URL (e.g. `https://your-api.azurewebsites.net` for production).

### API contract

Endpoints: GET `/api/lead-sources`, POST `/:sourceType/connect`, POST `/:sourceType/poll`, GET `/:sourceType/batches`, GET `/:sourceType/contacts`, GET `/:sourceType/open-sheet`. All use `getCustomerId(req)`; connect has TODO for production guard; open-sheet does not leak `spreadsheetId` in JSON.

### Sheet config

- Users connect one Google Sheet per source (Cognism, Apollo, Social, Blackbook) via **Connect** in the UI.
- Sheets are **immutable** (no column changes expected); CSV export is used.
- No DB persistence of contact rows; only metadata and first-seen tracking.

---

## DB migration application

### Local dev

1. `cd server`
2. `npx prisma migrate deploy`
3. `npx prisma generate`
4. Verify: `npx prisma migrate status` → "Database schema is up to date."

### Azure production

- **Option A:** Push to the branch that triggers your backend CI. The workflow runs `npx prisma migrate deploy` against the production DB (see `.github/workflows/deploy-backend-azure.yml`). Ensure the baseline step includes any prior migrations; the new migration `20260219120000_add_lead_source_sheet_config_and_row_seen` will be applied automatically.
- **Option B:** Run manually with production connection string:
  - `cd server`
  - `DATABASE_URL="<azure-connection-string>" npx prisma migrate deploy`
  - Redeploy the app so the new schema is used.

See **LEAD_SOURCES_MIGRATION_APPLY.md** for full steps and shadow-DB notes.

---

## Azure deployment notes

- Frontend: deploy as usual (e.g. Azure Static Web Apps from GitHub). No lead-sources-specific config.
- Backend: same App Service deploy; ensure `DATABASE_URL` in Azure points at the DB where migrations were applied.
- After deploy, run the curl smoke tests against production (replace base URL and use a real customer id).

---

## Rollback

### Revert Marketing tab to old Lead Sources tab

1. In `src/tabs/marketing/MarketingHomePage.tsx`:
   - Change `LeadSourcesTabNew` back to `LeadSourcesTab` (and fix import).
2. Rebuild and deploy.
3. **DB:** The new tables and enum are additive. Rollback of schema would require manual SQL (drop tables, drop enum) only if you must remove the feature entirely; otherwise leaving them in place is safe.

---

## Monitoring

### Where to check logs

- **Backend:** Azure App Service → Log stream, or Application Insights if configured. Logs from `server/src/routes/leadSources.ts` (e.g. errors from poll/connect) will appear in normal app logs.
- **Frontend:** Browser console (F12) on https://odcrm.bidlow.co.uk (or your production URL). Check for failed network requests to `/api/lead-sources/*`.

### Errors to watch for

- **500 on GET /api/lead-sources:** Often Prisma/schema (e.g. migration not applied). Run `prisma migrate status` and fix DB.
- **404 on open-sheet or contacts:** Source not connected or wrong customer. Confirm `x-customer-id` and that the source is connected for that customer.
- **Poll failed / HTML instead of CSV:** Sheet URL not exportable (permissions or not a spreadsheet). Ask user to share sheet with "Anyone with link" view or fix URL.
- **CORS or 401:** Check API URL and auth middleware; ensure `x-customer-id` is allowed and not stripped by a proxy.

---

## Post-deploy verification

1. Open Marketing → Lead Sources; confirm 4 source cards and no console errors.
2. Connect one source (if you have a test sheet); poll; view batches; view contacts; open sheet.
3. Use in sequence → Sequences → Preview recipients; confirm modal loads.
4. Run curl smoke tests against production with a real customer id.

---

*End of Ship Checklist*
