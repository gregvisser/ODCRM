import React, { useEffect, useState } from 'react'
import { Alert, AlertDescription, AlertIcon, AlertTitle, Badge, Box, Card, CardBody, CardHeader, Heading, HStack, Spinner, Text, VStack } from '@chakra-ui/react'
import { api } from '../../../utils/api'
import { getCurrentCustomerId } from '../../../platform/stores/settings'

type ReadinessResponse = {
  customerId: string
  counts: {
    activeIdentities: number
    suppressionEntries: number
    leadSources: number
    templates: number
    sequences: number
  }
  checks: {
    emailIdentitiesConnected: boolean
    suppressionConfigured: boolean
    leadSourceConfigured: boolean
    templateAndSequenceReady: boolean
  }
  ready: boolean
}

const ReadinessTab: React.FC = () => {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [readiness, setReadiness] = useState<ReadinessResponse | null>(null)

  useEffect(() => {
    const load = async () => {
      const customerId = getCurrentCustomerId()
      if (!customerId?.startsWith('cust_')) {
        setLoading(false)
        setError('Select an active client to view readiness.')
        return
      }
      setLoading(true)
      setError(null)
      const res = await api.get<{ data?: ReadinessResponse }>(`/api/onboarding/readiness?customerId=${encodeURIComponent(customerId)}`, {
        headers: { 'X-Customer-Id': customerId },
      })
      setLoading(false)
      if (res.error) {
        setError(res.error)
        setReadiness(null)
        return
      }
      setReadiness(res.data?.data ?? null)
    }
    void load()
  }, [])

  return (
    <Box>
      <Card>
        <CardHeader>
          <HStack justify="space-between">
            <Heading size="md">Operator Onboarding Readiness</Heading>
            <Badge colorScheme={readiness?.ready ? 'green' : 'orange'}>{readiness?.ready ? 'Ready' : 'Needs setup'}</Badge>
          </HStack>
        </CardHeader>
        <CardBody>
          {loading ? (
            <HStack><Spinner size="sm" /><Text>Loading readiness…</Text></HStack>
          ) : error ? (
            <Alert status="error"><AlertIcon /><AlertDescription>{error}</AlertDescription></Alert>
          ) : readiness ? (
            <VStack align="stretch" spacing={3}>
              <Alert status={readiness.checks.emailIdentitiesConnected ? 'success' : 'warning'}><AlertIcon /><AlertTitle fontSize="sm">Email identities connected</AlertTitle><AlertDescription fontSize="sm">{readiness.counts.activeIdentities}</AlertDescription></Alert>
              <Alert status={readiness.checks.suppressionConfigured ? 'success' : 'warning'}><AlertIcon /><AlertTitle fontSize="sm">Suppression configured</AlertTitle><AlertDescription fontSize="sm">{readiness.counts.suppressionEntries}</AlertDescription></Alert>
              <Alert status={readiness.checks.leadSourceConfigured ? 'success' : 'warning'}><AlertIcon /><AlertTitle fontSize="sm">Lead source configured</AlertTitle><AlertDescription fontSize="sm">{readiness.counts.leadSources}</AlertDescription></Alert>
              <Alert status={readiness.checks.templateAndSequenceReady ? 'success' : 'warning'}><AlertIcon /><AlertTitle fontSize="sm">Template + sequence ready</AlertTitle><AlertDescription fontSize="sm">templates={readiness.counts.templates}, sequences={readiness.counts.sequences}</AlertDescription></Alert>
            </VStack>
          ) : (
            <Text color="gray.500">No readiness data.</Text>
          )}
        </CardBody>
      </Card>
    </Box>
  )
}

export default ReadinessTab
