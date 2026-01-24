# OpenDoors Data Model - Sequences & Steps

## Overview
Based on Reply.io's sequence architecture, OpenDoors implements a flexible multi-step email automation system with conditional logic, delays, and comprehensive tracking.

## Core Entities

### Sequence
Primary entity representing an email outreach campaign with multiple automated steps.

```sql
CREATE TABLE sequences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id),
  workspace_id UUID NOT NULL REFERENCES workspaces(id),

  -- Basic Information
  name VARCHAR(255) NOT NULL,
  description TEXT,
  status sequence_status_enum DEFAULT 'draft',

  -- Configuration
  owner_id UUID NOT NULL REFERENCES users(id),
  folder_id UUID REFERENCES sequence_folders(id),
  tags TEXT[],

  -- Goals & Objectives
  goal_type goal_type_enum, -- 'replies', 'meetings', 'sales', etc.
  goal_target INTEGER,
  goal_deadline DATE,

  -- Sending Configuration
  default_email_account_id UUID REFERENCES email_accounts(id),
  sending_timezone VARCHAR(50) DEFAULT 'UTC',
  sending_window_start TIME,
  sending_window_end TIME,
  sending_days BOOLEAN[7] DEFAULT '{t,t,t,t,t,f,f}', -- Mon-Sun

  -- Advanced Settings
  max_emails_per_day INTEGER DEFAULT 100,
  throttle_delay_minutes INTEGER DEFAULT 60,
  stop_on_reply BOOLEAN DEFAULT true,
  stop_on_bounce BOOLEAN DEFAULT true,
  stop_on_unsubscribe BOOLEAN DEFAULT true,

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID NOT NULL REFERENCES users(id),
  updated_by UUID REFERENCES users(id),

  -- Performance Tracking
  total_enrolled INTEGER DEFAULT 0,
  total_sent INTEGER DEFAULT 0,
  total_delivered INTEGER DEFAULT 0,
  total_opened INTEGER DEFAULT 0,
  total_clicked INTEGER DEFAULT 0,
  total_replied INTEGER DEFAULT 0,
  total_bounced INTEGER DEFAULT 0,
  total_unsubscribed INTEGER DEFAULT 0
);

-- Enums
CREATE TYPE sequence_status_enum AS ENUM ('draft', 'active', 'paused', 'stopped', 'archived');
CREATE TYPE goal_type_enum AS ENUM ('replies', 'meetings', 'sales', 'custom');
```

### SequenceStep
Individual steps within a sequence, supporting various action types and conditions.

```sql
CREATE TABLE sequence_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence_id UUID NOT NULL REFERENCES sequences(id) ON DELETE CASCADE,

  -- Step Configuration
  step_order INTEGER NOT NULL,
  step_type step_type_enum NOT NULL,

  -- Timing
  delay_days INTEGER DEFAULT 0,
  delay_hours INTEGER DEFAULT 0,
  delay_minutes INTEGER DEFAULT 0,

  -- Email Content (for email steps)
  subject_template TEXT,
  body_template TEXT,
  email_account_id UUID REFERENCES email_accounts(id),

  -- Advanced Options
  ab_test_enabled BOOLEAN DEFAULT false,
  ab_test_variants JSONB, -- Alternative subject/body combinations

  -- Conditions (for conditional steps)
  conditions JSONB, -- Complex condition logic
  condition_operator condition_operator_enum DEFAULT 'AND',

  -- Task Configuration (for task steps)
  task_title TEXT,
  task_description TEXT,
  task_assignee_id UUID REFERENCES users(id),
  task_due_days INTEGER,

  -- LinkedIn Configuration (for linkedin steps)
  linkedin_action linkedin_action_enum,
  linkedin_message TEXT,

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Performance Tracking
  times_executed INTEGER DEFAULT 0,
  success_rate DECIMAL(5,2)
);

-- Enums
CREATE TYPE step_type_enum AS ENUM ('email', 'task', 'linkedin', 'call', 'conditional', 'delay');
CREATE TYPE condition_operator_enum AS ENUM ('AND', 'OR');
CREATE TYPE linkedin_action_enum AS ENUM ('connect', 'message', 'view_profile');
```

### SequenceEnrollment
Tracks individual contact progression through sequences.

