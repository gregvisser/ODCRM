import { useState, useEffect, useCallback } from 'react'
import {
  Button,
  Box,
  HStack,
  VStack,
  Text,
  Badge,
  useDisclosure,
  useToast,
  Spinner,
} from '@chakra-ui/react'
import { CheckCircleIcon } from '@chakra-ui/icons'
import { api } from '../../../utils/api'
import { CompleteOnboardingModal } from './CompleteOnboardingModal'

interface CompleteOnboardingButtonProps {
  customerId: string
  customerName: string
  currentStatus: string
  onStatusUpdated?: () => void
}

interface CompletionInfo {
  isCompleted: boolean
  completedAt?: string
  completedBy?: string
  auditEventId?: string
}

export function CompleteOnboardingButton({
  customerId,
  customerName,
  currentStatus,
  onStatusUpdated,
}: CompleteOnboardingButtonProps) {
  const [completionInfo, setCompletionInfo] = useState<CompletionInfo | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const { isOpen, onOpen, onClose } = useDisclosure()
  const toast = useToast()

  // Check if customer is already completed
  const isAlreadyCompleted = currentStatus === 'active'

  // Load completion info from audit trail
  const loadCompletionInfo = useCallback(async () => {
    if (!customerId) return

    setIsLoading(true)
    try {
      const { data, error } = await api.get<any>(
        `/api/customers/${customerId}/audit?action=complete_onboarding`
      )

      if (error) {
        console.error('Failed to load audit trail:', error)
        setCompletionInfo({ isCompleted: isAlreadyCompleted })
        return
      }

      // Find the completion event
      const completionEvent = data.events?.find(
        (e: any) => e.action === 'complete_onboarding' && e.toStatus === 'active'
      )

      if (completionEvent) {
        setCompletionInfo({
          isCompleted: true,
          completedAt: completionEvent.createdAt,
          completedBy: completionEvent.actorEmail || completionEvent.actorUserId || 'Unknown',
          auditEventId: completionEvent.id,
        })
      } else {
        setCompletionInfo({ isCompleted: isAlreadyCompleted })
      }
    } catch (err) {
      console.error('Error loading completion info:', err)
      setCompletionInfo({ isCompleted: isAlreadyCompleted })
    } finally {
      setIsLoading(false)
    }
  }, [customerId, isAlreadyCompleted])

  useEffect(() => {
    void loadCompletionInfo()
  }, [loadCompletionInfo])

  const handleComplete = async () => {
    try {
      // SECURITY: Actor identity is derived server-side from auth context
      // Do NOT send client-supplied identity - it would be spoofable
      const { data, error } = await api.post<any>(
        `/api/customers/${customerId}/complete-onboarding`,
        {} // Empty body - server derives actor from auth headers
      )

      if (error) {
        throw new Error(error)
      }

      toast({
        title: 'Onboarding Completed',
        description: `${customerName} is now active`,
        status: 'success',
        duration: 4000,
        isClosable: true,
      })

      // Update completion info
      setCompletionInfo({
        isCompleted: true,
        completedAt: data.auditEvent.createdAt,
        completedBy: data.auditEvent.actorEmail || data.auditEvent.actorUserId,
        auditEventId: data.auditEvent.id,
      })

      // Close modal
      onClose()

      // Notify parent to refresh customer data
      if (onStatusUpdated) {
        onStatusUpdated()
      }
    } catch (err) {
      throw err // Re-throw for modal to handle
    }
  }

  if (isLoading) {
    return (
      <Box>
        <HStack spacing={2}>
          <Spinner size="sm" />
          <Text fontSize="sm" color="gray.600">
            Loading completion status...
          </Text>
        </HStack>
      </Box>
    )
  }

  if (completionInfo?.isCompleted) {
    return (
      <Box>
        <VStack align="stretch" spacing={2} bg="green.50" p={4} borderRadius="md" border="1px solid" borderColor="green.200">
          <HStack spacing={2}>
            <CheckCircleIcon color="green.500" />
            <Text fontWeight="bold" color="green.700">
              Onboarding Completed
            </Text>
            <Badge colorScheme="green" ml="auto">Active</Badge>
          </HStack>
          
          {completionInfo.completedAt && (
            <Text fontSize="sm" color="gray.600">
              Completed on {new Date(completionInfo.completedAt).toLocaleDateString()} at{' '}
              {new Date(completionInfo.completedAt).toLocaleTimeString()}
            </Text>
          )}
          
          {completionInfo.completedBy && (
            <Text fontSize="sm" color="gray.600">
              By: {completionInfo.completedBy}
            </Text>
          )}
        </VStack>
      </Box>
    )
  }

  return (
    <Box>
      <VStack align="stretch" spacing={2}>
        <HStack>
          <Text fontSize="sm" fontWeight="medium">
            Ready to complete onboarding?
          </Text>
          <Badge colorScheme="orange">Onboarding</Badge>
        </HStack>
        
        <Button
          colorScheme="blue"
          size="md"
          onClick={onOpen}
          width="fit-content"
        >
          Complete Onboarding
        </Button>

        <Text fontSize="xs" color="gray.500">
          This will mark the customer as active and create an audit trail
        </Text>
      </VStack>

      <CompleteOnboardingModal
        isOpen={isOpen}
        onClose={onClose}
        customerName={customerName}
        onConfirm={handleComplete}
      />
    </Box>
  )
}
