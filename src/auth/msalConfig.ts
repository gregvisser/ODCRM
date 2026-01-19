import type { Configuration, RedirectRequest } from '@azure/msal-browser'

const clientId = import.meta.env.VITE_AZURE_CLIENT_ID?.trim()
const tenantId = import.meta.env.VITE_AZURE_TENANT_ID?.trim()
const redirectUri = import.meta.env.VITE_AZURE_REDIRECT_URI?.trim()

const authority = tenantId ? `https://login.microsoftonline.com/${tenantId}` : undefined

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
