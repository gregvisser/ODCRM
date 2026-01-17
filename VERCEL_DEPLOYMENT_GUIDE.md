# Vercel Frontend Deployment Guide

## Quick Steps

### Step 1: Sign Up at Vercel

1. Go to https://vercel.com
2. Click **"Sign Up"**
3. **Recommended**: Sign up with GitHub (easiest for connecting repository)
4. Complete email verification if needed

---

### Step 2: Import Project

1. Click **"Add New Project"** or **"Import Project"**
2. You'll see a list of your GitHub repositories
3. Find **"gregvisser/ODCRM"** in the list
4. Click **"Import"** next to it

---

### Step 3: Configure Project Settings

**IMPORTANT - Configure exactly as shown:**

#### Project Name
- Leave as default or enter: `odcrm`

#### Framework Preset
- Select: **"Vite"** (critical!)
- **NOT** "Other" or "React"

#### Root Directory
- Leave **BLANK** (do not enter `./` or anything)
- If there's text, delete it

#### Build Settings
These should auto-detect, but verify:
- **Build Command**: `npm run build`
- **Output Directory**: `dist`
- **Install Command**: `npm install`

---

### Step 4: Add Environment Variable

**Add this environment variable:**

- **Key**: `VITE_API_URL`
- **Value**: `https://odcrm-api.onrender.com`
- **Environment**: Select **Production** (and **Preview** if you want)

To add:
1. Click **"Environment Variables"** section (expand if collapsed)
2. Click **"Add Environment Variable"** or the input field
3. Enter key: `VITE_API_URL`
4. Enter value: `https://odcrm-api.onrender.com`
5. Click checkboxes for Production (and Preview)

---

### Step 5: Deploy

1. Click the big **"Deploy"** button at the bottom
2. Wait 1-3 minutes for build to complete
3. Watch the build logs in real-time

---

### Step 6: Verify Deployment

After deployment completes:

1. You'll see a success page with your URL
2. Note your Vercel URL: `https://odcrm-xxx.vercel.app` (or similar)
3. Click the URL to visit your deployed CRM
4. The app should load!

---

### Step 7: Test the Frontend

1. Visit your Vercel URL
2. Open browser console (F12)
3. Check for errors
4. Try navigating to different tabs
5. Check that Marketing tab loads

---

## Common Issues

### Build Fails
- Check Framework is set to **"Vite"** (not "Other")
- Verify Build Command is `npm run build`
- Verify Output Directory is `dist`
- Check build logs for specific errors

### App Loads But Can't Connect to API
- Verify `VITE_API_URL` is set correctly
- Check browser console for CORS errors
- Verify Render backend `FRONTEND_URL` includes your Vercel URL

### Blank Page
- Check browser console for errors
- Verify build completed successfully
- Check that assets loaded (Network tab)

---

## After Deployment

### Update Render Environment Variables

Now that you have your Vercel URL, update in Render:

1. Go to Render dashboard → Your service → **Environment** tab
2. Update **FRONTEND_URL**:
   - Current: `http://localhost:5173`
   - New: `https://odcrm-xxx.vercel.app` (your actual Vercel URL)
3. Click **Save Changes**
4. Service will auto-restart

---

## Next Steps

1. ✅ Frontend deployed to Vercel
2. ⏭️ Set customer ID in browser localStorage
3. ⏭️ Configure custom domains (GoDaddy DNS)
4. ⏭️ Test all features

---

**Ready to deploy?** Follow the steps above!

Your GitHub repository is ready: https://github.com/gregvisser/ODCRM
