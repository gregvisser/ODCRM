/**
 * PageContainer - Standard container for all page content
 * 
 * Ensures consistent max-width, padding, and responsive behavior
 * across all pages in the application.
 */

import { Box, type BoxProps } from '@chakra-ui/react'
import { spacing, layout } from '../tokens'

interface PageContainerProps extends BoxProps {
  /** Maximum width of content */
  maxW?: string
  /** Remove horizontal padding (for full-bleed content) */
  noPadding?: boolean
  /** Use narrow width for forms/reading content */
  narrow?: boolean
  children: React.ReactNode
}

export function PageContainer({
  maxW = layout.maxContentWidth,
  noPadding = false,
  narrow = false,
  children,
  ...rest
}: PageContainerProps) {
  return (
    <Box
      w="100%"
      maxW={narrow ? layout.maxNarrowWidth : maxW}
      mx="auto"
      px={noPadding ? 0 : { base: spacing[3], md: spacing[4], lg: spacing[6] }}
      {...rest}
    >
      {children}
    </Box>
  )
}
