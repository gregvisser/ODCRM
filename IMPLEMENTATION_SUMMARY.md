# Email Campaigns Module - Implementation Summary

## Overview

A complete email campaigns module has been implemented for the OpensDoors CRM, enabling multi-tenant cold email campaign management with Outlook/Microsoft 365 integration.

## What Was Built

### 1. Database Schema (Prisma)

**Models Created:**
- `Customer` - Multi-tenant customer entity
- `Contact` - Prospect contacts (imported from Cognism)
- `EmailIdentity` - Outlook email accounts connected via OAuth
- `EmailCampaign` - Campaign configuration and status
- `EmailCampaignTemplate` - Email templates for step 1 and step 2
- `EmailCampaignProspect` - Links contacts to campaigns with tracking
- `EmailEvent` - Event log (sent, opened, bounced, replied, etc.)
- `EmailMessageMetadata` - Stores provider message IDs for reply matching

**Key Features:**
- Full multi-tenancy with `customerId` scoping
- Comprehensive indexes for performance
- Cascade deletes for data integrity
- Enums for status tracking

### 2. Backend API Server (Express/Node.js)

**Routes Implemented:**

#### Campaigns (`/api/campaigns`)
- `GET /` - List all campaigns with metrics
- `POST /` - Create new campaign
- `GET /:id` - Get campaign details
- `PATCH /:id` - Update campaign
- `POST /:id/start` - Start campaign (schedules emails)
- `POST /:id/pause` - Pause campaign
- `POST /:id/complete` - Complete campaign
- `POST /:id/templates` - Save email templates
- `POST /:id/prospects` - Attach contacts to campaign

#### Outlook OAuth (`/api/outlook`)
- `GET /auth` - Initiate OAuth flow
- `GET /callback` - Handle OAuth callback, store tokens
- `GET /identities` - List connected email accounts
- `PATCH /identities/:id` - Update identity settings
- `DELETE /identities/:id` - Disconnect account

#### Tracking (`/api/email`)
- `GET /open?cpid=...` - Email open tracking pixel
- `GET /unsubscribe?cpid=...&token=...` - Unsubscribe page

**Services:**
- `outlookEmailService.ts` - Microsoft Graph integration
  - Send emails with custom headers
  - Token refresh logic
  - Fetch inbox messages for reply detection
- `templateRenderer.ts` - Template variable replacement
  - Support for `{{firstName}}`, `{{lastName}}`, `{{companyName}}`, `{{jobTitle}}`
  - HTML escaping for security
  - Tracking pixel and unsubscribe link injection

**Background Workers:**
- `emailScheduler.ts` - Runs every minute
  - Finds due emails (step 1 and step 2)
  - Respects send windows and daily limits
  - Renders templates and sends emails
  - Handles bounces and errors
- `replyDetection.ts` - Runs every 5 minutes
  - Polls inbox for each active identity
  - Matches replies using 3 methods:
    1. Custom header (`X-CRM-CampaignProspect-Id`)
    2. Thread/conversation ID matching
    3. Email + subject fallback
  - Updates prospect status
  - Cancels future scheduled sends for replied prospects

### 3. Frontend Components (React/TypeScript)

**Components Created:**
- `EmailCampaignsTab.tsx` - Main campaigns list page
  - Table view with metrics
  - Start/pause/complete actions
  - Campaign status badges
  - Reply rate, open rate, bounce rate display
- `CampaignWizard.tsx` - 4-step campaign creation wizard
  - Step 1: Basic info (name, sender, send window, follow-up delay)
  - Step 2: Email templates (initial + follow-up)
  - Step 3: Attach prospects (placeholder for Cognism integration)
  - Step 4: Review & launch
- `CampaignDetail.tsx` - Campaign detail view
  - Overview tab with statistics
  - Prospects tab with status and activity
  - Templates tab (placeholder)
- `EmailSettingsTab.tsx` - Email account management
  - Connect Outlook account button
  - List connected accounts
  - Edit daily send limits
  - Disconnect accounts
- `api.ts` - API utility for backend calls

**Navigation Integration:**
- Added "Email campaigns" tab under "OpensDoors Marketing" section
- Integrated with existing sidebar navigation system

### 4. Outlook OAuth Integration

**Flow:**
1. User clicks "Connect Outlook Account"
2. Redirected to Microsoft OAuth consent
3. User grants permissions (Mail.Send, Mail.Read)
4. Callback receives authorization code
5. Backend exchanges code for access/refresh tokens
6. Stores tokens in `EmailIdentity` record

**Token Management:**
- Automatic refresh before expiry (5 min buffer)
- Refresh token stored securely
- Token expiry tracked per identity

