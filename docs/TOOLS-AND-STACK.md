# ODCRM – Tools and Stack (Detailed)

This document lists **every major tool and stack** used to build, push, host, and run the OpenDoors CRM system.

---

## 1. Development & coding

### 1.1 Languages & runtime

| Layer | Technology | Version / notes |
|-------|------------|------------------|
| **Frontend runtime** | Node.js | **22.x** (see root `package.json` `engines.node`) |
| **Backend runtime** | Node.js | **24.x** (see `server/package.json` `engines.node`) |
| **Language (frontend & backend)** | TypeScript | ~5.9 (frontend), ^5.5 (server); strict typing |
| **Module system** | ESM | `"type": "module"` in both root and server `package.json` |

### 1.2 Frontend stack

| Purpose | Technology | Notes |
|--------|------------|--------|
| **UI framework** | React | ^18.3 |
| **Build tool** | Vite | ^7.2 (dev server, HMR, production build) |
| **React build integration** | @vitejs/plugin-react | ^5.1 |
| **Component library** | Chakra UI | ^2.10 (@chakra-ui/react, @chakra-ui/icons) |
| **Styling** | Emotion | @emotion/react, @emotion/styled (used by Chakra) |
| **Animation** | Framer Motion | ^12.x |
| **Tables / data grid** | TanStack React Table | ^8.21 |
| **Drag and drop** | @dnd-kit | core, sortable, utilities |
| **Icons** | react-icons | ^5.5 |
| **CSV parsing** | PapaParse | ^5.5 |
| **HTTP client** | Native `fetch` | Wrapped in `src/utils/api.ts` (no axios) |

### 1.3 Backend stack

| Purpose | Technology | Notes |
|--------|------------|--------|
| **HTTP server** | Express | ^4.19 |
| **Validation** | Zod | ^3.23 (request body/query validation) |
| **CORS** | cors | ^2.8 |
| **Env config** | dotenv | ^16.4 |
| **Scheduling / cron** | node-cron | ^3.0 (workers) |
| **Microsoft APIs** | @microsoft/microsoft-graph-client | ^3.0 (Outlook/Graph) |
| **Azure identity** | @azure/identity | ^4.0 (if used for server-side Azure auth) |

### 1.4 Database & ORM

| Purpose | Technology | Notes |
|--------|------------|--------|
| **ORM** | Prisma | ^5.19 (server), ^5.22 (root for generate); schema in `server/prisma/schema.prisma` |
| **Database** | PostgreSQL | Via Prisma; production uses Azure PostgreSQL (see Hosting) |
| **Migrations** | Prisma Migrate | `prisma migrate dev` / `prisma migrate deploy` |

### 1.5 Authentication (frontend)

| Purpose | Technology | Notes |
|--------|------------|--------|
| **Identity / login** | Microsoft Authentication Library (MSAL) | @azure/msal-browser, @azure/msal-react |
| **Identity provider** | Microsoft Entra ID (Azure AD) | Login and user identity; config in `src/auth/msalConfig.ts` |

### 1.6 Development tooling

| Purpose | Technology | Notes |
|--------|------------|--------|
| **Linting** | ESLint | ^9.39 (flat config), typescript-eslint, React plugins |
| **Backend dev runner** | tsx | ^4.16 (`tsx watch src/index.ts` for server) |
| **Run frontend + backend together** | concurrently | ^9.1 (`npm run dev:all`) |

---

## 2. Version control & repository

| Purpose | Technology | Notes |
|--------|------------|--------|
| **Version control** | Git | Standard Git workflow |
| **Hosting** | GitHub | Repository and remotes (e.g. `origin`) |
| **Branch used for deploys** | `main` | Frontend and backend workflows trigger on push to `main` |

---

## 3. CI/CD – Build and deploy

### 3.1 Pipeline platform

| Purpose | Technology | Notes |
|--------|------------|--------|
| **CI/CD** | GitHub Actions | Workflows under `.github/workflows/` |

### 3.2 Frontend deployment

| Step | Technology / action | Notes |
|------|---------------------|--------|
| **Trigger** | Push to `main` (excluding `server/**` and backend workflow file) | `.github/workflows/deploy-frontend-azure-static-web-app.yml` |
| **Runner** | `ubuntu-latest` | GitHub-hosted |
| **Node** | setup-node@v4 | Node **22** |
| **Install** | `npm ci` | From root; uses `package-lock.json` |
| **Build** | `npm run build` (Vite) | With env: `VITE_API_URL`, `VITE_AZURE_*`, `VITE_AUTH_ALLOWED_EMAILS` from secrets |
| **Deploy** | Azure Static Web Apps | Action: `azure/static-web-apps-deploy@v1`; deploy token in `AZURE_STATIC_WEB_APPS_API_TOKEN` |
| **Output** | Static files from `dist/` | `skip_app_build: true` (build done in workflow) |

### 3.3 Backend deployment

| Step | Technology / action | Notes |
|------|---------------------|--------|
| **Trigger** | Push to `main` that touches `server/**` or the backend workflow file | `.github/workflows/deploy-backend-azure.yml` |
| **Runner** | `ubuntu-latest` | GitHub-hosted |
| **Node** | setup-node@v4 | Node **24** |
| **Install** | `cd server && npm ci` | Uses `server/package-lock.json` |
| **Prisma** | `npm run prisma:generate` | Uses `DATABASE_URL` from secrets |
| **Build** | `cd server && npm run build` | TypeScript compile to `server/dist/` |
| **Deploy** | Azure App Service | Action: `azure/webapps-deploy@v3`; uses `AZURE_WEBAPP_NAME` and `AZURE_WEBAPP_PUBLISH_PROFILE` |
| **Output** | `./server` (App Service runs `node dist/index.js`) | |

