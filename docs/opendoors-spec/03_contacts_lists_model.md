# OpenDoors Data Model - Contacts & Lists

## Overview
Based on Reply.io's contact management architecture, OpenDoors implements a comprehensive contact database with rich profiling, activity tracking, and dynamic segmentation capabilities.

## Core Entities

### Contact
Central entity representing individuals in the outreach database with extensive profile information.

```sql
CREATE TABLE contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id),
  workspace_id UUID NOT NULL REFERENCES workspaces(id),

  -- Identity Information
  email VARCHAR(255) NOT NULL,
  first_name VARCHAR(255),
  last_name VARCHAR(255),
  full_name VARCHAR(255) GENERATED ALWAYS AS (
    CASE
      WHEN first_name IS NOT NULL AND last_name IS NOT NULL THEN
        first_name || ' ' || last_name
      WHEN first_name IS NOT NULL THEN first_name
      WHEN last_name IS NOT NULL THEN last_name
      ELSE NULL
    END
  ) STORED,

  -- Professional Information
  job_title VARCHAR(255),
  company_name VARCHAR(255),
  company_domain VARCHAR(255),
  company_secondary_domain VARCHAR(255),
  company_size company_size_enum,
  industry industry_enum,

  -- Contact Information
  phone VARCHAR(50),
  phone_type phone_type_enum DEFAULT 'work',

  -- Social Profiles
  linkedin_profile VARCHAR(500),
  twitter_profile VARCHAR(500),
  facebook_profile VARCHAR(500),
  website VARCHAR(500),

  -- Geographic Information
  country VARCHAR(100),
  state VARCHAR(100),
  city VARCHAR(100),
  postal_code VARCHAR(20),
  timezone VARCHAR(50) DEFAULT 'UTC',

  -- Professional Details
  seniority seniority_enum,
  department department_enum,

  -- Custom Fields (JSONB for extensibility)
  custom_fields JSONB DEFAULT '{}',

  -- Status & Compliance
  status contact_status_enum DEFAULT 'active',
  unsubscribed_at TIMESTAMP WITH TIME ZONE,
  bounced_at TIMESTAMP WITH TIME ZONE,
  bounce_reason VARCHAR(255),
  do_not_contact BOOLEAN DEFAULT false,

  -- Activity Tracking
  first_seen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_seen_at TIMESTAMP WITH TIME ZONE,
  last_contacted_at TIMESTAMP WITH TIME ZONE,
  last_opened_at TIMESTAMP WITH TIME ZONE,
  last_clicked_at TIMESTAMP WITH TIME ZONE,
  last_replied_at TIMESTAMP WITH TIME ZONE,

  -- Engagement Metrics
  total_emails_received INTEGER DEFAULT 0,
  total_emails_opened INTEGER DEFAULT 0,
  total_links_clicked INTEGER DEFAULT 0,
  total_replies INTEGER DEFAULT 0,
  open_rate DECIMAL(5,2) GENERATED ALWAYS AS (
    CASE
      WHEN total_emails_received > 0 THEN
        ROUND((total_emails_opened::DECIMAL / total_emails_received) * 100, 2)
      ELSE 0
    END
  ) STORED,
  click_rate DECIMAL(5,2) GENERATED ALWAYS AS (
    CASE
      WHEN total_emails_received > 0 THEN
        ROUND((total_links_clicked::DECIMAL / total_emails_received) * 100, 2)
      ELSE 0
    END
  ) STORED,
  reply_rate DECIMAL(5,2) GENERATED ALWAYS AS (
    CASE
      WHEN total_emails_received > 0 THEN
        ROUND((total_replies::DECIMAL / total_emails_received) * 100, 2)
      ELSE 0
    END
  ) STORED,

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id),
  source contact_source_enum DEFAULT 'manual',
  source_details JSONB,

  -- Data Quality
  email_verified BOOLEAN DEFAULT false,
  email_verification_date TIMESTAMP WITH TIME ZONE,
  enrichment_score INTEGER DEFAULT 0, -- 0-100 based on data completeness
  last_enriched_at TIMESTAMP WITH TIME ZONE,

  UNIQUE(customer_id, email)
);

-- Enums
CREATE TYPE contact_status_enum AS ENUM ('active', 'bounced', 'unsubscribed', 'do_not_contact');
CREATE TYPE company_size_enum AS ENUM ('1-10', '11-50', '51-200', '201-500', '501-1000', '1001-5000', '5001-10000', '10000+');
CREATE TYPE industry_enum AS ENUM ('technology', 'healthcare', 'finance', 'education', 'retail', 'manufacturing', 'consulting', 'real_estate', 'other');
CREATE TYPE phone_type_enum AS ENUM ('work', 'mobile', 'home', 'other');
CREATE TYPE seniority_enum AS ENUM ('individual_contributor', 'senior', 'manager', 'director', 'vp', 'c_suite', 'founder', 'other');
CREATE TYPE department_enum AS ENUM ('sales', 'marketing', 'engineering', 'product', 'design', 'hr', 'finance', 'operations', 'executive', 'other');
CREATE TYPE contact_source_enum AS ENUM ('manual', 'csv_import', 'api', 'crm_integration', 'enrichment', 'web_form');
```

