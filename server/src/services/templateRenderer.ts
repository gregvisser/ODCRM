/**
 * Template placeholder rendering service
 * Ported from OpensDoorsV2
 */

export type TemplateVariables = {
  firstName?: string | null;
  first_name?: string | null;
  lastName?: string | null;
  last_name?: string | null;
  fullName?: string | null;
  full_name?: string | null;
  contactName?: string | null;
  contact_name?: string | null;
  company?: string | null;
  companyName?: string | null;
  company_name?: string | null;
  accountName?: string | null;
  account_name?: string | null;
  email?: string | null;
  title?: string | null;
  jobTitle?: string | null;
  role?: string | null;
  phone?: string | null;
  website?: string | null;
  senderName?: string | null;
  sender_name?: string | null;
  senderEmail?: string | null;
  sender_email?: string | null;
  unsubscribeLink?: string | null;
  unsubscribe_link?: string | null;
  emailSignature?: string | null;
  email_signature?: string | null;
  senderSignature?: string | null;
  sender_signature?: string | null;
  /** Sending tenant / client org (not the recipient's company) */
  sender_company_name?: string | null;
  senderCompanyName?: string | null;
  client_name?: string | null;
  clientName?: string | null;
};

const PREVIEW_TEMPLATE_DEFAULTS: TemplateVariables = {
  first_name: 'Alex',
  last_name: 'Taylor',
  full_name: 'Alex Taylor',
  company_name: 'Acme Ltd',
  email: 'alex.taylor@acme.example',
  role: 'Operations Director',
  phone: '+1-555-0100',
  website: 'https://acme.example',
  sender_name: 'Jordan Reed',
  sender_email: 'jordan@opendoors.example',
  sender_company_name: 'Sample Client Ltd',
  unsubscribe_link: 'https://example.com/unsubscribe',
  email_signature:
    '<div><strong>{{sender_name}}</strong><br/><a href="mailto:{{sender_email}}">{{sender_email}}</a><br/><a href="{{unsubscribe_link}}">Unsubscribe</a></div>',
};

const PLACEHOLDER_PATTERN = /\{\{\s*([\w]+)\s*\}\}/g;

const SUPPORTED_PLACEHOLDER_KEYS = [
  'first_name',
  'last_name',
  'full_name',
  'company_name',
  'role',
  'website',
  'sender_name',
  'sender_email',
  'sender_company_name',
  'senderCompanyName',
  'client_name',
  'clientName',
  'unsubscribe_link',
  'email_signature',
  'email',
  'phone',
  'firstName',
  'lastName',
  'fullName',
  'contactName',
  'company',
  'companyName',
  'accountName',
  'title',
  'jobTitle',
  'senderName',
  'senderEmail',
  'unsubscribeLink',
  'emailSignature',
  'senderSignature',
] as const;

type SupportedPlaceholderKey = (typeof SUPPORTED_PLACEHOLDER_KEYS)[number];

function normalizeValue(value: string | null | undefined): string {
  return value == null ? '' : String(value).trim();
}

function normalizePlaceholderKey(rawKey: string): string {
  return String(rawKey || '').trim().replace(/[\s_]+/g, '').toLowerCase();
}

function getFirstNonEmpty(...values: Array<string | null | undefined>): string {
  for (const value of values) {
    const normalized = normalizeValue(value);
    if (normalized) return normalized;
  }
  return '';
}

function buildFullName(vars: TemplateVariables): string {
  const explicit = getFirstNonEmpty(vars.full_name, vars.fullName, vars.contact_name, vars.contactName);
  if (explicit) return explicit;
  return [normalizeValue(vars.first_name ?? vars.firstName), normalizeValue(vars.last_name ?? vars.lastName)]
    .filter(Boolean)
    .join(' ')
    .trim();
}

