# I18N & RTL Contract — ODCRM

**Objective:** Define the architecture, conventions, and guarantees for English/Arabic UI localization with RTL support. No business logic, schema, API, auth, or tenant behavior changes.

---

## 1. No-business-change guarantee

- English remains the **primary source of truth** for all UI copy and fallback behavior.
- Arabic is a **presentation/localization layer** only.
- No changes to: product logic, business rules, auth, tenant isolation (`X-Customer-Id`), routing meaning, DB schema, migrations, permissions, or workflow behavior.
- No destructive migrations. Prefer no migrations at all.
- No backend behavior drift. No hidden defaults except a **frontend-only** UI locale preference.

---

## 2. Architecture

### 2.1 Chosen approach (thin frontend-only layer)

- **Locale provider/context:** React context holding `locale: 'en' | 'ar'`, `direction: 'ltr' | 'rtl'`, and setter. Consumed by a `useLocale()` hook.
- **Dictionaries:** Typed flat key-value objects: `en.ts` (canonical), `ar.ts` (Arabic). Same keys in both; Arabic may omit keys and fall back to English.
- **Helper:** `t(key, params?)` — returns translated string; missing key returns English, then key as last resort; no throw.
- **Direction:** Root boundary (e.g. `document.documentElement.dir` or ChakraProvider wrapper) set to `rtl` when locale is `ar`, `ltr` otherwise.
- **Formatting:** Optional small helpers for locale-sensitive date/number if needed (e.g. `formatDate(date, locale)`); use only where frontend already formats.

### 2.2 Locale source of truth

- **Runtime:** In-memory state from `LocaleProvider`, initialized from persisted value.
- **Persistence:** `localStorage` key `odcrm:locale` with value `en` or `ar`. Frontend-only; not synced to backend. Restored on load.

### 2.3 English fallback strategy

1. For a given key, if locale is `ar` and Arabic dictionary has the key → use Arabic.
2. Else → use English dictionary.
3. If key is missing from English → return key string (no crash).
4. No runtime errors for missing translations.

### 2.4 RTL strategy

- When `locale === 'ar'`: set `document.documentElement.dir = 'rtl'` (and optionally `lang="ar"`). Chakra respects `dir` for layout/flip.
- When `locale === 'en'`: set `dir = 'ltr'`, `lang="en"`.
- Apply at app root so shell, nav, tabs, forms, tables, modals, toasts all inherit. Do not restyle unnecessarily; only fix what is needed for correct RTL (alignment, flex order, icon position, margins).

### 2.5 Locale persistence strategy

- On locale change: write `odcrm:locale` to `localStorage`, update context, then update `dir`/`lang` on root.
- On app init: read `odcrm:locale`; if `ar` or `en`, use it; otherwise default to `en`.

---

## 3. Terminology glossary (English → Arabic)

| English | Arabic | Notes |
|--------|--------|--------|
| Client | العميل | Singular; "Clients" = العملاء or "OpensDoors Clients" as brand |
| Onboarding | الإعداد | Setup/onboarding |
| Marketing | التسويق | |
| Readiness | الجاهزية | |
| Reports | التقارير | |
| Lead Sources | مصادر العملاء المحتملين | |
| Compliance | الامتثال | |
| Suppression List | قائمة الاستبعاد | |
| Email Accounts | حسابات البريد الإلكتروني | |
| Templates | القوالب | |
| Sequences | التسلسلات | |
| Schedules | الجداول | |
| Inbox | البريد الوارد | |
| Save | حفظ | |
| Cancel | إلغاء | |
| Close | إغلاق | |
| Create | إنشاء | |
| Update | تحديث | |
| Delete | حذف | |
| Edit | تعديل | |
| Search | بحث | |
| Filter | تصفية | |
| Refresh | تحديث | (or تنشيط for "refresh data") |
| Retry | إعادة المحاولة | |
| Back | رجوع | |
| Next | التالي | |
| Open | فتح | |
| View | عرض | |
| Confirm | تأكيد | |
| Send Test | إرسال تجريبي | |
| Launch | تشغيل | |
| Pause | إيقاف مؤقت | |
| Resume | استئناف | |
| Connected | متصل | |
| Loading | جاري التحميل | |
| No results | لا توجد نتائج | |
| Sign out | تسجيل الخروج | |
| Settings | الإعدادات | |
| Progress Tracker | متتبع التقدم | |
| Client Onboarding | إعداد العميل | |
| Sections | الأقسام | |

---

## 4. Translation conventions

