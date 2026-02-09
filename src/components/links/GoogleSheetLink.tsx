/**
 * GoogleSheetLink - Reusable component for displaying Google Sheet links
 * 
 * GLOBAL STANDARD: Never show raw URLs for Google Sheets.
 * Always display a clean label instead.
 * 
 * Priority: label prop > fallbackLabel > "Google Sheet"
 */

import { Link, Text, HStack } from '@chakra-ui/react'
import { ExternalLinkIcon } from '@chakra-ui/icons'

interface GoogleSheetLinkProps {
  /** The full Google Sheets URL */
  url?: string | null
  /** Custom display label (user-provided) */
  label?: string | null
  /** Fallback label if no custom label provided */
  fallbackLabel?: string
  /** Text size */
  fontSize?: string
  /** Text color */
  color?: string
  /** Font weight */
  fontWeight?: string
}

export function GoogleSheetLink({
  url,
  label,
  fallbackLabel = 'Google Sheet',
  fontSize = 'sm',
  color = 'blue.600',
  fontWeight = 'medium',
}: GoogleSheetLinkProps) {
  // No URL provided
  if (!url || !url.trim()) {
    return (
      <Text fontSize={fontSize} color="gray.400">
        Not set
      </Text>
    )
  }

  // Determine display text: custom label > fallback > default
  const displayText = label && label.trim() 
    ? label.trim() 
    : fallbackLabel

  return (
    <Link
      href={url}
      isExternal
      color={color}
      fontSize={fontSize}
      fontWeight={fontWeight}
      display="inline-flex"
      alignItems="center"
      gap={1}
      _hover={{ textDecoration: 'underline' }}
      onClick={(e) => {
        e.preventDefault()
        window.open(url, '_blank', 'noopener,noreferrer')
      }}
    >
      <HStack spacing={1}>
        <Text>{displayText}</Text>
        <ExternalLinkIcon boxSize={3} />
      </HStack>
    </Link>
  )
}
