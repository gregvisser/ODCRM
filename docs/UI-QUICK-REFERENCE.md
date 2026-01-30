# UI Design System - Quick Reference
**Version:** 2.0 | **Date:** 2026-01-30

---

## 🚀 Quick Start (30 Seconds)

```typescript
// 1. Import tokens and components
import { spacing, semanticColor, PageHeader, Card } from '../design-system'

// 2. Use tokens for all UI values
<Box p={spacing[4]} bg={semanticColor.bgSurface}>
  <Card>Content</Card>
</Box>

// 3. Never use hardcoded values
// ❌ <Box p="20px" bg="gray.50">
// ✅ <Box p={spacing[4]} bg={semanticColor.bgSubtle}>
```

---

## ❌ DON'T DO THIS

```typescript
// ❌ Hardcoded spacing
<Box p={5} mb={10} gap="24px" />

// ❌ Direct colors
<Box bg="gray.50" color="blue.600" />

// ❌ Hardcoded px values
<Box width="240px" height="auto" />

// ❌ Random z-index
<Box zIndex={9999} />

// ❌ Custom sidebar
<Box>{/* 200 lines of custom navigation */}</Box>
```

---

## ✅ DO THIS INSTEAD

```typescript
import { spacing, semanticColor, zIndex, SubNavigation } from '../design-system'

// ✅ Use tokens
<Box p={spacing[4]} mb={spacing[6]} gap={spacing[6]} />

// ✅ Use semantic colors
<Box bg={semanticColor.bgSubtle} color={semanticColor.textPrimary} />

// ✅ Use layout constants
<Box maxW={layout.maxContentWidth} />

// ✅ Use z-index scale
<Box zIndex={zIndex.modal} />

// ✅ Use SubNavigation
<SubNavigation items={navItems} />
```

---

## 📏 Common Patterns

### Spacing
```typescript
import { spacing } from '../design-system'

// Compact card padding
<Card p={spacing[3]}>

// Normal section spacing
<VStack spacing={spacing[4]}>

// Major section gaps
<Box mb={spacing[8]}>
```

### Colors
```typescript
import { semanticColor } from '../design-system'

// Page background
<Box bg={semanticColor.bgCanvas}>

// Card background
<Box bg={semanticColor.bgSurface}>

// Sidebar background
<Box bg={semanticColor.bgSubtle}>

// Text colors
<Text color={semanticColor.textPrimary}>Main</Text>
<Text color={semanticColor.textMuted}>Muted</Text>
```

### Typography
```typescript
import { fontSize } from '../design-system'

// Labels
<Text fontSize={fontSize.xs}>Label</Text>

// Body text
<Text fontSize={fontSize.sm}>Body</Text>

// Headings
<Heading size="sm">Section</Heading>
<Heading size="md">Page</Heading>
```

### Components
```typescript
import { PageHeader, Card, LoadingState } from '../design-system'

// Page header with actions
<PageHeader
  title="Customers"
  description="Manage your customers"
  actions={<Button>Add Customer</Button>}
/>

// Card
<Card variant="elevated">
  Content
</Card>

// Loading
{loading && <LoadingState message="Loading..." />}
```

---

## 🏗️ Page Structure Template

```typescript
import {
  PageContainer,
  PageHeader,
  Card,
  LoadingState,
  EmptyState,
  spacing,
} from '../design-system'

export default function MyPage() {
  const { data, loading } = useData()

  return (
    <PageContainer>
      <PageHeader
        title="My Page"
        description="Page description"
        actions={<Button>Action</Button>}
      />

      {loading && <LoadingState />}

      {!loading && data.length === 0 && (
        <EmptyState
          title="No data"
          description="Get started by adding something"
          action={{ label: 'Add', onClick: handleAdd }}
        />
      )}

      {!loading && data.length > 0 && (
        <Card>
          {/* Your content */}
        </Card>
      )}
    </PageContainer>
  )
}
```

---

## 📱 Responsive Pattern

```typescript
import { spacing } from '../design-system'

<Box
  // Mobile-first responsive values
  p={{ base: spacing[3], md: spacing[4], lg: spacing[6] }}
  fontSize={{ base: fontSize.sm, md: fontSize.md }}
  flexDirection={{ base: 'column', md: 'row' }}
>
  Content
</Box>
```

---

## 🧭 Navigation Pattern

