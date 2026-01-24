# Reply.io Study - Contacts/Lists Management Deep Dive

## Exploration Date
2026-01-24

## Current Status
**STEP 4: CONTACTS EXPLORATION** - ✅ Automated exploration successful. Contact filtering, fields, and management features documented.

## Discovered Contact Management Structure

### Contact Filtering System
Reply.io provides comprehensive contact filtering with activity-based segmentation:

**Status-Based Filters:**
- **All(33519)**: Total contacts in system (33,519 contacts)
- **My(0)**: User's personally added contacts (0)
- **Opened(1023)**: Contacts who opened emails (1,023)
- **Replied(21)**: Contacts who replied to emails (21)
- **Bounced(192)**: Contacts with bounced emails (192)
- **Opted Out(10)**: Unsubscribed contacts (10)
- **To Call(0)**: Contacts flagged for calling (0)
- **Clicked(0)**: Contacts who clicked links (0)

### Contact Actions & Management

**Primary Actions:**
- **New contact**: Add individual contacts manually
- **Create a list**: Create contact lists/segments for organization
- **Import from CSV**: Bulk import contacts from CSV files
- **Create manually**: Alternative manual contact creation
- **Saved filters**: Save and reuse custom filter combinations

**Organizational Features:**
- **Lists**: "Lists allow you to easily organize your contacts"
- **Saved filters**: Persistent filter combinations
- **Bulk operations**: Checkbox selection for bulk actions

### Contact Data Fields

**Core Contact Information:**
- **Domain name**: Primary domain/website
- **Account name**: Contact's account/organization name
- **Domain secondary**: Secondary domain
- **Description**: Contact description/notes
- **Email**: Primary email address
- **Phone**: Phone number

**Extended Profile Fields:**
- **Industry**: Industry classification
- **Company size**: Company size category
- **LinkedIn profile**: LinkedIn URL
- **Twitter profile**: Twitter handle/URL
- **Country**: Geographic location
- **State**: State/province
- **City**: City location
- **Time Zone**: Contact's timezone

### Contact Status Lifecycle

**Activity-Based Statuses:**
1. **New/Imported**: Recently added contacts
2. **Opened**: Contact opened at least one email
3. **Clicked**: Contact clicked links in emails
4. **Replied**: Contact replied to emails
5. **To Call**: Flagged for manual outreach
6. **Bounced**: Email delivery failed
7. **Opted Out**: Unsubscribed from communications

### List/Segment Management

**List Creation:**
- **Create a list**: Organize contacts into segments
- **Import from CSV**: Bulk import to specific lists
- **Manual addition**: Add contacts individually to lists

**List Purpose:**
- **Organization**: Group contacts by criteria
- **Targeting**: Segment for specific campaigns
- **Workflow**: Different lists for different sequence types

## Data Model Implications

### Contact Entity Structure
```
Contact {
  id: string
  email: string (primary)
  domainName: string
  accountName: string
  domainSecondary?: string
  description?: string
  phone?: string
  industry?: string
  companySize?: string
  linkedinProfile?: string
  twitterProfile?: string
  country?: string
  state?: string
  city?: string
  timezone?: string
  createdAt: datetime
  updatedAt: datetime
  ownerId: string
  status: ContactStatus
}
```

### Contact Status Enum
```
ContactStatus {
  ACTIVE = 'active'
  BOUNCED = 'bounced'
  OPTED_OUT = 'opted_out'
  TO_CALL = 'to_call'
}
```

### Activity Tracking
```
ContactActivity {
  contactId: string
  activityType: 'opened' | 'clicked' | 'replied' | 'bounced'
  emailId?: string
  sequenceId?: string
  timestamp: datetime
  metadata?: object
}
```

## Key Insights

1. **Rich Contact Profiles**: Reply.io captures extensive contact information beyond just email
2. **Activity-Driven Segmentation**: Contact management heavily focused on email engagement metrics
3. **Multi-Tenant Organization**: Lists and filters enable sophisticated contact organization
4. **Compliance-Ready**: Clear opted-out status tracking for unsubscribe management
5. **Scalable Architecture**: System handles 33K+ contacts with real-time filtering

## Integration Points

**With Sequences:**
- Contacts enrolled in sequences based on list membership
- Activity data feeds back to contact profiles
- Status updates trigger sequence automation

**With Reporting:**
- Contact activity metrics drive performance analytics
- List-based reporting for campaign effectiveness
- Bounce/unsubscribe rates for deliverability monitoring