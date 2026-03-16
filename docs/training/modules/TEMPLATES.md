# Templates

## Purpose
Use `Templates` to create and manage reusable outreach copy for ODCRM. This is where you prepare the subject and body content that sequence steps will copy into their own saved step records.

## When a user should use this tab
Use this tab when you need to:
- create a new outreach template,
- edit an existing template,
- preview how placeholders render,
- use the AI rewrite helper,
- duplicate a template for a variation,
- delete outdated copy.

## Prerequisites
- A client must be selected.
- You should already know the audience and message you want to send.
- If you want realistic preview output, it helps if the client and mailbox data already exist.

## What the user sees on screen
Main areas:
- client selector,
- header button `Create template`,
- summary cards:
  - `Templates`
  - `Favorites`
  - `Updated this month`
  - `Categories`
- search box,
- category filter,
- `Template library`,
- `Template setup & troubleshooting`,
- create/edit modal,
- preview modal.

## Main actions available
Common buttons and actions:
- `Create template`
- `Create first template`
- `Preview render`
- `Edit template`
- `Duplicate template`
- `Add to Favorites`
- `Remove from Favorites`
- `Delete template`
- `Refresh templates`
- `Improve with AI`
- `Apply suggestion`
- `Restore original`
- `Save Changes`
- `Cancel`
- `Close`

## Field-by-field explanation of the template editor
| Field | What it means | What users should know |
|---|---|---|
| `Template Name` | The operator label for the template. | Use a name that makes sense when picking it inside Sequences. |
| `Category` | UI grouping for the template. | Useful in the editor/filter experience, but do not rely on it as strong persisted business metadata. |
| `Email Subject` | Subject line template. | Supports placeholders. Keep it short and readable. |
| `Preview Text (optional)` | Preview/snippet text shown in the UI preview. | Treat this carefully: it is visible in the editor, but not part of the most reliable persisted backend template model. |
| `Email Content` | Main body content. | This is the most important field. Supports placeholders and can include HTML. |
| `Tags` | UI tags for filtering/organization. | Current implementation exposes tags in the UI, but they are not part of the most reliable backend truth. |

## Placeholder chips and supported terms
### Canonical placeholder chips shown in the UI
- `{{email_signature}}`
- `{{first_name}}`
- `{{last_name}}`
- `{{full_name}}`
- `{{company_name}}`
- `{{role}}`
- `{{website}}`
- `{{sender_name}}`
- `{{sender_email}}`
- `{{unsubscribe_link}}`

### Backward-compatible or alias-style placeholders still supported in rendering
- `{{firstName}}`
- `{{lastName}}`
- `{{companyName}}`
- `{{unsubscribeLink}}`
- `{{emailSignature}}`
- `{{senderSignature}}`

### What to do with placeholders
- Use the chip forms ODCRM shows you where possible.
- Keep placeholder usage simple and deliberate.
- Use `{{email_signature}}` where you want the mailbox signature to appear.
- Use `{{unsubscribe_link}}` if you want explicit unsubscribe placement in the body.

## AI Improve flow
### What the user does
1. Open or create a template.
2. Set the current subject/body draft.
3. Choose the AI tone option if the UI offers one.
4. Click `Improve with AI`.
5. Review the suggestion shown by the editor.
6. Click `Apply suggestion` only if you want to replace the current draft.
7. Click `Restore original` if you want to undo the applied suggestion.
8. Save the template normally.

### What ODCRM actually does
- The AI request is a suggestion flow, not a silent save.
- `Improve with AI` generates a suggested rewrite in the editor state.
- `Apply suggestion` updates the local draft in the editor.
- Nothing is saved to the template library until you save the template yourself.

## Preview behavior
### How to use it
1. Save or open a template.
2. Click `Preview render`.
3. Review the rendered subject and body.
4. Check whether placeholders resolved the way you expect.

### What to expect
- Preview rendering uses sample values and can also enrich from the selected client and active sender identity when available.
- The preview is a rendering aid, not a live send.
- Preview helps you catch obvious placeholder and layout mistakes before you move into Sequences.

## Signature behavior
- ODCRM supports `{{email_signature}}` and preserves signature HTML during rendering.
- Best practice: place `{{email_signature}}` intentionally where you want the sender signature to appear.
- Do not paste a mailbox signature manually into every template if the mailbox signature is already managed in `Email Accounts`.

## Unsubscribe footer behavior
- ODCRM supports `{{unsubscribe_link}}` and `{{unsubscribeLink}}`.
- Current send paths also enforce an unsubscribe footer if the rendered content does not already contain one.
- In plain language: even if the template author forgets to place an unsubscribe token clearly, the send system still tries to append compliant unsubscribe content.

## Step-by-step common workflows
### Create a template
1. Click `Templates`.
2. Select the correct client.
3. Click `Create template`.
4. Fill `Template Name`.
5. Choose `Category`.
6. Enter `Email Subject`.
7. Enter `Email Content`.
8. Add placeholder chips where needed.
9. Optionally add `Preview Text` and tags.
10. Save the template.
11. Use `Preview render` to confirm the output.

### Edit a template
1. Find the template card.
2. Click `Edit template`.
3. Update the subject/body or placeholders.
4. Preview the render.
5. Save changes.

### Duplicate a template
1. Find the original template.
2. Click `Duplicate template`.
3. Open the copied version.
4. Rename it clearly.
5. Make the variation changes.
6. Save.

## What happens after each action
- Create and edit save the core template record to the database.
- Duplicate creates a copy of the template content.
- Preview calls the backend renderer so you can inspect output before using the template downstream.
- Delete removes the template after the backend confirms success.

## How this tab connects to other tabs
- `Templates` -> `Sequences`: sequence steps copy template content from here.
- `Templates` -> `Readiness`: missing or weak templates can show up indirectly in readiness and preflight.
- `Templates` -> `Schedules`: only indirectly, because schedules monitor campaigns that were built from sequence content.

## Common mistakes / failure states / confusion points
- Assuming that editing a shared template will automatically rewrite existing saved sequence steps. It does not.
- Treating UI-only metadata such as favorites, tags, or preview text as strong persisted truth. The current implementation is strongest on name, subject, and body.
- Forgetting to preview before sequence testing.
- Mixing manual signatures into the body while also using `{{email_signature}}`.

## Operational tips
- Keep template names operator-friendly so they are easy to choose inside the sequence builder.
- Prefer the canonical placeholder chips ODCRM already exposes.
- Use AI suggestion as a review step, not as a blind one-click final draft.

## Reality check notes
- The current template model reliably persists the core content, but some richer metadata shown in the UI is not equally reliable in backend truth.
- Sequence steps are copied content. Shared-template edits are not live references.
- The send path enforces unsubscribe handling more strongly than the editor alone suggests.

## Related docs / next steps
- [Sequences](./SEQUENCES.md)
- [Readiness](./READINESS.md)
- [Known Limits and Gotchas](../ODCRM_KNOWN_LIMITS_AND_GOTCHAS.md)
