/**
 * SubNavigation - Standard secondary navigation for sub-pages
 * 
 * Replaces the inconsistent sidebar patterns across Customers, Marketing, Settings.
 * - Desktop: Vertical sidebar with collapsible option
 * - Mobile: Horizontal scrollable tabs OR collapsible sidebar
 */

import { useState, type ReactNode } from 'react'
import {
  Box,
  Flex,
  HStack,
  Icon,
  IconButton,
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
  Text,
  useBreakpointValue,
} from '@chakra-ui/react'
import { ChevronLeftIcon, ChevronRightIcon } from '@chakra-ui/icons'
import { spacing, semanticColor, radius, shadow, fontSize } from '../tokens'
import type { IconType } from 'react-icons'

export interface SubNavItem {
  /** Unique identifier */
  id: string
  /** Display label */
  label: string
  /** Icon component */
  icon?: IconType | React.ComponentType<any>
  /** Panel content */
  content: ReactNode
  /** Badge count (optional) */
  badge?: number
}

interface SubNavigationProps {
  /** Navigation items */
  items: SubNavItem[]
  /** Active item ID */
  activeId?: string
  /** On item change callback */
  onChange?: (itemId: string) => void
  /** Section title */
  title?: string
  /** Force desktop layout on mobile (not recommended) */
  forceDesktopLayout?: boolean
}

export function SubNavigation({
  items,
  activeId,
  onChange,
  title = 'Sections',
  forceDesktopLayout = false,
}: SubNavigationProps) {
  const [isPanelOpen, setIsPanelOpen] = useState(true)
  const isMobile = useBreakpointValue({ base: true, md: false })
  const useMobileLayout = !forceDesktopLayout && isMobile

  // Find active tab index
  const activeIndex = activeId ? items.findIndex((item) => item.id === activeId) : 0

  // Mobile Layout: Horizontal scrollable tabs
  if (useMobileLayout) {
    return (
      <Tabs
        index={activeIndex}
        onChange={(index) => {
          const item = items[index]
          if (item) onChange?.(item.id)
        }}
        isLazy
        variant="unstyled"
      >
        {/* Mobile Tab List - Horizontal Scroll */}
        <Box
          overflowX="auto"
          overflowY="hidden"
          mb={spacing[4]}
          pb={spacing[2]}
          css={{
            '&::-webkit-scrollbar': { height: '4px' },
            '&::-webkit-scrollbar-track': { background: 'transparent' },
            '&::-webkit-scrollbar-thumb': { background: '#CBD5E0', borderRadius: '2px' },
          }}
        >
          <TabList gap={spacing[2]} flexWrap="nowrap" borderBottom="none">
            {items.map((item) => (
              <Tab
                key={item.id}
                flexShrink={0}
                px={spacing[3]}
                py={spacing[2]}
                fontSize={fontSize.sm}
                fontWeight="600"
                borderRadius={radius.md}
                color={semanticColor.textMuted}
                bg={semanticColor.bgSurface}
                border="1px solid"
                borderColor={semanticColor.borderSubtle}
                _hover={{ bg: semanticColor.bgSubtle, color: semanticColor.textPrimary }}
                _selected={{
                  bg: semanticColor.bgSurface,
                  color: semanticColor.textPrimary,
                  borderColor: 'accent.500',
                  boxShadow: shadow.sm,
                }}
              >
                <HStack spacing={spacing[2]}>
                  {item.icon && <Icon as={item.icon} boxSize={4} />}
                  <Text>{item.label}</Text>
                  {item.badge && item.badge > 0 && (
                    <Box
                      as="span"
                      bg="accent.500"
                      color="white"
                      fontSize="xs"
                      fontWeight="bold"
                      px={spacing[2]}
                      py="2px"
                      borderRadius="full"
                      minW="20px"
                      textAlign="center"
                    >
                      {item.badge}
                    </Box>
                  )}
                </HStack>
              </Tab>
            ))}
          </TabList>
        </Box>

        {/* Mobile Content */}
        <TabPanels>
          {items.map((item) => (
            <TabPanel key={item.id} px={0} py={0}>
              {item.content}
            </TabPanel>
          ))}
        </TabPanels>
      </Tabs>
    )
  }

  // Desktop Layout: Vertical sidebar with collapsible option
  return (
    <Tabs
      index={activeIndex}
      onChange={(index) => {
        const item = items[index]
        if (item) onChange?.(item.id)
      }}
      isLazy
      variant="unstyled"
      orientation="vertical"
    >
      <Flex direction="row" gap={spacing[4]} align="flex-start">
        {/* Desktop Sidebar - Expanded */}
        {isPanelOpen ? (
          <Box
            position="sticky"
            top={16}
            alignSelf="flex-start"
            bg={semanticColor.bgSubtle}
            border="1px solid"
            borderColor={semanticColor.borderSubtle}
            borderRadius={radius.xl}
            p={spacing[3]}
            boxShadow={shadow.sm}
            minW="240px"
            maxW="240px"
            w="240px"
          >
            {/* Header */}
            <Flex align="center" justify="space-between" mb={spacing[2]}>
              <Text fontSize="xs" textTransform="uppercase" color={semanticColor.textMuted} letterSpacing="0.08em">
                {title}
              </Text>
              <IconButton
                aria-label={`Hide ${title.toLowerCase()} panel`}
                icon={<ChevronLeftIcon />}
                size="xs"
                variant="ghost"
                onClick={() => setIsPanelOpen(false)}
              />
            </Flex>

            {/* Tab List */}
            <TabList flexDirection="column" gap={spacing[1]}>
              {items.map((item) => (
                <Tab
                  key={item.id}
                  justifyContent="flex-start"
                  fontSize={fontSize.sm}
                  fontWeight="600"
                  borderRadius={radius.md}
                  color={semanticColor.textMuted}
                  px={spacing[3]}
                  py={spacing[2]}
                  _hover={{ bg: semanticColor.bgSurface, color: semanticColor.textPrimary }}
                  _selected={{ bg: semanticColor.bgSurface, color: semanticColor.textPrimary, boxShadow: shadow.sm }}
                >
                  <HStack spacing={spacing[2]} w="100%">
                    {item.icon && <Icon as={item.icon} boxSize={4} />}
                    <Text flex="1">{item.label}</Text>
                    {item.badge && item.badge > 0 && (
                      <Box
                        as="span"
                        bg="accent.500"
                        color="white"
                        fontSize="xs"
                        fontWeight="bold"
                        px={spacing[2]}
                        py="2px"
                        borderRadius="full"
                        minW="20px"
                        textAlign="center"
                      >
                        {item.badge}
                      </Box>
                    )}
                  </HStack>
                </Tab>
              ))}
            </TabList>
          </Box>
        ) : (
          /* Desktop Sidebar - Collapsed */
          <Box
            position="sticky"
            top={16}
            alignSelf="flex-start"
            bg={semanticColor.bgSubtle}
            border="1px solid"
            borderColor={semanticColor.borderSubtle}
            borderRadius={radius.xl}
            p={spacing[1]}
            boxShadow={shadow.sm}
          >
            <IconButton
              aria-label={`Show ${title.toLowerCase()} panel`}
              icon={<ChevronRightIcon />}
              size="xs"
              variant="ghost"
              onClick={() => setIsPanelOpen(true)}
            />
          </Box>
        )}

        {/* Desktop Content */}
        <TabPanels flex="1" pt={spacing[1]}>
          {items.map((item) => (
            <TabPanel key={item.id} px={0} py={0}>
              {item.content}
            </TabPanel>
          ))}
        </TabPanels>
      </Flex>
    </Tabs>
  )
}
