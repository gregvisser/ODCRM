import { useState, useEffect } from 'react'
import {
  Box,
  Button,
  Divider,
  Flex,
  HStack,
  Heading,
  IconButton,
  Icon,
  Text,
  VStack,
  useBreakpointValue,
  useDisclosure,
  Drawer,
  DrawerOverlay,
  DrawerContent,
  DrawerHeader,
  DrawerBody,
  DrawerCloseButton,
  Collapse,
} from '@chakra-ui/react'
import { MdBusiness, MdPeople, MdMenu, MdExpandMore, MdChevronRight, MdFolder, MdDragIndicator, MdSecurity, MdCampaign } from 'react-icons/md'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import AccountsTab from './components/AccountsTab'
import ContactsTab from './components/ContactsTab'
import UserAuthorizationTab from './components/UserAuthorizationTab'
import MarketingLeadsTab from './components/MarketingLeadsTab'
import './App.css'

type TabId = 'accounts' | 'contacts' | 'user-authorization' | 'marketing-leads'

interface Subcategory {
  id: string
  label: string
  icon: typeof MdBusiness
  tabId?: TabId
}

interface Category {
  id: string
  label: string
  subcategories: Subcategory[]
  isDisabled?: boolean
}

const defaultCategories: Category[] = [
  {
    id: 'customers',
    label: 'OpensDoors Customers',
    subcategories: [
      { id: 'accounts', label: 'OpensDoors Accounts', icon: MdBusiness, tabId: 'accounts' },
      { id: 'contacts', label: 'OpensDoors Contacts', icon: MdPeople, tabId: 'contacts' },
    ],
  },
  {
    id: 'sales',
    label: 'OpensDoors Sales',
    subcategories: [],
    isDisabled: true,
  },
  {
    id: 'marketing',
    label: 'OpensDoors Marketing',
    subcategories: [
      { id: 'marketing-leads', label: 'Marketing Leads', icon: MdCampaign, tabId: 'marketing-leads' },
    ],
    isDisabled: false,
  },
  {
    id: 'operations',
    label: 'Operations',
    subcategories: [
      { id: 'user-authorization', label: 'User Authorization', icon: MdSecurity, tabId: 'user-authorization' },
    ],
    isDisabled: false,
  },
  {
    id: 'onboarding',
    label: 'Onboarding',
    subcategories: [],
    isDisabled: true,
  },
]

// Load categories order from localStorage
const loadCategoriesOrder = (): Category[] => {
  try {
    const stored = localStorage.getItem('sidebar-categories-order')
    if (stored) {
      const order = JSON.parse(stored)
      // Reconstruct categories with their subcategories
      return order.map((catId: string) => {
        const category = defaultCategories.find((c) => c.id === catId)
        if (category) {
          // Load subcategory order for this category
          const subcatOrder = loadSubcategoriesOrder(catId)
          if (subcatOrder && subcatOrder.length > 0) {
            return {
              ...category,
              subcategories: subcatOrder.map((subId: string) =>
                category.subcategories.find((s) => s.id === subId)
              ).filter(Boolean) as Subcategory[],
            }
          }
        }
        return category
      }).filter(Boolean) as Category[]
    }
  } catch (error) {
    console.error('Error loading categories order:', error)
  }
  return defaultCategories
}

// Load subcategories order for a specific category
const loadSubcategoriesOrder = (categoryId: string): string[] | null => {
  try {
    const stored = localStorage.getItem(`sidebar-subcategories-order-${categoryId}`)
    if (stored) {
      return JSON.parse(stored)
    }
  } catch (error) {
    console.error(`Error loading subcategories order for ${categoryId}:`, error)
  }
  return null
}

// Save categories order to localStorage
const saveCategoriesOrder = (categories: Category[]) => {
  try {
    const order = categories.map((cat) => cat.id)
    localStorage.setItem('sidebar-categories-order', JSON.stringify(order))
  } catch (error) {
    console.error('Error saving categories order:', error)
  }
}