### ContactList
Dynamic segments for organizing and targeting contacts with flexible filtering.

```sql
CREATE TABLE contact_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id),
  workspace_id UUID NOT NULL REFERENCES workspaces(id),

  -- Basic Information
  name VARCHAR(255) NOT NULL,
  description TEXT,
  type list_type_enum DEFAULT 'static',

  -- Configuration
  created_by UUID NOT NULL REFERENCES users(id),
  color VARCHAR(7), -- Hex color for UI
  is_public BOOLEAN DEFAULT true,

  -- Dynamic List Configuration (for type = 'dynamic')
  filter_rules JSONB, -- Complex filter conditions
  auto_refresh BOOLEAN DEFAULT false,
  last_refreshed_at TIMESTAMP WITH TIME ZONE,

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Statistics
  total_contacts INTEGER DEFAULT 0,
  active_contacts INTEGER DEFAULT 0
);

-- Enums
CREATE TYPE list_type_enum AS ENUM ('static', 'dynamic', 'suppression');
```

### ContactListMembership
Junction table managing contact-to-list relationships with membership metadata.

```sql
CREATE TABLE contact_list_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  list_id UUID NOT NULL REFERENCES contact_lists(id) ON DELETE CASCADE,

  -- Membership Details
  added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  added_by UUID REFERENCES users(id),
  source membership_source_enum DEFAULT 'manual',

  -- Dynamic Membership (for dynamic lists)
  is_dynamic BOOLEAN DEFAULT false,
  last_evaluated_at TIMESTAMP WITH TIME ZONE,
  evaluation_result BOOLEAN DEFAULT true,

  UNIQUE(contact_id, list_id)
);

-- Enums
CREATE TYPE membership_source_enum AS ENUM ('manual', 'bulk_import', 'rule_evaluation', 'api', 'automation');
```

### ContactActivity
Comprehensive activity tracking for all contact interactions.

```sql
CREATE TABLE contact_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id),

  -- Activity Details
  activity_type activity_type_enum NOT NULL,
  activity_subtype VARCHAR(100),

  -- Related Entities
  sequence_id UUID REFERENCES sequences(id),
  sequence_step_id UUID REFERENCES sequence_steps(id),
  email_account_id UUID REFERENCES email_accounts(id),
  email_message_id VARCHAR(255), -- External email ID

  -- Timing
  occurred_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Activity Data
  metadata JSONB DEFAULT '{}', -- Flexible data storage

  -- Location/Technical Data
  ip_address INET,
  user_agent TEXT,
  geo_country VARCHAR(100),
  geo_city VARCHAR(100),

  -- Processing Status
  processed BOOLEAN DEFAULT false,
  processed_at TIMESTAMP WITH TIME ZONE,

  -- Indexing for performance
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enums
CREATE TYPE activity_type_enum AS ENUM (
  'email_sent', 'email_delivered', 'email_opened', 'email_clicked',
  'email_replied', 'email_bounced', 'email_unsubscribed',
  'contact_created', 'contact_updated', 'contact_enriched',
  'sequence_enrolled', 'sequence_completed', 'task_created',
  'linkedin_connected', 'linkedin_viewed', 'call_completed'
);
```

### ContactSuppressionList
Specialized lists for compliance and deliverability management.

```sql
CREATE TABLE contact_suppression_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id),
  workspace_id UUID NOT NULL REFERENCES workspaces(id),

  -- Suppression Details
  suppression_type suppression_type_enum NOT NULL,
  reason TEXT,
  source VARCHAR(255), -- e.g., 'gmail', 'yahoo', 'manual'

  -- Contact Information
  email VARCHAR(255) NOT NULL,
  domain VARCHAR(255),

  -- Timing
  suppressed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE, -- For temporary suppressions

  -- Metadata
  added_by UUID REFERENCES users(id),
  notes TEXT,

  UNIQUE(customer_id, email, suppression_type)
);

-- Enums
CREATE TYPE suppression_type_enum AS ENUM (
  'hard_bounce', 'soft_bounce', 'complaint', 'unsubscribe',
  'manual', 'domain_block', 'isp_block', 'temporary'
);
```

