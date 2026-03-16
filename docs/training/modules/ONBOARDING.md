# Onboarding

## Purpose
Use `Onboarding` when a client is being set up, handed over, or formally checked before moving into live marketing work.

This area combines:
- client selection,
- a readiness bridge,
- `Progress Tracker`,
- the detailed `Client Onboarding` form.

## You are here in the workflow
Use this tab before relying on the main marketing workflow for a new or incomplete client.

What should already be true:
- you know which client you are onboarding,
- or you are ready to create the client.

Where users usually go next:
- [Email Accounts](./EMAIL_ACCOUNTS.md), [Lead Sources](./LEAD_SOURCES.md), and [Compliance and Suppression](./COMPLIANCE_AND_SUPPRESSION.md) while setup is still in progress,
- [Readiness](./READINESS.md) when setup is nearly ready for outreach,
- [Templates](./TEMPLATES.md) and [Sequences](./SEQUENCES.md) once marketing setup can begin.

## When a user should use this tab
Use this tab when you need to:
- create or select a client for onboarding,
- complete account details and profile information,
- add contacts,
- connect email accounts during setup,
- upload supporting files,
- track onboarding checklist progress,
- move the client toward active status.

## Before you start
- You must be signed in.
- To open `Client Onboarding`, a client must be selected first.

## What the user sees on screen
Main areas:
- client selector,
- readiness bridge panel showing onboarding status and go-live follow-up,
- `Progress Tracker` sub-tab,
- `Client Onboarding` sub-tab after a client is selected.

## Main actions available
Top-level actions:
- `+ Create new client...`
- `Create & Select`
- refresh client list
- dynamic next-step buttons such as:
  - `Continue onboarding`
  - `Open client details`
  - `Open inbox`
  - `Open reports`
  - `Open sequences`
  - `Review marketing readiness`

Form-level actions:
- `Open Suppression List`
- `Add Contact`
- `Save now`
- `Complete Onboarding`
- attachment and evidence upload actions
- mailbox connect/test actions inside the embedded email-accounts section

## Selecting the right client
### Existing client
1. Open `Onboarding`.
2. Use the client selector.
3. Choose the correct client.
4. Confirm the readiness bridge and form content match that client.

### New client
1. Open `Onboarding`.
2. Choose `+ Create new client...`.
3. Enter the client name.
4. Optionally enter the domain or website.
5. Click `Create & Select`.

Expected result:
- the new client is selected and the onboarding flow opens for that client.

## What is conditional on active client context
The `Client Onboarding` sub-tab only appears after a client is selected.

Operator takeaway:
- if `Client Onboarding` is missing, check client selection first.

## Field-by-field explanation of the onboarding form
### Account Details
| Field | What it means | Editable, derived, or informational |
|---|---|---|
| `Contact First Name` / `Contact Last Name` | Main contact identity fields. | Editable |
| `Contact Email` / `Contact Number` | Primary contact methods. | Editable |
| `Role at Company` | Main contact's role. | Editable |
| `Contact Status` | Current status of that main contact. | Editable |
| `Web Address` | Client website/domain. | Editable |
| `Sector` | Client sector classification. | Editable |
| `Assigned Account Manager` | Internal owner for the client. | Editable |
| `Start Date Agreed` | Agreed start date. | Editable and can auto-tick progress items |
| `Client Created on CRM` | Checkbox indicating CRM creation status. | Editable |
| `Assigned Client DDI & Number` | Telephony/contact assignment. | Editable |
| `Days a Week` | Delivery/coverage frequency. | Editable |
| `Monthly Revenue from Customer (£)` | Commercial context. | Editable |
| `Weekly Lead Target` / `Monthly Lead Target` | Planned lead targets. | Editable |
| `Weekly Lead Actual (this week)` / `Monthly Lead Actual (this month)` | Current actuals. | Informational / derived |
| `Leads Google Sheet URL` / `Leads Google Sheet Label` | Lead-tracking source reference. | Editable |
| `Head Office Address` | Main business address. | Editable |

### Contacts section
Fields per contact:
- `Name`
- `Job Title`
- `Email`
- `Phone`

### Email Accounts section
This embeds mailbox setup into onboarding so the user can connect or review sender identities without leaving the onboarding flow.

### Client Profile
This section captures:
- client history,
- what they do,
- company profile,
- accreditations,
- target geography,
- target sectors and roles,
- business objectives,
- USPs,
- social presence,
- qualifying questions,
- case studies or testimonials,
- customer agreement uploads.

## Progress Tracker
### What it is for
The progress tracker is the checklist side of onboarding. It splits progress into team-based sections.

### Team sections
- `Sales`
- `Operations`
- `Account manager`

