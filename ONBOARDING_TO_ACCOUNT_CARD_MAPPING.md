# Onboarding → DB → Account Card Mapping (Single Source of Truth)

**Repo:** ODCRM  
**Purpose:** Ensure every field captured in `Customer Onboarding` is persisted in the database and rendered in the Accounts customer drawer (“Account Card”) from `GET /api/customers/:id` with no localStorage truth.

## Canonical read path (Account Card)

- **Customer detail**: `GET /api/customers/:id`
  - Returns: core `Customer` scalar fields, `accountData` JSON, `customerContacts` (customer_contacts table), agreement metadata, and computed `assignedAccountManagerUser` (when `accountData.accountDetails.assignedAccountManagerId` is present).
- **Email sending identities (mailboxes)**: `GET /api/customers/:id/email-identities`
- **Agreement download (reliable open)**: `GET /api/customers/:id/agreement/download` (302 → SAS URL)
- **Other documents download (reliable open)**: `GET /api/customers/:id/attachments/:attachmentId/download` (302 → SAS URL)

## Storage locations (Prisma / Postgres)

### `Customer` scalars (`server/prisma/schema.prisma`)

- **Customer name** → `Customer.name`
- **Domain** → `Customer.domain`
- **Web Address** → `Customer.website`
- **Sector** → `Customer.sector`
- **Lead sheet URL** (“Leads Google Sheet URL” in onboarding) → `Customer.leadsReportingUrl`
- **Lead sheet label** → `Customer.leadsGoogleSheetLabel`
- **Financials/targets** (if used) → `Customer.monthlyIntakeGBP`, `Customer.monthlyRevenueFromCustomer`, `Customer.weeklyLeadTarget`, `Customer.weeklyLeadActual`, `Customer.monthlyLeadTarget`, `Customer.monthlyLeadActual`, `Customer.defcon`
- **Agreement metadata** → `Customer.agreementFileName`, `agreementFileMimeType`, `agreementUploadedAt`, `agreementUploadedByEmail`, `agreementBlobName`, `agreementContainerName`  
  - Legacy URL (not used for opening directly): `Customer.agreementFileUrl`

### `Customer.accountData` (JSON) — onboarding snapshot + extended config

Written by onboarding via `PUT /api/customers/:id/onboarding` with a **safe merge** on the server (preserves `accountData.notes` if omitted).

#### `accountData.accountDetails`

Captured in `src/tabs/onboarding/CustomerOnboardingTab.tsx` as `AccountDetails`:

- **Primary contact snapshot** → `accountData.accountDetails.primaryContact`
  - `{ id, firstName, lastName, email, phone, roleId, roleLabel, status }`
- **Head office address** → `accountData.accountDetails.headOfficeAddress`
- **Head office Place ID** → `accountData.accountDetails.headOfficePlaceId`
- **Head office postcode** → `accountData.accountDetails.headOfficePostcode`
- **Assigned account manager** → `accountData.accountDetails.assignedAccountManagerId` + `assignedAccountManagerName`
- **Assigned Client DDI/Number** → `accountData.accountDetails.assignedClientDdiNumber`
- **Email accounts (string slots)** → `accountData.accountDetails.emailAccounts` (array of strings)
- **Days per week** → `accountData.accountDetails.daysPerWeek`

#### `accountData.clientProfile`

Captured in `src/tabs/onboarding/CustomerOnboardingTab.tsx` as `ClientProfile`:

- **Client history** → `accountData.clientProfile.clientHistory`
- **Accreditations list** → `accountData.clientProfile.accreditations[]`
  - Items include accreditation name and optional evidence file metadata (fileName/fileUrl/blob info depending on upload path)
- **Target Job Sectors** → `accountData.clientProfile.targetJobSectorIds[]` (IDs)
- **Target Job Roles** → `accountData.clientProfile.targetJobRoleIds[]` (IDs)
- **Key business objectives** → `accountData.clientProfile.keyBusinessObjectives`
- **Client USPs** → `accountData.clientProfile.clientUSPs`
- **Social media presence** → `accountData.clientProfile.socialMediaPresence`
  - `{ facebookUrl, linkedinUrl, xUrl, instagramUrl, tiktokUrl, youtubeUrl, websiteUrl }`
- **Qualifying questions** → `accountData.clientProfile.qualifyingQuestions`
- **Case studies / testimonials** → `accountData.clientProfile.caseStudiesOrTestimonials`
- **Case studies attachment** → `accountData.clientProfile.caseStudiesFileName`, `caseStudiesFileUrl`

