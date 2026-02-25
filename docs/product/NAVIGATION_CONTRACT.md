# Navigation Contract — Repo Truth

**Purpose:** Single source of truth for top-level navigation and tab IDs. All Cursor work and UI must align with this contract.

---

## Canonical source

**File:** `src/contracts/nav.ts`

- Defines `CRM_TOP_TABS`, `CrmTopTabId`, `CRM_CATEGORY_HOME_TAB`, `getCrmTopTab`, `getCrmCategoryHomeTab`.
- Runtime guardrails: `assertUnique` on tab ids and paths (throws on duplicate).

---

## Top-level tabs (exact from repo)

Quoted from `src/contracts/nav.ts`:

```ts
export const CRM_TOP_TABS: readonly CrmTopTab[] = [
  { id: 'dashboards-home', label: 'Dashboards', ownerAgent: 'UI Agent', path: '/dashboards' },
  { id: 'customers-home', label: 'OpenDoors Clients', ownerAgent: 'Customers Agent', path: '/customers' },
  { id: 'marketing-home', label: 'OpenDoors Marketing', ownerAgent: 'Marketing Agent', path: '/marketing' },
  { id: 'onboarding-home', label: 'Onboarding', ownerAgent: 'Onboarding Agent', path: '/onboarding' },
  { id: 'settings-home', label: 'Settings', ownerAgent: 'Settings Agent', path: '/settings' },
] as const
```

| Tab id | Label | Path |
|--------|--------|------|
| dashboards-home | Dashboards | /dashboards |
| customers-home | OpenDoors Clients | /customers |
| marketing-home | OpenDoors Marketing | /marketing |
| onboarding-home | Onboarding | /onboarding |
| settings-home | Settings | /settings |

---

## Category → home tab

From `src/contracts/nav.ts`:

```ts
export const CRM_CATEGORY_HOME_TAB: Readonly<Record<CrmCategoryId, CrmTopTabId>> = {
  customers: 'customers-home',
  marketing: 'marketing-home',
  onboarding: 'onboarding-home',
} as const
```

---

## Tab → component mapping (App.tsx)

- **dashboards-home** → `<DashboardsHomePage />`
- **customers-home** → `<CustomersHomePage />` (sub-views: accounts, contacts, leads-reporting)
- **marketing-home** → `<MarketingHomePage />` (sub-views: reports, lead-sources, compliance, email-accounts, templates, sequences, schedules, inbox)
- **onboarding-home** → `<OnboardingHomePage />`
- **settings-home** → `<SettingsHomePage />`

---

## Contract rules

1. **Labels:** User-facing tab labels are defined only in `CRM_TOP_TABS`. Use "Client(s)" for tenant/customer-facing UI; backend/API may keep "Customer" in names.
2. **Paths:** Optional URL paths are stable; do not change without updating this doc and nav contract.
3. **Ids:** Tab ids are type-checked (`CrmTopTabId`); no ad-hoc strings in navigation.
