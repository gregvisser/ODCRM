# System Configuration Audit

**Last Updated:** 2026-01-28
**Purpose:** Complete documentation of all system configurations

---

## 🔵 Azure Resources

### Azure PostgreSQL Flexible Server

**Resource:**
- Name: `odcrm-postgres`
- URL: `odcrm-postgres.postgres.database.azure.com`
- Region: UK South
- Version: PostgreSQL 15
- Pricing Tier: Burstable B1ms (1 vCore, 2GB RAM)

**Database:**
- Name: `postgres` (default)
- Connection String: Stored in `server/.env` as `DATABASE_URL`
- SSL: Required (`sslmode=require`)
- Backup: Automated by Azure (7-day retention by default)

**Access:**
- Admin User: `odcrmadmin`
- Password: Stored securely in `server/.env`
- Firewall: Allows Azure services + specific IPs

**Verification:**
```bash
# Test connection
cd server && npm run prisma:studio

# Check database
node -e "
const { PrismaClient } = require('./server/node_modules/@prisma/client');
const prisma = new PrismaClient();
prisma.customer.count().then(count => {
  console.log('Customers:', count);
  prisma.\$disconnect();
});
"
```

---

### Azure Static Web Apps

**Frontend:**
- Name: `odcrm-frontend`
- URL: https://odcrm.bidlow.co.uk
- Region: UK South
- Custom Domain: Yes (configured)
- SSL/TLS: Automatic (Let's Encrypt)

**Backend API:**
- Type: Azure Static Web App Managed Functions
- URL: https://odcrm.bidlow.co.uk/api
- Proxy to: Backend Express server
- Configuration: `staticwebapp.config.json`

**Deployment:**
- Method: GitHub Actions (automatic on push to main)
- Workflow: `.github/workflows/deploy-frontend-azure-static-web-app.yml`
- Build: Vite (production build)
- Deploy Time: ~2-3 minutes

**Environment Variables (Azure Portal):**
- `VITE_API_URL`: Backend API URL
- `VITE_AUTH_ALLOWED_EMAILS`: Comma-separated authorized emails
- Other: Microsoft OAuth settings

**Verification:**
```bash
# Check deployment
gh run list --limit 1

# Test site
curl -I https://odcrm.bidlow.co.uk
# Should return 200 OK

# Test API
curl https://odcrm.bidlow.co.uk/api/health
# Should return API health status
```

---

## 🔵 Local Development Environment

### Frontend (.env.local)

**Required Variables:**
```env
VITE_API_URL=http://localhost:3001
VITE_AUTH_ALLOWED_EMAILS=user@example.com,admin@example.com
```

**Build:**
```bash
npm run dev          # Development server (localhost:5173)
npm run build        # Production build
npm run preview      # Preview production build
```

---

### Backend (server/.env)

**Required Variables:**
```env
DATABASE_URL=postgresql://odcrmadmin:[password]@odcrm-postgres.postgres.database.azure.com/postgres?sslmode=require
PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:5173

# Microsoft OAuth (Azure AD)
MICROSOFT_CLIENT_ID=[client-id]
MICROSOFT_CLIENT_SECRET=[client-secret]
MICROSOFT_TENANT_ID=common
REDIRECT_URI=http://localhost:3001/api/outlook/callback

# Email Tracking
EMAIL_TRACKING_DOMAIN=http://localhost:3001
```

**Build:**
```bash
cd server
npm run dev                    # Development server
npm run build                  # TypeScript compilation
npm run prisma:studio          # Database GUI
npm run prisma:migrate:dev     # Run migrations (dev)
npm run backup                 # Create database backup
```

---

## 🔵 GitHub Configuration

### Repository

**Name:** `gregvisser/ODCRM`
**URL:** https://github.com/gregvisser/ODCRM
**Default Branch:** `main`
**Protection:** None (direct push allowed)

### GitHub Actions

**Workflow File:** `.github/workflows/deploy-frontend-azure-static-web-app.yml`

**Triggers:**
- Push to `main` branch
- Pull request to `main` branch

**Secrets (Repository Settings → Secrets):**
- `AZURE_STATIC_WEB_APPS_API_TOKEN`: Azure deployment token
- Other: Microsoft OAuth credentials

**Verification:**
```bash
# Check workflow status
gh run list --limit 5

# Watch deployment
gh run watch [run-id]

# View logs
gh run view [run-id] --log
```

---

## 🔵 Database Schema

### Key Tables

**customers**
- Primary customer/account records
- Contains all business-critical data
- JSON field `accountData` for legacy data

**customer_contacts**
- Contact records linked to customers
- Foreign key: `customerId`

**email_campaigns**
- Email marketing campaigns
- Linked to customers

**email_templates**
- Reusable email templates

**email_sequences**
- Automated email sequences

**Verification:**
```bash
# View schema
cd server && npx prisma studio

# Check migrations
cd server && npx prisma migrate status

# Generate updated client
cd server && npm run prisma:generate
```

---

## 🔵 Critical File Locations

### Configuration Files

| File | Purpose | Critical? |
|------|---------|-----------|
| `.env.local` | Frontend environment | ✅ Yes |
| `server/.env` | Backend environment | ✅ Yes |
| `staticwebapp.config.json` | Azure deployment config | ✅ Yes |
| `.github/workflows/deploy-frontend-azure-static-web-app.yml` | CI/CD | ✅ Yes |
| `server/prisma/schema.prisma` | Database schema | ✅ Yes |
| `vite.config.ts` | Frontend build config | ⚠️ Important |
| `server/tsconfig.json` | Backend TypeScript config | ⚠️ Important |

### Rule Files (Mandatory)

| File | Purpose | Auto-Applied? |
|------|---------|---------------|
| `.cursor/rules/quality-standards-mandatory.mdc` | Quality standards | ✅ Yes |
| `.cursor/rules/mandatory-chat-startup.mdc` | Chat startup protocol | ✅ Yes |
| `.cursor/rules/data-protection-mandatory.mdc` | Data protection rules | ✅ Yes |
| `.cursor/rules/development-workflow-azure.mdc` | Azure workflow | ✅ Yes |
| `.cursor/rules/deployment-workflow.mdc` | Deployment process | ✅ Yes |

### Documentation Files

| File | Purpose |
|------|---------|
| `ARCHITECTURE.md` | System architecture (database-first) |
| `TESTING-CHECKLIST.md` | Mandatory testing requirements |
| `FIX-COMPLETE.md` | Recent fixes and lessons |
| `SYSTEM-CONFIGURATION-AUDIT.md` | This file |

---

## 🔵 Backup Systems

### Automated Database Backup

**Script:** `server/scripts/backup-database.js`
**Usage:** `cd server && npm run backup`

**What it does:**
- Creates JSON backup of all critical tables
- Stores in `server/backups/` directory
- Filename format: `backup-YYYY-MM-DD.json`
- Automatically deletes backups older than 30 days

**Schedule:** Run daily (manual or automated)

**Verification:**
```bash
# Run backup
cd server && npm run backup

# Check backups exist
ls server/backups/

# View backup content
cat server/backups/backup-2026-01-28.json | head -50
```

---

## 🔵 Health Check System

**Script:** `scripts/system-health-check.cjs`
**Usage:** `npm run health-check`

**What it checks:**
- ✅ Database connection
- ✅ Database record counts
- ✅ Environment variables exist
- ✅ Git status (uncommitted changes)
- ✅ Recent commit history
- ✅ Last deployment status
- ✅ Production site availability
- ✅ Build configuration files

**Run:**
- Before starting work
- After making changes
- Before deploying
- When diagnosing issues

---

## 🔵 Deployment Pipeline

### Complete Flow

```
Local Changes
    ↓
Git Commit & Push
    ↓
GitHub Actions Triggered
    ↓
Build Frontend (Vite)
    ↓
Build Backend (TypeScript)
    ↓
Deploy to Azure Static Web Apps
    ↓
Deploy Backend Functions
    ↓
Update Environment Variables
    ↓
Production Live
    ↓
VERIFY IMMEDIATELY
```

**Time:** 2-5 minutes total

---

## 🔵 Emergency Procedures

### If Database Connection Fails

1. Check Azure PostgreSQL is running (Azure Portal)
2. Verify DATABASE_URL is correct (`server/.env`)
3. Check firewall rules (Azure Portal)
4. Test connection: `cd server && npm run prisma:studio`

### If Deployment Fails

1. Check GitHub Actions logs: `gh run list --limit 1`
2. Check build locally: `npm run build`
3. Fix errors, commit, push again
4. Monitor: `gh run watch`

### If Production is Down

1. Check Azure Static Web Apps status (Azure Portal)
2. Check deployment succeeded (GitHub Actions)
3. Hard refresh browser: `Ctrl+Shift+R`
4. Check DNS: `nslookup odcrm.bidlow.co.uk`
5. Contact Azure support if needed

### If Data is Missing

1. Check database: `cd server && npm run prisma:studio`
2. Check backup files: `ls server/backups/`
3. Restore from backup if needed
4. Check Azure database backups (Azure Portal)
5. Review git history for data operations

---

## 🔵 Security

### Secrets Management

**NEVER commit these files:**
- `.env.local`
- `server/.env`
- Any file containing passwords/keys

**Stored securely:**
- Local: `.env` files (gitignored)
- Azure: Environment variables (Portal)
- GitHub: Repository secrets

### Access Control

**Azure:**
- Portal access: User account
- Database: Admin credentials

**GitHub:**
- Personal access token
- Repository access: User account

**Production:**
- Authenticated via Microsoft OAuth
- Allowed emails in `VITE_AUTH_ALLOWED_EMAILS`

---

## 🔵 Monitoring

### What to Monitor

1. **GitHub Actions**: Every deployment
2. **Production Site**: After every deployment
3. **Database**: Daily health check
4. **Backups**: Weekly verification
5. **Error Logs**: Browser console (production)

### Tools

- GitHub Actions: https://github.com/gregvisser/ODCRM/actions
- Azure Portal: https://portal.azure.com
- Prisma Studio: `cd server && npm run prisma:studio`
- Health Check: `npm run health-check`

---

## ✅ Verification Checklist

Run this regularly:

```bash
# System health
npm run health-check

# Database backup
cd server && npm run backup

# Check deployments
gh run list --limit 5

# Test production
curl -I https://odcrm.bidlow.co.uk

# Check database
cd server && npm run prisma:studio
```

**All should be GREEN before making changes.**

---

## 📞 Support

**If you're stuck:**

1. Read the documentation (ARCHITECTURE.md, TESTING-CHECKLIST.md)
2. Run health check: `npm run health-check`
3. Check git history: `git log --oneline -10`
4. Check GitHub Actions: `gh run list`
5. Review this file for configuration details

**Never guess. Always verify.**

---

**Last Audit:** 2026-01-28
**Next Audit:** 2026-02-28 (monthly)
**Status:** ✅ All systems operational
