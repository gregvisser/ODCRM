# Render Deployment Checklist

## ✅ Deployment In Progress

Backend is deploying to Render. Follow this checklist:

---

## Step 1: Wait for Deployment (2-5 minutes)

Watch the Render dashboard for:
- ✅ Build starts
- ✅ Dependencies install
- ✅ Prisma generates
- ✅ TypeScript compiles
- ✅ Service starts
- ✅ Health check passes

---

## Step 2: Verify Deployment Success

### Check Render Dashboard:
- Status should be **"Live"** (green)
- Check **Logs** tab for:
  ```
  🚀 Server running on port 3001
  📧 Starting email scheduler...
  ✅ Email scheduler started (runs every minute)
  📬 Starting reply detection worker...
  ✅ Reply detection worker started (runs every 5 minutes)
  ```

### Test Health Endpoint:
Visit your Render URL + `/health`:
- Example: `https://odcrm-api.onrender.com/health`
- Should return: `{"status":"ok","timestamp":"..."}`

---

## Step 3: Update Environment Variables (Important!)

After deployment, you'll get a Render URL like:
- `https://odcrm-api.onrender.com`

**Update these 3 environment variables in Render:**

1. **REDIRECT_URI**:
   ```
   https://odcrm-api.onrender.com/api/outlook/callback
   ```

2. **EMAIL_TRACKING_DOMAIN**:
   ```
   https://odcrm-api.onrender.com
   ```

3. **FRONTEND_URL** (update after frontend deploys):
   ```
   https://odcrm.vercel.app
   ```
   Or use your custom domain if configured

**To Update in Render:**
1. Go to your service → **Environment** tab
2. Click on each variable → **Edit**
3. Update the value
4. Click **Save Changes**
5. Service will automatically restart

---

## Step 4: Update Azure Redirect URI

**Go to Azure Portal:**
1. Azure Active Directory → App registrations
2. Select: **OpensDoors CRM Production**
3. Go to **Authentication**
4. Update **Redirect URI** to:
   ```
   https://odcrm-api.onrender.com/api/outlook/callback
   ```
5. Click **Save**

---

## Step 5: Test Backend API

### Test Health Endpoint:
```bash
curl https://odcrm-api.onrender.com/health
```

Should return:
```json
{"status":"ok","timestamp":"2026-01-16T..."}
```

### Test API Endpoint:
```bash
curl https://odcrm-api.onrender.com/api/health
```

Should return:
```json
{"status":"ok","timestamp":"2026-01-16T..."}
```

---

## Common Issues & Solutions

### ❌ Build Fails
- **Check logs**: Look for error messages
- **Common causes**:
  - Missing environment variables
  - Prisma generate fails
  - TypeScript errors
  - Missing dependencies

### ❌ Service Won't Start
- **Check logs**: Look for startup errors
- **Common causes**:
  - Wrong PORT (should be 3001)
  - Database connection fails
  - Missing DATABASE_URL
  - Invalid Azure credentials

### ❌ Health Check Fails
- **Check logs**: Look for errors
- **Verify**: Service is running on correct port
- **Check**: All environment variables are set

### ❌ Background Workers Not Starting
- **Check logs**: Should see scheduler/worker messages
- **Verify**: Workers are enabled in `server/src/index.ts`
- **Check**: No errors in worker initialization

---

## ✅ Success Criteria

- [ ] Build completes successfully
- [ ] Service status is **"Live"**
- [ ] Health endpoint returns `{"status":"ok"}`
- [ ] Logs show workers starting
- [ ] No errors in logs
- [ ] Environment variables updated with Render URL
- [ ] Azure redirect URI updated

---

## Next Steps After Deployment

1. ✅ Verify backend is working
2. ⏭️ Deploy frontend to Vercel
3. ⏭️ Configure DNS (GoDaddy)
4. ⏭️ Update environment variables with custom domains
5. ⏭️ Create production customer
6. ⏭️ Test all features

---

**Status**: Deployment in progress ⏳

Once deployment completes, let me know and I'll help verify everything is working!
