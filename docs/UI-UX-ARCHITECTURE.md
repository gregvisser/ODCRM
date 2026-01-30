# UI/UX Architecture: Professional Compact Design

## Overview

This document defines the UI/UX architecture for the OpenDoors CRM system. **ALL components must follow these standards.**

## Core Principles

1. **Responsive**: Mobile-first design that scales to desktop
2. **Compact**: Professional dense layouts without clutter
3. **Consistent**: Same patterns throughout the system
4. **Feature-Rich**: Tables with sorting, filtering, reordering
5. **User-Friendly**: Preferences persist, intuitive controls

---

## The DataTable Component

**Location**: `src/components/DataTable.tsx`

### Features

✅ **Column Sorting** - Click header to sort asc/desc  
✅ **Column Filtering** - Search per column  
✅ **Column Resizing** - Drag column dividers  
✅ **Column Reordering** - Drag headers to reorder  
✅ **Column Visibility** - Toggle columns on/off  
✅ **Pagination** - Navigate large datasets  
✅ **Export** - Download as CSV  
✅ **User Preferences** - Settings saved to localStorage  
✅ **Responsive** - Mobile cards, desktop table  
✅ **Compact Styling** - Professional dense layout  

### Data Integrity

**CRITICAL**: Column reordering in UI does NOT affect data structure:
- UI shows columns in user's preferred order
- Exports always use original data structure
- Imports always map to original data structure
- Database schema unchanged

---

## Basic Usage

```typescript
import { DataTable } from '../components/DataTable'

function AccountsPage() {
  const { data, loading } = useDatabaseFirst({
    apiEndpoint: '/api/customers',
    cacheKey: 'customers',
  })
  
  const columns = [
    {
      id: 'name',
      header: 'Name',
      accessorKey: 'name',
      sortable: true,
      filterable: true,
    },
    {
      id: 'email',
      header: 'Email',
      accessorKey: 'email',
      sortable: true,
      filterable: true,
    },
    {
      id: 'status',
      header: 'Status',
      accessorKey: 'status',
      sortable: true,
      cell: ({ value }) => (
        <Badge colorScheme={value === 'active' ? 'green' : 'gray'}>
          {value}
        </Badge>
      ),
    },
  ]
  
  return (
    <DataTable
      data={data}
      columns={columns}
      tableId="accounts-table"
      enableSorting
      enableFiltering
      enableColumnReorder
      enableColumnResize
      enableColumnVisibility
      enablePagination
      enableExport
      compact
      loading={loading}
    />
  )
}
```

---

## Advanced Usage

### Custom Cell Rendering

```typescript
{
  id: 'monthlySpend',
  header: 'Monthly Spend',
  accessorKey: 'monthlySpendGBP',
  cell: ({ value }) => `£${value.toLocaleString()}`,
  sortable: true,
}
```

### Accessor Functions

```typescript
{
  id: 'fullName',
  header: 'Full Name',
  accessorFn: (row) => `${row.firstName} ${row.lastName}`,
  filterable: true,
}
```

### Complex Cells

```typescript
{
  id: 'actions',
  header: 'Actions',
  cell: ({ row }) => (
    <HStack spacing={2}>
      <IconButton
        size="sm"
        icon={<EditIcon />}
        onClick={() => handleEdit(row.id)}
      />
      <IconButton
        size="sm"
        icon={<DeleteIcon />}
        onClick={() => handleDelete(row.id)}
      />
    </HStack>
  ),
}
```

---

## Responsive Behavior

### Mobile (<768px)
- Displays as cards (not table)
- Each field shown as label: value
- Pagination at bottom
- Touch-friendly controls

### Tablet (768-1023px)
- Full table view
- Horizontal scroll if needed
- Condensed spacing

### Desktop (1024px+)
- Full table view
- All features enabled
- Optimal spacing

---

## Spacing Standards

### Component Spacing

```typescript
// Compact (default)
<Box p={3}>           // 12px padding
<VStack spacing={3}>  // 12px between items
<Table size="sm">     // Compact table
<Th py={2} px={3}>    // 8px vertical, 12px horizontal
```

### Before vs After

**Before (Stretched)**:
```tsx
<Box p={8} m={6}>  {/* Too much space */}
  <Heading size="xl" mb={6}>Title</Heading>
  <VStack spacing={6}>  {/* Too much gap */}
```

