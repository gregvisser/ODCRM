# ONBOARDING CONTRACT AND DNC LIVE UAT

## Preconditions
- Use production on SHA `185917f6e3eaf8a1f4f582fbc52b1695389dbf20` or later.
- Tester can access `Onboarding`, `OpenDoors Marketing -> Compliance`, and `Progress Tracker`.
- Tester knows the target customer ID and customer name being used.
- For agreement testing, use one document with clear dates/value and one document with partial or unclear terms.
- For suppression testing, use two different clients, for example OCS and Max Space Projects.

## Test Client Setup
- Pick `Client A` and `Client B` with different customer IDs.
- Confirm both clients are visible in the suppression client selector.
- Confirm the onboarding page can be opened for `Client A`.
- Capture customer ID, customer name, timestamp, and current progress tracker state before testing.

## Agreement Upload Test Steps
1. Open `Onboarding -> Customer Onboarding` for `Client A`.
2. Upload an agreement file from the `Agreement / Contract` section.
3. Wait for upload completion toast.
4. Confirm the agreement file name is shown.
5. Confirm the extraction status badge is shown.
6. Refresh or rely on the automatic refetch and confirm the same extracted values remain visible.

## Expected Extraction Outputs
- Status badge shows one of: `Extraction complete`, `Extraction partial`, `Extraction needs review`.
- If defensible values exist, visible fields may include:
  - monthly price
  - contract signed date
  - contract start date
  - service start date
  - billing start date
  - contract term
  - contract end date
  - renewal date
  - agreement summary
- Warnings are shown when extraction is partial or fallback-based.

## Expected Onboarding Field Updates
- `Monthly Revenue From Customer` updates if a defensible recurring monthly value is extracted.
- `Start Date Agreed` updates if a defensible contract/service/billing start date is extracted.
- After page refetch, the same values remain in the onboarding form and extraction panel.

## Expected Progress Auto-Ticks
- `Client Agreement and Approval` becomes complete after agreement upload.
- `Contract Signed & Filed` becomes complete after agreement upload.
- `Start Date Agreed` becomes complete only when a defensible start date was extracted.
- `documents` onboarding step auto-completes only when at least one defensible commercial/date field was extracted.

## Partial Extraction Expected Behavior
- Upload toast is a warning, not green success.
- Badge shows `Extraction partial`.
- Only defensible fields are populated.
- Warnings remain visible after refetch.

## Failed Extraction Expected Behavior
- Upload toast says the agreement was stored but no defensible fields were extracted.
- Badge shows `Extraction needs review`.
- No start date or commercial value is invented.
- Agreement file still remains uploaded and downloadable.

## Client-Specific Suppression Upload Test
1. Open `OpenDoors Marketing -> Compliance`.
2. Confirm the `Target Client` selector is visible before any suppression action.
3. Select `Client A`.
4. Confirm the badge/header shows `Client A`.
5. Import Email DNC for `Client A`.
6. Import Domain DNC for `Client A`.
7. Confirm the list and health cards update for `Client A` only.
8. Add one manual email/domain suppression entry for `Client A`.

## Cross-Client Suppression Isolation Test
1. Keep a known email/domain suppressed for `Client A`.
2. Switch the selector to `Client B`.
3. Confirm that same email/domain does not appear in `Client B` unless separately imported or added there.
4. If possible, run a suppression enforcement check for both clients and confirm only `Client A` is blocked.

## Explicit Suppression Client-Selector Test
- Open `Compliance` without relying on onboarding context.
- Confirm the page itself shows:
  - `Target Client` heading
  - visible client selector
  - selected client badge/name
- Clear or avoid selection and confirm imports/manual edits do not proceed.
- Confirm the warning says to select a client before importing, adding, deleting, or reviewing entries.

## Pass/Fail Checklist
- Agreement upload succeeds.
- Extraction triggers automatically.
- Extracted values persist after refetch.
- Progress tracker auto-ticks correctly.
- Partial extraction is shown as partial/warning.
- Failed extraction is shown truthfully with no invented values.
- Suppression page always shows an explicit target client.
- Suppression imports/manual entries are blocked until a client is selected.
- Email/domain counts are shown for the selected client only.
- A suppression entry on `Client A` does not affect `Client B`.

## Evidence To Capture
- Screenshot of onboarding before upload.
- Screenshot of upload toast and extraction badge.
- Screenshot of extracted fields after refetch.
- Screenshot of progress tracker auto-ticks.
- Screenshot of Compliance `Target Client` selector and selected-client badge.
- Screenshot of suppression counts for `Client A` and `Client B`.
- Customer name, customer ID, timestamp, uploaded file name, and any warning text.
