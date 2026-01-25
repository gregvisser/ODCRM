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

## Assumptions (Explicit)
- **Wizard structure** suggests a linear flow: select/enroll contacts → define steps → configure settings.
- **Sequence steps** likely support multiple step types, but no step builder UI was visible in this session.
- **Settings step** likely contains sending windows, stop conditions, and account selection (not confirmed).