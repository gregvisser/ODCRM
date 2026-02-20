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
    const value = vars[key] == null ? '' : String(vars[key]);
    out = out.replaceAll(`{{${key}}}`, value);
  }

  // Also support {{companyName}} -> {{company}} fallback
  if (vars.companyName && !vars.company) {
    out = out.replaceAll('{{company}}', vars.companyName);
  }
  if (vars.company && !vars.companyName) {
    out = out.replaceAll('{{companyName}}', vars.company);
  }

  // Support {{jobTitle}} -> {{title}} fallback
  if (vars.jobTitle && !vars.title) {
    out = out.replaceAll('{{title}}', vars.jobTitle);
  }
  if (vars.title && !vars.jobTitle) {
    out = out.replaceAll('{{jobTitle}}', vars.title);
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
    const v = vars[key];
    escaped[key as keyof TemplateVariables] =
      v == null ? '' : escapeForHtml(String(v));
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
