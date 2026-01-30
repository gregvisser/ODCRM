# UI/UX Guidelines - OpenDoors CRM
**Version:** 2.0
**Last Updated:** 2026-01-30
**Status:** MANDATORY - All code must follow these guidelines

---

## 🎯 Mission Statement

Create a **compact, professional, mobile-first** SaaS UI that is:
- Consistent across all pages
- Easy to use on mobile AND desktop
- Maintainable by enforcing reusable components
- Future-proof with clear patterns and guardrails

---

## 📐 Design System Location

All design tokens and components live in:
```
src/design-system/
  ├── tokens.ts              # All spacing, colors, sizes
  ├── components/
  │   ├── PageContainer.tsx  # Max-width page wrapper
  │   ├── PageHeader.tsx     # Standard page header
  │   ├── SubNavigation.tsx  # Secondary navigation
  │   ├── Card.tsx           # Standard card component
  │   ├── LoadingState.tsx   # Loading spinner
  │   └── EmptyState.tsx     # Empty state UI
  └── index.ts               # Export all
```

**Import from design system:**
```typescript
import { spacing, semanticColor, PageHeader, Card } from '../design-system'
```

---

## 🚫 PROHIBITED Patterns

### ❌ DO NOT DO THIS:

```typescript
// ❌ Hardcoded spacing
<Box p={5} mb={10} gap="24px">

// ❌ Direct color references
<Box bg="gray.50" color="blue.600">

// ❌ Hardcoded px/rem values
<Box width="240px" height="auto">

// ❌ Inconsistent font sizes
<Text fontSize="15px">

// ❌ Random z-index values
<Box zIndex={9999}>

// ❌ Custom navigation sidebars
<Box>{/* custom sidebar code */}</Box>

// ❌ Custom loading spinners
{loading && <Spinner />}

// ❌ Inline style objects
<Box style={{ padding: '20px' }}>
```

### ✅ DO THIS INSTEAD:

```typescript
// ✅ Use tokens
import { spacing } from '../design-system'
<Box p={spacing[4]} mb={spacing[6]} gap={spacing[6]}>

// ✅ Use semantic colors
import { semanticColor } from '../design-system'
<Box bg={semanticColor.bgSurface} color={semanticColor.textPrimary}>

// ✅ Use layout constants
import { layout } from '../design-system'
<Box maxW={layout.maxContentWidth}>

// ✅ Use typography tokens
import { fontSize } from '../design-system'
<Text fontSize={fontSize.sm}>

// ✅ Use z-index scale
import { zIndex } from '../design-system'
<Box zIndex={zIndex.modal}>

// ✅ Use SubNavigation component
import { SubNavigation } from '../design-system'
<SubNavigation items={navItems} />

// ✅ Use LoadingState component
import { LoadingState } from '../design-system'
{loading && <LoadingState message="Loading..." />}

// ✅ Use Chakra props
<Box p={spacing[4]}>
```

---

## 📏 Spacing Scale

**ONLY use these values:**

```typescript
import { spacing } from '../design-system'

spacing[1]  // 4px  - Minimal spacing
spacing[2]  // 8px  - Tight spacing
spacing[3]  // 12px - Compact spacing (DEFAULT for compact UI)
spacing[4]  // 16px - Normal spacing
spacing[5]  // 20px - Comfortable spacing
spacing[6]  // 24px - Loose spacing
spacing[8]  // 32px - Section spacing
spacing[12] // 48px - Major section spacing
spacing[16] // 64px - Large section spacing
```

**Usage Examples:**
```typescript
// Card padding (compact)
<Card p={spacing[3]}>

// Card padding (comfortable)
<Card p={spacing[4]}>

// Section spacing
<VStack spacing={spacing[6]}>

// Major sections
<Box mb={spacing[8]}>

// Form field spacing
<FormControl mb={spacing[4]}>
```

---

## 🎨 Color Usage

**ONLY use semantic tokens:**

