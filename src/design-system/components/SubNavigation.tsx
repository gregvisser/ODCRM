/**
 * SubNavigation - Standard secondary navigation for sub-pages
 *
 * Replaces the inconsistent sidebar patterns across Customers, Marketing, Settings.
 * - Desktop: Vertical sidebar with collapsible option
 * - Mobile: Horizontal scrollable tabs OR collapsible sidebar
 *
 * NOTE: Drag-and-drop reordering removed to avoid @dnd-kit module-init TDZ crash
 * in the marketing chunk. If drag-and-drop is needed again, isolate @dnd-kit into
 * a lazy-loaded sub-component to prevent the circular-init issue.
 */

import React, { useEffect, useState, type ReactNode } from 'react'
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
  /** Sort order (for persistence) */
  sortOrder?: number
}

interface SubNavigationProps {
  /** Navigation items */
  items: SubNavItem[]
  /** Active item ID */
  activeId?: string
  /** On item change callback */
  onChange?: (itemId: string) => void
  /** On reorder callback (kept for API compatibility, no-op without DnD) */
  onReorder?: (items: SubNavItem[]) => void
  /** Section title */
  title?: string
  /** Force desktop layout on mobile (not recommended) */
  forceDesktopLayout?: boolean
  /** Enable drag and drop reordering — currently disabled, kept for API compatibility */
  enableDragDrop?: boolean
  /** Show runtime nav diagnostics when explicitly enabled */
  debugEnabled?: boolean
}

export function SubNavigation({
  items,
  activeId,
  onChange,
  title = 'Sections',
  forceDesktopLayout = false,
  debugEnabled = false,
}: SubNavigationProps) {
  const [isPanelOpen, setIsPanelOpen] = useState(true)
  const isMobile = useBreakpointValue({ base: true, md: false })
  const useMobileLayout = !forceDesktopLayout && isMobile

  const activeIndex = activeId ? items.findIndex((item) => item.id === activeId) : 0
  const itemIds = items.map((item) => item.id)
  const itemLabels = items.map((item) => item.label)
  const includesReports = items.some((item) => item.id === 'reports')

  useEffect(() => {
    if (!debugEnabled) return
    console.info('[MarketingNavDebug] SubNavigation runtime state', {
      title,
      useMobileLayout,
      isPanelOpen,
      activeId: activeId ?? null,
      activeIndex,
      itemIds,
      itemLabels,
      includesReports,
    })
  }, [activeId, activeIndex, debugEnabled, includesReports, isPanelOpen, itemIds, itemLabels, title, useMobileLayout])

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
        lazyBehavior="unmount"
        variant="unstyled"
      >
        {debugEnabled ? (
          <Box
            mb={spacing[3]}
            p={spacing[3]}
            border="1px solid"
            borderColor="yellow.200"
            borderRadius={radius.md}
            bg="yellow.50"
            data-testid="subnav-debug-panel"
          >
            <Text fontSize="sm" fontWeight="700" mb={spacing[1]}>SubNavigation debug</Text>
            <Text fontSize="sm">layout: mobile</Text>
            <Text fontSize="sm">collapsed: false</Text>
            <Text fontSize="sm">activeId: {activeId ?? '(none)'}</Text>
            <Text fontSize="sm">activeIndex: {String(activeIndex)}</Text>
            <Text fontSize="sm">itemIds: {itemIds.join(', ')}</Text>
            <Text fontSize="sm">itemLabels: {itemLabels.join(' | ')}</Text>
            <Text fontSize="sm">includesReports: {includesReports ? 'true' : 'false'}</Text>
          </Box>
        ) : null}
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
      lazyBehavior="unmount"
      variant="unstyled"
      orientation="vertical"
    >
      {debugEnabled ? (
        <Box
          mb={spacing[3]}
          p={spacing[3]}
          border="1px solid"
          borderColor="yellow.200"
          borderRadius={radius.md}
          bg="yellow.50"
          data-testid="subnav-debug-panel"
        >
          <Text fontSize="sm" fontWeight="700" mb={spacing[1]}>SubNavigation debug</Text>
          <Text fontSize="sm">layout: desktop</Text>
          <Text fontSize="sm">collapsed: {isPanelOpen ? 'false' : 'true'}</Text>
          <Text fontSize="sm">activeId: {activeId ?? '(none)'}</Text>
          <Text fontSize="sm">activeIndex: {String(activeIndex)}</Text>
          <Text fontSize="sm">itemIds: {itemIds.join(', ')}</Text>
          <Text fontSize="sm">itemLabels: {itemLabels.join(' | ')}</Text>
          <Text fontSize="sm">includesReports: {includesReports ? 'true' : 'false'}</Text>
        </Box>
      ) : null}
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
            minW="200px"
            maxW="200px"
            w="200px"
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
                  cursor="pointer"
                  _hover={{ bg: semanticColor.bgSurface, color: semanticColor.textPrimary }}
                  _selected={{ bg: semanticColor.bgSurface, color: semanticColor.textPrimary, boxShadow: shadow.sm }}
                  onClick={() => onChange?.(item.id)}
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
