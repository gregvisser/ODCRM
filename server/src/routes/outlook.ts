// @ts-nocheck
import express from 'express'
import { randomUUID } from 'crypto'
import { prisma } from '../lib/prisma.js'

const router = express.Router()

// ============================================================================
// OAuth Callback Mode Configuration
// ============================================================================
// OAUTH_CALLBACK_MODE: "frontdoor" (default) or "backend"
//   - frontdoor: redirect URI uses FRONTDOOR_URL (Azure Static Web App proxy)
//   - backend: redirect URI uses BACKEND_BASE_URL (direct to App Service)
// 
// To switch mode in Azure without redeploy:
//   1. Go to Azure Portal → App Service → Configuration → Application settings
//   2. Add/update OAUTH_CALLBACK_MODE to "frontdoor" or "backend"
//   3. Ensure the matching redirect URI is registered in Entra App Registration
//   4. Save and restart the App Service
// ============================================================================
const FRONTDOOR_URL = process.env.FRONTDOOR_URL || 'https://odcrm.bidlow.co.uk'
const BACKEND_BASE_URL = process.env.BACKEND_BASE_URL || 'https://odcrm-api-hkbsfbdzdvezedg8.westeurope-01.azurewebsites.net'
const OAUTH_CALLBACK_MODE = process.env.OAUTH_CALLBACK_MODE || 'frontdoor'

function getOAuthRedirectUri(): string {
  // Explicit REDIRECT_URI env var takes highest precedence (legacy support)
  if (process.env.REDIRECT_URI) {
    return process.env.REDIRECT_URI
  }
  
  // Development mode: use local server
  if (process.env.NODE_ENV === 'development') {
    return 'http://localhost:3001/api/outlook/callback'
  }
  
  // Production: use configured mode
  if (OAUTH_CALLBACK_MODE === 'backend') {
    return `${BACKEND_BASE_URL}/api/outlook/callback`
  }
  
  // Default: frontdoor mode (via Azure Static Web App proxy)
  return `${FRONTDOOR_URL}/api/outlook/callback`
}

type TokenResponse = {
  access_token: string
  refresh_token?: string
  expires_in: number
  id_token?: string
}

type GraphMeResponse = {
  id: string
  displayName?: string
  mail?: string
  userPrincipalName?: string
}