```typescript
import { semanticColor } from '../design-system'

// Backgrounds
bg={semanticColor.bgCanvas}    // Page background
bg={semanticColor.bgSurface}   // Card/panel background
bg={semanticColor.bgSubtle}    // Sidebar/alternate background

// Borders
borderColor={semanticColor.borderSubtle}

// Text
color={semanticColor.textPrimary}    // Main text
color={semanticColor.textSecondary}  // Less important text
color={semanticColor.textMuted}      // Muted text (labels, captions)

// Accent
color={semanticColor.accentPrimary}  // accent.500
color={semanticColor.accentHover}    // accent.600
color={semanticColor.accentActive}   // accent.700
```

**Exception:** Chakra color schemes for status colors:
```typescript
// ✅ OK for status colors
<Badge colorScheme="green">Active</Badge>
<Badge colorScheme="red">Inactive</Badge>
<Button colorScheme="blue">Submit</Button>
```

---

## 📝 Typography Scale

```typescript
import { fontSize, fontWeight } from '../design-system'

// Font Sizes
fontSize.xs    // 12px - Labels, captions
fontSize.sm    // 14px - Body text, table data
fontSize.md    // 16px - Body text, form inputs
fontSize.lg    // 18px - Section headings
fontSize.xl    // 20px - Page headings
fontSize['2xl'] // 24px - Major headings

// Font Weights
fontWeight.normal    // 400 - Body text
fontWeight.medium    // 500 - Slightly emphasized
fontWeight.semibold  // 600 - Headings, labels
fontWeight.bold      // 700 - Strong emphasis
```

**Heading Sizes:**
```typescript
<Heading size="sm">Section Heading</Heading>  // 18px
<Heading size="md">Page Heading</Heading>     // 20px
<Heading size="lg">Major Heading</Heading>    // 24px
```

---

## 📦 Component Sizes

```typescript
import { componentSize, iconSize } from '../design-system'

// Buttons & Inputs
<Button size={componentSize.sm}>Small</Button>    // 32px height
<Button size={componentSize.md}>Medium</Button>   // 40px height (DEFAULT)
<Button size={componentSize.lg}>Large</Button>    // 48px height

// Icons
<Icon boxSize={iconSize.sm} />  // 16px
<Icon boxSize={iconSize.md} />  // 20px (DEFAULT)
<Icon boxSize={iconSize.lg} />  // 24px
<Icon boxSize={iconSize.xl} />  // 32px
```

---

## 🔘 Border Radius

```typescript
import { radius } from '../design-system'

borderRadius={radius.sm}   // 4px - Buttons, badges
borderRadius={radius.md}   // 6px - Inputs, cards (DEFAULT)
borderRadius={radius.lg}   // 8px - Panels, modals
borderRadius={radius.xl}   // 12px - Major sections
borderRadius={radius.full} // 9999px - Pills, avatars
```

---

## 💫 Box Shadows

```typescript
import { shadow } from '../design-system'

boxShadow={shadow.sm}  // Subtle hover effects
boxShadow={shadow.md}  // Cards, dropdowns (DEFAULT)
boxShadow={shadow.lg}  // Modals, popovers
boxShadow={shadow.xl}  // Major overlays
```

---

## 🔢 Z-Index Scale

```typescript
import { zIndex } from '../design-system'

zIndex={zIndex.base}     // 0 - Base layer
zIndex={zIndex.dropdown} // 10 - Dropdown menus
zIndex={zIndex.sticky}   // 50 - Sticky headers
zIndex={zIndex.overlay}  // 500 - Overlays, backdrops
zIndex={zIndex.modal}    // 1000 - Modals, drawers
zIndex={zIndex.toast}    // 1500 - Toasts, tooltips
```

---

## 📱 Mobile-First Responsive Design

### Breakpoints

```typescript
import { breakpoint } from '../design-system'

base: '0px'     // Mobile
sm: '480px'     // Large mobile
md: '768px'     // Tablet
lg: '992px'     // Desktop
xl: '1280px'    // Large desktop
2xl: '1536px'   // Extra large
```

### Responsive Syntax

```typescript
// Mobile-first approach
<Box
  p={{ base: spacing[3], md: spacing[4], lg: spacing[6] }}
  fontSize={{ base: fontSize.sm, md: fontSize.md }}
>
  Content
</Box>
```

### Touch Targets (Mobile)