#### `accountData.targetGeographicalAreas` (multi-select)

- **Target Geographical Areas (multi)** → `accountData.targetGeographicalAreas[]`
  - Array of `{ placeId?: string, label: string }`
  - Canonical key: `(placeId || label).toLowerCase().trim()` (deduped client-side)

#### `accountData.attachments[]` (non-agreement documents)

- **Documents (PDF/DOC/DOCX) metadata** → `accountData.attachments[]`
  - `{ id, type, fileName, fileUrl, mimeType, blobName, containerName, uploadedAt, uploadedByEmail }`

#### `accountData.notes` (must remain intact)

- Notes are stored and appended via a dedicated notes flow; onboarding save must **not** overwrite this subtree.

#### `accountData.progressTracker` (customer-scoped checklists)

- Stored under `accountData.progressTracker` (original Sales/Ops/AM structure) via `PUT /api/customers/:id/progress-tracker`.

### `customer_contacts` table (Prisma model: `CustomerContact`)

Canonical store for onboarding contacts + account-card contacts list:

- Onboarding primary contact snapshot is persisted/upserted into `customer_contacts` during `PUT /api/customers/:id/onboarding` (server-side).
- Additional contacts are upserted/created from onboarding `contacts[]` payload.

### `email_identities` table (Prisma model: `EmailIdentity`)

Canonical store for email sending identities:

- Read in account card via `GET /api/customers/:id/email-identities`.

## Account Card section mapping (display locations)

| Account Card Section | Field (Onboarding) | DB Source |
|---|---|---|
| Account Details | Customer name | `Customer.name` |
| Account Details | Domain | `Customer.domain` |
| Account Details | Web Address (clickable) | `Customer.website` |
| Account Details | Sector | `Customer.sector` |
| Account Details | Leads Google Sheet URL (clickable) | `Customer.leadsReportingUrl` |
| Account Details | Leads Google Sheet Label (clickable to URL) | `Customer.leadsGoogleSheetLabel` + `leadsReportingUrl` |
| Account Details | Assigned Account Manager | computed `assignedAccountManagerUser` (from `accountData.accountDetails.assignedAccountManagerId`) |
| Account Details | Assigned Client DDI & Number | `accountData.accountDetails.assignedClientDdiNumber` |
| Account Details | Days per week | `accountData.accountDetails.daysPerWeek` |
| Client Profile | Client history | `accountData.clientProfile.clientHistory` |
| Client Profile | Accreditations (+ evidence links) | `accountData.clientProfile.accreditations[]` |
| Client Profile | Target Geographical Areas (chips) | `accountData.targetGeographicalAreas[]` |
| Client Profile | Target Job Sectors (labels) | `accountData.clientProfile.targetJobSectorIds[]` + `/api/job-sectors` |
| Client Profile | Target Job Roles (labels) | `accountData.clientProfile.targetJobRoleIds[]` + `/api/job-roles` |
| Client Profile | Key business objectives | `accountData.clientProfile.keyBusinessObjectives` |
| Client Profile | Client USPs | `accountData.clientProfile.clientUSPs` |
| Client Profile | Social media presence (all fields) | `accountData.clientProfile.socialMediaPresence` |
| Client Profile | Qualifying questions | `accountData.clientProfile.qualifyingQuestions` |
| Client Profile | Case studies / testimonials (+ attachment link) | `accountData.clientProfile.caseStudiesOrTestimonials` + file metadata |
| Contacts | Customer contacts (clickable rows) | `customerContacts[]` from `GET /api/customers/:id` |
| Email Accounts | Connected sending identities | `GET /api/customers/:id/email-identities` |
| Documents | Agreement (clickable) | `GET /api/customers/:id/agreement/download` + agreement metadata |
| Documents | Other attachments (clickable) | `accountData.attachments[]` + download redirect endpoint |
| Notes | Notes list + add note (unchanged UI) | `accountData.notes` (append-only; preserve on onboarding save) |

## Duplicate-field policy (UI)

- The Account Card must render **one canonical value per concept**:
  - Web address: **only** `Customer.website` (no fallback derivation from domain).
  - Client Profile + Target Areas: **only** onboarding-backed `accountData.*` (no parallel legacy display).
  - Contacts list: **only** `customer_contacts` (`customerContacts[]` from `GET /api/customers/:id`).

