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
  Radio,
  RadioGroup,
  Switch,
  Text,
  useToast,
  VStack,
} from '@chakra-ui/react'
import { useEffect, useState } from 'react'
import { api } from '../utils/api'
import { emit } from '../platform/events'
import { validateSmtpIdentityForm } from '../utils/smtpIdentityValidation'

export type MailboxKind = 'google-hosted' | 'other-smtp'

export type SmtpEmailIdentityModalProps = {
  customerId: string
  isOpen: boolean
  onClose: () => void
  onCreated?: () => void
  /** Defaults when “Google-hosted mailbox” is selected */
  defaultSmtpHost?: string
  defaultSmtpPort?: number
}

const GOOGLE_SMTP_HOST = 'smtp.gmail.com'
const GOOGLE_SMTP_PORT = 587

export default function SmtpEmailIdentityModal({
  customerId,
  isOpen,
  onClose,
  onCreated,
  defaultSmtpHost = GOOGLE_SMTP_HOST,
  defaultSmtpPort = GOOGLE_SMTP_PORT,
}: SmtpEmailIdentityModalProps) {
  const toast = useToast()
  const [mailboxKind, setMailboxKind] = useState<MailboxKind>('google-hosted')
  const [emailAddress, setEmailAddress] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [smtpHost, setSmtpHost] = useState(defaultSmtpHost)
  const [smtpPort, setSmtpPort] = useState(defaultSmtpPort)
  const [smtpUsername, setSmtpUsername] = useState('')
  const [smtpPassword, setSmtpPassword] = useState('')
  const [smtpSecure, setSmtpSecure] = useState(false)
  const [dailySendLimit, setDailySendLimit] = useState(150)
  const [inlineError, setInlineError] = useState<string | null>(null)
  const [isVerifying, setIsVerifying] = useState(false)

  const applyMailboxKind = (kind: MailboxKind) => {
    setMailboxKind(kind)
    setInlineError(null)
    if (kind === 'google-hosted') {
      setSmtpHost(defaultSmtpHost)
      setSmtpPort(defaultSmtpPort)
      setSmtpSecure(false)
    } else {
      setSmtpHost('')
      setSmtpPort(587)
      setSmtpSecure(false)
    }
  }

  useEffect(() => {
    if (!isOpen) return
    setMailboxKind('google-hosted')
    setSmtpHost(defaultSmtpHost)
    setSmtpPort(defaultSmtpPort)
    setSmtpSecure(false)
    setInlineError(null)
    setIsVerifying(false)
  }, [isOpen, defaultSmtpHost, defaultSmtpPort])

  const resetForOpen = () => {
    setMailboxKind('google-hosted')
    setEmailAddress('')
    setDisplayName('')
    setSmtpHost(defaultSmtpHost)
    setSmtpPort(defaultSmtpPort)
    setSmtpUsername('')
    setSmtpPassword('')
    setSmtpSecure(false)
    setDailySendLimit(150)
    setInlineError(null)
    setIsVerifying(false)
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

    setIsVerifying(true)
    try {
      const { error } = await api.post('/api/outlook/identities', payload)
      if (error) throw new Error(error)
      toast({
        title: 'Mailbox added',
        description: 'SMTP settings were verified; this identity can be used for outbound campaigns and sequences.',
        status: 'success',
      })
      onClose()
      onCreated?.()
      if (customerId) emit('customerUpdated', { id: customerId })
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to create SMTP account'
      setInlineError(message)
      const verifyFailed = message.includes('SMTP verification failed')
      toast({
        title: verifyFailed ? 'SMTP verification failed' : 'Could not save mailbox',
        description: message,
        status: 'error',
        duration: 10000,
        isClosable: true,
      })
    } finally {
      setIsVerifying(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="2xl"
      onCloseComplete={resetForOpen}
      closeOnOverlayClick={!isVerifying}
      closeOnEsc={!isVerifying}
    >
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Add outbound mailbox</ModalHeader>
        <ModalCloseButton isDisabled={isVerifying} />
        <ModalBody>
          <VStack spacing={4} align="stretch">
            <Alert status="info" fontSize="sm" borderRadius="md">
              <AlertIcon />
              <AlertDescription fontSize="sm">
                <strong>Outbound email only</strong> — not sign-in to ODCRM. When you add a mailbox, we verify SMTP
                login and connection before saving; invalid credentials are not stored.
              </AlertDescription>
            </Alert>

            <FormControl>
              <FormLabel fontSize="sm">Mailbox type</FormLabel>
              <RadioGroup value={mailboxKind} onChange={(v) => applyMailboxKind(v as MailboxKind)}>
                <VStack align="stretch" spacing={2}>
                  <Radio value="google-hosted">Google-hosted mailbox (Gmail or Google Workspace)</Radio>
                  <Radio value="other-smtp">Other SMTP mailbox</Radio>
                </VStack>
              </RadioGroup>
              {mailboxKind === 'google-hosted' ? (
                <FormHelperText>
                  Includes <strong>@gmail.com</strong> addresses and <strong>custom domains</strong> hosted on Google
                  Workspace. SMTP is preset to {GOOGLE_SMTP_HOST}, port {GOOGLE_SMTP_PORT}, implicit SSL off (STARTTLS).
                  Use your <strong>full email address</strong> as the username. If your Google account requires it, use
                  an <strong>app password</strong> instead of your normal password.
                </FormHelperText>
              ) : (
                <FormHelperText>
                  Use the SMTP host, port, and security settings from your email provider. Common setups: port{' '}
                  <strong>587</strong> with implicit SSL off (STARTTLS), or port <strong>465</strong> with implicit SSL
                  on. The “From” address should match what your provider allows for that login.
                </FormHelperText>
              )}
            </FormControl>

            {inlineError ? (
              <Alert status="error" fontSize="sm">
                <AlertIcon />
                <AlertDescription fontSize="sm" whiteSpace="pre-line">
                  {inlineError}
                </AlertDescription>
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
                placeholder={mailboxKind === 'google-hosted' ? 'you@gmail.com or you@yourdomain.com' : 'you@company.com'}
                type="email"
              />
              <FormHelperText>Recipients see this as the sender.</FormHelperText>
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
                  placeholder={mailboxKind === 'google-hosted' ? GOOGLE_SMTP_HOST : 'e.g. smtp.yourprovider.com'}
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
                Implicit SSL (typical port 465)
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
              {mailboxKind === 'google-hosted' ? (
                <FormHelperText>Use the same full address as “From email” (Workspace custom domains included).</FormHelperText>
              ) : null}
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
                placeholder={
                  mailboxKind === 'google-hosted'
                    ? 'Google app password (when your account requires it)'
                    : 'Password or app-specific password from your provider'
                }
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
          <Button variant="ghost" mr={3} onClick={onClose} isDisabled={isVerifying}>
            Cancel
          </Button>
          <Button
            colorScheme="teal"
            onClick={handleSave}
            isLoading={isVerifying}
            loadingText="Verifying SMTP…"
          >
            Add mailbox
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}
