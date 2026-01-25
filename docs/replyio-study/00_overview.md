# Reply.io Study - Overview

## Study Start Date
2026-01-24

## Primary Goal
Systematically explore Reply.io's email outreach system to understand its structure, flows, and capabilities, then design and implement a near-equivalent system for OpenDoors CRM.

## Methodology
- Hands-on exploration of authenticated Reply.io account via browser
- Documentation of all discovered entities, fields, workflows, and behaviors
- Design of equivalent OpenDoors system based on observations
- Implementation respecting Reply.io's Terms of Service (no copying of proprietary code/text)

## Current Status
**STEP 1: INITIAL ACCESS** - ✅ Navigation verified on Reply.io dashboard.

## SSL Certificate Issue
- Browser cannot access https://app.reply.io due to certificate authority validation failure
- This is a security feature that cannot be bypassed programmatically
- User must authenticate in their own browser session

## High-Level Navigation Structure (Observed)
- **Sequences**: sequence list, filters, and creation entry points.
- **People**: contacts list with filters and list tools.
- **AI SDR (v3.0)**: AI SDR section (label only observed).
- **Data**: data/tools area (label only observed).
- **Inbox**: inbox area with counters.
- **Execution**: execution area with counters.
- **Reports**: analytics/reporting entry.

## Additional UI Elements
- **Top-right**: Onboarding, Notifications, an item counter badge, workspace selector ("Client: Beauparc"), user profile ("Greg Visser").
- **Workspace context**: Currently in "Beauparc" client workspace.
- **User context**: Greg Visser (greg@opensdoors.co.uk).

## Assumptions Made
- All exploration will be done through the authenticated UI only
- No attempt to access unauthorized data or bypass permissions
- Documentation will focus on structures, flows, and concepts, not proprietary content
- Conservative assumptions will be made when Reply.io behavior is unclear