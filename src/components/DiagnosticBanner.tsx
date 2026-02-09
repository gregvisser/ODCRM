/**
 * TEMPORARY DIAGNOSTIC BANNER
 * Shows build fingerprint and API configuration to debug production deployment
 * Remove after production is verified stable
 */

import { Box, Text, Code, HStack, Badge } from '@chakra-ui/react'

const API_BASE_URL = import.meta.env.VITE_API_URL || ''

export function DiagnosticBanner() {
  const buildSHA = typeof __GIT_SHA__ !== 'undefined' ? __GIT_SHA__ : 'unknown'
  const buildTime = typeof __BUILD_STAMP__ !== 'undefined' ? __BUILD_STAMP__ : 'unknown'
  const apiBase = API_BASE_URL || '(relative URLs - Azure SWA proxy)'

  return (
    <Box
      position="fixed"
      bottom={0}
      left={0}
      right={0}
      bg="yellow.100"
      borderTop="2px solid"
      borderColor="yellow.400"
      py={2}
      px={4}
      zIndex={9999}
      fontSize="xs"
    >
      <HStack spacing={4} justify="center" flexWrap="wrap">
        <HStack spacing={1}>
          <Badge colorScheme="purple">BUILD</Badge>
          <Code fontSize="xs">{buildSHA}</Code>
        </HStack>
        <HStack spacing={1}>
          <Badge colorScheme="blue">TIME</Badge>
          <Code fontSize="xs">{new Date(buildTime).toLocaleString()}</Code>
        </HStack>
        <HStack spacing={1}>
          <Badge colorScheme="green">API</Badge>
          <Code fontSize="xs">{apiBase}</Code>
        </HStack>
      </HStack>
    </Box>
  )
}
