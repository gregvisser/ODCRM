# Deployment Quick Start Checklist

This is a quick reference checklist for deploying ODCRM to production. For detailed steps, see `PRODUCTION_DEPLOYMENT_STEPS.md`.

## Pre-Deployment: Code Changes ✅

- [x] Environment files created (see `DEPLOYMENT_ENV_SETUP.md`)
- [x] Background workers re-enabled in `server/src/index.ts`
- [x] All code changes complete

## Phase 1: Database (Neon) - ~30 minutes

- [ ] Sign up at https://neon.tech
- [ ] Create project: "ODCRM Production"
- [ ] Copy connection string
- [ ] Update `DATABASE_URL` in `server/.env`
- [ ] Run: `cd server && npx prisma migrate deploy`
- [ ] Verify tables created

## Phase 2: Azure App - ~30 minutes

- [ ] Go to https://portal.azure.com
- [ ] Create app registration: "OpensDoors CRM Production"
- [ ] Add redirect URI: `https://api.yourdomain.com/api/outlook/callback`
- [ ] Create client secret (copy immediately!)
- [ ] Add API permissions: Mail.Send, Mail.Read, User.Read, offline_access
- [ ] Grant admin consent
- [ ] Update `MICROSOFT_CLIENT_ID` and `MICROSOFT_CLIENT_SECRET` in `server/.env`

## Phase 3: Backend (Render) - ~45 minutes

- [ ] Sign up at https://render.com
- [ ] Create Web Service: "odcrm-api"
- [ ] Root Directory: `server`
- [ ] Build Command: `npm install && npx prisma generate && npm run build`
- [ ] Start Command: `npm start`
- [ ] Plan: Starter ($7/month)
- [ ] Add all environment variables from `server/.env`
- [ ] Deploy and verify: `https://odcrm-api.onrender.com/health`
- [ ] Add custom domain: `api.yourdomain.com` (optional, can do after DNS)

## Phase 4: Frontend (Vercel) - ~30 minutes

- [ ] Sign up at https://vercel.com
- [ ] Import GitHub repository
- [ ] Framework: Vite
- [ ] Add environment variable: `VITE_API_URL=https://api.yourdomain.com`
- [ ] Deploy and verify
- [ ] Add custom domain: `crm.yourdomain.com` (optional, can do after DNS)

## Phase 5: DNS (GoDaddy) - ~30 minutes + propagation

- [ ] Log into GoDaddy DNS management
- [ ] Add CNAME: `crm` → Vercel CNAME value
- [ ] Add CNAME: `api` → Render CNAME value (or `odcrm-api.onrender.com`)
- [ ] Update Azure redirect URI if needed
- [ ] Wait 10-60 minutes for DNS propagation
- [ ] Verify SSL certificates active

## Phase 6: Production Customer - ~10 minutes

- [ ] Open Prisma Studio: `cd server && DATABASE_URL="<neon-string>" npx prisma studio`
- [ ] Create Customer record: id=`prod-customer-1`, name=`OpensDoors`
- [ ] Set in browser: `localStorage.setItem('currentCustomerId', 'prod-customer-1')`

## Phase 7: Testing - ~60 minutes

- [ ] Test all 12 Marketing sub-tabs load
- [ ] Test Outlook OAuth flow
- [ ] Create test email campaign
- [ ] Verify emails send
- [ ] Test reply detection
- [ ] Check Render logs for workers running
- [ ] Verify 73 leads preserved (if applicable)

## Success Criteria

✅ `https://crm.yourdomain.com` loads without errors  
✅ `https://api.yourdomain.com/health` returns `{"status":"ok"}`  
✅ All Marketing sub-tabs functional  
✅ Outlook OAuth works end-to-end  
✅ Background workers running (check Render logs)  
✅ Email campaigns send successfully  

## Estimated Total Time

- **Code setup**: ✅ Complete (already done)
- **Infrastructure setup**: 3-4 hours
- **Testing**: 1-2 hours
- **Total**: 4-6 hours over 1-2 days

## Help & Support

- **Detailed steps**: See `PRODUCTION_DEPLOYMENT_STEPS.md`
- **Environment setup**: See `DEPLOYMENT_ENV_SETUP.md`
- **Troubleshooting**: See `PRODUCTION_DEPLOYMENT_STEPS.md` → Troubleshooting section

---

**Ready to deploy?** Start with Phase 1 (Database) in `PRODUCTION_DEPLOYMENT_STEPS.md`!
