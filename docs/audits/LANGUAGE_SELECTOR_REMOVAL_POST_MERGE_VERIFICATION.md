# Post-merge verification — language selector removal (PR #343)

**Date:** 2026-03-22  
**PR:** [#343](https://github.com/gregvisser/ODCRM/pull/343) — refactor: remove language selector and multilingual UI support  
**Merge commit (origin/main):** `23975a9f0624e2a2f2f64fe2b46cc0e9c211ceb4`  
**Feature commit on branch:** `c0ace07ca2046ea6df6f94914772b92e3257b7f2`

## Merge status

- PR merged into `main` via merge commit (not squash).
- Local `main` reset to `origin/main` at merge SHA above.

## Production parity (`prod-check`)

Command (with retries for Azure rollout):

```text
PARITY_MAX_ATTEMPTS=60 PARITY_RETRY_DELAY_MS=10000 \
  npx --yes cross-env EXPECT_SHA=23975a9f0624e2a2f2f64fe2b46cc0e9c211ceb4 node scripts/prod-check.cjs
```

**Result:** Exit code **0**. Final state **PARITY_OK** — frontend and backend SHAs both equal the merge SHA after backend caught up (frontend updated first; parity on attempt 44/60).

**Endpoints:**

- Frontend: `https://odcrm.bidlow.co.uk/__build.json` → `sha: 23975a9f0624e2a2f2f64fe2b46cc0e9c211ceb4`
- Backend: `https://odcrm-api-hkbsfbdzdvezedg8.westeurope-01.azurewebsites.net/api/_build` → `sha: 23975a9f0624e2a2f2f64fe2b46cc0e9c211ceb4`

## Repo grep (post-merge `main`)

Searched under `src` for typical multilingual hooks and keys:

| Pattern | `src` result |
|--------|----------------|
| `LocaleContext` | No matches |
| `useLocale` | No matches |
| `useLanguage` | No matches |
| `useTranslation` | No matches |
| `odcrm:locale` | No matches |
| `setLanguage` / `setLocale` | No matches |
| `i18n` (imports/paths) | No matches in app source |
| `Arabic` / `RTL` / `dir="rtl"` | No matches in app source |

**Note:** `docs/audits/LANGUAGE_SELECTOR_REMOVAL.md` still documents removed symbols by name (expected). One **non-app** script still mentions old paths: `scripts/self-test-reporting-home-runtime.mjs` reads `src/i18n/en.ts` and `src/i18n/ar.ts` (files removed). That script will fail if run until updated; it is not part of the production bundle.

## Live smoke (deployment + HTML)

- `__build.json` confirms production frontend build at merge SHA.
- Quick scan of fetched `https://odcrm.bidlow.co.uk/` HTML found no obvious `locale` / `language` / `Arabic` / `i18n` substrings in the initial document (language selector is not present in static shell).
- Full signed-in UI pass (every tab) was not automated here; operators should spot-check nav/settings/marketing if desired.

## Conclusion

- **Parity:** Confirmed — FE and BE **both** report merge SHA `23975a9f0624e2a2f2f64fe2b46cc0e9c211ceb4`.
- **Product intent:** **English is the only supported UI language** for ODCRM after this merge; multilingual selector and `t()`-based i18n layers are removed from application source.
- **Follow-up (smallest):** Repair or retire `scripts/self-test-reporting-home-runtime.mjs` so it no longer references deleted `src/i18n/*.ts` files.
