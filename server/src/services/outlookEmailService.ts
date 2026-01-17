import { Client } from '@microsoft/microsoft-graph-client'
import { EmailIdentity, EmailMessageMetadata, PrismaClient } from '@prisma/client'
import { prisma } from '../lib/prisma.js'

export interface SendEmailParams {
  senderIdentityId: string
  toEmail: string
  subject: string
  htmlBody: string
  textBody?: string
  customHeaders?: Record<string, string>
  campaignProspectId?: string
}

export interface SendEmailResult {
  success: boolean
  messageId?: string
  threadId?: string
  error?: string
  rawResponse?: any
}

export interface InboxMessage {
  messageId: string
  threadId?: string
  fromAddress: string
  toAddress: string
  subject: string
  body: string
  bodyPreview: string
  receivedDateTime: Date
  headers: Record<string, string>
  internetMessageHeaders?: Array<{ name: string; value: string }>
}

/**
 * Get a Microsoft Graph client for the given EmailIdentity
 */
async function getGraphClient(identity: EmailIdentity): Promise<Client> {
  // Check if token needs refresh
  const now = new Date()
  const expiresAt = identity.tokenExpiresAt ? new Date(identity.tokenExpiresAt) : null
  const needsRefresh = !expiresAt || expiresAt.getTime() < now.getTime() + 5 * 60 * 1000 // Refresh 5 min before expiry

  let accessToken = identity.accessToken

  if (needsRefresh && identity.refreshToken) {
    accessToken = await refreshAccessToken(identity)
  }

  if (!accessToken) {
    throw new Error(`No valid access token for identity ${identity.id}`)
  }

  // Create authentication provider for Microsoft Graph
  // The Graph client expects an AuthProvider function signature: (done) => void
  const client = Client.init({
    authProvider: (done: any) => {
      done(null, accessToken)
    },
  })
  
  return client
}

/**
 * Refresh the access token using refresh token
 */
async function refreshAccessToken(identity: EmailIdentity): Promise<string> {
  const clientId = process.env.MICROSOFT_CLIENT_ID
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET
  const tenantId = identity.outlookTenantId || process.env.MICROSOFT_TENANT_ID || 'common'

  if (!clientId || !clientSecret || !identity.refreshToken) {
    throw new Error('Missing OAuth credentials for token refresh')
  }

  try {
    const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`
    
    const params = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: identity.refreshToken,
      grant_type: 'refresh_token',
      // Delegated token refresh must use delegated scopes (do NOT combine `.default` with resource scopes)
      // Keep this aligned with the scopes used during the initial OAuth authorization (see `routes/outlook.ts`).
      scope: 'https://graph.microsoft.com/User.Read https://graph.microsoft.com/Mail.Send https://graph.microsoft.com/Mail.Read offline_access'
    })

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params.toString()
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Token refresh failed: ${response.status} ${errorText}`)
    }

    const data = (await response.json()) as any

    // Update identity in database
    await prisma.email_identities.update({
      where: { id: identity.id },
      data: {
        accessToken: data.access_token,
        refreshToken: data.refresh_token || identity.refreshToken,
        tokenExpiresAt: new Date(Date.now() + (data.expires_in * 1000))
      }
    })

    return data.access_token
  } catch (error) {
    console.error('Error refreshing token:', error)
    throw error
  }
}

/**
 * Send an email via Microsoft Graph
 */
