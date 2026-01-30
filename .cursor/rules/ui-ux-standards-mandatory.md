# MANDATORY: UI/UX Standards - Professional Compact Design

## 🚨 CRITICAL - ALL COMPONENTS MUST FOLLOW

**This rule applies to ALL UI components - existing and new. No exceptions.**

---

## Core Principles

### 1. Responsive Design (Mobile-First)
- ✅ Design for mobile first, scale up
- ✅ Test on: Mobile (375px), Tablet (768px), Laptop (1024px), Desktop (1440px+)
- ✅ No horizontal scrolling on any device
- ✅ Touch-friendly targets (min 44x44px)

### 2. Compact Professional Layout
- ✅ Tight, efficient spacing (not stretched out)
- ✅ Maximum information density without clutter
- ✅ Consistent padding/margins across system
- ✅ Professional business aesthetic

### 3. Data Tables (Critical)
- ✅ Sortable columns (click header to sort)
- ✅ Filterable columns (search/filter per column)
- ✅ Resizable columns (drag divider)
- ✅ Reorderable columns (drag and drop)
- ✅ Column visibility toggle
- ✅ User preferences persist in localStorage
- ✅ Export preserves original data order (not UI order)

### 4. User Preferences
- ✅ Column order saved per-user per-table
- ✅ Column widths saved
- ✅ Sort preferences saved
- ✅ Filter preferences saved
- ✅ Reset to default option

---

## Spacing Standards (Compact Design)

### Chakra UI Spacing Scale
```typescript
// Use these values consistently
const SPACING = {
  tight: 1,      // 4px - between related elements
  compact: 2,    // 8px - compact sections
  normal: 3,     // 12px - standard spacing
  comfortable: 4, // 16px - between sections
  spacious: 6,   // 24px - major sections
}
```

### Component Spacing Rules

**Tables:**
```tsx
<Table size="sm">  {/* ALWAYS use size="sm" for compact */}
  <Thead>
    <Tr>
      <Th fontSize="xs" py={2} px={3}>  {/* py=2, px=3 for compact */}
```

**Cards/Boxes:**
```tsx
<Box p={3}>  {/* p=3 (12px) not p=6 or p=8 */}
```

**Stack spacing:**
```tsx
<VStack spacing={3}>  {/* spacing=3 (12px) not spacing=6 */}
```

**Grid gaps:**
```tsx
<SimpleGrid spacing={3}>  {/* spacing=3 not spacing=6 */}
```

---

## Table Component Standards

### ALWAYS Use DataTable Component

**Location**: `src/components/DataTable.tsx` (to be created)

**Features**:
- Column sorting (asc/desc)
- Column filtering (per-column search)
- Column resizing (drag dividers)
- Column reordering (drag headers)
- Column visibility toggle
- Pagination
- Bulk actions
- Export (CSV/Excel)
- User preferences (saved to localStorage)
- Responsive (mobile cards, tablet/desktop table)

**Usage Example**:
```tsx
import { DataTable } from '../components/DataTable'

const columns = [
  { id: 'name', header: 'Name', sortable: true, filterable: true },
  { id: 'email', header: 'Email', sortable: true, filterable: true },
  { id: 'status', header: 'Status', sortable: true },
]

<DataTable
  data={accounts}
  columns={columns}
  tableId="accounts-table"  // For saving preferences
  enableSorting
  enableFiltering
  enableColumnReorder
  enableColumnResize
  enableExport
  compact  // Use compact spacing
/>
```

---

## Responsive Breakpoints

```typescript
const BREAKPOINTS = {
  mobile: '0px',      // 0-767px
  tablet: '768px',    // 768-1023px
  laptop: '1024px',   // 1024-1439px
  desktop: '1440px',  // 1440px+
}

// Usage in Chakra UI
<SimpleGrid columns={{ mobile: 1, tablet: 2, laptop: 3, desktop: 4 }}>
```

### Responsive Patterns

**Mobile (< 768px)**:
- Single column layouts
- Collapsible sections
- Bottom sheet modals
- Hamburger menus
- Cards instead of tables
- Large touch targets (min 44px)

**Tablet (768-1023px)**:
- 2-column layouts
- Side drawers
- Condensed tables
- Compact cards

**Laptop/Desktop (1024px+)**:
- Multi-column layouts
- Full data tables
- Side panels
- Hover states

---

## Font Sizes (Compact Professional)

```typescript
const FONT_SIZES = {
  xs: '0.75rem',   // 12px - table headers, labels
  sm: '0.875rem',  // 14px - table data, secondary text
  md: '1rem',      // 16px - body text, buttons
  lg: '1.125rem',  // 18px - section headings
  xl: '1.25rem',   // 20px - page headings
  '2xl': '1.5rem', // 24px - major headings
}
```

**Use smaller sizes for compact design:**
```tsx
// Table headers
<Th fontSize="xs">Name</Th>

// Table data
<Td fontSize="sm">John Doe</Td>

// Section headings
<Heading size="sm">Accounts</Heading>  // Not size="lg"
```

---

## Color Palette (Professional)

