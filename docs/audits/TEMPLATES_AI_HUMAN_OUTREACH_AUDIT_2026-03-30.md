# Templates AI — Human / 1:1 Outreach audit (2026-03-30)

## 1) Where does “Improve with AI” originate?

- **`src/tabs/marketing/components/TemplatesTab.tsx`**: “Improve with AI” button calls `handleRewriteWithAI`, which **POSTs** `/api/templates/ai/tweak` with `templateBody`, optional `templateSubject`, `tone`, `instruction`, `preservePlaceholders: true`, and tenant headers (`X-Customer-Id` via `customerHeaders`).

## 2) What modes existed before this change?

- UI offered **Professional**, **Friendly**, **Conversational** (`casual`) only; backend **Zod** allowed **professional | friendly | casual | formal | persuasive**.

## 3) What prompt/instructions are sent?

- **`server/src/services/aiEmailService.ts`**: `SYSTEM_PROMPT` (B2B copywriter rules), recipient context lines, **`Desired Tone: …`** (legacy) or **mode-specific blocks** (new), optional `instruction`, placeholder markers `[[ODCRM_TOKEN_n]]` note, optional HTML structure note, then original subject/body.

## 4) How are placeholders protected?

- **`protectPlaceholders`** / **`restorePlaceholders`** in `aiEmailService.ts` use **`extractPlaceholders`** from `templateRenderer.ts`, replace `{{ … }}` with indexed markers, call Gemini, then restore. If restoration fails **`preservedPlaceholdersMatch`**, the **original** body/subject is returned (safe fallback).

## 5) How does the response return to the editor?

- API returns `{ data: { tweakedBody, tweakedSubject } }` (wrapped in `success` at top level in route). **TemplatesTab** sets **`aiSuggestion`** with subject + content; user **Apply** copies into `editingTemplate` (local only until Save).

## 6) Smallest safe place for a new rewrite mode?

- **`buildTemplateAiTweakPromptSuffix`** in **`server/src/utils/templateAiTweak.ts`** (central mode instructions + shared **Zod** `aiTweakRequestSchema`).
- **TemplatesTab** `<Select>` options only.

## 7) What must stay unchanged?

- **Placeholder masking/restoration** pipeline in **`aiEmailService`** (no fork).
- **`templateRenderer` / `enforceUnsubscribeFooter`** not altered for this feature (compliance insertion remains in send path, not in AI tweak).
- **Tenant**: `getCustomerId` / `X-Customer-Id` unchanged for template CRUD and AI routes using `requireMarketingMutationAuth`.