### 5. Email Sending & Tracking

**Sending Process:**
1. Campaign started → prospects scheduled
2. Background worker finds due emails
3. Templates rendered with contact variables
4. Tracking pixel and unsubscribe link injected
5. Email sent via Microsoft Graph with custom header
6. Message metadata stored for reply matching
7. Events logged for analytics

**Tracking:**
- **Opens**: Transparent 1x1 PNG pixel
- **Replies**: Inbox monitoring with intelligent matching
- **Unsubscribes**: Dedicated unsubscribe page
- **Bounces**: Detected from send failures

### 6. Reply Detection

**Matching Algorithm:**
1. **Primary**: Check for `X-CRM-CampaignProspect-Id` header
2. **Secondary**: Match via conversation/thread ID
3. **Fallback**: Match by email address + subject ("Re:" prefix)

**When Reply Detected:**
- Update prospect status to "replied"
- Increment reply count
- Store reply snippet
- Cancel future scheduled emails
- Log event with metadata

## File Structure

```
ODCRM/
├── prisma/
│   └── schema.prisma              # Database schema
├── server/
│   ├── src/
│   │   ├── index.ts              # Server entry point
│   │   ├── routes/               # API routes
│   │   │   ├── campaigns.ts
│   │   │   ├── outlook.ts
│   │   │   └── tracking.ts
│   │   ├── services/             # Business logic
│   │   │   ├── outlookEmailService.ts
│   │   │   └── templateRenderer.ts
│   │   ├── workers/              # Background jobs
│   │   │   ├── emailScheduler.ts
│   │   │   └── replyDetection.ts
│   │   └── lib/
│   │       └── prisma.ts
│   ├── package.json
│   ├── tsconfig.json
│   └── README.md
├── src/
│   ├── components/
│   │   ├── EmailCampaignsTab.tsx
│   │   ├── CampaignWizard.tsx
│   │   ├── CampaignDetail.tsx
│   │   └── EmailSettingsTab.tsx
│   ├── utils/
│   │   └── api.ts
│   └── App.tsx                   # Updated with new tab
├── EMAIL_CAMPAIGNS_SETUP.md      # Setup guide
├── IMPLEMENTATION_SUMMARY.md      # This file
└── README.md                      # Updated main README
```

## Key Features

✅ **Multi-tenant architecture** - All data scoped by customerId  
✅ **Outlook/Microsoft 365 integration** - No third-party email service  
✅ **Automated email sequences** - 2-step campaigns with configurable delays  
✅ **Smart reply detection** - Multiple matching methods  
✅ **Performance tracking** - Opens, replies, bounces, unsubscribes  
✅ **Send window management** - Respect business hours  
✅ **Daily send limits** - Prevent spam classification  
✅ **Template variables** - Personalized emails  
✅ **Unsubscribe handling** - Compliance-friendly  
✅ **Background workers** - Automated sending and monitoring  

## Security & Compliance

- Multi-tenant data isolation enforced at database level
- OAuth tokens stored securely
- Automatic token refresh
- SPF/DKIM/DMARC recommendations in UI
- Unsubscribe mechanism for compliance
- Daily send limits to prevent spam

## Next Steps / Future Enhancements

1. **Contact Import Integration**
   - Connect Cognism API for contact import
   - CSV upload functionality
   - Contact validation and deduplication

2. **Advanced Features**
   - A/B testing for email templates
   - Scheduling improvements (timezone support)
   - Email preview in UI
   - Advanced analytics and reporting
   - Email domain reputation monitoring

3. **Production Readiness**
   - Authentication/authorization system (JWT)
   - Rate limiting on API endpoints
   - Error monitoring and alerting
   - Database backups
   - Horizontal scaling for workers

## Testing Checklist

- [ ] Create campaign with templates
- [ ] Connect Outlook account via OAuth
- [ ] Start campaign and verify emails sent
- [ ] Test reply detection
- [ ] Verify open tracking pixel works
- [ ] Test unsubscribe flow
- [ ] Check daily send limits enforced
- [ ] Verify send windows respected
- [ ] Test multi-tenant isolation

## Documentation

- `EMAIL_CAMPAIGNS_SETUP.md` - Complete setup guide
- `server/README.md` - Backend API documentation
- `README.md` - Updated with email campaigns info

## Dependencies Added

**Backend:**
- `@microsoft/microsoft-graph-client` - Microsoft Graph API
- `@prisma/client` - Database ORM
- `express` - Web framework
- `node-cron` - Background job scheduling
- `zod` - Schema validation
- `cors` - CORS middleware

**Frontend:**
- No new dependencies (uses existing Chakra UI)

All code follows TypeScript best practices with proper type safety and error handling.
