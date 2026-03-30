# Templates AI — Human / 1:1 Outreach contract

## Modes

| key | UI label |
|-----|----------|
| `human_outreach` | Human / 1:1 Outreach |
| `concise_outreach` | Concise Outreach |

## Purpose (human_outreach)

Rewrite template copy so it sounds more like a **real person** sent a **direct 1:1** email: clearer, plainer, more natural. **Not** for spam evasion, hiding commercial intent, or removing compliance.

## Required behavior

1. **Placeholders**: All `{{…}}` supported by `extractPlaceholders` must survive the pipeline; mask/restore path is authoritative.
2. **Compliance placeholders**: Do not remove tokens such as `unsubscribe_link`, `email_signature`, etc.; instructions tell the model to keep them.
3. **No invented facts**: No fake relationships, referrals, or “we researched you” unless already in source.
4. **Style**: Plain language, shorter sentences, fewer generic marketing phrases, **one** low-friction CTA where appropriate, avoid listed clichés (see server prompt block).
5. **Subject**: If subject is sent, rewrite to simpler, human, less promotional lines.
6. **Non-goals**: Does not change send caps, warm-up, tracking, or placeholder contract in code.

## concise_outreach

Shorter than typical professional polish: direct, one CTA, low fluff; same placeholder/compliance rules as above.

## API

- `tone` on **POST `/api/templates/ai/tweak`** must be one of: `professional | friendly | casual | formal | persuasive | human_outreach | concise_outreach`.

## Fallback

If placeholder restoration validation fails, **`tweakEmailWithAI`** returns the **original** protected content (existing behavior).
