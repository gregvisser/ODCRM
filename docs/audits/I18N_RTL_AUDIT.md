# I18N & RTL Audit — ODCRM

**Objective:** Document current UI text surfaces, layout, and any existing i18n/RTL capability before adding English/Arabic localization with RTL support.

**Guarantee:** No business logic, auth, tenant isolation, routing meaning, DB schema, migrations, permissions, or workflow behavior changes. English remains primary; Arabic is a presentation layer.

---

## 1. App structure (repo reality)

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

## 2. Hardcoded UI text — main operator surfaces

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

### 2.7 Customers home

- Tab labels and view names from `CustomersHomePage` / nav (Accounts, Contacts, etc. if present)

### 2.8 Settings home

- Tab labels and section titles from `SettingsHomePage`

### 2.9 Marketing sub-tabs (components)

- ReadinessTab, ReportsTab, LeadSourcesTabNew, ComplianceTab, EmailAccountsTab, TemplatesTab, SequencesTab, SchedulesTab, InboxTab — each contains many hardcoded strings (table headers, buttons, empty states, errors, toasts)

---

## 3. Existing i18n / direction

- **i18n:** None. No `react-i18next`, `react-intl`, or custom i18n lib.
- **Direction/RTL:** None. No `dir` on document or root; Chakra theme does not set direction. All layout is LTR-implicit.

---

## 4. Chakra setup

- `theme.ts`: `extendTheme` with colors, semanticTokens, components (Button, Heading, Tabs, Badge, Table, Input, Select, Textarea, NumberInput), `styles.global` for html/body/#root.
- No `direction` or RTL-specific theme keys. Chakra supports `dir` on `ChakraProvider` or root element for RTL.

---

## 5. Locale persistence

- **User preferences:** `UserPreferencesContext` + `useUserPreferences`; API-backed (`/api/user-preferences`); stores `tabOrders`, `theme`, `sidebarCollapsed`. No `locale` key.
- **Recommendation:** Persist UI locale in `localStorage` only (e.g. `odcrm:locale`) to avoid API/schema changes. Presentation-only; no business impact.

---

## 6. Risk areas

- **TemplatesTab, SequencesTab, SchedulesTab, InboxTab, ComplianceTab, CustomerOnboardingTab:** Dense hardcoded copy; high value for localization.
- **Nav/shell:** Single place for tab labels and "Sign out"; must stay in sync with `contracts/nav` or be derived from translation keys.
- **Toast/alert messages:** Often inline in components; need keyed messages.
- **Mixed LTR content:** Emails, URLs, domains, IDs, phone numbers in tables/cards must remain readable in RTL (CSS `dir="ltr"` or `unicode-bidi` on wrappers).

---

## 7. Inventory summary

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
**Status:** Pre-implementation audit for English/Arabic + RTL.
