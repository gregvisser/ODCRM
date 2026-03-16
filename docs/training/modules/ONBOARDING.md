# Onboarding

## Purpose
Use `Onboarding` when a client is being set up, handed over, or formally checked before moving into live outreach.

This area combines:
- a client selector,
- a readiness bridge,
- a `Progress Tracker`,
- a detailed `Client Onboarding` form.

## When a user should use this tab
Use this tab when you need to:
- create or select a client for onboarding,
- complete account details and profile information,
- add contacts,
- connect email accounts during setup,
- upload supporting files,
- track onboarding checklist progress,
- move the client toward active status.

## Prerequisites
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

## Field-by-field explanation of the onboarding form
### Account Details
| Field | What it means |
|---|---|
| `Contact First Name` / `Contact Last Name` | Main contact identity fields. |
| `Contact Email` / `Contact Number` | Primary contact methods. |
| `Role at Company` | Main contact's role. |
| `Contact Status` | Current status of that main contact. |
| `Web Address` | Client website/domain. |
| `Sector` | Client sector classification. |
| `Assigned Account Manager` | Internal owner for the client. |
| `Start Date Agreed` | Agreed start date. |
| `Client Created on CRM` | Checkbox indicating CRM creation status. |
| `Assigned Client DDI & Number` | Telephony/contact assignment. |
| `Days a Week` | Delivery/coverage frequency. |
| `Monthly Revenue from Customer (£)` | Commercial context. |
| `Weekly Lead Target` / `Monthly Lead Target` | Planned lead targets. |
| `Weekly Lead Actual (this week)` / `Monthly Lead Actual (this month)` | Read-only actuals. |
| `Leads Google Sheet URL` / `Leads Google Sheet Label` | Reference to lead-tracking source. |
| `Head Office Address` | Main business address. |

### Contacts
Fields per added contact:
- `Name`
- `Job Title`
- `Email`
- `Phone`

### Email Accounts section
This embeds mailbox setup into onboarding. Use it to connect and review the client's sending identities as part of setup.

### Client Profile
| Field group | What it covers |
|---|---|
| `Client History` | Background/context. |
| `What they do` | Core service description. |
| `Company profile` | Broader profile summary. |
| `Accreditations` | Named accreditations plus evidence uploads. |
| `Target Geographical Area` | Where they want to operate. |
| `Target Job Sector` / `Target Job Roles` | Target audience definition. |
| `Key Business Objectives` | What the outreach should achieve. |
| `Client USPs` | Differentiators. |
| `Social Media Presence` | Links such as Facebook, LinkedIn, X, Instagram, TikTok, YouTube, Website/Blog. |
| `Qualifying Questions` | Lead qualification criteria. |
| `Case Studies or Testimonials` | Proof material plus attachments. |
| `Customer Agreement (PDF/Word)` | Agreement upload area. |

## Progress Tracker
### What it is for
The progress tracker is the checklist side of onboarding. It splits progress into team-based sections.

### Team sections
- `Sales`
- `Operations`
- `Account manager`

### What to expect
- Some items are manual checkboxes.
- Some items auto-update from related setup signals elsewhere in ODCRM.
- The client selector and completed-client filtering help teams move between onboarding records.

## Step-by-step common workflows
### Create a new client and begin onboarding
1. Click `Onboarding`.
2. Use the client selector.
3. Choose `+ Create new client...`.
4. Enter `Client Name`.
5. Optionally add `Domain or Website`.
6. Click `Create & Select`.
7. ODCRM moves you into the selected client's onboarding flow.

### Complete the onboarding form
1. Select the client.
2. Open `Client Onboarding`.
3. Fill `Account Details`.
4. Add extra contacts in `Contacts`.
5. Connect mailboxes in the email-accounts section.
6. Fill `Client Profile` fields and upload evidence/files.
7. Click `Save now` if needed, or allow autosave to complete.
8. Use `Open Suppression List` if suppression setup is still missing.

### Use the progress tracker during handover
1. Open `Progress Tracker`.
2. Select the client.
3. Work through the `Sales`, `Operations`, and `Account manager` sections.
4. Tick manual items as they are completed.
5. Watch for auto-updated items.
6. Review follow-up items before completing onboarding.

### Complete onboarding
1. Select the client.
2. Confirm the client is genuinely ready.
3. Click `Complete Onboarding`.
4. Type the required confirmation text if prompted.
5. Confirm the action.
6. Review the completion status card afterward.

## What happens after each action
- Client selection determines whether the `Client Onboarding` sub-tab appears.
- `Save now` writes the onboarding form back to customer/account data and related contacts.
- Progress-tracker changes persist checklist state.
- Uploads are stored through the customer attachment/agreement routes.
- `Complete Onboarding` sets the client status to active and creates an audit event.

## How this tab connects to other tabs
- `Onboarding` feeds into `Readiness`.
- The embedded email-account setup links directly to mailbox readiness.
- `Open Suppression List` connects onboarding setup to compliance.
- Once onboarding is complete, the operator usually moves into `Readiness`, `Templates`, `Sequences`, and `Schedules`.

## Common mistakes / failure states / confusion points
- Thinking `Client Onboarding` is missing when no client has been selected yet.
- Treating `Complete Onboarding` as a harmless final button. It changes the client to active.
- Assuming that completion is fully hard-gated by every checklist item. Current backend truth does not strictly enforce that.
- Assuming every contact/save line is persisted independently of the main onboarding save.

## Operational tips
- Use onboarding and progress tracker together, not as separate unrelated systems.
- Save before leaving if you have made meaningful changes.
- Use the readiness bridge at the top to decide whether to stay in onboarding or move into marketing setup.

## Reality check notes
- `Client Onboarding` only appears after client selection.
- Some onboarding auto-ticks exist, but not every intuitive setup action has an auto-tick yet.
- `Complete Onboarding` is a real status change, but it is not fully checklist-gated by the backend.

## Related docs / next steps
- [Email Accounts](./EMAIL_ACCOUNTS.md)
- [Compliance and Suppression](./COMPLIANCE_AND_SUPPRESSION.md)
- [Readiness](./READINESS.md)
- [Workflow Overview](../ODCRM_USER_WORKFLOW_OVERVIEW.md)
