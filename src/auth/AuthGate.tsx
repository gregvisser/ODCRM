import { useEffect, useMemo, useState } from 'react'
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

const envAllowedEmails = parseList(import.meta.env.VITE_AUTH_ALLOWED_EMAILS)
const envAllowedDomains = parseList(import.meta.env.VITE_AUTH_ALLOWED_DOMAINS)

const loadUserEmailsFromStorage = (): string[] => {
  try {
    const stored = localStorage.getItem('users')
    if (!stored) return []
    const users = JSON.parse(stored) as Array<{ email?: string }>
    return users
      .map((user) => user.email?.toLowerCase().trim())
      .filter((email): email is string => Boolean(email))
  } catch {
    return []
  }
}

export default function AuthGate({ children }: AuthGateProps) {
  const { instance, accounts, inProgress } = useMsal()
  const isAuthenticated = useIsAuthenticated()
  const [userEmails, setUserEmails] = useState<string[]>(() => loadUserEmailsFromStorage())

  const activeEmail = useMemo(() => accounts[0]?.username?.toLowerCase() || '', [accounts])

  const effectiveAllowedEmails = userEmails.length > 0 ? userEmails : envAllowedEmails
  const effectiveAllowedDomains = userEmails.length > 0 ? [] : envAllowedDomains
  const isAllowlistConfigured =
    effectiveAllowedEmails.length > 0 || effectiveAllowedDomains.length > 0

  const isEmailAllowed = (email: string): boolean => {
    if (!isAllowlistConfigured) return false
    if (effectiveAllowedEmails.includes(email)) return true
    const domain = email.split('@')[1]
    return Boolean(domain && effectiveAllowedDomains.includes(domain))
  }

  useEffect(() => {
    if (accounts[0]) {
      instance.setActiveAccount(accounts[0])
    }
  }, [accounts, instance])

  useEffect(() => {
    const refreshUsers = () => setUserEmails(loadUserEmailsFromStorage())
    const handleStorage = (event: StorageEvent) => {
      if (event.key === 'users') refreshUsers()
    }
    window.addEventListener('usersUpdated', refreshUsers)
    window.addEventListener('storage', handleStorage)
    return () => {
      window.removeEventListener('usersUpdated', refreshUsers)
      window.removeEventListener('storage', handleStorage)
    }
  }, [])

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
              Your account signed in successfully, but no authorized users are configured yet. Add
              users in Operations → User Authorization or set allowlist environment variables.
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