// Save subcategories order for a specific category
const saveSubcategoriesOrder = (categoryId: string, subcategories: Subcategory[]) => {
  try {
    const order = subcategories.map((sub) => sub.id)
    localStorage.setItem(`sidebar-subcategories-order-${categoryId}`, JSON.stringify(order))
  } catch (error) {
    console.error(`Error saving subcategories order for ${categoryId}:`, error)
  }
}

// Sortable Category Component
function SortableCategoryItem({
  category,
  isExpanded,
  onToggle,
  activeTab,
  onTabClick,
  isMobile,
  onClose,
  onSubcategoriesReorder,
}: {
  category: Category
  isExpanded: boolean
  onToggle: () => void
  activeTab: TabId
  onTabClick: (tabId: TabId) => void
  isMobile: boolean
  onClose: () => void
  onSubcategoriesReorder: (categoryId: string, newSubcategories: Subcategory[]) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: category.id,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <Box ref={setNodeRef} style={style}>
      <HStack spacing={2} align="center" w="100%">
        <Box
          {...attributes}
          {...listeners}
          cursor="grab"
          _active={{ cursor: 'grabbing' }}
          p={1}
          color="brand.400"
          _hover={{ color: 'brand.600' }}
          flexShrink={0}
        >
          <Icon as={MdDragIndicator} boxSize={4} />
        </Box>
        <Box flex="1" minW={0}>
          <Button
            justifyContent="flex-start"
            variant="ghost"
            bg="transparent"
            color="brand.800"
            _hover={{ bg: 'brand.100' }}
            onClick={onToggle}
            size="md"
            fontWeight="semibold"
            fontSize="sm"
            w="100%"
            px={3}
            isDisabled={category.isDisabled}
            opacity={category.isDisabled ? 0.6 : 1}
            overflow="hidden"
          >
            <HStack spacing={2} w="100%" minW={0} overflow="hidden">
              <Icon as={isExpanded ? MdExpandMore : MdChevronRight} boxSize={4} flexShrink={0} />
              <Icon as={MdFolder} boxSize={5} flexShrink={0} />
              <Text noOfLines={1} flex="1" minW={0} overflow="hidden" textOverflow="ellipsis" whiteSpace="nowrap">
                {category.label}
              </Text>
            </HStack>
          </Button>
        </Box>
      </HStack>

      <Collapse in={isExpanded} animateOpacity>
        <VStack align="stretch" spacing={1} pl={{ base: 4, md: 6 }} mt={1}>
          {category.subcategories.length > 0 ? (
            <SortableSubcategories
              subcategories={category.subcategories}
              activeTab={activeTab}
              onTabClick={onTabClick}
              isMobile={isMobile}
              onClose={onClose}
              categoryId={category.id}
              onSubcategoriesReorder={onSubcategoriesReorder}
            />
          ) : (
            <Text fontSize="xs" color="gray.400" fontStyle="italic" px={3} py={2}>
              Coming soon
            </Text>
          )}
        </VStack>
      </Collapse>
    </Box>
  )
}

// Wrapper for SortableCategory to work with SortableContext
const SortableCategory = SortableCategoryItem

// Sortable Subcategories Component
function SortableSubcategories({
  subcategories,
  activeTab,
  onTabClick,
  isMobile,
  onClose,
  categoryId,
  onSubcategoriesReorder,
}: {
  subcategories: Subcategory[]
  activeTab: TabId
  onTabClick: (tabId: TabId) => void
  isMobile: boolean
  onClose: () => void
  categoryId: string
  onSubcategoriesReorder: (categoryId: string, newSubcategories: Subcategory[]) => void
}) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    if (over && active.id !== over.id) {
      const oldIndex = subcategories.findIndex((sub) => sub.id === active.id)
      const newIndex = subcategories.findIndex((sub) => sub.id === over.id)
      const newSubcategories = arrayMove(subcategories, oldIndex, newIndex)
      saveSubcategoriesOrder(categoryId, newSubcategories)
      onSubcategoriesReorder(categoryId, newSubcategories)
    }
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={subcategories.map((s) => s.id)} strategy={verticalListSortingStrategy}>
        {subcategories.map((subcategory) => (
          <SortableSubcategory
            key={subcategory.id}
            subcategory={subcategory}
            activeTab={activeTab}
            onTabClick={onTabClick}
            isMobile={isMobile}
            onClose={onClose}
          />
        ))}
      </SortableContext>
    </DndContext>
  )
}

