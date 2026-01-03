# Email Campaigns Module - Setup Guide

This document provides setup instructions for the Email Campaigns module in the OpensDoors CRM.

## Architecture Overview

The Email Campaigns module consists of:

1. **Backend Server** (Express/Node.js)
   - API endpoints for campaign management
   - Outlook/Microsoft Graph integration
   - Background workers for email sending and reply detection

2. **Frontend** (React/Vite)
   - Campaign list and management UI
   - Campaign wizard for creating campaigns
   - Campaign detail view with metrics

3. **Database** (PostgreSQL + Prisma)
   - Multi-tenant data models for campaigns, contacts, and email identities

## Prerequisites

1. **Node.js** 18+ and npm
2. **PostgreSQL** database
3. **Microsoft Azure App Registration** for Outlook OAuth

## Step 1: Database Setup

1. Create a PostgreSQL database:
```bash
createdb odcrm
```

2. Set the database URL in `server/.env`:
```env
DATABASE_URL="postgresql://user:password@localhost:5432/odcrm?schema=public"
```

3. Generate Prisma client and run migrations:
```bash
cd server
npm install
npx prisma generate
npx prisma migrate dev --name init
```

## Step 2: Microsoft Azure App Registration

1. Go to [Azure Portal](https://portal.azure.com)
2. Navigate to **Azure Active Directory** > **App registrations**
3. Click **New registration**
4. Configure:
   - **Name**: OpensDoors CRM
   - **Redirect URI**: `http://localhost:3001/api/outlook/callback` (for development)
   - **Supported account types**: Accounts in any organizational directory
5. After creation, note the **Application (client) ID**
6. Go to **Certificates & secrets** > **New client secret**
7. Copy the secret value immediately (you won't see it again)
8. Go to **API permissions** > **Add a permission** > **Microsoft Graph** > **Delegated permissions**
9. Add:
   - `Mail.Send`
   - `Mail.Read`
   - `offline_access`
   - `User.Read`
10. Click **Grant admin consent**

## Step 3: Backend Server Setup

1. Navigate to server directory:
```bash
cd server
```

2. Install dependencies:
```bash
npm install
```

3. Create `server/.env` file:
```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/odcrm?schema=public"

# Server
PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:5173

# Microsoft Graph / Outlook OAuth
MICROSOFT_CLIENT_ID=your-client-id-here
MICROSOFT_CLIENT_SECRET=your-client-secret-here
MICROSOFT_TENANT_ID=common
REDIRECT_URI=http://localhost:3001/api/outlook/callback

# Email Tracking
EMAIL_TRACKING_DOMAIN=http://localhost:3001
```

4. Start the server:
```bash
npm run dev
```

The server will start on `http://localhost:3001` and automatically run:
- Email scheduler (every minute)
- Reply detection worker (every 5 minutes)

## Step 4: Frontend Setup

1. Navigate to project root:
```bash
cd ..
```

2. Create `.env` file (if not exists):
```env
VITE_API_URL=http://localhost:3001
```

3. Install dependencies (if not already):
```bash
npm install
```

4. Start the frontend:
```bash
npm run dev
```

## Step 5: Initial Setup

1. **Set Customer Context**
   - The system requires a `customerId` for multi-tenancy
   - In development, set `currentCustomerId` in localStorage:
   ```javascript
   localStorage.setItem('currentCustomerId', 'your-customer-id')
   ```
   - Or create a Customer record in the database first

2. **Connect Outlook Account**
   - Navigate to Settings > Email Accounts (or implement the settings page)
   - Click "Connect Outlook Account"
   - Complete OAuth flow
   - Email account will be stored and ready for campaigns

3. **Import Contacts**
   - Contacts need to exist in the database with `customerId`
   - Use the Contacts tab or import via API

## Usage

### Creating a Campaign

1. Navigate to **Marketing** > **Email campaigns**
2. Click **New Campaign**
3. Fill in:
   - Campaign name and description
   - Select sender email (must be connected Outlook account)
   - Set send window (hours of day)
   - Set follow-up delay (days)
4. Configure email templates (Step 1 and Step 2)
   - Use variables: `{{firstName}}`, `{{lastName}}`, `{{companyName}}`, `{{jobTitle}}`
5. Attach prospects (contacts)
6. Save as draft or start immediately

### Campaign Management

- **Start**: Begins sending emails according to schedule
- **Pause**: Stops sending new emails (resumable)
- **Complete**: Ends campaign permanently

### Tracking & Metrics

- **Opens**: Tracked via transparent pixel
- **Replies**: Detected via inbox monitoring (runs every 5 minutes)
- **Unsubscribes**: Handled via unsubscribe link
- **Bounces**: Detected from send failures

### Reply Detection

The system detects replies using three methods (in order):

1. **Custom Header** (most reliable): `X-CRM-CampaignProspect-Id`
2. **Thread/Conversation ID**: Links via Microsoft Graph conversation ID
3. **Email + Subject Matching**: Fallback for edge cases

## API Endpoints

### Campaigns
- `GET /api/campaigns` - List all campaigns
- `POST /api/campaigns` - Create campaign
- `GET /api/campaigns/:id` - Get campaign details
- `PATCH /api/campaigns/:id` - Update campaign
- `POST /api/campaigns/:id/start` - Start campaign
- `POST /api/campaigns/:id/pause` - Pause campaign
- `POST /api/campaigns/:id/complete` - Complete campaign
- `POST /api/campaigns/:id/templates` - Save templates
- `POST /api/campaigns/:id/prospects` - Attach prospects

### Outlook
- `GET /api/outlook/auth` - Initiate OAuth
- `GET /api/outlook/callback` - OAuth callback
- `GET /api/outlook/identities` - List email identities
- `PATCH /api/outlook/identities/:id` - Update identity
- `DELETE /api/outlook/identities/:id` - Disconnect identity

### Tracking
- `GET /api/email/open?cpid=...` - Open tracking pixel
- `GET /unsubscribe?cpid=...&token=...` - Unsubscribe page

## Background Workers

### Email Scheduler
- Runs every minute
- Processes scheduled step 1 and step 2 emails
- Respects send windows and daily limits
- Handles template rendering and tracking injection

### Reply Detection Worker
- Runs every 5 minutes
- Polls inbox for each active email identity
- Matches replies to campaign prospects
- Updates status and cancels future sends

## Security Considerations

1. **Multi-tenancy**: All queries filter by `customerId` - never expose cross-customer data
2. **Token Storage**: Access tokens stored encrypted in database
3. **Token Refresh**: Automatic refresh before expiry
4. **Rate Limiting**: Daily send limits per identity prevent spam

## Troubleshooting

### Emails Not Sending
- Check email identity is active
- Verify daily send limit not exceeded
- Check send window is current
- Review server logs for errors

### Replies Not Detected
- Verify OAuth tokens are valid
- Check reply detection worker is running
- Review inbox permissions in Azure
- Check custom headers are preserved

### OAuth Not Working
- Verify redirect URI matches Azure app registration
- Check client ID and secret in `.env`
- Ensure admin consent granted for permissions

## Production Deployment

1. Update `REDIRECT_URI` to production URL
2. Use environment variables for all secrets
3. Set up proper database backups
4. Configure email tracking domain
5. Set up monitoring for background workers
6. Use HTTPS for all endpoints
7. Implement proper authentication (JWT/sessions)

## Support

For issues or questions, check:
- Server logs in console
- Browser network tab for API errors
- Database for data integrity
- Azure App Registration for token issues