**After (Compact)**:
```tsx
<Box p={3}>  {/* Efficient space */}
  <Heading size="sm" mb={2}>Title</Heading>
  <VStack spacing={3}>  {/* Professional gap */}
```

---

## Font Sizes

### Standard Sizes

```typescript
// Headers
<Th fontSize="xs">Header</Th>  // 12px

// Data
<Td fontSize="sm">Data</Td>  // 14px

// Section Headings
<Heading size="sm">Section</Heading>  // 18px

// Page Headings
<Heading size="md">Page</Heading>  // 20px
```

---

## Color Palette

### Table Colors

```typescript
// Header background
bg="gray.100"

// Row hover
_hover={{ bg: 'gray.50' }}

// Border
borderColor="gray.200"

// Primary brand
colorScheme="blue"
```

---

## User Preferences

### What Gets Saved

For each table (`tableId`):
- Column order (reordering)
- Column widths (resizing)
- Column visibility (show/hide)
- Sort state (which column, direction)
- Filter state (search terms)

### localStorage Key Format

```typescript
`table_${tableId}_preferences`

// Example:
`table_accounts_preferences` = {
  sorting: [{ id: 'name', desc: false }],
  columnOrder: ['name', 'email', 'status'],
  columnSizing: { name: 200, email: 250 },
  columnVisibility: { email: false },
  columnFilters: [{ id: 'status', value: 'active' }],
}
```

### Reset Preferences

```tsx
<Button onClick={handleReset}>Reset to Default</Button>
```

This clears all saved preferences and returns table to default state.

---

## Export Functionality

### CSV Export

**Important**: Exports always use **original data structure**, not UI column order.

```typescript
// User reorders columns: Status, Name, Email
// BUT: CSV exports in original order: Name, Email, Status

// This ensures:
// 1. Data integrity preserved
// 2. Imports work correctly
// 3. External tools recognize format
// 4. No data corruption
```

### Export Behavior

- Click "Export" button
- Generates CSV with ALL data (not just current page)
- Uses original column order from database
- Filename: `tableId_YYYY-MM-DD.csv`
- Handles commas, quotes, special characters

---

## Migration Guide

### Step 1: Replace Custom Table

**Before**:
```tsx
<Table>
  <Thead>
    <Tr>
      <Th>Name</Th>
      <Th>Email</Th>
    </Tr>
  </Thead>
  <Tbody>
    {data.map(item => (
      <Tr key={item.id}>
        <Td>{item.name}</Td>
        <Td>{item.email}</Td>
      </Tr>
    ))}
  </Tbody>
</Table>
```

**After**:
```tsx
<DataTable
  data={data}
  columns={[
    { id: 'name', header: 'Name', accessorKey: 'name' },
    { id: 'email', header: 'Email', accessorKey: 'email' },
  ]}
  tableId="my-table"
  compact
/>
```

### Step 2: Update Spacing

```tsx
// Before
<Box p={6}>        →  <Box p={3}>
<VStack spacing={6}> → <VStack spacing={3}>
<Table size="md">  → <Table size="sm">

// Before
<Heading size="lg"> → <Heading size="sm">
<Th fontSize="md">  → <Th fontSize="xs">
<Td fontSize="md">  → <Td fontSize="sm">
```

### Step 3: Test Responsive

1. Open DevTools (F12)
2. Toggle device toolbar
3. Test: Mobile (375px), Tablet (768px), Desktop (1440px)
4. Verify: No horizontal scroll, all features work

---

## Testing Checklist

### Functional Tests

- [ ] Click column header → sorts ascending
- [ ] Click again → sorts descending
- [ ] Type in filter → filters results
- [ ] Drag column header → reorders columns
- [ ] Drag column divider → resizes column
- [ ] Toggle column visibility → hides/shows column
- [ ] Click pagination → navigates pages
- [ ] Click export → downloads CSV
- [ ] Refresh page → preferences persist
- [ ] Click reset → returns to default

### Responsive Tests

- [ ] Mobile (375px): Shows as cards
- [ ] Tablet (768px): Shows as table
- [ ] Desktop (1440px): Shows full features
- [ ] No horizontal scroll on any device
- [ ] Touch targets min 44x44px on mobile