```typescript
import { touchTarget } from '../design-system'

// Minimum 44x44px for all interactive elements on mobile
<Button minH={touchTarget.minSize} minW={touchTarget.minSize}>
  Tap Me
</Button>
```

---

## 🏗️ Layout Components

### PageContainer

Wraps all page content with consistent max-width and padding:

```typescript
import { PageContainer } from '../design-system'

function MyPage() {
  return (
    <PageContainer>
      {/* Your content - automatically max-width and padded */}
    </PageContainer>
  )
}

// Narrow layout (forms, reading content)
<PageContainer narrow>
  <Form />
</PageContainer>
```

### PageHeader

Standard header for all pages:

```typescript
import { PageHeader } from '../design-system'

<PageHeader
  title="Customers"
  description="Manage your customer accounts"
  actions={
    <>
      <Button leftIcon={<AddIcon />}>Add Customer</Button>
      <Button variant="outline">Export</Button>
    </>
  }
/>
```

### SubNavigation

Secondary navigation for sub-pages:

```typescript
import { SubNavigation } from '../design-system'

const navItems = [
  {
    id: 'accounts',
    label: 'Accounts',
    icon: ViewIcon,
    content: <AccountsTab />,
  },
  {
    id: 'contacts',
    label: 'Contacts',
    icon: EmailIcon,
    content: <ContactsTab />,
  },
]

<SubNavigation
  items={navItems}
  activeId="accounts"
  onChange={(id) => handleNavChange(id)}
  title="Customers"
/>
```

### Card

Standard card component with variants:

```typescript
import { Card } from '../design-system'

// Default card
<Card>
  Content
</Card>

// Elevated card (no border, more shadow)
<Card variant="elevated">
  Content
</Card>

// Outlined card (transparent bg)
<Card variant="outlined">
  Content
</Card>

// Subtle card (subtle bg, no shadow)
<Card variant="subtle">
  Content
</Card>

// Interactive card (hover effect)
<Card interactive onClick={handleClick}>
  Click me
</Card>
```

---

## ⏳ Loading & Empty States

### LoadingState

```typescript
import { LoadingState } from '../design-system'

{loading && <LoadingState message="Loading customers..." />}

// Custom size
<LoadingState size="xl" minH="400px" />
```

### EmptyState

```typescript
import { EmptyState } from '../design-system'
import { AddIcon } from '@chakra-ui/icons'

<EmptyState
  icon={ViewIcon}
  title="No customers yet"
  description="Get started by adding your first customer"
  action={{
    label: 'Add Customer',
    onClick: handleAddCustomer,
    icon: <AddIcon />,
  }}
/>
```

---

## 📊 Tables

**ALL tables must use the DataTable component:**

```typescript
import { DataTable } from '../components/DataTable'

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
]

<DataTable
  data={customers}
  columns={columns}
  tableId="customers-table"
  enableSorting
  enableFiltering
  enableColumnReorder
  enablePagination
  enableExport
  compact
  loading={loading}
/>
```

---

## 📝 Forms

### Form Layout

```typescript
import { VStack, FormControl, FormLabel, Input, Textarea, Select } from '@chakra-ui/react'
import { spacing } from '../design-system'

<VStack spacing={spacing[4]} align="stretch">
  <FormControl isRequired>
    <FormLabel>Customer Name</FormLabel>
    <Input placeholder="Enter name" />
  </FormControl>

  <FormControl>
    <FormLabel>Description</FormLabel>
    <Textarea placeholder="Optional description" rows={4} />
  </FormControl>

  <FormControl>
    <FormLabel>Status</FormLabel>
    <Select>
      <option value="active">Active</option>
      <option value="inactive">Inactive</option>
    </Select>
  </FormControl>
</VStack>
```

### Form Actions

```typescript
<HStack spacing={spacing[3]} justify="flex-end" mt={spacing[6]}>
  <Button variant="outline" onClick={onCancel}>
    Cancel
  </Button>
  <Button type="submit" isLoading={submitting}>
    Save
  </Button>
</HStack>
```

---

## 🎭 Modals & Drawers

### Modal (Desktop + Mobile)