function getCanonicalPlaceholderValue(key: SupportedPlaceholderKey, vars: TemplateVariables): string {
  const firstName = getFirstNonEmpty(vars.first_name, vars.firstName);
  const lastName = getFirstNonEmpty(vars.last_name, vars.lastName);
  const fullName = buildFullName(vars);
  const companyName = getFirstNonEmpty(
    vars.company_name,
    vars.companyName,
    vars.company,
    vars.account_name,
    vars.accountName
  );
  const role = getFirstNonEmpty(vars.role, vars.jobTitle, vars.title);
  const senderEmail = getFirstNonEmpty(vars.sender_email, vars.senderEmail);
  const senderName = getFirstNonEmpty(vars.sender_name, vars.senderName, senderEmail);
  const senderCompanyName = getFirstNonEmpty(
    vars.sender_company_name,
    vars.senderCompanyName,
    vars.client_name,
    vars.clientName
  );
  const unsubscribeLink = getFirstNonEmpty(vars.unsubscribe_link, vars.unsubscribeLink);
  const emailSignature = renderSignatureHtml(vars);

  switch (key) {
    case 'first_name':
    case 'firstName':
      return firstName;
    case 'last_name':
    case 'lastName':
      return lastName;
    case 'full_name':
    case 'fullName':
    case 'contactName':
      return fullName;
    case 'company_name':
    case 'companyName':
    case 'company':
    case 'accountName':
      return companyName;
    case 'role':
    case 'title':
    case 'jobTitle':
      return role;
    case 'website':
      return normalizeValue(vars.website);
    case 'sender_name':
    case 'senderName':
      return senderName;
    case 'sender_email':
    case 'senderEmail':
      return senderEmail;
    case 'sender_company_name':
    case 'senderCompanyName':
    case 'client_name':
    case 'clientName':
      return senderCompanyName;
    case 'unsubscribe_link':
    case 'unsubscribeLink':
      return unsubscribeLink;
    case 'email_signature':
    case 'emailSignature':
    case 'senderSignature':
      return emailSignature;
    case 'email':
      return normalizeValue(vars.email);
    case 'phone':
      return normalizeValue(vars.phone);
    default:
      return '';
  }
}

const NORMALIZED_PLACEHOLDER_ALIASES: Record<string, SupportedPlaceholderKey> = {
  firstname: 'first_name',
  lastname: 'last_name',
  fullname: 'full_name',
  contactname: 'full_name',
  company: 'company_name',
  companyname: 'company_name',
  accountname: 'company_name',
  role: 'role',
  title: 'role',
  jobtitle: 'role',
  website: 'website',
  sendername: 'sender_name',
  senderemail: 'sender_email',
  sendercompanyname: 'sender_company_name',
  clientname: 'sender_company_name',
  unsubscribelink: 'unsubscribe_link',
  emailsignature: 'email_signature',
  sendersignature: 'email_signature',
  email: 'email',
  phone: 'phone',
};

function renderSignatureHtml(vars: TemplateVariables): string {
  const signatureTemplate = getFirstNonEmpty(
    vars.email_signature,
    vars.emailSignature,
    vars.sender_signature,
    vars.senderSignature
  );
  if (!signatureTemplate) return '';

  return applyTemplatePlaceholders(signatureTemplate, {
    ...vars,
    email_signature: '',
    emailSignature: '',
    sender_signature: '',
    senderSignature: '',
  });
}

/**
 * Resolve effective value for a placeholder key, applying alias fallbacks
 * (company <-> companyName, title <-> jobTitle) so both names get the same value.
 */
function getValueForPlaceholder(rawKey: string, vars: TemplateVariables): string | null {
  const canonicalKey = NORMALIZED_PLACEHOLDER_ALIASES[normalizePlaceholderKey(rawKey)];
  if (!canonicalKey) return null;
  return getCanonicalPlaceholderValue(canonicalKey, vars);
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
  return String(template || '').replace(PLACEHOLDER_PATTERN, (match, rawKey: string) => {
    const value = getValueForPlaceholder(rawKey, vars);
    return value == null ? match : value;
  });
}

