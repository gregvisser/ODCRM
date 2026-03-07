/**
 * Template placeholder rendering service
 * Ported from OpensDoorsV2
 */

export type TemplateVariables = {
  firstName?: string | null;
  lastName?: string | null;
  company?: string | null;
  companyName?: string | null;
  email?: string | null;
  title?: string | null;
  jobTitle?: string | null;
  phone?: string | null;
};

const PLACEHOLDER_KEYS: Array<keyof TemplateVariables> = [
  'firstName',
  'lastName',
  'company',
  'companyName',
  'email',
  'title',
  'jobTitle',
  'phone',
];

/**
 * Resolve effective value for a placeholder key, applying alias fallbacks
 * (company <-> companyName, title <-> jobTitle) so both names get the same value.
 */
function getValueForPlaceholder(key: keyof TemplateVariables, vars: TemplateVariables): string {
  const v = vars[key];
  if (v != null) return String(v);
  if (key === 'company') return vars.companyName != null ? String(vars.companyName) : '';
  if (key === 'companyName') return vars.company != null ? String(vars.company) : '';
  if (key === 'title') return vars.jobTitle != null ? String(vars.jobTitle) : '';
  if (key === 'jobTitle') return vars.title != null ? String(vars.title) : '';
  return '';
}

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
  let out = template;

  for (const key of PLACEHOLDER_KEYS) {
    const value = getValueForPlaceholder(key, vars);
    out = out.replaceAll(`{{${key}}}`, value);
  }

  return out;
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
  });
}

/**
 * Get all placeholders used in a template
 */
export function extractPlaceholders(template: string): string[] {
  const matches = template.match(/\{\{(\w+)\}\}/g) || [];
  return [...new Set(matches.map((m) => m.slice(2, -2)))];
}

/**
 * Render template (alias for applyTemplatePlaceholders for compatibility)
 */
export function renderTemplate(template: string, vars: TemplateVariables): string {
  return applyTemplatePlaceholders(template, vars);
}

/**
 * Escape a string for safe insertion into HTML (prevents XSS when preview is rendered as HTML).
 * Used only for preview API; sending uses raw values.
 */
export function escapeForHtml(value: string): string {
  if (typeof value !== 'string') return '';
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Apply template placeholders with variable values escaped for HTML.
 * Use for preview API only; do not use for actual send (would double-escape in emails).
 */
export function applyTemplatePlaceholdersSafe(
  template: string,
  vars: TemplateVariables
): string {
  const escaped: Partial<TemplateVariables> = {};
  for (const key of PLACEHOLDER_KEYS) {
    const raw = getValueForPlaceholder(key, vars);
    escaped[key as keyof TemplateVariables] = escapeForHtml(raw);
  }
  return applyTemplatePlaceholders(template, escaped as TemplateVariables);
}

/**
 * Inject tracking (placeholder for ODCRM compatibility)
 */
export function injectTracking(html: string, trackingData?: any): string {
  // Placeholder - would inject tracking pixel and link rewriting
  return html;
}

export function enforceUnsubscribeFooter(
  htmlBody: string,
  textBody: string | undefined,
  unsubscribeUrl: string
): { htmlBody: string; textBody: string | undefined } {
  const marker = 'data-odcrm-unsubscribe-footer="true"'
  const safeHtml = typeof htmlBody === 'string' ? htmlBody : ''
  const safeText = typeof textBody === 'string' ? textBody : undefined
  const alreadyHasFooter =
    safeHtml.includes(marker) ||
    safeHtml.includes(unsubscribeUrl)

  let nextHtml = safeHtml
  if (!alreadyHasFooter) {
    const escapedUrl = unsubscribeUrl.replace(/"/g, '&quot;')
    nextHtml +=
      `<div ${marker} style="margin-top:24px;font-size:12px;color:#666;">` +
      `If you no longer wish to receive these emails, ` +
      `<a href="${escapedUrl}">unsubscribe here</a>.` +
      `</div>`
  }

  let nextText = safeText
  if (typeof nextText === 'string') {
    const alreadyHasTextFooter =
      nextText.toLowerCase().includes('unsubscribe') ||
      nextText.includes(unsubscribeUrl)
    if (!alreadyHasTextFooter) {
      nextText += `\n\nTo unsubscribe: ${unsubscribeUrl}`
    }
  }

  return { htmlBody: nextHtml, textBody: nextText }
}
