# Marketing Tab — Sunday Definition of Done

**Target:** Sunday evening  
**Scope:** “Fully functional” = all current Marketing sub-views work correctly with DB as source of truth, multi-tenant safe, with loading/error/empty states and no critical broken wiring.

---

## Core User Stories (Sunday scope)

1. **Overview**  
   As a user I open Marketing → Overview and see correct stats (contacts, sequences, emails sent, reply rate, employee stats) for the **selected customer**, with loading and error states and no wrong-tenant data.

2. **Reports**  
   As a user I select a customer and date range and see that customer’s email report (sent, opened, replied, etc.). The dropdown selection is what the API uses (no header/query mismatch).

3. **People**  
   As a user I view, add, edit, and delete contacts for the selected customer; list is scoped by customer and shows empty state when there are no contacts.

4. **Lead Sources**  
   As a user I connect/sync Cognism/Apollo/Social sheets for the selected customer and see sources/lists; all reads/writes are customer-scoped and show loading/error/empty where needed.

5. **Suppression (Compliance)**  
   As a user I add, remove, and import CSV suppression entries for the selected customer; list and actions are scoped by customer with clear empty/error states.

6. **Email Accounts**  
   As a user I see and manage Outlook (and any other) identities for the selected customer; connect/disconnect/test-send work and are customer-scoped.

7. **Templates**  
   As a user I CRUD email templates for the selected customer; list has empty state and loading/error handling.

8. **Sequences**  
   As a user I create/edit sequences (campaign + steps), attach prospects, run suppression check, and start/pause campaigns for the selected customer; all API calls use correct customer and show loading/error/empty states.

9. **Schedules**  
   As a user I see upcoming sends, pause/resume, and create/edit schedules for the selected customer; list and actions are customer-scoped with loading/error/empty handling.

10. **Inbox**  
    As a user I see threads and replies for the selected customer and can reply; customer dropdown (if any) drives the data shown (no header/query mismatch).

---

## Data Objects (no new domain models required for Sunday)

- **Existing:** Customer, Contact, EmailIdentity, EmailCampaign, EmailTemplate, EmailSequence, ContactList, SuppressionEntry, LeadRecord, SheetSourceConfig, EmailEvent, etc. All already scoped by `customerId`.
- **No new tables** for Sunday; optional additive columns only if a clear bug fix requires them (e.g. a missing index or nullable field).
- **No** new “MarketingCampaign” or “AudienceSegment” or “UTM links” or “Landing pages” for this scope; current Campaign/Sequence/Contact/List model is sufficient.

---

## Success Criteria (demonstrable)

| # | Story | Success criteria |
|---|--------|-------------------|
| 1 | Overview | Stats match selected customer; 400 if no customer; spinner then content or error message |
| 2 | Reports | Selected customer + date range returns that customer’s metrics; no data from other customers |
| 3 | People | CRUD works; list filtered by customer; empty state when 0 contacts |
| 4 | Lead Sources | Sources/lists/sync per customer; no cross-tenant data |
| 5 | Compliance | Suppression list and import scoped to customer; empty state when 0 entries |
| 6 | Email Accounts | Identities and actions scoped to customer |
| 7 | Templates | CRUD scoped to customer; empty state when 0 templates |
| 8 | Sequences | Create/start/pause and prospects scoped to customer; suppression check uses same customer |
| 9 | Schedules | List and pause/resume/create/edit scoped to customer; empty state when no schedules |
| 10 | Inbox | Threads/replies and reply action scoped to customer |

---

## Out of scope for Sunday

- New marketing domain models (e.g. UTM, landing pages, segments).
- **CognismProspectsTab** fix (would require new or alias API); can be “disabled” or hidden if not fixed.
- Marketing **Leads** tab migration from localStorage (lives under Customers; separate initiative).
- New env vars for tracking/UTM (add only if a concrete fix needs them).
- Destructive migrations or breaking changes to other tabs/routes/workers.

---

*End of Sunday Definition of Done*