```typescript
import { SubNavigation, type SubNavItem } from '../design-system'
import { ViewIcon, EmailIcon } from '@chakra-ui/icons'

const navItems: SubNavItem[] = [
  {
    id: 'tab1',
    label: 'Tab 1',
    icon: ViewIcon,
    content: <Tab1Component />,
  },
  {
    id: 'tab2',
    label: 'Tab 2',
    icon: EmailIcon,
    content: <Tab2Component />,
    badge: 5, // Optional notification badge
  },
]

export default function MyPage() {
  const [activeId, setActiveId] = useState('tab1')

  return (
    <SubNavigation
      items={navItems}
      activeId={activeId}
      onChange={setActiveId}
      title="My Section"
    />
  )
}
```

---

## 📝 Form Pattern

```typescript
import { VStack, FormControl, FormLabel, Input, Button } from '@chakra-ui/react'
import { spacing } from '../design-system'

<VStack spacing={spacing[4]} align="stretch">
  <FormControl isRequired>
    <FormLabel>Name</FormLabel>
    <Input placeholder="Enter name" />
  </FormControl>

  <FormControl>
    <FormLabel>Email</FormLabel>
    <Input type="email" placeholder="Enter email" />
  </FormControl>

  <HStack spacing={spacing[3]} justify="flex-end" mt={spacing[6]}>
    <Button variant="outline" onClick={onCancel}>
      Cancel
    </Button>
    <Button type="submit">Save</Button>
  </HStack>
</VStack>
```

---

## 📊 Table Pattern

```typescript
import { DataTable, type DataTableColumn } from '../components/DataTable'

const columns: DataTableColumn<Customer>[] = [
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
  },
]

<DataTable
  data={customers}
  columns={columns}
  tableId="customers-table"
  enableSorting
  enableFiltering
  enablePagination
  enableExport
  compact
  loading={loading}
/>
```

---

## 💾 Available Tokens

### Spacing
```typescript
spacing[1]  // 4px   - Minimal
spacing[2]  // 8px   - Tight
spacing[3]  // 12px  - Compact (DEFAULT)
spacing[4]  // 16px  - Normal
spacing[6]  // 24px  - Loose
spacing[8]  // 32px  - Section
```

### Colors
```typescript
semanticColor.bgCanvas       // Page background
semanticColor.bgSurface      // Card background
semanticColor.bgSubtle       // Sidebar background
semanticColor.borderSubtle   // Borders
semanticColor.textPrimary    // Main text
semanticColor.textMuted      // Muted text
```

### Sizes
```typescript
fontSize.xs    // 12px - Labels
fontSize.sm    // 14px - Body (DEFAULT)
fontSize.md    // 16px - Inputs
fontSize.lg    // 18px - Section headings

iconSize.sm    // 16px
iconSize.md    // 20px (DEFAULT)
iconSize.lg    // 24px
```

### Z-Index
```typescript
zIndex.base      // 0
zIndex.dropdown  // 10
zIndex.sticky    // 50
zIndex.modal     // 1000
```

---

## ✅ Pre-Commit Checklist

Before committing, verify:

- [ ] No hardcoded spacing (use `spacing[n]`)
- [ ] No direct colors (use `semanticColor.*`)
- [ ] No hardcoded px/rem values
- [ ] No inline styles
- [ ] Mobile tested (375px width)
- [ ] Build passes (`npm run build`)
- [ ] All components use design system

---

## 🆘 Common Issues

### "My spacing looks wrong"
✅ Use `spacing[3]` for compact, `spacing[4]` for normal, `spacing[6]` for loose

### "I need a custom color"
✅ Use `semanticColor.*` tokens, or for status use Chakra colorScheme: `<Badge colorScheme="green">`

### "My navigation is complex"
✅ Use `SubNavigation` component - handles mobile/desktop automatically

### "I need a loading state"
✅ Use `<LoadingState message="Loading..." />`

### "Build fails with token errors"
✅ Import from `'../design-system'` or `'../../design-system'` depending on file location

---

## 📚 Full Documentation

- **Guidelines:** `docs/UI-GUIDELINES.md` (800 lines)
- **Audit Report:** `docs/UI-AUDIT-REPORT.md` (700 lines)
- **Progress:** `docs/UI-REFACTOR-PROGRESS.md` (400 lines)
- **Session Summary:** `docs/UI-REFACTOR-SESSION-1-SUMMARY.md`

---

## 🎯 Remember

1. **Always use tokens** - No hardcoded values
2. **Use components** - Don't reinvent patterns
3. **Test mobile** - 375px minimum width
4. **Follow examples** - See refactored pages
5. **When in doubt** - Read UI-GUIDELINES.md

---

**Keep this handy! Bookmark this file.** 📖
