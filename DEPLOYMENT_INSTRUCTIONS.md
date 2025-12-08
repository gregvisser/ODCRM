# Deploy ODCRM to Vercel - Instructions

## Option 1: Use GitHub Desktop (Easiest - Recommended)

1. **Download GitHub Desktop** (if not installed):
   - Go to: https://desktop.github.com/
   - Install and sign in with your GitHub account

2. **Add the repository:**
   - Open GitHub Desktop
   - Click "File" → "Add Local Repository"
   - Browse to: `c:\CodeProjects\Clients\Opensdoors\ODCRM`
   - Click "Add Repository"

3. **Publish to GitHub:**
   - Click "Publish repository" button
   - Repository name: `ODCRM`
   - Make sure "Keep this code private" is unchecked (or checked if you want it private)
   - Click "Publish Repository"

4. **Deploy on Vercel:**
   - Go to https://vercel.com/dashboard
   - Click "Add New Project"
   - Import `gregvisser/ODCRM`
   - Framework: Select **"Vite"**
   - Build Command: `npm run build`
   - Output Directory: `dist`
   - Click "Deploy"

---

## Option 2: Install Git and Use Command Line

1. **Install Git:**
   - Download from: https://git-scm.com/download/win
   - During installation, make sure to select "Add Git to PATH"

2. **After installation, restart your terminal and run:**
   ```powershell
   cd c:\CodeProjects\Clients\Opensdoors\ODCRM
   .\push-to-github.ps1
   ```

---

## Option 3: Upload Files via GitHub Web Interface

1. Go to: https://github.com/gregvisser/ODCRM
2. Click "uploading an existing file"
3. Drag and drop all files from `c:\CodeProjects\Clients\Opensdoors\ODCRM` (except `node_modules`, `.git`, `dist`)
4. Commit the files
5. Then deploy on Vercel as described in Option 1, step 4

---

## After Code is on GitHub

Once your code is on GitHub, deploy on Vercel:

1. Go to https://vercel.com/dashboard
2. Click "Add New Project" or select your existing project
3. Import `gregvisser/ODCRM`
4. **Important Settings:**
   - Framework Preset: **Vite** (not "Other")
   - Build Command: `npm run build`
   - Output Directory: `dist`
   - Root Directory: `./`
5. Click "Deploy"

## Environment Variables (Optional - Can add later)

After deployment, go to Project Settings → Environment Variables and add:
- `VITE_AI_ABOUT_ENDPOINT` = `https://api.openai.com/v1/chat/completions`
- `VITE_AI_ABOUT_API_KEY` = (your OpenAI API key)
- `VITE_AI_ABOUT_MODEL` = `gpt-4o-mini`
- `VITE_CLEARBIT_API_KEY` = (optional, your Clearbit key)
