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
**STEP 1: INITIAL ACCESS** - ✅ User authenticated successfully. Ready to explore dashboard and navigation structure.

## SSL Certificate Issue
- Browser cannot access https://app.reply.io due to certificate authority validation failure
- This is a security feature that cannot be bypassed programmatically
- User must authenticate in their own browser session

## High-Level Navigation Structure (Discovered)
- [x] **Sequences** - Main outreach sequences/campaigns management
- [ ] **People** - Contact/lead management
- [ ] **AI SDR** - AI-powered sales development representative features (v3.0)
- [ ] **Data** - Data management and enrichment
- [ ] **Inbox** - Email inbox with counter (currently 0)
- [ ] **Execution** - Task execution with counter (currently 0)
- [ ] **Reports** - Analytics and reporting

## Additional UI Elements
- **Top-right area**: Onboarding, Notifications, Tasks(?), Workspace selector ("Client: Beauparc"), User profile ("Greg Visser")
- **Workspace context**: Currently in "Beauparc" client workspace
- **User context**: Greg Visser (greg@opensdoors.co.uk)

## Assumptions Made
- All exploration will be done through the authenticated UI only
- No attempt to access unauthorized data or bypass permissions
- Documentation will focus on structures, flows, and concepts, not proprietary content
- Conservative assumptions will be made when Reply.io behavior is unclear