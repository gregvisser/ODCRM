/**
 * EmptyState - Standard empty state component
 * 
 * Consistent empty state UI across the application.
 */

import { Box, Heading, Text, VStack, Icon, Button } from '@chakra-ui/react'
import { spacing, fontSize, semanticColor } from '../tokens'
import type { IconType } from 'react-icons'

interface EmptyStateProps {
  /** Icon to display */
  icon?: IconType | React.ComponentType<any>
  /** Title */
  title: string
  /** Description */
  description?: string
  /** Action button */
  action?: {
    label: string
    onClick: () => void
    icon?: React.ReactElement
  }
  /** Minimum height */
  minH?: string
}

export function EmptyState({ icon, title, description, action, minH = '300px' }: EmptyStateProps) {
  return (
    <Box w="100%" minH={minH} display="flex" alignItems="center" justifyContent="center" py={spacing[8]}>
      <VStack spacing={spacing[4]} maxW="400px" textAlign="center">
        {icon && (
          <Box
            w="64px"
            h="64px"
            borderRadius="full"
            bg={semanticColor.bgSubtle}
            display="flex"
            alignItems="center"
            justifyContent="center"
          >
            <Icon as={icon} boxSize={8} color={semanticColor.textMuted} />
          </Box>
        )}
        <Heading size="md" color={semanticColor.textPrimary}>
          {title}
        </Heading>
        {description && (
          <Text fontSize={fontSize.sm} color={semanticColor.textSecondary}>
            {description}
          </Text>
        )}
        {action && (
          <Button
            onClick={action.onClick}
            leftIcon={action.icon}
            colorScheme="accent"
            size="md"
            mt={spacing[2]}
          >
            {action.label}
          </Button>
        )}
      </VStack>
    </Box>
  )
}
