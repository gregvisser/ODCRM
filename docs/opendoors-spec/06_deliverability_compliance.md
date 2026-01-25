# OpenDoors Deliverability & Compliance Model

## Scope
Deliverability safeguards and compliance controls that prevent unwanted outreach and protect sender reputation.

## Core Entities
- **SuppressionEntry**
  - Fields: `id`, `customerId`, `type` (`domain|email`), `value`, `reason`, `source`, `createdAt`, `updatedAt`
  - Uniqueness: (`customerId`, `type`, `value`)

## Behaviors
- **Suppression list enforcement**
  - Domains or emails on the suppression list are excluded from outreach.
- **Unsubscribe handling**
  - `/api/email/unsubscribe` marks `EmailCampaignProspect.unsubscribedAt`
  - Pending steps are canceled.
- **Bounce handling**
  - Bounces mark `EmailCampaignProspect.bouncedAt` and halt future sends.

## API Contracts
- `GET /api/suppression?customerId=...`
- `POST /api/suppression?customerId=...`
- `DELETE /api/suppression/:id?customerId=...`

## UI Surfaces
- **Marketing → Compliance**
  - Manage suppression list (domains + emails)
  - Deliverability notes for send limits and unsubscribe handling

## Assumptions (Explicit)
- Suppression list is enforced at campaign scheduling time (pre-send).
- Subscribed status is tied to campaign prospects and can be expanded to contact-level suppression later.