// Sortable Subcategory Component
function SortableSubcategory({
  subcategory,
  activeTab,
  onTabClick,
  isMobile,
  onClose,
}: {
  subcategory: Subcategory
  activeTab: TabId
  onTabClick: (tabId: TabId) => void
  isMobile: boolean
  onClose: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: subcategory.id,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const isActive = activeTab === subcategory.tabId

  return (
    <HStack spacing={2} align="center" ref={setNodeRef} style={style} w="100%">
      <Box
        {...attributes}
        {...listeners}
        cursor="grab"
        _active={{ cursor: 'grabbing' }}
        p={1}
        color="brand.400"
        _hover={{ color: 'brand.600' }}
        flexShrink={0}
      >
        <Icon as={MdDragIndicator} boxSize={3} />
      </Box>
      <Box flex="1" minW={0}>
        <Button
          justifyContent="flex-start"
          leftIcon={<Icon as={subcategory.icon} boxSize={5} />}
          variant={isActive ? 'solid' : 'ghost'}
          bg={isActive ? 'brand.600' : 'transparent'}
          color={isActive ? 'white' : 'brand.800'}
          _hover={{ bg: isActive ? 'brand.600' : 'brand.100' }}
          onClick={() => {
            if (subcategory.tabId) {
              onTabClick(subcategory.tabId)
            }
            if (isMobile) {
              onClose()
            }
          }}
          size="md"
          fontWeight="medium"
          fontSize="sm"
          w="100%"
          overflow="hidden"
          textAlign="left"
          whiteSpace="nowrap"
          textOverflow="ellipsis"
        >
          {subcategory.label}
        </Button>
      </Box>
    </HStack>
  )
}

function App() {
  const [activeTab, setActiveTab] = useState<TabId>('accounts')
  const [categories, setCategories] = useState<Category[]>(() => loadCategoriesOrder())
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({
    customers: true,
    sales: false,
    marketing: true,
    operations: false,
    onboarding: false,
  })
  const { isOpen, onOpen, onClose } = useDisclosure()
  const isMobile = useBreakpointValue({ base: true, md: false })

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // Listen for navigation to accounts tab
  useEffect(() => {
    const handleNavigateToAccount = () => {
      setActiveTab('accounts')
      if (isMobile) {
        onClose()
      }
    }

    window.addEventListener('navigateToAccount', handleNavigateToAccount as EventListener)

    return () => {
      window.removeEventListener('navigateToAccount', handleNavigateToAccount as EventListener)
    }
  }, [isMobile, onClose])

  const handleCategoryDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    if (over && active.id !== over.id) {
      setCategories((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id)
        const newIndex = items.findIndex((item) => item.id === over.id)
        const newCategories = arrayMove(items, oldIndex, newIndex)
        saveCategoriesOrder(newCategories)
        return newCategories
      })
    }
  }

  const handleSubcategoriesReorder = (categoryId: string, newSubcategories: Subcategory[]) => {
    setCategories((prev) =>
      prev.map((cat) => (cat.id === categoryId ? { ...cat, subcategories: newSubcategories } : cat))
    )
  }

  const toggleCategory = (categoryId: string) => {
    setExpandedCategories((prev) => ({
      ...prev,
      [categoryId]: !prev[categoryId],
    }))
  }

  const renderActiveTab = () => {
    switch (activeTab) {
      case 'accounts':
        return <AccountsTab />
      case 'contacts':
        return <ContactsTab />
      case 'user-authorization':
        return <UserAuthorizationTab />
      case 'marketing-leads':
        return <MarketingLeadsTab />
      default:
        return <AccountsTab />
    }
  }

  const Navigation = (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleCategoryDragEnd}>
      <SortableContext items={categories.map((cat) => cat.id)} strategy={verticalListSortingStrategy}>
        <VStack align="stretch" spacing={2} w="100%">
          {categories.map((category) => (
            <SortableCategory
              key={category.id}
              category={category}
              isExpanded={expandedCategories[category.id] || false}
              onToggle={() => toggleCategory(category.id)}
              activeTab={activeTab}
              onTabClick={setActiveTab}
              isMobile={isMobile || false}
              onClose={onClose}
              onSubcategoriesReorder={handleSubcategoriesReorder}
            />
          ))}
        </VStack>
      </SortableContext>
    </DndContext>
  )

  const SidebarContent = (
    <Flex
      w={{ base: '100%', md: '320px', lg: '360px' }}
      bg="white"
      borderRight={{ base: 'none', md: '1px solid' }}
      borderColor="brand.100"
      px={{ base: 4, md: 6 }}
      py={8}
      direction="column"
      gap={8}
      minH="100%"
      overflowY="auto"
    >
      <Box>
        <Heading size="xl" color="brand.800" fontWeight="bold" letterSpacing="wide">
          OpensDoors
        </Heading>
        <Text fontSize="sm" color="brand.400" mt={1}>
          Marketing command center
        </Text>
      </Box>

      {Navigation}

      <Box mt="auto">
        <Text fontSize="xs" color="brand.300">
          Live preview v0.2
        </Text>
      </Box>
    </Flex>
  )

  return (
    <Flex minH="100vh" bg="brand.50" direction={{ base: 'column', md: 'row' }}>
      <Box display={{ base: 'none', md: 'flex' }}>{SidebarContent}</Box>

      <Drawer isOpen={isOpen} placement="left" onClose={onClose} size="sm">
        <DrawerOverlay />
        <DrawerContent maxW="360px">
          <DrawerCloseButton />
          <DrawerHeader>
            <Heading size="lg" color="brand.800" fontWeight="bold" letterSpacing="wide">
              OpensDoors
            </Heading>
            <Text fontSize="sm" color="brand.400" mt={1}>
              Marketing command center
            </Text>
          </DrawerHeader>
          <DrawerBody px={4} pb={6}>
            {Navigation}
          </DrawerBody>
        </DrawerContent>
      </Drawer>

      <Box flex="1" p={{ base: 4, md: 6, lg: 10 }} overflowY="auto" w="100%" minW={0}>
        <Flex
          justify="space-between"
          align={{ base: 'flex-start', md: 'center' }}
          mb={6}
          direction={{ base: 'column', md: 'row' }}
          gap={4}
          position="relative"
          w="100%"
        >
          {isMobile && (
            <IconButton
              aria-label="Open navigation"
              icon={<MdMenu />}
              variant="ghost"
              onClick={onOpen}
              position="absolute"
              left={0}
              top={0}
              zIndex={1}
            />
          )}
          
          <Box 
            textAlign={{ base: 'left', md: 'center' }} 
            flex="1" 
            mx={{ base: 0, md: 8 }}
            pl={{ base: 10, md: 0 }}
            minW={0}
          >
            <Heading size="lg" color="brand.800" mb={2} noOfLines={2}>
              {activeTab === 'accounts' && 'OpensDoors Accounts'}
              {activeTab === 'contacts' && 'OpensDoors Contacts'}
              {activeTab === 'user-authorization' && 'User Authorization'}
              {activeTab === 'marketing-leads' && 'Marketing Leads'}
            </Heading>
            <Text color="brand.500" fontSize={{ base: 'sm', md: 'md' }}>
              {activeTab === 'accounts' &&
                'Accounts that OpensDoors supports for lead generation'}
              {activeTab === 'contacts' &&
                'Contacts tied to each OpensDoors account'}
              {activeTab === 'user-authorization' &&
                'Manage staff user accounts and authorization settings'}
              {activeTab === 'marketing-leads' &&
                'All leads from customer Google Sheets aggregated in one view'}
            </Text>
          </Box>
        </Flex>

        <Box
          bg="white"
          borderRadius="2xl"
          border="1px solid"
          borderColor="brand.100"
          p={{ base: 4, md: 6 }}
          boxShadow="sm"
          w="100%"
          minW={0}
          overflowX="auto"
        >
          {renderActiveTab()}
        </Box>
        <Divider mt={8} opacity={0} />
      </Box>
    </Flex>
  )
}

export default App
