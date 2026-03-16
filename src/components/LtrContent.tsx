/**
 * Wraps content that should always display LTR (e.g. emails, URLs, domains, IDs)
 * when the app is in RTL (Arabic) mode. Use in table cells or cards that show
 * such values so they remain readable.
 */
import { Box, type BoxProps } from '@chakra-ui/react'

export function LtrContent({ children, ...props }: BoxProps) {
  return (
    <Box as="span" dir="ltr" style={{ unicodeBidi: 'embed' }} display="inline-block" {...props}>
      {children}
    </Box>
  )
}
