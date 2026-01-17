# Step 3: Update Azure Redirect URI

## Go to Azure Portal

https://portal.azure.com

---

## Navigate to Your App

1. In the search bar at top, type: **App registrations**
2. Click **App registrations** in the results
3. Click your app: **OpensDoors CRM Production**

---

## Update Redirect URI

1. In the left sidebar, click **Authentication**
2. Under **Platform configurations** → **Web**, you'll see **Redirect URIs**
3. Find the existing redirect URI (might be localhost or old value)
4. Click **Edit** or **Add URI**
5. Update/Add:
   ```
   https://odcrm-api.onrender.com/api/outlook/callback
   ```
6. Click **Save** at the bottom of the page

---

## Verify

After saving, you should see:
- ✅ Redirect URI: `https://odcrm-api.onrender.com/api/outlook/callback`

---

## ✅ Done!

Azure is now configured. Proceed to test OAuth!