function renderHtmlUnsubscribePlaceholder(template: string, rendered: string, unsubscribeUrl: string): string {
  const marker = '__ODCRM_UNSUBSCRIBE_LINK__'
  const normalizedTemplate = String(template || '')
  const hadUnsubscribePlaceholder =
    /\{\{\s*(unsubscribeLink|unsubscribe_link)\s*\}\}/.test(normalizedTemplate) || normalizedTemplate.includes(marker)
  if (!hadUnsubscribePlaceholder) {
    return rendered
  }

  const safeUrl = escapeForHtml(unsubscribeUrl)
  return rendered
    .replaceAll(`"${marker}"`, `"${safeUrl}"`)
    .replaceAll(`'${marker}'`, `'${safeUrl}'`)
    .replaceAll(marker, `<a href="${safeUrl}">Unsubscribe</a>`)
}

export function applyTemplatePlaceholdersHtml(
  template: string,
  vars: TemplateVariables
): string {
  const marker = '__ODCRM_UNSUBSCRIBE_LINK__'
  const unsubscribeUrl = getFirstNonEmpty(vars.unsubscribe_link, vars.unsubscribeLink)
  const templateWithMarker = String(template || '').replace(/\{\{\s*(unsubscribeLink|unsubscribe_link)\s*\}\}/g, marker)
  const rendered = applyTemplatePlaceholders(templateWithMarker, vars)
  if (!unsubscribeUrl) return rendered
  return renderHtmlUnsubscribePlaceholder(templateWithMarker, rendered, unsubscribeUrl)
}

/**
 * Preview template with sample data
 */
export function previewTemplate(template: string): string {
  return applyTemplatePlaceholders(template, buildPreviewTemplateVariables());
}

export function buildPreviewTemplateVariables(
  overrides: Partial<TemplateVariables> = {}
): TemplateVariables {
  return {
    ...PREVIEW_TEMPLATE_DEFAULTS,
    ...overrides,
  };
}

/**
 * Get all placeholders used in a template
 */
export function extractPlaceholders(template: string): string[] {
  const matches = Array.from(String(template || '').matchAll(PLACEHOLDER_PATTERN));
  return [...new Set(matches.map((match) => (match[1] || '').trim()).filter(Boolean))];
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
  for (const key of SUPPORTED_PLACEHOLDER_KEYS) {
    const value = getCanonicalPlaceholderValue(key, vars);
    const shouldPreserveHtml = key === 'email_signature' || key === 'emailSignature' || key === 'senderSignature';
    escaped[key as keyof TemplateVariables] = shouldPreserveHtml ? value : escapeForHtml(value);
  }
  return applyTemplatePlaceholders(template, escaped as TemplateVariables);
}

export function applyTemplatePlaceholdersSafeHtml(
  template: string,
  vars: TemplateVariables
): string {
  const marker = '__ODCRM_UNSUBSCRIBE_LINK__'
  const templateWithMarker = String(template || '').replace(/\{\{\s*(unsubscribeLink|unsubscribe_link)\s*\}\}/g, marker)
  const escaped: Partial<TemplateVariables> = {}
  for (const key of SUPPORTED_PLACEHOLDER_KEYS) {
    const value = getCanonicalPlaceholderValue(key, vars)
    const shouldPreserveHtml = key === 'email_signature' || key === 'emailSignature' || key === 'senderSignature'
    escaped[key as keyof TemplateVariables] = shouldPreserveHtml ? value : escapeForHtml(value)
  }
  const rendered = applyTemplatePlaceholders(templateWithMarker, escaped as TemplateVariables)
  const unsubscribeUrl = getFirstNonEmpty(vars.unsubscribe_link, vars.unsubscribeLink)
  if (!unsubscribeUrl) return rendered
  return renderHtmlUnsubscribePlaceholder(templateWithMarker, rendered, unsubscribeUrl)
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
