# Templates

## Purpose
Use `Templates` to create and manage reusable outreach copy for ODCRM. This is where you prepare the subject and body content that later gets copied into sequence steps.

This tab matters because templates affect:
- what sequence steps start with,
- what users preview before launch,
- where signatures appear,
- how unsubscribe content appears,
- how much cleanup is needed later in the sequence builder.

## You are here in the workflow
Use this tab after:
- selecting the correct client,
- connecting at least one mailbox if possible,
- deciding what outreach copy you want to send.

Users usually go here before [Sequences](./SEQUENCES.md).

## Recommended operator path
1. Select the correct client.
2. Click `Create template`.
3. Enter the subject and body.
4. Insert the correct placeholders.
5. Use `Improve with AI` only as a suggestion step.
6. Use `Preview render`.
7. Click `Create Template` for a new template or `Save Changes` for an existing one.
8. Move to [Sequences](./SEQUENCES.md).

## Advanced or lower-confidence parts of this screen
These UI ideas exist, but should not be treated as the strongest persisted business truth:
- preview text,
- tags,
- favorites,
- usage counters.

The core template content is still the most important saved truth.

## When a user should use this tab
Use this tab when you need to:
- create a new outreach template,
- edit an existing template,
- preview how placeholders render,
- use the AI rewrite helper,
- duplicate a template for a variation,
- delete outdated copy.

## Before you start
- A client must be selected.
- You should already know the audience and message you want to send.
- Preview is more useful if the client and mailbox data already exist.

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
| Field or control | What it means | Editable, derived, or informational |
|---|---|---|
| `Template Name` | Operator label for the template. | Editable |
| `Category` | UI grouping for the template. | Editable, but not the strongest persisted truth |
| `Email Subject` | Subject line template. | Editable |
| `Preview Text (optional)` | UI preview/snippet helper. | Editable, but lower-confidence metadata |
| `Email Content` | Main message body. | Editable and the most important content field |
| `Tags` | UI organization/filtering tags. | Editable, but lower-confidence metadata |
| placeholder chips | Shortcut tokens to insert supported variables. | Informational and actionable |
| `Improve with AI` | Requests a suggested rewrite. | Action control |
| `Apply suggestion` | Applies the current AI suggestion into the editor draft. | Action control |
| `Restore original` | Returns the editor to the pre-suggestion draft. | Action control |

## Placeholder chips and supported terms
### Canonical placeholder chips shown in the editor
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

### What users should do with placeholders
- Use the editor chips where possible instead of inventing your own names.
- Use `{{email_signature}}` where you want the mailbox signature to appear.
- Use `{{unsubscribe_link}}` if you want explicit unsubscribe placement in the body.
- If you use older camelCase aliases, ODCRM still supports some of them, but the chip-style tokens are safer for training and future consistency.

## Create/edit flow
### Create a new template
1. Open `OpensDoors Marketing -> Templates`.
2. Confirm the correct client is selected.
3. Click `Create template`.
4. Enter `Template Name`.
5. Choose `Category`.
6. Enter `Email Subject`.
7. Enter `Email Content`.
8. Insert placeholder chips where needed.
9. Optionally add `Preview Text (optional)` and `Tags`.
10. Click `Create Template`.
11. Click `Preview render`.

Expected result:
- the template appears in the library for that client.

### Edit an existing template
1. Find the template card.
2. Click `Edit template`.
3. Change the subject, content, or placeholders.
4. Preview it.
5. Click `Save Changes`.

Expected result:
- the updated template replaces the previous saved content for that shared template.

### Duplicate a template
1. Find the original template.
2. Click `Duplicate template`.
3. Open the copy.
4. Rename it clearly.
5. Make your changes.
6. Save.

Expected result:
- you have a second template variant without overwriting the original.

## Improve with AI flow
### What the operator should do
1. Open the template editor.
2. Read the current draft first.
3. Click `Improve with AI`.
4. Review the suggestion carefully.
5. Confirm that placeholders are still intact.
6. Confirm that unsubscribe content still makes sense.
7. Click `Apply suggestion` only if you want the editor draft replaced.
8. Click `Restore original` if you want to undo the AI-applied change.
9. Save manually once satisfied.

### What ODCRM is actually doing
- The AI flow is suggestion-based.
- `Improve with AI` does not silently save the template.
- `Apply suggestion` changes the draft in the editor.
- The template library only changes after the user saves.

## Preview flow
### Recommended preview steps
1. Save or open the template.
2. Click `Preview render`.
3. Review the rendered subject.
4. Review the rendered body.
5. Check where the signature appears.
6. Check where unsubscribe content appears.
7. Close the preview and return to edit mode if anything looks wrong.

### Real sender/signature preview vs fallback/sample preview
- ODCRM can enrich preview values from the selected client and active sender identity when available.
- The preview flow also uses sample values to help render something readable even when complete live context is not available.
- That means preview is useful for structure and placeholders, but it is still not identical to a live send.

## Signature behavior
- `{{email_signature}}` is the clearest operator-safe way to place the sender signature.
- ODCRM preserves signature HTML during rendering.
- Best practice: let `Email Accounts` manage the actual signature, and use the placeholder in the template rather than pasting mailbox signatures manually into every template.

## Unsubscribe behavior
- ODCRM supports `{{unsubscribe_link}}` and `{{unsubscribeLink}}`.
- If the body does not appear to include unsubscribe content, current send paths still enforce an unsubscribe footer.
- Operator expectation: even if the template preview does not make the fallback feel obvious, the send path tries to keep unsubscribe handling present.

## What changes are safe to make
Safe operator changes:
- subject wording,
- message body wording,
- placeholder placement,
- signature placement,
- unsubscribe-link placement,
- creating variants with duplicate.

Changes that need extra care:
- removing placeholders without understanding what data they supply,
- manually hardcoding signature content when `{{email_signature}}` already exists,
- assuming tags/favorites/preview text are the most important durable data.

## How templates affect downstream sequence sending
- A sequence step starts by copying template content from this tab.
- Once that copy happens, the sequence step becomes its own saved content.
- Editing the shared template later does not automatically rewrite sequence steps that already copied it.

## Common mistakes users make when editing templates
- editing the shared template and assuming existing sequence steps changed too,
- forgetting to preview before moving into `Sequences`,
- deleting or changing placeholders without checking the rendered result,
- pasting full signatures manually instead of using `{{email_signature}}`,
- assuming AI suggestion is already saved.

## How to verify success
You are done with this tab when:
- the template exists in the library,
- the rendered preview looks correct,
- the placeholders, signature, and unsubscribe behavior make sense,
- you are ready to use the template in `Sequences`.

## What to do next
Go to [Sequences](./SEQUENCES.md).

## Reality check notes
- The current template model reliably persists the core content, but some richer metadata shown in the UI is not equally reliable in backend truth.
- Sequence steps are copied content. Shared-template edits are not live references.
- The send path enforces unsubscribe handling more strongly than the editor alone suggests.


