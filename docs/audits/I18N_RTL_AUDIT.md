# I18N & RTL Audit — ODCRM

**Objective:** Document the shipped English/Arabic localization defects that were visible in production, then record the corrected implementation scope.

**Guarantee:** No business logic, auth, tenant isolation, routing meaning, DB schema, migrations, permissions, or workflow behavior changes. English remains primary; Arabic is a presentation layer.

---

## 1. Shipped defect summary

- The header language control in `src/App.tsx` shipped as a single outline button inside the scrolling `TabList`, so it looked and behaved like a chip/button instead of a true language toggle.
- RTL direction switching was wired at the document root, but translation coverage stopped early. The shell and a few marketing/onboarding labels used `t()`, while Settings/admin, onboarding account forms, contacts, email-account screens, and visible marketing page content still rendered hardcoded English.
- Arabic mode therefore changed page direction without delivering Arabic page content across the main operator/admin/setup surfaces.

---

## 2. App structure (repo reality)

| Area | Location | Notes |
|------|----------|--------|
| App root | `src/` | Vite + React 18 |
| Entry | `src/main.tsx` | ChakraProvider, MsalProvider, UserPreferencesProvider, AuthGate, App |
| Theme | `src/theme.ts` | Chakra extendTheme (brand, accent, semantic tokens, no RTL/dir) |
| Layout shell | `src/App.tsx` | Single full-width layout: top bar (tabs + logo + Sign out), main content box, footer build stamp |
| Header / user | Top bar in `App.tsx`: TabList (CRM_TOP_TABS), HeaderImagePicker, Badge env, Sign out Button |
| Nav / tabs | `src/contracts/nav.ts` — CRM_TOP_TABS with `id`, `label`, `path`; visibility via `src/utils/crmTopTabsVisibility.ts` |
| Sub-tabs | `src/design-system/components/SubNavigation.tsx` — vertical (desktop) / horizontal (mobile) tabs; items passed as `SubNavItem[]` with `id`, `label`, `icon`, `content` |
| Toasts / alerts | Chakra `useToast`, `<Alert>` used in onboarding and elsewhere |
| Modals / drawers | Chakra Modal, Drawer; no shared i18n wrapper |
| Common UI | `EmptyState`, `LoadingState`, `PageHeader`, `Card` in `src/design-system/components/` |
| Date/number | No shared formatter; ad-hoc `toLocaleString()` / `new Date().toLocaleString()` in components |

---

## 3. Hardcoded UI text — main operator surfaces before this fix

### 2.1 App shell (`App.tsx`)

- Tab labels: from `CRM_TOP_TABS` in `contracts/nav.ts`: "OpensDoors Clients", "OpensDoors Marketing", "Onboarding", "Settings"
- "Sign out"
- Badge: "PRODUCTION" / "DEV"
- Footer: "Build …" (build stamp)
- Client-mode block: "Loading...", "Client mode is not configured yet. Contact admin.", `meError`

### 2.2 Contracts — nav (`src/contracts/nav.ts`)

- `CRM_TOP_TABS[].label`: "OpensDoors Clients", "OpensDoors Marketing", "Onboarding", "Settings"

### 2.3 Marketing home (`MarketingHomePage.tsx`)

- Sub-nav labels: Readiness, Reports, Lead Sources, Suppression List, Email Accounts, Templates, Sequences, Schedules, Inbox
- Guidance: "Start with Readiness…", "If setup or data blockers…", "Open Onboarding setup", "Open Clients data health"
- Button: `readiness.nextStep.label` (from hook), "Open Onboarding setup", "Open Clients data health"

### 2.4 Onboarding home (`OnboardingHomePage.tsx`)

- Sub-nav: "Progress Tracker", "Client Onboarding"
- Section title: "Onboarding"
- Status box: "Onboarding status", "See whether this client…", readiness labels, "Open client details", "Open inbox", "Open reports", "Open sequences", "Review marketing readiness", "Continue onboarding", "Review marketing readiness", "Select a client first."
- Go-live: "Go-live follow-up", "Ready to move forward", "X follow-up item(s) left", "X of Y checks ready", "These checks help confirm…"
- Activation check labels: "Email identities connected", "Suppression list connected", "Lead source connected", "Template and sequence basics ready"
- Badges: "Ready", "Pending", "Missing"
- Alert: "Select a client to begin", "Choose an existing client…"
- `getNextStepButtonLabel()`: all button labels for next step

### 2.5 Common actions (used across tabs)

- Save, Cancel, Close, Create, Update, Delete, Edit, Search, Filter, Refresh, Retry, Back, Next, Open, View, Confirm
- Send Test, Launch, Pause, Resume, Connected, Replace Sheet
- Loading, Loading…, No results, Error states, Success/failure toasts
- Modal titles/descriptions, table column labels, status labels