### What to expect
- Some items are manual checkboxes.
- Some items auto-update from related setup signals.
- Examples of coded checklist labels include `Start Date Agreed`, `Client Added to CRM System & Back Up Folder`, `Emails (5 linked)`, `Send DNC List to Ops Team for loading to CRM`, `Templates Reviewed and Agreed with Client`, and `Client is Live`.

## Recommended operator path
1. Select or create the client.
2. Complete the core onboarding form.
3. Add contacts.
4. Connect or review mailboxes.
5. Use `Open Suppression List` when safety setup is missing.
6. Review `Progress Tracker`.
7. Use `Review marketing readiness` before moving into live marketing work.
8. Use `Complete Onboarding` only when you mean to change client status to active.

## Click-by-click workflows
### Create a new client and begin onboarding
1. Click `Onboarding`.
2. Use the client selector.
3. Choose `+ Create new client...`.
4. Enter `Client Name`.
5. Optionally add `Domain or Website`.
6. Click `Create & Select`.
7. ODCRM moves you into the selected client's onboarding flow.

Expected result:
- the client exists and the onboarding forms are now client-scoped.

### Complete the onboarding form
1. Select the client.
2. Open `Client Onboarding`.
3. Fill `Account Details`.
4. Add extra contacts in `Contacts`.
5. Connect mailboxes in the embedded email-accounts section.
6. Fill the `Client Profile` fields and upload evidence/files.
7. Click `Save now` if needed, or allow autosave to complete.
8. Use `Open Suppression List` if suppression setup is still missing.

Expected result:
- the client's main onboarding data is stored and visible.

### Use the progress tracker during handover
1. Open `Progress Tracker`.
2. Select the client.
3. Work through the `Sales`, `Operations`, and `Account manager` sections.
4. Tick manual items as they are completed.
5. Watch for auto-updated items.
6. Review follow-up items before completing onboarding.

Expected result:
- the checklist more accurately reflects real setup progress.

### Complete onboarding
1. Select the client.
2. Confirm the client is genuinely ready.
3. Click `Complete Onboarding`.
4. Type the required confirmation text if prompted.
5. Confirm the action.
6. Review the completion status card afterward.

Expected result:
- the client status changes to active.

## What completion means vs what it does not guarantee
### What it means
- the client status changes to active,
- an audit-style event is recorded,
- the onboarding phase is treated as completed in a formal sense.

### What it does not guarantee
- that every checklist item was enforced by backend gating,
- that mailbox, source, suppression, template, and sequence setup are perfect,
- that the client is automatically safe to launch without further review.

## How onboarding status affects operations
- Onboarding status contributes to readiness interpretation.
- A client can look more operationally complete after onboarding actions, but marketing tabs still need their own setup truth checked.
- `Review marketing readiness` is the bridge between onboarding and the marketing workflow.

## Operator prerequisites before starting marketing work
Before leaving onboarding for real marketing work, confirm:
- the correct client is selected,
- the onboarding form has been meaningfully completed,
- mailbox setup is underway or complete,
- suppression setup is understood,
- lead-source setup is understood,
- the client is genuinely ready to move into `Templates`, `Sequences`, and `Readiness`.

## What happens after each action
- Client selection determines whether `Client Onboarding` appears.
- `Save now` writes onboarding form data back to customer/account data and related contacts.
- Progress-tracker changes persist checklist state.
- Uploads are stored through the customer attachment/agreement routes.
- `Complete Onboarding` sets the client status to active and creates an audit event.

## Common mistakes / failure states / confusion points
- Thinking `Client Onboarding` is missing when no client has been selected yet.
- Treating `Complete Onboarding` as a harmless final button. It changes the client to active.
- Assuming completion is fully hard-gated by every checklist item. Current backend truth does not strictly enforce that.
- Assuming every small save path is independent of the wider onboarding record.

## How to verify success
You are done with this tab when:
- the correct client is selected,
- onboarding details are saved,
- the progress tracker reflects meaningful progress,
- you know whether the next step is `Readiness`, `Email Accounts`, `Lead Sources`, `Suppression List`, `Templates`, or `Sequences`.

## What to do next
- Go to [Email Accounts](./EMAIL_ACCOUNTS.md) for mailbox setup.
- Go to [Lead Sources](./LEAD_SOURCES.md) and [Compliance and Suppression](./COMPLIANCE_AND_SUPPRESSION.md) for safety/setup.
- Go to [Readiness](./READINESS.md) when you want the compact handoff into marketing work.

## Reality check notes
- `Client Onboarding` only appears after client selection.
- Some onboarding auto-ticks exist, but not every intuitive setup action has an auto-tick.
- `Complete Onboarding` is a real status change, but it is not fully checklist-gated by the backend.
