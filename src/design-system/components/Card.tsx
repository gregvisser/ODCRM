/**
 * Card - Standard card component
 * 
 * Consistent card styling across the application.
 */

import { Box, type BoxProps } from '@chakra-ui/react'
import { spacing, radius, shadow, semanticColor } from '../tokens'

interface CardProps extends BoxProps {
  /** Card variant */
  variant?: 'default' | 'elevated' | 'outlined' | 'subtle'
  /** Padding size */
  p?: number
  /** Make card interactive (hover effect) */
  interactive?: boolean
  children: React.ReactNode
}

export function Card({
  variant = 'default',
  p = spacing[4],
  interactive = false,
  children,
  ...rest
}: CardProps) {
  const styles = {
    default: {
      bg: semanticColor.bgSurface,
      border: '1px solid',
      borderColor: semanticColor.borderSubtle,
      boxShadow: shadow.sm,
    },
    elevated: {
      bg: semanticColor.bgSurface,
      border: 'none',
      boxShadow: shadow.md,
    },
    outlined: {
      bg: 'transparent',
      border: '1px solid',
      borderColor: semanticColor.borderSubtle,
      boxShadow: 'none',
    },
    subtle: {
      bg: semanticColor.bgSubtle,
      border: 'none',
      boxShadow: 'none',
    },
  }

  return (
    <Box
      borderRadius={radius.lg}
      p={p}
      transition={`all 0.2s ease`}
      _hover={
        interactive
          ? {
              boxShadow: shadow.md,
              transform: 'translateY(-2px)',
            }
          : undefined
      }
      {...styles[variant]}
      {...rest}
    >
      {children}
    </Box>
  )
}
