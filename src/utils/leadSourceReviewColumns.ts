/**
 * Lead Sources — batch contacts review table: priority columns and stable headers.
 * Canonical row keys from the API follow leadSourcesCanonicalMapping (camelCase);
 * we match via normKey (lowercase, no separators) consistently with LeadSourcesTabNew.
 */

/** Norm-keys used after normalizing API column names (normKey('firstName') → 'firstname'). */
export const REVIEW_COLUMN_BATCH = '__review_batch__'
export const REVIEW_COLUMN_CONTACT_NUMBER = '__review_contact_number__'

/** Operator-facing header labels (never raw sheet fragments or ambiguous camelCase in review mode). */
export const REVIEW_HEADER: Record<string, string> = {
  [REVIEW_COLUMN_BATCH]: 'Batch name',
  firstname: 'First Name',
  lastname: 'Last Name',
  companyname: 'Company',
  email: 'Email',
  jobtitle: 'Role',
  [REVIEW_COLUMN_CONTACT_NUMBER]: 'Contact number',
}

/** Default review order (logical). Only columns that exist in the row set are shown. */
const REVIEW_DATA_KEYS = [
  'firstname',
  'lastname',
  'companyname',
  'jobtitle',
  'email',
  REVIEW_COLUMN_CONTACT_NUMBER,
] as const

export type ReviewColumnDef =
  | { normKey: typeof REVIEW_COLUMN_BATCH; header: string }
  | { normKey: typeof REVIEW_COLUMN_CONTACT_NUMBER; header: string }
  | { normKey: 'firstname' | 'lastname' | 'companyname' | 'email' | 'jobtitle'; header: string }

export function buildReviewColumnDefs(normalizedColumnSet: Set<string>): ReviewColumnDef[] {
  const has = (k: string) => normalizedColumnSet.has(k)
  const out: ReviewColumnDef[] = [{ normKey: REVIEW_COLUMN_BATCH, header: REVIEW_HEADER[REVIEW_COLUMN_BATCH] }]

  for (const key of REVIEW_DATA_KEYS) {
    if (key === REVIEW_COLUMN_CONTACT_NUMBER) {
      if (has('mobile') || has('directphone') || has('officephone')) {
        out.push({ normKey: REVIEW_COLUMN_CONTACT_NUMBER, header: REVIEW_HEADER[REVIEW_COLUMN_CONTACT_NUMBER] })
      }
      continue
    }
    if (has(key)) {
      out.push({ normKey: key, header: REVIEW_HEADER[key] })
    }
  }
  return out
}

export function contactNumberCell(row: Record<string, string>): string {
  return (row.mobile ?? row.directphone ?? row.officephone ?? '').trim()
}

/** Narrow default for “Choose columns” recommended: sequencing-relevant fields only (not every sheet column). */
export function getRecommendedContactNormKeys(normalizedColumns: string[]): string[] {
  const want = ['firstname', 'lastname', 'companyname', 'jobtitle', 'email', 'mobile', 'directphone', 'officephone']
  const have = new Set(normalizedColumns)
  return want.filter((k) => have.has(k))
}

/** Human label for wide mode — avoids showing confusing raw keys where we know the intent. */
export function humanizeLeadSourceNormHeader(normCol: string, originalHeader: string): string {
  if (normCol === REVIEW_COLUMN_CONTACT_NUMBER) return REVIEW_HEADER[REVIEW_COLUMN_CONTACT_NUMBER]
  const preset = REVIEW_HEADER[normCol]
  if (preset) return preset
  const common: Record<string, string> = {
    firstname: 'First name',
    lastname: 'Last name',
    linkedinurl: 'LinkedIn',
    client: 'Client',
    campaigns: 'Campaigns',
    mobile: 'Mobile',
    directphone: 'Direct phone',
    officephone: 'Office phone',
    country: 'Country',
    city: 'City',
  }
  if (common[normCol]) return common[normCol]
  if (originalHeader && originalHeader.trim()) return originalHeader.trim()
  return normCol
}
