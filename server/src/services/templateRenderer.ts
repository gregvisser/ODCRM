import { Contact, EmailCampaignTemplate } from '@prisma/client'

/**
 * Render email template with contact variables
 */
export function renderTemplate(
  template: EmailCampaignTemplate,
  contact: Contact
): { subject: string; htmlBody: string; textBody?: string } {
  const variables: Record<string, string> = {
    firstName: contact.firstName || '',
    lastName: contact.lastName || '',
    fullName: `${contact.firstName || ''} ${contact.lastName || ''}`.trim(),
    companyName: contact.companyName || '',
    jobTitle: contact.jobTitle || '',
    email: contact.email || ''
  }

  // Replace variables in subject
  let subject = template.subjectTemplate
  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g')
    subject = subject.replace(regex, value)
  }

  // Replace variables in HTML body
  let htmlBody = template.bodyTemplateHtml
  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g')
    htmlBody = htmlBody.replace(regex, escapeHtml(value))
  }

  // Replace variables in text body (if available)
  let textBody = template.bodyTemplateText ?? undefined
  if (textBody) {
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g')
      textBody = textBody.replace(regex, value)
    }
  }

  return { subject, htmlBody, textBody }
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  }
  return text.replace(/[&<>"']/g, (m) => map[m])
}

/**
 * Inject tracking pixel and unsubscribe link into HTML body
 */
export function injectTracking(
  htmlBody: string,
  campaignProspectId: string,
  trackingDomain: string
): string {
  // Generate simple token for unsubscribe (in production, use proper signing)
  const unsubscribeToken = Buffer.from(campaignProspectId).toString('base64').replace(/[+/=]/g, '')

  // Inject tracking pixel before closing body tag
  const trackingPixel = `
    <img src="${trackingDomain}/api/email/open?cpid=${campaignProspectId}&e=${encodeURIComponent(campaignProspectId)}" 
         width="1" height="1" style="display:none;" alt="" />
  `

  // Inject unsubscribe link
  const unsubscribeLink = `
    <p style="font-size: 12px; color: #666; margin-top: 20px;">
      <a href="${trackingDomain}/unsubscribe?cpid=${campaignProspectId}&token=${unsubscribeToken}" 
         style="color: #666; text-decoration: underline;">
        Unsubscribe from this email list
      </a>
    </p>
  `

  // Insert before closing body tag, or append if no body tag
  if (htmlBody.includes('</body>')) {
    htmlBody = htmlBody.replace('</body>', trackingPixel + unsubscribeLink + '</body>')
  } else {
    htmlBody += trackingPixel + unsubscribeLink
  }

  return htmlBody
}

/**
 * Extract reply snippet from message body
 */
export function extractReplySnippet(body: string, maxLength: number = 300): string {
  // Remove HTML tags if present
  const textOnly = body.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()

  if (textOnly.length <= maxLength) {
    return textOnly
  }

  // Try to find a sentence boundary near maxLength
  const truncated = textOnly.substring(0, maxLength)
  const lastPeriod = truncated.lastIndexOf('.')
  const lastExclamation = truncated.lastIndexOf('!')
  const lastQuestion = truncated.lastIndexOf('?')
  const lastSentenceEnd = Math.max(lastPeriod, lastExclamation, lastQuestion)

  if (lastSentenceEnd > maxLength * 0.7) {
    return truncated.substring(0, lastSentenceEnd + 1)
  }

  return truncated + '...'
}
