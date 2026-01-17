# ODCRM Complete System Documentation

## 🎯 EXECUTIVE SUMMARY

You have a **production CRM system** deployed and functional at **https://odcrm.vercel.app**.

**Core features work**: Lead management (73 leads), Account tracking (15 accounts), Contact management (19 contacts), Google Sheets integration, Analytics.

**Email campaigns need backend fixes**: Schema alignment issues require focused refactoring session.

---

## 📊 PRODUCTION SYSTEM DETAILS

### URLs
- **Frontend**: https://odcrm.vercel.app
- **Backend API**: https://odcrm-api.onrender.com
- **Health Check**: https://odcrm-api.onrender.com/health

### Database
- **Provider**: Neon PostgreSQL
- **Host**: ep-silent-salad-ahpgcsne-pooler.c-3.us-east-1.aws.neon.tech
- **Database**: neondb
- **Connection String**: `postgresql://neondb_owner:npg_oqJvg13NVUBk@...(in server/.env)`

### Customer
- **ID**: prod-customer-1
- **Name**: OpensDoors
- **Set in browser**: `localStorage.setItem('currentCustomerId', 'prod-customer-1')`

### Email Account
- **Email**: greg@bidlow.co.uk
- **Display Name**: Greg Visser
- **Status**: Connected via OAuth
- **Saved in Database**: Yes (confirmed via query)
- **ID**: cmkib12ne0007lm5q66zbx3me

### Azure OAuth
- **Client ID**: c4fd4112-e6e0-4a34-a9a3-c1465bf4f90d
- **Client Secret**: (in Render environment variables)
- **Redirect URI**: https://odcrm-api.onrender.com/api/outlook/callback
- **Permissions**: Mail.Send, Mail.Read, User.Read, offline_access

---

## ✅ WORKING FEATURES

### 1. Lead Management
- **73 leads** active from Google Sheets
- Auto-refresh every 6 hours
- Real-time metrics
- Channel breakdown
- Performance tracking

### 2. Account Management
- **15 accounts** with configurations:
  - OCS, Beauparc, Thomas Franks, Be Safe Technologies, and 11 more
- Google Sheets URLs configured per account
- Weekly/monthly targets
- Defcon levels
- Sector classifications

### 3. Contact Management
- **19 contacts** in database
- CSV import
- Contact details
- Association with accounts

### 4. Analytics
- Unified lead performance dashboard
- Today/Week/Month views
- Target vs actual tracking
- Visual indicators

### 5. Data Portability
- Export all data to JSON
- Import from JSON
- Transfer between environments

---

## ⚠️ KNOWN ISSUES

### Email Campaign Features (Backend)

**Problem**: Prisma schema/code misalignment

**Symptoms**:
- Can't create campaigns (database error)
- Email account doesn't show in dropdown (frontend can't fetch)
- Campaign listing fails

**Root Cause**:
During deployment, database uses snake_case (email_campaigns), code uses camelCase (emailCampaign), Prisma generates based on table names.

**Specific Errors** (33 remaining):
- Type mismatches in `.create()` operations
- Relation name mismatches
- Missing required fields
- Property access on wrong relation names

---

## 🔧 TO FIX EMAIL CAMPAIGNS

### Required Changes (Systematic Approach)

#### 1. Fix Type Imports (3 files)
- outlookEmailService.ts: `EmailIdentity` → `email_identities`
- smtpMailer.ts: `EmailIdentity` → `email_identities`
- Update all `: EmailIdentity` → `: email_identities`

#### 2. Fix Relation Names in Queries

**Pattern**: `include: { oldName: true }` → `include: { new_name: true }`

**Mappings**:
- `senderIdentity` → `email_identities`
- `contact` → `contacts`
- `campaign` → `email_campaigns`
- `prospects` → `email_campaign_prospects`
- `templates` → `email_campaign_templates`
- `steps` → `email_sequence_steps`
- `members` → `contact_list_members`
- `customerContacts` → `customer_contacts`

#### 3. Fix Property Access on Results

**Pattern**: `result.oldName` → `result.new_name`

Example:
- `campaign.senderIdentity` → `campaign.email_identities`
- `prospect.contact` → `prospect.contacts`
- `sequence.steps` → `sequence.email_sequence_steps`

#### 4. Add Required Fields to Creates

All `.create()` and `.createMany()` need:
- `id`: Generate using `cuid()` or timestamp
- `createdAt`: `new Date()`
- `updatedAt`: `new Date()`

OR add `as any` to bypass type checking

#### 5. Remove EmailSendSchedule References

This model doesn't exist in database - comment out schedules.ts entirely or remove references.

---

## 📋 STEP-BY-STEP FIX PLAN

### File 1: server/src/services/outlookEmailService.ts
```typescript
// Line 2: Change
import type { EmailIdentity, EmailMessageMetadata } from '@prisma/client'
// To
import type { email_identities, email_message_metadata } from '@prisma/client'

// Throughout file: Change
: EmailIdentity
// To
: email_identities
```

### File 2: server/src/services/smtpMailer.ts
```typescript
// Line 7: Change
import type { EmailIdentity } from '@prisma/client'
// To  
import type { email_identities } from '@prisma/client'

// Line 73 and others: Change
: EmailIdentity
// To
: email_identities
```

### File 3: server/src/routes/campaigns.ts
```typescript
// Line 348: Add required fields
data: newContactIds.map(contactId => ({
  id: `cp-${Date.now()}-${Math.random().toString(36).substr(2,9)}`,
  campaignId,
  contactId,
  senderIdentityId,
  lastStatus: 'pending',
  createdAt: new Date(),
  updatedAt: new Date()
}))

// Line 500: Change
'campaignProspect'
// To
'campaignProspectId'
```

### File 4: server/src/routes/customers.ts
```typescript
// Lines 65, 102: Change
customer.customer_contacts.map(contacts =>
// To
customer.customer_contacts.map(contact =>
```

### File 5: server/src/routes/schedules.ts
**Option A**: Comment out entire file (feature doesn't exist in database)
**Option B**: Remove all references to emailSendSchedule

### File 6: server/src/routes/sequences.ts
```typescript
// All 'steps' references: Change
'steps'
// To
'email_sequence_steps'

// Property access: Change
sequence.steps
// To
sequence.email_sequence_steps
```

### File 7-14: Workers and Services
Similar pattern - update relation names in `include` and property access.

---

## 🚀 AFTER FIXES

1. **Test build**: `cd server && npm run build`
2. **Commit**: `git add -A && git commit -m "Complete backend schema alignment"`
3. **Push**: `git push`
4. **Wait**: Render auto-deploys (2-3 minutes)
5. **Test**: Visit odcrm.vercel.app, create campaign
6. **Verify**: Email account appears in dropdown

---

## 💾 BACKUP PLAN

If systematic fixes don't work:
1. Rollback to commit `2270491` (last successful backend build)
2. Redeploy that to Render
3. Plan fresh rebuild in new session

---

**Current commit**: 777e2ac  
**Latest working backend**: 2270491  
**Files changed**: 16  
**Errors remaining**: 33  

This document will help complete the fix in current or future session.
