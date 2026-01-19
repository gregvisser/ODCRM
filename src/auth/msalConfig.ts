import type { Configuration, RedirectRequest } from '@azure/msal-browser'

const clientId = import.meta.env.VITE_AZURE_CLIENT_ID?.trim()
const tenantId = import.meta.env.VITE_AZURE_TENANT_ID?.trim()
const redirectUri = import.meta.env.VITE_AZURE_REDIRECT_URI?.trim()
const authorityOverride = import.meta.env.VITE_AZURE_AUTHORITY?.trim()

const authority =
  authorityOverride ||
  (tenantId ? `https://login.microsoftonline.com/${tenantId}` : 'https://login.microsoftonline.com/organizations')

export const msalConfig: Configuration | null =
  clientId && authority
    ? {
        auth: {
          clientId,
          authority,
          redirectUri: redirectUri || window.location.origin,
        },
        cache: {
          cacheLocation: 'localStorage',
        },
      }
    : null

export const loginRequest: RedirectRequest = {
  scopes: ['openid', 'profile', 'email', 'User.Read'],
}

export const authConfigReady = Boolean(msalConfig)