```typescript
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalCloseButton,
} from '@chakra-ui/react'

<Modal isOpen={isOpen} onClose={onClose} size={{ base: 'full', md: 'xl' }}>
  <ModalOverlay />
  <ModalContent>
    <ModalHeader>Add Customer</ModalHeader>
    <ModalCloseButton />
    <ModalBody>
      <CustomerForm />
    </ModalBody>
    <ModalFooter>
      <Button variant="outline" mr={3} onClick={onClose}>
        Cancel
      </Button>
      <Button onClick={handleSave}>Save</Button>
    </ModalFooter>
  </ModalContent>
</Modal>
```

### Drawer (Better for mobile forms)

```typescript
import {
  Drawer,
  DrawerOverlay,
  DrawerContent,
  DrawerHeader,
  DrawerBody,
  DrawerFooter,
  DrawerCloseButton,
} from '@chakra-ui/react'

<Drawer isOpen={isOpen} onClose={onClose} size={{ base: 'full', md: 'lg' }} placement="right">
  <DrawerOverlay />
  <DrawerContent>
    <DrawerHeader>Edit Customer</DrawerHeader>
    <DrawerCloseButton />
    <DrawerBody>
      <CustomerForm />
    </DrawerBody>
    <DrawerFooter>
      <Button variant="outline" mr={3} onClick={onClose}>
        Cancel
      </Button>
      <Button onClick={handleSave}>Save</Button>
    </DrawerFooter>
  </DrawerContent>
</Drawer>
```

---

## ✅ Code Review Checklist

Before submitting any UI code, verify:

- [ ] **No hardcoded spacing** - All use `spacing[n]` tokens
- [ ] **No direct colors** - All use `semanticColor.*` tokens
- [ ] **No hardcoded sizes** - All use tokens (componentSize, iconSize, etc.)
- [ ] **No inline styles** - Use Chakra props
- [ ] **Mobile tested** - Works on 375px width
- [ ] **Follows component pattern** - Uses design system components
- [ ] **No custom navigation** - Uses SubNavigation component
- [ ] **No custom loading** - Uses LoadingState/EmptyState components
- [ ] **Tables use DataTable** - No custom table implementations
- [ ] **Touch targets ≥ 44px** - On mobile
- [ ] **Z-index uses scale** - No random z-index values
- [ ] **Consistent typography** - Uses fontSize/fontWeight tokens

---

## 🛠️ Linting Rules (Future)

These will be enforced via ESLint:

```typescript
// ❌ Will fail lint
<Box p="20px" />           // Hardcoded value
<Box bg="gray.50" />       // Direct color
<Box style={{}} />         // Inline styles

// ✅ Will pass lint
<Box p={spacing[4]} />     // Token
<Box bg={semanticColor.bgSurface} /> // Semantic color
<Box p={spacing[4]} />     // Chakra props
```

---

## 📚 Learning Path

### New Developers

1. Read this document
2. Study `src/design-system/tokens.ts`
3. Look at example implementations:
   - `src/App.tsx` - App shell
   - `src/tabs/customers/CustomersHomePage.tsx` - SubNavigation usage
   - `src/tabs/settings/SettingsHomePage.tsx` - Minimal page
4. Follow the checklist above

### Existing Code Refactoring

When refactoring old code:

1. Replace hardcoded spacing with tokens
2. Replace direct colors with semantic tokens
3. Replace custom navigation with SubNavigation
4. Replace custom tables with DataTable
5. Replace custom loading with LoadingState/EmptyState
6. Test on mobile (375px width minimum)

---

## 🚀 Benefits of Following These Guidelines

1. **Consistency** - Every page looks and feels the same
2. **Mobile-friendly** - Touch targets, responsive layouts
3. **Maintainability** - Reusable components, single source of truth
4. **Accessibility** - Proper focus states, semantic colors
5. **Performance** - Less custom CSS, more Chakra optimization
6. **Themability** - Change colors/spacing in one place
7. **Developer velocity** - Less decisions, faster implementation
8. **Quality** - No more "it works on my screen" issues

---

## 📞 Questions?

- Design system location: `src/design-system/`
- Component examples: See refactored pages
- Issues or suggestions: Create a ticket

---

**Last Updated:** 2026-01-30
**Version:** 2.0
**Status:** MANDATORY - All new code must comply
