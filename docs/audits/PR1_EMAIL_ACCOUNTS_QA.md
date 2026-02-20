# PR: fix(marketing): email accounts list respects selected customer

## Summary

Marketing → Email Accounts tab now always loads identities for the **dropdown-selected customer** (explicit `customerId` query param). It no longer relies on the global `x-customer-id` for the list, so the list cannot silently show the wrong customer's data.

- **Frontend:** Request uses `GET /api/outlook/identities?customerId=${selectedCustomerId}` when a customer is selected; when none is selected, no fetch and a clear empty state is shown. Global current customer is synced when the dropdown changes (consistent with InboxTab, LeadSourcesTab).
- **Backend:** `getCustomerId(req)` now prefers the `customerId` query param when present so the tab’s selection wins over the header; tenant scope is unchanged.

## Manual QA steps

1. **Select customer A → see A’s identities**
   - Go to Marketing → Email Accounts.
   - Select customer A in the Customer dropdown.
   - Confirm the list shows only email accounts for customer A (and that the count/stats match).

2. **Select customer B → list changes to B’s identities**
   - With the same tab open, change the dropdown to customer B.
   - Confirm the list updates to customer B’s accounts (and that it is not A’s list).

3. **No customer selected → empty state, no fetch**
   - If the dropdown has a “Select customer” placeholder (e.g. before customers load or in a state where no customer is selected), confirm:
     - The message “Select a customer to view email accounts” is shown.
     - No request is sent to `/api/outlook/identities` (check Network tab).
     - After selecting a customer, the list loads for that customer.

4. **Connect / disconnect**
   - Select a customer, connect an Outlook account, return to the tab. Confirm the new identity appears for that customer.
   - Disconnect an account. Confirm the list updates without showing another customer’s data.

## Verification

- No existing tests were found for `EmailAccountsTab`; no test changes in this PR.
- Tenant isolation: Backend still scopes by a single `customerId` per request; only the source of that id (query vs header) was adjusted so the tab’s selection is authoritative.
