# Stale i18n self-test reference cleanup

**Branch:** `codex/cleanup-language-selector-stale-selftest`  
**Start SHA (`origin/main` at branch):** `7bf687085b69a5f9be340323075ed27531f54fa7`

## Stale references found

| Location | Issue |
|----------|--------|
| `scripts/self-test-reporting-home-runtime.mjs` | `readFileSync` on deleted `src/i18n/en.ts` and `src/i18n/ar.ts` |
| Same file | Assertions on `enSource` / `arSource` for `nav.reporting-home` labels (multilingual contract only) |

Documentation-only mentions of removed i18n paths remain in historical audit files (`LANGUAGE_SELECTOR_REMOVAL*.md`); those describe past removals, not operational code.

## Exact fix

- Removed `enSource` / `arSource` file reads and the two `fail()` checks that asserted English/Arabic nav strings in deleted translation files.
- Left all other reporting-home / `ReportingDashboard` / nav contract checks unchanged (script still validates the reporting “Dashboard” home wiring until a future change removes that product area).

## Proof searches (after cleanup)

Executed on code globs `*.mjs,*.ts,*.tsx,*.js,*.cjs` (excludes markdown):

- Pattern `src/i18n|i18n/en.ts|i18n/ar.ts` → **no matches**
- Pattern `LocaleContext|useLocale|useLanguage|odcrm:locale` → **no matches**

Historical audit markdown under `docs/audits/` may still mention removed paths in narrative text; that is not operational code.

## Confirmation

- No operational code reads deleted `src/i18n/*.ts` files after this change.
- `src/i18n` is not recreated; no stubs added.