- **Keys:** Flat, dot-separated, e.g. `nav.clients`, `common.save`, `onboarding.selectClient`.
- **Interpolation:** If needed, use placeholders like `{{name}}` and replace in `t()`; avoid concatenation of translated fragments.
- **Consistency:** Same key for same meaning everywhere (e.g. one key for "Save").
- **Arabic:** Professional Modern Standard Arabic; suitable for UAE (Dubai, Abu Dhabi) business/CRM context. No slang; avoid awkward literal machine translation.

---

## 5. Arabic UX conventions (mixed LTR/RTL)

- **Overall:** UI is RTL (layout, nav, tabs, forms, table headers).
- **Mixed content:** Emails, URLs, domains, raw IDs, phone numbers, and similar values must remain readable: wrap in `<span dir="ltr">` or use `dir="auto"` where appropriate so LTR content does not visually scramble.
- **Icons:** In RTL, icon placement (before/after label) should mirror; Chakra generally handles this when `dir` is set.
- **Tables:** Header and cell alignment follow RTL; numeric columns can stay end-aligned; LTR-only content in cells wrapped for direction.

---

## 6. Rollout scope

- **In scope:** App shell, top nav, sub-nav for Onboarding and Marketing, settings/admin/setup surfaces, customer/onboarding forms, common actions, key empty/loading/error and toast messages, and the first visible page content in high-traffic marketing tabs (Templates, Email Accounts, Lead Sources, Compliance, Inbox, Customer Onboarding).
- **Out of scope:** Translating user-generated DB content; changing email/onboarding/compliance/campaign/reports logic; API or schema changes.

---

## 7. Fixed implementation notes

- **Header control:** The shipped button-like language control was replaced with a real Chakra `Switch` and explicit side labels `English [toggle] العربية`.
- **Header placement:** The switch now lives in a fixed non-scrolling header block alongside the environment badge and sign-out control; it is no longer buried inside the horizontally scrolling tab strip.
- **Coverage expansion:** Arabic translation keys were extended beyond the shell into Settings/admin, Troubleshooting, customer/onboarding account forms, contacts, email-account surfaces, and the first visible marketing page content.
- **Fallback guarantee:** Arabic keys may still be added incrementally, but missing Arabic keys always fall back to English and missing keys never throw.

---

## 8. QA checklist

- [ ] English default: first load and no preference → English, LTR.
- [ ] Toggle to Arabic: UI switches to Arabic, RTL applied at root.
- [ ] Toggle to English: UI and LTR restored.
- [ ] Persistence: after refresh, selected locale and direction restored.
- [ ] Missing Arabic key: fallback to English, no crash.
- [ ] Missing key entirely: show key or English, no crash.
- [ ] Shell/nav/tabs: labels and Sign out localized; RTL layout correct.
- [ ] Onboarding + Marketing sub-tabs: labels and main copy localized; RTL alignment correct.
- [ ] Forms, modals, toasts: localized; no layout break in RTL.
- [ ] Mixed LTR: emails/URLs/IDs in tables/cards readable in Arabic mode.
- [ ] No console errors; no broken routes; no change in tenant/auth behavior.

---

## 9. Risks and mitigations

| Risk | Mitigation |
|------|------------|
| RTL breaking layout | Apply `dir` at root only; test shell, nav, tabs, forms, tables; fix only where needed |
| Missing key crashes UI | `t()` never throws; fallback to English then key |
| Backend coupling | Locale in localStorage only; no API or schema for locale |
| Terminology inconsistency | Single glossary (this doc) and shared keys |

---

## 10. Known limitations / low-risk leftovers

- Some low-traffic or secondary copy may remain in English in the first ship (for example: some deep modal copy, long-tail validation messages, or rarely used action labels in large marketing components). English fallback covers these safely.
- Date/number formatting: only where frontend already formats; no wholesale replacement of all formatting in one pass.
- No automatic translation of user-generated content (e.g. template body, sequence name). Out of scope.
- **Mixed LTR:** Use `LtrContent` (src/components/LtrContent.tsx) to wrap emails, URLs, domains, or IDs in table cells/cards when in Arabic mode so they display left-to-right. Applied incrementally where needed.
- **Deep tab copy:** The first visible content for Templates, Email Accounts, Lead Sources, Compliance, Inbox, Settings/admin, and Customer Onboarding is keyed now. Some deeper secondary controls in very large components such as `SequencesTab`, `SchedulesTab`, and nested dialogs remain low-risk follow-up work.

---

**Last updated:** 2026-03-16  
**Status:** Updated contract after replacing the shipped fake language button with a real toggle and broadening Arabic UI coverage without business-logic changes.
