# Step 2: Update Render Environment Variables

## Go to Render

https://render.com/dashboard

1. Click your service: **odcrm-api**
2. Click **Environment** tab (left sidebar)
3. You'll see a list of environment variables

---

## Update These 3 Variables

### FRONTEND_URL

1. Find **FRONTEND_URL** in the list
2. Click the **Edit** button (pencil icon) next to it
3. Change the value to:
   ```
   https://odcrm.vercel.app
   ```
4. Click **Save** (checkmark icon)

### REDIRECT_URI

1. Find **REDIRECT_URI** in the list
2. Click the **Edit** button
3. Change the value to:
   ```
   https://odcrm-api.onrender.com/api/outlook/callback
   ```
4. Click **Save**

### EMAIL_TRACKING_DOMAIN

1. Find **EMAIL_TRACKING_DOMAIN** in the list
2. Click the **Edit** button
3. Change the value to:
   ```
   https://odcrm-api.onrender.com
   ```
4. Click **Save**

---

## After Saving

The service will automatically restart (takes ~30 seconds).

You'll see a message: "Service will restart with new environment variables"

---

## ✅ Done!

Once all 3 are updated and saved, proceed to Step 3 (Update Azure).
