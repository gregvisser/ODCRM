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
import './index.css'
import theme from './theme'

// Import migration utility for browser console access
import './utils/migrateAccountsToDatabase'

const rootElement = document.getElementById('root')
if (!rootElement) {
  throw new Error('Root element not found')
}

try {
  const msalInstance = msalConfig ? new PublicClientApplication(msalConfig) : null

  const BootFlag = ({ children }: { children: React.ReactNode }) => {
    useEffect(() => {
      window.__odcrm_loaded = true
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
                  <App />
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