### 2.6 Design system components

- `SubNavigation`: default `title="Sections"`; aria "Hide/Show … panel"
- `EmptyState`: `title`, `description`, `action.label` (props)
- `LoadingState`: `message` default "Loading..."

### 3.7 Customers home

- Tab labels and view names from `CustomersHomePage` / nav (Accounts, Contacts, etc. if present)

### 3.8 Settings home

- Tab labels and section titles from `SettingsHomePage`

### 3.9 Marketing sub-tabs (components)

- ReadinessTab, ReportsTab, LeadSourcesTabNew, ComplianceTab, EmailAccountsTab, TemplatesTab, SequencesTab, SchedulesTab, InboxTab — each contains many hardcoded strings (table headers, buttons, empty states, errors, toasts)

---

## 4. Current i18n / direction after fix

- **i18n:** Thin custom frontend-only layer in `src/i18n/` with `en.ts` as canonical dictionary, `ar.ts` as additive dictionary, and `t()` fallback `ar -> en -> key`.
- **Direction/RTL:** `LocaleProvider` sets `document.documentElement.dir` and `lang` from the selected locale. Arabic uses `rtl`; English restores `ltr`.
- **Persistence:** Locale is stored in `localStorage` under `odcrm:locale`.

---

## 5. Chakra setup

- `theme.ts`: `extendTheme` with colors, semanticTokens, components (Button, Heading, Tabs, Badge, Table, Input, Select, Textarea, NumberInput), `styles.global` for html/body/#root.
- No `direction` or RTL-specific theme keys. Chakra supports `dir` on `ChakraProvider` or root element for RTL.

---

## 6. Fixed coverage in this ship

- `src/App.tsx`: real `Switch` control with clear `English [toggle] العربية` labels in a fixed non-scrolling header block.
- `src/tabs/settings/SettingsHomePage.tsx`, `src/components/UserAuthorizationTab.tsx`, `src/tabs/settings/TroubleshootingTab.tsx`: settings/admin setup labels, table headers, buttons, helper text, and key modal copy translated.
- `src/tabs/onboarding/CustomerOnboardingTab.tsx` and `src/tabs/onboarding/components/CustomerContactsSection.tsx`: account details, contact labels, lead metrics, suppression setup CTA, client-profile headings, and contacts actions translated.
- `src/components/EmailAccountsEnhancedTab.tsx`, `src/tabs/marketing/components/TemplatesTab.tsx`, `src/tabs/marketing/components/EmailAccountsTab.tsx`, `src/tabs/marketing/components/LeadSourcesTabNew.tsx`, `src/tabs/marketing/components/ComplianceTab.tsx`, `src/tabs/marketing/components/InboxTab.tsx`: first visible page-level marketing/operator content translated so Arabic mode no longer stops at the shell.

---

## 7. Locale persistence

- **User preferences:** `UserPreferencesContext` + `useUserPreferences`; API-backed (`/api/user-preferences`); stores `tabOrders`, `theme`, `sidebarCollapsed`. No `locale` key.
- **Recommendation:** Persist UI locale in `localStorage` only (e.g. `odcrm:locale`) to avoid API/schema changes. Presentation-only; no business impact.

---

## 8. Risk areas

- **TemplatesTab, SequencesTab, SchedulesTab, InboxTab, ComplianceTab, CustomerOnboardingTab:** Dense hardcoded copy; high value for localization.
- **Nav/shell:** Single place for tab labels and "Sign out"; must stay in sync with `contracts/nav` or be derived from translation keys.
- **Toast/alert messages:** Often inline in components; need keyed messages.
- **Mixed LTR content:** Emails, URLs, domains, IDs, phone numbers in tables/cards must remain readable in RTL (CSS `dir="ltr"` or `unicode-bidi` on wrappers).

---

## 9. Inventory summary

| Surface | Source | Localization approach |
|--------|--------|------------------------|
| Top tabs | `contracts/nav.ts` + App | Resolve label via `t(key)` from nav id or dedicated keys |
| Sub-nav items | Per-page (Marketing, Onboarding, etc.) | Pass translated `label` from parent using `t()` |
| Buttons (Save, Cancel, …) | Scattered | Shared keys in dictionary |
| Empty/Loading/Error | Design system + per-tab | Shared keys + optional overrides |
| Marketing/Onboarding copy | MarketingHomePage, OnboardingHomePage | Keyed strings |
| Tables, modals, toasts | Each tab component | Keyed strings |

---

**Last updated:** 2026-03-16  
**Status:** Updated after replacing the fake language button with a real toggle and expanding Arabic coverage across the shipped operator/admin/setup surfaces.