### 3.4 GitHub secrets (typical)

- `AZURE_STATIC_WEB_APPS_API_TOKEN` – Static Web App deploy token  
- `AZURE_WEBAPP_NAME` – App Service name  
- `AZURE_WEBAPP_PUBLISH_PROFILE` – Publish profile XML for App Service  
- `DATABASE_URL` – PostgreSQL connection string (e.g. Azure)  
- `VITE_AZURE_CLIENT_ID`, `VITE_AZURE_TENANT_ID`, `VITE_AUTH_ALLOWED_EMAILS` (and optionally `VITE_AZURE_REDIRECT_URI`) – used at **build time** for frontend env

---

## 4. Database

| Aspect | Technology | Notes |
|--------|------------|--------|
| **Engine** | PostgreSQL | Compatible with Prisma `postgresql` provider |
| **Production host** | Azure Database for PostgreSQL – Flexible Server | Hostname pattern e.g. `odcrm-postgres.postgres.database.azure.com` |
| **Connection** | `DATABASE_URL` | In `server/.env` (local) and Azure App Service / GitHub secrets (prod); `sslmode=require` for Azure |
| **Schema & migrations** | Prisma | `server/prisma/schema.prisma`; migrations applied with `prisma migrate deploy` (e.g. manually or in setup) |
| **Local dev** | Optional local PostgreSQL or same Azure DB | Depends on `server/.env` |

---

## 5. Hosting (production)

### 5.1 Frontend

| Aspect | Technology | Notes |
|--------|------------|--------|
| **Service** | Azure Static Web Apps | Serves static files from `dist/` |
| **URL (example)** | https://odcrm.bidlow.co.uk | Custom domain; CNAME to the Static Web App hostname |
| **API proxy** | Same Static Web App | `staticwebapp.config.json`: `/api/*` → backend URL |
| **Backend URL (example)** | https://odcrm-api-hkbsfbdzdvezedg8.westeurope-01.azurewebsites.net | Set in workflow as `VITE_API_URL` and in `staticwebapp.config.json` |

### 5.2 Backend API

| Aspect | Technology | Notes |
|--------|------------|--------|
| **Service** | Azure App Service | Node.js app; runs `node dist/index.js` |
| **URL (example)** | https://odcrm-api-hkbsfbdzdvezedg8.westeurope-01.azurewebsites.net | West Europe; app name in `AZURE_WEBAPP_NAME` |
| **Config** | Azure App Service → Configuration | e.g. `DATABASE_URL`, `FRONTEND_URL`, `MICROSOFT_*`, etc. |

### 5.3 Database (production)

| Aspect | Technology | Notes |
|--------|------------|--------|
| **Service** | Azure Database for PostgreSQL Flexible Server | Same region as App Service where possible |
| **Backups** | Azure managed backups | Default retention (e.g. 7 days) |

---

## 6. Local development

| Purpose | How | Notes |
|--------|-----|--------|
| **Frontend** | `npm run dev` | Vite on http://localhost:5173 |
| **Backend** | `cd server && npm run dev` | tsx watch on http://localhost:3001 |
| **Both** | `npm run dev:all` | concurrently runs frontend + server |
| **Frontend env** | `.env.local` (root) | `VITE_API_URL=http://localhost:3001`, `VITE_AUTH_ALLOWED_EMAILS`, etc. |
| **Backend env** | `server/.env` | `DATABASE_URL`, `PORT=3001`, `FRONTEND_URL`, `MICROSOFT_*`, etc. |
| **DB UI** | `cd server && npm run prisma:studio` | Prisma Studio for PostgreSQL |

---

## 7. Summary diagram

```
Developer machine
├── Editor (e.g. VS Code / Cursor)
├── Git → push to GitHub (main)
├── Node 22 (frontend) / Node 24 (server)
├── npm (frontend + server)
└── Local: Vite (5173) + Express (3001) + PostgreSQL (or Azure)

GitHub
├── Repository (ODCRM)
└── Actions
    ├── deploy-frontend-azure-static-web-app.yml → build (Vite) → Azure Static Web Apps
    └── deploy-backend-azure.yml → build (tsc) + Prisma generate → Azure App Service

Production
├── Azure Static Web Apps  → https://odcrm.bidlow.co.uk (frontend + /api/* proxy)
├── Azure App Service      → https://odcrm-api-....azurewebsites.net (Express API)
└── Azure PostgreSQL       → DATABASE_URL (Prisma)
```

---

## 8. Quick reference table

| Category        | Tool / stack |
|----------------|--------------|
| **UI**         | React 18, Chakra UI, Emotion, Framer Motion |
| **Build (frontend)** | Vite 7, TypeScript 5.9 |
| **API**        | Express 4, Node 24, TypeScript, Zod |
| **DB**         | PostgreSQL, Prisma 5 |
| **Auth**       | MSAL (Azure AD / Entra ID) |
| **VC**         | Git, GitHub |
| **CI/CD**      | GitHub Actions |
| **Hosting**    | Azure Static Web Apps (frontend), Azure App Service (API), Azure PostgreSQL (DB) |

---

*Last updated from the codebase to reflect current package versions and workflows.*
