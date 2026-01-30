/**
 * LoadingState - Standard loading indicator
 * 
 * Consistent loading UI across the application.
 */

import { Box, Spinner, Text, VStack } from '@chakra-ui/react'
import { spacing, fontSize, semanticColor } from '../tokens'

interface LoadingStateProps {
  /** Loading message */
  message?: string
  /** Spinner size */
  size?: 'sm' | 'md' | 'lg' | 'xl'
  /** Minimum height */
  minH?: string
}

export function LoadingState({ message = 'Loading...', size = 'lg', minH = '200px' }: LoadingStateProps) {
  return (
    <Box w="100%" minH={minH} display="flex" alignItems="center" justifyContent="center">
      <VStack spacing={spacing[4]}>
        <Spinner size={size} color={semanticColor.accentPrimary} thickness="3px" speed="0.8s" />
        {message && (
          <Text fontSize={fontSize.sm} color={semanticColor.textMuted}>
            {message}
          </Text>
        )}
      </VStack>
    </Box>
  )
}
