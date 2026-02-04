# Data persistence audit – database as source of truth

**Rule: Local must never be the source of truth.** All data entered in the system must persist to the **deployed backend (API + database)** and survive a full page refresh. This document lists each data type and how it behaves.

---

## Summary

| Data | Source of truth | Load | Save | Survives refresh |
|------|-----------------|------|------|-------------------|
| **Customers / Accounts** | Database | API → hydrate localStorage | Sync to API (immediate on create/edit) | Yes |
| **Onboarding (customer + profile)** | Database | API | PUT /api/customers, POST/PUT contacts | Yes |
| **Assigned users (Onboarding dropdown)** | Database | useUsersFromDatabase (API) | Settings → Users API | Yes |
| **Leads** | Database | fetchLeadsFromApi → cache | Backend sync / API | Yes (refetch from API) |
| **Marketing: Campaigns, Templates, Lists, Schedules, Sequences** | Database | API | POST/PUT to respective /api/* | Yes |
| **Marketing: Contacts (People), Cognism prospects** | Database | API | POST/PUT /api/contacts, /api/prospects | Yes |
| **User preferences (tab order, etc.)** | Database | API | PUT /api/user-preferences | Yes |
| **Customers → Contacts tab** | Database | API on load; debounced sync on save | GET /api/customers → build list; POST/PUT per contact per account | Yes |

---

## Implemented (DB-first, survives refresh)

### Customers / Accounts (Opensdoors Accounts tab)

- **Load:** `AccountsTabDatabase` loads from `useCustomersFromDatabase()` (GET /api/customers) and overwrites localStorage.
- **Save:** Creating or editing an account updates localStorage; sync runs **immediately** on `accountsUpdated` (and every 2s) and calls POST/PUT /api/customers.
- **Result:** New and updated accounts persist and survive refresh.

### Onboarding

- **Load:** Customers and taxonomy from API; assigned users from `useUsersFromDatabase()` (API).
- **Save:** PUT /api/customers/:id (accountData); POST/PUT /api/customers/:id/contacts for primary contact.
- **Result:** All onboarding data persists and survives refresh.

### Leads

- **Load:** `fetchLeadsFromApi()` (GET /api/leads); result is cached to localStorage for UI.
- **Save:** Leads are updated by backend sync / Google Sheets; cache is updated after fetch.
- **Result:** Refreshing and refetching from API shows current data.

### Marketing (Campaigns, Templates, Lists, Email accounts, Schedules, Sequences, People, Compliance)

- **Load/Save:** All use API (GET/POST/PUT) for their resources. No reliance on localStorage as source of truth.
- **Result:** All survive refresh.

### User preferences

- **Load/Save:** `useUserPreferences` uses GET/PUT /api/user-preferences.
- **Result:** Survives refresh.

### Users (Settings → User management)

- **Load/Save:** `useUsersFromDatabase()` uses GET/POST/PUT/DELETE /api/users.
- **Result:** Survives refresh.

---

## Customers → Contacts tab

- **Load:** On mount, GET /api/customers (with `customerContacts`) builds the contact list by aggregating customer contacts by (name, email) and attaching account names. If the API returns contacts, they replace the local list so refresh shows DB data.
- **Save:** When the contact list changes, a debounced (2s) sync runs: for each contact and each linked account, find the customer and existing contact by email, then POST (create) or PUT (update) /api/customers/:id/contacts. Data persists and survives refresh.
- **Note:** Primary contact created in **Onboarding** is also persisted to the database and appears in the Contacts tab via `contactsUpdated`.

---

## LocalStorage usage (cache or UI-only)

These keys are used only as cache or for non–business-critical UI state:

- **accounts** – Cache only; overwritten by DB on load; changes synced to API.
- **accountsLastUpdated, accountsBackendSyncHash, accountsBackendSyncVersion** – Sync/metadata.
- **leads, marketingLeads, leadsLastRefresh, marketingLeadsLastRefresh** – Cache after API fetch.
- **contacts, contactsLastUpdated** – Cache; Contacts tab loads from API on mount and syncs to API on change.
- **emailTemplates, emailTemplatesLastUpdated** – Cache if used; templates are in DB.
- **currentCustomerId** – UI preference (current customer context).
- **headerImageDataUrl, uxToolsEnabled** – UI-only.
- **contact_roles (onboarding)** – Local list; could be moved to DB later.

---

## Rules for new features

1. **Read:** Load from the API (database). Use hooks like `useCustomersFromDatabase`, `useUsersFromDatabase`, or direct `api.get(...)`. Do not treat localStorage as the source of truth for business data.
2. **Write:** Persist via the API (POST/PUT) first. Optionally update localStorage as a cache and emit events so other tabs stay in sync.
3. **Create flows:** Trigger an immediate sync (or API call) when the user creates a record—do not rely only on a slow timer so that refresh does not lose data.
4. **New builds and new data:** All new builds and all data entered must use the database as source of truth. Local must never be the source of truth.

## Implementation status (database-first)

| Area | Load from | Save to | Notes |
|------|-----------|---------|--------|
| Accounts (Customers tab) | API → hydrate cache | API (sync + create/update) | AccountsTabDatabase wraps AccountsTab |
| Contacts tab | API on mount (loading until ready) | API (debounced sync) | Account names from API |
| Onboarding | API (customers, users, taxonomy) | API (PUT customer, POST/PUT contacts) | Account snapshot from selectedCustomer (API) |
| Campaign Wizard | API (customers, templates) | API (campaigns, etc.) | Accounts and templates from /api/customers, /api/templates |
| Leads | API (fetch + cache) | Backend sync | Cache only |
| Users, preferences, marketing | API | API | Per existing APIs |

---

Last updated: 2026-02 (database as single source of truth; local never source of truth).
