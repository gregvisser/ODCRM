### OpenDoors CRM — Staging deployment (recommended path)

Goal: get a **real URL** for the Vite app + a **long-running backend** for workers, without committing secrets to git.

---

### Recommended staging architecture

- **Frontend (Vite SPA)**: Vercel (Preview/Production both work; use a dedicated “staging” project)
- **Backend (Express + Prisma + workers)**: Render/Railway/Fly (long-running web service)
- **Database**: Managed Postgres (Neon/Supabase/Railway/Render)

Why: the backend starts email scheduler + reply detection workers inside `server/src/index.ts`, so it must be a **process that stays up**.

---

### 1) Staging domains (example)

- **Frontend**: `https://odcrm-staging.<yourdomain>.com`
- **API**: `https://odcrm-api-staging.<yourdomain>.com`

---

### 2) Frontend env vars (Vite)

Set in your frontend host (Vercel project settings):

```env
VITE_API_URL=https://odcrm-api-staging.<yourdomain>.com
```

Local dev fallback is `http://localhost:3001` (see `src/utils/api.ts`).

---

### 3) Backend env vars (server)

See `server/env.example` for the full list. Minimum staging values look like:

```env
NODE_ENV=production
PORT=3001

FRONTEND_URL=https://odcrm-staging.<yourdomain>.com
DATABASE_URL=postgresql://user:pass@host/db?sslmode=require

MICROSOFT_CLIENT_ID=...
MICROSOFT_CLIENT_SECRET=...
MICROSOFT_TENANT_ID=common

REDIRECT_URI=https://odcrm-api-staging.<yourdomain>.com/api/outlook/callback
EMAIL_TRACKING_DOMAIN=https://odcrm-api-staging.<yourdomain>.com
```

---

### 4) Deploy backend (long-running)

Render example:

- **Root Directory**: `server`
- **Build Command**: `npm install && npx prisma generate && npm run build`
- **Start Command**: `npm start`
- **Health Check Path**: `/health`

Then run migrations against the staging DB:

```bash
cd server
npx prisma migrate deploy
```

---

### 5) Deploy frontend (Vercel)

Deploy repo root. The SPA rewrite is already configured in `vercel.json`.

---

### 6) Smoke tests

- **Backend**: `GET /health` returns `{ status: "ok" }`
- **Frontend**: Email Campaigns UI loads and can talk to API (via `VITE_API_URL`)


