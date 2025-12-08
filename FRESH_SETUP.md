# Fresh Setup - ODCRM to GitHub & Vercel

## Step 1: Publish to GitHub with GitHub Desktop

1. **Open GitHub Desktop**
   - Make sure you're signed in with your GitHub account

2. **Add Your Repository:**
   - Click **"File"** → **"Add Local Repository"**
   - OR click the **"+"** button → **"Add Existing Repository"**
   - Browse to: `c:\CodeProjects\Clients\Opensdoors\ODCRM`
   - Click **"Add Repository"**

3. **If GitHub Desktop says "This directory does not appear to be a Git repository":**
   - Click the **"create a repository"** link
   - **Name:** `ODCRM`
   - **Description:** (optional) "OpenDoors Marketing CRM"
   - **UNCHECK** "Initialize this repository with a README"
   - Click **"Create Repository"**

4. **Review Your Files:**
   - You should see all your files listed as changes
   - Make sure `.env` files are NOT shown (they should be ignored)

5. **Commit Your Files:**
   - At the bottom, enter commit message:
     ```
     Initial commit - ODCRM with Vercel deployment config
     ```
   - Click **"Commit to main"**

6. **Publish to GitHub:**
   - After committing, click **"Publish repository"** button
   - **Name:** `ODCRM` (should already be filled)
   - **Description:** (optional) "OpenDoors Marketing CRM"
   - **Privacy:** Check or uncheck "Keep this code private" (your choice)
   - Click **"Publish Repository"**

7. **Verify:**
   - You should see a success message
   - Click **"View on GitHub"** or visit: https://github.com/gregvisser/ODCRM
   - All your files should be there!

---

## Step 2: Deploy on Vercel

1. **Go to Vercel:**
   - Visit: https://vercel.com/dashboard
   - Sign in (or create account if needed)

2. **Create New Project:**
   - Click **"Add New Project"** button

3. **Import Repository:**
   - You should see `gregvisser/ODCRM` in the list
   - Click **"Import"** next to it

4. **Configure Project Settings:**
   
   **Framework Preset:**
   - Click the dropdown
   - Select **"Vite"** ⚠️ (IMPORTANT - don't use "Other")
   
   **Root Directory:**
   - Leave as `./` (default)
   
   **Build and Output Settings** (click to expand):
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
   - **Install Command:** `npm install` (or leave default)
   
   **Environment Variables** (click to expand - OPTIONAL, can add later):
   - You can add these now or later:
     - `VITE_AI_ABOUT_ENDPOINT` = `https://api.openai.com/v1/chat/completions`
     - `VITE_AI_ABOUT_API_KEY` = (your OpenAI API key - get from https://platform.openai.com/api-keys)
     - `VITE_AI_ABOUT_MODEL` = `gpt-4o-mini`
     - `VITE_CLEARBIT_API_KEY` = (optional - get from https://clearbit.com)

5. **Deploy:**
   - Click the **"Deploy"** button
   - Wait for the build to complete (usually 1-2 minutes)

6. **Success! 🎉**
   - Your app will be live at: `https://odcrm.vercel.app` (or similar)
   - You can add a custom domain later in project settings

---

## Troubleshooting

**If GitHub Desktop doesn't detect your repository:**
- Make sure you're selecting the `ODCRM` folder (the one with `package.json`)

**If Vercel deployment fails:**
- Make sure Framework is set to **"Vite"** (not "Other")
- Check that Build Command is `npm run build`
- Check that Output Directory is `dist`
- Verify `vercel.json` is in the root directory

**If you need to add environment variables later:**
- Go to Vercel Dashboard → Your Project → Settings → Environment Variables
- Add the variables
- Click "Redeploy" to apply changes

---

## Next Steps After Deployment

1. **Test your app** at the Vercel URL
2. **Add environment variables** if you have API keys
3. **Set up a custom domain** (optional) in Vercel project settings
4. **Monitor deployments** in the Vercel dashboard
