import { useEffect, useMemo, useState } from 'react'
import { Box, Button, Flex, Heading, Stack, Text } from '@chakra-ui/react'
import { InteractionStatus } from '@azure/msal-browser'
import { useIsAuthenticated, useMsal } from '@azure/msal-react'
import LoginPage from './LoginPage'
import { authConfigReady, loginRequest } from './msalConfig'
import { api } from '../utils/api'

type AuthGateProps = {
  children: React.ReactNode
}

const POST_LOGIN_REDIRECT_KEY = 'odcrm_post_login_redirect_v1'

function isSafeInternalRedirect(value: string): boolean {
  const v = value.trim()
  if (!v.startsWith('/')) return false
  if (v.startsWith('//')) return false
  if (v.includes('://')) return false
  if (v.includes('\\')) return false
  return true
}

function getIntendedRedirectFromWindow(): string {
  // Preserve the user's intended deep link across the MSAL redirect (which returns to the site root).
  // Keep it internal-only and compact: path + search, no origin.
  return `${window.location.pathname || '/'}${window.location.search || ''}`
}

type AuthorizationStatus =
  | { status: 'checking' }
  | { status: 'authorized'; email?: string }
  | { status: 'unauthorized'; email?: string; reason?: string }
  | { status: 'error'; email?: string; message?: string }

function extractEmailFromMsalAccount(account: any): string {
  const claims = (account?.idTokenClaims || {}) as Record<string, any>
  const raw =
    claims.preferred_username ||
    claims.email ||
    claims.upn ||
    account?.username ||
    ''
  return String(raw || '').trim().toLowerCase()
}

export default function AuthGate({ children }: AuthGateProps) {
  const { instance, accounts, inProgress } = useMsal()
  const isAuthenticated = useIsAuthenticated()
  const [authz, setAuthz] = useState<AuthorizationStatus>({ status: 'checking' })

  const activeEmail = useMemo(() => extractEmailFromMsalAccount(accounts[0]), [accounts])

  useEffect(() => {
    if (accounts[0]) {
      instance.setActiveAccount(accounts[0])
    }
  }, [accounts, instance])

  useEffect(() => {
    // Authorize against ODCRM users table (DB source of truth)
    // In production, the API call carries Azure SWA identity headers automatically.
    let cancelled = false
    const run = async () => {
      if (!isAuthenticated || inProgress !== InteractionStatus.None) return
      setAuthz({ status: 'checking' })
      const { data, error, errorDetails } = await api.get<{
        authorized: boolean
        email?: string
        user?: { id: string; userId: string; email: string; role: string; department: string }
        autoProvisioned?: boolean
        error?: string
      }>('/api/users/me')

      if (cancelled) return

      if (error) {
        // If backend can't resolve identity in dev, keep a clear message.
        setAuthz({
          status: errorDetails?.status === 403 ? 'unauthorized' : 'error',
          email: activeEmail || undefined,
          reason: error,
          message: error,
        } as any)
        return
      }

      if (data?.authorized) {
        setAuthz({ status: 'authorized', email: data.email || activeEmail || undefined })
        return
      }

      setAuthz({
        status: 'unauthorized',
        email: data?.email || activeEmail || undefined,
        reason: data?.error || 'not_registered',
      })
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [activeEmail, inProgress, isAuthenticated])

  const handleSignIn = async () => {
    if (!authConfigReady) return
    try {
      const intended = getIntendedRedirectFromWindow()
      if (isSafeInternalRedirect(intended)) {
        sessionStorage.setItem(POST_LOGIN_REDIRECT_KEY, intended)
      } else {
        sessionStorage.removeItem(POST_LOGIN_REDIRECT_KEY)
      }
    } catch {
      // ignore
    }
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

  if (authz.status === 'checking') {
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
          <Stack spacing={3} textAlign="center">
            <Heading size="md">Signing you in…</Heading>
            <Text color="gray.600">Checking ODCRM access for your Microsoft account.</Text>
          </Stack>
        </Box>
      </Flex>
    )
  }

  if (authz.status === 'unauthorized') {
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
              This account is not yet registered in ODCRM. Contact an administrator to request
              access.
            </Text>
            <Button colorScheme="gray" onClick={handleSignOut}>
              Sign out
            </Button>
          </Stack>
        </Box>
      </Flex>
    )
  }

  if (authz.status === 'error') {
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
            <Heading size="md">Unable to verify access</Heading>
            <Text color="gray.600">
              Your Microsoft sign-in succeeded, but ODCRM could not verify your registration.
              Please try again or contact an administrator.
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
      {children}
    </>
  )
}
