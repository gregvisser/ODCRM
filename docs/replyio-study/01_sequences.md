# Reply.io Study - Sequences/Campaigns Deep Dive

## Exploration Date
2026-01-24

## Current Status
**STEP 2: SEQUENCES EXPLORATION** - ✅ Sequence list and creation entry points observed. Wizard content did not load (loading spinner).

## Sequence List View (Observed)

### Filters and Controls
- **Status** filter button.
- **All statuses** dropdown.
- **All** filter.
- **My** filter (user-specific).
- **Search** input for sequences.
- **Create a folder** prompt (organize sequences).
- **Install extension** prompt.
- **Select all** checkbox in list.

### Columns/Fields Displayed
- **Name**
- **People**
- **Open rate**
- **Reply rate**
- **Connection rate**
- **Progress**
- **Owner**
- **Deliveries**

### Row Controls
- **Toggle switch** per sequence (likely activate/pause).
- **Row actions** menu (three-dot).
- **Checkbox** per sequence for bulk actions.

## Sequence Creation Entry Points
- **New sequence** button opens a menu with options:
  - **From template**
  - **From scratch**
  - **From magic**
  - **Jason AI SDR** (specialized option)

## Template Picker (Observed)
When selecting **From template**, a modal titled **Select a template** appears.

### Tabs
- **Reply templates** (active)
- **Team templates** (disabled)

### Template Types
Each template shows a type badge:
- **Linear**
- **Conditional**

### Example Template Names (Observed)
- LinkedIn sequence (Conditional)
- Move to Sequence (Conditional)
- Multichannel demo request (Linear)
- Trial to customer (SaaS) (Linear)
- Outbound cold outreach (Linear)
- Engagement (Conditional)
- Inbound leads (SaaS) (Linear)
- Recruiting (Linear)
- Cold outreach sequence (Conditional)
- Educational / prevent churn (Linear)
- Multichannel trial users (Linear)
- Multichannel demo no-show (Linear)
- Simple sequence (Conditional)
- Multichannel outbound cold outreach (Linear)

### Actions
- **Cancel** button
- **Create** button (disabled until a template is selected)

## Sequence Wizard (Observed Shell)
After choosing **From scratch**, a wizard route opened:
`/sequences/add/<id>/people`

### Wizard Steps (top stepper)
1. **Contacts**
2. **Steps**
3. **Settings**

### Header Elements
- **Sequence name field** (editable, default “New sequence”)
- **Saved** status indicator
- **Back** button

### Loading Issue
The Contacts step stayed on a loading spinner and the content area did not render within the session. No fields for contact selection/enrollment were visible.

## Sequence Builder (Observed)
Opening an existing sequence shows a multi-tab editor.

### Editor Tabs
- **Inbox**
- **Steps** (selected by default for editing)
- **People**
- **Preview**
- **Stats**
- **AI Replies**
- **Settings**
- **Log**

### Header Controls
- **Sequence name** editable field.
- **Email limit** indicator (example: `0/100`).
- **Status toggle** (example label: “New”).
- **Schedule selector** (example: “Schedule: Default”).
- **Plain text sending mode** toggle with deliverability note.

### Step Card Structure
- **Step label**: “Step 1 – Day 1”.
- **Timing**: “Right away” dropdown (delay control).
- **Variant label** (A) with default variant label.
- **Add variant** button.
- **Generate AI variant** button.

### Step Type Selector (Modal)
Opening a step shows a modal with step-type tabs:
- **Email**
- **Call**
- **SMS**
- **WhatsApp**
- **LinkedIn**
- **Zapier**
- **Task**

### Email Step Fields
- **Send type** dropdown (example: “Automatic”).
- **Subject** input.
- **CC** and **BCC** toggles/buttons.
- **Body editor** (rich text) with toolbar features:
  - Font family, font size, text color
  - Bold/italic/underline/strikethrough
  - Insert link
  - Insert image + upload image
  - Bullet/numbered lists
  - Indent controls
  - Attachments, add video
  - Book meeting link, insert Calendly link
- Banner suggestion: prompt to add a **LinkedIn** step for higher reply rates.

## Assumptions (Explicit)
- **Wizard structure** suggests a linear flow: select/enroll contacts → define steps → configure settings.
- **Sequence steps** likely support multiple step types, but no step builder UI was visible in this session.
- **Settings step** likely contains sending windows, stop conditions, and account selection (not confirmed).