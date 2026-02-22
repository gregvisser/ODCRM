/**
 * Public diagnostics page at /__diag. No auth required.
 * Shows build info, last fatal error (from localStorage), userAgent, location.
 */
import React, { useEffect, useState } from 'react'
import { Box, Code, Heading, Text, VStack } from '@chakra-ui/react'
import { BUILD_SHA, BUILD_TIME } from '../version'

const LAST_FATAL_KEY = 'odcrm:lastFatal'

type FatalPayload = {
  time?: string
  message?: string
  stack?: string
  source?: string
} | null

export default function DiagPage() {
  const [lastFatal, setLastFatal] = useState<FatalPayload>(null)
  const [buildJson, setBuildJson] = useState<{ sha?: string; time?: string } | null>(null)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LAST_FATAL_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as FatalPayload
        setLastFatal(parsed)
      }
    } catch {
      setLastFatal(null)
    }
    // Optionally fetch /__build.json to confirm what's deployed
    fetch('/__build.json', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then(setBuildJson)
      .catch(() => setBuildJson(null))
  }, [])

  return (
    <Box p={6} maxW="800px" mx="auto" fontFamily="sans-serif">
      <Heading size="md" mb={4}>ODCRM diagnostics</Heading>
      <VStack align="stretch" spacing={4}>
        <Box>
          <Text fontWeight="bold" fontSize="sm" color="gray.600">Build (from bundle)</Text>
          <Code display="block" p={2} mt={1} fontSize="sm">
            sha: {BUILD_SHA}, time: {BUILD_TIME}
          </Code>
        </Box>
        {buildJson && (
          <Box>
            <Text fontWeight="bold" fontSize="sm" color="gray.600">/__build.json (deployed)</Text>
            <Code display="block" p={2} mt={1} fontSize="sm" whiteSpace="pre-wrap">
              {JSON.stringify(buildJson)}
            </Code>
          </Box>
        )}
        <Box>
          <Text fontWeight="bold" fontSize="sm" color="gray.600">userAgent</Text>
          <Code display="block" p={2} mt={1} fontSize="xs" whiteSpace="pre-wrap" overflowX="auto">
            {typeof navigator !== 'undefined' ? navigator.userAgent : ''}
          </Code>
        </Box>
        <Box>
          <Text fontWeight="bold" fontSize="sm" color="gray.600">location.href</Text>
          <Code display="block" p={2} mt={1} fontSize="sm" wordBreak="break-all">
            {typeof window !== 'undefined' ? window.location.href : ''}
          </Code>
        </Box>
        <Box>
          <Text fontWeight="bold" fontSize="sm" color="gray.600">Last fatal (odcrm:lastFatal)</Text>
          {lastFatal ? (
            <Code display="block" p={2} mt={1} fontSize="xs" whiteSpace="pre-wrap" overflowX="auto" bg="red.50">
              {JSON.stringify(lastFatal, null, 2)}
            </Code>
          ) : (
            <Text color="gray.500" mt={1}>none</Text>
          )}
        </Box>
      </VStack>
    </Box>
  )
}