```typescript
const COLORS = {
  // Primary brand
  brand: 'blue.600',
  brandHover: 'blue.700',
  
  // Status colors
  success: 'green.500',
  warning: 'orange.500',
  error: 'red.500',
  info: 'blue.500',
  
  // Neutral
  textPrimary: 'gray.800',
  textSecondary: 'gray.600',
  textTertiary: 'gray.400',
  border: 'gray.200',
  background: 'gray.50',
  
  // Table
  tableHeaderBg: 'gray.100',
  tableRowHover: 'gray.50',
  tableRowStripe: 'gray.25',
}
```

---

## Component Examples

### Before (Stretched, Unprofessional):
```tsx
❌ BAD
<Box p={8} m={6}>  {/* Too much padding */}
  <Heading size="xl" mb={6}>Accounts</Heading>  {/* Too large, too much margin */}
  <VStack spacing={6}>  {/* Too much spacing */}
    <Table size="md">  {/* Not compact */}
      <Thead>
        <Tr>
          <Th fontSize="md" py={4}>Name</Th>  {/* Too large, too much padding */}
```

### After (Compact, Professional):
```tsx
✅ GOOD
<Box p={3}>  {/* Compact padding */}
  <Heading size="sm" mb={2}>Accounts</Heading>  {/* Compact heading */}
  <VStack spacing={3}>  {/* Compact spacing */}
    <Table size="sm">  {/* Compact table */}
      <Thead>
        <Tr>
          <Th fontSize="xs" py={2} px={3}>Name</Th>  {/* Compact, readable */}
```

---

## Data Integrity Rules

### Column Reordering MUST NOT Affect Data

**User Preference Storage**:
```typescript
// Save column order in localStorage (UI only)
const columnOrder = ['name', 'email', 'status']  // User's preferred order
localStorage.setItem('table_accounts_columnOrder', JSON.stringify(columnOrder))

// BUT: Export/Import uses ORIGINAL data structure
const exportData = accounts.map(account => ({
  id: account.id,           // Always original order
  name: account.name,       // Not affected by UI column order
  email: account.email,     // Data structure unchanged
  status: account.status,
}))
```

**The Rule**:
- UI column order: User preference (localStorage)
- Data structure: Never changes
- CSV/Excel export: Always uses original data structure
- Import: Always maps to original data structure

---

## Testing Checklist

For every component:

### ✅ Responsive Test
- [ ] Test on mobile (375px width)
- [ ] Test on tablet (768px width)
- [ ] Test on laptop (1024px width)
- [ ] Test on desktop (1440px+ width)
- [ ] No horizontal scrolling
- [ ] All interactive elements accessible
- [ ] Touch targets min 44x44px on mobile

### ✅ Table Features Test
- [ ] Click column header to sort
- [ ] Click again to reverse sort
- [ ] Drag column header to reorder
- [ ] Drag column divider to resize
- [ ] Filter per column works
- [ ] Export CSV preserves original data order
- [ ] Preferences persist after refresh
- [ ] Reset to default works

### ✅ Spacing Test
- [ ] Layout is compact (not stretched)
- [ ] Consistent spacing throughout
- [ ] Professional appearance
- [ ] Readable on all devices

### ✅ Data Integrity Test
- [ ] Reorder columns in UI
- [ ] Export CSV
- [ ] Verify CSV has original column order
- [ ] Import CSV back
- [ ] Verify data maps correctly

---

## Migration Checklist

For each component being updated:

- [ ] Replace custom tables with DataTable component
- [ ] Update spacing (p=3, spacing=3, etc.)
- [ ] Update font sizes (size="sm", fontSize="xs")
- [ ] Add responsive breakpoints
- [ ] Test on all device sizes
- [ ] Verify data integrity for exports

---

## Libraries to Use

### Data Tables
- **TanStack Table v8** (React Table)
  - Best-in-class table library
  - Sorting, filtering, pagination
  - Column resizing, reordering
  - Headless (works with Chakra UI)

### Drag and Drop
- **@dnd-kit** (Modern drag and drop)
  - Lightweight, accessible
  - Touch-friendly
  - Works with tables

### Install:
```bash
npm install @tanstack/react-table @dnd-kit/core @dnd-kit/sortable
```

---

## Priority Components (Migrate First)

### Phase 1 (This Week):
1. Dashboard table (Client Lead Generation)
2. Accounts table (main accounts view)
3. Leads table (marketing leads)
4. Contacts table

### Phase 2 (Next Week):
- All remaining tables
- All forms
- All layouts

---

## Summary: The Rules

1. **Compact Spacing**: p=3, spacing=3, py=2
2. **Small Font Sizes**: fontSize="xs" for headers, "sm" for data
3. **Responsive**: Test on mobile/tablet/laptop/desktop
4. **DataTable Component**: Use for ALL tables
5. **User Preferences**: Column order/width saved to localStorage
6. **Data Integrity**: Exports always use original structure

**No exceptions. Build it professional.**

---

**Last Updated**: 2026-01-28  
**Status**: MANDATORY - Enforced for ALL UI code  
**Questions**: Ask before deviating from these standards