```sql
CREATE TABLE sequence_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence_id UUID NOT NULL REFERENCES sequences(id),
  contact_id UUID NOT NULL REFERENCES contacts(id),

  -- Enrollment Details
  enrolled_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  enrolled_by UUID REFERENCES users(id),
  enrollment_source enrollment_source_enum DEFAULT 'manual',

  -- Progression State
  current_step_id UUID REFERENCES sequence_steps(id),
  status enrollment_status_enum DEFAULT 'active',

  -- Timing
  last_step_completed_at TIMESTAMP WITH TIME ZONE,
  next_step_scheduled_at TIMESTAMP WITH TIME ZONE,

  -- Completion
  completed_at TIMESTAMP WITH TIME ZONE,
  completion_reason completion_reason_enum,

  -- Performance Tracking
  total_emails_sent INTEGER DEFAULT 0,
  total_opens INTEGER DEFAULT 0,
  total_clicks INTEGER DEFAULT 0,
  total_replies INTEGER DEFAULT 0,

  UNIQUE(sequence_id, contact_id)
);

-- Enums
CREATE TYPE enrollment_source_enum AS ENUM ('manual', 'bulk_import', 'api', 'automation');
CREATE TYPE enrollment_status_enum AS ENUM ('active', 'paused', 'completed', 'stopped', 'bounced', 'unsubscribed');
CREATE TYPE completion_reason_enum AS ENUM ('finished', 'unsubscribed', 'bounced', 'manual_stop', 'goal_achieved');
```

### SequenceFolder
Organizational structure for sequences.

```sql
CREATE TABLE sequence_folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id),
  workspace_id UUID NOT NULL REFERENCES workspaces(id),

  name VARCHAR(255) NOT NULL,
  description TEXT,
  color VARCHAR(7), -- Hex color code

  parent_folder_id UUID REFERENCES sequence_folders(id),
  sort_order INTEGER DEFAULT 0,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID NOT NULL REFERENCES users(id)
);
```

## Sequence Execution Logic

### Step Processing Flow
1. **Check Conditions**: Evaluate step conditions before execution
2. **Apply Delays**: Calculate next execution time based on delay settings
3. **Execute Action**: Send email, create task, or perform LinkedIn action
4. **Track Results**: Record activity and update enrollment status
5. **Schedule Next**: Determine and schedule subsequent steps

### Conditional Logic Structure
```json
{
  "conditions": [
    {
      "field": "email_opened",
      "operator": "equals",
      "value": true,
      "step_reference": 1
    },
    {
      "field": "days_since_last_contact",
      "operator": "greater_than",
      "value": 7
    }
  ],
  "operator": "AND"
}
```

### A/B Testing Implementation
```json
{
  "variants": [
    {
      "id": "variant_a",
      "subject": "Original Subject Line",
      "weight": 50
    },
    {
      "id": "variant_b",
      "subject": "Improved Subject Line",
      "weight": 50
    }
  ],
  "test_type": "subject_line",
  "winner_criteria": "open_rate"
}
```

## Sequence Status State Machine

```
draft → active → paused → active
  ↓      ↓        ↓
stopped  stopped   stopped
  ↓      ↓        ↓
archived ←────────┘
```

## Performance Considerations

### Indexing Strategy
```sql
-- Core lookup indexes
CREATE INDEX idx_sequences_customer_workspace ON sequences(customer_id, workspace_id);
CREATE INDEX idx_sequence_steps_sequence_order ON sequence_steps(sequence_id, step_order);
CREATE INDEX idx_enrollments_sequence_status ON sequence_enrollments(sequence_id, status);
CREATE INDEX idx_enrollments_contact ON sequence_enrollments(contact_id);

-- Performance indexes
CREATE INDEX idx_enrollments_next_scheduled ON sequence_enrollments(next_step_scheduled_at) WHERE status = 'active';
CREATE INDEX idx_sequences_status_updated ON sequences(status, updated_at);
```

### Partitioning Strategy
```sql
-- Partition enrollments by customer for better performance
-- Partition email activities by date for efficient analytics
```

### Caching Strategy
- **Sequence definitions**: Cache in Redis for fast access
- **Active enrollments**: Cache next execution times
- **Contact data**: Cache frequently accessed contact details
- **Template content**: Cache rendered email templates

## API Endpoints

### Sequence Management
- `POST /api/sequences` - Create sequence
- `GET /api/sequences` - List sequences with filtering
- `GET /api/sequences/{id}` - Get sequence details
- `PUT /api/sequences/{id}` - Update sequence
- `DELETE /api/sequences/{id}` - Delete sequence
- `POST /api/sequences/{id}/steps` - Add step
- `PUT /api/sequences/{id}/steps/{stepId}` - Update step

### Enrollment Management
- `POST /api/sequences/{id}/enroll` - Enroll contacts
- `POST /api/sequences/{id}/bulk-enroll` - Bulk enrollment
- `DELETE /api/enrollments/{id}` - Remove enrollment
- `PUT /api/enrollments/{id}/pause` - Pause enrollment
- `PUT /api/enrollments/{id}/resume` - Resume enrollment

This data model provides the foundation for a robust, scalable sequence management system that can handle complex automation workflows while maintaining performance and data integrity.