# OpenDoors Reporting & Analytics Model

## Scope
Reporting is based on `EmailEvent` records emitted by campaign sends and inbound activity.

## Core Entities
- **EmailEvent**
  - Fields: `id`, `campaignId`, `campaignProspectId`, `type`, `metadata`, `occurredAt`
  - Types: `sent`, `delivered`, `opened`, `replied`, `bounced`, `unsubscribed`
- **EmailCampaign**
  - Grouping key for report rollups
- **EmailIdentity**
  - Sender identity for team performance rollups

## Aggregations
- **Totals by event type** in a date range
- **By campaign**: counts per type for each campaign
- **Team performance**: sent/replied grouped by sender identity

## API Contracts
- `GET /api/reports/emails?start=ISO&end=ISO`
  - Returns totals and per-campaign breakdown
- `GET /api/reports/team-performance?start=ISO&end=ISO`
  - Returns per-sender rollups with reply rate

## UI Surfaces
- **Marketing → Reports**
  - Reply.io-style summary cards (Sent, Opened, Replied, Bounced, Unsubscribed)
  - Campaign breakdown table
  - Team performance table

## Assumptions (Explicit)
- Open rates rely on tracking pixel calls to `/api/email/open`.
- Reply rates rely on inbound mail detection (reply detection worker).
