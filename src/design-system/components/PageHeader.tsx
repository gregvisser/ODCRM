/**
 * PageHeader - Standard header for all pages
 * 
 * Provides consistent layout for page titles, descriptions, and actions.
 */

import { Box, Heading, Text, HStack, type HeadingProps } from '@chakra-ui/react'
import { spacing, fontSize, semanticColor } from '../tokens'

interface PageHeaderProps {
  /** Page title */
  title: string
  /** Optional description */
  description?: string
  /** Action buttons (rendered on right side) */
  actions?: React.ReactNode
  /** Additional content below title/description */
  children?: React.ReactNode
  /** Custom heading size */
  titleSize?: HeadingProps['size']
}

export function PageHeader({
  title,
  description,
  actions,
  children,
  titleSize = 'lg',
}: PageHeaderProps) {
  return (
    <Box mb={spacing[6]}>
      {/* Title + Actions Row */}
      <HStack justify="space-between" align="flex-start" mb={description ? spacing[2] : 0}>
        <Box flex="1">
          <Heading size={titleSize} color={semanticColor.textPrimary}>
            {title}
          </Heading>
        </Box>
        {actions && (
          <HStack spacing={spacing[2]} flexShrink={0}>
            {actions}
          </HStack>
        )}
      </HStack>

      {/* Description */}
      {description && (
        <Text fontSize={fontSize.sm} color={semanticColor.textSecondary}>
          {description}
        </Text>
      )}

      {/* Additional content */}
      {children && <Box mt={spacing[4]}>{children}</Box>}
    </Box>
  )
}
