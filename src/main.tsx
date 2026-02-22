import { StrictMode, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { ChakraProvider } from '@chakra-ui/react'
import { PublicClientApplication } from '@azure/msal-browser'
import { MsalProvider } from '@azure/msal-react'
import App from './App.tsx'
import AuthGate from './auth/AuthGate'
import LoginPage from './auth/LoginPage'
import { msalConfig } from './auth/msalConfig'
import ErrorBoundary from './components/ErrorBoundary'
import { UserPreferencesProvider } from './contexts/UserPreferencesContext'
import { BUILD_SHA, BUILD_TIME } from './version'
import './index.css'
import DiagPage from './pages/DiagPage'
import theme from './theme'

declare global {
  interface Window {
    __ODCRM_BUILD__?: { sha: string; time: string }
    __ODCRM_LAST_FATAL__?: { time: string; message: string; stack?: string; source?: string }
  }
}

const LAST_FATAL_KEY = 'odcrm:lastFatal'

function setLastFatal(payload: { time: string; message: string; stack?: string; source?: string }) {
  try {
    const s = JSON.stringify(payload)
    localStorage.setItem(LAST_FATAL_KEY, s)
    window.__ODCRM_LAST_FATAL__ = payload
  } catch {
    window.__ODCRM_LAST_FATAL__ = payload
  }
}

function installFatalHandlers() {
  window.addEventListener('error', (event) => {
    setLastFatal({
      time: new Date().toISOString(),
      message: event.message ?? String(event.error),
      stack: event.error?.stack,
      source: event.filename ? `${event.filename}:${event.lineno}:${event.colno}` : undefined,
    })
  })
  window.addEventListener('unhandledrejection', (event) => {
    const message = event.reason?.message ?? (typeof event.reason === 'string' ? event.reason : String(event.reason))
    setLastFatal({
      time: new Date().toISOString(),
      message: `Unhandled rejection: ${message}`,
      stack: event.reason?.stack,
      source: undefined,
    })
  })
}
installFatalHandlers()

// Import migration utility for browser console access
import './utils/migrateAccountsToDatabase'

const rootElement = document.getElementById('root')
if (!rootElement) {
  throw new Error('Root element not found')
}

try {
  const isDiagPath = typeof window !== 'undefined' && window.location.pathname.startsWith('/__diag')

  if (isDiagPath) {
    window.__ODCRM_BUILD__ = { sha: BUILD_SHA, time: BUILD_TIME }
    createRoot(rootElement).render(
      <StrictMode>
        <ChakraProvider theme={theme}>
          <DiagPage />
        </ChakraProvider>
      </StrictMode>,
    )
  } else {
    const msalInstance = msalConfig ? new PublicClientApplication(msalConfig) : null

    const BootFlag = ({ children }: { children: React.ReactNode }) => {
      useEffect(() => {
        window.__odcrm_loaded = true
        window.__ODCRM_BUILD__ = { sha: BUILD_SHA, time: BUILD_TIME }
      }, [])
      return <>{children}</>
    }

    createRoot(rootElement).render(
      <StrictMode>
        <ChakraProvider theme={theme}>
          <ErrorBoundary>
            <BootFlag>
              {msalInstance ? (
                <MsalProvider instance={msalInstance}>
                  <AuthGate>
                    <UserPreferencesProvider>
                      <App />
                    </UserPreferencesProvider>
                  </AuthGate>
                </MsalProvider>
              ) : (
                <LoginPage onSignIn={() => undefined} showConfigWarning disableSignIn />
              )}
            </BootFlag>
          </ErrorBoundary>
        </ChakraProvider>
      </StrictMode>,
    )
  }
} catch (error) {
  console.error('❌ Failed to render app:', error)
  rootElement.innerHTML = `
    <div style="padding: 20px; font-family: sans-serif; text-align: center;">
      <h1>Failed to Load Application</h1>
      <p>Please check the browser console (F12) for errors.</p>
      <button onclick="window.location.reload()" style="padding: 10px 20px; margin-top: 10px; cursor: pointer;">Reload Page</button>
    </div>
  `
}
