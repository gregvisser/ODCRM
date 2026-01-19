import { useEffect, useMemo } from 'react'
import { Box, Button, Flex, Heading, Stack, Text } from '@chakra-ui/react'
import { InteractionStatus } from '@azure/msal-browser'
import { useIsAuthenticated, useMsal } from '@azure/msal-react'
import LoginPage from './LoginPage'
import { authConfigReady, loginRequest } from './msalConfig'

type AuthGateProps = {
  children: React.ReactNode
}

const parseList = (value?: string): string[] =>
  value
    ? value
        .split(/[,\s]+/)
        .map((entry) => entry.trim().toLowerCase())
        .filter(Boolean)
    : []

const allowedEmails = parseList(import.meta.env.VITE_AUTH_ALLOWED_EMAILS)
const allowedDomains = parseList(import.meta.env.VITE_AUTH_ALLOWED_DOMAINS)

const isAllowlistConfigured = allowedEmails.length > 0 || allowedDomains.length > 0

const isEmailAllowed = (email: string): boolean => {
  if (!isAllowlistConfigured) return false
  if (allowedEmails.includes(email)) return true
  const domain = email.split('@')[1]
  return Boolean(domain && allowedDomains.includes(domain))
}

export default function AuthGate({ children }: AuthGateProps) {
  const { instance, accounts, inProgress } = useMsal()
  const isAuthenticated = useIsAuthenticated()

  const activeEmail = useMemo(() => accounts[0]?.username?.toLowerCase() || '', [accounts])

  useEffect(() => {
    if (accounts[0]) {
      instance.setActiveAccount(accounts[0])
    }
  }, [accounts, instance])

  const handleSignIn = async () => {
    if (!authConfigReady) return
    await instance.loginRedirect(loginRequest)
  }

  const handleSignOut = async () => {
    await instance.logoutRedirect({ postLogoutRedirectUri: window.location.origin })
  }

  if (!authConfigReady) {
    return <LoginPage onSignIn={handleSignIn} showConfigWarning disableSignIn />
  }

  if (!isAuthenticated) {
    return (
      <LoginPage
        onSignIn={handleSignIn}
        showConfigWarning={false}
        disableSignIn={inProgress !== InteractionStatus.None}
      />
    )
  }

  if (!isAllowlistConfigured) {
    return (
      <Flex minH="100vh" align="center" justify="center" bg="gray.50" px={6}>
        <Box
          bg="white"
          p={{ base: 8, md: 10 }}
          borderRadius="2xl"
          border="1px solid"
          borderColor="gray.200"
          boxShadow="lg"
          maxW="520px"
          w="100%"
        >
          <Stack spacing={4} textAlign="center">
            <Heading size="md">Access not configured</Heading>
            <Text color="gray.600">
              Your account signed in successfully, but the allowlist is not configured yet. Add
              allowed emails or domains to continue.
            </Text>
            <Button colorScheme="gray" onClick={handleSignOut}>
              Sign out
            </Button>
          </Stack>
        </Box>
      </Flex>
    )
  }

  if (!isEmailAllowed(activeEmail)) {
    return (
      <Flex minH="100vh" align="center" justify="center" bg="gray.50" px={6}>
        <Box
          bg="white"
          p={{ base: 8, md: 10 }}
          borderRadius="2xl"
          border="1px solid"
          borderColor="gray.200"
          boxShadow="lg"
          maxW="520px"
          w="100%"
        >
          <Stack spacing={4} textAlign="center">
            <Heading size="md">Access denied</Heading>
            <Text color="gray.600">
              The signed-in Microsoft account is not authorized for ODCRM. Contact the admin to
              request access.
            </Text>
            <Button colorScheme="gray" onClick={handleSignOut}>
              Sign out
            </Button>
          </Stack>
        </Box>
      </Flex>
    )
  }

  return (
    <>
      <Box position="fixed" top="16px" right="16px" zIndex={1000}>
        <Button size="sm" variant="outline" colorScheme="gray" onClick={handleSignOut}>
          Sign out
        </Button>
      </Box>
      {children}
    </>
  )
}
