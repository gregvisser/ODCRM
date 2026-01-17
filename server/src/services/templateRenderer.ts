/**
 * Template placeholder rendering service
 * Ported from OpensDoorsV2
 */

export type TemplateVariables = {
  firstName?: string | null
  lastName?: string | null
  company?: string | null
  companyName?: string | null
  email?: string | null
  title?: string | null
  jobTitle?: string | null
  phone?: string | null
}

const PLACEHOLDER_KEYS: Array<keyof TemplateVariables> = [
  'firstName',
  'lastName',
  'company',
  'companyName',
  'email',
  'title',
  'jobTitle',
  'phone',
]

/**
 * Apply template placeholders like {{firstName}}, {{company}}, etc.
 * @param template - Template string with {{placeholder}} syntax
 * @param vars - Variable values to replace
 * @returns Rendered template with placeholders replaced
 */
export function applyTemplatePlaceholders(
  template: string,
  vars: TemplateVariables
): string {
  let out = template

  for (const key of PLACEHOLDER_KEYS) {
    const value = vars[key] ?? ''
    out = out.replaceAll(`{{${key}}}`, value)
  }

  // Also support {{companyName}} → {{company}} fallback
  if (vars.companyName && !vars.company) {
    out = out.replaceAll('{{company}}', vars.companyName)
  }
  if (vars.company && !vars.companyName) {
    out = out.replaceAll('{{companyName}}', vars.company)
  }

  // Support {{jobTitle}} → {{title}} fallback
  if (vars.jobTitle && !vars.title) {
    out = out.replaceAll('{{title}}', vars.jobTitle)
  }
  if (vars.title && !vars.jobTitle) {
    out = out.replaceAll('{{jobTitle}}', vars.title)
  }

  return out
}

/**
 * Preview template with sample data
 */
export function previewTemplate(template: string): string {
  return applyTemplatePlaceholders(template, {
    firstName: 'John',
    lastName: 'Doe',
    company: 'Acme Corp',
    companyName: 'Acme Corp',
    email: 'john.doe@acme.com',
    title: 'CEO',
    jobTitle: 'CEO',
    phone: '+1-555-0100',
  })
}

/**
 * Get all placeholders used in a template
 */
export function extractPlaceholders(template: string): string[] {
  const matches = template.match(/\{\{(\w+)\}\}/g) || []
  return [...new Set(matches.map((m) => m.slice(2, -2)))]
}

/**
 * Render template (alias for applyTemplatePlaceholders for compatibility)
 */
export function renderTemplate(template: string, vars: TemplateVariables): string {
  return applyTemplatePlaceholders(template, vars)
}

/**
 * Inject tracking (placeholder for ODCRM compatibility)
 */
export function injectTracking(html: string, trackingData?: any): string {
  // Placeholder - would inject tracking pixel and link rewriting
  return html
}
