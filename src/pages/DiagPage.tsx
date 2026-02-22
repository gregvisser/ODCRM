/**
 * Public diagnostics page at /__diag. No auth required.
 * Shows build info (bundle + __build.json + backend __build), last fatal, userAgent, location.
 */
import React, { useCallback, useEffect, useState } from 'react'
import { Box, Button, Code, Heading, Text, VStack } from '@chakra-ui/react'
import { BUILD_SHA, BUILD_TIME } from '../version'

const LAST_FATAL_KEY = 'odcrm:lastFatal'
const PROD_BACKEND = 'https://odcrm-api-hkbsfbdzdvezedg8.westeurope-01.azurewebsites.net'
const PROD_FRONTEND_BUILD_URL = 'https://odcrm.bidlow.co.uk/__build.json'

type FatalPayload = {
  time?: string
  message?: string
  stack?: string
  source?: string
} | null

type FetchState<T> = { status?: number; body?: T; error?: string }

export default function DiagPage() {
  const [lastFatal, setLastFatal] = useState<FatalPayload>(null)
  const [frontendBuild, setFrontendBuild] = useState<FetchState<{ sha?: string; time?: string }>>({})
  const [backendBuild, setBackendBuild] = useState<FetchState<{ sha?: string; time?: string; service?: string }>>({})

  const loadLastFatal = useCallback(() => {
    try {
      const fromWindow = typeof window !== 'undefined' ? window.__ODCRM_LAST_FATAL__ : undefined
      if (fromWindow) {
        setLastFatal(fromWindow)
        return
      }
      const raw = localStorage.getItem(LAST_FATAL_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as FatalPayload
        setLastFatal(parsed)
      } else {
        setLastFatal(null)
      }
    } catch {
      setLastFatal(null)
    }
  }, [])

  useEffect(() => {
    loadLastFatal()
  }, [loadLastFatal])

  useEffect(() => {
    // Frontend /__build.json (full URL for prod)
    const frontUrl = typeof window !== 'undefined' && window.location.origin
      ? `${window.location.origin}/__build.json`
      : PROD_FRONTEND_BUILD_URL
    fetch(frontUrl, { cache: 'no-store' })
      .then((r) => {
        const status = r.status
        return (r.ok ? r.json() : r.text().then((t) => ({ _error: t }))).then((data) => ({ status, data }))
      })
      .then(({ status, data }) => {
        if (data && typeof data === 'object' && '_error' in data) {
          setFrontendBuild({ status, error: String((data as { _error?: string })._error) })
        } else {
          setFrontendBuild({ status, body: data as { sha?: string; time?: string } })
        }
      })
      .catch((e) => setFrontendBuild({ error: e?.message ?? String(e) }))

    // Backend /api/__build
    const apiBase = import.meta.env.VITE_API_URL?.trim() || PROD_BACKEND
    const backendUrl = `${apiBase.replace(/\/$/, '')}/api/__build`
    fetch(backendUrl, { cache: 'no-store' })
      .then((r) => {
        const status = r.status
        return (r.ok ? r.json() : r.text().then((t) => ({ _error: t }))).then((data) => ({ status, data }))
      })
      .then(({ status, data }) => {
        if (data && typeof data === 'object' && '_error' in data) {
          setBackendBuild({ status, error: String((data as { _error?: string })._error) })
        } else {
          setBackendBuild({ status, body: data as { sha?: string; time?: string; service?: string } })
        }
      })
      .catch((e) => setBackendBuild({ error: e?.message ?? String(e) }))
  }, [])

  const clearLastFatalAndReload = () => {
    try {
      localStorage.removeItem(LAST_FATAL_KEY)
      if (typeof window !== 'undefined' && window.__ODCRM_LAST_FATAL__) {
        ;(window as unknown as { __ODCRM_LAST_FATAL__?: unknown }).__ODCRM_LAST_FATAL__ = undefined
      }
    } catch {
      // ignore
    }
    window.location.reload()
  }

  const bundleBuild = typeof window !== 'undefined' && window.__ODCRM_BUILD__
    ? window.__ODCRM_BUILD__
    : { sha: BUILD_SHA, time: BUILD_TIME }

  return (
    <Box p={6} maxW="800px" mx="auto" fontFamily="sans-serif">
      <Heading size="md" mb={4}>ODCRM diagnostics</Heading>
      <VStack align="stretch" spacing={4}>
        <Box>
          <Text fontWeight="bold" fontSize="sm" color="gray.600">Build (from bundle / window.__ODCRM_BUILD__)</Text>
          <Code display="block" p={2} mt={1} fontSize="sm">
            sha: {bundleBuild.sha}, time: {bundleBuild.time}
          </Code>
        </Box>

        <Box>
          <Text fontWeight="bold" fontSize="sm" color="gray.600">/__build.json (deployed frontend)</Text>
          {frontendBuild.error != null ? (
            <Code display="block" p={2} mt={1} fontSize="sm" bg="red.50" color="red.800">
              Error: {frontendBuild.error}
              {frontendBuild.status != null && ` (HTTP ${frontendBuild.status})`}
            </Code>
          ) : frontendBuild.body != null ? (
            <>
              <Text fontSize="xs" color="gray.500">HTTP status: {frontendBuild.status ?? '—'}</Text>
              <Code display="block" p={2} mt={1} fontSize="sm" whiteSpace="pre-wrap">
                {JSON.stringify(frontendBuild.body)}
              </Code>
            </>
          ) : (
            <Text color="gray.500" mt={1}>Loading…</Text>
          )}
        </Box>

        <Box>
          <Text fontWeight="bold" fontSize="sm" color="gray.600">Backend /api/__build</Text>
          {backendBuild.error != null ? (
            <Code display="block" p={2} mt={1} fontSize="sm" bg="red.50" color="red.800">
              Error: {backendBuild.error}
              {backendBuild.status != null && ` (HTTP ${backendBuild.status})`}
            </Code>
          ) : backendBuild.body != null ? (
            <>
              <Text fontSize="xs" color="gray.500">HTTP status: {backendBuild.status ?? '—'}</Text>
              <Code display="block" p={2} mt={1} fontSize="sm" whiteSpace="pre-wrap">
                {JSON.stringify(backendBuild.body)}
              </Code>
            </>
          ) : (
            <Text color="gray.500" mt={1}>Loading…</Text>
          )}
        </Box>

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
          <Text fontWeight="bold" fontSize="sm" color="gray.600">Last fatal (window.__ODCRM_LAST_FATAL__ or odcrm:lastFatal)</Text>
          {lastFatal ? (
            <>
              <Code display="block" p={2} mt={1} fontSize="xs" whiteSpace="pre-wrap" overflowX="auto" bg="red.50">
                {JSON.stringify(lastFatal, null, 2)}
              </Code>
              <Button size="sm" mt={2} colorScheme="red" variant="outline" onClick={clearLastFatalAndReload}>
                Clear last fatal &amp; reload
              </Button>
            </>
          ) : (
            <Text color="gray.500" mt={1}>none</Text>
          )}
        </Box>
      </VStack>
    </Box>
  )
}
