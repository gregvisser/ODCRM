import {
  Alert,
  AlertIcon,
  Button,
  FormControl,
  FormLabel,
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
import { useState } from 'react'
import { api } from '../utils/api'
import { emit } from '../platform/events'

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

  const resetForOpen = () => {
    setEmailAddress('')
    setDisplayName('')
    setSmtpHost(defaultSmtpHost)
    setSmtpPort(defaultSmtpPort)
    setSmtpUsername('')
    setSmtpPassword('')
    setSmtpSecure(false)
    setDailySendLimit(150)
  }

  const handleSave = async () => {
    if (!customerId || !emailAddress || !smtpHost || !smtpUsername || !smtpPassword) {
      toast({
        title: 'Validation Error',
        description: 'Email, SMTP host, username, and password are required',
        status: 'error',
      })
      return
    }

    const payload = {
      customerId,
      emailAddress,
      displayName,
      provider: 'smtp',
      smtpHost,
      smtpPort,
      smtpUsername,
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
        description: 'SMTP account created for outbound sending',
        status: 'success',
      })
      onClose()
      onCreated?.()
      if (customerId) emit('customerUpdated', { id: customerId })
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to create SMTP account'
      toast({
        title: 'Error',
        description: message,
        status: 'error',
      })
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="2xl"
      onCloseComplete={resetForOpen}
    >
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Add SMTP / Gmail / custom mailbox</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <VStack spacing={4} align="stretch">
            <Alert status="info" fontSize="sm">
              <AlertIcon />
              <Text fontSize="xs">
                Use this for outbound outreach from non-Microsoft mailboxes (Google Workspace, Gmail with app
                password, or any provider that offers SMTP). This is not Google sign-in to ODCRM — it stores SMTP
                credentials for sending only.
              </Text>
            </Alert>
            <Alert status="info" fontSize="sm">
              <AlertIcon />
              <Text fontSize="xs">
                Typical hosts: <Code fontSize="xs">smtp.gmail.com:587</Code> (TLS/STARTTLS — keep SSL/TLS off),{' '}
                <Code fontSize="xs">smtp.office365.com:587</Code>, or your provider&apos;s SMTP endpoint.
              </Text>
            </Alert>

            <FormControl isRequired>
              <FormLabel fontSize="sm">Email Address</FormLabel>
              <Input
                value={emailAddress}
                onChange={(e) => setEmailAddress(e.target.value)}
                placeholder="you@company.com"
                type="email"
              />
            </FormControl>

            <FormControl>
              <FormLabel fontSize="sm">Display Name</FormLabel>
              <Input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your Name"
              />
            </FormControl>

            <HStack>
              <FormControl isRequired>
                <FormLabel fontSize="sm">SMTP Host</FormLabel>
                <Input
                  value={smtpHost}
                  onChange={(e) => setSmtpHost(e.target.value)}
                  placeholder="smtp.gmail.com"
                />
              </FormControl>

              <FormControl isRequired w="30%">
                <FormLabel fontSize="sm">Port</FormLabel>
                <NumberInput
                  value={smtpPort}
                  onChange={(_, num) => setSmtpPort(num || 587)}
                  min={1}
                  max={65535}
                >
                  <NumberInputField />
                </NumberInput>
              </FormControl>
            </HStack>

            <FormControl display="flex" alignItems="center">
              <FormLabel fontSize="sm" mb={0}>
                Use implicit SSL (port 465)
              </FormLabel>
              <Switch isChecked={smtpSecure} onChange={(e) => setSmtpSecure(e.target.checked)} />
              <Text fontSize="xs" color="gray.500" ml={3}>
                For port 587 with STARTTLS (most Gmail / M365), keep this off
              </Text>
            </FormControl>

            <FormControl isRequired>
              <FormLabel fontSize="sm">SMTP Username</FormLabel>
              <Input
                value={smtpUsername}
                onChange={(e) => setSmtpUsername(e.target.value)}
                placeholder="you@company.com"
              />
            </FormControl>

            <FormControl isRequired>
              <FormLabel fontSize="sm">SMTP Password</FormLabel>
              <Input
                type="password"
                value={smtpPassword}
                onChange={(e) => setSmtpPassword(e.target.value)}
                placeholder="App password or SMTP password"
              />
            </FormControl>

            <FormControl>
              <FormLabel fontSize="sm">Daily Send Limit</FormLabel>
              <NumberInput
                value={dailySendLimit}
                onChange={(_, num) => setDailySendLimit(num || 150)}
                min={1}
                max={500}
              >
                <NumberInputField />
              </NumberInput>
              <Text fontSize="xs" color="gray.500" mt={1}>
                Recommended: 150–200 emails per day per account
              </Text>
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