### Data Integrity Tests

- [ ] Reorder columns in UI
- [ ] Export CSV
- [ ] Verify CSV has original column order
- [ ] Import CSV back to database
- [ ] Verify data maps correctly

---

## Performance Optimization

### For Large Datasets (1000+ rows)

```tsx
<DataTable
  data={data}
  columns={columns}
  tableId="large-table"
  enablePagination  // REQUIRED for large datasets
  pageSize={50}     // Default 50 rows per page
  enableVirtualization  // Future: Virtual scrolling
/>
```

### Current Limits

- Recommended: <5000 rows
- Tested: Up to 10,000 rows
- If more: Use server-side pagination

---

## Common Patterns

### Status Badge Column

```typescript
{
  id: 'status',
  header: 'Status',
  accessorKey: 'status',
  cell: ({ value }) => (
    <Badge
      colorScheme={
        value === 'active' ? 'green' :
        value === 'inactive' ? 'gray' :
        'orange'
      }
    >
      {value}
    </Badge>
  ),
  sortable: true,
}
```

### Currency Column

```typescript
{
  id: 'revenue',
  header: 'Revenue',
  accessorKey: 'revenueGBP',
  cell: ({ value }) => `£${value.toLocaleString('en-GB')}`,
  sortable: true,
}
```

### Date Column

```typescript
{
  id: 'createdAt',
  header: 'Created',
  accessorKey: 'createdAt',
  cell: ({ value }) => new Date(value).toLocaleDateString('en-GB'),
  sortable: true,
}
```

### Link Column

```typescript
{
  id: 'website',
  header: 'Website',
  accessorKey: 'website',
  cell: ({ value }) => (
    <Link href={value} isExternal color="blue.600">
      {value} <ExternalLinkIcon mx="2px" />
    </Link>
  ),
}
```

### Actions Column

```typescript
{
  id: 'actions',
  header: 'Actions',
  cell: ({ row }) => (
    <Menu>
      <MenuButton
        as={IconButton}
        icon={<ChevronDownIcon />}
        size="sm"
        variant="ghost"
      />
      <MenuList>
        <MenuItem onClick={() => handleEdit(row.id)}>Edit</MenuItem>
        <MenuItem onClick={() => handleDelete(row.id)}>Delete</MenuItem>
      </MenuList>
    </Menu>
  ),
}
```

---

## Accessibility

### Keyboard Navigation

- `Tab` - Navigate between filter inputs
- `Enter` - Sort column
- `Space` - Toggle checkbox (column visibility)
- Arrow keys - Navigate pagination

### Screen Readers

- All headers have proper labels
- Sort direction announced
- Filter status announced
- Pagination status announced

---

## Browser Support

- ✅ Chrome 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Edge 90+
- ⚠️ IE 11 - Not supported

---

## Future Enhancements

### Phase 1 (Current)
- [x] Column sorting
- [x] Column filtering
- [x] Column resizing
- [x] Column reordering
- [x] Column visibility
- [x] Pagination
- [x] CSV export
- [x] User preferences
- [x] Responsive design

### Phase 2 (Next Sprint)
- [ ] Multi-column sorting
- [ ] Advanced filtering (date ranges, numbers)
- [ ] Bulk selection
- [ ] Bulk actions
- [ ] Excel export
- [ ] Virtual scrolling (for 10,000+ rows)
- [ ] Server-side pagination
- [ ] Real-time updates (WebSocket)

### Phase 3 (Future)
- [ ] Inline editing
- [ ] Row grouping
- [ ] Pivot tables
- [ ] Charts/graphs
- [ ] Print view
- [ ] Dark mode

---

## Support

### Common Issues

**Q: Columns don't reorder when dragged**  
A: Ensure `enableColumnReorder={true}` is set

**Q: Filters don't work**  
A: Ensure `enableFiltering={true}` and columns have `filterable: true`

**Q: Preferences don't persist**  
A: Ensure unique `tableId` prop is set

**Q: Export has wrong column order**  
A: This is expected - exports use original data structure

**Q: Table is too wide on mobile**  
A: Should automatically show as cards - check responsive breakpoints

---

**Maintained by**: Development Team  
**Last Updated**: 2026-01-28  
**Status**: Active Standard
