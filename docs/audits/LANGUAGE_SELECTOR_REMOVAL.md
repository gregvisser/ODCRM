# Language selector removal (English-only UI)

**Date:** 2026-03-22  
**Branch:** `codex/remove-language-selector-english-only`

## Summary

All multilingual UI infrastructure was removed so the application uses **English only**. There is no language toggle, no runtime locale switching, and no RTL/LTR switching for Arabic.

## Removed

- `src/contexts/LocaleContext.tsx` — `LocaleProvider`, `useLocale`, `t()`.
- `src/i18n/` — `en.ts`, `ar.ts`, `index.ts`.
- `src/components/LtrContent.tsx` — wrapper used for direction-aware content.
- `LocaleProvider` wiring in `src/main.tsx`.
- English/Arabic (or similar) language switch UI in `src/App.tsx`.
- Product/audit docs that described i18n/RTL contracts: `docs/product/I18N_RTL_CONTRACT.md`, `docs/audits/I18N_RTL_AUDIT.md` (superseded by this document where needed).

## UI copy

Strings that previously went through `t('…')` are **inline English** in components. No `localStorage` key `odcrm:locale` (or equivalent) is used for UI language.

## HTML document

`index.html` keeps `lang="en"` and uses `dir="ltr"` on `<html>` as a fixed English LTR document.

## Verification

- Grep: no `LocaleContext`, `useLocale`, `src/i18n` imports, or `odcrm:locale` in source.
- Gates: `npm run lint`, `npx tsc --noEmit`, `npm run build`, `cd server && npm run build`.

## Database

No schema changes; no migrations related to this work.
