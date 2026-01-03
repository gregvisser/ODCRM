# ODCRM Backend Server

Backend API server for the OpensDoors CRM Email Campaigns module.

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

Uses Prisma ORM with PostgreSQL. Run migrations with:

```bash
npx prisma migrate dev
```

View database in Prisma Studio:

```bash
npx prisma studio
```

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
