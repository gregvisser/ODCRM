import {
  Alert,
  AlertIcon,
  AlertDescription,
  Button,
  FormControl,
  FormLabel,
  FormHelperText,
  HStack,
  Input,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  NumberInput,
  NumberInputField,
  Switch,
  Text,
  useToast,
  VStack,
  Code,
} from '@chakra-ui/react'
import { useEffect, useState } from 'react'
import { api } from '../utils/api'
import { emit } from '../platform/events'
import { validateSmtpIdentityForm } from '../utils/smtpIdentityValidation'

export type SmtpEmailIdentityModalProps = {
  customerId: string
  isOpen: boolean
  onClose: () => void
  onCreated?: () => void
  /** Default host/port for "Add" — e.g. Gmail-friendly vs blank */
  defaultSmtpHost?: string
  defaultSmtpPort?: number
}

export default function SmtpEmailIdentityModal({
  customerId,
  isOpen,
  onClose,
  onCreated,
  defaultSmtpHost = 'smtp.gmail.com',
  defaultSmtpPort = 587,
}: SmtpEmailIdentityModalProps) {
  const toast = useToast()
  const [emailAddress, setEmailAddress] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [smtpHost, setSmtpHost] = useState(defaultSmtpHost)
  const [smtpPort, setSmtpPort] = useState(defaultSmtpPort)
  const [smtpUsername, setSmtpUsername] = useState('')
  const [smtpPassword, setSmtpPassword] = useState('')
  const [smtpSecure, setSmtpSecure] = useState(false)
  const [dailySendLimit, setDailySendLimit] = useState(150)
  const [inlineError, setInlineError] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen) return
    setSmtpHost(defaultSmtpHost)
    setSmtpPort(defaultSmtpPort)
    setInlineError(null)
  }, [isOpen, defaultSmtpHost, defaultSmtpPort])

  const resetForOpen = () => {
    setEmailAddress('')
    setDisplayName('')
    setSmtpHost(defaultSmtpHost)
    setSmtpPort(defaultSmtpPort)
    setSmtpUsername('')
    setSmtpPassword('')
    setSmtpSecure(false)
    setDailySendLimit(150)
    setInlineError(null)
  }

  const handleSave = async () => {
    if (!customerId) {
      toast({ title: 'Select a client', description: 'Choose a client before adding a mailbox.', status: 'error' })
      return
    }

    const formErr = validateSmtpIdentityForm({
      emailAddress,
      smtpHost,
      smtpPort,
      smtpUsername,
      smtpPassword,
      smtpSecure,
    })
    if (formErr) {
      setInlineError(formErr)
      toast({ title: 'Fix the form', description: formErr, status: 'error', duration: 8000, isClosable: true })
      return
    }
    setInlineError(null)

    const payload = {
      customerId,
      emailAddress: emailAddress.trim(),
      displayName: displayName.trim() || undefined,
      provider: 'smtp',
      smtpHost: smtpHost.trim(),
      smtpPort,
      smtpUsername: smtpUsername.trim(),
      smtpPassword,
      smtpSecure,
      dailySendLimit,
      isActive: true,
    }

    try {
      const { error } = await api.post('/api/outlook/identities', payload)
      if (error) throw new Error(error)
      toast({
        title: 'Mailbox added',
        description: 'This SMTP identity can be used for outbound campaigns and sequences for this client.',
        status: 'success',
      })
      onClose()
      onCreated?.()
      if (customerId) emit('customerUpdated', { id: customerId })
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to create SMTP account'
      setInlineError(message)
      toast({
        title: 'Could not save mailbox',
        description: message,
        status: 'error',
        duration: 10000,
        isClosable: true,
      })
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="2xl" onCloseComplete={resetForOpen}>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Add SMTP / Gmail / custom mailbox</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <VStack spacing={4} align="stretch">
            <Alert status="info" fontSize="sm">
              <AlertIcon />
              <AlertDescription fontSize="xs">
                For <strong>outbound outreach only</strong> — not Google sign-in to ODCRM. We store SMTP credentials
                so sends can use Gmail, Google Workspace, or any host that provides SMTP.
              </AlertDescription>
            </Alert>
            <Alert status="info" fontSize="sm">
              <AlertIcon />
              <AlertDescription fontSize="xs">
                <strong>Gmail / Google Workspace:</strong> host <Code fontSize="xs">smtp.gmail.com</Code>, port{' '}
                <Code fontSize="xs">587</Code>, keep implicit SSL <strong>off</strong>. With 2FA, create an{' '}
                <strong>app password</strong> and use it here (not your normal password).
              </AlertDescription>
            </Alert>
            <Alert status="info" fontSize="sm">
              <AlertIcon />
              <AlertDescription fontSize="xs">
                <strong>Custom SMTP:</strong> use the host and port from your provider (often 587 + STARTTLS, or 465 +
                implicit SSL). “From” address should match what your provider allows for that login.
              </AlertDescription>
            </Alert>

            {inlineError ? (
              <Alert status="error" fontSize="sm">
                <AlertIcon />
                <AlertDescription fontSize="sm">{inlineError}</AlertDescription>
              </Alert>
            ) : null}

            <FormControl isRequired>
              <FormLabel fontSize="sm">From email (outbound address)</FormLabel>
              <Input
                value={emailAddress}
                onChange={(e) => {
                  setEmailAddress(e.target.value)
                  setInlineError(null)
                }}
                placeholder="you@company.com"
                type="email"
              />
              <FormHelperText>Shown as the sender on outreach emails.</FormHelperText>
            </FormControl>

            <FormControl>
              <FormLabel fontSize="sm">Display name (optional)</FormLabel>
              <Input
                value={displayName}
                onChange={(e) => {
                  setDisplayName(e.target.value)
                  setInlineError(null)
                }}
                placeholder="Your Name"
              />
            </FormControl>

            <HStack align="flex-start">
              <FormControl isRequired>
                <FormLabel fontSize="sm">SMTP host</FormLabel>
                <Input
                  value={smtpHost}
                  onChange={(e) => {
                    setSmtpHost(e.target.value)
                    setInlineError(null)
                  }}
                  placeholder="smtp.gmail.com"
                />
              </FormControl>

              <FormControl isRequired w="30%">
                <FormLabel fontSize="sm">Port</FormLabel>
                <NumberInput
                  value={smtpPort}
                  onChange={(_, num) => {
                    setSmtpPort(num || 587)
                    setInlineError(null)
                  }}
                  min={1}
                  max={65535}
                >
                  <NumberInputField />
                </NumberInput>
                <FormHelperText>Usually 587 (STARTTLS) or 465 (implicit SSL).</FormHelperText>
              </FormControl>
            </HStack>

            <FormControl display="flex" alignItems="center">
              <FormLabel fontSize="sm" mb={0}>
                Use implicit SSL (typical port 465)
              </FormLabel>
              <Switch
                isChecked={smtpSecure}
                onChange={(e) => {
                  setSmtpSecure(e.target.checked)
                  setInlineError(null)
                }}
              />
              <Text fontSize="xs" color="gray.500" ml={3}>
                Off for port 587 (STARTTLS). On for most 465 setups.
              </Text>
            </FormControl>

            <FormControl isRequired>
              <FormLabel fontSize="sm">SMTP username</FormLabel>
              <Input
                value={smtpUsername}
                onChange={(e) => {
                  setSmtpUsername(e.target.value)
                  setInlineError(null)
                }}
                placeholder="Usually your full email address"
              />
            </FormControl>

            <FormControl isRequired>
              <FormLabel fontSize="sm">SMTP password</FormLabel>
              <Input
                type="password"
                value={smtpPassword}
                onChange={(e) => {
                  setSmtpPassword(e.target.value)
                  setInlineError(null)
                }}
                placeholder="App password (Gmail 2FA) or provider SMTP password"
              />
            </FormControl>

            <FormControl>
              <FormLabel fontSize="sm">Daily send limit</FormLabel>
              <NumberInput
                value={dailySendLimit}
                onChange={(_, num) => setDailySendLimit(num || 150)}
                min={1}
                max={500}
              >
                <NumberInputField />
              </NumberInput>
              <FormHelperText>Recommended 150–200 per day per mailbox for deliverability.</FormHelperText>
            </FormControl>
          </VStack>
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" mr={3} onClick={onClose}>
            Cancel
          </Button>
          <Button colorScheme="teal" onClick={handleSave}>
            Create
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}
