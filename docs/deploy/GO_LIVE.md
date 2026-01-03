### OpenDoors CRM — Go-live on a live domain

This repo is a **Vite frontend** plus an optional **Node/Express + Prisma backend** (required for Email Campaigns + Outlook OAuth).

For a faster “get a URL up first” workflow, start with staging: see `docs/deploy/STAGING.md`.

---

### Target architecture (recommended)

- **Frontend**: Vercel (static SPA)
- **Backend API**: Vercel (server project under `server/`) *or* Render/Railway/Fly (container/web service)
- **Database**: Managed Postgres (Neon / Supabase / Railway / Render)
- **DNS / domain**: your registrar → point to Vercel frontend + backend domain

---

### Step-by-step (production)

#### 1) Choose domains

- **Frontend**: `crm.<yourdomain>.com`
- **API**: `api.<yourdomain>.com`

#### 2) Provision Postgres

- Create a managed Postgres database.
- Set `DATABASE_URL` (with SSL if required).
- Run migrations in production:
  - `npx prisma migrate deploy`

#### 3) Create Azure App Registration (Outlook)

You must create/update an Azure App Registration with:
- **Redirect URI**: `https://api.<yourdomain>.com/api/outlook/callback`
- Required Microsoft Graph permissions per the existing backend docs.

#### 4) Deploy backend (required if you use Email Campaigns)

Deploy `server/` and set environment variables (see `server/env.example` and `DEPLOYMENT.md`):
- `DATABASE_URL`
- `FRONTEND_URL=https://crm.<yourdomain>.com`
- `MICROSOFT_CLIENT_ID`
- `MICROSOFT_CLIENT_SECRET`
- `MICROSOFT_TENANT_ID=common` (or your tenant)
- `REDIRECT_URI=https://api.<yourdomain>.com/api/outlook/callback`
- `EMAIL_TRACKING_DOMAIN=https://api.<yourdomain>.com`

#### 5) Deploy frontend

Deploy the repo root (Vite) and set:
- Any `VITE_*` frontend env vars (if used)
- Ensure SPA rewrites are enabled (already configured in `vercel.json`)

#### 6) Wire DNS

- Point `crm.<yourdomain>.com` to Vercel frontend.
- Point `api.<yourdomain>.com` to the backend host.
- Ensure TLS/HTTPS is active on both.

#### 7) Background jobs (email scheduler + reply detection)

The backend includes workers. In production you need a strategy:
- **Best**: run backend as a long-running service (Render/Railway/Fly) so workers can run continuously.
- **If serverless**: convert to scheduled functions (cron) and/or external scheduler.

---

### “What you need to do” checklist (human-owned)

- Domain purchase + DNS access
- Postgres provisioned + connection string
- Azure App Registration created/updated + client secret stored securely
- Decide hosting platform for backend workers (serverless vs long-running)