export async function sendEmail(
  prisma: PrismaClient,
  params: SendEmailParams
): Promise<SendEmailResult> {
  try {
    // Load identity
    const identity = await prisma.email_identities.findUnique({
      where: { id: params.senderIdentityId }
    })

    if (!identity || !identity.isActive) {
      return {
        success: false,
        error: 'Email identity not found or inactive'
      }
    }

    // Get Graph client
    const client = await getGraphClient(identity)

    // Build message
    const message: any = {
      message: {
        subject: params.subject,
        body: {
          contentType: 'HTML',
          content: params.htmlBody
        },
        toRecipients: [
          {
            emailAddress: {
              address: params.toEmail
            }
          }
        ]
      },
      saveToSentItems: true
    }

    // Add custom headers if provided
    if (params.customHeaders || params.campaignProspectId) {
      message.message.internetMessageHeaders = []
      
      if (params.campaignProspectId) {
        message.message.internetMessageHeaders.push({
          name: 'X-CRM-CampaignProspect-Id',
          value: params.campaignProspectId
        })
      }

      if (params.customHeaders) {
        for (const [name, value] of Object.entries(params.customHeaders)) {
          message.message.internetMessageHeaders.push({ name, value })
        }
      }
    }

    // Send email via Microsoft Graph
    const userEmail = identity.outlookUserId || identity.emailAddress
    const response = await client
      .api(`/users/${userEmail}/sendMail`)
      .post(message)

    // Extract message ID from response or fetch sent message
    // Graph API doesn't return message ID directly, so we need to fetch it
    let messageId: string | undefined
    let threadId: string | undefined

    try {
      // Fetch the sent message to get its ID
      const sentMessages = await client
        .api(`/users/${userEmail}/messages`)
        .filter(`subject eq '${params.subject.replace(/'/g, "''")}'`)
        .orderby('sentDateTime desc')
        .top(1)
        .get()

      if (sentMessages.value && sentMessages.value.length > 0) {
        const sentMessage = sentMessages.value[0]
        messageId = sentMessage.id
        threadId = sentMessage.conversationId
      }
    } catch (err) {
      console.warn('Could not fetch sent message ID:', err)
    }

    // Store email metadata
    if (messageId && params.campaignProspectId) {
      await prisma.email_message_metadata.create({
        data: {
          campaignProspectId: params.campaignProspectId,
          senderIdentityId: identity.id,
          providerMessageId: messageId,
          threadId: threadId,
          direction: 'outbound',
          fromAddress: identity.emailAddress,
          toAddress: params.toEmail,
          subject: params.subject
        }
      })
    }

    return {
      success: true,
      messageId,
      threadId,
      rawResponse: response
    }
  } catch (error: any) {
    console.error('Error sending email:', error)
    return {
      success: false,
      error: error.message || 'Unknown error',
      rawResponse: error
    }
  }
}

/**
 * Fetch recent inbox messages for reply detection
 */
export async function fetchRecentInboxMessages(
  prisma: PrismaClient,
  identityId: string,
  hoursBack: number = 72
): Promise<InboxMessage[]> {
  try {
    const identity = await prisma.email_identities.findUnique({
      where: { id: identityId }
    })

    if (!identity || !identity.isActive) {
      return []
    }

    const client = await getGraphClient(identity)

    // Calculate time filter
    const since = new Date()
    since.setHours(since.getHours() - hoursBack)
    const sinceISO = since.toISOString()

    // Fetch messages from inbox
    const userEmail = identity.outlookUserId || identity.emailAddress
    const response = await client
      .api(`/users/${userEmail}/mailFolders/inbox/messages`)
      .filter(`receivedDateTime ge ${sinceISO}`)
      .expand('internetMessageHeaders')
      .orderby('receivedDateTime desc')
      .top(50) // Limit to 50 most recent
      .get()

    const messages: InboxMessage[] = []

    if (response.value && Array.isArray(response.value)) {
      for (const msg of response.value) {
        // Only process inbound messages (where identity email is in To or Cc)
        const toAddresses = msg.toRecipients?.map((r: any) => r.emailAddress.address.toLowerCase()) || []
        const ccAddresses = msg.ccRecipients?.map((r: any) => r.emailAddress.address.toLowerCase()) || []
        const recipientAddresses = [...toAddresses, ...ccAddresses]
        
        if (!recipientAddresses.includes(identity.emailAddress.toLowerCase())) {
          continue // Skip if not addressed to this identity
        }

        // Extract headers
        const headers: Record<string, string> = {}
        if (msg.internetMessageHeaders) {
          for (const header of msg.internetMessageHeaders) {
            headers[header.name] = header.value
          }
        }

        messages.push({
          messageId: msg.id,
          threadId: msg.conversationId,
          fromAddress: msg.from?.emailAddress?.address || '',
          toAddress: msg.toRecipients?.[0]?.emailAddress?.address || '',
          subject: msg.subject || '',
          body: msg.body?.content || '',
          bodyPreview: msg.bodyPreview || '',
          receivedDateTime: new Date(msg.receivedDateTime),
          headers,
          internetMessageHeaders: msg.internetMessageHeaders
        })
      }
    }

    return messages
  } catch (error: any) {
    console.error('Error fetching inbox messages:', error)
    return []
  }
}
