# GitHub Desktop Setup Guide for ODCRM

## Step 1: Install GitHub Desktop (if not already installed)

1. Go to: **https://desktop.github.com/**
2. Click **"Download for Windows"**
3. Run the installer
4. Sign in with your GitHub account (gregvisser)

---

## Step 2: Add Your Repository to GitHub Desktop

1. **Open GitHub Desktop**

2. **Add the repository:**
   - Click **"File"** → **"Add Local Repository"**
   - OR click the **"+"** button in the top left → **"Add Existing Repository"**
   
3. **Browse to your project:**
   - Click **"Choose..."**
   - Navigate to: `c:\CodeProjects\Clients\Opensdoors\ODCRM`
   - Click **"Select Folder"**

4. **If GitHub Desktop says "This directory does not appear to be a Git repository":**
   - Click **"create a repository"** link
   - Name: `ODCRM`
   - Description: (optional) "OpenDoors Marketing CRM"
   - **UNCHECK** "Initialize this repository with a README" (you already have one)
   - Click **"Create Repository"**

---

## Step 3: Review Changes

1. You should see all your files listed as changes
2. Review the files (make sure `.env` files are NOT included - they should be ignored)
3. In the bottom left, enter a commit message:
   ```
   Initial commit - ODCRM with Vercel deployment config
   ```

---

## Step 4: Commit the Files

1. Click **"Commit to main"** button at the bottom

---

## Step 5: Publish to GitHub

1. After committing, you'll see a **"Publish repository"** button
2. Click **"Publish repository"**
3. **Repository settings:**
   - Name: `ODCRM` (should already be filled)
   - Description: (optional) "OpenDoors Marketing CRM"
   - **UNCHECK** "Keep this code private" (unless you want it private)
4. Click **"Publish Repository"**

---

## Step 6: Verify on GitHub

1. GitHub Desktop will show a success message
2. Click **"View on GitHub"** or go to: **https://github.com/gregvisser/ODCRM**
3. You should see all your files there!

---

## Step 7: Deploy on Vercel

1. Go to: **https://vercel.com/dashboard**
2. Click **"Add New Project"** (or select your existing ODCRM project)
3. **Import repository:**
   - Select **`gregvisser/ODCRM`**
   - Click **"Import"**

4. **Configure Project:**
   - **Framework Preset:** Select **"Vite"** (IMPORTANT - don't use "Other")
   - **Root Directory:** `./` (leave as default)
   - Click **"Build and Output Settings"** to expand:
     - **Build Command:** `npm run build`
     - **Output Directory:** `dist`
     - **Install Command:** `npm install` (or leave default)

5. **Environment Variables** (optional - can add later):
   - Click **"Environment Variables"** to expand
   - Add these if you have them:
     - `VITE_AI_ABOUT_ENDPOINT` = `https://api.openai.com/v1/chat/completions`
     - `VITE_AI_ABOUT_API_KEY` = (your OpenAI API key)
     - `VITE_AI_ABOUT_MODEL` = `gpt-4o-mini`
     - `VITE_CLEARBIT_API_KEY` = (optional)

6. Click **"Deploy"**

---

## Troubleshooting

**If GitHub Desktop doesn't detect your repository:**
- Make sure you're selecting the `ODCRM` folder (not a parent folder)
- The folder should contain `package.json` and `vercel.json`

**If you get authentication errors:**
- Make sure you're signed into GitHub Desktop with your account
- You may need to authorize GitHub Desktop in your browser

**If Vercel deployment fails:**
- Make sure Framework is set to **"Vite"** (not "Other")
- Check that `vercel.json` is in the root directory
- Verify Build Command is `npm run build`
- Verify Output Directory is `dist`

---

## Success! 🎉

Once deployed, your app will be available at:
- `https://odcrm.vercel.app` (or similar)
- You can add a custom domain in Vercel project settings