// Initiate Outlook OAuth flow
router.get('/auth', (req, res) => {
  const clientId = process.env.MICROSOFT_CLIENT_ID
  const tenantId = process.env.MICROSOFT_TENANT_ID || 'common'
  
  if (!clientId) {
    return res.status(500).send(`
      <html>
        <head><title>Configuration Error</title></head>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px;">
          <h1>Configuration Error</h1>
          <p>MICROSOFT_CLIENT_ID is not configured. Please check your .env file.</p>
        </body>
      </html>
    `)
  }
  
  // Get customerId from query, header, or default to 'test-customer-1'
  const customerId = (req.query.customerId as string) || 
                     (req.headers['x-customer-id'] as string) || 
                     'test-customer-1'
  
  // Get redirect URI based on OAUTH_CALLBACK_MODE
  const redirectUri = getOAuthRedirectUri()

  const scopes = [
    'https://graph.microsoft.com/User.Read',
    'https://graph.microsoft.com/Mail.Send',
    'https://graph.microsoft.com/Mail.Read',
    'offline_access'
  ].join(' ')

  // Include customerId in state parameter
  const state = Buffer.from(JSON.stringify({ customerId })).toString('base64')

  const authUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize?` +
    `client_id=${encodeURIComponent(clientId!)}&` +
    `response_type=code&` +
    `redirect_uri=${encodeURIComponent(redirectUri)}&` +
    `response_mode=query&` +
    `scope=${encodeURIComponent(scopes)}&` +
    `state=${encodeURIComponent(state)}`

  console.log('🔐 OAuth Auth Request:', {
    redirectUri,
    tenantId,
    customerId,
    scopes
  })

  res.redirect(authUrl)
})

// OAuth callback
router.get('/callback', async (req, res) => {
  // Debug logging - enable via DEBUG=true to verify proxy is working
  if (process.env.DEBUG === 'true') {
    console.log('[DEBUG] OAuth callback hit:', req.protocol + '://' + req.get('host') + req.originalUrl)
  }
  
  try {
    console.log('📥 OAuth Callback:', {
      hasCode: !!req.query.code,
      hasError: !!req.query.error,
      mode: OAUTH_CALLBACK_MODE
    })

    const { code, error, state } = req.query

    if (error) {
      console.error('❌ OAuth Error:', error)
      return res.status(400).send(`
        <html>
          <head><title>OAuth Error</title></head>
          <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px;">
            <h1>OAuth Error</h1>
            <p><strong>Error:</strong> ${error}</p>
            <p><strong>Description:</strong> ${req.query.error_description || 'No description provided'}</p>
            <hr>
            <p><a href="/api/outlook/auth?customerId=test-customer-1">Try again</a></p>
          </body>
        </html>
      `)
    }

    if (!code) {
      console.error('❌ No authorization code received')
      return res.status(400).send(`
        <html>
          <head><title>OAuth Error</title></head>
          <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px;">
            <h1>OAuth Error</h1>
            <p>No authorization code received from Microsoft</p>
            <p>This usually means the OAuth flow was interrupted.</p>
            <hr>
            <p><a href="/api/outlook/auth?customerId=test-customer-1">Try again</a></p>
          </body>
        </html>
      `)
    }

    const clientId = process.env.MICROSOFT_CLIENT_ID
    const clientSecret = process.env.MICROSOFT_CLIENT_SECRET
    const tenantId = process.env.MICROSOFT_TENANT_ID || 'common'
    const redirectUri = getOAuthRedirectUri()

    if (!clientId || !clientSecret) {
      console.error('❌ Missing OAuth credentials:', {
        hasClientId: !!clientId,
        hasClientSecret: !!clientSecret
      })
      return res.status(500).send(`
        <html>
          <head><title>Configuration Error</title></head>
          <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px;">
            <h1>Configuration Error</h1>
            <p>OAuth credentials are not properly configured.</p>
            <p>Please check your .env file for:</p>
            <ul>
              <li>MICROSOFT_CLIENT_ID: ${clientId ? '✅' : '❌ Missing'}</li>
              <li>MICROSOFT_CLIENT_SECRET: ${clientSecret ? '✅' : '❌ Missing'}</li>
            </ul>
          </body>
        </html>
      `)
    }

    // Extract customerId from state parameter
    let customerId = 'test-customer-1' // Default fallback
    if (state) {
      try {
        const stateData = JSON.parse(Buffer.from(state as string, 'base64').toString())
        customerId = stateData.customerId || customerId
      } catch (e) {
        console.warn('⚠️ Failed to parse state, using fallback customerId')
        customerId = (req.query.customerId as string) || 
                     (req.headers['x-customer-id'] as string) || 
                     customerId
      }
    } else {
      customerId = (req.query.customerId as string) || 
                   (req.headers['x-customer-id'] as string) || 
                   customerId
    }

    // Exchange code for tokens
    const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`
    
    // Use the exact same scopes that were requested in the auth URL
    const scopes = [
      'https://graph.microsoft.com/Mail.Send',
      'https://graph.microsoft.com/Mail.Read',
      'offline_access'
    ].join(' ')
    
    const params = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code: code as string,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
      scope: scopes
    })
    
    console.log('🔄 Token Exchange Request:', {
      url: tokenUrl,
      redirect_uri: redirectUri,
      client_id: clientId.substring(0, 8) + '...',
      tenant_id: tenantId,
      has_secret: !!clientSecret,
      scope: scopes
    })

    const tokenResponse = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params.toString()
    })

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text()
      let errorJson
      try {
        errorJson = JSON.parse(errorText)
      } catch (e) {
        // Not JSON, use as text
      }

      console.error('❌ Token Exchange Failed:', {
        status: tokenResponse.status,
        statusText: tokenResponse.statusText,
        error: errorJson || errorText
      })

      // Return a detailed error page
      return res.status(400).send(`
        <html>
          <head><title>OAuth Connection Failed</title></head>
          <body style="font-family: Arial, sans-serif; max-width: 700px; margin: 50px auto; padding: 20px;">
            <h1>OAuth Connection Failed</h1>
            <p><strong>Status:</strong> ${tokenResponse.status} ${tokenResponse.statusText}</p>
            <h2>Error Details:</h2>
            <pre style="background: #f5f5f5; padding: 15px; border-radius: 5px; overflow-x: auto;">${JSON.stringify(errorJson || errorText, null, 2)}</pre>
            <h2>Common Causes:</h2>
            <ul>
              <li><strong>Redirect URI Mismatch:</strong> The redirect URI must match EXACTLY in Azure Portal
                <br>Expected: <code>${redirectUri}</code>
                <br>Azure Portal → Your App → Authentication → Redirect URIs</li>
              <li><strong>Client Secret Wrong:</strong> Make sure you copied the VALUE (not Secret ID)</li>
              <li><strong>Client Secret Expired:</strong> Create a new secret in Azure if it expired</li>
              <li><strong>Authorization Code Expired:</strong> Codes expire quickly, try the flow again</li>
            </ul>
            <hr>
            <p><a href="/api/outlook/auth?customerId=${customerId}">Try again</a></p>
          </body>
        </html>
      `)
    }

    const tokenData = (await tokenResponse.json()) as TokenResponse
    console.log('✅ Token Exchange Successful:', {
      hasAccessToken: !!tokenData.access_token,
      hasRefreshToken: !!tokenData.refresh_token,
      expiresIn: tokenData.expires_in
    })

    // Get user info from Microsoft Graph
    const graphResponse = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`
      }
    })

    if (!graphResponse.ok) {
      const errorText = await graphResponse.text()
      console.error('❌ Failed to fetch user info:', {
        status: graphResponse.status,
        error: errorText
      })
      return res.status(400).send(`
        <html>
          <head><title>OAuth Error</title></head>
          <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px;">
            <h1>OAuth Error</h1>
            <p>Failed to fetch user information from Microsoft Graph</p>
            <p><strong>Status:</strong> ${graphResponse.status}</p>
            <pre>${errorText}</pre>
            <hr>
            <p><a href="/api/outlook/auth?customerId=${customerId}">Try again</a></p>
          </body>
        </html>
      `)
    }

    const userData = (await graphResponse.json()) as GraphMeResponse
    console.log('✅ User Info Retrieved:', {
      email: userData.mail || userData.userPrincipalName,
      displayName: userData.displayName
    })

    // Extract tenant ID from token
    const tenantIdFromToken = tokenData.id_token ? 
      JSON.parse(Buffer.from(tokenData.id_token.split('.')[1], 'base64').toString()).tid : 
      null

    // Create or update EmailIdentity
    const emailAddress = userData.mail || userData.userPrincipalName || ''
    if (!emailAddress) {
      console.error('❌ No email address returned from Graph /me:', userData)
      return res.status(400).send(`
        <html>
          <head><title>OAuth Error</title></head>
          <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px;">
            <h1>OAuth Error</h1>
            <p>Microsoft Graph did not return an email address for this user.</p>
            <p>Please ensure the account has a mailbox and try again.</p>
            <hr>
            <p><a href="/api/outlook/auth?customerId=${customerId}">Try again</a></p>
          </body>
        </html>
      `)
    }

    try {
      // Enforce max 5 connected sender identities per customer (Reply-style safety rail).
      // If this email is already connected, allow re-auth (token refresh/update).
      const existing = await prisma.emailIdentity.findUnique({
        where: {
          customerId_emailAddress: {
            customerId,
            emailAddress
          }
        }
      })

      if (!existing) {
        const activeCount = await prisma.emailIdentity.count({
          where: { customerId, isActive: true }
        })

        if (activeCount >= 5) {
          return res.status(400).send(`
            <html>
              <head><title>Sender Limit Reached</title></head>
              <body style="font-family: Arial, sans-serif; max-width: 700px; margin: 50px auto; padding: 20px;">
                <h1>Sender Limit Reached</h1>
                <p>This customer already has <strong>${activeCount}</strong> active Outlook sender accounts connected.</p>
                <p>For deliverability safety, OpenDoors limits each customer to <strong>5</strong> sender identities.</p>
                <hr>
                <p>
                  You can disconnect an existing sender on the identities page, then try connecting this account again.
                </p>
                <p><a href="/api/outlook/identities?customerId=${customerId}">View connected accounts</a></p>
              </body>
            </html>
          `)
        }
      }

      const identity = await prisma.emailIdentity.upsert({
        where: {
          customerId_emailAddress: {
            customerId,
            emailAddress
          }
        },
        update: {
          displayName: userData.displayName,
          outlookTenantId: tenantIdFromToken || tenantId,
          outlookUserId: userData.id,
          accessToken: tokenData.access_token,
          refreshToken: tokenData.refresh_token,
          tokenExpiresAt: new Date(Date.now() + (tokenData.expires_in * 1000)),
          isActive: true
        },
        create: {
          id: randomUUID(),
          customerId,
          emailAddress,
          displayName: userData.displayName,
          provider: 'outlook',
          outlookTenantId: tenantIdFromToken || tenantId,
          outlookUserId: userData.id,
          accessToken: tokenData.access_token,
          refreshToken: tokenData.refresh_token,
          tokenExpiresAt: new Date(Date.now() + (tokenData.expires_in * 1000)),
          isActive: true,
          dailySendLimit: 150
        }
      })

      console.log('✅ Email Identity Saved:', {
        id: identity.id,
        email: identity.emailAddress,
        customerId: identity.customerId
      })

      // Redirect back to frontend with success message
      const successUrl = new URL(FRONTDOOR_URL)
      successUrl.searchParams.set('oauth', 'success')
      successUrl.searchParams.set('email', emailAddress)
      successUrl.searchParams.set('customerId', customerId)
      
      console.log('🔄 Redirecting to frontend:', successUrl.toString())
      res.redirect(successUrl.toString())
    } catch (dbError: any) {
      console.error('❌ Database Error:', dbError)
      return res.status(500).send(`
        <html>
          <head><title>Database Error</title></head>
          <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px;">
            <h1>Database Error</h1>
            <p>Failed to save email identity to database.</p>
            <p><strong>Error:</strong> ${dbError.message}</p>
            <pre>${dbError.stack}</pre>
            <hr>
            <p><a href="/api/outlook/auth?customerId=${customerId}">Try again</a></p>
          </body>
        </html>
      `)
    }
  } catch (error: any) {
    console.error('❌ OAuth Callback Error:', error)
    res.status(500).send(`
      <html>
        <head><title>OAuth Error</title></head>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px;">
          <h1>Unexpected Error</h1>
          <p><strong>Error:</strong> ${error.message}</p>
          <pre style="background: #f5f5f5; padding: 15px; border-radius: 5px; overflow-x: auto;">${error.stack}</pre>
          <hr>
          <p><a href="/api/outlook/auth?customerId=test-customer-1">Try again</a></p>
        </body>
      </html>
    `)
  }
})

const getCustomerId = (req: express.Request) =>
  (req.body?.customerId as string) ||
  (req.headers['x-customer-id'] as string) ||
  (req.query.customerId as string)

// Create SMTP identity
router.post('/identities', async (req, res, next) => {
  try {
    const {
      customerId,
      emailAddress,
      displayName,
      provider,
      smtpHost,
      smtpPort,
      smtpUsername,
      smtpPassword,
      smtpSecure,
      dailySendLimit,
      isActive
    } = req.body || {}

    const resolvedCustomerId = customerId || getCustomerId(req)
    if (!resolvedCustomerId || !emailAddress) {
      return res.status(400).json({ error: 'Customer ID and email address are required' })
    }

    if (provider && provider !== 'smtp') {
      return res.status(400).json({ error: 'Only SMTP accounts can be created via this endpoint' })
    }

    if (!smtpHost || !smtpUsername || !smtpPassword) {
      return res.status(400).json({ error: 'SMTP host, username, and password are required' })
    }

    const identity = await prisma.emailIdentity.upsert({
      where: {
        customerId_emailAddress: {
          customerId: resolvedCustomerId,
          emailAddress
        }
      },
      update: {
        displayName,
        provider: 'smtp',
        smtpHost,
        smtpPort,
        smtpUsername,
        smtpPassword,
        smtpSecure: smtpSecure ?? false,
        dailySendLimit: dailySendLimit ?? 150,
        isActive: isActive ?? true
      },
      create: {
        id: randomUUID(),
        customerId: resolvedCustomerId,
        emailAddress,
        displayName,
        provider: 'smtp',
        smtpHost,
        smtpPort,
        smtpUsername,
        smtpPassword,
        smtpSecure: smtpSecure ?? false,
        dailySendLimit: dailySendLimit ?? 150,
        isActive: isActive ?? true
      }
    })

    res.json(identity)
  } catch (error) {
    next(error)
  }
})

// List email identities for customer
router.get('/identities', async (req, res, next) => {
  try {
    const customerId = getCustomerId(req)
    if (!customerId) {
      return res.status(400).json({ error: 'Customer ID required' })
    }

    const identities = await prisma.emailIdentity.findMany({
      where: { customerId },
      select: {
        id: true,
        emailAddress: true,
        displayName: true,
        provider: true,
        isActive: true,
        dailySendLimit: true,
        createdAt: true,
        smtpHost: true,
        smtpPort: true,
        smtpUsername: true,
        smtpSecure: true
      },
      orderBy: { createdAt: 'desc' }
    })

    res.json(identities)
  } catch (error) {
    next(error)
  }
})

// Update identity (e.g., daily send limit)
router.patch('/identities/:id', async (req, res, next) => {
  try {
    const customerId = getCustomerId(req)
    const { id } = req.params
    const data = req.body

    const identity = await prisma.emailIdentity.findFirst({
      where: { id, customerId }
    })

    if (!identity) {
      return res.status(404).json({ error: 'Identity not found' })
    }

    const updated = await prisma.emailIdentity.update({
      where: { id },
      data
    })

    res.json(updated)
  } catch (error) {
    next(error)
  }
})

// Disconnect identity
router.delete('/identities/:id', async (req, res, next) => {
  try {
    const customerId = getCustomerId(req)
    const { id } = req.params

    const identity = await prisma.emailIdentity.findFirst({
      where: { id, customerId }
    })

    if (!identity) {
      return res.status(404).json({ error: 'Identity not found' })
    }

    await prisma.emailIdentity.update({
      where: { id },
      data: { isActive: false } as any
    })

    res.json({ message: 'Identity disconnected' })
  } catch (error) {
    next(error)
  }
})

export default router