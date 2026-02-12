import { useEffect, useMemo, useState } from 'react'
import { Box, Button, Flex, Heading, Stack, Text } from '@chakra-ui/react'
import { InteractionStatus } from '@azure/msal-browser'
import { useIsAuthenticated, useMsal } from '@azure/msal-react'
import LoginPage from './LoginPage'
import { authConfigReady, loginRequest } from './msalConfig'

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
  const apiBaseUrl = import.meta.env.VITE_API_URL?.trim() || ''

  const activeAccount = accounts[0]
  const activeEmail = useMemo(() => extractEmailFromMsalAccount(accounts[0]), [accounts])

  useEffect(() => {
    if (accounts[0]) {
      instance.setActiveAccount(accounts[0])
    }
  }, [accounts, instance])

  useEffect(() => {
    // Authorize against ODCRM users table (DB source of truth)
    // IMPORTANT: In production this project calls a separate API (App Service).
    // Azure SWA identity headers won't be present in that case, so we send a
    // Microsoft token and let the backend verify it.
    let cancelled = false
    const run = async () => {
      if (!isAuthenticated || inProgress !== InteractionStatus.None) return
      setAuthz({ status: 'checking' })
      let token: string | null = null
      try {
        const result = await instance.acquireTokenSilent({
          ...loginRequest,
          account: activeAccount,
        })
        token = (result as any)?.idToken || (result as any)?.accessToken || null
      } catch {
        // If silent token acquisition fails, MSAL will handle prompting on the next interaction.
        token = null
      }

      const urlsToTry = [
        apiBaseUrl ? `${apiBaseUrl}/api/users/me` : null,
        '/api/users/me',
      ].filter(Boolean) as string[]

      let lastError: { status?: number; message: string } | null = null
      let data: any = null

      for (const url of urlsToTry) {
        try {
          const res = await fetch(url, {
            method: 'GET',
            headers: token ? { Authorization: `Bearer ${token}` } : undefined,
            cache: 'no-store',
          })

          if (res.status === 404) {
            // Try next URL (e.g., SWA proxy not configured)
            lastError = { status: 404, message: 'Not found' }
            continue
          }

          const contentType = res.headers.get('content-type') || ''
          const body = contentType.includes('application/json') ? await res.json() : null
          if (!res.ok) {
            const message =
              body?.message || body?.error || `HTTP ${res.status}`
            lastError = { status: res.status, message }
            continue
          }

          data = body
          lastError = null
          break
        } catch (e: any) {
          lastError = { message: e?.message || 'Network error' }
        }
      }

      if (cancelled) return

      if (data?.authorized) {
        setAuthz({ status: 'authorized', email: data.email || activeEmail || undefined })
        return
      }

      if (lastError?.status === 403) {
        setAuthz({
          status: 'unauthorized',
          email: data?.email || activeEmail || undefined,
          reason: data?.error || 'not_registered',
        })
        return
      }

      if (lastError?.status === 401) {
        setAuthz({
          status: 'error',
          email: activeEmail || undefined,
          message: 'ODCRM could not verify your Microsoft session. Please sign out and sign in again.',
        })
        return
      }

      setAuthz({
        status: 'error',
        email: activeEmail || undefined,
        message: lastError?.message || 'Unable to verify registration',
      })
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [activeAccount, activeEmail, apiBaseUrl, inProgress, instance, isAuthenticated])

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
