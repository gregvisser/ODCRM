# ODCRM Terminology Guide

## Overview

This document explains terminology choices in the ODCRM system.

---

## Lead Sources

### User-Facing Names
- **Cognism** - Lead source from Cognism API
- **Apollo** - Lead source from Apollo.io
- **Social** - Lead source from social/manual research (formerly "Blackbook")

### Implementation
- **UI Display**: Uses `SOURCE_LABELS` mapping in `LeadSourcesTab.tsx`
  ```typescript
  const SOURCE_LABELS = {
    cognism: 'Cognism',
    apollo: 'Apollo',
    blackbook: 'Social',  // Maps DB enum to UI label
  }
  ```

- **Database**: Uses enum `SheetSource` with values: `cognism`, `apollo`, `blackbook`
  - Note: DB enum kept as `blackbook` for backward compatibility
  - No migration needed - mapping handles UI display

### Why "Blackbook" in Database?
- Maintains backward compatibility with existing data
- Avoids risky schema migration
- UI mapping provides clean user experience
- Best practice: Don't rename DB enums unless absolutely necessary

---

## Suppression / Compliance

### User-Facing Names
- **Primary**: "Suppression List"
- **Secondary**: "Do Not Contact (DNC)" - used in help text
- **Old Name**: "Compliance List" (removed in PR1)

### Purpose
Manage lists of email addresses and domains that should NOT receive emails:
- Unsubscribed users
- Bounced addresses
- Problematic recipients

### Implementation
- **Navigation**: `MarketingHomePage.tsx` shows "Suppression List"
- **Tab Header**: `ComplianceTab.tsx` shows "Suppression List"
- **Help Text**: Includes "Do Not Contact (DNC)" for clarity
- **Backend**: Uses `SuppressionEntry` model with `type` field (email or domain)

---

## Best Practices

### When to Update Terminology

✅ **Do Update**:
- UI labels and display text
- Help text and documentation
- Navigation items
- User-facing messaging

❌ **Don't Update (Without Migration)**:
- Database enum values
- API parameter names (breaking change)
- Existing data records

### Migration Strategy

If terminology MUST change in database:
1. Create mapping layer first (UI → DB)
2. Deploy and verify
3. Plan zero-downtime migration
4. Update all API consumers
5. Execute migration with rollback plan
6. Remove mapping layer

**Current Status**: All terminology updates complete via UI mapping only. No database migration needed.

---

## Change Log

| Date | Change | PR | Type |
|------|--------|----|----- |
| 2026-02-09 | "Compliance List" → "Suppression List" | PR1 | UI Only |
| 2026-02-09 | "Blackbook" → "Social" (UI only) | Existing | Mapping |

---

**Last Updated**: 2026-02-09
**Status**: All terminology aligned and documented
