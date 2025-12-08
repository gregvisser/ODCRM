# OpenDoors Marketing CRM

A React + Vite + TypeScript CRM application for managing accounts, contacts, marketing leads, and user authorization.

## Features

- **Accounts Management**: Manage client accounts with AI-powered company information
- **Contacts Management**: Track contacts tied to each account
- **Marketing Leads**: Import and manage leads from Google Sheets
- **User Authorization**: Manage user accounts and permissions
- **Analytics Dashboard**: Kanban-style analytics for lead performance

## Tech stack

- Vite (React + TypeScript)
- Chakra UI for layout and components
- React Icons for sidebar visuals
- dnd-kit for drag-and-drop functionality

## Getting started

### Local Development

```bash
npm install
npm run dev
# open http://localhost:5173 in your browser
```

The dev server supports hot reload so you can verify UX updates immediately during each prompt.

### Environment Variables

Create a `.env` file in the root directory with the following variables (see `.env.example`):

```env
VITE_AI_ABOUT_ENDPOINT=https://api.openai.com/v1/chat/completions
VITE_AI_ABOUT_API_KEY=your_ai_api_key_here
VITE_AI_ABOUT_MODEL=gpt-4o-mini
VITE_CLEARBIT_API_KEY=your_clearbit_api_key_here
```

## Deployment to Vercel

### Prerequisites
- Vercel account (free tier available)
- GitHub/GitLab/Bitbucket repository (optional, but recommended)

### Steps

1. **Build the application locally (optional test)**
   ```bash
   npm run build
   ```

2. **Deploy to Vercel**

   **Option A: Via Vercel Dashboard (Easiest)**
   - Go to [vercel.com](https://vercel.com)
   - Click "Add New Project"
   - Import your Git repository OR drag and drop the project folder
   - Vercel will auto-detect Vite configuration

   **Option B: Via Vercel CLI**
   ```bash
   npm i -g vercel
   vercel login
   vercel
   ```

3. **Configure Environment Variables**
   - In Vercel dashboard, go to Project Settings → Environment Variables
   - Add all variables from `.env.example`:
     - `VITE_AI_ABOUT_ENDPOINT`
     - `VITE_AI_ABOUT_API_KEY`
     - `VITE_AI_ABOUT_MODEL` (optional)
     - `VITE_AI_BACKUP_ENDPOINT` (optional)
     - `VITE_AI_BACKUP_API_KEY` (optional)
     - `VITE_CLEARBIT_API_KEY` (optional)

4. **Redeploy**
   - After adding environment variables, trigger a new deployment
   - Vercel will automatically rebuild with the new variables

5. **Custom Domain (Optional)**
   - In Vercel dashboard, go to Project Settings → Domains
   - Add your custom domain
   - Follow DNS configuration instructions

### Build Configuration

The project includes `vercel.json` with optimal settings for Vite:
- Build command: `npm run build`
- Output directory: `dist`
- Framework: `vite`
- SPA routing support configured

## Production Build

```bash
npm run build
```

The production build will be in the `dist/` folder, ready for deployment.

## Notes

- All data is stored in browser localStorage (no backend database required)
- Google Sheets must be publicly accessible for marketing leads feature
- AI features require valid API keys to function
- The app works without AI keys, but AI-powered features will be disabled