## Dynamic List Filtering Logic

### Filter Rule Structure
```json
{
  "operator": "AND",
  "conditions": [
    {
      "field": "industry",
      "operator": "equals",
      "value": "technology"
    },
    {
      "field": "company_size",
      "operator": "in",
      "value": ["51-200", "201-500", "501-1000"]
    },
    {
      "field": "last_opened_at",
      "operator": "greater_than",
      "value": "30 days ago"
    },
    {
      "field": "open_rate",
      "operator": "greater_than",
      "value": 25
    }
  ]
}
```

### Supported Filter Operators
- **equals**, **not_equals**
- **contains**, **not_contains**
- **starts_with**, **ends_with**
- **greater_than**, **less_than**
- **in**, **not_in**
- **is_empty**, **is_not_empty**
- **between**
- **date_relative** (e.g., "last 30 days")

## Contact Enrichment System

### Enrichment Queue
```sql
CREATE TABLE contact_enrichment_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES contacts(id),
  enrichment_provider VARCHAR(100),
  priority INTEGER DEFAULT 1,
  status enrichment_status_enum DEFAULT 'pending',
  queued_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  processed_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT
);

CREATE TYPE enrichment_status_enum AS ENUM ('pending', 'processing', 'completed', 'failed');
```

### Enrichment Data Sources
- **Hunter.io**: Email verification and domain data
- **Clearbit**: Company and contact enrichment
- **LinkedIn**: Professional profile data
- **ZoomInfo**: B2B contact database
- **Manual**: User-provided data

## Performance & Scalability

### Indexing Strategy
```sql
-- Core lookup indexes
CREATE INDEX idx_contacts_customer_workspace ON contacts(customer_id, workspace_id);
CREATE INDEX idx_contacts_email ON contacts(customer_id, email);
CREATE INDEX idx_contacts_status ON contacts(customer_id, status);
CREATE INDEX idx_contacts_company_domain ON contacts(company_domain);

-- Activity indexes
CREATE INDEX idx_contact_activities_contact_type ON contact_activities(contact_id, activity_type);
CREATE INDEX idx_contact_activities_sequence ON contact_activities(sequence_id);
CREATE INDEX idx_contact_activities_occurred_at ON contact_activities(occurred_at);

-- List membership indexes
CREATE INDEX idx_list_memberships_list ON contact_list_memberships(list_id);
CREATE INDEX idx_list_memberships_contact ON contact_list_memberships(contact_id);
CREATE INDEX idx_list_memberships_dynamic ON contact_list_memberships(list_id) WHERE is_dynamic = true;

-- Suppression indexes
CREATE INDEX idx_suppression_lists_customer_email ON contact_suppression_lists(customer_id, email);
CREATE INDEX idx_suppression_lists_type ON contact_suppression_lists(customer_id, suppression_type);
```

### Partitioning Strategy
```sql
-- Partition contact activities by month for performance
-- Partition large contact tables by customer if needed
```

### Caching Strategy
- **Contact profiles**: Cache frequently accessed contacts
- **List memberships**: Cache user's list memberships
- **Activity summaries**: Pre-computed engagement metrics
- **Suppression lists**: Fast lookup for email sending

## API Endpoints

### Contact Management
- `GET /api/contacts` - List contacts with filtering/pagination
- `POST /api/contacts` - Create contact
- `GET /api/contacts/{id}` - Get contact details
- `PUT /api/contacts/{id}` - Update contact
- `DELETE /api/contacts/{id}` - Delete contact
- `POST /api/contacts/bulk` - Bulk import contacts

### List Management
- `GET /api/lists` - List contact lists
- `POST /api/lists` - Create list
- `GET /api/lists/{id}` - Get list details
- `PUT /api/lists/{id}` - Update list
- `DELETE /api/lists/{id}` - Delete list
- `POST /api/lists/{id}/contacts` - Add contacts to list
- `DELETE /api/lists/{id}/contacts` - Remove contacts from list

### Activity Tracking
- `GET /api/contacts/{id}/activities` - Get contact activity history
- `POST /api/activities` - Record new activity
- `GET /api/activities/summary` - Get activity analytics

### Enrichment
- `POST /api/contacts/{id}/enrich` - Trigger contact enrichment
- `GET /api/enrichment/status` - Check enrichment queue status

This comprehensive contact management system provides the foundation for sophisticated segmentation, personalization, and compliance management in the OpenDoors platform.