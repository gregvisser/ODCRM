# ODCRM Backend Server

Backend API server for the OpensDoors CRM Email Campaigns module.

## ⚠️ IMPORTANT: Always Run Prisma Commands from `/server`

**Single source of truth:** All Prisma files are in `server/prisma/`

```bash
# ❌ WRONG (from repo root) - will fail or show "0 migrations found"
npx prisma migrate status

# ✅ CORRECT (from server directory)
cd server
npx prisma migrate status
```

**Why:** The repo root has `prisma/schema.prisma` (legacy/unused), but the canonical location is `server/prisma/`. Running from root will use the wrong path.

## Quick Start

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables (copy `.env.example` to `.env`):
```bash
cp .env.example .env
# Edit .env with your configuration
```

3. Set up database:
```bash
npx prisma generate
npx prisma migrate dev
```

4. Start development server:
```bash
npm run dev
```

## Project Structure

```
server/
├── src/
│   ├── index.ts              # Main server entry point
│   ├── routes/               # API route handlers
│   │   ├── campaigns.ts      # Campaign CRUD endpoints
│   │   ├── outlook.ts        # Outlook OAuth & identity management
│   │   └── tracking.ts       # Email open/unsubscribe tracking
│   ├── services/             # Business logic services
│   │   ├── outlookEmailService.ts  # Microsoft Graph email operations
│   │   └── templateRenderer.ts     # Email template rendering
│   ├── workers/              # Background workers
│   │   ├── emailScheduler.ts       # Email sending scheduler
│   │   └── replyDetection.ts       # Reply detection worker
│   └── lib/
│       └── prisma.ts         # Prisma client singleton
└── prisma/
    └── schema.prisma         # Database schema
```

## Environment Variables

See `.env.example` for required variables.

## API Documentation

### Campaigns

- `GET /api/campaigns` - List campaigns
- `POST /api/campaigns` - Create campaign
- `GET /api/campaigns/:id` - Get campaign details
- `PATCH /api/campaigns/:id` - Update campaign
- `POST /api/campaigns/:id/start` - Start campaign
- `POST /api/campaigns/:id/pause` - Pause campaign
- `POST /api/campaigns/:id/complete` - Complete campaign
- `POST /api/campaigns/:id/templates` - Save email templates
- `POST /api/campaigns/:id/prospects` - Attach prospects

### Outlook OAuth

- `GET /api/outlook/auth` - Initiate OAuth flow
- `GET /api/outlook/callback` - OAuth callback handler
- `GET /api/outlook/identities` - List email identities
- `PATCH /api/outlook/identities/:id` - Update identity settings
- `DELETE /api/outlook/identities/:id` - Disconnect identity

### Tracking

- `GET /api/email/open?cpid=...` - Email open tracking pixel
- `GET /unsubscribe?cpid=...&token=...` - Unsubscribe page

## Background Workers

The server automatically starts two background workers:

1. **Email Scheduler** - Runs every minute to send scheduled campaign emails
2. **Reply Detection Worker** - Runs every 5 minutes to detect email replies

## Database

Uses Prisma ORM with PostgreSQL.

### Run migrations (from `/server` directory):

```bash
cd server

# Development (creates migration + applies)
npx prisma migrate dev

# Production (applies existing migrations only)
npx prisma migrate deploy

# Check migration status
npx prisma migrate status
```

### View database in Prisma Studio:

```bash
cd server
npx prisma studio
```

### Check which database you're connected to:

```bash
cd server

# Linux/macOS/Git Bash:
bash scripts/show-db-host.sh

# Windows PowerShell:
.\scripts\show-db-host.ps1
```

This will print only the hostname (never the password) to verify you're connected to the correct database.

## Development

```bash
# Watch mode
npm run dev

# Build
npm run build

# Production
npm start
```

## Testing

Make sure to set up test data:

1. Create a Customer record
2. Create Contact records
3. Connect an Outlook account via OAuth
4. Create and start a campaign
