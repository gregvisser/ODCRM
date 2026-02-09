import { useState } from 'react'
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalCloseButton,
  Button,
  Text,
  Input,
  FormControl,
  FormLabel,
  FormHelperText,
  VStack,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  Box,
} from '@chakra-ui/react'

interface CompleteOnboardingModalProps {
  isOpen: boolean
  onClose: () => void
  customerName: string
  onConfirm: () => Promise<void>
}

export function CompleteOnboardingModal({
  isOpen,
  onClose,
  customerName,
  onConfirm,
}: CompleteOnboardingModalProps) {
  const [confirmText, setConfirmText] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isConfirmTextValid = confirmText.trim().toUpperCase() === 'COMPLETE'

  const handleConfirm = async () => {
    if (!isConfirmTextValid) return

    setIsSubmitting(true)
    setError(null)

    try {
      await onConfirm()
      // Success - modal will be closed by parent
      setConfirmText('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to complete onboarding')
      setIsSubmitting(false)
    }
  }

  const handleClose = () => {
    setConfirmText('')
    setError(null)
    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} size="lg" closeOnOverlayClick={!isSubmitting}>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Complete Onboarding</ModalHeader>
        <ModalCloseButton isDisabled={isSubmitting} />
        
        <ModalBody>
          <VStack spacing={4} align="stretch">
            <Alert status="warning" borderRadius="md">
              <AlertIcon />
              <Box>
                <AlertTitle>This action is irreversible</AlertTitle>
                <AlertDescription>
                  Once completed, the customer status will be set to "Active" and cannot be reverted to "Onboarding" through this interface.
                </AlertDescription>
              </Box>
            </Alert>

            <Text>
              You are about to complete onboarding for:
            </Text>

            <Box bg="gray.50" p={3} borderRadius="md" fontWeight="medium">
              {customerName}
            </Box>

            <Text fontSize="sm" color="gray.600">
              This will:
            </Text>
            <VStack align="stretch" spacing={1} fontSize="sm" color="gray.600" pl={4}>
              <Text>• Set customer status to "Active"</Text>
              <Text>• Create an audit trail entry</Text>
              <Text>• Mark onboarding as complete</Text>
            </VStack>

            <FormControl isRequired>
              <FormLabel>Type COMPLETE to confirm</FormLabel>
              <Input
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="COMPLETE"
                autoComplete="off"
                isDisabled={isSubmitting}
                fontFamily="mono"
                textTransform="uppercase"
              />
              <FormHelperText>
                Type the word "COMPLETE" in capital letters to proceed
              </FormHelperText>
            </FormControl>

            {error && (
              <Alert status="error" borderRadius="md">
                <AlertIcon />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </VStack>
        </ModalBody>

        <ModalFooter>
          <Button variant="ghost" mr={3} onClick={handleClose} isDisabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            colorScheme="blue"
            onClick={handleConfirm}
            isDisabled={!isConfirmTextValid || isSubmitting}
            isLoading={isSubmitting}
            loadingText="Completing..."
          >
            Complete Onboarding
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}
